// Desenhos à mão (canvas) que vários jogos usam: o coelho da Casa Luckham com pelo e acessório, a raposa,
// o fantasma, árvores e utilidades (cores, texto em balão, números "aleatórios" com semente).
// Não usa nada da página (DOM): dá para importar de qualquer jogo e testar no Node.

import { desenharParte, roupaDoAcessorio } from './roupas-coelho.js';
import { registrarPecas, desenharSprite, temSprite } from './sprites.js';

// As peças daqui que podem virar sprite (veja sprites.js). O coelho vale para todos os jogos que usam este desenho.
export const SPRITES = [
  {
    chave: 'coelho', jogo: 'Todos os jogos', nome: 'Coelho do jogador',
    desc: 'O coelho de cada pessoa em quase todos os jogos (Travessia, Barris, Pac-Coelho, Festa, Club Coelho, vila). Olhando para a direita; as roupas do Club Coelho continuam por cima. Marque "pintar com a cor do pelo" para cada um ter a sua cor (desenhe em tons claros de cinza).',
    largura: 44, altura: 56, ancora: 'pe', tingir: true,
    animacoes: [
      { id: 'parado', nome: 'Parado', quadros: 2, fps: 3 },
      { id: 'andando', nome: 'Andando', quadros: 4, fps: 10 },
      { id: 'dancando', nome: 'Dançando', quadros: 4, fps: 8 },
      { id: 'sentado', nome: 'Sentado', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => desenharCoelho(g, 0, 0, { andando: anim === 'andando', passo: t, t, pose: anim === 'dancando' ? 'dancando' : anim === 'sentado' ? 'sentado' : null, semSprite: true }),
  },
  {
    chave: 'raposa', jogo: 'Lyendell Dorme', nome: 'Raposa da noite',
    desc: 'Como os Raposos aparecem de noite na vila do Lyendell Dorme. Olhando para a direita.',
    largura: 60, altura: 44, ancora: 'pe',
    animacoes: [{ id: 'parado', nome: 'Parada', quadros: 2, fps: 3 }, { id: 'andando', nome: 'Andando', quadros: 4, fps: 10 }],
    previa: (g, anim, t) => desenharRaposa(g, 0, 0, { andando: anim === 'andando', passo: t, t, semSprite: true }),
  },
  {
    chave: 'fantasma', jogo: 'Lyendell Dorme', nome: 'Fantasma',
    desc: 'Quem morreu no Lyendell Dorme vira fantasma (só os mortos veem). O jogo já deixa meio transparente.',
    largura: 32, altura: 56, ancora: 'pe',
    animacoes: [{ id: 'flutuando', nome: 'Flutuando', quadros: 4, fps: 6 }],
    previa: (g, anim, t) => desenharFantasma(g, 0, 0, { t, semSprite: true }),
  },
];
registrarPecas(SPRITES);

export const PELOS = ['#e9dcc3', '#c99a6b', '#8a6a4f', '#f7f3ea', '#5b4a3f', '#d9b48a', '#9aa3ad', '#e2b3a3'];

// Números "aleatórios" sempre iguais para a mesma semente.
export function sorte(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function elipse(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}

// Um coelho de pé, de lado (dir 1 = olhando para a direita). (x, y) é onde ficam os pés.
// roupa: { cabeca, rosto, pescoco, costas, corpo, mao } (veja roupas-coelho.js); sem roupa, vale o acessório
// antigo (um só). pose: 'dancando' ou 'sentado'.
export function desenharCoelho(g, x, y, { pelo = PELOS[0], acessorio = 'nenhum', roupa = null, dir = 1, passo = 0, andando = false, t = 0, pose = null, semSprite = false } = {}) {
  const r = roupa || roupaDoAcessorio(acessorio);
  // Sprite enviado: a imagem no lugar do corpo, e as roupas do Club Coelho por cima, como sempre.
  const anim = pose === 'dancando' ? 'dancando' : pose === 'sentado' ? 'sentado' : andando ? 'andando' : 'parado';
  if (!semSprite && temSprite('coelho')) {
    elipse(g, x, y + 1, 15, 4.5, 'rgba(0,0,0,0.28)');
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    desenharParte(g, 'costas', r.costas, t, pelo);
    desenharSprite(g, 'coelho', anim, 0, 0, { t: andando ? passo : t, cor: pelo });
    for (const parte of ['corpo', 'pescoco', 'rosto', 'cabeca', 'mao']) desenharParte(g, parte, r[parte], t, pelo);
    g.restore();
    return;
  }
  let pulo = andando ? Math.abs(Math.sin(passo * 9)) * 6 : Math.sin(t * 2) * 0.6;
  if (pose === 'dancando') pulo = Math.abs(Math.sin(t * 7)) * 8;
  if (pose === 'sentado') pulo = 0;
  g.save();
  elipse(g, x, y + 1, 16 - pulo * 0.6, 4.5, 'rgba(0,0,0,0.28)');
  g.translate(x, y - pulo);
  g.scale(dir, 1);
  if (pose === 'dancando') g.rotate(Math.sin(t * 7) * 0.12);
  if (pose === 'sentado') g.scale(1.06, 0.84);
  const escuro = sombrear(pelo, -0.18);
  desenharParte(g, 'costas', r.costas, t, pelo);
  // Rabinho, corpo, patas
  elipse(g, -16, -15, 5.5, 5.5, '#fbf8f1');
  elipse(g, 0, -13, 15, 11.5, pelo);
  elipse(g, 2, -9, 9, 6.5, sombrear(pelo, 0.12));
  desenharParte(g, 'corpo', r.corpo, t, pelo);
  const pata = andando ? Math.sin(passo * 9) * 3 : 0;
  elipse(g, -7 + pata, -2.5, 6, 3.4, escuro);
  elipse(g, 7 - pata, -2.5, 6, 3.4, escuro);
  // Cabeça e orelhas
  elipse(g, 11, -27, 9.5, 9, pelo);
  for (const [ox, rot] of [[6, -0.28], [11.5, 0.12]]) {
    elipse(g, ox, -43, 3.6, 10.5, pelo, rot);
    elipse(g, ox, -42, 1.6, 7.5, '#e9a7a0', rot);
  }
  elipse(g, 15, -28, 1.9, 2.1, '#1b1403');
  elipse(g, 15.6, -28.8, 0.6, 0.6, '#fff');
  elipse(g, 20, -24.5, 1.6, 1.3, '#e9867d');
  elipse(g, 12.5, -23, 2.4, 1.6, 'rgba(233,134,125,0.35)');
  desenharParte(g, 'pescoco', r.pescoco, t, pelo);
  desenharParte(g, 'rosto', r.rosto, t, pelo);
  desenharParte(g, 'cabeca', r.cabeca, t, pelo);
  desenharParte(g, 'mao', r.mao, t, pelo);
  g.restore();
}

// O acessório antigo (Lyendell Dorme): um item só, nas coordenadas do coelho.
export function desenharAcessorio(g, a, t = 0) {
  for (const [parte, id] of Object.entries(roupaDoAcessorio(a))) desenharParte(g, parte, id, t);
}

// De noite o Raposo vira raposa (só os outros Raposos veem).
export function desenharRaposa(g, x, y, { dir = 1, passo = 0, andando = false, t = 0, semSprite = false } = {}) {
  if (!semSprite && temSprite('raposa')) {
    elipse(g, x, y + 1, 18, 4.5, 'rgba(0,0,0,0.3)');
    desenharSprite(g, 'raposa', andando ? 'andando' : 'parado', x, y, { t: andando ? passo : t, dir });
    return;
  }
  const pulo = andando ? Math.abs(Math.sin(passo * 8)) * 4 : Math.sin(t * 2) * 0.5;
  g.save();
  elipse(g, x, y + 1, 18, 4.5, 'rgba(0,0,0,0.3)');
  g.translate(x, y - pulo);
  g.scale(dir, 1);
  // Rabo peludo com ponta branca
  elipse(g, -20, -16, 11, 6, '#d8743a', -0.5);
  elipse(g, -27, -21, 4.5, 3.5, '#fbf3e6', -0.5);
  elipse(g, 0, -13, 16, 9.5, '#d8743a');
  elipse(g, 4, -9, 9, 5, '#fbf3e6');
  const pata = andando ? Math.sin(passo * 8) * 3 : 0;
  for (const px of [-9 + pata, -3 - pata, 6 + pata, 11 - pata]) {
    g.fillStyle = '#3a2416';
    g.fillRect(px - 1.6, -6, 3.2, 6);
  }
  elipse(g, 13, -24, 8.5, 7.5, '#d8743a');
  g.fillStyle = '#d8743a';
  g.beginPath(); g.moveTo(17, -22); g.lineTo(26, -20); g.lineTo(17, -17); g.closePath(); g.fill();
  elipse(g, 25.5, -20, 1.6, 1.4, '#1b1403');
  for (const ox of [8, 15]) {
    g.fillStyle = '#d8743a';
    g.beginPath(); g.moveTo(ox - 4, -29); g.lineTo(ox, -40); g.lineTo(ox + 4, -29); g.closePath(); g.fill();
    g.fillStyle = '#3a2416';
    g.beginPath(); g.moveTo(ox - 2, -30); g.lineTo(ox, -37); g.lineTo(ox + 2, -30); g.closePath(); g.fill();
  }
  elipse(g, 15.5, -25, 1.6, 1.8, '#f4dd80');
  elipse(g, 15.8, -25, 0.7, 1.4, '#1b1403');
  g.restore();
}

// Quem morreu vira fantasma (só os mortos veem).
export function desenharFantasma(g, x, y, { dir = 1, t = 0, semSprite = false } = {}) {
  const flutua = Math.sin(t * 2.4) * 3;
  if (!semSprite && temSprite('fantasma')) {
    desenharSprite(g, 'fantasma', 'flutuando', x, y + flutua, { t, dir, alpha: 0.65 });
    return;
  }
  g.save();
  g.globalAlpha = 0.6;
  elipse(g, x, y + 1, 12, 3, 'rgba(120,160,255,0.25)');
  g.translate(x, y - 8 + flutua);
  g.scale(dir, 1);
  g.fillStyle = '#d6e6ff';
  g.beginPath();
  g.moveTo(-13, 0);
  for (let k = 0; k <= 4; k++) g.quadraticCurveTo(-13 + k * 6.5 + 3.2, (k % 2 ? 4 : -2) + Math.sin(t * 6 + k) * 1.5, -13 + (k + 1) * 6.5, 0);
  g.lineTo(13, -14);
  g.quadraticCurveTo(13, -30, 2, -32);
  g.quadraticCurveTo(-13, -30, -13, -14);
  g.closePath();
  g.fill();
  for (const [ox, rot] of [[-2, -0.25], [4, 0.12]]) elipse(g, ox, -40, 3, 9, '#d6e6ff', rot);
  elipse(g, 5, -21, 1.8, 2.4, '#3b4a78');
  elipse(g, -1, -21, 1.8, 2.4, '#3b4a78');
  g.restore();
  g.save();
  g.strokeStyle = 'rgba(244,221,128,0.7)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, y - 52 + flutua, 8, 2.6, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

export function sombrear(cor, k) {
  const n = parseInt(cor.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))));
  return `rgb(${c.join(',')})`;
}

export function desenharArvore(g, x, y, r, rnd) {
  elipse(g, x, y + r * 0.55, r * 0.9, r * 0.28, 'rgba(0,0,0,0.25)');
  g.fillStyle = '#5b3c22';
  g.fillRect(x - r * 0.13, y, r * 0.26, r * 0.55);
  const verde = ['#2f6b34', '#3a7a3c', '#2b5e2f'][Math.floor(rnd() * 3)];
  elipse(g, x, y - r * 0.15, r, r * 0.85, verde);
  elipse(g, x - r * 0.35, y - r * 0.35, r * 0.55, r * 0.5, sombrear(verde, 0.12));
  elipse(g, x + r * 0.3, y - r * 0.5, r * 0.4, r * 0.36, sombrear(verde, 0.2));
}

export function quebrarTexto(g, texto, max) {
  const palavras = texto.split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (g.measureText(tenta).width > max && atual) { linhas.push(atual); atual = p; } else atual = tenta;
    if (linhas.length === 3) break;
  }
  if (atual && linhas.length < 3) linhas.push(atual);
  return linhas;
}
