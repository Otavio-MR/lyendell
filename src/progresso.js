// Progresso de cada pessoa no site: experiência (XP), nível, sequência de dias, missões do dia e conquistas.
// As outras partes do sistema só chamam registrar(id, 'tipo') quando algo acontece.

const { db } = require('./db');
const { hoje } = require('./cobranca');

/* ─── XP ──────────────────────────────────────────── */

// XP por evento e quantos eventos por dia valem XP (para ninguém "farmar" mandando mensagem à toa).
const REGRAS = {
  chat: { xp: 1, teto: 30 },
  partida: { xp: 5, teto: 20 },
  vitoria: { xp: 10, teto: 10 },
  quiz_acerto: { xp: 2, teto: 30 },
  solo: { xp: 3, teto: 20 },
  entrega: { xp: 15, teto: 10 },
  anuncio: { xp: 10, teto: 3 },
  foto: { xp: 5, teto: 10 },
  registro: { xp: 10, teto: 10 },
  recado: { xp: 3, teto: 10 },
};

// XP total para chegar em cada nível: 2 = 100, 3 = 300, 5 = 1000, 10 = 4500, 20 = 19000.
const xpDoNivel = n => 50 * n * (n - 1);
function nivelDe(xp) {
  let n = 1;
  while (xpDoNivel(n + 1) <= xp) n++;
  return n;
}

const TITULOS = [[1, 'Filhote'], [3, 'Láparo'], [5, 'Coelho do Campo'], [8, 'Coelho da Toca'], [12, 'Coelho Veloz'],
  [16, 'Coelho de Prata'], [20, 'Coelho Dourado'], [25, 'Coelho Coroado']];
const tituloDoNivel = n => TITULOS.filter(([min]) => n >= min).pop()[1];

// Molduras da foto, liberadas pelo nível.
const MOLDURAS = [
  { chave: 'simples', nome: 'Simples', nivel: 1 },
  { chave: 'bronze', nome: 'Bronze', nivel: 5 },
  { chave: 'prata', nome: 'Prata', nivel: 10 },
  { chave: 'ouro', nome: 'Ouro', nivel: 15 },
  { chave: 'esmeralda', nome: 'Esmeralda', nivel: 20 },
  { chave: 'coroa', nome: 'Coroa', nivel: 25 },
];

function infoNivel(xp = 0) {
  const nivel = nivelDe(xp);
  return { xp, nivel, titulo: tituloDoNivel(nivel), xpNivel: xpDoNivel(nivel), xpProximo: xpDoNivel(nivel + 1) };
}

/* ─── Missões do dia ──────────────────────────────── */

const MISSOES = [
  { chave: 'chat5', tipo: 'chat', meta: 5, xp: 30, texto: 'Converse no chat da cidade: 5 mensagens (spam, repetidas e "kkkk" não contam)' },
  { chave: 'partida3', tipo: 'partida', meta: 3, xp: 40, texto: 'Termine 3 partidas ao vivo (quiz, velha ou pedra, papel e tesoura)' },
  { chave: 'vitoria1', tipo: 'vitoria', meta: 1, xp: 50, texto: 'Vença uma partida ao vivo' },
  { chave: 'quiz5', tipo: 'quiz_acerto', meta: 5, xp: 40, texto: 'Acerte 5 perguntas no Quiz de Lyendell' },
  { chave: 'solo2', tipo: 'solo', meta: 2, xp: 25, texto: 'Jogue 2 vezes Pac-Coelho, Cobrinha ou Quebra-cabeça' },
  { chave: 'recado1', tipo: 'recado', meta: 1, xp: 25, texto: 'Deixe um recado no perfil de alguém' },
  { chave: 'entrega1', tipo: 'entrega', meta: 1, xp: 50, texto: 'Tenha uma entrega conferida numa atividade' },
];

// Números "aleatórios" que se repetem para a mesma data: todo mundo tem as mesmas missões no dia.
function sorteio(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function missoesDoDia(dia = hoje()) {
  const r = sorteio(`missoes-${dia}`);
  const lista = [...MISSOES];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.slice(0, 3);
}

/* ─── Conquistas ──────────────────────────────────── */

// Cada conquista mede um número (stat) e libera quando chega na meta.
// "tipos": quais eventos podem liberar a conquista (para não recalcular tudo a cada mensagem).
const CONQUISTAS = [
  { chave: 'perfil', nome: 'Toca arrumada', desc: 'Preencheu a frase e o "sobre mim" do perfil.', icone: 'editar', stat: 'perfil', meta: 1, tipos: ['perfil'] },
  { chave: 'fiel7', nome: 'Visita fiel', desc: 'Entrou no site 7 dias seguidos.', icone: 'fogo', stat: 'sequencia', meta: 7, tipos: ['visita'] },
  { chave: 'fiel30', nome: 'Morador de verdade', desc: 'Entrou no site 30 dias seguidos.', icone: 'fogo', stat: 'sequencia', meta: 30, tipos: ['visita'] },
  { chave: 'chat1', nome: 'Primeira palavra', desc: 'Mandou a primeira mensagem no chat.', icone: 'chat', stat: 'chat', meta: 1, tipos: ['chat'] },
  { chave: 'chat100', nome: 'Tagarela', desc: 'Mandou 100 mensagens no chat.', icone: 'chat', stat: 'chat', meta: 100, tipos: ['chat'] },
  { chave: 'chat1000', nome: 'Voz de Lyendell', desc: 'Mandou 1000 mensagens no chat.', icone: 'megafone', stat: 'chat', meta: 1000, tipos: ['chat'] },
  { chave: 'partida1', nome: 'Estreante', desc: 'Terminou a primeira partida ao vivo.', icone: 'jogos', stat: 'partidas', meta: 1, tipos: ['partida'] },
  { chave: 'partida50', nome: 'Frequentador da Recreação', desc: 'Terminou 50 partidas ao vivo.', icone: 'jogos', stat: 'partidas', meta: 50, tipos: ['partida'] },
  { chave: 'vitoria1', nome: 'Primeira vitória', desc: 'Venceu uma partida ao vivo.', icone: 'trofeu', stat: 'vitorias', meta: 1, tipos: ['vitoria'] },
  { chave: 'vitoria25', nome: 'Campeão da Recreação', desc: 'Venceu 25 partidas ao vivo.', icone: 'trofeu', stat: 'vitorias', meta: 25, tipos: ['vitoria'] },
  { chave: 'quizvence', nome: 'Sábio da Toca', desc: 'Venceu um quiz com pelo menos duas pessoas.', icone: 'pergunta', stat: 'quizVitorias', meta: 1, tipos: ['vitoria', 'partida'] },
  { chave: 'quiz100', nome: 'Enciclopédia', desc: 'Acertou 100 perguntas no quiz.', icone: 'livro', stat: 'quizAcertos', meta: 100, tipos: ['quiz_acerto'] },
  { chave: 'pac10k', nome: 'Comilão', desc: 'Fez 10.000 pontos no Pac-Coelho.', icone: 'coelho', stat: 'pacman', meta: 10000, tipos: ['solo'] },
  { chave: 'pac30k', nome: 'Terror das Raposas', desc: 'Fez 30.000 pontos no Pac-Coelho.', icone: 'coelho', stat: 'pacman', meta: 30000, tipos: ['solo'] },
  { chave: 'cobra30', nome: 'Cobra criada', desc: 'Comeu 30 cenouras numa partida de Cobrinha.', icone: 'cobra', stat: 'cobrinha', meta: 30, tipos: ['solo'] },
  { chave: 'quebra5', nome: 'Mestre montador', desc: 'Montou um quebra-cabeça 5x5.', icone: 'peca', stat: 'quebra5', meta: 1, tipos: ['solo'] },
  { chave: 'entrega1', nome: 'Mão na massa', desc: 'Teve a primeira entrega conferida numa atividade.', icone: 'tarefas', stat: 'entregas', meta: 1, tipos: ['entrega'] },
  { chave: 'entrega10', nome: 'Braço forte', desc: 'Teve 10 entregas conferidas.', icone: 'bau', stat: 'entregas', meta: 10, tipos: ['entrega'] },
  { chave: 'anuncio1', nome: 'Arauto', desc: 'Publicou o primeiro anúncio no mural.', icone: 'megafone', stat: 'anuncios', meta: 1, tipos: ['anuncio'] },
  { chave: 'foto5', nome: 'Pintor da corte', desc: 'Enviou 5 fotos para a galeria.', icone: 'imagem', stat: 'fotos', meta: 5, tipos: ['foto'] },
  { chave: 'registro10', nome: 'Pena afiada', desc: 'Fez 10 registros nos livros (Tabelionato, Guarda, Hospital ou Congresso).', icone: 'pena', stat: 'registros', meta: 10, tipos: ['registro'] },
  { chave: 'recado5', nome: 'Amigo de todos', desc: 'Deixou recado no perfil de 5 pessoas diferentes.', icone: 'usuarios', stat: 'recadosPessoas', meta: 5, tipos: ['recado'] },
  { chave: 'nivel10', nome: 'Coelho Veloz', desc: 'Chegou ao nível 10.', icone: 'estrela', stat: 'nivel', meta: 10, tipos: ['nivel'] },
  { chave: 'nivel20', nome: 'Coelho Dourado', desc: 'Chegou ao nível 20.', icone: 'coroa', stat: 'nivel', meta: 20, tipos: ['nivel'] },
];
const CONQUISTA = Object.fromEntries(CONQUISTAS.map(c => [c.chave, c]));

const n = async (sql, ...args) => Number((await db.get(sql, ...args))?.n || 0);

const STATS = {
  perfil: id => n("SELECT (COALESCE(TRIM(titulo_perfil), '') <> '' AND COALESCE(TRIM(bio), '') <> '') AS n FROM usuarios WHERE id = ?", id),
  sequencia: id => n('SELECT sequencia_max AS n FROM usuarios WHERE id = ?', id),
  chat: id => n("SELECT SUM(qtd) AS n FROM eventos_dia WHERE usuario_id = ? AND tipo = 'chat'", id),
  partidas: id => n(`SELECT (SELECT COUNT(*) FROM partidas WHERE jogador1_id = ? OR jogador2_id = ?)
    + (SELECT COUNT(*) FROM quiz_resultados WHERE usuario_id = ? AND jogadores > 1) AS n`, id, id, id),
  vitorias: id => n(`SELECT (SELECT COUNT(*) FROM partidas WHERE (jogador1_id = ? AND vencedor = 1) OR (jogador2_id = ? AND vencedor = 2))
    + (SELECT COUNT(*) FROM quiz_resultados WHERE usuario_id = ? AND posicao = 1 AND jogadores > 1) AS n`, id, id, id),
  quizVitorias: id => n('SELECT COUNT(*) AS n FROM quiz_resultados WHERE usuario_id = ? AND posicao = 1 AND jogadores > 1', id),
  quizAcertos: id => n('SELECT SUM(acertos) AS n FROM quiz_resultados WHERE usuario_id = ?', id),
  pacman: id => n("SELECT MAX(pontos) AS n FROM recordes WHERE jogo = 'pacman' AND usuario_id = ?", id),
  cobrinha: id => n("SELECT MAX(pontos) AS n FROM recordes WHERE jogo = 'cobrinha' AND usuario_id = ?", id),
  quebra5: id => n("SELECT COUNT(*) AS n FROM recordes WHERE jogo = 'quebra' AND variante = '5x5' AND usuario_id = ?", id),
  entregas: id => n('SELECT COUNT(*) AS n FROM contribuicoes WHERE usuario_id = ? AND conferida = 1', id),
  anuncios: id => n('SELECT COUNT(*) AS n FROM anuncios WHERE autor_id = ?', id),
  fotos: id => n('SELECT COUNT(*) AS n FROM fotos WHERE enviado_por = ?', id),
  registros: id => n('SELECT COUNT(*) AS n FROM registros WHERE criado_por = ?', id),
  recadosPessoas: id => n('SELECT COUNT(DISTINCT perfil_id) AS n FROM recados WHERE autor_id = ? AND perfil_id <> ?', id, id),
  nivel: async id => nivelDe(await n('SELECT xp AS n FROM usuarios WHERE id = ?', id)),
};

// Calcula só os números pedidos (cada um uma vez).
async function calcular(id, nomes) {
  const saida = {};
  for (const nome of new Set(nomes)) saida[nome] = await STATS[nome](id);
  return saida;
}

// Libera as conquistas que a pessoa já alcançou. tipo = null confere todas.
async function conferirConquistas(id, tipo = null) {
  const ja = new Set((await db.all('SELECT chave FROM conquistas_usuario WHERE usuario_id = ?', id)).map(c => c.chave));
  const candidatas = CONQUISTAS.filter(c => !ja.has(c.chave) && (!tipo || c.tipos.includes(tipo)));
  if (!candidatas.length) return [];
  const valores = await calcular(id, candidatas.map(c => c.stat));
  const novas = candidatas.filter(c => valores[c.stat] >= c.meta);
  for (const c of novas) {
    await db.run('INSERT INTO conquistas_usuario (usuario_id, chave) VALUES (?, ?) ON CONFLICT (usuario_id, chave) DO NOTHING', id, c.chave);
  }
  return novas.map(c => ({ tipo: 'conquista', chave: c.chave, nome: c.nome, desc: c.desc, icone: c.icone }));
}

/* ─── Registrar o que acontece ────────────────────── */

let notificador = null;
// Quem avisa a pessoa na hora (a conexão ao vivo da Recreação).
function definirNotificador(fn) { notificador = fn; }
function avisar(id, notas) {
  if (notas.length && notificador) {
    try { notificador(id, notas); } catch (e) { console.error('Erro ao avisar progresso:', e.message); }
  }
}

async function contarNoDia(id, dia, tipo, qtd) {
  const antes = Number((await db.get('SELECT qtd FROM eventos_dia WHERE usuario_id = ? AND dia = ? AND tipo = ?', id, dia, tipo))?.qtd || 0);
  await db.run(`INSERT INTO eventos_dia (usuario_id, dia, tipo, qtd) VALUES (?, ?, ?, ?)
    ON CONFLICT (usuario_id, dia, tipo) DO UPDATE SET qtd = qtd + excluded.qtd`, id, dia, tipo, qtd);
  return antes;
}

async function ganharXp(id, xp, dia = hoje()) {
  if (xp <= 0) return [];
  const linha = await db.get('UPDATE usuarios SET xp = xp + ? WHERE id = ? RETURNING xp', xp, id);
  if (!linha) return [];
  await contarNoDia(id, dia, 'xp', xp);
  const antes = nivelDe(linha.xp - xp);
  const depois = nivelDe(linha.xp);
  if (depois <= antes) return [];
  const moldura = MOLDURAS.find(m => m.nivel > antes && m.nivel <= depois);
  return [
    { tipo: 'nivel', nivel: depois, titulo: tituloDoNivel(depois), moldura: moldura?.nome || null },
    ...await conferirConquistas(id, 'nivel'),
  ];
}

// Conta um evento, dá o XP (respeitando o teto do dia), fecha missões e libera conquistas.
async function registrar(id, tipo, qtd = 1) {
  if (!id || !(qtd > 0)) return [];
  try {
    const dia = hoje();
    const antes = await contarNoDia(id, dia, tipo, qtd);
    const regra = REGRAS[tipo];
    let xp = regra ? Math.max(0, Math.min(qtd, regra.teto - antes)) * regra.xp : 0;
    const notas = [];
    for (const m of missoesDoDia(dia)) {
      if (m.tipo === tipo && antes < m.meta && antes + qtd >= m.meta) {
        xp += m.xp;
        notas.push({ tipo: 'missao', texto: m.texto, xp: m.xp });
      }
    }
    notas.push(...await ganharXp(id, xp, dia), ...await conferirConquistas(id, tipo));
    avisar(id, notas);
    return notas;
  } catch (e) {
    console.error('Erro ao registrar progresso:', e.message);
    return [];
  }
}

const diaAnterior = dia => new Date(Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)) - 864e5).toISOString().slice(0, 10);

// Primeira visita do dia: conta a sequência de dias seguidos e dá XP (mais para quem não falta).
async function registrarVisita(id) {
  try {
    const dia = hoje();
    const u = await db.get('SELECT ultimo_dia, sequencia FROM usuarios WHERE id = ?', id);
    if (!u || u.ultimo_dia === dia) return null;
    const sequencia = u.ultimo_dia === diaAnterior(dia) ? Number(u.sequencia) + 1 : 1;
    const { changes } = await db.run(`UPDATE usuarios SET ultimo_dia = ?, sequencia = ?, sequencia_max = MAX(sequencia_max, ?)
      WHERE id = ? AND (ultimo_dia IS NULL OR ultimo_dia <> ?)`, dia, sequencia, sequencia, id, dia);
    if (!changes) return null; // outra aba já contou
    const xp = 10 + 2 * Math.min(sequencia - 1, 10);
    await contarNoDia(id, dia, 'visita', 1);
    const notas = [...await ganharXp(id, xp, dia), ...await conferirConquistas(id, 'visita')];
    avisar(id, notas);
    return { sequencia, xp, notas };
  } catch (e) {
    console.error('Erro ao registrar visita:', e.message);
    return null;
  }
}

/* ─── Leitura (telas) ─────────────────────────────── */

async function missoesDe(id, dia = hoje()) {
  const feitos = Object.fromEntries((await db.all('SELECT tipo, qtd FROM eventos_dia WHERE usuario_id = ? AND dia = ?', id, dia)).map(e => [e.tipo, Number(e.qtd)]));
  return missoesDoDia(dia).map(m => ({ chave: m.chave, texto: m.texto, meta: m.meta, xp: m.xp, feito: Math.min(m.meta, feitos[m.tipo] || 0) }));
}

// Todas as conquistas, com data de quem já tem e o quanto falta para as outras.
async function conquistasDe(id) {
  const tem = Object.fromEntries((await db.all('SELECT chave, em FROM conquistas_usuario WHERE usuario_id = ?', id)).map(c => [c.chave, c.em]));
  const valores = await calcular(id, CONQUISTAS.map(c => c.stat));
  return CONQUISTAS.map(c => ({
    chave: c.chave, nome: c.nome, desc: c.desc, icone: c.icone, meta: c.meta,
    valor: Math.min(c.meta, valores[c.stat] || 0), em: tem[c.chave] || null,
  }));
}

module.exports = {
  REGRAS, MISSOES, CONQUISTAS, CONQUISTA, MOLDURAS, TITULOS,
  infoNivel, nivelDe, xpDoNivel, missoesDoDia, missoesDe, conquistasDe, conferirConquistas,
  registrar, registrarVisita, definirNotificador, avisar, calcular,
};
