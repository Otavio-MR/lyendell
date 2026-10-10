const express = require('express');
const { db } = require('../db');
const { exigir } = require('../auth');
const { anotar } = require('../diario');
const { CATEGORIAS } = require('../quiz');
const progresso = require('../progresso');
const clube = require('../clube');
const { erro, inteiro, linha, texto, idDaRota } = require('../util');

const r = express.Router();
r.use(exigir('recreacao.usar'));

const TAMANHOS = ['3x3', '4x4', '5x5'];
// Jogo da Memória: tamanho e quantos pares tem (o resultado é o número de jogadas; menos é melhor).
const MEMORIA = { '4x4': 8, '4x6': 12, '6x6': 18 };
// Campo Minado: as três dificuldades (o resultado é o tempo em segundos; menos é melhor).
const MINADO = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

// Vitórias, derrotas e empates de cada pessoa num jogo ao vivo de duas pessoas.
const rankingAoVivo = jogo => db.all(`
  SELECT nome, SUM(v) AS vitorias, SUM(d) AS derrotas, SUM(e) AS empates FROM (
    SELECT jogador1_nome AS nome, vencedor = 1 AS v, vencedor = 2 AS d, vencedor IS NULL AS e FROM partidas WHERE jogo = ?
    UNION ALL
    SELECT jogador2_nome, vencedor = 2, vencedor = 1, vencedor IS NULL FROM partidas WHERE jogo = ?
  ) GROUP BY nome ORDER BY vitorias DESC, derrotas ASC, nome LIMIT 10`, jogo, jogo);

// Arena da Toca: vitórias, partidas e coroas (cada coroa vale 1000 pontos na partida). São dois rankings,
// para ninguém liderar só vencendo o robô: "jogadores" é o versus com pelo menos duas pessoas; "raposo" é o
// co-op e o versus jogado sozinho (as duas contra o Raposo).
const rankingArena = contraRaposo => db.all(`
  SELECT usuario_nome AS nome, SUM(venceu) AS vitorias, COUNT(*) AS partidas, SUM(pontos / 1000) AS coroas
  FROM resultados
  WHERE ${contraRaposo ? "jogo = 'junto_arena_coop' OR (jogo = 'junto_arena_versus' AND jogadores = 1)" : "jogo = 'junto_arena_versus' AND jogadores > 1"}
  GROUP BY usuario_nome ORDER BY vitorias DESC, coroas DESC, partidas ASC, nome LIMIT 10`);

const melhoresPontos = jogo => db.all(
  'SELECT usuario_nome AS nome, MAX(pontos) AS pontos FROM recordes WHERE jogo = ? GROUP BY usuario_nome ORDER BY pontos DESC LIMIT 10', jogo);

r.get('/ranking', async (req, res) => {
  const [arenaJogadores, arenaRaposo, velha, ppt, lig4, damas, cobras, festaRanking, cidade, cobrinha, pacman, jogo2048, barris, supercoelho, travessia, corrida, quiz, ...outros] = await Promise.all([
    rankingArena(false),
    rankingArena(true),
    rankingAoVivo('velha'),
    rankingAoVivo('ppt'),
    rankingAoVivo('lig4'),
    rankingAoVivo('damas'),
    // Cobrinha ao vivo: vitórias (em partida de 2 a 4) e cenouras comidas.
    db.all(`
      SELECT usuario_nome AS nome, SUM(venceu) AS vitorias, COUNT(*) AS partidas, SUM(pontos) AS cenouras
      FROM resultados WHERE jogo = 'cobras' GROUP BY usuario_nome ORDER BY vitorias DESC, cenouras DESC, nome LIMIT 10`),
    // Festa na Toca: vitórias, partidas e cenouras douradas.
    db.all(`
      SELECT usuario_nome AS nome, SUM(venceu) AS vitorias, COUNT(*) AS partidas, SUM(pontos) AS douradas
      FROM resultados WHERE jogo = 'festa' GROUP BY usuario_nome ORDER BY vitorias DESC, douradas DESC, nome LIMIT 10`),
    // Lyendell Dorme: vitórias, partidas e em quantas chegou vivo ao fim.
    db.all(`
      SELECT usuario_nome AS nome, SUM(venceu) AS vitorias, COUNT(*) AS partidas, SUM(pontos) AS sobreviveu
      FROM resultados WHERE jogo = 'cidade' GROUP BY usuario_nome ORDER BY vitorias DESC, sobreviveu DESC, nome LIMIT 10`),
    melhoresPontos('cobrinha'),
    melhoresPontos('pacman'),
    melhoresPontos('2048'),
    melhoresPontos('barris'),
    melhoresPontos('supercoelho'),
    melhoresPontos('travessia'),
    melhoresPontos('corrida'),
    // Vitória no quiz só conta em partida com pelo menos duas pessoas.
    db.all(`
      SELECT usuario_nome AS nome, SUM(posicao = 1 AND jogadores > 1) AS vitorias, SUM(acertos) AS acertos,
        COUNT(*) AS partidas, MAX(pontos) AS melhor
      FROM quiz_resultados GROUP BY usuario_nome ORDER BY vitorias DESC, acertos DESC, nome LIMIT 10`),
    ...TAMANHOS.map(t => db.all(`
      SELECT usuario_nome AS nome, MIN(pontos) AS segundos FROM recordes WHERE jogo = 'quebra' AND variante = ?
      GROUP BY usuario_nome ORDER BY segundos LIMIT 10`, t)),
    ...Object.keys(MEMORIA).map(t => db.all(`
      SELECT usuario_nome AS nome, MIN(pontos) AS jogadas FROM recordes WHERE jogo = 'memoria' AND variante = ?
      GROUP BY usuario_nome ORDER BY jogadas LIMIT 10`, t)),
    ...Object.keys(MINADO).map(t => db.all(`
      SELECT usuario_nome AS nome, MIN(pontos) AS segundos FROM recordes WHERE jogo = 'minado' AND variante = ?
      GROUP BY usuario_nome ORDER BY segundos LIMIT 10`, t)),
  ]);
  const quebra = outros.slice(0, TAMANHOS.length);
  const memoria = outros.slice(TAMANHOS.length, TAMANHOS.length + Object.keys(MEMORIA).length);
  const minado = outros.slice(TAMANHOS.length + Object.keys(MEMORIA).length);
  res.json({
    velha, ppt, lig4, damas, cobras, festa: festaRanking, cidade, cobrinha, pacman, quiz, 2048: jogo2048, barris, supercoelho, travessia, corrida,
    arena: { jogadores: arenaJogadores, raposo: arenaRaposo },
    quebra: Object.fromEntries(TAMANHOS.map((t, i) => [t, quebra[i]])),
    memoria: Object.fromEntries(Object.keys(MEMORIA).map((t, i) => [t, memoria[i]])),
    minado: Object.fromEntries(Object.keys(MINADO).map((t, i) => [t, minado[i]])),
  });
});

// Resultado de um jogo que roda no navegador.
// Cobrinha: cenouras comidas. Pac-Coelho, 2048, Barris do Raposo e Super Coelho: pontos. Travessia: fileiras.
// Corrida do Coelho: metros (com o bônus dos Lírios).
// Quebra-cabeça e Campo Minado: segundos; Memória: jogadas (nesses três, menor é melhor).
const LIMITES = { cobrinha: 400, pacman: 5_000_000, 2048: 10_000_000, barris: 5_000_000, supercoelho: 5_000_000, travessia: 100_000, corrida: 1_000_000 };

r.post('/recordes', async (req, res) => {
  // Partida em que o menu de administrador foi usado não vale recorde (nem cenouras).
  if (req.body?.adm) return res.status(201).json({ recorde: false, anterior: null, cenouras: 0, adm: true });
  const jogo = req.body?.jogo;
  let variante = '';
  let pontos;
  if (LIMITES[jogo]) {
    pontos = inteiro(req.body?.pontos, { min: 0, max: LIMITES[jogo] });
  } else if (jogo === 'memoria') {
    variante = MEMORIA[req.body?.variante] ? req.body.variante : null;
    if (!variante) throw erro(400, 'Tamanho do Jogo da Memória inválido.');
    pontos = inteiro(req.body?.pontos, { min: MEMORIA[variante], max: 5000 }); // não dá para terminar com menos jogadas que pares
  } else if (jogo === 'minado') {
    variante = MINADO[req.body?.variante] ? req.body.variante : null;
    if (!variante) throw erro(400, 'Dificuldade do Campo Minado inválida.');
    pontos = inteiro(req.body?.pontos, { min: 1, max: 24 * 3600 });
  } else if (jogo === 'quebra') {
    variante = TAMANHOS.includes(req.body?.variante) ? req.body.variante : null;
    pontos = inteiro(req.body?.pontos, { min: 1, max: 24 * 3600 });
    if (!variante) throw erro(400, 'Tamanho de quebra-cabeça inválido.');
  } else {
    throw erro(400, 'Jogo desconhecido.');
  }
  if (pontos == null) throw erro(400, 'Resultado inválido.');
  const menorMelhor = jogo === 'quebra' || jogo === 'memoria' || jogo === 'minado';
  const antes = (await db.get(
    `SELECT ${menorMelhor ? 'MIN' : 'MAX'}(pontos) AS m FROM recordes WHERE jogo = ? AND variante = ? AND usuario_id = ?`,
    jogo, variante, req.usuario.id)).m;
  await db.run('INSERT INTO recordes (jogo, variante, usuario_id, usuario_nome, pontos, detalhe) VALUES (?, ?, ?, ?, ?, ?)',
    jogo, variante, req.usuario.id, req.usuario.nome, pontos, linha(req.body?.detalhe, 60));
  const recorde = antes == null || (menorMelhor ? pontos < antes : pontos > antes);
  await progresso.registrar(req.usuario.id, 'solo');
  // Cada partida também rende cenouras para o Club Coelho (com o teto do dia).
  const cenouras = await clube.ganharDeJogo(req.usuario.id, jogo, pontos);
  res.status(201).json({ recorde, anterior: antes, cenouras });
});

/* ─── Códigos secretos dos joguinhos ──────────────── */

// As sequências ficam no navegador (public/js/segredos.js); aqui só se guarda quem descobriu qual.
const SEGREDOS = ['cobra-arcoiris', 'cobra-portal', 'cobra-turbo', 'pac-konami', 'pac-buuu', 'pac-neve', '2048-desfazer',
  '2048-ouro', '2048-coelho', 'minado-xyzzy', 'memoria-espiar', 'quebra-numeros', 'quebra-ima', 'festa',
  'barris-marreta', 'barris-lento', 'barris-coroa', 'super-vidas', 'super-lua', 'super-fogo',
  'travessia-fantasma', 'travessia-ouro', 'travessia-noite'];

r.get('/segredos', async (req, res) => {
  const linhas = await db.all('SELECT chave, em FROM segredos WHERE usuario_id = ? ORDER BY em', req.usuario.id);
  res.json({ descobertos: linhas.filter(l => SEGREDOS.includes(l.chave)), total: SEGREDOS.length });
});

r.post('/segredos', async (req, res) => {
  const chave = String(req.body?.chave || '');
  if (!SEGREDOS.includes(chave)) throw erro(400, 'Esse código secreto não existe.');
  const { changes } = await db.run('INSERT INTO segredos (usuario_id, chave) VALUES (?, ?) ON CONFLICT (usuario_id, chave) DO NOTHING', req.usuario.id, chave);
  if (changes) await progresso.registrar(req.usuario.id, 'segredo');
  res.json({ novo: !!changes });
});

/* ─── Quiz ────────────────────────────────────────── */

// Categorias e quantas perguntas cada uma tem (para quem vai abrir uma sala).
r.get('/quiz', async (req, res) => {
  const contagem = await db.all('SELECT categoria, COUNT(*) AS n FROM perguntas GROUP BY categoria');
  const n = Object.fromEntries(contagem.map(c => [c.categoria, c.n]));
  res.json({ categorias: Object.entries(CATEGORIAS).map(([id, nome]) => ({ id, nome, total: n[id] || 0 })) });
});

function validarPergunta(corpo = {}) {
  const categoria = CATEGORIAS[corpo.categoria] ? corpo.categoria : null;
  if (!categoria) throw erro(400, 'Escolha a categoria.');
  const t = texto(corpo.texto, 300).replace(/\s+/g, ' ');
  if (t.length < 5) throw erro(400, 'Escreva a pergunta.');
  const alternativas = Array.isArray(corpo.alternativas) ? corpo.alternativas.map(a => linha(a, 120)) : [];
  if (alternativas.length !== 4 || alternativas.some(a => !a)) throw erro(400, 'Preencha as quatro alternativas (A, B, C e D).');
  if (new Set(alternativas.map(a => a.toLowerCase())).size !== 4) throw erro(400, 'As quatro alternativas precisam ser diferentes.');
  const correta = inteiro(corpo.correta, { min: 0, max: 3 });
  if (correta == null) throw erro(400, 'Marque qual alternativa é a certa.');
  return { categoria, texto: t, alternativas, correta };
}

async function buscarPergunta(req) {
  const p = await db.get('SELECT * FROM perguntas WHERE id = ?', idDaRota(req));
  if (!p) throw erro(404, 'Pergunta não encontrada.');
  return p;
}

const gerenciar = exigir('recreacao.perguntas');

r.get('/perguntas', gerenciar, async (req, res) => {
  const lista = await db.all('SELECT * FROM perguntas ORDER BY id DESC');
  res.json({
    categorias: CATEGORIAS,
    perguntas: lista.map(p => ({ ...p, alternativas: JSON.parse(p.alternativas) })),
  });
});

r.post('/perguntas', gerenciar, async (req, res) => {
  const p = validarPergunta(req.body);
  const { id } = await db.run('INSERT INTO perguntas (categoria, texto, alternativas, correta, criado_por_nome) VALUES (?, ?, ?, ?, ?)',
    p.categoria, p.texto, JSON.stringify(p.alternativas), p.correta, req.usuario.nome);
  await anotar(req, 'Criou uma pergunta do quiz', p.texto);
  await progresso.registrar(req.usuario.id, 'pergunta');
  res.status(201).json({ id });
});

r.put('/perguntas/:id', gerenciar, async (req, res) => {
  const antiga = await buscarPergunta(req);
  const p = validarPergunta(req.body);
  await db.run('UPDATE perguntas SET categoria = ?, texto = ?, alternativas = ?, correta = ? WHERE id = ?',
    p.categoria, p.texto, JSON.stringify(p.alternativas), p.correta, antiga.id);
  await anotar(req, 'Editou uma pergunta do quiz', p.texto);
  res.json({ ok: true });
});

r.delete('/perguntas/:id', gerenciar, async (req, res) => {
  const p = await buscarPergunta(req);
  await db.run('DELETE FROM perguntas WHERE id = ?', p.id);
  await anotar(req, 'Apagou uma pergunta do quiz', p.texto);
  res.json({ ok: true });
});

module.exports = r;
