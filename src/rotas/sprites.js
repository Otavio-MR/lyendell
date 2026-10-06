// Sprites dos jogos: quem tem "sprites.editar" troca o desenho de uma peça de um jogo por uma imagem
// (uma tira de quadros lado a lado). Sem imagem, o jogo continua com o desenho feito por código.
// As peças e as animações de cada jogo ficam nos módulos do navegador (o servidor só guarda o que foi enviado).
// Também aqui: o nome de cada peça (que vale em todo lugar onde o nome aparece) e os itens novos do Club Coelho,
// cada um com o seu sprite (roupas "roupa.n12" e móveis "clube.movel-n12").
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { urlValida, comandoApagarArquivo } = require('../uploads');
const { erro } = require('../util');
const nomesSprites = require('../sprites-nomes');
const clube = require('../clube');

const r = express.Router();
r.use(exigirLogin);
const editar = exigir('sprites.editar');

// "jogo.peca" ou "jogo.peca.animacao" (letras minúsculas, números e hífen).
const CHAVE = /^[a-z0-9-]{1,30}(?:\.[a-z0-9-]{1,30}){1,3}$/;
// Só a peça (sem a animação): "coelho", "arena.urso", "roupa.n12"...
const PECA = /^[a-z0-9-]{1,30}(?:\.[a-z0-9-]{1,30}){0,2}$/;
// A peça de um item novo do Club Coelho.
const PECA_ITEM = /^(?:roupa\.|clube\.movel-)n(\d+)$/;
const ehDeItemNovo = chave => /^(?:roupa\.n\d+|clube\.movel-n\d+)(?:\.|$)/.test(chave);
const PRECO_MAX = 5000;
const inteiro = (v, min, max, padrao) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};
const avisar = () => { try { require('../recreacao').paraTodos('sprites', {}); } catch { /* sem conexões ainda */ } };

// Avisa no celular quem também troca os sprites (sem esperar e sem derrubar a rota).
function notificar(req, chave, nome, corpo) {
  try {
    require('../notificacoes').avisar('sprites',
      { titulo: `Sprite trocado: ${nome || chave}`, corpo, url: '/#/recreacao/sprites', tag: `sprite-${chave}` },
      { exceto: req.usuario.id, perm: 'sprites.editar' });
  } catch { /* aviso é bônus */ }
}
// O nome da peça para os avisos: o escolhido, o que o navegador mandou ou a chave.
function nomeParaAviso(chave, b = {}) {
  const peca = chave.split('.').slice(0, -1).join('.') || chave;
  const pedaco = nomesSprites.limparNome(b.nomePeca);
  const nome = nomesSprites.nomeDe(peca, ITEM_POR_PECA()[peca]?.nome || pedaco || peca);
  const anim = nomesSprites.limparNome(b.nomeAnim);
  return anim ? `${nome}: ${anim}` : nome;
}
const ITEM_POR_PECA = () => Object.fromEntries(clube.CATALOGO.filter(i => i.novo).map(i => [i.peca, i]));

// Os itens novos do clube, como a tela de sprites mostra.
const itensNovos = () => clube.CATALOGO.filter(i => i.novo).map(({ id, tipo, nome, preco, ativo, venda, sprite, onde, largura, altura, peca }) => (
  { id, tipo, nome, preco, ativo, venda, sprite, onde, largura, altura, peca }));

r.get('/', async (req, res) => {
  await clube.pronto();
  const linhas = await db.all('SELECT chave, src, quadros, fps, tingir, suave, por_nome, atualizado_em FROM sprites ORDER BY chave');
  const sprites = {};
  for (const l of linhas) sprites[l.chave] = { src: l.src, quadros: l.quadros, fps: l.fps, tingir: !!l.tingir, suave: !!l.suave, por: l.por_nome, em: l.atualizado_em };
  const itens = itensNovos();
  // Os nomes: os que foram trocados e os dos itens novos (que são o próprio nome do item).
  const nomes = { ...nomesSprites.todos(), ...Object.fromEntries(itens.map(i => [i.peca, i.nome])) };
  res.json({ sprites, nomes, itens, podeEditar: pode(req, 'sprites.editar') });
});

/* ─── Nome das peças ─── */

// Muda o nome de uma peça ("" volta ao nome de sempre). Item novo do clube: muda o nome do próprio item.
r.put('/nome/:chave', editar, async (req, res) => {
  const chave = String(req.params.chave || '');
  if (!PECA.test(chave)) throw erro(400, 'Peça inválida.');
  const nome = nomesSprites.limparNome(req.body?.nome);
  await clube.pronto();
  const item = chave.match(PECA_ITEM);
  let antes;
  if (item) {
    const l = await db.get('SELECT nome FROM clube_itens WHERE id = ?', Number(item[1]));
    if (!l) throw erro(404, 'Esse item não existe.');
    if (!nome) throw erro(400, 'O item precisa de um nome.');
    antes = l.nome;
    await db.run('UPDATE clube_itens SET nome = ? WHERE id = ?', nome, Number(item[1]));
    await clube.recarregarItens();
  } else {
    antes = nomesSprites.nomeDe(chave, null);
    if (nome) {
      await db.run(`INSERT INTO sprites_nomes (chave, nome, por_nome, atualizado_em) VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT (chave) DO UPDATE SET nome = excluded.nome, por_nome = excluded.por_nome, atualizado_em = excluded.atualizado_em`,
      chave, nome, req.usuario.nome);
    } else {
      await db.run('DELETE FROM sprites_nomes WHERE chave = ?', chave);
    }
    await nomesSprites.recarregar();
  }
  await anotar(req, nome ? 'Renomeou uma peça dos jogos' : 'Voltou uma peça dos jogos ao nome de sempre', `${chave}: ${nome || '(nome de sempre)'}`);
  notificar(req, chave, nome || antes || chave,
    nome ? `${req.usuario.nome} mudou o nome${antes ? ` de "${antes}"` : ''} para "${nome}".` : `${req.usuario.nome} voltou "${antes || chave}" ao nome de sempre.`);
  avisar();
  res.json({ ok: true, nome: nome || null });
});

/* ─── Itens novos do Club Coelho ─── */

function lerPreco(v) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isInteger(n) || n < 0 || n > PRECO_MAX) throw erro(400, `O preço é um número inteiro de cenouras, de 0 a ${PRECO_MAX}.`);
  return n;
}
const lerTamanho = (v, padrao) => inteiro(v, 16, 400, padrao);

r.post('/itens', editar, async (req, res) => {
  const b = req.body || {};
  const tipo = String(b.tipo || '');
  if (!clube.PARTES.includes(tipo) && tipo !== 'movel') throw erro(400, 'Escolha onde o item vai: uma parte do coelho ou móvel da toca.');
  const nome = nomesSprites.limparNome(b.nome);
  if (!nome) throw erro(400, 'Dê um nome ao item.');
  const preco = lerPreco(b.preco);
  let extra = {};
  if (tipo === 'movel') {
    const onde = clube.ONDE_MOVEL.includes(b.onde) ? b.onde : 'chao';
    extra = { onde, largura: lerTamanho(b.largura, 80), altura: lerTamanho(b.altura, 80) };
  }
  await clube.pronto();
  const { id } = await db.run('INSERT INTO clube_itens (tipo, nome, preco, extra, ativo, criado_por_nome) VALUES (?, ?, ?, ?, 1, ?)',
    tipo, nome, preco, JSON.stringify(extra), req.usuario.nome);
  await clube.recarregarItens();
  const item = clube.ITEM[`n${id}`];
  await anotar(req, 'Criou um item novo no Club Coelho', `${nome} (${tipo}, ${preco} cenouras)`);
  avisar();
  res.status(201).json({ item: itensNovos().find(i => i.id === item.id) });
});

// Muda o nome, o preço, o tamanho (móvel) ou tira da loja / põe de volta (ativo). Quem já tem continua tendo.
r.put('/itens/:id', editar, async (req, res) => {
  const id = Number(String(req.params.id || '').replace(/^n/, ''));
  const l = Number.isInteger(id) ? await db.get('SELECT * FROM clube_itens WHERE id = ?', id) : null;
  if (!l) throw erro(404, 'Esse item não existe.');
  const b = req.body || {};
  const muda = {};
  if (b.nome !== undefined) {
    muda.nome = nomesSprites.limparNome(b.nome);
    if (!muda.nome) throw erro(400, 'Dê um nome ao item.');
  }
  if (b.preco !== undefined) muda.preco = lerPreco(b.preco);
  if (b.ativo !== undefined) muda.ativo = b.ativo ? 1 : 0;
  if (l.tipo === 'movel' && (b.largura !== undefined || b.altura !== undefined)) {
    let extra = {};
    try { extra = JSON.parse(l.extra || '{}') || {}; } catch { extra = {}; }
    if (b.largura !== undefined) extra.largura = lerTamanho(b.largura, extra.largura || 80);
    if (b.altura !== undefined) extra.altura = lerTamanho(b.altura, extra.altura || 80);
    muda.extra = JSON.stringify(extra);
  }
  const campos = Object.keys(muda);
  if (!campos.length) throw erro(400, 'Nada para mudar.');
  await db.run(`UPDATE clube_itens SET ${campos.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, ...campos.map(c => muda[c]), id);
  await clube.pronto();
  await clube.recarregarItens();
  const nome = muda.nome || l.nome;
  const oQue = [muda.nome && `nome "${muda.nome}"`, muda.preco !== undefined && `preço ${muda.preco}`, muda.ativo === 0 && 'tirou da loja', muda.ativo === 1 && 'voltou para a loja', muda.extra && 'tamanho']
    .filter(Boolean).join(', ');
  await anotar(req, 'Mudou um item do Club Coelho', `${nome}: ${oQue}`);
  avisar();
  res.json({ item: itensNovos().find(i => i.id === `n${id}`) });
});

/* ─── Imagens ─── */

r.put('/:chave', editar, async (req, res) => {
  const chave = String(req.params.chave || '');
  if (!CHAVE.test(chave)) throw erro(400, 'Peça inválida.');
  const b = req.body || {};
  const antigo = await db.get('SELECT src FROM sprites WHERE chave = ?', chave);
  const src = b.src === undefined && antigo ? antigo.src : b.src;
  if (!urlValida(src)) throw erro(400, 'Envie a imagem do sprite (PNG, GIF ou WEBP).');
  const quadros = inteiro(b.quadros, 1, 64, 1);
  const fps = inteiro(b.fps, 1, 30, 8);
  const comandos = [[
    `INSERT INTO sprites (chave, src, quadros, fps, tingir, suave, por_nome, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (chave) DO UPDATE SET src = excluded.src, quadros = excluded.quadros, fps = excluded.fps, tingir = excluded.tingir,
       suave = excluded.suave, por_nome = excluded.por_nome, atualizado_em = excluded.atualizado_em`,
    chave, src, quadros, fps, b.tingir ? 1 : 0, b.suave ? 1 : 0, req.usuario.nome,
  ]];
  // A imagem antiga sai do banco quando é trocada.
  if (antigo && antigo.src !== src) { const c = comandoApagarArquivo(antigo.src); if (c) comandos.push(c); }
  await db.lote(comandos);
  // Item novo do clube: com o sprite, ele entra na loja.
  if (ehDeItemNovo(chave)) { await clube.pronto(); await clube.recarregarItens(); }
  await anotar(req, antigo ? 'Trocou um sprite dos jogos' : 'Colocou um sprite nos jogos', chave);
  if (!antigo || antigo.src !== src) {
    await clube.pronto().catch(() => {});
    const nome = nomeParaAviso(chave, b);
    notificar(req, chave, nome, `${req.usuario.nome} ${antigo ? 'trocou o sprite' : 'pôs um sprite'} de "${nome}".`);
  }
  avisar();
  res.json({ ok: true });
});

r.delete('/:chave', editar, async (req, res) => {
  const chave = String(req.params.chave || '');
  const antigo = await db.get('SELECT src FROM sprites WHERE chave = ?', chave);
  if (!antigo) throw erro(404, 'Essa peça já está com o desenho original.');
  const comandos = [['DELETE FROM sprites WHERE chave = ?', chave]];
  const c = comandoApagarArquivo(antigo.src);
  if (c) comandos.push(c);
  await db.lote(comandos);
  // Item novo sem sprite sai da loja (quem já tem continua tendo).
  if (ehDeItemNovo(chave)) { await clube.pronto(); await clube.recarregarItens(); }
  await anotar(req, 'Voltou um sprite dos jogos para o desenho original', chave);
  await clube.pronto().catch(() => {});
  const nome = nomeParaAviso(chave, req.query || {});
  notificar(req, chave, nome, `${req.usuario.nome} tirou o sprite de "${nome}" (voltou o desenho de sempre).`);
  avisar();
  res.json({ ok: true });
});

module.exports = r;
