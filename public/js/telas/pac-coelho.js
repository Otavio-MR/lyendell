// Pac-Coelho: o coelho da Casa Luckham come as moedas (Lírios) e foge das raposas.
// Moeda grande deixa as raposas com medo por alguns segundos; a cenoura é o bônus.

import { h, trocar, icone, botao, cabecalho, aviso, get, post, pode, aoSair, estado, num } from '../core.js';
import { rt, ouvir, transmitir, enviarQuadro, pararTransmissao } from '../tempo-real.js';
import { juntoNoJogo } from '../junto.js';
import { segredosDoJogo } from '../segredos.js';
import { desenharParte } from '../roupas-coelho.js';
import { sombrear } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, temSprite, aoMudarSprites, nomeDe } from '../sprites.js';

const MAPA = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];
const COLS = 28;
const LINHAS = MAPA.length;
const T = 24; // tamanho de cada casa, em pixels
const W = COLS * T;
const H = LINHAS * T;

const CIMA = [0, -1];
const ESQ = [-1, 0];
const BAIXO = [0, 1];
const DIR = [1, 0];
const DIRS = [CIMA, ESQ, BAIXO, DIR]; // ordem de desempate das raposas
const nomeDir = ([x, y]) => (x ? (x > 0 ? 'direita' : 'esquerda') : y > 0 ? 'baixo' : 'cima');
const TECLAS = {
  ArrowUp: CIMA, KeyW: CIMA, ArrowDown: BAIXO, KeyS: BAIXO,
  ArrowLeft: ESQ, KeyA: ESQ, ArrowRight: DIR, KeyD: DIR,
};

const VEL = 9.5; // velocidade máxima, em casas por segundo
// Cada raposa caça de um jeito (como os fantasmas do Pac-Man original).
const RAPOSAS = [
  { nome: 'Rubra', cor: '#e2572f', canto: [25, -3], casa: null, solta: 0, jeito: 'Vai direto atrás de você.' },
  { nome: 'Ártica', cor: '#c3d6e2', canto: [2, -3], casa: [13.5, 14], solta: 1, jeito: 'Tenta chegar na sua frente.' },
  { nome: 'Cinzenta', cor: '#8a95a8', canto: [27, 31], casa: [11.5, 14], solta: 5, jeito: 'Cerca junto com a Rubra.' },
  { nome: 'Fenec', cor: '#e3a84c', canto: [0, 31], casa: [15.5, 14], solta: 9, jeito: 'Chega perto e depois foge.' },
];
const COR_BRASA = '#b8361f'; // a 5ª raposa, só no junto com 3 ou mais
// Alternância entre espalhar (cada uma vai para o seu canto) e perseguir, em segundos.
const FASES = [[7, 'dispersar'], [20, 'perseguir'], [7, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [Infinity, 'perseguir']];
const VALOR_CENOURA = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000];

function velocidades(nivel) {
  if (nivel === 1) return { pac: 0.8, raposa: 0.75, susto: 0.5, tunel: 0.4 };
  if (nivel <= 4) return { pac: 0.9, raposa: 0.85, susto: 0.55, tunel: 0.45 };
  return { pac: 1, raposa: 0.95, susto: 0.6, tunel: 0.5 };
}
const tempoDeSusto = nivel => Math.max(1.5, 7 - nivel);

const colunaCerta = x => ((x % COLS) + COLS) % COLS; // o túnel liga as duas pontas
const celula = (x, y) => (y < 0 || y >= LINHAS ? '#' : MAPA[y][colunaCerta(x)]);
const livre = (x, y) => { const c = celula(x, y); return c !== '#' && c !== '-'; };
const parede = (x, y) => (x < 0 || x >= COLS || y < 0 || y >= LINHAS ? true : MAPA[y][x] === '#');
const mesma = (a, b) => a[0] === b[0] && a[1] === b[1];
const contraria = (a, b) => a[0] === -b[0] && a[1] === -b[1];

/* ─── Desenho (o mesmo para quem joga e para quem assiste) ─── */

// As peças desenhadas à mão, em qualquer canvas (o jogo e a prévia da tela de sprites).

function pintarLirio(g, cx, cy, grande) {
  if (!grande) {
    g.fillStyle = '#d8b13a';
    g.beginPath();
    g.arc(cx, cy, T * 0.13, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // Lírio grande: moeda com brilho
  g.fillStyle = '#e8c24a';
  g.beginPath();
  g.arc(cx, cy, T * 0.34, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8c6d15';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, T * 0.22, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255, 250, 225, 0.8)';
  g.beginPath();
  g.arc(cx - T * 0.1, cy - T * 0.1, T * 0.07, 0, Math.PI * 2);
  g.fill();
}

function pintarCenouraPac(g, cx, cy) {
  const C = T * 1.3;
  g.fillStyle = '#5b8c3e';
  g.beginPath();
  g.ellipse(cx - C * 0.1, cy - C * 0.3, C * 0.08, C * 0.2, -0.5, 0, Math.PI * 2);
  g.ellipse(cx + C * 0.1, cy - C * 0.3, C * 0.08, C * 0.2, 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8812f';
  g.beginPath();
  g.moveTo(cx - C * 0.22, cy - C * 0.16);
  g.quadraticCurveTo(cx, cy - C * 0.28, cx + C * 0.22, cy - C * 0.16);
  g.lineTo(cx, cy + C * 0.42);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(120, 50, 10, 0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - C * 0.11, cy);
  g.lineTo(cx - C * 0.01, cy);
  g.moveTo(cx + C * 0.03, cy + C * 0.14);
  g.lineTo(cx + C * 0.1, cy + C * 0.14);
  g.stroke();
}

// cores (junto): { orelha, claro, escuro, contorno } no lugar das cores do coelho dourado. paleta 'neve': o coelho branquinho.
function pintarCoelhoPac(g, cx, cy, dir, abertura, tamanho = 1, giro = 0, cores = null, paleta = null) {
  const r = T * 0.62 * tamanho;
  if (r <= 0.5) return;
  g.save();
  g.translate(cx, cy);
  if (giro) g.rotate(giro);
  if (mesma(dir, ESQ)) g.scale(-1, 1);
  else if (mesma(dir, CIMA)) g.rotate(-Math.PI / 2);
  else if (mesma(dir, BAIXO)) g.rotate(Math.PI / 2);
  // Orelhas para trás, como quem corre.
  for (const [ox, oy, rot] of [[-r * 0.55, -r * 0.7, -0.95], [-r * 0.15, -r * 0.9, -0.45]]) {
    g.save();
    g.translate(ox, oy);
    g.rotate(rot);
    g.fillStyle = cores ? cores.orelha : paleta === 'neve' ? '#dfe7ef' : '#d4a52c';
    g.beginPath();
    g.ellipse(0, -r * 0.45, r * 0.26, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e9a7a0';
    g.beginPath();
    g.ellipse(0, -r * 0.45, r * 0.11, r * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const brilho = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  brilho.addColorStop(0, cores ? cores.claro : paleta === 'neve' ? '#ffffff' : '#f8e79a');
  brilho.addColorStop(1, cores ? cores.escuro : paleta === 'neve' ? '#a9b8c8' : '#c99a22');
  g.fillStyle = brilho;
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, r, abertura, Math.PI * 2 - abertura);
  g.closePath();
  g.fill();
  if (cores?.contorno) {
    g.strokeStyle = cores.contorno;
    g.lineWidth = 2.4;
    g.stroke();
  }
  g.fillStyle = '#1b1403';
  g.beginPath();
  g.arc(r * 0.12, -r * 0.5, r * 0.13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(232, 130, 120, 0.5)';
  g.beginPath();
  g.arc(-r * 0.12, r * 0.28, r * 0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// r = { dir, modo, assustada, cor }; susto = segundos de medo que faltam (pisca nos 2 últimos).
function pintarRaposaPac(g, r, cx, cy, susto, t) {
  const s = T * 0.62;
  const assustada = r.assustada;
  const piscando = assustada && susto < 2 && Math.floor(t * 5) % 2 === 0;
  g.save();
  g.translate(cx, cy);
  const soOlhos = r.modo === 'olhos' || r.modo === 'entrando'; // comida: só os olhos voltam para a toca
  if (!soOlhos) {
    g.fillStyle = assustada ? (piscando ? '#efe6d0' : '#2b4687') : r.cor;
    // Orelhas pontudas
    g.beginPath();
    g.moveTo(-s * 0.95, -s * 0.15); g.lineTo(-s * 0.78, -s * 1.3); g.lineTo(-s * 0.15, -s * 0.78); g.closePath();
    g.moveTo(s * 0.95, -s * 0.15); g.lineTo(s * 0.78, -s * 1.3); g.lineTo(s * 0.15, -s * 0.78); g.closePath();
    g.fill();
    // Corpo com a barra ondulando
    g.beginPath();
    g.moveTo(-s, s * 0.95);
    g.lineTo(-s, 0);
    g.arc(0, 0, s, Math.PI, 0);
    g.lineTo(s, s * 0.95);
    const onda = Math.floor(t * 8) % 2 ? 0.62 : 0.74;
    for (let i = 0; i < 4; i++) {
      g.lineTo(s - (s / 2) * (i + 0.5), s * onda);
      g.lineTo(s - (s / 2) * (i + 1), s * 0.95);
    }
    g.closePath();
    g.fill();
    if (!assustada) {
      g.fillStyle = 'rgba(40, 20, 10, 0.35)';
      g.beginPath();
      g.moveTo(-s * 0.72, -s * 0.35); g.lineTo(-s * 0.66, -s * 1.02); g.lineTo(-s * 0.35, -s * 0.72); g.closePath();
      g.moveTo(s * 0.72, -s * 0.35); g.lineTo(s * 0.66, -s * 1.02); g.lineTo(s * 0.35, -s * 0.72); g.closePath();
      g.fill();
      // Focinho claro e nariz
      g.fillStyle = '#f7f0e2';
      g.beginPath();
      g.ellipse(r.dir[0] * s * 0.12, s * 0.4, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b1403';
      g.beginPath();
      g.arc(r.dir[0] * s * 0.3, s * 0.3 + r.dir[1] * s * 0.06, s * 0.12, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = piscando ? '#c0392b' : '#f4dd80';
      g.fillRect(-s * 0.42, -s * 0.3, s * 0.2, s * 0.2);
      g.fillRect(s * 0.22, -s * 0.3, s * 0.2, s * 0.2);
      g.strokeStyle = g.fillStyle;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-s * 0.6, s * 0.35);
      for (let i = 1; i <= 6; i++) g.lineTo(-s * 0.6 + i * s * 0.2, s * (i % 2 ? 0.2 : 0.35));
      g.stroke();
    }
  }
  if (!assustada) {
    for (const lado of [-1, 1]) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(lado * s * 0.36, -s * 0.2, s * 0.22, s * 0.28, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#1d2a55';
      g.beginPath();
      g.arc(lado * s * 0.36 + r.dir[0] * s * 0.1, -s * 0.2 + r.dir[1] * s * 0.12, s * 0.11, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// Um bloco de parede (ou de chão) do labirinto, sozinho, para a prévia.
function pintarCasaLabirinto(g, parede) {
  g.fillStyle = parede ? '#10251a' : '#060b07';
  g.fillRect(-T / 2, -T / 2, T, T);
  if (!parede) return;
  g.strokeStyle = '#b8921f';
  g.lineWidth = 2;
  g.strokeRect(-T / 2 + 1, -T / 2 + 1, T - 2, T - 2);
}

/* ─── Sprites (veja ../sprites.js): cada peça do labirinto pode virar uma imagem enviada ─── */

// A raposa i (na ordem de RAPOSAS, e a Brasa por último) e o sprite que vale agora.
const CHAVES_RAPOSAS = ['pacman.raposa-rubra', 'pacman.raposa-artica', 'pacman.raposa-cinzenta', 'pacman.raposa-fenec', 'pacman.raposa-brasa'];
function spriteDaRaposa(r, i, susto, t) {
  if (r.modo === 'olhos' || r.modo === 'entrando') return ['pacman.raposa-olhos', 'voltando'];
  if (r.assustada) return ['pacman.raposa-assustada', susto < 2 && Math.floor(t * 5) % 2 === 0 ? 'piscando' : 'assustada'];
  return [CHAVES_RAPOSAS[i] || null, r.dir[1] < 0 ? 'cima' : r.dir[1] > 0 ? 'baixo' : 'andando'];
}

const pecaRaposa = (chave, nome, cor, jeito) => ({
  chave, jogo: 'Pac-Coelho', nome: `Raposa ${nome}`,
  desc: `${jeito} De frente, como os fantasmas do Pac-Man: em "Andando" ela olha para a direita (o jogo espelha para a esquerda). "Subindo" e "Descendo" são opcionais; sem eles, vale o "Andando".`,
  largura: 32, altura: 40, ancora: 'centro',
  animacoes: [
    { id: 'andando', nome: 'Andando', quadros: 2, fps: 8 },
    { id: 'cima', nome: 'Subindo', quadros: 2, fps: 8 },
    { id: 'baixo', nome: 'Descendo', quadros: 2, fps: 8 },
  ],
  previa: (g, anim, t) => pintarRaposaPac(g, { dir: anim === 'cima' ? CIMA : anim === 'baixo' ? BAIXO : DIR, modo: 'normal', assustada: false, cor }, 0, 0, 9, t),
});

export const SPRITES = [
  {
    chave: 'pacman.coelho', jogo: 'Pac-Coelho', nome: 'Coelho comilão',
    desc: 'O coelho dourado do labirinto, de boca aberta para a direita (o jogo gira para cima e para baixo e espelha para a esquerda). Em "Pego" o jogo ainda encolhe e gira o desenho. No junto, marque "pintar com a cor do jogador" para cada um ter o seu pelo.',
    largura: 44, altura: 58, ancora: 'centro', tingir: false,
    animacoes: [
      { id: 'andando', nome: 'Andando (comendo)', quadros: 4, fps: 20 },
      { id: 'parado', nome: 'Parado', quadros: 1, fps: 1 },
      { id: 'morrendo', nome: 'Pego', quadros: 8, fps: 8 },
    ],
    previa: (g, anim, t) => pintarCoelhoPac(g, 0, 0, DIR, anim === 'morrendo' ? 0.2 + (t % 1) * 2.6 : anim === 'parado' ? 0.3 : 0.06 + 0.36 * Math.abs(Math.sin(t * 16))),
  },
  pecaRaposa('pacman.raposa-rubra', 'Rubra', RAPOSAS[0].cor, 'A Rubra, que vai direto atrás do coelho.'),
  pecaRaposa('pacman.raposa-artica', 'Ártica', RAPOSAS[1].cor, 'A Ártica, que tenta chegar na frente do coelho.'),
  pecaRaposa('pacman.raposa-cinzenta', 'Cinzenta', RAPOSAS[2].cor, 'A Cinzenta, que cerca junto com a Rubra.'),
  pecaRaposa('pacman.raposa-fenec', 'Fenec', RAPOSAS[3].cor, 'A Fenec, que chega perto e depois foge.'),
  pecaRaposa('pacman.raposa-brasa', 'Brasa', COR_BRASA, 'A Brasa, a quinta raposa do junto com 3 ou mais jogadores.'),
  {
    chave: 'pacman.raposa-assustada', jogo: 'Pac-Coelho', nome: 'Raposa com medo',
    desc: 'Todas as raposas ficam assim depois do Lírio grande (dá para comê-las). "Piscando" é o aviso de que o medo vai acabar; sem ele, vale "Com medo".',
    largura: 32, altura: 40, ancora: 'centro',
    animacoes: [
      { id: 'assustada', nome: 'Com medo', quadros: 2, fps: 8 },
      { id: 'piscando', nome: 'Piscando', quadros: 2, fps: 5 },
    ],
    previa: (g, anim, t) => pintarRaposaPac(g, { dir: DIR, modo: 'normal', assustada: true, cor: '#e2572f' }, 0, 0, anim === 'piscando' ? 1 : 9, t),
  },
  {
    chave: 'pacman.raposa-olhos', jogo: 'Pac-Coelho', nome: 'Olhos voltando para a toca',
    desc: 'Raposa comida: só os olhos voltam correndo para a toca. Olhando para a direita (o jogo espelha para a esquerda).',
    largura: 32, altura: 40, ancora: 'centro',
    animacoes: [{ id: 'voltando', nome: 'Voltando', quadros: 1, fps: 4 }],
    previa: (g, anim, t) => pintarRaposaPac(g, { dir: DIR, modo: 'olhos', assustada: false, cor: '#e2572f' }, 0, 0, 9, t),
  },
  {
    chave: 'pacman.lirio', jogo: 'Pac-Coelho', nome: 'Lírio',
    desc: 'A moedinha que o coelho come (10 pontos). Bem pequena: cada casa do labirinto tem 24 de lado.',
    largura: 8, altura: 8, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 4 }],
    previa: g => pintarLirio(g, 0, 0, false),
  },
  {
    chave: 'pacman.lirio-grande', jogo: 'Pac-Coelho', nome: 'Lírio grande',
    desc: 'A moeda grande dos cantos, que deixa as raposas com medo. O jogo continua fazendo ela piscar.',
    largura: 18, altura: 18, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 1, fps: 4 }],
    previa: g => pintarLirio(g, 0, 0, true),
  },
  {
    chave: 'pacman.cenoura', jogo: 'Pac-Coelho', nome: 'Cenoura bônus',
    desc: 'A cenoura que aparece embaixo da toca duas vezes por nível.',
    largura: 20, altura: 32, ancora: 'centro',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 4 }],
    previa: g => pintarCenouraPac(g, 0, 0),
  },
  {
    chave: 'pacman.parede', jogo: 'Pac-Coelho', nome: 'Bloco de parede',
    desc: 'Uma casa de parede do labirinto (24 x 24), repetida em todas. O contorno dourado entre a parede e o caminho continua por cima. Com vários quadros, cada bloco usa um (para variar).',
    largura: 24, altura: 24, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarCasaLabirinto(g, true),
  },
  {
    chave: 'pacman.chao', jogo: 'Pac-Coelho', nome: 'Chão do caminho',
    desc: 'Uma casa do caminho do labirinto (24 x 24), por baixo dos Lírios. Com vários quadros, cada casa usa um (para variar).',
    largura: 24, altura: 24, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarCasaLabirinto(g, false),
  },
];
registrarPecas(SPRITES);

// Sprite trocado: o labirinto já desenhado (fundo) é refeito na próxima vez.
let versaoSprites = 0;
aoMudarSprites(() => { versaoSprites++; });

// Estado que o desenho usa: e = { moedas, pac: { x, y, dir, parado }, raposas: [{ x, y, dir, modo, assustada, cor }],
// situacao, relogio, susto, cenoura, popups, nivel, pontos, congelado }. t = tempo em segundos (animações).
function criarDesenhoPac() {
  let paleta = null; // 'neve': o coelho branquinho (código secreto)
  const escala = Math.min(2, window.devicePixelRatio || 1);
  const tela = h('canvas', { class: 'pac-tela', width: W * escala, height: H * escala, 'aria-label': 'Labirinto do Pac-Coelho' });
  const g = tela.getContext('2d');
  g.scale(escala, escala);

  // claro: o labirinto piscando quando o nível acaba (com sprite de parede ou chão, um véu claro por cima).
  function desenharLabirinto(corBorda, corParede, claro = false) {
    const c = document.createElement('canvas');
    c.width = W * escala;
    c.height = H * escala;
    const x2 = c.getContext('2d');
    x2.scale(escala, escala);
    x2.fillStyle = '#060b07';
    x2.fillRect(0, 0, W, H);
    const comChao = temSprite('pacman.chao');
    const comParede = temSprite('pacman.parede');
    if (comChao) {
      for (let y = 0; y < LINHAS; y++) {
        for (let x = 0; x < COLS; x++) {
          const fora = MAPA[y][x] === ' ' && (x < 5 || x > 22) && y !== 14; // os cantos de fora do labirinto
          if (MAPA[y][x] !== '#' && !fora) desenharSprite(x2, 'pacman.chao', 'parado', x * T + T / 2, y * T + T / 2, { quadro: x * 7 + y * 13 });
        }
      }
    }
    x2.fillStyle = corParede;
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAPA[y][x] !== '#') continue;
        if (!(comParede && desenharSprite(x2, 'pacman.parede', 'parado', x * T + T / 2, y * T + T / 2, { quadro: x * 7 + y * 13 }))) x2.fillRect(x * T, y * T, T, T);
      }
    }
    // Contorno dourado onde a parede encontra o caminho.
    x2.strokeStyle = corBorda;
    x2.lineWidth = 2;
    x2.lineCap = 'round';
    x2.beginPath();
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAPA[y][x] !== '#') continue;
        const X = x * T;
        const Y = y * T;
        if (!parede(x, y - 1)) { x2.moveTo(X, Y + 1); x2.lineTo(X + T, Y + 1); }
        if (!parede(x, y + 1)) { x2.moveTo(X, Y + T - 1); x2.lineTo(X + T, Y + T - 1); }
        if (!parede(x - 1, y)) { x2.moveTo(X + 1, Y); x2.lineTo(X + 1, Y + T); }
        if (!parede(x + 1, y)) { x2.moveTo(X + T - 1, Y); x2.lineTo(X + T - 1, Y + T); }
      }
    }
    x2.stroke();
    // Porta da toca das raposas.
    x2.fillStyle = '#e8a3a0';
    x2.fillRect(13 * T, 12 * T + T * 0.42, 2 * T, T * 0.16);
    if (claro && (comChao || comParede)) {
      x2.fillStyle = 'rgba(251, 241, 199, 0.35)';
      x2.fillRect(0, 0, W, H);
    }
    return c;
  }
  let fundo = null;
  let fundoClaro = null;
  let versaoFundo = -1;
  function prepararFundos() {
    if (versaoFundo === versaoSprites) return;
    versaoFundo = versaoSprites;
    fundo = desenharLabirinto('#b8921f', '#10251a');
    fundoClaro = desenharLabirinto('#fbf1c7', '#3d6b3f', true);
  }
  prepararFundos();

  const px = x => x * T + T / 2;

  function desenharMoedas(e, t) {
    const piscar = e.situacao === 'jogando' && Math.floor(t * 4) % 2 === 1;
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const m = e.moedas[y * COLS + x];
        if (!m) continue;
        const cx = px(x);
        const cy = px(y);
        if (m === 1) {
          if (!desenharSprite(g, 'pacman.lirio', 'parado', cx, cy, { t })) pintarLirio(g, cx, cy, false);
        } else if (!piscar) {
          if (!desenharSprite(g, 'pacman.lirio-grande', 'brilhando', cx, cy, { t })) pintarLirio(g, cx, cy, true);
        }
      }
    }
  }

  function desenharCenoura(cx, cy, t) {
    if (!desenharSprite(g, 'pacman.cenoura', 'parada', cx, cy, { t })) pintarCenouraPac(g, cx, cy);
  }

  // cores (junto): { orelha, claro, escuro, contorno } no lugar das cores do coelho dourado.
  // sp: { anim, t, progresso } quando pode usar o sprite enviado (girado para cima e para baixo, espelhado para a esquerda).
  function desenharCoelho(cx, cy, dir, abertura, tamanho = 1, giro = 0, cores = null, sp = null) {
    if (sp && temSprite('pacman.coelho')) {
      const r = T * 0.62 * tamanho;
      if (r <= 0.5) return;
      if (cores?.contorno) {
        g.strokeStyle = cores.contorno;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(cx, cy, r + 1, 0, Math.PI * 2);
        g.stroke();
      }
      const rot = giro + (mesma(dir, CIMA) ? -Math.PI / 2 : mesma(dir, BAIXO) ? Math.PI / 2 : 0);
      desenharSprite(g, 'pacman.coelho', sp.anim, cx, cy, {
        t: sp.t, progresso: sp.progresso, rot, dir: mesma(dir, ESQ) ? -1 : 1, escala: tamanho,
        cor: cores ? cores.orelha : paleta === 'neve' ? '#eef3f8' : '#d4a52c',
      });
      return;
    }
    pintarCoelhoPac(g, cx, cy, dir, abertura, tamanho, giro, cores, paleta);
  }

  // i: a posição na lista (Rubra, Ártica, Cinzenta, Fenec, Brasa), para achar o sprite de cada uma.
  function desenharRaposa(r, i, cx, cy, e, t) {
    const [chave, anim] = spriteDaRaposa(r, i, e.susto, t);
    if (chave && desenharSprite(g, chave, anim, cx, cy, { t, dir: r.dir[0] < 0 ? -1 : 1 })) return;
    pintarRaposaPac(g, r, cx, cy, e.susto, t);
  }

  // Desenha perto das pontas também do outro lado, para o túnel não "pular".
  function emVolta(x, desenhar) {
    desenhar(x);
    if (x < 1) desenhar(x + COLS);
    if (x > COLS - 2) desenhar(x - COLS);
  }

  function desenhar(e, t) {
    prepararFundos();
    g.drawImage(e.situacao === 'passou' && e.relogio < 1.8 && Math.floor(t * 5) % 2 ? fundoClaro : fundo, 0, 0, W, H);
    desenharMoedas(e, t);
    if (e.cenoura) desenharCenoura(px(13.5), px(17), t);
    const { x: pxp, y: pyp } = e.pac;
    if (e.situacao !== 'morrendo' && e.situacao !== 'passou') {
      e.raposas.forEach((r, i) => emVolta(r.x, x => desenharRaposa(r, i, px(x), px(r.y), e, t)));
    }
    if (e.situacao === 'morrendo') {
      const k = Math.max(0, Math.min(1, (1.8 - e.relogio - 0.4) / 1.2)); // primeiro para, depois some girando
      emVolta(pxp, x => desenharCoelho(px(x), px(pyp), e.pac.dir, 0.2 + k * 2.6, 1 - k, k * Math.PI * 2, null, { anim: 'morrendo', progresso: k }));
    } else {
      const andando = e.situacao === 'jogando' && !e.pac.parado && !(e.congelado > 0);
      const boca = andando ? 0.06 + 0.36 * Math.abs(Math.sin(t * 16)) : 0.3;
      emVolta(pxp, x => desenharCoelho(px(x), px(pyp), e.pac.dir, boca, 1, 0, null, { anim: andando ? 'andando' : 'parado', t }));
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of e.popups) {
      g.font = `700 ${T * 0.62}px Cinzel, serif`;
      g.fillStyle = '#9fe0f0';
      g.fillText(p.texto, px(p.x), px(p.y));
    }
    if (e.situacao === 'pronto') {
      g.font = `700 ${T * 0.9}px Cinzel, serif`;
      g.fillStyle = '#f4dd80';
      g.fillText(e.nivel > 1 && e.pontos ? `Nível ${e.nivel}` : 'Pronto!', px(13.5), px(17));
    }
  }

  /* Junto: vários coelhos, cada um com a cor de quem joga, o pelo e o chapéu do Club Coelho e o nome em cima. */

  // O chapéu (a parte "cabeca" da roupa) fica sempre em pé, virado para o lado em que o coelho anda.
  function desenharChapeu(cx, cy, dir, id, pelo, t) {
    const r = T * 0.62;
    const k = (r * 0.8) / 9.5; // a cabeça do coelho do Club tem uns 9,5 de raio
    g.save();
    g.translate(cx, cy);
    g.scale(mesma(dir, ESQ) ? -k : k, k);
    g.translate(-11, 27 - (r * 0.15) / k);
    try { desenharParte(g, 'cabeca', id, t, pelo); } catch { /* item que este navegador não conhece */ }
    g.restore();
  }

  function desenharSeta(cx, cy, d) {
    const r = T * 0.62 + 6;
    g.save();
    g.translate(cx + d[0] * r, cy + d[1] * r);
    g.rotate(Math.atan2(d[1], d[0]));
    g.fillStyle = 'rgba(255, 250, 225, 0.85)';
    g.beginPath();
    g.moveTo(4, 0);
    g.lineTo(-3, -4);
    g.lineTo(-3, 4);
    g.closePath();
    g.fill();
    g.restore();
  }

  function desenharEtiqueta(c) {
    const texto = c.nome.length > 12 ? `${c.nome.slice(0, 11)}…` : c.nome;
    g.font = `700 ${Math.round(T * 0.44)}px system-ui, sans-serif`;
    const w = g.measureText(texto).width + 10;
    const alt = T * 0.62;
    const x = Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, px(c.x)));
    const y = Math.max(alt / 2 + 1, px(c.y) - T * 1.25);
    g.fillStyle = 'rgba(6, 11, 7, 0.8)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x - w / 2, y - alt / 2, w, alt, alt / 2);
    else g.rect(x - w / 2, y - alt / 2, w, alt);
    g.fill();
    if (c.eu) {
      g.strokeStyle = '#f4dd80';
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.fillStyle = c.cor;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(texto, x, y + 0.5);
  }

  // c = { x, y, dir, estado (0 vivo, 1 protegido, 2 e 5 pego, 3 fora), andando, cor, pelo, chapeu, nome, eu, querDir }
  function desenharCoelhoJunto(c, t) {
    const pelo = /^#[0-9a-f]{6}$/i.test(c.pelo || '') ? c.pelo : '#d4a52c';
    const cores = { orelha: pelo, claro: sombrear(pelo, 0.45), escuro: sombrear(pelo, -0.22), contorno: c.cor };
    const pego = c.estado === 2 || c.estado === 5;
    let abertura = c.andando ? 0.06 + 0.36 * Math.abs(Math.sin(t * 16)) : 0.3;
    let giro = 0;
    g.save();
    if (pego) {
      g.globalAlpha = Math.floor(t * 8) % 2 ? 0.25 : 0.9; // pisca enquanto não volta
      abertura = 0.9;
      giro = t * 5;
    } else if (c.estado === 1) {
      g.globalAlpha = 0.45 + 0.35 * Math.abs(Math.sin(t * 9)); // protegido: meio transparente
    }
    emVolta(c.x, x => {
      desenharCoelho(px(x), px(c.y), c.dir, abertura, 1, giro, cores, { anim: c.andando && !pego ? 'andando' : 'parado', t });
      if (c.chapeu && !pego) desenharChapeu(px(x), px(c.y), c.dir, c.chapeu, pelo, t);
    });
    g.restore();
    if (c.eu && c.querDir && !pego && !mesma(c.querDir, c.dir)) desenharSeta(px(c.x), px(c.y), c.querDir);
  }

  // e = { moedas, situacao, susto, cenoura, raposas, coelhos: [c | null], popups: [{ x, y, texto, cor }], piscar }
  function desenharJunto(e, t) {
    prepararFundos();
    g.drawImage(e.piscar && Math.floor(t * 5) % 2 ? fundoClaro : fundo, 0, 0, W, H);
    desenharMoedas(e, t);
    if (e.cenoura) desenharCenoura(px(13.5), px(17), t);
    e.raposas.forEach((r, i) => emVolta(r.x, x => desenharRaposa(r, i, px(x), px(r.y), e, t)));
    // O meu coelho por último (por cima dos outros).
    const vistos = e.coelhos.filter(c => c && c.estado !== 3 && c.estado !== 4);
    const ordem = [...vistos.filter(c => !c.eu), ...vistos.filter(c => c.eu)];
    for (const c of ordem) desenharCoelhoJunto(c, t);
    for (const c of ordem) desenharEtiqueta(c);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${T * 0.62}px Cinzel, serif`;
    for (const p of e.popups) {
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(6, 11, 7, 0.85)';
      g.strokeText(p.texto, px(p.x), px(p.y));
      g.fillStyle = p.cor;
      g.fillText(p.texto, px(p.x), px(p.y));
    }
  }

  return { tela, desenhar, desenharJunto, definirPaleta: p => { paleta = p; } };
}

// Só para os testes no Node (o desenho sem o resto da tela).
export const _criarDesenhoPac = criarDesenhoPac;

/* ─── Transmissão (quem assiste recebe o estado resumido) ─── */

const MODOS = ['normal', 'casa', 'saindo', 'entrando', 'olhos'];
const indiceDir = d => DIRS.findIndex(x => mesma(x, d));
const r2 = x => Math.round(x * 100) / 100;

function resumir(e, comMoedas) {
  return {
    p: [r2(e.pac.x), r2(e.pac.y), indiceDir(e.pac.dir), e.pac.parado ? 1 : 0],
    r: e.raposas.map(r => [r2(r.x), r2(r.y), indiceDir(r.dir), MODOS.indexOf(r.modo), r.assustada ? 1 : 0]),
    s: e.situacao, rl: r2(e.relogio), su: r2(e.susto), c: e.cenoura ? 1 : 0, n: e.nivel, pts: e.pontos, v: e.vidas,
    pp: e.popups.map(p => [r2(p.x), r2(p.y), p.texto]),
    ...(comMoedas ? { m: Array.from(e.moedas).join('') } : {}),
  };
}

function expandir(q, moedas) {
  return {
    moedas,
    pac: { x: q.p[0], y: q.p[1], dir: DIRS[q.p[2]] || ESQ, parado: !!q.p[3] },
    raposas: q.r.map(([x, y, d, m, a], i) => ({ x, y, dir: DIRS[d] || ESQ, modo: MODOS[m] || 'normal', assustada: !!a, cor: RAPOSAS[i]?.cor || '#e2572f' })),
    situacao: q.s, relogio: q.rl, susto: q.su, cenoura: !!q.c, nivel: q.n, pontos: q.pts, vidas: q.v,
    popups: (q.pp || []).map(([x, y, texto]) => ({ x, y, texto })), congelado: 0,
  };
}

// Tela de quem assiste: o mesmo labirinto, redesenhado com o último estado recebido.
export function assistirPac() {
  const desenho = criarDesenhoPac();
  const pontosEl = h('strong', null, '0');
  const nivelEl = h('strong', null, '1');
  const vidasEl = h('span', { class: 'pac-vidas' });
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  let moedas = new Uint8Array(COLS * LINHAS);
  let estadoAtual = null;
  let quadro = null;
  let parado = false;
  const inicio = performance.now();

  function laco(agora) {
    if (parado) return;
    if (estadoAtual) {
      try { desenho.desenhar(estadoAtual, (agora - inicio) / 1000); } catch (e) { console.error(e); }
    }
    quadro = requestAnimationFrame(laco);
  }
  quadro = requestAnimationFrame(laco);

  const textoSituacao = { inicio: 'Preparando o jogo...', pausado: 'Pausado', fim: 'Fim de jogo' };
  return {
    el: h('div', { class: 'jogo-area pac-area' },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, 'Pontos: ', pontosEl), h('span', null, 'Nível ', nivelEl), vidasEl),
      h('div', { class: 'cobra-moldura pac-moldura' }, desenho.tela, aviso_)),
    quadro(q) {
      if (q.m) moedas = Uint8Array.from(q.m, c => Number(c));
      estadoAtual = expandir(q, moedas);
      pontosEl.textContent = num(q.pts);
      nivelEl.textContent = q.n;
      trocar(vidasEl, Array.from({ length: Math.max(0, q.v) }, () => icone('coelho')));
      const texto = textoSituacao[q.s];
      aviso_.hidden = !texto;
      if (texto) aviso_.textContent = q.s === 'fim' ? `Fim de jogo: ${num(q.pts)} pontos` : texto;
    },
    parar() { parado = true; cancelAnimationFrame(quadro); },
  };
}

export function pacCoelho() {
  if (!pode('recreacao.usar')) { const e = new Error('Sem acesso à Recreação.'); e.status = 403; throw e; }
  // Aberto de uma sala junto (versus ou co-op): o jogo roda no servidor.
  const junto = pacJunto();
  if (junto) return junto;

  const desenho = criarDesenhoPac();
  const tela = desenho.tela;
  const plateiaEl = h('span', { class: 'plateia', hidden: true });

  const pontosEl = h('strong', null, '0');
  const recordeEl = h('strong', null, '...');
  const nivelEl = h('strong', null, '1');
  const vidasEl = h('span', { class: 'pac-vidas' });
  const sobre = h('div', { class: 'cobra-sobre' });
  const ranking = h('div');

  let moedas, totalMoedas, comidas, pac, querDir, raposas;
  let pontos = 0;
  let vidas = 3;
  let nivel = 1;
  let vidaExtra = false;
  let recorde = null;
  let situacao = 'inicio';
  let relogio = 0;     // segundos restantes de "pronto", "morrendo" ou "passou"
  let congelado = 0;   // pausa curta depois de comer uma raposa
  let fase = 0;
  let tempoFase = FASES[0][0];
  let susto = 0;
  let combo = 0;
  let cenoura = null;
  let tempoVida = 0;
  let popups = [];
  let t = 0;
  let quadro = null;
  let ultimo = 0;
  let vel = velocidades(1);
  const sorte = Math.random;
  // Códigos secretos: Konami (+5 vidas), "buuu" (susto nas raposas) e "neve" (coelho branco).
  let konamiUsado = false;
  let buuuNoNivel = 0;
  const seg = segredosDoJogo('pacman', {
    aoMudar: (chave, ligado) => { if (chave === 'pac-neve') desenho.definirPaleta(ligado ? 'neve' : null); },
    aoUsar: chave => {
      if (situacao === 'fim') return false;
      if (chave === 'pac-konami') {
        if (konamiUsado) return false;
        konamiUsado = true;
        vidas += 5;
        popups.push({ x: 13.5, y: 20, texto: '+5 vidas!', ate: 2 });
        atualizarHud();
        return true;
      }
      if (chave === 'pac-buuu') {
        if (buuuNoNivel === nivel || !['jogando', 'pronto', 'pausado'].includes(situacao)) return false;
        buuuNoNivel = nivel;
        assustar();
        popups.push({ x: 13.5, y: 14, texto: 'Buuu!', ate: 1.6 });
        return true;
      }
      return false;
    },
  });

  /* ─── Andamento do jogo ─── */

  function novoJogo() {
    pontos = 0;
    vidas = 3;
    konamiUsado = false;
    buuuNoNivel = 0;
    seg.novaPartida();
    nivel = 1;
    vidaExtra = false;
    novoNivel();
    situacao = 'inicio';
    atualizarHud();
    mostrarSobre();
  }

  function novoNivel() {
    moedas = new Uint8Array(COLS * LINHAS);
    totalMoedas = 0;
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = MAPA[y][x];
        if (c === '.' || c === 'o') { moedas[y * COLS + x] = c === '.' ? 1 : 2; totalMoedas++; }
      }
    }
    comidas = 0;
    vel = velocidades(nivel);
    novaVida();
  }

  function novaVida() {
    pac = { tx: 14, ty: 23, dir: ESQ, p: 0.5 };
    querDir = null;
    raposas = RAPOSAS.map((r, i) => (i === 0
      ? { ...r, modo: 'normal', tx: 14, ty: 11, dir: ESQ, p: 0.5, assustada: false, reverter: false }
      : { ...r, modo: 'casa', fx: r.casa[0], fy: r.casa[1], bob: i % 2 ? 1 : -1, dir: CIMA, assustada: false, reverter: false }));
    fase = 0;
    tempoFase = FASES[0][0];
    susto = 0;
    combo = 0;
    cenoura = null;
    tempoVida = 0;
    congelado = 0;
    situacao = 'pronto';
    relogio = 2;
  }

  function somar(n) {
    pontos += n;
    if (!vidaExtra && pontos >= 10000) {
      vidaExtra = true;
      vidas++;
      popups.push({ x: 13.5, y: 20, texto: 'Vida extra!', ate: 1.8 });
    }
    atualizarHud();
  }

  function comerMoeda(x, y) {
    const i = y * COLS + x;
    const m = moedas[i];
    if (!m) return;
    moedas[i] = 0;
    comidas++;
    if (m === 1) somar(10);
    else { somar(50); assustar(); }
    if (comidas === 70 || comidas === 170) cenoura = { ate: 9.5 };
    if (comidas === totalMoedas) { situacao = 'passou'; relogio = 2.2; }
  }

  function assustar() {
    susto = tempoDeSusto(nivel);
    combo = 0;
    for (const r of raposas) {
      if (r.modo === 'olhos' || r.modo === 'entrando') continue;
      r.assustada = true;
      if (r.modo === 'normal') r.reverter = true;
    }
  }

  const modoAtual = () => FASES[fase][1];
  const posicao = e => (e.modo === 'casa' || e.modo === 'saindo' || e.modo === 'entrando') ? [e.fx, e.fy] : [e.tx + e.dir[0] * e.p, e.ty + e.dir[1] * e.p];
  const casaDoPac = () => { const [x, y] = posicao(pac); return [colunaCerta(Math.round(x)), Math.round(y)]; };

  function moverPac(dt) {
    let passo = VEL * vel.pac * dt;
    for (let n = 0; passo > 1e-9 && n < 10; n++) {
      // Meia-volta pode a qualquer momento.
      if (querDir && contraria(querDir, pac.dir) && pac.p > 0) {
        pac.tx = colunaCerta(pac.tx + pac.dir[0]);
        pac.ty += pac.dir[1];
        pac.p = 1 - pac.p;
        pac.dir = querDir;
      }
      if (pac.p === 0) {
        if (querDir && livre(pac.tx + querDir[0], pac.ty + querDir[1])) pac.dir = querDir;
        if (!livre(pac.tx + pac.dir[0], pac.ty + pac.dir[1])) { pac.parado = true; return; }
      }
      pac.parado = false;
      const falta = 1 - pac.p;
      if (passo < falta) { pac.p += passo; return; }
      passo -= falta;
      pac.tx = colunaCerta(pac.tx + pac.dir[0]);
      pac.ty += pac.dir[1];
      pac.p = 0;
      comerMoeda(pac.tx, pac.ty);
      if (situacao !== 'jogando') return;
    }
  }

  function alvo(r) {
    if (r.modo === 'olhos') return [13.5, 11];
    if (modoAtual() === 'dispersar') return r.canto;
    const [px, py] = casaDoPac();
    const [dx, dy] = pac.dir;
    if (r.nome === 'Ártica') return [px + 4 * dx, py + 4 * dy];
    if (r.nome === 'Cinzenta') {
      const rubra = raposas[0];
      const [bx, by] = posicao(rubra);
      const mx = px + 2 * dx;
      const my = py + 2 * dy;
      return [2 * mx - bx, 2 * my - by];
    }
    if (r.nome === 'Fenec') return (r.tx - px) ** 2 + (r.ty - py) ** 2 > 64 ? [px, py] : r.canto;
    return [px, py];
  }

  function escolherCaminho(r) {
    const opcoes = DIRS.filter(d => !contraria(d, r.dir) && livre(r.tx + d[0], r.ty + d[1]));
    if (!opcoes.length) return [-r.dir[0], -r.dir[1]];
    if (r.assustada) return opcoes[Math.floor(sorte() * opcoes.length)];
    const [ax, ay] = alvo(r);
    let melhor = opcoes[0];
    let menor = Infinity;
    for (const d of opcoes) {
      const dist = (r.tx + d[0] - ax) ** 2 + (r.ty + d[1] - ay) ** 2;
      if (dist < menor) { menor = dist; melhor = d; }
    }
    return melhor;
  }

  function velRaposa(r) {
    if (r.modo === 'olhos') return VEL * 1.7;
    if (r.ty === 14 && (r.tx <= 5 || r.tx >= 22)) return VEL * vel.tunel;
    return VEL * (r.assustada ? vel.susto : vel.raposa);
  }

  // Anda em linha reta até (x, y) no chão da toca, uma coordenada de cada vez.
  function irAte(r, x, y, passo) {
    if (Math.abs(r.fx - x) > 1e-3) {
      r.dir = r.fx < x ? DIR : ESQ;
      r.fx += Math.sign(x - r.fx) * Math.min(passo, Math.abs(x - r.fx));
      return false;
    }
    r.fx = x;
    if (Math.abs(r.fy - y) > 1e-3) {
      r.dir = r.fy < y ? BAIXO : CIMA;
      r.fy += Math.sign(y - r.fy) * Math.min(passo, Math.abs(y - r.fy));
      return false;
    }
    r.fy = y;
    return true;
  }

  function moverRaposa(r, dt) {
    if (r.modo === 'casa') {
      r.fy += r.bob * VEL * 0.3 * dt;
      if (r.fy < 13.6) { r.fy = 13.6; r.bob = 1; }
      if (r.fy > 14.4) { r.fy = 14.4; r.bob = -1; }
      r.dir = r.bob > 0 ? BAIXO : CIMA;
      if (tempoVida >= r.solta) r.modo = 'saindo';
      return;
    }
    if (r.modo === 'saindo') {
      if (irAte(r, 13.5, 11, VEL * 0.45 * dt)) Object.assign(r, { modo: 'normal', tx: 14, ty: 11, dir: ESQ, p: 0.5 });
      return;
    }
    if (r.modo === 'entrando') {
      if (irAte(r, 13.5, 14, VEL * 1.2 * dt)) Object.assign(r, { modo: 'saindo', assustada: false });
      return;
    }
    if (r.reverter) {
      r.reverter = false;
      if (r.modo === 'normal') {
        r.tx = colunaCerta(r.tx + r.dir[0]);
        r.ty += r.dir[1];
        r.p = 1 - r.p;
        r.dir = [-r.dir[0], -r.dir[1]];
      }
    }
    let passo = velRaposa(r) * dt;
    for (let n = 0; passo > 1e-9 && n < 10; n++) {
      const falta = 1 - r.p;
      if (passo < falta) { r.p += passo; return; }
      passo -= falta;
      r.tx = colunaCerta(r.tx + r.dir[0]);
      r.ty += r.dir[1];
      r.p = 0;
      if (r.modo === 'olhos' && r.ty === 11 && (r.tx === 13 || r.tx === 14)) {
        Object.assign(r, { modo: 'entrando', fx: r.tx, fy: 11 });
        return;
      }
      r.dir = escolherCaminho(r);
    }
  }

  function colisoes() {
    const [px, py] = posicao(pac);
    for (const r of raposas) {
      if (r.modo === 'casa' || r.modo === 'entrando' || r.modo === 'olhos') continue;
      const [rx, ry] = posicao(r);
      let dx = Math.abs(px - rx);
      dx = Math.min(dx, COLS - dx);
      if (dx >= 0.6 || Math.abs(py - ry) >= 0.6) continue;
      if (r.assustada) {
        const valor = 200 * 2 ** combo;
        combo = Math.min(combo + 1, 3);
        somar(valor);
        popups.push({ x: rx, y: ry, texto: num(valor), ate: 0.9 });
        // Comida na porta da toca (ainda saindo), ela volta direto para dentro.
        Object.assign(r, { modo: r.modo === 'saindo' ? 'entrando' : 'olhos', assustada: false });
        congelado = 0.5;
      } else {
        situacao = 'morrendo';
        relogio = 1.8;
        return;
      }
    }
    if (cenoura && Math.abs(py - 17) < 0.5 && Math.abs(px - 13.5) < 0.7) {
      const valor = VALOR_CENOURA[Math.min(nivel, VALOR_CENOURA.length) - 1];
      somar(valor);
      popups.push({ x: 13.5, y: 17, texto: num(valor), ate: 1.4 });
      cenoura = null;
    }
  }

  function atualizar(dt) {
    t += dt;
    popups = popups.filter(p => (p.ate -= dt) > 0);
    if (situacao === 'pronto') { if ((relogio -= dt) <= 0) situacao = 'jogando'; return; }
    if (situacao === 'morrendo') {
      if ((relogio -= dt) <= 0) {
        vidas--;
        atualizarHud();
        if (vidas <= 0) fimDeJogo(); else novaVida();
      }
      return;
    }
    if (situacao === 'passou') {
      if ((relogio -= dt) <= 0) { nivel++; novoNivel(); atualizarHud(); }
      return;
    }
    if (situacao !== 'jogando') return;
    if (congelado > 0) { congelado -= dt; return; }
    tempoVida += dt;
    if (susto > 0) {
      susto -= dt;
      if (susto <= 0) { susto = 0; for (const r of raposas) r.assustada = false; }
    } else if (fase < FASES.length - 1 && (tempoFase -= dt) <= 0) {
      fase++;
      tempoFase = FASES[fase][0];
      for (const r of raposas) if (r.modo === 'normal') r.reverter = true;
    }
    if (cenoura && (cenoura.ate -= dt) <= 0) cenoura = null;
    moverPac(dt);
    if (situacao !== 'jogando') return;
    colisoes();
    if (situacao !== 'jogando') return;
    for (const r of raposas) moverRaposa(r, dt);
    colisoes();
  }

  async function fimDeJogo() {
    situacao = 'fim';
    mostrarSobre();
    if (!pontos) return;
    if (!seg.valeRecorde()) { mostrarSobre('Modo secreto: esta partida não vale recorde.'); return; }
    try {
      const r = await post('/api/recreacao/recordes', { jogo: 'pacman', pontos, detalhe: `nível ${nivel}` });
      if (r.recorde) {
        recorde = pontos;
        atualizarHud();
        if (situacao === 'fim') mostrarSobre(r.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!');
        carregarRanking();
      }
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }

  // Estado do jogo no formato do desenho (o mesmo que vai para quem assiste).
  function foto() {
    const [x, y] = posicao(pac);
    return {
      moedas, pac: { x, y, dir: pac.dir, parado: !!pac.parado },
      raposas: raposas.map(r => { const [rx, ry] = posicao(r); return { x: rx, y: ry, dir: r.dir, modo: r.modo, assustada: r.assustada, cor: r.cor }; }),
      situacao, relogio, susto, cenoura: !!cenoura, popups, nivel, pontos, vidas, congelado,
    };
  }

  let moedasEnviadas = '';
  function transmitirQuadro(e) {
    const chave = `${nivel}:${comidas}`;
    const comMoedas = chave !== moedasEnviadas;
    if (!rt.conectado) return;
    if (comMoedas) moedasEnviadas = chave;
    enviarQuadro(resumir(e, comMoedas), comMoedas);
  }

  function passo(agora) {
    const dt = Math.min(0.05, ultimo ? (agora - ultimo) / 1000 : 0);
    ultimo = agora;
    try {
      atualizar(dt);
      const e = foto();
      desenho.desenhar(e, t);
      transmitirQuadro(e);
    } catch (e) {
      console.error('Pac-Coelho:', e); // um erro não pode travar o jogo
    }
    quadro = requestAnimationFrame(passo);
  }

  /* ─── Tela ─── */

  function atualizarHud() {
    pontosEl.textContent = num(pontos);
    nivelEl.textContent = nivel;
    recordeEl.textContent = recorde == null ? '0' : num(recorde);
    trocar(vidasEl, Array.from({ length: Math.max(0, vidas) }, () => icone('coelho')));
  }

  function comecar() {
    if (situacao === 'fim') { novoJogo(); }
    if (situacao === 'inicio') situacao = 'pronto';
    if (situacao === 'pausado') situacao = retomar || 'jogando';
    mostrarSobre();
  }

  let retomar = null;
  function pausar() {
    if (!['jogando', 'pronto'].includes(situacao)) return;
    retomar = situacao;
    situacao = 'pausado';
    mostrarSobre();
  }

  function mostrarSobre(extra) {
    if (!['inicio', 'pausado', 'fim'].includes(situacao)) { sobre.hidden = true; return; }
    sobre.hidden = false;
    const toque = matchMedia('(pointer: coarse)').matches;
    if (situacao === 'inicio') {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Pac-Coelho'),
        h('p', null, 'Coma todos os Lírios e fuja das raposas.'),
        h('p', null, toque ? 'Deslize o dedo no labirinto ou use as setas abaixo.' : 'Use as setas ou W A S D. Espaço pausa.'),
        botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar })));
    } else if (situacao === 'pausado') {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Pausado'), botao('Continuar', { classe: 'btn-ouro', onclick: comecar })));
    } else {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim de jogo'),
        h('p', { class: 'cobra-placar' }, `${num(pontos)} pontos`),
        h('p', null, `Chegou ao nível ${nivel}.`),
        extra && h('p', { class: 'cobra-recorde' }, icone('trofeu'), extra),
        botao('Jogar de novo', { classe: 'btn-ouro', onclick: () => { novoJogo(); comecar(); } })));
    }
  }

  function virar(d) {
    querDir = d;
    if (situacao === 'inicio' || situacao === 'pausado') comecar();
  }

  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const d = TECLAS[e.code];
    if (d) { e.preventDefault(); virar(d); return; }
    if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      if (situacao === 'jogando' || situacao === 'pronto') pausar(); else comecar();
    }
    if (e.code === 'Enter' && (situacao === 'fim' || situacao === 'inicio')) { e.preventDefault(); if (situacao === 'fim') novoJogo(); comecar(); }
  };
  document.addEventListener('keydown', aoTeclar);

  let inicio = null;
  tela.addEventListener('pointerdown', e => { inicio = { x: e.clientX, y: e.clientY }; });
  tela.addEventListener('pointerup', e => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR : ESQ) : (dy > 0 ? BAIXO : CIMA);
    seg.direcao(nomeDir(d));
    virar(d);
  });

  const aoEsconder = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', aoEsconder);
  const transmitirAgora = () => { moedasEnviadas = ''; transmitir('pacman', {}); };
  aoSair(ouvir('estado', () => { if (rt.conectado) transmitirAgora(); }));
  aoSair(ouvir('solo:plateia', () => {
    plateiaEl.hidden = !rt.plateia;
    trocar(plateiaEl, icone('olho'), ` ${rt.plateia} assistindo`);
  }));
  if (rt.conectado) transmitirAgora();
  aoSair(() => {
    pararTransmissao();
    cancelAnimationFrame(quadro);
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('visibilitychange', aoEsconder);
  });

  function carregarRanking() {
    get('/api/recreacao/ranking').then(r => {
      const meu = r.pacman.find(l => l.nome === estado.eu.nome);
      if (meu && (recorde == null || meu.pontos > recorde)) recorde = meu.pontos;
      atualizarHud();
      trocar(ranking, r.pacman.length
        ? h('ol', { class: 'mini-ranking' }, r.pacman.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, num(l.pontos)))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda. Seja o primeiro!'));
    }).catch(() => {});
  }

  const seta = (ic, d, rotulo) => h('button', { class: `dpad-${ic}`, type: 'button', 'aria-label': rotulo, onpointerdown: e => { e.preventDefault(); seg.direcao(nomeDir(d)); virar(d); } }, icone(ic));
  const legenda = (el, nome, texto) => h('li', null, el, h('span', null, h('strong', null, nome), ' ', texto));
  const bolinha = (cor, tam) => h('span', { class: 'pac-bola', style: { '--cor': cor, '--tam': tam } });

  novoJogo();
  carregarRanking();
  quadro = requestAnimationFrame(passo);

  return h('div', { class: 'pagina' },
    cabecalho({ titulo: 'Pac-Coelho', icone: 'coelho', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub: 'O coelho da Casa Luckham atrás dos Lírios, com as raposas no encalço.' }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area pac-area' },
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Pontos: ', pontosEl),
          h('span', null, 'Nível ', nivelEl),
          vidasEl,
          plateiaEl,
          h('span', null, icone('trofeu'), ' ', recordeEl)),
        h('div', { class: 'cobra-moldura pac-moldura' }, tela, sobre),
        h('div', { class: 'dpad' },
          seta('cima', CIMA, 'Para cima'), seta('voltar', ESQ, 'Para a esquerda'),
          seta('frente', DIR, 'Para a direita'), seta('baixo', BAIXO, 'Para baixo'))),
      h('aside', { class: 'jogo-lateral pac-lateral' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Melhores')),
          ranking),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
          h('ul', { class: 'pac-legenda' },
            legenda(bolinha('#d8b13a', '8px'), nomeDe('pacman.lirio', 'Lírio'), 'vale 10 pontos.'),
            legenda(bolinha('#e8c24a', '16px'), nomeDe('pacman.lirio-grande', 'Lírio grande'), 'vale 50 e deixa as raposas com medo: aí dá para pegá-las (200, 400, 800, 1600).'),
            legenda(h('span', { class: 'pac-cenoura' }, '🥕'), nomeDe('pacman.cenoura', 'Cenoura'), 'aparece duas vezes por nível embaixo da toca. Vale bônus.'),
            RAPOSAS.map((r, k) => legenda(bolinha(r.cor, '14px'), nomeDe(CHAVES_RAPOSAS[k], r.nome), r.jeito)),
            legenda(icone('coelho'), 'Vida extra', 'aos 10.000 pontos.'))))));
}

/* ─── Junto: todos no mesmo labirinto (o jogo roda no servidor: src/junto-pac.js) ─── */

// As casas com Lírio na ordem do mapa e o mapa em 6 bits por letra (o mesmo do servidor).
const LISTA_MOEDAS = [];
for (let y = 0; y < LINHAS; y++) for (let x = 0; x < COLS; x++) if (MAPA[y][x] === '.' || MAPA[y][x] === 'o') LISTA_MOEDAS.push(y * COLS + x);
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const tipoMoeda = k => (MAPA[Math.floor(k / COLS)][k % COLS] === '.' ? 1 : 2);
function moedasDe(m) {
  const moedas = new Uint8Array(COLS * LINHAS);
  LISTA_MOEDAS.forEach((k, j) => { if ((BASE64.indexOf(m[Math.floor(j / 6)]) >> (j % 6)) & 1) moedas[k] = tipoMoeda(k); });
  return moedas;
}
function moedasCheias() {
  const moedas = new Uint8Array(COLS * LINHAS);
  for (const k of LISTA_MOEDAS) moedas[k] = tipoMoeda(k);
  return moedas;
}
const DIR_DO_NOME = { cima: CIMA, esquerda: ESQ, baixo: BAIXO, direita: DIR };
const CORES_RAPOSAS = [...RAPOSAS.map(r => r.cor), COR_BRASA]; // a 5ª (Brasa) vem com 3 ou mais
const ATRASO_MS = 90; // desenha um pouquinho no passado para ter sempre dois quadros entre os quais andar

// Mistura duas posições (o túnel conta; um salto grande, como voltar para o começo, não é misturado).
function misturar(a, b, k) {
  let dx = b[0] - a[0];
  if (Math.abs(dx) > COLS / 2) dx -= Math.sign(dx) * COLS;
  const dy = b[1] - a[1];
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return k < 0.5 ? [a[0], a[1]] : [b[0], b[1]];
  return [a[0] + dx * k, a[1] + dy * k];
}

function pacJunto() {
  const ganchos = {};
  const jt = juntoNoJogo('pacman', { aoLargar: () => ganchos.largar?.(), aoAcabar: s => ganchos.acabar?.(s) });
  if (!jt) return null;
  const coop = jt.modo === 'coop';
  const toque = matchMedia('(pointer: coarse)').matches;
  const desenho = criarDesenhoPac();
  const tela = desenho.tela;
  const sobre = h('div', { class: 'cobra-sobre', hidden: true });
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  const meusPontosEl = h('strong', null, '0');
  const liriosEl = h('strong', null, num(LISTA_MOEDAS.length));
  const vidasEl = h('span', { class: 'pac-vidas', title: 'Vidas da equipe' });
  const placar = h('div');
  const visual = jt.jogadores.map(p => ({ pelo: p.visual?.pelo || null, chapeu: p.visual?.roupa?.cabeca || null }));

  let moedas = moedasCheias();
  const quadros = []; // { t (ms de jogo), q, moedas }
  let base = Infinity;  // chegada - t: liga o relógio do servidor ao daqui
  let ultimo = null;
  let fimEm = 0;
  let acabou = false;
  let querDir = null;   // a última direção que eu pedi
  let animacao = 0;
  const inicio = performance.now();

  /* Quadros do servidor */

  function receber(q, acertarRelogio = true) {
    if (!q || !Array.isArray(q.c) || !Array.isArray(q.r)) return;
    if (q.m) moedas = moedasDe(q.m);
    const agora = performance.now();
    const t = (Number(q.t) || 0) * 1000;
    // A chegada mais cedo é a mais certa (a rede só atrasa); sobe devagar se o servidor engasgar.
    if (acertarRelogio && q.s === 'jogando') base = Math.min(agora - t, base + 2);
    const f = { t, q, moedas };
    const ult = quadros[quadros.length - 1];
    if (ult && t < ult.t) return;
    if (ult && t === ult.t) quadros[quadros.length - 1] = f; // o mesmo passo (veio depois de um comando)
    else quadros.push(f);
    if (quadros.length > 40) quadros.shift();
    if (q.s === 'fim' && !fimEm) fimEm = agora;
    ultimo = q;
    atualizarLado(q);
  }

  // O estado do desenho no momento "agora - atraso", entre os dois quadros em volta.
  function montar(agora) {
    if (!quadros.length) return null;
    let ia = quadros.length - 1;
    let b = null;
    let k = 0;
    if (base !== Infinity && !acabou) {
      const alvoT = agora - base - ATRASO_MS;
      ia = 0;
      for (let j = quadros.length - 1; j >= 0; j--) {
        if (quadros[j].t <= alvoT) { ia = j; b = quadros[j + 1] || null; break; }
      }
    }
    const a = quadros[ia];
    if (b) k = Math.max(0, Math.min(1, (agora - base - ATRASO_MS - a.t) / (b.t - a.t || 1)));
    const qa = a.q;
    const qb = b?.q;
    const anterior = quadros[ia - 1]?.q;
    const coelhos = qa.c.map((c, i) => {
      if (!c) return null;
      const cb = qb?.c?.[i];
      const [x, y] = cb && k > 0 ? misturar(c, cb, k) : [c[0], c[1]];
      const outro = cb || anterior?.c?.[i];
      const jog = jt.jogadores[i] || {};
      return {
        x, y, dir: DIRS[c[2]] || ESQ, estado: c[3],
        andando: c[3] <= 1 && qa.s === 'jogando' && !!outro && (outro[0] !== c[0] || outro[1] !== c[1]),
        cor: jog.cor || '#e8c24a', nome: jog.nome || `Jogador ${i + 1}`, pelo: visual[i]?.pelo, chapeu: visual[i]?.chapeu,
        eu: i === jt.eu, querDir: i === jt.eu && querDir ? DIR_DO_NOME[querDir] : null,
      };
    });
    const raposas = qa.r.map((r, i) => {
      const rb = qb?.r?.[i];
      const [x, y] = rb && k > 0 ? misturar(r, rb, k) : [r[0], r[1]];
      return { x, y, dir: DIRS[r[2]] || ESQ, modo: MODOS[r[3]] || 'normal', assustada: !!r[4], cor: CORES_RAPOSAS[i] || '#e2572f' };
    });
    const popups = (qa.pp || []).map(([x, y, valor, i]) => ({
      x, y, texto: valor < 0 ? `-${num(-valor)}` : num(valor), cor: valor < 0 ? '#e2572f' : jt.jogadores[i]?.cor || '#9fe0f0',
    }));
    return {
      moedas: a.moedas, situacao: qa.s, susto: Number(qa.su) || 0, cenoura: !!qa.ce, raposas, coelhos, popups,
      piscar: qa.f === 'limpou' && agora - fimEm < 2000,
    };
  }

  /* O lado da tela: pontos, vidas da equipe e o que está acontecendo comigo */

  const SITUACAO = ['jogando', 'voltou agora', 'foi pego', 'fora', 'saiu', 'foi pego'];
  let chaveLado = '';
  function atualizarLado(q) {
    const eu = q.c[jt.eu];
    meusPontosEl.textContent = num(eu ? eu[4] : 0);
    liriosEl.textContent = num(Math.max(0, LISTA_MOEDAS.length - (Number(q.mv) || 0)));
    const chave = JSON.stringify([q.c.map(c => (c ? [c[3], c[4]] : null)), q.v]);
    if (chave === chaveLado) return;
    chaveLado = chave;
    if (coop) trocar(vidasEl, Array.from({ length: Math.max(0, Math.min(12, q.v ?? 0)) }, () => icone('coelho')));
    const linhas = jt.jogadores.map((p, i) => {
      const c = q.c[i];
      return { i, nome: p.nome, cor: p.cor, pontos: c ? c[4] : 0, estado: c ? c[3] : 4 };
    });
    const ordem = coop ? linhas : [...linhas].sort((x, y) => y.pontos - x.pontos || x.i - y.i);
    const lista = h('ol', { class: 'desafio-lista' }, ordem.map(l =>
      h('li', { class: `${l.i === jt.eu ? 'eu-linha' : ''} ${l.estado === 3 || l.estado === 4 ? 'fora' : ''}`.trim() },
        h('span', { class: 'cobras-cor', style: { background: l.cor } }),
        h('span', { class: 'desafio-nome' }, l.nome, h('small', null, SITUACAO[l.estado] || '')),
        h('strong', null, num(l.pontos)))));
    if (coop) {
      const total = linhas.reduce((s, l) => s + l.pontos, 0);
      trocar(placar,
        h('div', { class: 'desafio-meta' },
          h('div', { class: 'desafio-meta-texto' }, icone('coracao'), ' Vidas da equipe: ', h('strong', null, String(q.v ?? 0))),
          h('div', { class: 'desafio-meta-texto' }, 'Pontos da equipe: ', h('strong', null, num(total)))),
        lista);
    } else {
      trocar(placar, lista);
    }
  }

  // Avisos em cima do labirinto: antes da largada, pego e fora.
  let avisoVisto = null;
  function atualizarAvisos() {
    let caixa = false;
    let texto = null;
    if (!acabou && !jt.largou()) caixa = true;
    else if (!acabou && ultimo) {
      const eu = ultimo.c[jt.eu];
      if (eu && (eu[3] === 2 || eu[3] === 5)) texto = eu[3] === 5 ? 'Você foi pego! A equipe ficou sem vidas.' : 'Você foi pego! Voltando...';
      else if (eu && eu[3] === 3) texto = 'Você está fora: assistindo';
    }
    const chave = `${caixa}|${texto}`;
    if (chave === avisoVisto) return;
    avisoVisto = chave;
    sobre.hidden = !caixa;
    if (caixa) {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Prepare-se!'),
        h('p', null, coop ? 'Todos juntos, do mesmo lado: limpem o labirinto com as vidas da equipe.' : 'Todos juntos, cada um por si: quem comer mais Lírios vence.'),
        h('p', null, 'O seu coelho tem o contorno na sua cor ', h('span', { class: 'cobras-cor', style: { background: jt.jogadores[jt.eu]?.cor } }), ' e o nome com borda dourada.'),
        h('p', { class: 'suave' }, toque ? 'Deslize o dedo no labirinto ou use as setas abaixo.' : 'Use as setas ou W A S D.')));
    }
    aviso_.hidden = !texto;
    if (texto) aviso_.textContent = texto;
  }

  /* Comandos: a direção vai para o servidor */

  function mandar() {
    if (!querDir || acabou || jt.tempo() < -0.4) return; // antes da largada fica guardada
    jt.evento({ tipo: 'dir', d: querDir });
  }
  function virar(nome) {
    if (acabou) return;
    querDir = nome;
    mandar();
  }
  ganchos.largar = () => mandar();
  ganchos.acabar = () => { acabou = true; atualizarAvisos(); };

  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const d = TECLAS[e.code];
    if (!d) return;
    e.preventDefault();
    const nome = nomeDir(d);
    if (e.repeat && nome === querDir) return; // segurando a tecla: só manda de novo se mudou
    virar(nome);
  };
  document.addEventListener('keydown', aoTeclar);
  let toqueInicio = null;
  tela.addEventListener('pointerdown', e => { toqueInicio = { x: e.clientX, y: e.clientY }; });
  tela.addEventListener('pointerup', e => {
    if (!toqueInicio) return;
    const dx = e.clientX - toqueInicio.x;
    const dy = e.clientY - toqueInicio.y;
    toqueInicio = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    virar(nomeDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR : ESQ) : (dy > 0 ? BAIXO : CIMA)));
  });

  /* Desenho a 60 quadros por segundo */

  function laco(agora) {
    animacao = requestAnimationFrame(laco);
    try {
      // Fui pego: a direção guardada some (o servidor também esquece).
      const eu = ultimo?.c?.[jt.eu];
      if (eu && eu[3] >= 2) querDir = null;
      const e = montar(agora);
      if (e) desenho.desenharJunto(e, (agora - inicio) / 1000);
      atualizarAvisos();
    } catch (err) {
      console.error('Pac-Coelho junto:', err); // um erro não pode travar o jogo
    }
  }

  jt.aoQuadro = q => { try { receber(q); } catch (e) { console.error('Pac-Coelho junto:', e); } };
  receber(jt.estado()?.quadro, false);
  animacao = requestAnimationFrame(laco);
  aoSair(() => {
    cancelAnimationFrame(animacao);
    jt.aoQuadro = () => {};
    document.removeEventListener('keydown', aoTeclar);
  });
  atualizarAvisos();

  const seta = (ic, d, rotulo) => h('button', { class: `dpad-${ic}`, type: 'button', 'aria-label': rotulo, onpointerdown: e => { e.preventDefault(); virar(nomeDir(d)); } }, icone(ic));
  const legenda = (el, nome, texto) => h('li', null, el, h('span', null, h('strong', null, nome), ' ', texto));
  const bolinha = (cor, tam) => h('span', { class: 'pac-bola', style: { '--cor': cor, '--tam': tam } });

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: `Pac-Coelho: ${coop ? 'co-op' : 'versus'}`, icone: 'coelho', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: coop ? 'Todos no mesmo labirinto para limpar os Lírios juntos, com as vidas da equipe.' : 'Todos no mesmo labirinto: vence quem comer mais Lírios. As raposas caçam quem estiver mais perto.',
    }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area pac-area' },
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Seus pontos: ', meusPontosEl),
          h('span', null, 'Lírios: ', liriosEl),
          coop && vidasEl),
        h('div', { class: 'cobra-moldura pac-moldura' }, tela, sobre, aviso_),
        h('div', { class: 'dpad' },
          seta('cima', CIMA, 'Para cima'), seta('voltar', ESQ, 'Para a esquerda'),
          seta('frente', DIR, 'Para a direita'), seta('baixo', BAIXO, 'Para baixo'))),
      h('aside', { class: 'jogo-lateral pac-lateral' },
        jt.painel,
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone(coop ? 'usuarios' : 'trofeu'), coop ? 'Equipe' : 'Pontos')),
          placar),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
          h('ul', { class: 'pac-legenda' },
            legenda(bolinha('#d8b13a', '8px'), nomeDe('pacman.lirio', 'Lírio'), 'vale 10 pontos para quem comer.'),
            legenda(bolinha('#e8c24a', '16px'), nomeDe('pacman.lirio-grande', 'Lírio grande'), 'vale 50 e assusta todas as raposas: quem pegar uma leva 200, 400, 800, 1600.'),
            legenda(h('span', { class: 'pac-cenoura' }, '🥕'), nomeDe('pacman.cenoura', 'Cenoura'), 'aparece duas vezes embaixo da toca: quem chegar primeiro leva.'),
            legenda(bolinha('#e2572f', '14px'), 'Raposas', `cada uma caça o coelho mais perto dela.${jt.n >= 3 ? ` Com 3 ou mais jogadores, vem também a ${nomeDe('pacman.raposa-brasa', 'Brasa')}.` : ''}`),
            coop
              ? legenda(icone('coelho'), 'Pego', 'gasta uma vida da equipe e volta em 2 segundos. Sem vidas, fica de fora.')
              : legenda(icone('coelho'), 'Pego', 'perde 10% dos pontos e volta em 2 segundos.'))))));
}
