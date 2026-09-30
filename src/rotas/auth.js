const express = require('express');
const { db } = require('../db');
const { hashSenha, verificarSenha, HASH_FALSO, validarSenhaNova } = require('../senhas');
const { criarSessao, encerrarSessao, comandoDerrubarSessoes, carregarUsuario, perfil, exigirLogin } = require('../auth');
const { CATALOGO } = require('../permissoes');
const { anotar } = require('../diario');
const { upload, salvarArquivo, comandoApagarArquivo } = require('../uploads');
const { erro, linha, texto, chaveNome } = require('../util');
const progresso = require('../progresso');

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

r.get('/me', exigirLogin, async (req, res) => {
  await progresso.registrarVisita(req.usuario.id); // primeira visita do dia conta a sequência
  res.json(perfil(req.usuario));
});

r.get('/catalogo', exigirLogin, (req, res) => res.json({ catalogo: CATALOGO }));

// Foto de perfil: qualquer usuário troca a própria (o site já manda recortada e pequena).
r.post('/foto', exigirLogin, upload.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha uma imagem.');
  const url = await salvarArquivo(req.file, req.usuario.id);
  await db.lote([
    ['UPDATE usuarios SET foto = ? WHERE id = ?', url, req.usuario.id],
    req.usuario.foto ? comandoApagarArquivo(req.usuario.foto) : null,
  ]);
  res.json({ foto: url });
});

r.delete('/foto', exigirLogin, async (req, res) => {
  await db.lote([
    ['UPDATE usuarios SET foto = NULL WHERE id = ?', req.usuario.id],
    req.usuario.foto ? comandoApagarArquivo(req.usuario.foto) : null,
  ]);
  res.json({ ok: true });
});

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

/* ─── Perfil personalizável ──────────────────────── */

// Cores de destaque e capas prontas (as capas também podem ser uma imagem enviada).
const CORES = ['#d8b13a', '#7fb069', '#7ea6c9', '#d8674a', '#a98bd4', '#e59ab8', '#5fbfb0', '#e39a4d', '#c8ccd4', '#b08560'];
const CAPAS = [
  { chave: 'floresta', nome: 'Floresta' }, { chave: 'pordosol', nome: 'Pôr do sol' }, { chave: 'noite', nome: 'Noite estrelada' },
  { chave: 'brasa', nome: 'Brasa' }, { chave: 'realeza', nome: 'Realeza' }, { chave: 'lago', nome: 'Lago' },
  { chave: 'neve', nome: 'Neve' }, { chave: 'dourada', nome: 'Dourada' },
];
const NICK_MC = /^[A-Za-z0-9_]{3,16}$/;
const cabecaMc = nick => `https://mc-heads.net/avatar/${nick}/128`;

async function meuPerfil(id) {
  return db.get('SELECT id, nome, foto, titulo_perfil, bio, cor, capa, moldura, mc_nick, emblemas, xp, sequencia, sequencia_max FROM usuarios WHERE id = ?', id);
}

// Dados da tela "Meu perfil": o que dá para escolher e o que a pessoa já liberou.
r.get('/perfil', exigirLogin, async (req, res) => {
  const u = await meuPerfil(req.usuario.id);
  await progresso.conferirConquistas(u.id);
  const conquistas = await progresso.conquistasDe(u.id);
  let emblemas = [];
  try { emblemas = JSON.parse(u.emblemas || '[]'); } catch {}
  res.json({
    perfil: { ...u, emblemas, nivel: progresso.infoNivel(Number(u.xp) || 0) },
    opcoes: { cores: CORES, capas: CAPAS, molduras: progresso.MOLDURAS },
    conquistas,
  });
});

r.put('/perfil', exigirLogin, async (req, res) => {
  const u = await meuPerfil(req.usuario.id);
  const b = req.body || {};
  const nivel = progresso.nivelDe(Number(u.xp) || 0);
  const campos = {};
  if (b.titulo_perfil !== undefined) campos.titulo_perfil = linha(b.titulo_perfil, 60);
  if (b.bio !== undefined) campos.bio = texto(b.bio, 600);
  if (b.cor !== undefined) {
    if (b.cor && !CORES.includes(b.cor)) throw erro(400, 'Cor inválida.');
    campos.cor = b.cor || null;
  }
  const apagar = [];
  if (b.capa !== undefined) {
    if (b.capa && !CAPAS.some(c => c.chave === b.capa)) throw erro(400, 'Capa inválida.');
    campos.capa = b.capa || null;
    if (u.capa && u.capa !== campos.capa) apagar.push(comandoApagarArquivo(u.capa));
  }
  if (b.moldura !== undefined) {
    const m = progresso.MOLDURAS.find(x => x.chave === b.moldura);
    if (!m) throw erro(400, 'Moldura inválida.');
    if (m.nivel > nivel) throw erro(400, `A moldura ${m.nome} libera no nível ${m.nivel}.`);
    campos.moldura = m.chave;
  }
  if (b.mc_nick !== undefined) {
    const nick = String(b.mc_nick || '').trim();
    if (nick && !NICK_MC.test(nick)) throw erro(400, 'Nick do Minecraft inválido (de 3 a 16 letras, números ou _).');
    campos.mc_nick = nick || null;
  }
  if (b.emblemas !== undefined) {
    const ganhas = new Set((await db.all('SELECT chave FROM conquistas_usuario WHERE usuario_id = ?', u.id)).map(c => c.chave));
    const lista = [...new Set(Array.isArray(b.emblemas) ? b.emblemas : [])].filter(c => ganhas.has(c)).slice(0, 3);
    campos.emblemas = JSON.stringify(lista);
  }
  // Usar a cabeça da skin do Minecraft como foto de perfil.
  if (b.foto_mc) {
    const nick = campos.mc_nick ?? u.mc_nick;
    if (!nick) throw erro(400, 'Coloque o seu nick do Minecraft primeiro.');
    campos.foto = cabecaMc(nick);
    if (u.foto) apagar.push(comandoApagarArquivo(u.foto));
  } else if (campos.mc_nick !== undefined && u.foto?.startsWith('https://mc-heads.net/')) {
    campos.foto = campos.mc_nick ? cabecaMc(campos.mc_nick) : null; // trocou ou tirou o nick: a foto acompanha
  }
  const nomes = Object.keys(campos);
  if (nomes.length) {
    await db.lote([
      [`UPDATE usuarios SET ${nomes.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, ...nomes.map(c => campos[c]), u.id],
      ...apagar,
    ]);
  }
  await progresso.registrar(u.id, 'perfil');
  res.json({ ok: true, foto: campos.foto !== undefined ? campos.foto : u.foto });
});

// Capa com imagem própria (o site já manda a imagem reduzida).
r.post('/capa', exigirLogin, upload.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha uma imagem.');
  const u = await meuPerfil(req.usuario.id);
  const url = await salvarArquivo(req.file, u.id);
  await db.lote([['UPDATE usuarios SET capa = ? WHERE id = ?', url, u.id], u.capa ? comandoApagarArquivo(u.capa) : null]);
  res.json({ capa: url });
});

// Meu progresso: nível, sequência de dias, missões de hoje e o que a comunidade conquistou.
r.get('/progresso', exigirLogin, async (req, res) => {
  const u = await meuPerfil(req.usuario.id);
  const [missoes, novidades, semana] = await Promise.all([
    progresso.missoesDe(u.id),
    db.all(`SELECT cu.chave, cu.em, u.id, u.nome, u.foto, u.moldura FROM conquistas_usuario cu JOIN usuarios u ON u.id = cu.usuario_id
      WHERE u.ativo = 1 ORDER BY cu.em DESC, cu.rowid DESC LIMIT 12`),
    db.all(`SELECT u.id, u.nome, u.foto, u.moldura, SUM(e.qtd) AS xp FROM eventos_dia e JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.tipo = 'xp' AND e.dia >= date('now', '-6 days') AND u.ativo = 1 GROUP BY u.id ORDER BY xp DESC LIMIT 5`),
  ]);
  res.json({
    nivel: progresso.infoNivel(Number(u.xp) || 0),
    sequencia: Number(u.sequencia) || 0,
    missoes,
    novidades: novidades.map(n => ({ ...n, conquista: progresso.CONQUISTA[n.chave] ? { nome: progresso.CONQUISTA[n.chave].nome, icone: progresso.CONQUISTA[n.chave].icone } : null })).filter(n => n.conquista),
    semana: semana.map(s => ({ ...s, xp: Number(s.xp) })),
  });
});

module.exports = r;
