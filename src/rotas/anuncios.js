const express = require('express');
const { db } = require('../db');
const { exigir, exigirLogin, pode, checar, soAliados } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { erro, linha, texto, idDaRota } = require('../util');
const discord = require('../discord');

const IMPORTANCIAS = ['comum', 'importante', 'urgente'];

const r = express.Router();
r.use(exigirLogin);

const podeMexer = (req, a) => pode(req, 'anuncios.moderar') || (a.autor_id === req.usuario.id && pode(req, 'anuncios.publicar'));

function ler(req, atual = {}) {
  const titulo = linha(req.body?.titulo ?? atual.titulo, 120);
  if (!titulo) throw erro(400, 'Dê um título ao anúncio.');
  const conteudo = texto(req.body?.conteudo ?? atual.conteudo, 5000);
  const importancia = IMPORTANCIAS.includes(req.body?.importancia) ? req.body.importancia : (atual.importancia || 'comum');
  const imagem = req.body?.imagem !== undefined ? (urlValida(req.body.imagem) ? req.body.imagem : null) : (atual.imagem ?? null);
  // "Visível para Convidados e Aliados": os Aliados (que não são moradores) também leem este anúncio.
  const aliados = req.body?.aliados !== undefined ? (req.body.aliados ? 1 : 0) : (atual.aliados ? 1 : 0);
  // Discord: quem marcar (@Moradores, @Aliados, @everyone...). Marcar o servidor todo é só para quem modera.
  const discordMarcar = Object.hasOwn(discord.MARCAR, String(req.body?.discord_marcar)) ? req.body.discord_marcar : (atual.discord_marcar || discord.marcarPadrao(aliados));
  if (discordMarcar === 'todos' && atual.discord_marcar !== 'todos' && !pode(req, 'anuncios.moderar')) throw erro(403, 'Só quem modera o mural pode marcar @everyone no Discord.');
  return { titulo, conteudo, importancia, imagem, aliados, discordMarcar };
}

// Aviso para os Aliados quando um anúncio passa a ser visível para eles.
function avisarAliados(req, id, a) {
  require('../notificacoes').avisar('aliados', {
    titulo: `${a.importancia === 'urgente' ? 'URGENTE: ' : ''}${a.titulo}`, corpo: `${req.usuario.nome} no Mural de Anúncios: ${a.conteudo.slice(0, 140)}`,
    url: '/#/anuncios', tag: `anuncio-${id}`,
  }, { exceto: req.usuario.id, perm: 'aliados.ver', semPerm: 'anuncios.ver' });
}

// Quem lê os anúncios vê todos; os Aliados, só os marcados para Convidados e Aliados.
r.get('/', async (req, res) => {
  const soMarcados = soAliados(req, 'anuncios.ver');
  if (!soMarcados) checar(req, 'anuncios.ver');
  const lista = await db.all(`
    SELECT a.*, u.foto AS autor_foto FROM anuncios a LEFT JOIN usuarios u ON u.id = a.autor_id
    ${soMarcados ? 'WHERE a.aliados = 1' : ''} ORDER BY a.fixado DESC, a.id DESC LIMIT 200`);
  res.json({
    anuncios: lista.map(({ discord_msg, ...a }) => ({ ...a, fixado: !!a.fixado, aliados: !!a.aliados, podeMexer: podeMexer(req, a), noDiscord: !!discord_msg })),
    // O formulário mostra o "Avisar no Discord" só quando o webhook está configurado.
    discord: pode(req, 'anuncios.publicar') ? discord.opcoesParaOSite() : null,
  });
});

r.post('/', exigir('anuncios.publicar'), async (req, res) => {
  const a = ler(req);
  const fixado = req.body?.fixado && pode(req, 'anuncios.moderar') ? 1 : 0;
  const { id } = await db.run('INSERT INTO anuncios (titulo, conteudo, importancia, imagem, fixado, autor_id, autor_nome, aliados, discord_marcar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    a.titulo, a.conteudo, a.importancia, a.imagem, fixado, req.usuario.id, req.usuario.nome, a.aliados, a.discordMarcar);
  discord.sincronizar(id); // vai para o canal do Discord (sem esperar)
  await anotar(req, 'Publicou um anúncio', a.titulo);
  await progresso.registrar(req.usuario.id, 'anuncio');
  require('../notificacoes').avisar('anuncios', {
    titulo: `${a.importancia === 'urgente' ? 'URGENTE: ' : ''}${a.titulo}`, corpo: `${req.usuario.nome} no Mural de Anúncios: ${a.conteudo.slice(0, 140)}`,
    url: '/#/anuncios', tag: `anuncio-${id}`,
  }, { exceto: req.usuario.id });
  if (a.aliados) avisarAliados(req, id, a);
  res.status(201).json({ id });
});

async function buscar(req) {
  const a = await db.get('SELECT * FROM anuncios WHERE id = ?', idDaRota(req));
  if (!a) throw erro(404, 'Anúncio não encontrado.');
  return a;
}

r.put('/:id', async (req, res) => {
  const atual = await buscar(req);
  if (!podeMexer(req, atual)) checar(req, 'anuncios.moderar');
  const a = ler(req, atual);
  await db.lote([
    ["UPDATE anuncios SET titulo = ?, conteudo = ?, importancia = ?, imagem = ?, aliados = ?, discord_marcar = ?, editado_em = datetime('now') WHERE id = ?",
      a.titulo, a.conteudo, a.importancia, a.imagem, a.aliados, a.discordMarcar, atual.id],
    atual.imagem && atual.imagem !== a.imagem ? comandoApagarArquivo(atual.imagem) : null,
  ]);
  await anotar(req, 'Editou um anúncio', a.titulo);
  if (a.aliados && !atual.aliados) avisarAliados(req, atual.id, a); // acabou de ser aberto para os Aliados
  discord.sincronizar(atual.id); // a mensagem no Discord muda junto (ou sai, se escolheram não mandar)
  res.json({ ok: true });
});

r.post('/:id/fixar', exigir('anuncios.moderar'), async (req, res) => {
  const a = await buscar(req);
  const fixado = req.body?.fixado ? 1 : 0;
  await db.run('UPDATE anuncios SET fixado = ? WHERE id = ?', fixado, a.id);
  await anotar(req, fixado ? 'Fixou um anúncio' : 'Desafixou um anúncio', a.titulo);
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  const a = await buscar(req);
  if (!podeMexer(req, a)) checar(req, 'anuncios.moderar');
  await db.lote([['DELETE FROM anuncios WHERE id = ?', a.id], comandoApagarArquivo(a.imagem)]);
  discord.apagar(a.discord_msg);
  await anotar(req, 'Apagou um anúncio', a.titulo);
  res.json({ ok: true });
});

module.exports = r;
