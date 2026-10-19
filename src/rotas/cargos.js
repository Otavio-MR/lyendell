const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode, SQL_NAO_MORADOR } = require('../auth');
const { CATALOGO, VALIDAS, EXCLUSIVAS } = require('../permissoes');
const { anotar } = require('../diario');
const { erro, linha, texto, idDaRota } = require('../util');

const r = express.Router();

function formatar(c) {
  return { ...c, base: !!c.base, exclui_base: !!c.exclui_base, permissoes: JSON.parse(c.permissoes).filter(p => VALIDAS.has(p)) };
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
  // "Não é morador" (quem tem o cargo não recebe as permissões do Morador, como os Aliados): só o administrador
  // principal muda, e nunca no próprio cargo base.
  let excluiBase = atual?.exclui_base ? 1 : 0;
  if (req.usuario.is_root && req.body?.exclui_base !== undefined) excluiBase = req.body.exclui_base ? 1 : 0;
  if (atual?.base) excluiBase = 0;
  return { nome, cor, descricao, permissoes, exclui_base: excluiBase };
}

// Aprovar registros só pode estar num cargo por módulo (a Tabeliã no Tabelionato; na Guarda, o Lorde Comandante e o General).
async function conferirExclusivas(permissoes, excetoId = 0, base = false, nome = '') {
  for (const p of permissoes.filter(x => EXCLUSIVAS[x])) {
    const permitidos = [].concat(EXCLUSIVAS[p]);
    if (base) throw erro(400, 'O cargo de Morador não pode aprovar registros.');
    const outros = (await db.all('SELECT id, nome, permissoes FROM cargos WHERE id <> ?', excetoId)).filter(c => JSON.parse(c.permissoes).includes(p));
    // Quem tem a permissão fora do grupo permitido, ou um cargo de fora querendo entrar onde já há dono, é recusado.
    const dono = outros.find(c => !permitidos.includes(c.nome)) || (permitidos.includes(nome) ? null : outros[0]);
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
  // O Morador conta todos os usuários, menos os que não são moradores (os Aliados).
  const [cargos, total] = await Promise.all([
    db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM usuario_cargos uc WHERE uc.cargo_id = c.id) AS usuarios
      FROM cargos c ORDER BY c.base DESC, c.ordem, c.id`),
    db.get(`SELECT COUNT(*) AS n FROM usuarios u WHERE NOT ${SQL_NAO_MORADOR}`),
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
  await conferirExclusivas(c.permissoes, 0, false, c.nome);
  const ordem = ((await db.get('SELECT MAX(ordem) AS m FROM cargos')).m ?? 0) + 1;
  const { id } = await db.run('INSERT INTO cargos (nome, descricao, cor, permissoes, ordem, exclui_base) VALUES (?, ?, ?, ?, ?, ?)',
    c.nome, c.descricao, c.cor, JSON.stringify(c.permissoes), ordem, c.exclui_base);
  await anotar(req, 'Criou um cargo', c.nome);
  res.status(201).json({ id });
});

r.put('/:id', exigir('cargos.gerenciar'), async (req, res) => {
  const atual = await buscar(req);
  const c = lerCorpo(req, atual);
  await nomeLivre(c.nome, atual.id);
  await conferirExclusivas(c.permissoes, atual.id, !!atual.base, c.nome);
  await db.run('UPDATE cargos SET nome = ?, descricao = ?, cor = ?, permissoes = ?, exclui_base = ? WHERE id = ?',
    c.nome, c.descricao, c.cor, JSON.stringify(c.permissoes), c.exclui_base, atual.id);
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
