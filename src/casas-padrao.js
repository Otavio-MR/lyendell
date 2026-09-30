// As primeiras casas do mapa: a lista da Avenida Santa Menefreda que o Evran mandou (2026-09-30).
// As posições foram calculadas por public/js/mapa-casas.js (distribuir), o mesmo cálculo de "Colar lista" no site.
// Entram uma vez só (veja semear em db.js); depois tudo é mexido pelo próprio mapa.

const CASAS_PADRAO = [
  { numero: '02', via: 'av4', lado: 'esquerda', x: 302, y: 125, situacao: 'ocupada', texto: 'Layla Weeslay' },
  { numero: '04', via: 'av4', lado: 'esquerda', x: 302, y: 165, situacao: 'ocupada', texto: 'Casa da Família Lombardi' },
  { numero: '06', via: 'av4', lado: 'esquerda', x: 302, y: 241, situacao: 'ocupada', texto: 'Casa da Família Velkaris' },
  { numero: '08', via: 'av4', lado: 'esquerda', x: 302, y: 281, situacao: 'sem_dono', texto: '' },
  { numero: '10', via: 'av4', lado: 'esquerda', x: 302, y: 321, situacao: 'comercio', texto: 'Bar sem dono' },
  { numero: '11', via: 'av4', lado: 'esquerda', x: 302, y: 359, situacao: 'sem_dono', texto: '' },
  { numero: '12', via: 'av4', lado: 'esquerda', x: 302, y: 399, situacao: 'ocupada', texto: 'Castaigne' },
  { numero: '14', via: 'av4', lado: 'esquerda', x: 302, y: 439, situacao: 'comercio', texto: 'Peixaria sem dono' },
  { numero: '15', via: 'av4', lado: 'esquerda', x: 302, y: 479, situacao: 'ocupada', texto: 'Nyx Hollow' },
  { numero: '01', via: 'av4', lado: 'direita', x: 348, y: 125, situacao: 'sem_dono', texto: '' },
  { numero: '03', via: 'av4', lado: 'direita', x: 348, y: 165, situacao: 'sem_dono', texto: '' },
  { numero: '05', via: 'av4', lado: 'direita', x: 348, y: 241, situacao: 'ocupada', texto: 'Noctis Caelum' },
  { numero: '07', via: 'av4', lado: 'direita', x: 348, y: 281, situacao: 'sem_dono', texto: '' },
  { numero: '08', via: 'av4', lado: 'direita', x: 348, y: 321, situacao: 'sem_dono', texto: '' },
  { numero: '09', via: 'av4', lado: 'direita', x: 348, y: 359, situacao: 'comercio', texto: 'Pousada Estrela Cadente' },
  { numero: '16', via: 'av4', lado: 'direita', x: 348, y: 399, situacao: 'ocupada', texto: 'Rudeus' },
  { numero: '17', via: 'av4', lado: 'direita', x: 348, y: 439, situacao: 'sem_dono', texto: '' },
  { numero: '18', via: 'av4', lado: 'direita', x: 348, y: 479, situacao: 'ocupada', texto: 'Jorge Montband' },
  { numero: '19', via: 'av4', lado: 'direita', x: 348, y: 519, situacao: 'sem_dono', texto: '' },
];

module.exports = { CASAS_PADRAO };
