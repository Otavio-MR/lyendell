// Corrida do Coelho: no estilo do dinossauro do Chrome. O coelho da Casa Luckham corre sozinho para a
// direita; pule (Espaço, ↑ ou toque) as pedras, os troncos, os caixotes de cenoura e os espinheiros, e abaixe
// (↓) dos gaviões, que de noite viram morcegos. Quanto mais longe, mais rápido; a cada 800 m o dia vira noite.
// Os pontos são os metros corridos, e cada Lírio pego vale 10 m de bônus.
//
// O caminho nasce da sorte da partida, obstáculo por obstáculo e sempre na mesma ordem, e a distância é só
// uma conta do tempo (a velocidade sobe com o relógio): quem tem a mesma sorte e o mesmo relógio corre
// exatamente o mesmo caminho, e o espaço entre dois obstáculos cresce com a velocidade (sempre dá para pousar
// e pular de novo).
// Jogo junto (ctx.junto): todos correm o MESMO caminho ao mesmo tempo, lado a lado (a distância é a do
// relógio da sala); cada um controla o pulo e o abaixar do seu coelho e manda a altura dele; os outros
// aparecem nas raias de trás. Versus: uma vida, quem sobrar vence. Co-op: vidas da equipe, quem cai volta
// correndo junto com os outros, e todos precisam cruzar a chegada (1000 m + 250 m por pessoa).

import { desenharCoelho, elipse, sombrear, PELOS } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, spriteDe } from '../sprites.js';

// Só o sprite daquela animação (sem trocar por outra animação da peça).
const temExato = (chave, anim) => !!spriteDe(`${chave}.${anim}`);

const LARGURA = 720;
const ALTURA = 270;
const CHAO = 226;            // onde pisam os pés do coelho (a beira da frente da pista)
const TOPO_PISTA = CHAO - 22; // onde começa a grama da pista (as raias de trás ficam aqui)
const X_COELHO = 86;         // o meio do coelho na tela (o caminho passa por ele)
const PX_M = 40;             // pixels por metro
const V0 = 400;              // velocidade na largada (px/s)
const VMAX = 880;            // velocidade máxima (sozinho)
const ACEL = 4.2;            // quanto a velocidade sobe por segundo
const V_PULO = 720;
const G_SOBE = 2400;         // gravidade subindo com o pulo apertado
const G_SOLTO = 7200;        // subindo depois de soltar (pulo curto)
const G_DESCE = 2800;
const G_RAPIDA = 9000;       // ↓ no ar: desce rápido
const V_RAPIDA = 420;
const COYOTE = 0.08;         // ainda dá para pular logo depois de sair do chão
const BUFFER = 0.13;         // o pulo apertado um pouco antes de pousar vale
const ABAIXA_TOQUE = 0.45;   // deslizar o dedo para baixo abaixa por um tempinho
const ALT_CORPO = 33;        // a altura do coelho que bate (as orelhas não contam)
const ALT_ABAIXADO = 18;
const ESCALA = 0.9;
const K_AVE = 0.15;          // as aves voam um pouco mais rápido que o chão anda
const T_VAO = 0.74;          // o vão mínimo entre dois obstáculos, em segundos de corrida
const VAO_FIXO = 60;
const PRIMEIRO = 900;        // onde fica o primeiro obstáculo (px)
const AVES_M = 450;          // a partir de quantos metros aparecem as aves
const LIRIO_M = 10;          // quantos metros de bônus vale um Lírio
const CICLO_M = 800;         // de quantos em quantos metros o dia vira noite
const DUR_MORTE = 0.9;
const ESPERA_RENASCER = 1.2; // segundos entre o "renasce" da sala e o coelho voltar
const PROTEGIDO = 2;         // segundos piscando (sem bater) depois de voltar
const PELO = '#e9dcc3';
const ACESSORIO = 'cachecol';
const OURO_CASA = '#e8c24a';
const FONTE = '"Trebuchet MS", system-ui, sans-serif';
const FONTE_PLACAR = '800 20px "Courier New", ui-monospace, monospace';
const FONTE_MELHOR = '800 15px "Courier New", ui-monospace, monospace';
const FONTE_MEDIA = `800 18px ${FONTE}`;
const FONTE_PEQ = `700 14px ${FONTE}`;
const FONTE_GRANDE = `900 30px ${FONTE}`;
const FONTE_AVISO = `800 16px ${FONTE}`;
const FONTE_NOME = `800 11px ${FONTE}`;
const FONTE_PLACA = `900 13px ${FONTE}`;
const VAZIO = new Set();
const nada = () => {};

let melhorSessao = 0;

// Os obstáculos do chão (o número é o tipo): largura, altura, a velocidade em que começam a aparecer, o
// quanto aparecem e a folga do desenho (a caixa que bate é um pouco menor que o desenho, para ser justo).
// 6: espinheiros juntos (2 ou 3); 7: ave (gavião de dia, morcego de noite), em três alturas.
const OBST = [
  { nome: 'pedra', w: 28, h: 20, vmin: 0, peso: 22, folga: 5 },
  { nome: 'pedras', w: 54, h: 22, vmin: 480, peso: 8, folga: 5 },
  { nome: 'tronco', w: 48, h: 26, vmin: 0, peso: 18, folga: 4 },
  { nome: 'caixote', w: 34, h: 32, vmin: 0, peso: 18, folga: 3 },
  { nome: 'caixotes', w: 68, h: 32, vmin: 540, peso: 7, folga: 3 },
  { nome: 'espinheiro', w: 26, h: 44, vmin: 0, peso: 20, folga: 4 },
  { nome: 'espinheiros', w: 50, h: 42, vmin: 560, peso: 7, folga: 4 },
];
const AVE = 7;
const AVE_W = 40;
const AVE_H = 18;
const AVE_BASE = [6, 24, 58]; // baixa (pule), no meio (abaixe), alta (passa por cima de quem corre)
const larguraEspinheiros = n => n * 24 + 2;
const ALTURAS_ESPINHO = [42, 34, 40];

/* ─── Sorte com semente (estado guardado num objeto, para dar para copiar o jogo) ─── */

function proximo(G) {
  G.s = (G.s + 0x6d2b79f5) >>> 0;
  let t = G.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (G, n) => Math.floor(proximo(G) * n);

// Enfeites (pedrinhas, flores, estrelas, nuvens): sempre iguais no mesmo lugar, sem gastar a sorte da partida.
function hash(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, n) => ((a % n) + n) % n;

/* ─── Velocidade e distância: só contas do tempo ─── */

// dif: a dificuldade da sala junto (1 sozinho). Mais gente: a velocidade sobe mais depressa e vai mais longe.
function ritmo(dif = 1) {
  const a = ACEL * (1 + (dif - 1) * 1.2);
  const vmax = VMAX + 60 * (dif - 1);
  const t1 = (vmax - V0) / a;
  return { a, vmax, t1, d1: V0 * t1 + (a * t1 * t1) / 2 };
}
const distancia = (R, t) => (t <= R.t1 ? V0 * t + (R.a * t * t) / 2 : R.d1 + R.vmax * (t - R.t1));
const velocidadeEm = (R, d) => (d >= R.d1 ? R.vmax : Math.sqrt(V0 * V0 + 2 * R.a * d));
const velocidadeNo = (R, t) => Math.min(R.vmax, V0 + R.a * t);

// 0 de dia, 1 de noite (com 40 m de entardecer e de amanhecer).
function noiteEm(m) {
  const c = mod(m, CICLO_M);
  if (c < 560) return 0;
  if (c < 600) return (c - 560) / 40;
  if (c < 760) return 1;
  return 1 - (c - 760) / 40;
}

/* ─── O caminho: um obstáculo por vez, sempre na mesma ordem ─── */

// meta: onde fica a chegada do co-op (px; null sem chegada). Depois dela não nasce mais nada.
const novoGerador = (semente, dif = 1, meta = null) => ({ s: semente >>> 0, x: PRIMEIRO, id: 0, lid: 0, dif, meta, ult: -1, rep: 0, fim: false });

function escolherTipo(G, v) {
  let soma = 0;
  for (const o of OBST) if (v >= o.vmin) soma += o.peso;
  let x = proximo(G) * soma;
  for (let t = 0; t < OBST.length; t++) {
    if (v < OBST[t].vmin) continue;
    x -= OBST[t].peso;
    if (x < 0) return t;
  }
  return 0;
}

// O vão mínimo depois de um obstáculo: o tempo de pousar e pular de novo, na velocidade daquele lugar.
const vaoMinimo = v => v * T_VAO + VAO_FIXO;

// Gera o próximo obstáculo (e, às vezes, Lírios no vão depois dele). Devolve false quando o caminho acabou.
function gerar(G, R, obs, lis) {
  if (G.fim) return false;
  if (G.meta != null && G.x > G.meta - 500) { G.fim = true; return false; }
  const v = velocidadeEm(R, G.x);
  const m = G.x / PX_M;
  const aperto = 1 + (G.dif - 1) * 0.9; // mais gente: os vãos extras ficam mais curtos
  let o;
  if (m >= AVES_M / (1 + (G.dif - 1) * 1.5) && G.ult !== AVE && proximo(G) < 0.16 + 0.06 * (G.dif - 1)) {
    const nivel = inteiro(G, 3);
    o = { id: G.id++, x: G.x, t: AVE, n: nivel, w: AVE_W, h: AVE_H, b: AVE_BASE[nivel], m: noiteEm(m) > 0.5 ? 1 : 0 };
  } else {
    let t = escolherTipo(G, v);
    if (t === G.ult && G.rep >= 1) t = escolherTipo(G, v); // o mesmo três vezes seguidas, quase nunca
    const n = t === 6 ? 2 + (v > 700 && proximo(G) < 0.5 ? 1 : 0) : 0;
    o = { id: G.id++, x: G.x, t, n, w: t === 6 ? larguraEspinheiros(n) : OBST[t].w, h: OBST[t].h, b: 0, m: 0 };
  }
  G.rep = o.t === G.ult ? G.rep + 1 : 0;
  G.ult = o.t;
  obs.push(o);
  const minimo = vaoMinimo(v);
  const vao = minimo * (1 + proximo(G) / aperto);
  if (proximo(G) < 0.32) {
    const ini = G.x + o.w;
    const k = proximo(G);
    if (k < 0.4) { // uma fileira no chão, no meio do vão (é só correr)
      const meio = ini + vao / 2;
      for (let i = -1; i <= 1; i++) lis.push({ id: G.lid++, x: meio + i * 30, a: 14 });
    } else if (k < 0.75 && o.t !== AVE) { // lá no alto, por cima do obstáculo (pulo inteiro)
      lis.push({ id: G.lid++, x: o.x + o.w / 2, a: 104 + inteiro(G, 10) });
    } else if (vao > minimo * 1.6 + v * 0.6) { // um arco no meio de um vão comprido
      const meio = ini + vao / 2;
      const meia = v * 0.25;
      for (let i = -2; i <= 2; i++) {
        const u = i / 2;
        lis.push({ id: G.lid++, x: meio + u * meia, a: 16 + 100 * (1 - u * u) });
      }
    }
  }
  G.x += o.w + vao;
  return true;
}

// Onde a coisa aparece na tela (as aves vêm um pouco mais depressa que o chão).
const telaX = (o, d) => (o.t === AVE ? X_COELHO + (o.x - d) * (1 + K_AVE) : X_COELHO + (o.x - d));

/* ─── Desenho ─── */

const ret = (g, cor, x, y, w, h) => { g.fillStyle = cor; g.fillRect(x, y, w, h); };
function poligono(g, cor, ...p) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
  g.fill();
}
// Texto com contorno (placar, avisos).
function texto(g, s, x, y, fonte, cor, contorno, larg) {
  g.font = fonte;
  g.lineWidth = larg;
  g.strokeStyle = contorno;
  g.strokeText(s, x, y);
  g.fillStyle = cor;
  g.fillText(s, x, y);
}
// Mistura duas cores (#rrggbb) pelo quanto é noite.
function misturar(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const pad = n => String(Math.max(0, Math.floor(n))).padStart(5, '0');

/* O céu, os morros e as nuvens (andam devagar: parecem longe) */

function ceu(g, d, n, t) {
  const gr = g.createLinearGradient(0, 0, 0, TOPO_PISTA);
  gr.addColorStop(0, misturar('#7cc4ec', '#0b1230', n));
  gr.addColorStop(1, misturar('#e4f3ef', '#2c3768', n));
  g.fillStyle = gr;
  g.fillRect(0, 0, LARGURA, TOPO_PISTA + 2);
  if (n > 0.02) { // estrelas piscando
    for (let i = 0; i < 40; i++) {
      const x = mod(hash(i, 1) * 900 - d * 0.02, 900) - 90;
      const y = 8 + hash(i, 2) * 120;
      const b = 0.5 + 0.5 * Math.sin(t * (1.5 + hash(i, 3) * 3) + i);
      g.globalAlpha = n * (0.35 + 0.65 * b);
      ret(g, '#fff8e0', Math.round(x), Math.round(y), hash(i, 4) < 0.2 ? 2 : 1, hash(i, 4) < 0.2 ? 2 : 1);
    }
    g.globalAlpha = 1;
  }
  // o sol de dia e a lua de noite (o mesmo lugar)
  if (n < 1) {
    g.globalAlpha = 1 - n;
    elipse(g, 548, 66, 30, 30, 'rgba(255,236,150,0.35)');
    elipse(g, 548, 66, 19, 19, '#ffe27a');
    elipse(g, 542, 60, 7, 7, '#fff3b8');
    g.globalAlpha = 1;
  }
  if (n > 0) {
    g.globalAlpha = n;
    elipse(g, 548, 64, 26, 26, 'rgba(220,230,255,0.16)');
    elipse(g, 548, 64, 16, 16, '#f4efd8');
    elipse(g, 555, 59, 14, 14, misturar('#7cc4ec', '#13204a', n));
    g.globalAlpha = 1;
  }
  nuvens(g, d, n, t);
  // morros de longe e de perto
  morros(g, d * 0.08, TOPO_PISTA - 52, 26, 0.0045, misturar('#a9cfa2', '#26314f', n), 3);
  morros(g, d * 0.22, TOPO_PISTA - 22, 18, 0.009, misturar('#86bf6a', '#1d3a36', n), 9);
  arvoresDeFundo(g, d * 0.22, n);
}

function morros(g, desloc, base, alto, freq, cor, semente) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(0, TOPO_PISTA + 2);
  for (let x = 0; x <= LARGURA; x += 12) {
    const w = x + desloc;
    const y = base - alto * (0.6 + 0.4 * Math.sin(w * freq + semente)) - alto * 0.35 * Math.sin(w * freq * 2.7 + semente * 2);
    g.lineTo(x, Math.round(y));
  }
  g.lineTo(LARGURA, TOPO_PISTA + 2);
  g.closePath();
  g.fill();
}

function arvoresDeFundo(g, desloc, n) {
  const passo = 70;
  const i0 = Math.floor(desloc / passo) - 1;
  for (let i = i0; i < i0 + LARGURA / passo + 3; i++) {
    if (hash(i, 11) < 0.45) continue;
    const x = Math.round(i * passo + hash(i, 12) * 40 - desloc);
    const r = 8 + hash(i, 13) * 7;
    const y = TOPO_PISTA - 4;
    ret(g, misturar('#6b4a2b', '#1b1626', n), x - 1, y - r * 0.8, 3, r * 0.8);
    elipse(g, x, y - r * 1.1, r * 0.75, r, misturar('#4e8f45', '#18302d', n));
    elipse(g, x - r * 0.2, y - r * 1.35, r * 0.35, r * 0.4, misturar('#66a957', '#1f3b35', n));
  }
}

function nuvens(g, d, n, t) {
  for (let i = 0; i < 6; i++) {
    const vel = 0.12 + hash(i, 21) * 0.12;
    const x = mod(hash(i, 22) * 1100 - d * vel - t * 4, 1100) - 160;
    const y = 22 + hash(i, 23) * 70;
    const e = 0.7 + hash(i, 24) * 0.6;
    g.globalAlpha = 1 - n * 0.55;
    nuvem(g, x, y, e, n);
  }
  g.globalAlpha = 1;
}
function nuvem(g, x, y, e, n = 0, semSprite = false) {
  if (!semSprite && desenharSprite(g, 'corrida.nuvem', 'parado', x, y, { escala: e })) return;
  const cor = misturar('#ffffff', '#5d6894', n);
  const sombra = misturar('#dfeaf2', '#454f7a', n);
  elipse(g, x, y + 4 * e, 30 * e, 8 * e, sombra);
  elipse(g, x - 14 * e, y + 1 * e, 13 * e, 9 * e, cor);
  elipse(g, x + 2 * e, y - 4 * e, 16 * e, 12 * e, cor);
  elipse(g, x + 17 * e, y + 1 * e, 11 * e, 8 * e, cor);
  ret(g, cor, x - 24 * e, y + 1 * e, 50 * e, 6 * e);
}

/* A pista: grama em cima (as raias) e o barranco de terra na frente */

const TILE = 48;
const ALT_TILE = ALTURA - TOPO_PISTA;
function pista(g, d, n, t) {
  const desloc = mod(d, TILE);
  const k0 = Math.floor(d / TILE);
  let comSprite = !!spriteDe('corrida.chao', 'grama');
  for (let i = -1; i <= LARGURA / TILE + 1; i++) {
    const x = Math.round(i * TILE - desloc + (X_COELHO % TILE));
    if (comSprite) comSprite = desenharSprite(g, 'corrida.chao', 'grama', x + TILE / 2, TOPO_PISTA, { t, largura: TILE + 1, altura: ALT_TILE });
    if (!comSprite) {
      pedacoDoChao(g, x, TOPO_PISTA);
      enfeitesDoChao(g, x, TOPO_PISTA, k0 + i);
    }
  }
  if (n > 0) { // de noite, vagalumes na grama
    for (let i = 0; i < 9; i++) {
      const x = mod(hash(i, 31) * 900 - d * 0.6, 900) - 90;
      const y = TOPO_PISTA - 10 - hash(i, 32) * 40 + Math.sin(t * 2 + i) * 5;
      g.globalAlpha = n * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.6 + i * 1.7)));
      elipse(g, x, y, 4, 4, 'rgba(240,255,140,0.35)');
      ret(g, '#f4ff9a', Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    g.globalAlpha = 1;
  }
}

// Um pedaço da pista (TILE de largura): sempre igual, para emendar com o vizinho.
function pedacoDoChao(g, x, y0) {
  ret(g, '#8fd068', x, y0, TILE + 1, 24);
  ret(g, '#7fc25a', x, y0 + 6, TILE + 1, 3);
  ret(g, '#7fc25a', x, y0 + 15, TILE + 1, 3);
  ret(g, '#a4dc7b', x, y0, TILE + 1, 2);
  ret(g, '#5e9e3f', x, y0 + 22, TILE + 1, 4); // a beirada da grama
  for (let k = 0; k < 4; k++) ret(g, '#5e9e3f', x + 4 + k * 12, y0 + 26, 5, 2 + (k % 2) * 2);
  ret(g, '#b98a55', x, y0 + 26, TILE + 1, ALT_TILE - 26);
  ret(g, '#a77a48', x, y0 + 40, TILE + 1, 3);
  ret(g, '#97693c', x, y0 + 56, TILE + 1, ALT_TILE - 56);
  ret(g, '#cf9f69', x + 6, y0 + 32, 6, 2);
  ret(g, '#cf9f69', x + 30, y0 + 48, 5, 2);
  ret(g, '#7f5832', x + 20, y0 + 36, 4, 3);
  ret(g, '#7f5832', x + 40, y0 + 60, 4, 2);
}
// Flores e pedrinhas que mudam de pedaço em pedaço (só no desenho de sempre).
function enfeitesDoChao(g, x, y0, k) {
  if (hash(k, 41) < 0.5) {
    const fx = x + 6 + Math.floor(hash(k, 42) * 34);
    const fy = y0 + 4 + Math.floor(hash(k, 43) * 12);
    const cor = ['#f4a3c0', '#f7e27a', '#ffffff', '#b9a4f0'][Math.floor(hash(k, 44) * 4)];
    ret(g, '#4f8f35', fx + 1, fy + 2, 1, 3);
    ret(g, cor, fx, fy, 3, 3);
  }
  if (hash(k, 45) < 0.6) {
    const px = x + Math.floor(hash(k, 46) * 40);
    const py = y0 + 30 + Math.floor(hash(k, 47) * 30);
    ret(g, '#8c8378', px, py, 5, 3);
    ret(g, '#a8a093', px + 1, py, 3, 1);
  }
  if (hash(k, 48) < 0.35) { // tufinho de grama
    const tx = x + Math.floor(hash(k, 49) * 40);
    ret(g, '#6fb24c', tx, y0 + 9, 2, 4);
    ret(g, '#6fb24c', tx + 3, y0 + 8, 2, 5);
    ret(g, '#6fb24c', tx + 6, y0 + 10, 2, 3);
  }
}

/* Os obstáculos (o desenho de sempre tem o pé no chão, em cx, y) */

function corpoPedra(g, cx, y, w = 28, h = 20) {
  elipse(g, cx, y - h * 0.46, w / 2, h * 0.56, '#77736b');
  elipse(g, cx - w * 0.07, y - h * 0.56, w * 0.42, h * 0.45, '#98948a');
  elipse(g, cx - w * 0.2, y - h * 0.72, w * 0.16, h * 0.15, '#c2bdb1');
  ret(g, '#625f58', Math.round(cx - w / 2 + 3), Math.round(y - 3), Math.round(w - 6), 3);
  elipse(g, cx + w * 0.14, y - h * 0.93, w * 0.2, h * 0.12, '#6f9a3c');
  elipse(g, cx + w * 0.26, y - h * 0.86, w * 0.08, h * 0.1, '#86b24c');
}
function corpoPedras(g, cx, y) {
  corpoPedra(g, cx - 10, y, 34, 22);
  corpoPedra(g, cx + 15, y, 24, 15);
}
function corpoTronco(g, cx, y) {
  const x = Math.round(cx - 24);
  ret(g, '#5e3b20', x + 4, y - 26, 44, 26);
  ret(g, '#8a5a32', x + 4, y - 24, 44, 19);
  ret(g, '#9e6b3e', x + 4, y - 24, 44, 4);
  g.fillStyle = '#6e4526';
  for (let k = 0; k < 4; k++) g.fillRect(x + 12 + k * 9, y - 19 + (k % 2) * 5, 6, 2);
  elipse(g, x + 5, y - 13, 6, 13, '#d9b07a');
  elipse(g, x + 5, y - 13, 4.2, 9.5, '#c49a62');
  elipse(g, x + 5, y - 13, 2, 4.5, '#a87a45');
  ret(g, '#5e3b20', x + 31, y - 32, 3, 7);
  elipse(g, x + 36, y - 33, 4.5, 2.3, '#5aa845', 0.4);
}
function caixote(g, cx, y) {
  const x = Math.round(cx - 17);
  for (let i = 0; i < 3; i++) { // as cenouras aparecendo
    const px = x + 8 + i * 9;
    const alto = i === 1 ? 2 : 0;
    poligono(g, '#ee8a26', px - 3, y - 25, px + 3, y - 25, px, y - 31 - alto);
    elipse(g, px - 1.2, y - 32 - alto, 1.4, 3, '#5aa845', -0.3);
    elipse(g, px + 1.2, y - 32 - alto, 1.4, 3, '#4f9a3c', 0.3);
  }
  ret(g, '#6e4526', x, y - 26, 34, 26);
  ret(g, '#c08a4c', x + 2, y - 24, 30, 22);
  ret(g, '#a8763d', x + 2, y - 17, 30, 2);
  ret(g, '#a8763d', x + 2, y - 10, 30, 2);
  poligono(g, '#8e6132', x + 2, y - 4, x + 6, y - 4, x + 32, y - 22, x + 28, y - 22);
  ret(g, '#d9a466', x + 2, y - 24, 30, 2);
  ret(g, '#4a3220', x + 4, y - 22, 2, 2);
  ret(g, '#4a3220', x + 28, y - 22, 2, 2);
  ret(g, '#4a3220', x + 4, y - 5, 2, 2);
  ret(g, '#4a3220', x + 28, y - 5, 2, 2);
}
function corpoCaixotes(g, cx, y) {
  caixote(g, cx - 17, y);
  caixote(g, cx + 17, y);
}
function corpoEspinheiro(g, cx, y, h = 44) {
  const x = Math.round(cx);
  const verde = '#2f6b34';
  ret(g, verde, x - 5, y - h + 5, 10, h - 5);
  elipse(g, x, y - h + 5, 5, 5, verde);
  ret(g, '#4f9a3c', x - 3, y - h + 5, 3, h - 8);
  // braços
  const ya = Math.round(y - h * 0.6);
  ret(g, verde, x - 12, ya, 8, 5);
  ret(g, verde, x - 12, ya - 10, 5, 12);
  elipse(g, x - 9.5, ya - 10, 2.5, 2.5, verde);
  const yb = Math.round(y - h * 0.42);
  ret(g, verde, x + 4, yb, 8, 5);
  ret(g, verde, x + 7, yb - 9, 5, 11);
  elipse(g, x + 9.5, yb - 9, 2.5, 2.5, verde);
  // espinhos e frutinhas
  g.fillStyle = '#efe6c2';
  for (let k = 0; k < Math.floor(h / 8); k++) {
    g.fillRect(x - 7, y - h + 9 + k * 8, 2, 1);
    g.fillRect(x + 5, y - h + 13 + k * 8, 2, 1);
  }
  g.fillRect(x - 14, ya - 4, 2, 1);
  g.fillRect(x + 12, yb - 3, 2, 1);
  elipse(g, x + 2, y - h + 12, 2, 2, '#c8323c');
  elipse(g, x - 9, ya - 13, 1.7, 1.7, '#c8323c');
  elipse(g, x + 10, yb - 12, 1.7, 1.7, '#c8323c');
}

const CHAVE_OBST = ['corrida.pedra', 'corrida.pedras', 'corrida.tronco', 'corrida.caixote', 'corrida.caixotes', 'corrida.espinheiro', 'corrida.espinheiro'];
const CORPO_OBST = [(g, cx, y) => corpoPedra(g, cx, y), corpoPedras, corpoTronco, (g, cx, y) => caixote(g, cx, y), corpoCaixotes, (g, cx, y) => corpoEspinheiro(g, cx, y)];

// Um obstáculo do chão. sx: a beira esquerda na tela.
function obstaculoChao(g, tipo, n, sx, t) {
  const w = tipo === 6 ? larguraEspinheiros(n) : OBST[tipo].w;
  elipse(g, sx + w / 2, CHAO + 1, w / 2 + 3, 3.5, 'rgba(40,30,10,0.25)');
  if (tipo === 6) {
    for (let k = 0; k < n; k++) {
      const cx = sx + 13 + k * 24;
      const h = ALTURAS_ESPINHO[k % 3];
      if (!desenharSprite(g, 'corrida.espinheiro', 'parado', cx, CHAO, { t, altura: h })) corpoEspinheiro(g, cx, CHAO, h);
    }
    return;
  }
  const cx = sx + w / 2;
  if (!desenharSprite(g, CHAVE_OBST[tipo], 'parado', cx, CHAO, { t })) CORPO_OBST[tipo](g, cx, CHAO);
}

/* As aves: o gavião de dia e o morcego de noite, voando para a esquerda */

function corpoGaviao(g, cx, cy, bate) {
  const asa = 0.3 + 0.7 * Math.sin(bate); // as asas batem mais para cima (não descem até o coelho abaixado)
  poligono(g, '#5a3d22', cx + 2, cy - 2, cx + 16, cy - 3 - asa * 15, cx + 25, cy - 1 - asa * 13, cx + 10, cy + 3);
  poligono(g, '#5a3d22', cx + 13, cy - 2, cx + 27, cy - 6, cx + 27, cy + 4, cx + 13, cy + 3);
  elipse(g, cx + 2, cy, 14, 6.5, '#7a5534');
  elipse(g, cx + 3, cy + 2.5, 9, 3.4, '#e8dcc4');
  elipse(g, cx - 12, cy - 3, 6.2, 5.6, '#f3ead8');
  poligono(g, '#f2b632', cx - 17, cy - 4.5, cx - 23, cy - 1, cx - 17, cy);
  elipse(g, cx - 13.5, cy - 4.5, 1.3, 1.3, '#1b1403');
  poligono(g, '#7a5534', cx - 5, cy - 2, cx + 6, cy - 3 - asa * 19, cx + 19, cy - 2 - asa * 17, cx + 8, cy + 2);
  poligono(g, '#4a301a', cx + 6, cy - 3 - asa * 19, cx + 19, cy - 2 - asa * 17, cx + 15, cy - 1 - asa * 14);
  ret(g, '#f2b632', Math.round(cx), Math.round(cy + 5), 2, 3);
  ret(g, '#f2b632', Math.round(cx + 4), Math.round(cy + 5), 2, 3);
}
function corpoMorcego(g, cx, cy, bate) {
  const asa = 0.25 + 0.75 * Math.sin(bate);
  for (const l of [-1, 1]) {
    const px = cx + l * 4;
    g.fillStyle = l < 0 ? '#3a2d4c' : '#2a2038';
    g.beginPath();
    g.moveTo(px, cy - 2);
    g.lineTo(cx + l * 24, cy - 4 - asa * 14);
    g.lineTo(cx + l * 20, cy + 2 - asa * 8);
    g.lineTo(cx + l * 15, cy - 1 - asa * 6);
    g.lineTo(cx + l * 10, cy + 3 - asa * 4);
    g.lineTo(px, cy + 3);
    g.closePath();
    g.fill();
  }
  elipse(g, cx, cy, 8, 6.5, '#463857');
  poligono(g, '#463857', cx - 6, cy - 4, cx - 5, cy - 11, cx - 2, cy - 5);
  poligono(g, '#463857', cx + 2, cy - 5, cx + 5, cy - 11, cx + 6, cy - 4);
  elipse(g, cx - 3, cy - 1.5, 1.5, 1.5, '#ffd54a');
  elipse(g, cx + 3, cy - 1.5, 1.5, 1.5, '#ffd54a');
  ret(g, '#f4efe6', Math.round(cx - 2), Math.round(cy + 2), 1, 2);
  ret(g, '#f4efe6', Math.round(cx + 1), Math.round(cy + 2), 1, 2);
}
// Uma ave (o meio do corpo em cx, cy). morcego: 1 de noite.
function ave(g, cx, cy, morcego, t, semSprite = false) {
  const chave = morcego ? 'corrida.morcego' : 'corrida.gaviao';
  if (!semSprite && desenharSprite(g, chave, 'voando', cx, cy, { t })) return;
  if (morcego) corpoMorcego(g, cx, cy, t * 16);
  else corpoGaviao(g, cx, cy, t * 12);
}

/* Lírio, a moeda da Casa (gira) */

function corpoLirio(g, x, y, t, fase = 0) {
  const lx = Math.max(0.15, Math.abs(Math.cos(t * 3.5 + fase)));
  elipse(g, x, y, 7 * lx, 8, '#a8781c');
  elipse(g, x, y, 5.8 * lx, 6.8, '#e8c24a');
  elipse(g, x - 1.4 * lx, y - 1.8, 2.2 * lx, 3, '#f7e08a');
  if (lx > 0.5) {
    elipse(g, x, y - 0.6, 1.2 * lx, 2.9, '#a8781c');
    elipse(g, x - 2.1 * lx, y + 0.3, 1 * lx, 2, '#a8781c', -0.6);
    elipse(g, x + 2.1 * lx, y + 0.3, 1 * lx, 2, '#a8781c', 0.6);
    g.fillStyle = '#a8781c';
    g.fillRect(x - 2.6 * lx, y + 1.8, 5.2 * lx, 1);
  }
}
function lirio(g, x, y, t, fase = 0) {
  if (desenharSprite(g, 'corrida.lirio', 'girando', x, y, { t: t + fase })) return;
  corpoLirio(g, x, y, t, fase);
}

/* A chegada do co-op: o pórtico com a placa e o xadrez no chão */

function chegada(g, x, t, semSprite = false) {
  if (x < -90 || x > LARGURA + 90) return;
  for (let i = 0; i < 6; i++) { // o xadrez atravessando a pista
    ret(g, i & 1 ? '#fff4d6' : '#2d2a26', Math.round(x - 5), TOPO_PISTA + i * 4, 5, 4);
    ret(g, i & 1 ? '#2d2a26' : '#fff4d6', Math.round(x), TOPO_PISTA + i * 4, 5, 4);
  }
  if (!semSprite && desenharSprite(g, 'corrida.chegada', 'balancando', x, CHAO, { t })) return;
  corpoChegada(g, x, CHAO, t);
}
function corpoChegada(g, x, y, t) {
  const xa = Math.round(x - 48);
  const xb = Math.round(x + 44);
  ret(g, '#6e4526', xa, y - 118, 5, 118);
  ret(g, '#6e4526', xb, y - 118, 5, 118);
  ret(g, '#9a6a3c', xa + 1, y - 118, 2, 118);
  ret(g, '#9a6a3c', xb + 1, y - 118, 2, 118);
  elipse(g, xa + 2.5, y - 121, 4.5, 4.5, OURO_CASA);
  elipse(g, xb + 2.5, y - 121, 4.5, 4.5, OURO_CASA);
  ret(g, '#8a5a1e', Math.round(x - 46), y - 114, 92, 22);
  ret(g, OURO_CASA, Math.round(x - 44), y - 112, 88, 18);
  ret(g, '#f6d978', Math.round(x - 44), y - 112, 88, 3);
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = FONTE_PLACA;
  g.fillStyle = '#5a3510';
  g.fillText('CHEGADA', x, y - 102);
  g.restore();
  const cores = [OURO_CASA, '#fff4d6', '#b23a48'];
  for (let i = 0; i < 8; i++) { // bandeirinhas
    const bx = x - 42 + i * 12;
    poligono(g, cores[i % 3], bx, y - 92, bx + 9, y - 92, bx + 4.5 + Math.sin(t * 4 + i) * 1.5, y - 82);
  }
}

/* O coelho */

// pose: 0 correndo, 1 subindo, 2 descendo, 3 abaixado, 4 descendo rápido (↓ no ar).
// vis: o visual do Club Coelho ({ pelo, roupa }) no jogo junto; sem ele, o coelho de sempre (com cachecol).
function coelho(g, x, yPes, pose, passo, esmaga, t, vis = null, esc = ESCALA) {
  const pelo = vis ? vis.pelo : PELO;
  if (pose === 3) {
    if (temExato('corrida.coelho', 'abaixado')) {
      desenharSprite(g, 'corrida.coelho', 'abaixado', x, yPes, { t: passo, cor: pelo, escala: esc / ESCALA });
      return;
    }
    g.save();
    g.translate(x, yPes);
    g.scale(esc, esc);
    coelhoAbaixado(g, 0, 0, pelo, passo, !vis || vis.roupa?.pescoco === 'cachecol');
    g.restore();
    return;
  }
  if (pose > 0) {
    if (temExato('corrida.coelho', 'pulando')) {
      desenharSprite(g, 'corrida.coelho', 'pulando', x, yPes, { quadro: pose === 1 ? 0 : 1, cor: pelo, escala: esc / ESCALA });
      return;
    }
    g.save();
    g.translate(x, yPes);
    g.rotate(pose === 1 ? -0.14 : pose === 4 ? 0.2 : 0.08);
    g.scale(esc * (pose === 1 ? 0.95 : 1), esc * (pose === 1 ? 1.07 : 1));
    desenharCoelho(g, 0, 0, vis ? { pelo, roupa: vis.roupa, acessorio: ACESSORIO, t } : { pelo, acessorio: ACESSORIO, t });
    g.restore();
    return;
  }
  g.save();
  g.translate(x, yPes);
  g.scale(esc * (1 + 0.12 * esmaga), esc * (1 - 0.16 * esmaga));
  desenharCoelho(g, 0, 0, vis
    ? { pelo, roupa: vis.roupa, acessorio: ACESSORIO, andando: true, passo, t }
    : { pelo, acessorio: ACESSORIO, andando: true, passo, t });
  g.restore();
}

// Abaixado: o corpo comprido e baixinho, as orelhas deitadas para trás, as patas correndo.
function coelhoAbaixado(g, x, y, pelo, passo, cachecol = true) {
  const escuro = sombrear(pelo, -0.18);
  const p = Math.sin(passo * 9) * 2.5;
  elipse(g, x, y + 1, 20, 4, 'rgba(0,0,0,0.25)');
  if (cachecol) { // a ponta do cachecol voando
    poligono(g, '#b23a48', x + 4, y - 12, x - 10, y - 14 + p, x - 13, y - 10 + p, x + 4, y - 9);
  }
  elipse(g, x - 18, y - 9, 4.5, 4.5, '#fbf8f1');
  elipse(g, x - 2, y - 8, 17, 8, pelo);
  elipse(g, x, y - 5, 10, 4.2, sombrear(pelo, 0.12));
  elipse(g, x - 9 + p, y - 1.5, 5.5, 2.6, escuro);
  elipse(g, x + 7 - p, y - 1.5, 5.5, 2.6, escuro);
  elipse(g, x + 2, y - 15, 11, 2.8, sombrear(pelo, -0.06), -0.1);
  elipse(g, x + 15, y - 9.5, 8, 7, pelo);
  elipse(g, x + 4, y - 16.5, 11, 3, pelo, -0.12);
  elipse(g, x + 4, y - 16.5, 8, 1.3, '#e9a7a0', -0.12);
  if (cachecol) ret(g, '#c8473c', Math.round(x + 5), Math.round(y - 12), 6, 5);
  elipse(g, x + 18.5, y - 11, 1.7, 1.9, '#1b1403');
  elipse(g, x + 19, y - 11.7, 0.6, 0.6, '#fff');
  elipse(g, x + 22.5, y - 8, 1.4, 1.2, '#e9867d');
}

// Caiu: tomba de costas, quica e fica com estrelinhas rodando. q: de 0 a 1.
function coelhoCaiu(g, x, yChao, q, t, vis = null, esc = ESCALA, semSprite = false) {
  const pelo = vis ? vis.pelo : PELO;
  if (!semSprite && temExato('corrida.coelho', 'caiu')) {
    desenharSprite(g, 'corrida.coelho', 'caiu', x, yChao, { progresso: q, cor: pelo, escala: esc / ESCALA });
    return;
  }
  const k = Math.min(1, q * 2.2);
  const quica = Math.sin(Math.PI * k) * 22;
  g.save();
  g.translate(x - k * 10, yChao - quica);
  g.rotate(-k * 1.75);
  g.scale(esc, esc);
  desenharCoelho(g, 0, 0, vis ? { pelo, roupa: vis.roupa, acessorio: ACESSORIO, t: 0, semSprite } : { pelo, acessorio: ACESSORIO, t: 0, semSprite });
  g.restore();
  if (k >= 1) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      estrelinha(g, x - 40 * esc + Math.cos(a) * 13, yChao - 22 * esc + Math.sin(a) * 4, 3, '#ffe27a');
    }
  }
}

function estrelinha(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rr = k % 2 ? r * 0.35 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/* O placar: metros como no dinossauro (cinco algarismos, piscando a cada 100 m) */

function hud(g, v, t) {
  const n = v.n || 0;
  const cor = misturar('#4a3826', '#f4ead2', n);
  const contorno = n > 0.5 ? 'rgba(10,12,30,0.7)' : 'rgba(255,255,255,0.75)';
  g.save();
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.textAlign = 'right';
  if (v.f !== 2) texto(g, pad(v.f === 1 ? v.fv : v.p), LARGURA - 14, 12, FONTE_PLACAR, cor, contorno, 4);
  g.globalAlpha = 0.75;
  texto(g, `MELHOR ${pad(v.h)}`, LARGURA - 92, 15, FONTE_MELHOR, cor, contorno, 3);
  g.globalAlpha = 1;
  lirio(g, 22, 22, t * 0.6);
  g.textAlign = 'left';
  texto(g, `× ${v.k || 0}`, 34, 12, FONTE_MEDIA, cor, contorno, 4);
  g.restore();
}

// Fim (sozinho): o aviso no meio da tela, com a setinha de recomeçar.
function avisoFim(g, q) {
  const k = limitar((q - 0.3) / 0.4, 0, 1);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = k;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  texto(g, 'FIM DA CORRIDA', LARGURA / 2, 86, FONTE_GRANDE, '#fff4d6', 'rgba(60,30,10,0.75)', 6);
  const cx = LARGURA / 2;
  const cy = 128;
  ret(g, 'rgba(60,30,10,0.6)', cx - 19, cy - 17, 38, 34);
  g.strokeStyle = '#fff4d6';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, 9, -Math.PI * 0.2, Math.PI * 1.45);
  g.stroke();
  poligono(g, '#fff4d6', cx + 4, cy - 11, cx + 13, cy - 9, cx + 7, cy - 1);
  g.restore();
}

/* Jogo junto: nomes, vidas e avisos */

function coracao(g, x, y, r, cheio) {
  g.beginPath();
  g.moveTo(x, y + r);
  g.bezierCurveTo(x - r * 1.5, y, x - r * 0.9, y - r * 1.2, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.9, y - r * 1.2, x + r * 1.5, y, x, y + r);
  g.closePath();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(38,28,16,0.55)';
  g.stroke();
  g.fillStyle = cheio ? '#e0455a' : 'rgba(255,255,255,0.35)';
  g.fill();
}
function etiqueta(g, s, x, y, cor) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  texto(g, s, x, y, FONTE_NOME, cor, 'rgba(30,20,10,0.8)', 3);
  g.restore();
}
// A faixa de aviso embaixo ("Você está fora: assistindo"...).
function faixaAviso(g, s) {
  g.save();
  g.font = FONTE_AVISO;
  const w = g.measureText(s).width + 32;
  const x = (LARGURA - w) / 2;
  const y = ALTURA - 38;
  ret(g, 'rgba(38,26,14,0.8)', x, y, w, 30);
  ret(g, OURO_CASA, x, y, w, 2);
  g.fillRect(x, y + 28, w, 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffe9a8';
  g.fillText(s, LARGURA / 2, y + 15);
  g.restore();
}
// info: { coop, vidas, faltam, prog, vivos, total, faixa }
function hudJunto(g, v, t, info) {
  hud(g, v, t);
  const n = v.n || 0;
  const cor = misturar('#4a3826', '#f4ead2', n);
  const contorno = n > 0.5 ? 'rgba(10,12,30,0.7)' : 'rgba(255,255,255,0.75)';
  g.save();
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.textAlign = 'center';
  if (info.coop) {
    const f = info.faltam;
    texto(g, f <= 0 ? 'Chegada!' : `Faltam ${f} m`, LARGURA / 2, 10, FONTE_PEQ, cor, contorno, 4);
    const w = 180;
    const x = LARGURA / 2 - w / 2;
    ret(g, 'rgba(38,28,16,0.45)', x - 2, 30, w + 4, 9);
    ret(g, '#fff4d6', x, 32, w, 5);
    ret(g, OURO_CASA, x, 32, Math.round(w * limitar(info.prog, 0, 1)), 5);
  } else {
    texto(g, `Vivos: ${info.vivos} de ${info.total}`, LARGURA / 2, 10, FONTE_PEQ, cor, contorno, 4);
  }
  if (info.vidas != null) {
    const nv = info.vidas;
    const xs = LARGURA - 22;
    if (nv <= 0) coracao(g, xs, 46, 7, false);
    else if (nv <= 5) for (let i = 0; i < nv; i++) coracao(g, xs - i * 18, 46, 7, true);
    else {
      coracao(g, xs - 30, 46, 7, true);
      g.textAlign = 'left';
      texto(g, `x${nv}`, xs - 20, 38, FONTE_PEQ, cor, contorno, 4);
    }
    if (info.coop) {
      g.textAlign = 'right';
      texto(g, 'Equipe', xs - Math.min(5, Math.max(1, nv)) * 18 + 4, 39, FONTE_PEQ, cor, contorno, 3);
    }
  }
  g.restore();
  if (info.faixa) faixaAviso(g, info.faixa);
}

// Desenha a cena inteira a partir de uma "vista" (a mesma coisa que vai para quem assiste).
// J (só no jogo junto): ganchos para os outros coelhos (atrás), os nomes e o placar junto.
function desenharCena(g, v, t, extra = null, J = null) {
  const d = v.d || 0;
  const n = v.n || 0;
  const b = v.b || [0, 0, 0, 0];
  g.save();
  ceu(g, d, n, t);
  pista(g, d, n, t);
  if (v.c != null) chegada(g, X_COELHO + (v.c - d), t);
  if (J) J.atras(g, t);
  for (const o of v.o || []) {
    if (o[1] === AVE) {
      const cy = CHAO - AVE_BASE[o[2]] - AVE_H / 2;
      elipse(g, o[0] + AVE_W / 2, CHAO + 1, 12, 2.5, 'rgba(40,30,10,0.12)');
      ave(g, o[0] + AVE_W / 2, cy, o[3], t + o[0] * 0.001);
    } else obstaculoChao(g, o[1], o[2], o[0], t);
  }
  for (const l of v.l || []) lirio(g, l[0], CHAO - l[1], t, l[0] * 0.013);
  if (!v.z) {
    if (v.e) coelhoCaiu(g, v.mx, CHAO - (v.ma || 0), v.q || 0, t, v.vis);
    else {
      const a = b[0];
      if (a > 1) elipse(g, X_COELHO, CHAO + 1, Math.max(5, 15 - a * 0.08), 3.5, `rgba(0,0,0,${Math.max(0.08, 0.25 - a * 0.0015)})`);
      if (b[4]) g.globalAlpha = 0.4;
      coelho(g, X_COELHO, CHAO - a, b[1], b[2], b[3], t, v.vis);
      g.globalAlpha = 1;
    }
  }
  if (extra) extra(g, d);
  if (n > 0) { // a noite escurece tudo um pouco (o céu já é de noite)
    g.fillStyle = `rgba(10,14,44,${0.3 * n})`;
    g.fillRect(0, 0, LARGURA, ALTURA);
  }
  if (J) {
    J.frente(g, v, t);
    J.hud(g, v, t);
  } else {
    hud(g, v, t);
    if (v.e) avisoFim(g, v.q || 0);
  }
  g.restore();
}

/* ─── Sprites: o que pode trocar de desenho (veja ../sprites.js) ─── */

const NOME_JOGO = 'Corrida do Coelho';
const PARADO = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const fasePrevia = (t, quadros, fps) => ((t * fps) / quadros) % 1;
const obstaculoPeca = (chave, nome, desc, largura, altura, previa) => ({
  chave, jogo: NOME_JOGO, nome, desc: `${desc} No chão, com o pé embaixo; a sombra o jogo desenha.`, largura, altura, ancora: 'pe', animacoes: PARADO, previa,
});

export const SPRITES = [
  {
    chave: 'corrida.coelho', jogo: NOME_JOGO, nome: 'Coelho pulando, abaixado e caído',
    desc: 'Só os momentos especiais do coelho na corrida: no ar (1º quadro subindo, 2º descendo), abaixado correndo (baixinho, com as orelhas deitadas) e caído quando bate. Correndo, vale o sprite do "Coelho do jogador". Olhando para a DIREITA. Desenhe em cinza claro e marque "pintar com a cor do jogador" para cada um ter o seu pelo.',
    largura: 52, altura: 56, ancora: 'pe', tingir: true,
    animacoes: [
      { id: 'pulando', nome: 'Pulando', quadros: 2, fps: 2 },
      { id: 'abaixado', nome: 'Abaixado', quadros: 4, fps: 10 },
      { id: 'caiu', nome: 'Caiu', quadros: 6, fps: 6 },
    ],
    previa: (g, anim, t) => {
      if (anim === 'abaixado') { g.save(); g.scale(ESCALA, ESCALA); coelhoAbaixado(g, 0, 0, PELO, t); g.restore(); return; }
      if (anim === 'caiu') { coelhoCaiu(g, 12, 0, fasePrevia(t, 6, 6), t, null, ESCALA, true); return; }
      g.save();
      g.rotate(Math.floor(t * 2) % 2 ? 0.08 : -0.14);
      g.scale(ESCALA, ESCALA);
      desenharCoelho(g, 0, 0, { pelo: PELO, acessorio: ACESSORIO, t: 0, semSprite: true });
      g.restore();
    },
  },
  obstaculoPeca('corrida.pedra', 'Pedra', 'Uma pedra com musgo, pequena: dá para pular com um pulinho.', 30, 22, g => corpoPedra(g, 0, 0)),
  obstaculoPeca('corrida.pedras', 'Duas pedras', 'Uma pedra grande e uma pequena, juntas (aparecem quando a corrida já está rápida).', 56, 24, g => corpoPedras(g, 0, 0)),
  obstaculoPeca('corrida.tronco', 'Tronco caído', 'Um tronco deitado no caminho, com a ponta cortada à esquerda e um galhinho.', 50, 34, g => corpoTronco(g, 0, 0)),
  obstaculoPeca('corrida.caixote', 'Caixote de cenouras', 'Um caixote de madeira cheio de cenouras aparecendo em cima.', 36, 36, g => caixote(g, 0, 0)),
  obstaculoPeca('corrida.caixotes', 'Dois caixotes', 'Dois caixotes de cenouras lado a lado.', 70, 36, g => corpoCaixotes(g, 0, 0)),
  obstaculoPeca('corrida.espinheiro', 'Espinheiro', 'O arbusto de espinhos, alto e fino como um cacto, com frutinhas vermelhas. O jogo junta dois ou três, de alturas diferentes.', 28, 46, g => corpoEspinheiro(g, 0, 0)),
  {
    chave: 'corrida.gaviao', jogo: NOME_JOGO, nome: 'Gavião',
    desc: 'O gavião que voa baixo de dia, de lado, voando para a ESQUERDA (o bico à esquerda), batendo as asas. As asas não devem descer muito (o coelho abaixado passa por baixo).',
    largura: 56, altura: 40, ancora: 'centro',
    animacoes: [{ id: 'voando', nome: 'Voando', quadros: 4, fps: 8 }],
    previa: (g, anim, t) => corpoGaviao(g, 0, 0, t * 12),
  },
  {
    chave: 'corrida.morcego', jogo: NOME_JOGO, nome: 'Morcego',
    desc: 'De noite, no lugar do gavião: o morcego voando para a ESQUERDA, batendo as asas.',
    largura: 52, altura: 36, ancora: 'centro',
    animacoes: [{ id: 'voando', nome: 'Voando', quadros: 4, fps: 10 }],
    previa: (g, anim, t) => corpoMorcego(g, 0, 0, t * 16),
  },
  {
    chave: 'corrida.lirio', jogo: NOME_JOGO, nome: 'Lírio',
    desc: 'A moeda da Casa, girando. Cada um vale 10 metros de bônus. O primeiro quadro também vai no placar.',
    largura: 16, altura: 18, ancora: 'centro',
    animacoes: [{ id: 'girando', nome: 'Girando', quadros: 6, fps: 10 }],
    previa: (g, anim, t) => corpoLirio(g, 0, 0, t),
  },
  {
    chave: 'corrida.chao', jogo: NOME_JOGO, nome: 'Chão da pista',
    desc: `Um pedaço da pista: a grama em cima (onde os coelhos correm, ${24} px) e o barranco de terra na frente. O jogo repete pela tela toda: desenhe até as bordas, emendando com o vizinho. De noite o jogo escurece.`,
    largura: TILE, altura: ALT_TILE, ancora: 'topo',
    animacoes: [{ id: 'grama', nome: 'Grama', quadros: 1, fps: 1 }],
    previa: g => pedacoDoChao(g, -TILE / 2, 0),
  },
  {
    chave: 'corrida.nuvem', jogo: NOME_JOGO, nome: 'Nuvem',
    desc: 'Uma nuvem do céu (o jogo muda o tamanho e deixa mais apagada de noite).',
    largura: 64, altura: 30, ancora: 'centro',
    animacoes: PARADO,
    previa: g => nuvem(g, 0, 0, 1, 0, true),
  },
  {
    chave: 'corrida.chegada', jogo: NOME_JOGO, nome: 'Pórtico da chegada',
    desc: 'No co-op do jogo junto: os dois postes, a placa "CHEGADA" e as bandeirinhas. O xadrez no chão o jogo desenha.',
    largura: 100, altura: 126, ancora: 'pe',
    animacoes: [{ id: 'balancando', nome: 'Balançando', quadros: 4, fps: 4 }],
    previa: (g, anim, t) => corpoChegada(g, 0, 0, t),
  },
];
registrarPecas(SPRITES);

/* ─── O jogo ─── */

function novoEstado(ctx) {
  const semente = Math.floor(ctx.sorte() * 4294967296) >>> 0;
  const J = ctx.junto || null;
  const dif = J ? Math.max(1, Number(J.dif) || 1) : 1;
  const n = J ? Math.max(1, Number(J.n) || J.jogadores?.length || 1) : 1;
  // co-op: a chegada fica mais longe quanto mais gente (1000 m + 250 m por pessoa)
  const metaM = J && J.modo === 'coop' ? 1000 + 250 * n : null;
  const E = {
    semente, dif, R: ritmo(dif), ger: novoGerador(semente, dif, metaM == null ? null : metaM * PX_M), obs: [], lis: [],
    tempo: 0, d: 0, dVivo: 0, a: 0, va: 0, abaixado: false, buffer: 0, coyote: COYOTE, auto: false, segAuto: false, rapido: false, abaixaToque: 0, esmaga: 0,
    pulos: 0, nLirios: 0, marco: 0, pisca: 0, piscaV: 0, morte: null, acabou: false, salto: 0,
  };
  if (J) {
    Object.assign(E, {
      metaM, metaPx: metaM == null ? null : metaM * PX_M, chegou: false, fora: false, morriEnviado: false, renascer: 0, protegido: 0,
      vez: 0, pontosEnviados: 0, relogioPontos: 1, ultimaPos: '', relogioPos: 0, pegos: new Set(),
    });
  }
  return E;
}

// copia: um jogo copiado (só nos testes e no robô) não mexe no melhor da sessão nem manda nada para a sala.
function montar(ctx, E, copia = false) {
  const som = copia ? nada : nome => { try { ctx.som?.(nome); } catch { /* sem som */ } };
  const parts = Array.from({ length: 50 }, () => ({ vida: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, tipo: 0 }));
  const J0 = ctx.junto || null;
  const J = J0 && copia ? { ...J0, pos: nada, evento: nada, pegar: nada, morri: nada, cheguei: nada, pontos: nada } : J0;
  const coop = !!J && J.modo === 'coop';
  const R = []; // cada pessoa da sala: o que ela mandou e onde o coelho dela aparece aqui

  /* O caminho em volta de quem corre: gera à frente e esquece o que ficou para trás */
  function gerarAte() {
    const ate = E.d + LARGURA * 1.4 + 300;
    const antes = E.lis.length;
    while (E.ger.x < ate && gerar(E.ger, E.R, E.obs, E.lis)) { /* um por vez */ }
    if (J && E.lis.length !== antes && E.pegos.size) E.lis = E.lis.filter(l => !E.pegos.has(l.id)); // alguém já pegou
    while (E.obs.length && E.obs[0].x + E.obs[0].w < E.d - 400) E.obs.shift();
    while (E.lis.length && E.lis[0].x < E.d - 200) E.lis.shift();
  }

  /* Partículas de enfeite (poeira, brilhos): só aqui o Math.random. x no caminho (anda com o chão), y na tela */
  function soltar(tipo, x, y, vx, vy, max) {
    for (const s of parts) {
      if (s.vida > 0) continue;
      s.tipo = tipo; s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.vida = max; s.max = max;
      return;
    }
  }
  function moverParticulas(dt) {
    for (const s of parts) {
      if (s.vida <= 0) continue;
      s.vida -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.tipo === 0) { s.vx *= 0.92; s.vy *= 0.9; } else s.vy += 60 * dt;
    }
  }
  function desenharParticulas(g, d) {
    for (const s of parts) {
      if (s.vida <= 0) continue;
      const k = s.vida / s.max;
      const x = X_COELHO + (s.x - d);
      if (s.tipo === 0) {
        g.globalAlpha = k * 0.7;
        elipse(g, x, s.y, 2.5 + (1 - k) * 4, 2 + (1 - k) * 2.5, '#efe1c4');
      } else {
        g.globalAlpha = k;
        const a = 1 + k * 2.5;
        ret(g, s.tipo === 2 ? '#ffffff' : '#ffe58a', x - a, s.y - 0.7, a * 2, 1.4);
        g.fillRect(x - 0.7, s.y - a, 1.4, a * 2);
      }
    }
    g.globalAlpha = 1;
  }
  const acaso = (a, b) => a + Math.random() * (b - a);
  const brilhos = (n, x, y) => { for (let i = 0; i < n; i++) soltar(1, x + acaso(-10, 10), y + acaso(-8, 8), acaso(-40, 40), acaso(-90, -20), acaso(0.4, 0.8)); };
  function poeira(n, forca = 1) {
    for (let i = 0; i < n; i++) soltar(0, E.d + acaso(-12, 8), CHAO - acaso(0, 4), acaso(-90, -20) * forca, acaso(-30, -5) * forca, acaso(0.25, 0.5));
  }
  function puf(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      soltar(0, x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * acaso(40, 80), Math.sin(a) * acaso(30, 60), acaso(0.35, 0.7));
    }
    for (let i = 0; i < 4; i++) soltar(2, x + acaso(-10, 10), y + acaso(-10, 10), acaso(-30, 30), acaso(-60, -10), acaso(0.4, 0.8));
  }

  /* O corpo do coelho */
  function caixaCoelho() {
    if (E.abaixado) return [X_COELHO - 16, X_COELHO + 19, E.a, E.a + ALT_ABAIXADO];
    return [X_COELHO - 12, X_COELHO + 14, E.a, E.a + ALT_CORPO];
  }
  function bateu() {
    const [x0, x1, y0, y1] = caixaCoelho();
    for (const o of E.obs) {
      const sx = telaX(o, E.d);
      if (sx > x1 + 6) break; // os de depois estão ainda mais longe
      const f = o.t === AVE ? 3 : OBST[o.t].folga;
      if (sx + f < x1 && sx + o.w - f > x0 && o.b + 2 < y1 && o.b + o.h - 2 > y0) return o;
    }
    return null;
  }

  // Pulo, pulo curto (soltou cedo), pulo guardado, abaixar e descer rápido.
  function fisica(dt, entrada) {
    const ap = entrada?.apertou || VAZIO;
    const segurando = !!(entrada?.pular || entrada?.cima);
    if (ap.has('pular') || ap.has('cima') || ap.has('toque')) {
      E.buffer = BUFFER;
      E.auto = !segurando; // toque ou deslizar: sem "segurar", vale o pulo inteiro
    }
    if (ap.has('baixo') && !entrada?.baixo) E.abaixaToque = ABAIXA_TOQUE; // deslizou o dedo para baixo
    E.abaixaToque = Math.max(0, E.abaixaToque - dt);
    let baixo = !!entrada?.baixo || E.abaixaToque > 0;
    E.buffer = Math.max(0, E.buffer - dt);
    E.coyote = E.a <= 0 ? COYOTE : Math.max(0, E.coyote - dt);
    if (E.buffer > 0 && E.coyote > 0) {
      E.va = V_PULO;
      E.buffer = 0;
      E.coyote = 0;
      E.segAuto = !!E.auto;
      E.abaixaToque = 0;
      baixo = !!entrada?.baixo;
      E.pulos++;
      som('pulo');
      poeira(3, 0.6);
    }
    E.rapido = false;
    if (E.a > 0 || E.va > 0) {
      let gr;
      if (baixo) { // ↓ no ar: desce rápido
        if (E.va > -V_RAPIDA) E.va = -V_RAPIDA;
        gr = G_RAPIDA;
        E.segAuto = false;
        E.rapido = true;
      } else if (E.va > 0) gr = segurando || E.segAuto ? G_SOBE : G_SOLTO;
      else {
        gr = G_DESCE;
        E.segAuto = false;
      }
      E.va -= gr * dt;
      E.a += E.va * dt;
      if (E.a <= 0) {
        E.a = 0;
        const forte = E.va < -700;
        E.va = 0;
        E.esmaga = 1;
        poeira(forte ? 6 : 3, forte ? 1.3 : 0.8);
      }
    }
    E.abaixado = baixo && E.a <= 0;
    if (E.a <= 0) E.rapido = false;
    E.esmaga = Math.max(0, E.esmaga - dt * 7);
    if (E.a <= 0 && !E.abaixado && Math.random() < dt * (3 + E.R.a)) poeira(1, 0.5); // o pó da corrida
  }

  function pegarLirios() {
    const [x0, x1, y0, y1] = caixaCoelho();
    for (let i = E.lis.length - 1; i >= 0; i--) {
      const l = E.lis[i];
      const sx = X_COELHO + (l.x - E.d);
      if (sx + 7 < x0 || sx - 7 > x1 || l.a + 7 < y0 || l.a - 7 > y1) continue;
      E.lis.splice(i, 1);
      if (J) { // junto: some aqui na hora; só conta quando a sala disser quem pegou primeiro
        E.pegos.add(l.id);
        J.pegar(`l:${l.id}`, 0);
      } else {
        E.nLirios++;
        som('moeda');
        brilhos(8, l.x, CHAO - l.a);
      }
    }
  }

  // A cada 100 m: o placar pisca e apita, como no dinossauro.
  function marcos() {
    const marco = Math.floor(E.dVivo / PX_M / 100);
    if (marco > E.marco) {
      E.marco = marco;
      E.pisca = 0.9;
      E.piscaV = marco * 100;
      som('alerta');
    }
  }

  function morrer(o) {
    E.morte = { t: 0, tipo: o.t, m: o.m, id: o.id, d: E.d, a: E.a };
    E.abaixado = false;
    som('bater');
    if (!copia && !J) melhorSessao = Math.max(melhorSessao, pontosAgora());
  }

  // Os metros só contam com o coelho correndo (no jogo junto, o caminho segue andando para quem caiu).
  const pontosAgora = () => Math.floor(E.dVivo / PX_M) + LIRIO_M * E.nLirios;

  // Um passo de quem está correndo (sozinho ou junto): o mundo já andou.
  function correr(dt, entrada, podeBater) {
    fisica(dt, entrada);
    if (podeBater) {
      const o = bateu();
      if (o) { morrer(o); return; }
    }
    pegarLirios();
  }

  /* ─── Jogo junto: os outros coelhos, a sala e a chegada ─── */

  function visualDe(jg, i) {
    const v = jg?.visual;
    const pelo = typeof v?.pelo === 'string' && /^#[0-9a-f]{6}$/i.test(v.pelo) ? v.pelo : PELOS[i % PELOS.length];
    return { pelo, roupa: v?.roupa && typeof v.roupa === 'object' ? v.roupa : null };
  }
  const estadoSala = () => { try { return J.estado?.() || null; } catch { return null; } };

  // Chegou a altura de alguém: guarda (e começa a queda, ou aparece de novo depois de renascer).
  function receber(o, d) {
    if (!o || o.i === J.eu || o.fora || !d || typeof d !== 'object') return;
    const a = limitar(Number(d.a) || 0, 0, 400);
    const v = limitar(Number(d.v) || 0, -2000, 2000);
    if (d.c) o.chegou = true;
    if (d.e) {
      if (!o.e) Object.assign(o, { e: 1, et: 0, md: Number.isFinite(Number(d.m)) ? Number(d.m) : E.d, ma: a });
      return;
    }
    if (o.e || o.sumido) { // renasceu: aparece caindo do céu, piscando
      Object.assign(o, { e: 0, sumido: false, a, alvo: a, va: v, b: d.b ? 1 : 0, pisca: PROTEGIDO });
      puf(E.d + o.raia[0], CHAO + o.raia[1] - a - 14);
      return;
    }
    o.alvo = a;
    o.va = v;
    o.b = d.b ? 1 : 0;
  }

  // Entre uma mensagem e outra, os outros seguem caindo pela gravidade (e a altura vai suave até a certa).
  function moverOutros(dt) {
    for (const o of R) {
      if (o.i === J.eu) continue;
      o.pisca = Math.max(0, o.pisca - dt);
      if (o.e) { o.et += dt; continue; }
      if (o.alvo > 0 || o.va > 0) {
        o.va -= (o.va > 0 ? G_SOBE : G_DESCE) * dt;
        o.alvo += o.va * dt;
        if (o.alvo <= 0) { o.alvo = 0; o.va = 0; }
      }
      o.a += (o.alvo - o.a) * Math.min(1, dt * 18);
    }
  }

  function pegou(i, chave) {
    const m = /^l:(\d+)$/.exec(String(chave));
    if (!m) return;
    const id = Number(m[1]);
    const k = E.lis.findIndex(l => l.id === id);
    const l = k >= 0 ? E.lis[k] : null;
    if (l) E.lis.splice(k, 1);
    E.pegos.add(id);
    if (i === J.eu) {
      E.nLirios++;
      som('moeda');
      brilhos(8, l ? l.x : E.d, CHAO - (l ? l.a : 20));
    }
  }

  function chegar() {
    E.chegou = true;
    J.cheguei();
    som('fase');
    brilhos(16, E.d, CHAO - 30);
  }

  function renascer() {
    const m = E.morte;
    if (m) puf(m.d - 10, CHAO - 12);
    Object.assign(E, {
      morte: null, morriEnviado: false, renascer: 0, a: 150, va: 0, abaixado: false, buffer: 0, segAuto: false, abaixaToque: 0,
      protegido: PROTEGIDO, vez: E.vez + 1,
    });
    puf(E.d, CHAO - 150);
    som('poder');
    if (coop && !E.chegou && E.metaPx != null && E.d >= E.metaPx) chegar();
  }

  // Manda a minha altura (só quando muda, ou uma vez por segundo); a sala segura uns 12 por segundo.
  function enviarPos(dt) {
    if (E.fora) return;
    const m = E.morte;
    const d = m
      ? { a: Math.round(m.a), v: 0, b: 0, e: 1, m: Math.round(m.d), r: E.vez }
      : { a: Math.round(E.a), v: Math.round(E.va), b: E.abaixado ? 1 : 0, e: 0, r: E.vez };
    if (E.chegou) d.c = 1;
    const chave = `${d.a}|${d.b}|${d.e}|${d.c ? 1 : 0}|${d.r}`;
    E.relogioPos += dt;
    if (chave === E.ultimaPos && E.relogioPos < 1) return;
    E.ultimaPos = chave;
    E.relogioPos = 0;
    J.pos(d);
  }

  // O quanto já corri (metros + bônus), no máximo umas 2 vezes por segundo.
  function progresso(dt) {
    E.relogioPontos += dt;
    const p = pontosAgora();
    if (p > E.pontosEnviados && E.relogioPontos >= 0.5) {
      E.relogioPontos = 0;
      E.pontosEnviados = p;
      J.pontos(p);
    }
  }

  // O relógio do jogo junto: o da sala. Anda passo a passo e corrige devagar (um quadro perdido ou dobrado
  // não dá tranco); se ficou muito para trás (aba escondida), pula de uma vez.
  function relogioJunto(dt) {
    if (copia) { E.tempo += dt; return; }
    const alvo = Number(J.tempo());
    if (!Number.isFinite(alvo) || alvo <= 0) { E.salto = 0; return; }
    const antes = E.tempo;
    if (alvo - E.tempo > SALTO_MAX) E.tempo = alvo;
    else {
      const erro = alvo - (E.tempo + dt);
      E.tempo = erro >= -dt / 2 && erro <= dt ? alvo : E.tempo + dt + limitar(erro, -dt / 2, dt);
    }
    E.salto = distancia(E.R, E.tempo) - distancia(E.R, antes);
  }

  function atualizarJunto(dt, entrada) {
    relogioJunto(dt);
    E.d = distancia(E.R, E.tempo);
    gerarAte();
    moverParticulas(dt);
    moverOutros(dt);
    E.protegido = Math.max(0, E.protegido - dt);
    if (E.morte) {
      const m = E.morte;
      m.t += dt;
      if (m.t >= DUR_MORTE && !E.morriEnviado) { E.morriEnviado = true; J.morri(); } // uma vez só
      if (E.renascer > 0 && (E.renascer -= dt) <= 0) renascer();
    } else if (!E.fora) {
      E.dVivo = E.d;
      // um salto grande do relógio (a aba ficou parada): perdoa as batidas daquele passo
      correr(dt, entrada, !E.chegou && E.protegido <= 0 && E.salto < 60);
      if (!E.morte && coop && !E.chegou && E.metaPx != null && E.d >= E.metaPx) chegar();
    }
    if (E.pisca > 0) E.pisca -= dt;
    marcos();
    progresso(dt);
    enviarPos(dt);
  }

  // As raias de trás, uma para cada um dos outros (mais para trás, mais para cima).
  const RAIAS = [[34, -6], [-30, -10], [62, -13], [-54, -16], [90, -19], [-76, -8], [118, -15]];
  const ordemRaias = [];

  if (J) {
    const n = Math.max(1, Number(J.n) || J.jogadores?.length || 1);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const jg = J.jogadores?.[i];
      const raia = i === J.eu ? [0, 0] : RAIAS[k++ % RAIAS.length];
      R.push({
        i, nome: String(jg?.nome || `Coelho ${i + 1}`).slice(0, 14), cor: jg?.cor || OURO_CASA, vis: visualDe(jg, i), raia,
        a: 0, alvo: 0, va: 0, b: 0, e: 0, et: 0, md: 0, ma: 0, pisca: 0, fora: false, chegou: false, sumido: false,
      });
    }
    for (const o of R) if (o.i !== J.eu) ordemRaias.push(o);
    ordemRaias.sort((a, b) => a.raia[1] - b.raia[1]); // de trás para a frente
    if (!copia) {
      J.aoPos = (i, d) => receber(R[i], d);
      J.aoPegou = (i, chave) => pegou(i, chave);
      J.aoRenascer = i => {
        if (i === J.eu) {
          if (E.morte && !E.fora && E.renascer <= 0) E.renascer = ESPERA_RENASCER;
          return;
        }
        const o = R[i];
        if (!o || o.fora || o.sumido) return;
        if (o.e) puf(o.md + o.raia[0] - 10, CHAO + o.raia[1] - 12);
        o.sumido = true; // some até mandar que voltou
      };
      J.aoFora = i => {
        if (i === J.eu) { E.fora = true; return; }
        const o = R[i];
        if (o && !o.fora) o.fora = true;
      };
      J.aoChegou = i => {
        const o = R[i];
        if (!o) return;
        o.chegou = true;
        if (i !== J.eu && !o.e) brilhos(8, E.d + o.raia[0], CHAO + o.raia[1] - 30);
      };
    }
  }

  function infoHud() {
    const est = estadoSala();
    const ps = est?.p || [];
    let vivos = 0;
    for (const p of ps) if (p && !p.fora && !p.saiu) vivos++;
    let faixa = null;
    if (E.fora) faixa = 'Você está fora: assistindo';
    else if (E.chegou) faixa = 'Você chegou! Esperando a equipe';
    else if (E.morte && E.renascer > 0) faixa = 'Voltando para a corrida...';
    else if (E.morte && E.morriEnviado && !coop) faixa = 'Caiu!';
    const vidasEquipe = Number(est?.vidasEquipe);
    const metros = Math.floor(E.d / PX_M);
    return {
      coop,
      vidas: coop ? (Number.isFinite(vidasEquipe) ? vidasEquipe : null) : E.fora || E.morte ? 0 : 1,
      faltam: coop && E.metaM != null ? Math.max(0, E.metaM - metros) : 0,
      prog: coop && E.metaM ? metros / E.metaM : 0,
      vivos, total: ps.length || R.length, faixa,
    };
  }

  const cena = J ? {
    atras(g, t) {
      const est = estadoSala();
      for (const o of ordemRaias) {
        const p = est?.p?.[o.i];
        if (o.sumido || (p && p.saiu) || ((o.fora || p?.fora) && !o.e)) continue;
        const x = X_COELHO + o.raia[0];
        const yc = CHAO + o.raia[1];
        g.save();
        g.globalAlpha = 0.62;
        if (o.e) {
          const cx = x + (o.md - E.d);
          if (cx > -80) coelhoCaiu(g, cx, yc - Math.max(0, o.ma * (1 - Math.min(1, o.et * 3))), Math.min(1, o.et / DUR_MORTE), t, o.vis, ESCALA * 0.86);
        } else {
          if (o.pisca > 0 && Math.floor(o.pisca * 8) % 2) g.globalAlpha = 0.25;
          const pose = o.b && o.a < 1 ? 3 : o.a > 1 ? (o.va > 0 ? 1 : 2) : 0;
          if (o.a > 1) elipse(g, x, yc + 1, 10, 2.5, 'rgba(0,0,0,0.15)');
          coelho(g, x, yc - o.a, pose, E.d / 300 + o.i * 0.37, 0, t, o.vis, ESCALA * 0.86);
        }
        g.restore();
      }
    },
    frente(g, v, t) {
      const est = estadoSala();
      for (const o of ordemRaias) {
        const p = est?.p?.[o.i];
        if (o.e || o.sumido || o.fora || p?.fora || p?.saiu) continue;
        etiqueta(g, o.nome, X_COELHO + o.raia[0], CHAO + o.raia[1] - o.a - 48, o.cor);
      }
      if (!v.z && !v.e) etiqueta(g, 'Você', X_COELHO, CHAO - (v.b?.[0] || 0) - (v.b?.[1] === 3 ? 26 : 54), R[J.eu]?.cor || OURO_CASA);
    },
    hud(g, v, t) { hudJunto(g, v, t, infoHud()); },
  } : null;

  // O que dá para ver agora (sem arredondar para desenhar; arredondado para a foto de quem assiste).
  function vista(arred) {
    const rd = arred ? Math.round : x => x;
    const rd2 = arred ? x => Math.round(x * 100) / 100 : x => x;
    const d = E.d;
    const o = [];
    for (const ob of E.obs) {
      const sx = telaX(ob, d);
      if (sx > LARGURA + 40) break;
      if (sx + ob.w < -80) continue;
      o.push([rd(sx), ob.t, ob.n, ob.m]);
    }
    const l = [];
    for (const li of E.lis) {
      const sx = X_COELHO + (li.x - d);
      if (sx > LARGURA + 20) break;
      if (sx > -20) l.push([rd(sx), rd(li.a)]);
    }
    const m = E.morte;
    const pose = E.abaixado ? 3 : E.a > 0 ? (E.rapido ? 4 : E.va > 0 ? 1 : 2) : 0;
    const f = E.pisca > 0 ? (Math.floor(E.pisca * 7) % 2 ? 2 : 1) : 0;
    const v = {
      d: rd(d), n: rd2(noiteEm(d / PX_M)), o, l,
      b: [rd(E.a), pose, rd2(d / 300), rd2(E.esmaga), J && E.protegido > 0 && Math.floor(E.protegido * 8) % 2 ? 1 : 0],
      e: m ? 1 : 0, p: pontosAgora(), k: E.nLirios, h: Math.max(melhorSessao, J ? 0 : pontosAgora()), f, fv: E.piscaV,
    };
    if (m) Object.assign(v, { q: rd2(Math.min(1, m.t / DUR_MORTE)), mx: rd(X_COELHO + (m.d - d)), ma: rd(m.a * Math.max(0, 1 - m.t * 3)) });
    if (J) {
      v.h = Math.max(melhorSessao, pontosAgora());
      v.vis = R[J.eu]?.vis || null;
      if (E.fora) v.z = 1; // fora: o meu coelho some (só assisto)
      if (E.metaPx != null) v.c = E.metaPx;
    }
    return v;
  }

  if (!E.obs.length) gerarAte();

  return {
    get pontos() { return pontosAgora(); },
    get acabou() { return E.acabou; },

    atualizar(dt, entrada) {
      if (E.acabou) return;
      if (J) { atualizarJunto(dt, entrada); return; } // junto: nunca acaba por aqui (quem encerra é a sala)
      moverParticulas(dt);
      if (E.morte) { // sozinho, o mundo para (como no dinossauro)
        E.morte.t += dt;
        if (E.morte.t >= DUR_MORTE) E.acabou = true;
        return;
      }
      E.tempo += dt;
      E.d = distancia(E.R, E.tempo);
      E.dVivo = E.d;
      gerarAte();
      correr(dt, entrada, true);
      if (E.pisca > 0) E.pisca -= dt;
      marcos();
    },

    desenhar(g, t) {
      desenharCena(g, vista(false), t, desenharParticulas, cena);
    },

    resumo() {
      const metros = Math.floor(E.dVivo / PX_M);
      const k = E.nLirios;
      const m = E.morte;
      const titulos = [
        'Tropeçou na pedra!', 'Tropeçou nas pedras!', 'Tropeçou no tronco!', 'Trombou no caixote de cenouras!',
        'Trombou nos caixotes de cenouras!', 'Ai! Espinhos!', 'Ai! Espinhos!',
      ];
      const titulo = !m ? 'Fim da corrida' : m.tipo === AVE ? (m.m ? 'Um morcego no caminho!' : 'O gavião pegou!') : titulos[m.tipo] || 'Fim da corrida';
      const p = pontosAgora();
      return {
        titulo,
        linhas: [`Você correu ${metros} m.`, `Lírios: ${k} (+${k * LIRIO_M} m de bônus)`, `Melhor desta sessão: ${Math.max(melhorSessao, p)}`],
        detalhe: `${metros} m, ${k} ${k === 1 ? 'Lírio' : 'Lírios'}`,
      };
    },

    foto: () => vista(true),

    usarSegredo: () => false,
    mudouSegredo: nada,

    // Ganchos para os testes no Node (não mexem no jogo).
    teste: {
      estado: () => E,
      outros: () => R,
      clonar: () => montar({ ...ctx, som: nada }, structuredClone(E), true),
      // o caminho que existe agora: [id, x, tipo, n, base, morcego]
      mundo: () => E.obs.map(o => [o.id, o.x, o.t, o.n, o.b, o.m]),
      lirios: () => E.lis.map(l => [l.id, l.x, l.a]),
      // o caminho gerado do zero até "ate" metros (o mesmo para quem tem a mesma semente e dificuldade)
      caminho(ate) {
        const G = novoGerador(E.semente, E.dif, E.ger.meta);
        const obs = [];
        const lis = [];
        while (G.x < ate * PX_M && gerar(G, E.R, obs, lis)) { /* tudo */ }
        return { obs, lis };
      },
      // já passou do coelho (ou sumiu)?
      passou: id => {
        const o = E.obs.find(x => x.id === id);
        return !o || telaX(o, E.d) + o.w < X_COELHO - 20;
      },
      velocidade: () => velocidadeNo(E.R, E.tempo),
      ritmo: () => E.R,
    },
  };
}

const SALTO_MAX = 0.5;

export default {
  id: 'corrida',
  nome: 'Corrida do Coelho',
  icone: 'coelho',
  sub: 'Corra sem parar: pule as pedras, os troncos e os espinheiros e abaixe dos gaviões. Quanto mais longe, mais rápido.',
  subJunto: {
    versus: 'Todos no mesmo caminho, ao mesmo tempo, cada um por si: uma vida só, quem sobrar correndo vence.',
    coop: 'Todos no mesmo caminho e do mesmo lado: a equipe inteira precisa cruzar a chegada.',
  },
  largura: LARGURA,
  altura: ALTURA,
  cor: '#7cc4ec',
  controles: { cima: false, baixo: true, pular: 'Pular', acao: null, deslizar: true, cimaPula: true, semLados: true },
  instrucoes: {
    teclado: 'Espaço ou ↑ pula (segure para ir mais alto). ↓ abaixa; no ar, desce rápido.',
    toque: 'Toque na tela para pular e deslize para baixo para abaixar (ou use o botão Pular e a seta para baixo).',
  },
  comoJogar: [
    ['🐰', 'Corrida', 'O coelho corre sozinho. Quanto mais longe, mais rápido.'],
    ['⬆️', 'Pular', 'Espaço ou ↑. Segurando, o pulo vai mais alto; soltando cedo, é um pulinho.'],
    ['⬇️', 'Abaixar', '↓ abaixa para passar embaixo das aves. No ar, faz o coelho descer rápido.'],
    ['🪨', 'Obstáculos', 'Pedras, troncos, caixotes de cenouras e espinheiros: pule todos.'],
    ['🦅', 'Aves', 'O gavião (de noite, o morcego) voa em três alturas: pule, abaixe ou deixe passar por cima.'],
    ['🌙', 'Dia e noite', 'A cada 800 m o céu escurece, e depois amanhece de novo.'],
    ['🏵️', 'Lírios', 'Cada Lírio pego vale 10 m de bônus. Os pontos são os metros.'],
  ],
  criar(ctx) {
    return montar(ctx, novoEstado(ctx));
  },
  desenharFoto(g, foto, t) {
    if (foto) desenharCena(g, foto, t);
  },
};
