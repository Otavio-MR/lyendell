// Livros que já vêm prontos na primeira vez que o sistema roda.
// Depois disso, a Tabeliã e o Comandante mudam tudo pelo próprio site.
const obs = { id: 'obs', nome: 'Observações', tipo: 'texto_longo' };
const AJUDA_ABERTURA = 'Os pagamentos contam a partir desta data.';

// Prisioneiros: a pena é calculada entre a data da prisão e a soltura prevista.
const CAMPOS_PENA = [
  { id: 'soltura', nome: 'Data prevista de soltura', tipo: 'data', ajuda: 'Deixe em branco se não houver data prevista.' },
  { id: 'duracao', nome: 'Pena', tipo: 'duracao', inicio: 'data', fim: 'soltura', destaque: true },
  { id: 'multa', nome: 'Multa', tipo: 'texto', ajuda: 'Opcional. Ex.: 20 Lírios.' },
];
// "@Nome do livro" vira o id do livro quando os livros são criados.
const CAMPO_GUARDAS = { id: 'guarda', nome: 'Guardas responsáveis', tipo: 'referencia', multiplo: true };

// Campos das fichas no modelo dos livros .book da Casa (Moradores e Nobres têm os mesmos).
// "sinonimos" servem para achar o campo mesmo que o nome no formulário seja um pouco diferente.
const CAMPOS_FICHA = {
  nome: { nome: 'Nome', sinonimos: ['nome', 'nome do personagem', 'nome completo'] },
  // No RP ninguém fala "nickname": o nick do jogador é o "Endereço" da pessoa (a rua e o número são a Residência).
  nickname: { nome: 'Endereço', sinonimos: ['nickname', 'nick', 'nick do minecraft'], ajuda: 'O nick do jogador no Minecraft (no RP, o endereço da pessoa).' },
  idade: { nome: 'Idade', sinonimos: ['idade'] },
  cargo: { nome: 'Cargo', sinonimos: ['cargo'] },
  residencia: { nome: 'Residência', sinonimos: ['residencia', 'endereco', 'moradia'] },
  estado_civil: { nome: 'Estado civil', sinonimos: ['estado civil'] },
  profissao: { nome: 'Profissão', sinonimos: ['profissao', 'oficio'] },
};
const FICHAS = {
  'registro de moradores': ['nome', 'nickname', 'idade', 'cargo', 'residencia', 'estado_civil', 'profissao'],
  'registro de nobres': ['nome', 'nickname', 'idade', 'cargo', 'residencia', 'estado_civil', 'profissao'],
};
const NICKNAME = { id: 'nickname', nome: CAMPOS_FICHA.nickname.nome, tipo: 'texto', ajuda: CAMPOS_FICHA.nickname.ajuda };
const FICHA_PESSOA = [
  NICKNAME,
  { id: 'idade', nome: 'Idade', tipo: 'texto' },
  { id: 'cargo', nome: 'Cargo', tipo: 'texto' },
];

const LIVROS_PADRAO = [
  {
    modulo: 'tabelionato', nome: 'Registro de Moradores', icone: 'casa', aberto: 1,
    descricao: 'Todos os cidadãos que vivem em Lyendell.',
    campos: [
      { id: 'nome', nome: 'Nome do personagem', tipo: 'texto', obrigatorio: true, destaque: true },
      ...FICHA_PESSOA,
      { id: 'residencia', nome: 'Residência', tipo: 'texto', destaque: true, ajuda: 'Casa ou endereço na capital' },
      { id: 'estado_civil', nome: 'Estado civil', tipo: 'texto' },
      { id: 'profissao', nome: 'Profissão', tipo: 'texto', destaque: true },
      { id: 'chegada', nome: 'Data de chegada', tipo: 'data' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Ativo', 'Viajando', 'Inativo', 'Exilado', 'Falecido'] },
      { id: 'retrato', nome: 'Retrato', tipo: 'imagem' },
      obs,
    ],
  },
  {
    modulo: 'tabelionato', nome: 'Registro de Nobres', icone: 'coroa', aberto: 1,
    descricao: 'Títulos, casas e domínios da nobreza.',
    campos: [
      { id: 'nome', nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true },
      ...FICHA_PESSOA,
      { id: 'residencia', nome: 'Residência', tipo: 'texto' },
      { id: 'estado_civil', nome: 'Estado civil', tipo: 'texto' },
      { id: 'profissao', nome: 'Profissão', tipo: 'texto' },
      { id: 'titulo', nome: 'Título', tipo: 'selecao', destaque: true, opcoes: ['Rei', 'Rainha', 'Príncipe', 'Princesa', 'Duque', 'Duquesa', 'Marquês', 'Marquesa', 'Conde', 'Condessa', 'Visconde', 'Viscondessa', 'Barão', 'Baronesa', 'Cavaleiro', 'Dama'] },
      { id: 'casa', nome: 'Casa', tipo: 'texto', destaque: true },
      { id: 'dominios', nome: 'Terras e domínios', tipo: 'texto' },
      { id: 'nomeacao', nome: 'Data de nomeação', tipo: 'data' },
      { id: 'brasao', nome: 'Brasão', tipo: 'imagem' },
      obs,
    ],
  },
  {
    modulo: 'tabelionato', nome: 'Registro de Outros', icone: 'usuarios', aberto: 1,
    descricao: 'Gente de outras famílias que vive ou passa por Lyendell.',
    campos: [
      { ...NICKNAME, obrigatorio: true, destaque: true },
      { id: 'idade', nome: 'Idade', tipo: 'texto' },
      { id: 'genero', nome: 'Gênero', tipo: 'texto' },
      { id: 'estado_civil', nome: 'Estado civil', tipo: 'texto' },
      { id: 'endereco', nome: 'Residência', tipo: 'texto', destaque: true, ajuda: 'A rua e o número onde a pessoa mora.' },
      { id: 'familia', nome: 'A qual família pertence', tipo: 'texto', destaque: true },
      { id: 'cargo_familia', nome: 'Cargo na família', tipo: 'texto', destaque: true },
    ],
  },
  {
    modulo: 'tabelionato', nome: 'Registro de Comerciantes', icone: 'loja', aberto: 1,
    descricao: 'Estabelecimentos e licenças de comércio da capital.',
    campos: [
      { id: 'nome', nome: 'Comerciante', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'estabelecimento', nome: 'Estabelecimento', tipo: 'texto', destaque: true },
      { id: 'ramo', nome: 'Ramo', tipo: 'selecao', destaque: true, opcoes: ['Ferraria', 'Padaria', 'Açougue', 'Alfaiataria', 'Taverna', 'Mercearia', 'Carpintaria', 'Alquimia', 'Joalheria', 'Estábulo', 'Outro'] },
      { id: 'localizacao', nome: 'Localização', tipo: 'texto' },
      { id: 'licenca', nome: 'Licença', tipo: 'selecao', destaque: true, opcoes: ['Ativa', 'Suspensa', 'Cassada'] },
      { id: 'abertura', nome: 'Data de abertura', tipo: 'data', obrigatorio: true, ajuda: AJUDA_ABERTURA },
      obs,
    ],
    cobranca: { ativo: true, campo: 'abertura', intervalo: 14 },
  },
  {
    modulo: 'tabelionato', nome: 'Documentos Importantes', icone: 'documento', aberto: 1,
    descricao: 'Decretos, leis, contratos, escrituras e tratados.',
    campos: [
      { id: 'titulo', nome: 'Título', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'tipo', nome: 'Tipo', tipo: 'selecao', destaque: true, opcoes: ['Decreto', 'Lei', 'Contrato', 'Escritura', 'Tratado', 'Testamento', 'Carta', 'Ata', 'Outro'] },
      { id: 'data', nome: 'Data', tipo: 'data', destaque: true },
      { id: 'assinado', nome: 'Assinado por', tipo: 'texto' },
      { id: 'conteudo', nome: 'Conteúdo', tipo: 'texto_longo', obrigatorio: true },
      { id: 'anexo', nome: 'Imagem do documento', tipo: 'imagem' },
    ],
  },
  {
    modulo: 'tabelionato', nome: 'Registro de Casamentos', icone: 'alianca', aberto: 1,
    descricao: 'Uniões celebradas em Lyendell.',
    campos: [
      { id: 'conjuge1', nome: 'Primeiro cônjuge', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'conjuge2', nome: 'Segundo cônjuge', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'data', nome: 'Data da cerimônia', tipo: 'data', destaque: true },
      { id: 'local', nome: 'Local', tipo: 'texto' },
      { id: 'celebrante', nome: 'Celebrante', tipo: 'texto' },
      { id: 'testemunhas', nome: 'Testemunhas', tipo: 'texto_longo' },
      obs,
    ],
  },
  {
    modulo: 'tabelionato', nome: 'Registro de Propriedades', icone: 'chave', aberto: 1,
    descricao: 'Casas, terrenos e lojas e quem é dono de cada um.',
    campos: [
      { id: 'proprietario', nome: 'Proprietário', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'propriedade', nome: 'Propriedade', tipo: 'texto', obrigatorio: true, destaque: true, ajuda: 'Ex.: Casa da Rua do Mercado, nº 3' },
      { id: 'tipo', nome: 'Tipo', tipo: 'selecao', destaque: true, opcoes: ['Casa', 'Terreno', 'Loja', 'Fazenda', 'Armazém', 'Outro'] },
      { id: 'coordenadas', nome: 'Coordenadas (X, Y, Z)', tipo: 'texto' },
      { id: 'aquisicao', nome: 'Data de aquisição', tipo: 'data' },
      obs,
    ],
  },
  {
    modulo: 'guarda', nome: 'Registro de Prisioneiros', icone: 'grades', aberto: 1,
    descricao: 'Quem foi preso, por qual crime e por quanto tempo.',
    campos: [
      { id: 's_ident', nome: 'Identificação', tipo: 'secao' },
      { id: 'nome', nome: 'Nome do prisioneiro', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'retrato', nome: 'Retrato', tipo: 'imagem' },
      { id: 's_crime', nome: 'Crime e pena', tipo: 'secao' },
      { id: 'crime', nome: 'Crime', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'data', nome: 'Data da prisão', tipo: 'data', obrigatorio: true },
      ...CAMPOS_PENA,
      { id: 'cela', nome: 'Cela', tipo: 'texto' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Preso', 'Cumprindo pena', 'Solto', 'Foragido', 'Transferido'] },
      { ...CAMPO_GUARDAS, livro: '@Guardas da Capital' },
      obs,
    ],
  },
  {
    modulo: 'guarda', nome: 'Guardas da Capital', icone: 'escudo', aberto: 1,
    descricao: 'O efetivo da Guarda do Coelho.',
    campos: [
      { id: 'nome', nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'patente', nome: 'Patente', tipo: 'selecao', destaque: true, opcoes: ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Comandante'] },
      { id: 'posto', nome: 'Posto', tipo: 'texto', destaque: true, ajuda: 'Ex.: Portão Norte, Castelo' },
      { id: 'alistamento', nome: 'Data de alistamento', tipo: 'data' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Ativo', 'Afastado', 'Dispensado'] },
      obs,
    ],
  },
  {
    modulo: 'guarda', nome: 'Procurados', icone: 'alvo', aberto: 1,
    descricao: 'Fugitivos e suspeitos que a guarda está procurando.',
    campos: [
      { id: 'nome', nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'retrato', nome: 'Retrato', tipo: 'imagem' },
      { id: 'crime', nome: 'Crime', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'recompensa', nome: 'Recompensa (Lírios)', tipo: 'numero', destaque: true },
      { id: 'condicao', nome: 'Vivo ou morto', tipo: 'selecao', destaque: true, opcoes: ['Vivo', 'Morto', 'Vivo ou Morto'], ajuda: 'O que aparece no cartaz de procurado.' },
      { id: 'visto', nome: 'Última vez visto em', tipo: 'texto' },
      { id: 'perigo', nome: 'Periculosidade', tipo: 'selecao', destaque: true, opcoes: ['Baixa', 'Média', 'Alta'] },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Procurado', 'Banido da Capital', 'Capturado', 'Perdoado'] },
    ],
  },
  {
    modulo: 'hospital', nome: 'Registro de Pacientes', icone: 'cruz', aberto: 1,
    descricao: 'Quem foi atendido no hospital, o que tinha e como foi tratado.',
    campos: [
      { id: 's_paciente', nome: 'Paciente', tipo: 'secao' },
      { id: 'nome', nome: 'Nome do paciente', tipo: 'texto', obrigatorio: true, destaque: true },
      NICKNAME,
      { id: 'idade', nome: 'Idade', tipo: 'texto' },
      { id: 's_atendimento', nome: 'Atendimento', tipo: 'secao' },
      { id: 'data', nome: 'Data do atendimento', tipo: 'data', obrigatorio: true, destaque: true },
      { id: 'motivo', nome: 'Motivo do atendimento', tipo: 'texto', obrigatorio: true, destaque: true, ajuda: 'Ex.: ferimento de espada, febre, envenenamento' },
      { id: 'gravidade', nome: 'Gravidade', tipo: 'selecao', opcoes: ['Leve', 'Moderada', 'Grave', 'Gravíssima'] },
      { id: 'diagnostico', nome: 'Diagnóstico', tipo: 'texto_longo' },
      { id: 'tratamento', nome: 'Tratamento', tipo: 'texto_longo', ajuda: 'Remédios, poções, curativos, cirurgia, repouso...' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Em tratamento', 'Internado', 'Recebeu alta', 'Transferido', 'Faleceu'] },
      { id: 'alta', nome: 'Data da alta', tipo: 'data' },
      { id: 'medicos', nome: 'Médicos responsáveis', tipo: 'referencia', multiplo: true, livro: '@Equipe do Hospital' },
      obs,
    ],
  },
  {
    modulo: 'hospital', nome: 'Equipe do Hospital', icone: 'usuarios', aberto: 1,
    descricao: 'Diretor, médicos e ajudantes do hospital da capital.',
    campos: [
      { id: 'nome', nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'funcao', nome: 'Função', tipo: 'selecao', destaque: true, opcoes: ['Diretor do Hospital', 'Médico', 'Enfermeiro', 'Boticário', 'Aprendiz'] },
      { id: 'especialidade', nome: 'Especialidade', tipo: 'texto', destaque: true, ajuda: 'Ex.: cirurgia, ervas e poções, partos' },
      { id: 'entrada', nome: 'Data de entrada', tipo: 'data' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Ativo', 'Afastado', 'Desligado'] },
      obs,
    ],
  },
  {
    modulo: 'congresso', nome: 'Leis e Mudanças', icone: 'coluna', aberto: 1,
    descricao: 'PECs, leis, regras e tudo o que foi votado no Congresso.',
    campos: [
      { id: 'titulo', nome: 'Título', tipo: 'texto', obrigatorio: true, destaque: true, ajuda: 'Ex.: PEC do Imposto do Mercado' },
      { id: 'tipo', nome: 'Tipo', tipo: 'selecao', obrigatorio: true, destaque: true, opcoes: ['PEC', 'Lei', 'Regra', 'Emenda', 'Decreto', 'Resolução', 'Outro'] },
      { id: 'votacao', nome: 'Data da votação', tipo: 'data', obrigatorio: true, destaque: true },
      { id: 'resultado', nome: 'Resultado', tipo: 'selecao', destaque: true, opcoes: ['Aprovada', 'Rejeitada', 'Adiada'] },
      { id: 'resumo', nome: 'O que muda', tipo: 'texto_longo', obrigatorio: true, ajuda: 'Em poucas palavras, o que muda para os moradores.' },
      { id: 'texto', nome: 'Texto completo', tipo: 'texto_longo' },
      { id: 's_votos', nome: 'Votação', tipo: 'secao' },
      { id: 'a_favor', nome: 'Votos a favor', tipo: 'numero' },
      { id: 'contra', nome: 'Votos contra', tipo: 'numero' },
      { id: 'abstencoes', nome: 'Abstenções', tipo: 'numero' },
      { id: 'autor', nome: 'Quem propôs', tipo: 'texto' },
      { id: 's_vigencia', nome: 'Vigência', tipo: 'secao' },
      { id: 'vigor', nome: 'Vale a partir de', tipo: 'data' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Em vigor', 'Aguardando', 'Revogada', 'Arquivada'] },
      { id: 'documento', nome: 'Imagem do documento', tipo: 'imagem' },
    ],
  },
  {
    modulo: 'leis', nome: 'Leis de Lyendell', icone: 'balanca', aberto: 1,
    descricao: 'As leis da capital, feitas pelo Lorde Comandante e pela Família Nobre.',
    campos: [
      { id: 'titulo', nome: 'Título', tipo: 'texto', obrigatorio: true, destaque: true, ajuda: 'Ex.: Lei do Toque de Recolher' },
      { id: 'tipo', nome: 'Tipo', tipo: 'selecao', obrigatorio: true, destaque: true, opcoes: ['Lei', 'Decreto', 'Edital', 'Proibição', 'Imposto', 'Regra', 'Outro'] },
      { id: 'data', nome: 'Data', tipo: 'data', obrigatorio: true, destaque: true, ajuda: 'Quando a lei foi feita.' },
      { id: 'autoria', nome: 'Feita por', tipo: 'selecao', destaque: true, opcoes: ['Lorde Comandante', 'Família Nobre', 'Lorde Comandante e Família Nobre'] },
      { id: 'texto', nome: 'O que diz a lei', tipo: 'texto_longo', obrigatorio: true },
      { id: 'pena', nome: 'Pena para quem descumprir', tipo: 'texto', ajuda: 'Ex.: multa de 20 Lírios, 2 dias de prisão' },
      { id: 'vigor', nome: 'Vale a partir de', tipo: 'data' },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Em vigor', 'Suspensa', 'Revogada'] },
      { id: 'documento', nome: 'Imagem do documento', tipo: 'imagem' },
    ],
  },
];

// O Hospital Imperial cura gente de todo o Império, não só os Luckham: um livro à parte, cuidado pelo Diretor do Hospital.
// É o Registro de Pacientes com a Casa ou região de origem e quem enviou o paciente.
const PACIENTES_BASE = LIVROS_PADRAO.find(l => l.modulo === 'hospital' && l.nome === 'Registro de Pacientes');
if (PACIENTES_BASE) {
  const campos = PACIENTES_BASE.campos.flatMap(f => (f.id === 'idade' ? [f,
    { id: 'origem', nome: 'Casa ou região de origem', tipo: 'texto', destaque: true, ajuda: 'De onde a pessoa vem no Império. Ex.: Casa Luckham, Terras Centrais' },
    { id: 'enviado_por', nome: 'Enviado por', tipo: 'texto', ajuda: 'Quem trouxe ou encaminhou o paciente, se houver' }] : [f]));
  LIVROS_PADRAO.push({ ...PACIENTES_BASE, nome: 'Pacientes do Hospital Imperial', descricao: 'Quem foi curado no Hospital Imperial, de qualquer Casa ou região do Império.', campos });
}

module.exports = { LIVROS_PADRAO, AJUDA_ABERTURA, CAMPOS_PENA, CAMPO_GUARDAS, CAMPOS_FICHA, FICHAS };
