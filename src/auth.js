const crypto = require('crypto');
const { db } = require('./db');
const { TODAS, VALIDAS } = require('./permissoes');
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

const SQL_CARGOS = `
  SELECT id, nome, cor, permissoes, base FROM cargos
  WHERE base = 1 OR id IN (SELECT cargo_id FROM usuario_cargos WHERE usuario_id = ?)
  ORDER BY ordem, id`;

// Soma as permissões dos cargos (o cargo base "Morador" vale para todos).
function montarUsuario(u, cargos) {
  const permissoes = new Set();
  for (const c of cargos) for (const p of JSON.parse(c.permissoes)) if (VALIDAS.has(p)) permissoes.add(p);
  if (u.is_root) TODAS.forEach(p => permissoes.add(p));
  return {
    id: u.id,
    nome: u.nome,
    foto: u.foto || null,
    is_root: !!u.is_root,
    ativo: !!u.ativo,
    cargos: cargos.filter(c => !c.base).map(({ id, nome, cor }) => ({ id, nome, cor })),
    permissoes,
  };
}

async function carregarUsuario(id) {
  const u = await db.get('SELECT id, nome, foto, is_root, ativo FROM usuarios WHERE id = ?', id);
  if (!u) return null;
  return montarUsuario(u, await db.all(SQL_CARGOS, id));
}

function perfil(u) {
  return { id: u.id, nome: u.nome, foto: u.foto, is_root: u.is_root, cargos: u.cargos, permissoes: [...u.permissoes] };
}

const CINCO_MINUTOS = 5 * 60 * 1000;

// Quem está logado nesta requisição (serve para as páginas e para a conexão em tempo real).
async function usuarioDaRequisicao(req) {
  const token = lerCookie(req);
  if (!token) return null;
  const u = await db.get(`
    SELECT u.id, u.nome, u.foto, u.is_root, u.ativo, u.ultimo_acesso FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_em > datetime('now') AND u.ativo = 1`, sha(token));
  if (!u) return null;
  return { usuario: montarUsuario(u, await db.all(SQL_CARGOS, u.id)), token, ultimoAcesso: u.ultimo_acesso };
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
  if (!perms.every(p => req.usuario.permissoes.has(p))) throw erro(403, 'Você não tem permissão para isso.');
}

const exigirLogin = (req, res, next) => next(req.usuario ? undefined : erro(401, 'Faça login para continuar.'));

const exigir = (...perms) => (req, res, next) => {
  try { checar(req, ...perms); next(); } catch (e) { next(e); }
};

module.exports = {
  criarSessao, encerrarSessao, comandoDerrubarSessoes, carregarUsuario, montarUsuario, perfil,
  sessao, usuarioDaRequisicao, sessaoAindaValida, pode, checar, exigirLogin, exigir,
};
