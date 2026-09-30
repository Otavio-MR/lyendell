const crypto = require('crypto');
const multer = require('multer');
const { db } = require('./db');
const { erro } = require('./util');

// As imagens ficam dentro do próprio banco (tabela "arquivos"), porque a hospedagem
// grátis apaga os arquivos do disco a cada reinício. O site diminui as fotos antes de enviar.
const TIPOS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
// Músicas da trilha sonora.
const TIPOS_AUDIO = {
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg', 'audio/opus': '.opus', 'audio/webm': '.webm',
  'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.m4a',
};
const TAMANHO_MAX_MB = 8;
const PADRAO_NOME = /^[a-f0-9]{24}\.(?:png|jpg|gif|webp|mp3|ogg|opus|webm|m4a)$/;
const PADRAO_URL = /^\/uploads\/([a-f0-9]{24}\.(?:png|jpg|gif|webp|mp3|ogg|opus|webm|m4a))$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => (TIPOS[file.mimetype]
    ? cb(null, true)
    : cb(erro(400, 'Envie uma imagem PNG, JPG, GIF ou WEBP.'))),
});

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => (TIPOS_AUDIO[file.mimetype]
    ? cb(null, true)
    : cb(erro(400, 'Envie uma música em MP3, OGG, M4A ou WEBM.'))),
});

async function salvarArquivo(file, usuarioId) {
  const nome = crypto.randomBytes(12).toString('hex') + (TIPOS[file.mimetype] || TIPOS_AUDIO[file.mimetype]);
  await db.run('INSERT INTO arquivos (nome, tipo, tamanho, dados, enviado_por) VALUES (?, ?, ?, ?, ?)',
    nome, file.mimetype, file.size, file.buffer, usuarioId ?? null);
  return `/uploads/${nome}`;
}

// Campos de imagem (anúncios, registros) só aceitam imagens.
const urlValida = url => typeof url === 'string' && /^\/uploads\/[a-f0-9]{24}\.(?:png|jpg|gif|webp)$/.test(url);

// Comando para apagar o arquivo de uma URL /uploads/... (para usar dentro de db.lote).
function comandoApagarArquivo(url) {
  const m = typeof url === 'string' && PADRAO_URL.exec(url);
  if (m && cacheAudio.has(m[1])) {
    cacheAudioTamanho -= cacheAudio.get(m[1]).buf.length;
    cacheAudio.delete(m[1]);
  }
  return m ? ['DELETE FROM arquivos WHERE nome = ?', m[1]] : null;
}

// As músicas mais tocadas ficam guardadas na memória (o navegador pede cada música em pedaços).
const cacheAudio = new Map();
const CACHE_AUDIO_MAX = 40 * 1024 * 1024;
let cacheAudioTamanho = 0;
function guardarAudio(nome, a) {
  cacheAudio.set(nome, a);
  cacheAudioTamanho += a.buf.length;
  for (const [k, v] of cacheAudio) {
    if (cacheAudioTamanho <= CACHE_AUDIO_MAX) break;
    cacheAudio.delete(k);
    cacheAudioTamanho -= v.buf.length;
  }
}

async function servirArquivo(req, res) {
  const nome = req.params.nome;
  if (!PADRAO_NOME.test(nome)) throw erro(404, 'Arquivo não encontrado.');
  let a = cacheAudio.get(nome);
  if (!a) {
    const linha = await db.get('SELECT tipo, dados FROM arquivos WHERE nome = ?', nome);
    if (!linha) throw erro(404, 'Arquivo não encontrado.');
    a = { tipo: linha.tipo, buf: Buffer.from(linha.dados) };
    if (a.tipo.startsWith('audio/')) guardarAudio(nome, a);
  }
  res.set({ 'Content-Type': a.tipo, 'Cache-Control': 'private, max-age=31536000, immutable', 'Accept-Ranges': 'bytes' });
  // Pedaço do arquivo (o player de música pede assim para poder avançar e voltar).
  const pedaco = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (pedaco && (pedaco[1] || pedaco[2])) {
    const total = a.buf.length;
    let ini = pedaco[1] ? Number(pedaco[1]) : Math.max(0, total - Number(pedaco[2]));
    let fim = pedaco[1] && pedaco[2] ? Math.min(Number(pedaco[2]), total - 1) : total - 1;
    if (ini >= total || ini > fim) {
      res.status(416).set('Content-Range', `bytes */${total}`).end();
      return;
    }
    res.status(206).set('Content-Range', `bytes ${ini}-${fim}/${total}`);
    res.send(a.buf.subarray(ini, fim + 1));
    return;
  }
  res.send(a.buf);
}

module.exports = { upload, uploadAudio, salvarArquivo, urlValida, comandoApagarArquivo, servirArquivo, TAMANHO_MAX_MB };
