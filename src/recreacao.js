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
const raposa = require('./raposa');
const { MESAS, ErroMesa } = require('./mesa');
const cidade = require('./cidade');
const clube = require('./clube');
const junto = require('./junto');
const festa = require('./festa');
const mundo = require('./cidade-mundo');
const { paraCriancas } = require('./censura');
const bobo = require('./bobo');

const ESPERA_MS = Number(process.env.RECREACAO_ESPERA_MS) || 30_000;       // tempo para voltar depois de cair
const REVALIDAR_MS = Number(process.env.RECREACAO_REVALIDAR_MS) || 120_000; // confere se a sessão ainda vale
const HISTORICO = 80;
const COBRAS_PASSO_MS = Number(process.env.COBRAS_PASSO_MS) || 125;     // velocidade da cobrinha ao vivo
const COBRAS_LARGADA_MS = Number(process.env.COBRAS_LARGADA_MS) || 3000; // contagem antes de largar
const COLHEITA_MS = Number(process.env.COLHEITA_MS) || 90_000;             // quanto dura a colheita (co-op)
const RAPOSA_MS = Number(process.env.RAPOSA_MS) || 800;                    // a Raposa "pensa" antes de jogar
const MEMORIA_FECHAR_MS = Number(process.env.MEMORIA_FECHAR_MS) || 1100;   // as duas cartas erradas ficam à mostra

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

// Personagem criança: as mensagens chegam para ela sem palavrão (veja censura.js).
const ehCrianca = id => !!pessoas.get(id)?.crianca;
const limparMsg = msg => ({ ...msg, texto: paraCriancas(msg.texto) });
const msgPara = (id, msg) => (ehCrianca(id) ? limparMsg(msg) : msg);
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
  cidade: {
    nome: 'Lyendell Dorme',
    max: cidade.MAX,
    min: cidade.MIN,
    grupo: true,
  },
  // Mesas compartilhadas (veja mesa.js): todos no mesmo tabuleiro.
  minado: { nome: 'Campo Minado', max: 6, min: 1, grupo: true, mesa: true },
  quebra: { nome: 'Quebra-cabeça', max: 6, min: 1, grupo: true, mesa: true },
  memoria: { nome: 'Jogo da Memória', max: 6, min: 1, grupo: true, mesa: true },
  // Jogos juntos: todos no mesmo jogo, ao mesmo tempo (veja junto.js). O máximo depende do jogo.
  junto: { nome: 'Juntos', max: 6, min: 1, grupo: true },
  // Festa na Toca: o tabuleiro com minijogos (veja festa.js). Os lugares vazios podem ser coelhos da casa.
  festa: { nome: 'Festa na Toca', max: 10, min: 1, grupo: true },
};
const maxDa = s => (s.jogo === 'junto' ? junto.maximo(s.opcoes) : JOGOS[s.jogo].max);
const ehMesa = s => !!JOGOS[s.jogo]?.mesa;

/* ─── Salas ───────────────────────────────────────── */

// As opções de cada jogo (o modo e o resto), conferidas antes de valer.
function validarOpcoesDaSala(jogo, opcoes = {}) {
  try {
    if (jogo === 'cidade') return cidade.validarOpcoes(opcoes);
    if (jogo === 'quiz') return quiz.validarOpcoes(opcoes);
  } catch (x) {
    throw x instanceof quiz.ErroQuiz ? new ErroJogo(x.message) : x;
  }
  if (jogo === 'cobras') return { modo: cobras.MODOS.includes(opcoes?.modo) ? opcoes.modo : 'todos' };
  if (MESAS[jogo]) return MESAS[jogo].opcoes(opcoes || {});
  if (jogo === 'junto') return junto.opcoes(opcoes || {});
  if (jogo === 'festa') return festa.opcoes(opcoes || {});
  // Velha, Lig 4 e Damas: um contra o outro (versus) ou contra a Raposa, o computador (co-op).
  if (raposa.COM_RAPOSA.includes(jogo)) return { modo: opcoes?.modo === 'raposa' ? 'raposa' : 'versus' };
  return null;
}

const indiceNa = (s, id) => s.jogadores.findIndex(p => p.id === id);
const MODO_COBRAS = { colheita: 'Colheita, co-op', duplas: '2 contra 2' };
const MODO_QUIZ = { equipe: 'em equipe', times: 'dois times' };
function nomeDaSala(s) {
  const nome = JOGOS[s.jogo].nome;
  const o = s.opcoes || {};
  if (s.jogo === 'junto') return junto.nomeDo(o);
  if (s.jogo === 'festa') return `${nome} (${o.rodadas} rodadas)`;
  if (o.modo === 'raposa') return `${nome} contra a Raposa`;
  if (s.jogo === 'quiz' && MODO_QUIZ[o.modo]) return `${nome} (${MODO_QUIZ[o.modo]})`;
  if (s.jogo === 'cobras' && MODO_COBRAS[o.modo]) return `${nome} (${MODO_COBRAS[o.modo]})`;
  if (ehMesa(s)) return `${nome} (${o.modo === 'coop' ? 'co-op' : 'versus'})`;
  return nome;
}
const salaAtivaDe = id => [...salas.values()].find(s => s.status !== 'fim' && s.jogadores.some(p => p.id === id && !p.saiu));
const ehGrupo = s => !!JOGOS[s.jogo].grupo;
const ehQuiz = s => s.jogo === 'quiz';
const ehRaposa = s => s.opcoes?.modo === 'raposa';
const ativos = s => s.jogadores.filter(p => !p.saiu);
const dono = s => ativos(s)[0] || null; // quem abriu a sala (ou o próximo, se ele saiu)

function visaoSala(s, id) {
  const eu = indiceNa(s, id);
  const jogo = JOGOS[s.jogo];
  let estado = null;
  if (s.estado) {
    estado = ehQuiz(s) ? visaoQuiz(s, id) : s.jogo === 'cobras' ? visaoCobras(s) : s.jogo === 'cidade' ? cidade.visao(s.estado, eu)
      : ehMesa(s) ? { ...MESAS[s.jogo].visao(s.estado, eu), vencedores: s.estado.vencedores || null }
      : s.jogo === 'junto' ? junto.visao(s.estado)
      : s.jogo === 'festa' ? festa.visao(s.estado) : jogo.visao(s.estado, eu);
    if (s.jogo === 'cidade' && ehCrianca(id)) {
      estado.chat = Object.fromEntries(Object.entries(estado.chat).map(([c, l]) => [c, l.map(limparMsg)]));
    }
  }
  return {
    id: s.id,
    jogo: s.jogo,
    nomeJogo: nomeDaSala(s),
    grupo: !!jogo.grupo,
    max: maxDa(s),
    min: s.jogo === 'junto' ? junto.minimo(s.opcoes) : s.jogo === 'festa' ? (s.opcoes?.cpus ? 1 : 2) : jogo.min || 1,
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
    mundo: s.jogo === 'cidade' ? { visuais: Object.fromEntries(mundoDe(s).visuais) } : undefined,
    raposa: ehRaposa(s) ? { vezDe: s.status === 'jogando' && s.estado?.vez === 0 ? vezDoTime(s) : null, pensando: s.status === 'jogando' && s.estado?.vez === 1 } : null,
  };
}

/* ─── Contra a Raposa (co-op) ─────────────────────── */

// A pessoa (ou a dupla, um lance cada) joga com o lado 0; a Raposa, com o lado 1.
function vezDoTime(s) {
  const humanos = ativos(s);
  return humanos.length ? humanos[s.raposa.turno % humanos.length].id : null;
}

function comecarRaposa(s) {
  s.jogadores = ativos(s);
  s.estado = JOGOS[s.jogo].novo(s.inicia);
  s.raposa = { turno: 0 };
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  if (s.estado.vez === 1) agendarRaposa(s);
  enviarSala(s);
  avisarLobby();
}

function agendarRaposa(s) {
  clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    if (!salas.has(s.id) || s.status !== 'jogando' || s.estado.vez !== 1) return;
    const r = JOGOS[s.jogo].jogar(s.estado, 1, raposa.jogadaDaRaposa(s.jogo, s.estado));
    if (r) finalizarRaposa(s, r, r.empate ? 'empate' : 'vitoria');
    enviarSala(s);
  }, RAPOSA_MS);
}

function jogarContraRaposa(s, u, jogada) {
  if (s.estado.vez !== 0) throw new ErroJogo('Espere: é a vez da Raposa.');
  if (vezDoTime(s) !== u.id) throw new ErroJogo('Agora é a vez do seu parceiro.');
  const r = JOGOS[s.jogo].jogar(s.estado, 0, jogada || {});
  s.raposa.turno++;
  if (r) finalizarRaposa(s, r, r.empate ? 'empate' : 'vitoria');
  else if (s.estado.vez === 1) agendarRaposa(s);
  enviarSala(s);
}

function finalizarRaposa(s, resultado, motivo) {
  clearTimeout(s.timer);
  Object.assign(s, { status: 'fim', vencedor: resultado.empate ? null : resultado.vencedor, empate: !!resultado.empate, motivo, terminou: Date.now() });
  const humanos = s.jogadores.filter(p => !p.saiu);
  const venceram = s.vencedor === 0;
  db.lote(humanos.map(p => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    `${s.jogo}_raposa`, p.id, p.nome, venceram ? 1 : 2, humanos.length, 0, venceram ? 1 : 0,
  ])).then(async () => {
    for (const p of humanos) {
      await progresso.registrar(p.id, 'partida');
      await progresso.registrar(p.id, 'coop');
      if (venceram) await progresso.registrar(p.id, 'vitoria');
    }
  }).catch(err => console.error('Erro ao guardar a partida contra a Raposa:', err.message));
  avisarLobby();
}

function enviarSala(s) {
  if (s.jogo === 'cidade') mundoDe(s).sujo = true; // quem acabou de chegar recebe onde está cada coelho
  const ids = new Set([...s.jogadores.map(p => p.id), ...s.espectadores]);
  for (const id of ids) paraUsuario(id, 'sala', { sala: visaoSala(s, id) });
}

const resumoSalas = () => [...salas.values()]
  .filter(s => s.status !== 'fim')
  .map(s => ({
    id: s.id, jogo: s.jogo, nomeJogo: nomeDaSala(s), status: s.status, grupo: ehGrupo(s), max: maxDa(s),
    opcoes: s.opcoes || null, jogadores: ativos(s).map(p => p.nome), espectadores: s.espectadores.size,
  }));

const avisarLobby = () => paraTodos('salas', { salas: resumoSalas() });

function fecharSala(s) {
  clearTimeout(s.timer);
  clearInterval(s.relogio);
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
  if (ehRaposa(s) && !(s.status === 'esperando' && i === 0)) {
    // Contra a Raposa: quem sobra continua sozinho; sem ninguém, a Raposa vence (ou a sala fecha).
    paraUsuario(id, 'sala:fechada', { id: s.id });
    if (s.status === 'esperando') s.jogadores.splice(i, 1);
    else s.jogadores[i].saiu = true;
    if (!ativos(s).length) {
      if (s.status === 'jogando') finalizarRaposa(s, { vencedor: 1 }, motivo);
      fecharSala(s);
    } else {
      enviarSala(s);
    }
    avisarLobby();
    return;
  }
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
  if (s.opcoes?.modo === 'times' && ativos(s).length < 2) throw new ErroJogo('O modo de dois times precisa de pelo menos 2 pessoas.');
  const perguntas = await quiz.sortear(s.opcoes);
  if (!salas.has(s.id) || s.status !== 'esperando') return; // a sala fechou enquanto sorteava
  s.estado = { perguntas, atual: -1, fase: 'pergunta', prazo: 0, proxima: 0, respostas: {}, placar: {}, modo: s.opcoes?.modo || 'todos', times: null };
  for (const p of s.jogadores) s.estado.placar[p.id] = { pontos: 0, acertos: 0 };
  // Dois times: sorteados e equilibrados (um para cada lado, alternando).
  if (s.estado.modo === 'times') {
    const ordem = [...ativos(s)].sort(() => Math.random() - 0.5);
    s.estado.times = Object.fromEntries(ordem.map((p, i) => [p.id, i % 2]));
  }
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
  // Quem venceu, conforme o modo: o primeiro; a equipe toda (se bateu a meta); o time que somou mais.
  const resumo = resumoDoQuiz(s, lista);
  e.resultado = resumo;
  const venceu = c => (resumo.modo === 'todos' ? c === lista[0] : resumo.vencedores.includes(c.id));
  if (lista.length) {
    db.lote(lista.map((c, posicao) => [
      'INSERT INTO quiz_resultados (usuario_id, usuario_nome, pontos, acertos, total, posicao, jogadores) VALUES (?, ?, ?, ?, ?, ?, ?)',
      c.id, c.nome, c.pontos, c.acertos, e.perguntas.length, resumo.modo === 'todos' ? posicao + 1 : venceu(c) ? 1 : 2, lista.length,
    ])).then(async () => {
      for (const c of lista) {
        if (c.acertos) await progresso.registrar(c.id, 'quiz_acerto', c.acertos);
        if (lista.length > 1) await progresso.registrar(c.id, 'partida');
        if (resumo.modo === 'equipe') await progresso.registrar(c.id, 'coop');
        if (lista.length > 1 && venceu(c)) await progresso.registrar(c.id, 'vitoria');
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
  if (s.status === 'jogando' && s.jogo === 'cobras') { s.estado.cobras[i].saiu = true; cobras.eliminar(s.estado, i); } // a cobra de quem saiu vira cenouras (e não renasce)
  if (s.status === 'jogando' && s.jogo === 'memoria' && s.estado.vez === i) {
    s.estado.abertas = [];
    s.estado.fechar = false;
    MESAS.memoria.passarVez(s.estado, indicesAtivos(s));
  }
  if (s.status === 'jogando' && s.jogo === 'festa') festa.sair(s.estado, i); // vira um coelho da casa e a festa continua
  if (s.status === 'jogando' && s.jogo === 'junto') {
    junto.sair(s.estado, i);
    if (junto.verificar(s.estado)) { terminarJunto(s); return; }
  }
  if (s.status === 'jogando' && s.jogo === 'cidade') {
    cidade.sair(s.estado, i); // quem sai morre na cidade
    if (s.estado.fase === 'fim') { terminarCidade(s); return; }
    if (s.estado.fase === 'cacador' && cidade.todosProntos(s.estado)) agendarCidade(s, true);
  }
  enviarSala(s);
  avisarLobby();
}

// Modo equipe: a meta de acertos da sala inteira. Modo times: os pontos de cada time.
function resumoDoQuiz(s, lista = classificacao(s).filter(c => !c.saiu)) {
  const e = s.estado;
  const modo = e.modo || 'todos';
  if (modo === 'equipe') {
    const acertos = lista.reduce((t, c) => t + c.acertos, 0);
    const meta = Math.max(1, Math.ceil(quiz.META_EQUIPE * e.perguntas.length * lista.length));
    return { modo, acertos, meta, vencedores: e.fase === 'fim' && acertos >= meta ? lista.map(c => c.id) : [] };
  }
  if (modo === 'times') {
    const pontos = [0, 0];
    for (const c of lista) pontos[e.times?.[c.id] ?? 0] += c.pontos;
    const time = pontos[0] === pontos[1] ? null : pontos[0] > pontos[1] ? 0 : 1;
    return { modo, pontos, time, vencedores: e.fase === 'fim' && time != null ? lista.filter(c => e.times[c.id] === time).map(c => c.id) : [] };
  }
  return { modo, vencedores: [] };
}

function visaoQuiz(s, id) {
  const e = s.estado;
  const placar = classificacao(s).map(c => ({ id: c.id, pontos: c.pontos, acertos: c.acertos, saiu: c.saiu, time: e.times?.[c.id] ?? null }));
  const base = { numero: e.atual + 1, total: e.perguntas.length, fase: e.fase, placar, tempoTotal: quiz.TEMPO_MS, modo: e.modo || 'todos', resumo: resumoDoQuiz(s) };
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
    resultado: e.fase === 'fim' ? e.resultado : null,
  };
}

function enviarQuadroCobras(s) {
  const q = visaoCobras(s);
  for (const id of new Set([...s.jogadores.map(p => p.id), ...s.espectadores])) paraUsuario(id, 'cobras:quadro', { id: s.id, q });
}

function comecarCobras(s) {
  const jogadores = ativos(s);
  if (jogadores.length < JOGOS.cobras.min) throw new ErroJogo('A cobrinha ao vivo precisa de pelo menos 2 jogadores (até 4).');
  const modo = s.opcoes?.modo || 'todos';
  if (modo === 'duplas' && jogadores.length !== 4) throw new ErroJogo('O 2 contra 2 precisa de exatamente 4 jogadores.');
  s.jogadores = jogadores;
  // Colheita (co-op): 90 segundos para a equipe juntar 15 cenouras por cobra (e mais 15% por cobra a mais).
  const limite = Math.ceil(COLHEITA_MS / COBRAS_PASSO_MS);
  const meta = Math.round(15 * jogadores.length * (1 + 0.15 * (jogadores.length - 1)));
  s.estado = Object.assign(cobras.novo(jogadores.map(p => p.id), Math.random, { modo, limite, meta }),
    { fase: 'largada', largada: Date.now() + COBRAS_LARGADA_MS });
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
  const r = cobras.resultado(e);
  e.resultado = r;
  const v = r.vencedor;
  Object.assign(s, { status: 'fim', vencedor: v, empate: r.empate, motivo: r.empate ? 'empate' : 'vitoria', terminou: Date.now() });
  const lista = cobras.classificacao(e);
  db.lote(lista.map((c, posicao) => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'cobras', c.id, s.jogadores[c.i].nome, posicao + 1, lista.length, c.pontos, r.venceram.includes(c.i) ? 1 : 0,
  ])).then(async () => {
    for (const c of lista) await progresso.registrar(c.id, 'partida');
    if (e.modo === 'colheita') for (const c of lista) await progresso.registrar(c.id, 'coop');
    for (const i of r.venceram) await progresso.registrar(e.cobras[i].id, 'vitoria');
  }).catch(err => console.error('Erro ao guardar a cobrinha:', err.message));
  enviarQuadroCobras(s);
  enviarSala(s);
  avisarLobby();
}

/* ─── Mesas compartilhadas ────────────────────────── */

const indicesAtivos = s => s.jogadores.map((p, i) => (p.saiu ? -1 : i)).filter(i => i >= 0);

function comecarMesa(s) {
  const jogadores = ativos(s);
  if (s.opcoes.modo === 'versus' && jogadores.length < 2) throw new ErroJogo('O versus precisa de pelo menos 2 pessoas.');
  s.jogadores = jogadores;
  s.estado = MESAS[s.jogo].novo(s.opcoes, jogadores.length);
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  enviarSala(s);
  avisarLobby();
}

function jogarMesa(s, i, jogada) {
  const e = s.estado;
  try {
    MESAS[s.jogo].agir(e, i, jogada, indicesAtivos(s));
  } catch (x) {
    throw x instanceof ErroMesa ? new ErroJogo(x.message) : x;
  }
  // Memória: as cartas erradas ficam à mostra um instante e depois a vez passa.
  if (s.jogo === 'memoria' && e.fechar && !e.fim) {
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      if (!salas.has(s.id) || s.status !== 'jogando') return;
      MESAS.memoria.fecharCartas(e, indicesAtivos(s));
      enviarSala(s);
    }, MEMORIA_FECHAR_MS);
  }
  if (e.fim) terminarMesa(s);
  else enviarSala(s);
}

function terminarMesa(s) {
  clearTimeout(s.timer);
  const e = s.estado;
  const ativosIdx = indicesAtivos(s);
  const venceram = MESAS[s.jogo].vencedores(e, ativosIdx);
  e.vencedores = venceram;
  Object.assign(s, { status: 'fim', vencedor: venceram.length === 1 ? venceram[0] : null, empate: !venceram.length, motivo: e.fim, terminou: Date.now() });
  const lista = ativosIdx.map(i => s.jogadores[i]);
  db.lote(ativosIdx.map(i => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    `${s.jogo}_${s.opcoes.modo}`, s.jogadores[i].id, s.jogadores[i].nome, venceram.includes(i) ? 1 : 2, lista.length,
    s.jogo === 'memoria' ? e.pares[i] : s.jogo === 'minado' ? e.casas?.[i] || 0 : s.jogo === 'quebra' ? e.certas?.[i] || 0 : 0, venceram.includes(i) ? 1 : 0,
  ])).then(async () => {
    for (const i of ativosIdx) {
      await progresso.registrar(s.jogadores[i].id, lista.length > 1 ? 'partida' : 'solo');
      if (lista.length > 1 && venceram.includes(i)) await progresso.registrar(s.jogadores[i].id, 'vitoria');
    }
  }).then(async () => {
    if (s.opcoes.modo === 'coop') for (const i of ativosIdx) await progresso.registrar(s.jogadores[i].id, 'coop');
  }).catch(err => console.error('Erro ao guardar a mesa:', err.message));
  enviarSala(s);
  avisarLobby();
}

/* ─── Jogos juntos ────────────────────────────────── */

const JUNTO_PASSO_MS = 50; // o relógio dos jogos que rodam no servidor (Pac-Coelho): 20 passos por segundo

async function comecarJunto(s) {
  const jogadores = ativos(s);
  if (jogadores.length < junto.minimo(s.opcoes)) throw new ErroJogo('O versus precisa de pelo menos 2 pessoas.');
  if (jogadores.length > junto.maximo(s.opcoes)) throw new ErroJogo(`Esse jogo cabe no máximo ${junto.maximo(s.opcoes)} pessoas.`);
  s.comecando = true;
  let visuais;
  try {
    visuais = await Promise.all(jogadores.map(p => clube.visualDesenho(p.id).catch(() => null)));
  } finally {
    s.comecando = false;
  }
  if (!salas.has(s.id) || s.status !== 'esperando') return;
  s.jogadores = jogadores;
  s.estado = junto.novo(s.opcoes, jogadores.length, visuais);
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  agendarJunto(s);
  enviarSala(s);
  avisarLobby();
}

function agendarJunto(s) {
  const e = s.estado;
  clearTimeout(s.timer);
  clearInterval(s.relogio);
  s.timer = setTimeout(() => {
    if (salas.has(s.id) && s.status === 'jogando' && s.estado === e && junto.verificar(e)) terminarJunto(s);
  }, e.limite - Date.now() + 50);
  if (!junto.temPasso(e)) return;
  let antes = Date.now();
  s.relogio = setInterval(() => {
    if (!salas.has(s.id) || s.status !== 'jogando' || s.estado !== e) { clearInterval(s.relogio); return; }
    const agora = Date.now();
    const dt = Math.min(0.2, (agora - antes) / 1000);
    antes = agora;
    if (junto.passo(e, dt, agora)) enviarQuadroJunto(s);
    if (junto.verificar(e, agora)) terminarJunto(s);
  }, JUNTO_PASSO_MS);
}

const quemVeJunto = s => new Set([...s.jogadores.map(p => p.id), ...s.espectadores]);
function enviarQuadroJunto(s) {
  if (junto.temQuadroPara(s.estado)) {
    // Cada um recebe o seu quadro (só o que está perto do seu coelho); quem assiste vai como -1.
    for (const id of quemVeJunto(s)) paraUsuario(id, 'junto:quadro', { id: s.id, q: junto.quadroPara(s.estado, indiceNa(s, id)) });
    return;
  }
  const q = junto.quadro(s.estado);
  for (const id of quemVeJunto(s)) paraUsuario(id, 'junto:quadro', { id: s.id, q });
}

function terminarJunto(s) {
  clearTimeout(s.timer);
  clearInterval(s.relogio);
  const e = s.estado;
  const venceram = e.vencedores || [];
  Object.assign(s, { status: 'fim', vencedor: venceram.length === 1 ? venceram[0] : null, empate: !venceram.length, motivo: e.fim, terminou: Date.now() });
  const lista = indicesAtivos(s);
  db.lote(lista.map(i => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    `junto_${e.jogo}_${e.modo}`, s.jogadores[i].id, s.jogadores[i].nome, venceram.includes(i) ? 1 : 2, lista.length,
    e.p[i]?.pontos || 0, venceram.includes(i) ? 1 : 0,
  ])).then(async () => {
    for (const i of lista) {
      await progresso.registrar(s.jogadores[i].id, lista.length > 1 ? 'partida' : 'solo');
      if (lista.length > 1 && venceram.includes(i)) await progresso.registrar(s.jogadores[i].id, 'vitoria');
      if (e.modo === 'coop') await progresso.registrar(s.jogadores[i].id, 'coop');
    }
  }).catch(err => console.error('Erro ao guardar o jogo junto:', err.message));
  if (e.sim) enviarQuadroJunto(s);
  enviarSala(s);
  avisarLobby();
}

/* ─── Festa na Toca ───────────────────────────────── */

async function comecarFesta(s) {
  const jogadores = ativos(s);
  if (!s.opcoes.cpus && jogadores.length < 2) throw new ErroJogo('Sem os coelhos da casa, a festa precisa de pelo menos 2 pessoas.');
  s.comecando = true;
  let visuais;
  try {
    visuais = await Promise.all(jogadores.map(p => clube.visualDesenho(p.id).catch(() => null)));
  } finally {
    s.comecando = false;
  }
  if (!salas.has(s.id) || s.status !== 'esperando') return;
  s.jogadores = jogadores;
  s.estado = festa.novo(s.opcoes, jogadores, visuais);
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  const e = s.estado;
  clearInterval(s.relogio);
  s.relogio = setInterval(() => {
    if (!salas.has(s.id) || s.status !== 'jogando' || s.estado !== e) { clearInterval(s.relogio); return; }
    if (festa.passo(e, Date.now())) {
      if (e.fim) terminarFesta(s);
      else enviarSala(s);
    }
  }, 150);
  enviarSala(s);
  avisarLobby();
}

function terminarFesta(s) {
  clearInterval(s.relogio);
  const e = s.estado;
  const venceram = (e.vencedores || []).filter(k => k < s.jogadores.length);
  Object.assign(s, { status: 'fim', vencedor: venceram.length === 1 ? venceram[0] : null, empate: venceram.length !== 1, motivo: 'acabou', terminou: Date.now() });
  const ranking = festa.ranking(e);
  const humanos = s.jogadores.map((p, k) => k).filter(k => !s.jogadores[k].saiu);
  db.lote(humanos.map(k => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'festa', s.jogadores[k].id, s.jogadores[k].nome, ranking.find(r => r.k === k)?.pos || 4, e.j.length, e.j[k].douradas, venceram.includes(k) ? 1 : 0,
  ])).then(async () => {
    for (const k of humanos) {
      await progresso.registrar(s.jogadores[k].id, 'partida');
      if (venceram.includes(k)) await progresso.registrar(s.jogadores[k].id, 'vitoria');
      // As cenouras da festa viram cenouras do Club Coelho (um quinto delas, até 40).
      await clube.ganhar(s.jogadores[k].id, Math.min(40, Math.floor(e.j[k].cenouras / 5)));
    }
  }).catch(err => console.error('Erro ao guardar a festa:', err.message));
  enviarSala(s);
  avisarLobby();
}

/* ─── Lyendell Dorme: a vila dos coelhos ──────────── */

// Onde está cada coelho (por id de usuário), o visual de cada um e o que falta mandar.
function mundoDe(s) {
  s.mundo ??= { pos: new Map(), visuais: new Map(), ultimo: new Map(), emote: new Map(), teleporte: new Set(), sujo: true };
  return s.mundo;
}
const jogandoCidade = s => s.status === 'jogando' && !!s.estado;
function posicaoDe(s, i) {
  const p = s.jogadores[i];
  return mundoDe(s).pos.get(p.id) || { ...mundo.porta(i, s.jogadores.length), d: 1 };
}
// Todo mundo volta para a própria toca (ao anoitecer e ao amanhecer). O executado vai para o centro.
function mandarParaTocas(s) {
  const m = mundoDe(s);
  s.jogadores.forEach((p, i) => {
    m.pos.set(p.id, { ...mundo.porta(i, s.jogadores.length), d: 1 });
    m.teleporte.add(p.id);
  });
  m.sujo = true;
}
function mandarProCentro(s, i) {
  const m = mundoDe(s);
  const p = s.jogadores[i];
  if (!p) return;
  m.pos.set(p.id, { x: mundo.CENTRO.x, y: mundo.CENTRO.y + 92, d: 1 });
  m.teleporte.add(p.id);
  m.sujo = true;
}
// Manda para cada um só os coelhos que ele enxerga (umas 10 vezes por segundo, se alguém andou).
function enviarMundo(s) {
  const m = mundoDe(s);
  m.sujo = false;
  const e = s.estado;
  const jogando = jogandoCidade(s);
  const tp = [...m.teleporte];
  m.teleporte.clear();
  const quem = new Set([...s.jogadores.map(p => p.id), ...s.espectadores]);
  for (const uid of quem) {
    const eu = s.jogadores.findIndex(p => p.id === uid);
    const lista = [];
    s.jogadores.forEach((p, i) => {
      if (p.saiu || !mundo.enxerga(e, eu, i, jogando)) return;
      const q = posicaoDe(s, i);
      lista.push([p.id, q.x, q.y, q.d]);
    });
    paraUsuario(uid, 'cidade:pos', { id: s.id, p: lista, tp });
  }
}

/* ─── Lyendell Dorme ──────────────────────────────── */

// As regras ficam em src/cidade.js. Aqui: começar, o relógio das fases (noite, dia...), as jogadas,
// o chat de cada canal (praça, raposos, mortos) e o resultado no fim.

function comecarCidade(s) {
  const jogadores = ativos(s);
  if (jogadores.length < cidade.MIN) throw new ErroJogo(`Lyendell Dorme precisa de pelo menos ${cidade.MIN} pessoas (cabem até ${cidade.MAX}).`);
  s.jogadores = jogadores;
  s.estado = cidade.novo(jogadores, s.opcoes || cidade.validarOpcoes());
  Object.assign(s, { status: 'jogando', vencedor: null, empate: false, motivo: null });
  s.revanche.clear();
  mandarParaTocas(s);
  agendarCidade(s);
  enviarSala(s);
  avisarLobby();
}

// Marca a próxima virada de fase (encurtar: todo mundo já fez a sua parte, não precisa esperar o tempo todo).
function agendarCidade(s, encurtar = false) {
  const e = s.estado;
  if (encurtar) cidade.encurtar(e);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => passoCidade(s), Math.max(0, e.prazo - Date.now()));
}

function passoCidade(s) {
  if (!salas.has(s.id) || s.status !== 'jogando' || s.jogo !== 'cidade') return;
  const antes = s.estado.fase;
  cidade.avancar(s.estado);
  const fase = s.estado.fase;
  if (fase !== antes && (fase === 'noite' || fase === 'amanhecer')) mandarParaTocas(s);
  if (fase === 'execucao' && s.estado.executado != null) mandarProCentro(s, s.estado.executado);
  if (s.estado.fase === 'fim') { terminarCidade(s); return; }
  agendarCidade(s, cidade.todosProntos(s.estado)); // ex.: o Caçador que já saiu da sala não atira
  enviarSala(s);
}

function jogarCidade(s, i, jogada) {
  try {
    cidade.agir(s.estado, i, jogada);
  } catch (x) {
    throw x instanceof cidade.ErroCidade ? new ErroJogo(x.message) : x;
  }
  if (cidade.todosProntos(s.estado)) agendarCidade(s, true);
  enviarSala(s);
}

function terminarCidade(s) {
  clearTimeout(s.timer);
  const e = s.estado;
  const venceram = new Set(e.vencedores?.indices || []);
  Object.assign(s, { status: 'fim', vencedor: null, empate: !venceram.size, motivo: e.vencedores?.time || 'fim', terminou: Date.now() });
  const lista = e.j.map((p, i) => ({ ...p, i, venceu: venceram.has(i) }));
  db.lote(lista.map(p => [
    'INSERT INTO resultados (jogo, usuario_id, usuario_nome, posicao, jogadores, pontos, venceu) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'cidade', p.id, p.nome, p.venceu ? 1 : 2, lista.length, p.vivo ? 1 : 0, p.venceu ? 1 : 0,
  ])).then(async () => {
    for (const p of lista) {
      if (s.jogadores[p.i]?.saiu) continue;
      await progresso.registrar(p.id, 'partida');
      if (p.venceu) await progresso.registrar(p.id, 'vitoria');
    }
  }).catch(err => console.error('Erro ao guardar Lyendell Dorme:', err.message));
  enviarSala(s);
  avisarLobby();
}

/* ─── Jogos de uma pessoa só, transmitidos ao vivo ─── */

// Quem joga Pac-Coelho, Cobrinha ou Quebra-cabeça manda o estado do jogo algumas vezes por segundo,
// e o servidor repassa para quem está assistindo. Nada disso vai para o banco.
const SOLO = {
  pacman: 'Pac-Coelho', cobrinha: 'Cobrinha', quebra: 'Quebra-cabeça', memoria: 'Jogo da Memória', minado: 'Campo Minado', 2048: '2048',
  barris: 'Barris do Raposo', supercoelho: 'Super Coelho', travessia: 'Travessia', corrida: 'Corrida do Coelho',
};
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
    const completa = { ...msg, ...(await visualDe(u.id)) };
    for (const [id, lista] of conexoes) for (const w of lista) enviar(w, 'chat:msg', { msg: msgPara(id, completa) });
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
    let escolhidas = validarOpcoesDaSala(jogo, opcoes);
    if (jogo === 'quiz') {
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
    paraTodos('aviso', { texto: `${u.nome} abriu ${JOGOS[jogo].grupo ? 'uma sala' : 'uma partida'} de ${nomeDaSala(s)}.`, sala: s.id, de: u.id });
  },

  'sala:entrar'(u, { id }) {
    const s = salas.get(id);
    if (!s) throw new ErroJogo('Essa partida não existe mais.');
    const i = indiceNa(s, u.id);
    if (i >= 0 && !s.jogadores[i].saiu) { enviarSala(s); return; }
    if (s.status !== 'esperando') throw new ErroJogo('Essa partida já começou. Você pode assistir.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida. Termine ou saia dela antes.');
    if (s.jogadores.length >= maxDa(s)) throw new ErroJogo('A sala está cheia.');
    s.jogadores.push(pessoaDe(u));
    s.espectadores.delete(u.id);
    if (!ehGrupo(s) && !ehRaposa(s)) {
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
    if (!s || (!ehGrupo(s) && !ehRaposa(s))) throw new ErroJogo('Essa sala não existe mais.');
    if (dono(s)?.id !== u.id) throw new ErroJogo('Só quem abriu a sala pode começar.');
    if (s.status !== 'esperando' || s.comecando) return;
    if (ehRaposa(s)) { comecarRaposa(s); return; }
    if (s.jogo === 'cobras') { comecarCobras(s); return; }
    if (s.jogo === 'cidade') { comecarCidade(s); return; }
    if (ehMesa(s)) { comecarMesa(s); return; }
    if (s.jogo === 'junto') { await comecarJunto(s); return; }
    if (s.jogo === 'festa') { await comecarFesta(s); return; }
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
    if (s.jogo === 'cidade') { jogarCidade(s, i, jogada || {}); return; }
    if (ehMesa(s)) { jogarMesa(s, i, jogada || {}); return; }
    if (s.jogo === 'junto' || s.jogo === 'festa') throw new ErroJogo('Jogue pela tela do jogo.');
    if (ehRaposa(s)) { jogarContraRaposa(s, u, jogada); return; }
    if (ehGrupo(s)) throw new ErroJogo('Use as setas para jogar.');
    const resultado = JOGOS[s.jogo].jogar(s.estado, i, jogada || {});
    if (resultado) finalizar(s, resultado, resultado.empate ? 'empate' : 'vitoria');
    enviarSala(s);
    if (resultado) avisarLobby();
  },

  // Lyendell Dorme: quem abriu a sala muda as opções (tempo do dia, classes) antes de começar.
  'cidade:opcoes'(u, dados) { return acoes['sala:opcoes'](u, dados); },

  // Quem abriu a sala muda as opções (modo, tempo, classes...) antes de começar.
  'sala:opcoes'(u, { id, opcoes }) {
    const s = salas.get(id);
    if (!s || s.status !== 'esperando') throw new ErroJogo('Essa sala não está esperando.');
    if (dono(s)?.id !== u.id) throw new ErroJogo('Só quem abriu a sala muda as opções.');
    s.opcoes = validarOpcoesDaSala(s.jogo, { ...(s.opcoes || {}), ...(opcoes || {}) });
    enviarSala(s);
    avisarLobby();
  },

  // Festa na Toca: jogar o dado, usar item, escolher o caminho, comprar, dizer que leu as regras.
  'festa:acao'(u, { id, acao }) {
    const s = salas.get(id);
    if (!s || s.jogo !== 'festa' || s.status !== 'jogando') return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu) throw new ErroJogo('Você não está nessa festa.');
    let mudou;
    try {
      mudou = festa.agir(s.estado, i, acao || {}, Date.now());
    } catch (x) {
      throw x instanceof festa.ErroFesta ? new ErroJogo(x.message) : x;
    }
    if (mudou) enviarSala(s);
  },

  // Jogos juntos: onde está o meu coelho (cada um manda o seu; o servidor só repassa para os outros).
  'junto:pos'(u, { id, d }) {
    const s = salas.get(id);
    if (!s || s.status !== 'jogando' || !(s.jogo === 'junto' ? !s.estado.sim : s.jogo === 'festa' && s.estado.fase === 'minijogo')) return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu || !d || typeof d !== 'object') return;
    s.ultimaPos ??= new Map();
    const agora = Date.now();
    if (agora - (s.ultimaPos.get(i) || 0) < 40) return;
    s.ultimaPos.set(i, agora);
    if (JSON.stringify(d).length > 600) return;
    for (const uid of quemVeJunto(s)) if (uid !== u.id) paraUsuario(uid, 'junto:pos', { id: s.id, i, d });
  },

  // Jogos juntos: pegou um item, morreu, chegou, ou algo do próprio jogo (ver junto.js).
  'junto:evento'(u, { id, ev }) {
    const s = salas.get(id);
    if (!s || (s.jogo !== 'junto' && s.jogo !== 'festa') || s.status !== 'jogando') return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu || !ev || typeof ev !== 'object') return;
    s.contaEventos ??= new Map();
    const agora = Date.now();
    const c = s.contaEventos.get(i) || { ini: agora, n: 0 };
    if (agora - c.ini > 1000) { c.ini = agora; c.n = 0; }
    if (++c.n > 40) return; // no máximo 40 por segundo
    s.contaEventos.set(i, c);
    let r;
    try {
      r = s.jogo === 'festa' ? festa.evento(s.estado, i, ev) : junto.evento(s.estado, i, ev, agora);
    } catch (x) {
      throw x instanceof junto.ErroJunto || x instanceof festa.ErroFesta ? new ErroJogo(x.message) : x;
    }
    if (!r) return;
    for (const x of r.todos || []) for (const uid of quemVeJunto(s)) paraUsuario(uid, 'junto:evento', { id: s.id, ev: x });
    if (r.outros) for (const uid of quemVeJunto(s)) if (uid !== u.id) paraUsuario(uid, 'junto:evento', { id: s.id, ev: r.outros });
    if (s.jogo === 'festa') { if (r.mudou) enviarSala(s); return; }
    if (r.quadro) enviarQuadroJunto(s);
    if (junto.verificar(s.estado, agora)) { terminarJunto(s); return; }
    if (r.mudou) enviarSala(s);
  },

  // Vila dos coelhos: o meu coelho andou (o servidor guarda e repassa para quem enxerga).
  'cidade:mover'(u, { id, x, y, d }) {
    const s = salas.get(id);
    if (!s || s.jogo !== 'cidade') return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu) return;
    const m = mundoDe(s);
    const agora = Date.now();
    if (agora - (m.ultimo.get(u.id) || 0) < 45) return; // no máximo uns 20 passos por segundo
    m.ultimo.set(u.id, agora);
    m.pos.set(u.id, mundo.posicaoValida({ x, y, d }));
    m.sujo = true;
  },

  // Um emote em cima do coelho (aceno, coração, risada...), para quem enxerga o coelho.
  'cidade:emote'(u, { id, e: emote }) {
    const s = salas.get(id);
    if (!s || s.jogo !== 'cidade' || !mundo.EMOTES.includes(emote)) return;
    const i = indiceNa(s, u.id);
    if (i < 0 || s.jogadores[i].saiu) return;
    const m = mundoDe(s);
    const agora = Date.now();
    if (agora - (m.emote.get(u.id) || 0) < 700) return;
    m.emote.set(u.id, agora);
    const jogando = jogandoCidade(s);
    for (const uid of new Set([...s.jogadores.map(p => p.id), ...s.espectadores])) {
      const eu = s.jogadores.findIndex(p => p.id === uid);
      if (mundo.enxerga(s.estado, eu, i, jogando)) paraUsuario(uid, 'cidade:emote', { id: s.id, de: u.id, e: emote });
    }
  },

  // A cor do pelo e o acessório do meu coelho.
  'cidade:visual'(u, { id, pelo, acessorio }) {
    const s = salas.get(id);
    if (!s || s.jogo !== 'cidade' || indiceNa(s, u.id) < 0) return;
    mundoDe(s).visuais.set(u.id, mundo.validarVisual({ pelo, acessorio }));
    enviarSala(s);
  },

  // Chat do jogo: cada mensagem vai só para quem pode ler aquele canal.
  'cidade:falar'(u, { id, canal, texto }) {
    const s = salas.get(id);
    const i = s ? indiceNa(s, u.id) : -1;
    if (!s || s.jogo !== 'cidade' || !s.estado || i < 0) throw new ErroJogo('Você não está nessa partida.');
    const t = limparTexto(texto, 300).replace(/\s+/g, ' ');
    if (!t) return;
    s.falas ??= new Map();
    const agora = Date.now();
    if (agora - (s.falas.get(u.id) || 0) < 700) throw new ErroJogo('Calma: uma mensagem de cada vez.');
    s.falas.set(u.id, agora);
    let msg;
    try {
      msg = cidade.falar(s.estado, i, canal, t);
    } catch (x) {
      throw x instanceof cidade.ErroCidade ? new ErroJogo(x.message) : x;
    }
    for (const k of cidade.leitores(s.estado, canal)) {
      for (const quem of k >= 0 ? [s.jogadores[k].id] : s.espectadores) paraUsuario(quem, 'cidade:msg', { id: s.id, msg: msgPara(quem, msg) });
    }
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
    if (ehRaposa(s)) {
      // Contra a Raposa: qualquer um da dupla começa outra (e quem começou da última vez, agora não começa).
      if (s.jogadores[i].saiu) throw new ErroJogo('Você já saiu desta partida.');
      s.inicia = 1 - s.inicia;
      comecarRaposa(s);
      return;
    }
    if (ehGrupo(s)) {
      // Quiz e cobrinha: a sala volta a esperar gente, com quem ficou até o fim.
      clearTimeout(s.timer);
      clearInterval(s.relogio);
      if (dono(s)?.id !== u.id) throw new ErroJogo('Só quem abriu a sala pode começar outra rodada.');
      s.jogadores = ativos(s);
      Object.assign(s, { status: 'esperando', estado: null, vencedor: null, empate: false, motivo: null, criada: Date.now() });
      if (s.jogo === 'cidade') mandarParaTocas(s);
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

/* ─── Bobo da Corte ───────────────────────────────── */

// Quem é Bobo (o chat mostra o chapéu de guizos) e quem está de nariz de palhaço. Vão para todos no "ola".
let bobosDoChat = new Set();
let narizesAgora = {};
async function atualizarBobo(avisar = true) {
  try {
    const antes = JSON.stringify([[...bobosDoChat], narizesAgora]);
    [bobosDoChat, narizesAgora] = [new Set(await bobo.bobos()), await bobo.narizes()];
    if (avisar && JSON.stringify([[...bobosDoChat], narizesAgora]) !== antes) paraTodos('bobo', { bobos: [...bobosDoChat], narizes: narizesAgora });
  } catch (e) {
    console.error('Erro ao ler o Bobo da Corte:', e.message);
  }
}

// Mensagem especial no chat da cidade (a piada do Bobo): grava e manda para todo mundo.
async function publicarNoChat(u, texto, tipo = '') {
  const { id } = await db.run('INSERT INTO chat_mensagens (usuario_id, usuario_nome, texto, tipo) VALUES (?, ?, ?, ?)', u.id, u.nome, texto, tipo);
  const msg = { ...(await db.get('SELECT * FROM chat_mensagens WHERE id = ?', id)), ...(await visualDe(u.id)) };
  for (const [quem, lista] of conexoes) for (const w of lista) enviar(w, 'chat:msg', { msg: msgPara(quem, msg) });
  return msg;
}

// Pegadinha: chega na hora para quem está online (o confete, para todos). Quem está fora recebe ao entrar.
function entregarPegadinha(p) {
  const pacote = bobo.pacote(p);
  if (p.tipo === 'confete') { paraTodos('pegadinha', { p: pacote }); return true; }
  if (p.tipo === 'nariz') atualizarBobo();
  if (!conexoes.has(p.alvo_id)) return false;
  paraUsuario(p.alvo_id, 'pegadinha', { p: pacote });
  return true;
}
async function entregarPendentes(id) {
  for (const p of await bobo.pendentes(id)) {
    paraUsuario(id, 'pegadinha', { p: bobo.pacote(p) });
    await bobo.marcarEntregue(p.id);
  }
}
const estaOnline = id => conexoes.has(id);

/* ─── Conexões ────────────────────────────────────── */

function conectar(ws, usuario, token) {
  const id = usuario.id;
  ws.usuario = usuario;
  ws.token = token;
  ws.vivo = true;
  pessoas.set(id, { id, nome: usuario.nome, foto: usuario.foto || null, crianca: !!usuario.crianca });
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
      const conhecido = e instanceof ErroJogo || e instanceof quiz.ErroQuiz || e instanceof clube.ErroClube;
      if (!conhecido) console.error('Erro na recreação:', e);
      enviar(ws, 'erro', { mensagem: conhecido ? e.message : 'Algo deu errado. Tente de novo.' });
    }
  });

  Promise.all([
    db.all(`SELECT * FROM (
      SELECT c.*, u.foto, u.cor, u.moldura FROM chat_mensagens c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT ?
    ) ORDER BY id`, HISTORICO),
    // Um Bobo chegando (talvez com o cargo novo): a lista de quem é Bobo é lida de novo.
    usuario.permissoes.has('bobo.pegadinhas') && !bobosDoChat.has(id) ? atualizarBobo() : null,
  ])
    .then(([historico]) => {
      const minha = salaAtivaDe(id);
      enviar(ws, 'ola', {
        eu: { id, nome: usuario.nome, moderar: usuario.permissoes.has('recreacao.moderar'), silenciadoAte: antispam.silenciadoAte(id) },
        online: online(), historico: usuario.crianca ? historico.map(limparMsg) : historico, salas: resumoSalas(), minhaSala: minha ? minha.id : null, transmissoes: resumoTransmissoes(),
        bobos: [...bobosDoChat], narizes: narizesAgora,
      });
      if (minha) enviarSala(minha); // voltou a tempo: a partida continua
      // Pegadinha que chegou enquanto a pessoa estava fora (espera um pouco a tela abrir).
      setTimeout(() => entregarPendentes(id).catch(e => console.error('Erro ao entregar pegadinhas:', e.message)), 2500);
    })
    .catch(e => console.error('Erro ao abrir a recreação:', e.message));

  if (chegou) paraTodos('online', { online: online() });
}

function desconectar(ws) {
  const id = ws.usuario.id;
  const lista = conexoes.get(id);
  if (!lista) return;
  lista.delete(ws);
  clube.fechou(id, ws); // a aba que estava no Club Coelho fechou
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
  // O Club Coelho usa a mesma conexão (as ações 'clube:*' ficam em src/clube.js).
  clube.iniciar({ paraUsuario, ehCrianca, limpar: paraCriancas });
  Object.assign(acoes, clube.acoes);
  // Os coelhos de cada vila do Lyendell Dorme: 10 vezes por segundo, só quando alguém andou.
  setInterval(() => {
    for (const s of salas.values()) if (s.jogo === 'cidade' && s.mundo?.sujo) enviarMundo(s);
  }, 100).unref();
  atualizarBobo(false);
  // O nariz de palhaço some sozinho depois de 30 minutos; os cargos podem mudar (quem é Bobo).
  setInterval(() => atualizarBobo(), 60_000).unref();

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

module.exports = { iniciarRecreacao, entregarPegadinha, publicarNoChat, estaOnline, paraUsuario, atualizarBobo, paraTodos };
