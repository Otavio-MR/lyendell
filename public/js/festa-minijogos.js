// Minijogos da Festa na Toca (tabuleiro estilo festa): seis jogos rápidos para 2 a 4 coelhos ao mesmo tempo.
// Cada jogo segue o contrato da tela da festa: criar(ctx) devolve uma instância com atualizar, desenhar,
// resultadoCpu e acabou. Tudo o que precisa sair igual em todas as telas (objetos, alvos, CPUs) vem da semente
// e do relógio compartilhado; as simulações das CPUs usam só aritmética simples (sem seno/exp do motor).

import { desenharCoelho, desenharRaposa, elipse, sombrear, sorte as semente } from './desenho-coelho.js';
import { registrarPecas, desenharSprite, spriteDe } from './sprites.js';

const L = 640;
const A = 400;
const TAU = Math.PI * 2;
const FPS = 60;
const FONTE = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
const COR_TIME = { azul: '#3b82f6', vermelho: '#ef4444' };
const NOME_TIME = { azul: 'Azul', vermelho: 'Vermelho' };
const PELOS = ['#e9dcc3', '#c99a6b', '#8a6a4f', '#f7f3ea', '#5b4a3f', '#d9b48a', '#9aa3ad', '#e2b3a3', '#b9875a', '#ede4d3'];
// 10 cores bem diferentes (as 4 primeiras são as de sempre)
const CORES = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#a855f7', '#be123c', '#84cc16', '#64748b', '#8b5a2b'];
// Para trocar uma cor repetida, estas vêm primeiro (longe das cores da sala).
const CORES_TROCA = ['#14b8a6', '#64748b', '#84cc16', '#8b5a2b', '#be123c', '#0ea5e9', '#f8fafc', '#facc15', ...CORES];
const CONFETES = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
const SETAS = ['cima', 'baixo', 'esq', 'dir'];
const SEM_TECLAS = new Set();

/* ─── utilidades ─────────────────────────────────── */

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const red = (v, c = 100) => Math.round(v * c) / c;
const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const entre = (r, a, b) => a + r() * (b - a);
const num = (v, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const suave = (atual, alvo, dt, k = 14) => atual + (alvo - atual) * (1 - Math.exp(-k * dt));
const aperto = (e, ...nomes) => nomes.some(n => e.apertou.has(n));
const decimal = v => String(v).replace('.', ',');

function hashTexto(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// A semente da rodada vira número (aceita número ou texto).
function numSemente(ctx) {
  const s = ctx.semente;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.floor(Math.abs(s)) >>> 0;
  if (typeof s === 'string' && s) return hashTexto(s);
  try { return Math.floor(num(ctx.sorte?.(), 0.5) * 4294967296) >>> 0; } catch { return 12345; }
}

// Um fluxo de números próprio para cada uso, todos derivados da mesma semente.
const fluxo = (base, sal) => semente((base ^ hashTexto(sal)) >>> 0);

// Seno só com aritmética (igual em qualquer navegador), para o que precisa ser determinístico.
function seno(x) {
  let a = x - Math.floor(x / TAU) * TAU;
  let s = 1;
  if (a > Math.PI) { a -= Math.PI; s = -1; }
  const p = a * (Math.PI - a);
  return s * (16 * p) / (5 * Math.PI * Math.PI - 4 * p);
}

const resSobrev = (vivo, tempo) => ({ pontos: 0, vivo: !!vivo, tempo: red(Math.max(0, tempo)) });
const resCorrida = (chegou, tempo, prog) => ({ pontos: chegou ? 100 : limitar(Math.floor(prog), 0, 99), vivo: !!chegou, tempo: red(Math.max(0, tempo)) });
const resPontos = p => ({ pontos: Math.max(0, Math.round(p)), vivo: true, tempo: 0 });

// Corta o texto até caber na largura (com a fonte já escolhida em g).
function caber(g, s, max) {
  if (g.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function curto(nome, n = 11) {
  const s = String(nome ?? '?');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ─── desenho comum ──────────────────────────────── */

function ret(g, x, y, w, h, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r > 0 && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}

function borda(g, x, y, w, h, cor, lw, r = 0) {
  g.strokeStyle = cor;
  g.lineWidth = lw;
  g.beginPath();
  if (r > 0 && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.stroke();
}

function texto(g, s, x, y, { cor = '#fff', tam = 16, peso = 700, alinhar = 'center', contorno = 'rgba(0,0,0,0.55)', base = 'middle' } = {}) {
  g.font = `${peso} ${Math.max(1, Math.round(tam))}px ${FONTE}`;
  g.textAlign = alinhar;
  g.textBaseline = base;
  if (contorno) {
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, tam / 5);
    g.strokeStyle = contorno;
    g.strokeText(s, x, y);
  }
  g.fillStyle = cor;
  g.fillText(s, x, y);
}

function estrela(g, x, y, r, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

const ANG_SETA = { dir: 0, baixo: Math.PI / 2, esq: Math.PI, cima: -Math.PI / 2 };
function seta(g, x, y, tam, dir, cor, contorno = 'rgba(0,0,0,0.35)') {
  g.save();
  g.translate(x, y);
  g.rotate(ANG_SETA[dir] ?? 0);
  g.beginPath();
  g.moveTo(tam, 0);
  g.lineTo(0, -tam * 0.85);
  g.lineTo(0, -tam * 0.38);
  g.lineTo(-tam * 0.9, -tam * 0.38);
  g.lineTo(-tam * 0.9, tam * 0.38);
  g.lineTo(0, tam * 0.38);
  g.lineTo(0, tam * 0.85);
  g.closePath();
  if (contorno) { g.lineJoin = 'round'; g.lineWidth = Math.max(2, tam * 0.18); g.strokeStyle = contorno; g.stroke(); }
  g.fillStyle = cor;
  g.fill();
  g.restore();
}

function nuvem(g, x, y, s) {
  g.fillStyle = 'rgba(255,255,255,0.88)';
  for (const [dx, dy, r] of [[0, 0, 18], [18, -8, 20], [38, 0, 16], [20, 6, 18]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
    g.fill();
  }
}

function bandeirolas(g, y, rel, cores = CONFETES) {
  g.strokeStyle = 'rgba(80,50,30,0.7)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, y);
  g.quadraticCurveTo(L / 2, y + 22, L, y);
  g.stroke();
  for (let k = 0; k < 17; k++) {
    const t = (k + 0.5) / 17;
    const x = t * L;
    const yy = y + 2 * t * (1 - t) * 22 * 2 * 0.5 + Math.sin(rel * 2 + k) * 0.8;
    g.fillStyle = cores[k % cores.length];
    g.beginPath();
    g.moveTo(x - 9, yy);
    g.lineTo(x + 9, yy);
    g.lineTo(x, yy + 15);
    g.closePath();
    g.fill();
  }
}

/* ─── moldura: o que todo minijogo tem ───────────── */

function criarMoldura(ctx, def) {
  const jog = Array.isArray(ctx.jogadores) ? ctx.jogadores : [];
  const N = jog.length;
  const eu = Number.isInteger(ctx.eu) && ctx.eu >= 0 && ctx.eu < N ? ctx.eu : -1;
  const M = {
    def, jog, N, eu, times: ctx.formato === 'times', sem: numSemente(ctx), dur: def.duracao,
    T: -3, fim: false, tFim: 0, posFim: 0, reportado: false, meuRes: null, passos: 0,
    parts: [], popups: [], tremor: 0, relogio: 0, ultimoT: null, contou: new Set(), festejou: false,
  };
  M.ehCpu = i => i !== eu && !!jog[i]?.cpu;
  M.humano = i => !M.ehCpu(i);
  // Cor de cada um; se vier repetida (a sala recicla as cores), troca por uma livre.
  const cores = [];
  const usadas = new Set(jog.map(j => (typeof j?.cor === 'string' ? j.cor.toLowerCase() : '')).filter(Boolean));
  for (let i = 0; i < N; i++) {
    let c = typeof jog[i]?.cor === 'string' && jog[i].cor ? jog[i].cor : null;
    if (c && cores.some(o => o.toLowerCase() === c.toLowerCase())) c = null;
    if (!c) {
      c = CORES[i % CORES.length];
      if (usadas.has(c) || cores.includes(c)) c = CORES_TROCA.find(o => !usadas.has(o) && !cores.includes(o)) ?? c;
    }
    usadas.add(c.toLowerCase());
    cores.push(c);
  }
  M.cor = i => cores[i] ?? CORES[i % CORES.length];
  // Com 6 ou mais, as fichas vão em duas linhas e as plaquinhas ficam mais curtas.
  M.cheio = N >= 6;
  M.baseCena = A - (M.cheio ? 46 : 30);
  M.pelo = i => (hexOk(jog[i]?.visual?.pelo) ? jog[i].visual.pelo : PELOS[i % PELOS.length]);
  M.roupa = i => (jog[i]?.visual?.roupa && typeof jog[i].visual.roupa === 'object' ? jog[i].visual.roupa : null);
  M.nome = i => curto(jog[i]?.nome ?? `Coelho ${i + 1}`);
  M.nomeTag = i => curto(jog[i]?.nome ?? `Coelho ${i + 1}`, M.cheio ? 9 : 11);
  M.time = i => (M.times && COR_TIME[jog[i]?.time] ? jog[i].time : null);
  M.rng = sal => fluxo(M.sem, sal);
  M.Tm = () => (M.T < 0 ? 0 : M.fim ? M.tFim : Math.min(M.T, M.dur));
  M.tempo = () => {
    let t;
    try { t = Number(ctx.tempo?.()); } catch { t = NaN; }
    return Number.isFinite(t) ? t : M.T;
  };
  M.som = n => { try { ctx.som?.(n); } catch { /* sem som */ } };
  M.pos = d => { if (eu >= 0) try { ctx.pos?.(d); } catch { /* rede */ } };
  M.evento = ev => { if (eu >= 0) try { ctx.evento?.(ev); } catch { /* rede */ } };
  M.pegar = ch => { if (eu >= 0) try { ctx.pegar?.(ch); } catch { /* rede */ } };
  M.reportar = r => {
    if (eu < 0 || M.reportado) return;
    M.reportado = true;
    M.meuRes = r;
    try { ctx.reportar?.(r); } catch { /* rede */ }
  };

  // Efeitos (só visuais: podem usar Math.random).
  M.particula = (x, y, o = {}) => {
    if (M.parts.length > 450) M.parts.shift();
    M.parts.push({
      x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, gr: o.gr ?? 300, vida: o.vida ?? 0.8, max: o.vida ?? 0.8,
      cor: o.cor ?? '#fff', tam: o.tam ?? 3, forma: o.forma ?? 'bola', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, alto: !!o.alto,
    });
  };
  M.estouro = (x, y, cor, n = 12, forca = 160, o = {}) => {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU;
      const v = forca * (0.4 + Math.random() * 0.8);
      M.particula(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - forca * 0.3, cor: Array.isArray(cor) ? cor[k % cor.length] : cor, tam: 2 + Math.random() * 3, vida: 0.5 + Math.random() * 0.5, ...o });
    }
  };
  M.popup = (x, y, txt, cor = '#fff', tam = 18) => {
    if (M.popups.length > 30) M.popups.shift();
    M.popups.push({ x, y, txt, cor, tam, vida: 1.1 });
  };
  M.tremer = a => { M.tremor = Math.max(M.tremor, a); };
  M.confete = () => {
    for (let k = 0; k < 150; k++) {
      M.particula(Math.random() * L, -10 - Math.random() * 120, {
        vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 120, gr: 90, vida: 2.6 + Math.random() * 1.6,
        cor: CONFETES[k % CONFETES.length], tam: 3 + Math.random() * 3, forma: 'papel', alto: true,
      });
    }
  };

  M.efeitos = (g, dtv, alto) => {
    for (let k = M.parts.length - 1; k >= 0; k--) {
      const p = M.parts[k];
      if (p.alto !== alto) continue;
      p.vida -= dtv;
      if (p.vida <= 0) { M.parts.splice(k, 1); continue; }
      p.vy += p.gr * dtv;
      p.x += p.vx * dtv;
      p.y += p.vy * dtv;
      p.rot += p.vr * dtv;
      if (p.forma === 'papel') p.vx += Math.sin(p.rot) * 30 * dtv;
      g.globalAlpha = limitar(p.vida / Math.min(0.45, p.max), 0, 1);
      if (p.forma === 'bola') elipse(g, p.x, p.y, p.tam, p.tam, p.cor);
      else if (p.forma === 'estrela') estrela(g, p.x, p.y, p.tam * 1.6, p.cor, p.rot);
      else {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.cor;
        g.fillRect(-p.tam, -p.tam * 0.45, p.tam * 2, p.tam * 0.9);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    if (alto) return;
    for (let k = M.popups.length - 1; k >= 0; k--) {
      const p = M.popups[k];
      p.vida -= dtv;
      if (p.vida <= 0) { M.popups.splice(k, 1); continue; }
      p.y -= 32 * dtv;
      const idade = 1.1 - p.vida;
      const esc = idade < 0.12 ? 0.6 + (idade / 0.12) * 0.6 : 1.2 - Math.min(0.2, (idade - 0.12) * 1.5);
      g.globalAlpha = limitar(p.vida / 0.35, 0, 1);
      texto(g, p.txt, p.x, p.y, { cor: p.cor, tam: p.tam * esc, peso: 700, contorno: 'rgba(30,20,50,0.75)' });
    }
    g.globalAlpha = 1;
  };

  // Um coelho de jogador: anel do time, roupa do clube, plaquinha com o nome.
  M.coelho = (g, i, x, y, o = {}) => {
    const s = o.escala ?? 1;
    const rel = M.relogio;
    g.save();
    if (o.alfa != null) g.globalAlpha = o.alfa;
    const tm = M.time(i);
    if (tm) {
      g.strokeStyle = COR_TIME[tm];
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y + 1, 21 * s, 6.5 * s, 0, 0, TAU);
      g.stroke();
    } else if (i === eu) {
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y + 1, 20 * s, 6 * s, 0, 0, TAU);
      g.stroke();
    }
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (s !== 1) g.scale(s, s);
    desenharCoelho(g, 0, 0, {
      pelo: M.pelo(i), roupa: M.roupa(i), dir: o.dir ?? 1, passo: o.passo ?? 0, andando: !!o.andando, t: rel + i * 0.7, pose: o.pose ?? null,
    });
    g.restore();
    if (o.tonto) {
      for (let k = 0; k < 3; k++) {
        const a = rel * 4 + (k * TAU) / 3;
        estrela(g, x + Math.cos(a) * 14 * s, y - 50 * s + Math.sin(a) * 4 * s, 4.5, '#ffd166', a);
      }
    }
    const degrau = M.cheio && o.escalonar !== false ? (i % 2) * 14 : 0;
    if (o.etiqueta !== false) M.etiqueta(g, i, x, y - (o.altEtiqueta ?? 64) * s - degrau, o.alfa);
  };

  M.etiqueta = (g, i, x, y, alfa) => {
    const nome = M.nomeTag(i);
    g.save();
    if (alfa != null) g.globalAlpha = alfa;
    g.font = `700 11px ${FONTE}`;
    const w = g.measureText(nome).width + 14;
    ret(g, x - w / 2, y - 8, w, 16, M.cor(i), 8);
    borda(g, x - w / 2, y - 8, w, 16, 'rgba(255,255,255,0.7)', 1.2, 8);
    texto(g, nome, x, y + 0.5, { tam: 11, contorno: 'rgba(0,0,0,0.4)' });
    if (i === eu) {
      const b = Math.sin(M.relogio * 6) * 2;
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(x - 6, y - 16 + b);
      g.lineTo(x + 6, y - 16 + b);
      g.lineTo(x, y - 10 + b);
      g.closePath();
      g.fill();
    }
    g.restore();
  };

  return M;
}

// Monta a instância a partir da moldura e do jogo (J).
function montar(ctx, def, fabrica) {
  const M = criarMoldura(ctx, def);
  const J = fabrica(M);
  const valido = i => Number.isInteger(i) && i >= 0 && i < M.N && i !== M.eu;

  function textoMeu() {
    if (J.textoMeu) return J.textoMeu();
    if (M.eu < 0) return 'Assistindo';
    const p = J.placar(M.eu, M.Tm());
    if (def.tipo === 'sobrevivencia') return p.vivo ? 'De pé!' : 'Fora';
    if (def.tipo === 'corrida') return p.vivo ? 'Chegou!' : `${p.pontos}%`;
    return `Pontos: ${p.pontos}`;
  }

  function textoFim() {
    if (M.eu < 0) return 'Que festa!';
    const p = J.placar(M.eu, M.Tm());
    if (def.tipo === 'sobrevivencia') return p.vivo ? 'Você ficou de pé até o fim!' : `Você aguentou ${decimal(Math.floor(p.tempo))} s`;
    if (def.tipo === 'corrida') return p.vivo ? `Você chegou em ${decimal(p.tempo.toFixed(1))} s!` : `Você fez ${p.pontos}% do percurso`;
    return `Você fez ${p.pontos} ${p.pontos === 1 ? 'ponto' : 'pontos'}!`;
  }

  function textoTimes(Tm) {
    const tot = { azul: [], vermelho: [] };
    for (let i = 0; i < M.N; i++) { const t = M.time(i); if (t) tot[t].push(J.placar(i, Tm)); }
    const lado = t => {
      const v = tot[t];
      if (!v.length) return '0';
      if (def.tipo === 'pontos') return decimal(red(v.reduce((s, p) => s + p.pontos, 0) / v.length, 10));
      if (def.tipo === 'sobrevivencia') return `${v.filter(p => p.vivo).length}/${v.length} de pé`;
      return `${Math.round(v.reduce((s, p) => s + (p.vivo ? 100 : p.pontos), 0) / v.length)}%`;
    };
    return [lado('azul'), lado('vermelho')];
  }

  function hud(g, T) {
    const Tm = M.Tm();
    const resta = T < 0 ? M.dur : Math.max(0, Math.ceil(M.dur - Tm));
    const urgente = T >= 0 && !M.fim && resta <= 5;
    // título
    g.font = `700 13px ${FONTE}`;
    const tit = `${def.emoji} ${def.nome}`;
    const wt = g.measureText(tit).width + 20;
    ret(g, 8, 7, wt, 26, 'rgba(25,18,48,0.72)', 13);
    texto(g, tit, 8 + wt / 2, 20.5, { tam: 13, contorno: null });
    // relógio
    const pulsa = urgente ? 1 + Math.max(0, Math.sin(M.relogio * 10)) * 0.08 : 1;
    g.save();
    g.translate(L / 2, 21);
    g.scale(pulsa, pulsa);
    ret(g, -46, -16, 92, 32, urgente ? '#ef4444' : 'rgba(25,18,48,0.8)', 16);
    borda(g, -46, -16, 92, 32, 'rgba(255,255,255,0.85)', 2, 16);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(-26, 0, 8, 0, TAU);
    g.moveTo(-26, 0);
    g.lineTo(-26, -5);
    g.moveTo(-26, 0);
    g.lineTo(-22, 2);
    g.stroke();
    texto(g, `${resta}`, 10, 1, { tam: 22, contorno: null });
    g.restore();
    // meu placar
    const meu = textoMeu();
    g.font = `700 14px ${FONTE}`;
    const wm = g.measureText(meu).width + 22;
    ret(g, L - 8 - wm, 7, wm, 26, M.eu >= 0 ? M.cor(M.eu) : 'rgba(25,18,48,0.72)', 13);
    borda(g, L - 8 - wm, 7, wm, 26, 'rgba(255,255,255,0.8)', 1.5, 13);
    texto(g, meu, L - 8 - wm / 2, 20.5, { tam: 14, contorno: 'rgba(0,0,0,0.4)' });
    // placar dos times
    if (M.times) {
      const [az, vm] = textoTimes(Tm);
      ret(g, L / 2 - 120, 41, 240, 20, 'rgba(25,18,48,0.66)', 10);
      texto(g, `Azul ${az}`, L / 2 - 8, 51, { tam: 12, cor: '#93c5fd', alinhar: 'right', contorno: null });
      texto(g, '×', L / 2, 51, { tam: 12, contorno: null });
      texto(g, `${vm} Vermelho`, L / 2 + 8, 51, { tam: 12, cor: '#fca5a5', alinhar: 'left', contorno: null });
    }
    // fichas dos jogadores
    if (J.semFichas) return;
    if (!M.cheio) {
      // até 5: uma linha, como sempre
      const w = (L - 16 - (M.N - 1) * 6) / Math.max(1, M.N);
      for (let i = 0; i < M.N; i++) {
        const x = 8 + i * (w + 6);
        const y = A - 27;
        const p = J.placar(i, Tm);
        ret(g, x, y, w, 22, 'rgba(25,18,48,0.74)', 11);
        if (i === M.eu) borda(g, x, y, w, 22, M.cor(i), 2, 11);
        const tm = M.time(i);
        elipse(g, x + 12, y + 11, 7, 7, M.cor(i));
        if (tm) { g.strokeStyle = COR_TIME[tm]; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 12, y + 11, 8.5, 0, TAU); g.stroke(); }
        g.font = `700 11px ${FONTE}`;
        const ws = g.measureText(p.status).width;
        texto(g, caber(g, M.nome(i), w - 40 - ws), x + 24, y + 11.5, { tam: 11, alinhar: 'left', contorno: null, cor: p.fora ? 'rgba(255,255,255,0.55)' : '#fff' });
        texto(g, p.status, x + w - 8, y + 11.5, { tam: 11, alinhar: 'right', contorno: null, cor: p.fora ? '#fca5a5' : '#ffd166' });
      }
      return;
    }
    // 6 ou mais: duas linhas de fichas menores
    const porLinha = Math.ceil(M.N / 2);
    const w = (L - 16 - (porLinha - 1) * 6) / porLinha;
    for (let i = 0; i < M.N; i++) {
      const x = 8 + (i % porLinha) * (w + 6);
      const y = A - 44 + Math.floor(i / porLinha) * 22;
      const p = J.placar(i, Tm);
      ret(g, x, y, w, 19, 'rgba(25,18,48,0.74)', 9.5);
      if (i === M.eu) borda(g, x, y, w, 19, M.cor(i), 2, 9.5);
      const tm = M.time(i);
      elipse(g, x + 11, y + 9.5, 5.5, 5.5, M.cor(i));
      if (tm) { g.strokeStyle = COR_TIME[tm]; g.lineWidth = 2.2; g.beginPath(); g.arc(x + 11, y + 9.5, 7.2, 0, TAU); g.stroke(); }
      g.font = `700 10px ${FONTE}`;
      const ws = g.measureText(p.status).width;
      texto(g, caber(g, M.nome(i), w - 34 - ws), x + 21, y + 10, { tam: 10, alinhar: 'left', contorno: null, cor: p.fora ? 'rgba(255,255,255,0.55)' : '#fff' });
      texto(g, p.status, x + w - 7, y + 10, { tam: 10, alinhar: 'right', contorno: null, cor: p.fora ? '#fca5a5' : '#ffd166' });
    }
  }

  function sobre(g, T) {
    if (T < 0 && !M.fim) {
      g.fillStyle = 'rgba(20,12,40,0.38)';
      g.fillRect(0, 0, L, A);
      ret(g, 130, 66, 380, 78, 'rgba(255,255,255,0.94)', 18);
      borda(g, 130, 66, 380, 78, '#ffd166', 3, 18);
      texto(g, `${def.emoji} ${def.nome}`, L / 2, 92, { tam: 24, cor: '#3b2a6b', contorno: null });
      texto(g, J.dica, L / 2, 122, { tam: 14, cor: '#6b5a9a', contorno: null, peso: 600 });
      const n = Math.ceil(-T);
      const p = n + T; // 0 no começo do número, 1 no fim
      const esc = 1.5 - 0.5 * Math.min(1, p * 5);
      g.save();
      g.globalAlpha = 1 - Math.max(0, p - 0.75) * 2;
      texto(g, String(Math.min(3, Math.max(1, n))), L / 2, 250, { tam: 110 * esc, cor: ['#06d6a0', '#ffd166', '#ff5d8f'][limitar(n, 1, 3) - 1], contorno: '#fff', peso: 700 });
      g.restore();
    } else if (T < 0.9 && !M.fim) {
      const p = T / 0.9;
      g.save();
      g.globalAlpha = 1 - p * p;
      texto(g, 'Já!', L / 2, 210, { tam: 90 + p * 50, cor: '#ffd166', contorno: '#ff5d8f' });
      g.restore();
    }
    if (!M.fim && T >= 0 && M.eu >= 0) {
      const aviso = J.aviso?.();
      if (aviso) {
        g.font = `700 13px ${FONTE}`;
        const w = g.measureText(aviso).width + 26;
        ret(g, L / 2 - w / 2, M.times ? 66 : 44, w, 24, 'rgba(25,18,48,0.78)', 12);
        texto(g, aviso, L / 2, (M.times ? 66 : 44) + 12.5, { tam: 13, contorno: null, cor: '#ffd166' });
      }
    }
    if (M.fim) {
      const idade = Math.max(M.posFim, M.T - M.tFim);
      g.fillStyle = 'rgba(20,12,40,0.3)';
      g.fillRect(0, 0, L, A);
      const esc = idade < 0.25 ? 0.4 + (idade / 0.25) * 0.8 : 1.2 - Math.min(0.2, (idade - 0.25) * 0.8);
      g.save();
      g.translate(L / 2, 175);
      g.rotate(-0.04);
      g.scale(esc, esc);
      ret(g, -150, -42, 300, 84, '#ff5d8f', 22);
      borda(g, -150, -42, 300, 84, '#fff', 4, 22);
      texto(g, 'Fim!', 0, 2, { tam: 64, cor: '#fff', contorno: '#9d174d' });
      g.restore();
      texto(g, textoFim(), L / 2, 245, { tam: 20, cor: '#ffd166', contorno: 'rgba(30,20,50,0.85)' });
    }
  }

  const inst = {
    atualizar(dt, entrada) {
      dt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 1 / FPS;
      const en = entrada || {};
      const e = {
        esq: !!en.esq, dir: !!en.dir, cima: !!en.cima, baixo: !!en.baixo, pular: !!en.pular, acao: !!en.acao,
        apertou: en.apertou instanceof Set ? en.apertou : Array.isArray(en.apertou) ? new Set(en.apertou) : SEM_TECLAS,
        ponteiro: en.ponteiro || en.mouse || en.toque || null,
      };
      const T = M.tempo();
      M.T = T;
      if (T < 0) {
        const n = Math.ceil(-T);
        if (n >= 1 && n <= 3 && !M.contou.has(n)) { M.contou.add(n); M.som('alerta'); }
        return; // congelado na contagem
      }
      if (!M.contou.has(0)) { M.contou.add(0); M.som('fase'); }
      M.passos++;
      if (!M.fim) {
        const Tj = Math.min(T, M.dur);
        J.passo(Tj, dt, e);
        if (T >= M.dur || J.todosProntos(Tj)) {
          M.fim = true;
          M.tFim = Tj;
          M.som('fim');
        }
      }
      if (M.fim) {
        M.posFim += dt;
        if (M.eu >= 0 && !M.reportado && (!J.podeReportar || J.podeReportar(M.posFim))) M.reportar(J.meuResultado());
      }
    },
    desenhar(g, t) {
      const tv = num(t, M.relogio);
      let dtv = M.ultimoT == null ? 0 : tv - M.ultimoT;
      if (!(dtv >= 0)) dtv = 0;
      dtv = Math.min(0.05, dtv);
      M.ultimoT = tv;
      M.relogio += dtv;
      const T = M.tempo();
      M.T = Math.max(M.T, T);
      if (M.fim && !M.festejou) { M.festejou = true; M.confete(); }
      g.save();
      if (M.tremor > 0.2) g.translate((Math.random() - 0.5) * M.tremor * 2, (Math.random() - 0.5) * M.tremor * 2);
      M.tremor = Math.max(0, M.tremor - dtv * 40);
      J.cena(g, M.Tm(), M.relogio, dtv);
      M.efeitos(g, dtv, false);
      g.restore();
      hud(g, T);
      sobre(g, T);
      M.efeitos(g, dtv, true);
    },
    resultadoCpu(k) { return { ...J.resultadoCpu(k) }; },
    acabou() {
      if (!M.fim || (M.eu >= 0 && !M.reportado)) return false;
      return Math.max(M.posFim, M.tempo() - M.tFim) >= 1.2;
    },
    // Extras (opcionais para a tela): placar visto agora, resumo do mundo, mira por toque/mouse.
    placar() {
      const Tm = M.Tm();
      return Array.from({ length: M.N }, (_, i) => { const p = J.placar(i, Tm); return { pontos: p.pontos, vivo: p.vivo, tempo: p.tempo }; });
    },
    resumo() { return J.resumo(M.Tm()); },
    depurar() { return { fim: M.fim, ...(J.depurar ? J.depurar(M.Tm()) : {}) }; },
    apontar(x, y, atirar = false) { if (J.apontar && Number.isFinite(x) && Number.isFinite(y)) J.apontar(x, y, !!atirar); },
    aoPos: (i, d) => { if (valido(i) && d && typeof d === 'object') try { J.aoPos?.(i, d); } catch { /* dado ruim */ } },
    aoEvento: (i, ev) => { if (valido(i) && ev && typeof ev.tipo === 'string') try { J.aoEvento?.(i, ev); } catch { /* dado ruim */ } },
    aoPegou: (i, chave) => { if (Number.isInteger(i) && i >= 0 && i < M.N && typeof chave === 'string') try { J.aoPegou?.(i, chave); } catch { /* dado ruim */ } },
  };
  return inst;
}

// Lê uma trilha gravada a 60 por segundo, com interpolação.
function amostra(arr, T) {
  const s = limitar(T * FPS, 0, arr.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  return i + 1 < arr.length ? arr[i] + (arr[i + 1] - arr[i]) * f : arr[i];
}
const indice = (T, n) => limitar(Math.floor(T * FPS + 1e-6), 0, n - 1);

/* ─── 1. Chuva de Bolotas ────────────────────────── */

function desenharBolota(g, x, y, r, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  elipse(g, 0, r * 0.2, r * 0.78, r * 0.92, '#b7742f');
  elipse(g, -r * 0.28, r * 0.15, r * 0.2, r * 0.45, 'rgba(255,255,255,0.28)');
  g.fillStyle = '#6b4423';
  g.beginPath();
  g.ellipse(0, -r * 0.3, r * 0.92, r * 0.55, 0, Math.PI, TAU);
  g.fill();
  g.fillRect(-r * 0.92, -r * 0.34, r * 1.84, r * 0.16);
  g.strokeStyle = '#4a2f18';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -r * 0.8);
  g.lineTo(r * 0.2, -r * 1.2);
  g.stroke();
  g.restore();
}

function desenharPinha(g, x, y, r, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  for (let k = 0; k < 4; k++) {
    const yy = -r * 0.8 + k * r * 0.5;
    const w = r * (0.55 + Math.sin((k + 0.5) / 4 * Math.PI) * 0.45);
    elipse(g, 0, yy, w, r * 0.32, k % 2 ? '#7a4a22' : '#94602e');
    elipse(g, -w * 0.3, yy - 1, w * 0.25, r * 0.12, 'rgba(255,230,190,0.25)');
  }
  g.restore();
}

function desenharPedra(g, x, y, r, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  elipse(g, 0, 0, r, r, '#8d8f99');
  elipse(g, r * 0.12, r * 0.15, r * 0.85, r * 0.8, '#7a7c86');
  elipse(g, -r * 0.35, -r * 0.35, r * 0.32, r * 0.22, 'rgba(255,255,255,0.35)');
  g.strokeStyle = '#555762';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-r * 0.2, -r * 0.1);
  g.lineTo(r * 0.25, r * 0.2);
  g.lineTo(r * 0.15, r * 0.6);
  g.moveTo(r * 0.25, r * 0.2);
  g.lineTo(r * 0.6, r * 0.1);
  g.stroke();
  elipse(g, -r * 0.45, r * 0.4, r * 0.12, r * 0.1, '#6a8f4e');
  g.restore();
}

function jogoChuva(M) {
  const CHAO = 330;
  const GRAV = 1700;
  const PULO = 560;
  const VEL = 230;
  const QUEDA = 0.5;
  const TOPO = 92;
  const { N, eu } = M;
  const dur = M.dur;
  const nP = Math.round(dur * FPS) + 1;
  const xIni = i => 320 + (i - (N - 1) / 2) * Math.min(110, 580 / Math.max(1, N - 1));
  const { deco, copa } = enfeitesChuva(M);

  // A agenda de tudo o que cai (igual em todas as telas).
  const r = M.rng('chuva-objetos');
  const objs = [];
  const add = (tipo, x, t0, aviso) => {
    const o = { k: objs.length, tipo, x: red(x, 10), t0: red(t0, 1000), tq: red(t0 + aviso, 1000), r: tipo === 'pinha' ? 11 : tipo === 'pedra' ? 24 : 9, vel: 0, fimT: 0 };
    objs.push(o);
    return o;
  };
  let t = 1.2;
  while (t < dur - 0.8) {
    const p = t / dur;
    const aviso = 0.95 - 0.35 * p;
    if (t > 6 && r() < 0.06 + 0.1 * p) {
      // fileira com um buraco
      const n = 6;
      const vao = Math.floor(r() * n);
      for (let j = 0; j < n; j++) if (j !== vao) add('bolota', 40 + (560 / n) * (j + 0.5), t, aviso + 0.2);
      t += 1.1;
      continue;
    }
    add(r() < 0.3 ? 'pinha' : 'bolota', entre(r, 26, 614), t, aviso);
    t += (0.85 - 0.55 * p) * entre(r, 0.7, 1.3);
  }
  for (let tb = entre(r, 6, 8.5); tb < dur - 2.5; tb += entre(r, 5, 7.5) - 1.5 * (tb / dur)) {
    const lado = r() < 0.5 ? -1 : 1;
    const o = add('pedra', lado < 0 ? 52 : 588, tb, 1.2);
    o.vel = -lado * red(240 + 110 * (tb / dur), 10);
  }
  objs.sort((a, b) => a.t0 - b.t0 || a.k - b.k);
  for (const o of objs) o.fimT = o.tipo === 'pedra' ? o.tq + 720 / Math.abs(o.vel) : o.tq + 0.35;

  function posObj(o, T) {
    if (T < o.t0 || T >= o.fimT) return null;
    const ini = o.tq - QUEDA;
    const u = limitar((T - o.t0) / (o.tq - o.t0), 0, 1);
    if (T < ini) return { x: o.x, y: TOPO, fase: 'aviso', perigo: false, u, rot: 0 };
    if (T < o.tq) {
      const q = (T - ini) / QUEDA;
      return { x: o.x, y: TOPO + (CHAO - o.r - TOPO) * q * q, fase: 'queda', perigo: true, u, rot: q * 2 };
    }
    if (o.tipo === 'pedra') {
      const d = T - o.tq;
      return { x: o.x + o.vel * d, y: CHAO - o.r, fase: 'rola', perigo: true, u: 1, rot: (d * o.vel) / o.r };
    }
    return { x: o.x, y: CHAO - o.r, fase: 'chao', perigo: T < o.tq + 0.06, u: (T - o.tq) / 0.35, rot: 0 };
  }

  function bate(o, c, px, ph) {
    if (!c || !c.perigo) return false;
    const rr = o.r * 0.82;
    const y1 = CHAO - ph;
    const cx = limitar(c.x, px - 11, px + 11);
    const cy = limitar(c.y, y1 - 38, y1);
    const dx = c.x - cx;
    const dy = c.y - cy;
    return dx * dx + dy * dy < rr * rr;
  }

  // CPUs: andam por um caminho calculado de antemão contra a mesma agenda.
  const cpu = [];
  for (let i = 0; i < N; i++) if (M.ehCpu(i)) cpu[i] = planoCpu(i);
  function planoCpu(i) {
    const rc = M.rng(`chuva-cpu-${i}`);
    const tPlano = rc() < 0.4 ? Infinity : entre(rc, 7, 33);
    const reacao = entre(rc, 0.12, 0.3);
    const vel = entre(rc, 175, 215);
    let x = xIni(i);
    let h = 0;
    let vh = 0;
    let alvoX = x;
    let morte = null;
    const xs = new Float32Array(nP);
    const hs = new Float32Array(nP);
    const at = [];
    for (let s = 0; s < nP; s++) {
      const T = s / FPS;
      if (morte === null && s > 0) {
        at.length = 0;
        for (const o of objs) if (o.t0 <= T && T < o.fimT) at.push(o);
        const perigo = xc => {
          for (const o of at) {
            if (T - o.t0 < reacao || (o.tipo === 'pedra' && T >= o.tq)) continue;
            if (o.tq < T - 0.05 || o.tq - T > 1.1) continue;
            if (Math.abs(xc - o.x) < o.r + 24) return true;
          }
          return false;
        };
        if (T < tPlano) {
          if (perigo(alvoX) || perigo(x)) {
            let melhor = null;
            let md = 1e9;
            for (let xc = 30; xc <= 610; xc += 14) {
              if (perigo(xc)) continue;
              const d = Math.abs(xc - x);
              if (d < md) { md = d; melhor = xc; }
            }
            if (melhor !== null) alvoX = melhor;
          }
          for (const o of at) {
            if (o.tipo !== 'pedra' || T < o.tq - 0.02 || h !== 0) continue;
            const bx = o.x + o.vel * (T - o.tq);
            const frente = (x - bx) * Math.sign(o.vel);
            if (frente > 0 && frente < 62) vh = PULO;
          }
        } else {
          let prox = null;
          for (const o of at) if (o.tipo !== 'pedra' && o.tq > T + 0.3 && (!prox || o.tq < prox.tq)) prox = o;
          if (prox) alvoX = prox.x;
        }
        x += limitar(alvoX - x, -vel / FPS, vel / FPS);
        if (h > 0 || vh > 0) {
          h += vh / FPS;
          vh -= GRAV / FPS;
          if (h <= 0) { h = 0; vh = 0; }
        }
        for (const o of at) if (bate(o, posObj(o, T), x, h)) { morte = red(T, 1000); break; }
      }
      xs[s] = x;
      hs[s] = h;
    }
    return { xs, hs, morte };
  }

  const me = { x: eu >= 0 ? xIni(eu) : 0, h: 0, vh: 0, dir: 1, passo: 0, andando: false };
  const rem = Array.from({ length: N }, (_, i) => ({ x: xIni(i), h: 0, ax: xIni(i), ah: 0, dir: 1, passo: 0, andando: false }));
  const morto = Array(N).fill(false);
  const tMorte = Array(N).fill(0);
  const visto = new Set();
  const caidoVisto = Array(N).fill(false);

  const estaMorto = (i, T) => (cpu[i] ? cpu[i].morte !== null && T >= cpu[i].morte : morto[i]);
  const quandoMorreu = i => (cpu[i] ? cpu[i].morte : tMorte[i]);

  function estado(i, T) {
    if (cpu[i]) {
      const c = cpu[i];
      const x = amostra(c.xs, T);
      const xa = amostra(c.xs, Math.max(0, T - 0.05));
      return { x, h: amostra(c.hs, T), dir: x >= xa ? 1 : -1, andando: Math.abs(x - xa) > 0.4, passo: T };
    }
    if (i === eu) return me;
    return rem[i];
  }

  function morrer(T) {
    morto[eu] = true;
    tMorte[eu] = T;
    M.som('pisao');
    M.tremer(12);
    M.estouro(me.x, CHAO - me.h - 30, ['#ffd166', '#fff'], 14, 180, { forma: 'estrela' });
    M.popup(me.x, CHAO - me.h - 80, 'Ai!', '#ff5d8f', 24);
    M.evento({ tipo: 'caiu', t: red(T) });
    M.reportar(resSobrev(false, T));
  }

  return {
    dica: 'Desvie das sombras e pule as pedras!',
    passo(T, dt, e) {
      for (let i = 0; i < N; i++) {
        if (i === eu || cpu[i]) continue;
        const q = rem[i];
        const nx = suave(q.x, q.ax, dt);
        q.andando = Math.abs(nx - q.x) > 0.3;
        if (q.andando) q.passo += dt;
        q.x = nx;
        q.h = suave(q.h, q.ah, dt, 20);
      }
      if (eu < 0 || morto[eu]) return;
      const mov = (e.dir ? 1 : 0) - (e.esq ? 1 : 0);
      me.x = limitar(me.x + mov * VEL * dt, 22, 618);
      if (mov) { me.dir = mov; me.passo += dt; }
      me.andando = mov !== 0;
      if ((e.pular || e.cima || aperto(e, 'pular', 'cima')) && me.h === 0 && me.vh === 0) { me.vh = PULO; M.som('pulo'); }
      if (me.h > 0 || me.vh > 0) {
        me.h += me.vh * dt;
        me.vh -= GRAV * dt;
        if (me.h <= 0) { me.h = 0; me.vh = 0; }
      }
      for (const o of objs) {
        if (o.t0 > T) break;
        if (T < o.fimT && bate(o, posObj(o, T), me.x, me.h)) { morrer(T); break; }
      }
      if (M.passos % 2 === 0) M.pos({ x: red(me.x, 10), h: red(me.h, 10), d: me.dir, m: morto[eu] ? 1 : 0 });
    },
    todosProntos(T) { for (let i = 0; i < N; i++) if (!estaMorto(i, T)) return false; return true; },
    meuResultado() { return morto[eu] ? resSobrev(false, tMorte[eu]) : resSobrev(true, M.dur); },
    resultadoCpu(k) { const c = cpu[k]; if (!c) return resSobrev(true, M.dur); return c.morte === null ? resSobrev(true, M.dur) : resSobrev(false, c.morte); },
    placar(i, Tm) {
      const m = estaMorto(i, Tm);
      const tm = m ? quandoMorreu(i) : Tm;
      return { pontos: 0, vivo: !m, tempo: red(tm), fora: m, status: m ? `Fora ${Math.floor(tm)}s` : 'De pé' };
    },
    aviso() { return morto[eu] ? 'Você foi atingido! Torça pelos outros.' : null; },
    aoPos(i, d) {
      if (cpu[i]) return;
      rem[i].ax = limitar(num(d.x, rem[i].ax), 0, L);
      rem[i].ah = limitar(num(d.h, 0), 0, 200);
      if (d.d === 1 || d.d === -1) rem[i].dir = d.d;
      if (d.m && !morto[i]) { morto[i] = true; tMorte[i] = M.Tm(); }
    },
    aoEvento(i, ev) {
      if (cpu[i] || ev.tipo !== 'caiu') return;
      morto[i] = true;
      tMorte[i] = limitar(num(ev.t, M.Tm()), 0, M.dur);
    },
    resumo(T) {
      const partes = [];
      for (const o of objs) { const c = posObj(o, T); if (c) partes.push(`${o.k}:${c.x.toFixed(1)},${c.y.toFixed(1)}`); }
      for (let i = 0; i < N; i++) if (cpu[i]) { const s = estado(i, T); partes.push(`c${i}:${s.x.toFixed(1)},${s.h.toFixed(1)},${estaMorto(i, T) ? 1 : 0}`); }
      return partes.join('|');
    },
    cena(g, T, rel) {
      // céu, sol e morros
      const ceu = g.createLinearGradient(0, 0, 0, CHAO);
      ceu.addColorStop(0, '#6cc6f5');
      ceu.addColorStop(1, '#ffe7a3');
      g.fillStyle = ceu;
      g.fillRect(0, 0, L, A);
      elipse(g, 470, 150, 42, 42, 'rgba(255,240,170,0.55)');
      elipse(g, 470, 150, 30, 30, '#fff3b0');
      elipse(g, 130, CHAO + 40, 240, 110, '#8fd07f');
      elipse(g, 500, CHAO + 50, 280, 120, '#7cc36d');
      // troncos
      for (const tx of [18, 300, 612]) {
        g.fillStyle = '#7a4e2a';
        g.fillRect(tx - 12, 60, 24, CHAO - 60);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(tx + 4, 60, 8, CHAO - 60);
      }
      // chão
      g.fillStyle = '#8b5a2b';
      g.fillRect(0, CHAO, L, A - CHAO);
      g.fillStyle = '#5fb04a';
      g.fillRect(0, CHAO - 5, L, 12);
      for (const d of deco) {
        if (d.t === 'flor') { elipse(g, d.x, CHAO - 7, 3.5, 3.5, d.c); elipse(g, d.x, CHAO - 7, 1.4, 1.4, '#fff7c2'); }
        else if (d.t === 'cogumelo') { g.fillStyle = '#f3e6d0'; g.fillRect(d.x - 2, CHAO - 9, 4, 6); g.fillStyle = '#e04f4f'; g.beginPath(); g.ellipse(d.x, CHAO - 9, 7, 5, 0, Math.PI, TAU); g.fill(); elipse(g, d.x - 2, CHAO - 11, 1.2, 1.2, '#fff'); }
        else { g.fillStyle = '#4e9a3c'; g.beginPath(); g.moveTo(d.x - 5, CHAO - 3); g.lineTo(d.x - 2, CHAO - 12); g.lineTo(d.x, CHAO - 4); g.lineTo(d.x + 3, CHAO - 13); g.lineTo(d.x + 5, CHAO - 3); g.fill(); }
        if (d.terra) elipse(g, d.x + 10, CHAO + 30 + d.terra, 6, 3, 'rgba(60,35,15,0.35)');
      }
      // copa das árvores
      for (const b of copa) elipse(g, b.x, b.y, b.r, b.r * 0.8, b.c);
      for (const b of copa) elipse(g, b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.45, b.r * 0.32, 'rgba(255,255,255,0.12)');
      // sombras de aviso
      for (const o of objs) {
        if (o.t0 > T) break;
        const c = posObj(o, T);
        if (!c || c.fase === 'rola' || c.fase === 'chao') continue;
        const larg = o.r * (0.6 + 1.1 * c.u) + (o.tipo === 'pedra' ? 8 : 0);
        elipse(g, o.x, CHAO + 2, larg, larg * 0.28, `rgba(40,20,10,${0.18 + 0.4 * c.u})`);
        if (c.u > 0.55) {
          g.strokeStyle = `rgba(239,68,68,${0.4 + 0.5 * Math.abs(Math.sin(rel * 14))})`;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(o.x, CHAO + 2, larg + 3, larg * 0.28 + 2, 0, 0, TAU);
          g.stroke();
        }
        if (o.tipo === 'pedra' && c.fase === 'aviso') texto(g, '!', o.x, CHAO - 30, { tam: 30, cor: '#ef4444', contorno: '#fff' });
      }
      // objetos
      for (const o of objs) {
        if (o.t0 > T) break;
        const c = posObj(o, T);
        if (!c) continue;
        if (T >= o.tq && !visto.has(o.k)) {
          visto.add(o.k);
          if (T < o.tq + 0.3) {
            M.estouro(o.x, CHAO - 4, o.tipo === 'pedra' ? ['#8d8f99', '#6b6e78'] : ['#b7742f', '#6b4423'], o.tipo === 'pedra' ? 16 : 8, o.tipo === 'pedra' ? 200 : 120);
            if (o.tipo === 'pedra') { M.tremer(7); M.som('bater'); }
          }
        }
        if (c.fase === 'chao') continue;
        const balanco = c.fase === 'aviso' ? Math.sin(rel * 30 + o.k) * 0.25 * c.u : c.rot;
        if (c.fase === 'aviso') {
          g.strokeStyle = '#3f6b2a';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(o.x, TOPO - o.r - 14);
          g.lineTo(o.x, TOPO - o.r + 2);
          g.stroke();
        }
        if (o.tipo === 'pedra') {
          if (!desenharSprite(g, 'festa-mini.pedra', 'rolando', c.x, c.y, { t: rel, rot: c.rot, escala: o.r / 24 })) desenharPedra(g, c.x, c.y, o.r, c.rot);
        } else if (o.tipo === 'pinha') {
          if (!desenharSprite(g, 'festa-mini.pinha', 'caindo', c.x, c.y, { t: rel, rot: balanco, escala: o.r / 11 })) desenharPinha(g, c.x, c.y, o.r, balanco);
        } else if (!desenharSprite(g, 'festa-mini.bolota', 'caindo', c.x, c.y, { t: rel, rot: balanco, escala: o.r / 9 })) desenharBolota(g, c.x, c.y, o.r, balanco);
      }
      // coelhos
      for (let i = 0; i < N; i++) {
        const s = estado(i, T);
        const m = estaMorto(i, T);
        if (m && !caidoVisto[i]) {
          caidoVisto[i] = true;
          if (i !== eu) { M.popup(s.x, CHAO - s.h - 80, 'Fora!', '#ff5d8f'); M.estouro(s.x, CHAO - 30, '#ffd166', 8, 140, { forma: 'estrela' }); }
        }
        M.coelho(g, i, s.x, CHAO - s.h, { dir: s.dir, passo: s.passo, andando: s.andando && !m && s.h === 0, tonto: m, rot: m ? 0.25 * s.dir : 0, pose: m ? 'sentado' : null, alfa: m ? 0.8 : 1 });
      }
    },
  };
}

// Enfeites da clareira, iguais em todas as telas (só visual).
function enfeitesChuva(M) {
  const r = M.rng('chuva-enfeites');
  const deco = [];
  for (let k = 0; k < 26; k++) deco.push({ x: 10 + r() * 620, t: ['flor', 'grama', 'grama', 'cogumelo'][Math.floor(r() * 4)], c: CONFETES[Math.floor(r() * CONFETES.length)], terra: r() < 0.5 ? r() * 30 : 0 });
  const copa = [];
  for (let x = -20; x < 680; x += 42) copa.push({ x: x + r() * 12, y: 22 + r() * 30, r: 42 + r() * 18, c: ['#2f7d3a', '#3a8f45', '#2a6e33'][Math.floor(r() * 3)] });
  return { deco, copa };
}

/* ─── 2. Corrida da Toca ─────────────────────────── */

function jogoCorrida(M) {
  const { N, eu } = M;
  const dur = M.dur;
  const nP = Math.round(dur * FPS) + 1;
  const compacto = N >= 6; // raias finas: nome na raia, coelho menor, sem plaquinha
  const INI = compacto ? 112 : 100;
  const META = 585;
  const VMAX = 9;
  const GANHO = 1.15;
  const ATRITO = 1.5;
  const TOPO = M.times ? 66 : 46;
  const BASE = compacto ? M.baseCena - 2 : 366;
  const faixa = (BASE - TOPO) / Math.max(1, N);
  const esc = compacto ? limitar(faixa / 60, 0.45, 0.8) : limitar(faixa / 76, 0.8, 1.3);
  const rRaia = compacto ? Math.min(12, faixa * 0.36) : 12;

  const cpu = [];
  for (let i = 0; i < N; i++) if (M.ehCpu(i)) cpu[i] = planoCpu(i);
  function planoCpu(i) {
    const rc = M.rng(`corrida-cpu-${i}`);
    const freq = entre(rc, 6.3, 8.3);
    const tropeca = entre(rc, 0.01, 0.035);
    const ps = new Float32Array(nP);
    const vs = new Float32Array(nP);
    const tr = new Uint8Array(nP);
    let p = 0;
    let v = 0;
    let prox = entre(rc, 0.1, 0.35);
    let tontoAte = -1;
    let tc = null;
    for (let s = 0; s < nP; s++) {
      const T = s / FPS;
      if (s > 0 && tc === null) {
        if (T >= tontoAte && T >= prox) {
          if (rc() < tropeca) { v = 0; tontoAte = T + 0.6; } else v = Math.min(VMAX, v + GANHO);
          prox = T + (1 / freq) * entre(rc, 0.8, 1.2);
        }
        v *= 1 - ATRITO / FPS;
        p += v / FPS;
        if (p >= 100) { tc = red(T - (p - 100) / Math.max(v, 0.01), 1000); p = 100; }
      }
      ps[s] = p;
      vs[s] = v;
      tr[s] = T < tontoAte ? 1 : 0;
    }
    return { ps, vs, tr, tc };
  }

  const me = { p: 0, v: 0, ultimo: null, tontoAte: -1, passo: 0 };
  const prog = Array(N).fill(0);
  const alvoP = Array(N).fill(0);
  const vel = Array(N).fill(0);
  const tonto = Array(N).fill(false);
  const chegou = Array(N).fill(false);
  const tCheg = Array(N).fill(0);
  const passoAnim = Array(N).fill(0);
  const festejado = Array(N).fill(false);
  const tropVisto = Array(N).fill(false);

  function est(i, T) {
    const c = cpu[i];
    if (c) {
      const k = indice(T, nP);
      const fin = c.tc !== null && T >= c.tc;
      return { p: fin ? 100 : amostra(c.ps, T), v: c.vs[k], tonto: !!c.tr[k], fin, t: c.tc };
    }
    if (i === eu) return { p: me.p, v: me.v, tonto: T < me.tontoAte, fin: chegou[eu], t: tCheg[eu] };
    return { p: prog[i], real: alvoP[i], v: vel[i], tonto: tonto[i], fin: chegou[i], t: tCheg[i] };
  }

  function colocacao(i, T) {
    const s = est(i, T);
    if (!s.fin) return 0;
    let pos = 1;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const o = est(j, T);
      if (o.fin && (o.t < s.t || (o.t === s.t && j < i))) pos++;
    }
    return pos;
  }

  return {
    dica: 'Alterne ← e → o mais rápido que puder!',
    passo(T, dt, e) {
      for (let i = 0; i < N; i++) {
        if (i === eu || cpu[i] || chegou[i]) continue;
        prog[i] = Math.max(prog[i], suave(prog[i], alvoP[i], dt, 10));
      }
      if (eu < 0 || chegou[eu]) return;
      const qe = e.apertou.has('esq');
      const qd = e.apertou.has('dir');
      if (T >= me.tontoAte && (qe || qd)) {
        const tecla = qe && qd ? (me.ultimo === 'esq' ? 'dir' : 'esq') : qe ? 'esq' : 'dir';
        if (tecla === me.ultimo) {
          me.v = 0;
          me.tontoAte = T + 0.6;
          me.ultimo = null;
          M.som('bater');
          M.tremer(5);
          M.popup(INI + (me.p / 100) * (META - INI), TOPO + eu * faixa + faixa * 0.3, 'Tropeçou!', '#ff5d8f', 16);
        } else {
          me.v = Math.min(VMAX, me.v + GANHO);
          me.ultimo = tecla;
        }
      }
      me.v *= 1 - ATRITO * dt;
      me.p += me.v * dt;
      if (me.p >= 100) {
        const tc = Math.max(0, T - (me.p - 100) / Math.max(me.v, 0.01));
        me.p = 100;
        chegou[eu] = true;
        tCheg[eu] = red(tc, 1000);
        M.som('moeda');
        M.evento({ tipo: 'chegou', t: red(tc, 1000) });
        M.reportar(resCorrida(true, tc, 100));
      }
      if (M.passos % 2 === 0) M.pos({ p: red(me.p, 10), v: red(me.v, 10), tr: T < me.tontoAte ? 1 : 0 });
    },
    todosProntos(T) { for (let i = 0; i < N; i++) if (!est(i, T).fin) return false; return true; },
    meuResultado() {
      if (chegou[eu]) return resCorrida(true, tCheg[eu], 100);
      const r = resCorrida(false, M.dur, me.p);
      M.evento({ tipo: 'parou', p: r.pontos }); // as outras telas mostram o mesmo número
      return r;
    },
    resultadoCpu(k) {
      const c = cpu[k];
      if (!c) return resCorrida(false, M.dur, 0);
      return c.tc !== null ? resCorrida(true, c.tc, 100) : resCorrida(false, M.dur, c.ps[nP - 1]);
    },
    placar(i, Tm) {
      const s = est(i, Tm);
      if (s.fin) return { pontos: 100, vivo: true, tempo: red(s.t), status: `${colocacao(i, Tm)}º ${decimal(s.t.toFixed(1))}s` };
      const p = limitar(Math.floor(s.real ?? s.p), 0, 99);
      return { pontos: p, vivo: false, tempo: red(M.fim ? M.dur : Tm), status: `${p}%` };
    },
    textoMeu() {
      if (eu < 0) return 'Assistindo';
      if (chegou[eu]) return `Chegou: ${decimal(tCheg[eu].toFixed(1))}s`;
      return `${Math.floor(me.p)}%`;
    },
    aviso() { return chegou[eu] ? 'Você cruzou a linha! Esperando os outros...' : null; },
    aoPos(i, d) {
      if (cpu[i] || chegou[i]) return;
      alvoP[i] = limitar(num(d.p, alvoP[i]), 0, 100);
      vel[i] = limitar(num(d.v, 0), 0, VMAX);
      tonto[i] = !!d.tr;
    },
    aoEvento(i, ev) {
      if (cpu[i] || chegou[i]) return;
      if (ev.tipo === 'parou') { alvoP[i] = prog[i] = limitar(num(ev.p, alvoP[i]), 0, 99); return; }
      if (ev.tipo !== 'chegou') return;
      chegou[i] = true;
      tCheg[i] = red(limitar(num(ev.t, M.Tm()), 0, M.dur), 1000);
      prog[i] = 100;
      alvoP[i] = 100;
    },
    resumo(T) {
      const partes = [];
      for (let i = 0; i < N; i++) if (cpu[i]) { const s = est(i, T); partes.push(`c${i}:${s.p.toFixed(2)},${s.fin ? 1 : 0}`); }
      return partes.join('|');
    },
    cena(g, T, rel, dtv) {
      const ceu = g.createLinearGradient(0, 0, 0, TOPO);
      ceu.addColorStop(0, '#7cc8f7');
      ceu.addColorStop(1, '#c7ecff');
      g.fillStyle = ceu;
      g.fillRect(0, 0, L, TOPO);
      nuvem(g, 90 + ((rel * 8) % 700) - 60, 18, 0.6);
      nuvem(g, 420 + ((rel * 5) % 700) - 60, 26, 0.5);
      g.fillStyle = '#5fb04a';
      g.fillRect(0, TOPO - 4, L, A - TOPO + 4);
      for (let i = 0; i < N; i++) {
        const y0 = TOPO + i * faixa;
        ret(g, 36, y0 + 3, L - 44, faixa - 6, i % 2 ? '#d9774b' : '#cf6c41', 6);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillRect(36, y0 + 3, L - 44, 2);
        g.fillRect(36, y0 + faixa - 5, L - 44, 2);
        for (let q = 1; q < 4; q++) {
          const x = INI + (q / 4) * (META - INI);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(x - 1, y0 + 6, 2, faixa - 12);
        }
        // largada e chegada
        g.fillStyle = '#fff';
        g.fillRect(INI - 2, y0 + 5, 4, faixa - 10);
        const q = Math.max(4, Math.floor((faixa - 10) / 8));
        const lado = (faixa - 10) / q;
        for (let k = 0; k < q; k++) for (let c = 0; c < 2; c++) {
          g.fillStyle = (k + c) % 2 ? '#1f2937' : '#fff';
          g.fillRect(META + c * lado, y0 + 5 + k * lado, lado, lado);
        }
        // número da raia
        elipse(g, 20, y0 + faixa / 2, rRaia, rRaia, M.cor(i));
        const tm = M.time(i);
        if (tm) { g.strokeStyle = COR_TIME[tm]; g.lineWidth = compacto ? 2 : 3; g.beginPath(); g.arc(20, y0 + faixa / 2, rRaia + 1.5, 0, TAU); g.stroke(); }
        texto(g, String(i + 1), 20, y0 + faixa / 2 + 1, { tam: compacto ? Math.min(13, rRaia * 1.1) : 13, contorno: 'rgba(0,0,0,0.4)' });
        if (compacto) {
          // na raia fina o nome fica no começo da pista; a minha ganha borda e as teclas
          if (i === eu) borda(g, 35, y0 + 2, L - 42, faixa - 4, M.cor(i), 2.5, 6);
          else {
            g.font = `700 10px ${FONTE}`;
            texto(g, caber(g, M.nome(i), INI - 42), 36, y0 + faixa / 2 + 0.5, { tam: 10, alinhar: 'left', contorno: 'rgba(0,0,0,0.55)' });
          }
        }
      }
      bandeirolas(g, TOPO - 26, rel);
      for (let i = 0; i < N; i++) {
        const s = est(i, T);
        const y0 = TOPO + i * faixa;
        const x = INI + (s.p / 100) * (META - INI);
        const pe = y0 + faixa * (compacto ? 0.86 : 0.82);
        passoAnim[i] += dtv * (0.4 + s.v * 0.12);
        if (s.v > 3.5 && !s.fin && Math.random() < s.v / 30) M.particula(x - 12, pe - 2, { vx: -40 - Math.random() * 40, vy: -30, gr: 80, vida: 0.4, cor: 'rgba(240,200,160,0.8)', tam: 2.5 + Math.random() * 2 });
        if (s.tonto && !tropVisto[i] && i !== eu) { tropVisto[i] = true; M.popup(x, pe - 60 * esc, 'Opa!', '#ff5d8f', 14); }
        if (!s.tonto) tropVisto[i] = false;
        if (s.fin && !festejado[i]) {
          festejado[i] = true;
          M.estouro(META + 8, pe - 30, CONFETES, 18, 180, { forma: 'papel' });
          M.popup(META - 10, pe - 50 * esc, `${colocacao(i, T)}º!`, '#ffd166', 20);
        }
        M.coelho(g, i, x, pe, { escala: esc, dir: 1, passo: passoAnim[i], andando: s.v > 0.4 && !s.fin, tonto: s.tonto, pose: s.fin ? 'dancando' : null, altEtiqueta: 60, etiqueta: !compacto });
        if (s.fin) {
          const pos = colocacao(i, T);
          const cor = pos === 1 ? '#ffd166' : pos === 2 ? '#d1d5db' : pos === 3 ? '#e8a46a' : '#a7f3d0';
          elipse(g, META + 36, y0 + faixa / 2, rRaia, rRaia, cor);
          texto(g, `${pos}º`, META + 36, y0 + faixa / 2 + 1, { tam: compacto ? Math.min(11, rRaia) : 11, cor: '#3b2a1a', contorno: null });
        } else {
          texto(g, `${Math.floor(s.p)}%`, META + 36, y0 + faixa / 2, { tam: 11, contorno: 'rgba(0,0,0,0.5)' });
        }
        // dica de tecla na minha raia
        if (i === eu && !s.fin) {
          const prox = me.ultimo === 'esq' ? 'dir' : me.ultimo === 'dir' ? 'esq' : null;
          for (const [k, dir] of [[0, 'esq'], [1, 'dir']]) {
            const kx = (compacto ? 38 : 46) + k * 24;
            const kh = compacto ? Math.min(14, faixa - 10) : 14;
            const ky = compacto ? y0 + faixa / 2 - kh / 2 : y0 + faixa - 20;
            const acesa = prox === null || prox === dir;
            ret(g, kx, ky, 20, kh, acesa ? '#fff' : 'rgba(255,255,255,0.35)', 4);
            seta(g, kx + 10, ky + kh / 2, Math.min(5, kh * 0.36), dir, acesa ? '#3b2a6b' : 'rgba(59,42,107,0.4)', null);
          }
        }
      }
    },
  };
}

/* ─── 3. Caça às Cenouras ────────────────────────── */

// A cenoura (sem a sombra) com a raiz em (0, 0); xMundo só muda o balanço das folhas.
function pintarCenouraMini(g, ouro, rel, xMundo) {
  const verde = ouro ? '#b9c43a' : '#3fa34d';
  for (const [a, l] of [[-0.55, 12], [0, 16], [0.55, 12]]) {
    g.save();
    g.translate(0, -9);
    g.rotate(a + Math.sin(rel * 3 + xMundo) * 0.08);
    elipse(g, 0, -l / 2, 3, l / 2, verde);
    g.restore();
  }
  g.fillStyle = ouro ? '#ffd23f' : '#ff8c1a';
  g.beginPath();
  g.moveTo(-8, -6);
  g.quadraticCurveTo(0, -13, 8, -6);
  g.lineTo(6, 2);
  g.lineTo(-6, 2);
  g.closePath();
  g.fill();
  g.strokeStyle = ouro ? '#c99a1a' : '#d0661a';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-5, -4);
  g.lineTo(-1, -4);
  g.moveTo(1, -1);
  g.lineTo(5, -1);
  g.stroke();
}

function desenharCenoura(g, x, y, esc, ouro, rel, alfa = 1) {
  g.save();
  g.globalAlpha = alfa;
  elipse(g, x, y + 2, 12 * esc, 4.5 * esc, 'rgba(70,40,20,0.5)');
  if (!desenharSprite(g, ouro ? 'festa-mini.cenoura-dourada' : 'festa-mini.cenoura', 'brotando', x, y + 2, { t: rel, escala: esc })) {
    g.translate(x, y);
    g.scale(esc, esc);
    pintarCenouraMini(g, ouro, rel, x);
  }
  g.restore();
  if (ouro) {
    for (let k = 0; k < 2; k++) {
      const a = rel * 2.5 + k * Math.PI;
      estrela(g, x + Math.cos(a) * 15 * esc, y - 12 * esc + Math.sin(a) * 6, 3.2, '#fff6b0', a);
    }
  }
  g.globalAlpha = 1;
}

// Onde cada um começa: uma fileira até 5; com 6 ou mais, duas fileiras.
function largada(N, i, yMeio, sep, passoMax) {
  if (N <= 5) return { x: 320 + (i - (N - 1) / 2) * Math.min(passoMax, 560 / Math.max(1, N - 1)), y: yMeio };
  const cols = Math.ceil(N / 2);
  const col = Math.floor(i / 2);
  const p = Math.min(passoMax, 520 / Math.max(1, cols - 1));
  return { x: 320 + (col - (cols - 1) / 2) * p, y: yMeio + (i % 2 ? sep : -sep) };
}

// Mais jogadores, mais coisas para pegar (igual em todas as telas: depende só da semente e de N).
const fatorItens = N => (N > 4 ? 4 / N : 1);

function jogoCacada(M) {
  const { N, eu } = M;
  const dur = M.dur;
  const nP = Math.round(dur * FPS) + 1;
  const X0 = 34;
  const X1 = 606;
  const Y0 = M.times ? 104 : 92;
  const Y1 = 352;
  const VEL = 200;
  const RAIO = 24;
  const xIni = i => largada(N, i, (Y0 + Y1) / 2 + 20, 42, 120).x;
  const yIni = i => largada(N, i, (Y0 + Y1) / 2 + 20, 42, 120).y;
  const flores = enfeitesCacada(M);

  const r = M.rng('cacada-cenouras');
  const cen = [];
  let t = 0.25;
  while (t < dur - 1.2) {
    const p = t / dur;
    cen.push({ k: cen.length, x: red(entre(r, X0 + 12, X1 - 12), 10), y: red(entre(r, Y0 + 14, Y1 - 6), 10), t0: red(t, 1000), tf: red(t + 5.5 - 1.5 * p, 1000), ouro: r() < 0.12 });
    t += (entre(r, 0.42, 0.85) - 0.12 * p) * fatorItens(N);
  }
  const valor = c => (c.ouro ? 3 : 1);

  // CPUs: andam até as cenouras e comem (some para todos); o placar delas é só da agenda.
  const comidaCpu = new Map();
  const cpu = [];
  const cpus = [];
  for (let i = 0; i < N; i++) if (M.ehCpu(i)) cpus.push(i);
  if (cpus.length) {
    const reservadas = new Set();
    const est = cpus.map(i => {
      const rc = M.rng(`cacada-cpu-${i}`);
      return { i, rc, x: xIni(i), y: yIni(i), vel: entre(rc, 130, 165), reacao: entre(rc, 0.2, 0.5), alvo: null, pausa: 0, wx: xIni(i), wy: yIni(i), ticks: [], xs: new Float32Array(nP), ys: new Float32Array(nP) };
    });
    for (let s = 0; s < nP; s++) {
      const T = s / FPS;
      for (const st of est) {
        if (s > 0 && T >= st.pausa) {
          if (st.alvo && T >= st.alvo.tf - 0.1) { reservadas.delete(st.alvo.k); st.alvo = null; }
          if (!st.alvo) {
            let melhor = null;
            let mc = 1e9;
            for (const c of cen) {
              if (c.t0 > T - st.reacao) break;
              if (T >= c.tf || reservadas.has(c.k) || comidaCpu.has(c.k)) continue;
              const dx = c.x - st.x;
              const dy = c.y - st.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (T + d / st.vel >= c.tf - 0.15) continue;
              const custo = d / st.vel - (c.ouro ? 0.8 : 0) + st.rc() * 0.6;
              if (custo < mc) { mc = custo; melhor = c; }
            }
            if (melhor) { st.alvo = melhor; reservadas.add(melhor.k); }
          }
          let tx = st.wx;
          let ty = st.wy;
          if (st.alvo) { tx = st.alvo.x; ty = st.alvo.y; }
          const dx = tx - st.x;
          const dy = ty - st.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const passo = st.vel / FPS;
          if (d <= passo) { st.x = tx; st.y = ty; } else { st.x += (dx / d) * passo; st.y += (dy / d) * passo; }
          if (st.alvo && d <= passo) {
            const c = st.alvo;
            comidaCpu.set(c.k, red(T, 1000));
            st.ticks.push({ t: red(T, 1000), v: valor(c), x: c.x, y: c.y });
            reservadas.delete(c.k);
            st.alvo = null;
            st.pausa = T + entre(st.rc, 0.25, 0.7);
          } else if (!st.alvo && d <= passo) {
            st.wx = entre(st.rc, X0 + 20, X1 - 20);
            st.wy = entre(st.rc, Y0 + 20, Y1 - 10);
          }
        }
        st.xs[s] = st.x;
        st.ys[s] = st.y;
      }
    }
    for (const st of est) cpu[st.i] = { xs: st.xs, ys: st.ys, ticks: st.ticks, total: st.ticks.reduce((a, b) => a + b.v, 0), mostrados: 0 };
  }

  const me = { x: eu >= 0 ? xIni(eu) : 0, y: eu >= 0 ? yIni(eu) : 0, dir: 1, passo: 0, andando: false };
  const rem = Array.from({ length: N }, (_, i) => ({ x: xIni(i), y: yIni(i), ax: xIni(i), ay: yIni(i), dir: 1, passo: 0, andando: false }));
  const tomada = new Map();
  const pend = new Set();
  const pts = Array(N).fill(0);

  const visivel = (c, T) => T >= c.t0 && T < c.tf && !tomada.has(c.k) && !(comidaCpu.get(c.k) <= T);
  const pontosCpu = (i, T) => { let s = 0; for (const q of cpu[i].ticks) { if (q.t > T) break; s += q.v; } return s; };

  function estado(i, T) {
    if (cpu[i]) {
      const c = cpu[i];
      const x = amostra(c.xs, T);
      const y = amostra(c.ys, T);
      const xa = amostra(c.xs, Math.max(0, T - 0.05));
      const ya = amostra(c.ys, Math.max(0, T - 0.05));
      const mov = Math.abs(x - xa) + Math.abs(y - ya);
      return { x, y, dir: x >= xa ? 1 : -1, andando: mov > 0.5, passo: T };
    }
    return i === eu ? me : rem[i];
  }

  return {
    dica: 'Pegue as cenouras! As douradas valem 3.',
    passo(T, dt, e) {
      for (let i = 0; i < N; i++) {
        if (i === eu || cpu[i]) continue;
        const q = rem[i];
        const nx = suave(q.x, q.ax, dt);
        const ny = suave(q.y, q.ay, dt);
        q.andando = Math.abs(nx - q.x) + Math.abs(ny - q.y) > 0.4;
        if (q.andando) q.passo += dt;
        q.x = nx;
        q.y = ny;
      }
      if (eu < 0) return;
      let mx = (e.dir ? 1 : 0) - (e.esq ? 1 : 0);
      let my = (e.baixo ? 1 : 0) - (e.cima ? 1 : 0);
      if (mx && my) { mx *= 0.7071; my *= 0.7071; }
      me.x = limitar(me.x + mx * VEL * dt, X0, X1);
      me.y = limitar(me.y + my * VEL * dt, Y0, Y1);
      if (mx) me.dir = mx > 0 ? 1 : -1;
      me.andando = !!(mx || my);
      if (me.andando) me.passo += dt;
      for (const c of cen) {
        if (c.t0 > T) break;
        if (pend.has(c.k) || !visivel(c, T)) continue;
        const dx = c.x - me.x;
        const dy = c.y - me.y;
        if (dx * dx + dy * dy < RAIO * RAIO) { pend.add(c.k); M.pegar(`c${c.k}`); }
      }
      if (M.passos % 2 === 0) M.pos({ x: red(me.x, 10), y: red(me.y, 10), d: me.dir });
    },
    todosProntos: () => false,
    podeReportar: posFim => pend.size === 0 || posFim > 1,
    meuResultado() { return resPontos(pts[eu]); },
    resultadoCpu(k) { return resPontos(cpu[k] ? cpu[k].total : 0); },
    placar(i, Tm) {
      const p = cpu[i] ? pontosCpu(i, Tm) : pts[i];
      return { pontos: p, vivo: true, tempo: 0, status: `${p} 🥕` };
    },
    aoPos(i, d) {
      if (cpu[i]) return;
      rem[i].ax = limitar(num(d.x, rem[i].ax), 0, L);
      rem[i].ay = limitar(num(d.y, rem[i].ay), 0, A);
      if (d.d === 1 || d.d === -1) rem[i].dir = d.d;
    },
    aoPegou(i, chave) {
      const m = /^c(\d+)$/.exec(chave);
      const c = m && cen[Number(m[1])];
      if (!c) return;
      pend.delete(c.k);
      if (tomada.has(c.k)) return; // cada cenoura vale uma vez só
      tomada.set(c.k, i);
      if (!cpu[i]) pts[i] += valor(c);
      M.popup(c.x, c.y - 26, `+${valor(c)}`, c.ouro ? '#ffd166' : '#fff', c.ouro ? 22 : 18);
      M.estouro(c.x, c.y - 6, c.ouro ? ['#ffd23f', '#fff6b0'] : ['#ff8c1a', '#3fa34d'], c.ouro ? 16 : 9, 130, c.ouro ? { forma: 'estrela' } : {});
      if (i === eu) M.som(c.ouro ? 'poder' : 'moeda');
    },
    resumo(T) {
      const partes = [];
      for (const c of cen) { if (c.t0 > T) break; if (visivel(c, T)) partes.push(c.k); }
      for (let i = 0; i < N; i++) if (cpu[i]) { const s = estado(i, T); partes.push(`c${i}:${s.x.toFixed(1)},${s.y.toFixed(1)},${pontosCpu(i, T)}`); }
      return `${partes.join(',')}|${[...tomada.entries()].sort((a, b) => a[0] - b[0]).join(';')}`;
    },
    depurar(T) {
      const itens = [];
      for (const c of cen) { if (c.t0 > T) break; if (visivel(c, T)) itens.push({ k: c.k, x: c.x, y: c.y, v: valor(c) }); }
      return { itens, eu: eu >= 0 ? { x: me.x, y: me.y } : null, valores: cen.map(valor) };
    },
    cena(g, T, rel) {
      // gramado listrado
      g.fillStyle = '#7ccf5f';
      g.fillRect(0, 0, L, A);
      for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,60,0,0.05)'; g.fillRect(k * 54, 0, 54, A); }
      // canteiros
      for (const [cx, cy, w, h] of [[60, Y0 + 6, 120, 46], [470, Y1 - 50, 130, 44], [250, Y1 - 24, 110, 30]]) {
        ret(g, cx, cy, w, h, '#9a6a3e', 10);
        for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(cx + 8, cy + (k * h) / 4 - 1, w - 16, 3); }
      }
      // flores
      for (const f of flores) { elipse(g, f.x, f.y, 4, 4, f.c); elipse(g, f.x, f.y, 1.6, 1.6, '#fff7c2'); }
      // cerca
      g.fillStyle = '#c99a6b';
      for (let x = 6; x < L; x += 26) { ret(g, x, Y0 - 34, 10, 26, '#e8c9a0', 3); }
      g.fillRect(0, Y0 - 26, L, 4);
      g.fillRect(0, Y0 - 16, L, 4);
      // toca
      elipse(g, 600, Y0 - 2, 24, 13, '#6b4423');
      elipse(g, 600, Y0 + 1, 17, 9, '#2a1a0e');
      // cenouras
      for (const c of cen) {
        if (c.t0 > T) break;
        if (!visivel(c, T)) continue;
        const idade = T - c.t0;
        const esc = idade < 0.3 ? 0.4 + (idade / 0.3) * 0.75 : 1.15 - Math.min(0.15, (idade - 0.3) * 0.6);
        const pisca = c.tf - T < 1.2 && Math.floor(T * 8) % 2 === 0;
        desenharCenoura(g, c.x, c.y, esc, c.ouro, rel, pisca ? 0.35 : 1);
      }
      // coelhos, de trás para a frente
      const ordem = [];
      for (let i = 0; i < N; i++) ordem.push([i, estado(i, T)]);
      ordem.sort((a, b) => a[1].y - b[1].y);
      for (const [i, s] of ordem) {
        if (cpu[i]) {
          const c = cpu[i];
          while (c.mostrados < c.ticks.length && c.ticks[c.mostrados].t <= T) {
            const q = c.ticks[c.mostrados++];
            if (T - q.t < 0.5) {
              M.popup(q.x, q.y - 34, `+${q.v}`, q.v > 1 ? '#ffd166' : '#fff', q.v > 1 ? 22 : 18);
              M.estouro(q.x, q.y - 4, ['#8b5a2b', '#ff8c1a'], 8, 110);
            }
          }
        }
        M.coelho(g, i, s.x, s.y, { dir: s.dir, passo: s.passo, andando: s.andando, escala: 0.9 });
      }
    },
  };
}

function enfeitesCacada(M) {
  const r = M.rng('cacada-enfeites');
  const flores = [];
  for (let k = 0; k < 40; k++) flores.push({ x: r() * L, y: 90 + r() * 280, c: CONFETES[Math.floor(r() * CONFETES.length)] });
  return flores;
}

/* ─── 4. Memória do Raposo ───────────────────────── */

const COR_SETA = { cima: '#22c55e', baixo: '#facc15', esq: '#3b82f6', dir: '#ec4899' };

// O Raposo do palco: a raposa grande de cartola, com os pés em (x, y).
function pintarRaposo(g, x, y, rel, fala, semSprite = false) {
  g.save();
  g.translate(x, y);
  g.scale(2.1, 2.1);
  desenharRaposa(g, 0, 0, { dir: 1, t: rel, andando: !!fala, passo: rel * 0.4, semSprite });
  g.restore();
  // cartola do Raposo
  ret(g, x + 13, y - 86, 26, 22, '#1f1b2e', 3);
  ret(g, x + 5, y - 67, 42, 6, '#1f1b2e', 3);
  g.fillStyle = '#ff5d8f';
  g.fillRect(x + 13, y - 72, 26, 4);
}

// Um botão de seta do controle (aceso quando o Raposo mostra ou eu aperto, vermelho quando errei).
function pintarBotaoSeta(g, x, y, s, aceso, errado) {
  const cor = errado ? '#ef4444' : COR_SETA[s];
  ret(g, x - 20, y - 20, 40, 40, aceso || errado ? cor : sombrear(COR_SETA[s], -0.35), 10);
  seta(g, x, y, 13, s, aceso ? '#fff' : 'rgba(255,255,255,0.75)', null);
}

// Uma seta colorida (a do painel e as das CPUs): o sprite apontando para a direita, girado e pintado.
function setaColorida(g, x, y, tam, dir, cor, contorno, rel) {
  if (!desenharSprite(g, 'festa-mini.seta', 'mostrando', x, y, { t: rel, rot: ANG_SETA[dir] ?? 0, escala: tam / 40, cor })) seta(g, x, y, tam, dir, cor, contorno);
}

function jogoMemoria(M) {
  const { N, eu } = M;
  const r = M.rng('memoria-sequencia');
  const seq = [];
  while (seq.length < 16) {
    const s = SETAS[Math.floor(r() * 4)];
    if (seq.length >= 2 && seq[seq.length - 1] === s && seq[seq.length - 2] === s) continue;
    seq.push(s);
  }
  // A agenda das rodadas: o Raposo mostra, depois todos repetem.
  const rodadas = [];
  let t = 0.3;
  for (let q = 0; q < 12; q++) {
    const Lq = 3 + q;
    const passo = Math.max(0.3, 0.62 - 0.05 * q);
    const ini = t;
    const mostraIni = ini + 0.9;
    const mostraFim = mostraIni + Lq * passo;
    const respFim = mostraFim + 1.3 + 0.5 * Lq;
    if (respFim > M.def.duracao - 0.8) break;
    rodadas.push({ r: q, L: Lq, ini: red(ini, 1000), mostraIni: red(mostraIni, 1000), passo, mostraFim: red(mostraFim, 1000), respFim: red(respFim, 1000) });
    t = respFim + 0.5;
  }
  M.dur = Math.min(M.def.duracao, red(rodadas[rodadas.length - 1].respFim + 0.8, 1000));
  const nR = rodadas.length;
  const rodadaEm = T => { let R = null; for (const q of rodadas) { if (q.ini <= T) R = q; else break; } return R; };

  // CPUs: erram numa rodada sorteada (ou nunca).
  const cpu = [];
  for (let i = 0; i < N; i++) {
    if (!M.ehCpu(i)) continue;
    const rc = M.rng(`memoria-cpu-${i}`);
    let fR = null;
    for (const q of rodadas) if (rc() < 0.1 + 0.12 * q.r) { fR = q.r; break; }
    const toques = [];
    const feitas = [];
    let tFalha = null;
    for (const q of rodadas) {
      if (fR !== null && q.r > fR) break;
      const jErr = q.r === fR ? Math.floor(rc() * q.L) : -1;
      let tt = q.mostraFim + entre(rc, 0.35, 0.7);
      for (let j = 0; j < q.L; j++) {
        if (j === jErr) {
          const errada = SETAS[(SETAS.indexOf(seq[j]) + 1 + Math.floor(rc() * 3)) % 4];
          toques.push({ t: red(tt, 1000), r: q.r, j, tecla: errada, certo: false });
          tFalha = red(tt, 1000);
          break;
        }
        toques.push({ t: red(tt, 1000), r: q.r, j, tecla: seq[j], certo: true });
        if (j === q.L - 1) feitas.push(red(tt, 1000));
        tt += entre(rc, 0.28, 0.48);
      }
    }
    cpu[i] = { fR, toques, feitas, tFalha, total: fR === null ? nR : fR };
  }

  const fora = Array(N).fill(false);
  const tFora = Array(N).fill(0);
  const pts = Array(N).fill(0);
  const feitas = Array.from({ length: N }, () => new Set());
  const prog = Array.from({ length: N }, () => ({ r: -1, n: 0 }));
  const luz = { cima: -9, baixo: -9, esq: -9, dir: -9 };
  const errouLuz = { t: -9, tecla: null };
  let meuR = -1;
  let meuN = 0;
  let ultimoMostrado = '';
  const foraVisto = Array(N).fill(false);

  const cpuFora = (i, T) => cpu[i].tFalha !== null && T >= cpu[i].tFalha;
  const cpuPts = (i, T) => cpu[i].feitas.filter(x => x <= T).length;
  const estaFora = (i, T) => (cpu[i] ? cpuFora(i, T) : fora[i]);
  const pontosDe = (i, T) => (cpu[i] ? cpuPts(i, T) : pts[i]);

  function sair(T, q) {
    fora[eu] = true;
    tFora[eu] = T;
    M.som('quebra');
    M.tremer(8);
    M.evento({ tipo: 'errou', r: q });
    M.reportar(resPontos(pts[eu]));
  }

  function progresso(i, T, R) {
    if (!R) return 0;
    if (cpu[i]) { let n = 0; for (const q of cpu[i].toques) if (q.r === R.r && q.t <= T && q.certo) n++; return n; }
    if (i === eu) return meuR === R.r ? meuN : feitas[eu].has(R.r) ? R.L : 0;
    if (feitas[i].has(R.r)) return R.L;
    return prog[i].r === R.r ? prog[i].n : 0;
  }

  // Lugar no palco: uma fileira até 5; com 6 ou mais, duas fileiras desencontradas.
  function lugar(i) {
    if (!M.cheio) return { x: N <= 1 ? 400 : 230 + (i * 370) / (N - 1), y: 332, s: 1 };
    const atras = i % 2 === 0;
    const k = Math.floor(i / 2);
    const n = atras ? Math.ceil(N / 2) : Math.floor(N / 2);
    const passo = Math.min(140, 280 / Math.max(1, Math.ceil(N / 2) - 1));
    const x0 = 190 + (atras ? 0 : passo / 2);
    return { x: x0 + Math.min(k, n - 1) * passo, y: atras ? 314 : 346, s: 0.75 };
  }
  const xJog = i => lugar(i).x;
  const PADX = 548;
  const PADY = 186;
  const posPad = { cima: [0, -44], baixo: [0, 44], esq: [-44, 0], dir: [44, 0] };

  return {
    dica: 'Decore as setas do Raposo e repita!',
    passo(T, dt, e) {
      const R = rodadaEm(T);
      // som de cada seta mostrada
      if (R && T >= R.mostraIni && T < R.mostraFim) {
        const j = Math.floor((T - R.mostraIni) / R.passo);
        const chave = `${R.r}:${j}`;
        if (chave !== ultimoMostrado) { ultimoMostrado = chave; M.som('passo'); }
      }
      if (eu >= 0 && !fora[eu]) {
        for (const q of rodadas) {
          if (q.ini > T) break;
          if (q.respFim <= T && !feitas[eu].has(q.r)) { sair(T, q.r); break; }
        }
        if (!fora[eu] && R && T >= R.mostraFim && T < R.respFim && !feitas[eu].has(R.r)) {
          if (meuR !== R.r) { meuR = R.r; meuN = 0; }
          for (const tecla of e.apertou) {
            if (!SETAS.includes(tecla)) continue;
            luz[tecla] = T;
            if (tecla === seq[meuN]) {
              meuN++;
              M.som('pulo');
              if (meuN === R.L) {
                feitas[eu].add(R.r);
                pts[eu] = R.r + 1;
                M.som('moeda');
                M.evento({ tipo: 'acertou', r: R.r });
                M.popup(xJog(eu), lugar(eu).y - 82 * lugar(eu).s, 'Boa!', '#06d6a0', 20);
                break;
              }
            } else {
              errouLuz.t = T;
              errouLuz.tecla = tecla;
              sair(T, R.r);
              break;
            }
          }
        }
        if (M.passos % 3 === 0) M.pos({ r: meuR, n: meuN });
      }
      // quem não respondeu a tempo (aviso perdido) também sai
      for (let i = 0; i < N; i++) {
        if (i === eu || cpu[i] || fora[i]) continue;
        for (const q of rodadas) {
          if (q.respFim + 2 > T) break;
          if (!feitas[i].has(q.r)) { fora[i] = true; tFora[i] = q.respFim; break; }
        }
      }
    },
    todosProntos(T) { for (let i = 0; i < N; i++) if (!estaFora(i, T)) return false; return true; },
    meuResultado() { return resPontos(pts[eu]); },
    resultadoCpu(k) { return resPontos(cpu[k] ? cpu[k].total : 0); },
    placar(i, Tm) {
      const p = pontosDe(i, Tm);
      const f = estaFora(i, Tm);
      return { pontos: p, vivo: true, tempo: 0, fora: f, status: f ? `Fora · ${p}` : `★ ${p}` };
    },
    textoMeu() { return eu < 0 ? 'Assistindo' : `Rodadas: ${pts[eu]}`; },
    depurar(T) {
      const R = rodadaEm(T);
      const vez = eu >= 0 && R && !fora[eu] && T >= R.mostraFim && T < R.respFim && !feitas[eu].has(R.r);
      return { proxima: vez ? seq[meuR === R.r ? meuN : 0] : null, rodadas: nR };
    },
    aviso() { return fora[eu] ? 'Você errou! Torça pelos outros.' : null; },
    aoPos(i, d) {
      if (cpu[i]) return;
      prog[i] = { r: Math.floor(num(d.r, -1)), n: limitar(Math.floor(num(d.n, 0)), 0, 20) };
    },
    aoEvento(i, ev) {
      if (cpu[i]) return;
      const q = Math.floor(num(ev.r, -1));
      if (ev.tipo === 'acertou' && q >= 0 && q < nR) { feitas[i].add(q); pts[i] = Math.max(pts[i], q + 1); }
      if (ev.tipo === 'errou') { fora[i] = true; tFora[i] = M.Tm(); }
    },
    resumo(T) {
      const R = rodadaEm(T);
      let fase = 'espera';
      let mostra = '';
      if (R) {
        if (T < R.mostraIni) fase = 'intro';
        else if (T < R.mostraFim) { fase = 'mostra'; mostra = seq[Math.floor((T - R.mostraIni) / R.passo)]; }
        else if (T < R.respFim) fase = 'resp';
      }
      const partes = [`${R ? R.r : -1}:${fase}:${mostra}`];
      for (let i = 0; i < N; i++) if (cpu[i]) partes.push(`c${i}:${cpuPts(i, T)},${cpuFora(i, T) ? 1 : 0},${progresso(i, T, R)}`);
      return partes.join('|');
    },
    cena(g, T, rel) {
      const R = rodadaEm(T);
      // palco ao entardecer
      const ceu = g.createLinearGradient(0, 0, 0, 300);
      ceu.addColorStop(0, '#5b3f9e');
      ceu.addColorStop(1, '#f59e8b');
      g.fillStyle = ceu;
      g.fillRect(0, 0, L, A);
      for (let k = 0; k < 18; k++) elipse(g, (k * 97) % L, 20 + ((k * 53) % 90), 1.3, 1.3, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(rel * 2 + k)})`);
      // cortinas
      for (const [x, s] of [[0, 1], [L, -1]]) {
        g.fillStyle = '#b91c4b';
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + s * 70, 0);
        g.quadraticCurveTo(x + s * 30, 160, x + s * 46, 310);
        g.lineTo(x, 310);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.15)';
        g.lineWidth = 3;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + s * k * 16, 0); g.quadraticCurveTo(x + s * k * 7, 160, x + s * k * 11, 310); g.stroke(); }
      }
      // luzinhas
      g.strokeStyle = '#3b2a1a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(40, 64);
      g.quadraticCurveTo(L / 2, 104, L - 40, 64);
      g.stroke();
      for (let k = 0; k < 15; k++) {
        const tt = (k + 0.5) / 15;
        const x = 40 + tt * (L - 80);
        const y = (1 - tt) * (1 - tt) * 64 + 2 * tt * (1 - tt) * 104 + tt * tt * 64 + 5;
        const acesa = (Math.floor(rel * 3) + k) % 3 !== 0;
        elipse(g, x, y, 4, 5, acesa ? CONFETES[k % CONFETES.length] : 'rgba(255,255,255,0.3)');
      }
      // tablado
      g.fillStyle = '#9a6a3e';
      g.fillRect(0, 300, L, A - 300);
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(60,35,15,0.25)'; g.fillRect(0, 300 + k * 20, L, 2); }
      g.fillStyle = '#7a4e2a';
      g.fillRect(0, 296, L, 8);
      // o Raposo
      const fala = R && T >= R.mostraIni && T < R.mostraFim;
      if (!desenharSprite(g, 'festa-mini.raposo', fala ? 'falando' : 'parado', 105, 300, { t: rel })) pintarRaposo(g, 105, 300, rel, fala);
      // placa central
      ret(g, 205, 78, 230, 150, '#7a4e2a', 14);
      ret(g, 213, 86, 214, 134, '#fdf2d8', 10);
      let titulo = '';
      let sub = '';
      if (!R) { titulo = 'Prepare-se!'; }
      else if (T < R.mostraIni) { titulo = `Rodada ${R.r + 1}`; sub = `${R.L} setas`; }
      else if (T < R.mostraFim) {
        const j = Math.floor((T - R.mostraIni) / R.passo);
        const f = (T - R.mostraIni) / R.passo - j;
        if (f < 0.72 && j < R.L) {
          const pop = f < 0.12 ? 0.6 + (f / 0.12) * 0.5 : 1.1 - Math.min(0.1, f * 0.3);
          setaColorida(g, 320, 140, 40 * pop, seq[j], COR_SETA[seq[j]], 'rgba(59,42,107,0.6)', rel);
        }
        sub = 'Observe!';
      } else if (T < R.respFim) {
        titulo = eu >= 0 && !fora[eu] ? (feitas[eu].has(R.r) ? 'Muito bem!' : 'Sua vez!') : 'Vez deles!';
        const resta = R.respFim - T;
        ret(g, 228, 196, 184 * limitar(resta / (1.3 + 0.5 * R.L), 0, 1), 8, resta < 1.2 ? '#ef4444' : '#06d6a0', 4);
      } else titulo = 'Próxima!';
      if (titulo) texto(g, titulo, 320, 140, { tam: 30, cor: '#3b2a6b', contorno: null });
      if (sub) texto(g, sub, 320, 206, { tam: 14, cor: '#7a6aa0', contorno: null });
      // bolinhas da sequência
      if (R) {
        const mostrando = T >= R.mostraIni && T < R.mostraFim;
        const jAtual = mostrando ? Math.floor((T - R.mostraIni) / R.passo) : -1;
        const meu = eu >= 0 ? progresso(eu, T, R) : 0;
        for (let j = 0; j < R.L; j++) {
          const x = 320 + (j - (R.L - 1) / 2) * 20;
          const cheia = mostrando ? j <= jAtual : j < meu;
          elipse(g, x, 245, 7, 7, cheia ? (mostrando ? '#ffd166' : '#06d6a0') : 'rgba(255,255,255,0.35)');
        }
      }
      // botões de seta (os meus)
      const mostrandoSeta = R && T >= R.mostraIni && T < R.mostraFim && ((T - R.mostraIni) / R.passo) % 1 < 0.72 ? seq[Math.floor((T - R.mostraIni) / R.passo)] : null;
      elipse(g, PADX, PADY, 78, 78, 'rgba(25,18,48,0.35)');
      for (const s of SETAS) {
        const [dx, dy] = posPad[s];
        const aceso = mostrandoSeta === s || T - luz[s] < 0.18;
        const errado = errouLuz.tecla === s && T - errouLuz.t < 0.5;
        if (aceso || errado) elipse(g, PADX + dx, PADY + dy, 26, 26, 'rgba(255,255,255,0.45)');
        const comoEsta = errado ? 'errado' : aceso ? 'aceso' : 'apagado';
        if (!desenharSprite(g, 'festa-mini.botao-seta', comoEsta, PADX + dx, PADY + dy, { t: rel, rot: ANG_SETA[s], cor: errado ? '#ef4444' : COR_SETA[s] })) pintarBotaoSeta(g, PADX + dx, PADY + dy, s, aceso, errado);
      }
      // coelhos no palco
      const ordem = [];
      for (let i = 0; i < N; i++) ordem.push(i);
      if (M.cheio) ordem.sort((a, b) => lugar(a).y - lugar(b).y || a - b); // fileira de trás primeiro
      for (const i of ordem) {
        const { x, y, s } = lugar(i);
        const f = estaFora(i, T);
        // até 5: as alturas de sempre; com 6 ou mais: tudo relativo à plaquinha
        const yTag = y - 64 * s;
        const yPontos = M.cheio ? yTag - 13 : 274;
        const ySeta = M.cheio ? yTag - 26 : 252;
        if (f && !foraVisto[i]) { foraVisto[i] = true; M.popup(x, M.cheio ? yTag - 20 : 236, 'Errou!', '#ff5d8f', 16); M.estouro(x, M.cheio ? y - 46 * s : 270, '#ffd166', 8, 130, { forma: 'estrela' }); }
        ret(g, x - 26 * s, y - 2, 52 * s, 10 * s, '#5b3a20', 4);
        const feliz = R && T >= R.mostraFim && T < R.respFim + 0.5 && progresso(i, T, R) >= R.L;
        M.coelho(g, i, x, y, { escala: s, escalonar: false, dir: x < 400 ? 1 : -1, tonto: f, pose: f ? 'sentado' : feliz ? 'dancando' : null, alfa: f ? 0.75 : 1 });
        if (cpu[i]) {
          const c = cpu[i];
          let ult = null;
          for (const q of c.toques) { if (q.t > T) break; ult = q; }
          if (ult && T - ult.t < 0.3) setaColorida(g, x, ySeta, M.cheio ? 7 : 9, ult.tecla, ult.certo ? COR_SETA[ult.tecla] : '#ef4444', 'rgba(0,0,0,0.4)', rel);
        }
        if (R && !f && T >= R.mostraFim && T < R.respFim) {
          const n = progresso(i, T, R);
          const passoP = M.cheio ? 5 : 6;
          const rp = M.cheio ? 2.1 : 2.4;
          for (let j = 0; j < R.L; j++) elipse(g, x + (j - (R.L - 1) / 2) * passoP, yPontos, rp, rp, j < n ? '#06d6a0' : 'rgba(255,255,255,0.4)');
        }
      }
    },
  };
}

/* ─── 5. Tiro ao Alvo ────────────────────────────── */

const CORES_BALAO = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'];

function desenharBalao(g, x, y, r, cor, ouro, rel) {
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y + r * 1.15);
  g.quadraticCurveTo(x + Math.sin(rel * 3 + x) * 6, y + r * 1.8, x, y + r * 2.6);
  g.stroke();
  if (!desenharSprite(g, ouro ? 'festa-mini.balao-dourado' : 'festa-mini.balao', 'subindo', x, y, { t: rel, escala: r / (ouro ? 13 : 17), cor })) pintarBalao(g, x, y, r, cor, ouro);
  if (ouro) estrela(g, x + r * 0.9, y - r * 0.9, 4 + Math.sin(rel * 8) * 1.2, '#fffbe0', rel * 2);
}

// O balão sem o barbante (o meio do balão em x, y).
function pintarBalao(g, x, y, r, cor, ouro) {
  elipse(g, x, y, r, r * 1.15, ouro ? '#f5c518' : cor);
  elipse(g, x + r * 0.12, y + r * 0.18, r * 0.82, r * 0.92, ouro ? '#e0a800' : sombrear(cor, -0.12));
  elipse(g, x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.38, 'rgba(255,255,255,0.55)', -0.4);
  g.fillStyle = ouro ? '#e0a800' : cor;
  g.beginPath();
  g.moveTo(x - 3, y + r * 1.2);
  g.lineTo(x + 3, y + r * 1.2);
  g.lineTo(x, y + r * 1.08);
  g.closePath();
  g.fill();
}

function desenharAlvo(g, x, y, r) {
  g.fillStyle = '#6b4423';
  g.fillRect(x - 2, y + r, 4, 18);
  for (const [k, cor] of [[1, '#ef4444'], [0.72, '#fff'], [0.46, '#ef4444'], [0.2, '#fff']]) elipse(g, x, y, r * k, r * k, cor);
}

// A mira sem o clarão do tiro.
function pintarMira(g, x, y, cor, grande) {
  const r = grande ? 15 : 12;
  for (const [c, lw] of [['rgba(20,10,30,0.7)', grande ? 5 : 4], [cor, grande ? 2.5 : 2]]) {
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.moveTo(x - r - 6, y);
    g.lineTo(x - r + 5, y);
    g.moveTo(x + r - 5, y);
    g.lineTo(x + r + 6, y);
    g.moveTo(x, y - r - 6);
    g.lineTo(x, y - r + 5);
    g.moveTo(x, y + r - 5);
    g.lineTo(x, y + r + 6);
    g.stroke();
  }
  elipse(g, x, y, 2, 2, cor);
}

function mira(g, x, y, cor, grande, flash) {
  const r = grande ? 15 : 12;
  if (!desenharSprite(g, 'festa-mini.mira', 'mirando', x, y, { escala: grande ? 1.25 : 1, cor })) pintarMira(g, x, y, cor, grande);
  if (flash > 0) {
    g.strokeStyle = `rgba(255,255,255,${flash})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, r + (1 - flash) * 14, 0, TAU);
    g.stroke();
  }
}

function jogoAlvo(M) {
  const { N, eu } = M;
  const dur = M.dur;
  const nP = Math.round(dur * FPS) + 1;
  const TOPO = M.times ? 78 : 60;
  const BALCAO = 336;
  const VEL = 320;
  const xIni = i => largada(N, i, 220, 40, 120).x;
  const yIni = i => largada(N, i, 220, 40, 120).y;

  const r = M.rng('alvo-itens');
  const itens = [];
  let t = 0.3;
  while (t < dur - 0.8) {
    const p = t / dur;
    if (r() < 0.25) {
      const y = r() < 0.5 ? TOPO + 70 : TOPO + 150;
      const lado = r() < 0.5 ? -1 : 1;
      const v = entre(r, 90, 140) * (1 + 0.4 * p);
      itens.push({ k: itens.length, tipo: 'alvo', x0: lado < 0 ? -25 : L + 25, y0: y, vx: red(-lado * v, 10), vy: 0, amp: 0, fase: 0, t0: red(t, 1000), tf: red(t + (L + 50) / v, 1000), r: 19, ouro: false, cor: '#ef4444' });
    } else {
      const ouro = r() < 0.12;
      const vy = ouro ? entre(r, 125, 150) : entre(r, 55, 90) * (1 + 0.3 * p);
      itens.push({ k: itens.length, tipo: 'balao', x0: red(entre(r, 50, 590), 10), y0: BALCAO + 22, vx: 0, vy: red(vy, 10), amp: red(entre(r, 6, 16), 10), fase: red(r() * 6.28, 100), t0: red(t, 1000), tf: red(t + (BALCAO + 22 - (TOPO - 30)) / vy, 1000), r: ouro ? 13 : 17, ouro, cor: CORES_BALAO[Math.floor(r() * CORES_BALAO.length)] });
    }
    t += (entre(r, 0.32, 0.7) - 0.12 * p) * fatorItens(N);
  }
  const valor = b => (b.ouro ? 3 : 1);
  const posItem = (b, T) => {
    const d = T - b.t0;
    if (b.tipo === 'alvo') return { x: b.x0 + b.vx * d, y: b.y0 };
    return { x: b.x0 + b.amp * seno(b.fase + d * 1.6), y: b.y0 - b.vy * d };
  };

  // CPUs: miram, atiram e às vezes erram; o que acertam estoura para todos.
  const popCpu = new Map();
  const cpu = [];
  const cpus = [];
  for (let i = 0; i < N; i++) if (M.ehCpu(i)) cpus.push(i);
  if (cpus.length) {
    const reservados = new Set();
    const est = cpus.map(i => {
      const rc = M.rng(`alvo-cpu-${i}`);
      return { i, rc, x: xIni(i), y: yIni(i), vel: entre(rc, 230, 300), mira: entre(rc, 0.12, 0.3), prec: entre(rc, 0.72, 0.9), alvo: null, mirando: 0, pausa: 0.4, ticks: [], tiros: [], xs: new Float32Array(nP), ys: new Float32Array(nP) };
    });
    const vale = (b, T) => T >= b.t0 && T < b.tf && !popCpu.has(b.k);
    for (let s = 0; s < nP; s++) {
      const T = s / FPS;
      for (const st of est) {
        if (s > 0 && T >= st.pausa) {
          if (st.alvo && (!vale(st.alvo, T) || st.alvo.tf - T < 0.25)) { reservados.delete(st.alvo.k); st.alvo = null; st.mirando = 0; }
          if (!st.alvo) {
            let melhor = null;
            let mc = 1e9;
            for (const b of itens) {
              if (b.t0 > T - 0.2) break;
              if (!vale(b, T) || reservados.has(b.k) || b.tf - T < 0.8) continue;
              const q = posItem(b, T);
              if (q.y < TOPO || q.x < 10 || q.x > L - 10) continue;
              const dx = q.x - st.x;
              const dy = q.y - st.y;
              const custo = Math.sqrt(dx * dx + dy * dy) / st.vel - (b.ouro ? 0.5 : 0) + st.rc() * 0.3;
              if (custo < mc) { mc = custo; melhor = b; }
            }
            if (melhor) { st.alvo = melhor; reservados.add(melhor.k); }
          }
          if (st.alvo) {
            const q = posItem(st.alvo, T);
            const dx = q.x - st.x;
            const dy = q.y - st.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const passo = st.vel / FPS;
            if (d <= passo) { st.x = q.x; st.y = q.y; } else { st.x += (dx / d) * passo; st.y += (dy / d) * passo; }
            if (d < 6) {
              st.mirando += 1 / FPS;
              if (st.mirando >= st.mira) {
                const acerta = st.rc() < st.prec;
                st.tiros.push({ t: red(T, 1000), x: st.x, y: st.y, acerta });
                st.mirando = 0;
                if (acerta) {
                  const b = st.alvo;
                  popCpu.set(b.k, red(T, 1000));
                  st.ticks.push({ t: red(T, 1000), v: valor(b), x: q.x, y: q.y });
                  reservados.delete(b.k);
                  st.alvo = null;
                  st.pausa = T + entre(st.rc, 0.15, 0.4);
                } else st.pausa = T + 0.25;
              }
            } else st.mirando = 0;
          }
        }
        st.xs[s] = st.x;
        st.ys[s] = st.y;
      }
    }
    for (const st of est) cpu[st.i] = { xs: st.xs, ys: st.ys, ticks: st.ticks, tiros: st.tiros, total: st.ticks.reduce((a, b) => a + b.v, 0), mostrados: 0 };
  }

  const me = { x: eu >= 0 ? xIni(eu) : 0, y: eu >= 0 ? yIni(eu) : 0, recarga: 0, tiros: 0, flash: 0 };
  const rem = Array.from({ length: N }, (_, i) => ({ x: xIni(i), y: yIni(i), ax: xIni(i), ay: yIni(i), s: 0, flash: 0 }));
  const estourado = new Map();
  const pend = new Set();
  const pts = Array(N).fill(0);
  let ptr = null;
  const popVisto = new Set();

  const visivel = (b, T) => T >= b.t0 && T < b.tf && !estourado.has(b.k) && !(popCpu.get(b.k) <= T);
  const pontosCpu = (i, T) => { let s = 0; for (const q of cpu[i].ticks) { if (q.t > T) break; s += q.v; } return s; };

  function atirar(T) {
    if (T < me.recarga) return;
    me.recarga = T + 0.22;
    me.tiros++;
    me.flash = 1;
    M.som('tiro');
    let melhor = null;
    let md = 1e9;
    for (const b of itens) {
      if (b.t0 > T) break;
      if (!visivel(b, T) || pend.has(b.k)) continue;
      const q = posItem(b, T);
      const dx = q.x - me.x;
      const dy = q.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < (b.r + 5) * (b.r + 5) && d2 < md) { md = d2; melhor = b; }
    }
    if (melhor) { pend.add(melhor.k); M.pegar(`b${melhor.k}`); }
  }

  return {
    dica: 'Mire e estoure os balões! Dourado vale 3.',
    passo(T, dt, e) {
      for (let i = 0; i < N; i++) {
        if (i === eu || cpu[i]) continue;
        rem[i].x = suave(rem[i].x, rem[i].ax, dt, 18);
        rem[i].y = suave(rem[i].y, rem[i].ay, dt, 18);
        rem[i].flash = Math.max(0, rem[i].flash - dt * 4);
      }
      if (eu < 0) return;
      me.flash = Math.max(0, me.flash - dt * 4);
      let tiro = aperto(e, 'acao', 'pular', 'clique');
      const p = ptr || (e.ponteiro && Number.isFinite(e.ponteiro.x) && Number.isFinite(e.ponteiro.y) ? e.ponteiro : null);
      if (p) {
        me.x = limitar(p.x, 8, L - 8);
        me.y = limitar(p.y, 8, A - 8);
        if (p.atirar || p.clique || p.apertou === true || p.tiro) tiro = true;
        ptr = null;
      }
      let mx = (e.dir ? 1 : 0) - (e.esq ? 1 : 0);
      let my = (e.baixo ? 1 : 0) - (e.cima ? 1 : 0);
      if (mx && my) { mx *= 0.7071; my *= 0.7071; }
      me.x = limitar(me.x + mx * VEL * dt, 8, L - 8);
      me.y = limitar(me.y + my * VEL * dt, 8, A - 8);
      if (tiro) atirar(T);
      if (M.passos % 2 === 0) M.pos({ x: red(me.x, 10), y: red(me.y, 10), s: me.tiros });
    },
    apontar(x, y, atira) { ptr = { x, y, atirar: atira }; },
    todosProntos: () => false,
    podeReportar: posFim => pend.size === 0 || posFim > 1,
    meuResultado() { return resPontos(pts[eu]); },
    resultadoCpu(k) { return resPontos(cpu[k] ? cpu[k].total : 0); },
    placar(i, Tm) {
      const p = cpu[i] ? pontosCpu(i, Tm) : pts[i];
      return { pontos: p, vivo: true, tempo: 0, status: `${p} 🎈` };
    },
    aoPos(i, d) {
      if (cpu[i]) return;
      rem[i].ax = limitar(num(d.x, rem[i].ax), 0, L);
      rem[i].ay = limitar(num(d.y, rem[i].ay), 0, A);
      const s = Math.floor(num(d.s, rem[i].s));
      if (s > rem[i].s) rem[i].flash = 1;
      rem[i].s = s;
    },
    aoPegou(i, chave) {
      const m = /^b(\d+)$/.exec(chave);
      const b = m && itens[Number(m[1])];
      if (!b) return;
      pend.delete(b.k);
      if (estourado.has(b.k)) return; // cada balão vale uma vez só
      estourado.set(b.k, i);
      if (!cpu[i]) pts[i] += valor(b);
      const q = posItem(b, M.Tm());
      M.popup(q.x, q.y - 20, `+${valor(b)}`, b.ouro ? '#ffd166' : M.cor(i), b.ouro ? 24 : 18);
      M.estouro(q.x, q.y, b.ouro ? ['#f5c518', '#fffbe0'] : [b.cor, '#fff'], b.ouro ? 18 : 12, 170, b.ouro ? { forma: 'estrela' } : {});
      if (i === eu) M.som(b.ouro ? 'poder' : 'quebra');
    },
    resumo(T) {
      const partes = [];
      for (const b of itens) { if (b.t0 > T) break; if (visivel(b, T)) { const q = posItem(b, T); partes.push(`${b.k}:${q.x.toFixed(1)},${q.y.toFixed(1)}`); } }
      for (let i = 0; i < N; i++) if (cpu[i]) partes.push(`c${i}:${amostra(cpu[i].xs, T).toFixed(1)},${amostra(cpu[i].ys, T).toFixed(1)},${pontosCpu(i, T)}`);
      return `${partes.join('|')}#${[...estourado.entries()].sort((a, b) => a[0] - b[0]).join(';')}`;
    },
    depurar(T) {
      const lista = [];
      for (const b of itens) { if (b.t0 > T) break; if (visivel(b, T)) { const q = posItem(b, T); lista.push({ k: b.k, x: q.x, y: q.y, v: valor(b) }); } }
      return { itens: lista, eu: eu >= 0 ? { x: me.x, y: me.y } : null, valores: itens.map(valor) };
    },
    cena(g, T, rel) {
      // parede da barraca
      g.fillStyle = '#2b4c7e';
      g.fillRect(0, 0, L, A);
      for (let x = 0; x < L; x += 40) { g.fillStyle = x % 80 ? '#2f5590' : '#294a7a'; g.fillRect(x, 0, 40, BALCAO); }
      for (let k = 0; k < 14; k++) estrela(g, (k * 131) % L + 20, TOPO + 30 + ((k * 71) % 220), 3, 'rgba(255,255,255,0.18)', k);
      // trilhos dos alvos
      for (const y of [TOPO + 70, TOPO + 150]) {
        g.fillStyle = '#c9a26b';
        g.fillRect(0, y + 37, L, 5);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(0, y + 42, L, 2);
      }
      // itens
      for (const b of itens) {
        if (b.t0 > T) break;
        const q = posItem(b, T);
        const cpuT = popCpu.get(b.k);
        if (cpuT !== undefined && cpuT <= T && !popVisto.has(b.k)) {
          popVisto.add(b.k);
          if (T - cpuT < 0.5) M.estouro(q.x, q.y, b.ouro ? ['#f5c518', '#fffbe0'] : [b.cor, '#fff'], 12, 160);
        }
        if (!visivel(b, T)) continue;
        if (b.tipo === 'alvo') { if (!desenharSprite(g, 'festa-mini.alvo', 'deslizando', q.x, q.y - b.r, { t: rel, escala: b.r / 19 })) desenharAlvo(g, q.x, q.y, b.r); }
        else desenharBalao(g, q.x, q.y, b.r, b.cor, b.ouro, rel);
      }
      // toldo listrado
      for (let k = 0; k < 16; k++) {
        g.fillStyle = k % 2 ? '#fff4e0' : '#e63946';
        g.fillRect(k * 40, 0, 40, TOPO - 14);
        g.beginPath();
        g.arc(k * 40 + 20, TOPO - 14, 20, 0, Math.PI);
        g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(0, TOPO - 16, L, 3);
      // balcão
      g.fillStyle = '#8b5a2b';
      g.fillRect(0, BALCAO, L, A - BALCAO);
      g.fillStyle = '#a86f3a';
      g.fillRect(0, BALCAO, L, 12);
      for (let x = 0; x < L; x += 64) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, BALCAO + 12, 2, A - BALCAO); }
      // miras
      for (let i = 0; i < N; i++) {
        let x;
        let y;
        let flash = 0;
        if (cpu[i]) {
          const c = cpu[i];
          x = amostra(c.xs, T);
          y = amostra(c.ys, T);
          for (const q of c.tiros) { if (q.t > T) break; if (T - q.t < 0.25) flash = 1 - (T - q.t) * 4; }
          while (c.mostrados < c.ticks.length && c.ticks[c.mostrados].t <= T) {
            const q = c.ticks[c.mostrados++];
            if (T - q.t < 0.5) M.popup(q.x, q.y - 20, `+${q.v}`, q.v > 1 ? '#ffd166' : M.cor(i), q.v > 1 ? 24 : 18);
          }
        } else if (i === eu) { x = me.x; y = me.y; flash = me.flash; }
        else { x = rem[i].x; y = rem[i].y; flash = rem[i].flash; }
        mira(g, x, y, M.cor(i), i === eu, flash);
        const tm = M.time(i);
        if (tm) { g.strokeStyle = COR_TIME[tm]; g.lineWidth = 2; g.beginPath(); g.arc(x, y, i === eu ? 22 : 19, 0, TAU); g.stroke(); }
        texto(g, i === eu ? 'Você' : M.nomeTag(i), x, y + (M.cheio && i % 2 ? 40 : 30), { tam: 10, cor: M.cor(i), contorno: M.cheio ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.6)' });
      }
      // coelhos atrás do balcão
      for (let i = 0; i < N; i++) {
        const x = 80 + (i * (L - 160)) / Math.max(1, N - 1);
        M.coelho(g, i, x, M.cheio ? M.baseCena + 2 : A - 34, { dir: 1, escala: M.cheio ? 0.7 : 0.85, etiqueta: false });
      }
    },
  };
}

/* ─── 6. Pula-Corda ──────────────────────────────── */

// A corda com sprite: o pedaço enviado repetido ao longo da linha (pontos), cada um virado no sentido da corda.
const GROSSURA_CORDA = 6;
function cordaDeSprite(g, pontos, anim, t) {
  const sp = spriteDe('festa-mini.corda', anim);
  if (!sp) return;
  const fw = sp.img.naturalWidth / Math.max(1, sp.quadros || 1);
  const fh = sp.img.naturalHeight || 1;
  const passo = Math.max(2, (GROSSURA_CORDA * fw) / fh);
  const acum = [0];
  for (let k = 1; k < pontos.length; k++) acum.push(acum[k - 1] + Math.hypot(pontos[k][0] - pontos[k - 1][0], pontos[k][1] - pontos[k - 1][1]));
  const total = acum[acum.length - 1];
  if (!(total > 0)) return;
  const n = Math.max(1, Math.ceil(total / passo));
  const largura = total / n;
  let k = 1;
  for (let j = 0; j < n; j++) {
    const d = (j + 0.5) * largura;
    while (k < pontos.length - 1 && acum[k] < d) k++;
    const [x0, y0] = pontos[k - 1];
    const [x1, y1] = pontos[k];
    const f = (d - acum[k - 1]) / (acum[k] - acum[k - 1] || 1);
    desenharSprite(g, 'festa-mini.corda', anim, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, { t, rot: Math.atan2(y1 - y0, x1 - x0), largura: largura + 0.6, altura: GROSSURA_CORDA });
  }
}

function jogoCorda(M) {
  const { N, eu } = M;
  const dur = M.dur;
  const CHAO = 334;
  const largo = N >= 5;
  const XE = N >= 7 ? 40 : largo ? 70 : 112;
  const XD = L - XE;
  const MAO = largo ? CHAO - 34 : CHAO - 40;
  const ALTO = 165;
  const passoJog = largo ? Math.min(62, (XD - XE - 110) / Math.max(1, N - 1)) : 62;
  const GRAV = 1700;
  const PULO = 380;
  const AR = (2 * PULO) / GRAV;
  const xJog = i => 320 + (i - (N - 1) / 2) * passoJog;
  // A corda desce até passar rente ao chão até nos pés de quem está na ponta (o que sobra fica arrastando no chão).
  const tPonta = (xJog(0) - XE) / (XD - XE);
  const BAIXO = largo ? Math.max(40, ((CHAO - MAO) / (4 * tPonta * (1 - tPonta))) * 1.08) : 40;

  // A agenda das voltas da corda (com pausas e fintas).
  const r = M.rng('corda-giros');
  const giros = [];
  let t = 1.0;
  while (t < dur + 2) {
    const p = Math.min(1, t / dur);
    const D = red(Math.max(0.74, 1.45 - 0.72 * p) * entre(r, 0.96, 1.04), 1000);
    let pre = 0;
    let tipo = 'normal';
    if (t > 6 && r() < 0.13) { tipo = 'pausa'; pre = red(entre(r, 0.35, 0.6), 1000); }
    else if (t > 10 && r() < 0.11) { tipo = 'finta'; pre = red(entre(r, 0.5, 0.65), 1000); }
    const ini = red(t, 1000);
    giros.push({ ini, pre, tipo, D, b: red(ini + pre + D / 2, 1000) });
    t = ini + pre + D;
  }
  const bs = giros.map(q => q.b).filter(b => b < dur);
  let cacheG = 0;
  function fase(T) {
    if (T < giros[0].ini) return 0;
    if (cacheG >= giros.length || giros[cacheG].ini > T) cacheG = 0;
    while (cacheG + 1 < giros.length && giros[cacheG + 1].ini <= T) cacheG++;
    const q = giros[cacheG];
    const u = T - q.ini;
    if (u < q.pre) return q.tipo === 'finta' ? 0.55 * Math.PI * seno((Math.PI * u) / q.pre) : 0;
    return Math.min(TAU, (TAU * (u - q.pre)) / q.D);
  }

  // CPUs: pulam certinho até a volta em que tropeçam (ou nunca).
  const cpu = [];
  for (let i = 0; i < N; i++) {
    if (!M.ehCpu(i)) continue;
    const rc = M.rng(`corda-cpu-${i}`);
    const candidatos = bs.filter(b => b >= 4 && b <= dur - 0.5);
    const falha = rc() < 0.35 || !candidatos.length ? null : candidatos[Math.floor(rc() * candidatos.length)];
    const pulos = [];
    for (const b of bs) {
      if (falha !== null && b === falha) { pulos.push(red(b + 0.05, 1000)); break; }
      pulos.push(red(b - entre(rc, 0.16, 0.24), 1000));
    }
    cpu[i] = { pulos, morte: falha, saltos: falha === null ? bs.length : bs.indexOf(falha) };
  }
  const alturaCpu = (i, T) => {
    let tj = null;
    for (const p of cpu[i].pulos) { if (p > T) break; tj = p; }
    if (tj === null) return 0;
    const d = T - tj;
    return d < AR ? PULO * d - 0.5 * GRAV * d * d : 0;
  };

  const me = { h: 0, vh: 0, podePular: 0, saltos: 0 };
  let bi = 0;
  const morto = Array(N).fill(false);
  const tMorte = Array(N).fill(0);
  const rem = Array.from({ length: N }, () => ({ h: 0, ah: 0 }));
  const caidoVisto = Array(N).fill(false);
  const avisos = new Set();

  const estaMorto = (i, T) => (cpu[i] ? cpu[i].morte !== null && T >= cpu[i].morte : morto[i]);
  const altura = (i, T) => (cpu[i] ? alturaCpu(i, T) : i === eu ? me.h : rem[i].h);

  function morrer(T) {
    morto[eu] = true;
    tMorte[eu] = T;
    M.som('pisao');
    M.tremer(12);
    M.popup(xJog(eu), CHAO - 80, 'Ops!', '#ff5d8f', 24);
    M.estouro(xJog(eu), CHAO - 30, ['#ffd166', '#fff'], 14, 170, { forma: 'estrela' });
    M.evento({ tipo: 'caiu', t: red(T) });
    M.reportar(resSobrev(false, T));
  }

  function corda(g, T, frente) {
    const f = fase(T);
    const c = Math.cos(f);
    const naFrente = Math.sin(f) > 0;
    if (naFrente !== frente) return;
    const yMeio = MAO - c * (c > 0 ? ALTO : BAIXO);
    const cy = 2 * yMeio - MAO;
    const maoE = [XE + Math.cos(f + Math.PI / 2) * 5, MAO + Math.sin(f + Math.PI / 2) * 5];
    const maoD = [XD - Math.cos(f + Math.PI / 2) * 5, MAO + Math.sin(f + Math.PI / 2) * 5];
    g.strokeStyle = frente ? '#ff5d8f' : '#b23a64';
    g.lineWidth = frente ? 4 : 3;
    g.lineCap = 'round';
    const anim = frente ? 'frente' : 'atras';
    const comSprite = !!spriteDe('festa-mini.corda', anim);
    g.save();
    g.beginPath();
    g.rect(0, 0, L, CHAO + 1);
    g.clip();
    if (comSprite) {
      const pontos = [];
      for (let k = 0; k <= 32; k++) {
        const u = k / 32;
        const a = (1 - u) * (1 - u);
        const b = 2 * u * (1 - u);
        pontos.push([a * maoE[0] + b * 320 + u * u * maoD[0], a * maoE[1] + b * cy + u * u * maoD[1]]);
      }
      cordaDeSprite(g, pontos, anim, T);
    } else {
      g.beginPath();
      g.moveTo(maoE[0], maoE[1]);
      g.quadraticCurveTo(320, cy, maoD[0], maoD[1]);
      g.stroke();
    }
    g.restore();
    // o pedaço que passaria do chão fica arrastando no chão
    const fundo = yMeio - MAO;
    if (fundo > CHAO - MAO) {
      const tc = (1 - Math.sqrt(1 - (CHAO - MAO) / fundo)) / 2;
      if (comSprite) cordaDeSprite(g, [[XE + tc * (XD - XE), CHAO], [XD - tc * (XD - XE), CHAO]], anim, T);
      else {
        g.beginPath();
        g.moveTo(XE + tc * (XD - XE), CHAO);
        g.lineTo(XD - tc * (XD - XE), CHAO);
        g.stroke();
      }
    }
    if (yMeio > CHAO - 6) {
      const x0 = largo ? xJog(0) - 40 : 220;
      const x1 = largo ? xJog(N - 1) + 40 : 420;
      for (let k = 0; k < (largo ? 3 : 2); k++) M.particula(x0 + Math.random() * (x1 - x0), CHAO, { vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 30, gr: 200, vida: 0.35, cor: 'rgba(200,170,120,0.8)', tam: 2 });
    }
    for (const [x, y] of [maoE, maoD]) elipse(g, x, y, 4, 4, '#7a4e2a');
  }

  return {
    dica: 'Pule quando a corda passar no chão!',
    passo(T, dt, e) {
      for (let i = 0; i < N; i++) if (i !== eu && !cpu[i]) rem[i].h = suave(rem[i].h, rem[i].ah, dt, 22);
      if (eu < 0 || morto[eu]) return;
      if (aperto(e, 'pular', 'cima', 'acao') && me.h === 0 && me.vh === 0 && T >= me.podePular) { me.vh = PULO; M.som('pulo'); }
      if (me.h > 0 || me.vh > 0) {
        me.h += me.vh * dt;
        me.vh -= GRAV * dt;
        if (me.h <= 0) { me.h = 0; me.vh = 0; me.podePular = T + 0.12; }
      }
      while (bi < bs.length && bs[bi] <= T) {
        const b = bs[bi++];
        if (me.h < 8) { morrer(b); break; }
        me.saltos++;
      }
      if (M.passos % 2 === 0) M.pos({ h: red(me.h, 10), m: morto[eu] ? 1 : 0 });
    },
    todosProntos(T) { for (let i = 0; i < N; i++) if (!estaMorto(i, T)) return false; return true; },
    meuResultado() { return morto[eu] ? resSobrev(false, tMorte[eu]) : resSobrev(true, M.dur); },
    resultadoCpu(k) { const c = cpu[k]; if (!c || c.morte === null) return resSobrev(true, M.dur); return resSobrev(false, c.morte); },
    placar(i, Tm) {
      const m = estaMorto(i, Tm);
      const tm = m ? (cpu[i] ? cpu[i].morte : tMorte[i]) : Tm;
      return { pontos: 0, vivo: !m, tempo: red(tm), fora: m, status: m ? `Fora ${Math.floor(tm)}s` : 'Pulando' };
    },
    textoMeu() { return eu < 0 ? 'Assistindo' : morto[eu] ? `Fora · ${me.saltos} pulos` : `Pulos: ${me.saltos}`; },
    depurar(T) { return { proximo: bs.find(b => b > T) ?? null, h: me.h, voltas: bs.length }; },
    aviso() { return morto[eu] ? 'A corda te pegou! Torça pelos outros.' : null; },
    aoPos(i, d) {
      if (cpu[i]) return;
      rem[i].ah = limitar(num(d.h, 0), 0, 100);
      if (d.m && !morto[i]) { morto[i] = true; tMorte[i] = M.Tm(); }
    },
    aoEvento(i, ev) {
      if (cpu[i] || ev.tipo !== 'caiu') return;
      morto[i] = true;
      tMorte[i] = limitar(num(ev.t, M.Tm()), 0, M.dur);
    },
    resumo(T) {
      const partes = [fase(T).toFixed(3)];
      for (let i = 0; i < N; i++) if (cpu[i]) partes.push(`c${i}:${alturaCpu(i, T).toFixed(1)},${estaMorto(i, T) ? 1 : 0}`);
      return partes.join('|');
    },
    cena(g, T, rel) {
      const ceu = g.createLinearGradient(0, 0, 0, CHAO);
      ceu.addColorStop(0, '#7dd3fc');
      ceu.addColorStop(1, '#e0f7ff');
      g.fillStyle = ceu;
      g.fillRect(0, 0, L, A);
      elipse(g, 90, 90, 30, 30, '#fff3b0');
      for (let k = 0; k < 8; k++) {
        const a = rel * 0.5 + (k * TAU) / 8;
        g.strokeStyle = 'rgba(255,230,120,0.6)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(90 + Math.cos(a) * 38, 90 + Math.sin(a) * 38);
        g.lineTo(90 + Math.cos(a) * 50, 90 + Math.sin(a) * 50);
        g.stroke();
      }
      nuvem(g, ((rel * 10) % 760) - 80, 70, 0.8);
      nuvem(g, ((rel * 6 + 400) % 760) - 80, 120, 0.6);
      elipse(g, 160, CHAO + 30, 260, 100, '#a3dc8c');
      elipse(g, 520, CHAO + 40, 260, 110, '#8fd07f');
      bandeirolas(g, M.times ? 70 : 52, rel);
      g.fillStyle = '#6cbf55';
      g.fillRect(0, CHAO - 4, L, A - CHAO + 4);
      g.fillStyle = '#5aa846';
      for (let x = 0; x < L; x += 22) g.fillRect(x, CHAO - 4, 11, 4);
      // aviso de velocidade
      for (const marco of [12, 24, 33]) {
        if (T >= marco && !avisos.has(marco)) { avisos.add(marco); if (T - marco < 0.5) M.popup(L / 2, 150, 'Mais rápido!', '#ff5d8f', 22); }
      }
      corda(g, T, false);
      // quem bate a corda
      desenharCoelho(g, XE - 16, CHAO, { pelo: '#f7f3ea', roupa: { cabeca: 'coroa', corpo: 'colete' }, dir: 1, t: rel });
      desenharCoelho(g, XD + 16, CHAO, { pelo: '#c99a6b', roupa: { cabeca: 'laco', corpo: 'vestido' }, dir: -1, t: rel + 1 });
      // os jogadores
      for (let i = 0; i < N; i++) {
        const x = xJog(i);
        const m = estaMorto(i, T);
        const h = m ? 0 : altura(i, T);
        if (m && !caidoVisto[i]) {
          caidoVisto[i] = true;
          if (i !== eu) { M.popup(x, CHAO - 80, 'Fora!', '#ff5d8f'); M.estouro(x, CHAO - 30, '#ffd166', 8, 140, { forma: 'estrela' }); }
        }
        M.coelho(g, i, x, CHAO - h, { dir: i % 2 ? -1 : 1, tonto: m, rot: m ? 0.3 : 0, pose: m ? 'sentado' : null, alfa: m ? 0.8 : 1, altEtiqueta: 64 + Math.min(10, h * 0.2) });
      }
      corda(g, T, true);
    },
  };
}

/* ─── sprites (veja sprites.js): as peças dos minijogos que podem virar imagem ─── */

const JOGO_SPRITES = 'Festa: minijogos';
export const SPRITES = [
  {
    chave: 'festa-mini.bolota', jogo: JOGO_SPRITES, nome: 'Bolota (Chuva de Bolotas)',
    desc: 'A bolota que cai das árvores, com o cabinho para cima. O jogo faz ela balançar antes de cair.',
    largura: 18, altura: 22, ancora: 'centro',
    animacoes: [{ id: 'caindo', nome: 'Caindo', quadros: 1, fps: 8 }],
    previa: g => desenharBolota(g, 0, 0, 9, 0),
  },
  {
    chave: 'festa-mini.pinha', jogo: JOGO_SPRITES, nome: 'Pinha (Chuva de Bolotas)',
    desc: 'A pinha que cai das árvores, em pé. O jogo faz ela balançar antes de cair.',
    largura: 22, altura: 26, ancora: 'centro',
    animacoes: [{ id: 'caindo', nome: 'Caindo', quadros: 1, fps: 8 }],
    previa: g => desenharPinha(g, 0, 0, 11, 0),
  },
  {
    chave: 'festa-mini.pedra', jogo: JOGO_SPRITES, nome: 'Pedregulho (Chuva de Bolotas)',
    desc: 'O pedregulho que cai e desce rolando pelo chão. O jogo gira o desenho enquanto ele rola.',
    largura: 48, altura: 48, ancora: 'centro',
    animacoes: [{ id: 'rolando', nome: 'Rolando', quadros: 1, fps: 8 }],
    previa: g => desenharPedra(g, 0, 0, 24, 0),
  },
  {
    chave: 'festa-mini.cenoura', jogo: JOGO_SPRITES, nome: 'Cenoura (Caça às Cenouras)',
    desc: 'A cenoura brotando na horta, com a raiz na base do quadro (a sombra o jogo faz). O jogo faz ela crescer ao brotar e piscar antes de sumir.',
    largura: 22, altura: 28, ancora: 'pe',
    animacoes: [{ id: 'brotando', nome: 'Na horta', quadros: 4, fps: 2 }],
    previa: (g, anim, t) => { g.save(); g.translate(0, -2); pintarCenouraMini(g, false, t, 0); g.restore(); },
  },
  {
    chave: 'festa-mini.cenoura-dourada', jogo: JOGO_SPRITES, nome: 'Cenoura dourada (Caça às Cenouras)',
    desc: 'A cenoura dourada da horta (vale 3), com a raiz na base do quadro. As estrelinhas em volta o jogo continua fazendo.',
    largura: 22, altura: 28, ancora: 'pe',
    animacoes: [{ id: 'brotando', nome: 'Na horta', quadros: 4, fps: 2 }],
    previa: (g, anim, t) => { g.save(); g.translate(0, -2); pintarCenouraMini(g, true, t, 0); g.restore(); },
  },
  {
    chave: 'festa-mini.raposo', jogo: JOGO_SPRITES, nome: 'Raposo do palco (Memória)',
    desc: 'O Raposo de cartola que mostra as setas, olhando para a direita, com os pés na base do quadro. "Mostrando" é quando ele está mostrando a sequência. Sem este sprite, vale o da "Raposa da noite" (com a cartola por cima).',
    largura: 132, altura: 90, ancora: 'pe',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 2, fps: 3 }, { id: 'falando', nome: 'Mostrando', quadros: 4, fps: 4 }],
    previa: (g, anim, t) => pintarRaposo(g, 0, 0, t, anim === 'falando', true),
  },
  {
    chave: 'festa-mini.seta', jogo: JOGO_SPRITES, nome: 'Seta mostrada (Memória)',
    desc: 'A seta grande que o Raposo mostra no painel (e a setinha em cima das CPUs), apontando para a direita: o jogo gira para as outras direções. Marque "pintar com a cor" e desenhe em tons claros de cinza para cada direção ficar com a sua cor.',
    largura: 80, altura: 68, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'mostrando', nome: 'Mostrando', quadros: 1, fps: 8 }],
    previa: g => seta(g, 0, 0, 40, 'dir', COR_SETA.dir, 'rgba(59,42,107,0.6)'),
  },
  {
    chave: 'festa-mini.botao-seta', jogo: JOGO_SPRITES, nome: 'Botão de seta (Memória)',
    desc: 'Os quatro botões do controle, desenhados apontando para a direita (o jogo gira para cima, baixo e esquerda). Aceso quando o Raposo mostra ou você aperta; errado quando você erra. Com "pintar com a cor", cada direção pega a sua cor.',
    largura: 40, altura: 40, ancora: 'centro', tingir: true,
    animacoes: [
      { id: 'apagado', nome: 'Apagado', quadros: 1, fps: 8 },
      { id: 'aceso', nome: 'Aceso', quadros: 1, fps: 8 },
      { id: 'errado', nome: 'Errado', quadros: 1, fps: 8 },
    ],
    previa: (g, anim) => pintarBotaoSeta(g, 0, 0, 'dir', anim === 'aceso', anim === 'errado'),
  },
  {
    chave: 'festa-mini.balao', jogo: JOGO_SPRITES, nome: 'Balão (Tiro ao Alvo)',
    desc: 'O balão que sobe atrás do balcão, sem o barbante (o jogo faz). Os balões têm cores diferentes: marque "pintar com a cor" e desenhe em tons claros de cinza.',
    largura: 36, altura: 42, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'subindo', nome: 'Subindo', quadros: 1, fps: 8 }],
    previa: g => pintarBalao(g, 0, 0, 17, CORES_BALAO[0], false),
  },
  {
    chave: 'festa-mini.balao-dourado', jogo: JOGO_SPRITES, nome: 'Balão dourado (Tiro ao Alvo)',
    desc: 'O balão dourado, menor e mais rápido (vale 3), sem o barbante. A estrelinha brilhando o jogo continua fazendo.',
    largura: 28, altura: 32, ancora: 'centro',
    animacoes: [{ id: 'subindo', nome: 'Subindo', quadros: 1, fps: 8 }],
    previa: g => pintarBalao(g, 0, 0, 13, '#f5c518', true),
  },
  {
    chave: 'festa-mini.alvo', jogo: JOGO_SPRITES, nome: 'Alvo (Tiro ao Alvo)',
    desc: 'O alvo que passa deslizando no trilho, com o pauzinho embaixo. O topo do alvo fica no topo do quadro.',
    largura: 40, altura: 58, ancora: 'topo',
    animacoes: [{ id: 'deslizando', nome: 'Deslizando', quadros: 1, fps: 8 }],
    previa: g => desenharAlvo(g, 0, 19, 19),
  },
  {
    chave: 'festa-mini.mira', jogo: JOGO_SPRITES, nome: 'Mira (Tiro ao Alvo)',
    desc: 'A mira de cada jogador. Marque "pintar com a cor" e desenhe em tons claros de cinza para cada um ter a sua cor. O clarão do tiro o jogo faz.',
    largura: 40, altura: 40, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'mirando', nome: 'Mirando', quadros: 1, fps: 8 }],
    previa: g => pintarMira(g, 0, 0, CORES[0], false),
  },
  {
    chave: 'festa-mini.corda', jogo: JOGO_SPRITES, nome: 'Pedaço da corda (Pula-Corda)',
    desc: 'Um pedacinho da corda, deitado (da esquerda para a direita). O jogo repete o pedaço ao longo da corda toda, virando na curva, então as pontas precisam emendar. "Atrás" é a corda passando por trás dos coelhos; sem ele, vale "Na frente".',
    largura: 16, altura: 6, ancora: 'centro',
    animacoes: [{ id: 'frente', nome: 'Na frente', quadros: 1, fps: 8 }, { id: 'atras', nome: 'Atrás', quadros: 1, fps: 8 }],
    previa: (g, anim) => {
      g.strokeStyle = anim === 'atras' ? '#b23a64' : '#ff5d8f';
      g.lineWidth = anim === 'atras' ? 3 : 4;
      g.beginPath();
      g.moveTo(-8, 0);
      g.lineTo(8, 0);
      g.stroke();
    },
  },
];
registrarPecas(SPRITES);

/* ─── a lista para a tela da festa ───────────────── */

export const MINIJOGOS = {
  chuva: {
    nome: 'Chuva de Bolotas', emoji: '🌰', tipo: 'sobrevivencia', duracao: 35, formatos: ['todos', 'times'],
    regras: 'As árvores da clareira estão soltando bolotas, pinhas e até pedregulhos! As sombras no chão mostram onde cada coisa vai cair, e elas ficam vermelhas quando a queda está perto. Ande para os lados para desviar e pule por cima das pedras que descem rolando. Quem for atingido fica tonto e sai da rodada. A chuva aperta com o tempo, e todos que estiverem de pé no fim dos 35 segundos vencem.',
    controles: { teclado: '← → para andar, Espaço ou ↑ para pular', toque: 'Botões ◀ ▶ para andar e Pular para pular' },
    botoes: { esq: true, dir: true, cima: false, baixo: false, pular: 'Pular', acao: null },
    criar(ctx) { return montar(ctx, MINIJOGOS.chuva, jogoChuva); },
  },
  corrida: {
    nome: 'Corrida da Toca', emoji: '🏁', tipo: 'corrida', duracao: 25, formatos: ['todos', 'times'],
    regras: 'Todos os coelhos alinhados, cada um na sua raia! Aperte esquerda e direita alternando, uma de cada vez: cada passo certo dá mais velocidade. Se apertar a mesma tecla duas vezes seguidas, o coelho tropeça e perde o embalo. Quem cruzar a linha de chegada primeiro vence; quem não chegar em 25 segundos fica atrás de todos que chegaram, pela distância percorrida.',
    controles: { teclado: 'Alterne ← e → (uma de cada vez)', toque: 'Alterne os botões ◀ e ▶' },
    botoes: { esq: true, dir: true, cima: false, baixo: false, pular: null, acao: null },
    criar(ctx) { return montar(ctx, MINIJOGOS.corrida, jogoCorrida); },
  },
  cacada: {
    nome: 'Caça às Cenouras', emoji: '🥕', tipo: 'pontos', duracao: 30, formatos: ['todos', 'times'],
    regras: 'A horta está cheia de cenouras brotando por todo lado! Corra pelo jardim e encoste numa cenoura para arrancá-la: vale 1 ponto, e as douradas valem 3. Cada cenoura é de quem chegar primeiro, e elas somem se ninguém pegar a tempo (piscam antes de sumir). Quem juntar mais pontos em 30 segundos vence.',
    controles: { teclado: 'Setas para andar; encoste na cenoura para pegar', toque: 'Botões de seta para andar; encoste na cenoura para pegar' },
    botoes: { esq: true, dir: true, cima: true, baixo: true, pular: null, acao: null },
    criar(ctx) { return montar(ctx, MINIJOGOS.cacada, jogoCacada); },
  },
  memoria: {
    nome: 'Memória do Raposo', emoji: '🦊', tipo: 'pontos', duracao: 45, formatos: ['todos', 'times'],
    regras: 'O Raposo vai mostrar uma sequência de setas no painel. Quando aparecer "Sua vez!", repita a sequência inteira na mesma ordem antes que a barrinha acabe. A cada rodada a sequência ganha mais uma seta. Errou uma seta ou deixou o tempo acabar? Está fora das próximas rodadas. Cada rodada completa vale 1 ponto.',
    controles: { teclado: 'Setas ↑ ↓ ← → para repetir a sequência', toque: 'Botões de seta para repetir a sequência' },
    botoes: { esq: true, dir: true, cima: true, baixo: true, pular: null, acao: null },
    criar(ctx) { return montar(ctx, MINIJOGOS.memoria, jogoMemoria); },
  },
  alvo: {
    nome: 'Tiro ao Alvo', emoji: '🎯', tipo: 'pontos', duracao: 30, formatos: ['todos', 'times'],
    regras: 'Barraca de tiro da festa! Balões sobem por trás do balcão e alvos passam deslizando nos trilhos. Leve a sua mira colorida até um deles e atire: quem acertar primeiro leva o ponto. Balões e alvos valem 1 ponto, e os balões dourados, menores e mais rápidos, valem 3. Quem fizer mais pontos em 30 segundos vence.',
    controles: { teclado: 'Setas para mirar, Espaço ou Enter para atirar (ou clique no alvo)', toque: 'Toque no balão para mirar e atirar, ou use as setas e o botão Atirar' },
    botoes: { esq: true, dir: true, cima: true, baixo: true, pular: null, acao: 'Atirar' },
    criar(ctx) { return montar(ctx, MINIJOGOS.alvo, jogoAlvo); },
  },
  corda: {
    nome: 'Pula-Corda', emoji: '🪢', tipo: 'sobrevivencia', duracao: 40, formatos: ['todos', 'times'],
    regras: 'Dois coelhos da corte batem a corda e todo mundo pula junto! Pule bem na hora em que a corda passa rente ao chão. A corda acelera com o tempo e às vezes os batedores fazem uma finta ou seguram a corda lá em cima, então preste atenção e não pule à toa. Quem for pego pela corda sai; todos que ainda estiverem pulando no fim dos 40 segundos vencem.',
    controles: { teclado: 'Espaço ou ↑ para pular', toque: 'Botão Pular' },
    botoes: { esq: false, dir: false, cima: false, baixo: false, pular: 'Pular', acao: null },
    criar(ctx) { return montar(ctx, MINIJOGOS.corda, jogoCorda); },
  },
};
