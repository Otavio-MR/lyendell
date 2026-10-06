// Propostas do povo: qualquer morador manda uma ideia de lei, PEC, emenda, regra... para o Congresso.
// A Senadora (quem tem "congresso.aprovar") avalia: inviável (com o motivo) ou viável, e aí ela vai para a pauta.
// Depois da sessão do Congresso, ela registra a votação (aprovada, rejeitada ou adiada) e pode publicar a
// aprovada no livro do Congresso. Todo mundo acompanha o andamento, e quem propôs é avisado a cada passo.

const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const progresso = require('../progresso');
const { paraCriancas } = require('../censura');
const { erro, texto, idDaRota, dataValida } = require('../util');

const r = express.Router();
r.use(exigirLogin, exigir('congresso.ver'));

const TIPOS = ['Lei', 'PEC', 'Emenda', 'Regra', 'Decreto', 'Resolução', 'Outro'];
const SITUACOES = ['enviada', 'em_pauta', 'aprovada', 'rejeitada', 'inviavel'];
const ABERTAS_POR_PESSOA = 3; // propostas esperando a Senadora ao mesmo tempo
const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

async function buscar(id) {
  const p = await db.get('SELECT * FROM propostas WHERE id = ?', id);
  if (!p) throw erro(404, 'Proposta não encontrada.');
  return p;
}

function ler(body) {
  const p = {
    tipo: TIPOS.includes(body?.tipo) ? body.tipo : null,
    titulo: texto(body?.titulo, 200).replace(/\s+/g, ' '),
    // Sem limite de tamanho: a proposta pode ser uma lei inteira, artigo por artigo.
    resumo: texto(body?.resumo, Infinity),
    texto: texto(body?.texto, Infinity),
    justificativa: texto(body?.justificativa, Infinity),
  };
  if (!p.tipo) throw erro(400, 'Escolha o tipo da proposta (lei, PEC, regra...).');
  if (p.titulo.length < 3) throw erro(400, 'Dê um título para a proposta.');
  if (p.resumo.length < 10) throw erro(400, 'Explique em poucas palavras o que a proposta muda.');
  return p;
}

// Quem vai ver: a criança lê sem palavrão; cada um sabe se já apoiou.
function formatar(req, p, apoios, meus, registros) {
  const limpo = req.usuario.crianca ? paraCriancas : x => x;
  const publicada = p.registro_id && registros.has(p.registro_id) ? { livro_id: p.livro_id, registro_id: p.registro_id } : null;
  return {
    id: p.id, tipo: p.tipo, situacao: p.situacao,
    titulo: limpo(p.titulo), resumo: limpo(p.resumo), texto: limpo(p.texto), justificativa: limpo(p.justificativa),
    autor_id: p.autor_id, autor_nome: p.autor_nome, foto: p.foto || null, moldura: p.moldura || null,
    parecer: p.parecer ? limpo(p.parecer) : null, parecer_nome: p.parecer_nome,
    votacao: p.votacao, a_favor: p.a_favor, contra: p.contra, abstencoes: p.abstencoes, resultado: p.resultado ? limpo(p.resultado) : null,
    historico: JSON.parse(p.historico || '[]'), criado_em: p.criado_em, atualizado_em: p.atualizado_em,
    apoios: apoios.get(p.id) || 0, apoiei: meus.has(p.id), publicada,
  };
}

// Quem avalia as propostas (o cargo da Senadora): recebe o aviso de proposta nova na hora.
async function avaliadores() {
  const linhas = await db.all(`SELECT DISTINCT uc.usuario_id AS id FROM usuario_cargos uc JOIN cargos c ON c.id = uc.cargo_id
    JOIN usuarios u ON u.id = uc.usuario_id WHERE u.ativo = 1 AND c.permissoes LIKE '%"congresso.aprovar"%'`);
  return linhas.map(l => l.id);
}
const avisar = (id, textoAviso) => id && progresso.avisar(id, [{ tipo: 'proposta', texto: textoAviso }]);
const aspas = p => `"${p.titulo}"`;

function registrarPasso(p, acao, por, extra = {}) {
  const historico = JSON.parse(p.historico || '[]');
  historico.push({ acao, em: agora(), por, ...extra });
  return JSON.stringify(historico.slice(-30));
}

r.get('/', async (req, res) => {
  const [lista, apoiosLinhas, meusLinhas] = await Promise.all([
    db.all(`SELECT p.*, u.foto, u.moldura FROM propostas p LEFT JOIN usuarios u ON u.id = p.autor_id ORDER BY p.id DESC LIMIT 400`),
    db.all('SELECT proposta_id, COUNT(*) AS n FROM proposta_apoios GROUP BY proposta_id'),
    db.all('SELECT proposta_id FROM proposta_apoios WHERE usuario_id = ?', req.usuario.id),
  ]);
  const ids = lista.filter(p => p.registro_id).map(p => p.registro_id);
  const registros = new Set(ids.length
    ? (await db.all(`SELECT id FROM registros WHERE situacao = 'aprovado' AND id IN (${ids.map(() => '?').join(', ')})`, ...ids)).map(x => x.id) : []);
  const apoios = new Map(apoiosLinhas.map(a => [a.proposta_id, Number(a.n)]));
  const meus = new Set(meusLinhas.map(m => m.proposta_id));
  const propostas = lista.map(p => formatar(req, p, apoios, meus, registros));
  const contagem = Object.fromEntries(SITUACOES.map(s => [s, propostas.filter(p => p.situacao === s).length]));
  contagem.minhas = propostas.filter(p => p.autor_id === req.usuario.id).length;
  res.json({
    propostas, contagem, tipos: TIPOS, limite: ABERTAS_POR_PESSOA,
    pode: { propor: pode(req, 'congresso.propor'), avaliar: pode(req, 'congresso.aprovar') },
  });
});

// Mandar uma proposta.
r.post('/', exigir('congresso.propor'), async (req, res) => {
  const p = ler(req.body);
  const { n } = await db.get("SELECT COUNT(*) AS n FROM propostas WHERE autor_id = ? AND situacao = 'enviada'", req.usuario.id);
  if (n >= ABERTAS_POR_PESSOA) throw erro(429, `Você já tem ${n} propostas esperando a Senadora. Espere ela avaliar alguma antes de mandar outra.`);
  const historico = JSON.stringify([{ acao: 'enviada', em: agora(), por: req.usuario.nome }]);
  const { id } = await db.run(`INSERT INTO propostas (tipo, titulo, resumo, texto, justificativa, autor_id, autor_nome, historico)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, p.tipo, p.titulo, p.resumo, p.texto, p.justificativa, req.usuario.id, req.usuario.nome, historico);
  await anotar(req, 'Mandou uma proposta ao Congresso', `${p.tipo}: ${p.titulo}`);
  await progresso.registrar(req.usuario.id, 'proposta');
  for (const quem of await avaliadores()) {
    if (quem !== req.usuario.id) avisar(quem, `Proposta nova do povo: ${p.tipo} "${p.titulo}", de ${req.usuario.nome}.`);
  }
  require('../notificacoes').avisar('propostas', { titulo: `Proposta nova: ${p.titulo}`, corpo: `${req.usuario.nome} mandou ${p.tipo} para o Congresso avaliar.`, url: '/#/congresso/propostas', tag: `proposta-${id}` },
    { exceto: req.usuario.id, perm: 'congresso.aprovar' });
  res.status(201).json({ id });
});

// Quem propôs corrige enquanto a Senadora ainda não avaliou.
r.put('/:id', async (req, res) => {
  const p = await buscar(idDaRota(req));
  if (p.autor_id !== req.usuario.id) throw erro(403, 'Só quem mandou a proposta pode mudar o texto dela.');
  if (p.situacao !== 'enviada') throw erro(409, 'A Senadora já avaliou esta proposta; ela não muda mais.');
  const n = ler(req.body);
  await db.run(`UPDATE propostas SET tipo = ?, titulo = ?, resumo = ?, texto = ?, justificativa = ?, atualizado_em = datetime('now') WHERE id = ?`,
    n.tipo, n.titulo, n.resumo, n.texto, n.justificativa, p.id);
  res.json({ ok: true });
});

// Quem propôs retira (antes da avaliação); a Senadora pode apagar qualquer uma (ex.: brincadeira ou repetida).
r.delete('/:id', async (req, res) => {
  const p = await buscar(idDaRota(req));
  const autor = p.autor_id === req.usuario.id && p.situacao === 'enviada';
  if (!autor && !pode(req, 'congresso.aprovar')) throw erro(403, 'Você só pode retirar uma proposta sua que ainda não foi avaliada.');
  await db.lote([['DELETE FROM proposta_apoios WHERE proposta_id = ?', p.id], ['DELETE FROM propostas WHERE id = ?', p.id]]);
  await anotar(req, autor ? 'Retirou uma proposta do Congresso' : 'Apagou uma proposta do Congresso', `${p.tipo}: ${p.titulo} (de ${p.autor_nome})`);
  res.json({ ok: true });
});

// Apoiar (ou deixar de apoiar) a proposta de outra pessoa: a Senadora vê quais o povo mais quer.
r.post('/:id/apoio', exigir('congresso.propor'), async (req, res) => {
  const p = await buscar(idDaRota(req));
  if (p.autor_id === req.usuario.id) throw erro(400, 'Não dá para apoiar a própria proposta.');
  if (!['enviada', 'em_pauta'].includes(p.situacao)) throw erro(409, 'Esta proposta já foi decidida.');
  const ja = await db.get('SELECT 1 AS x FROM proposta_apoios WHERE proposta_id = ? AND usuario_id = ?', p.id, req.usuario.id);
  if (ja) await db.run('DELETE FROM proposta_apoios WHERE proposta_id = ? AND usuario_id = ?', p.id, req.usuario.id);
  else await db.run('INSERT INTO proposta_apoios (proposta_id, usuario_id) VALUES (?, ?)', p.id, req.usuario.id);
  const { n } = await db.get('SELECT COUNT(*) AS n FROM proposta_apoios WHERE proposta_id = ?', p.id);
  res.json({ apoiei: !ja, apoios: Number(n) });
});

// A Senadora avalia: viável (vai para a pauta do Congresso) ou inviável (com o motivo).
r.post('/:id/avaliar', exigir('congresso.aprovar'), async (req, res) => {
  const p = await buscar(idDaRota(req));
  if (!['enviada', 'inviavel', 'em_pauta'].includes(p.situacao)) throw erro(409, 'Esta proposta já foi votada. Para mudar, corrija a votação.');
  const viavel = !!req.body?.viavel;
  const parecer = texto(req.body?.parecer, Infinity);
  if (!viavel && parecer.length < 5) throw erro(400, 'Explique por que a proposta é inviável (quem propôs vai ler).');
  const situacao = viavel ? 'em_pauta' : 'inviavel';
  const historico = registrarPasso(p, situacao, req.usuario.nome, parecer ? { texto: parecer } : {});
  await db.run(`UPDATE propostas SET situacao = ?, parecer = ?, parecer_nome = ?, historico = ?, atualizado_em = datetime('now') WHERE id = ?`,
    situacao, parecer || null, req.usuario.nome, historico, p.id);
  await anotar(req, viavel ? 'Levou uma proposta do povo para a pauta do Congresso' : 'Achou uma proposta do povo inviável', `${p.tipo}: ${p.titulo} (de ${p.autor_nome})`);
  await progresso.registrar(req.usuario.id, 'proposta_avaliada');
  if (p.autor_id !== req.usuario.id) {
    avisar(p.autor_id, viavel ? `Boa notícia: a Senadora levou a sua proposta ${aspas(p)} para a pauta do Congresso!`
      : `A Senadora achou a sua proposta ${aspas(p)} inviável. Veja o motivo nas Propostas do povo.`);
    require('../notificacoes').avisar('meus_envios', {
      titulo: viavel ? `Sua proposta vai para a pauta: ${p.titulo}` : `Sua proposta foi achada inviável: ${p.titulo}`,
      corpo: viavel ? 'A Senadora levou a sua proposta para o Congresso votar.' : 'Veja o motivo nas Propostas do povo.',
      url: '/#/congresso/propostas', tag: `proposta-${p.id}`,
    }, { para: [p.autor_id] });
  }
  res.json({ ok: true, situacao });
});

// Depois da sessão: o resultado da votação no Congresso (adiada continua na pauta).
const RESULTADOS = { aprovada: 'aprovada', rejeitada: 'rejeitada', adiada: 'em_pauta' };
const votos = v => (v === '' || v == null ? null : Math.max(0, Math.min(999, Math.floor(Number(v) || 0))));
r.post('/:id/decidir', exigir('congresso.aprovar'), async (req, res) => {
  const p = await buscar(idDaRota(req));
  if (!['em_pauta', 'aprovada', 'rejeitada'].includes(p.situacao)) throw erro(409, 'Primeiro a proposta precisa ser levada para a pauta do Congresso.');
  const resultado = String(req.body?.resultado || '');
  if (!RESULTADOS[resultado]) throw erro(400, 'Escolha o resultado: aprovada, rejeitada ou adiada.');
  const votacao = req.body?.votacao ? dataValida(req.body.votacao) : null;
  if (req.body?.votacao && !votacao) throw erro(400, 'Data da votação inválida.');
  const observacao = texto(req.body?.observacao, Infinity);
  const [aFavor, contra, abst] = [votos(req.body?.a_favor), votos(req.body?.contra), votos(req.body?.abstencoes)];
  const situacao = RESULTADOS[resultado];
  const historico = registrarPasso(p, resultado, req.usuario.nome, {
    ...(votacao ? { votacao } : {}), ...(aFavor != null || contra != null ? { votos: [aFavor ?? 0, contra ?? 0, abst ?? 0] } : {}), ...(observacao ? { texto: observacao } : {}),
  });
  await db.run(`UPDATE propostas SET situacao = ?, votacao = ?, a_favor = ?, contra = ?, abstencoes = ?, resultado = ?, historico = ?, atualizado_em = datetime('now') WHERE id = ?`,
    situacao, votacao, aFavor, contra, abst, observacao || null, historico, p.id);
  await anotar(req, `Registrou a votação de uma proposta do povo: ${resultado}`, `${p.tipo}: ${p.titulo} (de ${p.autor_nome})`);
  await progresso.registrar(req.usuario.id, 'proposta_avaliada');
  if (resultado === 'aprovada' && p.situacao !== 'aprovada') await progresso.registrar(p.autor_id, 'proposta_aprovada');
  if (p.autor_id !== req.usuario.id) {
    avisar(p.autor_id, {
      aprovada: `Sua proposta ${aspas(p)} foi APROVADA no Congresso!`,
      rejeitada: `Sua proposta ${aspas(p)} foi rejeitada no Congresso.`,
      adiada: `A votação da sua proposta ${aspas(p)} foi adiada; ela continua na pauta.`,
    }[resultado]);
    require('../notificacoes').avisar('meus_envios', {
      titulo: { aprovada: `Proposta APROVADA: ${p.titulo}`, rejeitada: `Proposta rejeitada: ${p.titulo}`, adiada: `Votação adiada: ${p.titulo}` }[resultado],
      corpo: { aprovada: 'O Congresso aprovou a sua proposta!', rejeitada: 'O Congresso rejeitou a sua proposta.', adiada: 'Ela continua na pauta do Congresso.' }[resultado],
      url: '/#/congresso/propostas', tag: `proposta-${p.id}`,
    }, { para: [p.autor_id] });
  }
  res.json({ ok: true, situacao });
});

// A proposta aprovada virou registro no livro do Congresso (a Senadora publica pela tela do livro).
r.post('/:id/publicada', exigir('congresso.aprovar'), async (req, res) => {
  const p = await buscar(idDaRota(req));
  if (p.situacao !== 'aprovada') throw erro(409, 'Só a proposta aprovada vai para o livro.');
  const reg = await db.get(`SELECT r.id, r.livro_id FROM registros r JOIN livros l ON l.id = r.livro_id WHERE r.id = ? AND l.modulo = 'congresso'`, Number(req.body?.registro) || 0);
  if (!reg) throw erro(400, 'Esse registro não está nos livros do Congresso.');
  const historico = registrarPasso(p, 'publicada', req.usuario.nome);
  await db.run(`UPDATE propostas SET livro_id = ?, registro_id = ?, historico = ?, atualizado_em = datetime('now') WHERE id = ?`, reg.livro_id, reg.id, historico, p.id);
  avisar(p.autor_id !== req.usuario.id && p.autor_id, `Sua proposta ${aspas(p)} foi publicada no livro do Congresso. Agora é oficial!`);
  res.json({ ok: true });
});

module.exports = r;
