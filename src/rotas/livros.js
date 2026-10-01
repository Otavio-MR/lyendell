const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { checar, pode, exigirLogin } = require('../auth');
const { anotar } = require('../diario');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const progresso = require('../progresso');
const { hoje, cronograma, resumo } = require('../cobranca');
const { erro, texto, linha, inteiro, idDaRota, dataValida } = require('../util');
const { MODULOS } = require('../permissoes');

// Tabelionato, Guarda, Hospital e Congresso funcionam igual: cada módulo tem "livros", cada livro tem
// um formulário próprio (campos) e uma pilha de registros.
// referencia: escolhe registros de outro livro (ex.: guardas). duracao: tempo calculado entre duas datas (ex.: pena).
const TIPOS = ['texto', 'texto_longo', 'numero', 'data', 'selecao', 'sim_nao', 'imagem', 'referencia', 'duracao', 'secao'];
const ICONES = ['livro', 'casa', 'coroa', 'loja', 'documento', 'alianca', 'chave', 'escudo', 'grades', 'alvo',
  'pergaminho', 'balanca', 'mapa', 'moeda', 'espada', 'pena', 'bandeira', 'bau', 'usuarios', 'cruz', 'coluna'];

const r = express.Router();
r.use(exigirLogin);

const novoId = () => 'c' + crypto.randomBytes(4).toString('hex');

function modulo(nome) {
  if (!MODULOS[nome]) throw erro(404, 'Módulo não encontrado.');
  return nome;
}

function formatarLivro(l) {
  return { ...l, aberto: !!l.aberto, campos: JSON.parse(l.campos), cobranca: l.cobranca ? JSON.parse(l.cobranca) : null };
}

async function buscarLivro(id) {
  const l = await db.get('SELECT * FROM livros WHERE id = ?', id);
  if (!l) throw erro(404, 'Livro não encontrado.');
  return formatarLivro(l);
}

const podeRegistrar = (req, l) => pode(req, `${l.modulo}.configurar`) || (pode(req, `${l.modulo}.registrar`) && l.aberto);

function limparCampos(bruto) {
  if (!Array.isArray(bruto)) throw erro(400, 'Lista de campos inválida.');
  if (bruto.length > 60) throw erro(400, 'Um livro pode ter no máximo 60 campos.');
  const usados = new Set();
  const campos = bruto.map(c => {
    const tipo = TIPOS.includes(c?.tipo) ? c.tipo : 'texto';
    let id = typeof c?.id === 'string' && /^[a-z0-9_]{1,24}$/i.test(c.id) ? c.id : novoId();
    while (usados.has(id)) id = novoId();
    usados.add(id);
    const nome = linha(c?.nome, 60);
    if (!nome) throw erro(400, tipo === 'secao' ? 'Toda seção precisa de um título.' : 'Todo campo precisa de um nome.');
    const campo = { id, nome, tipo };
    if (tipo === 'selecao') {
      const opcoes = [...new Set((Array.isArray(c.opcoes) ? c.opcoes : []).map(o => linha(o, 60)).filter(Boolean))].slice(0, 60);
      if (!opcoes.length) throw erro(400, `O campo "${nome}" precisa de pelo menos uma opção.`);
      campo.opcoes = opcoes;
    }
    if (tipo === 'referencia') {
      campo.livro = inteiro(c.livro, { min: 1 });
      if (campo.livro == null) throw erro(400, `Escolha de qual livro o campo "${nome}" puxa os registros.`);
      if (c.multiplo) campo.multiplo = true;
    }
    if (tipo === 'duracao') {
      campo.inicio = String(c.inicio ?? '');
      campo.fim = String(c.fim ?? '');
    }
    if (tipo !== 'secao') {
      if (c.obrigatorio && tipo !== 'duracao') campo.obrigatorio = true;
      if (c.destaque) campo.destaque = true;
    }
    const ajuda = linha(c?.ajuda, 140);
    if (ajuda) campo.ajuda = ajuda;
    return campo;
  });
  if (!campos.some(c => c.tipo !== 'secao')) throw erro(400, 'O livro precisa de pelo menos um campo.');
  // O tempo calculado precisa de duas datas diferentes do próprio formulário.
  const datas = new Set(campos.filter(c => c.tipo === 'data').map(c => c.id));
  for (const c of campos.filter(x => x.tipo === 'duracao')) {
    if (!datas.has(c.inicio) || !datas.has(c.fim) || c.inicio === c.fim) {
      throw erro(400, `O campo "${c.nome}" precisa de duas datas diferentes do formulário (início e fim).`);
    }
  }
  return campos;
}

// Todo campo "Escolher de outro livro" precisa apontar para um livro que existe.
async function conferirReferencias(campos) {
  const ids = [...new Set(campos.filter(c => c.tipo === 'referencia').map(c => c.livro))];
  if (!ids.length) return;
  const existem = new Set((await db.all(`SELECT id FROM livros WHERE id IN (${ids.map(() => '?').join(', ')})`, ...ids)).map(l => l.id));
  const quebrado = campos.find(c => c.tipo === 'referencia' && !existem.has(c.livro));
  if (quebrado) throw erro(400, `O livro de onde o campo "${quebrado.nome}" puxa os registros não existe mais.`);
}

// Nomes (títulos) dos registros de um livro, para escolher num campo "Escolher de outro livro".
async function opcoesDoLivro(livroId) {
  const l = await db.get('SELECT * FROM livros WHERE id = ?', livroId);
  if (!l) return { livro: null, opcoes: [] };
  const livro = formatarLivro(l);
  const registros = await db.all("SELECT id, dados FROM registros WHERE livro_id = ? AND situacao = 'aprovado'", livro.id);
  const vistos = new Set();
  const opcoes = [];
  for (const reg of registros) {
    const titulo = tituloDoRegistro(livro, JSON.parse(reg.dados));
    if (titulo === 'sem título' || vistos.has(titulo)) continue;
    vistos.add(titulo);
    opcoes.push({ id: reg.id, titulo });
  }
  opcoes.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  return { livro, opcoes };
}

// Pagamentos periódicos só existem no Tabelionato (ex.: comerciantes a cada 14 dias).
function lerCobranca(bruto, campos, mod) {
  if (mod !== 'tabelionato' || !bruto?.ativo) return null;
  const campo = campos.find(c => c.id === bruto.campo && c.tipo === 'data');
  if (!campo) {
    throw erro(400, 'Os pagamentos precisam de um campo de data para começar a contar. Escolha um campo de data ou desligue os pagamentos.');
  }
  const intervalo = inteiro(bruto.intervalo, { min: 1, max: 365 });
  if (intervalo == null) throw erro(400, 'O intervalo dos pagamentos precisa ser de 1 a 365 dias.');
  return { ativo: true, campo: campo.id, intervalo };
}

async function lerLivro(req, atual, mod) {
  const nome = linha(req.body?.nome ?? atual?.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao livro.');
  const campos = limparCampos(req.body?.campos ?? atual?.campos ?? [{ nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true }]);
  await conferirReferencias(campos);
  return {
    nome,
    descricao: texto(req.body?.descricao ?? atual?.descricao, 240),
    icone: ICONES.includes(req.body?.icone) ? req.body.icone : (atual?.icone || 'livro'),
    aberto: (req.body?.aberto ?? atual?.aberto ?? true) ? 1 : 0,
    campos,
    cobranca: lerCobranca(req.body?.cobranca !== undefined ? req.body.cobranca : atual?.cobranca, campos, mod),
  };
}

// Pagamentos já marcados, agrupados por registro.
async function pagamentosDoLivro(livroId) {
  const mapa = new Map();
  const linhas = await db.all(`
    SELECT p.* FROM pagamentos p JOIN registros r ON r.id = p.registro_id
    WHERE r.livro_id = ? ORDER BY p.vencimento`, livroId);
  for (const p of linhas) {
    if (!mapa.has(p.registro_id)) mapa.set(p.registro_id, []);
    mapa.get(p.registro_id).push(p);
  }
  return mapa;
}

// Confere e normaliza os valores de um registro segundo os campos do livro.
async function limparDados(livro, bruto, anterior = {}) {
  const dados = {};
  const titulosPorLivro = new Map();
  const titulos = async id => {
    if (!titulosPorLivro.has(id)) titulosPorLivro.set(id, new Set((await opcoesDoLivro(id)).opcoes.map(o => o.titulo)));
    return titulosPorLivro.get(id);
  };
  for (const c of livro.campos) {
    if (c.tipo === 'secao' || c.tipo === 'duracao') continue;
    let v = bruto?.[c.id];
    switch (c.tipo) {
      case 'referencia': {
        const lista = [...new Set((Array.isArray(v) ? v : v ? [v] : []).map(x => linha(x, 120)).filter(Boolean))].slice(0, 30);
        const validos = await titulos(c.livro);
        const antes = new Set([].concat(anterior[c.id] ?? []));
        const invalido = lista.find(x => !validos.has(x) && !antes.has(x));
        if (invalido) throw erro(400, `"${invalido}" não está registrado no livro de onde "${c.nome}" puxa os nomes.`);
        v = lista.length ? (c.multiplo ? lista : lista[0]) : '';
        break;
      }
      case 'texto': v = linha(v, 300); break;
      case 'texto_longo': v = texto(v, 10000); break;
      case 'numero':
        if (v === '' || v == null) v = '';
        else {
          v = Number(v);
          if (!Number.isFinite(v)) throw erro(400, `O campo "${c.nome}" precisa ser um número.`);
        }
        break;
      case 'data': v = dataValida(v) || ''; break;
      case 'selecao':
        v = linha(v, 60);
        if (v && !c.opcoes.includes(v) && v !== anterior[c.id]) throw erro(400, `Escolha uma opção válida em "${c.nome}".`);
        break;
      case 'sim_nao': v = !!v; break;
      case 'imagem': v = urlValida(v) ? v : ''; break;
    }
    if (c.obrigatorio && (v === '' || v == null)) throw erro(400, `Preencha o campo "${c.nome}".`);
    if (v !== '') dados[c.id] = v;
  }
  for (const c of livro.campos.filter(x => x.tipo === 'duracao')) {
    const ini = dados[c.inicio];
    const fim = dados[c.fim];
    if (ini && fim && fim < ini) {
      const nome = id => livro.campos.find(x => x.id === id)?.nome || id;
      throw erro(400, `"${nome(c.fim)}" não pode ser antes de "${nome(c.inicio)}".`);
    }
  }
  return dados;
}

const imagensDe = (livro, dados) => livro.campos.filter(c => c.tipo === 'imagem').map(c => dados[c.id]).filter(Boolean);

function tituloDoRegistro(livro, dados) {
  const c = livro.campos.find(x => (x.tipo === 'texto' || x.tipo === 'selecao') && dados[x.id]);
  return c ? String(dados[c.id]) : 'sem título';
}

// Livros de um módulo
r.get('/modulos/:modulo/livros', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.ver`);
  const livros = await db.all(`
    SELECT l.*, (SELECT COUNT(*) FROM registros r WHERE r.livro_id = l.id AND r.situacao = 'aprovado') AS total,
      (SELECT COUNT(*) FROM registros r WHERE r.livro_id = l.id AND r.situacao = 'pendente') AS pendentes
    FROM livros l WHERE l.modulo = ? ORDER BY l.ordem, l.id`, m);
  const dia = hoje();
  const saida = [];
  for (const l of livros) {
    const f = formatarLivro(l);
    let atrasados = 0;
    if (f.cobranca) {
      const [pagos, registros] = await Promise.all([
        pagamentosDoLivro(f.id),
        db.all("SELECT id, dados, cobranca_fim FROM registros WHERE livro_id = ? AND situacao = 'aprovado'", f.id),
      ]);
      for (const reg of registros) {
        if (resumo(f, { ...reg, dados: JSON.parse(reg.dados) }, pagos.get(reg.id) || [], dia).atrasados) atrasados++;
      }
    }
    saida.push({ ...f, podeRegistrar: podeRegistrar(req, f), atrasados, pendentes: pode(req, `${m}.aprovar`) ? f.pendentes : 0 });
  }
  res.json({ livros: saida, contagem: await contagemModulo(req, m) });
});

// Leitura do módulo inteiro (as Leis de Lyendell): todos os livros com os registros aprovados, em ordem
// de número. É o que todo morador vê; quem escreve as leis usa as telas de livros (gerenciar).
r.get('/modulos/:modulo/leitura', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.ver`);
  const livros = (await db.all('SELECT * FROM livros WHERE modulo = ? ORDER BY ordem, id', m)).map(formatarLivro);
  const registros = await db.all(`
    SELECT r.id, r.livro_id, r.numero, r.dados, r.criado_em, r.revisado_em, r.atualizado_em
    FROM registros r JOIN livros l ON l.id = r.livro_id
    WHERE l.modulo = ? AND r.situacao = 'aprovado' ORDER BY r.numero, r.id`, m);
  res.json({
    livros: livros.map(l => ({
      id: l.id, nome: l.nome, descricao: l.descricao, icone: l.icone, campos: l.campos,
      registros: registros.filter(x => x.livro_id === l.id).map(x => ({ ...x, dados: JSON.parse(x.dados) })),
    })),
    gerenciar: ['registrar', 'editar', 'configurar', 'aprovar'].some(a => pode(req, `${m}.${a}`)),
  });
});

r.post('/modulos/:modulo/livros', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.configurar`);
  const l = await lerLivro(req, null, m);
  const ordem = ((await db.get('SELECT MAX(ordem) AS o FROM livros WHERE modulo = ?', m)).o ?? 0) + 1;
  const { id } = await db.run('INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    m, l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), l.cobranca ? JSON.stringify(l.cobranca) : null, ordem);
  await anotar(req, `Criou um livro (${MODULOS[m]})`, l.nome);
  res.status(201).json({ id });
});

r.put('/livros/:id', async (req, res) => {
  const atual = await buscarLivro(idDaRota(req));
  checar(req, `${atual.modulo}.configurar`);
  const l = await lerLivro(req, atual, atual.modulo);
  await db.run('UPDATE livros SET nome = ?, descricao = ?, icone = ?, aberto = ?, campos = ?, cobranca = ? WHERE id = ?',
    l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), l.cobranca ? JSON.stringify(l.cobranca) : null, atual.id);
  await anotar(req, `Configurou um livro (${MODULOS[atual.modulo]})`, l.nome);
  res.json({ ok: true });
});

// Nomes dos registros de um livro, para os campos "Escolher de outro livro" (ex.: lista de guardas).
r.get('/livros/:id/opcoes', async (req, res) => {
  const { livro, opcoes } = await opcoesDoLivro(idDaRota(req));
  if (!livro) throw erro(404, 'Livro não encontrado.');
  checar(req, `${livro.modulo}.ver`);
  res.json({ livro: { id: livro.id, nome: livro.nome, modulo: livro.modulo }, opcoes });
});

r.delete('/livros/:id', async (req, res) => {
  const l = await buscarLivro(idDaRota(req));
  checar(req, `${l.modulo}.configurar`);
  // Não apaga um livro que outro livro usa para escolher nomes (ex.: Guardas da Capital nos prisioneiros).
  for (const outro of await db.all('SELECT nome, campos FROM livros WHERE id <> ?', l.id)) {
    const campo = JSON.parse(outro.campos).find(c => c.tipo === 'referencia' && c.livro === l.id);
    if (campo) throw erro(400, `Este livro não pode ser apagado: o campo "${campo.nome}" do livro "${outro.nome}" escolhe nomes daqui.`);
  }
  const registros = await db.all('SELECT dados FROM registros WHERE livro_id = ?', l.id);
  await db.lote([
    ['DELETE FROM pagamentos WHERE registro_id IN (SELECT id FROM registros WHERE livro_id = ?)', l.id],
    ['DELETE FROM registros WHERE livro_id = ?', l.id],
    ['DELETE FROM livros WHERE id = ?', l.id],
    ...registros.flatMap(reg => imagensDe(l, JSON.parse(reg.dados)).map(comandoApagarArquivo)),
  ]);
  await anotar(req, `Apagou um livro (${MODULOS[l.modulo]})`, `${l.nome}, com ${registros.length} registro(s)`);
  res.json({ ok: true });
});

// Registros de um livro
r.get('/livros/:id/registros', async (req, res) => {
  const l = await buscarLivro(idDaRota(req));
  checar(req, `${l.modulo}.ver`);
  const registros = (await db.all("SELECT * FROM registros WHERE livro_id = ? AND situacao = 'aprovado' ORDER BY numero DESC, id DESC", l.id))
    .map(x => ({ ...x, dados: JSON.parse(x.dados) }));
  const aguardando = await db.get(`
    SELECT SUM(situacao = 'pendente') AS aprovar, SUM(situacao <> 'aprovado' AND criado_por = ?) AS meus
    FROM registros WHERE livro_id = ?`, req.usuario.id, l.id);
  if (l.cobranca) {
    const pagos = await pagamentosDoLivro(l.id);
    const dia = hoje();
    for (const reg of registros) reg.cobranca = resumo(l, reg, pagos.get(reg.id) || [], dia);
  }
  res.json({
    livro: { ...l, podeRegistrar: podeRegistrar(req, l) },
    permissoes: {
      editar: pode(req, `${l.modulo}.editar`),
      apagar: pode(req, `${l.modulo}.apagar`),
      configurar: pode(req, `${l.modulo}.configurar`),
      pagamentos: l.modulo === 'tabelionato' && pode(req, 'tabelionato.pagamentos'),
      aprovar: pode(req, `${l.modulo}.aprovar`),
    },
    aguardando: { aprovar: pode(req, `${l.modulo}.aprovar`) ? aguardando.aprovar || 0 : 0, meus: aguardando.meus || 0 },
    registros,
  });
});

r.post('/livros/:id/registros', async (req, res) => {
  const l = await buscarLivro(idDaRota(req));
  if (!podeRegistrar(req, l)) {
    throw erro(403, pode(req, `${l.modulo}.registrar`)
      ? 'Este livro é restrito: só quem comanda o módulo pode registrar nele.'
      : 'Você não tem permissão para registrar aqui.');
  }
  const dados = await limparDados(l, req.body?.dados);
  const situacao = pode(req, `${l.modulo}.aprovar`) ? 'aprovado' : 'pendente';
  // Aprovado já nasce com número; pendente só ganha número quando for aprovado.
  const { id } = await comNumeroLivre(() => (situacao === 'aprovado'
    ? db.run(`INSERT INTO registros (livro_id, dados, criado_por, criado_por_nome, situacao, numero) VALUES (?, ?, ?, ?, ?, ${PROXIMO_NUMERO})`,
      l.id, JSON.stringify(dados), req.usuario.id, req.usuario.nome, situacao, l.id)
    : db.run('INSERT INTO registros (livro_id, dados, criado_por, criado_por_nome, situacao) VALUES (?, ?, ?, ?, ?)',
      l.id, JSON.stringify(dados), req.usuario.id, req.usuario.nome, situacao)));
  const { numero } = await db.get('SELECT numero FROM registros WHERE id = ?', id);
  await anotar(req, situacao === 'pendente' ? `Enviou para aprovação em "${l.nome}"` : `Registrou em "${l.nome}"`,
    `${numero ? `nº ${numero}: ` : ''}${tituloDoRegistro(l, dados)}`);
  await progresso.registrar(req.usuario.id, 'registro');
  res.status(201).json({ id, situacao, numero });
});

// Número do registro dentro do livro: numeração corrida, sempre 1, 2, 3... sem buracos.
// O novo registro fica com o último número + 1. Ao apagar um, os seguintes descem (veja comandosDescerNumeros).
// Tem UM "?": passe o id do livro nessa posição.
const PROXIMO_NUMERO = '(SELECT COALESCE(MAX(numero), 0) + 1 FROM registros WHERE livro_id = ?)';

// Apagou o 3 de um livro que vai até 10: o 4 vira 3, o 5 vira 4... o 10 vira 9, e o próximo registro será o 10.
// Em duas etapas (primeiro negativos) para o banco nunca ver dois registros com o mesmo número no meio do caminho.
const comandosDescerNumeros = (livroId, apagado) => [
  ['UPDATE registros SET numero = -(numero - 1) WHERE livro_id = ? AND numero > ?', livroId, apagado],
  ['UPDATE registros SET numero = -numero WHERE livro_id = ? AND numero < 0', livroId],
];

// Se duas pessoas pegarem o mesmo número no mesmo instante, o banco recusa a segunda; aí tenta de novo.
async function comNumeroLivre(fn) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      const colidiu = /UNIQUE constraint failed: registros\.livro_id, registros\.numero/.test(e.message || '');
      if (!colidiu || tentativa >= 5) throw e;
    }
  }
}

async function buscarRegistro(req) {
  const reg = await db.get('SELECT * FROM registros WHERE id = ?', idDaRota(req));
  if (!reg) throw erro(404, 'Registro não encontrado.');
  return { reg: { ...reg, dados: JSON.parse(reg.dados) }, livro: await buscarLivro(reg.livro_id) };
}

r.put('/registros/:id', async (req, res) => {
  const { reg, livro } = await buscarRegistro(req);
  if (!pode(req, `${livro.modulo}.editar`) && !doAutorSemAprovacao(req, reg)) checar(req, `${livro.modulo}.editar`);
  const dados = await limparDados(livro, req.body?.dados, reg.dados);
  const novas = new Set(imagensDe(livro, dados));
  const situacao = reg.situacao === 'recusado' && !pode(req, `${livro.modulo}.aprovar`) ? 'pendente' : reg.situacao;
  await db.lote([
    ["UPDATE registros SET dados = ?, situacao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?", JSON.stringify(dados), situacao, req.usuario.nome, reg.id],
    ...imagensDe(livro, reg.dados).filter(u => !novas.has(u)).map(comandoApagarArquivo),
  ]);
  await anotar(req, situacao !== reg.situacao ? `Reenviou para aprovação em "${livro.nome}"` : `Editou um registro em "${livro.nome}"`, tituloDoRegistro(livro, dados));
  res.json({ ok: true, situacao });
});

r.delete('/registros/:id', async (req, res) => {
  const { reg, livro } = await buscarRegistro(req);
  if (!pode(req, `${livro.modulo}.apagar`) && !doAutorSemAprovacao(req, reg)) checar(req, `${livro.modulo}.apagar`);
  const descer = reg.numero ? comandosDescerNumeros(livro.id, reg.numero) : [];
  await db.lote([
    ['DELETE FROM pagamentos WHERE registro_id = ?', reg.id],
    ['DELETE FROM registros WHERE id = ?', reg.id],
    ...descer,
    ...imagensDe(livro, reg.dados).map(comandoApagarArquivo),
  ]);
  await anotar(req, `Apagou um registro de "${livro.nome}"`,
    `${reg.numero ? `nº ${reg.numero}: ` : ''}${tituloDoRegistro(livro, reg.dados)}${reg.numero ? ' (os números seguintes desceram um)' : ''}`);
  res.json({ ok: true });
});

/* ─── Aprovação (Tabeliã, Comandante, Diretor do Hospital, Senadora) ─ */

// Quem enviou pode corrigir ou cancelar o próprio registro enquanto ele não foi aprovado.
const doAutorSemAprovacao = (req, reg) => reg.criado_por === req.usuario.id && reg.situacao !== 'aprovado';

// Números das abas do módulo: quantos aguardam a minha aprovação e quantos envios meus ainda não foram aprovados.
async function contagemModulo(req, m) {
  const c = await db.get(`
    SELECT SUM(r.situacao = 'pendente') AS aprovacoes, SUM(r.situacao <> 'aprovado' AND r.criado_por = ?) AS envios
    FROM registros r JOIN livros l ON l.id = r.livro_id WHERE l.modulo = ? AND r.situacao <> 'aprovado'`, req.usuario.id, m);
  return { aprovacoes: pode(req, `${m}.aprovar`) ? c.aprovacoes || 0 : 0, envios: c.envios || 0 };
}

// Registros não aprovados de um módulo, junto com os livros deles (para montar os formulários).
async function registrosNaoAprovados(req, m, filtro, ...args) {
  const registros = (await db.all(`
    SELECT r.* FROM registros r JOIN livros l ON l.id = r.livro_id
    WHERE l.modulo = ? AND ${filtro} ORDER BY r.id`, m, ...args)).map(x => ({ ...x, dados: JSON.parse(x.dados) }));
  const ids = [...new Set(registros.map(x => x.livro_id))];
  const livros = ids.length ? (await db.all(`SELECT * FROM livros WHERE id IN (${ids.map(() => '?').join(', ')})`, ...ids)).map(formatarLivro) : [];
  return {
    registros,
    livros: Object.fromEntries(livros.map(l => [l.id, l])),
    permissoes: { editar: pode(req, `${m}.editar`), apagar: pode(req, `${m}.apagar`), aprovar: pode(req, `${m}.aprovar`) },
    contagem: await contagemModulo(req, m),
  };
}

r.get('/modulos/:modulo/aprovacoes', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.aprovar`);
  res.json(await registrosNaoAprovados(req, m, "r.situacao = 'pendente'"));
});

r.get('/modulos/:modulo/envios', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.ver`);
  res.json(await registrosNaoAprovados(req, m, "r.situacao <> 'aprovado' AND r.criado_por = ?", req.usuario.id));
});

async function revisar(req, situacao, motivo) {
  const { reg, livro } = await buscarRegistro(req);
  checar(req, `${livro.modulo}.aprovar`);
  if (reg.situacao !== 'pendente') throw erro(409, 'Este registro não está mais aguardando aprovação.');
  if (situacao === 'aprovado') {
    // Ao ser aprovado, entra no livro com o menor número livre.
    await comNumeroLivre(() => db.run(`UPDATE registros SET situacao = 'aprovado', motivo = NULL, revisado_por_nome = ?,
      revisado_em = datetime('now'), numero = ${PROXIMO_NUMERO} WHERE id = ? AND situacao = 'pendente'`, req.usuario.nome, livro.id, reg.id));
  } else {
    await db.run("UPDATE registros SET situacao = ?, motivo = ?, revisado_por_nome = ?, revisado_em = datetime('now') WHERE id = ?",
      situacao, motivo, req.usuario.nome, reg.id);
  }
  reg.numero = (await db.get('SELECT numero FROM registros WHERE id = ?', reg.id)).numero;
  return { reg, livro };
}

r.post('/registros/:id/aprovar', async (req, res) => {
  const { reg, livro } = await revisar(req, 'aprovado', null);
  await anotar(req, `Aprovou um registro em "${livro.nome}"`, `nº ${reg.numero}: ${tituloDoRegistro(livro, reg.dados)} (enviado por ${reg.criado_por_nome})`);
  res.json({ ok: true });
});

r.post('/registros/:id/recusar', async (req, res) => {
  const motivo = texto(req.body?.motivo, 500) || null;
  const { reg, livro } = await revisar(req, 'recusado', motivo);
  await anotar(req, `Recusou um registro em "${livro.nome}"`, `${tituloDoRegistro(livro, reg.dados)} (enviado por ${reg.criado_por_nome})${motivo ? `: ${motivo}` : ''}`);
  res.json({ ok: true });
});

/* ─── Pagamentos periódicos (ex.: comerciantes) ───── */

const dataBr = s => s.split('-').reverse().join('/');

async function contextoCobranca(req) {
  const { reg, livro } = await buscarRegistro(req);
  checar(req, `${livro.modulo}.ver`);
  if (!livro.cobranca) throw erro(400, 'Este livro não tem pagamentos periódicos.');
  if (reg.situacao !== 'aprovado') throw erro(400, 'Este registro ainda não foi aprovado.');
  return { reg, livro };
}

async function montarCronograma(livro, reg, extras = {}) {
  const pagos = await db.all('SELECT * FROM pagamentos WHERE registro_id = ? ORDER BY vencimento', reg.id);
  return cronograma({ inicio: reg.dados[livro.cobranca.campo], intervalo: livro.cobranca.intervalo, fim: reg.cobranca_fim, pagos, ...extras });
}

r.get('/registros/:id/pagamentos', async (req, res) => {
  const { reg, livro } = await contextoCobranca(req);
  const campo = livro.campos.find(c => c.id === livro.cobranca.campo);
  const c = await montarCronograma(livro, reg);
  res.json({
    registro: { id: reg.id, titulo: tituloDoRegistro(livro, reg.dados) },
    livro: { id: livro.id, nome: livro.nome },
    intervalo: livro.cobranca.intervalo,
    campoInicio: campo?.nome || 'data de início',
    inicio: reg.dados[livro.cobranca.campo] || null,
    fim: reg.cobranca_fim,
    hoje: hoje(),
    podeMarcar: pode(req, 'tabelionato.pagamentos'),
    parcelas: [],
    atrasados: 0,
    proximo: null,
    ...c,
  });
});

// Só quem tem a permissão de pagamentos (a Tabeliã) marca como pago, sempre com observação.
r.post('/registros/:id/pagamentos', async (req, res) => {
  const { reg, livro } = await contextoCobranca(req);
  checar(req, 'tabelionato.pagamentos');
  const vencimento = dataValida(req.body?.vencimento);
  const observacao = texto(req.body?.observacao, 300);
  const dia = hoje();
  const pagoEm = req.body?.pago_em ? dataValida(req.body.pago_em) : dia;
  if (!observacao) throw erro(400, 'Escreva uma observação dizendo como foi pago (ex.: 30 Lírios, ou 2 pacotes de trigo).');
  if (!pagoEm) throw erro(400, 'Data do pagamento inválida.');
  if (pagoEm > dia) throw erro(400, 'A data do pagamento não pode ser no futuro.');
  const c = await montarCronograma(livro, reg, { futuras: 60 });
  const parcela = c?.parcelas.find(p => p.vencimento === vencimento);
  if (!parcela) throw erro(400, 'Essa parcela não existe no cronograma deste registro.');
  if (parcela.pagamento) throw erro(409, 'Essa parcela já foi marcada como paga.');
  await db.run('INSERT INTO pagamentos (registro_id, vencimento, pago_em, observacao, marcado_por, marcado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
    reg.id, vencimento, pagoEm, observacao, req.usuario.id, req.usuario.nome);
  await anotar(req, 'Marcou um pagamento como pago', `${tituloDoRegistro(livro, reg.dados)}: parcela de ${dataBr(vencimento)} (${observacao})`);
  res.status(201).json({ ok: true });
});

r.delete('/pagamentos/:id', async (req, res) => {
  checar(req, 'tabelionato.pagamentos');
  const p = await db.get('SELECT * FROM pagamentos WHERE id = ?', idDaRota(req));
  if (!p) throw erro(404, 'Pagamento não encontrado.');
  const reg = await db.get('SELECT * FROM registros WHERE id = ?', p.registro_id);
  const livro = await buscarLivro(reg.livro_id);
  await db.run('DELETE FROM pagamentos WHERE id = ?', p.id);
  await anotar(req, 'Desfez um pagamento', `${tituloDoRegistro(livro, JSON.parse(reg.dados))}: parcela de ${dataBr(p.vencimento)}`);
  res.json({ ok: true });
});

// Encerrar a cobrança (ex.: a loja fechou) para não acumular parcelas atrasadas; ou retomar.
r.put('/registros/:id/cobranca', async (req, res) => {
  const { reg, livro } = await contextoCobranca(req);
  checar(req, 'tabelionato.pagamentos');
  const fim = req.body?.fim ? dataValida(req.body.fim) : null;
  if (req.body?.fim && !fim) throw erro(400, 'Data inválida.');
  await db.run('UPDATE registros SET cobranca_fim = ? WHERE id = ?', fim, reg.id);
  await anotar(req, fim ? 'Encerrou uma cobrança' : 'Retomou uma cobrança', `${tituloDoRegistro(livro, reg.dados)}${fim ? ` a partir de ${dataBr(fim)}` : ''}`);
  res.json({ ok: true });
});

module.exports = r;
