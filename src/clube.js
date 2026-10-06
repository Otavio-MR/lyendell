// Club Coelho: o clube social da Recreação (no estilo do Club Penguin). Cada morador tem um coelho que
// passeia pelas salas do clube (Praça, Café, Loja, Salão de Dança, Lago e as tocas de cada um), conversa
// em balões, faz emotes e dança. As cenouras (a moeda do clube) vêm do presente do dia, dos minijogos do
// clube (Pescaria e Dança da Toca) e dos joguinhos da Recreação; com elas se compram roupas e móveis
// para decorar a própria toca.
//
// Aqui ficam o catálogo (com os preços), as salas, quem está em cada sala (na memória) e as ações do
// WebSocket ('clube:*'); o perfil de cada um (cenouras, roupa, itens, toca) fica na tabela `clube`.
// O desenho de tudo fica no navegador (public/js/roupas-coelho.js, clube-salas.js e telas/clube.js).

const { db } = require('./db');
const { hoje } = require('./cobranca');
const antispam = require('./antispam');
const progresso = require('./progresso');
const nomesSprites = require('./sprites-nomes');

class ErroClube extends Error {}

/* ─── Catálogo ────────────────────────────────────── */

// tipo: a parte do coelho (cabeca, rosto, pescoco, costas, corpo, mao), a cor do pelo, ou o que vai na
// toca (movel, piso, parede). Preço 0 = todo mundo já tem. "parede": móvel que fica pendurado na parede.
const CATALOGO = [
  // Pelos
  { id: 'pelo-creme', tipo: 'pelo', nome: 'Creme', cor: '#e9dcc3', preco: 0 },
  { id: 'pelo-caramelo', tipo: 'pelo', nome: 'Caramelo', cor: '#c99a6b', preco: 0 },
  { id: 'pelo-chocolate', tipo: 'pelo', nome: 'Chocolate', cor: '#8a6a4f', preco: 0 },
  { id: 'pelo-neve', tipo: 'pelo', nome: 'Neve', cor: '#f7f3ea', preco: 0 },
  { id: 'pelo-cafe', tipo: 'pelo', nome: 'Café', cor: '#5b4a3f', preco: 0 },
  { id: 'pelo-mel', tipo: 'pelo', nome: 'Mel', cor: '#d9b48a', preco: 0 },
  { id: 'pelo-cinza', tipo: 'pelo', nome: 'Cinza', cor: '#9aa3ad', preco: 0 },
  { id: 'pelo-rosado', tipo: 'pelo', nome: 'Rosado', cor: '#e2b3a3', preco: 0 },
  { id: 'pelo-rosa', tipo: 'pelo', nome: 'Rosa chiclete', cor: '#f2a7c8', preco: 150 },
  { id: 'pelo-azul', tipo: 'pelo', nome: 'Azul céu', cor: '#8fb8e8', preco: 150 },
  { id: 'pelo-verde', tipo: 'pelo', nome: 'Verde menta', cor: '#9ccc8a', preco: 150 },
  { id: 'pelo-lilas', tipo: 'pelo', nome: 'Lilás', cor: '#c4a8e8', preco: 150 },
  { id: 'pelo-noite', tipo: 'pelo', nome: 'Noite', cor: '#3a3440', preco: 200 },
  { id: 'pelo-ouro', tipo: 'pelo', nome: 'Dourado', cor: '#e8c24a', preco: 600 },
  // Cabeça
  { id: 'laco', tipo: 'cabeca', nome: 'Laço rosa', preco: 60 },
  { id: 'chapeu', tipo: 'cabeca', nome: 'Chapéu de palha', preco: 80 },
  { id: 'flores', tipo: 'cabeca', nome: 'Coroa de flores', preco: 90 },
  { id: 'gorro', tipo: 'cabeca', nome: 'Gorro de lã', preco: 90 },
  { id: 'bone', tipo: 'cabeca', nome: 'Boné dourado', preco: 110 },
  { id: 'cozinheiro', tipo: 'cabeca', nome: 'Chapéu de cozinheiro', preco: 120 },
  { id: 'fones', tipo: 'cabeca', nome: 'Fones de ouvido', preco: 150 },
  { id: 'bruxa', tipo: 'cabeca', nome: 'Chapéu de bruxa', preco: 180 },
  { id: 'pirata', tipo: 'cabeca', nome: 'Chapéu de pirata', preco: 200 },
  { id: 'cartola', tipo: 'cabeca', nome: 'Cartola', preco: 220 },
  { id: 'viking', tipo: 'cabeca', nome: 'Capacete viking', preco: 260 },
  { id: 'tiara', tipo: 'cabeca', nome: 'Tiara de pérolas', preco: 300 },
  { id: 'coroa', tipo: 'cabeca', nome: 'Coroa da Casa', preco: 500 },
  // Rosto
  { id: 'oculos', tipo: 'rosto', nome: 'Óculos redondos', preco: 70 },
  { id: 'bigode', tipo: 'rosto', nome: 'Bigode', preco: 90 },
  { id: 'tapaolho', tipo: 'rosto', nome: 'Tapa-olho', preco: 100 },
  { id: 'escuros', tipo: 'rosto', nome: 'Óculos escuros', preco: 140 },
  { id: 'monoculo', tipo: 'rosto', nome: 'Monóculo', preco: 160 },
  { id: 'mascara', tipo: 'rosto', nome: 'Máscara de baile', preco: 200 },
  // Pescoço
  { id: 'cachecol', tipo: 'pescoco', nome: 'Cachecol', preco: 70 },
  { id: 'gravata', tipo: 'pescoco', nome: 'Gravata-borboleta', preco: 80 },
  { id: 'perolas', tipo: 'pescoco', nome: 'Colar de pérolas', preco: 180 },
  { id: 'medalha', tipo: 'pescoco', nome: 'Medalha da Casa Luckham', preco: 250 },
  // Costas
  { id: 'mochila', tipo: 'costas', nome: 'Mochila de aventura', preco: 120 },
  { id: 'capa', tipo: 'costas', nome: 'Capa real', preco: 300 },
  { id: 'asas', tipo: 'costas', nome: 'Asas de fada', preco: 350 },
  // Corpo
  { id: 'avental', tipo: 'corpo', nome: 'Avental', preco: 90 },
  { id: 'camiseta', tipo: 'corpo', nome: 'Camiseta da Casa', preco: 100 },
  { id: 'moletom', tipo: 'corpo', nome: 'Moletom roxo', preco: 120 },
  { id: 'colete', tipo: 'corpo', nome: 'Colete de couro', preco: 130 },
  { id: 'vestido', tipo: 'corpo', nome: 'Vestido florido', preco: 160 },
  { id: 'smoking', tipo: 'corpo', nome: 'Smoking', preco: 280 },
  { id: 'armadura', tipo: 'corpo', nome: 'Armadura de cavaleiro', preco: 400 },
  // Na mão
  { id: 'balao', tipo: 'mao', nome: 'Balão', preco: 50 },
  { id: 'sorvete', tipo: 'mao', nome: 'Sorvete', preco: 60 },
  { id: 'lanterna', tipo: 'mao', nome: 'Lanterna', preco: 90 },
  { id: 'vara', tipo: 'mao', nome: 'Vara de pescar', preco: 100 },
  { id: 'espada', tipo: 'mao', nome: 'Espada de madeira', preco: 150 },
  { id: 'bandeira', tipo: 'mao', nome: 'Bandeira da Casa Luckham', preco: 180 },
  { id: 'varinha', tipo: 'mao', nome: 'Varinha mágica', preco: 220 },
  { id: 'violao', tipo: 'mao', nome: 'Violão', preco: 260 },
  // Móveis da toca
  { id: 'cenouras', tipo: 'movel', nome: 'Cesto de cenouras', preco: 40 },
  { id: 'planta', tipo: 'movel', nome: 'Vaso de planta', preco: 50 },
  { id: 'cadeira', tipo: 'movel', nome: 'Cadeira de madeira', preco: 60 },
  { id: 'abajur', tipo: 'movel', nome: 'Abajur', preco: 70 },
  { id: 'tapete', tipo: 'movel', nome: 'Tapete redondo', preco: 80, chao: true },
  { id: 'mesa', tipo: 'movel', nome: 'Mesa redonda', preco: 90 },
  { id: 'banquinho', tipo: 'movel', nome: 'Banquinho de cogumelo', preco: 70 },
  { id: 'bau', tipo: 'movel', nome: 'Baú', preco: 120 },
  { id: 'estante', tipo: 'movel', nome: 'Estante de livros', preco: 180 },
  { id: 'cama', tipo: 'movel', nome: 'Cama de palha', preco: 200 },
  { id: 'sofa', tipo: 'movel', nome: 'Sofá verde', preco: 220 },
  { id: 'aquario', tipo: 'movel', nome: 'Aquário', preco: 260 },
  { id: 'vitrola', tipo: 'movel', nome: 'Vitrola', preco: 300 },
  { id: 'lareira', tipo: 'movel', nome: 'Lareira', preco: 350 },
  { id: 'trono', tipo: 'movel', nome: 'Trono da Casa', preco: 800 },
  { id: 'janela', tipo: 'movel', nome: 'Janela redonda', preco: 100, parede: true },
  { id: 'luzes', tipo: 'movel', nome: 'Varal de luzes', preco: 110, parede: true },
  { id: 'relogio', tipo: 'movel', nome: 'Relógio de parede', preco: 130, parede: true },
  { id: 'quadro', tipo: 'movel', nome: 'Quadro da Casa Luckham', preco: 150, parede: true },
  { id: 'estandarte', tipo: 'movel', nome: 'Estandarte Luckham', preco: 160, parede: true },
  // Chão e parede da toca
  { id: 'piso-madeira', tipo: 'piso', nome: 'Assoalho de madeira', preco: 0 },
  { id: 'piso-grama', tipo: 'piso', nome: 'Gramado', preco: 100 },
  { id: 'piso-pedra', tipo: 'piso', nome: 'Pedras do rio', preco: 120 },
  { id: 'piso-xadrez', tipo: 'piso', nome: 'Xadrez dourado', preco: 260 },
  { id: 'parede-terra', tipo: 'parede', nome: 'Terra batida', preco: 0 },
  { id: 'parede-pedra', tipo: 'parede', nome: 'Pedra', preco: 120 },
  { id: 'parede-tijolo', tipo: 'parede', nome: 'Tijolinhos', preco: 150 },
  { id: 'parede-listras', tipo: 'parede', nome: 'Papel listrado', preco: 180 },
];
const ITEM = Object.fromEntries(CATALOGO.map(i => [i.id, i]));
const PARTES = ['cabeca', 'rosto', 'pescoco', 'costas', 'corpo', 'mao'];
const ROUPA = new Set([...PARTES, 'pelo']);
const gratis = i => i.preco === 0;

/* ─── Nomes das peças e itens novos ───────────────── */
// Cada roupa e cada móvel é uma peça dos sprites ("roupa.<id>" e "clube.movel-<id>"): o nome que quem troca
// os sprites der à peça vale também na loja, no guarda-roupa e na toca. Pelos, chãos e paredes não são peças.
// Os itens novos (tabela clube_itens, id "n12") entram no catálogo como os de sempre; só são vendidos depois
// que o sprite deles é enviado (sem sprite, não teria o que desenhar) e enquanto estão "na loja" (ativo).

const ONDE_MOVEL = ['chao', 'parede', 'tapete'];
const pecaDoItem = i => (PARTES.includes(i.tipo) ? `roupa.${i.id}` : i.tipo === 'movel' ? `clube.movel-${i.id}` : null);
for (const i of CATALOGO) { i.nomePadrao = i.nome; i.peca = pecaDoItem(i); }

function aplicarNomes() {
  for (const i of CATALOGO) if (!i.novo) i.nome = nomesSprites.nomeDe(i.peca, i.nomePadrao);
}
nomesSprites.aoMudar(aplicarNomes);

const json0 = t => { try { const v = JSON.parse(t || ''); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
// O item novo como entra no catálogo (o mesmo formato dos de sempre, com o que o desenho precisa).
function itemNovo(l, comSprite) {
  const extra = json0(l.extra);
  const i = { id: `n${l.id}`, tipo: l.tipo, nome: l.nome, nomePadrao: l.nome, preco: Number(l.preco) || 0, novo: true, ativo: !!l.ativo, sprite: false };
  i.peca = pecaDoItem(i);
  i.sprite = comSprite.has(i.peca);
  i.venda = i.ativo && i.sprite;
  if (i.tipo === 'movel') {
    i.onde = ONDE_MOVEL.includes(extra.onde) ? extra.onde : 'chao';
    i.largura = Math.max(10, Math.min(400, Math.round(Number(extra.largura) || 80)));
    i.altura = Math.max(10, Math.min(400, Math.round(Number(extra.altura) || 80)));
    if (i.onde === 'parede') i.parede = true;
    if (i.onde === 'tapete') i.chao = true;
  }
  return i;
}

// Lê de novo os itens novos (quando um é criado ou mudado, e quando o sprite de um deles muda).
async function recarregarItens() {
  const linhas = await db.all('SELECT * FROM clube_itens ORDER BY id');
  const comSprite = new Set((await db.all("SELECT chave FROM sprites WHERE chave LIKE 'roupa.n%' OR chave LIKE 'clube.movel-n%'"))
    .map(l => l.chave.split('.').slice(0, 2).join('.')));
  for (let k = CATALOGO.length - 1; k >= 0; k--) if (CATALOGO[k].novo) { delete ITEM[CATALOGO[k].id]; CATALOGO.splice(k, 1); }
  for (const l of linhas) {
    if (!PARTES.includes(l.tipo) && l.tipo !== 'movel') continue;
    const i = itemNovo(l, comSprite);
    CATALOGO.push(i);
    ITEM[i.id] = i;
  }
}
let cargaItens = null;
// Antes de usar o catálogo: os nomes das peças e os itens novos já carregados (uma vez só).
function pronto() {
  cargaItens ??= recarregarItens().catch(e => { cargaItens = null; throw e; });
  return Promise.all([nomesSprites.pronto(), cargaItens]);
}

// O catálogo que vai para o navegador.
function catalogoPublico() {
  return CATALOGO.map(({ id, tipo, nome, nomePadrao, preco, cor, parede, chao, peca, novo, venda, sprite, onde, largura, altura }) => (
    novo ? { id, tipo, nome, nomePadrao, preco, parede, chao, peca, novo, venda, sprite, onde, largura, altura }
      : { id, tipo, nome, nomePadrao, preco, cor, parede, chao, peca }));
}

const INICIAIS = { moedas: 300, itens: { cadeira: 1, tapete: 1, planta: 1 } };
const PRESENTE = 50;              // cenouras do presente do dia
const TETO_DIA = Number(process.env.CLUBE_TETO_DIA) || 400; // o máximo que se ganha jogando por dia
const MAX_MOVEIS = 40;

/* ─── Salas ───────────────────────────────────────── */

// Tudo num quadro de 1000 x 600. "chao": onde dá para andar. "chegada": onde o coelho aparece
// (vindo de cada lugar). As tocas são "toca:<id do dono>".
const SALAS = {
  praca: { nome: 'Praça do Clube', chao: [30, 330, 970, 585], chegada: { padrao: [500, 552], cafe: [205, 365], loja: [500, 352], danca: [795, 365], lago: [70, 405], toca: [500, 552], ancoradouro: [70, 520], forte: [930, 405], plaza: [930, 520] } },
  cafe: { nome: 'Café da Cenoura', chao: [60, 360, 940, 585], chegada: { padrao: [500, 545], leitura: [90, 400] } },
  loja: { nome: 'Armarinho da Dona Felpuda', chao: [60, 380, 940, 585], chegada: { padrao: [500, 545] } },
  danca: { nome: 'Salão de Dança', chao: [60, 330, 940, 585], chegada: { padrao: [500, 545], fliperama: [272, 360], caldeira: [654, 362] } },
  lago: { nome: 'Lago Cintilante', chao: [40, 380, 960, 585], chegada: { padrao: [915, 500] } },
  toca: { nome: 'Toca', chao: [90, 330, 910, 585], chegada: { padrao: [500, 548] } },
};
// As salas da Ilha (Plaza, Forte Nevado, Praia, Dojo...) vêm de src/clube-ilha/.
const ILHA = require('./clube-ilha');
Object.assign(SALAS, ILHA.salas);

const ehToca = sala => /^toca:\d+$/.test(sala);
const tipoDaSala = sala => (ehToca(sala) ? 'toca' : sala);
const EMOTES = ['oi', 'coracao', 'risada', 'susto', 'pergunta', 'zzz', 'cenoura', 'estrela', 'dancar', 'sentar', 'cafe'];
const VEL = 170; // unidades por segundo (o mesmo do navegador)

/* ─── Perfil (banco) ──────────────────────────────── */

const json = (t, padrao) => { try { const v = JSON.parse(t || ''); return v && typeof v === 'object' ? v : padrao; } catch { return padrao; } };

async function perfil(id) {
  await pronto();
  await db.run(`INSERT INTO clube (usuario_id, moedas, itens) VALUES (?, ?, ?) ON CONFLICT (usuario_id) DO NOTHING`,
    id, INICIAIS.moedas, JSON.stringify(INICIAIS.itens));
  const l = await db.get('SELECT * FROM clube WHERE usuario_id = ?', id);
  return {
    moedas: Number(l.moedas), visual: validarVisual(json(l.visual, {}), json(l.itens, {})), itens: json(l.itens, {}),
    toca: tocaPadrao(json(l.toca, {})), presente: l.presente, peixes: Number(l.peixes || 0),
  };
}

// O visual só usa o que a pessoa tem (ou o que é de graça).
function validarVisual(v = {}, itens = {}) {
  const tem = id => ITEM[id] && (gratis(ITEM[id]) || itens[id] > 0);
  const saida = { pelo: ITEM[v.pelo]?.tipo === 'pelo' && tem(v.pelo) ? v.pelo : 'pelo-creme' };
  for (const p of PARTES) if (v[p] && ITEM[v[p]]?.tipo === p && tem(v[p])) saida[p] = v[p];
  return saida;
}

function tocaPadrao(t = {}) {
  return {
    piso: ITEM[t.piso]?.tipo === 'piso' ? t.piso : 'piso-madeira',
    parede: ITEM[t.parede]?.tipo === 'parede' ? t.parede : 'parede-terra',
    aberta: t.aberta !== false,
    moveis: Array.isArray(t.moveis) ? t.moveis : [],
  };
}

// A toca nova vem do navegador: só móveis que a pessoa tem (na quantidade que tem), dentro da sala.
function validarToca(t = {}, itens = {}) {
  const limitar = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  const tem = id => ITEM[id] && (gratis(ITEM[id]) || itens[id] > 0);
  const usados = {};
  const moveis = [];
  for (const m of Array.isArray(t.moveis) ? t.moveis.slice(0, MAX_MOVEIS) : []) {
    const item = ITEM[m?.id];
    if (!item || item.tipo !== 'movel') continue;
    usados[m.id] = (usados[m.id] || 0) + 1;
    if (usados[m.id] > (itens[m.id] || 0)) continue;
    moveis.push({ id: m.id, x: limitar(m.x, 60, 940), y: item.parede ? limitar(m.y, 90, 290) : limitar(m.y, 300, 590), v: m.v ? 1 : 0 });
  }
  return {
    piso: ITEM[t.piso]?.tipo === 'piso' && tem(t.piso) ? t.piso : 'piso-madeira',
    parede: ITEM[t.parede]?.tipo === 'parede' && tem(t.parede) ? t.parede : 'parede-terra',
    aberta: t.aberta !== false,
    moveis,
  };
}

// Cenouras ganhas jogando (com o teto do dia). Devolve quantas entraram de verdade.
async function ganhar(id, n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (!n) return 0;
  await perfil(id);
  const dia = hoje();
  const l = await db.get('SELECT ganhos_dia, ganhos FROM clube WHERE usuario_id = ?', id);
  const ja = l.ganhos_dia === dia ? Number(l.ganhos) : 0;
  const entra = Math.max(0, Math.min(n, TETO_DIA - ja));
  if (!entra) return 0;
  await db.run('UPDATE clube SET moedas = moedas + ?, ganhos_dia = ?, ganhos = ? WHERE usuario_id = ?', entra, dia, ja + entra, id);
  return entra;
}

// Cada joguinho da Recreação também dá cenouras para o clube (pelo resultado, no máximo 40 por partida).
const CENOURAS_POR_JOGO = {
  pacman: p => p / 1000, cobrinha: p => p, 2048: p => p / 400, barris: p => p / 400, supercoelho: p => p / 500,
  travessia: p => p / 2, corrida: p => p / 25, quebra: () => 10, memoria: () => 10, minado: () => 12,
};
async function ganharDeJogo(id, jogo, pontos) {
  const f = CENOURAS_POR_JOGO[jogo];
  if (!f) return 0;
  return ganhar(id, Math.min(40, Math.floor(f(Number(pontos) || 0))));
}

/* ─── Quem está em cada sala (memória) ────────────── */

const presentes = new Map(); // id -> { id, nome, sala, x, y, tx, ty, d, partiu, visual, dancando, sentado }
let ctx = { paraUsuario: () => {}, ehCrianca: () => false, limpar: t => t };

const naSala = sala => [...presentes.values()].filter(p => p.sala === sala);
// Onde o coelho está agora (andando em linha reta até o alvo).
function posicaoAgora(p, agora = Date.now()) {
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (!dist) return [p.x, p.y];
  const k = Math.min(1, ((agora - p.partiu) / 1000) * VEL / dist);
  return [p.x + dx * k, p.y + dy * k];
}
function publico(p) {
  const [x, y] = posicaoAgora(p);
  return { id: p.id, nome: p.nome, x: Math.round(x), y: Math.round(y), tx: p.tx, ty: p.ty, d: p.d, visual: p.visual, dancando: p.dancando, sentado: p.sentado };
}
function paraSala(sala, tipo, dados, menos = null) {
  for (const p of naSala(sala)) if (p.id !== menos) ctx.paraUsuario(p.id, tipo, dados);
}
const contagem = () => {
  const c = {};
  for (const p of presentes.values()) c[ehToca(p.sala) ? 'tocas' : p.sala] = (c[ehToca(p.sala) ? 'tocas' : p.sala] || 0) + 1;
  return c;
};

function sair(id) {
  const p = presentes.get(id);
  if (!p) return;
  presentes.delete(id);
  paraSala(p.sala, 'clube:saiu', { id });
}

async function entrar(u, { sala }, ws = null) {
  sala = String(sala || 'praca');
  if (!SALAS[sala] && !ehToca(sala)) throw new ErroClube('Essa sala não existe.');
  let toca = null;
  if (ehToca(sala)) {
    const dono = Number(sala.slice(5));
    const d = await db.get('SELECT u.nome, c.toca FROM usuarios u LEFT JOIN clube c ON c.usuario_id = u.id WHERE u.id = ?', dono);
    if (!d) throw new ErroClube('Essa toca não existe.');
    toca = { dono, nome: d.nome, ...tocaPadrao(json(d.toca, {})) };
    if (!toca.aberta && dono !== u.id) throw new ErroClube(`A toca de ${d.nome} está fechada para visitas agora.`);
  }
  const eu = await perfil(u.id);
  const antes = presentes.get(u.id);
  if (antes) sair(u.id);
  const def = SALAS[tipoDaSala(sala)];
  const de = antes ? tipoDaSala(antes.sala) : null;
  const [x, y] = def.chegada[de] || def.chegada.padrao;
  const p = { id: u.id, nome: u.nome, sala, x, y, tx: x, ty: y, d: 1, partiu: Date.now(), visual: eu.visual, dancando: false, sentado: false, ws };
  presentes.set(u.id, p);
  paraSala(sala, 'clube:chegou', { p: publico(p) }, u.id);
  ctx.paraUsuario(u.id, 'clube:sala', { sala, nomeSala: toca ? `Toca de ${toca.nome}` : def.nome, pessoas: naSala(sala).map(publico), toca, contagem: contagem() });
  // A visita ao clube conta uma vez por dia (missões e a conquista de sócio).
  const chave = `${u.id}:${hoje()}`;
  if (!visitas.has(chave)) {
    visitas.add(chave);
    if (visitas.size > 5000) visitas.clear();
    progresso.registrar(u.id, 'clube');
  }
}
const visitas = new Set();

const acoes = {
  async 'clube:entrar'(u, dados, ws) { await entrar(u, dados, ws); },

  'clube:sair'(u) { sair(u.id); },

  // Clique no chão: o coelho anda em linha reta até lá (todos calculam o caminho igual).
  'clube:andar'(u, { x, y }) {
    const p = presentes.get(u.id);
    if (!p) return;
    const [x0, y0, x1, y1] = SALAS[tipoDaSala(p.sala)].chao;
    const [cx, cy] = posicaoAgora(p);
    const tx = Math.max(x0, Math.min(x1, Math.round(Number(x) || 0)));
    const ty = Math.max(y0, Math.min(y1, Math.round(Number(y) || 0)));
    Object.assign(p, { x: Math.round(cx), y: Math.round(cy), tx, ty, partiu: Date.now(), dancando: false, sentado: false });
    if (tx !== p.x) p.d = tx > p.x ? 1 : -1;
    paraSala(p.sala, 'clube:andar', { id: u.id, x: p.x, y: p.y, tx, ty, d: p.d }, u.id);
  },

  'clube:falar'(u, { texto }) {
    const p = presentes.get(u.id);
    if (!p) return;
    const bruto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!bruto) return;
    const a = antispam.avaliar(u.id, bruto);
    if (!a.ok) throw new ErroClube(a.motivo);
    if (a.conta) progresso.registrar(u.id, 'chat');
    for (const q of naSala(p.sala)) ctx.paraUsuario(q.id, 'clube:fala', { id: u.id, texto: ctx.ehCrianca(q.id) ? ctx.limpar(a.texto) : a.texto });
  },

  'clube:emote'(u, { e }) {
    const p = presentes.get(u.id);
    if (!p || !EMOTES.includes(e)) return;
    const agora = Date.now();
    if (agora - (p.ultimoEmote || 0) < 500) return;
    p.ultimoEmote = agora;
    if (e === 'dancar' || e === 'sentar') {
      const [x, y] = posicaoAgora(p);
      Object.assign(p, { x: Math.round(x), y: Math.round(y), tx: Math.round(x), ty: Math.round(y), dancando: e === 'dancar' ? !p.dancando : false, sentado: e === 'sentar' ? !p.sentado : false });
    }
    paraSala(p.sala, 'clube:emote', { id: u.id, e, x: Math.round(p.tx), y: Math.round(p.ty), dancando: p.dancando, sentado: p.sentado });
    ILHA.aoEmote({ sala: p.sala, e, id: u.id, pessoas: naSala(p.sala), paraSala: (tipo, dados) => paraSala(p.sala, tipo, dados) });
  },

  // Quantas pessoas em cada sala e quais tocas estão abertas (para o mapa).
  async 'clube:mapa'(u) {
    const tocas = await db.all(`SELECT c.usuario_id AS id, u.nome, c.toca FROM clube c JOIN usuarios u ON u.id = c.usuario_id ORDER BY u.nome`);
    ctx.paraUsuario(u.id, 'clube:mapa', {
      contagem: contagem(),
      tocas: tocas.map(t => {
        const k = tocaPadrao(json(t.toca, {}));
        return { id: t.id, nome: t.nome, aberta: k.aberta, moveis: k.moveis.length, aqui: naSala(`toca:${t.id}`).length };
      }).filter(t => t.aberta || t.id === u.id),
    });
  },
};

// O coelho de cada um, pronto para desenhar nos jogos (cor do pelo e a roupa por partes).
async function visualDesenho(id) {
  await pronto();
  const l =await db.get('SELECT visual, itens FROM clube WHERE usuario_id = ?', id);
  const v = validarVisual(json(l?.visual, {}), json(l?.itens, {}));
  const roupa = {};
  for (const p of PARTES) if (v[p]) roupa[p] = v[p];
  return { pelo: ITEM[v.pelo]?.cor || '#e9dcc3', roupa };
}

// A roupa mudou (pela rota PUT /api/clube/visual): quem está na mesma sala vê na hora.
function mudouVisual(id, visual) {
  const p = presentes.get(id);
  if (!p) return;
  p.visual = visual;
  paraSala(p.sala, 'clube:visual', { id, visual });
}
// A toca foi redecorada: quem está dentro vê na hora (e quem não pode mais ficar volta para a praça).
function mudouToca(dono, toca, nome) {
  const sala = `toca:${dono}`;
  paraSala(sala, 'clube:toca', { toca: { dono, nome, ...toca } });
}

// A aba que estava no clube fechou (mesmo que outra aba continue aberta).
function fechou(id, ws) {
  if (presentes.get(id)?.ws === ws) sair(id);
}

function iniciar(opcoes) { ctx = { ...ctx, ...opcoes }; }

module.exports = {
  CATALOGO, ITEM, PARTES, ROUPA, SALAS, EMOTES, INICIAIS, PRESENTE, TETO_DIA, MAX_MOVEIS, ONDE_MOVEL, ErroClube,
  pronto, recarregarItens, catalogoPublico, pecaDoItem, perfil, validarVisual, visualDesenho, validarToca, ganhar, ganharDeJogo, acoes, sair, fechou, mudouVisual, mudouToca, iniciar, posicaoAgora,
};
