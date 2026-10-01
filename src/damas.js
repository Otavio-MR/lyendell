// Damas brasileiras (as regras da Confederação Brasileira de Damas), contra outro morador.
// Tabuleiro 8x8, só as casas escuras. Quem começa joga com as claras, que ficam embaixo e sobem.
//  - A pedra anda uma casa na diagonal para a frente, e captura para a frente e para trás.
//  - Capturar é obrigatório, e vale a "lei da maioria": tem que fazer a sequência que captura mais peças.
//  - A dama anda e captura à distância (quantas casas quiser na diagonal).
//  - As peças capturadas só saem no fim da jogada, e não dá para pular a mesma peça duas vezes.
//  - A pedra só vira dama se terminar a jogada na última fileira.
//  - Perde quem fica sem peças ou sem jogada. Empate: 20 lances de cada lado só com damas, sem captura.
// Casa = linha * 8 + coluna; a linha 0 é a de cima (a das escuras).

class ErroDamas extends Error {}

const DIAGONAIS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const LANCES_EMPATE = 40; // 20 de cada lado
const dentro = (l, c) => l >= 0 && l < 8 && c >= 0 && c < 8;
const casa = (l, c) => l * 8 + c;

function novo(inicia) {
  const t = Array(64).fill(null);
  for (let l = 0; l < 8; l++) {
    for (let c = 0; c < 8; c++) {
      if ((l + c) % 2 === 0) continue;
      if (l < 3) t[casa(l, c)] = { j: 1 - inicia, d: 0 };
      if (l > 4) t[casa(l, c)] = { j: inicia, d: 0 };
    }
  }
  return { tabuleiro: t, vez: inicia, claras: inicia, ultima: null, semProgresso: 0 };
}

// Para onde as pedras de cada um andam: as claras sobem (-1), as escuras descem (+1).
const frente = (e, j) => (j === e.claras ? -1 : 1);

// Todas as sequências de captura que começam numa casa (só as que vão até o fim: não dá para parar no meio).
function capturas(e, origem) {
  const t = e.tabuleiro;
  const { j, d: dama } = t[origem];
  const vazia = i => i === origem || t[i] == null; // a casa de onde a peça saiu fica livre
  const inimiga = i => t[i] != null && t[i].j !== j;
  const saidas = [];
  (function seguir(pos, caminho, capturadas) {
    const [l, c] = [pos >> 3, pos & 7];
    let continuou = false;
    for (const [dl, dc] of DIAGONAIS) {
      if (dama) {
        let k = 1;
        while (dentro(l + dl * k, c + dc * k) && vazia(casa(l + dl * k, c + dc * k))) k++;
        const [al, ac] = [l + dl * k, c + dc * k];
        if (!dentro(al, ac)) continue;
        const alvo = casa(al, ac);
        if (!inimiga(alvo) || capturadas.includes(alvo)) continue;
        for (let m = 1; dentro(al + dl * m, ac + dc * m) && vazia(casa(al + dl * m, ac + dc * m)); m++) {
          const destino = casa(al + dl * m, ac + dc * m);
          continuou = true;
          seguir(destino, [...caminho, destino], [...capturadas, alvo]);
        }
      } else {
        if (!dentro(l + 2 * dl, c + 2 * dc)) continue;
        const alvo = casa(l + dl, c + dc);
        const destino = casa(l + 2 * dl, c + 2 * dc);
        if (!inimiga(alvo) || capturadas.includes(alvo) || !vazia(destino)) continue;
        continuou = true;
        seguir(destino, [...caminho, destino], [...capturadas, alvo]);
      }
    }
    if (!continuou && capturadas.length) saidas.push({ de: origem, caminho, capturadas });
  }(origem, [], []));
  return saidas;
}

// Jogadas sem captura: a pedra uma casa para a frente; a dama quantas casas quiser.
function passos(e, origem) {
  const t = e.tabuleiro;
  const { j, d: dama } = t[origem];
  const [l, c] = [origem >> 3, origem & 7];
  const saidas = [];
  for (const [dl, dc] of DIAGONAIS) {
    if (!dama && dl !== frente(e, j)) continue;
    for (let k = 1; dentro(l + dl * k, c + dc * k) && t[casa(l + dl * k, c + dc * k)] == null; k++) {
      saidas.push({ de: origem, caminho: [casa(l + dl * k, c + dc * k)], capturadas: [] });
      if (!dama) break;
    }
  }
  return saidas;
}

// O que o jogador j pode fazer agora (com a captura obrigatória e a lei da maioria).
function jogadasPossiveis(e, j) {
  const minhas = e.tabuleiro.flatMap((p, i) => (p && p.j === j ? [i] : []));
  const caps = minhas.flatMap(i => capturas(e, i));
  if (caps.length) {
    const max = Math.max(...caps.map(x => x.capturadas.length));
    return caps.filter(x => x.capturadas.length === max);
  }
  return minhas.flatMap(i => passos(e, i));
}

// jogada = { de: casa, caminho: [casas onde a peça para, em ordem] }.
function jogar(e, i, { de, caminho } = {}) {
  if (e.vez !== i) throw new ErroDamas('Não é a sua vez.');
  const lista = jogadasPossiveis(e, i);
  const jog = Array.isArray(caminho) && lista.find(x => x.de === de && x.caminho.length === caminho.length && x.caminho.every((c, k) => c === caminho[k]));
  if (!jog) {
    const max = lista[0]?.capturadas.length || 0;
    throw new ErroDamas(max ? `A captura é obrigatória: capture ${max === 1 ? 'a peça' : `as ${max} peças`}.` : 'Essa jogada não vale.');
  }
  const t = e.tabuleiro;
  const peca = t[de];
  const fim = jog.caminho[jog.caminho.length - 1];
  t[de] = null;
  for (const c of jog.capturadas) t[c] = null;
  const virouDama = !peca.d && (fim >> 3) === (frente(e, i) === -1 ? 0 : 7);
  t[fim] = { j: i, d: peca.d || virouDama ? 1 : 0 };
  e.ultima = { de, caminho: jog.caminho, capturadas: jog.capturadas, dama: virouDama };
  e.semProgresso = peca.d && !jog.capturadas.length ? e.semProgresso + 1 : 0;
  const outro = 1 - i;
  if (!jogadasPossiveis(e, outro).length) return { vencedor: i }; // sem peças ou sem jogada
  if (e.semProgresso >= LANCES_EMPATE) return { empate: true };
  e.vez = outro;
  return null;
}

// O que todo mundo vê: o tabuleiro, de quem é a vez, a última jogada e o que dá para fazer agora.
function visao(e) {
  const contar = j => e.tabuleiro.filter(p => p && p.j === j).length;
  return {
    tabuleiro: e.tabuleiro, vez: e.vez, claras: e.claras, ultima: e.ultima,
    pecas: [contar(0), contar(1)],
    jogadas: jogadasPossiveis(e, e.vez),
    empateEm: e.semProgresso >= 10 ? LANCES_EMPATE - e.semProgresso : null,
  };
}

module.exports = { novo, jogar, visao, jogadasPossiveis, ErroDamas };
