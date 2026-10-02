const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode } = require('../auth');
const { upload, salvarArquivo } = require('../uploads');
const { erro, linha, inteiro } = require('../util');
const { MODULOS } = require('../permissoes');

const r = express.Router();
r.use(exigirLogin);

// Resumo da página inicial: só mostra o que a pessoa pode ver.
r.get('/inicio', async (req, res) => {
  const out = { numeros: {} };
  const contarModulo = async m => (await db.get("SELECT COUNT(*) AS n FROM registros r JOIN livros l ON l.id = r.livro_id WHERE l.modulo = ? AND r.situacao = 'aprovado'", m)).n;
  const tarefas = [pendencias(req).then(p => { out.pendencias = p; })];
  for (const m of Object.keys(MODULOS)) {
    if (pode(req, `${m}.ver`)) tarefas.push(contarModulo(m).then(n => { out.numeros[m] = n; }));
  }
  if (pode(req, 'congresso.ver')) tarefas.push(novidades('congresso').then(x => { out.congresso = x; }));
  if (pode(req, 'leis.ver')) tarefas.push(novidades('leis').then(x => { out.leis = x; }));
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

// As últimas publicações do Congresso e das Leis de Lyendell, para ninguém ficar sem saber.
async function novidades(modulo) {
  const linhas = await db.all(`
    SELECT r.id, r.livro_id, r.numero, r.dados, COALESCE(r.revisado_em, r.criado_em) AS em, l.nome AS livro, l.campos
    FROM registros r JOIN livros l ON l.id = r.livro_id
    WHERE l.modulo = ? AND r.situacao = 'aprovado'
    ORDER BY COALESCE(r.revisado_em, r.criado_em) DESC, r.id DESC LIMIT 3`, modulo);
  return linhas.map(x => {
    const campos = JSON.parse(x.campos);
    const dados = JSON.parse(x.dados);
    const preenchidos = campos.filter(c => dados[c.id] != null && dados[c.id] !== '');
    const titulo = preenchidos.find(c => c.tipo === 'texto' || c.tipo === 'selecao');
    const resumo = String(dados[preenchidos.find(c => c.tipo === 'texto_longo')?.id] ?? '');
    return {
      id: x.id, livro_id: x.livro_id, livro: x.livro, numero: x.numero, em: x.em,
      titulo: titulo ? String(dados[titulo.id]) : 'sem título',
      etiquetas: preenchidos.filter(c => c.tipo === 'selecao' && c !== titulo).slice(0, 2).map(c => String(dados[c.id])),
      data: dados[preenchidos.find(c => c.tipo === 'data')?.id] || null,
      resumo: resumo.length > 220 ? `${resumo.slice(0, 220)}…` : resumo,
    };
  });
}

// Avisos do menu: registros esperando a minha aprovação e envios meus que foram recusados, por módulo.
async function pendencias(req) {
  const linhas = await db.all(`
    SELECT l.modulo, SUM(r.situacao = 'pendente') AS pendentes, SUM(r.situacao = 'recusado' AND r.criado_por = ?) AS recusados
    FROM registros r JOIN livros l ON l.id = r.livro_id WHERE r.situacao <> 'aprovado' GROUP BY l.modulo`, req.usuario.id);
  const out = {};
  for (const m of Object.keys(MODULOS)) {
    const l = linhas.find(x => x.modulo === m) || {};
    out[m] = { aprovar: pode(req, `${m}.aprovar`) ? l.pendentes || 0 : 0, recusados: l.recusados || 0 };
  }
  if (pode(req, 'congresso.aprovar')) {
    out.congresso.propostas = Number((await db.get("SELECT COUNT(*) AS n FROM propostas WHERE situacao = 'enviada'")).n);
  }
  return out;
}

r.get('/pendencias', async (req, res) => res.json(await pendencias(req)));

// Envio avulso de imagem (retratos nos registros, imagens de anúncios).
const PODE_ENVIAR = ['galeria.enviar', 'anuncios.publicar', 'mapa.editar', ...Object.keys(MODULOS).flatMap(m => [`${m}.registrar`, `${m}.editar`])];
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
