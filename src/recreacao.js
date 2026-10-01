// Recreação ao vivo: quem está online, chat e partidas (jogo da velha, pedra papel e tesoura, Lig 4, quiz e cobrinha ao vivo).
// Tudo passa por uma conexão WebSocket em /ws, aberta com a mesma sessão (cookie) do site.
// As partidas ficam na memória do servidor; o chat e os resultados vão para o banco.

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { db } = require('./db');
const { usuarioDaRequisicao, sessaoAindaValida } = require('./auth');
const { texto: limparTexto } = require('./util');
const quiz = require('./quiz');
const progresso = require('./progresso');
const antispam = require('./antispam');
const cobras = require('./cobras');
const damas = require('./damas');

const ESPERA_MS = Number(process.env.RECREACAO_ESPERA_MS) || 30_000;       // tempo para voltar depois de cair
const REVALIDAR_MS = Number(process.env.RECREACAO_REVALIDAR_MS) || 120_000; // confere se a sessão ainda vale
const HISTORICO = 80;
const COBRAS_PASSO_MS = Number(process.env.COBRAS_PASSO_MS) || 125;     // velocidade da cobrinha ao vivo
const COBRAS_LARGADA_MS = Number(process.env.COBRAS_LARGADA_MS) || 3000; // contagem antes de largar

class ErroJogo extends Error {}

const conexoes = new Map(); // id do usuário -> Set de conexões (a pessoa pode estar em várias abas)
const pessoas = new Map();  // id do usuário -> { id, nome, foto }
const salas = new Map();
const quedas = new Map();   // id do usuário -> timer de "voltar a tempo"

/* ─── Envio ───────────────────────────────────────── */

function enviar(ws, tipo, dados = {}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ tipo, ...dados }));
}
function paraUsuario(id, tipo, dados) {
  for (const ws of conexoes.get(id) || []) enviar(ws, tipo, dados);
}
function paraTodos(tipo, dados) {
  for (const lista of conexoes.values()) for (const ws of lista) enviar(ws, tipo, dados);
}
const online = () => [...conexoes.keys()].map(id => pessoas.get(id)).filter(Boolean)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/* ─── Jogos de duas pessoas ───────────────────────── */

const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const MAOS = ['pedra', 'papel', 'tesoura'];
const VENCE = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

// Lig 4: tabuleiro de 7 colunas e 6 linhas (casa = linha * 7 + coluna; a linha 0 é a de cima).
function quatroEmLinha(t, lin, col, i) {
  for (const [dl, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const casas = [[lin, col]];
    for (const lado of [1, -1]) {
      let l = lin + dl * lado;
      let c = col + dc * lado;
      while (l >= 0 && l < 6 && c >= 0 && c < 7 && t[l * 7 + c] === i) {
        casas.push([l, c]);
        l += dl * lado;
        c += dc * lado;
      }
    }
    if (casas.length >= 4) return casas.map(([l, c]) => l * 7 + c);
  }
  return null;
}

// Cada jogo: novo(quem começa), jogar(estado, índice do jogador, jogada) e visao(estado, índice de quem vê).
// jogar devolve null (continua), { vencedor: 0|1 } ou { empate: true }.
// O quiz é diferente (várias pessoas, tempo por pergunta) e tem as funções próprias mais abaixo.
const JOGOS = {
  velha: {
    nome: 'Jogo da Velha',
    max: 2,
    novo: inicia => ({ tabuleiro: Array(9).fill(null), vez: inicia, simbolos: inicia === 0 ? ['X', 'O'] : ['O', 'X'], linha: null }),
    jogar(e, i, { casa }) {
      if (e.vez !== i) throw new ErroJogo('Não é a sua vez.');
      if (!Number.isInteger(casa) || casa < 0 || casa > 8 || e.tabuleiro[casa]) throw new ErroJogo('Essa casa não está livre.');
      e.tabuleiro[casa] = e.simbolos[i];
      const linha = LINHAS.find(l => l.every(c => e.tabuleiro[c] === e.simbolos[i]));
      if (linha) { e.linha = linha; return { vencedor: i }; }
      if (e.tabuleiro.every(Boolean)) return { empate: true };
      e.vez = 1 - i;
      return null;
    },
    visao: e => ({ tabuleiro: e.tabuleiro, vez: e.vez, simbolos: e.simbolos, linha: e.linha }),
  },
  ppt: {
    nome: 'Pedra, Papel e Tesoura',
    max: 2,
    novo: () => ({ escolhas: [null, null], placar: [0, 0], rodadas: [] }),
    jogar(e, i, { escolha }) {
      if (!MAOS.includes(escolha)) throw new ErroJogo('Escolha pedra, papel ou tesoura.');
      if (e.escolhas[i]) throw new ErroJogo('Você já escolheu nesta rodada.');
      e.escolhas[i] = escolha;
      if (!e.escolhas[0] || !e.escolhas[1]) return null;
      const [a, b] = e.escolhas;
      const vencedor = a === b ? null : VENCE[a] === b ? 0 : 1;
      e.rodadas.push({ escolhas: [a, b], vencedor });
      e.escolhas = [null, null];
      if (vencedor === null) return null;
      e.placar[vencedor]++;
      return e.placar[vencedor] === 2 ? { vencedor } : null; // melhor de 3
    },
    // A escolha do outro só aparece depois que os dois escolheram.
    visao: (e, i) => ({ placar: e.placar, rodadas: e.rodadas, minha: i >= 0 ? e.escolhas[i] : null, escolheu: e.escolhas.map(Boolean) }),
  },
  lig4: {
    nome: 'Lig 4',
    max: 2,
    novo: inicia => ({ tabuleiro: Array(42).fill(null), vez: inicia, ultima: null, linha: null }),
    jogar(e, i, { coluna }) {
      if (e.vez !== i) throw new ErroJogo('Não é a sua vez.');
      if (!Number.isInteger(coluna) || coluna < 0 || coluna > 6) throw new ErroJogo('Escolha uma coluna.');
      let lin = 5;
      while (lin >= 0 && e.tabuleiro[lin * 7 + coluna] != null) lin--;
      if (lin < 0) throw new ErroJogo('Essa coluna está cheia.');
      e.tabuleiro[lin * 7 + coluna] = i;
      e.ultima = lin * 7 + coluna;
      const linha = quatroEmLinha(e.tabuleiro, lin, coluna, i);
      if (linha) { e.linha = linha; return { vencedor: i }; }
      if (e.tabuleiro.every(v => v != null)) return { empate: true };
      e.vez = 1 - i;
      return null;
    },
    visao: e => ({ tabuleiro: e.tabuleiro, vez: e.vez, ultima: e.ultima, linha: e.linha }),
  },
  damas: {
    nome: 'Damas',
    max: 2,
    novo: damas.novo,
    jogar(e, i, jogada) {
      try {
        return damas.jogar(e, i, jogada);
      } catch (x) {
        throw x instanceof damas.ErroDamas ? new ErroJogo(x.message) : x;
      }
    },
    visao: damas.visao,
  },
  quiz: {
    nome: 'Quiz de Lyendell',
    max: quiz.MAX_JOGADORES,
    grupo: true, // várias pessoas; quem abriu a sala decide quando começa
  },
  cobras: {
    nome: 'Cobrinha ao vivo',
    max: 4,
    min: 2,
    grupo: true,
  },
};

/* ─── Salas ───────────────────────────────────────── */

const indiceNa = (s, id) => s.jogadores.findIndex(p => p.id === id);
const salaAtivaDe = id => [...salas.values()].find(s => s.status !== 'fim' && s.jogadores.some(p => p.id === id && !p.saiu));
const ehGrupo = s => !!JOGOS[s.jogo].grupo;
const ehQuiz = s => s.jogo === 'quiz';
const ativos = s => s.jogadores.filter(p => !p.saiu);
const dono = s => ativos(s)[0] || null; // quem abriu a sala (ou o próximo, se ele saiu)

function visaoSala(s, id) {
  const eu = indiceNa(s, id);
  const jogo = JOGOS[s.jogo];
  let estado = null;
  if (s.estado) estado = ehQuiz(s) ? visaoQuiz(s, id) : s.jogo === 'cobras' ? visaoCobras(s) : jogo.visao(s.estado, eu);
  return {
    id: s.id,
    jogo: s.jogo,
    nomeJogo: jogo.nome,
    grupo: !!jogo.grupo,
    max: jogo.max,
    min: jogo.min || 1,
    opcoes: s.opcoes || null,
    status: s.status,
    eu,
    dono: dono(s)?.id ?? null,
    jogadores: s.jogadores.map(p => ({ id: p.id, nome: p.nome, foto: p.foto, conectado: conexoes.has(p.id), saiu: !!p.saiu })),
    estado,
    vencedor: s.vencedor,
    empate: s.empate,
    motivo: s.motivo,
    revanche: [...s.revanche],
    espectadores: s.espectadores.size,
  };
}

function enviarSala(s) {
  const ids = new Set([...s.jogadores.map(p => p.id), ...s.espectadores]);
  for (const id of ids) paraUsuario(id, 'sala', { sala: visaoSala(s, id) });
}

const resumoSalas = () => [...salas.values()]
  .filter(s => s.status !== 'fim')
  .map(s => ({
    id: s.id, jogo: s.jogo, nomeJogo: JOGOS[s.jogo].nome, status: s.status, grupo: ehGrupo(s), max: JOGOS[s.jogo].max,
    opcoes: s.opcoes || null, jogadores: ativos(s).map(p => p.nome), espectadores: s.espectadores.size,
  }));

const avisarLobby = () => paraTodos('salas', { salas: resumoSalas() });

function fecharSala(s) {
  clearTimeout(s.timer);
  salas.delete(s.id);
}

function finalizar(s, resultado, motivo) {
  s.status = 'fim';
  s.vencedor = resultado.empate ? null : resultado.vencedor;
  s.empate = !!resultado.empate;
  s.motivo = motivo;
  s.terminou = Date.now();
  const [a, b] = s.jogadores;
  if (!a || !b) return;
  db.run('INSERT INTO partidas (jogo, jogador1_id, jogador1_nome, jogador2_id, jogador2_nome, vencedor, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    s.jogo, a.id, a.nome, b.id, b.nome, s.empate ? null : s.vencedor + 1, motivo)
    .then(async () => {
      for (const p of [a, b]) await progresso.registrar(p.id, 'partida');
      if (!s.empate) await progresso.registrar(s.jogadores[s.vencedor].id, 'vitoria');
    })
    .catch(e => console.error('Erro ao guardar partida:', e.message));
}

// Sair de uma sala: quem assistia só para de assistir; quem jogava perde a partida em andamento.
function sairDaSala(id, s, motivo = 'abandono') {
  if (s.espectadores.delete(id)) { enviarSala(s); return; }
  const i = indiceNa(s, id);
  if (i < 0 || s.jogadores[i].saiu) return;
  if (ehGrupo(s)) { sairDoGrupo(id, s, i); return; }
  if (s.status === 'esperando') {
    fecharSala(s);
    paraUsuario(id, 'sala:fechada', { id: s.id });
    avisarLobby();
    return;
  }
  if (s.status === 'jogando') finalizar(s, { vencedor: 1 - i }, motivo);
  s.jogadores[i].saiu = true;
  s.revanche.clear();
  enviarSala(s);
  paraUsuario(id, 'sala:fechada', { id: s.id });
  if (s.jogadores.every(p => p.saiu)) fecharSala(s);
  avisarLobby();
}

// Sempre uma cópia: cada sala marca "saiu" no seu próprio jogador, sem afetar as outras salas.
// Cor e moldura escolhidas no perfil (aparecem no chat).
async function visualDe(id) {
  const v = await db.get('SELECT foto, cor, moldura FROM usuarios WHERE id = ?', id);
  return { foto: v?.foto || null, cor: v?.cor || null, moldura: v?.moldura || null };
}

function pessoaDe(u) {
  const p = pessoas.get(u.id);
  return { id: u.id, nome: p?.nome || u.nome, foto: p ? p.foto : u.foto || null };
}

/* ─── Quiz ────────────────────────────────────────── */

// Estado do quiz: perguntas sorteadas, a pergunta atual e em que fase ela está
// ("pergunta": valendo; "resposta": mostrando a certa), as respostas dela e o placar de cada um.

async function comecarQuiz(s) {
  const perguntas = await quiz.sortear(s.opcoes);
  if (!salas.has(s.id) || s.status !== 'esperando') return; // a sala fechou enquanto sorteava
  s.estado = { perguntas, atual: -1, fase: 'pergunta', prazo: 0, proxima: 0, respostas: {}, placar: {} };
  for (const p of s.jogadores) s.estado.placar[p.id] = { pontos: 0, acertos: 0 };
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  abrirPergunta(s, 0);
  avisarLobby();
}

function abrirPergunta(s, n) {
  const e = s.estado;
  Object.assign(e, { atual: n, fase: 'pergunta', respostas: {}, prazo: Date.now() + quiz.TEMPO_MS });
  clearTimeout(s.timer);
  s.timer = setTimeout(() => revelar(s), quiz.TEMPO_MS);
  enviarSala(s);
}

function responder(s, i, { alternativa }) {
  const e = s.estado;
  const p = s.jogadores[i];
  if (s.status !== 'jogando' || e.fase !== 'pergunta') throw new ErroJogo('Espere a próxima pergunta.');
  if (!Number.isInteger(alternativa) || alternativa < 0 || alternativa > 3) throw new ErroJogo('Escolha A, B, C ou D.');
  if (e.respostas[p.id]) throw new ErroJogo('Você já respondeu esta pergunta.');
  if (Date.now() > e.prazo + 300) throw new ErroJogo('O tempo acabou.');
  const certa = alternativa === e.perguntas[e.atual].correta;
  e.respostas[p.id] = { alt: alternativa, certa, pontos: quiz.pontosDaResposta(certa, e.prazo - Date.now()) };
  enviarSala(s);
  conferirRespostas(s);
}

// Se todos que estão na partida (e conectados) já responderam, não precisa esperar o tempo acabar.
function conferirRespostas(s) {
  const e = s.estado;
  if (s.status !== 'jogando' || e.fase !== 'pergunta') return;
  const faltam = ativos(s).filter(p => conexoes.has(p.id) && !e.respostas[p.id]);
  if (faltam.length) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => revelar(s), 700);
}

function revelar(s) {
  const e = s.estado;
  if (!salas.has(s.id) || s.status !== 'jogando' || e.fase !== 'pergunta') return;
  e.fase = 'resposta';
  for (const [id, r] of Object.entries(e.respostas)) {
    const placar = e.placar[id];
    placar.pontos += r.pontos;
    if (r.certa) placar.acertos++;
  }
  const ultima = e.atual + 1 >= e.perguntas.length;
  e.proxima = Date.now() + quiz.REVELAR_MS;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => (ultima ? terminarQuiz(s) : abrirPergunta(s, e.atual + 1)), quiz.REVELAR_MS);
  enviarSala(s);
}

// Classificação: mais pontos; no empate, mais acertos.
function classificacao(s) {
  const e = s.estado;
  return s.jogadores
    .map((p, i) => ({ i, id: p.id, nome: p.nome, saiu: !!p.saiu, ...e.placar[p.id] }))
    .sort((a, b) => a.saiu - b.saiu || b.pontos - a.pontos || b.acertos - a.acertos);
}

function terminarQuiz(s) {
  if (!salas.has(s.id) || s.status !== 'jogando') return;
  const e = s.estado;
  e.fase = 'fim';
  const lista = classificacao(s).filter(c => !c.saiu); // quem desistiu não entra no resultado
  s.status = 'fim';
  s.terminou = Date.now();
  s.vencedor = lista[0]?.i ?? null;
  if (lista.length) {
    db.lote(lista.map((c, posicao) => [
      'INSERT INTO quiz_resultados (usuario_id, usuario_nome, pontos, acertos, total, posicao, jogadores) VALUES (?, ?, ?, ?, ?, ?, ?)',
      c.id, c.nome, c.pontos, c.acertos, e.perguntas.length, posicao + 1, lista.length,
    ])).then(async () => {
      for (const [posicao, c] of lista.entries()) {
        if (c.acertos) await progresso.registrar(c.id, 'quiz_acerto', c.acertos);
        if (lista.length > 1) await progresso.registrar(c.id, 'partida');
        if (lista.length > 1 && posicao === 0) await progresso.registrar(c.id, 'vitoria');
      }
    }).catch(err => console.error('Erro ao guardar o quiz:', err.message));
  }
  enviarSala(s);
  avisarLobby();
}

// Sair de uma sala de várias pessoas (quiz ou cobrinha ao vivo).
function sairDoGrupo(id, s, i) {
  paraUsuario(id, 'sala:fechada', { id: s.id });
  if (s.status === 'esperando') {
    if (i === 0) {
      // Quem abriu a sala desistiu antes de começar: a sala fecha para todos.
      for (const p of s.jogadores) if (p.id !== id) paraUsuario(p.id, 'sala:fechada', { id: s.id, motivo: 'dono' });
      for (const x of s.espectadores) paraUsuario(x, 'sala:fechada', { id: s.id, motivo: 'dono' });
      fecharSala(s);
    } else {
      s.jogadores.splice(i, 1);
      enviarSala(s);
    }
    avisarLobby();
    return;
  }
  s.jogadores[i].saiu = true;
  if (!ativos(s).length) { fecharSala(s); avisarLobby(); return; }
  if (s.status === 'jogando' && ehQuiz(s)) conferirRespostas(s);
  if (s.status === 'jogando' && s.jogo === 'cobras') cobras.eliminar(s.estado, i); // a cobra de quem saiu vira cenouras
  enviarSala(s);
  avisarLobby();
}

function visaoQuiz(s, id) {
  const e = s.estado;
  const placar = classificacao(s).map(c => ({ id: c.id, pontos: c.pontos, acertos: c.acertos, saiu: c.saiu }));
  const base = { numero: e.atual + 1, total: e.perguntas.length, fase: e.fase, placar, tempoTotal: quiz.TEMPO_MS };
  if (e.fase === 'fim') return base;
  const p = e.perguntas[e.atual];
  const revelada = e.fase === 'resposta';
  return {
    ...base,
    categoria: quiz.CATEGORIAS[p.categoria],
    texto: p.texto,
    alternativas: p.alternativas,
    restante: revelada ? 0 : Math.max(0, e.prazo - Date.now()),
    proxima: revelada ? Math.max(0, e.proxima - Date.now()) : null,
    ultima: e.atual + 1 >= e.perguntas.length,
    minha: e.respostas[id]?.alt ?? null,
    responderam: Object.keys(e.respostas).map(Number),
    // A resposta certa (e o que cada um marcou) só aparece depois que a pergunta fecha.
    correta: revelada ? p.correta : null,
    respostas: revelada ? Object.entries(e.respostas).map(([uid, r]) => ({ id: Number(uid), alt: r.alt, pontos: r.pontos })) : null,
  };
}

/* ─── Cobrinha ao vivo ────────────────────────────── */

// O servidor roda a partida: a cada passo todas as cobras andam, e quem joga e quem assiste
// recebe o tabuleiro numa mensagem leve ("cobras:quadro"), sem mandar a sala inteira de novo.

function visaoCobras(s) {
  const e = s.estado;
  return {
    ...cobras.visao(e),
    ms: COBRAS_PASSO_MS, // a tela usa para deslizar as cobras entre um passo e outro
    fase: e.fase,
    largada: e.fase === 'largada' ? Math.max(0, e.largada - Date.now()) : 0,
    classificacao: e.fase === 'fim' ? cobras.classificacao(e).map(c => ({ i: c.i, pontos: c.pontos, viva: c.viva })) : null,
  };
}

function enviarQuadroCobras(s) {
  const q = visaoCobras(s);
  for (const id of new Set([...s.jogadores.map(p => p.id), ...s.espectadores])) paraUsuario(id, 'cobras:quadro', { id: s.id, q });
}

function comecarCobras(s) {
  const jogadores = ativos(s);
  if (jogadores.length < JOGOS.cobras.min) throw new ErroJogo('A cobrinha ao vivo precisa de pelo menos 2 jogadores (até 4).');
  s.jogadores = jogadores;
  s.estado = Object.assign(cobras.novo(jogadores.map(p => p.id)), { fase: 'largada', largada: Date.now() + COBRAS_LARGADA_MS });
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  clearTimeout(s.timer);
  // Contagem de 3 segundos antes de largar (dá para já escolher a direção).
  s.timer = setTimeout(() => {
    if (!salas.has(s.id) || s.status !== 'jogando') return;
    s.estado.fase = 'jogando';
    s.proximoPasso = Date.now();
    agendarPasso(s);
  }, COBRAS_LARGADA_MS);
  enviarSala(s);
  avisarLobby();
}

// Relógio dos passos sem atraso acumulado: cada passo é marcado a partir da hora certa do anterior.
function agendarPasso(s) {
  s.proximoPasso += COBRAS_PASSO_MS;
  s.timer = setTimeout(() => {
    passoCobras(s);
    if (salas.has(s.id) && s.status === 'jogando') agendarPasso(s);
  }, Math.max(0, s.proximoPasso - Date.now()));
}

function passoCobras(s) {
  if (!salas.has(s.id) || s.status !== 'jogando') return;
  cobras.passo(s.estado);
  if (cobras.acabou(s.estado)) terminarCobras(s);
  else enviarQuadroCobras(s);
}

function terminarCobras(s) {
  clearTimeout(s.timer);
  const e = s.estado;
  e.fase = 'fim';
  const v = cobras.vencedor(e);
  Object.assign(s, { status: 'fim', vencedor: v, empate: v == null, motivo: v == null ? 'empate' : 'vitoria', terminou: Date.now() });
  const lista = cobras.classificacao(e);
  db.lote(lista.map((c, posicao) => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'cobras', c.id, s.jogadores[c.i].nome, posicao + 1, lista.length, c.pontos, c.i === v ? 1 : 0,
  ])).then(async () => {
    for (const c of lista) await progresso.registrar(c.id, 'partida');
    if (v != null) await progresso.registrar(e.cobras[v].id, 'vitoria');
  }).catch(err => console.error('Erro ao guardar a cobrinha:', err.message));
  enviarQuadroCobras(s);
  enviarSala(s);
  avisarLobby();
}

/* ─── Jogos de uma pessoa só, transmitidos ao vivo ─── */

// Quem joga Pac-Coelho, Cobrinha ou Quebra-cabeça manda o estado do jogo algumas vezes por segundo,
// e o servidor repassa para quem está assistindo. Nada disso vai para o banco.
const SOLO = { pacman: 'Pac-Coelho', cobrinha: 'Cobrinha', quebra: 'Quebra-cabeça', memoria: 'Jogo da Memória', minado: 'Campo Minado', 2048: '2048' };
const transmissoes = new Map(); // id de quem joga -> transmissão

const resumoTransmissoes = () => [...transmissoes.values()].map(t => ({
  id: t.id, nome: t.nome, foto: t.foto, jogo: t.jogo, nomeJogo: SOLO[t.jogo], espectadores: t.espectadores.size,
}));
const avisarTransmissoes = () => paraTodos('transmissoes', { transmissoes: resumoTransmissoes() });
const avisarPlateia = t => paraUsuario(t.id, 'solo:plateia', { espectadores: t.espectadores.size });
const infoTransmissao = t => ({
  id: t.id, nome: t.nome, foto: t.foto, jogo: t.jogo, nomeJogo: SOLO[t.jogo], info: t.info, espectadores: t.espectadores.size,
  // O mapa das moedas do Pac-Coelho só vem quando muda; quem chega depois recebe o último.
  quadro: t.quadro ? { ...t.quadro, m: t.moedas ?? t.quadro.m } : null,
});

function encerrarTransmissao(id) {
  const t = transmissoes.get(id);
  if (!t) return;
  transmissoes.delete(id);
  for (const e of t.espectadores) paraUsuario(e, 'solo:fim', { id });
  avisarTransmissoes();
}

/* ─── O que cada mensagem do navegador faz ────────── */

const acoes = {
  async 'chat:enviar'(u, { texto }, ws) {
    const bruto = limparTexto(texto, 500);
    if (!bruto) return;
    // Barrada pelo anti-spam: volta só para quem mandou, com o texto (para não perder o que escreveu).
    const r = antispam.avaliar(u.id, bruto);
    if (!r.ok) {
      enviar(ws, 'chat:recusada', { motivo: r.motivo, texto: bruto, ate: r.ate || 0 });
      return;
    }
    const { id } = await db.run('INSERT INTO chat_mensagens (usuario_id, usuario_nome, texto) VALUES (?, ?, ?)', u.id, u.nome, r.texto);
    const msg = await db.get('SELECT * FROM chat_mensagens WHERE id = ?', id);
    paraTodos('chat:msg', { msg: { ...msg, ...(await visualDe(u.id)) } });
    // Só mensagem de verdade conta para XP, missões e conquistas (veja antispam.js).
    if (r.conta) progresso.registrar(u.id, 'chat');
  },

  async 'chat:apagar'(u, { id }) {
    const msg = await db.get('SELECT * FROM chat_mensagens WHERE id = ?', Number(id) || 0);
    if (!msg) return;
    if (msg.usuario_id !== u.id && !u.permissoes.has('recreacao.moderar')) throw new ErroJogo('Você só pode apagar as suas mensagens.');
    await db.run('DELETE FROM chat_mensagens WHERE id = ?', msg.id);
    paraTodos('chat:apagada', { id: msg.id });
  },

  async 'sala:criar'(u, { jogo, opcoes }) {
    if (!JOGOS[jogo]) throw new ErroJogo('Jogo desconhecido.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida. Termine ou saia dela antes de abrir outra.');
    let escolhidas = null;
    if (jogo === 'quiz') {
      escolhidas = quiz.validarOpcoes(opcoes);
      if (!await quiz.contarPerguntas(escolhidas.categorias)) throw new ErroJogo('Ainda não há perguntas nessas categorias.');
      if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida.'); // abriu outra enquanto contava
    }
    const s = {
      id: crypto.randomBytes(4).toString('hex'), jogo, jogadores: [pessoaDe(u)], status: 'esperando', estado: null, opcoes: escolhidas,
      inicia: 0, vencedor: null, empate: false, motivo: null, revanche: new Set(), espectadores: new Set(), criada: Date.now(), timer: null,
    };
    salas.set(s.id, s);
    enviarSala(s);
    avisarLobby();
    paraTodos('aviso', { texto: `${u.nome} abriu ${JOGOS[jogo].grupo ? 'uma sala' : 'uma partida'} de ${JOGOS[jogo].nome}.`, sala: s.id, de: u.id });
  },

  'sala:entrar'(u, { id }) {
    const s = salas.get(id);
    if (!s) throw new ErroJogo('Essa partida não existe mais.');
    const i = indiceNa(s, u.id);
    if (i >= 0 && !s.jogadores[i].saiu) { enviarSala(s); return; }
    if (s.status !== 'esperando') throw new ErroJogo('Essa partida já começou. Você pode assistir.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida. Termine ou saia dela antes.');
    if (s.jogadores.length >= JOGOS[s.jogo].max) throw new ErroJogo('A sala está cheia.');
    s.jogadores.push(pessoaDe(u));
    s.espectadores.delete(u.id);
    if (!ehGrupo(s)) {
      s.status = 'jogando';
      s.estado = JOGOS[s.jogo].novo(s.inicia);
    }
    enviarSala(s);
    avisarLobby();
  },

  'sala:assistir'(u, { id }) {
    const s = salas.get(id);
    if (!s) throw new ErroJogo('Essa partida não existe mais.');
    if (indiceNa(s, u.id) < 0) s.espectadores.add(u.id);
    enviarSala(s);
  },

  // Quiz: quem abriu a sala começa quando quiser (sozinho vale como treino).
  async 'sala:comecar'(u, { id }) {
    const s = salas.get(id);
    if (!s || !ehGrupo(s)) throw new ErroJogo('Essa sala não existe mais.');
    if (dono(s)?.id !== u.id) throw new ErroJogo('Só quem abriu a sala pode começar.');
    if (s.status !== 'esperando' || s.comecando) return;
    if (s.jogo === 'cobras') { comecarCobras(s); return; }
    s.comecando = true;
    try {
      await comecarQuiz(s);
    } catch (e) {
      throw e instanceof quiz.ErroQuiz ? new ErroJogo(e.message) : e;
    } finally {
      s.comecando = false;
    }
  },

  'sala:jogar'(u, { id, jogada }) {
    const s = salas.get(id);
    const i = s ? indiceNa(s, u.id) : -1;
    if (!s || i < 0 || s.jogadores[i].saiu) throw new ErroJogo('Você não está nessa partida.');
    if (s.status !== 'jogando') throw new ErroJogo('A partida não está em andamento.');
    if (ehQuiz(s)) { responder(s, i, jogada || {}); return; }
    if (ehGrupo(s)) throw new ErroJogo('Use as setas para jogar.');
    const resultado = JOGOS[s.jogo].jogar(s.estado, i, jogada || {});
    if (resultado) finalizar(s, resultado, resultado.empate ? 'empate' : 'vitoria');
    enviarSala(s);
    if (resultado) avisarLobby();
  },

  // Mede o atraso da conexão (a cobrinha ao vivo usa para virar na hora certa na tela).
  ping(u, { t }, ws) {
    enviar(ws, 'pong', { t });
  },

  // Cobrinha ao vivo: para onde a cobra vira (as setas de quem joga).
  'cobras:virar'(u, { id, dir }) {
    const s = salas.get(id);
    if (!s || s.jogo !== 'cobras' || s.status !== 'jogando') return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu) return;
    cobras.virar(s.estado, i, dir);
  },

  'sala:revanche'(u, { id }) {
    const s = salas.get(id);
    const i = s ? indiceNa(s, u.id) : -1;
    if (!s || i < 0 || s.status !== 'fim') throw new ErroJogo('Não dá para pedir revanche agora.');
    if (ehGrupo(s)) {
      // Quiz e cobrinha: a sala volta a esperar gente, com quem ficou até o fim.
      clearTimeout(s.timer);
      if (dono(s)?.id !== u.id) throw new ErroJogo('Só quem abriu a sala pode começar outra rodada.');
      s.jogadores = ativos(s);
      Object.assign(s, { status: 'esperando', estado: null, vencedor: null, empate: false, motivo: null, criada: Date.now() });
      enviarSala(s);
      avisarLobby();
      return;
    }
    if (s.jogadores.length < 2 || s.jogadores.some(p => p.saiu)) throw new ErroJogo('O outro jogador já saiu da partida.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está em outra partida.');
    s.revanche.add(u.id);
    if (s.revanche.size === 2) {
      s.inicia = 1 - s.inicia; // quem não começou, começa
      s.estado = JOGOS[s.jogo].novo(s.inicia);
      Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
      s.revanche.clear();
      avisarLobby();
    }
    enviarSala(s);
  },

  'sala:sair'(u, { id }) {
    const s = salas.get(id);
    if (s) sairDaSala(u.id, s, 'abandono');
  },

  'solo:inicio'(u, { jogo, info }) {
    if (!SOLO[jogo]) throw new ErroJogo('Jogo desconhecido.');
    const antes = transmissoes.get(u.id);
    const mesma = antes && antes.jogo === jogo;
    if (antes && !mesma) for (const e of antes.espectadores) paraUsuario(e, 'solo:fim', { id: u.id });
    const t = {
      id: u.id, nome: u.nome, foto: pessoaDe(u).foto, jogo, info: info && typeof info === 'object' ? info : {},
      quadro: null, moedas: null, espectadores: mesma ? antes.espectadores : new Set(), ultimo: 0,
    };
    transmissoes.set(u.id, t);
    for (const e of t.espectadores) paraUsuario(e, 'solo:info', { t: infoTransmissao(t) });
    avisarPlateia(t);
    avisarTransmissoes();
  },

  'solo:quadro'(u, { q }) {
    const t = transmissoes.get(u.id);
    if (!t || !q || typeof q !== 'object') return;
    const agora = Date.now();
    if (agora - t.ultimo < 40) return; // no máximo uns 25 quadros por segundo
    t.ultimo = agora;
    if (q.m != null) t.moedas = q.m;
    t.quadro = q;
    for (const e of t.espectadores) paraUsuario(e, 'solo:quadro', { id: u.id, q });
  },

  'solo:fim'(u) {
    encerrarTransmissao(u.id);
  },

  'solo:assistir'(u, { id }) {
    const t = transmissoes.get(Number(id));
    if (!t) throw new ErroJogo('Essa pessoa não está jogando agora.');
    if (t.id !== u.id) {
      t.espectadores.add(u.id);
      avisarPlateia(t);
      avisarTransmissoes();
    }
    paraUsuario(u.id, 'solo:info', { t: infoTransmissao(t) });
  },

  'solo:sair'(u, { id }) {
    const t = transmissoes.get(Number(id));
    if (t && t.espectadores.delete(u.id)) {
      avisarPlateia(t);
      avisarTransmissoes();
    }
  },
};

/* ─── Conexões ────────────────────────────────────── */

function conectar(ws, usuario, token) {
  const id = usuario.id;
  ws.usuario = usuario;
  ws.token = token;
  ws.vivo = true;
  pessoas.set(id, { id, nome: usuario.nome, foto: usuario.foto || null });
  const chegou = !conexoes.has(id);
  if (chegou) conexoes.set(id, new Set());
  conexoes.get(id).add(ws);
  clearTimeout(quedas.get(id));
  quedas.delete(id);

  ws.on('pong', () => { ws.vivo = true; });
  ws.on('close', () => desconectar(ws));
  ws.on('message', async bruto => {
    let msg;
    try { msg = JSON.parse(bruto); } catch { return; }
    const acao = acoes[msg?.tipo];
    if (!acao) return;
    try {
      await acao(usuario, msg.dados && typeof msg.dados === 'object' ? msg.dados : {}, ws);
    } catch (e) {
      const conhecido = e instanceof ErroJogo || e instanceof quiz.ErroQuiz;
      if (!conhecido) console.error('Erro na recreação:', e);
      enviar(ws, 'erro', { mensagem: conhecido ? e.message : 'Algo deu errado. Tente de novo.' });
    }
  });

  db.all(`SELECT * FROM (
      SELECT c.*, u.foto, u.cor, u.moldura FROM chat_mensagens c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT ?
    ) ORDER BY id`, HISTORICO)
    .then(historico => {
      const minha = salaAtivaDe(id);
      enviar(ws, 'ola', {
        eu: { id, nome: usuario.nome, moderar: usuario.permissoes.has('recreacao.moderar'), silenciadoAte: antispam.silenciadoAte(id) },
        online: online(), historico, salas: resumoSalas(), minhaSala: minha ? minha.id : null, transmissoes: resumoTransmissoes(),
      });
      if (minha) enviarSala(minha); // voltou a tempo: a partida continua
    })
    .catch(e => console.error('Erro ao abrir a recreação:', e.message));

  if (chegou) paraTodos('online', { online: online() });
}

function desconectar(ws) {
  const id = ws.usuario.id;
  const lista = conexoes.get(id);
  if (!lista) return;
  lista.delete(ws);
  if (lista.size) return; // ainda tem outra aba aberta
  conexoes.delete(id);
  paraTodos('online', { online: online() });
  for (const s of salas.values()) {
    if (s.espectadores.delete(id)) enviarSala(s);
  }
  encerrarTransmissao(id);
  for (const t of transmissoes.values()) {
    if (t.espectadores.delete(id)) { avisarPlateia(t); avisarTransmissoes(); }
  }
  const s = salaAtivaDe(id);
  if (!s) return;
  if (ehQuiz(s)) conferirRespostas(s); // o quiz não fica esperando quem caiu
  enviarSala(s); // mostra para os outros que a pessoa caiu
  // Se não voltar a tempo, perde a partida (ou a sala de espera fecha).
  quedas.set(id, setTimeout(() => {
    quedas.delete(id);
    if (!conexoes.has(id) && salas.has(s.id)) sairDaSala(id, s, 'caiu');
  }, ESPERA_MS));
}

function iniciarRecreacao(servidor) {
  // Conquistas, missões e níveis chegam na hora para quem está no site.
  progresso.definirNotificador((id, notas) => paraUsuario(id, 'progresso', { notas }));

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  servidor.on('upgrade', async (req, socket, head) => {
    const recusar = codigo => { socket.write(`HTTP/1.1 ${codigo}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    try {
      if (new URL(req.url, 'http://x').pathname !== '/ws') return recusar('404 Not Found');
      // Só aceita conexões vindas do próprio site (outro site não pode usar a sessão de quem está logado).
      const origem = req.headers.origin;
      if (origem) {
        const host = new URL(origem).host;
        if (![req.headers.host, req.headers['x-forwarded-host']].includes(host)) return recusar('403 Forbidden');
      }
      const s = await usuarioDaRequisicao(req);
      if (!s || !s.usuario.permissoes.has('recreacao.usar')) return recusar('401 Unauthorized');
      wss.handleUpgrade(req, socket, head, ws => conectar(ws, s.usuario, s.token));
    } catch {
      recusar('400 Bad Request');
    }
  });

  // Derruba conexões mortas (a hospedagem corta conexões paradas; o ping também as mantém vivas).
  setInterval(() => {
    for (const lista of conexoes.values()) {
      for (const ws of lista) {
        if (!ws.vivo) { ws.terminate(); continue; }
        ws.vivo = false;
        ws.ping();
      }
    }
  }, 30_000).unref();

  // Quem foi desativado, removido ou saiu do site perde a conexão.
  setInterval(async () => {
    for (const lista of conexoes.values()) {
      for (const ws of lista) {
        if (!await sessaoAindaValida(ws.token).catch(() => true)) ws.close(4001, 'Sessão encerrada');
      }
    }
  }, REVALIDAR_MS).unref();

  // Faxina das salas: terminadas há 15 minutos ou esperando há 1 hora.
  setInterval(() => {
    const agora = Date.now();
    for (const s of salas.values()) {
      if ((s.status === 'fim' && agora - s.terminou > 15 * 60_000) || (s.status === 'esperando' && agora - s.criada > 60 * 60_000)) {
        fecharSala(s);
      }
    }
    avisarLobby();
  }, 60_000).unref();
}

module.exports = { iniciarRecreacao };
