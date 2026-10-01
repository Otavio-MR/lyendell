// Cobrinha ao vivo: de 2 a 4 cobras no mesmo tabuleiro. O servidor roda o jogo e os navegadores só
// dizem para onde querem virar. Três modos:
//  - todos: todos contra todos. Quem bate (na borda, noutra cobra ou em si mesma) sai e vira cenouras;
//    vence quem sobrar por último.
//  - colheita (co-op): as cobras passam umas pelas outras; quem bate renasce no seu canto depois de um
//    tempinho. A equipe vence se juntar a meta de cenouras antes do tempo acabar.
//  - duplas (2 contra 2): a dupla da esquerda contra a da direita; vence a dupla que tiver cobra viva no fim.

const LARGURA = 32;
const ALTURA = 24;
// Onde cada cobra começa: cada uma num canto, andando para longe da borda.
const INICIOS = [
  { corpo: [[5, 5], [4, 5], [3, 5]], dir: [1, 0] },
  { corpo: [[26, 18], [27, 18], [28, 18]], dir: [-1, 0] },
  { corpo: [[26, 5], [26, 4], [26, 3]], dir: [0, 1] },
  { corpo: [[5, 18], [5, 19], [5, 20]], dir: [0, -1] },
];
const MAX_COMIDA = 30;
const MODOS = ['todos', 'colheita', 'duplas'];
const TIMES_DUPLAS = [0, 1, 1, 0]; // os cantos da esquerda (0 e 3) contra os da direita (1 e 2)
const RENASCER_PASSOS = 24;       // na colheita, quem bate volta depois de uns 3 segundos

const chave = (x, y) => `${x},${y}`;
const noTabuleiro = ([x, y]) => x >= 0 && y >= 0 && x < LARGURA && y < ALTURA;

function novaComida(e, sorte) {
  const ocupado = new Set([...e.cobras.flatMap(c => c.corpo), ...e.comida].map(([x, y]) => chave(x, y)));
  const livres = [];
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) if (!ocupado.has(chave(x, y))) livres.push([x, y]);
  if (livres.length) e.comida.push(livres[Math.floor(sorte() * livres.length)]);
}
const minimoDeComida = e => e.cobras.length + 1;

// opcoes: { modo, limite (passos que a colheita dura), meta (cenouras da equipe) }.
function novo(ids, sorte = Math.random, { modo = 'todos', limite = 0, meta = 0 } = {}) {
  if (ids.length < 2 || ids.length > INICIOS.length) throw new Error('A cobrinha ao vivo é de 2 a 4 jogadores.');
  if (modo === 'duplas' && ids.length !== 4) throw new Error('O 2 contra 2 precisa de 4 jogadores.');
  const e = {
    cobras: ids.map((id, i) => ({ id, corpo: INICIOS[i].corpo.map(p => [...p]), dir: [...INICIOS[i].dir], fila: [], viva: true, pontos: 0, morreu: null, renasce: null })),
    comida: [],
    tick: 0,
    modo: MODOS.includes(modo) ? modo : 'todos',
    limite, meta,
    times: modo === 'duplas' ? TIMES_DUPLAS.slice(0, ids.length) : null,
  };
  while (e.comida.length < minimoDeComida(e)) novaComida(e, sorte);
  return e;
}

// Para onde virar. Guarda até 2 viradas (para curvas rápidas) e ignora meia-volta.
function virar(e, i, dir) {
  const c = e.cobras[i];
  if (!c?.viva || !Array.isArray(dir)) return false;
  const [dx, dy] = dir.map(Number);
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const ultima = c.fila[c.fila.length - 1] || c.dir;
  if ((dx === -ultima[0] && dy === -ultima[1]) || (dx === ultima[0] && dy === ultima[1])) return false;
  if (c.fila.length >= 2) return false;
  c.fila.push([dx, dy]);
  return true;
}

// A cobra sai do jogo (bateu ou o jogador saiu): o corpo vira cenouras.
function eliminar(e, i) {
  const c = e.cobras[i];
  if (!c?.viva) return;
  c.viva = false;
  c.morreu = e.tick;
  for (const [n, p] of c.corpo.entries()) if (n % 3 === 1 && noTabuleiro(p) && e.comida.length < MAX_COMIDA) e.comida.push([...p]);
  c.corpo = [];
  c.fila = [];
  if (e.modo === 'colheita') c.renasce = e.tick + RENASCER_PASSOS;
}

// Colheita: a cobra volta no canto dela (com 3 de tamanho) quando o canto está livre.
function renascer(e) {
  const ocupado = new Set(e.cobras.flatMap(c => c.corpo).map(p => chave(...p)));
  for (const [i, c] of e.cobras.entries()) {
    if (c.viva || c.renasce == null || e.tick < c.renasce || c.saiu) continue;
    const corpo = INICIOS[i].corpo.map(p => [...p]);
    if (corpo.some(p => ocupado.has(chave(...p)))) continue;
    Object.assign(c, { corpo, dir: [...INICIOS[i].dir], fila: [], viva: true, renasce: null });
    e.comida = e.comida.filter(([x, y]) => !corpo.some(p => p[0] === x && p[1] === y));
  }
}

// Um passo do jogo: todas as cobras andam ao mesmo tempo.
function passo(e, sorte = Math.random) {
  e.tick++;
  const vivas = e.cobras.filter(c => c.viva);
  for (const c of vivas) {
    if (c.fila.length) c.dir = c.fila.shift();
    c.nova = [c.corpo[0][0] + c.dir[0], c.corpo[0][1] + c.dir[1]];
    c.come = e.comida.some(([x, y]) => x === c.nova[0] && y === c.nova[1]);
  }
  // Onde os corpos vão estar (quem não come solta a ponta do rabo neste passo).
  // Na colheita cada cobra só bate na borda e em si mesma (as outras passam por cima).
  const separado = e.modo === 'colheita';
  const corpoDepois = c => (c.come ? c.corpo : c.corpo.slice(0, -1));
  const ocupado = new Set();
  if (!separado) for (const c of vivas) for (const p of corpoDepois(c)) ocupado.add(chave(...p));
  const batem = vivas.filter(c => !noTabuleiro(c.nova)
    || (separado ? corpoDepois(c).some(p => p[0] === c.nova[0] && p[1] === c.nova[1]) : ocupado.has(chave(...c.nova)))
    || (!separado && vivas.some(o => o !== c && o.nova[0] === c.nova[0] && o.nova[1] === c.nova[1]))); // cabeça com cabeça: as duas saem
  const comidas = new Set();
  for (const c of vivas) {
    if (batem.includes(c)) continue;
    c.corpo.unshift(c.nova);
    if (c.come) { c.pontos++; comidas.add(chave(...c.nova)); } else c.corpo.pop();
  }
  e.comida = e.comida.filter(([x, y]) => !comidas.has(chave(x, y)));
  for (const c of batem) eliminar(e, e.cobras.indexOf(c));
  if (e.modo === 'colheita') renascer(e);
  while (e.comida.length < minimoDeComida(e)) novaComida(e, sorte);
  for (const c of e.cobras) { delete c.nova; delete c.come; }
  return batem.map(c => e.cobras.indexOf(c));
}

const totalDaEquipe = e => e.cobras.reduce((t, c) => t + c.pontos, 0);
const timesVivos = e => new Set(e.cobras.filter(c => c.viva).map(c => e.times[e.cobras.indexOf(c)]));

function acabou(e) {
  if (e.modo === 'colheita') return totalDaEquipe(e) >= e.meta || e.tick >= e.limite || e.cobras.every(c => c.saiu);
  if (e.modo === 'duplas') return timesVivos(e).size <= 1;
  return e.cobras.filter(c => c.viva).length <= 1;
}

// O resultado conforme o modo: quem venceu (índices das cobras) e se foi empate.
function resultado(e) {
  const todas = e.cobras.map((c, i) => i);
  if (e.modo === 'colheita') {
    const venceu = totalDaEquipe(e) >= e.meta;
    return { venceram: venceu ? todas : [], empate: false, equipe: venceu, vencedor: null };
  }
  if (e.modo === 'duplas') {
    const vivos = [...timesVivos(e)];
    let time = vivos.length === 1 ? vivos[0] : null;
    if (time == null) {
      // As duas duplas saíram juntas: desempata nas cenouras.
      const soma = t => e.cobras.reduce((n, c, i) => n + (e.times[i] === t ? c.pontos : 0), 0);
      if (soma(0) !== soma(1)) time = soma(0) > soma(1) ? 0 : 1;
    }
    return { venceram: time == null ? [] : todas.filter(i => e.times[i] === time), empate: time == null, time, vencedor: null };
  }
  const v = vencedor(e);
  return { venceram: v == null ? [] : [v], empate: v == null, vencedor: v };
}

// Classificação: quem está viva primeiro, depois quem saiu mais tarde; empate desempata nas cenouras.
function classificacao(e) {
  return e.cobras.map((c, i) => ({ i, id: c.id, viva: c.viva, morreu: c.morreu, pontos: c.pontos }))
    .sort((a, b) => b.viva - a.viva || (b.morreu ?? 0) - (a.morreu ?? 0) || b.pontos - a.pontos);
}

// Vencedor: a última viva. Se as últimas saíram juntas e com as mesmas cenouras, é empate.
function vencedor(e) {
  const [a, b] = classificacao(e);
  if (!a) return null;
  if (!a.viva && b && !b.viva && a.morreu === b.morreu && a.pontos === b.pontos) return null;
  return a.i;
}

// O que vai para a tela (compacto: é mandado várias vezes por segundo).
const visao = e => ({
  l: LARGURA, a: ALTURA, t: e.tick, m: e.modo,
  c: e.cobras.map(c => ({ v: c.viva ? 1 : 0, p: c.pontos, d: c.dir, b: c.corpo.flat(), ...(c.renasce != null && !c.viva ? { r: c.renasce - e.tick } : {}) })),
  f: e.comida.flat(),
  ...(e.modo === 'colheita' ? { meta: e.meta, total: totalDaEquipe(e), resta: Math.max(0, e.limite - e.tick) } : {}),
  ...(e.times ? { times: e.times } : {}),
});

module.exports = { LARGURA, ALTURA, MODOS, novo, virar, eliminar, passo, acabou, classificacao, vencedor, resultado, visao };
