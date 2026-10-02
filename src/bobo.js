// Bobo da Corte: pegadinhas com o pessoal e piadas na praça (o chat da cidade).
// Só quem tem o poder "bobo.pegadinhas" (o cargo de Bobo da Corte) usa. Tudo com tempo de espera justo:
//  - uma pegadinha a cada 10 minutos;
//  - a mesma pessoa só pode ser alvo de novo depois de 2 horas (de qualquer Bobo);
//  - a chuva de confete (para todo mundo) a cada 30 minutos, e uma piada na praça a cada 15 minutos.
// A pegadinha chega na hora para quem está no site; quem está fora recebe quando entrar (dentro de 2 dias).
// Este arquivo só tem as regras e o banco; rotas/bobo.js entrega pela conexão ao vivo (recreacao.js).

const { db } = require('./db');

const MIN = 60_000;
const TIPOS = {
  torta: { nome: 'Torta na cara', icone: 'torta', texto: 'Uma torta de creme voa direto na cara da pessoa. Ela tem que limpar a tela.' },
  ponta: { nome: 'Mundo de ponta-cabeça', icone: 'aleatorio', texto: 'O site da pessoa vira de ponta-cabeça por uns segundos.' },
  pum: { nome: 'Almofada de pum', icone: 'pum', texto: 'A pessoa "senta" numa almofada de pum. Com barulho e tudo!' },
  nariz: { nome: 'Nariz de palhaço', icone: 'nariz', texto: 'A pessoa fica com um nariz de palhaço na foto por 30 minutos, e todo mundo vê.' },
  coelhos: { nome: 'Estouro de coelhos', icone: 'coelho', texto: 'Uma manada de coelhinhos atravessa a tela da pessoa.' },
  confete: { nome: 'Chuva de confete', icone: 'confete', texto: 'Confete na tela de todo mundo que está no site agora.', todos: true },
};
const ESPERA = {
  pegadinha: Number(process.env.BOBO_ESPERA_MS) || 10 * MIN,
  alvo: Number(process.env.BOBO_ALVO_MS) || 120 * MIN,
  confete: Number(process.env.BOBO_CONFETE_MS) || 30 * MIN,
  piada: Number(process.env.BOBO_PIADA_MS) || 15 * MIN,
};
const NARIZ_MS = Number(process.env.BOBO_NARIZ_MS) || 30 * MIN;
const ENTREGA_MS = 2 * 24 * 60 * MIN; // pegadinha não entregue some depois de 2 dias
const REACOES = { riu: 'riu muito da sua pegadinha', vinganca: 'jurou vingança', aplaudiu: 'aplaudiu a sua pegadinha' };

class ErroBobo extends Error {}

const ms = texto => Date.parse(String(texto).replace(' ', 'T') + 'Z');
const ultimo = async (sql, ...args) => {
  const l = await db.get(sql, ...args);
  return l?.em ? ms(l.em) : 0;
};

// Quanto falta (ms) para o Bobo poder fazer cada coisa. 0 = já pode.
async function esperas(boboId, agora = Date.now()) {
  const [pegadinha, confete, piada] = await Promise.all([
    ultimo("SELECT MAX(criado_em) AS em FROM pegadinhas WHERE de_id = ? AND tipo <> 'confete'", boboId),
    ultimo("SELECT MAX(criado_em) AS em FROM pegadinhas WHERE de_id = ? AND tipo = 'confete'", boboId),
    ultimo("SELECT MAX(criado_em) AS em FROM chat_mensagens WHERE usuario_id = ? AND tipo = 'piada'", boboId),
  ]);
  const falta = (desde, espera) => Math.max(0, desde + espera - agora);
  return { pegadinha: falta(pegadinha, ESPERA.pegadinha), confete: falta(confete, ESPERA.confete), piada: falta(piada, ESPERA.piada) };
}

// Quanto falta para a pessoa poder ser alvo de novo (de qualquer Bobo).
async function protecaoDe(alvoId, agora = Date.now()) {
  const desde = await ultimo('SELECT MAX(criado_em) AS em FROM pegadinhas WHERE alvo_id = ?', alvoId);
  return Math.max(0, desde + ESPERA.alvo - agora);
}

const relogio = t => {
  const m = Math.ceil(t / MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

// Faz a pegadinha (já conferido que a pessoa é Bobo). Devolve a linha gravada.
async function pregar(bobo, tipo, alvo) {
  const t = TIPOS[tipo];
  if (!t) throw new ErroBobo('Essa pegadinha não existe.');
  const espera = await esperas(bobo.id);
  if (t.todos) {
    if (espera.confete) throw new ErroBobo(`O confete ainda está sendo varrido. Mais confete daqui a ${relogio(espera.confete)}.`);
  } else {
    if (espera.pegadinha) throw new ErroBobo(`Calma, Bobo! A próxima pegadinha fica pronta em ${relogio(espera.pegadinha)}.`);
    if (!alvo) throw new ErroBobo('Escolha quem vai cair na pegadinha.');
    if (alvo.id === bobo.id) throw new ErroBobo('Pregar peça em si mesmo não vale!');
    const protegido = await protecaoDe(alvo.id);
    if (protegido) throw new ErroBobo(`${alvo.nome} já caiu numa pegadinha agora há pouco. Deixe a pessoa respirar (mais ${relogio(protegido)}).`);
  }
  const { id } = await db.run('INSERT INTO pegadinhas (tipo, de_id, de_nome, alvo_id, alvo_nome) VALUES (?, ?, ?, ?, ?)',
    tipo, bobo.id, bobo.nome, t.todos ? null : alvo.id, t.todos ? null : alvo.nome);
  return db.get('SELECT * FROM pegadinhas WHERE id = ?', id);
}

// O que vai pela conexão ao vivo para quem caiu (ou para todos, no confete).
const pacote = p => ({ id: p.id, tipo: p.tipo, de: { id: p.de_id, nome: p.de_nome }, em: p.criado_em });

// Pegadinhas que a pessoa ainda não viu (estava fora do site). O nariz é visto pelos outros, não precisa entregar.
async function pendentes(alvoId) {
  const limite = new Date(Date.now() - ENTREGA_MS).toISOString().slice(0, 19).replace('T', ' ');
  return db.all("SELECT * FROM pegadinhas WHERE alvo_id = ? AND entregue = 0 AND tipo <> 'nariz' AND criado_em >= ? ORDER BY id", alvoId, limite);
}
const marcarEntregue = id => db.run('UPDATE pegadinhas SET entregue = 1 WHERE id = ?', id);

// Quem está de nariz de palhaço agora: { nome: até quando (ms) }.
async function narizes(agora = Date.now()) {
  const desde = new Date(agora - NARIZ_MS).toISOString().slice(0, 19).replace('T', ' ');
  const linhas = await db.all("SELECT alvo_nome, MAX(criado_em) AS em FROM pegadinhas WHERE tipo = 'nariz' AND criado_em >= ? GROUP BY alvo_id", desde);
  return Object.fromEntries(linhas.map(l => [l.alvo_nome, ms(l.em) + NARIZ_MS]));
}

// Quem é Bobo da Corte (pelo cargo): o chat mostra o nome dessas pessoas com o chapéu de guizos.
async function bobos() {
  const linhas = await db.all(`SELECT DISTINCT uc.usuario_id AS id FROM usuario_cargos uc JOIN cargos c ON c.id = uc.cargo_id
    JOIN usuarios u ON u.id = uc.usuario_id WHERE u.ativo = 1 AND c.permissoes LIKE '%"bobo.pegadinhas"%'`);
  return linhas.map(l => l.id);
}

// A pessoa que caiu reage (só a quem caiu, uma vez).
async function reagir(alvoId, id, reacao) {
  if (!REACOES[reacao]) throw new ErroBobo('Reação desconhecida.');
  const p = await db.get('SELECT * FROM pegadinhas WHERE id = ? AND alvo_id = ?', Number(id) || 0, alvoId);
  if (!p) throw new ErroBobo('Essa pegadinha não foi com você.');
  if (p.reacao) return null;
  await db.run('UPDATE pegadinhas SET reacao = ? WHERE id = ?', reacao, p.id);
  return { ...p, reacao, texto: REACOES[reacao] };
}

// Histórico para a Caixa de Pegadinhas e o placar das vítimas.
async function historico(limite = 30) {
  const [recentes, vitimas, bobosTop] = await Promise.all([
    db.all('SELECT id, tipo, de_id, de_nome, alvo_id, alvo_nome, reacao, criado_em FROM pegadinhas ORDER BY id DESC LIMIT ?', limite),
    db.all(`SELECT alvo_id AS id, alvo_nome AS nome, COUNT(*) AS n FROM pegadinhas WHERE alvo_id IS NOT NULL
      GROUP BY alvo_id ORDER BY n DESC, MAX(id) DESC LIMIT 5`),
    db.all("SELECT de_id AS id, de_nome AS nome, COUNT(*) AS n, SUM(reacao = 'riu') AS risadas FROM pegadinhas GROUP BY de_id ORDER BY n DESC LIMIT 5"),
  ]);
  return { recentes, vitimas: vitimas.map(v => ({ ...v, n: Number(v.n) })), bobos: bobosTop.map(b => ({ ...b, n: Number(b.n), risadas: Number(b.risadas) || 0 })) };
}

module.exports = { TIPOS, ESPERA, NARIZ_MS, REACOES, ErroBobo, esperas, protecaoDe, pregar, pacote, pendentes, marcarEntregue, narizes, bobos, reagir, historico };
