const express = require('express');
const { db } = require('../db');
const { hashSenha, verificarSenha, HASH_FALSO, validarSenhaNova } = require('../senhas');
const { criarSessao, encerrarSessao, comandoDerrubarSessoes, carregarUsuario, perfil, exigirLogin } = require('../auth');
const { CATALOGO } = require('../permissoes');
const { anotar } = require('../diario');
const { erro, linha, chaveNome } = require('../util');

const r = express.Router();

// Trava contra chute de senha: 10 erros em 15 minutos na mesma conta,
// ou 30 erros vindos do mesmo endereço.
const JANELA = 15 * 60 * 1000;
const LIMITES = { conta: 10, ip: 30 };
const tentativas = new Map();

function bloqueado(chave, limite) {
  const t = tentativas.get(chave);
  return !!t && t.ate > Date.now() && t.n >= limite;
}
function falhou(chave) {
  const t = tentativas.get(chave);
  if (!t || t.ate < Date.now()) tentativas.set(chave, { n: 1, ate: Date.now() + JANELA });
  else t.n++;
}
setInterval(() => {
  const agora = Date.now();
  for (const [k, t] of tentativas) if (t.ate < agora) tentativas.delete(k);
}, JANELA).unref();

r.post('/login', async (req, res) => {
  const nome = linha(req.body?.nome, 60);
  const senha = String(req.body?.senha ?? '');
  if (!nome || !senha) throw erro(400, 'Informe o nome do personagem e a senha.');
  const kConta = `conta:${chaveNome(nome)}`;
  const kIp = `ip:${req.ip}`;
  if (bloqueado(kConta, LIMITES.conta) || bloqueado(kIp, LIMITES.ip)) {
    throw erro(429, 'Muitas tentativas erradas. Espere alguns minutos e tente de novo.');
  }

  const u = await db.get('SELECT id, senha_hash, ativo FROM usuarios WHERE chave = ?', chaveNome(nome));
  const ok = await verificarSenha(senha, u ? u.senha_hash : HASH_FALSO);
  if (!u || !ok) {
    falhou(kConta);
    falhou(kIp);
    throw erro(401, 'Nome ou senha incorretos.');
  }
  if (!u.ativo) throw erro(403, 'Este acesso está desativado. Procure a administração da Casa.');

  tentativas.delete(kConta);
  await criarSessao(req, res, u.id);
  req.usuario = await carregarUsuario(u.id);
  await db.run("UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?", u.id);
  await anotar(req, 'Entrou no sistema');
  res.json(perfil(req.usuario));
});

r.post('/logout', async (req, res) => {
  await encerrarSessao(req, res);
  res.json({ ok: true });
});

r.get('/me', exigirLogin, (req, res) => res.json(perfil(req.usuario)));

r.get('/catalogo', exigirLogin, (req, res) => res.json({ catalogo: CATALOGO }));

r.post('/senha', exigirLogin, async (req, res) => {
  const atual = String(req.body?.atual ?? '');
  const nova = String(req.body?.nova ?? '');
  const u = await db.get('SELECT senha_hash FROM usuarios WHERE id = ?', req.usuario.id);
  if (!await verificarSenha(atual, u.senha_hash)) throw erro(400, 'A senha atual está incorreta.');
  const problema = validarSenhaNova(nova);
  if (problema) throw erro(400, problema);
  await db.lote([
    ['UPDATE usuarios SET senha_hash = ? WHERE id = ?', await hashSenha(nova), req.usuario.id],
    comandoDerrubarSessoes(req.usuario.id, req.tokenSessao),
  ]);
  await anotar(req, 'Trocou a própria senha');
  res.json({ ok: true });
});

module.exports = r;
