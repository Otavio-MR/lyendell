// Super Coelho: plataforma no estilo dos clássicos. O coelho da Casa Luckham atravessa os Campos de Lyendell,
// as Tocas, as Copas das Árvores e o Castelo do Raposo para salvar a Princesa Cenoura.
// Aqui ficam só as regras e o desenho; a moldura (teclado, toque, som, pausa, recorde, desafio) é o arcade.js.

import { desenharCoelho, desenharRaposa, elipse, desenharArvore, sorte as sorteSemente } from '../desenho-coelho.js';
import { T, LINHAS, TOPO, B, SOLIDO, FASES, nivelBase, posPlataforma, bolasDaBarra, posBolha } from './super-coelho-fases.js';
import { registrarPecas, desenharSprite, temSprite, spriteDe, aoMudarSprites } from '../sprites.js';

const W = 512;
const H = 288;
const FONTE = '"Cinzel", Georgia, serif';

/* ─── Física (unidades lógicas por segundo) ─── */
const ANDAR = 96;
const CORRER = 160;
const ACEL_ANDAR = 260;
const ACEL_CORRER = 340;
const ACEL_AR = 230;
const ATRITO = 420;
const DERRAPAR = 760;
const PULO = 300;
const PULO_CORRIDA = 0.18; // correndo, o pulo vai mais alto
const GRAV_SEGURA = 600; // subindo com o botão apertado
const GRAV = 1800;
const QUEDA_MAX = 330;
const COYOTE = 0.08;
const BUFFER = 0.12;
const LARG = 12;
const PEQUENO = 14;
const GRANDE = 27;
const AGACHADO = 15;

const TEMPO_FASE = 300;
const TIQUE = 0.4;
const POSTE_TOPO = 80; // alto do mastro
const BASE_MASTRO = (TOPO - 1) * T; // em cima do bloco do pé do mastro
const COMBO = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
const COMBO_CASCO = [500, 800, 1000, 2000, 4000, 5000, 8000];
const ARCO_IRIS = ['#ff8a8a', '#ffd36b', '#9be37a', '#7ec8ff', '#d59bff'];

const INIMIGOS = {
  r: { w: 14, h: 12, vel: 34, pisa: true }, // Raposinho
  t: { w: 14, h: 14, vel: 30, pisa: true }, // Tatu
  o: { w: 14, h: 12, vel: 28, pisa: false }, // Ouriço (espinhos)
  m: { w: 14, h: 10, vel: 72, pisa: true }, // Morcego
};
const CHEFE = { w: 34, h: 32, vida: 5 };
const AUTO = { esq: false, dir: true, cima: false, baixo: false, pular: false, acao: false, apertou: new Set() };
const NADA = new Set();

/* ─── Jogo junto (versus e co-op na mesma fase) ─── */
const QUADRO = 1 / 60;
const HORIZONTE = 360; // quadros que dá para voltar no tempo (6 s)
const ALCANCE = 320; // a que distância o meu coelho acorda um inimigo
const ALCANCE_MORCEGO = 150;
const CARTAO = 1.2; // segundos de cartão antes da fase nova (co-op)
const ESPERA_CHEGADA = 0.25; // espera antes do "cheguei": quem tocou primeiro no mastro é quem chama
const LIMITE_EVENTOS = 28; // por segundo (o servidor aceita até 40)
const PELOS_JUNTO = ['#c99a6b', '#9aa3ad', '#e2b3a3', '#8a6a4f', '#f7f3ea', '#d9b48a'];
const MUNDO_EVENTOS = ['acordou', 'matou', 'chutou', 'bloco', 'chefe'];
const COR_HEX = /^#[0-9a-f]{6}$/i;

/* ─── O jogo ─── */

function criar(ctx) {
  const { sorte, som } = ctx;
  // Junto: null quando a pessoa joga sozinha (aí tudo fica exatamente como no solo).
  const jt = ctx.junto || null;
  const DIF = jt ? Number(jt.dif) || 1 : 1;
  const SEM = jt ? (Number(jt.semente) || 0) >>> 0 : 0;
  const J = jt ? { log: [], fotos: [], voltar: null, seq: 0, fila: [], enviados: [], adiantados: [], ultimoPonto: -1, tPonto: 0, posFora: false } : null;
  const S = {
    fase: 0, volta: 1, modo: 'titulo', tm: 0, acabou: false,
    pontos: 0, lirios: 0, totalLirios: 0, vidas: 3, tempo: TEMPO_FASE, relogio: 0, tf: 0,
    cam: 0, meio: false, superVidas: false, derrotados: 0, resgates: 0,
    nivel: null, mudancas: new Map(), multi: new Map(),
    inimigos: [], itens: [], bolas: [], chamas: [], chefe: null, plats: [], bumps: [], popups: [], particulas: [],
    bandeira: POSTE_TOPO + 8, combo: 0, comboEstrela: 0, ponteCaiu: 0, chefeVivo: false, fogos: 0, bonus: 0, tFim: -1, tique: 0,
    j: {
      x: 0, y: 0, w: LARG, h: PEQUENO, vx: 0, vy: 0, chao: false, dir: 1, forma: 0, inv: 0, estrela: 0, agachado: false,
      coyote: 0, buffer: 0, segurando: false, passo: 0, crescer: 0, sobre: -1, morto: false, caiu: false, subiu: false,
      dentro: false, tiro: 0, yAnt: 0,
    },
  };
  const j = S.j;

  /* Mapa e colisão */
  const cod = (c, r) => (c < 0 || c >= S.nivel.L || r < 0 || r >= LINHAS ? B.VAZIO : S.nivel.mapa[r * S.nivel.L + c]);
  const sol = (c, r) => (c < 0 || c >= S.nivel.L ? true : r < 0 || r >= LINHAS ? false : SOLIDO[S.nivel.mapa[r * S.nivel.L + c]]);
  const toca = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const mult = () => Math.min(1.6, 1 + 0.25 * (S.volta - 1));
  function trocar(c, r, v) {
    const i = r * S.nivel.L + c;
    S.nivel.mapa[i] = v;
    if (v === S.nivel.base.mapa[i]) S.mudancas.delete(i); else S.mudancas.set(i, v);
  }
  function cabe(x, y, w, h) {
    for (let c = Math.floor(x / T); c <= Math.floor((x + w - 0.01) / T); c++)
      for (let r = Math.floor(y / T); r <= Math.floor((y + h - 0.01) / T); r++) if (sol(c, r)) return false;
    return true;
  }

  function moverX(o, dx) {
    o.x += dx;
    if (!dx) return false;
    const r0 = Math.floor(o.y / T);
    const r1 = Math.floor((o.y + o.h - 0.01) / T);
    const c = dx > 0 ? Math.floor((o.x + o.w - 0.01) / T) : Math.floor(o.x / T);
    for (let r = r0; r <= r1; r++) {
      if (!sol(c, r)) continue;
      o.x = dx > 0 ? c * T - o.w : (c + 1) * T;
      return true;
    }
    return false;
  }

  // Devolve o bloco em que bateu ({ c, r, baixo }) ou null. O jogador acha blocos escondidos e escorrega nos cantos.
  function moverY(o, dy, jogador = false) {
    const antes = o.y;
    o.y += dy;
    if (!dy) return null;
    const c0 = Math.floor(o.x / T);
    const c1 = Math.floor((o.x + o.w - 0.01) / T);
    if (dy > 0) {
      const r = Math.floor((o.y + o.h - 0.01) / T);
      for (let c = c0; c <= c1; c++) if (sol(c, r)) { o.y = r * T - o.h; return { c, r, baixo: true }; }
      return null;
    }
    const r = Math.floor(o.y / T);
    const batidas = [];
    for (let c = c0; c <= c1; c++) {
      if (sol(c, r) || (jogador && cod(c, r) === B.OCULTO && antes >= (r + 1) * T - 0.5)) batidas.push(c);
    }
    if (!batidas.length) return null;
    if (jogador && batidas.length === 1 && c0 !== c1) {
      const c = batidas[0];
      if (c === c0 && (c + 1) * T - o.x <= 4) { o.x = (c + 1) * T; return null; }
      if (c === c1 && o.x + o.w - c * T <= 4) { o.x = c * T - o.w; return null; }
    }
    const centro = (o.x + o.w / 2) / T;
    let melhor = batidas[0];
    for (const c of batidas) if (Math.abs(c + 0.5 - centro) < Math.abs(melhor + 0.5 - centro)) melhor = c;
    o.y = (r + 1) * T;
    return { c: melhor, r, baixo: false };
  }

  /* Pontos, efeitos e partículas (as partículas são só enfeite) */
  function popup(x, y, txt) {
    S.popups.push({ x, y, txt: String(txt), t: 0.9 });
    if (S.popups.length > 8) S.popups.shift();
  }
  function ganhar(p, x, y, txt) {
    S.pontos += p;
    if (x != null) popup(x, y, txt ?? p);
  }
  // No junto as vidas são do servidor: o 1UP vira uma vida guardada (a próxima queda não gasta vida).
  function ganharVida(x, y) { if (jt) S.reserva++; else S.vidas++; som('vida'); popup(x, y, '1UP'); }
  function particula(p) { if (S.particulas.length < 160) S.particulas.push({ t: 0, vx: 0, vy: 0, tam: 2, ...p }); }
  function faiscas(x, y, n, cor) {
    for (let k = 0; k < n; k++) {
      particula({ tp: 'brilho', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50, vida: 0.5, cor, tam: 1.5 + Math.random() * 2 });
    }
  }
  function poeira(x, y, n) {
    for (let k = 0; k < n; k++) particula({ tp: 'po', x: x + (Math.random() - 0.5) * 10, y: y - 2, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 18, vida: 0.4, tam: 2 + Math.random() * 2 });
  }
  function fumaca(x, y) { for (let k = 0; k < 5; k++) particula({ tp: 'po', x, y, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 70, vida: 0.35, tam: 2.5 }); }
  function pegarLirio(x, y) {
    S.pontos += 200;
    S.lirios++;
    S.totalLirios++;
    som('moeda');
    if (S.lirios >= 100) { S.lirios -= 100; ganharVida(j.x + 6, j.y - 10); }
    faiscas(x, y, 3, '#f7e08a');
  }

  /* Carregar uma fase (do começo ou do meio) */
  function novoInimigo(e, id) {
    const tp = INIMIGOS[e.tipo];
    return {
      id, t: e.tipo, x: e.c * T + (T - tp.w) / 2, y: e.tipo === 'm' ? e.r * T : e.r * T - tp.h, w: tp.w, h: tp.h,
      vx: 0, vy: 0, dir: -1, est: e.tipo === 'm' ? 'd' : 'a', tt: 0, ativo: false, chao: false, combo: 0, tchute: 0, base: 0, alvo: 0, fora: false,
    };
  }
  function carregar(i, noMeio = false) {
    const base = nivelBase(i);
    const def = base.def;
    S.fase = i;
    S.nivel = { base, def, L: base.largura, mapa: base.mapa.slice(), conteudo: { ...base.conteudo } };
    S.mudancas = new Map();
    S.multi = new Map();
    S.inimigos = [];
    base.inimigos.forEach((e, k) => {
      if (noMeio && e.c < def.meio.c + 8) return;
      S.inimigos.push(novoInimigo(e, k));
    });
    S.chefe = def.chefe ? {
      x: def.chefe.c * T, y: def.chefe.r * T - CHEFE.h, w: CHEFE.w, h: CHEFE.h, vx: 0, vy: 0, dir: -1, vida: CHEFE.vida,
      est: 'a', ativo: false, chao: false, tt: 2, tPulo: 1.5 + sorte(), tAnda: 0, piscar: 0, boca: 0,
    } : null;
    Object.assign(S, {
      itens: [], bolas: [], chamas: [], bumps: [], popups: [], particulas: [], tf: 0, tempo: TEMPO_FASE, relogio: 0,
      meio: noMeio, bandeira: POSTE_TOPO + 8, ponteCaiu: 0, fogos: 0, bonus: 0, tFim: -1, combo: 0, modo: 'titulo', tm: 0,
    });
    const ini = noMeio ? def.meio : def.inicio;
    S.cam = noMeio ? Math.max(0, ini.c * T - 96) : 0;
    const h = j.forma > 0 ? GRANDE : PEQUENO;
    Object.assign(j, {
      x: ini.c * T + 2, y: ini.r * T - h, w: LARG, h, vx: 0, vy: 0, chao: true, dir: 1, inv: 0, estrela: 0, agachado: false,
      coyote: 0, buffer: 0, segurando: false, crescer: 0, sobre: -1, morto: false, caiu: false, subiu: false, dentro: false, tiro: 0,
    });
    S.plats = base.plataformas.map(p => posPlataforma(p, 0));
  }

  /* Blocos */
  function bump(c, r) { S.bumps.push({ c, r, t: 0 }); }
  function soltar(item, c, r) {
    if (!item || item === 'moeda') {
      pegarLirio(c * T + 8, r * T - 6);
      particula({ tp: 'moeda', x: c * T + 8, y: r * T - 6, vy: -300, vida: 0.5 });
      popup(c * T + 8, r * T - 30, 200);
      return;
    }
    const t = item === 'poder' ? (j.forma === 0 ? 'c' : 'f') : item === 'estrela' ? 'e' : 'v';
    S.itens.push({ t, x: c * T + 1, y: r * T, w: 14, h: 14, vx: 0, vy: 0, sai: 0.6, y0: r * T, fora: false });
    som('passo');
  }
  function quebrar(c, r) {
    trocar(c, r, B.VAZIO);
    ganhar(50);
    som('quebra');
    const cor = TEMAS[S.nivel.def.tema].tijolo[0];
    for (let k = 0; k < 4; k++) {
      particula({ tp: 'caco', x: c * T + 4 + (k % 2) * 8, y: r * T + 4 + (k >> 1) * 8, vx: (k % 2 ? 1 : -1) * (55 + Math.random() * 40), vy: k >> 1 ? -200 : -290, vida: 1.2, cor });
    }
  }
  function baterBloco(c, r) {
    const v = cod(c, r);
    const i = r * S.nivel.L + c;
    // Quem está em cima do bloco leva o tranco
    for (const e of S.inimigos) {
      if (!e.ativo || e.fora || !['a', 'c', 'k'].includes(e.est)) continue;
      if (Math.abs(e.y + e.h - r * T) < 3 && e.x + e.w > c * T - 2 && e.x < c * T + T + 2) derrubar(e, 100);
    }
    for (const it of S.itens) {
      if (it.sai <= 0 && Math.abs(it.y + it.h - r * T) < 3 && it.x + it.w > c * T && it.x < c * T + T) {
        it.vy = -230;
        it.vx = (it.x + 7 < c * T + 8 ? -1 : 1) * Math.max(60, Math.abs(it.vx));
      }
    }
    if (cod(c, r - 1) === B.LIRIO) { trocar(c, r - 1, B.VAZIO); soltar('moeda', c, r - 1); }
    const item = S.nivel.conteudo[i];
    if (v === B.PERGUNTA || v === B.OCULTO) {
      trocar(c, r, B.USADO);
      delete S.nivel.conteudo[i];
      bump(c, r);
      if (item) som('bater');
      soltar(item, c, r);
    } else if (v === B.TIJOLO) {
      if (item === 'moedas') {
        const m = S.multi.get(i) || { n: 0, t0: S.tf };
        S.multi.set(i, m);
        m.n++;
        bump(c, r);
        soltar('moeda', c, r);
        if (m.n >= 10 || S.tf - m.t0 > 4) { trocar(c, r, B.USADO); delete S.nivel.conteudo[i]; }
      } else if (item) {
        trocar(c, r, B.USADO);
        delete S.nivel.conteudo[i];
        bump(c, r);
        som('bater');
        soltar(item, c, r);
      } else if (j.forma > 0) quebrar(c, r);
      else { bump(c, r); som('bater'); }
    } else som('bater');
  }

  /* O jogador */
  function crescer() {
    j.forma = 1;
    j.y -= GRANDE - j.h;
    j.h = GRANDE;
    j.agachado = false;
    j.crescer = 0.8;
    if (!cabe(j.x, j.y, j.w, j.h)) agachar(true);
  }
  function agachar(sim) {
    const novo = sim ? AGACHADO : GRANDE;
    j.y += j.h - novo;
    j.h = novo;
    j.agachado = sim;
  }
  function ferir() {
    if (S.modo !== 'jogo' || j.inv > 0 || j.estrela > 0 || j.morto || j.crescer > 0) return;
    if (j.forma > 0) {
      j.forma = 0;
      j.y += j.h - PEQUENO;
      j.h = PEQUENO;
      j.agachado = false;
      j.inv = 2;
      som('bater');
      fumaca(j.x + 6, j.y + 6);
    } else morrer(false);
  }
  function morrer(caiu) {
    if (S.modo !== 'jogo') return;
    S.modo = 'morrendo';
    S.tm = 0;
    Object.assign(j, { morto: true, caiu, subiu: false, vx: 0, vy: 0, estrela: 0, inv: 0, crescer: 0 });
    som('morte');
  }
  function atirar() {
    S.bolas.push({ x: j.dir > 0 ? j.x + j.w : j.x - 8, y: j.y + 5, w: 8, h: 8, vx: j.dir * 270, vy: 140 });
    j.tiro = 0.15;
    som('tiro');
  }
  function aterrissar(vyAntes) {
    S.combo = 0;
    if (vyAntes > 220) poeira(j.x + 6, j.y + j.h, 4);
  }

  function atualizarJogador(dt, ent) {
    const lua = !jt && ctx.segredo('super-lua');
    const ap = ent.apertou || NADA;
    const antesNoChao = j.chao;
    j.inv = Math.max(0, j.inv - dt);
    j.estrela = Math.max(0, j.estrela - dt);
    j.tiro = Math.max(0, j.tiro - dt);
    j.buffer = ap.has('pular') ? BUFFER : Math.max(0, j.buffer - dt);
    // Agachar (só grande) e levantar
    if (j.forma > 0 && j.chao && ent.baixo && !j.agachado) agachar(true);
    else if (j.agachado && (!ent.baixo || j.forma === 0) && cabe(j.x, j.y + j.h - GRANDE, j.w, GRANDE)) agachar(false);
    if (ap.has('acao') && j.forma === 2 && !j.agachado && S.bolas.length < 2) atirar();
    // Andar, correr, derrapar
    let sentido = (ent.dir ? 1 : 0) - (ent.esq ? 1 : 0);
    if (j.agachado && j.chao) sentido = 0;
    const max = ent.acao ? CORRER : ANDAR;
    if (sentido) {
      j.dir = sentido;
      if (j.vx * sentido < 0 && j.chao) j.vx += sentido * DERRAPAR * dt;
      else {
        const ac = j.chao ? (ent.acao ? ACEL_CORRER : ACEL_ANDAR) : ACEL_AR;
        if (Math.abs(j.vx) < max) j.vx = sentido * Math.min(max, Math.abs(j.vx) + ac * dt);
        else if (j.chao) j.vx = sentido * Math.max(max, Math.abs(j.vx) - ATRITO * dt);
      }
    } else if (j.chao) {
      const v = Math.max(0, Math.abs(j.vx) - ATRITO * dt);
      j.vx = Math.sign(j.vx) * v;
    }
    // Pulo com tempo de folga (coyote) e botão lembrado (buffer)
    j.coyote = j.chao ? COYOTE : Math.max(0, j.coyote - dt);
    if (j.buffer > 0 && j.coyote > 0) {
      j.vy = -(PULO + PULO_CORRIDA * Math.abs(j.vx));
      j.chao = false;
      j.coyote = 0;
      j.buffer = 0;
      j.segurando = true;
      j.sobre = -1;
      som('pulo');
    }
    if (!ent.pular) j.segurando = false;
    const grav = (j.vy < 0 && j.segurando ? GRAV_SEGURA : GRAV) * (lua ? 0.45 : 1);
    j.vy = Math.min(QUEDA_MAX * (lua ? 0.6 : 1), j.vy + grav * dt);
    // Mexer e bater
    j.yAnt = j.y;
    if (moverX(j, j.vx * dt)) j.vx = 0;
    if (j.x < S.cam) { j.x = S.cam; if (j.vx < 0) j.vx = 0; }
    const vyAntes = j.vy;
    j.chao = false;
    const bt = moverY(j, j.vy * dt, true);
    if (bt?.baixo) { j.chao = true; j.vy = 0; }
    else if (bt) { j.vy = 20; j.segurando = false; if (jt) baterJunto(bt.c, bt.r); else baterBloco(bt.c, bt.r); }
    pousarPlataforma();
    if (j.chao && !antesNoChao) aterrissar(vyAntes);
    // Lírios no caminho
    for (let c = Math.floor(j.x / T); c <= Math.floor((j.x + j.w - 0.01) / T); c++) {
      for (let r = Math.floor(j.y / T); r <= Math.floor((j.y + j.h - 0.01) / T); r++) {
        if (cod(c, r) !== B.LIRIO) continue;
        if (jt) pegarLirioJunto(c, r);
        else { trocar(c, r, B.VAZIO); pegarLirio(c * T + 8, r * T + 8); }
      }
    }
    if (j.chao && Math.abs(j.vx) > 1) j.passo += dt * (0.4 + Math.abs(j.vx) / ANDAR);
  }

  /* Plataformas que se mexem */
  let platAntes = [];
  function moverPlataformas() {
    platAntes = S.plats;
    S.plats = S.nivel.base.plataformas.map(p => posPlataforma(p, S.tf));
    const a = platAntes[j.sobre];
    const d = S.plats[j.sobre];
    if (j.sobre >= 0 && a && d) { moverX(j, d.x - a.x); j.y += d.y - a.y; }
  }
  function pousarPlataforma() {
    j.sobre = -1;
    if (j.vy < 0 || j.chao) return;
    for (let k = 0; k < S.plats.length; k++) {
      const p = S.plats[k];
      const a = platAntes[k] || p;
      if (j.x + j.w <= p.x || j.x >= p.x + p.w) continue;
      if (j.yAnt + j.h <= Math.max(a.y, p.y) + 1 && j.y + j.h >= p.y) {
        j.y = p.y - j.h;
        j.vy = 0;
        j.chao = true;
        j.sobre = k;
        return;
      }
    }
  }

  /* Poderes */
  function moverItem(it, dt) {
    if (it.sai > 0) {
      it.sai -= dt;
      it.y = it.y0 - 14 * Math.min(1, 1 - Math.max(0, it.sai) / 0.6);
      if (it.sai <= 0) {
        if (it.t === 'c' || it.t === 'v') it.vx = 70;
        if (it.t === 'e') { it.vx = 80; it.vy = -250; }
      }
    } else if (it.t !== 'f') {
      it.vy = Math.min(400, it.vy + 1100 * dt);
      if (moverX(it, it.vx * dt)) it.vx = -it.vx;
      const bt = moverY(it, it.vy * dt);
      if (bt) it.vy = bt.baixo && it.t === 'e' ? -260 : 0;
    }
  }
  function atualizarItens(dt) {
    for (const it of S.itens) {
      moverItem(it, dt);
      if (it.y > H + 16 || it.x + it.w < S.cam - 32) it.fora = true;
      else if (toca(j, it)) { coletar(it); it.fora = true; }
    }
    S.itens = S.itens.filter(it => !it.fora);
  }
  function coletar(it) {
    const x = it.x + 7;
    if (it.t === 'v') { ganharVida(x, it.y); return; }
    ganhar(1000, x, it.y);
    som('poder');
    faiscas(x, it.y + 6, 6, '#fff6c0');
    if (it.t === 'e') { j.estrela = 10; S.comboEstrela = 0; return; }
    if (j.forma === 0) crescer();
    else if (it.t === 'f' && j.forma === 1) { j.forma = 2; j.crescer = 0.5; }
  }

  /* Inimigos */
  function derrubar(e, p) {
    e.est = 'x';
    e.vy = -220;
    e.vx = (e.x + e.w / 2 < j.x + j.w / 2 ? -1 : 1) * 50;
    ganhar(p, e.x + 7, e.y);
    S.derrotados++;
    som('pisao');
  }
  function pontosCombo(e) {
    S.combo++;
    if (S.combo > COMBO.length) ganharVida(e.x + 7, e.y);
    else ganhar(COMBO[S.combo - 1], e.x + 7, e.y);
  }
  function pisar(e, ent) {
    if (e.t === 'r') { e.est = 'p'; e.tt = 0.5; S.derrotados++; }
    else if (e.t === 't') { if (e.est === 'a') { e.est = 'c'; e.y += e.h - 12; e.h = 12; } else e.est = 'c'; e.tt = 0; e.vx = 0; }
    else { e.est = 'x'; e.vy = 0; e.vx = 0; S.derrotados++; }
    pontosCombo(e);
    som('pisao');
    poeira(e.x + 7, e.y, 3);
    j.vy = -(ent.pular ? 300 : 210);
    j.segurando = ent.pular;
    j.chao = false;
  }
  function chutar(e) {
    e.est = 'k';
    e.dir = j.x + j.w / 2 < e.x + e.w / 2 ? 1 : -1;
    e.tchute = 0.25;
    e.combo = 0;
    ganhar(400, e.x + 7, e.y);
    som('pisao');
  }
  function matarComCasco(casco, alvo) {
    alvo.est = 'x';
    alvo.vy = -220;
    alvo.vx = casco.dir * 60;
    if (jt) {
      // Os pontos são de quem chutou (uma vez só, mesmo que o mundo seja refeito); os outros recebem o "matou".
      if (casco.dono === jt.eu && !S.premiados.has(alvo.id)) {
        S.premiados.add(alvo.id);
        S.derrotados++;
        som('pisao');
        if (casco.combo >= COMBO_CASCO.length) ganharVida(alvo.x + 7, alvo.y);
        else ganhar(COMBO_CASCO[casco.combo], alvo.x + 7, alvo.y);
        const ev = { tipo: 'matou', e: alvo.id, m: 'x', d: casco.dir, q: S.q + 1, s: S.fase, n: ++J.seq };
        enviar(() => jt.evento(ev));
      }
      casco.combo++;
      return;
    }
    S.derrotados++;
    som('pisao');
    if (casco.combo >= COMBO_CASCO.length) ganharVida(alvo.x + 7, alvo.y);
    else ganhar(COMBO_CASCO[casco.combo], alvo.x + 7, alvo.y);
    casco.combo++;
  }

  function atualizarInimigos(dt) {
    const m = jt ? DIF : mult();
    const cauteloso = S.nivel.def.tema === 'copas';
    const fimX = S.nivel.L * T + 64;
    for (const e of S.inimigos) {
      if (!e.ativo) {
        if (jt) continue; // no junto, só acorda com o acontecimento "acordou"
        if (e.x < S.cam + W + 24) e.ativo = true;
        else continue;
      }
      if (jt) {
        // nada depende da câmera de ninguém: só sai quem deixa o mapa
        if (e.x + e.w < -64 || e.x > fimX) { e.fora = true; continue; }
      } else if (e.x + e.w < S.cam - 64 && e.est !== 'k') { e.fora = true; continue; }
      if (e.est === 'x') {
        e.vy += 1200 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y > H + 32) e.fora = true;
        continue;
      }
      if (e.est === 'p') { e.tt -= dt; if (e.tt <= 0) e.fora = true; continue; }
      if (e.est === 'd') {
        if (jt) continue;
        if (Math.abs(j.x + j.w / 2 - (e.x + 7)) < 150) {
          e.est = 'v';
          e.vx = (j.x < e.x ? -1 : 1) * INIMIGOS.m.vel * m;
          e.dir = Math.sign(e.vx);
          e.base = e.y;
          e.alvo = Math.max(110, Math.min(220, j.y));
          e.tt = 0;
        }
        continue;
      }
      if (e.est === 'v') {
        e.tt += dt;
        e.x += e.vx * dt;
        e.y = e.base + (e.alvo - e.base) * Math.min(1, e.tt / 0.9) + Math.sin(e.tt * 3.4) * 20 * Math.min(1, e.tt);
        if (jt ? e.tt > 20 : e.x > S.cam + W + 200) e.fora = true;
        continue;
      }
      // Andando, casco parado ou casco rolando: gravidade e paredes
      if (e.est === 'a') {
        e.vx = e.dir * INIMIGOS[e.t].vel * m;
        if (cauteloso && e.chao) {
          const frente = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
          if (!sol(Math.floor(frente / T), Math.floor((e.y + e.h + 2) / T))) { e.dir = -e.dir; e.vx = -e.vx; }
        }
      } else if (e.est === 'c') {
        e.vx = 0;
        e.tt += dt;
        if (e.tt > 7) {
          e.est = 'a'; e.y -= INIMIGOS.t.h - e.h; e.h = INIMIGOS.t.h;
          e.dir = jt ? (azar(e.id, S.q) < 0.5 ? -1 : 1) : j.x < e.x ? -1 : 1;
        }
      } else if (e.est === 'k') {
        e.vx = e.dir * 230;
        e.tchute = Math.max(0, e.tchute - dt);
        if (jt) { e.tk = (e.tk || 0) + dt; if (e.tk > 12) { e.fora = true; continue; } }
        else if (e.x < S.cam - 64 || e.x > S.cam + W + 64) { e.fora = true; continue; }
      }
      e.vy = Math.min(400, e.vy + 1200 * dt);
      if (moverX(e, e.vx * dt)) {
        e.dir = -e.dir;
        if (e.est === 'k' && e.x > S.cam - 8 && e.x < S.cam + W && !S.replay) som('bater');
      }
      e.chao = false;
      const bt = moverY(e, e.vy * dt);
      if (bt) { e.vy = 0; e.chao = bt.baixo; }
      if (e.y > H + 32) e.fora = true;
    }
    // Entre eles: casco rolando derruba; quem anda dá meia-volta
    const ativos = S.inimigos.filter(e => e.ativo && !e.fora && ['a', 'c', 'k', 'v'].includes(e.est));
    for (let a = 0; a < ativos.length; a++) {
      for (let b = a + 1; b < ativos.length; b++) {
        const p = ativos[a];
        const q = ativos[b];
        if (p.est === 'x' || q.est === 'x' || !toca(p, q)) continue;
        if (p.est === 'k' && q.est === 'k') { matarComCasco(p, q); matarComCasco(q, p); }
        else if (p.est === 'k') matarComCasco(p, q);
        else if (q.est === 'k') matarComCasco(q, p);
        else if (p.est === 'a' && q.est === 'a') {
          if (p.x < q.x) { p.dir = -1; q.dir = 1; } else { p.dir = 1; q.dir = -1; }
        }
      }
    }
    S.inimigos = S.inimigos.filter(e => !e.fora);
  }

  function contatoInimigos(ent) {
    for (const e of S.inimigos) {
      if (S.modo !== 'jogo') return;
      if (!e.ativo || e.fora || ['x', 'p', 'd'].includes(e.est) || !toca(j, e)) continue;
      if (j.estrela > 0) {
        const p = COMBO[Math.min(S.comboEstrela, COMBO.length - 1)];
        if (jt) derrubarJunto(e, p); else derrubar(e, p);
        S.comboEstrela++;
        continue;
      }
      const deCima = j.vy > 0 && (j.yAnt + j.h <= e.y + 6 || j.y + j.h <= e.y + 6);
      if (e.est === 'c') {
        if (jt) chutarJunto(e); else chutar(e);
        if (deCima) { j.vy = -(ent.pular ? 300 : 210); j.segurando = ent.pular; }
        continue;
      }
      if (deCima && INIMIGOS[e.t].pisa) { if (jt) pisarJunto(e, ent); else pisar(e, ent); continue; }
      if (e.est === 'k' && e.tchute > 0) continue;
      ferir();
    }
  }

  /* Bolas de fogo do coelho */
  function atualizarBolas(dt) {
    for (const b of S.bolas) {
      b.vy = Math.min(400, b.vy + 1400 * dt);
      if (moverX(b, b.vx * dt)) { b.fora = true; fumaca(b.x + 4, b.y + 4); continue; }
      const bt = moverY(b, b.vy * dt);
      if (bt?.baixo) b.vy = -190;
      else if (bt) b.vy = 60;
      if (b.y > H || b.x < S.cam - 16 || b.x > S.cam + W + 16) { b.fora = true; continue; }
      for (const e of S.inimigos) {
        if (!e.ativo || e.fora || ['x', 'p'].includes(e.est) || !toca(b, e)) continue;
        if (jt) derrubarJunto(e, 200); else derrubar(e, 200);
        b.fora = true;
        fumaca(b.x + 4, b.y + 4);
        break;
      }
      const k = S.chefe;
      if (!b.fora && k && k.ativo && k.est === 'a' && toca(b, k)) {
        b.fora = true;
        fumaca(b.x + 4, b.y + 4);
        if (jt) { eventoMundo({ tipo: 'chefe' }); continue; }
        k.vida--;
        k.piscar = 0.3;
        som('bater');
        if (k.vida <= 0) {
          k.est = 'x';
          k.vy = -200;
          ganhar(5000, k.x + 17, k.y - 6, 'Raposo vencido! 5000');
          S.derrotados++;
          som('pisao');
        }
      }
    }
    S.bolas = S.bolas.filter(b => !b.fora);
  }

  /* O Raposo, na ponte sobre a lava */
  function atualizarChefe(dt) {
    const k = S.chefe;
    if (!k || k.est === 'morto') return;
    if (!k.ativo) { if (k.x < S.cam + W - 16) k.ativo = true; else return; }
    k.piscar = Math.max(0, k.piscar - dt);
    k.boca = Math.max(0, k.boca - dt);
    if (k.est === 'x') {
      k.vy += 900 * dt;
      k.y += k.vy * dt;
      if (k.y > H + 40) k.est = 'morto';
      return;
    }
    k.vy = Math.min(400, k.vy + 1100 * dt);
    k.chao = false;
    const bt = moverY(k, k.vy * dt);
    if (bt) { k.vy = 0; k.chao = bt.baixo; }
    if (k.y > H + 40) { k.est = 'morto'; return; }
    if (S.modo !== 'jogo') return;
    const m = mult();
    const p = S.nivel.def.ponte;
    k.dir = j.x + j.w / 2 < k.x + k.w / 2 ? -1 : 1;
    k.tAnda -= dt;
    if (k.tAnda <= 0) { k.vx = (sorte() < 0.5 ? -1 : 1) * 28 * m; k.tAnda = 0.8 + sorte() * 1.2; }
    const xmin = (p.c0 + 3) * T;
    const xmax = (p.c1 - 1) * T - k.w;
    k.x += k.vx * dt;
    if (k.x < xmin) { k.x = xmin; k.vx = Math.abs(k.vx); } else if (k.x > xmax) { k.x = xmax; k.vx = -Math.abs(k.vx); }
    k.tPulo -= dt;
    if (k.tPulo <= 0 && k.chao) { k.vy = -300; k.tPulo = 1.6 + sorte() * 2.2; }
    k.tt -= dt;
    if (k.tt <= 0) {
      const alto = sorte() < 0.5;
      S.chamas.push({ x: k.dir < 0 ? k.x - 12 : k.x + k.w, y: k.y + 8, w: 14, h: 6, vx: k.dir * 110 * m, alvo: p.r * T - (alto ? 26 : 10) });
      k.tt = (1.4 + sorte() * 1.8) / m;
      k.boca = 0.3;
      som('tiro');
    }
    if (toca(j, k)) ferir();
  }
  function atualizarChamas(dt) {
    for (const c of S.chamas) {
      c.x += c.vx * dt;
      c.y += (c.alvo - c.y) * Math.min(1, dt * 2.5);
      if (c.x < S.cam - 32 || c.x > S.cam + W + 32) c.fora = true;
      else if (toca(j, { x: c.x + 2, y: c.y + 1, w: c.w - 4, h: c.h - 2 })) ferir();
    }
    S.chamas = S.chamas.filter(c => !c.fora);
  }

  /* Barras de fogo, bolhas de lava, lava e buracos */
  function perigos() {
    const base = S.nivel.base;
    for (const br of base.barras) {
      if (Math.abs(br.cx - (j.x + 6)) > br.qtd * 8 + 16) continue;
      for (const p of bolasDaBarra(br, S.tf)) {
        const dx = Math.max(j.x, Math.min(p.x, j.x + j.w)) - p.x;
        const dy = Math.max(j.y, Math.min(p.y, j.y + j.h)) - p.y;
        if (dx * dx + dy * dy < 9) { ferir(); break; }
      }
    }
    for (const bo of base.bolhas) {
      const p = posBolha(bo, S.tf);
      if (p && toca(j, { x: p.x + 1, y: p.y + 1, w: 10, h: 12 })) ferir();
    }
    for (let c = Math.floor((j.x + 2) / T); c <= Math.floor((j.x + j.w - 2) / T); c++) {
      if (cod(c, Math.floor((j.y + j.h - 3) / T)) === B.LAVA) { morrer(false); return; }
    }
    if (j.y > H + 4) morrer(true);
  }

  function atualizarCamera(dt) {
    const max = S.nivel.L * T - W;
    const alvo = j.x + j.w / 2 - W * 0.42;
    if (alvo > S.cam) S.cam += (alvo - S.cam) * Math.min(1, dt * 9);
    S.cam = Math.max(S.cam, j.x + j.w / 2 - W * 0.6);
    S.cam = Math.max(0, Math.min(max, S.cam));
  }

  /* Fim das fases */
  function pegarMastro() {
    const def = S.nivel.def;
    const px = def.mastro * T + 8;
    if (j.agachado) agachar(false);
    j.y = Math.max(POSTE_TOPO, Math.min(BASE_MASTRO - j.h, j.y));
    const frac = (BASE_MASTRO - (j.y + j.h)) / (BASE_MASTRO - POSTE_TOPO);
    const p = frac >= 0.88 ? 5000 : frac >= 0.68 ? 2000 : frac >= 0.45 ? 800 : frac >= 0.2 ? 400 : 100;
    ganhar(p, px + 14, j.y);
    Object.assign(j, { x: px - 1.5 - j.w, vx: 0, vy: 0, dir: 1, estrela: 0, sobre: -1 });
    S.fogos = [1, 3, 6].includes(S.tempo % 10) ? S.tempo % 10 : 0;
    S.modo = 'mastro';
    S.tm = 0;
    S.tFim = -1;
    S.chamas = [];
    som('fase');
  }
  function passoMastro(dt) {
    S.tm += dt;
    let pronto = true;
    if (j.y + j.h < BASE_MASTRO) { j.y = Math.min(BASE_MASTRO - j.h, j.y + 150 * dt); pronto = false; }
    if (S.bandeira < BASE_MASTRO - 16) { S.bandeira = Math.min(BASE_MASTRO - 16, S.bandeira + 150 * dt); pronto = false; }
    if (pronto && S.tFim < 0) S.tFim = S.tm;
    if (S.tFim >= 0 && S.tm > S.tFim + 0.35 && j.dir === 1) { j.dir = -1; j.x = S.nivel.def.mastro * T + 9.5; }
    if (S.tFim >= 0 && S.tm > S.tFim + 0.75) { S.modo = 'andando'; S.tm = 0; j.dir = 1; }
  }
  function passoAndando(dt) {
    atualizarJogador(dt, AUTO);
    atualizarCamera(dt);
    if (j.x >= (S.nivel.def.castelo + 2) * T + 2) { j.dentro = true; S.modo = 'contagem'; S.tm = 0; S.tFim = -1; }
  }
  // Tempo que sobrou vira pontos (50 por segundo); depois, fogos se o último número do tempo for 1, 3 ou 6.
  function passoContagem(dt) {
    S.tm += dt;
    if (S.tempo > 0) {
      const n = Math.min(S.tempo, 2);
      S.tempo -= n;
      S.pontos += 50 * n;
      if (++S.tique % 4 === 0) som('passo');
      return;
    }
    if (S.tFim < 0) S.tFim = S.tm;
    if (S.fogos > 0 && S.tm > S.tFim + 0.5) {
      S.fogos--;
      S.tFim = S.tm;
      const def = S.nivel.def;
      const x = def.castelo * T + 40 + (S.fogos % 3 - 1) * 46;
      const y = 60 + (S.fogos % 2) * 28;
      ganhar(500, x, y);
      som('bater');
      const cor = ARCO_IRIS[S.fogos % ARCO_IRIS.length];
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        particula({ tp: 'fogos', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, vida: 0.9, cor, tam: 1.6 });
      }
      return;
    }
    if (S.fogos === 0 && S.tm > S.tFim + 1.3) {
      if (jt) { S.modo = 'aguardando'; S.tm = 0; } // a fase seguinte vem do servidor (aoFase)
      else carregar(S.fase + 1);
    }
  }
  function iniciarPonte() {
    S.modo = 'ponte';
    S.tm = 0;
    S.ponteCaiu = 0;
    S.chefeVivo = !!S.chefe && S.chefe.est === 'a';
    S.chamas = [];
    Object.assign(j, { vx: 0, vy: 0, estrela: 0 });
    som('bater');
  }
  function passoPonte(dt) {
    const p = S.nivel.def.ponte;
    const n = p.c1 - p.c0 + 1;
    S.tm += dt;
    const alvo = Math.min(n, Math.floor(S.tm / 0.07));
    while (S.ponteCaiu < alvo) {
      const c = p.c1 - S.ponteCaiu;
      trocar(c, p.r, B.VAZIO);
      particula({ tp: 'caco', x: c * T + 8, y: p.r * T + 4, vx: (Math.random() - 0.5) * 40, vy: -60, vida: 1.2, cor: '#7a4a24' });
      if (S.ponteCaiu % 3 === 0) som('quebra');
      S.ponteCaiu++;
    }
    atualizarChefe(dt);
    if (S.tm > n * 0.07 + 1.2) {
      if (S.chefeVivo) { ganhar(5000, (p.c0 + p.c1) / 2 * T, 120, 'Raposo vencido! 5000'); S.derrotados++; S.chefeVivo = false; }
      som('fase');
      S.modo = 'resgate';
      S.tm = 0;
    }
  }
  function passoResgate(dt) {
    S.tm += dt;
    const alvo = S.nivel.def.princesa.c * T - 8;
    if (j.x + j.w < alvo) atualizarJogador(dt, AUTO);
    else { j.vx = 0; S.modo = 'princesa'; S.tm = 0; S.bonus = S.tempo * 50; som('vida'); }
    atualizarCamera(dt);
  }
  function passoPrincesa(dt) {
    S.tm += dt;
    if (S.tempo > 0 && S.tm > 1) {
      const n = Math.min(S.tempo, 2);
      S.tempo -= n;
      S.pontos += 50 * n;
      if (++S.tique % 4 === 0) som('passo');
    }
    if (S.tm > 8.5 && !jt) { S.volta++; S.resgates++; carregar(0); }
  }
  function passoMorte(dt) {
    S.tm += dt;
    if (!j.caiu && S.tm > 0.5) {
      if (!j.subiu) { j.subiu = true; j.vy = -330; }
      j.vy = Math.min(500, j.vy + 900 * dt);
      j.y += j.vy * dt;
    }
    if (S.tm > 3) {
      if (jt) { fimDaMorte(); return; }
      S.vidas--;
      if (S.vidas <= 0) { S.modo = 'fim'; S.tm = 0; S.acabou = true; }
      else { j.forma = 0; carregar(S.fase, S.meio); }
    }
  }

  function passoJogo(dt, ent) {
    if (j.crescer > 0) { j.crescer = Math.max(0, j.crescer - dt); return; } // tudo para enquanto o coelho cresce
    S.tf += dt;
    S.relogio += dt;
    while (S.relogio >= TIQUE) {
      S.relogio -= TIQUE;
      S.tempo--;
      if (S.tempo === 100) som('alerta');
      if (S.tempo <= 0) { S.tempo = 0; morrer(false); return; }
    }
    moverPlataformas();
    atualizarJogador(dt, ent);
    atualizarItens(dt);
    atualizarInimigos(dt);
    contatoInimigos(ent);
    atualizarBolas(dt);
    atualizarChefe(dt);
    atualizarChamas(dt);
    if (S.modo !== 'jogo') return;
    perigos();
    if (S.modo !== 'jogo') return;
    atualizarCamera(dt);
    const def = S.nivel.def;
    if (!S.meio && def.meio && j.x >= def.meio.c * T) { S.meio = true; faiscas(def.meio.c * T + 8, def.meio.r * T - 24, 8, '#e8c24a'); }
    if (def.mastro && j.x + j.w >= def.mastro * T - 0.5) pegarMastro();
    else if (def.alavanca && toca(j, { x: def.alavanca.c * T + 2, y: def.alavanca.r * T - 24, w: 12, h: 24 })) iniciarPonte();
  }

  function atualizarEfeitos(dt) {
    for (const b of S.bumps) b.t += dt;
    S.bumps = S.bumps.filter(b => b.t < 0.2);
    for (const p of S.popups) { p.t -= dt; p.y -= 28 * dt; }
    S.popups = S.popups.filter(p => p.t > 0);
    for (const p of S.particulas) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += ({ caco: 900, moeda: 900, brilho: 80, fogos: 60 }[p.tp] || 0) * dt;
    }
    S.particulas = S.particulas.filter(p => p.t < p.vida);
    if (j.estrela > 0 && !j.morto && Math.random() < 0.5) faiscas(j.x + 6, j.y + j.h / 2, 1, ARCO_IRIS[Math.floor(Math.random() * 5)]);
  }

  /* O retrato do momento: o desenho ao vivo e quem assiste usam o mesmo */
  function cena(arred) {
    const R = arred ? Math.round : v => v;
    const R1 = arred ? v => Math.round(v * 10) / 10 : v => v;
    const R2 = arred ? v => Math.round(v * 100) / 100 : v => v;
    const L = S.nivel.L;
    const c0 = Math.floor(S.cam / T) - 2;
    const naTela = o => o.x + o.w > S.cam - 24 && o.x < S.cam + W + 24;
    const mu = [];
    for (const [i, v] of S.mudancas) { const c = i % L; if (c >= c0 && c <= c0 + 37) mu.push([i, v]); }
    const bits = (j.agachado ? 1 : 0) | (j.chao ? 2 : 0) | (j.subiu ? 4 : 0) | (j.dentro ? 8 : 0) | (j.tiro > 0 ? 16 : 0) | (j.morto ? 32 : 0) | (j.vy < 0 ? 64 : 0);
    const k = S.chefe;
    // No junto, quem ainda dorme também aparece (acorda quando algum coelho chega perto).
    const F = {
      f: S.fase, v: S.volta, m: S.modo, tm: R1(S.tm), cx: R1(S.cam), tf: R2(S.tf),
      pt: S.pontos, li: S.lirios, vi: S.vidas, te: S.tempo, mk: S.meio ? 1 : 0, bd: R(S.bandeira), bn: S.bonus,
      j: [R1(j.x), R1(j.y), j.forma, j.dir, bits, R2(j.passo), R1(j.estrela), R1(j.inv), R1(j.crescer), R(j.vx)],
      e: S.inimigos.filter(e => (e.ativo || jt) && naTela(e)).map(e => [e.t, R(e.x), R(e.y), e.est, e.dir, R1(e.tt), e.id]),
      it: S.itens.filter(naTela).map(it => [it.t, R(it.x), R(it.y), it.sai > 0 ? 1 : 0]),
      b: S.bolas.map(b => [R(b.x), R(b.y)]),
      ch: S.chamas.filter(naTela).map(c => [R(c.x), R(c.y), Math.sign(c.vx)]),
      k: k && k.est !== 'morto' && (k.ativo || jt) ? [R(k.x), R(k.y), k.dir, k.vida, k.est, k.piscar > 0 ? 1 : 0, k.boca > 0 ? 1 : 0] : null,
      mu,
      bp: S.bumps.map(b => [b.c, b.r, R2(b.t)]),
      pp: S.popups.map(p => [R(p.x), R(p.y), p.txt, R1(p.t)]),
    };
    if (jt) {
      F.jv = jt.modo === 'coop' ? 'EQUIPE' : 'VIDAS';
      F.rs = S.reserva;
      const alavanca = !!S.nivel.def.alavanca;
      F.dj = jt.modo === 'coop' ? `Co-op: a equipe toda junta até ${alavanca ? 'a alavanca' : 'o mastro'}!`
        : `Versus: quem ${alavanca ? 'puxar primeiro a alavanca' : 'tocar primeiro no mastro'} vence!`;
    }
    return F;
  }

  /* ─── Junto: todos na mesma fase, ao mesmo tempo, vendo os outros coelhos ─── */
  // O mundo (inimigos, poderes, blocos e o Raposo) é o mesmo para todos: anda pelo relógio da fase (faseTempo) e
  // só muda por acontecimentos marcados com o número do quadro (q). Quem recebe um acontecimento atrasado volta
  // para a foto do mundo de antes dele e refaz os quadros: assim todos chegam ao mesmo mundo, na mesma ordem.
  // O coelho de cada um é local (sem atraso nos controles); os outros aparecem pelo que mandam (aoPos).

  // Número "aleatório" fixo por (a, b) e pela semente da sala.
  function azar(a, b) {
    let t = (SEM ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // O Raposo tem a sua própria sequência (guardada nele, então volta junto com as fotos do mundo).
  function rndChefe(k) {
    k.rs = (k.rs + 0x6d2b79f5) >>> 0;
    let t = k.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const porId = id => S.inimigos.find(e => e.id === id);
  const naVista = x => x > S.cam - 32 && x < S.cam + W + 32;
  const r1 = v => Math.round(v * 10) / 10;
  const nomeDe = i => String(jt.jogadores[i]?.nome || `Coelho ${i + 1}`).slice(0, 14);
  const corDe = i => jt.jogadores[i]?.cor || '#ece0bf';
  function visualDe(i) {
    const v = jt.jogadores[i]?.visual;
    const pelo = v && COR_HEX.test(String(v.pelo || '')) ? v.pelo : null;
    const roupa = v && v.roupa && typeof v.roupa === 'object' ? v.roupa : null;
    if (pelo || roupa) return { pelo, roupa };
    return i === jt.eu ? null : { pelo: PELOS_JUNTO[i % PELOS_JUNTO.length], roupa: null };
  }
  function avisar(txt, cor = '#fff6d8') {
    S.avisos.push({ txt, cor, t: 3.5 });
    if (S.avisos.length > 3) S.avisos.shift();
  }

  // Com mais gente, alguns raposinhos a mais (sempre os mesmos para a mesma sala e fase).
  function extrasDaFase(f) {
    const base = nivelBase(f);
    const qtd = Math.round((DIF - 1) / 0.15) * 2;
    const lista = [];
    if (qtd <= 0) return lista;
    const rnd = sorteSemente((SEM ^ Math.imul(f + 3, 0x2c1b3c6d)) >>> 0);
    const cand = base.inimigos.filter(e => e.tipo === 'r' || e.tipo === 't');
    const solido = (c, r) => c >= 0 && c < base.largura && r >= 0 && r < LINHAS && SOLIDO[base.mapa[r * base.largura + c]];
    for (let k = 0; k < 60 && lista.length < qtd && cand.length; k++) {
      const e = cand[Math.floor(rnd() * cand.length)];
      const c = e.c + (rnd() < 0.5 ? -3 : 3);
      if (c < 14 || c > base.largura - 24) continue;
      if (!solido(c, e.r) || solido(c, e.r - 1) || solido(c, e.r - 2)) continue;
      if (lista.some(x => Math.abs(x.c - c) < 2) || base.inimigos.some(x => x.r === e.r && x.c === c)) continue;
      lista.push({ tipo: 'r', c, r: e.r });
    }
    return lista;
  }

  /* As fotos do mundo (para voltar no tempo) */
  const copiar = o => ({ ...o });
  function guardar() {
    J.fotos.push({
      q: S.q, ini: S.inimigos.map(copiar), it: S.itens.map(copiar), k: S.chefe && copiar(S.chefe), ch: S.chamas.map(copiar),
      mapa: S.nivel.mapa.slice(), mud: new Map(S.mudancas), cont: { ...S.nivel.conteudo }, multi: [...S.multi].map(([i, m]) => [i, copiar(m)]),
    });
    while (J.fotos.length > 2 && J.fotos[1].q <= S.q - HORIZONTE) J.fotos.shift();
    const q0 = J.fotos[0].q;
    if (J.log.length && J.log[0].q < q0) J.log = J.log.filter(ev => ev.q >= q0); // esses já estão na foto mais velha
  }
  function restaurar(f) {
    S.q = f.q;
    S.tf = f.q / 60;
    S.inimigos = f.ini.map(copiar);
    S.itens = f.it.map(copiar).filter(it => !S.pegos.has(it.chave));
    S.chefe = f.k && copiar(f.k);
    S.chamas = f.ch.map(copiar);
    S.nivel.mapa.set(f.mapa);
    S.mudancas = new Map(f.mud);
    S.nivel.conteudo = { ...f.cont };
    S.multi = new Map(f.multi.map(([i, m]) => [i, copiar(m)]));
    for (const i of S.lirioPegos) if (S.nivel.mapa[i] === B.LIRIO) trocar(i % S.nivel.L, Math.floor(i / S.nivel.L), B.VAZIO);
  }

  /* Os acontecimentos do mundo, sempre na mesma ordem: quadro, quem mandou, número */
  const ordem = (a, b) => a.q - b.q || a.i - b.i || a.n - b.n;
  function inserir(ev) {
    if (J.fotos.length && ev.q < J.fotos[0].q) ev.q = J.fotos[0].q; // atrasado demais: vale na foto mais velha
    let k = J.log.length;
    while (k > 0 && ordem(J.log[k - 1], ev) > 0) k--;
    J.log.splice(k, 0, ev);
  }
  const marcarVolta = q => { J.voltar = J.voltar == null ? q : Math.min(J.voltar, q); };

  // Um acontecimento meu: vale na hora aqui e vai para os outros com o número do quadro.
  function eventoMundo(dados) {
    const ev = { ...dados, q: S.q, s: S.fase, n: ++J.seq };
    enviar(() => jt.evento(ev));
    const meu = { ...ev, i: jt.eu };
    inserir(meu);
    if (J.log.some(o => o.feito && ordem(o, meu) > 0)) marcarVolta(meu.q); // fora de ordem: refaz no próximo passo
    aplicar(meu);
    meu.feito = true;
    return meu;
  }
  // Um acontecimento de outro coelho: entra na fila em ordem; se é do passado, o mundo volta e refaz.
  function recebido(i, ev) {
    const q = Math.floor(Number(ev.q));
    if (!Number.isFinite(q) || q < 0) return;
    const dele = { ...ev, i, q, n: Number(ev.n) || 0 };
    if (dele.s > S.fase) { J.adiantados.push(dele); return; }
    if (dele.s !== S.fase) return;
    inserir(dele);
    if (dele.q <= S.q) marcarVolta(dele.q);
  }
  function aplicarDe(q) {
    for (const ev of J.log) {
      if (ev.q > q) break;
      if (ev.q === q && !ev.feito) { aplicar(ev); ev.feito = true; }
    }
  }
  function voltarNoTempo() {
    const q = J.voltar;
    J.voltar = null;
    if (!J.fotos.length) return;
    const alvo = S.q;
    let f = J.fotos[0];
    for (const x of J.fotos) if (x.q <= q) f = x;
    while (J.fotos[J.fotos.length - 1].q > f.q) J.fotos.pop();
    restaurar(f);
    for (const ev of J.log) if (ev.q >= f.q) ev.feito = false;
    S.replay = true;
    aplicarDe(f.q);
    while (S.q < alvo) passoMundo();
    S.replay = false;
  }
  // Um quadro do mundo: só depende do próprio mundo (nada da câmera ou do coelho de ninguém).
  function passoMundo() {
    moverItensMundo(QUADRO);
    atualizarInimigos(QUADRO);
    chefeMundo(QUADRO);
    chamasMundo(QUADRO);
    S.q++;
    S.tf = S.q / 60;
    if (S.q % 10 === 0) guardar();
    aplicarDe(S.q);
  }
  // Leva o mundo até o relógio da fase (até max quadros por passo; muito atrasado, alcança de uma vez).
  function avancarMundo(max) {
    if (J.voltar != null) voltarNoTempo();
    const falta = Math.floor(jt.faseTempo() * 60) - S.q;
    let n = falta > 30 ? Math.min(falta, 1200) : Math.min(falta, max);
    while (n-- > 0) passoMundo();
  }

  /* Aplicar um acontecimento (igual em todos os navegadores; efeitos só na primeira vez) */
  function aplicar(ev) {
    const efeitos = !ev.visto;
    ev.visto = true;
    if (ev.tipo === 'bloco') { aplicarBloco(ev, efeitos); return; }
    if (ev.tipo === 'chefe') { aplicarChefe(ev, efeitos); return; }
    if (ev.tipo === 'acordou' && ev.e === -1) {
      if (S.chefe && S.chefe.est === 'a') S.chefe.ativo = true;
      return;
    }
    const e = porId(ev.e);
    if (!e || e.fora) return;
    if (ev.tipo === 'acordou') {
      if (e.ativo) return;
      e.ativo = true;
      if (e.t === 'm' && e.est === 'd') {
        const d = ev.d < 0 ? -1 : 1;
        Object.assign(e, { est: 'v', vx: d * INIMIGOS.m.vel * DIF, dir: d, base: e.y, alvo: Math.max(110, Math.min(220, Number(ev.a) || 150)), tt: 0 });
      }
    } else if (ev.tipo === 'matou') {
      if (e.est === 'x' || e.est === 'p') return;
      e.ativo = true;
      if (ev.m === 'p') { e.est = 'p'; e.tt = 0.5; }
      else if (ev.m === 'c' && e.t === 't') {
        if (e.est === 'a') { e.y += e.h - 12; e.h = 12; }
        Object.assign(e, { est: 'c', tt: 0, vx: 0 });
      } else if (ev.m === 'q') Object.assign(e, { est: 'x', vy: 0, vx: 0 });
      else Object.assign(e, { est: 'x', vy: -220, vx: (ev.d < 0 ? -1 : 1) * 50 });
      if (efeitos && ev.i !== jt.eu && naVista(e.x)) som('pisao');
    } else if (ev.tipo === 'chutou') {
      if (e.est === 'x' || e.est === 'p' || e.t !== 't') return;
      if (e.est === 'a') { e.y += e.h - 12; e.h = 12; }
      const x = Number(ev.x);
      Object.assign(e, { ativo: true, est: 'k', x: Number.isFinite(x) ? x : e.x, dir: ev.dir < 0 ? -1 : 1, tchute: 0.25, combo: 0, dono: ev.i, tk: 0 });
    }
  }
  function aplicarChefe(ev, efeitos) {
    const k = S.chefe;
    if (!k || k.est !== 'a') return;
    k.ativo = true;
    k.vida--;
    k.piscar = 0.3;
    if (efeitos && naVista(k.x)) som('bater');
    if (k.vida > 0) return;
    k.est = 'x';
    k.vy = -200;
    if (ev.i === jt.eu && !S.premioChefe) {
      S.premioChefe = true;
      ganhar(5000, k.x + 17, k.y - 6, 'Raposo vencido! 5000');
      S.derrotados++;
      som('pisao');
    } else if (efeitos) popup(k.x + 17, k.y - 6, 'Raposo vencido!');
  }
  function popMoeda(c, r) {
    particula({ tp: 'moeda', x: c * T + 8, y: r * T - 6, vy: -300, vida: 0.5 });
  }
  function aplicarBloco(ev, efeitos) {
    const c = Math.floor(Number(ev.c));
    const r = Math.floor(Number(ev.r));
    if (!(c >= 0 && c < S.nivel.L && r >= 0 && r < LINHAS)) return;
    const f = Number(ev.f) || 0;
    const v = cod(c, r);
    const i = r * S.nivel.L + c;
    const perto = efeitos && naVista(c * T);
    // Quem está em cima do bloco leva o tranco
    for (const e of S.inimigos) {
      if (!e.ativo || e.fora || !['a', 'c', 'k'].includes(e.est)) continue;
      if (Math.abs(e.y + e.h - r * T) < 3 && e.x + e.w > c * T - 2 && e.x < c * T + T + 2) {
        Object.assign(e, { est: 'x', vy: -220, vx: (e.x + e.w / 2 < c * T + 8 ? -1 : 1) * 50 });
        if (perto) som('pisao');
      }
    }
    for (const it of S.itens) {
      if (it.sai <= 0 && Math.abs(it.y + it.h - r * T) < 3 && it.x + it.w > c * T && it.x < c * T + T) {
        it.vy = -230;
        it.vx = (it.x + 7 < c * T + 8 ? -1 : 1) * Math.max(60, Math.abs(it.vx));
      }
    }
    if (cod(c, r - 1) === B.LIRIO) { trocar(c, r - 1, B.VAZIO); if (efeitos) popMoeda(c, r - 1); }
    const item = S.nivel.conteudo[i];
    if (v === B.PERGUNTA || v === B.OCULTO) {
      trocar(c, r, B.USADO);
      delete S.nivel.conteudo[i];
      if (efeitos) bump(c, r);
      if (perto && item) som('bater');
      soltarMundo(item, c, r, f, efeitos);
    } else if (v === B.TIJOLO) {
      if (item === 'moedas') {
        const m = S.multi.get(i) || { n: 0, t0: S.tf };
        S.multi.set(i, m);
        m.n++;
        if (efeitos) { bump(c, r); popMoeda(c, r); }
        if (m.n >= 10 || S.tf - m.t0 > 4) { trocar(c, r, B.USADO); delete S.nivel.conteudo[i]; }
      } else if (item) {
        trocar(c, r, B.USADO);
        delete S.nivel.conteudo[i];
        if (efeitos) bump(c, r);
        if (perto) som('bater');
        soltarMundo(item, c, r, f, efeitos);
      } else if (f > 0) {
        trocar(c, r, B.VAZIO);
        if (perto) {
          som('quebra');
          const cor = TEMAS[S.nivel.def.tema].tijolo[0];
          for (let k = 0; k < 4; k++) {
            particula({ tp: 'caco', x: c * T + 4 + (k % 2) * 8, y: r * T + 4 + (k >> 1) * 8, vx: (k % 2 ? 1 : -1) * (55 + Math.random() * 40), vy: k >> 1 ? -200 : -290, vida: 1.2, cor });
          }
        }
      } else if (efeitos) { bump(c, r); if (perto) som('bater'); }
    }
  }
  // O que sai do bloco: a moeda é só enfeite (quem bateu pede), o resto anda igual para todos.
  function soltarMundo(item, c, r, forma, efeitos) {
    if (!item || item === 'moeda') { if (efeitos) popMoeda(c, r); return; }
    const chave = `${item}:${c}:${r}`;
    if (S.pegos.has(chave)) return;
    const t = item === 'poder' ? (forma === 0 ? 'c' : 'f') : item === 'estrela' ? 'e' : 'v';
    S.itens.push({ t, x: c * T + 1, y: r * T, w: 14, h: 14, vx: 0, vy: 0, sai: 0.6, y0: r * T, fora: false, chave });
    if (efeitos && naVista(c * T)) som('passo');
  }

  /* O que anda sozinho no mundo */
  function moverItensMundo(dt) {
    const fim = S.nivel.L * T + 32;
    for (const it of S.itens) {
      moverItem(it, dt);
      if (it.y > H + 16 || it.x < -32 || it.x > fim) it.fora = true;
    }
    S.itens = S.itens.filter(it => !it.fora && !S.pegos.has(it.chave));
  }
  // O Raposo do junto: olha para quem vem (a esquerda), às vezes vira; mais bravo com mais gente.
  function chefeMundo(dt) {
    const k = S.chefe;
    if (!k || k.est === 'morto' || !k.ativo) return;
    k.piscar = Math.max(0, k.piscar - dt);
    k.boca = Math.max(0, k.boca - dt);
    if (k.est === 'x') {
      k.vy += 900 * dt;
      k.y += k.vy * dt;
      if (k.y > H + 40) k.est = 'morto';
      return;
    }
    k.vy = Math.min(400, k.vy + 1100 * dt);
    k.chao = false;
    const bt = moverY(k, k.vy * dt);
    if (bt) { k.vy = 0; k.chao = bt.baixo; }
    if (k.y > H + 40) { k.est = 'morto'; return; }
    const p = S.nivel.def.ponte;
    k.tAnda -= dt;
    if (k.tAnda <= 0) {
      k.vx = (rndChefe(k) < 0.5 ? -1 : 1) * 28 * DIF;
      k.tAnda = 0.8 + rndChefe(k) * 1.2;
      k.dir = rndChefe(k) < 0.8 ? -1 : 1;
    }
    const xmin = (p.c0 + 3) * T;
    const xmax = (p.c1 - 1) * T - k.w;
    k.x += k.vx * dt;
    if (k.x < xmin) { k.x = xmin; k.vx = Math.abs(k.vx); } else if (k.x > xmax) { k.x = xmax; k.vx = -Math.abs(k.vx); }
    k.tPulo -= dt;
    if (k.tPulo <= 0 && k.chao) { k.vy = -300; k.tPulo = (1.6 + rndChefe(k) * 2.2) / DIF; }
    k.tt -= dt;
    if (k.tt <= 0) {
      const alto = rndChefe(k) < 0.5;
      S.chamas.push({ x: k.dir < 0 ? k.x - 12 : k.x + k.w, y: k.y + 8, w: 14, h: 6, vx: k.dir * 110 * DIF, alvo: p.r * T - (alto ? 26 : 10), t: 0 });
      k.tt = (1.4 + rndChefe(k) * 1.8) / DIF;
      k.boca = 0.3;
      if (!S.replay && naVista(k.x)) som('tiro');
    }
  }
  function chamasMundo(dt) {
    for (const c of S.chamas) {
      c.x += c.vx * dt;
      c.y += (c.alvo - c.y) * Math.min(1, dt * 2.5);
      c.t = (c.t || 0) + dt;
      if (c.t > 6) c.fora = true;
    }
    S.chamas = S.chamas.filter(c => !c.fora);
  }

  /* O meu coelho no mundo de todos */
  function baterJunto(c, r) {
    const v = cod(c, r);
    const i = r * S.nivel.L + c;
    const item = S.nivel.conteudo[i];
    const emCima = e => e.ativo && !e.fora && ['a', 'c', 'k'].includes(e.est) && Math.abs(e.y + e.h - r * T) < 3 && e.x + e.w > c * T - 2 && e.x < c * T + T + 2;
    const alvos = S.inimigos.filter(emCima).map(e => e.id);
    const itemEmCima = S.itens.some(it => it.sai <= 0 && Math.abs(it.y + it.h - r * T) < 3 && it.x + it.w > c * T && it.x < c * T + T);
    const lirio = cod(c, r - 1) === B.LIRIO;
    if (v !== B.PERGUNTA && v !== B.OCULTO && v !== B.TIJOLO && !alvos.length && !itemEmCima && !lirio) { som('bater'); return; }
    let moeda = null;
    if ((v === B.PERGUNTA || v === B.OCULTO) && (!item || item === 'moeda')) moeda = `moeda:${c}:${r}`;
    else if (v === B.TIJOLO && item === 'moedas') moeda = `moeda:${c}:${r}:${(S.multi.get(i)?.n || 0) + 1}`;
    const quebra = v === B.TIJOLO && !item && j.forma > 0;
    eventoMundo({ tipo: 'bloco', c, r, f: j.forma });
    for (const id of alvos) {
      const e = porId(id);
      if (e && e.est === 'x') { ganhar(100, e.x + 7, e.y); S.derrotados++; }
    }
    if (lirio) { S.lirioPegos.add((r - 1) * S.nivel.L + c); pedir(`lirio:${c}:${r - 1}`, 'lirio', c * T + 8, r * T - 8); }
    if (moeda) { pedir(moeda, 'lirio', c * T + 8, r * T - 6); popup(c * T + 8, r * T - 30, 200); }
    if (quebra) ganhar(50);
  }
  // Pedir um Lírio ou poder: some na hora aqui; quem pediu primeiro (no servidor) leva.
  function pedir(chave, tipo, x, y) {
    if (S.pegos.has(chave)) return;
    S.pegos.add(chave);
    S.pedidos.set(chave, tipo);
    enviar(() => jt.pegar(chave, 0));
    if (tipo === 'lirio') { som('moeda'); faiscas(x, y, 3, '#f7e08a'); }
  }
  function pegarLirioJunto(c, r) {
    S.lirioPegos.add(r * S.nivel.L + c);
    trocar(c, r, B.VAZIO);
    pedir(`lirio:${c}:${r}`, 'lirio', c * T + 8, r * T + 8);
  }
  function sumir(chave) {
    const [tipo, c, r] = chave.split(':');
    if (tipo === 'lirio') {
      const cc = Number(c);
      const rr = Number(r);
      if (!(cc >= 0 && cc < S.nivel.L && rr >= 0 && rr < LINHAS)) return;
      S.lirioPegos.add(rr * S.nivel.L + cc);
      if (cod(cc, rr) === B.LIRIO) trocar(cc, rr, B.VAZIO);
    } else S.itens = S.itens.filter(it => it.chave !== chave);
  }
  function contarLirio() {
    S.pontos += 200;
    S.lirios++;
    S.totalLirios++;
    if (S.lirios >= 100) { S.lirios -= 100; ganharVida(j.x + 6, j.y - 10); }
  }
  function coletarItensJunto() {
    let algum = false;
    for (const it of S.itens) if (!S.pegos.has(it.chave) && toca(j, it)) { pedir(it.chave, it.t, it.x + 7, it.y); algum = true; }
    if (algum) S.itens = S.itens.filter(it => !S.pegos.has(it.chave));
  }
  // Quando o MEU coelho chega perto de um inimigo dormindo, ele acorda (para todos, no mesmo quadro).
  function acordarInimigos() {
    const cx = j.x + j.w / 2;
    for (const e of S.inimigos) {
      if (e.ativo || e.fora) continue;
      const dx = e.x + e.w / 2 - cx;
      if (e.t === 'm' ? Math.abs(dx) >= ALCANCE_MORCEGO : Math.abs(dx) >= ALCANCE) continue;
      const ev = { tipo: 'acordou', e: e.id };
      if (e.t === 'm') { ev.d = j.x < e.x ? -1 : 1; ev.a = Math.round(Math.max(110, Math.min(220, j.y))); }
      eventoMundo(ev);
    }
    const k = S.chefe;
    if (k && !k.ativo && k.est === 'a' && k.x - cx < 300) eventoMundo({ tipo: 'acordou', e: -1 });
  }
  function derrubarJunto(e, p) {
    const d = e.x + e.w / 2 < j.x + j.w / 2 ? -1 : 1;
    eventoMundo({ tipo: 'matou', e: e.id, m: 'x', d });
    ganhar(p, e.x + 7, e.y);
    S.derrotados++;
    som('pisao');
  }
  function chutarJunto(e) {
    const dir = j.x + j.w / 2 < e.x + e.w / 2 ? 1 : -1;
    eventoMundo({ tipo: 'chutou', e: e.id, x: Math.round(e.x * 100) / 100, dir });
    ganhar(400, e.x + 7, e.y);
    som('pisao');
  }
  function pisarJunto(e, ent) {
    const m = e.t === 'r' ? 'p' : e.t === 't' ? 'c' : 'q';
    if (m !== 'c') S.derrotados++;
    eventoMundo({ tipo: 'matou', e: e.id, m });
    pontosCombo(e);
    som('pisao');
    poeira(e.x + 7, e.y, 3);
    j.vy = -(ent.pular ? 300 : 210);
    j.segurando = ent.pular;
    j.chao = false;
  }
  function tocarChefe() {
    const k = S.chefe;
    if (k && k.ativo && k.est === 'a' && toca(j, k)) ferir();
    for (const c of S.chamas) if (toca(j, { x: c.x + 2, y: c.y + 1, w: c.w - 4, h: c.h - 2 })) ferir();
  }

  function passoJogoJunto(dt, ent) {
    if (j.crescer > 0) { j.crescer = Math.max(0, j.crescer - dt); return; } // só o meu coelho para; o mundo segue
    S.relogio += dt;
    while (S.relogio >= TIQUE) {
      S.relogio -= TIQUE;
      S.tempo--;
      if (S.tempo === 100) som('alerta');
      if (S.tempo <= 0) { S.tempo = 0; morrer(false); return; }
    }
    moverPlataformas();
    atualizarJogador(dt, ent);
    coletarItensJunto();
    acordarInimigos();
    contatoInimigos(ent);
    atualizarBolas(dt);
    if (S.modo === 'jogo') tocarChefe();
    if (S.modo !== 'jogo') return;
    perigos();
    if (S.modo !== 'jogo') return;
    atualizarCamera(dt);
    S.maxX = Math.max(S.maxX, j.x);
    const def = S.nivel.def;
    if (!S.meio && def.meio && j.x >= def.meio.c * T) { S.meio = true; faiscas(def.meio.c * T + 8, def.meio.r * T - 24, 8, '#e8c24a'); }
    if (def.mastro && j.x + j.w >= def.mastro * T - 0.5) { chegar(); pegarMastro(); }
    else if (def.alavanca && toca(j, { x: def.alavanca.c * T + 2, y: def.alavanca.r * T - 24, w: 12, h: 24 })) { chegar(); iniciarPonte(); }
  }
  function fimDaMorte() {
    j.forma = 0;
    if (S.proxima != null) { S.modo = 'aguardando'; S.tm = 0; return; } // a fase vai mudar: não gasta vida
    if (S.reserva > 0) { S.reserva--; renascer(); popup(j.x + 6, j.y - 10, 'Vida guardada!'); return; }
    S.modo = 'esperando';
    S.tm = 0;
    S.esperando = true;
    jt.morri();
  }
  // Volta no último marco que eu passei (ou no começo), pequeno e piscando por 2 segundos.
  function renascer() {
    const def = S.nivel.def;
    const ini = S.meio && def.meio ? def.meio : def.inicio;
    j.forma = 0;
    Object.assign(j, {
      x: ini.c * T + 2, y: ini.r * T - PEQUENO, w: LARG, h: PEQUENO, vx: 0, vy: 0, chao: true, dir: 1, inv: 2, estrela: 0, agachado: false,
      coyote: 0, buffer: 0, segurando: false, crescer: 0, sobre: -1, morto: false, caiu: false, subiu: false, dentro: false, tiro: 0,
    });
    S.cam = Math.max(0, Math.min(S.nivel.L * T - W, ini.c * T - 96));
    Object.assign(S, { tempo: TEMPO_FASE, relogio: 0, bolas: [], combo: 0, esperando: false });
    if (['esperando', 'morrendo', 'jogo'].includes(S.modo)) { S.modo = 'jogo'; S.tm = 0; }
  }
  // Toquei no mastro (ou na alavanca): avisa os outros e, se fui o primeiro, chama "cheguei" uma vez só.
  function chegar() {
    if (S.chegada) return;
    S.chegada = { q: S.q, t: 0, feito: false };
    jt.evento({ tipo: 'mastro', q: S.q, s: S.fase, a: S.nivel.def.alavanca ? 1 : 0 });
    J.tPonto = 1;
  }
  function conferirChegada(dt) {
    const c = S.chegada;
    if (c.feito) return;
    c.t += dt;
    if (c.t < ESPERA_CHEGADA) return;
    if (S.proxima != null) { c.feito = true; return; } // a fase já passou
    const antes = S.mastros.some(m => m.q < c.q || (m.q === c.q && m.i < jt.eu));
    if (antes && c.t < 2) return; // quem chegou antes chama (e, se sumir, eu chamo depois de 2 s)
    c.feito = true;
    jt.cheguei();
  }

  /* Mandar para os outros: no máximo LIMITE_EVENTOS por segundo (o resto espera na fila, em ordem) */
  function enviar(f) { J.fila.push(f); drenarFila(); }
  function drenarFila() {
    const agora = jt.tempo();
    while (J.enviados.length && J.enviados[0] <= agora - 1) J.enviados.shift();
    while (J.fila.length && J.enviados.length < LIMITE_EVENTOS) { J.enviados.push(agora); J.fila.shift()(); }
  }
  function codigoModo() {
    if (S.fora) return 3;
    if (S.modo === 'titulo' || (S.modo === 'aguardando' && j.morto)) return 4;
    if (j.morto) return 1;
    return ['mastro', 'andando', 'contagem', 'ponte', 'resgate', 'princesa', 'aguardando'].includes(S.modo) ? 2 : 0;
  }
  function mandarPos() {
    if (S.fora) {
      if (!J.posFora) { J.posFora = true; jt.pos({ s: S.fase, m: 3 }); }
      return;
    }
    const bits = (j.agachado ? 1 : 0) | (j.chao ? 2 : 0) | (j.subiu ? 4 : 0) | (j.dentro ? 8 : 0) | (j.tiro > 0 ? 16 : 0) | (j.morto ? 32 : 0) | (j.vy < 0 ? 64 : 0);
    jt.pos({
      x: r1(j.x), y: r1(j.y), f: j.forma, o: j.dir, b: bits, v: Math.round(j.vx), e: j.estrela > 0 ? 1 : 0, n: j.inv > 0 ? 1 : 0,
      c: j.crescer > 0 ? 1 : 0, s: S.fase, m: codigoModo(),
    });
  }
  // Progresso que só cresce: (fase e o mais longe que fui, em blocos) x 10 + pontos / 100.
  const progresso = () => (S.fase * 212 + Math.floor(S.maxX / T)) * 10 + Math.floor(S.pontos / 100);
  function mandarPontos(dt) {
    J.tPonto += dt;
    if (J.tPonto < 0.5 || S.fora) return;
    J.tPonto = 0;
    const n = progresso();
    if (n > J.ultimoPonto) { J.ultimoPonto = n; enviar(() => jt.pontos(n)); }
  }
  function vidasAgora() {
    const e = jt.estado?.();
    if (!e) return S.vidas;
    if (jt.modo === 'coop') return Math.max(0, Number(e.vidasEquipe) || 0);
    return Math.max(0, Number(e.p?.[jt.eu]?.vidas) || 0);
  }

  /* Os outros coelhos */
  function foraDe(i) {
    const p = jt.estado?.()?.p?.[i];
    return !!(p?.fora || p?.saiu || S.outros[i]?.fora);
  }
  const outroNaFase = o => o && o.d.s === S.fase && o.d.m !== 3 && o.d.m !== 4 && Number.isFinite(o.d.x) && !foraDe(o.i);
  function suavizarOutros(dt) {
    for (const o of S.outros) {
      if (!o || !Number.isFinite(o.d.x)) continue;
      o.idade += dt;
      const d = o.d;
      const ax = d.x + (Number(d.v) || 0) * Math.min(0.1, o.idade);
      const ay = Number(d.y) || 0;
      if (Math.abs(ax - o.x) > 96 || Math.abs(ay - o.y) > 96) { o.x = ax; o.y = ay; }
      else { const k = Math.min(1, dt * 14); o.x += (ax - o.x) * k; o.y += (ay - o.y) * k; }
      if (d.b & 2 && Math.abs(d.v) > 1) o.passo += dt * (0.4 + Math.abs(d.v) / ANDAR);
    }
  }
  // Fora do jogo: a câmera segue (só para a frente) o coelho vivo que está mais longe.
  function cameraAssistindo(dt) {
    let alvo = null;
    for (const o of S.outros) if (outroNaFase(o) && o.d.m !== 1) alvo = Math.max(alvo ?? -1e9, o.x);
    if (alvo == null) return;
    const c = alvo + 6 - W * 0.42;
    if (c > S.cam) S.cam += (c - S.cam) * Math.min(1, dt * 5);
    S.cam = Math.max(0, Math.min(S.nivel.L * T - W, S.cam));
  }

  /* Fases do junto */
  function carregarJunto(f) {
    if (j.morto || S.fora) j.forma = 0;
    carregar(f);
    const base = nivelBase(f);
    extrasDaFase(f).forEach((e, k) => S.inimigos.push(novoInimigo(e, base.inimigos.length + k)));
    const k = S.chefe;
    if (k) {
      k.vida = Math.round(CHEFE.vida * DIF);
      k.rs = (SEM ^ Math.imul(f + 1, 0x9e3779b1)) >>> 0;
      k.tPulo = 1.5 + rndChefe(k);
      k.tAnda = 0;
    }
    Object.assign(S, {
      q: 0, tf: 0, proxima: null, chegada: null, mastros: [], pegos: new Set(), pedidos: new Map(), lirioPegos: new Set(),
      premiados: new Set(), premioChefe: false, maxX: j.x, replay: false,
    });
    Object.assign(J, { log: [], fotos: [], voltar: null, posFora: false });
    guardar();
    const daqui = J.adiantados.filter(ev => ev.s === f);
    J.adiantados = J.adiantados.filter(ev => ev.s > f);
    for (const ev of daqui) { inserir(ev); if (ev.q <= S.q) marcarVolta(ev.q); }
  }
  function iniciarJunto() {
    Object.assign(S, { outros: jt.jogadores.map(() => null), avisos: [], reserva: 0, esperando: false, proxima: null });
    S.fora = !!jt.estado?.()?.p?.[jt.eu]?.fora;
    carregarJunto(Math.max(0, Math.min(FASES.length - 1, Math.floor(Number(jt.fase()) || 0))));
    S.vidas = vidasAgora();
    jt.aoPos = (i, d) => {
      if (i === jt.eu || !d || typeof d !== 'object' || !S.outros || i < 0 || i >= S.outros.length) return;
      const o = S.outros[i];
      if (!o || o.d.s !== d.s || !Number.isFinite(o.x)) S.outros[i] = { i, x: Number(d.x) || 0, y: Number(d.y) || 0, d, idade: 0, passo: 0, fora: o?.fora };
      else { o.d = d; o.idade = 0; }
    };
    jt.aoEvento = (i, ev) => {
      if (i === jt.eu || !ev) return;
      if (ev.tipo === 'mastro') {
        if (ev.s !== S.fase) return;
        S.mastros.push({ i, q: Number(ev.q) || 0 });
        avisar(`${nomeDe(i)} ${ev.a ? 'puxou a alavanca' : 'chegou no mastro'}!`, corDe(i));
      } else if (MUNDO_EVENTOS.includes(ev.tipo)) recebido(i, ev);
    };
    jt.aoPegou = (i, chave) => {
      chave = String(chave);
      const meu = S.pedidos.get(chave);
      S.pedidos.delete(chave);
      S.pegos.add(chave);
      sumir(chave);
      if (i !== jt.eu || meu === undefined) return;
      if (meu === 'lirio') { contarLirio(); return; }
      if (meu === 'v') { ganharVida(j.x + 6, j.y - 8); return; }
      if (S.modo !== 'jogo' || j.morto) { ganhar(1000, j.x + 6, j.y - 8); return; }
      coletar({ t: meu, x: j.x - 1, y: j.y });
    };
    jt.aoRenascer = i => {
      if (i !== jt.eu) return;
      if (!S.fora) renascer();
    };
    jt.aoFora = i => {
      if (i !== jt.eu) {
        if (S.outros[i]) S.outros[i].fora = true;
        avisar(`${nomeDe(i)} está fora.`, corDe(i));
        return;
      }
      S.fora = true;
      S.esperando = false;
      if (S.modo !== 'titulo') { S.modo = 'fora'; S.tm = 0; }
    };
    jt.aoChegou = i => {
      if (i === jt.eu || S.mastros.some(m => m.i === i)) return;
      avisar(`${nomeDe(i)} chegou!`, corDe(i));
    };
    jt.aoFase = f => {
      if (jt.modo !== 'coop' || !(f >= 0 && f < FASES.length) || f === S.fase) return;
      S.proxima = f;
      if (S.modo === 'jogo') { S.modo = 'aguardando'; S.tm = 0; j.vx = 0; }
    };
  }

  function atualizarJunto(dt, ent) {
    atualizarEfeitos(dt);
    for (const a of S.avisos) a.t -= dt;
    S.avisos = S.avisos.filter(a => a.t > 0);
    // Co-op: a fase nova carrega um pouco antes (cartão) e começa para todos em faseTempo() = 0.
    if (S.proxima != null && jt.faseTempo() >= -CARTAO) carregarJunto(S.proxima);
    if (!['ponte', 'resgate', 'princesa'].includes(S.modo)) { // no fim do castelo o mundo para
      if (S.proxima != null) { if (J.voltar != null) voltarNoTempo(); passoMundo(); }
      else avancarMundo(2);
    }
    suavizarOutros(dt);
    S.vidas = vidasAgora();
    switch (S.modo) {
      case 'titulo':
        S.tm += dt;
        if (jt.faseTempo() >= 0) { S.modo = S.fora ? 'fora' : S.esperando ? 'esperando' : 'jogo'; S.tm = 0; }
        break;
      case 'jogo': passoJogoJunto(dt, ent); break;
      case 'morrendo': passoMorte(dt); break;
      case 'fora': S.tm += dt; cameraAssistindo(dt); break;
      case 'mastro': passoMastro(dt); break;
      case 'andando': passoAndando(dt); break;
      case 'contagem': passoContagem(dt); break;
      case 'ponte': passoPonte(dt); break;
      case 'resgate': passoResgate(dt); break;
      case 'princesa': passoPrincesa(dt); break;
      default: S.tm += dt; break; // esperando, aguardando
    }
    if (S.chegada) conferirChegada(dt);
    mandarPos();
    mandarPontos(dt);
    drenarFila();
  }

  /* Desenho do junto: os outros coelhos, setas, barra de progresso e avisos */
  function desenharOutros(g, t) {
    for (const o of S.outros) {
      if (!outroNaFase(o)) continue;
      const d = o.d;
      const forma = [0, 1, 2].includes(d.f) ? d.f : 0;
      desenharJogador(g, { j: [o.x, o.y, forma, d.o < 0 ? -1 : 1, d.b | 0, o.passo, d.e ? 1 : 0, d.n ? 1 : 0, 0, Number(d.v) || 0] }, t, visualDe(o.i));
      if (d.b & 8) continue;
      const h = forma > 0 ? (d.b & 1 ? AGACHADO : GRANDE) : PEQUENO;
      texto(g, nomeDe(o.i), o.x + 6, o.y + h - (forma > 0 && !(d.b & 1) ? 50 : 30), 7, corDe(o.i), 'center', 'rgba(0,0,0,0.8)');
    }
  }
  function desenharMarca(g) {
    if (S.fora || j.morto || j.dentro || S.modo === 'titulo') return;
    const x = j.x + 6;
    const y = j.y + j.h - (j.forma > 0 && !j.agachado ? 52 : 32);
    g.fillStyle = corDe(jt.eu);
    g.beginPath(); g.moveTo(x - 3.5, y - 4); g.lineTo(x + 3.5, y - 4); g.lineTo(x, y + 1); g.closePath(); g.fill();
  }
  function setasOutros(g) {
    for (const o of S.outros) {
      if (!outroNaFase(o) || o.d.m === 1) continue;
      const sx = o.x + 6 - S.cam;
      if (sx >= -2 && sx <= W + 2) continue;
      const esq = sx < 0;
      const y = Math.max(48, Math.min(H - 18, o.y + 8));
      const x = esq ? 6 : W - 6;
      const s = esq ? 1 : -1;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath(); g.moveTo(x - s * 1.5, y); g.lineTo(x + s * 11, y - 8); g.lineTo(x + s * 11, y + 8); g.closePath(); g.fill();
      g.fillStyle = corDe(o.i);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 9, y - 6); g.lineTo(x + s * 9, y + 6); g.closePath(); g.fill();
      texto(g, nomeDe(o.i), x + s * 14, y, 7, corDe(o.i), esq ? 'left' : 'right', 'rgba(0,0,0,0.8)');
    }
  }
  function barraProgresso(g) {
    const def = S.nivel.def;
    const fimX = (def.mastro ?? def.alavanca?.c ?? S.nivel.L) * T;
    const x0 = 16;
    const x1 = W - 16;
    const y = 34;
    const px = x => x0 + (x1 - x0) * Math.max(0, Math.min(1, x / fimX));
    g.fillStyle = 'rgba(0,0,0,0.4)';
    retArred(g, x0 - 2, y - 2, x1 - x0 + 4, 4, 2);
    g.fill();
    g.fillStyle = 'rgba(236,224,191,0.55)';
    g.fillRect(x0, y - 0.5, x1 - x0, 1);
    g.fillStyle = '#e8c24a';
    g.fillRect(x1, y - 8, 1, 8);
    g.beginPath(); g.moveTo(x1 + 1, y - 8); g.lineTo(x1 + 6, y - 6); g.lineTo(x1 + 1, y - 4); g.fill();
    for (const o of S.outros) if (outroNaFase(o)) elipse(g, px(o.x + 6), y, 3, 3, corDe(o.i));
    if (!S.fora) {
      elipse(g, px(j.x + 6), y, 4, 4, '#ffffff');
      elipse(g, px(j.x + 6), y, 3, 3, corDe(jt.eu));
    }
  }
  function faixa(g, txt, y, cor) {
    g.font = `bold 10px ${FONTE}`;
    const w = Math.min(W - 20, (g.measureText?.(txt)?.width || txt.length * 6) + 20);
    g.fillStyle = 'rgba(8,14,10,0.7)';
    retArred(g, W / 2 - w / 2, y - 8, w, 16, 6);
    g.fill();
    texto(g, txt, W / 2, y, 10, cor, 'center', null);
  }
  function sobreposicaoJunto(g) {
    if (S.modo !== 'titulo') { setasOutros(g); barraProgresso(g); }
    let y = S.modo === 'titulo' ? 250 : 56;
    if (S.fora) { faixa(g, 'Você está fora: assistindo', y, '#ece0bf'); y += 19; }
    for (const a of S.avisos) { faixa(g, a.txt, y, a.cor); y += 19; }
  }
  const extraJunto = jt ? { outros: desenharOutros, eu: visualDe(jt.eu), marca: desenharMarca } : null;

  if (jt) iniciarJunto();
  else carregar(0);

  const jogo = {
    get pontos() { return S.pontos; },
    get acabou() { return S.acabou; },
    atualizar(dt, ent) {
      if (S.acabou) return;
      if (jt) { atualizarJunto(dt, ent); return; } // no junto, quem acaba a partida é o servidor
      atualizarEfeitos(dt);
      switch (S.modo) {
        case 'titulo': S.tm += dt; if (S.tm >= 2.4) { S.modo = 'jogo'; S.tm = 0; } break;
        case 'jogo': passoJogo(dt, ent); break;
        case 'morrendo': passoMorte(dt); break;
        case 'mastro': passoMastro(dt); break;
        case 'andando': passoAndando(dt); break;
        case 'contagem': passoContagem(dt); break;
        case 'ponte': passoPonte(dt); break;
        case 'resgate': passoResgate(dt); break;
        case 'princesa': passoPrincesa(dt); break;
        default: break;
      }
    },
    desenhar(g, t) {
      if (!jt) { desenharCena(g, cena(false), S.nivel.mapa, t, S.particulas); return; }
      desenharCena(g, cena(false), S.nivel.mapa, t, S.particulas, extraJunto);
      sobreposicaoJunto(g);
    },
    foto: () => cena(true),
    resumo() {
      const mundo = `Mundo 1-${S.fase + 1}`;
      const volta = S.volta > 1 ? ` (volta ${S.volta})` : '';
      return {
        titulo: S.resgates > 0 ? 'A princesa foi salva!' : 'Fim de jogo',
        linhas: [
          `Chegou até o ${mundo}: ${FASES[S.fase].nome}${volta}.`,
          `${S.totalLirios} Lírios coletados e ${S.derrotados} inimigos derrotados.`,
          S.resgates > 0 ? `Princesa Cenoura resgatada ${S.resgates === 1 ? 'uma vez' : `${S.resgates} vezes`}!` : 'A Princesa Cenoura ainda espera no castelo do Raposo.',
        ],
        detalhe: `${mundo}${S.volta > 1 ? `, volta ${S.volta}` : ''}, ${S.totalLirios} Lírios`.slice(0, 60),
      };
    },
    usarSegredo(chave) {
      if (S.acabou) return false;
      if (chave === 'super-vidas') {
        if (S.superVidas) return false;
        S.superVidas = true;
        S.vidas += 5;
        som('vida');
        popup(j.x + 6, j.y - 8, '+5 vidas');
        return true;
      }
      if (chave === 'super-fogo') {
        if (j.morto || !['jogo', 'titulo'].includes(S.modo) || j.forma === 2) return false;
        if (j.forma === 0) crescer();
        j.forma = 2;
        som('poder');
        faiscas(j.x + 6, j.y + 8, 8, '#ffb35a');
        return true;
      }
      return false;
    },
    mudouSegredo(chave, ligado) {
      if (chave === 'super-lua') popup(j.x + 6, j.y - 8, ligado ? 'Gravidade da lua!' : 'Gravidade normal');
    },
    // Para os testes
    _estado: S,
    _junto: J,
    _teste: {
      // junto: leva o mundo até o quadro q (depois de refazer o que chegou atrasado)
      mundoAte(q) { if (J.voltar != null) voltarNoTempo(); while (S.q < q) passoMundo(); },
      irFase: (i, noMeio = false) => { carregar(i, noMeio); S.modo = 'jogo'; },
      colocar(x, y) { Object.assign(j, { x, y, vx: 0, vy: 0, sobre: -1 }); S.cam = Math.max(0, Math.min(S.nivel.L * T - W, x - 200)); },
    },
  };
  return jogo;
}

/* ─── Desenho ─── */

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mod = (a, n) => ((a % n) + n) % n;

const TEMAS = {
  campo: {
    tijolo: ['#b4552f', '#6e2e17', '#d77a50'], pedra: ['#a07f55', '#d1b48a', '#6b5233'], chao: ['#8a5a32', '#6f4526', '#a8744a'],
    grama: ['#5cb547', '#86d466', '#3f8f37'], usado: ['#7a5a34', '#4f3920'], castelo: ['#c9b48e', '#9c8762', '#e2d2ae'],
  },
  caverna: {
    tijolo: ['#3f6f95', '#1d3550', '#6a9cc4'], pedra: ['#4a5f80', '#7086a8', '#2c3a52'], chao: ['#2c3a55', '#1d2740', '#3e5274'],
    grama: ['#3f8f7a', '#6cc3a8', '#2a6656'], usado: ['#4a4f63', '#2a2d3a'], castelo: ['#8e9cb8', '#64708a', '#b4c0d6'],
  },
  castelo: {
    tijolo: ['#6d6762', '#3a3532', '#8d8781'], pedra: ['#5d5752', '#837c75', '#3a3532'], chao: ['#4f4a47', '#2e2a28', '#6a6460'],
    grama: null, usado: ['#5a4a3a', '#3a2e22'], castelo: ['#6d6762', '#3a3532', '#8d8781'],
  },
};
TEMAS.copas = { ...TEMAS.campo };

/* Blocos desenhados uma vez (em tamanho grande) e carimbados; no Node desenha direto. */
const ESCALA_CACHE = 4;
const cache = new Map();
function novaTela(w, h) {
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  } catch { /* sem canvas extra */ }
  return null;
}
function carimbo(g, chave, x, y, pintar) {
  let s = cache.get(chave);
  if (s === undefined) {
    s = null;
    const c = novaTela(T * ESCALA_CACHE, T * ESCALA_CACHE);
    const cg = c?.getContext('2d');
    if (cg) { cg.scale(ESCALA_CACHE, ESCALA_CACHE); pintar(cg); s = c; }
    cache.set(chave, s);
  }
  if (s) g.drawImage(s, x, y, T + 0.5, T + 0.5);
  else { g.save(); g.translate(x, y); pintar(g); g.restore(); }
}

/* Sprites enviados em #/recreacao/sprites (veja sprites.js e a lista SPRITES no fim do arquivo). Cada desenho
   tenta o sprite primeiro; sem sprite, desenha como sempre. Só muda o desenho: nada de física, sorteio ou rede. */
const SC = 'supercoelho.';
const sprite = (g, peca, anim, x, y, o) => desenharSprite(g, SC + peca, anim, x, y, o);
const temPeca = peca => temSprite(SC + peca);
// Só a animação enviada com esse nome (sem cair na primeira que tiver).
const enviada = (peca, anim) => temSprite(`${SC}${peca}.${anim}`);
// Blocos de cada tema: só o sprite daquele tema (o tijolo da caverna não vira o do campo).
const spriteExato = (g, peca, anim, x, y, o) => enviada(peca, anim) && sprite(g, peca, anim, x, y, o);
// A primeira animação da lista que foi enviada; sem nenhuma, a primeira (aí o sprite cai na que tiver).
const escolher = (peca, lista) => lista.find(a => enviada(peca, a)) || lista[0];
// As Copas usam as cores dos Campos.
const paleta = tema => (tema === 'copas' ? 'campo' : tema);
const BLOCO = { largura: T + 0.5, altura: T + 0.5 };
// Derrotado (de cabeça para baixo): o sprite "derrotado" com o pé no fundo da caixa de alto "alt";
// sem ele, o de andar virado em volta de (x, y), como o desenho de sempre.
function derrotado(g, peca, andar, x, y, alt, o) {
  if (enviada(peca, 'derrotado')) return sprite(g, peca, 'derrotado', x, y + alt, o);
  return sprite(g, peca, andar, x, y, { ...o, rot: Math.PI, dir: -(o.dir ?? 1) });
}
// Trocou algum sprite: os blocos guardados são redesenhados.
aoMudarSprites(() => cache.clear());

function pintarChao(g, tema, topo, baixoTeto, v) {
  const tm = TEMAS[tema];
  const [base, escuro, claro] = tm.chao;
  g.fillStyle = base;
  g.fillRect(0, 0, T, T);
  if (tema === 'castelo') {
    g.fillStyle = escuro;
    g.fillRect(0, 7, 16, 1.2); g.fillRect(0, 15, 16, 1.2);
    g.fillRect(v % 2 ? 4 : 11, 0, 1.2, 7); g.fillRect(v % 2 ? 12 : 6, 8, 1.2, 7);
    g.fillStyle = claro;
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 8.2, 16, 0.8);
  } else {
    for (let k = 0; k < 4; k++) elipse(g, 1.5 + hash(v * 11 + k) * 13, 1.5 + hash(v * 7 + k * 3) * 13, 1.6, 1.1, k % 2 ? escuro : claro);
    if (tema === 'caverna') { g.fillStyle = claro; g.fillRect(0, 0, 16, 1); g.fillStyle = escuro; g.fillRect(v * 3 + 2, 4, 1, 6); }
    if (topo && tm.grama) {
      const [gr, luz, sombra] = tm.grama;
      g.fillStyle = sombra; g.fillRect(0, 0, 16, 6);
      g.fillStyle = gr; g.fillRect(0, 0, 16, 4.5);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 4 + (v % 2), 4.4); g.lineTo(k * 4 + 2 + (v % 2), 7.5); g.lineTo(k * 4 + 4 + (v % 2), 4.4); g.fill(); }
      g.fillStyle = luz; g.fillRect(0, 0, 16, 1.4);
    }
  }
  if (baixoTeto) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 12, 16, 4); }
}
function pintarTijolo(g, tema) {
  const [base, massa, luz] = TEMAS[tema].tijolo;
  g.fillStyle = massa;
  g.fillRect(0, 0, T, T);
  for (const [x, y, w] of [[0.6, 0.6, 7], [8.6, 0.6, 6.8], [0, 8.6, 3.4], [4.6, 8.6, 7], [12.6, 8.6, 3.4]]) {
    g.fillStyle = base; g.fillRect(x, y, w, 6.8);
    g.fillStyle = luz; g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 5.8, w, 1);
  }
}
function pintarPedra(g, tema) {
  const [base, luz, sombra] = TEMAS[tema].pedra;
  g.fillStyle = sombra; g.fillRect(0, 0, T, T);
  g.fillStyle = luz; g.beginPath(); g.moveTo(0, 0); g.lineTo(16, 0); g.lineTo(0, 16); g.fill();
  g.fillStyle = base; g.fillRect(2.5, 2.5, 11, 11);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(2.5, 2.5, 11, 1.5);
}
function pintarUsado(g, tema) {
  const [base, borda] = TEMAS[tema].usado;
  g.fillStyle = borda; g.fillRect(0, 0, T, T);
  g.fillStyle = base; g.fillRect(1, 1, 14, 14);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(1, 1, 14, 1.5);
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) elipse(g, x, y, 1, 1, borda);
}
function pintarPergunta(g) {
  g.fillStyle = '#6b4a0e'; g.fillRect(0, 0, T, T);
  g.fillStyle = '#e8b93a'; g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#f8dc7c'; g.fillRect(1, 1, 14, 2); g.fillRect(1, 1, 2, 14);
  g.fillStyle = '#b8861f'; g.fillRect(1, 13, 14, 2); g.fillRect(13, 1, 2, 14);
  for (const [x, y] of [[3.5, 3.5], [12.5, 3.5], [3.5, 12.5], [12.5, 12.5]]) elipse(g, x, y, 0.9, 0.9, '#7a5512');
}
function pintarPonte(g) {
  g.fillStyle = '#5a3418'; g.fillRect(0, 0, T, 9);
  g.fillStyle = '#8a5a2c';
  for (let k = 0; k < 4; k++) g.fillRect(k * 4 + 0.4, 0.6, 3.2, 7.6);
  g.fillStyle = '#c9a46b'; g.fillRect(0, 0, 16, 1.2);
  g.strokeStyle = '#3a3532'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(8, 11, 2, 2.5, 0, 0, Math.PI * 2); g.stroke();
}

function desenharLirio(g, x, y, t, fase = 0) {
  if (sprite(g, 'lirio', 'girando', x, y, { t: t + fase / 3.5 })) return;
  pintarLirio(g, x, y, t, fase);
}
function pintarLirio(g, x, y, t, fase = 0) {
  const lx = Math.max(0.15, Math.abs(Math.cos(t * 3.5 + fase)));
  elipse(g, x, y, 6 * lx, 7, '#a8781c');
  elipse(g, x, y, 5 * lx, 6, '#e8c24a');
  elipse(g, x - 1.2 * lx, y - 1.5, 2 * lx, 2.8, '#f7e08a');
  if (lx > 0.5) {
    elipse(g, x, y - 0.5, 1.1 * lx, 2.6, '#a8781c');
    elipse(g, x - 1.9 * lx, y + 0.3, 0.9 * lx, 1.8, '#a8781c', -0.6);
    elipse(g, x + 1.9 * lx, y + 0.3, 0.9 * lx, 1.8, '#a8781c', 0.6);
    g.fillStyle = '#a8781c'; g.fillRect(x - 2.4 * lx, y + 1.6, 4.8 * lx, 0.9);
  }
}
function estrelinha(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rr = k % 2 ? r * 0.3 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}
function texto(g, s, x, y, tam, cor, alinhar = 'left', sombra = 'rgba(0,0,0,0.65)') {
  g.font = `bold ${tam}px ${FONTE}`;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  if (sombra) { g.fillStyle = sombra; g.fillText(s, x + 0.8, y + 0.9); }
  g.fillStyle = cor;
  g.fillText(s, x, y);
}
function retArred(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* Fundos com camadas (paralaxe) */
function degrade(g, cores) {
  const d = g.createLinearGradient(0, 0, 0, H);
  for (const [p, c] of cores) d.addColorStop(p, c);
  g.fillStyle = d;
  g.fillRect(0, 0, W, H);
}
function serra(g, desloc, base, amp, freq, cor, semente) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) {
    const wx = x + desloc;
    g.lineTo(x, base - amp * (0.6 * Math.sin(wx * freq + semente) + 0.4 * Math.sin(wx * freq * 2.3 + semente * 2)));
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}
function nuvem(g, x, y, s, cor) {
  elipse(g, x, y, 18 * s, 8 * s, cor);
  elipse(g, x - 13 * s, y + 2 * s, 11 * s, 6 * s, cor);
  elipse(g, x + 14 * s, y + 2 * s, 12 * s, 6.5 * s, cor);
  elipse(g, x + 2 * s, y - 6 * s, 11 * s, 8 * s, cor);
}
// Repete enfeites de fundo a cada "passo" de tela, com variação fixa por índice.
function repetir(desloc, passo, f) {
  const i0 = Math.floor(desloc / passo) - 1;
  for (let i = i0; i <= i0 + Math.ceil(W / passo) + 2; i++) f(i * passo - desloc, i);
}
function silhuetaCastelo(g, x, y, s, cor) {
  g.fillStyle = cor;
  g.fillRect(x, y - 26 * s, 60 * s, 26 * s + 60);
  for (const [tx, th] of [[-8, 46], [22, 62], [52, 42]]) {
    g.fillRect(x + tx * s, y - th * s, 16 * s, th * s + 60);
    g.beginPath(); g.moveTo(x + (tx - 2) * s, y - th * s); g.lineTo(x + (tx + 8) * s, y - (th + 14) * s); g.lineTo(x + (tx + 18) * s, y - th * s); g.fill();
    g.fillRect(x + (tx + 7.5) * s, y - (th + 24) * s, 1, 10 * s);
    g.beginPath(); g.moveTo(x + (tx + 8.5) * s, y - (th + 24) * s); g.lineTo(x + (tx + 15) * s, y - (th + 21) * s); g.lineTo(x + (tx + 8.5) * s, y - (th + 18) * s); g.fill();
  }
}

function fundoCampo(g, cam, t) {
  degrade(g, [[0, '#5aa9e0'], [0.6, '#b4e1f4'], [1, '#e6f5dc']]);
  const sol = g.createRadialGradient(420, 58, 4, 420, 58, 70);
  sol.addColorStop(0, 'rgba(255,246,200,0.95)');
  sol.addColorStop(0.3, 'rgba(255,240,180,0.4)');
  sol.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = sol;
  g.fillRect(340, 0, 160, 140);
  elipse(g, 420, 58, 14, 14, '#fff6cf');
  repetir(cam * 0.12 + t * 4, 170, (x, i) => nuvem(g, x + hash(i) * 60, 34 + hash(i + 7) * 50, 0.6 + hash(i + 3) * 0.6, 'rgba(255,255,255,0.85)'));
  serra(g, cam * 0.08, 178, 34, 0.009, '#a7c9dc', 1);
  repetir(cam * 0.08, 1100, (x, i) => silhuetaCastelo(g, x + 300 + hash(i) * 200, 150, 0.9, '#93b7cc'));
  serra(g, cam * 0.2, 208, 24, 0.013, '#8cc08e', 4);
  repetir(cam * 0.4, 230, (x, i) => {
    const r = 60 + hash(i + 11) * 50;
    const cx = x + hash(i + 2) * 80;
    g.fillStyle = '#6cb25a'; g.beginPath(); g.ellipse(cx, 262, r, r * 0.62, 0, Math.PI, 0); g.fill();
    elipse(g, cx - r * 0.3, 262 - r * 0.42, r * 0.35, r * 0.12, 'rgba(255,255,255,0.12)');
    for (let k = 0; k < 4; k++) elipse(g, cx + (hash(i * 5 + k) - 0.5) * r * 1.2, 262 - hash(i * 3 + k) * r * 0.4, 1.6, 1.2, '#4f9446');
  });
}
function fundoCaverna(g, cam, t) {
  degrade(g, [[0, '#05070d'], [0.5, '#0d1424'], [1, '#162238']]);
  repetir(cam * 0.2, 70, (x, i) => {
    const h = 40 + hash(i) * 90;
    g.fillStyle = '#111a2c';
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + 18 + hash(i + 1) * 20, H - h); g.lineTo(x + 50, H); g.fill();
    g.beginPath(); g.moveTo(x + 10, 0); g.lineTo(x + 24, 30 + hash(i + 4) * 60); g.lineTo(x + 40, 0); g.fill();
  });
  repetir(cam * 0.35, 140, (x, i) => {
    const y = 80 + hash(i + 9) * 130;
    const cor = hash(i) < 0.5 ? [110, 231, 255] : [199, 155, 255];
    const a = 0.25 + Math.sin(t * 1.5 + i) * 0.1;
    const brilho = g.createRadialGradient(x + 30, y, 1, x + 30, y, 26);
    brilho.addColorStop(0, `rgba(${cor.join(',')},${a})`);
    brilho.addColorStop(1, `rgba(${cor.join(',')},0)`);
    g.fillStyle = brilho; g.fillRect(x + 4, y - 26, 52, 52);
    elipse(g, x + 30, y, 2.2, 3.5, `rgba(${cor.join(',')},0.8)`);
  });
  for (let k = 0; k < 22; k++) {
    const x = mod(hash(k) * W + t * 10 * (hash(k + 1) - 0.5) - cam * 0.3, W);
    const y = mod(hash(k + 5) * H - t * (3 + hash(k + 2) * 5), H);
    elipse(g, x, y, 0.9, 0.9, 'rgba(170,210,255,0.35)');
  }
}
function fundoCopas(g, cam, t) {
  degrade(g, [[0, '#3a4f9c'], [0.45, '#b878a6'], [0.8, '#f2a77a'], [1, '#ffd29a']]);
  const sol = g.createRadialGradient(150, 196, 8, 150, 196, 110);
  sol.addColorStop(0, 'rgba(255,236,170,0.95)');
  sol.addColorStop(0.25, 'rgba(255,214,150,0.45)');
  sol.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = sol; g.fillRect(30, 80, 240, 208);
  elipse(g, 150, 196, 24, 24, '#ffe6a8');
  repetir(cam * 0.1 + t * 3, 190, (x, i) => nuvem(g, x + hash(i) * 70, 40 + hash(i + 7) * 70, 0.7 + hash(i + 3) * 0.6, 'rgba(255,214,226,0.55)'));
  repetir(cam * 0.22, 22, (x, i) => elipse(g, x, 214 - hash(i) * 34, 16, 26, '#7d6496'));
  g.fillStyle = '#7d6496'; g.fillRect(0, 214, W, H);
  repetir(cam * 0.45, 30, (x, i) => elipse(g, x, 244 - hash(i + 40) * 30, 22, 32, '#4f416f'));
  g.fillStyle = '#4f416f'; g.fillRect(0, 244, W, H);
  for (let k = 0; k < 10; k++) {
    const x = mod(hash(k + 20) * W + Math.sin(t * 0.7 + k) * 20 - cam * 0.5, W);
    const y = 150 + hash(k + 30) * 110 + Math.sin(t * 1.3 + k * 2) * 8;
    elipse(g, x, y, 1.3, 1.3, `rgba(255,240,150,${0.4 + Math.sin(t * 3 + k) * 0.3})`);
  }
}
function fundoCastelo(g, cam, t) {
  degrade(g, [[0, '#120a0c'], [0.6, '#22100f'], [1, '#3a140c']]);
  const d = (cam * 0.5) % 32;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let r = 0; r < 18; r++) {
    g.fillRect(0, r * 16, W, 1);
    for (let x = -(d + (r % 2) * 16); x < W; x += 32) g.fillRect(x, r * 16, 1, 16);
  }
  repetir(cam * 0.5, 260, (x, i) => {
    const wx = x + 90;
    g.fillStyle = '#141a3a';
    g.beginPath(); g.moveTo(wx, 140); g.lineTo(wx, 90); g.arc(wx + 14, 90, 14, Math.PI, 0); g.lineTo(wx + 28, 140); g.fill();
    elipse(g, wx + 18, 88, 4, 4, '#f0e6c0');
    estrelinha(g, wx + 8, 104, 1.4, '#f0e6c0');
    estrelinha(g, wx + 20, 120, 1.1, '#f0e6c0');
    g.fillStyle = '#2a1a1b';
    for (let k = 1; k < 3; k++) g.fillRect(wx + k * 9.3, 76, 1.5, 64);
    g.strokeStyle = '#4a3533'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(wx, 140); g.lineTo(wx, 90); g.arc(wx + 14, 90, 14, Math.PI, 0); g.lineTo(wx + 28, 140); g.stroke();
    if (hash(i) < 0.6) estandarte(g, wx + 140, 70, 1);
  });
  const lava = g.createLinearGradient(0, 150, 0, H);
  lava.addColorStop(0, 'rgba(255,90,20,0)');
  lava.addColorStop(1, 'rgba(255,90,20,0.35)');
  g.fillStyle = lava; g.fillRect(0, 150, W, H - 150);
  for (let k = 0; k < 18; k++) {
    const x = mod(hash(k) * W * 1.3 - cam * 0.6 + Math.sin(t + k) * 10, W);
    const y = H - mod(t * 25 * (0.5 + hash(k + 2)) + hash(k + 9) * H, H);
    elipse(g, x, y, 1.1, 1.1, `rgba(255,${140 + Math.floor(hash(k + 3) * 80)},60,0.7)`);
  }
}

/* Enfeites da fase */
function estandarte(g, x, y, s) {
  if (sprite(g, 'estandarte', 'parado', x, y - 2, { escala: s })) return;
  pintarEstandarte(g, x, y, s);
}
function pintarEstandarte(g, x, y, s) {
  g.fillStyle = '#c9a46b'; g.fillRect(x - 10 * s, y - 2, 20 * s, 2);
  g.fillStyle = '#7e1c1c';
  g.beginPath(); g.moveTo(x - 8 * s, y); g.lineTo(x + 8 * s, y); g.lineTo(x + 8 * s, y + 36 * s); g.lineTo(x, y + 30 * s); g.lineTo(x - 8 * s, y + 36 * s); g.fill();
  g.fillStyle = '#d8743a';
  g.beginPath(); g.moveTo(x - 4.5 * s, y + 10 * s); g.lineTo(x - 3 * s, y + 5 * s); g.lineTo(x - 1 * s, y + 9 * s); g.lineTo(x + 1 * s, y + 9 * s); g.lineTo(x + 3 * s, y + 5 * s); g.lineTo(x + 4.5 * s, y + 10 * s); g.lineTo(x, y + 18 * s); g.fill();
  elipse(g, x - 1.6 * s, y + 11.5 * s, 0.7 * s, 0.7 * s, '#f4dd80');
  elipse(g, x + 1.6 * s, y + 11.5 * s, 0.7 * s, 0.7 * s, '#f4dd80');
}
function desenharEnfeites(g, base, cam, t) {
  for (const d of base.deco) {
    if (d.x < cam - 70 || d.x > cam + W + 70) continue;
    if (!spriteEnfeite(g, d, t)) pintarEnfeite(g, d, t);
  }
}
const TAM_ARVORE = 28; // a árvore da prévia (as da fase vão de 22 a 34)
const TAM_ESTALACTITE = 18;
const TAM_CIPO = 40;
// Enfeite com sprite enviado (devolve false sem sprite). As fases de "sin(t + x)" viram tempo: t + x / velocidade.
function spriteEnfeite(g, d, t) {
  const { x, y } = d;
  switch (d.tp) {
    case 'arvore': return sprite(g, 'arvore', 'parada', x, y, { escala: d.tam / TAM_ARVORE });
    case 'arbusto': return sprite(g, 'arbusto', ['pequeno', 'medio', 'grande'][d.tam - 1] || 'grande', x + d.tam * 0.5, y, { t });
    case 'flores': return sprite(g, 'flores', 'paradas', x, y, { quadro: d.cor });
    case 'capim': return sprite(g, 'capim', 'balancando', x, y, { t: t + x / 2 });
    case 'cristal': return sprite(g, 'cristal', ['azul', 'roxo', 'verde'][d.cor] || 'azul', x, y, { t: t + x / 2 });
    case 'cogumelo': return sprite(g, 'cogumelo', 'brilhando', x, y, { t: t + x / 2 });
    case 'estalactite':
      if (!sprite(g, 'estalactite', 'parada', x, y, { t, escala: d.tam / TAM_ESTALACTITE })) return false;
      pingo(g, d, t);
      return true;
    case 'cipo': return sprite(g, 'cipo', 'balancando', x, y, { t, escala: d.tam / TAM_CIPO });
    case 'tocha':
      if (!temPeca('tocha')) return false;
      brilhoTocha(g, x, y);
      return sprite(g, 'tocha', 'acesa', x, y + 10, { t: t + x / 13 });
    case 'corrente':
      if (!temPeca('corrente')) return false;
      for (let k = 0; k < d.tam / 5; k++) sprite(g, 'corrente', 'parada', x, y + k * 5, { quadro: k });
      return true;
    case 'estandarte': return sprite(g, 'estandarte', 'parado', x, y + 2, { t });
    default: return false;
  }
}
const CORES_FLORES = ['#f0a0c0', '#f4dd80', '#a8d8f0', '#ffffff'];
function pingo(g, d, t) {
  const ciclo = (t * 0.6 + hash(d.x) * 5) % 3;
  if (ciclo < 1) elipse(g, d.x, d.y + d.tam + ciclo * ciclo * 140, 0.9, 1.6, 'rgba(150,200,255,0.7)');
}
function brilhoTocha(g, x, y) {
  const brilho = g.createRadialGradient(x, y - 5, 1, x, y - 5, 30);
  brilho.addColorStop(0, 'rgba(255,180,80,0.35)');
  brilho.addColorStop(1, 'rgba(255,180,80,0)');
  g.fillStyle = brilho; g.fillRect(x - 30, y - 35, 60, 60);
}
// O enfeite desenhado por código. semBrilho/semPingo: para a prévia (o jogo põe por cima do sprite).
function pintarEnfeite(g, d, t, { semBrilho = false, semPingo = false } = {}) {
  const CORES = CORES_FLORES;
  {
    const { x, y } = d;
    switch (d.tp) {
      case 'arvore': desenharArvore(g, x, y - d.tam * 0.55, d.tam, () => hash(x)); break;
      case 'arbusto':
        for (let k = 0; k <= d.tam; k++) elipse(g, x + k * 11 - d.tam * 5, y - 5, 9, 8, k % 2 ? '#3f9a3e' : '#47a845');
        for (let k = 0; k <= d.tam; k++) elipse(g, x + k * 11 - d.tam * 5 - 2, y - 9, 3.5, 2.2, '#73c763');
        break;
      case 'flores':
        g.fillStyle = '#3f8f37';
        for (let k = -1; k <= 1; k++) {
          g.fillRect(x + k * 4, y - 6 + Math.abs(k), 0.8, 6 - Math.abs(k));
          elipse(g, x + k * 4 + 0.4, y - 6.5 + Math.abs(k), 1.8, 1.8, CORES[(d.cor + k + 3) % 4]);
          elipse(g, x + k * 4 + 0.4, y - 6.5 + Math.abs(k), 0.6, 0.6, '#f4dd80');
        }
        break;
      case 'capim':
        g.fillStyle = '#4aa33d';
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 3 - 1.5, y); g.lineTo(x + k * 4 + Math.sin(t * 2 + x) * 0.8, y - 6 - (k ? 0 : 2)); g.lineTo(x + k * 3 + 1.5, y); g.fill(); }
        break;
      case 'cerca':
        g.fillStyle = '#c9a46b';
        g.fillRect(x - 6, y - 9, 36, 2); g.fillRect(x - 6, y - 5, 36, 2);
        g.fillStyle = '#a07a4a';
        for (let k = 0; k < 3; k++) g.fillRect(x - 6 + k * 16, y - 12, 3, 12);
        break;
      case 'cristal': {
        const cores = [['#6ee7ff', '#2aa9d6'], ['#c79bff', '#8a5ad6'], ['#7dffb0', '#2fae6c']][d.cor];
        const a = 0.25 + Math.sin(t * 2 + x) * 0.1;
        elipse(g, x, y - 6, 12, 9, `${cores[0]}33`);
        for (const [ox, h, rot] of [[-3, 9, -0.3], [0, 13, 0], [3.5, 8, 0.35]]) {
          g.save(); g.translate(x + ox, y); g.rotate(rot);
          g.fillStyle = cores[1]; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-2, -h + 3); g.lineTo(0, -h); g.lineTo(2, -h + 3); g.lineTo(2, 0); g.fill();
          g.fillStyle = cores[0]; g.globalAlpha = 0.6 + a; g.fillRect(-1.2, -h + 3, 1, h - 3); g.globalAlpha = 1;
          g.restore();
        }
        break;
      }
      case 'cogumelo':
        g.fillStyle = '#e8dcc8'; g.fillRect(x - 1, y - 5, 2, 5);
        g.fillStyle = '#4fc3d9'; g.beginPath(); g.ellipse(x, y - 5, 4.5, 3.5, 0, Math.PI, 0); g.fill();
        elipse(g, x - 1.5, y - 7, 0.8, 0.8, 'rgba(255,255,255,0.8)');
        elipse(g, x, y - 5, 7, 5, `rgba(79,195,217,${0.12 + Math.sin(t * 2 + x) * 0.05})`);
        break;
      case 'estalactite': {
        g.fillStyle = '#26324d';
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y + d.tam); g.lineTo(x + 4, y); g.fill();
        g.fillStyle = '#34446a'; g.fillRect(x - 3, y, 1.4, d.tam * 0.5);
        if (!semPingo) pingo(g, d, t);
        break;
      }
      case 'cipo':
        g.strokeStyle = '#3f7a3a'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 1; k <= 6; k++) g.lineTo(x + Math.sin(k * 1.3 + t * 1.5) * 2, y + (d.tam * k) / 6);
        g.stroke();
        for (let k = 1; k <= 4; k++) elipse(g, x + (k % 2 ? 2.5 : -2.5), y + (d.tam * k) / 5, 2.4, 1.3, '#4f9a45', k % 2 ? 0.5 : -0.5);
        break;
      case 'tocha': {
        g.fillStyle = '#3a2a1e'; g.fillRect(x - 1.5, y, 3, 10); g.fillRect(x - 4, y - 1, 8, 2);
        if (!semBrilho) brilhoTocha(g, x, y);
        const f = Math.sin(t * 13 + x) * 0.8;
        elipse(g, x, y - 5, 3.4, 6 + f, '#ff7a1a');
        elipse(g, x, y - 4, 1.8, 3.5 + f * 0.5, '#ffe08a');
        break;
      }
      case 'corrente':
        g.strokeStyle = '#5a5450'; g.lineWidth = 1;
        for (let k = 0; k < d.tam / 5; k++) { g.beginPath(); g.ellipse(x, y + k * 5 + 2.5, k % 2 ? 0.8 : 1.8, 2.6, 0, 0, Math.PI * 2); g.stroke(); }
        break;
      case 'estandarte': pintarEstandarte(g, x, y + 4, 1); break;
      default: break;
    }
  }
}

function desenharCopa(g, cp, t) {
  const x = cp.c * T;
  const y = cp.r * T;
  const w = cp.len * T;
  const tw = Math.min(26, w * 0.4);
  if (temPeca('copa-tronco')) {
    // Pedaços do tronco um embaixo do outro, até o fim da tela (mais finos nas copas pequenas).
    const k = tw / 26;
    for (let yy = y + 8; yy < H; yy += 16 * k) sprite(g, 'copa-tronco', 'parado', x + w / 2, yy, { escala: k });
  } else pintarTroncoCopa(g, cp);
  if (temPeca('copa')) {
    for (let k = 0; k < cp.len; k++) {
      const anim = cp.len === 1 ? 'meio' : k === 0 ? 'esquerda' : k === cp.len - 1 ? 'direita' : 'meio';
      sprite(g, 'copa', escolher('copa', [anim, 'meio']), x + k * T + 8, y + 9, { t });
    }
  } else pintarFolhasCopa(g, cp, t);
}
function pintarTroncoCopa(g, cp) {
  const x = cp.c * T;
  const y = cp.r * T;
  const w = cp.len * T;
  const tw = Math.min(26, w * 0.4);
  const tx = x + w / 2 - tw / 2;
  g.fillStyle = '#5b3c22'; g.fillRect(tx, y + 8, tw, H - y);
  g.fillStyle = '#6f4b2c'; g.fillRect(tx + 3, y + 8, 4, H - y);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(tx + tw - 6, y + 8, 6, H - y);
  g.fillStyle = '#4a301b';
  for (let k = 0; k < 6; k++) g.fillRect(tx + 6 + hash(cp.c + k) * (tw - 10), y + 22 + k * 30, 2, 9);
}
function pintarFolhasCopa(g, cp, t) {
  const x = cp.c * T;
  const y = cp.r * T;
  const w = cp.len * T;
  g.fillStyle = '#255a2c';
  retArred(g, x - 2, y + 3, w + 4, 15, 7);
  g.fill();
  for (let k = 0; k <= cp.len * 2; k++) elipse(g, x + k * 8, y + 4, 6.5, 5.5, k % 2 ? '#3f8f45' : '#378640');
  for (let k = 0; k <= cp.len * 2; k++) elipse(g, x + k * 8 + 1.5, y + 1.6, 3, 1.8, '#6cc066');
  for (let k = 0; k < cp.len; k++) if (hash(cp.c * 3 + k) < 0.35) elipse(g, x + k * 16 + 8, y + 9 + Math.sin(t * 2 + k), 1.4, 1.4, '#f0a0c0');
  elipse(g, x + w / 2, y + 17, w / 2, 2.5, 'rgba(0,0,0,0.18)');
}
function desenharTronco(g, tr) {
  if (temPeca('tronco')) {
    sprite(g, 'tronco', 'topo', tr.c * T + 16, tr.topo * T);
    for (let r = tr.topo + 1; r < tr.base; r++) sprite(g, 'tronco', 'meio', tr.c * T + 16, r * T);
    return;
  }
  pintarTronco(g, tr);
}
function pintarTronco(g, tr) {
  const x = tr.c * T;
  const y = tr.topo * T;
  const fundo = tr.base * T;
  g.fillStyle = '#6b4528'; g.fillRect(x + 2, y + 8, 28, fundo - y - 8);
  g.fillStyle = '#54351d';
  for (const gx of [8, 15, 22]) g.fillRect(x + gx, y + 16, 1.6, fundo - y - 16);
  g.fillStyle = '#87593a'; g.fillRect(x + 4, y + 12, 3, fundo - y - 12);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 24, y + 12, 6, fundo - y - 12);
  g.fillStyle = '#7d5232'; retArred(g, x, y + 2, 32, 14, 3); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y + 13, 32, 3);
  elipse(g, x + 16, y + 5, 15, 4.5, '#c99a6b');
  elipse(g, x + 16, y + 5, 12, 3.4, '#a47a4f');
  elipse(g, x + 16, y + 5.5, 10, 2.7, '#24160c');
  elipse(g, x + 5, y + 3, 4, 1.8, '#5f9a3f');
  elipse(g, x + 27, y + 2.6, 3, 1.5, '#6cad48');
}

/* Fim da fase: castelinho, mastro, marco do meio, alavanca e princesa */
function desenharCastelinho(g, def, F, tema) {
  const x = def.castelo * T;
  const chao = TOPO * T;
  if (!spriteExato(g, 'castelinho', paleta(tema), x + 40, chao)) pintarCastelinho(g, x, chao, tema);
  // A bandeirinha sobe na contagem (desenhada por cima do sprite também).
  const sobe = F.m === 'contagem' ? Math.min(1, F.tm / 1.2) : 0;
  g.fillStyle = '#5a4a3a'; g.fillRect(x + 39.5, chao - 160, 1.5, 24);
  const by = chao - 140 - sobe * 18;
  g.fillStyle = '#2f6b34';
  g.beginPath(); g.moveTo(x + 41, by); g.lineTo(x + 56, by + 4); g.lineTo(x + 41, by + 8); g.fill();
  elipse(g, x + 46, by + 4, 1.6, 1.6, '#e8c24a');
}
function pintarCastelinho(g, x, chao, tema) {
  const [pedra, escura, clara] = TEMAS[tema].castelo;
  g.fillStyle = pedra; g.fillRect(x, chao - 80, 80, 80);
  for (let k = 0; k < 5; k++) g.fillRect(x + k * 16 + 2, chao - 88, 12, 8);
  g.fillRect(x + 20, chao - 128, 40, 48);
  for (let k = 0; k < 3; k++) g.fillRect(x + 21 + k * 14, chao - 136, 10, 8);
  g.fillStyle = escura;
  for (let r = 1; r < 8; r++) g.fillRect(x, chao - r * 11, 80, 1);
  for (let r = 1; r < 4; r++) g.fillRect(x + 20, chao - 80 - r * 12, 40, 1);
  g.fillStyle = clara; g.fillRect(x, chao - 80, 80, 1.5); g.fillRect(x + 20, chao - 128, 40, 1.5);
  g.fillStyle = '#1b120c';
  g.beginPath(); g.moveTo(x + 30, chao); g.lineTo(x + 30, chao - 18); g.arc(x + 40, chao - 18, 10, Math.PI, 0); g.lineTo(x + 50, chao); g.fill();
  g.fillRect(x + 37, chao - 116, 6, 12);
  g.fillRect(x + 8, chao - 62, 6, 10); g.fillRect(x + 66, chao - 62, 6, 10);
}
function desenharMastro(g, def, bandeiraY, t) {
  const x = def.mastro * T + 8;
  if (!sprite(g, 'mastro', 'parado', x, BASE_MASTRO, { t })) pintarPoste(g, x);
  if (!sprite(g, 'bandeira', 'tremulando', x - 12.5, bandeiraY + 8, { t })) pintarBandeira(g, x, bandeiraY, t);
}
function pintarPoste(g, x) {
  g.fillStyle = '#9aa88e'; g.fillRect(x - 1.5, POSTE_TOPO, 3, BASE_MASTRO - POSTE_TOPO);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 1.2, POSTE_TOPO, 1, BASE_MASTRO - POSTE_TOPO);
  elipse(g, x, POSTE_TOPO - 2, 4, 4, '#e8c24a');
  elipse(g, x - 1.2, POSTE_TOPO - 3.2, 1.4, 1.4, '#fff3c4');
}
function pintarBandeira(g, x, y, t) {
  const onda = k => Math.sin(t * 6 + k * 0.4) * 1.4 * (k / 22);
  g.fillStyle = '#2f6b34';
  g.beginPath();
  g.moveTo(x - 1.5, y);
  for (let k = 0; k <= 22; k += 2) g.lineTo(x - 1.5 - k, y + onda(k) + k * 0.36);
  for (let k = 22; k >= 0; k -= 2) g.lineTo(x - 1.5 - k, y + 16 + onda(k) - k * 0.36);
  g.closePath();
  g.fill();
  // Coelhinho coroado, o símbolo da Casa Luckham
  elipse(g, x - 9, y + 9 + onda(8), 3.4, 3, '#ece0bf');
  elipse(g, x - 10.5, y + 4.5 + onda(8), 1, 2.6, '#ece0bf', -0.2);
  elipse(g, x - 8, y + 4.3 + onda(8), 1, 2.6, '#ece0bf', 0.2);
  g.fillStyle = '#e8c24a'; g.fillRect(x - 11.5, y + 5.6 + onda(8), 5, 1.4);
}
function desenharMarco(g, def, ok, t) {
  const x = def.meio.c * T + 8;
  const y = def.meio.r * T;
  if (!sprite(g, 'marco', ok ? 'aceso' : 'apagado', x, y, { t })) pintarMarco(g, x, y, ok, t);
}
function pintarMarco(g, x, y, ok, t) {
  g.fillStyle = '#7a5232'; g.fillRect(x - 1, y - 26, 2, 26);
  const cor = ok ? '#e8c24a' : '#8d8a80';
  const onda = Math.sin(t * 5) * (ok ? 1.5 : 0.4);
  g.fillStyle = cor;
  g.beginPath(); g.moveTo(x + 1, y - 26); g.lineTo(x + 12, y - 22 + onda); g.lineTo(x + 1, y - 17); g.fill();
  if (ok) estrelinha(g, x + 6, y - 31, 1.6 + Math.sin(t * 6), '#fff3c4');
}
function desenharAlavanca(g, def, puxada, t) {
  const x = def.alavanca.c * T + 8;
  const y = def.alavanca.r * T;
  if (!sprite(g, 'alavanca', puxada ? 'puxada' : 'parada', x, y, { t })) pintarAlavanca(g, x, y, puxada, t);
}
function pintarAlavanca(g, x, y, puxada, t) {
  g.fillStyle = '#5a5450'; g.fillRect(x - 6, y - 7, 12, 7);
  g.fillStyle = '#837c75'; g.fillRect(x - 6, y - 7, 12, 1.5);
  g.save();
  g.translate(x, y - 6);
  g.rotate(puxada ? 0.7 : -0.5);
  g.fillStyle = '#8a6a3a'; g.fillRect(-1.2, -18, 2.4, 18);
  elipse(g, 0, -19, 3.5, 3.5, '#d8342a');
  elipse(g, -1, -20, 1.2, 1.2, '#ff9a8a');
  g.restore();
  if (!puxada) {
    const a = 0.3 + Math.sin(t * 4) * 0.2;
    elipse(g, x - 6, y - 26, 2, 2, `rgba(255,240,170,${a})`);
  }
}
function desenharPrincesa(g, x, y, t, feliz) {
  const pula = feliz ? Math.abs(Math.sin(t * 5)) * 3 : 0;
  elipse(g, x, y + 1, 9, 2.5, 'rgba(0,0,0,0.25)');
  g.save();
  g.translate(x, y - pula);
  elipse(g, -3, -1.5, 2.6, 1.6, '#c4561f');
  elipse(g, 3, -1.5, 2.6, 1.6, '#c4561f');
  g.fillStyle = '#f08a2c';
  g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(-13, -13, -11, -31, 0, -31); g.bezierCurveTo(11, -31, 13, -13, 0, -2); g.fill();
  elipse(g, -4, -22, 2.5, 6, 'rgba(255,255,255,0.18)', 0.2);
  g.strokeStyle = '#c4561f'; g.lineWidth = 0.9;
  for (const [ly, lw] of [[-12, 4], [-17, 5], [-8, 3]]) { g.beginPath(); g.moveTo(lw * 0.3, ly); g.lineTo(lw, ly - 1); g.stroke(); }
  g.fillStyle = '#e05a8a'; g.fillRect(-8.5, -15, 17, 3);
  elipse(g, 6, -13.5, 2.4, 2, '#b83a68');
  elipse(g, -3, -23, 1.3, 1.7, '#1b1403');
  elipse(g, 3, -23, 1.3, 1.7, '#1b1403');
  elipse(g, -2.6, -23.6, 0.45, 0.45, '#fff');
  elipse(g, 3.4, -23.6, 0.45, 0.45, '#fff');
  elipse(g, -5.4, -20.4, 1.8, 1.1, 'rgba(233,90,110,0.45)');
  elipse(g, 5.4, -20.4, 1.8, 1.1, 'rgba(233,90,110,0.45)');
  g.strokeStyle = '#7a2a12'; g.lineWidth = 0.8;
  g.beginPath(); g.arc(0, -20.5, 1.6, 0.2, Math.PI - 0.2); g.stroke();
  const aceno = feliz ? Math.sin(t * 10) * 0.6 : 0.2;
  g.strokeStyle = '#d0702a'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-8, -15); g.lineTo(-12, -11); g.stroke();
  g.beginPath(); g.moveTo(8, -15); g.lineTo(8 + Math.cos(-1.2 - aceno) * 6, -15 + Math.sin(-1.2 - aceno) * 6); g.stroke();
  for (const [ox, rot] of [[-4, -0.6], [0, 0], [4, 0.6], [-2, -0.3], [2, 0.3]]) elipse(g, ox, -35, 2, 6, rot ? '#4fa04f' : '#3f8f45', rot);
  g.fillStyle = '#e8c24a';
  g.beginPath(); g.moveTo(-5, -31); g.lineTo(-5, -36); g.lineTo(-2.5, -33.5); g.lineTo(0, -38); g.lineTo(2.5, -33.5); g.lineTo(5, -36); g.lineTo(5, -31); g.closePath(); g.fill();
  elipse(g, 0, -33, 0.9, 0.9, '#d8674a');
  g.restore();
}

/* Personagens */
// vis (junto): { pelo, roupa } do Club Coelho; sem vis, o coelho de sempre (a roupa mostra o poder).
function desenharJogador(g, F, t, vis) {
  const [x, y, forma, dir, bits, , estrela, inv] = F.j;
  if (bits & 8) return;
  const morto = bits & 32;
  if (!morto && inv > 0 && Math.floor(t * 18) % 2 === 0) return;
  const hAtual = forma > 0 ? (bits & 1 ? AGACHADO : GRANDE) : PEQUENO;
  if (!spriteJogador(g, F.j, t, vis)) corpoJogador(g, F.j, t, vis);
  if (bits & 16) elipse(g, x + 6 + dir * 10, y + 8, 3.5, 3.5, 'rgba(255,200,90,0.85)');
  if (estrela > 0) {
    for (let k = 0; k < 3; k++) {
      const a = t * 6 + k * 2.1;
      estrelinha(g, x + 6 + Math.cos(a) * 12, y + hAtual / 2 + Math.sin(a) * 14, 2, '#fff6c0');
    }
  }
}
// O coelho com sprite: a peça de cada tamanho e poder (a da estrela, se foi enviada), com o pé no pé do coelho.
// Pinta com o pelo de cada um no jogo junto (e com o arco-íris na estrela) se o sprite foi enviado para pintar.
function spriteJogador(g, jj, t, vis) {
  const [x, y, forma, dir, bits, passo, estrela, , crescer, vx] = jj;
  const morto = bits & 32;
  const chao = bits & 2;
  const hAtual = forma > 0 ? (bits & 1 ? AGACHADO : GRANDE) : PEQUENO;
  let grande = forma > 0;
  if (crescer > 0) grande = Math.floor(crescer * 12) % 2 === 0;
  const estrelado = estrela > 0 && temPeca('coelho-estrela');
  const peca = estrelado ? 'coelho-estrela' : !grande ? 'coelho-pequeno' : forma === 2 ? 'coelho-fogo' : 'coelho-grande';
  if (!temPeca(peca)) return false;
  const lista = morto ? ['morrendo'] : grande && bits & 1 ? ['abaixado', 'parado']
    : !chao ? (bits & 64 ? ['pulando'] : ['caindo', 'pulando'])
      : vx * dir < -30 ? ['derrapando', 'andando'] : Math.abs(vx) > 8 ? ['andando'] : ['parado'];
  let anim = escolher(peca, lista);
  const o = { t: anim === 'andando' || anim === 'derrapando' ? passo : t, dir, cor: estrela > 0 ? ARCO_IRIS[Math.floor(t * 14) % ARCO_IRIS.length] : vis?.pelo || null };
  if (estrelado && !grande) Object.assign(o, { largura: 20, altura: 24 });
  let py = y + hAtual;
  // Sem o sprite de morrer: o parado de cabeça para baixo, virado em volta do mesmo ponto do desenho de sempre.
  if (morto && bits & 4 && !enviada(peca, 'morrendo')) { anim = 'parado'; py -= 22; o.rot = Math.PI; o.dir = -dir; }
  return sprite(g, peca, anim, x + LARG / 2, py, o);
}
// O coelho desenhado por código (sem as estrelinhas da estrela nem o brilho do tiro, que vão por cima de tudo).
// semSprite: a prévia não usa o sprite "coelho" de todos os jogos (o desenho daqui de dentro usa, como sempre).
function corpoJogador(g, jj, t, vis, semSprite = false) {
  const [x, y, forma, dir, bits, passo, estrela, , crescer, vx] = jj;
  const morto = bits & 32;
  const hAtual = forma > 0 ? (bits & 1 ? AGACHADO : GRANDE) : PEQUENO;
  let grande = forma > 0;
  if (crescer > 0) grande = Math.floor(crescer * 12) % 2 === 0;
  const chao = bits & 2;
  let pelo = '#e9dcc3';
  let roupa = {};
  if (forma === 1) { pelo = '#d9b48a'; roupa = { pescoco: 'cachecol' }; }
  if (forma === 2) { pelo = '#f7f3ea'; roupa = { cabeca: 'coroa', costas: 'capa' }; }
  if (vis) { if (vis.pelo) pelo = vis.pelo; if (vis.roupa) roupa = vis.roupa; }
  if (estrela > 0) pelo = ARCO_IRIS[Math.floor(t * 14) % ARCO_IRIS.length];
  const sx = grande ? 0.58 : 0.42;
  const sy = grande ? (bits & 1 ? 0.4 : 0.72) : 0.42;
  g.save();
  g.translate(x + LARG / 2, y + hAtual);
  if (bits & 4) { const c = 11; g.translate(0, -c); g.scale(1, -1); g.translate(0, c); }
  else if (!chao && !morto) g.rotate(dir * (bits & 64 ? -0.12 : 0.08));
  else if (chao && vx * dir < -30) g.rotate(-dir * 0.18);
  g.scale(sx, sy);
  if (forma === 2 || estrela > 0) elipse(g, 0, -24, 24, 28, estrela > 0 ? 'rgba(255,240,150,0.22)' : 'rgba(255,150,70,0.16)');
  desenharCoelho(g, -2 * dir, 0, { pelo, roupa, dir, passo, andando: !!chao && Math.abs(vx) > 8 && !morto, t, semSprite });
  g.restore();
}

function desenharTatu(g, x, y, dir, passo, est, tt, tf) {
  if (est === 'c' || est === 'k') {
    const tremer = est === 'c' && tt > 5.5 ? Math.sin(tf * 60) : 0;
    const cx = x + 7 + tremer;
    const cy = y + 6;
    const ang = est === 'k' ? x / 6 : 0;
    elipse(g, cx, cy, 7, 6.5, '#8a7a66');
    elipse(g, cx - 1.5, cy - 2, 4.5, 3, '#a8987f');
    g.fillStyle = '#5e5142';
    for (let k = 0; k < 4; k++) {
      const a = ang + k * 1.57;
      if (Math.cos(a) > 0) g.fillRect(cx + Math.sin(a) * 5.5 - 0.6, cy - 5.5 + Math.abs(Math.sin(a)) * 2, 1.2, 11 - Math.abs(Math.sin(a)) * 4);
    }
    if (est === 'c' && tt > 4.5) { elipse(g, cx - 2, cy + 1, 0.8, 0.8, '#1b1403'); elipse(g, cx + 2, cy + 1, 0.8, 0.8, '#1b1403'); }
    return;
  }
  g.save();
  if (est === 'x') { g.translate(x + 7, y); g.scale(dir, -1); } else { g.translate(x + 7, y + 14); g.scale(dir, 1); }
  const p = Math.sin(passo * 10) * 1.5;
  g.fillStyle = '#5e5142'; g.fillRect(-5 + p, -3, 2.5, 3); g.fillRect(3 - p, -3, 2.5, 3);
  g.fillStyle = '#7a6a56'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(-11, -2); g.lineTo(-7, -2.5); g.fill();
  g.fillStyle = '#8a7a66'; g.beginPath(); g.ellipse(0, -3, 8, 9, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#6e604f';
  for (const bx of [-4, 0, 4]) g.fillRect(bx - 0.5, -11 + Math.abs(bx) * 0.5, 1, 8 - Math.abs(bx) * 0.5);
  elipse(g, -2, -9, 3.5, 1.4, '#a8987f');
  elipse(g, 7.5, -4, 3.6, 3, '#b5a48a');
  elipse(g, 10.5, -3.5, 2.2, 1.6, '#c9b89c');
  elipse(g, 6.5, -8, 1.3, 2.2, '#9c8a70', 0.3);
  elipse(g, 8.4, -5, 0.8, 0.8, '#1b1403');
  elipse(g, 12.5, -3.6, 0.7, 0.7, '#1b1403');
  g.restore();
}
function desenharOurico(g, x, y, dir, passo, virado) {
  g.save();
  if (virado) { g.translate(x + 7, y); g.scale(dir, -1); } else { g.translate(x + 7, y + 12 - Math.abs(Math.sin(passo * 9)) * 1.2); g.scale(dir, 1); }
  g.fillStyle = '#3a271b';
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + 0.25 + (k / 6) * (Math.PI - 0.6);
    g.beginPath();
    g.moveTo(-1 + Math.cos(a - 0.3) * 5, -5 + Math.sin(a - 0.3) * 4);
    g.lineTo(-1 + Math.cos(a) * 10, -5 + Math.sin(a) * 8.5);
    g.lineTo(-1 + Math.cos(a + 0.3) * 5, -5 + Math.sin(a + 0.3) * 4);
    g.fill();
  }
  elipse(g, -1, -5, 7.5, 5.5, '#6e4a30');
  elipse(g, -2.5, -7, 3.5, 1.6, '#86603f');
  elipse(g, 5, -4, 3.6, 3, '#e3c9a0');
  elipse(g, 8.4, -4.2, 1, 1, '#1b1403');
  elipse(g, 5.4, -5.2, 0.8, 0.8, '#1b1403');
  elipse(g, -3, -0.6, 1.6, 1, '#4a3324');
  elipse(g, 3, -0.6, 1.6, 1, '#4a3324');
  g.restore();
}
function desenharMorcego(g, x, y, est, dir, t) {
  const cx = x + 7;
  const cy = y + 5;
  g.save();
  if (est === 'x') { g.translate(cx, cy); g.scale(1, -1); g.translate(-cx, -cy); }
  if (est === 'd') {
    elipse(g, cx, cy + 1, 3.6, 5.5, '#3a2a4a');
    g.fillStyle = '#3a2a4a';
    g.beginPath(); g.moveTo(cx - 3, cy + 5); g.lineTo(cx - 2, cy + 9); g.lineTo(cx - 0.5, cy + 6); g.lineTo(cx + 0.5, cy + 6); g.lineTo(cx + 2, cy + 9); g.lineTo(cx + 3, cy + 5); g.fill();
    g.fillStyle = '#c9b8d8'; g.fillRect(cx - 2, cy + 3.5, 1.4, 0.5); g.fillRect(cx + 0.6, cy + 3.5, 1.4, 0.5);
  } else {
    const bate = Math.sin(t * 18) * 5;
    g.fillStyle = '#4a3560';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(cx, cy - 1); g.lineTo(cx + s * 12, cy - 3 - bate); g.lineTo(cx + s * 9, cy + 1); g.lineTo(cx + s * 6, cy - 0.5); g.lineTo(cx + s * 4, cy + 2.5); g.closePath(); g.fill();
    }
    elipse(g, cx, cy, 4.2, 4.2, '#3a2a4a');
    g.fillStyle = '#3a2a4a';
    g.beginPath(); g.moveTo(cx - 3.5, cy - 2); g.lineTo(cx - 2.5, cy - 6.5); g.lineTo(cx - 0.8, cy - 3); g.lineTo(cx + 0.8, cy - 3); g.lineTo(cx + 2.5, cy - 6.5); g.lineTo(cx + 3.5, cy - 2); g.fill();
    elipse(g, cx - 1.5 + dir * 0.5, cy - 0.5, 0.9, 0.9, '#ffd25a');
    elipse(g, cx + 1.5 + dir * 0.5, cy - 0.5, 0.9, 0.9, '#ffd25a');
  }
  g.restore();
}
function desenharInimigo(g, e, tf, t) {
  if (spriteInimigo(g, e, tf, t)) return;
  pintarInimigo(g, e, tf, t);
}
// semSprite: a prévia não usa o sprite "raposa" de todos os jogos.
function pintarInimigo(g, e, tf, t, semSprite = false) {
  const [tp, x, y, est, dir, tt, id] = e;
  const passo = tf + id * 0.37;
  if (tp === 'r') {
    g.save();
    if (est === 'p') { g.translate(x + 7, y + 12); g.scale(0.34, 0.12); desenharRaposa(g, 0, 0, { dir, t, semSprite }); }
    else if (est === 'x') { g.translate(x + 7, y); g.scale(0.3, -0.3); desenharRaposa(g, 0, 0, { dir, t, semSprite }); }
    else { g.translate(x + 7, y + 12); g.scale(0.3, 0.3); desenharRaposa(g, 0, 0, { dir, passo, andando: true, t, semSprite }); }
    g.restore();
  } else if (tp === 't') desenharTatu(g, x, y, dir, passo, est, tt, tf);
  else if (tp === 'o') desenharOurico(g, x, y, dir, passo, est === 'x');
  else desenharMorcego(g, x, y, est, dir, t);
}
// Inimigo com sprite (devolve false sem sprite). O pé fica no pé do desenho de sempre.
function spriteInimigo(g, e, tf, t) {
  const [tp, x, y, est, dir, tt, id] = e;
  const passo = tf + id * 0.37;
  if (tp === 'r') {
    if (!temPeca('raposinho')) return false;
    if (est === 'x') return derrotado(g, 'raposinho', 'andando', x + 7, y, 12, { t, dir });
    if (est !== 'p') return sprite(g, 'raposinho', 'andando', x + 7, y + 12, { t: passo, dir });
    if (enviada('raposinho', 'achatado')) return sprite(g, 'raposinho', 'achatado', x + 7, y + 12, { t, dir });
    // Sem o sprite achatado: o de andar amassado, como o desenho de sempre.
    g.save();
    g.translate(x + 7, y + 12);
    g.scale(0.34 / 0.3, 0.12 / 0.3);
    sprite(g, 'raposinho', 'andando', 0, 0, { t, dir });
    g.restore();
    return true;
  }
  if (tp === 't' && (est === 'c' || est === 'k')) {
    if (!temPeca('tatu-bolinha')) return false;
    const tremer = est === 'c' && tt > 5.5 ? Math.sin(tf * 60) : 0;
    const cx = x + 7 + tremer;
    const cy = y + 6;
    if (est === 'c') return sprite(g, 'tatu-bolinha', tt > 4.5 ? escolher('tatu-bolinha', ['acordando', 'parado']) : 'parado', cx, cy, { t });
    // Rolando: com vários quadros, uma volta inteira a cada 6 x 2π de caminho; com um quadro só, o sprite gira.
    const s = spriteDe(SC + 'tatu-bolinha', 'rolando');
    if (s && s.quadros > 1) return sprite(g, 'tatu-bolinha', 'rolando', cx, cy, { quadro: Math.floor((x / 6 / (Math.PI * 2)) * s.quadros) });
    return sprite(g, 'tatu-bolinha', 'rolando', cx, cy, { rot: x / 6 });
  }
  if (tp === 't') {
    if (!temPeca('tatu')) return false;
    if (est === 'x') return derrotado(g, 'tatu', 'andando', x + 7, y, 14, { t, dir });
    return sprite(g, 'tatu', 'andando', x + 7, y + 14, { t: passo, dir });
  }
  if (tp === 'o') {
    if (!temPeca('ourico')) return false;
    if (est === 'x') return derrotado(g, 'ourico', 'andando', x + 7, y, 14, { t, dir });
    return sprite(g, 'ourico', 'andando', x + 7, y + 12, { t: passo, dir });
  }
  if (!temPeca('morcego')) return false;
  if (est === 'x') return derrotado(g, 'morcego', 'voando', x + 7, y + 5, 0, { t, dir });
  return sprite(g, 'morcego', est === 'd' ? 'dormindo' : 'voando', x + 7, y + 5, { t, dir });
}
function desenharChefe(g, k, tf, t) {
  const [x, y, , vida, est, pisca] = k;
  if (pisca && Math.floor(t * 20) % 2) return;
  if (!spriteChefe(g, k, tf, t)) corpoChefe(g, k, tf, t);
  if (est === 'a') for (let i = 0; i < vida; i++) coracao(g, x + 3 + i * 7, y - 10, 2.6, '#e05a5a');
}
function spriteChefe(g, k, tf, t) {
  const [x, y, dir, , est, , boca] = k;
  if (!temPeca('raposo')) return false;
  if (est === 'x') return derrotado(g, 'raposo', 'andando', x + 17, y, 46, { t, dir });
  const cuspe = boca && enviada('raposo', 'cuspindo');
  sprite(g, 'raposo', cuspe ? 'cuspindo' : 'andando', x + 17, y + 32, { t: tf * 0.6, dir });
  // Sem o sprite cuspindo: o fogo na boca por cima, no lugar do desenho de sempre.
  if (boca && !cuspe) {
    elipse(g, x + 17 + dir * 29.4, y + 11, 5.25, 3.7, 'rgba(255,170,60,0.9)');
    elipse(g, x + 17 + dir * 29.4, y + 11, 2.6, 1.9, '#fff1a8');
  }
  return true;
}
// O Raposo desenhado por código (os corações da vida vão por cima, com ou sem sprite).
function corpoChefe(g, k, tf, t, semSprite = false) {
  const [x, y, dir, , est, , boca] = k;
  g.save();
  if (est === 'x') { g.translate(x + 17, y); g.scale(1.05, -1.05); } else { g.translate(x + 17, y + 32); g.scale(1.05, 1.05); }
  g.save();
  g.scale(dir, 1);
  g.fillStyle = '#5b2a6e';
  g.beginPath(); g.moveTo(8, -27); g.quadraticCurveTo(-12, -30 + Math.sin(t * 5) * 2, -24, -4); g.lineTo(2, -9); g.closePath(); g.fill();
  g.restore();
  desenharRaposa(g, 0, 0, { dir, passo: tf * 0.6, andando: est === 'a', t, semSprite });
  g.scale(dir, 1);
  g.fillStyle = '#e8c24a';
  g.beginPath(); g.moveTo(6, -30); g.lineTo(6, -37); g.lineTo(9.5, -33); g.lineTo(13, -39); g.lineTo(16.5, -33); g.lineTo(20, -37); g.lineTo(20, -30); g.closePath(); g.fill();
  elipse(g, 13, -32.5, 1.2, 1.2, '#d8342a');
  if (boca) { elipse(g, 28, -20, 5, 3.5, 'rgba(255,170,60,0.9)'); elipse(g, 28, -20, 2.5, 1.8, '#fff1a8'); }
  g.restore();
}
function coracao(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x, y + r);
  g.bezierCurveTo(x - r * 2, y - r * 0.2, x - r * 0.8, y - r * 1.6, x, y - r * 0.5);
  g.bezierCurveTo(x + r * 0.8, y - r * 1.6, x + r * 2, y - r * 0.2, x, y + r);
  g.fill();
}

/* Poderes, fogo e lava */
const PECA_ITEM = { c: ['cenoura', 'brilhando'], f: ['flor-de-fogo', 'girando'], e: ['estrela', 'piscando'], v: ['trevo', 'brilhando'] };
function desenharItem(g, it, t) {
  const [peca, anim] = PECA_ITEM[it[0]] || PECA_ITEM.v;
  if (sprite(g, peca, anim, it[1] + 7, it[2] + 7, { t })) return;
  pintarItem(g, it, t);
}
function pintarItem(g, it, t) {
  const [tp, x, y] = it;
  const cx = x + 7;
  const cy = y + 7;
  if (tp === 'c') {
    g.fillStyle = '#f08a2c';
    g.beginPath(); g.moveTo(cx - 5, cy - 3); g.quadraticCurveTo(cx, cy - 6, cx + 5, cy - 3); g.lineTo(cx + 1, cy + 7); g.lineTo(cx - 1, cy + 7); g.closePath(); g.fill();
    g.strokeStyle = '#c4561f'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(cx - 3, cy); g.lineTo(cx - 1, cy); g.moveTo(cx + 1, cy + 3); g.lineTo(cx + 3, cy + 3); g.stroke();
    for (const [ox, rot] of [[-2, -0.5], [0, 0], [2, 0.5]]) elipse(g, cx + ox, cy - 7, 1.4, 3.6, '#3f8f45', rot);
    elipse(g, cx - 1.5, cy - 1.5, 0.8, 0.8, '#1b1403');
    elipse(g, cx + 1.5, cy - 1.5, 0.8, 0.8, '#1b1403');
    estrelinha(g, cx + 6, cy - 6, 1.5 + Math.sin(t * 6) * 0.8, '#fff6c0');
  } else if (tp === 'f') {
    g.fillStyle = '#3f8f45'; g.fillRect(cx - 0.8, cy, 1.6, 7);
    elipse(g, cx - 3, cy + 4, 3, 1.4, '#4fa04f', -0.4);
    elipse(g, cx + 3, cy + 4, 3, 1.4, '#4fa04f', 0.4);
    const cores = ['#e8452c', '#ff8a2a', '#ffd25a'];
    const c0 = Math.floor(t * 8) % 3;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + t;
      elipse(g, cx + Math.cos(a) * 3.6, cy - 3 + Math.sin(a) * 3.6, 2.6, 2.6, cores[(c0 + k) % 3]);
    }
    elipse(g, cx, cy - 3, 2.4, 2.4, '#fff1a8');
    elipse(g, cx - 0.8, cy - 3.4, 0.5, 0.7, '#1b1403');
    elipse(g, cx + 0.8, cy - 3.4, 0.5, 0.7, '#1b1403');
  } else if (tp === 'e') {
    const brilho = g.createRadialGradient(cx, cy, 1, cx, cy, 12);
    brilho.addColorStop(0, 'rgba(255,240,150,0.6)');
    brilho.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = brilho; g.fillRect(cx - 12, cy - 12, 24, 24);
    g.fillStyle = Math.floor(t * 10) % 2 ? '#ffd84a' : '#ffe98a';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      const r = k % 2 ? 3.2 : 7.5;
      g.lineTo(cx + Math.cos(a) * r, cy + 1 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    elipse(g, cx - 1.6, cy, 0.7, 1.4, '#1b1403');
    elipse(g, cx + 1.6, cy, 0.7, 1.4, '#1b1403');
  } else {
    g.fillStyle = '#2f7a3a'; g.fillRect(cx - 0.6, cy + 2, 1.2, 6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      elipse(g, cx + Math.cos(a) * 3.2, cy - 1 + Math.sin(a) * 3.2, 3.2, 2.6, '#4cb04a', a);
    }
    elipse(g, cx, cy - 1, 1.4, 1.4, '#7bd36a');
    estrelinha(g, cx - 5, cy - 6, 1.4 + Math.sin(t * 5) * 0.8, '#ffffff');
  }
}
function desenharBolaFogo(g, x, y, t) {
  if (sprite(g, 'bola-de-fogo', 'girando', x + 4, y + 4, { t })) return;
  pintarBolaFogo(g, x, y, t);
}
function pintarBolaFogo(g, x, y, t) {
  elipse(g, x + 4, y + 4, 6, 6, 'rgba(255,140,40,0.3)');
  elipse(g, x + 4, y + 4, 4, 4, '#ff7a1a');
  elipse(g, x + 4 + Math.cos(t * 20) * 1.2, y + 4 + Math.sin(t * 20) * 1.2, 2.2, 2.2, '#ffe08a');
}
function desenharChama(g, c, t) {
  if (sprite(g, 'chama', 'queimando', c[0] + 7, c[1] + 3, { t, dir: c[2] < 0 ? -1 : 1 })) return;
  pintarChama(g, c, t);
}
function pintarChama(g, c, t) {
  const [x, y, d] = c;
  const cx = x + 7;
  const cy = y + 3;
  for (let k = 0; k < 4; k++) elipse(g, cx - d * k * 3.5, cy + Math.sin(t * 20 + k) * 1, 5 - k, 3.4 - k * 0.6, ['#ff5a1a', '#ff7a1a', '#ffa03a', '#ffc85a'][k]);
  elipse(g, cx + d * 2, cy, 3, 2, '#fff1a8');
}
function desenharLava(g, x, y, topo, t) {
  if (spriteExato(g, 'lava', topo ? 'superficie' : 'funda', x + 8.25, y + 8.25, { t, ...BLOCO })) return;
  pintarLava(g, x, y, topo, t);
}
function pintarLava(g, x, y, topo, t) {
  g.fillStyle = '#c2360f';
  g.fillRect(x, y, T + 0.5, T + 0.5);
  if (!topo) { g.fillStyle = 'rgba(255,120,30,0.25)'; g.fillRect(x, y + ((t * 6 + x) % 16), 16, 2); return; }
  g.fillStyle = '#ff7a1a';
  g.beginPath();
  g.moveTo(x, y + 16);
  for (let k = 0; k <= 4; k++) g.lineTo(x + k * 4, y + 3 + Math.sin(t * 3 + (x + k * 4) * 0.15) * 1.6);
  g.lineTo(x + 16, y + 16);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd25a';
  for (let k = 0; k < 4; k++) g.fillRect(x + k * 4, y + 2.5 + Math.sin(t * 3 + (x + k * 4) * 0.15) * 1.6, 2.5, 1.1);
  const bolha = (t * 0.8 + hash(x)) % 2;
  if (bolha < 0.5) elipse(g, x + 4 + hash(x + 1) * 8, y + 5 - bolha * 6, 1.5 + bolha * 2, 1.5 + bolha * 2, 'rgba(255,210,90,0.7)');
}
function desenharBolha(g, p, t) {
  // Descendo sem o sprite próprio: o de subir de cabeça para baixo.
  const virar = !p.sobe && !enviada('bolha-de-lava', 'descendo');
  if (sprite(g, 'bolha-de-lava', p.sobe || virar ? 'subindo' : 'descendo', p.x + 6, p.y + 7, { t, rot: virar ? Math.PI : 0 })) return;
  pintarBolha(g, p, t);
}
function pintarBolha(g, p, t) {
  const cx = p.x + 6;
  const cy = p.y + 7;
  elipse(g, cx, cy, 9, 9, 'rgba(255,120,30,0.25)');
  for (let k = 1; k < 4; k++) elipse(g, cx, cy + (p.sobe ? k * 3 : -k * 3), 5 - k, 4 - k, ['#ff7a1a', '#ffa03a', '#ffc85a'][k - 1]);
  elipse(g, cx, cy, 6, 6.5, '#ff5a1a');
  elipse(g, cx - 1, cy - 1.5, 3, 3, '#ffd25a');
  elipse(g, cx - 2, cy + (p.sobe ? -1 : 1), 0.8, 1.2, '#3a0a00');
  elipse(g, cx + 2, cy + (p.sobe ? -1 : 1), 0.8, 1.2, '#3a0a00');
}

function pintarBolinhaBarra(g, x, y) {
  elipse(g, x, y, 5, 5, 'rgba(255,120,30,0.3)'); elipse(g, x, y, 3.4, 3.4, '#ff7a1a'); elipse(g, x, y, 1.8, 1.8, '#ffe08a');
}
function desenharPlataforma(g, p, tema, t) {
  if (p.vert) {
    g.strokeStyle = 'rgba(90,60,30,0.7)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(p.x + 6, 0); g.lineTo(p.x + 6, p.y); g.moveTo(p.x + p.w - 6, 0); g.lineTo(p.x + p.w - 6, p.y); g.stroke();
  }
  if (sprite(g, 'plataforma', 'parada', p.x + p.w / 2, p.y + 4, { t, largura: p.w })) return;
  pintarTabua(g, p);
}
function pintarTabua(g, p) {
  g.fillStyle = '#5a3418'; retArred(g, p.x, p.y, p.w, 8, 2); g.fill();
  g.fillStyle = '#a0703c';
  for (let k = 0; k < p.w / 8; k++) g.fillRect(p.x + k * 8 + 0.6, p.y + 0.8, 6.8, 5.6);
  g.fillStyle = '#d0a46a'; g.fillRect(p.x + 1, p.y, p.w - 2, 1);
  elipse(g, p.x + 4, p.y + 1, 4, 2, '#4f9a45');
  elipse(g, p.x + p.w - 5, p.y + 1, 3.5, 1.8, '#5fae4f');
}

function desenharParticulas(g, ps, t) {
  for (const p of ps) {
    const a = Math.max(0, 1 - p.t / p.vida);
    if (p.tp === 'brilho') estrelinha(g, p.x, p.y, Math.max(0.3, p.tam * a), p.cor);
    else if (p.tp === 'po') { g.globalAlpha = a * 0.6; elipse(g, p.x, p.y, p.tam * (1 + p.t * 2), p.tam * (0.7 + p.t), '#e8dcc0'); g.globalAlpha = 1; }
    else if (p.tp === 'caco' && sprite(g, 'caco', 'voando', p.x, p.y, { t: p.t, rot: p.t * 12 * (p.vx < 0 ? -1 : 1), cor: p.cor })) continue;
    else if (p.tp === 'caco') { g.save(); g.translate(p.x, p.y); g.rotate(p.t * 12 * (p.vx < 0 ? -1 : 1)); g.fillStyle = p.cor; g.fillRect(-3, -3, 6, 6); g.restore(); }
    else if (p.tp === 'moeda') desenharLirio(g, p.x, p.y, t * 3, 0);
    else if (p.tp === 'fogos') { g.globalAlpha = a; elipse(g, p.x, p.y, p.tam, p.tam, p.cor); g.globalAlpha = 1; }
  }
}
function desenharPopups(g, pp) {
  for (const [x, y, txt, tt] of pp) {
    g.globalAlpha = Math.min(1, tt * 2.5);
    texto(g, txt, x, y, 8, txt === '1UP' ? '#9be37a' : '#fff6d8', 'center', 'rgba(0,0,0,0.75)');
    g.globalAlpha = 1;
  }
}

/* Os blocos que aparecem na tela */
function desenharBlocos(g, F, mapa, base, cam, t) {
  const L = base.largura;
  const tema = base.def.tema;
  const c0 = Math.max(0, Math.floor(cam / T));
  const c1 = Math.min(L - 1, c0 + 33);
  const pulos = new Map();
  for (const [c, r, bt] of F.bp) pulos.set(r * L + c, -Math.sin(Math.PI * Math.min(1, bt / 0.2)) * 5);
  for (let r = 0; r < LINHAS; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * L + c;
      const v = mapa[i];
      if (!v || v === B.TRONCO || v === B.COPA || v === B.OCULTO) continue;
      const x = c * T;
      const y = r * T + (pulos.get(i) || 0);
      switch (v) {
        case B.CHAO: {
          const topo = r > 0 && mapa[i - L] !== B.CHAO;
          const baixo = r < LINHAS - 1 && !mapa[i + L] && r < 10;
          const vv = (c * 7 + r * 3) % 4;
          // Os quadros do sprite do chão são variações espalhadas pelo chão (não anima).
          const anim = tema === 'castelo' ? 'castelo' : `${tema === 'caverna' ? 'caverna' : 'campo'}${topo ? '-topo' : ''}`;
          if (spriteExato(g, 'chao', anim, x + 8.25, y + 8.25, { quadro: vv, ...BLOCO })) {
            if (baixo) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + 12, 16, 4); }
          } else carimbo(g, `${tema}:c:${topo ? 1 : 0}:${baixo ? 1 : 0}:${vv}`, x, y, cg => pintarChao(cg, tema, topo, baixo, vv));
          break;
        }
        case B.TIJOLO: if (!spriteExato(g, 'tijolo', paleta(tema), x + 8.25, y + 8.25, { t, ...BLOCO })) carimbo(g, `${tema}:t`, x, y, cg => pintarTijolo(cg, tema)); break;
        case B.PEDRA: if (!spriteExato(g, 'pedra', paleta(tema), x + 8.25, y + 8.25, { t, ...BLOCO })) carimbo(g, `${tema}:p`, x, y, cg => pintarPedra(cg, tema)); break;
        case B.USADO: if (!spriteExato(g, 'bloco-usado', paleta(tema), x + 8.25, y + 8.25, { t, ...BLOCO })) carimbo(g, `${tema}:u`, x, y, cg => pintarUsado(cg, tema)); break;
        case B.PONTE: if (!sprite(g, 'ponte', 'parada', x + 8.25, y + 8.25, { t, ...BLOCO })) carimbo(g, 'ponte', x, y, pintarPonte); break;
        case B.LAVA: desenharLava(g, x, y, r > 0 && mapa[i - L] !== B.LAVA, t); break;
        case B.LIRIO: desenharLirio(g, x + 8, y + 8, t, c * 0.5); break;
        case B.PERGUNTA:
          if (!sprite(g, 'bloco-pergunta', 'brilhando', x + 8.25, y + 8.25, { t, ...BLOCO })) desenharPergunta(g, x, y, c, t, true);
          break;
        default: break;
      }
    }
  }
}
// O bloco "?" de sempre (o "?" balançando e o brilho que passa). guardado: usa o bloco já desenhado (carimbo).
function desenharPergunta(g, x, y, c, t, guardado = false) {
  if (guardado) carimbo(g, 'pergunta', x, y, pintarPergunta);
  else { g.save(); g.translate(x, y); pintarPergunta(g); g.restore(); }
  const bob = Math.sin(t * 4 + c * 0.7) * 0.8;
  texto(g, '?', x + 8, y + 8.6 + bob, 11, '#fff3c4', 'center', '#7a5512');
  const brilho = (t * 0.6 + c * 0.13) % 1.8;
  if (brilho < 0.4) {
    const sx = x - 6 + (brilho / 0.4) * 28;
    g.save();
    g.beginPath(); g.rect(x + 1, y + 1, 14, 14); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + 5, y); g.lineTo(sx - 3, y + 16); g.lineTo(sx - 8, y + 16); g.closePath(); g.fill();
    g.restore();
  }
}

/* Telas por cima: HUD, cartão da fase, final e fim de jogo */
function desenharHud(g, F, t) {
  const fundo = g.createLinearGradient(0, 0, 0, 30);
  fundo.addColorStop(0, 'rgba(8,14,10,0.8)');
  fundo.addColorStop(1, 'rgba(8,14,10,0)');
  g.fillStyle = fundo;
  g.fillRect(0, 0, W, 30);
  const rot = (s, x) => texto(g, s, x, 8, 7, '#d8b13a');
  const val = (s, x, cor = '#ece0bf') => texto(g, s, x, 19, 11, cor);
  rot('COELHO', 14); val(String(Math.floor(F.pt)).padStart(7, '0'), 14);
  rot('LÍRIOS', 120); desenharLirio(g, 125, 19, t * 0.6, 0); val(`× ${String(F.li).padStart(2, '0')}`, 134);
  rot('MUNDO', 214); val(`1-${F.f + 1}`, 214);
  const pouco = F.te <= 100 && F.m === 'jogo' && Math.floor(t * 4) % 2;
  rot('TEMPO', 296); val(String(Math.max(0, F.te)).padStart(3, '0'), 296, pouco ? '#ff8a6a' : '#ece0bf');
  rot(F.jv || 'VIDAS', 380);
  elipse(g, 389, 20, 4.5, 4, '#e9dcc3');
  elipse(g, 387, 13.5, 1.4, 3.6, '#e9dcc3', -0.2);
  elipse(g, 391, 13.5, 1.4, 3.6, '#e9dcc3', 0.2);
  elipse(g, 390.5, 19.5, 0.8, 0.8, '#1b1403');
  val(F.rs ? `× ${F.vi} +${F.rs}` : `× ${F.vi}`, 397);
  if (F.v > 1) texto(g, `VOLTA ${F.v}`, W - 12, 8, 7, '#e8c24a', 'right');
}
function desenharCartao(g, F, t) {
  g.fillStyle = '#0e1811';
  g.fillRect(0, 0, W, H);
  const brilho = g.createRadialGradient(W / 2, 140, 10, W / 2, 140, 260);
  brilho.addColorStop(0, 'rgba(216,177,58,0.12)');
  brilho.addColorStop(1, 'rgba(216,177,58,0)');
  g.fillStyle = brilho;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(216,177,58,0.4)';
  g.lineWidth = 1;
  g.strokeRect(24.5, 34.5, W - 49, H - 59);
  const def = FASES[F.f];
  texto(g, `Mundo 1-${F.f + 1}`, W / 2, 92, 24, '#e8c24a', 'center');
  texto(g, def.nome, W / 2, 122, 14, '#ece0bf', 'center');
  if (!sprite(g, 'coelho-pequeno', 'parado', W / 2 - 22, 190, { t, escala: 0.62 / 0.42 })) {
    g.save();
    g.translate(W / 2 - 22, 190);
    g.scale(0.62, 0.62);
    desenharCoelho(g, 0, 0, { pelo: '#e9dcc3', dir: 1, t });
    g.restore();
  }
  texto(g, `×  ${F.vi}`, W / 2 + 4, 176, 16, '#ece0bf');
  const dica = F.dj ? F.dj : F.v > 1 ? `Volta ${F.v}: os inimigos estão mais rápidos!` : F.f === 0 ? 'Salve a Princesa Cenoura do castelo do Raposo!' : F.f === 3 ? 'O Raposo espera na ponte sobre a lava...' : '';
  if (dica) texto(g, dica, W / 2, 226, 10, '#d8b13a', 'center');
  desenharHud(g, F, t);
}
function desenharFinal(g, F, t) {
  g.fillStyle = 'rgba(14,24,17,0.25)';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ece0bf';
  retArred(g, 96, 38, 320, 82, 8);
  g.fill();
  g.strokeStyle = '#d8b13a';
  g.lineWidth = 2;
  g.stroke();
  texto(g, 'Obrigada, Super Coelho!', W / 2, 60, 15, '#1d3a22', 'center', null);
  texto(g, 'Você me salvou do Raposo!', W / 2, 82, 10, '#2f4a33', 'center', null);
  texto(g, `Bônus de tempo: +${F.bn}`, W / 2, 101, 10, '#8a6a12', 'center', null);
  if (F.tm > 5) texto(g, `Volta ${F.v + 1}: o Raposo quer revanche!`, W / 2, 142, 12, '#e8c24a', 'center');
}
function desenharFimDeJogo(g) {
  g.fillStyle = 'rgba(8,14,10,0.6)';
  g.fillRect(0, 0, W, H);
  texto(g, 'Fim de jogo', W / 2, H / 2, 26, '#e8c24a', 'center');
}

// extra (junto): { outros(g, t), eu: visual do meu coelho, marca(g) }
function desenharCena(g, F, mapa, t, particulas, extra) {
  const base = nivelBase(F.f);
  const def = base.def;
  g.save();
  if (F.m === 'titulo') { desenharCartao(g, F, t); g.restore(); return; }
  let esc = 1;
  try { const m = g.getTransform?.(); if (m && m.a > 0) esc = m.a; } catch { /* sem transformação */ }
  const cam = Math.round(F.cx * esc) / esc;
  if (def.tema === 'campo') fundoCampo(g, cam, t);
  else if (def.tema === 'caverna') fundoCaverna(g, cam, t);
  else if (def.tema === 'copas') fundoCopas(g, cam, t);
  else fundoCastelo(g, cam, t);
  g.save();
  g.translate(-cam, 0);
  const visivel = (x0, x1) => x1 > cam - 8 && x0 < cam + W + 8;
  desenharEnfeites(g, base, cam, t);
  for (const cp of base.copas) if (visivel(cp.c * T - 8, (cp.c + cp.len) * T + 8)) desenharCopa(g, cp, t);
  for (const tr of base.troncos) if (visivel(tr.c * T, tr.c * T + 32)) desenharTronco(g, tr);
  if (def.mastro && visivel(def.mastro * T - 30, (def.castelo + 5) * T)) {
    desenharCastelinho(g, def, F, def.tema);
    desenharMastro(g, def, F.bd, t);
  }
  if (def.meio && visivel(def.meio.c * T, def.meio.c * T + 16)) desenharMarco(g, def, F.mk, t);
  for (const it of F.it) if (it[3]) desenharItem(g, it, t);
  desenharBlocos(g, F, mapa, base, cam, t);
  for (const p of base.plataformas) {
    const pos = posPlataforma(p, F.tf);
    if (visivel(pos.x, pos.x + pos.w)) desenharPlataforma(g, { ...pos, vert: p.tipo === 'v' }, def.tema, t);
  }
  if (def.alavanca) desenharAlavanca(g, def, ['ponte', 'resgate', 'princesa'].includes(F.m), t);
  if (def.princesa && visivel(def.princesa.c * T - 20, def.princesa.c * T + 40)) {
    const px = def.princesa.c * T + 8;
    const py = def.princesa.r * T;
    const feliz = F.m === 'princesa';
    if (!sprite(g, 'princesa', feliz ? 'feliz' : 'esperando', px, py, { t })) desenharPrincesa(g, px, py, t, feliz);
    if (feliz) for (let k = 0; k < 4; k++) {
      const ciclo = (t * 0.7 + k * 0.25) % 1;
      g.globalAlpha = 1 - ciclo;
      coracao(g, px - 12 + k * 8, py - 46 - ciclo * 30, 3, '#e05a8a');
      g.globalAlpha = 1;
    }
    else if (F.k && F.k[4] === 'a') texto(g, 'Socorro!', px, py - 52, 8, '#fff6d8', 'center');
  }
  for (const it of F.it) if (!it[3]) desenharItem(g, it, t);
  for (const e of F.e) desenharInimigo(g, e, F.tf, t);
  if (F.k) desenharChefe(g, F.k, F.tf, t);
  if (extra) extra.outros(g, t);
  desenharJogador(g, F, t, extra?.eu);
  if (extra) extra.marca(g);
  for (const br of base.barras) {
    if (!visivel(br.cx - 70, br.cx + 70)) continue;
    for (const p of bolasDaBarra(br, F.tf)) if (!sprite(g, 'barra-de-fogo', 'queimando', p.x, p.y, { t })) pintarBolinhaBarra(g, p.x, p.y);
  }
  for (const bo of base.bolhas) { const p = posBolha(bo, F.tf); if (p && visivel(p.x, p.x + 12)) desenharBolha(g, p, t); }
  for (const [x, y] of F.b) desenharBolaFogo(g, x, y, t);
  for (const c of F.ch) desenharChama(g, c, t);
  if (particulas) desenharParticulas(g, particulas, t);
  desenharPopups(g, F.pp);
  g.restore();
  if (def.tema === 'caverna') {
    const v = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 320);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  } else if (def.tema === 'castelo') {
    const v = g.createLinearGradient(0, 200, 0, H);
    v.addColorStop(0, 'rgba(255,80,20,0)');
    v.addColorStop(1, 'rgba(255,80,20,0.12)');
    g.fillStyle = v;
    g.fillRect(0, 200, W, H - 200);
  }
  desenharHud(g, F, t);
  if (F.m === 'princesa') desenharFinal(g, F, t);
  if (F.m === 'fim') desenharFimDeJogo(g);
  g.restore();
}

/* ─── Sprites: as peças que a Família Nobre pode trocar em #/recreacao/sprites ─── */
// Cada prévia desenha o desenho de sempre (sem sprite) com a âncora em (0, 0), em unidades do jogo (um bloco = 16).
// O molde para baixar sai dela: o quadro q é a prévia no tempo q / fps.

const recortar = (g, x, y, w, h, f) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); f(); g.restore(); };
const deslocado = (g, x, y, f) => { g.save(); g.translate(x, y); f(); g.restore(); };

// O coelho: bits como na foto (1 agachado, 2 no chão, 4 de cabeça para baixo, 32 morto, 64 subindo).
const BITS_COELHO = { parado: 2, andando: 2, derrapando: 2, pulando: 64, caindo: 0, abaixado: 3, morrendo: 36 };
const previaCoelho = (forma, estrela) => (g, anim, t) => {
  const bits = BITS_COELHO[anim] ?? 2;
  const vx = anim === 'andando' ? 60 : anim === 'derrapando' ? -60 : 0;
  const h = forma > 0 ? (bits & 1 ? AGACHADO : GRANDE) : PEQUENO;
  corpoJogador(g, [-LARG / 2, -h, forma, 1, bits, t, estrela, 0, 0, vx], t, null, true);
};
const ANIMS_COELHO = [
  { id: 'parado', nome: 'Parado', quadros: 2, fps: 2 },
  { id: 'andando', nome: 'Andando e correndo', quadros: 4, fps: 6 },
  { id: 'pulando', nome: 'Pulando (subindo)', quadros: 1, fps: 1 },
  { id: 'caindo', nome: 'Caindo', quadros: 1, fps: 1 },
  { id: 'derrapando', nome: 'Derrapando (virando de lado correndo)', quadros: 1, fps: 1 },
];
const ABAIXADO = { id: 'abaixado', nome: 'Abaixado', quadros: 1, fps: 1 };
const MORRENDO = { id: 'morrendo', nome: 'Morrendo', quadros: 2, fps: 4 };
const DICA_COELHO = 'Olhando para a direita, com o pé no fundo do quadro. Sem o sprite de uma animação, vale a primeira enviada (derrapando usa o de andar, caindo usa o de pular, abaixado usa o parado). Marque "pintar com a cor do jogador" para, no jogo junto, cada coelho ter a cor do seu pelo (e o arco-íris na estrela).';

const DICA_DERROTADO = 'Derrotado: de cabeça para baixo, caindo da tela (sem ele, o jogo vira o de andar).';
const temaDe = anim => (anim.startsWith('caverna') ? 'caverna' : anim === 'castelo' ? 'castelo' : 'campo');
const ANIMS_TEMAS = [
  { id: 'campo', nome: 'Campos e Copas', quadros: 1, fps: 1 },
  { id: 'caverna', nome: 'Tocas', quadros: 1, fps: 1 },
  { id: 'castelo', nome: 'Castelo', quadros: 1, fps: 1 },
];
// Tijolo e pedra não existem no castelo.
const ANIMS_CAMPO_TOCAS = ANIMS_TEMAS.slice(0, 2);
const bloco = pintar => (g, anim, t) => deslocado(g, -8, -8, () => pintar(g, anim, t));
const DICA_BLOCO = 'Um bloco de 16 x 16. Cada tema tem o seu: sem o sprite de um tema, ele continua com o desenho de sempre.';
const copa = k => (g, anim, t) => recortar(g, -8, -11, 16, 22, () => pintarFolhasCopa(g, { c: -0.5 - k, r: -9 / 16, len: 3 }, t));
const enfeite = (d, o) => (g, anim, t) => pintarEnfeite(g, typeof d === 'function' ? d(anim, t) : d, t, o);

export const SPRITES = [
  /* O coelho */
  {
    chave: 'supercoelho.coelho-pequeno', jogo: 'Super Coelho', nome: 'Coelho pequeno',
    desc: `O Super Coelho pequeno (sem cenoura). ${DICA_COELHO} O cartão de cada fase também usa o parado.`,
    largura: 20, altura: 26, ancora: 'pe', tingir: true,
    animacoes: [...ANIMS_COELHO, MORRENDO],
    previa: previaCoelho(0, 0),
  },
  {
    chave: 'supercoelho.coelho-grande', jogo: 'Super Coelho', nome: 'Coelho grande',
    desc: `O coelho grande, depois da cenoura (no desenho de sempre, de cachecol). ${DICA_COELHO}`,
    largura: 28, altura: 44, ancora: 'pe', tingir: true,
    animacoes: [...ANIMS_COELHO, ABAIXADO, MORRENDO],
    previa: previaCoelho(1, 0),
  },
  {
    chave: 'supercoelho.coelho-fogo', jogo: 'Super Coelho', nome: 'Coelho de fogo',
    desc: `O coelho com a Flor de Fogo (de coroa e capa), o que joga bolas de fogo. ${DICA_COELHO}`,
    largura: 28, altura: 44, ancora: 'pe', tingir: true,
    animacoes: [...ANIMS_COELHO, ABAIXADO, MORRENDO],
    previa: previaCoelho(2, 0),
  },
  {
    chave: 'supercoelho.coelho-estrela', jogo: 'Super Coelho', nome: 'Coelho com a estrela',
    desc: 'O coelho invencível da estrela, grande ou pequeno (pequeno, o jogo diminui). Sem este sprite, o jogo usa o do tamanho do coelho pintado de arco-íris (se ele foi enviado para pintar). Olhando para a direita; as estrelinhas em volta continuam por cima.',
    largura: 28, altura: 44, ancora: 'pe', tingir: true,
    animacoes: [...ANIMS_COELHO, ABAIXADO],
    previa: previaCoelho(1, 1),
  },

  /* Inimigos */
  {
    chave: 'supercoelho.raposinho', jogo: 'Super Coelho', nome: 'Raposinho',
    desc: `A raposinha que anda pelas fases (pise nela). Olhando para a direita. Achatado: depois do pisão. ${DICA_DERROTADO}`,
    largura: 18, altura: 12, ancora: 'pe',
    animacoes: [
      { id: 'andando', nome: 'Andando', quadros: 4, fps: 5 },
      { id: 'achatado', nome: 'Achatado', quadros: 1, fps: 1 },
      { id: 'derrotado', nome: 'Derrotado', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => pintarInimigo(g, ['r', -7, -12, anim === 'achatado' ? 'p' : anim === 'derrotado' ? 'x' : 'a', 1, 0, 0], t, t, true),
  },
  {
    chave: 'supercoelho.tatu', jogo: 'Super Coelho', nome: 'Tatu',
    desc: `O tatu andando. Olhando para a direita. Pisado, ele vira a bolinha (outra peça). ${DICA_DERROTADO}`,
    largura: 26, altura: 14, ancora: 'pe',
    animacoes: [
      { id: 'andando', nome: 'Andando', quadros: 4, fps: 6 },
      { id: 'derrotado', nome: 'Derrotado', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => pintarInimigo(g, ['t', -7, -14, anim === 'derrotado' ? 'x' : 'a', 1, 0, 0], t, t, true),
  },
  {
    chave: 'supercoelho.tatu-bolinha', jogo: 'Super Coelho', nome: 'Tatu bolinha',
    desc: 'O tatu enrolado depois do pisão (dá para chutar). Acordando: os olhinhos aparecendo antes de ele desenrolar (o jogo ainda treme o sprite). Rolando: com vários quadros, eles fazem uma volta inteira; com um quadro só, o jogo gira o desenho.',
    largura: 16, altura: 14, ancora: 'centro',
    animacoes: [
      { id: 'parado', nome: 'Parada', quadros: 1, fps: 1 },
      { id: 'acordando', nome: 'Acordando', quadros: 1, fps: 4 },
      { id: 'rolando', nome: 'Rolando', quadros: 8, fps: 12 },
    ],
    previa: (g, anim, t) => {
      if (anim === 'rolando') {
        const x = t * 12 * ((6 * Math.PI * 2) / 8);
        deslocado(g, -x, 0, () => pintarInimigo(g, ['t', x - 7, -6, 'k', 1, 0, 0], t, t, true));
        return;
      }
      pintarInimigo(g, ['t', -7, -6, 'c', 1, anim === 'acordando' ? 5 : 0, 0], t, t, true);
    },
  },
  {
    chave: 'supercoelho.ourico', jogo: 'Super Coelho', nome: 'Ouriço',
    desc: `O ouriço de espinhos (não dá para pisar). Olhando para a direita. ${DICA_DERROTADO}`,
    largura: 22, altura: 14, ancora: 'pe',
    animacoes: [
      { id: 'andando', nome: 'Andando', quadros: 4, fps: 8 },
      { id: 'derrotado', nome: 'Derrotado', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => pintarInimigo(g, anim === 'derrotado' ? ['o', -7, -14, 'x', 1, 0, 0] : ['o', -7, -12, 'a', 1, 0, 0], t, t, true),
  },
  {
    chave: 'supercoelho.morcego', jogo: 'Super Coelho', nome: 'Morcego',
    desc: 'O morcego das Tocas: dormindo pendurado no teto até o coelho chegar perto, depois voando. Olhando para a direita, pelo meio do quadro. Derrotado: de cabeça para baixo (sem ele, o jogo vira o de voar).',
    largura: 26, altura: 20, ancora: 'centro',
    animacoes: [
      { id: 'dormindo', nome: 'Dormindo', quadros: 1, fps: 1 },
      { id: 'voando', nome: 'Voando', quadros: 4, fps: 12 },
      { id: 'derrotado', nome: 'Derrotado', quadros: 2, fps: 12 },
    ],
    previa: (g, anim, t) => pintarInimigo(g, ['m', -7, -5, anim === 'dormindo' ? 'd' : anim === 'derrotado' ? 'x' : 'v', 1, 0, 0], t, t, true),
  },
  {
    chave: 'supercoelho.raposo', jogo: 'Super Coelho', nome: 'Raposo (o chefe)',
    desc: 'O Raposo de coroa e capa, na ponte do castelo. Olhando para a direita. Cuspindo: quando joga a chama (sem ele, o jogo põe o fogo na boca do de andar). Derrotado: de cabeça para baixo, caindo na lava. Os corações da vida continuam por cima.',
    largura: 72, altura: 46, ancora: 'pe',
    animacoes: [
      { id: 'andando', nome: 'Andando', quadros: 4, fps: 5 },
      { id: 'cuspindo', nome: 'Cuspindo fogo', quadros: 2, fps: 5 },
      { id: 'derrotado', nome: 'Derrotado', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => corpoChefe(g, anim === 'derrotado' ? [-17, -46, 1, 0, 'x', 0, 0] : [-17, -32, 1, 5, 'a', 0, anim === 'cuspindo' ? 1 : 0], t / 0.6, t / 0.6, true),
  },
  {
    chave: 'supercoelho.chama', jogo: 'Super Coelho', nome: 'Chama do Raposo',
    desc: 'A chama que o Raposo cospe. Indo para a direita (a ponta na frente, o rastro atrás).',
    largura: 26, altura: 10, ancora: 'centro',
    animacoes: [{ id: 'queimando', nome: 'Queimando', quadros: 4, fps: 12 }],
    previa: (g, anim, t) => pintarChama(g, [-7, -3, 1], t),
  },

  /* Poderes e Lírios */
  {
    chave: 'supercoelho.cenoura', jogo: 'Super Coelho', nome: 'Cenoura',
    desc: 'A cenoura que deixa o coelho grande. Sai do bloco e anda pelo chão.',
    largura: 20, altura: 20, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 4, fps: 6 }],
    previa: (g, anim, t) => pintarItem(g, ['c', -7, -7, 0], t),
  },
  {
    chave: 'supercoelho.flor-de-fogo', jogo: 'Super Coelho', nome: 'Flor de Fogo',
    desc: 'A flor que dá o poder de jogar bolas de fogo. Fica parada em cima do bloco.',
    largura: 20, altura: 20, ancora: 'centro',
    animacoes: [{ id: 'girando', nome: 'Girando', quadros: 3, fps: 8 }],
    previa: (g, anim, t) => pintarItem(g, ['f', -7, -7, 0], t),
  },
  {
    chave: 'supercoelho.estrela', jogo: 'Super Coelho', nome: 'Estrela',
    desc: 'A estrela que deixa o coelho invencível por dez segundos. Sai pulando do bloco.',
    largura: 20, altura: 20, ancora: 'centro',
    animacoes: [{ id: 'piscando', nome: 'Piscando', quadros: 2, fps: 10 }],
    previa: (g, anim, t) => pintarItem(g, ['e', -7, -7, 0], t),
  },
  {
    chave: 'supercoelho.trevo', jogo: 'Super Coelho', nome: 'Trevo (vida a mais)',
    desc: 'O trevo escondido que dá uma vida a mais. Anda pelo chão como a cenoura.',
    largura: 20, altura: 20, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 4, fps: 5 }],
    previa: (g, anim, t) => pintarItem(g, ['v', -7, -7, 0], t),
  },
  {
    chave: 'supercoelho.lirio', jogo: 'Super Coelho', nome: 'Lírio (moeda)',
    desc: 'A moeda de Lírio, girando. Vale para as que ficam no ar, as que pulam do bloco e a do placar.',
    largura: 14, altura: 16, ancora: 'centro',
    animacoes: [{ id: 'girando', nome: 'Girando', quadros: 6, fps: 7 }],
    previa: (g, anim, t) => pintarLirio(g, 0, 0, t, 0),
  },
  {
    chave: 'supercoelho.bola-de-fogo', jogo: 'Super Coelho', nome: 'Bola de fogo',
    desc: 'A bola de fogo que o coelho de fogo joga e que quica no chão.',
    largura: 12, altura: 12, ancora: 'centro',
    animacoes: [{ id: 'girando', nome: 'Girando', quadros: 4, fps: 12 }],
    previa: (g, anim, t) => pintarBolaFogo(g, -4, -4, t),
  },

  /* Blocos e chão */
  {
    chave: 'supercoelho.chao', jogo: 'Super Coelho', nome: 'Chão',
    desc: 'O bloco de chão de 16 x 16, de cada tema ("com grama" é o de cima, que encosta no ar). Os quadros são variações que o jogo espalha pelo chão (não anima). Sem o sprite de um tema, ele continua com o desenho de sempre.',
    largura: 16, altura: 16, ancora: 'centro',
    animacoes: [
      { id: 'campo-topo', nome: 'Campos e Copas, com grama', quadros: 4, fps: 2 },
      { id: 'campo', nome: 'Campos e Copas, terra', quadros: 4, fps: 2 },
      { id: 'caverna-topo', nome: 'Tocas, com musgo', quadros: 4, fps: 2 },
      { id: 'caverna', nome: 'Tocas, pedra', quadros: 4, fps: 2 },
      { id: 'castelo', nome: 'Castelo', quadros: 4, fps: 2 },
    ],
    previa: bloco((g, anim, t) => pintarChao(g, temaDe(anim), anim.endsWith('-topo'), false, Math.floor(t * 2) % 4)),
  },
  {
    chave: 'supercoelho.tijolo', jogo: 'Super Coelho', nome: 'Tijolo',
    desc: `O tijolo que o coelho grande quebra. ${DICA_BLOCO}`,
    largura: 16, altura: 16, ancora: 'centro', animacoes: ANIMS_CAMPO_TOCAS,
    previa: bloco((g, anim) => pintarTijolo(g, anim)),
  },
  {
    chave: 'supercoelho.bloco-pergunta', jogo: 'Super Coelho', nome: 'Bloco "?"',
    desc: 'O bloco de pergunta, com Lírio ou poder dentro. O mesmo em todas as fases.',
    largura: 16, altura: 16, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 6, fps: 2 }],
    previa: (g, anim, t) => desenharPergunta(g, -8, -8, 0, t),
  },
  {
    chave: 'supercoelho.bloco-usado', jogo: 'Super Coelho', nome: 'Bloco usado',
    desc: `O bloco vazio, depois de dar o que tinha dentro (e o do meio das barras de fogo). ${DICA_BLOCO}`,
    largura: 16, altura: 16, ancora: 'centro', animacoes: ANIMS_TEMAS,
    previa: bloco((g, anim) => pintarUsado(g, anim)),
  },
  {
    chave: 'supercoelho.pedra', jogo: 'Super Coelho', nome: 'Pedra das escadas',
    desc: `O bloco duro das escadas e do pé do mastro. ${DICA_BLOCO}`,
    largura: 16, altura: 16, ancora: 'centro', animacoes: ANIMS_CAMPO_TOCAS,
    previa: bloco((g, anim) => pintarPedra(g, anim)),
  },
  {
    chave: 'supercoelho.ponte', jogo: 'Super Coelho', nome: 'Ponte do castelo',
    desc: 'Um pedaço da ponte sobre a lava, onde fica o Raposo (16 x 16, com a argola embaixo).',
    largura: 16, altura: 16, ancora: 'centro',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: bloco(g => pintarPonte(g)),
  },
  {
    chave: 'supercoelho.lava', jogo: 'Super Coelho', nome: 'Lava',
    desc: 'Um bloco de lava do castelo: a superfície (com as ondas) e o de baixo. Sem o sprite de um deles, ele continua com o desenho de sempre.',
    largura: 16, altura: 16, ancora: 'centro',
    animacoes: [
      { id: 'superficie', nome: 'Superfície', quadros: 8, fps: 4 },
      { id: 'funda', nome: 'Funda', quadros: 8, fps: 3 },
    ],
    previa: bloco((g, anim, t) => pintarLava(g, 0, 0, anim === 'superficie', t)),
  },
  {
    chave: 'supercoelho.bolha-de-lava', jogo: 'Super Coelho', nome: 'Bolha de lava',
    desc: 'A bolha que pula da lava e volta. Subindo: com a cara para cima (sem o sprite descendo, o jogo vira o de subir).',
    largura: 18, altura: 22, ancora: 'centro',
    animacoes: [
      { id: 'subindo', nome: 'Subindo', quadros: 1, fps: 8 },
      { id: 'descendo', nome: 'Descendo', quadros: 1, fps: 8 },
    ],
    previa: (g, anim, t) => pintarBolha(g, { x: -6, y: -7, sobe: anim === 'subindo' }, t),
  },
  {
    chave: 'supercoelho.barra-de-fogo', jogo: 'Super Coelho', nome: 'Bola da barra de fogo',
    desc: 'Cada bolinha das barras de fogo que giram no castelo.',
    largura: 10, altura: 10, ancora: 'centro',
    animacoes: [{ id: 'queimando', nome: 'Queimando', quadros: 1, fps: 8 }],
    previa: g => pintarBolinhaBarra(g, 0, 0),
  },
  {
    chave: 'supercoelho.caco', jogo: 'Super Coelho', nome: 'Caco de tijolo',
    desc: 'Os pedaços que voam quando o coelho grande quebra um tijolo (o jogo gira). Desenhe em cinza claro e marque "pintar com a cor do jogador" para pegar a cor do tijolo da fase.',
    largura: 6, altura: 6, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'voando', nome: 'Voando', quadros: 1, fps: 8 }],
    previa: g => { g.fillStyle = TEMAS.campo.tijolo[0]; g.fillRect(-3, -3, 6, 6); },
  },

  /* Troncos, copas e plataformas */
  {
    chave: 'supercoelho.tronco', jogo: 'Super Coelho', nome: 'Tronco cortado',
    desc: 'Os troncos que fazem de cano nos Campos e nas Tocas (dois blocos de largura). O topo vai em cima e o meio se repete até o chão.',
    largura: 32, altura: 16, ancora: 'topo',
    animacoes: [{ id: 'topo', nome: 'Topo', quadros: 1, fps: 1 }, { id: 'meio', nome: 'Meio', quadros: 1, fps: 1 }],
    previa: (g, anim) => {
      if (anim === 'meio') recortar(g, -16, 0, 32, 16, () => pintarTronco(g, { c: -1, topo: -1, base: 2 }));
      else pintarTronco(g, { c: -1, topo: 0, base: 1 });
    },
  },
  {
    chave: 'supercoelho.copa', jogo: 'Super Coelho', nome: 'Copa das árvores',
    desc: 'As folhas das plataformas da fase das Copas, um bloco por vez: a ponta da esquerda, o meio (que se repete) e a ponta da direita. O bloco onde se pisa fica no meio do quadro, com folga em cima e embaixo.',
    largura: 16, altura: 22, ancora: 'centro',
    animacoes: [
      { id: 'esquerda', nome: 'Ponta da esquerda', quadros: 1, fps: 1 },
      { id: 'meio', nome: 'Meio', quadros: 1, fps: 1 },
      { id: 'direita', nome: 'Ponta da direita', quadros: 1, fps: 1 },
    ],
    previa: (g, anim, t) => copa(anim === 'esquerda' ? 0 : anim === 'direita' ? 2 : 1)(g, anim, t),
  },
  {
    chave: 'supercoelho.copa-tronco', jogo: 'Super Coelho', nome: 'Tronco das copas',
    desc: 'Um pedaço do tronco embaixo das copas, repetido até o fim da tela (nas copas pequenas, o jogo afina).',
    largura: 26, altura: 16, ancora: 'topo',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => recortar(g, -13, 0, 26, 16, () => pintarTroncoCopa(g, { c: -2, r: -1.5, len: 4 })),
  },
  {
    chave: 'supercoelho.plataforma', jogo: 'Super Coelho', nome: 'Plataforma que se mexe',
    desc: 'As tábuas que sobem e descem (ou vão e voltam) nas Copas, com três blocos de largura. As cordas continuam desenhadas pelo jogo.',
    largura: 48, altura: 8, ancora: 'centro',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: g => pintarTabua(g, { x: -24, y: -4, w: 48 }),
  },

  /* Fim da fase e castelo */
  {
    chave: 'supercoelho.mastro', jogo: 'Super Coelho', nome: 'Mastro',
    desc: 'O mastro do fim da fase, com a bolinha dourada em cima (a bandeira é outra peça). Fica em cima do bloco de pedra.',
    largura: 10, altura: 166, ancora: 'pe',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => deslocado(g, 0, -BASE_MASTRO, () => pintarPoste(g, 0)),
  },
  {
    chave: 'supercoelho.bandeira', jogo: 'Super Coelho', nome: 'Bandeira do mastro',
    desc: 'A bandeira da Casa Luckham que desce pelo mastro. Fica à esquerda do mastro (o lado direito do quadro encosta nele).',
    largura: 24, altura: 20, ancora: 'centro',
    animacoes: [{ id: 'tremulando', nome: 'Tremulando', quadros: 4, fps: 4 }],
    previa: (g, anim, t) => pintarBandeira(g, 12.5, -8, t),
  },
  {
    chave: 'supercoelho.castelinho', jogo: 'Super Coelho', nome: 'Castelinho do fim da fase',
    desc: 'O castelinho depois do mastro, onde o coelho entra (a porta no meio, embaixo). A bandeirinha em cima continua desenhada pelo jogo. Sem o sprite de um tema, ele continua com o desenho de sempre.',
    largura: 80, altura: 136, ancora: 'pe',
    animacoes: [{ id: 'campo', nome: 'Campos e Copas', quadros: 1, fps: 1 }, { id: 'caverna', nome: 'Tocas', quadros: 1, fps: 1 }],
    previa: (g, anim) => pintarCastelinho(g, -40, 0, anim),
  },
  {
    chave: 'supercoelho.marco', jogo: 'Super Coelho', nome: 'Marco do meio da fase',
    desc: 'A bandeirinha do meio da fase: cinza até o coelho passar, dourada depois (quem morre volta dali).',
    largura: 26, altura: 36, ancora: 'pe',
    animacoes: [{ id: 'apagado', nome: 'Antes de passar', quadros: 1, fps: 1 }, { id: 'aceso', nome: 'Depois de passar', quadros: 4, fps: 4 }],
    previa: (g, anim, t) => pintarMarco(g, 0, 0, anim === 'aceso', t),
  },
  {
    chave: 'supercoelho.alavanca', jogo: 'Super Coelho', nome: 'Alavanca do castelo',
    desc: 'A alavanca atrás do Raposo que derruba a ponte. Parada: inclinada para a esquerda, com um brilho; puxada: para a direita.',
    largura: 32, altura: 30, ancora: 'pe',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 4, fps: 3 }, { id: 'puxada', nome: 'Puxada', quadros: 1, fps: 1 }],
    previa: (g, anim, t) => pintarAlavanca(g, 0, 0, anim === 'puxada', t),
  },
  {
    chave: 'supercoelho.princesa', jogo: 'Super Coelho', nome: 'Princesa Cenoura',
    desc: 'A Princesa Cenoura no fim do castelo, de frente. Feliz: pulando e acenando depois do resgate (os coraçõezinhos continuam por cima).',
    largura: 30, altura: 44, ancora: 'pe',
    animacoes: [{ id: 'esperando', nome: 'Esperando', quadros: 1, fps: 2 }, { id: 'feliz', nome: 'Feliz', quadros: 4, fps: 8 }],
    previa: (g, anim, t) => desenharPrincesa(g, 0, 0, t, anim === 'feliz'),
  },

  /* Enfeites (não encostam em nada) */
  {
    chave: 'supercoelho.arvore', jogo: 'Super Coelho', nome: 'Árvore',
    desc: 'As árvores do fundo dos Campos, com o pé do tronco no fundo do quadro (o jogo aumenta ou diminui um pouco cada uma).',
    largura: 56, altura: 44, ancora: 'pe',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: enfeite({ tp: 'arvore', x: 0, y: 0, tam: TAM_ARVORE }),
  },
  {
    chave: 'supercoelho.arbusto', jogo: 'Super Coelho', nome: 'Arbusto',
    desc: 'Os arbustos dos Campos, em três tamanhos (todos no quadro do maior).',
    largura: 52, altura: 14, ancora: 'pe',
    animacoes: [
      { id: 'pequeno', nome: 'Pequeno', quadros: 1, fps: 1 },
      { id: 'medio', nome: 'Médio', quadros: 1, fps: 1 },
      { id: 'grande', nome: 'Grande', quadros: 1, fps: 1 },
    ],
    previa: enfeite(anim => { const tam = { pequeno: 1, medio: 2, grande: 3 }[anim] || 3; return { tp: 'arbusto', x: -tam * 0.5, y: 0, tam }; }),
  },
  {
    chave: 'supercoelho.flores', jogo: 'Super Coelho', nome: 'Flores',
    desc: 'O tufinho de três flores dos Campos e das Copas. Os quadros são as variações de cor que o jogo espalha (não anima).',
    largura: 14, altura: 9, ancora: 'pe',
    animacoes: [{ id: 'paradas', nome: 'Paradas', quadros: 4, fps: 2 }],
    previa: enfeite((anim, t) => ({ tp: 'flores', x: 0, y: 0, cor: Math.floor(t * 2) % 4 })),
  },
  {
    chave: 'supercoelho.capim', jogo: 'Super Coelho', nome: 'Capim',
    desc: 'O capinzinho dos Campos, balançando com o vento.',
    largura: 12, altura: 9, ancora: 'pe',
    animacoes: [{ id: 'balancando', nome: 'Balançando', quadros: 4, fps: 3 }],
    previa: enfeite({ tp: 'capim', x: 0, y: 0 }),
  },
  {
    chave: 'supercoelho.cristal', jogo: 'Super Coelho', nome: 'Cristal',
    desc: 'Os cristais que brilham no chão das Tocas, de três cores.',
    largura: 24, altura: 16, ancora: 'pe',
    animacoes: [
      { id: 'azul', nome: 'Azul', quadros: 4, fps: 3 },
      { id: 'roxo', nome: 'Roxo', quadros: 4, fps: 3 },
      { id: 'verde', nome: 'Verde', quadros: 4, fps: 3 },
    ],
    previa: enfeite(anim => ({ tp: 'cristal', x: 0, y: 0, cor: Math.max(0, ['azul', 'roxo', 'verde'].indexOf(anim)) })),
  },
  {
    chave: 'supercoelho.cogumelo', jogo: 'Super Coelho', nome: 'Cogumelo',
    desc: 'O cogumelo azul que brilha no chão das Tocas.',
    largura: 14, altura: 10, ancora: 'pe',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 4, fps: 3 }],
    previa: enfeite({ tp: 'cogumelo', x: 0, y: 0 }),
  },
  {
    chave: 'supercoelho.estalactite', jogo: 'Super Coelho', nome: 'Estalactite',
    desc: 'A ponta de pedra pendurada no teto das Tocas, com o topo no alto do quadro (o jogo muda o tamanho de cada uma; a gota que pinga continua por cima).',
    largura: 8, altura: 18, ancora: 'topo',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: enfeite({ tp: 'estalactite', x: 0, y: 0, tam: TAM_ESTALACTITE }, { semPingo: true }),
  },
  {
    chave: 'supercoelho.cipo', jogo: 'Super Coelho', nome: 'Cipó',
    desc: 'O cipó pendurado embaixo das copas, com o topo no alto do quadro (o jogo muda o comprimento de cada um).',
    largura: 10, altura: 40, ancora: 'topo',
    animacoes: [{ id: 'balancando', nome: 'Balançando', quadros: 4, fps: 2 }],
    previa: enfeite({ tp: 'cipo', x: 0, y: 0, tam: TAM_CIPO }),
  },
  {
    chave: 'supercoelho.tocha', jogo: 'Super Coelho', nome: 'Tocha',
    desc: 'A tocha na parede do castelo (o brilho em volta continua desenhado pelo jogo).',
    largura: 10, altura: 22, ancora: 'pe',
    animacoes: [{ id: 'acesa', nome: 'Acesa', quadros: 4, fps: 8 }],
    previa: enfeite({ tp: 'tocha', x: 0, y: -10 }, { semBrilho: true }),
  },
  {
    chave: 'supercoelho.corrente', jogo: 'Super Coelho', nome: 'Corrente',
    desc: 'Um elo das correntes penduradas no teto do castelo, repetido para baixo. Os quadros se alternam elo por elo (o de frente e o de lado).',
    largura: 5, altura: 5, ancora: 'topo',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 2, fps: 2 }],
    previa: (g, anim, t) => {
      g.strokeStyle = '#5a5450'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 2.5, Math.floor(t * 2) % 2 ? 0.8 : 1.8, 2.6, 0, 0, Math.PI * 2); g.stroke();
    },
  },
  {
    chave: 'supercoelho.estandarte', jogo: 'Super Coelho', nome: 'Estandarte',
    desc: 'O estandarte vermelho do Raposo, pendurado no castelo (também nos do fundo), com a barra no alto do quadro.',
    largura: 20, altura: 38, ancora: 'topo',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarEstandarte(g, 0, 2, 1),
  },
];
registrarPecas(SPRITES);

// Quem assiste: o mapa vem dos dados da fase mais as mudanças (blocos quebrados, Lírios pegos) que estão na tela.
const vista = { f: -1, mapa: null, aplicados: [] };
function mapaDaFoto(F) {
  const base = nivelBase(F.f);
  if (vista.f !== F.f) { vista.f = F.f; vista.mapa = base.mapa.slice(); vista.aplicados = []; }
  for (const i of vista.aplicados) vista.mapa[i] = base.mapa[i];
  vista.aplicados = [];
  for (const [i, v] of F.mu || []) { vista.mapa[i] = v; vista.aplicados.push(i); }
  return vista.mapa;
}

export default {
  id: 'supercoelho',
  nome: 'Super Coelho',
  icone: 'cenoura',
  sub: 'Atravesse campos, tocas e copas das árvores para salvar a Princesa Cenoura do castelo do Raposo.',
  subDesafio: 'Todos largam juntos nas mesmas fases: quem fizer mais pontos antes de perder as vidas vence.',
  subJunto: {
    versus: 'Todos correm na mesma fase, ao mesmo tempo, vendo os outros coelhos: quem tocar primeiro no mastro (ou puxar a alavanca) vence.',
    coop: 'A equipe atravessa as quatro fases junta, com vidas em comum: quando alguém chega no mastro, todos passam de fase.',
  },
  largura: W,
  altura: H,
  cor: '#0e1811',
  controles: { cima: false, baixo: true, pular: 'Pular', acao: 'Correr', cimaPula: true },
  instrucoes: {
    teclado: 'Setas ou A/D para andar, Espaço, Z ou seta para cima para pular (segure para ir mais alto), X ou Shift para correr e jogar fogo, seta para baixo para agachar.',
    toque: 'Setas para andar e agachar, Pular para pular (segure para ir mais alto) e Correr para correr e jogar fogo.',
  },
  // As linhas do "como jogar" cujo nome acompanha o nome da peça (quem troca os sprites pode renomear).
  pecasComoJogar: {
    'Cenoura': 'supercoelho.cenoura',
    'Flor de Fogo': 'supercoelho.flor-de-fogo',
    'Estrela': 'supercoelho.estrela',
    'Trevo': 'supercoelho.trevo',
    'Raposo': 'supercoelho.raposo',
  },
  comoJogar: [
    ['🐰', 'Super Coelho', 'chega ao mastro no fim de cada fase. Segure Correr para ir mais rápido e pular mais longe.'],
    ['❓', 'Blocos', 'bata a cabeça por baixo: saem Lírios (200 pontos) e poderes. Grande, o coelho quebra tijolos.'],
    ['🥕', 'Cenoura', 'deixa o coelho grande. Um toque de inimigo só faz ele voltar a ser pequeno.'],
    ['🌺', 'Flor de Fogo', 'com Correr, o coelho joga bolas de fogo que quicam no chão.'],
    ['⭐', 'Estrela', 'dez segundos invencível: é só encostar nos inimigos.'],
    ['🍀', 'Trevo', 'uma vida a mais. Juntar 100 Lírios também dá uma vida.'],
    ['🦊', 'Inimigos', 'pule nas raposinhas e nos tatus (chute a bolinha!). O ouriço tem espinhos: só fogo ou estrela.'],
    ['🏰', 'Raposo', 'no castelo, puxe a alavanca atrás dele (ou acerte 5 bolas de fogo) para salvar a princesa.'],
  ],
  criar,
  desenharFoto(g, foto, t) {
    if (!foto || foto.f == null || !FASES[foto.f]) return;
    desenharCena(g, foto, mapaDaFoto(foto), t, null);
  },
};
