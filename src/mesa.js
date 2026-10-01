// Jogos de mesa compartilhada: todo mundo no mesmo tabuleiro, que fica no servidor.
//  - Campo Minado (co-op): todos abrem o mesmo campo. Se alguém pisar numa armadilha, a equipe perde.
//  - Quebra-cabeça (co-op): todos trocam as peças da mesma imagem até montar.
//  - Memória: cada um na sua vez vira duas cartas. Versus: quem achar mais pares vence.
//    Co-op: a equipe precisa achar todos os pares sem passar da meta de jogadas.
// Só as regras (sem rede): recreacao.js cuida das salas e de mandar o tabuleiro para todo mundo.

class ErroMesa extends Error {}

const embaralhar = (lista, sorte = Math.random) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ─── Campo Minado ────────────────────────────────── */

const DIFICULDADES = {
  facil: { nome: 'Fácil', lin: 9, col: 9, minas: 10 },
  medio: { nome: 'Médio', lin: 16, col: 16, minas: 40 },
  dificil: { nome: 'Difícil', lin: 16, col: 30, minas: 99 },
};

function vizinhos(i, lin, col) {
  const [l, c] = [Math.floor(i / col), i % col];
  const v = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dl || dc) && l + dl >= 0 && l + dl < lin && c + dc >= 0 && c + dc < col) v.push((l + dl) * col + c + dc);
    }
  }
  return v;
}

const minado = {
  opcoes: (o = {}) => ({ dificuldade: DIFICULDADES[o.dificuldade] ? o.dificuldade : 'facil' }),
  novo(o) {
    const d = DIFICULDADES[o.dificuldade];
    const total = d.lin * d.col;
    return {
      jogo: 'minado', d: o.dificuldade, lin: d.lin, col: d.col, nMinas: d.minas,
      minas: null, numeros: Array(total).fill(0), abertas: Array(total).fill(0), bandeiras: Array(total).fill(0),
      fim: null, explodiu: -1, quemExplodiu: null, inicio: null, terminou: null, ultimo: null,
    };
  },
  plantar(e, primeira, sorte = Math.random) {
    const proibidas = new Set([primeira, ...vizinhos(primeira, e.lin, e.col)]);
    const livres = e.abertas.map((_, i) => i).filter(i => !proibidas.has(i));
    e.minas = new Set(embaralhar(livres, sorte).slice(0, e.nMinas));
    e.numeros = e.numeros.map((_, i) => vizinhos(i, e.lin, e.col).filter(v => e.minas.has(v)).length);
  },
  abrir(e, i, quem) {
    if (e.abertas[i] || e.bandeiras[i]) return;
    if (!e.minas) { minado.plantar(e, i); e.inicio = Date.now(); }
    if (e.minas.has(i)) {
      e.fim = 'perdeu';
      e.explodiu = i;
      e.quemExplodiu = quem;
      return;
    }
    const fila = [i];
    while (fila.length) {
      const k = fila.pop();
      if (e.abertas[k] || e.bandeiras[k]) continue;
      e.abertas[k] = 1;
      if (e.numeros[k] === 0) for (const v of vizinhos(k, e.lin, e.col)) if (!e.abertas[v] && !e.minas.has(v)) fila.push(v);
    }
    const fechadas = e.abertas.filter(a => !a).length;
    if (fechadas === e.nMinas) {
      e.fim = 'ganhou';
      for (const m of e.minas) e.bandeiras[m] = 1;
    }
  },
  // jogada = { tipo: 'abrir' | 'marcar', casa }. Abrir um número com as bandeiras certas em volta abre o resto.
  agir(e, i, { tipo, casa } = {}) {
    if (e.fim) throw new ErroMesa('O jogo já acabou.');
    if (!Number.isInteger(casa) || casa < 0 || casa >= e.abertas.length) throw new ErroMesa('Escolha uma casa do campo.');
    if (tipo === 'marcar') {
      if (!e.abertas[casa]) e.bandeiras[casa] = e.bandeiras[casa] ? 0 : 1;
    } else if (e.abertas[casa]) {
      const viz = vizinhos(casa, e.lin, e.col);
      if (viz.filter(v => e.bandeiras[v]).length === e.numeros[casa]) {
        for (const v of viz) if (!e.abertas[v] && !e.bandeiras[v] && !e.fim) minado.abrir(e, v, i);
      }
    } else {
      minado.abrir(e, casa, i);
    }
    e.ultimo = { i, casa };
    if (e.fim) e.terminou = Date.now();
  },
  codigo(e, i) {
    if (e.fim && e.minas) {
      if (i === e.explodiu) return 'x';
      if (e.minas.has(i) && !e.bandeiras[i]) return 'm';
      if (e.bandeiras[i] && !e.minas.has(i)) return 'e';
    }
    if (e.bandeiras[i]) return 'f';
    return e.abertas[i] ? String(e.numeros[i]) : '.';
  },
  visao: e => ({
    jogo: 'minado', d: e.d, v: e.abertas.map((_, i) => minado.codigo(e, i)).join(''), fim: e.fim,
    restam: e.nMinas - e.bandeiras.reduce((a, b) => a + b, 0), quemExplodiu: e.quemExplodiu, ultimo: e.ultimo,
    seg: e.inicio ? Math.floor(((e.terminou || Date.now()) - e.inicio) / 1000) : 0,
  }),
  vencedores: (e, ativos) => (e.fim === 'ganhou' ? ativos : []),
};

/* ─── Quebra-cabeça ───────────────────────────────── */

const TAMANHOS_QUEBRA = [3, 4, 5];
const fotoValida = src => typeof src === 'string' && (/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(src) || src === '/img/brasao.png');

const quebra = {
  opcoes: (o = {}) => ({
    n: TAMANHOS_QUEBRA.includes(Number(o.n)) ? Number(o.n) : 3,
    src: fotoValida(o.src) ? o.src : '/img/brasao.png',
    titulo: String(o.titulo || '').slice(0, 80),
  }),
  novo(o, n, sorte = Math.random) {
    const total = o.n * o.n;
    let pecas;
    do pecas = embaralhar([...Array(total).keys()], sorte); while (pecas.filter((p, i) => p === i).length > Math.floor(total / 4));
    return { jogo: 'quebra', n: o.n, src: o.src, titulo: o.titulo, pecas, movs: 0, fim: null, inicio: Date.now(), terminou: null, ultimo: null, porPessoa: Array(n).fill(0) };
  },
  agir(e, i, { tipo, a, b } = {}) {
    if (e.fim) throw new ErroMesa('A imagem já está montada.');
    const total = e.n * e.n;
    if (tipo !== 'trocar' || ![a, b].every(x => Number.isInteger(x) && x >= 0 && x < total) || a === b) throw new ErroMesa('Escolha duas peças.');
    [e.pecas[a], e.pecas[b]] = [e.pecas[b], e.pecas[a]];
    e.movs++;
    e.porPessoa[i] = (e.porPessoa[i] || 0) + 1;
    e.ultimo = { i, a, b };
    if (e.pecas.every((p, k) => p === k)) { e.fim = 'montado'; e.terminou = Date.now(); }
  },
  visao: e => ({
    jogo: 'quebra', n: e.n, src: e.src, titulo: e.titulo, p: e.pecas, movs: e.movs, fim: e.fim, ultimo: e.ultimo, porPessoa: e.porPessoa,
    seg: Math.floor(((e.terminou || Date.now()) - e.inicio) / 1000),
  }),
  vencedores: (e, ativos) => (e.fim === 'montado' ? ativos : []),
};

/* ─── Memória ─────────────────────────────────────── */

const TAMANHOS_MEMORIA = { '4x4': 16, '4x6': 24, '6x6': 36 };
const FIGURAS = 20; // quantas figuras diferentes a tela tem (veja FIGURAS em recreacao.js)

const memoria = {
  opcoes: (o = {}) => ({
    tamanho: TAMANHOS_MEMORIA[o.tamanho] ? o.tamanho : '4x4',
    modo: o.modo === 'coop' ? 'coop' : 'versus',
  }),
  novo(o, n, sorte = Math.random) {
    const total = TAMANHOS_MEMORIA[o.tamanho];
    const figs = embaralhar([...Array(FIGURAS).keys()], sorte).slice(0, total / 2);
    const pares = total / 2;
    return {
      jogo: 'memoria', t: o.tamanho, modo: o.modo, cartas: embaralhar([...figs, ...figs], sorte),
      achada: Array(total).fill(-1), abertas: [], vez: 0, jogadas: 0, pares: Array(n).fill(0),
      meta: o.modo === 'coop' ? pares * 2 : null, fechar: false, fim: null, inicio: Date.now(), terminou: null,
    };
  },
  // jogada = { casa }. Cada um vira duas cartas na sua vez; achou o par, joga de novo.
  agir(e, i, { casa } = {}, ativos = []) {
    if (e.fim) throw new ErroMesa('O jogo já acabou.');
    if (e.vez !== i) throw new ErroMesa('Espere a sua vez.');
    if (e.fechar) throw new ErroMesa('Espere as cartas virarem de volta.');
    if (!Number.isInteger(casa) || casa < 0 || casa >= e.cartas.length || e.achada[casa] >= 0 || e.abertas.includes(casa)) {
      throw new ErroMesa('Escolha uma carta fechada.');
    }
    e.abertas.push(casa);
    if (e.abertas.length < 2) return;
    e.jogadas++;
    const [a, b] = e.abertas;
    if (e.cartas[a] === e.cartas[b]) {
      e.achada[a] = i;
      e.achada[b] = i;
      e.pares[i]++;
      e.abertas = [];
      if (e.achada.every(x => x >= 0)) { e.fim = e.modo === 'coop' ? (e.jogadas <= e.meta ? 'ganhou' : 'perdeu') : 'acabou'; e.terminou = Date.now(); }
      else if (e.meta && e.jogadas >= e.meta) { e.fim = 'perdeu'; e.terminou = Date.now(); }
    } else {
      e.fechar = true; // o servidor vira de volta depois de um instante (fecharCartas)
      if (e.meta && e.jogadas >= e.meta) { e.fim = 'perdeu'; e.terminou = Date.now(); }
    }
    void ativos;
  },
  // Vira de volta as duas cartas erradas e passa a vez para o próximo que ainda está na sala.
  fecharCartas(e, ativos) {
    if (!e.fechar) return;
    e.fechar = false;
    e.abertas = [];
    memoria.passarVez(e, ativos);
  },
  passarVez(e, ativos) {
    if (!ativos.length) return;
    const proximos = [...ativos.filter(k => k > e.vez), ...ativos.filter(k => k <= e.vez)];
    e.vez = proximos[0];
  },
  visao: e => ({
    jogo: 'memoria', t: e.t, modo: e.modo,
    v: e.cartas.map((f, k) => (e.achada[k] >= 0 || e.abertas.includes(k) ? f : -1)), quem: e.achada,
    abertas: e.abertas, vez: e.vez, jogadas: e.jogadas, pares: e.pares, meta: e.meta, fim: e.fim,
    seg: Math.floor(((e.terminou || Date.now()) - e.inicio) / 1000),
  }),
  // Versus: quem achou mais pares (empate: todos os empatados). Co-op: todo mundo, se a equipe ganhou.
  vencedores(e, ativos) {
    if (e.modo === 'coop') return e.fim === 'ganhou' ? ativos : [];
    const max = Math.max(...ativos.map(k => e.pares[k]));
    const melhores = ativos.filter(k => e.pares[k] === max);
    return melhores.length === 1 ? melhores : [];
  },
};

const MESAS = { minado, quebra, memoria };

module.exports = { MESAS, ErroMesa, DIFICULDADES, TAMANHOS_MEMORIA, TAMANHOS_QUEBRA };
