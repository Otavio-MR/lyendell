// O mundo do Lyendell Dorme: a vila dos coelhos. Cada jogador tem um coelho que anda pelo mapa e uma toca.
// Aqui ficam o desenho da vila (onde fica cada toca), o visual de cada coelho e quem enxerga quem:
//  - na sala de espera e no fim, todo mundo vê todo mundo;
//  - de noite, cada um só vê a si mesmo (os Raposos se veem: de noite eles viram raposas);
//  - quem morreu vira fantasma: vê todo mundo, mas só os outros mortos o veem.
// public/js/telas/cidade-mundo.js usa as mesmas medidas.

const { ASSASSINOS } = require('./cidade');

const W = 1600;
const H = 1000;
const CENTRO = { x: 800, y: 520 };
const PELOS = ['#e9dcc3', '#c99a6b', '#8a6a4f', '#f7f3ea', '#5b4a3f', '#d9b48a', '#9aa3ad', '#e2b3a3'];
const ACESSORIOS = ['nenhum', 'laco', 'chapeu', 'flores', 'cachecol', 'oculos', 'coroa'];
const EMOTES = ['oi', 'coracao', 'risada', 'susto', 'pergunta', 'zzz'];

// As tocas ficam numa roda em volta da praça (a primeira em cima, seguindo no sentido do relógio).
function toca(i, n) {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
  return { x: Math.round(CENTRO.x + Math.cos(a) * 620), y: Math.round(CENTRO.y + Math.sin(a) * 360) };
}
// Onde o coelho aparece: na porta da toca (um pouco para dentro da vila).
function porta(i, n) {
  const t = toca(i, n);
  return { x: Math.round(t.x + (CENTRO.x - t.x) * 0.1), y: Math.round(t.y + 40 + (CENTRO.y - t.y) * 0.06) };
}

function validarVisual(v = {}) {
  return {
    pelo: PELOS.includes(v.pelo) ? v.pelo : PELOS[0],
    acessorio: ACESSORIOS.includes(v.acessorio) ? v.acessorio : 'nenhum',
  };
}

const limitar = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const posicaoValida = ({ x, y, d } = {}) => ({ x: limitar(x, 24, W - 24), y: limitar(y, 40, H - 16), d: d < 0 ? -1 : 1 });

// Quem a vila inteira vê mesmo morto: o executado (na pedra da praça) e o Caçador escolhendo em quem atirar.
const emDestaque = (e, k) => (e.fase === 'execucao' && e.executado === k) || (e.fase === 'cacador' && e.cacadores?.[0] === k);

// O jogador de índice "eu" (-1 = quem assiste) enxerga o de índice "alvo"?
function enxerga(e, eu, alvo, jogando) {
  if (eu === alvo) return true;
  if (!e || !jogando) return true; // sala de espera e fim
  const outro = e.j[alvo];
  const meu = eu >= 0 ? e.j[eu] : null;
  if (!outro) return false;
  if (meu && !meu.vivo) return true; // fantasma vê tudo
  if (!outro.vivo) return emDestaque(e, alvo); // fantasmas só aparecem para os mortos
  if (e.fase === 'papeis' || e.fase === 'noite') return !!meu && ASSASSINOS.has(meu.papel) && ASSASSINOS.has(outro.papel);
  return true;
}

module.exports = { W, H, CENTRO, PELOS, ACESSORIOS, EMOTES, toca, porta, validarVisual, posicaoValida, enxerga };
