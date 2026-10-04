// Sprites dos jogos: quem tem "sprites.editar" troca o desenho de uma peça de um jogo por uma imagem
// (uma tira de quadros lado a lado). Sem imagem, o jogo continua com o desenho feito por código.
// As peças e as animações de cada jogo estão em public/js/sprites/ (o servidor só guarda o que foi enviado).
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { erro } = require('../util');

const r = express.Router();
r.use(exigirLogin);
const editar = exigir('sprites.editar');

// "jogo.peca" ou "jogo.peca.animacao" (letras minúsculas, números e hífen).
const CHAVE = /^[a-z0-9-]{1,30}(?:\.[a-z0-9-]{1,30}){1,3}$/;
const inteiro = (v, min, max, padrao) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};
const avisar = () => { try { require('../recreacao').paraTodos('sprites', {}); } catch { /* sem conexões ainda */ } };

r.get('/', async (req, res) => {
  const linhas = await db.all('SELECT chave, src, quadros, fps, tingir, suave, por_nome, atualizado_em FROM sprites ORDER BY chave');
  const sprites = {};
  for (const l of linhas) sprites[l.chave] = { src: l.src, quadros: l.quadros, fps: l.fps, tingir: !!l.tingir, suave: !!l.suave, por: l.por_nome, em: l.atualizado_em };
  res.json({ sprites, podeEditar: pode(req, 'sprites.editar') });
});

r.put('/:chave', editar, async (req, res) => {
  const chave = String(req.params.chave || '');
  if (!CHAVE.test(chave)) throw erro(400, 'Peça inválida.');
  const b = req.body || {};
  const antigo = await db.get('SELECT src FROM sprites WHERE chave = ?', chave);
  const src = b.src === undefined && antigo ? antigo.src : b.src;
  if (!urlValida(src)) throw erro(400, 'Envie a imagem do sprite (PNG, GIF ou WEBP).');
  const quadros = inteiro(b.quadros, 1, 64, 1);
  const fps = inteiro(b.fps, 1, 30, 8);
  const comandos = [[
    `INSERT INTO sprites (chave, src, quadros, fps, tingir, suave, por_nome, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (chave) DO UPDATE SET src = excluded.src, quadros = excluded.quadros, fps = excluded.fps, tingir = excluded.tingir,
       suave = excluded.suave, por_nome = excluded.por_nome, atualizado_em = excluded.atualizado_em`,
    chave, src, quadros, fps, b.tingir ? 1 : 0, b.suave ? 1 : 0, req.usuario.nome,
  ]];
  // A imagem antiga sai do banco quando é trocada.
  if (antigo && antigo.src !== src) { const c = comandoApagarArquivo(antigo.src); if (c) comandos.push(c); }
  await db.lote(comandos);
  await anotar(req, antigo ? 'Trocou um sprite dos jogos' : 'Colocou um sprite nos jogos', chave);
  avisar();
  res.json({ ok: true });
});

r.delete('/:chave', editar, async (req, res) => {
  const chave = String(req.params.chave || '');
  const antigo = await db.get('SELECT src FROM sprites WHERE chave = ?', chave);
  if (!antigo) throw erro(404, 'Essa peça já está com o desenho original.');
  const comandos = [['DELETE FROM sprites WHERE chave = ?', chave]];
  const c = comandoApagarArquivo(antigo.src);
  if (c) comandos.push(c);
  await db.lote(comandos);
  await anotar(req, 'Voltou um sprite dos jogos para o desenho original', chave);
  avisar();
  res.json({ ok: true });
});

module.exports = r;
