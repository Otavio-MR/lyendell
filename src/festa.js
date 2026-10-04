// Festa na Toca: o jogo de tabuleiro no estilo do Mario Party.
//
// De 2 a 10 coelhos (os lugares vazios podem ser completados com "coelhos da casa", o computador) andam
// por um jardim jogando o dado (1 a 10). As casas azuis dão 3 cenouras, as vermelhas tiram 3, as de sorte
// sorteiam um acontecimento, as do Raposo aprontam, e nas lojas dá para comprar dados especiais. Quem passa
// pela cenoura dourada pode comprá-la por 20 cenouras (aí ela muda de lugar). Depois que todos jogam, vem um
// minijogo (todos contra todos, ou azul contra vermelho pela cor das casas em que caíram): quem vence ganha 10.
// No fim das rodadas há três estrelas bônus, e vence quem tiver mais cenouras douradas (desempate: cenouras).
//
// Só as regras e o relógio (sem rede): recreacao.js chama passo() de tempos em tempos e manda a sala para todos.
// Os minijogos rodam no navegador (public/js/festa-minijogos.js); aqui ficam só o tipo, a duração e o placar.

class ErroFesta extends Error {}

const ESCALA = Number(process.env.FESTA_ESCALA) || 1; // os testes rodam mais rápido
const ms = t => Math.round(t * ESCALA);

const ITENS = {
  dado2: { nome: 'Dado Duplo', preco: 10, desc: 'Joga dois dados e anda a soma.' },
  dado3: { nome: 'Dado Triplo', preco: 20, desc: 'Joga três dados e anda a soma.' },
  apito: { nome: 'Apito Dourado', preco: 25, desc: 'Leva você para a casa logo antes da cenoura dourada.' },
};
const MAX_ITENS = 3;
const PRECO_DOURADA = 20;

// Os minijogos (os mesmos de public/js/festa-minijogos.js): tipo de placar e duração em segundos.
const MINIJOGOS = {
  chuva: { nome: 'Chuva de Bolotas', tipo: 'sobrevivencia', duracao: 35 },
  corrida: { nome: 'Corrida da Toca', tipo: 'corrida', duracao: 25 },
  cacada: { nome: 'Caça às Cenouras', tipo: 'pontos', duracao: 30 },
  memoria: { nome: 'Memória do Raposo', tipo: 'pontos', duracao: 45 },
  alvo: { nome: 'Tiro ao Alvo', tipo: 'pontos', duracao: 30 },
  corda: { nome: 'Pula-Corda', tipo: 'sobrevivencia', duracao: 40 },
};
const CPUS = ['Biscoito', 'Pipoca', 'Amora', 'Trevo', 'Nabo', 'Paçoca'];
const RODADAS = [10, 15, 20];

/* ─── O tabuleiro: o Jardim da Toca ───────────────── */
// Um caminho em volta do jardim (36 casas) e dois atalhos por dentro (5 casas cada), mais arriscados.
// Cada casa: { id, x, y, tipo, prox: [ids] } num quadro de 1200 x 800.
function montarTabuleiro() {
  const casas = [];
  const N = 36;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI / 2;
    const ondula = Math.sin(a * 3) * 22;
    casas.push({ id: k, x: Math.round(600 + Math.cos(a) * (480 + ondula)), y: Math.round(400 + Math.sin(a) * (300 + ondula * 0.6)), tipo: 'azul', prox: [(k + 1) % N] });
  }
  // Atalhos: do 4 para o 13 (por cima do lago) e do 22 para o 31 (pela horta).
  const atalho = (de, para, curva) => {
    const a = casas[de];
    const b = casas[para];
    const ids = [];
    for (let k = 1; k <= 5; k++) {
      const f = k / 6;
      const id = casas.length;
      const x = a.x + (b.x - a.x) * f + curva.x * Math.sin(f * Math.PI);
      const y = a.y + (b.y - a.y) * f + curva.y * Math.sin(f * Math.PI);
      casas.push({ id, x: Math.round(x), y: Math.round(y), tipo: 'azul', prox: [] });
      ids.push(id);
    }
    ids.forEach((id, k) => { casas[id].prox = [k < ids.length - 1 ? ids[k + 1] : para]; });
    casas[de].prox.push(ids[0]);
    return ids;
  };
  const cima = atalho(4, 13, { x: 0, y: 170 });
  const baixo = atalho(22, 31, { x: 0, y: -170 });
  const tipos = {
    vermelha: [6, 11, 17, 25, 29, 34],
    sorte: [2, 9, 15, 20, 27, 32, cima[1], baixo[3]],
    raposo: [cima[2], baixo[2], 24],
    loja: [8, 26],
  };
  for (const [tipo, ids] of Object.entries(tipos)) for (const id of ids) casas[id].tipo = tipo;
  casas[0].tipo = 'inicio';
  return casas;
}
const TABULEIRO = montarTabuleiro();
const AZUIS = TABULEIRO.filter(c => c.tipo === 'azul').map(c => c.id);

function sorteDe(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dado = rnd => 1 + Math.floor(rnd() * 10);

// Quantas casas faltam de uma casa até outra (pelo caminho mais curto).
function distancia(de, para) {
  const vistos = new Map([[de, 0]]);
  const fila = [de];
  while (fila.length) {
    const c = fila.shift();
    if (c === para) return vistos.get(c);
    for (const p of TABULEIRO[c].prox) if (!vistos.has(p)) { vistos.set(p, vistos.get(c) + 1); fila.push(p); }
  }
  return 99;
}

/* ─── Começo ──────────────────────────────────────── */

function opcoes(o = {}) {
  return { rodadas: RODADAS.includes(Number(o.rodadas)) ? Number(o.rodadas) : 10, cpus: o.cpus !== false };
}

// jogadores: [{ id, nome }] (os de verdade, na ordem da sala). Completa com coelhos da casa se pedido.
function novo(o, jogadores, visuais = [], agora = Date.now()) {
  const semente = Math.floor(Math.random() * 2 ** 31);
  const rnd = sorteDe(semente);
  const j = jogadores.map((p, k) => ({ id: p.id, nome: p.nome, cpu: false, visual: visuais[k] || null }));
  if (o.cpus) {
    const livres = CPUS.filter(n => !j.some(p => p.nome === n));
    while (j.length < 4) j.push({ id: null, nome: `${livres.shift()} (casa)`, cpu: true, visual: null });
  }
  const e = {
    semente, rnd, rodadas: o.rodadas, rodada: 1, tab: TABULEIRO,
    j: j.map(p => ({ ...p, pos: 0, cenouras: 10, douradas: 0, itens: [], ultimaCor: null, ordemDado: null, ganhos: 0, ganhoMinijogo: 0, sortes: 0, saiu: false })),
    ordem: [], vez: 0, dourada: AZUIS[Math.floor(rnd() * AZUIS.length)],
    fase: 'ordem', passo: null, prazo: agora + ms(15000), dado: null, andar: null, msg: null, pausa: null,
    minijogo: null, ultimosMinijogos: [], bonus: null, fim: null, vencedores: null, historico: [],
  };
  // Os coelhos da casa jogam o dado da ordem na hora.
  for (const p of e.j) if (p.cpu) p.ordemDado = dado(rnd);
  return e;
}

/* ─── Ajudas ──────────────────────────────────────── */

const daVez = e => e.j[e.ordem[e.vez]];
const indiceDaVez = e => e.ordem[e.vez];
function contar(e, k, n) {
  const p = e.j[k];
  const antes = p.cenouras;
  p.cenouras = Math.max(0, p.cenouras + n);
  if (n > 0) p.ganhos += n;
  return p.cenouras - antes;
}
function mensagem(e, texto, tipo = 'info') {
  e.msg = { texto, tipo };
  e.historico.push(texto);
  if (e.historico.length > 30) e.historico.shift();
}
const ultimas = e => e.rodada > e.rodadas - 3;

/* ─── As ações de quem joga ───────────────────────── */

// acao: { tipo: 'rolar' } | { tipo: 'item', item } | { tipo: 'caminho', k } | { tipo: 'comprar', sim } |
//       { tipo: 'loja', item | null } | { tipo: 'pronto' }
function agir(e, i, acao = {}, agora = Date.now()) {
  if (e.fim) throw new ErroFesta('A festa já acabou.');
  const p = e.j[i];
  if (!p || p.cpu || p.saiu) throw new ErroFesta('Você não está jogando.');
  const tipo = String(acao.tipo || '');
  if (e.fase === 'ordem') {
    if (tipo !== 'rolar') throw new ErroFesta('Jogue o dado para ver quem começa.');
    if (p.ordemDado != null) return false;
    p.ordemDado = dado(e.rnd);
    return true;
  }
  if (e.fase === 'minijogo') {
    if (tipo === 'pronto' && e.minijogo?.passo === 'apresenta') {
      e.minijogo.prontos[i] = true;
      return true;
    }
    return false;
  }
  if (e.fase !== 'turno' || indiceDaVez(e) !== i) throw new ErroFesta('Espere a sua vez.');
  return decidir(e, i, acao, agora);
}

// As decisões da vez (de gente ou do computador).
function decidir(e, i, acao, agora) {
  const p = e.j[i];
  const tipo = String(acao.tipo || '');
  if (e.passo === 'decidir') {
    if (tipo === 'item') {
      const k = p.itens.indexOf(acao.item);
      if (k < 0) throw new ErroFesta('Você não tem esse item.');
      if (acao.item === 'apito') {
        p.itens.splice(k, 1);
        const antes = TABULEIRO.find(c => c.prox.includes(e.dourada) && c.tipo !== 'raposo') || TABULEIRO[0];
        p.pos = antes.id;
        mensagem(e, `${p.nome} usou o Apito Dourado e foi parar perto da cenoura dourada!`, 'item');
        e.passo = 'decidir';
        e.prazo = agora + ms(15000);
        return true;
      }
      if (e.dadosExtras) throw new ErroFesta('Você já vai usar um dado especial nesta vez.');
      p.itens.splice(k, 1);
      e.dadosExtras = acao.item === 'dado3' ? 3 : 2;
      mensagem(e, `${p.nome} vai usar o ${ITENS[acao.item].nome}!`, 'item');
      return true;
    }
    if (tipo !== 'rolar') return false;
    const n = e.dadosExtras || 1;
    e.dadosExtras = 0;
    const valores = Array.from({ length: n }, () => dado(e.rnd));
    e.dado = { valores, total: valores.reduce((a, b) => a + b, 0) };
    e.passo = 'dado';
    e.prazo = agora + ms(1300);
    e.msg = null;
    return true;
  }
  if (e.passo === 'pausa' && e.pausa) {
    const pa = e.pausa;
    if (pa.tipo === 'caminho' && tipo === 'caminho') {
      const prox = TABULEIRO[p.pos].prox;
      const k = Math.max(0, Math.min(prox.length - 1, Math.floor(Number(acao.k) || 0)));
      e.andar.forcado = prox[k];
      retomar(e, agora);
      return true;
    }
    if (pa.tipo === 'compra' && tipo === 'comprar') {
      if (acao.sim && p.cenouras >= PRECO_DOURADA) {
        contar(e, i, -PRECO_DOURADA);
        p.douradas++;
        const antiga = e.dourada;
        const opcoes = AZUIS.filter(id => id !== antiga && distancia(antiga, id) > 8);
        e.dourada = opcoes[Math.floor(e.rnd() * opcoes.length)] ?? antiga;
        mensagem(e, `${p.nome} comprou uma CENOURA DOURADA! Ela agora aparece em outro canto do jardim.`, 'dourada');
      }
      retomar(e, agora);
      return true;
    }
    if (pa.tipo === 'loja' && tipo === 'loja') {
      const item = ITENS[acao.item] ? acao.item : null;
      if (item && p.cenouras >= ITENS[item].preco && p.itens.length < MAX_ITENS) {
        contar(e, i, -ITENS[item].preco);
        p.itens.push(item);
        mensagem(e, `${p.nome} comprou um ${ITENS[item].nome}.`, 'item');
      }
      retomar(e, agora);
      return true;
    }
  }
  return false;
}

function retomar(e, agora) {
  e.pausa = null;
  e.passo = 'andar';
  e.prazo = agora + ms(380);
}

/* ─── O relógio ───────────────────────────────────── */

// Avança o que estiver na hora (decisões do computador, passos, prazos). Devolve true se mudou algo.
function passo(e, agora = Date.now()) {
  if (e.fim) return false;
  // O computador decide sem esperar o prazo inteiro.
  if (e.fase === 'turno' && daVez(e)?.cpu && ['decidir', 'pausa'].includes(e.passo) && agora >= (e.cpuEm || 0)) return jogarCpu(e, agora);
  // Todos jogaram o dado da ordem: mostra um pouco e começa.
  if (e.fase === 'ordem' && !e.ordemPronta && e.j.every(p => p.ordemDado != null)) {
    e.ordemPronta = true;
    e.prazo = Math.min(e.prazo, agora + ms(2500));
    return true;
  }
  // Todos leram as regras do minijogo: começa já.
  if (e.fase === 'minijogo' && e.minijogo.passo === 'apresenta' && e.j.every((p, k) => p.cpu || e.minijogo.prontos[k])) e.prazo = Math.min(e.prazo, agora);
  if (agora < e.prazo) return false;
  switch (e.fase) {
    case 'ordem': return fecharOrdem(e, agora);
    case 'turno': return passoDoTurno(e, agora);
    case 'anuncio': return comecarRodada(e, agora);
    case 'minijogo': return passoDoMinijogo(e, agora);
    case 'bonus': return passoDoBonus(e, agora);
    default: return false;
  }
}

function fecharOrdem(e, agora) {
  for (const p of e.j) if (p.ordemDado == null) p.ordemDado = dado(e.rnd);
  e.ordem = e.j.map((_, k) => k).sort((a, b) => e.j[b].ordemDado - e.j[a].ordemDado || a - b);
  mensagem(e, `${e.j[e.ordem[0]].nome} começa!`, 'info');
  e.fase = 'turno';
  e.vez = 0;
  comecarVez(e, agora);
  return true;
}

// Com mais de 5 coelhos as pausas encurtam, para a rodada não ficar longa demais.
const ritmo = e => (e.j.length > 7 ? 0.6 : e.j.length > 5 ? 0.75 : 1);

function comecarVez(e, agora) {
  const p = daVez(e);
  e.passo = 'decidir';
  e.dado = null;
  e.andar = null;
  e.pausa = null;
  e.dadosExtras = 0;
  e.prazo = agora + ms(p.cpu || p.saiu ? 1400 * ritmo(e) : 20000);
  e.cpuEm = agora + ms(1100 * ritmo(e));
}

function passoDoTurno(e, agora) {
  const k = indiceDaVez(e);
  const p = e.j[k];
  switch (e.passo) {
    case 'decidir':
      // O tempo acabou (ou é computador): joga o dado.
      decidir(e, k, { tipo: 'rolar' }, agora);
      return true;
    case 'dado':
      e.andar = { restam: e.dado.total, forcado: null };
      e.passo = 'andar';
      e.prazo = agora + ms(200);
      return true;
    case 'andar':
      return andarUmaCasa(e, k, agora);
    case 'pausa':
      // Ninguém respondeu a tempo: segue sem comprar e pelo primeiro caminho.
      if (e.pausa.tipo === 'caminho') e.andar.forcado = TABULEIRO[p.pos].prox[0];
      retomar(e, agora);
      return true;
    case 'efeito':
      return proximaVez(e, agora);
    default:
      return false;
  }
}

function andarUmaCasa(e, k, agora) {
  const p = e.j[k];
  const prox = TABULEIRO[p.pos].prox;
  if (prox.length > 1 && e.andar.forcado == null) {
    e.passo = 'pausa';
    e.pausa = { tipo: 'caminho', opcoes: prox };
    e.prazo = agora + ms(p.cpu ? 1500 : 15000);
    e.cpuEm = agora + ms(900);
    return true;
  }
  p.pos = e.andar.forcado ?? prox[0];
  e.andar.forcado = null;
  e.andar.restam--;
  // Passou pela cenoura dourada: pode comprar (se tiver as cenouras).
  if (p.pos === e.dourada && p.cenouras >= PRECO_DOURADA) {
    e.passo = 'pausa';
    e.pausa = { tipo: 'compra', preco: PRECO_DOURADA };
    e.prazo = agora + ms(p.cpu ? 1600 : 15000);
    e.cpuEm = agora + ms(1000);
    return true;
  }
  if (p.pos === e.dourada) mensagem(e, `${p.nome} passou pela cenoura dourada, mas não tinha ${PRECO_DOURADA} cenouras.`, 'info');
  // Passou por uma loja: pode comprar um item.
  if (TABULEIRO[p.pos].tipo === 'loja' && p.itens.length < MAX_ITENS && p.cenouras >= ITENS.dado2.preco) {
    e.passo = 'pausa';
    e.pausa = { tipo: 'loja', itens: ITENS };
    e.prazo = agora + ms(p.cpu ? 1500 : 15000);
    e.cpuEm = agora + ms(1000);
    return true;
  }
  if (e.andar.restam > 0) {
    e.prazo = agora + ms(380);
    return true;
  }
  cairNaCasa(e, k, agora);
  return true;
}

function cairNaCasa(e, k, agora) {
  const p = e.j[k];
  const casa = TABULEIRO[p.pos];
  const dobro = ultimas(e) ? 2 : 1;
  let cor = 'azul';
  switch (casa.tipo) {
    case 'azul':
    case 'inicio':
      contar(e, k, 3 * dobro);
      mensagem(e, `${p.nome} caiu numa casa azul: +${3 * dobro} cenouras.`, 'azul');
      break;
    case 'vermelha': {
      const tirou = -contar(e, k, -3 * dobro);
      cor = 'vermelho';
      mensagem(e, `${p.nome} caiu numa casa vermelha: -${tirou} cenouras.`, 'vermelha');
      break;
    }
    case 'loja':
      contar(e, k, 3 * dobro);
      mensagem(e, `${p.nome} parou na loja: +${3 * dobro} cenouras.`, 'azul');
      break;
    case 'sorte':
      p.sortes++;
      cor = e.rnd() < 0.5 ? 'azul' : 'vermelho';
      sorteGrande(e, k, agora);
      break;
    case 'raposo':
      cor = 'vermelho';
      raposo(e, k);
      break;
    default: break;
  }
  p.ultimaCor = cor;
  e.passo = 'efeito';
  e.prazo = agora + ms(2600 * ritmo(e));
}

// As casas de sorte: um acontecimento sorteado.
function sorteGrande(e, k) {
  const p = e.j[k];
  const outros = e.j.map((_, x) => x).filter(x => x !== k && !e.j[x].saiu);
  const r = e.rnd();
  if (r < 0.03) {
    p.douradas++;
    mensagem(e, `SORTE GRANDE! ${p.nome} achou uma cenoura dourada enterrada no jardim!`, 'dourada');
  } else if (r < 0.2) {
    for (let x = 0; x < e.j.length; x++) contar(e, x, 5);
    mensagem(e, 'Chuva de cenouras! Todo mundo ganhou 5.', 'sorte');
  } else if (r < 0.38) {
    contar(e, k, 10);
    mensagem(e, `${p.nome} achou um baú escondido: +10 cenouras!`, 'sorte');
  } else if (r < 0.55 && outros.length) {
    const o = outros[Math.floor(e.rnd() * outros.length)];
    [p.pos, e.j[o].pos] = [e.j[o].pos, p.pos];
    mensagem(e, `Redemoinho! ${p.nome} trocou de lugar com ${e.j[o].nome}.`, 'sorte');
  } else if (r < 0.7) {
    const antiga = e.dourada;
    const opcoes = AZUIS.filter(id => id !== antiga);
    e.dourada = opcoes[Math.floor(e.rnd() * opcoes.length)];
    mensagem(e, 'A cenoura dourada saiu correndo e foi parar em outro lugar!', 'sorte');
  } else if (r < 0.85 && outros.length) {
    const ultimo = [...outros].sort((a, b) => e.j[a].cenouras - e.j[b].cenouras)[0];
    const deu = -contar(e, k, -5);
    contar(e, ultimo, deu);
    mensagem(e, `Coração mole: ${p.nome} deu ${deu} cenouras para ${e.j[ultimo].nome}.`, 'sorte');
  } else {
    const n = 2 + Math.floor(e.rnd() * 3);
    contar(e, k, n * 2);
    mensagem(e, `Horta farta: ${p.nome} colheu ${n * 2} cenouras.`, 'sorte');
  }
}

// As casas do Raposo.
function raposo(e, k) {
  const p = e.j[k];
  const r = e.rnd();
  if (p.douradas > 0 && r < 0.12) {
    p.douradas--;
    contar(e, k, 15);
    mensagem(e, `O RAPOSO trocou uma cenoura dourada de ${p.nome} por 15 cenouras! Que malandro!`, 'raposo');
  } else if (r < 0.6) {
    const tirou = -contar(e, k, -10);
    mensagem(e, `O Raposo roubou ${tirou} cenouras de ${p.nome}!`, 'raposo');
  } else {
    for (let x = 0; x < e.j.length; x++) contar(e, x, -5);
    mensagem(e, 'Imposto do Raposo: todo mundo perdeu 5 cenouras!', 'raposo');
  }
}

function proximaVez(e, agora) {
  e.vez++;
  e.msg = null;
  if (e.vez < e.ordem.length) {
    comecarVez(e, agora);
    return true;
  }
  comecarMinijogo(e, agora);
  return true;
}

/* ─── Minijogos ───────────────────────────────────── */

function comecarMinijogo(e, agora) {
  const cores = e.j.map(p => p.ultimaCor || 'azul');
  const azuis = cores.filter(c => c === 'azul').length;
  const formato = azuis === 0 || azuis === e.j.length ? 'todos' : 'times';
  const escolhas = Object.keys(MINIJOGOS).filter(m => !e.ultimosMinijogos.includes(m));
  const id = escolhas[Math.floor(e.rnd() * escolhas.length)];
  e.ultimosMinijogos.push(id);
  if (e.ultimosMinijogos.length > 3) e.ultimosMinijogos.shift();
  e.fase = 'minijogo';
  e.minijogo = {
    id, formato, nome: MINIJOGOS[id].nome, tipo: MINIJOGOS[id].tipo, duracao: MINIJOGOS[id].duracao,
    times: formato === 'times' ? cores : e.j.map(() => null),
    semente: Math.floor(e.rnd() * 2 ** 31), n: (e.minijogo?.n || 0) + 1,
    passo: 'apresenta', prontos: e.j.map(() => false), inicio: null, resultados: e.j.map(() => null), pegos: new Set(), vencedores: null,
  };
  e.msg = null;
  e.prazo = agora + ms(12000);
}

function passoDoMinijogo(e, agora) {
  const m = e.minijogo;
  if (m.passo === 'apresenta') {
    m.passo = 'jogando';
    m.inicio = agora + ms(3000); // contagem de 3 segundos
    e.prazo = m.inicio + ms((m.duracao + 5) * 1000);
    return true;
  }
  if (m.passo === 'jogando') {
    fecharMinijogo(e, agora);
    return true;
  }
  // resultado mostrado: próxima rodada (ou as estrelas bônus)
  e.minijogo = { ...m, passo: 'fechado' };
  if (e.rodada >= e.rodadas) {
    e.fase = 'bonus';
    e.bonus = { mostradas: 0, estrelas: estrelasBonus(e) };
    e.prazo = agora + ms(3500);
    return true;
  }
  e.rodada++;
  if (e.rodada === e.rodadas - 2) {
    e.fase = 'anuncio';
    mensagem(e, 'Últimas 3 rodadas! As casas azuis e vermelhas agora valem o dobro.', 'anuncio');
    e.prazo = agora + ms(4000);
    return true;
  }
  return comecarRodada(e, agora);
}

function comecarRodada(e, agora) {
  e.fase = 'turno';
  e.vez = 0;
  comecarVez(e, agora);
  return true;
}

// Um resultado de minijogo: { pontos, vivo, tempo }. Cada um manda o seu; o primeiro humano manda o dos coelhos da casa.
function resultadoMinijogo(e, i, k, r = {}) {
  const m = e.minijogo;
  if (e.fase !== 'minijogo' || m.passo !== 'jogando') return false;
  const alvo = e.j[k];
  if (!alvo) return false;
  const anfitriao = e.j.findIndex(p => !p.cpu && !p.saiu);
  if (k !== i && !(alvo.cpu && i === anfitriao)) return false;
  if (m.resultados[k]) return false;
  m.resultados[k] = {
    pontos: Math.max(0, Math.min(10_000, Math.floor(Number(r.pontos) || 0))),
    vivo: !!r.vivo,
    tempo: Math.max(0, Math.min(600, Number(r.tempo) || 0)),
  };
  if (m.resultados.every(Boolean)) e.prazo = Math.min(e.prazo, Date.now() + ms(800));
  return true;
}

// Quem ganhou o minijogo (individual ou o time). Quem não mandou resultado conta como o pior.
function fecharMinijogo(e, agora) {
  const m = e.minijogo;
  const res = m.resultados.map((r, k) => r || (e.j[k].cpu
    ? { pontos: Math.floor(e.rnd() * 6), vivo: e.rnd() < 0.3, tempo: e.rnd() * m.duracao }
    : { pontos: 0, vivo: false, tempo: 0 }));
  const nota = r => (m.tipo === 'sobrevivencia' ? (r.vivo ? 10_000 : r.tempo) : m.tipo === 'corrida' ? (r.vivo ? 10_000 - r.tempo : r.pontos / 1000) : r.pontos);
  const notas = res.map(nota);
  let vencedores;
  if (m.formato === 'times') {
    const media = cor => {
      const ks = e.j.map((_, k) => k).filter(k => m.times[k] === cor);
      if (!ks.length) return -1;
      // Média do time (times de tamanhos diferentes ficam justos): sobrevivência = segundos de pé,
      // corrida = 100 + o tempo que sobrou para quem chegou, ou o quanto andou para quem não chegou.
      const notaTime = r => (m.tipo === 'sobrevivencia' ? (r.vivo ? m.duracao : r.tempo) : m.tipo === 'corrida' ? (r.vivo ? 100 + (m.duracao - r.tempo) : r.pontos) : r.pontos);
      return ks.reduce((s, k) => s + notaTime(res[k]), 0) / ks.length;
    };
    const a = media('azul');
    const v = media('vermelho');
    const time = a === v ? null : a > v ? 'azul' : 'vermelho';
    vencedores = time ? e.j.map((_, k) => k).filter(k => m.times[k] === time) : [];
  } else {
    const max = Math.max(...notas);
    vencedores = max > 0 ? e.j.map((_, k) => k).filter(k => notas[k] === max) : [];
  }
  for (const k of vencedores) {
    contar(e, k, 10);
    e.j[k].ganhoMinijogo += 10;
  }
  m.vencedores = vencedores;
  m.placar = res;
  m.passo = 'resultado';
  e.prazo = agora + ms(5500);
  mensagem(e, vencedores.length ? `${vencedores.map(k => e.j[k].nome).join(' e ')} ${vencedores.length > 1 ? 'venceram' : 'venceu'} o minijogo: +10 cenouras!` : 'Ninguém venceu o minijogo.', 'minijogo');
}

/* ─── Estrelas bônus e o fim ─────────────────────── */

function estrelasBonus(e) {
  const melhor = (campo, titulo, desc) => {
    const max = Math.max(...e.j.map(p => p[campo]));
    return { titulo, desc, quem: max > 0 ? e.j.map((p, k) => (p[campo] === max ? k : -1)).filter(k => k >= 0) : [] };
  };
  return [
    melhor('ganhoMinijogo', 'Mestre dos Minijogos', 'quem ganhou mais cenouras nos minijogos'),
    melhor('ganhos', 'Rei das Cenouras', 'quem juntou mais cenouras na festa inteira'),
    melhor('sortes', 'Aventureiro', 'quem caiu em mais casas de sorte'),
  ];
}

function passoDoBonus(e, agora) {
  const b = e.bonus;
  if (b.mostradas < b.estrelas.length) {
    const est = b.estrelas[b.mostradas];
    for (const k of est.quem) e.j[k].douradas++;
    b.mostradas++;
    mensagem(e, est.quem.length ? `Estrela bônus "${est.titulo}" (${est.desc}): ${est.quem.map(k => e.j[k].nome).join(' e ')}!` : `Estrela bônus "${est.titulo}": ninguém levou.`, 'dourada');
    e.prazo = agora + ms(3500);
    return true;
  }
  e.fim = 'acabou';
  e.fase = 'fim';
  e.vencedores = ranking(e).filter(r => r.pos === 1).map(r => r.k);
  return true;
}

// A classificação: cenouras douradas e, no empate, cenouras.
function ranking(e) {
  const ordem = e.j.map((p, k) => ({ k, d: p.douradas, c: p.cenouras }))
    .sort((a, b) => b.d - a.d || b.c - a.c);
  let pos = 0;
  return ordem.map((r, x) => {
    if (x === 0 || r.d !== ordem[x - 1].d || r.c !== ordem[x - 1].c) pos = x + 1;
    return { ...r, pos };
  });
}

/* ─── O computador ────────────────────────────────── */

function jogarCpu(e, agora) {
  const k = indiceDaVez(e);
  const p = e.j[k];
  if (e.passo === 'decidir') {
    const item = p.itens.includes('dado3') ? 'dado3' : p.itens.includes('dado2') ? 'dado2' : null;
    if (item && !e.dadosExtras) decidir(e, k, { tipo: 'item', item }, agora);
    decidir(e, k, { tipo: 'rolar' }, agora);
    return true;
  }
  if (e.passo === 'pausa' && e.pausa) {
    if (e.pausa.tipo === 'caminho') {
      const prox = TABULEIRO[p.pos].prox;
      const melhor = prox.map((id, x) => ({ x, d: distancia(id, e.dourada) })).sort((a, b) => a.d - b.d)[0].x;
      decidir(e, k, { tipo: 'caminho', k: e.rnd() < 0.75 ? melhor : Math.floor(e.rnd() * prox.length) }, agora);
    } else if (e.pausa.tipo === 'compra') {
      decidir(e, k, { tipo: 'comprar', sim: true }, agora);
    } else {
      const item = p.cenouras >= 45 ? 'dado3' : p.cenouras >= 30 ? 'dado2' : null;
      decidir(e, k, { tipo: 'loja', item }, agora);
    }
    return true;
  }
  return false;
}

/* ─── Saídas, eventos dos minijogos e o que cada um vê ─── */

// Quem sai no meio vira um coelho da casa (a festa continua).
function sair(e, k) {
  const p = e.j[k];
  if (!p) return;
  p.saiu = true;
  p.cpu = true;
  p.nome = `${p.nome} (casa)`;
}

// Eventos do minijogo: pegar (o primeiro leva), resultado, e o resto só é repassado.
function evento(e, i, ev = {}) {
  if (e.fase !== 'minijogo' || e.minijogo?.passo !== 'jogando') return null;
  const tipo = String(ev.tipo || '');
  if (tipo === 'pegar') {
    const chave = String(ev.chave || '').slice(0, 40);
    if (e.minijogo.pegos.has(chave)) return null;
    e.minijogo.pegos.add(chave);
    return { todos: [{ tipo: 'pegou', chave, i }] };
  }
  if (tipo === 'resultado') {
    const k = Number.isInteger(ev.k) ? ev.k : i;
    return resultadoMinijogo(e, i, k, ev.r) ? { mudou: true } : null;
  }
  const texto = JSON.stringify(ev);
  if (texto.length > 400 || !/^[a-z]{2,20}$/.test(tipo)) return null;
  return { outros: { ...ev, i } };
}

function visao(e, agora = Date.now()) {
  const m = e.minijogo;
  return {
    rodada: e.rodada, rodadas: e.rodadas, fase: e.fase, passo: e.passo, prazoEm: e.prazo - agora,
    tab: e.tab, dourada: e.dourada, ordem: e.ordem, vez: e.ordem.length ? indiceDaVez(e) : null,
    j: e.j.map(({ id, nome, cpu, visual, pos, cenouras, douradas, itens, ordemDado, ultimaCor, saiu }) => ({ id, nome, cpu, visual, pos, cenouras, douradas, itens, ordemDado, ultimaCor, saiu })),
    dado: e.dado, andar: e.andar ? { restam: e.andar.restam } : null, pausa: e.pausa, msg: e.msg, historico: e.historico.slice(-8),
    ultimas: ultimas(e),
    minijogo: m && m.passo !== 'fechado' ? {
      id: m.id, nome: m.nome, formato: m.formato, tipo: m.tipo, duracao: m.duracao, times: m.times, semente: m.semente, n: m.n,
      passo: m.passo, prontos: m.prontos, inicioEm: m.inicio ? m.inicio - agora : null, vencedores: m.vencedores, placar: m.placar || null,
      chegaram: m.resultados.map(Boolean),
    } : null,
    bonus: e.bonus ? { mostradas: e.bonus.mostradas, estrelas: e.bonus.estrelas.slice(0, e.bonus.mostradas) } : null,
    fim: e.fim, vencedores: e.vencedores, ranking: e.fim ? ranking(e) : null, itensLoja: ITENS, precoDourada: PRECO_DOURADA,
  };
}

module.exports = {
  ErroFesta, ITENS, MINIJOGOS, TABULEIRO, RODADAS, PRECO_DOURADA, opcoes, novo, agir, passo, evento, sair, visao, ranking, distancia,
};
