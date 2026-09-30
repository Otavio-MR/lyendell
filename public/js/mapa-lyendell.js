// Dados do mapa de Lyendell, tirados da vista de cima do jogo (imagem de 1154 x 773).
// Todas as coordenadas estão nesse espaço: x para a direita, y para baixo, norte para cima.
// As vias foram alinhadas (só retas, cantos de 90° e diagonais de 45°), como numa planta da cidade.
// Para acrescentar algo (ex.: as casas), é só marcar o ponto na mesma imagem e anotar o x e o y.

export const VISTA = [0, 0, 1154, 773];

// Contorno das muralhas (a área da cidade).
export const CIDADE = [
  [205, 100], [250, 55], [980, 55], [1005, 80], [1022, 300], [1050, 360], [1085, 440], [1100, 560], [1100, 705],
  [1077, 728], [228, 728], [205, 705],
];

// O rio: passa ao norte da cidade e desce pelo leste até o sul.
export const RIO = [
  [30, -20], [110, 16], [250, 22], [420, 10], [590, 18], [700, 24], [800, 30], [880, 32], [952, 30], [1000, 46],
  [1038, 90], [1050, 180], [1062, 280], [1080, 360], [1115, 425], [1145, 490], [1168, 580], [1176, 660],
  [1150, 735], [1070, 762], [970, 772], [880, 800],
];

export const TORRES = [[227, 77], [662, 55], [698, 55], [992, 67], [1088, 716], [216, 716]];
export const PORTAO = { x: 680, y: 55 };
// Caminho do portão norte até a Avenida Nadir (sem nome).
export const CAMINHOS = [[[680, 55], [680, 120]]];

// n = número da legenda. pontos = o traçado; rotulo = o trecho reto onde o nome é escrito.
export const AVENIDAS = [
  { id: 'av1', n: 1, nome: 'Avenida Bandeirinhas',
    pontos: [[455, 672], [975, 672], [1005, 642], [1005, 410], [965, 370]], rotulo: [[777, 672], [923, 672]] },
  { id: 'av2', n: 2, nome: 'Avenida Nadir',
    pontos: [[680, 120], [680, 672]], rotulo: [[680, 215], [680, 316]] },
  { id: 'av3', n: 3, nome: 'Avenida Sarará',
    pontos: [[325, 558], [575, 558], [605, 528], [605, 478]], rotulo: [[330, 558], [452, 558]] },
  { id: 'av4', n: 4, nome: 'Avenida Santa Menefreda',
    pontos: [[495, 72], [350, 72], [325, 97], [325, 558]], rotulo: [[325, 280], [325, 500]] },
];

export const RUAS = [
  { id: 'r1', n: 1, nome: 'Rua Corvos', pontos: [[760, 515], [760, 672]], rotulo: [[760, 540], [760, 650]] },
  { id: 'r2', n: 2, nome: 'Rua Coelho', pontos: [[552, 558], [552, 620], [604, 672]], rotulo: [[552, 560], [552, 620]] },
  { id: 'r3', n: 3, nome: 'Rua Toca', pontos: [[455, 558], [455, 672]], rotulo: [[455, 570], [455, 660]] },
  { id: 'r4', n: 4, nome: 'Rua Floral', pontos: [[325, 212], [680, 212]], rotulo: [[480, 212], [670, 212]] },
  { id: 'r5', n: 5, nome: 'Rua Café com Leite', pontos: [[470, 135], [680, 135]], rotulo: [[480, 135], [670, 135]] },
  { id: 'r6', n: 6, nome: 'Rua Alecrim', pontos: [[470, 72], [470, 212]], rotulo: [[470, 138], [470, 210]] },
  { id: 'r7', n: 7, nome: 'Rua Resenha', pontos: [[680, 318], [830, 318]], rotulo: [[690, 318], [830, 318]] },
  { id: 'r8', n: 8, nome: 'Rua Bank', pontos: [[1005, 495], [940, 495], [940, 672]], rotulo: [[940, 500], [940, 665]] },
  { id: 'r9', n: 9, nome: 'Rua Raposo', pontos: [[390, 72], [390, 212]], rotulo: [[390, 76], [390, 208]] },
  { id: 'r10', n: 10, nome: 'Rua Gatuno', pontos: [[680, 410], [735, 410], [775, 370], [965, 370]], ramos: [[[852, 370], [852, 430]]],
    rotulo: [[855, 370], [962, 370]] },
];

// Prédios públicos: o selo fica em x, y (grande = prédio maior); linhas = o nome; sub = a linha pequena embaixo.
export const PREDIOS = [
  { id: 'septo', nome: 'Septo', tipo: 'Templo', icone: 'septo', x: 500, y: 372, grande: true },
  { id: 'coliseu', nome: 'Coliseu', tipo: 'Arena', icone: 'espada', x: 776, y: 200, grande: true },
  { id: 'toca', nome: 'Toca do Coelho', tipo: 'Castelo da Família Nobre Luckham', icone: 'castelo', x: 928, y: 200, grande: true,
    linhas: ['Toca do Coelho'], sub: 'Castelo Luckham' },
  { id: 'tabelionato', nome: 'Tabelionato', tipo: 'Prédio público, no Centro da cidade', icone: 'pergaminho', x: 736, y: 452,
    sub: 'Centro da cidade', centro: true },
  { id: 'banco', nome: 'Banco', tipo: 'Prédio público', icone: 'moeda', x: 330, y: 622 },
  { id: 'quartel', nome: 'Quartel General', tipo: 'Prédio público', icone: 'escudo', x: 1053, y: 610, linhas: ['Quartel', 'General'] },
];
