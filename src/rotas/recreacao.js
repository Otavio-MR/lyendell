const express = require('express');
const { db } = require('../db');
const { exigir } = require('../auth');
const { erro, inteiro, linha } = require('../util');

const r = express.Router();
r.use(exigir('recreacao.usar'));

const TAMANHOS = ['3x3', '4x4', '5x5'];

// Vitórias, derrotas e empates de cada pessoa num jogo ao vivo.
const rankingAoVivo = jogo => db.all(`
  SELECT nome, SUM(v) AS vitorias, SUM(d) AS derrotas, SUM(e) AS empates FROM (
    SELECT jogador1_nome AS nome, vencedor = 1 AS v, vencedor = 2 AS d, vencedor IS NULL AS e FROM partidas WHERE jogo = ?
    UNION ALL
    SELECT jogador2_nome, vencedor = 2, vencedor = 1, vencedor IS NULL FROM partidas WHERE jogo = ?
  ) GROUP BY nome ORDER BY vitorias DESC, derrotas ASC, nome LIMIT 10`, jogo, jogo);

r.get('/ranking', async (req, res) => {
  const [velha, ppt, cobrinha, ...quebra] = await Promise.all([
    rankingAoVivo('velha'),
    rankingAoVivo('ppt'),
    db.all("SELECT usuario_nome AS nome, MAX(pontos) AS pontos FROM recordes WHERE jogo = 'cobrinha' GROUP BY usuario_nome ORDER BY pontos DESC LIMIT 10"),
    ...TAMANHOS.map(t => db.all(`
      SELECT usuario_nome AS nome, MIN(pontos) AS segundos FROM recordes WHERE jogo = 'quebra' AND variante = ?
      GROUP BY usuario_nome ORDER BY segundos LIMIT 10`, t)),
  ]);
  res.json({ velha, ppt, cobrinha, quebra: Object.fromEntries(TAMANHOS.map((t, i) => [t, quebra[i]])) });
});

// Resultado de um jogo que roda no navegador (cobrinha: cenouras comidas; quebra-cabeça: segundos).
r.post('/recordes', async (req, res) => {
  const jogo = req.body?.jogo;
  let variante = '';
  let pontos;
  if (jogo === 'cobrinha') {
    pontos = inteiro(req.body?.pontos, { min: 0, max: 400 });
  } else if (jogo === 'quebra') {
    variante = TAMANHOS.includes(req.body?.variante) ? req.body.variante : null;
    pontos = inteiro(req.body?.pontos, { min: 1, max: 24 * 3600 });
    if (!variante) throw erro(400, 'Tamanho de quebra-cabeça inválido.');
  } else {
    throw erro(400, 'Jogo desconhecido.');
  }
  if (pontos == null) throw erro(400, 'Resultado inválido.');
  const melhorQuery = jogo === 'cobrinha'
    ? "SELECT MAX(pontos) AS m FROM recordes WHERE jogo = 'cobrinha' AND usuario_id = ?"
    : "SELECT MIN(pontos) AS m FROM recordes WHERE jogo = 'quebra' AND variante = ? AND usuario_id = ?";
  const antes = (await (jogo === 'cobrinha' ? db.get(melhorQuery, req.usuario.id) : db.get(melhorQuery, variante, req.usuario.id))).m;
  await db.run('INSERT INTO recordes (jogo, variante, usuario_id, usuario_nome, pontos, detalhe) VALUES (?, ?, ?, ?, ?, ?)',
    jogo, variante, req.usuario.id, req.usuario.nome, pontos, linha(req.body?.detalhe, 60));
  const recorde = antes == null || (jogo === 'cobrinha' ? pontos > antes : pontos < antes);
  res.status(201).json({ recorde, anterior: antes });
});

module.exports = r;
