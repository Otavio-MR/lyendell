// Juramento da Casa Luckham: quem quer morar na Capital jura lealdade à Casa diante da bandeira.
// A lista de quem já jurou sai dos registros do Tabelionato (Moradores, Nobres e Outros aprovados).

const express = require('express');
const { exigirLogin, exigir } = require('../auth');
const { pessoasRegistradas } = require('../moradores');

const r = express.Router();
r.use(exigirLogin, exigir('tabelionato.ver'));

r.get('/', async (req, res) => {
  const pessoas = (await pessoasRegistradas())
    .map(p => ({ nome: p.nome, nick: p.nick, livro: p.livro, livro_id: p.livro_id, registro_id: p.registro_id, numero: p.numero, foto: p.foto, desde: p.desde }))
    // Na ordem em que juraram (o mais antigo primeiro).
    .sort((a, b) => String(a.desde || '9999').localeCompare(String(b.desde || '9999')) || a.livro_id - b.livro_id || (a.numero || 0) - (b.numero || 0));
  res.json({ pessoas });
});

module.exports = r;
