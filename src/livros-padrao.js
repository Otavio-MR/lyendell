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
  nickname: { nome: 'Nickname', sinonimos: ['nickname', 'nick', 'nick do minecraft'], ajuda: 'O nick do jogador no Minecraft.' },
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
const NICKNAME = { id: 'nickname', nome: 'Nickname', tipo: 'texto', ajuda: CAMPOS_FICHA.nickname.ajuda };
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
      { id: 'endereco', nome: 'Endereço', tipo: 'texto', destaque: true },
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
    modulo: 'guarda', nome: 'Guardas da Capital', icone: 'escudo', aberto: 0,
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
    modulo: 'guarda', nome: 'Procurados', icone: 'alvo', aberto: 0,
    descricao: 'Fugitivos e suspeitos que a guarda está procurando.',
    campos: [
      { id: 'nome', nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'retrato', nome: 'Retrato', tipo: 'imagem' },
      { id: 'crime', nome: 'Crime', tipo: 'texto', obrigatorio: true, destaque: true },
      { id: 'recompensa', nome: 'Recompensa', tipo: 'texto', destaque: true },
      { id: 'visto', nome: 'Última vez visto em', tipo: 'texto' },
      { id: 'perigo', nome: 'Periculosidade', tipo: 'selecao', destaque: true, opcoes: ['Baixa', 'Média', 'Alta'] },
      { id: 'situacao', nome: 'Situação', tipo: 'selecao', destaque: true, opcoes: ['Procurado', 'Capturado', 'Perdoado'] },
    ],
  },
];

module.exports = { LIVROS_PADRAO, AJUDA_ABERTURA, CAMPOS_PENA, CAMPO_GUARDAS, CAMPOS_FICHA, FICHAS };
