// Portões da muralha de Lyendell (no mapa). Cada um tem nome, direção, posição, o destino (a cidade ou
// região para onde leva) e um texto livre. A lista vem junto com as casas no GET /api/casas;
// aqui ficam criar, editar, mover e tirar do mapa (quem tem "mapa.editar").
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir } = require('../auth');
const { anotar } = require('../diario');
const { erro, texto, linha, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin);
const editar = exigir('mapa.editar');

const [LARGURA, ALTURA] = [1154, 773]; // o tamanho do mapa
const DIRECOES = ['norte', 'sul', 'leste', 'oeste', 'outro'];

function lerPortao(b = {}, atual = null) {
  const a = atual || {};
  const nome = linha(b.nome ?? a.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao portão.');
  const direcao = b.direcao ?? a.direcao ?? 'outro';
  if (!DIRECOES.includes(direcao)) throw erro(400, 'Direção inválida. Use norte, sul, leste, oeste ou outro.');
  const x = Number(b.x ?? a.x);
  const y = Number(b.y ?? a.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > LARGURA || y < 0 || y > ALTURA) throw erro(400, 'Essa posição fica fora do mapa.');
  return {
    nome, direcao,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    destino: linha(b.destino ?? a.destino ?? '', 80),
    sobre: texto(b.sobre ?? a.sobre ?? '', 600),
  };
}

const COLUNAS = ['nome', 'direcao', 'x', 'y', 'destino', 'sobre'];
const valores = p => COLUNAS.map(c => p[c]);

r.post('/', editar, async (req, res) => {
  const p = lerPortao(req.body);
  const { id } = await db.run(`INSERT INTO portoes (${COLUNAS.join(', ')}, atualizado_por_nome) VALUES (${COLUNAS.map(() => '?').join(', ')}, ?)`,
    ...valores(p), req.usuario.nome);
  await anotar(req, 'Colocou um portão no mapa', p.nome);
  res.status(201).json({ id });
});

async function buscar(req) {
  const p = await db.get('SELECT * FROM portoes WHERE id = ?', idDaRota(req));
  if (!p) throw erro(404, 'Portão não encontrado.');
  return p;
}

r.put('/:id', editar, async (req, res) => {
  const atual = await buscar(req);
  const p = lerPortao(req.body, atual);
  await db.run(`UPDATE portoes SET ${COLUNAS.map(c => `${c} = ?`).join(', ')}, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
    ...valores(p), req.usuario.nome, atual.id);
  // Só arrastar para outro lugar não vai para o diário (seria uma linha por arrasto).
  const soMoveu = COLUNAS.filter(c => c !== 'x' && c !== 'y' && c !== 'direcao').every(c => String(p[c]) === String(atual[c] ?? ''));
  if (!soMoveu) await anotar(req, 'Editou um portão do mapa', p.nome);
  res.json({ ok: true });
});

r.delete('/:id', editar, async (req, res) => {
  const p = await buscar(req);
  await db.run('DELETE FROM portoes WHERE id = ?', p.id);
  await anotar(req, 'Tirou um portão do mapa', p.nome);
  res.json({ ok: true });
});

module.exports = r;
module.exports.DIRECOES = DIRECOES;
