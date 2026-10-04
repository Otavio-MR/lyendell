// Barris do Raposo: lá do alto das vigas o Raposo joga barris; o coelho sobe as escadas, pula os barris
// e resgata a Princesa Cenoura. Inspirado na primeira fase do Donkey Kong (25m), com a cara da Casa Luckham.
// Aqui ficam só as regras e o desenho; a moldura (teclado, toque, som, pausa, ranking) é o ../arcade.js.

import { desenharCoelho, desenharRaposa, elipse, sombrear, sorte as semente, PELOS } from '../desenho-coelho.js';

const W = 448;
const H = 512;
const FONTE = '"Cinzel", Georgia, serif';
const OURO = '#e8c24a';
const OURO_ESCURO = '#d8b13a';
const PERGAMINHO = '#ece0bf';
const PELO = '#e9dcc3';
const PELO_ESCURO = sombrear(PELO, -0.18);

/* O cenário */

// Vigas de baixo (0) para cima (5); a 6 é o patamar da princesa. yE e yD: altura do topo da viga
// nas bordas esquerda e direita da tela (as vigas são inclinadas). xa..xb: onde a viga existe.
const VIGAS = [
  { xa: 0, xb: 448, yE: 496, yD: 484 },
  { xa: 0, xb: 412, yE: 418, yD: 430 },
  { xa: 36, xb: 448, yE: 362, yD: 350 },
  { xa: 0, xb: 412, yE: 284, yD: 296 },
  { xa: 36, xb: 448, yE: 228, yD: 216 },
  { xa: 0, xb: 412, yE: 150, yD: 162 },
  { xa: 168, xb: 280, yE: 96, yD: 96 },
];
const ESPESSURA = 12;
// Escadas: [x, viga de baixo, viga de cima]
const ESCADAS = [
  [152, 0, 1], [372, 0, 1],
  [88, 1, 2], [248, 1, 2],
  [184, 2, 3], [392, 2, 3],
  [64, 3, 4], [236, 3, 4],
  [176, 4, 5], [320, 4, 5],
  [264, 5, 6],
];
const MARRETAS = [[36, 1], [110, 4]];
const ITENS = [[424, 2, 'chapeu'], [310, 3, 'cesta'], [380, 5, 'guardachuva']];

const R = 9; // raio do barril
const ESCALA_COELHO = 0.62;
const VEL_ANDAR = 88;
const VEL_SUBIR = 52;
const PULO_V0 = 168; // pulo de arco fixo: ~26 px de altura, ~0,62 s no ar
const PULO_G = 541;
const GRAVIDADE = 620;
const VEL_BARRIL_ESCADA = 62;
const DURACAO_MARRETA = 8;
const TOLERANCIA_ESCADA = 7;
const MAX_BARRIS = 9;
const T_PRONTO = 1.2;
const T_MORTE = 2.6;
const T_VITORIA = 4.6;
const PONTOS_MARRETA = [300, 500, 800];
const FASES = ['pronto', 'jogo', 'morte', 'vitoria', 'fim'];
const ESTADOS = ['chao', 'escada', 'pulo', 'morte'];

const alturaViga = (v, x) => v.yE + (v.yD - v.yE) * x / W;
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

// Monta o cenário (normal ou espelhado: nos níveis 3, 5, 7... o Raposo fica à direita).
function cenario(espelho) {
  const mx = x => (espelho ? W - x : x);
  const vigas = VIGAS.map(v => {
    const yE = espelho ? v.yD : v.yE;
    const yD = espelho ? v.yE : v.yD;
    // desce: para que lado o barril rola (o lado mais baixo da viga)
    return { xa: espelho ? W - v.xb : v.xa, xb: espelho ? W - v.xa : v.xb, yE, yD, desce: Math.sign(yD - yE) };
  });
  const escadas = ESCADAS.map(([x, de, para]) => {
    const ex = mx(x);
    return { x: ex, de, para, yBaixo: alturaViga(vigas[de], ex), yTopo: alturaViga(vigas[para], ex) };
  });
  return {
    espelho, lado: espelho ? -1 : 1, vigas, escadas,
    raposoX: mx(86), pilhaX: mx(20), tonelX: mx(28), inicioX: mx(84), saidaX: mx(145),
    princesaX: mx(200), luaX: mx(404), quedaX: mx(40), escadasRaposo: [mx(134), mx(156)],
    marretas: MARRETAS.map(([x, gi]) => ({ x: mx(x), gi })),
    itens: ITENS.map(([x, gi, tipo]) => ({ x: mx(x), gi, tipo })),
  };
}
const CENARIOS = [cenario(false), cenario(true)];

// Até onde dá para andar numa viga (o tonel embaixo e o Raposo lá em cima ocupam uma ponta).
function limiteEsq(L, gi) {
  let a = L.vigas[gi].xa + 7;
  if (L.lado === 1 && gi === 0) a = Math.max(a, L.tonelX + 28);
  if (L.lado === 1 && gi === 5) a = Math.max(a, L.raposoX + 52);
  return Math.max(8, a);
}
function limiteDir(L, gi) {
  let b = L.vigas[gi].xb - 7;
  if (L.lado === -1 && gi === 0) b = Math.min(b, L.tonelX - 28);
  if (L.lado === -1 && gi === 5) b = Math.min(b, L.raposoX - 52);
  return Math.min(W - 8, b);
}

function dificuldade(n) {
  const k = n - 1;
  return {
    vel: Math.min(150, 96 + k * 11), // barris, px/s
    intervalo: Math.max(1.2, 2.5 - k * 0.22), // segundos entre arremessos
    desce: Math.min(0.5, 0.2 + k * 0.06), // chance de o barril descer uma escada
    fogo: Math.min(0.6, 0.25 + k * 0.1), // chance de o tonel soltar uma fagulha
    maxFagulhas: n === 1 ? 2 : 3,
    louco: n === 1 ? 0 : Math.min(0.22, 0.06 * k), // barril que despenca direto
    velFagulha: Math.min(62, 40 + k * 4),
    bonus: 5000 + 1000 * Math.min(3, k),
    item: n === 1 ? 300 : n === 2 ? 500 : 800,
  };
}

// No jogo junto fica mais difícil com mais gente (dif: 1 com uma pessoa, +0,15 por pessoa a mais).
function dificuldadeJunto(n, dif) {
  const d = dificuldade(n);
  const k = Math.max(1, Number(dif) || 1);
  d.vel = Math.min(165, Math.round(d.vel * (1 + (k - 1) * 0.7)));
  d.intervalo = Math.max(0.9, d.intervalo / k);
  d.maxFagulhas = Math.max(d.maxFagulhas, Math.round(d.maxFagulhas * k));
  d.maxBarris = Math.round(MAX_BARRIS * k);
  d.velFagulha = Math.min(72, Math.round(d.velFagulha * (1 + (k - 1) * 0.5)));
  d.periodoFagulha = (n === 1 ? 9 : 7) / k; // segundos entre uma fagulha e outra
  return d;
}

// Mistura a semente da partida com a fase e o número de cada coisa (cada barril tem a sua sorte).
function semear(...partes) {
  let h = 2166136261;
  for (const p of partes) { h = Math.imul(h ^ (p >>> 0), 16777619); h ^= h >>> 15; }
  return h >>> 0;
}
const PASSO = 1 / 60;
const PERIODO_MARRETA = 30; // segundos: a marreta que alguém levou volta depois disso
const POSES = ['pronto', 'jogo', 'morte', 'espera', 'chegou', 'fora'];
const curto = (nome, n) => (nome.length > n ? `${nome.slice(0, n - 1)}.` : nome);

// Encosta um círculo num retângulo?
function toca(cx, cy, r, x1, y1, x2, y2) {
  const px = cx < x1 ? x1 : cx > x2 ? x2 : cx;
  const py = cy < y1 ? y1 : cy > y2 ? y2 : cy;
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

const marretaEmCima = c => Math.floor(c.marretaT * 5) % 2 === 1;
// Onde a marreta acerta agora (na frente quando desce, por cima quando sobe).
const ZONA = { x1: 0, y1: 0, x2: 0, y2: 0 };
function zonaMarreta(c) {
  let a; let b;
  if (marretaEmCima(c)) { a = c.x - c.dir * 6; b = c.x + c.dir * 22; ZONA.y1 = c.y - 46; ZONA.y2 = c.y - 12; }
  else { a = c.x; b = c.x + c.dir * 32; ZONA.y1 = c.y - 24; ZONA.y2 = c.y + 2; }
  ZONA.x1 = Math.min(a, b); ZONA.x2 = Math.max(a, b);
  return ZONA;
}

/* Desenhos pequenos */

function caixa(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

function texto(g, txt, x, y, tam, cor, alinhar = 'center') {
  g.font = `bold ${tam}px ${FONTE}`; g.textAlign = alinhar; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2.5, tam / 4.5); g.strokeStyle = 'rgba(8,6,3,0.9)'; g.strokeText(txt, x, y);
  g.fillStyle = cor; g.fillText(txt, x, y);
}

function estrela(g, x, y, r, cor) {
  g.fillStyle = cor; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

function coracao(g, x, y, s, cor) {
  g.fillStyle = cor; g.beginPath(); g.moveTo(x, y + s * 0.4);
  g.bezierCurveTo(x + s, y - s * 0.3, x + s * 0.5, y - s, x, y - s * 0.4);
  g.bezierCurveTo(x - s * 0.5, y - s, x - s, y - s * 0.3, x, y + s * 0.4); g.fill();
}

function coroinha(g, x, y, s) {
  g.fillStyle = OURO; g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x - 5.5 * s, y - 5 * s);
  g.lineTo(x - 2.5 * s, y - 2.5 * s); g.lineTo(x, y - 6 * s); g.lineTo(x + 2.5 * s, y - 2.5 * s);
  g.lineTo(x + 5.5 * s, y - 5 * s); g.lineTo(x + 5 * s, y); g.closePath(); g.fill();
  elipse(g, x, y - 1.8 * s, s, s, '#d8674a');
}

function balao(g, x, y, txt) {
  g.font = `bold 9px ${FONTE}`;
  const w = g.measureText(txt).width + 12;
  g.fillStyle = PERGAMINHO;
  caixa(g, x, y - 15, w, 16, 5);
  g.fill();
  g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x - 3, y + 7); g.lineTo(x + 11, y); g.closePath(); g.fill();
  g.strokeStyle = '#8c6d15'; g.lineWidth = 1;
  caixa(g, x, y - 15, w, 16, 5);
  g.stroke();
  g.fillStyle = '#4a1e10'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(txt, x + 6, y - 4);
}

// Barril visto de frente, rolando (aro, ripas girando e a tampinha).
function barrilRolando(g, x, y, ang) {
  elipse(g, x, y + R - 0.5, R * 0.85, 2, 'rgba(0,0,0,0.25)'); elipse(g, x, y, R, R, '#5e3518');
  elipse(g, x, y, R - 1.8, R - 1.8, '#b9773a');
  g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = '#7d4a22'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-3.3, -6.3);
  g.lineTo(-3.3, 6.3); g.moveTo(0, -7.1); g.lineTo(0, 7.1); g.moveTo(3.3, -6.3); g.lineTo(3.3, 6.3); g.stroke();
  g.fillStyle = '#3a2210'; g.fillRect(-1.6, -5.6, 3.2, 2.4); g.restore();
  g.strokeStyle = '#43434e'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, R - 0.9, 0, Math.PI * 2); g.stroke();
  elipse(g, x - 3, y - 3.6, 2.6, 1.3, 'rgba(255,232,190,0.35)', -0.6);
}

// Barril deitado visto de lado (descendo escada ou nas mãos do Raposo).
function barrilDeLado(g, x, y, fase) {
  g.fillStyle = '#b9773a'; g.beginPath(); g.moveTo(x - 11, y - 6.5); g.quadraticCurveTo(x, y - 11, x + 11, y - 6.5);
  g.lineTo(x + 11, y + 6.5); g.quadraticCurveTo(x, y + 11, x - 11, y + 6.5); g.closePath(); g.fill();
  g.strokeStyle = '#7a4520'; g.lineWidth = 1; g.beginPath();
  for (let k = 0; k < 3; k++) {
    const yy = y - 7 + ((((fase * 8 + k * 5) % 15) + 15) % 15);
    g.moveTo(x - 10, yy); g.lineTo(x + 10, yy);
  }
  g.stroke();
  g.fillStyle = '#3d3d47'; g.fillRect(x - 7.5, y - 9, 2.4, 18); g.fillRect(x + 5.1, y - 9, 2.4, 18);
  elipse(g, x - 11, y, 1.8, 6.5, '#8a5428'); elipse(g, x + 11, y, 1.8, 6.5, '#8a5428');
  elipse(g, x - 2, y - 5.5, 6, 1.4, 'rgba(255,232,190,0.3)');
}

function barrilEmPe(g, x, y) {
  g.fillStyle = '#a8692f'; g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 10.5, y - 10, x - 7, y - 20);
  g.lineTo(x + 7, y - 20); g.quadraticCurveTo(x + 10.5, y - 10, x + 7, y); g.closePath(); g.fill();
  g.strokeStyle = '#76451f'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 3, y - 19); g.lineTo(x - 3.6, y - 1);
  g.moveTo(x + 3, y - 19); g.lineTo(x + 3.6, y - 1); g.stroke();
  g.fillStyle = '#3d3d47'; g.fillRect(x - 9, y - 16.5, 18, 2); g.fillRect(x - 9, y - 5.5, 18, 2);
  elipse(g, x, y - 20, 7, 2, '#c58a4a');
}

function martelo(g, x, y, ang, piscar) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#7a4d24'; g.fillRect(0, -1.3, 17, 2.6);
  g.fillStyle = piscar ? '#fff2c0' : '#b8783a'; g.fillRect(14, -6.5, 10, 13);
  g.fillStyle = piscar ? '#ffffff' : OURO; g.fillRect(15.2, -6.5, 1.8, 13); g.fillRect(21, -6.5, 1.8, 13); g.restore();
}

function desenharFagulha(g, x, y, t, k) {
  const f = Math.sin(t * 13 + k * 2.1);
  elipse(g, x, y - 8, 12, 11, 'rgba(255,140,40,0.16)');
  g.fillStyle = '#ff7a1f'; g.beginPath(); g.moveTo(x - 7, y - 5); g.quadraticCurveTo(x - 8, y - 13, x + f * 2.5, y - 21 - f);
  g.quadraticCurveTo(x + 8, y - 13, x + 7, y - 5); g.quadraticCurveTo(x, y + 1, x - 7, y - 5); g.fill();
  g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(x - 4, y - 5); g.quadraticCurveTo(x - 4.5, y - 10, x + f * 1.5, y - 15);
  g.quadraticCurveTo(x + 4.5, y - 10, x + 4, y - 5); g.quadraticCurveTo(x, y - 1, x - 4, y - 5); g.fill();
  elipse(g, x - 2.4, y - 8, 1.3, 1.9, '#2a0d00'); elipse(g, x + 2.4, y - 8, 1.3, 1.9, '#2a0d00');
}

const CENOURINHAS = [-4.5, 0, 4.5];
const VARETAS = [-11, -4, 4, 11];
function desenharItem(g, tipo, x, y, t) {
  elipse(g, x, y, 13, 13, `rgba(232,194,74,${0.1 + 0.06 * Math.sin(t * 4)})`);
  if (tipo === 'cesta') {
    for (const k of CENOURINHAS) {
      elipse(g, x + k, y - 9, 1.6, 4, '#4caf50', k * 0.08); elipse(g, x + k, y - 3.5, 2.6, 3, '#f08a2c');
    }
    g.fillStyle = '#a8742f'; g.beginPath(); g.moveTo(x - 9, y - 2); g.lineTo(x + 9, y - 2); g.lineTo(x + 7, y + 7);
    g.lineTo(x - 7, y + 7); g.closePath(); g.fill();
    g.strokeStyle = '#7a5020'; g.lineWidth = 0.9; g.beginPath();
    for (let k = -6; k <= 6; k += 3) { g.moveTo(x + k, y - 2); g.lineTo(x + k * 0.8, y + 7); }
    g.moveTo(x - 8.4, y + 2.5); g.lineTo(x + 8.4, y + 2.5); g.stroke();
    elipse(g, x, y - 2, 9.5, 2, '#c99247');
    g.strokeStyle = '#8a5a26'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y - 2, 8.5, Math.PI, 0); g.stroke();
  } else if (tipo === 'chapeu') {
    elipse(g, x, y + 4, 12.5, 3.4, '#8e5bb5');
    g.fillStyle = '#a76fd0'; g.beginPath(); g.ellipse(x, y + 3.5, 7, 8.5, 0, Math.PI, 0); g.fill();
    g.fillStyle = OURO; g.fillRect(x - 7, y + 0.5, 14, 2.4);
    elipse(g, x + 5, y + 0.5, 2.6, 2.6, '#f6b3cd'); elipse(g, x + 5, y + 0.5, 1, 1, '#fff6');
  } else {
    g.fillStyle = '#e45f93'; g.beginPath(); g.arc(x, y + 1, 11, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = '#b23a6c'; g.lineWidth = 1; g.beginPath();
    for (const k of VARETAS) { g.moveTo(x, y - 10); g.lineTo(x + k, y + 1); }
    g.stroke();
    g.strokeStyle = '#6b3f1d'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x, y + 10);
    g.arc(x - 2.5, y + 10, 2.5, 0, Math.PI); g.stroke();
    elipse(g, x, y - 11, 1.2, 1.6, OURO);
  }
}

// A Princesa Cenoura: uma cenoura de vestido rosa, folhinhas no cabelo e coroa.
function desenharPrincesa(g, x, y, t, susto) {
  g.save(); g.translate(x, y); g.scale(0.8, 0.8); elipse(g, 0, 1, 11, 3, 'rgba(0,0,0,0.3)');
  elipse(g, -4, -1.5, 3.2, 2, '#7a3b12'); elipse(g, 4, -1.5, 3.2, 2, '#7a3b12');
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 4.5;
    elipse(g, ox, -45, 2.8, 7.5, '#3f9a45', (i - 1) * 0.5); elipse(g, ox, -45, 1, 5.5, '#62c068', (i - 1) * 0.5);
  }
  g.fillStyle = '#ef8a2e'; g.beginPath(); g.moveTo(-11, -36); g.quadraticCurveTo(0, -42, 11, -36);
  g.quadraticCurveTo(9, -14, 0, -4); g.quadraticCurveTo(-9, -14, -11, -36); g.fill();
  g.strokeStyle = '#c96a1c'; g.lineWidth = 1; g.beginPath(); g.moveTo(-9, -24); g.lineTo(-5.5, -23.5); g.moveTo(5.5, -25.5);
  g.lineTo(9, -26); g.stroke();
  // Vestido em sino com babado
  g.fillStyle = '#e45f93'; g.beginPath(); g.moveTo(-6.5, -20); g.quadraticCurveTo(-8, -10, -13, -3);
  g.quadraticCurveTo(0, 0, 13, -3); g.quadraticCurveTo(8, -10, 6.5, -20); g.closePath(); g.fill();
  elipse(g, 0, -3.5, 13, 2.4, '#f6b3cd');
  g.fillStyle = OURO; g.fillRect(-7, -21.5, 14, 2.4);
  // Braços: um acenando
  g.strokeStyle = '#ef8a2e'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8.5, -24); g.lineTo(-12.5, -16);
  g.stroke();
  g.save(); g.translate(8.5, -25); g.rotate(-2.1 + (susto ? Math.sin(t * 18) * 0.5 : Math.sin(t * 7) * 0.45)); g.beginPath();
  g.moveTo(0, 0); g.lineTo(-8, 0); g.stroke();
  elipse(g, -8.5, 0, 2.1, 2.1, '#ef8a2e'); g.restore();
  // Rosto
  elipse(g, -3.5, -31, 1.5, 1.9, '#2a1406'); elipse(g, 3.5, -31, 1.5, 1.9, '#2a1406'); elipse(g, -3.1, -31.7, 0.5, 0.5, '#fff');
  elipse(g, 3.9, -31.7, 0.5, 0.5, '#fff'); elipse(g, -6.5, -28, 2, 1.2, 'rgba(230,90,110,0.5)');
  elipse(g, 6.5, -28, 2, 1.2, 'rgba(230,90,110,0.5)');
  if (susto) elipse(g, 0, -26.5, 1.5, 1.9, '#5a1a10');
  else {
    g.strokeStyle = '#5a1a10'; g.lineWidth = 1; g.beginPath(); g.arc(0, -28, 2.4, 0.3, Math.PI - 0.3); g.stroke();
  }
  coroinha(g, 0, -38.5, 1.1);
  g.restore();
}

// O coelho de costas, subindo a escada.
function desenharCoelhoCostas(g, x, y, passo, coroa, pelo = PELO, escuro = PELO_ESCURO) {
  const bal = Math.sin(passo * 10) * 3;
  g.save(); g.translate(x, y); g.scale(ESCALA_COELHO, ESCALA_COELHO); elipse(g, -6, -3 + bal * 0.5, 4.5, 3.4, escuro);
  elipse(g, 6, -3 - bal * 0.5, 4.5, 3.4, escuro); elipse(g, 0, -15, 11, 12.5, pelo);
  elipse(g, 0, -10, 4.6, 4.6, '#fbf8f1'); elipse(g, -11.5, -25 - bal, 3.4, 5.2, escuro);
  elipse(g, 11.5, -25 + bal, 3.4, 5.2, escuro); elipse(g, 0, -31, 9.5, 9, pelo);
  elipse(g, -4.5, -46, 3.6, 10.5, pelo, -0.18); elipse(g, 4.5, -46, 3.6, 10.5, pelo, 0.18);
  if (coroa) coroinha(g, 0, -38, 1.3);
  g.restore();
}

/* O fundo (céu, cidade, vigas e escadas): desenhado uma vez numa tela escondida, quando dá */

function desenharCidade(g, rnd, cor, base, variacao, janelas) {
  let x = -10;
  while (x < W + 10) {
    const larg = 18 + rnd() * 28;
    const alt = 24 + rnd() * variacao;
    const topo = base - alt;
    g.fillStyle = cor; g.fillRect(x, topo, larg, H - topo);
    const tipo = rnd();
    g.beginPath();
    if (tipo < 0.45) {
      g.moveTo(x - 2, topo); g.lineTo(x + larg / 2, topo - 10 - rnd() * 14); g.lineTo(x + larg + 2, topo);
    } else if (tipo < 0.7) {
      const tx = x + larg * 0.5;
      g.rect(tx - 5, topo - 22, 10, 22); g.moveTo(tx - 7, topo - 22); g.lineTo(tx, topo - 44 - rnd() * 12);
      g.lineTo(tx + 7, topo - 22);
    } else {
      for (let k = 0; k < larg - 4; k += 7) g.rect(x + k, topo - 5, 4, 5);
    }
    g.fill();
    if (janelas) {
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.5) {
          g.fillStyle = `rgba(232,194,74,${(0.3 + rnd() * 0.5).toFixed(2)})`;
          g.fillRect(x + 4 + rnd() * (larg - 10), topo + 8 + rnd() * Math.max(4, alt - 16), 2.5, 3.5);
        }
      }
    }
    x += larg + rnd() * 4;
  }
}

function desenharCastelo(g, x, base, cor) {
  g.fillStyle = cor; g.fillRect(x - 40, base - 70, 80, H);
  for (let k = -40; k < 40; k += 8) g.fillRect(x + k, base - 76, 5, 6);
  for (const [ox, alt] of [[-46, 112], [46, 112], [0, 152]]) {
    g.fillRect(x + ox - 9, base - alt, 18, alt);
    g.beginPath(); g.moveTo(x + ox - 12, base - alt); g.lineTo(x + ox, base - alt - 26); g.lineTo(x + ox + 12, base - alt);
    g.fill();
  }
  // A bandeira da Casa Luckham no torreão
  g.fillStyle = '#5a4a1a'; g.fillRect(x - 0.6, base - 196, 1.2, 20);
  g.fillStyle = 'rgba(216,177,58,0.55)'; g.beginPath(); g.moveTo(x + 0.6, base - 196); g.lineTo(x + 13, base - 192);
  g.lineTo(x + 0.6, base - 188); g.fill();
  g.fillStyle = 'rgba(232,194,74,0.5)';
  for (const [ox, oy] of [[-46, 90], [46, 84], [0, 128], [-14, 52], [14, 52]]) g.fillRect(x + ox - 1.5, base - oy, 3, 5);
}

function desenharEscada(g, x, y1, y2, trilho, degrau) {
  g.fillStyle = trilho; g.fillRect(x - 8, y1, 2.6, y2 - y1); g.fillRect(x + 5.4, y1, 2.6, y2 - y1);
  g.fillStyle = degrau;
  for (let y = y2 - 5; y > y1 + 1; y -= 8) g.fillRect(x - 5.4, y, 10.8, 2.2);
}

function desenharViga(g, v) {
  const y1 = alturaViga(v, v.xa);
  const y2 = alturaViga(v, v.xb);
  g.fillStyle = '#2b110b'; g.beginPath(); g.moveTo(v.xa, y1); g.lineTo(v.xb, y2); g.lineTo(v.xb, y2 + ESPESSURA);
  g.lineTo(v.xa, y1 + ESPESSURA); g.closePath(); g.fill();
  // Treliça em zigue-zague
  const n = Math.max(2, Math.round((v.xb - v.xa) / 10));
  g.strokeStyle = '#9a3a25'; g.lineWidth = 1.6; g.beginPath();
  for (let i = 0; i < n; i++) {
    const xa = v.xa + (v.xb - v.xa) * i / n;
    const xb = v.xa + (v.xb - v.xa) * (i + 1) / n;
    const ya = alturaViga(v, xa);
    const yb = alturaViga(v, xb);
    if (i % 2) { g.moveTo(xa, ya + ESPESSURA - 3); g.lineTo(xb, yb + 3); } else { g.moveTo(xa, ya + 3); g.lineTo(xb, yb + ESPESSURA - 3); }
  }
  g.stroke();
  g.strokeStyle = '#cf5f3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(v.xa, y1 + 1.5); g.lineTo(v.xb, y2 + 1.5);
  g.moveTo(v.xa, y1 + ESPESSURA - 1.5); g.lineTo(v.xb, y2 + ESPESSURA - 1.5); g.stroke();
  g.strokeStyle = 'rgba(255,196,150,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(v.xa, y1 + 0.5); g.lineTo(v.xb, y2 + 0.5);
  g.stroke();
  for (let x = v.xa + 6; x < v.xb; x += 24) elipse(g, x, alturaViga(v, x) + 1.6, 1, 1, '#f3c590');
  g.fillStyle = '#7d2c1b'; g.fillRect(v.xa, y1, 2, ESPESSURA); g.fillRect(v.xb - 2, y2, 2, ESPESSURA);
}

function desenharTonel(g, x, y) {
  g.fillStyle = '#1c2533'; g.fillRect(x - 15, y - 34, 30, 34);
  g.fillStyle = '#2a3648'; g.fillRect(x - 11, y - 34, 6, 34);
  g.fillStyle = '#4b5a73'; g.fillRect(x - 16, y - 31, 32, 3); g.fillRect(x - 16, y - 6, 32, 3);
  elipse(g, x, y - 34, 15, 3.5, '#0a0d13'); elipse(g, x, y - 34, 12, 2.4, '#26140a');
}

function desenharFundo(g, L) {
  const ceu = g.createLinearGradient(0, 0, 0, H);
  ceu.addColorStop(0, '#04080b');
  ceu.addColorStop(0.5, '#0a1915');
  ceu.addColorStop(1, '#13291c');
  g.fillStyle = ceu; g.fillRect(0, 0, W, H);
  const rnd = semente(41);
  for (let i = 0; i < 80; i++) {
    const x = rnd() * W;
    const y = rnd() * 330;
    const r = 0.4 + rnd() * 1.1;
    g.globalAlpha = 0.2 + rnd() * 0.6; elipse(g, x, y, r, r, i % 7 ? '#e8eef5' : '#f4dd80');
  }
  g.globalAlpha = 1;
  // Lua
  const lx = L.luaX;
  const ly = 100;
  const brilho = g.createRadialGradient(lx, ly, 8, lx, ly, 64);
  brilho.addColorStop(0, 'rgba(243,230,176,0.25)');
  brilho.addColorStop(1, 'rgba(243,230,176,0)');
  g.fillStyle = brilho; g.fillRect(lx - 64, ly - 64, 128, 128);
  elipse(g, lx, ly, 17, 17, '#efe2b0'); elipse(g, lx - 5, ly - 4, 4, 3.5, 'rgba(170,150,95,0.35)');
  elipse(g, lx + 6, ly + 5, 3, 2.6, 'rgba(170,150,95,0.3)'); elipse(g, lx + 3, ly - 8, 2, 1.8, 'rgba(170,150,95,0.3)');
  // Cidade medieval ao longe
  desenharCidade(g, rnd, '#10241a', 400, 110, false);
  desenharCastelo(g, 300, 430, '#0f2219');
  desenharCidade(g, rnd, '#0a1610', 468, 70, true);
  const nevoa = g.createLinearGradient(0, 380, 0, H);
  nevoa.addColorStop(0, 'rgba(14,24,17,0)');
  nevoa.addColorStop(1, 'rgba(14,24,17,0.7)');
  g.fillStyle = nevoa; g.fillRect(0, 380, W, H - 380);
  // Escadas compridas por onde o Raposo foge
  const yR = alturaViga(L.vigas[5], L.saidaX);
  for (const x of L.escadasRaposo) desenharEscada(g, x, -4, yR, '#6d5524', '#56421b');
  for (const l of L.escadas) desenharEscada(g, l.x, l.yTopo, l.yBaixo, '#c09a42', '#97762c');
  for (const v of L.vigas) desenharViga(g, v);
  // Pilha de barris do Raposo
  const yP = alturaViga(L.vigas[5], L.pilhaX);
  barrilEmPe(g, L.pilhaX - 9, yP);
  barrilEmPe(g, L.pilhaX + 9, yP);
  barrilEmPe(g, L.pilhaX, yP - 20);
  desenharTonel(g, L.tonelX, alturaViga(L.vigas[0], L.tonelX));
}

const camadas = [null, null];
let semCanvas = false;
function fundoPronto(L) {
  const i = L.espelho ? 1 : 0;
  if (camadas[i] || semCanvas) return camadas[i];
  try {
    if (typeof document === 'undefined' || !document.createElement) { semCanvas = true; return null; }
    const c = document.createElement('canvas');
    c.width = W * 2; c.height = H * 2;
    const x = c.getContext('2d');
    if (!x) { semCanvas = true; return null; }
    x.scale(2, 2);
    desenharFundo(x, L);
    camadas[i] = c;
  } catch {
    semCanvas = true;
  }
  return camadas[i];
}

// Algumas estrelas piscam por cima do fundo pronto.
const PISCA = (() => {
  const r = semente(99);
  const l = [];
  for (let i = 0; i < 10; i++) l.push([r() * W, 50 + r() * 230, 0.8 + r() * 1.2, r() * 6]);
  return l;
})();
function estrelasPiscando(g, t) {
  g.fillStyle = '#fff6d8';
  for (let i = 0; i < PISCA.length; i++) {
    const s = PISCA[i];
    g.globalAlpha = 0.45 * (1 + Math.sin(t * 2.2 + s[3])); g.fillRect(s[0] - s[2] * 1.6, s[1] - 0.3, s[2] * 3.2, 0.6);
    g.fillRect(s[0] - 0.3, s[1] - s[2] * 1.6, 0.6, s[2] * 3.2);
  }
  g.globalAlpha = 1;
}

function desenharChamas(g, L, t, aceso, fogo) {
  const x = L.tonelX;
  const y = alturaViga(L.vigas[0], x) - 34;
  g.font = `bold 7px ${FONTE}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = OURO;
  g.fillText('PICHE', x, y + 20);
  if (!aceso) {
    elipse(g, x + Math.sin(t * 2) * 2, y - 6, 4, 3, 'rgba(160,160,150,0.18)');
    return;
  }
  const forca = 1 + fogo * 0.9;
  const brilho = g.createRadialGradient(x, y, 2, x, y, 40 + fogo * 26);
  brilho.addColorStop(0, fogo > 0.1 ? 'rgba(255,160,60,0.55)' : 'rgba(255,150,50,0.38)');
  brilho.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = brilho; g.fillRect(x - 70, y - 70, 140, 140);
  for (let i = 0; i < 4; i++) {
    const fx = x - 8 + i * 5.3;
    const h = (13 + 5 * Math.sin(t * 11 + i * 1.9) + 3 * Math.sin(t * 17.3 + i * 0.7)) * forca;
    const bal = Math.sin(t * 9 + i) * 2;
    g.fillStyle = '#ff7b22'; g.beginPath(); g.moveTo(fx - 4.5, y); g.quadraticCurveTo(fx - 4, y - h * 0.6, fx + bal, y - h);
    g.quadraticCurveTo(fx + 4, y - h * 0.6, fx + 4.5, y); g.closePath(); g.fill();
    g.fillStyle = '#ffd54d'; g.beginPath(); g.moveTo(fx - 2.3, y);
    g.quadraticCurveTo(fx - 2, y - h * 0.35, fx + bal * 0.6, y - h * 0.6);
    g.quadraticCurveTo(fx + 2, y - h * 0.35, fx + 2.3, y); g.closePath(); g.fill();
  }
}

/* O Raposo */

const P = { x: 0, y: 0, subindo: false };
function posRaposo(e) {
  const L = e.L;
  const y5 = alturaViga(L.vigas[5], L.raposoX);
  P.x = L.raposoX; P.y = y5; P.subindo = false;
  if (e.fase === 'vitoria' && e.faseT >= 1.8) {
    const yS = alturaViga(L.vigas[5], L.saidaX);
    if (e.faseT < 2.2) {
      const u = (e.faseT - 1.8) / 0.4;
      P.x = L.raposoX + (L.saidaX - L.raposoX) * u; P.y = y5 + (yS - y5) * u - Math.sin(u * Math.PI) * 18;
    } else {
      P.x = L.saidaX; P.y = yS - (e.faseT - 2.2) * 90; P.subindo = true;
    }
  }
  return P;
}

function desenharRaposo(g, e, t) {
  const L = e.L;
  const lado = L.lado;
  const p = posRaposo(e);
  if (p.subindo) {
    // Foge escada acima com a princesa
    g.save(); g.translate(p.x, p.y); g.rotate(-lado * Math.PI / 2); g.scale(1.6, 1.6);
    desenharRaposa(g, 0, 0, { dir: lado, passo: t, andando: true, t });
    g.restore();
    if (e.faseT >= 2.6) {
      desenharPrincesa(g, p.x + lado * 16, p.y - 8, t, true);
      balao(g, lado > 0 ? p.x + 24 : p.x - 84, p.y - 50, 'Socorro!');
    }
    return;
  }
  const a = e.raposo.arremesso;
  let dir = lado;
  let mao = 0; // 1: pegando na pilha, 2: barril acima da cabeça
  if (a >= 0) {
    if (a < 0.4) { dir = -lado; if (a > 0.22) mao = 1; }
    else if (a < 0.8) { dir = e.raposo.tipo === 'tonel' ? -lado : lado; mao = 2; }
  }
  const bravo = e.fase === 'pronto' || (e.fase === 'vitoria' && e.faseT < 1.8) || (a < 0 && t % 3.4 < 0.55);
  const pulinho = bravo ? Math.abs(Math.sin(t * 16)) * 3 : 0;
  g.save(); g.translate(p.x, p.y - pulinho); g.scale(1.6, 1.6);
  desenharRaposa(g, 0, 0, { dir, t });
  // Sobrancelha brava e um dentinho
  g.scale(dir, 1); g.translate(0, -Math.sin(t * 2) * 0.5); g.strokeStyle = '#2a160c'; g.lineWidth = 1.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(12.2, -29.4); g.lineTo(18.8, -26.6); g.stroke();
  g.fillStyle = '#fff8e8'; g.beginPath(); g.moveTo(20.6, -18.6); g.lineTo(22.4, -18.6); g.lineTo(21.5, -16.2); g.closePath();
  g.fill(); g.restore();
  if (mao === 1) barrilDeLado(g, p.x + dir * 40, p.y - 26, 0);
  else if (mao === 2) barrilDeLado(g, p.x + dir * 16, p.y - 78, 0);
  if (bravo) {
    g.strokeStyle = 'rgba(255,120,80,0.7)'; g.lineWidth = 1.5; g.beginPath();
    const hx = p.x + lado * 30;
    const hy = p.y - 70 - pulinho;
    g.moveTo(hx - 4, hy); g.lineTo(hx - 1, hy - 6); g.moveTo(hx + 3, hy + 1); g.lineTo(hx + 7, hy - 4); g.stroke();
  }
}

/* O coelho */

function desenharJogador(g, e, t) {
  const c = e.coelho;
  const s = ESCALA_COELHO;
  const acessorio = e.coroa ? 'coroa' : 'nenhum';
  if (e.fase === 'morte' || e.fase === 'fim') {
    // Gira, cai deitado e fica vendo estrelas
    const ft = e.fase === 'fim' ? 9 : e.faseT;
    const final = -c.dir * Math.PI / 2;
    const ang = ft < 0.5 ? 0 : ft < 1.6 ? final * 9 * (ft - 0.5) / 1.1 : final;
    g.save(); g.translate(c.x, c.y - 11); g.rotate(ang); g.scale(s, s);
    desenharCoelho(g, 0, 11 / s, { pelo: PELO, acessorio, dir: c.dir, t });
    g.restore();
    if (ft >= 1.6) {
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + k * 2.09;
        estrela(g, c.x + Math.cos(a) * 12, c.y - 26 + Math.sin(a) * 3.5, 3, OURO);
      }
    }
    return;
  }
  if (c.estado === 'escada') { desenharCoelhoCostas(g, c.x, c.y, c.passo, e.coroa); return; }
  const festa = e.fase === 'vitoria';
  g.save(); g.translate(c.x, c.y); g.scale(s, s);
  desenharCoelho(g, 0, 0, { pelo: PELO, acessorio, dir: c.dir, passo: festa ? t * 0.6 : c.passo, andando: festa || (c.andando && c.estado === 'chao'), t });
  g.restore();
  if (c.marreta > 0) {
    const cima = marretaEmCima(c);
    const piscar = c.marreta < 2 && Math.floor(t * 10) % 2 === 0;
    const ang = cima ? -Math.PI / 2 + c.dir * 0.25 : (c.dir > 0 ? 0.35 : Math.PI - 0.35);
    martelo(g, c.x + c.dir * 5, c.y - 13, ang, piscar);
    if (!cima) {
      g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1.5; g.beginPath();
      if (c.dir > 0) g.arc(c.x + 5, c.y - 13, 25, -1.2, 0.2); else g.arc(c.x - 5, c.y - 13, 25, Math.PI - 0.2, Math.PI + 1.2);
      g.stroke();
    }
  }
}

function cabecinha(g, x, y) {
  elipse(g, x - 2.5, y - 8, 1.8, 4.5, PELO, -0.2); elipse(g, x + 2.5, y - 8, 1.8, 4.5, PELO, 0.2);
  elipse(g, x, y - 2, 5, 4.5, PELO); elipse(g, x + 1.8, y - 2.6, 0.8, 0.9, '#1b1403');
}

function desenharHud(g, e, t) {
  texto(g, 'PONTOS', 12, 15, 9, OURO_ESCURO, 'left');
  texto(g, String(Math.floor(e.pontos)).padStart(6, '0'), 12, 34, 18, PERGAMINHO, 'left');
  for (let i = 0; i < Math.min(e.vidas, 6); i++) cabecinha(g, 18 + i * 15, 52);
  texto(g, `NÍVEL ${e.nivel}`, W / 2, 18, 11, OURO);
  const bx = 364;
  const by = 8;
  g.fillStyle = 'rgba(10,18,13,0.85)';
  caixa(g, bx, by, 74, 38, 6);
  g.fill();
  g.strokeStyle = OURO_ESCURO; g.lineWidth = 1.5;
  caixa(g, bx, by, 74, 38, 6);
  g.stroke();
  texto(g, 'BÔNUS', bx + 37, by + 13, 9, OURO_ESCURO);
  const alerta = e.bonus < 1000 && e.fase === 'jogo';
  texto(g, String(e.bonus), bx + 37, by + 32, 17, alerta ? (Math.floor(t * 4) % 2 ? '#ff6b5a' : '#ffd0c8') : PERGAMINHO);
}

// Uma etiqueta pequena (jogo junto: "Você está fora").
function etiqueta(g, txt, y) {
  g.font = `bold 11px ${FONTE}`;
  const w = g.measureText(txt).width + 22;
  g.fillStyle = 'rgba(6,12,9,0.82)';
  caixa(g, W / 2 - w / 2, y - 14, w, 20, 6);
  g.fill();
  g.strokeStyle = OURO_ESCURO; g.lineWidth = 1;
  caixa(g, W / 2 - w / 2, y - 14, w, 20, 6);
  g.stroke();
  texto(g, txt, W / 2, y + 1, 11, PERGAMINHO);
}

function faixa(g, y, pequeno, grande) {
  g.fillStyle = 'rgba(6,12,9,0.75)'; g.fillRect(0, y - 34, W, 50);
  g.fillStyle = OURO_ESCURO; g.fillRect(0, y - 34, W, 1.5); g.fillRect(0, y + 14.5, W, 1.5);
  if (pequeno) texto(g, pequeno, W / 2, y - 18, 11, OURO);
  texto(g, grande, W / 2, y + 8, pequeno ? 22 : 20, PERGAMINHO);
}

function desenharAvisos(g, e) {
  if (e.fase === 'pronto') faixa(g, 286, `Nível ${e.nivel}`, 'Pronto!');
  else if (e.fase === 'morte' && e.causa === 'tempo' && e.faseT < 2.2) faixa(g, 286, null, 'O tempo acabou!');
  else if (e.fase === 'vitoria') faixa(g, 286, null, e.faseT < 2.2 ? 'Resgatada!' : 'O Raposo fugiu com ela!');
}

// A cena inteira. e: o estado do jogo (ou o que veio da foto). fx: partículas e pontinhos (só quem joga).
function desenharCena(g, e, t, fx) {
  const L = e.L;
  g.fillStyle = '#05090b'; g.fillRect(0, 0, W, H);
  g.save();
  if (fx && fx.tremor > 0) {
    const a = Math.min(1, fx.tremor * 4) * 4;
    g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  }
  const fundo = fundoPronto(L);
  if (fundo) g.drawImage(fundo, 0, 0, W, H); else desenharFundo(g, L);
  estrelasPiscando(g, t);
  desenharChamas(g, L, t, e.aceso, e.fogo);
  for (let i = 0; i < L.marretas.length; i++) {
    if (e.marretasPegas[i]) continue;
    const m = L.marretas[i];
    const y = alturaViga(L.vigas[m.gi], m.x) - 24 + Math.sin(t * 3 + i) * 2;
    elipse(g, m.x, y, 13, 13, 'rgba(232,194,74,0.14)');
    martelo(g, m.x - 7, y + 7, -0.75, false);
  }
  for (let i = 0; i < L.itens.length; i++) {
    if (e.itensPegos[i]) continue;
    const it = L.itens[i];
    desenharItem(g, it.tipo, it.x, alturaViga(L.vigas[it.gi], it.x) - 14 + Math.sin(t * 2.5 + i) * 1.5, t);
  }
  // Princesa e o coração da vitória
  const xP = L.princesaX;
  const yP = L.vigas[6].yE;
  const levada = e.fase === 'vitoria' && e.faseT >= 2.6;
  if (!levada) {
    const susto = e.fase === 'vitoria' && e.faseT >= 1.8;
    desenharPrincesa(g, xP, yP, t, susto);
    if (e.fase !== 'vitoria' || susto) { if (susto || t % 5.5 < 1.7) balao(g, xP + 12, yP - 44, 'Socorro!'); }
  }
  if (e.fase === 'vitoria') {
    const mx = (xP + e.coelho.x) / 2;
    const pulsa = 1 + Math.sin(t * 8) * 0.08;
    if (e.faseT < 2.6) coracao(g, mx, yP - 38, 11 * pulsa, '#ff5f86');
    else {
      const sep = Math.min(8, (e.faseT - 2.6) * 10);
      g.save(); g.beginPath(); g.rect(mx - 20, yP - 60, 20, 40); g.clip(); coracao(g, mx - sep, yP - 38 + sep * 0.5, 11, '#c9476a'); g.restore();
      g.save(); g.beginPath(); g.rect(mx, yP - 60, 20, 40); g.clip(); coracao(g, mx + sep, yP - 38 + sep * 0.5, 11, '#c9476a'); g.restore();
    }
  }
  desenharRaposo(g, e, t);
  for (let i = 0; i < e.barris.length; i++) {
    const b = e.barris[i];
    if (b.modo === 'escada') barrilDeLado(g, b.x, b.y, b.ang); else barrilRolando(g, b.x, b.y, b.ang);
  }
  for (let i = 0; i < e.fagulhas.length; i++) desenharFagulha(g, e.fagulhas[i].x, e.fagulhas[i].y, t, i);
  desenharJogador(g, e, t);
  if (fx) desenharEfeitos(g, fx);
  g.restore();
  desenharHud(g, e, t);
  desenharAvisos(g, e);
}

function desenharEfeitos(g, fx) {
  for (let i = 0; i < fx.part.length; i++) {
    const p = fx.part[i];
    if (!p.vivo) continue;
    const k = p.vida / p.max;
    g.globalAlpha = Math.min(1, k * 1.6);
    if (p.tipo === 0) elipse(g, p.x, p.y, p.tam * (1.8 - k), p.tam * (1.8 - k) * 0.75, p.cor);
    else if (p.tipo === 1) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.cor; g.fillRect(-p.tam, -1.1, p.tam * 2, 2.2);
      g.restore();
    } else if (p.tipo === 2) coracao(g, p.x, p.y, p.tam, p.cor);
    else if (p.tipo === 3) estrela(g, p.x, p.y, p.tam, p.cor);
    else elipse(g, p.x, p.y, p.tam, p.tam, p.cor);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < fx.pops.length; i++) {
    const p = fx.pops[i];
    if (!p.vivo) continue;
    g.globalAlpha = Math.min(1, p.vida * 2.2);
    texto(g, p.txt, p.x, p.y, p.grande ? 15 : 11, p.cor);
  }
  g.globalAlpha = 1;
}

/* Quem assiste recebe uma foto pequena e monta a cena com ela */

function cenaDaFoto(f) {
  const n = x => (Number.isFinite(x) ? x : 0);
  const c = Array.isArray(f.c) ? f.c : [];
  const k = Array.isArray(f.k) ? f.k : [-1, 0];
  return {
    nivel: n(f.n) || 1, vidas: n(f.v), pontos: n(f.p), bonus: n(f.b), L: CENARIOS[f.e ? 1 : 0],
    fase: FASES[f.s] || 'jogo', faseT: n(f.t) / 10, coroa: !!c[5], causa: f.q ? 'tempo' : '',
    coelho: {
      x: n(c[0]) || 84, y: n(c[1]) || 490, estado: ESTADOS[c[2]] || 'chao', dir: c[3] === -1 ? -1 : 1,
      marreta: n(c[4]) / 10, passo: n(c[6]) / 20, andando: !!c[7], marretaT: n(c[8]) / 10,
    },
    barris: (Array.isArray(f.r) ? f.r : []).map(b => ({ x: n(b[0]), y: n(b[1]), ang: n(b[2]) / 10, modo: b[3] ? 'escada' : 'rolar' })),
    fagulhas: (Array.isArray(f.f) ? f.f : []).map(q => ({ x: n(q[0]), y: n(q[1]) })),
    marretasPegas: [!!(f.m & 1), !!(f.m & 2)],
    itensPegos: [!!(f.i & 1), !!(f.i & 2), !!(f.i & 4)],
    raposo: { arremesso: n(k[0]) < 0 ? -1 : n(k[0]) / 20, tipo: k[1] ? 'tonel' : 'normal' },
    aceso: !!f.a, fogo: 0,
  };
}
let ultimaFoto = null;
let ultimaCena = null;

/* O jogo */

function criar(ctx) {
  const sorte = ctx.sorte;
  const som = typeof ctx.som === 'function' ? ctx.som : () => {};
  const segredo = typeof ctx.segredo === 'function' ? ctx.segredo : () => false;
  const J = ctx.junto || null; // jogo junto (versus ou co-op); null quando joga sozinho
  const VAZIO = new Set();

  const e = {
    nivel: 1, vidas: 3, pontos: 0, bonus: 5000, espelho: false, L: CENARIOS[0], D: dificuldade(1),
    fase: 'pronto', faseT: 0, causa: '', acabou: false, coroa: !!segredo('barris-coroa'), lento: false,
    coelho: { x: 0, y: 0, gi: 0, estado: 'chao', dir: 1, passo: 0, andando: false, vx: 0, vy: 0, esc: null, marreta: 0, marretaT: 0, idPulo: 0, somEscada: 0 },
    barris: [], fagulhas: [], marretasPegas: [false, false], itensPegos: [false, false, false],
    raposo: { arremesso: -1, tipo: 'normal', soltou: false },
    aceso: false, fogo: 0, primeiro: true, proxArremesso: 0, relogioBonus: 0, alertou: false,
    vidaExtra: false, usouMarreta: false, contaBarris: 0, mortes: 0, salvas: 0, pulados: 0, quebrados: 0,
  };

  // O que só existe no jogo junto: o mundo anda pelo relógio comum e os outros coelhos chegam pela rede.
  const jj = J && {
    fase: -1, // a fase (co-op) do mundo que está na tela
    faseVista: 0, // a última fase que o servidor contou
    quadro: 0, // quantos passos de 1/60 s o mundo já andou nesta fase
    rRaposo: null, contaFagulhas: 0, quadroAceso: -1, geracao: -1,
    quebrados: new Set(), // 'fase:b12' e 'fase:f3': o que alguém esmagou
    pegos: new Set(), // marretas e prendas que alguém já levou
    pedidos: new Set(), // o que eu já pedi
    outros: [], aparencia: [],
    troca: null, resgate: -1, // { fase, t }: a princesa foi salva e o próximo nível vai começar
    avisouMorte: false, renascerEm: -1, esperaT: 0, pisca: 0, chegou: false,
    alturaMax: 0, maiorProgresso: 0, relogioPontos: 0, aviso: null, foraT: 0,
  };

  // Efeitos (só enfeite: usam Math.random e não entram na foto)
  const fx = { part: [], cursor: 0, pops: [], cursorPop: 0, tremor: 0, relogio: 0, faisca: 0 };
  for (let i = 0; i < 180; i++) fx.part.push({ vivo: false, tipo: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, vida: 0, max: 1, cor: '#fff', tam: 1, rot: 0, vr: 0 });
  for (let i = 0; i < 14; i++) fx.pops.push({ vivo: false, x: 0, y: 0, txt: '', vida: 0, cor: '#fff', grande: false });

  function particula(tipo, x, y, vx, vy, vida, cor, tam, grav = 0, vr = 0) {
    const p = fx.part[fx.cursor];
    fx.cursor = (fx.cursor + 1) % fx.part.length;
    p.vivo = true; p.tipo = tipo; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.vida = vida; p.max = vida;
    p.cor = cor; p.tam = tam; p.g = grav; p.rot = Math.random() * 6.28; p.vr = vr;
  }
  function mostrar(txt, x, y, cor = PERGAMINHO, grande = false) {
    const p = fx.pops[fx.cursorPop];
    fx.cursorPop = (fx.cursorPop + 1) % fx.pops.length;
    p.vivo = true; p.txt = txt; p.x = limitar(x, 30, W - 30); p.y = y; p.vida = grande ? 1.6 : 0.9; p.cor = cor; p.grande = grande;
  }
  function poeira(x, y, n = 5) {
    for (let i = 0; i < n; i++) particula(0, x + (Math.random() - 0.5) * 12, y - 2, (Math.random() - 0.5) * 50, -8 - Math.random() * 22, 0.45, 'rgba(214,204,176,0.5)', 2.5 + Math.random() * 2);
  }
  function lascas(x, y) {
    const cores = ['#b9773a', '#8a5428', '#d79a55', '#43434e'];
    for (let i = 0; i < 12; i++) particula(1, x, y, (Math.random() - 0.5) * 240, -60 - Math.random() * 160, 0.8, cores[i % 4], 2 + Math.random() * 2.5, 520, (Math.random() - 0.5) * 24);
    for (let i = 0; i < 6; i++) particula(4, x, y, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 0.35, '#ffe08a', 1.4);
    poeira(x, y + R, 4);
  }

  function ganhar(n, x, y, txt = null, cor = PERGAMINHO) {
    e.pontos += n; mostrar(txt || String(n), x, y, cor, !!txt);
    if (!jj && !e.vidaExtra && e.pontos >= 10000) {
      e.vidaExtra = true; e.vidas++;
      som('vida'); mostrar('+1 vida', e.coelho.x, e.coelho.y - 56, '#7fe08a', true);
    }
  }

  /* Começo de nível e de vida */

  function iniciarVida() {
    const L = e.L;
    e.barris.length = 0; e.fagulhas.length = 0;
    const c = e.coelho;
    c.x = L.inicioX; c.gi = 0; c.y = alturaViga(L.vigas[0], c.x); c.estado = 'chao'; c.dir = L.lado;
    c.vx = 0; c.vy = 0; c.esc = null; c.marreta = 0; c.marretaT = 0; c.andando = false; c.passo = 0;
    e.marretasPegas[0] = false; e.marretasPegas[1] = false;
    e.bonus = e.D.bonus; e.relogioBonus = 0; e.alertou = false;
    e.raposo.arremesso = -1; e.raposo.soltou = false; e.primeiro = true; e.proxArremesso = 0.5;
    e.aceso = false; e.fogo = 0; e.causa = '';
    e.fase = 'pronto'; e.faseT = 0;
  }
  function iniciarNivel(n) {
    e.nivel = n; e.D = dificuldade(n);
    e.espelho = n >= 3 && n % 2 === 1; e.L = CENARIOS[e.espelho ? 1 : 0];
    e.itensPegos.fill(false);
    iniciarVida();
  }

  function morrer(causa) {
    if (e.fase !== 'jogo') return;
    e.fase = 'morte'; e.faseT = 0; e.causa = causa; e.mortes++;
    e.coelho.estado = 'morte'; e.coelho.marreta = 0;
    if (jj) jj.avisouMorte = false;
    fx.tremor = 0.2;
    som('morte');
  }
  function aposMorte() {
    e.vidas--;
    if (e.vidas <= 0) {
      e.vidas = 0; e.fase = 'fim'; e.faseT = 0; e.acabou = true;
      return;
    }
    iniciarVida();
  }
  function vencer() {
    const c = e.coelho;
    e.fase = 'vitoria'; e.faseT = 0; e.salvas++; e.raposo.arremesso = -1;
    c.marreta = 0; c.estado = 'chao'; c.dir = e.L.princesaX > c.x ? 1 : -1;
    som('fase');
    ganhar(e.bonus, c.x, c.y - 46, `+${e.bonus}`, '#7fe08a');
    for (const b of e.barris) poeira(b.x, b.y + R, 4);
    for (const f of e.fagulhas) poeira(f.x, f.y, 4);
    e.barris.length = 0; e.fagulhas.length = 0;
  }

  /* O coelho */

  function escadaPerto(x, gi, subindo) {
    for (const l of e.L.escadas) {
      if ((subindo ? l.de : l.para) === gi && Math.abs(x - l.x) <= TOLERANCIA_ESCADA) return l;
    }
    return null;
  }

  function moverCoelho(dt, ent) {
    const L = e.L;
    const c = e.coelho;
    const ap = ent.apertou || VAZIO;
    const mov = (ent.dir ? 1 : 0) - (ent.esq ? 1 : 0);
    if (c.estado === 'chao') {
      if (!c.marreta) {
        if (ent.cima && !ent.baixo) {
          const l = escadaPerto(c.x, c.gi, true);
          if (l) { c.estado = 'escada'; c.esc = l; c.x = l.x; c.y = l.yBaixo; c.andando = false; return; }
        }
        if (ent.baixo && !ent.cima) {
          const l = escadaPerto(c.x, c.gi, false);
          if (l) { c.estado = 'escada'; c.esc = l; c.x = l.x; c.y = l.yTopo; c.andando = false; return; }
        }
        if (ap.has('pular')) {
          // Pulo de arco fixo: a direção de agora vale até aterrissar
          c.estado = 'pulo'; c.vy = -PULO_V0; c.vx = mov * VEL_ANDAR; c.idPulo++; c.andando = false;
          if (mov) c.dir = mov;
          som('pulo');
          return;
        }
      }
      c.andando = mov !== 0;
      if (mov) { c.dir = mov; c.x += mov * VEL_ANDAR * dt; c.passo += dt; }
      c.x = limitar(c.x, limiteEsq(L, c.gi), limiteDir(L, c.gi)); c.y = alturaViga(L.vigas[c.gi], c.x);
    } else if (c.estado === 'escada') {
      const l = c.esc;
      const sobe = ent.cima && !ent.baixo;
      const desce = ent.baixo && !ent.cima;
      if (!sobe && !desce) return;
      c.y += (desce ? 1 : -1) * VEL_SUBIR * dt; c.passo += dt;
      c.somEscada += dt;
      if (c.somEscada >= 0.24) { c.somEscada = 0; som('passo'); }
      if (c.y <= l.yTopo) {
        c.y = l.yTopo; c.estado = 'chao'; c.gi = l.para; c.esc = null;
        if (c.gi === 6) { if (jj) chegarJunto(); else vencer(); }
      } else if (c.y >= l.yBaixo) {
        c.y = l.yBaixo; c.estado = 'chao'; c.gi = l.de; c.esc = null;
      }
    } else if (c.estado === 'pulo') {
      c.vy += PULO_G * dt; c.x = limitar(c.x + c.vx * dt, limiteEsq(L, c.gi), limiteDir(L, c.gi));
      c.y += c.vy * dt;
      const chao = alturaViga(L.vigas[c.gi], c.x);
      if (c.vy > 0 && c.y >= chao) {
        c.y = chao; c.estado = 'chao'; c.vx = 0;
        poeira(c.x, c.y, 5);
      }
    }
  }

  /* O Raposo, os barris e as fagulhas */

  function raposoArremessa(dt) {
    const r = e.raposo;
    if (r.arremesso >= 0) {
      r.arremesso += dt;
      if (!r.soltou && r.arremesso >= 0.8) { r.soltou = true; soltarBarril(r.tipo); }
      if (r.arremesso >= 1.1) r.arremesso = -1;
      return;
    }
    e.proxArremesso -= dt;
    // No junto os esmagados continuam contando até sumirem sozinhos (assim todos contam igual)
    if (e.proxArremesso > 0 || e.barris.length >= (e.D.maxBarris || MAX_BARRIS)) return;
    const rnd = jj ? jj.rRaposo : sorte;
    r.arremesso = 0; r.soltou = false;
    if (e.primeiro) { r.tipo = 'tonel'; e.primeiro = false; } else r.tipo = rnd() < e.D.louco ? 'louco' : 'normal';
    e.proxArremesso = e.D.intervalo + rnd() * 0.8;
  }

  function soltarBarril(tipo) {
    const L = e.L;
    const v5 = L.vigas[5];
    const b = { id: ++e.contaBarris, x: L.raposoX + L.lado * 46, y: 0, ang: 0, gi: 5, modo: 'rolar', vel: e.D.vel, vx: 0, vy: 0, quiques: 0, esc: null, pulado: -1, louco: false, primeiro: false };
    if (jj) {
      // Cada barril tem a sua sorte: tirar um do jogo não muda os outros
      b.rnd = semente(semear(J.semente, jj.fase, 1, b.id));
      b.quebrado = jj.quebrados.has(`${jj.fase}:b${b.id}`);
    }
    if (tipo === 'tonel') {
      // O primeiro barril cai reto no tonel e acende o fogo
      b.x = L.quedaX; b.modo = 'despencar'; b.vy = 20; b.primeiro = true;
      b.y = alturaViga(v5, b.x) - R - 6;
    } else if (tipo === 'louco') {
      b.modo = 'despencar'; b.louco = true; b.vy = -40;
      const alvo = jj ? 40 + b.rnd() * (W - 80) : e.coelho.x;
      b.vx = limitar((alvo - b.x) * 0.3, -75, 75); b.y = alturaViga(v5, b.x) - R - 6;
    } else {
      b.y = alturaViga(v5, b.x) - R;
    }
    e.barris.push(b);
  }

  function desceEscada(b, l) {
    if (b.rnd) return b.rnd() < Math.min(0.85, e.D.desce + 0.12); // junto: não depende de onde está ninguém
    const c = e.coelho;
    let p = e.D.desce;
    if (c.y > b.y + 24) p += 0.15; // o coelho está mais embaixo
    if (c.y > b.y + 24 && Math.abs(c.x - l.x) < 50) p += 0.1;
    return sorte() < Math.min(0.85, p);
  }

  function queimar(b) {
    e.aceso = true; e.fogo = 1;
    const L = e.L;
    const y = alturaViga(L.vigas[0], L.tonelX) - 34;
    for (let i = 0; i < 8; i++) particula(4, L.tonelX + (Math.random() - 0.5) * 16, y, (Math.random() - 0.5) * 70, -60 - Math.random() * 90, 0.6, '#ffb347', 1.5, 60);
    if (jj) {
      // Junto: o fogo acende e as fagulhas saem numa agenda fixa (passoMundo)
      if (jj.quadroAceso < 0) jj.quadroAceso = jj.quadro;
      return;
    }
    if (b.primeiro) { if (e.nivel >= 2 && e.fagulhas.length < e.D.maxFagulhas) nascerFagulha(); }
    else if (e.fagulhas.length < e.D.maxFagulhas && sorte() < e.D.fogo) nascerFagulha();
  }

  function nascerFagulha() {
    const L = e.L;
    const f = { x: L.tonelX, y: alturaViga(L.vigas[0], L.tonelX) - 36, vx: L.lado * 55, vy: -150, gi: 0, dir: L.lado, modo: 'saltar', esc: null, sobe: false, decide: 1, espera: 0.6, vel: e.D.velFagulha };
    if (jj) {
      f.id = ++jj.contaFagulhas; f.nasceu = jj.quadro;
      f.rnd = semente(semear(J.semente, jj.fase, 2, f.id));
      f.quebrado = jj.quebrados.has(`${jj.fase}:f${f.id}`);
    }
    e.fagulhas.push(f);
  }

  // Move um barril; devolve false quando ele some (queimou no tonel).
  function moverBarril(b, dt) {
    const L = e.L;
    if (b.modo === 'rolar') {
      const v = L.vigas[b.gi];
      const x0 = b.x;
      b.x += v.desce * b.vel * dt; b.ang += v.desce * b.vel * dt / R;
      if (b.gi === 0) {
        if (L.lado === 1 ? b.x <= L.tonelX + 18 : b.x >= L.tonelX - 18) { queimar(b); return false; }
      } else {
        for (const l of L.escadas) {
          if (l.para !== b.gi || !(b.x === l.x || (x0 - l.x) * (b.x - l.x) < 0)) continue;
          if (desceEscada(b, l)) { b.modo = 'escada'; b.esc = l; b.x = l.x; return true; }
        }
        if (b.x < v.xa || b.x > v.xb) { b.modo = 'cair'; b.vx = v.desce * 42; b.vy = 0; b.quiques = 0; return true; }
      }
      if (b.x < -20 || b.x > W + 20) return false;
      b.y = alturaViga(v, b.x) - R;
      return true;
    }
    if (b.modo === 'escada') {
      b.y += VEL_BARRIL_ESCADA * (b.vel / 100) * dt; b.ang += dt * 1.5;
      if (b.y >= b.esc.yBaixo - R) { b.gi = b.esc.de; b.y = b.esc.yBaixo - R; b.modo = 'rolar'; b.esc = null; }
      return true;
    }
    if (b.modo === 'cair') {
      b.vy += GRAVIDADE * dt; b.x = limitar(b.x + b.vx * dt, R, W - R);
      b.y += b.vy * dt; b.ang += b.vx * dt / R;
      const alvo = L.vigas[b.gi - 1];
      if (!alvo) return false;
      const chao = alturaViga(alvo, b.x) - R;
      if (b.vy > 0 && b.y >= chao) {
        b.y = chao;
        if (b.quiques === 0) { b.quiques = 1; b.vy = -95; if (!b.quebrado) poeira(b.x, b.y + R, 3); }
        else { b.gi--; b.modo = 'rolar'; b.vy = 0; }
      }
      return true;
    }
    // despencar: cai atravessando as vigas, quicando em cada uma
    b.vy = Math.min(270, b.vy + GRAVIDADE * dt); b.x += b.vx * dt;
    b.y += b.vy * dt; b.ang += dt * 5;
    if (b.x < 14 || b.x > W - 14) { b.vx = -b.vx; b.x = limitar(b.x, 14, W - 14); }
    const alvo = L.vigas[b.gi - 1];
    if (!alvo) return false;
    const yv = alturaViga(alvo, b.x);
    if (b.vy > 0 && b.y + R >= yv) {
      if (b.gi === 1) { b.gi = 0; b.modo = 'rolar'; b.vx = 0; b.vy = 0; b.y = yv - R; if (!b.quebrado) poeira(b.x, yv, 4); }
      else {
        if (b.x >= alvo.xa && b.x <= alvo.xb) {
          b.vy = -100; if (!b.quebrado) poeira(b.x, yv, 3);
          if (b.louco && (b.rnd || sorte)() < 0.4) b.vx = -b.vx;
        }
        b.gi--;
      }
    }
    return true;
  }

  function moverFagulha(f, dt) {
    const L = e.L;
    const rf = f.rnd || sorte; // junto: cada fagulha com a sua sorte
    if (f.modo === 'saltar') {
      f.vy += 500 * dt; f.x += f.vx * dt;
      f.y += f.vy * dt;
      const chao = alturaViga(L.vigas[0], f.x);
      if (f.vy > 0 && f.y >= chao) { f.y = chao; f.modo = 'andar'; f.gi = 0; f.dir = L.lado; }
      return;
    }
    if (f.modo === 'escada') {
      const alvo = f.sobe ? f.esc.yTopo : f.esc.yBaixo;
      const s = f.sobe ? -1 : 1;
      f.y += s * f.vel * 0.6 * dt;
      if ((alvo - f.y) * s <= 0) {
        f.y = alvo; f.gi = f.sobe ? f.esc.para : f.esc.de; f.modo = 'andar'; f.esc = null;
        f.dir = rf() < 0.5 ? -1 : 1; f.espera = 0.8;
      }
      return;
    }
    const c = e.coelho;
    f.decide -= dt;
    if (f.decide <= 0) {
      f.decide = 0.7 + rf() * 1.3;
      // Sozinho a fagulha corre atrás do coelho; no junto ela não persegue ninguém (o mundo é o mesmo para todos)
      if (!jj && c.gi === f.gi && c.estado !== 'escada' && sorte() < 0.6) f.dir = c.x > f.x ? 1 : -1;
      else if (rf() < 0.3) f.dir = -f.dir;
    }
    const x0 = f.x;
    f.x += f.dir * f.vel * dt;
    const a = limiteEsq(L, f.gi) + 4;
    const b = limiteDir(L, f.gi) - 4;
    if (f.x < a) { f.x = a; f.dir = 1; } else if (f.x > b) { f.x = b; f.dir = -1; }
    f.espera -= dt;
    if (f.espera <= 0) {
      for (const l of L.escadas) {
        if (l.para >= 6 || !(f.x === l.x || (x0 - l.x) * (f.x - l.x) < 0)) continue;
        const sobe = l.de === f.gi && rf() < 0.3;
        const desce = !sobe && l.para === f.gi && rf() < 0.2;
        if (sobe || desce) { f.modo = 'escada'; f.esc = l; f.sobe = sobe; f.x = l.x; return; }
      }
    }
    f.y = alturaViga(L.vigas[f.gi], f.x);
  }

  /* Marreta, pulos, itens e batidas */

  function usarMarreta(dt) {
    const c = e.coelho;
    c.marreta -= dt; c.marretaT += dt;
    if (c.marreta <= 0) { c.marreta = 0; return; }
    const z = zonaMarreta(c);
    for (let i = e.barris.length - 1; i >= 0; i--) {
      const b = e.barris[i];
      if (b.quebrado || !toca(b.x, b.y, R * 0.85, z.x1, z.y1, z.x2, z.y2)) continue;
      if (jj) quebrarJunto(b, 'b'); else e.barris.splice(i, 1);
      esmagou(b.x, b.y);
    }
    for (let i = e.fagulhas.length - 1; i >= 0; i--) {
      const f = e.fagulhas[i];
      if (f.quebrado || !toca(f.x, f.y - 8, 7, z.x1, z.y1, z.x2, z.y2)) continue;
      if (jj) quebrarJunto(f, 'f'); else e.fagulhas.splice(i, 1);
      esmagou(f.x, f.y - 8);
    }
  }
  function esmagou(x, y) {
    const n = PONTOS_MARRETA[Math.min(2, Math.floor((jj ? Math.random() : sorte()) * 3))];
    e.quebrados++; ganhar(n, x, y - 14, null, OURO);
    lascas(x, y); fx.tremor = 0.25;
    som('quebra');
  }

  function pontosDePulo() {
    const c = e.coelho;
    if (c.estado !== 'pulo') return;
    for (const b of e.barris) {
      if (b.quebrado || b.pulado === c.idPulo || b.modo !== 'rolar' || b.gi !== c.gi || Math.abs(b.x - c.x) > 8 || c.y > b.y) continue;
      b.pulado = c.idPulo; e.pulados++;
      ganhar(100, b.x, b.y - 26); som('moeda');
    }
    for (const f of e.fagulhas) {
      if (f.quebrado || f.pulado === c.idPulo || f.modo !== 'andar' || f.gi !== c.gi || Math.abs(f.x - c.x) > 8 || c.y > f.y - 12) continue;
      f.pulado = c.idPulo; e.pulados++;
      ganhar(100, f.x, f.y - 34); som('moeda');
    }
  }

  function pegarCoisas() {
    const L = e.L;
    const c = e.coelho;
    if (c.estado === 'escada') return;
    for (let i = 0; i < L.marretas.length; i++) {
      const m = L.marretas[i];
      if (e.marretasPegas[i] || c.marreta > 0 || m.gi !== c.gi) continue;
      const my = alturaViga(L.vigas[m.gi], m.x) - 24;
      if (Math.abs(c.x - m.x) < 12 && c.y - 30 < my + 8 && c.y > my - 6) {
        if (jj) { pedir(chaveMarreta(i), 0); continue; } // só leva quem o servidor disser (aoPegou)
        e.marretasPegas[i] = true;
        c.marreta = DURACAO_MARRETA; c.marretaT = 0;
        som('poder'); mostrar('Marreta!', m.x, my - 12, OURO);
      }
    }
    for (let i = 0; i < L.itens.length; i++) {
      const it = L.itens[i];
      if (e.itensPegos[i] || it.gi !== c.gi) continue;
      const iy = alturaViga(L.vigas[it.gi], it.x) - 14;
      if (Math.abs(c.x - it.x) < 13 && c.y - 26 < iy + 10 && c.y > iy - 8) {
        if (jj) { pedir(chaveItem(i), e.D.item); continue; }
        e.itensPegos[i] = true;
        ganhar(e.D.item, it.x, iy - 14, null, OURO);
        for (let k = 0; k < 6; k++) particula(3, it.x, iy, (Math.random() - 0.5) * 90, -40 - Math.random() * 60, 0.6, OURO, 2.5, 120);
        som('moeda');
      }
    }
  }

  function tocouInimigo() {
    const c = e.coelho;
    const x1 = c.x - 5.5;
    const x2 = c.x + 5.5;
    const y1 = c.y - 24;
    const y2 = c.y - 4;
    for (const b of e.barris) if (!b.quebrado && toca(b.x, b.y, 6.5, x1, y1, x2, y2)) return true;
    for (const f of e.fagulhas) if (!f.quebrado && toca(f.x, f.y - 7, 5.5, x1, y1, x2, y2)) return true;
    return false;
  }

  function atualizarEfeitos(dt) {
    fx.tremor = Math.max(0, fx.tremor - dt); e.fogo = Math.max(0, e.fogo - dt * 1.5);
    for (let i = 0; i < fx.part.length; i++) {
      const p = fx.part[i];
      if (!p.vivo) continue;
      p.vida -= dt;
      if (p.vida <= 0) { p.vivo = false; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = 0; i < fx.pops.length; i++) {
      const p = fx.pops[i];
      if (!p.vivo) continue;
      p.vida -= dt; p.y -= 26 * dt;
      if (p.vida <= 0) p.vivo = false;
    }
    if (e.aceso && e.fase !== 'morte') {
      fx.faisca -= dt;
      if (fx.faisca <= 0) {
        fx.faisca = 0.1 + Math.random() * 0.15;
        const L = e.L;
        particula(4, L.tonelX + (Math.random() - 0.5) * 18, alturaViga(L.vigas[0], L.tonelX) - 40, (Math.random() - 0.5) * 20, -30 - Math.random() * 30, 0.7, '#ffb347', 1.2);
      }
    }
    if (e.fase === 'vitoria' && e.faseT < 2.4) {
      fx.relogio += dt;
      if (fx.relogio > 0.16) {
        fx.relogio = 0;
        const L = e.L;
        const x = L.princesaX + (e.coelho.x - L.princesaX) * Math.random();
        particula(2, x, L.vigas[6].yE - 20, (Math.random() - 0.5) * 30, -30 - Math.random() * 20, 1.2, Math.random() < 0.5 ? '#ff6f91' : '#ff9fb5', 4 + Math.random() * 2);
      }
    }
  }

  /* Jogo junto: todos na mesma torre, com os mesmos barris na mesma hora */

  const nomeDe = i => (i === J.eu ? 'Você' : String(J.jogadores?.[i]?.nome || `Jogador ${i + 1}`));
  const chaveMarreta = i => `marreta:${jj.fase}-${i}-${Math.max(0, jj.geracao)}`;
  const chaveItem = i => `item:${jj.fase}-${i}`;
  const estadoSala = () => (typeof J.estado === 'function' ? J.estado() : null);
  const estouFora = () => !!estadoSala()?.p?.[J.eu]?.fora;

  function aparenciaDe(i) {
    const v = J.jogadores?.[i]?.visual;
    const pelo = typeof v?.pelo === 'string' && /^#[0-9a-f]{6}$/i.test(v.pelo) ? v.pelo : PELOS[i % PELOS.length];
    const roupa = v?.roupa && typeof v.roupa === 'object' ? v.roupa : null;
    return { pelo, escuro: sombrear(pelo, -0.18), roupa, cor: J.jogadores?.[i]?.cor || OURO, nome: curto(nomeDe(i), 12) };
  }

  // Pede uma marreta ou prenda (uma vez); quem leva é quem o servidor disser primeiro.
  function pedir(chave, valor) {
    if (jj.pedidos.has(chave) || jj.pegos.has(chave)) return;
    jj.pedidos.add(chave);
    J.pegar(chave, valor);
  }

  function atualizarPegos() {
    for (let i = 0; i < e.marretasPegas.length; i++) e.marretasPegas[i] = jj.pegos.has(chaveMarreta(i));
    for (let i = 0; i < e.itensPegos.length; i++) e.itensPegos[i] = jj.pegos.has(chaveItem(i));
  }

  // Esmaguei: some da tela e da batida, mas continua andando escondido até sumir sozinho
  // (assim o Raposo conta os barris igual em todas as telas).
  function quebrarJunto(x, tipo) {
    x.quebrado = true;
    jj.quebrados.add(`${jj.fase}:${tipo}${x.id}`);
    J.evento(tipo === 'b' ? { tipo: 'quebrou', b: x.id, n: jj.fase } : { tipo: 'quebrou', f: x.id, n: jj.fase });
  }

  // O mundo de uma fase: só depende da semente, da fase e do relógio comum.
  function iniciarMundo(f) {
    jj.fase = f; jj.quadro = 0;
    e.nivel = J.modo === 'coop' ? f + 1 : 1;
    e.D = dificuldadeJunto(e.nivel, J.dif);
    e.espelho = e.nivel >= 3 && e.nivel % 2 === 1; e.L = CENARIOS[e.espelho ? 1 : 0];
    e.barris.length = 0; e.fagulhas.length = 0;
    const r = e.raposo;
    r.arremesso = -1; r.soltou = false; r.tipo = 'normal';
    e.primeiro = true; e.proxArremesso = 0.5; e.aceso = false; e.fogo = 0; e.contaBarris = 0;
    jj.rRaposo = semente(semear(J.semente, f, 3)); jj.contaFagulhas = 0; jj.quadroAceso = -1; jj.geracao = 0;
    e.bonus = e.D.bonus; jj.chegou = false; jj.alturaMax = 0;
    atualizarPegos();
  }

  // Um passo de 1/60 s do mundo: Raposo, barris, fagulhas e as marretas que voltam.
  function passoMundo() {
    jj.quadro++;
    raposoArremessa(PASSO);
    for (let i = e.barris.length - 1; i >= 0; i--) if (!moverBarril(e.barris[i], PASSO)) e.barris.splice(i, 1);
    // Fagulhas: uma a cada período depois que o fogo acende; cada uma se apaga sozinha depois de um tempo
    const periodo = Math.max(60, Math.round(e.D.periodoFagulha * 60));
    const vida = periodo * e.D.maxFagulhas;
    for (let i = e.fagulhas.length - 1; i >= 0; i--) {
      const f = e.fagulhas[i];
      if (jj.quadro - f.nasceu < vida) continue;
      if (!f.quebrado) poeira(f.x, f.y, 5);
      e.fagulhas.splice(i, 1);
    }
    if (jj.quadroAceso >= 0) {
      const desde = jj.quadro - jj.quadroAceso - 60;
      if (desde >= 0 && desde % periodo === 0) nascerFagulha();
    }
    for (const f of e.fagulhas) moverFagulha(f, PASSO);
    const g = Math.floor(jj.quadro / (PERIODO_MARRETA * 60));
    if (g !== jj.geracao) { jj.geracao = g; atualizarPegos(); }
  }

  function colocarNoComeco() {
    const L = e.L;
    const c = e.coelho;
    c.gi = 0; c.x = limitar(L.inicioX + L.lado * (J.eu % 4) * 12, limiteEsq(L, 0), limiteDir(L, 0)); c.y = alturaViga(L.vigas[0], c.x);
    c.estado = 'chao'; c.dir = L.lado; c.vx = 0; c.vy = 0; c.esc = null; c.marreta = 0; c.marretaT = 0; c.andando = false; c.passo = 0;
  }

  function renascer() {
    colocarNoComeco();
    e.fase = 'jogo'; e.faseT = 0; jj.pisca = 1.6; jj.renascerEm = -1;
    poeira(e.coelho.x, e.coelho.y, 8);
    som('poder');
  }

  function chegarJunto() {
    const c = e.coelho;
    e.fase = 'chegou'; e.faseT = 0; e.salvas++;
    c.marreta = 0; c.estado = 'chao'; c.dir = e.L.princesaX > c.x ? 1 : -1;
    som('fase');
    ganhar(e.bonus, c.x, c.y - 46, `+${e.bonus}`, '#7fe08a');
    medirAltura();
    jj.relogioPontos = 1;
    jj.aviso = { sub: 'Você chegou lá!', txt: 'Resgatada!', t: 3 };
    // Uma vez por fase, e só se o servidor ainda estiver nesta fase (senão alguém já chegou antes)
    if (!jj.chegou && J.fase() === jj.fase) { jj.chegou = true; J.cheguei(); }
  }

  // Co-op: alguém salvou a princesa. O mundo para, e o próximo nível começa para todos na mesma hora.
  function mudouFase(f) {
    jj.faseVista = f;
    if (f === jj.fase || jj.troca?.fase === f) return;
    let quem = jj.chegou ? J.eu : -1;
    for (let i = 0; quem < 0 && i < jj.outros.length; i++) if (jj.outros[i]?.pose === 'chegou' && jj.outros[i].fase === jj.fase) quem = i;
    jj.resgate = quem; jj.aviso = null;
    jj.troca = { fase: f, t: 0 };
    if (quem !== J.eu) som('fase');
    for (const b of e.barris) if (!b.quebrado) poeira(b.x, b.y + R, 4);
    for (const q of e.fagulhas) if (!q.quebrado) poeira(q.x, q.y, 4);
    e.barris.length = 0; e.fagulhas.length = 0;
    e.raposo.arremesso = -1; e.coelho.marreta = 0;
  }

  function comecarNivelJunto(f) {
    jj.troca = null;
    iniciarMundo(f);
    if (e.fase === 'fora' || estouFora()) { e.fase = 'fora'; return; }
    colocarNoComeco(); // quem estava morrendo ou esperando também volta, sem perder vida
    e.fase = 'jogo'; e.faseT = 0; jj.pisca = 0; jj.renascerEm = -1; jj.avisouMorte = false;
    jj.aviso = { sub: `Nível ${e.nivel}`, txt: 'Já!', t: 1.2 };
  }

  // Altura: viga × 1000 + quanto já subiu da escada.
  function alturaAgora() {
    const c = e.coelho;
    if (c.estado === 'escada' && c.esc) {
      const l = c.esc;
      return l.de * 1000 + Math.round(limitar((l.yBaixo - c.y) / (l.yBaixo - l.yTopo), 0, 1) * 999);
    }
    return c.gi * 1000;
  }
  function medirAltura() {
    const a = alturaAgora();
    if (a > jj.alturaMax) jj.alturaMax = a;
  }
  // O progresso que vai para o placar (só cresce; no máximo duas vezes por segundo).
  function enviarProgresso(dt) {
    jj.relogioPontos += dt;
    if (jj.relogioPontos < 0.5) return;
    const p = Math.max(0, jj.fase) * 7000 + jj.alturaMax + Math.floor(e.pontos);
    if (p <= jj.maiorProgresso) return;
    jj.maiorProgresso = p; jj.relogioPontos = 0;
    J.pontos(p);
  }

  function enviarPos() {
    if (e.fase === 'fora') return;
    const c = e.coelho;
    J.pos({
      x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, d: c.dir, e: ESTADOS.indexOf(c.estado),
      m: c.marreta > 0 ? Math.round(c.marretaT * 10) : -1, p: Math.round(c.passo * 20) % 2000, a: c.andando ? 1 : 0,
      s: POSES.indexOf(e.fase), t: Math.round(e.faseT * 10), h: alturaAgora(), n: jj.fase, k: jj.pisca > 0 ? 1 : 0,
    });
  }

  function outro(i) {
    if (!jj.outros[i]) {
      jj.outros[i] = { x: 0, y: 0, ax: 0, ay: 0, dir: 1, estado: 'chao', passo: 0, andando: false, marreta: false, marretaT: 0, fim: false,
        pose: 'jogo', morteT: 0, altura: 0, fase: -1, pisca: false, visto: false, fora: false };
    }
    if (!jj.aparencia[i]) jj.aparencia[i] = aparenciaDe(i);
    return jj.outros[i];
  }

  // Os outros andam suavizados entre uma posição e outra (chegam umas 12 por segundo).
  function atualizarOutros(dt) {
    const k = 1 - Math.exp(-dt * 14);
    for (const r of jj.outros) {
      if (!r || !r.visto) continue;
      const dy = r.ay - r.y;
      r.x += (r.ax - r.x) * k; r.y += dy * k;
      if (r.andando || (r.estado === 'escada' && Math.abs(dy) > 0.3)) r.passo += dt;
      if (r.marreta) r.marretaT += dt;
      if (r.pose === 'morte') r.morteT += dt;
    }
  }

  function aoPos(i, d) {
    if (i === J.eu || !Number.isInteger(i) || i < 0 || i > 15 || !d || typeof d !== 'object') return;
    const x = Number(d.x);
    const y = Number(d.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const r = outro(i);
    const pose = POSES[d.s] || 'jogo';
    const fase = Number(d.n) || 0;
    const pula = !r.visto || fase !== r.fase || Math.abs(x - r.x) > 48 || Math.abs(y - r.y) > 48 || (pose === 'morte') !== (r.pose === 'morte');
    r.ax = limitar(x, -40, W + 40); r.ay = limitar(y, -40, H + 40);
    if (pula) { r.x = r.ax; r.y = r.ay; }
    r.fase = fase; r.dir = d.d === -1 ? -1 : 1; r.estado = ESTADOS[d.e] || 'chao';
    r.marreta = Number(d.m) >= 0;
    if (r.marreta) r.marretaT = Number(d.m) / 10;
    r.passo = (Number(d.p) || 0) / 20; r.andando = !!d.a;
    if (pose === 'morte' && r.pose !== 'morte') r.morteT = (Number(d.t) || 0) / 10;
    if (pose === 'fora') r.fora = true;
    r.pose = pose; r.altura = Number(d.h) || 0; r.pisca = !!d.k; r.visto = true;
  }

  // Alguém esmagou um barril ou fagulha: some aqui também (só ele; o resto do mundo não muda).
  function aoEvento(i, ev) {
    if (!ev || ev.tipo !== 'quebrou') return;
    const fase = Number(ev.n);
    const tipo = ev.b != null ? 'b' : ev.f != null ? 'f' : '';
    const id = Number(tipo === 'b' ? ev.b : ev.f);
    if (!tipo || !Number.isInteger(fase) || !Number.isInteger(id)) return;
    jj.quebrados.add(`${fase}:${tipo}${id}`);
    if (fase !== jj.fase || jj.troca) return;
    const lista = tipo === 'b' ? e.barris : e.fagulhas;
    for (const x of lista) {
      if (x.id !== id || x.quebrado) continue;
      x.quebrado = true;
      lascas(x.x, tipo === 'b' ? x.y : x.y - 8);
      break;
    }
  }

  function aoPegou(i, chave, valor) {
    const k = String(chave || '');
    jj.pegos.add(k);
    atualizarPegos();
    const partes = (k.split(':')[1] || '').split('-');
    if (Number(partes[0]) !== jj.fase || jj.troca) return;
    const idx = Number(partes[1]);
    const L = e.L;
    const c = e.coelho;
    if (k.startsWith('marreta:')) {
      const m = L.marretas[idx];
      if (!m) return;
      const my = alturaViga(L.vigas[m.gi], m.x) - 24;
      if (i !== J.eu) { poeira(m.x, my + 10, 5); return; }
      if (e.fase !== 'jogo') return;
      c.marreta = DURACAO_MARRETA; c.marretaT = 0;
      som('poder'); mostrar('Marreta!', m.x, my - 12, OURO);
    } else if (k.startsWith('item:')) {
      const it = L.itens[idx];
      if (!it) return;
      const iy = alturaViga(L.vigas[it.gi], it.x) - 14;
      for (let n = 0; n < 6; n++) particula(3, it.x, iy, (Math.random() - 0.5) * 90, -40 - Math.random() * 60, 0.6, OURO, 2.5, 120);
      if (i !== J.eu) return;
      ganhar(Math.max(0, Math.min(10000, Number(valor) || 0)), it.x, iy - 14, null, OURO);
      som('moeda');
    }
  }

  function aoRenascer(i) {
    if (i === J.eu && e.fase === 'espera' && !jj.troca) jj.renascerEm = 1;
  }

  function aoFora(i) {
    if (i !== J.eu) { outro(i).fora = true; return; }
    if (e.fase === 'fora') return;
    const c = e.coelho;
    J.pos({ x: Math.round(c.x), y: Math.round(c.y), d: c.dir, e: 0, m: -1, p: 0, a: 0, s: POSES.indexOf('fora'), t: 0, h: 0, n: jj.fase, k: 0 });
    e.fase = 'fora'; e.faseT = 0; c.marreta = 0; jj.renascerEm = -1; jj.foraT = 0;
  }

  function aoChegou(i) {
    if (i !== J.eu) som('fase');
    const quem = i === J.eu ? 'Você' : curto(nomeDe(i), 14);
    jj.aviso = { sub: J.modo === 'coop' ? `${quem} salvou a princesa!` : `${quem} chegou primeiro!`, txt: 'Resgatada!', t: 8 };
  }

  function iniciarJunto() {
    for (let i = 0; i < Math.max(J.n || 0, J.eu + 1); i++) jj.aparencia[i] = aparenciaDe(i);
    jj.faseVista = J.fase();
    iniciarMundo(jj.faseVista);
    colocarNoComeco();
    e.fase = estouFora() ? 'fora' : 'pronto'; e.faseT = 0;
    J.aoPos = aoPos; J.aoEvento = aoEvento; J.aoPegou = aoPegou; J.aoRenascer = aoRenascer;
    J.aoFora = aoFora; J.aoChegou = aoChegou; J.aoFase = mudouFase;
  }

  function passoCoelhoJunto(dt, ent) {
    if (e.fase === 'pronto') {
      if (J.faseTempo() < 0) return;
      e.fase = 'jogo'; e.faseT = 0;
    }
    if (e.fase === 'morte') {
      // Depois da animação conta para o servidor (uma vez) e espera a resposta
      if (e.faseT >= T_MORTE && !jj.avisouMorte) {
        jj.avisouMorte = true; e.fase = 'espera'; e.faseT = 0; jj.esperaT = 0; jj.renascerEm = -1;
        J.morri();
      }
      return;
    }
    if (e.fase === 'espera') {
      jj.esperaT += dt;
      if (jj.renascerEm > 0) { jj.renascerEm -= dt; if (jj.renascerEm <= 0) renascer(); }
      else if (jj.esperaT > 8 && !estouFora()) renascer(); // a resposta se perdeu no caminho
      return;
    }
    if (e.fase !== 'jogo') return;
    if (jj.pisca > 0) jj.pisca = Math.max(0, jj.pisca - dt);
    moverCoelho(dt, ent);
    if (e.fase !== 'jogo') return;
    if (e.coelho.marreta > 0) usarMarreta(dt);
    pontosDePulo();
    pegarCoisas();
    if (jj.pisca <= 0 && tocouInimigo()) morrer('barril');
    medirAltura();
  }

  // No junto nunca acaba por aqui (quem termina a partida é o servidor).
  function atualizarJunto(dt, ent) {
    const fs = J.fase();
    if (fs !== jj.faseVista) mudouFase(fs);
    e.faseT += dt;
    if (e.fase === 'fora') jj.foraT += dt;
    atualizarEfeitos(dt);
    atualizarOutros(dt);
    if (jj.aviso) { jj.aviso.t -= dt; if (jj.aviso.t <= 0) jj.aviso = null; }
    const ft = J.faseTempo();
    if (jj.troca) {
      jj.troca.t += dt;
      if (ft < 0) { enviarProgresso(dt); return; }
      comecarNivelJunto(jj.troca.fase);
    }
    // O mundo anda até o quadro do relógio comum: alcança se ficou para trás, nunca passa à frente
    const alvo = Math.floor(ft * 60);
    for (let n = 0; jj.quadro < alvo && n < 3600; n++) passoMundo();
    e.bonus = Math.max(0, e.D.bonus - 100 * Math.floor(jj.quadro / 120)); // só enfeite e pontos: não mata
    passoCoelhoJunto(dt, ent || VAZIO);
    enviarPos();
    enviarProgresso(dt);
  }

  /* Desenho do jogo junto */

  const VISTA = { x: 0, y: 0, dir: 1, estado: 'chao', passo: 0, andando: false, marreta: false, marretaT: 0, fim: false, pose: 'jogo', morteT: 0, pisca: false };
  const VISTA_RAPOSO = { L: null, fase: 'jogo', faseT: 0, raposo: null };
  const RANK = [];

  // Um coelho do jogo junto (eu ou outro), com o pelo e a roupa do Club Coelho.
  function desenharCoelhoJunto(g, b, ap, t, souEu) {
    const s = ESCALA_COELHO;
    if (b.pisca && Math.floor(t * 12) % 2 === 0) g.globalAlpha = 0.3;
    let topo = b.y - 44;
    if (b.pose === 'morte' || b.pose === 'espera') {
      const ft = b.pose === 'espera' ? 9 : b.morteT;
      const final = -b.dir * Math.PI / 2;
      const ang = ft < 0.5 ? 0 : ft < 1.6 ? final * 9 * (ft - 0.5) / 1.1 : final;
      g.save(); g.translate(b.x, b.y - 11); g.rotate(ang); g.scale(s, s);
      desenharCoelho(g, 0, 11 / s, { pelo: ap.pelo, roupa: ap.roupa, dir: b.dir, t });
      g.restore();
      if (ft >= 1.6) {
        for (let k = 0; k < 3; k++) {
          const a = t * 4 + k * 2.09;
          estrela(g, b.x + Math.cos(a) * 12, b.y - 26 + Math.sin(a) * 3.5, 3, OURO);
        }
      }
      topo = b.y - 34;
    } else if (b.estado === 'escada') {
      desenharCoelhoCostas(g, b.x, b.y, b.passo, false, ap.pelo, ap.escuro);
    } else {
      const festa = b.pose === 'chegou';
      g.save(); g.translate(b.x, b.y); g.scale(s, s);
      desenharCoelho(g, 0, 0, { pelo: ap.pelo, roupa: ap.roupa, dir: b.dir, passo: festa ? t * 0.6 : b.passo, andando: festa || (b.andando && b.estado === 'chao'), t });
      g.restore();
      if (b.marreta) {
        const cima = marretaEmCima(b);
        const ang = cima ? -Math.PI / 2 + b.dir * 0.25 : (b.dir > 0 ? 0.35 : Math.PI - 0.35);
        martelo(g, b.x + b.dir * 5, b.y - 13, ang, b.fim && Math.floor(t * 10) % 2 === 0);
        if (!cima) {
          g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1.5; g.beginPath();
          if (b.dir > 0) g.arc(b.x + 5, b.y - 13, 25, -1.2, 0.2); else g.arc(b.x - 5, b.y - 13, 25, Math.PI - 0.2, Math.PI + 1.2);
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    if (souEu) {
      // Eu: só uma setinha na minha cor
      g.fillStyle = ap.cor; g.beginPath(); g.moveTo(b.x - 4, topo - 7); g.lineTo(b.x + 4, topo - 7); g.lineTo(b.x, topo - 1); g.closePath(); g.fill();
    } else texto(g, ap.nome, b.x, topo, 8, ap.cor);
  }

  const alturaDe = i => (i === J.eu ? alturaAgora() : jj.outros[i]?.altura || 0);
  // Quem está mais alto agora (uma linha embaixo do nível).
  function desenharPlacarAltura(g) {
    if ((J.n || 0) < 2) return;
    const est = estadoSala();
    RANK.length = 0;
    for (let i = 0; i < J.n; i++) {
      const p = est?.p?.[i];
      if (p && (p.fora || p.saiu)) continue;
      if (i === J.eu) { if (e.fase !== 'fora') RANK.push(i); continue; }
      const r = jj.outros[i];
      if (r && r.visto && !r.fora && r.fase === jj.fase) RANK.push(i);
    }
    RANK.sort((a, b) => alturaDe(b) - alturaDe(a) || a - b);
    g.font = `bold 9px ${FONTE}`;
    let total = 0;
    const gap = 12;
    for (let k = 0; k < RANK.length; k++) total += g.measureText(`${k + 1}. ${curto(nomeDe(RANK[k]), 8)}`).width + (k ? gap : 0);
    let x = W / 2 - total / 2;
    for (let k = 0; k < RANK.length; k++) {
      const txt = `${k + 1}. ${curto(nomeDe(RANK[k]), 8)}`;
      g.font = `bold 9px ${FONTE}`;
      const w = g.measureText(txt).width;
      texto(g, txt, x, 33, 9, jj.aparencia[RANK[k]]?.cor || PERGAMINHO, 'left');
      x += w + gap;
    }
  }

  function desenharHudJunto(g, t) {
    texto(g, 'PONTOS', 12, 15, 9, OURO_ESCURO, 'left');
    texto(g, String(Math.floor(e.pontos)).padStart(6, '0'), 12, 34, 18, PERGAMINHO, 'left');
    const est = estadoSala();
    const coop = J.modo === 'coop';
    const v = Number(coop ? est?.vidasEquipe : est?.p?.[J.eu]?.vidas);
    const vidas = Number.isFinite(v) ? Math.max(0, v) : 0;
    let x0 = 18;
    if (coop) { texto(g, 'EQUIPE', 12, 55, 8, OURO_ESCURO, 'left'); x0 = 66; }
    const mostra = Math.min(vidas, 6);
    for (let i = 0; i < mostra; i++) cabecinha(g, x0 + i * 15, 52);
    if (vidas > mostra) texto(g, `+${vidas - mostra}`, x0 + mostra * 15 - 4, 56, 9, PERGAMINHO, 'left');
    if (!vidas) texto(g, coop ? 'nenhuma' : 'sem vidas', x0 - 6, 56, 9, '#ff9a8a', 'left');
    texto(g, coop ? `NÍVEL ${e.nivel} DE ${est?.fases || 3}` : `NÍVEL ${e.nivel}`, W / 2, 18, 11, OURO);
    const bx = 364;
    const by = 8;
    g.fillStyle = 'rgba(10,18,13,0.85)';
    caixa(g, bx, by, 74, 38, 6);
    g.fill();
    g.strokeStyle = OURO_ESCURO; g.lineWidth = 1.5;
    caixa(g, bx, by, 74, 38, 6);
    g.stroke();
    texto(g, 'BÔNUS', bx + 37, by + 13, 9, OURO_ESCURO);
    texto(g, String(e.bonus), bx + 37, by + 32, 17, PERGAMINHO);
    desenharPlacarAltura(g, t);
  }

  function desenharAvisosJunto(g) {
    const tr = jj.troca;
    if (tr) {
      if (tr.t < 1.5) {
        const q = jj.resgate;
        faixa(g, 286, q === J.eu ? 'Você salvou a princesa!' : q >= 0 ? `${curto(nomeDe(q), 14)} salvou a princesa!` : 'A princesa foi salva!', 'Resgatada!');
      } else {
        const falta = -J.faseTempo();
        faixa(g, 286, `Nível ${tr.fase + 1}`, falta > 0 ? `Começa em ${Math.max(1, Math.ceil(falta))}` : 'Já!');
      }
    } else if (e.fase === 'pronto') faixa(g, 286, `Nível ${e.nivel}`, 'Pronto!');
    else if (jj.aviso) faixa(g, 286, jj.aviso.sub, jj.aviso.txt);
    else if (e.fase === 'fora' && jj.foraT < 2.5) faixa(g, 286, null, 'Você está fora: assistindo');
    if (e.fase === 'fora' && (jj.foraT >= 2.5 || tr || jj.aviso)) etiqueta(g, 'Você está fora: assistindo', 500);
  }

  function desenharCenaJunto(g, t) {
    const L = e.L;
    g.fillStyle = '#05090b'; g.fillRect(0, 0, W, H);
    g.save();
    if (fx.tremor > 0) {
      const a = Math.min(1, fx.tremor * 4) * 4;
      g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    const fundo = fundoPronto(L);
    if (fundo) g.drawImage(fundo, 0, 0, W, H); else desenharFundo(g, L);
    estrelasPiscando(g, t);
    desenharChamas(g, L, t, e.aceso, e.fogo);
    const tr = jj.troca;
    if (!tr) {
      for (let i = 0; i < L.marretas.length; i++) {
        if (e.marretasPegas[i]) continue;
        const m = L.marretas[i];
        const y = alturaViga(L.vigas[m.gi], m.x) - 24 + Math.sin(t * 3 + i) * 2;
        elipse(g, m.x, y, 13, 13, 'rgba(232,194,74,0.14)');
        martelo(g, m.x - 7, y + 7, -0.75, false);
      }
      for (let i = 0; i < L.itens.length; i++) {
        if (e.itensPegos[i]) continue;
        const it = L.itens[i];
        desenharItem(g, it.tipo, it.x, alturaViga(L.vigas[it.gi], it.x) - 14 + Math.sin(t * 2.5 + i) * 1.5, t);
      }
    }
    // Princesa (na troca de nível: o coração e depois o Raposo foge com ela)
    const ta = tr ? tr.t * 1.5 : 0;
    const xP = L.princesaX;
    const yP = L.vigas[6].yE;
    if (!tr || ta < 2.6) {
      const susto = !!tr && ta >= 1.8;
      desenharPrincesa(g, xP, yP, t, susto);
      if (!tr || susto) { if (susto || t % 5.5 < 1.7) balao(g, xP + 12, yP - 44, 'Socorro!'); }
      if (tr && ta < 1.8) coracao(g, xP - L.lado * 18, yP - 50, 11 * (1 + Math.sin(t * 8) * 0.08), '#ff5f86');
    }
    VISTA_RAPOSO.L = L; VISTA_RAPOSO.raposo = e.raposo; VISTA_RAPOSO.faseT = ta;
    VISTA_RAPOSO.fase = tr ? 'vitoria' : e.fase === 'pronto' ? 'pronto' : 'jogo';
    desenharRaposo(g, VISTA_RAPOSO, t);
    for (let i = 0; i < e.barris.length; i++) {
      const b = e.barris[i];
      if (b.quebrado) continue;
      if (b.modo === 'escada') barrilDeLado(g, b.x, b.y, b.ang); else barrilRolando(g, b.x, b.y, b.ang);
    }
    for (let i = 0; i < e.fagulhas.length; i++) {
      const f = e.fagulhas[i];
      if (!f.quebrado) desenharFagulha(g, f.x, f.y, t, f.id || i);
    }
    // Os outros coelhos (atravessam uns aos outros) e eu por cima
    const est = estadoSala();
    for (let i = 0; i < jj.outros.length; i++) {
      const r = jj.outros[i];
      if (!r || !r.visto || r.fora || r.pose === 'fora' || r.fase !== jj.fase) continue;
      const p = est?.p?.[i];
      if (p && (p.fora || p.saiu)) continue;
      desenharCoelhoJunto(g, r, jj.aparencia[i] || aparenciaDe(i), t, false);
    }
    if (e.fase !== 'fora') {
      const c = e.coelho;
      VISTA.x = c.x; VISTA.y = c.y; VISTA.dir = c.dir; VISTA.estado = c.estado; VISTA.passo = c.passo; VISTA.andando = c.andando;
      VISTA.marreta = c.marreta > 0; VISTA.marretaT = c.marretaT; VISTA.fim = c.marreta < 2; VISTA.pose = e.fase;
      VISTA.morteT = e.faseT; VISTA.pisca = jj.pisca > 0;
      desenharCoelhoJunto(g, VISTA, jj.aparencia[J.eu], t, true);
    }
    desenharEfeitos(g, fx);
    g.restore();
    desenharHudJunto(g, t);
    desenharAvisosJunto(g);
  }

  function atualizar(dt, ent) {
    if (J) { atualizarJunto(dt, ent); return; }
    if (e.acabou) return;
    e.lento = !!segredo('barris-lento'); e.coroa = !!segredo('barris-coroa');
    e.faseT += dt;
    atualizarEfeitos(dt);
    if (e.fase === 'pronto') { if (e.faseT >= T_PRONTO) { e.fase = 'jogo'; e.faseT = 0; } return; }
    if (e.fase === 'morte') { if (e.faseT >= T_MORTE) aposMorte(); return; }
    if (e.fase === 'vitoria') { if (e.faseT >= T_VITORIA) iniciarNivel(e.nivel + 1); return; }
    if (e.fase !== 'jogo') return;
    const dtB = e.lento ? dt * 0.5 : dt;
    // Relógio do bônus: cai 100 a cada 2 segundos
    e.relogioBonus += dt;
    while (e.relogioBonus >= 2) {
      e.relogioBonus -= 2; e.bonus = Math.max(0, e.bonus - 100);
      if (e.bonus < 1000 && !e.alertou) { e.alertou = true; som('alerta'); }
      if (e.bonus <= 0) { morrer('tempo'); return; }
    }
    moverCoelho(dt, ent || VAZIO);
    if (e.fase !== 'jogo') return;
    raposoArremessa(dtB);
    for (let i = e.barris.length - 1; i >= 0; i--) if (!moverBarril(e.barris[i], dtB)) e.barris.splice(i, 1);
    for (const f of e.fagulhas) moverFagulha(f, dtB);
    if (e.coelho.marreta > 0) usarMarreta(dt);
    pontosDePulo();
    pegarCoisas();
    if (tocouInimigo()) morrer('barril');
  }

  if (J) iniciarJunto(); else iniciarNivel(1);

  const jogo = {
    get pontos() { return e.pontos; },
    get acabou() { return e.acabou; },
    atualizar,
    desenhar(g, t) { if (J) desenharCenaJunto(g, t || 0); else desenharCena(g, e, t || 0, fx); },
    resumo() {
      const s = e.salvas;
      return {
        titulo: s > 0 ? 'Coelho valente!' : 'O Raposo venceu!',
        linhas: [
          `Chegou ao nível ${e.nivel}.`,
          s ? `Resgatou a Princesa Cenoura ${s} ${s === 1 ? 'vez' : 'vezes'}.` : 'A Princesa Cenoura ainda espera por você.',
          `Barris pulados: ${e.pulados}. Quebrados com a marreta: ${e.quebrados}.`,
        ],
        detalhe: `Nível ${e.nivel}, ${s} ${s === 1 ? 'resgate' : 'resgates'}`,
      };
    },
    foto() {
      const c = e.coelho;
      const r = e.raposo;
      return {
        n: e.nivel, v: e.vidas, p: Math.floor(e.pontos), b: e.bonus, e: e.espelho ? 1 : 0,
        s: FASES.indexOf(e.fase), t: Math.round(e.faseT * 10), q: e.causa === 'tempo' ? 1 : 0,
        c: [Math.round(c.x), Math.round(c.y), ESTADOS.indexOf(c.estado), c.dir, Math.ceil(c.marreta * 10), e.coroa ? 1 : 0,
          Math.round(c.passo * 20) % 2000, c.andando ? 1 : 0, Math.round(c.marretaT * 10) % 1000],
        r: e.barris.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.ang * 10) % 63, b.modo === 'escada' ? 1 : 0]),
        f: e.fagulhas.map(f => [Math.round(f.x), Math.round(f.y)]),
        m: (e.marretasPegas[0] ? 1 : 0) | (e.marretasPegas[1] ? 2 : 0),
        i: (e.itensPegos[0] ? 1 : 0) | (e.itensPegos[1] ? 2 : 0) | (e.itensPegos[2] ? 4 : 0),
        k: [r.arremesso < 0 ? -1 : Math.round(r.arremesso * 20), r.tipo === 'tonel' ? 1 : 0],
        a: e.aceso ? 1 : 0,
      };
    },
    usarSegredo(chave) {
      if (J || chave !== 'barris-marreta' || e.usouMarreta) return false;
      const c = e.coelho;
      if ((e.fase !== 'jogo' && e.fase !== 'pronto') || c.estado === 'escada' || c.estado === 'morte') return false;
      e.usouMarreta = true; c.marreta = DURACAO_MARRETA; c.marretaT = 0;
      som('poder');
      mostrar('Marreta!', c.x, c.y - 40, OURO);
      return true;
    },
    mudouSegredo(chave, ligado) {
      if (chave === 'barris-coroa') e.coroa = !!ligado;
      if (chave === 'barris-lento') e.lento = !!ligado;
    },
  };
  // Para os testes: o estado por dentro (não aparece em Object.keys nem no JSON).
  Object.defineProperty(jogo, '_e', { value: e, enumerable: false });
  Object.defineProperty(jogo, '_j', { value: jj, enumerable: false });
  return jogo;
}

export default {
  id: 'barris',
  nome: 'Barris do Raposo',
  icone: 'barril',
  sub: 'Desvie dos barris do Raposo, suba as vigas e resgate a Princesa Cenoura.',
  subDesafio: 'Todos enfrentam os mesmos barris: quem fizer mais pontos antes de perder as vidas vence.',
  subJunto: {
    versus: 'Todos na mesma torre, com os mesmos barris: quem chegar primeiro à Princesa Cenoura vence. Cada um tem 3 vidas.',
    coop: 'Todos na mesma torre: basta um chegar à princesa para a equipe passar de nível. São 3 níveis e as vidas são da equipe.',
  },
  largura: W,
  altura: H,
  cor: '#0a120d',
  controles: { cima: true, baixo: true, pular: 'Pular', acao: null },
  instrucoes: {
    teclado: 'Setas ou WASD para andar e subir escadas, Espaço (ou Z) para pular os barris. P pausa.',
    toque: 'Use as setas para andar e subir escadas e o botão Pular para saltar os barris.',
  },
  comoJogar: [
    ['🐰', 'Coelho', 'suba as escadas até a Princesa Cenoura, lá no alto.'],
    ['🛢️', 'Barris', 'o Raposo joga barris vigas abaixo. Pule por cima de um: +100.'],
    ['🔨', 'Marreta', 'quebra barris e fagulhas por 8 s (300, 500 ou 800). Com ela não dá para pular nem subir.'],
    ['🔥', 'Fagulhas', 'saem do tonel de piche e passeiam pelas vigas. Pule ou esmague.'],
    ['🧺', 'Prendas', 'cesta, chapéu e guarda-chuva valem pontos extras.'],
    ['⏱️', 'Bônus', 'começa em 5000 e cai com o tempo. Chegando na princesa ele vira pontos; se zerar, perde uma vida.'],
    ['❤️', 'Vidas', 'são 3, e mais uma aos 10000 pontos.'],
  ],
  criar,
  desenharFoto(g, foto, t) {
    if (!foto) return;
    if (foto !== ultimaFoto) { ultimaFoto = foto; ultimaCena = cenaDaFoto(foto); }
    desenharCena(g, ultimaCena, t || 0, null);
  },
};
