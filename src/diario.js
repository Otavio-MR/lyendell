const { db } = require('./db');

// Registra no diário quem fez o quê. Serve para a administração acompanhar o sistema.
async function anotar(req, acao, detalhe = '') {
  await db.run('INSERT INTO diario (usuario_id, usuario_nome, acao, detalhe) VALUES (?, ?, ?, ?)',
    req.usuario?.id ?? null, req.usuario?.nome ?? '', acao, String(detalhe).slice(0, 300));
}

module.exports = { anotar };
