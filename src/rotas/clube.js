// Club Coelho: o perfil de cada um no clube (cenouras, roupa, itens e toca), a loja e os minijogos.
// Quem está em cada sala, andando e falando, vai pelo WebSocket (src/clube.js).

const express = require('express');
const { db } = require('../db');
const { exigir } = require('../auth');
const { hoje } = require('../cobranca');
const progresso = require('../progresso');
const clube = require('../clube');
const { erro } = require('../util');

const r = express.Router();
r.use(exigir('recreacao.usar'));

// O meu perfil no clube, o catálogo e as salas. O presente do dia entra aqui (uma vez por dia).
r.get('/', async (req, res) => {
  const id = req.usuario.id;
  let eu = await clube.perfil(id);
  let presente = 0;
  const dia = hoje();
  if (eu.presente !== dia) {
    const { changes } = await db.run('UPDATE clube SET moedas = moedas + ?, presente = ? WHERE usuario_id = ? AND (presente IS NULL OR presente <> ?)',
      clube.PRESENTE, dia, id, dia);
    if (changes) { presente = clube.PRESENTE; eu = await clube.perfil(id); }
  }
  res.json({
    eu: { moedas: eu.moedas, visual: eu.visual, itens: eu.itens, toca: eu.toca, peixes: eu.peixes },
    presente, catalogo: clube.catalogoPublico(), tetoDia: clube.TETO_DIA,
    salas: Object.fromEntries(Object.entries(clube.SALAS).map(([k, s]) => [k, { nome: s.nome, chao: s.chao }])),
  });
});

// Comprar um item da loja (roupa e pelo uma vez só; móvel pode ter vários). Item novo só com o sprite enviado
// e enquanto está na loja.
r.post('/comprar', async (req, res) => {
  const id = req.usuario.id;
  await clube.pronto();
  const item = Object.hasOwn(clube.ITEM, String(req.body?.item)) ? clube.ITEM[req.body.item] : null;
  if (!item || item.preco === 0 || item.venda === false) throw erro(400, 'Esse item não está à venda.');
  const eu = await clube.perfil(id);
  const qtd = eu.itens[item.id] || 0;
  if (item.tipo !== 'movel' && qtd > 0) throw erro(400, 'Você já tem esse item.');
  if (item.tipo === 'movel' && qtd >= 20) throw erro(400, 'Você já tem muitos desses.');
  const { changes } = await db.run('UPDATE clube SET moedas = moedas - ? WHERE usuario_id = ? AND moedas >= ?', item.preco, id, item.preco);
  if (!changes) throw erro(400, `Faltam cenouras: ${item.nome} custa ${item.preco}.`);
  // Lê de novo antes de gravar (outra compra pode ter acontecido no meio).
  const atual = await clube.perfil(id);
  atual.itens[item.id] = (atual.itens[item.id] || 0) + 1;
  await db.run('UPDATE clube SET itens = ? WHERE usuario_id = ?', JSON.stringify(atual.itens), id);
  progresso.registrar(id, 'clube_compra');
  res.json({ moedas: atual.moedas, itens: atual.itens });
});

// Trocar de roupa (só com o que tem). Quem está na mesma sala do clube vê na hora.
r.put('/visual', async (req, res) => {
  const id = req.usuario.id;
  const eu = await clube.perfil(id);
  const visual = clube.validarVisual(req.body || {}, eu.itens);
  await db.run('UPDATE clube SET visual = ? WHERE usuario_id = ?', JSON.stringify(visual), id);
  clube.mudouVisual(id, visual);
  res.json({ visual });
});

// Redecorar a minha toca.
r.put('/toca', async (req, res) => {
  const id = req.usuario.id;
  const eu = await clube.perfil(id);
  const toca = clube.validarToca(req.body || {}, eu.itens);
  await db.run('UPDATE clube SET toca = ? WHERE usuario_id = ?', JSON.stringify(toca), id);
  clube.mudouToca(id, toca, req.usuario.nome);
  if (toca.moveis.length) progresso.registrar(id, 'clube_toca');
  res.json({ toca });
});

// Fim de um minijogo do clube: as cenouras ganhas (com teto por partida e por dia).
const MINIJOGOS = {
  pesca: { max: 60, cenouras: p => p * 3, limite: 40 },   // pontos = peixes pescados
  danca: { max: 60, cenouras: p => p / 400, limite: 100_000 },
};
// Os minijogos das salas da Ilha (src/clube-ilha/).
const ILHA = require('../clube-ilha');
Object.assign(MINIJOGOS, ILHA.minijogos);
const ultimoMinijogo = new Map();

// Progresso na Ilha (a faixa do ninja, a chave do capitão...): cada região diz quais chaves existem e
// como validar (src/clube-ilha/*.js, "progresso").
r.get('/progresso', async (req, res) => {
  const linhas = await db.all('SELECT chave, valor FROM clube_progresso WHERE usuario_id = ?', req.usuario.id);
  const p = {};
  for (const l of linhas) { try { p[l.chave] = JSON.parse(l.valor); } catch { p[l.chave] = null; } }
  res.json({ progresso: p });
});
r.post('/progresso', async (req, res) => {
  const chave = String(req.body?.chave || '');
  const validar = ILHA.progresso[chave];
  if (!validar) throw erro(400, 'Progresso desconhecido.');
  const linha = await db.get('SELECT valor FROM clube_progresso WHERE usuario_id = ? AND chave = ?', req.usuario.id, chave);
  let atual = null;
  try { atual = linha ? JSON.parse(linha.valor) : null; } catch { atual = null; }
  const valor = validar(req.body?.valor, atual, req.usuario.id);
  if (valor === undefined) throw erro(400, 'Esse progresso não vale.');
  const texto = JSON.stringify(valor);
  if (texto.length > 2000) throw erro(400, 'Progresso grande demais.');
  await db.run(`INSERT INTO clube_progresso (usuario_id, chave, valor) VALUES (?, ?, ?)
    ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = excluded.valor, atualizado_em = datetime('now')`, req.usuario.id, chave, texto);
  res.json({ ok: true, valor });
});
r.post('/minijogo', async (req, res) => {
  const id = req.usuario.id;
  const def = MINIJOGOS[req.body?.jogo];
  if (!def) throw erro(400, 'Minijogo desconhecido.');
  const pontos = Math.max(0, Math.min(def.limite, Math.floor(Number(req.body?.pontos) || 0)));
  const agora = Date.now();
  if (agora - (ultimoMinijogo.get(id) || 0) < (Number(process.env.CLUBE_MINIJOGO_MS) || 15_000)) throw erro(429, 'Calma! Espere um pouquinho antes de jogar de novo.');
  ultimoMinijogo.set(id, agora);
  // Minijogo que só paga uma vez por dia (ex.: o Baú do Capitão): guarda o dia em clube_progresso.
  if (def.umaVezPorDia) {
    const chave = `minijogo.${req.body.jogo}.dia`;
    const ja = await db.get('SELECT valor FROM clube_progresso WHERE usuario_id = ? AND chave = ?', id, chave);
    if (ja && JSON.parse(ja.valor) === hoje()) throw erro(429, 'Esse presente já foi pego hoje. Volte amanhã!');
    await db.run(`INSERT INTO clube_progresso (usuario_id, chave, valor) VALUES (?, ?, ?)
      ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = excluded.valor, atualizado_em = datetime('now')`, id, chave, JSON.stringify(hoje()));
  }
  const valia = Math.min(def.max, Math.floor(def.cenouras(pontos)));
  const ganhou = await clube.ganhar(id, valia);
  if (req.body.jogo === 'pesca' && pontos) await db.run('UPDATE clube SET peixes = peixes + ? WHERE usuario_id = ?', pontos, id);
  progresso.registrar(id, 'clube_jogo');
  const eu = await clube.perfil(id);
  res.json({ ganhou, moedas: eu.moedas, teto: ganhou < valia });
});

module.exports = r;
