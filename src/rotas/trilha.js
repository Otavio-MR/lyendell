// Trilha sonora do site: músicas enviadas em arquivo (MP3...), que tocam no player do canto da tela.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { uploadAudio, salvarArquivo, comandoApagarArquivo } = require('../uploads');
const { erro, linha, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin);
const gerenciar = exigir('trilha.gerenciar');

const lerTextos = b => ({ titulo: linha(b?.titulo, 100), autor: linha(b?.autor, 80), credito: linha(b?.credito, 200) });

// O multer lê o nome do arquivo como latin1, mas o navegador manda em UTF-8 ("Canção" chegaria "CanÃ§Ã£o").
function nomeDoArquivo(n) {
  const utf8 = Buffer.from(n, 'latin1').toString('utf8');
  return utf8.includes('�') ? n : utf8;
}

r.get('/', async (req, res) => {
  const musicas = await db.all("SELECT id, titulo, autor, url, credito, ordem, criado_por_nome FROM musicas WHERE tipo = 'arquivo' ORDER BY ordem, id");
  res.json({ musicas, podeGerenciar: pode(req, 'trilha.gerenciar') });
});

r.post('/arquivo', gerenciar, uploadAudio.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha o arquivo da música.');
  const t = lerTextos(req.body);
  // Sem título, usa o nome do arquivo ("Taverna_do_Coelho.mp3" vira "Taverna do Coelho").
  const titulo = t.titulo || linha(nomeDoArquivo(req.file.originalname).replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), 100) || 'Música';
  const url = await salvarArquivo(req.file, req.usuario.id);
  const { n } = await db.get('SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM musicas');
  const { id } = await db.run('INSERT INTO musicas (tipo, titulo, autor, url, credito, ordem, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'arquivo', titulo, t.autor, url, t.credito, Number(n), req.usuario.nome);
  await anotar(req, 'Adicionou uma música à trilha sonora', titulo);
  res.status(201).json({ id });
});

async function buscar(req) {
  const m = await db.get('SELECT * FROM musicas WHERE id = ?', idDaRota(req));
  if (!m) throw erro(404, 'Música não encontrada.');
  return m;
}

r.delete('/:id', gerenciar, async (req, res) => {
  const m = await buscar(req);
  await db.lote([['DELETE FROM musicas WHERE id = ?', m.id], m.tipo === 'arquivo' ? comandoApagarArquivo(m.url) : null]);
  await anotar(req, 'Tirou uma música da trilha sonora', m.titulo);
  res.json({ ok: true });
});

module.exports = r;
