// Pac-Coelho: o coelho da Casa Luckham come as moedas (Lírios) e foge das raposas.
// Moeda grande deixa as raposas com medo por alguns segundos; a cenoura é o bônus.

import { h, trocar, icone, botao, cabecalho, aviso, get, post, pode, aoSair, estado, num } from '../core.js';

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
const T = 24; // tamanho de cada casa, em pixels
const W = COLS * T;
const H = LINHAS * T;

const CIMA = [0, -1];
const ESQ = [-1, 0];
const BAIXO = [0, 1];
const DIR = [1, 0];
const DIRS = [CIMA, ESQ, BAIXO, DIR]; // ordem de desempate das raposas
const TECLAS = {
  ArrowUp: CIMA, KeyW: CIMA, ArrowDown: BAIXO, KeyS: BAIXO,
  ArrowLeft: ESQ, KeyA: ESQ, ArrowRight: DIR, KeyD: DIR,
};

const VEL = 9.5; // velocidade máxima, em casas por segundo
// Cada raposa caça de um jeito (como os fantasmas do Pac-Man original).
const RAPOSAS = [
  { nome: 'Rubra', cor: '#e2572f', canto: [25, -3], casa: null, solta: 0, jeito: 'Vai direto atrás de você.' },
  { nome: 'Ártica', cor: '#c3d6e2', canto: [2, -3], casa: [13.5, 14], solta: 1, jeito: 'Tenta chegar na sua frente.' },
  { nome: 'Cinzenta', cor: '#8a95a8', canto: [27, 31], casa: [11.5, 14], solta: 5, jeito: 'Cerca junto com a Rubra.' },
  { nome: 'Fenec', cor: '#e3a84c', canto: [0, 31], casa: [15.5, 14], solta: 9, jeito: 'Chega perto e depois foge.' },
];
// Alternância entre espalhar (cada uma vai para o seu canto) e perseguir, em segundos.
const FASES = [[7, 'dispersar'], [20, 'perseguir'], [7, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [20, 'perseguir'], [5, 'dispersar'], [Infinity, 'perseguir']];
const VALOR_CENOURA = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000];

function velocidades(nivel) {
  if (nivel === 1) return { pac: 0.8, raposa: 0.75, susto: 0.5, tunel: 0.4 };
  if (nivel <= 4) return { pac: 0.9, raposa: 0.85, susto: 0.55, tunel: 0.45 };
  return { pac: 1, raposa: 0.95, susto: 0.6, tunel: 0.5 };
}
const tempoDeSusto = nivel => Math.max(1.5, 7 - nivel);

const colunaCerta = x => ((x % COLS) + COLS) % COLS; // o túnel liga as duas pontas
const celula = (x, y) => (y < 0 || y >= LINHAS ? '#' : MAPA[y][colunaCerta(x)]);
const livre = (x, y) => { const c = celula(x, y); return c !== '#' && c !== '-'; };
const parede = (x, y) => (x < 0 || x >= COLS || y < 0 || y >= LINHAS ? true : MAPA[y][x] === '#');
const mesma = (a, b) => a[0] === b[0] && a[1] === b[1];
const contraria = (a, b) => a[0] === -b[0] && a[1] === -b[1];

export function pacCoelho() {
  if (!pode('recreacao.usar')) { const e = new Error('Sem acesso à Recreação.'); e.status = 403; throw e; }

  const escala = Math.min(2, window.devicePixelRatio || 1);
  const tela = h('canvas', { class: 'pac-tela', width: W * escala, height: H * escala, 'aria-label': 'Labirinto do Pac-Coelho' });
  const g = tela.getContext('2d');
  g.scale(escala, escala);
  const fundo = desenharLabirinto('#b8921f', '#10251a');
  const fundoClaro = desenharLabirinto('#fbf1c7', '#3d6b3f');

  const pontosEl = h('strong', null, '0');
  const recordeEl = h('strong', null, '...');
  const nivelEl = h('strong', null, '1');
  const vidasEl = h('span', { class: 'pac-vidas' });
  const sobre = h('div', { class: 'cobra-sobre' });
  const ranking = h('div');

  let moedas, totalMoedas, comidas, pac, querDir, raposas;
  let pontos = 0;
  let vidas = 3;
  let nivel = 1;
  let vidaExtra = false;
  let recorde = null;
  let situacao = 'inicio';
  let relogio = 0;     // segundos restantes de "pronto", "morrendo" ou "passou"
  let congelado = 0;   // pausa curta depois de comer uma raposa
  let fase = 0;
  let tempoFase = FASES[0][0];
  let susto = 0;
  let combo = 0;
  let cenoura = null;
  let tempoVida = 0;
  let popups = [];
  let t = 0;
  let quadro = null;
  let ultimo = 0;
  let vel = velocidades(1);

  /* ─── Andamento do jogo ─── */

  function novoJogo() {
    pontos = 0;
    vidas = 3;
    nivel = 1;
    vidaExtra = false;
    novoNivel();
    situacao = 'inicio';
    atualizarHud();
    mostrarSobre();
  }

  function novoNivel() {
    moedas = new Uint8Array(COLS * LINHAS);
    totalMoedas = 0;
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = MAPA[y][x];
        if (c === '.' || c === 'o') { moedas[y * COLS + x] = c === '.' ? 1 : 2; totalMoedas++; }
      }
    }
    comidas = 0;
    vel = velocidades(nivel);
    novaVida();
  }

  function novaVida() {
    pac = { tx: 14, ty: 23, dir: ESQ, p: 0.5 };
    querDir = null;
    raposas = RAPOSAS.map((r, i) => (i === 0
      ? { ...r, modo: 'normal', tx: 14, ty: 11, dir: ESQ, p: 0.5, assustada: false, reverter: false }
      : { ...r, modo: 'casa', fx: r.casa[0], fy: r.casa[1], bob: i % 2 ? 1 : -1, dir: CIMA, assustada: false, reverter: false }));
    fase = 0;
    tempoFase = FASES[0][0];
    susto = 0;
    combo = 0;
    cenoura = null;
    tempoVida = 0;
    congelado = 0;
    situacao = 'pronto';
    relogio = 2;
  }

  function somar(n) {
    pontos += n;
    if (!vidaExtra && pontos >= 10000) {
      vidaExtra = true;
      vidas++;
      popups.push({ x: 13.5, y: 20, texto: 'Vida extra!', ate: 1.8 });
    }
    atualizarHud();
  }

  function comerMoeda(x, y) {
    const i = y * COLS + x;
    const m = moedas[i];
    if (!m) return;
    moedas[i] = 0;
    comidas++;
    if (m === 1) somar(10);
    else { somar(50); assustar(); }
    if (comidas === 70 || comidas === 170) cenoura = { ate: 9.5 };
    if (comidas === totalMoedas) { situacao = 'passou'; relogio = 2.2; }
  }

  function assustar() {
    susto = tempoDeSusto(nivel);
    combo = 0;
    for (const r of raposas) {
      if (r.modo === 'olhos' || r.modo === 'entrando') continue;
      r.assustada = true;
      if (r.modo === 'normal') r.reverter = true;
    }
  }

  const modoAtual = () => FASES[fase][1];
  const posicao = e => (e.modo === 'casa' || e.modo === 'saindo' || e.modo === 'entrando') ? [e.fx, e.fy] : [e.tx + e.dir[0] * e.p, e.ty + e.dir[1] * e.p];
  const casaDoPac = () => { const [x, y] = posicao(pac); return [colunaCerta(Math.round(x)), Math.round(y)]; };

  function moverPac(dt) {
    let passo = VEL * vel.pac * dt;
    for (let n = 0; passo > 1e-9 && n < 10; n++) {
      // Meia-volta pode a qualquer momento.
      if (querDir && contraria(querDir, pac.dir) && pac.p > 0) {
        pac.tx = colunaCerta(pac.tx + pac.dir[0]);
        pac.ty += pac.dir[1];
        pac.p = 1 - pac.p;
        pac.dir = querDir;
      }
      if (pac.p === 0) {
        if (querDir && livre(pac.tx + querDir[0], pac.ty + querDir[1])) pac.dir = querDir;
        if (!livre(pac.tx + pac.dir[0], pac.ty + pac.dir[1])) { pac.parado = true; return; }
      }
      pac.parado = false;
      const falta = 1 - pac.p;
      if (passo < falta) { pac.p += passo; return; }
      passo -= falta;
      pac.tx = colunaCerta(pac.tx + pac.dir[0]);
      pac.ty += pac.dir[1];
      pac.p = 0;
      comerMoeda(pac.tx, pac.ty);
      if (situacao !== 'jogando') return;
    }
  }

  function alvo(r) {
    if (r.modo === 'olhos') return [13.5, 11];
    if (modoAtual() === 'dispersar') return r.canto;
    const [px, py] = casaDoPac();
    const [dx, dy] = pac.dir;
    if (r.nome === 'Ártica') return [px + 4 * dx, py + 4 * dy];
    if (r.nome === 'Cinzenta') {
      const rubra = raposas[0];
      const [bx, by] = posicao(rubra);
      const mx = px + 2 * dx;
      const my = py + 2 * dy;
      return [2 * mx - bx, 2 * my - by];
    }
    if (r.nome === 'Fenec') return (r.tx - px) ** 2 + (r.ty - py) ** 2 > 64 ? [px, py] : r.canto;
    return [px, py];
  }

  function escolherCaminho(r) {
    const opcoes = DIRS.filter(d => !contraria(d, r.dir) && livre(r.tx + d[0], r.ty + d[1]));
    if (!opcoes.length) return [-r.dir[0], -r.dir[1]];
    if (r.assustada) return opcoes[Math.floor(Math.random() * opcoes.length)];
    const [ax, ay] = alvo(r);
    let melhor = opcoes[0];
    let menor = Infinity;
    for (const d of opcoes) {
      const dist = (r.tx + d[0] - ax) ** 2 + (r.ty + d[1] - ay) ** 2;
      if (dist < menor) { menor = dist; melhor = d; }
    }
    return melhor;
  }

  function velRaposa(r) {
    if (r.modo === 'olhos') return VEL * 1.7;
    if (r.ty === 14 && (r.tx <= 5 || r.tx >= 22)) return VEL * vel.tunel;
    return VEL * (r.assustada ? vel.susto : vel.raposa);
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

  function moverRaposa(r, dt) {
    if (r.modo === 'casa') {
      r.fy += r.bob * VEL * 0.3 * dt;
      if (r.fy < 13.6) { r.fy = 13.6; r.bob = 1; }
      if (r.fy > 14.4) { r.fy = 14.4; r.bob = -1; }
      r.dir = r.bob > 0 ? BAIXO : CIMA;
      if (tempoVida >= r.solta) r.modo = 'saindo';
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
    let passo = velRaposa(r) * dt;
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
      r.dir = escolherCaminho(r);
    }
  }

  function colisoes() {
    const [px, py] = posicao(pac);
    for (const r of raposas) {
      if (r.modo === 'casa' || r.modo === 'entrando' || r.modo === 'olhos') continue;
      const [rx, ry] = posicao(r);
      let dx = Math.abs(px - rx);
      dx = Math.min(dx, COLS - dx);
      if (dx >= 0.6 || Math.abs(py - ry) >= 0.6) continue;
      if (r.assustada) {
        const valor = 200 * 2 ** combo;
        combo = Math.min(combo + 1, 3);
        somar(valor);
        popups.push({ x: rx, y: ry, texto: num(valor), ate: 0.9 });
        // Comida na porta da toca (ainda saindo), ela volta direto para dentro.
        Object.assign(r, { modo: r.modo === 'saindo' ? 'entrando' : 'olhos', assustada: false });
        congelado = 0.5;
      } else {
        situacao = 'morrendo';
        relogio = 1.8;
        return;
      }
    }
    if (cenoura && Math.abs(py - 17) < 0.5 && Math.abs(px - 13.5) < 0.7) {
      const valor = VALOR_CENOURA[Math.min(nivel, VALOR_CENOURA.length) - 1];
      somar(valor);
      popups.push({ x: 13.5, y: 17, texto: num(valor), ate: 1.4 });
      cenoura = null;
    }
  }

  function atualizar(dt) {
    t += dt;
    popups = popups.filter(p => (p.ate -= dt) > 0);
    if (situacao === 'pronto') { if ((relogio -= dt) <= 0) situacao = 'jogando'; return; }
    if (situacao === 'morrendo') {
      if ((relogio -= dt) <= 0) {
        vidas--;
        atualizarHud();
        if (vidas <= 0) fimDeJogo(); else novaVida();
      }
      return;
    }
    if (situacao === 'passou') {
      if ((relogio -= dt) <= 0) { nivel++; novoNivel(); atualizarHud(); }
      return;
    }
    if (situacao !== 'jogando') return;
    if (congelado > 0) { congelado -= dt; return; }
    tempoVida += dt;
    if (susto > 0) {
      susto -= dt;
      if (susto <= 0) { susto = 0; for (const r of raposas) r.assustada = false; }
    } else if (fase < FASES.length - 1 && (tempoFase -= dt) <= 0) {
      fase++;
      tempoFase = FASES[fase][0];
      for (const r of raposas) if (r.modo === 'normal') r.reverter = true;
    }
    if (cenoura && (cenoura.ate -= dt) <= 0) cenoura = null;
    moverPac(dt);
    if (situacao !== 'jogando') return;
    colisoes();
    if (situacao !== 'jogando') return;
    for (const r of raposas) moverRaposa(r, dt);
    colisoes();
  }

  async function fimDeJogo() {
    situacao = 'fim';
    mostrarSobre();
    if (!pontos) return;
    try {
      const r = await post('/api/recreacao/recordes', { jogo: 'pacman', pontos, detalhe: `nível ${nivel}` });
      if (r.recorde) {
        recorde = pontos;
        atualizarHud();
        if (situacao === 'fim') mostrarSobre(r.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!');
        carregarRanking();
      }
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }

  /* ─── Desenho ─── */

  function desenharLabirinto(corBorda, corParede) {
    const c = document.createElement('canvas');
    c.width = W * escala;
    c.height = H * escala;
    const x2 = c.getContext('2d');
    x2.scale(escala, escala);
    x2.fillStyle = '#060b07';
    x2.fillRect(0, 0, W, H);
    x2.fillStyle = corParede;
    for (let y = 0; y < LINHAS; y++) for (let x = 0; x < COLS; x++) if (MAPA[y][x] === '#') x2.fillRect(x * T, y * T, T, T);
    // Contorno dourado onde a parede encontra o caminho.
    x2.strokeStyle = corBorda;
    x2.lineWidth = 2;
    x2.lineCap = 'round';
    x2.beginPath();
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAPA[y][x] !== '#') continue;
        const X = x * T;
        const Y = y * T;
        if (!parede(x, y - 1)) { x2.moveTo(X, Y + 1); x2.lineTo(X + T, Y + 1); }
        if (!parede(x, y + 1)) { x2.moveTo(X, Y + T - 1); x2.lineTo(X + T, Y + T - 1); }
        if (!parede(x - 1, y)) { x2.moveTo(X + 1, Y); x2.lineTo(X + 1, Y + T); }
        if (!parede(x + 1, y)) { x2.moveTo(X + T - 1, Y); x2.lineTo(X + T - 1, Y + T); }
      }
    }
    x2.stroke();
    // Porta da toca das raposas.
    x2.fillStyle = '#e8a3a0';
    x2.fillRect(13 * T, 12 * T + T * 0.42, 2 * T, T * 0.16);
    return c;
  }

  const px = x => x * T + T / 2;

  function desenharMoedas() {
    const piscar = situacao === 'jogando' && Math.floor(t * 4) % 2 === 1;
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const m = moedas[y * COLS + x];
        if (!m) continue;
        const cx = px(x);
        const cy = px(y);
        if (m === 1) {
          g.fillStyle = '#d8b13a';
          g.beginPath();
          g.arc(cx, cy, T * 0.13, 0, Math.PI * 2);
          g.fill();
        } else if (!piscar) {
          // Lírio grande: moeda com brilho
          g.fillStyle = '#e8c24a';
          g.beginPath();
          g.arc(cx, cy, T * 0.34, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#8c6d15';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(cx, cy, T * 0.22, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = 'rgba(255, 250, 225, 0.8)';
          g.beginPath();
          g.arc(cx - T * 0.1, cy - T * 0.1, T * 0.07, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  function desenharCenoura(cx, cy) {
    const C = T * 1.3;
    g.fillStyle = '#5b8c3e';
    g.beginPath();
    g.ellipse(cx - C * 0.1, cy - C * 0.3, C * 0.08, C * 0.2, -0.5, 0, Math.PI * 2);
    g.ellipse(cx + C * 0.1, cy - C * 0.3, C * 0.08, C * 0.2, 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8812f';
    g.beginPath();
    g.moveTo(cx - C * 0.22, cy - C * 0.16);
    g.quadraticCurveTo(cx, cy - C * 0.28, cx + C * 0.22, cy - C * 0.16);
    g.lineTo(cx, cy + C * 0.42);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120, 50, 10, 0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx - C * 0.11, cy);
    g.lineTo(cx - C * 0.01, cy);
    g.moveTo(cx + C * 0.03, cy + C * 0.14);
    g.lineTo(cx + C * 0.1, cy + C * 0.14);
    g.stroke();
  }

  function desenharCoelho(cx, cy, dir, abertura, tamanho = 1, giro = 0) {
    const r = T * 0.62 * tamanho;
    if (r <= 0.5) return;
    g.save();
    g.translate(cx, cy);
    if (giro) g.rotate(giro);
    if (mesma(dir, ESQ)) g.scale(-1, 1);
    else if (mesma(dir, CIMA)) g.rotate(-Math.PI / 2);
    else if (mesma(dir, BAIXO)) g.rotate(Math.PI / 2);
    // Orelhas para trás, como quem corre.
    for (const [ox, oy, rot] of [[-r * 0.55, -r * 0.7, -0.95], [-r * 0.15, -r * 0.9, -0.45]]) {
      g.save();
      g.translate(ox, oy);
      g.rotate(rot);
      g.fillStyle = '#d4a52c';
      g.beginPath();
      g.ellipse(0, -r * 0.45, r * 0.26, r * 0.62, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e9a7a0';
      g.beginPath();
      g.ellipse(0, -r * 0.45, r * 0.11, r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    const brilho = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    brilho.addColorStop(0, '#f8e79a');
    brilho.addColorStop(1, '#c99a22');
    g.fillStyle = brilho;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, abertura, Math.PI * 2 - abertura);
    g.closePath();
    g.fill();
    g.fillStyle = '#1b1403';
    g.beginPath();
    g.arc(r * 0.12, -r * 0.5, r * 0.13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(232, 130, 120, 0.5)';
    g.beginPath();
    g.arc(-r * 0.12, r * 0.28, r * 0.16, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function desenharRaposa(r, cx, cy) {
    const s = T * 0.62;
    const assustada = r.assustada;
    const piscando = assustada && susto < 2 && Math.floor(t * 5) % 2 === 0;
    g.save();
    g.translate(cx, cy);
    const soOlhos = r.modo === 'olhos' || r.modo === 'entrando'; // comida: só os olhos voltam para a toca
    if (!soOlhos) {
      g.fillStyle = assustada ? (piscando ? '#efe6d0' : '#2b4687') : r.cor;
      // Orelhas pontudas
      g.beginPath();
      g.moveTo(-s * 0.95, -s * 0.15); g.lineTo(-s * 0.78, -s * 1.3); g.lineTo(-s * 0.15, -s * 0.78); g.closePath();
      g.moveTo(s * 0.95, -s * 0.15); g.lineTo(s * 0.78, -s * 1.3); g.lineTo(s * 0.15, -s * 0.78); g.closePath();
      g.fill();
      // Corpo com a barra ondulando
      g.beginPath();
      g.moveTo(-s, s * 0.95);
      g.lineTo(-s, 0);
      g.arc(0, 0, s, Math.PI, 0);
      g.lineTo(s, s * 0.95);
      const onda = Math.floor(t * 8) % 2 ? 0.62 : 0.74;
      for (let i = 0; i < 4; i++) {
        g.lineTo(s - (s / 2) * (i + 0.5), s * onda);
        g.lineTo(s - (s / 2) * (i + 1), s * 0.95);
      }
      g.closePath();
      g.fill();
      if (!assustada) {
        g.fillStyle = 'rgba(40, 20, 10, 0.35)';
        g.beginPath();
        g.moveTo(-s * 0.72, -s * 0.35); g.lineTo(-s * 0.66, -s * 1.02); g.lineTo(-s * 0.35, -s * 0.72); g.closePath();
        g.moveTo(s * 0.72, -s * 0.35); g.lineTo(s * 0.66, -s * 1.02); g.lineTo(s * 0.35, -s * 0.72); g.closePath();
        g.fill();
        // Focinho claro e nariz
        g.fillStyle = '#f7f0e2';
        g.beginPath();
        g.ellipse(r.dir[0] * s * 0.12, s * 0.4, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1b1403';
        g.beginPath();
        g.arc(r.dir[0] * s * 0.3, s * 0.3 + r.dir[1] * s * 0.06, s * 0.12, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = piscando ? '#c0392b' : '#f4dd80';
        g.fillRect(-s * 0.42, -s * 0.3, s * 0.2, s * 0.2);
        g.fillRect(s * 0.22, -s * 0.3, s * 0.2, s * 0.2);
        g.strokeStyle = g.fillStyle;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(-s * 0.6, s * 0.35);
        for (let i = 1; i <= 6; i++) g.lineTo(-s * 0.6 + i * s * 0.2, s * (i % 2 ? 0.2 : 0.35));
        g.stroke();
      }
    }
    if (!assustada) {
      for (const lado of [-1, 1]) {
        g.fillStyle = '#ffffff';
        g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(lado * s * 0.36, -s * 0.2, s * 0.22, s * 0.28, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#1d2a55';
        g.beginPath();
        g.arc(lado * s * 0.36 + r.dir[0] * s * 0.1, -s * 0.2 + r.dir[1] * s * 0.12, s * 0.11, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Desenha perto das pontas também do outro lado, para o túnel não "pular".
  function emVolta(x, desenhar) {
    desenhar(x);
    if (x < 1) desenhar(x + COLS);
    if (x > COLS - 2) desenhar(x - COLS);
  }

  function desenharTudo() {
    g.drawImage(situacao === 'passou' && relogio < 1.8 && Math.floor(t * 5) % 2 ? fundoClaro : fundo, 0, 0, W, H);
    desenharMoedas();
    if (cenoura) desenharCenoura(px(13.5), px(17));
    const [pxp, pyp] = posicao(pac);
    if (situacao !== 'morrendo' && situacao !== 'passou') {
      for (const r of raposas) {
        const [rx, ry] = posicao(r);
        emVolta(rx, x => desenharRaposa(r, px(x), px(ry)));
      }
    }
    if (situacao === 'morrendo') {
      const k = Math.max(0, Math.min(1, (1.8 - relogio - 0.4) / 1.2)); // primeiro para, depois some girando
      emVolta(pxp, x => desenharCoelho(px(x), px(pyp), pac.dir, 0.2 + k * 2.6, 1 - k, k * Math.PI * 2));
    } else {
      const andando = situacao === 'jogando' && !pac.parado && congelado <= 0;
      const boca = andando ? 0.06 + 0.36 * Math.abs(Math.sin(t * 16)) : 0.3;
      emVolta(pxp, x => desenharCoelho(px(x), px(pyp), pac.dir, boca));
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of popups) {
      g.font = `700 ${T * 0.62}px Cinzel, serif`;
      g.fillStyle = '#9fe0f0';
      g.fillText(p.texto, px(p.x), px(p.y));
    }
    if (situacao === 'pronto') {
      g.font = `700 ${T * 0.9}px Cinzel, serif`;
      g.fillStyle = '#f4dd80';
      g.fillText(nivel > 1 && pontos ? `Nível ${nivel}` : 'Pronto!', px(13.5), px(17));
    }
  }

  function passo(agora) {
    const dt = Math.min(0.05, ultimo ? (agora - ultimo) / 1000 : 0);
    ultimo = agora;
    try {
      atualizar(dt);
      desenharTudo();
    } catch (e) {
      console.error('Pac-Coelho:', e); // um erro não pode travar o jogo
    }
    quadro = requestAnimationFrame(passo);
  }

  /* ─── Tela ─── */

  function atualizarHud() {
    pontosEl.textContent = num(pontos);
    nivelEl.textContent = nivel;
    recordeEl.textContent = recorde == null ? '0' : num(recorde);
    trocar(vidasEl, Array.from({ length: Math.max(0, vidas) }, () => icone('coelho')));
  }

  function comecar() {
    if (situacao === 'fim') { novoJogo(); }
    if (situacao === 'inicio') situacao = 'pronto';
    if (situacao === 'pausado') situacao = retomar || 'jogando';
    mostrarSobre();
  }

  let retomar = null;
  function pausar() {
    if (!['jogando', 'pronto'].includes(situacao)) return;
    retomar = situacao;
    situacao = 'pausado';
    mostrarSobre();
  }

  function mostrarSobre(extra) {
    if (!['inicio', 'pausado', 'fim'].includes(situacao)) { sobre.hidden = true; return; }
    sobre.hidden = false;
    const toque = matchMedia('(pointer: coarse)').matches;
    if (situacao === 'inicio') {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Pac-Coelho'),
        h('p', null, 'Coma todos os Lírios e fuja das raposas.'),
        h('p', null, toque ? 'Deslize o dedo no labirinto ou use as setas abaixo.' : 'Use as setas ou W A S D. Espaço pausa.'),
        botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar })));
    } else if (situacao === 'pausado') {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Pausado'), botao('Continuar', { classe: 'btn-ouro', onclick: comecar })));
    } else {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim de jogo'),
        h('p', { class: 'cobra-placar' }, `${num(pontos)} pontos`),
        h('p', null, `Chegou ao nível ${nivel}.`),
        extra && h('p', { class: 'cobra-recorde' }, icone('trofeu'), extra),
        botao('Jogar de novo', { classe: 'btn-ouro', onclick: () => { novoJogo(); comecar(); } })));
    }
  }

  function virar(d) {
    querDir = d;
    if (situacao === 'inicio' || situacao === 'pausado') comecar();
  }

  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const d = TECLAS[e.code];
    if (d) { e.preventDefault(); virar(d); return; }
    if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      if (situacao === 'jogando' || situacao === 'pronto') pausar(); else comecar();
    }
    if (e.code === 'Enter' && (situacao === 'fim' || situacao === 'inicio')) { e.preventDefault(); if (situacao === 'fim') novoJogo(); comecar(); }
  };
  document.addEventListener('keydown', aoTeclar);

  let inicio = null;
  tela.addEventListener('pointerdown', e => { inicio = { x: e.clientX, y: e.clientY }; });
  tela.addEventListener('pointerup', e => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    virar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR : ESQ) : (dy > 0 ? BAIXO : CIMA));
  });

  const aoEsconder = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', aoEsconder);
  aoSair(() => {
    cancelAnimationFrame(quadro);
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('visibilitychange', aoEsconder);
  });

  function carregarRanking() {
    get('/api/recreacao/ranking').then(r => {
      const meu = r.pacman.find(l => l.nome === estado.eu.nome);
      if (meu && (recorde == null || meu.pontos > recorde)) recorde = meu.pontos;
      atualizarHud();
      trocar(ranking, r.pacman.length
        ? h('ol', { class: 'mini-ranking' }, r.pacman.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, num(l.pontos)))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda. Seja o primeiro!'));
    }).catch(() => {});
  }

  const seta = (ic, d, rotulo) => h('button', { class: `dpad-${ic}`, type: 'button', 'aria-label': rotulo, onpointerdown: e => { e.preventDefault(); virar(d); } }, icone(ic));
  const legenda = (el, nome, texto) => h('li', null, el, h('span', null, h('strong', null, nome), ' ', texto));
  const bolinha = (cor, tam) => h('span', { class: 'pac-bola', style: { '--cor': cor, '--tam': tam } });

  novoJogo();
  carregarRanking();
  quadro = requestAnimationFrame(passo);

  return h('div', { class: 'pagina' },
    cabecalho({ titulo: 'Pac-Coelho', icone: 'coelho', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub: 'O coelho da Casa Luckham atrás dos Lírios, com as raposas no encalço.' }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area pac-area' },
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Pontos: ', pontosEl),
          h('span', null, 'Nível ', nivelEl),
          vidasEl,
          h('span', null, icone('trofeu'), ' ', recordeEl)),
        h('div', { class: 'cobra-moldura pac-moldura' }, tela, sobre),
        h('div', { class: 'dpad' },
          seta('cima', CIMA, 'Para cima'), seta('voltar', ESQ, 'Para a esquerda'),
          seta('frente', DIR, 'Para a direita'), seta('baixo', BAIXO, 'Para baixo'))),
      h('aside', { class: 'jogo-lateral pac-lateral' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Melhores')),
          ranking),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
          h('ul', { class: 'pac-legenda' },
            legenda(bolinha('#d8b13a', '8px'), 'Lírio', 'vale 10 pontos.'),
            legenda(bolinha('#e8c24a', '16px'), 'Lírio grande', 'vale 50 e deixa as raposas com medo: aí dá para pegá-las (200, 400, 800, 1600).'),
            legenda(h('span', { class: 'pac-cenoura' }, '🥕'), 'Cenoura', 'aparece duas vezes por nível embaixo da toca. Vale bônus.'),
            RAPOSAS.map(r => legenda(bolinha(r.cor, '14px'), r.nome, r.jeito)),
            legenda(icone('coelho'), 'Vida extra', 'aos 10.000 pontos.'))))));
}
