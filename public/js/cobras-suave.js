// Cobrinha ao vivo lisa na tela. O servidor manda o tabuleiro umas 8 vezes por segundo, e pela
// internet os quadros chegam em ritmo irregular. A tela desenha 60 vezes por segundo: a cada quadro
// que chega, cada cobra sai de onde está desenhada e desliza até a casa seguinte (prevista).
// A sua cobra já vira na hora em que você aperta, quando ainda dá tempo de o servidor aplicar a
// virada no próximo passo (depende do atraso da conexão, medido com "ping").
// Aqui não tem nada de tela: só as contas (dá para testar sem navegador). O desenho fica em desenho-cobra.js.

const mesmaDirecao = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const contraria = (a, b) => !!a && !!b && a[0] === -b[0] && a[1] === -b[1];
const pares = lista => {
  const saida = [];
  for (let k = 0; k + 1 < lista.length; k += 2) saida.push([lista[k], lista[k + 1]]);
  return saida;
};
const chave = ([x, y]) => `${x},${y}`;
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

export class SuavizadorCobras {
  constructor() {
    this.q = null;         // último quadro do servidor
    this.eu = -1;          // índice da minha cobra (ou -1, só assistindo)
    this.passo = 125;      // milissegundos entre os passos do servidor
    this.rtt = 150;        // ida e volta até o servidor (medido)
    this.vis = [];         // por cobra: { desde, ate, inicio, dur, dir }
    this.pendentes = [];   // viradas minhas que o servidor ainda não aplicou: { dir, em }
  }

  // Onde cada cobra estará no próximo passo: anda uma casa (ou fica, se for bater).
  prever(corpo, dir, ocupado) {
    const q = this.q;
    const cabeca = corpo[0];
    const nova = [cabeca[0] + dir[0], cabeca[1] + dir[1]];
    if (nova[0] < 0 || nova[1] < 0 || nova[0] >= q.l || nova[1] >= q.a || ocupado.has(chave(nova))) return corpo;
    let come = false;
    for (let k = 0; k + 1 < q.f.length; k += 2) if (q.f[k] === nova[0] && q.f[k + 1] === nova[1]) come = true;
    return [nova, ...(come ? corpo : corpo.slice(0, -1))];
  }

  // A direção da minha cobra no próximo passo: a virada pendente, se o servidor já vai ter recebido.
  direcaoMinha(c, inicioDoPasso) {
    const p = this.pendentes[0];
    if (p && p.em < inicioDoPasso + this.passo - this.rtt && !contraria(p.dir, c.d)) return p.dir;
    return c.d;
  }

  ocupados() {
    const ocupado = new Set();
    for (const c of this.q.c) if (c.v) pares(c.b).slice(0, -1).forEach(p => ocupado.add(chave(p)));
    return ocupado;
  }

  // Chegou um quadro do servidor.
  receber(q, agora, eu = -1) {
    this.eu = eu;
    if (q.ms) this.passo = q.ms;
    const desenhadas = this.vis.map(v => (v ? this.pontosDe(v, agora) : null));
    this.q = q;
    const minha = q.c[eu];
    if (minha) {
      // Tira as viradas que o servidor já aplicou (ou que ficaram velhas: foram recusadas).
      if (this.pendentes.length && mesmaDirecao(this.pendentes[0].dir, minha.d)) this.pendentes.shift();
      this.pendentes = this.pendentes.filter(p => agora - p.em < this.rtt + this.passo * 3);
    } else {
      this.pendentes = [];
    }
    const andando = q.fase === 'jogando';
    const ocupado = this.ocupados();
    this.vis = q.c.map((c, i) => {
      if (!c.v || !c.b.length) return null;
      const corpo = pares(c.b);
      const dir = i === eu ? this.direcaoMinha(c, agora) : c.d;
      const ate = andando ? this.prever(corpo, dir, ocupado) : corpo;
      let desde = andando ? desenhadas[i] : null; // na contagem e no fim, a posição exata
      // Primeiro quadro, ou a cobra está longe de onde era desenhada (ex.: nova partida): começa do lugar certo.
      if (!desde || !desde.length || Math.hypot(desde[0][0] - corpo[0][0], desde[0][1] - corpo[0][1]) > 2.5) desde = corpo;
      return { desde, ate, inicio: agora, dur: this.passo, dir, corpo };
    });
  }

  // Apertei uma seta. Devolve true se a virada vale (não é meia-volta nem a mesma direção).
  virar(dir, agora) {
    const minha = this.q?.c[this.eu];
    if (!minha?.v) return false;
    const ultima = this.pendentes.length ? this.pendentes[this.pendentes.length - 1].dir : minha.d;
    if (mesmaDirecao(dir, ultima) || contraria(dir, ultima) || this.pendentes.length >= 2) return false;
    this.pendentes.push({ dir, em: agora });
    // Se ainda dá tempo de o servidor aplicar neste passo, a cobra já vira na tela.
    const v = this.vis[this.eu];
    if (v && this.q.fase === 'jogando' && this.pendentes.length === 1 && agora < v.inicio + this.passo - this.rtt) {
      const ate = this.prever(v.corpo, dir, this.ocupados());
      // Pelo menos meio passo para a curva: virar em cima da hora não dá um pulo na tela.
      const restante = Math.max(this.passo * 0.5, v.inicio + v.dur - agora);
      this.vis[this.eu] = { ...v, desde: this.pontosDe(v, agora), ate, inicio: agora, dur: restante, dir };
    }
    return true;
  }

  pontosDe(v, agora) {
    const f = Math.min(1, Math.max(0, (agora - v.inicio) / v.dur));
    return v.ate.map((p, k) => lerp(v.desde[k] || v.desde[v.desde.length - 1], p, f));
  }

  // O que desenhar agora: por cobra, os pontos (em casas, podendo ser fracionados) e a direção.
  quadro(agora) {
    return this.vis.map((v, i) => (v ? { i, pontos: this.pontosDe(v, agora), dir: i === this.eu && this.pendentes[0] ? this.pendentes[0].dir : v.dir } : null));
  }
}
