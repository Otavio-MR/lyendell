// Batalha da Toca (estilo Free Fire): todos caem de um balão numa ilha, pegam armas e itens no chão e o
// último de pé vence. O servidor roda a partida (passos de 50 ms) e completa com robôs (os Raposos).
//  - Versus: cada um por si, pessoas e robôs. Se quem sobra é um robô, ninguém vence. Se todas as pessoas
//    caem, a partida acaba (não adianta esperar os robôs).
//  - Co-op: as pessoas são uma equipe só contra equipes de robôs, sem fogo amigo; a equipe vence se for a
//    última de pé.
// A área segura fecha em fases (com aviso antes) e quem fica fora perde vida, cada vez mais rápido.
// Os navegadores mandam só os comandos ({ tipo: 'in', ... }, uns 20 por segundo) e cada um recebe um quadro
// com o que está perto do seu coelho (quadroPara), para os quadros ficarem pequenos.
// Puro (sem rede e sem relógio): a mesma semente com os mesmos comandos dá os mesmos quadros.
// BATALHA_ESCALA (só para testes) encurta o balão e a área segura (0,05 = 20 vezes mais rápido).

const adm = require('./adm-jogos');

const MUNDO = 2400;
const T = 40;              // lado de uma casa do terreno
const G = MUNDO / T;       // 60 x 60 casas
const C = MUNDO / 2;
const MAR = 0, AREIA = 1, GRAMA = 2, RIO = 3, PONTE = 4;
const BALDE = 120;         // os obstáculos e itens ficam em baldes de 120 x 120 (para achar rápido)
const NB = MUNDO / BALDE;
const RAIO = 14;           // o tamanho de um lutador
const VEL = 210;           // andando (unidades por segundo)
const VEL_QUEDA = 150;     // planando
const QUEDA = 3.5;         // segundos planando
const VEL_BALAO = 230;
const TOTAL = 12;          // pessoas + robôs no versus
const VISTA = 820;         // meia largura do que cada um enxerga
const VISTA_ARCO = 1040;   // com o arco longo na mão, enxerga mais longe
const SUBPASSO = 0.05;

// As armas: dano por tiro, tiros por segundo, pente, segundos para recarregar, velocidade e alcance do
// tiro, espalhamento (radianos), quantos projéteis por tiro e a munição que usa.
const ARMAS = [
  { id: 'estilingue', nome: 'Estilingue', dano: 20, cad: 3.5, pente: 12, recarga: 1.2, vel: 1100, alcance: 650, disp: 0.05, balas: 1, mun: 0 },
  { id: 'besta', nome: 'Besta', dano: 24, cad: 5.5, pente: 20, recarga: 2.0, vel: 1400, alcance: 850, disp: 0.045, balas: 1, mun: 1 },
  { id: 'escopeta', nome: 'Escopeta', dano: 12, cad: 1.1, pente: 5, recarga: 2.4, vel: 950, alcance: 320, disp: 0.3, balas: 7, mun: 2 },
  { id: 'arco', nome: 'Arco longo', dano: 80, cad: 0.75, pente: 4, recarga: 2.6, vel: 2100, alcance: 1400, disp: 0.006, balas: 1, mun: 3 },
  { id: 'metralhadora', nome: 'Metralhadora de bolotas', dano: 12, cad: 11, pente: 30, recarga: 1.8, vel: 1050, alcance: 520, disp: 0.12, balas: 1, mun: 0 },
];
const PATADA = { dano: 12, cad: 2, vel: 900, alcance: 46 }; // sem arma, o coelho dá patadas (bem de perto)
const COD_GRANADA = 5, COD_ZONA = 6, COD_PATADA = 7, COD_SAIU = 8;
const MUNICOES = ['leve', 'pesada', 'cartucho', 'flecha'];
const CAP_MUN = [90, 60, 20, 12];
const PACOTE_MUN = [30, 20, 8, 6];
const CAP = { band: 4, poc: 2, gran: 2 }; // a mochila dobra tudo
const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário'];
const MULT = [1, 1.08, 1.16, 1.25, 1.35];
// Itens no chão (k): arma, munição, bandagem, poção de escudo, granada de cenoura, mochila.
const ARMA = 0, MUN = 1, BAND = 2, POC = 3, GRAN = 4, MOCH = 5;
// Estados de um lutador.
const AVIAO = 0, CAINDO = 1, VIVO = 2, FORA = 3, SAIU = 4;
// Obstáculos: os que bloqueiam tiro (todos menos a janela) e o tamanho do tronco das árvores.
const OBSTACULOS = ['arvore', 'pedra', 'caixa', 'parede', 'janela', 'moinho', 'torre', 'feno'];
const OB = Object.fromEntries(OBSTACULOS.map((k, i) => [k, i]));
const LUGARES = ['vila', 'moinho', 'porto', 'castelo', 'pomar', 'toca'];
const NOME_LUGAR = { vila: 'Vila Cenoura', moinho: 'Moinho', porto: 'Porto', castelo: 'Castelo Velho', pomar: 'Pomar', toca: 'Toca Funda' };
// A área segura: [espera, fecha (segundos), raio novo, dano por segundo de quem fica fora].
const ZONA = [[45, 30, 760, 2], [35, 25, 500, 4], [30, 20, 300, 7], [25, 15, 160, 11], [20, 15, 60, 16], [15, 15, 0, 25]];
const RAPOSOS = [
  ['Raposo Rubro', '#d8743a'], ['Raposa Ruiva', '#e0884a'], ['Raposo Cinzento', '#8f8f8f'], ['Raposa Fenec', '#e8c27a'],
  ['Raposo Brasa', '#c4502a'], ['Raposa Ártica', '#e6e9ef'], ['Raposo Sombrio', '#5a4740'], ['Raposa Canela', '#b8693a'],
  ['Raposo Ferrugem', '#a0522d'], ['Raposa Malhada', '#c98b5a'], ['Raposo Velhaco', '#9a5b2c'], ['Raposa Astuta', '#d99a4e'],
  ['Raposo Caolho', '#7a4a2a'], ['Raposa Prateada', '#b9bcc4'],
];
const ACOES = new Set(['pegar', 'recarregar', 'trocar', 'arma0', 'arma1', 'curar', 'escudo', 'granada', 'pular', 'mapa']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = x => Math.round(x * 10) / 10;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Números "aleatórios" a partir da semente (o mesmo gerador dos outros jogos).
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

/* ─── O mapa: a ilha, o rio, os lugares, os obstáculos e onde nasce o saque ─── */

function terreno(m, x, y) {
  const cx = Math.floor(x / T);
  const cy = Math.floor(y / T);
  if (cx < 0 || cy < 0 || cx >= G || cy >= G) return MAR;
  return m.ter[cy * G + cx];
}
// Dá para pisar (o mar não deixa; o rio deixa, mas devagar).
const pisavel = (m, x, y) => terreno(m, x - 9, y - 9) !== MAR && terreno(m, x + 9, y - 9) !== MAR
  && terreno(m, x - 9, y + 9) !== MAR && terreno(m, x + 9, y + 9) !== MAR;
const balde = v => clamp(Math.floor(v / BALDE), 0, NB - 1);

function indexar(m) {
  m.baldes = Array.from({ length: NB * NB }, () => []);
  m.marca = 0;
  for (const o of m.ob) {
    o.marca = 0;
    const [x0, y0, x1, y1] = o.c ? [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r] : [o.x, o.y, o.x + o.w, o.y + o.h];
    for (let by = balde(y0); by <= balde(y1); by++) for (let bx = balde(x0); bx <= balde(x1); bx++) m.baldes[by * NB + bx].push(o);
  }
}

// Cada obstáculo (uma vez só) dos baldes que cobrem o retângulo. fn devolvendo false para.
function cadaObstaculo(m, x0, y0, x1, y1, fn) {
  const marca = ++m.marca;
  const bx0 = balde(x0), bx1 = balde(x1), by0 = balde(y0), by1 = balde(y1);
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      for (const o of m.baldes[by * NB + bx]) {
        if (o.marca === marca) continue;
        o.marca = marca;
        if (fn(o) === false) return;
      }
    }
  }
}

// Empurra um círculo para fora dos obstáculos (o mesmo cálculo do navegador, para a previsão bater).
function desencostar(m, x, y, r) {
  for (let it = 0; it < 3; it++) {
    let mexeu = false;
    cadaObstaculo(m, x - r, y - r, x + r, y + r, o => {
      if (o.c) {
        const dx = x - o.x;
        const dy = y - o.y;
        const d = Math.hypot(dx, dy);
        const min = o.r + r;
        if (d >= min) return;
        if (d < 1e-6) x += min;
        else { x = o.x + (dx / d) * min; y = o.y + (dy / d) * min; }
        mexeu = true;
        return;
      }
      const px = clamp(x, o.x, o.x + o.w);
      const py = clamp(y, o.y, o.y + o.h);
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = px + (dx / d) * r;
        y = py + (dy / d) * r;
      } else {
        const e = x - o.x, di = o.x + o.w - x, c = y - o.y, b = o.y + o.h - y;
        const mn = Math.min(e, di, c, b);
        if (mn === e) x = o.x - r; else if (mn === di) x = o.x + o.w + r; else if (mn === c) y = o.y - r; else y = o.y + o.h + r;
      }
      mexeu = true;
    });
    if (!mexeu) break;
  }
  return [x, y];
}

// Onde (0 a 1) o segmento encosta no círculo ou no retângulo (1 = não encosta).
function tCirculo(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx;
  const fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return 1;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : 1;
}
function tRet(x0, y0, dx, dy, rx, ry, w, h) {
  let tmin = 0;
  let tmax = 1;
  for (const [p, d, lo, hi] of [[x0, dx, rx, rx + w], [y0, dy, ry, ry + h]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return 1;
      continue;
    }
    let t1 = (lo - p) / d;
    let t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 1;
  }
  return tmin;
}

// O primeiro obstáculo no caminho de um tiro: devolve t de 0 a 1 (1 = caminho livre). As janelas deixam passar.
function cortar(m, x0, y0, x1, y1) {
  let melhor = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  cadaObstaculo(m, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), o => {
    if (!o.bala) return;
    const t = o.c ? tCirculo(x0, y0, dx, dy, o.x, o.y, o.r) : tRet(x0, y0, dx, dy, o.x, o.y, o.w, o.h);
    if (t < melhor) melhor = t;
  });
  return melhor;
}
const temVisao = (m, a, b) => cortar(m, a.x, a.y, b.x, b.y) >= 1;

function livreDeObstaculos(m, x, y, r) {
  let livre = true;
  cadaObstaculo(m, x - r, y - r, x + r, y + r, o => {
    if (o.c ? Math.hypot(x - o.x, y - o.y) < o.r + r : x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) { livre = false; return false; }
  });
  return livre;
}

function gerarMapa(sorte) {
  const ter = new Uint8Array(G * G);
  const fa = [0, 1, 2, 3].map(() => sorte() * Math.PI * 2);
  const raioIlha = th => 1010 + 80 * Math.sin(3 * th + fa[0]) + 50 * Math.sin(5 * th + fa[1]) + 30 * Math.sin(2 * th + fa[2]);
  const rioX = y => C + 300 * Math.sin(y / 470 + fa[3]);
  const pontes = [-600, 0, 600].map(d => Math.round(C + d + (sorte() - 0.5) * 160));
  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      const x = cx * T + T / 2;
      const y = cy * T + T / 2;
      const d = Math.hypot(x - C, y - C);
      const r = raioIlha(Math.atan2(y - C, x - C));
      let t = d > r ? MAR : d > r - 80 ? AREIA : GRAMA;
      if (t !== MAR && Math.abs(x - rioX(y)) < 48) t = pontes.some(py => Math.abs(y - py) < 40) ? PONTE : RIO;
      ter[cy * G + cx] = t;
    }
  }
  const m = { ter, ob: [], casas: [], lugares: [], pontos: [], decor: [] };
  const terra = (x, y) => { const t = terreno(m, x, y); return t === GRAMA || t === AREIA; };
  const areaDeTerra = (x, y, r) => {
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rr = k === 8 ? 0 : r;
      if (!terra(x + Math.cos(a) * rr, y + Math.sin(a) * rr)) return false;
    }
    return true;
  };
  const circulo = (k, x, y, r) => m.ob.push({ k: OB[k], c: true, x: Math.round(x), y: Math.round(y), r, bala: k !== 'janela' });
  const ret = (k, x, y, w, h) => m.ob.push({ k: OB[k], c: false, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), bala: k !== 'janela' });
  const ponto = (x, y, bonus = 0) => m.pontos.push({ x: Math.round(x), y: Math.round(y), bonus });
  const E = 14;
  // Uma parede com porta, janela ou inteira.
  function lado(x, y, comp, horiz, tipo, grossura = E) {
    if (tipo === 'parede') { if (horiz) ret('parede', x, y, comp, grossura); else ret('parede', x, y, grossura, comp); return; }
    const vao = tipo === 'porta' ? 64 : tipo === 'portao' ? 92 : 48;
    const a = (comp - vao) / 2;
    if (horiz) { ret('parede', x, y, a, grossura); ret('parede', x + a + vao, y, a, grossura); } else { ret('parede', x, y, grossura, a); ret('parede', x, y + a + vao, grossura, a); }
    if (tipo === 'janela') { if (horiz) ret('janela', x + a, y, vao, grossura); else ret('janela', x, y + a, grossura, vao); }
  }
  // Uma casinha: duas portas em lados opostos, janelas nos outros (às vezes parede inteira).
  function casa(cx, cy, w, h, bonus = 0) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;
    m.casas.push([Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)]);
    const deitada = sorte() < 0.5;
    const tipos = [0, 1, 2, 3].map(l => ((l % 2 === 0) === deitada ? 'porta' : sorte() < 0.75 ? 'janela' : 'parede'));
    lado(x0, y0, w, true, tipos[0]);
    lado(x0, y0 + h - E, w, true, tipos[2]);
    lado(x0, y0 + E, h - 2 * E, false, tipos[3]);
    lado(x0 + w - E, y0 + E, h - 2 * E, false, tipos[1]);
    ponto(cx, cy, bonus);
    if (w * h > 18000) ponto(cx + (sorte() < 0.5 ? -1 : 1) * w * 0.25, cy + (sorte() - 0.5) * h * 0.3, bonus);
  }
  const caixa = (x, y, comLoot = true) => { ret('caixa', x - 22, y - 22, 44, 44); if (comLoot) ponto(x + 38, y + 4); };

  const construir = {
    vila(x, y) {
      for (const [dx, dy] of [[-125, -110], [125, -110], [-125, 115], [125, 115]]) casa(x + dx, y + dy, 140 + Math.round(sorte() * 30), 115 + Math.round(sorte() * 20));
      caixa(x - 10, y + 8);
      caixa(x + 34, y - 6, false);
      m.decor.push([0, x + 18, y + 52]);
    },
    moinho(x, y) {
      circulo('moinho', x, y, 46);
      ponto(x + 70, y);
      casa(x - 175, y + 95, 140, 115);
      casa(x + 165, y - 100, 130, 120);
      for (let k = 0; k < 5; k++) {
        const a = sorte() * Math.PI * 2;
        circulo('feno', x + Math.cos(a) * 130, y + Math.sin(a) * 130, 20);
      }
      ponto(x - 60, y - 90);
    },
    porto(x, y, ux, uy) {
      // O píer entra no mar a partir do porto.
      for (let s = 60; s <= 460; s += T / 2) {
        for (const off of [-20, 20]) {
          const px = x + ux * s - uy * off;
          const py = y + uy * s + ux * off;
          const t = terreno(m, px, py);
          if (t === MAR || t === AREIA) {
            const cx = Math.floor(px / T);
            const cy = Math.floor(py / T);
            if (cx >= 0 && cy >= 0 && cx < G && cy < G) ter[cy * G + cx] = PONTE;
          }
        }
      }
      ponto(x + ux * 420, y + uy * 420, 1);
      const vx = -uy;
      const vy = ux;
      casa(x - ux * 110 + vx * 150, y - uy * 110 + vy * 150, 200, 130);
      casa(x - ux * 110 - vx * 150, y - uy * 110 - vy * 150, 200, 130);
      for (let k = 0; k < 6; k++) caixa(x + vx * (k - 2.5) * 56 + ux * 40, y + vy * (k - 2.5) * 56 + uy * 40, k % 2 === 0);
    },
    castelo(x, y) {
      const L = 380;
      const x0 = x - L / 2;
      const y0 = y - L / 2;
      const g = 22;
      const deitado = sorte() < 0.5;
      const tipos = [0, 1, 2, 3].map(l => ((l % 2 === 0) === deitado ? 'portao' : sorte() < 0.5 ? 'janela' : 'parede'));
      lado(x0, y0, L, true, tipos[0], g);
      lado(x0, y0 + L - g, L, true, tipos[2], g);
      lado(x0, y0 + g, L - 2 * g, false, tipos[3], g);
      lado(x0 + L - g, y0 + g, L - 2 * g, false, tipos[1], g);
      for (const [cx, cy] of [[x0, y0], [x0 + L, y0], [x0, y0 + L], [x0 + L, y0 + L]]) ret('torre', cx - 30, cy - 30, 60, 60);
      casa(x, y, 140, 120, 1);
      for (const [dx, dy] of [[-120, -120], [120, -120], [-120, 120], [120, 120]]) ponto(x + dx, y + dy, 1);
    },
    pomar(x, y) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          if ((i === 1 || i === 2) && (j === 1 || j === 2)) continue;
          circulo('arvore', x + (i - 1.5) * 95 + (sorte() - 0.5) * 16, y + (j - 1.5) * 95 + (sorte() - 0.5) * 16, 18);
        }
      }
      casa(x, y, 120, 100);
      ponto(x - 200, y);
      ponto(x + 200, y + 10);
      m.decor.push([1, x, y - 190]);
    },
    toca(x, y) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + sorte() * 0.25;
        circulo('pedra', x + Math.cos(a) * (140 + sorte() * 30), y + Math.sin(a) * (140 + sorte() * 30), 24 + Math.round(sorte() * 12));
      }
      caixa(x - 40, y - 30);
      caixa(x + 45, y + 35);
      ponto(x, y, 1);
      m.decor.push([2, x + 5, y - 5]);
    },
  };

  // Os seis lugares, em volta do centro, longe do rio e uns dos outros.
  const base = sorte() * Math.PI * 2;
  const ordem = [...LUGARES];
  for (let k = ordem.length - 1; k > 0; k--) { const j = Math.floor(sorte() * (k + 1)); [ordem[k], ordem[j]] = [ordem[j], ordem[k]]; }
  ordem.forEach((tipo, k) => {
    let achou = null;
    const ang0 = base + (k * Math.PI) / 3;
    for (let tent = 0; tent < 60 && !achou; tent++) {
      const ang = ang0 + (tent % 2 ? 1 : -1) * Math.floor((tent + 1) / 2) * 0.09;
      for (let d = tipo === 'porto' ? 980 : 640; d >= 260; d -= 40) {
        const x = C + Math.cos(ang) * d;
        const y = C + Math.sin(ang) * d;
        const raio = tipo === 'castelo' ? 250 : tipo === 'porto' ? 170 : 210;
        if (Math.abs(x - rioX(y)) < raio + 70) continue;
        if (!areaDeTerra(x, y, raio)) continue;
        if (m.lugares.some(l => Math.hypot(l.x - x, l.y - y) < 470)) continue;
        achou = { x, y, ang };
        break;
      }
    }
    if (!achou) achou = { x: C + Math.cos(ang0) * 420, y: C + Math.sin(ang0) * 420, ang: ang0 };
    const x = Math.round(achou.x);
    const y = Math.round(achou.y);
    m.lugares.push({ tipo, nome: NOME_LUGAR[tipo], x, y });
    construir[tipo](x, y, Math.cos(achou.ang), Math.sin(achou.ang));
  });

  // Árvores, pedras e caixas espalhadas pela ilha.
  const longeDosLugares = (x, y, r) => m.lugares.every(l => Math.hypot(l.x - x, l.y - y) > (l.tipo === 'castelo' ? 260 : 240) + r);
  const longeDoRio = (x, y, r) => Math.abs(x - rioX(y)) > 60 + r && pontes.every(py => Math.abs(y - py) > 60 + r || Math.abs(x - rioX(y)) > 140);
  const vago = (x, y, r) => m.ob.every(o => (o.c ? Math.hypot(o.x - x, o.y - y) > o.r + r + 40 : x + r + 30 < o.x || x - r - 30 > o.x + o.w || y + r + 30 < o.y || y - r - 30 > o.y + o.h));
  const espalhar = (qtd, tentativas, r, ok, fazer) => {
    let feitos = 0;
    for (let k = 0; k < tentativas && feitos < qtd; k++) {
      const x = 100 + sorte() * (MUNDO - 200);
      const y = 100 + sorte() * (MUNDO - 200);
      if (!ok(x, y) || !longeDosLugares(x, y, r) || !longeDoRio(x, y, r) || !vago(x, y, r)) continue;
      fazer(x, y);
      feitos++;
    }
  };
  espalhar(150, 1600, 18, (x, y) => areaDeTerra(x, y, 30) && terreno(m, x, y) === GRAMA, (x, y) => circulo('arvore', x, y, 18));
  espalhar(55, 900, 30, (x, y) => areaDeTerra(x, y, 36), (x, y) => circulo('pedra', x, y, 18 + Math.round(sorte() * 16)));
  espalhar(26, 700, 32, (x, y) => areaDeTerra(x, y, 50), (x, y) => caixa(x, y));
  espalhar(70, 900, 6, (x, y) => terreno(m, x, y) === GRAMA, (x, y) => m.decor.push([3, Math.round(x), Math.round(y)]));
  indexar(m);
  // Saque solto pelo mato (fora dos obstáculos).
  for (let k = 0, feitos = 0; k < 500 && feitos < 40; k++) {
    const x = 100 + sorte() * (MUNDO - 200);
    const y = 100 + sorte() * (MUNDO - 200);
    if (!areaDeTerra(x, y, 24) || !livreDeObstaculos(m, x, y, 30)) continue;
    ponto(x, y);
    feitos++;
  }
  m.rio = { fase: fa[3], pontes };
  return m;
}

/* ─── Itens no chão ─── */

function guardarItem(sim, it) {
  sim.itens.set(it.id, it);
  sim.baldesItens[balde(it.y) * NB + balde(it.x)].add(it);
}
function tirarItem(sim, it) {
  sim.itens.delete(it.id);
  sim.baldesItens[balde(it.y) * NB + balde(it.x)].delete(it);
  sim.removidos.push([sim.passos, it.id]); // quem já conhecia este item fica sabendo no próximo quadro
}
// Pegou só uma parte: o resto vira um item novo (assim o navegador só precisa saber de itens que somem).
function sobrou(sim, it, q) {
  tirarItem(sim, it);
  if (q > 0) novoItem(sim, it.k, it.t, it.r, q, it.x, it.y);
}
function novoItem(sim, k, t, r, q, x, y) {
  const it = { id: sim.proxItem++, k, t, r, q, x: Math.round(clamp(x, 20, MUNDO - 20)), y: Math.round(clamp(y, 20, MUNDO - 20)) };
  guardarItem(sim, it);
  return it;
}
function cadaItem(sim, x0, y0, x1, y1, fn) {
  for (let by = balde(y0); by <= balde(y1); by++) for (let bx = balde(x0); bx <= balde(x1); bx++) for (const it of sim.baldesItens[by * NB + bx]) fn(it);
}
// Um lugar livre perto de (x, y) para largar um item.
function lugarParaItem(sim, x, y, k) {
  for (let tent = 0; tent < 8; tent++) {
    const a = k * 2.399 + tent * 0.8;
    const r = 18 + (k % 4) * 12 + tent * 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (pisavel(sim.mapa, px, py) && livreDeObstaculos(sim.mapa, px, py, 8)) return [px, py];
  }
  return [x, y];
}

function sortearRaridade(sorte, bonus) {
  const v = sorte();
  let r = v < 0.5 ? 0 : v < 0.76 ? 1 : v < 0.9 ? 2 : v < 0.97 ? 3 : 4;
  if (bonus && sorte() < 0.6) r = Math.min(4, r + 1);
  return r;
}
const PESO_ARMAS = [30, 20, 18, 10, 22];
function sortearArma(sorte) {
  let v = sorte() * PESO_ARMAS.reduce((a, b) => a + b, 0);
  for (let k = 0; k < PESO_ARMAS.length; k++) { v -= PESO_ARMAS[k]; if (v < 0) return k; }
  return 0;
}

function espalharSaque(sim) {
  const s = sim.sorte;
  let mochilas = 0;
  sim.mapa.pontos.forEach((p, n) => {
    const qtd = p.bonus ? 2 : 1 + (s() < 0.35 ? 1 : 0);
    for (let j = 0; j < qtd; j++) {
      const v = s();
      const [x, y] = lugarParaItem(sim, p.x, p.y, n * 3 + j * 2);
      if (v < 0.42) {
        const t = sortearArma(s);
        novoItem(sim, ARMA, t, sortearRaridade(s, p.bonus), ARMAS[t].pente, x, y);
        const [mx, my] = lugarParaItem(sim, p.x, p.y, n * 3 + j * 2 + 1);
        novoItem(sim, MUN, ARMAS[t].mun, 0, PACOTE_MUN[ARMAS[t].mun], mx, my);
      } else if (v < 0.62) {
        const t = Math.floor(s() * 4);
        novoItem(sim, MUN, t, 0, PACOTE_MUN[t], x, y);
      } else if (v < 0.78) novoItem(sim, BAND, 0, 0, 2, x, y);
      else if (v < 0.88) novoItem(sim, POC, 0, 0, 1, x, y);
      else if (v < 0.95 || mochilas >= 6) novoItem(sim, GRAN, 0, 0, 1, x, y);
      else { novoItem(sim, MOCH, 0, 0, 1, x, y); mochilas++; }
    }
  });
}

/* ─── A partida ─── */

function novoLutador(i, humano, nome, eq) {
  return {
    i, humano, nome, eq, estado: AVIAO, x: C, y: C, vx: 0, vy: 0, vida: 100, escudo: 0,
    armas: [null, null], arma: 0, mun: [0, 0, 0, 0], band: 0, poc: 0, gran: 0, mochila: false,
    espera: 0, recarga: 0, cura: null, in: { mx: 0, my: 0, a: 0, at: false, d: 300 }, inT: 0, sq: 0, acoes: [],
    abates: 0, colocacao: 0, matador: -1, atacante: -1, atacadoEm: -99, dorAng: 0, tiro: -99, queda: 0, bot: null,
  };
}

function novaZona(sim, de, raio) {
  for (let k = 0; k < 14; k++) {
    const a = sim.sorte() * Math.PI * 2;
    const d = Math.sqrt(sim.sorte()) * Math.max(0, de.r - raio) * 0.85;
    const x = de.x + Math.cos(a) * d;
    const y = de.y + Math.sin(a) * d;
    if (terreno(sim.mapa, x, y) !== MAR || k === 13) return { x: Math.round(x), y: Math.round(y), r: raio };
  }
  return { x: de.x, y: de.y, r: raio };
}

// ids (opcional): o usuário de cada pessoa, para as pegadinhas do menu de administrador (veja uidDe).
function novo({ modo, n, dif, semente, escala, autopiloto, ids } = {}) {
  n = clamp(Math.floor(Number(n) || 1), 1, 10);
  dif = Math.max(1, Number(dif) || 1);
  const coop = modo === 'coop';
  escala = Math.max(0.01, Number(escala) || Number(process.env.BATALHA_ESCALA) || 1);
  const sorte = sorteDe(Number(semente) || 0);
  const mapa = gerarMapa(sorte);
  const robos = coop ? Math.max(4, TOTAL - n) : Math.max(0, TOTAL - n);
  const tamEquipe = coop ? clamp(n, 2, 4) : 1;
  const sim = {
    modo: coop ? 'coop' : 'versus', n, dif, escala, sorte, mapa, t: 0, passos: 0, fim: null, autopiloto: !!autopiloto,
    lutadores: [], balas: [], granadas: [], explosoes: [], feed: [], acertos: [],
    itens: new Map(), baldesItens: Array.from({ length: NB * NB }, () => new Set()), proxItem: 1, proxFeed: 1,
    mapaPara: new Set(), conhecidos: new Map(), removidos: [], balao: null, zona: null,
    uids: Array.isArray(ids) ? ids.slice(0, n) : null,
  };
  const nomes = [...RAPOSOS];
  for (let k = nomes.length - 1; k > 0; k--) { const j = Math.floor(sorte() * (k + 1)); [nomes[k], nomes[j]] = [nomes[j], nomes[k]]; }
  for (let i = 0; i < n + robos; i++) {
    const humano = i < n;
    const eq = coop ? (humano ? 0 : 1 + Math.floor((i - n) / tamEquipe)) : i;
    const p = novoLutador(i, humano, humano ? null : nomes[(i - n) % nomes.length][0], eq);
    if (!humano) p.pelo = nomes[(i - n) % nomes.length][1];
    sim.lutadores.push(p);
  }
  espalharSaque(sim);

  // O balão cruza a ilha numa linha reta que passa perto do centro.
  const ang = sorte() * Math.PI * 2;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const off = (sorte() - 0.5) * 500;
  const ini = { x: C - ux * 1500 - uy * off, y: C - uy * 1500 + ux * off };
  const fim = { x: C + ux * 1500 - uy * off, y: C + uy * 1500 + ux * off };
  let sIni = 1;
  let sFim = 0;
  for (let s = 0; s <= 1; s += 0.005) {
    if (terreno(mapa, ini.x + (fim.x - ini.x) * s, ini.y + (fim.y - ini.y) * s) !== MAR) { sIni = Math.min(sIni, s); sFim = Math.max(sFim, s); }
  }
  if (sFim < sIni) { sIni = 0.3; sFim = 0.7; }
  sim.balao = { ini, fim, s: Math.max(0, sIni - 0.05), sIni, sFim, vel: VEL_BALAO / 3000 / escala, voando: true };

  // Os robôs escolhem onde cair: um lugar com nome (às vezes um ponto qualquer) e pulam na hora certa.
  for (const p of sim.lutadores) {
    if (p.humano && !sim.autopiloto) continue;
    p.bot = novoCerebro(sim);
    let alvo;
    if (sorte() < 0.7) alvo = mapa.lugares[Math.floor(sorte() * mapa.lugares.length)];
    else {
      const s = sIni + sorte() * (sFim - sIni);
      alvo = { x: ini.x + (fim.x - ini.x) * s + (sorte() - 0.5) * 600, y: ini.y + (fim.y - ini.y) * s + (sorte() - 0.5) * 600 };
    }
    const s = clamp(((alvo.x - ini.x) * ux + (alvo.y - ini.y) * uy) / 3000, sIni + 0.01, sFim - 0.01);
    p.bot.salto = s + (sorte() - 0.5) * 0.02;
    p.bot.pouso = { x: alvo.x + (sorte() - 0.5) * 260, y: alvo.y + (sorte() - 0.5) * 260 };
  }

  const atual = { x: C, y: C, r: 1400 };
  sim.zona = { ...atual, fase: 0, modo: 'espera', resta: ZONA[0][0] * escala, de: { ...atual }, para: novaZona(sim, atual, ZONA[0][2]) };
  return sim;
}

function novoCerebro(sim) {
  return {
    pensa: sim.sorte() * 0.2, alvo: -1, visao: false, reacao: 0, viuEm: -99, meta: null, metaAte: 0, lado: sim.sorte() < 0.5 ? 1 : -1,
    erro: 0, ultimo: null, travado: 0, desvio: 0, desvioAng: 0, salto: 0.5, pouso: null, granadaEm: 0, mov: [0, 0], pegarId: null,
  };
}

/* ─── Comandos ─── */

// O usuário de cada pessoa (sim.uids[i]), para as pegadinhas do menu de administrador (congelar, lento,
// invertido). Robôs não têm. Sem a lista, ninguém é atrapalhado (e o jogo continua puro).
const uidDe = (sim, p) => (p.humano ? sim.uids?.[p.i] ?? null : null);

// ev: { tipo: 'in', sq, mx, my, a, d, at, ac: ['pegar', ...], id } (id: o item para pegar).
function agir(sim, i, ev) {
  const p = sim.lutadores[i];
  if (!p || sim.fim || !ev || ev.tipo !== 'in' || p.estado === SAIU) return null;
  if (Array.isArray(ev.ac)) {
    const congelado = !adm.podeAgir(uidDe(sim, p)); // congelado (pegadinha): só pode pedir o mapa
    for (const a of ev.ac.slice(0, 6)) {
      if (!ACOES.has(a)) continue;
      if (a === 'mapa') { sim.mapaPara.delete(i); sim.conhecidos.delete(i); continue; }
      if (congelado) continue;
      if (p.acoes.length < 8) p.acoes.push(a === 'pegar' && Number.isInteger(ev.id) ? { a, id: ev.id } : { a });
    }
  }
  if (p.bot) return null; // no autopiloto (testes) os comandos de movimento não valem
  let mx = Number(ev.mx) || 0;
  let my = Number(ev.my) || 0;
  const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  const a = Number(ev.a);
  p.in.mx = mx;
  p.in.my = my;
  if (Number.isFinite(a)) p.in.a = clamp(a, -10, 10);
  p.in.at = !!ev.at;
  p.in.d = clamp(Number(ev.d) || 300, 40, 400);
  p.inT = sim.t;
  if (Number.isInteger(ev.sq)) p.sq = ev.sq;
  return null; // não precisa de quadro na hora: o próximo passo já manda
}

function sair(sim, i) {
  const p = sim.lutadores[i];
  if (!p || p.estado === SAIU) return;
  const vivo = p.estado !== FORA;
  if (vivo && !sim.fim) eliminar(sim, p, -1, COD_SAIU);
  p.estado = SAIU;
}

/* ─── Combate ─── */

const capMun = (p, t) => CAP_MUN[t] * (p.mochila ? 2 : 1);
const cap = (p, k) => CAP[k] * (p.mochila ? 2 : 1);
const noChao = p => p.estado === VIVO;
const vivoNaPartida = p => p.estado === AVIAO || p.estado === CAINDO || p.estado === VIVO;
const aliados = (sim, a, b) => a.eq === b.eq;

function aplicarDano(sim, alvo, dano, autor, arma, ax, ay) {
  if (sim.fim || !noChao(alvo) || dano <= 0 || alvo.invencivel > sim.t) return;
  const absorvido = Math.min(alvo.escudo, dano);
  alvo.escudo -= absorvido;
  alvo.vida -= dano - absorvido;
  if (autor >= 0 && autor !== alvo.i) {
    alvo.atacante = autor;
    alvo.atacadoEm = sim.t;
    alvo.dorAng = Math.atan2(ay - alvo.y, ax - alvo.x);
    sim.acertos.push({ autor, x: Math.round(alvo.x), y: Math.round(alvo.y - 20), d: Math.round(dano) });
  }
  if (alvo.vida <= 0) eliminar(sim, alvo, autor, arma);
}

function eliminar(sim, p, autor, arma) {
  if (sim.fim || !vivoNaPartida(p)) return;
  p.vida = 0;
  p.estado = FORA;
  p.foraEm = sim.t;
  p.cura = null;
  p.recarga = 0;
  p.matador = autor;
  const vivos = sim.lutadores.filter(vivoNaPartida).length;
  p.colocacao = vivos + 1;
  const k = autor >= 0 ? sim.lutadores[autor] : null;
  if (k && k !== p && !aliados(sim, k, p)) k.abates++;
  sim.feed.push({ id: sim.proxFeed++, t: sim.t, m: autor, v: p.i, a: arma });
  if (sim.feed.length > 20) sim.feed.shift();
  largarTudo(sim, p);
  conferirFim(sim);
}

function largarTudo(sim, p) {
  let k = 0;
  const largar = (tipo, t, r, q) => { const [x, y] = lugarParaItem(sim, p.x, p.y, k++); novoItem(sim, tipo, t, r, q, x, y); };
  for (const w of p.armas) if (w) largar(ARMA, w.t, w.r, w.pente);
  p.mun.forEach((q, t) => { if (q > 0) largar(MUN, t, 0, q); });
  if (p.band) largar(BAND, 0, 0, p.band);
  if (p.poc) largar(POC, 0, 0, p.poc);
  if (p.gran) largar(GRAN, 0, 0, p.gran);
  if (p.mochila) largar(MOCH, 0, 0, 1);
  p.armas = [null, null];
  p.mun = [0, 0, 0, 0];
  p.band = p.poc = p.gran = 0;
  p.mochila = false;
}

// Acabou? Versus: sobrou um (ou todas as pessoas caíram). Co-op: sobrou uma equipe (ou a equipe caiu).
function conferirFim(sim) {
  if (sim.fim) return;
  const vivos = sim.lutadores.filter(vivoNaPartida);
  const humanosVivos = vivos.filter(p => p.humano);
  const humanos = sim.lutadores.filter(p => p.humano).map(p => p.i);
  if (sim.modo === 'coop') {
    const equipes = new Set(vivos.map(p => p.eq));
    if (equipes.size <= 1 || (!humanosVivos.length && !sim.autopiloto)) {
      const venceu = equipes.size === 1 && equipes.has(0);
      acabar(sim, venceu ? 'sobrou' : 'perderam', venceu ? humanos : [], vivos);
    }
    return;
  }
  if (vivos.length <= 1) {
    const ultimo = vivos[0];
    acabar(sim, 'sobrou', ultimo && ultimo.humano ? [ultimo.i] : [], vivos);
  } else if (!humanosVivos.length && !sim.autopiloto) {
    acabar(sim, 'eliminados', [], vivos);
  }
}

function acabar(sim, motivo, vencedores, vivos) {
  sim.fim = { motivo, vencedores };
  // Quem sobrou divide o 1º lugar (no versus é um só).
  for (const p of vivos) p.colocacao = 1;
  if (motivo === 'eliminados') {
    // As pessoas já caíram; os robôs que sobraram ficam com os primeiros lugares.
    vivos.forEach((p, k) => { p.colocacao = k + 1; });
  }
}

function comecarRecarga(p) {
  const w = p.armas[p.arma];
  if (!w || p.recarga > 0) return;
  const A = ARMAS[w.t];
  if (w.pente >= A.pente || p.mun[A.mun] <= 0) return;
  p.recarga = A.recarga;
  p.cura = null;
}
function terminarRecarga(p) {
  const w = p.armas[p.arma];
  p.recarga = 0;
  if (!w) return;
  const A = ARMAS[w.t];
  const falta = Math.min(A.pente - w.pente, p.mun[A.mun]);
  w.pente += falta;
  p.mun[A.mun] -= falta;
}

function atirar(sim, p, dt) {
  p.espera = Math.max(0, p.espera - dt);
  const w = p.armas[p.arma];
  if (p.recarga > 0) {
    p.recarga -= dt;
    if (p.recarga <= 0) terminarRecarga(p);
    return;
  }
  if (!p.in.at || p.espera > 0 || !adm.podeAgir(uidDe(sim, p))) return; // congelado não atira
  const a = p.in.a;
  if (!w) {
    // Patada: bem de perto.
    p.espera = 1 / PATADA.cad;
    p.tiro = sim.t;
    p.cura = null;
    sim.balas.push({ x: p.x, y: p.y, vx: Math.cos(a) * PATADA.vel, vy: Math.sin(a) * PATADA.vel, dono: p.i, eq: p.eq, dano: PATADA.dano, resta: PATADA.alcance, total: PATADA.alcance, arma: COD_PATADA });
    return;
  }
  if (w.pente <= 0) { comecarRecarga(p); return; }
  const A = ARMAS[w.t];
  w.pente--;
  p.espera = 1 / A.cad;
  p.tiro = sim.t;
  p.cura = null;
  const andando = Math.hypot(p.vx, p.vy) > 40 ? 1.35 : 1;
  for (let k = 0; k < A.balas; k++) {
    const ang = a + (sim.sorte() - 0.5) * 2 * A.disp * andando;
    sim.balas.push({ x: p.x, y: p.y, vx: Math.cos(ang) * A.vel, vy: Math.sin(ang) * A.vel, dono: p.i, eq: p.eq, dano: A.dano * MULT[w.r], resta: A.alcance, total: A.alcance, arma: w.t });
  }
  if (w.pente === 0) comecarRecarga(p);
}

function moverBalas(sim, dt) {
  const m = sim.mapa;
  const ficam = [];
  for (const b of sim.balas) {
    const vel = Math.hypot(b.vx, b.vy);
    const passo = Math.min(vel * dt, b.resta);
    const ux = b.vx / vel;
    const uy = b.vy / vel;
    const dx = ux * passo;
    const dy = uy * passo;
    let t = cortar(m, b.x, b.y, b.x + dx, b.y + dy);
    let quem = null;
    for (const o of sim.lutadores) {
      if (o.i === b.dono || !noChao(o) || o.eq === b.eq) continue;
      if (Math.abs(o.x - b.x) > passo + 30 || Math.abs(o.y - b.y) > passo + 30) continue;
      const to = tCirculo(b.x, b.y, dx, dy, o.x, o.y, RAIO + 3);
      if (to < t) { t = to; quem = o; }
    }
    if (quem) {
      // O dano cai com a distância (de 45% do alcance em diante, até 55% no fim).
      const andou = b.total - b.resta + passo * t;
      const k = andou < 0.45 * b.total ? 1 : 1 - 0.45 * ((andou - 0.45 * b.total) / (0.55 * b.total));
      const dono = sim.lutadores[b.dono];
      aplicarDano(sim, quem, b.dano * k, b.dono, b.arma, dono ? dono.x : b.x, dono ? dono.y : b.y);
      continue;
    }
    if (t < 1) continue; // bateu na parede, pedra, caixa ou árvore
    b.x += dx;
    b.y += dy;
    b.resta -= passo;
    if (b.resta > 0.5 && b.x > 0 && b.y > 0 && b.x < MUNDO && b.y < MUNDO) ficam.push(b);
  }
  sim.balas = ficam;
}

function jogarGranada(sim, p) {
  if (p.gran <= 0 || !noChao(p)) return;
  p.gran--;
  p.cura = null;
  const a = p.in.a;
  const alcance = clamp(p.in.d || 300, 60, 380);
  sim.granadas.push({ x: p.x, y: p.y, ux: Math.cos(a), uy: Math.sin(a), vel: alcance / 0.7, resta: alcance, t: 0.9, dono: p.i, eq: p.eq });
}

function moverGranadas(sim, dt) {
  const m = sim.mapa;
  const ficam = [];
  for (const g of sim.granadas) {
    const passo = Math.min(g.vel * dt, g.resta);
    if (passo > 0) {
      const t = cortar(m, g.x, g.y, g.x + g.ux * passo, g.y + g.uy * passo);
      const anda = t < 1 ? Math.max(0, passo * t - 4) : passo;
      g.x += g.ux * anda;
      g.y += g.uy * anda;
      g.resta = t < 1 ? 0 : g.resta - passo;
    }
    g.t -= dt;
    if (g.t > 0) { ficam.push(g); continue; }
    // Explode: dano até 120 de distância, menos longe do centro; parede protege.
    sim.explosoes.push({ x: Math.round(g.x), y: Math.round(g.y), t: sim.t });
    for (const o of sim.lutadores) {
      if (!noChao(o) || (o.eq === g.eq && o.i !== g.dono)) continue;
      const d = Math.hypot(o.x - g.x, o.y - g.y);
      if (d > 120 || cortar(m, g.x, g.y, o.x, o.y) < 1) continue;
      const dano = 80 * (1 - 0.65 * (d / 120)) * (o.i === g.dono ? 0.5 : 1);
      aplicarDano(sim, o, dano, o.i === g.dono ? -1 : g.dono, COD_GRANADA, g.x, g.y);
      if (o.i === g.dono && o.estado === FORA) o.matador = g.dono;
    }
  }
  sim.granadas = ficam;
}

/* ─── Pegar, curar, trocar ─── */

function pegarItem(sim, p, it, auto) {
  switch (it.k) {
    case ARMA: {
      const vazio = p.armas.findIndex(w => !w);
      if (vazio >= 0) {
        p.armas[vazio] = { t: it.t, r: it.r, pente: it.q };
        if (!p.armas[p.arma] || p.armas[p.arma] === p.armas[vazio]) p.arma = vazio;
        tirarItem(sim, it);
        return true;
      }
      if (auto) return false;
      // As duas mãos cheias: troca pela arma da mão (a velha fica no chão).
      const velha = p.armas[p.arma];
      p.armas[p.arma] = { t: it.t, r: it.r, pente: it.q };
      p.recarga = 0;
      tirarItem(sim, it);
      novoItem(sim, ARMA, velha.t, velha.r, velha.pente, it.x, it.y);
      return true;
    }
    case MUN: {
      const cabe = capMun(p, it.t) - p.mun[it.t];
      if (cabe <= 0) return false;
      const leva = Math.min(cabe, it.q);
      p.mun[it.t] += leva;
      sobrou(sim, it, it.q - leva);
      return true;
    }
    case BAND: case POC: case GRAN: {
      const campo = it.k === BAND ? 'band' : it.k === POC ? 'poc' : 'gran';
      const cabe = cap(p, campo) - p[campo];
      if (cabe <= 0) return false;
      const leva = Math.min(cabe, it.q);
      p[campo] += leva;
      sobrou(sim, it, it.q - leva);
      return true;
    }
    case MOCH:
      if (p.mochila) return false;
      p.mochila = true;
      tirarItem(sim, it);
      return true;
    default: return false;
  }
}

function itemMaisPerto(sim, p, raio, filtro) {
  let melhor = null;
  let md = raio;
  cadaItem(sim, p.x - raio, p.y - raio, p.x + raio, p.y + raio, it => {
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < md && (!filtro || filtro(it))) { md = d; melhor = it; }
  });
  return melhor;
}

function pegar(sim, p, id) {
  let it = Number.isInteger(id) ? sim.itens.get(id) : null;
  if (it && Math.hypot(it.x - p.x, it.y - p.y) > 80) it = null;
  if (!it) it = itemMaisPerto(sim, p, 70);
  if (it) pegarItem(sim, p, it, false);
}

// Munição, curas, granadas e mochila entram sozinhas ao passar por cima; arma só se tiver mão livre.
function pegarSozinho(sim, p) {
  cadaItem(sim, p.x - 32, p.y - 32, p.x + 32, p.y + 32, it => {
    if (!sim.itens.has(it.id) || Math.hypot(it.x - p.x, it.y - p.y) > 32) return;
    pegarItem(sim, p, it, true);
  });
}

function fazerAcao(sim, p, { a, id }) {
  if (a === 'pular') { if (p.estado === AVIAO) pular(sim, p); return; }
  if (!noChao(p)) return;
  switch (a) {
    case 'pegar': pegar(sim, p, id); break;
    case 'recarregar': comecarRecarga(p); break;
    case 'trocar': case 'arma0': case 'arma1': {
      const k = a === 'trocar' ? 1 - p.arma : a === 'arma0' ? 0 : 1;
      if (k !== p.arma) { p.arma = k; p.recarga = 0; p.espera = Math.max(p.espera, 0.25); }
      break;
    }
    case 'curar':
      if (p.band > 0 && p.vida < 100 && !p.cura) { p.band--; p.cura = { tipo: 'band', resta: 4, total: 4 }; p.recarga = 0; }
      break;
    case 'escudo':
      if (p.poc > 0 && p.escudo < 100 && !p.cura) { p.poc--; p.cura = { tipo: 'poc', resta: 1.5, total: 1.5 }; p.recarga = 0; }
      break;
    case 'granada': jogarGranada(sim, p); break;
  }
}

function curar(p, dt) {
  if (!p.cura) return;
  const d = Math.min(dt, p.cura.resta);
  if (p.cura.tipo === 'band') p.vida = Math.min(100, p.vida + 10 * d);
  else p.escudo = Math.min(100, p.escudo + (50 / p.cura.total) * d);
  p.cura.resta -= dt;
  if (p.cura.resta <= 0 || (p.cura.tipo === 'band' && p.vida >= 100)) p.cura = null;
}

/* ─── Balão e queda ─── */

const posBalao = b => ({ x: b.ini.x + (b.fim.x - b.ini.x) * b.s, y: b.ini.y + (b.fim.y - b.ini.y) * b.s });

function pular(sim, p) {
  const { x, y } = posBalao(sim.balao);
  p.estado = CAINDO;
  p.x = clamp(x, 30, MUNDO - 30);
  p.y = clamp(y, 30, MUNDO - 30);
  p.queda = QUEDA * Math.max(0.2, sim.escala);
}

// Achou chão: se caiu no mar ou num obstáculo, vai para o lugar livre mais perto.
function pousar(sim, p) {
  p.estado = VIVO;
  [p.x, p.y] = lugarLivre(sim.mapa, p.x, p.y);
}
function lugarLivre(m, x0, y0) {
  for (let r = 0; r < 1500; r += 20) {
    const voltas = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 20);
    for (let k = 0; k < voltas; k++) {
      const a = (k / voltas) * Math.PI * 2;
      const x = clamp(x0 + Math.cos(a) * r, 40, MUNDO - 40);
      const y = clamp(y0 + Math.sin(a) * r, 40, MUNDO - 40);
      if (pisavel(m, x, y) && terreno(m, x, y) !== RIO && livreDeObstaculos(m, x, y, RAIO + 2)) return [x, y];
    }
  }
  return [x0, y0];
}

function andarBalao(sim, dt) {
  const b = sim.balao;
  if (!b.voando) return;
  b.s += b.vel * dt;
  for (const p of sim.lutadores) {
    if (p.estado !== AVIAO) continue;
    if ((p.bot && b.s >= p.bot.salto) || b.s >= b.sFim) pular(sim, p);
  }
  if (b.s >= 1 || !sim.lutadores.some(p => p.estado === AVIAO)) b.voando = false;
}

/* ─── Movimento ─── */

function velocidade(sim, p) {
  let v = VEL;
  if (terreno(sim.mapa, p.x, p.y) === RIO) v *= 0.55;
  if (p.cura) v *= 0.7;
  return v * adm.velocidade(uidDe(sim, p)); // lento (pegadinha): metade
}

function mover(sim, p, dt) {
  const m = sim.mapa;
  let { mx, my } = p.in;
  if (p.humano && !p.bot && sim.t - p.inT > 1) { mx = 0; my = 0; p.in.at = false; } // sem comandos há 1 s: para
  const uid = uidDe(sim, p);
  if (uid != null) {
    // Pegadinhas: congelado fica parado; invertido anda para o lado contrário.
    const d = adm.direcao(uid, { x: mx, y: my });
    mx = d ? d.x : 0;
    my = d ? d.y : 0;
  }
  if (p.estado === CAINDO) {
    const vq = VEL_QUEDA * adm.velocidade(uid);
    p.x = clamp(p.x + mx * vq * dt, 30, MUNDO - 30);
    p.y = clamp(p.y + my * vq * dt, 30, MUNDO - 30);
    p.vx = mx * vq;
    p.vy = my * vq;
    p.queda -= dt;
    if (p.queda <= 0) pousar(sim, p);
    return;
  }
  const v = velocidade(sim, p);
  const x0 = p.x;
  const y0 = p.y;
  let nx = clamp(p.x + mx * v * dt, RAIO, MUNDO - RAIO);
  if (!pisavel(m, nx, p.y)) nx = p.x;
  let ny = clamp(p.y + my * v * dt, RAIO, MUNDO - RAIO);
  if (!pisavel(m, nx, ny)) ny = p.y;
  [nx, ny] = desencostar(m, nx, ny, RAIO);
  if (!pisavel(m, nx, ny)) { nx = x0; ny = y0; }
  p.x = nx;
  p.y = ny;
  p.vx = (p.x - x0) / dt;
  p.vy = (p.y - y0) / dt;
}

/* ─── Área segura ─── */

function andarZona(sim, dt) {
  const z = sim.zona;
  const esc = sim.escala;
  if (z.modo !== 'fim' && !sim.zonaParada) {
    z.resta -= dt * (sim.zonaRitmo || 1); // o menu de administrador pode parar a área ou fechar mais rápido
    if (z.modo === 'espera' && z.resta <= 0) {
      z.modo = 'fecha';
      z.resta = ZONA[z.fase][1] * esc;
      z.de = { x: z.x, y: z.y, r: z.r };
    } else if (z.modo === 'fecha') {
      const dur = ZONA[z.fase][1] * esc;
      const k = clamp(1 - z.resta / dur, 0, 1);
      z.x = z.de.x + (z.para.x - z.de.x) * k;
      z.y = z.de.y + (z.para.y - z.de.y) * k;
      z.r = z.de.r + (z.para.r - z.de.r) * k;
      if (z.resta <= 0) {
        Object.assign(z, { x: z.para.x, y: z.para.y, r: z.para.r });
        z.fase++;
        if (z.fase < ZONA.length) {
          z.modo = 'espera';
          z.resta = ZONA[z.fase][0] * esc;
          z.para = novaZona(sim, z, ZONA[z.fase][2]);
        } else {
          z.modo = 'fim';
          z.fase = ZONA.length - 1;
          z.resta = 0;
        }
      }
    }
  }
  const dano = (ZONA[Math.min(z.fase, ZONA.length - 1)][3] / esc) * dt;
  for (const p of sim.lutadores) {
    if (!noChao(p) || p.invencivel > sim.t || Math.hypot(p.x - z.x, p.y - z.y) <= z.r) continue;
    p.vida -= dano;
    if (p.vida <= 0) eliminar(sim, p, -1, COD_ZONA);
  }
}

/* ─── Robôs ─── */

const ALCANCE_IDEAL = [300, 380, 140, 600, 230];
const VALOR_ARMA = [1, 2.2, 1.9, 2, 2.1];
const valorArma = w => (w ? VALOR_ARMA[w.t] + w.r * 0.45 : -1);
const usavel = (p, w) => !!w && (w.pente > 0 || p.mun[ARMAS[w.t].mun] > 0);

function quer(p, it) {
  switch (it.k) {
    case ARMA: {
      if (!p.armas[0] || !p.armas[1]) return !p.armas.some(w => w && w.t === it.t) || valorArma({ t: it.t, r: it.r }) > Math.max(valorArma(p.armas[0]), valorArma(p.armas[1]));
      return valorArma({ t: it.t, r: it.r }) > Math.min(valorArma(p.armas[0]), valorArma(p.armas[1])) + 0.8;
    }
    case MUN: return p.armas.some(w => w && ARMAS[w.t].mun === it.t) && p.mun[it.t] < capMun(p, it.t) * 0.6;
    case BAND: return p.band < cap(p, 'band');
    case POC: return p.poc < cap(p, 'poc');
    case GRAN: return p.gran < cap(p, 'gran');
    case MOCH: return !p.mochila;
    default: return false;
  }
}

// A área que importa agora: a próxima, se já está fechando ou vai fechar logo.
function zonaQueImporta(sim) {
  const z = sim.zona;
  if (z.modo === 'fecha' || (z.modo === 'espera' && z.resta < 22 * sim.escala)) return z.para;
  return z;
}

function pontoNaZona(sim, z, frac) {
  for (let k = 0; k < 10; k++) {
    const a = sim.sorte() * Math.PI * 2;
    const d = Math.sqrt(sim.sorte()) * z.r * frac;
    const x = z.x + Math.cos(a) * d;
    const y = z.y + Math.sin(a) * d;
    if (pisavel(sim.mapa, x, y)) return { x, y };
  }
  return { x: z.x, y: z.y };
}

// Um esconderijo: atrás do obstáculo mais perto, do lado contrário ao do inimigo.
function esconderijo(sim, p, inimigo) {
  let melhor = null;
  let md = 280;
  cadaObstaculo(sim.mapa, p.x - 280, p.y - 280, p.x + 280, p.y + 280, o => {
    if (!o.bala) return;
    const ox = o.c ? o.x : o.x + o.w / 2;
    const oy = o.c ? o.y : o.y + o.h / 2;
    const d = Math.hypot(ox - p.x, oy - p.y);
    if (d >= md) return;
    const raio = o.c ? o.r : Math.max(o.w, o.h) / 2;
    const ex = ox - inimigo.x;
    const ey = oy - inimigo.y;
    const l = Math.hypot(ex, ey) || 1;
    md = d;
    melhor = { x: ox + (ex / l) * (raio + 26), y: oy + (ey / l) * (raio + 26) };
  });
  return melhor;
}

function pensar(sim, p) {
  const b = p.bot;
  const m = sim.mapa;
  const D = sim.dif;
  const agora = sim.t;
  const acao = a => { if (p.acoes.length < 8) p.acoes.push(typeof a === 'string' ? { a } : a); };

  // Quem está à vista (até 3 mais perto, com o caminho do tiro livre).
  const perto = [];
  for (const o of sim.lutadores) {
    if (o === p || !noChao(o) || aliados(sim, o, p)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < 740) perto.push([d, o]);
  }
  perto.sort((a, c) => a[0] - c[0] || a[1].i - c[1].i);
  let alvo = null;
  let dAlvo = 0;
  let visto = false;
  for (let k = 0; k < Math.min(3, perto.length); k++) {
    if (temVisao(m, p, perto[k][1])) { [dAlvo, alvo] = perto[k]; visto = true; break; }
  }
  if (!alvo && p.atacante >= 0 && agora - p.atacadoEm < 2) {
    const o = sim.lutadores[p.atacante];
    if (o && noChao(o) && !aliados(sim, o, p)) { alvo = o; dAlvo = dist(o, p); }
  }
  if (alvo) {
    if (b.alvo !== alvo.i) { b.alvo = alvo.i; b.reacao = Math.max(0.15, 0.6 - 0.2 * (D - 1)) + sim.sorte() * 0.3; }
    if (visto) b.viuEm = agora;
  } else b.alvo = -1;
  b.visao = visto;
  b.erro = (sim.sorte() + sim.sorte() - 1) * (0.2 / D);

  // A arma certa para a distância.
  const w = p.armas[p.arma];
  if (alvo) {
    let melhor = p.arma;
    let nota = -1;
    p.armas.forEach((x, k) => {
      if (!usavel(p, x)) return;
      const n = 3 - Math.abs(ALCANCE_IDEAL[x.t] - dAlvo) / 200 + x.r * 0.2 + (x.pente > 0 ? 0.5 : 0);
      if (n > nota) { nota = n; melhor = k; }
    });
    if (melhor !== p.arma && p.recarga <= 0 && sim.sorte() < 0.5) acao(`arma${melhor}`);
  } else if (!usavel(p, w)) {
    const outra = p.armas.findIndex(x => usavel(p, x));
    if (outra >= 0 && outra !== p.arma) acao(`arma${outra}`);
  }
  const arma = p.armas[p.arma];
  if (arma && arma.pente === 0 && p.recarga <= 0) acao('recarregar');
  else if (arma && !alvo && arma.pente < ARMAS[arma.t].pente * 0.5 && p.recarga <= 0) acao('recarregar');

  // Curar quando ninguém está por perto há um tempinho.
  const calmo = !b.visao && agora - b.viuEm > 1.5 && agora - p.atacadoEm > 1.5;
  if (calmo && !p.cura) {
    if (p.vida < 70 && p.band > 0) acao('curar');
    else if (p.escudo < 60 && p.poc > 0) acao('escudo');
  }

  // Para onde ir.
  const zona = zonaQueImporta(sim);
  const dz = Math.hypot(p.x - zona.x, p.y - zona.y);
  const foraAgora = Math.hypot(p.x - sim.zona.x, p.y - sim.zona.y) > sim.zona.r - 30;
  const precisaZona = dz > Math.max(30, zona.r * 0.78);
  let mx = 0;
  let my = 0;
  const ir = (x, y) => {
    const dx = x - p.x;
    const dy = y - p.y;
    const l = Math.hypot(dx, dy);
    if (l > 12) { mx = dx / l; my = dy / l; }
  };
  const fraco = p.vida + p.escudo < 45;
  const armado = p.armas.some(x => usavel(p, x));
  if (precisaZona && (foraAgora || !alvo || !armado)) {
    const k = zona.r * 0.35 / Math.max(1, dz);
    ir(zona.x + (p.x - zona.x) * k, zona.y + (p.y - zona.y) * k);
    b.meta = null;
  } else if (alvo && armado) {
    const ux = (alvo.x - p.x) / Math.max(1, dAlvo);
    const uy = (alvo.y - p.y) / Math.max(1, dAlvo);
    const ideal = ALCANCE_IDEAL[(arma || p.armas.find(x => x) || { t: 0 }).t];
    if ((fraco || p.recarga > 0) && dAlvo > 160) {
      const esc = esconderijo(sim, p, alvo);
      if (esc) ir(esc.x, esc.y); else { mx = -ux; my = -uy; }
    } else {
      const radial = dAlvo > ideal + 60 ? 1 : dAlvo < ideal - 60 ? -0.8 : 0;
      if (sim.sorte() < 0.1) b.lado = -b.lado;
      mx = ux * radial - uy * b.lado * 0.85;
      my = uy * radial + ux * b.lado * 0.85;
    }
    if (p.gran > 0 && dAlvo > 130 && dAlvo < 370 && agora > b.granadaEm && sim.sorte() < 0.08 * D) {
      b.granadaEm = agora + 5;
      p.in.d = dAlvo;
      p.in.a = Math.atan2(alvo.y - p.y, alvo.x - p.x);
      acao('granada');
    }
  } else if (alvo && !armado && dAlvo < 300) {
    // Sem arma: foge (ou dá patada, se o outro está colado).
    const ux = (alvo.x - p.x) / Math.max(1, dAlvo);
    const uy = (alvo.y - p.y) / Math.max(1, dAlvo);
    if (dAlvo < 70) { mx = ux; my = uy; } else { mx = -ux; my = -uy; }
  } else {
    const it = itemMaisPerto(sim, p, 460, x => quer(p, x) && (!precisaZona || Math.hypot(x.x - zona.x, x.y - zona.y) < zona.r * 0.9));
    if (it) {
      ir(it.x, it.y);
      if (Math.hypot(it.x - p.x, it.y - p.y) < 40 && it.k === ARMA) {
        // Troca a pior arma pela nova.
        if (p.armas[0] && p.armas[1]) {
          const pior = valorArma(p.armas[0]) <= valorArma(p.armas[1]) ? 0 : 1;
          if (pior !== p.arma) acao(`arma${pior}`);
        }
        acao({ a: 'pegar', id: it.id });
      }
    } else {
      if (!b.meta || agora > b.metaAte || Math.hypot(b.meta.x - p.x, b.meta.y - p.y) < 40
        || Math.hypot(b.meta.x - zona.x, b.meta.y - zona.y) > zona.r * 0.9) {
        const lugar = m.lugares[Math.floor(sim.sorte() * m.lugares.length)];
        b.meta = sim.sorte() < 0.5 && Math.hypot(lugar.x - zona.x, lugar.y - zona.y) < zona.r * 0.8 ? { x: lugar.x, y: lugar.y } : pontoNaZona(sim, zona, 0.7);
        b.metaAte = agora + 12;
      }
      ir(b.meta.x, b.meta.y);
    }
  }

  // Preso numa parede: desvia um pouco.
  if (b.ultimo && Math.hypot(mx, my) > 0.5 && Math.hypot(p.x - b.ultimo.x, p.y - b.ultimo.y) < 8) {
    if (++b.travado >= 2) { b.desvio = 0.7; b.desvioAng = (sim.sorte() < 0.5 ? -1 : 1) * (Math.PI / 2 + sim.sorte() * 0.6); b.travado = 0; }
  } else b.travado = 0;
  b.ultimo = { x: p.x, y: p.y };
  b.mov = [mx, my];
}

function guiarRobo(sim, p, dt) {
  const b = p.bot;
  if (p.estado === AVIAO) return;
  if (p.estado === CAINDO) {
    const dx = b.pouso.x - p.x;
    const dy = b.pouso.y - p.y;
    const l = Math.hypot(dx, dy);
    p.in.mx = l > 10 ? dx / l : 0;
    p.in.my = l > 10 ? dy / l : 0;
    return;
  }
  b.pensa -= dt;
  b.reacao -= dt;
  if (b.pensa <= 0) {
    b.pensa = 0.2 + sim.sorte() * 0.08;
    pensar(sim, p);
  }
  let [mx, my] = b.mov;
  if (b.desvio > 0) {
    b.desvio -= dt;
    const c = Math.cos(b.desvioAng);
    const s = Math.sin(b.desvioAng);
    [mx, my] = [mx * c - my * s, mx * s + my * c];
  }
  p.in.mx = mx;
  p.in.my = my;
  // Mira (com erro) e atira quando já reagiu.
  const alvo = b.alvo >= 0 ? sim.lutadores[b.alvo] : null;
  if (alvo && noChao(alvo)) {
    const w = p.armas[p.arma];
    const vel = w ? ARMAS[w.t].vel : PATADA.vel;
    const d = dist(alvo, p);
    const tt = d / vel;
    p.in.a = Math.atan2(alvo.y + alvo.vy * tt - p.y, alvo.x + alvo.vx * tt - p.x) + b.erro;
    const alcance = w ? ARMAS[w.t].alcance * 0.92 : PATADA.alcance + 10;
    p.in.at = b.visao && b.reacao <= 0 && d < alcance && !p.cura;
  } else {
    p.in.at = false;
    if (Math.hypot(mx, my) > 0.3) p.in.a = Math.atan2(my, mx);
  }
}

/* ─── O passo do relógio ─── */

function atualizar(sim, dt) {
  sim.t += dt;
  sim.passos++;
  andarBalao(sim, dt);
  for (const p of sim.lutadores) {
    if (p.bot && vivoNaPartida(p)) guiarRobo(sim, p, dt);
    while (p.acoes.length) fazerAcao(sim, p, p.acoes.shift());
  }
  for (const p of sim.lutadores) {
    if (p.estado !== CAINDO && p.estado !== VIVO) continue;
    mover(sim, p, dt);
    if (!noChao(p)) continue;
    if ((sim.passos + p.i) % 2 === 0) pegarSozinho(sim, p);
    curar(p, dt);
    atirar(sim, p, dt);
  }
  moverBalas(sim, dt);
  moverGranadas(sim, dt);
  andarZona(sim, dt);
  if (sim.explosoes.length && sim.t - sim.explosoes[0].t > 0.6) sim.explosoes = sim.explosoes.filter(e => sim.t - e.t <= 0.6);
}

// Um passo do relógio do servidor (uns 50 ms). Devolve false quando a partida já acabou.
function passo(sim, dt) {
  if (sim.fim) return false;
  sim.acertos = [];
  // Os itens que sumiram ficam anotados por uns 10 s (para os quadros de quem ainda não soube).
  if (sim.removidos.length && sim.removidos[0][0] < sim.passos - 200) sim.removidos = sim.removidos.filter(([ps]) => ps >= sim.passos - 200);
  let resta = clamp(Number(dt) || 0, 0, 0.2);
  while (resta > 1e-9 && !sim.fim) {
    const d = Math.min(resta, SUBPASSO);
    atualizar(sim, d);
    resta -= d;
  }
  return true;
}

/* ─── O que vai para os navegadores ─── */

const ESTADOS = [AVIAO, CAINDO, VIVO, FORA, SAIU];
const angulo = a => Math.round(a * 50);

function zonaDoQuadro(sim) {
  const z = sim.zona;
  return [Math.round(z.x), Math.round(z.y), Math.round(z.r), z.para.x, z.para.y, z.para.r, r1(Math.max(0, z.resta)), z.modo === 'fecha' ? 1 : z.modo === 'fim' ? 2 : 0, z.fase];
}
const vivosDe = sim => sim.lutadores.filter(vivoNaPartida).length;

function feedRecente(sim) {
  return sim.feed.filter(f => sim.t - f.t < 10).slice(-5).map(f => [f.id, f.m, f.v, f.a]);
}

// O mapa inteiro (vai uma vez para cada um; o navegador pede de novo com a ação 'mapa').
function mapaDoQuadro(sim) {
  const m = sim.mapa;
  let ter = '';
  for (let k = 0; k < m.ter.length; k++) ter += m.ter[k];
  return {
    ter,
    ob: m.ob.map(o => (o.c ? [o.k, o.x, o.y, o.r] : [o.k, o.x, o.y, o.w, o.h])),
    casas: m.casas,
    lugares: m.lugares.map(l => [l.nome, l.x, l.y, l.tipo]),
    decor: m.decor,
    nomes: sim.lutadores.map(p => (p.humano ? null : p.nome)),
    pelos: sim.lutadores.map(p => p.pelo || null),
    eq: sim.lutadores.map(p => p.eq),
    balao: [Math.round(sim.balao.ini.x), Math.round(sim.balao.ini.y), Math.round(sim.balao.fim.x), Math.round(sim.balao.fim.y)],
  };
}

// Quadro de todos (vai junto com a sala): só o que é de todos.
function quadro(sim) {
  return {
    t: Math.round(sim.t * 100) / 100, s: sim.fim ? 'fim' : 'jogando', f: sim.balao.voando ? 0 : 1, z: zonaDoQuadro(sim),
    v: vivosDe(sim), n: sim.lutadores.length, kf: feedRecente(sim),
  };
}

// Quem a câmera segue: eu (vivo), quem me tirou, ou quem está na frente.
function quemSeguir(sim, p) {
  if (p && vivoNaPartida(p)) return p;
  const mat = p && p.matador >= 0 ? sim.lutadores[p.matador] : null;
  if (mat && vivoNaPartida(mat)) return mat;
  let melhor = null;
  for (const o of sim.lutadores) {
    if (!vivoNaPartida(o)) continue;
    if (p && sim.modo === 'coop' && o.eq === p.eq) return o;
    if (!melhor || o.abates > melhor.abates) melhor = o;
  }
  return melhor || p || sim.lutadores[0];
}

function codigoLutador(sim, o) {
  let flags = 0;
  if (sim.t - o.tiro < 0.15) flags |= 1;
  if (o.cura) flags |= 2;
  if (o.recarga > 0) flags |= 4;
  if (sim.t - o.atacadoEm < 0.25) flags |= 8;
  const w = o.armas[o.arma];
  return [o.i, Math.round(o.x), Math.round(o.y), angulo(o.in.a), ESTADOS.indexOf(o.estado), w ? w.t : -1, Math.max(0, Math.ceil(o.vida)), Math.ceil(o.escudo), flags];
}

// O quadro de uma pessoa (i = -1: quem assiste). Só vai o que está perto da câmera.
function quadroPara(sim, i) {
  const q = quadro(sim);
  const p = i >= 0 ? sim.lutadores[i] : null;
  if (i >= 0 && p && !sim.mapaPara.has(i)) {
    sim.mapaPara.add(i);
    q.mapa = mapaDoQuadro(sim);
  }
  const b = sim.balao;
  if (b.voando) { const pb = posBalao(b); q.ba = [Math.round(pb.x), Math.round(pb.y)]; }
  const cam = quemSeguir(sim, p);
  q.ob = cam ? cam.i : -1;
  const comArco = cam && cam.armas[cam.arma] && cam.armas[cam.arma].t === 3;
  const V = comArco ? VISTA_ARCO : VISTA;
  const cx = cam && cam.estado !== AVIAO ? cam.x : b.voando ? posBalao(b).x : C;
  const cy = cam && cam.estado !== AVIAO ? cam.y : b.voando ? posBalao(b).y : C;
  const ve = (x, y, folga = 0) => Math.abs(x - cx) <= V + folga && Math.abs(y - cy) <= V + folga;
  q.l = [];
  for (const o of sim.lutadores) {
    // Quem caiu fica uns segundos no chão.
    if (o.estado === AVIAO || o.estado === SAIU || (o.estado === FORA && sim.t - o.foraEm > 6)) continue;
    if (o === p || o === cam || ve(o.x, o.y, 40)) q.l.push(codigoLutador(sim, o));
  }
  if (sim.modo === 'coop' && p) {
    q.eq = sim.lutadores.filter(o => o.eq === p.eq && o !== p && vivoNaPartida(o)).map(o => [o.i, Math.round(o.x), Math.round(o.y), o.estado === AVIAO ? 0 : 1]);
  }
  q.b = [];
  for (const bl of sim.balas) {
    if (!ve(bl.x, bl.y, 60)) continue;
    q.b.push([Math.round(bl.x), Math.round(bl.y), angulo(Math.atan2(bl.vy, bl.vx)), bl.arma, Math.round(bl.resta)]);
  }
  // Itens: cada um vai uma vez só (quando aparece na vista); depois só vai o aviso de que sumiu (ir).
  // Quem assiste (-1) não recebe itens.
  if (p) {
    let conhecidos = sim.conhecidos.get(i);
    if (!conhecidos) { conhecidos = { ids: new Set(), passo: -1 }; sim.conhecidos.set(i, conhecidos); }
    const ir = [];
    for (const [ps, id] of sim.removidos) if (ps > conhecidos.passo && conhecidos.ids.delete(id)) ir.push(id);
    if (ir.length) q.ir = ir;
    conhecidos.passo = sim.passos;
    const it = [];
    cadaItem(sim, cx - V, cy - V, cx + V, cy + V, x => {
      if (conhecidos.ids.has(x.id) || !ve(x.x, x.y)) return;
      conhecidos.ids.add(x.id);
      it.push([x.id, x.x, x.y, x.k, x.t, x.k === ARMA ? x.r : x.q]);
    });
    if (it.length) q.it = it;
  }
  if (sim.granadas.length) q.gr = sim.granadas.filter(g => ve(g.x, g.y)).map(g => [Math.round(g.x), Math.round(g.y), r1(g.t)]);
  if (sim.explosoes.length) q.ex = sim.explosoes.filter(e => ve(e.x, e.y, 120)).map(e => [e.x, e.y, r1(sim.t - e.t)]);
  if (p) {
    const dn = sim.acertos.filter(a => a.autor === i).map(a => [a.x, a.y, a.d]);
    if (dn.length) q.dn = dn;
    q.eu = {
      v: Math.max(0, Math.ceil(p.vida)), e: Math.ceil(p.escudo), a: p.arma,
      w: p.armas.map(w => (w ? [w.t, w.r, w.pente] : null)), m: p.mun, bd: p.band, pc: p.poc, gr: p.gran, mo: p.mochila ? 1 : 0,
      rc: p.recarga > 0 ? r1(p.recarga) : 0, cu: p.cura ? r1(p.cura.resta) : 0, ct: p.cura ? p.cura.tipo : null,
      ab: p.abates, es: ESTADOS.indexOf(p.estado), co: p.colocacao, sq: p.sq, mt: p.matador,
      dor: sim.t - p.atacadoEm < 0.6 ? r1(p.dorAng) : null, qd: p.estado === CAINDO ? r1(p.queda) : 0,
    };
  }
  if (sim.fim) q.fim = { motivo: sim.fim.motivo, vencedores: sim.fim.vencedores };
  return q;
}

/* ─── Resultado ─── */

// null enquanto joga; senão { motivo, vencedores }. porTempo: o tempo acabou e é preciso decidir agora.
function resultado(sim, presentes, porTempo = false) {
  const humanos = sim.lutadores.filter(p => p.humano).map(p => p.i);
  const lista = (Array.isArray(presentes) ? presentes : humanos).filter(i => sim.lutadores[i] && sim.lutadores[i].estado !== SAIU);
  if (sim.fim) {
    const venc = sim.modo === 'coop' ? sim.fim.vencedores.filter(i => lista.includes(i)) : sim.fim.vencedores;
    return { motivo: sim.fim.motivo, vencedores: venc };
  }
  if (!lista.length) return { motivo: 'sozinho', vencedores: [] }; // todas as pessoas saíram
  if (!porTempo) return null;
  const vivos = sim.lutadores.filter(vivoNaPartida);
  if (sim.modo === 'coop') {
    const conta = new Map();
    for (const p of vivos) conta.set(p.eq, (conta.get(p.eq) || 0) + 1);
    const nos = conta.get(0) || 0;
    const ganha = nos > 0 && [...conta.entries()].every(([eq, n]) => eq === 0 || n < nos);
    return { motivo: 'tempo', vencedores: ganha ? lista : [] };
  }
  // Versus no fim do tempo: quem mais eliminou (desempate: mais vida).
  const melhor = [...vivos].sort((a, b) => b.abates - a.abates || (b.vida + b.escudo) - (a.vida + a.escudo) || a.i - b.i)[0];
  return { motivo: 'tempo', vencedores: melhor && melhor.humano && lista.includes(melhor.i) ? [melhor.i] : [] };
}

// Os pontos de cada pessoa (junto.js copia para o placar da sala): quantos eliminou.
const pontos = sim => sim.lutadores.filter(p => p.humano).map(p => p.abates);

/* ─── Menu de administrador (src/adm/arena-batalha.js) ─── */

// Leva o lutador para (x, y): no chão, para o lugar livre mais perto; no balão, pula e cai lá.
function levar(sim, p, x, y) {
  if (p.estado === AVIAO) pular(sim, p);
  if (p.estado === CAINDO) { p.x = clamp(x, 30, MUNDO - 30); p.y = clamp(y, 30, MUNDO - 30); return; }
  [p.x, p.y] = lugarLivre(sim.mapa, x, y);
  p.vx = 0;
  p.vy = 0;
}

const admin = {
  // Quem é cada pessoa (os usuários da sala, na mesma ordem): é o que liga as pegadinhas aos lutadores.
  donos(sim, uids) { sim.uids = Array.isArray(uids) ? [...uids] : null; },
  // Vida cheia; quem já tinha caído volta para a ilha (no meio da área segura).
  vida(sim, i) {
    const p = sim.lutadores[i];
    if (!p || p.estado === SAIU || sim.fim) return null;
    if (p.estado === FORA) {
      const z = sim.zona;
      Object.assign(p, { estado: VIVO, vida: 100, escudo: 0, colocacao: 0, matador: -1, atacante: -1, cura: null, recarga: 0, espera: 0 });
      [p.x, p.y] = lugarLivre(sim.mapa, z.x, z.y);
      return 'reviveu';
    }
    p.vida = 100;
    return 'curou';
  },
  escudo(sim, i) { sim.lutadores[i].escudo = 100; },
  invencivel(sim, i, seg) { sim.lutadores[i].invencivel = sim.t + seg; },
  // Uma arma (t: 0 a 4, raridade r: 0 a 4) com o pente e a munição cheios. Mãos cheias: troca a da mão
  // (a velha fica no chão).
  arma(sim, i, t, r) {
    const p = sim.lutadores[i];
    const A = ARMAS[t];
    const nova = { t, r, pente: A.pente };
    const vazio = p.armas.findIndex(w => !w);
    if (vazio >= 0) { p.armas[vazio] = nova; p.arma = vazio; } else {
      const velha = p.armas[p.arma];
      const [x, y] = lugarParaItem(sim, p.x, p.y, 1);
      novoItem(sim, ARMA, velha.t, velha.r, velha.pente, x, y);
      p.armas[p.arma] = nova;
    }
    p.recarga = 0;
    p.mun[A.mun] = capMun(p, A.mun);
  },
  // Itens: 'municao' (toda cheia), 'curas' (bandagens e poções), 'granadas', 'mochila' ou 'tudo'.
  itens(sim, i, qual) {
    const p = sim.lutadores[i];
    if (qual === 'mochila' || qual === 'tudo') p.mochila = true;
    if (qual === 'municao' || qual === 'tudo') p.mun = p.mun.map((_, k) => capMun(p, k));
    if (qual === 'curas' || qual === 'tudo') { p.band = cap(p, 'band'); p.poc = cap(p, 'poc'); }
    if (qual === 'granadas' || qual === 'tudo') p.gran = cap(p, 'gran');
  },
  // Tira as armas da mão (ficam no chão, perto).
  desarmar(sim, i) {
    const p = sim.lutadores[i];
    let n = 0;
    p.armas.forEach((w, k) => {
      if (!w) return;
      const [x, y] = lugarParaItem(sim, p.x, p.y, k + 2);
      novoItem(sim, ARMA, w.t, w.r, w.pente, x, y);
      n++;
    });
    p.armas = [null, null];
    p.recarga = 0;
    return n;
  },
  // destino: 'centro' (da área segura) ou 'longe' (o lugar da área mais longe dos outros).
  teleportar(sim, i, destino) {
    const p = sim.lutadores[i];
    const z = sim.zona;
    if (destino === 'longe') {
      const outros = sim.lutadores.filter(o => o !== p && noChao(o) && !aliados(sim, o, p));
      let melhor = { x: z.x, y: z.y };
      let maior = -1;
      for (let k = 0; k < 40; k++) {
        const c = pontoNaZona(sim, z, 0.9);
        const d = outros.length ? Math.min(...outros.map(o => Math.hypot(o.x - c.x, o.y - c.y))) : 0;
        if (d > maior) { maior = d; melhor = c; }
      }
      levar(sim, p, melhor.x, melhor.y);
    } else levar(sim, p, z.x, z.y);
  },
  // A área segura: fecha a fase de agora na hora (vai direto para o círculo seguinte), fecha mais rápido
  // (ritmo) ou para.
  fecharZona(sim) {
    const z = sim.zona;
    if (z.modo === 'fim') return false;
    Object.assign(z, { x: z.para.x, y: z.para.y, r: z.para.r });
    z.fase++;
    if (z.fase < ZONA.length) {
      z.modo = 'espera';
      z.resta = ZONA[z.fase][0] * sim.escala;
      z.para = novaZona(sim, z, ZONA[z.fase][2]);
    } else {
      z.modo = 'fim';
      z.fase = ZONA.length - 1;
      z.resta = 0;
    }
    return true;
  },
  ritmoZona(sim, r) { sim.zonaRitmo = Math.max(0.25, Math.min(8, Number(r) || 1)); },
  pararZona(sim, parar) { sim.zonaParada = !!parar; },
  // Tira os robôs vivos da ilha (as coisas deles ficam no chão). Devolve quantos.
  tirarRobos(sim) {
    let n = 0;
    for (const p of sim.lutadores) {
      if (p.humano || !vivoNaPartida(p) || sim.fim) continue;
      eliminar(sim, p, -1, COD_SAIU);
      p.estado = SAIU;
      n++;
    }
    return n;
  },
  // Mais robôs: caem do céu dentro da área segura. Devolve quantos entraram.
  colocarRobos(sim, qtd) {
    const livres = Math.max(0, 24 - sim.lutadores.length);
    const n = Math.min(livres, Math.max(1, Math.floor(qtd)));
    if (!n || sim.fim) return 0;
    let eq = Math.max(...sim.lutadores.map(p => p.eq)) + 1;
    for (let k = 0; k < n; k++) {
      const i = sim.lutadores.length;
      const [nome, pelo] = RAPOSOS[i % RAPOSOS.length];
      const p = novoLutador(i, false, nome, sim.modo === 'coop' ? eq + Math.floor(k / 4) : i);
      p.pelo = pelo;
      p.bot = novoCerebro(sim);
      const c = pontoNaZona(sim, sim.zona, 0.8);
      p.bot.pouso = c;
      Object.assign(p, { estado: CAINDO, x: clamp(c.x + (sim.sorte() - 0.5) * 200, 30, MUNDO - 30), y: clamp(c.y + (sim.sorte() - 0.5) * 200, 30, MUNDO - 30), queda: QUEDA * Math.max(0.2, sim.escala) });
      sim.lutadores.push(p);
    }
    // Os navegadores precisam dos nomes e das cores dos novos: o mapa vai de novo para todos.
    sim.mapaPara.clear();
    sim.conhecidos.clear();
    return n;
  },
  // Acaba agora: i vence (no co-op, a equipe toda); -1: ninguém vence.
  vencer(sim, i) {
    if (sim.fim) return;
    const p = i >= 0 ? sim.lutadores[i] : null;
    if (!p) { acabar(sim, 'adm', [], []); return; }
    if (sim.modo === 'coop') {
      const equipe = sim.lutadores.filter(o => o.humano && o.estado !== SAIU);
      acabar(sim, 'adm', equipe.map(o => o.i), equipe);
    } else acabar(sim, 'adm', [i], [p]);
  },
  // Para o menu: como está cada um (estado e se ainda joga).
  estado: (sim, i) => ['balão', 'caindo', 'vivo', 'fora', 'saiu'][sim.lutadores[i]?.estado] ?? 'saiu',
  zona: sim => ({ modo: sim.zona.modo, fase: sim.zona.fase, parada: !!sim.zonaParada, ritmo: sim.zonaRitmo || 1 }),
  robos: sim => sim.lutadores.filter(p => !p.humano && vivoNaPartida(p)).length,
  total: sim => sim.lutadores.length,
  ARMAS: ARMAS.map(a => a.nome),
  RARIDADES,
};

module.exports = {
  novo, agir, passo, quadro, quadroPara, resultado, sair, pontos, admin,
  // Para os testes.
  _interno: {
    MUNDO, T, G, MAR, AREIA, GRAMA, RIO, PONTE, RAIO, VEL, ARMAS, MUNICOES, CAP_MUN, CAP, ZONA, OBSTACULOS, ARMA, MUN, BAND, POC, GRAN, MOCH,
    AVIAO, CAINDO, VIVO, FORA, SAIU, COD_ZONA, COD_GRANADA, terreno, pisavel, cortar, desencostar, livreDeObstaculos, novoItem, tirarItem,
    pegarItem, eliminar, aplicarDano, conferirFim, posBalao, pular, pousar, novoCerebro, valorArma,
  },
};
