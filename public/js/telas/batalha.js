// Batalha da Toca (estilo Free Fire): a tela do jogo. O servidor roda a partida (src/junto-batalha.js);
// aqui o navegador manda os comandos (uns 20 por segundo) e desenha os quadros: o meu coelho anda na hora
// (previsto aqui e acertado com o servidor) e os outros aparecem um tiquinho atrasados, entre dois quadros.
// Cada quadro só traz o que está perto de mim (o mapa vem uma vez só; os itens, quando aparecem).
// Sem sala: a tela de começo (jogar com os robôs ou chamar o pessoal).

import { h, trocar, icone, botao, cabecalho, aoSair } from '../core.js';
import { rt, ouvir, enviar, criarPartida } from '../tempo-real.js';
import { juntoNoJogo, CORES_JUNTO } from '../junto.js';
import { abrirJunto } from './junto.js';
import { desenharCoelho, elipse, sombrear, sorte } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, aoMudarSprites } from '../sprites.js';

/* ─── As mesmas regras do servidor (src/junto-batalha.js) ─── */

const MUNDO = 2400;
const T = 40;
const G = MUNDO / T;
const MAR = 0, AREIA = 1, GRAMA = 2, RIO = 3, PONTE = 4;
const BALDE = 120;
const NB = MUNDO / BALDE;
const RAIO = 14;
const VEL = 210;
const ATRASO_MS = 100;
const ARMAS = [
  { id: 'estilingue', nome: 'Estilingue', f: false, vel: 1100, pente: 12, mun: 0, dica: 'pistola: certeira e rápida de recarregar' },
  { id: 'besta', nome: 'Besta', f: true, vel: 1400, pente: 20, mun: 1, dica: 'fuzil: boa em qualquer distância' },
  { id: 'escopeta', nome: 'Escopeta', f: true, vel: 950, pente: 5, mun: 2, dica: 'espalha 7 balins: fortíssima de perto' },
  { id: 'arco', nome: 'Arco longo', f: false, vel: 2100, pente: 4, mun: 3, dica: 'de longe: 80 de dano e você enxerga mais longe' },
  { id: 'metralhadora', nome: 'Metralhadora de bolotas', f: true, vel: 1050, pente: 30, mun: 0, dica: 'automática: segure para atirar sem parar' },
];
const MUNICOES = ['Bolotas', 'Virotes', 'Cartuchos', 'Flechas'];
const CAP_MUN = [90, 60, 20, 12];
const COR_RARIDADE = ['#b8b8b8', '#6fcf6f', '#5aa0e8', '#b77be6', '#f0b232'];
const RARIDADE_M = ['comum', 'incomum', 'raro', 'épico', 'lendário'];
const RARIDADE_F = ['comum', 'incomum', 'rara', 'épica', 'lendária'];
const ARMA = 0, MUN = 1, BAND = 2, POC = 3, GRAN = 4, MOCH = 5;
const AVIAO = 0, CAINDO = 1, VIVO = 2, FORA = 3;
const OBSTACULOS = ['arvore', 'pedra', 'caixa', 'parede', 'janela', 'moinho', 'torre', 'feno'];
const CAUSA = [...ARMAS.map(a => a.nome), 'Granada de cenoura', 'área segura', 'Patada', 'saiu'];
const COR_TERRENO = ['#1d5079', '#d6bf86', '#4b7a37', '#3d80ad', '#8a6239'];
const CHAVE_TERRENO = ['batalha.mar', 'batalha.areia', 'batalha.grama', 'batalha.agua', 'batalha.ponte'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nomeArma = (t, r) => `${ARMAS[t].nome} ${(ARMAS[t].f ? RARIDADE_F : RARIDADE_M)[r]}`;
function nomeItem(it) {
  const [, , , k, t, rq] = it;
  if (k === ARMA) return nomeArma(t, rq);
  if (k === MUN) return `${rq} ${MUNICOES[t]}`;
  if (k === BAND) return rq > 1 ? `${rq} Bandagens` : 'Bandagem';
  if (k === POC) return 'Poção de escudo';
  if (k === GRAN) return rq > 1 ? `${rq} Granadas de cenoura` : 'Granada de cenoura';
  return 'Mochila';
}

/* ─── Desenhos (cada um com a âncora em 0, 0; o jogo põe no lugar, gira e espelha) ─── */

function linha(g, x0, y0, x1, y1, cor, larg = 2) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}
function retangulo(g, x, y, w, h, cor, borda) {
  g.fillStyle = cor;
  g.fillRect(x, y, w, h);
  if (borda) { g.strokeStyle = borda; g.lineWidth = 1.5; g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); }
}

// As armas apontam para a direita, com o cabo em 0, 0.
function pintarArma(g, t) {
  g.lineCap = 'round';
  switch (t) {
    case 0: // Estilingue
      retangulo(g, -5, -2.5, 12, 5, '#8a5a2e');
      linha(g, 6, 0, 14, -7, '#8a5a2e', 3.5);
      linha(g, 6, 0, 14, 7, '#8a5a2e', 3.5);
      g.strokeStyle = '#c0392b';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(14, -7); g.lineTo(9, 0); g.lineTo(14, 7); g.stroke();
      elipse(g, 9, 0, 2.2, 2.2, '#9a9a9a');
      break;
    case 1: // Besta
      retangulo(g, -8, -2.5, 30, 5, '#7a5230', '#4e3219');
      g.strokeStyle = '#5b3c22';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(17, -14); g.quadraticCurveTo(25, 0, 17, 14); g.stroke();
      g.strokeStyle = '#e8e0c8';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(17, -14); g.lineTo(11, 0); g.lineTo(17, 14); g.stroke();
      linha(g, 11, 0, 29, 0, '#6d6d6d', 1.6);
      break;
    case 2: // Escopeta
      retangulo(g, -9, -3.5, 13, 7, '#7a5230', '#4e3219');
      retangulo(g, 3, -3.4, 28, 3, '#5d636b');
      retangulo(g, 3, 0.4, 28, 3, '#4a4f56');
      retangulo(g, 9, -4.5, 8, 9, '#6b4423');
      break;
    case 3: // Arco longo
      g.strokeStyle = '#6b4423';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(6, -22); g.quadraticCurveTo(17, 0, 6, 22); g.stroke();
      linha(g, 6, -22, 6, 22, '#efe6cf', 0.8);
      linha(g, -2, 0, 30, 0, '#9a7a4a', 1.5);
      g.fillStyle = '#b8b8b8';
      g.beginPath(); g.moveTo(34, 0); g.lineTo(28, -3); g.lineTo(28, 3); g.closePath(); g.fill();
      g.fillStyle = '#d8674a';
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(-6, -3); g.lineTo(2, 0); g.lineTo(-6, 3); g.closePath(); g.fill();
      break;
    default: // Metralhadora de bolotas
      retangulo(g, -6, -4, 26, 8, '#4a5560', '#2e353c');
      retangulo(g, 20, -1.6, 11, 3.2, '#2e353c');
      retangulo(g, -2, 3, 4, 7, '#3a2a1a');
      elipse(g, 10, 7, 5, 5.5, '#8a5a2e');
      elipse(g, 10, 3.5, 5.5, 2.4, '#5b3c22');
      break;
  }
}

function pintarMunicao(g, t) {
  retangulo(g, -9, -7, 18, 14, ['#6b4a2a', '#5a4632', '#7a2f2f', '#4a5a3a'][t], '#2c2214');
  if (t === 0) for (const [x, y] of [[-4, -1], [0, 2], [4, -1]]) { elipse(g, x, y, 2.4, 2.8, '#c08a4a'); elipse(g, x, y - 2, 2.6, 1.2, '#5b3c22'); }
  else if (t === 1) for (const y of [-3, 0, 3]) linha(g, -6, y, 6, y, '#d8d0b8', 1.4);
  else if (t === 2) for (const x of [-4, 0, 4]) { retangulo(g, x - 1.5, -4, 3, 7, '#d84a3a'); retangulo(g, x - 1.5, 2, 3, 2, '#d8b13a'); }
  else for (const y of [-3, 0, 3]) { linha(g, -7, y, 6, y, '#c8a878', 1.2); linha(g, -7, y, -9, y - 2, '#d8674a', 1); }
}
function pintarBandagem(g) {
  retangulo(g, -9, -6, 18, 12, '#f4efe2', '#9a9b74');
  retangulo(g, -1.5, -4.5, 3, 9, '#d8433a');
  retangulo(g, -4.5, -1.5, 9, 3, '#d8433a');
}
function pintarPocao(g, t = 0) {
  elipse(g, 0, 3, 8, 8, '#3a86d8');
  elipse(g, -2, 1, 3, 3, 'rgba(255,255,255,0.45)');
  retangulo(g, -2.5, -10, 5, 6, '#9fd3e6');
  retangulo(g, -3, -13, 6, 3, '#8a5a2e');
  g.globalAlpha *= 0.35 + 0.2 * Math.sin(t * 4);
  elipse(g, 0, 3, 11, 11, '#7ec8ff');
  g.globalAlpha = 1;
}
function pintarMochila(g) {
  retangulo(g, -9, -10, 18, 20, '#7a5a34', '#3e2b17');
  retangulo(g, -9, -10, 18, 7, '#94703f', '#3e2b17');
  retangulo(g, -2, -4, 4, 4, '#d8b13a');
  linha(g, -6, 10, -6, 4, '#3e2b17', 1.5);
  linha(g, 6, 10, 6, 4, '#3e2b17', 1.5);
}
function pintarGranada(g) {
  g.fillStyle = '#e8822a';
  g.beginPath(); g.moveTo(-5, -4); g.quadraticCurveTo(0, -7, 5, -4); g.lineTo(1, 10); g.lineTo(-1, 10); g.closePath(); g.fill();
  linha(g, -3, 0, 1, 0, '#b85a14', 1);
  linha(g, -2, 4, 1, 4, '#b85a14', 1);
  for (const [x, a] of [[-2, -0.5], [0, 0], [2, 0.5]]) { g.save(); g.translate(x, -5); g.rotate(a); elipse(g, 0, -4, 1.6, 4.5, '#4f9a3a'); g.restore(); }
}

// Os tiros apontam para a direita, com a ponta em 0, 0.
function pintarBala(g, t) {
  if (t === 0) elipse(g, 0, 0, 3.2, 3.2, '#a8a8a8');
  else if (t === 1) { linha(g, -14, 0, 0, 0, '#5b3c22', 2); linha(g, -3, 0, 0, 0, '#cfcfcf', 2.4); }
  else if (t === 2) elipse(g, 0, 0, 2.2, 2.2, '#f4dd80');
  else if (t === 3) { linha(g, -26, 0, 0, 0, '#9a7a4a', 1.6); linha(g, -26, 0, -30, -3, '#d8674a', 1.4); linha(g, -26, 0, -30, 3, '#d8674a', 1.4); }
  else { elipse(g, 0, 0, 3, 3.6, '#a8743a'); elipse(g, -2.2, 0, 1.4, 3.8, '#5b3c22'); }
}

function pintarArvore(g, v = 0) {
  const verde = ['#2f6b34', '#3a7a3c', '#2b5e2f', '#40803a'][v % 4];
  elipse(g, 4, 6, 40, 34, 'rgba(0,0,0,0.25)');
  elipse(g, 0, 0, 40, 36, verde);
  elipse(g, -12, -10, 22, 19, sombrear(verde, 0.12));
  elipse(g, 12, -16, 15, 12, sombrear(verde, 0.22));
  elipse(g, 14, 10, 16, 13, sombrear(verde, -0.12));
  if (v % 3 === 0) for (const [x, y] of [[-14, 6], [6, -4], [18, -2]]) elipse(g, x, y, 2.6, 2.6, '#e8822a');
}
function pintarTronco(g) {
  elipse(g, 0, 0, 16, 16, '#5b3c22');
  elipse(g, 0, 0, 10, 10, '#7a5230');
}
function pintarPedra(g, v = 0) {
  g.fillStyle = '#7d7f7a';
  g.beginPath();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const r = 24 + ((v * 7 + k * 5) % 6) - 2;
    if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = '#4f514c';
  g.lineWidth = 2;
  g.stroke();
  elipse(g, -6, -8, 9, 6, '#9a9c96');
  linha(g, 2, -2, 10, 8, '#5d5f5a', 1.5);
}
function pintarCaixa(g) {
  retangulo(g, -22, -22, 44, 44, '#a0703c', '#5b3c1c');
  retangulo(g, -22, -22, 44, 6, '#b8854a');
  linha(g, -18, -14, 18, 18, '#6b4423', 3);
  linha(g, 18, -14, -18, 18, '#6b4423', 3);
}
function pintarParede(g) { // um pedaço de 40 x 14
  retangulo(g, -20, -7, 40, 14, '#8a6a48', '#4e3a26');
  linha(g, -6, -7, -6, 7, '#5e4630', 1);
  linha(g, 10, -7, 10, 7, '#5e4630', 1);
}
function pintarJanela(g) {
  retangulo(g, -20, -7, 40, 14, 'rgba(159, 211, 230, 0.55)', '#4e3a26');
  linha(g, 0, -7, 0, 7, '#4e3a26', 1.5);
}
function pintarMoinho(g, t = 0) {
  elipse(g, 0, 0, 46, 46, '#9a8f7e');
  elipse(g, 0, 0, 38, 38, '#b8ab94');
  elipse(g, 0, 0, 12, 12, '#6b4423');
  g.save();
  g.rotate(t * 1.2);
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 2);
    retangulo(g, 8, -6, 62, 12, 'rgba(239, 227, 195, 0.9)', '#6b4423');
    linha(g, 8, 0, 70, 0, '#6b4423', 1.5);
  }
  g.restore();
  elipse(g, 0, 0, 6, 6, '#3e2b17');
}
function pintarTorre(g) {
  retangulo(g, -30, -30, 60, 60, '#8a8a80', '#4f4f48');
  for (const [x, y] of [[-30, -30], [14, -30], [-30, 14], [14, 14]]) retangulo(g, x, y, 16, 16, '#a0a096', '#4f4f48');
  elipse(g, 0, 0, 10, 10, '#4f4f48');
}
function pintarFeno(g) {
  elipse(g, 0, 0, 20, 20, '#d9b44a');
  g.strokeStyle = '#a8862a';
  g.lineWidth = 1.5;
  for (const r of [7, 13, 18]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
}
function pintarCasaTerreno(g, t, v = 0) { // uma casa de 40 x 40 centrada
  g.fillStyle = COR_TERRENO[t];
  g.fillRect(-20, -20, 40, 40);
  const r = (v * 9301 + 49297) % 233280 / 233280;
  if (t === GRAMA) {
    g.fillStyle = r < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(-20, -20, 40, 40);
    for (let k = 0; k < 3; k++) linha(g, -14 + ((v + k * 13) % 28), 6 - ((v * 3 + k * 7) % 22), -12 + ((v + k * 13) % 28), 2 - ((v * 3 + k * 7) % 22), '#5f9446', 1.2);
  } else if (t === AREIA) {
    for (let k = 0; k < 4; k++) elipse(g, -15 + ((v * 5 + k * 11) % 30), -15 + ((v * 7 + k * 17) % 30), 1, 1, '#b8a06a');
  } else if (t === RIO || t === MAR) {
    linha(g, -12 + r * 8, -6 + r * 10, 0 + r * 8, -6 + r * 10, 'rgba(255,255,255,0.18)', 1.5);
  } else if (t === PONTE) {
    for (let y = -20; y < 20; y += 8) linha(g, -20, y, 20, y, '#5e4128', 1);
  }
}
function pintarPiso(g) {
  retangulo(g, -20, -20, 40, 40, '#9b7a52');
  for (let y = -20; y < 20; y += 10) linha(g, -20, y, 20, y, '#7d5f3d', 1);
}

// O balão dos Coelhos (visto de lado); o centro do balão em 0, 0.
function pintarBalao(g, t = 0) {
  const balanco = Math.sin(t * 1.5) * 3;
  g.save();
  g.translate(0, balanco);
  for (const [dx] of [[-20], [20]]) linha(g, dx * 1.2, 50, dx * 0.6, 84, '#3e2b17', 1.5);
  retangulo(g, -16, 82, 32, 22, '#8a5a2e', '#3e2b17');
  elipse(g, 0, 0, 64, 70, '#e8822a');
  g.save();
  g.beginPath();
  g.ellipse(0, 0, 64, 70, 0, 0, Math.PI * 2);
  g.clip();
  for (let k = -3; k <= 3; k += 2) elipse(g, k * 19, 0, 8, 72, '#f4efe2');
  g.restore();
  elipse(g, -22, -30, 14, 18, 'rgba(255,255,255,0.18)');
  g.fillStyle = '#4f9a3a';
  for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(0, -66); g.rotate(a); elipse(g, 0, -10, 6, 14, '#4f9a3a'); g.restore(); }
  g.restore();
}
// O paraquedas (os fios terminam em 0, 0).
function pintarParaquedas(g, t = 0) {
  const b = Math.sin(t * 3) * 0.06;
  g.save();
  g.rotate(b);
  for (const x of [-26, -9, 9, 26]) linha(g, x, -46, 0, -6, 'rgba(240,230,200,0.8)', 1);
  g.beginPath();
  g.moveTo(-30, -46);
  g.quadraticCurveTo(0, -84, 30, -46);
  g.closePath();
  g.fillStyle = '#e8822a';
  g.fill();
  g.save();
  g.clip();
  for (const x of [-20, 0, 20]) retangulo(g, x - 5, -90, 10, 50, '#f4efe2');
  g.restore();
  g.restore();
}
function pintarExplosao(g, k) {
  const r = 30 + 90 * k;
  g.save();
  g.globalAlpha *= 1 - k;
  elipse(g, 0, 0, r, r, '#f0a030');
  elipse(g, 0, 0, r * 0.65, r * 0.65, '#f4dd80');
  for (let n = 0; n < 7; n++) {
    const a = n * 0.9;
    elipse(g, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 5, 3, '#e8822a', a);
  }
  g.restore();
}

// Os Raposos (os robôs), em pé e de lado, olhando para a direita, com o pé em 0, 0.
function pintarRaposo(g, { pelo = '#d8743a', anim = 'parado', t = 0 } = {}) {
  if (anim === 'caido') {
    g.save();
    elipse(g, 0, 1, 20, 5, 'rgba(0,0,0,0.25)');
    g.translate(0, -8);
    g.rotate(-Math.PI / 2);
    pintarRaposo(g, { pelo: sombrear(pelo, -0.25), anim: 'parado', t: 0 });
    g.restore();
    linha(g, -26, -11, -22, -7, '#1b1403', 1.5);
    linha(g, -26, -7, -22, -11, '#1b1403', 1.5);
    return;
  }
  const andando = anim === 'andando';
  const pulo = andando ? Math.abs(Math.sin(t * 9)) * 3 : Math.sin(t * 2) * 0.6;
  elipse(g, 0, 1, 13, 4, 'rgba(0,0,0,0.28)');
  g.save();
  g.translate(0, -pulo);
  const escuro = sombrear(pelo, -0.45);
  elipse(g, -13, -16, 11, 5.5, pelo, -0.7);
  elipse(g, -20, -23, 4.5, 3.4, '#fbf3e6', -0.7);
  const pata = andando ? Math.sin(t * 9) * 3 : 0;
  g.fillStyle = escuro;
  g.fillRect(-5 + pata, -9, 4, 9);
  g.fillRect(2 - pata, -9, 4, 9);
  elipse(g, 0, -18, 9.5, 11, pelo);
  elipse(g, 3, -16, 5.5, 7.5, '#fbf3e6');
  g.fillStyle = '#8b1e1e';
  g.fillRect(-7, -28, 14, 3.5);
  g.beginPath(); g.moveTo(-6, -27); g.lineTo(-12, -22); g.lineTo(-8, -24); g.closePath(); g.fill();
  elipse(g, 3, -34, 8.5, 7.5, pelo);
  g.fillStyle = pelo;
  g.beginPath(); g.moveTo(8, -37); g.lineTo(18, -32); g.lineTo(8, -29); g.closePath(); g.fill();
  elipse(g, 18, -32, 1.6, 1.4, '#1b1403');
  elipse(g, 8, -31, 4.5, 2.8, '#fbf3e6');
  for (const ox of [-2, 5]) {
    g.fillStyle = pelo;
    g.beginPath(); g.moveTo(ox - 3.5, -39); g.lineTo(ox, -50); g.lineTo(ox + 3.5, -39); g.closePath(); g.fill();
    g.fillStyle = escuro;
    g.beginPath(); g.moveTo(ox - 1.8, -40); g.lineTo(ox, -46); g.lineTo(ox + 1.8, -40); g.closePath(); g.fill();
  }
  elipse(g, 7, -36, 1.6, 1.8, '#f4dd80');
  elipse(g, 7.4, -36, 0.7, 1.4, '#1b1403');
  linha(g, 4, -39, 9, -38, escuro, 1.2); // a sobrancelha de vilão
  if (anim === 'atirando') elipse(g, 9, -20, 6, 3, pelo, -0.1);
  else elipse(g, 4, -16, 3, 5, sombrear(pelo, -0.12));
  g.restore();
}

const pecaArma = (t, desc) => ({
  chave: `batalha.${ARMAS[t].id}`, jogo: 'Batalha da Toca', nome: ARMAS[t].nome, desc,
  largura: 44, altura: 48, ancora: 'centro',
  animacoes: [{ id: 'chao', nome: 'No chão', quadros: 1, fps: 1 }, { id: 'mao', nome: 'Na mão', quadros: 1, fps: 1 }],
  previa: g => pintarArma(g, t),
});
const peca = (chave, nome, desc, largura, altura, animacoes, previa, ancora = 'centro') => ({
  chave: `batalha.${chave}`, jogo: 'Batalha da Toca', nome, desc, largura, altura, ancora, animacoes, previa,
});
const parado = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];

export const SPRITES = [
  pecaArma(0, 'O Estilingue (a pistola). Apontando para a direita, com o cabo no centro: o jogo gira para onde o coelho mira. "No chão" aparece no saque.'),
  pecaArma(1, 'A Besta (o fuzil). Apontando para a direita, com o cabo no centro.'),
  pecaArma(2, 'A Escopeta, de dois canos. Apontando para a direita, com o cabo no centro.'),
  pecaArma(3, 'O Arco longo (o de mira longe). Apontando para a direita, com a flecha armada.'),
  pecaArma(4, 'A Metralhadora de bolotas (automática). Apontando para a direita, com o cabo no centro.'),
  peca('municao', 'Munição', 'A caixinha de munição no chão: bolotas (Estilingue e Metralhadora), virotes (Besta), cartuchos (Escopeta) e flechas (Arco).', 22, 18,
    MUNICOES.map((nome, k) => ({ id: ['leve', 'pesada', 'cartucho', 'flecha'][k], nome, quadros: 1, fps: 1 })),
    (g, anim) => pintarMunicao(g, Math.max(0, ['leve', 'pesada', 'cartucho', 'flecha'].indexOf(anim)))),
  peca('bandagem', 'Bandagem', 'Cura 40 de vida aos poucos (4 segundos).', 22, 16, parado, g => pintarBandagem(g)),
  peca('pocao', 'Poção de escudo', 'Dá 50 de escudo (o escudo apanha antes da vida).', 24, 30, [{ id: 'brilhando', nome: 'Brilhando', quadros: 4, fps: 6 }], (g, a, t) => pintarPocao(g, t)),
  peca('mochila', 'Mochila', 'Dobra o quanto dá para carregar de munição, curas e granadas.', 22, 24, parado, g => pintarMochila(g)),
  peca('granada', 'Granada de cenoura', 'No chão ("Parada") e voando (o jogo gira).', 18, 26,
    [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }, { id: 'voando', nome: 'Voando', quadros: 4, fps: 12 }], (g, a, t) => { if (a === 'voando') g.rotate(t * 12); pintarGranada(g); }),
  peca('bala', 'Tiros', 'O que cada arma atira, apontando para a direita com a ponta no centro.', 32, 12,
    [{ id: 'pedra', nome: 'Pedrinha (Estilingue)', quadros: 1, fps: 1 }, { id: 'virote', nome: 'Virote (Besta)', quadros: 1, fps: 1 },
      { id: 'balim', nome: 'Balim (Escopeta)', quadros: 1, fps: 1 }, { id: 'flecha', nome: 'Flecha (Arco)', quadros: 1, fps: 1 },
      { id: 'bolota', nome: 'Bolota (Metralhadora)', quadros: 1, fps: 1 }],
    (g, anim) => pintarBala(g, Math.max(0, ['pedra', 'virote', 'balim', 'flecha', 'bolota'].indexOf(anim)))),
  peca('arvore', 'Copa da árvore', 'A copa, vista de cima (90 x 90), desenhada por cima dos coelhos. O tronco embaixo bloqueia tiros. Com vários quadros, cada árvore usa um.', 90, 90, parado, (g, a, t) => pintarArvore(g, 1)),
  peca('pedra', 'Pedra', 'Bloqueia passagem e tiros. O jogo aumenta ou diminui conforme o tamanho da pedra.', 54, 54, parado, g => pintarPedra(g, 1)),
  peca('caixa', 'Caixote', 'Caixote de madeira (44 x 44): bom esconderijo.', 44, 44, parado, g => pintarCaixa(g)),
  peca('parede', 'Parede', 'Um pedaço de parede das casas (40 x 14), repetido ao longo da parede.', 40, 14, parado, g => pintarParede(g)),
  peca('janela', 'Janela', 'Um pedaço de janela (40 x 14): não passa gente, mas passa tiro.', 40, 14, parado, g => pintarJanela(g)),
  peca('moinho', 'Moinho', 'O moinho visto de cima, com as pás girando.', 150, 150, [{ id: 'girando', nome: 'Girando', quadros: 8, fps: 8 }], (g, a, t) => pintarMoinho(g, t)),
  peca('torre', 'Torre do castelo', 'As torres dos cantos do Castelo Velho (60 x 60).', 60, 60, parado, g => pintarTorre(g)),
  peca('feno', 'Fardo de feno', 'Os fardos em volta do Moinho.', 40, 40, parado, g => pintarFeno(g)),
  peca('piso', 'Piso das casas', 'O chão de dentro das casas (40 x 40), repetido.', 40, 40, parado, g => pintarPiso(g)),
  peca('grama', 'Grama', 'Uma casa de grama do mapa (40 x 40). Com vários quadros, cada casa usa um.', 40, 40, parado, g => pintarCasaTerreno(g, GRAMA, 3)),
  peca('areia', 'Areia', 'Uma casa de areia, na beira da ilha.', 40, 40, parado, g => pintarCasaTerreno(g, AREIA, 3)),
  peca('agua', 'Rio', 'Uma casa do rio (dá para atravessar, mas devagar).', 40, 40, parado, g => pintarCasaTerreno(g, RIO, 3)),
  peca('mar', 'Mar', 'Uma casa do mar em volta da ilha (não dá para entrar).', 40, 40, parado, g => pintarCasaTerreno(g, MAR, 3)),
  peca('ponte', 'Ponte e píer', 'Uma casa de ponte (sobre o rio) ou do píer do Porto.', 40, 40, parado, g => pintarCasaTerreno(g, PONTE, 3)),
  peca('balao', 'Balão', 'O balão que cruza a ilha no começo (de onde todos pulam). O centro do balão fica no meio.', 140, 220, [{ id: 'voando', nome: 'Voando', quadros: 4, fps: 4 }], (g, a, t) => { g.scale(0.85, 0.85); g.translate(0, -18); pintarBalao(g, t); }),
  peca('paraquedas', 'Paraquedas', 'Aberto em cima de quem está caindo; os fios terminam no centro de baixo.', 64, 84, [{ id: 'aberto', nome: 'Aberto', quadros: 2, fps: 3 }], (g, a, t) => { g.translate(0, 30); pintarParaquedas(g, t); }, 'pe'),
  peca('raposo', 'Raposo (robô)', 'Os robôs da batalha: Raposos em pé, de lado, olhando para a direita, com o pé embaixo. A arma o jogo desenha por cima. Marque "pintar com a cor do jogador" para cada Raposo ter o seu pelo.', 44, 56,
    [{ id: 'parado', nome: 'Parado', quadros: 2, fps: 3 }, { id: 'andando', nome: 'Andando', quadros: 4, fps: 10 },
      { id: 'atirando', nome: 'Atirando', quadros: 2, fps: 10 }, { id: 'caido', nome: 'Caído', quadros: 1, fps: 1 }],
    (g, anim, t) => { g.translate(0, 26); pintarRaposo(g, { anim, t }); }, 'pe'),
  peca('explosao', 'Explosão', 'A explosão da granada de cenoura (acontece uma vez, do começo ao fim).', 240, 240, [{ id: 'explodindo', nome: 'Explodindo', quadros: 6, fps: 10 }], (g, a, t) => pintarExplosao(g, (t * 1.6) % 1)),
];
registrarPecas(SPRITES);

/* ─── O mapa (vem do servidor uma vez) e as colisões (iguais às do servidor) ─── */

function montarMapa(mp) {
  const ter = new Uint8Array(G * G);
  for (let k = 0; k < ter.length; k++) ter[k] = mp.ter.charCodeAt(k) - 48;
  const ob = mp.ob.map(([k, x, y, a, b]) => (b === undefined ? { k, c: true, x, y, r: a, bala: k !== 4, marca: 0 } : { k, c: false, x, y, w: a, h: b, bala: k !== 4, marca: 0 }));
  const m = { ter, ob, casas: mp.casas || [], lugares: mp.lugares || [], decor: mp.decor || [], nomes: mp.nomes || [], pelos: mp.pelos || [], eq: mp.eq || [], balao: mp.balao, marca: 0 };
  m.baldes = Array.from({ length: NB * NB }, () => []);
  for (const o of ob) {
    const [x0, y0, x1, y1] = o.c ? [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r] : [o.x, o.y, o.x + o.w, o.y + o.h];
    for (let by = balde(y0); by <= balde(y1); by++) for (let bx = balde(x0); bx <= balde(x1); bx++) m.baldes[by * NB + bx].push(o);
  }
  return m;
}
const balde = v => clamp(Math.floor(v / BALDE), 0, NB - 1);
function terreno(m, x, y) {
  const cx = Math.floor(x / T);
  const cy = Math.floor(y / T);
  if (cx < 0 || cy < 0 || cx >= G || cy >= G) return MAR;
  return m.ter[cy * G + cx];
}
const pisavel = (m, x, y) => terreno(m, x - 9, y - 9) !== MAR && terreno(m, x + 9, y - 9) !== MAR
  && terreno(m, x - 9, y + 9) !== MAR && terreno(m, x + 9, y + 9) !== MAR;
function cadaObstaculo(m, x0, y0, x1, y1, fn) {
  const marca = ++m.marca;
  for (let by = balde(y0); by <= balde(y1); by++) {
    for (let bx = balde(x0); bx <= balde(x1); bx++) {
      for (const o of m.baldes[by * NB + bx]) {
        if (o.marca === marca) continue;
        o.marca = marca;
        if (fn(o) === false) return;
      }
    }
  }
}
function desencostar(m, x, y, r) {
  for (let it = 0; it < 3; it++) {
    let mexeu = false;
    cadaObstaculo(m, x - r, y - r, x + r, y + r, o => {
      if (o.c) {
        const dx = x - o.x;
        const dy = y - o.y;
        const d = Math.hypot(dx, dy);
        const min = o.r + r;
        if (d >= min) return;
        if (d < 1e-6) x += min;
        else { x = o.x + (dx / d) * min; y = o.y + (dy / d) * min; }
        mexeu = true;
        return;
      }
      const px = clamp(x, o.x, o.x + o.w);
      const py = clamp(y, o.y, o.y + o.h);
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = px + (dx / d) * r;
        y = py + (dy / d) * r;
      } else {
        const e = x - o.x, di = o.x + o.w - x, c = y - o.y, b = o.y + o.h - y;
        const mn = Math.min(e, di, c, b);
        if (mn === e) x = o.x - r; else if (mn === di) x = o.x + o.w + r; else if (mn === c) y = o.y - r; else y = o.y + o.h + r;
      }
      mexeu = true;
    });
    if (!mexeu) break;
  }
  return [x, y];
}
// O mesmo passo do servidor (src/junto-batalha.js, mover).
function andar(m, p, mx, my, vel, dt) {
  const x0 = p.x;
  const y0 = p.y;
  let nx = clamp(p.x + mx * vel * dt, RAIO, MUNDO - RAIO);
  if (!pisavel(m, nx, p.y)) nx = p.x;
  let ny = clamp(p.y + my * vel * dt, RAIO, MUNDO - RAIO);
  if (!pisavel(m, nx, ny)) ny = p.y;
  [nx, ny] = desencostar(m, nx, ny, RAIO);
  if (!pisavel(m, nx, ny)) { nx = x0; ny = y0; }
  p.x = nx;
  p.y = ny;
}

// O fundo (terreno, pisos e enfeites) desenhado uma vez numa imagem; o mini-mapa, numa menor.
function pintarFundo(m, escala) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(MUNDO * escala);
  const g = c.getContext('2d');
  g.scale(escala, escala);
  g.fillStyle = COR_TERRENO[MAR];
  g.fillRect(0, 0, MUNDO, MUNDO);
  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      const t = m.ter[cy * G + cx];
      const x = cx * T + T / 2;
      const y = cy * T + T / 2;
      const v = cx * 7 + cy * 13;
      if (desenharSprite(g, CHAVE_TERRENO[t], 'parado', x, y, { quadro: v })) continue;
      g.save();
      g.translate(x, y);
      pintarCasaTerreno(g, t, v);
      g.restore();
    }
  }
  // Areia molhada na beira do mar.
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      if (m.ter[cy * G + cx] !== MAR) continue;
      const vizinho = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const t = m.ter[(cy + dy) * G + cx + dx]; return t === AREIA; });
      if (vizinho) g.fillRect(cx * T, cy * T, T, T);
    }
  }
  for (const [x, y, w, hh] of m.casas) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, hh);
    g.clip();
    for (let yy = y; yy < y + hh; yy += 40) {
      for (let xx = x; xx < x + w; xx += 40) {
        if (!desenharSprite(g, 'batalha.piso', 'parado', xx + 20, yy + 20)) { g.save(); g.translate(xx + 20, yy + 20); pintarPiso(g); g.restore(); }
      }
    }
    g.restore();
  }
  for (const [k, x, y] of m.decor) {
    if (k === 0) { // horta de cenouras
      for (let r = 0; r < 3; r++) { retangulo(g, x - 40, y - 18 + r * 14, 80, 8, '#6b4a2a'); for (let c2 = 0; c2 < 6; c2++) elipse(g, x - 34 + c2 * 13, y - 16 + r * 14, 2.5, 3, '#4f9a3a'); }
    } else if (k === 1) { // canteiro de flores
      for (let n = 0; n < 14; n++) elipse(g, x - 40 + (n * 37) % 80, y - 12 + (n * 23) % 24, 3, 3, ['#e05a8a', '#f4dd80', '#f4efe2'][n % 3]);
    } else if (k === 2) { // a toca funda
      elipse(g, x, y, 34, 22, '#2a1d12');
      elipse(g, x, y + 3, 26, 15, '#120c07');
    } else { // florzinhas soltas
      elipse(g, x, y, 2.4, 2.4, ['#f4efe2', '#f4dd80', '#e05a8a'][(x + y) % 3]);
    }
  }
  return c;
}

/* ─── O jogo ─── */

export function telaBatalha() {
  const jt = juntoNoJogo('batalha', { aoLargar: () => ganchos.largar?.(), aoAcabar: s => ganchos.acabar?.(s) });
  if (!jt) return telaComeco();
  return telaJogo(jt);
}
const ganchos = {};

function telaJogo(jt) {
  const toque = matchMedia('(pointer: coarse)').matches;
  const coop = jt.modo === 'coop';
  const tela = h('canvas', { class: 'bt-tela', 'aria-label': 'Batalha da Toca' });
  const g = tela.getContext('2d');
  const miniTela = h('canvas', { class: 'bt-mini', title: 'Mapa (M)' });
  const mg = miniTela.getContext('2d');
  const mapaTela = h('canvas', { class: 'bt-mapa-grande' });
  const mapaCaixa = h('div', { class: 'bt-mapa-caixa', hidden: true, onclick: () => { mapaCaixa.hidden = true; } }, mapaTela, h('p', { class: 'bt-mapa-dica' }, 'Toque para fechar (M).'));
  const vivosEl = h('strong', null, '-');
  const abatesEl = h('strong', null, '0');
  const zonaEl = h('div', { class: 'bt-zona' });
  const feedEl = h('ol', { class: 'bt-feed' });
  const avisoEl = h('div', { class: 'bt-aviso', hidden: true });
  const dicaEl = h('div', { class: 'bt-dica', hidden: true });
  const vidaEl = h('div', { class: 'bt-barra bt-vida' }, h('span'), h('em'));
  const escudoEl = h('div', { class: 'bt-barra bt-escudo' }, h('span'), h('em'));
  const armasEl = h('div', { class: 'bt-armas' });
  const coisasEl = h('div', { class: 'bt-coisas' });
  const fimEl = h('div', { class: 'bt-fim', hidden: true });
  const comecoEl = h('div', { class: 'bt-preparo' }, h('h2', null, 'Prepare-se!'), h('p', null, 'O balão vai cruzar a ilha. Pule quando quiser cair.'));
  const palco = h('div', { class: `bt-palco ${toque ? 'bt-toque' : ''}`.trim() });

  let mapa = null;
  let fundo = null;
  let miniFundo = null;
  const itens = new Map();
  const quadros = [];
  let base = Infinity;
  let ultimo = null;
  let acabou = false;
  let animacao = 0;
  let pediuMapaEm = 0;
  const numeros = [];
  const feedVisto = new Map();
  const visual = jt.jogadores.map(p => ({ pelo: p.visual?.pelo || '#e9dcc3', roupa: p.visual?.roupa || null }));
  const nomeDe = i => (i === jt.eu ? 'Você' : i < jt.n ? jt.jogadores[i]?.nome || 'Coelho' : mapa?.nomes?.[i] || 'Raposo');

  // O que eu estou apertando.
  const teclas = new Set();
  const cmd = { mx: 0, my: 0, a: 0, at: false, d: 300 };
  const acoes = [];
  let pegarId = null;
  let sq = 0;
  const hist = [];
  const pred = { x: 0, y: 0, ativo: false };
  let mouse = null;
  let atirandoMouse = false;
  const joy = { mov: null, mira: null };

  /* Quadros do servidor */

  function receber(q) {
    if (!q || typeof q !== 'object') return;
    const agora = performance.now();
    if (q.mapa) {
      mapa = montarMapa(q.mapa);
      itens.clear();
      refazerFundo();
    }
    if (Array.isArray(q.ir)) for (const id of q.ir) itens.delete(id);
    if (Array.isArray(q.it)) for (const it of q.it) itens.set(it[0], it);
    if (Array.isArray(q.dn)) for (const [x, y, d] of q.dn) numeros.push({ x, y, d, ate: agora + 900 });
    if (Array.isArray(q.kf)) for (const f of q.kf) if (!feedVisto.has(f[0])) { feedVisto.set(f[0], agora); novoNoFeed(f); }
    if (!mapa && Array.isArray(q.l) && agora - pediuMapaEm > 2000) { pediuMapaEm = agora; acoes.push('mapa'); }
    const t = (Number(q.t) || 0) * 1000;
    if (q.s === 'jogando' && Array.isArray(q.l)) base = Math.min(agora - t, base + 2);
    if (Array.isArray(q.l)) {
      const ult = quadros[quadros.length - 1];
      if (!ult || t > ult.t) quadros.push({ t, q });
      else if (t === ult.t) quadros[quadros.length - 1] = { t, q };
      if (quadros.length > 30) quadros.shift();
      if (q.eu) acertarPrevisao(q);
    }
    ultimo = q;
    if (q.s === 'fim' || q.fim) mostrarFim(q);
  }

  // O servidor disse onde estou depois do comando sq: corrige a previsão aos poucos.
  function acertarPrevisao(q) {
    const eu = q.eu;
    const minha = q.l.find(l => l[0] === jt.eu);
    if (!minha || eu.es !== VIVO) { pred.ativo = false; hist.length = 0; return; }
    if (!pred.ativo) { pred.x = minha[1]; pred.y = minha[2]; pred.ativo = true; hist.length = 0; return; }
    const k = hist.findIndex(x => x.sq === eu.sq);
    if (k < 0) {
      if (Math.hypot(minha[1] - pred.x, minha[2] - pred.y) > 160) { pred.x = minha[1]; pred.y = minha[2]; hist.length = 0; }
      return;
    }
    const ex = minha[1] - hist[k].x;
    const ey = minha[2] - hist[k].y;
    hist.splice(0, k + 1);
    if (Math.hypot(ex, ey) > 140) {
      pred.x += ex; pred.y += ey;
      for (const x of hist) { x.x += ex; x.y += ey; }
    } else if (Math.hypot(ex, ey) > 2) {
      pred.x += ex * 0.3; pred.y += ey * 0.3;
      for (const x of hist) { x.x += ex * 0.3; x.y += ey * 0.3; }
    }
  }

  function novoNoFeed([, m, v, a]) {
    if (m === jt.eu && v !== jt.eu) mostrarAviso(`Você eliminou ${nomeDe(v)}!`, 1800, 'bom');
  }

  /* Comandos: 20 por segundo para o servidor */

  function enviarComando() {
    if (acabou || !jt.largou()) return;
    const eu = ultimo?.eu;
    const noJogo = eu && eu.es <= VIVO;
    if (!noJogo && !acoes.length) return;
    lerControles();
    sq++;
    if (pred.ativo) {
      hist.push({ sq: sq - 1, x: pred.x, y: pred.y });
      if (hist.length > 40) hist.shift();
    }
    const ev = { tipo: 'in', sq, mx: Math.round(cmd.mx * 100) / 100, my: Math.round(cmd.my * 100) / 100, a: Math.round(cmd.a * 100) / 100, at: cmd.at ? 1 : 0, d: Math.round(cmd.d) };
    if (acoes.length) ev.ac = acoes.splice(0, 6);
    if (pegarId != null) { ev.id = pegarId; pegarId = null; }
    jt.evento(ev);
  }

  function lerControles() {
    let mx = 0;
    let my = 0;
    if (joy.mov) { mx = joy.mov.dx; my = joy.mov.dy; } else {
      if (teclas.has('KeyA') || teclas.has('ArrowLeft')) mx -= 1;
      if (teclas.has('KeyD') || teclas.has('ArrowRight')) mx += 1;
      if (teclas.has('KeyW') || teclas.has('ArrowUp')) my -= 1;
      if (teclas.has('KeyS') || teclas.has('ArrowDown')) my += 1;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    cmd.mx = mx;
    cmd.my = my;
    const cam = camera.ultima;
    if (joy.mira) {
      if (joy.mira.forca > 0.15) cmd.a = Math.atan2(joy.mira.dy, joy.mira.dx);
      cmd.at = joy.mira.forca > 0.4;
      cmd.d = 120 + joy.mira.forca * 260;
    } else if (mouse && cam) {
      const r = tela.getBoundingClientRect();
      const px = (mouse.x - r.left) * (tela.width / r.width);
      const py = (mouse.y - r.top) * (tela.height / r.height);
      const [ex, ey] = paraTela(cam.euX, cam.euY);
      cmd.a = Math.atan2(py - ey, px - ex);
      cmd.d = Math.hypot(px - ex, py - ey) / cam.z;
      cmd.at = atirandoMouse;
    } else if (!toque) cmd.at = atirandoMouse;
    if (!joy.mira && toque && Math.hypot(mx, my) > 0.2 && !cmd.at) cmd.a = Math.atan2(my, mx);
  }

  function acao(a) {
    if (acabou) return;
    if (a === 'pegar') {
      const it = itemPerto();
      if (it) pegarId = it[0];
    }
    if (acoes.length < 6) acoes.push(a);
  }

  /* O estado na hora do desenho (entre dois quadros) */

  function amostra(agora) {
    if (!quadros.length) return null;
    const alvoT = base === Infinity ? quadros[quadros.length - 1].t : agora - base - ATRASO_MS;
    let ia = quadros.length - 1;
    let b = null;
    if (base !== Infinity && !acabou) {
      ia = 0;
      for (let j = quadros.length - 1; j >= 0; j--) if (quadros[j].t <= alvoT) { ia = j; b = quadros[j + 1] || null; break; }
    }
    const a = quadros[ia];
    const k = b ? clamp((alvoT - a.t) / (b.t - a.t || 1), 0, 1) : 0;
    return { a: a.q, b: b?.q || null, k, tA: a.t, alvoT };
  }

  function entidades(am) {
    const doB = new Map((am.b?.l || []).map(l => [l[0], l]));
    return am.a.l.map(l => {
      const o = doB.get(l[0]);
      let x = l[1];
      let y = l[2];
      let a = l[3] / 50;
      if (o && Math.hypot(o[1] - x, o[2] - y) < 200) {
        x += (o[1] - x) * am.k;
        y += (o[2] - y) * am.k;
        let da = o[3] / 50 - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a += da * am.k;
      }
      const andando = o ? Math.hypot(o[1] - l[1], o[2] - l[2]) > 1 : false;
      return { i: l[0], x, y, a, es: l[4], arma: l[5], vida: l[6], escudo: l[7], flags: l[8], andando };
    });
  }

  /* Desenho */

  const camera = { x: MUNDO / 2, y: MUNDO / 2, z: 1, ultima: null };
  let dpr = 1;
  function paraTela(x, y) { return [(x - camera.x) * camera.z + tela.width / 2, (y - camera.y) * camera.z + tela.height / 2]; }

  function refazerFundo() {
    if (!mapa) return;
    fundo = pintarFundo(mapa, 0.5);
    miniFundo = pintarFundo(mapa, 0.1);
  }
  aoSair(aoMudarSprites(() => refazerFundo()));

  function ajustarTamanho() {
    const r = tela.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(r.width * dpr));
    const hh = Math.max(200, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    const mr = miniTela.getBoundingClientRect();
    const mw = Math.max(60, Math.round(mr.width * dpr));
    if (miniTela.width !== mw) { miniTela.width = mw; miniTela.height = mw; }
  }

  let antes = performance.now();
  let ultimoHud = 0;
  function laco(agora) {
    animacao = requestAnimationFrame(laco);
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    try {
      ajustarTamanho();
      if (pred.ativo && mapa && ultimo?.eu?.es === VIVO && !acabou) {
        lerControles();
        const vel = VEL * (terreno(mapa, pred.x, pred.y) === RIO ? 0.55 : 1) * (ultimo.eu.cu > 0 ? 0.7 : 1);
        andar(mapa, pred, cmd.mx, cmd.my, vel, dt);
      }
      desenhar(agora);
      if (agora - ultimoHud > 100) { ultimoHud = agora; atualizarHud(agora); desenharMini(); }
    } catch (err) {
      console.error('Batalha da Toca:', err); // um erro não pode travar o jogo
    }
  }

  function desenhar(agora) {
    const W = tela.width;
    const H = tela.height;
    const tSeg = agora / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COR_TERRENO[MAR];
    g.fillRect(0, 0, W, H);
    const am = amostra(agora);
    if (!am || !mapa) { comecoEl.hidden = false; return; }
    comecoEl.hidden = !(ultimo?.eu?.es === AVIAO && !jt.largou());
    const q = am.a;
    const ents = entidades(am);
    const eu = ents.find(e => e.i === jt.eu);
    const euQ = ultimo?.eu;
    // Onde a câmera fica: no meu coelho (previsto), em quem estou assistindo, ou no balão.
    let euX;
    let euY;
    if (pred.ativo) { euX = pred.x; euY = pred.y; } else if (eu) { euX = eu.x; euY = eu.y; }
    const seguido = ents.find(e => e.i === q.ob);
    let balao = null;
    if (q.ba) {
      const bb = am.b?.ba;
      balao = bb ? [q.ba[0] + (bb[0] - q.ba[0]) * am.k, q.ba[1] + (bb[1] - q.ba[1]) * am.k] : q.ba;
    }
    if (euX != null && (euQ?.es === VIVO || euQ?.es === CAINDO)) { camera.x = euX; camera.y = euY; } else if (euQ?.es === AVIAO && balao) { camera.x = balao[0]; camera.y = balao[1]; } else if (seguido) { camera.x = seguido.x; camera.y = seguido.y; } else if (balao) { camera.x = balao[0]; camera.y = balao[1]; }
    const comArco = euQ && euQ.w?.[euQ.a]?.[0] === 3 && euQ.es === VIVO;
    camera.z = Math.max(W, H) / (comArco ? 1950 : 1500);
    camera.ultima = { euX: euX ?? camera.x, euY: euY ?? camera.y, z: camera.z };
    const z = camera.z;
    const vx0 = camera.x - W / 2 / z;
    const vy0 = camera.y - H / 2 / z;
    const vx1 = camera.x + W / 2 / z;
    const vy1 = camera.y + H / 2 / z;
    g.setTransform(z, 0, 0, z, W / 2 - camera.x * z, H / 2 - camera.y * z);
    if (fundo) {
      const s = fundo.width / MUNDO;
      const sx = clamp(vx0, 0, MUNDO);
      const sy = clamp(vy0, 0, MUNDO);
      const ex = clamp(vx1, 0, MUNDO);
      const ey = clamp(vy1, 0, MUNDO);
      if (ex > sx && ey > sy) g.drawImage(fundo, sx * s, sy * s, (ex - sx) * s, (ey - sy) * s, sx, sy, ex - sx, ey - sy);
    }
    // Obstáculos de baixo (tudo menos as copas e as pás do moinho).
    const vistos = [];
    cadaObstaculo(mapa, vx0 - 80, vy0 - 80, vx1 + 80, vy1 + 80, o => { vistos.push(o); });
    for (const o of vistos) desenharObstaculo(o, tSeg);
    // Itens no chão.
    for (const it of itens.values()) {
      if (it[1] < vx0 - 30 || it[1] > vx1 + 30 || it[2] < vy0 - 30 || it[2] > vy1 + 30) continue;
      desenharItem(it, tSeg);
    }
    // Granadas voando.
    for (const [x, y, t] of q.gr || []) {
      const alto = Math.sin(clamp(1 - t / 0.9, 0, 1) * Math.PI) * 26;
      elipse(g, x, y + 4, 6, 2.5, 'rgba(0,0,0,0.3)');
      g.save();
      g.translate(x, y - alto);
      g.rotate(tSeg * 12);
      if (!desenharSprite(g, 'batalha.granada', 'voando', 0, 0, { t: tSeg })) pintarGranada(g);
      g.restore();
    }
    // Os lutadores, de cima para baixo.
    const ordem = [...ents].sort((a, b) => a.y - b.y);
    for (const e of ordem) {
      const meu = e.i === jt.eu && pred.ativo;
      desenharLutador(e, meu ? pred.x : e.x, meu ? pred.y : e.y, meu ? cmd.a : e.a, tSeg, meu);
    }
    // Tiros (andam com a velocidade da arma a partir do quadro).
    const passou = Math.max(0, (am.alvoT - am.tA) / 1000);
    for (const [x, y, an, t, resta] of q.b || []) {
      if (t === 7) continue;
      const a = an / 50;
      const v = ARMAS[t]?.vel || 1000;
      const anda = Math.min(passou * v, resta ?? 9999);
      const bx = x + Math.cos(a) * anda;
      const by = y + Math.sin(a) * anda;
      g.save();
      g.translate(bx, by);
      g.rotate(a);
      if (!desenharSprite(g, 'batalha.bala', ['pedra', 'virote', 'balim', 'flecha', 'bolota'][t], 0, 0)) {
        linha(g, -18, 0, 0, 0, 'rgba(255, 240, 200, 0.35)', 2);
        pintarBala(g, t);
      }
      g.restore();
    }
    // Copas das árvores e pás do moinho por cima (a copa fica clarinha se eu estiver embaixo).
    for (const o of vistos) {
      if (o.k === 0) {
        const perto = euX != null && Math.hypot(euX - o.x, euY - o.y) < 46;
        g.save();
        g.globalAlpha = perto ? 0.35 : 0.95;
        if (!desenharSprite(g, 'batalha.arvore', 'parado', o.x, o.y, { quadro: o.x + o.y })) { g.translate(o.x, o.y); pintarArvore(g, o.x + o.y); }
        g.restore();
      } else if (o.k === 5) {
        g.save();
        if (!desenharSprite(g, 'batalha.moinho', 'girando', o.x, o.y, { t: tSeg })) { g.translate(o.x, o.y); pintarMoinho(g, tSeg); }
        g.restore();
      }
    }
    // Explosões e os números de dano.
    for (const [x, y, k] of q.ex || []) {
      const kk = clamp(k + (passou || 0), 0, 0.6) / 0.6;
      if (!desenharSprite(g, 'batalha.explosao', 'explodindo', x, y, { progresso: kk, alpha: 1 - kk })) { g.save(); g.translate(x, y); pintarExplosao(g, kk); g.restore(); }
    }
    const agoraMs = agora;
    g.font = 'bold 18px system-ui, sans-serif';
    g.textAlign = 'center';
    for (let n = numeros.length - 1; n >= 0; n--) {
      const d = numeros[n];
      if (d.ate < agoraMs) { numeros.splice(n, 1); continue; }
      const k = 1 - (d.ate - agoraMs) / 900;
      g.globalAlpha = 1 - k * k;
      g.fillStyle = d.d >= 40 ? '#f4dd80' : '#ffffff';
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 3;
      g.strokeText(String(d.d), d.x, d.y - k * 30);
      g.fillText(String(d.d), d.x, d.y - k * 30);
      g.globalAlpha = 1;
    }
    // A área segura: fora dela fica azulado; a próxima é o círculo branco tracejado.
    const zq = q.z;
    if (zq) {
      g.save();
      g.beginPath();
      g.rect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20);
      g.arc(zq[0], zq[1], Math.max(0, zq[2]), 0, Math.PI * 2, true);
      g.fillStyle = 'rgba(70, 110, 230, 0.26)';
      g.fill('evenodd');
      g.strokeStyle = '#7ec8ff';
      g.lineWidth = 4 / z;
      g.beginPath();
      g.arc(zq[0], zq[1], Math.max(0, zq[2]), 0, Math.PI * 2);
      g.stroke();
      if (zq[7] !== 2 && zq[5] < zq[2]) {
        g.setLineDash([18 / z, 12 / z]);
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.lineWidth = 3 / z;
        g.beginPath();
        g.arc(zq[3], zq[4], Math.max(0, zq[5]), 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      g.restore();
    }
    // O balão e a linha por onde ele passa.
    if (balao && mapa.balao) {
      const [x0, y0, x1, y1] = mapa.balao;
      g.save();
      g.setLineDash([24, 18]);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
      elipse(g, balao[0] + 30, balao[1] + 60, 50, 18, 'rgba(0,0,0,0.25)');
      if (!desenharSprite(g, 'batalha.balao', 'voando', balao[0], balao[1] - 60, { t: tSeg })) { g.save(); g.translate(balao[0], balao[1] - 60); pintarBalao(g, tSeg); g.restore(); }
    }
    // Para onde estou mirando (só no computador).
    if (!toque && pred.ativo && mouse) {
      g.save();
      g.globalAlpha = 0.5;
      linha(g, pred.x + Math.cos(cmd.a) * 26, pred.y + Math.sin(cmd.a) * 26, pred.x + Math.cos(cmd.a) * 60, pred.y + Math.sin(cmd.a) * 60, '#f4dd80', 1.5);
      g.restore();
    }
    // Levei tiro: um risco vermelho na borda, do lado de onde veio.
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (euQ && euQ.dor != null) {
      const a = euQ.dor;
      const cx = W / 2 + Math.cos(a) * Math.min(W, H) * 0.32;
      const cy = H / 2 + Math.sin(a) * Math.min(W, H) * 0.32;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = 'rgba(220, 50, 40, 0.55)';
      g.beginPath(); g.moveTo(18 * dpr, 0); g.lineTo(-10 * dpr, -26 * dpr); g.lineTo(-10 * dpr, 26 * dpr); g.closePath(); g.fill();
      g.restore();
    }
    if (euQ && euQ.es === VIVO && zq && Math.hypot((euX ?? 0) - zq[0], (euY ?? 0) - zq[1]) > zq[2]) {
      g.fillStyle = `rgba(70, 110, 230, ${0.12 + 0.08 * Math.sin(tSeg * 6)})`;
      g.fillRect(0, 0, W, H);
    }
    desenharJoysticks();
  }

  function desenharObstaculo(o, t) {
    const nome = OBSTACULOS[o.k];
    if (o.k === 0) { // tronco
      elipse(g, o.x, o.y, o.r, o.r, '#5b3c22');
      elipse(g, o.x, o.y, o.r * 0.6, o.r * 0.6, '#7a5230');
      return;
    }
    if (o.k === 5) { elipse(g, o.x, o.y, o.r, o.r, '#9a8f7e'); return; } // a base; as pás vão por cima
    if (o.c) {
      const esc = o.k === 1 ? o.r / 26 : 1;
      if (desenharSprite(g, `batalha.${nome}`, 'parado', o.x, o.y, { escala: esc, quadro: o.x })) return;
      g.save();
      g.translate(o.x, o.y);
      if (o.k === 1) { g.scale(esc, esc); pintarPedra(g, o.x); } else pintarFeno(g);
      g.restore();
      return;
    }
    if (o.k === 2 || o.k === 6) {
      if (desenharSprite(g, `batalha.${nome}`, 'parado', o.x + o.w / 2, o.y + o.h / 2)) return;
      g.save();
      g.translate(o.x + o.w / 2, o.y + o.h / 2);
      if (o.k === 2) pintarCaixa(g); else pintarTorre(g);
      g.restore();
      return;
    }
    // Paredes e janelas: em pedaços de 40 (dá para trocar por sprite).
    const horiz = o.w >= o.h;
    const comp = horiz ? o.w : o.h;
    const gross = horiz ? o.h : o.w;
    let usouSprite = false;
    g.save();
    g.beginPath();
    g.rect(o.x, o.y, o.w, o.h);
    g.clip();
    for (let s = 0; s < comp; s += 40) {
      const cx = horiz ? o.x + s + 20 : o.x + o.w / 2;
      const cy = horiz ? o.y + o.h / 2 : o.y + s + 20;
      if (desenharSprite(g, `batalha.${nome}`, 'parado', cx, cy, { rot: horiz ? 0 : Math.PI / 2, altura: gross > 16 ? gross : undefined })) usouSprite = true;
      else break;
    }
    g.restore();
    if (usouSprite) return;
    if (o.k === 4) retangulo(g, o.x, o.y, o.w, o.h, 'rgba(159, 211, 230, 0.55)', '#4e3a26');
    else {
      retangulo(g, o.x, o.y, o.w, o.h, gross > 16 ? '#8f8a7c' : '#8a6a48', gross > 16 ? '#55524a' : '#4e3a26');
      g.fillStyle = 'rgba(0,0,0,0.15)';
      if (horiz) g.fillRect(o.x, o.y + o.h - 3, o.w, 3); else g.fillRect(o.x + o.w - 3, o.y, 3, o.h);
    }
  }

  function desenharItem(it, t) {
    const [, x, y, k, tt, rq] = it;
    const cor = k === ARMA ? COR_RARIDADE[rq] : k === POC ? '#5aa0e8' : '#d8b13a';
    g.save();
    g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + x);
    elipse(g, x, y, 17, 17, cor);
    g.globalAlpha = 1;
    g.strokeStyle = cor;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, 17, 0, Math.PI * 2);
    g.stroke();
    g.translate(x, y);
    if (k === ARMA) {
      g.rotate(-0.35);
      g.scale(0.8, 0.8);
      if (!desenharSprite(g, `batalha.${ARMAS[tt].id}`, 'chao', 4, 0)) { g.translate(-10, 0); pintarArma(g, tt); }
    } else if (k === MUN) { if (!desenharSprite(g, 'batalha.municao', ['leve', 'pesada', 'cartucho', 'flecha'][tt], 0, 0)) pintarMunicao(g, tt); }
    else if (k === BAND) { if (!desenharSprite(g, 'batalha.bandagem', 'parado', 0, 0)) pintarBandagem(g); }
    else if (k === POC) { if (!desenharSprite(g, 'batalha.pocao', 'brilhando', 0, 0, { t })) pintarPocao(g, t); }
    else if (k === GRAN) { if (!desenharSprite(g, 'batalha.granada', 'parada', 0, 0)) pintarGranada(g); }
    else if (!desenharSprite(g, 'batalha.mochila', 'parado', 0, 0)) pintarMochila(g);
    g.restore();
  }

  function desenharLutador(e, x, y, a, t, meu) {
    const humano = e.i < jt.n;
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    const caido = e.es === FORA;
    const noAr = e.es === CAINDO;
    const amigo = coop && mapa?.eq && mapa.eq[e.i] === mapa.eq[jt.eu];
    g.save();
    g.translate(x, y);
    if (noAr) {
      elipse(g, 0, 26, 12, 4, 'rgba(0,0,0,0.25)');
      g.translate(0, -18);
      if (!desenharSprite(g, 'batalha.paraquedas', 'aberto', 0, -30, { t })) { g.save(); g.translate(0, -30); pintarParaquedas(g, t); g.restore(); }
    }
    if (caido) g.globalAlpha = 0.75;
    if (humano) {
      const v = visual[e.i] || {};
      g.save();
      if (caido) { g.translate(0, 4); g.rotate(-Math.PI / 2); g.translate(-12, 0); }
      g.translate(0, 13);
      g.scale(0.78, 0.78);
      desenharCoelho(g, 0, 0, { pelo: v.pelo, roupa: v.roupa, dir, andando: e.andando && !caido, passo: t, t });
      g.restore();
    } else {
      const pelo = mapa?.pelos?.[e.i] || '#d8743a';
      const anim = caido ? 'caido' : (e.flags & 1) ? 'atirando' : e.andando ? 'andando' : 'parado';
      if (!desenharSprite(g, 'batalha.raposo', anim, 0, 14, { t, dir, cor: pelo, escala: 0.9 })) {
        g.save();
        g.translate(0, 14);
        g.scale(dir * 0.9, 0.9);
        pintarRaposo(g, { pelo, anim, t });
        g.restore();
      }
    }
    // A arma na mão, virada para a mira.
    if (!caido && !noAr && e.es === VIVO && e.arma >= 0) {
      g.save();
      g.translate(dir * 5, -6);
      g.rotate(a);
      if (dir < 0) g.scale(1, -1);
      g.scale(0.8, 0.8);
      if (!desenharSprite(g, `batalha.${ARMAS[e.arma].id}`, 'mao', 10, 0)) pintarArma(g, e.arma);
      if (e.flags & 1) { elipse(g, 36, 0, 6, 4, 'rgba(255, 220, 120, 0.85)'); }
      g.restore();
    }
    if (e.flags & 8 && !caido) { g.globalAlpha = 0.35; elipse(g, 0, -10, 20, 24, '#ff4a3a'); g.globalAlpha = 1; }
    if (e.flags & 2) { g.globalAlpha = 0.8; g.fillStyle = '#7fe08a'; g.font = 'bold 14px system-ui'; g.textAlign = 'center'; g.fillText('+', 12 + Math.sin(t * 5) * 3, -34 - ((t * 20) % 12)); g.globalAlpha = 1; }
    g.globalAlpha = 1;
    // Nome e vida em cima (o meu não precisa de nome).
    if (!caido) {
      const largura = 36;
      const yb = noAr ? -64 : -46;
      retangulo(g, -largura / 2, yb, largura, 4, 'rgba(0,0,0,0.55)');
      retangulo(g, -largura / 2, yb, (largura * clamp(e.vida, 0, 100)) / 100, 4, e.vida > 35 ? '#7fd06a' : '#e05a4a');
      if (e.escudo > 0) retangulo(g, -largura / 2, yb - 3, (largura * clamp(e.escudo, 0, 100)) / 100, 2.5, '#6aa8f0');
      if (!meu) {
        g.font = '11px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = amigo ? '#9fe08a' : humano ? CORES_JUNTO[e.i % CORES_JUNTO.length] : '#f0c8a0';
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 3;
        const nome = nomeDe(e.i);
        g.strokeText(nome, 0, yb - 6);
        g.fillText(nome, 0, yb - 6);
      }
    }
    g.restore();
  }

  function desenharJoysticks() {
    if (!toque) return;
    for (const j of [joy.mov, joy.mira]) {
      if (!j) continue;
      const r = 55 * dpr;
      g.globalAlpha = 0.35;
      elipse(g, j.ox * dpr, j.oy * dpr, r, r, '#000');
      g.globalAlpha = 0.7;
      elipse(g, (j.ox + j.dx * 55) * dpr, (j.oy + j.dy * 55) * dpr, 24 * dpr, 24 * dpr, j === joy.mira && j.forca > 0.4 ? '#e05a4a' : '#f4dd80');
      g.globalAlpha = 1;
    }
  }

  /* Mini-mapa e mapa grande */

  function desenharMapaEm(c, gg, grande) {
    const W = c.width;
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.fillStyle = COR_TERRENO[MAR];
    gg.fillRect(0, 0, W, W);
    if (!mapa) return;
    const s = W / MUNDO;
    if (miniFundo) gg.drawImage(grande && fundo ? fundo : miniFundo, 0, 0, W, W);
    const q = ultimo;
    if (q?.z) {
      const z = q.z;
      gg.strokeStyle = '#7ec8ff';
      gg.lineWidth = 2;
      gg.beginPath(); gg.arc(z[0] * s, z[1] * s, Math.max(0, z[2]) * s, 0, Math.PI * 2); gg.stroke();
      if (z[7] !== 2) {
        gg.strokeStyle = '#fff';
        gg.setLineDash([4, 3]);
        gg.beginPath(); gg.arc(z[3] * s, z[4] * s, Math.max(0, z[5]) * s, 0, Math.PI * 2); gg.stroke();
        gg.setLineDash([]);
      }
    }
    if (q?.ba && mapa.balao) {
      const [x0, y0, x1, y1] = mapa.balao;
      gg.strokeStyle = 'rgba(255,255,255,0.5)';
      gg.setLineDash([5, 4]);
      gg.beginPath(); gg.moveTo(x0 * s, y0 * s); gg.lineTo(x1 * s, y1 * s); gg.stroke();
      gg.setLineDash([]);
      elipse(gg, q.ba[0] * s, q.ba[1] * s, 4, 4, '#e8822a');
    }
    if (grande) {
      gg.font = `bold ${Math.round(W / 42)}px system-ui, sans-serif`;
      gg.textAlign = 'center';
      for (const [nome, x, y] of mapa.lugares) {
        gg.fillStyle = 'rgba(0,0,0,0.6)';
        gg.fillText(nome, x * s + 1, y * s + 1);
        gg.fillStyle = '#f4dd80';
        gg.fillText(nome, x * s, y * s);
      }
    }
    for (const [i, x, y] of q?.eq || []) { elipse(gg, x * s, y * s, grande ? 6 : 3.5, grande ? 6 : 3.5, '#7fd06a'); if (grande) { gg.fillStyle = '#fff'; gg.fillText(nomeDe(i), x * s, y * s - 9); } }
    const c2 = camera.ultima;
    if (c2 && (q?.eu?.es === VIVO || q?.eu?.es === CAINDO)) {
      gg.save();
      gg.translate(c2.euX * s, c2.euY * s);
      gg.rotate(cmd.a);
      gg.fillStyle = '#f4dd80';
      gg.strokeStyle = '#000';
      gg.lineWidth = 1;
      const r = grande ? 9 : 5;
      gg.beginPath(); gg.moveTo(r * 1.4, 0); gg.lineTo(-r, -r); gg.lineTo(-r * 0.4, 0); gg.lineTo(-r, r); gg.closePath(); gg.fill(); gg.stroke();
      gg.restore();
    }
  }
  function desenharMini() {
    desenharMapaEm(miniTela, mg, false);
    if (!mapaCaixa.hidden) desenharMapaEm(mapaTela, mapaTela.getContext('2d'), true);
  }
  function abrirMapa() {
    mapaCaixa.hidden = !mapaCaixa.hidden;
    if (!mapaCaixa.hidden) {
      const lado = Math.round(Math.min(palco.clientWidth, palco.clientHeight) * 0.92 * dpr);
      mapaTela.width = mapaTela.height = Math.max(200, lado);
      desenharMapaEm(mapaTela, mapaTela.getContext('2d'), true);
    }
  }

  /* O painel por cima do jogo (vida, armas, área segura, avisos) */

  function itemPerto() {
    if (!pred.ativo) return null;
    let melhor = null;
    let md = 64;
    for (const it of itens.values()) {
      const d = Math.hypot(it[1] - pred.x, it[2] - pred.y);
      if (d < md) { md = d; melhor = it; }
    }
    return melhor;
  }

  let avisoAte = 0;
  function mostrarAviso(texto, ms = 2200, tipo = '') {
    avisoEl.textContent = texto;
    avisoEl.className = `bt-aviso ${tipo}`.trim();
    avisoEl.hidden = false;
    avisoAte = performance.now() + ms;
  }

  let chaveHud = '';
  let faseAvisada = -1;
  function atualizarHud(agora) {
    const q = ultimo;
    if (!q) return;
    if (avisoAte && agora > avisoAte) { avisoEl.hidden = true; avisoAte = 0; }
    vivosEl.textContent = String(q.v ?? '-');
    const eu = q.eu;
    abatesEl.textContent = String(eu?.ab ?? 0);
    const z = q.z;
    if (z) {
      const [, , , , , , resta, modo, fase] = z;
      zonaEl.className = `bt-zona ${modo === 1 ? 'fechando' : ''}`.trim();
      zonaEl.textContent = modo === 2 ? 'Área final!' : modo === 1 ? `A área está fechando: ${relogio(resta)}` : `A área fecha em ${relogio(resta)}`;
      if (modo === 1 && faseAvisada !== fase) { faseAvisada = fase; mostrarAviso('A área segura está fechando! Corra para dentro do círculo branco.', 2600, 'alerta'); }
    }
    // O feed de quem caiu.
    const linhas = (q.kf || []).filter(f => agora - (feedVisto.get(f[0]) || 0) < 8000).slice(-5);
    const chaveFeed = linhas.map(f => f[0]).join(',');
    if (chaveFeed !== feedEl.dataset.chave) {
      feedEl.dataset.chave = chaveFeed;
      trocar(feedEl, linhas.map(([, m, v, a]) => h('li', { class: v === jt.eu ? 'eu' : m === jt.eu ? 'meu' : '' },
        a === 6 ? [h('strong', null, nomeDe(v)), ' ficou fora da área']
          : a === 8 ? [h('strong', null, nomeDe(v)), ' saiu']
            : m < 0 || m === v ? [h('strong', null, nomeDe(v)), ' caiu']
              : [h('strong', null, nomeDe(m)), h('em', null, ` ${CAUSA[a] || ''} `), h('strong', null, nomeDe(v))])));
    }
    if (!eu) return;
    const chave = JSON.stringify([eu.v, eu.e, eu.a, eu.w, eu.m, eu.bd, eu.pc, eu.gr, eu.mo, eu.rc > 0, eu.cu > 0, eu.es]);
    if (chave !== chaveHud) {
      chaveHud = chave;
      vidaEl.firstChild.style.width = `${clamp(eu.v, 0, 100)}%`;
      vidaEl.lastChild.textContent = String(eu.v);
      escudoEl.firstChild.style.width = `${clamp(eu.e, 0, 100)}%`;
      escudoEl.lastChild.textContent = String(eu.e);
      escudoEl.hidden = eu.e <= 0;
      trocar(armasEl, [0, 1].map(k => {
        const w = eu.w[k];
        const ativa = k === eu.a;
        return h('button', {
          type: 'button', class: `bt-arma ${ativa ? 'ativa' : ''}`.trim(), style: w ? { '--cor': COR_RARIDADE[w[1]] } : null,
          onclick: () => acao(`arma${k}`), title: w ? `${nomeArma(w[0], w[1])}: ${ARMAS[w[0]].dica}` : 'Mão livre',
        },
        h('small', null, toque ? '' : `${k + 1}`),
        w ? [h('span', null, ARMAS[w[0]].nome), h('strong', null, `${w[2]}`, h('em', null, ` / ${eu.m[ARMAS[w[0]].mun]}`))] : h('span', { class: 'suave' }, 'vazio'),
        ativa && eu.rc > 0 && h('i', null, 'recarregando'));
      }));
      const coisa = (rotulo, n, tecla, a, cls) => h('button', { type: 'button', class: `bt-coisa ${cls}`, disabled: !n, onclick: () => acao(a), title: rotulo },
        h('span', null, rotulo), h('strong', null, String(n)), !toque && h('small', null, tecla));
      trocar(coisasEl,
        coisa('Bandagem', eu.bd, 'Q', 'curar', 'band'),
        coisa('Escudo', eu.pc, 'C', 'escudo', 'poc'),
        coisa('Granada', eu.gr, 'G', 'granada', 'gran'),
        eu.mo ? h('span', { class: 'bt-mochila', title: 'Mochila: carrega o dobro' }, icone('bau')) : null,
        eu.cu > 0 && h('span', { class: 'bt-curando' }, eu.ct === 'poc' ? 'bebendo...' : 'curando...'));
    }
    // A dica de pegar o item mais perto.
    const it = eu.es === VIVO ? itemPerto() : null;
    const textoDica = it ? `${toque ? '' : 'E: '}pegar ${nomeItem(it)}` : '';
    if (dicaEl.textContent !== textoDica) {
      dicaEl.textContent = textoDica;
      dicaEl.hidden = !textoDica;
      if (it) dicaEl.style.setProperty('--cor', it[3] === ARMA ? COR_RARIDADE[it[5]] : '#d8b13a');
    }
    // Avisos do meu estado.
    palco.classList.toggle('bt-no-balao', eu.es === AVIAO);
    palco.classList.toggle('bt-fora', eu.es >= FORA);
    if (eu.es === AVIAO && !avisoAte && jt.largou()) mostrarAviso(toque ? 'Toque em Pular para cair do balão!' : 'Aperte Espaço para pular do balão!', 1500);
    if (eu.es >= FORA && !acabou && !palco.classList.contains('bt-avisou-fora')) {
      palco.classList.add('bt-avisou-fora');
      const mat = eu.mt;
      mostrarAviso(`${mat >= 0 && mat !== jt.eu ? `${nomeDe(mat)} tirou você da batalha` : 'Você ficou fora da batalha'}. ${eu.co ? `${eu.co}º lugar.` : ''} Assistindo...`, 5000, 'alerta');
    }
  }

  /* Fim */

  function mostrarFim(q) {
    if (!fimEl.hidden) return;
    acabou = true;
    const eu = q.eu || {};
    const venc = q.fim?.vencedores || jt.estado()?.vencedores || [];
    const venceu = venc.includes(jt.eu);
    const lugar = eu.co || (venceu ? 1 : null);
    const coopVenceu = coop && venceu;
    fimEl.hidden = false;
    trocar(fimEl, h('div', { class: `bt-fim-caixa ${venceu ? 'venceu' : ''}`.trim() },
      h('h2', null, venceu ? 'Toca Suprema!' : coop && venc.length === 0 && q.fim?.motivo ? 'A equipe caiu' : 'Fim da batalha'),
      h('p', { class: 'bt-fim-sub' }, venceu
        ? (coopVenceu ? 'A equipe foi a última de pé. Os Raposos voltaram para a toca!' : 'Você foi o último de pé. A ilha é sua!')
        : q.fim?.motivo === 'eliminados' ? 'Todas as pessoas ficaram fora. Os Raposos venceram desta vez.'
          : q.fim?.motivo === 'tempo' ? 'O tempo acabou.' : 'Não foi desta vez.'),
      h('div', { class: 'bt-fim-numeros' },
        h('div', null, h('strong', null, lugar ? `${lugar}º` : '-'), h('small', null, 'lugar')),
        h('div', null, h('strong', null, String(eu.ab ?? 0)), h('small', null, eu.ab === 1 ? 'eliminação' : 'eliminações')),
        h('div', null, h('strong', null, String(q.n ?? '')), h('small', null, 'na ilha'))),
      h('div', { class: 'bt-fim-botoes' },
        jt.n === 1 && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: () => jogarComRobos() }),
        h('a', { class: 'btn', href: `#/recreacao/sala/${jt.id}` }, icone('trofeu'), h('span', null, 'Ver a sala')),
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão'))));
  }
  ganchos.acabar = s => {
    const q = ultimo || {};
    mostrarFim({ ...q, fim: q.fim || { motivo: s?.estado?.fim, vencedores: s?.estado?.vencedores || [] } });
  };
  ganchos.largar = () => {};

  /* Teclado, mouse e toque */

  const TECLAS_JOGO = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    if (TECLAS_JOGO.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    teclas.add(e.code);
    switch (e.code) {
      case 'KeyE': acao('pegar'); break;
      case 'KeyR': acao('recarregar'); break;
      case 'Digit1': acao('arma0'); break;
      case 'Digit2': acao('arma1'); break;
      case 'KeyQ': acao('curar'); break;
      case 'KeyC': acao('escudo'); break;
      case 'KeyG': acao('granada'); break;
      case 'Space': acao('pular'); break;
      case 'KeyM': abrirMapa(); break;
      case 'KeyF': telaCheia(); break;
      default:
    }
  };
  const aoSoltar = e => { teclas.delete(e.code); };
  const aoPerderFoco = () => { teclas.clear(); atirandoMouse = false; };
  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('keyup', aoSoltar);
  window.addEventListener('blur', aoPerderFoco);
  tela.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY }; });
  tela.addEventListener('mousedown', e => { if (e.button === 0) { atirandoMouse = true; mouse = { x: e.clientX, y: e.clientY }; } });
  const soltarMouse = e => { if (e.button === 0) atirandoMouse = false; };
  window.addEventListener('mouseup', soltarMouse);
  tela.addEventListener('contextmenu', e => e.preventDefault());
  let rodinhaEm = 0;
  tela.addEventListener('wheel', e => {
    e.preventDefault();
    if (performance.now() - rodinhaEm < 300) return; // o touchpad manda vários de uma vez
    rodinhaEm = performance.now();
    acao('trocar');
  }, { passive: false });

  // Toque: metade esquerda move, metade direita mira e atira (segurando).
  const camada = h('div', { class: 'bt-camada-toque' });
  function joystick(e) {
    const r = camada.getBoundingClientRect();
    return { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0, forca: 0 };
  }
  camada.addEventListener('pointerdown', e => {
    e.preventDefault();
    const r = camada.getBoundingClientRect();
    const esquerda = e.clientX - r.left < r.width / 2;
    if (esquerda && !joy.mov) joy.mov = joystick(e);
    else if (!esquerda && !joy.mira) joy.mira = joystick(e);
    camada.setPointerCapture?.(e.pointerId);
  });
  camada.addEventListener('pointermove', e => {
    const r = camada.getBoundingClientRect();
    for (const j of [joy.mov, joy.mira]) {
      if (!j || j.id !== e.pointerId) continue;
      let dx = (e.clientX - r.left - j.ox) / 55;
      let dy = (e.clientY - r.top - j.oy) / 55;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      j.dx = dx;
      j.dy = dy;
      j.forca = Math.min(1, l);
    }
  });
  const soltarToque = e => {
    if (joy.mov?.id === e.pointerId) joy.mov = null;
    if (joy.mira?.id === e.pointerId) joy.mira = null;
  };
  camada.addEventListener('pointerup', soltarToque);
  camada.addEventListener('pointercancel', soltarToque);

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else palco.requestFullscreen?.().catch(() => {});
  }

  const botaoToque = (texto, a, cls) => h('button', { type: 'button', class: `bt-btoque ${cls}`, onpointerdown: e => { e.preventDefault(); e.stopPropagation(); a(); } }, texto);
  const botoesToque = toque && h('div', { class: 'bt-botoes-toque' },
    botaoToque('Pular', () => acao('pular'), 'pular'),
    botaoToque('Pegar', () => acao('pegar'), 'pegar'),
    botaoToque('Recarregar', () => acao('recarregar'), 'recarregar'),
    botaoToque('Trocar', () => acao('trocar'), 'trocar'),
    botaoToque('Granada', () => acao('granada'), 'granada'));

  const envio = setInterval(enviarComando, 50);
  aoSair(() => {
    cancelAnimationFrame(animacao);
    clearInterval(envio);
    jt.aoQuadro = () => {};
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('keyup', aoSoltar);
    window.removeEventListener('blur', aoPerderFoco);
    window.removeEventListener('mouseup', soltarMouse);
    document.body.classList.remove('bt-jogando');
    if (document.fullscreenElement === palco) document.exitFullscreen?.().catch(() => {});
  });
  document.body.classList.add('bt-jogando');
  jt.aoQuadro = q => { try { receber(q); } catch (e) { console.error('Batalha da Toca:', e); } };
  receber(jt.estado()?.quadro);
  animacao = requestAnimationFrame(laco);

  trocar(palco,
    tela,
    toque && camada,
    h('div', { class: 'bt-topo' },
      h('div', { class: 'bt-placar' },
        h('span', null, icone('usuarios'), ' Vivos ', vivosEl),
        h('span', null, icone('alvo'), ' Eliminações ', abatesEl)),
      zonaEl),
    h('div', { class: 'bt-lado' },
      h('button', { type: 'button', class: 'bt-mini-botao', onclick: abrirMapa, 'aria-label': 'Abrir o mapa' }, miniTela),
      feedEl),
    h('div', { class: 'bt-cantos' },
      h('button', { type: 'button', class: 'bt-icone', onclick: telaCheia, title: 'Tela cheia (F)', 'aria-label': 'Tela cheia' }, icone('frente')),
      !toque && h('button', { type: 'button', class: 'bt-icone', onclick: abrirMapa, title: 'Mapa (M)', 'aria-label': 'Mapa' }, icone('mapa'))),
    avisoEl,
    dicaEl,
    comecoEl,
    h('div', { class: 'bt-base' },
      h('div', { class: 'bt-barras' }, vidaEl, escudoEl),
      armasEl,
      coisasEl),
    botoesToque,
    !toque && h('button', { type: 'button', class: 'bt-pular', onclick: () => acao('pular') }, 'Pular (Espaço)'),
    mapaCaixa,
    fimEl);

  const como = h('section', { class: 'painel bt-como' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
    h('ul', null,
      h('li', null, h('strong', null, 'Pular: '), toque ? 'botão Pular' : 'Espaço', '. Enquanto cai de paraquedas, dá para escolher onde pousar.'),
      toque
        ? h('li', null, h('strong', null, 'Andar e mirar: '), 'o lado esquerdo da tela anda; o direito mira e, empurrando mais, atira sem parar.')
        : h('li', null, h('strong', null, 'Andar: '), 'W A S D ou as setas. ', h('strong', null, 'Mirar: '), 'mouse. ', h('strong', null, 'Atirar: '), 'clique (segure nas automáticas).'),
      h('li', null, h('strong', null, 'Itens: '), toque ? 'Pegar' : 'E pega', ' (munição, curas e granadas entram sozinhas). ', toque ? 'Recarregar e Trocar nos botões.' : 'R recarrega, 1 e 2 trocam de arma (ou a rodinha).'),
      h('li', null, h('strong', null, 'Curar: '), toque ? 'os botões embaixo' : 'Q bandagem, C poção de escudo, G granada de cenoura', '. ', toque ? '' : 'M abre o mapa, F põe em tela cheia.'),
      h('li', null, h('strong', null, 'Área segura: '), 'fora do círculo azul você perde vida, cada vez mais rápido. O círculo branco tracejado é a próxima área.'),
      h('li', null, h('strong', null, 'Raridade: '), COR_RARIDADE.map((c, k) => h('span', { class: 'bt-rar', style: { '--cor': c } }, RARIDADE_F[k])), ' (mais rara, mais dano).')));

  return h('div', { class: 'pagina bt-pagina' },
    cabecalho({
      titulo: `Batalha da Toca: ${coop ? 'co-op' : 'versus'}`, icone: 'espada', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: coop ? 'A equipe cai junta na ilha contra esquadrões de Raposos. Vence se for a última de pé.' : 'Todos caem na ilha: pegue armas, fuja da área que fecha e seja o último de pé.',
    }),
    palco,
    h('div', { class: 'bt-embaixo' }, jt.painel, como));
}

/* ─── Sem sala: jogar com os robôs ou chamar o pessoal ─── */

// Abre uma sala de versus só minha e começa na hora (os robôs completam a ilha).
function jogarComRobos() {
  const minha = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  if (minha && minha.status !== 'fim') { location.hash = `#/recreacao/sala/${minha.id}`; return; }
  // Este ouvinte fica ligado mesmo trocando de tela (a sala abre e o jogo começa sozinho).
  const parar = ouvir('sala', m => {
    const s = m.sala;
    if (!s || s.jogo !== 'junto' || s.opcoes?.jogo !== 'batalha' || s.eu < 0 || s.status !== 'esperando') return;
    parar();
    clearTimeout(desiste);
    enviar('sala:comecar', { id: s.id });
  });
  const desiste = setTimeout(parar, 10_000);
  criarPartida('junto', { jogo: 'batalha', modo: 'versus' });
}

function telaComeco() {
  const minha = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  const naBatalha = minha && minha.jogo === 'junto' && minha.opcoes?.jogo === 'batalha';
  const arte = h('canvas', { class: 'bt-arte', width: 720, height: 300, 'aria-hidden': 'true' });
  pintarArte(arte);
  aoSair(aoMudarSprites(() => pintarArte(arte)));
  const armas = ARMAS.map((a, k) => {
    const c = h('canvas', { width: 96, height: 64, class: 'bt-arma-previa', 'aria-hidden': 'true' });
    const g = c.getContext('2d');
    g.translate(30, 34);
    g.scale(1.5, 1.5);
    if (!desenharSprite(g, `batalha.${a.id}`, 'chao', 6, 0)) pintarArma(g, k);
    return h('li', null, c, h('div', null, h('strong', null, a.nome), h('small', null, a.dica)));
  });
  return h('div', { class: 'pagina bt-pagina' },
    cabecalho({ titulo: 'Batalha da Toca', icone: 'espada', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub: 'Caia na ilha, pegue armas e seja o último de pé. No estilo do Free Fire, com os Raposos completando a partida.' }),
    h('div', { class: 'bt-inicio' },
      h('section', { class: 'painel bt-inicio-arte' }, arte,
        h('div', { class: 'bt-inicio-botoes' },
          naBatalha
            ? h('a', { class: 'btn btn-ouro btn-grande', href: `#/recreacao/sala/${minha.id}` }, icone('frente'), h('span', null, 'Voltar para a minha sala'))
            : botao('Jogar (com robôs)', { icone: 'espada', classe: 'btn-ouro btn-grande', onclick: jogarComRobos, desativado: !!minha && minha.status !== 'fim' }),
          botao('Chamar o pessoal', { icone: 'usuarios', classe: 'btn-grande', onclick: () => abrirJunto('batalha', 'versus'), desativado: !!minha && minha.status !== 'fim' })),
        minha && !naBatalha && minha.status !== 'fim' && h('p', { class: 'suave' }, 'Você já está em outra partida. Termine ou saia dela antes.'),
        h('p', { class: 'suave' }, '12 na ilha: quem faltar vira Raposo (robô). Na sala dá para escolher o co-op, com a equipe toda contra esquadrões de Raposos.')),
      h('section', { class: 'painel' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('espada'), 'As armas')),
        h('ul', { class: 'bt-lista-armas' }, armas),
        h('p', { class: 'suave' }, 'Também tem bandagem (cura aos poucos), poção de escudo, granada de cenoura e mochila (carrega o dobro). A cor do brilho no chão é a raridade: ',
          COR_RARIDADE.map((c, k) => h('span', { class: 'bt-rar', style: { '--cor': c } }, RARIDADE_F[k])), '.')),
      h('section', { class: 'painel' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como funciona')),
        h('ol', { class: 'bt-passos' },
          h('li', null, 'O balão cruza a ilha: pule onde quiser (Vila Cenoura, Moinho, Porto, Castelo Velho, Pomar, Toca Funda...).'),
          h('li', null, 'Pegue armas e itens no chão. Cabem duas armas.'),
          h('li', null, 'A área segura fecha aos poucos: fora dela você perde vida.'),
          h('li', null, 'O último de pé ganha a Toca Suprema!')))));
}

function pintarArte(c) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const ceu = g.createLinearGradient(0, 0, 0, H);
  ceu.addColorStop(0, '#16324a');
  ceu.addColorStop(1, '#2c5a6e');
  g.fillStyle = ceu;
  g.fillRect(0, 0, W, H);
  const rnd = sorte(7);
  for (let k = 0; k < 40; k++) elipse(g, rnd() * W, rnd() * H * 0.5, 1, 1, 'rgba(255,255,255,0.5)');
  elipse(g, W / 2, H + 60, W * 0.62, 150, '#d6bf86');
  elipse(g, W / 2, H + 70, W * 0.56, 130, '#4b7a37');
  for (let k = 0; k < 7; k++) {
    g.save();
    g.translate(60 + k * 105, H - 40 + (k % 2) * 14);
    g.scale(0.5, 0.5);
    pintarArvore(g, k);
    g.restore();
  }
  g.save();
  g.translate(W * 0.72, 110);
  g.scale(0.62, 0.62);
  if (!desenharSprite(g, 'batalha.balao', 'voando', 0, 0, { t: 0.5 })) pintarBalao(g, 0.5);
  g.restore();
  g.save();
  g.translate(W * 0.3, 140);
  if (!desenharSprite(g, 'batalha.paraquedas', 'aberto', 0, -14, { t: 0 })) { g.save(); g.translate(0, -14); pintarParaquedas(g, 0); g.restore(); }
  g.scale(0.7, 0.7);
  desenharCoelho(g, 0, 40, { pelo: '#e9dcc3', t: 0 });
  g.restore();
  g.save();
  g.translate(W * 0.18, H - 34);
  g.scale(1.2, 1.2);
  desenharCoelho(g, 0, 0, { pelo: '#c99a6b', t: 0 });
  g.translate(6, -14);
  g.rotate(-0.1);
  pintarArma(g, 1);
  g.restore();
  g.save();
  g.translate(W * 0.82, H - 30);
  g.scale(-1.2, 1.2);
  if (!desenharSprite(g, 'batalha.raposo', 'atirando', 0, 0, { t: 0 })) pintarRaposo(g, { anim: 'atirando' });
  g.translate(10, -20);
  pintarArma(g, 4);
  g.restore();
}
