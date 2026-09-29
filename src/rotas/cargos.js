const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode } = require('../auth');
const { CATALOGO, VALIDAS, EXCLUSIVAS } = require('../permissoes');
const { anotar } = require('../diario');
const { erro, linha, texto, idDaRota } = require('../util');

const r = express.Router();

function formatar(c) {
  return { ...c, base: !!c.base, permissoes: JSON.parse(c.permissoes).filter(p => VALIDAS.has(p)) };
}

function lerCorpo(req, atual) {
  const nome = linha(req.body?.nome ?? atual?.nome, 40);
  if (nome.length < 2) throw erro(400, 'Dê um nome ao cargo.');
  const cor = /^#[0-9a-f]{6}$/i.test(req.body?.cor) ? req.body.cor : (atual?.cor || '#d8b13a');
  const descricao = texto(req.body?.descricao ?? atual?.descricao, 200);
  const lista = Array.isArray(req.body?.permissoes) ? req.body.permissoes : JSON.parse(atual?.permissoes || '[]');
  const permissoes = [...new Set(lista.filter(p => VALIDAS.has(p)))];
  // Quem não é o administrador principal só concede o que ele mesmo tem.
  if (!req.usuario.is_root) {
    const falta = permissoes.find(p => !req.usuario.permissoes.has(p));
    if (falta) throw erro(403, 'Você não pode dar a um cargo um poder que você mesmo não tem.');
  }
  return { nome, cor, descricao, permissoes };
}

// Aprovar registros só pode estar num cargo por módulo (a Tabeliã no Tabelionato, o Comandante na Guarda).
async function conferirExclusivas(permissoes, excetoId = 0, base = false) {
  for (const p of permissoes.filter(x => EXCLUSIVAS[x])) {
    if (base) throw erro(400, 'O cargo de Morador não pode aprovar registros.');
    const dono = (await db.all('SELECT id, nome, permissoes FROM cargos WHERE id <> ?', excetoId))
      .find(c => JSON.parse(c.permissoes).includes(p));
    if (dono) throw erro(400, `Aprovar registros é exclusivo de um só cargo e já pertence ao cargo "${dono.nome}".`);
  }
}

async function nomeLivre(nome, excetoId = 0) {
  if (await db.get('SELECT id FROM cargos WHERE nome = ? AND id <> ?', nome, excetoId)) {
    throw erro(409, `Já existe um cargo chamado "${nome}".`);
  }
}

async function buscar(req) {
  const c = await db.get('SELECT * FROM cargos WHERE id = ?', idDaRota(req));
  if (!c) throw erro(404, 'Cargo não encontrado.');
  if (!req.usuario.is_root && JSON.parse(c.permissoes).some(p => !req.usuario.permissoes.has(p))) {
    throw erro(403, 'Este cargo tem poderes que você não tem, então você não pode alterá-lo.');
  }
  return c;
}

r.get('/', exigirLogin, async (req, res) => {
  if (!pode(req, 'usuarios.ver') && !pode(req, 'cargos.gerenciar')) throw erro(403, 'Você não tem permissão para isso.');
  const [cargos, total] = await Promise.all([
    db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM usuario_cargos uc WHERE uc.cargo_id = c.id) AS usuarios
      FROM cargos c ORDER BY c.base DESC, c.ordem, c.id`),
    db.get('SELECT COUNT(*) AS n FROM usuarios'),
  ]);
  res.json({
    cargos: cargos.map(c => ({ ...formatar(c), usuarios: c.base ? total.n : c.usuarios })),
    catalogo: CATALOGO,
    exclusivas: Object.keys(EXCLUSIVAS),
  });
});

r.post('/', exigir('cargos.gerenciar'), async (req, res) => {
  const c = lerCorpo(req);
  await nomeLivre(c.nome);
  await conferirExclusivas(c.permissoes);
  const ordem = ((await db.get('SELECT MAX(ordem) AS m FROM cargos')).m ?? 0) + 1;
  const { id } = await db.run('INSERT INTO cargos (nome, descricao, cor, permissoes, ordem) VALUES (?, ?, ?, ?, ?)',
    c.nome, c.descricao, c.cor, JSON.stringify(c.permissoes), ordem);
  await anotar(req, 'Criou um cargo', c.nome);
  res.status(201).json({ id });
});

r.put('/:id', exigir('cargos.gerenciar'), async (req, res) => {
  const atual = await buscar(req);
  const c = lerCorpo(req, atual);
  await nomeLivre(c.nome, atual.id);
  await conferirExclusivas(c.permissoes, atual.id, !!atual.base);
  await db.run('UPDATE cargos SET nome = ?, descricao = ?, cor = ?, permissoes = ? WHERE id = ?',
    c.nome, c.descricao, c.cor, JSON.stringify(c.permissoes), atual.id);
  await anotar(req, 'Editou um cargo', c.nome);
  res.json({ ok: true });
});

r.delete('/:id', exigir('cargos.gerenciar'), async (req, res) => {
  const c = await buscar(req);
  if (c.base) throw erro(400, 'O cargo de Morador é a base de todos e não pode ser apagado.');
  await db.lote([
    ['DELETE FROM usuario_cargos WHERE cargo_id = ?', c.id],
    ['DELETE FROM cargos WHERE id = ?', c.id],
  ]);
  await anotar(req, 'Apagou um cargo', c.nome);
  res.json({ ok: true });
});

module.exports = r;
