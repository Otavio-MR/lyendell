const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode } = require('../auth');
const { upload, salvarArquivo } = require('../uploads');
const { erro, linha, inteiro } = require('../util');

const r = express.Router();
r.use(exigirLogin);

// Resumo da página inicial: só mostra o que a pessoa pode ver.
r.get('/inicio', async (req, res) => {
  const out = { numeros: {} };
  const contarModulo = async m => (await db.get('SELECT COUNT(*) AS n FROM registros r JOIN livros l ON l.id = r.livro_id WHERE l.modulo = ?', m)).n;
  const tarefas = [];
  if (pode(req, 'tabelionato.ver')) tarefas.push(contarModulo('tabelionato').then(n => { out.numeros.tabelionato = n; }));
  if (pode(req, 'guarda.ver')) tarefas.push(contarModulo('guarda').then(n => { out.numeros.guarda = n; }));
  if (pode(req, 'usuarios.ver')) tarefas.push(db.get('SELECT COUNT(*) AS n FROM usuarios WHERE ativo = 1').then(x => { out.numeros.usuarios = x.n; }));
  if (pode(req, 'galeria.ver')) {
    tarefas.push(db.get('SELECT COUNT(*) AS n FROM fotos').then(x => { out.numeros.fotos = x.n; }));
    tarefas.push(db.all('SELECT id, titulo, arquivo FROM fotos ORDER BY id DESC LIMIT 8').then(x => { out.fotos = x; }));
  }
  if (pode(req, 'atividades.ver')) {
    tarefas.push(db.get("SELECT COUNT(*) AS n FROM atividades WHERE status = 'aberta'").then(x => { out.numeros.atividades = x.n; }));
    tarefas.push(db.all(`
      SELECT a.id, a.titulo, a.item, a.meta, a.pacote, a.prazo,
        COALESCE((SELECT SUM(quantidade) FROM contribuicoes c WHERE c.atividade_id = a.id), 0) AS total
      FROM atividades a WHERE a.status = 'aberta' ORDER BY a.id DESC LIMIT 4`).then(x => { out.atividades = x; }));
  }
  if (pode(req, 'anuncios.ver')) {
    tarefas.push(db.all('SELECT id, titulo, conteudo, importancia, fixado, autor_nome, criado_em FROM anuncios ORDER BY fixado DESC, id DESC LIMIT 3')
      .then(x => { out.anuncios = x; }));
  }
  await Promise.all(tarefas);
  res.json(out);
});

// Envio avulso de imagem (retratos nos registros, imagens de anúncios).
const PODE_ENVIAR = ['galeria.enviar', 'anuncios.publicar', 'tabelionato.registrar', 'tabelionato.editar', 'guarda.registrar', 'guarda.editar'];
r.post('/upload', (req, res, next) => {
  if (!PODE_ENVIAR.some(p => pode(req, p))) return next(erro(403, 'Você não tem permissão para enviar imagens.'));
  next();
}, upload.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha uma imagem para enviar.');
  res.status(201).json({ url: await salvarArquivo(req.file, req.usuario.id) });
});

// Diário do sistema
r.get('/diario', exigir('diario.ver'), async (req, res) => {
  const q = linha(req.query.q, 60);
  const antes = inteiro(req.query.antes, { min: 1 }) ?? Number.MAX_SAFE_INTEGER;
  const busca = `%${q.replace(/[%_]/g, '')}%`;
  const itens = await db.all(`
    SELECT * FROM diario
    WHERE id < ? AND (? = '' OR usuario_nome LIKE ? OR acao LIKE ? OR detalhe LIKE ?)
    ORDER BY id DESC LIMIT 100`, antes, q, busca, busca, busca);
  res.json({ itens, mais: itens.length === 100 });
});

module.exports = r;
