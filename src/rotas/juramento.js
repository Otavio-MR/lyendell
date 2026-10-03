// Juramento da Casa Luckham: quem quer morar na Capital jura lealdade à Casa diante da bandeira.
// Só Moradores e Nobres juram (quem está em Outros é de outra casa ou presta serviço à Capital).
// Quem tem registro aprovado conta como quem já jurou; a Família Nobre e a Tabeliã podem marcar quem
// ainda não jurou (e desmarcar).

const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { pessoasRegistradas } = require('../moradores');
const { erro, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin, exigir('tabelionato.ver'));

const JURAM = /morador|nobre/i;
const hoje = () => new Date().toISOString().slice(0, 10);

r.get('/', async (req, res) => {
  const marcas = new Map((await db.all('SELECT * FROM juramentos')).map(m => [m.registro_id, m]));
  const pessoas = (await pessoasRegistradas())
    .filter(p => JURAM.test(p.livro))
    .map(p => {
      const m = marcas.get(p.registro_id);
      const jurou = m ? !!m.jurou : true;
      return {
        nome: p.nome, nick: p.nick, livro: p.livro, livro_id: p.livro_id, registro_id: p.registro_id, numero: p.numero, foto: p.foto,
        jurou,
        // A data do juramento: a de chegada do registro; ou o dia em que foi marcado; ou o dia do registro.
        desde: (/^\d{4}-\d{2}-\d{2}$/.test(p.desde || '') ? p.desde : null) || (m?.jurou ? m.em : null) || p.desde,
        marcado_por: m?.por_nome || null,
      };
    })
    .sort((a, b) => String(a.desde || '9999').localeCompare(String(b.desde || '9999')) || a.livro_id - b.livro_id || (a.numero || 0) - (b.numero || 0));
  const podeMarcar = pode(req, 'juramento.marcar');
  res.json({
    juraram: pessoas.filter(p => p.jurou),
    // Quem ainda não jurou só aparece para quem marca.
    naoJuraram: podeMarcar ? pessoas.filter(p => !p.jurou) : [],
    podeMarcar,
  });
});

// Marcar se a pessoa já fez o juramento (Família Nobre e Tabeliã).
r.put('/:id', exigir('juramento.marcar'), async (req, res) => {
  const id = idDaRota(req);
  const reg = await db.get(`SELECT r.id, l.nome AS livro FROM registros r JOIN livros l ON l.id = r.livro_id
    WHERE r.id = ? AND r.situacao = 'aprovado' AND l.modulo = 'tabelionato'`, id);
  if (!reg || !JURAM.test(reg.livro)) throw erro(404, 'Só quem tem registro de Morador ou de Nobre faz o juramento.');
  const pessoa = (await pessoasRegistradas()).find(p => p.registro_id === id);
  const jurou = !!req.body?.jurou;
  await db.run(`INSERT INTO juramentos (registro_id, jurou, em, por_nome) VALUES (?, ?, ?, ?)
    ON CONFLICT (registro_id) DO UPDATE SET jurou = excluded.jurou, em = excluded.em, por_nome = excluded.por_nome, atualizado_em = datetime('now')`,
  id, jurou ? 1 : 0, jurou ? hoje() : null, req.usuario.nome);
  await anotar(req, jurou ? 'Marcou que fez o Juramento da Casa' : 'Marcou que ainda não fez o Juramento da Casa', pessoa?.nome || `registro ${id}`);
  res.json({ ok: true, jurou });
});

module.exports = r;
