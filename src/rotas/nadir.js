// A Grande Nadir no site: conversar com ela (nadir.usar), escrever no Livro de Nadir e ver o que perguntaram
// (nadir.ensinar). A resposta vem aos poucos (text/event-stream), para a tela escrever enquanto ela fala.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { erro, texto, linha, idDaRota } = require('../util');
const nadir = require('../nadir');

const r = express.Router();
r.use(exigirLogin, exigir('nadir.usar'));

const ensinar = exigir('nadir.ensinar');

r.get('/', async (req, res) => {
  const podeEnsinar = pode(req, 'nadir.ensinar');
  res.json({
    ativa: nadir.ativa(),
    limites: await nadir.limites(req.usuario),
    sugestoes: await nadir.sugestoes(),
    maxPergunta: nadir.MAX_PERGUNTA,
    podeEnsinar,
    // Só quem cuida da Nadir vê o que deu errado e quantas perguntas ficaram sem resposta.
    ...(podeEnsinar ? {
      erro: nadir.ultimoErro(),
      semResposta: (await db.get('SELECT COUNT(*) AS n FROM nadir_perguntas WHERE sem_resposta = 1 AND resolvida = 0')).n,
    } : {}),
  });
});

// A pergunta. Os eventos: "texto" (um pedaço da resposta), "fim" (a resposta inteira, as fichas de quem foi
// citado e quantas perguntas restam hoje) ou "erro" (uma frase para mostrar).
r.post('/perguntar', async (req, res) => {
  const pergunta = texto(req.body?.pergunta, nadir.MAX_PERGUNTA).replace(/\s+/g, ' ');
  if (pergunta.length < 2) throw erro(400, 'Escreva a sua pergunta.');
  if (!nadir.ativa()) throw erro(503, 'A Grande Nadir está em silêncio por enquanto. Avise a Família Nobre.');

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  const mandar = (evento, dados) => { if (!res.writableEnded) res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`); };
  let parar = null;
  res.on('close', () => { if (!res.writableEnded) parar?.(); }); // a pessoa fechou a tela: para de gastar
  try {
    const r0 = await nadir.perguntar(req.usuario, { pergunta, historico: req.body?.historico }, {
      aoTexto: t => mandar('texto', { t }),
      cancelar: fn => { parar = fn; },
    });
    mandar('fim', { resposta: r0.resposta, fichas: r0.fichas, semResposta: r0.semResposta, limites: r0.limites });
  } catch (e) {
    mandar('erro', { mensagem: e.status ? e.message : 'Algo deu errado. Tente de novo.' });
    if (!e.status) console.error('Nadir:', e);
  }
  res.end();
});

/* ─── O Livro de Nadir ───────────────────────────── */

function lerSaber(body, atual = {}) {
  const s = {
    categoria: Object.hasOwn(nadir.CATEGORIAS, String(body?.categoria)) ? body.categoria : (atual.categoria || 'outro'),
    titulo: linha(body?.titulo ?? atual.titulo, 120),
    apelidos: linha(body?.apelidos ?? atual.apelidos ?? '', 200),
    texto: texto(body?.texto ?? atual.texto, 8000),
    ativo: body?.ativo !== undefined ? (body.ativo ? 1 : 0) : (atual.ativo ?? 1),
  };
  if (s.titulo.length < 2) throw erro(400, 'Dê um título (o nome da pessoa, do lugar ou do assunto).');
  if (s.texto.length < 5) throw erro(400, 'Escreva o que a Nadir deve saber sobre isso.');
  return s;
}

r.get('/saber', ensinar, async (req, res) => {
  const saber = await db.all('SELECT * FROM nadir_saber ORDER BY categoria, titulo');
  res.json({ saber: saber.map(s => ({ ...s, ativo: !!s.ativo })), categorias: nadir.CATEGORIAS });
});

r.post('/saber', ensinar, async (req, res) => {
  const s = lerSaber(req.body);
  const { id } = await db.run('INSERT INTO nadir_saber (categoria, titulo, apelidos, texto, ativo, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
    s.categoria, s.titulo, s.apelidos, s.texto, s.ativo, req.usuario.nome);
  nadir.esquecer();
  await anotar(req, 'Escreveu no Livro de Nadir', s.titulo);
  res.status(201).json({ id });
});

r.put('/saber/:id', ensinar, async (req, res) => {
  const atual = await db.get('SELECT * FROM nadir_saber WHERE id = ?', idDaRota(req));
  if (!atual) throw erro(404, 'Essa página do Livro não existe mais.');
  const s = lerSaber(req.body, atual);
  await db.run("UPDATE nadir_saber SET categoria = ?, titulo = ?, apelidos = ?, texto = ?, ativo = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?",
    s.categoria, s.titulo, s.apelidos, s.texto, s.ativo, req.usuario.nome, atual.id);
  nadir.esquecer();
  await anotar(req, 'Mudou o Livro de Nadir', s.titulo);
  res.json({ ok: true });
});

r.delete('/saber/:id', ensinar, async (req, res) => {
  const atual = await db.get('SELECT * FROM nadir_saber WHERE id = ?', idDaRota(req));
  if (!atual) throw erro(404, 'Essa página do Livro não existe mais.');
  await db.run('DELETE FROM nadir_saber WHERE id = ?', atual.id);
  nadir.esquecer();
  await anotar(req, 'Apagou do Livro de Nadir', atual.titulo);
  res.json({ ok: true });
});

// O que perguntaram à Nadir (para saber o que falta ensinar). "semResposta=1": só as que ela não soube.
r.get('/perguntas', ensinar, async (req, res) => {
  const so = req.query.semResposta === '1';
  const perguntas = await db.all(`SELECT id, usuario_nome, pergunta, resposta, sem_resposta, resolvida, criado_em FROM nadir_perguntas
    ${so ? 'WHERE sem_resposta = 1 AND resolvida = 0' : ''} ORDER BY id DESC LIMIT 200`);
  const uso = await db.get(`SELECT COUNT(*) AS perguntas, COALESCE(SUM(tokens_entrada), 0) AS entrada, COALESCE(SUM(tokens_saida), 0) AS saida
    FROM nadir_perguntas WHERE criado_em >= datetime('now', '-30 days')`);
  res.json({ perguntas: perguntas.map(p => ({ ...p, sem_resposta: !!p.sem_resposta, resolvida: !!p.resolvida })), uso, modelo: nadir.MODELO });
});

// Marca uma pergunta sem resposta como resolvida (depois de escrever no Livro).
r.post('/perguntas/:id/resolvida', ensinar, async (req, res) => {
  await db.run('UPDATE nadir_perguntas SET resolvida = ? WHERE id = ?', req.body?.resolvida === false ? 0 : 1, idDaRota(req));
  res.json({ ok: true });
});

module.exports = r;
