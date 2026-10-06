// Região "litoral" da Ilha do Club Coelho (veja clube-ilha.js): a Floresta, a Prainha, o Ancoradouro, a Praia,
// o Farol (com o Mirante lá no topo), o Grande Iceberg e o Saltador, o navio do Capitão Saltarrocha (Convés,
// Ninho do Corvo, Porão e Quartel do Capitão). Os minijogos e as janelas ficam em litoral-jogos.js, que só é
// carregado na hora do clique. Este arquivo não usa nada da página quando é importado: dá para testar no Node.
import { registrarRegiao } from '../clube-ilha.js';
import { desenharCoelho, sorte } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, temSprite } from '../sprites.js';

const W = 1000;
const H = 600;
// Sprite enviado em #/recreacao/sprites para uma peça do litoral (false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `ilha-litoral.${peca}`, anim, x, y, o);

/* ─── Utilidades de desenho ─── */

export function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  g.fill();
}
export function ret(g, x, y, w, h, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}
export function grad(g, x0, y0, x1, y1, paradas) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
export function brilho(g, x, y, r, cor, forca = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, cor.replace('A', String(Math.max(0, forca))));
  gr.addColorStop(1, cor.replace('A', '0'));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
export function texto(g, t, x, y, { cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center', sombra = null } = {}) {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  if (sombra) { g.fillStyle = sombra; g.fillText(t, x + 1.5, y + 1.5); }
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
export function forma(g, cor, pts) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
function linha(g, cor, larg, pts) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
const sombraNoChao = (g, x, y, rx, ry = rx * 0.28) => el(g, x, y, rx, ry, 'rgba(0,0,0,0.22)');
function nuvem(g, x, y, k = 1, cor = 'rgba(255,255,255,0.92)') {
  for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]]) el(g, x + dx * k, y + dy * k, r * k, r * 0.75 * k, cor);
}
function placa(g, x, y, w, h, textoPlaca, { fundo = '#8a6a44', borda = '#5b4228', cor = '#fbf3e0', fonte = '700 15px "Cinzel", Georgia, serif' } = {}) {
  ret(g, x - w / 2, y - h / 2, w, h, fundo, 6);
  g.strokeStyle = borda;
  g.lineWidth = 3;
  g.beginPath();
  if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, 6); else g.rect(x - w / 2, y - h / 2, w, h);
  g.stroke();
  texto(g, textoPlaca, x, y + 1, { cor, fonte });
}
// Placa num poste (as saídas pelas beiradas das salas).
function placaPoste(g, x, y, txt, opcoes = {}) {
  ret(g, x - 3, y - 70, 6, 70, '#6b4a2b');
  placa(g, x, y - 70, Math.max(96, txt.length * 9 + 20), 28, txt, { fonte: '700 13px "Cinzel", Georgia, serif', ...opcoes });
}
// O tapete de saída embaixo, no meio (como no Café e na Loja).
function tapeteSaida(g, txt = 'Saída', cor = '#7a2f2f') {
  ret(g, 420, 568, 160, 30, cor, 6);
  texto(g, txt, 500, 584, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
}
function ceu(g, y1, cores) {
  g.fillStyle = grad(g, 0, 0, 0, y1, cores);
  g.fillRect(0, 0, W, y1);
}
function sol(g, x, y, r, cor = '#fff4c2', halo = 'rgba(255,240,180,A)') {
  brilho(g, x, y, r * 2.8, halo, 0.6);
  el(g, x, y, r, r, cor);
}
function estrelas(g, y1, n, semente = 3) {
  const rnd = sorte(semente);
  for (let k = 0; k < n; k++) el(g, rnd() * W, rnd() * y1, 0.8 + rnd(), 0.8 + rnd(), `rgba(255,255,240,${(0.3 + rnd() * 0.6).toFixed(2)})`);
}
// O mar parado do fundo (o brilho que se mexe vem em brilhoDoMar).
export function mar(g, y0, y1, cima = '#4aa3c9', baixo = '#1f6f9a', x0 = 0, x1 = W) {
  g.fillStyle = grad(g, 0, y0, 0, y1, [[0, cima], [1, baixo]]);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rnd = sorte(21);
  for (let k = 0; k < 50; k++) {
    const f = rnd();
    ret(g, x0 + rnd() * (x1 - x0), y0 + 3 + f * (y1 - y0 - 6), 10 + f * 38, 1 + f * 1.6, 'rgba(255,255,255,0.14)', 1);
  }
}
// As faixas de luz que deslizam na água.
export function brilhoDoMar(g, t, y0, y1, n = 18, vel = 16, x0 = 0, x1 = W) {
  for (let k = 0; k < n; k++) {
    const f = ((k * 37) % 100) / 100;
    const y = y0 + f * (y1 - y0);
    const x = x0 + ((k * 173 + t * vel * (0.5 + f)) % (x1 - x0 + 120)) - 60;
    const a = 0.12 + 0.1 * Math.sin(t * 2 + k);
    ret(g, x, y, 16 + f * 40, 1.5 + f * 2, `rgba(255,255,255,${a.toFixed(3)})`, 1);
  }
}
// A onda que chega na areia: água rasa e a espuma, subindo e descendo.
export function espuma(g, t, y, amp = 10, x0 = 0, x1 = W, fase = 0) {
  const yy = y + Math.sin(t * 0.9 + fase) * amp;
  g.fillStyle = 'rgba(90,180,215,0.45)';
  g.beginPath();
  g.moveTo(x0, y - amp - 6);
  g.lineTo(x1, y - amp - 6);
  for (let x = x1; x >= x0; x -= 20) g.lineTo(x, yy + Math.sin(x * 0.04 + t * 1.5 + fase) * 4);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.moveTo(x0, yy);
  for (let x = x0; x <= x1; x += 20) g.lineTo(x, yy + Math.sin(x * 0.04 + t * 1.5 + fase) * 4);
  for (let x = x1; x >= x0; x -= 20) g.lineTo(x, yy - 5 + Math.sin(x * 0.07 + t * 1.2 + fase) * 2);
  g.closePath();
  g.fill();
}

/* ─── Peças que se repetem ─── */

// A gaivota (x, y: o meio do corpo). k: o tamanho.
export function gaivota(g, x, y, t, k = 1) {
  if (sp(g, 'gaivota', 'voando', x, y, { t, escala: k })) return;
  corpoGaivota(g, x, y, t, k);
}
function corpoGaivota(g, x, y, t, k = 1) {
  const a = Math.sin(t * 8) * 7 * k;
  g.lineCap = 'round';
  g.strokeStyle = '#f7f7f2';
  g.lineWidth = 3 * k;
  g.beginPath();
  g.moveTo(x - 15 * k, y - a);
  g.quadraticCurveTo(x - 7 * k, y - 7 * k - a * 0.3, x, y);
  g.quadraticCurveTo(x + 7 * k, y - 7 * k - a * 0.3, x + 15 * k, y - a);
  g.stroke();
  g.strokeStyle = '#5b5f66';
  g.lineWidth = 2 * k;
  g.beginPath(); g.moveTo(x - 15 * k, y - a); g.lineTo(x - 12 * k, y - a * 0.9 - 2 * k); g.stroke();
  g.beginPath(); g.moveTo(x + 15 * k, y - a); g.lineTo(x + 12 * k, y - a * 0.9 - 2 * k); g.stroke();
  el(g, x, y + k, 4 * k, 2.4 * k, '#f7f7f2');
  el(g, x + 4.5 * k, y + 0.5 * k, 1.8 * k, 1 * k, '#f0a030');
}
export function gaivotas(g, t, n, y0, y1, vel = 40, k = 1) {
  for (let i = 0; i < n; i++) {
    const x = ((t * vel * (0.7 + i * 0.17) + i * 290) % (W + 200)) - 100;
    const y = y0 + ((i * 53) % Math.max(1, y1 - y0)) + Math.sin(t * 0.9 + i) * 12;
    gaivota(g, x, y, t + i * 0.37, k * (0.8 + (i % 3) * 0.15));
  }
}
export function pinheiro(g, x, y, h, cor = '#2f5d3a', escura = '#24492d', neve = false) {
  ret(g, x - h * 0.04, y - h * 0.2, h * 0.08, h * 0.22, '#5b3c22');
  for (let k = 0; k < 4; k++) {
    const yb = y - h * 0.14 - k * h * 0.2;
    const w = h * 0.34 * (1 - k * 0.2);
    forma(g, k % 2 ? cor : escura, [x - w, yb, x + w, yb, x, yb - h * 0.34]);
    if (neve) forma(g, 'rgba(255,255,255,0.85)', [x - w * 0.35, yb - h * 0.22, x + w * 0.35, yb - h * 0.22, x, yb - h * 0.34]);
  }
}
function pedra(g, x, y, r, cor = '#8d8a84') {
  el(g, x, y, r, r * 0.7, cor);
  el(g, x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.3, 'rgba(255,255,255,0.18)');
}
// Tábuas de madeira em perspectiva (deque, convés, porão).
function chaoTabuas(g, y0, y1, cores = ['#a8774a', '#9c6c42', '#b07e50'], linhaCor = 'rgba(60,35,15,0.35)', semente = 11) {
  const rnd = sorte(semente);
  let y = y0;
  while (y < y1) {
    const h = 12 + (y - y0) * 0.06;
    g.fillStyle = cores[Math.floor(rnd() * cores.length)];
    g.fillRect(0, y, W, h);
    g.fillStyle = linhaCor;
    g.fillRect(0, y + h - 1.5, W, 1.5);
    for (let x = rnd() * 200; x < W; x += 180 + rnd() * 160) g.fillRect(x, y, 1.5, h);
    y += h;
  }
}
function chaoAreia(g, y0, y1, cima = '#f1dcaa', baixo = '#e3c48a') {
  g.fillStyle = grad(g, 0, y0, 0, y1, [[0, cima], [1, baixo]]);
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(17);
  for (let k = 0; k < 280; k++) el(g, rnd() * W, y0 + rnd() * (y1 - y0), 0.8 + rnd() * 1.6, 0.6 + rnd(), rnd() < 0.5 ? 'rgba(160,120,70,0.25)' : 'rgba(255,255,255,0.35)');
  for (let k = 0; k < 10; k++) concha(g, rnd() * W, y0 + 30 + rnd() * (y1 - y0 - 40), rnd());
}
function concha(g, x, y, r) {
  g.fillStyle = ['#f4c7c3', '#fbe3c8', '#e8b98f'][Math.floor(r * 3) % 3];
  g.beginPath(); g.moveTo(x, y); g.arc(x, y, 5, Math.PI, 0); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(150,100,70,0.5)';
  g.lineWidth = 0.8;
  for (const a of [-0.7, 0, 0.7]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 5, y - Math.cos(a) * 5); g.stroke(); }
}
function chaoGrama(g, y0, y1, cima = '#5f8f4a', baixo = '#7aa95c') {
  g.fillStyle = grad(g, 0, y0, 0, y1, [[0, cima], [1, baixo]]);
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(5);
  g.strokeStyle = 'rgba(30,60,25,0.35)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 450; k++) {
    const x = rnd() * W;
    const y = y0 + rnd() * (y1 - y0);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2 + rnd() * 4, y - 4 - rnd() * 4); g.stroke();
  }
}
// Balão de fala de um NPC (x, y: a ponta do balão).
function balaoFala(g, x, y, txt, alpha = 1) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.font = '15px "EB Garamond", Georgia, serif';
  const w = g.measureText(txt).width + 24;
  const hh = 30;
  const bx = Math.max(6, Math.min(W - w - 6, x - w / 2));
  ret(g, bx, y - hh, w, hh, '#fffaf0', 10);
  g.strokeStyle = '#8a6a44';
  g.lineWidth = 1.5;
  g.beginPath();
  if (g.roundRect) g.roundRect(bx, y - hh, w, hh, 10); else g.rect(bx, y - hh, w, hh);
  g.stroke();
  forma(g, '#fffaf0', [x - 7, y - 1, x, y + 9, x + 7, y - 1]);
  texto(g, txt, bx + w / 2, y - hh / 2, { cor: '#2a2016', fonte: '15px "EB Garamond", Georgia, serif' });
  g.restore();
}

/* ─── NPCs ─── */

const NPCS = {
  'npc-capitao': { nome: 'Capitão Saltarrocha', sala: 'no Convés do Saltador', pelo: '#a07a52', roupa: { cabeca: 'pirata', rosto: 'tapaolho', corpo: 'colete', mao: 'espada' }, escala: 1.4 },
  'npc-salva-vidas': { nome: 'Salva-vidas da Prainha', sala: 'sentada na cadeira alta da Prainha', pelo: '#e2b3a3', roupa: { cabeca: 'bone', rosto: 'escuros' }, escala: 1.15, pose: 'sentado' },
};
function npc(g, id, x, y, t, dir = 1) {
  const n = NPCS[id];
  if (temSprite(`ilha-litoral.${id}`)) {
    el(g, x, y + n.escala, 15 * n.escala, 4.5 * n.escala, 'rgba(0,0,0,0.28)');
    sp(g, id, 'parado', x, y, { t, dir });
    return;
  }
  g.save();
  g.translate(x, y);
  g.scale(n.escala, n.escala);
  desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir, t, pose: n.pose || null });
  g.restore();
}
export const FALAS_CAPITAO = [
  'Arr! Bem-vindos a bordo do Saltador!',
  'Trouxe tesouros de terras bem distantes!',
  'Olho vivo, marujos! O Raposo anda por aí.',
  'Alguém viu o meu Pompom pirata?',
  'O Grande Iceberg vira? Arr, que lenda boa!',
  'A chave do meu quartel? Escondi num livro. Arr!',
  'No porão tem um baú. Um presentinho por dia!',
];

/* ─── Floresta ─── */

function fundoFloresta(g) {
  ceu(g, 340, [[0, '#e98f62'], [0.5, '#f5c98a'], [1, '#fbe6b5']]);
  sol(g, 640, 260, 34, '#fff1c4', 'rgba(255,214,140,A)');
  nuvem(g, 120, 90, 0.8, 'rgba(255,236,214,0.85)'); nuvem(g, 780, 60, 0.7, 'rgba(255,236,214,0.8)');
  const rnd = sorte(31);
  for (const [base, alt, cor, esc, n] of [[300, 120, '#a08a8e', '#958093', 26], [322, 170, '#5d6e5a', '#56654f', 19], [345, 230, '#3c5a3e', '#33503a', 13]]) {
    for (let k = 0; k < n; k++) pinheiro(g, (k + rnd() * 0.6) * (W / (n - 1)) - 20, base + rnd() * 10, alt * (0.8 + rnd() * 0.4), cor, esc);
  }
  chaoGrama(g, 340, H, '#4f7a3e', '#6d9a52');
  // A clareira do acampamento
  el(g, 500, 475, 360, 100, '#a58a5e');
  el(g, 500, 478, 330, 86, '#b89a6a');
  const r2 = sorte(8);
  for (let k = 0; k < 40; k++) el(g, 500 + (r2() - 0.5) * 600, 470 + (r2() - 0.5) * 140, 4, 2, ['#c47a3a', '#d8a040', '#8a5a2a'][k % 3], r2() * 3);
  // Trilhas: para a Plaza (direita) e para a Prainha (esquerda)
  forma(g, '#a58a5e', [1000, 410, 1000, 545, 840, 500, 840, 455]);
  forma(g, '#d8c08a', [0, 420, 0, 560, 160, 505, 160, 465]);
  placaPoste(g, 930, 420, 'Plaza →');
  placaPoste(g, 70, 425, '← Prainha');
}
function barraca(g, x, y, cor = '#e07a2a', escura = '#a8501c') {
  sombraNoChao(g, x, y + 2, 92, 16);
  if (!sp(g, 'barraca', 'parada', x, y, { cor })) corpoBarraca(g, x, y, cor, escura);
}
function corpoBarraca(g, x, y, cor = '#e07a2a', escura = '#a8501c') {
  forma(g, escura, [x - 92, y, x + 92, y, x + 8, y - 118]);
  forma(g, cor, [x - 86, y, x + 78, y, x, y - 118]);
  forma(g, 'rgba(255,255,255,0.14)', [x - 86, y, x - 40, y, x, y - 118]);
  forma(g, '#2a1c10', [x - 26, y, x + 26, y, x, y - 72]);
  forma(g, escura, [x - 26, y, x - 6, y, x, y - 72]);
  forma(g, escura, [x + 26, y, x + 10, y, x, y - 72]);
  ret(g, x - 3, y - 128, 6, 14, '#5b3c22');
  linha(g, 'rgba(240,230,210,0.7)', 1.2, [x, y - 118, x - 120, y - 4]);
  linha(g, 'rgba(240,230,210,0.7)', 1.2, [x, y - 118, x + 116, y - 4]);
  ret(g, x - 122, y - 8, 4, 10, '#5b3c22'); ret(g, x + 114, y - 8, 4, 10, '#5b3c22');
}
function fogueira(g, x, y, t) {
  sombraNoChao(g, x, y + 4, 52, 14);
  for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2; pedra(g, x + Math.cos(a) * 40, y + Math.sin(a) * 12, 9, k % 2 ? '#8d8a84' : '#7c7973'); }
  if (!sp(g, 'fogueira', 'acesa', x, y, { t })) corpoFogueira(g, x, y, t);
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.7 + k / 6) % 1;
    el(g, x + Math.sin(k * 2.3 + t * 3) * 14 * f, y - 40 - f * 90, 1.6, 1.6, `rgba(255,${180 + k * 10},90,${(1 - f).toFixed(2)})`);
  }
}
function corpoFogueira(g, x, y, t) {
  for (const rot of [0.35, -0.35]) { g.save(); g.translate(x, y - 6); g.rotate(rot); ret(g, -30, -5, 60, 10, '#5b3c22', 4); g.restore(); }
  const tremor = k => Math.sin(t * 11 + k) * 4;
  forma(g, '#e0682a', [x - 24, y - 6, x + 24, y - 6, x + 10 + tremor(1), y - 58 + tremor(2), x + tremor(3) * 0.5, y - 76 + tremor(4), x - 12 + tremor(5), y - 54 + tremor(6)]);
  forma(g, '#f4b03a', [x - 15, y - 8, x + 15, y - 8, x + 6 + tremor(7) * 0.5, y - 44 + tremor(2), x - 4 + tremor(1) * 0.5, y - 56 + tremor(3)]);
  el(g, x, y - 16, 8, 12 + tremor(5) * 0.4, '#fff1a8');
}
function tronco(g, x, y, w = 120) {
  sombraNoChao(g, x, y + 2, w * 0.55, 10);
  ret(g, x - w / 2, y - 28, w, 26, '#7a4a2a', 13);
  ret(g, x - w / 2 + 8, y - 25, w - 22, 6, 'rgba(255,255,255,0.12)', 3);
  el(g, x + w / 2 - 10, y - 15, 10, 13, '#c9a06a');
  el(g, x + w / 2 - 10, y - 15, 6, 8, '#a8774a');
  el(g, x + w / 2 - 10, y - 15, 2, 3, '#c9a06a');
}
function arvoreAlta(g, x, y, h) {
  sombraNoChao(g, x, y + 2, h * 0.2);
  pinheiro(g, x, y, h, '#2f5d3a', '#24492d');
}
function animarFloresta(g, t) {
  const f = 0.22 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
  brilho(g, 500, 450, 260, 'rgba(255,150,60,A)', f);
  // Vaga-lumes
  for (let k = 0; k < 26; k++) {
    const x = (k * 137 + Math.sin(t * 0.4 + k) * 60 + t * 6) % W;
    const y = 260 + ((k * 71) % 280) + Math.sin(t * 0.8 + k * 1.7) * 18;
    const a = Math.max(0, Math.sin(t * 2.2 + k * 1.3));
    if (a > 0.05) { brilho(g, x, y, 12, 'rgba(230,255,120,A)', a * 0.6); el(g, x, y, 1.6, 1.6, `rgba(250,255,190,${a.toFixed(2)})`); }
  }
  // Fumaça subindo
  for (let k = 0; k < 4; k++) {
    const q = (t * 0.2 + k / 4) % 1;
    el(g, 500 + Math.sin(q * 5 + k) * 18, 380 - q * 220, 10 + q * 22, 8 + q * 16, `rgba(200,190,180,${(0.28 * (1 - q)).toFixed(3)})`);
  }
}

/* ─── Prainha ─── */

function fundoPrainha(g) {
  ceu(g, 180, [[0, '#4fb0e3'], [1, '#c3e9f7']]);
  sol(g, 860, 70, 32);
  nuvem(g, 160, 60, 0.9); nuvem(g, 520, 40, 0.7);
  mar(g, 170, 350, '#5cc4d8', '#1f86a8');
  // As pedras da enseada, dos dois lados
  forma(g, '#7d6f62', [0, 170, 90, 150, 200, 190, 260, 260, 300, 350, 0, 360]);
  forma(g, '#8e8072', [0, 200, 110, 175, 190, 220, 240, 300, 0, 330]);
  forma(g, '#7d6f62', [1000, 150, 900, 170, 820, 240, 790, 350, 1000, 360]);
  forma(g, '#958778', [1000, 190, 920, 200, 860, 260, 1000, 300]);
  for (const [x, y, h] of [[40, 190, 90], [120, 175, 70], [950, 175, 80]]) pinheiro(g, x, y, h);
  chaoAreia(g, 340, H);
  // Trilha de volta para a Floresta
  forma(g, '#c9ae7a', [0, 430, 0, 570, 110, 530, 110, 470]);
  placaPoste(g, 60, 440, '← Floresta');
  // A barraca de surfe
  if (!sp(g, 'cabana-surfe', 'parado', 210, 385, { quadro: 0 })) cabanaSurfe(g);
}
function cabanaSurfe(g) {
  ret(g, 110, 250, 200, 135, '#c98d55');
  for (let x = 116; x < 310; x += 16) ret(g, x, 250, 2, 135, 'rgba(80,45,20,0.25)');
  forma(g, '#e2c070', [90, 262, 330, 262, 290, 200, 130, 200]);
  for (let x = 96; x < 330; x += 12) linha(g, 'rgba(150,110,40,0.6)', 2, [x, 262, x + 6, 272]);
  ret(g, 140, 300, 140, 40, '#5b3c22', 3);
  ret(g, 146, 306, 128, 30, '#2a6f8a', 2);
  for (let k = 0; k < 3; k++) ret(g, 156 + k * 40, 312, 24, 8, ['#e05a5a', '#f4dd80', '#7fd0e8'][k], 4);
  placa(g, 210, 230, 150, 30, 'Surfe do Coelho', { fundo: '#2a6f8a', borda: '#1b4a5c', fonte: '700 14px "Cinzel", Georgia, serif' });
}
function prancha(g, x, y, cor = '#e05a5a', rot = 0) {
  sombraNoChao(g, x, y + 2, 16, 5);
  g.save(); g.translate(x, y); g.rotate(rot);
  if (!sp(g, 'prancha', 'parada', 0, 0, { cor })) corpoPrancha(g, cor);
  g.restore();
}
function corpoPrancha(g, cor = '#e05a5a') {
  el(g, 0, -48, 15, 50, cor);
  ret(g, -2, -96, 4, 92, 'rgba(255,255,255,0.7)', 2);
  el(g, -5, -70, 3, 14, 'rgba(255,255,255,0.25)');
}
function cadeiraSalvaVidas(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 50, 12);
  for (const dx of [-36, 36]) { linha(g, '#f2f2ee', 8, [x + dx, y, x + dx * 0.45, y - 120]); }
  linha(g, '#e05a5a', 5, [x - 30, y - 40, x + 30, y - 40]);
  linha(g, '#e05a5a', 5, [x - 24, y - 80, x + 24, y - 80]);
  ret(g, x - 30, y - 128, 60, 10, '#f2f2ee', 3);
  ret(g, x - 26, y - 168, 8, 44, '#f2f2ee', 3);
  npc(g, 'npc-salva-vidas', x + 2, y - 120, t, -1);
  // A boia pendurada
  el(g, x + 38, y - 66, 14, 14, '#e05a5a'); el(g, x + 38, y - 66, 7, 7, '#f1dcaa');
  for (const a of [0.8, 2.4, 3.9, 5.5]) el(g, x + 38 + Math.cos(a) * 10.5, y - 66 + Math.sin(a) * 10.5, 3, 3, '#f7f7f2');
  placa(g, x, y - 188, 92, 22, 'Salva-vidas', { fundo: '#e05a5a', borda: '#a83a3a', fonte: '700 11px "Cinzel", Georgia, serif' });
}
function animarPrainha(g, t) {
  brilhoDoMar(g, t, 180, 330, 20, 18, 250, 820);
  // A grande onda que passa lá no meio, com um surfista de vez em quando
  const c = (t * 0.12) % 1;
  const ox = 200 + c * 700;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.moveTo(ox - 160, 262);
  g.quadraticCurveTo(ox - 60, 250, ox, 232);
  g.quadraticCurveTo(ox + 16, 226, ox + 26, 240);
  g.quadraticCurveTo(ox + 6, 240, ox + 2, 254);
  g.quadraticCurveTo(ox + 80, 262, ox + 160, 264);
  g.closePath();
  g.fill();
  if (Math.floor(t * 0.12) % 2 === 0) {
    g.save(); g.translate(ox - 30, 244); g.rotate(-0.25);
    el(g, 0, 0, 14, 3, '#f4dd80');
    g.scale(0.45, 0.45);
    desenharCoelho(g, 0, -4, { pelo: '#c99a6b', dir: 1, t, pose: null });
    g.restore();
  }
  espuma(g, t, 352, 9, 230, 830);
  gaivotas(g, t, 3, 60, 150, 35);
}

/* ─── Ancoradouro ─── */

function fundoAncoradouro(g) {
  ceu(g, 150, [[0, '#86c1e6'], [1, '#e8f5fb']]);
  sol(g, 160, 60, 26, '#fffbe6', 'rgba(255,250,220,A)');
  nuvem(g, 560, 50, 0.8); nuvem(g, 820, 80, 0.6);
  // Ilhas nevadas ao longe e icebergs
  forma(g, '#b9cfdf', [300, 150, 380, 95, 430, 120, 500, 80, 590, 150]);
  forma(g, '#f4f9fc', [380, 95, 400, 108, 420, 112, 430, 120, 455, 104, 480, 92, 500, 80, 470, 100, 430, 108, 395, 102]);
  forma(g, '#c9dbe7', [760, 150, 820, 118, 880, 150]);
  mar(g, 145, 380, '#4f9fc4', '#1d5f86');
  for (const [x, y, k] of [[700, 175, 1], [880, 200, 0.7]]) {
    forma(g, '#f2f8fb', [x - 30 * k, y, x - 12 * k, y - 22 * k, x + 4 * k, y - 16 * k, x + 22 * k, y - 30 * k, x + 34 * k, y]);
    forma(g, '#cfe3ee', [x + 4 * k, y - 16 * k, x + 22 * k, y - 30 * k, x + 34 * k, y, x + 6 * k, y]);
  }
  // O deque de madeira
  chaoTabuas(g, 372, H, ['#9c8466', '#8f7a5e', '#a58d6e'], 'rgba(50,35,20,0.35)', 12);
  ret(g, 0, 362, W, 14, '#5b4630');
  for (let x = 30; x < W; x += 120) {
    ret(g, x, 326, 14, 50, '#6b5236', 3);
    el(g, x + 7, 326, 7, 3, '#7d6244');
    linha(g, '#d8c08a', 3, [x + 2, 344, x + 12, 352]);
  }
  // A cabana da pescaria no gelo (o telhado tem neve)
  ret(g, 120, 262, 220, 128, '#6f8fa6');
  for (let x = 126; x < 340; x += 18) ret(g, x, 262, 2, 128, 'rgba(20,40,60,0.25)');
  forma(g, '#4a5f72', [100, 270, 360, 270, 330, 214, 130, 214]);
  forma(g, '#f4f9fc', [100, 270, 360, 270, 352, 256, 108, 256]);
  forma(g, '#f4f9fc', [130, 214, 330, 214, 336, 226, 124, 226]);
  ret(g, 196, 300, 68, 90, '#20303d', 4);
  brilho(g, 230, 372, 40, 'rgba(160,220,255,A)', 0.5);
  el(g, 230, 380, 24, 6, '#9fd6f2');
  ret(g, 144, 300, 36, 30, '#bfe4f7', 3); ret(g, 280, 300, 36, 30, '#bfe4f7', 3);
  placa(g, 230, 240, 180, 28, 'Pescaria no Gelo', { fundo: '#2f4a5c', borda: '#1b2e3a', fonte: '700 13px "Cinzel", Georgia, serif' });
  placaPoste(g, 60, 440, '← Praça');
  placaPoste(g, 940, 440, 'Praia →');
  placaPoste(g, 520, 395, 'Barco para o Iceberg', { fundo: '#2f4a5c', borda: '#1b2e3a' });
}
function buracoNoGelo(g, x, y, t) {
  sombraNoChao(g, x, y + 4, 74, 16);
  el(g, x, y, 72, 22, '#e6f3fa');
  el(g, x, y - 3, 66, 19, '#f7fbfd');
  el(g, x, y - 2, 30, 9, '#1f5f86');
  el(g, x - 6, y - 5, 12, 2.5, `rgba(255,255,255,${(0.25 + Math.sin(t * 2) * 0.15).toFixed(2)})`);
  linha(g, '#7a4a2a', 3, [x + 40, y - 8, x + 8, y - 70]);
  linha(g, 'rgba(255,255,255,0.8)', 1, [x + 8, y - 70, x + 2, y - 3]);
  ret(g, x - 66, y - 26, 22, 20, '#7f8893', 4); el(g, x - 55, y - 26, 11, 3, '#5a8fb0');
}
function barco(g, x, y, t, cor = '#c0543a') {
  if (!sp(g, 'barco', 'boiando', x, y, { t })) corpoBarco(g, x, y, cor);
}
function corpoBarco(g, x, y, cor = '#c0543a') {
  forma(g, cor, [x - 80, y - 26, x + 80, y - 26, x + 62, y, x - 60, y]);
  ret(g, x - 80, y - 30, 160, 7, '#f2e8cf', 3);
  ret(g, x - 40, y - 22, 6, 16, '#7a4a2a');
  ret(g, x + 26, y - 22, 6, 16, '#7a4a2a');
  linha(g, '#8a6a44', 3, [x - 60, y - 34, x - 96, y - 10]);
  linha(g, '#8a6a44', 3, [x + 50, y - 34, x + 96, y - 4]);
}
function caixote(g, x, y, s = 1) {
  sombraNoChao(g, x, y + 2, 30 * s, 8 * s);
  ret(g, x - 26 * s, y - 50 * s, 52 * s, 50 * s, '#a87a45', 3);
  g.strokeStyle = '#6b4a2b'; g.lineWidth = 3 * s;
  g.strokeRect(x - 24 * s, y - 48 * s, 48 * s, 46 * s);
  linha(g, '#6b4a2b', 3 * s, [x - 24 * s, y - 48 * s, x + 24 * s, y - 2 * s]);
}
function barril(g, x, y, s = 1) {
  sombraNoChao(g, x, y + 2, 24 * s, 7 * s);
  ret(g, x - 22 * s, y - 56 * s, 44 * s, 56 * s, '#8a5a32', 12 * s);
  for (const dy of [-46, -12]) ret(g, x - 22 * s, y + dy * s, 44 * s, 5 * s, '#4f4a44', 2);
  el(g, x, y - 56 * s, 20 * s, 5 * s, '#a8774a');
}
function corda(g, x, y) {
  for (let k = 0; k < 4; k++) { g.strokeStyle = k % 2 ? '#c9ae7a' : '#b39461'; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y - 6 - k * 4, 26 - k * 3, 9 - k, 0, 0, Math.PI * 2); g.stroke(); }
}
function animarAncoradouro(g, t) {
  brilhoDoMar(g, t, 150, 360, 22, 14);
  // Um veleiro passando lá longe
  const vx = ((t * 8) % 1300) - 150;
  forma(g, '#5b3c22', [vx - 18, 158, vx + 18, 158, vx + 12, 166, vx - 12, 166]);
  forma(g, '#f7f3ea', [vx - 2, 156, vx - 2, 124, vx + 16, 156]);
  // A boia que sobe e desce
  const by = 300 + Math.sin(t * 1.6) * 4;
  ret(g, 880, by - 22, 14, 24, '#e05a5a', 4); ret(g, 880, by - 12, 14, 5, '#f7f7f2');
  // O barquinho do Iceberg, boiando junto do deque
  barco(g, 640, 362 + Math.sin(t * 1.3) * 3, t);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.5 + k / 3) % 1;
    g.strokeStyle = `rgba(255,255,255,${(0.4 * (1 - f)).toFixed(2)})`; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(640, 360, 90 + f * 40, 6 + f * 4, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  }
  gaivotas(g, t, 4, 40, 130, 30);
}

/* ─── Praia ─── */

function fundoPraia(g) {
  ceu(g, 220, [[0, '#62afe0'], [0.75, '#cfe9f5'], [1, '#f6ecd0']]);
  sol(g, 620, 70, 30);
  nuvem(g, 420, 50, 0.7); nuvem(g, 720, 110, 0.6);
  mar(g, 210, 375, '#4fa6cc', '#226f97');
  // O morro nevado com a trilha para a Vila de Esqui
  forma(g, '#cfdde8', [180, 380, 260, 170, 340, 120, 420, 180, 520, 380]);
  forma(g, '#f4f9fc', [260, 170, 340, 120, 420, 180, 380, 200, 340, 175, 300, 205]);
  forma(g, '#e3eef5', [240, 380, 300, 250, 360, 230, 430, 260, 480, 380]);
  for (const [x, y, h] of [[230, 300, 70], [450, 290, 60], [285, 255, 50]]) pinheiro(g, x, y, h, '#2f5d3a', '#24492d', true);
  for (let k = 0; k < 7; k++) ret(g, 352 + Math.sin(k) * 10, 370 - k * 18, 36, 6, '#8a6a44', 2);
  placaPoste(g, 420, 380, 'Vila de Esqui ↑');
  // Pedras e o Farol
  forma(g, '#7d6f62', [0, 380, 0, 300, 70, 290, 240, 310, 270, 380]);
  if (!sp(g, 'farol', 'parado', 160, 330, { quadro: 0 })) farolFora(g);
  chaoAreia(g, 375, H);
  forma(g, '#d6bf8e', [0, 430, 0, 570, 110, 535, 110, 470]);
  placaPoste(g, 70, 445, '← Ancoradouro');
  // O pierzinho e o Saltador ancorado
  for (let k = 0; k < 7; k++) ret(g, 800 - k * 2, 370 - k * 13, 110 + k * 4, 12, k % 2 ? '#9c6c42' : '#a8774a', 2);
  for (const x of [796, 904]) ret(g, x, 285, 7, 95, '#5b3c22');
  if (!sp(g, 'saltador', 'parado', 800, 300, { quadro: 0 })) navioFora(g, 800, 300, 1);
}
function farolFora(g) {
  const x = 160;
  forma(g, '#f2eee6', [x - 55, 330, x + 55, 330, x + 34, 80, x - 34, 80]);
  for (const [a, b] of [[300, 260], [200, 160], [110, 80]]) {
    const w = y => 34 + (y - 80) * (21 / 250);
    forma(g, '#d0473a', [x - w(a), a, x + w(a), a, x + w(b), b, x - w(b), b]);
  }
  ret(g, x - 46, 64, 92, 18, '#3a3a44', 3);
  ret(g, x - 30, 24, 60, 42, '#2a3540', 4);
  ret(g, x - 24, 30, 48, 32, '#fff1b0', 3);
  forma(g, '#d0473a', [x - 36, 26, x + 36, 26, x, 0]);
  ret(g, x - 24, 270, 48, 60, '#5b3c22', 20);
  ret(g, x - 18, 276, 36, 54, '#7a5434', 16);
  el(g, x + 10, 304, 3, 3, '#e8c24a');
  for (const y of [150, 220]) { ret(g, x - 10, y, 20, 26, '#2a3540', 10); ret(g, x - 6, y + 4, 12, 18, '#ffe9a8', 6); }
}
// O Saltador (x: a proa à esquerda, y: a linha da água). k: o tamanho.
function navioFora(g, x, y, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  forma(g, '#5b3420', [-10, -50, 200, -50, 186, 0, 20, 0]);
  forma(g, '#7a4a2a', [-10, -50, 200, -50, 196, -36, -2, -36]);
  ret(g, 120, -86, 80, 40, '#6b3e24', 3);
  for (let i = 0; i < 4; i++) el(g, 26 + i * 26, -24, 6, 6, '#2a1c10');
  ret(g, 10, -32, 180, 4, '#e8c24a');
  for (const [mx, alt] of [[60, 230], [140, 190]]) {
    ret(g, mx - 3, -50 - alt, 6, alt, '#4a2e18');
    ret(g, mx - 46, -40 - alt * 0.85, 92, 4, '#4a2e18');
    forma(g, '#f2e8cf', [mx - 42, -36 - alt * 0.85, mx + 42, -36 - alt * 0.85, mx + 50, -60 - alt * 0.3, mx - 50, -60 - alt * 0.3]);
    el(g, mx, -52 - alt * 0.58, 14, 12, '#e07a2a');
  }
  forma(g, '#4a2e18', [-10, -50, -50, -66, -48, -62]);
  g.restore();
}
function guardaSol(g, x, y, cores = ['#e05a5a', '#f7f3ea']) {
  sombraNoChao(g, x + 20, y + 4, 70, 14);
  if (!sp(g, 'guarda-sol', 'parado', x, y, { quadro: 0 })) corpoGuardaSol(g, x, y, cores);
}
function corpoGuardaSol(g, x, y, cores = ['#e05a5a', '#f7f3ea']) {
  ret(g, x - 2, y - 120, 4, 120, '#d8d0c0');
  for (let k = 0; k < 6; k++) {
    const a0 = Math.PI + (k / 6) * Math.PI;
    const a1 = Math.PI + ((k + 1) / 6) * Math.PI;
    forma(g, cores[k % 2], [x, y - 140, x + Math.cos(a0) * 70, y - 120 + Math.sin(a0) * -2, x + Math.cos(a1) * 70, y - 120 + Math.sin(a1) * -2]);
  }
  el(g, x, y - 141, 4, 4, '#d8d0c0');
}
function toalha(g, x, y, cor) {
  forma(g, cor, [x - 50, y, x + 40, y, x + 54, y - 22, x - 36, y - 22]);
  for (let k = 0; k < 3; k++) forma(g, 'rgba(255,255,255,0.4)', [x - 40 + k * 30, y, x - 30 + k * 30, y, x - 16 + k * 30, y - 22, x - 26 + k * 30, y - 22]);
}
function castelinho(g, x, y) {
  sombraNoChao(g, x, y + 2, 40, 9);
  ret(g, x - 34, y - 22, 68, 22, '#e3c48a', 3);
  for (const dx of [-28, 14]) { ret(g, x + dx, y - 44, 14, 24, '#d9b878', 2); for (let k = 0; k < 3; k++) ret(g, x + dx + k * 5, y - 48, 3, 5, '#d9b878'); }
  ret(g, x - 8, y - 52, 16, 32, '#e8cc92', 2);
  linha(g, '#5b3c22', 1.5, [x, y - 52, x, y - 68]);
  forma(g, '#e05a5a', [x, y - 68, x + 12, y - 64, x, y - 60]);
  ret(g, x - 5, y - 12, 10, 12, '#b89a6a', 5);
}
function animarPraia(g, t) {
  brilhoDoMar(g, t, 215, 360, 18, 15, 480, W);
  // O farol pisca lá em cima
  const luz = 0.35 + Math.max(0, Math.sin(t * 2)) * 0.4;
  brilho(g, 160, 46, 70, 'rgba(255,240,150,A)', luz);
  // A bandeira do Saltador
  const bx = 860;
  const by = 40;
  g.fillStyle = '#1b1b22';
  g.beginPath(); g.moveTo(bx, by);
  for (let k = 0; k <= 6; k++) g.lineTo(bx + k * 6, by + Math.sin(t * 6 + k * 0.8) * 3);
  for (let k = 6; k >= 0; k--) g.lineTo(bx + k * 6, by + 22 + Math.sin(t * 6 + k * 0.8) * 3);
  g.closePath(); g.fill();
  el(g, bx + 17, by + 11 + Math.sin(t * 6 + 2) * 3, 4, 4, '#f7f3ea');
  ret(g, bx - 2, by - 4, 3, 40, '#4a2e18');
  espuma(g, t, 378, 8, 470, W, 1);
  gaivotas(g, t, 4, 40, 170, 32);
}

/* ─── Farol (por dentro) ─── */

function fundoFarol(g) {
  g.fillStyle = grad(g, 0, 0, W, 0, [[0, '#4f4a44'], [0.2, '#8a837a'], [0.5, '#a39b90'], [0.8, '#8a837a'], [1, '#4f4a44']]);
  g.fillRect(0, 0, W, 370);
  const rnd = sorte(41);
  for (let y = 0; y < 370; y += 30) {
    for (let x = (y / 30) % 2 * -40; x < W; x += 80) {
      const borda = Math.abs(x + 40 - 500) / 500;
      ret(g, x + 2, y + 2, 76, 26, `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${(0.05 + borda * 0.05).toFixed(3)})`, 4);
    }
  }
  // A janela redonda com o mar
  el(g, 380, 160, 54, 54, '#5b4630');
  g.save(); g.beginPath(); g.ellipse(380, 160, 46, 46, 0, 0, Math.PI * 2); g.clip?.();
  g.fillStyle = grad(g, 0, 114, 0, 206, [[0, '#7cc0e8'], [0.55, '#d4effa'], [0.56, '#3f8fb8'], [1, '#226f97']]);
  g.fillRect(330, 110, 100, 100);
  navioFora(g, 392, 172, 0.12);
  g.restore();
  ret(g, 377, 106, 6, 108, '#5b4630'); ret(g, 326, 157, 108, 6, '#5b4630');
  // Prateleira com o navio na garrafa e o violão pendurado
  ret(g, 520, 150, 150, 8, '#5b3c22');
  el(g, 560, 136, 26, 12, 'rgba(200,235,220,0.6)'); ret(g, 580, 130, 16, 10, 'rgba(200,235,220,0.6)', 3);
  forma(g, '#f2e8cf', [552, 138, 566, 138, 560, 126]); forma(g, '#7a4a2a', [546, 140, 572, 140, 568, 145, 550, 145]);
  for (let k = 0; k < 4; k++) ret(g, 610 + k * 12, 124 + (k % 2) * 4, 10, 26 - (k % 2) * 4, ['#c0392b', '#2f6b34', '#d8b13a', '#5aa0d8'][k], 1);
  el(g, 130, 200, 30, 36, '#b07e50'); el(g, 130, 158, 22, 26, '#b07e50'); el(g, 130, 196, 10, 10, '#3a2414');
  ret(g, 126, 70, 8, 90, '#7a5434'); ret(g, 120, 62, 20, 16, '#5b3c22', 3);
  // A escada em caracol, subindo pela direita
  ret(g, 812, 0, 18, 370, '#5b5550');
  for (let i = 0; i < 16; i++) {
    const a = i * 0.7;
    const x = 821 + Math.cos(a) * 110;
    const y = 400 - i * 26;
    if (y < -20) break;
    forma(g, i % 2 ? '#7a5434' : '#8a6240', [821, y - 4, x, y - 10, x + Math.sin(a) * 20, y + 6, 821, y + 8]);
  }
  linha(g, '#3a3530', 3, [700, 300, 760, 210, 900, 140, 940, 40]);
  placa(g, 820, 196, 110, 26, 'Mirante ↑', { fundo: '#5b4630', borda: '#3a2a1a', fonte: '700 13px "Cinzel", Georgia, serif' });
  chaoTabuas(g, 370, H, ['#a8774a', '#9c6c42', '#b07e50'], 'rgba(60,35,15,0.35)', 14);
  g.fillStyle = grad(g, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.35)'], [0.18, 'rgba(0,0,0,0)'], [0.82, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
  g.fillRect(0, 370, W, 230);
  ret(g, 0, 364, W, 8, '#3a3530');
  tapeteSaida(g, 'Saída para a Praia');
}
function piano(g, x, y) {
  sombraNoChao(g, x, y + 2, 100, 16);
  ret(g, x - 95, y - 140, 190, 140, '#3a2414', 6);
  ret(g, x - 88, y - 132, 176, 60, '#4f3020', 4);
  ret(g, x - 100, y - 70, 200, 16, '#2a1a0e', 3);
  for (let k = 0; k < 20; k++) ret(g, x - 96 + k * 9.6, y - 68, 8.6, 12, '#f7f3ea', 1);
  for (let k = 0; k < 20; k++) if (k % 7 !== 2 && k % 7 !== 6) ret(g, x - 90 + k * 9.6, y - 68, 5, 7, '#1b1403');
  ret(g, x - 30, y - 128, 60, 40, '#f2e8cf', 2);
  for (let k = 0; k < 4; k++) ret(g, x - 24, y - 120 + k * 8, 48, 1.5, '#8a7a6a');
  for (const dx of [-80, 80]) { ret(g, x + dx - 3, y - 160, 6, 22, '#d8b13a'); el(g, x + dx, y - 164, 3, 6, '#fff1a8'); }
  ret(g, x - 90, y - 54, 10, 54, '#2a1a0e'); ret(g, x + 80, y - 54, 10, 54, '#2a1a0e');
}
function tambor(g, x, y) {
  sombraNoChao(g, x, y + 2, 34, 9);
  ret(g, x - 30, y - 46, 60, 44, '#c0392b', 6);
  for (let k = 0; k < 5; k++) linha(g, '#f2e8cf', 2, [x - 26 + k * 13, y - 44, x - 20 + k * 13, y - 4]);
  el(g, x, y - 46, 30, 8, '#f2e8cf');
  linha(g, '#7a5434', 3, [x - 10, y - 50, x + 26, y - 74]);
}
function mesaFaroleiro(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 60, 12);
  ret(g, x - 60, y - 50, 120, 10, '#7a4a2a', 3);
  ret(g, x - 54, y - 40, 8, 40, '#5b3c22'); ret(g, x + 46, y - 40, 8, 40, '#5b3c22');
  forma(g, '#f2e8cf', [x - 40, y - 52, x, y - 56, x, y - 66, x - 38, y - 62]);
  forma(g, '#e8dcc0', [x + 40, y - 52, x, y - 56, x, y - 66, x + 38, y - 62]);
  ret(g, x + 30, y - 76, 14, 22, '#d8b13a', 3);
  el(g, x + 37, y - 82, 4, 6 + Math.sin(t * 9) * 1, '#fff1a8');
  brilho(g, x + 37, y - 80, 60, 'rgba(255,220,140,A)', 0.25);
}
function animarFarol(g, t) {
  // Poeirinha na luz da janela
  g.fillStyle = 'rgba(255,250,220,0.07)';
  g.beginPath(); g.moveTo(340, 130); g.lineTo(420, 130); g.lineTo(560, 600); g.lineTo(300, 600); g.closePath(); g.fill();
  for (let k = 0; k < 14; k++) {
    const f = (t * 0.05 + k / 14) % 1;
    el(g, 360 + (k * 23) % 160 + Math.sin(t + k) * 10, 160 + f * 400, 1.4, 1.4, `rgba(255,250,220,${(0.5 * Math.sin(f * Math.PI)).toFixed(2)})`);
  }
  for (let k = 0; k < 2; k++) {
    const f = (t * 0.4 + k * 0.5) % 1;
    texto(g, '♪', 210 + Math.sin(f * 6 + k) * 18, 280 - f * 90, { cor: `rgba(255,230,140,${(1 - f).toFixed(2)})`, fonte: '700 18px serif' });
  }
}

/* ─── Mirante (topo do farol) ─── */

function fundoMirante(g) {
  ceu(g, 340, [[0, '#141a42'], [0.45, '#4f3f84'], [0.78, '#e2876a'], [1, '#f7c08a']]);
  estrelas(g, 160, 70, 9);
  el(g, 860, 70, 18, 18, '#f4f0d8'); el(g, 866, 66, 15, 15, '#2a2a5a');
  forma(g, '#3a2f5a', [0, 340, 60, 318, 140, 326, 200, 310, 260, 340]);
  forma(g, '#40335f', [700, 340, 760, 324, 800, 330, 880, 312, 960, 330, 1000, 326, 1000, 340]);
  mar(g, 338, 420, '#5a4a7a', '#22284a');
  for (let k = 0; k < 10; k++) ret(g, 470 - k * 8, 344 + k * 7, 60 + k * 16, 2, 'rgba(255,190,140,0.35)', 1);
  navioFora(g, 820, 352, 0.18);
  forma(g, '#e8f2f8', [140, 352, 150, 340, 160, 344, 170, 336, 182, 352]);
  // O chão de grade de ferro da galeria
  g.fillStyle = grad(g, 0, 400, 0, H, [[0, '#3a3c44'], [1, '#55585f']]);
  g.fillRect(0, 400, W, 200);
  for (let x = -200; x < W + 200; x += 26) linha(g, 'rgba(0,0,0,0.25)', 1.5, [x, 400, x + (x - 500) * 0.25, H]);
  for (let y = 410; y < H; y += 16 + (y - 400) * 0.08) linha(g, 'rgba(0,0,0,0.25)', 1.5, [0, y, W, y]);
  // A grade do parapeito
  ret(g, 0, 352, W, 6, '#2a2c32');
  ret(g, 0, 392, W, 8, '#2a2c32');
  for (let x = 10; x < W; x += 34) ret(g, x, 352, 4, 44, '#2a2c32');
  // A casa da lâmpada, no meio
  ret(g, 370, 380, 260, 30, '#2a2c32', 4);
  ret(g, 380, 110, 240, 274, 'rgba(160,200,230,0.18)');
  for (let x = 380; x <= 620; x += 60) ret(g, x - 3, 110, 6, 274, '#2a2c32');
  ret(g, 376, 104, 248, 10, '#2a2c32');
  forma(g, '#b0473a', [366, 108, 634, 108, 560, 46, 440, 46]);
  forma(g, '#8a3a30', [440, 46, 560, 46, 520, 30, 480, 30]);
  el(g, 500, 24, 9, 9, '#2a2c32');
  ret(g, 470, 250, 60, 134, '#3a3c44', 4);
  tapeteSaida(g, 'Descer a escada', '#3a3c44');
}
function lente(g, t) {
  for (let k = 0; k < 6; k++) el(g, 500, 200, 70 - k * 10, 82 - k * 12, k % 2 ? 'rgba(232,194,74,0.85)' : 'rgba(255,240,170,0.9)');
  el(g, 500, 200, 16, 20, '#fffbe6');
  brilho(g, 500, 200, 150, 'rgba(255,240,170,A)', 0.45 + Math.sin(t * 3) * 0.08);
}
function animarMirante(g, t) {
  brilhoDoMar(g, t, 342, 412, 12, 10);
  // Os fachos de luz girando
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const desloc of [0, Math.PI]) {
    const a = t * 0.8 + desloc;
    const lado = Math.cos(a);
    const largura = Math.abs(Math.sin(a)) * 0.25 + 0.05;
    const fim = 500 + lado * 900;
    g.fillStyle = grad(g, 500, 200, fim, 200, [[0, 'rgba(255,240,170,0.35)'], [1, 'rgba(255,240,170,0)']]);
    g.beginPath();
    g.moveTo(500, 200);
    g.lineTo(fim, 200 - 260 * largura - 20);
    g.lineTo(fim, 200 + 260 * largura + 20);
    g.closePath();
    g.fill();
  }
  g.restore();
  lente(g, t);
  // Estrelinhas piscando
  for (let k = 0; k < 8; k++) { const a = Math.max(0, Math.sin(t * 1.5 + k * 2)); el(g, (k * 131) % W, 20 + (k * 37) % 120, 1.6 * a + 0.2, 1.6 * a + 0.2, '#fffbe6'); }
}
function estacaoJato(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 80, 14);
  ret(g, x - 80, y - 120, 160, 10, '#55585f', 3);
  for (const dx of [-74, 66]) ret(g, x + dx, y - 120, 8, 120, '#55585f');
  for (const dx of [-38, 30]) {
    ret(g, x + dx - 16, y - 104, 14, 52, '#d0473a', 7);
    ret(g, x + dx + 2, y - 104, 14, 52, '#d0473a', 7);
    ret(g, x + dx - 12, y - 96, 24, 6, '#e8c24a', 2);
    el(g, x + dx - 9, y - 50, 5, 4, '#2a2c32'); el(g, x + dx + 9, y - 50, 5, 4, '#2a2c32');
  }
  for (const dx of [-60, -40]) { ret(g, x + dx, y - 34, 18, 34, '#e8c24a', 3); ret(g, x + dx + 4, y - 40, 10, 8, '#55585f', 2); }
  placa(g, x, y - 140, 150, 26, 'Aventura a Jato', { fundo: '#d0473a', borda: '#8a2a20', fonte: '700 13px "Cinzel", Georgia, serif' });
  brilho(g, x, y - 140, 70, 'rgba(255,120,90,A)', 0.12 + Math.sin(t * 4) * 0.05);
}
function telescopio(g, x, y) {
  sombraNoChao(g, x, y + 2, 34, 9);
  if (!sp(g, 'telescopio', 'parado', x, y, { quadro: 0 })) corpoTelescopio(g, x, y);
}
function corpoTelescopio(g, x, y) {
  linha(g, '#3a3c44', 5, [x, y - 60, x - 26, y]);
  linha(g, '#3a3c44', 5, [x, y - 60, x + 26, y]);
  linha(g, '#3a3c44', 5, [x, y - 60, x + 2, y - 2]);
  g.save(); g.translate(x, y - 66); g.rotate(-0.35);
  ret(g, -40, -10, 80, 20, '#b8922a', 6);
  ret(g, 34, -13, 14, 26, '#8a6a20', 4);
  ret(g, -50, -7, 12, 14, '#8a6a20', 3);
  ret(g, -30, -10, 6, 20, '#e8c24a');
  g.restore();
}

/* ─── O Grande Iceberg ─── */
// O boato: com 10 ou mais coelhos dançando ao mesmo tempo, o iceberg balança e vira (de brincadeira).
// O servidor conta quem está dançando (src/clube-ilha/litoral.js) e manda 'clube:evento' { evento: 'iceberg', fase, dancando }.

export const ICEBERG = { desde: 0, dancando: null, contagemEm: 0 };
const VIRADA_MS = 10_000;
export function receberEvento(m) {
  if (m?.evento !== 'iceberg') return;
  if (Number.isFinite(m.dancando)) { ICEBERG.dancando = m.dancando; ICEBERG.contagemEm = Date.now(); }
  if (m.fase === 'vira') ICEBERG.desde = Date.now();
}
let ouvindo = false;
function garantirOuvinte() {
  if (ouvindo || typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  ouvindo = true;
  import('../tempo-real.js').then(m => m.ouvir('clube:evento', receberEvento)).catch(() => { ouvindo = false; });
}
// Como o iceberg está agora: { dx, dy, rot, tremor, virado (0 a 1), splash (0 a 1) }.
export function estadoIceberg(agora = Date.now()) {
  const s = (agora - ICEBERG.desde) / 1000;
  if (!ICEBERG.desde || s < 0 || s * 1000 > VIRADA_MS) return null;
  const ease = q => q * q * (3 - 2 * q);
  let rot = 0;
  let tremor = 0;
  if (s < 3) tremor = s / 3;
  else if (s < 5) rot = ease((s - 3) / 2);
  else if (s < 8) rot = 1 + Math.sin((s - 5) * 4) * 0.04 * (8 - s);
  else rot = 1 - ease((s - 8) / 2);
  const dx = Math.sin(s * 47) * 6 * tremor;
  const dy = Math.cos(s * 39) * 3 * tremor;
  return { dx, dy, rot: rot * 0.24 + Math.sin(s * 31) * 0.015 * tremor, virado: rot, splash: s > 3.8 && s < 8 ? Math.min(1, (s - 3.8) * 2) * Math.min(1, 8 - s) : 0, s };
}
function inclinar(g) {
  const v = estadoIceberg();
  if (!v) return;
  g.translate(880 + v.dx, 590 + v.dy);
  g.rotate(v.rot);
  g.translate(-880, -590);
}
function fundoIceberg(g) {
  ceu(g, 270, [[0, '#8fa4b8'], [1, '#dfe8ee']]);
  nuvem(g, 80, 60, 1.2, 'rgba(240,244,248,0.9)'); nuvem(g, 420, 40, 1, 'rgba(240,244,248,0.85)'); nuvem(g, 760, 80, 1.3, 'rgba(240,244,248,0.9)');
  // A ilha do clube lá longe, com o farol
  forma(g, '#7f93a6', [580, 262, 640, 236, 700, 228, 760, 240, 840, 232, 900, 262]);
  forma(g, '#eef3f7', [690, 232, 700, 228, 760, 240, 742, 242, 720, 236]);
  ret(g, 655, 222, 5, 18, '#f2eee6'); el(g, 657, 221, 3, 3, '#fff1b0');
  mar(g, 260, H, '#3f7f9e', '#173f5a');
}
function corpoIceberg(g) {
  // Os picos de gelo atrás
  forma(g, '#d6e9f3', [120, 380, 170, 250, 230, 280, 300, 170, 360, 230, 430, 140, 520, 240, 600, 190, 680, 260, 760, 200, 830, 290, 880, 380]);
  forma(g, '#b4d3e6', [300, 170, 360, 230, 330, 380, 260, 380]);
  forma(g, '#b4d3e6', [430, 140, 520, 240, 470, 380, 420, 380]);
  forma(g, '#b4d3e6', [760, 200, 830, 290, 800, 380, 740, 380]);
  forma(g, '#ffffff', [430, 140, 450, 168, 420, 176]);
  // A parte de cima, plana (onde se anda) e a parede da frente
  forma(g, '#8fc0dc', [80, 470, 130, 560, 300, 592, 700, 596, 900, 560, 940, 470]);
  el(g, 510, 452, 440, 110, '#eef7fb');
  el(g, 500, 446, 400, 92, '#f9fdff');
  for (let k = 0; k < 8; k++) el(g, 180 + k * 95, 470 + Math.sin(k * 2) * 40, 26, 6, 'rgba(170,210,230,0.45)');
  // A bandeira lá no alto
  ret(g, 597, 120, 4, 72, '#5b3c22');
}
function bandeiraIceberg(g, t) {
  g.fillStyle = '#e07a2a';
  g.beginPath(); g.moveTo(601, 122);
  for (let k = 0; k <= 6; k++) g.lineTo(601 + k * 7, 122 + Math.sin(t * 7 + k * 0.9) * 3);
  for (let k = 6; k >= 0; k--) g.lineTo(601 + k * 7, 146 + Math.sin(t * 7 + k * 0.9) * 3);
  g.closePath(); g.fill();
  el(g, 622, 134 + Math.sin(t * 7 + 3) * 3, 5, 5, '#f7f3ea');
}
function animarIceberg(g, t) {
  garantirOuvinte();
  brilhoDoMar(g, t, 270, H, 26, 10);
  g.save();
  inclinar(g);
  corpoIceberg(g);
  bandeiraIceberg(g, t);
  g.restore();
  barco(g, 105, 552 + Math.sin(t * 1.2) * 3, t, '#3f6f8a');
  // Espuma batendo no gelo
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.4 + k / 6) % 1;
    el(g, 160 + k * 130, 594 + Math.sin(t + k) * 2, 30 + f * 20, 3, `rgba(255,255,255,${(0.5 * (1 - f)).toFixed(2)})`);
  }
  // A dica do boato
  const recente = ICEBERG.dancando != null && Date.now() - ICEBERG.contagemEm < 45_000;
  const dica = recente ? `${ICEBERG.dancando} de 10 coelhos dançando agora...` : 'Dizem que com 10 coelhos dançando ao mesmo tempo...';
  ret(g, 300, 54, 400, 30, 'rgba(14,30,45,0.6)', 12);
  texto(g, dica, 500, 70, { cor: '#dff2fb', fonte: 'italic 16px "EB Garamond", Georgia, serif' });
}
// O vento com neve e, quando vira, o respingo e o letreiro (por cima de todos).
function porCimaIceberg(g, t) {
  g.restore();
  for (let k = 0; k < 40; k++) {
    const x = ((k * 97 + t * (120 + (k % 5) * 30)) % (W + 100)) - 50;
    const y = (k * 53 + Math.sin(t + k) * 30) % H;
    linha(g, 'rgba(255,255,255,0.55)', 1.4, [x, y, x - 10, y + 2]);
  }
  const v = estadoIceberg();
  if (!v) return;
  if (v.splash > 0) {
    for (let k = 0; k < 30; k++) {
      const a = Math.PI + (k / 30) * Math.PI;
      const r = 40 + v.splash * (90 + (k % 4) * 40);
      el(g, 880 + Math.cos(a) * r * 1.2, 590 + Math.sin(a) * r, 6, 6, `rgba(220,240,255,${(0.9 * v.splash).toFixed(2)})`);
    }
  }
  if (v.virado > 0.5) {
    const pulo = Math.abs(Math.sin(v.s * 5)) * 8;
    texto(g, 'O ICEBERG VIROU!', 500, 170 - pulo, { cor: '#ffe46b', fonte: '700 46px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
    texto(g, 'Brincadeira! Ele sempre volta para o lugar.', 500, 214, { cor: '#ffffff', fonte: 'italic 18px "EB Garamond", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
  }
}

/* ─── O Saltador: Convés ─── */

function fundoNavio(g) {
  ceu(g, 260, [[0, '#5aaee0'], [1, '#d8f0fa']]);
  nuvem(g, 120, 70); nuvem(g, 700, 40, 0.8);
  mar(g, 250, 300, '#4f9fc4', '#2f7fa6');
  forma(g, '#7d8f6a', [0, 252, 60, 236, 140, 230, 220, 252]);
  ret(g, 60, 218, 5, 18, '#f2eee6');
  // O convés
  chaoTabuas(g, 330, H, ['#b0814f', '#a5764a', '#ba8a58'], 'rgba(60,35,15,0.35)', 22);
  // A amurada de trás
  ret(g, 0, 280, W, 8, '#4a2e18');
  for (let x = 6; x < W; x += 36) ret(g, x, 286, 10, 30, '#7a4a2a', 3);
  ret(g, 0, 314, W, 22, '#6b3e24');
  ret(g, 0, 334, W, 4, '#4a2e18');
  // O mastro grande e a escada de corda até o Ninho
  ret(g, 490, 0, 20, 340, '#5b3420');
  for (let k = 0; k < 9; k++) {
    const y = 330 - k * 24;
    const meia = 70 - k * 6;
    linha(g, '#c9ae7a', 2, [500 - meia, y, 500 + meia, y]);
  }
  linha(g, '#c9ae7a', 2.5, [430, 330, 496, 110]);
  linha(g, '#c9ae7a', 2.5, [570, 330, 504, 110]);
  linha(g, '#c9ae7a', 2, [465, 330, 498, 110]);
  linha(g, '#c9ae7a', 2, [535, 330, 502, 110]);
  // O quartel do Capitão (à direita)
  ret(g, 780, 140, 220, 200, '#7a4a2a');
  for (let y = 150; y < 340; y += 18) ret(g, 780, y, 220, 2, 'rgba(40,20,10,0.35)');
  ret(g, 770, 128, 240, 16, '#4a2e18', 3);
  ret(g, 862, 228, 88, 112, '#3a2414', 6);
  ret(g, 868, 234, 76, 106, '#5b3420', 4);
  el(g, 930, 290, 4, 4, '#e8c24a');
  ret(g, 896, 270, 18, 22, '#d8b13a', 4); el(g, 905, 268, 6, 6, 'rgba(0,0,0,0)');
  g.strokeStyle = '#d8b13a'; g.lineWidth = 3; g.beginPath(); g.arc(905, 270, 6, Math.PI, 0); g.stroke();
  for (const x of [800, 960]) { el(g, x + 10, 210, 16, 16, '#3a2414'); el(g, x + 10, 210, 12, 12, '#ffe9a8'); }
  placa(g, 906, 196, 150, 26, 'Quartel do Capitão', { fundo: '#4a2e18', borda: '#2a1a0e', fonte: '700 12px "Cinzel", Georgia, serif' });
  // O alçapão do porão
  forma(g, '#4a2e18', [618, 466, 762, 466, 772, 522, 608, 522]);
  forma(g, '#6b3e24', [626, 470, 754, 470, 762, 518, 618, 518]);
  for (let k = 1; k < 6; k++) linha(g, '#3a2414', 3, [618 + k * 24, 470, 614 + k * 25, 518]);
  linha(g, '#3a2414', 3, [622, 494, 766, 494]);
  texto(g, 'Porão', 690, 540, { cor: '#f4dd80', fonte: '700 13px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
  // A prancha de volta para a Praia
  forma(g, '#8a6240', [0, 420, 90, 440, 90, 520, 0, 540]);
  for (let k = 0; k < 4; k++) linha(g, '#5b3c22', 2, [k * 22, 425 + k * 4, k * 22, 535 - k * 4]);
  placaPoste(g, 70, 420, '← Praia');
}
function velas(g, t) {
  const sopro = Math.sin(t * 1.4) * 6;
  for (const [y0, y1, w] of [[30, 140, 150], [160, 260, 180]]) {
    ret(g, 500 - w - 8, y0 - 6, (w + 8) * 2, 7, '#4a2e18', 3);
    g.fillStyle = '#f2e8cf';
    g.beginPath();
    g.moveTo(500 - w, y0);
    g.lineTo(500 + w, y0);
    g.quadraticCurveTo(500 + w + 10 + sopro, (y0 + y1) / 2, 500 + w - 6, y1);
    g.quadraticCurveTo(500, y1 + 18 + sopro, 500 - w + 6, y1);
    g.quadraticCurveTo(500 - w - 10 - sopro, (y0 + y1) / 2, 500 - w, y0);
    g.fill();
    for (let k = 1; k < 4; k++) linha(g, 'rgba(150,120,80,0.35)', 1.5, [500 - w + k * w / 2, y0, 500 - w + k * w / 2 + sopro * 0.3, y1 + 4]);
  }
  // O emblema da cenoura na vela de baixo
  g.save(); g.translate(500, 210 + sopro * 0.3); g.rotate(0.5);
  forma(g, '#e07a2a', [-9, -26, 9, -26, 0, 26]);
  el(g, 0, -30, 5, 9, '#4f8a3c');
  g.restore();
  // A bandeira lá no topo
  g.fillStyle = '#1b1b22';
  g.beginPath(); g.moveTo(510, 4);
  for (let k = 0; k <= 7; k++) g.lineTo(510 + k * 8, 4 + Math.sin(t * 6 + k * 0.8) * 3);
  for (let k = 7; k >= 0; k--) g.lineTo(510 + k * 8, 30 + Math.sin(t * 6 + k * 0.8) * 3);
  g.closePath(); g.fill();
}
function canhao(g, x, y, dir = 1) {
  sombraNoChao(g, x, y + 2, 46, 10);
  g.save(); g.translate(x, y); g.scale(dir, 1);
  if (!sp(g, 'canhao', 'parado', 0, 0, { quadro: 0 })) corpoCanhao(g);
  g.restore();
}
function corpoCanhao(g) {
  ret(g, -34, -24, 60, 18, '#6b3e24', 4);
  el(g, -22, -6, 10, 10, '#4a2e18'); el(g, 16, -6, 10, 10, '#4a2e18');
  g.save(); g.translate(-4, -32); g.rotate(-0.18);
  ret(g, -30, -10, 72, 20, '#2f2f38', 9);
  ret(g, 36, -12, 10, 24, '#1f1f26', 4);
  el(g, -30, 0, 9, 9, '#2f2f38');
  ret(g, 6, -10, 5, 20, '#4a4a55');
  g.restore();
}
function balasCanhao(g, x, y) {
  for (const [dx, dy] of [[-10, 0], [10, 0], [0, -14]]) el(g, x + dx, y + dy - 8, 9, 9, '#2f2f38');
}
function capitaoNoConves(g, t) {
  npc(g, 'npc-capitao', 330, 420, t, 1);
  const ciclo = 6;
  const i = Math.floor(t / ciclo) % FALAS_CAPITAO.length;
  const f = (t % ciclo) / ciclo;
  balaoFala(g, 330, 330, FALAS_CAPITAO[i], f < 0.08 ? f / 0.08 : f > 0.85 ? (1 - f) / 0.15 : 1);
}

/* ─── Ninho do Corvo ─── */

function fundoNinho(g) {
  ceu(g, 360, [[0, '#2f7fc4'], [1, '#c4e6f8']]);
  nuvem(g, 60, 220, 1.1); nuvem(g, 760, 260, 1.3); nuvem(g, 380, 300, 0.7);
  mar(g, 350, H, '#3f8fb8', '#1d5f86');
  // A ilha do clube vista de cima: morro nevado, o farol e a praia
  forma(g, '#e3c48a', [0, 420, 40, 386, 180, 374, 300, 390, 330, 420, 260, 440, 0, 446]);
  forma(g, '#6d9a52', [0, 410, 40, 376, 160, 360, 260, 376, 290, 404, 0, 420]);
  forma(g, '#f4f9fc', [40, 376, 90, 330, 130, 352, 160, 360]);
  ret(g, 220, 352, 6, 22, '#f2eee6'); ret(g, 220, 360, 6, 4, '#d0473a');
  for (let k = 0; k < 5; k++) ret(g, 70 + k * 26, 392, 12, 9, ['#c98d55', '#e9dcc3', '#7a5aa0', '#b5523a', '#6f8fa6'][k], 2);
  // O iceberg lá longe
  forma(g, '#f2f8fb', [860, 370, 880, 352, 900, 358, 920, 346, 944, 370]);
  // Os cabos descendo para o convés
  for (const [x0, x1] of [[300, 120], [320, 220], [700, 880], [680, 780]]) linha(g, '#8a6a44', 2.5, [x0, 470, x1, H]);
  // O mastro, o cesto e a abertura da escada
  ret(g, 488, 0, 24, 470, '#5b3420');
  el(g, 500, 470, 250, 70, '#6b3e24');
  el(g, 500, 486, 232, 60, '#a5764a');
  for (let k = -4; k <= 4; k++) linha(g, 'rgba(60,35,15,0.35)', 1.5, [500 + k * 52, 430, 500 + k * 58, 545]);
  el(g, 370, 506, 34, 12, '#2a1a0e');
  for (let k = 0; k < 3; k++) ret(g, 352 + k * 0, 500 + k * 4, 36, 3, '#c9ae7a');
  ret(g, 250, 540, 500, 60, '#6b3e24');
  for (let x = 254; x < 750; x += 22) ret(g, x, 540, 3, 60, 'rgba(40,20,10,0.4)');
  ret(g, 246, 532, 508, 12, '#4a2e18', 4);
  texto(g, 'Descer', 370, 528, { cor: '#f4dd80', fonte: '700 12px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
}
function animarNinho(g, t) {
  brilhoDoMar(g, t, 360, H, 18, 8);
  // A bandeira do Saltador no alto do mastro
  g.fillStyle = '#1b1b22';
  g.beginPath(); g.moveTo(512, 10);
  for (let k = 0; k <= 10; k++) g.lineTo(512 + k * 9, 10 + Math.sin(t * 6 + k * 0.7) * 5);
  for (let k = 10; k >= 0; k--) g.lineTo(512 + k * 9, 66 + Math.sin(t * 6 + k * 0.7) * 5);
  g.closePath(); g.fill();
  const by = 38 + Math.sin(t * 6 + 4) * 5;
  forma(g, '#e07a2a', [548, by - 14, 562, by - 14, 555, by + 14]);
  el(g, 555, by - 17, 4, 6, '#4f8a3c');
  linha(g, '#f7f3ea', 3, [536, by - 12, 576, by + 12]);
  linha(g, '#f7f3ea', 3, [536, by + 12, 576, by - 12]);
  gaivotas(g, t, 6, 90, 330, 45, 1.3);
  for (let k = 0; k < 8; k++) {
    const x = ((k * 211 + t * 160) % (W + 200)) - 100;
    const y = 120 + (k * 61) % 300;
    linha(g, 'rgba(255,255,255,0.35)', 1.2, [x, y, x - 40, y]);
  }
}
function luneta(g, x, y) {
  sombraNoChao(g, x, y + 2, 22, 6);
  ret(g, x - 4, y - 50, 8, 50, '#5b3420');
  g.save(); g.translate(x, y - 56); g.rotate(-0.2);
  ret(g, -34, -7, 68, 14, '#b8922a', 6);
  ret(g, 28, -9, 12, 18, '#8a6a20', 4);
  ret(g, -10, -7, 4, 14, '#e8c24a');
  g.restore();
}

/* ─── Porão ─── */

function fundoPorao(g) {
  g.fillStyle = grad(g, 0, 0, 0, 400, [[0, '#24170d'], [1, '#3a2616']]);
  g.fillRect(0, 0, W, 400);
  for (let x = 0; x < W; x += 30) ret(g, x, 0, 28, 400, x % 60 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)');
  // As costelas do casco
  for (const x of [60, 300, 700, 940]) {
    g.strokeStyle = '#1b1008'; g.lineWidth = 18;
    g.beginPath(); g.moveTo(x, 400); g.quadraticCurveTo(x + (x < 500 ? -40 : 40), 200, x + (x < 500 ? 60 : -60), 0); g.stroke();
  }
  // A prateleira dos itens raros
  ret(g, 320, 130, 310, 180, '#4a2e18', 6);
  ret(g, 328, 138, 294, 164, '#2a1a0e', 4);
  for (const y of [218, 296]) ret(g, 328, y, 294, 8, '#6b3e24');
  // Itens: patinho de borracha gigante, meia furada, lata de ar, pompom, chaleira dourada, mapa rasgado
  el(g, 370, 196, 22, 18, '#f4dd80'); el(g, 384, 176, 12, 11, '#f4dd80'); el(g, 396, 178, 6, 3, '#e07a2a'); el(g, 386, 173, 2, 2, '#1b1403');
  forma(g, '#e05a8a', [430, 160, 448, 160, 448, 196, 470, 200, 470, 214, 430, 214]);
  for (let k = 0; k < 3; k++) ret(g, 430, 168 + k * 12, 18, 4, '#f7f3ea');
  el(g, 462, 207, 3, 3, '#2a1a0e');
  ret(g, 500, 166, 34, 50, '#9aa3ad', 4); ret(g, 500, 180, 34, 18, '#f2e8cf'); texto(g, 'AR', 517, 190, { cor: '#2a2016', fonte: '700 10px sans-serif' });
  el(g, 584, 196, 22, 22, '#7b5ab8'); el(g, 578, 190, 5, 5, '#ffffff'); el(g, 590, 190, 5, 5, '#ffffff'); el(g, 578, 191, 2, 2, '#1b1403'); el(g, 590, 191, 2, 2, '#1b1403');
  el(g, 380, 276, 26, 18, '#e8c24a'); ret(g, 400, 262, 16, 6, '#e8c24a', 3); ret(g, 372, 252, 16, 8, '#d8b13a', 3);
  forma(g, '#e8dcc0', [440, 256, 500, 250, 506, 292, 446, 296]);
  linha(g, '#c0392b', 2, [460, 266, 474, 282]); linha(g, '#c0392b', 2, [474, 266, 460, 282]);
  forma(g, '#e8dcc0', [520, 254, 560, 258, 556, 294, 522, 290]);
  ret(g, 576, 250, 36, 44, '#3a3a44', 4); ret(g, 584, 258, 20, 20, '#9fd6f2', 3);
  placa(g, 475, 116, 190, 26, 'Coisas raras do Capitão', { fundo: '#6b3e24', borda: '#2a1a0e', fonte: '700 12px "Cinzel", Georgia, serif' });
  // A escada para o convés, com a luz que entra pelo alçapão
  for (const x of [90, 160]) ret(g, x, 110, 8, 310, '#6b3e24');
  for (let y = 130; y < 420; y += 28) ret(g, 90, y, 78, 6, '#8a5a32');
  chaoTabuas(g, 400, H, ['#5b3c22', '#4f341e', '#644228'], 'rgba(20,10,5,0.45)', 31);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 400, W, 200);
}
function animarPorao(g, t) {
  g.fillStyle = 'rgba(255,240,190,0.1)';
  g.beginPath(); g.moveTo(80, 0); g.lineTo(190, 0); g.lineTo(300, 600); g.lineTo(60, 600); g.closePath(); g.fill();
  // Lanternas balançando
  for (const [x, fase] of [[280, 0], [760, 1.7]]) {
    const a = Math.sin(t * 1.2 + fase) * 0.12;
    const lx = x + Math.sin(a) * 90;
    const ly = 20 + Math.cos(a) * 90;
    linha(g, '#1b1008', 2, [x, 0, lx, ly]);
    brilho(g, lx, ly + 20, 160, 'rgba(255,200,110,A)', 0.32 + Math.sin(t * 7 + fase) * 0.03);
    ret(g, lx - 12, ly, 24, 30, '#2a1a0e', 4);
    ret(g, lx - 8, ly + 4, 16, 22, '#ffd98a', 3);
  }
  // Uma gota pingando
  const f = (t * 0.6) % 1;
  if (f < 0.8) el(g, 860, 60 + f * 440, 2, 3, 'rgba(160,210,240,0.7)');
  else { const r = (f - 0.8) * 60; g.strokeStyle = `rgba(160,210,240,${(1 - (f - 0.8) * 5).toFixed(2)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(860, 500, r, r * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
  // Um ratinho passando de vez em quando
  const c = t % 14;
  if (c < 3) {
    const x = 980 - (c / 3) * 1000;
    el(g, x, 580, 9, 5, '#8a837a'); el(g, x - 8, 576, 4, 4, '#8a837a'); el(g, x - 7, 573, 2, 3, '#e2b3a3');
    linha(g, '#8a837a', 1.2, [x + 8, 580, x + 20, 576 + Math.sin(t * 20) * 2]);
  }
}
function bauRaro(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 64, 14);
  brilho(g, x, y - 50, 110, 'rgba(255,220,120,A)', 0.2 + Math.sin(t * 2.5) * 0.08);
  if (!sp(g, 'bau-raro', 'brilhando', x, y, { t })) corpoBauRaro(g, x, y, t);
}
function corpoBauRaro(g, x, y, t) {
  ret(g, x - 62, y - 58, 124, 58, '#7a4a2a', 6);
  g.fillStyle = '#8a5a32';
  g.beginPath(); g.ellipse(x, y - 58, 62, 26, 0, Math.PI, 0); g.fill();
  for (const dx of [-50, 42]) ret(g, x + dx, y - 84, 8, 84, '#d8b13a');
  ret(g, x - 62, y - 62, 124, 7, '#d8b13a');
  ret(g, x - 12, y - 52, 24, 22, '#e8c24a', 3);
  el(g, x, y - 42, 3, 4, '#3a2414');
  for (let k = 0; k < 3; k++) {
    const a = Math.max(0, Math.sin(t * 3 + k * 2));
    el(g, x - 40 + k * 40, y - 90 - k * 6, 2 + a * 3, 2 + a * 3, `rgba(255,250,200,${a.toFixed(2)})`);
  }
}

/* ─── Quartel do Capitão ─── */

function fundoCapitao(g) {
  g.fillStyle = '#6b3e24';
  g.fillRect(0, 0, W, 380);
  for (let y = 0; y < 380; y += 22) ret(g, 0, y, W, 2, 'rgba(30,15,5,0.4)');
  for (let x = 0; x < W; x += 140) ret(g, x, 0, 10, 380, '#4a2e18');
  // As janelas de popa, com o mar no pôr do sol
  ret(g, 280, 60, 440, 220, '#3a2414', 8);
  g.fillStyle = grad(g, 0, 70, 0, 270, [[0, '#f29a6a'], [0.55, '#ffd9a0'], [0.56, '#3f7fa6'], [1, '#1d4f72']]);
  g.fillRect(292, 72, 416, 196);
  el(g, 560, 176, 26, 26, '#fff0c0');
  for (let k = 0; k < 8; k++) ret(g, 520 - k * 4, 186 + k * 10, 80 + k * 8, 2, 'rgba(255,230,170,0.4)', 1);
  for (let x = 292; x < 708; x += 104) ret(g, x + 100, 72, 6, 196, '#3a2414');
  ret(g, 292, 166, 416, 6, '#3a2414');
  forma(g, '#a8343e', [260, 50, 320, 50, 300, 300, 250, 300]);
  forma(g, '#a8343e', [740, 50, 680, 50, 700, 300, 750, 300]);
  // A estante e o mapa na parede
  ret(g, 770, 100, 170, 240, '#4a2e18', 4);
  for (let p = 0; p < 4; p++) {
    ret(g, 776, 150 + p * 56, 158, 6, '#7a4a2a');
    for (let k = 0; k < 9; k++) ret(g, 782 + k * 16, 112 + p * 56 + (k % 3) * 3, 13, 38 - (k % 3) * 3, ['#c0392b', '#2f6b34', '#d8b13a', '#5aa0d8', '#7b5ab8'][(k + p) % 5], 1);
  }
  forma(g, '#e8dcc0', [80, 90, 220, 84, 226, 190, 74, 196]);
  linha(g, '#8a6a44', 2, [100, 170, 130, 130, 160, 150, 200, 110]);
  linha(g, '#c0392b', 3, [192, 104, 204, 116]); linha(g, '#c0392b', 3, [204, 104, 192, 116]);
  // A rede de dormir
  g.fillStyle = '#d8c08a';
  g.beginPath(); g.moveTo(40, 240); g.quadraticCurveTo(150, 330, 250, 240); g.lineTo(250, 250); g.quadraticCurveTo(150, 340, 40, 250); g.closePath(); g.fill();
  chaoTabuas(g, 380, H, ['#8a5a32', '#7f532e', '#946238'], 'rgba(40,20,10,0.4)', 41);
  el(g, 500, 480, 280, 70, '#8a2f3a'); el(g, 500, 480, 250, 58, '#a8434e'); el(g, 500, 480, 200, 40, '#d8b13a'); el(g, 500, 480, 186, 34, '#a8434e');
  // A porta de volta para o convés
  ret(g, 0, 300, 90, 270, '#3a2414');
  ret(g, 8, 310, 74, 260, '#5b3420', 4);
  el(g, 70, 450, 4, 4, '#e8c24a');
  placaPoste(g, 120, 400, '← Convés');
}
function mesaMapa(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 110, 18);
  ret(g, x - 110, y - 70, 220, 14, '#5b3420', 4);
  for (const dx of [-96, 86]) ret(g, x + dx, y - 56, 12, 56, '#4a2e18');
  forma(g, '#efe2bf', [x - 90, y - 72, x + 86, y - 76, x + 92, y - 104, x - 84, y - 102]);
  linha(g, '#8a6a44', 1.5, [x - 70, y - 82, x - 30, y - 96, x + 10, y - 86, x + 50, y - 98]);
  linha(g, '#c0392b', 3, [x + 52, y - 94, x + 62, y - 84]); linha(g, '#c0392b', 3, [x + 62, y - 94, x + 52, y - 84]);
  el(g, x - 60, y - 88, 10, 4, '#b8922a');
  ret(g, x + 70, y - 100, 10, 22, '#f2e8cf', 2);
  el(g, x + 75, y - 104, 3, 5 + Math.sin(t * 9), '#ffcc66');
  brilho(g, x + 75, y - 104, 80, 'rgba(255,210,130,A)', 0.3);
}
function pomPomPirata(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 20, 5);
  ret(g, x - 3, y - 90, 6, 90, '#5b3420');
  ret(g, x - 22, y - 92, 44, 6, '#4a2e18', 3);
  const pulo = Math.abs(Math.sin(t * 3)) * 5;
  el(g, x, y - 112 - pulo, 18, 17, '#d8504a');
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; el(g, x + Math.cos(a) * 16, y - 112 - pulo + Math.sin(a) * 15, 4, 4, '#e86a5a'); }
  ret(g, x - 18, y - 128 - pulo, 36, 8, '#1b1b22', 4);
  el(g, x - 6, y - 112 - pulo, 3, 3.5, '#1b1403'); ret(g, x + 2, y - 116 - pulo, 9, 6, '#1b1b22', 2);
}
function bauCapitao(g, x, y) {
  sombraNoChao(g, x, y + 2, 50, 12);
  ret(g, x - 46, y - 46, 92, 46, '#5b3420', 5);
  g.fillStyle = '#6b3e24';
  g.beginPath(); g.ellipse(x, y - 46, 46, 20, 0, Math.PI, 0); g.fill();
  for (const dx of [-36, 30]) ret(g, x + dx, y - 66, 6, 66, '#9aa3ad');
  for (let k = 0; k < 3; k++) { ret(g, x - 18 + k * 13, y - 36, 10, 12, '#9aa3ad', 2); }
}

/* ─── As salas ─── */

const PRA_TRAS = -100000; // objeto desenhado antes de todos (o iceberg inclina tudo o que vem depois)
const PRA_FRENTE = 100000;

const SALAS = {
  floresta: {
    fundo: fundoFloresta, animar: animarFloresta,
    objetos: [
      { y: 365, desenhar: g => arvoreAlta(g, 150, 365, 300) }, { y: 362, desenhar: g => arvoreAlta(g, 860, 362, 280) },
      { y: 400, desenhar: g => barraca(g, 250, 400, '#e07a2a', '#a8501c') },
      { y: 396, desenhar: g => barraca(g, 740, 396, '#4f8a6c', '#2f6048') },
      { y: 470, desenhar: (g, t) => fogueira(g, 500, 470, t) },
      { y: 452, desenhar: g => tronco(g, 375, 452, 120) }, { y: 452, desenhar: g => tronco(g, 625, 452, 120) },
      { y: 540, desenhar: g => tronco(g, 500, 540, 140) },
    ],
    pontos: [
      { x0: 440, y0: 380, x1: 560, y1: 480, ir: [500, 500], acao: 'fogueira', rotulo: 'Esquentar as patas na fogueira' },
      { x0: 310, y0: 420, x1: 440, y1: 460, ir: [375, 446], acao: 'sentar', rotulo: 'Sentar no tronco' },
      { x0: 560, y0: 420, x1: 690, y1: 460, ir: [625, 446], acao: 'sentar', rotulo: 'Sentar no tronco' },
      { x0: 425, y0: 508, x1: 575, y1: 548, ir: [500, 534], acao: 'sentar', rotulo: 'Sentar no tronco' },
      { x0: 170, y0: 290, x1: 330, y1: 400, ir: [250, 420], acao: 'barraca', rotulo: 'Barraca laranja' },
      { x0: 660, y0: 286, x1: 820, y1: 396, ir: [740, 416], acao: 'barraca', rotulo: 'Barraca verde' },
      { x0: 900, y0: 380, x1: 1000, y1: 560, ir: [950, 475], acao: 'sala:plaza', rotulo: 'Ir para a Plaza' },
      { x0: 0, y0: 380, x1: 100, y1: 560, ir: [45, 480], acao: 'sala:prainha', rotulo: 'Ir para a Prainha' },
    ],
  },
  prainha: {
    fundo: fundoPrainha, animar: animarPrainha,
    objetos: [
      { y: 410, desenhar: g => prancha(g, 345, 410, '#e05a5a', -0.12) },
      { y: 414, desenhar: g => prancha(g, 380, 414, '#5aa0d8', 0.05) },
      { y: 408, desenhar: g => prancha(g, 412, 408, '#f4dd80', 0.16) },
      { y: 430, desenhar: (g, t) => cadeiraSalvaVidas(g, 820, 430, t) },
      { y: 520, desenhar: g => guardaSol(g, 600, 520, ['#5aa0d8', '#f4dd80']) },
      { y: 545, desenhar: g => toalha(g, 660, 545, '#e48ab8') },
    ],
    pontos: [
      { x0: 100, y0: 200, x1: 430, y1: 410, ir: [300, 430], acao: 'surfe', rotulo: 'Pegando Ondas (surfe)' },
      { x0: 770, y0: 230, x1: 880, y1: 430, ir: [760, 450], acao: 'salvaVidas', rotulo: 'Falar com a salva-vidas' },
      { x0: 0, y0: 400, x1: 90, y1: 570, ir: [45, 490], acao: 'sala:floresta', rotulo: 'Voltar à Floresta' },
    ],
  },
  ancoradouro: {
    fundo: fundoAncoradouro, animar: animarAncoradouro,
    objetos: [
      { y: 450, desenhar: (g, t) => buracoNoGelo(g, 300, 450, t) },
      { y: 430, desenhar: g => caixote(g, 800, 430) }, { y: 428, desenhar: g => caixote(g, 850, 404, 0.8) },
      { y: 470, desenhar: g => barril(g, 740, 470) }, { y: 520, desenhar: g => corda(g, 560, 520) },
    ],
    pontos: [
      { x0: 120, y0: 210, x1: 370, y1: 470, ir: [230, 470], acao: 'pescaGelo', rotulo: 'Pescaria no Gelo' },
      { x0: 550, y0: 290, x1: 740, y1: 378, ir: [640, 398], acao: 'sala:iceberg', rotulo: 'Barco para o Grande Iceberg' },
      { x0: 0, y0: 390, x1: 90, y1: 570, ir: [45, 480], acao: 'sala:praca', rotulo: 'Voltar à Praça' },
      { x0: 910, y0: 390, x1: 1000, y1: 570, ir: [955, 480], acao: 'sala:praia', rotulo: 'Ir para a Praia' },
    ],
  },
  praia: {
    fundo: fundoPraia, animar: animarPraia,
    objetos: [
      { y: 470, desenhar: g => guardaSol(g, 520, 470, ['#e05a5a', '#f7f3ea']) },
      { y: 492, desenhar: g => toalha(g, 560, 492, '#5aa0d8') },
      { y: 540, desenhar: g => guardaSol(g, 700, 540, ['#7fb069', '#f4dd80']) },
      { y: 560, desenhar: g => toalha(g, 760, 560, '#f4dd80') },
      { y: 540, desenhar: g => castelinho(g, 330, 540) },
    ],
    pontos: [
      { x0: 120, y0: 260, x1: 200, y1: 380, ir: [160, 398], acao: 'sala:farol', rotulo: 'Entrar no Farol' },
      { x0: 330, y0: 250, x1: 430, y1: 385, ir: [380, 398], acao: 'sala:vila_esqui', rotulo: 'Subir para a Vila de Esqui' },
      { x0: 790, y0: 120, x1: 990, y1: 385, ir: [860, 405], acao: 'sala:navio', rotulo: 'Subir no Saltador' },
      { x0: 0, y0: 400, x1: 100, y1: 570, ir: [45, 495], acao: 'sala:ancoradouro', rotulo: 'Ir para o Ancoradouro' },
    ],
  },
  farol: {
    fundo: fundoFarol, animar: animarFarol,
    objetos: [
      { y: 440, desenhar: g => piano(g, 210, 440) },
      { y: 470, desenhar: g => tambor(g, 360, 470) },
      { y: 430, desenhar: (g, t) => mesaFaroleiro(g, 610, 430, t) },
    ],
    pontos: [
      { x0: 110, y0: 280, x1: 310, y1: 445, ir: [220, 465], acao: 'piano', rotulo: 'Tocar o piano' },
      { x0: 320, y0: 410, x1: 400, y1: 475, ir: [400, 490], acao: 'tambor', rotulo: 'Tocar o tambor' },
      { x0: 540, y0: 340, x1: 680, y1: 435, ir: [610, 455], acao: 'diario', rotulo: 'Diário do faroleiro' },
      { x0: 720, y0: 120, x1: 940, y1: 420, ir: [800, 425], acao: 'sala:mirante', rotulo: 'Subir para o Mirante' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:praia', rotulo: 'Sair para a Praia' },
    ],
  },
  mirante: {
    fundo: fundoMirante, animar: animarMirante,
    objetos: [
      { y: 470, desenhar: (g, t) => estacaoJato(g, 190, 470, t) },
      { y: 470, desenhar: g => telescopio(g, 810, 470) },
    ],
    pontos: [
      { x0: 100, y0: 310, x1: 280, y1: 475, ir: [200, 490], acao: 'jato', rotulo: 'Aventura a Jato' },
      { x0: 760, y0: 370, x1: 870, y1: 475, ir: [770, 490], acao: 'telescopio', rotulo: 'Olhar no telescópio' },
      { x0: 400, y0: 110, x1: 600, y1: 300, ir: [500, 430], acao: 'lampada', rotulo: 'A grande lâmpada' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:farol', rotulo: 'Descer para o Farol' },
    ],
  },
  iceberg: {
    fundo: fundoIceberg, animar: animarIceberg,
    objetos: [
      { y: PRA_TRAS, desenhar: g => { g.save(); inclinar(g); } },
      { y: PRA_FRENTE, desenhar: porCimaIceberg },
    ],
    pontos: [
      { x0: 20, y0: 490, x1: 190, y1: 575, ir: [190, 520], acao: 'sala:ancoradouro', rotulo: 'Barco de volta ao Ancoradouro' },
      { x0: 300, y0: 50, x1: 700, y1: 90, ir: [500, 380], acao: 'boatoIceberg', rotulo: 'O boato do Iceberg' },
    ],
  },
  navio: {
    fundo: fundoNavio, animar: velas,
    objetos: [
      { y: 370, desenhar: g => canhao(g, 180, 370, -1) }, { y: 372, desenhar: g => balasCanhao(g, 120, 372) },
      { y: 372, desenhar: g => canhao(g, 690, 372, 1) },
      { y: 420, desenhar: capitaoNoConves },
      { y: 470, desenhar: g => barril(g, 860, 470) }, { y: 520, desenhar: g => corda(g, 900, 520) },
    ],
    pontos: [
      { x0: 280, y0: 330, x1: 380, y1: 430, ir: [395, 440], acao: 'falarCapitao', rotulo: 'Falar com o Capitão Saltarrocha' },
      { x0: 420, y0: 110, x1: 580, y1: 345, ir: [500, 365], acao: 'sala:ninho', rotulo: 'Subir ao Ninho do Corvo' },
      { x0: 610, y0: 462, x1: 770, y1: 525, ir: [690, 500], acao: 'sala:porao', rotulo: 'Descer ao Porão' },
      { x0: 855, y0: 220, x1: 955, y1: 345, ir: [905, 365], acao: 'portaCapitao', rotulo: 'Quartel do Capitão' },
      { x0: 120, y0: 330, x1: 240, y1: 375, ir: [200, 395], acao: 'canhao', rotulo: 'Canhão' },
      { x0: 0, y0: 400, x1: 95, y1: 560, ir: [50, 480], acao: 'sala:praia', rotulo: 'Descer para a Praia' },
    ],
  },
  ninho: {
    fundo: fundoNinho, animar: animarNinho,
    objetos: [{ y: 470, desenhar: g => luneta(g, 640, 470) }],
    pontos: [
      { x0: 600, y0: 390, x1: 690, y1: 475, ir: [600, 485], acao: 'luneta', rotulo: 'Olhar na luneta' },
      { x0: 330, y0: 490, x1: 410, y1: 535, ir: [372, 505], acao: 'sala:navio', rotulo: 'Descer para o Convés' },
    ],
  },
  porao: {
    fundo: fundoPorao, animar: animarPorao,
    objetos: [
      { y: 470, desenhar: (g, t) => bauRaro(g, 640, 470, t) },
      { y: 440, desenhar: g => caixote(g, 270, 440) }, { y: 442, desenhar: g => caixote(g, 330, 442, 0.9) }, { y: 446, desenhar: g => caixote(g, 296, 394, 0.8) },
      { y: 440, desenhar: g => barril(g, 860, 440) }, { y: 470, desenhar: g => barril(g, 910, 470, 0.9) },
    ],
    pontos: [
      { x0: 570, y0: 370, x1: 710, y1: 480, ir: [640, 498], acao: 'bau', rotulo: 'Baú de itens raros' },
      { x0: 320, y0: 110, x1: 630, y1: 310, ir: [470, 420], acao: 'raridades', rotulo: 'Coisas raras do Capitão' },
      { x0: 80, y0: 110, x1: 190, y1: 430, ir: [150, 445], acao: 'sala:navio', rotulo: 'Subir para o Convés' },
    ],
  },
  capitao: {
    fundo: fundoCapitao,
    objetos: [
      { y: 470, desenhar: (g, t) => mesaMapa(g, 500, 470, t) },
      { y: 440, desenhar: g => bauCapitao(g, 840, 440) },
      { y: 420, desenhar: (g, t) => pomPomPirata(g, 230, 420, t) },
    ],
    pontos: [
      { x0: 390, y0: 360, x1: 610, y1: 480, ir: [500, 500], acao: 'tesouro', rotulo: 'Caça ao Tesouro' },
      { x0: 790, y0: 370, x1: 890, y1: 445, ir: [840, 460], acao: 'bauCapitao', rotulo: 'Baú do Capitão' },
      { x0: 200, y0: 270, x1: 260, y1: 425, ir: [260, 440], acao: 'pompom', rotulo: 'O Pompom pirata' },
      { x0: 0, y0: 300, x1: 95, y1: 570, ir: [60, 470], acao: 'sala:navio', rotulo: 'Voltar ao Convés' },
    ],
  },
};

const INFO = {
  floresta: { nome: 'Floresta', desc: 'Acampamento entre os pinheiros, com fogueira e vaga-lumes.', regiao: 'litoral', icone: 'jardim', mapa: { x: 200, y: 260 } },
  prainha: { nome: 'Prainha', desc: 'A enseada das ondas: surfe no Pegando Ondas.', regiao: 'litoral', icone: 'gota', mapa: { x: 110, y: 390 } },
  ancoradouro: { nome: 'Ancoradouro', desc: 'O deque, os barcos e a Pescaria no Gelo.', regiao: 'litoral', icone: 'peixe', mapa: { x: 440, y: 465 } },
  praia: { nome: 'Praia', desc: 'Areia, guarda-sóis, o Farol e o Saltador ancorado.', regiao: 'litoral', icone: 'porto', mapa: { x: 660, y: 490 } },
  farol: { nome: 'Farol', desc: 'O piano do faroleiro e a escada para o Mirante.', regiao: 'litoral', icone: 'torre', mapa: { x: 560, y: 535 } },
  mirante: { nome: 'Mirante do Farol', desc: 'A grande lâmpada, o telescópio e a Aventura a Jato.', regiao: 'litoral', icone: 'torre', mapa: null },
  iceberg: { nome: 'O Grande Iceberg', desc: 'Gelo, vento e um boato: 10 coelhos dançando e ele vira!', regiao: 'litoral', icone: 'estrela', mapa: { x: 920, y: 520 } },
  navio: { nome: 'Convés do Saltador', desc: 'O navio do Capitão Saltarrocha, ancorado perto da Praia.', regiao: 'litoral', icone: 'bandeira', mapa: { x: 775, y: 560 } },
  ninho: { nome: 'Ninho do Corvo', desc: 'O alto do mastro, com a luneta.', regiao: 'litoral', icone: 'alvo', mapa: null },
  porao: { nome: 'Porão do Saltador', desc: 'Caixotes, barris e o Baú de itens raros.', regiao: 'litoral', icone: 'bau', mapa: null },
  capitao: { nome: 'Quartel do Capitão', desc: 'O mapa do tesouro e o Pompom pirata (precisa da chave).', regiao: 'litoral', icone: 'chave', mapa: null },
};

/* ─── Ações dos pontos de clique ─── */

const umDe = lista => lista[Math.floor(Math.random() * lista.length)];
const jogos = () => import('./litoral-jogos.js');
export const RARIDADES = [
  'Um patinho de borracha do tamanho de um barril. O Capitão jura que ele salvou o navio uma vez.',
  'Uma meia listrada com um furo. "Do lado de lá do mundo, isso é moda", diz o Capitão.',
  'Uma lata de "Ar puro do Polo Norte". Ninguém tem coragem de abrir.',
  'Um Pompom de pelúcia roxo que pisca quando ninguém está olhando.',
  'Uma chaleira dourada que só faz chá de cenoura.',
  'Um mapa rasgado de um lugar que talvez nem exista.',
  'Uma garrafa com um bilhete: "Volto logo. Assinado, o Raposo". Hmm...',
  'Uma bússola que aponta sempre para o bolo mais próximo.',
  'Um chapéu de pirata minúsculo, para um Pompom muito corajoso.',
  'Uma concha que, encostada na orelha, toca a música do Salão de Dança.',
];
const ACOES = {
  sentar(ctx) { ctx.enviar('clube:emote', { e: 'sentar' }); },
  fogueira(ctx) {
    ctx.aviso(umDe(['Você assa um marshmallow de cenoura. Delícia!', 'As patas ficam quentinhas perto do fogo.', 'Alguém começa a contar uma história de fantasma... do Raposo!', 'Os vaga-lumes dançam em volta da fogueira.']));
    ctx.enviar('clube:emote', { e: 'cenoura' });
  },
  barraca(ctx) { ctx.aviso(umDe(['Zzz... alguém está tirando um cochilo aí dentro.', 'Dentro da barraca: um saco de dormir e uma lanterna.', 'Tem um bilhete: "Fui surfar. Volto para o jantar."'])); },
  salvaVidas(ctx) { ctx.aviso(umDe(['"Nada de nadar depois de comer cenoura!"', '"As ondas estão ótimas hoje. Pegue uma prancha!"', '"Estou de olho em todo mundo. Até no sorvete de alguém ali."'])); },
  tambor(ctx) { ctx.aviso('Tum, tum, tum! O farol inteiro faz eco.'); ctx.enviar('clube:emote', { e: 'estrela' }); },
  diario(ctx) {
    ctx.aviso(umDe([
      'Diário do faroleiro, dia 12: o Capitão Saltarrocha buzinou três vezes ao chegar. Ninguém sabe por quê.',
      'Diário do faroleiro, dia 30: vi uma sombra de raposa no Ancoradouro. Deixei a luz mais forte.',
      'Diário do faroleiro, dia 41: dez coelhos dançaram no Iceberg. Eu vi ele balançar. Juro!',
    ]));
  },
  lampada(ctx) { ctx.aviso('A grande lâmpada do farol guia os barcos à noite. Não olhe direto para ela!'); },
  boatoIceberg(ctx) { ctx.aviso('Dizem que, se 10 coelhos ou mais dançarem aqui ao mesmo tempo, o Grande Iceberg vira. Chame os amigos e aperte "Dançar"!'); },
  falarCapitao(ctx) { ctx.aviso(`Capitão Saltarrocha: "${umDe(FALAS_CAPITAO)}"`); },
  canhao(ctx) { ctx.aviso('BUM! Só confete. O Capitão não gosta de bagunça no convés.'); ctx.enviar('clube:emote', { e: 'susto' }); },
  async portaCapitao(ctx) {
    const chave = await ctx.progresso.ler('navio.chave');
    if (chave) { ctx.irPara('capitao'); return; }
    ctx.aviso('A porta está trancada. Dizem que a chave está escondida dentro de um livro, na Sala de Leitura (no andar de cima do Café).');
  },
  raridades(ctx) { ctx.aviso(umDe(RARIDADES)); },
  bauCapitao(ctx) { ctx.aviso('Trancado com sete cadeados. O Capitão diz que a chave fica debaixo do tapa-olho.'); },
  pompom(ctx) { ctx.aviso(umDe(['Arrr! O Pompom pirata quer um biscoito de cenoura.', 'O Pompom pirata pula e grita: "Terra à vista!"', 'O Pompom pirata faz continência com a pata.'])); },
  async surfe(ctx) { (await jogos()).abrirSurfe(ctx); },
  async pescaGelo(ctx) { (await jogos()).abrirPescaGelo(ctx); },
  async jato(ctx) { (await jogos()).abrirJato(ctx); },
  async tesouro(ctx) { (await jogos()).abrirTesouro(ctx); },
  async piano(ctx) { (await jogos()).abrirPiano(ctx); },
  async telescopio(ctx) { (await jogos()).abrirVista(ctx, 'telescopio'); },
  async luneta(ctx) { (await jogos()).abrirVista(ctx, 'luneta'); },
  async bau(ctx) { (await jogos()).abrirBau(ctx); },
};

/* ─── Sprites (veja sprites.js) ─── */
// Cada prévia é o desenho de sempre, sem sprite, com a âncora da peça em (0, 0).
const PARADO = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const NO_FUNDO = ' Faz parte do fundo da sala, então fica parado (vale só o primeiro quadro).';
const peca = (chave, nome, desc, largura, altura, animacoes, previa, extra = {}) => ({
  chave: `ilha-litoral.${chave}`, jogo: 'Club Coelho: Litoral', nome, desc, largura, altura, ancora: 'pe', animacoes, previa, ...extra,
});
function naOrigem(g, x, y, f) {
  g.save();
  g.translate(-x, -y);
  f();
  g.restore();
}
export const SPRITES = [
  ...Object.entries(NPCS).map(([id, n]) => peca(id, n.nome,
    `O NPC ${n.sala}. O sprite troca o coelho inteiro, com a roupa. Olhando para a direita.`,
    Math.round(44 * n.escala), Math.round(56 * n.escala), [{ id: 'parado', nome: n.pose ? 'Sentada' : 'Parado', quadros: n.pose ? 1 : 2, fps: 3 }],
    (g, anim, t) => { g.save(); g.scale(n.escala, n.escala); desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir: 1, t, pose: n.pose || null, semSprite: true }); g.restore(); })),
  peca('gaivota', 'Gaivota', 'As gaivotas que voam sobre o mar do litoral (o jogo muda o tamanho de cada uma).',
    34, 18, [{ id: 'voando', nome: 'Voando', quadros: 2, fps: 8 }], (g, anim, t) => corpoGaivota(g, 0, 0, t), { ancora: 'centro' }),
  peca('barraca', 'Barraca de acampamento', 'As barracas da Floresta (uma laranja e uma verde). A sombra continua feita pelo jogo.',
    250, 130, [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }], g => corpoBarraca(g, 0, 0)),
  peca('fogueira', 'Fogueira', 'O fogo da fogueira da Floresta (as pedras em volta, as faíscas e o clarão continuam feitos pelo jogo).',
    70, 80, [{ id: 'acesa', nome: 'Acesa', quadros: 4, fps: 8 }], (g, anim, t) => corpoFogueira(g, 0, 0, t)),
  peca('cabana-surfe', 'Cabana de surfe', `A cabana "Surfe do Coelho" da Prainha.${NO_FUNDO}`,
    240, 190, PARADO, g => naOrigem(g, 210, 385, () => cabanaSurfe(g))),
  peca('prancha', 'Prancha de surfe', 'As pranchas fincadas na areia da Prainha. Marque "pintar com a cor" para cada uma ter a sua cor.',
    32, 100, [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }], g => corpoPrancha(g), { tingir: true }),
  peca('farol', 'Farol', `O farol listrado na Praia (o brilho da luz continua feito pelo jogo).${NO_FUNDO}`,
    112, 330, PARADO, g => naOrigem(g, 160, 330, () => farolFora(g))),
  peca('saltador', 'O Saltador', `O navio do Capitão Saltarrocha ancorado na Praia (a bandeira continua feita pelo jogo). A âncora é a proa, na linha da água.${NO_FUNDO}`,
    260, 290, PARADO, g => navioFora(g, 0, 0, 1), { ancora: 'pe' }),
  peca('guarda-sol', 'Guarda-sol', 'Os guarda-sóis da Praia e da Prainha. A sombra continua feita pelo jogo.',
    140, 146, PARADO, g => corpoGuardaSol(g, 0, 0)),
  peca('barco', 'Barquinho', 'O barquinho que leva até o Grande Iceberg (o jogo faz ele boiar).',
    196, 40, [{ id: 'boiando', nome: 'Boiando', quadros: 1, fps: 1 }], g => corpoBarco(g, 0, 0)),
  peca('telescopio', 'Telescópio do Mirante', 'O telescópio no tripé, lá no alto do farol. A sombra continua feita pelo jogo.',
    100, 100, PARADO, g => corpoTelescopio(g, 0, 0)),
  peca('canhao', 'Canhão do Saltador', 'Os canhões do convés. Desenhe apontando para a direita: o jogo vira o da esquerda.',
    84, 52, PARADO, g => corpoCanhao(g)),
  peca('bau-raro', 'Baú de itens raros', 'O baú do porão do Saltador, com as estrelinhas. O brilho em volta continua feito pelo jogo.',
    130, 110, [{ id: 'brilhando', nome: 'Brilhando', quadros: 4, fps: 3 }], (g, anim, t) => corpoBauRaro(g, 0, 0, t)),
];
registrarPecas(SPRITES);

registrarRegiao({ id: 'litoral', salas: SALAS, info: INFO, acoes: ACOES });

// Para os testes.
export const _litoral = { SALAS, INFO, ACOES, estadoIceberg, receberEvento, ICEBERG };
