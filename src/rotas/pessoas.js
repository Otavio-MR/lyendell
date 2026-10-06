// Comunidade: a lista de quem usa o site, o perfil público de cada um e o mural de recados.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, pode } = require('../auth');
const progresso = require('../progresso');
const { erro, texto, idDaRota } = require('../util');

const { paraCriancas } = require('../censura');

const r = express.Router();
r.use(exigirLogin);

const CAMPOS_PUBLICOS = 'id, nome, foto, is_root, crianca, titulo_perfil, bio, cor, capa, moldura, mc_nick, emblemas, xp, sequencia, sequencia_max, criado_em, ultimo_acesso';

// Cargos de cada pessoa (sem o cargo base, que é de todos).
async function cargosPorUsuario() {
  const linhas = await db.all(`SELECT uc.usuario_id, c.nome, c.cor FROM usuario_cargos uc JOIN cargos c ON c.id = uc.cargo_id
    WHERE c.base = 0 ORDER BY c.ordem, c.id`);
  const mapa = new Map();
  for (const l of linhas) {
    if (!mapa.has(l.usuario_id)) mapa.set(l.usuario_id, []);
    mapa.get(l.usuario_id).push({ nome: l.nome, cor: l.cor });
  }
  return mapa;
}

function publico(u, cargos = []) {
  const nivel = progresso.infoNivel(Number(u.xp) || 0);
  return {
    id: u.id,
    nome: u.nome,
    foto: u.foto || null,
    is_root: !!u.is_root,
    crianca: !!u.crianca,
    titulo_perfil: u.titulo_perfil || '',
    cor: u.cor || null,
    capa: u.capa || null,
    moldura: u.moldura || 'simples',
    mc_nick: u.mc_nick || '',
    cargos: u.is_root ? [{ nome: 'Administrador', cor: '#d8b13a' }, ...cargos] : cargos,
    nivel,
    sequencia: Number(u.sequencia) || 0,
  };
}

r.get('/', async (req, res) => {
  const [lista, cargos] = await Promise.all([
    db.all(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE ativo = 1 ORDER BY xp DESC, chave`),
    cargosPorUsuario(),
  ]);
  const semana = Object.fromEntries((await db.all(`SELECT usuario_id, SUM(qtd) AS xp FROM eventos_dia
    WHERE tipo = 'xp' AND dia >= date('now', '-6 days') GROUP BY usuario_id`)).map(x => [x.usuario_id, Number(x.xp)]));
  res.json({ pessoas: lista.map(u => ({ ...publico(u, cargos.get(u.id)), xpSemana: semana[u.id] || 0 })) });
});

async function buscarPessoa(req, id = idDaRota(req)) {
  const u = await db.get(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ? AND ativo = 1`, id);
  if (!u) throw erro(404, 'Essa pessoa não foi encontrada.');
  return u;
}

r.get('/:id', async (req, res) => {
  const u = await buscarPessoa(req);
  // Quem abre o próprio perfil já recebe as conquistas que alcançou antes delas existirem.
  if (u.id === req.usuario.id) await progresso.conferirConquistas(u.id);
  const [cargos, conquistas, recados, jogos, contagem] = await Promise.all([
    cargosPorUsuario(),
    progresso.conquistasDe(u.id),
    db.get('SELECT COUNT(*) AS n FROM recados WHERE perfil_id = ?', u.id),
    db.get(`SELECT
      (SELECT MAX(pontos) FROM recordes WHERE jogo = 'pacman' AND usuario_id = ?) AS pacman,
      (SELECT MAX(pontos) FROM recordes WHERE jogo = 'cobrinha' AND usuario_id = ?) AS cobrinha,
      (SELECT COUNT(*) FROM quiz_resultados WHERE usuario_id = ?) AS quiz,
      (SELECT SUM(acertos) FROM quiz_resultados WHERE usuario_id = ?) AS acertos,
      (SELECT SUM(qtd) FROM eventos_dia WHERE usuario_id = ? AND tipo = 'chat') AS mensagens`, u.id, u.id, u.id, u.id, u.id),
    progresso.calcular(u.id, ['vitorias', 'partidas']),
  ]);
  let emblemas = [];
  try { emblemas = JSON.parse(u.emblemas || '[]'); } catch {}
  const ganhas = new Set(conquistas.filter(c => c.em).map(c => c.chave));
  res.json({
    pessoa: {
      ...publico(u, cargos.get(u.id)),
      bio: u.bio || '',
      sequencia_max: Number(u.sequencia_max) || 0,
      desde: u.criado_em,
      visto: u.ultimo_acesso,
      emblemas: emblemas.filter(c => ganhas.has(c)),
    },
    conquistas,
    estatisticas: {
      vitorias: contagem.vitorias,
      partidas: contagem.partidas,
      pacman: Number(jogos.pacman) || 0,
      cobrinha: Number(jogos.cobrinha) || 0,
      quiz: Number(jogos.quiz) || 0,
      acertos: Number(jogos.acertos) || 0,
      mensagens: Number(jogos.mensagens) || 0,
      recados: Number(recados.n) || 0,
    },
    molduras: progresso.MOLDURAS,
  });
});

/* ─── Mural de recados ────────────────────────────── */

r.get('/:id/recados', async (req, res) => {
  const u = await buscarPessoa(req);
  const recados = await db.all(`SELECT r.*, a.foto AS autor_foto, a.cor AS autor_cor, a.moldura AS autor_moldura
    FROM recados r LEFT JOIN usuarios a ON a.id = r.autor_id WHERE r.perfil_id = ? ORDER BY r.id DESC LIMIT 60`, u.id);
  // Criança lê os recados sem palavrão.
  res.json({ recados: req.usuario.crianca ? recados.map(x => ({ ...x, texto: paraCriancas(x.texto) })) : recados });
});

const ultimoRecado = new Map(); // anti-flood: um recado a cada 10 segundos por pessoa

r.post('/:id/recados', async (req, res) => {
  const u = await buscarPessoa(req);
  const t = texto(req.body?.texto, 300);
  if (!t) throw erro(400, 'Escreva o recado.');
  if (Date.now() - (ultimoRecado.get(req.usuario.id) || 0) < 10_000) throw erro(429, 'Calma! Espere alguns segundos para mandar outro recado.');
  ultimoRecado.set(req.usuario.id, Date.now());
  const { id } = await db.run('INSERT INTO recados (perfil_id, autor_id, autor_nome, texto) VALUES (?, ?, ?, ?)', u.id, req.usuario.id, req.usuario.nome, t);
  if (u.id !== req.usuario.id) {
    progresso.registrar(req.usuario.id, 'recado');
    // Avisa a dona ou o dono do perfil na hora, se estiver no site.
    progresso.avisar(u.id, [{ tipo: 'recado', de: req.usuario.nome, deId: req.usuario.id, texto: u.crianca ? paraCriancas(t) : t }]);
    require('../notificacoes').avisar('recados', {
      titulo: `Recado de ${req.usuario.nome}`, corpo: (u.crianca ? paraCriancas(t) : t).slice(0, 160), url: `/#/pessoa/${u.id}`, tag: `recado-${id}`,
    }, { para: [u.id] });
  }
  res.status(201).json({ id });
});

r.delete('/recados/:id', async (req, res) => {
  const rec = await db.get('SELECT * FROM recados WHERE id = ?', idDaRota(req));
  if (!rec) throw erro(404, 'Recado não encontrado.');
  const pode_ = rec.autor_id === req.usuario.id || rec.perfil_id === req.usuario.id
    || pode(req, 'usuarios.editar') || pode(req, 'recreacao.moderar');
  if (!pode_) throw erro(403, 'Só quem escreveu, o dono do perfil ou a moderação apagam este recado.');
  await db.run('DELETE FROM recados WHERE id = ?', rec.id);
  res.json({ ok: true });
});

module.exports = r;
