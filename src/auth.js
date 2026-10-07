const crypto = require('crypto');
const { db } = require('./db');
const { TODAS, VALIDAS, PERMITIDAS_CRIANCA } = require('./permissoes');
const { erro } = require('./util');

const COOKIE = 'lyendell_sessao';
const DIAS = 30;

const sha = t => crypto.createHash('sha256').update(t).digest('hex');

function lerCookie(req) {
  const bruto = req.headers.cookie;
  if (!bruto) return null;
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

async function criarSessao(req, res, usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run(`INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, datetime('now', '+${DIAS} days'))`, sha(token), usuarioId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: DIAS * 864e5, path: '/' });
  req.tokenSessao = token;
}

async function encerrarSessao(req, res) {
  if (req.tokenSessao) await db.run('DELETE FROM sessoes WHERE token_hash = ?', sha(req.tokenSessao));
  res.clearCookie(COOKIE, { path: '/' });
}

// Comando para derrubar as sessões de um usuário, menos (opcionalmente) a atual. Serve para db.lote.
function comandoDerrubarSessoes(usuarioId, excetoToken) {
  return excetoToken
    ? ['DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?', usuarioId, sha(excetoToken)]
    : ['DELETE FROM sessoes WHERE usuario_id = ?', usuarioId];
}

// Os cargos de alguém: os dele e o cargo base "Morador", que vale para todos, menos para quem tem um cargo
// que "não é morador" (exclui_base, como os Aliados, convidados de outras casas).
const SQL_CARGOS = `
  SELECT id, nome, cor, permissoes, base, exclui_base FROM cargos
  WHERE id IN (SELECT cargo_id FROM usuario_cargos WHERE usuario_id = ?)
    OR (base = 1 AND NOT EXISTS (SELECT 1 FROM usuario_cargos uc JOIN cargos x ON x.id = uc.cargo_id
      WHERE uc.usuario_id = ? AND x.exclui_base = 1))
  ORDER BY ordem, id`;
const cargosDoUsuario = id => db.all(SQL_CARGOS, id, id);

// O mesmo, a partir da lista de todos os cargos e dos ids dos cargos da pessoa (ex.: a lista de usuários).
function cargosEfetivos(todos, ids) {
  const proprios = todos.filter(c => ids.has(c.id));
  return proprios.some(c => c.exclui_base) ? proprios : todos.filter(c => c.base || ids.has(c.id));
}

// Quem não é morador (os Aliados): o SQL de uma pessoa que tem um cargo "não é morador".
// Use com o apelido "u" para a tabela usuarios. O administrador principal é sempre morador.
const SQL_NAO_MORADOR = `(u.is_root = 0 AND EXISTS (SELECT 1 FROM usuario_cargos uc JOIN cargos x ON x.id = uc.cargo_id
  WHERE uc.usuario_id = u.id AND x.exclui_base = 1))`;

// Soma as permissões dos cargos (o cargo base "Morador" vale para todos os moradores).
// Criança fica só com as de olhar, brincar e ajudar, mesmo que o cargo dê mais.
function montarUsuario(u, cargos) {
  const permissoes = new Set();
  const crianca = !!u.crianca && !u.is_root;
  for (const c of cargos) for (const p of JSON.parse(c.permissoes)) if (VALIDAS.has(p) && (!crianca || PERMITIDAS_CRIANCA.has(p))) permissoes.add(p);
  if (u.is_root) TODAS.forEach(p => permissoes.add(p));
  return {
    id: u.id,
    nome: u.nome,
    foto: u.foto || null,
    is_root: !!u.is_root,
    ativo: !!u.ativo,
    crianca,
    // Morador: recebe o cargo base. Os Aliados não são (só veem o que for aberto para Convidados e Aliados).
    morador: !!u.is_root || cargos.some(c => c.base),
    cargos: cargos.filter(c => !c.base).map(({ id, nome, cor }) => ({ id, nome, cor })),
    permissoes,
  };
}

async function carregarUsuario(id) {
  const u = await db.get('SELECT id, nome, foto, is_root, ativo, crianca FROM usuarios WHERE id = ?', id);
  if (!u) return null;
  return montarUsuario(u, await cargosDoUsuario(id));
}

function perfil(u) {
  return { id: u.id, nome: u.nome, foto: u.foto, is_root: u.is_root, crianca: u.crianca, morador: u.morador, cargos: u.cargos, permissoes: [...u.permissoes] };
}

// Módulos de livros (Tabelionato, Guarda...) com pelo menos um livro marcado para Convidados e Aliados.
async function modulosDosAliados() {
  return (await db.all('SELECT DISTINCT modulo FROM livros WHERE aliados = 1 ORDER BY modulo')).map(l => l.modulo);
}

// O perfil de quem entrou, para o site montar o menu. Quem vê a parte dos Aliados recebe também
// os módulos que têm livros abertos para eles (aliadosModulos).
async function perfilCompleto(u) {
  return { ...perfil(u), aliadosModulos: u.permissoes.has('aliados.ver') ? await modulosDosAliados() : [] };
}

const CINCO_MINUTOS = 5 * 60 * 1000;

// Quem está logado nesta requisição (serve para as páginas e para a conexão em tempo real).
async function usuarioDaRequisicao(req) {
  const token = lerCookie(req);
  if (!token) return null;
  const u = await db.get(`
    SELECT u.id, u.nome, u.foto, u.is_root, u.ativo, u.crianca, u.ultimo_acesso FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_em > datetime('now') AND u.ativo = 1`, sha(token));
  if (!u) return null;
  return { usuario: montarUsuario(u, await cargosDoUsuario(u.id)), token, ultimoAcesso: u.ultimo_acesso };
}

// A sessão continua valendo? (usuário não foi desativado nem removido, e ela não venceu)
async function sessaoAindaValida(token) {
  return !!await db.get(`
    SELECT 1 AS ok FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_em > datetime('now') AND u.ativo = 1`, sha(token));
}

async function sessao(req, res, next) {
  const s = await usuarioDaRequisicao(req);
  if (s) {
    req.usuario = s.usuario;
    req.tokenSessao = s.token;
    const ultimo = s.ultimoAcesso ? Date.parse(`${s.ultimoAcesso.replace(' ', 'T')}Z`) : 0;
    if (Date.now() - ultimo > CINCO_MINUTOS) await db.run("UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?", s.usuario.id);
  }
  next();
}

const pode = (req, p) => !!req.usuario && req.usuario.permissoes.has(p);

function checar(req, ...perms) {
  if (!req.usuario) throw erro(401, 'Faça login para continuar.');
  if (!perms.every(p => req.usuario.permissoes.has(p))) throw erro(403, req.usuario.crianca ? 'Isso é coisa de gente grande!' : 'Você não tem permissão para isso.');
}

const exigirLogin = (req, res, next) => next(req.usuario ? undefined : erro(401, 'Faça login para continuar.'));

const exigir = (...perms) => (req, res, next) => {
  try { checar(req, ...perms); next(); } catch (e) { next(e); }
};

// Partes que são só dos moradores (Comunidade, Mapa): os Aliados não entram.
const SO_MORADORES = 'Esta parte é só para os moradores da Casa Luckham.';
function checarMorador(req) {
  if (!req.usuario) throw erro(401, 'Faça login para continuar.');
  if (!req.usuario.morador) throw erro(403, SO_MORADORES);
}
const exigirMorador = (req, res, next) => {
  try { checarMorador(req); next(); } catch (e) { next(e); }
};

// Convidados e Aliados: quem não tem a permissão normal (ex.: "anuncios.ver"), mas vê a parte dos Aliados,
// enxerga só o que foi marcado para eles.
const soAliados = (req, perm) => !pode(req, perm) && pode(req, 'aliados.ver');

module.exports = {
  criarSessao, encerrarSessao, comandoDerrubarSessoes, carregarUsuario, montarUsuario, perfil, perfilCompleto,
  cargosEfetivos, modulosDosAliados, SQL_NAO_MORADOR,
  sessao, usuarioDaRequisicao, sessaoAindaValida, pode, checar, exigirLogin, exigir, checarMorador, exigirMorador, soAliados,
};
