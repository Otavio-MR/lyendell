// Gera arquivos .book para o mod Scribble (Minecraft 1.21).
// Formato: NBT sem compressão com "pages" (lista de textos), "author" e, às vezes, "title",
// igual aos livros salvos pelo próprio Scribble. As páginas usam códigos de cor (§).

import { dataCurta, dataHora, num, pacotes, textoDuracao, listaDeNomes, normalizar, estado, aviso } from './core.js';

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
  const n = c.codePointAt(0);
  // Molduras (═ ─ ╔ ╗...) e ✦ ocupam a casa inteira da fonte: 8px + 1 de espaço (medido no jogo:
  // 12 cabem numa linha, 13 não). Emojis como o 🐇 são um pouco mais estreitos.
  if ((n >= 0x2500 && n <= 0x257f) || n === 0x2726) return 9;
  if (n > 0xffff) return 8;
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
// Os mesmos enfeites dos modelos da Casa, que cabem inteiros numa linha do livro.
const ORN = {
  caixaTopo: '╔══════════╗',
  caixaBase: '╚══════════╝',
  estrela: '🐇 ────────── 🐇',
  secaoTopo: '╔─── ✦ ───╗',
  secaoBase: '╚─── ✦ ───╝',
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
    baixarArquivo(this.bytes(), nome);
  }
}

function baixarArquivo(bytes, nome) {
  // Se o site foi atualizado depois que esta aba abriu, recarrega antes: senão o livro sairia no formato velho.
  if (estado.novaVersao) {
    aviso('O site foi atualizado. Recarregando a página; depois é só baixar de novo.', 'erro');
    setTimeout(() => location.reload(), 1500);
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo(nome)}.book`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
  if (titulo != null) { // os modelos de registro da Casa não têm título
    nome(0x08, 'title');
    str(titulo);
  }
  b.push(0x00);              // fim da raiz
  return new Uint8Array(b);
}

/* ─── Livros prontos para cada parte do sistema ───── */

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

function valorDoCampo(c, v, dados) {
  switch (c.tipo) {
    case 'data': return dataCurta(v);
    case 'sim_nao': return v ? 'Sim' : 'Não';
    case 'numero': return num(v);
    case 'referencia': return listaDeNomes(v).join(', ');
    // No livro fica só o tamanho da pena; "faltam X dias" mudaria com o tempo.
    case 'duracao': return textoDuracao(c, dados, { relativo: false });
    default: return String(v);
  }
}

function tituloDoRegistro(livro, dados, semNome = 'Registro') {
  const c = livro.campos.find(x => (x.tipo === 'texto' || x.tipo === 'selecao') && dados[x.id]);
  return c ? String(dados[c.id]) : semNome;
}

/* ─── Fichas de registro (modelo da Casa) ─────────── */

// Os modelos de Moradores, Nobres e Outros copiam a capa e o rodapé dos livros feitos pela Casa no jogo.
// As linhas de dentro seguem SEMPRE o formulário de registro do site: os mesmos campos, na mesma ordem e com
// os mesmos nomes (no RP o nick se chama "Endereço"). Campo que não existe no formulário não vai para o livro.
// Cada valor entra na linha em branco logo abaixo do rótulo. Os outros livros seguem o mesmo desenho.

const SEP = '🐇 ────────── 🐇';
const FIM = '§4   §6  Casa Luckham';
const TABELIONATO = ['      TABELIONATO', '      DE LYENDELL'];

// Nomes que cada linha do modelo pode ter no formulário do site (sem acento e sem maiúscula), do mais
// certo ao mais solto. Em Lyendell, o "Endereço" é o nick do jogador (o endereço dele no Minecraft) e a
// "Residência" é a rua e o número; por isso "endereco" é o último recurso da residência.
const CAMPOS_FICHA = {
  nickname: ['nickname', 'nick', 'nick do minecraft', 'endereco'],
  nome: ['nome', 'nome do personagem', 'nome completo'],
  idade: ['idade'],
  cargo: ['cargo'],
  residencia: ['residencia', 'moradia', 'onde mora', 'endereco'],
  estadoCivil: ['estado civil'],
  profissao: ['profissao', 'oficio'],
  genero: ['genero', 'sexo'],
  endereco: ['residencia', 'moradia', 'onde mora', 'endereco'], // a linha "Endereço" do modelo de Outros: onde a pessoa mora
  familia: ['a qual familia pertence', 'familia'],
  cargoFamilia: ['cargo na familia'],
  // Só o documento de identidade usa estes: dados que quase nunca mudam (se o formulário tiver o campo).
  chegada: ['data de chegada', 'chegada'],
  naturalidade: ['naturalidade', 'local de nascimento', 'nasceu em', 'cidade natal'],
  nascimento: ['data de nascimento', 'nascimento'],
};
// O id que o site deu ao campo quando criou o livro: continua o mesmo se a Tabeliã trocar o nome do campo.
const IDS_FICHA = {
  nickname: 'nickname', nome: 'nome', idade: 'idade', cargo: 'cargo', residencia: 'residencia', estadoCivil: 'estado_civil',
  profissao: 'profissao', genero: 'genero', endereco: 'endereco', familia: 'familia', cargoFamilia: 'cargo_familia',
  chegada: 'chegada',
};
// Na capa vai o nome (ou o nick, no de Outros) da pessoa registrada.
const LINHAS_CAPA = ['nickname', 'nome'];

const semCodigos = s => s.replace(/§./g, '');
// Valor numa linha só, sem § (que o Minecraft leria como código de cor).
const umaLinha = v => String(v ?? '').replace(/§/g, '').replace(/\s*\n\s*/g, ' ').trim();
const nomeDoCampo = c => normalizar(c.nome).replace(/:\s*$/, '').trim();

// Centraliza pela largura real das letras (o mesmo desenho dos modelos).
function centralizar(t) {
  const sobra = LARGURA - largura(t);
  return sobra > 0 ? ' '.repeat(Math.floor((sobra - 4) / 8)) + t : t;
}

function valorFormatado(c, reg) {
  const v = reg.dados?.[c.id];
  if (c.tipo === 'duracao') return valorDoCampo(c, v, reg.dados || {});
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  return valorDoCampo(c, v, reg.dados);
}

// Qual campo do formulário vai em cada linha do modelo. Cada campo serve a uma linha só.
// 1) Pelo nome do campo: os nomes mais certos de todas as linhas escolhem primeiro (assim "Residência"
//    ganha a linha da residência, e "Endereço" fica para o nick).
// 2) O que sobrar, pelo id que o site deu ao campo (ex.: o campo "Nickname" renomeado para "Endereço").
function camposDaFicha(livro, linhas) {
  const campos = livro.campos.filter(c => c.tipo !== 'imagem' && c.tipo !== 'secao');
  const usados = new Set();
  const achados = {};
  const voltas = Math.max(...linhas.map(k => CAMPOS_FICHA[k].length));
  for (let i = 0; i < voltas; i++) {
    for (const k of linhas) {
      const nome = CAMPOS_FICHA[k][i];
      if (achados[k] || !nome) continue;
      const c = campos.find(x => !usados.has(x) && nomeDoCampo(x) === nome);
      if (c) { achados[k] = c; usados.add(c); }
    }
  }
  for (const k of linhas) {
    if (achados[k]) continue;
    const c = campos.find(x => !usados.has(x) && x.id === IDS_FICHA[k]);
    if (c) { achados[k] = c; usados.add(c); }
  }
  return achados;
}

function leitorDaFicha(livro, reg, linhas) {
  const achados = camposDaFicha(livro, linhas);
  return chave => (achados[chave] ? umaLinha(valorFormatado(achados[chave], reg)) : '');
}

const numeroDoRegistro = reg => (reg.numero ? String(reg.numero).padStart(4, '0') : '----');
const quemRegistrou = reg => umaLinha(reg.criado_por_nome) || '---';
const quandoRegistrou = reg => (reg.criado_em ? dataHora(reg.criado_em) : '--/--/----, --:--');

// Página 1: cabeçalho, tipo do registro, número e o nome registrado entre os coelhos.
function capaDaFicha({ cor, fecho = '', cabecalho = TABELIONATO, tipo, numero, titulo }) {
  const nome = umaLinha(titulo) || '---';
  let linhasNome = [`§0${centralizar(nome)}§l`];
  if (largura(nome) > LARGURA) {
    const partes = quebrar(nome);
    linhasNome = partes.map((p, i) => `${i === 0 ? '§0' : ''}${centralizar(p)}${i === partes.length - 1 ? '§l' : ''}`);
  }
  return [
    `§${cor}╔══════════╗`, '', cabecalho[0], cabecalho[1], '', `╚══════════╝${fecho}`,
    '§4', tipo[0], tipo[1], `   Registro nº ${numero}§8`,
    ...(linhasNome.length > 1 ? [] : ['']), // nome comprido: tira a linha em branco para caber
    SEP, ...linhasNome, `§8${SEP}`,
  ].join('\n');
}

const rodapeMoradores = reg => `§8${SEP}\nRegistrado por: ${quemRegistrou(reg)}§0\n§8em ${quandoRegistrou(reg)}\n${SEP}\n${FIM}`;
const rodapePadrao = reg => `§8${SEP}\n§0Registrado por: ${quemRegistrou(reg)}\nem ${quandoRegistrou(reg)}§8\n${SEP}\n${FIM}`;

function fichaMoradoresOuNobres(livro, reg, nobres) {
  const v = leitorDaFicha(livro, reg, LINHAS_CAPA);
  return [
    capaDaFicha({
      cor: nobres ? '6' : '2', fecho: nobres ? '§2' : '',
      tipo: ['       Registro de', nobres ? '         Nobres' : '       Moradores'],
      numero: numeroDoRegistro(reg), titulo: v('nome') || v('nickname'),
    }),
    ...paginasDosCampos(livro, reg, nobres ? rodapePadrao(reg) : rodapeMoradores(reg), { ficha: true }),
  ];
}

function fichaOutros(livro, reg) {
  const v = leitorDaFicha(livro, reg, LINHAS_CAPA);
  return [
    capaDaFicha({
      cor: '3', fecho: '§2', tipo: ['       Registro de', '         Outros'],
      numero: numeroDoRegistro(reg), titulo: v('nickname') || v('nome'),
    }),
    ...paginasDosCampos(livro, reg, rodapePadrao(reg), { ficha: true }),
  ];
}

// "Registro de Comerciantes" vira "Registro de" / "Comerciantes"; outros nomes são divididos em duas linhas.
function tipoDoLivro(nome) {
  const n = umaLinha(nome);
  const m = n.match(/^registro de\s+(.+)$/i);
  if (m) return ['       Registro de', centralizar(m[1])];
  if (largura(n) <= LARGURA - 20 || !n.includes(' ')) return ['', centralizar(n)];
  const palavras = n.split(' ');
  let melhor = 1;
  for (let i = 1; i < palavras.length; i++) {
    const dif = Math.abs(largura(palavras.slice(0, i).join(' ')) - largura(palavras.slice(i).join(' ')));
    const atual = Math.abs(largura(palavras.slice(0, melhor).join(' ')) - largura(palavras.slice(melhor).join(' ')));
    if (dif < atual) melhor = i;
  }
  return [centralizar(palavras.slice(0, melhor).join(' ')), centralizar(palavras.slice(melhor).join(' '))];
}

// Linhas que uma linha do livro ocupa na tela (a página quebra o texto comprido).
const linhasNaTela = linha => quebrar(semCodigos(linha)).length;

// Cabeçalho e cor da moldura da capa de cada módulo (o Tabelionato segue o modelo da Casa).
function capaDoModulo(nomeModulo) {
  const n = normalizar(nomeModulo);
  if (n.includes('guarda')) return { cor: '4', cabecalho: [centralizar('GUARDA DO COELHO'), TABELIONATO[1]] };
  if (n.includes('hospital')) return { cor: '3', cabecalho: [centralizar('HOSPITAL'), TABELIONATO[1]] };
  if (n.includes('congresso')) return { cor: '1', cabecalho: [centralizar('CONGRESSO'), ''] };
  if (n.includes('leis')) return { cor: '5', cabecalho: [centralizar('LEIS DE'), centralizar('LYENDELL')] };
  return { cor: '2', cabecalho: TABELIONATO };
}

// Qualquer livro sem modelo próprio: mesma capa e mesmo desenho, com os campos do formulário.
function fichaGenerica(nomeModulo, livro, reg) {
  const capa = capaDaFicha({
    ...capaDoModulo(nomeModulo),
    tipo: tipoDoLivro(livro.nome), numero: numeroDoRegistro(reg), titulo: tituloDoRegistro(livro, reg.dados || {}, ''),
  });
  return [capa, ...paginasDosCampos(livro, reg, rodapePadrao(reg))];
}

// Nas fichas de Moradores, Nobres e Outros (o modelo da Casa) só vão os dados da pessoa: o que é do
// Tabelionato (data de chegada, situação, observações) fica só no site, e "Nome do personagem" vira "Nome".
const SO_DO_SITE = new Set(['data de chegada', 'chegada', 'situacao', 'observacoes', 'observacao', 'obs']);
const fichaSemCampo = c => SO_DO_SITE.has(normalizar(c.nome).replace(/:\s*$/, '').trim()) || SO_DO_SITE.has(normalizar(c.id || ''));
const rotuloDaFicha = nome => nome.replace(/\s+do personagem\s*:?\s*$/i, '');

// As páginas de dentro: cada campo do formulário (na ordem e com o nome dele) e o valor logo abaixo.
// Imagem não cabe no livro do Minecraft; campo que o formulário não tem não aparece.
function paginasDosCampos(livro, reg, rodape, { ficha = false } = {}) {
  const blocos = [];
  for (const c0 of livro.campos) {
    if (c0.tipo === 'imagem' || (ficha && fichaSemCampo(c0))) continue;
    const c = ficha ? { ...c0, nome: rotuloDaFicha(c0.nome) } : c0;
    if (c.tipo === 'secao') { blocos.push([`§8✦ ${umaLinha(c.nome).toUpperCase()} ✦§4`]); continue; }
    const valor = String(valorFormatado(c, reg)).replace(/§/g, '');
    const linhasValor = valor ? valor.split('\n').map(p => (p.trim() ? `§0${p.trim()}§4` : '')) : [''];
    blocos.push([`${umaLinha(c.nome).replace(/:\s*$/, '')}:`, ...linhasValor, '']);
  }
  blocos.push(rodape.split('\n'));
  return paginarBlocos(blocos);
}

// Enche as páginas sem separar um campo do seu valor (a não ser que ele sozinho passe de uma página).
// Cada bloco é uma lista de linhas já com os códigos de cor (§).
function paginarBlocos(blocos) {
  const paginas = [];
  let atual = ['§4'];
  let ocupadas = 1;
  const fechar = () => { paginas.push(atual.join('\n')); atual = []; ocupadas = 0; };
  for (const bloco of blocos) {
    const tamanho = bloco.reduce((s, l) => s + linhasNaTela(l), 0);
    if (ocupadas && ocupadas + tamanho > LINHAS && tamanho <= LINHAS) fechar();
    for (const l of bloco) {
      const n = linhasNaTela(l);
      if (ocupadas && ocupadas + n > LINHAS) fechar();
      if (!atual.length && !l) continue; // página nova não começa com linha em branco
      atual.push(!atual.length && !l.startsWith('§') ? `§4${l}` : l);
      ocupadas += n;
    }
  }
  if (atual.length) fechar();
  return paginas;
}

// Se um valor comprido fizer uma página passar de 14 linhas, o resto vai para a página seguinte,
// continuando com a mesma cor.
function caberNasPaginas(paginas) {
  const saida = [];
  for (const pagina of paginas) {
    let atual = [];
    let ocupadas = 0;
    let cor = '';
    for (let linha of pagina.split('\n')) {
      const n = linhasNaTela(linha);
      if (ocupadas && ocupadas + n > LINHAS) {
        saida.push(atual.join('\n'));
        atual = [];
        ocupadas = 0;
        linha = cor + linha;
      }
      atual.push(linha);
      ocupadas += n;
      const cores = linha.match(/§[0-9a-f]/gi);
      if (cores) cor = cores[cores.length - 1];
    }
    saida.push(atual.join('\n'));
  }
  return saida;
}

function modeloDoLivro(nomeModulo, livro) {
  if (livro.modulo ? livro.modulo !== 'tabelionato' : normalizar(nomeModulo) !== 'tabelionato') return null;
  const n = normalizar(livro.nome);
  if (n.includes('morador')) return 'moradores';
  if (n.includes('nobre')) return 'nobres';
  if (n.includes('outro')) return 'outros';
  return null;
}

export function paginasDoRegistro(nomeModulo, livro, reg) {
  const modelo = modeloDoLivro(nomeModulo, livro);
  let paginas;
  if (modelo === 'moradores' || modelo === 'nobres') paginas = fichaMoradoresOuNobres(livro, reg, modelo === 'nobres');
  else if (modelo === 'outros') paginas = fichaOutros(livro, reg);
  else paginas = fichaGenerica(nomeModulo, livro, reg);
  return caberNasPaginas(paginas);
}

// Livro já montado (páginas prontas). Como os modelos da Casa, sai só com páginas e autor.
class LivroPronto {
  constructor(titulo, autor, paginas) {
    this.titulo = titulo;
    this.autor = autor;
    this.paginas = paginas;
  }

  bytes() {
    return nbtLivro(this.paginas, this.autor || 'Casa Luckham', null);
  }

  baixar(nome = this.titulo) {
    baixarArquivo(this.bytes(), nome);
  }
}

export function livroDeRegistro(nomeModulo, livro, reg, autor) {
  return new LivroPronto(tituloDoRegistro(livro, reg.dados || {}), autor, paginasDoRegistro(nomeModulo, livro, reg));
}

// Vários registros num livro só (ex.: o Registro de Moradores inteiro), um depois do outro, cada um no seu modelo.
export function livroDeRegistros(nomeModulo, livro, registros, autor) {
  const paginas = [];
  const ordem = [...registros].sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity) || a.id - b.id);
  for (let i = 0; i < ordem.length; i++) {
    const deste = paginasDoRegistro(nomeModulo, livro, ordem[i]);
    if (paginas.length + deste.length > MAX_PAGINAS - (i < ordem.length - 1 ? 1 : 0)) {
      const faltam = ordem.length - i;
      paginas.push([`§8${SEP}`, '', ...quebrar(`O livro chegou ao limite de ${MAX_PAGINAS} páginas. ${faltam === 1 ? 'Falta 1 registro, que está' : `Faltam ${faltam} registros, que estão`} no sistema da Casa Luckham.`).map(l => `§0${l}`), '', `§8${SEP}`, FIM].join('\n'));
      break;
    }
    paginas.push(...deste);
  }
  return new LivroPronto(livro.nome, autor, paginas);
}

export function livroDaPauta(propostas, autor) {
  const mc = new LivroMC('Pauta do Congresso', autor);
  const hoje = new Date().toISOString().slice(0, 10);
  mc.capa(capaPadrao('CONGRESSO', 'PAUTA', [
    L(ORN.estrela, '8'),
    ...texto('Propostas do povo', '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(`${propostas.length} ${propostas.length === 1 ? 'proposta' : 'propostas'} para votar`, '0', { centro: true }),
    ...texto(`Lyendell, ${dataCurta(hoje)}`, '8', { centro: true }),
  ]));
  propostas.forEach((p, i) => {
    mc.bloco([
      ...texto(`${i + 1}. ${p.tipo.toUpperCase()}`, '4', { negrito: true }),
      ...texto(p.titulo, '0', { negrito: true }),
      ...texto(`De ${p.autor_nome} · ${p.apoios} ${p.apoios === 1 ? 'apoio' : 'apoios'}`, '8'),
      vazia(),
      ...texto('O que muda:', '4'),
      ...texto(p.resumo, '0'),
    ], { novaPagina: true });
    if (p.texto) mc.bloco([vazia(), ...texto('Texto completo:', '4'), ...texto(p.texto, '0')], { junto: false });
    if (p.justificativa) mc.bloco([vazia(), ...texto('Por que:', '4'), ...texto(p.justificativa, '0')], { junto: false });
    if (p.parecer) mc.bloco([vazia(), ...texto('Parecer da Senadora:', '4'), ...texto(p.parecer, '0')], { junto: false });
    mc.bloco([vazia(), ...texto('Votos: a favor ___ contra ___ abstenções ___', '8')]);
  });
  mc.bloco(assinatura([...texto('Pauta preparada por', '8'), ...texto(autor || 'a Senadora', '0')]), { novaPagina: true });
  return mc;
}

// Uma proposta do povo (Congresso): a proposta, a avaliação da Senadora e a votação, se já houve.
const SITUACAO_PROPOSTA = {
  enviada: 'Esperando a Senadora', em_pauta: 'Na pauta do Congresso', aprovada: 'Aprovada no Congresso',
  rejeitada: 'Rejeitada no Congresso', inviavel: 'Inviável',
};
export function livroDeProposta(p, autor) {
  const mc = new LivroMC(p.titulo, autor || p.autor_nome);
  mc.capa(capaPadrao('CONGRESSO', 'PROPOSTA DO POVO', [
    ...texto(String(p.tipo).toUpperCase(), '4', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    ...texto(p.titulo, '0', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    vazia(),
    ...texto(SITUACAO_PROPOSTA[p.situacao] || p.situacao, '4', { centro: true }),
    ...texto(`Lyendell, ${dataCurta(p.criado_em)}`, '8', { centro: true }),
  ]));

  mc.bloco(cabecalhoSecao('A proposta'), { comProximo: true });
  mc.bloco(campoLinhas('Tipo', p.tipo));
  mc.bloco(campoLinhas('Quem propôs', p.autor_nome || 'desconhecido'));
  mc.bloco(campoLinhas('Enviada em', dataCurta(p.criado_em)));
  if (p.apoios) mc.bloco(campoLinhas('Apoios', `${num(p.apoios)} ${p.apoios === 1 ? 'morador' : 'moradores'}`));
  mc.bloco([vazia(), ...texto('O que muda:', '4'), ...texto(p.resumo, '0')]);

  if (p.texto) {
    mc.bloco(cabecalhoSecao('Texto completo'), { comProximo: true, novaPagina: true });
    mc.bloco([vazia(), ...texto(p.texto, '0')], { junto: false });
  }
  if (p.justificativa) {
    mc.bloco(cabecalhoSecao('Por que é boa'), { comProximo: true, novaPagina: true });
    mc.bloco([vazia(), ...texto(p.justificativa, '0')], { junto: false });
  }

  if (p.situacao !== 'enviada') {
    mc.bloco(cabecalhoSecao('A Senadora'), { comProximo: true, novaPagina: true });
    mc.bloco(campoLinhas('Avaliação', p.situacao === 'inviavel' ? 'Inviável' : 'Viável, levada ao Congresso'));
    if (p.parecer_nome) mc.bloco(campoLinhas('Avaliada por', p.parecer_nome));
    if (p.parecer) mc.bloco([vazia(), ...texto(p.situacao === 'inviavel' ? 'Motivo:' : 'Parecer:', '4'), ...texto(p.parecer, '0')]);
  }

  if (p.situacao === 'aprovada' || p.situacao === 'rejeitada') {
    mc.bloco(cabecalhoSecao('Votação'), { comProximo: true, novaPagina: true });
    mc.bloco(campoLinhas('Resultado', p.situacao === 'aprovada' ? 'Aprovada' : 'Rejeitada'));
    if (p.votacao) mc.bloco(campoLinhas('Data da votação', dataCurta(p.votacao)));
    if (p.a_favor != null) mc.bloco(campoLinhas('Votos a favor', num(p.a_favor)));
    if (p.contra != null) mc.bloco(campoLinhas('Votos contra', num(p.contra)));
    if (p.abstencoes) mc.bloco(campoLinhas('Abstenções', num(p.abstencoes)));
    if (p.resultado) mc.bloco([vazia(), ...texto('Observação:', '4'), ...texto(p.resultado, '0')]);
  }

  mc.bloco(assinatura([...texto('Proposta de', '8'), ...texto(p.autor_nome || 'desconhecido', '0'), ...texto(`em ${dataHora(p.criado_em)}`, '8')]));
  return mc;
}

// O juramento da Casa Luckham, para ler diante da bandeira dentro do jogo.
export function livroDoJuramento(j, autor) {
  const mc = new LivroMC(j.titulo, autor);
  mc.capa(capaPadrao('CASA', 'LUCKHAM', [
    ...texto('JURAMENTO', '4', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    ...texto('Honra e servidão', '0', { centro: true }),
    ...texto('à Casa Luckham', '0', { centro: true }),
    L(ORN.estrela, '8'),
  ]));
  mc.bloco(texto(j.intro, '8'), { junto: false });
  mc.bloco([vazia(), ...texto(j.chamada.toUpperCase(), '4', { negrito: true })], { novaPagina: true });
  j.linhas.forEach(l => mc.bloco([vazia(), ...texto(l, '0')]));
  mc.bloco([vazia(), ...texto(j.fecho, '4', { negrito: true })]);
  mc.bloco(assinatura(texto('Lyendell, Capital da Casa Luckham', '8', { centro: true })), { novaPagina: true });
  return mc;
}

// Todos que já juraram (os registrados no Tabelionato), na ordem do juramento.
export function livroDosJuramentados(pessoas, autor) {
  const mc = new LivroMC('Os que juraram', autor);
  mc.capa(capaPadrao('CASA', 'LUCKHAM', [
    ...texto('OS QUE JURARAM', '4', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    ...texto(`${pessoas.length} ${pessoas.length === 1 ? 'pessoa deu' : 'pessoas deram'} a sua palavra à Casa`, '0', { centro: true }),
    L(ORN.estrela, '8'),
  ]));
  pessoas.forEach((p, i) => mc.bloco([
    ...texto(`${i + 1}. ${p.nome}`, '0', { negrito: true }),
    ...(p.nick ? texto(`Endereço: ${p.nick}`, '8') : []),
    ...(p.desde ? texto(`Jurou em ${dataCurta(p.desde)}`, '8') : []),
    vazia(),
  ]));
  mc.bloco(assinatura(texto('Pela honra. Pela lealdade. Pela Casa Luckham.', '4', { centro: true })));
  return mc;
}

/* ─── Lista de moradores e documento de identidade ─── */

// Qual modelo de ficha o livro tem ('moradores', 'nobres', 'outros') ou null: só esses são livros de pessoas.
export const modeloDePessoas = (nomeModulo, livro) => modeloDoLivro(nomeModulo, livro);

// Campo de formulário que ficou só com traço ou ponto ("-") conta como vazio.
const valorOuNada = v => { const s = umaLinha(v); return /^[-.]*$/.test(s) ? '' : s; };

// A relação oficial dos moradores (nome, profissão e idade), para entregar ao Império. Vai um livro bonito de
// registros: capa, quatro moradores por página e a assinatura do Tabelionato. registros: só os que devem entrar.
// ordem: 'alfabetica' (padrão) ou 'registro' (pelo número do registro).
export function livroDeMoradores(livro, registros, autor, { ordem = 'alfabetica' } = {}) {
  const pessoas = registros.map(r => {
    const f = leitorDaFicha(livro, r, ['nome', 'nickname', 'idade', 'profissao']);
    const idade = valorOuNada(f('idade'));
    return {
      numero: r.numero ?? Infinity, nome: umaLinha(f('nome') || f('nickname')), profissao: valorOuNada(f('profissao')),
      idade: /^\d+$/.test(idade) ? `${idade} ${idade === '1' ? 'ano' : 'anos'}` : idade,
    };
  }).filter(p => p.nome).sort((a, b) => (ordem === 'registro'
    ? a.numero - b.numero
    : 0) || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  const mc = new LivroMC('Moradores de Lyendell', autor);
  mc.capa(capaPadrao('TABELIONATO', 'DE LYENDELL', [
    ...texto('RELAÇÃO DE', '4', { centro: true, negrito: true }),
    ...texto('MORADORES', '4', { centro: true, negrito: true }),
    L(ORN.estrela, '8'),
    ...texto(`${pessoas.length} ${pessoas.length === 1 ? 'morador' : 'moradores'}`, '0', { centro: true }),
    ...texto(`Lyendell, ${hojeBr()}`, '8', { centro: true }),
  ]));
  pessoas.forEach((p, i) => mc.bloco([
    ...texto(`${i + 1}. ${p.nome}`, '0', { negrito: true }),
    ...texto(`${p.profissao || 'sem profissão'}, ${p.idade || 'sem idade'}`, '4'),
    vazia(),
  ]));
  mc.bloco(assinatura([
    ...texto(`Total: ${pessoas.length} ${pessoas.length === 1 ? 'morador' : 'moradores'}`, '0', { centro: true }),
    ...texto('Emitida pelo Tabelionato de Lyendell.', '8', { centro: true }),
  ]), { novaPagina: false });
  return mc;
}

// O documento de identidade de quem foi registrado (Moradores, Nobres ou Outros): uma "carteira" para a pessoa
// carregar. Só entram dados que quase nunca mudam: nome, endereço, número do registro, naturalidade e
// nascimento (se o formulário do livro tiver esses campos), chegada, juramento e quem registrou.
// Idade, profissão, residência, cargo e estado civil ficam de fora, porque mudam.
// juramento: { jurou, em } para Moradores e Nobres; null para Outros (que não juram).
export function documentoDeIdentidade(nomeModulo, livro, reg, juramento, autor) {
  const modelo = modeloDoLivro(nomeModulo, livro) || 'moradores';
  const v = leitorDaFicha(livro, reg, ['nome', 'nickname', 'chegada', 'naturalidade', 'nascimento', 'genero', 'familia']);
  const nome = umaLinha(v('nome') || v('nickname')) || '---';
  const nick = valorOuNada(v('nickname'));
  const linha = (rotulo, valor) => (valorOuNada(valor) ? [`${rotulo}:`, `§0${umaLinha(valor)}§4`, ''] : null);
  const quem = umaLinha(reg.revisado_por_nome) || quemRegistrou(reg);
  const quando = reg.revisado_em ? dataHora(reg.revisado_em) : quandoRegistrou(reg);
  const tipo = { moradores: 'Morador', nobres: 'Nobre', outros: 'Outro' }[modelo];
  // O nome já está grande na capa, então a página de dados começa pelo endereço.
  const blocos = [
    nick && nick !== nome ? linha('Endereço', nick) : null,
    linha('Registro', `${tipo}, nº ${numeroDoRegistro(reg)}`),
    linha('Gênero', v('genero')),
    linha('Nascimento', v('nascimento')),
    linha('Naturalidade', v('naturalidade')),
    modelo === 'outros' ? linha('Família', v('familia')) : null,
    linha('Chegada à Capital', v('chegada')),
    juramento ? linha('Juramento', juramento.jurou ? `Feito${juramento.em ? ` em ${dataCurta(juramento.em)}` : ''}` : 'Ainda não feito') : null,
    [...quebrar('Vale perante a Casa Luckham e a Guarda do Coelho.').map(t => `§8${t}`), ''],
    [`§8${SEP}`, `§0Registrado por: ${quem}`, `em ${quando}§8`, SEP, FIM],
  ].filter(Boolean);
  const capa = capaDaFicha({
    cor: modelo === 'nobres' ? '6' : modelo === 'outros' ? '3' : '2', fecho: modelo === 'moradores' ? '' : '§2',
    cabecalho: ['      CASA LUCKHAM', '      DE LYENDELL'], tipo: ['      Documento de', '       Identidade'],
    numero: numeroDoRegistro(reg), titulo: nome,
  });
  return new LivroPronto(`Identidade ${nome}`, autor, caberNasPaginas([capa, ...paginarBlocos(blocos)]));
}

// As marcas de **negrito**, *itálico*, __sublinhado__ e ~~riscado~~ dos anúncios (as mesmas de texto-formatado.js),
// tiradas para o livro.
const semMarcas = t => String(t || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1')
  .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2').replace(/(^|[^\w])_(?!\s)(.+?)_/g, '$1$2')
  .replace(/^\s*[•·]\s+/gm, '- ').replace(/^\s*>\s?/gm, '');

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
  // No livro do Minecraft vai o texto sem as marcas de **negrito** e afins (a fonte do jogo mede diferente).
  if (a.conteudo) mc.bloco(texto(semMarcas(a.conteudo), '0'), { junto: false });
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
