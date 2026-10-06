// Região "neve" da Ilha do Club Coelho no servidor (veja index.js): o Forte Nevado, a Vila de Esqui, a Cabana
// e o Sótão, a Estação de Esqui, a Caverna da Mina (Mina de Ouro, Lago Secreto, Piscina Subterrânea), a Escola
// e a Usina de Reciclagem. Os desenhos ficam em public/js/ilha/neve.js e os minijogos em neve-jogos.js.
//
// "chao": onde dá para andar (x0, y0, x1, y1). "chegada": onde o coelho aparece conforme a sala de onde veio
// (sempre perto da porta de volta).
const salas = {
  forte: { nome: 'Forte Nevado', chao: [30, 330, 970, 585], chegada: { padrao: [500, 500], praca: [70, 470], plaza: [930, 470] } },
  vila_esqui: {
    nome: 'Vila de Esqui', chao: [30, 355, 970, 585],
    chegada: { padrao: [500, 470], mina: [100, 380], reciclagem: [265, 380], cabana: [500, 380], escola: [728, 380], montanha: [895, 385], praia: [75, 525], patio_dojo: [925, 525] },
  },
  cabana: { nome: 'Cabana do Esqui', chao: [60, 384, 940, 585], chegada: { padrao: [500, 548], vila_esqui: [500, 548], sotao: [880, 410] } },
  sotao: { nome: 'Sótão da Cabana', chao: [60, 410, 940, 585], chegada: { padrao: [140, 500], cabana: [140, 500] } },
  montanha: { nome: 'Estação de Esqui', chao: [40, 396, 960, 585], chegada: { padrao: [114, 420], vila_esqui: [114, 420] } },
  mina: {
    nome: 'Caverna da Mina', chao: [40, 396, 960, 585],
    chegada: { padrao: [80, 440], vila_esqui: [80, 440], mina_ouro: [390, 416], piscina: [700, 416], lago_secreto: [920, 424] },
  },
  mina_ouro: { nome: 'Mina de Ouro', chao: [40, 404, 960, 585], chegada: { padrao: [80, 450], mina: [80, 450] } },
  lago_secreto: { nome: 'Lago Secreto', chao: [40, 414, 960, 585], chegada: { padrao: [80, 462], mina: [80, 462] } },
  piscina: { nome: 'Piscina Subterrânea', chao: [40, 396, 960, 585], chegada: { padrao: [80, 430], mina: [80, 430], caldeira: [920, 430] } },
  escola: { nome: 'Escola', chao: [60, 384, 940, 585], chegada: { padrao: [500, 548], vila_esqui: [500, 548] } },
  reciclagem: { nome: 'Usina de Reciclagem', chao: [60, 396, 940, 585], chegada: { padrao: [500, 548], vila_esqui: [500, 548] } },
};

// A recompensa em cenouras de cada minijogo (max: o teto por partida; limite: os pontos que valem).
const minijogos = {
  neve_guerra: { max: 50, cenouras: p => p, limite: 200 },            // raposinhos acertados + bônus das rodadas
  neve_treno: { max: 40, cenouras: p => p * 10, limite: 4 },          // 4 = 1º lugar, 3 = 2º, 2 = 3º, 1 = 4º
  neve_mina: { max: 50, cenouras: p => p * 1.5, limite: 200 },        // pepitas entregues no carrinho
  neve_pompons: { max: 45, cenouras: p => p * 1.5, limite: 120 },     // pompons resgatados
  neve_lixo: { max: 25, cenouras: p => p / 2, limite: 200 },          // lixo separado certo
  neve_quiz: { max: 15, cenouras: p => p * 3, limite: 5 },            // acertos no Quiz da Ilha
};

// Progresso guardado: o segredo da cachoeira (uma vez descoberto, fica) e o melhor lugar na Corrida de Trenó.
const progresso = {
  'neve.cachoeira': (valor, atual) => (valor === true || atual === true ? true : undefined),
  'neve.treno': (valor, atual) => {
    const v = Number(valor);
    if (!Number.isInteger(v) || v < 1 || v > 4) return undefined;
    return Number.isInteger(atual) && atual >= 1 && atual < v ? atual : v;
  },
};

module.exports = { salas, minijogos, progresso, aoEmote: null };
