// Menu de administrador nos jogos (permissão jogos.admin, que nenhum cargo recebe sozinho: o administrador
// tem e pode liberar em Cargos). Pelo menu dá para pregar peças nos jogadores, mexer na partida, ajudar
// alguém e dar ou tirar cenouras. Partida em que o menu foi usado NÃO vale para o ranking nem recordes.
//
// Aqui ficam:
//  - os efeitos que atrapalham um jogador por alguns segundos (controles invertidos, congelado, lento),
//    que os jogos rodados no servidor consultam com direcao() e velocidade(), e que os jogos rodados no
//    navegador recebem pela mensagem 'adm:efeito';
//  - a marca de "partida com o menu" (estado.adm), que tira a partida do ranking;
//  - o registro dos jogos: cada grupo de jogos tem um arquivo em src/adm/ que diz quais ações existem
//    (acoes) e o que cada uma faz (executar).

const fs = require('fs');
const path = require('path');

const PERMISSAO = 'jogos.admin';

// Efeitos de pegadinha. "atrapalhar": mexem no controle (o servidor também guarda); "visual": só na tela.
const EFEITOS = {
  inverter: { nome: 'Controles invertidos', tipo: 'atrapalhar', padrao: 15 },
  congelar: { nome: 'Congelar', tipo: 'atrapalhar', padrao: 5 },
  lento: { nome: 'Deixar lento', tipo: 'atrapalhar', padrao: 15 },
  confete: { nome: 'Chuva de confete', tipo: 'visual', padrao: 6 },
  ponta: { nome: 'Tela de ponta-cabeça', tipo: 'visual', padrao: 10 },
  espelho: { nome: 'Tela espelhada', tipo: 'visual', padrao: 15 },
  tremor: { nome: 'Terremoto na tela', tipo: 'visual', padrao: 6 },
  arcoiris: { nome: 'Cores malucas', tipo: 'visual', padrao: 15 },
  escuro: { nome: 'Apagar as luzes', tipo: 'visual', padrao: 8 },
  gigante: { nome: 'Zoom gigante', tipo: 'visual', padrao: 10 },
  minusculo: { nome: 'Tela minúscula', tipo: 'visual', padrao: 10 },
  torta: { nome: 'Torta na cara', tipo: 'visual', padrao: 0 },
  pum: { nome: 'Almofada de pum', tipo: 'visual', padrao: 0 },
  coelhos: { nome: 'Manada de coelhos', tipo: 'visual', padrao: 0 },
};
const MAX_SEGUNDOS = 120;

// usuário -> { efeito: até quando (ms) }
const ativos = new Map();

function aplicar(uid, efeito, segundos) {
  const def = EFEITOS[efeito];
  if (!def) return 0;
  const s = Math.max(1, Math.min(MAX_SEGUNDOS, Number(segundos) || def.padrao || 5));
  const ate = Date.now() + s * 1000;
  if (def.tipo === 'atrapalhar') {
    const m = ativos.get(uid) || {};
    m[efeito] = ate;
    ativos.set(uid, m);
  }
  return ate;
}
function ativo(uid, efeito, agora = Date.now()) {
  const m = ativos.get(uid);
  if (!m || !m[efeito]) return false;
  if (m[efeito] > agora) return true;
  delete m[efeito];
  if (!Object.keys(m).length) ativos.delete(uid);
  return false;
}
function limpar(uid) { ativos.delete(uid); }

// Para os jogos rodados no servidor: a direção que vale para esse jogador agora.
// Congelado: null (a jogada é ignorada). Invertido: a direção contrária. Aceita os nomes usados nos jogos
// ('cima'/'baixo'/'esquerda'/'direita', 'up'/'down'/'left'/'right', 'c'/'b'/'e'/'d', 'N'/'S'/'L'/'O'),
// números 0..3 (cima, direita, baixo, esquerda) e vetores { x, y } ou [x, y].
const OPOSTO = {
  cima: 'baixo', baixo: 'cima', esquerda: 'direita', direita: 'esquerda',
  up: 'down', down: 'up', left: 'right', right: 'left',
  c: 'b', b: 'c', e: 'd', d: 'e', N: 'S', S: 'N', L: 'O', O: 'L',
};
function direcao(uid, dir) {
  if (uid == null) return dir;
  if (ativo(uid, 'congelar')) return null;
  if (!ativo(uid, 'inverter')) return dir;
  if (typeof dir === 'string') return OPOSTO[dir] ?? dir;
  if (typeof dir === 'number' && Number.isInteger(dir) && dir >= 0 && dir < 4) return (dir + 2) % 4;
  if (Array.isArray(dir)) return dir.map(v => (typeof v === 'number' ? -v : v));
  if (dir && typeof dir === 'object') {
    const r = { ...dir };
    for (const k of ['x', 'y', 'dx', 'dy']) if (typeof r[k] === 'number') r[k] = -r[k];
    return r;
  }
  return dir;
}
// Congelado não age (atira, joga carta, pula...).
const podeAgir = uid => uid == null || !ativo(uid, 'congelar');
// Lento: metade da velocidade.
const velocidade = uid => (uid != null && ativo(uid, 'lento') ? 0.5 : 1);

/* ─── Ranking ─────────────────────────────────────── */

// O estado de cada partida (s.estado) ganha a marca quando o menu é usado nela. Uma partida nova (revanche,
// outra rodada) começa com um estado novo, então volta a valer.
const marcar = estado => { if (estado && typeof estado === 'object') estado.adm = true; };
const valeRanking = s => !s?.estado?.adm;

/* ─── Os jogos ────────────────────────────────────── */

// Cada arquivo em src/adm/ exporta { jogos: ['velha', ...], acoes(s) -> [acao], executar(s, acao, dados, ctx) }.
// acao: { id, nome, grupo: 'Mexer na partida' | 'Ajudar' | 'Atrapalhar' | ..., alvo: 'jogador' | null,
//         campos: [{ id, nome, tipo: 'numero' | 'escolha' | 'texto', min, max, padrao, opcoes: [[valor, nome]] }],
//         perigo: true (pede confirmação) }
// executar devolve uma frase curta do que aconteceu (aparece para o administrador), ou lança ErroAdm.
class ErroAdm extends Error {}
const GRUPOS = [];
function registrar(modulo) { GRUPOS.push(modulo); }
// Lê os arquivos de src/adm/ (um por grupo de jogos).
function carregar() {
  const dir = path.join(__dirname, 'adm');
  if (!fs.existsSync(dir)) return;
  for (const arq of fs.readdirSync(dir).filter(x => x.endsWith('.js')).sort()) registrar(require(path.join(dir, arq)));
}
const grupoDa = s => GRUPOS.find(g => g.jogos.includes(chaveDaSala(s)));
// A chave do jogo de uma sala: o jogo, ou "junto:<jogo>" nos jogos juntos (travessia, pac-coelho, arena...).
const chaveDaSala = s => (s.jogo === 'junto' ? `junto:${s.estado?.jogo || s.opcoes?.jogo}` : s.jogo);

function acoesDaSala(s) {
  const g = grupoDa(s);
  if (!g || !s.estado || s.status !== 'jogando') return [];
  try { return g.acoes(s) || []; } catch (e) { console.error('Menu de administrador (ações):', e); return []; }
}

module.exports = {
  PERMISSAO, EFEITOS, MAX_SEGUNDOS, ErroAdm,
  aplicar, ativo, limpar, direcao, podeAgir, velocidade, marcar, valeRanking,
  registrar, carregar, grupoDa, chaveDaSala, acoesDaSala,
};
