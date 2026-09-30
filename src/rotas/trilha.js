// Trilha sonora do site: músicas enviadas (MP3...), links diretos de áudio e playlists do Spotify ou do YouTube.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { uploadAudio, salvarArquivo, comandoApagarArquivo } = require('../uploads');
const { erro, linha, idDaRota } = require('../util');

const r = express.Router();
r.use(exigirLogin);
const gerenciar = exigir('trilha.gerenciar');

// Reconhece o link e guarda só o que o player precisa.
function lerLink(bruto) {
  const texto = String(bruto || '').trim();
  const spotifyUri = /^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]{10,40})$/.exec(texto);
  if (spotifyUri) return { tipo: 'spotify', url: `${spotifyUri[1]}/${spotifyUri[2]}` };
  let u;
  try { u = new URL(texto); } catch { throw erro(400, 'Cole um link completo, começando com https://'); }
  if (u.protocol !== 'https:') throw erro(400, 'O link precisa começar com https://');
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'open.spotify.com') {
    const m = /^\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{10,40})/.exec(u.pathname);
    if (!m) throw erro(400, 'Esse link do Spotify não é de uma playlist, álbum ou música.');
    return { tipo: 'spotify', url: `${m[1]}/${m[2]}` };
  }
  if (['youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    const lista = u.searchParams.get('list');
    let video = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
    const outro = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
    if (!video && outro) video = outro[1];
    if (lista && /^[A-Za-z0-9_-]{10,64}$/.test(lista)) return { tipo: 'youtube', url: `list:${lista}` };
    if (video && /^[A-Za-z0-9_-]{11}$/.test(video)) return { tipo: 'youtube', url: `v:${video}` };
    throw erro(400, 'Não reconheci esse link do YouTube. Use o link de um vídeo ou de uma playlist.');
  }
  return { tipo: 'link', url: u.href }; // arquivo de áudio em outro site (ex.: archive.org)
}

const lerTextos = b => ({ titulo: linha(b?.titulo, 100), autor: linha(b?.autor, 80), credito: linha(b?.credito, 200) });

r.get('/', async (req, res) => {
  const musicas = await db.all('SELECT id, tipo, titulo, autor, url, credito, ordem, criado_por_nome FROM musicas ORDER BY ordem, id');
  res.json({ musicas, podeGerenciar: pode(req, 'trilha.gerenciar') });
});

const proximaOrdem = async () => Number((await db.get('SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM musicas')).n);

r.post('/arquivo', gerenciar, uploadAudio.single('arquivo'), async (req, res) => {
  if (!req.file) throw erro(400, 'Escolha o arquivo da música.');
  const t = lerTextos(req.body);
  const titulo = t.titulo || linha(req.file.originalname.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), 100) || 'Música';
  const url = await salvarArquivo(req.file, req.usuario.id);
  const { id } = await db.run('INSERT INTO musicas (tipo, titulo, autor, url, credito, ordem, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'arquivo', titulo, t.autor, url, t.credito, await proximaOrdem(), req.usuario.nome);
  await anotar(req, 'Adicionou uma música à trilha sonora', titulo);
  res.status(201).json({ id });
});

r.post('/link', gerenciar, async (req, res) => {
  const { tipo, url } = lerLink(req.body?.url);
  const t = lerTextos(req.body);
  const titulo = t.titulo || { spotify: 'Playlist do Spotify', youtube: 'Vídeo do YouTube', link: 'Música' }[tipo];
  const { id } = await db.run('INSERT INTO musicas (tipo, titulo, autor, url, credito, ordem, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
    tipo, titulo, t.autor, url, t.credito, await proximaOrdem(), req.usuario.nome);
  await anotar(req, 'Adicionou um link à trilha sonora', titulo);
  res.status(201).json({ id, tipo });
});

async function buscar(req) {
  const m = await db.get('SELECT * FROM musicas WHERE id = ?', idDaRota(req));
  if (!m) throw erro(404, 'Música não encontrada.');
  return m;
}

r.put('/:id', gerenciar, async (req, res) => {
  const m = await buscar(req);
  const t = lerTextos(req.body);
  await db.run('UPDATE musicas SET titulo = ?, autor = ?, credito = ? WHERE id = ?', t.titulo || m.titulo, t.autor, t.credito, m.id);
  res.json({ ok: true });
});

// Nova ordem: lista com os ids na ordem desejada.
r.post('/ordem', gerenciar, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  await db.lote(ids.map((id, i) => ['UPDATE musicas SET ordem = ? WHERE id = ?', i, id]));
  res.json({ ok: true });
});

r.delete('/:id', gerenciar, async (req, res) => {
  const m = await buscar(req);
  await db.lote([['DELETE FROM musicas WHERE id = ?', m.id], m.tipo === 'arquivo' ? comandoApagarArquivo(m.url) : null]);
  await anotar(req, 'Tirou uma música da trilha sonora', m.titulo);
  res.json({ ok: true });
});

module.exports = r;
