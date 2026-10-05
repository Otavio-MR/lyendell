// Notificações no celular/PC: a chave pública, ativar e desativar num aparelho, escolher o que receber e testar.
const express = require('express');
const { db } = require('../db');
const { exigirLogin } = require('../auth');
const notif = require('../notificacoes');
const { erro } = require('../util');

const r = express.Router();
r.use(exigirLogin);

// O que o site precisa para ativar: a chave pública, os tipos e o que já está ativo neste aparelho.
r.get('/', async (req, res) => {
  const endpoint = String(req.query.endpoint || '');
  const minha = endpoint ? await db.get('SELECT tipos FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?', endpoint, req.usuario.id) : null;
  res.json({
    ativo: notif.ativo(),
    chave: notif.chaves.publica,
    tipos: Object.entries(notif.TIPOS).filter(([, t]) => req.usuario.permissoes.has(t.perm)).map(([id, t]) => ({ id, nome: t.nome })),
    inscrito: !!minha,
    escolhidos: minha ? notif.tiposValidos(JSON.parse(minha.tipos || 'null')) : notif.PADRAO,
    aparelhos: (await db.get('SELECT COUNT(*) AS n FROM push_inscricoes WHERE usuario_id = ?', req.usuario.id)).n,
  });
});

r.post('/inscrever', async (req, res) => {
  if (!notif.ativo()) throw erro(503, 'As notificações ainda não foram ligadas no servidor.');
  if (!await notif.inscrever(req.usuario.id, req.body?.inscricao, req.body?.tipos)) throw erro(400, 'Este navegador mandou uma inscrição inválida.');
  res.status(201).json({ ok: true });
});

r.put('/tipos', async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  await db.run('UPDATE push_inscricoes SET tipos = ? WHERE endpoint = ? AND usuario_id = ?', JSON.stringify(notif.tiposValidos(req.body?.tipos)), endpoint, req.usuario.id);
  res.json({ ok: true });
});

r.post('/sair', async (req, res) => {
  await db.run('DELETE FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?', String(req.body?.endpoint || ''), req.usuario.id);
  res.json({ ok: true });
});

// Manda um aviso de teste só para este aparelho.
r.post('/teste', async (req, res) => {
  const insc = await db.get('SELECT * FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?', String(req.body?.endpoint || ''), req.usuario.id);
  if (!insc) throw erro(404, 'Ative as notificações neste aparelho primeiro.');
  const ok = await notif.enviarUma(insc, { tipo: 'teste', titulo: 'Casa Luckham', corpo: 'Pronto! Os avisos de Lyendell vão chegar assim.', url: '/#/', icone: '/img/brasao.png' });
  if (!ok) throw erro(502, 'O aviso não saiu. Tente desativar e ativar de novo.');
  res.json({ ok: true });
});

// Só para os testes automáticos (NOTIFICACOES_TESTE=1): o que teria sido enviado.
if (process.env.NOTIFICACOES_TESTE === '1') r.get('/_enviados', (req, res) => res.json(notif.enviadosTeste));

module.exports = r;
