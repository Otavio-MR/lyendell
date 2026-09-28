const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode, checar } = require('../auth');
const { anotar } = require('../diario');
const { upload, salvarArquivo, comandoApagarArquivo } = require('../uploads');
const { erro, linha, texto, idDaRota, inteiro } = require('../util');

const r = express.Router();
r.use(exigirLogin);

const podeMexer = (req, foto) => pode(req, 'galeria.gerenciar') || foto.enviado_por === req.usuario.id;

async function albumValido(valor) {
  if (valor === '' || valor == null || valor === 'null') return null;
  const id = inteiro(valor, { min: 1 });
  if (id == null || !await db.get('SELECT id FROM albuns WHERE id = ?', id)) throw erro(400, 'Álbum não encontrado.');
  return id;
}

async function buscarAlbum(req) {
  const a = await db.get('SELECT * FROM albuns WHERE id = ?', idDaRota(req));
  if (!a) throw erro(404, 'Álbum não encontrado.');
  return a;
}

r.get('/albuns', exigir('galeria.ver'), async (req, res) => {
  const [albuns, total, semAlbum] = await Promise.all([
    db.all(`
      SELECT a.*, (SELECT COUNT(*) FROM fotos f WHERE f.album_id = a.id) AS total,
        (SELECT arquivo FROM fotos f WHERE f.album_id = a.id ORDER BY f.id DESC LIMIT 1) AS capa
      FROM albuns a ORDER BY a.nome COLLATE NOCASE`),
    db.get('SELECT COUNT(*) AS n FROM fotos'),
    db.get('SELECT COUNT(*) AS n FROM fotos WHERE album_id IS NULL'),
  ]);
  res.json({ albuns, total: total.n, semAlbum: semAlbum.n });
});

r.post('/albuns', exigir('galeria.gerenciar'), async (req, res) => {
  const nome = linha(req.body?.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao álbum.');
  const { id } = await db.run('INSERT INTO albuns (nome, descricao) VALUES (?, ?)', nome, texto(req.body?.descricao, 300));
  await anotar(req, 'Criou um álbum na galeria', nome);
  res.status(201).json({ id });
});

r.put('/albuns/:id', exigir('galeria.gerenciar'), async (req, res) => {
  const a = await buscarAlbum(req);
  const nome = linha(req.body?.nome ?? a.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao álbum.');
  await db.run('UPDATE albuns SET nome = ?, descricao = ? WHERE id = ?', nome, texto(req.body?.descricao ?? a.descricao, 300), a.id);
  res.json({ ok: true });
});

r.delete('/albuns/:id', exigir('galeria.gerenciar'), async (req, res) => {
  const a = await buscarAlbum(req);
  await db.lote([
    ['UPDATE fotos SET album_id = NULL WHERE album_id = ?', a.id],
    ['DELETE FROM albuns WHERE id = ?', a.id],
  ]);
  await anotar(req, 'Apagou um álbum (as fotos foram mantidas)', a.nome);
  res.json({ ok: true });
});

r.get('/fotos', exigir('galeria.ver'), async (req, res) => {
  const { album } = req.query;
  let fotos;
  if (album === 'sem-album') fotos = await db.all('SELECT * FROM fotos WHERE album_id IS NULL ORDER BY id DESC');
  else if (album) fotos = await db.all('SELECT * FROM fotos WHERE album_id = ? ORDER BY id DESC', inteiro(album, { min: 1 }) ?? 0);
  else fotos = await db.all('SELECT * FROM fotos ORDER BY id DESC');
  res.json({ fotos: fotos.map(f => ({ ...f, podeMexer: podeMexer(req, f) })) });
});

r.post('/fotos', exigir('galeria.enviar'), upload.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha uma imagem para enviar.');
  const album = await albumValido(req.body?.album_id);
  const titulo = linha(req.body?.titulo, 100);
  const url = await salvarArquivo(req.file, req.usuario.id);
  const { id } = await db.run('INSERT INTO fotos (album_id, titulo, descricao, arquivo, enviado_por, enviado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
    album, titulo, texto(req.body?.descricao, 500), url, req.usuario.id, req.usuario.nome);
  await anotar(req, 'Enviou uma foto para a galeria', titulo);
  res.status(201).json({ id });
});

async function buscarFoto(req) {
  const f = await db.get('SELECT * FROM fotos WHERE id = ?', idDaRota(req));
  if (!f) throw erro(404, 'Foto não encontrada.');
  if (!podeMexer(req, f)) checar(req, 'galeria.gerenciar');
  return f;
}

r.put('/fotos/:id', async (req, res) => {
  const f = await buscarFoto(req);
  const album = req.body?.album_id !== undefined ? await albumValido(req.body.album_id) : f.album_id;
  await db.run('UPDATE fotos SET titulo = ?, descricao = ?, album_id = ? WHERE id = ?',
    linha(req.body?.titulo ?? f.titulo, 100), texto(req.body?.descricao ?? f.descricao, 500), album, f.id);
  res.json({ ok: true });
});

r.delete('/fotos/:id', async (req, res) => {
  const f = await buscarFoto(req);
  await db.lote([['DELETE FROM fotos WHERE id = ?', f.id], comandoApagarArquivo(f.arquivo)]);
  await anotar(req, 'Apagou uma foto da galeria', f.titulo || `enviada por ${f.enviado_por_nome}`);
  res.json({ ok: true });
});

module.exports = r;
