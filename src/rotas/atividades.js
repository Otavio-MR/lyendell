const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { erro, linha, texto, idDaRota, inteiro, dataValida } = require('../util');

// Mural de Atividades: a cidade pede algo (ex.: 960 batatas), cada um assume
// uma parte, registra o que entregou e no fim a recompensa é dividida
// proporcionalmente ao que cada um entregou.
const STATUS = ['aberta', 'concluida', 'encerrada'];
const PACOTES = [64, 16, 1];

const r = express.Router();
r.use(exigirLogin);

const TOTAL = '(SELECT COALESCE(SUM(quantidade), 0) FROM contribuicoes c WHERE c.atividade_id = atividades.id)';
const SQL = `
  SELECT atividades.*, ${TOTAL} AS total,
    (SELECT COUNT(*) FROM participantes p WHERE p.atividade_id = atividades.id) AS n_participantes
  FROM atividades`;

const gestor = (req, a) => pode(req, 'atividades.gerenciar') || a.criado_por === req.usuario.id;

async function buscar(req, id = idDaRota(req)) {
  const a = await db.get(`${SQL} WHERE atividades.id = ?`, id);
  if (!a) throw erro(404, 'Atividade não encontrada.');
  return a;
}

function ler(req, atual = {}) {
  const b = req.body || {};
  const titulo = linha(b.titulo ?? atual.titulo, 120);
  if (!titulo) throw erro(400, 'Dê um título à atividade.');
  const item = linha(b.item ?? atual.item, 60);
  if (!item) throw erro(400, 'Diga qual item é preciso (ex.: Batatas).');
  const meta = inteiro(b.meta ?? atual.meta, { min: 1, max: 10_000_000 });
  if (meta == null) throw erro(400, 'A meta precisa ser um número inteiro maior que zero.');
  const pacote = PACOTES.includes(Number(b.pacote)) ? Number(b.pacote) : (atual.pacote || 64);
  let valor = b.recompensa_valor !== undefined ? b.recompensa_valor : atual.recompensa_valor;
  if (valor === '' || valor == null) valor = null;
  else {
    valor = Number(valor);
    if (!Number.isFinite(valor) || valor < 0 || valor > 1e9) throw erro(400, 'O valor da recompensa é inválido.');
  }
  const status = STATUS.includes(b.status) ? b.status : (atual.status || 'aberta');
  return {
    titulo, item, meta, pacote, status,
    descricao: texto(b.descricao ?? atual.descricao, 3000),
    recompensa_valor: valor,
    recompensa_unidade: linha(b.recompensa_unidade ?? atual.recompensa_unidade, 40),
    prazo: b.prazo !== undefined ? dataValida(b.prazo) : (atual.prazo ?? null),
  };
}

// Fecha sozinha quando bate a meta e reabre se uma entrega for removida (vai no mesmo lote da entrega).
const comandosAjustarStatus = id => [
  [`UPDATE atividades SET status = 'concluida', concluido_em = datetime('now') WHERE id = ? AND status = 'aberta' AND ${TOTAL} >= meta`, id],
  [`UPDATE atividades SET status = 'aberta', concluido_em = NULL WHERE id = ? AND status = 'concluida' AND ${TOTAL} < meta`, id],
];

r.get('/', exigir('atividades.ver'), async (req, res) => {
  const { status } = req.query;
  const [lista, grupos, minhas] = await Promise.all([
    STATUS.includes(status)
      ? db.all(`${SQL} WHERE atividades.status = ? ORDER BY atividades.id DESC`, status)
      : db.all(`${SQL} ORDER BY CASE atividades.status WHEN 'aberta' THEN 0 WHEN 'concluida' THEN 1 ELSE 2 END, atividades.id DESC`),
    db.all('SELECT status, COUNT(*) AS n FROM atividades GROUP BY status'),
    db.all('SELECT atividade_id FROM participantes WHERE usuario_id = ?', req.usuario.id),
  ]);
  const contagem = Object.fromEntries(STATUS.map(s => [s, 0]));
  for (const g of grupos) contagem[g.status] = g.n;
  const participo = new Set(minhas.map(x => x.atividade_id));
  res.json({ atividades: lista.map(a => ({ ...a, participando: participo.has(a.id) })), contagem });
});

r.get('/:id', exigir('atividades.ver'), async (req, res) => {
  const a = await buscar(req);
  const [participantes, contribuicoes] = await Promise.all([
    db.all(`SELECT p.usuario_id, p.usuario_nome, p.compromisso, p.entrou_em, u.foto
      FROM participantes p LEFT JOIN usuarios u ON u.id = p.usuario_id WHERE p.atividade_id = ? ORDER BY p.entrou_em`, a.id),
    db.all(`SELECT c.*, u.foto AS usuario_foto
      FROM contribuicoes c LEFT JOIN usuarios u ON u.id = c.usuario_id WHERE c.atividade_id = ? ORDER BY c.id DESC`, a.id),
  ]);
  const ehGestor = gestor(req, a);

  // Monta a divisão: quanto cada pessoa entregou e qual a parte dela na recompensa.
  const pessoas = new Map();
  const chave = (id, nome) => (id ? `u${id}` : `n${nome}`);
  for (const p of participantes) {
    pessoas.set(chave(p.usuario_id, p.usuario_nome), { usuario_id: p.usuario_id, nome: p.usuario_nome, foto: p.foto, compromisso: p.compromisso, entregue: 0, conferido: 0, entregas: 0, participando: true });
  }
  for (const c of contribuicoes) {
    const k = chave(c.usuario_id, c.usuario_nome);
    if (!pessoas.has(k)) pessoas.set(k, { usuario_id: c.usuario_id, nome: c.usuario_nome, foto: c.usuario_foto, compromisso: 0, entregue: 0, conferido: 0, entregas: 0, participando: false });
    const p = pessoas.get(k);
    p.entregue += c.quantidade;
    p.entregas += 1;
    if (c.conferida) p.conferido += c.quantidade;
  }
  const divisao = [...pessoas.values()]
    .map(p => ({
      ...p,
      fracao: a.total ? p.entregue / a.total : 0,
      parte: a.recompensa_valor != null && a.total ? (a.recompensa_valor * p.entregue) / a.total : null,
    }))
    .sort((x, y) => y.entregue - x.entregue || x.nome.localeCompare(y.nome));

  res.json({
    atividade: {
      ...a,
      gestor: ehGestor,
      participando: participantes.some(p => p.usuario_id === req.usuario.id),
      podeParticipar: pode(req, 'atividades.participar'),
    },
    divisao,
    contribuicoes: contribuicoes.map(c => ({
      ...c,
      conferida: !!c.conferida,
      podeApagar: ehGestor || (c.usuario_id === req.usuario.id && !c.conferida),
    })),
  });
});

r.post('/', exigir('atividades.criar'), async (req, res) => {
  const a = ler(req);
  const { id } = await db.run(`INSERT INTO atividades (titulo, descricao, item, meta, pacote, recompensa_valor, recompensa_unidade, prazo, criado_por, criado_por_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  a.titulo, a.descricao, a.item, a.meta, a.pacote, a.recompensa_valor, a.recompensa_unidade, a.prazo, req.usuario.id, req.usuario.nome);
  await anotar(req, 'Criou uma atividade', `${a.titulo} (${a.meta} ${a.item})`);
  await progresso.registrar(req.usuario.id, 'atividade');
  res.status(201).json({ id });
});

r.put('/:id', async (req, res) => {
  const atual = await buscar(req);
  if (!gestor(req, atual)) throw erro(403, 'Só quem criou a atividade ou a administração pode alterá-la.');
  const a = ler(req, atual);
  const concluido = a.status === 'concluida' ? (atual.concluido_em || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null;
  await db.run(`UPDATE atividades SET titulo = ?, descricao = ?, item = ?, meta = ?, pacote = ?, recompensa_valor = ?,
    recompensa_unidade = ?, prazo = ?, status = ?, concluido_em = ? WHERE id = ?`,
  a.titulo, a.descricao, a.item, a.meta, a.pacote, a.recompensa_valor, a.recompensa_unidade, a.prazo, a.status, concluido, atual.id);
  const nomes = { aberta: 'Reabriu', concluida: 'Concluiu', encerrada: 'Encerrou' };
  await anotar(req, a.status !== atual.status ? `${nomes[a.status]} uma atividade` : 'Editou uma atividade', a.titulo);
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  const a = await buscar(req);
  if (!gestor(req, a)) throw erro(403, 'Só quem criou a atividade ou a administração pode apagá-la.');
  await db.lote([
    ['DELETE FROM contribuicoes WHERE atividade_id = ?', a.id],
    ['DELETE FROM participantes WHERE atividade_id = ?', a.id],
    ['DELETE FROM atividades WHERE id = ?', a.id],
  ]);
  await anotar(req, 'Apagou uma atividade', a.titulo);
  res.json({ ok: true });
});

// "Quero ajudar": assume a responsabilidade, com uma quantidade prometida (opcional).
r.post('/:id/participar', exigir('atividades.participar'), async (req, res) => {
  const a = await buscar(req);
  if (a.status !== 'aberta') throw erro(400, 'Esta atividade não está mais aberta.');
  const compromisso = inteiro(req.body?.compromisso || 0, { min: 0, max: 10_000_000 }) ?? 0;
  const ja = await db.get('SELECT 1 AS sim FROM participantes WHERE atividade_id = ? AND usuario_id = ?', a.id, req.usuario.id);
  await db.run(`INSERT INTO participantes (atividade_id, usuario_id, usuario_nome, compromisso) VALUES (?, ?, ?, ?)
    ON CONFLICT (atividade_id, usuario_id) DO UPDATE SET compromisso = excluded.compromisso`,
  a.id, req.usuario.id, req.usuario.nome, compromisso);
  if (!ja) await anotar(req, 'Assumiu uma atividade', `${a.titulo}${compromisso ? ` (promete ${compromisso} ${a.item})` : ''}`);
  res.json({ ok: true });
});

r.delete('/:id/participar', exigir('atividades.participar'), async (req, res) => {
  const a = await buscar(req);
  await db.run('DELETE FROM participantes WHERE atividade_id = ? AND usuario_id = ?', a.id, req.usuario.id);
  await anotar(req, 'Saiu de uma atividade', a.titulo);
  res.json({ ok: true });
});

// Registrar entrega: "dei 200 batatas".
r.post('/:id/contribuicoes', exigir('atividades.participar'), async (req, res) => {
  const a = await buscar(req);
  if (a.status !== 'aberta') throw erro(400, 'Esta atividade não está recebendo entregas agora.');
  const quantidade = inteiro(req.body?.quantidade, { min: 1, max: 10_000_000 });
  if (quantidade == null) throw erro(400, 'Informe quantos itens você entregou.');
  const nota = linha(req.body?.nota, 200);
  await db.lote([
    [`INSERT INTO participantes (atividade_id, usuario_id, usuario_nome) VALUES (?, ?, ?)
      ON CONFLICT (atividade_id, usuario_id) DO NOTHING`, a.id, req.usuario.id, req.usuario.nome],
    ['INSERT INTO contribuicoes (atividade_id, usuario_id, usuario_nome, quantidade, nota, conferida) VALUES (?, ?, ?, ?, ?, ?)',
      a.id, req.usuario.id, req.usuario.nome, quantidade, nota, gestor(req, a) ? 1 : 0],
    ...comandosAjustarStatus(a.id),
  ]);
  await anotar(req, 'Registrou uma entrega', `${quantidade} ${a.item} em "${a.titulo}"`);
  if (gestor(req, a)) await progresso.registrar(req.usuario.id, 'entrega'); // já nasce conferida
  res.status(201).json({ ok: true });
});

async function buscarContribuicao(req) {
  const c = await db.get('SELECT * FROM contribuicoes WHERE id = ?', idDaRota(req));
  if (!c) throw erro(404, 'Entrega não encontrada.');
  return { c, a: await buscar(req, c.atividade_id) };
}

// Quem gerencia a atividade confere as entregas (confirma que o item chegou mesmo).
r.patch('/contribuicoes/:id', async (req, res) => {
  const { c, a } = await buscarContribuicao(req);
  if (!gestor(req, a)) throw erro(403, 'Só quem gerencia a atividade pode conferir entregas.');
  const conferida = req.body?.conferida ? 1 : 0;
  await db.run('UPDATE contribuicoes SET conferida = ? WHERE id = ?', conferida, c.id);
  if (conferida) await anotar(req, 'Conferiu uma entrega', `${c.quantidade} ${a.item} de ${c.usuario_nome}`);
  if (conferida && !c.conferida) await progresso.registrar(c.usuario_id, 'entrega');
  if (conferida && !c.conferida && c.usuario_id !== req.usuario.id) await progresso.registrar(req.usuario.id, 'conferencia');
  res.json({ ok: true });
});

r.delete('/contribuicoes/:id', async (req, res) => {
  const { c, a } = await buscarContribuicao(req);
  const propria = c.usuario_id === req.usuario.id && !c.conferida;
  if (!gestor(req, a) && !propria) throw erro(403, 'Você não pode remover esta entrega.');
  await db.lote([['DELETE FROM contribuicoes WHERE id = ?', c.id], ...comandosAjustarStatus(a.id)]);
  await anotar(req, 'Removeu uma entrega', `${c.quantidade} ${a.item} de ${c.usuario_nome} em "${a.titulo}"`);
  res.json({ ok: true });
});

module.exports = r;
