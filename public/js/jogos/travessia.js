// Travessia: o coelho da Casa Luckham atravessa campos, estradas de terra, rios e trilhos, pulando de casinha
// em casinha, o mais longe que conseguir. O mundo nasce da sorte da partida, faixa por faixa e sempre na mesma
// ordem, e tudo que anda (carroças, troncos, trens, vitórias-régias que afundam) é só uma conta do tempo:
// no desafio, quem tem a mesma sorte atravessa exatamente o mesmo mundo.
// O desenho é "de bloquinhos" visto do alto: cada coisa tem o topo mais claro e a frente mais escura.

import { desenharCoelho, elipse, sombrear } from '../desenho-coelho.js';

const LARGURA = 432;
const ALTURA = 576;
const COLUNAS = 9;
const CEL = 48;
const TODAS = (1 << COLUNAS) - 1;
const DUR_PULO = 0.13;
const OCIO_MAX = 7;            // segundos sem ir para frente até o gavião descer
const MARGEM = 210;            // quanto as coisas andam fora da tela antes de dar a volta
const AVISO = 1;               // segundos de sino antes do trem aparecer
const PERIODO_AFUNDA = 4.2;    // ciclo da vitória-régia que afunda
const VAO_TRONCO = 40;
const ESCALA = 0.8;            // tamanho do coelho
const PELO = '#e9dcc3';
const ACESSORIO = 'cachecol';
const OURO_PELO = '#e8c24a';
const COMP_VEIC = [64, 92, 110, 130]; // leiteiro, carroça, mercador, feno (cavalo incluído)
const NOME_VEIC = ['pela carroça do leiteiro', 'pela carroça', 'pela carroça do mercador', 'pela carroça de feno'];
const DUR_MORTE = { carroca: 1, trem: 1.1, agua: 1, correnteza: 1, afundou: 1, gaviao: 1.5 };
const COD_MORTE = { carroca: 1, agua: 2, correnteza: 2, afundou: 2, gaviao: 3, trem: 4 };
const COD_TIPO = { g: 0, e: 1, t: 2, n: 3, f: 4 };
const ACAO = { cima: 'cima', toque: 'cima', pular: 'cima', baixo: 'baixo', esq: 'esq', dir: 'dir' };
const FANTASMA = 'travessia-fantasma';
const OURO = 'travessia-ouro';
const NOITE = 'travessia-noite';
const FONTE = '"Trebuchet MS", system-ui, sans-serif';
const FONTE_PONTOS = `900 46px ${FONTE}`;
const FONTE_MEDIA = `800 22px ${FONTE}`;
const FONTE_PEQ = `700 15px ${FONTE}`;
const FONTE_AVISO = `800 17px ${FONTE}`;

let melhorSessao = 0;

/* ─── Sorte com semente (estado guardado num objeto, para dar para copiar o jogo) ─── */

function proximo(G) {
  G.s = (G.s + 0x6d2b79f5) >>> 0;
  let t = G.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (G, n) => Math.floor(proximo(G) * n);

// Enfeites (flores, tufos, cores): sempre iguais para a mesma faixa, sem gastar a sorte da partida.
function hash(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const colunaDoX = x => limitar(Math.round((x - 24) / CEL), 0, COLUNAS - 1);

/* ─── Geração do mundo: uma faixa por vez, sempre na mesma ordem ─── */

// Colunas alcançáveis: a partir das sementes, anda para os lados pelas casas livres.
function espalhar(livres, sementes) {
  let m = sementes & livres;
  for (;;) {
    const n = (m | (m << 1) | (m >> 1)) & livres;
    if (n === m) return m;
    m = n;
  }
}
function colunaDe(G, mascara) {
  let n = 0;
  for (let c = 0; c < COLUNAS; c++) if (mascara & (1 << c)) n++;
  let k = inteiro(G, n);
  for (let c = 0; c < COLUNAS; c++) if (mascara & (1 << c)) { if (k === 0) return c; k--; }
  return 4;
}
// Cada pedaço alcançável da fileira de trás ganha pelo menos uma saída para frente (sem beco sem saída).
function garantirSaidas(G, livres) {
  let resto = G.alcance;
  while (resto) {
    const pedaco = espalhar(G.alcance, resto & -resto);
    if (!(livres & pedaco)) livres |= 1 << colunaDe(G, pedaco);
    resto &= ~pedaco;
  }
  return livres;
}

const dificuldade = r => limitar((r - 10) / 260, 0, 1);

// alcance: colunas por onde dá para chegar na faixa atual (o caminho nunca fecha)
const novoGerador = semente => ({ s: semente >>> 0, r: -6, tipo: 'g', resta: 0, dir: 1, alcance: 1 << 4 });

function gerarFaixa(G) {
  const r = G.r++;
  if (r < 0) return gerarGrama(G, r, 1);
  if (r <= 2) return gerarGrama(G, r, r === 0 ? 0.1 : 0.16);
  if (G.resta <= 0) escolherCorrida(G, r);
  G.resta--;
  const d = dificuldade(r);
  if (proximo(G) < 0.72) G.dir = -G.dir; // faixas vizinhas costumam andar para lados opostos
  if (G.tipo === 'g') return gerarGrama(G, r, 0.13 + 0.2 * d + proximo(G) * 0.1);
  if (G.tipo === 'e') return gerarEstrada(G, r, d);
  if (G.tipo === 'f') return gerarTrilho(G, r, d);
  return r > 14 && proximo(G) < 0.22 + 0.18 * d ? gerarNenufares(G, r, d) : gerarTroncos(G, r, d);
}

// Corridas temáticas: um pedaço de campo, depois algumas estradas, ou um rio, ou trilhos.
function escolherCorrida(G, r) {
  const d = dificuldade(r);
  const ant = G.tipo;
  let tipo;
  if (ant !== 'g' && (r < 30 || proximo(G) < 0.68)) tipo = 'g';
  else {
    const pe = ant === 'e' ? 0 : 0.45;
    const pr = ant === 'rio' ? 0 : 0.35;
    const pf = ant === 'f' || r < 12 ? 0 : 0.2;
    const x = proximo(G) * (pe + pr + pf);
    tipo = x < pe ? 'e' : x < pe + pr ? 'rio' : 'f';
  }
  const curto = r < 12;
  let n;
  if (tipo === 'g') n = 1 + inteiro(G, r < 40 ? 3 : 2);
  else if (tipo === 'e') n = 1 + inteiro(G, curto ? 2 : 2 + Math.round(d * 3));
  else if (tipo === 'rio') n = 1 + inteiro(G, curto ? 2 : 2 + Math.round(d * 2));
  else n = 1 + (proximo(G) < 0.2 + 0.35 * d ? 1 : 0);
  G.tipo = tipo;
  G.resta = n;
}

// Bloqueios do campo: 1 árvore, 2 pedra, 3 arbusto, 4 poste com lanterna, 5 fardo de feno.
function escolherBloqueio(G, muro) {
  const p = proximo(G);
  if (muro) return p < 0.75 ? 1 : p < 0.9 ? 3 : 2;
  return p < 0.48 ? 1 : p < 0.66 ? 2 : p < 0.84 ? 3 : p < 0.94 ? 5 : 4;
}

function gerarGrama(G, r, dens) {
  const muro = r < 0;
  const bloq = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let livres = 0;
  for (let c = 0; c < COLUNAS; c++) {
    if (muro || proximo(G) < dens) bloq[c] = escolherBloqueio(G, muro);
    else livres |= 1 << c;
  }
  let cenoura = -1;
  if (!muro) {
    if (r === 0) livres |= 1 << 4;
    livres = garantirSaidas(G, livres);
    for (let c = 0; c < COLUNAS; c++) if (livres & (1 << c)) bloq[c] = 0;
    G.alcance = espalhar(livres, G.alcance);
    if (r > 3 && proximo(G) < 0.15) cenoura = colunaDe(G, G.alcance);
  }
  return { r, tipo: 'g', bloq, bs: bloq.join(''), cenoura };
}

// Espalha os objetos numa volta de comprimento L, com pelo menos "vao" entre um e outro.
function distribuir(G, comps, L, vao) {
  const soma = comps.reduce((s, c) => s + c, 0);
  const sobra = Math.max(0, L - soma - comps.length * vao);
  const pesos = comps.map(() => 0.75 + proximo(G) * 0.5);
  const sp = pesos.reduce((s, p) => s + p, 0);
  let b = proximo(G) * L;
  return comps.map((c, i) => {
    const atual = b % L;
    b += c + vao + (sobra * pesos[i]) / sp;
    return atual;
  });
}

function gerarEstrada(G, r, d) {
  const suave = r < 12;
  const principal = suave ? (proximo(G) < 0.55 ? 0 : 1) : inteiro(G, 4);
  const base = suave ? 36 + 20 * proximo(G) : 44 + 26 * proximo(G) + d * (85 + 45 * proximo(G));
  const vel = base * [1.15, 1, 0.92, 0.8][principal];
  const L = 700 + 220 * proximo(G) - 50 * d;
  const vao = 100 + vel * 0.4; // espaço mínimo entre duas carroças
  const n = suave ? 1 + (proximo(G) < 0.35 ? 1 : 0) : 1 + inteiro(G, 2 + Math.round(d * 2.5));
  const tipos = [];
  for (let i = 0; i < n; i++) tipos.push(proximo(G) < 0.7 ? principal : inteiro(G, suave ? 2 : 4));
  const total = () => tipos.reduce((s, t) => s + COMP_VEIC[t] + vao, 0);
  while (tipos.length > 1 && total() > L) tipos.pop();
  const bases = distribuir(G, tipos.map(t => COMP_VEIC[t]), L, vao);
  G.alcance = TODAS;
  return { r, tipo: 'e', dir: G.dir, vel, L, objs: tipos.map((t, i) => ({ b: bases[i], t })) };
}

function gerarTroncos(G, r, d) {
  const suave = r < 12;
  const vel = suave ? 26 + 16 * proximo(G) : 30 + 22 * proximo(G) + d * (40 + 30 * proximo(G));
  const L = 660 + 160 * proximo(G);
  const cobertura = suave ? 0.62 : 0.6 - 0.25 * d;
  const celulas = suave ? [3, 4] : d < 0.45 ? [2, 3, 4] : [2, 3, 3];
  const comps = [];
  let soma = 0;
  while (comps.length < 6) {
    const c = celulas[inteiro(G, celulas.length)] * CEL - 6;
    if (comps.length && soma + c + (comps.length + 1) * VAO_TRONCO > L) break;
    comps.push(c);
    soma += c;
    // para quando cobriu o bastante e a espera por um tronco ficou curta
    if (soma >= cobertura * L && (L - soma) / comps.length <= vel * 2.1) break;
  }
  const bases = distribuir(G, comps, L, VAO_TRONCO);
  G.alcance = TODAS;
  return { r, tipo: 't', dir: G.dir, vel, L, objs: comps.map((c, i) => ({ b: bases[i], c })) };
}

// Vitórias-régias paradas no rio: 1 firme, 2 afunda de vez em quando.
function gerarNenufares(G, r, d) {
  const pads = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const fases = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const n = 3 + inteiro(G, 3) + (d < 0.3 ? 1 : 0);
  let mascara = 0;
  for (let i = 0; i < n; i++) mascara |= 1 << inteiro(G, COLUNAS);
  mascara = garantirSaidas(G, mascara);
  const firme = colunaDe(G, mascara & G.alcance); // no caminho garantido, uma que nunca afunda
  for (let c = 0; c < COLUNAS; c++) {
    if (!(mascara & (1 << c))) continue;
    pads[c] = c !== firme && proximo(G) < 0.18 + 0.35 * d ? 2 : 1;
    fases[c] = proximo(G) * PERIODO_AFUNDA;
  }
  G.alcance = espalhar(mascara, G.alcance);
  return { r, tipo: 'n', pads, fases };
}

function gerarTrilho(G, r, d) {
  const nv = 2 + inteiro(G, 3) + Math.round(d * 2);
  const comp = 74 + nv * 66;
  const vel = 760 + 240 * d + 80 * proximo(G);
  const dur = (LARGURA + comp) / vel;
  const per = Math.max(AVISO + dur + 2.4, 7.2 - 2.2 * d + 2.2 * proximo(G));
  G.alcance = TODAS;
  return { r, tipo: 'f', dir: G.dir, vel, per, fase: proximo(G) * per, nv, comp };
}

/* ─── O que anda é uma conta do tempo ─── */

// Canto esquerdo do objeto (carroça ou tronco) na tela.
function posObj(fx, o, tempo) {
  const comp = fx.tipo === 'e' ? COMP_VEIC[o.t] : o.c;
  const s = (o.b + fx.vel * tempo) % fx.L;
  return fx.dir > 0 ? s - MARGEM : LARGURA + MARGEM - s - comp;
}
const tauTrem = (fx, tempo) => (tempo + fx.fase) % fx.per;
function posTrem(fx, tempo) {
  const anda = (tauTrem(fx, tempo) - AVISO) * fx.vel;
  if (anda < 0 || anda > LARGURA + fx.comp) return null;
  return fx.dir > 0 ? anda - fx.comp : LARGURA - anda;
}
const alertaTrem = (fx, tempo) => tauTrem(fx, tempo) < AVISO + (LARGURA + fx.comp) / fx.vel;
// 0 sem folha, 1 firme, 2 balançando (vai afundar), 3 afundada
function estadoNenufar(fx, c, tempo) {
  const p = fx.pads[c];
  if (p !== 2) return p;
  const tau = (tempo + fx.fases[c]) % PERIODO_AFUNDA;
  return tau < 0.8 ? 2 : tau < 2 ? 3 : 1;
}

/* ─── Desenho: bloquinhos com topo claro e frente escura ─── */

const tons = hex => ({ c: sombrear(hex, 0.3), t: sombrear(hex, 0.14), b: hex, f: sombrear(hex, -0.3) });
const VERDES = ['#4f9a3c', '#3f8a36', '#5aa845', '#2f7a3a'].map(tons);
const CAVALOS = ['#8b5a2b', '#5a3a22', '#d8cfc0', '#3b302a', '#b07a45'].map(tons);
const LONAS = ['#c0392b', '#2e6fb5', '#2f8f5b', '#8e44ad', '#d68910'].map(tons);
const VAGOES = ['#9b4a2c', '#2e6fb5', '#3d8b4f', '#b8862f', '#7b4a8e'].map(tons);
const MADEIRA = tons('#b07a46');
const LOCO = tons('#3f4652');
const CABINE = tons('#a83228');
const FENO = tons('#e8c45f');
const FLORES = ['#f4a3c0', '#f7e27a', '#ffffff', '#b9a4f0'];
const CORES_LUZ = ['rgba(255,196,110,0.5)', 'rgba(255,240,190,0.62)', 'rgba(255,70,50,0.55)', 'rgba(255,215,90,0.45)'];

// Luzes da noite, juntadas enquanto desenha (lanternas, farol do trem, sinal).
const LUZ_X = new Float32Array(64);
const LUZ_Y = new Float32Array(64);
const LUZ_R = new Float32Array(64);
const LUZ_C = new Uint8Array(64);
let nLuzes = 0;
let noiteAtiva = false;
function luz(x, y, r, c) {
  if (!noiteAtiva || nLuzes >= 64) return;
  LUZ_X[nLuzes] = x; LUZ_Y[nLuzes] = y; LUZ_R[nLuzes] = r; LUZ_C[nLuzes] = c;
  nLuzes++;
}

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
// Pegada no chão (x, y, w, d), altura h, levantado z: frente embaixo, topo deslocado para cima.
function bloco(g, x, y, w, d, h, topo, frente, z = 0) {
  ret(g, frente, x, y + d - z - h, w, h);
  ret(g, topo, x, y - z - h, w, d);
}
const sombra = (g, x, y, w, h) => ret(g, 'rgba(30,40,10,0.2)', x, y, w, h);
const topoFaixa = (r, cam) => ALTURA - (r - cam + 1) * CEL;
const peloDe = m => (m & 2 ? OURO_PELO : PELO);

function chao(g, fx, y0, t, acima) {
  const r = fx[0];
  const tipo = fx[1];
  if (tipo === 0) { // campo: tufos e florzinhas
    ret(g, r & 1 ? '#8fd068' : '#87c862', 0, y0, LARGURA, CEL + 1);
    g.fillStyle = r & 1 ? '#79b955' : '#73b350';
    for (let i = 0; i < 6; i++) {
      const x = 3 + hash(r, i) * (LARGURA - 8);
      const y = y0 + 5 + hash(r, i + 9) * 36;
      g.fillRect(x, y, 2, 5); g.fillRect(x + 3, y + 1, 2, 4); g.fillRect(x - 3, y + 2, 2, 3);
    }
    for (let i = 0; i < 4; i++) {
      if (hash(r, i + 30) < 0.45) continue;
      const x = 8 + hash(r, i + 40) * (LARGURA - 16);
      const y = y0 + 8 + hash(r, i + 50) * 32;
      const cor = FLORES[Math.floor(hash(r, i + 60) * FLORES.length)];
      elipse(g, x - 2, y, 1.8, 1.8, cor); elipse(g, x + 2, y, 1.8, 1.8, cor);
      elipse(g, x, y - 2, 1.8, 1.8, cor); elipse(g, x, y + 2, 1.8, 1.8, cor);
      elipse(g, x, y, 1.2, 1.2, '#f4c430');
    }
  } else if (tipo === 1) { // estrada de terra com sulcos das rodas
    ret(g, '#cfa977', 0, y0, LARGURA, CEL + 1);
    ret(g, '#bb9563', 0, y0 + 12, LARGURA, 4);
    g.fillRect(0, y0 + 31, LARGURA, 4);
    g.fillStyle = '#a8834f';
    for (let i = 0; i < 7; i++) g.fillRect(hash(r, i) * LARGURA, y0 + 4 + hash(r, i + 20) * 40, 3, 2);
    if (acima && acima[1] === 1) {
      g.fillStyle = 'rgba(255,244,220,0.55)';
      for (let x = 6; x < LARGURA; x += 40) g.fillRect(x, y0 - 1, 20, 2);
    }
  } else if (tipo === 2 || tipo === 3) { // rio com brilhos que correm
    ret(g, '#4ba7de', 0, y0, LARGURA, CEL + 1);
    if (acima && acima[1] !== 2 && acima[1] !== 3) ret(g, 'rgba(16,60,110,0.22)', 0, y0, LARGURA, 7);
    const dir = tipo === 2 ? fx[2] : r & 1 ? 1 : -1;
    g.fillStyle = 'rgba(255,255,255,0.32)';
    for (let i = 0; i < 6; i++) {
      const x = (((hash(r, i) * 480 + t * 16 * dir) % 480) + 480) % 480 - 30;
      g.fillRect(x, y0 + 9 + (i % 3) * 13 + hash(r, i + 3) * 4, 12 + hash(r, i + 5) * 14, 2);
    }
  } else { // trilho: brita, dormentes e os dois ferros
    ret(g, '#a49c8f', 0, y0, LARGURA, CEL + 1);
    g.fillStyle = '#8e877b';
    for (let i = 0; i < 10; i++) g.fillRect(hash(r, i) * LARGURA, y0 + 3 + hash(r, i + 20) * 42, 3, 2);
    g.fillStyle = '#7a5535';
    for (let x = 4; x < LARGURA; x += 24) g.fillRect(x, y0 + 9, 11, 30);
    g.fillStyle = '#5c3f27';
    for (let x = 4; x < LARGURA; x += 24) g.fillRect(x, y0 + 39, 11, 3);
    ret(g, '#7e828c', 0, y0 + 16, LARGURA, 3);
    g.fillRect(0, y0 + 33, LARGURA, 3);
    ret(g, '#e1e4ea', 0, y0 + 14, LARGURA, 2);
    g.fillRect(0, y0 + 31, LARGURA, 2);
  }
}

// O campo é mais alto: onde ele acaba aparece a frente do barranco.
function barranco(g, y0, tipoAbaixo) {
  const y = y0 + CEL;
  const agua = tipoAbaixo === 2 || tipoAbaixo === 3;
  ret(g, '#74ad4f', 0, y, LARGURA, 3);
  ret(g, agua ? '#7d5b3a' : '#8f6a45', 0, y + 3, LARGURA, 7);
  if (agua) ret(g, 'rgba(255,255,255,0.45)', 0, y + 10, LARGURA, 2);
}

function obstaculo(g, k, cx, y0, v) {
  if (k === 1) { // árvore: tronco e copa em dois andares
    const c = VERDES[Math.floor(v * VERDES.length)];
    sombra(g, cx - 14, y0 + 30, 40, 12);
    bloco(g, cx - 5, y0 + 30, 10, 8, 16, '#9a6a3c', '#6e4526');
    bloco(g, cx - 19, y0 + 12, 38, 28, 24, c.t, c.f, 12);
    if (v > 0.5) bloco(g, cx - 13, y0 + 17, 26, 18, 16, c.c, c.b, 36);
  } else if (k === 2) { // pedra com musgo
    sombra(g, cx - 12, y0 + 30, 32, 9);
    bloco(g, cx - 15, y0 + 18, 30, 20, 13, '#b5b2aa', '#85817a');
    bloco(g, cx - 8 + v * 6, y0 + 20, 14, 12, 6, '#c9c6bf', '#9a968e', 13);
    ret(g, '#7fae5a', cx - 15, y0 + 5, 9, 3);
  } else if (k === 3) { // arbusto com frutinhas
    sombra(g, cx - 14, y0 + 30, 36, 10);
    bloco(g, cx - 17, y0 + 14, 34, 24, 15, '#5fb04a', '#3e8a33');
    elipse(g, cx - 8, y0 + 6, 2.2, 2.2, '#d6333f');
    elipse(g, cx + 5, y0 + 12, 2.2, 2.2, '#d6333f');
    elipse(g, cx + 10, y0 + 2, 2.2, 2.2, '#d6333f');
  } else if (k === 4) { // poste com lanterna
    sombra(g, cx - 2, y0 + 33, 16, 5);
    bloco(g, cx - 3, y0 + 30, 6, 6, 32, '#6b4a2e', '#4e3420');
    bloco(g, cx - 7, y0 + 27, 14, 12, 12, '#ffe7a3', '#f4b942', 26);
    bloco(g, cx - 9, y0 + 26, 18, 14, 3, '#3d2b1d', '#2a1d13', 38);
    luz(cx, y0 + 4, 85, 0);
  } else { // fardo de feno
    sombra(g, cx - 14, y0 + 30, 38, 10);
    bloco(g, cx - 18, y0 + 14, 36, 24, 18, FENO.t, FENO.f);
    ret(g, '#b88d35', cx - 18, y0 + 30, 36, 2);
    g.fillRect(cx - 7, y0 - 4, 2, 24);
    g.fillRect(cx + 6, y0 - 4, 2, 24);
  }
}

function formaCenoura(g, x, y, esc) {
  g.save();
  g.translate(x, y);
  g.rotate(0.35);
  g.scale(esc, esc);
  g.fillStyle = '#f0b429';
  g.beginPath();
  g.moveTo(-6, -7);
  g.quadraticCurveTo(0, -10, 6, -7);
  g.lineTo(0, 13);
  g.closePath();
  g.fill();
  ret(g, '#ffde70', -3, -5, 2, 9);
  ret(g, '#c98b12', -4, -1, 5, 1.4);
  g.fillRect(-2, 4, 4, 1.4);
  elipse(g, -2.5, -10, 2.2, 5, '#4caf50', -0.4);
  elipse(g, 2.5, -10, 2.2, 5, '#3f9a45', 0.4);
  g.restore();
}

function cenoura(g, cx, y0, t) {
  const y = y0 + 14 + Math.sin(t * 3 + cx) * 2.5;
  elipse(g, cx, y0 + 31, 8, 3, 'rgba(0,0,0,0.18)');
  formaCenoura(g, cx, y, 1);
  const b = (Math.sin(t * 5 + cx) + 1) / 2;
  ret(g, b > 0.5 ? 'rgba(255,255,225,0.95)' : 'rgba(255,255,225,0.5)', cx + 8, y - 10 - b * 2, 2, 6);
  g.fillRect(cx + 6, y - 8 - b * 2, 6, 2);
  luz(cx, y, 36, 3);
}

function roda(g, x, y, r) {
  elipse(g, x, y, r, r, '#3d2a1a');
  elipse(g, x, y, r * 0.4, r * 0.4, '#a07850');
}

function cavalo(g, hx, y0, dir, c, t) {
  const fase = t * 16 + hx * 0.05;
  g.fillStyle = c.f;
  for (let i = 0; i < 4; i++) g.fillRect(hx + 4 + i * 7, y0 + 22, 3, 11 + Math.sin(fase + i * 1.7) * 2);
  bloco(g, hx + 1, y0 + 14, 26, 18, 12, c.t, c.f, 10);
  const cab = dir > 0 ? hx + 22 : hx - 2;
  bloco(g, cab, y0 + 15, 12, 12, 12, c.t, c.f, 18);
  ret(g, '#2b1d12', dir > 0 ? hx + 14 : hx + 6, y0 - 9, 10, 3); // crina
  g.fillRect(cab + 3, y0 - 15, 6, 2);
  ret(g, '#1b1403', dir > 0 ? cab + 8 : cab + 2, y0 + 1, 2, 2); // olho
}

// cod = tipo + 4 * variante (a variante escolhe as cores)
function carroca(g, cod, x, y0, dir, r, t) {
  const tipo = cod & 3;
  const v = hash(r, (cod >> 2) + 200);
  const comp = COMP_VEIC[tipo];
  const w = comp - 34;
  const cx = dir > 0 ? x : x + 34;
  const hx = dir > 0 ? x + comp - 32 : x;
  sombra(g, x + 4, y0 + 30, comp, 10);
  ret(g, '#6b4325', dir > 0 ? cx + w - 2 : hx + 26, y0 + 22, 10, 2); // varais
  bloco(g, cx, y0 + 10, w, 24, 12, MADEIRA.t, MADEIRA.f, 8);
  roda(g, cx + 10, y0 + 32, 6.5);
  if (w > 40) roda(g, cx + w - 10, y0 + 32, 6.5);
  if (tipo === 0) { // latões de leite
    for (let i = 0; i < 2; i++) bloco(g, cx + 4 + i * 12, y0 + 14, 10, 10, 10, '#e4e7ec', '#aab0ba', 20);
  } else if (tipo === 1) { // barris
    for (let i = 0; i < 3; i++) {
      const bx = cx + 6 + i * 17;
      elipse(g, bx + 6, y0 - 4, 7, 6, '#8a5a31');
      elipse(g, bx + 6, y0 - 6, 6, 4.5, '#a8743f');
      ret(g, '#5a3a1e', bx, y0 - 4, 12, 1.5);
    }
  } else if (tipo === 2) { // lona listrada do mercador
    const l = LONAS[Math.floor(v * LONAS.length)];
    bloco(g, cx + 3, y0 + 11, w - 6, 22, 12, l.t, l.f, 20);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let s = 6; s < w - 10; s += 14) { g.fillRect(cx + 3 + s, y0 - 21, 6, 22); g.fillRect(cx + 3 + s, y0 + 1, 6, 12); }
  } else { // monte de feno
    bloco(g, cx + 2, y0 + 10, w - 4, 24, 14, FENO.t, FENO.f, 20);
    bloco(g, cx + 10, y0 + 14, w - 20, 16, 8, FENO.c, FENO.t, 34);
    g.fillStyle = '#c9a043';
    for (let s = 8; s < w - 8; s += 11) g.fillRect(cx + s, y0 - 12 + (s % 3), 5, 1.5);
  }
  cavalo(g, hx, y0, dir, CAVALOS[Math.floor(v * 7919) % CAVALOS.length], t);
  const lx = dir > 0 ? cx + w - 5 : cx + 1; // lanterna da carroça
  bloco(g, lx, y0 + 8, 4, 4, 6, '#ffe39a', '#f2b84b', 20);
  luz(lx + 2, y0 - 16, 62, 0);
}

function tronco(g, x, y0, c) {
  ret(g, 'rgba(15,60,100,0.28)', x + 3, y0 + 30, c, 9);
  bloco(g, x, y0 + 12, c, 24, 9, '#b98250', '#8a5a31');
  g.fillStyle = '#a06d3e';
  for (let i = 12; i < c - 14; i += 30) g.fillRect(x + i, y0 + 9 + (i % 60 ? 8 : 0), 14, 2);
  ret(g, '#e0b882', x, y0 + 27, 5, 9);
  g.fillRect(x + c - 5, y0 + 27, 5, 9);
  ret(g, 'rgba(255,255,255,0.5)', x - 4, y0 + 34, 5, 2);
  g.fillRect(x + c - 1, y0 + 34, 5, 2);
}

function nenufar(g, cx, y0, estado, t, r, c) {
  if (estado === 3) { // afundada: só bolhinhas
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.6 + i / 3 + c * 0.13) % 1;
      elipse(g, cx - 8 + i * 8, y0 + 28 - k * 8, 1.5 + k, 1.5 + k, 'rgba(255,255,255,0.55)');
    }
    return;
  }
  const esc = estado === 2 ? 0.86 : 1;
  const x = cx + (estado === 2 ? Math.sin(t * 22 + c) * 1.6 : 0);
  elipse(g, x, y0 + 28, 19 * esc, 12 * esc, '#2e7a34');
  elipse(g, x, y0 + 25, 19 * esc, 12 * esc, estado === 2 ? '#86c25a' : '#5db45a');
  poligono(g, '#4ba7de', x, y0 + 25, x + 17 * esc, y0 + 19, x + 19 * esc, y0 + 26);
  if (hash(r, c + 70) < 0.3) {
    elipse(g, x - 6, y0 + 22, 4, 3, '#f4a3c0');
    elipse(g, x - 6, y0 + 21, 1.6, 1.4, '#fff3b0');
  }
}

function sinal(g, y0, alerta, t) {
  const x = LARGURA - 22;
  bloco(g, x, y0 + 2, 6, 6, 34, '#5a5f66', '#3b3f45');
  ret(g, '#f2f2f2', x - 7, y0 - 33, 20, 4);
  ret(g, '#c0392b', x - 3, y0 - 33, 4, 4);
  g.fillRect(x + 5, y0 - 33, 4, 4);
  const aceso = alerta && Math.floor(t * 5) % 2 === 0;
  elipse(g, x + 3, y0 - 20, 6, 6, '#2b2b2b');
  elipse(g, x + 3, y0 - 20, 4.5, 4.5, aceso ? '#ff3b30' : '#6d1d1a');
  if (aceso) {
    elipse(g, x + 3, y0 - 20, 10, 10, 'rgba(255,60,48,0.35)');
    luz(x + 3, y0 - 20, 75, 2);
  }
}

function trem(g, x, y0, dir, nv, r, t) {
  const comp = 74 + nv * 66;
  sombra(g, x + 4, y0 + 34, comp, 8);
  const lx = dir > 0 ? x + comp - 74 : x; // locomotiva sempre na frente
  for (let i = 0; i < nv; i++) {
    const wx = dir > 0 ? x + i * 66 : x + 78 + i * 66;
    const c = VAGOES[Math.floor(hash(r, i + 50) * VAGOES.length)];
    roda(g, wx + 12, y0 + 36, 5);
    roda(g, wx + 50, y0 + 36, 5);
    bloco(g, wx, y0 + 8, 62, 28, 22, c.t, c.f, 6);
    g.fillStyle = 'rgba(255,240,200,0.75)';
    for (let k = 0; k < 3; k++) g.fillRect(wx + 8 + k * 18, y0 + 16, 10, 6);
    ret(g, c.c, wx, y0 - 20, 62, 3);
    ret(g, '#2a2a2e', dir > 0 ? wx + 62 : wx - 4, y0 + 24, 4, 3);
  }
  for (const rx of [14, 38, 60]) roda(g, lx + rx, y0 + 36, 6);
  bloco(g, lx, y0 + 8, 74, 28, 18, LOCO.t, LOCO.f, 6);
  const cab = dir > 0 ? lx : lx + 50;
  bloco(g, cab, y0 + 8, 24, 28, 14, CABINE.t, CABINE.f, 24);
  ret(g, 'rgba(255,235,170,0.8)', cab + 7, y0 + 1, 10, 6);
  const ch = dir > 0 ? lx + 52 : lx + 12;
  bloco(g, ch, y0 + 16, 10, 10, 12, '#2a2a2e', '#18181b', 24);
  ret(g, '#c0392b', lx, y0 + 26, 74, 3);
  const frente = dir > 0 ? lx + 74 : lx;
  poligono(g, '#b03a2e', frente, y0 + 24, frente + dir * 9, y0 + 36, frente, y0 + 36);
  elipse(g, frente - dir * 4, y0 + 18, 3.5, 4, '#fff3b0');
  for (let i = 0; i < 3; i++) { // fumaça
    const k = (t * 1.5 + i / 3) % 1;
    elipse(g, ch + 5 - dir * k * 46, y0 - 32 - k * 18, 5 + k * 8, 4 + k * 6, k < 0.45 ? 'rgba(240,240,240,0.5)' : 'rgba(240,240,240,0.25)');
  }
  luz(frente + dir * 46, y0 + 18, 135, 1);
}

function objetos(g, fx, y0, t) {
  const r = fx[0];
  const tipo = fx[1];
  if (tipo === 0 || tipo === 3) {
    const s = fx[2];
    for (let c = 0; c < COLUNAS; c++) {
      const k = s.charCodeAt(c) - 48;
      if (tipo === 3) {
        if (k > 0) nenufar(g, c * CEL + 24, y0, k, t, r, c);
      } else if (k > 0) obstaculo(g, k, c * CEL + 24, y0, hash(r, c + 100));
      else if (fx[3] === c) cenoura(g, c * CEL + 24, y0, t);
    }
  } else if (tipo === 1) {
    for (let i = 3; i + 1 < fx.length; i += 2) carroca(g, fx[i + 1], fx[i], y0, fx[2], r, t);
  } else if (tipo === 2) {
    for (let i = 3; i + 1 < fx.length; i += 2) tronco(g, fx[i], y0, fx[i + 1]);
  } else {
    sinal(g, y0, fx[3], t);
    if (fx[4] != null) trem(g, fx[4], y0, fx[2], fx[5], r, t);
  }
}

/* ─── O coelho, o gavião e os finais ─── */

function coelho(g, x, yPes, s, esmaga, olhar, m, t) {
  const arco = s > 0 ? Math.sin(Math.PI * s) * 13 : 0;
  let sx = 1;
  let sy = 1;
  if (s > 0) { sy = 1 + 0.16 * Math.sin(Math.PI * s); sx = 1 - 0.08 * Math.sin(Math.PI * s); } // estica no pulo
  else if (esmaga > 0) { sy = 1 - 0.2 * esmaga; sx = 1 + 0.14 * esmaga; } // achata ao pousar
  if (arco > 1) elipse(g, x, yPes + 1, 12 - arco * 0.25, 3.6, 'rgba(0,0,0,0.22)');
  g.save();
  if (m & 1) g.globalAlpha = 0.45;
  g.translate(x, yPes - arco);
  g.scale(ESCALA * sx, ESCALA * sy);
  desenharCoelho(g, 0, 0, { pelo: peloDe(m), acessorio: m & 2 ? 'coroa' : ACESSORIO, dir: olhar < 0 ? -1 : 1, t });
  g.restore();
}

function amassado(g, x, yPes, olhar, m, t) {
  g.save();
  g.translate(x, yPes);
  g.scale(ESCALA * 1.5, ESCALA * 0.22);
  desenharCoelho(g, 0, 0, { pelo: peloDe(m), acessorio: 'nenhum', dir: olhar < 0 ? -1 : 1, t: 0 });
  g.restore();
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.1;
    elipse(g, x + Math.cos(a) * 15, yPes - 14 + Math.sin(a) * 4, 2.2, 2.2, '#ffe27a');
  }
}

function respingo(g, x, yPes, q, m) {
  const y = yPes - 4;
  g.save();
  g.lineWidth = 2;
  g.strokeStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { // anéis na água
    const k = q * 1.5 - i * 0.22;
    if (k <= 0 || k >= 1) continue;
    g.globalAlpha = 0.85 * (1 - k);
    g.beginPath();
    g.ellipse(x, y, 6 + k * 30, 2.5 + k * 11, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  const k = Math.min(1, q * 2);
  if (k < 1) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 6);
      elipse(g, x + Math.cos(a) * 26 * k, y - Math.sin(a) * 34 * Math.sin(Math.PI * k), 2.4, 3, 'rgba(220,240,255,0.9)');
    }
  }
  if (q < 0.35) { // as orelhas afundando
    const s = q / 0.35;
    elipse(g, x - 3, y - 6 + s * 8, 3, 9 * (1 - s) + 0.5, peloDe(m), -0.2);
    elipse(g, x + 4, y - 6 + s * 8, 3, 9 * (1 - s) + 0.5, peloDe(m), 0.15);
  }
  g.restore();
}

function gaviao(g, x, y, bate, esc) {
  g.save();
  g.translate(x, y);
  g.scale(esc, esc);
  const asa = Math.sin(bate) * 10;
  for (const l of [-1, 1]) poligono(g, '#6b4a2b', l * 6, -2, l * 42, -10 - asa, l * 32, 4 - asa * 0.4, l * 8, 8);
  ret(g, '#3f2a16', -44, -12 - asa, 8, 4);
  g.fillRect(36, -12 - asa, 8, 4);
  poligono(g, '#5a3d22', -6, 10, 6, 10, 9, 22, -9, 22);
  elipse(g, 0, 4, 9, 13, '#7a5534');
  elipse(g, 0, 7, 6, 8, '#e8dcc4');
  elipse(g, 0, -10, 7, 6.5, '#f3ead8');
  poligono(g, '#f2b632', -2.5, -8, 2.5, -8, 0, -2);
  g.fillRect(-5, 15, 3, 6);
  g.fillRect(2, 15, 3, 6);
  elipse(g, -3, -11, 1.3, 1.3, '#1b1403');
  elipse(g, 3, -11, 1.3, 1.3, '#1b1403');
  g.restore();
}

// O gavião mergulha, agarra o coelho e sobe com ele.
function gaviaoPega(g, x, yPes, q, olhar, m, t) {
  const bate = t * 18;
  if (q < 0.33) {
    const k = q / 0.33;
    gaviao(g, x + 170 * (1 - k), -60 + (yPes - 34 + 60) * k * k, bate, 1.15 - 0.15 * k);
    return;
  }
  const k = (q - 0.33) / 0.67;
  const hx = x - 90 * k;
  const hy = yPes - 34 - (yPes + 40) * k * k;
  g.save();
  g.translate(hx, hy + 46);
  g.rotate(Math.sin(t * 14) * 0.25);
  coelho(g, 0, 0, 0, 0, olhar, m, t);
  g.restore();
  gaviao(g, hx, hy, bate, 1);
}

// O trem arremessa o coelho girando.
function voando(g, x, yPes, q, olhar, m, t) {
  g.save();
  g.translate(x, yPes - Math.sin(Math.PI * Math.min(1, q * 1.3)) * 50 - 16);
  g.rotate(q * 16 * (olhar < 0 ? -1 : 1));
  coelho(g, 0, 16, 0, 0, olhar, m, t);
  g.restore();
}

// Parado demais (ou ficando para trás): a sombra do gavião rodeia o coelho.
function sombraGaviao(g, x, yPes, o, t) {
  const sx = x + Math.cos(t * 1.7) * 62;
  const sy = yPes - 12 + Math.sin(t * 1.7) * 22;
  g.save();
  g.globalAlpha = 0.1 + o * 0.25;
  elipse(g, sx, sy, 8, 5, '#000');
  elipse(g, sx - 14, sy - 1, 13, 3, '#000', -0.15);
  elipse(g, sx + 14, sy - 1, 13, 3, '#000', 0.15);
  g.globalAlpha = 1;
  if (o > 0.5) {
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    texto(g, '!', x, yPes - 44, FONTE_MEDIA, '#ffdf6b', 'rgba(60,20,10,0.7)', 4);
  }
  g.restore();
}

// Noite: tudo escuro, com luz em volta do coelho, das lanternas, do farol do trem e do sinal.
function noite(g, bx, by) {
  g.save();
  const gr = g.createRadialGradient(bx, by, 22, bx, by, 210);
  gr.addColorStop(0, 'rgba(8,10,34,0.06)');
  gr.addColorStop(0.45, 'rgba(8,10,34,0.62)');
  gr.addColorStop(1, 'rgba(5,6,22,0.9)');
  g.fillStyle = gr;
  g.fillRect(0, 0, LARGURA, ALTURA);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < nLuzes; i++) {
    const x = LUZ_X[i];
    const y = LUZ_Y[i];
    const r = LUZ_R[i];
    const l = g.createRadialGradient(x, y, 0, x, y, r);
    l.addColorStop(0, CORES_LUZ[LUZ_C[i]]);
    l.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = l;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
}

function hud(g, v, t) {
  g.save();
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.textAlign = 'center';
  texto(g, String(v.p || 0), LARGURA / 2, 8, FONTE_PONTOS, '#fffdf4', 'rgba(38,28,16,0.55)', 7);
  formaCenoura(g, 22, 30, 0.95);
  g.textAlign = 'left';
  texto(g, String(v.k || 0), 36, 18, FONTE_MEDIA, '#ffe08a', 'rgba(38,28,16,0.55)', 5);
  g.textAlign = 'right';
  texto(g, `Melhor: ${v.h || 0}`, LARGURA - 12, 22, FONTE_PEQ, '#ffffff', 'rgba(38,28,16,0.55)', 4);
  if (!v.e && v.o > 0.05) {
    g.globalAlpha = Math.min(1, v.o * 1.5) * (0.6 + 0.4 * Math.sin(t * 10));
    g.textAlign = 'center';
    texto(g, 'Ande! O gavião está de olho!', LARGURA / 2, 64, FONTE_AVISO, '#ffd9c9', 'rgba(60,20,10,0.7)', 4);
  }
  g.restore();
}

// Desenha a cena inteira a partir de uma "vista" (a mesma coisa que vai para quem assiste).
function desenharCena(g, v, t, extra) {
  const cam = v.c || 0;
  const f = v.f || [];
  const b = v.b || [LARGURA / 2, 0, 1, 0, 0, 0];
  const e = v.e || 0;
  const q = v.q || 0;
  const m = v.m || 0;
  noiteAtiva = !!(m & 4);
  nLuzes = 0;
  g.save();
  ret(g, '#86c35f', 0, 0, LARGURA, ALTURA);
  for (let i = 0; i < f.length; i++) chao(g, f[i], topoFaixa(f[i][0], cam), t, f[i - 1]);
  for (let i = 0; i < f.length - 1; i++) {
    if (f[i][1] === 0 && f[i + 1][1] !== 0) barranco(g, topoFaixa(f[i][0], cam), f[i + 1][1]);
  }
  const bx = b[0];
  const by = ALTURA - (b[1] - cam + 0.5) * CEL + 7 - b[5] * 9; // os pés
  if (e === 1) amassado(g, bx, by, b[2], m, t);
  // de longe para perto; o coelho entra logo depois da fileira dele
  let feito = !(e === 0 || (e === 3 && q < 0.33));
  const filaCoelho = Math.round(b[1]);
  for (let i = 0; i < f.length; i++) {
    objetos(g, f[i], topoFaixa(f[i][0], cam), t);
    if (!feito && f[i][0] <= filaCoelho) { coelho(g, bx, by, b[3], b[4], b[2], m, t); feito = true; }
  }
  if (!feito) coelho(g, bx, by, b[3], b[4], b[2], m, t);
  if (e === 2) respingo(g, bx, by, q, m);
  else if (e === 3) gaviaoPega(g, bx, by, q, b[2], m, t);
  else if (e === 4) voando(g, bx, by, q, b[2], m, t);
  else if (e === 0 && v.o > 0) sombraGaviao(g, bx, by, v.o, t);
  if (extra) extra(g, cam);
  if (noiteAtiva) noite(g, bx, e === 3 && q >= 0.33 ? by - 60 : by - 18);
  hud(g, v, t);
  g.restore();
}

// Uma faixa em poucos números: [fila, tipo, ...]
function descreverFaixa(fx, tempo, rd) {
  if (fx.tipo === 'g') return [fx.r, 0, fx.bs, fx.cenoura];
  if (fx.tipo === 'e' || fx.tipo === 't') {
    const a = [fx.r, COD_TIPO[fx.tipo], fx.dir];
    for (let i = 0; i < fx.objs.length; i++) {
      const o = fx.objs[i];
      const c = fx.tipo === 'e' ? COMP_VEIC[o.t] : o.c;
      const x = posObj(fx, o, tempo);
      if (x + c > -30 && x < LARGURA + 30) a.push(rd(x), fx.tipo === 'e' ? o.t + 4 * i : c);
    }
    return a;
  }
  if (fx.tipo === 'n') {
    let s = '';
    for (let c = 0; c < COLUNAS; c++) s += estadoNenufar(fx, c, tempo);
    return [fx.r, 3, s];
  }
  const x = posTrem(fx, tempo);
  return [fx.r, 4, fx.dir, alertaTrem(fx, tempo) ? 1 : 0, x === null ? null : rd(x), fx.nv];
}

/* ─── O jogo ─── */

function novoEstado(ctx) {
  const semente = Math.floor(ctx.sorte() * 4294967296) >>> 0;
  return {
    tempo: 0, semente, ger: novoGerador(semente), faixas: [],
    fila: 0, x: 4 * CEL + 24, olhar: 1, tronco: -1, desloc: 0,
    pulo: null, guardado: null, cam: -3.5, maxFila: 0, cenouras: 0, ocioso: 0, esmaga: 0, suaveX: 0,
    morte: null, acabou: false,
  };
}

// copia: um jogo copiado (só nos testes) não mexe no melhor da sessão.
function montar(ctx, E, copia = false) {
  const som = nome => { try { ctx.som?.(nome); } catch { /* sem som */ } };
  const segredo = chave => { try { return !!ctx.segredo?.(chave); } catch { return false; } };
  const parts = Array.from({ length: 60 }, () => ({ vida: 0, max: 1, x: 0, p: 0, z: 0, vx: 0, vz: 0, tipo: 0 }));
  let relogioBrilho = 0;

  const faixa = r => {
    const i = r - E.faixas[0].r;
    return i >= 0 && i < E.faixas.length ? E.faixas[i] : null;
  };
  // gera à frente da câmera e esquece o que ficou para trás
  function gerarAte() {
    const ate = Math.floor(E.cam) + 16;
    while (E.ger.r <= ate) E.faixas.push(gerarFaixa(E.ger));
    const corte = Math.floor(E.cam) - 3;
    while (E.faixas.length > 1 && E.faixas[0].r < corte) E.faixas.shift();
  }
  gerarAte();

  const xAtual = () => (E.pulo ? E.pulo.x0 + (E.pulo.x1 - E.pulo.x0) * E.pulo.t : E.x);
  const pAtual = () => (E.pulo ? E.pulo.f0 + (E.pulo.f1 - E.pulo.f0) * E.pulo.t : E.fila);
  const filaLogica = () => (E.pulo && E.pulo.t >= 0.5 ? E.pulo.f1 : E.fila);

  /* Partículas de enfeite (poeira, brilhos): só aqui o Math.random */
  function soltar(tipo, x, p, z, vx, vz, max) {
    for (const s of parts) {
      if (s.vida > 0) continue;
      s.tipo = tipo; s.x = x; s.p = p; s.z = z; s.vx = vx; s.vz = vz; s.vida = max; s.max = max;
      return;
    }
  }
  function moverParticulas(dt) {
    for (const s of parts) {
      if (s.vida <= 0) continue;
      s.vida -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (s.tipo === 0) { s.vx *= 0.9; s.vz *= 0.9; } else s.vz -= 20 * dt;
    }
  }
  function desenharParticulas(g, cam) {
    for (const s of parts) {
      if (s.vida <= 0) continue;
      const k = s.vida / s.max;
      const y = ALTURA - (s.p - cam + 0.5) * CEL + 7 - s.z;
      if (s.tipo === 0) {
        g.globalAlpha = k * 0.7;
        elipse(g, s.x, y, 3 + (1 - k) * 5, 2 + (1 - k) * 3, '#f3ead6');
      } else {
        g.globalAlpha = k;
        const a = 1 + k * 2.5;
        ret(g, '#ffe58a', s.x - a, y - 0.7, a * 2, 1.4);
        g.fillRect(s.x - 0.7, y - a, 1.4, a * 2);
      }
    }
    g.globalAlpha = 1;
  }
  const acaso = (a, b) => a + Math.random() * (b - a);
  function brilhos(n, x, p) {
    for (let i = 0; i < n; i++) soltar(1, x + acaso(-15, 15), p, acaso(8, 34), acaso(-25, 25), acaso(20, 60), acaso(0.5, 0.9));
  }

  /* Pulos */
  function iniciarPulo(a) {
    const dx = a === 'esq' ? -1 : a === 'dir' ? 1 : 0;
    const dy = a === 'cima' ? 1 : a === 'baixo' ? -1 : 0;
    if (dx) E.olhar = dx;
    const alvo = faixa(E.fila + dy);
    let x1 = E.x;
    let pode = !!alvo;
    if (pode) {
      if (dy === 0) {
        x1 = E.x + dx * CEL;
        if (x1 < 6 || x1 > LARGURA - 6) pode = false;
      } else if (alvo.tipo !== 't' || E.tronco < 0) x1 = colunaDoX(E.x) * CEL + 24; // tronco para tronco: pula reto
      if (pode && alvo.tipo === 'g' && alvo.bloq[colunaDoX(x1)]) pode = false;
    }
    if (!pode) { // esbarrou (árvore, pedra, beirada): só um tranco no lugar
      E.pulo = { t: 0, dur: 0.1, x0: E.x, x1: E.x, f0: E.fila, f1: E.fila, bater: true, bx: dx, by: dy };
      return;
    }
    E.pulo = { t: 0, dur: DUR_PULO, x0: E.x, x1, f0: E.fila, f1: E.fila + dy, bater: false, bx: dx, by: dy };
    if (dy !== 0) E.tronco = -1;
    if (dy > 0) E.ocioso = 0;
    som('passo');
    for (let i = 0; i < 3; i++) soltar(0, E.x + acaso(-8, 8), E.fila, 0, acaso(-15, 15) - dx * 20, acaso(6, 18), 0.35);
  }

  // Pousou no rio: gruda no tronco embaixo (encaixado numa das casinhas dele).
  function prenderTronco(fx) {
    for (let i = 0; i < fx.objs.length; i++) {
      const o = fx.objs[i];
      const lx = posObj(fx, o, E.tempo);
      if (E.x < lx - 14 || E.x > lx + o.c + 14) continue;
      const k = Math.round((o.c + 6) / CEL);
      const ini = (o.c - k * CEL) / 2 + 24;
      const j = limitar(Math.round((E.x - lx - ini) / CEL), 0, k - 1);
      const novo = lx + ini + j * CEL;
      E.suaveX += E.x - novo;
      E.x = novo;
      E.tronco = i;
      E.desloc = ini + j * CEL;
      return true;
    }
    return false;
  }

  function aterrissar() {
    const p = E.pulo;
    E.pulo = null;
    if (p.bater) {
      if (E.tronco >= 0) E.x = p.x1;
      return;
    }
    E.fila = p.f1;
    E.x = p.x1;
    E.esmaga = 1;
    if (E.fila > E.maxFila) {
      E.maxFila = E.fila;
      if (E.maxFila % 50 === 0) som('fase');
    }
    const fx = faixa(E.fila);
    E.tronco = -1;
    if (fx.tipo === 'g') {
      if (fx.cenoura >= 0 && fx.cenoura === colunaDoX(E.x)) {
        fx.cenoura = -1;
        E.cenouras++;
        som('moeda');
        brilhos(10, E.x, E.fila);
      }
    } else if (fx.tipo === 't') {
      if (!prenderTronco(fx)) morrer('agua');
    } else if (fx.tipo === 'n') {
      const c = colunaDoX(E.x);
      E.x = c * CEL + 24;
      const st = estadoNenufar(fx, c, E.tempo);
      if (st === 0) morrer('agua');
      else if (st === 3) morrer('afundou');
    }
  }

  function morrer(tipo, motivo = '', vx = 0) {
    if (E.morte) return;
    const p = pAtual();
    E.morte = { tipo, motivo, t: 0, vx, x: limitar(xAtual(), 12, LARGURA - 12), p: tipo === 'gaviao' ? Math.max(p, E.cam + 0.3) : p };
    E.pulo = null;
    E.guardado = null;
    E.tronco = -1;
    som(tipo === 'carroca' || tipo === 'trem' ? 'bater' : tipo === 'gaviao' ? 'alerta' : 'agua');
  }

  function verificarPerigos(dt) {
    const fx = faixa(filaLogica());
    const x = xAtual();
    if (fx && !segredo(FANTASMA)) { // o fantasma atravessa carroças e trens
      if (fx.tipo === 'e') {
        for (const o of fx.objs) {
          const vx = posObj(fx, o, E.tempo);
          if (x + 12 > vx + 4 && x - 12 < vx + COMP_VEIC[o.t] - 4) { morrer('carroca', o.t); return; }
        }
      } else if (fx.tipo === 'f') {
        const tx = posTrem(fx, E.tempo);
        if (tx !== null && x + 12 > tx && x - 12 < tx + fx.comp) { morrer('trem', '', fx.dir * fx.vel * 0.45); return; }
      }
    }
    if (!E.pulo && fx) {
      if (fx.tipo === 't' && E.tronco >= 0 && (E.x < 0 || E.x > LARGURA)) { morrer('correnteza'); return; }
      if (fx.tipo === 'n' && estadoNenufar(fx, colunaDoX(E.x), E.tempo) === 3) { morrer('afundou'); return; }
    }
    E.ocioso += dt;
    if (E.ocioso > OCIO_MAX) morrer('gaviao', 'parado');
    else if (pAtual() < E.cam - 0.3) morrer('gaviao', 'atras');
  }

  // O sino do trilho toca quando o aviso começa (só nos trilhos que aparecem na tela).
  function sinos() {
    const r0 = Math.floor(E.cam) - 1;
    const r1 = Math.floor(E.cam) + 12;
    for (const fx of E.faixas) {
      if (fx.tipo !== 'f' || fx.r < r0 || fx.r > r1) continue;
      const tau = tauTrem(fx, E.tempo);
      const antes = fx._tau ?? tau;
      if (tau < antes || (antes < 0.5 && tau >= 0.5)) som('alerta');
      fx._tau = tau;
    }
  }

  // O que dá para ver agora (sem arredondar para desenhar; arredondado para a foto de quem assiste).
  function vista(arred) {
    const rd = arred ? Math.round : n => n;
    const rd1 = arred ? n => Math.round(n * 10) / 10 : n => n;
    const rd2 = arred ? n => Math.round(n * 100) / 100 : n => n;
    const base = Math.floor(E.cam);
    const f = [];
    for (let r = base + 13; r >= base - 1; r--) {
      const fx = faixa(r);
      if (fx) f.push(descreverFaixa(fx, E.tempo, rd));
    }
    const m = E.morte;
    let x = m ? m.x : xAtual() + E.suaveX;
    let p = m ? m.p : pAtual();
    let s = 0;
    let alt = 0;
    let o = 0;
    if (!m) {
      if (E.pulo) {
        s = E.pulo.t;
        if (E.pulo.bater) {
          const k = Math.sin(Math.PI * s) * 0.18;
          x += E.pulo.bx * k * CEL;
          p += E.pulo.by * k;
          s *= 0.35;
        }
      } else {
        const fx = faixa(E.fila);
        alt = fx && (fx.tipo === 't' || fx.tipo === 'n') ? 1 : 0;
      }
      o = Math.max(limitar((E.ocioso - 4.2) / (OCIO_MAX - 4.2), 0, 1), limitar((1.3 - (p - E.cam)) / 1.3, 0, 1));
    }
    return {
      c: rd2(E.cam),
      b: [rd1(x), rd2(p), E.olhar, rd2(s), rd2(E.esmaga), alt],
      e: m ? COD_MORTE[m.tipo] : 0,
      q: m ? rd2(Math.min(1, m.t / DUR_MORTE[m.tipo])) : 0,
      p: E.maxFila,
      k: E.cenouras,
      h: Math.max(melhorSessao, E.maxFila),
      m: (segredo(FANTASMA) ? 1 : 0) | (segredo(OURO) ? 2 : 0) | (segredo(NOITE) ? 4 : 0),
      o: rd2(o),
      f,
    };
  }

  return {
    get pontos() { return E.maxFila; },
    get acabou() { return E.acabou; },

    atualizar(dt, entrada) {
      if (E.acabou) return;
      E.tempo += dt;
      moverParticulas(dt);
      if (E.morte) {
        const m = E.morte;
        const antes = m.t;
        m.t += dt;
        if (m.tipo === 'trem') m.x += m.vx * dt;
        if (m.tipo === 'gaviao' && antes < 0.5 && m.t >= 0.5) som('morte');
        if (m.t >= DUR_MORTE[m.tipo]) {
          E.acabou = true;
          if (!copia) melhorSessao = Math.max(melhorSessao, E.maxFila);
        }
        return;
      }
      for (const k of entrada?.apertou || []) {
        const a = ACAO[k];
        if (!a) continue;
        if (!E.pulo) iniciarPulo(a);
        else if (!E.guardado) E.guardado = a; // no máximo um pulo guardado
      }
      // em cima do tronco, o coelho vai junto com a correnteza
      const aqui = faixa(E.fila);
      if (E.tronco >= 0 && aqui && aqui.tipo === 't') {
        if (E.pulo) {
          const dv = aqui.dir * aqui.vel * dt;
          E.pulo.x0 += dv;
          E.pulo.x1 += dv;
        } else E.x = posObj(aqui, aqui.objs[E.tronco], E.tempo) + E.desloc;
      }
      if (E.pulo) {
        E.pulo.t = Math.min(1, E.pulo.t + dt / E.pulo.dur);
        if (E.pulo.t >= 1) {
          aterrissar();
          if (!E.morte && E.guardado) {
            const a = E.guardado;
            E.guardado = null;
            iniciarPulo(a);
          }
        }
      }
      E.esmaga = Math.max(0, E.esmaga - dt * 9);
      E.suaveX *= Math.max(0, 1 - dt * 18);
      if (!E.morte) verificarPerigos(dt);
      if (!E.morte) {
        // câmera: segue o coelho (um terço de baixo) e anda sozinha devagar
        const alvo = pAtual() - 3.5;
        if (alvo > E.cam) E.cam += (alvo - E.cam) * Math.min(1, dt * 4);
        E.cam += (0.14 + 0.2 * dificuldade(E.maxFila)) * dt;
        sinos();
        if (segredo(OURO) && (relogioBrilho += dt) > 0.06) { // rastro de brilhos do coelho dourado
          relogioBrilho = 0;
          soltar(1, xAtual() + acaso(-11, 11), pAtual(), acaso(6, 30), acaso(-8, 8), 6, 0.6);
        }
      }
      gerarAte();
    },

    desenhar(g, t) {
      desenharCena(g, vista(false), t, desenharParticulas);
    },

    resumo() {
      const n = E.maxFila;
      const k = E.cenouras;
      const m = E.morte;
      const titulos = {
        carroca: `Atropelado ${NOME_VEIC[m?.motivo] || 'pela carroça'}!`,
        trem: 'O trem passou bem na hora!',
        agua: 'Splash! Caiu no rio!',
        correnteza: 'A correnteza levou o coelho!',
        afundou: 'A vitória-régia afundou!',
        gaviao: m?.motivo === 'atras' ? 'Ficou para trás e o gavião pegou!' : 'Parado demais: o gavião pegou!',
      };
      const fileiras = `${n} ${n === 1 ? 'fileira' : 'fileiras'}`;
      return {
        titulo: (m && titulos[m.tipo]) || 'Fim da travessia',
        linhas: [`Você atravessou ${fileiras}.`, `Cenouras douradas: ${k}`, `Melhor desta sessão: ${Math.max(melhorSessao, n)}`],
        detalhe: `${fileiras}, ${k} ${k === 1 ? 'cenoura' : 'cenouras'}`,
      };
    },

    foto: () => vista(true),

    usarSegredo: () => false,

    mudouSegredo(chave, ligado) {
      if (!ligado) return;
      som('poder');
      if (chave === OURO) brilhos(14, xAtual(), pAtual());
    },

    // Ganchos para os testes no Node (não mexem no jogo, exceto colocar).
    teste: {
      linhas(n, de = 0) {
        const G = novoGerador(E.semente);
        const lista = [];
        while (G.r < de + n) {
          const fx = gerarFaixa(G);
          if (fx.r >= de) lista.push(fx);
        }
        return lista;
      },
      colocar(fila, col) {
        E.cam = fila - 3.5;
        gerarAte();
        Object.assign(E, { fila, x: col * CEL + 24, pulo: null, guardado: null, tronco: -1, ocioso: 0, maxFila: Math.max(E.maxFila, fila) });
      },
      faixa: r => faixa(r),
      clonar: () => montar({ ...ctx, som: () => {} }, structuredClone(E), true),
      estado: () => E,
    },
  };
}

export default {
  id: 'travessia',
  nome: 'Travessia',
  icone: 'estrada',
  sub: 'Pule pelos campos, estradas, rios e trilhos e leve o coelho o mais longe que conseguir.',
  subDesafio: 'Todos atravessam o mesmo mundo: quem chegar mais longe vence.',
  largura: LARGURA,
  altura: ALTURA,
  cor: '#86c35f',
  controles: { cima: true, baixo: true, pular: null, acao: null, deslizar: true },
  instrucoes: {
    teclado: 'Setas ou WASD: um pulinho para cada lado (Espaço também pula para frente). Não fique parado!',
    toque: 'Toque na tela para pular para frente ou deslize o dedo para os lados e para trás (ou use as setas).',
  },
  comoJogar: [
    ['🐰', 'Pulinhos', 'Para frente, para os lados ou para trás, uma casinha por vez.'],
    ['🐴', 'Estradas', 'Carroças, mercadores e carroças de feno não param para coelho nenhum.'],
    ['🌊', 'Rio', 'Pule nos troncos e nas vitórias-régias. Algumas afundam um pouquinho; na água é splash!'],
    ['🚂', 'Trilhos', 'Quando o sinal pisca vermelho e o sino toca, o trem vem aí, bem rápido.'],
    ['🥕', 'Cenoura dourada', 'Aparece nos campos: pegue quantas conseguir.'],
    ['🦅', 'Gavião', 'Não fique parado nem fique para trás da tela: ele está de olho.'],
    ['🏆', 'Pontos', 'Cada fileira nova que o coelho alcança vale um ponto.'],
  ],
  criar(ctx) {
    return montar(ctx, novoEstado(ctx));
  },
  desenharFoto(g, foto, t) {
    if (foto) desenharCena(g, foto, t, null);
  },
};
