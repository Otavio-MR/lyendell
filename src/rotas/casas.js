// Casas do mapa de Lyendell. Cada casa guarda onde fica (x, y no mapa, rua e lado), o número,
// a situação, o ícone (opcional) e quem mora. Quem mora é ligado pelo nome aos registros do Tabelionato
// (Moradores, Nobres e Outros), de onde vêm a foto e os dados mostrados no mapa.
// Sem ninguém escolhido à mão, o mapa tenta achar pelo nome da casa (menos casas de família).
// O GET também manda os prédios (veja rotas/predios.js), para o mapa carregar tudo de uma vez.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { erro, linha, idDaRota } = require('../util');
const { pessoasRegistradas, acharPessoas, semChave } = require('../moradores');
const { formatarPredio, comPessoas } = require('./predios');

const r = express.Router();
r.use(exigirLogin); // todos veem o mapa (os Aliados também); mexer pede mapa.editar
const editar = exigir('mapa.editar');

const SITUACOES = ['ocupada', 'comercio', 'sem_dono']; // sem dono = sem morador (é a mesma coisa)
const LADOS = ['esquerda', 'direita'];
const [LARGURA, ALTURA] = [1154, 773]; // o tamanho do mapa

function moradoresDa(casa, pessoas, escolhidos) {
  const aMao = casa.pessoas.length > 0;
  const nomes = aMao ? casa.pessoas : casa.situacao === 'ocupada' && casa.texto ? [casa.texto] : [];
  const vistos = new Set();
  return nomes.flatMap(n => acharPessoas(n, pessoas, { palpite: !aMao, escolhidos }))
    .filter(p => !vistos.has(p.registro_id) && vistos.add(p.registro_id))
    .slice(0, 12).map(semChave);
}

// Registros de quem foi escolhido à mão para morar em alguma casa ou prédio.
const escolhidosAMao = (casas, predios, pessoas) => new Set([
  ...casas.flatMap(c => c.pessoas),
  ...predios.flatMap(p => p.pessoas.filter(x => x.papel === 'mora').map(x => x.nome)),
].flatMap(n => acharPessoas(n, pessoas)).map(p => p.registro_id));

/* ─── Rotas ───────────────────────────────────────── */

const formatar = c => ({ ...c, pessoas: JSON.parse(c.pessoas || '[]') });

r.get('/', async (req, res) => {
  const casas = (await db.all('SELECT * FROM casas ORDER BY via, id')).map(formatar);
  const predios = (await db.all('SELECT * FROM predios ORDER BY id')).map(formatarPredio);
  const verTabelionato = pode(req, 'tabelionato.ver');
  const podeEditar = pode(req, 'mapa.editar');
  const pessoas = verTabelionato || podeEditar ? await pessoasRegistradas() : [];
  const escolhidos = escolhidosAMao(casas, predios, pessoas);
  res.json({
    casas: casas.map(c => ({
      ...c,
      moradores: verTabelionato ? moradoresDa(c, pessoas, escolhidos) : [],
      palpite: !c.pessoas.length, // quem mora foi achado pelo nome da casa, e não escolhido à mão
    })),
    predios: predios.map(p => comPessoas(p, verTabelionato ? pessoas : [])),
    podeEditar,
    // Para escolher quem mora, na hora de editar.
    nomes: podeEditar ? pessoas.map(p => ({ nome: p.nome, livro: p.livro })) : undefined,
  });
});

function lerCasa(b = {}, atual = {}) {
  const x = Number(b.x ?? atual.x);
  const y = Number(b.y ?? atual.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > LARGURA || y < 0 || y > ALTURA) throw erro(400, 'Essa posição fica fora do mapa.');
  const via = b.via === undefined ? atual.via ?? null : typeof b.via === 'string' && /^[a-z0-9]{1,12}$/.test(b.via) ? b.via : null;
  const lado = b.lado === undefined ? atual.lado ?? null : LADOS.includes(b.lado) ? b.lado : null;
  const pessoas = b.pessoas === undefined
    ? JSON.parse(atual.pessoas || '[]')
    : [...new Set((Array.isArray(b.pessoas) ? b.pessoas : []).map(p => linha(p, 80)).filter(Boolean))].slice(0, 12);
  return {
    numero: linha(b.numero ?? atual.numero ?? '', 10),
    via, lado, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
    situacao: b.situacao === 'sem_morador' ? 'sem_dono' : SITUACOES.includes(b.situacao) ? b.situacao : atual.situacao || 'ocupada',
    texto: linha(b.texto ?? atual.texto ?? '', 80),
    icone: b.icone === undefined ? atual.icone || '' : typeof b.icone === 'string' && /^[a-z]{2,16}$/.test(b.icone) ? b.icone : '',
    pessoas,
  };
}
const valores = c => [c.numero, c.via, c.lado, c.x, c.y, c.situacao, c.texto, c.icone, JSON.stringify(c.pessoas)];
const INSERIR = 'INSERT INTO casas (numero, via, lado, x, y, situacao, texto, icone, pessoas, atualizado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const descricao = c => `Casa ${c.numero || 's/n'}${c.texto ? `: ${c.texto}` : ''}`;

r.post('/', editar, async (req, res) => {
  const c = lerCasa(req.body);
  const { id } = await db.run(INSERIR, ...valores(c), req.usuario.nome);
  await anotar(req, 'Colocou uma casa no mapa', descricao(c));
  await progresso.registrar(req.usuario.id, 'mapa');
  res.status(201).json({ id });
});

// Colar a lista de uma rua: cria todas de uma vez (e, se pedir, tira as que já estavam nela).
r.post('/lote', editar, async (req, res) => {
  const lista = Array.isArray(req.body?.casas) ? req.body.casas : [];
  if (!lista.length) throw erro(400, 'A lista não tem nenhuma casa.');
  if (lista.length > 200) throw erro(400, 'Mande no máximo 200 casas de uma vez.');
  const casas = lista.map(b => lerCasa(b));
  const via = typeof req.body.via === 'string' && /^[a-z0-9]{1,12}$/.test(req.body.via) ? req.body.via : null;
  const substituir = !!req.body.substituir && via;
  const antes = substituir ? (await db.get('SELECT COUNT(*) AS n FROM casas WHERE via = ?', via)).n : 0;
  await db.lote([
    substituir ? ['DELETE FROM casas WHERE via = ?', via] : null,
    ...casas.map(c => [INSERIR, ...valores(c), req.usuario.nome]),
  ]);
  const nomeVia = linha(req.body.nomeVia, 60) || 'no mapa';
  await anotar(req, `Colocou ${casas.length} casas no mapa (${nomeVia})`, antes ? `e tirou as ${antes} que estavam lá` : '');
  res.status(201).json({ criadas: casas.length, removidas: antes });
});

async function buscar(req) {
  const c = await db.get('SELECT * FROM casas WHERE id = ?', idDaRota(req));
  if (!c) throw erro(404, 'Casa não encontrada.');
  return c;
}

r.put('/:id', editar, async (req, res) => {
  const atual = await buscar(req);
  const c = lerCasa(req.body, atual);
  await db.run("UPDATE casas SET numero = ?, via = ?, lado = ?, x = ?, y = ?, situacao = ?, texto = ?, icone = ?, pessoas = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?",
    ...valores(c), req.usuario.nome, atual.id);
  // Só arrastar para outro lugar não vai para o diário (seria uma linha por arrasto).
  const mudouMaisQueLugar = ['numero', 'situacao', 'texto', 'icone'].some(k => String(c[k]) !== String(atual[k])) || JSON.stringify(c.pessoas) !== atual.pessoas;
  if (mudouMaisQueLugar) {
    await anotar(req, 'Editou uma casa do mapa', descricao(c));
    await progresso.registrar(req.usuario.id, 'mapa');
  }
  res.json({ ok: true });
});

r.delete('/:id', editar, async (req, res) => {
  const c = await buscar(req);
  await db.run('DELETE FROM casas WHERE id = ?', c.id);
  await anotar(req, 'Tirou uma casa do mapa', descricao(c));
  res.json({ ok: true });
});

module.exports = r;
