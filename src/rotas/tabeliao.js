// Quem é a Tabeliã de Lyendell: quem tem o cargo "Tabeliã". O nome vai na assinatura dos documentos do Tabelionato
// (lista de moradores e documento de identidade). Basta ver o Tabelionato (ou ser Aliado).
const express = require('express');
const { db } = require('../db');
const { exigirLogin, pode } = require('../auth');
const { erro } = require('../util');

const r = express.Router();
r.use(exigirLogin, (req, res, next) => next(pode(req, 'tabelionato.ver') || pode(req, 'aliados.ver') ? undefined : erro(403, 'Você não tem permissão para isso.')));

r.get('/', async (req, res) => {
  const l = await db.get(`SELECT u.nome FROM usuarios u JOIN usuario_cargos uc ON uc.usuario_id = u.id JOIN cargos c ON c.id = uc.cargo_id
    WHERE c.nome = 'Tabeliã' COLLATE NOCASE AND u.ativo = 1 ORDER BY u.id LIMIT 1`);
  res.json({ nome: l?.nome || null });
});

module.exports = r;
