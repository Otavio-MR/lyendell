// Recreação ao vivo: quem está online, chat e partidas (jogo da velha, pedra papel e tesoura).
// Tudo passa por uma conexão WebSocket em /ws, aberta com a mesma sessão (cookie) do site.
// As partidas ficam na memória do servidor; o chat e os resultados vão para o banco.

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { db } = require('./db');
const { usuarioDaRequisicao, sessaoAindaValida } = require('./auth');
const { texto: limparTexto } = require('./util');

const ESPERA_MS = Number(process.env.RECREACAO_ESPERA_MS) || 30_000;       // tempo para voltar depois de cair
const REVALIDAR_MS = Number(process.env.RECREACAO_REVALIDAR_MS) || 120_000; // confere se a sessão ainda vale
const HISTORICO = 80;

class ErroJogo extends Error {}

const conexoes = new Map(); // id do usuário -> Set de conexões (a pessoa pode estar em várias abas)
const pessoas = new Map();  // id do usuário -> { id, nome, foto }
const salas = new Map();
const quedas = new Map();   // id do usuário -> timer de "voltar a tempo"
const envios = new Map();   // id do usuário -> horários das últimas mensagens (anti-flood)

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

/* ─── Jogos ───────────────────────────────────────── */

const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const MAOS = ['pedra', 'papel', 'tesoura'];
const VENCE = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

// Cada jogo: novo(quem começa), jogar(estado, índice do jogador, jogada) e visao(estado, índice de quem vê).
// jogar devolve null (continua), { vencedor: 0|1 } ou { empate: true }.
const JOGOS = {
  velha: {
    nome: 'Jogo da Velha',
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
};

/* ─── Salas ───────────────────────────────────────── */

const indiceNa = (s, id) => s.jogadores.findIndex(p => p.id === id);
const salaAtivaDe = id => [...salas.values()].find(s => s.status !== 'fim' && s.jogadores.some(p => p.id === id && !p.saiu));

function visaoSala(s, id) {
  const eu = indiceNa(s, id);
  return {
    id: s.id,
    jogo: s.jogo,
    nomeJogo: JOGOS[s.jogo].nome,
    status: s.status,
    eu,
    jogadores: s.jogadores.map(p => ({ id: p.id, nome: p.nome, foto: p.foto, conectado: conexoes.has(p.id), saiu: !!p.saiu })),
    estado: s.estado ? JOGOS[s.jogo].visao(s.estado, eu) : null,
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
  .map(s => ({ id: s.id, jogo: s.jogo, nomeJogo: JOGOS[s.jogo].nome, status: s.status, jogadores: s.jogadores.map(p => p.nome), espectadores: s.espectadores.size }));

const avisarLobby = () => paraTodos('salas', { salas: resumoSalas() });

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
    .catch(e => console.error('Erro ao guardar partida:', e.message));
}

// Sair de uma sala: quem assistia só para de assistir; quem jogava perde a partida em andamento.
function sairDaSala(id, s, motivo = 'abandono') {
  if (s.espectadores.delete(id)) { enviarSala(s); return; }
  const i = indiceNa(s, id);
  if (i < 0) return;
  if (s.status === 'esperando') {
    salas.delete(s.id);
    paraUsuario(id, 'sala:fechada', { id: s.id });
    avisarLobby();
    return;
  }
  if (s.status === 'jogando') finalizar(s, { vencedor: 1 - i }, motivo);
  s.jogadores[i].saiu = true;
  s.revanche.clear();
  enviarSala(s);
  paraUsuario(id, 'sala:fechada', { id: s.id });
  if (s.jogadores.every(p => p.saiu)) salas.delete(s.id);
  avisarLobby();
}

function pessoaDe(u) {
  return pessoas.get(u.id) || { id: u.id, nome: u.nome, foto: u.foto || null };
}

/* ─── O que cada mensagem do navegador faz ────────── */

const acoes = {
  async 'chat:enviar'(u, { texto }) {
    const t = limparTexto(texto, 500);
    if (!t) return;
    const agora = Date.now();
    const recentes = (envios.get(u.id) || []).filter(x => agora - x < 10_000);
    if (recentes.length >= 8) throw new ErroJogo('Calma! Muitas mensagens seguidas. Espere alguns segundos.');
    recentes.push(agora);
    envios.set(u.id, recentes);
    const { id } = await db.run('INSERT INTO chat_mensagens (usuario_id, usuario_nome, texto) VALUES (?, ?, ?)', u.id, u.nome, t);
    const msg = await db.get('SELECT * FROM chat_mensagens WHERE id = ?', id);
    paraTodos('chat:msg', { msg: { ...msg, foto: pessoaDe(u).foto } });
  },

  async 'chat:apagar'(u, { id }) {
    const msg = await db.get('SELECT * FROM chat_mensagens WHERE id = ?', Number(id) || 0);
    if (!msg) return;
    if (msg.usuario_id !== u.id && !u.permissoes.has('recreacao.moderar')) throw new ErroJogo('Você só pode apagar as suas mensagens.');
    await db.run('DELETE FROM chat_mensagens WHERE id = ?', msg.id);
    paraTodos('chat:apagada', { id: msg.id });
  },

  'sala:criar'(u, { jogo }) {
    if (!JOGOS[jogo]) throw new ErroJogo('Jogo desconhecido.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida. Termine ou saia dela antes de abrir outra.');
    const s = {
      id: crypto.randomBytes(4).toString('hex'), jogo, jogadores: [pessoaDe(u)], status: 'esperando', estado: null,
      inicia: 0, vencedor: null, empate: false, motivo: null, revanche: new Set(), espectadores: new Set(), criada: Date.now(),
    };
    salas.set(s.id, s);
    enviarSala(s);
    avisarLobby();
    paraTodos('aviso', { texto: `${u.nome} abriu uma partida de ${JOGOS[jogo].nome}.`, sala: s.id, de: u.id });
  },

  'sala:entrar'(u, { id }) {
    const s = salas.get(id);
    if (!s) throw new ErroJogo('Essa partida não existe mais.');
    if (s.jogadores.some(p => p.id === u.id)) { enviarSala(s); return; }
    if (s.status !== 'esperando') throw new ErroJogo('Essa partida já começou. Você pode assistir.');
    if (salaAtivaDe(u.id)) throw new ErroJogo('Você já está numa partida. Termine ou saia dela antes.');
    s.jogadores.push(pessoaDe(u));
    s.espectadores.delete(u.id);
    s.status = 'jogando';
    s.estado = JOGOS[s.jogo].novo(s.inicia);
    enviarSala(s);
    avisarLobby();
  },

  'sala:assistir'(u, { id }) {
    const s = salas.get(id);
    if (!s) throw new ErroJogo('Essa partida não existe mais.');
    if (indiceNa(s, u.id) < 0) s.espectadores.add(u.id);
    enviarSala(s);
  },

  'sala:jogar'(u, { id, jogada }) {
    const s = salas.get(id);
    const i = s ? indiceNa(s, u.id) : -1;
    if (!s || i < 0) throw new ErroJogo('Você não está nessa partida.');
    if (s.status !== 'jogando') throw new ErroJogo('A partida não está em andamento.');
    const resultado = JOGOS[s.jogo].jogar(s.estado, i, jogada || {});
    if (resultado) finalizar(s, resultado, resultado.empate ? 'empate' : 'vitoria');
    enviarSala(s);
    if (resultado) avisarLobby();
  },

  'sala:revanche'(u, { id }) {
    const s = salas.get(id);
    const i = s ? indiceNa(s, u.id) : -1;
    if (!s || i < 0 || s.status !== 'fim') throw new ErroJogo('Não dá para pedir revanche agora.');
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
      if (!(e instanceof ErroJogo)) console.error('Erro na recreação:', e);
      enviar(ws, 'erro', { mensagem: e instanceof ErroJogo ? e.message : 'Algo deu errado. Tente de novo.' });
    }
  });

  db.all(`SELECT * FROM (
      SELECT c.*, u.foto FROM chat_mensagens c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT ?
    ) ORDER BY id`, HISTORICO)
    .then(historico => {
      const minha = salaAtivaDe(id);
      enviar(ws, 'ola', {
        eu: { id, nome: usuario.nome, moderar: usuario.permissoes.has('recreacao.moderar') },
        online: online(), historico, salas: resumoSalas(), minhaSala: minha ? minha.id : null,
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
  const s = salaAtivaDe(id);
  if (!s) return;
  enviarSala(s); // mostra para o outro que a pessoa caiu
  // Se não voltar a tempo, perde a partida (ou a sala de espera fecha).
  quedas.set(id, setTimeout(() => {
    quedas.delete(id);
    if (!conexoes.has(id) && salas.has(s.id)) sairDaSala(id, s, 'caiu');
  }, ESPERA_MS));
}

function iniciarRecreacao(servidor) {
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
        salas.delete(s.id);
      }
    }
    avisarLobby();
  }, 60_000).unref();
}

module.exports = { iniciarRecreacao };
