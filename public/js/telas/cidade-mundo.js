// A vila do Lyendell Dorme desenhada num canvas: cada jogador tem um coelho que anda (setas, W A S D ou
// clicando no chão) e uma toca com o nome dele. Dia e noite, fogueira na praça, vaga-lumes, falas em
// balões e emotes. O servidor (src/cidade-mundo.js) decide quem enxerga quem: de noite cada um só vê a si
// mesmo (os Raposos se veem, como raposas); os mortos viram fantasmas que só os mortos veem.

import { h, trocar } from '../core.js';
import { enviar } from '../tempo-real.js';
import { PELOS, sorte, elipse, sombrear, desenharCoelho, desenharRaposa, desenharFantasma, desenharArvore, quebrarTexto } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, temSprite, aoMudarSprites } from '../sprites.js';

export { desenharCoelho };

// Sprite enviado em #/recreacao/sprites para uma peça da vila (false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `vila.${peca}`, anim, x, y, o);

// As mesmas medidas de src/cidade-mundo.js.
export const W = 1600;
export const H = 1000;
export const CENTRO = { x: 800, y: 520 };
export { PELOS };
export const NOMES_PELO = ['Creme', 'Caramelo', 'Chocolate', 'Neve', 'Café', 'Mel', 'Cinza', 'Rosado'];
export const ACESSORIOS = { nenhum: 'Nada', laco: 'Laço', chapeu: 'Chapéu de palha', flores: 'Coroa de flores', cachecol: 'Cachecol', oculos: 'Óculos', coroa: 'Coroa' };
export const EMOTES = { oi: '👋', coracao: '❤️', risada: '😂', susto: '😱', pergunta: '❓', zzz: '💤' };
// Cor de cada toca (a bandeirinha), pela ordem de quem entrou.
const CORES = ['#d8b13a', '#d8674a', '#5aa0d8', '#b77be6', '#7fb069', '#e48ab8', '#4fa39b', '#e0884a', '#8f9ad8', '#c46bd8', '#9bc25a', '#d85a7a', '#5ac2d8', '#b0905a', '#e0d05a'];
export const corDoJogador = i => CORES[i % CORES.length];

export function toca(i, n) {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
  return { x: Math.round(CENTRO.x + Math.cos(a) * 620), y: Math.round(CENTRO.y + Math.sin(a) * 360) };
}
export function porta(i, n) {
  const t = toca(i, n);
  return { x: Math.round(t.x + (CENTRO.x - t.x) * 0.1), y: Math.round(t.y + 40 + (CENTRO.y - t.y) * 0.06) };
}

const VEL = 230; // unidades por segundo
const NOITE = new Set(['papeis', 'noite']);
const RAPOSOS = new Set(['raposo', 'alfa', 'farejadora']);
const ICONE_ACAO = { atacar: '🐾', farejar: '👃', investigar: '👁', proteger: '✚', guardar: '🛡', vigiar: '🔦', matar: '🐱', agua: '💧', flechar: '💘', veneno: '☠', votar: '✋', atirar: '🎯' };

function desenharToca(g, i, n, nome, cor, morto) {
  const { x, y } = toca(i, n);
  elipse(g, x, y + 22, 60, 16, 'rgba(0,0,0,0.22)');
  // Com sprite, a bandeirinha da cor do dono continua por cima (ela diz de quem é a toca).
  if (sp(g, 'toca', morto ? 'morto' : 'normal', x, y + 30, { quadro: 0 })) bandeirinha(g, x, y, cor);
  else corpoDaToca(g, x, y, i, cor, morto);
  placaDaToca(g, x, y, nome, cor);
  // Quem morreu: uma lápide com flores na porta
  if (morto && !sp(g, 'lapide', 'parado', x + 22, y + 34, { quadro: 0 })) lapide(g, x, y);
}
function bandeirinha(g, x, y, cor) {
  g.fillStyle = cor;
  g.beginPath(); g.moveTo(x + 41, y - 14); g.lineTo(x + 54, y - 9); g.lineTo(x + 41, y - 4); g.closePath(); g.fill();
}
// O morro com a porta redonda e a lanterna (x, y: o meio da toca).
function corpoDaToca(g, x, y, i, cor, morto) {
  const morro = g.createRadialGradient(x - 14, y - 16, 6, x, y, 60);
  morro.addColorStop(0, morto ? '#6f7a62' : '#6fa055');
  morro.addColorStop(1, morto ? '#465040' : '#3e6b35');
  g.fillStyle = morro;
  g.beginPath();
  g.ellipse(x, y + 4, 56, 36, 0, Math.PI, 0);
  g.lineTo(x + 56, y + 18);
  g.quadraticCurveTo(x, y + 30, x - 56, y + 18);
  g.closePath();
  g.fill();
  // Florzinhas no morro
  const rnd = sorte(i * 97 + 13);
  for (let k = 0; k < 6; k++) elipse(g, x - 40 + rnd() * 80, y - 20 + rnd() * 20, 1.8, 1.8, ['#f0a0c0', '#f4dd80', '#ffffff'][k % 3]);
  // A porta redonda
  elipse(g, x, y + 12, 21, 17, '#6b4f33');
  elipse(g, x, y + 14, 15, 13, '#1a120b');
  elipse(g, x, y + 22, 13, 4, '#2a1d12');
  // Lanterna com a bandeirinha da cor do dono
  g.fillStyle = '#4a3420';
  g.fillRect(x + 38, y - 14, 3, 34);
  if (cor) bandeirinha(g, x, y, cor);
  elipse(g, x + 39.5, y - 17, 4.5, 5, '#f4dd80');
}
// Placa com o nome, em cima do morro
function placaDaToca(g, x, y, nome, cor) {
  const texto = nome.length > 16 ? `${nome.slice(0, 15)}…` : nome;
  g.font = '700 13px "EB Garamond", Georgia, serif';
  const lw = Math.max(50, g.measureText(texto).width + 16);
  g.fillStyle = '#4a3420';
  g.fillRect(x - lw / 2 + 7, y - 46, 3, 18);
  g.fillRect(x + lw / 2 - 10, y - 46, 3, 18);
  g.fillStyle = '#8a6a44';
  g.beginPath();
  g.roundRect ? g.roundRect(x - lw / 2, y - 64, lw, 20, 4) : g.rect(x - lw / 2, y - 64, lw, 20);
  g.fill();
  g.strokeStyle = '#5b4228';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = cor;
  g.fillRect(x - lw / 2 + 4, y - 61, 3, 14);
  g.fillStyle = '#fbf3e0';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, x + 2, y - 53.5);
}
function lapide(g, x, y) {
  g.fillStyle = '#9aa0a6';
  g.beginPath();
  g.moveTo(x + 14, y + 30); g.lineTo(x + 14, y + 12); g.quadraticCurveTo(x + 22, y + 2, x + 30, y + 12); g.lineTo(x + 30, y + 30);
  g.closePath(); g.fill();
  g.fillStyle = '#6b7178';
  g.fillRect(x + 18, y + 16, 8, 1.6);
  g.fillRect(x + 18, y + 20, 8, 1.6);
  elipse(g, x + 12, y + 31, 2.2, 2.2, '#f0a0c0');
  elipse(g, x + 33, y + 31, 2.2, 2.2, '#f4dd80');
}

// O chão da vila: grama, caminhos, praça, lago, horta e árvores (desenhado uma vez e guardado).
function desenharCenario(g, jogadores, e) {
  const n = jogadores.length;
  const rnd = sorte(2026);
  g.fillStyle = '#3a6a3a';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) {
    const x = rnd() * W;
    const y = rnd() * H;
    elipse(g, x, y, 10 + rnd() * 40, 6 + rnd() * 20, rnd() < 0.5 ? 'rgba(20,50,20,0.10)' : 'rgba(150,200,110,0.07)');
  }
  g.strokeStyle = 'rgba(30,70,30,0.45)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 1400; k++) {
    const x = rnd() * W;
    const y = rnd() * H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 4 - rnd() * 4); g.stroke();
  }
  if (!sp(g, 'lago', 'parado', 250, 830, { quadro: 0 })) lago(g);
  if (!sp(g, 'horta', 'parado', 1340, 212, { quadro: 0 })) horta(g);
  // Canteiros de flores
  for (let k = 0; k < 40; k++) {
    const x = 80 + rnd() * (W - 160);
    const y = 80 + rnd() * (H - 160);
    const dx = (x - CENTRO.x) / 620;
    const dy = (y - CENTRO.y) / 360;
    const d = Math.hypot(dx, dy);
    if (d > 0.82 && d < 1.2) continue; // longe das tocas
    for (let f = 0; f < 5; f++) elipse(g, x + rnd() * 26, y + rnd() * 14, 2, 2, ['#f0a0c0', '#f4dd80', '#ffffff', '#b0a0f0'][Math.floor(rnd() * 4)]);
  }
  // Caminho em volta da praça e um até cada toca
  g.strokeStyle = '#8b7651';
  g.lineCap = 'round';
  g.lineWidth = 34;
  g.beginPath(); g.ellipse(CENTRO.x, CENTRO.y, 520, 290, 0, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < n; i++) {
    const p = porta(i, n);
    g.lineWidth = 24;
    g.beginPath(); g.moveTo(CENTRO.x + (p.x - CENTRO.x) * 0.25, CENTRO.y + (p.y - CENTRO.y) * 0.25); g.lineTo(p.x, p.y - 6); g.stroke();
  }
  g.strokeStyle = 'rgba(180,160,120,0.35)';
  g.lineWidth = 3;
  g.setLineDash([8, 12]);
  g.beginPath(); g.ellipse(CENTRO.x, CENTRO.y, 520, 290, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  // A praça de pedra, a pedra do conselho e a bandeira da Casa Luckham
  elipse(g, CENTRO.x, CENTRO.y, 150, 104, '#7f776a');
  elipse(g, CENTRO.x, CENTRO.y, 140, 96, '#9a917f');
  g.strokeStyle = 'rgba(70,60,50,0.25)';
  g.lineWidth = 1.5;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.beginPath(); g.moveTo(CENTRO.x + Math.cos(a) * 46, CENTRO.y + Math.sin(a) * 32); g.lineTo(CENTRO.x + Math.cos(a) * 140, CENTRO.y + Math.sin(a) * 96); g.stroke();
  }
  elipse(g, CENTRO.x, CENTRO.y, 46, 32, '#a9a08d');
  if (!sp(g, 'pedra-conselho', 'parado', CENTRO.x, CENTRO.y + 96, { quadro: 0 })) pedraDoConselho(g, CENTRO.x, CENTRO.y);
  for (const [bx, by] of [[-110, -50], [110, -50], [-120, 40], [120, 40]]) {
    if (!sp(g, 'banco', 'parado', CENTRO.x + bx, CENTRO.y + by + 14, { quadro: 0 })) banco(g, CENTRO.x + bx, CENTRO.y + by);
  }
  if (!sp(g, 'bandeira', 'parado', CENTRO.x + 182, CENTRO.y - 40, { quadro: 0 })) bandeira(g, CENTRO.x, CENTRO.y);
  // As tocas
  jogadores.forEach((p, i) => desenharToca(g, i, n, p.nome, corDoJogador(i), !!e && e.jogadores[i] && !e.jogadores[i].vivo && e.fase !== 'papeis'));
  // A floresta em volta (longe das tocas)
  const arvores = [];
  for (let k = 0; k < 140; k++) {
    const borda = k < 110;
    const x = borda ? (rnd() < 0.5 ? rnd() * W : (rnd() < 0.5 ? rnd() * 90 : W - rnd() * 90)) : 100 + rnd() * (W - 200);
    const y = borda ? (x < 90 || x > W - 90 ? rnd() * H : (rnd() < 0.5 ? rnd() * 80 : H - rnd() * 60)) : 100 + rnd() * (H - 200);
    const longe = (px, py, d) => Math.hypot(x - px, (y - py) * 1.3) > d;
    if (!longe(CENTRO.x, CENTRO.y, 600)) continue;
    let ok = true;
    for (let i = 0; i < n && ok; i++) { const tc = toca(i, n); ok = longe(tc.x, tc.y, 120); }
    if (ok && longe(250, 830, 180) && longe(1340, 160, 140)) arvores.push([x, y, 26 + rnd() * 22]);
  }
  arvores.sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => {
    if (!temSprite('vila.arvore')) { desenharArvore(g, x, y, r, rnd); return; }
    rnd(); // a cor que a árvore de sempre sortearia (para o resto do sorteio continuar igual)
    elipse(g, x, y + r * 0.55, r * 0.9, r * 0.28, 'rgba(0,0,0,0.25)');
    sp(g, 'arvore', 'parado', x, y + r * 0.55, { quadro: 0, escala: r / 36 });
  });
}

// As partes do cenário (nas coordenadas da vila).
function lago(g) {
  // Lago com vitórias-régias, embaixo à esquerda
  elipse(g, 250, 830, 150, 78, '#2e5f7a');
  elipse(g, 250, 826, 138, 68, '#3b7896');
  for (const [lx, ly] of [[200, 810], [290, 840], [240, 860], [320, 805]]) {
    elipse(g, lx, ly, 13, 8, '#4f8f45');
    elipse(g, lx + 3, ly - 2, 2.5, 2.5, '#f0c0d8');
  }
}
function horta(g) {
  // Horta de cenouras, em cima à direita
  for (let r = 0; r < 4; r++) {
    g.fillStyle = '#6b4f33';
    g.fillRect(1240, 120 + r * 26, 200, 14);
    for (let c = 0; c < 9; c++) {
      elipse(g, 1252 + c * 22, 126 + r * 26, 4, 3, '#e07a2a');
      elipse(g, 1252 + c * 22, 119 + r * 26, 3, 5, '#5aa04a');
    }
  }
}
// cx, cy: o meio da praça.
function pedraDoConselho(g, cx, cy) {
  elipse(g, cx, cy + 96, 34, 12, '#6f685c');
  elipse(g, cx, cy + 93, 32, 10, '#8c8475');
}
// x, y: o meio do assento.
function banco(g, x, y) {
  g.fillStyle = '#6b4f33';
  g.fillRect(x - 22, y, 44, 8);
  g.fillStyle = '#4a3420';
  g.fillRect(x - 18, y + 8, 4, 6);
  g.fillRect(x + 14, y + 8, 4, 6);
}
// A bandeira da Casa Luckham, ao lado da praça (cx, cy: o meio da praça).
function bandeira(g, cx, cy) {
  g.fillStyle = '#4a3420';
  g.fillRect(cx + 150, cy - 150, 4, 110);
  g.fillStyle = '#1f4a2a';
  g.beginPath(); g.moveTo(cx + 154, cy - 148); g.lineTo(cx + 214, cy - 140); g.lineTo(cx + 204, cy - 124); g.lineTo(cx + 214, cy - 108); g.lineTo(cx + 154, cy - 112); g.closePath(); g.fill();
  g.font = '700 22px serif';
  g.fillStyle = '#e8c24a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('🐇', cx + 182, cy - 129);
}
// A árvore de sempre (de desenho-coelho.js) sem a sombra, para a prévia. x, y: o pé do tronco.
function arvoreSemSombra(g, x, y, r) {
  g.fillStyle = '#5b3c22';
  g.fillRect(x - r * 0.13, y - r * 0.55, r * 0.26, r * 0.55);
  const verde = '#2f6b34';
  const meio = y - r * 0.55;
  elipse(g, x, meio - r * 0.15, r, r * 0.85, verde);
  elipse(g, x - r * 0.35, meio - r * 0.35, r * 0.55, r * 0.5, sombrear(verde, 0.12));
  elipse(g, x + r * 0.3, meio - r * 0.5, r * 0.4, r * 0.36, sombrear(verde, 0.2));
}

function desenharFogueira(g, t, forca = 1) {
  const { x, y } = CENTRO;
  elipse(g, x, y + 6, 26, 8, 'rgba(0,0,0,0.3)');
  if (forca > 0 && sp(g, 'fogueira', 'acesa', x, y + 12, { t })) return;
  corpoDaFogueira(g, x, y, t, forca);
}
// A lenha e o fogo (x, y: o meio da fogueira).
function corpoDaFogueira(g, x, y, t, forca) {
  for (const [dx, rot] of [[-8, 0.5], [8, -0.5], [0, 0]]) {
    g.save(); g.translate(x + dx, y + 2); g.rotate(rot);
    g.fillStyle = '#5b3c22'; g.fillRect(-16, -3, 32, 6);
    g.restore();
  }
  if (forca <= 0) return;
  const tremor = k => Math.sin(t * 13 + k) * 2 + Math.sin(t * 7.3 + k * 2) * 1.5;
  g.save();
  g.globalAlpha = 0.9;
  elipse(g, x + tremor(1) * 0.5, y - 12, 13 * forca, 20 * forca + tremor(2), '#e0682a');
  elipse(g, x + tremor(3) * 0.6, y - 10, 9 * forca, 14 * forca + tremor(4), '#f4b03a');
  elipse(g, x + tremor(5) * 0.4, y - 7, 5 * forca, 8 * forca, '#fff1a8');
  g.restore();
  for (let k = 0; k < 4; k++) {
    const fase = (t * 0.8 + k * 0.27) % 1;
    elipse(g, x + Math.sin(k * 3 + t * 2) * 10, y - 22 - fase * 50, 1.6, 1.6, `rgba(255,200,90,${1 - fase})`);
  }
}

/* ─── O mundo ─────────────────────────────────────── */

// aoClicar({ k, tipo: 'coelho' | 'toca' | 'chao', x, y, sx, sy }): o jogo decide o que fazer.
// nomeDoPapel(p): o nome da classe, para o aviso do começo da partida.
export function criarMundo(id, { aoClicar, nomeDoPapel = p => p }) {
  const tela = h('canvas', { class: 'vila-tela', tabindex: '0', 'aria-label': 'A vila do Lyendell Dorme. Ande com as setas ou W A S D, ou clique no chão.' });
  const g = tela.getContext('2d');
  const banner = h('div', { class: 'vila-banner', hidden: true });
  const dica = h('div', { class: 'vila-dica' });
  const botaoZoom = h('button', { type: 'button', class: 'vila-zoom', title: 'Ver a vila toda / seguir o meu coelho' }, 'Ver a vila toda');
  const el = h('div', { class: 'vila' }, tela, banner, dica, botaoZoom);

  let s = null;
  let meuId = null;
  let cenario = null;
  let chaveCenario = '';
  let local = null; // o meu coelho (eu decido onde ele está; o servidor só repassa)
  let andarPara = null;
  let enviadoEm = 0;
  let ultimoEnviado = '';
  let verTudo = false;
  const teclas = new Set();
  const coelhos = new Map(); // id -> { x, y, d, tx, ty, passo, andando }
  const baloes = new Map();
  const emotes = new Map();
  let destaques = { tocas: new Set(), coelhos: new Set(), icone: '' };
  let luz = 0;
  let cam = { x: CENTRO.x, y: CENTRO.y, z: 0.8 };
  let quadro = 0;
  let antes = performance.now();
  let faseVista = null;
  const diarioVisto = new Set();
  const chaveDiario = d => `${d.dia}|${d.fase}|${d.texto}`;
  let bannerAte = 0;
  const vagalumes = Array.from({ length: 28 }, (_, k) => ({ x: 120 + ((k * 397) % (W - 240)), y: 100 + ((k * 211) % (H - 200)), f: k * 1.7 }));

  botaoZoom.addEventListener('click', () => {
    verTudo = !verTudo;
    botaoZoom.textContent = verTudo ? 'Seguir o meu coelho' : 'Ver a vila toda';
  });

  const indiceDe = uid => (s ? s.jogadores.findIndex(p => p.id === uid) : -1);
  const e = () => s?.estado || null;
  const jogando = () => s?.status === 'jogando' && !!s.estado;
  const visualDe = (uid, i) => s?.mundo?.visuais?.[uid] || { pelo: PELOS[i % PELOS.length], acessorio: 'nenhum' };
  const souJogador = () => !!s && s.eu >= 0 && !s.jogadores[s.eu]?.saiu;

  function tamanho() {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    return { w: r.width, h: r.height, dpr };
  }

  function prepararCenario() {
    const est = e();
    const mortos = est ? est.jogadores.map(j => (j.vivo ? 1 : 0)).join('') : '';
    const chave = `${s.jogadores.map(p => p.nome).join('|')}#${mortos}#${est?.fase === 'papeis' ? 'p' : ''}`;
    if (chave === chaveCenario && cenario) return;
    chaveCenario = chave;
    cenario ??= document.createElement('canvas');
    cenario.width = W;
    cenario.height = H;
    desenharCenario(cenario.getContext('2d'), s.jogadores, est);
  }

  // Pontos de interesse para clicar ou apertar E.
  function coelhoNoPonto(x, y) {
    let melhor = null;
    let dist = 30;
    for (const [uid, c] of coelhos) {
      const d = Math.hypot(c.x - x, c.y - 22 - y);
      if (d < dist) { dist = d; melhor = uid; }
    }
    if (local && meuId && Math.hypot(local.x - x, local.y - 22 - y) < dist) melhor = meuId;
    return melhor;
  }
  function tocaNoPonto(x, y) {
    const n = s.jogadores.length;
    for (let i = 0; i < n; i++) {
      const t = toca(i, n);
      if (Math.abs(x - t.x) < 60 && y > t.y - 66 && y < t.y + 34) return i;
    }
    return -1;
  }

  function telaParaMundo(cx, cy) {
    const r = tela.getBoundingClientRect();
    return { x: cam.x + (cx - r.left - r.width / 2) / cam.z, y: cam.y + (cy - r.top - r.height / 2) / cam.z };
  }

  tela.addEventListener('click', ev => {
    if (!s) return;
    tela.focus({ preventScroll: true });
    const p = telaParaMundo(ev.clientX, ev.clientY);
    const r = tela.getBoundingClientRect();
    const info = { x: p.x, y: p.y, sx: ev.clientX - r.left, sy: ev.clientY - r.top };
    const uid = coelhoNoPonto(p.x, p.y);
    if (uid != null && uid !== meuId) { aoClicar({ ...info, tipo: 'coelho', k: indiceDe(uid) }); return; }
    const k = tocaNoPonto(p.x, p.y);
    if (k >= 0) { aoClicar({ ...info, tipo: 'toca', k }); return; }
    aoClicar({ ...info, tipo: 'chao' });
  });

  // Teclado: andar, E para interagir com o que está perto, 1 a 6 para os emotes.
  const DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const digitando = ev => ev.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo');
  const aoApertar = ev => {
    if (!s || digitando(ev) || !el.isConnected) return;
    if (DIRS[ev.code]) {
      if (!local) return;
      teclas.add(ev.code);
      andarPara = null;
      ev.preventDefault();
      return;
    }
    if (ev.code === 'KeyE' && local) {
      const uid = coelhoNoPonto(local.x + 30 * local.d, local.y - 10) ?? [...coelhos.keys()].find(u => Math.hypot(coelhos.get(u).x - local.x, coelhos.get(u).y - local.y) < 60);
      const r = tela.getBoundingClientRect();
      const sx = r.width / 2;
      const sy = r.height / 2;
      if (uid != null && uid !== meuId) { aoClicar({ tipo: 'coelho', k: indiceDe(uid), x: local.x, y: local.y, sx, sy }); return; }
      const n = s.jogadores.length;
      let perto = -1;
      let dist = 110;
      for (let i = 0; i < n; i++) { const t = porta(i, n); const d = Math.hypot(t.x - local.x, t.y - local.y); if (d < dist) { dist = d; perto = i; } }
      if (perto >= 0) aoClicar({ tipo: 'toca', k: perto, x: local.x, y: local.y, sx, sy });
      return;
    }
    const emote = Object.keys(EMOTES)[Number(ev.key) - 1];
    if (emote && souJogador()) emotar(emote);
  };
  const aoSoltar = ev => teclas.delete(ev.code);
  const aoSairDaJanela = () => teclas.clear();
  document.addEventListener('keydown', aoApertar);
  document.addEventListener('keyup', aoSoltar);
  window.addEventListener('blur', aoSairDaJanela);

  function emotar(emote) {
    enviar('cidade:emote', { id, e: emote }, { silencioso: true });
  }

  // O meu coelho anda até um ponto (e, chegando, faz alguma coisa).
  function andarAte(x, y, depois) {
    if (!local) return;
    andarPara = { x: Math.max(24, Math.min(W - 24, x)), y: Math.max(40, Math.min(H - 16, y)), depois };
  }

  function mover(dt) {
    if (!local || !souJogador()) return;
    let dx = 0;
    let dy = 0;
    for (const k of teclas) { dx += DIRS[k][0]; dy += DIRS[k][1]; }
    if (!dx && !dy && andarPara) {
      const ax = andarPara.x - local.x;
      const ay = andarPara.y - local.y;
      const d = Math.hypot(ax, ay);
      if (d < 8) {
        const depois = andarPara.depois;
        andarPara = null;
        depois?.();
      } else { dx = ax / d; dy = ay / d; }
    }
    const tam = Math.hypot(dx, dy);
    local.andando = tam > 0;
    if (tam > 0) {
      local.x = Math.max(24, Math.min(W - 24, local.x + (dx / tam) * VEL * dt));
      local.y = Math.max(40, Math.min(H - 16, local.y + (dy / tam) * VEL * dt));
      if (dx) local.d = dx > 0 ? 1 : -1;
      local.passo += dt;
    }
    const agora = performance.now();
    const chave = `${Math.round(local.x)},${Math.round(local.y)},${local.d}`;
    if (chave !== ultimoEnviado && agora - enviadoEm > 90) {
      ultimoEnviado = chave;
      enviadoEm = agora;
      enviar('cidade:mover', { id, x: Math.round(local.x), y: Math.round(local.y), d: local.d }, { silencioso: true });
    }
  }

  function seguirCamera(dt, w, hh) {
    const caber = Math.min(w / W, hh / H);
    const alvoZ = verTudo || !local ? caber : Math.max(caber, Math.min(1.15, Math.max(0.6, w / 1100)));
    cam.z += (alvoZ - cam.z) * Math.min(1, dt * 4);
    const meioW = w / 2 / cam.z;
    const meioH = hh / 2 / cam.z;
    let tx = verTudo || !local ? CENTRO.x : local.x;
    let ty = verTudo || !local ? H / 2 : local.y - 20;
    tx = meioW * 2 >= W ? W / 2 : Math.max(meioW, Math.min(W - meioW, tx));
    ty = meioH * 2 >= H ? H / 2 : Math.max(meioH, Math.min(H - meioH, ty));
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  }

  function nivelDeLuz() {
    const est = e();
    if (!est || !jogando()) return 0;
    return { papeis: 1, noite: 1, amanhecer: 0.4, dia: 0, execucao: 0.3, cacador: 0.35 }[est.fase] ?? 0;
  }

  function desenhar(t) {
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    if (!s || !el.isConnected) { quadro = requestAnimationFrame(desenhar); return; }
    const { w, h: hh, dpr } = tamanho();
    mover(dt);
    for (const c of coelhos.values()) {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      c.andando = Math.hypot(dx, dy) > 1.5;
      if (c.andando) { c.passo += dt; if (Math.abs(dx) > 0.5) c.d = dx > 0 ? 1 : -1; }
      c.x += dx * Math.min(1, dt * 10);
      c.y += dy * Math.min(1, dt * 10);
    }
    seguirCamera(dt, w, hh);
    luz += (nivelDeLuz() - luz) * Math.min(1, dt * 1.5);
    prepararCenario();
    const tt = t / 1000;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#16301b';
    g.fillRect(0, 0, w, hh);
    g.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (w / 2 - cam.x * cam.z), dpr * (hh / 2 - cam.y * cam.z));
    g.drawImage(cenario, 0, 0);
    desenharMarcas(tt);
    desenharFogueira(g, tt, 1);
    desenharLinhasDeVoto();
    desenharCoelhos(tt);
    if (luz > 0.3) desenharVagalumes(tt);
    desenharFalas(tt);
    // A noite: escuro azulado, com a luz da fogueira, das lanternas e em volta do meu coelho.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (luz > 0.02) desenharNoite(w, hh, tt);
    quadro = requestAnimationFrame(desenhar);
  }

  const mundoParaTela = (x, y, w, hh) => [(x - cam.x) * cam.z + w / 2, (y - cam.y) * cam.z + hh / 2];

  function desenharNoite(w, hh, tt) {
    const est = e();
    const morto = est && s.eu >= 0 && !est.jogadores[s.eu]?.vivo;
    const forca = luz * (morto ? 0.5 : 0.88);
    luzes ??= document.createElement('canvas');
    if (luzes.width !== tela.width || luzes.height !== tela.height) { luzes.width = tela.width; luzes.height = tela.height; }
    const l = luzes.getContext('2d');
    const dpr = tela.width / w;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, luzes.width, luzes.height);
    l.fillStyle = est?.fase === 'amanhecer' ? `rgba(60,30,50,${forca})` : `rgba(8,12,38,${forca})`;
    l.fillRect(0, 0, luzes.width, luzes.height);
    l.globalCompositeOperation = 'destination-out';
    const furo = (x, y, r, a = 1) => {
      const [sx, sy] = mundoParaTela(x, y, w, hh);
      const rr = r * cam.z * dpr;
      const gr = l.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, rr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = gr;
      l.beginPath();
      l.arc(sx * dpr, sy * dpr, rr, 0, Math.PI * 2);
      l.fill();
    };
    furo(CENTRO.x, CENTRO.y - 10, 230 + Math.sin(tt * 9) * 6, 0.95);
    const n = s.jogadores.length;
    for (let i = 0; i < n; i++) { const tc = toca(i, n); furo(tc.x + 30, tc.y - 20, 95, 0.7); }
    if (local) furo(local.x, local.y - 20, 130, 0.85);
    g.drawImage(luzes, 0, 0, w, hh);
    // Brilho quente da fogueira por cima
    const [fx, fy] = mundoParaTela(CENTRO.x, CENTRO.y - 10, w, hh);
    const brilho = g.createRadialGradient(fx, fy, 0, fx, fy, 200 * cam.z);
    brilho.addColorStop(0, `rgba(255,170,80,${0.18 * luz})`);
    brilho.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = brilho;
    g.fillRect(0, 0, w, hh);
  }
  let luzes = null;

  function desenharVagalumes(tt) {
    for (const v of vagalumes) {
      const x = v.x + Math.sin(tt * 0.6 + v.f) * 40;
      const y = v.y + Math.cos(tt * 0.5 + v.f * 1.3) * 26;
      const a = (Math.sin(tt * 3 + v.f) + 1) / 2;
      if (sp(g, 'vagalume', 'voando', x, y, { t: tt + v.f, alpha: a * luz })) continue;
      elipse(g, x, y, 6, 6, `rgba(244,230,120,${0.12 * a * luz})`);
      elipse(g, x, y, 1.8, 1.8, `rgba(250,240,150,${0.9 * a * luz})`);
    }
  }

  function desenharMarcas(tt) {
    const est = e();
    const n = s.jogadores.length;
    const pulso = (Math.sin(tt * 4) + 1) / 2;
    // Tocas onde dá para usar o poder agora
    for (const k of destaques.tocas) {
      const tc = toca(k, n);
      g.save();
      g.strokeStyle = `rgba(244,221,128,${0.45 + pulso * 0.45})`;
      g.lineWidth = 3;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.ellipse(tc.x, tc.y + 6, 64, 42, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    if (!est || !jogando()) return;
    // O que eu escolhi esta noite (só eu vejo) e as patas dos Raposos
    const icones = new Map();
    const pôr = (k, ic) => { if (k == null || k < 0) return; if (!icones.has(k)) icones.set(k, []); icones.get(k).push(ic); };
    for (const a of est.eu?.acoes || []) {
      if (a.tipo === 'votar' || a.tipo === 'atirar') continue;
      if (a.tipo === 'flechar') (a.escolhido || []).forEach(k => pôr(k, ICONE_ACAO.flechar));
      else if (a.tipo === 'pocoes') pôr(a.escolhido, ICONE_ACAO.veneno);
      else if (typeof a.escolhido === 'number') pôr(a.escolhido, ICONE_ACAO[a.tipo] || '•');
    }
    if (est.ataque?.votos) {
      const patas = {};
      for (const alvo of Object.values(est.ataque.votos)) if (alvo != null) patas[alvo] = (patas[alvo] || 0) + 1;
      for (const [k, q] of Object.entries(patas)) pôr(Number(k), `🐾${q > 1 ? q : ''}`);
    }
    g.font = '20px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [k, lista] of icones) {
      const tc = toca(k, n);
      const texto = [...new Set(lista)].join(' ');
      const largura = g.measureText(texto).width + 16;
      g.fillStyle = 'rgba(14,24,17,0.82)';
      g.beginPath();
      g.roundRect ? g.roundRect(tc.x - largura / 2, tc.y - 100, largura, 28, 14) : g.rect(tc.x - largura / 2, tc.y - 100, largura, 28);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(texto, tc.x, tc.y - 85);
    }
  }

  function posicaoDoCoelho(uid) {
    if (uid === meuId && local) return local;
    return coelhos.get(uid);
  }

  function desenharLinhasDeVoto() {
    const est = e();
    if (!est || !jogando() || !['dia', 'execucao'].includes(est.fase)) return;
    g.save();
    g.lineWidth = 2;
    g.setLineDash([5, 6]);
    est.jogadores.forEach((x, k) => {
      if (x.voto == null || x.voto < 0) return;
      const de = posicaoDoCoelho(s.jogadores[k]?.id);
      const para = posicaoDoCoelho(s.jogadores[x.voto]?.id);
      if (!de || !para) return;
      g.strokeStyle = corDoJogador(k);
      g.beginPath();
      g.moveTo(de.x, de.y - 20);
      g.lineTo(para.x, para.y - 20);
      g.stroke();
    });
    g.restore();
  }

  function desenharCoelhos(tt) {
    const est = e();
    const lista = [...coelhos.entries()].map(([uid, c]) => [uid, c]);
    if (local && meuId) lista.push([meuId, local]);
    lista.sort((a, b) => a[1].y - b[1].y);
    for (const [uid, c] of lista) {
      const i = indiceDe(uid);
      if (i < 0) continue;
      const j = est && jogando() ? est.jogadores[i] : null;
      // O executado e o Caçador que vai atirar ainda aparecem de corpo inteiro para todos.
      const destaque = !!j && ((est.fase === 'execucao' && est.executado === i) || (est.fase === 'cacador' && est.cacadorDaVez === i));
      const fantasma = !!j && !j.vivo && !destaque;
      const raposa = !!est && jogando() && NOITE.has(est.fase) && !!j && j.vivo && ((i === s.eu && RAPOSOS.has(est.eu?.papel)) || j.aliado);
      const vis = visualDe(uid, i);
      if (destaques.coelhos.has(i)) {
        const p = (Math.sin(tt * 5) + 1) / 2;
        elipse(g, c.x, c.y + 1, 22 + p * 3, 7 + p, `rgba(244,221,128,${0.35 + p * 0.35})`);
      }
      if (uid === meuId) elipse(g, c.x, c.y + 1, 19, 6, 'rgba(244,221,128,0.35)');
      if (est?.fase === 'execucao' && est.executado === i) {
        const luzCentro = g.createRadialGradient(c.x, c.y - 20, 0, c.x, c.y - 20, 90);
        luzCentro.addColorStop(0, 'rgba(255,240,200,0.45)');
        luzCentro.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = luzCentro;
        g.fillRect(c.x - 90, c.y - 110, 180, 180);
      }
      if (fantasma) desenharFantasma(g, c.x, c.y, { dir: c.d, t: tt + i });
      else if (raposa) desenharRaposa(g, c.x, c.y, { dir: c.d, passo: c.passo, andando: c.andando, t: tt + i });
      else desenharCoelho(g, c.x, c.y, { ...vis, dir: c.d, passo: c.passo, andando: c.andando, t: tt + i });
      // Nome (e quantos votos tem)
      const nome = s.jogadores[i].nome;
      g.font = '700 12px "EB Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const votos = est && jogando() && ['dia', 'execucao'].includes(est.fase) ? est.votos?.[i] || 0 : 0;
      const texto = votos ? `${nome}  ✋${votos}` : nome;
      const lw = g.measureText(texto).width + 12;
      g.fillStyle = uid === meuId ? 'rgba(216,177,58,0.92)' : raposa ? 'rgba(160,70,30,0.9)' : 'rgba(14,24,17,0.75)';
      g.beginPath();
      g.roundRect ? g.roundRect(c.x - lw / 2, c.y - 70, lw, 16, 8) : g.rect(c.x - lw / 2, c.y - 70, lw, 16);
      g.fill();
      g.fillStyle = uid === meuId ? '#1b1403' : '#fbf3e0';
      g.fillText(texto, c.x, c.y - 61.5);
    }
  }

  function desenharFalas(tt) {
    const agora = Date.now();
    g.font = '13px "EB Garamond", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [uid, b] of baloes) {
      if (b.ate < agora) { baloes.delete(uid); continue; }
      const c = posicaoDoCoelho(uid);
      if (!c) continue;
      const linhas = quebrarTexto(g, b.texto, 170);
      const lw = Math.max(...linhas.map(l => g.measureText(l).width)) + 18;
      const lh = linhas.length * 16 + 10;
      const x = c.x;
      const y = c.y - 78 - lh;
      g.globalAlpha = Math.min(1, (b.ate - agora) / 600);
      g.fillStyle = b.canal === 'raposos' ? '#fbe2cf' : b.canal === 'mortos' ? '#dfe8ff' : '#fffaf0';
      g.strokeStyle = b.canal === 'raposos' ? '#d8743a' : b.canal === 'mortos' ? '#7f93d8' : '#8a6a44';
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect ? g.roundRect(x - lw / 2, y, lw, lh, 9) : g.rect(x - lw / 2, y, lw, lh);
      g.fill();
      g.stroke();
      g.beginPath(); g.moveTo(x - 6, y + lh); g.lineTo(x, y + lh + 8); g.lineTo(x + 6, y + lh); g.closePath(); g.fill();
      g.fillStyle = '#2a2016';
      linhas.forEach((l, k) => g.fillText(l, x, y + 13 + k * 16));
      g.globalAlpha = 1;
    }
    g.font = '24px serif';
    for (const [uid, m] of emotes) {
      if (m.ate < agora) { emotes.delete(uid); continue; }
      const c = posicaoDoCoelho(uid);
      if (!c) continue;
      const vida = 1 - (m.ate - agora) / 2600;
      g.globalAlpha = vida > 0.8 ? (1 - vida) * 5 : 1;
      g.fillText(EMOTES[m.e] || '', c.x + 18, c.y - 82 - Math.sin(Math.min(1, vida * 3) * Math.PI) * 10 - vida * 14);
      g.globalAlpha = 1;
    }
    void tt;
  }

  // Grande aviso no meio da tela quando a fase muda.
  function mostrarBanner(titulo, texto, classe = '') {
    trocar(banner, h('strong', null, titulo), texto && h('span', null, texto));
    banner.className = `vila-banner ${classe}`.trim();
    banner.hidden = false;
    bannerAte = Date.now() + 4200;
    setTimeout(() => { if (Date.now() >= bannerAte - 50) banner.hidden = true; }, 4300);
  }

  /* ─── Entradas de fora ─── */

  function atualizar(nova, { destaquesNovos } = {}) {
    s = nova;
    meuId = s.eu >= 0 ? s.jogadores[s.eu]?.id : null;
    if (!meuId) local = null;
    if (destaquesNovos) destaques = destaquesNovos;
    const est = s.estado;
    const fase = s.status === 'jogando' && est ? `${est.fase}:${est.dia}` : s.status;
    if (fase !== faseVista) {
      const antiga = faseVista;
      faseVista = fase;
      const novas = (est?.diario || []).filter(d => !diarioVisto.has(chaveDiario(d)));
      novas.forEach(d => diarioVisto.add(chaveDiario(d)));
      if (antiga && s.status === 'jogando' && est) avisarFase(est, novas);
    }
    dica.textContent = !meuId ? 'Você está assistindo a vila.'
      : s.status === 'esperando' ? 'Ande pela vila com as setas ou W A S D (ou clique no chão). Teclas 1 a 6: emotes.'
        : '';
    dica.hidden = !dica.textContent;
  }

  function avisarFase(est, novas) {
    const mortes = novas.filter(d => d.tipo === 'morte').map(d => d.texto);
    switch (est.fase) {
      case 'papeis': mostrarBanner('Anoitece em Lyendell', est.eu ? `Você é ${nomeDoPapel(est.eu.papel)}. Não conte a ninguém!` : 'Cada um olha a sua carta em segredo...', 'noite'); break;
      case 'noite': mostrarBanner(`Noite ${est.dia}`, est.eu?.acoes?.length ? 'Use o seu poder: clique na toca de alguém (ou vá até lá e aperte E).' : 'A vila dorme. Cada um na sua toca...', 'noite'); break;
      case 'amanhecer': mostrarBanner(`Amanhece o dia ${est.dia}`, mortes.length ? mortes.join(' ') : 'Ninguém morreu esta noite!', 'manha'); break;
      case 'dia': mostrarBanner('Hora de conversar e votar', 'Clique no coelho de quem você acha que é Raposo.', 'dia'); break;
      case 'execucao': mostrarBanner('A vila decidiu', mortes.slice(-1)[0] || novas.slice(-1)[0]?.texto || 'Ninguém foi executado hoje.', 'execucao'); break;
      case 'cacador': mostrarBanner('O Caçador caiu!', 'Antes de cair, ele escolhe em quem atirar.', 'execucao'); break;
      case 'fim': mostrarBanner('Fim de jogo', est.vencedores?.texto || '', 'fim'); break;
      default: break;
    }
  }

  function receberPos({ p, tp = [] }) {
    const vistos = new Set();
    const pularPara = new Set(tp);
    for (const [uid, x, y, d] of p) {
      vistos.add(uid);
      if (uid === meuId) {
        if (!local || pularPara.has(uid)) { local = { x, y, d, passo: 0, andando: false }; andarPara = null; }
        continue;
      }
      const c = coelhos.get(uid);
      if (!c || pularPara.has(uid)) coelhos.set(uid, { x, y, d, tx: x, ty: y, passo: 0, andando: false });
      else { c.tx = x; c.ty = y; if (Math.hypot(c.tx - c.x, c.ty - c.y) > 400) { c.x = x; c.y = y; } }
    }
    for (const uid of [...coelhos.keys()]) if (!vistos.has(uid)) coelhos.delete(uid);
  }

  function receberEmote({ de, e: emote }) {
    emotes.set(de, { e: emote, ate: Date.now() + 2600 });
  }

  // Fala do chat vira balão em cima do coelho (se eu enxergo o coelho).
  function balao(m) {
    if (m.de == null || !s) return;
    const uid = s.jogadores[m.de]?.id;
    if (!uid) return;
    baloes.set(uid, { texto: m.texto.length > 120 ? `${m.texto.slice(0, 117)}…` : m.texto, canal: m.canal, ate: Date.now() + 6500 });
  }

  quadro = requestAnimationFrame(desenhar);
  // Chegou ou mudou um sprite: o chão guardado da vila (tocas, árvores...) é desenhado de novo.
  const tirarSprites = aoMudarSprites(() => { chaveCenario = ''; });

  return {
    el, atualizar, receberPos, receberEmote, balao, andarAte, emotar,
    porta: k => porta(k, s.jogadores.length),
    pertoDe: k => { const c = posicaoDoCoelho(s.jogadores[k]?.id); return c ? { x: c.x - 34, y: c.y + 6 } : null; },
    parar() {
      tirarSprites();
      cancelAnimationFrame(quadro);
      document.removeEventListener('keydown', aoApertar);
      document.removeEventListener('keyup', aoSoltar);
      window.removeEventListener('blur', aoSairDaJanela);
    },
  };
}

// Um coelho parado num canvas pequeno (a escolha do visual na sala de espera).
export function previaDoCoelho(visual) {
  const c = h('canvas', { class: 'vila-previa', width: 120, height: 120 });
  const g = c.getContext('2d');
  g.scale(2, 2);
  desenharCoelho(g, 30, 52, { ...visual, dir: 1 });
  return c;
}

/* ─── Sprites (veja sprites.js) ───────────────────── */
// A raposa e o fantasma estão em desenho-coelho.js. Cada prévia é o desenho de sempre, sem sprite, com a
// âncora da peça em (0, 0).
const NO_CHAO = ' Faz parte do chão da vila, então fica parado (vale só o primeiro quadro).';
const PARADA = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const vila = (chave, nome, desc, largura, altura, animacoes, previa, extra = {}) => ({
  chave: `vila.${chave}`, jogo: 'Lyendell Dorme', nome, desc, largura, altura, ancora: 'pe', animacoes, previa, ...extra,
});
const naOrigem = (g, x, y, f) => { g.save(); g.translate(-x, -y); f(); g.restore(); };

export const SPRITES = [
  vila('toca', 'Toca do jogador', `A toca de cada jogador: o morro com a porta redonda e a lanterna. A placa com o nome e a bandeirinha da cor do dono continuam por cima, feitas pelo jogo. "Toca de quem morreu" é a de quem já morreu (o jogo põe a lápide na porta).${NO_CHAO}`,
    112, 64, [{ id: 'normal', nome: 'Toca', quadros: 1, fps: 1 }, { id: 'morto', nome: 'Toca de quem morreu', quadros: 1, fps: 1 }],
    (g, anim) => corpoDaToca(g, 0, -30, 0, null, anim === 'morto')),
  vila('lapide', 'Lápide', `A lápide com flores na porta da toca de quem morreu.${NO_CHAO}`,
    28, 28, PARADA, g => lapide(g, -22, -34)),
  vila('arvore', 'Árvore', `As árvores da floresta em volta da vila (o jogo muda o tamanho de cada uma). A sombra continua feita pelo jogo.${NO_CHAO}`,
    72, 56, PARADA, g => arvoreSemSombra(g, 0, 0, 36)),
  vila('fogueira', 'Fogueira', 'A fogueira no meio da praça. A sombra e a luz em volta, de noite, continuam feitas pelo jogo.',
    52, 84, [{ id: 'acesa', nome: 'Acesa', quadros: 4, fps: 8 }], (g, anim, t) => corpoDaFogueira(g, 0, -12, t, 1)),
  vila('bandeira', 'Bandeira da Casa Luckham', `O mastro com a bandeira verde ao lado da praça.${NO_CHAO}`,
    64, 110, PARADA, g => bandeira(g, -182, 40)),
  vila('banco', 'Banco da praça', `Os quatro banquinhos em volta da fogueira.${NO_CHAO}`,
    44, 14, PARADA, g => banco(g, 0, -14)),
  vila('pedra-conselho', 'Pedra do conselho', `A pedra chata na frente da fogueira.${NO_CHAO}`,
    68, 26, PARADA, g => pedraDoConselho(g, 0, -96), { ancora: 'centro' }),
  vila('horta', 'Horta de cenouras', `A horta com quatro fileiras de cenouras, lá em cima à direita.${NO_CHAO}`,
    200, 100, PARADA, g => naOrigem(g, 1340, 212, () => horta(g))),
  vila('lago', 'Lago', `O lago com vitórias-régias, embaixo à esquerda (visto de cima).${NO_CHAO}`,
    300, 156, PARADA, g => naOrigem(g, 250, 830, () => lago(g)), { ancora: 'centro' }),
  vila('vagalume', 'Vaga-lume', 'Os vaga-lumes que voam de noite. O jogo acende e apaga cada um (deixando mais ou menos transparente).',
    12, 12, [{ id: 'voando', nome: 'Voando', quadros: 1, fps: 4 }],
    g => { elipse(g, 0, 0, 6, 6, 'rgba(244,230,120,0.12)'); elipse(g, 0, 0, 1.8, 1.8, 'rgba(250,240,150,0.9)'); }, { ancora: 'centro' }),
];
registrarPecas(SPRITES);

// Para os testes: os desenhos que não dependem da tela.
export const _desenhos = { desenharCenario, desenharToca, desenharFogueira };
