// As salas do Club Coelho e os móveis das tocas, desenhados à mão num quadro de 1000 x 600.
// Cada sala tem: o fundo (paredes e chão, desenhado uma vez e guardado), os objetos que entram na ordem
// de profundidade junto com os coelhos (quem está mais embaixo fica na frente), o que se mexe (animar)
// e os pontos de clique (portas, balcão, pescaria...). Não usa nada da página: dá para testar no Node.

import { desenharCoelho, sorte } from './desenho-coelho.js';
import { registrarRoupasNovas } from './roupas-coelho.js';
import { registrarPecas, desenharSprite, temSprite } from './sprites.js';

export const W = 1000;
export const H = 600;

// Sprite enviado em #/recreacao/sprites para uma peça do clube (devolve false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `clube.${peca}`, anim, x, y, o);
// Para as prévias: o desenho de sempre, que usa as coordenadas da sala, com a âncora da peça em (0, 0).
function naOrigem(g, x, y, f) {
  g.save();
  g.translate(-x, -y);
  f();
  g.restore();
}

/* ─── Utilidades de desenho ─── */

function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}
function ret(g, x, y, w, h, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}
function grad(g, x0, y0, x1, y1, paradas) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
function brilho(g, x, y, r, cor, forca = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, cor.replace('A', String(forca)));
  gr.addColorStop(1, cor.replace('A', '0'));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
function texto(g, t, x, y, { cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center', sombra = null } = {}) {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  if (sombra) { g.fillStyle = sombra; g.fillText(t, x + 1.5, y + 1.5); }
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
function forma(g, cor, pts) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
const sombraNoChao = (g, x, y, rx, ry = rx * 0.28) => el(g, x, y, rx, ry, 'rgba(0,0,0,0.22)');

function arvoreRedonda(g, x, y, r, cor = '#4f8a3c') {
  sombraNoChao(g, x, y + 2, r * 0.8);
  if (!sp(g, 'arvore', 'parado', x, y, { quadro: 0, escala: r / 32 })) copaRedonda(g, x, y, r, cor);
}
function copaRedonda(g, x, y, r, cor) {
  ret(g, x - r * 0.12, y - r * 0.7, r * 0.24, r * 0.72, '#6b4a2b');
  el(g, x, y - r * 1.05, r, r * 0.9, cor);
  el(g, x - r * 0.35, y - r * 1.3, r * 0.55, r * 0.5, 'rgba(255,255,255,0.12)');
}
function nuvem(g, x, y, k = 1) {
  for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]]) el(g, x + dx * k, y + dy * k, r * k, r * 0.75 * k, 'rgba(255,255,255,0.92)');
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
// Os NPCs: coelhos parados com roupa (balançam um pouquinho). vel: o quanto o tempo corre para ele.
const NPCS = {
  'npc-cozinheiro': { nome: 'Cozinheiro do Café', sala: 'no balcão do Café da Cenoura', pelo: '#c99a6b', roupa: { cabeca: 'cozinheiro', corpo: 'avental' }, escala: 1.25 },
  'npc-felpuda': { nome: 'Dona Felpuda', sala: 'no balcão do Armarinho', pelo: '#f7f3ea', roupa: { cabeca: 'laco', rosto: 'oculos', corpo: 'avental' }, escala: 1.25 },
  'npc-dj': { nome: 'DJ do Salão', sala: 'na cabine do Salão de Dança', pelo: '#5b4a3f', roupa: { cabeca: 'fones', rosto: 'escuros' }, escala: 1.15, vel: 2 },
  'npc-pescador': { nome: 'Velho pescador', sala: 'na ponta do trapiche do Lago Cintilante', pelo: '#9aa3ad', roupa: { cabeca: 'chapeu', rosto: 'bigode', mao: 'vara' }, escala: 1.05 },
};
function npc(g, id, x, y, t, dir = 1) {
  const n = NPCS[id];
  if (temSprite(`clube.${id}`)) {
    el(g, x, y + n.escala, 15 * n.escala, 4.5 * n.escala, 'rgba(0,0,0,0.28)');
    sp(g, id, 'parado', x, y, { t, dir });
    return;
  }
  g.save();
  g.translate(x, y);
  g.scale(n.escala, n.escala);
  desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir, t: t * (n.vel || 1) });
  g.restore();
}

/* ─── Chãos ─── */

function chaoPedras(g, y0, y1, cores = ['#d6c6a2', '#c9b78f', '#dccdac', '#cfbd96'], fundo = '#b9a57c') {
  g.fillStyle = fundo;
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(7);
  let y = y0;
  let linha = 0;
  while (y < y1) {
    const h = 9 + (y - y0) * 0.05;
    const w = h * 2.3;
    for (let x = (linha % 2) * -w / 2; x < W; x += w) {
      ret(g, x + 1.5, y + 1.5, w - 3, h - 3, cores[Math.floor(rnd() * cores.length)], Math.min(6, h / 3));
    }
    y += h;
    linha++;
  }
}
function chaoTabuas(g, y0, y1, cores = ['#a8774a', '#9c6c42', '#b07e50'], linhaCor = 'rgba(60,35,15,0.35)') {
  const rnd = sorte(11);
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
function chaoXadrez(g, y0, y1, a, b) {
  const linhas = 9;
  for (let i = 0; i < linhas; i++) {
    const ya = y0 + (y1 - y0) * ((i / linhas) ** 1.25);
    const yb = y0 + (y1 - y0) * (((i + 1) / linhas) ** 1.25);
    const cols = 14;
    for (let j = 0; j < cols; j++) {
      g.fillStyle = (i + j) % 2 ? a : b;
      g.fillRect((W / cols) * j, ya, W / cols + 1, yb - ya + 1);
    }
  }
}
function chaoGrama(g, y0, y1) {
  g.fillStyle = grad(g, 0, y0, 0, y1, [[0, '#6f9e55'], [1, '#86b866']]);
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(5);
  g.strokeStyle = 'rgba(40,80,30,0.35)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 500; k++) {
    const x = rnd() * W;
    const y = y0 + rnd() * (y1 - y0);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2 + rnd() * 4, y - 4 - rnd() * 4); g.stroke();
  }
  for (let k = 0; k < 40; k++) el(g, rnd() * W, y0 + 10 + rnd() * (y1 - y0 - 10), 2.2, 2.2, ['#f0a0c0', '#f4dd80', '#ffffff', '#b0a0f0'][k % 4]);
}

/* ─── Praça ─── */

function fundoPraca(g) {
  g.fillStyle = grad(g, 0, 0, 0, 300, [[0, '#7ec8e3'], [1, '#d4f1fb']]);
  g.fillRect(0, 0, W, 300);
  brilho(g, 880, 70, 90, 'rgba(255,240,180,A)', 0.6);
  el(g, 880, 70, 34, 34, '#fff4c2');
  nuvem(g, 120, 70); nuvem(g, 420, 45, 0.8); nuvem(g, 640, 95, 0.9);
  // Lá longe: a montanha nevada (o caminho do Forte) à direita e um pedacinho do mar (o Ancoradouro) à esquerda.
  forma(g, '#a9b8cc', [640, 300, 760, 150, 830, 205, 905, 118, 1000, 215, 1000, 300]);
  forma(g, '#f4f8fc', [735, 182, 760, 150, 784, 182, 770, 176, 758, 190]);
  forma(g, '#f4f8fc', [872, 158, 905, 118, 940, 160, 920, 152, 906, 168, 890, 154]);
  forma(g, '#f4f8fc', [800, 236, 830, 205, 856, 236]);
  g.fillStyle = grad(g, 0, 262, 0, 300, [[0, '#4f9ac4'], [1, '#7cc0e0']]);
  g.fillRect(0, 262, 300, 38);
  for (let k = 0; k < 6; k++) ret(g, 10 + k * 48, 270 + (k % 3) * 8, 22, 2, 'rgba(255,255,255,0.55)', 1);
  ret(g, 52, 222, 3, 44, '#6b4a2b');
  forma(g, '#fbf3e0', [56, 224, 56, 258, 82, 258]);
  forma(g, '#8a5a32', [36, 264, 84, 264, 76, 274, 44, 274]);
  el(g, 330, 300, 290, 58, '#86b866');
  el(g, 820, 300, 420, 100, '#79ab5c');
  for (const [x, r] of [[350, 30], [655, 30], [970, 36]]) arvoreRedonda(g, x, 320, r, '#4f8a3c');
  chaoPedras(g, 300, H);
  // Grama nas beiradas e os caminhos que saem da praça: Lago e Ancoradouro (esquerda), Forte e Plaza
  // (direita) e as Tocas (embaixo, no meio).
  g.fillStyle = '#7fb069';
  g.fillRect(0, 300, W, 26);
  const caminho = (cor, pts) => forma(g, cor, pts);
  caminho('#b8a27a', [0, 355, 136, 378, 136, 432, 0, 452]);           // Lago (terra)
  caminho('#9c7448', [0, 470, 136, 488, 136, 548, 0, 568]);           // Ancoradouro (tábuas)
  for (let x = 6; x < 136; x += 15) { g.fillStyle = 'rgba(60,35,15,0.35)'; g.fillRect(x, 472 + x * 0.13, 2, 94 - x * 0.27); }
  caminho('#c9c3b8', [W, 355, W - 136, 378, W - 136, 432, W, 452]);   // Forte (pedra com neve)
  for (const [x, y, r] of [[968, 380, 16], [930, 404, 12], [985, 430, 14], [890, 392, 9]]) el(g, x, y, r, r * 0.45, 'rgba(255,255,255,0.9)');
  caminho('#b8a27a', [W, 470, W - 136, 488, W - 136, 548, W, 568]);   // Plaza
  for (let k = 0; k < 5; k++) ret(g, W - 128 + k * 26, 510, 14, 6, 'rgba(255,255,255,0.35)', 2);
  caminho('#c8b48c', [430, 548, 570, 548, 600, H, 400, H]);           // Tocas
  placa(g, 500, 584, 168, 28, 'Tocas dos moradores', { fundo: '#4f7a45', borda: '#2f4f2a', cor: '#f4dd80', fonte: '700 13px "Cinzel", Georgia, serif' });
  if (!sp(g, 'fachada-cafe', 'parado', 210, 335, { quadro: 0 })) fachadaCafe(g);
  if (!sp(g, 'fachada-armarinho', 'parado', 500, 335, { quadro: 0 })) fachadaArmarinho(g);
  if (!sp(g, 'fachada-salao', 'parado', 790, 335, { quadro: 0 })) fachadaSalao(g);
}
// As fachadas da praça (nas coordenadas da sala).
function fachadaCafe(g) {
  // Café da Cenoura
  ret(g, 100, 140, 220, 195, '#b5835a');
  for (let x = 108; x < 320; x += 14) { g.fillStyle = 'rgba(70,40,20,0.18)'; g.fillRect(x, 140, 2, 195); }
  forma(g, '#7a3b2e', [80, 148, 340, 148, 210, 70]);
  forma(g, '#94483a', [96, 148, 324, 148, 210, 84]);
  ret(g, 255, 92, 22, 40, '#6b5a50');
  for (const x of [118, 262]) {
    ret(g, x, 232, 44, 44, '#5b3c22', 3);
    ret(g, x + 4, 236, 36, 36, '#ffe9a8', 2);
    g.fillStyle = '#5b3c22'; g.fillRect(x + 21, 236, 2, 36); g.fillRect(x + 4, 253, 36, 2);
  }
  for (let k = 0; k < 11; k++) forma(g, k % 2 ? '#f7f3ea' : '#c0392b', [108 + k * 20, 208, 128 + k * 20, 208, 126 + k * 20, 226, 110 + k * 20, 226]);
  ret(g, 182, 252, 56, 83, '#5b3c22', 26);
  ret(g, 188, 258, 44, 77, '#7a5434', 22);
  el(g, 225, 300, 3, 3, '#e8c24a');
  placa(g, 210, 182, 150, 34, 'Café da Cenoura');
}
function fachadaArmarinho(g) {
  // Armarinho (loja)
  ret(g, 380, 130, 240, 205, '#e9dcc3');
  for (let y = 140; y < 335; y += 20) { g.fillStyle = 'rgba(150,130,100,0.18)'; g.fillRect(380, y, 240, 2); }
  forma(g, '#6a4a8a', [365, 136, 635, 136, 600, 92, 400, 92]);
  forma(g, '#7d5aa0', [375, 136, 625, 136, 595, 102, 405, 102]);
  for (const x of [395, 540]) {
    ret(g, x, 210, 66, 70, '#5b3c22', 3);
    ret(g, x + 4, 214, 58, 62, '#f8f1dd', 2);
  }
  // Na vitrine: um chapéu e um vestido
  el(g, 428, 262, 14, 3, '#d9b14f'); el(g, 428, 256, 8, 7, '#e6c56b');
  forma(g, '#e48ab8', [563, 230, 577, 230, 584, 270, 556, 270]); el(g, 570, 226, 6, 6, '#f2e4c8');
  ret(g, 466, 248, 68, 87, '#4a3670', 30);
  ret(g, 472, 254, 56, 81, '#6a4a8a', 26);
  el(g, 520, 300, 3, 3, '#e8c24a');
  placa(g, 500, 182, 170, 34, 'Armarinho', { fundo: '#6a4a8a', borda: '#3e2a5a' });
}
function fachadaSalao(g) {
  // Salão de Dança
  ret(g, 680, 150, 220, 185, '#3b2a5a');
  for (let x = 690; x < 900; x += 24) { g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(x, 150, 12, 185); }
  ret(g, 670, 128, 240, 26, '#2a1d42', 4);
  ret(g, 766, 250, 58, 85, '#140c22', 26);
  ret(g, 772, 256, 46, 79, '#2a1d42', 22);
  for (const x of [700, 838]) ret(g, x, 220, 42, 46, '#140c22', 4);
}
// Luzinhas do letreiro do Salão, fumaça do café e as janelas que brilham.
function animarPraca(g, t) {
  for (let k = 0; k < 20; k++) {
    const aceso = (Math.floor(t * 4) + k) % 3 === 0;
    el(g, 676 + k * 12, 141, 3, 3, aceso ? '#ffe46b' : '#7a6a30');
  }
  const pisca = 0.75 + Math.sin(t * 9) * 0.1 + (Math.sin(t * 23) > 0.95 ? -0.4 : 0);
  g.save();
  g.globalAlpha = Math.max(0.2, pisca);
  texto(g, 'SALÃO DE DANÇA', 790, 192, { cor: '#ff7ad9', fonte: '700 19px "Cinzel", Georgia, serif' });
  g.restore();
  brilho(g, 790, 192, 110, 'rgba(255,90,210,A)', 0.15 * pisca);
  for (const x of [721, 859]) { const c = ['#ff7ad9', '#6be0ff', '#ffe46b'][Math.floor(t * 2 + x) % 3]; ret(g, x - 17, 224, 34, 38, c, 3); }
  brilho(g, 795, 300, 60, 'rgba(160,110,255,A)', 0.3);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.25 + k / 3) % 1;
    el(g, 266 + Math.sin(f * 6 + k) * 6, 88 - f * 70, 6 + f * 10, 5 + f * 8, `rgba(240,240,240,${0.45 * (1 - f)})`);
  }
  for (const [x, y] of [[140, 254], [284, 254], [428, 245], [573, 245]]) brilho(g, x, y, 40, 'rgba(255,220,140,A)', 0.12 + Math.sin(t * 2 + x) * 0.03);
  // Borboletas
  for (let k = 0; k < 3; k++) {
    const bx = 150 + ((t * 30 + k * 300) % 760);
    const by = 380 + Math.sin(t * 1.3 + k * 2) * 40 + k * 30;
    const cor = ['#f4dd80', '#f0a0c0', '#a8d8f0'][k];
    if (!sp(g, 'borboleta', 'voando', bx, by, { t: t + k * 0.3, cor })) borboleta(g, bx, by, Math.abs(Math.sin(t * 14 + k)) * 5 + 1, cor);
  }
}
function borboleta(g, bx, by, a, cor) {
  el(g, bx - 3, by, a, 4, cor);
  el(g, bx + 3, by, a, 4, cor);
}
function fonte(g, t) {
  const x = 500;
  const y = 470;
  sombraNoChao(g, x, y + 4, 110, 26);
  if (!sp(g, 'fonte', 'agua', x, y + 24, { t })) fonteCorpo(g, x, y, t);
}
function fonteCorpo(g, x, y, t, semSprite = false) {
  el(g, x, y - 6, 104, 30, '#9a917f');
  el(g, x, y - 12, 96, 26, '#b8ae98');
  el(g, x, y - 14, 86, 21, '#4f9ac4');
  for (let k = 0; k < 5; k++) {
    const r = ((t * 30 + k * 18) % 86);
    g.strokeStyle = `rgba(255,255,255,${0.35 * (1 - r / 86)})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(x, y - 14, r, r * 0.24, 0, 0, Math.PI * 2);
    g.stroke();
  }
  ret(g, x - 10, y - 70, 20, 58, '#b8ae98', 4);
  el(g, x, y - 72, 26, 8, '#9a917f');
  // A estátua do coelho
  if (semSprite || !sp(g, 'estatua', 'parado', x - 4, y - 74, { t })) estatua(g, x - 4, y - 74, semSprite);
  // Jatos de água
  for (let k = 0; k < 14; k++) {
    const f = (t * 1.2 + k / 14) % 1;
    const lado = k % 2 ? 1 : -1;
    const dx = lado * f * 70;
    const dy = -Math.sin(f * Math.PI) * 50;
    el(g, x + dx, y - 100 + dy + f * 86, 2.4, 2.4, `rgba(190,230,255,${0.9 - f * 0.5})`);
  }
}
function estatua(g, x, y, semSprite = false) {
  g.save(); g.translate(x, y); g.scale(0.9, 0.9);
  desenharCoelho(g, 0, 0, { pelo: '#cfc6b2', dir: 1, t: 0, semSprite });
  g.restore();
}
function banco(g, x, y) {
  sombraNoChao(g, x, y + 2, 50);
  if (!sp(g, 'banco', 'parado', x, y)) bancoCorpo(g, x, y);
}
function bancoCorpo(g, x, y) {
  ret(g, x - 46, y - 30, 92, 8, '#8a5a32', 3);
  ret(g, x - 46, y - 46, 92, 7, '#9c6a3c', 3);
  for (const dx of [-38, 34]) ret(g, x + dx, y - 30, 5, 30, '#3a2a20');
}
function poste(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 16);
  if (!sp(g, 'poste', 'aceso', x, y, { t })) posteCorpo(g, x, y);
  brilho(g, x, y - 128, 50, 'rgba(255,230,150,A)', 0.25 + Math.sin(t * 2 + x) * 0.03);
}
function posteCorpo(g, x, y) {
  ret(g, x - 3, y - 120, 6, 120, '#2f2f38');
  ret(g, x - 12, y - 140, 24, 24, '#2f2f38', 4);
  ret(g, x - 9, y - 137, 18, 18, '#ffe9a8', 3);
}
function setaPlaca(g, x, y, textoPlaca, dir) {
  sombraNoChao(g, x, y + 2, 18);
  if (!sp(g, 'placa-seta', 'parado', x, y, { dir })) setaCorpo(g, x, y, dir);
  textoNaSeta(g, textoPlaca, x + dir * 6, y - 69);
}
// O nome na placa diminui a letra quando não cabe (Ancoradouro, Forte Nevado...).
function textoNaSeta(g, t, x, y) {
  let tam = 14;
  g.font = `700 ${tam}px "Cinzel", Georgia, serif`;
  while (tam > 10 && g.measureText(t).width > 96) { tam--; g.font = `700 ${tam}px "Cinzel", Georgia, serif`; }
  texto(g, t, x, y, { fonte: `700 ${tam}px "Cinzel", Georgia, serif` });
}
// Poste com duas placas apontando para o mesmo lado (a de cima é a placa de sempre, 40 mais alta).
function setaDupla(g, x, y, [cima, baixo], dir) {
  sombraNoChao(g, x, y + 2, 18);
  for (const [dy, t] of [[-40, cima], [0, baixo]]) {
    if (!sp(g, 'placa-seta', 'parado', x, y + dy, { dir })) setaCorpo(g, x, y + dy, dir);
    textoNaSeta(g, t, x + dir * 6, y + dy - 69);
  }
}
function setaCorpo(g, x, y, dir) {
  ret(g, x - 3, y - 80, 6, 80, '#6b4a2b');
  const w = 104;
  g.fillStyle = '#8a6a44';
  g.beginPath();
  const x0 = x - w / 2;
  if (dir < 0) { g.moveTo(x0 - 14, y - 70); g.lineTo(x0, y - 86); g.lineTo(x0 + w, y - 86); g.lineTo(x0 + w, y - 54); g.lineTo(x0, y - 54); } else { g.moveTo(x0 + w + 14, y - 70); g.lineTo(x0 + w, y - 86); g.lineTo(x0, y - 86); g.lineTo(x0, y - 54); g.lineTo(x0 + w, y - 54); }
  g.closePath();
  g.fill();
}
function canteiro(g, x, y) {
  if (!sp(g, 'canteiro', 'parado', x, y)) canteiroCorpo(g, x, y);
}
function canteiroCorpo(g, x, y) {
  ret(g, x - 40, y - 18, 80, 18, '#8a6a44', 4);
  for (let k = 0; k < 9; k++) {
    el(g, x - 32 + k * 8, y - 24 - (k % 3) * 3, 4, 4, ['#f0a0c0', '#f4dd80', '#e05a5a'][k % 3]);
    el(g, x - 32 + k * 8, y - 19, 3, 2, '#4f8a3c');
  }
}

/* ─── Café da Cenoura ─── */

function fundoCafe(g) {
  g.fillStyle = '#8a5a3a';
  g.fillRect(0, 0, W, 360);
  for (let x = 0; x < W; x += 40) { g.fillStyle = x % 80 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'; g.fillRect(x, 0, 40, 360); }
  g.fillStyle = '#6b4226';
  g.fillRect(0, 280, W, 80);
  g.fillStyle = '#5b3a20';
  g.fillRect(0, 276, W, 6);
  if (!sp(g, 'janela-cafe', 'parado', 210, 240, { quadro: 0 })) janelaCafe(g);
  if (!sp(g, 'cardapio', 'parado', 480, 233, { quadro: 0 })) cardapio(g);
  if (!sp(g, 'prateleira-potes', 'parado', 780, 130, { quadro: 0 })) prateleiraPotes(g);
  chaoTabuas(g, 360, H);
  if (!sp(g, 'escada-cafe', 'parado', 70, 384, { quadro: 0 })) escadaCafe(g);
  ret(g, 430, 568, 140, 30, '#7a2f2f', 6);
  texto(g, 'Saída', 500, 584, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
}
// A escada de madeira encostada na parede da esquerda, subindo para a Sala de Leitura.
function escadaCafe(g) {
  el(g, 46, 100, 40, 42, '#2a1a10');
  ret(g, 6, 100, 80, 74, '#2a1a10');
  brilho(g, 46, 120, 50, 'rgba(255,200,120,A)', 0.4);
  g.strokeStyle = '#5b3c22'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(6, 174); g.lineTo(6, 100); g.arc(46, 100, 40, Math.PI, 0); g.lineTo(86, 174); g.stroke();
  const degraus = 9;
  for (let i = 0; i < degraus; i++) {
    const f0 = i / degraus;
    const f1 = (i + 1) / degraus;
    const y0 = 174 + f0 * 206;
    const y1 = 174 + f1 * 206;
    const xa = 6 - f0 * 6;
    const xb = 86 + f1 * 48;
    ret(g, xa, y0, xb - xa, (y1 - y0) * 0.45, i % 2 ? '#b07e50' : '#a8774a');
    ret(g, xa, y0 + (y1 - y0) * 0.45, xb - xa, (y1 - y0) * 0.55, '#6b4226');
  }
  // Corrimão
  g.strokeStyle = '#4a2e18'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(90, 140); g.lineTo(138, 330); g.stroke();
  for (let k = 0; k <= 4; k++) { const x = 92 + k * 11.5; const y = 148 + k * 45; ret(g, x - 2, y, 4, 40 + k * 4, '#5b3c22'); }
  placa(g, 46, 40, 92, 26, 'Leitura', { fonte: '700 13px "Cinzel", Georgia, serif' });
  texto(g, '▲', 46, 62, { cor: '#f4dd80', fonte: '700 12px sans-serif' });
}
function janelaCafe(g) {
  // Janela com a praça lá fora
  ret(g, 110, 80, 200, 150, '#5b3c22', 6);
  g.fillStyle = grad(g, 0, 88, 0, 222, [[0, '#8fd3f4'], [1, '#e0f4ff']]);
  g.fillRect(118, 88, 184, 134);
  nuvem(g, 140, 120, 0.5);
  ret(g, 170, 170, 40, 52, '#e9dcc3'); ret(g, 230, 160, 50, 62, '#b5835a');
  g.fillStyle = '#5b3c22'; g.fillRect(208, 88, 4, 134); g.fillRect(118, 153, 184, 4);
  forma(g, '#c0392b', [104, 74, 150, 74, 128, 240, 100, 240]);
  forma(g, '#c0392b', [316, 74, 270, 74, 292, 240, 320, 240]);
}
function cardapio(g) {
  // Cardápio
  ret(g, 380, 70, 200, 160, '#2b3a2e', 6);
  g.strokeStyle = '#7a5434'; g.lineWidth = 6; g.strokeRect(380, 70, 200, 160);
  texto(g, 'Cardápio', 480, 98, { cor: '#f4e9c8', fonte: '700 20px "Cinzel", Georgia, serif' });
  for (const [k, l] of ['Café de cenoura', 'Bolo de cenoura', 'Chá de trevo', 'Leite com mel'].entries()) texto(g, l, 480, 132 + k * 24, { cor: '#e8e2d0', fonte: '15px "EB Garamond", Georgia, serif' });
}
function prateleiraPotes(g) {
  // Prateleira com potes
  ret(g, 630, 120, 300, 10, '#5b3c22');
  for (let k = 0; k < 8; k++) {
    const x = 645 + k * 36;
    ret(g, x, 86, 24, 34, 'rgba(220,240,255,0.55)', 5);
    ret(g, x + 3, 100, 18, 18, ['#e07a2a', '#d8b13a', '#7fb069', '#c97a3a'][k % 4], 3);
    ret(g, x - 1, 82, 26, 6, '#8a5a3a', 2);
  }
}
function animarCafe(g, t) {
  for (const x of [250, 500, 750]) {
    if (!sp(g, 'luminaria-cafe', 'acesa', x, 0, { t })) luminariaCafe(g, x);
    brilho(g, x, 70, 120, 'rgba(255,214,140,A)', 0.22 + Math.sin(t * 3 + x) * 0.02);
  }
}
function luminariaCafe(g, x) {
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 40); g.stroke();
  forma(g, '#d8b13a', [x - 22, 58, x + 22, 58, x + 12, 38, x - 12, 38]);
}
function balcaoCafe(g, t) {
  npc(g, 'npc-cozinheiro', 780, 296, t, -1);
  if (!sp(g, 'balcao-cafe', 'vapor', 770, 378, { t })) balcaoCafeCorpo(g, t);
}
function balcaoCafeCorpo(g, t) {
  ret(g, 600, 300, 340, 26, '#c9a06a', 4);
  ret(g, 606, 326, 328, 52, '#5b3c22', 2);
  for (let x = 620; x < 930; x += 50) ret(g, x, 334, 36, 36, '#6b4a2b', 3);
  // Máquina de café e bolo
  ret(g, 640, 250, 56, 52, '#b8c0c8', 6);
  ret(g, 648, 262, 40, 14, '#3a3a44', 3);
  el(g, 668, 296, 9, 4, '#ece0bf');
  for (let k = 0; k < 2; k++) {
    const f = (t * 0.7 + k * 0.5) % 1;
    el(g, 664 + k * 8, 286 - f * 30, 3 + f * 4, 3 + f * 4, `rgba(255,255,255,${0.4 * (1 - f)})`);
  }
  el(g, 870, 296, 30, 7, '#e8e2d0');
  ret(g, 848, 266, 44, 28, '#e07a2a', 6);
  ret(g, 848, 262, 44, 10, '#f7f3ea', 5);
  el(g, 870, 258, 4, 6, '#4f8a3c');
}
function mesaCafe(g, x, y) {
  sombraNoChao(g, x, y + 2, 46);
  if (!sp(g, 'mesa-cafe', 'parado', x, y)) mesaCafeCorpo(g, x, y);
}
function mesaCafeCorpo(g, x, y) {
  for (const dx of [-48, 48]) {
    ret(g, x + dx - 14, y - 26, 28, 8, '#7a4a2a', 3);
    ret(g, x + dx - 12, y - 54, 24, 30, '#8a5a32', 4);
    ret(g, x + dx - 10, y - 20, 4, 20, '#4a2e18'); ret(g, x + dx + 6, y - 20, 4, 20, '#4a2e18');
  }
  ret(g, x - 4, y - 40, 8, 40, '#4a2e18');
  el(g, x, y - 42, 40, 12, '#c9a06a');
  el(g, x, y - 45, 40, 12, '#e0b97e');
  el(g, x - 10, y - 48, 6, 3, '#f7f3ea'); el(g, x + 12, y - 47, 5, 2.5, '#e07a2a');
}

/* ─── Armarinho (loja) ─── */

function fundoLoja(g) {
  g.fillStyle = '#efe3c8';
  g.fillRect(0, 0, W, 380);
  for (let x = 0; x < W; x += 36) { g.fillStyle = 'rgba(200,170,120,0.18)'; g.fillRect(x, 0, 14, 380); }
  g.fillStyle = '#c9a06a'; g.fillRect(0, 0, W, 16);
  g.fillStyle = '#a8814e'; g.fillRect(0, 300, W, 80);
  if (!sp(g, 'prateleira-roupas', 'parado', 170, 280, { quadro: 0 })) prateleiraRoupas(g);
  if (!sp(g, 'arara', 'parado', 830, 300, { quadro: 0 })) arara(g);
  chaoXadrez(g, 380, H, '#d9c7a3', '#c4ae86');
  ret(g, 430, 568, 140, 30, '#6a4a8a', 6);
  texto(g, 'Saída', 500, 584, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
  if (!sp(g, 'placa-armarinho', 'parado', 500, 60, { quadro: 0 })) placaArmarinho(g);
}
function prateleiraRoupas(g) {
  // Prateleiras com roupas dobradas
  for (const y of [110, 190, 270]) {
    ret(g, 40, y, 260, 10, '#7a5434');
    for (let k = 0; k < 6; k++) {
      const cor = ['#e05a8a', '#5aa0d8', '#7fb069', '#d8b13a', '#7b5ab8', '#e07a2a'][(k + y) % 6];
      ret(g, 52 + k * 41, y - 26, 34, 12, cor, 3);
      ret(g, 52 + k * 41, y - 14, 34, 12, cor, 3);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(52 + k * 41, y - 15, 34, 2);
    }
  }
}
function arara(g) {
  // Arara com roupas penduradas
  ret(g, 700, 90, 260, 6, '#5b3c22');
  for (const x of [705, 952]) ret(g, x, 90, 5, 210, '#5b3c22');
  for (let k = 0; k < 9; k++) {
    const x = 725 + k * 26;
    g.strokeStyle = '#5b3c22'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, 96); g.lineTo(x, 104); g.stroke();
    forma(g, ['#c0392b', '#2f6b34', '#7b5ab8', '#1f1f26', '#e48ab8', '#a8b0ba'][k % 6], [x - 11, 104, x + 11, 104, x + 13, 170, x - 13, 170]);
  }
}
function placaArmarinho(g) {
  placa(g, 500, 60, 360, 46, 'Armarinho da Dona Felpuda', { fundo: '#6a4a8a', borda: '#3e2a5a', fonte: '700 19px "Cinzel", Georgia, serif' });
}
function balcaoLoja(g, t) {
  npc(g, 'npc-felpuda', 500, 300, t, 1);
  if (!sp(g, 'balcao-loja', 'brilhando', 500, 384, { t })) balcaoLojaCorpo(g, t);
}
function balcaoLojaCorpo(g, t) {
  ret(g, 370, 310, 260, 22, '#c9a06a', 4);
  ret(g, 376, 332, 248, 52, '#7a5434', 2);
  ret(g, 400, 342, 200, 32, '#6a4a8a', 4);
  texto(g, 'Catálogo', 500, 359, { fonte: '700 15px "Cinzel", Georgia, serif', cor: '#f4dd80' });
  // O livro do catálogo, aberto
  forma(g, '#f8f1dd', [430, 306, 500, 300, 500, 290, 432, 296]);
  forma(g, '#f2e8cf', [570, 306, 500, 300, 500, 290, 568, 296]);
  const brilhoLivro = 0.25 + Math.sin(t * 3) * 0.1;
  brilho(g, 500, 298, 50, 'rgba(255,230,150,A)', brilhoLivro);
  ret(g, 590, 284, 28, 24, '#b8922a', 4);
}
function espelho(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 34);
  if (!sp(g, 'espelho', 'brilhando', x, y, { t })) espelhoCorpo(g, x, y, t);
}
function espelhoCorpo(g, x, y, t) {
  ret(g, x - 6, y - 20, 12, 20, '#7a5434');
  el(g, x, y - 90, 36, 70, '#c9a06a');
  el(g, x, y - 90, 30, 63, grad(g, x - 30, y - 150, x + 30, y - 30, [[0, '#dff0fa'], [0.5, '#a9cde0'], [1, '#e8f6ff']]));
  g.save();
  g.globalAlpha = 0.35 + Math.sin(t * 2) * 0.1;
  ret(g, x - 18, y - 140, 8, 60, '#ffffff', 4);
  g.restore();
}
// Os dois manequins da vitrine, cada um com a sua roupa.
const MANEQUINS = {
  'manequim-smoking': { nome: 'Manequim de smoking', roupa: { cabeca: 'cartola', corpo: 'smoking', mao: 'bandeira' } },
  'manequim-vestido': { nome: 'Manequim de vestido', roupa: { cabeca: 'tiara', corpo: 'vestido', costas: 'asas' } },
};
function manequim(g, x, y, id, t) {
  sombraNoChao(g, x, y + 2, 22);
  if (!sp(g, id, 'parado', x, y + 2, { t })) manequimCorpo(g, x, y, MANEQUINS[id].roupa);
}
function manequimCorpo(g, x, y, roupa, semSprite = false) {
  ret(g, x - 18, y - 4, 36, 6, '#5b3c22', 3);
  ret(g, x - 2, y - 14, 4, 12, '#5b3c22');
  g.save(); g.translate(x, y - 10); g.scale(1.25, 1.25);
  desenharCoelho(g, 0, 0, { pelo: '#e4dccb', roupa, t: 0, semSprite });
  g.restore();
}

/* ─── Salão de Dança ─── */

function fundoDanca(g) {
  g.fillStyle = grad(g, 0, 0, 0, 340, [[0, '#0e0a1a'], [1, '#22163a']]);
  g.fillRect(0, 0, W, 340);
  const rnd = sorte(3);
  for (let k = 0; k < 60; k++) el(g, rnd() * W, rnd() * 260, 1.2, 1.2, 'rgba(255,255,255,0.5)');
  g.fillStyle = '#140c22';
  g.fillRect(0, 300, W, 40);
  if (!sp(g, 'cabine-dj', 'parado', 500, 330, { quadro: 0 })) cabineDj(g);
  if (!sp(g, 'escada-salao', 'parado', 272, 340, { quadro: 0 })) escadaSalao(g);
  if (!sp(g, 'porta-caldeira', 'parado', 654, 340, { quadro: 0 })) portaCaldeira(g);
  g.fillStyle = '#0a0612';
  g.fillRect(0, 336, W, 6);
}
// A escada que sobe para o Fliperama: degraus escuros com a beirada de neon e a porta lá em cima.
function escadaSalao(g) {
  ret(g, 226, 112, 92, 106, '#2a1d42', 8);
  ret(g, 236, 122, 72, 96, '#07040d', 4);
  const degraus = 7;
  for (let i = 0; i < degraus; i++) {
    const f0 = i / degraus;
    const f1 = (i + 1) / degraus;
    const y0 = 218 + f0 * 122;
    const y1 = 218 + f1 * 122;
    const xa = 236 - f1 * 36;
    const xb = 308 + f1 * 36;
    ret(g, xa, y0, xb - xa, y1 - y0, i % 2 ? '#241838' : '#1d132e');
    ret(g, xa, y0, xb - xa, 3, i % 2 ? '#ff7ad9' : '#6be0ff');
  }
  for (const lado of [-1, 1]) {
    g.strokeStyle = '#6be0ff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(272 + lado * 40, 200); g.lineTo(272 + lado * 78, 330); g.stroke();
  }
}
// A porta de ferro do porão, que desce para a Sala da Caldeira.
function portaCaldeira(g) {
  ret(g, 622, 252, 64, 88, '#3a3f48', 4);
  ret(g, 628, 258, 52, 82, '#555c66', 3);
  for (const [x, y] of [[633, 263], [675, 263], [633, 333], [675, 333]]) el(g, x, y, 2, 2, '#2a2e35');
  for (let k = 0; k < 6; k++) forma(g, k % 2 ? '#1b1b1b' : '#e8c24a', [628 + k * 9, 300, 637 + k * 9, 300, 632 + k * 9, 310, 623 + k * 9, 310]);
  el(g, 672, 285, 3, 3, '#c9cdd4');
  placa(g, 654, 240, 80, 20, 'Caldeira', { fundo: '#3a3f48', borda: '#1b1e23', cor: '#ffb070', fonte: '700 11px "Cinzel", Georgia, serif' });
}
function cabineDj(g) {
  // Cabine do DJ
  ret(g, 390, 240, 220, 90, '#2a1d42', 8);
  ret(g, 398, 248, 204, 18, '#3b2a5a', 4);
  for (const x of [440, 560]) { el(g, x, 257, 26, 6, '#111'); el(g, x, 257, 6, 2, '#444'); }
  texto(g, 'DJ', 500, 300, { cor: '#6be0ff', fonte: '700 22px "Cinzel", Georgia, serif' });
}
function animarDanca(g, t) {
  // Pista de dança que muda de cor
  const linhas = 6;
  const cols = 10;
  for (let i = 0; i < linhas; i++) {
    const ya = 342 + (H - 342) * ((i / linhas) ** 1.2);
    const yb = 342 + (H - 342) * (((i + 1) / linhas) ** 1.2);
    for (let j = 0; j < cols; j++) {
      const fase = Math.sin(t * 3 + i * 1.3 + j * 0.9);
      const hue = (t * 40 + (i + j) * 35) % 360;
      g.fillStyle = `hsl(${hue}, 70%, ${fase > 0.3 ? 55 : 22}%)`;
      g.fillRect((W / cols) * j + 1, ya + 1, W / cols - 2, yb - ya - 2);
    }
  }
  // Globo espelhado com raios de luz
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 8; k++) {
    const a = t * 0.8 + (k * Math.PI) / 4;
    const cor = ['rgba(255,90,210,0.10)', 'rgba(107,224,255,0.10)', 'rgba(255,228,107,0.10)'][k % 3];
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(500, 60);
    g.lineTo(500 + Math.cos(a) * 700, 60 + Math.abs(Math.sin(a)) * 600 + 100);
    g.lineTo(500 + Math.cos(a + 0.12) * 700, 60 + Math.abs(Math.sin(a + 0.12)) * 600 + 100);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#555'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(500, 0); g.lineTo(500, 34); g.stroke();
  if (!sp(g, 'globo', 'girando', 500, 60, { t })) globo(g, 500, 60, t);
  // O letreiro do Fliperama pisca, a luz das máquinas sai pela porta e o vapor escapa da porta da Caldeira.
  const neon = (Math.floor(t * 2.5) % 7) ? 1 : 0.35;
  g.save();
  g.globalAlpha = neon;
  texto(g, 'FLIPERAMA', 272, 98, { cor: '#7fe08a', fonte: '700 17px "Cinzel", Georgia, serif', sombra: 'rgba(127,224,138,0.5)' });
  g.restore();
  brilho(g, 272, 98, 80, 'rgba(127,224,138,A)', 0.18 * neon);
  const cor = ['rgba(255,122,217,A)', 'rgba(107,224,255,A)', 'rgba(255,228,107,A)'][Math.floor(t * 3) % 3];
  brilho(g, 272, 170, 46, cor, 0.35 + Math.sin(t * 11) * 0.1);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.4 + k / 3) % 1;
    el(g, 640 + k * 14 + Math.sin(f * 5 + k) * 5, 336 - f * 40, 6 + f * 10, 4 + f * 6, `rgba(220,220,230,${0.4 * (1 - f)})`);
  }
}
function globo(g, x, y, t) {
  el(g, x, y, 28, 28, '#c8ccd4');
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + t;
    el(g, x + Math.cos(a) * 16, y + Math.sin(a) * 16, 3, 3, (k + Math.floor(t * 6)) % 3 ? '#eef2f8' : '#ffffff');
  }
}
function caixaDeSom(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 60, 12);
  if (!sp(g, 'caixa-som', 'tocando', x, y, { t })) caixaDeSomCorpo(g, x, y, t);
}
function caixaDeSomCorpo(g, x, y, t) {
  ret(g, x - 55, y - 150, 110, 150, '#1b1430', 8);
  const pulso = 1 + Math.max(0, Math.sin(t * 8.4)) * 0.12;
  for (const [cy, r] of [[-110, 22], [-48, 34]]) {
    el(g, x, y + cy, r * pulso, r * pulso, '#2e2448');
    el(g, x, y + cy, r * 0.55 * pulso, r * 0.55 * pulso, '#0e0a1a');
  }
}
function maquinaDanca(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 46, 12);
  if (!sp(g, 'maquina-danca', 'piscando', x, y, { t })) maquinaDancaCorpo(g, x, y, t);
}
function maquinaDancaCorpo(g, x, y, t) {
  ret(g, x - 42, y - 140, 84, 140, '#3b1d5a', 8);
  ret(g, x - 34, y - 128, 68, 50, '#0e0a1a', 4);
  const setas = ['←', '↓', '↑', '→'];
  setas.forEach((s, k) => texto(g, s, x - 24 + k * 16, y - 103 + Math.sin(t * 6 + k) * 6, { cor: ['#ff7ad9', '#6be0ff', '#7fe08a', '#ffe46b'][k], fonte: '700 16px sans-serif' }));
  texto(g, 'Dança da Toca', x, y - 66, { cor: '#ffe46b', fonte: '700 11px "Cinzel", Georgia, serif' });
  for (let k = 0; k < 4; k++) ret(g, x - 30 + k * 16, y - 46, 12, 12, ['#ff7ad9', '#6be0ff', '#7fe08a', '#ffe46b'][k], 3);
  brilho(g, x, y - 100, 70, 'rgba(255,120,220,A)', 0.18 + Math.sin(t * 4) * 0.06);
}
function dj(g, t) {
  npc(g, 'npc-dj', 500, 252, t, 1);
}

/* ─── Lago Cintilante ─── */

function fundoLago(g) {
  g.fillStyle = grad(g, 0, 0, 0, 200, [[0, '#f7a072'], [0.6, '#ffd59a'], [1, '#ffe9c4']]);
  g.fillRect(0, 0, W, 200);
  brilho(g, 640, 175, 140, 'rgba(255,220,140,A)', 0.7);
  el(g, 640, 175, 44, 44, '#fff0c0');
  for (const [x, r, cor] of [[120, 160, '#9a8fb5'], [420, 210, '#a69bc0'], [860, 190, '#9286ad']]) el(g, x, 205, r, 90, cor);
  for (let x = -20; x < W + 40; x += 46) el(g, x, 196, 30, 22, '#4f7a45');
  g.fillStyle = grad(g, 0, 190, 0, 385, [[0, '#4a8bb4'], [1, '#2f6f9a']]);
  g.fillRect(0, 190, W, 195);
  // Reflexo do sol
  for (let k = 0; k < 9; k++) ret(g, 600 - k * 4, 210 + k * 18, 80 + k * 8, 3, 'rgba(255,230,170,0.35)', 2);
  // Margem e grama
  g.fillStyle = '#d8c89a';
  g.beginPath();
  g.moveTo(0, 380);
  for (let x = 0; x <= W; x += 50) g.quadraticCurveTo(x + 25, 372 + Math.sin(x) * 4, x + 50, 380);
  g.lineTo(W, 400); g.lineTo(0, 400);
  g.fill();
  chaoGrama(g, 398, H);
  // Caminho de volta para a praça
  g.fillStyle = '#c4ad84';
  g.beginPath(); g.moveTo(W, 450); g.quadraticCurveTo(900, 480, W - 10, 560); g.lineTo(W, 560); g.fill();
  if (!sp(g, 'cabana', 'parado', 875, 330, { quadro: 0 })) cabana(g);
  // Juncos
  for (let k = 0; k < 14; k++) {
    const x = 20 + k * 11;
    g.strokeStyle = '#4f7a45'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x, 395); g.lineTo(x + 4, 340 - (k % 3) * 10); g.stroke();
    if (k % 3 === 0) el(g, x + 4, 340 - (k % 3) * 10, 3, 8, '#6b4a2b');
  }
}
function cabana(g) {
  // Cabana do pescador
  ret(g, 820, 250, 110, 80, '#8a5a32');
  forma(g, '#6b3a2a', [808, 254, 942, 254, 875, 205]);
  ret(g, 862, 290, 26, 40, '#4a2e18', 4);
  ret(g, 834, 272, 20, 18, '#ffe9a8', 2);
}
function trapiche(g, t) {
  // O trapiche (cais de madeira) entra no lago; o velho pescador fica na ponta.
  if (!sp(g, 'trapiche', 'parado', 300, 390, { t })) trapicheCorpo(g);
  npc(g, 'npc-pescador', 300, 236, t, 1);
  // A placa da pescaria e o balde
  if (!sp(g, 'placa-pescaria', 'parado', 231, 400, { t })) placaPescaria(g);
  if (!sp(g, 'balde', 'parado', 369, 406, { t })) balde(g);
}
function trapicheCorpo(g) {
  for (let k = 0; k < 9; k++) {
    const y = 384 - k * 18;
    const w = 90 - k * 3;
    ret(g, 300 - w / 2, y - 16, w, 15, k % 2 ? '#9c6c42' : '#a8774a', 2);
  }
  for (const dx of [-40, 36]) ret(g, 300 + dx, 230, 6, 160, '#5b3c22');
}
function placaPescaria(g) {
  ret(g, 228, 360, 6, 40, '#6b4a2b');
  placa(g, 231, 352, 104, 30, 'Pescaria', { fonte: '700 14px "Cinzel", Georgia, serif' });
}
function balde(g) {
  ret(g, 356, 384, 26, 22, '#7f8893', 4);
  el(g, 369, 384, 13, 4, '#5a8fb0');
}
function animarLago(g, t) {
  for (let k = 0; k < 18; k++) {
    const x = (k * 97 + t * 14) % W;
    const y = 220 + (k * 37) % 150;
    ret(g, x, y, 26 + (k % 3) * 10, 2, 'rgba(255,255,255,0.18)', 1);
  }
  // Patinhos
  for (let k = 0; k < 2; k++) {
    const x = 520 + Math.cos(t * 0.3 + k * 3) * 160;
    const y = 290 + Math.sin(t * 0.3 + k * 3) * 40 + k * 20;
    const dir = Math.sin(t * 0.3 + k * 3) > 0 ? -1 : 1;
    el(g, x, y + 4, 18, 4, 'rgba(255,255,255,0.25)');
    if (!sp(g, 'pato', 'nadando', x, y + 8, { t: t + k * 0.5, dir })) pato(g, x, y, dir);
  }
  // Um peixe pula de vez em quando
  const ciclo = t % 6;
  if (ciclo < 0.9) {
    const f = ciclo / 0.9;
    const px = 760 - f * 60;
    const py = 300 - Math.sin(f * Math.PI) * 50;
    if (!sp(g, 'peixe-pulando', 'pulando', px, py, { progresso: f, dir: -1, rot: 0.6 - f * 1.2 })) el(g, px, py, 9, 4, '#e8a040', -0.6 + f * 1.2);
  }
}
function pato(g, x, y, dir) {
  el(g, x, y, 13, 8, '#f7f3ea');
  el(g, x + dir * 10, y - 8, 6, 6, '#f7f3ea');
  el(g, x + dir * 16, y - 7, 4, 2, '#f0a030');
  el(g, x + dir * 11, y - 9.5, 1, 1, '#1b1403');
}

/* ─── Toca (com o chão e a parede que a pessoa escolher) ─── */

function paredeToca(g, tipo) {
  if (tipo === 'parede-pedra') {
    g.fillStyle = '#8c8a86'; g.fillRect(0, 0, W, 330);
    const rnd = sorte(9);
    for (let y = 0; y < 330; y += 34) for (let x = (y / 34) % 2 * -30; x < W; x += 60) ret(g, x + 2, y + 2, 56, 30, ['#9c9a95', '#87857f', '#a5a39d'][Math.floor(rnd() * 3)], 4);
  } else if (tipo === 'parede-tijolo') {
    g.fillStyle = '#b8b0a0'; g.fillRect(0, 0, W, 330);
    for (let y = 0; y < 330; y += 22) for (let x = (y / 22) % 2 * -24; x < W; x += 48) ret(g, x + 1.5, y + 1.5, 45, 19, (x + y) % 3 ? '#b5523a' : '#a8462f', 2);
  } else if (tipo === 'parede-listras') {
    g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, W, 330);
    for (let x = 0; x < W; x += 50) { g.fillStyle = '#9cc28a'; g.fillRect(x, 0, 18, 330); }
    g.fillStyle = '#c9a06a'; g.fillRect(0, 230, W, 8);
  } else {
    g.fillStyle = grad(g, 0, 0, 0, 330, [[0, '#6b4a30'], [1, '#8a6240']]);
    g.fillRect(0, 0, W, 330);
    const rnd = sorte(13);
    for (let k = 0; k < 60; k++) el(g, rnd() * W, rnd() * 320, 4 + rnd() * 8, 3 + rnd() * 5, 'rgba(60,40,25,0.25)');
    g.strokeStyle = 'rgba(90,60,30,0.5)'; g.lineWidth = 3;
    for (let k = 0; k < 6; k++) { const x = rnd() * W; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 20, 40, x - 10, 70 + rnd() * 40); g.stroke(); }
  }
}
function chaoToca(g, tipo) {
  if (tipo === 'piso-grama') chaoGrama(g, 330, H);
  else if (tipo === 'piso-pedra') chaoPedras(g, 330, H, ['#9c9a95', '#8c8a85', '#a7a59f'], '#6f6d68');
  else if (tipo === 'piso-xadrez') chaoXadrez(g, 330, H, '#d8b13a', '#2a3a2e');
  else chaoTabuas(g, 330, H);
}
export function fundoToca(g, toca) {
  paredeToca(g, toca.parede);
  chaoToca(g, toca.piso);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 326, W, 6);
  // O teto arredondado da toca (cantos escuros)
  g.fillStyle = '#2a1c10';
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 220); g.quadraticCurveTo(20, 30, 260, 0); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(W, 0); g.lineTo(W, 220); g.quadraticCurveTo(W - 20, 30, W - 260, 0); g.closePath(); g.fill();
  if (!sp(g, 'porta-toca', 'parado', 500, 362, { quadro: 0 })) portaToca(g);
  for (const x of [400, 600]) {
    brilho(g, x, 236, 70, 'rgba(255,200,120,A)', 0.35);
    if (!sp(g, 'lampiao-toca', 'aceso', x, 266, { quadro: 0 })) lampiaoToca(g, x);
  }
}
function portaToca(g) {
  // A porta redonda (saída)
  el(g, 500, 300, 56, 62, '#4a2e18');
  el(g, 500, 304, 46, 54, '#7a5434');
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 462; x < 540; x += 13) g.fillRect(x, 254, 3, 76);
  el(g, 528, 300, 4, 4, '#e8c24a');
  g.fillStyle = '#7a5434';
  g.fillRect(444, 326, 112, 6);
}
function lampiaoToca(g, x) {
  ret(g, x - 3, 244, 6, 22, '#3a2a1a', 2);
  ret(g, x - 9, 222, 18, 22, '#3a2a1a', 4);
  ret(g, x - 6, 225, 12, 16, '#ffd98a', 3);
}

/* ─── Móveis da toca ─── */
// Cada móvel é desenhado com o ponto (x, y) no chão, embaixo no meio; os de parede, pelo meio.
// w e h: a caixa para clicar e arrastar.
export const MOVEIS = {
  cenouras: { w: 46, h: 40 }, planta: { w: 40, h: 72 }, cadeira: { w: 44, h: 70 }, abajur: { w: 34, h: 86 },
  tapete: { w: 170, h: 56, chao: true }, mesa: { w: 96, h: 60 }, banquinho: { w: 40, h: 40 }, bau: { w: 66, h: 52 },
  estante: { w: 96, h: 140 }, cama: { w: 150, h: 70 }, sofa: { w: 150, h: 76 }, aquario: { w: 86, h: 96 },
  vitrola: { w: 64, h: 92 }, lareira: { w: 140, h: 130 }, trono: { w: 86, h: 132 },
  janela: { w: 80, h: 80, parede: true }, luzes: { w: 180, h: 40, parede: true }, relogio: { w: 46, h: 46, parede: true },
  quadro: { w: 80, h: 66, parede: true }, estandarte: { w: 56, h: 100, parede: true },
};

// Para os sprites: o nome (o mesmo do catálogo do servidor), o tamanho do desenho, a animação e a sombra
// no chão (que o jogo continua fazendo, com ou sem sprite). Sem "anim", o móvel fica parado.
const PECA_MOVEL = {
  cenouras: { nome: 'Cesto de cenouras', l: 46, a: 40, sombra: [24] },
  planta: { nome: 'Vaso de planta', l: 44, a: 78, sombra: [18] },
  cadeira: { nome: 'Cadeira de madeira', l: 44, a: 70, sombra: [22] },
  abajur: { nome: 'Abajur', l: 36, a: 86, sombra: [16], obs: 'A luz em volta continua feita pelo jogo.' },
  tapete: { nome: 'Tapete redondo', l: 170, a: 56 },
  mesa: { nome: 'Mesa redonda', l: 96, a: 64, sombra: [44] },
  banquinho: { nome: 'Banquinho de cogumelo', l: 40, a: 40, sombra: [18] },
  bau: { nome: 'Baú', l: 66, a: 52, sombra: [32] },
  estante: { nome: 'Estante de livros', l: 96, a: 140, sombra: [46] },
  cama: { nome: 'Cama de palha', l: 150, a: 70, sombra: [72] },
  sofa: { nome: 'Sofá verde', l: 160, a: 76, sombra: [72] },
  aquario: { nome: 'Aquário', l: 86, a: 96, sombra: [42], anim: { id: 'nadando', nome: 'Peixinhos nadando', quadros: 6, fps: 6 } },
  vitrola: { nome: 'Vitrola', l: 84, a: 132, sombra: [30], anim: { id: 'tocando', nome: 'Tocando', quadros: 6, fps: 4 } },
  lareira: { nome: 'Lareira', l: 156, a: 134, sombra: [70, 12], anim: { id: 'fogo', nome: 'Fogo aceso', quadros: 4, fps: 8 }, obs: 'O clarão do fogo continua feito pelo jogo.' },
  trono: { nome: 'Trono da Casa', l: 88, a: 150, sombra: [44] },
  janela: { nome: 'Janela redonda', l: 80, a: 80, parede: true },
  luzes: { nome: 'Varal de luzes', l: 200, a: 56, parede: true, anim: { id: 'piscando', nome: 'Piscando', quadros: 2, fps: 3 } },
  relogio: { nome: 'Relógio de parede', l: 46, a: 46, parede: true, obs: 'Os ponteiros continuam feitos pelo jogo, andando por cima.' },
  quadro: { nome: 'Quadro da Casa Luckham', l: 80, a: 66, parede: true },
  estandarte: { nome: 'Estandarte Luckham', l: 60, a: 100, parede: true, anim: { id: 'balancando', nome: 'Balançando', quadros: 4, fps: 4 } },
};
const ANIM_PARADO = { id: 'parado', nome: 'Parado', quadros: 1, fps: 1 };
const animDoMovel = id => PECA_MOVEL[id]?.anim || ANIM_PARADO;

export function desenharMovel(g, id, x, y, v = 0, t = 0) {
  if (ehMovelNovo(id)) { desenharMovelNovo(g, id, x, y, v, t); return; }
  const f = Object.hasOwn(DESENHO_MOVEL, id) && DESENHO_MOVEL[id];
  if (!f) return;
  g.save();
  g.translate(x, y);
  if (v) g.scale(-1, 1);
  const sombra = PECA_MOVEL[id]?.sombra;
  if (sombra) sombraNoChao(g, 0, 2, ...sombra);
  if (!sp(g, `movel-${id}`, animDoMovel(id).id, 0, 0, { t })) f(g, t);
  POR_CIMA_DO_MOVEL[id]?.(g, t);
  g.restore();
}

/* ─── Móveis novos (criados na tela de sprites, só com o sprite) ─── */
// id "n12". O tamanho e se fica na parede ou no chão vêm do catálogo (registrarItensNovos). Sem o sprite,
// aparece uma caixinha tracejada com "?" no lugar (o item nem é vendido antes de ter o sprite).
export function ehMovelNovo(id) { return typeof id === 'string' && /^n\d+$/.test(id); }
const ancoraMovelNovo = info => (info.parede || info.chao ? 'centro' : 'pe');

function desenharMovelNovo(g, id, x, y, v, t) {
  const info = Object.hasOwn(MOVEIS, id) ? MOVEIS[id] : { w: 60, h: 60 };
  g.save();
  g.translate(x, y);
  if (v) g.scale(-1, 1);
  if (!info.parede && !info.chao) sombraNoChao(g, 0, 2, Math.max(10, info.w * 0.42));
  if (!sp(g, `movel-${id}`, 'parado', 0, 0, { t, largura: info.w, altura: info.h, ancora: ancoraMovelNovo(info) })) {
    const topo = info.parede || info.chao ? -info.h / 2 : -info.h;
    ret(g, -info.w / 2, topo, info.w, info.h, 'rgba(232,194,74,0.12)', 6);
    g.strokeStyle = 'rgba(232,194,74,0.7)';
    g.lineWidth = 2;
    g.setLineDash?.([6, 4]);
    g.strokeRect?.(-info.w / 2, topo, info.w, info.h);
    g.setLineDash?.([]);
    g.fillStyle = 'rgba(232,194,74,0.9)';
    g.font = `700 ${Math.max(12, Math.min(40, Math.round(Math.min(info.w, info.h) * 0.5)))}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText?.('?', 0, topo + info.h / 2);
  }
  g.restore();
}

// Registra os móveis novos do catálogo ({ id: 'n12', tipo: 'movel', nome, largura, altura, onde }): o
// tamanho para clicar e arrastar na toca e a peça dos sprites (para o molde e o envio na tela de sprites).
// As roupas novas vão junto para roupas-coelho.js.
export function registrarItensNovos(itens = []) {
  registrarRoupasNovas(itens);
  const pecas = [];
  for (const i of itens) {
    if (i?.tipo !== 'movel' || !ehMovelNovo(i.id)) continue;
    const w = Math.max(10, Math.min(400, Number(i.largura) || 80));
    const hh = Math.max(10, Math.min(400, Number(i.altura) || 80));
    const info = { w, h: hh };
    if (i.onde === 'parede' || i.parede) info.parede = true;
    else if (i.onde === 'tapete' || i.chao) info.chao = true;
    MOVEIS[i.id] = info;
    const ondeFica = info.parede ? 'Móvel de parede das tocas (o meio do desenho fica onde a pessoa pôs).'
      : info.chao ? 'Fica no chão da toca, por baixo de tudo e de todos, como um tapete (o meio do desenho fica onde a pessoa pôs).'
        : 'Móvel das tocas, com o pé no chão (embaixo, no meio do quadro). Quem decora pode virar para o outro lado. A sombra o jogo faz.';
    pecas.push(peca(`movel-${i.id}`, i.nome,
      `Item novo do Club Coelho. ${ondeFica} Não tem desenho de sempre: sem o sprite, o móvel não é vendido e aparece como uma caixinha com "?". Pode ter vários quadros lado a lado para animar.`,
      w, hh, [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 6 }], () => {}, { ancora: ancoraMovelNovo(info), itemNovo: i }));
  }
  registrarPecas(pecas);
}

// O que o jogo desenha por cima do móvel mesmo com sprite (luz, ponteiros).
const POR_CIMA_DO_MOVEL = {
  abajur(g, t) {
    brilho(g, 0, -64, 70, 'rgba(255,225,140,A)', 0.3 + Math.sin(t * 2) * 0.03);
  },
  lareira(g) {
    brilho(g, 0, -30, 110, 'rgba(255,150,70,A)', 0.28);
  },
  relogio(g, t) {
    g.strokeStyle = '#1b1403'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t * 0.1 - 1.5) * 9, Math.sin(t * 0.1 - 1.5) * 9); g.stroke();
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t - 1.5) * 14, Math.sin(t - 1.5) * 14); g.stroke();
  },
};

// O desenho de cada móvel, sem a sombra e sem o que vai por cima.
const DESENHO_MOVEL = {
  cenouras(g) {
    for (const [dx, rot] of [[-10, -0.3], [0, 0], [10, 0.3], [-4, -0.1], [6, 0.15]]) {
      g.save(); g.translate(dx, -26); g.rotate(rot);
      forma(g, '#e07a2a', [-4, 0, 4, 0, 0, 22]);
      el(g, 0, -3, 2, 6, '#4f8a3c', 0.2);
      g.restore();
    }
    forma(g, '#b07e45', [-22, -24, 22, -24, 17, 0, -17, 0]);
    for (const y of [-18, -10]) ret(g, -20, y, 40, 2, 'rgba(90,55,25,0.45)');
  },
  planta(g) {
    forma(g, '#b5523a', [-16, -26, 16, -26, 12, 0, -12, 0]);
    ret(g, -18, -30, 36, 6, '#c96a50', 2);
    for (const [dx, dy, r, rot] of [[-12, -46, 13, -0.6], [10, -50, 14, 0.5], [0, -64, 12, 0], [-4, -40, 10, 0.2]]) el(g, dx, dy, r * 0.55, r, '#4f8a3c', rot);
  },
  cadeira(g) {
    ret(g, -18, -70, 6, 70, '#7a4a2a');
    ret(g, 12, -70, 6, 70, '#7a4a2a');
    ret(g, -18, -70, 36, 8, '#8a5a32', 3);
    ret(g, -18, -54, 36, 6, '#8a5a32', 3);
    ret(g, -20, -34, 40, 9, '#9c6a3c', 3);
    ret(g, -16, -26, 5, 26, '#6b4226'); ret(g, 11, -26, 5, 26, '#6b4226');
  },
  abajur(g) {
    el(g, 0, -3, 14, 4, '#5b3c22');
    ret(g, -2, -60, 4, 58, '#5b3c22');
    forma(g, '#f4dd80', [-18, -58, 18, -58, 11, -86, -11, -86]);
  },
  tapete(g) {
    el(g, 0, 0, 84, 26, '#8a2f3a');
    el(g, 0, 0, 72, 21, '#b84a50');
    el(g, 0, 0, 52, 14, '#d8b13a');
    el(g, 0, 0, 30, 8, '#8a2f3a');
  },
  mesa(g) {
    ret(g, -4, -44, 8, 44, '#5b3c22');
    el(g, 0, -2, 20, 5, '#5b3c22');
    el(g, 0, -46, 46, 13, '#8a5a32');
    el(g, 0, -50, 46, 13, '#b07e50');
    el(g, -12, -52, 7, 3, '#f7f3ea'); el(g, 14, -53, 9, 4, '#e07a2a');
  },
  banquinho(g) {
    ret(g, -8, -24, 16, 24, '#f2e8cf', 4);
    el(g, 0, -28, 20, 12, '#d8504a');
    for (const [dx, dy] of [[-8, -32], [6, -30], [0, -36], [10, -26]]) el(g, dx, dy, 2.6, 2, '#ffffff');
  },
  bau(g) {
    ret(g, -32, -34, 64, 34, '#8a5a32', 4);
    g.fillStyle = '#9c6a3c';
    g.beginPath(); g.ellipse(0, -34, 32, 16, 0, Math.PI, 0); g.fill();
    for (const dx of [-24, 20]) ret(g, dx, -48, 5, 48, '#d8b13a');
    ret(g, -6, -30, 12, 12, '#e8c24a', 2);
    el(g, 0, -24, 1.6, 2.2, '#3a2414');
  },
  estante(g) {
    ret(g, -46, -140, 92, 140, '#7a4a2a', 4);
    ret(g, -40, -134, 80, 128, '#5b3420', 2);
    const cores = ['#c0392b', '#2f6b34', '#d8b13a', '#5aa0d8', '#7b5ab8', '#e07a2a'];
    for (let p = 0; p < 4; p++) {
      const y = -132 + p * 32;
      ret(g, -42, y + 28, 84, 4, '#8a5a32');
      for (let k = 0; k < 8; k++) ret(g, -38 + k * 10, y + 6 + (k % 3), 8, 22 - (k % 3), cores[(k + p) % 6], 1);
    }
  },
  cama(g) {
    ret(g, -74, -64, 12, 64, '#7a4a2a', 3);
    ret(g, 62, -46, 12, 46, '#7a4a2a', 3);
    ret(g, -68, -36, 136, 24, '#e6c56b', 6);
    ret(g, -64, -46, 128, 22, '#f2e8cf', 8);
    ret(g, -20, -48, 84, 30, '#5aa0d8', 8);
    for (let x = -14; x < 60; x += 14) ret(g, x, -46, 6, 26, 'rgba(255,255,255,0.18)', 2);
    el(g, -46, -50, 20, 10, '#ffffff');
  },
  sofa(g) {
    ret(g, -72, -76, 144, 44, '#2f6b34', 14);
    ret(g, -72, -40, 144, 30, '#3a7a3c', 8);
    ret(g, -80, -56, 18, 46, '#2b5e2f', 8);
    ret(g, 62, -56, 18, 46, '#2b5e2f', 8);
    for (const dx of [-36, 36]) ret(g, dx - 30, -46, 60, 14, '#4f8a4c', 6);
    for (const dx of [-66, 60]) ret(g, dx, -12, 6, 12, '#3a2414');
  },
  aquario(g, t) {
    ret(g, -40, -36, 80, 36, '#5b3c22', 3);
    ret(g, -42, -96, 84, 62, 'rgba(160,210,240,0.55)', 4);
    ret(g, -38, -84, 76, 48, 'rgba(70,150,200,0.55)', 2);
    ret(g, -38, -42, 76, 6, '#d8c89a');
    for (let k = 0; k < 3; k++) {
      const fx = Math.sin(t * (0.8 + k * 0.3) + k * 2) * 26;
      const fy = -70 + k * 10;
      const dir = Math.cos(t * (0.8 + k * 0.3) + k * 2) > 0 ? 1 : -1;
      el(g, fx, fy, 6, 3.5, ['#e8a040', '#e05a5a', '#f4dd80'][k]);
      forma(g, ['#e8a040', '#e05a5a', '#f4dd80'][k], [fx - dir * 5, fy, fx - dir * 10, fy - 3, fx - dir * 10, fy + 3]);
    }
    el(g, 22, -60 - ((t * 20) % 30), 2, 2, 'rgba(255,255,255,0.7)');
    for (const dx of [-26, -18, 28]) el(g, dx, -46, 3, 8, '#4f8a3c');
  },
  vitrola(g, t) {
    ret(g, -28, -34, 56, 34, '#7a4a2a', 4);
    el(g, -2, -36, 22, 6, '#111');
    ret(g, -3, -60, 5, 26, '#b8922a');
    g.fillStyle = '#d8b13a';
    g.beginPath(); g.moveTo(0, -58); g.lineTo(26, -92); g.quadraticCurveTo(36, -74, 24, -60); g.closePath(); g.fill();
    for (let k = 0; k < 2; k++) {
      const f = (t * 0.6 + k * 0.5) % 1;
      texto(g, '♪', 30 + Math.sin(f * 6) * 6, -90 - f * 40, { cor: `rgba(255,230,140,${1 - f})`, fonte: '700 16px serif' });
    }
  },
  lareira(g, t) {
    ret(g, -70, -130, 140, 130, '#9c9a95', 4);
    ret(g, -78, -134, 156, 14, '#7f7d78', 3);
    ret(g, -42, -86, 84, 86, '#2a1c10', 6);
    for (const [dx, rot] of [[-12, 0.4], [12, -0.4]]) { g.save(); g.translate(dx, -8); g.rotate(rot); ret(g, -20, -4, 40, 8, '#5b3c22', 3); g.restore(); }
    const tremor = k => Math.sin(t * 11 + k) * 3;
    el(g, tremor(1) * 0.5, -26, 18, 26 + tremor(2), '#e0682a');
    el(g, tremor(3) * 0.6, -22, 12, 18 + tremor(4), '#f4b03a');
    el(g, 0, -16, 6, 10, '#fff1a8');
  },
  trono(g) {
    ret(g, -40, -132, 80, 100, '#b8922a', 10);
    ret(g, -32, -122, 64, 84, '#8a2f3a', 8);
    forma(g, '#e8c24a', [-18, -132, -10, -146, -2, -136, 0, -150, 2, -136, 10, -146, 18, -132]);
    ret(g, -44, -50, 88, 22, '#b8922a', 6);
    ret(g, -38, -56, 76, 14, '#a8343e', 6);
    for (const dx of [-38, 30]) ret(g, dx, -30, 8, 30, '#8a6a20', 2);
  },
  janela(g, t) {
    el(g, 0, 0, 40, 40, '#5b3c22');
    el(g, 0, 0, 33, 33, grad(g, 0, -33, 0, 33, [[0, '#8fd3f4'], [1, '#d4f1fb']]));
    el(g, -10 + Math.sin(t * 0.3) * 8, -8, 10, 6, 'rgba(255,255,255,0.9)');
    ret(g, -2, -33, 4, 66, '#5b3c22');
    ret(g, -33, -2, 66, 4, '#5b3c22');
  },
  luzes(g, t) {
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-90, -10); g.quadraticCurveTo(0, 22, 90, -10); g.stroke();
    for (let k = 0; k < 9; k++) {
      const f = k / 8;
      const x = -90 + f * 180;
      const y = -10 + 4 * 32 * f * (1 - f) * 0.62;
      const aceso = (Math.floor(t * 3) + k) % 2 === 0;
      const cor = ['#ff7ad9', '#6be0ff', '#ffe46b', '#7fe08a'][k % 4];
      el(g, x, y + 6, 4, 6, aceso ? cor : '#555');
      if (aceso) brilho(g, x, y + 6, 18, 'rgba(255,240,180,A)', 0.25);
    }
  },
  relogio(g) {
    el(g, 0, 0, 23, 23, '#7a4a2a');
    el(g, 0, 0, 19, 19, '#f7f3ea');
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, Math.cos(a) * 15, Math.sin(a) * 15, 1.2, 1.2, '#3a2414'); }
  },
  quadro(g) {
    ret(g, -40, -33, 80, 66, '#b8922a', 4);
    ret(g, -33, -26, 66, 52, '#1f4a2a', 2);
    el(g, 0, 4, 12, 10, '#e8c24a');
    el(g, 0, -10, 8, 7, '#e8c24a');
    el(g, -3, -21, 2.4, 7, '#e8c24a', -0.2); el(g, 3, -21, 2.4, 7, '#e8c24a', 0.2);
    forma(g, '#e8c24a', [-7, -16, -6, -22, -2, -18, 0, -24, 2, -18, 6, -22, 7, -16]);
  },
  estandarte(g, t) {
    ret(g, -30, -50, 60, 5, '#5b3c22', 2);
    const o = Math.sin(t * 1.5) * 2;
    g.fillStyle = '#1f4a2a';
    g.beginPath(); g.moveTo(-24, -46); g.lineTo(24, -46); g.lineTo(24 + o * 0.3, 38); g.lineTo(0, 28 + o); g.lineTo(-24 + o * 0.3, 38); g.closePath(); g.fill();
    el(g, 0, -6, 12, 11, '#e8c24a');
    el(g, -3, -20, 2.2, 6, '#e8c24a', -0.2); el(g, 3, -20, 2.2, 6, '#e8c24a', 0.2);
  },
};

/* ─── As salas ─── */
// pontos: { x0, y0, x1, y1, ir: [x, y], acao, rotulo }. acao: 'sala:<id>', 'loja', 'provador', 'pesca',
// 'danca', 'tocas', 'cafe'.
export const SALAS = {
  praca: {
    fundo: fundoPraca, animar: animarPraca,
    objetos: [
      { y: 470, desenhar: fonte },
      { y: 530, desenhar: g => banco(g, 240, 530) }, { y: 530, desenhar: g => banco(g, 760, 530) },
      { y: 375, desenhar: (g, t) => poste(g, 345, 375, t) }, { y: 375, desenhar: (g, t) => poste(g, 655, 375, t) },
      { y: 462, desenhar: g => setaDupla(g, 168, 462, ['Lago', 'Ancoradouro'], -1) },
      { y: 462, desenhar: g => setaDupla(g, 832, 462, ['Forte Nevado', 'Plaza'], 1) },
      { y: 594, desenhar: g => canteiro(g, 330, 594) }, { y: 594, desenhar: g => canteiro(g, 670, 594) },
    ],
    pontos: [
      { x0: 178, y0: 248, x1: 242, y1: 345, ir: [210, 362], acao: 'sala:cafe', rotulo: 'Café da Cenoura' },
      { x0: 462, y0: 244, x1: 538, y1: 345, ir: [500, 352], acao: 'sala:loja', rotulo: 'Armarinho' },
      { x0: 762, y0: 246, x1: 828, y1: 345, ir: [795, 362], acao: 'sala:danca', rotulo: 'Salão de Dança' },
      { x0: 0, y0: 350, x1: 136, y1: 458, ir: [40, 405], acao: 'sala:lago', rotulo: 'Lago Cintilante' },
      { x0: 0, y0: 462, x1: 136, y1: 575, ir: [40, 520], acao: 'sala:ancoradouro', rotulo: 'Ancoradouro' },
      { x0: 864, y0: 350, x1: 1000, y1: 458, ir: [960, 405], acao: 'sala:forte', rotulo: 'Forte Nevado' },
      { x0: 864, y0: 462, x1: 1000, y1: 575, ir: [960, 520], acao: 'sala:plaza', rotulo: 'Plaza' },
      { x0: 410, y0: 562, x1: 590, y1: 600, ir: [500, 582], acao: 'tocas', rotulo: 'Tocas dos moradores' },
    ],
  },
  cafe: {
    fundo: fundoCafe, animar: animarCafe,
    objetos: [
      { y: 378, desenhar: balcaoCafe },
      { y: 452, desenhar: g => mesaCafe(g, 210, 452) }, { y: 512, desenhar: g => mesaCafe(g, 420, 512) },
      { y: 560, desenhar: g => mesaCafe(g, 200, 562) }, { y: 470, desenhar: g => mesaCafe(g, 690, 472) },
    ],
    pontos: [
      { x0: 600, y0: 240, x1: 940, y1: 380, ir: [720, 398], acao: 'cafe', rotulo: 'Pegar um café de cenoura' },
      { x0: 0, y0: 56, x1: 140, y1: 400, ir: [70, 392], acao: 'sala:leitura', rotulo: 'Subir para a Sala de Leitura' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:praca', rotulo: 'Voltar à praça' },
    ],
  },
  loja: {
    fundo: fundoLoja,
    objetos: [
      { y: 384, desenhar: balcaoLoja },
      { y: 450, desenhar: (g, t) => espelho(g, 130, 450, t) },
      { y: 440, desenhar: (g, t) => manequim(g, 780, 440, 'manequim-smoking', t) },
      { y: 500, desenhar: (g, t) => manequim(g, 880, 500, 'manequim-vestido', t) },
    ],
    pontos: [
      { x0: 370, y0: 270, x1: 630, y1: 390, ir: [500, 405], acao: 'loja', rotulo: 'Ver o catálogo' },
      { x0: 90, y0: 280, x1: 170, y1: 455, ir: [175, 470], acao: 'provador', rotulo: 'Provador (meu coelho)' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:praca', rotulo: 'Voltar à praça' },
    ],
  },
  danca: {
    fundo: fundoDanca, animar: animarDanca,
    objetos: [
      { y: 330, desenhar: (g, t) => caixaDeSom(g, 110, 330, t) }, { y: 330, desenhar: (g, t) => caixaDeSom(g, 890, 330, t) },
      { y: 300, desenhar: dj },
      { y: 340, desenhar: (g, t) => maquinaDanca(g, 735, 340, t) },
    ],
    pontos: [
      { x0: 690, y0: 196, x1: 780, y1: 345, ir: [735, 362], acao: 'danca', rotulo: 'Jogar Dança da Toca' },
      { x0: 196, y0: 84, x1: 348, y1: 345, ir: [272, 352], acao: 'sala:fliperama', rotulo: 'Subir para o Fliperama' },
      { x0: 614, y0: 228, x1: 688, y1: 345, ir: [654, 356], acao: 'sala:caldeira', rotulo: 'Descer para a Sala da Caldeira' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:praca', rotulo: 'Voltar à praça' },
    ],
  },
  lago: {
    fundo: fundoLago, animar: animarLago,
    objetos: [{ y: 392, desenhar: trapiche }],
    pontos: [
      { x0: 180, y0: 320, x1: 400, y1: 420, ir: [300, 410], acao: 'pesca', rotulo: 'Pescar' },
      { x0: 900, y0: 420, x1: 1000, y1: 570, ir: [962, 500], acao: 'sala:praca', rotulo: 'Voltar à praça' },
    ],
  },
  toca: {
    fundo: null,
    objetos: [],
    pontos: [{ x0: 444, y0: 238, x1: 556, y1: 335, ir: [500, 345], acao: 'sala:praca', rotulo: 'Sair da toca' }],
  },
};

/* ─── Sprites (veja sprites.js) ─── */
// Cada prévia é o desenho de sempre, sem sprite, com a âncora da peça em (0, 0).
const NO_FUNDO = ' Faz parte do fundo da sala, então fica parado (vale só o primeiro quadro).';
const animacao = (id, nome, quadros = 1, fps = 1) => [{ id, nome, quadros, fps }];
const PARADO = [ANIM_PARADO];
const peca = (chave, nome, desc, largura, altura, animacoes, previa, extra = {}) => ({
  chave: `clube.${chave}`, jogo: 'Club Coelho', nome, desc, largura, altura, ancora: 'pe', animacoes, previa, ...extra,
});

export const SPRITES = [
  ...Object.entries(NPCS).map(([id, n]) => peca(id, n.nome,
    `O NPC ${n.sala}. O sprite troca o coelho inteiro, com a roupa. Olhando para a direita.`,
    Math.round(44 * n.escala), Math.round(56 * n.escala), animacao('parado', 'Parado', 2, 3),
    (g, anim, t) => { g.save(); g.scale(n.escala, n.escala); desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir: 1, t: t * (n.vel || 1), semSprite: true }); g.restore(); })),
  ...Object.entries(MANEQUINS).map(([id, m]) => peca(id, m.nome,
    'Na loja do Armarinho, com a roupa à mostra e o pezinho de madeira. A sombra continua feita pelo jogo.',
    64, 96, PARADO, g => manequimCorpo(g, 0, -2, m.roupa, true))),
  // Praça
  peca('fachada-cafe', 'Fachada do Café da Cenoura', `A casinha do Café na praça. A fumaça da chaminé e o brilho das janelas continuam feitos pelo jogo.${NO_FUNDO}`,
    260, 266, PARADO, g => naOrigem(g, 210, 335, () => fachadaCafe(g))),
  peca('fachada-armarinho', 'Fachada do Armarinho', `A loja de roupas na praça. O brilho da vitrine continua feito pelo jogo.${NO_FUNDO}`,
    270, 244, PARADO, g => naOrigem(g, 500, 335, () => fachadaArmarinho(g))),
  peca('fachada-salao', 'Fachada do Salão de Dança', `O Salão na praça. O letreiro de neon, as luzinhas e as janelas coloridas continuam feitos pelo jogo, por cima.${NO_FUNDO}`,
    240, 208, PARADO, g => naOrigem(g, 790, 335, () => fachadaSalao(g))),
  peca('arvore', 'Árvore da praça', `As árvores redondas atrás da praça (o jogo muda o tamanho de cada uma).${NO_FUNDO}`,
    64, 64, PARADO, g => copaRedonda(g, 0, 0, 32, '#4f8a3c')),
  peca('fonte', 'Fonte da praça', 'A fonte no meio da praça, com a estátua do coelho e os jatos de água. A sombra no chão continua feita pelo jogo.',
    210, 150, animacao('agua', 'Água correndo', 6, 8), (g, anim, t) => fonteCorpo(g, 0, -24, t, true)),
  peca('estatua', 'Estátua do coelho', 'A estátua de pedra em cima da fonte (só aparece quando a fonte não tem sprite próprio).',
    40, 52, PARADO, g => estatua(g, 0, 0, true)),
  peca('banco', 'Banco da praça', 'Os bancos de madeira da praça. A sombra continua feita pelo jogo.',
    92, 46, PARADO, g => bancoCorpo(g, 0, 0)),
  peca('poste', 'Poste de luz', 'Os postes da praça. O brilho da lâmpada continua feito pelo jogo.',
    24, 140, animacao('aceso', 'Aceso'), g => posteCorpo(g, 0, 0)),
  peca('placa-seta', 'Placa de seta', 'As placas de seta da praça (Lago, Ancoradouro, Forte Nevado, Plaza; nos postes com duas, a de cima é a mesma placa 40 mais alta). Desenhe a placa apontando para a direita e sem letras: o jogo vira para o lado certo e escreve o nome por cima.',
    132, 88, PARADO, g => setaCorpo(g, 0, 0, 1)),
  peca('canteiro', 'Canteiro de flores', 'Os canteiros floridos na frente da praça.',
    80, 32, PARADO, g => canteiroCorpo(g, 0, 0)),
  peca('borboleta', 'Borboleta', 'As borboletas que voam pela praça. Marque "pintar com a cor" e desenhe em tons claros: cada uma fica de uma cor.',
    18, 10, animacao('voando', 'Voando', 2, 9), (g, anim, t) => borboleta(g, 0, 0, Math.abs(Math.sin(t * 14)) * 5 + 1, '#f4dd80'), { ancora: 'centro', tingir: true }),
  // Café da Cenoura
  peca('janela-cafe', 'Janela do Café', `A janela com cortinas, mostrando a praça lá fora.${NO_FUNDO}`,
    220, 166, PARADO, g => naOrigem(g, 210, 240, () => janelaCafe(g))),
  peca('cardapio', 'Cardápio do Café', `O quadro-negro com o cardápio (as letras fazem parte do desenho).${NO_FUNDO}`,
    206, 166, PARADO, g => naOrigem(g, 480, 233, () => cardapio(g))),
  peca('prateleira-potes', 'Prateleira de potes', `A prateleira com os potes de geleia atrás do balcão.${NO_FUNDO}`,
    300, 48, PARADO, g => naOrigem(g, 780, 130, () => prateleiraPotes(g))),
  peca('escada-cafe', 'Escada do Café', `A escada de madeira na parede da esquerda, que sobe para a Sala de Leitura (com a placa "Leitura").${NO_FUNDO}`,
    140, 360, PARADO, g => naOrigem(g, 70, 384, () => escadaCafe(g))),
  peca('luminaria-cafe', 'Luminária do Café', 'As luminárias penduradas no teto (a âncora é o ponto do teto). O brilho continua feito pelo jogo.',
    44, 58, animacao('acesa', 'Acesa'), g => luminariaCafe(g, 0), { ancora: 'topo' }),
  peca('balcao-cafe', 'Balcão do Café', 'O balcão com a máquina de café (soltando vapor) e o bolo de cenoura. O cozinheiro é outra peça.',
    340, 130, animacao('vapor', 'Soltando vapor', 4, 3), (g, anim, t) => naOrigem(g, 770, 378, () => balcaoCafeCorpo(g, t))),
  peca('mesa-cafe', 'Mesa do Café', 'As mesinhas redondas com duas cadeiras. A sombra continua feita pelo jogo.',
    124, 58, PARADO, g => mesaCafeCorpo(g, 0, 0)),
  // Armarinho
  peca('prateleira-roupas', 'Prateleiras de roupas', `As três prateleiras com roupas dobradas.${NO_FUNDO}`,
    260, 196, PARADO, g => naOrigem(g, 170, 280, () => prateleiraRoupas(g))),
  peca('arara', 'Arara de roupas', `A arara com as roupas penduradas.${NO_FUNDO}`,
    260, 210, PARADO, g => naOrigem(g, 830, 300, () => arara(g))),
  peca('placa-armarinho', 'Placa do Armarinho', `A placa "Armarinho da Dona Felpuda" na parede (as letras fazem parte do desenho).${NO_FUNDO}`,
    366, 50, PARADO, g => naOrigem(g, 500, 60, () => placaArmarinho(g)), { ancora: 'centro' }),
  peca('balcao-loja', 'Balcão do Armarinho', 'O balcão com o livro do catálogo aberto, que brilha. A Dona Felpuda é outra peça.',
    260, 100, animacao('brilhando', 'Livro brilhando', 4, 2), (g, anim, t) => naOrigem(g, 500, 384, () => balcaoLojaCorpo(g, t))),
  peca('espelho', 'Espelho do provador', 'O espelho grande do provador, com o reflexo que brilha. A sombra continua feita pelo jogo.',
    72, 162, animacao('brilhando', 'Brilhando', 4, 2), (g, anim, t) => espelhoCorpo(g, 0, 0, t)),
  // Salão de Dança
  peca('cabine-dj', 'Cabine do DJ', `A cabine com os dois toca-discos (as letras fazem parte do desenho).${NO_FUNDO}`,
    220, 90, PARADO, g => naOrigem(g, 500, 330, () => cabineDj(g))),
  peca('escada-salao', 'Escada do Fliperama', `A escada com a beirada de neon que sobe do Salão para o Fliperama, com a porta lá em cima. O letreiro piscando e a luz das máquinas continuam feitos pelo jogo.${NO_FUNDO}`,
    150, 236, PARADO, g => naOrigem(g, 272, 340, () => escadaSalao(g))),
  peca('porta-caldeira', 'Porta da Caldeira', `A porta de ferro do porão do Salão, que desce para a Sala da Caldeira (com a placa). O vapor continua feito pelo jogo.${NO_FUNDO}`,
    84, 112, PARADO, g => naOrigem(g, 654, 340, () => portaCaldeira(g))),
  peca('globo', 'Globo espelhado', 'O globo no teto do Salão. O fio e os raios de luz coloridos continuam feitos pelo jogo.',
    60, 60, animacao('girando', 'Girando', 4, 6), (g, anim, t) => globo(g, 0, 0, t), { ancora: 'centro' }),
  peca('caixa-som', 'Caixa de som', 'As caixas de som dos dois lados da pista, pulsando com a música. A sombra continua feita pelo jogo.',
    110, 150, animacao('tocando', 'Tocando', 4, 6), (g, anim, t) => caixaDeSomCorpo(g, 0, 0, t)),
  peca('maquina-danca', 'Máquina da Dança da Toca', 'O fliperama onde se joga a Dança da Toca. A sombra continua feita pelo jogo.',
    84, 140, animacao('piscando', 'Piscando', 4, 6), (g, anim, t) => maquinaDancaCorpo(g, 0, 0, t)),
  // Lago Cintilante
  peca('cabana', 'Cabana do pescador', `A cabana do outro lado do Lago.${NO_FUNDO}`,
    134, 126, PARADO, g => naOrigem(g, 875, 330, () => cabana(g))),
  peca('trapiche', 'Trapiche', 'O cais de madeira que entra no Lago, onde fica o velho pescador.',
    90, 166, PARADO, g => naOrigem(g, 300, 390, () => trapicheCorpo(g))),
  peca('placa-pescaria', 'Placa da Pescaria', 'A placa "Pescaria" na beira do Lago (as letras fazem parte do desenho).',
    108, 66, PARADO, g => naOrigem(g, 231, 400, () => placaPescaria(g))),
  peca('balde', 'Balde de peixes', 'O baldinho ao lado do trapiche.',
    26, 26, PARADO, g => naOrigem(g, 369, 406, () => balde(g))),
  peca('pato', 'Patinho', 'Os patinhos que nadam no Lago. Olhando para a direita; a marquinha na água continua feita pelo jogo.',
    40, 22, animacao('nadando', 'Nadando', 1, 2), g => pato(g, 0, -8, 1)),
  peca('peixe-pulando', 'Peixe que pula', 'O peixe que pula no Lago de vez em quando. Olhando para a direita: o jogo vira e inclina no pulo (o pulo inteiro passa pelos quadros uma vez).',
    20, 10, animacao('pulando', 'Pulando', 1, 4), g => el(g, 0, 0, 9, 4, '#e8a040'), { ancora: 'centro' }),
  // Tocas
  peca('porta-toca', 'Porta da toca', `A porta redonda de saída, no fundo de todas as tocas.${NO_FUNDO}`,
    112, 124, PARADO, g => naOrigem(g, 500, 362, () => portaToca(g))),
  peca('lampiao-toca', 'Lampião da toca', `Os dois lampiões na parede das tocas. O brilho continua feito pelo jogo.${NO_FUNDO}`,
    18, 44, animacao('aceso', 'Aceso'), g => lampiaoToca(g, 0)),
  ...Object.keys(MOVEIS).map(id => {
    const p = PECA_MOVEL[id];
    const ondeFica = p.parede ? 'Móvel de parede das tocas (o meio do desenho fica onde a pessoa pôs).'
      : MOVEIS[id].chao ? 'Fica no chão da toca, por baixo de tudo e de todos.'
        : 'Móvel das tocas, com o pé no chão. Quem decora pode virar para o outro lado.';
    return peca(`movel-${id}`, p.nome, [ondeFica, p.obs, p.sombra && 'A sombra continua feita pelo jogo.'].filter(Boolean).join(' '),
      p.l, p.a, [animDoMovel(id)], (g, anim, t) => DESENHO_MOVEL[id](g, t), { ancora: p.parede || MOVEIS[id].chao ? 'centro' : 'pe' });
  }),
];
registrarPecas(SPRITES);

// As utilidades de desenho, para as regiões da Ilha (public/js/ilha/*.js) desenharem no mesmo estilo.
export const DESENHO = {
  el, ret, grad, brilho, texto, forma, placa, nuvem, sombraNoChao, naOrigem,
  chaoPedras, chaoTabuas, chaoXadrez, chaoGrama, arvoreRedonda, copaRedonda, setaPlaca, setaDupla,
  banco, poste, canteiro, borboleta,
};
