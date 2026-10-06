// As regiões da Ilha do Club Coelho no servidor. Cada arquivo exporta:
//   salas:     { id: { nome, chao: [x0, y0, x1, y1], chegada: { padrao: [x, y], <de onde veio>: [x, y] } } }
//   minijogos: { id: { max, cenouras: pontos => n, limite } }   (a recompensa em cenouras, como em rotas/clube.js)
//   progresso: { chave: (valor, atual) => valorGuardado | undefined }   (undefined recusa; ex.: a faixa do ninja)
//   aoEmote:   ({ sala, e, id, pessoas, paraSala }) => void   (opcional: eventos da sala, ex.: virar o iceberg)
const REGIOES = ['centro', 'neve', 'litoral', 'segredos'].map(r => require(`./${r}`));

module.exports = {
  salas: Object.assign({}, ...REGIOES.map(r => r.salas || {})),
  minijogos: Object.assign({}, ...REGIOES.map(r => r.minijogos || {})),
  progresso: Object.assign({}, ...REGIOES.map(r => r.progresso || {})),
  aoEmote(dados) { for (const r of REGIOES) { try { r.aoEmote?.(dados); } catch (e) { console.error('Ilha (emote):', e.message); } } },
};
