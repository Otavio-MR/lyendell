// Mapa de Lyendell: a capital vista de cima, como uma planta: avenidas, ruas e prédios públicos.
// É todo desenhado em SVG: fica nítido em qualquer zoom e dá para baixar como imagem.
// Os estilos do desenho ficam dentro do próprio SVG, para a imagem baixada sair igual à tela.

import { h, trocar, icone, cabecalho, botao, aviso, aoSair, normalizar, ICONES } from '../core.js';
import { VISTA, CIDADE, RIO, TORRES, PORTAO, CAMINHOS, AVENIDAS, RUAS, PREDIOS } from '../mapa-lyendell.js';

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

// Linha reta por trechos, com os cantos levemente arredondados.
function reta(p, raio = 9) {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(raio, l1 / 2, l2 / 2);
    d += ` L${um(b[0] - ((b[0] - a[0]) / l1) * r)} ${um(b[1] - ((b[1] - a[1]) / l1) * r)}`
      + ` Q${b[0]} ${b[1]} ${um(b[0] + ((c[0] - b[0]) / l2) * r)} ${um(b[1] + ((c[1] - b[1]) / l2) * r)}`;
  }
  const f = p[p.length - 1];
  return `${d} L${f[0]} ${f[1]}`;
}

// Curva suave (para o rio, que não é reto).
function curva(p) {
  const n = p.length;
  const pt = i => p[Math.max(0, Math.min(n - 1, i))];
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, e] = [pt(i - 1), pt(i), pt(i + 1), pt(i + 2)];
    d += ` C${um(b[0] + (c[0] - a[0]) / 6)} ${um(b[1] + (c[1] - a[1]) / 6)} ${um(c[0] - (e[0] - b[0]) / 6)} ${um(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return d;
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
const distancia = (p, amostras) => Math.min(...amostras.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));

const VIAS = [...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' })), ...RUAS.map(v => ({ ...v, tipo: 'rua' }))];
const linhasDaVia = v => [v.pontos, ...(v.ramos || [])];
const AMOSTRAS = new Map(VIAS.map(v => [v.id, linhasDaVia(v).flatMap(l => amostrar(l))]));

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

const CHAO = '#131a15';
const ESTILO = `
.m-svg text { font-family: Cinzel, 'Palatino Linotype', 'Book Antiqua', Georgia, serif; }
.m-limpa, .m-borda, .m-cor, .m-toque { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.m-limpa { stroke: ${CHAO}; }
.m-limpa.m-avenida { stroke-width: 22; }
.m-limpa.m-rua { stroke-width: 15; }
.m-borda { stroke: #070b08; }
.m-borda.m-avenida { stroke-width: 13; }
.m-borda.m-rua { stroke-width: 8.5; }
.m-cor.m-avenida { stroke: #c29c3e; stroke-width: 8.5; }
.m-cor.m-rua { stroke: #857d66; stroke-width: 5; }
.m-toque { stroke: transparent; stroke-width: 20; pointer-events: stroke; cursor: pointer; }
.m-borda.ativa { stroke: #5a4612; }
.m-borda.m-avenida.ativa { stroke-width: 19; }
.m-borda.m-rua.ativa { stroke-width: 14; }
.m-cor.m-avenida.ativa { stroke: #f6d879; }
.m-cor.m-rua.ativa { stroke: #f1e6c2; }
.m-rotulo-via { font-size: 9px; font-weight: 600; letter-spacing: 0.4px; fill: #eee3c3; stroke: #070b08; stroke-width: 3px; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.m-rotulo-via.m-avenida { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; fill: #fbe8a8; }
.m-poi { cursor: pointer; }
.m-praca { fill: ${CHAO}; }
.m-placa { fill: #0b110d; stroke: #d8b13a; stroke-width: 1.6; }
.m-placa-dentro { fill: none; stroke: #5e4c1c; stroke-width: 1; }
.m-poi.ativa .m-placa { fill: #3d300d; stroke: #ffe28a; stroke-width: 2.2; }
.m-glifo { fill: none; stroke: #f6e3a6; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.m-nome { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; fill: #f8ecd2; stroke: #070b08; stroke-width: 3px; paint-order: stroke; stroke-linejoin: round; text-anchor: middle; pointer-events: none; }
.m-nome.m-grande { font-size: 13px; letter-spacing: 1.8px; }
.m-sub { font-size: 8px; letter-spacing: 1px; fill: #c9b98a; stroke: #070b08; stroke-width: 2.5px; paint-order: stroke; text-anchor: middle; pointer-events: none; }
.m-sub.m-centro { fill: #d6aef5; }
.m-quadro { fill: #0a0f0b; fill-opacity: 0.9; stroke: #b8943a; stroke-width: 1.2; }
.m-quadro-dentro { fill: none; stroke: #4a3e1f; stroke-width: 1; }
.m-titulo { font-size: 23px; font-weight: 700; letter-spacing: 3px; fill: #e8c35a; text-anchor: middle; }
.m-subtitulo { font-size: 7.5px; letter-spacing: 2.2px; fill: #b9ad88; text-anchor: middle; }
.m-legenda { font-size: 8.5px; letter-spacing: 1px; fill: #d9cfae; }
.m-legenda-titulo { font-size: 9px; letter-spacing: 2.4px; fill: #e8c35a; }
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
  if (nome === 'castelo') {
    return '<path d="M2.5 21h19"/><path d="M3.5 21V8h2V6h1.8v2h1.7v13"/><path d="M15 21V8h1.7V6h1.8v2h2v13"/>'
      + '<path d="M9 21V11h6v10"/><path d="M12 11V4.5l3 1-3 1"/><path d="M10.5 21v-2.5a1.5 1.5 0 0 1 3 0V21"/>';
  }
  return ICONES[nome] || ICONES.estrela;
}

function desenhoDoGlifo(nome, x, y, tam) {
  const g = s('g', { class: 'm-glifo', transform: `translate(${um(x - tam / 2)} ${um(y - tam / 2)}) scale(${(tam / 24).toFixed(3)})` });
  g.innerHTML = glifo(nome);
  return g;
}

const estrelaCentro = (x, y, r = 7) => s('path', {
  d: `M${x} ${y - r}L${um(x + r * 0.28)} ${um(y - r * 0.28)}L${x + r} ${y}L${um(x + r * 0.28)} ${um(y + r * 0.28)}L${x} ${y + r}`
    + `L${um(x - r * 0.28)} ${um(y + r * 0.28)}L${x - r} ${y}L${um(x - r * 0.28)} ${um(y - r * 0.28)}Z`,
  fill: '#c38cf0', stroke: '#1a0f22', 'stroke-width': 1,
});

// Todos os prédios com o mesmo desenho: um selo quadrado com o ícone e o nome embaixo.
function tamanhos(p) {
  const tam = p.grande ? 40 : 32;
  const linhas = p.linhas || [p.nome];
  const largNome = Math.max(...linhas.map(l => l.length * (p.grande ? 10.6 : 9)));
  return { tam, linhas, larg: Math.max(tam + 26, largNome + 20, p.sub ? p.sub.length * 6 + 20 : 0), alt: tam + 24 + linhas.length * 14 + (p.sub ? 12 : 0) };
}

function praca(p) {
  const { tam, larg, alt } = tamanhos(p);
  return s('rect', { class: 'm-praca', x: um(p.x - larg / 2), y: p.y - tam / 2 - 10, width: um(larg), height: alt, rx: 10 });
}

function selo(p) {
  const { tam, linhas } = tamanhos(p);
  const g = s('g', { class: 'm-poi', 'data-id': p.id },
    s('rect', { class: 'm-placa', x: p.x - tam / 2, y: p.y - tam / 2, width: tam, height: tam, rx: 8 }),
    s('rect', { class: 'm-placa-dentro', x: p.x - tam / 2 + 3.5, y: p.y - tam / 2 + 3.5, width: tam - 7, height: tam - 7, rx: 5 }),
    desenhoDoGlifo(p.icone, p.x, p.y, tam * 0.58));
  let y = p.y + tam / 2 + 15;
  for (const l of linhas) {
    g.append(s('text', { class: `m-nome ${p.grande ? 'm-grande' : ''}`.trim(), x: p.x, y }, l.toUpperCase()));
    y += 14;
  }
  if (p.sub) g.append(s('text', { class: `m-sub ${p.centro ? 'm-centro' : ''}`.trim(), x: p.x, y: y - 2 }, p.sub.toUpperCase()));
  if (p.centro) g.append(estrelaCentro(p.x + tam / 2, p.y - tam / 2));
  return g;
}

function desenharMapa() {
  const svg = s('svg', {
    class: 'm-svg mapa-svg', viewBox: VISTA.join(' '), preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Mapa de Lyendell, a capital, vista de cima',
  });
  const estilo = s('style');
  estilo.textContent = ESTILO;
  const cidade = `M${CIDADE.map(p => p.join(' ')).join(' L')} Z`;
  const rio = curva(RIO);

  const defs = s('defs', {},
    // As casas: quadradinhos alinhados em grade.
    s('pattern', { id: 'm-casas', width: 16, height: 16, patternUnits: 'userSpaceOnUse' },
      s('rect', { x: 2.5, y: 2.5, width: 11, height: 11, rx: 1.5, fill: '#1a221b' })),
    s('radialGradient', { id: 'm-vinheta', cx: '50%', cy: '50%', r: '75%' },
      s('stop', { offset: '62%', 'stop-color': '#000', 'stop-opacity': 0 }), s('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.55 })),
    ...VIAS.map(v => s('path', { id: `m-rotulo-${v.id}`, d: `M${v.rotulo[0].join(' ')} L${v.rotulo[1].join(' ')}` })),
  );

  // Vias em camadas (primeiro o espaço livre, depois a borda, depois a cor) para os cruzamentos ficarem limpos.
  const ordem = [...RUAS.map(v => ({ ...v, tipo: 'rua' })), ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' }))];
  const dDa = v => linhasDaVia(v).map(l => reta(l)).join(' ');
  const caminhos = CAMINHOS.map(l => reta(l)).join(' ');
  const camada = classe => s('g', {},
    classe !== 'm-toque' && s('path', { class: `${classe} m-rua`, d: caminhos }),
    ordem.map(v => s('path', { class: `${classe} m-${v.tipo}`, d: dDa(v), 'data-id': v.id })));

  const rotulosVias = s('g', {}, VIAS.map(v => s('text', { class: `m-rotulo-via m-${v.tipo}`, dy: '0.35em' },
    s('textPath', { href: `#m-rotulo-${v.id}`, startOffset: '50%', 'text-anchor': 'middle' },
      v.tipo === 'avenida' ? v.nome.toUpperCase() : v.nome))));

  // Título, legenda e rosa dos ventos, alinhados na faixa da esquerda (saem também na imagem baixada).
  const coluna = s('g', {},
    s('rect', { class: 'm-quadro', x: 16, y: 64, width: 170, height: 78, rx: 6 }),
    s('rect', { class: 'm-quadro-dentro', x: 21, y: 69, width: 160, height: 68, rx: 4 }),
    s('text', { class: 'm-titulo', x: 101, y: 105 }, 'LYENDELL'),
    s('text', { class: 'm-subtitulo', x: 101, y: 123 }, 'A CAPITAL · CASA LUCKHAM'),
    s('rect', { class: 'm-quadro', x: 16, y: 156, width: 170, height: 132, rx: 6, style: 'stroke:#4a3e1f' }),
    s('text', { class: 'm-legenda-titulo', x: 30, y: 178 }, 'LEGENDA'),
    s('path', { d: 'M30 200H56', stroke: '#070b08', 'stroke-width': 12, 'stroke-linecap': 'round' }),
    s('path', { d: 'M30 200H56', stroke: '#c29c3e', 'stroke-width': 8, 'stroke-linecap': 'round' }),
    s('text', { class: 'm-legenda', x: 68, y: 203 }, 'Avenidas'),
    s('path', { d: 'M30 224H56', stroke: '#070b08', 'stroke-width': 8.5, 'stroke-linecap': 'round' }),
    s('path', { d: 'M30 224H56', stroke: '#857d66', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    s('text', { class: 'm-legenda', x: 68, y: 227 }, 'Ruas'),
    s('rect', { class: 'm-placa', x: 34, y: 239, width: 18, height: 18, rx: 4 }),
    desenhoDoGlifo('estrela', 43, 248, 11),
    s('text', { class: 'm-legenda', x: 68, y: 251 }, 'Prédios públicos'),
    estrelaCentro(43, 272, 7),
    s('text', { class: 'm-legenda', x: 68, y: 275 }, 'Centro da cidade'),
    s('g', { transform: 'translate(101 690)' },
      s('circle', { r: 30, fill: 'none', stroke: '#6d5d34', 'stroke-width': 1 }),
      s('circle', { r: 22, fill: 'none', stroke: '#3a3122', 'stroke-width': 1 }),
      s('path', { d: 'M0 -34L6 -6L34 0L6 6L0 34L-6 6L-34 0L-6 -6Z', fill: '#1c1a12', stroke: '#b8943a', 'stroke-width': 1.2 }),
      s('path', { d: 'M0 -34L6 -6L0 0Z M34 0L6 6L0 0Z M0 34L-6 6L0 0Z M-34 0L-6 -6L0 0Z', fill: '#b8943a' }),
      s('text', { class: 'm-nome', y: -40 }, 'N')));

  const { x: px, y: py } = PORTAO;
  svg.append(estilo, defs,
    s('rect', { x: VX - 50, y: VY - 50, width: VW + 100, height: VH + 100, fill: '#0b110d' }),
    s('path', { d: relevo(), fill: 'none', stroke: '#111a14', 'stroke-width': 1.4 }),
    s('path', { d: rio, fill: 'none', stroke: '#08131a', 'stroke-width': 36, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d: rio, fill: 'none', stroke: '#10293a', 'stroke-width': 27, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d: rio, fill: 'none', stroke: '#1f4a5e', 'stroke-width': 1.2, 'stroke-dasharray': '10 14', 'stroke-opacity': 0.8 }),
    s('path', { d: cidade, fill: CHAO }),
    s('path', { d: cidade, fill: 'url(#m-casas)' }),
    s('g', {}, PREDIOS.map(praca)),
    camada('m-limpa'), camada('m-borda'), camada('m-cor'),
    s('path', { d: cidade, fill: 'none', stroke: '#3b3119', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
    s('path', { d: cidade, fill: 'none', stroke: '#8a7337', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    // Portão norte e a ponte sobre o rio.
    s('rect', { x: px - 12, y: -4, width: 24, height: py + 4, fill: '#2b2519', stroke: '#8a7337', 'stroke-width': 1.2 }),
    s('path', { d: Array.from({ length: 8 }, (_, i) => `M${px - 12} ${2 + i * 6.5}h24`).join(''), stroke: '#4a3e1f', 'stroke-width': 1, fill: 'none' }),
    ...TORRES.map(([x, y]) => s('g', {},
      s('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 2, fill: '#1c2018', stroke: '#b8943a', 'stroke-width': 1.3 }),
      s('rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7, fill: '#3b3119' }))),
    rotulosVias,
    camada('m-toque'),
    s('g', {}, PREDIOS.map(selo)),
    coluna,
    s('rect', { x: VX, y: VY, width: VW, height: VH, fill: 'url(#m-vinheta)', 'pointer-events': 'none' }));
  return svg;
}

/* ─── A tela ──────────────────────────────────────── */

const ITENS = [
  ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida', descricao: `Avenida nº ${v.n}` })),
  ...RUAS.map(v => ({ ...v, tipo: 'rua', descricao: `Rua nº ${v.n}` })),
  ...PREDIOS.map(p => ({ ...p, tipo: 'predio', descricao: p.tipo })),
];
const porId = new Map(ITENS.map(i => [i.id, i]));

// Onde fica cada coisa: a via mais perto de um prédio, e os prédios perto de uma via.
function arredores(item) {
  if (item.tipo === 'avenida' || item.tipo === 'rua') {
    const pts = AMOSTRAS.get(item.id);
    const perto = PREDIOS.filter(p => distancia([p.x, p.y], pts) < 80).map(p => p.nome);
    return perto.length ? `Passa perto de: ${perto.join(', ')}.` : '';
  }
  const via = VIAS.map(v => ({ v, d: distancia([item.x, item.y], AMOSTRAS.get(v.id)) })).sort((a, b) => a.d - b.d)[0];
  return via && via.d < 110 ? `Fica perto da ${via.v.nome}.` : '';
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
  let realcado = null;
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
    const k = Math.min(VW, Math.max(VW / 8, vb[2] * fator)) / vb[2];
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
    const margem = 80;
    const w = Math.max(x1 - x0 + margem * 2, ((y1 - y0 + margem * 2) * VW) / VH, VW / 3);
    const alt = (w * VH) / VW;
    voarPara(limitar([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - alt / 2, w, alt]));
  }

  // Acende uma via ou prédio no mapa (e na lista): o escolhido e o que está sob o mouse.
  function acender() {
    svg.querySelectorAll('[data-id]').forEach(el => el.classList.toggle('ativa', el.dataset.id === selecionado || el.dataset.id === realcado));
    lado.querySelectorAll('[data-item]').forEach(el => el.classList.toggle('ativa', el.dataset.item === selecionado));
  }
  function realcar(id) {
    if (id === realcado) return;
    realcado = id;
    acender();
  }
  function selecionar(id, { voar = false } = {}) {
    selecionado = id && porId.has(id) ? id : null;
    acender();
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
      dica.hidden = true;
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

  // Nome ao passar o mouse, e a via ou prédio acende.
  svg.addEventListener('pointermove', e => {
    const alvo = arrasto ? null : e.target.closest?.('[data-id]');
    realcar(alvo ? alvo.dataset.id : null);
    if (!alvo) { dica.hidden = true; return; }
    const r = quadro.getBoundingClientRect();
    dica.textContent = porId.get(alvo.dataset.id)?.nome || '';
    dica.style.left = `${e.clientX - r.left}px`;
    dica.style.top = `${e.clientY - r.top}px`;
    dica.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { dica.hidden = true; realcar(null); });

  const quadro = h('div', { class: 'mapa-quadro' }, svg, dica, info,
    h('div', { class: 'mapa-zoom' },
      h('button', { class: 'btn-icone', type: 'button', title: 'Aproximar', 'aria-label': 'Aproximar', onclick: () => zoom(1 / 1.5) }, icone('mais')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Afastar', 'aria-label': 'Afastar', onclick: () => zoom(1.5) }, h('span', { class: 'mapa-menos' }, '−')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Ver a cidade inteira', 'aria-label': 'Ver a cidade inteira', onclick: () => voarPara([...VISTA]) }, icone('mapa'))));

  // Embaixo do mapa: a busca e as listas (avenidas, ruas e prédios públicos), lado a lado.
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar rua ou prédio...', 'aria-label': 'Procurar no mapa' });
  const listas = h('div', { class: 'mapa-listas' });
  const marca = i => (i.tipo === 'predio'
    ? h('span', { class: 'mapa-num predio' }, icone({ septo: 'estrela', castelo: 'coroa' }[i.icone] || i.icone))
    : h('span', { class: `mapa-num ${i.tipo}` }, i.n));
  function desenharListas() {
    const q = normalizar(busca.value.trim());
    const grupos = [['Avenidas', 'avenida'], ['Ruas', 'rua'], ['Prédios públicos', 'predio']].map(([titulo, tipo]) => {
      const itens = ITENS.filter(i => i.tipo === tipo && (!q || normalizar(i.nome).includes(q)));
      return h('div', { class: 'mapa-grupo' },
        h('h3', { class: 'mapa-sub' }, titulo),
        itens.length
          ? h('ul', { class: 'mapa-lista' }, itens.map(i => h('li', null,
            h('button', {
              class: `mapa-item ${i.id === selecionado ? 'ativa' : ''}`.trim(), type: 'button', 'data-item': i.id,
              onclick: () => { selecionar(i.id, { voar: true }); quadro.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
              onmouseenter: () => realcar(i.id),
              onmouseleave: () => realcar(null),
            }, marca(i), h('span', null, i.nome, i.tipo === 'predio' && i.sub && h('small', null, i.sub))))))
          : h('p', { class: 'suave mapa-nada' }, 'Nada com esse nome.'));
    });
    trocar(listas, grupos);
  }
  busca.addEventListener('input', desenharListas);
  desenharListas();
  const lado = h('section', { class: 'painel mapa-lado' }, busca, listas);

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
    quadro, lado);
}
