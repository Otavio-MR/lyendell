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
    { chave: 'tabelionato.aprovar', nome: 'Aprovar ou recusar registros (exclusiva: só um cargo pode ter, a Tabeliã)' },
  ] },
  { grupo: 'Guarda do Coelho', itens: [
    { chave: 'guarda.ver', nome: 'Ver os livros e registros' },
    { chave: 'guarda.registrar', nome: 'Fazer novos registros, ex.: prisioneiros (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'guarda.editar', nome: 'Editar registros' },
    { chave: 'guarda.apagar', nome: 'Apagar registros' },
    { chave: 'guarda.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'guarda.aprovar', nome: 'Aprovar ou recusar registros (exclusiva: só um cargo pode ter, o Comandante)' },
  ] },
  { grupo: 'Hospital', itens: [
    { chave: 'hospital.ver', nome: 'Ver os livros e registros (pacientes e equipe)' },
    { chave: 'hospital.registrar', nome: 'Fazer novos registros, ex.: pacientes (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'hospital.editar', nome: 'Editar registros' },
    { chave: 'hospital.apagar', nome: 'Apagar registros' },
    { chave: 'hospital.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'hospital.aprovar', nome: 'Aprovar ou recusar registros (exclusiva: só um cargo pode ter, o Diretor do Hospital)' },
  ] },
  { grupo: 'Congresso', itens: [
    { chave: 'congresso.ver', nome: 'Ler as leis, PECs e mudanças votadas' },
    { chave: 'congresso.registrar', nome: 'Enviar leis e mudanças votadas (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'congresso.editar', nome: 'Editar o que foi publicado' },
    { chave: 'congresso.apagar', nome: 'Apagar o que foi publicado' },
    { chave: 'congresso.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'congresso.aprovar', nome: 'Publicar direto e aprovar o que outros enviam (exclusiva: só um cargo pode ter, a Senadora)' },
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
  { grupo: 'Recreação', itens: [
    { chave: 'recreacao.usar', nome: 'Usar o chat e os jogos' },
    { chave: 'recreacao.moderar', nome: 'Apagar mensagens de outros no chat' },
    { chave: 'recreacao.perguntas', nome: 'Criar e editar as perguntas do quiz' },
  ] },
  { grupo: 'Mapa', itens: [
    { chave: 'mapa.editar', nome: 'Colocar, mover e editar as casas do mapa (e quem mora em cada uma)' },
  ] },
  { grupo: 'Trilha sonora', itens: [
    { chave: 'trilha.gerenciar', nome: 'Adicionar e tirar músicas da trilha sonora' },
  ] },
];

const TODAS = CATALOGO.flatMap(g => g.itens.map(i => i.chave));
const VALIDAS = new Set(TODAS);

// Todo usuário é morador: estas permissões valem para qualquer um.
const MORADOR = ['tabelionato.ver', 'guarda.ver', 'congresso.ver', 'galeria.ver', 'anuncios.ver', 'atividades.ver', 'atividades.participar', 'recreacao.usar'];
// Quem está acima de morador publica anúncios, cria atividades e envia fotos.
const MEMBRO = ['anuncios.publicar', 'atividades.criar', 'galeria.enviar'];
const acoes = (modulo, ...lista) => lista.map(a => `${modulo}.${a}`);

// Módulos de livros: todos usam a mesma tela (livros com formulário, registros numerados e aprovação).
// O Hospital não é aberto a todos os moradores (prontuário de paciente); o resto é.
const MODULOS = { tabelionato: 'Tabelionato', guarda: 'Guarda do Coelho', hospital: 'Hospital', congresso: 'Congresso' };

// Aprovar registros é exclusivo de um único cargo em cada módulo (além do administrador principal).
// Nem a Família Nobre aprova: tudo passa pela Tabeliã, pelo Comandante, pelo Diretor do Hospital ou pela Senadora.
const EXCLUSIVAS = {
  'tabelionato.aprovar': 'Tabeliã', 'guarda.aprovar': 'Comandante da Guarda',
  'hospital.aprovar': 'Diretor do Hospital', 'congresso.aprovar': 'Senadora',
};

// [descrições antigas, descrição atual]: as antigas são trocadas nos bancos que ainda não as mudaram.
const DESCRICOES = {
  'Tabeliã': [['Comanda o Tabelionato: registra, edita, apaga e configura os livros.', 'Comanda o Tabelionato: registra, edita, apaga, configura os livros e marca os pagamentos.'],
    'Comanda o Tabelionato: aprova os registros, edita, apaga, configura os livros e marca os pagamentos.'],
  Escriba: [['Faz novos registros no Tabelionato, mas não apaga.'],
    'Faz registros no Tabelionato, que vão para a aprovação da Tabeliã.'],
  'Comandante da Guarda': [['Comanda a Guarda do Coelho: registra, edita, apaga e configura os livros.'],
    'Comanda a Guarda do Coelho: aprova os registros, edita, apaga e configura os livros.'],
  Guarda: [['Vê os registros da Guarda e registra prisioneiros.', 'Vê os registros da Guarda e registra prisioneiros, que vão para a aprovação do Comandante.'],
    'Vê todos os livros e registros da Guarda e registra em qualquer um deles; os registros vão para a aprovação do Comandante.'],
  'Família Nobre': [['Pode tudo, menos adicionar novos usuários.', 'Pode tudo, menos adicionar usuários e aprovar registros (isso é da Tabeliã e do Comandante).'],
    'Pode tudo, menos adicionar usuários e aprovar registros (isso é da Tabeliã, do Comandante, do Diretor do Hospital e da Senadora).'],
};

const CARGOS_PADRAO = [
  { nome: 'Morador', base: 1, cor: '#9a9b74',
    descricao: 'Todos os usuários são moradores. Veem tudo e podem ajudar nas atividades.',
    permissoes: MORADOR },
  { nome: 'Família Nobre', cor: '#d8b13a',
    descricao: DESCRICOES['Família Nobre'][1],
    permissoes: TODAS.filter(p => p !== 'usuarios.criar' && p !== 'cargos.gerenciar' && !EXCLUSIVAS[p]) },
  { nome: 'Tabeliã', cor: '#c98b4a',
    descricao: DESCRICOES['Tabeliã'][1],
    permissoes: [...MEMBRO, ...acoes('tabelionato', 'registrar', 'editar', 'apagar', 'configurar', 'pagamentos', 'aprovar'), 'mapa.editar'] },
  { nome: 'Escriba', cor: '#b9a27a',
    descricao: DESCRICOES.Escriba[1],
    permissoes: [...MEMBRO, 'tabelionato.registrar'] },
  { nome: 'Comandante da Guarda', cor: '#c0553a',
    descricao: DESCRICOES['Comandante da Guarda'][1],
    permissoes: [...MEMBRO, ...acoes('guarda', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
  { nome: 'Guarda', cor: '#6f9a58',
    descricao: DESCRICOES.Guarda[1],
    permissoes: [...MEMBRO, 'guarda.registrar'] },
  { nome: 'Diretor do Hospital', cor: '#4fa39b',
    descricao: 'Comanda o Hospital: aprova os registros de pacientes, edita, apaga e configura os livros.',
    permissoes: [...MEMBRO, ...acoes('hospital', 'ver', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
  { nome: 'Médico', cor: '#8cc5b6',
    descricao: 'Vê o Hospital e registra pacientes, que vão para a aprovação do Diretor do Hospital.',
    permissoes: [...MEMBRO, 'hospital.ver', 'hospital.registrar'] },
  { nome: 'Senadora', cor: '#7f93d8',
    descricao: 'Publica no Congresso as PECs, leis e regras votadas; aprova o que outros enviarem para lá.',
    permissoes: [...MEMBRO, ...acoes('congresso', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
];

module.exports = { CATALOGO, TODAS, VALIDAS, CARGOS_PADRAO, DESCRICOES, EXCLUSIVAS, MODULOS };
