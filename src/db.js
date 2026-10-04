const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const { hashSenha } = require('./senhas');
const { CARGOS_PADRAO, DESCRICOES, EXCLUSIVAS } = require('./permissoes');
const { LIVROS_PADRAO, AJUDA_ABERTURA, CAMPOS_PENA, CAMPO_GUARDAS, CAMPOS_FICHA, FICHAS } = require('./livros-padrao');
const { CASAS_PADRAO } = require('./casas-padrao');
const { PREDIOS_PADRAO } = require('./predios-padrao');
const { PERGUNTAS_PADRAO } = require('./perguntas-padrao');
const { linha, chaveNome } = require('./util');

// Na internet o banco fica no Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
// No computador, sem essas variáveis, ele usa um arquivo SQLite em data/.
const REMOTO = !!process.env.TURSO_DATABASE_URL;
const PASTA_DADOS = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
let url = process.env.TURSO_DATABASE_URL;
if (!REMOTO) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  url = `file:${path.join(PASTA_DADOS, 'lyendell.db').replace(/\\/g, '/')}`;
}
const cliente = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });

// O banco ignora valores sobrando sem avisar; aqui um "?" a mais ou a menos vira erro na hora.
function argumentos(sql, args) {
  const lugares = (sql.replace(/'[^']*'/g, '').match(/\?/g) || []).length;
  if (lugares !== args.length) throw new Error(`Comando com ${lugares} "?" recebeu ${args.length} valores: ${sql.trim().slice(0, 80)}`);
  return args.map(a => (a === undefined ? null : a));
}
const paraObjetos = rs => rs.rows.map(l => Object.fromEntries(rs.columns.map((c, i) => [c, l[i]])));

const db = {
  async all(sql, ...args) {
    return paraObjetos(await cliente.execute({ sql, args: argumentos(sql, args) }));
  },
  async get(sql, ...args) {
    return (await db.all(sql, ...args))[0];
  },
  async run(sql, ...args) {
    const r = await cliente.execute({ sql, args: argumentos(sql, args) });
    return { changes: r.rowsAffected, id: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
  },
  // Vários comandos ['SQL', arg1, arg2] de uma vez: ou valem todos, ou nenhum.
  async lote(comandos) {
    const lista = comandos.filter(Boolean).map(([sql, ...args]) => ({ sql, args: argumentos(sql, args) }));
    return lista.length ? cliente.batch(lista, 'write') : [];
  },
};

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS meta (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  chave TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  is_root INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_acesso TEXT,
  foto TEXT,
  crianca INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cargos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
  descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT '#d8b13a',
  permissoes TEXT NOT NULL DEFAULT '[]',
  base INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usuario_cargos (
  usuario_id INTEGER NOT NULL,
  cargo_id INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, cargo_id)
);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE IF NOT EXISTS livros (
  id INTEGER PRIMARY KEY,
  modulo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  icone TEXT NOT NULL DEFAULT 'livro',
  aberto INTEGER NOT NULL DEFAULT 1,
  campos TEXT NOT NULL DEFAULT '[]',
  cobranca TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY,
  livro_id INTEGER NOT NULL,
  dados TEXT NOT NULL DEFAULT '{}',
  criado_por INTEGER,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_por_nome TEXT,
  atualizado_em TEXT,
  cobranca_fim TEXT,
  situacao TEXT NOT NULL DEFAULT 'aprovado',
  revisado_por_nome TEXT,
  revisado_em TEXT,
  motivo TEXT,
  numero INTEGER
);
CREATE INDEX IF NOT EXISTS idx_registros_livro ON registros(livro_id);

CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY,
  registro_id INTEGER NOT NULL,
  vencimento TEXT NOT NULL,
  pago_em TEXT NOT NULL,
  observacao TEXT NOT NULL,
  marcado_por INTEGER,
  marcado_por_nome TEXT NOT NULL DEFAULT '',
  marcado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (registro_id, vencimento)
);

CREATE TABLE IF NOT EXISTS albuns (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY,
  album_id INTEGER,
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  arquivo TEXT NOT NULL,
  enviado_por INTEGER,
  enviado_por_nome TEXT NOT NULL DEFAULT '',
  enviado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS arquivos (
  nome TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  dados BLOB NOT NULL,
  enviado_por INTEGER,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anuncios (
  id INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  importancia TEXT NOT NULL DEFAULT 'comum',
  imagem TEXT,
  fixado INTEGER NOT NULL DEFAULT 0,
  autor_id INTEGER,
  autor_nome TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  editado_em TEXT
);

CREATE TABLE IF NOT EXISTS atividades (
  id INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  item TEXT NOT NULL,
  meta INTEGER NOT NULL,
  pacote INTEGER NOT NULL DEFAULT 64,
  recompensa_valor REAL,
  recompensa_unidade TEXT NOT NULL DEFAULT '',
  prazo TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  criado_por INTEGER,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  concluido_em TEXT
);

CREATE TABLE IF NOT EXISTS participantes (
  atividade_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  usuario_nome TEXT NOT NULL,
  compromisso INTEGER NOT NULL DEFAULT 0,
  entrou_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (atividade_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS contribuicoes (
  id INTEGER PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  conferida INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contribuicoes_atividade ON contribuicoes(atividade_id);

CREATE TABLE IF NOT EXISTS chat_mensagens (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  tipo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS propostas (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  justificativa TEXT NOT NULL DEFAULT '',
  autor_id INTEGER,
  autor_nome TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'enviada',
  parecer TEXT,
  parecer_nome TEXT,
  votacao TEXT,
  a_favor INTEGER,
  contra INTEGER,
  abstencoes INTEGER,
  resultado TEXT,
  historico TEXT NOT NULL DEFAULT '[]',
  livro_id INTEGER,
  registro_id INTEGER,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_propostas_situacao ON propostas(situacao, id);

CREATE TABLE IF NOT EXISTS proposta_apoios (
  proposta_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  PRIMARY KEY (proposta_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS juramentos (
  registro_id INTEGER PRIMARY KEY,
  jurou INTEGER NOT NULL,
  em TEXT,
  por_nome TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clube (
  usuario_id INTEGER PRIMARY KEY,
  moedas INTEGER NOT NULL DEFAULT 300,
  visual TEXT NOT NULL DEFAULT '{}',
  itens TEXT NOT NULL DEFAULT '{}',
  toca TEXT NOT NULL DEFAULT '{}',
  presente TEXT,
  ganhos_dia TEXT,
  ganhos INTEGER NOT NULL DEFAULT 0,
  peixes INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprites dos jogos: cada peça (ex.: "barris.barril.rolando") pode ter uma imagem em tira de quadros.
CREATE TABLE IF NOT EXISTS sprites (
  chave TEXT PRIMARY KEY,
  src TEXT NOT NULL,
  quadros INTEGER NOT NULL DEFAULT 1,
  fps INTEGER NOT NULL DEFAULT 8,
  tingir INTEGER NOT NULL DEFAULT 0,
  suave INTEGER NOT NULL DEFAULT 0,
  por_nome TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS segredos (
  usuario_id INTEGER NOT NULL,
  chave TEXT NOT NULL,
  em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, chave)
);

CREATE TABLE IF NOT EXISTS pegadinhas (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  de_id INTEGER NOT NULL,
  de_nome TEXT NOT NULL,
  alvo_id INTEGER,
  alvo_nome TEXT,
  entregue INTEGER NOT NULL DEFAULT 0,
  reacao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pegadinhas_alvo ON pegadinhas(alvo_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_pegadinhas_de ON pegadinhas(de_id, criado_em);

CREATE TABLE IF NOT EXISTS partidas (
  id INTEGER PRIMARY KEY,
  jogo TEXT NOT NULL,
  jogador1_id INTEGER,
  jogador1_nome TEXT NOT NULL,
  jogador2_id INTEGER,
  jogador2_nome TEXT NOT NULL,
  vencedor INTEGER,
  motivo TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recordes (
  id INTEGER PRIMARY KEY,
  jogo TEXT NOT NULL,
  variante TEXT NOT NULL DEFAULT '',
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  detalhe TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recordes_jogo ON recordes(jogo, variante);

CREATE TABLE IF NOT EXISTS perguntas (
  id INTEGER PRIMARY KEY,
  categoria TEXT NOT NULL,
  texto TEXT NOT NULL,
  alternativas TEXT NOT NULL,
  correta INTEGER NOT NULL DEFAULT 0,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_perguntas_categoria ON perguntas(categoria);

CREATE TABLE IF NOT EXISTS eventos_dia (
  usuario_id INTEGER NOT NULL,
  dia TEXT NOT NULL,
  tipo TEXT NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, dia, tipo)
);

CREATE TABLE IF NOT EXISTS conquistas_usuario (
  usuario_id INTEGER NOT NULL,
  chave TEXT NOT NULL,
  em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, chave)
);

CREATE TABLE IF NOT EXISTS recados (
  id INTEGER PRIMARY KEY,
  perfil_id INTEGER NOT NULL,
  autor_id INTEGER,
  autor_nome TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recados_perfil ON recados(perfil_id, id);

CREATE TABLE IF NOT EXISTS resultados (
  id INTEGER PRIMARY KEY,
  jogo TEXT NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL,
  posicao INTEGER NOT NULL,
  jogadores INTEGER NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 0,
  venceu INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resultados_jogo ON resultados(jogo);

CREATE TABLE IF NOT EXISTS casas (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL DEFAULT '',
  via TEXT,
  lado TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'ocupada',
  texto TEXT NOT NULL DEFAULT '',
  icone TEXT NOT NULL DEFAULT '',
  pessoas TEXT NOT NULL DEFAULT '[]',
  atualizado_por_nome TEXT NOT NULL DEFAULT '',
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prédios públicos e outros pontos do mapa. info, fotos e pessoas são listas em JSON.
CREATE TABLE IF NOT EXISTS predios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT 'publico',
  icone TEXT NOT NULL DEFAULT 'estrela',
  tamanho TEXT NOT NULL DEFAULT 'medio',
  x REAL NOT NULL,
  y REAL NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  centro INTEGER NOT NULL DEFAULT 0,
  pagina TEXT NOT NULL DEFAULT '',
  funcao TEXT NOT NULL DEFAULT '',
  sobre TEXT NOT NULL DEFAULT '',
  info TEXT NOT NULL DEFAULT '[]',
  fotos TEXT NOT NULL DEFAULT '[]',
  pessoas TEXT NOT NULL DEFAULT '[]',
  atualizado_por_nome TEXT NOT NULL DEFAULT '',
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS musicas (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  credito TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_resultados (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  acertos INTEGER NOT NULL,
  total INTEGER NOT NULL,
  posicao INTEGER NOT NULL,
  jogadores INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diario (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER,
  usuario_nome TEXT NOT NULL DEFAULT '',
  acao TEXT NOT NULL,
  detalhe TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/* ─── Atualizações de bancos criados por versões anteriores ─ */

const VERSAO = 23;

async function colunaExiste(tabela, coluna) {
  return (await cliente.execute(`SELECT * FROM ${tabela} LIMIT 0`)).columns.includes(coluna);
}

async function migrar() {
  const salvo = await db.get("SELECT valor FROM meta WHERE chave = 'versao'");
  const versao = salvo ? Number(salvo.valor) : 0;

  if (versao < 1) {
    // v1: pagamentos periódicos e permissão de marcar pagamentos (cada passo pode rodar de novo sem estragar nada).
    if (!await colunaExiste('livros', 'cobranca')) await db.run('ALTER TABLE livros ADD COLUMN cobranca TEXT');
    if (!await colunaExiste('registros', 'cobranca_fim')) await db.run('ALTER TABLE registros ADD COLUMN cobranca_fim TEXT');
    for (const nome of ['Tabeliã', 'Família Nobre']) {
      const c = await db.get('SELECT id, permissoes FROM cargos WHERE nome = ?', nome);
      if (!c) continue;
      const lista = JSON.parse(c.permissoes);
      if (!lista.includes('tabelionato.pagamentos')) {
        lista.push('tabelionato.pagamentos');
        await db.run('UPDATE cargos SET permissoes = ? WHERE id = ?', JSON.stringify(lista), c.id);
      }
    }
    const comercio = await db.get("SELECT id, campos FROM livros WHERE modulo = 'tabelionato' AND nome = 'Registro de Comerciantes' AND cobranca IS NULL");
    if (comercio) {
      const campos = JSON.parse(comercio.campos);
      const abertura = campos.find(c => c.id === 'abertura' && c.tipo === 'data');
      if (abertura) {
        if (!abertura.ajuda) abertura.ajuda = AJUDA_ABERTURA;
        await db.run('UPDATE livros SET campos = ?, cobranca = ? WHERE id = ?',
          JSON.stringify(campos), JSON.stringify({ ativo: true, campo: 'abertura', intervalo: 14 }), comercio.id);
      }
    }
  }
  // v2: imagens passam a ficar dentro do banco (tabela "arquivos", criada no esquema).
  if (versao < 3) {
    // v3: foto de perfil.
    if (!await colunaExiste('usuarios', 'foto')) await db.run('ALTER TABLE usuarios ADD COLUMN foto TEXT');
  }
  if (versao < 4) await migrarPrisioneiros();
  if (versao < 5) await migrarAprovacao();
  if (versao < 6) await migrarNumeracao();
  if (versao < 7) await fecharBuracosNaNumeracao();
  // v8: recreação. Todo morador usa o chat e os jogos; a Família Nobre modera o chat.
  if (versao < 8) await darPermissoes({ base: ['recreacao.usar'], 'Família Nobre': ['recreacao.moderar'] });
  // v9: quiz. A Família Nobre cuida das perguntas (as perguntas padrão entram no semear).
  if (versao < 9) await darPermissoes({ 'Família Nobre': ['recreacao.perguntas'] });
  // v10: fichas iguais aos modelos .book da Casa (Moradores, Nobres e o novo Registro de Outros).
  if (versao < 10) await alinharFichas();
  if (versao < 11) {
    // v11: perfil personalizável, níveis, conquistas e trilha sonora.
    const colunas = {
      titulo_perfil: 'TEXT', bio: 'TEXT', cor: 'TEXT', capa: 'TEXT', moldura: 'TEXT', mc_nick: 'TEXT', emblemas: 'TEXT',
      xp: 'INTEGER NOT NULL DEFAULT 0', sequencia: 'INTEGER NOT NULL DEFAULT 0', sequencia_max: 'INTEGER NOT NULL DEFAULT 0', ultimo_dia: 'TEXT',
    };
    for (const [c, tipo] of Object.entries(colunas)) {
      if (!await colunaExiste('usuarios', c)) await db.run(`ALTER TABLE usuarios ADD COLUMN ${c} ${tipo}`);
    }
    await darPermissoes({ 'Família Nobre': ['trilha.gerenciar'] });
    // Mensagens que já existiam contam para as conquistas do chat.
    await db.run(`INSERT INTO eventos_dia (usuario_id, dia, tipo, qtd)
      SELECT usuario_id, '2000-01-01', 'chat', COUNT(*) FROM chat_mensagens WHERE usuario_id IS NOT NULL GROUP BY usuario_id
      ON CONFLICT (usuario_id, dia, tipo) DO NOTHING`);
  }
  // v12: a trilha fica só com músicas em arquivo (sem Spotify, YouTube ou links de fora).
  if (versao < 12) await db.run("DELETE FROM musicas WHERE tipo <> 'arquivo'");
  if (versao < 13) await migrarHospitalECongresso();
  // v14: casas no mapa. A Família Nobre e a Tabeliã colocam e editam as casas.
  if (versao < 14) await darPermissoes({ 'Família Nobre': ['mapa.editar'], 'Tabeliã': ['mapa.editar'] });
  if (versao < 15) await migrarLeisDaCapital();
  if (versao < 16) await migrarLeisDeLyendell();
  // v17: personagem criança (só olha, brinca e ajuda; o site aparece do jeito de uma criança).
  if (versao < 17 && !await colunaExiste('usuarios', 'crianca')) await db.run('ALTER TABLE usuarios ADD COLUMN crianca INTEGER NOT NULL DEFAULT 0');
  if (versao < 18) await migrarBobo();
  // v21: a Família Nobre e a Tabeliã marcam quem já fez o Juramento da Casa Luckham.
  if (versao < 21) await darPermissoes({ 'Família Nobre': ['juramento.marcar'], 'Tabeliã': ['juramento.marcar'] });
  // v22: a Família Nobre troca os desenhos dos jogos pelos sprites que fizer (#/recreacao/sprites).
  if (versao < 22) await darPermissoes({ 'Família Nobre': ['sprites.editar'] });
  // v23: os Procurados ganham o cartaz (vivo, morto ou vivo ou morto) e a recompensa em Lírios.
  if (versao < 23) await cartazDosProcurados();
  // v20: o campo "Nickname" vira "Endereço" em todos os livros (no RP o nick é o endereço da pessoa).
  if (versao < 20) await nickVirouEndereco();
  // v19: propostas do povo para o Congresso (todo morador manda; a Senadora avalia).
  if (versao < 19) {
    await darPermissoes({ base: ['congresso.propor'] });
    await atualizarDescricoes();
  }

  await db.run("INSERT INTO meta (chave, valor) VALUES ('versao', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor", String(VERSAO));
}

// Moradores e Nobres ganham os campos do modelo que faltarem (Nickname, Idade, Cargo, Estado civil...),
// na ordem do modelo e antes dos outros campos, que continuam lá. Nada é apagado.
// Também cria o Registro de Outros, se ainda não existir.
async function alinharFichas() {
  const livros = await db.all("SELECT id, nome, campos FROM livros WHERE modulo = 'tabelionato'");
  if (!livros.length) return; // banco novo: o semear já cria os livros no modelo
  const nomeDoCampo = c => chaveNome(c.nome).replace(/:$/, '').trim();
  for (const l of livros) {
    const ordem = FICHAS[chaveNome(l.nome)];
    if (!ordem) continue;
    const campos = JSON.parse(l.campos);
    const usados = new Set();
    const primeiros = [];
    for (const chave of ordem) {
      const ficha = CAMPOS_FICHA[chave];
      let c = campos.find(x => !usados.has(x) && x.tipo !== 'imagem' && x.tipo !== 'secao' && ficha.sinonimos.includes(nomeDoCampo(x)));
      if (!c) {
        let id = chave;
        for (let n = 2; campos.some(x => x.id === id) || primeiros.some(x => x.id === id); n++) id = `${chave}_${n}`;
        c = { id, nome: ficha.nome, tipo: 'texto', ...(ficha.ajuda ? { ajuda: ficha.ajuda } : {}) };
      }
      usados.add(c);
      primeiros.push(c);
    }
    const novos = [...primeiros, ...campos.filter(x => !usados.has(x))];
    if (JSON.stringify(novos) !== JSON.stringify(campos)) await db.run('UPDATE livros SET campos = ? WHERE id = ?', JSON.stringify(novos), l.id);
  }
  if (!livros.some(l => chaveNome(l.nome) === 'registro de outros')) {
    const o = LIVROS_PADRAO.find(l => l.nome === 'Registro de Outros');
    const { m } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS m FROM livros');
    await db.run('INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      o.modulo, o.nome, o.descricao, o.icone, o.aberto, JSON.stringify(o.campos), null, m + 1);
  }
}

// v13: Hospital (Diretor e Médicos, aprovação do Diretor), Congresso (a Senadora publica as leis e PECs)
// e os Guardas registram em todos os livros da Guarda (sempre com a aprovação do Comandante).
async function migrarHospitalECongresso() {
  if (!(await db.get('SELECT COUNT(*) AS n FROM cargos')).n) return; // banco novo: o semear cria tudo
  const novos = ['Diretor do Hospital', 'Médico', 'Senadora'].map(nome => CARGOS_PADRAO.find(c => c.nome === nome));
  let { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM cargos');
  for (const c of novos) {
    if (await db.get('SELECT id FROM cargos WHERE nome = ?', c.nome)) continue;
    await db.run('INSERT INTO cargos (nome, descricao, cor, permissoes, base, ordem) VALUES (?, ?, ?, ?, 0, ?)',
      c.nome, c.descricao, c.cor, '[]', ++ordem);
  }
  // Cargo com o mesmo nome criado antes à mão também recebe os poderes.
  const nobre = CARGOS_PADRAO.find(c => c.nome === 'Família Nobre').permissoes.filter(p => /^(hospital|congresso)\./.test(p));
  await darPermissoes({ base: ['congresso.ver'], 'Família Nobre': nobre, ...Object.fromEntries(novos.map(c => [c.nome, c.permissoes])) });
  await atualizarDescricoes();
  await db.run("UPDATE livros SET aberto = 1 WHERE modulo = 'guarda'");
  const { ordemLivro } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordemLivro FROM livros');
  const livros = LIVROS_PADRAO.filter(l => l.modulo === 'hospital' || l.modulo === 'congresso');
  const faltam = [];
  for (const l of livros) {
    if (!await db.get('SELECT id FROM livros WHERE modulo = ? LIMIT 1', l.modulo) || faltam.some(x => x.modulo === l.modulo)) faltam.push(l);
  }
  if (!faltam.length) return;
  await db.lote(faltam.map((l, i) => [
    'INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    l.modulo, l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), null, ordemLivro + i + 1,
  ]));
  await resolverReferencias();
}

// v15: Leis da Capital (o Lorde Comandante e a Família Nobre publicam), e "sem morador" virou "sem dono" no mapa.
async function migrarLeisDaCapital() {
  await db.run("UPDATE casas SET situacao = 'sem_dono' WHERE situacao = 'sem_morador'");
  if (!(await db.get('SELECT COUNT(*) AS n FROM cargos')).n) return; // banco novo: o semear cria tudo
  const lorde = CARGOS_PADRAO.find(c => c.nome === 'Lorde Comandante');
  if (!await db.get('SELECT id FROM cargos WHERE nome = ?', lorde.nome)) {
    const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM cargos');
    await db.run('INSERT INTO cargos (nome, descricao, cor, permissoes, base, ordem) VALUES (?, ?, ?, ?, 0, ?)', lorde.nome, lorde.descricao, lorde.cor, '[]', ordem + 1);
  }
  const nobre = CARGOS_PADRAO.find(c => c.nome === 'Família Nobre').permissoes.filter(p => p.startsWith('leis.'));
  await darPermissoes({ base: ['leis.ver'], 'Família Nobre': nobre, [lorde.nome]: lorde.permissoes });
  await atualizarDescricoes();
  if (!await db.get("SELECT id FROM livros WHERE modulo = 'leis' LIMIT 1")) {
    const l = LIVROS_PADRAO.find(x => x.modulo === 'leis');
    const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM livros');
    await db.run('INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      l.modulo, l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), null, ordem + 1);
  }
}

// v16: "Leis da Capital" virou "Leis de Lyendell", e as casas do mapa ganharam ícone (opcional).
// Os prédios do mapa passaram para o banco (entram no semear, com o Senado).
async function migrarLeisDeLyendell() {
  if (!await colunaExiste('casas', 'icone')) await db.run("ALTER TABLE casas ADD COLUMN icone TEXT NOT NULL DEFAULT ''");
  await db.run("UPDATE livros SET nome = 'Leis de Lyendell' WHERE modulo = 'leis' AND nome = 'Leis da Capital'");
  await db.run("UPDATE livros SET descricao = ? WHERE modulo = 'leis' AND descricao = ?",
    'As leis da capital, feitas pelo Lorde Comandante e pela Família Nobre.', 'As leis de Lyendell, feitas pelo Lorde Comandante e pela Família Nobre.');
  await atualizarDescricoes();
}

// v18: o Bobo da Corte (cargo com a Caixa de Pegadinhas) e as piadas no chat.
async function migrarBobo() {
  if (!await colunaExiste('chat_mensagens', 'tipo')) await db.run("ALTER TABLE chat_mensagens ADD COLUMN tipo TEXT NOT NULL DEFAULT ''");
  if (!(await db.get('SELECT COUNT(*) AS n FROM cargos')).n) return; // banco novo: o semear cria tudo
  const bobo = CARGOS_PADRAO.find(c => c.nome === 'Bobo da Corte');
  if (!await db.get('SELECT id FROM cargos WHERE nome = ?', bobo.nome)) {
    const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM cargos');
    await db.run('INSERT INTO cargos (nome, descricao, cor, permissoes, base, ordem) VALUES (?, ?, ?, ?, 0, ?)', bobo.nome, bobo.descricao, bobo.cor, '[]', ordem + 1);
  }
  await darPermissoes({ [bobo.nome]: bobo.permissoes });
}

// v20: campo do nick ainda com o nome antigo "Nickname" passa a se chamar "Endereço" (os renomeados à mão ficam).
async function nickVirouEndereco() {
  for (const l of await db.all('SELECT id, campos FROM livros')) {
    const campos = JSON.parse(l.campos);
    let mudou = false;
    // O campo de onde a pessoa mora que ainda se chama Endereço (modelo antigo de Outros) vira Residência,
    // para não ficarem dois campos com o mesmo nome.
    if (campos.some(c => c.id === 'nickname')) {
      for (const c of campos) {
        if (c.id === 'endereco' && chaveNome(c.nome) === 'endereco') { c.nome = 'Residência'; mudou = true; }
      }
    }
    for (const c of campos) {
      if (c.tipo === 'texto' && chaveNome(c.nome) === 'nickname') {
        c.nome = CAMPOS_FICHA.nickname.nome;
        if (!c.ajuda || c.ajuda === 'O nick do jogador no Minecraft.') c.ajuda = CAMPOS_FICHA.nickname.ajuda;
        mudou = true;
      }
    }
    if (mudou) await db.run('UPDATE livros SET campos = ? WHERE id = ?', JSON.stringify(campos), l.id);
  }
}

// v23: no livro Procurados da Guarda, a recompensa vira número (em Lírios) e entra o "Vivo ou morto" do cartaz.
// O que já estava escrito na recompensa vira número quando dá (ex.: "500 Lírios" vira 500).
async function cartazDosProcurados() {
  for (const l of await db.all("SELECT id, campos FROM livros WHERE modulo = 'guarda'")) {
    const campos = JSON.parse(l.campos);
    const rec = campos.find(c => c.id === 'recompensa');
    if (!rec || campos.some(c => c.id === 'condicao')) continue;
    if (rec.tipo === 'texto') {
      rec.tipo = 'numero';
      if (chaveNome(rec.nome) === 'recompensa') rec.nome = 'Recompensa (Lírios)';
      for (const r of await db.all('SELECT id, dados FROM registros WHERE livro_id = ?', l.id)) {
        const d = JSON.parse(r.dados);
        if (d.recompensa == null || typeof d.recompensa === 'number') continue;
        const n = Number(String(d.recompensa).replace(/[^\d]/g, ''));
        d.recompensa = Number.isFinite(n) && String(d.recompensa).match(/\d/) ? n : null;
        await db.run('UPDATE registros SET dados = ? WHERE id = ?', JSON.stringify(d), r.id);
      }
    }
    campos.splice(campos.indexOf(rec) + 1, 0, { id: 'condicao', nome: 'Vivo ou morto', tipo: 'selecao', destaque: true, opcoes: ['Vivo', 'Morto', 'Vivo ou Morto'], ajuda: 'O que aparece no cartaz de procurado.' });
    await db.run('UPDATE livros SET campos = ? WHERE id = ?', JSON.stringify(campos), l.id);
  }
}

// Descrições de cargo que ainda estão no texto antigo passam para o texto novo (as editadas à mão ficam).
async function atualizarDescricoes() {
  for (const c of await db.all('SELECT id, nome, descricao FROM cargos')) {
    const [antigas = [], atual] = DESCRICOES[c.nome] || [];
    if (antigas.includes(c.descricao)) await db.run('UPDATE cargos SET descricao = ? WHERE id = ?', atual, c.id);
  }
}

// Acrescenta permissões novas aos cargos que já existem ("base" = o cargo de todos, o Morador).
async function darPermissoes(novas) {
  for (const c of await db.all('SELECT id, nome, base, permissoes FROM cargos')) {
    const lista = JSON.parse(c.permissoes);
    const faltam = [...(c.base ? novas.base || [] : []), ...(novas[c.nome] || [])].filter(p => !lista.includes(p));
    if (faltam.length) await db.run('UPDATE cargos SET permissoes = ? WHERE id = ?', JSON.stringify([...lista, ...faltam]), c.id);
  }
}

// v4: prisioneiros ganham soltura prevista, pena calculada, multa e guardas escolhidos da lista.
// Só mexe nos campos que ainda estão como vieram no modelo original.
async function migrarPrisioneiros() {
  const presos = await db.get("SELECT id, campos FROM livros WHERE modulo = 'guarda' AND nome = 'Registro de Prisioneiros'");
  if (!presos) return;
  const campos = JSON.parse(presos.campos);
  if (campos.some(c => c.tipo === 'duracao') || !campos.some(c => c.id === 'data' && c.tipo === 'data')) return;
  const guardas = await db.get("SELECT id FROM livros WHERE modulo = 'guarda' AND nome = 'Guardas da Capital'");
  const registros = (await db.all('SELECT dados FROM registros WHERE livro_id = ?', presos.id)).map(r => JSON.parse(r.dados));
  const penaEmUso = registros.some(d => d.pena);
  const ids = new Set(campos.map(c => c.id));
  const novos = [];
  for (const c of campos) {
    if (c.id === 'pena' && c.tipo === 'texto') {
      // O que já foi escrito na pena antiga continua guardado, com outro nome.
      if (penaEmUso) { const { destaque, ajuda, ...resto } = c; novos.push({ ...resto, nome: 'Anotação da pena' }); }
      continue;
    }
    if (c.id === 'guarda' && c.tipo === 'texto' && guardas) {
      novos.push({ ...CAMPO_GUARDAS, livro: guardas.id });
      continue;
    }
    if (c.id === 'data' && c.tipo === 'data') {
      const { destaque, ...resto } = c;
      novos.push({ ...resto, obrigatorio: true }, ...CAMPOS_PENA.filter(x => !ids.has(x.id) || x.id === 'duracao'));
      continue;
    }
    novos.push(c);
  }
  await db.run('UPDATE livros SET campos = ? WHERE id = ?', JSON.stringify(novos), presos.id);
}

// v5: registros de quem não aprova (Escriba, Guarda) ficam aguardando a Tabeliã ou o Comandante.
async function migrarAprovacao() {
  const colunas = [
    ['situacao', "TEXT NOT NULL DEFAULT 'aprovado'"], ['revisado_por_nome', 'TEXT'], ['revisado_em', 'TEXT'], ['motivo', 'TEXT'],
  ];
  for (const [coluna, tipo] of colunas) {
    if (!await colunaExiste('registros', coluna)) await db.run(`ALTER TABLE registros ADD COLUMN ${coluna} ${tipo}`);
  }
  const novas = { 'Tabeliã': ['tabelionato.aprovar'], 'Comandante da Guarda': ['guarda.aprovar'], 'Família Nobre': ['tabelionato.aprovar', 'guarda.aprovar'] };
  for (const c of await db.all('SELECT id, nome, descricao, permissoes FROM cargos')) {
    const lista = JSON.parse(c.permissoes);
    const faltam = (novas[c.nome] || []).filter(p => !lista.includes(p));
    const [antigas = [], atual] = DESCRICOES[c.nome] || [];
    const descricao = antigas.includes(c.descricao) ? atual : c.descricao;
    if (faltam.length || descricao !== c.descricao) {
      await db.run('UPDATE cargos SET permissoes = ?, descricao = ? WHERE id = ?', JSON.stringify([...lista, ...faltam]), descricao, c.id);
    }
  }
}

// v6: cada livro numera os próprios registros aprovados (1, 2, 3...) e só a Tabeliã e o Comandante aprovam.
async function migrarNumeracao() {
  if (!await colunaExiste('registros', 'numero')) await db.run('ALTER TABLE registros ADD COLUMN numero INTEGER');
  // Registros aprovados que ainda não têm número recebem 1, 2, 3... na ordem em que foram feitos, livro a livro.
  const semNumero = await db.all("SELECT id, livro_id FROM registros WHERE situacao = 'aprovado' AND numero IS NULL ORDER BY livro_id, id");
  const proximo = new Map();
  for (const l of await db.all('SELECT livro_id, MAX(numero) AS m FROM registros WHERE numero IS NOT NULL GROUP BY livro_id')) proximo.set(l.livro_id, l.m);
  const comandos = semNumero.map(r => {
    const n = (proximo.get(r.livro_id) || 0) + 1;
    proximo.set(r.livro_id, n);
    return ['UPDATE registros SET numero = ? WHERE id = ?', n, r.id];
  });
  for (let i = 0; i < comandos.length; i += 200) await db.lote(comandos.slice(i, i + 200));
  await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_numero ON registros(livro_id, numero) WHERE numero IS NOT NULL');

  // A permissão de aprovar fica só no cargo dono dela (Tabeliã ou Comandante); sai da Família Nobre e de qualquer outro.
  for (const c of await db.all('SELECT id, nome, descricao, permissoes FROM cargos')) {
    const lista = JSON.parse(c.permissoes);
    const limpa = lista.filter(p => !EXCLUSIVAS[p] || EXCLUSIVAS[p] === c.nome);
    const [antigas = [], atual] = DESCRICOES[c.nome] || [];
    const descricao = antigas.includes(c.descricao) ? atual : c.descricao;
    if (limpa.length !== lista.length || descricao !== c.descricao) {
      await db.run('UPDATE cargos SET permissoes = ?, descricao = ? WHERE id = ?', JSON.stringify(limpa), descricao, c.id);
    }
  }
}

// v7: numeração corrida. Se ficou algum buraco (ex.: 1, 2, 4), os de cima descem: 1, 2, 3, mantendo a ordem.
// Vai do menor para o maior, então cada número novo nunca está ocupado por outro registro.
async function fecharBuracosNaNumeracao() {
  const registros = await db.all('SELECT id, livro_id, numero FROM registros WHERE numero IS NOT NULL ORDER BY livro_id, numero, id');
  const contagem = new Map();
  const comandos = [];
  for (const r of registros) {
    const n = (contagem.get(r.livro_id) || 0) + 1;
    contagem.set(r.livro_id, n);
    if (r.numero !== n) comandos.push(['UPDATE registros SET numero = ? WHERE id = ?', n, r.id]);
  }
  for (let i = 0; i < comandos.length; i += 200) await db.lote(comandos.slice(i, i + 200));
}

// Campos "Escolher de outro livro" dos livros padrão apontam para "@Nome do livro"; aqui viram o id real.
async function resolverReferencias() {
  const livros = await db.all('SELECT id, modulo, nome, campos FROM livros');
  const porNome = new Map(livros.map(l => [`${l.modulo}:${l.nome}`, l.id]));
  for (const l of livros) {
    const campos = JSON.parse(l.campos);
    let mudou = false;
    for (const c of campos) {
      if (typeof c.livro === 'string' && c.livro.startsWith('@')) {
        c.livro = porNome.get(`${l.modulo}:${c.livro.slice(1)}`) ?? null;
        mudou = true;
      }
    }
    if (mudou) await db.run('UPDATE livros SET campos = ? WHERE id = ?', JSON.stringify(campos), l.id);
  }
}

async function semear() {
  if (!(await db.get('SELECT COUNT(*) AS n FROM cargos')).n) {
    await db.lote(CARGOS_PADRAO.map((c, i) => [
      'INSERT INTO cargos (nome, descricao, cor, permissoes, base, ordem) VALUES (?, ?, ?, ?, ?, ?)',
      c.nome, c.descricao, c.cor, JSON.stringify(c.permissoes), c.base ? 1 : 0, i,
    ]));
  }

  if (!(await db.get('SELECT COUNT(*) AS n FROM livros')).n) {
    await db.lote(LIVROS_PADRAO.map((l, i) => [
      'INSERT INTO livros (modulo, nome, descricao, icone, aberto, campos, cobranca, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      l.modulo, l.nome, l.descricao, l.icone, l.aberto, JSON.stringify(l.campos), l.cobranca ? JSON.stringify(l.cobranca) : null, i,
    ]));
    await resolverReferencias();
  }

  // As primeiras casas do mapa (Avenida Santa Menefreda) também entram uma vez só.
  if (!await db.get("SELECT valor FROM meta WHERE chave = 'casas_semeadas'")) {
    const vazio = !(await db.get('SELECT COUNT(*) AS n FROM casas')).n;
    await db.lote([
      ...(vazio ? CASAS_PADRAO.map(c => [
        'INSERT INTO casas (numero, via, lado, x, y, situacao, texto, pessoas, atualizado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        c.numero, c.via, c.lado, c.x, c.y, c.situacao, c.texto, '[]', 'Sistema',
      ]) : []),
      ["INSERT INTO meta (chave, valor) VALUES ('casas_semeadas', '1')"],
    ]);
  }

  // Os prédios do mapa (Septo, Coliseu, Toca do Coelho, Tabelionato, Banco, Quartel e Senado), uma vez só.
  if (!await db.get("SELECT valor FROM meta WHERE chave = 'predios_semeados'")) {
    const vazio = !(await db.get('SELECT COUNT(*) AS n FROM predios')).n;
    await db.lote([
      ...(vazio ? PREDIOS_PADRAO.map(p => [
        'INSERT INTO predios (nome, tipo, categoria, icone, tamanho, x, y, sub, centro, pagina, funcao, atualizado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        p.nome, p.tipo, p.categoria, p.icone, p.tamanho, p.x, p.y, p.sub || '', p.centro || 0, p.pagina || '', p.funcao || '', 'Sistema',
      ]) : []),
      ["INSERT INTO meta (chave, valor) VALUES ('predios_semeados', '1')"],
    ]);
  }

  // As perguntas padrão do quiz entram uma vez só: se alguém apagar todas depois, não voltam.
  if (!await db.get("SELECT valor FROM meta WHERE chave = 'perguntas_semeadas'")) {
    await db.lote([
      ...PERGUNTAS_PADRAO.map(([categoria, texto, ...alternativas]) => [
        'INSERT INTO perguntas (categoria, texto, alternativas, correta) VALUES (?, ?, ?, 0)', categoria, texto, JSON.stringify(alternativas),
      ]),
      ["INSERT INTO meta (chave, valor) VALUES ('perguntas_semeadas', '1')"],
    ]);
  }

  if (!await db.get('SELECT id FROM usuarios WHERE is_root = 1')) {
    const nome = linha(process.env.ROOT_NOME || 'Evran Luckham', 40);
    const senha = process.env.ROOT_SENHA;
    if (!senha) {
      console.warn('\n  Nenhum administrador existe ainda. Defina ROOT_SENHA e reinicie.\n');
      return;
    }
    await db.run('INSERT INTO usuarios (nome, chave, senha_hash, is_root) VALUES (?, ?, ?, 1)', nome, chaveNome(nome), await hashSenha(senha));
    console.log(`  Administrador "${nome}" criado.`);
  }
}

/* ─── Faxina periódica ────────────────────────────── */

// Sessões vencidas e imagens enviadas que ninguém chegou a usar (ex.: formulário cancelado).
async function faxina() {
  await db.run("DELETE FROM sessoes WHERE expira_em <= datetime('now')");
  // O chat guarda só as 2000 mensagens mais recentes.
  await db.run('DELETE FROM chat_mensagens WHERE id NOT IN (SELECT id FROM chat_mensagens ORDER BY id DESC LIMIT 2000)');
  await db.run(`
    DELETE FROM arquivos
    WHERE criado_em < datetime('now', '-1 day')
      AND NOT EXISTS (SELECT 1 FROM fotos WHERE fotos.arquivo = '/uploads/' || arquivos.nome)
      AND NOT EXISTS (SELECT 1 FROM anuncios WHERE anuncios.imagem = '/uploads/' || arquivos.nome)
      AND NOT EXISTS (SELECT 1 FROM usuarios WHERE usuarios.foto = '/uploads/' || arquivos.nome)
      AND NOT EXISTS (SELECT 1 FROM usuarios WHERE usuarios.capa = '/uploads/' || arquivos.nome)
      AND NOT EXISTS (SELECT 1 FROM musicas WHERE musicas.url = '/uploads/' || arquivos.nome)
      AND NOT EXISTS (SELECT 1 FROM registros WHERE instr(registros.dados, arquivos.nome) > 0)
      AND NOT EXISTS (SELECT 1 FROM predios WHERE instr(predios.fotos, arquivos.nome) > 0)`);
}

async function iniciarBanco() {
  await cliente.executeMultiple(ESQUEMA);
  await migrar();
  await semear();
  await faxina();
  setInterval(() => faxina().catch(e => console.error('Erro na faxina:', e.message)), 6 * 60 * 60 * 1000).unref();
  return REMOTO ? `Turso (${new URL(url.replace(/^libsql:/, 'https:')).host})` : path.join(PASTA_DADOS, 'lyendell.db');
}

module.exports = { db, iniciarBanco, faxina };
