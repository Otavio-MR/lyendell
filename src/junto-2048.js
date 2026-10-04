// 2048 junto, rodando no servidor (veja junto.js).
//  - Co-op: UM tabuleiro e todos mexem nele ao mesmo tempo. A equipe precisa chegar no bloco da meta antes
//    do tempo acabar; sem jogada, a equipe perde. Mais gente: meta maior e blocos a mais aparecendo.
//  - Versus (batalha): cada um no seu tabuleiro, todos à vista. Juntar um bloco de 64 ou mais joga uma pedra
//    no tabuleiro de outra pessoa (a pedra não anda nem junta, e some depois de 8 jogadas de quem a recebeu).
//    Quem fica sem jogada está fora; vence quem sobrar (ou, no fim do tempo, quem tiver mais pontos).
// Pedra: número negativo no tabuleiro (-k: faltam k jogadas para sumir).

const LADO = 4;
const METAS = [512, 512, 512, 1024, 1024, 2048, 2048]; // pela quantidade de pessoas
const ESPERA_MS = 220; // no co-op, cada pessoa joga no máximo umas 4 vezes por segundo
const PEDRA_VIDA = 8;
const DIRECOES = ['cima', 'baixo', 'esquerda', 'direita'];

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

function tabuleiroNovo(sorte) {
  const g = Array(LADO * LADO).fill(0);
  novoBloco(g, sorte);
  novoBloco(g, sorte);
  return g;
}
function novoBloco(g, sorte) {
  const livres = g.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (!livres.length) return false;
  g[livres[Math.floor(sorte() * livres.length)]] = sorte() < 0.9 ? 2 : 4;
  return true;
}

// As posições de cada linha na direção do movimento (a primeira é a parede para onde tudo desliza).
function linhas(dir) {
  const r = [];
  for (let k = 0; k < LADO; k++) {
    const l = [];
    for (let p = 0; p < LADO; p++) {
      if (dir === 'esquerda') l.push(k * LADO + p);
      else if (dir === 'direita') l.push(k * LADO + (LADO - 1 - p));
      else if (dir === 'cima') l.push(p * LADO + k);
      else l.push((LADO - 1 - p) * LADO + k);
    }
    r.push(l);
  }
  return r;
}

// Desliza um tabuleiro. Pedras ficam paradas e dividem a linha em pedaços. Devolve { mexeu, pontos, juntou: [valores] }.
function deslizar(g, dir) {
  let mexeu = false;
  let pontos = 0;
  const juntou = [];
  for (const linha of linhas(dir)) {
    let ini = 0;
    while (ini < linha.length) {
      let fim = ini;
      while (fim < linha.length && g[linha[fim]] >= 0) fim++;
      // pedaço [ini, fim): sem pedras
      const pos = linha.slice(ini, fim);
      const vals = pos.map(p => g[p]).filter(v => v > 0);
      const saida = [];
      for (let k = 0; k < vals.length; k++) {
        if (k + 1 < vals.length && vals[k] === vals[k + 1]) {
          saida.push(vals[k] * 2);
          pontos += vals[k] * 2;
          juntou.push(vals[k] * 2);
          k++;
        } else saida.push(vals[k]);
      }
      pos.forEach((p, k) => {
        const v = saida[k] || 0;
        if (g[p] !== v) mexeu = true;
        g[p] = v;
      });
      ini = fim + 1;
    }
  }
  return { mexeu, pontos, juntou };
}
function temJogada(g) {
  return DIRECOES.some(d => deslizar([...g], d).mexeu);
}
// Cada jogada de quem recebeu as pedras gasta um pouco delas.
function gastarPedras(g) {
  for (let i = 0; i < g.length; i++) if (g[i] < 0) g[i] = g[i] + 1 === 0 ? 0 : g[i] + 1;
}

function novo({ modo, n, dif, semente }) {
  const sorte = sorteDe(semente);
  if (modo === 'coop') {
    return { modo, n, dif, sorte, g: tabuleiroNovo(sorte), pontos: 0, alvo: METAS[Math.min(n, METAS.length - 1)], ultimo: null, espera: Array(n).fill(0), fim: null, jogadas: 0 };
  }
  return {
    modo, n, dif, sorte,
    t: Array.from({ length: n }, () => ({ g: tabuleiroNovo(sorte), pontos: 0, fora: false, pedrasMandadas: 0, ultimo: null })),
    alvoDe: Array.from({ length: n }, (_, i) => (i + 1) % n), fim: null,
  };
}

function agir(sim, i, ev = {}, agora = Date.now()) {
  if (sim.fim || ev.tipo !== 'mover' || !DIRECOES.includes(ev.dir)) return null;
  if (sim.modo === 'coop') {
    if (agora - (sim.espera[i] || 0) < ESPERA_MS) return null;
    const r = deslizar(sim.g, ev.dir);
    if (!r.mexeu) return null;
    sim.espera[i] = agora;
    sim.pontos += r.pontos;
    sim.jogadas++;
    sim.ultimo = { i, dir: ev.dir };
    novoBloco(sim.g, sim.sorte);
    // Mais gente: às vezes aparece um bloco a mais.
    if (sim.sorte() < 0.1 * (sim.n - 1) * sim.dif) novoBloco(sim.g, sim.sorte);
    if (sim.g.some(v => v >= sim.alvo)) sim.fim = 'meta';
    else if (!temJogada(sim.g)) sim.fim = 'travou';
    return { mudou: !!sim.fim };
  }
  const t = sim.t[i];
  if (!t || t.fora) return null;
  const r = deslizar(t.g, ev.dir);
  if (!r.mexeu) return null;
  t.pontos += r.pontos;
  t.ultimo = ev.dir;
  gastarPedras(t.g);
  novoBloco(t.g, sim.sorte);
  // Bloco grande juntado: uma pedra para a próxima pessoa que ainda está no jogo.
  for (const v of r.juntou) {
    if (v < 64) continue;
    const pedras = v >= 256 ? 2 : 1;
    const alvo = proximoAlvo(sim, i);
    if (alvo < 0) break;
    for (let k = 0; k < pedras; k++) {
      const g = sim.t[alvo].g;
      const livres = g.map((x, p) => (x === 0 ? p : -1)).filter(p => p >= 0);
      if (!livres.length) break;
      g[livres[Math.floor(sim.sorte() * livres.length)]] = -PEDRA_VIDA;
      t.pedrasMandadas++;
    }
    if (!temJogada(sim.t[alvo].g)) sim.t[alvo].fora = true;
  }
  if (!temJogada(t.g)) t.fora = true;
  return { mudou: true };
}

function proximoAlvo(sim, i) {
  for (let k = 1; k < sim.n; k++) {
    const j = (sim.alvoDe[i] + k - 1) % sim.n;
    if (j !== i && !sim.t[j].fora) {
      sim.alvoDe[i] = (j + 1) % sim.n;
      return j;
    }
  }
  return -1;
}

function quadro(sim) {
  if (sim.modo === 'coop') return { modo: 'coop', g: sim.g, pontos: sim.pontos, alvo: sim.alvo, ultimo: sim.ultimo, fim: sim.fim, jogadas: sim.jogadas };
  return { modo: 'versus', t: sim.t.map(t => ({ g: t.g, pontos: t.pontos, fora: t.fora, pedras: t.pedrasMandadas, ultimo: t.ultimo })), fim: sim.fim };
}

function resultado(sim, presentes, porTempo = false) {
  if (sim.modo === 'coop') {
    if (sim.fim === 'meta') return { motivo: 'meta', vencedores: presentes };
    if (sim.fim === 'travou' || porTempo) return { motivo: sim.fim || 'tempo', vencedores: [] };
    if (!presentes.length) return { motivo: 'sairam', vencedores: [] };
    return null;
  }
  const vivos = presentes.filter(i => !sim.t[i].fora);
  if (porTempo || vivos.length <= 1) {
    if (vivos.length === 1 && !porTempo) return { motivo: 'sobrou', vencedores: vivos };
    const lista = vivos.length ? vivos : presentes;
    if (!lista.length) return { motivo: 'sairam', vencedores: [] };
    const max = Math.max(...lista.map(i => sim.t[i].pontos));
    const melhores = lista.filter(i => sim.t[i].pontos === max);
    return { motivo: porTempo ? 'tempo' : 'todos-fora', vencedores: melhores.length === 1 ? melhores : [] };
  }
  return null;
}

// Os pontos de cada um (no co-op, todos têm os pontos da equipe).
const pontos = sim => (sim.modo === 'coop' ? Array(sim.n).fill(sim.pontos) : sim.t.map(t => t.pontos));

function sair(sim, i) {
  if (sim.modo === 'versus' && sim.t[i]) sim.t[i].fora = true;
}

module.exports = { novo, agir, quadro, resultado, pontos, sair, deslizar, temJogada, METAS };
