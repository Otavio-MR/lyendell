// Os prédios que já vêm no mapa de Lyendell (posições na vista de cima do jogo, imagem de 1154 x 773).
// Entram uma vez só (veja semear em db.js); depois tudo é mexido pelo próprio mapa: ícone, nome,
// fotos, quem mora e quem trabalha, e para que serve.
// O Senado fica entre a Rua Corvos e a Rua Bank, como na imagem que o Evran mandou (2026-09-30).

const PREDIOS_PADRAO = [
  { nome: 'Septo', tipo: 'Templo', categoria: 'publico', icone: 'septo', tamanho: 'grande', x: 500, y: 372,
    funcao: 'O templo da capital.' },
  { nome: 'Coliseu', tipo: 'Arena', categoria: 'publico', icone: 'espada', tamanho: 'grande', x: 776, y: 200,
    funcao: 'A arena da capital.' },
  { nome: 'Toca do Coelho', tipo: 'Castelo da Família Nobre Luckham', categoria: 'publico', icone: 'castelo', tamanho: 'grande',
    x: 928, y: 200, sub: 'Castelo Luckham', funcao: 'O castelo da Família Nobre Luckham.' },
  { nome: 'Tabelionato', tipo: 'Prédio público, no Centro da cidade', categoria: 'publico', icone: 'pergaminho', tamanho: 'medio',
    x: 736, y: 452, sub: 'Centro da cidade', centro: 1, pagina: '/tabelionato',
    funcao: 'Onde ficam os registros oficiais da cidade: moradores, nobres, comércios, casamentos e propriedades.' },
  { nome: 'Banco', tipo: 'Prédio público', categoria: 'publico', icone: 'moeda', tamanho: 'medio', x: 330, y: 622 },
  { nome: 'Quartel General', tipo: 'Prédio público', categoria: 'publico', icone: 'escudo', tamanho: 'medio', x: 1053, y: 610,
    pagina: '/guarda', funcao: 'A sede da Guarda do Coelho.' },
  { nome: 'Senado', tipo: 'Prédio público', categoria: 'publico', icone: 'coluna', tamanho: 'medio', x: 850, y: 585,
    pagina: '/congresso', funcao: 'Onde o Congresso se reúne e vota as PECs, leis e regras da capital.' },
];

module.exports = { PREDIOS_PADRAO };
