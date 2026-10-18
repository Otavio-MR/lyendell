// Escala da Guarda do Coelho: a agenda de turnos (o Comandante marca "o Guarda tal atende no dia X das H1 às H2"),
// as convocações ("preciso de guardas agora", avisadas no Discord, em que cada guarda confirma que compareceu e o
// Comandante confere e pode retirar quem não apareceu) e o controle de quem mais trabalha.
//   escala.ver    ver a agenda e as convocações; o guarda convocado responde ("Compareci")
//   escala.gerir  marcar, mudar e apagar turnos, convocar, retirar presença e ver o controle de todos
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const discord = require('../discord-guarda');
const { hoje } = require('../cobranca');
const { erro, texto, linha, idDaRota, dataValida } = require('../util');

const r = express.Router();
r.use(exigirLogin, exigir('escala.ver'));
const gerir = exigir('escala.gerir');

const CARGOS_GUARDA = ['Guarda', 'Comandante da Guarda'];
const SITUACOES_TURNO = ['agendado', 'cumprido', 'faltou'];
const hora = v => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '');
const minutos = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
// Duração do turno em horas; se termina antes de começar, passou da meia-noite.
const duracao = (ini, fim) => { const d = minutos(fim) - minutos(ini); return (d <= 0 ? d + 1440 : d) / 60; };

// Os guardas: quem tem o cargo Guarda ou Comandante da Guarda (e não é criança nem está desativado).
async function guardas() {
  const marcas = CARGOS_GUARDA.map(() => '?').join(',');
  return db.all(`SELECT DISTINCT u.id, u.nome, u.foto FROM usuarios u JOIN usuario_cargos uc ON uc.usuario_id = u.id JOIN cargos c ON c.id = uc.cargo_id
    WHERE c.nome COLLATE NOCASE IN (${marcas}) AND u.ativo = 1 AND u.crianca = 0 ORDER BY u.nome COLLATE NOCASE`, ...CARGOS_GUARDA);
}
async function guardaPorId(id) {
  const g = (await guardas()).find(x => x.id === Number(id));
  if (!g) throw erro(400, 'Esse usuário não é da Guarda.');
  return g;
}

// Sobreposição: dois turnos do mesmo guarda no mesmo dia que se cruzam (considerando virar a noite).
function cruza(a, b) {
  const faixa = t => { const i = minutos(t.inicio); const f = minutos(t.fim); return [i, f <= i ? f + 1440 : f]; };
  const [a1, a2] = faixa(a); const [b1, b2] = faixa(b);
  return a1 < b2 && b1 < a2;
}
async function conferirChoque(t, exceto = 0) {
  const doDia = await db.all('SELECT * FROM guarda_turnos WHERE usuario_id = ? AND data = ? AND id <> ?', t.usuario_id, t.data, exceto);
  const choque = doDia.find(x => cruza(t, x));
  if (choque) throw erro(409, `Esse guarda já tem turno nesse dia das ${choque.inicio} às ${choque.fim}.`);
}

/* ─── Agenda ─────────────────────────────────────── */

r.get('/guardas', async (req, res) => res.json({ guardas: await guardas() }));

r.get('/agenda', async (req, res) => {
  const hojeStr = hoje();
  const de = dataValida(req.query.de) || hojeStr;
  const ate = dataValida(req.query.ate) || de;
  if (ate < de) throw erro(400, 'O fim do período vem antes do começo.');
  const turnos = await db.all(`SELECT t.*, u.nome AS guarda_nome, u.foto AS guarda_foto FROM guarda_turnos t JOIN usuarios u ON u.id = t.usuario_id
    WHERE t.data >= ? AND t.data <= ? ORDER BY t.data, t.inicio, u.nome COLLATE NOCASE`, de, ate);
  // O dia da convocação é o de Brasília (o banco guarda em UTC). Guarda comum só vê as convocações em que foi convocado.
  const todas = pode(req, 'escala.gerir');
  const convocacoes = await db.all(`SELECT c.id, c.motivo, c.criada_por_nome, c.criada_em, c.encerrada_em FROM guarda_convocacoes c
    WHERE substr(datetime(c.criada_em, '-3 hours'), 1, 10) >= ? AND substr(datetime(c.criada_em, '-3 hours'), 1, 10) <= ?
    ${todas ? '' : 'AND EXISTS (SELECT 1 FROM guarda_convocados k WHERE k.convocacao_id = c.id AND k.usuario_id = ?)'} ORDER BY c.id DESC`, de, ate, ...(todas ? [] : [req.usuario.id]));
  res.json({ de, ate, hoje: hojeStr, turnos: turnos.map(t => ({ ...t, horas: duracao(t.inicio, t.fim), meu: t.usuario_id === req.usuario.id })), convocacoes });
});

function lerTurno(b) {
  const t = {
    data: dataValida(b?.data) || '',
    inicio: hora(b?.inicio), fim: hora(b?.fim),
    obs: linha(b?.obs ?? '', 200),
  };
  if (!t.data) throw erro(400, 'Informe o dia do turno.');
  if (!t.inicio || !t.fim) throw erro(400, 'Informe a hora de início e a de fim (formato 14:00).');
  if (t.inicio === t.fim) throw erro(400, 'O início e o fim não podem ser iguais.');
  return t;
}

// Marca um turno ou vários de uma vez: usuario_ids (um ou mais guardas) e datas (um ou mais dias), mesmo horário.
r.post('/turnos', gerir, async (req, res) => {
  const b = req.body || {};
  const ids = [...new Set((Array.isArray(b.usuario_ids) ? b.usuario_ids : [b.usuario_id]).map(Number).filter(Boolean))];
  const datas = [...new Set((Array.isArray(b.datas) ? b.datas : [b.data]).map(d => dataValida(d)).filter(Boolean))];
  if (!ids.length) throw erro(400, 'Escolha o guarda.');
  if (!datas.length) throw erro(400, 'Informe o dia do turno.');
  if (ids.length * datas.length > 200) throw erro(400, 'Muitos turnos de uma vez (máximo 200).');
  const base = lerTurno({ ...b, data: datas[0] });
  const lista = await guardas();
  const novos = [];
  for (const uid of ids) {
    const g = lista.find(x => x.id === uid);
    if (!g) throw erro(400, 'Um dos usuários escolhidos não é da Guarda.');
    for (const data of datas) { const t = { ...base, data, usuario_id: uid }; await conferirChoque(t); novos.push({ t, g }); }
  }
  // Também não pode haver dois turnos novos se cruzando entre si (mesmo guarda, mesmo dia): datas repetidas já foram unidas.
  await db.lote(novos.map(({ t }) => ['INSERT INTO guarda_turnos (usuario_id, data, inicio, fim, obs, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)', t.usuario_id, t.data, t.inicio, t.fim, t.obs, req.usuario.nome]));
  await anotar(req, 'Escala da Guarda: marcou turnos', `${novos.length} turno(s), ${base.inicio} às ${base.fim}, ${[...new Set(novos.map(n => n.g.nome))].join(', ')}`.slice(0, 280));
  res.status(201).json({ criados: novos.length });
});

r.put('/turnos/:id', gerir, async (req, res) => {
  const atual = await db.get('SELECT * FROM guarda_turnos WHERE id = ?', idDaRota(req));
  if (!atual) throw erro(404, 'Turno não encontrado.');
  const b = req.body || {};
  const t = { ...lerTurno({ data: b.data ?? atual.data, inicio: b.inicio ?? atual.inicio, fim: b.fim ?? atual.fim, obs: b.obs ?? atual.obs }), usuario_id: atual.usuario_id };
  if (b.usuario_id != null && Number(b.usuario_id) !== atual.usuario_id) { await guardaPorId(b.usuario_id); t.usuario_id = Number(b.usuario_id); }
  await conferirChoque(t, atual.id);
  await db.run('UPDATE guarda_turnos SET usuario_id = ?, data = ?, inicio = ?, fim = ?, obs = ? WHERE id = ?', t.usuario_id, t.data, t.inicio, t.fim, t.obs, atual.id);
  res.json({ ok: true });
});

r.post('/turnos/:id/situacao', gerir, async (req, res) => {
  const atual = await db.get('SELECT * FROM guarda_turnos WHERE id = ?', idDaRota(req));
  if (!atual) throw erro(404, 'Turno não encontrado.');
  if (!SITUACOES_TURNO.includes(req.body?.situacao)) throw erro(400, 'Situação inválida: agendado, cumprido ou faltou.');
  await db.run('UPDATE guarda_turnos SET situacao = ? WHERE id = ?', req.body.situacao, atual.id);
  res.json({ ok: true });
});

r.delete('/turnos/:id', gerir, async (req, res) => {
  const atual = await db.get('SELECT * FROM guarda_turnos WHERE id = ?', idDaRota(req));
  if (!atual) throw erro(404, 'Turno não encontrado.');
  await db.run('DELETE FROM guarda_turnos WHERE id = ?', atual.id);
  res.json({ ok: true });
});

/* ─── Convocações ────────────────────────────────── */

async function detalhes(id, req) {
  const conv = await db.get('SELECT * FROM guarda_convocacoes WHERE id = ?', id);
  if (!conv) throw erro(404, 'Convocação não encontrada.');
  const todos = await db.all(`SELECT k.*, u.nome, u.foto FROM guarda_convocados k JOIN usuarios u ON u.id = k.usuario_id WHERE k.convocacao_id = ? ORDER BY u.nome COLLATE NOCASE`, id);
  const euConvocado = todos.find(k => k.usuario_id === req.usuario.id) || null;
  if (!pode(req, 'escala.gerir') && !euConvocado) throw erro(403, 'Você não foi convocado.');
  const quem = pode(req, 'escala.gerir') ? todos : todos.filter(k => k.usuario_id === req.usuario.id);
  return {
    convocacao: { id: conv.id, motivo: conv.motivo, local: conv.local, criada_por_nome: conv.criada_por_nome, criada_em: conv.criada_em, encerrada_em: conv.encerrada_em, no_discord: !!conv.discord_msg },
    convocados: quem.map(k => ({ usuario_id: k.usuario_id, nome: k.nome, foto: k.foto, situacao: k.situacao, respondeu_em: k.respondeu_em, conferido: !!k.conferido, removido_por_nome: k.removido_por_nome, motivo_remocao: k.motivo_remocao })),
    totais: { convocados: todos.length, compareceram: todos.filter(k => k.situacao === 'compareceu').length, removidos: todos.filter(k => k.situacao === 'removido').length },
    eu: euConvocado ? { situacao: euConvocado.situacao, respondeu_em: euConvocado.respondeu_em } : null,
  };
}

// A lista: quem gere vê todas; o guarda vê só as em que foi convocado.
r.get('/convocacoes', async (req, res) => {
  const todas = pode(req, 'escala.gerir');
  const linhas = await db.all(`SELECT c.*,
      (SELECT COUNT(*) FROM guarda_convocados k WHERE k.convocacao_id = c.id) AS convocados,
      (SELECT COUNT(*) FROM guarda_convocados k WHERE k.convocacao_id = c.id AND k.situacao = 'compareceu') AS compareceram,
      (SELECT situacao FROM guarda_convocados k WHERE k.convocacao_id = c.id AND k.usuario_id = ?) AS minha_situacao
    FROM guarda_convocacoes c ${todas ? '' : 'WHERE EXISTS (SELECT 1 FROM guarda_convocados k WHERE k.convocacao_id = c.id AND k.usuario_id = ?)'} ORDER BY c.id DESC LIMIT 60`,
  ...(todas ? [req.usuario.id] : [req.usuario.id, req.usuario.id]));
  res.json({ convocacoes: linhas.map(c => ({ id: c.id, motivo: c.motivo, local: c.local, criada_por_nome: c.criada_por_nome, criada_em: c.criada_em, encerrada_em: c.encerrada_em, convocados: Number(c.convocados), compareceram: Number(c.compareceram), minha_situacao: c.minha_situacao || null })) });
});

r.get('/convocacoes/:id', async (req, res) => res.json(await detalhes(idDaRota(req), req)));

// Convoca: por padrão todos os guardas; usuario_ids escolhe só alguns.
r.post('/convocacoes', gerir, async (req, res) => {
  const b = req.body || {};
  const motivo = texto(b.motivo, 600);
  if (motivo.length < 3) throw erro(400, 'Diga o motivo da convocação.');
  const lista = await guardas();
  const escolhidos = Array.isArray(b.usuario_ids) && b.usuario_ids.length ? lista.filter(g => b.usuario_ids.map(Number).includes(g.id)) : lista;
  if (!escolhidos.length) throw erro(400, 'Não há guardas para convocar.');
  const { id } = await db.run('INSERT INTO guarda_convocacoes (motivo, local, criada_por_nome) VALUES (?, ?, ?)', motivo, linha(b.local ?? '', 120), req.usuario.nome);
  await db.lote(escolhidos.map(g => ['INSERT INTO guarda_convocados (convocacao_id, usuario_id) VALUES (?, ?)', id, g.id]));
  const conv = await db.get('SELECT * FROM guarda_convocacoes WHERE id = ?', id);
  let discordMsg = null;
  if (b.discord !== false) {
    discordMsg = await discord.enviar(conv);
    if (discordMsg) await db.run('UPDATE guarda_convocacoes SET discord_msg = ? WHERE id = ?', discordMsg, id);
  }
  await anotar(req, 'Escala da Guarda: convocou a Guarda', `${escolhidos.length} guarda(s): ${motivo.slice(0, 120)}`);
  res.status(201).json({ id, convocados: escolhidos.length, no_discord: !!discordMsg, discord_ativo: discord.ativo(), link: discord.link(id) });
});

// O guarda convocado aperta "Compareci". Fica como "compareceu" até o Comandante conferir (ou retirar).
r.post('/convocacoes/:id/comparecer', async (req, res) => {
  const id = idDaRota(req);
  const conv = await db.get('SELECT * FROM guarda_convocacoes WHERE id = ?', id);
  if (!conv) throw erro(404, 'Convocação não encontrada.');
  const k = await db.get('SELECT * FROM guarda_convocados WHERE convocacao_id = ? AND usuario_id = ?', id, req.usuario.id);
  if (!k) throw erro(403, 'Você não foi convocado.');
  if (conv.encerrada_em) throw erro(409, 'Esta convocação já foi encerrada.');
  if (k.situacao === 'removido') throw erro(409, 'O Comandante retirou a sua presença. Fale com ele.');
  if (k.situacao === 'compareceu') return res.json({ ok: true, ja: true });
  await db.run("UPDATE guarda_convocados SET situacao = 'compareceu', respondeu_em = datetime('now') WHERE convocacao_id = ? AND usuario_id = ?", id, req.usuario.id);
  res.json({ ok: true });
});

// O Comandante retira a presença de quem apertou e não apareceu (precisa do motivo), ou restaura/confirma.
r.post('/convocacoes/:id/remover', gerir, async (req, res) => {
  const id = idDaRota(req);
  const k = await db.get('SELECT * FROM guarda_convocados WHERE convocacao_id = ? AND usuario_id = ?', id, Number(req.body?.usuario_id));
  if (!k) throw erro(404, 'Esse guarda não está nessa convocação.');
  const motivo = linha(req.body?.motivo ?? '', 200);
  if (motivo.length < 3) throw erro(400, 'Diga o motivo (fica registrado).');
  await db.run("UPDATE guarda_convocados SET situacao = 'removido', removido_por_nome = ?, motivo_remocao = ?, conferido = 1 WHERE convocacao_id = ? AND usuario_id = ?", req.usuario.nome, motivo, id, k.usuario_id);
  await anotar(req, 'Escala da Guarda: retirou presença', `convocação ${id}, usuário ${k.usuario_id}: ${motivo}`);
  res.json({ ok: true });
});

r.post('/convocacoes/:id/confirmar', gerir, async (req, res) => {
  const id = idDaRota(req);
  const k = await db.get('SELECT * FROM guarda_convocados WHERE convocacao_id = ? AND usuario_id = ?', id, Number(req.body?.usuario_id));
  if (!k) throw erro(404, 'Esse guarda não está nessa convocação.');
  // Confirmar vale também para quem não apertou o botão (compareceu ao posto, mas esqueceu): o Comandante assume.
  await db.run("UPDATE guarda_convocados SET situacao = 'compareceu', conferido = 1, respondeu_em = COALESCE(respondeu_em, datetime('now')), removido_por_nome = NULL, motivo_remocao = NULL WHERE convocacao_id = ? AND usuario_id = ?", id, k.usuario_id);
  res.json({ ok: true });
});

r.post('/convocacoes/:id/encerrar', gerir, async (req, res) => {
  const conv = await db.get('SELECT * FROM guarda_convocacoes WHERE id = ?', idDaRota(req));
  if (!conv) throw erro(404, 'Convocação não encontrada.');
  if (conv.encerrada_em) throw erro(409, 'Esta convocação já foi encerrada.');
  await db.run("UPDATE guarda_convocacoes SET encerrada_em = datetime('now') WHERE id = ?", conv.id);
  await discord.encerrar(conv);
  res.json({ ok: true });
});

/* ─── Controle: quem mais trabalha ───────────────── */

// Por guarda, no período: turnos marcados, horas marcadas, horas cumpridas, faltas, convocações recebidas e atendidas.
r.get('/controle', gerir, async (req, res) => {
  const ate = dataValida(req.query.ate) || hoje();
  const de = dataValida(req.query.de) || new Date(new Date(`${ate}T12:00:00Z`).getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const lista = await guardas();
  const turnos = await db.all('SELECT * FROM guarda_turnos WHERE data >= ? AND data <= ?', de, ate);
  const convs = await db.all(`SELECT k.* FROM guarda_convocados k JOIN guarda_convocacoes c ON c.id = k.convocacao_id WHERE substr(datetime(c.criada_em, '-3 hours'), 1, 10) >= ? AND substr(datetime(c.criada_em, '-3 hours'), 1, 10) <= ?`, de, ate);
  const linhas = lista.map(g => {
    const t = turnos.filter(x => x.usuario_id === g.id);
    const k = convs.filter(x => x.usuario_id === g.id);
    const soma = fn => Math.round(t.filter(fn).reduce((s, x) => s + duracao(x.inicio, x.fim), 0) * 10) / 10;
    const atendidas = k.filter(x => x.situacao === 'compareceu').length;
    return {
      usuario_id: g.id, nome: g.nome, foto: g.foto,
      turnos: t.length, horas_marcadas: soma(() => true), horas_cumpridas: soma(x => x.situacao === 'cumprido'),
      turnos_cumpridos: t.filter(x => x.situacao === 'cumprido').length, faltas: t.filter(x => x.situacao === 'faltou').length,
      convocacoes: k.length, atendidas, removidas: k.filter(x => x.situacao === 'removido').length,
      taxa_convocacao: k.length ? Math.round((atendidas / k.length) * 100) : null,
      pontos: Math.round((soma(x => x.situacao === 'cumprido') + atendidas) * 10) / 10,
    };
  }).sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'));
  res.json({ de, ate, guardas: linhas });
});

module.exports = r;
