// Anti-spam do chat: segura quem manda mensagem rápido demais, barra a mesma mensagem repetida
// e silencia por um tempo quem insiste. Também decide se a mensagem conta para o XP e as missões,
// para ninguém cumprir "Mande 5 mensagens no chat" mandando "a", "a", "a", "a", "a".
// Tudo fica na memória do servidor (se ele reiniciar, a contagem recomeça).

const JANELA_MS = 10_000;            // olha as tentativas dos últimos 10 segundos...
const MAX_NA_JANELA = 6;             // ...e mais de 6 nesse tempo é spam
const INTERVALO_MS = 700;            // menos que isso entre duas mensagens é rápido demais
const REPETIDA_MS = 60_000;          // a mesma mensagem de novo dentro de 1 minuto é barrada
const SILENCIO_S = [20, 60, 180, 600]; // quem volta a fazer spam fica cada vez mais tempo sem falar
const PERDAO_MS = 15 * 60_000;       // 15 minutos sem spam e o histórico de silêncios zera
const SEM_CONTAR_MS = 5 * 60_000;    // depois do silêncio, mais 5 minutos sem XP e sem missão pelo chat
const CONTA_A_CADA_MS = Number(process.env.CHAT_CONTA_MS) || 15_000; // só uma mensagem a cada 15 s conta
const MAX_IGUAIS = 20;               // "kkkkk..." com mais de 20 letras iguais seguidas é cortado

const pessoas = new Map(); // id do usuário -> situação no chat

function situacaoDe(id) {
  if (!pessoas.has(id)) {
    pessoas.set(id, { tentativas: [], recentes: [], silencios: 0, ultimoSilencio: 0, silenciadoAte: 0, semContarAte: 0, ultimaQueContou: 0 });
  }
  return pessoas.get(id);
}

// Forma "crua" para comparar mensagens: sem acento, sem maiúscula, sem pontuação e sem letra repetida.
// "Oiii!!", "oi" e "OI..." viram todos "oi".
function essencia(t) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '').replace(/(.)\1+/g, '$1');
}

// Corta sequências enormes da mesma letra (o texto continua o mesmo, só não enche a tela).
const encurtar = t => t.replace(/(.)\1{20,}/gsu, (_, c) => c.repeat(MAX_IGUAIS));

const duracao = s => (s < 60 ? `${s} segundos` : s < 120 ? '1 minuto' : `${Math.round(s / 60)} minutos`);

function silenciar(p, agora) {
  if (agora - p.ultimoSilencio > PERDAO_MS) p.silencios = 0;
  const s = SILENCIO_S[Math.min(p.silencios, SILENCIO_S.length - 1)];
  p.silencios++;
  p.ultimoSilencio = agora;
  p.silenciadoAte = agora + s * 1000;
  p.semContarAte = p.silenciadoAte + SEM_CONTAR_MS;
  p.tentativas = [];
  return s;
}

// Resposta: { ok: true, texto, conta } ou { ok: false, motivo, ate? } (ate = até quando está silenciado).
function avaliar(id, bruto, agora = Date.now()) {
  const p = situacaoDe(id);
  if (agora < p.silenciadoAte) {
    return { ok: false, motivo: 'Você está sem falar no chat por spam.', ate: p.silenciadoAte };
  }
  p.tentativas = p.tentativas.filter(t => agora - t < JANELA_MS);
  const anterior = p.tentativas[p.tentativas.length - 1] ?? -Infinity;
  p.tentativas.push(agora);
  if (p.tentativas.length > MAX_NA_JANELA) {
    const s = silenciar(p, agora);
    return {
      ok: false, ate: p.silenciadoAte, silenciou: true,
      motivo: `Spam: mensagens demais seguidas. Você ficou ${duracao(s)} sem falar no chat, e depois disso o chat não conta para XP e missões por mais 5 minutos.`,
    };
  }
  if (agora - anterior < INTERVALO_MS) return { ok: false, motivo: 'Devagar! Espere um instante entre uma mensagem e outra.' };

  const texto = encurtar(bruto);
  const chave = essencia(texto) || texto.trim().toLowerCase();
  p.recentes = p.recentes.filter(r => agora - r.em < REPETIDA_MS);
  if (p.recentes.some(r => r.chave === chave)) return { ok: false, motivo: 'Você acabou de mandar essa mensagem. Escreva outra coisa.' };
  p.recentes.push({ chave, em: agora });
  if (p.recentes.length > 5) p.recentes.shift();

  // Conta para XP e missões: mensagem com conteúdo (3 letras ou mais, não só "kkkk"),
  // uma a cada 15 segundos, e ninguém que acabou de ser silenciado.
  const ess = essencia(texto);
  const conta = ess.length >= 3 && new Set(ess).size >= 2 && agora >= p.semContarAte && agora - p.ultimaQueContou >= CONTA_A_CADA_MS;
  if (conta) p.ultimaQueContou = agora;
  return { ok: true, texto, conta };
}

// Até quando a pessoa está silenciada (0 se não está). Vai no "olá" para a tela já abrir travada.
function silenciadoAte(id, agora = Date.now()) {
  const p = pessoas.get(id);
  return p && p.silenciadoAte > agora ? p.silenciadoAte : 0;
}

module.exports = { avaliar, silenciadoAte, essencia, SILENCIO_S };
