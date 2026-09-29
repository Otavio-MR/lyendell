// Catálogo de tudo que pode ser liberado para um cargo.
const CATALOGO = [
  { grupo: 'Administração', itens: [
    { chave: 'usuarios.ver', nome: 'Ver a lista de usuários' },
    { chave: 'usuarios.criar', nome: 'Criar usuários' },
    { chave: 'usuarios.editar', nome: 'Editar usuários, trocar senhas e conceder cargos' },
    { chave: 'usuarios.remover', nome: 'Remover usuários' },
    { chave: 'cargos.gerenciar', nome: 'Criar e editar cargos' },
    { chave: 'diario.ver', nome: 'Ver o diário do sistema (quem fez o quê)' },
  ] },
  { grupo: 'Tabelionato', itens: [
    { chave: 'tabelionato.ver', nome: 'Ver os livros e registros' },
    { chave: 'tabelionato.registrar', nome: 'Fazer novos registros (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'tabelionato.editar', nome: 'Editar registros' },
    { chave: 'tabelionato.apagar', nome: 'Apagar registros' },
    { chave: 'tabelionato.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'tabelionato.pagamentos', nome: 'Marcar pagamentos (ex.: de comerciantes) como pagos' },
    { chave: 'tabelionato.aprovar', nome: 'Aprovar ou recusar os registros enviados (ex.: pelo Escriba)' },
  ] },
  { grupo: 'Guarda do Coelho', itens: [
    { chave: 'guarda.ver', nome: 'Ver os livros e registros' },
    { chave: 'guarda.registrar', nome: 'Fazer novos registros, ex.: prisioneiros (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'guarda.editar', nome: 'Editar registros' },
    { chave: 'guarda.apagar', nome: 'Apagar registros' },
    { chave: 'guarda.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'guarda.aprovar', nome: 'Aprovar ou recusar os registros enviados (ex.: prisioneiros registrados por guardas)' },
  ] },
  { grupo: 'Galeria', itens: [
    { chave: 'galeria.ver', nome: 'Ver as fotos' },
    { chave: 'galeria.enviar', nome: 'Enviar fotos' },
    { chave: 'galeria.gerenciar', nome: 'Criar álbuns e apagar fotos de outros' },
  ] },
  { grupo: 'Mural de Anúncios', itens: [
    { chave: 'anuncios.ver', nome: 'Ler os anúncios' },
    { chave: 'anuncios.publicar', nome: 'Publicar anúncios' },
    { chave: 'anuncios.moderar', nome: 'Fixar, editar e apagar anúncios de outros' },
  ] },
  { grupo: 'Mural de Atividades', itens: [
    { chave: 'atividades.ver', nome: 'Ver as atividades' },
    { chave: 'atividades.participar', nome: 'Assumir tarefas e registrar entregas' },
    { chave: 'atividades.criar', nome: 'Criar atividades' },
    { chave: 'atividades.gerenciar', nome: 'Conferir entregas e gerenciar atividades de outros' },
  ] },
];

const TODAS = CATALOGO.flatMap(g => g.itens.map(i => i.chave));
const VALIDAS = new Set(TODAS);

// Todo usuário é morador: estas permissões valem para qualquer um.
const MORADOR = ['tabelionato.ver', 'guarda.ver', 'galeria.ver', 'anuncios.ver', 'atividades.ver', 'atividades.participar'];
// Quem está acima de morador publica anúncios, cria atividades e envia fotos.
const MEMBRO = ['anuncios.publicar', 'atividades.criar', 'galeria.enviar'];
const acoes = (modulo, ...lista) => lista.map(a => `${modulo}.${a}`);

// [descrições antigas, descrição atual]: as antigas são trocadas nos bancos que ainda não as mudaram.
const DESCRICOES = {
  'Tabeliã': [['Comanda o Tabelionato: registra, edita, apaga e configura os livros.', 'Comanda o Tabelionato: registra, edita, apaga, configura os livros e marca os pagamentos.'],
    'Comanda o Tabelionato: aprova os registros, edita, apaga, configura os livros e marca os pagamentos.'],
  Escriba: [['Faz novos registros no Tabelionato, mas não apaga.'],
    'Faz registros no Tabelionato, que vão para a aprovação da Tabeliã.'],
  'Comandante da Guarda': [['Comanda a Guarda do Coelho: registra, edita, apaga e configura os livros.'],
    'Comanda a Guarda do Coelho: aprova os registros, edita, apaga e configura os livros.'],
  Guarda: [['Vê os registros da Guarda e registra prisioneiros.'],
    'Vê os registros da Guarda e registra prisioneiros, que vão para a aprovação do Comandante.'],
};

const CARGOS_PADRAO = [
  { nome: 'Morador', base: 1, cor: '#9a9b74',
    descricao: 'Todos os usuários são moradores. Veem tudo e podem ajudar nas atividades.',
    permissoes: MORADOR },
  { nome: 'Família Nobre', cor: '#d8b13a',
    descricao: 'Pode tudo, menos adicionar novos usuários.',
    permissoes: TODAS.filter(p => p !== 'usuarios.criar' && p !== 'cargos.gerenciar') },
  { nome: 'Tabeliã', cor: '#c98b4a',
    descricao: DESCRICOES['Tabeliã'][1],
    permissoes: [...MEMBRO, ...acoes('tabelionato', 'registrar', 'editar', 'apagar', 'configurar', 'pagamentos', 'aprovar')] },
  { nome: 'Escriba', cor: '#b9a27a',
    descricao: DESCRICOES.Escriba[1],
    permissoes: [...MEMBRO, 'tabelionato.registrar'] },
  { nome: 'Comandante da Guarda', cor: '#c0553a',
    descricao: DESCRICOES['Comandante da Guarda'][1],
    permissoes: [...MEMBRO, ...acoes('guarda', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
  { nome: 'Guarda', cor: '#6f9a58',
    descricao: DESCRICOES.Guarda[1],
    permissoes: [...MEMBRO, 'guarda.registrar'] },
];

module.exports = { CATALOGO, TODAS, VALIDAS, CARGOS_PADRAO, DESCRICOES };
