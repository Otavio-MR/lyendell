const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { checar, pode, exigirLogin } = require('../auth');
const { anotar } = require('../diario');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { hoje, cronograma, resumo } = require('../cobranca');
const { erro, texto, linha, inteiro, idDaRota, dataValida } = require('../util');

// Tabelionato e Guarda funcionam igual: cada módulo tem "livros", cada livro tem
// um formulário próprio (campos) e uma pilha de registros.
const MODULOS = { tabelionato: 'Tabelionato', guarda: 'Guarda do Coelho' };
const TIPOS = ['texto', 'texto_longo', 'numero', 'data', 'selecao', 'sim_nao', 'imagem', 'secao'];
const ICONES = ['livro', 'casa', 'coroa', 'loja', 'documento', 'alianca', 'chave', 'escudo', 'grades', 'alvo',
  'pergaminho', 'balanca', 'mapa', 'moeda', 'espada', 'pena', 'bandeira', 'bau'];

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
    if (tipo !== 'secao') {
      if (c.obrigatorio) campo.obrigatorio = true;
      if (c.destaque) campo.destaque = true;
    }
    const ajuda = linha(c?.ajuda, 140);
    if (ajuda) campo.ajuda = ajuda;
    return campo;
  });
  if (!campos.some(c => c.tipo !== 'secao')) throw erro(400, 'O livro precisa de pelo menos um campo.');
  return campos;
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

function lerLivro(req, atual, mod) {
  const nome = linha(req.body?.nome ?? atual?.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao livro.');
  const campos = limparCampos(req.body?.campos ?? atual?.campos ?? [{ nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true }]);
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
function limparDados(livro, bruto, anterior = {}) {
  const dados = {};
  for (const c of livro.campos) {
    if (c.tipo === 'secao') continue;
    let v = bruto?.[c.id];
    switch (c.tipo) {
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
    SELECT l.*, (SELECT COUNT(*) FROM registros r WHERE r.livro_id = l.id) AS total
    FROM livros l WHERE l.modulo = ? ORDER BY l.ordem, l.id`, m);
  const dia = hoje();
  const saida = [];
  for (const l of livros) {
    const f = formatarLivro(l);
    let atrasados = 0;
    if (f.cobranca) {
      const [pagos, registros] = await Promise.all([
        pagamentosDoLivro(f.id),
        db.all('SELECT id, dados, cobranca_fim FROM registros WHERE livro_id = ?', f.id),
      ]);
      for (const reg of registros) {
        if (resumo(f, { ...reg, dados: JSON.parse(reg.dados) }, pagos.get(reg.id) || [], dia).atrasados) atrasados++;
      }
    }
    saida.push({ ...f, podeRegistrar: podeRegistrar(req, f), atrasados });
  }
  res.json({ livros: saida });
});

r.post('/modulos/:modulo/livros', async (req, res) => {
  const m = modulo(req.params.modulo);
  checar(req, `${m}.configurar`);
  const l = lerLivro(req, null, m);
  const ordem = ((await db.get('SELECT MAX(ordem) AS o FROM livros WHERE modulo = ?', m)).o ?? 0) + 1;
  const { id } = await db.run('INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    m, l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), l.cobranca ? JSON.stringify(l.cobranca) : null, ordem);
  await anotar(req, `Criou um livro (${MODULOS[m]})`, l.nome);
  res.status(201).json({ id });
});

r.put('/livros/:id', async (req, res) => {
  const atual = await buscarLivro(idDaRota(req));
  checar(req, `${atual.modulo}.configurar`);
  const l = lerLivro(req, atual, atual.modulo);
  await db.run('UPDATE livros SET nome = ?, descricao = ?, icone = ?, aberto = ?, campos = ?, cobranca = ? WHERE id = ?',
    l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), l.cobranca ? JSON.stringify(l.cobranca) : null, atual.id);
  await anotar(req, `Configurou um livro (${MODULOS[atual.modulo]})`, l.nome);
  res.json({ ok: true });
});

r.delete('/livros/:id', async (req, res) => {
  const l = await buscarLivro(idDaRota(req));
  checar(req, `${l.modulo}.configurar`);
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
  const registros = (await db.all('SELECT * FROM registros WHERE livro_id = ? ORDER BY id DESC', l.id))
    .map(x => ({ ...x, dados: JSON.parse(x.dados) }));
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
    },
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
  const dados = limparDados(l, req.body?.dados);
  const { id } = await db.run('INSERT INTO registros (livro_id, dados, criado_por, criado_por_nome) VALUES (?, ?, ?, ?)',
    l.id, JSON.stringify(dados), req.usuario.id, req.usuario.nome);
  await anotar(req, `Registrou em "${l.nome}"`, tituloDoRegistro(l, dados));
  res.status(201).json({ id });
});

async function buscarRegistro(req) {
  const reg = await db.get('SELECT * FROM registros WHERE id = ?', idDaRota(req));
  if (!reg) throw erro(404, 'Registro não encontrado.');
  return { reg: { ...reg, dados: JSON.parse(reg.dados) }, livro: await buscarLivro(reg.livro_id) };
}

r.put('/registros/:id', async (req, res) => {
  const { reg, livro } = await buscarRegistro(req);
  checar(req, `${livro.modulo}.editar`);
  const dados = limparDados(livro, req.body?.dados, reg.dados);
  const novas = new Set(imagensDe(livro, dados));
  await db.lote([
    ["UPDATE registros SET dados = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?", JSON.stringify(dados), req.usuario.nome, reg.id],
    ...imagensDe(livro, reg.dados).filter(u => !novas.has(u)).map(comandoApagarArquivo),
  ]);
  await anotar(req, `Editou um registro em "${livro.nome}"`, tituloDoRegistro(livro, dados));
  res.json({ ok: true });
});

r.delete('/registros/:id', async (req, res) => {
  const { reg, livro } = await buscarRegistro(req);
  checar(req, `${livro.modulo}.apagar`);
  await db.lote([
    ['DELETE FROM pagamentos WHERE registro_id = ?', reg.id],
    ['DELETE FROM registros WHERE id = ?', reg.id],
    ...imagensDe(livro, reg.dados).map(comandoApagarArquivo),
  ]);
  await anotar(req, `Apagou um registro de "${livro.nome}"`, tituloDoRegistro(livro, reg.dados));
  res.json({ ok: true });
});

/* ─── Pagamentos periódicos (ex.: comerciantes) ───── */

const dataBr = s => s.split('-').reverse().join('/');

async function contextoCobranca(req) {
  const { reg, livro } = await buscarRegistro(req);
  checar(req, `${livro.modulo}.ver`);
  if (!livro.cobranca) throw erro(400, 'Este livro não tem pagamentos periódicos.');
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
