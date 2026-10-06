// Travessia: o coelho da Casa Luckham atravessa campos, estradas de terra, rios e trilhos, pulando de casinha
// em casinha, o mais longe que conseguir. O mundo nasce da sorte da partida, faixa por faixa e sempre na mesma
// ordem, e tudo que anda (carroças, troncos, trens, vitórias-régias que afundam) é só uma conta do tempo:
// no desafio, quem tem a mesma sorte atravessa exatamente o mesmo mundo.
// O desenho é "de bloquinhos" visto do alto: cada coisa tem o topo mais claro e a frente mais escura.
// Jogo junto (ctx.junto): todos atravessam o MESMO mundo ao mesmo tempo (mesma semente e o relógio da sala);
// cada um controla o seu coelho aqui e vê os outros chegando pelas posições que eles mandam. Versus: quem
// sobra vivo vence. Co-op: vidas da equipe e uma linha de chegada que todos os vivos precisam cruzar.

import { desenharCoelho, elipse, sombrear, PELOS } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, spriteDe } from '../sprites.js';

// Só o sprite daquela animação (sem trocar por outra animação da peça).
const temExato = (chave, anim) => !!spriteDe(`${chave}.${anim}`);

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
const FONTE_NOME = `800 12px ${FONTE}`;
const FONTE_PLACA = `900 14px ${FONTE}`;
const DUR_COD = [0, 1, 1, 1.5, 1.1];  // duração da morte pelo código (para desenhar os outros)
const ESPERA_RENASCER = 1.5;          // segundos entre o "renasce" da sala e o coelho voltar
const CORES_BANDEIRA = ['#e8c24a', '#fff4d6', '#b23a48'];
const OURO_CASA = '#e8c24a';
const nada = () => {};

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

// k: o quanto a dificuldade sobe mais depressa (1 sozinho; no jogo junto, cresce com o número de pessoas)
const dificuldade = (r, k = 1) => limitar(((r - 10) / 260) * k, 0, 1);
const rampa = G => 1 + (G.dif - 1) * 0.8;

// alcance: colunas por onde dá para chegar na faixa atual (o caminho nunca fecha)
// dif: a dificuldade da sala junto (1 sozinho); meta: a fileira da chegada no co-op (null sem chegada)
const novoGerador = (semente, dif = 1, meta = null) => ({ s: semente >>> 0, r: -6, tipo: 'g', resta: 0, dir: 1, alcance: 1 << 4, dif, meta });

function gerarFaixa(G) {
  const r = G.r++;
  if (r < 0) return gerarGrama(G, r, 1);
  // chegada do co-op: campo de festa e, depois, a mata fechada
  if (G.meta != null && r >= G.meta) return gerarGrama(G, r, r === G.meta ? 0 : 0.12, r >= G.meta + 3);
  if (r <= 2) return gerarGrama(G, r, r === 0 ? 0.1 : 0.16);
  if (G.resta <= 0) escolherCorrida(G, r);
  G.resta--;
  const d = dificuldade(r, rampa(G));
  if (proximo(G) < 0.72) G.dir = -G.dir; // faixas vizinhas costumam andar para lados opostos
  if (G.tipo === 'g') return gerarGrama(G, r, 0.13 + 0.2 * d + proximo(G) * 0.1);
  if (G.tipo === 'e') return gerarEstrada(G, r, d);
  if (G.tipo === 'f') return gerarTrilho(G, r, d);
  return r > 14 && proximo(G) < 0.22 + 0.18 * d ? gerarNenufares(G, r, d) : gerarTroncos(G, r, d);
}

// Corridas temáticas: um pedaço de campo, depois algumas estradas, ou um rio, ou trilhos.
function escolherCorrida(G, r) {
  const d = dificuldade(r, rampa(G));
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

function gerarGrama(G, r, dens, muro = r < 0) {
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
  // alc: as colunas alcançáveis desta fileira (onde dá para largar ou renascer sem ficar preso)
  return { r, tipo: 'g', bloq, bs: bloq.join(''), cenoura, alc: muro ? 0 : G.alcance };
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
  const vel = base * [1.15, 1, 0.92, 0.8][principal] * (1 + (G.dif - 1) * 0.5);
  const L = 700 + 220 * proximo(G) - 50 * d;
  const vao = 100 + vel * 0.4; // espaço mínimo entre duas carroças
  const n = suave ? 1 + (proximo(G) < 0.35 ? 1 : 0) : 1 + inteiro(G, 2 + Math.round(d * 2.5) + Math.round((G.dif - 1) * 2));
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
  const vel = (suave ? 26 + 16 * proximo(G) : 30 + 22 * proximo(G) + d * (40 + 30 * proximo(G))) * (1 + (G.dif - 1) * 0.3);
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
  const per = Math.max(AVISO + dur + 2.4, (7.2 - 2.2 * d + 2.2 * proximo(G)) / (1 + (G.dif - 1) * 0.4));
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

// Sprites do chão: uma casinha (CEL x CEL) repetida pela fileira; o rio corre para o lado da correnteza.
const CHAVE_CHAO = ['travessia.campo', 'travessia.estrada', 'travessia.rio', 'travessia.rio', 'travessia.trilho'];
function chaoComSprite(g, fx, y0, t, acima) {
  const r = fx[0];
  const tipo = fx[1];
  const chave = CHAVE_CHAO[tipo];
  const anim = tipo === 0 ? (r & 1 ? 'claro' : 'escuro') : tipo === 1 ? 'terra' : tipo === 4 ? 'trilho' : 'agua';
  if (!spriteDe(chave, anim)) return false;
  const lado = { t, largura: CEL + 1, altura: CEL + 1 };
  if (tipo === 2 || tipo === 3) {
    const dir = tipo === 2 ? fx[2] : r & 1 ? 1 : -1;
    const desloc = (((t * 16 * dir) % CEL) + CEL) % CEL;
    for (let c = -1; c <= COLUNAS; c++) desenharSprite(g, chave, anim, c * CEL + 24 + desloc, y0 + CEL / 2, lado);
    if (acima && acima[1] !== 2 && acima[1] !== 3) ret(g, 'rgba(16,60,110,0.22)', 0, y0, LARGURA, 7);
    return true;
  }
  for (let c = 0; c < COLUNAS; c++) desenharSprite(g, chave, anim, c * CEL + 24, y0 + CEL / 2, lado);
  if (tipo === 1 && acima && acima[1] === 1) {
    g.fillStyle = 'rgba(255,244,220,0.55)';
    for (let x = 6; x < LARGURA; x += 40) g.fillRect(x, y0 - 1, 20, 2);
  }
  return true;
}

function chao(g, fx, y0, t, acima, semSprite = false) {
  if (!semSprite && chaoComSprite(g, fx, y0, t, acima)) return;
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
function barranco(g, y0, tipoAbaixo, x0 = 0, w = LARGURA, semSprite = false) {
  const y = y0 + CEL;
  const agua = tipoAbaixo === 2 || tipoAbaixo === 3;
  if (!semSprite && spriteDe('travessia.barranco', agua ? 'rio' : 'terra')) {
    for (let c = 0; c < COLUNAS; c++) desenharSprite(g, 'travessia.barranco', agua ? 'rio' : 'terra', c * CEL + 24, y, { largura: CEL + 1 });
    return;
  }
  ret(g, '#74ad4f', x0, y, w, 3);
  ret(g, agua ? '#7d5b3a' : '#8f6a45', x0, y + 3, w, 7);
  if (agua) ret(g, 'rgba(255,255,255,0.45)', x0, y + 10, w, 2);
}

// Os obstáculos do campo (k = 1 a 5) e o sprite de cada um.
const CHAVE_OBST = [null, 'travessia.arvore', 'travessia.pedra', 'travessia.arbusto', 'travessia.poste', 'travessia.fardo'];
function obstaculo(g, k, cx, y0, v) {
  if (k === 1) sombra(g, cx - 14, y0 + 30, 40, 12);
  else if (k === 2) sombra(g, cx - 12, y0 + 30, 32, 9);
  else if (k === 3) sombra(g, cx - 14, y0 + 30, 36, 10);
  else if (k === 4) sombra(g, cx - 2, y0 + 33, 16, 5);
  else sombra(g, cx - 14, y0 + 30, 38, 10);
  if (k === 4) luz(cx, y0 + 4, 85, 0);
  if (desenharSprite(g, CHAVE_OBST[k] || 'travessia.fardo', k === 1 ? (v > 0.5 ? 'alta' : 'baixa') : 'parado', cx, y0 + 38, {})) return;
  corpoObstaculo(g, k, cx, y0, v);
}
// O desenho de sempre de um obstáculo, sem a sombra (o pé fica em cx, y0 + 38).
function corpoObstaculo(g, k, cx, y0, v) {
  if (k === 1) { // árvore: tronco e copa em dois andares
    const c = VERDES[Math.floor(v * VERDES.length)];
    bloco(g, cx - 5, y0 + 30, 10, 8, 16, '#9a6a3c', '#6e4526');
    bloco(g, cx - 19, y0 + 12, 38, 28, 24, c.t, c.f, 12);
    if (v > 0.5) bloco(g, cx - 13, y0 + 17, 26, 18, 16, c.c, c.b, 36);
  } else if (k === 2) { // pedra com musgo
    bloco(g, cx - 15, y0 + 18, 30, 20, 13, '#b5b2aa', '#85817a');
    bloco(g, cx - 8 + v * 6, y0 + 20, 14, 12, 6, '#c9c6bf', '#9a968e', 13);
    ret(g, '#7fae5a', cx - 15, y0 + 5, 9, 3);
  } else if (k === 3) { // arbusto com frutinhas
    bloco(g, cx - 17, y0 + 14, 34, 24, 15, '#5fb04a', '#3e8a33');
    elipse(g, cx - 8, y0 + 6, 2.2, 2.2, '#d6333f');
    elipse(g, cx + 5, y0 + 12, 2.2, 2.2, '#d6333f');
    elipse(g, cx + 10, y0 + 2, 2.2, 2.2, '#d6333f');
  } else if (k === 4) { // poste com lanterna
    bloco(g, cx - 3, y0 + 30, 6, 6, 32, '#6b4a2e', '#4e3420');
    bloco(g, cx - 7, y0 + 27, 14, 12, 12, '#ffe7a3', '#f4b942', 26);
    bloco(g, cx - 9, y0 + 26, 18, 14, 3, '#3d2b1d', '#2a1d13', 38);
  } else { // fardo de feno
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
  if (!desenharSprite(g, 'travessia.cenoura', 'brilhando', cx, y, { t })) corpoCenoura(g, cx, y, t, cx);
  luz(cx, y, 36, 3);
}
// A cenoura com o brilho piscando (fase: para cada uma piscar num tempo).
function corpoCenoura(g, x, y, t, fase) {
  formaCenoura(g, x, y, 1);
  const b = (Math.sin(t * 5 + fase) + 1) / 2;
  ret(g, b > 0.5 ? 'rgba(255,255,225,0.95)' : 'rgba(255,255,225,0.5)', x + 8, y - 10 - b * 2, 2, 6);
  g.fillRect(x + 6, y - 8 - b * 2, 6, 2);
}
// A cenoura do placar (o primeiro quadro do sprite, se houver).
function cenouraPlacar(g) {
  if (!desenharSprite(g, 'travessia.cenoura', 'brilhando', 22, 30, { quadro: 0, escala: 0.95 })) formaCenoura(g, 22, 30, 0.95);
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
const CHAVE_CARROCA = ['travessia.carroca-leiteiro', 'travessia.carroca-barris', 'travessia.carroca-mercador', 'travessia.carroca-feno'];
function carroca(g, cod, x, y0, dir, r, t) {
  const tipo = cod & 3;
  const comp = COMP_VEIC[tipo];
  sombra(g, x + 4, y0 + 30, comp, 10);
  if (!desenharSprite(g, CHAVE_CARROCA[tipo], 'andando', x + comp / 2, y0 + 40, { t, dir })) corpoCarroca(g, cod, x, y0, dir, r, t);
  const cx = dir > 0 ? x : x + 34;
  const lx = dir > 0 ? cx + comp - 34 - 5 : cx + 1; // lanterna da carroça
  luz(lx + 2, y0 - 16, 62, 0);
}
// A carroça e o cavalo, sem a sombra (o pé fica em x + comp / 2, y0 + 40).
function corpoCarroca(g, cod, x, y0, dir, r, t) {
  const tipo = cod & 3;
  const v = hash(r, (cod >> 2) + 200);
  const comp = COMP_VEIC[tipo];
  const w = comp - 34;
  const cx = dir > 0 ? x : x + 34;
  const hx = dir > 0 ? x + comp - 32 : x;
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
}

// Troncos de 2, 3 e 4 casinhas (c = comprimento em pixels).
const CHAVE_TRONCO = { 2: 'travessia.tronco-curto', 3: 'travessia.tronco-medio', 4: 'travessia.tronco-longo' };
function tronco(g, x, y0, c, t = 0) {
  ret(g, 'rgba(15,60,100,0.28)', x + 3, y0 + 30, c, 9);
  const chave = CHAVE_TRONCO[Math.round((c + 6) / CEL)];
  if (chave && desenharSprite(g, chave, 'boiando', x + c / 2, y0 + 37, { t })) return;
  corpoTronco(g, x, y0, c);
}
// O tronco sem a sombra na água (o pé fica em x + c / 2, y0 + 37).
function corpoTronco(g, x, y0, c) {
  bloco(g, x, y0 + 12, c, 24, 9, '#b98250', '#8a5a31');
  g.fillStyle = '#a06d3e';
  for (let i = 12; i < c - 14; i += 30) g.fillRect(x + i, y0 + 9 + (i % 60 ? 8 : 0), 14, 2);
  ret(g, '#e0b882', x, y0 + 27, 5, 9);
  g.fillRect(x + c - 5, y0 + 27, 5, 9);
  ret(g, 'rgba(255,255,255,0.5)', x - 4, y0 + 34, 5, 2);
  g.fillRect(x + c - 1, y0 + 34, 5, 2);
}

// Vitória-régia com sprite: cada estado só com o seu (afundada nunca vira folha firme).
const NENUFAR = 'travessia.vitoria-regia';
function nenufarComSprite(g, cx, y0, estado, t, c) {
  if (estado === 3) return temExato(NENUFAR, 'afundada') && desenharSprite(g, NENUFAR, 'afundada', cx, y0 + 26, { t: t + c * 0.13 });
  if (estado === 2) {
    const x = cx + Math.sin(t * 22 + c) * 1.6;
    if (temExato(NENUFAR, 'balancando')) return desenharSprite(g, NENUFAR, 'balancando', x, y0 + 26, { t });
    return temExato(NENUFAR, 'firme') && desenharSprite(g, NENUFAR, 'firme', x, y0 + 26, { t, escala: 0.86 });
  }
  return temExato(NENUFAR, 'firme') && desenharSprite(g, NENUFAR, 'firme', cx, y0 + 26, { t });
}

function nenufar(g, cx, y0, estado, t, r, c, semSprite = false) {
  if (!semSprite && nenufarComSprite(g, cx, y0, estado, t, c)) return;
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

function sinal(g, y0, alerta, t, semSprite = false) {
  const x = LARGURA - 22;
  if (!semSprite && (temExato('travessia.sinal', 'apagado') || temExato('travessia.sinal', 'piscando'))) {
    const aceso = alerta && Math.floor(t * 5) % 2 === 0;
    if (alerta && temExato('travessia.sinal', 'piscando')) desenharSprite(g, 'travessia.sinal', 'piscando', x + 3, y0 + 8, { t });
    else if (temExato('travessia.sinal', 'apagado')) {
      desenharSprite(g, 'travessia.sinal', 'apagado', x + 3, y0 + 8, { t });
      if (aceso) { // sem o sprite piscando, a luz vermelha de sempre por cima
        elipse(g, x + 3, y0 - 20, 4.5, 4.5, '#ff3b30');
        elipse(g, x + 3, y0 - 20, 10, 10, 'rgba(255,60,48,0.35)');
      }
    } else desenharSprite(g, 'travessia.sinal', 'piscando', x + 3, y0 + 8, { quadro: 1 }); // só o piscando: o 2º quadro é o apagado
    if (aceso) luz(x + 3, y0 - 20, 75, 2);
    return;
  }
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
    if (!desenharSprite(g, 'travessia.vagao', 'andando', wx + 31 + dir * 2, y0 + 41, { t, dir })) vagao(g, wx, y0, dir, c);
  }
  if (!desenharSprite(g, 'travessia.locomotiva', 'andando', lx + 37 + dir * 4.5, y0 + 42, { t, dir })) locomotiva(g, lx, y0, dir);
  const ch = dir > 0 ? lx + 52 : lx + 12;
  const frente = dir > 0 ? lx + 74 : lx;
  for (let i = 0; i < 3; i++) { // fumaça
    const k = (t * 1.5 + i / 3) % 1;
    const fx = ch + 5 - dir * k * 46;
    const fy = y0 - 32 - k * 18;
    if (!desenharSprite(g, 'travessia.fumaca', 'subindo', fx, fy, { progresso: k })) fumaca(g, fx, fy, k);
  }
  luz(frente + dir * 46, y0 + 18, 135, 1);
}
const fumaca = (g, x, y, k) => elipse(g, x, y, 5 + k * 8, 4 + k * 6, k < 0.45 ? 'rgba(240,240,240,0.5)' : 'rgba(240,240,240,0.25)');
// Um vagão (o pé fica em wx + 31 + dir * 2, y0 + 41).
function vagao(g, wx, y0, dir, c) {
  roda(g, wx + 12, y0 + 36, 5);
  roda(g, wx + 50, y0 + 36, 5);
  bloco(g, wx, y0 + 8, 62, 28, 22, c.t, c.f, 6);
  g.fillStyle = 'rgba(255,240,200,0.75)';
  for (let k = 0; k < 3; k++) g.fillRect(wx + 8 + k * 18, y0 + 16, 10, 6);
  ret(g, c.c, wx, y0 - 20, 62, 3);
  ret(g, '#2a2a2e', dir > 0 ? wx + 62 : wx - 4, y0 + 24, 4, 3);
}
// A locomotiva sem a fumaça (o pé fica em lx + 37 + dir * 4.5, y0 + 42).
function locomotiva(g, lx, y0, dir) {
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
    for (let i = 3; i + 1 < fx.length; i += 2) tronco(g, fx[i], y0, fx[i + 1], t);
  } else {
    sinal(g, y0, fx[3], t);
    if (fx[4] != null) trem(g, fx[4], y0, fx[2], fx[5], r, t);
  }
}

/* ─── O coelho, o gavião e os finais ─── */

// vis: o visual do Club Coelho ({ pelo, roupa }) no jogo junto; sem ele, o coelho de sempre.
function coelho(g, x, yPes, s, esmaga, olhar, m, t, vis = null) {
  const arco = s > 0 ? Math.sin(Math.PI * s) * 13 : 0;
  let sx = 1;
  let sy = 1;
  if (s > 0) { sy = 1 + 0.16 * Math.sin(Math.PI * s); sx = 1 - 0.08 * Math.sin(Math.PI * s); } // estica no pulo
  else if (esmaga > 0) { sy = 1 - 0.2 * esmaga; sx = 1 + 0.14 * esmaga; } // achata ao pousar
  if (arco > 1) elipse(g, x, yPes + 1, 12 - arco * 0.25, 3.6, 'rgba(0,0,0,0.22)');
  g.save();
  if (m & 1) g.globalAlpha = 0.45;
  // No meio do pulo, o sprite "pulando" (se houver); fora dele, o coelho de sempre (que já usa o sprite do coelho).
  if (s > 0 && temExato('travessia.coelho', 'pulando')) {
    desenharSprite(g, 'travessia.coelho', 'pulando', x, yPes - arco, { progresso: s, dir: olhar < 0 ? -1 : 1, cor: vis ? vis.pelo : peloDe(m) });
    g.restore();
    return;
  }
  g.translate(x, yPes - arco);
  g.scale(ESCALA * sx, ESCALA * sy);
  desenharCoelho(g, 0, 0, vis
    ? { pelo: vis.pelo, roupa: vis.roupa, acessorio: ACESSORIO, dir: olhar < 0 ? -1 : 1, t }
    : { pelo: peloDe(m), acessorio: m & 2 ? 'coroa' : ACESSORIO, dir: olhar < 0 ? -1 : 1, t });
  g.restore();
}

function amassado(g, x, yPes, olhar, m, t, vis = null, semSprite = false) {
  if (!semSprite && temExato('travessia.coelho', 'amassado')) {
    desenharSprite(g, 'travessia.coelho', 'amassado', x, yPes, { t, dir: olhar < 0 ? -1 : 1, cor: vis ? vis.pelo : peloDe(m) });
    return;
  }
  g.save();
  g.translate(x, yPes);
  g.scale(ESCALA * 1.5, ESCALA * 0.22);
  desenharCoelho(g, 0, 0, { pelo: vis ? vis.pelo : peloDe(m), acessorio: 'nenhum', dir: olhar < 0 ? -1 : 1, t: 0, semSprite });
  g.restore();
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.1;
    elipse(g, x + Math.cos(a) * 15, yPes - 14 + Math.sin(a) * 4, 2.2, 2.2, '#ffe27a');
  }
}

function respingo(g, x, yPes, q, m, vis = null, semSprite = false) {
  if (!semSprite && desenharSprite(g, 'travessia.respingo', 'afundando', x, yPes + 10, { progresso: q })) return;
  const y = yPes - 4;
  const pelo = vis ? vis.pelo : peloDe(m);
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
    elipse(g, x - 3, y - 6 + s * 8, 3, 9 * (1 - s) + 0.5, pelo, -0.2);
    elipse(g, x + 4, y - 6 + s * 8, 3, 9 * (1 - s) + 0.5, pelo, 0.15);
  }
  g.restore();
}

function gaviao(g, x, y, bate, esc, semSprite = false) {
  if (!semSprite && desenharSprite(g, 'travessia.gaviao', 'voando', x, y, { t: bate / 18, escala: esc })) return;
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
function gaviaoPega(g, x, yPes, q, olhar, m, t, vis = null) {
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
  coelho(g, 0, 0, 0, 0, olhar, m, t, vis);
  g.restore();
  gaviao(g, hx, hy, bate, 1);
}

// O trem arremessa o coelho girando.
function voando(g, x, yPes, q, olhar, m, t, vis = null) {
  g.save();
  g.translate(x, yPes - Math.sin(Math.PI * Math.min(1, q * 1.3)) * 50 - 16);
  g.rotate(q * 16 * (olhar < 0 ? -1 : 1));
  coelho(g, 0, 16, 0, 0, olhar, m, t, vis);
  g.restore();
}

// Parado demais (ou ficando para trás): a sombra do gavião rodeia o coelho.
function sombraGaviao(g, x, yPes, o, t) {
  const sx = x + Math.cos(t * 1.7) * 62;
  const sy = yPes - 12 + Math.sin(t * 1.7) * 22;
  g.save();
  g.globalAlpha = 0.1 + o * 0.25;
  if (!desenharSprite(g, 'travessia.sombra-gaviao', 'rodeando', sx, sy, { t })) corpoSombraGaviao(g, sx, sy);
  g.globalAlpha = 1;
  if (o > 0.5) {
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    texto(g, '!', x, yPes - 44, FONTE_MEDIA, '#ffdf6b', 'rgba(60,20,10,0.7)', 4);
  }
  g.restore();
}

function corpoSombraGaviao(g, sx, sy) {
  elipse(g, sx, sy, 8, 5, '#000');
  elipse(g, sx - 14, sy - 1, 13, 3, '#000', -0.15);
  elipse(g, sx + 14, sy - 1, 13, 3, '#000', 0.15);
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
  cenouraPlacar(g);
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

/* ─── Jogo junto: chegada, nomes, vidas e avisos ─── */

function coracao(g, x, y, r, cheio) {
  g.beginPath();
  g.moveTo(x, y + r);
  g.bezierCurveTo(x - r * 1.5, y, x - r * 0.9, y - r * 1.2, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.9, y - r * 1.2, x + r * 1.5, y, x, y + r);
  g.closePath();
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(38,28,16,0.55)';
  g.stroke();
  g.fillStyle = cheio ? '#e0455a' : 'rgba(255,255,255,0.35)';
  g.fill();
  if (cheio) elipse(g, x - r * 0.45, y - r * 0.35, r * 0.22, r * 0.16, 'rgba(255,255,255,0.6)', -0.5);
}

// Xadrez dourado no chão da fileira da chegada.
function faixaChegada(g, y0) {
  const y = y0 + CEL - 10;
  for (let i = 0; i * 12 < LARGURA; i++) {
    ret(g, i & 1 ? '#fff4d6' : OURO_CASA, i * 12, y, 12, 5);
    ret(g, i & 1 ? OURO_CASA : '#fff4d6', i * 12, y + 5, 12, 5);
  }
}

// O bandeirão da chegada: dois postes, corda com bandeirinhas e a placa dourada da Casa Luckham.
function bandeirao(g, y0, t, semSprite = false) {
  if (!semSprite && desenharSprite(g, 'travessia.chegada', 'balancando', LARGURA / 2, y0 + 39, { t })) return;
  for (const x of [4, LARGURA - 12]) {
    sombra(g, x - 2, y0 + 34, 14, 5);
    bloco(g, x, y0 + 30, 8, 8, 66, '#9a6a3c', '#6e4526');
    elipse(g, x + 4, y0 - 38, 6, 6, OURO_CASA);
    elipse(g, x + 2.5, y0 - 40, 2, 2, '#fff4d6');
  }
  const x0 = 10;
  const x1 = LARGURA - 10;
  const ya = y0 - 32;
  const yc = y0;
  g.strokeStyle = '#6b4325';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, ya);
  g.quadraticCurveTo(LARGURA / 2, yc, x1, ya);
  g.stroke();
  const n = 15;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const x = a * x0 + b * (LARGURA / 2) + u * u * x1;
    const y = a * ya + b * yc + u * u * ya;
    poligono(g, CORES_BANDEIRA[i % 3], x - 7, y, x + 7, y, x + Math.sin(t * 4 + i * 0.9) * 2.5, y + 14);
  }
  const cx = LARGURA / 2;
  poligono(g, OURO_CASA, cx - 10, y0 - 15, cx - 10, y0 - 24, cx - 5, y0 - 19, cx, y0 - 27, cx + 5, y0 - 19, cx + 10, y0 - 24, cx + 10, y0 - 15);
  elipse(g, cx, y0 - 19, 1.8, 1.8, '#b23a48');
  ret(g, '#8a5a1e', cx - 54, y0 - 15, 108, 24);
  ret(g, OURO_CASA, cx - 52, y0 - 13, 104, 20);
  ret(g, '#f6d978', cx - 52, y0 - 13, 104, 4);
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = FONTE_PLACA;
  g.fillStyle = '#5a3510';
  g.fillText('CHEGADA', cx, y0 - 2);
  g.restore();
}

function etiqueta(g, s, x, y, cor) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  texto(g, s, x, y, FONTE_NOME, cor, 'rgba(30,20,10,0.8)', 4);
  g.restore();
}

// A faixa de aviso embaixo da tela ("Você está fora: assistindo"...).
function faixaAviso(g, s) {
  g.save();
  g.font = FONTE_AVISO;
  const w = g.measureText(s).width + 32;
  const x = (LARGURA - w) / 2;
  const y = ALTURA - 64;
  ret(g, 'rgba(38,26,14,0.78)', x, y, w, 34);
  ret(g, OURO_CASA, x, y, w, 2);
  g.fillRect(x, y + 32, w, 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffe9a8';
  g.fillText(s, LARGURA / 2, y + 17);
  g.restore();
}

// info: { coop, vidas, faltam, vivos, total, faixa }
function hudJunto(g, v, t, info) {
  const contorno = 'rgba(38,28,16,0.55)';
  g.save();
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.textAlign = 'center';
  texto(g, String(v.p || 0), LARGURA / 2, 8, FONTE_PONTOS, '#fffdf4', contorno, 7);
  cenouraPlacar(g);
  g.textAlign = 'left';
  texto(g, String(v.k || 0), 36, 18, FONTE_MEDIA, '#ffe08a', contorno, 5);
  if (info.vidas != null) { // versus: um coração; co-op: as vidas da equipe
    const n = info.vidas;
    const xs = LARGURA - 22;
    if (n <= 0) coracao(g, xs, 28, 9, false);
    else if (n <= 5) for (let i = 0; i < n; i++) coracao(g, xs - i * 22, 28, 9, true);
    else {
      coracao(g, xs - 34, 28, 9, true);
      g.textAlign = 'left';
      texto(g, `x${n}`, xs - 20, 18, FONTE_MEDIA, '#ffffff', contorno, 5);
    }
    if (info.coop) {
      g.textAlign = 'right';
      texto(g, 'Equipe', LARGURA - 12, 42, FONTE_PEQ, '#ffffff', contorno, 4);
    }
  }
  g.textAlign = 'center';
  if (info.coop) {
    const f = info.faltam;
    const s = f <= 0 ? 'Linha de chegada!' : f === 1 ? 'Falta 1 fileira' : `Faltam ${f} fileiras`;
    texto(g, s, LARGURA / 2, 58, FONTE_PEQ, '#ffe08a', contorno, 4);
  } else {
    texto(g, `Vivos: ${info.vivos} de ${info.total}`, LARGURA / 2, 58, FONTE_PEQ, '#ffffff', contorno, 4);
  }
  if (!info.faixa && !v.e && v.o > 0.05) {
    g.globalAlpha = Math.min(1, v.o * 1.5) * (0.6 + 0.4 * Math.sin(t * 10));
    texto(g, 'Ande! O gavião está de olho!', LARGURA / 2, 80, FONTE_AVISO, '#ffd9c9', 'rgba(60,20,10,0.7)', 4);
  }
  g.restore();
  if (info.faixa) faixaAviso(g, info.faixa);
}

// Desenha a cena inteira a partir de uma "vista" (a mesma coisa que vai para quem assiste).
// J (só no jogo junto): ganchos para desenhar a chegada, os outros coelhos, os nomes e o placar junto.
function desenharCena(g, v, t, extra, J = null) {
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
  if (J) J.chao(g, cam, t);
  const bx = b[0];
  const by = ALTURA - (b[1] - cam + 0.5) * CEL + 7 - b[5] * 9; // os pés
  const vis = v.vis; // o visual do Club Coelho (só no jogo junto)
  if (e === 1 && !v.z) amassado(g, bx, by, b[2], m, t, vis);
  // de longe para perto; o coelho entra logo depois da fileira dele
  let feito = !!v.z || !(e === 0 || (e === 3 && q < 0.33));
  const filaCoelho = Math.round(b[1]);
  for (let i = 0; i < f.length; i++) {
    objetos(g, f[i], topoFaixa(f[i][0], cam), t);
    if (J) J.fila(g, f[i][0], cam, t);
    if (!feito && f[i][0] <= filaCoelho) { coelho(g, bx, by, b[3], b[4], b[2], m, t, vis); feito = true; }
  }
  if (J) J.fila(g, -Infinity, cam, t);
  if (!feito) coelho(g, bx, by, b[3], b[4], b[2], m, t, vis);
  if (!v.z) {
    if (e === 2) respingo(g, bx, by, q, m, vis);
    else if (e === 3) gaviaoPega(g, bx, by, q, b[2], m, t, vis);
    else if (e === 4) voando(g, bx, by, q, b[2], m, t, vis);
    else if (e === 0 && v.o > 0) sombraGaviao(g, bx, by, v.o, t);
  }
  if (J) J.cima(g, cam, t, v, bx, by);
  if (extra) extra(g, cam);
  if (noiteAtiva) noite(g, bx, e === 3 && q >= 0.33 ? by - 60 : by - 18);
  if (J) J.hud(g, v, t);
  else hud(g, v, t);
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

/* ─── Sprites: o que pode trocar de desenho (veja ../sprites.js) ─── */

// Para as prévias: em que ponto (0 a 1) de uma animação de "quadros" a "fps" está o tempo t.
const fasePrevia = (t, quadros, fps) => ((t * fps) / quadros) % 1;
// Uma casinha do chão de sempre (a coluna do meio da fileira), com o centro em 0, 0.
function previaChao(g, fx, t) {
  g.save();
  g.beginPath();
  g.rect(-CEL / 2, -CEL / 2, CEL, CEL);
  g.clip();
  g.translate(-CEL / 2 - 4 * CEL, 0);
  chao(g, fx, -CEL / 2, t, null, true);
  g.restore();
}
const NOME_JOGO = 'Travessia';
const PARADO = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const carrocaPeca = (tipo, nome, desc) => ({
  chave: CHAVE_CARROCA[tipo], jogo: NOME_JOGO, nome, desc: `${desc} Olhando para a DIREITA (o cavalo na frente, à direita); o jogo vira quando ela vai para a esquerda. A sombra no chão o jogo desenha.`,
  largura: COMP_VEIC[tipo] + 4, altura: 70, ancora: 'pe',
  animacoes: [{ id: 'andando', nome: 'Andando', quadros: 4, fps: 10 }],
  previa: (g, anim, t) => corpoCarroca(g, tipo, -COMP_VEIC[tipo] / 2, -40, 1, 0, t),
});
const troncoPeca = (n, nome) => ({
  chave: CHAVE_TRONCO[n], jogo: NOME_JOGO, nome, desc: `Tronco de ${n} casinhas boiando no rio, visto do alto como o resto do jogo. A sombra na água o jogo desenha.`,
  largura: n * CEL - 6 + 10, altura: 34, ancora: 'pe',
  animacoes: [{ id: 'boiando', nome: 'Boiando', quadros: 1, fps: 4 }],
  previa: g => corpoTronco(g, -(n * CEL - 6) / 2, -37, n * CEL - 6),
});
const obstaculoPeca = (k, nome, desc, largura, altura, animacoes, v = () => 0) => ({
  chave: CHAVE_OBST[k], jogo: NOME_JOGO, nome, desc: `${desc} A sombra no chão o jogo desenha.`, largura, altura, ancora: 'pe', animacoes,
  previa: (g, anim) => corpoObstaculo(g, k, 0, -38, v(anim)),
});
const chaoPeca = (chave, nome, desc, animacoes, fx) => ({
  chave, jogo: NOME_JOGO, nome, desc: `${desc} É uma casinha que o jogo repete pela fileira inteira: desenhe até a borda, sem folga.`,
  largura: CEL, altura: CEL, ancora: 'centro', animacoes,
  previa: (g, anim, t) => previaChao(g, fx(anim), t),
});

export const SPRITES = [
  {
    chave: 'travessia.coelho', jogo: NOME_JOGO, nome: 'Coelho pulando e amassado',
    desc: 'Só os momentos especiais do coelho na Travessia: no meio do pulo e amassado pela carroça (com as estrelinhas). Parado, vale o sprite do "Coelho do jogador". Olhando para a DIREITA; a altura do pulo o jogo faz. Desenhe em cinza claro e marque "pintar com a cor do jogador" para cada um ter o seu pelo.',
    largura: 54, altura: 52, ancora: 'pe', tingir: true,
    animacoes: [{ id: 'pulando', nome: 'Pulando', quadros: 4, fps: 12 }, { id: 'amassado', nome: 'Amassado', quadros: 6, fps: 4 }],
    previa: (g, anim, t) => {
      if (anim === 'amassado') { amassado(g, 0, 0, 1, 0, t, null, true); return; }
      const s = fasePrevia(t, 4, 12);
      g.save();
      g.scale(ESCALA * (1 - 0.08 * Math.sin(Math.PI * s)), ESCALA * (1 + 0.16 * Math.sin(Math.PI * s)));
      desenharCoelho(g, 0, 0, { pelo: PELO, acessorio: ACESSORIO, dir: 1, t: 0, semSprite: true });
      g.restore();
    },
  },
  {
    chave: 'travessia.respingo', jogo: NOME_JOGO, nome: 'Splash no rio',
    desc: 'Quando o coelho cai na água: os anéis, as gotas e as orelhas afundando. Acontece uma vez (1 segundo), do primeiro ao último quadro.',
    largura: 76, altura: 52, ancora: 'pe',
    animacoes: [{ id: 'afundando', nome: 'Afundando', quadros: 8, fps: 8 }],
    previa: (g, anim, t) => respingo(g, 0, -10, fasePrevia(t, 8, 8), 0, null, true),
  },
  {
    chave: 'travessia.gaviao', jogo: NOME_JOGO, nome: 'Gavião',
    desc: 'O gavião que pega quem fica parado ou para trás. Visto de frente, de asas abertas, batendo as asas.',
    largura: 90, altura: 46, ancora: 'centro',
    animacoes: [{ id: 'voando', nome: 'Voando', quadros: 4, fps: 12 }],
    previa: (g, anim, t) => gaviao(g, 0, 0, t * 18, 1, true),
  },
  {
    chave: 'travessia.sombra-gaviao', jogo: NOME_JOGO, nome: 'Sombra do gavião',
    desc: 'A sombra que rodeia o coelho parado demais. Desenhe em preto: o jogo deixa quase transparente.',
    largura: 56, altura: 12, ancora: 'centro',
    animacoes: [{ id: 'rodeando', nome: 'Rodeando', quadros: 1, fps: 1 }],
    previa: g => corpoSombraGaviao(g, 0, 0),
  },
  carrocaPeca(0, 'Carroça do leiteiro', 'A carroça pequena com os latões de leite e o cavalo.'),
  carrocaPeca(1, 'Carroça de barris', 'A carroça média com três barris e o cavalo.'),
  carrocaPeca(2, 'Carroça do mercador', 'A carroça comprida com a lona listrada do mercador e o cavalo.'),
  carrocaPeca(3, 'Carroça de feno', 'A carroça mais comprida, com o monte de feno e o cavalo.'),
  {
    chave: 'travessia.locomotiva', jogo: NOME_JOGO, nome: 'Locomotiva',
    desc: 'A frente do trem, com a cabine e a chaminé. Olhando para a DIREITA (o limpa-trilhos à direita, a cabine atrás). A fumaça é outra peça.',
    largura: 84, altura: 72, ancora: 'pe',
    animacoes: [{ id: 'andando', nome: 'Andando', quadros: 2, fps: 8 }],
    previa: g => locomotiva(g, -41.5, -42, 1),
  },
  {
    chave: 'travessia.vagao', jogo: NOME_JOGO, nome: 'Vagão',
    desc: 'Um vagão do trem (o jogo junta de 2 a 6 atrás da locomotiva). Indo para a DIREITA, com o engate à direita.',
    largura: 68, altura: 62, ancora: 'pe',
    animacoes: [{ id: 'andando', nome: 'Andando', quadros: 2, fps: 8 }],
    previa: g => vagao(g, -33, -41, 1, VAGOES[0]),
  },
  {
    chave: 'travessia.fumaca', jogo: NOME_JOGO, nome: 'Fumaça do trem',
    desc: 'Uma nuvenzinha que sai da chaminé, cresce e some (do primeiro ao último quadro). O jogo solta três de cada vez.',
    largura: 28, altura: 22, ancora: 'centro',
    animacoes: [{ id: 'subindo', nome: 'Subindo', quadros: 6, fps: 8 }],
    previa: (g, anim, t) => fumaca(g, 0, 0, fasePrevia(t, 6, 8)),
  },
  {
    chave: 'travessia.sinal', jogo: NOME_JOGO, nome: 'Sinal do trem',
    desc: 'O sinal na beira do trilho. "Piscando" é quando o trem vem: 2 quadros, o 1º aceso e o 2º apagado (o jogo pisca no ritmo do sino).',
    largura: 22, altura: 42, ancora: 'pe',
    animacoes: [{ id: 'apagado', nome: 'Apagado', quadros: 1, fps: 1 }, { id: 'piscando', nome: 'Piscando', quadros: 2, fps: 5 }],
    previa: (g, anim, t) => { g.save(); g.translate(-(LARGURA - 22) - 3, -8); sinal(g, 0, anim === 'piscando', t, true); g.restore(); },
  },
  troncoPeca(2, 'Tronco curto'),
  troncoPeca(3, 'Tronco médio'),
  troncoPeca(4, 'Tronco comprido'),
  {
    chave: 'travessia.vitoria-regia', jogo: NOME_JOGO, nome: 'Vitória-régia',
    desc: 'A folha no rio onde o coelho pula. "Balançando" avisa que vai afundar; "Afundada" são só as bolhinhas (sem folha!). Sem o "Balançando", o jogo usa a firme um pouco menor, tremendo.',
    largura: 40, altura: 28, ancora: 'centro',
    animacoes: [{ id: 'firme', nome: 'Firme', quadros: 1, fps: 1 }, { id: 'balancando', nome: 'Balançando', quadros: 4, fps: 14 }, { id: 'afundada', nome: 'Afundada', quadros: 5, fps: 8 }],
    previa: (g, anim, t) => nenufar(g, 0, -26, anim === 'afundada' ? 3 : anim === 'balancando' ? 2 : 1, t, 0, 0, true),
  },
  {
    chave: 'travessia.cenoura', jogo: NOME_JOGO, nome: 'Cenoura dourada',
    desc: 'A cenoura que aparece nos campos, com o brilhinho piscando. O jogo faz ela subir e descer; o primeiro quadro também vai no placar.',
    largura: 28, altura: 32, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 6, fps: 5 }],
    previa: (g, anim, t) => corpoCenoura(g, 0, 0, t, 0),
  },
  obstaculoPeca(1, 'Árvore', 'Árvore do campo, vista do alto e de frente como os bloquinhos do jogo. "Alta" tem a copa em dois andares.', 40, 74,
    [{ id: 'alta', nome: 'Alta', quadros: 1, fps: 1 }, { id: 'baixa', nome: 'Baixa', quadros: 1, fps: 1 }], a => (a === 'baixa' ? 0.25 : 0.75)),
  obstaculoPeca(2, 'Pedra', 'Pedra com musgo no campo.', 32, 38, PARADO, () => 0.5),
  obstaculoPeca(3, 'Arbusto', 'Arbusto com frutinhas vermelhas.', 36, 40, PARADO),
  obstaculoPeca(4, 'Poste com lanterna', 'O poste com a lanterna acesa (de noite o jogo põe a luz em volta).', 20, 54, PARADO),
  obstaculoPeca(5, 'Fardo de feno', 'Fardo de feno amarrado.', 38, 42, PARADO),
  chaoPeca('travessia.campo', 'Grama do campo', 'O chão dos campos. As fileiras alternam a clara e a escura (pode enviar só uma).',
    [{ id: 'claro', nome: 'Clara', quadros: 1, fps: 1 }, { id: 'escuro', nome: 'Escura', quadros: 1, fps: 1 }], a => [a === 'claro' ? 1 : 2, 0, '000000000', -1]),
  chaoPeca('travessia.estrada', 'Estrada de terra', 'O chão das estradas das carroças, com os sulcos das rodas na horizontal.',
    [{ id: 'terra', nome: 'Terra', quadros: 1, fps: 1 }], () => [3, 1, 1]),
  chaoPeca('travessia.rio', 'Água do rio', 'A água do rio. O jogo já faz a água correr para o lado da correnteza.',
    [{ id: 'agua', nome: 'Água', quadros: 4, fps: 4 }], () => [5, 2, 1]),
  chaoPeca('travessia.trilho', 'Trilho do trem', 'Brita, dormentes e os dois trilhos, na horizontal.',
    [{ id: 'trilho', nome: 'Trilho', quadros: 1, fps: 1 }], () => [7, 4, 1]),
  {
    chave: 'travessia.barranco', jogo: NOME_JOGO, nome: 'Beira do campo',
    desc: 'A frente do barranco onde o campo acaba (logo abaixo da grama). O jogo repete pela fileira inteira: desenhe até a borda.',
    largura: CEL, altura: 12, ancora: 'topo',
    animacoes: [{ id: 'terra', nome: 'Antes da estrada ou do trilho', quadros: 1, fps: 1 }, { id: 'rio', nome: 'Antes do rio', quadros: 1, fps: 1 }],
    previa: (g, anim) => barranco(g, -CEL, anim === 'rio' ? 2 : 1, -CEL / 2, CEL, true),
  },
  {
    chave: 'travessia.chegada', jogo: NOME_JOGO, nome: 'Bandeirão da chegada',
    desc: 'No co-op do jogo junto: os dois postes, a corda com bandeirinhas e a placa "CHEGADA", de um lado ao outro da tela.',
    largura: LARGURA, altura: 84, ancora: 'pe',
    animacoes: [{ id: 'balancando', nome: 'Balançando', quadros: 6, fps: 4 }],
    previa: (g, anim, t) => { g.save(); g.translate(-LARGURA / 2, -39); bandeirao(g, 0, t, true); g.restore(); },
  },
];
registrarPecas(SPRITES);

/* ─── O jogo ─── */

function novoEstado(ctx) {
  const semente = Math.floor(ctx.sorte() * 4294967296) >>> 0;
  const J = ctx.junto || null;
  const dif = J ? Math.max(1, Number(J.dif) || 1) : 1;
  // co-op: a chegada fica mais longe quanto mais gente (40 + 15 por pessoa)
  const meta = J && J.modo === 'coop' ? 40 + 15 * Math.max(1, Number(J.n) || 1) : null;
  const E = {
    tempo: 0, semente, ger: J ? novoGerador(semente, dif, meta) : novoGerador(semente), faixas: [],
    fila: 0, x: 4 * CEL + 24, olhar: 1, tronco: -1, desloc: 0,
    pulo: null, guardado: null, cam: -3.5, maxFila: 0, cenouras: 0, ocioso: 0, esmaga: 0, suaveX: 0,
    morte: null, acabou: false,
  };
  if (J) {
    Object.assign(E, {
      meta, posto: false, chegou: false, fora: false, morriEnviado: false, renascer: 0, protegido: 0, pulos: 0,
      pontosEnviados: 0, relogioPontos: 1, ultimaPos: '', relogioPos: 0, ultimaGrama: { fila: 0, x: 4 * CEL + 24 },
      pegas: new Set(), pedidas: new Set(),
    });
  }
  return E;
}

// copia: um jogo copiado (só nos testes) não mexe no melhor da sessão.
function montar(ctx, E, copia = false) {
  const som = nome => { try { ctx.som?.(nome); } catch { /* sem som */ } };
  const segredo = chave => { try { return !!ctx.segredo?.(chave); } catch { return false; } };
  const parts = Array.from({ length: 60 }, () => ({ vida: 0, max: 1, x: 0, p: 0, z: 0, vx: 0, vz: 0, tipo: 0 }));
  let relogioBrilho = 0;
  // Jogo junto (versus ou co-op). As cópias dos testes (teste.clonar) não mandam nada para a sala.
  const J0 = ctx.junto || null;
  const J = J0 && copia ? { ...J0, pos: nada, evento: nada, pegar: nada, morri: nada, cheguei: nada, pontos: nada } : J0;
  const coop = !!J && J.modo === 'coop';
  const versus = !!J && !coop;
  const R = [];     // cada pessoa da sala: o que ela mandou e onde o coelho dela aparece aqui
  const lista = []; // os outros que aparecem neste quadro, de longe para perto
  let iLista = 0;

  const faixa = r => {
    const i = r - E.faixas[0].r;
    return i >= 0 && i < E.faixas.length ? E.faixas[i] : null;
  };
  // gera à frente da câmera e esquece o que ficou para trás
  function gerarAte(ate = Math.floor(E.cam) + 16) {
    while (E.ger.r <= ate) {
      const fx = gerarFaixa(E.ger);
      if (J && fx.cenoura >= 0 && E.pegas.has(`c:${fx.r}:${fx.cenoura}`)) fx.cenoura = -1; // alguém já pegou
      E.faixas.push(fx);
    }
    if (J) return; // junto: guarda tudo (renascer e assistir os outros podem levar a câmera para trás)
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
  // Puf! uma nuvenzinha (alguém sumiu ou apareceu)
  function puf(x, p) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      soltar(0, x + Math.cos(a) * 6, p, 12 + Math.sin(a) * 6, Math.cos(a) * acaso(40, 75), acaso(8, 40), acaso(0.4, 0.75));
    }
    brilhos(4, x, p);
  }

  /* Pulos */
  function iniciarPulo(a) {
    if (J) E.pulos++; // os outros sabem que começou um pulo novo
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
      if (pode && E.chegou && E.fila + dy < E.meta) pode = false; // chegou (co-op): não volta para o perigo
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
      if (J) E.ultimaGrama = { fila: E.fila, x: E.x };
      if (fx.cenoura >= 0 && fx.cenoura === colunaDoX(E.x)) {
        if (J) pedirCenoura(fx); // junto: só conta quando a sala disser quem pegou primeiro
        else {
          fx.cenoura = -1;
          E.cenouras++;
          som('moeda');
          brilhos(10, E.x, E.fila);
        }
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
    if (E.chegou) { E.ocioso = 0; return; } // chegou (co-op): o gavião deixa em paz
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

  /* ─── Jogo junto: os outros coelhos, a sala e a câmera ─── */

  function visualDe(jg, i) {
    const v = jg?.visual;
    const pelo = typeof v?.pelo === 'string' && /^#[0-9a-f]{6}$/i.test(v.pelo) ? v.pelo : PELOS[i % PELOS.length];
    return { pelo, roupa: v?.roupa && typeof v.roupa === 'object' ? v.roupa : null };
  }
  // A coluna livre e alcançável de um campo mais perto de "pref" (-1 se não tem nenhuma).
  function colunaLivre(fx, pref) {
    let melhor = -1;
    let dist = 99;
    for (let c = 0; c < COLUNAS; c++) {
      if (!fx || fx.tipo !== 'g' || fx.bloq[c] || !((fx.alc >> c) & 1)) continue;
      if (Math.abs(c - pref) < dist) { dist = Math.abs(c - pref); melhor = c; }
    }
    return melhor;
  }
  const PREF_LARGADA = [4, 3, 5, 2, 6, 1, 7, 0, 8];
  const xLargada = i => {
    const c = colunaLivre(faixa(0), PREF_LARGADA[i % COLUNAS]);
    return (c < 0 ? 4 : c) * CEL + 24;
  };

  const estadoSala = () => { try { return J.estado?.() || null; } catch { return null; } };
  const vivoRemoto = (o, est) => !o.fora && !est?.p?.[o.i]?.fora && !est?.p?.[o.i]?.saiu;
  const chegouRemoto = (o, est) => o.chegou || !!est?.p?.[o.i]?.chegou;

  // x de quem está num tronco: o tronco anda igual para todos (mesmo relógio), então basta o lugar nele.
  function alvoX(d) {
    if (d.t >= 0) {
      const fx = faixa(Math.round(d.f));
      const ob = fx && fx.tipo === 't' ? fx.objs[d.t] : null;
      if (ob) return posObj(fx, ob, E.tempo) + d.od;
    }
    return d.x;
  }

  // Chegou a posição de alguém: guarda e começa a animação (pulo, morte ou aparecer de novo).
  function receber(o, d) {
    if (!o || o.i === J.eu || o.fora || !d || typeof d !== 'object') return;
    const f = Number(d.f);
    const x = Number(d.x);
    if (!Number.isFinite(f) || !Number.isFinite(x)) return;
    const e = d.e >= 1 && d.e <= 4 ? Math.floor(d.e) : 0;
    const antes = o.d;
    const novo = {
      f: limitar(f, -6, 1e6), x: limitar(x, -300, LARGURA + 300), t: Number.isInteger(d.t) ? d.t : -1, od: Number(d.o) || 0,
      l: d.l < 0 ? -1 : 1, n: Math.floor(Number(d.n) || 0), h: limitar(Number(d.h) || 0, 0, 1),
    };
    o.d = novo;
    o.olhar = novo.l;
    if (d.c) o.chegou = true;
    if (e) { // morreu: a animação começa no lugar onde aconteceu
      if (!o.e) Object.assign(o, { e, et: 0, ex: novo.x, ep: novo.f, vx: Number(d.v) || 0, pulo: null });
      return;
    }
    if (o.e || o.sumido) { // renasceu: aparece direto no lugar novo
      Object.assign(o, { e: 0, sumido: false, pulo: null, n: novo.n, x: alvoX(novo), p: novo.f, erroX: 0, erroP: 0, pisca: 1.2 });
      puf(o.x, o.p);
      return;
    }
    if (novo.n !== o.n) { // pulo novo: daqui até o destino
      o.n = novo.n;
      const bate = !!antes && novo.f === antes.f && Math.abs(alvoX(novo) - o.x) < 10;
      o.pulo = { t: Math.min(0.5, novo.h), x0: o.x, p0: o.p, bate };
      return;
    }
    if (!o.pulo) { o.erroX = o.x - alvoX(novo); o.erroP = o.p - novo.f; }
  }

  // Os outros andam suave: o erro até o destino some aos poucos (e quem está no tronco vai com ele).
  function moverOutros(dt) {
    const k = 1 - Math.min(1, dt * 14);
    for (const o of R) {
      if (o.i === J.eu) continue;
      o.pisca = Math.max(0, o.pisca - dt);
      o.esmaga = Math.max(0, o.esmaga - dt * 9);
      if (o.e) {
        o.et += dt;
        if (o.e === 4) o.ex += o.vx * dt;
        continue;
      }
      const d = o.d;
      if (!d) continue;
      const tx = alvoX(d);
      if (o.pulo) {
        const P = o.pulo;
        P.t = Math.min(1, P.t + dt / DUR_PULO);
        if (P.bate) { o.x = tx; o.p = d.f; } else { o.x = P.x0 + (tx - P.x0) * P.t; o.p = P.p0 + (d.f - P.p0) * P.t; }
        if (P.t >= 1) { o.pulo = null; o.esmaga = 1; o.erroX = 0; o.erroP = 0; }
      } else {
        o.erroX *= k;
        o.erroP *= k;
        o.x = tx + o.erroX;
        o.p = d.f + o.erroP;
      }
      const fx = faixa(Math.round(d.f));
      o.alt = !o.pulo && fx && (fx.tipo === 't' || fx.tipo === 'n') ? 1 : 0;
    }
  }

  function pedirCenoura(fx) {
    const chave = `c:${fx.r}:${fx.cenoura}`;
    if (E.pedidas.has(chave) || E.pegas.has(chave)) return;
    E.pedidas.add(chave);
    J.pegar(chave, 1);
  }
  // A sala disse quem pegou a cenoura (o primeiro que pediu leva).
  function pegou(i, chave) {
    const m = /^c:(-?\d+):(\d+)$/.exec(String(chave));
    if (!m) return;
    const r = Number(m[1]);
    const c = Number(m[2]);
    const k = `c:${r}:${c}`;
    if (E.pegas.has(k)) return;
    E.pegas.add(k);
    const fx = faixa(r);
    if (fx && fx.cenoura === c) fx.cenoura = -1;
    if (i === J.eu) {
      E.cenouras++;
      som('moeda');
      brilhos(10, c * CEL + 24, r);
    }
  }

  function chegar() {
    E.chegou = true;
    E.ocioso = 0;
    J.cheguei();
    som('fase');
    brilhos(16, xAtual(), pAtual());
  }

  // Onde renascer: um campo uma fileira atrás de quem vai mais na frente (co-op), ou o meu último campo.
  function pontoDeRenascer() {
    let base = E.ultimaGrama.fila;
    let xPref = E.ultimaGrama.x;
    if (coop) {
      const est = estadoSala();
      let lider = null;
      for (const o of R) {
        if (o.i === J.eu || !o.d || o.e || o.sumido || !vivoRemoto(o, est) || chegouRemoto(o, est)) continue;
        if (!lider || o.d.f > lider.d.f) lider = o;
      }
      if (lider && Math.floor(lider.d.f) - 1 > base) { base = Math.floor(lider.d.f) - 1; xPref = lider.x; }
      if (E.meta != null) base = Math.min(base, E.meta - 1);
    }
    gerarAte(base + 2);
    for (let r = Math.max(0, base); r >= 0; r--) {
      const c = colunaLivre(faixa(r), colunaDoX(xPref));
      if (c >= 0) return { fila: r, x: c * CEL + 24 };
    }
    return { fila: 0, x: xLargada(J.eu) };
  }

  function renascer() {
    const m = E.morte;
    if (m) puf(m.x, m.p);
    const pt = pontoDeRenascer();
    Object.assign(E, {
      morte: null, morriEnviado: false, renascer: 0, fila: pt.fila, x: pt.x, pulo: null, guardado: null, tronco: -1, desloc: 0,
      ocioso: 0, esmaga: 1, suaveX: 0, protegido: 1.5, cam: pt.fila - 3.5, maxFila: Math.max(E.maxFila, pt.fila),
      ultimaGrama: { fila: pt.fila, x: pt.x },
    });
    gerarAte();
    puf(pt.x, pt.fila);
    som('poder');
  }

  // Quem assistir (fora ou já chegou): quem está vivo mais na frente (depois de chegar, quem ainda atravessa).
  function alvoAssistir() {
    const est = estadoSala();
    let melhor = null;
    for (const o of R) {
      if (o.i === J.eu || o.sumido || !vivoRemoto(o, est)) continue;
      if (E.chegou && chegouRemoto(o, est)) continue;
      const p = o.e ? o.ep : o.p;
      if (melhor === null || p > melhor) melhor = p;
    }
    if (melhor === null && !E.fora) melhor = pAtual();
    return melhor;
  }

  function moverCamera(dt) {
    if (E.fora || E.chegou) {
      const alvo = alvoAssistir();
      if (alvo !== null) E.cam += (alvo - 3.5 - E.cam) * Math.min(1, dt * 2.5);
      return;
    }
    if (E.morte) return;
    const alvo = pAtual() - 3.5;
    if (alvo > E.cam) E.cam += (alvo - E.cam) * Math.min(1, dt * 4);
    let anda = 0.14 + 0.2 * dificuldade(E.maxFila, rampa(E.ger));
    if (versus) anda += Math.min(0.6, E.tempo * 0.0025); // no versus a tela aperta com o tempo
    E.cam += anda * dt;
  }

  // Manda onde estou (só quando muda, ou uma vez por segundo); a sala segura uns 12 por segundo.
  function enviarPos(dt) {
    if (E.fora) return;
    const m = E.morte;
    const P = E.pulo;
    const d = m
      ? { f: Math.round(m.p * 100) / 100, x: Math.round(m.x), t: -1, o: 0, l: E.olhar, n: E.pulos, h: 0, e: COD_MORTE[m.tipo], v: Math.round(m.vx) }
      : { f: P ? P.f1 : E.fila, x: Math.round(P ? P.x1 : E.x), t: P ? -1 : E.tronco, o: Math.round(E.desloc), l: E.olhar, n: E.pulos, h: P ? Math.round(P.t * 10) / 10 : 0, e: 0 };
    if (E.chegou) d.c = 1;
    const chave = `${d.f}|${d.t >= 0 ? `t${d.t}` : d.x}|${d.o}|${d.l}|${d.n}|${d.e}|${d.c ? 1 : 0}`;
    E.relogioPos += dt;
    if (chave === E.ultimaPos && E.relogioPos < 1) return;
    E.ultimaPos = chave;
    E.relogioPos = 0;
    J.pos(d);
  }

  // O quanto já andei (no máximo umas 2 vezes por segundo).
  function progresso(dt) {
    E.relogioPontos += dt;
    if (E.maxFila > E.pontosEnviados && E.relogioPontos >= 0.5) {
      E.relogioPontos = 0;
      E.pontosEnviados = E.maxFila;
      J.pontos(E.maxFila);
    }
  }

  // Um passo do jogo junto: o mundo vai pelo relógio da sala; o meu coelho, pelo passo daqui.
  function atualizarJunto(dt, entrada) {
    const antes = E.tempo;
    E.tempo = copia ? E.tempo + dt : Math.max(E.tempo, Math.max(0, Number(J.tempo()) || 0));
    const dtm = E.tempo - antes;
    moverParticulas(dt);
    moverOutros(dt);
    E.protegido = Math.max(0, E.protegido - dt);
    if (E.morte) {
      const m = E.morte;
      const a = m.t;
      m.t += dt;
      if (m.tipo === 'trem') m.x += m.vx * dt;
      if (m.tipo === 'gaviao' && a < 0.5 && m.t >= 0.5) som('morte');
      if (m.t >= DUR_MORTE[m.tipo] && !E.morriEnviado) { E.morriEnviado = true; J.morri(); } // uma vez só
      if (E.renascer > 0 && (E.renascer -= dt) <= 0) renascer();
    } else if (!E.fora) {
      for (const k of entrada?.apertou || []) {
        const a = ACAO[k];
        if (!a) continue;
        if (!E.pulo) iniciarPulo(a);
        else if (!E.guardado) E.guardado = a;
      }
      const aqui = faixa(E.fila);
      if (E.tronco >= 0 && aqui && aqui.tipo === 't') {
        if (E.pulo) {
          const dv = aqui.dir * aqui.vel * dtm;
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
        if (coop && !E.chegou && E.fila >= E.meta) chegar();
        sinos();
      }
    }
    moverCamera(dt);
    progresso(dt);
    enviarPos(dt);
    gerarAte();
  }

  // Os ganchos de desenho do jogo junto (veja desenharCena).
  function desenharOutro(g, o, cam, t, etapa) {
    const morto = o.e > 0;
    const x = morto ? o.ex : o.x;
    const p = morto ? o.ep : o.p;
    const y = ALTURA - (p - cam + 0.5) * CEL + 7 - (morto ? 0 : o.alt) * 9;
    if (y < -90 || y > ALTURA + 90 || x < -120 || x > LARGURA + 120) return;
    const q = morto ? Math.min(1, o.et / DUR_COD[o.e]) : 0;
    if (etapa === 0) { if (o.e === 1) amassado(g, x, y, o.olhar, 0, t, o.vis); return; }
    if (etapa === 1) {
      if (!morto || (o.e === 3 && q < 0.33)) {
        const s = o.pulo ? (o.pulo.bate ? o.pulo.t * 0.35 : o.pulo.t) : 0;
        coelho(g, x, y, s, o.esmaga, o.olhar, o.pisca > 0 && Math.floor(o.pisca * 8) % 2 ? 1 : 0, t, o.vis);
      }
      return;
    }
    if (etapa === 2) {
      if (o.e === 2) respingo(g, x, y, q, 0, o.vis);
      else if (o.e === 3) gaviaoPega(g, x, y, q, o.olhar, 0, t, o.vis);
      else if (o.e === 4) voando(g, x, y, q, o.olhar, 0, t, o.vis);
      return;
    }
    if (!morto) { // o nome, na cor da pessoa
      const s = o.pulo ? (o.pulo.bate ? o.pulo.t * 0.35 : o.pulo.t) : 0;
      etiqueta(g, o.nome, x, y - 46 - Math.sin(Math.PI * s) * 13, o.cor);
    }
  }
  function prepararOutros() {
    lista.length = 0;
    iLista = 0;
    const est = estadoSala();
    for (const o of R) {
      if (o.i === J.eu || o.fora || o.sumido) continue;
      const g = est?.p?.[o.i];
      if (g && (g.saiu || (g.fora && !o.e))) continue;
      o.pd = o.e ? o.ep : o.p;
      lista.push(o);
    }
    lista.sort((a, b) => b.pd - a.pd);
  }
  function infoHud() {
    const est = estadoSala();
    const ps = est?.p || [];
    let vivos = 0;
    for (const p of ps) if (p && !p.fora && !p.saiu) vivos++;
    let faixaTxt = null;
    if (E.fora) faixaTxt = 'Você está fora: assistindo';
    else if (E.chegou) faixaTxt = 'Você chegou! Esperando a equipe';
    else if (E.morte && E.renascer > 0) faixaTxt = 'Renascendo...';
    const vidasEquipe = Number(est?.vidasEquipe);
    return {
      coop,
      vidas: coop ? (Number.isFinite(vidasEquipe) ? vidasEquipe : null) : E.fora || E.morte ? 0 : 1,
      faltam: coop ? Math.max(0, E.meta - E.maxFila) : 0,
      vivos, total: ps.length || R.length, faixa: faixaTxt,
    };
  }
  const cena = J ? {
    chao(g, cam, t) {
      prepararOutros();
      if (E.meta != null) {
        const y = topoFaixa(E.meta, cam);
        if (y > -CEL && y < ALTURA) faixaChegada(g, y);
      }
      for (const o of lista) if (o.e === 1) desenharOutro(g, o, cam, t, 0);
    },
    fila(g, r, cam, t) {
      if (r === E.meta) bandeirao(g, topoFaixa(r, cam), t);
      while (iLista < lista.length && Math.round(lista[iLista].pd) >= r) desenharOutro(g, lista[iLista++], cam, t, 1);
    },
    cima(g, cam, t, v, bx, by) {
      for (const o of lista) if (o.e > 1) desenharOutro(g, o, cam, t, 2);
      for (const o of lista) desenharOutro(g, o, cam, t, 3);
      if (!v.z && !v.e) etiqueta(g, 'Você', bx, by - 46 - Math.sin(Math.PI * v.b[3]) * 13, R[J.eu]?.cor || OURO_CASA);
    },
    hud(g, v, t) { hudJunto(g, v, t, infoHud()); },
  } : null;

  if (J) {
    const n = Math.max(1, Number(J.n) || J.jogadores?.length || 1);
    for (let i = 0; i < n; i++) {
      const jg = J.jogadores?.[i];
      const x = xLargada(i);
      R.push({
        i, nome: String(jg?.nome || `Coelho ${i + 1}`).slice(0, 14), cor: jg?.cor || OURO_CASA, vis: visualDe(jg, i),
        d: null, x, p: 0, ex: x, ep: 0, pd: 0, olhar: 1, pulo: null, n: 0, e: 0, et: 0, vx: 0, esmaga: 0, alt: 0, pisca: 0,
        erroX: 0, erroP: 0, fora: false, chegou: false, sumido: false,
      });
    }
    if (!E.posto) { // cada um larga numa coluna (todos na mesma fileira)
      E.posto = true;
      E.x = xLargada(J.eu);
      E.ultimaGrama = { fila: 0, x: E.x };
    }
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
        puf(o.e ? o.ex : o.x, o.e ? o.ep : o.p);
        o.sumido = true; // some até mandar o lugar novo
      };
      J.aoFora = i => {
        if (i === J.eu) {
          if (E.fora) return;
          E.fora = true;
          const m = E.morte;
          puf(m ? m.x : xAtual(), m ? m.p : pAtual());
          return;
        }
        const o = R[i];
        if (!o || o.fora) return;
        if (!o.sumido) puf(o.e ? o.ex : o.x, o.e ? o.ep : o.p);
        o.fora = true;
      };
      J.aoChegou = i => {
        const o = R[i];
        if (!o) return;
        o.chegou = true;
        if (i !== J.eu && !o.e) brilhos(8, o.x, o.p);
      };
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
    const v = {
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
    if (J) {
      v.vis = R[J.eu]?.vis || null;
      if (E.fora) v.z = 1; // fora: o meu coelho some (só assisto)
      if (E.chegou || E.fora) v.o = 0;
      if (E.protegido > 0 && Math.floor(E.protegido * 8) % 2) v.m |= 1; // pisca quando renasce
    }
    return v;
  }

  return {
    get pontos() { return E.maxFila; },
    get acabou() { return E.acabou; },

    atualizar(dt, entrada) {
      if (E.acabou) return;
      if (J) { atualizarJunto(dt, entrada); return; } // junto: nunca acaba por aqui (quem encerra é a sala)
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
      desenharCena(g, vista(false), t, desenharParticulas, cena);
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
        const G = novoGerador(E.semente, E.ger.dif, E.ger.meta);
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
      outros: () => R,
      // o mundo que anda agora (carroças, troncos, vitórias-régias e trens), fileira por fileira
      mundo: () => E.faixas.filter(fx => fx.tipo !== 'g').map(fx => descreverFaixa(fx, E.tempo, n => Math.round(n * 1000) / 1000)),
    },
  };
}

export default {
  id: 'travessia',
  nome: 'Travessia',
  icone: 'estrada',
  sub: 'Pule pelos campos, estradas, rios e trilhos e leve o coelho o mais longe que conseguir.',
  subDesafio: 'Todos atravessam o mesmo mundo: quem chegar mais longe vence.',
  subJunto: {
    versus: 'Todos no mesmo mundo, ao mesmo tempo, cada um por si: quem sobrar vivo vence.',
    coop: 'Todos no mesmo mundo e do mesmo lado: a equipe inteira precisa cruzar a linha de chegada.',
  },
  largura: LARGURA,
  altura: ALTURA,
  cor: '#86c35f',
  controles: { cima: true, baixo: true, pular: null, acao: null, deslizar: true },
  instrucoes: {
    teclado: 'Setas ou WASD: um pulinho para cada lado (Espaço também pula para frente). Não fique parado!',
    toque: 'Toque na tela para pular para frente ou deslize o dedo para os lados e para trás (ou use as setas).',
  },
  // As linhas do "como jogar" cujo nome acompanha o nome da peça (quem troca os sprites pode renomear).
  pecasComoJogar: {
    'Cenoura dourada': 'travessia.cenoura',
    'Gavião': 'travessia.gaviao',
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
