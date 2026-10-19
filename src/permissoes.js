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
    { chave: 'juramento.marcar', nome: 'Marcar quem já fez o Juramento da Casa Luckham (Família Nobre e Tabeliã)' },
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
    { chave: 'congresso.propor', nome: 'Mandar propostas do povo (leis, PECs, regras...) para a Senadora avaliar e apoiar as dos outros' },
    { chave: 'congresso.registrar', nome: 'Enviar leis e mudanças votadas (vão para aprovação, se a pessoa não aprova)' },
    { chave: 'congresso.editar', nome: 'Editar o que foi publicado' },
    { chave: 'congresso.apagar', nome: 'Apagar o que foi publicado' },
    { chave: 'congresso.configurar', nome: 'Criar livros, seções, campos e opções' },
    { chave: 'congresso.aprovar', nome: 'Publicar direto, aprovar o que outros enviam e avaliar as propostas do povo (exclusiva: só um cargo pode ter, a Senadora)' },
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
    { chave: 'sprites.editar', nome: 'Trocar os desenhos dos joguinhos pelos próprios sprites (imagens em tira de quadros)' },
    { chave: 'jogos.admin', nome: 'Menu de administrador nos jogos: pegadinhas, mexer na partida, ajudar jogadores e dar ou tirar cenouras (a partida deixa de valer para o ranking)' },
  ] },
  { grupo: 'Leis de Lyendell', itens: [
    { chave: 'leis.ver', nome: 'Ler as Leis de Lyendell' },
    { chave: 'leis.registrar', nome: 'Escrever leis (vão para aprovação, se a pessoa não publica direto)' },
    { chave: 'leis.editar', nome: 'Editar leis' },
    { chave: 'leis.apagar', nome: 'Apagar leis' },
    { chave: 'leis.configurar', nome: 'Criar livros de leis e regras, seções, campos e opções' },
    { chave: 'leis.aprovar', nome: 'Publicar leis direto e aprovar as enviadas (Lorde Comandante e Família Nobre)' },
  ] },
  { grupo: 'Mapa', itens: [
    { chave: 'mapa.editar', nome: 'Colocar, mover e editar as casas e os prédios do mapa (quem mora, fotos e informações)' },
  ] },
  { grupo: 'Trilha sonora', itens: [
    { chave: 'trilha.gerenciar', nome: 'Adicionar e tirar músicas da trilha sonora' },
  ] },
  { grupo: 'Bobo da Corte', itens: [
    { chave: 'bobo.pegadinhas', nome: 'Pregar peças no pessoal e contar piadas na praça (a Caixa de Pegadinhas, coisa do Bobo da Corte)' },
  ] },
  { grupo: 'Convidados e Aliados', itens: [
    { chave: 'aliados.ver', nome: 'Ver o que for marcado para Convidados e Aliados' },
  ] },
  { grupo: 'Gestão Financeira', itens: [
    { chave: 'financas.ver', nome: 'Ver a Gestão Financeira: tesouro, folhas de pagamento, profissões e pagamentos dos cidadãos' },
    { chave: 'financas.gerir', nome: 'Cadastrar profissões, vínculos, presenças, produção, valores e movimentações do tesouro (Mestre da Moeda)' },
    { chave: 'financas.aprovar', nome: 'Aprovar, rejeitar e pagar folhas de pagamento e estornar movimentações (Mestre da Moeda)' },
    { chave: 'financas.excecao', nome: 'Autorizar pagamento ou saída acima do saldo disponível do tesouro (sempre com justificativa)' },
  ] },
  { grupo: 'Escola Luckham', itens: [
    { chave: 'escola.ver', nome: 'Ver a Escola Luckham: as disciplinas, os professores titulares, as turmas e o calendário de aulas' },
    { chave: 'escola.alunos', nome: 'Ver os alunos, as matrículas, a frequência e os boletins' },
    { chave: 'escola.lecionar', nome: 'Fazer a chamada das aulas e lançar notas' },
    { chave: 'escola.gerir', nome: 'Matricular alunos, inscrever professores, criar disciplinas, turmas e aulas e configurar a escola (Diretor da Escola)' },
  ] },
  { grupo: 'Escala da Guarda', itens: [
    { chave: 'escala.ver', nome: 'Ver a agenda de turnos da Guarda do Coelho, as convocações e responder às suas (Guardas, Comandante e Família Nobre)' },
    { chave: 'escala.nomear', nome: 'Nomear e exonerar os Guardas (dar e tirar o cargo Guarda) no Quadro da Guarda (Lorde Comandante e General)' },
    { chave: 'escala.nomear_general', nome: 'Nomear e exonerar o General no Quadro da Guarda (só o Lorde Comandante)' },
    { chave: 'escala.gerir', nome: 'Marcar os turnos dos guardas, convocar a Guarda (no Discord), confirmar ou retirar presenças e ver o controle de quem mais trabalha (Comandante da Guarda)' },
  ] },
  { grupo: 'Nadir', itens: [
    { chave: 'nadir.usar', nome: 'Conversar com a Grande Nadir (ela só conta o que a pessoa já pode ver no site)' },
    { chave: 'nadir.ensinar', nome: 'Escrever no Livro de Nadir (o que ela sabe sobre o mundo, a Casa e as pessoas) e ver as perguntas feitas a ela' },
  ] },
];

const TODAS = CATALOGO.flatMap(g => g.itens.map(i => i.chave));

// Personagem criança: mesmo com cargo (até Família Nobre), só olha, brinca, conversa e ajuda nas atividades.
// Nada de registrar, editar, apagar, aprovar, publicar ou administrar (isso é coisa de gente grande).
// A parte dos Aliados (convidados de outras casas) também fica de fora.
const PERMITIDAS_CRIANCA = new Set([
  ...TODAS.filter(p => p.endsWith('.ver') && p !== 'usuarios.ver' && p !== 'diario.ver' && p !== 'aliados.ver' && p !== 'financas.ver' && p !== 'escola.ver' && p !== 'escala.ver'),
  'atividades.participar', 'recreacao.usar', 'bobo.pegadinhas', 'nadir.usar',
]);
// Coisas só do Bobo da Corte: nem a Família Nobre recebe junto com "tudo".
const SO_DO_BOBO = new Set(['bobo.pegadinhas']);
// Coisa só dos Aliados (convidados de outras casas): a Família Nobre já vê tudo e não precisa disso.
const SO_DOS_ALIADOS = new Set(['aliados.ver']);
// O dinheiro da Capital é do Mestre da Moeda: a Família Nobre acompanha (financas.ver), mas não mexe.
// Pagar acima do saldo (financas.excecao) não vem em cargo nenhum: o administrador concede em Cargos.
const SO_DA_MOEDA = new Set(['financas.gerir', 'financas.aprovar', 'financas.excecao']);
// O menu de administrador dos jogos não vem em cargo nenhum: o administrador tem e libera em Cargos se quiser.
const SO_DO_ADMIN = new Set(['jogos.admin']);
const VALIDAS = new Set(TODAS);

// Todo usuário é morador (menos quem tem um cargo que "não é morador", como os Aliados): estas permissões valem para eles.
const MORADOR = ['tabelionato.ver', 'guarda.ver', 'congresso.ver', 'congresso.propor', 'leis.ver', 'galeria.ver', 'anuncios.ver', 'atividades.ver', 'atividades.participar', 'recreacao.usar', 'nadir.usar', 'escola.ver'];
// Quem está acima de morador publica anúncios, cria atividades e envia fotos.
const MEMBRO = ['anuncios.publicar', 'atividades.criar', 'galeria.enviar'];
const acoes = (modulo, ...lista) => lista.map(a => `${modulo}.${a}`);

// Módulos de livros: todos usam a mesma tela (livros com formulário, registros numerados e aprovação).
// O Hospital não é aberto a todos os moradores (prontuário de paciente); o resto é.
const MODULOS = { tabelionato: 'Tabelionato', guarda: 'Guarda do Coelho', hospital: 'Hospital', congresso: 'Congresso', leis: 'Leis de Lyendell' };

// Aprovar registros é exclusivo de um único cargo em cada módulo (além do administrador principal); na Guarda, o Lorde
// Comandante e o General (o braço direito dele) têm o mesmo poder. O valor é um cargo ou uma lista de cargos.
// Nem a Família Nobre aprova: tudo passa pela Tabeliã, pelo Comandante, pelo Diretor do Hospital ou pela Senadora.
const EXCLUSIVAS = {
  'tabelionato.aprovar': 'Tabeliã', 'guarda.aprovar': ['Lorde Comandante', 'General'],
  // Quem nomeia: o Lorde Comandante nomeia o General e os Guardas; o General, braço direito dele, nomeia só os Guardas.
  'escala.nomear': ['Lorde Comandante', 'General'], 'escala.nomear_general': 'Lorde Comandante',
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
  General: [[], 'Braço direito do Lorde Comandante: vê e faz o mesmo que ele (aprova os registros da Guarda, marca a escala, convoca a Guarda e faz as Leis com a Família Nobre), mas quem decide quem é o General é o Lorde Comandante. O General nomeia os Guardas.'],
  Guarda: [['Vê os registros da Guarda e registra prisioneiros.', 'Vê os registros da Guarda e registra prisioneiros, que vão para a aprovação do Comandante.'],
    'Vê todos os livros e registros da Guarda e registra em qualquer um deles; os registros vão para a aprovação do Comandante.'],
  'Família Nobre': [['Pode tudo, menos adicionar novos usuários.', 'Pode tudo, menos adicionar usuários e aprovar registros (isso é da Tabeliã e do Comandante).',
    'Pode tudo, menos adicionar usuários e aprovar registros (isso é da Tabeliã, do Comandante, do Diretor do Hospital e da Senadora).',
    'Faz as Leis da Capital com o Lorde Comandante. Pode tudo, menos adicionar usuários e aprovar registros do Tabelionato, da Guarda, do Hospital e do Congresso (isso é da Tabeliã, do Comandante, do Diretor do Hospital e da Senadora).'],
  'Faz as Leis de Lyendell com o Lorde Comandante. Pode tudo, menos adicionar usuários e aprovar registros do Tabelionato, da Guarda, do Hospital e do Congresso (isso é da Tabeliã, do Comandante, do Diretor do Hospital e da Senadora).'],
  Senadora: [['Publica no Congresso as PECs, leis e regras votadas; aprova o que outros enviarem para lá.'],
    'Publica no Congresso as PECs, leis e regras votadas, aprova o que outros enviarem para lá e avalia as propostas do povo (as viáveis vão para a pauta).'],
  'Lorde Comandante': [['Faz as Leis da Capital junto com a Família Nobre: escreve, publica, edita e revoga.'],
    'Faz as Leis de Lyendell junto com a Família Nobre: escreve, publica, edita e revoga.'],
};
DESCRICOES['Lorde Comandante'] = [[...DESCRICOES['Lorde Comandante'][0], DESCRICOES['Lorde Comandante'][1]],
  'Comanda a Guarda do Coelho e faz as Leis de Lyendell junto com a Família Nobre. Aprova os registros da Guarda, marca a escala, convoca a Guarda e escolhe o General, seu braço direito.'];

const CARGOS_PADRAO = [
  { nome: 'Morador', base: 1, cor: '#9a9b74',
    descricao: 'Todos os usuários são moradores. Veem tudo e podem ajudar nas atividades.',
    permissoes: MORADOR },
  { nome: 'Família Nobre', cor: '#d8b13a',
    descricao: DESCRICOES['Família Nobre'][1],
    permissoes: TODAS.filter(p => p !== 'usuarios.criar' && p !== 'cargos.gerenciar' && !EXCLUSIVAS[p] && !SO_DO_BOBO.has(p) && !SO_DOS_ALIADOS.has(p) && !SO_DA_MOEDA.has(p) && !SO_DO_ADMIN.has(p)) },
  { nome: 'Tabeliã', cor: '#c98b4a',
    descricao: DESCRICOES['Tabeliã'][1],
    permissoes: [...MEMBRO, ...acoes('tabelionato', 'registrar', 'editar', 'apagar', 'configurar', 'pagamentos', 'aprovar'), 'mapa.editar', 'juramento.marcar'] },
  { nome: 'Escriba', cor: '#b9a27a',
    descricao: DESCRICOES.Escriba[1],
    permissoes: [...MEMBRO, 'tabelionato.registrar'] },
  // O General vê e faz tudo o que o Lorde Comandante vê e faz (Guarda, escala e Leis, aprovando registros também); só não escolhe o General.
  { nome: 'General', cor: '#c0553a',
    descricao: DESCRICOES.General[1],
    permissoes: [...MEMBRO, ...acoes('leis', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar'),
      ...acoes('guarda', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar'), 'escala.ver', 'escala.gerir', 'escala.nomear'] },
  { nome: 'Guarda', cor: '#6f9a58',
    descricao: DESCRICOES.Guarda[1],
    permissoes: [...MEMBRO, 'guarda.registrar', 'escala.ver'] },
  { nome: 'Diretor do Hospital', cor: '#4fa39b',
    descricao: 'Comanda o Hospital: aprova os registros de pacientes, edita, apaga e configura os livros.',
    permissoes: [...MEMBRO, ...acoes('hospital', 'ver', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
  { nome: 'Médico', cor: '#8cc5b6',
    descricao: 'Vê o Hospital e registra pacientes, que vão para a aprovação do Diretor do Hospital.',
    permissoes: [...MEMBRO, 'hospital.ver', 'hospital.registrar'] },
  { nome: 'Lorde Comandante', cor: '#b5563f',
    descricao: DESCRICOES['Lorde Comandante'][1],
    permissoes: [...MEMBRO, ...acoes('leis', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar'),
      ...acoes('guarda', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar'), 'escala.ver', 'escala.gerir', 'escala.nomear', 'escala.nomear_general'] },
  { nome: 'Senadora', cor: '#7f93d8',
    descricao: DESCRICOES.Senadora[1],
    permissoes: [...MEMBRO, ...acoes('congresso', 'registrar', 'editar', 'apagar', 'configurar', 'aprovar')] },
  { nome: 'Bobo da Corte', cor: '#c46bd8',
    descricao: 'Alegra Lyendell: tem a Caixa de Pegadinhas (torta na cara, almofada de pum, nariz de palhaço...) e conta piadas na praça.',
    permissoes: [...MEMBRO, 'bobo.pegadinhas'] },
  { nome: 'Game Dev', cor: '#4fc1b8',
    descricao: 'Cuida do visual dos joguinhos: troca os desenhos pelos próprios sprites em Recreação > Sprites dos jogos, e a troca vale para todo mundo.',
    permissoes: [...MEMBRO, 'sprites.editar'] },
  // Convidados e aliados de outras casas: "exclui_base" faz quem tem este cargo NÃO ser morador
  // (não recebe as permissões do Morador). Só veem o que for marcado para Convidados e Aliados.
  { nome: 'Aliados', cor: '#5aa0d8', exclui_base: true,
    descricao: 'Convidados e aliados de outras casas. Não são moradores: veem a cidade (mapa, anúncios, Congresso, Juramento, Leis, Galeria e Comunidade), jogam e conversam na Recreação e no Club Coelho, mas não publicam nem editam nada. Os livros do Tabelionato, da Guarda e do Hospital e as atividades, só os marcados para Convidados e Aliados.',
    permissoes: ['aliados.ver', 'anuncios.ver', 'congresso.ver', 'leis.ver', 'galeria.ver', 'recreacao.usar'] },
  { nome: 'Mestre da Moeda', cor: '#c9a227',
    descricao: 'Cuida do tesouro da Capital: profissões e salários, presenças, produção entregue, folhas de pagamento e movimentações em Lírios.',
    permissoes: [...MEMBRO, 'financas.ver', 'financas.gerir', 'financas.aprovar'] },
  { nome: 'Diretor da Escola', cor: '#6aa6d8',
    descricao: 'Dirige a Escola Luckham: inscreve e matricula alunos, inscreve e escolhe os professores, cria disciplinas, turmas e aulas, faz a chamada, lança notas e cuida de tudo na escola.',
    permissoes: [...MEMBRO, 'escola.ver', 'escola.alunos', 'escola.lecionar', 'escola.gerir'] },
  { nome: 'Professor da Escola', cor: '#8fb86a',
    descricao: 'Dá aulas na Escola Luckham: vê os alunos, faz a chamada das aulas e lança as notas.',
    permissoes: ['escola.ver', 'escola.alunos', 'escola.lecionar'] },
];

module.exports = { CATALOGO, TODAS, VALIDAS, PERMITIDAS_CRIANCA, CARGOS_PADRAO, DESCRICOES, EXCLUSIVAS, MODULOS, SO_DO_BOBO, SO_DOS_ALIADOS, SO_DA_MOEDA };
