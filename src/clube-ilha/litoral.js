// Região "litoral" da Ilha do Club Coelho no servidor (veja index.js): a Floresta, a Prainha, o Ancoradouro, a
// Praia, o Farol e o Mirante, o Grande Iceberg e o Saltador (Convés, Ninho do Corvo, Porão e Quartel do Capitão).
// O desenho fica em public/js/ilha/litoral.js; aqui ficam o chão, as chegadas, as cenouras dos minijogos, o
// progresso (o baú do Capitão, uma vez por dia) e o boato do Iceberg (10 coelhos dançando e ele vira).

// "chao": onde dá para andar. "chegada": onde o coelho aparece, conforme a sala de onde veio (perto da porta de volta).
const salas = {
  floresta: { nome: 'Floresta', chao: [30, 360, 970, 585], chegada: { padrao: [500, 565], plaza: [930, 475], prainha: [70, 480] } },
  prainha: { nome: 'Prainha', chao: [40, 375, 960, 585], chegada: { padrao: [500, 520], floresta: [80, 490] } },
  ancoradouro: { nome: 'Ancoradouro', chao: [30, 385, 970, 585], chegada: { padrao: [500, 540], praca: [75, 480], praia: [925, 480], iceberg: [640, 405] } },
  praia: { nome: 'Praia', chao: [30, 390, 970, 585], chegada: { padrao: [500, 540], ancoradouro: [75, 495], vila_esqui: [385, 405], farol: [165, 405], navio: [860, 412] } },
  farol: { nome: 'Farol', chao: [60, 375, 940, 585], chegada: { padrao: [500, 548], praia: [500, 548], mirante: [800, 430] } },
  mirante: { nome: 'Mirante do Farol', chao: [60, 405, 940, 585], chegada: { padrao: [500, 548], farol: [500, 548] } },
  iceberg: { nome: 'O Grande Iceberg', chao: [150, 380, 860, 540], chegada: { padrao: [500, 450], ancoradouro: [200, 515] } },
  navio: { nome: 'Convés do Saltador', chao: [40, 355, 960, 585], chegada: { padrao: [500, 540], praia: [85, 480], ninho: [500, 370], porao: [690, 545], capitao: [905, 372] } },
  ninho: { nome: 'Ninho do Corvo', chao: [300, 445, 700, 530], chegada: { padrao: [500, 490], navio: [400, 500] } },
  porao: { nome: 'Porão do Saltador', chao: [60, 405, 940, 585], chegada: { padrao: [500, 530], navio: [165, 450] } },
  capitao: { nome: 'Quartel do Capitão', chao: [60, 385, 940, 585], chegada: { padrao: [500, 550], navio: [110, 470] } },
};

// As cenouras de cada minijogo (max: o máximo por partida; limite: o maior número de pontos aceito).
const minijogos = {
  surfe: { max: 60, cenouras: p => p / 40, limite: 8000 },        // Pegando Ondas: pontos (truques, conchas, tempo na onda)
  pesca_gelo: { max: 60, cenouras: p => p * 2, limite: 60 },      // Pescaria no Gelo: peixes (o Peixão vale 10)
  jato: { max: 60, cenouras: p => p / 3, limite: 600 },           // Aventura a Jato: cenouras pegas (+20 ao chegar)
  tesouro: { max: 60, cenouras: p => p / 2, limite: 400 },        // Caça ao Tesouro: pontos das 3 rodadas
  bau_capitao: { max: 15, cenouras: () => 15, limite: 1, umaVezPorDia: true },        // Baú de itens raros: presente fixo (uma vez por dia, veja "navio.bau")
};

// O dia de hoje no fuso do clube (o mesmo do presente do dia).
const hoje = () => require('../cobranca').hoje();
const progresso = {
  // O baú do porão: guarda o dia em que foi aberto (só uma vez por dia).
  'navio.bau'(valor, atual) {
    const dia = hoje();
    return atual === dia ? undefined : dia;
  },
  // A chave do Quartel do Capitão (achada no Livro do Capitão, na Sala de Leitura). Depois de achada, fica.
  'navio.chave'(valor, atual) {
    if (atual === true) return true;
    return valor ? true : undefined;
  },
};

// O boato do Iceberg: cada vez que alguém dança (ou para de dançar) lá, todo mundo da sala recebe quantos estão
// dançando; com 10 ou mais ao mesmo tempo, o iceberg "vira" (no máximo uma vez a cada VIRA_MS).
const PRECISA = 10;
const VIRA_MS = Number(process.env.ICEBERG_VIRA_MS) || 60_000;
let ultimaVirada = 0;
function aoEmote({ sala, e, pessoas, paraSala }) {
  if (sala !== 'iceberg' || e !== 'dancar') return;
  const dancando = pessoas.filter(p => p.dancando).length;
  const agora = Date.now();
  if (dancando >= PRECISA && agora - ultimaVirada >= VIRA_MS) {
    ultimaVirada = agora;
    paraSala('clube:evento', { evento: 'iceberg', fase: 'vira', dancando });
  } else {
    paraSala('clube:evento', { evento: 'iceberg', fase: 'contagem', dancando });
  }
}

module.exports = { salas, minijogos, progresso, aoEmote, PRECISA };
