// Dados do mapa de Lyendell, tirados da vista de cima do jogo (imagem de 1154 x 773).
// Todas as coordenadas estão nesse espaço: x para a direita, y para baixo, norte para cima.
// Para acrescentar algo (ex.: as casas), é só marcar o ponto na mesma imagem e anotar o x e o y.

export const VISTA = [0, 0, 1154, 773];

// Área construída da cidade (dentro das muralhas).
export const CIDADE = [
  [212, 108], [262, 72], [360, 52], [500, 48], [640, 50], [700, 52], [760, 92], [900, 96], [972, 90],
  [1004, 150], [1024, 262], [1046, 352], [1084, 440], [1106, 540], [1122, 650], [1094, 712], [1040, 728],
  [960, 736], [900, 780], [440, 780], [424, 716], [398, 702], [236, 702], [214, 606], [202, 500], [200, 300],
];

// O rio: entra pelo alto, à esquerda, passa ao norte da cidade e desce pelo leste até o sul.
export const RIO = [
  [30, -20], [110, 20], [250, 30], [420, 14], [590, 26], [700, 36], [800, 58], [880, 80], [952, 72],
  [990, 112], [1006, 192], [1024, 272], [1050, 350], [1090, 420], [1132, 490], [1162, 580], [1172, 660],
  [1146, 728], [1070, 756], [970, 768], [880, 800],
];

// Muralhas: o contorno da cidade, com torres nos cantos e o portão ao norte (com a ponte sobre o rio).
export const TORRES = [[228, 96], [654, 52], [728, 54], [972, 88], [1100, 560], [1100, 700], [228, 690]];
export const PONTE = { x: 691, y: 50, largura: 26, ate: -4 };

// n = número da legenda que você mandou. Os pontos seguem o traço desenhado na imagem.
export const AVENIDAS = [
  { id: 'av1', n: 1, nome: 'Avenida Bandeirinhas', rotulo: 0.36, pontos: [
    [452, 663], [500, 668], [550, 678], [600, 683], [654, 685], [704, 679], [754, 673], [804, 670], [854, 668],
    [904, 665], [954, 662], [989, 652], [1006, 632], [1011, 600], [1008, 562], [998, 522], [984, 478],
    [968, 430], [955, 400], [946, 386]] },
  { id: 'av2', n: 2, nome: 'Avenida Nadir', rotulo: 0.36, pontos: [
    [646, 135], [643, 175], [648, 210], [659, 245], [672, 285], [683, 330], [690, 365], [697, 410], [702, 455],
    [705, 503], [700, 553], [693, 603], [690, 640], [691, 675]] },
  { id: 'av3', n: 3, nome: 'Avenida Sarará', rotulo: 0.42, pontos: [
    [333, 538], [355, 551], [400, 557], [450, 560], [500, 562], [550, 558], [578, 548], [598, 525], [610, 500], [615, 478]] },
  { id: 'av4', n: 4, nome: 'Avenida Santa Menefreda', rotulo: 0.55, pontos: [
    [495, 74], [450, 71], [410, 69], [385, 70], [368, 80], [355, 100], [345, 125], [337, 160], [331, 200],
    [328, 250], [324, 300], [321, 350], [321, 400], [321, 450], [319, 485], [314, 500]] },
];

export const RUAS = [
  { id: 'r1', n: 1, nome: 'Rua Corvos', pontos: [[740, 514], [750, 545], [764, 595], [780, 655]] },
  { id: 'r2', n: 2, nome: 'Rua Coelho', pontos: [[550, 573], [553, 598], [567, 628], [585, 646], [602, 657]] },
  { id: 'r3', n: 3, nome: 'Rua Toca', pontos: [[452, 577], [455, 615], [457, 655]] },
  { id: 'r4', n: 4, nome: 'Rua Floral', pontos: [[355, 229], [400, 220], [440, 211], [480, 205], [550, 201], [630, 199]] },
  { id: 'r5', n: 5, nome: 'Rua Café com Leite', pontos: [[491, 130], [555, 133], [617, 137]] },
  { id: 'r6', n: 6, nome: 'Rua Alecrim', pontos: [[469, 90], [474, 125], [473, 160], [469, 200]] },
  { id: 'r7', n: 7, nome: 'Rua Resenha', pontos: [[704, 316], [760, 316], [812, 317], [824, 326]] },
  { id: 'r8', n: 8, nome: 'Rua Bank', pontos: [[966, 493], [950, 495], [939, 505], [938, 555], [941, 613]] },
  { id: 'r9', n: 9, nome: 'Rua Raposo', pontos: [[395, 89], [387, 115], [382, 150], [385, 182], [392, 210]] },
  { id: 'r10', n: 10, nome: 'Rua Gatuno', pontos: [[731, 413], [754, 397], [779, 383], [814, 374], [849, 372], [874, 365], [936, 360]],
    ramos: [[[851, 374], [854, 400], [856, 428]]] },
];

// Prédios públicos. x e y: onde fica o ícone; rotulo: onde vai o nome (linhas separadas por |).
export const PREDIOS = [
  { id: 'septo', nome: 'Septo', tipo: 'Templo', icone: 'septo', x: 506, y: 358, rotulo: [506, 396] },
  { id: 'coliseu', nome: 'Coliseu', tipo: 'Arena', icone: 'espada', x: 781, y: 186, rotulo: [781, 224] },
  { id: 'toca', nome: 'Toca do Coelho', tipo: 'Prédio público', icone: 'coelho', x: 934, y: 176, rotulo: [934, 212], linhas: ['Toca do', 'Coelho'] },
  { id: 'tabelionato', nome: 'Tabelionato', tipo: 'Prédio público, no Centro da cidade', icone: 'pergaminho', x: 746, y: 466, rotulo: [688, 470], ancora: 'end' },
  { id: 'banco', nome: 'Banco', tipo: 'Prédio público', icone: 'moeda', x: 315, y: 624, rotulo: [315, 662] },
  { id: 'quartel', nome: 'Quartel General', tipo: 'Prédio público', icone: 'escudo', x: 1079, y: 626, rotulo: [1079, 662], linhas: ['Quartel', 'General'] },
];

// O Centro da cidade (a cruz roxa da sua imagem), no Tabelionato.
export const CENTRO = { x: 718, y: 468 };
