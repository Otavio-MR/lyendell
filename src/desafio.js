// Desafio: os jogos de uma pessoa só (Pac-Coelho, Cobrinha, 2048, Campo Minado e Quebra-cabeça) jogados
// ao mesmo tempo por várias pessoas, cada uma no seu navegador, com a MESMA semente (mesmo campo, mesmas
// cenouras, mesmo embaralhado). O servidor só marca o tempo, guarda os pontos que cada um manda e decide quem venceu.
//  - Versus (corrida): Pac-Coelho, Cobrinha e 2048, quem fizer mais pontos; Campo Minado e Quebra-cabeça, quem terminar primeiro.
//  - Co-op (meta da equipe): Pac-Coelho, Cobrinha e 2048. A soma dos pontos de todos precisa chegar na meta antes do tempo.
// (O co-op do Campo Minado e do Quebra-cabeça é a mesa compartilhada, em mesa.js.)

class ErroDesafio extends Error {}

const ESCALA = Number(process.env.DESAFIO_ESCALA) || 1; // os testes encurtam o tempo
const LARGADA_MS = Number(process.env.DESAFIO_LARGADA_MS) || 3500;

const JOGOS = {
  pacman: { nome: 'Pac-Coelho', tipo: 'pontos', minutos: 3, metaPorPessoa: 3000, coop: true },
  cobrinha: { nome: 'Cobrinha', tipo: 'pontos', minutos: 3, metaPorPessoa: 15, coop: true },
  2048: { nome: '2048', tipo: 'pontos', minutos: 3, metaPorPessoa: 2500, coop: true },
  minado: { nome: 'Campo Minado', tipo: 'corrida', minutos: 6, coop: false },
  quebra: { nome: 'Quebra-cabeça', tipo: 'corrida', minutos: 5, coop: false },
};
const DIFICULDADES = ['facil', 'medio', 'dificil'];
const TAMANHOS_QUEBRA = [3, 4, 5];
const fotoValida = src => typeof src === 'string' && (/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(src) || src === '/img/brasao.png');

function opcoes(o = {}) {
  const jogo = JOGOS[o.jogo] ? String(o.jogo) : 'cobrinha';
  const def = JOGOS[jogo];
  const r = { jogo, modo: o.modo === 'coop' && def.coop ? 'coop' : 'versus' };
  if (jogo === 'minado') r.dificuldade = DIFICULDADES.includes(o.dificuldade) ? o.dificuldade : 'facil';
  if (jogo === 'quebra') {
    r.n = TAMANHOS_QUEBRA.includes(Number(o.n)) ? Number(o.n) : 3;
    r.src = fotoValida(o.src) ? o.src : '/img/brasao.png';
    r.titulo = String(o.titulo || '').slice(0, 80);
  }
  return r;
}

const minimo = o => (o.modo === 'versus' ? 2 : 1);
const nomeDo = o => `${JOGOS[o.jogo].nome} (${o.modo === 'coop' ? 'co-op' : 'versus'})`;

function novo(o, n, agora = Date.now()) {
  const def = JOGOS[o.jogo];
  const inicio = agora + LARGADA_MS;
  return {
    jogo: o.jogo, modo: o.modo, tipo: def.tipo,
    semente: Math.floor(Math.random() * 2 ** 31),
    inicio, limite: inicio + Math.round(def.minutos * 60_000 * ESCALA),
    meta: o.modo === 'coop' ? def.metaPorPessoa * n : null,
    prog: Array.from({ length: n }, () => ({ pontos: 0, fim: false, completo: false, seg: null })),
    fim: null, terminou: null, vencedores: null,
  };
}

// No co-op, o que cada um fez conta para a equipe mesmo se a pessoa saiu depois.
const total = e => e.prog.reduce((s, p) => s + p.pontos, 0);

// jogada = { tipo: 'progresso' | 'fim', pontos, completo }. Devolve true se o desafio acabou.
function agir(e, i, { tipo, pontos, completo } = {}, ativos = [], agora = Date.now()) {
  if (e.fim) throw new ErroDesafio('O desafio já acabou.');
  if (agora < e.inicio - 300) throw new ErroDesafio('Espere a largada.');
  const p = e.prog[i];
  if (p.fim) return false;
  const n = Math.max(0, Math.min(10_000_000, Math.floor(Number(pontos) || 0)));
  // Nos jogos de pontos, os pontos só sobem; na corrida (peças no lugar, casas abertas), vale o último.
  p.pontos = e.tipo === 'pontos' ? Math.max(p.pontos, n) : n;
  if (tipo === 'fim') {
    p.fim = true;
    p.completo = e.tipo === 'corrida' && !!completo;
    p.seg = Math.max(0, Math.round((agora - e.inicio) / 100) / 10);
  }
  return acabou(e, ativos, agora);
}

// O desafio acaba quando: alguém completou a corrida; a equipe bateu a meta; todos terminaram; ou o tempo acabou.
function acabou(e, ativos, agora = Date.now()) {
  if (e.fim) return true;
  let motivo = null;
  if (e.tipo === 'corrida' && ativos.some(k => e.prog[k].completo)) motivo = 'completou';
  else if (e.modo === 'coop' && total(e) >= e.meta) motivo = 'meta';
  else if (ativos.every(k => e.prog[k].fim)) motivo = 'todos';
  else if (agora >= e.limite) motivo = 'tempo';
  if (!motivo) return false;
  e.fim = motivo;
  e.terminou = agora;
  e.vencedores = vencedores(e, ativos);
  return true;
}

function vencedores(e, ativos) {
  if (e.modo === 'coop') return total(e) >= e.meta ? [...ativos] : [];
  if (e.tipo === 'corrida') {
    const completos = ativos.filter(k => e.prog[k].completo).sort((a, b) => e.prog[a].seg - e.prog[b].seg);
    if (completos.length) return [completos[0]];
  }
  if (!ativos.length) return [];
  const max = Math.max(...ativos.map(k => e.prog[k].pontos));
  const melhores = ativos.filter(k => e.prog[k].pontos === max);
  return melhores.length === 1 && max > 0 ? melhores : [];
}

// Os tempos vão como "daqui a quantos ms" (o relógio de cada navegador pode estar adiantado ou atrasado).
function visao(e, ativos, agora = Date.now()) {
  return {
    jogo: e.jogo, modo: e.modo, tipo: e.tipo, semente: e.semente,
    largadaEm: e.inicio - agora, acabaEm: e.limite - agora, duracao: e.limite - e.inicio,
    meta: e.meta, total: total(e), prog: e.prog, fim: e.fim, vencedores: e.vencedores,
  };
}

module.exports = { JOGOS, ErroDesafio, opcoes, minimo, nomeDo, novo, agir, acabou, visao, LARGADA_MS };
