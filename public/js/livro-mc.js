// Gera arquivos .book para o mod Scribble (Minecraft 1.21).
// Formato: NBT sem compressão com "pages" (lista de textos), "author" e "title",
// igual aos livros salvos pelo próprio Scribble. As páginas usam códigos de cor (§).

import { dataCurta, dataHora, num, pacotes } from './core.js';

/* ─── Métricas da fonte do Minecraft ──────────────── */

// Página de livro: 114px de largura útil e 14 linhas. Larguras já com 1px de espaçamento.
const LARGURA = 114;
const LINHAS = 14;
const MAX_PAGINAS = 100;
const RE_ACENTO = /[̀-ͯ]/g;
const GL = {
  ' ': 4, '!': 2, '"': 5, '#': 6, $: 6, '%': 6, '&': 6, "'": 3,
  '(': 5, ')': 5, '*': 5, '+': 6, ',': 2, '-': 6, '.': 2, '/': 6,
  ':': 2, ';': 2, '<': 5, '=': 6, '>': 5, '?': 6, '@': 7,
  '[': 4, '\\': 6, ']': 4, '^': 6, _: 6, '`': 3,
  '{': 5, '|': 2, '}': 5, '~': 7,
  I: 4, f: 5, i: 2, k: 5, l: 3, t: 4,
  '´': 3, '°': 5, 'ª': 5, 'º': 5, '…': 6, '“': 5, '”': 5, '‘': 3, '’': 3,
};

function larguraChar(c) {
  if (Object.hasOwn(GL, c)) return GL[c];
  const base = c.normalize('NFD').replace(RE_ACENTO, '');
  if (base && base !== c && Object.hasOwn(GL, base[0])) return GL[base[0]];
  return 6;
}

function largura(s, negrito = false) {
  let t = 0;
  for (const c of s) t += larguraChar(c) + (negrito ? 1 : 0);
  return t;
}

// Quebra um parágrafo em linhas que cabem na página.
function quebrar(textoBruto, negrito = false) {
  const texto = textoBruto.replace(/\s+$/, '');
  if (!texto) return [''];
  const saida = [];
  let atual = '';
  let larg = 0;
  for (let p of texto.split(/(\s+)/)) {
    if (!p) continue;
    const espaco = /^\s+$/.test(p);
    const w = largura(p, negrito);
    if (espaco && !atual) continue;
    if (larg + w <= LARGURA) { atual += p; larg += w; continue; }
    if (espaco) { saida.push(atual.trimEnd()); atual = ''; larg = 0; continue; }
    if (atual) { saida.push(atual.trimEnd()); atual = ''; larg = 0; }
    while (largura(p, negrito) > LARGURA) {
      let corte = '';
      let cw = 0;
      for (const c of p) {
        const x = larguraChar(c) + (negrito ? 1 : 0);
        if (cw + x > LARGURA) break;
        corte += c;
        cw += x;
      }
      if (!corte) corte = p[0];
      saida.push(corte);
      p = p.slice(corte.length);
    }
    atual = p;
    larg = largura(p, negrito);
  }
  if (atual.trim()) saida.push(atual.trimEnd());
  return saida.length ? saida : [''];
}

/* ─── Linhas e ornamentos (no estilo dos livros da Casa) ─ */

// Cores do Minecraft: 0 preto, 2 verde escuro, 4 vermelho escuro, 6 dourado, 8 cinza, c vermelho.
const ORN = {
  caixaTopo: '╔════════════════════╗',
  caixaBase: '╚════════════════════╝',
  estrela: '✦ ────────────── ✦',
  secaoTopo: '╔────── ✦ ──────╗',
  secaoBase: '╚────── ✦ ──────╝',
};

const L = (t = '', cor = '0', opcoes = {}) => ({ t, cor, ...opcoes });
const vazia = () => L('');

// Texto livre (com quebras de linha) virando linhas do livro.
function texto(valor, cor = '0', { negrito = false, centro = false } = {}) {
  const linhas = [];
  for (const par of String(valor ?? '').split('\n')) {
    for (const t of quebrar(par, negrito)) linhas.push(L(t, cor, { n: negrito, centro }));
  }
  return linhas;
}

function renderizar(l) {
  if (!l.t) return '';
  let recuo = '';
  if (l.centro) {
    const sobra = Math.max(0, LARGURA - largura(l.t, l.n));
    recuo = ' '.repeat(Math.floor(sobra / 2 / 4));
  }
  return `§${l.cor}${recuo}${l.n ? '§l' : ''}${l.t}`;
}

const cabecalhoSecao = nome => [
  vazia(),
  L(ORN.secaoTopo, '4'),
  ...texto(nome.toUpperCase(), 'c', { centro: true }),
  L(ORN.secaoBase, '4'),
];

// "Rótulo:" em vermelho escuro e o valor em preto, como numa ficha.
const campoLinhas = (rotulo, valor) => [vazia(), ...texto(`${rotulo}:`, '4'), ...texto(valor, '0')];

/* ─── Montagem das páginas ────────────────────────── */

class LivroMC {
  constructor(titulo, autor) {
    this.titulo = titulo;
    this.autor = autor;
    this.blocos = [];
  }

  // Página própria; se passar de 14 linhas, as linhas em branco somem primeiro.
  capa(linhas) {
    const l = [...linhas];
    while (l.length > LINHAS) {
      const i = l.findLastIndex(x => !x.t);
      if (i < 0) break;
      l.splice(i, 1);
    }
    this.blocos.push({ linhas: l.slice(0, LINHAS), sozinha: true, novaPagina: true });
    return this;
  }

  // junto: não quebra o bloco entre páginas se couber inteiro numa página.
  // comProximo: o bloco só entra na página se o começo do bloco seguinte também couber (títulos de seção).
  bloco(linhas, { junto = true, novaPagina = false, comProximo = false } = {}) {
    this.blocos.push({ linhas, junto, novaPagina, comProximo });
    return this;
  }

  paginas() {
    const paginas = [];
    let atual = [];
    const fechar = () => {
      while (atual.length && !atual[atual.length - 1].t) atual.pop();
      if (atual.length) paginas.push(atual);
      atual = [];
    };
    this.blocos.forEach((b, i) => {
      if (b.novaPagina) fechar();
      const seguinte = this.blocos[i + 1];
      const proximo = b.comProximo && seguinte ? (seguinte.junto ? seguinte.linhas.length : 3) : 0;
      const precisa = Math.min(LINHAS, b.linhas.length + proximo);
      if (atual.length && b.junto && atual.length + precisa > LINHAS) fechar();
      for (const l of b.linhas) {
        if (atual.length >= LINHAS) fechar();
        if (!atual.length && !l.t) continue;
        atual.push(l);
      }
      if (b.sozinha) fechar();
    });
    fechar();

    let saida = paginas.map(p => p.map(renderizar).join('\n'));
    if (saida.length > MAX_PAGINAS) {
      saida = saida.slice(0, MAX_PAGINAS);
      saida[MAX_PAGINAS - 1] = [L(ORN.estrela, '8'), ...texto('O livro atingiu o limite de 100 páginas. O restante está no sistema da Casa Luckham.', '8')].map(renderizar).join('\n');
    }
    return saida;
  }

  bytes() {
    return nbtLivro(this.paginas(), this.autor || 'Casa Luckham', tituloCurto(this.titulo));
  }

  baixar(nome = this.titulo) {
    const url = URL.createObjectURL(new Blob([this.bytes()], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nomeArquivo(nome)}.book`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

// O título de livro assinado no Minecraft tem no máximo 32 caracteres.
function tituloCurto(t) {
  const s = String(t || 'Documento').trim();
  if (s.length <= 32) return s;
  const corte = s.slice(0, 32);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > 16 ? corte.slice(0, espaco) : corte).trim();
}

function nomeArquivo(t) {
  return String(t || 'livro').normalize('NFD').replace(RE_ACENTO, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'livro';
}

/* ─── NBT (o formato de dados do Minecraft) ───────── */

// Strings em "UTF-8 modificado" do Java: o caractere nulo vira C0 80 e cada metade de emoji é codificada à parte.
function mutf8(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 1 && c <= 0x7f) out.push(c);
    else if (c <= 0x7ff) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function nbtLivro(paginas, autor, titulo) {
  const b = [];
  const u16 = n => b.push((n >> 8) & 0xff, n & 0xff);
  const u32 = n => b.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  const str = s => {
    const x = mutf8(s);
    if (x.length > 0xffff) throw new Error('Página grande demais para o Minecraft.');
    u16(x.length);
    for (const v of x) b.push(v);
  };
  const nome = (tipo, n) => { b.push(tipo); str(n); };

  nome(0x0a, '');            // raiz (compound sem nome)
  nome(0x09, 'pages');       // lista...
  b.push(0x08);              // ...de strings
  u32(paginas.length);
  paginas.forEach(str);
  nome(0x08, 'author');
  str(autor);
  nome(0x08, 'title');
  str(titulo);
  b.push(0x00);              // fim da raiz
  return new Uint8Array(b);
}

/* ─── Livros prontos para cada parte do sistema ───── */

const numero = id => String(id).padStart(4, '0');
const hojeBr = () => new Date().toLocaleDateString('pt-BR');

function capaPadrao(linha1, linha2, extras) {
  return [
    L(ORN.caixaTopo, '4'),
    vazia(),
    ...texto(linha1, 'c', { centro: true }),
    ...texto(linha2, 'c', { centro: true }),
    vazia(),
    L(ORN.caixaBase, '4'),
    vazia(),
    ...extras,
  ];
}

function assinatura(linhas) {
  return [vazia(), L(ORN.estrela, '8'), ...linhas, L(ORN.estrela, '8'), ...texto('Casa Luckham', '4', { centro: true })];
}

function valorDoCampo(c, v) {
  switch (c.tipo) {
    case 'data': return dataCurta(v);
    case 'sim_nao': return v ? 'Sim' : 'Não';
    case 'numero': return num(v);
    default: return String(v);
  }
}

function tituloDoRegistro(livro, dados) {
  const c = livro.campos.find(x => (x.tipo === 'texto' || x.tipo === 'selecao') && dados[x.id]);
  return c ? String(dados[c.id]) : 'Registro';
}

// Campos do registro, na ordem do formulário, com as seções viradas cabeçalhos.
function camposDoRegistro(livroMc, livro, reg) {
  let secao = null;
  for (const c of livro.campos) {
    if (c.tipo === 'secao') { secao = c; continue; }
    const v = reg.dados[c.id];
    if (v == null || v === '' || c.tipo === 'imagem') continue;
    if (secao) { livroMc.bloco(cabecalhoSecao(secao.nome), { comProximo: true }); secao = null; }
    const linhas = campoLinhas(c.nome, valorDoCampo(c, v));
    livroMc.bloco(linhas, { junto: linhas.length <= 8 });
  }
}

function linhasDeRegistrado(reg) {
  return [
    ...texto('Registrado por', '8'),
    ...texto(reg.criado_por_nome || 'desconhecido', '0'),
    ...texto(`em ${dataHora(reg.criado_em)}`, '8'),
    ...(reg.atualizado_em ? [vazia(), ...texto(`Alterado por ${reg.atualizado_por_nome} em ${dataHora(reg.atualizado_em)}`, '8')] : []),
  ];
}

export function livroDeRegistro(nomeModulo, livro, reg, autor) {
  const titulo = tituloDoRegistro(livro, reg.dados);
  const mc = new LivroMC(titulo, autor);
  mc.capa(capaPadrao(nomeModulo.toUpperCase(), 'DE LYENDELL', [
    ...texto(livro.nome, '8', { centro: true }),
    ...texto(`Registro nº ${numero(reg.id)}`, '8', { centro: true }),
    vazia(),
    L(ORN.estrela, '8'),
    ...texto(titulo, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
  ]));
  camposDoRegistro(mc, livro, reg);
  mc.bloco(assinatura(linhasDeRegistrado(reg)));
  return mc;
}

// Vários registros num livro só (ex.: o Registro de Prisioneiros inteiro).
export function livroDeRegistros(nomeModulo, livro, registros, autor) {
  const mc = new LivroMC(livro.nome, autor);
  mc.capa(capaPadrao(nomeModulo.toUpperCase(), 'DE LYENDELL', [
    L(ORN.estrela, '8'),
    ...texto(livro.nome, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(`${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`, '8', { centro: true }),
    ...texto(`Copiado em ${hojeBr()}`, '8', { centro: true }),
  ]));
  [...registros].sort((a, b) => a.id - b.id).forEach(reg => {
    mc.bloco([
      L(ORN.estrela, '8'),
      ...texto(tituloDoRegistro(livro, reg.dados), '0', { centro: true, negrito: true }),
      ...texto(`Registro nº ${numero(reg.id)}`, '8', { centro: true }),
      L(ORN.estrela, '8'),
    ], { novaPagina: true });
    camposDoRegistro(mc, livro, reg);
    mc.bloco([vazia(), ...texto(`Registrado por ${reg.criado_por_nome || 'desconhecido'} em ${dataCurta(reg.criado_em)}.`, '8')]);
  });
  return mc;
}

export function livroDeAnuncio(a, autor) {
  const mc = new LivroMC(a.titulo, autor || a.autor_nome);
  const selo = a.importancia === 'urgente' ? 'URGENTE' : a.importancia === 'importante' ? 'IMPORTANTE' : '';
  mc.capa(capaPadrao('MURAL DE', 'ANÚNCIOS', [
    ...(selo ? texto(selo, '4', { centro: true, negrito: true }) : []),
    L(ORN.estrela, '8'),
    ...texto(a.titulo, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(`Lyendell, ${dataCurta(a.criado_em)}`, '8', { centro: true }),
  ]));
  if (a.conteudo) mc.bloco(texto(a.conteudo, '0'), { junto: false });
  mc.bloco(assinatura([...texto('Publicado por', '8'), ...texto(a.autor_nome || 'desconhecido', '0'), ...texto(`em ${dataHora(a.criado_em)}`, '8')]));
  return mc;
}

export function livroDeAtividade(a, divisao, contribuicoes, autor) {
  const qtd = n => `${num(n)} ${a.item}${pacotes(n, a.pacote) ? ` (${pacotes(n, a.pacote)})` : ''}`;
  const status = { aberta: 'Aberta', concluida: 'Concluída', encerrada: 'Encerrada' }[a.status];
  const temRecompensa = a.recompensa_valor != null;
  const mc = new LivroMC(a.titulo, autor || a.criado_por_nome);
  mc.capa(capaPadrao('MURAL DE', 'ATIVIDADES', [
    L(ORN.estrela, '8'),
    ...texto(a.titulo, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(`${num(a.total)} / ${num(a.meta)} ${a.item}`, '4', { centro: true }),
    ...texto(status, '8', { centro: true }),
  ]));

  mc.bloco(cabecalhoSecao('O pedido'), { comProximo: true });
  if (a.descricao) mc.bloco([vazia(), ...texto(a.descricao, '0')], { junto: false });
  mc.bloco(campoLinhas('Meta', qtd(a.meta)));
  mc.bloco(campoLinhas('Entregue até agora', qtd(a.total)));
  if (a.total < a.meta) mc.bloco(campoLinhas('Falta', qtd(a.meta - a.total)));
  if (a.prazo) mc.bloco(campoLinhas('Prazo', dataCurta(a.prazo)));
  if (temRecompensa) mc.bloco(campoLinhas('Recompensa', `${num(a.recompensa_valor)} ${a.recompensa_unidade}`.trim()));

  if (divisao.length) {
    mc.bloco(cabecalhoSecao('Quem ajudou'), { comProximo: true, novaPagina: true });
    divisao.forEach(p => mc.bloco([
      vazia(),
      ...texto(p.nome, '0', { negrito: true }),
      ...(p.compromisso ? texto(`Prometeu: ${num(p.compromisso)}`, '8') : []),
      ...texto(`Entregou: ${num(p.entregue)}`, '8'),
      ...texto(`${num(p.fracao * 100)}% do total`, '8'),
      ...(temRecompensa && p.parte != null ? texto(`Recebe: ${num(p.parte)} ${a.recompensa_unidade}`.trim(), '2') : []),
    ]));
  }

  if (contribuicoes.length) {
    mc.bloco(cabecalhoSecao('Entregas'), { comProximo: true, novaPagina: true });
    [...contribuicoes].reverse().forEach(c => mc.bloco([
      vazia(),
      ...texto(`${c.usuario_nome}: ${qtd(c.quantidade)}`, '0'),
      ...texto(`${dataCurta(c.criado_em).slice(0, 5)} · ${c.conferida ? 'conferida' : 'a conferir'}`, '8'),
      ...(c.nota ? texto(c.nota, '8') : []),
    ]));
  }

  mc.bloco(assinatura([...texto('Pedido por', '8'), ...texto(a.criado_por_nome || 'desconhecido', '0'), ...texto(`em ${dataCurta(a.criado_em)}`, '8')]));
  return mc;
}

export function livroDePagamentos(p, autor) {
  const mc = new LivroMC(`Pagamentos ${p.registro.titulo}`, autor);
  mc.capa(capaPadrao('LIVRO DE', 'PAGAMENTOS', [
    L(ORN.estrela, '8'),
    ...texto(p.registro.titulo, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(`A cada ${p.intervalo} dias`, '8', { centro: true }),
    ...(p.inicio ? texto(`desde ${dataCurta(p.inicio)}`, '8', { centro: true }) : []),
  ]));
  const situacao = {
    pago: x => [`✔ Pago em ${dataCurta(x.pagamento.pago_em)}`, '2'],
    atrasado: () => ['✘ Atrasado', '4'],
    hoje: () => ['Vence hoje', '4'],
    proximo: () => ['Próximo pagamento', '8'],
    futuro: () => ['A vencer', '8'],
  };
  p.parcelas.forEach(x => {
    const [s, cor] = situacao[x.status](x);
    mc.bloco([
      vazia(),
      ...texto(`${dataCurta(x.vencimento)}${x.numero ? ` (${x.numero}ª)` : ''}`, '0', { negrito: true }),
      ...texto(s, cor),
      ...(x.pagamento ? texto(x.pagamento.observacao, '8') : []),
    ]);
  });
  if (p.fim) mc.bloco([vazia(), ...texto(`Cobrança encerrada em ${dataCurta(p.fim)}.`, '4')]);
  mc.bloco(assinatura([...texto('Tabelionato de Lyendell', '8'), ...texto(`Copiado em ${hojeBr()}`, '8')]));
  return mc;
}
