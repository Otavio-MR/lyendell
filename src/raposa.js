// A Raposa: o computador que joga contra os coelhos no modo co-op do Jogo da Velha, do Lig 4 e das Damas
// (uma pessoa sozinha ou uma dupla, um lance cada, contra ela). Ela é esperta, mas dá para ganhar:
// na Velha às vezes se distrai, e no Lig 4 e nas Damas só enxerga alguns lances à frente.
// Ela sempre joga com o lado 1 do jogo (o lado 0 é dos coelhos).

const damas = require('./damas');

const LINHAS_VELHA = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const sortear = (lista, sorte = Math.random) => lista[Math.floor(sorte() * lista.length)];

/* ─── Jogo da Velha ───────────────────────────────── */

function ganhadorVelha(t) {
  const l = LINHAS_VELHA.find(([a, b, c]) => t[a] && t[a] === t[b] && t[a] === t[c]);
  return l ? t[l[0]] : null;
}

function minimaxVelha(t, eu, outro, vez) {
  const g = ganhadorVelha(t);
  if (g === eu) return 10;
  if (g === outro) return -10;
  const livres = t.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (!livres.length) return 0;
  const notas = livres.map(i => {
    t[i] = vez;
    const n = minimaxVelha(t, eu, outro, vez === eu ? outro : eu);
    t[i] = null;
    return n;
  });
  return vez === eu ? Math.max(...notas) - 0.1 : Math.min(...notas) + 0.1;
}

// Ganha se der, bloqueia quase sempre; no resto, joga bem 3 vezes em 4 (às vezes se distrai).
function velha(e, sorte = Math.random) {
  const t = [...e.tabuleiro];
  const eu = e.simbolos[1];
  const outro = e.simbolos[0];
  const livres = t.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  const fecha = sim => livres.find(i => { t[i] = sim; const g = ganhadorVelha(t); t[i] = null; return g === sim; });
  const ganhar = fecha(eu);
  if (ganhar != null) return { casa: ganhar };
  const bloquear = fecha(outro);
  if (bloquear != null && sorte() < 0.85) return { casa: bloquear };
  if (sorte() < 0.25) return { casa: sortear(livres, sorte) };
  let melhor = -Infinity;
  let casas = [];
  for (const i of livres) {
    t[i] = eu;
    const n = minimaxVelha(t, eu, outro, outro);
    t[i] = null;
    if (n > melhor) { melhor = n; casas = [i]; } else if (n === melhor) casas.push(i);
  }
  return { casa: sortear(casas, sorte) };
}

/* ─── Lig 4 ───────────────────────────────────────── */

const LIN = 6;
const COL = 7;
const linhaLivre = (t, col) => { for (let l = LIN - 1; l >= 0; l--) if (t[l * COL + col] == null) return l; return -1; };

function venceuLig4(t, j) {
  for (let l = 0; l < LIN; l++) {
    for (let c = 0; c < COL; c++) {
      for (const [dl, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let n = 0;
        while (n < 4) {
          const ll = l + dl * n;
          const cc = c + dc * n;
          if (ll < 0 || ll >= LIN || cc < 0 || cc >= COL || t[ll * COL + cc] !== j) break;
          n++;
        }
        if (n === 4) return true;
      }
    }
  }
  return false;
}

// Nota da posição: cada janela de 4 casas vale pelo que um lado tem nela (sem o outro).
function notaLig4(t, eu) {
  let nota = 0;
  for (let l = 0; l < LIN; l++) if (t[l * COL + 3] === eu) nota += 3; // o meio vale mais
  for (let l = 0; l < LIN; l++) {
    for (let c = 0; c < COL; c++) {
      for (const [dl, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const casas = [0, 1, 2, 3].map(n => [l + dl * n, c + dc * n]);
        if (casas.some(([ll, cc]) => ll < 0 || ll >= LIN || cc < 0 || cc >= COL)) continue;
        const v = casas.map(([ll, cc]) => t[ll * COL + cc]);
        const meus = v.filter(x => x === eu).length;
        const deles = v.filter(x => x != null && x !== eu).length;
        if (meus && deles) continue;
        nota += meus === 3 ? 6 : meus === 2 ? 2 : 0;
        nota -= deles === 3 ? 8 : deles === 2 ? 2 : 0;
      }
    }
  }
  return nota;
}

function minimaxLig4(t, prof, vez, eu, alfa, beta) {
  const outro = 1 - eu;
  if (venceuLig4(t, eu)) return 10_000 + prof;
  if (venceuLig4(t, outro)) return -10_000 - prof;
  const cols = [3, 2, 4, 1, 5, 0, 6].filter(c => linhaLivre(t, c) >= 0);
  if (!cols.length) return 0;
  if (prof === 0) return notaLig4(t, eu);
  let melhor = vez === eu ? -Infinity : Infinity;
  for (const c of cols) {
    const l = linhaLivre(t, c);
    t[l * COL + c] = vez;
    const n = minimaxLig4(t, prof - 1, 1 - vez, eu, alfa, beta);
    t[l * COL + c] = null;
    if (vez === eu) { melhor = Math.max(melhor, n); alfa = Math.max(alfa, n); } else { melhor = Math.min(melhor, n); beta = Math.min(beta, n); }
    if (beta <= alfa) break;
  }
  return melhor;
}

function lig4(e, sorte = Math.random, profundidade = 4) {
  const t = [...e.tabuleiro];
  const cols = [3, 2, 4, 1, 5, 0, 6].filter(c => linhaLivre(t, c) >= 0);
  let melhor = -Infinity;
  let escolhas = [];
  for (const c of cols) {
    const l = linhaLivre(t, c);
    t[l * COL + c] = 1;
    const n = minimaxLig4(t, profundidade - 1, 0, 1, -Infinity, Infinity);
    t[l * COL + c] = null;
    if (n > melhor) { melhor = n; escolhas = [c]; } else if (n === melhor) escolhas.push(c);
  }
  return { coluna: sortear(escolhas, sorte) };
}

/* ─── Damas ───────────────────────────────────────── */

// Material: pedra vale 1, dama vale 3; um pouco a mais para as pedras que já andaram.
function notaDamas(e, eu) {
  let nota = 0;
  for (let i = 0; i < 64; i++) {
    const p = e.tabuleiro[i];
    if (!p) continue;
    const linha = i >> 3;
    const avanco = p.d ? 0 : (p.j === e.claras ? 7 - linha : linha) * 0.05;
    nota += (p.j === eu ? 1 : -1) * ((p.d ? 3 : 1) + avanco);
  }
  return nota;
}

const clonar = e => ({ ...e, tabuleiro: e.tabuleiro.map(p => (p ? { ...p } : null)), ultima: null, historico: null }); // sem histórico: só a partida de verdade guarda

function minimaxDamas(e, prof, eu, alfa, beta) {
  const jogadas = damas.jogadasPossiveis(e, e.vez);
  if (!jogadas.length) return e.vez === eu ? -1000 - prof : 1000 + prof;
  if (prof === 0) return notaDamas(e, eu);
  let melhor = e.vez === eu ? -Infinity : Infinity;
  for (const j of jogadas) {
    const f = clonar(e);
    const r = damas.jogar(f, f.vez, j);
    const n = r?.vencedor != null ? (r.vencedor === eu ? 1000 + prof : -1000 - prof) : r?.empate ? 0 : minimaxDamas(f, prof - 1, eu, alfa, beta);
    if (e.vez === eu) { melhor = Math.max(melhor, n); alfa = Math.max(alfa, n); } else { melhor = Math.min(melhor, n); beta = Math.min(beta, n); }
    if (beta <= alfa) break;
  }
  return melhor;
}

function damasIA(e, sorte = Math.random, profundidade = 3) {
  const jogadas = damas.jogadasPossiveis(e, 1);
  let melhor = -Infinity;
  let escolhas = [];
  for (const j of jogadas) {
    const f = clonar(e);
    const r = damas.jogar(f, 1, j);
    const n = r?.vencedor === 1 ? 10_000 : minimaxDamas(f, profundidade - 1, 1, -Infinity, Infinity);
    if (n > melhor + 1e-9) { melhor = n; escolhas = [j]; } else if (Math.abs(n - melhor) < 1e-9) escolhas.push(j);
  }
  const j = sortear(escolhas, sorte);
  return { de: j.de, caminho: j.caminho };
}

const JOGADAS = { velha, lig4, damas: damasIA };
const jogadaDaRaposa = (jogo, e) => JOGADAS[jogo](e);
const COM_RAPOSA = Object.keys(JOGADAS);

module.exports = { jogadaDaRaposa, COM_RAPOSA, velha, lig4, damas: damasIA };
