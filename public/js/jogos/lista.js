// Os jogos de fliperama (public/js/arcade.js). Cada um só é baixado quando alguém abre ou assiste.
export const ARCADE = {
  barris: {
    nome: 'Barris do Raposo', icone: 'barril', rota: '#/recreacao/barris', unidade: 'Pontos',
    texto: 'O Raposo joga barris do alto da torre: suba as escadas, pule os barris e salve a Princesa Cenoura.',
    carregar: () => import('./barris.js'),
  },
  supercoelho: {
    nome: 'Super Coelho', icone: 'cenoura', rota: '#/recreacao/super-coelho', unidade: 'Pontos',
    texto: 'Corra, pule e pise nas raposinhas por quatro fases até o castelo do Raposo para salvar a Princesa Cenoura.',
    carregar: () => import('./super-coelho.js'),
  },
  travessia: {
    nome: 'Travessia', icone: 'estrada', rota: '#/recreacao/travessia', unidade: 'Fileiras',
    texto: 'Pule pelas estradas, rios e trilhos sem ser atropelado. Até onde o coelho chega?',
    carregar: () => import('./travessia.js'),
  },
};
