// Prédios públicos e outros pontos do mapa (Septo, Senado, uma loja, uma taverna...).
// Cada um tem ícone, tamanho do selo no mapa, fotos de fora e de dentro, quem mora e quem trabalha ali
// (ligados pelo nome aos registros do Tabelionato, como nas casas), para que serve e mais informações.
// A lista vem junto com as casas no GET /api/casas; aqui ficam criar, editar e tirar do mapa.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { erro, texto, linha, idDaRota } = require('../util');
const { acharPessoas, semChave } = require('../moradores');

const r = express.Router();
r.use(exigirLogin);
const editar = exigir('mapa.editar');

const [LARGURA, ALTURA] = [1154, 773]; // o tamanho do mapa
const CATEGORIAS = ['publico', 'comercio', 'outro'];
const TAMANHOS = ['grande', 'medio', 'pequeno'];
const PAPEIS = ['mora', 'trabalha'];
const TIPOS_FOTO = ['exterior', 'interior'];
// Telas do site que um prédio pode abrir (ex.: o Senado abre o Congresso).
const PAGINAS = ['', '/tabelionato', '/guarda', '/hospital', '/congresso', '/leis', '/recreacao', '/galeria', '/atividades', '/anuncios', '/escola'];

const json = (v, padrao = []) => { try { return JSON.parse(v || ''); } catch { return padrao; } };

function formatarPredio(p) {
  return { ...p, centro: !!p.centro, info: json(p.info), fotos: json(p.fotos), pessoas: json(p.pessoas) };
}

// Quem mora e quem trabalha, com a foto e os dados do registro no Tabelionato (quando o nome bate).
// Quem não está no Tabelionato aparece só com o nome.
function comPessoas(p, pessoas) {
  return {
    ...p,
    pessoas: p.pessoas.map(x => {
      const achada = acharPessoas(x.nome, pessoas)[0];
      return { ...x, registro: achada ? semChave(achada) : null };
    }),
  };
}

function lerPredio(b = {}, atual = null) {
  const a = atual ? formatarPredio(atual) : {};
  const nome = linha(b.nome ?? a.nome, 60);
  if (!nome) throw erro(400, 'Dê um nome ao prédio.');
  const x = Number(b.x ?? a.x);
  const y = Number(b.y ?? a.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > LARGURA || y < 0 || y > ALTURA) throw erro(400, 'Essa posição fica fora do mapa.');
  const escolha = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
  const info = (Array.isArray(b.info) ? b.info : b.info === undefined ? a.info || [] : [])
    .map(i => ({ rotulo: linha(i?.rotulo, 40), valor: texto(i?.valor, 300) }))
    .filter(i => i.rotulo && i.valor).slice(0, 15);
  const fotos = (Array.isArray(b.fotos) ? b.fotos : b.fotos === undefined ? a.fotos || [] : [])
    .filter(f => urlValida(f?.url))
    .map(f => ({ url: f.url, tipo: escolha(f.tipo, TIPOS_FOTO, 'exterior'), legenda: linha(f.legenda, 120) }))
    .slice(0, 24);
  const vistos = new Set();
  const pessoas = (Array.isArray(b.pessoas) ? b.pessoas : b.pessoas === undefined ? a.pessoas || [] : [])
    .map(p => ({ nome: linha(p?.nome, 80), papel: escolha(p?.papel, PAPEIS, 'trabalha'), funcao: linha(p?.funcao, 60) }))
    .filter(p => p.nome && !vistos.has(`${p.nome}|${p.papel}`) && vistos.add(`${p.nome}|${p.papel}`))
    .map(({ nome, papel, funcao }) => ({ nome, papel, funcao }))
    .slice(0, 40);
  const icone = b.icone === undefined ? a.icone : b.icone;
  return {
    nome,
    tipo: linha(b.tipo ?? a.tipo ?? '', 80),
    categoria: escolha(b.categoria ?? a.categoria, CATEGORIAS, 'publico'),
    icone: typeof icone === 'string' && /^[a-z_]{2,24}$/.test(icone) ? icone : 'estrela',
    tamanho: escolha(b.tamanho ?? a.tamanho, TAMANHOS, 'medio'),
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    sub: linha(b.sub ?? a.sub ?? '', 40),
    centro: (b.centro ?? a.centro) ? 1 : 0,
    pagina: escolha(b.pagina ?? a.pagina ?? '', PAGINAS, ''),
    funcao: texto(b.funcao ?? a.funcao ?? '', 1000),
    sobre: texto(b.sobre ?? a.sobre ?? '', 6000),
    info, fotos, pessoas,
  };
}

const COLUNAS = ['nome', 'tipo', 'categoria', 'icone', 'tamanho', 'x', 'y', 'sub', 'centro', 'pagina', 'funcao', 'sobre', 'info', 'fotos', 'pessoas'];
const valores = p => COLUNAS.map(c => (['info', 'fotos', 'pessoas'].includes(c) ? JSON.stringify(p[c]) : p[c]));

r.post('/', editar, async (req, res) => {
  const p = lerPredio(req.body);
  const { id } = await db.run(`INSERT INTO predios (${COLUNAS.join(', ')}, atualizado_por_nome) VALUES (${COLUNAS.map(() => '?').join(', ')}, ?)`,
    ...valores(p), req.usuario.nome);
  await anotar(req, 'Colocou um prédio no mapa', p.nome);
  await progresso.registrar(req.usuario.id, 'mapa');
  res.status(201).json({ id });
});

async function buscar(req) {
  const p = await db.get('SELECT * FROM predios WHERE id = ?', idDaRota(req));
  if (!p) throw erro(404, 'Prédio não encontrado.');
  return p;
}

r.put('/:id', editar, async (req, res) => {
  const atual = await buscar(req);
  const p = lerPredio(req.body, atual);
  const novas = new Set(p.fotos.map(f => f.url));
  await db.lote([
    [`UPDATE predios SET ${COLUNAS.map(c => `${c} = ?`).join(', ')}, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
      ...valores(p), req.usuario.nome, atual.id],
    // Fotos tiradas do prédio saem do banco.
    ...formatarPredio(atual).fotos.filter(f => !novas.has(f.url)).map(f => comandoApagarArquivo(f.url)),
  ]);
  // Só arrastar para outro lugar não vai para o diário (seria uma linha por arrasto).
  const soMoveu = COLUNAS.filter(c => c !== 'x' && c !== 'y').every(c => String(valores(p)[COLUNAS.indexOf(c)]) === String(atual[c] ?? ''));
  if (!soMoveu) {
    await anotar(req, 'Editou um prédio do mapa', p.nome);
    await progresso.registrar(req.usuario.id, 'mapa');
  }
  res.json({ ok: true });
});

r.delete('/:id', editar, async (req, res) => {
  const p = formatarPredio(await buscar(req));
  await db.lote([
    ['DELETE FROM predios WHERE id = ?', p.id],
    ...p.fotos.map(f => comandoApagarArquivo(f.url)),
  ]);
  await anotar(req, 'Tirou um prédio do mapa', p.nome);
  res.json({ ok: true });
});

module.exports = r;
module.exports.formatarPredio = formatarPredio;
module.exports.comPessoas = comPessoas;
module.exports.PAGINAS = PAGINAS;
