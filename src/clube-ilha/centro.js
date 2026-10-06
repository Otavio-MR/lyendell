// Região "centro" da Ilha do Club Coelho no servidor (veja index.js): as salas novas em volta da Praça
// (Sala de Leitura, Fliperama, Plaza, Pet Shop, Pizzaria, Teatro, Hotel, Spa, Cobertura, Parque e Pista de
// Skate), os minijogos (Mancala das Cenouras, Fábrica de Pizzas de Cenoura e Lança-Pompom) e a chave do
// Quartel do Capitão, que fica escondida no Livro do Capitão Saltarrocha, na Sala de Leitura.
// O desenho de tudo fica no navegador (public/js/ilha/centro.js e centro-jogos.js).

// Tudo num quadro de 1000 x 600. "chegada": onde o coelho aparece, conforme a sala de onde veio (perto da
// porta de volta).
const salas = {
  leitura: { nome: 'Sala de Leitura', chao: [40, 360, 960, 585], chegada: { padrao: [115, 476], cafe: [115, 476] } },
  fliperama: { nome: 'Fliperama', chao: [40, 384, 960, 585], chegada: { padrao: [110, 476], danca: [110, 476] } },
  plaza: {
    nome: 'Plaza', chao: [30, 400, 970, 585],
    chegada: { padrao: [500, 540], praca: [260, 560], forte: [70, 432], floresta: [70, 522], parque: [930, 496], petshop: [140, 410], pizzaria: [375, 410], teatro: [620, 410], hotel: [870, 410] },
  },
  petshop: { nome: 'Pet Shop dos Pompons', chao: [40, 380, 960, 585], chegada: { padrao: [500, 545], plaza: [500, 545], qg: [370, 400], dimensao_caixas: [860, 572] } },
  pizzaria: { nome: 'Pizzaria', chao: [40, 380, 960, 585], chegada: { padrao: [500, 545], plaza: [500, 545] } },
  teatro: { nome: 'Teatro', chao: [40, 330, 960, 585], chegada: { padrao: [500, 545], plaza: [500, 545] } },
  hotel: { nome: 'Saguão do Hotel dos Pompons', chao: [40, 365, 960, 585], chegada: { padrao: [500, 545], plaza: [500, 545], hotel_cobertura: [690, 384], hotel_spa: [865, 384] } },
  hotel_spa: { nome: 'Spa dos Pompons', chao: [40, 380, 960, 585], chegada: { padrao: [100, 406], hotel: [100, 406] } },
  hotel_cobertura: { nome: 'Cobertura do Hotel', chao: [40, 345, 960, 585], chegada: { padrao: [105, 384], hotel: [105, 384] } },
  parque: { nome: 'Parque dos Pompons', chao: [30, 380, 970, 585], chegada: { padrao: [500, 500], plaza: [70, 500], skate: [930, 500] } },
  skate: { nome: 'Pista de Skate', chao: [30, 405, 970, 585], chegada: { padrao: [70, 500], parque: [70, 500] } },
};

// A recompensa em cenouras de cada minijogo (pontos vêm do navegador, cortados no "limite"; no máximo "max"
// por partida, e o teto do dia vale para tudo).
const minijogos = {
  // Mancala: pontos = as cenourinhas na sua casa no fim (de 0 a 48; ganha quem tem mais de 24).
  mancala: { max: 40, cenouras: p => (p > 24 ? 16 + (p - 24) : p / 3), limite: 48 },
  // Fábrica de Pizzas: pontos = pizzas certinhas entregues.
  pizzaria: { max: 50, cenouras: p => p * 2.5, limite: 40 },
  // Lança-Pompom: pontos = cenouras pegas no caminho + 15 de chegar ao fim.
  lanca_pompom: { max: 50, cenouras: p => p, limite: 60 },
};

// A chave do Quartel do Capitão (vem do Livro do Capitão, na Sala de Leitura): só pode virar true.
const progresso = {
  'navio.chave': valor => (valor === true ? true : undefined),
};

module.exports = { salas, minijogos, progresso, aoEmote: null };
