// Super Coelho: as quatro fases (dados compactos montados por um construtor) e a geometria que se mexe
// sozinha (plataformas, barras de fogo, bolhas de lava). O jogo e quem assiste usam os mesmos dados pelo número da fase.

import { sorte as semente } from '../desenho-coelho.js';

export const T = 16; // tamanho de um bloco
export const LINHAS = 18; // a tela tem 32 x 18 blocos
export const TOPO = 16; // linha do chão
export const B = { VAZIO: 0, CHAO: 1, TIJOLO: 2, PERGUNTA: 3, USADO: 4, PEDRA: 5, OCULTO: 6, TRONCO: 7, COPA: 8, LAVA: 9, PONTE: 10, LIRIO: 11 };
export const SOLIDO = [false, true, true, true, true, true, false, true, true, false, true, false];

// Letras do construtor: bloco e o que tem dentro.
const LETRAS = {
  B: [B.TIJOLO], '?': [B.PERGUNTA, 'moeda'], P: [B.PERGUNTA, 'poder'], E: [B.TIJOLO, 'estrela'],
  M: [B.TIJOLO, 'moedas'], V: [B.OCULTO, 'vida'], U: [B.USADO], S: [B.PEDRA], o: [B.LIRIO], G: [B.CHAO],
};

export const FASES = [
  {
    nome: 'Campos de Lyendell', tema: 'campo', largura: 212,
    inicio: { c: 3, r: 16 }, meio: { c: 92, r: 16 }, mastro: 196, castelo: 200,
    construir(b) {
      b.chao(0, 68); b.chao(71, 85); b.chao(89, 152); b.chao(155, 211);
      b.fila(16, 12, '?');
      b.fila(20, 12, 'BPB?B'); b.fila(22, 8, '?');
      b.ini('r', 22);
      b.tronco(28, 2);
      b.tronco(38, 3); b.ini('r', 42);
      b.tronco(46, 4); b.moedas(50, 9, 4); b.ini('r', 51); b.ini('r', 53);
      b.tronco(57, 4);
      b.fila(64, 11, 'V');
      b.arco(67, 12, 6);
      b.fila(77, 12, 'BPB');
      b.fila(80, 8, 'BBBBBBBB'); b.ini('r', 81, 8); b.ini('r', 84, 8); b.moedas(81, 5, 5);
      b.fila(91, 8, 'BBB?'); b.fila(94, 12, 'M');
      b.ini('r', 97); b.ini('r', 99);
      b.fila(100, 12, 'BE');
      b.fila(106, 12, '?'); b.fila(109, 12, '?'); b.fila(109, 8, 'P'); b.fila(112, 12, '?');
      b.ini('t', 107);
      b.ini('r', 114); b.ini('r', 116);
      b.fila(118, 12, 'B'); b.fila(121, 8, 'BBB');
      b.ini('r', 124); b.ini('r', 126);
      b.fila(128, 8, 'B??B'); b.fila(129, 12, 'BB');
      b.ini('r', 131);
      b.escada(134, 4, 1); b.escada(140, 4, -1);
      b.escada(148, 4, 1); b.ret(152, 12, 152, 15, B.PEDRA);
      b.escada(155, 4, -1);
      b.tronco(163, 2);
      b.fila(168, 12, 'BB?B'); b.ini('r', 172); b.ini('r', 174);
      b.tronco(179, 2);
      b.escada(181, 8, 1); b.ret(189, 8, 189, 15, B.PEDRA);
      b.fila(196, 15, 'S');
    },
  },
  {
    nome: 'Tocas Subterrâneas', tema: 'caverna', largura: 212,
    inicio: { c: 2, r: 16 }, meio: { c: 100, r: 16 }, mastro: 196, castelo: 200,
    construir(b) {
      b.chao(0, 79); b.chao(83, 118); b.chao(122, 140); b.chao(145, 211);
      b.teto(6, 189);
      b.fila(10, 12, '?P???');
      b.ini('r', 15); b.ini('r', 17);
      b.ret(22, 15, 22, 15, B.TIJOLO); b.ret(24, 14, 24, 15, B.TIJOLO); b.ret(26, 13, 26, 15, B.TIJOLO);
      b.ret(28, 12, 28, 15, B.TIJOLO); b.ret(30, 12, 30, 15, B.TIJOLO);
      b.moedas(23, 8, 7);
      b.ini('m', 34, 3);
      b.fila(38, 8, 'BBBBBBMBBBBBBBB'); b.moedas(40, 10, 11);
      b.ini('t', 48); b.ini('r', 55); b.ini('r', 57);
      b.ini('m', 60, 3);
      b.tronco(64, 3); b.ini('o', 68); b.tronco(72, 4);
      b.arco(79, 12, 5);
      b.ini('m', 88, 3);
      b.fila(90, 12, 'BBBB'); b.fila(95, 9, 'BEB'); b.moedas(95, 7, 3); b.fila(100, 12, 'BBBB');
      b.ini('r', 96); b.ini('r', 98); b.ini('r', 104);
      b.ret(106, 3, 118, 8, B.CHAO); b.fila(106, 9, 'BBBBBBMBBBBBB'); b.ini('t', 112);
      b.ini('m', 125, 3); b.ini('m', 131, 3);
      b.fila(126, 12, '?B?B?'); b.fila(128, 8, 'P');
      b.escada(134, 3, 1); b.ret(137, 13, 140, 15, B.PEDRA);
      b.fila(150, 12, 'B?B'); b.ini('o', 150); b.ini('r', 156); b.ini('r', 158);
      b.tronco(162, 2); b.ini('o', 166); b.tronco(169, 3); b.tronco(175, 4);
      b.ini('m', 178, 3);
      b.escada(181, 8, 1); b.ret(189, 8, 189, 15, B.PEDRA);
      b.fila(196, 15, 'S');
    },
  },
  {
    nome: 'Copas das Árvores', tema: 'copas', largura: 212,
    inicio: { c: 2, r: 16 }, meio: { c: 126, r: 12 }, mastro: 196, castelo: 200,
    construir(b) {
      b.chao(0, 14);
      b.copa(17, 13, 4);
      b.copa(23, 10, 5); b.moedas(24, 7, 3);
      b.copa(30, 12, 6); b.ini('r', 33, 12);
      b.copa(39, 8, 4); b.fila(40, 4, '?');
      b.plat('v', 45, 11, 3, 3, 1.4, 0);
      b.copa(51, 11, 7); b.ini('t', 55, 11);
      b.copa(61, 14, 3); b.moedas(61, 11, 3);
      b.copa(66, 10, 5); b.arco(66, 7, 5);
      b.plat('h', 73, 10, 3, 3, 1.2, 0);
      b.copa(82, 12, 8); b.ini('o', 87, 12); b.fila(84, 8, 'P');
      b.copa(93, 8, 4);
      b.copa(99, 13, 6); b.ini('r', 101, 13); b.ini('r', 103, 13);
      b.plat('v', 107, 10, 3, 3, 1.6, 1.5);
      b.copa(112, 10, 5);
      b.copa(119, 7, 4); b.moedas(119, 4, 4);
      b.copa(125, 12, 10); b.ini('t', 129, 12); b.ini('r', 132, 12); b.fila(127, 8, '?E?');
      b.plat('h', 139, 9, 3, 4, 1.0, 0);
      b.copa(148, 11, 4);
      b.plat('v', 154, 10, 3, 3, 1.3, 0.7);
      b.copa(158, 9, 6); b.ini('o', 161, 9);
      b.copa(167, 13, 5); b.moedas(167, 10, 5);
      b.plat('h', 174, 12, 3, 2, 1.5, 0);
      b.chao(180, 211);
      b.escada(184, 5, 1); b.ret(189, 11, 189, 15, B.PEDRA);
      b.fila(196, 15, 'S');
    },
  },
  {
    nome: 'Castelo do Raposo', tema: 'castelo', largura: 212,
    inicio: { c: 2, r: 10 }, meio: { c: 106, r: 15 },
    ponte: { c0: 182, c1: 197, r: 12 }, chefe: { c: 192, r: 12 }, alavanca: { c: 198, r: 12 }, princesa: { c: 206, r: 12 },
    construir(b) {
      b.teto(0, 211, 2);
      b.chao(0, 14, 10); b.ret(0, 3, 10, 4, B.CHAO);
      b.chao(18, 30, 12); b.barra(24, 8, 6, 2.2, 0);
      b.chao(35, 50, 14); b.fila(38, 10, 'P'); b.ini('r', 44, 14); b.barra(47, 10, 5, -2.4, 1);
      b.chao(52, 53, 12);
      b.chao(55, 75); b.ret(56, 3, 74, 6, B.CHAO); b.ini('o', 60); b.ini('o', 66); b.fila(62, 12, '???'); b.barra(71, 12, 5, 2.4, 0);
      b.bolha(78, 3.2, 0);
      b.chao(81, 100, 13); b.ini('t', 90, 13); b.barra(95, 9, 6, -2.0, 2);
      b.bolha(102, 2.8, 1.2);
      b.chao(105, 120, 15); b.fila(108, 11, '??P??'); b.ini('r', 112, 15); b.ini('r', 115, 15);
      b.chao(123, 123, 13);
      b.chao(126, 145, 12); b.ret(127, 3, 144, 4, B.CHAO); b.barra(131, 8, 7, 1.8, 0); b.ini('o', 138, 12);
      b.bolha(148, 3.0, 0.6);
      b.chao(151, 165, 14); b.fila(156, 10, '?P?'); b.ini('r', 160, 14); b.ini('r', 162, 14);
      b.chao(170, 181, 12); b.ret(170, 3, 211, 4, B.CHAO);
      b.ret(182, 12, 197, 12, B.PONTE);
      b.chao(198, 211, 12);
    },
  },
];

/* ─── O construtor ─── */

function montar(def, indice) {
  const L = def.largura;
  const mapa = new Uint8Array(L * LINHAS);
  const n = { def, largura: L, mapa, conteudo: {}, inimigos: [], troncos: [], copas: [], plataformas: [], barras: [], bolhas: [], deco: [] };
  const por = (c, r, v) => { if (c >= 0 && c < L && r >= 0 && r < LINHAS) mapa[r * L + c] = v; };
  const ret = (c0, r0, c1, r1, v) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) por(c, r, v); };
  const b = {
    ret,
    chao: (c0, c1, topo = TOPO) => ret(c0, topo, c1, LINHAS - 1, B.CHAO),
    teto: (c0, c1, fundo = 2) => ret(c0, 0, c1, fundo, B.CHAO),
    fila(c, r, s) {
      [...s].forEach((ch, i) => {
        const d = LETRAS[ch];
        if (!d) return;
        por(c + i, r, d[0]);
        if (d[1] && d[1] !== 'moeda') n.conteudo[r * L + c + i] = d[1];
      });
    },
    moedas: (c, r, qtd) => { for (let i = 0; i < qtd; i++) por(c + i, r, B.LIRIO); },
    arco(c, r, qtd) {
      for (let i = 0; i < qtd; i++) { const k = (i / (qtd - 1)) * 2 - 1; por(c + i, r - Math.round((1 - k * k) * 2), B.LIRIO); }
    },
    tronco(c, alt, base = TOPO) { ret(c, base - alt, c + 1, base - 1, B.TRONCO); n.troncos.push({ c, topo: base - alt, base }); },
    escada(c, alt, sentido = 1, base = TOPO) {
      for (let i = 0; i < alt; i++) { const h = sentido > 0 ? i + 1 : alt - i; ret(c + i, base - h, c + i, base - 1, B.PEDRA); }
    },
    copa(c, r, len) { ret(c, r, c + len - 1, r, B.COPA); n.copas.push({ c, r, len }); },
    ini: (tipo, c, r = TOPO) => n.inimigos.push({ tipo, c, r }),
    plat: (tipo, c, r, len, amp, vel, fase = 0) => n.plataformas.push({ tipo, x: c * T, y: r * T, w: len * T, amp: amp * T, vel, fase }),
    barra(c, r, qtd, vel, a0 = 0) { por(c, r, B.USADO); n.barras.push({ cx: c * T + 8, cy: r * T + 8, qtd, vel, a0 }); },
    bolha: (c, periodo, fase) => n.bolhas.push({ x: c * T + 2, periodo, fase, topo: 7 * T }),
  };
  def.construir(b);
  if (def.tema === 'castelo') for (let c = 0; c < L; c++) for (let r = 16; r < LINHAS; r++) if (!mapa[r * L + c]) mapa[r * L + c] = B.LAVA;
  enfeitar(n, semente(4242 + indice * 977));
  return n;
}

// Enfeites que não colidem (arbustos, flores, cristais, tochas...), sempre os mesmos para a mesma fase.
function enfeitar(n, rnd) {
  const { mapa, largura: L, def } = n;
  const cod = (c, r) => (c < 0 || c >= L || r < 0 || r >= LINHAS ? 0 : mapa[r * L + c]);
  const livre = (c, r) => cod(c, r) === B.VAZIO;
  const superficie = c => { for (let r = 3; r < LINHAS; r++) if (cod(c, r) && cod(c, r) !== B.LIRIO) return livre(c, r - 1) ? r : -1; return -1; };
  const fim = def.mastro ? def.mastro - 2 : L;
  for (let c = 1; c < L - 1; c++) {
    const r = superficie(c);
    const x = c * T + 8;
    const sorteio = rnd();
    if (def.tema === 'campo' || (def.tema === 'copas' && cod(c, r) === B.CHAO)) {
      if (r !== TOPO || cod(c, r) !== B.CHAO || c > fim) continue;
      if (sorteio < 0.05 && superficie(c + 1) === r && superficie(c + 2) === r) { n.deco.push({ tp: 'arvore', x: x + 8, y: r * T, tam: 22 + rnd() * 12 }); c += 3; }
      else if (sorteio < 0.12) { const tam = 1 + Math.floor(rnd() * 3); n.deco.push({ tp: 'arbusto', x, y: r * T, tam }); c += tam; }
      else if (sorteio < 0.2) n.deco.push({ tp: 'flores', x, y: r * T, cor: Math.floor(rnd() * 4) });
      else if (sorteio < 0.3) n.deco.push({ tp: 'capim', x, y: r * T });
      else if (sorteio < 0.33 && superficie(c + 2) === r) { n.deco.push({ tp: 'cerca', x, y: r * T }); c += 3; }
    } else if (def.tema === 'copas') {
      if (r > 0 && cod(c, r) === B.COPA && sorteio < 0.25) n.deco.push({ tp: 'flores', x, y: r * T + 1, cor: Math.floor(rnd() * 4) });
    } else if (def.tema === 'caverna') {
      if (r > 0 && c < fim && cod(c, r) === B.CHAO) {
        if (sorteio < 0.06) n.deco.push({ tp: 'cristal', x, y: r * T, cor: Math.floor(rnd() * 3) });
        else if (sorteio < 0.13) n.deco.push({ tp: 'cogumelo', x, y: r * T });
      }
      let fundo = -1;
      for (let rr = 0; rr < 10 && cod(c, rr) === B.CHAO; rr++) fundo = rr;
      if (fundo >= 0 && livre(c, fundo + 1) && rnd() < 0.3) n.deco.push({ tp: 'estalactite', x, y: (fundo + 1) * T, tam: 6 + rnd() * 12 });
    } else if (def.tema === 'castelo') {
      let fundo = -1;
      for (let rr = 0; rr < 10 && cod(c, rr) === B.CHAO; rr++) fundo = rr;
      if (c % 13 === 6 && livre(c, 8) && livre(c, 9)) n.deco.push({ tp: 'tocha', x, y: 8 * T + 4 });
      else if (c % 29 === 17 && fundo >= 0 && livre(c, fundo + 1) && livre(c, fundo + 4)) n.deco.push({ tp: 'estandarte', x, y: (fundo + 1) * T });
      else if (fundo >= 0 && livre(c, fundo + 1) && rnd() < 0.08) n.deco.push({ tp: 'corrente', x, y: (fundo + 1) * T, tam: 20 + rnd() * 30 });
    }
  }
  if (def.tema === 'copas') {
    for (const cp of n.copas) if (cp.len >= 4) n.deco.push({ tp: 'cipo', x: (cp.c + 0.7 + rnd() * (cp.len - 1.4)) * T, y: cp.r * T + 13, tam: 18 + rnd() * 40 });
  }
}

const cacheNiveis = [];
export function nivelBase(i) {
  return (cacheNiveis[i] ??= montar(FASES[i], i));
}

/* ─── O que se mexe sozinho (depende só do tempo da fase) ─── */

export function posPlataforma(p, tf) {
  const s = Math.sin(tf * p.vel + p.fase) * p.amp;
  return p.tipo === 'v' ? { x: p.x, y: p.y + s, w: p.w } : { x: p.x + s, y: p.y, w: p.w };
}

export function bolasDaBarra(br, tf) {
  const a = br.a0 + br.vel * tf;
  const lista = [];
  for (let k = 0; k < br.qtd; k++) lista.push({ x: br.cx + Math.cos(a) * k * 8, y: br.cy + Math.sin(a) * k * 8 });
  return lista;
}

// Bolha de lava: pula da lava e volta (null quando está escondida).
export function posBolha(bo, tf) {
  const dur = 1.7;
  const u = (tf + bo.fase) % bo.periodo;
  if (u > dur) return null;
  const s = u / dur;
  return { x: bo.x, y: 292 - 4 * s * (1 - s) * (292 - bo.topo), sobe: s < 0.5 };
}
