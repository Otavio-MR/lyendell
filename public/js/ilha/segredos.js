// Região "segredos" da Ilha do Club Coelho (veja clube-ilha.js): as salas escondidas e o Dojo.
//   qg                 QG da Guarda Secreta do Coelho (telas, a Missão do dia e o Telefone Espião)
//   caldeira           Sala da Caldeira (embaixo do Salão de Dança: jornais antigos, um tijolo solto, o duto do QG)
//   patio_dojo         Pátio do Dojo (jardim na neve, cerejeira, lanternas de pedra)
//   dojo               Dojo (o Sensei e o Desafio Ninja; portas para os dojos dos elementos e o esconderijo)
//   dojo_fogo, dojo_agua, dojo_neve   os dojos dos elementos (abrem com a faixa: laranja, azul e roxa)
//   esconderijo_ninja  Esconderijo Ninja (só faixa preta)
//   dimensao_caixas    Dimensão das Caixas (caixas roxas flutuantes; uma leva de volta ao Pet Shop)
// Os minijogos (Missão do dia, Desafio Ninja) e as janelas (Telefone Espião, jornais) ficam em segredos-jogos.js,
// importado só na hora: este arquivo não usa nada da página e dá para testar no Node.

import { registrarRegiao, INFO_SALAS } from '../clube-ilha.js';
import { desenharCoelho, sorte, quebrarTexto } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite } from '../sprites.js';

const W = 1000;
const H = 600;
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `ilha-segredos.${peca}`, anim, x, y, o);
function naOrigem(g, x, y, f) { g.save(); g.translate(-x, -y); f(); g.restore(); }

/* ─── Utilidades de desenho (exportadas para os minijogos e para quem quiser) ─── */

export function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  g.fill();
}
export function ret(g, x, y, w, h, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}
export function contorno(g, x, y, w, h, cor, lw = 2, r = 0) {
  g.strokeStyle = cor;
  g.lineWidth = lw;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.stroke();
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
export function linha(g, cor, lw, pts) {
  g.strokeStyle = cor;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
export function placa(g, x, y, w, h, textoPlaca, { fundo = '#8a6a44', borda = '#5b4228', cor = '#fbf3e0', fonte = '700 15px "Cinzel", Georgia, serif' } = {}) {
  ret(g, x - w / 2, y - h / 2, w, h, fundo, 6);
  contorno(g, x - w / 2, y - h / 2, w, h, borda, 3, 6);
  texto(g, textoPlaca, x, y + 1, { cor, fonte });
}
export const sombraNoChao = (g, x, y, rx, ry = rx * 0.28) => el(g, x, y, rx, ry, 'rgba(0,0,0,0.22)');

// O balão de fala de um NPC (x, y: a ponta do balão).
export function balaoFala(g, x, y, fala, alpha = 1, largura = 240) {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.font = '15px "EB Garamond", Georgia, serif';
  const linhas = quebrarTexto(g, fala, largura);
  const w = Math.max(40, ...linhas.map(l => g.measureText(l).width)) + 24;
  const hh = linhas.length * 18 + 14;
  const bx = Math.max(8, Math.min(W - w - 8, x - w / 2));
  const by = y - hh - 9;
  ret(g, bx, by, w, hh, '#fffaf0', 10);
  contorno(g, bx, by, w, hh, '#8a6a44', 1.5, 10);
  forma(g, '#fffaf0', [x - 8, by + hh - 1, x, by + hh + 9, x + 8, by + hh - 1]);
  g.fillStyle = '#2a2016';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  linhas.forEach((l, k) => g.fillText(l, bx + w / 2, by + 16 + k * 18));
  g.restore();
}

// Os símbolos dos três elementos (também nas cartas do Desafio Ninja).
export function chama(g, x, y, r, cor, k = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x, y + r);
  g.bezierCurveTo(x - r * 0.95, y + r, x - r * 0.9, y - r * 0.1, x - r * 0.32, y - r * 0.55);
  g.quadraticCurveTo(x - r * 0.28, y - r * 0.12, x - r * 0.06, y - r * 0.08);
  g.quadraticCurveTo(x - r * 0.12, y - r * 0.7, x + r * 0.12 + k, y - r * 1.08);
  g.quadraticCurveTo(x + r * 0.22, y - r * 0.5, x + r * 0.56, y - r * 0.36);
  g.bezierCurveTo(x + r * 0.98, y + r * 0.05, x + r * 0.92, y + r, x, y + r);
  g.closePath();
  g.fill();
}
export function simboloFogo(g, x, y, r, t = 0) {
  const k = Math.sin(t * 9) * r * 0.08;
  chama(g, x, y, r, '#d9381a', k);
  chama(g, x, y + r * 0.2, r * 0.72, '#f5892a', k * 0.8);
  chama(g, x, y + r * 0.44, r * 0.42, '#ffe27a', k * 0.6);
}
export function simboloAgua(g, x, y, r, t = 0) {
  g.fillStyle = grad(g, x, y - r, x, y + r, [[0, '#7fd0ff'], [1, '#1f6fc4']]);
  g.beginPath();
  g.moveTo(x, y - r);
  g.bezierCurveTo(x + r * 0.35, y - r * 0.45, x + r * 0.8, y - r * 0.05, x + r * 0.8, y + r * 0.3);
  g.arc(x, y + r * 0.3, r * 0.8, 0, Math.PI);
  g.bezierCurveTo(x - r * 0.8, y - r * 0.05, x - r * 0.35, y - r * 0.45, x, y - r);
  g.fill();
  el(g, x - r * 0.3, y + r * 0.05, r * 0.14, r * 0.26, 'rgba(255,255,255,0.75)', 0.4);
  const o = Math.sin(t * 4) * r * 0.06;
  linha(g, 'rgba(255,255,255,0.6)', Math.max(1, r * 0.08), [x - r * 0.45, y + r * 0.55 + o, x - r * 0.15, y + r * 0.45 - o, x + r * 0.15, y + r * 0.55 + o, x + r * 0.45, y + r * 0.45 - o]);
}
export function simboloNeve(g, x, y, r, t = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(t * 0.3);
  g.lineCap = 'round';
  for (const [cor, lw] of [['#4a9fd8', r * 0.22], ['#f2fbff', r * 0.11]]) {
    g.strokeStyle = cor;
    g.lineWidth = Math.max(1, lw);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(c * r, s * r);
      for (const f of [0.5, 0.75]) {
        const px = c * r * f;
        const py = s * r * f;
        const b = r * 0.25;
        g.moveTo(px, py); g.lineTo(px + Math.cos(a + 0.8) * b, py + Math.sin(a + 0.8) * b);
        g.moveTo(px, py); g.lineTo(px + Math.cos(a - 0.8) * b, py + Math.sin(a - 0.8) * b);
      }
      g.stroke();
    }
  }
  el(g, 0, 0, r * 0.16, r * 0.16, '#ffffff');
  g.restore();
}
export const SIMBOLO = { fogo: simboloFogo, agua: simboloAgua, neve: simboloNeve };

// Pequenas coisas que caem ou sobem (neve, pétalas, brasas): posição sempre igual para o mesmo k e t.
function particulas(g, n, t, { semente = 1, vel = 30, vento = 10, x0 = 0, x1 = W, y0 = 0, y1 = H, cor = '#fff', r = 2, subir = false, alfa = 1 }) {
  const rnd = sorte(semente);
  g.save();
  g.globalAlpha = alfa;
  for (let k = 0; k < n; k++) {
    const bx = rnd();
    const by = rnd();
    const v = vel * (0.6 + rnd() * 0.8);
    const alt = y1 - y0;
    let y = (by * alt + t * v) % alt;
    if (subir) y = alt - y;
    const x = x0 + ((bx * (x1 - x0) + Math.sin(t * 0.8 + k) * vento + t * vento * 0.3) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
    el(g, x, y0 + y, r * (0.6 + (k % 3) * 0.3), r * (0.6 + (k % 3) * 0.3), typeof cor === 'function' ? cor(k) : cor);
  }
  g.restore();
}

function chaoLajes(g, y0, y1, cores, fundo, semente = 7) {
  g.fillStyle = fundo;
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(semente);
  let y = y0;
  let fila = 0;
  while (y < y1) {
    const h = 12 + (y - y0) * 0.07;
    const w = h * 2.6;
    for (let x = (fila % 2) * -w / 2; x < W; x += w) ret(g, x + 1.5, y + 1.5, w - 3, h - 3, cores[Math.floor(rnd() * cores.length)], Math.min(5, h / 4));
    y += h;
    fila++;
  }
}
function chaoTabuas(g, y0, y1, cores, linhaCor = 'rgba(30,15,5,0.4)', semente = 11) {
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
// A saída de baixo (o tapetinho com "Saída", como nas salas antigas).
function tapeteSaida(g, cor = '#7a2f2f', rotulo = 'Saída') {
  ret(g, 430, 568, 140, 30, cor, 6);
  texto(g, rotulo, 500, 584, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
}

/* ─── A faixa do ninja ─── */

export const FAIXAS = [
  { nome: 'sem faixa', cor: '#c9bfa8' },
  { nome: 'faixa branca', cor: '#f4f1ea' },
  { nome: 'faixa amarela', cor: '#f2d04a' },
  { nome: 'faixa laranja', cor: '#ef8a2c' },
  { nome: 'faixa verde', cor: '#4caf50' },
  { nome: 'faixa azul', cor: '#3f7fd8' },
  { nome: 'faixa vermelha', cor: '#d8433a' },
  { nome: 'faixa roxa', cor: '#8d4fd0' },
  { nome: 'faixa marrom', cor: '#7a4a28' },
  { nome: 'faixa cinza', cor: '#8a8f96' },
  { nome: 'faixa preta', cor: '#1c1a1f' },
];
export const FAIXA_MAX = 10;
// A faixa que cada porta pede.
export const FAIXA_PARA = { fogo: 3, agua: 5, neve: 7, esconderijo: 10 };
export const NOME_ELEMENTO = { fogo: 'Fogo', agua: 'Água', neve: 'Neve' };
export const nomeDaFaixa = n => FAIXAS[Math.max(0, Math.min(FAIXA_MAX, Math.floor(Number(n) || 0)))].nome;
async function lerFaixa(ctx) {
  const v = await ctx.progresso.ler('ninja.faixa');
  return Math.max(0, Math.min(FAIXA_MAX, Math.floor(Number(v) || 0)));
}

// O que muda nas salas por causa dos cliques (o Sensei falando, as caixas abertas, o gongo...).
// Tudo com Date.now(), para o desenho saber há quanto tempo foi.
export const estado = { fala: null, faixa: null, caixas: {}, gongo: 0, caldeira: 0, tijolo: false, boneco: {}, cerejeira: 0 };
function falar(textoFala, ms = 7000) { estado.fala = { texto: textoFala, ate: Date.now() + ms }; }

/* ═══════════════ QG da Guarda Secreta do Coelho ═══════════════ */

const ILHA_CONTORNO = [130, 330, 170, 230, 280, 170, 400, 110, 560, 70, 720, 70, 860, 110, 950, 190, 960, 290, 900, 380, 800, 450, 660, 520, 500, 555, 330, 530, 200, 470, 120, 400];
function curvaFechada(g, pts, sx = 1, sy = 1, ox = 0, oy = 0) {
  const n = pts.length / 2;
  const P = i => [ox + pts[(i % n) * 2] * sx, oy + pts[(i % n) * 2 + 1] * sy];
  const [ax, ay] = P(0);
  const [bx, by] = P(1);
  g.beginPath();
  g.moveTo((ax + bx) / 2, (ay + by) / 2);
  for (let i = 1; i <= n; i++) {
    const [cx, cy] = P(i);
    const [dx, dy] = P(i + 1);
    g.quadraticCurveTo(cx, cy, (cx + dx) / 2, (cy + dy) / 2);
  }
  g.closePath();
}
// A tela grande do QG: (x0, y0) o canto, (sx, sy) a escala do mapa da ilha (1000 x 600).
const TELA_QG = { x: 284, y: 40, sx: 0.432, sy: 0.38 };

function monitor(g, x, y, w, h) {
  ret(g, x - 6, y - 6, w + 12, h + 12, '#2a3a52', 8);
  ret(g, x, y, w, h, '#061a2c', 3);
  for (const [dx, dy] of [[-2, -2], [w + 2, -2], [-2, h + 2], [w + 2, h + 2]]) el(g, x + dx, y + dy, 1.8, 1.8, '#7b93b8');
}

function fundoQg(g) {
  g.fillStyle = grad(g, 0, 0, 0, 405, [[0, '#0a1322'], [1, '#17283f']]);
  g.fillRect(0, 0, W, 405);
  for (let x = 0; x < W; x += 100) {
    ret(g, x + 3, 12, 94, 384, 'rgba(120,150,190,0.05)', 4);
    for (const y of [20, 384]) for (const dx of [12, 88]) el(g, x + dx, y, 2, 2, 'rgba(160,190,230,0.35)');
  }
  ret(g, 0, 0, W, 10, '#070d18');
  // Elevador secreto (para o Pet Shop)
  ret(g, 18, 200, 122, 205, '#2a3a52', 10);
  ret(g, 28, 214, 102, 188, '#0b1422', 6);
  ret(g, 30, 216, 49, 186, '#3c5272', 3);
  ret(g, 81, 216, 49, 186, '#3c5272', 3);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(36, 220, 6, 178); g.fillRect(87, 220, 6, 178);
  placa(g, 79, 184, 116, 24, 'Pet Shop', { fundo: '#13203a', borda: '#5fd4ff', cor: '#bff0ff', fonte: '700 13px "Cinzel", Georgia, serif' });
  // Monitores da esquerda: o radar e o Raposo (procurado)
  monitor(g, 152, 52, 112, 96);
  monitor(g, 152, 168, 112, 96);
  ret(g, 152, 168, 112, 96, '#3a0d12', 3);
  texto(g, 'PROCURADO', 208, 182, { cor: '#ffb0a0', fonte: '700 11px "Cinzel", Georgia, serif' });
  raposoRosto(g, 208, 226, 1);
  // A tela grande com o mapa da ilha
  ret(g, 272, 28, 456, 252, '#2a3a52', 12);
  ret(g, TELA_QG.x, TELA_QG.y, 432, 228, '#05233d', 4);
  g.save();
  g.beginPath(); g.rect(TELA_QG.x, TELA_QG.y, 432, 228); g.clip();
  curvaFechada(g, ILHA_CONTORNO, TELA_QG.sx, TELA_QG.sy, TELA_QG.x, TELA_QG.y);
  g.fillStyle = '#1f5a46'; g.fill();
  g.strokeStyle = '#5fd4ff'; g.lineWidth = 1.5; g.stroke();
  el(g, TELA_QG.x + 650 * TELA_QG.sx, TELA_QG.y + 150 * TELA_QG.sy, 230 * TELA_QG.sx, 80 * TELA_QG.sy, 'rgba(220,240,255,0.35)');
  g.strokeStyle = 'rgba(95,212,255,0.13)'; g.lineWidth = 1;
  for (let x = TELA_QG.x; x < TELA_QG.x + 432; x += 24) { g.beginPath(); g.moveTo(x, TELA_QG.y); g.lineTo(x, TELA_QG.y + 228); g.stroke(); }
  for (let y = TELA_QG.y; y < TELA_QG.y + 228; y += 24) { g.beginPath(); g.moveTo(TELA_QG.x, y); g.lineTo(TELA_QG.x + 432, y); g.stroke(); }
  g.restore();
  texto(g, 'MAPA DA ILHA', 500, 258, { cor: '#5fd4ff', fonte: '700 12px "Cinzel", Georgia, serif' });
  // O quadro da Missão do dia
  ret(g, 738, 48, 136, 244, '#5b3c22', 6);
  ret(g, 746, 56, 120, 228, '#c8995c', 3);
  const rnd = sorte(31);
  for (let k = 0; k < 120; k++) el(g, 748 + rnd() * 116, 58 + rnd() * 224, 1, 1, 'rgba(90,55,25,0.35)');
  ret(g, 758, 66, 96, 26, '#f6efdc', 2);
  texto(g, 'MISSÃO DO DIA', 806, 80, { cor: '#8a1f1f', fonte: '700 10px "Cinzel", Georgia, serif' });
  for (const [x, y, w, h, cor, rot] of [[760, 110, 44, 38, '#fff6c8', -0.08], [812, 104, 40, 52, '#e8f1ff', 0.06], [764, 168, 50, 34, '#ffe0e0', 0.05], [818, 176, 38, 46, '#f6efdc', -0.05], [770, 222, 70, 44, '#e9f7e4', 0.02]]) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
    ret(g, -w / 2, -h / 2, w, h, cor, 2);
    for (let k = 0; k < 3; k++) ret(g, -w / 2 + 5, -h / 2 + 9 + k * 8, w - 12 - (k % 2) * 8, 2, 'rgba(60,60,80,0.45)');
    g.restore();
  }
  linha(g, '#c0392b', 1.5, [782, 112, 832, 106, 788, 170, 836, 178, 804, 224]);
  for (const [x, y] of [[782, 112], [832, 106], [788, 170], [836, 178], [804, 224]]) el(g, x, y, 3.2, 3.2, '#d8433a');
  // A escotilha para a Caldeira
  ret(g, 884, 198, 106, 207, '#2a3a52', 10);
  el(g, 937, 304, 44, 84, '#3c5272');
  el(g, 937, 304, 36, 75, '#1c2a40');
  g.strokeStyle = '#8fa6c8'; g.lineWidth = 4;
  g.beginPath(); g.arc(937, 304, 18, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; linha(g, '#8fa6c8', 3, [937, 304, 937 + Math.cos(a) * 18, 304 + Math.sin(a) * 18]); }
  placa(g, 937, 184, 100, 24, 'Caldeira', { fundo: '#13203a', borda: '#ff9a5a', cor: '#ffd7b8', fonte: '700 13px "Cinzel", Georgia, serif' });
  // O console embaixo da tela grande
  forma(g, '#2c4060', [250, 300, 750, 300, 735, 284, 265, 284]);
  ret(g, 255, 300, 490, 100, '#1a2840', 6);
  ret(g, 255, 300, 490, 8, '#33496c');
  for (const x of [300, 420, 560, 660]) { ret(g, x, 288, 60, 10, '#0f1828', 2); for (let k = 0; k < 6; k++) ret(g, x + 3 + k * 9.5, 290, 7, 5, '#3c5272', 1); }
  texto(g, 'GUARDA SECRETA DO COELHO', 500, 360, { cor: '#bff0ff', fonte: '700 18px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
  // O emblema: a cabeça de coelho num escudo
  forma(g, '#5fd4ff', [500, 316, 520, 322, 518, 340, 500, 348, 482, 340, 480, 322]);
  el(g, 500, 334, 7, 6, '#13203a'); el(g, 496, 324, 2, 6, '#13203a', -0.2); el(g, 504, 324, 2, 6, '#13203a', 0.2);
  // Chão de metal com linhas que brilham
  g.fillStyle = grad(g, 0, 405, 0, H, [[0, '#18233a'], [1, '#26354f']]);
  g.fillRect(0, 405, W, H - 405);
  g.strokeStyle = 'rgba(95,212,255,0.12)'; g.lineWidth = 1.5;
  for (let k = -12; k <= 12; k++) { g.beginPath(); g.moveTo(500 + k * 40, 405); g.lineTo(500 + k * 130, H); g.stroke(); }
  for (let k = 0; k < 7; k++) { const y = 405 + (H - 405) * ((k / 7) ** 1.4); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  ret(g, 0, 401, W, 4, 'rgba(95,212,255,0.55)');
}
// O rosto do Raposo (o vilão), para o cartaz de procurado.
function raposoRosto(g, x, y, k = 1) {
  for (const d of [-1, 1]) { forma(g, '#d9692a', [x + d * 8 * k, y - 10 * k, x + d * 22 * k, y - 32 * k, x + d * 24 * k, y - 4 * k]); forma(g, '#3a1a10', [x + d * 12 * k, y - 12 * k, x + d * 20 * k, y - 26 * k, x + d * 20 * k, y - 8 * k]); }
  forma(g, '#e0782e', [x - 26 * k, y - 8 * k, x + 26 * k, y - 8 * k, x, y + 26 * k]);
  forma(g, '#f6efdc', [x - 20 * k, y + 2 * k, x - 2 * k, y + 2 * k, x, y + 24 * k]);
  forma(g, '#f6efdc', [x + 20 * k, y + 2 * k, x + 2 * k, y + 2 * k, x, y + 24 * k]);
  el(g, x, y + 23 * k, 3.5 * k, 2.8 * k, '#1b1403');
  for (const d of [-1, 1]) { el(g, x + d * 9 * k, y - 1 * k, 3 * k, 2.2 * k, '#ffe46b', d * 0.3); el(g, x + d * 9 * k, y - 1 * k, 1 * k, 2 * k, '#1b1403'); }
  linha(g, '#3a1a10', 1.5 * k, [x - 14 * k, y - 7 * k, x - 4 * k, y - 4 * k]);
  linha(g, '#3a1a10', 1.5 * k, [x + 14 * k, y - 7 * k, x + 4 * k, y - 4 * k]);
}

function animarQg(g, t) {
  // O radar
  const cx = 208;
  const cy = 100;
  g.save();
  g.beginPath(); g.rect(152, 52, 112, 96); g.clip();
  g.strokeStyle = 'rgba(95,255,160,0.35)'; g.lineWidth = 1;
  for (const r of [14, 28, 42]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  linha(g, 'rgba(95,255,160,0.25)', 1, [cx - 46, cy, cx + 46, cy]);
  linha(g, 'rgba(95,255,160,0.25)', 1, [cx, cy - 46, cx, cy + 46]);
  const a = t * 2;
  g.fillStyle = 'rgba(95,255,160,0.25)';
  g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 46, a - 0.6, a); g.closePath(); g.fill();
  linha(g, '#7dffb0', 2, [cx, cy, cx + Math.cos(a) * 46, cy + Math.sin(a) * 46]);
  for (const [ang, d] of [[0.8, 30], [2.6, 18], [4.4, 38], [5.6, 24]]) {
    const dif = ((a - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (dif < 2.4) el(g, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 3, 3, `rgba(125,255,176,${1 - dif / 2.4})`);
  }
  g.restore();
  // O monitor do Raposo pisca com chiado de vez em quando
  if ((t % 7) < 0.25) {
    const rnd = sorte(Math.floor(t * 30));
    for (let k = 0; k < 40; k++) ret(g, 152 + rnd() * 108, 168 + rnd() * 92, 4 + rnd() * 10, 2, `rgba(255,255,255,${0.2 + rnd() * 0.4})`);
  }
  // As salas da ilha na tela grande (as que estão no mapa) piscam; uma de cada vez ganha o nome
  const lista = Object.entries(INFO_SALAS).filter(([, i]) => i && i.mapa);
  const destaque = lista.length ? Math.floor(t / 2.5) % lista.length : -1;
  g.save();
  g.beginPath(); g.rect(TELA_QG.x, TELA_QG.y, 432, 228); g.clip();
  lista.forEach(([, i], k) => {
    const x = TELA_QG.x + i.mapa.x * TELA_QG.sx;
    const y = TELA_QG.y + i.mapa.y * TELA_QG.sy;
    const f = (t * 0.8 + k * 0.37) % 1;
    g.strokeStyle = `rgba(95,212,255,${0.8 * (1 - f)})`; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, 3 + f * 10, 0, Math.PI * 2); g.stroke();
    el(g, x, y, 3, 3, k === destaque ? '#ffe46b' : '#bff0ff');
  });
  if (destaque >= 0) {
    const [, i] = lista[destaque];
    const x = TELA_QG.x + i.mapa.x * TELA_QG.sx;
    const y = TELA_QG.y + i.mapa.y * TELA_QG.sy;
    g.font = '700 11px "Cinzel", Georgia, serif';
    const w = g.measureText(i.nome).width + 12;
    const bx = Math.min(TELA_QG.x + 432 - w - 4, Math.max(TELA_QG.x + 4, x - w / 2));
    ret(g, bx, y - 26, w, 16, 'rgba(5,35,61,0.85)', 4);
    texto(g, i.nome, bx + w / 2, y - 18, { cor: '#ffe46b', fonte: '700 11px "Cinzel", Georgia, serif' });
  }
  const varre = TELA_QG.y + ((t * 60) % 228);
  ret(g, TELA_QG.x, varre, 432, 3, 'rgba(95,212,255,0.12)');
  g.restore();
  // Os botões do console piscando
  for (let k = 0; k < 28; k++) {
    const x = 270 + k * 17;
    if (x > 462 && x < 530) continue;
    const aceso = Math.sin(t * (1 + (k % 5) * 0.7) + k * 1.7) > 0.2;
    ret(g, x, 316 + (k % 2) * 8, 9, 5, aceso ? ['#5fd4ff', '#7dffb0', '#ffe46b', '#ff7a7a'][k % 4] : '#24344c', 1);
  }
  // A luz do elevador e o alerta do quadro de missões
  el(g, 79, 207, 4, 4, Math.sin(t * 3) > 0 ? '#7dffb0' : '#24443a');
  const pulso = 0.5 + Math.sin(t * 4) * 0.5;
  brilho(g, 862, 58, 26, 'rgba(255,80,80,A)', 0.5 * pulso);
  el(g, 862, 58, 7, 7, `rgba(255,${90 + pulso * 80},90,1)`);
  texto(g, '!', 862, 58, { cor: '#fff', fonte: '700 10px sans-serif' });
}

function vitrineGadgets(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 62, 12);
  if (sp(g, 'vitrine-gadgets', 'parado', x, y, { t })) return;
  vitrineGadgetsCorpo(g, x, y, t);
}
function vitrineGadgetsCorpo(g, x, y, t) {
  ret(g, x - 58, y - 30, 116, 30, '#24344c', 4);
  ret(g, x - 54, y - 92, 108, 62, 'rgba(160,220,255,0.18)', 4);
  contorno(g, x - 54, y - 92, 108, 62, '#7b93b8', 2, 4);
  // Óculos de visão noturna, a lupa e o rádio-cenoura
  ret(g, x - 46, y - 52, 26, 12, '#1b2a20', 3);
  el(g, x - 41, y - 46, 5, 5, '#3cff8a'); el(g, x - 25, y - 46, 5, 5, '#3cff8a');
  g.strokeStyle = '#c9a06a'; g.lineWidth = 3;
  g.beginPath(); g.arc(x - 2, y - 58, 9, 0, Math.PI * 2); g.stroke();
  linha(g, '#5b3c22', 4, [x + 4, y - 51, x + 12, y - 40]);
  forma(g, '#e07a2a', [x + 22, y - 72, x + 36, y - 72, x + 29, y - 36]);
  el(g, x + 29, y - 74, 3, 7, '#4f8a3c');
  linha(g, '#bfc8d4', 1.5, [x + 34, y - 70, x + 42, y - 86]);
  el(g, x + 42, y - 86, 2, 2, Math.sin(t * 5) > 0 ? '#ff5a5a' : '#5a2020');
  ret(g, x - 50, y - 26, 100, 10, '#13203a', 2);
  texto(g, 'EQUIPAMENTOS', x, y - 21, { cor: '#bff0ff', fonte: '700 8px "Cinzel", Georgia, serif' });
  ret(g, x - 52, y - 90, 14, 56, 'rgba(255,255,255,0.08)', 3);
}
function mesaTelefone(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 44, 10);
  if (!sp(g, 'telefone-espiao', 'brilhando', x, y, { t })) telefoneCorpo(g, x, y, t);
  brilho(g, x, y - 66, 46, 'rgba(95,212,255,A)', 0.22 + Math.sin(t * 3) * 0.08);
}
function telefoneCorpo(g, x, y, t) {
  ret(g, x - 6, y - 44, 12, 44, '#33496c');
  el(g, x, y - 2, 26, 6, '#24344c');
  el(g, x, y - 46, 34, 9, '#2c4060');
  // O telefone: um aparelho fininho com a antena e a tela azul
  g.save(); g.translate(x, y - 66); g.rotate(-0.12);
  ret(g, -13, -22, 26, 42, '#0f1828', 6);
  ret(g, -10, -18, 20, 26, '#5fd4ff', 3);
  for (let k = 0; k < 3; k++) ret(g, -7, -14 + k * 7, 14 - k * 3, 3, 'rgba(5,35,61,0.6)', 1);
  el(g, 0, 14, 3.5, 3.5, '#33496c');
  linha(g, '#bfc8d4', 2, [8, -22, 12, -36]);
  el(g, 12, -36, 2.5, 2.5, Math.sin(t * 6) > 0 ? '#ff5a5a' : '#5a2020');
  g.restore();
}

/* ═══════════════ Sala da Caldeira ═══════════════ */

function cano(g, x0, y0, x1, y1, r, cor = '#6b5a4a', claro = 'rgba(255,240,220,0.25)') {
  g.lineCap = 'butt';
  g.strokeStyle = cor; g.lineWidth = r * 2;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
  g.strokeStyle = claro; g.lineWidth = r * 0.5;
  g.beginPath();
  if (vertical) { g.moveTo(x0 - r * 0.4, y0); g.lineTo(x1 - r * 0.4, y1); } else { g.moveTo(x0, y0 - r * 0.4); g.lineTo(x1, y1 - r * 0.4); }
  g.stroke();
}
function flange(g, x, y, r, vertical = false, cor = '#4f4236') {
  if (vertical) ret(g, x - r * 1.35, y - 4, r * 2.7, 8, cor, 2); else ret(g, x - 4, y - r * 1.35, 8, r * 2.7, cor, 2);
}
function manometro(g, x, y, r) {
  el(g, x, y, r + 4, r + 4, '#8a6a3a');
  el(g, x, y, r, r, '#f4ecd8');
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * 0.75 + (k / 8) * Math.PI * 1.5;
    linha(g, k > 6 ? '#c0392b' : '#3a2a1a', 1.2, [x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9]);
  }
}

function fundoCaldeira(g) {
  g.fillStyle = '#24160f';
  g.fillRect(0, 0, W, 405);
  const rnd = sorte(21);
  for (let y = 0, fila = 0; y < 405; y += 24, fila++) {
    for (let x = (fila % 2) * -28; x < W; x += 56) ret(g, x + 1.5, y + 1.5, 53, 21, ['#4a2c22', '#553226', '#43281f', '#5c3829'][Math.floor(rnd() * 4)], 2);
  }
  // O tijolo solto (um pouquinho para fora e mais claro)
  ret(g, 684, 146, 40, 20, '#6e4634', 2);
  linha(g, 'rgba(0,0,0,0.45)', 1.5, [684, 166, 724, 166, 724, 146]);
  g.fillStyle = grad(g, 0, 0, 0, 405, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.15)'], [1, 'rgba(0,0,0,0.3)']]);
  g.fillRect(0, 0, W, 405);
  // Canos do teto
  cano(g, 0, 28, W, 28, 11);
  cano(g, 0, 62, 360, 62, 8, '#5a6a72');
  cano(g, 640, 62, W, 62, 8, '#5a6a72');
  for (const x of [120, 300, 700, 880]) flange(g, x, 28, 11);
  cano(g, 360, 62, 360, 200, 8, '#5a6a72');
  cano(g, 640, 62, 640, 200, 8, '#5a6a72');
  flange(g, 360, 120, 8, true); flange(g, 640, 120, 8, true);
  // Válvulas vermelhas
  for (const [x, y] of [[360, 160], [640, 160]]) {
    g.strokeStyle = '#c0392b'; g.lineWidth = 4;
    g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke();
    linha(g, '#c0392b', 3, [x - 12, y, x + 12, y]);
    linha(g, '#c0392b', 3, [x, y - 12, x, y + 12]);
    el(g, x, y, 4, 4, '#8a2a20');
  }
  // A escada para o Salão de Dança (com a luz roxa lá em cima)
  ret(g, 30, 130, 132, 120, '#120a1e', 4);
  g.fillStyle = grad(g, 0, 130, 0, 250, [[0, '#7a4ad0'], [1, 'rgba(60,30,110,0.2)']]);
  g.fillRect(34, 134, 124, 116);
  for (let k = 0; k < 9; k++) {
    const y = 398 - k * 27;
    const w = 150 - k * 6;
    const x = 22 + k * 3;
    ret(g, x, y - 27, w, 27, k % 2 ? '#4a3426' : '#56402f');
    ret(g, x, y - 27, w, 5, '#7a5a3e');
  }
  linha(g, '#3a2a1a', 4, [176, 405, 170, 140]);
  placa(g, 96, 112, 134, 26, 'Salão de Dança', { fundo: '#2a1d42', borda: '#ff7ad9', cor: '#ffd0f0', fonte: '700 13px "Cinzel", Georgia, serif' });
  // O túnel de cano para a Piscina
  el(g, 922, 322, 70, 90, '#3a4a55');
  el(g, 922, 322, 60, 80, '#556872');
  el(g, 922, 324, 50, 70, '#091820');
  g.fillStyle = grad(g, 872, 254, 972, 394, [[0, 'rgba(70,170,210,0.05)'], [1, 'rgba(70,170,210,0.35)']]);
  g.beginPath(); g.ellipse(922, 324, 50, 70, 0, 0, Math.PI * 2); g.fill();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; el(g, 922 + Math.cos(a) * 65, 322 + Math.sin(a) * 85, 3, 3, '#7b8a92'); }
  for (let k = 0; k < 5; k++) ret(g, 900, 290 + k * 22, 44, 4, '#7b8a92', 2);
  placa(g, 922, 214, 104, 26, 'Piscina', { fundo: '#13303a', borda: '#5fd4ff', cor: '#cff4ff', fonte: '700 13px "Cinzel", Georgia, serif' });
  // A grade do duto (o caminho secreto para o QG)
  ret(g, 712, 322, 118, 82, '#5a6068', 4);
  ret(g, 718, 328, 106, 70, '#141414', 2);
  for (let k = 0; k < 7; k++) ret(g, 720, 332 + k * 9.5, 102, 5, '#7a8088', 2);
  for (const [x, y] of [[716, 326], [826, 326], [716, 400], [826, 400]]) el(g, x, y, 2.5, 2.5, '#a8b0ba');
  // Uma cenourinha riscada no canto da grade: a marca da Guarda
  forma(g, 'rgba(224,122,42,0.75)', [812, 388, 820, 388, 816, 398]);
  // A caldeira
  ret(g, 488, 0, 24, 70, '#4a3a2e');
  g.fillStyle = grad(g, 380, 0, 620, 0, [[0, '#5a2e16'], [0.35, '#b4693a'], [0.55, '#c97a46'], [1, '#5f3018']]);
  g.beginPath();
  if (g.roundRect) g.roundRect(380, 96, 240, 300, 28); else g.rect(380, 96, 240, 300);
  g.fill();
  g.fillStyle = grad(g, 380, 0, 620, 0, [[0, '#6b3a1e'], [0.4, '#c98250'], [1, '#6b3a1e']]);
  g.beginPath(); g.ellipse(500, 98, 120, 38, 0, Math.PI, 0); g.fill();
  for (const y of [150, 250, 340]) {
    ret(g, 378, y - 7, 244, 14, '#4a2412', 4);
    for (let x = 392; x < 615; x += 22) el(g, x, y, 2.6, 2.6, '#d9a070');
  }
  // A porta da fornalha
  ret(g, 445, 286, 110, 96, '#2a1a12', 10);
  ret(g, 452, 293, 96, 82, '#140a06', 8);
  for (let k = 0; k < 6; k++) ret(g, 458 + k * 15, 300, 6, 68, '#3a2418', 2);
  ret(g, 540, 326, 22, 8, '#8a6a3a', 3);
  // Os manômetros
  for (const [x, y, r] of [[430, 196, 20], [500, 186, 24], [570, 196, 20]]) manometro(g, x, y, r);
  placa(g, 500, 230, 120, 20, 'PRESSÃO', { fundo: '#3a2418', borda: '#8a6a3a', cor: '#f4ecd8', fonte: '700 10px "Cinzel", Georgia, serif' });
  // O carvão no pé da caldeira
  for (let k = 0; k < 26; k++) { const a = sorte(5 + k)(); el(g, 330 + (k % 9) * 7 - (k > 17 ? -12 : 0), 398 - Math.floor(k / 9) * 8 - a * 3, 6, 5, k % 3 ? '#1a1a1e' : '#2a2a30'); }
  // O chão de cimento com o ralo
  chaoLajes(g, 405, H, ['#4a4440', '#3f3a36', '#524b46', '#45403c'], '#2a2622', 23);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, 405, W, 8);
  el(g, 560, 500, 26, 8, '#1a1714');
  for (let k = -2; k <= 2; k++) linha(g, '#5a524a', 2, [560 + k * 8, 494, 560 + k * 8, 506]);
}
function animarCaldeira(g, t) {
  const agora = Date.now();
  const aticada = Math.max(0, 1 - (agora - estado.caldeira) / 5000);
  // O fogo da fornalha
  const pisca = 0.55 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05 + aticada * 0.4;
  g.save();
  g.beginPath(); g.rect(452, 293, 96, 82); g.clip();
  for (let k = 0; k < 7; k++) chama(g, 462 + k * 13, 368 - Math.sin(t * 6 + k) * 4, 14 + Math.sin(t * 9 + k * 2) * 4 + aticada * 10, k % 2 ? '#f5892a' : '#d9381a', Math.sin(t * 8 + k) * 3);
  for (let k = 0; k < 6; k++) ret(g, 458 + k * 15, 300, 6, 68, '#3a2418', 2);
  g.restore();
  brilho(g, 500, 340, 160, 'rgba(255,140,60,A)', 0.3 * pisca);
  brilho(g, 500, 450, 220, 'rgba(255,120,40,A)', 0.12 * pisca);
  // Os ponteiros
  for (const [x, y, r, k] of [[430, 196, 20, 0], [500, 186, 24, 1], [570, 196, 20, 2]]) {
    const v = 0.35 + Math.sin(t * (0.7 + k * 0.4) + k) * 0.15 + aticada * 0.5 + (aticada > 0 ? Math.sin(t * 40) * 0.03 : 0);
    const a = Math.PI * 0.75 + Math.min(1, v) * Math.PI * 1.5;
    linha(g, '#c0392b', 2, [x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8]);
    el(g, x, y, 2.5, 2.5, '#3a2a1a');
  }
  // O vapor das válvulas (e um vaporzão quando atiçam a caldeira)
  for (const [vx, vy, fase] of [[360, 148, 0], [640, 148, 1.7], [500, 60, 0.9]]) {
    for (let k = 0; k < 4; k++) {
      const f = ((t * 0.4 + fase + k / 4) % 1);
      const forte = 1 + aticada * 2;
      el(g, vx + Math.sin(f * 5 + k) * 12 * forte, vy - f * 70 * forte, (6 + f * 18) * forte, (5 + f * 14) * forte, `rgba(230,230,235,${0.32 * (1 - f)})`);
    }
  }
  // Gotas pingando na boca do túnel
  for (let k = 0; k < 3; k++) {
    const f = ((t * 0.7 + k * 0.33) % 1);
    const x = 890 + k * 26;
    if (f < 0.8) el(g, x, 250 + f * 140, 2, 3.5, 'rgba(140,210,240,0.8)');
    else el(g, x, 392, 6 * (f - 0.8) * 5, 1.5, 'rgba(140,210,240,0.5)');
  }
  // A música abafada do Salão, lá em cima
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.3 + k / 3) % 1;
    texto(g, k % 2 ? '♪' : '♫', 60 + k * 36 + Math.sin(f * 6) * 8, 150 + f * 90, { cor: `rgba(255,150,230,${0.6 * (1 - f)})`, fonte: '700 18px serif' });
  }
  // O tijolo solto brilha de vez em quando (até alguém achar o bilhete)
  if (!estado.tijolo && (t % 6) < 0.6) {
    const f = (t % 6) / 0.6;
    const a = Math.sin(f * Math.PI);
    linha(g, `rgba(255,240,180,${a})`, 2, [718, 150 - 6 * a, 718, 150 + 6 * a]);
    linha(g, `rgba(255,240,180,${a})`, 2, [712 - 6 * a, 150, 724 + 6 * a, 150]);
  }
  if (estado.tijolo) ret(g, 690, 148, 30, 16, '#0d0806', 2);
}
function caixaJornais(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 48, 10);
  if (!sp(g, 'jornais', 'parado', x, y, { t })) jornaisCorpo(g, x, y);
}
function jornaisCorpo(g, x, y) {
  ret(g, x - 44, y - 44, 88, 44, '#7a5434', 3);
  for (let k = 0; k < 3; k++) ret(g, x - 44, y - 40 + k * 14, 88, 2, 'rgba(40,20,5,0.4)');
  linha(g, '#5b3c22', 3, [x - 44, y - 44, x + 44, y]);
  for (let k = 0; k < 5; k++) {
    g.save(); g.translate(x + (k % 2 ? 3 : -3), y - 48 - k * 5); g.rotate((k % 3 - 1) * 0.05);
    ret(g, -38, -4, 76, 6, k % 2 ? '#e8dcb8' : '#ddd0a8', 1);
    g.restore();
  }
  g.save(); g.translate(x, y - 76); g.rotate(-0.06);
  ret(g, -40, -14, 80, 26, '#f0e4c0', 2);
  ret(g, -34, -10, 68, 5, '#3a2a1a', 1);
  for (let k = 0; k < 2; k++) ret(g, -34, -1 + k * 6, 44, 2, 'rgba(58,42,26,0.6)');
  ret(g, 14, -1, 20, 10, 'rgba(58,42,26,0.35)');
  g.restore();
}
function baldeCarvao(g, x, y) {
  sombraNoChao(g, x, y + 2, 24, 7);
  forma(g, '#5a6068', [x - 20, y - 30, x + 20, y - 30, x + 15, y, x - 15, y]);
  el(g, x, y - 30, 20, 6, '#3a3e44');
  for (let k = 0; k < 5; k++) el(g, x - 12 + k * 6, y - 33 - (k % 2) * 3, 5, 4, '#1a1a1e');
  linha(g, '#8a6a3a', 3, [x + 16, y - 50, x + 4, y - 20]);
  forma(g, '#7a8088', [x - 4, y - 24, x + 10, y - 24, x + 8, y - 12, x - 2, y - 12]);
}

/* ═══════════════ Pátio do Dojo ═══════════════ */

function telhado(g, cx, yBase, largura, altura, curva, cor = '#3b3f4f') {
  const x0 = cx - largura / 2;
  const x1 = cx + largura / 2;
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x0 - 20, yBase - curva);
  g.quadraticCurveTo(x0 + largura * 0.12, yBase + 4, x0 + largura * 0.25, yBase);
  g.lineTo(x1 - largura * 0.25, yBase);
  g.quadraticCurveTo(x1 - largura * 0.12, yBase + 4, x1 + 20, yBase - curva);
  g.lineTo(cx + largura * 0.3, yBase - altura);
  g.lineTo(cx - largura * 0.3, yBase - altura);
  g.closePath();
  g.fill();
  // A neve em cima
  g.fillStyle = '#f4f8ff';
  g.beginPath();
  g.moveTo(cx - largura * 0.31, yBase - altura - 2);
  g.lineTo(cx + largura * 0.31, yBase - altura - 2);
  g.quadraticCurveTo(cx + largura * 0.36, yBase - altura * 0.6, cx + largura * 0.33, yBase - altura * 0.55);
  g.quadraticCurveTo(cx, yBase - altura * 0.72, cx - largura * 0.33, yBase - altura * 0.55);
  g.quadraticCurveTo(cx - largura * 0.36, yBase - altura * 0.6, cx - largura * 0.31, yBase - altura - 2);
  g.fill();
  // As telhas
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
  for (let k = 1; k < 14; k++) { const x = x0 + (largura / 14) * k; g.beginPath(); g.moveTo(cx + (x - cx) * 0.6, yBase - altura * 0.55); g.lineTo(x, yBase); g.stroke(); }
  ret(g, x0 + largura * 0.22, yBase - 2, largura * 0.56, 6, '#24272f');
}
function fundoPatio(g) {
  g.fillStyle = grad(g, 0, 0, 0, 330, [[0, '#26335e'], [0.45, '#7a6aa8'], [0.8, '#e9b3c3'], [1, '#f8d9d2']]);
  g.fillRect(0, 0, W, 330);
  const rnd = sorte(41);
  for (let k = 0; k < 40; k++) el(g, rnd() * W, rnd() * 140, 1.1, 1.1, `rgba(255,255,255,${0.3 + rnd() * 0.5})`);
  brilho(g, 830, 82, 70, 'rgba(255,250,230,A)', 0.4);
  el(g, 830, 82, 26, 26, '#fbf6e6');
  el(g, 822, 76, 5, 4, 'rgba(200,190,170,0.4)');
  // Montanhas ao longe
  for (const [pts, cor] of [
    [[0, 300, 120, 170, 230, 240, 360, 130, 480, 250, 560, 200, 680, 280, 0, 300], '#8a8fb8'],
    [[480, 300, 640, 150, 760, 230, 880, 120, 1000, 220, 1000, 300], '#7d82ad'],
  ]) forma(g, cor, pts);
  for (const [x, y] of [[120, 170], [360, 130], [640, 150], [880, 120]]) forma(g, '#f4f6ff', [x, y, x - 34, y + 38, x - 12, y + 30, x, y + 40, x + 14, y + 30, x + 36, y + 40]);
  // O muro do jardim (com telhadinho e neve)
  for (const [a, b] of [[0, 300], [700, W]]) {
    ret(g, a, 262, b - a, 70, '#efe6d6');
    for (let x = a; x < b; x += 60) ret(g, x, 262, 4, 70, '#a8322a');
    ret(g, a, 250, b - a, 14, '#3b3f4f');
    ret(g, a, 246, b - a, 6, '#f4f8ff', 3);
  }
  // O dojo
  ret(g, 296, 330, 408, 54, '#8d8a86', 4);
  for (let k = 0; k < 10; k++) ret(g, 300 + k * 40, 334, 38, 22, k % 2 ? '#9a9792' : '#a5a29c', 2);
  for (let k = 0; k < 3; k++) ret(g, 438 - k * 8, 372 + k * 8, 124 + k * 16, 9, ['#b0ada8', '#a5a29c', '#9a9792'][k], 2);
  ret(g, 320, 214, 360, 120, '#f1e8d6');
  for (const x of [320, 398, 602, 672]) ret(g, x, 210, 10, 124, '#a8322a');
  for (const x0 of [332, 614]) {
    ret(g, x0, 236, 54, 80, '#f8f2e2', 2);
    g.strokeStyle = '#6b4a2b'; g.lineWidth = 2;
    g.strokeRect(x0, 236, 54, 80);
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x0 + k * 18, 236); g.lineTo(x0 + k * 18, 316); g.stroke(); }
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0, 236 + k * 20); g.lineTo(x0 + 54, 236 + k * 20); g.stroke(); }
  }
  // A porta grande
  ret(g, 430, 226, 140, 108, '#5b3420', 3);
  ret(g, 436, 232, 62, 102, '#f4ead2', 2);
  ret(g, 502, 232, 62, 102, '#f4ead2', 2);
  g.strokeStyle = '#6b4a2b'; g.lineWidth = 2;
  for (const x0 of [436, 502]) {
    g.strokeRect(x0, 232, 62, 102);
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x0 + k * 20.6, 232); g.lineTo(x0 + k * 20.6, 334); g.stroke(); }
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x0, 232 + k * 20.4); g.lineTo(x0 + 62, 232 + k * 20.4); g.stroke(); }
  }
  telhado(g, 500, 222, 470, 70, 18);
  ret(g, 382, 128, 236, 30, '#f1e8d6');
  for (const x of [382, 608]) ret(g, x, 126, 10, 34, '#a8322a');
  telhado(g, 500, 132, 310, 60, 16);
  placa(g, 500, 172, 110, 30, 'DOJO', { fundo: '#2a1a12', borda: '#b8922a', cor: '#e8c24a', fonte: '700 18px "Cinzel", Georgia, serif' });
  // O chão de neve
  g.fillStyle = grad(g, 0, 330, 0, H, [[0, '#dfe8f6'], [1, '#f6f9ff']]);
  g.fillRect(0, 384, W, H - 384);
  g.fillRect(0, 330, 296, 60); g.fillRect(704, 330, 296, 60);
  for (let k = 0; k < 14; k++) el(g, rnd() * W, 400 + rnd() * 190, 60 + rnd() * 80, 10 + rnd() * 10, 'rgba(180,200,230,0.22)');
  // O laguinho congelado
  el(g, 800, 500, 120, 38, '#9fb4cc');
  el(g, 800, 497, 112, 33, '#c8e2f4');
  for (const [x, w] of [[760, 40], [810, 60], [850, 30]]) ret(g, x, 488 + (x % 3) * 6, w, 2.5, 'rgba(255,255,255,0.7)', 1);
  for (const [x, y, r] of [[690, 510, 14], [912, 492, 12], [884, 530, 10]]) { el(g, x, y, r, r * 0.7, '#8d8a86'); el(g, x - 2, y - r * 0.4, r * 0.8, r * 0.35, '#f4f8ff'); }
  // O caminho de pedras: da porta até embaixo e até a saída da esquerda
  for (let k = 0; k < 7; k++) el(g, 500 + (k % 2 ? 12 : -12), 410 + k * 28, 30 + k * 2, 9 + k, '#a5a29c');
  for (let k = 0; k < 6; k++) el(g, 430 - k * 70, 470 + Math.sin(k) * 8, 26, 9, '#a5a29c');
  // A placa da Vila de Esqui
  ret(g, 84, 412, 6, 70, '#6b4a2b');
  forma(g, '#8a6a44', [34, 420, 120, 420, 120, 448, 34, 448, 22, 434]);
  texto(g, 'Vila de Esqui', 76, 434, { fonte: '700 11px "Cinzel", Georgia, serif' });
  ret(g, 34, 416, 86, 5, '#f4f8ff', 2);
}
function lanternaPedra(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 26, 8);
  if (!sp(g, 'lanterna-pedra', 'acesa', x, y, { t })) lanternaPedraCorpo(g, x, y);
  brilho(g, x, y - 70, 50, 'rgba(255,200,120,A)', 0.3 + Math.sin(t * 5 + x) * 0.06);
}
function lanternaPedraCorpo(g, x, y) {
  ret(g, x - 20, y - 12, 40, 12, '#8d8a86', 3);
  ret(g, x - 7, y - 50, 14, 40, '#9a9792', 2);
  ret(g, x - 18, y - 58, 36, 9, '#8d8a86', 2);
  ret(g, x - 14, y - 84, 28, 27, '#9a9792', 2);
  ret(g, x - 8, y - 78, 16, 15, '#ffd98a', 2);
  forma(g, '#7d7a76', [x - 26, y - 84, x + 26, y - 84, x + 12, y - 98, x - 12, y - 98]);
  forma(g, '#f4f8ff', [x - 22, y - 88, x + 22, y - 88, x + 11, y - 99, x - 11, y - 99]);
  el(g, x, y - 102, 5, 5, '#8d8a86');
  el(g, x, y - 105, 4, 2.5, '#f4f8ff');
}
function cerejeira(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 90, 16);
  if (!sp(g, 'cerejeira', 'parado', x, y, { t })) cerejeiraCorpo(g, x, y);
}
function cerejeiraCorpo(g, x, y) {
  g.lineCap = 'round';
  linha(g, '#3e2a24', 16, [x, y, x - 4, y - 70, x + 6, y - 120]);
  linha(g, '#3e2a24', 9, [x - 4, y - 74, x - 60, y - 130]);
  linha(g, '#3e2a24', 8, [x + 4, y - 100, x + 70, y - 150]);
  linha(g, '#3e2a24', 6, [x + 6, y - 120, x - 10, y - 180]);
  linha(g, '#3e2a24', 5, [x - 60, y - 130, x - 96, y - 140]);
  const rnd = sorte(55);
  for (const [cx, cy, r] of [[x - 70, y - 150, 44], [x + 70, y - 165, 46], [x - 6, y - 196, 50], [x + 24, y - 140, 36], [x - 100, y - 140, 28]]) {
    for (let k = 0; k < 16; k++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * r;
      el(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 9 + rnd() * 9, 8 + rnd() * 7, ['#f6b6cf', '#f29bbd', '#fbd3e2', '#ee8fb3'][Math.floor(rnd() * 4)]);
    }
    el(g, cx - r * 0.2, cy - r * 0.45, r * 0.6, r * 0.18, 'rgba(255,255,255,0.85)');
  }
}
function bonecoDeNeve(g, x, y) {
  sombraNoChao(g, x, y + 2, 24, 7);
  el(g, x, y - 18, 22, 19, '#f6f9ff');
  el(g, x, y - 46, 16, 14, '#ffffff');
  for (const d of [-1, 1]) { el(g, x + d * 6, y - 70, 4.5, 12, '#ffffff', d * 0.2); el(g, x + d * 6, y - 69, 2, 8, '#f4c0c8', d * 0.2); }
  el(g, x - 5, y - 49, 1.8, 1.8, '#1b1403'); el(g, x + 5, y - 49, 1.8, 1.8, '#1b1403');
  forma(g, '#e07a2a', [x - 2, y - 44, x + 2, y - 44, x, y - 38]);
  ret(g, x - 16, y - 34, 32, 6, '#d8433a', 3);
  ret(g, x + 8, y - 34, 6, 16, '#d8433a', 2);
}
function animarPatio(g, t) {
  // As lanternas de papel penduradas na beira do telhado
  for (const [x, fase] of [[300, 0], [700, 1.4]]) {
    const ang = Math.sin(t * 1.4 + fase) * 0.12;
    g.save(); g.translate(x, 214); g.rotate(ang);
    linha(g, '#2a2a2a', 1.5, [0, 0, 0, 14]);
    el(g, 0, 30, 13, 17, '#d8433a');
    ret(g, -9, 12, 18, 4, '#2a1a12'); ret(g, -9, 44, 18, 4, '#2a1a12');
    for (const k of [-6, 0, 6]) linha(g, 'rgba(0,0,0,0.25)', 1, [k, 14, k * 1.2, 46]);
    g.restore();
    brilho(g, x, 244, 50, 'rgba(255,110,80,A)', 0.25 + Math.sin(t * 4 + fase) * 0.05);
  }
  brilho(g, 500, 290, 90, 'rgba(255,220,150,A)', 0.18);
  // Pétalas da cerejeira e a neve caindo
  particulas(g, 18, t, { semente: 7, vel: 22, vento: 40, x0: 60, x1: 420, y0: 230, y1: 560, cor: k => ['#f6b6cf', '#f29bbd', '#fbd3e2'][k % 3], r: 3.2 });
  particulas(g, 70, t, { semente: 3, vel: 34, vento: 16, cor: 'rgba(255,255,255,0.85)', r: 2.2 });
  // A luz do laguinho
  ret(g, 760 + Math.sin(t * 0.7) * 30, 506, 30, 2, 'rgba(255,255,255,0.6)', 1);
  // A pétala que cai no nariz de quem mexe na cerejeira
  const f = (Date.now() - estado.cerejeira) / 3000;
  if (f >= 0 && f < 1) particulas(g, 30, t, { semente: 9, vel: 90, vento: 30, x0: 80, x1: 300, y0: 200, y1: 450, cor: '#f6b6cf', r: 3.5, alfa: 1 - f });
}

/* ═══════════════ Dojo ═══════════════ */

function tatame(g, y0, y1) {
  g.fillStyle = '#5b4228';
  g.fillRect(0, y0, W, y1 - y0);
  let y = y0;
  let fila = 0;
  while (y < y1) {
    const h = 30 + (y - y0) * 0.16;
    const larga = 220 + (y - y0) * 0.5;
    const curta = larga / 2;
    let x = fila % 2 ? -curta / 2 : -larga / 3;
    let k = 0;
    while (x < W) {
      const w = (k + fila) % 3 === 0 ? curta : larga;
      ret(g, x + 2, y + 2, w - 4, h - 4, (k + fila) % 2 ? '#c9c08a' : '#d4cc98', 2);
      ret(g, x + 2, y + 2, w - 4, 4, '#3a5a3a');
      ret(g, x + 2, y + h - 6, w - 4, 4, '#3a5a3a');
      g.fillStyle = 'rgba(120,110,60,0.12)';
      for (let lx = x + 8; lx < x + w - 6; lx += 6) g.fillRect(lx, y + 7, 1, h - 14);
      x += w;
      k++;
    }
    y += h;
    fila++;
  }
}
function portaShoji(g, x0, y0, w, h, tinta, simbolo, nome, faixa) {
  ret(g, x0 - 6, y0 - 6, w + 12, h + 6, '#3e2616', 4);
  ret(g, x0, y0, w, h, '#f6eed8', 2);
  g.fillStyle = tinta;
  g.fillRect(x0, y0, w, h);
  g.strokeStyle = '#5b3a22'; g.lineWidth = 2.5;
  g.strokeRect(x0, y0, w, h);
  linha(g, '#3e2616', 4, [x0 + w / 2, y0, x0 + w / 2, y0 + h]);
  g.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 + (w / 4) * k, y0 + 100); g.lineTo(x0 + (w / 4) * k, y0 + h); g.stroke(); }
  for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x0, y0 + 100 + ((h - 100) / 5) * k); g.lineTo(x0 + w, y0 + 100 + ((h - 100) / 5) * k); g.stroke(); }
  el(g, x0 + w / 2, y0 + 50, 34, 34, '#2a1a12');
  el(g, x0 + w / 2, y0 + 50, 30, 30, '#f6eed8');
  SIMBOLO[simbolo](g, x0 + w / 2, y0 + 52, 22, 0);
  placa(g, x0 + w / 2, y0 - 22, w - 10, 24, nome, { fundo: '#2a1a12', borda: '#b8922a', cor: '#e8c24a', fonte: '700 13px "Cinzel", Georgia, serif' });
  ret(g, x0 + w / 2 - 34, y0 + h - 26, 68, 16, 'rgba(42,26,18,0.85)', 4);
  ret(g, x0 + w / 2 - 28, y0 + h - 21, 16, 6, FAIXAS[faixa].cor, 2);
  texto(g, `${FAIXA_PARA[simbolo]}+`, x0 + w / 2 + 10, y0 + h - 18, { cor: '#f4dd80', fonte: '700 10px "Cinzel", Georgia, serif' });
}
function fundoDojo(g) {
  g.fillStyle = grad(g, 0, 0, 0, 370, [[0, '#3a2414'], [1, '#6b4426']]);
  g.fillRect(0, 0, W, 370);
  for (let x = 0; x < W; x += 34) { g.fillStyle = x % 68 ? 'rgba(0,0,0,0.08)' : 'rgba(255,220,170,0.05)'; g.fillRect(x, 0, 34, 370); }
  // Vigas do teto e as janelinhas altas
  ret(g, 0, 0, W, 26, '#24150b');
  ret(g, 0, 98, W, 14, '#2e1b0e');
  for (const x of [30, 360, 640, 970]) ret(g, x - 9, 0, 18, 370, '#2e1b0e');
  for (const x of [110, 250, 750, 890]) { ret(g, x - 34, 38, 68, 46, '#2e1b0e', 3); ret(g, x - 30, 42, 60, 38, '#f2e4c0', 2); linha(g, '#2e1b0e', 2, [x, 42, x, 80]); linha(g, '#2e1b0e', 2, [x - 30, 61, x + 30, 61]); }
  // As portas dos elementos
  portaShoji(g, 70, 152, 130, 210, 'rgba(240,110,60,0.18)', 'fogo', 'Fogo', FAIXA_PARA.fogo);
  portaShoji(g, 220, 152, 130, 210, 'rgba(70,150,230,0.18)', 'agua', 'Água', FAIXA_PARA.agua);
  portaShoji(g, 650, 152, 130, 210, 'rgba(170,220,250,0.22)', 'neve', 'Neve', FAIXA_PARA.neve);
  // O nicho do Sensei: o pergaminho com o círculo de tinta e o coelho
  ret(g, 386, 120, 228, 190, '#24150b', 4);
  ret(g, 394, 128, 212, 180, '#4a2e18', 3);
  ret(g, 456, 136, 88, 150, '#f4ead2', 2);
  ret(g, 450, 132, 100, 8, '#5b3a22', 3); ret(g, 450, 282, 100, 8, '#5b3a22', 3);
  g.strokeStyle = '#1b1403'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.arc(500, 196, 30, -1.2, 4.6); g.stroke();
  el(g, 500, 204, 11, 10, '#1b1403');
  el(g, 504, 192, 7, 6.5, '#1b1403');
  el(g, 500, 180, 2.4, 8, '#1b1403', -0.2); el(g, 507, 180, 2.4, 8, '#1b1403', 0.2);
  el(g, 528, 262, 6, 6, '#c0392b');
  // O tablado do Sensei, o bonsai e o incenso
  ret(g, 392, 310, 216, 18, '#7a4a2a', 3);
  ret(g, 386, 326, 228, 40, '#5b3420', 4);
  for (let k = 0; k < 5; k++) ret(g, 392 + k * 44, 334, 40, 26, '#6b4026', 3);
  ret(g, 404, 292, 30, 18, '#3a5a8a', 3);
  linha(g, '#5b3c22', 4, [419, 292, 414, 270, 424, 254]);
  for (const [dx, dy, r] of [[-12, -38, 13], [10, -48, 12], [0, -60, 10]]) el(g, 419 + dx, 292 + dy, r, r * 0.6, '#3f7a3c');
  ret(g, 568, 298, 22, 12, '#b8922a', 3);
  for (const dx of [-5, 0, 5]) linha(g, '#5b3c22', 1.5, [579 + dx, 298, 579 + dx * 1.4, 280]);
  // O pergaminho grande da direita (o segredo)
  ret(g, 830, 112, 120, 10, '#5b3a22', 4);
  // O chão de tatame e o círculo do Desafio
  tatame(g, 366, H);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, 364, W, 6);
  g.strokeStyle = 'rgba(192,57,43,0.85)'; g.lineWidth = 6;
  g.beginPath(); g.ellipse(500, 480, 130, 40, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(232,194,74,0.6)'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(500, 480, 118, 34, 0, 0, Math.PI * 2); g.stroke();
  for (const [x, el_] of [[440, 'fogo'], [500, 'agua'], [560, 'neve']]) { g.save(); g.translate(x, 480); g.scale(1, 0.4); SIMBOLO[el_](g, 0, 0, 16, 0); g.restore(); }
  tapeteSaida(g, '#5b3420', 'Pátio');
}
const FRASES_SENSEI = [
  'Bem-vindo ao Dojo, jovem coelho.',
  'O fogo derrete a neve. A neve congela a água. A água apaga o fogo.',
  'Pise no círculo vermelho para o Desafio Ninja.',
  'Cada vitória vale uma faixa. Mas o Sensei só dá uma por vez.',
  'Três cartas do mesmo elemento, de cores diferentes... ou uma de cada elemento.',
  'O Dojo do Fogo abre na faixa laranja. O da Água, na azul. O da Neve, na roxa.',
  'Paciência também é uma arte ninja.',
];
function falaDoSensei() {
  const agora = Date.now();
  if (estado.fala && estado.fala.ate > agora) return { texto: estado.fala.texto, alfa: Math.min(1, (estado.fala.ate - agora) / 500) };
  const ciclo = agora % 11000;
  if (ciclo > 6500) return null;
  const lista = estado.faixa != null ? [...FRASES_SENSEI, `Você tem a ${nomeDaFaixa(estado.faixa)}. Continue treinando.`] : FRASES_SENSEI;
  return { texto: lista[Math.floor(agora / 11000) % lista.length], alfa: Math.min(1, ciclo / 400, (6500 - ciclo) / 400) };
}
function animarDojo(g, t) {
  // A luz das janelinhas e a poeira dançando
  for (const x of [110, 250, 750, 890]) brilho(g, x, 61, 80, 'rgba(255,230,170,A)', 0.18);
  particulas(g, 24, t, { semente: 13, vel: 6, vento: 20, y0: 40, y1: 360, cor: 'rgba(255,230,170,0.5)', r: 1.4 });
  // O brilho das portas dos elementos
  brilho(g, 135, 204, 50, 'rgba(255,120,40,A)', 0.2 + Math.sin(t * 6) * 0.08);
  simboloFogo(g, 135, 204, 22, t);
  brilho(g, 285, 204, 50, 'rgba(80,170,255,A)', 0.18 + Math.sin(t * 2) * 0.06);
  simboloAgua(g, 285, 204, 22, t);
  brilho(g, 715, 204, 50, 'rgba(200,240,255,A)', 0.22 + Math.sin(t * 3) * 0.06);
  simboloNeve(g, 715, 204, 22, t);
  // A fumaça do incenso
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.25 + k / 6) % 1;
    el(g, 579 + Math.sin(f * 8 + k) * 8 * f, 278 - f * 90, 2 + f * 6, 2 + f * 5, `rgba(230,225,215,${0.4 * (1 - f)})`);
  }
  // O pergaminho do segredo balança com um ventinho que vem de trás dele
  const bal = Math.sin(t * 1.3) * 0.025;
  g.save(); g.translate(890, 118); g.rotate(bal);
  ret(g, -52, 0, 104, 222, '#e9dcb8', 2);
  ret(g, -52, 0, 104, 222, 'rgba(120,80,40,0.08)', 2);
  ret(g, -58, 216, 116, 10, '#5b3a22', 4);
  g.globalAlpha = 0.85;
  // Um coelho ninja pintado em nanquim
  el(g, 0, 140, 24, 26, '#1b1403');
  el(g, 8, 104, 14, 13, '#1b1403');
  el(g, 2, 80, 4, 16, '#1b1403', -0.25); el(g, 12, 80, 4, 16, '#1b1403', 0.15);
  ret(g, -4, 100, 28, 5, '#c0392b', 2);
  linha(g, '#c0392b', 2.5, [-4, 102, -18, 96 + Math.sin(t * 3) * 3, -26, 106]);
  linha(g, '#1b1403', 3, [-30, 176, 30, 100]);
  g.globalAlpha = 1;
  for (let k = 0; k < 4; k++) ret(g, -40, 20 + k * 10, 30 - k * 4, 3, 'rgba(27,20,3,0.5)', 1);
  g.restore();
  // Uma faixa de ar frio sai por baixo do pergaminho (o segredo)
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.5 + k / 3) % 1;
    ret(g, 846 - f * 40, 336 + k * 7, 30 * (1 - f), 1.5, `rgba(200,220,255,${0.4 * (1 - f)})`, 1);
  }
  // O balão do Sensei
  const fala = falaDoSensei();
  if (fala) balaoFala(g, 520, 236, fala.texto, fala.alfa);
}
function sensei(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 40, 10);
  if (!sp(g, 'sensei', 'parado', x, y, { t })) senseiCorpo(g, x, y, t);
}
// O Sensei: um coelho velho, sentado na almofada, de quimono, barba comprida, chapéu de palha e cajado.
export function senseiCorpo(g, x, y, t, escala = 1.7) {
  g.save();
  g.translate(x, y);
  g.scale(escala, escala);
  el(g, 0, -2, 24, 6.5, '#7a2f3a');
  el(g, 0, -4, 22, 5.5, '#a8434f');
  linha(g, '#6b4a2b', 2.4, [-16, -2, -20, -58]);
  el(g, -20, -60, 3.2, 3.2, '#8a5a32');
  const pelo = '#d9d4c8';
  desenharCoelho(g, 0, -4, { pelo, dir: 1, t: 0, pose: 'sentado', semSprite: true });
  g.save();
  g.translate(0, -4);
  g.scale(1.06, 0.84);
  // O quimono, a faixa preta e as patinhas
  el(g, 0, -12, 15.8, 11.8, '#3a3a6a');
  el(g, 2, -9, 9.5, 6.5, '#45457a');
  forma(g, '#efe6d3', [5, -23, 12, -22, 7, -12]);
  ret(g, -15, -12, 30, 3.4, FAIXAS[10].cor, 1);
  ret(g, 6, -12, 4, 7, FAIXAS[10].cor, 1);
  el(g, -7, -2.5, 6, 3.4, '#b8b2a6');
  el(g, 7, -2.5, 6, 3.4, '#b8b2a6');
  // Olhos fechados (sábio), sobrancelhas e a barba que balança
  el(g, 15, -28, 2.4, 2.5, pelo);
  g.strokeStyle = '#1b1403'; g.lineWidth = 0.9;
  g.beginPath(); g.arc(15, -28.6, 2, 0.2, Math.PI - 0.2); g.stroke();
  el(g, 15.5, -31.8, 3.6, 1.4, '#f6f3ec', -0.2);
  const bal = Math.sin(t * 1.2) * 0.9;
  g.fillStyle = '#f6f3ec';
  g.beginPath();
  g.moveTo(9, -23);
  g.quadraticCurveTo(21, -25, 20.5, -17);
  g.quadraticCurveTo(20, -7, 15 + bal, 3);
  g.quadraticCurveTo(12, -7, 8.5, -15);
  g.closePath();
  g.fill();
  linha(g, 'rgba(180,170,150,0.5)', 0.6, [15, -20, 15.5 + bal * 0.5, -4]);
  el(g, 19.5, -23.5, 4.2, 1.7, '#f6f3ec', 0.35);
  // O chapéu de palha
  forma(g, '#d9b26a', [-6, -35, 28, -35, 11, -47]);
  forma(g, '#c49a50', [-6, -35, 28, -35, 26, -33, -4, -33]);
  linha(g, '#a8843e', 0.8, [11, -47, 2, -35]);
  linha(g, '#a8843e', 0.8, [11, -47, 20, -35]);
  g.restore();
  g.restore();
}

/* ═══════════════ Dojos dos elementos ═══════════════ */

function pedestal(g, x, y, elemento, t) {
  sombraNoChao(g, x, y + 2, 80, 14);
  const cor = { fogo: ['#2a1a16', '#3a2420', '#ff7a2a'], agua: ['#2a3a3a', '#3a5050', '#6fd0ff'], neve: ['#9ab8d8', '#c8def2', '#ffffff'] }[elemento];
  ret(g, x - 78, y - 26, 156, 26, cor[0], 6);
  ret(g, x - 66, y - 70, 132, 46, cor[1], 6);
  ret(g, x - 82, y - 82, 164, 16, cor[0], 6);
  // Três cartas em cima da mesa
  for (let k = -1; k <= 1; k++) {
    g.save(); g.translate(x + k * 34, y - 90); g.rotate(k * 0.12);
    ret(g, -14, -20, 28, 38, '#f6ecd4', 3);
    contorno(g, -14, -20, 28, 38, ['#d8433a', '#3f7fd8', '#f2c63a'][k + 1], 2.5, 3);
    SIMBOLO[['fogo', 'agua', 'neve'][k + 1]](g, 0, 0, 9, t);
    g.restore();
  }
  el(g, x, y - 48, 16, 16, cor[0]);
  SIMBOLO[elemento](g, x, y - 48, 12, t);
  brilho(g, x, y - 60, 90, { fogo: 'rgba(255,120,40,A)', agua: 'rgba(80,190,255,A)', neve: 'rgba(220,240,255,A)' }[elemento], 0.18 + Math.sin(t * 3) * 0.05);
}

function fundoFogo(g) {
  g.fillStyle = grad(g, 0, 0, 0, 330, [[0, '#140404'], [0.5, '#4a0f08'], [1, '#b8320f']]);
  g.fillRect(0, 0, W, 330);
  // O vulcão
  forma(g, '#2a1410', [180, 330, 430, 96, 570, 96, 820, 330]);
  forma(g, '#3a1c14', [300, 330, 450, 120, 520, 110, 470, 330]);
  el(g, 500, 98, 72, 14, '#1a0a08');
  el(g, 500, 96, 60, 9, '#ff7a2a');
  for (const pts of [[470, 104, 455, 170, 470, 230, 440, 330], [530, 104, 548, 180, 530, 250, 560, 330], [500, 106, 505, 200, 495, 330]]) {
    for (const [cor, lw] of [['#b8320f', 9], ['#ff8a2a', 4]]) linha(g, cor, lw, pts);
  }
  // Pedras pontudas dos lados
  for (const [x, w, h] of [[40, 120, 160], [140, 90, 110], [870, 130, 170], [780, 80, 100]]) forma(g, '#1e0e0a', [x - w / 2, 330, x - w * 0.1, 330 - h, x + w * 0.15, 330 - h * 0.8, x + w / 2, 330]);
  // O lago de lava
  g.fillStyle = grad(g, 0, 300, 0, 390, [[0, '#ff9a2a'], [1, '#c0300c']]);
  g.fillRect(0, 300, W, 90);
  const rnd = sorte(61);
  for (let k = 0; k < 26; k++) el(g, rnd() * W, 310 + rnd() * 70, 20 + rnd() * 40, 4 + rnd() * 5, 'rgba(60,15,5,0.55)');
  // A plataforma de basalto (hexágonos com rachaduras que brilham)
  g.fillStyle = '#1a1412';
  g.fillRect(0, 385, W, H - 385);
  for (let fila = 0; fila < 9; fila++) {
    const y = 392 + fila * 25 + fila * fila * 0.8;
    const r = 18 + fila * 2.4;
    for (let x = (fila % 2) * r * 0.9; x < W + r; x += r * 1.8) {
      g.fillStyle = ['#2a2220', '#33292a', '#262020'][(fila + Math.floor(x)) % 3];
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.5); }
      g.closePath(); g.fill();
    }
  }
  for (let k = 0; k < 10; k++) { const x = rnd() * W; const y = 410 + rnd() * 170; linha(g, 'rgba(255,110,30,0.7)', 2, [x, y, x + 14, y + 6, x + 22, y + 2, x + 34, y + 10]); }
  ret(g, 0, 382, W, 6, '#ff7a2a');
  tapeteSaida(g, '#4a1a10', 'Dojo');
}
function braseiro(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 30, 8);
  forma(g, '#2a2220', [x - 26, y - 46, x + 26, y - 46, x + 14, y - 10, x - 14, y - 10]);
  ret(g, x - 6, y - 12, 12, 12, '#2a2220');
  ret(g, x - 18, y - 4, 36, 6, '#2a2220', 2);
  for (let k = 0; k < 3; k++) chama(g, x - 12 + k * 12, y - 60 + Math.sin(t * 9 + k) * 3, 14 + Math.sin(t * 7 + k * 2) * 3, k === 1 ? '#f5892a' : '#d9381a', Math.sin(t * 6 + k) * 2);
  chama(g, x, y - 54, 9, '#ffe27a', Math.sin(t * 10) * 1.5);
  brilho(g, x, y - 60, 70, 'rgba(255,120,40,A)', 0.3);
}
function animarFogo(g, t) {
  brilho(g, 500, 96, 120, 'rgba(255,120,40,A)', 0.4 + Math.sin(t * 2) * 0.1);
  // A fumaça e as bolas de lava que o vulcão cospe
  for (let k = 0; k < 5; k++) {
    const f = (t * 0.12 + k / 5) % 1;
    el(g, 500 + Math.sin(f * 4 + k) * 40 * f, 80 - f * 120, 20 + f * 60, 16 + f * 40, `rgba(40,25,25,${0.5 * (1 - f)})`);
  }
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.45 + k * 0.27) % 1;
    const lado = k % 2 ? 1 : -1;
    const x = 500 + lado * f * (120 + k * 30);
    const y = 96 - Math.sin(f * Math.PI) * (90 + k * 20) + f * 60;
    el(g, x, y, 6, 6, '#ff8a2a');
    brilho(g, x, y, 18, 'rgba(255,160,60,A)', 0.5);
  }
  // A lava borbulha
  for (let k = 0; k < 8; k++) {
    const f = (t * 0.6 + k * 0.13) % 1;
    const x = (k * 137) % W;
    el(g, x, 330 + (k % 4) * 14, 4 + f * 8, (4 + f * 8) * 0.5, `rgba(255,220,120,${0.7 * (1 - f)})`);
  }
  // Brasas subindo
  particulas(g, 40, t, { semente: 17, vel: 40, vento: 14, subir: true, cor: k => (k % 2 ? '#ffb040' : '#ff6a20'), r: 2 });
  // As rachaduras pulsam
  g.save();
  g.globalAlpha = 0.18 + Math.sin(t * 2.4) * 0.08;
  g.fillStyle = '#ff6a20';
  g.fillRect(0, 385, W, H - 385);
  g.restore();
}

function fundoAgua(g) {
  g.fillStyle = grad(g, 0, 0, 0, 330, [[0, '#0d2f3c'], [0.55, '#2f7d88'], [1, '#a5dcd4']]);
  g.fillRect(0, 0, W, 330);
  // Arco-íris fraquinho na névoa
  g.save();
  g.globalAlpha = 0.16;
  for (const [cor, r] of [['#ff6a6a', 250], ['#ffd06a', 240], ['#7aff8a', 230], ['#6ab0ff', 220], ['#b07aff', 210]]) { g.strokeStyle = cor; g.lineWidth = 10; g.beginPath(); g.arc(500, 380, r, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
  g.restore();
  // Os penhascos com musgo
  forma(g, '#2a3a36', [0, 0, 330, 0, 340, 120, 300, 200, 330, 330, 0, 330]);
  forma(g, '#2a3a36', [1000, 0, 670, 0, 660, 140, 700, 220, 670, 330, 1000, 330]);
  forma(g, '#34483f', [0, 60, 250, 40, 280, 160, 230, 330, 0, 330]);
  forma(g, '#34483f', [1000, 50, 760, 70, 720, 180, 780, 330, 1000, 330]);
  const rnd = sorte(71);
  for (let k = 0; k < 40; k++) { const lado = k % 2; el(g, lado ? 700 + rnd() * 300 : rnd() * 300, rnd() * 330, 12 + rnd() * 16, 6 + rnd() * 8, ['#3f7a4a', '#4f8a50', '#2f6a3c'][k % 3]); }
  // A cachoeira (o desenho de base; a água que corre vem em animar)
  g.fillStyle = grad(g, 330, 0, 670, 0, [[0, '#6fbfd8'], [0.5, '#bfeaf4'], [1, '#6fbfd8']]);
  g.fillRect(335, 0, 330, 300);
  // A lagoa e as folhas de lótus
  g.fillStyle = grad(g, 0, 296, 0, 390, [[0, '#4fa8c0'], [1, '#1f5f78']]);
  g.fillRect(0, 296, W, 94);
  for (const [x, y, r] of [[160, 340, 22], [220, 360, 16], [780, 336, 20], [850, 362, 24]]) {
    g.fillStyle = '#3f8a4a'; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, r, r * 0.4, 0, 0.3, Math.PI * 2 - 0.1); g.closePath(); g.fill();
  }
  el(g, 160, 334, 6, 5, '#f6b6cf'); el(g, 850, 356, 7, 6, '#fbd3e2');
  // O deque de bambu
  g.fillStyle = '#7a6a3a';
  g.fillRect(0, 386, W, H - 386);
  for (let x = -10; x < W; x += 26) {
    ret(g, x + 1, 386, 24, H - 386, x % 52 ? '#c9b26a' : '#bfa65e', 3);
    for (const y of [430, 500, 570]) ret(g, x + 1, y, 24, 3, '#9a8448', 1);
  }
  ret(g, 0, 384, W, 6, '#5b4a28');
  tapeteSaida(g, '#1f5f78', 'Dojo');
}
function bicaBambu(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 34, 8);
  el(g, x + 10, y - 8, 30, 10, '#5a6a6a');
  el(g, x + 10, y - 11, 24, 7, '#4fa8c0');
  ret(g, x - 32, y - 70, 8, 70, '#8a9a4a', 3);
  ret(g, x - 20, y - 50, 6, 50, '#8a9a4a', 3);
  // O bambu que enche, vira e faz "toc"
  const ciclo = t % 4;
  const ang = ciclo < 3.4 ? -0.35 + (ciclo / 3.4) * 0.15 : 0.45;
  g.save(); g.translate(x - 24, y - 46); g.rotate(ang);
  ret(g, -6, -6, 50, 12, '#a8b85a', 6);
  ret(g, 38, -6, 4, 12, '#7a8a3a');
  g.restore();
  if (ciclo > 3.4) for (let k = 0; k < 4; k++) el(g, x + 18 + k * 3, y - 30 + (ciclo - 3.4) * 50 + k * 4, 1.8, 3, 'rgba(160,220,255,0.8)');
}
function pedraMusgo(g, x, y) {
  sombraNoChao(g, x, y + 2, 46, 10);
  el(g, x, y - 22, 46, 26, '#5a6a64');
  el(g, x - 8, y - 32, 30, 14, '#6a7a72');
  el(g, x - 10, y - 42, 26, 8, '#4f8a50');
  el(g, x + 14, y - 38, 14, 6, '#3f7a4a');
}
function animarAgua(g, t) {
  // A água que cai
  g.save();
  g.beginPath(); g.rect(335, 0, 330, 300); g.clip();
  for (let k = 0; k < 26; k++) {
    const x = 340 + k * 12.6;
    const f = (t * (1.4 + (k % 4) * 0.3) + k * 0.37) % 1;
    for (let r = 0; r < 3; r++) ret(g, x, ((f + r / 3) % 1) * 320 - 30, 3, 26 + (k % 3) * 10, 'rgba(255,255,255,0.45)', 1.5);
  }
  g.restore();
  // A espuma e a névoa no pé da cachoeira
  for (let k = 0; k < 12; k++) {
    const f = (t * 0.7 + k / 12) % 1;
    el(g, 345 + k * 28 + Math.sin(t * 3 + k) * 4, 300 - f * 30, 14 + f * 18, 8 + f * 10, `rgba(255,255,255,${0.55 * (1 - f)})`);
  }
  particulas(g, 30, t, { semente: 19, vel: 12, vento: 30, y0: 200, y1: 390, subir: true, cor: 'rgba(255,255,255,0.35)', r: 4 });
  // Carpas na lagoa
  for (let k = 0; k < 3; k++) {
    const x = (k * 330 + t * (30 + k * 10)) % (W + 80) - 40;
    const y = 320 + k * 18 + Math.sin(t * 1.5 + k) * 6;
    el(g, x, y, 14, 5, ['#ff8a3a', '#ffffff', '#ffd06a'][k]);
    forma(g, ['#ff8a3a', '#ffffff', '#ffd06a'][k], [x - 12, y, x - 22, y - 6 + Math.sin(t * 8 + k) * 2, x - 22, y + 6 + Math.sin(t * 8 + k) * 2]);
    el(g, x + 4, y - 1, 3, 2, 'rgba(255,60,40,0.8)');
  }
  // Ondinhas
  for (let k = 0; k < 10; k++) { const x = (k * 113 + t * 18) % W; ret(g, x, 310 + (k * 29) % 70, 26, 2, 'rgba(255,255,255,0.3)', 1); }
}

function fundoNeve(g) {
  g.fillStyle = grad(g, 0, 0, 0, 340, [[0, '#0b1a3a'], [0.5, '#3a64a8'], [1, '#cfe6fb']]);
  g.fillRect(0, 0, W, 340);
  const rnd = sorte(81);
  for (let k = 0; k < 60; k++) el(g, rnd() * W, rnd() * 160, 1.1, 1.1, `rgba(255,255,255,${0.4 + rnd() * 0.5})`);
  // Os picos de gelo saindo do mar de nuvens
  for (const [x, h, w] of [[120, 150, 120], [300, 90, 80], [720, 120, 100], [880, 170, 130]]) {
    forma(g, '#9cc4e8', [x - w / 2, 290, x, 290 - h, x + w / 2, 290]);
    forma(g, '#e8f6ff', [x - w * 0.18, 290 - h * 0.62, x, 290 - h, x + w * 0.12, 290 - h * 0.66, x, 290 - h * 0.5]);
  }
  // O mar de nuvens
  for (let k = 0; k < 22; k++) el(g, (k * 53) % (W + 60), 300 + (k % 3) * 22, 70 + (k % 4) * 20, 26 + (k % 3) * 8, k % 2 ? '#f2f8ff' : '#dcebfa');
  // A arena de gelo
  forma(g, '#7fb6dc', [60, 380, 940, 380, 1000, H, 0, H]);
  g.fillStyle = grad(g, 0, 380, 0, H, [[0, '#cdeafc'], [1, '#9fd0f0']]);
  g.beginPath(); g.moveTo(70, 386); g.lineTo(930, 386); g.lineTo(990, H); g.lineTo(10, H); g.closePath(); g.fill();
  for (let k = 0; k < 9; k++) { const x = 100 + k * 100; linha(g, 'rgba(255,255,255,0.7)', 1.5, [x, 400 + (k % 3) * 40, x + 30, 430 + (k % 2) * 30, x + 10, 470 + (k % 3) * 20, x + 50, 500]); }
  for (let k = 0; k < 6; k++) ret(g, 150 + k * 130, 420 + (k % 3) * 50, 60, 3, 'rgba(255,255,255,0.6)', 2);
  // A borda de neve e os pingentes
  ret(g, 60, 376, 880, 10, '#f6fbff', 5);
  for (let k = 0; k < 30; k++) forma(g, '#e0f2ff', [70 + k * 29, 384, 78 + k * 29, 384, 74 + k * 29, 396 + (k % 3) * 6]);
  tapeteSaida(g, '#3a64a8', 'Dojo');
}
function pilarGelo(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 34, 9);
  forma(g, '#9fd0f0', [x - 26, y, x - 20, y - 120, x, y - 150, x + 20, y - 118, x + 26, y]);
  forma(g, '#d8f0ff', [x - 14, y - 10, x - 10, y - 116, x, y - 140, x + 2, y - 10]);
  forma(g, '#ffffff', [x - 6, y - 40, x - 4, y - 110, x, y - 128, x - 1, y - 40]);
  brilho(g, x, y - 90, 50, 'rgba(200,240,255,A)', 0.25 + Math.sin(t * 2 + x) * 0.08);
}
function animarNeve(g, t) {
  // A aurora
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [cor, y0, fase] of [['rgba(80,255,170,0.10)', 60, 0], ['rgba(170,110,255,0.09)', 90, 1.7]]) {
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 50) g.lineTo(x, y0 + Math.sin(x * 0.01 + t * 0.5 + fase) * 26);
    for (let x = W; x >= 0; x -= 50) g.lineTo(x, y0 + 50 + Math.sin(x * 0.012 + t * 0.4 + fase) * 30);
    g.closePath();
    g.fill();
  }
  g.restore();
  // Nuvens passando
  for (let k = 0; k < 6; k++) {
    const x = ((k * 210 + t * (8 + k * 3)) % (W + 300)) - 150;
    el(g, x, 318 + (k % 3) * 18, 90, 22, 'rgba(255,255,255,0.55)');
  }
  // Brilhinhos no gelo e a neve ventando
  for (let k = 0; k < 8; k++) {
    const f = (t * 0.6 + k * 0.29) % 1;
    const x = 120 + ((k * 211) % 760);
    const y = 410 + ((k * 97) % 170);
    const a = Math.sin(f * Math.PI);
    linha(g, `rgba(255,255,255,${a})`, 1.5, [x - 6 * a, y, x + 6 * a, y]);
    linha(g, `rgba(255,255,255,${a})`, 1.5, [x, y - 6 * a, x, y + 6 * a]);
  }
  particulas(g, 60, t, { semente: 23, vel: 40, vento: 60, cor: 'rgba(255,255,255,0.9)', r: 2.2 });
}

/* ═══════════════ Esconderijo Ninja ═══════════════ */

function fundoEsconderijo(g) {
  g.fillStyle = grad(g, 0, 0, 0, 390, [[0, '#120e1c'], [1, '#2a2036']]);
  g.fillRect(0, 0, W, 390);
  for (let x = 0; x < W; x += 42) { ret(g, x + 1, 0, 40, 390, x % 84 ? '#1c1628' : '#211a2e'); ret(g, x, 0, 2, 390, 'rgba(0,0,0,0.35)'); }
  ret(g, 0, 0, W, 22, '#0c0912');
  // A janela redonda com a lua e o bambu
  el(g, 500, 160, 98, 98, '#3a2a1a');
  el(g, 500, 160, 88, 88, '#1a2a50');
  g.save();
  g.beginPath(); g.arc(500, 160, 88, 0, Math.PI * 2); g.clip();
  g.fillStyle = grad(g, 0, 72, 0, 248, [[0, '#0e1a3a'], [1, '#3a4a80']]);
  g.fillRect(400, 60, 200, 200);
  brilho(g, 530, 130, 80, 'rgba(255,250,220,A)', 0.4);
  el(g, 530, 130, 34, 34, '#fbf6e0');
  el(g, 520, 122, 7, 5, 'rgba(200,190,160,0.5)'); el(g, 540, 140, 5, 4, 'rgba(200,190,160,0.5)');
  for (const x of [430, 452, 560, 585]) { ret(g, x, 60, 8, 220, '#0a0f1a'); for (let y = 90; y < 260; y += 40) ret(g, x - 1, y, 10, 3, '#05080f'); }
  g.restore();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(412, 160); g.lineTo(588, 160); g.moveTo(500, 72); g.lineTo(500, 248); g.stroke();
  // A estante de pergaminhos
  ret(g, 56, 110, 208, 236, '#3a2416', 4);
  ret(g, 64, 118, 192, 220, '#24160c', 3);
  for (let p = 0; p < 4; p++) {
    const y = 118 + p * 55;
    ret(g, 62, y + 50, 196, 6, '#4a2e18');
    for (let k = 0; k < 7; k++) {
      const x = 76 + k * 26;
      el(g, x, y + 38, 11, 11, ['#e9dcb8', '#d8c89a', '#efe2c0'][(k + p) % 3]);
      el(g, x, y + 38, 4, 4, ['#c0392b', '#3a5a8a', '#2f6b34'][(k * 2 + p) % 3]);
    }
  }
  // Bastões de treino encostados
  for (const [x, ang] of [[300, -0.12], [318, -0.08]]) { g.save(); g.translate(x, 390); g.rotate(ang); ret(g, -3, -200, 6, 200, '#8a6a3a', 3); g.restore(); }
  // A armação do gongo
  ret(g, 760, 110, 16, 280, '#4a2412', 3);
  ret(g, 904, 110, 16, 280, '#4a2412', 3);
  ret(g, 744, 98, 192, 20, '#5b2e16', 6);
  forma(g, '#5b2e16', [736, 104, 744, 92, 752, 104]); forma(g, '#5b2e16', [928, 104, 936, 92, 944, 104]);
  // O chão de madeira escura com o tatame de treino
  chaoTabuas(g, 390, H, ['#3a2618', '#33211a', '#402a1a'], 'rgba(0,0,0,0.45)', 29);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 388, W, 6);
  ret(g, 220, 440, 560, 110, 'rgba(201,192,138,0.3)', 6);
  contorno(g, 220, 440, 560, 110, 'rgba(58,90,58,0.8)', 4, 6);
  tapeteSaida(g, '#3a2a5a', 'Dojo');
}
function boneco(g, x, y, t, n) {
  sombraNoChao(g, x, y + 2, 26, 8);
  const desde = Date.now() - (estado.boneco[n] || 0);
  const ang = desde < 1500 ? Math.sin(desde / 60) * 0.25 * (1 - desde / 1500) : 0;
  g.save(); g.translate(x, y); g.rotate(ang);
  if (!sp(g, 'boneco-treino', 'parado', 0, 0, { t })) bonecoCorpo(g);
  g.restore();
}
function bonecoCorpo(g) {
  ret(g, -18, -8, 36, 8, '#3a2416', 2);
  ret(g, -5, -100, 10, 94, '#7a5434', 2);
  ret(g, -26, -78, 52, 9, '#7a5434', 3);
  for (let k = 0; k < 4; k++) ret(g, -12, -92 + k * 14, 24, 10, k % 2 ? '#d8c07a' : '#c9b06a', 4);
  el(g, 0, -112, 15, 15, '#d8c07a');
  ret(g, -15, -116, 30, 6, '#c0392b', 2);
  linha(g, '#c0392b', 2, [-14, -113, -26, -106]);
  el(g, -5, -112, 2, 2, '#3a2416'); el(g, 5, -112, 2, 2, '#3a2416');
}
function vela(g, x, y, t) {
  ret(g, x - 5, y - 24, 10, 24, '#efe6d3', 2);
  chama(g, x, y - 32, 6, '#f5892a', Math.sin(t * 9 + x) * 1.2);
  chama(g, x, y - 30, 3.5, '#ffe27a', 0);
  brilho(g, x, y - 32, 40, 'rgba(255,200,120,A)', 0.3 + Math.sin(t * 7 + x) * 0.05);
}
function animarEsconderijo(g, t) {
  brilho(g, 520, 140, 160, 'rgba(180,200,255,A)', 0.12);
  // Um feixe de luar no chão
  g.save();
  g.globalAlpha = 0.08;
  forma(g, '#d8e4ff', [430, 200, 570, 200, 700, H, 330, H]);
  g.restore();
  // O gongo (balança e solta ondas quando alguém bate)
  const desde = Date.now() - estado.gongo;
  const bate = desde < 3000 ? 1 - desde / 3000 : 0;
  const ang = Math.sin(desde / 70) * 0.08 * bate;
  linha(g, '#2a1a12', 2, [812, 118, 818, 188]);
  linha(g, '#2a1a12', 2, [868, 118, 862, 188]);
  g.save(); g.translate(840, 240); g.rotate(ang);
  el(g, 0, 0, 60, 60, '#8a6a20');
  el(g, 0, 0, 55, 55, grad(g, -55, -55, 55, 55, [[0, '#f2d06a'], [0.5, '#c9a03a'], [1, '#8a6a20']]));
  for (const r of [42, 26]) { g.strokeStyle = 'rgba(90,60,10,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  el(g, 0, 0, 16, 16, '#b8922a');
  el(g, -20, -26, 16, 8, 'rgba(255,255,255,0.3)', -0.6);
  g.restore();
  if (bate) {
    for (let k = 0; k < 3; k++) {
      const f = ((desde / 1000) * 1.2 + k / 3) % 1;
      g.strokeStyle = `rgba(255,220,120,${0.6 * (1 - f) * bate})`; g.lineWidth = 3;
      g.beginPath(); g.arc(840, 240, 62 + f * 120, 0, Math.PI * 2); g.stroke();
    }
    texto(g, 'GONNNG!', 840, 120 - (1 - bate) * 20, { cor: `rgba(255,230,140,${bate})`, fonte: '700 26px "Cinzel", Georgia, serif', sombra: `rgba(0,0,0,${bate * 0.6})` });
  }
  // O bastão do gongo pendurado
  linha(g, '#7a5434', 5, [930, 150, 940, 300]);
  el(g, 941, 306, 9, 9, '#c0392b');
  // Velas
  for (const [x, y] of [[120, 380], [150, 386], [880, 384]]) vela(g, x, y, t);
  // Vaga-lumes lá fora (na janela)
  g.save();
  g.beginPath(); g.arc(500, 160, 88, 0, Math.PI * 2); g.clip();
  particulas(g, 8, t, { semente: 29, vel: 8, vento: 20, x0: 410, x1: 590, y0: 80, y1: 250, subir: true, cor: 'rgba(220,255,140,0.9)', r: 2 });
  g.restore();
}

/* ═══════════════ Dimensão das Caixas ═══════════════ */

const CAIXAS = [
  { n: 1, x: 220, y: 470, tam: 70 },
  { n: 2, x: 370, y: 436, tam: 54 },
  { n: 3, x: 640, y: 446, tam: 60 },
  { n: 4, x: 790, y: 505, tam: 74 },
  { n: 5, x: 330, y: 562, tam: 50 },
];
const CAIXA_VOLTA = { x: 500, y: 400, tam: 84 };
const SURPRESAS = [
  { id: 'pompom', texto: 'Um Pompom pula de dentro da caixa e dá um abraço fofinho!' },
  { id: 'confete', texto: 'Confete roxo para todo lado!' },
  { id: 'mola', texto: 'BOING! Um coelho de mola sai da caixa.' },
  { id: 'caixinha', texto: 'Dentro da caixa tem... outra caixa. E dentro dela, outra.' },
  { id: 'arco', texto: 'Um arco-íris sai da caixa e some no escuro.' },
  { id: 'estrelas', texto: 'Estrelinhas! A caixa estava cheia de céu.' },
  { id: 'cenoura', texto: 'Uma cenoura gigante! Pena que é de papelão.' },
  { id: 'eco', texto: 'Está vazia. Você grita "oi" e o eco responde: "...oi ...oi ...oi".' },
];
const CORES_POMPOM = ['#f29bbd', '#7fb8f0', '#f2d04a', '#7fd08a', '#b58ae8', '#3a3440', '#f7f3ea', '#f5a05a'];

// Uma caixa de papelão roxa (x, y: o meio de baixo). aberta: 0 (fechada) a 1 (abas abertas).
export function caixaRoxa(g, x, y, tam, aberta = 0, cor = '#8a5cc0') {
  const s = tam / 2;
  const p = s * 0.45; // a profundidade (o lado de cima, em perspectiva)
  forma(g, '#5a3a8a', [x + s, y, x + s + p * 0.6, y - p * 0.5, x + s + p * 0.6, y - tam - p * 0.5, x + s, y - tam]);
  ret(g, x - s, y - tam, tam, tam, cor);
  ret(g, x - 4, y - tam, 8, tam * 0.45, 'rgba(255,230,255,0.35)');
  linha(g, 'rgba(40,20,70,0.6)', 1.5, [x - s, y - tam * 0.2, x + s, y - tam * 0.2]);
  // O lado de cima: fechado ou com as abas abertas
  const topo = [x - s, y - tam, x + s, y - tam, x + s + p * 0.6, y - tam - p * 0.5, x - s + p * 0.6, y - tam - p * 0.5];
  forma(g, aberta > 0 ? '#2a1846' : '#a77ad8', topo);
  if (aberta <= 0) { linha(g, 'rgba(255,230,255,0.5)', 3, [x + p * 0.3, y - tam - p * 0.25, x + p * 0.3 - s * 0.1, y - tam]); return; }
  const a = aberta * 1.9;
  for (const lado of [-1, 1]) {
    const bx = lado < 0 ? x - s : x + s;
    const by = y - tam;
    const ponta = s * 0.9;
    forma(g, lado < 0 ? '#9a6cd0' : '#7a4cb0', [bx, by, bx + p * 0.6, by - p * 0.5, bx + p * 0.6 + lado * Math.sin(a) * ponta * 0.6, by - p * 0.5 - Math.cos(a - 0.2) * ponta, bx + lado * Math.sin(a) * ponta * 0.6, by - Math.cos(a - 0.2) * ponta]);
  }
}
function surpresa(g, id, x, y, f, t, cor) {
  // f: 0..1 (a surpresa saindo da caixa); y: a boca da caixa
  const sobe = Math.min(1, f * 2.5);
  if (id === 'pompom') {
    const py = y - 26 * sobe - Math.abs(Math.sin(t * 5)) * 12;
    el(g, x, py, 18, 16, cor);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; el(g, x + Math.cos(a) * 15, py + Math.sin(a) * 13, 6, 6, cor); }
    el(g, x - 6, py - 3, 4, 5, '#fff'); el(g, x + 6, py - 3, 4, 5, '#fff');
    el(g, x - 5, py - 2, 2, 3, '#1b1403'); el(g, x + 7, py - 2, 2, 3, '#1b1403');
    el(g, x, py + 6, 3, 1.6, '#e9867d');
  } else if (id === 'confete') {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const d = 20 + sobe * 60 + (k % 3) * 10;
      ret(g, x + Math.cos(a) * d * 0.8, y - 30 - Math.sin(a) * d * 0.5 + f * 40, 5, 3, ['#ff7ad9', '#ffe46b', '#6be0ff', '#b58ae8'][k % 4], 1);
    }
  } else if (id === 'mola') {
    const alto = 20 + sobe * 46 + Math.sin(t * 9) * 4 * sobe;
    g.strokeStyle = '#c8ccd4'; g.lineWidth = 2.5;
    g.beginPath();
    for (let k = 0; k <= 12; k++) g.lineTo(x + (k % 2 ? 8 : -8), y - (k / 12) * alto);
    g.stroke();
    g.save(); g.translate(x - 8, y - alto + 8); g.scale(1.1, 1.1);
    el(g, 11, -27, 9.5, 9, '#f7f3ea');
    for (const [ox, rot] of [[6, -0.28], [11.5, 0.12]]) { el(g, ox, -43, 3.6, 10.5, '#f7f3ea', rot); el(g, ox, -42, 1.6, 7.5, '#e9a7a0', rot); }
    el(g, 15, -28, 1.9, 2.1, '#1b1403'); el(g, 20, -24.5, 1.6, 1.3, '#e9867d');
    g.restore();
  } else if (id === 'caixinha') {
    for (let k = 0; k < 3; k++) caixaRoxa(g, x + k * 3, y - 6 - sobe * (14 + k * 16), 26 - k * 8, k < 2 ? 1 : 0, ['#b58ae8', '#c9a6f0', '#e0c8ff'][k]);
  } else if (id === 'arco') {
    g.save();
    g.globalAlpha = Math.min(1, (1 - f) * 2);
    for (const [c, r] of [['#ff6a6a', 46], ['#ffd06a', 40], ['#7aff8a', 34], ['#6ab0ff', 28], ['#b07aff', 22]]) { g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.arc(x + 30, y - 4, r * sobe + 1, Math.PI, Math.PI * 2); g.stroke(); }
    g.restore();
  } else if (id === 'estrelas') {
    for (let k = 0; k < 7; k++) {
      const a = t * 1.5 + k;
      const sx = x + Math.cos(a) * 30 * sobe;
      const sy = y - 30 * sobe - 20 + Math.sin(a * 1.3) * 16;
      simboloEstrela(g, sx, sy, 6 + (k % 3) * 2, ['#ffe46b', '#ffffff', '#c9a6f0'][k % 3]);
    }
  } else if (id === 'cenoura') {
    g.save(); g.translate(x, y - 10 - sobe * 40); g.rotate(Math.sin(t * 2) * 0.15);
    forma(g, '#e07a2a', [-12, -30, 12, -30, 0, 34]);
    for (let k = 0; k < 4; k++) linha(g, 'rgba(120,50,10,0.5)', 1.5, [-8 + k * 2, -18 + k * 12, 0, -14 + k * 12]);
    for (const r of [-0.4, 0, 0.4]) el(g, Math.sin(r) * 10, -38, 4, 11, '#4f8a3c', r);
    g.restore();
  } else if (id === 'eco') {
    for (let k = 0; k < 3; k++) texto(g, 'oi', x + 20 + k * 22, y - 30 - k * 14 - f * 10, { cor: `rgba(220,200,255,${(1 - f) * (1 - k * 0.3)})`, fonte: `italic 700 ${16 - k * 3}px Georgia, serif` });
  }
}
function simboloEstrela(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * Math.PI * 2; const d = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  g.closePath();
  g.fill();
}
// Uma escada que dá a volta inteira e sempre sobe (vista de cima, em perspectiva isométrica).
function escadaImpossivel(g, x, y, s, cor) {
  const passos = [];
  let px = 0;
  let py = 0;
  let alt = 0;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) for (let k = 0; k < 4; k++) { passos.push([px, py, alt]); px += dx; py += dy; alt += 0.25; }
  passos.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  for (const [qx, qy, h] of passos) {
    const cx = x + (qx - qy) * 0.87 * s;
    const cy = y + (qx + qy) * 0.5 * s - h * s;
    forma(g, 'rgba(20,8,40,0.55)', [cx - 0.87 * s, cy, cx, cy + 0.5 * s, cx, cy + 1.1 * s, cx - 0.87 * s, cy + 0.6 * s]);
    forma(g, 'rgba(10,4,25,0.7)', [cx + 0.87 * s, cy, cx, cy + 0.5 * s, cx, cy + 1.1 * s, cx + 0.87 * s, cy + 0.6 * s]);
    forma(g, cor, [cx, cy - 0.5 * s, cx + 0.87 * s, cy, cx, cy + 0.5 * s, cx - 0.87 * s, cy]);
  }
}
function fundoCaixas(g) {
  const gr = g.createRadialGradient(500, 230, 20, 500, 230, 700);
  gr.addColorStop(0, '#6a3aa0'); gr.addColorStop(0.45, '#2a1250'); gr.addColorStop(1, '#07030f');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const rnd = sorte(91);
  for (let k = 0; k < 120; k++) el(g, rnd() * W, rnd() * 420, 1 + rnd(), 1 + rnd(), `rgba(230,210,255,${0.3 + rnd() * 0.6})`);
  // A espiral no fundo
  g.strokeStyle = 'rgba(200,160,255,0.12)'; g.lineWidth = 3;
  g.beginPath();
  for (let a = 0; a < Math.PI * 10; a += 0.1) g.lineTo(500 + Math.cos(a) * a * 9, 220 + Math.sin(a) * a * 5);
  g.stroke();
  escadaImpossivel(g, 200, 110, 22, '#9a7ad0');
  g.save(); g.translate(860, 150); g.rotate(Math.PI);
  escadaImpossivel(g, 0, 0, 15, '#6a4aa0');
  g.restore();
  // Uma porta flutuando de cabeça para baixo
  g.save(); g.translate(700, 90); g.rotate(2.6);
  ret(g, -18, -32, 36, 64, '#4a2a7a', 3); el(g, 10, 0, 3, 3, '#e8c24a');
  g.restore();
  // O chão: a tampa de uma caixa gigante
  forma(g, '#5a3a8a', [80, 392, 920, 392, 990, 600, 10, 600]);
  forma(g, '#8a5cc0', [92, 398, 908, 398, 972, 600, 28, 600]);
  forma(g, '#c9a6f0', [470, 398, 530, 398, 560, 600, 440, 600]);
  for (let k = 0; k < 6; k++) linha(g, 'rgba(60,30,100,0.25)', 2, [92 + k * 4, 420 + k * 34, 908 - k * 4, 420 + k * 34]);
  forma(g, '#7a4cb0', [80, 392, 20, 330, 280, 330, 300, 392]);
  forma(g, '#7a4cb0', [920, 392, 980, 330, 720, 330, 700, 392]);
}
function caixaDaDimensao(g, c, t) {
  const bob = Math.sin(t * 1.6 + c.n) * 4;
  sombraNoChao(g, c.x + c.tam * 0.12, c.y + 2, c.tam * 0.62, c.tam * 0.14);
  const e = estado.caixas[c.n];
  const desde = e ? (Date.now() - e.desde) / 1000 : 9;
  const ab = e?.aberta ? Math.min(1, desde * 3) : e ? Math.max(0, 1 - desde * 3) : 0;
  if (ab <= 0 && sp(g, 'caixa-roxa', 'parado', c.x, c.y + bob, { t, largura: c.tam * 1.3, altura: c.tam * 1.25 })) return;
  caixaRoxa(g, c.x, c.y + bob, c.tam, ab);
  if (e?.aberta) surpresa(g, e.surpresa, c.x + c.tam * 0.12, c.y + bob - c.tam - 4, Math.min(1, desde / 4), t, e.cor || '#f29bbd');
}
function caixaVolta(g, t) {
  const c = CAIXA_VOLTA;
  const bob = Math.sin(t * 1.2) * 3;
  sombraNoChao(g, c.x + 10, c.y + 2, 54, 12);
  caixaRoxa(g, c.x, c.y + bob, c.tam, 0, '#6a3aa0');
  // A etiqueta do Pet Shop (com a patinha)
  ret(g, c.x - 32, c.y + bob - 60, 64, 34, '#f6efdc', 3);
  el(g, c.x - 18, c.y + bob - 43, 6, 5, '#8a5cc0');
  for (const [dx, dy] of [[-24, -51], [-18, -54], [-12, -51]]) el(g, c.x + dx, c.y + bob + dy, 2.2, 2.4, '#8a5cc0');
  texto(g, 'Pet', c.x + 8, c.y + bob - 50, { cor: '#4a2a7a', fonte: '700 10px "Cinzel", Georgia, serif' });
  texto(g, 'Shop', c.x + 8, c.y + bob - 38, { cor: '#4a2a7a', fonte: '700 10px "Cinzel", Georgia, serif' });
  brilho(g, c.x, c.y - 40, 90, 'rgba(200,160,255,A)', 0.2 + Math.sin(t * 2) * 0.06);
}
function animarCaixas(g, t) {
  // Caixas flutuando lá longe, girando devagar
  for (let k = 0; k < 9; k++) {
    const x = ((k * 137 + t * (6 + (k % 3) * 4)) % (W + 120)) - 60;
    const y = 60 + ((k * 71) % 260) + Math.sin(t * 0.7 + k) * 12;
    g.save(); g.translate(x, y); g.rotate(t * 0.15 * (k % 2 ? 1 : -1) + k);
    g.globalAlpha = 0.45 + (k % 3) * 0.15;
    caixaRoxa(g, 0, 10, 14 + (k % 4) * 8, (k % 4 === 0) ? 1 : 0, ['#8a5cc0', '#a77ad8', '#6a3aa0'][k % 3]);
    g.restore();
  }
  particulas(g, 26, t, { semente: 31, vel: 10, vento: 20, y0: 0, y1: 420, subir: true, cor: k => (k % 2 ? 'rgba(255,200,255,0.7)' : 'rgba(200,180,255,0.6)'), r: 1.8 });
}

/* ═══════════════ As salas ═══════════════ */

const saida = (destino, rotulo) => ({ x0: 420, y0: 555, x1: 580, y1: 600, ir: [500, 585], acao: `sala:${destino}`, rotulo });

const salas = {
  qg: {
    fundo: fundoQg, animar: animarQg,
    objetos: [
      { y: 478, desenhar: (g, t) => vitrineGadgets(g, 300, 478, t) },
      { y: 470, desenhar: (g, t) => mesaTelefone(g, 640, 470, t) },
    ],
    pontos: [
      { x0: 18, y0: 196, x1: 140, y1: 405, ir: [95, 445], acao: 'sala:petshop', rotulo: 'Elevador secreto (Pet Shop)' },
      { x0: 884, y0: 196, x1: 990, y1: 405, ir: [915, 445], acao: 'sala:caldeira', rotulo: 'Escotilha da Sala da Caldeira' },
      { x0: 736, y0: 46, x1: 876, y1: 294, ir: [805, 420], acao: 'missao', rotulo: 'Missão do dia' },
      { x0: 272, y0: 28, x1: 728, y1: 282, ir: [500, 420], acao: 'telefone', rotulo: 'Mapa da ilha' },
      { x0: 600, y0: 390, x1: 680, y1: 480, ir: [640, 500], acao: 'telefone', rotulo: 'Telefone Espião' },
      { x0: 240, y0: 380, x1: 360, y1: 485, ir: [300, 505], acao: 'gadget', rotulo: 'Vitrine de equipamentos' },
      { x0: 146, y0: 46, x1: 270, y1: 270, ir: [210, 420], acao: 'raposo', rotulo: 'Monitores da Guarda' },
    ],
  },
  caldeira: {
    fundo: fundoCaldeira, animar: animarCaldeira,
    objetos: [
      { y: 488, desenhar: (g, t) => caixaJornais(g, 250, 488, t) },
      { y: 432, desenhar: g => baldeCarvao(g, 330, 432) },
    ],
    pontos: [
      { x0: 18, y0: 100, x1: 178, y1: 405, ir: [125, 430], acao: 'sala:danca', rotulo: 'Subir para o Salão de Dança' },
      { x0: 850, y0: 200, x1: 996, y1: 412, ir: [890, 435], acao: 'sala:piscina', rotulo: 'Túnel para a Piscina' },
      { x0: 710, y0: 318, x1: 832, y1: 406, ir: [770, 420], acao: 'duto', rotulo: 'Duto de ventilação' },
      { x0: 380, y0: 60, x1: 620, y1: 400, ir: [500, 425], acao: 'caldeira', rotulo: 'Caldeira' },
      { x0: 200, y0: 400, x1: 300, y1: 492, ir: [250, 505], acao: 'jornal', rotulo: 'Jornais antigos da ilha' },
      { x0: 680, y0: 142, x1: 728, y1: 170, ir: [700, 420], acao: 'tijolo', rotulo: 'Hum?' },
    ],
  },
  patio_dojo: {
    fundo: fundoPatio, animar: animarPatio,
    objetos: [
      { y: 430, desenhar: (g, t) => cerejeira(g, 190, 430, t) },
      { y: 412, desenhar: (g, t) => lanternaPedra(g, 392, 412, t) },
      { y: 412, desenhar: (g, t) => lanternaPedra(g, 608, 412, t) },
      { y: 552, desenhar: (g, t) => lanternaPedra(g, 930, 552, t) },
      { y: 570, desenhar: g => bonecoDeNeve(g, 660, 570) },
    ],
    pontos: [
      { x0: 428, y0: 222, x1: 572, y1: 396, ir: [500, 410], acao: 'sala:dojo', rotulo: 'Entrar no Dojo' },
      { x0: 0, y0: 405, x1: 110, y1: 580, ir: [45, 490], acao: 'sala:vila_esqui', rotulo: 'Vila de Esqui' },
      { x0: 100, y0: 230, x1: 280, y1: 420, ir: [230, 440], acao: 'cerejeira', rotulo: 'Cerejeira' },
    ],
  },
  dojo: {
    fundo: fundoDojo, animar: animarDojo,
    objetos: [{ y: 352, desenhar: (g, t) => sensei(g, 500, 352, t) }],
    pontos: [
      saida('patio_dojo', 'Voltar ao Pátio'),
      { x0: 64, y0: 128, x1: 206, y1: 364, ir: [140, 385], acao: 'portaNinja:fogo', rotulo: 'Dojo do Fogo' },
      { x0: 214, y0: 128, x1: 356, y1: 364, ir: [290, 385], acao: 'portaNinja:agua', rotulo: 'Dojo da Água' },
      { x0: 644, y0: 128, x1: 786, y1: 364, ir: [710, 385], acao: 'portaNinja:neve', rotulo: 'Dojo da Neve' },
      { x0: 830, y0: 110, x1: 952, y1: 350, ir: [880, 390], acao: 'portaNinja:esconderijo', rotulo: 'Um pergaminho antigo' },
      { x0: 440, y0: 250, x1: 560, y1: 362, ir: [500, 388], acao: 'sensei', rotulo: 'Falar com o Sensei' },
      { x0: 370, y0: 436, x1: 630, y1: 524, ir: [500, 480], acao: 'desafio', rotulo: 'Desafio Ninja' },
    ],
  },
  dojo_fogo: {
    fundo: fundoFogo, animar: animarFogo,
    objetos: [
      { y: 410, desenhar: (g, t) => pedestal(g, 500, 410, 'fogo', t) },
      { y: 440, desenhar: (g, t) => braseiro(g, 170, 440, t) },
      { y: 440, desenhar: (g, t) => braseiro(g, 830, 440, t) },
    ],
    pontos: [saida('dojo', 'Voltar ao Dojo'), { x0: 400, y0: 290, x1: 600, y1: 414, ir: [500, 430], acao: 'desafio:fogo', rotulo: 'Desafio do Fogo' }],
  },
  dojo_agua: {
    fundo: fundoAgua, animar: animarAgua,
    objetos: [
      { y: 410, desenhar: (g, t) => pedestal(g, 500, 410, 'agua', t) },
      { y: 450, desenhar: (g, t) => bicaBambu(g, 170, 450, t) },
      { y: 460, desenhar: g => pedraMusgo(g, 840, 460) },
    ],
    pontos: [saida('dojo', 'Voltar ao Dojo'), { x0: 400, y0: 290, x1: 600, y1: 414, ir: [500, 430], acao: 'desafio:agua', rotulo: 'Desafio da Água' }],
  },
  dojo_neve: {
    fundo: fundoNeve, animar: animarNeve,
    objetos: [
      { y: 410, desenhar: (g, t) => pedestal(g, 500, 410, 'neve', t) },
      { y: 450, desenhar: (g, t) => pilarGelo(g, 150, 450, t) },
      { y: 450, desenhar: (g, t) => pilarGelo(g, 850, 450, t) },
    ],
    pontos: [saida('dojo', 'Voltar ao Dojo'), { x0: 400, y0: 290, x1: 600, y1: 414, ir: [500, 430], acao: 'desafio:neve', rotulo: 'Desafio da Neve' }],
  },
  esconderijo_ninja: {
    fundo: fundoEsconderijo, animar: animarEsconderijo,
    objetos: [
      { y: 470, desenhar: (g, t) => boneco(g, 330, 470, t, 1) },
      { y: 520, desenhar: (g, t) => boneco(g, 660, 520, t, 2) },
    ],
    pontos: [
      saida('dojo', 'Voltar ao Dojo'),
      { x0: 756, y0: 96, x1: 950, y1: 392, ir: [830, 410], acao: 'gongo', rotulo: 'Bater o gongo' },
      { x0: 296, y0: 340, x1: 364, y1: 476, ir: [380, 480], acao: 'boneco:1', rotulo: 'Boneco de treino' },
      { x0: 626, y0: 390, x1: 694, y1: 526, ir: [710, 530], acao: 'boneco:2', rotulo: 'Boneco de treino' },
      { x0: 56, y0: 106, x1: 264, y1: 350, ir: [160, 410], acao: 'pergaminho', rotulo: 'Pergaminhos ninja' },
    ],
  },
  dimensao_caixas: {
    fundo: fundoCaixas, animar: animarCaixas,
    objetos: [
      { y: CAIXA_VOLTA.y, desenhar: caixaVolta },
      ...CAIXAS.map(c => ({ y: c.y, desenhar: (g, t) => caixaDaDimensao(g, c, t) })),
    ],
    pontos: [
      { x0: CAIXA_VOLTA.x - 50, y0: CAIXA_VOLTA.y - 110, x1: CAIXA_VOLTA.x + 64, y1: CAIXA_VOLTA.y + 6, ir: [500, 420], acao: 'caixaVolta', rotulo: 'Caixa do Pet Shop' },
      ...CAIXAS.map(c => ({ x0: c.x - c.tam / 2 - 6, y0: c.y - c.tam - 24, x1: c.x + c.tam * 0.75, y1: c.y + 6, ir: [c.x, Math.min(570, c.y + 16)], acao: `caixa:${c.n}`, rotulo: 'Uma caixa roxa' })),
    ],
  },
};

/* ═══════════════ Informações do mapa ═══════════════ */

const info = {
  qg: { nome: 'QG da Guarda Secreta do Coelho', desc: 'Telas, a Missão do dia e o Telefone Espião. A entrada é segredo.', regiao: 'segredos', icone: 'olho', mapa: null },
  caldeira: { nome: 'Sala da Caldeira', desc: 'Embaixo do Salão de Dança: canos, vapor e jornais antigos.', regiao: 'segredos', icone: 'fogo', mapa: null },
  patio_dojo: { nome: 'Pátio do Dojo', desc: 'Um jardim na neve, com a cerejeira e as lanternas de pedra.', regiao: 'segredos', icone: 'lanterna', mapa: { x: 885, y: 232 } },
  dojo: { nome: 'Dojo', desc: 'O Sensei e o Desafio Ninja. Vença para ganhar faixas.', regiao: 'segredos', icone: 'espada', mapa: { x: 918, y: 150 } },
  dojo_fogo: { nome: 'Dojo do Fogo', desc: 'Um vulcão sobre a lava. Abre na faixa laranja.', regiao: 'segredos', icone: 'fogo', mapa: null },
  dojo_agua: { nome: 'Dojo da Água', desc: 'Uma cachoeira mística. Abre na faixa azul.', regiao: 'segredos', icone: 'gota', mapa: null },
  dojo_neve: { nome: 'Dojo da Neve', desc: 'Uma arena de gelo acima das nuvens. Abre na faixa roxa.', regiao: 'segredos', icone: 'estrela', mapa: null },
  esconderijo_ninja: { nome: 'Esconderijo Ninja', desc: 'O treino secreto das faixas pretas.', regiao: 'segredos', icone: 'mascara', mapa: null },
  dimensao_caixas: { nome: 'Dimensão das Caixas', desc: 'Caixas roxas flutuando no nada. Abra e veja.', regiao: 'segredos', icone: 'presente', mapa: null },
};

/* ═══════════════ As ações dos pontos de clique ═══════════════ */

const sortear = lista => lista[Math.floor(Math.random() * lista.length)];
const GADGETS = [
  'Óculos de visão noturna: para ver o Raposo no escuro.',
  'A lupa da Guarda: acha pegadas de raposa a um quilômetro.',
  'O rádio-cenoura: parece lanche, mas fala com o QG.',
  'Botas de neve silenciosas: nem os Pompons escutam você chegando.',
];
const INFORMES = [
  'Radar: tudo calmo na ilha. Calmo demais...',
  'Informe: o Raposo foi visto perto do farol, com um saco de cenouras.',
  'Informe: pegadas de raposa na neve, indo para a mina.',
  'Informe: alguém mexeu nos jornais da Sala da Caldeira. Fique de olho.',
  'Informe: um Pompom roxo sumiu numa caixa do Pet Shop. De novo.',
];
const PERGAMINHOS = [
  'Pergaminho: "O ninja que corre tropeça. O que espera, vence."',
  'Pergaminho: "Guarde a carta forte para quando ela importar."',
  'Pergaminho: "Repare no que o outro já ganhou. Ele precisa de um elemento só."',
  'Pergaminho: "Até a neve mais fria derrete diante de um fogo paciente."',
  'Pergaminho: "Coelho calado, orelhas atentas."',
];

function fraseDaFaixa(f) {
  if (f <= 0) return 'Você ainda não tem faixa. Vença o Desafio Ninja no círculo vermelho e eu lhe dou a faixa branca.';
  if (f >= FAIXA_MAX) return 'Faixa preta! Você é um verdadeiro ninja. O pergaminho antigo agora se abre para você.';
  const prox = Object.entries(FAIXA_PARA).find(([, n]) => n > f);
  const dica = prox ? ` Na ${nomeDaFaixa(prox[1])}, ${prox[0] === 'esconderijo' ? 'um segredo se abre' : `abre o Dojo ${prox[0] === 'agua' ? 'da Água' : prox[0] === 'fogo' ? 'do Fogo' : 'da Neve'}`}.` : '';
  return `Você tem a ${nomeDaFaixa(f)}. Vença mais uma vez para ganhar a ${nomeDaFaixa(f + 1)}.${dica}`;
}

const NOME_PORTA = { fogo: 'o Dojo do Fogo', agua: 'o Dojo da Água', neve: 'o Dojo da Neve' };

const acoes = {
  async missao(ctx) {
    const { abrirMissao } = await import('./segredos-jogos.js');
    abrirMissao({ visual: ctx.visual, terminar: (jogo, pontos) => ctx.terminarMinijogo(jogo, pontos) });
  },
  async telefone(ctx) {
    const lista = Object.entries(INFO_SALAS).filter(([id, i]) => i && i.mapa && id !== ctx.sala).map(([id, i]) => ({ id, nome: i.nome, desc: i.desc, regiao: i.regiao || 'centro' }));
    const { abrirTelefone } = await import('./segredos-jogos.js');
    abrirTelefone({ salas: lista, aoEscolher: id => { ctx.aviso(`Teletransporte! Indo para ${INFO_SALAS[id]?.nome || id}.`); ctx.irPara(id); } });
  },
  gadget(ctx) { ctx.aviso(sortear(GADGETS)); },
  raposo(ctx) { ctx.aviso(sortear(INFORMES)); },
  duto(ctx) {
    ctx.aviso('Você engatinha pelo duto apertado... e sai no QG da Guarda Secreta do Coelho!');
    ctx.irPara('qg');
  },
  caldeira(ctx) {
    estado.caldeira = Date.now();
    ctx.aviso('Pssssh! Você põe mais carvão e a caldeira solta um vapor quentinho.');
  },
  async jornal() {
    const { abrirJornal } = await import('./segredos-jogos.js');
    abrirJornal();
  },
  tijolo(ctx) {
    estado.tijolo = true;
    ctx.aviso('Atrás do tijolo solto tem um bilhete: "A Guarda Secreta passa pelo duto de ventilação. Não conte para o Raposo."');
  },
  cerejeira(ctx) {
    estado.cerejeira = Date.now();
    ctx.aviso('Uma chuva de pétalas! Uma caiu bem no seu nariz.');
  },
  async sensei(ctx) {
    const f = await lerFaixa(ctx);
    estado.faixa = f;
    falar(fraseDaFaixa(f), 9000);
  },
  async desafio(ctx, variante = '') {
    const v = ['fogo', 'agua', 'neve'].includes(variante) ? variante : '';
    let faixa = await lerFaixa(ctx);
    estado.faixa = faixa;
    if (v && faixa < FAIXA_PARA[v]) {
      ctx.aviso(`O Desafio ${v === 'agua' ? 'da Água' : v === 'fogo' ? 'do Fogo' : 'da Neve'} pede a ${nomeDaFaixa(FAIXA_PARA[v])}.`, 'erro');
      return;
    }
    if (!v) falar('Que comece o Desafio! Lembre: fogo vence neve, neve vence água, água vence fogo.', 5000);
    const { abrirDesafioNinja } = await import('./segredos-jogos.js');
    abrirDesafioNinja({
      visual: ctx.visual, variante: v, faixa,
      terminar: (jogo, pontos) => ctx.terminarMinijogo(jogo, pontos),
      comecar: async () => {
        try { return (await ctx.progresso.gravar('ninja.desafio', 'comecar'))?.ficha || null; } catch { return null; }
      },
      subirFaixa: async ficha => {
        if (faixa >= FAIXA_MAX || !ficha) return { faixa, subiu: false };
        try {
          const nova = await ctx.progresso.gravar('ninja.faixa', { faixa: faixa + 1, ficha });
          faixa = Math.max(faixa, Math.floor(Number(nova) || 0));
          estado.faixa = faixa;
          falar(`Muito bem! Agora você tem a ${nomeDaFaixa(faixa)}.`, 9000);
          return { faixa, subiu: true };
        } catch {
          return { faixa, subiu: false };
        }
      },
    });
  },
  async portaNinja(ctx, alvo) {
    const f = await lerFaixa(ctx);
    estado.faixa = f;
    const precisa = FAIXA_PARA[alvo];
    if (precisa == null) return;
    if (f >= precisa) {
      if (alvo === 'esconderijo') ctx.aviso('Você puxa o pergaminho... e atrás dele tem uma passagem secreta!');
      ctx.irPara(alvo === 'esconderijo' ? 'esconderijo_ninja' : `dojo_${alvo}`);
      return;
    }
    if (alvo === 'esconderijo') {
      ctx.aviso('É só um pergaminho velho... ou não? Dizem que só uma faixa preta descobre o segredo.');
      falar('Esse pergaminho guarda um segredo. Volte quando tiver a faixa preta.');
      return;
    }
    ctx.aviso(`A porta não se mexe. Para entrar n${NOME_PORTA[alvo]} você precisa da ${nomeDaFaixa(precisa)} (você tem: ${nomeDaFaixa(f)}).`, 'erro');
    falar(`${NOME_PORTA[alvo][0].toUpperCase()}${NOME_PORTA[alvo].slice(1)} abre na ${nomeDaFaixa(precisa)}. Treine no Desafio Ninja!`);
  },
  gongo(ctx) {
    estado.gongo = Date.now();
    ctx.aviso('GONNNG! O som ecoa pelo esconderijo inteiro.');
  },
  boneco(ctx, n) {
    estado.boneco[n] = Date.now();
    ctx.aviso(sortear(['Hai-ya! Um golpe perfeito.', 'Pof! O boneco balança e volta.', 'Chute de coelho! O boneco nem viu.']));
  },
  pergaminho(ctx) { ctx.aviso(sortear(PERGAMINHOS)); },
  caixa(ctx, n) {
    const antes = estado.caixas[n];
    if (antes?.aberta) {
      estado.caixas[n] = { ...antes, aberta: false, desde: Date.now() };
      return;
    }
    const s = sortear(SURPRESAS);
    estado.caixas[n] = { aberta: true, desde: Date.now(), surpresa: s.id, cor: sortear(CORES_POMPOM) };
    ctx.aviso(s.texto);
  },
  caixaVolta(ctx) {
    ctx.aviso('Você entra na caixa, fecha a tampa... e sai pela caixa estranha do Pet Shop!');
    ctx.irPara('petshop');
  },
};

/* ═══════════════ Sprites (veja sprites.js) ═══════════════ */

const PARADO = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const peca = (chave, nome, desc, largura, altura, animacoes, previa, extra = {}) => ({
  chave: `ilha-segredos.${chave}`, jogo: 'Club Coelho: Ilha', nome, desc, largura, altura, ancora: 'pe', animacoes, previa, ...extra,
});
export const SPRITES = [
  peca('sensei', 'Sensei do Dojo', 'O velho mestre do Dojo, sentado na almofada: barba comprida, chapéu de palha, quimono e cajado. Olhando para a direita. A sombra e o balão de fala continuam feitos pelo jogo.',
    90, 120, [{ id: 'parado', nome: 'Parado', quadros: 2, fps: 2 }], (g, a, t) => senseiCorpo(g, 0, 0, t)),
  peca('lanterna-pedra', 'Lanterna de pedra', 'As lanternas de pedra do Pátio do Dojo, com neve em cima. O brilho da luz continua feito pelo jogo.',
    54, 110, [{ id: 'acesa', nome: 'Acesa', quadros: 1, fps: 1 }], g => lanternaPedraCorpo(g, 0, 0)),
  peca('cerejeira', 'Cerejeira na neve', 'A cerejeira florida do Pátio do Dojo. As pétalas que caem continuam feitas pelo jogo.',
    230, 250, PARADO, g => cerejeiraCorpo(g, 0, 0)),
  peca('boneco-treino', 'Boneco de treino', 'Os bonecos de palha do Esconderijo Ninja. O jogo faz ele balançar quando alguém bate.',
    60, 130, PARADO, g => bonecoCorpo(g)),
  peca('telefone-espiao', 'Telefone Espião', 'O Telefone Espião na mesinha do QG da Guarda Secreta. O brilho azul continua feito pelo jogo.',
    70, 110, [{ id: 'brilhando', nome: 'Brilhando', quadros: 2, fps: 3 }], (g, a, t) => telefoneCorpo(g, 0, 0, t)),
  peca('vitrine-gadgets', 'Vitrine de equipamentos', 'A vitrine do QG com os óculos de visão noturna, a lupa e o rádio-cenoura.',
    120, 96, PARADO, (g, a, t) => vitrineGadgetsCorpo(g, 0, 0, t)),
  peca('jornais', 'Jornais antigos', 'O caixote com a pilha de jornais velhos da Sala da Caldeira.',
    96, 96, PARADO, g => jornaisCorpo(g, 0, 0)),
  peca('caixa-roxa', 'Caixa roxa fechada', 'As caixas da Dimensão das Caixas, fechadas (o tamanho muda de caixa para caixa). Aberta, o jogo desenha as abas e a surpresa.',
    80, 76, PARADO, g => caixaRoxa(g, -6, 0, 60, 0)),
];
registrarPecas(SPRITES);

registrarRegiao({ id: 'segredos', salas, info, acoes });

// Para os testes e para quem precisar das peças daqui.
export const _segredos = { salas, info, acoes, CAIXAS, SURPRESAS, fraseDaFaixa, falaDoSensei, naOrigem };
