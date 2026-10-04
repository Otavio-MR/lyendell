// Jogos de mesa compartilhada: todo mundo no mesmo tabuleiro, que fica no servidor.
//  - Campo Minado. Co-op: todos abrem o mesmo campo; se alguém pisar numa armadilha, a equipe perde.
//    Versus: todos abrem o mesmo campo ao mesmo tempo; cada casa aberta é um ponto de quem abriu, e quem
//    pisa numa armadilha está fora (os pontos ficam). Vence quem abrir mais casas.
//  - Quebra-cabeça. Co-op: todos trocam as peças da mesma imagem até montar. Versus: a mesma imagem, e cada
//    peça que alguém põe no lugar certo fica presa e é ponto de quem pôs. Vence quem puser mais peças.
// Quanto mais gente, mais difícil: mais armadilhas no campo e mais peças no quebra-cabeça.
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

const modoDe = o => (o.modo === 'versus' ? 'versus' : 'coop');

const minado = {
  opcoes: (o = {}) => ({ dificuldade: DIFICULDADES[o.dificuldade] ? o.dificuldade : 'facil', modo: modoDe(o) }),
  novo(o, n = 1) {
    const d = DIFICULDADES[o.dificuldade];
    const total = d.lin * d.col;
    // Cada pessoa a mais põe 12% mais armadilhas (até um quarto do campo).
    const nMinas = Math.min(Math.floor(total / 4), Math.round(d.minas * (1 + 0.12 * Math.max(0, n - 1))));
    return {
      jogo: 'minado', d: o.dificuldade, modo: modoDe(o), lin: d.lin, col: d.col, nMinas,
      minas: null, numeros: Array(total).fill(0), abertas: Array(total).fill(0), bandeiras: Array(total).fill(0),
      // Versus: quem abriu cada casa, as bandeiras de cada um (só a pessoa vê as suas), os pontos e quem está fora.
      deQuem: Array(total).fill(-1), bandeirasDe: Array.from({ length: n }, () => new Set()), casas: Array(n).fill(0),
      fora: Array(n).fill(false), explodidas: [],
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
    const versus = e.modo === 'versus';
    if (e.abertas[i] || (versus ? e.explodidas.includes(i) : e.bandeiras[i])) return;
    if (!e.minas) { minado.plantar(e, i); e.inicio = Date.now(); }
    if (e.minas.has(i)) {
      if (versus) {
        // Versus: quem pisou está fora; a armadilha fica à mostra para os outros.
        e.fora[quem] = true;
        e.explodidas.push(i);
        e.explodiu = i;
        e.quemExplodiu = quem;
        return;
      }
      e.fim = 'perdeu';
      e.explodiu = i;
      e.quemExplodiu = quem;
      return;
    }
    const fila = [i];
    while (fila.length) {
      const k = fila.pop();
      if (e.abertas[k] || (!versus && e.bandeiras[k])) continue;
      e.abertas[k] = 1;
      e.deQuem[k] = quem;
      if (e.casas) e.casas[quem] = (e.casas[quem] || 0) + 1;
      if (e.numeros[k] === 0) for (const v of vizinhos(k, e.lin, e.col)) if (!e.abertas[v] && !e.minas.has(v)) fila.push(v);
    }
    const fechadas = e.abertas.filter(a => !a).length;
    if (fechadas === e.nMinas) {
      e.fim = versus ? 'limpo' : 'ganhou';
      for (const m of e.minas) e.bandeiras[m] = 1;
    }
  },
  // jogada = { tipo: 'abrir' | 'marcar', casa }. Abrir um número com as bandeiras certas em volta abre o resto.
  // No versus, cada um tem as suas bandeiras (ninguém engana ninguém com bandeira falsa).
  agir(e, i, { tipo, casa } = {}, ativos = []) {
    if (e.fim) throw new ErroMesa('O jogo já acabou.');
    if (!Number.isInteger(casa) || casa < 0 || casa >= e.abertas.length) throw new ErroMesa('Escolha uma casa do campo.');
    const versus = e.modo === 'versus';
    if (versus && e.fora[i]) throw new ErroMesa('Você pisou numa armadilha: agora só dá para assistir.');
    const marcada = k => (versus ? e.bandeirasDe[i].has(k) || e.explodidas.includes(k) : !!e.bandeiras[k]);
    if (tipo === 'marcar') {
      if (!e.abertas[casa]) {
        if (versus) { if (e.bandeirasDe[i].has(casa)) e.bandeirasDe[i].delete(casa); else e.bandeirasDe[i].add(casa); } else e.bandeiras[casa] = e.bandeiras[casa] ? 0 : 1;
      }
    } else if (e.abertas[casa]) {
      const viz = vizinhos(casa, e.lin, e.col);
      if (viz.filter(marcada).length === e.numeros[casa]) {
        for (const v of viz) if (!e.abertas[v] && !marcada(v) && !e.fim && !(versus && e.fora[i])) minado.abrir(e, v, i);
      }
    } else if (!marcada(casa)) {
      minado.abrir(e, casa, i);
    }
    e.ultimo = { i, casa };
    // Versus: se todos pisaram em armadilhas, acabou.
    if (versus && !e.fim && ativos.length && ativos.every(k => e.fora[k])) e.fim = 'todos-fora';
    if (e.fim) e.terminou = Date.now();
  },
  codigo(e, i, eu = -1) {
    if (e.modo === 'versus') {
      if (e.explodidas.includes(i)) return 'x';
      if (e.fim && e.minas?.has(i)) return 'm';
      if (eu >= 0 && e.bandeirasDe[eu]?.has(i) && !e.abertas[i]) return 'f';
      return e.abertas[i] ? String(e.numeros[i]) : '.';
    }
    if (e.fim && e.minas) {
      if (i === e.explodiu) return 'x';
      if (e.minas.has(i) && !e.bandeiras[i]) return 'm';
      if (e.bandeiras[i] && !e.minas.has(i)) return 'e';
    }
    if (e.bandeiras[i]) return 'f';
    return e.abertas[i] ? String(e.numeros[i]) : '.';
  },
  visao: (e, eu = -1) => ({
    jogo: 'minado', d: e.d, modo: e.modo, v: e.abertas.map((_, i) => minado.codigo(e, i, eu)).join(''), fim: e.fim,
    restam: e.modo === 'versus' ? e.nMinas - e.explodidas.length : e.nMinas - e.bandeiras.reduce((a, b) => a + b, 0),
    minas: e.nMinas, quemExplodiu: e.quemExplodiu, ultimo: e.ultimo,
    seg: e.inicio ? Math.floor(((e.terminou || Date.now()) - e.inicio) / 1000) : 0,
    // Versus: de quem é cada casa aberta (para pintar com a cor de cada um), os pontos e quem está fora.
    q: e.modo === 'versus' ? e.deQuem.map(k => (k >= 0 ? k.toString(36) : '-')).join('') : null,
    casas: e.modo === 'versus' ? e.casas : null, fora: e.modo === 'versus' ? e.fora : null,
  }),
  vencedores(e, ativos) {
    if (e.modo !== 'versus') return e.fim === 'ganhou' ? ativos : [];
    if (!ativos.length) return [];
    const max = Math.max(...ativos.map(k => e.casas[k]));
    const melhores = ativos.filter(k => e.casas[k] === max);
    return melhores.length === 1 && max > 0 ? melhores : [];
  },
};

/* ─── Quebra-cabeça ───────────────────────────────── */

const TAMANHOS_QUEBRA = [3, 4, 5];
const fotoValida = src => typeof src === 'string' && (/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(src) || src === '/img/brasao.png');

const quebra = {
  opcoes: (o = {}) => ({
    n: TAMANHOS_QUEBRA.includes(Number(o.n)) ? Number(o.n) : 3,
    src: fotoValida(o.src) ? o.src : '/img/brasao.png',
    titulo: String(o.titulo || '').slice(0, 80),
    modo: modoDe(o),
  }),
  novo(o, n, sorte = Math.random) {
    // Quanto mais gente, mais peças: 3 ou 4 pessoas montam pelo menos 4x4; 5 ou 6, 5x5.
    const lado = Math.max(o.n, n >= 5 ? 5 : n >= 3 ? 4 : 3);
    const total = lado * lado;
    let pecas;
    do pecas = embaralhar([...Array(total).keys()], sorte); while (pecas.filter((p, i) => p === i).length > Math.floor(total / 4));
    return {
      jogo: 'quebra', n: lado, src: o.src, titulo: o.titulo, modo: modoDe(o), pecas, movs: 0, fim: null, inicio: Date.now(), terminou: null, ultimo: null,
      porPessoa: Array(n).fill(0),
      // Versus: quem pôs cada peça no lugar (-2: já começou no lugar) e quantas cada um pôs.
      deQuem: pecas.map((p, k) => (p === k ? -2 : -1)), certas: Array(n).fill(0),
    };
  },
  agir(e, i, { tipo, a, b } = {}) {
    if (e.fim) throw new ErroMesa('A imagem já está montada.');
    const total = e.n * e.n;
    if (tipo !== 'trocar' || ![a, b].every(x => Number.isInteger(x) && x >= 0 && x < total) || a === b) throw new ErroMesa('Escolha duas peças.');
    const versus = e.modo === 'versus';
    if (versus && (e.deQuem[a] !== -1 || e.deQuem[b] !== -1)) throw new ErroMesa('Essa peça já está presa no lugar.');
    [e.pecas[a], e.pecas[b]] = [e.pecas[b], e.pecas[a]];
    e.movs++;
    e.porPessoa[i] = (e.porPessoa[i] || 0) + 1;
    e.ultimo = { i, a, b };
    if (versus) {
      for (const k of [a, b]) if (e.pecas[k] === k) { e.deQuem[k] = i; e.certas[i]++; }
    }
    if (e.pecas.every((p, k) => p === k)) { e.fim = 'montado'; e.terminou = Date.now(); }
  },
  visao: e => ({
    jogo: 'quebra', n: e.n, src: e.src, titulo: e.titulo, modo: e.modo, p: e.pecas, movs: e.movs, fim: e.fim, ultimo: e.ultimo, porPessoa: e.porPessoa,
    seg: Math.floor(((e.terminou || Date.now()) - e.inicio) / 1000),
    deQuem: e.modo === 'versus' ? e.deQuem : null, certas: e.modo === 'versus' ? e.certas : null,
  }),
  vencedores(e, ativos) {
    if (e.modo !== 'versus') return e.fim === 'montado' ? ativos : [];
    if (!ativos.length) return [];
    const max = Math.max(...ativos.map(k => e.certas[k]));
    const melhores = ativos.filter(k => e.certas[k] === max);
    return melhores.length === 1 && max > 0 ? melhores : [];
  },
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
