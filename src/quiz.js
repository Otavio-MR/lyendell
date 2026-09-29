// Quiz de Lyendell: categorias, sorteio das perguntas e regras de pontuação.
// As partidas ao vivo (salas, tempo de cada pergunta) ficam em recreacao.js.

const { db } = require('./db');

const CATEGORIAS = {
  luckham: 'Família Luckham',
  coelhos: 'Coelhos',
  minecraft: 'Minecraft',
  rp: 'Regras de RP',
};
const QUANTIDADES = [5, 10, 15];
const MAX_JOGADORES = 10;
const TEMPO_MS = Number(process.env.QUIZ_TEMPO_MS) || 20_000;     // para responder cada pergunta
const REVELAR_MS = Number(process.env.QUIZ_REVELAR_MS) || 6_000;  // mostrando a resposta certa

class ErroQuiz extends Error {}

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Opções escolhidas por quem abre a sala.
function validarOpcoes(bruto = {}) {
  const categorias = [...new Set((Array.isArray(bruto.categorias) ? bruto.categorias : []).filter(c => CATEGORIAS[c]))];
  if (!categorias.length) throw new ErroQuiz('Escolha pelo menos uma categoria.');
  const quantidade = QUANTIDADES.includes(Number(bruto.quantidade)) ? Number(bruto.quantidade) : 10;
  return { categorias, quantidade };
}

const marcas = lista => lista.map(() => '?').join(', ');

async function contarPerguntas(categorias) {
  return (await db.get(`SELECT COUNT(*) AS n FROM perguntas WHERE categoria IN (${marcas(categorias)})`, ...categorias)).n;
}

// Sorteia as perguntas da partida e embaralha as alternativas de cada uma.
async function sortear({ categorias, quantidade }) {
  const linhas = await db.all(`SELECT * FROM perguntas WHERE categoria IN (${marcas(categorias)}) ORDER BY RANDOM() LIMIT ?`, ...categorias, quantidade);
  if (!linhas.length) throw new ErroQuiz('Não há perguntas nessas categorias.');
  return linhas.map(p => {
    const alternativas = JSON.parse(p.alternativas);
    const ordem = embaralhar([0, 1, 2, 3]);
    return {
      categoria: p.categoria,
      texto: p.texto,
      alternativas: ordem.map(i => alternativas[i]),
      correta: ordem.indexOf(p.correta),
    };
  });
}

// Acertar vale de 500 a 1000 pontos: quanto mais rápido, mais pontos.
function pontosDaResposta(certa, restanteMs) {
  if (!certa) return 0;
  return 500 + Math.round(500 * Math.max(0, Math.min(1, restanteMs / TEMPO_MS)));
}

module.exports = { CATEGORIAS, QUANTIDADES, MAX_JOGADORES, TEMPO_MS, REVELAR_MS, ErroQuiz, validarOpcoes, contarPerguntas, sortear, pontosDaResposta };
