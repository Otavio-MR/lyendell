// Casas do mapa de Lyendell. Cada casa guarda onde fica (x, y no mapa, rua e lado), o número,
// a situação e quem mora. Quem mora é ligado pelo nome aos registros do Tabelionato
// (Moradores, Nobres e Outros), de onde vêm a foto e os dados mostrados no mapa.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { erro, linha, chaveNome, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin);
const editar = exigir('mapa.editar');

const SITUACOES = ['ocupada', 'comercio', 'sem_dono', 'sem_morador'];
const LADOS = ['esquerda', 'direita'];
const [LARGURA, ALTURA] = [1154, 773]; // o tamanho do mapa

/* ─── Quem mora: os registros de pessoas do Tabelionato ─── */

const LIVRO_DE_PESSOAS = /morador|nobre|outro/;
// Dados mostrados no mapa, nesta ordem, quando o registro tiver (pelo nome do campo, sem acento).
const DADOS_MOSTRADOS = [
  ['idade'], ['profissao', 'oficio'], ['cargo'], ['titulo'], ['estado civil'], ['a qual familia pertence', 'familia'],
  ['cargo na familia'], ['casa'], ['genero'], ['nickname', 'nick', 'nick do minecraft'],
];
const nomeDoCampo = c => chaveNome(c.nome).replace(/:$/, '').trim();

async function pessoasRegistradas() {
  const livros = (await db.all("SELECT id, nome, campos FROM livros WHERE modulo = 'tabelionato' ORDER BY ordem, id"))
    .filter(l => LIVRO_DE_PESSOAS.test(chaveNome(l.nome)));
  const pessoas = [];
  for (const l of livros) {
    const campos = JSON.parse(l.campos);
    const campoNome = campos.find(c => c.tipo === 'texto' && /^nome\b/.test(nomeDoCampo(c)));
    const campoNick = campos.find(c => c.tipo === 'texto' && /^nick/.test(nomeDoCampo(c)));
    const primeiro = campos.find(c => c.tipo === 'texto' || c.tipo === 'selecao');
    const fotos = campos.filter(c => c.tipo === 'imagem');
    const registros = await db.all("SELECT id, numero, dados FROM registros WHERE livro_id = ? AND situacao = 'aprovado' ORDER BY numero", l.id);
    for (const reg of registros) {
      const d = JSON.parse(reg.dados);
      const nome = String(d[campoNome?.id] || d[campoNick?.id] || d[primeiro?.id] || '').trim();
      if (!nome) continue;
      const detalhes = [];
      for (const nomes of DADOS_MOSTRADOS) {
        const c = campos.find(x => x !== campoNome && nomes.includes(nomeDoCampo(x)) && d[x.id] !== undefined && d[x.id] !== '' && d[x.id] !== false);
        if (c && !detalhes.some(x => x.id === c.id)) {
          detalhes.push({ id: c.id, rotulo: c.nome.replace(/:$/, '').trim(), valor: Array.isArray(d[c.id]) ? d[c.id].join(', ') : String(d[c.id]) });
        }
      }
      pessoas.push({
        nome, chave: chaveNome(nome), livro: l.nome, livro_id: l.id, registro_id: reg.id, numero: reg.numero,
        foto: fotos.map(c => d[c.id]).find(Boolean) || null,
        detalhes: detalhes.slice(0, 6).map(({ rotulo, valor }) => ({ rotulo, valor })),
      });
    }
  }
  return pessoas;
}

// Liga um nome às pessoas registradas: o nome exato, ou o único registro que tem todas as palavras
// ("Rudeus" acha "Rudeus Greyrat"). "Casa da Família Lombardi" traz todo mundo com Lombardi no nome.
function acharPessoas(nome, pessoas) {
  const k = chaveNome(nome);
  const familia = k.match(/familia\s+(.+)$/);
  if (familia) {
    const sobrenome = familia[1].split(' ');
    return pessoas.filter(p => sobrenome.every(w => p.chave.split(' ').includes(w)));
  }
  const exata = pessoas.find(p => p.chave === k);
  if (exata) return [exata];
  const palavras = k.split(' ');
  const parecidas = pessoas.filter(p => palavras.every(w => p.chave.split(' ').includes(w)));
  return parecidas.length === 1 ? parecidas : [];
}

function moradoresDa(casa, pessoas) {
  const nomes = casa.pessoas.length ? casa.pessoas : casa.situacao === 'ocupada' && casa.texto ? [casa.texto] : [];
  const vistos = new Set();
  return nomes.flatMap(n => acharPessoas(n, pessoas)).filter(p => !vistos.has(p.registro_id) && vistos.add(p.registro_id))
    .slice(0, 12).map(({ chave, ...p }) => p);
}

/* ─── Rotas ───────────────────────────────────────── */

const formatar = c => ({ ...c, pessoas: JSON.parse(c.pessoas || '[]') });

r.get('/', async (req, res) => {
  const casas = (await db.all('SELECT * FROM casas ORDER BY via, id')).map(formatar);
  const verTabelionato = pode(req, 'tabelionato.ver');
  const podeEditar = pode(req, 'mapa.editar');
  const pessoas = verTabelionato || podeEditar ? await pessoasRegistradas() : [];
  res.json({
    casas: casas.map(c => ({ ...c, moradores: verTabelionato ? moradoresDa(c, pessoas) : [] })),
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
    situacao: SITUACOES.includes(b.situacao) ? b.situacao : atual.situacao || 'ocupada',
    texto: linha(b.texto ?? atual.texto ?? '', 80),
    pessoas,
  };
}
const valores = c => [c.numero, c.via, c.lado, c.x, c.y, c.situacao, c.texto, JSON.stringify(c.pessoas)];
const INSERIR = 'INSERT INTO casas (numero, via, lado, x, y, situacao, texto, pessoas, atualizado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
const descricao = c => `Casa ${c.numero || 's/n'}${c.texto ? `: ${c.texto}` : ''}`;

r.post('/', editar, async (req, res) => {
  const c = lerCasa(req.body);
  const { id } = await db.run(INSERIR, ...valores(c), req.usuario.nome);
  await anotar(req, 'Colocou uma casa no mapa', descricao(c));
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
  await db.run("UPDATE casas SET numero = ?, via = ?, lado = ?, x = ?, y = ?, situacao = ?, texto = ?, pessoas = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?",
    ...valores(c), req.usuario.nome, atual.id);
  // Só arrastar para outro lugar não vai para o diário (seria uma linha por arrasto).
  const mudouMaisQueLugar = ['numero', 'situacao', 'texto'].some(k => String(c[k]) !== String(atual[k])) || JSON.stringify(c.pessoas) !== atual.pessoas;
  if (mudouMaisQueLugar) await anotar(req, 'Editou uma casa do mapa', descricao(c));
  res.json({ ok: true });
});

r.delete('/:id', editar, async (req, res) => {
  const c = await buscar(req);
  await db.run('DELETE FROM casas WHERE id = ?', c.id);
  await anotar(req, 'Tirou uma casa do mapa', descricao(c));
  res.json({ ok: true });
});

module.exports = r;
