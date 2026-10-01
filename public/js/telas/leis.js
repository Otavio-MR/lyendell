// Leis de Lyendell para ler. Quem escreve as leis (o Lorde Comandante e a Família Nobre) usa os livros
// em /leis/livros, como nos outros módulos. Todo o resto da cidade vê esta tela: as leis arrumadas como
// um código, separadas por tipo, com índice, busca, a pena em destaque e as revogadas guardadas no fim.
// Funciona com qualquer livro de leis ou regras: os papéis dos campos (título, tipo, texto, pena...)
// são achados pelo tipo e pelo nome do campo.

import { get, h, trocar, icone, cabecalho, vazio, botao, dataCurta, relativo, normalizar, estado, podeAlgum, num, aviso, textoDuracao, listaDeNomes, ehCrianca } from '../core.js';
import { livroDeRegistro, livroDeRegistros } from '../livro-mc.js';

const TITULO = 'Leis de Lyendell';
const DIAS_NOVA = 7;
const TEXTO_LONGO = 700; // acima disso a lei começa recolhida ("Ler a lei inteira")

export const podeGerenciarLeis = () => podeAlgum('leis.registrar', 'leis.editar', 'leis.configurar', 'leis.aprovar');

// Quem escreve as leis vê os livros (para escrever, editar e revogar); os outros, a leitura.
export const gerenciaLeis = (gerenciar, ler = () => leis()) => (podeGerenciarLeis() ? gerenciar() : ler());

/* ─── Os papéis dos campos de um livro ────────────── */

function papeisDoLivro(livro) {
  const campos = livro.campos.filter(c => c.tipo !== 'secao');
  const nome = c => normalizar(c.nome);
  const achar = (teste, ...tipos) => campos.find(c => (!tipos.length || tipos.includes(c.tipo)) && teste(nome(c)));
  const p = {};
  p.titulo = campos.find(c => c.tipo === 'texto');
  p.tipo = achar(n => /^tipo/.test(n), 'selecao');
  p.situacao = achar(n => /situacao|status|vigencia/.test(n), 'selecao');
  p.texto = campos.find(c => c.tipo === 'texto_longo');
  p.pena = achar(n => /pena|punicao|multa|castigo/.test(n), 'texto', 'texto_longo');
  p.autoria = achar(n => /feita por|autor|quem (fez|propos|escreveu)/.test(n), 'selecao', 'texto', 'referencia');
  const datas = campos.filter(c => c.tipo === 'data');
  p.vigor = datas.find(c => /vigor|partir|vale/.test(nome(c)));
  p.data = datas.find(c => c !== p.vigor);
  p.imagem = campos.find(c => c.tipo === 'imagem');
  const usados = new Set(Object.values(p).filter(Boolean));
  p.outros = campos.filter(c => !usados.has(c) && c.tipo !== 'imagem');
  return p;
}

// "Em vigor" (ou sem situação), "suspensa" (vale, mas parada) ou "fora" (revogada, arquivada...).
function estadoDaLei(valor) {
  const v = normalizar(valor);
  if (!v || /vigor|ativa|valendo|aprovada/.test(v)) return 'vigor';
  if (/suspens|aguard|adiad/.test(v)) return 'suspensa';
  return 'fora';
}

const plural = t => {
  const n = normalizar(t);
  if (n.endsWith('cao')) return `${t.slice(0, -3)}ções`;
  if (n.endsWith('al')) return `${t.slice(0, -2)}ais`;
  if (n.endsWith('s')) return t;
  return `${t}s`;
};

const paraData = s => new Date(/T|Z/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
const quandoSaiu = r => r.revisado_em || r.criado_em;
const ehNova = r => quandoSaiu(r) && Date.now() - paraData(quandoSaiu(r)).getTime() < DIAS_NOVA * 864e5;

function valorDe(c, dados) {
  const v = dados[c.id];
  if (c.tipo === 'duracao') return textoDuracao(c, dados);
  if (v == null || v === '') return '';
  switch (c.tipo) {
    case 'data': return dataCurta(v);
    case 'sim_nao': return v ? 'Sim' : 'Não';
    case 'numero': return num(v);
    case 'referencia': return listaDeNomes(v).join(', ');
    default: return String(v);
  }
}

/* ─── Texto: parágrafos, listas e o termo procurado em destaque ─ */

// Cada caractere sem acento, um por um (para achar "proibicao" em "Proibição" sem perder as posições).
const semAcentoPorLetra = s => [...s].map(ch => normalizar(ch)[0] ?? ch).join('');

function realcar(texto, termo) {
  const s = String(texto ?? '');
  if (!termo) return s;
  const base = semAcentoPorLetra(s);
  const letras = [...s];
  if (base.length !== letras.length) return s;
  const saida = [];
  let i = 0;
  for (let k = base.indexOf(termo); k >= 0; k = base.indexOf(termo, k + termo.length)) {
    if (k > i) saida.push(letras.slice(i, k).join(''));
    saida.push(h('mark', null, letras.slice(k, k + termo.length).join('')));
    i = k + termo.length;
  }
  if (!saida.length) return s;
  if (i < letras.length) saida.push(letras.slice(i).join(''));
  return saida;
}

const MARCA_LISTA = /^([-•*–]|\d+[.)º°]|[a-z][.)])\s+/i;

function paragrafos(texto, termo) {
  return String(texto ?? '').split(/\n\s*\n/).map(bloco => {
    const linhas = bloco.split('\n').map(l => l.trim()).filter(Boolean);
    if (!linhas.length) return null;
    // Linhas que começam com "-", "1." ou "a)" viram uma lista.
    if (linhas.length > 1 && linhas.every(l => MARCA_LISTA.test(l))) {
      const numerada = /^\d/.test(linhas[0]);
      return h(numerada ? 'ol' : 'ul', { class: 'lei-lista' }, linhas.map(l => h('li', null, realcar(l.replace(MARCA_LISTA, ''), termo))));
    }
    return h('p', null, realcar(linhas.join('\n'), termo));
  });
}

/* ─── A tela ──────────────────────────────────────── */

// livroId e regId: abrir já num livro e numa lei (ex.: vindo das novidades da tela de início).
export async function leis(livroId = null, regId = null) {
  const d = await get('/api/modulos/leis/leitura');
  const raiz = h('div', { class: 'pagina leis-ler' });
  let livro = d.livros.find(l => l.id === Number(livroId)) || d.livros.find(l => l.registros.length) || d.livros[0];
  let termo = '';
  let tipoEscolhido = '';
  let mostrarFora = false;
  const abertas = new Set(); // leis compridas que a pessoa abriu inteiras
  // O índice fica aberto ao lado no computador; no celular começa fechado, em cima das leis.
  let indiceAberto = matchMedia('(min-width: 961px)').matches;

  const gerenciar = d.gerenciar && h('a', { class: 'btn btn-ouro', href: '#/leis/livros' }, icone('editar'), h('span', null, 'Escrever e editar leis'));
  if (!d.livros.length || !d.livros.some(l => l.registros.length)) {
    trocar(raiz,
      cabecalho({ titulo: TITULO, icone: 'balanca', sub: 'As leis da capital, feitas pelo Lorde Comandante e pela Família Nobre.', acoes: [gerenciar] }),
      ehCrianca()
        ? vazio('Ainda não tem regra nenhuma', 'Então pode tudo? Melhor perguntar para um grande antes...')
        : vazio('Nenhuma lei publicada ainda', 'Quando o Lorde Comandante ou a Família Nobre publicarem uma lei, ela aparece aqui, arrumada para ler.'));
    return raiz;
  }

  const busca = h('input', {
    class: 'input', type: 'search', placeholder: ehCrianca() ? 'Procurar uma regra...' : 'Procurar nas leis: imposto, toque de recolher, prisão...', 'aria-label': 'Procurar nas leis',
    oninput: () => { termo = semAcentoPorLetra(busca.value.trim().toLowerCase()); desenharConteudo(); },
  });
  const abasLivros = h('nav', { class: 'abas leis-abas', 'aria-label': 'Livros de leis' });
  const capa = h('section', { class: 'leis-capa' });
  const filtros = h('div', { class: 'leis-filtros' });
  const conteudo = h('div', { class: 'leis-corpo' });

  function leisDoLivro() {
    const p = papeisDoLivro(livro);
    return livro.registros.map(r => {
      const tipo = p.tipo ? String(r.dados[p.tipo.id] || '') : '';
      const titulo = p.titulo ? String(r.dados[p.titulo.id] || '') : '';
      const textoTodo = [titulo, tipo, ...livro.campos.filter(c => c.tipo !== 'imagem' && c.tipo !== 'secao').map(c => valorDe(c, r.dados))].join(' ');
      return {
        r, tipo, titulo: titulo || `Nº ${r.numero}`,
        estado: estadoDaLei(p.situacao ? r.dados[p.situacao.id] : ''),
        situacao: p.situacao ? String(r.dados[p.situacao.id] || '') : '',
        busca: semAcentoPorLetra(textoTodo.toLowerCase()),
      };
    });
  }

  function desenharAbas() {
    trocar(abasLivros, d.livros.length > 1 && d.livros.map(l => h('button', {
      type: 'button', class: `aba ${l === livro ? 'ativa' : ''}`.trim(), 'aria-pressed': String(l === livro),
      onclick: () => { livro = l; tipoEscolhido = ''; abertas.clear(); desenharTudo(); },
    }, icone(l.icone || 'balanca'), l.nome, h('span', { class: 'aba-n' }, l.registros.length))));
  }

  function desenharCapa() {
    const todas = leisDoLivro();
    const vigor = todas.filter(x => x.estado !== 'fora').length;
    const novas = todas.filter(x => ehNova(x.r)).length;
    const ultima = todas.map(x => x.r.atualizado_em || quandoSaiu(x.r)).filter(Boolean).sort().pop();
    trocar(capa,
      h('div', { class: 'leis-capa-selo' }, icone(livro.icone || 'balanca')),
      h('div', { class: 'leis-capa-texto' },
        (d.livros.length > 1 || livro.nome !== TITULO) && h('h2', null, livro.nome),
        livro.descricao && h('p', null, livro.descricao),
        h('p', { class: 'leis-capa-numeros' },
          h('span', null, h('strong', null, vigor), ehCrianca() ? ' valendo' : ' em vigor'),
          todas.length > vigor && h('span', null, h('strong', null, todas.length - vigor), todas.length - vigor === 1 ? ' revogada' : ' revogadas'),
          novas > 0 && h('span', { class: 'leis-capa-novas' }, h('strong', null, novas), novas === 1 ? ' nova nesta semana' : ' novas nesta semana'),
          ultima && h('span', null, `atualizado ${relativo(ultima)}`))),
      botao('Baixar .book', {
        icone: 'baixar', classe: 'btn-pequeno', titulo: 'Baixa todas as leis em vigor como um livro do Minecraft (mod Scribble)',
        onclick: () => {
          const lista = todas.filter(x => x.estado !== 'fora').map(x => x.r);
          if (!lista.length) return aviso('Não há leis em vigor para colocar no livro.', 'erro');
          livroDeRegistros(TITULO, livro, lista, estado.eu.nome).baixar();
        },
      }));
  }

  function desenharConteudo() {
    const p = papeisDoLivro(livro);
    const todas = leisDoLivro();
    const achadas = todas.filter(x => !termo || x.busca.includes(termo));
    const doTipo = achadas.filter(x => !tipoEscolhido || x.tipo === tipoEscolhido);
    const visiveis = doTipo.filter(x => x.estado !== 'fora');
    const fora = doTipo.filter(x => x.estado === 'fora');

    // Filtro por tipo: só os tipos que existem (com a contagem do que está em vigor).
    const ordemTipos = [...(p.tipo?.opcoes || []), ...new Set(todas.map(x => x.tipo))].filter((t, i, a) => t && a.indexOf(t) === i);
    const contagem = t => achadas.filter(x => x.estado !== 'fora' && (!t || x.tipo === t)).length;
    trocar(filtros,
      h('label', { class: 'busca leis-busca' }, icone('busca'), busca),
      ordemTipos.length > 1 && h('div', { class: 'filtro-chips', role: 'group', 'aria-label': 'Filtrar por tipo' },
        ['', ...ordemTipos.filter(t => todas.some(x => x.tipo === t))].map(t => h('button', {
          type: 'button', class: `filtro-chip ${tipoEscolhido === t ? 'ativo' : ''}`.trim(), 'aria-pressed': String(tipoEscolhido === t),
          onclick: () => { tipoEscolhido = t; desenharConteudo(); },
        }, t ? plural(t) : 'Todas', h('span', null, contagem(t))))));

    if (!visiveis.length && !fora.length) {
      trocar(conteudo, h('p', { class: 'leis-nada' }, termo ? 'Nenhuma lei fala disso.' : 'Nenhuma lei desse tipo ainda.'));
      return;
    }

    // Grupos por tipo (na ordem das opções do livro), cada um com as leis em ordem de número.
    const grupos = [];
    for (const t of [...ordemTipos, '']) {
      const itens = visiveis.filter(x => x.tipo === t);
      if (itens.length) grupos.push({ t, itens });
    }
    const comTitulos = grupos.length > 1 || (grupos[0] && grupos[0].t);
    const indice = h('details', { class: 'leis-indice', open: indiceAberto, 'aria-label': 'Índice das leis', ontoggle: e => { indiceAberto = e.currentTarget.open; } },
      h('summary', { class: 'leis-indice-titulo' }, 'Índice', icone('baixo')),
      grupos.map(g => h('div', { class: 'leis-indice-grupo' },
        comTitulos && h('p', { class: 'leis-indice-tipo' }, g.t ? plural(g.t) : 'Outras'),
        h('ol', null, g.itens.map(x => h('li', null, h('a', {
          href: `#/leis/${livro.id}/registro/${x.r.id}`,
          onclick: e => { e.preventDefault(); irPara(x.r.id); },
        }, h('span', { class: 'leis-indice-num' }, x.r.numero), h('span', null, x.titulo), ehNova(x.r) && h('em', null, 'nova'))))))),
      fora.length > 0 && h('p', { class: 'leis-indice-tipo leis-indice-fora' },
        h('button', { type: 'button', onclick: () => { mostrarFora = !mostrarFora; desenharConteudo(); } },
          `${mostrarFora ? 'Esconder' : 'Ver'} ${fora.length === 1 ? 'a revogada' : `as ${fora.length} revogadas`}`)));

    const textoDasLeis = h('div', { class: 'leis-texto' },
      grupos.map(g => h('section', { class: 'leis-grupo' },
        comTitulos && h('h2', { class: 'leis-grupo-titulo' }, g.t ? plural(g.t) : 'Outras', h('span', null, g.itens.length)),
        g.itens.map(x => artigo(x, p)))),
      !visiveis.length && h('p', { class: 'leis-nada' }, 'Nenhuma lei em vigor fala disso.'),
      fora.length > 0 && h('section', { class: 'leis-grupo leis-fora' },
        h('button', {
          type: 'button', class: 'leis-fora-botao', 'aria-expanded': String(mostrarFora),
          onclick: () => { mostrarFora = !mostrarFora; desenharConteudo(); },
        }, icone(mostrarFora ? 'cima' : 'baixo'),
        h('span', null, ehCrianca() ? `Regras que não valem mais, ufa! (${fora.length})` : `Revogadas e fora de vigor (${fora.length})`),
        h('small', null, mostrarFora ? 'Esconder' : ehCrianca() ? 'Agora pode!' : 'Não valem mais. Ficam aqui para consulta.')),
        mostrarFora && fora.map(x => artigo(x, p))));
    trocar(conteudo, indice, textoDasLeis);
  }

  function artigo(x, p) {
    const { r } = x;
    const dados = r.dados;
    const texto = p.texto ? String(dados[p.texto.id] || '') : '';
    const comprida = texto.length > TEXTO_LONGO && !termo && !abertas.has(r.id);
    const pena = p.pena ? valorDe(p.pena, dados) : '';
    const outros = p.outros.map(c => [c, valorDe(c, dados)]).filter(([, v]) => v);
    // Ex.: "Feita por Lorde Comandante em 20/09/2026 · vale a partir de 25/09/2026".
    const autoria = p.autoria && valorDe(p.autoria, dados);
    const quando = p.data && dados[p.data.id] && dataCurta(dados[p.data.id]);
    const rotuloData = p.data && (/^data$/i.test(p.data.nome.replace(/:$/, '').trim()) ? 'Feita em' : `${p.data.nome.replace(/:$/, '')}:`);
    const meta = [
      autoria ? `${p.autoria.nome.replace(/:$/, '')} ${autoria}${quando ? ` em ${quando}` : ''}` : quando && `${rotuloData} ${quando}`,
      p.vigor && dados[p.vigor.id] && dados[p.vigor.id] !== dados[p.data?.id] && `vale a partir de ${dataCurta(dados[p.vigor.id])}`,
    ].filter(Boolean);
    const corpoTexto = h('div', { class: `lei-corpo ${comprida ? 'recolhida' : ''}`.trim() }, paragrafos(texto, termo));
    return h('article', { class: `lei lei-${x.estado}`, id: `lei-${r.id}` },
      h('header', { class: 'lei-cab' },
        h('p', { class: 'lei-sobre' },
          h('span', { class: 'lei-num' }, `Nº ${r.numero}`),
          x.tipo && h('span', { class: 'lei-tipo' }, x.tipo),
          ehNova(r) && h('span', { class: 'lei-selo lei-selo-nova' }, 'Nova'),
          x.estado !== 'vigor' && x.situacao && h('span', { class: `lei-selo lei-selo-${x.estado}` }, x.situacao)),
        h('h3', { class: 'lei-titulo' }, realcar(x.titulo, termo)),
        meta.length > 0 && h('p', { class: 'lei-meta' }, meta.join(' · '))),
      texto && corpoTexto,
      comprida && h('button', {
        type: 'button', class: 'lei-continuar',
        onclick: () => { abertas.add(r.id); corpoTexto.classList.remove('recolhida'); document.querySelector(`#lei-${r.id} .lei-continuar`)?.remove(); },
      }, 'Ler a lei inteira', icone('baixo')),
      pena && h('div', { class: 'lei-pena', role: 'note' }, icone('alerta'),
        h('p', null, h('strong', null, ehCrianca() ? 'Quem desobedecer fica de castigo assim: ' : 'Quem descumprir: '), realcar(pena, termo))),
      outros.length > 0 && h('dl', { class: 'lei-mais' }, outros.map(([c, v]) => h('div', null, h('dt', null, c.nome.replace(/:$/, '')),
        h('dd', { class: c.tipo === 'texto_longo' ? 'texto-livre' : '' }, realcar(v, termo))))),
      h('footer', { class: 'lei-rodape' },
        p.imagem && dados[p.imagem.id] && h('a', { class: 'lei-acao', href: dados[p.imagem.id], target: '_blank', rel: 'noopener' }, icone('imagem'), 'Documento original'),
        h('button', {
          type: 'button', class: 'lei-acao', title: 'Copiar o link desta lei para mandar a alguém',
          onclick: async () => {
            const link = `${location.origin}${location.pathname}#/leis/${livro.id}/registro/${r.id}`;
            try { await navigator.clipboard.writeText(link); aviso('Link da lei copiado.'); } catch { aviso(link); }
          },
        }, icone('alfinete'), 'Copiar link'),
        h('button', {
          type: 'button', class: 'lei-acao', title: 'Baixar esta lei como um livro do Minecraft (mod Scribble)',
          onclick: () => livroDeRegistro(TITULO, livro, r, estado.eu.nome).baixar(),
        }, icone('baixar'), '.book')));
  }

  function irPara(id) {
    let el = document.getElementById(`lei-${id}`);
    if (!el) {
      // Revogada escondida, ou fora do filtro: mostra tudo antes de ir.
      tipoEscolhido = '';
      termo = '';
      busca.value = '';
      mostrarFora = true;
      desenharConteudo();
      el = document.getElementById(`lei-${id}`);
    }
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('lei-piscar');
    void el.offsetWidth;
    el.classList.add('lei-piscar');
  }

  function desenharTudo() {
    desenharAbas();
    desenharCapa();
    desenharConteudo();
  }

  trocar(raiz,
    cabecalho({ titulo: TITULO, icone: 'balanca', sub: 'O que vale na capital. Procure pelo assunto, filtre pelo tipo ou siga o índice.', acoes: [gerenciar] }),
    abasLivros, capa, filtros, conteudo);
  desenharTudo();
  if (regId) requestAnimationFrame(() => setTimeout(() => irPara(Number(regId)), 60));
  return raiz;
}
