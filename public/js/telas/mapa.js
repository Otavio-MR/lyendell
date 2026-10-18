// Mapa de Lyendell: a capital vista de cima, como uma planta: avenidas, ruas, prédios e casas.
// É todo desenhado em SVG: fica nítido em qualquer zoom e dá para baixar como imagem.
// Os estilos do desenho ficam dentro do próprio SVG, para a imagem baixada sair igual à tela.
// Os prédios (públicos, comércios e outros pontos) e as casas vêm do banco e são editados aqui mesmo.

import { get, post, put, del, h, trocar, icone, cabecalho, botao, botaoIcone, aviso, aoSair, normalizar, avatar, modal, modalForm, campo, confirmar, tentar, enviarImagem, relativo, ehCrianca } from '../core.js';
import { opiniaoDoLugar } from '../crianca.js';
import { VISTA, AVENIDAS, RUAS } from '../mapa-lyendell.js';
import { TAMANHO_CASA, amostrar, linhasDaVia, viaPorId, distribuir, encaixar, lerLista, trechoPrincipal, usarPredios } from '../mapa-casas.js';
import { ICONES_MAPA, desenhoDoIcone } from '../icones-mapa.js';
import {
  ESTILO_CARTA, defsCarta, papel, rio, chaoDaCidade, muralha, torres, viasSvg, toqueSvg, chave, cartucho, rosaDosVentos, barraDeEscala,
  moldura, vinheta, arvoresSvg, arteDoPredio, escalaDoPredio, chao, fita, alturaDaFita, medalha, variantesDeCasa, ITENS_CHAVE, miniaturaDaChave,
  baseDosPortoes, pontoNaMuralha, direcaoPeloLado, orientacaoDoPortao, ALCANCE_PORTAO,
} from '../mapa-arte.js';

const NS = 'http://www.w3.org/2000/svg';
const [VX, VY, VW, VH] = VISTA;
const um = n => Math.round(n * 10) / 10;

function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f);
  return el;
}

// Ícone do mapa como os ícones do site (para listas, botões e a ficha).
function iconeDoMapa(id, classe = '') {
  const svg = s('svg', { viewBox: '0 0 24 24', class: `ico ${classe}`.trim(), 'aria-hidden': 'true' });
  svg.innerHTML = desenhoDoIcone(id);
  return svg;
}

/* ─── Geometria ───────────────────────────────────── */

const distancia = (p, amostras) => Math.min(...amostras.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));

const VIAS = [...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' })), ...RUAS.map(v => ({ ...v, tipo: 'rua' }))];
const AMOSTRAS = new Map(VIAS.map(v => [v.id, linhasDaVia(v).flatMap(l => amostrar(l))]));

/* ─── Desenho ─────────────────────────────────────── */

// Os estilos do desenho ficam dentro do próprio SVG (ESTILO_CARTA), para a imagem baixada sair igual à tela.
function desenhoDoGlifo(nome, x, y, tam) {
  const g = s('g', { class: 'gl', transform: `translate(${um(x - tam / 2)} ${um(y - tam / 2)}) scale(${(tam / 24).toFixed(3)})` });
  g.innerHTML = desenhoDoIcone(nome);
  return g;
}

// Nome comprido vai em duas linhas, as mais parecidas possível ("Quartel" / "General").
function linhasDoNome(nome) {
  const palavras = nome.split(' ');
  if (nome.length <= 14 || palavras.length < 2) return [nome];
  let melhor = 1;
  let menor = Infinity;
  for (let i = 1; i < palavras.length; i++) {
    const dif = Math.abs(palavras.slice(0, i).join(' ').length - palavras.slice(i).join(' ').length);
    if (dif < menor) { menor = dif; melhor = i; }
  }
  return [palavras.slice(0, melhor).join(' '), palavras.slice(melhor).join(' ')];
}

// Um bloco de SVG em texto vira um grupo (o navegador já entende as tags no espaço do SVG).
function grupo(classe, svgTexto = '') {
  const g = s('g', classe ? { class: classe } : {});
  g.innerHTML = svgTexto;
  return g;
}

// A praça de terra batida embaixo do prédio.
const praca = p => grupo('', chao(p));

// Cada prédio é uma pequena gravura (a do seu ícone) com o nome numa fita de pergaminho.
function edificio(p) {
  const k = escalaDoPredio(p.tamanho);
  const grande = p.tamanho === 'grande';
  const pequeno = p.tamanho === 'pequeno';
  const arte = arteDoPredio(p.icone);
  const linhas = linhasDoNome(p.nome);
  const yFita = p.y + 22 * k + 5;
  const maisLonga = Math.max(...linhas.map(l => l.length));
  const larg = Math.max(68 * k, pequeno ? maisLonga * 6.2 : maisLonga * (grande ? 8.3 : 7.2) + 30);
  const fundo = yFita + (pequeno ? linhas.length * 8.6 + 4 : alturaDaFita(linhas, grande)) + (p.sub ? 11 : 0);
  const topo = p.y - 42 * k;
  const g = s('g', {
    class: `m-poi m-cat-${p.categoria}`, 'data-id': `p${p.id}`, 'data-predio': p.id, tabindex: 0, role: 'button',
    'aria-label': `${p.nome}${p.tipo ? `, ${p.tipo}` : ''}. Abrir a ficha.`,
  });
  g.append(
    grupo('', `<rect class="m-hit" x="${um(p.x - larg / 2 - 4)}" y="${um(topo - 4)}" width="${um(larg + 8)}" height="${um(fundo - topo + 8)}" rx="6"/>`
      + `<ellipse class="m-aro" cx="${p.x}" cy="${um(p.y + 8 * k)}" rx="${um(40 * k + 6)}" ry="${um(31 * k + 4)}"/>`),
    grupo('m-art', arte.id
      ? `<use href="#${arte.id}" transform="translate(${p.x} ${p.y}) scale(${k})"/>`
      : `<g transform="translate(${p.x} ${p.y}) scale(${k})">${arte.solto}</g>`));
  if (pequeno) {
    linhas.forEach((l, i) => g.append(s('text', { class: 'm-nome m-solto', x: p.x, y: um(yFita + 7 + i * 8.6) }, l.toUpperCase())));
  } else {
    g.append(grupo('', fita(p.x, yFita, linhas, grande)));
  }
  if (p.sub) g.append(s('text', { class: 'm-sub', x: p.x, y: um(fundo - 1.5) }, p.sub));
  if (p.centro) g.append(grupo('', medalha(um(p.x + 30 * k), um(p.y - 30 * k))));
  return g;
}

/* ─── Os portões da muralha ───────────────────────── */

const DIRECOES = { norte: 'Norte', sul: 'Sul', leste: 'Leste', oeste: 'Oeste', outro: 'Outra direção' };
const nomeSugerido = direcao => (DIRECOES[direcao] && direcao !== 'outro' ? `Portão do ${DIRECOES[direcao]}` : 'Novo portão');
const encurtar = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const linhasDoPortao = nome => (nome.length <= 24 ? [nome] : linhasDoNome(nome));

// A fita de pergaminho com o nome, montada com elementos: o nome vem de quem edita o mapa, nunca entra como texto de HTML.
function fitaDoPortao(x, y, linhas) {
  const letra = 7.2;
  const larg = Math.max(...linhas.map(l => l.length * letra)) + 16;
  const alt = alturaDaFita(linhas, false);
  const [a, b] = [x - larg / 2, x + larg / 2];
  const cauda = (xa, dir) => s('path', { class: 'm-fita-cauda', d: `M${um(xa)} ${um(y + 2.4)}h${dir * 7}l${-dir * 3.4} ${um(alt / 2)}l${dir * 3.4} ${um(alt / 2)}h${-dir * 7}Z` });
  return [
    cauda(a + 0.6, -1), cauda(b - 0.6, 1),
    s('path', { class: 'm-fita', d: `M${um(a)} ${um(y)}H${um(b)}V${um(y + alt)}H${um(a)}Z` }),
    ...linhas.map((l, i) => s('text', { class: 'm-nome', x: um(x), y: um(y + 10.4 + i * 11), textLength: um(Math.max(8, l.length * letra)), lengthAdjust: 'spacing' }, l.toUpperCase())),
  ];
}

// Um portão: a gravura (de frente ou de lado, conforme a muralha), a fita com o nome e, embaixo, "rumo a ...".
function portaoNoMapa(g) {
  const { modo } = orientacaoDoPortao(g);
  const alc = ALCANCE_PORTAO[modo];
  const linhas = linhasDoPortao(g.nome);
  const alt = alturaDaFita(linhas, false);
  const destino = g.destino ? `rumo a ${encurtar(g.destino, 30)}` : '';
  const extra = destino ? 12 : 0;
  // A fita vai embaixo do portão; se não couber no pé do mapa, vai em cima, com o destino entre ela e o portão.
  const embaixo = g.y + alc.baixo + 4 + alt + extra + 6 <= VH - 15;
  const yFita = embaixo ? g.y + alc.baixo + 4 : g.y - alc.cima - 4 - extra - alt;
  const yDestino = embaixo ? yFita + alt + 9 : g.y - alc.cima - 5;
  const meia = Math.max(Math.max(...linhas.map(l => l.length * 7.2)) + 30, destino.length * 3.7 + 10, 60) / 2;
  const topo = embaixo ? g.y - alc.cima : yFita;
  const fundo = embaixo ? yDestino + 3 : g.y + alc.baixo;
  const el = s('g', {
    class: 'm-poi m-portao', 'data-id': `g${g.id}`, 'data-portao': g.id, tabindex: 0, role: 'button',
    'aria-label': `${g.nome}, portão da muralha${g.destino ? `, leva a ${g.destino}` : ''}. Abrir a ficha.`,
  });
  const aro = modo === 'lado' ? { cy: g.y - 6, rx: 24, ry: 46 } : { cy: g.y - 14, rx: 36, ry: 28 };
  el.append(
    s('rect', { class: 'm-hit', x: um(g.x - meia - 4), y: um(topo - 4), width: um(meia * 2 + 8), height: um(fundo - topo + 8), rx: 6 }),
    s('ellipse', { class: 'm-aro', cx: g.x, cy: aro.cy, rx: aro.rx, ry: aro.ry }),
    s('g', { class: 'm-art' }, s('use', { href: `#a-portao_${modo}`, transform: `translate(${g.x} ${g.y})` })),
    ...fitaDoPortao(g.x, yFita, linhas));
  if (destino) el.append(s('text', { class: 'm-sub', x: g.x, y: um(yDestino) }, destino));
  return el;
}

function desenharMapa() {
  const svg = s('svg', {
    class: 'm-svg mapa-svg', viewBox: VISTA.join(' '), preserveAspectRatio: 'xMidYMid meet',
    role: 'group', 'aria-label': 'Mapa de Lyendell, a capital, vista de cima',
  });
  const estilo = s('style');
  estilo.textContent = ESTILO_CARTA;
  const defs = s('defs');
  defs.innerHTML = defsCarta();
  defs.append(...VIAS.map(v => s('path', { id: `m-rotulo-${v.id}`, d: `M${v.rotulo[0].join(' ')} L${v.rotulo[1].join(' ')}` })));

  const rotulosVias = s('g', { 'pointer-events': 'none' }, VIAS.map(v => s('text', { class: `m-rotulo-via m-${v.tipo}`, dy: '0.35em' },
    s('textPath', { href: `#m-rotulo-${v.id}`, startOffset: '50%', 'text-anchor': 'middle' },
      v.tipo === 'avenida' ? v.nome.toUpperCase() : v.nome))));

  const miolo = s('g', { 'clip-path': 'url(#m-miolo)' },
    grupo('', rio() + chaoDaCidade()),
    s('g', { class: 'm-arvores', 'pointer-events': 'none' }),
    s('g', { class: 'm-pracas', 'pointer-events': 'none' }),
    s('g', { class: 'm-portoes-base', 'pointer-events': 'none' }),
    grupo('', viasSvg()),
    grupo('', muralha() + torres()),
    rotulosVias,
    grupo('', toqueSvg()),
    s('g', { class: 'm-portoes' }),
    s('g', { class: 'm-casas' }),
    s('g', { class: 'm-predios' }));

  svg.append(estilo, defs, grupo('', papel()), miolo,
    grupo('', moldura()),
    grupo('', cartucho() + chave() + rosaDosVentos(101, 650) + barraDeEscala(39, 742)),
    grupo('', vinheta()));
  return svg;
}

/* ─── Textos ──────────────────────────────────────── */

const ITENS_VIAS = [
  ...AVENIDAS.map(v => ({ ...v, tipo: 'avenida', descricao: `Avenida nº ${v.n}` })),
  ...RUAS.map(v => ({ ...v, tipo: 'rua', descricao: `Rua nº ${v.n}` })),
];
const viaDoItem = new Map(ITENS_VIAS.map(i => [i.id, i]));

const SITUACAO = { ocupada: 'Com morador', comercio: 'Comércio', sem_dono: 'Sem dono' };
const CATEGORIAS = { publico: 'Prédio público', comercio: 'Comércio', outro: 'Outro ponto' };
const GRUPOS_PREDIOS = [['publico', 'Prédios públicos'], ['comercio', 'Comércios'], ['outro', 'Outros pontos']];
const TAMANHOS = { grande: 'Grande (prédio importante)', medio: 'Médio', pequeno: 'Pequeno (loja, banca, ponto)' };
// Telas do site que um prédio pode abrir (as mesmas de src/rotas/predios.js).
const PAGINAS = {
  '': 'Nenhuma', '/tabelionato': 'Tabelionato', '/guarda': 'Guarda do Coelho', '/hospital': 'Hospital', '/congresso': 'Congresso',
  '/leis': 'Leis de Lyendell', '/recreacao': 'Recreação', '/galeria': 'Galeria', '/atividades': 'Mural de Atividades', '/anuncios': 'Mural de Anúncios',
  '/escola': 'Escola Luckham',
};

const nomeDaCasa = c => c.texto || c.moradores?.[0]?.nome || SITUACAO[c.situacao];
const enderecoDaCasa = c => {
  const via = viaPorId(c.via);
  // Numa via em pé o lado é esquerdo ou direito; numa via deitada, de cima ou de baixo.
  const emPe = via ? trechoPrincipal(via).vertical : true;
  const lado = c.lado && (c.lado === 'esquerda' ? (emPe ? 'lado esquerdo' : 'lado de cima') : (emPe ? 'lado direito' : 'lado de baixo'));
  return [`Casa ${c.numero || 's/n'}`, via && via.nome, lado].filter(Boolean).join(' · ');
};

// A via mais perto de um ponto (para dizer onde fica um prédio).
function viaMaisPerto(x, y) {
  const via = VIAS.map(v => ({ v, d: distancia([x, y], AMOSTRAS.get(v.id)) })).sort((a, b) => a.d - b.d)[0];
  return via && via.d < 110 ? via.v : null;
}

// Uma pessoa (de uma casa ou de um prédio): foto e dados do registro no Tabelionato.
function cartaoPessoa({ nome, foto, detalhes = [], livro, livro_id, registro_id, funcao }, { link = false, aoAbrir } = {}) {
  return h('li', null,
    avatar(nome, 'avatar-m', foto),
    h('div', null,
      h('strong', null, nome),
      funcao && h('span', { class: 'predio-funcao' }, funcao),
      detalhes.length > 0 && h('dl', null, detalhes.map(d => h('div', null, h('dt', null, d.rotulo), h('dd', null, d.valor)))),
      link && registro_id && h('a', { href: `#/tabelionato/${livro_id}/registro/${registro_id}`, onclick: () => aoAbrir?.() }, `Ver no ${livro}`)));
}

// A ficha de uma casa: endereço, situação e quem mora (foto e dados do registro do Tabelionato).
function fichaDaCasa(c, { fixa, podeEditar, aoFechar, aoEditar }) {
  const moradores = c.moradores || [];
  return h('div', { class: `mapa-ficha ${fixa ? 'fixa' : ''}`.trim() },
    h('small', { class: 'mapa-ficha-end' }, enderecoDaCasa(c)),
    h('strong', { class: 'mapa-ficha-nome' }, nomeDaCasa(c)),
    h('span', { class: `mapa-ficha-sit sit-${c.situacao}` }, SITUACAO[c.situacao]),
    moradores.length > 0 && h('ul', { class: 'mapa-moradores' }, moradores.slice(0, fixa ? 12 : 4).map(p => cartaoPessoa(p, { link: fixa }))),
    !fixa && moradores.length > 4 && h('small', { class: 'suave' }, `e mais ${moradores.length - 4}. Clique para ver todos.`),
    c.situacao === 'ocupada' && !moradores.length && h('small', { class: 'suave' }, 'Ninguém do Tabelionato ligado a esta casa ainda.'),
    fixa && podeEditar && c.palpite && moradores.length > 0 && h('small', { class: 'suave' }, 'Achado pelo nome da casa. Se não for essa pessoa, escolha em "Editar casa".'),
    fixa && podeEditar && h('div', { class: 'mapa-ficha-acoes' }, botao('Editar casa', { icone: 'editar', classe: 'btn-pequeno', onclick: aoEditar })),
    fixa && h('button', { class: 'btn-icone mapa-ficha-fechar', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: aoFechar }, icone('x')));
}

// Escolher o ícone: uma grade com todos (o de "sem ícone" mostra o número, para as casas).
function seletorDeIcone(atual, { semIcone = false } = {}) {
  let valor = atual || (semIcone ? '' : 'estrela');
  const grade = h('div', { class: 'icone-grade', role: 'radiogroup', 'aria-label': 'Ícone' });
  const opcoes = [...(semIcone ? [{ id: '', nome: 'Número' }] : []), ...ICONES_MAPA];
  const desenhar = () => trocar(grade, opcoes.map(i => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(valor === i.id), title: i.nome,
    class: `icone-opcao ${valor === i.id ? 'ativo' : ''}`.trim(),
    onclick: () => { valor = i.id; desenhar(); },
  }, i.id ? iconeDoMapa(i.id) : h('span', { class: 'icone-numero' }, '01'), h('small', null, i.nome))));
  desenhar();
  return { el: grade, valor: () => valor };
}

// Um bloco do formulário com título (como o "campo", mas sem <label>: tem vários botões dentro).
const bloco = (titulo, conteudo, ajuda) => h('div', { class: 'campo' },
  h('span', { class: 'campo-rotulo' }, titulo), conteudo, ajuda && h('small', { class: 'campo-ajuda' }, ajuda));

/* ─── A tela ──────────────────────────────────────── */

export async function mapa() {
  const svg = desenharMapa();
  const camadaCasas = svg.querySelector('.m-casas');
  const camadaPredios = svg.querySelector('.m-predios');
  const camadaPracas = svg.querySelector('.m-pracas');
  const camadaArvores = svg.querySelector('.m-arvores');
  const camadaPortoes = svg.querySelector('.m-portoes');
  const camadaBasePortoes = svg.querySelector('.m-portoes-base');
  const dica = h('div', { class: 'mapa-dica', hidden: true });
  const info = h('div', { class: 'mapa-info', hidden: true });
  const ficha = h('div', { class: 'mapa-ficha-lugar' });
  let vb = [...VISTA];
  let animacao = 0;
  let selecionado = null; // via (av1, r3...), prédio (p12) ou portão (g3)
  let realcado = null;
  let casas = [];
  let predios = [];
  let portoes = [];
  let nomes = [];
  let podeEditar = false;
  let editando = false;
  let porNoMapa = 'casa'; // no modo de edição, o clique num lugar vazio põe uma casa, um prédio ou um portão
  let casaFixa = null;   // casa com a ficha aberta (clicada)
  let casaSobre = null;  // casa com o mouse em cima
  aoSair(() => cancelAnimationFrame(animacao));

  /* Zoom e posição */
  function aplicar() {
    svg.setAttribute('viewBox', vb.map(um).join(' '));
    posicionarFicha();
  }
  function limitar([x, y, w]) {
    w = Math.min(VW, Math.max(VW / 8, w));
    const alt = (w * VH) / VW;
    return [Math.min(VX + VW - w, Math.max(VX, x)), Math.min(VY + VH - alt, Math.max(VY, y)), w, alt];
  }
  function paraMapa(px, py) {
    const r = svg.getBoundingClientRect();
    return [vb[0] + ((px - r.left) / r.width) * vb[2], vb[1] + ((py - r.top) / r.height) * vb[3]];
  }
  function naTela(x, y) {
    const r = svg.getBoundingClientRect();
    const q = quadro.getBoundingClientRect();
    return [r.left - q.left + ((x - vb[0]) / vb[2]) * r.width, r.top - q.top + ((y - vb[1]) / vb[3]) * r.height];
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
  function enquadrarCaixa([x0, y0, x1, y1], margem = 80, minimo = VW / 3) {
    const w = Math.max(x1 - x0 + margem * 2, ((y1 - y0 + margem * 2) * VW) / VH, minimo);
    const alt = (w * VH) / VW;
    voarPara(limitar([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - alt / 2, w, alt]));
  }
  const enquadrarPonto = (x, y) => enquadrarCaixa([x, y, x, y], 60, VW / 4);

  /* Vias e prédios: acender, escolher */
  const predioPorId = id => predios.find(p => p.id === Number(id));
  function acender() {
    svg.querySelectorAll('[data-id]').forEach(el => el.classList.toggle('ativa', el.dataset.id === selecionado || el.dataset.id === realcado));
    camadaCasas.querySelectorAll('[data-casa]').forEach(el => el.classList.toggle('ativa', Number(el.dataset.casa) === casaFixa || Number(el.dataset.casa) === casaSobre));
    lado.querySelectorAll('[data-item]').forEach(el => el.classList.toggle('ativa', el.dataset.item === selecionado || el.dataset.item === `casa-${casaFixa}`));
  }
  function realcar(id) {
    if (id === realcado) return;
    realcado = id;
    acender();
  }
  // Escolher uma rua ou avenida: acende e mostra onde fica.
  function selecionarVia(id, { voar = false } = {}) {
    selecionado = id && viaDoItem.has(id) ? id : null;
    if (selecionado) fecharFicha();
    acender();
    if (!selecionado) { info.hidden = true; return; }
    const item = viaDoItem.get(selecionado);
    const perto = predios.filter(p => distancia([p.x, p.y], AMOSTRAS.get(item.id)) < 80).map(p => p.nome);
    trocar(info,
      h('strong', null, item.nome),
      h('small', null, item.descricao),
      h('p', null, perto.length ? `Passa perto de: ${perto.join(', ')}.` : ''),
      h('button', { class: 'btn-icone', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => selecionarVia(null) }, icone('x')));
    info.hidden = false;
    if (voar) {
      const pontos = linhasDaVia(item).flat();
      enquadrarCaixa([Math.min(...pontos.map(p => p[0])), Math.min(...pontos.map(p => p[1])), Math.max(...pontos.map(p => p[0])), Math.max(...pontos.map(p => p[1]))]);
    }
  }

  /* Prédios */
  function desenharPredios() {
    const ordem = [...predios].sort((a, b) => ['pequeno', 'medio', 'grande'].indexOf(a.tamanho) - ['pequeno', 'medio', 'grande'].indexOf(b.tamanho));
    trocar(camadaPracas, ordem.map(praca));
    trocar(camadaPredios, ordem.map(edificio));
    acender();
  }

  /* Portões da muralha */
  const portaoPorId = id => portoes.find(g => g.id === Number(id));
  function desenharPortoes() {
    camadaBasePortoes.innerHTML = baseDosPortoes(portoes);
    trocar(camadaPortoes, [...portoes].sort((a, b) => a.y - b.y).map(portaoNoMapa));
    acender();
  }

  // A ficha de um portão: para onde leva (em destaque), onde fica e o que se conta dele.
  function abrirPortao(g, { voar = false } = {}) {
    fecharFicha();
    info.hidden = true;
    selecionado = `g${g.id}`;
    acender();
    if (voar) enquadrarPonto(g.x, g.y);
    let janela = null;
    const via = viaMaisPerto(g.x, g.y);
    const onde = [g.direcao !== 'outro' ? `Na muralha do ${DIRECOES[g.direcao]}` : 'Na muralha', via && `Fica perto da ${via.nome}`].filter(Boolean).join(' · ');
    const corpo = h('div', { class: 'predio-ficha portao-ficha' },
      h('div', { class: 'predio-sobre' },
        h('span', { class: 'predio-selo cat-publico' }, iconeDoMapa('torre')),
        h('div', null,
          h('p', { class: 'predio-tipo' }, 'Portão da muralha'),
          h('p', { class: 'predio-onde' }, onde))),
      h('div', { class: `portao-destino ${g.destino ? '' : 'vazio'}`.trim() },
        h('small', null, ehCrianca() ? 'Quem passa por aqui vai para' : 'Leva a'),
        h('strong', null, g.destino || 'Destino ainda a definir'),
        !g.destino && podeEditar && h('span', null, 'Clique em "Editar" para dizer a cidade ou a região para onde ele leva.')),
      g.sobre && h('section', { class: 'predio-secao' }, h('h3', null, 'Sobre'), h('p', { class: 'predio-texto texto-livre' }, g.sobre)),
      g.atualizado_por_nome && g.atualizado_por_nome !== 'Sistema' && h('p', { class: 'predio-atualizado' }, `Atualizado por ${g.atualizado_por_nome} ${relativo(g.atualizado_em)}`));
    janela = modal({
      titulo: g.nome, corpo, tamanho: 'medio', classe: 'predio-modal',
      aoFechar: () => { if (selecionado === `g${g.id}`) { selecionado = null; acender(); } },
      rodape: [
        botao('Ver no mapa', { icone: 'mapa', onclick: () => { janela.fechar(); enquadrarPonto(g.x, g.y); selecionado = `g${g.id}`; acender(); } }),
        h('span', { class: 'espaco' }),
        podeEditar && botao('Editar', { icone: 'editar', classe: 'btn-ouro', onclick: () => { janela.fechar(); formularioPortao(g); } }),
      ],
    });
  }

  // A ficha de um prédio: fotos (de fora e de dentro), para que serve, quem mora e quem trabalha, e mais.
  function abrirPredio(p, { voar = false } = {}) {
    fecharFicha();
    info.hidden = true;
    selecionado = `p${p.id}`;
    acender();
    if (voar) enquadrarPonto(p.x, p.y);
    let filtro = '';
    let atual = 0;
    let janela = null;
    const galeria = h('div', { class: 'predio-galeria' });
    const fotosVisiveis = () => p.fotos.filter(f => !filtro || f.tipo === filtro);
    const mudar = d => {
      const l = fotosVisiveis();
      if (l.length < 2) return;
      atual = (atual + d + l.length) % l.length;
      desenharGaleria();
    };
    function desenharGaleria() {
      if (!p.fotos.length) {
        trocar(galeria, h('div', { class: 'predio-sem-foto' }, iconeDoMapa(p.icone),
          h('p', null, 'Ainda sem fotos.'),
          podeEditar && h('small', null, 'Coloque fotos de fora e de dentro em "Editar".')));
        return;
      }
      const l = fotosVisiveis();
      atual = Math.min(atual, l.length - 1);
      const f = l[atual];
      const tem = t => p.fotos.some(x => x.tipo === t);
      trocar(galeria,
        h('figure', { class: 'predio-foto' },
          h('a', { href: f.url, target: '_blank', rel: 'noopener', title: 'Abrir a foto inteira' },
            h('img', { src: f.url, alt: f.legenda || `${p.nome}, ${f.tipo === 'interior' ? 'por dentro' : 'por fora'}` })),
          h('span', { class: 'predio-foto-tipo' }, f.tipo === 'interior' ? 'Por dentro' : 'Por fora'),
          l.length > 1 && [
            botaoIcone('voltar', 'Foto anterior', () => mudar(-1), 'predio-seta esquerda'),
            botaoIcone('frente', 'Próxima foto', () => mudar(1), 'predio-seta direita'),
            h('span', { class: 'predio-foto-n' }, `${atual + 1} / ${l.length}`),
          ],
          f.legenda && h('figcaption', null, f.legenda)),
        tem('exterior') && tem('interior') && h('div', { class: 'predio-filtro-fotos', role: 'group', 'aria-label': 'Quais fotos' },
          [['', 'Todas'], ['exterior', 'Por fora'], ['interior', 'Por dentro']].map(([k, t]) => h('button', {
            type: 'button', class: `filtro-chip ${filtro === k ? 'ativo' : ''}`.trim(), 'aria-pressed': String(filtro === k),
            onclick: () => { filtro = k; atual = 0; desenharGaleria(); },
          }, t, h('span', null, p.fotos.filter(x => !k || x.tipo === k).length)))),
        l.length > 1 && h('div', { class: 'predio-miniaturas' }, l.map((x, i) => h('button', {
          type: 'button', class: `predio-mini ${i === atual ? 'ativa' : ''}`.trim(), 'aria-label': `Foto ${i + 1}`,
          onclick: () => { atual = i; desenharGaleria(); },
        }, h('img', { src: x.url, alt: '', loading: 'lazy' })))));
    }
    desenharGaleria();

    const pessoa = x => cartaoPessoa({
      ...(x.registro || {}), nome: x.registro?.nome || x.nome, funcao: x.funcao,
    }, { link: true, aoAbrir: () => janela?.fechar() });
    const moram = p.pessoas.filter(x => x.papel === 'mora');
    const trabalham = p.pessoas.filter(x => x.papel === 'trabalha');
    const via = viaMaisPerto(p.x, p.y);
    const secao = (titulo, ...conteudo) => h('section', { class: 'predio-secao' }, h('h3', null, titulo), ...conteudo);
    const corpo = h('div', { class: 'predio-ficha' },
      galeria,
      h('div', { class: 'predio-sobre' },
        h('span', { class: `predio-selo cat-${p.categoria}` }, iconeDoMapa(p.icone)),
        h('div', null,
          h('p', { class: 'predio-tipo' }, p.tipo || CATEGORIAS[p.categoria]),
          h('p', { class: 'predio-onde' }, [p.tipo && p.tipo !== CATEGORIAS[p.categoria] && CATEGORIAS[p.categoria], p.centro && 'Centro da cidade', via && `Fica perto da ${via.nome}`].filter(Boolean).join(' · ')))),
      // A criança conta o que acha do lugar (do jeito dela).
      ehCrianca() && h('div', { class: 'cr-fala cr-fala-predio' }, h('span', { class: 'cr-coelho', 'aria-hidden': 'true' }, icone('coelho')),
        h('p', null, h('small', null, 'O que eu acho:'), opiniaoDoLugar(p))),
      p.funcao && secao(ehCrianca() ? 'Os grandes dizem que serve para' : 'Para que serve', h('p', { class: 'predio-texto' }, p.funcao)),
      moram.length > 0 && secao(`Quem mora aqui (${moram.length})`, h('ul', { class: 'mapa-moradores predio-pessoas' }, moram.map(pessoa))),
      trabalham.length > 0 && secao(`Quem trabalha aqui (${trabalham.length})`, h('ul', { class: 'mapa-moradores predio-pessoas' }, trabalham.map(pessoa))),
      p.info.length > 0 && secao('Mais informações', h('dl', { class: 'predio-info' }, p.info.map(i => h('div', null, h('dt', null, i.rotulo), h('dd', null, i.valor))))),
      p.sobre && secao('Sobre', h('p', { class: 'predio-texto texto-livre' }, p.sobre)),
      !p.funcao && !p.pessoas.length && !p.info.length && !p.sobre && h('p', { class: 'suave predio-vazio' },
        podeEditar ? 'Ainda sem informações. Clique em "Editar" para contar para que serve, quem mora e quem trabalha aqui.' : 'Ainda sem informações sobre este lugar.'),
      p.atualizado_por_nome && p.atualizado_por_nome !== 'Sistema' && h('p', { class: 'predio-atualizado' }, `Atualizado por ${p.atualizado_por_nome} ${relativo(p.atualizado_em)}`));
    janela = modal({
      titulo: p.nome, corpo, tamanho: 'grande', classe: 'predio-modal',
      aoFechar: () => { if (selecionado === `p${p.id}`) { selecionado = null; acender(); } },
      rodape: [
        botao('Ver no mapa', { icone: 'mapa', onclick: () => { janela.fechar(); enquadrarPonto(p.x, p.y); selecionado = `p${p.id}`; acender(); } }),
        p.pagina && h('a', { class: 'btn', href: `#${p.pagina}`, onclick: () => janela.fechar() }, icone('frente'), h('span', null, `Abrir: ${PAGINAS[p.pagina] || p.pagina}`)),
        h('span', { class: 'espaco' }),
        podeEditar && botao('Editar', { icone: 'editar', classe: 'btn-ouro', onclick: () => { janela.fechar(); formularioPredio(p); } }),
      ],
    });
    // Setas do teclado passam as fotos.
    janela.caixa.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') mudar(-1);
      if (e.key === 'ArrowRight') mudar(1);
    });
    janela.caixa.tabIndex = -1;
    janela.caixa.focus({ preventScroll: true });
  }

  /* Casas */
  const casaPorId = id => casas.find(c => c.id === id);
  function desenharCasas() {
    // Cada casa é uma casinha de telhado: o telhado muda com a situação, e há mais de um jeito de telhado.
    trocar(camadaCasas, casas.map(c => {
      const sit = variantesDeCasa[c.situacao] ? c.situacao : 'ocupada';
      const v = c.id % variantesDeCasa[sit];
      return s('g', { class: `m-casa m-sit-${c.situacao}`, 'data-casa': c.id, transform: `translate(${c.x} ${c.y})`, role: 'img', 'aria-label': `${enderecoDaCasa(c)}, ${nomeDaCasa(c)}` },
        s('ellipse', { class: 'm-aro', cx: 0, cy: 0, rx: 10.5, ry: 9.5 }),
        s('rect', { class: 'm-hit', x: -8, y: -8, width: 16, height: 16 }),
        s('use', { href: `#c-${sit}-${v}` }),
        // Casa com ícone (ex.: uma lojinha) mostra o ícone na parede; as outras, o número.
        c.icone ? desenhoDoGlifo(c.icone, 0, 3.2, 6.2) : s('text', { y: 5.2 }, c.numero));
    }));
    desenharArvores();
    acender();
  }
  // As árvores ficam nos espaços vazios: elas saem do caminho das casas e dos prédios (que vêm do banco).
  function desenharArvores() {
    camadaArvores.innerHTML = arvoresSvg(casas, predios, portoes);
  }
  async function carregar() {
    const d = await get('/api/casas');
    casas = d.casas;
    predios = d.predios || [];
    portoes = d.portoes || [];
    nomes = d.nomes || [];
    podeEditar = d.podeEditar;
    usarPredios(predios);
    desenharPredios();
    desenharPortoes();
    desenharCasas();
    desenharListas();
    if (casaFixa && !casaPorId(casaFixa)) fecharFicha();
    else mostrarFicha();
  }

  // Mostra a ficha da casa fixa (clicada) ou, se não tiver, da que está sob o mouse.
  function mostrarFicha() {
    const c = casaPorId(casaFixa) || casaPorId(casaSobre);
    if (!c || (editando && !casaFixa)) { trocar(ficha); return; }
    trocar(ficha, fichaDaCasa(c, {
      fixa: !!casaFixa && c.id === casaFixa, podeEditar,
      aoFechar: fecharFicha,
      aoEditar: () => formularioCasa(c),
    }));
    posicionarFicha();
  }
  function posicionarFicha() {
    const el = ficha.firstElementChild;
    const c = casaPorId(casaFixa) || casaPorId(casaSobre);
    if (!el || !c) return;
    const [x, y] = naTela(c.x, c.y);
    const q = quadro.getBoundingClientRect();
    const w = el.offsetWidth;
    const alt = el.offsetHeight;
    const esquerda = x + 16 + w > q.width - 8 ? x - 16 - w : x + 16;
    el.style.left = `${Math.max(8, esquerda)}px`;
    el.style.top = `${Math.max(8, Math.min(q.height - alt - 8, y - 24))}px`;
  }
  function fixarCasa(id, { voar = false } = {}) {
    casaFixa = id;
    casaSobre = null;
    selecionado = null;
    info.hidden = true;
    acender();
    mostrarFicha();
    const c = casaPorId(id);
    if (voar && c) enquadrarPonto(c.x, c.y);
  }
  function fecharFicha() {
    casaFixa = null;
    acender();
    mostrarFicha();
  }

  /* Escolher pessoas do Tabelionato (casas e prédios) */
  // Onde cada pessoa já mora (outra casa ou prédio), para não ligar a mesma pessoa em dois lugares sem querer.
  function ondeMora(nome, { casa = null, predio = null } = {}) {
    const outra = casas.find(x => x.id !== casa?.id && (x.moradores || []).some(p => p.nome === nome));
    if (outra) return `mora na Casa ${outra.numero || 's/n'}${viaPorId(outra.via) ? ` (${viaPorId(outra.via).nome})` : ''}`;
    const pr = predios.find(x => x.id !== predio?.id && x.pessoas.some(p => p.papel === 'mora' && (p.registro?.nome || p.nome) === nome));
    return pr ? `mora em ${pr.nome}` : '';
  }
  let listaNomes = 0;
  function campoBuscaNome(opcoes = {}) {
    const id = `mapa-nomes-${++listaNomes}`;
    const lista = h('datalist', { id }, nomes.map(n => h('option', { value: n.nome }, [n.livro, ondeMora(n.nome, opcoes)].filter(Boolean).join(' · '))));
    const busca = h('input', { class: 'input', list: id, placeholder: 'Digite para procurar no Tabelionato...' });
    return { busca, lista };
  }

  /* Editar casas (quem tem o poder "mapa.editar") */
  function formularioCasa(c, base = {}) {
    const dados = { ...base, ...(c || {}) };
    const numero = h('input', { class: 'input', maxlength: '10', value: dados.numero || '', placeholder: 'Ex.: 02' });
    const via = h('select', { class: 'input' }, h('option', { value: '' }, 'Nenhuma (casa solta)'),
      VIAS.map(v => h('option', { value: v.id, selected: v.id === dados.via }, v.nome)));
    const ladoSel = h('select', { class: 'input' }, h('option', { value: '' }, '-'),
      h('option', { value: 'esquerda', selected: dados.lado === 'esquerda' }, 'Esquerda (oeste, ou em cima)'),
      h('option', { value: 'direita', selected: dados.lado === 'direita' }, 'Direita (leste, ou embaixo)'));
    const situacao = h('select', { class: 'input' }, Object.entries(SITUACAO).map(([k, t]) => h('option', { value: k, selected: k === (dados.situacao || 'ocupada') }, t)));
    const texto = h('input', { class: 'input', maxlength: '80', value: dados.texto || '', placeholder: 'Ex.: Layla Weeslay, Casa da Família Lombardi, Bar do Porto' });
    const icones = seletorDeIcone(dados.icone || '', { semIcone: true });
    // Quem mora: nomes escolhidos dos registros do Tabelionato.
    const escolhidos = [...(dados.pessoas || [])];
    const chips = h('div', { class: 'mapa-chips' });
    const { busca, lista } = campoBuscaNome({ casa: c });
    // Casa de família: sugere quem tem o sobrenome, mas só entra quem for clicado (nem todo mundo mora ali).
    const sugestoes = h('div', { class: 'mapa-sugestoes' });
    const desenharSugestoes = () => {
      const familia = normalizar(texto.value).match(/\bfamilia\s+(.+)$/);
      const sobrenome = familia ? familia[1].split(' ').filter(Boolean) : [];
      const achadas = sobrenome.length
        ? nomes.filter(n => !escolhidos.includes(n.nome) && sobrenome.every(w => normalizar(n.nome).split(' ').includes(w)))
        : [];
      trocar(sugestoes, achadas.length > 0 && [
        h('small', { class: 'suave' }, `Com o sobrenome ${familia[1].replace(/\b\w/g, l => l.toUpperCase())} no Tabelionato (clique em quem mora aqui):`),
        h('div', { class: 'mapa-chips' }, achadas.map(n => {
          const onde = ondeMora(n.nome, { casa: c });
          return h('button', {
            type: 'button', class: `chip mapa-sugestao ${onde ? 'mora-fora' : ''}`.trim(), title: onde || 'Adicionar',
            onclick: () => { escolhidos.push(n.nome); desenharChips(); },
          }, icone('mais'), n.nome, onde && h('small', null, onde));
        })),
      ]);
    };
    const desenharChips = () => {
      trocar(chips, escolhidos.length
        ? escolhidos.map((n, i) => h('span', { class: 'chip' }, n,
          h('button', { type: 'button', class: 'chip-x', title: `Tirar ${n}`, 'aria-label': `Tirar ${n}`, onclick: () => { escolhidos.splice(i, 1); desenharChips(); } }, icone('x'))))
        : h('small', { class: 'suave' }, /\bfamilia\b/.test(normalizar(texto.value))
          ? 'Ninguém escolhido. Casa de família não liga ninguém sozinha: escolha quem mora aqui.'
          : 'Ninguém escolhido: o mapa procura pelo nome da casa.'));
      desenharSugestoes();
    };
    const adicionar = () => {
      const v = busca.value.trim();
      if (!v || escolhidos.includes(v)) return;
      escolhidos.push(v);
      busca.value = '';
      desenharChips();
    };
    busca.addEventListener('change', adicionar);
    busca.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
    texto.addEventListener('input', desenharChips);
    desenharChips();
    let janela = null;
    const apagar = c && h('button', {
      class: 'btn btn-perigo', type: 'button', onclick: async () => {
        if (!await confirmar(`Tirar a ${enderecoDaCasa(c)} do mapa?`, { ok: 'Tirar', perigo: true })) return;
        if (await tentar(() => del(`/api/casas/${c.id}`), 'Casa tirada do mapa.')) {
          janela?.fechar();
          fecharFicha();
          await carregar();
        }
      },
    }, 'Tirar do mapa');
    janela = modalForm({
      titulo: c ? `Editar ${enderecoDaCasa(c)}` : 'Nova casa',
      conteudo: [
        h('div', { class: 'form-grade' }, campo('Número', numero), campo('Situação', situacao)),
        h('div', { class: 'form-grade' }, campo('Rua ou avenida', via), campo('Lado', ladoSel)),
        campo('Nome da casa', texto, { ajuda: 'O que aparece no mapa. Pode ser o morador, a família ou o comércio.' }),
        bloco('Quem mora (do Tabelionato)', h('div', { class: 'mapa-escolher' }, busca, lista, chips, sugestoes),
          'Escolha um ou mais registros de Moradores, Nobres ou Outros. A foto e os dados vêm de lá.'),
        h('details', { class: 'mapa-mais', open: !!dados.icone },
          h('summary', null, 'Ícone no mapa (opcional)'),
          bloco('', icones.el, 'Com um ícone (ex.: Loja ou Taverna), o quadradinho mostra o ícone em vez do número. O número continua na ficha.')),
      ],
      extraRodape: apagar,
      async aoEnviar() {
        const corpo = {
          numero: numero.value, via: via.value || null, lado: ladoSel.value || null, situacao: situacao.value, texto: texto.value,
          icone: icones.valor(), pessoas: escolhidos, x: dados.x, y: dados.y,
        };
        if (busca.value.trim() && !escolhidos.includes(busca.value.trim())) corpo.pessoas = [...escolhidos, busca.value.trim()];
        if (c) await put(`/api/casas/${c.id}`, corpo);
        else await post('/api/casas', corpo);
        await carregar();
      },
    });
  }

  /* Editar prédios: ícone, tamanho, fotos, quem mora e trabalha, para que serve e mais */
  function formularioPredio(p, base = {}) {
    const dados = { categoria: 'publico', tamanho: 'medio', fotos: [], pessoas: [], info: [], ...base, ...(p || {}) };
    const nome = h('input', { class: 'input', maxlength: '60', value: dados.nome || '', placeholder: 'Ex.: Senado, Taverna do Porto, Ferraria do Bram', required: true });
    const tipo = h('input', { class: 'input', maxlength: '80', value: dados.tipo || '', placeholder: 'Ex.: Templo, Castelo da Família Nobre Luckham, Taverna' });
    const categoria = h('select', { class: 'input' }, Object.entries(CATEGORIAS).map(([k, t]) => h('option', { value: k, selected: k === dados.categoria }, t)));
    const tamanho = h('select', { class: 'input' }, Object.entries(TAMANHOS).map(([k, t]) => h('option', { value: k, selected: k === dados.tamanho }, t)));
    const sub = h('input', { class: 'input', maxlength: '40', value: dados.sub || '', placeholder: 'Ex.: Castelo Luckham' });
    const pagina = h('select', { class: 'input' }, Object.entries(PAGINAS).map(([k, t]) => h('option', { value: k, selected: k === (dados.pagina || '') }, t)));
    const centro = h('input', { type: 'checkbox', checked: !!dados.centro });
    const funcao = h('textarea', { class: 'input', rows: 3, maxlength: '1000', placeholder: 'Ex.: Onde o Congresso se reúne e vota as leis.' }, dados.funcao || '');
    const sobre = h('textarea', { class: 'input', rows: 5, maxlength: '6000', placeholder: 'História, curiosidades, regras do lugar...' }, dados.sobre || '');
    const icones = seletorDeIcone(dados.icone || 'estrela');

    // Fotos: de fora (exterior) e de dentro (interior), com legenda, na ordem escolhida.
    const fotos = dados.fotos.map(f => ({ ...f }));
    const gradeFotos = h('div', { class: 'predio-fotos-editar' });
    const estadoEnvio = h('small', { class: 'campo-ajuda' });
    const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
    let tipoNovas = 'exterior';
    const desenharFotos = () => trocar(gradeFotos, fotos.map((f, i) => h('div', { class: 'predio-foto-editar' },
      h('img', { src: f.url, alt: '' }),
      h('select', { class: 'input', 'aria-label': 'De fora ou de dentro', onchange: e => { f.tipo = e.target.value; } },
        h('option', { value: 'exterior', selected: f.tipo !== 'interior' }, 'Por fora'),
        h('option', { value: 'interior', selected: f.tipo === 'interior' }, 'Por dentro')),
      h('input', { class: 'input', maxlength: '120', value: f.legenda || '', placeholder: 'Legenda (opcional)', 'aria-label': 'Legenda', oninput: e => { f.legenda = e.target.value; } }),
      h('div', { class: 'predio-foto-acoes' },
        botaoIcone('voltar', 'Mover para antes', () => { if (i > 0) { [fotos[i - 1], fotos[i]] = [fotos[i], fotos[i - 1]]; desenharFotos(); } }),
        botaoIcone('frente', 'Mover para depois', () => { if (i < fotos.length - 1) { [fotos[i + 1], fotos[i]] = [fotos[i], fotos[i + 1]]; desenharFotos(); } }),
        botaoIcone('lixo', 'Tirar esta foto', () => { fotos.splice(i, 1); desenharFotos(); })))));
    arquivo.addEventListener('change', async () => {
      const lista = [...arquivo.files].slice(0, Math.max(0, 24 - fotos.length));
      arquivo.value = '';
      for (const [k, f] of lista.entries()) {
        estadoEnvio.textContent = `Enviando foto ${k + 1} de ${lista.length}...`;
        try {
          fotos.push({ url: await enviarImagem(f), tipo: tipoNovas, legenda: '' });
          desenharFotos();
        } catch (e) {
          aviso(e.message, 'erro');
        }
      }
      estadoEnvio.textContent = fotos.length >= 24 ? 'Chegou ao máximo de 24 fotos.' : '';
    });
    const botaoFotos = tipoFoto => botao(tipoFoto === 'interior' ? 'Fotos de dentro' : 'Fotos de fora', {
      icone: 'imagem', classe: 'btn-pequeno', onclick: () => { tipoNovas = tipoFoto; arquivo.click(); },
    });
    desenharFotos();

    // Quem mora e quem trabalha (do Tabelionato, ou só o nome de quem não está lá).
    const pessoas = dados.pessoas.map(x => ({ nome: x.nome, papel: x.papel, funcao: x.funcao || '' }));
    const listaPessoas = h('div', { class: 'predio-pessoas-editar' });
    const { busca, lista } = campoBuscaNome({ predio: p });
    const papelNovo = h('select', { class: 'input', 'aria-label': 'Mora ou trabalha' },
      h('option', { value: 'trabalha' }, 'Trabalha aqui'), h('option', { value: 'mora' }, 'Mora aqui'));
    const desenharPessoas = () => trocar(listaPessoas, pessoas.length
      ? pessoas.map((x, i) => h('div', { class: 'predio-pessoa-linha' },
        h('span', { class: 'predio-pessoa-nome' }, avatar(x.nome, 'avatar-p'), x.nome),
        h('select', { class: 'input', 'aria-label': `${x.nome}: mora ou trabalha`, onchange: e => { x.papel = e.target.value; } },
          h('option', { value: 'trabalha', selected: x.papel !== 'mora' }, 'Trabalha'), h('option', { value: 'mora', selected: x.papel === 'mora' }, 'Mora')),
        h('input', { class: 'input', maxlength: '60', value: x.funcao, placeholder: 'Função (ex.: Taverneiro)', 'aria-label': `Função de ${x.nome}`, oninput: e => { x.funcao = e.target.value; } }),
        botaoIcone('x', `Tirar ${x.nome}`, () => { pessoas.splice(i, 1); desenharPessoas(); })))
      : h('small', { class: 'suave' }, 'Ninguém ainda.'));
    const adicionarPessoa = () => {
      const v = busca.value.trim();
      if (!v) return;
      if (!pessoas.some(x => x.nome === v && x.papel === papelNovo.value)) pessoas.push({ nome: v, papel: papelNovo.value, funcao: '' });
      busca.value = '';
      desenharPessoas();
    };
    busca.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarPessoa(); } });
    desenharPessoas();

    // Mais informações: pares "rótulo: valor" (ex.: Fundado em, Responsável, Horário).
    const info = dados.info.map(i => ({ ...i }));
    const listaInfo = h('div', { class: 'predio-info-editar' });
    const desenharInfo = () => trocar(listaInfo, info.map((x, i) => h('div', { class: 'predio-info-linha' },
      h('input', { class: 'input', maxlength: '40', value: x.rotulo, placeholder: 'Ex.: Fundado em', 'aria-label': 'Rótulo', oninput: e => { x.rotulo = e.target.value; } }),
      h('input', { class: 'input', maxlength: '300', value: x.valor, placeholder: 'Ex.: Ano 12 da Casa Luckham', 'aria-label': 'Valor', oninput: e => { x.valor = e.target.value; } }),
      botaoIcone('x', 'Tirar', () => { info.splice(i, 1); desenharInfo(); }))));
    desenharInfo();

    let janela = null;
    const apagar = p && h('button', {
      class: 'btn btn-perigo', type: 'button', onclick: async () => {
        if (!await confirmar(`Tirar "${p.nome}" do mapa? As fotos dele também são apagadas.`, { ok: 'Tirar', perigo: true })) return;
        if (await tentar(() => del(`/api/predios/${p.id}`), 'Prédio tirado do mapa.')) {
          janela?.fechar();
          await carregar();
        }
      },
    }, 'Tirar do mapa');
    janela = modalForm({
      titulo: p ? `Editar ${p.nome}` : 'Novo prédio ou ponto', tamanho: 'grande',
      conteudo: [
        h('div', { class: 'form-grade' }, campo('Nome', nome, { obrigatorio: true }), campo('O que é', tipo, { ajuda: 'Aparece embaixo do nome, na ficha.' })),
        h('div', { class: 'form-grade' }, campo('Categoria', categoria), campo('Tamanho no mapa', tamanho)),
        bloco('Ícone', icones.el),
        campo('Para que serve', funcao),
        bloco('Fotos', h('div', { class: 'predio-fotos-bloco' },
          gradeFotos,
          h('div', { class: 'predio-fotos-botoes' }, botaoFotos('exterior'), botaoFotos('interior'), arquivo),
          estadoEnvio), 'Fotos do lado de fora e de dentro (até 24). O site diminui as fotos antes de enviar.'),
        bloco('Quem mora e quem trabalha aqui', h('div', { class: 'mapa-escolher' },
          h('div', { class: 'predio-pessoa-nova' }, busca, lista, papelNovo,
            botao('Adicionar', { icone: 'mais', classe: 'btn-pequeno', onclick: adicionarPessoa })),
          listaPessoas), 'Procure no Tabelionato (a foto e os dados vêm de lá) ou escreva o nome de quem não está registrado.'),
        bloco('Mais informações', h('div', null, listaInfo,
          botao('Adicionar informação', { icone: 'mais', classe: 'btn-pequeno', onclick: () => { info.push({ rotulo: '', valor: '' }); desenharInfo(); listaInfo.querySelector('.predio-info-linha:last-child input')?.focus(); } }))),
        campo('Sobre', sobre, { ajuda: 'Texto livre: história, curiosidades, regras do lugar.' }),
        h('details', { class: 'mapa-mais' },
          h('summary', null, 'Mais opções'),
          h('div', { class: 'form-grade' },
            campo('Linha pequena no mapa', sub, { ajuda: 'Embaixo do nome, no mapa. Opcional.' }),
            campo('Abre uma tela do site', pagina, { ajuda: 'Ex.: o Senado abre o Congresso.' })),
          h('label', { class: 'mapa-check' }, centro, h('span', null, 'É o Centro da cidade (a estrela roxa)'))),
      ],
      extraRodape: apagar,
      async aoEnviar() {
        const pendente = busca.value.trim();
        if (pendente && !pessoas.some(x => x.nome === pendente)) pessoas.push({ nome: pendente, papel: papelNovo.value, funcao: '' });
        const corpo = {
          nome: nome.value, tipo: tipo.value, categoria: categoria.value, tamanho: tamanho.value, icone: icones.valor(),
          sub: sub.value, pagina: pagina.value, centro: centro.checked, funcao: funcao.value, sobre: sobre.value,
          fotos, pessoas, info: info.filter(i => i.rotulo.trim() && i.valor.trim()), x: dados.x, y: dados.y,
        };
        if (p) await put(`/api/predios/${p.id}`, corpo);
        else await post('/api/predios', corpo);
        await carregar();
        aviso(p ? 'Prédio salvo.' : 'Prédio colocado no mapa.');
      },
    });
  }

  /* Editar portões: nome, direção, para onde levam e um texto livre */
  function formularioPortao(g, base = {}) {
    const dados = { direcao: 'outro', nome: '', destino: '', sobre: '', ...base, ...(g || {}) };
    let sugerido = g ? '' : nomeSugerido(dados.direcao);
    const nome = h('input', { class: 'input', maxlength: '60', value: dados.nome || sugerido, placeholder: 'Ex.: Portão do Norte, Portão do Rio', required: true });
    const direcao = h('select', { class: 'input' }, Object.entries(DIRECOES).map(([k, t]) => h('option', { value: k, selected: k === dados.direcao }, t)));
    // Num portão novo, trocar a direção ajusta o nome sugerido (até a pessoa escrever outro).
    direcao.addEventListener('change', () => {
      if (g || (nome.value !== sugerido && nome.value.trim())) return;
      sugerido = nomeSugerido(direcao.value);
      nome.value = sugerido;
    });
    const destino = h('input', { class: 'input', maxlength: '80', value: dados.destino || '', placeholder: 'Ex.: Floresta de Vaelmoor, cidade de Argos' });
    const sobre = h('textarea', { class: 'input', rows: 4, maxlength: '600', placeholder: 'Quem guarda, quando abre, o que se diz desse caminho...' }, dados.sobre || '');
    let janela = null;
    const apagar = g && h('button', {
      class: 'btn btn-perigo', type: 'button', onclick: async () => {
        if (!await confirmar(`Tirar "${g.nome}" do mapa?`, { ok: 'Tirar', perigo: true })) return;
        if (await tentar(() => del(`/api/portoes/${g.id}`), 'Portão tirado do mapa.')) {
          janela?.fechar();
          if (selecionado === `g${g.id}`) selecionado = null;
          await carregar();
        }
      },
    }, 'Tirar do mapa');
    janela = modalForm({
      titulo: g ? `Editar ${g.nome}` : 'Novo portão',
      conteudo: [
        h('div', { class: 'form-grade' },
          campo('Nome', nome, { obrigatorio: true }),
          campo('Direção', direcao, { ajuda: 'Neste mapa o Norte fica embaixo e o Sul em cima.' })),
        campo('Para onde leva', destino, { ajuda: 'A cidade ou a região do outro lado. Aparece embaixo do nome, no mapa. Pode ficar vazio.' }),
        campo('Sobre o portão', sobre, { ajuda: 'Texto livre (até 600 letras).' }),
      ],
      extraRodape: apagar,
      async aoEnviar() {
        const corpo = { nome: nome.value, direcao: direcao.value, destino: destino.value, sobre: sobre.value, x: dados.x, y: dados.y };
        if (g) await put(`/api/portoes/${g.id}`, corpo);
        else await post('/api/portoes', corpo);
        await carregar();
        aviso(g ? 'Portão salvo.' : 'Portão colocado no mapa.');
      },
    });
  }

  function colarLista() {
    const area = h('textarea', { class: 'input', rows: 12, placeholder: 'Avenida Santa Menefreda\n\nEsquerda\nCasa 02 - Layla Weeslay\nCasa 04 - Casa da Família Lombardi\n\nDireita\nCasa 01 - Sem Dono\nCasa 03 - Noctis Caelum' });
    const via = h('select', { class: 'input' }, h('option', { value: '' }, 'Escolha a rua ou avenida'), VIAS.map(v => h('option', { value: v.id }, v.nome)));
    const substituir = h('input', { type: 'checkbox', checked: true });
    const resumo = h('p', { class: 'suave mapa-resumo-lista' }, 'Cole a lista acima.');
    const atualizar = () => {
      const l = lerLista(area.value);
      if (l.via && !via.value) via.value = l.via;
      const esq = l.casas.filter(x => x.lado === 'esquerda').length;
      resumo.textContent = l.casas.length
        ? `${l.casas.length} casas: ${esq} à esquerda e ${l.casas.length - esq} à direita.${l.ignoradas.length ? ` Linhas que não entendi: ${l.ignoradas.join(' | ')}` : ''}`
        : 'Nenhuma casa encontrada ainda. Cada casa numa linha: "Casa 02 - Nome".';
    };
    area.addEventListener('input', atualizar);
    modalForm({
      titulo: 'Colar a lista de uma rua', tamanho: 'medio', textoOk: 'Colocar no mapa',
      conteudo: [
        campo('Lista', area, { ajuda: 'Uma linha "Esquerda" ou "Direita" antes das casas de cada lado. Numa rua deitada, esquerda é o lado de cima.' }),
        campo('Rua ou avenida', via),
        h('label', { class: 'mapa-check' }, substituir, h('span', null, 'Tirar as casas que já estão nessa rua antes')),
        resumo,
      ],
      async aoEnviar() {
        const l = lerLista(area.value);
        const alvo = viaPorId(via.value);
        if (!alvo) throw new Error('Escolha a rua ou avenida.');
        if (!l.casas.length) throw new Error('Não achei nenhuma casa na lista. Cada casa numa linha: "Casa 02 - Nome".');
        const postas = distribuir(alvo, l.casas);
        const r = await post('/api/casas/lote', { via: alvo.id, nomeVia: alvo.nome, substituir: substituir.checked, casas: postas });
        aviso(`${r.criadas} casas colocadas na ${alvo.nome}.`);
        await carregar();
        selecionarVia(alvo.id, { voar: true });
      },
    });
  }

  function alternarEdicao(ligar = !editando) {
    editando = ligar;
    svg.classList.toggle('m-editando', editando);
    barraEdicao.hidden = !editando;
    botaoEditar.classList.toggle('btn-ouro', editando);
    trocar(botaoEditar, icone(editando ? 'check' : 'editar'), h('span', null, editando ? 'Terminar edição' : 'Editar mapa'));
    fecharFicha();
  }
  function escolherOQuePor(tipo) {
    porNoMapa = tipo;
    for (const b of seletorPor.querySelectorAll('button')) {
      b.classList.toggle('ativo', b.dataset.tipo === tipo);
      b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo));
    }
    trocar(textoEdicao, tipo === 'casa'
      ? 'Clique num lugar vazio para pôr uma casa (ela encosta alinhada na rua). Arraste para mudar de lugar e clique para editar.'
      : tipo === 'portao'
        ? 'Clique perto da muralha para pôr um portão (ele encaixa na muralha). Arraste um portão para mudar de lugar e clique para editar o nome e para onde leva.'
        : 'Clique num lugar vazio para pôr um prédio, uma loja ou outro ponto (com o ícone que quiser). Arraste para mudar de lugar e clique para editar.');
  }

  /* Mouse e dedo: arrastar o mapa, rodinha e pinça para o zoom, arrastar casa ou prédio no modo de edição */
  const toques = new Map();
  let arrasto = null;
  let moveu = false;
  let arrastando = null; // casa ou prédio sendo arrastado
  const dentroDoMapa = ([x, y]) => ({ x: Math.round(Math.min(VW - 10, Math.max(10, x)) * 2) / 2, y: Math.round(Math.min(VH - 10, Math.max(10, y)) * 2) / 2 });
  function arrastarLugar(e, el, { aoMover, aoSoltar }) {
    arrastando = { x: e.clientX, y: e.clientY, pos: null };
    moveu = false;
    const mover = ev => {
      if (Math.abs(ev.clientX - arrastando.x) + Math.abs(ev.clientY - arrastando.y) > 4) moveu = true;
      if (!moveu) return;
      arrastando.pos = aoMover(paraMapa(ev.clientX, ev.clientY));
      el.classList.add('m-arrastada');
    };
    const soltar = async () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      const { pos } = arrastando;
      arrastando = null;
      setTimeout(() => { moveu = false; }, 0);
      el.classList.remove('m-arrastada');
      if (pos) await aoSoltar(pos);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }
  svg.addEventListener('pointerdown', e => {
    const alvoCasa = e.target.closest?.('[data-casa]');
    const alvoPredio = e.target.closest?.('[data-predio]');
    if (editando && e.button === 0 && alvoCasa) {
      const c = casaPorId(Number(alvoCasa.dataset.casa));
      arrastarLugar(e, alvoCasa, {
        aoMover: ponto => {
          const pos = encaixar(ponto);
          alvoCasa.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
          return pos;
        },
        aoSoltar: async pos => {
          Object.assign(c, pos);
          if (await tentar(() => put(`/api/casas/${c.id}`, pos))) await carregar();
        },
      });
      return;
    }
    const alvoPortao = e.target.closest?.('[data-portao]');
    if (editando && e.button === 0 && alvoPortao) {
      const g = portaoPorId(alvoPortao.dataset.portao);
      arrastarLugar(e, alvoPortao, {
        // Perto da muralha o portão encaixa nela (e, se a direção era norte, sul, leste ou oeste, acompanha o lado).
        aoMover: ponto => {
          const m = pontoNaMuralha(ponto);
          const pos = m.dist < 34
            ? { x: m.x, y: m.y, direcao: g.direcao === 'outro' ? 'outro' : direcaoPeloLado(m.dentro) }
            : { ...dentroDoMapa(ponto), direcao: g.direcao };
          alvoPortao.setAttribute('transform', `translate(${um(pos.x - g.x)} ${um(pos.y - g.y)})`);
          return pos;
        },
        aoSoltar: async pos => {
          Object.assign(g, pos);
          if (await tentar(() => put(`/api/portoes/${g.id}`, pos))) await carregar();
        },
      });
      return;
    }
    if (editando && e.button === 0 && alvoPredio) {
      const p = predioPorId(alvoPredio.dataset.predio);
      arrastarLugar(e, alvoPredio, {
        aoMover: ponto => {
          const pos = dentroDoMapa(ponto);
          alvoPredio.setAttribute('transform', `translate(${um(pos.x - p.x)} ${um(pos.y - p.y)})`);
          return pos;
        },
        aoSoltar: async pos => {
          Object.assign(p, pos);
          if (await tentar(() => put(`/api/predios/${p.id}`, pos))) await carregar();
        },
      });
      return;
    }
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
  // Teclado: Enter ou espaço num prédio ou portão abre a ficha (ou o formulário, na edição).
  svg.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const predio = e.target.closest?.('[data-predio], [data-portao]');
    if (!predio) return;
    e.preventDefault();
    predio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.0015), paraMapa(e.clientX, e.clientY));
  }, { passive: false });
  svg.addEventListener('click', e => {
    if (moveu) return; // foi arrasto, não clique
    const casa = e.target.closest('[data-casa]');
    if (casa) {
      const c = casaPorId(Number(casa.dataset.casa));
      if (editando) formularioCasa(c);
      else fixarCasa(c.id);
      return;
    }
    const predio = e.target.closest('[data-predio]');
    if (predio) {
      const p = predioPorId(predio.dataset.predio);
      if (editando) formularioPredio(p);
      else abrirPredio(p);
      return;
    }
    const portao = e.target.closest('[data-portao]');
    if (portao) {
      const g = portaoPorId(portao.dataset.portao);
      if (editando) formularioPortao(g);
      else abrirPortao(g);
      return;
    }
    const alvo = e.target.closest('[data-id]');
    // Para pôr um portão o clique vale até em cima de uma rua: ele vai para o ponto mais perto da muralha.
    if (editando && (!alvo || porNoMapa === 'portao')) {
      const ponto = paraMapa(e.clientX, e.clientY);
      if (porNoMapa === 'portao') {
        const m = pontoNaMuralha(ponto);
        formularioPortao(null, { x: m.x, y: m.y, direcao: direcaoPeloLado(m.dentro) });
      } else if (porNoMapa === 'casa') formularioCasa(null, { ...encaixar(ponto), situacao: 'ocupada' });
      else formularioPredio(null, dentroDoMapa(ponto));
      return;
    }
    fecharFicha();
    selecionarVia(alvo ? alvo.dataset.id : null);
  });

  // Mouse em cima: o nome da via ou do prédio, ou a ficha da casa.
  svg.addEventListener('pointermove', e => {
    if (arrasto || arrastando) return;
    const casa = e.target.closest?.('[data-casa]');
    const idCasa = casa ? Number(casa.dataset.casa) : null;
    if (idCasa !== casaSobre) {
      casaSobre = idCasa;
      acender();
      if (!casaFixa) mostrarFicha();
    }
    const alvo = casa ? null : e.target.closest?.('[data-id]');
    realcar(alvo ? alvo.dataset.id : null);
    if (!alvo && !(casa && editando)) { dica.hidden = true; return; }
    const r = quadro.getBoundingClientRect();
    const predio = alvo?.dataset.predio ? predioPorId(alvo.dataset.predio) : null;
    const portao = alvo?.dataset.portao ? portaoPorId(alvo.dataset.portao) : null;
    dica.textContent = casa
      ? `${enderecoDaCasa(casaPorId(idCasa))} (clique para editar, arraste para mover)`
      : predio
        ? `${predio.nome}${editando ? ' (clique para editar, arraste para mover)' : ' (clique para ver)'}`
        : portao
          ? `${portao.nome}${portao.destino ? ` · leva a ${portao.destino}` : ''}${editando ? ' (clique para editar, arraste para mover)' : ' (clique para ver)'}`
          : viaDoItem.get(alvo.dataset.id)?.nome || '';
    dica.style.left = `${e.clientX - r.left}px`;
    dica.style.top = `${e.clientY - r.top}px`;
    dica.hidden = false;
  });
  svg.addEventListener('pointerleave', () => {
    dica.hidden = true;
    realcar(null);
    if (casaSobre) { casaSobre = null; acender(); if (!casaFixa) mostrarFicha(); }
  });

  const botaoEditar = h('button', { class: 'btn', type: 'button', onclick: () => alternarEdicao() });
  const textoEdicao = h('span');
  const seletorPor = h('div', { class: 'mapa-por', role: 'group', 'aria-label': 'O que pôr no mapa' },
    h('span', null, 'Pôr no mapa:'),
    [['casa', 'Casa', 'casa'], ['predio', 'Prédio ou ponto', 'coluna'], ['portao', 'Novo portão', 'torre']].map(([tipo, texto, ic]) => h('button', {
      type: 'button', class: 'filtro-chip', 'data-tipo': tipo, onclick: () => escolherOQuePor(tipo),
    }, iconeDoMapa(ic), texto)));
  const barraEdicao = h('div', { class: 'mapa-edicao', hidden: true },
    icone('editar'),
    seletorPor,
    textoEdicao,
    botao('Colar lista de uma rua', { icone: 'mais', classe: 'btn-ouro btn-pequeno', onclick: colarLista }));
  escolherOQuePor('casa');
  // No celular a chave do mapa (legenda) sai de dentro do desenho e vira uma caixa que abre e fecha.
  const chaveMovel = h('details', { class: 'mapa-chave' }, h('summary', null, 'Chave do mapa'),
    h('ul', null, ITENS_CHAVE.map(([tipo, texto]) => {
      const item = h('li', null, h('span', null, texto));
      item.insertAdjacentHTML('afterbegin', miniaturaDaChave(tipo));
      return item;
    })));
  const quadro = h('div', { class: 'mapa-quadro' }, svg, dica, info, ficha, barraEdicao, chaveMovel,
    h('div', { class: 'mapa-zoom' },
      h('button', { class: 'btn-icone', type: 'button', title: 'Aproximar', 'aria-label': 'Aproximar', onclick: () => zoom(1 / 1.5) }, icone('mais')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Afastar', 'aria-label': 'Afastar', onclick: () => zoom(1.5) }, h('span', { class: 'mapa-menos' }, '−')),
      h('button', { class: 'btn-icone', type: 'button', title: 'Ver a cidade inteira', 'aria-label': 'Ver a cidade inteira', onclick: () => voarPara([...VISTA]) }, icone('mapa'))));

  /* Embaixo do mapa: a busca e as listas lado a lado */
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar rua, prédio, loja, casa ou morador...', 'aria-label': 'Procurar no mapa' });
  const resumoCasas = h('p', { class: 'suave mapa-resumo' });
  const listas = h('div', { class: 'mapa-listas' });
  const marca = i => {
    if (i.tipo === 'predio') return h('span', { class: `mapa-num predio cat-${i.predio.categoria}` }, iconeDoMapa(i.predio.icone));
    if (i.tipo === 'portao') return h('span', { class: 'mapa-num predio cat-publico' }, iconeDoMapa('torre'));
    if (i.tipo === 'casa') return h('span', { class: `mapa-num casa sit-${i.casa.situacao}` }, i.casa.icone ? iconeDoMapa(i.casa.icone) : i.casa.numero);
    return h('span', { class: `mapa-num ${i.tipo}` }, i.n);
  };
  const itensDeCasa = () => casas.map(c => ({
    id: `casa-${c.id}`, tipo: 'casa', casa: c, nome: nomeDaCasa(c), sub: enderecoDaCasa(c),
    busca: normalizar([c.texto, c.numero, ...(c.moradores || []).map(p => p.nome), ...c.pessoas, viaPorId(c.via)?.nome].join(' ')),
  }));
  const itensDePredio = categoria => predios.filter(p => p.categoria === categoria)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(p => ({
      id: `p${p.id}`, tipo: 'predio', predio: p, nome: p.nome, sub: p.tipo,
      busca: normalizar([p.nome, p.tipo, p.sub, ...p.pessoas.map(x => x.registro?.nome || x.nome)].join(' ')),
    }));
  const itensDePortao = () => [...portoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(g => ({
    id: `g${g.id}`, tipo: 'portao', portao: g, nome: g.nome, sub: g.destino ? `Leva a ${g.destino}` : 'Destino a definir',
    busca: normalizar([g.nome, g.destino, g.sobre, 'portao muralha'].join(' ')),
  }));
  function desenharListas() {
    const q = normalizar(busca.value.trim());
    const n = sit => casas.filter(c => c.situacao === sit).length;
    resumoCasas.textContent = casas.length
      ? `${casas.length} casas no mapa: ${n('ocupada')} com morador, ${n('comercio')} comércios, ${n('sem_dono')} sem dono.`
      : 'Ainda não há casas no mapa.';
    const grupos = [
      ['Avenidas', ITENS_VIAS.filter(i => i.tipo === 'avenida')],
      ['Ruas', ITENS_VIAS.filter(i => i.tipo === 'rua')],
      ...GRUPOS_PREDIOS.map(([cat, titulo]) => [titulo, itensDePredio(cat), cat !== 'publico']),
      ['Portões da muralha', itensDePortao(), true],
    ];
    // As casas só aparecem na lista quando alguém procura (são muitas).
    if (q) grupos.push(['Casas', itensDeCasa()]);
    const blocos = grupos.map(([titulo, itens, someVazio]) => {
      const achados = itens.filter(i => !q || (i.busca || normalizar(i.nome)).includes(q));
      if ((q || someVazio) && !achados.length) return null; // grupo vazio nem aparece
      return h('div', { class: 'mapa-grupo' },
        h('h3', { class: 'mapa-sub' }, titulo),
        achados.length
          ? h('ul', { class: 'mapa-lista' }, achados.slice(0, 40).map(i => h('li', null,
            h('button', {
              class: `mapa-item ${i.id === selecionado || i.id === `casa-${casaFixa}` ? 'ativa' : ''}`.trim(), type: 'button', 'data-item': i.id,
              onclick: () => {
                if (i.tipo === 'casa') fixarCasa(i.casa.id, { voar: true });
                else if (i.tipo === 'predio') abrirPredio(i.predio, { voar: true });
                else if (i.tipo === 'portao') abrirPortao(i.portao, { voar: true });
                else selecionarVia(i.id, { voar: true });
                if (i.tipo !== 'predio' && i.tipo !== 'portao') quadro.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              },
              onmouseenter: () => (i.tipo === 'casa' ? null : realcar(i.id)),
              onmouseleave: () => realcar(null),
            }, marca(i), h('span', null, i.nome, i.sub && h('small', null, i.sub))))))
          : h('p', { class: 'suave mapa-nada' }, 'Nada ainda.'));
    }).filter(Boolean);
    trocar(listas, blocos.length ? blocos : h('p', { class: 'suave mapa-nada' }, 'Nada com esse nome no mapa.'));
  }
  busca.addEventListener('input', desenharListas);
  const lado = h('section', { class: 'painel mapa-lado' }, h('div', { class: 'mapa-busca' }, busca, resumoCasas), listas);

  async function baixarImagem() {
    try {
      const copia = svg.cloneNode(true);
      copia.querySelectorAll('.ativa').forEach(el => el.classList.remove('ativa'));
      copia.classList.remove('m-editando');
      copia.setAttribute('viewBox', VISTA.join(' '));
      copia.setAttribute('width', VW * 2);
      copia.setAttribute('height', VH * 2);
      copia.setAttribute('xmlns', NS);
      // A imagem solta não enxerga as fontes da página (e a segurança do site não deixa baixá-las daqui):
      // o texto sai na fonte de reserva (serifa clássica) e as larguras são fixas, então nada se desencaixa.
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
      if (!png) throw new Error('sem imagem');
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

  await carregar();
  alternarEdicao(false);
  const pagina = h('div', { class: 'pagina mapa' },
    cabecalho({
      titulo: 'Mapa de Lyendell', icone: 'mapa',
      sub: 'A capital vista de cima. Arraste para andar, use a rodinha ou os botões para o zoom. Clique num prédio para ver fotos e quem está lá; passe o mouse numa casa para ver quem mora.',
      acoes: [podeEditar && botaoEditar, botao('Baixar imagem', { icone: 'baixar', onclick: baixarImagem })].filter(Boolean),
    }),
    quadro, lado);
  // A ficha acompanha o mapa quando a janela muda de tamanho.
  const aoRedimensionar = () => posicionarFicha();
  window.addEventListener('resize', aoRedimensionar);
  aoSair(() => window.removeEventListener('resize', aoRedimensionar));
  return pagina;
}
