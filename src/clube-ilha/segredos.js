// Região "segredos" da Ilha do Club Coelho no servidor (veja index.js): o QG da Guarda Secreta do Coelho,
// a Sala da Caldeira, o Pátio do Dojo, o Dojo (com os três dojos dos elementos e o Esconderijo Ninja) e a
// Dimensão das Caixas. O desenho fica em public/js/ilha/segredos.js; os minijogos em segredos-jogos.js.
//
// A faixa do ninja ('ninja.faixa', 0 a 10) só sobe de 1 em 1 e só depois de uma partida de verdade do
// Desafio Ninja: quem começa uma partida pede uma ficha ('ninja.desafio' = 'comecar'); a faixa sobe com a
// ficha ({ faixa, ficha }), uma vez por ficha, com a ficha velha de pelo menos alguns segundos (uma partida
// leva tempo) e no máximo uma faixa por minuto para cada pessoa. A ficha nova de cada um apaga a anterior
// (a ficha velha vem em "atual", do banco), então cada pessoa tem uma ficha valendo por vez.

const crypto = require('crypto');

const salas = {
  qg: { nome: 'QG da Guarda Secreta do Coelho', chao: [40, 405, 960, 585], chegada: { padrao: [500, 520], petshop: [95, 455], caldeira: [915, 455] } },
  caldeira: { nome: 'Sala da Caldeira', chao: [40, 405, 960, 585], chegada: { padrao: [500, 520], danca: [125, 440], piscina: [890, 445], qg: [770, 430] } },
  patio_dojo: { nome: 'Pátio do Dojo', chao: [30, 395, 970, 585], chegada: { padrao: [500, 500], vila_esqui: [80, 490], dojo: [500, 420] } },
  dojo: {
    nome: 'Dojo', chao: [40, 375, 960, 585],
    chegada: { padrao: [500, 545], patio_dojo: [500, 550], dojo_fogo: [140, 390], dojo_agua: [290, 390], dojo_neve: [710, 390], esconderijo_ninja: [880, 395] },
  },
  dojo_fogo: { nome: 'Dojo do Fogo', chao: [90, 395, 910, 585], chegada: { padrao: [500, 545], dojo: [500, 545] } },
  dojo_agua: { nome: 'Dojo da Água', chao: [90, 395, 910, 585], chegada: { padrao: [500, 545], dojo: [500, 545] } },
  dojo_neve: { nome: 'Dojo da Neve', chao: [90, 395, 910, 585], chegada: { padrao: [500, 545], dojo: [500, 545] } },
  esconderijo_ninja: { nome: 'Esconderijo Ninja', chao: [60, 395, 940, 585], chegada: { padrao: [500, 545], dojo: [500, 545] } },
  dimensao_caixas: { nome: 'Dimensão das Caixas', chao: [120, 400, 880, 570], chegada: { padrao: [500, 500], petshop: [500, 500] } },
};

// As cenouras de cada minijogo (o teto do dia continua valendo).
//   missao_qg: pontos = 25 por etapa resolvida + os segundos que sobraram (até 3 etapas e 75 s).
//   ninja e as versões dos elementos: pontos = cartas conquistadas + 10 por vitória.
const minijogos = {
  missao_qg: { max: 50, cenouras: p => p * 0.35, limite: 150 },
  ninja: { max: 40, cenouras: p => p * 2, limite: 25 },
  ninja_fogo: { max: 50, cenouras: p => p * 2.5, limite: 25 },
  ninja_agua: { max: 50, cenouras: p => p * 2.5, limite: 25 },
  ninja_neve: { max: 55, cenouras: p => p * 2.75, limite: 25 },
};

/* ─── A faixa do ninja ─── */

const FAIXA_MAX = 10;
const PARTIDA_MIN_MS = Number(process.env.NINJA_PARTIDA_MS) || 12_000; // a ficha precisa ter pelo menos isso
const ENTRE_FAIXAS_MS = Number(process.env.NINJA_FAIXA_MS) || 60_000;  // uma faixa por minuto, por pessoa
const FICHA_VALE_MS = 60 * 60_000;                                     // a ficha vale uma hora
const fichas = new Map();     // ficha -> { em, usada, cadeia: { subiu } } (cadeia: a mesma para as fichas de uma pessoa)
const porUsuario = new Map(); // id -> quando a faixa subiu (se a rota mandar quem é)

function limparFichas(agora) {
  if (fichas.size < 2000) return;
  for (const [k, f] of fichas) if (agora - f.em > FICHA_VALE_MS) fichas.delete(k);
}

const progresso = {
  // Começar uma partida do Desafio Ninja: devolve a ficha nova (e a anterior da pessoa deixa de valer).
  'ninja.desafio'(valor, atual) {
    if (valor !== 'comecar') return undefined;
    const agora = Date.now();
    limparFichas(agora);
    const velha = atual && typeof atual.ficha === 'string' ? fichas.get(atual.ficha) : null;
    if (atual && typeof atual.ficha === 'string') fichas.delete(atual.ficha);
    const ficha = crypto.randomBytes(12).toString('hex');
    fichas.set(ficha, { em: agora, usada: false, cadeia: velha?.cadeia || { subiu: 0 } });
    return { ficha, em: agora };
  },
  // Subir a faixa: { faixa: atual + 1, ficha }. Devolve o número novo (ou undefined, que recusa).
  'ninja.faixa'(valor, atual, usuario) {
    const antes = Math.max(0, Math.min(FAIXA_MAX, Math.floor(Number(atual) || 0)));
    const nova = Number(valor?.faixa);
    if (!Number.isInteger(nova) || nova !== antes + 1 || nova > FAIXA_MAX) return undefined;
    const f = typeof valor?.ficha === 'string' ? fichas.get(valor.ficha) : null;
    const agora = Date.now();
    if (!f || f.usada || agora - f.em < PARTIDA_MIN_MS || agora - f.em > FICHA_VALE_MS) return undefined;
    if (agora - f.cadeia.subiu < ENTRE_FAIXAS_MS) return undefined;
    const id = usuario && typeof usuario === 'object' ? usuario.id : usuario;
    if (id != null && agora - (porUsuario.get(id) || 0) < ENTRE_FAIXAS_MS) return undefined;
    f.usada = true;
    f.cadeia.subiu = agora;
    if (id != null) porUsuario.set(id, agora);
    return nova;
  },
};

module.exports = { salas, minijogos, progresso, aoEmote: null, FAIXA_MAX };
