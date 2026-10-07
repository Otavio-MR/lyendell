const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode, checar, soAliados } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { erro, linha, texto, idDaRota } = require('../util');

const IMPORTANCIAS = ['comum', 'importante', 'urgente'];

const r = express.Router();
r.use(exigirLogin);

const podeMexer = (req, a) => pode(req, 'anuncios.moderar') || (a.autor_id === req.usuario.id && pode(req, 'anuncios.publicar'));

function ler(req, atual = {}) {
  const titulo = linha(req.body?.titulo ?? atual.titulo, 120);
  if (!titulo) throw erro(400, 'Dê um título ao anúncio.');
  const conteudo = texto(req.body?.conteudo ?? atual.conteudo, 5000);
  const importancia = IMPORTANCIAS.includes(req.body?.importancia) ? req.body.importancia : (atual.importancia || 'comum');
  const imagem = req.body?.imagem !== undefined ? (urlValida(req.body.imagem) ? req.body.imagem : null) : (atual.imagem ?? null);
  // "Visível para Convidados e Aliados": os Aliados (que não são moradores) também leem este anúncio.
  const aliados = req.body?.aliados !== undefined ? (req.body.aliados ? 1 : 0) : (atual.aliados ? 1 : 0);
  return { titulo, conteudo, importancia, imagem, aliados };
}

// Aviso para os Aliados quando um anúncio passa a ser visível para eles.
function avisarAliados(req, id, a) {
  require('../notificacoes').avisar('aliados', {
    titulo: `${a.importancia === 'urgente' ? 'URGENTE: ' : ''}${a.titulo}`, corpo: `${req.usuario.nome} no Mural de Anúncios: ${a.conteudo.slice(0, 140)}`,
    url: '/#/anuncios', tag: `anuncio-${id}`,
  }, { exceto: req.usuario.id, perm: 'aliados.ver', semPerm: 'anuncios.ver' });
}

// Quem lê os anúncios vê todos; os Aliados, só os marcados para Convidados e Aliados.
r.get('/', async (req, res) => {
  const soMarcados = soAliados(req, 'anuncios.ver');
  if (!soMarcados) checar(req, 'anuncios.ver');
  const lista = await db.all(`
    SELECT a.*, u.foto AS autor_foto FROM anuncios a LEFT JOIN usuarios u ON u.id = a.autor_id
    ${soMarcados ? 'WHERE a.aliados = 1' : ''} ORDER BY a.fixado DESC, a.id DESC LIMIT 200`);
  res.json({ anuncios: lista.map(a => ({ ...a, fixado: !!a.fixado, aliados: !!a.aliados, podeMexer: podeMexer(req, a) })) });
});

r.post('/', exigir('anuncios.publicar'), async (req, res) => {
  const a = ler(req);
  const fixado = req.body?.fixado && pode(req, 'anuncios.moderar') ? 1 : 0;
  const { id } = await db.run('INSERT INTO anuncios (titulo, conteudo, importancia, imagem, fixado, autor_id, autor_nome, aliados) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    a.titulo, a.conteudo, a.importancia, a.imagem, fixado, req.usuario.id, req.usuario.nome, a.aliados);
  await anotar(req, 'Publicou um anúncio', a.titulo);
  await progresso.registrar(req.usuario.id, 'anuncio');
  require('../notificacoes').avisar('anuncios', {
    titulo: `${a.importancia === 'urgente' ? 'URGENTE: ' : ''}${a.titulo}`, corpo: `${req.usuario.nome} no Mural de Anúncios: ${a.conteudo.slice(0, 140)}`,
    url: '/#/anuncios', tag: `anuncio-${id}`,
  }, { exceto: req.usuario.id });
  if (a.aliados) avisarAliados(req, id, a);
  res.status(201).json({ id });
});

async function buscar(req) {
  const a = await db.get('SELECT * FROM anuncios WHERE id = ?', idDaRota(req));
  if (!a) throw erro(404, 'Anúncio não encontrado.');
  return a;
}

r.put('/:id', async (req, res) => {
  const atual = await buscar(req);
  if (!podeMexer(req, atual)) checar(req, 'anuncios.moderar');
  const a = ler(req, atual);
  await db.lote([
    ["UPDATE anuncios SET titulo = ?, conteudo = ?, importancia = ?, imagem = ?, aliados = ?, editado_em = datetime('now') WHERE id = ?",
      a.titulo, a.conteudo, a.importancia, a.imagem, a.aliados, atual.id],
    atual.imagem && atual.imagem !== a.imagem ? comandoApagarArquivo(atual.imagem) : null,
  ]);
  await anotar(req, 'Editou um anúncio', a.titulo);
  if (a.aliados && !atual.aliados) avisarAliados(req, atual.id, a); // acabou de ser aberto para os Aliados
  res.json({ ok: true });
});

r.post('/:id/fixar', exigir('anuncios.moderar'), async (req, res) => {
  const a = await buscar(req);
  const fixado = req.body?.fixado ? 1 : 0;
  await db.run('UPDATE anuncios SET fixado = ? WHERE id = ?', fixado, a.id);
  await anotar(req, fixado ? 'Fixou um anúncio' : 'Desafixou um anúncio', a.titulo);
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  const a = await buscar(req);
  if (!podeMexer(req, a)) checar(req, 'anuncios.moderar');
  await db.lote([['DELETE FROM anuncios WHERE id = ?', a.id], comandoApagarArquivo(a.imagem)]);
  await anotar(req, 'Apagou um anúncio', a.titulo);
  res.json({ ok: true });
});

module.exports = r;
