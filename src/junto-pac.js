// Pac-Coelho junto: o jogo roda aqui no servidor, com todos no mesmo labirinto ao mesmo tempo.
// Os navegadores só mandam a direção ({ tipo: 'dir', d }) e desenham os quadros (20 por segundo).
//  - Versus: cada Lírio vale pontos para quem comeu (raposas e cenoura também). Quem é pego pisca,
//    perde 10% dos pontos e volta no seu lugar depois de 2 s (com 2 s de proteção). Comidos todos os
//    Lírios, vence quem tiver mais pontos (empate: ninguém sozinho).
//  - Co-op: vidas da equipe (3 + n). Pego com vidas, volta; sem vidas, fica de fora. Limpar o labirinto:
//    a equipe vence; todos de fora: a equipe perde.
// Quanto mais gente (dif), mais rápidas as raposas e mais curto o susto; com 3 ou mais, uma 5ª raposa.
// Puro (sem rede e sem relógio): a mesma semente com os mesmos comandos dá os mesmos quadros.

const MAPA = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];
const COLS = 28;
const LINHAS = MAPA.length;

const CIMA = [0, -1];
const ESQ = [-1, 0];
const BAIXO = [0, 1];
const DIR = [1, 0];
const DIRS = [CIMA, ESQ, BAIXO, DIR]; // ordem de desempate das raposas (e o número que vai no quadro)
const POR_NOME = new Map([['cima', CIMA], ['esquerda', ESQ], ['baixo', BAIXO], ['direita', DIR]]);

const VEL = 9.5;          // casas por segundo, como no solo
const SUBPASSO = 1 / 60;  // o passo de 50 ms anda em pedaços (como os 60 quadros por segundo do solo)
// Cada raposa caça de um jeito, sempre atrás do coelho vivo mais perto dela.
const RAPOSAS = [
  { nome: 'Rubra', jeito: 'direto', canto: [25, -3], casa: null, solta: 0 },
  { nome: 'Ártica', jeito: 'frente', canto: [2, -3], casa: [13.5, 14], solta: 1 },
  { nome: 'Cinzenta', jeito: 'cerca', canto: [27, 31], casa: [11.5, 14], solta: 5 },
  { nome: 'Fenec', jeito: 'timida', canto: [0, 31], casa: [15.5, 14], solta: 9 },
];
// Com 3 ou mais coelhos: mais uma, igual à Rubra, que sai da toca bem depois.
const BRASA = { nome: 'Brasa', jeito: 'direto', canto: [25, -3], casa: [13.5, 14], solta: 14 };
const FASES = [[7, 'dispersar'], [20, 'perseguir'], [7, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [Infinity, 'perseguir']];
const MODOS = ['normal', 'casa', 'saindo', 'entrando', 'olhos'];
const VALOR_CENOURA = [100, 300]; // a 1ª e a 2ª cenoura
// Onde cada coelho começa (e volta): perto do começo clássico, olhando para a esquerda.
const SAIDAS = [[13.5, 23], [16.5, 23], [10.5, 23], [19.5, 23]];
const TEMPO_PEGO = 2;
const TEMPO_PROTEGIDO = 2;
// Estado de cada coelho no quadro: 0 vivo, 1 protegido (acabou de voltar), 2 pego (vai voltar),
// 3 fora, 4 saiu, 5 pego sem vidas (vai ficar de fora).

const colunaCerta = x => ((x % COLS) + COLS) % COLS; // o túnel liga as duas pontas
const celula = (x, y) => (y < 0 || y >= LINHAS ? '#' : MAPA[y][colunaCerta(x)]);
const livre = (x, y) => { const c = celula(x, y); return c !== '#' && c !== '-'; };
const mesma = (a, b) => a[0] === b[0] && a[1] === b[1];
const contraria = (a, b) => a[0] === -b[0] && a[1] === -b[1];
const indiceDir = d => DIRS.findIndex(x => mesma(x, d));
const r2 = x => Math.round(x * 100) / 100;
const r1 = x => Math.round(x * 10) / 10;

// As casas com Lírio, na ordem do mapa (o navegador monta a mesma lista).
const LISTA_MOEDAS = [];
for (let y = 0; y < LINHAS; y++) for (let x = 0; x < COLS; x++) if (MAPA[y][x] === '.' || MAPA[y][x] === 'o') LISTA_MOEDAS.push(y * COLS + x);
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// O mapa dos Lírios em 6 bits por letra (1 = ainda está lá): 41 letras.
function codificarMoedas(moedas) {
  let s = '';
  for (let k = 0; k < LISTA_MOEDAS.length; k += 6) {
    let v = 0;
    for (let b = 0; b < 6 && k + b < LISTA_MOEDAS.length; b++) if (moedas[LISTA_MOEDAS[k + b]]) v |= 1 << b;
    s += BASE64[v];
  }
  return s;
}

// Números "aleatórios" a partir da semente (o mesmo gerador do navegador).
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

function lugarDeSaida(i) {
  const [x, y] = SAIDAS[i];
  return { tx: x + 0.5, ty: y, dir: ESQ, p: 0.5 };
}

function novo({ modo, n, dif, semente } = {}) {
  n = Math.max(1, Math.min(SAIDAS.length, Math.floor(Number(n) || 1)));
  dif = Math.max(1, Number(dif) || 1);
  const coop = modo === 'coop';
  const sim = {
    modo: coop ? 'coop' : 'versus', n, dif, sorte: sorteDe(Number(semente) || 0),
    // Velocidades do nível 1 do solo; as raposas ficam mais rápidas com mais gente (até o máximo do solo).
    vel: { coelho: 0.8, raposa: Math.min(0.95, 0.75 * dif), susto: Math.min(0.65, 0.5 * dif), tunel: Math.min(0.55, 0.4 * dif) },
    tempoSusto: Math.max(2, 6 / dif),
    t: 0, passos: 0, situacao: 'pronto', fim: null,
    moedas: new Uint8Array(COLS * LINHAS), total: 0, comidas: 0, mudouMoedas: false, cheio: false, ultimoCheio: 0,
    fase: 0, tempoFase: FASES[0][0], susto: 0, cenoura: null, cenouras: 0,
    vidas: coop ? 3 + n : null,
    popups: [],
    coelhos: Array.from({ length: n }, (_, i) => ({
      i, ...lugarDeSaida(i), pontos: 0, combo: 0, estado: 'vivo', protegido: 0, relogio: 0, querDir: null, parado: false, sai: false, ritmo: 1,
    })),
    raposas: [...RAPOSAS, ...(n >= 3 ? [BRASA] : [])].map((r, i) => (i === 0
      ? { ...r, i, modo: 'normal', tx: 14, ty: 11, dir: ESQ, p: 0.5, assustada: false, reverter: false }
      : { ...r, i, modo: 'casa', fx: r.casa[0], fy: r.casa[1], bob: i % 2 ? 1 : -1, dir: CIMA, assustada: false, reverter: false })),
  };
  for (const k of LISTA_MOEDAS) {
    sim.moedas[k] = MAPA[Math.floor(k / COLS)][k % COLS] === '.' ? 1 : 2;
    sim.total++;
  }
  return sim;
}

/* ─── Comandos ─── */

function agir(sim, i, ev) {
  const c = sim.coelhos[i];
  if (!c || sim.fim || c.estado === 'fora' || c.estado === 'saiu' || c.sai) return { mudou: false };
  if (ev && ev.tipo === 'dir') {
    const d = POR_NOME.get(ev.d);
    if (d) c.querDir = d; // vale na próxima curva possível (meia-volta vale na hora)
  }
  return { mudou: false };
}

function sair(sim, i) {
  const c = sim.coelhos[i];
  if (!c) return;
  c.estado = 'saiu';
  c.sai = false;
}

/* ─── Andamento ─── */

const posicao = e => (e.modo === 'casa' || e.modo === 'saindo' || e.modo === 'entrando') ? [e.fx, e.fy] : [e.tx + e.dir[0] * e.p, e.ty + e.dir[1] * e.p];
const casaDe = c => { const [x, y] = posicao(c); return [colunaCerta(Math.round(x)), Math.round(y)]; };
const faseAtual = sim => FASES[sim.fase][1];

function somar(c, n) { c.pontos += n; }

function comerMoeda(sim, c, x, y) {
  const k = y * COLS + x;
  const m = sim.moedas[k];
  if (!m) return;
  sim.moedas[k] = 0;
  sim.comidas++;
  sim.mudouMoedas = true;
  if (m === 1) somar(c, 10);
  else { somar(c, 50); assustar(sim); }
  if (sim.comidas === 70 || sim.comidas === 170) sim.cenoura = { ate: 9.5, n: ++sim.cenouras };
  if (sim.comidas === sim.total) sim.fim = 'limpou';
}

function assustar(sim) {
  sim.susto = sim.tempoSusto;
  for (const c of sim.coelhos) c.combo = 0;
  for (const r of sim.raposas) {
    if (r.modo === 'olhos' || r.modo === 'entrando') continue;
    r.assustada = true;
    if (r.modo === 'normal') r.reverter = true;
  }
}

// O coelho vivo mais perto de (x, y) (o túnel conta); empate: o de número menor.
function maisPerto(sim, x, y) {
  let melhor = null;
  let menor = Infinity;
  for (const c of sim.coelhos) {
    if (c.estado !== 'vivo') continue;
    const [cx, cy] = casaDe(c);
    let dx = Math.abs(cx - x);
    dx = Math.min(dx, COLS - dx);
    const d = dx * dx + (cy - y) ** 2;
    if (d < menor) { menor = d; melhor = c; }
  }
  return melhor;
}

function alvo(sim, r) {
  if (r.modo === 'olhos') return [13.5, 11];
  if (faseAtual(sim) === 'dispersar') return r.canto;
  const c = maisPerto(sim, r.tx, r.ty);
  if (!c) return r.canto; // ninguém para caçar: cada uma vai para o seu canto
  const [px, py] = casaDe(c);
  const [dx, dy] = c.dir;
  if (r.jeito === 'frente') return [px + 4 * dx, py + 4 * dy];
  if (r.jeito === 'cerca') {
    const [bx, by] = posicao(sim.raposas[0]);
    const mx = px + 2 * dx;
    const my = py + 2 * dy;
    return [2 * mx - bx, 2 * my - by];
  }
  if (r.jeito === 'timida') return (r.tx - px) ** 2 + (r.ty - py) ** 2 > 64 ? [px, py] : r.canto;
  return [px, py];
}

function escolherCaminho(sim, r) {
  const opcoes = DIRS.filter(d => !contraria(d, r.dir) && livre(r.tx + d[0], r.ty + d[1]));
  if (!opcoes.length) return [-r.dir[0], -r.dir[1]];
  if (r.assustada) return opcoes[Math.floor(sim.sorte() * opcoes.length)];
  const [ax, ay] = alvo(sim, r);
  let melhor = opcoes[0];
  let menor = Infinity;
  for (const d of opcoes) {
    const dist = (r.tx + d[0] - ax) ** 2 + (r.ty + d[1] - ay) ** 2;
    if (dist < menor) { menor = dist; melhor = d; }
  }
  return melhor;
}

function velRaposa(sim, r) {
  if (r.modo === 'olhos') return VEL * 1.7;
  if (r.ty === 14 && (r.tx <= 5 || r.tx >= 22)) return VEL * sim.vel.tunel;
  return VEL * (r.assustada ? sim.vel.susto : sim.vel.raposa);
}

// Anda em linha reta até (x, y) no chão da toca, uma coordenada de cada vez.
function irAte(r, x, y, passo) {
  if (Math.abs(r.fx - x) > 1e-3) {
    r.dir = r.fx < x ? DIR : ESQ;
    r.fx += Math.sign(x - r.fx) * Math.min(passo, Math.abs(x - r.fx));
    return false;
  }
  r.fx = x;
  if (Math.abs(r.fy - y) > 1e-3) {
    r.dir = r.fy < y ? BAIXO : CIMA;
    r.fy += Math.sign(y - r.fy) * Math.min(passo, Math.abs(y - r.fy));
    return false;
  }
  r.fy = y;
  return true;
}

function moverRaposa(sim, r, dt) {
  if (r.modo === 'casa') {
    r.fy += r.bob * VEL * 0.3 * dt;
    if (r.fy < 13.6) { r.fy = 13.6; r.bob = 1; }
    if (r.fy > 14.4) { r.fy = 14.4; r.bob = -1; }
    r.dir = r.bob > 0 ? BAIXO : CIMA;
    if (sim.t >= r.solta) r.modo = 'saindo';
    return;
  }
  if (r.modo === 'saindo') {
    if (irAte(r, 13.5, 11, VEL * 0.45 * dt)) Object.assign(r, { modo: 'normal', tx: 14, ty: 11, dir: ESQ, p: 0.5 });
    return;
  }
  if (r.modo === 'entrando') {
    if (irAte(r, 13.5, 14, VEL * 1.2 * dt)) Object.assign(r, { modo: 'saindo', assustada: false });
    return;
  }
  if (r.reverter) {
    r.reverter = false;
    if (r.modo === 'normal') {
      r.tx = colunaCerta(r.tx + r.dir[0]);
      r.ty += r.dir[1];
      r.p = 1 - r.p;
      r.dir = [-r.dir[0], -r.dir[1]];
    }
  }
  let passo = velRaposa(sim, r) * dt;
  for (let n = 0; passo > 1e-9 && n < 10; n++) {
    const falta = 1 - r.p;
    if (passo < falta) { r.p += passo; return; }
    passo -= falta;
    r.tx = colunaCerta(r.tx + r.dir[0]);
    r.ty += r.dir[1];
    r.p = 0;
    if (r.modo === 'olhos' && r.ty === 11 && (r.tx === 13 || r.tx === 14)) {
      Object.assign(r, { modo: 'entrando', fx: r.tx, fy: 11 });
      return;
    }
    r.dir = escolherCaminho(sim, r);
  }
}

// O movimento do coelho (o mesmo do solo): anda de casa em casa; a direção pedida vale na próxima curva.
// ritmo: 1 normal, 0,5 com a pegadinha "lento", 0 congelado.
function moverCoelho(sim, c, dt) {
  let passo = VEL * sim.vel.coelho * (c.ritmo ?? 1) * dt;
  const q = c.querDir;
  for (let n = 0; passo > 1e-9 && n < 10; n++) {
    // Meia-volta pode a qualquer momento.
    if (q && contraria(q, c.dir) && c.p > 0) {
      c.tx = colunaCerta(c.tx + c.dir[0]);
      c.ty += c.dir[1];
      c.p = 1 - c.p;
      c.dir = q;
    }
    if (c.p === 0) {
      if (q && livre(c.tx + q[0], c.ty + q[1])) c.dir = q;
      if (!livre(c.tx + c.dir[0], c.ty + c.dir[1])) { c.parado = true; return; }
    }
    c.parado = false;
    const falta = 1 - c.p;
    if (passo < falta) { c.p += passo; return; }
    passo -= falta;
    c.tx = colunaCerta(c.tx + c.dir[0]);
    c.ty += c.dir[1];
    c.p = 0;
    comerMoeda(sim, c, c.tx, c.ty);
    if (sim.fim) return;
  }
}

function pego(sim, c) {
  const [x, y] = posicao(c);
  Object.assign(c, { estado: 'morto', relogio: TEMPO_PEGO, querDir: null, parado: true, combo: 0 });
  if (sim.modo === 'versus') {
    const perda = Math.floor(c.pontos / 10);
    if (perda > 0) {
      c.pontos -= perda;
      sim.popups.push({ x, y, valor: -perda, i: c.i, ate: 1.2 });
    }
  } else if (sim.vidas > 0) {
    sim.vidas--;
  } else {
    c.sai = true; // sem vidas na equipe: pisca e fica de fora
  }
}

function renascer(c) {
  if (c.sai) { c.estado = 'fora'; c.sai = false; return; }
  Object.assign(c, lugarDeSaida(c.i), { estado: 'vivo', protegido: TEMPO_PROTEGIDO, parado: false });
}

function colisoes(sim, ordem) {
  for (const c of ordem) {
    if (c.estado !== 'vivo') continue;
    const [px, py] = posicao(c);
    for (const r of sim.raposas) {
      if (r.modo === 'casa' || r.modo === 'entrando' || r.modo === 'olhos') continue;
      const [rx, ry] = posicao(r);
      let dx = Math.abs(px - rx);
      dx = Math.min(dx, COLS - dx);
      if (dx >= 0.6 || Math.abs(py - ry) >= 0.6) continue;
      if (r.assustada) {
        // Quem pegou leva os pontos (200, 400, 800, 1600 em seguida no mesmo susto).
        const valor = 200 * 2 ** c.combo;
        c.combo = Math.min(c.combo + 1, 3);
        somar(c, valor);
        sim.popups.push({ x: rx, y: ry, valor, i: c.i, ate: 0.9 });
        Object.assign(r, { modo: r.modo === 'saindo' ? 'entrando' : 'olhos', assustada: false });
      } else if (c.protegido <= 0) {
        pego(sim, c);
        break;
      }
    }
    if (c.estado === 'vivo' && sim.cenoura && Math.abs(py - 17) < 0.5 && Math.abs(px - 13.5) < 0.7) {
      const valor = VALOR_CENOURA[Math.min(sim.cenoura.n, VALOR_CENOURA.length) - 1];
      somar(c, valor);
      sim.popups.push({ x: 13.5, y: 17, valor, i: c.i, ate: 1.4 });
      sim.cenoura = null;
    }
  }
}

// A ordem dos coelhos gira a cada passo: ninguém leva sempre a vantagem num empate.
function ordemDosCoelhos(sim) {
  const n = sim.coelhos.length;
  const ini = sim.passos % n;
  return Array.from({ length: n }, (_, k) => sim.coelhos[(ini + k) % n]);
}

function atualizar(sim, dt) {
  sim.t += dt;
  sim.passos++;
  for (const p of sim.popups) p.ate -= dt;
  if (sim.popups.some(p => p.ate <= 0)) sim.popups = sim.popups.filter(p => p.ate > 0);
  for (const c of sim.coelhos) {
    if (c.estado === 'morto') { if ((c.relogio -= dt) <= 0) renascer(c); }
    else if (c.protegido > 0) c.protegido = Math.max(0, c.protegido - dt);
  }
  if (sim.susto > 0) {
    sim.susto -= dt;
    if (sim.susto <= 0) { sim.susto = 0; for (const r of sim.raposas) r.assustada = false; }
  } else if (sim.fase < FASES.length - 1 && (sim.tempoFase -= dt) <= 0) {
    sim.fase++;
    sim.tempoFase = FASES[sim.fase][0];
    for (const r of sim.raposas) if (r.modo === 'normal') r.reverter = true;
  }
  if (sim.cenoura && (sim.cenoura.ate -= dt) <= 0) sim.cenoura = null;
  const ordem = ordemDosCoelhos(sim);
  for (const c of ordem) {
    if (c.estado !== 'vivo') continue;
    moverCoelho(sim, c, dt);
    if (sim.fim) return;
  }
  colisoes(sim, ordem);
  for (const r of sim.raposas) moverRaposa(sim, r, dt);
  colisoes(sim, ordem);
}

// Um passo do relógio do servidor (uns 50 ms). Devolve false quando nada mudou (a partida acabou).
function passo(sim, dt) {
  if (sim.fim) return false;
  sim.situacao = 'jogando';
  sim.mudouMoedas = false;
  let resta = Math.max(0, Math.min(0.25, Number(dt) || 0));
  while (resta > 1e-9 && !sim.fim) {
    const d = Math.min(resta, SUBPASSO);
    atualizar(sim, d);
    resta -= d;
  }
  // O mapa inteiro dos Lírios vai quando muda e uma vez por segundo (para quem abriu a tela agora).
  sim.cheio = !!sim.fim || sim.t - sim.ultimoCheio >= 1;
  if (sim.cheio) sim.ultimoCheio = sim.t;
  return true;
}

/* ─── Menu do administrador ─── */

// O ritmo de cada coelho agora (junto.js manda a cada passo, pelas pegadinhas de cada um).
function ritmos(sim, lista) {
  sim.coelhos.forEach((c, k) => { c.ritmo = Number.isFinite(lista[k]) ? lista[k] : 1; });
}

const coelhoDe = (sim, i) => {
  const c = sim.coelhos[i];
  if (!c || c.estado === 'saiu') throw new Error('Esse coelho não está no labirinto.');
  return c;
};

const admin = {
  // Vidas da equipe (só no co-op).
  maisVidas(sim, n) {
    if (sim.modo !== 'coop') throw new Error('No versus do Pac-Coelho não há vidas: quem é pego só perde pontos.');
    sim.vidas = Math.max(0, sim.vidas + n);
    return sim.vidas;
  },
  // Um coelho que ficou de fora (co-op sem vidas) volta, protegido.
  reviver(sim, i) {
    const c = coelhoDe(sim, i);
    if (c.estado !== 'fora' && !c.sai) throw new Error('Esse coelho ainda está no jogo.');
    Object.assign(c, lugarDeSaida(c.i), { estado: 'vivo', sai: false, protegido: TEMPO_PROTEGIDO, parado: false, relogio: 0 });
  },
  // Escudo: as raposas não pegam esse coelho por alguns segundos.
  escudo(sim, i, segundos) {
    const c = coelhoDe(sim, i);
    if (c.estado !== 'vivo') throw new Error('Esse coelho não está correndo agora.');
    c.protegido = Math.max(c.protegido, segundos);
  },
  darPontos(sim, i, n) {
    const c = coelhoDe(sim, i);
    c.pontos = Math.max(0, c.pontos + n);
    const [x, y] = posicao(c);
    sim.popups.push({ x, y, valor: n, i: c.i, ate: 1.4 });
    return c.pontos;
  },
  // As raposas ficam assustadas agora (como se alguém comesse uma cenoura grande).
  assustar(sim) { assustar(sim); },
  // As raposas voltam para a toca e só saem depois de alguns segundos (uma de cada vez).
  tirarRaposas(sim, segundos) {
    sim.raposas.forEach((r, k) => {
      const [fx, fy] = r.casa || [13.5, 14];
      Object.assign(r, { modo: 'casa', fx, fy, bob: k % 2 ? 1 : -1, dir: CIMA, assustada: false, reverter: false, solta: sim.t + segundos + k * 0.6 });
    });
  },
  // Pula a fase: os Lírios somem todos e o labirinto conta como limpo (a partida acaba).
  limpar(sim) {
    for (const k of LISTA_MOEDAS) sim.moedas[k] = 0;
    sim.comidas = sim.total;
    sim.mudouMoedas = true;
    sim.fim = 'limpou';
  },
};

/* ─── O que vai para os navegadores ─── */

function codigo(c) {
  if (c.estado === 'vivo') return c.protegido > 0 ? 1 : 0;
  if (c.estado === 'morto') return c.sai ? 5 : 2;
  return c.estado === 'fora' ? 3 : 4;
}

// Quadro: t (segundos de jogo), s ('pronto' | 'jogando' | 'fim'), c: por coelho [x, y, dir, estado, pontos, tempo?]
// (null se saiu), r: por raposa [x, y, dir, modo, assustada], su (susto), ce (cenoura), mv (Lírios comidos),
// m (mapa dos Lírios, só quando muda e 1 vez por segundo), v (vidas da equipe no co-op),
// pp (pontos subindo: [x, y, valor, quem]), f (como acabou).
function quadro(sim) {
  const q = {
    t: r2(sim.t),
    s: sim.fim ? 'fim' : sim.situacao,
    c: sim.coelhos.map(c => {
      if (c.estado === 'saiu') return null;
      const [x, y] = posicao(c);
      const e = codigo(c);
      const l = [r2(x), r2(y), indiceDir(c.dir), e, c.pontos];
      if (e === 1) l.push(r1(c.protegido));
      else if (e === 2 || e === 5) l.push(r1(Math.max(0, c.relogio)));
      return l;
    }),
    r: sim.raposas.map(r => {
      const [x, y] = posicao(r);
      return [r2(x), r2(y), indiceDir(r.dir), MODOS.indexOf(r.modo), r.assustada ? 1 : 0];
    }),
    su: r1(sim.susto),
    ce: sim.cenoura ? 1 : 0,
    mv: sim.comidas,
  };
  if (sim.modo === 'coop') q.v = sim.vidas;
  if (sim.popups.length) q.pp = sim.popups.map(p => [r1(p.x), r1(p.y), p.valor, p.i]);
  if (sim.mudouMoedas || sim.cheio || sim.fim || sim.t === 0) q.m = codificarMoedas(sim.moedas);
  if (sim.fim) q.f = sim.fim;
  return q;
}

function maisPontos(sim, lista) {
  if (!lista.length) return [];
  const max = Math.max(...lista.map(i => sim.coelhos[i].pontos));
  const melhores = lista.filter(i => sim.coelhos[i].pontos === max);
  return melhores.length === 1 ? melhores : [];
}

// null enquanto joga; senão { motivo, vencedores }. porTempo: o tempo acabou e é preciso decidir agora.
function resultado(sim, presentes, porTempo = false) {
  const todos = sim.coelhos.map(c => c.i);
  const lista = (Array.isArray(presentes) ? presentes : todos).filter(i => sim.coelhos[i] && sim.coelhos[i].estado !== 'saiu');
  if (sim.fim === 'limpou') return { motivo: 'limpou', vencedores: sim.modo === 'coop' ? lista : maisPontos(sim, lista) };
  if (sim.modo === 'coop') {
    if (!sim.coelhos.some(c => c.estado === 'vivo' || c.estado === 'morto')) return { motivo: 'perderam', vencedores: [] };
  } else {
    if (!lista.length) return { motivo: 'sozinho', vencedores: [] };
    if (sim.n > 1 && lista.length === 1) return { motivo: 'sozinho', vencedores: lista }; // os outros saíram
  }
  if (porTempo) return { motivo: 'tempo', vencedores: sim.modo === 'coop' ? [] : maisPontos(sim, lista) };
  return null;
}

// Os pontos de cada um (junto.js copia para o placar da sala).
const pontos = sim => sim.coelhos.map(c => c.pontos);

module.exports = {
  novo, agir, passo, quadro, resultado, sair, pontos, ritmos, admin,
  // Para os testes.
  _interno: { MAPA, COLS, LINHAS, DIRS, FASES, SAIDAS, LISTA_MOEDAS, BASE64, codificarMoedas, posicao, casaDe, maisPerto, alvo, livre },
};
