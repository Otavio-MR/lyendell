// O site visto por um personagem criança: os lugares ganham nomes de criança, as explicações viram
// o que uma criança acharia daquilo, e as coisas de gente grande ficam "altas demais".
// Aqui só ficam os textos (sem tela); quem usa é o core.js (cabeçalhos), o menu e algumas telas.

// Itens do menu, pela rota.
export const MENU_CRIANCA = {
  '/': 'Minha toca',
  '/comunidade': 'Todo mundo',
  '/mapa': 'O mapa do tesouro',
  '/anuncios': 'Os bilhetes dos grandes',
  '/congresso': 'A casa do falatório',
  '/juramento': 'A promessa da bandeira',
  '/leis': 'As regras dos grandes',
  '/atividades': 'Ajudar os grandes',
  '/galeria': 'As figurinhas',
  '/recreacao': 'Hora de brincar!',
  '/clube': 'O clube dos coelhos',
  '/bobo': 'Minhas travessuras',
  '/tabelionato': 'A casa dos livros gigantes',
  '/guarda': 'Os soldados de armadura',
  '/hospital': 'Onde cuidam dos dodóis',
};
export const SECOES_CRIANCA = { Cidade: 'Meus lugares', Registros: 'Coisas dos grandes', 'Administração': 'Coisas dos grandes' };

// Títulos das telas: o nome de criança e o que ela pensa do lugar.
const TITULOS = {
  'Comunidade': ['Todo mundo', 'Todas as pessoas da cidade. Algumas são minhas amigas, outras são só grandes mesmo.'],
  'Mapa de Lyendell': ['O mapa do tesouro', 'A cidade inteirinha vista lá de cima, como se eu fosse um passarinho! Clique nos lugares para descobrir o que tem lá.'],
  'Mural de Anúncios': ['Os bilhetes dos grandes', 'Papéis pregados no mural. Os grandes leem e fazem cara séria.'],
  'Congresso': ['A casa do falatório', 'Os grandes entram lá, falam, falam, falam... e depois escrevem tudo aqui.'],
  'Leis de Lyendell': ['As regras dos grandes', 'Tudo o que não pode fazer na cidade. Tem palavra tão difícil que nem dá para ler!'],
  'Mural de Atividades': ['Ajudar os grandes', 'Os grandes precisam de um monte de coisas. Se eu ajudar, fico forte que nem um soldado!'],
  'Galeria': ['As figurinhas', 'Os desenhos e retratos da cidade. Dá para olhar um montão!'],
  'Recreação': ['Hora de brincar!', 'Jogos, conversa e bagunça. O melhor lugar da cidade!'],
  'Club Coelho': ['O clube dos coelhos', 'Meu coelho passeia, dança, pesca e tem uma toca só minha para enfeitar!'],
  'Juramento da Casa Luckham': ['A promessa da bandeira', 'As palavras que os grandes falam na frente da bandeira para morar na cidade. Eu já sei quase todas de cor!'],
  'Propostas do povo': ['Os pedidos dos grandes', 'Os grandes escrevem pedidos de regras novas, e a Senadora escolhe quais vão para a casa do falatório. Eu ainda não posso pedir nada...'],
  'Caixa de Pegadinhas': ['Minhas travessuras', 'Hihi! Aqui eu guardo as brincadeiras para fazer com os grandes. Shhh, é segredo!'],
  'Tabelionato': ['A casa dos livros gigantes', 'Livros enormes onde os grandes escrevem o nome de todo mundo. Dá para olhar, mas não pode rabiscar!'],
  'Guarda do Coelho': ['Os soldados de armadura', 'Eles cuidam da cidade e levam para a torre quem fez arte demais.'],
  'Hospital': ['Onde cuidam dos dodóis', 'Quem se machuca vem aqui e sai cheio de curativo.'],
  'Meu perfil': ['Eu!', 'Do jeitinho que eu gosto.'],
  'Lyendell Dorme': ['Lyendell Dorme', 'A brincadeira dos Raposos: de noite eles pegam alguém, de dia todo mundo tenta adivinhar quem são. Dá um friozinho na barriga!'],
};

// Os livros que já vêm no site (os novos ficam com o nome que tiverem).
const LIVROS = {
  'Registro de Moradores': 'O livrão de quem mora aqui',
  'Registro de Nobres': 'O livro das pessoas de coroa',
  'Registro de Outros': 'O livro dos outros',
  'Registro de Comerciantes': 'O livro das lojinhas',
  'Documentos Importantes': 'Os papéis importantes (não pode amassar!)',
  'Registro de Casamentos': 'O livro dos casamentos (eca, beijo!)',
  'Registro de Propriedades': 'O livro de quem é dono de quê',
  'Registro de Prisioneiros': 'Quem está de castigo na torre',
  'Guardas da Capital': 'Os soldados da cidade',
  'Procurados': 'Os fujões procurados',
  'Registro de Pacientes': 'Quem está dodói',
  'Equipe do Hospital': 'Os curandeiros',
  'Leis e Mudanças': 'O que os grandes votaram',
  'Leis de Lyendell': 'As regras dos grandes',
};

export const nomeInfantil = nome => LIVROS[nome] || nome;

// { titulo, sub } do jeito de criança, ou null se o título não muda.
export function tituloInfantil(titulo) {
  if (TITULOS[titulo]) return { titulo: TITULOS[titulo][0], sub: TITULOS[titulo][1] };
  if (LIVROS[titulo]) return { titulo: LIVROS[titulo], sub: null };
  return null;
}

// O que a criança acha de cada lugar do mapa (pelo nome do prédio; senão, pela categoria).
const PREDIOS = {
  'Septo': 'Tem velas por todo lado e todo mundo fala baixinho. Não pode correr lá dentro!',
  'Coliseu': 'Onde os grandes lutam de espada. Um dia eu vou lutar lá também!',
  'Toca do Coelho': 'O castelo da Família Luckham. É o lugar mais bonito da cidade inteira!',
  'Tabelionato': 'A casa dos livros gigantes. Escrevem o nome de todo mundo lá dentro.',
  'Banco': 'Onde guardam as moedinhas. Será que dá para pegar uma?',
  'Quartel General': 'A casa dos soldados. Eles treinam o dia inteiro e gritam "um, dois, um, dois"!',
  'Senado': 'Os grandes entram aí e falam tanto que dá sono.',
};
const CATEGORIAS = {
  publico: 'Um lugar importante dos grandes. Tem que entrar de mão dada.',
  comercio: 'Uma lojinha! Será que vende doce?',
  outro: 'Um lugar misterioso... o que será que tem lá?',
};
export const opiniaoDoLugar = p => PREDIOS[p.nome] || CATEGORIAS[p.categoria] || CATEGORIAS.outro;

// O coelho da Casa fala com a criança na tela de início (uma frase por dia).
const FALAS = [
  'Hoje é um ótimo dia para brincar!',
  'Psiu... dizem que tem um tesouro escondido em algum lugar do mapa.',
  'Os grandes estão ocupados de novo. Vamos brincar?',
  'Se você ajudar os grandes, fica forte que nem um soldado!',
  'Já foi ver as figurinhas novas?',
  'Cuidado com as raposas! Elas adoram pegar coelhos desprevenidos.',
  'Sabia que eu consigo pular mais alto que a cerca da horta?',
];
const CURIOSIDADES = [
  'Os coelhos conseguem ver quase tudo em volta sem virar a cabeça!',
  'Quando um coelho está feliz, ele dá um pulinho torto no ar.',
  'Os dentes dos coelhos nunca param de crescer. Por isso eles roem tanto!',
  'As raposas caçam de noite. É por isso que a cidade dorme com a porta trancada.',
  'Um coelho bebê se chama láparo.',
  'Os coelhos conversam batendo a patinha no chão: tum, tum!',
  'Cenoura é gostosa, mas coelho gosta mesmo é de folhinha verde.',
];
const doDia = lista => lista[Math.floor(Date.now() / 864e5) % lista.length];
export const falaDoDia = () => doDia(FALAS);
export const curiosidadeDoDia = () => doDia(CURIOSIDADES);
