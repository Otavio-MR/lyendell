const crypto = require('crypto');
const multer = require('multer');
const { db } = require('./db');
const { erro } = require('./util');

// As imagens ficam dentro do próprio banco (tabela "arquivos"), porque a hospedagem
// grátis apaga os arquivos do disco a cada reinício. O site diminui as fotos antes de enviar.
const TIPOS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
const TAMANHO_MAX_MB = 8;
const PADRAO_NOME = /^[a-f0-9]{24}\.(?:png|jpg|gif|webp)$/;
const PADRAO_URL = /^\/uploads\/([a-f0-9]{24}\.(?:png|jpg|gif|webp))$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => (TIPOS[file.mimetype]
    ? cb(null, true)
    : cb(erro(400, 'Envie uma imagem PNG, JPG, GIF ou WEBP.'))),
});

async function salvarArquivo(file, usuarioId) {
  const nome = crypto.randomBytes(12).toString('hex') + TIPOS[file.mimetype];
  await db.run('INSERT INTO arquivos (nome, tipo, tamanho, dados, enviado_por) VALUES (?, ?, ?, ?, ?)',
    nome, file.mimetype, file.size, file.buffer, usuarioId ?? null);
  return `/uploads/${nome}`;
}

const urlValida = url => typeof url === 'string' && PADRAO_URL.test(url);

// Comando para apagar a imagem de uma URL /uploads/... (para usar dentro de db.lote).
function comandoApagarArquivo(url) {
  const m = typeof url === 'string' && PADRAO_URL.exec(url);
  return m ? ['DELETE FROM arquivos WHERE nome = ?', m[1]] : null;
}

async function servirArquivo(req, res) {
  const nome = req.params.nome;
  if (!PADRAO_NOME.test(nome)) throw erro(404, 'Imagem não encontrada.');
  const a = await db.get('SELECT tipo, dados FROM arquivos WHERE nome = ?', nome);
  if (!a) throw erro(404, 'Imagem não encontrada.');
  res.set({ 'Content-Type': a.tipo, 'Cache-Control': 'private, max-age=31536000, immutable' });
  res.send(Buffer.from(a.dados));
}

module.exports = { upload, salvarArquivo, urlValida, comandoApagarArquivo, servirArquivo, TAMANHO_MAX_MB };
