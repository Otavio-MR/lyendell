// Mapa de Lyendell: a capital vista de cima, com as avenidas, as ruas e os prédios públicos.
// É todo desenhado em SVG: fica nítido em qualquer zoom e dá para baixar como imagem.
// Os estilos do desenho ficam dentro do próprio SVG, para a imagem baixada sair igual à tela.

import { h, trocar, icone, cabecalho, botao, aviso, aoSair, normalizar, ICONES } from '../core.js';
import { VISTA, CIDADE, RIO, TORRES, PONTE, AVENIDAS, RUAS, PREDIOS, CENTRO } from '../mapa-lyendell.js';

const NS = 'http://www.w3.org/2000/svg';
const [VX, VY, VW, VH] = VISTA;
const um = n => Math.round(n * 10) / 10;

function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f);
  return el;
}

/* ─── Geometria ───────────────────────────────────── */

// Linha suave passando pelos pontos (Catmull-Rom convertida em curvas de Bézier).
function curva(p, fechada = false) {
  const n = p.length;
  const pt = i => (fechada ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < (fechada ? n : n - 1); i++) {
    const [a, b, c, e] = [pt(i - 1), pt(i), pt(i + 1), pt(i + 2)];
    d += ` C${um(b[0] + (c[0] - a[0]) / 6)} ${um(b[1] + (c[1] - a[1]) / 6)} ${um(c[0] - (e[0] - b[0]) / 6)} ${um(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return fechada ? `${d} Z` : d;
}

// Pontos a cada "passo" ao longo de uma linha (para medir distâncias).
function amostrar(pontos, passo = 4) {
  const saida = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const [a, b] = [pontos[i], pontos[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
    for (let k = 0; k < n; k++) saida.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  saida.push(pontos[pontos.length - 1]);
  return saida;
}

function dentro([x, y], poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

const distancia = (p, amostras) => Math.min(...amostras.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));

// Sorteio que sai sempre igual (o desenho dos quarteirões não muda a cada visita).
function sorteador(semente) {
  return () => {
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIAS = [...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' })), ...RUAS.map(v => ({ ...v, tipo: 'rua' }))];
const linhasDaVia = v => [v.pontos, ...(v.ramos || [])];
const AMOSTRAS = new Map(VIAS.map(v => [v.id, linhasDaVia(v).flatMap(l => amostrar(l))]));

// Espaços que não recebem casinhas: os prédios públicos, a praça do Septo, o portão.
const LIVRES = [
  { elipse: [512, 352, 142, 122] }, { ret: [334, 328, 414, 388] }, { ret: [455, 430, 612, 556] },
  { elipse: [781, 205, 90, 96] }, { ret: [856, 108, 1004, 304] }, { ret: [224, 582, 406, 702] },
  { ret: [1024, 590, 1136, 698] }, { ret: [720, 442, 772, 492] }, { ret: [646, 36, 738, 84] },
];
const livre = ([x, y]) => LIVRES.some(a => (a.elipse
  ? ((x - a.elipse[0]) / a.elipse[2]) ** 2 + ((y - a.elipse[1]) / a.elipse[3]) ** 2 < 1
  : x > a.ret[0] && x < a.ret[2] && y > a.ret[1] && y < a.ret[3]));

// As casinhas da cidade: blocos pequenos em grade, fora das ruas, do rio e dos prédios.
function quarteiroes() {
  const r = sorteador(1154773);
  const obstaculos = [
    ...VIAS.map(v => ({ pts: AMOSTRAS.get(v.id), raio: v.tipo === 'avenida' ? 11 : 8 })),
    { pts: amostrar([...CIDADE, CIDADE[0]], 6), raio: 9 },
  ];
  const tons = [[], [], []];
  const PASSO = 13;
  for (let gy = 40; gy < VH + 20; gy += PASSO) {
    for (let gx = 196; gx < VW; gx += PASSO) {
      if (r() < 0.07) continue; // quintais e becos
      const larg = 7 + r() * 5 + (r() < 0.12 ? PASSO : 0);
      const alt = 7 + r() * 5;
      const c = [gx + (r() - 0.5) * 3 + larg / 2, gy + (r() - 0.5) * 3 + alt / 2];
      if (!dentro(c, CIDADE) || livre(c)) continue;
      const meio = Math.max(larg, alt) / 2;
      if (obstaculos.some(o => o.pts.some(q => Math.abs(q[0] - c[0]) < o.raio + meio && Math.abs(q[1] - c[1]) < o.raio + meio
        && Math.hypot(q[0] - c[0], q[1] - c[1]) < o.raio + meio * 0.8))) continue;
      tons[Math.floor(r() * 3)].push(`M${um(c[0] - larg / 2)} ${um(c[1] - alt / 2)}h${um(larg)}v${um(alt)}h${um(-larg)}z`);
    }
  }
  return tons;
}

// Linhas de relevo (os morros em volta da cidade).
function relevo() {
  let d = '';
  for (let i = 0; i < 90; i++) {
    const x0 = -20 + i * 14;
    for (let y = -20; y <= VH + 20; y += 16) {
      const x = x0 + 9 * Math.sin(y / 70 + i * 0.9) + 4 * Math.sin(y / 23 + i * 1.7);
      d += `${y === -20 ? 'M' : 'L'}${um(x)} ${y}`;
    }
  }
  return d;
}

/* ─── Desenho ─────────────────────────────────────── */

const ESTILO = `
.m-svg text { font-family: Cinzel, 'Palatino Linotype', 'Book Antiqua', Georgia, serif; }
.m-via-borda, .m-via-cor, .m-via-toque { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.m-via-borda { stroke: #070b08; }
.m-via-toque { stroke: transparent; stroke-width: 20; pointer-events: stroke; cursor: pointer; }
.m-avenida .m-via-borda { stroke-width: 15; }
.m-avenida .m-via-cor { stroke: #b8943a; stroke-width: 10; }
.m-rua .m-via-borda { stroke-width: 9.5; }
.m-rua .m-via-cor { stroke: #7a735d; stroke-width: 5.5; }
.m-avenida:hover .m-via-cor, .m-avenida.ativa .m-via-cor { stroke: #f6d879; }
.m-rua:hover .m-via-cor, .m-rua.ativa .m-via-cor { stroke: #eee2bb; }
.m-via.ativa .m-via-borda { stroke: #4a3a10; stroke-width: 21; stroke-opacity: 0.9; }
.m-rotulo-via { font-size: 8px; font-weight: 600; letter-spacing: 0.5px; fill: #efe4c2; stroke: #070b08; stroke-width: 3px; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.m-rotulo-via.m-avenida { font-size: 9px; letter-spacing: 1.6px; fill: #fbe8a8; }
.m-poi { cursor: pointer; }
.m-selo { fill: #0b110d; stroke: #d8b13a; stroke-width: 1.6; }
.m-poi:hover .m-selo, .m-poi.ativa .m-selo { fill: #3d300d; stroke: #ffe28a; stroke-width: 2.2; }
.m-glifo { fill: none; stroke: #f6e3a6; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.m-rotulo-predio { font-size: 11.5px; font-weight: 700; letter-spacing: 1.6px; fill: #f8ecd2; stroke: #070b08; stroke-width: 3.5px; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.m-titulo { font-size: 23px; font-weight: 700; letter-spacing: 3px; fill: #e8c35a; }
.m-subtitulo { font-size: 7.5px; letter-spacing: 2.2px; fill: #b9ad88; }
.m-legenda { font-size: 8.5px; letter-spacing: 1px; fill: #d9cfae; }
`;

function glifo(nome) {
  if (nome === 'septo') {
    // Estrela de sete pontas (o Septo).
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 7;
      const raio = i % 2 ? 4.2 : 9;
      pts.push(`${um(12 + raio * Math.cos(ang))} ${um(12 + raio * Math.sin(ang))}`);
    }
    return `<path d="M${pts.join(' L')} Z"/>`;
  }
  return ICONES[nome] || ICONES.estrela;
}

function selo(x, y, nome, raio = 11) {
  const g = s('g', { class: 'm-selo-g' }, s('circle', { class: 'm-selo', cx: x, cy: y, r: raio }));
  const desenho = s('g', { class: 'm-glifo', transform: `translate(${um(x - raio * 0.7)} ${um(y - raio * 0.7)}) scale(${((raio * 1.4) / 24).toFixed(3)})` });
  desenho.innerHTML = glifo(nome);
  g.append(desenho);
  return g;
}

function rotulo(x, y, linhas, { classe = 'm-rotulo-predio', ancora = 'middle', altura = 13 } = {}) {
  return s('text', { class: classe, x, y, 'text-anchor': ancora },
    linhas.map((l, i) => s('tspan', { x, dy: i ? altura : 0 }, l.toUpperCase())));
}

function desenharPredios() {
  const g = s('g', { class: 'm-predios' });
  // Septo: o anel, os claustros, o pórtico, a praça e a cúpula.
  const raios = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    raios.push(`M${um(506 + 24 * Math.cos(a))} ${um(365 + 24 * Math.sin(a))}L${um(506 + 74 * Math.cos(a))} ${um(365 + 74 * Math.sin(a))}`);
  }
  g.append(
    s('ellipse', { cx: 512, cy: 348, rx: 128, ry: 106, fill: '#0f1a18', stroke: '#1f3d3a', 'stroke-width': 12 }),
    s('ellipse', { cx: 512, cy: 348, rx: 134, ry: 112, fill: 'none', stroke: '#3d6b67', 'stroke-width': 1 }),
    s('ellipse', { cx: 507, cy: 362, rx: 100, ry: 90, fill: '#1b1f18', stroke: '#6d5d34', 'stroke-width': 1 }),
    s('rect', { x: 340, y: 337, width: 72, height: 40, rx: 3, fill: '#1d3331', stroke: '#3d6b67', 'stroke-width': 1.2 }),
    s('path', { d: 'M462 440H604V508Q604 552 560 552H506Q462 552 462 508Z', fill: '#231f16', stroke: '#6d5d34', 'stroke-width': 1.2 }),
    s('path', { d: 'M476 470H590M476 500H590M476 530H590M533 452V548', stroke: '#3a3322', 'stroke-width': 1, fill: 'none' }),
    s('circle', { cx: 506, cy: 365, r: 76, fill: 'url(#m-cupula)', stroke: '#4f8a84', 'stroke-width': 2 }),
    s('path', { d: raios.join(''), stroke: '#3f6f6a', 'stroke-width': 0.8, 'stroke-opacity': 0.55, fill: 'none' }),
  );
  // Coliseu: arquibancadas em anéis e a arena de areia.
  g.append(
    s('ellipse', { cx: 781, cy: 205, rx: 80, ry: 87, fill: '#231d14', stroke: '#8a7337', 'stroke-width': 2 }),
    s('ellipse', { cx: 781, cy: 205, rx: 68, ry: 75, fill: 'none', stroke: '#3a3122', 'stroke-width': 3 }),
    s('ellipse', { cx: 781, cy: 205, rx: 56, ry: 62, fill: 'none', stroke: '#3a3122', 'stroke-width': 3 }),
    s('ellipse', { cx: 781, cy: 205, rx: 42, ry: 36, fill: '#3b3020', stroke: '#8a7337', 'stroke-width': 1.2 }),
  );
  // Toca do Coelho: o jardim com árvores e a casa no meio.
  const r = sorteador(7);
  const toca = [[868, 118], [958, 108], [996, 150], [1000, 240], [986, 298], [902, 304], [866, 262], [858, 182]];
  const arvores = [];
  for (let i = 0; i < 70; i++) {
    const p = [862 + r() * 140, 112 + r() * 192];
    if (dentro(p, toca) && !(p[0] > 900 && p[0] < 968 && p[1] > 150 && p[1] < 240)) arvores.push(s('circle', { cx: um(p[0]), cy: um(p[1]), r: um(4 + r() * 5), fill: '#18301f', stroke: '#244a2e', 'stroke-width': 1 }));
  }
  g.append(s('path', { d: curva(toca, true), fill: '#11201a', stroke: '#2d4a33', 'stroke-width': 1.2 }), ...arvores,
    s('rect', { x: 912, y: 160, width: 44, height: 32, rx: 3, fill: '#2a2418', stroke: '#b8943a', 'stroke-width': 1.2 }));
  // Tabelionato, Banco e Quartel General.
  g.append(
    s('rect', { x: 726, y: 448, width: 40, height: 36, rx: 2, fill: '#2a2418', stroke: '#c9a24a', 'stroke-width': 1.4 }),
    s('rect', { x: 232, y: 588, width: 168, height: 108, rx: 4, fill: '#24201a', stroke: '#b8943a', 'stroke-width': 1.4 }),
    s('path', { d: Array.from({ length: 9 }, (_, i) => `M${250 + i * 17} 596v10`).join(''), stroke: '#6d5d34', 'stroke-width': 3, fill: 'none' }),
    s('rect', { x: 1030, y: 596, width: 98, height: 96, rx: 2, fill: '#211d17', stroke: '#b8943a', 'stroke-width': 1.4 }),
    ...[[1030, 596], [1128, 596], [1030, 692], [1128, 692]].map(([x, y]) => s('rect', { x: x - 7, y: y - 7, width: 14, height: 14, fill: '#2c261b', stroke: '#b8943a', 'stroke-width': 1.2 })),
  );
  return g;
}

function desenharMapa() {
  const [claro, medio, escuro] = quarteiroes();
  const svg = s('svg', {
    class: 'm-svg mapa-svg', viewBox: VISTA.join(' '), preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Mapa de Lyendell, a capital, vista de cima',
  });
  const estilo = s('style');
  estilo.textContent = ESTILO;
  const cidade = curva(CIDADE, true);
  const rio = curva(RIO);

  const defs = s('defs', {},
    s('radialGradient', { id: 'm-cupula', cx: '42%', cy: '38%', r: '70%' },
      s('stop', { offset: '0%', 'stop-color': '#2f625e' }), s('stop', { offset: '100%', 'stop-color': '#0e1d1c' })),
    s('radialGradient', { id: 'm-vinheta', cx: '50%', cy: '50%', r: '75%' },
      s('stop', { offset: '60%', 'stop-color': '#000', 'stop-opacity': 0 }), s('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.6 })),
    ...VIAS.map(v => s('path', { id: `m-rotulo-${v.id}`, d: curva(v.pontos) })),
  );

  const vias = s('g', { class: 'm-vias' }, [...RUAS.map(v => ({ ...v, tipo: 'rua' })), ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' }))].map(v => {
    const d = linhasDaVia(v).map(l => curva(l)).join(' ');
    return s('g', { class: `m-via m-${v.tipo}`, 'data-id': v.id },
      s('path', { class: 'm-via-borda', d }), s('path', { class: 'm-via-cor', d }), s('path', { class: 'm-via-toque', d }));
  }));
  const rotulosVias = s('g', { class: 'm-rotulos' }, VIAS.map(v => s('text', { class: `m-rotulo-via m-${v.tipo}`, dy: '0.35em' },
    s('textPath', { href: `#m-rotulo-${v.id}`, startOffset: `${(v.rotulo ?? 0.5) * 100}%`, 'text-anchor': 'middle' },
      v.tipo === 'avenida' ? v.nome.toUpperCase() : v.nome))));

  const pois = s('g', { class: 'm-pois' }, PREDIOS.map(p => s('g', { class: 'm-poi', 'data-id': p.id },
    selo(p.x, p.y, p.icone),
    rotulo(p.rotulo[0], p.rotulo[1] + 4, p.linhas || [p.nome], { ancora: p.ancora || 'middle' }))));

  // O Centro: a estrela roxa no Tabelionato.
  const { x: cx, y: cy } = CENTRO;
  const centro = s('g', { class: 'm-poi', 'data-id': 'centro' },
    s('circle', { cx, cy, r: 15, fill: '#a66ad6', 'fill-opacity': 0.22 }),
    s('path', { d: `M${cx} ${cy - 11}L${cx + 3} ${cy - 3}L${cx + 11} ${cy}L${cx + 3} ${cy + 3}L${cx} ${cy + 11}L${cx - 3} ${cy + 3}L${cx - 11} ${cy}L${cx - 3} ${cy - 3}Z`, fill: '#c38cf0', stroke: '#1a0f22', 'stroke-width': 1 }),
    rotulo(cx, cy + 25, ['Centro'], { classe: 'm-rotulo-predio m-rotulo-centro' }));
  centro.querySelector('text').setAttribute('style', 'fill:#d9b3f7;font-size:9px');

  // Rosa dos ventos, título e legenda (ficam também na imagem baixada).
  const rosa = s('g', { transform: 'translate(98 690)' },
    s('circle', { r: 30, fill: 'none', stroke: '#6d5d34', 'stroke-width': 1 }),
    s('circle', { r: 22, fill: 'none', stroke: '#3a3122', 'stroke-width': 1 }),
    s('path', { d: 'M0 -34L6 -6L34 0L6 6L0 34L-6 6L-34 0L-6 -6Z', fill: '#1c1a12', stroke: '#b8943a', 'stroke-width': 1.2 }),
    s('path', { d: 'M0 -34L6 -6L0 0Z M34 0L6 6L0 0Z M0 34L-6 6L0 0Z M-34 0L-6 -6L0 0Z', fill: '#b8943a' }),
    s('text', { class: 'm-rotulo-predio', y: -40, style: 'font-size:11px' }, 'N'));
  const titulo = s('g', {},
    s('rect', { x: 16, y: 66, width: 174, height: 78, rx: 6, fill: '#0a0f0b', 'fill-opacity': 0.88, stroke: '#b8943a', 'stroke-width': 1.2 }),
    s('rect', { x: 21, y: 71, width: 164, height: 68, rx: 4, fill: 'none', stroke: '#4a3e1f', 'stroke-width': 1 }),
    s('text', { class: 'm-titulo', x: 103, y: 107, 'text-anchor': 'middle' }, 'LYENDELL'),
    s('text', { class: 'm-subtitulo', x: 103, y: 125, 'text-anchor': 'middle' }, 'A CAPITAL · CASA LUCKHAM'));
  const itemLegenda = (y, desenho, texto) => s('g', {}, desenho, s('text', { class: 'm-legenda', x: 62, y: y + 3 }, texto));
  const legenda = s('g', {},
    s('rect', { x: 16, y: 470, width: 174, height: 150, rx: 6, fill: '#0a0f0b', 'fill-opacity': 0.88, stroke: '#4a3e1f', 'stroke-width': 1 }),
    s('text', { class: 'm-legenda', x: 30, y: 492, style: 'fill:#e8c35a;letter-spacing:2px' }, 'LEGENDA'),
    itemLegenda(514, [s('path', { d: 'M30 514H52', stroke: '#070b08', 'stroke-width': 11, 'stroke-linecap': 'round' }), s('path', { d: 'M30 514H52', stroke: '#b8943a', 'stroke-width': 7, 'stroke-linecap': 'round' })], 'Avenidas'),
    itemLegenda(540, [s('path', { d: 'M30 540H52', stroke: '#070b08', 'stroke-width': 8, 'stroke-linecap': 'round' }), s('path', { d: 'M30 540H52', stroke: '#7a735d', 'stroke-width': 4.5, 'stroke-linecap': 'round' })], 'Ruas'),
    itemLegenda(568, selo(41, 568, 'estrela', 9), 'Prédios públicos'),
    itemLegenda(596, s('path', { d: 'M41 587L43.5 593.5L50 596L43.5 598.5L41 605L38.5 598.5L32 596L38.5 593.5Z', fill: '#c38cf0' }), 'Centro'));

  svg.append(estilo, defs,
    s('rect', { x: VX - 50, y: VY - 50, width: VW + 100, height: VH + 100, fill: '#0b120d' }),
    s('path', { d: relevo(), fill: 'none', stroke: '#14211a', 'stroke-width': 1.4 }),
    s('path', { d: rio, fill: 'none', stroke: '#08141b', 'stroke-width': 38, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d: rio, fill: 'none', stroke: '#10293a', 'stroke-width': 29, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d: rio, fill: 'none', stroke: '#1f4a5e', 'stroke-width': 1.2, 'stroke-dasharray': '10 14', 'stroke-opacity': 0.8 }),
    s('path', { d: cidade, fill: '#121913' }),
    s('path', { d: claro.join(''), fill: '#1f271f' }),
    s('path', { d: medio.join(''), fill: '#1a211a' }),
    s('path', { d: escuro.join(''), fill: '#161c16' }),
    desenharPredios(),
    s('path', { d: cidade, fill: 'none', stroke: '#3b3119', 'stroke-width': 7 }),
    s('path', { d: cidade, fill: 'none', stroke: '#8a7337', 'stroke-width': 1.6 }),
    s('rect', { x: PONTE.x - PONTE.largura / 2, y: PONTE.ate, width: PONTE.largura, height: PONTE.y - PONTE.ate, fill: '#2b2519', stroke: '#8a7337', 'stroke-width': 1.2 }),
    s('path', { d: Array.from({ length: 8 }, (_, i) => `M${PONTE.x - PONTE.largura / 2} ${PONTE.ate + 6 + i * 6}h${PONTE.largura}`).join(''), stroke: '#4a3e1f', 'stroke-width': 1, fill: 'none' }),
    ...TORRES.map(([x, y]) => s('g', {},
      s('rect', { x: x - 9, y: y - 9, width: 18, height: 18, fill: '#1c2018', stroke: '#b8943a', 'stroke-width': 1.4 }),
      s('rect', { x: x - 4, y: y - 4, width: 8, height: 8, fill: '#3b3119' }))),
    vias, rotulosVias, pois, centro, rosa, titulo, legenda,
    s('rect', { x: VX, y: VY, width: VW, height: VH, fill: 'url(#m-vinheta)', 'pointer-events': 'none' }));
  return svg;
}

/* ─── A tela ──────────────────────────────────────── */

const ITENS = [
  ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida', descricao: `Avenida nº ${v.n}` })),
  ...RUAS.map(v => ({ ...v, tipo: 'rua', descricao: `Rua nº ${v.n}` })),
  ...PREDIOS.map(p => ({ ...p, tipo: 'predio', descricao: p.tipo })),
  { id: 'centro', nome: 'Centro da cidade', tipo: 'centro', descricao: 'No Tabelionato', x: CENTRO.x, y: CENTRO.y },
];
const porId = new Map(ITENS.map(i => [i.id, i]));

// Onde fica cada coisa: a via mais perto de um prédio, e os prédios perto de uma via.
function arredores(item) {
  if (item.tipo === 'avenida' || item.tipo === 'rua') {
    const pts = AMOSTRAS.get(item.id);
    const perto = PREDIOS.filter(p => distancia([p.x, p.y], pts) < 70).map(p => p.nome);
    return perto.length ? `Passa perto de: ${perto.join(', ')}.` : '';
  }
  const via = VIAS.map(v => ({ v, d: distancia([item.x, item.y], AMOSTRAS.get(v.id)) })).sort((a, b) => a.d - b.d)[0];
  return via ? `Fica perto da ${via.v.nome}.` : '';
}

function caixaDoItem(item) {
  const pontos = item.pontos ? linhasDaVia(item).flat() : [[item.x, item.y]];
  const xs = pontos.map(p => p[0]);
  const ys = pontos.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export async function mapa() {
  const svg = desenharMapa();
  const dica = h('div', { class: 'mapa-dica', hidden: true });
  const info = h('div', { class: 'mapa-info', hidden: true });
  let vb = [...VISTA];
  let animacao = 0;
  let selecionado = null;
  aoSair(() => cancelAnimationFrame(animacao));

  const aplicar = () => svg.setAttribute('viewBox', vb.map(um).join(' '));
  function limitar([x, y, w]) {
    w = Math.min(VW, Math.max(VW / 8, w));
    const alt = (w * VH) / VW;
    return [Math.min(VX + VW - w, Math.max(VX, x)), Math.min(VY + VH - alt, Math.max(VY, y)), w, alt];
  }
  function paraMapa(px, py) {
    const r = svg.getBoundingClientRect();
    return [vb[0] + ((px - r.left) / r.width) * vb[2], vb[1] + ((py - r.top) / r.height) * vb[3]];
  }
  function zoom(fator, centro = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]) {
    const w = vb[2] * fator;
    const k = Math.min(VW, Math.max(VW / 8, w)) / vb[2];
    vb = limitar([centro[0] - (centro[0] - vb[0]) * k, centro[1] - (centro[1] - vb[1]) * k, vb[2] * k]);
    aplicar();
  }
  function voarPara(alvo) {
    cancelAnimationFrame(animacao);
    // Aba escondida (a animação não roda) ou quem prefere menos movimento: vai direto.
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vb = alvo;
      aplicar();
      return;
    }
    const de = [...vb];
    const t0 = performance.now();
    const passo = t => {
      const k = Math.min(1, (t - t0) / 380);
      const e = 1 - (1 - k) ** 3;
      vb = de.map((v, i) => v + (alvo[i] - v) * e);
      aplicar();
      if (k < 1) animacao = requestAnimationFrame(passo);
    };
    animacao = requestAnimationFrame(passo);
  }
  function enquadrar(item) {
    const [x0, y0, x1, y1] = caixaDoItem(item);
    const margem = 70;
    const w = Math.max(x1 - x0 + margem * 2, ((y1 - y0 + margem * 2) * VW) / VH, VW / 3.2);
    const alt = (w * VH) / VW;
    voarPara(limitar([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - alt / 2, w, alt]));
  }

  // Escolher uma via ou prédio: acende no mapa e na lista, e mostra onde fica.
  function selecionar(id, { voar = false } = {}) {
    selecionado = id && porId.has(id) ? id : null;
    svg.querySelectorAll('[data-id]').forEach(el => el.classList.toggle('ativa', el.dataset.id === selecionado));
    lado.querySelectorAll('[data-item]').forEach(el => el.classList.toggle('ativa', el.dataset.item === selecionado));
    if (!selecionado) { info.hidden = true; return; }
    const item = porId.get(selecionado);
    trocar(info,
      h('strong', null, item.nome),
      h('small', null, item.descricao),
      h('p', null, arredores(item)),
      h('button', { class: 'btn-icone', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => selecionar(null) }, icone('x')));
    info.hidden = false;
    if (voar) enquadrar(item);
  }

  // Arrastar com o mouse ou o dedo, rodinha e pinça para o zoom.
  const toques = new Map();
  let arrasto = null;
  let moveu = false;
  svg.addEventListener('pointerdown', e => {
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    moveu = false;
    arrasto = { x: e.clientX, y: e.clientY, vb: [...vb], distancia: null };
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      arrasto.distancia = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    const mover = ev => {
      if (!toques.has(ev.pointerId) || !arrasto) return;
      toques.set(ev.pointerId, [ev.clientX, ev.clientY]);
      const r = svg.getBoundingClientRect();
      if (toques.size >= 2 && arrasto.distancia) {
        const [a, b] = [...toques.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoom(arrasto.distancia / d, paraMapa((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
        arrasto.distancia = d;
        moveu = true;
        return;
      }
      const dx = ev.clientX - arrasto.x;
      const dy = ev.clientY - arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moveu = true;
      if (!moveu) return;
      svg.classList.add('arrastando');
      vb = limitar([arrasto.vb[0] - (dx / r.width) * vb[2], arrasto.vb[1] - (dy / r.height) * vb[3], vb[2]]);
      aplicar();
    };
    const soltar = ev => {
      toques.delete(ev.pointerId);
      if (toques.size) {
        // Tirou um dedo da pinça: continua arrastando com o outro, a partir de onde está.
        const [x, y] = [...toques.values()][0];
        arrasto = { x, y, vb: [...vb], distancia: null };
        return;
      }
      arrasto = null;
      setTimeout(() => { moveu = false; }, 0); // depois do "click" que vem junto com o soltar
      svg.classList.remove('arrastando');
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };
    if (toques.size === 1) {
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    }
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.0015), paraMapa(e.clientX, e.clientY));
  }, { passive: false });
  svg.addEventListener('click', e => {
    if (moveu) return; // foi arrasto, não clique
    const alvo = e.target.closest('[data-id]');
    selecionar(alvo ? alvo.dataset.id : null);
  });

  // Nome ao passar o mouse.
  svg.addEventListener('pointermove', e => {
    const alvo = e.target.closest?.('[data-id]');
    if (!alvo || arrasto?.distancia || moveu) { dica.hidden = true; return; }
    const r = quadro.getBoundingClientRect();
    dica.textContent = porId.get(alvo.dataset.id)?.nome || '';
    dica.style.left = `${e.clientX - r.left}px`;
    dica.style.top = `${e.clientY - r.top}px`;
    dica.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { dica.hidden = true; });

  const quadro = h('div', { class: 'mapa-quadro' }, svg, dica, info,
    h('div', { class: 'mapa-zoom' },
      h('button', { class: 'btn-icone', type: 'button', title: 'Aproximar', 'aria-label': 'Aproximar', onclick: () => zoom(1 / 1.5) }, icone('mais')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Afastar', 'aria-label': 'Afastar', onclick: () => zoom(1.5) }, h('span', { class: 'mapa-menos' }, '−')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Ver a cidade inteira', 'aria-label': 'Ver a cidade inteira', onclick: () => voarPara([...VISTA]) }, icone('mapa'))));

  // Lista ao lado: legenda, busca, avenidas, ruas e prédios públicos.
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar rua ou prédio...', 'aria-label': 'Procurar no mapa' });
  const listas = h('div', { class: 'mapa-listas' });
  const marca = i => (i.tipo === 'predio' || i.tipo === 'centro'
    ? h('span', { class: `mapa-num ${i.tipo}` }, i.tipo === 'centro' ? h('span', { class: 'leg-centro' }) : icone(i.icone === 'septo' ? 'estrela' : i.icone))
    : h('span', { class: `mapa-num ${i.tipo}` }, i.n));
  function desenharListas() {
    const q = normalizar(busca.value.trim());
    const grupos = [['Avenidas', 'avenida'], ['Ruas', 'rua'], ['Prédios públicos', 'predio']].map(([titulo, tipo]) => {
      const itens = ITENS.filter(i => (i.tipo === tipo || (tipo === 'predio' && i.tipo === 'centro')) && (!q || normalizar(i.nome).includes(q)));
      if (!itens.length) return null;
      return h('div', null,
        h('h3', { class: 'mapa-sub' }, titulo),
        h('ul', { class: 'mapa-lista' }, itens.map(i => h('li', null,
          h('button', {
            class: `mapa-item ${i.id === selecionado ? 'ativa' : ''}`.trim(), type: 'button', 'data-item': i.id,
            onclick: () => selecionar(i.id, { voar: true }),
            onmouseenter: () => svg.querySelectorAll(`[data-id="${i.id}"]`).forEach(el => el.classList.add('ativa')),
            onmouseleave: () => svg.querySelectorAll(`[data-id="${i.id}"]`).forEach(el => el.classList.toggle('ativa', el.dataset.id === selecionado)),
          }, marca(i), h('span', null, i.nome))))));
    }).filter(Boolean);
    trocar(listas, grupos.length ? grupos : h('p', { class: 'suave' }, 'Nada com esse nome no mapa.'));
  }
  busca.addEventListener('input', desenharListas);
  desenharListas();

  const lado = h('aside', { class: 'painel mapa-lado' },
    h('div', { class: 'mapa-legenda' },
      h('span', null, h('i', { class: 'leg-linha avenida' }), 'Avenidas'),
      h('span', null, h('i', { class: 'leg-linha rua' }), 'Ruas'),
      h('span', null, h('span', { class: 'mapa-num predio' }, icone('estrela')), 'Prédios públicos'),
      h('span', null, h('span', { class: 'leg-centro' }), 'Centro da cidade')),
    busca, listas);

  async function baixarImagem() {
    try {
      const copia = svg.cloneNode(true);
      copia.querySelectorAll('.ativa').forEach(el => el.classList.remove('ativa'));
      copia.setAttribute('viewBox', VISTA.join(' '));
      copia.setAttribute('width', VW * 2);
      copia.setAttribute('height', VH * 2);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const tela = document.createElement('canvas');
      tela.width = VW * 2;
      tela.height = VH * 2;
      tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
      URL.revokeObjectURL(url);
      const png = await new Promise(ok => tela.toBlob(ok, 'image/png'));
      const a = h('a', { href: URL.createObjectURL(png), download: 'mapa-de-lyendell.png' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      console.error(e);
      aviso('Não deu para gerar a imagem agora. Tente de novo.', 'erro');
    }
  }

  return h('div', { class: 'pagina mapa' },
    cabecalho({
      titulo: 'Mapa de Lyendell', icone: 'mapa',
      sub: 'A capital vista de cima. Arraste para andar, use a rodinha ou os botões para o zoom e clique numa rua ou prédio.',
      acoes: [botao('Baixar imagem', { icone: 'baixar', onclick: baixarImagem })],
    }),
    h('div', { class: 'mapa-grade' }, quadro, lado));
}
