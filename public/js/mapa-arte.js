// A arte do mapa de Lyendell: uma carta cartográfica antiga, desenhada à mão.
// Aqui ficam só os desenhos (SVG em texto): as ilustrações dos prédios, as casinhas, as árvores, o rio, a
// moldura, o cartucho, a rosa dos ventos e a chave do mapa. Nada daqui mexe na página: quem monta a tela é mapa.js.
// Não usa filtros do SVG (arrastar e dar zoom ficam leves): o "tremido de tinta" é feito no próprio traçado,
// com um ruído suave que depende só da posição (assim todas as camadas de uma rua tremem juntas).

import { VISTA, CIDADE, RIO, AVENIDAS, RUAS, TORRES, PORTAO } from './mapa-lyendell.js';
import { amostrar, dentro, linhasDaVia } from './mapa-casas.js';
import { desenhoDoIcone } from './icones-mapa.js';

const [VX, VY, VW, VH] = VISTA;
const um = n => Math.round(n * 10) / 10;

/* ─── Cores da carta ──────────────────────────────── */

export const COR = {
  papel: '#e6d4a6', papel2: '#efe1ba', chao: '#d9c592', tinta: '#3a2713', tinta2: '#5a3f22', via: '#f3e7c2',
  agua: '#a7bdb3', aguaTinta: '#4d6b68', vermelho: '#a63a2b', ouro: '#d6a93c', verde: '#869659',
};

/* ─── Números "aleatórios" que não mudam ──────────── */

export function semente(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tremido suave que só depende do ponto: o mesmo ponto treme igual em todas as camadas.
function tremor(x, y, amp) {
  return [
    amp * (Math.sin(x * 0.131 + y * 0.071) + Math.sin(x * 0.047 - y * 0.113 + 1.3)) * 0.5,
    amp * (Math.sin(x * 0.083 - y * 0.127 + 2.1) + Math.sin(x * 0.117 + y * 0.059 + 0.4)) * 0.5,
  ];
}

/* ─── Geometria desenhada à mão ───────────────────── */

// Linha com cantos arredondados, repartida em pedacinhos e com tremido de tinta.
export function traco(pontos, { raio = 9, passo = 9, amp = 0.8, fechado = false } = {}) {
  const base = [];
  const n = pontos.length;
  const pts = fechado ? pontos : pontos;
  const total = fechado ? n : n;
  const quina = i => {
    const a = pts[(i - 1 + total) % total];
    const b = pts[i];
    const c = pts[(i + 1) % total];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(raio, l1 / 2, l2 / 2);
    const p1 = [b[0] - ((b[0] - a[0]) / l1) * r, b[1] - ((b[1] - a[1]) / l1) * r];
    const p2 = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
    const arco = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      arco.push([(1 - t) ** 2 * p1[0] + 2 * t * (1 - t) * b[0] + t * t * p2[0], (1 - t) ** 2 * p1[1] + 2 * t * (1 - t) * b[1] + t * t * p2[1]]);
    }
    return arco;
  };
  const cantos = [];
  for (let i = 0; i < total; i++) {
    if (!fechado && (i === 0 || i === total - 1)) cantos.push([pts[i]]);
    else cantos.push(raio > 0 ? quina(i) : [pts[i]]);
  }
  for (const c of cantos) base.push(...c);
  if (fechado) base.push(base[0]);
  // Pedaços de no máximo "passo" de comprimento.
  const fino = [base[0]];
  for (let i = 1; i < base.length; i++) {
    const [a, b] = [base[i - 1], base[i]];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
    for (let j = 1; j <= k; j++) fino.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return fino.map(([x, y], i) => {
    const [dx, dy] = tremor(x, y, amp);
    return `${i ? 'L' : 'M'}${um(x + dx)} ${um(y + dy)}`;
  }).join('') + (fechado ? 'Z' : '');
}

// Curva suave que passa pelos pontos (para o rio), já em muitos pontinhos.
function curvaDensa(p, passo = 5) {
  const n = p.length;
  const pt = i => p[Math.max(0, Math.min(n - 1, i))];
  const saida = [p[0]];
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, e] = [pt(i - 1), pt(i), pt(i + 1), pt(i + 2)];
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    const k = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / passo));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const u = 1 - t;
      saida.push([u * u * u * b[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * c[0],
        u * u * u * b[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * c[1]]);
    }
  }
  return saida;
}

const poli = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${um(x)} ${um(y)}`).join('');
// A mesma linha, deslocada para o lado (distância "d", negativa para o outro lado).
function paralela(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * d, p[1] + ((b[0] - a[0]) / l) * d];
  });
}
// Risquinhos de gravura saindo da margem, para fora, a cada "cada" pontos.
function riscos(pts, d, comp, cada = 2) {
  let s = '';
  for (let i = 1; i < pts.length - 1; i += cada) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    const k = i % 4 === 1 ? 1 : 0.62;
    s += `M${um(pts[i][0] + nx * d)} ${um(pts[i][1] + ny * d)}l${um(nx * comp * k)} ${um(ny * comp * k)}`;
  }
  return s;
}

/* ─── Estilo (vai dentro do SVG, para a imagem baixada sair igual) ─ */

export const ESTILO_CARTA = `
.m-svg text { font-family: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif; }
.i { stroke: ${COR.tinta}; stroke-width: 0.9; stroke-linejoin: round; stroke-linecap: round; }
.n { stroke: none; }
.f { fill: none; }
.pd { fill: #dccb9f; } .ps { fill: #b8a47a; } .pc { fill: #efe3c0; }
.tv { fill: #a8523a; } .tvs { fill: #85402d; }
.ta { fill: #6f9490; } .tas { fill: #557673; }
.to { fill: #cf9a4b; } .tos { fill: #a97a32; }
.cz { fill: #a69f8d; } .czs { fill: #847d6c; }
.md { fill: #a8804f; } .mds { fill: #7d5b35; }
.br { fill: #f1e7c8; } .brs { fill: #d3c49a; }
.ou { fill: ${COR.ouro}; } .vm { fill: ${COR.vermelho}; } .az { fill: #41708f; }
.vd { fill: #869659; } .vds { fill: #65773f; } .ag { fill: ${COR.agua}; } .pt { fill: #43301d; }
.fo { fill: var(--fo, #869659); } .fos { fill: var(--fos, #65773f); }
.t2 { --fo: #7a8d55; --fos: #5a6d3d; } .t3 { --fo: #93a063; --fos: #6f7e47; } .t4 { --fo: #b59a52; --fos: #8e7632; }
.ht { fill: url(#m-hach); stroke: none; pointer-events: none; }
.sb { fill: ${COR.tinta}; opacity: 0.2; stroke: none; }
.gl { fill: none; stroke: ${COR.tinta}; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
.glc { fill: none; stroke: #f6ecca; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }

.vo { fill: none; stroke: ${COR.tinta}; stroke-linecap: round; stroke-linejoin: round; }
.vo.m-avenida { stroke-width: 22; } .vo.m-rua { stroke-width: 15; }
.vf, .vi, .vj { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.vf.m-avenida { stroke: ${COR.via}; stroke-width: 19.8; } .vf.m-rua { stroke: ${COR.via}; stroke-width: 13.4; }
.vi { stroke: ${COR.tinta}; stroke-width: 15.8; stroke-opacity: 0.85; } .vj { stroke: ${COR.via}; stroke-width: 14.6; }
.vc { fill: none; stroke: #b08a45; stroke-linecap: round; stroke-opacity: 0.8; pointer-events: none; }
.vc.m-avenida { stroke-width: 1.5; stroke-dasharray: 0.1 6.2; } .vc.m-rua { stroke-width: 1.2; stroke-dasharray: 0.1 6; }
.m-toque { fill: none; stroke: transparent; stroke-width: 20; stroke-linecap: round; stroke-linejoin: round; pointer-events: stroke; cursor: pointer; }
.vo.ativa { stroke: #7a2a1a; } .vo.m-avenida.ativa { stroke-width: 25; } .vo.m-rua.ativa { stroke-width: 18; }
.vf.ativa, .vj.ativa { stroke: #f6dc8c; }
.m-rotulo-via { font-family: 'EB Garamond', 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 10px; font-weight: 500; letter-spacing: 0.3px; fill: ${COR.tinta}; stroke: ${COR.via}; stroke-width: 2.4px; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.m-rotulo-via.m-avenida { font-family: 'Cinzel', serif; font-style: normal; font-size: 9px; font-weight: 700; letter-spacing: 1.1px; }

.m-poi { cursor: pointer; outline: none; }
.m-hit { fill: transparent; stroke: none; }
.m-aro { fill: none; stroke: ${COR.vermelho}; stroke-width: 1.6; stroke-dasharray: 3 2.4; opacity: 0; }
.m-poi:hover .m-aro, .m-poi.ativa .m-aro, .m-poi:focus-visible .m-aro { opacity: 1; }
.m-poi .m-art { transition: none; }
.m-fita { fill: #f4e7c0; stroke: ${COR.tinta}; stroke-width: 0.9; stroke-linejoin: round; }
.m-fita-cauda { fill: #cdb98a; stroke: ${COR.tinta}; stroke-width: 0.9; stroke-linejoin: round; }
.m-cat-comercio .m-fita { fill: #e2e6c4; } .m-cat-outro .m-fita { fill: #ecd9b0; }
.m-poi:hover .m-fita, .m-poi.ativa .m-fita { fill: #f7de8e; }
.m-nome { font-size: 9.4px; font-weight: 700; letter-spacing: 0.9px; fill: #2c1c0b; text-anchor: middle; pointer-events: none; }
.m-nome.m-grande { font-size: 10.8px; letter-spacing: 1.2px; }
.m-nome.m-solto { font-size: 7.6px; letter-spacing: 0.5px; stroke: ${COR.papel2}; stroke-width: 2.6px; paint-order: stroke; stroke-linejoin: round; }
.m-sub { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 8.4px; fill: #3a2713; stroke: ${COR.papel2}; stroke-width: 2.6px; paint-order: stroke; stroke-linejoin: round; text-anchor: middle; pointer-events: none; }
.m-medalha { fill: ${COR.vermelho}; stroke: ${COR.tinta}; stroke-width: 0.9; } .m-medalha-estrela { fill: #f4e2a2; stroke: none; }

.m-casa { cursor: pointer; outline: none; }
.m-casa text { font-size: 5.3px; font-weight: 700; text-anchor: middle; fill: #2c1c0b; pointer-events: none; }
.m-casa .gl { stroke-width: 2.6; pointer-events: none; }
.m-casa .m-aro { stroke-width: 1.3; }
.m-casa:hover .m-aro, .m-casa.ativa .m-aro, .m-casa:focus-visible .m-aro { opacity: 1; }
.m-editando .m-casa, .m-editando .m-poi { cursor: grab; }
.m-casa.m-arrastada, .m-poi.m-arrastada { opacity: 0.85; cursor: grabbing; }

.m-titulo { font-family: 'Cinzel Decorative', 'Cinzel', serif; font-size: 25px; font-weight: 700; letter-spacing: 1.4px; fill: ${COR.tinta}; text-anchor: middle; }
.m-subtitulo { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 13px; fill: #4a321a; text-anchor: middle; }
.m-faixa-texto { font-size: 8.4px; font-weight: 700; letter-spacing: 2.2px; fill: #f7ecca; text-anchor: middle; }
.m-chave-titulo { font-size: 9.2px; font-weight: 700; letter-spacing: 2.6px; fill: ${COR.tinta}; text-anchor: middle; }
.m-chave-texto { font-family: 'EB Garamond', Georgia, serif; font-size: 10px; font-weight: 500; fill: #2c1c0b; }
.m-rosa-letra { font-size: 12px; font-weight: 700; fill: ${COR.tinta}; text-anchor: middle; }
.m-escala-texto { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 9px; fill: #3a2713; text-anchor: middle; }
`;

/* ─── Pequenos ajudantes de desenho ───────────────── */

const P = (c, d, x = '') => `<path class="i ${c}" d="${d}"${x}/>`;
const PN = (c, d) => `<path class="n ${c}" d="${d}"/>`;
const E = (c, cx, cy, rx, ry) => `<ellipse class="i ${c}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const C = (c, cx, cy, r) => `<circle class="i ${c}" cx="${cx}" cy="${cy}" r="${r}"/>`;
const HT = d => `<path class="ht" d="${d}"/>`;
const gl = (id, x, y, tam, c = 'gl') => `<g class="${c}" transform="translate(${um(x - tam / 2)} ${um(y - tam / 2)}) scale(${(tam / 24).toFixed(3)})">${desenhoDoIcone(id)}</g>`;
const sombra = (rx = 30, cx = 3) => `<ellipse class="sb" cx="${cx}" cy="22" rx="${rx}" ry="4.6"/>`;

// Ameias: um muro com o topo recortado.
function muro(x0, x1, yt, yb, n, mh, c = 'pd') {
  const w = (x1 - x0) / (2 * n + 1);
  let d = `M${x0} ${yb}V${yt - mh}`;
  for (let i = 0; i <= 2 * n; i++) {
    d += `h${um(w)}`;
    if (i < 2 * n) d += `v${i % 2 ? -mh : mh}`;
  }
  return P(c, `${d}V${yb}Z`);
}
// Uma caixa vista de cima e de lado (a face da direita fica na sombra).
function caixa(x0, x1, yt, yb, dx, dy, cf = 'pd', cs = 'ps') {
  const lado = `M${x1} ${yt}L${x1 + dx} ${yt - dy}V${yb - dy}L${x1} ${yb}Z`;
  return P(cs, lado) + HT(lado) + P(cf, `M${x0} ${yt}H${x1}V${yb}H${x0}Z`);
}
// Casa de telhado de duas águas, com a empena virada para quem olha.
function casaTelhado({ x0, x1, yt, yb, alt, dx = 8, dy = 4.5, parede = 'br', lado = 'brs', rl = 'tv', rr = 'tvs' }) {
  const xm = (x0 + x1) / 2;
  const ya = yt - alt;
  const sl = `M${x1} ${yt}L${x1 + dx} ${yt - dy}V${yb - dy}L${x1} ${yb}Z`;
  return P(lado, sl) + HT(sl)
    + P(rl, `M${x0} ${yt}L${xm} ${ya}L${xm + dx} ${ya - dy}L${x0 + dx} ${yt - dy}Z`)
    + P(rr, `M${xm} ${ya}L${x1} ${yt}L${x1 + dx} ${yt - dy}L${xm + dx} ${ya - dy}Z`) + HT(`M${xm} ${ya}L${x1} ${yt}L${x1 + dx} ${yt - dy}L${xm + dx} ${ya - dy}Z`)
    + P(parede, `M${x0} ${yb}V${yt}L${xm} ${ya}L${x1} ${yt}V${yb}Z`);
}
const porta = (x, y, w, h) => P('pt', `M${x - w / 2} ${y}V${y - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y}Z`);
const janela = (x, y, w = 3.4, h = 4.6) => P('pt', `M${x - w / 2} ${y}V${y - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y}Z`);
const chamine = (x, y, w = 4, h = 8, c = 'pd') => P(c, `M${x} ${y}V${y - h}h${w}V${y}Z`) + P('pc', `M${x - 0.8} ${y - h}h${w + 1.6}v-1.6h${-(w + 1.6)}Z`);
const fumaca = (x, y) => `<path class="i f" d="M${x} ${y}q-3 -3 0 -6t0 -6" stroke-opacity="0.45" stroke-dasharray="1.6 2"/>`;
const placa = (x, y, id, c = 'br') => P('f', `M${x} ${y - 7}V${y}`) + P(c, `M${x - 5} ${y}h10v9h-10Z`) + gl(id, x, y + 4.5, 7.4);
const estrela7 = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 7;
    const rr = i % 2 ? r * 0.46 : r;
    d += `${i ? 'L' : 'M'}${um(cx + rr * Math.cos(a))} ${um(cy + rr * Math.sin(a))}`;
  }
  return `${d}Z`;
};
const bandeira = (x, y, c = 'vm', larg = 9) => P('f', `M${x} ${y}V${y - 9}`) + P(c, `M${x} ${y - 9}q${larg * 0.3} 2 ${larg * 0.55} 0t${larg * 0.45} 0V${y - 4}q${-larg * 0.45} 2 ${-larg * 0.45} 0t${-larg * 0.55} 0Z`);
const barra = (x0, x1, y, h, n) => { let d = ''; for (let i = 0; i < n; i++) d += `M${um(x0 + ((x1 - x0) * (i + 0.5)) / n)} ${y}v${h}`; return `<path class="i f" d="${d}" stroke-width="0.7"/>`; };

/* ─── Os prédios: pequenas gravuras (cabem numa caixa de 64 x 64, origem no meio) ─ */

// Torre redonda do muro e do portão.
const torreMuro = () => `<ellipse class="sb" cx="2" cy="6" rx="10" ry="3"/>`
  + P('pd', 'M-8 -10V4a8 3 0 0 0 16 0V-10Z') + HT('M2 -10V6a8 3 0 0 0 6 -2V-10Z')
  + `<ellipse class="i pc" cx="0" cy="-10" rx="8" ry="3"/>`
  + P('pt', 'M-1.6 -3a1.6 1.6 0 0 1 3.2 0V2h-3.2Z')
  + P('tv', 'M-9.5 -10Q0 -7 9.5 -10L0 -27Z') + HT('M0 -27L9.5 -10Q4 -8 1.5 -9Z')
  + P('f', 'M0 -27V-33') + P('vm', 'M0 -33l6 1.8-6 1.8Z');

const ARTE = {
  castelo: () => sombra(38)
    + P('ps', 'M26 -2L32 -6V18L26 22Z') + HT('M26 -2L32 -6V18L26 22Z')
    + P('pd', 'M-10 -24H10V4H-10Z') + P('ps', 'M10 -24L16 -28V0L10 4Z') + HT('M10 -24L16 -28V0L10 4Z')
    + P('tv', 'M-12 -24H12L0 -40Z') + HT('M0 -40L12 -24H4Z') + bandeira(0, -40, 'vm', 11)
    + janela(-4, -10) + janela(4, -10) + P('pt', 'M-1.2 -20h2.4v4h-2.4Z')
    + muro(-26, 26, -2, 22, 4, 3.4) + HT('M10 -2H26V22H10Z')
    + porta(0, 22, 11, 14) + P('f', 'M-5 12v10M0 8v14M5 12v10') + P('f', 'M-5.5 15h11M-5.5 19h11')
    + janela(-17, 10, 3, 5) + janela(17, 10, 3, 5)
    + P('pd', 'M-32 -12V22H-20V-12Z') + P('pd', 'M20 -12V22H32V-12Z') + HT('M26 -12H32V22H26Z') + HT('M-26 -12H-20V22H-26Z')
    + P('tv', 'M-34 -12H-18L-26 -30Z') + P('tv', 'M18 -12H34L26 -30Z') + HT('M26 -30L34 -12H30Z') + HT('M-26 -30L-18 -12H-22Z')
    + bandeira(-26, -30, 'az', 8) + bandeira(26, -30, 'az', 8)
    + janela(-26, -2, 2.8, 5) + janela(26, -2, 2.8, 5),

  septo: () => sombra(34)
    + P('pc', 'M-28 18H28V22H-28Z') + P('pc', 'M-24 14H24V18H-24Z')
    + P('br', 'M-22 -2H22V14H-22Z') + P('brs', 'M22 -2L28 -5V11L22 14Z') + HT('M22 -2L28 -5V11L22 14Z')
    + P('pd', 'M-12 -16V-2H12V-16Z') + P('ps', 'M12 -16L16 -18V-4L12 -2Z')
    + P('ta', 'M-14 -16a14 14 0 0 1 28 0Z') + HT('M2 -16a14 14 0 0 0 12 -0Z') + P('f', 'M-8 -16q0 -9 -4 -11M0 -16V-30M8 -16q0 -9 4 -11')
    + P('ou', 'M0 -30V-34') + `<path class="i ou" d="${estrela7(0, -39, 6.5)}"/>`
    + P('pc', 'M-24 -2H24L0 -11Z')
    + `<path class="i ou" d="${estrela7(0, -3.4, 3.6)}"/>`
    + porta(0, 14, 8, 12) + janela(-14, 12, 4, 8) + janela(14, 12, 4, 8)
    + P('pd', 'M-34 -4V22H-26V-4Z') + P('pd', 'M26 -4V22H34V-4Z') + HT('M30 -4H34V22H30Z')
    + P('ta', 'M-36 -4H-24L-30 -20Z') + P('ta', 'M24 -4H36L30 -20Z') + P('ou', 'M-30 -20v-4M30 -20v-4'),

  arena: () => sombra(38)
    + P('pd', 'M-32 4a32 14 0 0 0 64 0V16a32 14 0 0 1 -64 0Z') + HT('M12 17q14 -4 20 -13V16q-9 11 -20 12Z')
    + `<ellipse class="i pc" cx="0" cy="4" rx="32" ry="14"/>`
    + `<ellipse class="i" cx="0" cy="4" rx="24" ry="9.6" fill="#d9bf86"/>`
    + P('ps', 'M-24 4a24 9.6 0 0 1 48 0a24 9.6 0 0 0 -48 0Z')
    + `<path class="i f" d="M-12 6q12 5 24 0M-6 2q6 2.5 12 0" stroke-width="0.6" stroke-opacity="0.6"/>`
    + [-24, -16, -8, 0, 8, 16, 24].map(x => `<path class="i pt" d="M${x - 2.6} ${um(4 + 14 * Math.sqrt(1 - (x / 32) ** 2) + 9)}v-5a2.6 2.6 0 0 1 5.2 0v5Z"/>`).join('')
    + P('f', 'M-32 4a32 14 0 0 0 64 0')
    + P('f', 'M-28 -6V-12M28 -6V-12') + P('vm', 'M-28 -12l7 2-7 2Z') + P('az', 'M28 -12l-7 2 7 2Z'),

  tabelionato: () => sombra(34)
    + P('pc', 'M-26 18H26V22H-26Z')
    + caixa(-22, 20, -4, 18, 8, 4.5, 'br', 'brs')
    + P('to', 'M-25 -4H23L0 -15Z') + P('tos', 'M23 -4L31 -8.5L8 -19.5L0 -15Z') + HT('M23 -4L31 -8.5L8 -19.5L0 -15Z')
    + [-16, -8, 8, 16].map(x => P('pc', `M${x - 2} -2V16h4V-2Z`)).join('') + P('pc', 'M-4 -2V16h8V-2Z')
    + porta(0, 16, 7, 11) + P('pc', 'M-6 -4h12v3h-12Z')
    + P('br', 'M-9.5 -13h19v6h-19Z') + gl('pergaminho', 0, -10, 6.6)
    + P('pd', 'M23 -6H31V18H23Z') + P('ps', 'M31 -6L35 -9V15L31 18Z') + HT('M31 -6L35 -9V15L31 18Z')
    + P('pd', 'M22 -6H33L32 -9H23Z') + C('br', 27, 3, 3.4) + P('f', 'M27 3V1M27 3h1.6')
    + P('tv', 'M22 -9H33L27.5 -24Z') + bandeira(27.5, -24, 'az', 7),

  banco: () => sombra(34)
    + P('pc', 'M-28 18H28V22H-28Z') + P('pc', 'M-26 14H26V18H-26Z')
    + caixa(-22, 22, -2, 14, 8, 4.5, 'pd', 'ps')
    + [-18, -9, 0, 9, 18].map(x => P('br', `M${x - 2.2} -2V14h4.4V-2Z`)).join('')
    + P('pc', 'M-25 -2H25v-3h-50Z') + P('pc', 'M-24 -5H24L0 -17Z') + P('pc', 'M25 -5L33 -9.5L9 -21L0 -17Z') + HT('M25 -5L33 -9.5L9 -21L0 -17Z')
    + `<circle class="i ou" cx="0" cy="-9" r="4"/>` + gl('moeda', 0, -9, 5.6),
  senado: () => sombra(36)
    + P('pc', 'M-30 18H30V22H-30Z') + P('pc', 'M-28 14H28V18H-28Z')
    + P('ta', 'M-9 -12a9 9 0 0 1 18 0Z') + HT('M2 -12a9 9 0 0 0 7 0Z') + P('ou', 'M0 -21v-4')
    + caixa(-24, 24, -2, 14, 8, 4.5, 'br', 'brs')
    + [-20, -13, -6.5, 0, 6.5, 13, 20].map(x => P('pc', `M${x - 1.9} -2V14h3.8V-2Z`)).join('')
    + P('pc', 'M-27 -2H27v-3h-54Z') + P('pc', 'M-26 -5H26L0 -17Z') + P('tos', 'M27 -5L35 -9.5L9 -21L0 -17Z') + HT('M27 -5L35 -9.5L9 -21L0 -17Z')
    + gl('coluna', 0, -8.5, 7),

  quartel: () => sombra(36)
    + caixa(-24, 24, -10, 22, 8, 4.5, 'cz', 'czs')
    + muro(-24, 24, -10, -6, 5, 3.2, 'cz')
    + P('cz', 'M-30 -18H-18V22H-30Z') + P('cz', 'M18 -18H30V22H18Z') + HT('M24 -18H30V22H24Z') + HT('M-24 -18H-18V22H-24Z')
    + muro(-30, -18, -18, -14, 2, 3, 'cz') + muro(18, 30, -18, -14, 2, 3, 'cz')
    + porta(0, 22, 11, 14) + P('f', 'M-5 12v10M0 9v13M5 12v10') + P('f', 'M-5.5 15h11M-5.5 19h11')
    + janela(-24, -2, 2.6, 5) + janela(24, -2, 2.6, 5)
    + P('pc', 'M-9 -2H9V8H-9Z') + P('az', 'M-5.5 0h11v5a5.5 5 0 0 1 -11 0Z') + gl('escudo', 0, 3.4, 7.6, 'glc')
    + P('f', 'M0 -14V-34') + P('vm', 'M0 -34q6 2 12 0t0 7q-6 2 -12 0Z'),
  prisao: () => sombra(30)
    + caixa(-22, 20, -4, 22, 8, 4.5, 'cz', 'czs') + muro(-22, 20, -4, -1, 4, 3.2, 'cz')
    + [-14, 0, 14].map(x => P('pt', `M${x - 3} 8v-8h6v8Z`) + P('f', `M${x - 1} 0v8M${x + 1} 0v8`)).join('')
    + porta(0, 22, 8, 10) + P('f', 'M-4 14h8'),
  hospital: () => sombra(38)
    + caixa(-30, -12, 0, 22, 7, 4, 'br', 'brs') + caixa(12, 30, 0, 22, 7, 4, 'br', 'brs')
    + P('ta', 'M-32 0H-10L-14 -7H-28Z') + P('ta', 'M10 0H32L28 -7H14Z')
    + casaTelhado({ x0: -12, x1: 12, yt: -10, yb: 22, alt: 11, dx: 6, dy: 3.5, parede: 'br', lado: 'brs', rl: 'ta', rr: 'tas' })
    + P('vm', 'M-1.8 -8h3.6v4h4v3.6h-4v4h-3.6v-4h-4v-3.6h4Z') + janela(-21, 14, 4, 7) + janela(21, 14, 4, 7) + janela(-21, 4, 4, 5) + janela(21, 4, 4, 5)
    + porta(0, 22, 9, 12) + P('pc', 'M-6 12h12v1.6h-12Z') + janela(-6, 4, 3, 5) + janela(6, 4, 3, 5),
  biblioteca: () => sombra(36)
    + caixa(-26, 22, -8, 22, 8, 4.5, 'pd', 'ps')
    + P('ta', 'M-28 -8L-21 -17H17L24 -8Z') + P('tas', 'M24 -8L32 -12.5L25 -21.5L17 -17Z') + HT('M24 -8L32 -12.5L25 -21.5L17 -17Z')
    + P('pd', 'M-10 -18H10V-8H-10Z') + P('ta', 'M-12 -18H12L0 -30Z') + HT('M0 -30L12 -18H4Z')
    + [-19, 16].map(x => janela(x, 16, 5, 11) + janela(x, 2, 4.4, 7)).join('') + janela(-10, 16, 5, 11) + janela(10, 16, 5, 11)
    + porta(0, 22, 9, 13) + P('br', 'M-8.5 -15.5h17v7h-17Z') + gl('livro', 0, -12, 7)
    + P('f', 'M0 -30V-36') + P('ou', 'M-2 -36h4l-2 -3Z'),
  teatro: () => sombra(36)
    + caixa(-26, 22, -2, 22, 8, 4.5, 'br', 'brs')
    + P('tv', 'M-28 -2Q0 -26 26 -2Z') + P('tvs', 'M26 -2L34 -6.5Q12 -26 4 -22Z') + HT('M26 -2L34 -6.5Q12 -26 4 -22Z')
    + [-16, -8, 8, 16].map(x => janela(x, 14, 3.6, 8)).join('') + porta(0, 22, 9, 13)
    + P('pc', 'M-24 4H20V6H-24Z') + gl('musica', 0, -8, 8.4) + bandeira(-24, -2, 'vm', 8),
  torre: () => sombra(18)
    + P('pd', 'M-8 -22V22H8V-22Z') + P('ps', 'M8 -22L13 -25V19L8 22Z') + HT('M8 -22L13 -25V19L8 22Z')
    + P('pd', 'M-12 -30H12L8.4 -22H-8.4Z') + muro(-12, 12, -34, -30, 3, 3.4, 'pd')
    + P('pt', 'M-3.2 -16h6.4v8h-6.4Z') + P('pt', 'M-1.6 22V14a1.6 1.6 0 0 1 3.2 0V22Z') + janela(0, 4, 2.6, 5)
    + P('tv', 'M-11 -34H11L0 -52Z') + HT('M0 -52L11 -34H4Z') + bandeira(0, -52, 'vm', 8),
  capela: () => sombra(32)
    + casaTelhado({ x0: -4, x1: 22, yt: 2, yb: 22, alt: 12, parede: 'br', lado: 'brs', rl: 'tv', rr: 'tvs' })
    + porta(9, 22, 7, 11) + janela(15.5, 14, 3, 5.5)
    + P('pd', 'M-26 -16H-6V22H-26Z') + P('ps', 'M-6 -16L-1 -19V19L-6 22Z') + HT('M-6 -16L-1 -19V19L-6 22Z')
    + P('pt', 'M-19 -12a3.5 3.5 0 0 1 7 0V-3h-7Z') + P('ou', 'M-18 -8q2 -3 4 0l1 3h-6Z') + janela(-16, 12, 3.4, 7)
    + P('ta', 'M-28 -16H-4L-16 -40Z') + HT('M-16 -40L-4 -16H-9Z') + P('ou', 'M-16 -40v-5M-18.4 -43h4.8'),
  poco: () => sombra(18)
    + P('pd', 'M-11 10V20a11 4 0 0 0 22 0V10Z') + HT('M3 14q8 -1 8 -4V20a11 4 0 0 1 -8 3.7Z')
    + `<ellipse class="i ps" cx="0" cy="10" rx="11" ry="4"/>` + `<ellipse class="i ag" cx="0" cy="10" rx="8" ry="2.6"/>`
    + P('f', 'M-3 10q1.5 -1 3 0t3 0')
    + P('md', 'M-11 10V-8h2V10Z') + P('md', 'M9 10V-8h2V10Z')
    + P('f', 'M-10 -3H10') + P('tv', 'M-15 -7L0 -18L15 -7Z') + HT('M0 -18L15 -7H6Z')
    + P('f', 'M0 -7V-1') + P('md', 'M-2.4 -1h4.8v3.6h-4.8Z'),
  jardim: () => sombra(32)
    + `<ellipse class="i vd" cx="0" cy="12" rx="29" ry="10"/>` + `<ellipse class="i f" cx="0" cy="12" rx="22" ry="7.4" stroke-dasharray="1.4 1.8"/>`
    + P('f', 'M-26 12H26M0 5V19') + `<ellipse class="i pc" cx="0" cy="12" rx="6.4" ry="2.6"/>`
    + `<circle class="i vm" cx="-17" cy="9" r="1.6"/><circle class="i ou" cx="-12" cy="15" r="1.6"/><circle class="i vm" cx="14" cy="16" r="1.6"/><circle class="i ou" cx="18" cy="10" r="1.6"/>`
    + P('md', 'M-1.8 12L-1.2 -4H1.2L1.8 12Z')
    + `<circle class="i vds" cx="0" cy="-12" r="10"/><circle class="i vd" cx="-5" cy="-10" r="6.8"/><circle class="i vd" cx="5" cy="-14" r="6.2"/><circle class="i vd" cx="1" cy="-17" r="5.4"/>`
    + `<circle class="i vm" cx="-4" cy="-8" r="1.2"/><circle class="i vm" cx="5" cy="-9" r="1.2"/><circle class="i vm" cx="1" cy="-13" r="1.2"/>`,
  mercado: () => sombra(34)
    + P('md', 'M-26 6H18V22H-26Z') + HT('M6 6H18V22H6Z') + P('mds', 'M-26 6H18V10H-26Z')
    + P('f', 'M-25 -2V6M17 -2V6')
    + Array.from({ length: 6 }, (_, i) => P(i % 2 ? 'br' : 'vm', `M${-28 + i * 8.4} -4h8.4l1 10h-8.4Z`)).join('')
    + Array.from({ length: 6 }, (_, i) => `<path class="i ${i % 2 ? 'br' : 'vm'}" d="M${-27 + i * 8.4} 6a4.2 3 0 0 0 8.4 0Z"/>`).join('')
    + `<circle class="i vm" cx="-18" cy="13" r="2.4"/><circle class="i ou" cx="-12" cy="13.4" r="2.4"/><circle class="i vd" cx="-6" cy="13" r="2.4"/><circle class="i vm" cx="0" cy="13.4" r="2.4"/><circle class="i ou" cx="6" cy="13" r="2.4"/>`
    + P('md', 'M20 12H30V22H20Z') + P('mds', 'M30 12L33 10V20L30 22Z') + P('f', 'M20 17H30'),
  porto: () => sombra(36)
    + `<ellipse class="i ag" cx="2" cy="16" rx="34" ry="9"/>` + P('f', 'M-20 18q2 -1 4 0t4 0M10 20q2 -1 4 0t4 0')
    + P('md', 'M-34 8H4V13H-34Z') + P('f', 'M-30 8v5M-24 8v5M-18 8v5M-12 8v5M-6 8v5M0 8v5') + P('mds', 'M4 8L9 5V10L4 13Z')
    + P('mds', 'M-32 13v7M-12 13v7M2 13v7')
    + P('mds', 'M6 14Q8 22 22 22Q30 21 33 14Z') + P('f', 'M20 14V-8') + P('br', 'M20 -8L31 10H20Z') + P('brs', 'M19 -4L9 10H19Z') + P('vm', 'M20 -8l5 1.6-5 1.6Z')
    + P('md', 'M-30 -2H-18V8H-30Z') + P('tv', 'M-32 -2L-24 -10L-16 -2Z') + P('f', 'M-8 8V-6') + P('md', 'M-8 -6H0') + P('f', 'M0 -6V0'),
  bandeira: () => sombra(18)
    + P('pd', 'M-12 22V12H12V22Z') + P('pc', 'M-9 12V8H9V12Z') + P('md', 'M-1.4 8V-34H1.4V8Z')
    + `<circle class="i ou" cx="0" cy="-35" r="2.6"/>`
    + P('vm', 'M1.4 -32q10 -4 18 0t14 -1V-14q-7 3 -14 0t-18 3Z') + HT('M21 -32q7 1 12.4 -1V-14q-6 2.4 -12.4 0Z')
    + P('f', 'M8 -29q6 -1 12 0M8 -17q6 -1 12 0') + `<path class="i ou" d="${estrela7(14, -22.5, 4.4)}"/>`,
  solar: () => sombra(36)
    + casaTelhado({ x0: -24, x1: 18, yt: -2, yb: 22, alt: 12, dx: 8, dy: 4.5, parede: 'br', lado: 'brs', rl: 'tv', rr: 'tvs' })
    + P('pd', 'M-30 -14H-16V22H-30Z') + P('tv', 'M-32 -14H-14L-23 -30Z') + HT('M-23 -30L-14 -14H-18Z')
    + janela(-23, 6, 3.4, 6) + janela(-9, 12, 3.6, 7) + janela(10, 12, 3.6, 7) + porta(0, 22, 8, 12)
    + `<path class="i ou" d="M-6 -6l2 -5 4 3 4 -3 2 5Z"/>` + chamine(8, -9, 4, 9) + fumaca(10, -19),
  marco: icone => sombra(22)
    + P('pc', 'M-16 22V16H16V22Z') + P('pd', 'M-13 16V12H13V16Z')
    + P('md', 'M-11 12V-6h3V12Z') + P('md', 'M8 12V-6h3V12Z')
    + P('to', 'M-16 -6L0 -20L16 -6Z') + HT('M0 -20L16 -6H7Z')
    + P('f', 'M0 -20V-32') + P('br', 'M0 -32h15l-4.5 5 4.5 5H0Z') + gl(icone, 6.5, -27, 7.6),

  // Comércios e casas (casinhas de gravura).
  casa: () => sombra(24)
    + casaTelhado({ x0: -16, x1: 14, yt: 4, yb: 22, alt: 13 }) + porta(-2, 22, 6, 10) + janela(8, 15, 3.6, 5.6) + janela(-10, 15, 3.6, 5.6) + chamine(4, -2, 4, 10),
  loja: () => sombra(26)
    + casaTelhado({ x0: -18, x1: 16, yt: 2, yb: 22, alt: 12, rl: 'to', rr: 'tos' })
    + P('pt', 'M-6 22V11H6V22Z')
    + Array.from({ length: 5 }, (_, i) => P(i % 2 ? 'br' : 'vm', `M${-12 + i * 5.6} 8h5.6l.8 6h-5.6Z`)).join('') + janela(-14, 18, 3, 5) + janela(12, 18, 3, 5)
    + placa(-20, -2, 'loja'),
  taverna: () => sombra(30)
    + casaTelhado({ x0: -22, x1: 18, yt: 2, yb: 22, alt: 14, dx: 8, parede: 'br', lado: 'brs', rl: 'tv', rr: 'tvs' })
    + P('mds', 'M-22 2H18M-22 12H18M-12 2V22M0 2V22M10 2V22') + '<path class="i f" d="M-22 12L-12 2M-12 22L0 12M0 12L10 2" stroke-opacity="0.7"/>'
    + porta(-6, 22, 7, 11) + janela(5, 18, 3.4, 5) + janela(-16, 18, 3.4, 5) + chamine(8, -4, 4.4, 10) + fumaca(10, -14)
    + placa(24, 4, 'taverna', 'to'),
  padaria: () => sombra(26)
    + casaTelhado({ x0: -17, x1: 15, yt: 3, yb: 22, alt: 12, rl: 'to', rr: 'tos' })
    + porta(-4, 22, 6.4, 10.5) + `<path class="i pt" d="M5 22V16a3.4 3.4 0 0 1 6.8 0V22Z"/>` + P('f', 'M5 19h6.8') + chamine(0, -4, 5, 12, 'tvs') + fumaca(2.5, -16) + placa(-21, -1, 'padaria', 'to'),
  peixaria: () => sombra(26)
    + casaTelhado({ x0: -17, x1: 15, yt: 3, yb: 22, alt: 12, rl: 'ta', rr: 'tas' })
    + porta(-3, 22, 6.4, 10.5) + janela(8, 16, 3.4, 5.4) + P('md', 'M16 14h8v8h-8Z') + P('f', 'M16 18h8') + placa(-21, -1, 'peixe', 'br'),
  ferraria: () => sombra(28)
    + caixa(-18, 14, 2, 22, 8, 4.5, 'pd', 'ps')
    + P('czs', 'M-20 2L-12 -8H10L18 2Z') + P('cz', 'M14 2L22 -2.5L14 -8.5L10 -8Z')
    + P('pt', 'M-10 22V10a6 6 0 0 1 12 0V22Z') + P('md', 'M-6 22V14h4v8Z') + P('f', 'M-9 17h10')
    + chamine(4, -8, 5, 10, 'ps') + `<circle class="n ou" cx="7" cy="-22" r="1"/><circle class="n ou" cx="11" cy="-26" r="0.8"/><circle class="n ou" cx="4" cy="-27" r="0.8"/>`
    + P('pt', 'M14 18h10l-2 3h-6Z') + P('pt', 'M15 18v-3h8v3Z'),
  botica: () => sombra(22)
    + P('br', 'M-10 -4V22H10V-4Z') + P('brs', 'M10 -4L16 -7.5V18.5L10 22Z') + HT('M10 -4L16 -7.5V18.5L10 22Z')
    + P('ta', 'M-13 -4H13L0 -24Z') + P('tas', 'M0 -24L13 -4H6Z') + HT('M0 -24L13 -4H6Z') + P('ou', 'M0 -24V-29') + `<circle class="i ou" cx="0" cy="-30" r="1.8"/>`
    + porta(0, 22, 6, 10) + janela(-5.4, 8, 3, 4.6) + janela(5.4, 8, 3, 4.6) + placa(-16, 2, 'pocao', 'br'),
  armazem: () => sombra(30)
    + casaTelhado({ x0: -22, x1: 18, yt: 4, yb: 22, alt: 11, dx: 9, dy: 5, parede: 'md', lado: 'mds', rl: 'cz', rr: 'czs' })
    + P('mds', 'M-8 22V8H8V22Z') + P('f', 'M0 8V22M-8 8L8 22M8 8L-8 22') + P('md', 'M20 14h8v8h-8Z') + P('md', 'M22 8h7v6h-7Z') + P('f', 'M20 18h8'),
  fazenda: () => sombra(34)
    + casaTelhado({ x0: -22, x1: 12, yt: -2, yb: 22, alt: 14, dx: 8, dy: 4.5, parede: 'vm', lado: 'tvs', rl: 'tv', rr: 'tvs' })
    + P('br', 'M-10 22V6H0V22Z') + P('f', 'M-10 6L0 22M0 6L-10 22') + P('br', 'M-9 -2h8v4h-8Z')
    + P('to', 'M16 22Q16 12 24 12Q32 12 32 22Z') + P('f', 'M18 19q6 -2 12 0M17 16q7 -2 14 0') + P('pd', 'M20 -2h8v24h-8Z') + HT('M24 -2h4v24h-4Z') + P('ta', 'M19 -2a5 5 0 0 1 10 0Z'),
  estabulo: () => sombra(34)
    + casaTelhado({ x0: -26, x1: 20, yt: 6, yb: 22, alt: 11, dx: 9, dy: 5, parede: 'md', lado: 'mds', rl: 'tos', rr: 'tvs' })
    + [-17, -4, 9].map(x => P('pt', `M${x - 4} 22V12H${x + 4}V22Z`) + P('f', `M${x} 12V22`)).join('')
    + P('to', 'M22 20q0 -5 5 -5t5 5Z') + P('f', 'M-26 6H20'),
};
ARTE.justica = () => ARTE.banco().replace(/<circle class="i ou" cx="0" cy="-9" r="4"\/><g class="gl".*$/, '') + `<circle class="i br" cx="0" cy="-9" r="4.4"/>` + gl('balanca', 0, -9, 6.4);

// Qual gravura vale para cada ícone do mapa. Ícone novo (que não está aqui) vira o "marco" com o desenho do ícone.
const POR_ICONE = {
  castelo: 'castelo', septo: 'septo', espada: 'arena', alvo: 'arena', pergaminho: 'tabelionato', moeda: 'banco', coluna: 'senado',
  balanca: 'justica', escudo: 'quartel', grades: 'prisao', cruz: 'hospital', livro: 'biblioteca', musica: 'teatro', torre: 'torre',
  sino: 'capela', poco: 'poco', jardim: 'jardim', barraca: 'mercado', porto: 'porto', bandeira: 'bandeira', coroa: 'solar',
  casa: 'casa', loja: 'loja', taverna: 'taverna', padaria: 'padaria', peixe: 'peixaria', ferraria: 'ferraria', pocao: 'botica',
  bau: 'armazem', fazenda: 'fazenda', estabulo: 'estabulo',
};
export const gravuraDoIcone = icone => POR_ICONE[icone] || null;
// A gravura de um prédio (o id do símbolo), ou o desenho solto do "marco" com o ícone na bandeirinha.
export function arteDoPredio(icone) {
  const id = POR_ICONE[icone];
  return id ? { id: `a-${id}` } : { solto: ARTE.marco(icone) };
}

/* ─── As casinhas (14 x 14) ───────────────────────── */

const PAREDES = ['#f1e7c8', '#ecdcae', '#e6d6b4'];
function casinha(v, sit) {
  const telhas = {
    ocupada: [['#a8523a', '#85402d'], ['#9a6a3a', '#7a5028'], ['#8d3f33', '#6c2e25']],
    comercio: [['#5f8f8a', '#487069'], ['#c99542', '#a37426']],
    sem_dono: [['#a8a291', '#8a8472']],
  }[sit][v];
  const parede = sit === 'sem_dono' ? '#e4dabb' : PAREDES[v % 3];
  const tra = sit === 'sem_dono' ? ' stroke-dasharray="2.2 1.2"' : '';
  const forma = v % 2
    ? `<path class="i" fill="${telhas[0]}" d="M-8 -0.4L-5 -6.4H5L8 -0.4Z"${tra}/><path class="n" fill="${telhas[1]}" d="M0 -6.4H5L8 -0.4H0Z" opacity="0.7"/>`
    : `<path class="i" fill="${telhas[0]}" d="M-8 -0.4L0 -7.4L8 -0.4Z"${tra}/><path class="n" fill="${telhas[1]}" d="M0 -7.4L8 -0.4H2Z" opacity="0.8"/>`;
  const chaminé = v === 0 && sit !== 'sem_dono' ? '<path class="i" fill="#cdb98a" d="M3.2 -4.2V-7.6H5.6V-2.6Z"/>' : '';
  const aviso = sit === 'comercio' ? '<path class="i" fill="#a63a2b" d="M-6.6 -0.4h13.2l-.8 2.1h-11.6Z"/>' : '';
  return `<path class="i" fill="${parede}" d="M-6 -0.4H6V6.8H-6Z"${tra}/>${chaminé}${forma}${aviso}`;
}
export function casinhasDefs() {
  const grupos = { ocupada: 3, comercio: 2, sem_dono: 1 };
  return Object.entries(grupos).flatMap(([sit, n]) => Array.from({ length: n }, (_, v) => `<g id="c-${sit}-${v}">${casinha(v, sit)}</g>`)).join('');
}
export const variantesDeCasa = { ocupada: 3, comercio: 2, sem_dono: 1 };

/* ─── Árvores, arbustos e morros ──────────────────── */

const ARV = {
  arv1: `<ellipse class="sb" cx="2" cy="0" rx="7" ry="2"/><path class="i md" d="M-1 0L-.6 -5H.8L1.2 0Z"/>`
    + `<circle class="i fos" cx="0" cy="-9" r="6.6"/><circle class="i fo" cx="-2.6" cy="-8" r="4.6"/><circle class="i fo" cx="2.4" cy="-11" r="4.2"/><path class="n" fill="#3a2713" fill-opacity="0.18" d="M0 -3.4a6.6 6.6 0 0 0 6 -4.6A6.6 6.6 0 0 1 0 -3.4Z"/>`,
  arv2: `<ellipse class="sb" cx="2" cy="0" rx="6" ry="1.8"/><path class="i md" d="M-.8 0V-3H.8V0Z"/>`
    + `<path class="i fos" d="M-7 -3L0 -13L7 -3Z"/><path class="i fo" d="M-5.6 -9L0 -18L5.6 -9Z"/><path class="i fos" d="M-4 -14L0 -22L4 -14Z"/><path class="ht" d="M0 -22L4 -14H0ZM0 -18L5.6 -9H0ZM0 -13L7 -3H0Z"/>`,
  arv3: `<ellipse class="sb" cx="3" cy="0" rx="10" ry="2.6"/><path class="i md" d="M-1.6 0L-1.2 -6H1.2L1.6 0Z"/>`
    + `<path class="i fos" d="M-10 -9a5 5 0 0 1 3 -6a5.4 5.4 0 0 1 6.6 -4a5.6 5.6 0 0 1 7 2a5 5 0 0 1 4 6.4a5 5 0 0 1 -3 5.4Q0 -3 -7 -4a5 5 0 0 1 -3.6 -3Z"/>`
    + `<path class="i fo" d="M-7.4 -9.6a3.6 3.6 0 0 1 2.4 -4.2a4 4 0 0 1 5.2 -2.2a4 4 0 0 1 4.6 2.6a3.6 3.6 0 0 1 .4 4.2Q0 -6 -7.4 -9.6Z"/>`,
  arb: `<ellipse class="sb" cx="1" cy="0" rx="5" ry="1.4"/><path class="i fos" d="M-5 0a2.8 2.8 0 0 1 .8 -4.6a3 3 0 0 1 4.2 -1.6a3 3 0 0 1 4.4 1.2A2.8 2.8 0 0 1 5 0Z"/><path class="n" fill="#3a2713" fill-opacity="0.15" d="M0 0H5a2.8 2.8 0 0 0 -.4 -3.6Z"/>`,
  morro: `<ellipse class="sb" cx="3" cy="0" rx="12" ry="2.4"/><path class="i" fill="#d9c58f" d="M-13 0Q-8 -12 0 -12Q8 -12 13 0Z"/>`
    + `<path class="i f" stroke-width="0.6" d="M2 -10L5 -1M-1 -11L1 -1M5 -9L8 -1M-4 -9L-3 -1M8 -6L10.4 -1M-7 -6L-6.4 -1"/>`,
  juncos: `<path class="i f" stroke-width="0.8" d="M-3 0Q-3.4 -5 -5 -8M0 0Q0 -6 1 -10M3 0Q3.4 -5 5.4 -7M-1 0Q-2 -4 -3 -6"/>`,
};
export const idsDeArvore = Object.keys(ARV);

/* ─── Defs: gravuras, casinhas, hachura, gradientes ─ */

let texturaCache = null;
// A textura do papel: fibra e manchinhas num ladrilho que se repete (feito uma vez, num canvas).
function texturaDoPapel() {
  if (texturaCache !== null) return texturaCache;
  texturaCache = '';
  try {
    const T = 192;
    const tela = document.createElement('canvas');
    tela.width = T;
    tela.height = T;
    const ctx = tela.getContext('2d');
    const img = ctx.createImageData(T, T);
    const rnd = semente(2026);
    const G = 12;
    const grade = Array.from({ length: G * G }, () => rnd());
    const ruido = (x, y, f, fy = f) => {
      const gx = (x / T) * G * f;
      const gy = (y / T) * G * fy;
      const [x0, y0] = [Math.floor(gx), Math.floor(gy)];
      const [tx, ty] = [gx - x0, gy - y0];
      const v = (i, j) => grade[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
    };
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const mancha = ruido(x, y, 1) * 0.6 + ruido(x, y, 2) * 0.4;
        const fibra = ruido(x, y, 8, 0.7) * 0.55 + ruido(x, y, 16, 1.4) * 0.45;
        const ponto = rnd() > 0.992 ? 0.5 : 0;
        const a = Math.max(0, (mancha - 0.45) * 0.34 + (fibra - 0.5) * 0.3 + ponto);
        const i = (y * T + x) * 4;
        img.data[i] = 96;
        img.data[i + 1] = 66;
        img.data[i + 2] = 28;
        img.data[i + 3] = Math.min(255, Math.round(a * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    texturaCache = tela.toDataURL('image/png');
  } catch { texturaCache = ''; }
  return texturaCache;
}

export function defsCarta() {
  const tex = texturaDoPapel();
  const gravuras = Object.entries(ARTE).filter(([k]) => k !== 'marco').map(([k, f]) => `<g id="a-${k}">${f()}</g>`).join('');
  const arvores = Object.entries(ARV).map(([k, d]) => `<g id="${k}">${d}</g>`).join('');
  return `
<pattern id="m-hach" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V2.6" stroke="${COR.tinta}" stroke-width="0.55" stroke-opacity="0.5"/></pattern>
<pattern id="m-fibra" width="192" height="192" patternUnits="userSpaceOnUse">${tex ? `<image href="${tex}" width="192" height="192"/>` : ''}</pattern>
<pattern id="m-onda" width="14" height="6" patternUnits="userSpaceOnUse"><path d="M0 3q3.5 -3 7 0t7 0" fill="none" stroke="${COR.aguaTinta}" stroke-width="0.7" stroke-opacity="0.7"/></pattern>
<radialGradient id="m-mancha"><stop offset="0" stop-color="#7a4f1e" stop-opacity="0.2"/><stop offset="1" stop-color="#7a4f1e" stop-opacity="0"/></radialGradient>
<radialGradient id="m-vinheta" cx="50%" cy="50%" r="72%"><stop offset="58%" stop-color="#4a2808" stop-opacity="0"/><stop offset="100%" stop-color="#4a2808" stop-opacity="0.5"/></radialGradient>
<linearGradient id="m-queima-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1f06" stop-opacity="0.5"/><stop offset="1" stop-color="#3a1f06" stop-opacity="0"/></linearGradient>
<linearGradient id="m-queima-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1f06" stop-opacity="0.5"/><stop offset="1" stop-color="#3a1f06" stop-opacity="0"/></linearGradient>
<clipPath id="m-miolo"><rect x="${VX + 15}" y="${VY + 15}" width="${VW - 30}" height="${VH - 30}"/></clipPath>
${gravuras}${arvores}<g id="torre-muro">${torreMuro()}</g>${casinhasDefs()}
<g id="canto"><circle r="10.5" fill="${COR.papel}" stroke="${COR.tinta}" stroke-width="1.2"/><path class="i ou" d="${estrela7(0, 0, 9).replace(/L/g, 'L')}" fill="${COR.ouro}" stroke="${COR.tinta}" stroke-width="0.8"/><circle r="2.6" fill="${COR.vermelho}" stroke="${COR.tinta}" stroke-width="0.8"/></g>`;
}

/* ─── O terreno: papel, rio, cidade, muralha ──────── */

// Papel de fundo com manchas (fica atrás de tudo).
export function papel() {
  const rnd = semente(77);
  const manchas = Array.from({ length: 14 }, () => {
    const r = 70 + rnd() * 150;
    return `<circle cx="${um(rnd() * VW)}" cy="${um(rnd() * VH)}" r="${um(r)}" fill="url(#m-mancha)"/>`;
  }).join('');
  return `<rect x="${VX - 50}" y="${VY - 50}" width="${VW + 100}" height="${VH + 100}" fill="${COR.papel}"/>`
    + `<rect x="${VX - 50}" y="${VY - 50}" width="${VW + 100}" height="${VH + 100}" fill="url(#m-fibra)"/>${manchas}`;
}

const RIO_PTS = curvaDensa(RIO, 5);
export function rio() {
  const caminho = poli(RIO_PTS);
  const margens = [-1, 1].map(lado => paralela(RIO_PTS, lado * 17.6));
  const lin = (d, w, o, extra = '') => `<path d="${poli(paralela(RIO_PTS, d))}" fill="none" stroke="${COR.aguaTinta}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round"${extra}/>`;
  return `<path d="${caminho}" fill="none" stroke="${COR.tinta}" stroke-width="37" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${caminho}" fill="none" stroke="${COR.agua}" stroke-width="34.4" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${caminho}" fill="none" stroke="url(#m-onda)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`
    + lin(-14, 0.7, 0.7) + lin(14, 0.7, 0.7) + lin(-10.8, 0.6, 0.5) + lin(10.8, 0.6, 0.5) + lin(-8, 0.5, 0.35) + lin(8, 0.5, 0.35)
    + lin(0, 0.8, 0.55, ' stroke-dasharray="7 15"') + lin(4.5, 0.7, 0.5, ' stroke-dasharray="3 19"') + lin(-4.5, 0.7, 0.5, ' stroke-dasharray="4 17"')
    + `<path d="${riscos(margens[0], 0.5, -4.2, 2)}${riscos(margens[1], -0.5, 4.2, 2)}" fill="none" stroke="${COR.tinta}" stroke-width="0.6" stroke-opacity="0.65"/>`;
}

// O chão da cidade (dentro da muralha) e a muralha com as torres.
const MURALHA = traco(CIDADE, { raio: 0, passo: 10, amp: 0.7, fechado: true });
export function chaoDaCidade() {
  return `<path d="${MURALHA}" fill="${COR.chao}" fill-opacity="0.72" stroke="rgba(58,39,19,0.18)" stroke-width="18" stroke-linejoin="round"/>`
    + `<path d="${MURALHA}" fill="${COR.chao}" fill-opacity="0.72"/>`;
}
export function muralha() {
  return `<path d="${MURALHA}" fill="none" stroke="rgba(58,39,19,0.22)" stroke-width="15" stroke-linejoin="round"/>`
    + `<path d="${MURALHA}" fill="none" stroke="${COR.tinta}" stroke-width="8.6" stroke-linejoin="round"/>`
    + `<path d="${MURALHA}" fill="none" stroke="#d3c298" stroke-width="6.2" stroke-linejoin="round"/>`
    + `<path d="${MURALHA}" fill="none" stroke="${COR.tinta}" stroke-width="6.2" stroke-linejoin="round" stroke-dasharray="1 6.2" stroke-opacity="0.75"/>`
    + `<path d="${MURALHA}" fill="none" stroke="${COR.tinta}" stroke-width="0.7" stroke-linejoin="round" transform="translate(0 0)" stroke-opacity="0.9"/>`;
}
export function torres() {
  const { x, y } = PORTAO;
  const ponte = `<path d="M${x - 11} 8V${y + 2}M${x + 11} 8V${y + 2}" fill="none" stroke="${COR.tinta}" stroke-width="3.4" stroke-linecap="butt"/>`
    + `<path d="M${x - 11} 8V${y + 2}M${x + 11} 8V${y + 2}" fill="none" stroke="#cdb98a" stroke-width="2.2"/>`
    + `<rect x="${x - 9.4}" y="8" width="18.8" height="${y - 6}" fill="#e9dcb4"/>`
    + Array.from({ length: 8 }, (_, i) => `<path d="M${x - 9.4} ${12 + i * 5.2}h18.8" stroke="${COR.tinta}" stroke-width="0.6" stroke-opacity="0.55"/>`).join('')
    + `<path d="M${x - 14} 26q5 -6 10 0M${x + 4} 26q5 -6 10 0" fill="none" stroke="${COR.tinta}" stroke-width="0.9"/>`;
  return ponte + TORRES.map(([tx, ty]) => `<use href="#torre-muro" x="${tx}" y="${ty}"/>`).join('')
    + `<use href="#torre-muro" x="${x - 15}" y="${y - 2}" transform="translate(0 0)"/><use href="#torre-muro" x="${x + 15}" y="${y - 2}"/>`
    + `<path class="i pd" d="M${x - 15} ${y - 7}H${x + 15}V${y + 4}H${x - 15}Z"/>`
    + `<path class="i pt" d="M${x - 5} ${y + 4}V${y - 2}a5 5 0 0 1 10 0V${y + 4}Z"/><path class="i f" d="M${x - 2.4} ${y + 4}V${y - 5}M${x + 2.4} ${y + 4}V${y - 5}" stroke-width="0.6"/>`
    + `<use href="#torre-muro" x="${x - 15}" y="${y - 2}"/><use href="#torre-muro" x="${x + 15}" y="${y - 2}"/>`;
}

/* ─── As vias ─────────────────────────────────────── */

export function viasSvg(caminhos) {
  const tipoRua = RUAS.map(v => ({ ...v, tipo: 'rua' }));
  const tipoAv = AVENIDAS.map(v => ({ ...v, tipo: 'avenida' }));
  const d = v => linhasDaVia(v).map(l => traco(l, { raio: 9 })).join('');
  const dc = caminhos.map(l => traco(l, { raio: 9 })).join('');
  const cam = (classe, extra = '') => (v, k) => `<path class="${classe} m-${v.tipo}" d="${d(v)}" data-id="${v.id}"${extra}/>`;
  const caminho = (classe) => `<path class="${classe} m-rua" d="${dc}"/>`;
  const todas = [...tipoRua, ...tipoAv];
  return `<g class="m-vias">`
    + caminho('vo') + tipoRua.map(cam('vo')).join('') + tipoAv.map(cam('vo')).join('')
    + caminho('vf') + tipoRua.map(cam('vf')).join('') + tipoAv.map(cam('vf')).join('')
    + tipoAv.map(v => `<path class="vi" d="${d(v)}"/>`).join('') + tipoAv.map(v => `<path class="vj" d="${d(v)}" data-id="${v.id}"/>`).join('')
    + caminho('vf') + tipoRua.map(cam('vf')).join('')
    + todas.map(v => `<path class="vc m-${v.tipo}" d="${d(v)}"/>`).join('') + `<path class="vc m-rua" d="${dc}"/>`
    + `</g>`;
}
export function toqueSvg() {
  const todas = [...RUAS.map(v => ({ ...v, tipo: 'rua' })), ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' }))];
  return todas.map(v => `<path class="m-toque" d="${linhasDaVia(v).map(l => traco(l, { raio: 9 })).join('')}" data-id="${v.id}"/>`).join('');
}

/* ─── Árvores espalhadas (sempre as mesmas) ───────── */

const AMOSTRAS_VIAS = [...AVENIDAS, ...RUAS].flatMap(v => linhasDaVia(v).flatMap(l => amostrar(l, 6)));
const AMOSTRAS_MURO = amostrar([...CIDADE, CIDADE[0]], 6);
const longe = (p, pts, d) => !pts.some(q => Math.abs(q[0] - p[0]) < d && Math.abs(q[1] - p[1]) < d && Math.hypot(q[0] - p[0], q[1] - p[1]) < d);

function candidatas() {
  const rnd = semente(1154);
  const aceitas = [];
  const grade = new Map();
  const perto = (x, y, r) => {
    const gx = Math.floor(x / 12);
    const gy = Math.floor(y / 12);
    for (let i = gx - 2; i <= gx + 2; i++) for (let j = gy - 2; j <= gy + 2; j++) {
      for (const q of grade.get(`${i},${j}`) || []) if (Math.hypot(q[0] - x, q[1] - y) < r) return true;
    }
    return false;
  };
  // Manchas de floresta: onde as árvores ficam mais juntas.
  const bosques = Array.from({ length: 14 }, () => [rnd() * VW, rnd() * VH, 60 + rnd() * 120]);
  for (let t = 0; t < 9000 && aceitas.length < 520; t++) {
    const x = 24 + rnd() * (VW - 48);
    const y = 24 + rnd() * (VH - 48);
    if ((x < 204 && y < 424) || (x < 206 && y > 540)) continue; // cartucho, chave, rosa dos ventos e escala
    const cidade = dentro([x, y], CIDADE);
    const dens = bosques.reduce((m, [bx, by, br]) => Math.max(m, 1 - Math.hypot(x - bx, y - by) / br), 0);
    if (rnd() > (cidade ? 0.17 : 0.3 + dens * 0.7)) continue;
    if (!longe([x, y], RIO_PTS, 29)) continue;
    if (!longe([x, y], AMOSTRAS_VIAS, cidade ? 30 : 22) || !longe([x, y], AMOSTRAS_MURO, 15)) continue;
    if (Math.hypot(x - PORTAO.x, y - PORTAO.y) < 50) continue;
    if (perto(x, y, 9 + rnd() * 4)) continue;
    const tipo = rnd();
    aceitas.push({
      x: um(x), y: um(y), k: tipo < 0.44 ? 'arv1' : tipo < 0.66 ? 'arv2' : tipo < 0.78 ? 'arv3' : tipo < 0.9 ? 'arb' : tipo < 0.94 ? 'morro' : 'juncos',
      e: um(0.8 + rnd() * 0.5), esp: rnd() > 0.5 ? -1 : 1, t: rnd() < 0.5 ? '' : ['t2', 't3', 't4'][Math.floor(rnd() * (cidade ? 2 : 3))],
    });
    const gk = `${Math.floor(x / 12)},${Math.floor(y / 12)}`;
    if (!grade.has(gk)) grade.set(gk, []);
    grade.get(gk).push([x, y]);
  }
  return aceitas.sort((a, b) => a.y - b.y);
}
let CANDIDATAS = null;

// As árvores que não ficam em cima de casas nem de prédios (que vêm do banco e mudam).
export function arvoresSvg(casas, predios) {
  CANDIDATAS ||= candidatas();
  const caixas = { grande: [46, 48, 54], medio: [40, 40, 48], pequeno: [32, 30, 38] };
  const lugar = a => !casas.some(c => Math.abs(c.x - a.x) < 12 && Math.abs(c.y - a.y) < 13)
    && !predios.some(p => {
      const [w, cima, baixo] = caixas[p.tamanho] || caixas.medio;
      // A fita com o nome é mais larga que a gravura.
      const letras = p.nome.length > 14 ? Math.ceil(p.nome.length / 2) + 2 : p.nome.length;
      const fitaMeia = p.tamanho === 'pequeno' ? letras * 3.4 : letras * (p.tamanho === 'grande' ? 4.2 : 3.7) + 14;
      return Math.abs(p.x - a.x) < Math.max(w, fitaMeia + 6) && a.y > p.y - cima && a.y < p.y + baixo;
    });
  return CANDIDATAS.filter(lugar).map(a => `<use href="#${a.k}" class="${a.t}" transform="translate(${a.x} ${a.y}) scale(${a.esp * a.e} ${a.e})"/>`).join('');
}

/* ─── Prédios: peças que o mapa monta ─────────────── */

const MEDIDAS = { grande: 1, medio: 0.82, pequeno: 0.6 };
export const escalaDoPredio = t => MEDIDAS[t] || MEDIDAS.medio;
export function chao(p) {
  const k = escalaDoPredio(p.tamanho);
  return `<ellipse cx="${p.x + 1}" cy="${um(p.y + 19 * k)}" rx="${um(40 * k)}" ry="${um(12 * k)}" fill="#ecdfb8" fill-opacity="0.9" stroke="${COR.tinta}" stroke-opacity="0.35" stroke-width="0.7" stroke-dasharray="2 2.4"/>`;
}

// A fita (faixa de pergaminho) com o nome do prédio.
export function fita(x, y, linhas, grande) {
  const letra = grande ? 8.3 : 7.2;
  const larg = Math.max(...linhas.map(l => l.length * letra)) + 16;
  const alt = linhas.length * (grande ? 12.4 : 11) + 5;
  const [a, b] = [x - larg / 2, x + larg / 2];
  const cauda = (xa, dir) => `<path class="m-fita-cauda" d="M${xa} ${y + 2.4}h${dir * 7}l${-dir * 3.4} ${um(alt / 2)}l${dir * 3.4} ${um(alt / 2)}h${-dir * 7}Z"/>`;
  return `${cauda(a + 0.6, -1)}${cauda(b - 0.6, 1)}<path class="m-fita" d="M${um(a)} ${y}H${um(b)}V${um(y + alt)}H${um(a)}Z"/>`
    + linhas.map((l, i) => `<text class="m-nome ${grande ? 'm-grande' : ''}" x="${x}" y="${um(y + (grande ? 12.2 : 10.4) + i * (grande ? 12.4 : 11))}" textLength="${um(Math.max(8, l.length * letra))}" lengthAdjust="spacing">${l.toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('');
}
export const alturaDaFita = (linhas, grande) => linhas.length * (grande ? 12.4 : 11) + 5;

export const medalha = (x, y) => `<g transform="translate(${x} ${y})"><circle class="m-medalha" r="6"/><path class="m-medalha-estrela" d="${estrela7(0, 0, 4.2).replace(/ /g, ' ')}"/></g>`;

/* ─── Decoração fixa: moldura, cartucho, chave, rosa, escala ─ */

export function moldura() {
  const [w, h] = [VW, VH];
  const r = (i, extra) => `<rect x="${i}" y="${i}" width="${w - 2 * i}" height="${h - 2 * i}" fill="none" stroke="${COR.tinta}"${extra}/>`;
  return r(6, ' stroke-width="2.4"') + r(10.5, ' stroke-width="4.6" stroke-dasharray="7 7"') + r(14.5, ' stroke-width="1.1"')
    + [[14.5, 14.5], [w - 14.5, 14.5], [14.5, h - 14.5], [w - 14.5, h - 14.5]].map(([x, y]) => `<use href="#canto" x="${x}" y="${y}"/>`).join('');
}
export function vinheta() {
  const [w, h] = [VW, VH];
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#m-vinheta)" pointer-events="none"/>`
    + `<rect x="0" y="0" width="${w}" height="26" fill="url(#m-queima-v)" pointer-events="none"/>`
    + `<rect x="0" y="${h}" width="${w}" height="26" fill="url(#m-queima-v)" transform="rotate(180 ${w / 2} ${h / 2 + 13}) translate(0 ${-h - 26 + 0})" pointer-events="none"/>`
    + `<rect x="0" y="0" width="26" height="${h}" fill="url(#m-queima-h)" pointer-events="none"/>`
    + `<rect x="${w - 26}" y="0" width="26" height="${h}" fill="url(#m-queima-h)" transform="rotate(180 ${w - 13} ${h / 2})" pointer-events="none"/>`;
}

export function cartucho() {
  const x0 = 22;
  const [w, y0, h] = [162, 46, 78];
  const cx = x0 + w / 2;
  return `<g pointer-events="none">`
    + `<rect x="${x0 + 2}" y="${y0 + 3}" width="${w}" height="${h}" rx="3" fill="${COR.tinta}" opacity="0.25"/>`
    + `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="3" fill="${COR.papel2}" stroke="${COR.tinta}" stroke-width="1.8"/>`
    + `<rect x="${x0 + 4.5}" y="${y0 + 4.5}" width="${w - 9}" height="${h - 9}" rx="1.5" fill="none" stroke="${COR.tinta}" stroke-width="0.8"/>`
    + `<path class="i ou" d="M${cx - 9} ${y0 + 4}L${cx - 9} ${y0 - 4}L${cx - 4.5} ${y0 + 0}L${cx} ${y0 - 7}L${cx + 4.5} ${y0}L${cx + 9} ${y0 - 4}L${cx + 9} ${y0 + 4}Z"/>`
    + `<text class="m-titulo" x="${cx}" y="${y0 + 36}" textLength="136" lengthAdjust="spacingAndGlyphs">Lyendell</text>`
    + `<text class="m-subtitulo" x="${cx}" y="${y0 + 55}">a Capital</text>`
    + `<path d="M${x0 + 18} ${y0 + 41}H${x0 + w - 18}" stroke="${COR.tinta}" stroke-width="0.7"/>`
    + `<path d="M${cx - 62} ${y0 + h + 1}h8l-4 7 4 7h-8Z M${cx + 62} ${y0 + h + 1}h-8l4 7 -4 7h8Z" fill="#8a3326" stroke="${COR.tinta}" stroke-width="0.9"/>`
    + `<rect x="${cx - 56}" y="${y0 + h - 5}" width="112" height="19" fill="${COR.vermelho}" stroke="${COR.tinta}" stroke-width="1"/>`
    + `<text class="m-faixa-texto" x="${cx}" y="${y0 + h + 8}" textLength="94" lengthAdjust="spacing">CASA LUCKHAM</text>`
    + `</g>`;
}

// A chave do mapa (legenda), na faixa da esquerda. É um grupo à parte para o celular poder esconder.
export const ITENS_CHAVE = [
  ['avenida', 'Avenidas'], ['rua', 'Ruas'], ['publico', 'Prédios públicos'], ['comercio', 'Comércios e pontos'], ['centro', 'Centro da cidade'],
  ['ocupada', 'Casa com morador'], ['comercio-casa', 'Casa de comércio'], ['sem_dono', 'Casa sem dono'], ['muro', 'Muralha e torres'], ['rio', 'Rio'],
];
function amostraDaChave(tipo, x, y) {
  switch (tipo) {
    case 'avenida': return `<path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.tinta}" stroke-width="11" stroke-linecap="round"/><path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.via}" stroke-width="9" stroke-linecap="round"/><path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.tinta}" stroke-width="6.6" stroke-linecap="round" stroke-opacity="0.85"/><path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.via}" stroke-width="5.6" stroke-linecap="round"/>`;
    case 'rua': return `<path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.tinta}" stroke-width="7.4" stroke-linecap="round"/><path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.via}" stroke-width="5.8" stroke-linecap="round"/>`;
    case 'publico': return `<use href="#a-septo" transform="translate(${x} ${y - 2}) scale(0.4)"/>`;
    case 'comercio': return `<use href="#a-taverna" transform="translate(${x} ${y - 2}) scale(0.4)"/>`;
    case 'centro': return medalha(x, y);
    case 'ocupada': return `<use href="#c-ocupada-0" transform="translate(${x} ${y - 1}) scale(1.35)"/>`;
    case 'comercio-casa': return `<use href="#c-comercio-1" transform="translate(${x} ${y - 1}) scale(1.35)"/>`;
    case 'sem_dono': return `<use href="#c-sem_dono-0" transform="translate(${x} ${y - 1}) scale(1.35)"/>`;
    case 'muro': return `<path d="M${x - 14} ${y}H${x + 14}" stroke="${COR.tinta}" stroke-width="6" /><path d="M${x - 14} ${y}H${x + 14}" stroke="#d3c298" stroke-width="3.8"/><path d="M${x - 14} ${y}H${x + 14}" stroke="${COR.tinta}" stroke-width="3.8" stroke-dasharray="0.8 4.4"/>`;
    default: return `<path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.tinta}" stroke-width="9.4" stroke-linecap="round"/><path d="M${x - 15} ${y}H${x + 15}" stroke="${COR.agua}" stroke-width="7.6" stroke-linecap="round"/><path d="M${x - 11} ${y - 1.4}q2.8 -2.4 5.5 0t5.5 0t5.5 0t5.5 0" fill="none" stroke="${COR.aguaTinta}" stroke-width="0.8"/>`;
  }
}
// Os mesmos desenhos pequenos para a chave que aparece no celular (feita em HTML).
export function miniaturaDaChave(tipo) {
  return `<svg viewBox="-20 -17 40 34" width="40" height="34" aria-hidden="true">${amostraDaChave(tipo, 0, 0)}</svg>`;
}
export function chave() {
  const [x0, y0, w] = [20, 156, 168];
  const linhas = ITENS_CHAVE.length;
  const h = 40 + linhas * 21.6 + 6;
  const cx = x0 + w / 2;
  return `<g class="m-chave" pointer-events="none">`
    + `<rect x="${x0 + 2}" y="${y0 + 3}" width="${w}" height="${h}" rx="3" fill="${COR.tinta}" opacity="0.22"/>`
    + `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="3" fill="${COR.papel2}" stroke="${COR.tinta}" stroke-width="1.5"/>`
    + `<rect x="${x0 + 4}" y="${y0 + 4}" width="${w - 8}" height="${h - 8}" rx="1.5" fill="none" stroke="${COR.tinta}" stroke-width="0.7"/>`
    + `<text class="m-chave-titulo" x="${cx}" y="${y0 + 22}">CHAVE DO MAPA</text>`
    + `<path d="M${cx - 44} ${y0 + 28}h88" stroke="${COR.tinta}" stroke-width="0.8"/><path class="i ou" d="M${cx - 3} ${y0 + 28}l3 -3 3 3 -3 3Z"/>`
    + ITENS_CHAVE.map(([tipo, texto], i) => {
      const y = y0 + 46 + i * 21.6;
      return `${amostraDaChave(tipo, x0 + 30, y)}<text class="m-chave-texto" x="${x0 + 56}" y="${y + 3.6}">${texto}</text>`;
    }).join('')
    + `</g>`;
}

// A rosa dos ventos. Neste mapa o Norte fica para baixo e o Sul para cima (a planta vem do jogo).
export function rosaDosVentos(cx, cy) {
  const ponta = (ang, R, larg, r0 = 9) => `<g transform="rotate(${ang})">`
    + `<path d="M0 ${-R}L${larg} ${-r0}L0 0Z" fill="${COR.tinta}" stroke="${COR.tinta}" stroke-width="0.8" stroke-linejoin="round"/>`
    + `<path d="M0 ${-R}L${-larg} ${-r0}L0 0Z" fill="#f1e6c0" stroke="${COR.tinta}" stroke-width="0.8" stroke-linejoin="round"/></g>`;
  let marcas = '';
  for (let i = 0; i < 32; i++) marcas += `<path d="M0 -41.6V${i % 4 ? -45 : -48.4}" transform="rotate(${i * 11.25})" stroke="${COR.tinta}" stroke-width="${i % 4 ? 0.7 : 1.2}"/>`;
  return `<g transform="translate(${cx} ${cy})" pointer-events="none">`
    + `<circle r="55" fill="${COR.papel2}" fill-opacity="0.55" stroke="${COR.tinta}" stroke-width="1.2"/>`
    + `<circle r="41.6" fill="none" stroke="${COR.tinta}" stroke-width="1"/><circle r="38" fill="none" stroke="${COR.tinta}" stroke-width="0.6"/>${marcas}`
    + ponta(45, 36, 4.4, 8) + ponta(135, 36, 4.4, 8) + ponta(225, 36, 4.4, 8) + ponta(315, 36, 4.4, 8)
    + ponta(22.5, 26, 2.6, 6).replace(/fill="#3a2713"/, 'fill="#3a2713"') + ponta(112.5, 26, 2.6, 6) + ponta(202.5, 26, 2.6, 6) + ponta(292.5, 26, 2.6, 6)
    + ponta(0, 58, 7.6, 10) + ponta(90, 58, 7.6, 10) + ponta(180, 58, 7.6, 10) + ponta(270, 58, 7.6, 10)
    + `<path d="M0 36L-4 46L0 58L4 46Z" fill="${COR.vermelho}" stroke="${COR.tinta}" stroke-width="0.8" stroke-linejoin="round" transform="rotate(0)"/>`
    + `<circle r="4.6" fill="${COR.ouro}" stroke="${COR.tinta}" stroke-width="1"/><circle r="1.6" fill="${COR.tinta}"/>`
    + `<text class="m-rosa-letra" y="-62">S</text><text class="m-rosa-letra" x="-66" y="4.4">O</text><text class="m-rosa-letra" x="66" y="4.4">L</text>`
    + `<circle cy="72" r="9.4" fill="${COR.vermelho}" stroke="${COR.tinta}" stroke-width="1"/><text class="m-rosa-letra" y="76.4" style="fill:#f7ecca;font-size:12.5px">N</text>`
    + `</g>`;
}

export function barraDeEscala(x, y, larg = 124) {
  const n = 4;
  const w = larg / n;
  return `<g pointer-events="none">`
    + Array.from({ length: n }, (_, i) => `<rect x="${um(x + i * w)}" y="${y}" width="${um(w)}" height="4.6" fill="${i % 2 ? COR.papel2 : COR.tinta}" stroke="${COR.tinta}" stroke-width="0.8"/>`).join('')
    + Array.from({ length: n + 1 }, (_, i) => `<path d="M${um(x + i * w)} ${y - 3}V${y + 4.6}" stroke="${COR.tinta}" stroke-width="0.8"/>`).join('')
    + `<text class="m-escala-texto" x="${x + larg / 2}" y="${y + 15}">escala ilustrativa</text></g>`;
}
