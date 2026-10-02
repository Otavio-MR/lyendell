// Caixa de Pegadinhas do Bobo da Corte (veja src/bobo.js para as regras e os tempos de espera).

const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const bobo = require('../bobo');
const recreacao = require('../recreacao');
const antispam = require('../antispam');
const { erro, texto, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin);

const ehBobo = exigir('bobo.pegadinhas');
const traduzir = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    throw e instanceof bobo.ErroBobo ? erro(429, e.message) : e;
  }
};

// Tudo da Caixa: as pegadinhas, quanto falta para cada uma, quem pode cair e o histórico.
r.get('/', ehBobo, async (req, res) => {
  const agora = Date.now();
  const [esperas, historico, gente, protegidos] = await Promise.all([
    bobo.esperas(req.usuario.id, agora),
    bobo.historico(),
    db.all('SELECT id, nome, foto, moldura FROM usuarios WHERE ativo = 1 AND id <> ? ORDER BY nome COLLATE NOCASE', req.usuario.id),
    db.all(`SELECT alvo_id AS id, MAX(criado_em) AS em FROM pegadinhas WHERE alvo_id IS NOT NULL
      AND criado_em >= datetime('now', ?) GROUP BY alvo_id`, `-${Math.ceil(bobo.ESPERA.alvo / 1000)} seconds`),
  ]);
  const ate = Object.fromEntries(protegidos.map(p => [p.id, Date.parse(p.em.replace(' ', 'T') + 'Z') + bobo.ESPERA.alvo]));
  res.json({
    tipos: Object.entries(bobo.TIPOS).map(([chave, t]) => ({ chave, ...t })),
    esperas, // ms que faltam
    tempos: { pegadinha: bobo.ESPERA.pegadinha, alvo: bobo.ESPERA.alvo, confete: bobo.ESPERA.confete, piada: bobo.ESPERA.piada },
    pessoas: gente.map(p => ({ ...p, online: recreacao.estaOnline(p.id), protegidoPor: Math.max(0, (ate[p.id] || 0) - agora) })),
    historico,
  });
});

// Pregar uma peça. alvo: id de quem vai cair (no confete, ninguém: é para todos).
r.post('/pegadinha', ehBobo, traduzir(async (req, res) => {
  const tipo = String(req.body?.tipo || '');
  const alvoId = Number(req.body?.alvo) || 0;
  const alvo = alvoId ? await db.get('SELECT id, nome FROM usuarios WHERE id = ? AND ativo = 1', alvoId) : null;
  if (alvoId && !alvo) throw erro(404, 'Essa pessoa não existe.');
  const p = await bobo.pregar(req.usuario, tipo, alvo);
  const naHora = recreacao.entregarPegadinha(p);
  if (naHora || p.tipo === 'nariz') await bobo.marcarEntregue(p.id);
  await anotar(req, 'Pregou uma peça', `${bobo.TIPOS[tipo].nome}${alvo ? ` em ${alvo.nome}` : ' em todo mundo'}`);
  await progresso.registrar(req.usuario.id, 'pegadinha');
  if (alvo) await progresso.registrar(alvo.id, 'caiu');
  res.status(201).json({ ok: true, naHora, esperas: await bobo.esperas(req.usuario.id) });
}));

// Piada na praça: aparece em destaque no chat da cidade.
r.post('/piada', ehBobo, traduzir(async (req, res) => {
  const t = texto(req.body?.texto, 300).replace(/\s+/g, ' ').trim();
  if (t.length < 5) throw erro(400, 'Escreva a piada (pelo menos umas palavrinhas).');
  const espera = (await bobo.esperas(req.usuario.id)).piada;
  if (espera) throw erro(429, `A plateia ainda está rindo da última. Próxima piada em ${Math.ceil(espera / 60_000)} min.`);
  if (antispam.silenciadoAte(req.usuario.id) > Date.now()) throw erro(429, 'Você está silenciado no chat por um tempinho.');
  await recreacao.publicarNoChat(req.usuario, t, 'piada');
  await progresso.registrar(req.usuario.id, 'piada');
  res.status(201).json({ ok: true, esperas: await bobo.esperas(req.usuario.id) });
}));

// Quem caiu reage (o Bobo fica sabendo na hora).
r.post('/pegadinhas/:id/reacao', traduzir(async (req, res) => {
  const p = await bobo.reagir(req.usuario.id, idDaRota(req), String(req.body?.reacao || ''));
  if (p) recreacao.paraUsuario(p.de_id, 'bobo:reacao', { nome: req.usuario.nome, texto: p.texto, reacao: p.reacao, pegadinha: bobo.TIPOS[p.tipo]?.nome });
  res.json({ ok: true });
}));

module.exports = r;
