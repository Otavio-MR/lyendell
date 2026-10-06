// Os minijogos e as janelas do litoral da Ilha do Club Coelho (veja litoral.js): Pegando Ondas (Prainha),
// Pescaria no Gelo (Ancoradouro), Aventura a Jato (Mirante), Caça ao Tesouro (Quartel do Capitão), o piano do
// Farol, a vista do telescópio e da luneta e o Baú de itens raros do Porão. Carregado só na hora do clique.
// Cada minijogo abre numa janela com o seu canvas (teclado, mouse e toque); no fim, o resultado vai por
// ctx.terminarMinijogo (src/clube-ilha/litoral.js diz quantas cenouras vale).

import { h, trocar, botao, modal, aviso, num } from '../core.js';
import { som } from '../arcade.js';
import { desenharCoelho } from '../desenho-coelho.js';
import { RARIDADES } from './litoral.js';

const mudo = () => { try { return localStorage.getItem('arcade-mudo') === '1'; } catch { return false; } };
function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  g.fill();
}
function ret(g, x, y, w, hh, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, hh, r); else g.rect(x, y, w, hh);
  g.fill();
}
function forma(g, cor, pts) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
function linha(g, cor, larg, pts) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
function texto(g, t, x, y, cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center') {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillText(t, x + 1.5, y + 1.5);
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
function degrade(g, y0, y1, paradas) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
function coelho(g, ctx, x, y, escala, opcoes = {}) {
  g.save();
  g.translate(x, y);
  g.scale(escala, escala);
  desenharCoelho(g, 0, 0, { pelo: ctx.visual?.cor || '#e9dcc3', roupa: ctx.visual?.roupa || {}, ...opcoes });
  g.restore();
}
const perto = (ax, ay, bx, by, r) => (ax - bx) ** 2 + (ay - by) ** 2 < r * r;
const sortear = (a, b) => a + Math.random() * (b - a);

// A moldura comum: janela, canvas que acompanha o tamanho, laço de 60 quadros e a tela de fim.
function janela({ titulo, largura = 600, altura = 420, jogo, ctx, montar }) {
  const tela = h('canvas', { class: 'minijogo-tela', style: { aspectRatio: `${largura} / ${altura}` }, tabindex: '0' });
  const g = tela.getContext('2d');
  const sobre = h('div', { class: 'cobra-sobre minijogo-sobre' });
  const extra = h('div', { class: 'minijogo-extra' });
  let quadro = 0;
  let ultimo = 0;
  let parado = false;
  const limpezas = [];
  const m = modal({
    titulo, tamanho: 'grande', classe: 'minijogo', fecharFora: false,
    corpo: h('div', { class: 'minijogo-corpo' }, h('div', { class: 'minijogo-moldura' }, tela, sobre), extra),
    aoFechar: () => { parado = true; cancelAnimationFrame(quadro); limpezas.forEach(f => f()); },
  });
  const ajustar = () => {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    g.setTransform(w / largura, 0, 0, hh / altura, 0, 0);
  };
  const api = {
    tela, g, sobre, extra, m,
    ponto(ev) {
      const r = tela.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * largura, y: ((ev.clientY - r.top) / r.height) * altura };
    },
    ouvir(alvo, tipo, f, opcoes) { alvo.addEventListener(tipo, f, opcoes); limpezas.push(() => alvo.removeEventListener(tipo, f, opcoes)); },
    inicio(tituloCaixa, linhas, aoComecar) {
      sobre.hidden = false;
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, tituloCaixa), linhas.map((l, i) => h('p', { class: i ? 'suave' : '' }, l)),
        botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { sobre.hidden = true; aoComecar(); tela.focus({ preventScroll: true }); } })));
    },
    async terminar(pontos, linhas) {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Fim!'), linhas.map(l => h('p', null, l)), h('p', { class: 'suave' }, 'Guardando as cenouras...')));
      sobre.hidden = false;
      let r = null;
      try { r = await ctx.terminarMinijogo(jogo, pontos); } catch (e) { aviso(e.message || 'Não deu para guardar as cenouras.', 'erro'); }
      if (parado) return;
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim!'),
        linhas.map(l => h('p', null, l)),
        r && h('p', { class: 'arcade-cenouras' }, r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje. Volte amanhã!' : 'Nenhuma cenoura desta vez.'),
        h('div', { class: 'minijogo-botoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => api.reiniciar() }),
          botao('Sair', { onclick: () => m.fechar() }))));
    },
    reiniciar: () => {},
  };
  const jogoAtual = montar(api);
  function laco(agora) {
    if (parado) return;
    quadro = requestAnimationFrame(laco);
    const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    ajustar();
    try { jogoAtual.passo(dt, agora / 1000); } catch (e) { console.error(titulo, e); }
  }
  quadro = requestAnimationFrame(laco);
  setTimeout(() => tela.focus({ preventScroll: true }), 50);
  return m;
}
// Botões grandes embaixo do jogo (para o celular). acoes: [[rótulo, aoApertar, aoSoltar?]]
function botoesDeToque(api, acoes) {
  trocar(api.extra, h('div', { class: 'litoral-botoes' }, acoes.map(([rotulo, apertar, soltar]) => {
    const b = h('button', { type: 'button', class: 'litoral-botao' }, rotulo);
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); apertar(); });
    if (soltar) for (const tipo of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(tipo, () => soltar());
    return b;
  })));
}
function desenharPopups(g, e, dt) {
  for (const p of e.popups) { p.ate -= dt; p.y -= 26 * dt; texto(g, p.texto, p.x, p.y, p.cor || '#fbf3e0', '700 17px "Cinzel", Georgia, serif'); }
  e.popups = e.popups.filter(p => p.ate > 0);
}

/* ─── Pegando Ondas (surfe) ──────────────────────── */

const TRUQUES = { giro: { nome: 'Giro', tecla: '←' }, mortal: { nome: 'Mortal', tecla: '→' }, agarra: { nome: 'Agarra a prancha', tecla: '↓' } };
const DURACAO_TRUQUE = 0.55;

export function abrirSurfe(ctx) {
  const L = 600;
  const A = 420;
  const LABIO = 150;
  const BASE = 335;
  const X = 210;
  const yDe = f => BASE - f * (BASE - LABIO);
  return janela({
    titulo: 'Pegando Ondas', largura: L, altura: A, jogo: 'surfe', ctx,
    montar(api) {
      let e;
      let alvo = null;
      const teclas = new Set();
      function novo() {
        e = { tempo: 60, vidas: 3, pontos: 0, f: 0.35, ar: null, truque: null, truques: [], coisas: [], proxima: 1, vel: 230, invul: 0, caiu: 0, popups: [], situacao: 'inicio', melhor: 0 };
        alvo = null;
        api.inicio('Pegando Ondas', [
          'Surfe na onda! Suba e desça com as setas (ou arrastando o dedo). Pegue as conchas e desvie das pedras.',
          'Na crista da onda, aperte Espaço (ou deslize para cima) para pular. No ar: ← Giro, → Mortal, ↓ Agarra a prancha. Termine o truque antes de cair na água!',
        ], () => { e.situacao = 'jogando'; });
      }
      api.reiniciar = novo;
      function pular() {
        if (e.situacao !== 'jogando' || e.ar || e.caiu > 0) return;
        if (e.f < 0.82) { e.popups.push({ x: X, y: yDe(e.f) - 70, texto: 'Suba até a crista!', ate: 0.9, cor: '#bfe4f7' }); return; }
        e.ar = { h: 0, vh: 430 };
        e.truques = [];
        som('pulo');
      }
      function truque(tipo) {
        if (e.situacao !== 'jogando' || !e.ar || e.truque) return;
        e.truque = { tipo, t: 0 };
      }
      function cair(msg) {
        if (e.invul > 0) return;
        e.vidas--;
        e.invul = 1.8;
        e.caiu = 1.1;
        e.ar = null;
        e.truque = null;
        e.truques = [];
        e.f = 0.25;
        e.popups.push({ x: X, y: yDe(e.f) - 80, texto: msg, ate: 1.3, cor: '#ff9a9a' });
        som('agua');
        if (e.vidas <= 0) acabar();
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        const p = Math.floor(e.pontos);
        api.terminar(p, [`${num(p)} pontos`, `Melhor sequência de truques: ${e.melhor}`]);
      }
      // Teclado
      api.ouvir(document, 'keydown', ev => {
        const k = ev.code;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(k)) ev.preventDefault();
        if (ev.repeat) return;
        teclas.add(k);
        if (k === 'Space') pular();
        if ((k === 'ArrowUp' || k === 'KeyW') && e.f >= 0.82) pular();
        if (k === 'ArrowLeft' || k === 'KeyA') truque('giro');
        if (k === 'ArrowRight' || k === 'KeyD') truque('mortal');
        if (k === 'ArrowDown' || k === 'KeyS') truque('agarra');
      });
      api.ouvir(document, 'keyup', ev => teclas.delete(ev.code));
      // Toque: arrastar move na onda; deslizar rápido faz pulo e truques.
      let gesto = null;
      api.ouvir(api.tela, 'pointerdown', ev => { const p = api.ponto(ev); gesto = { x: p.x, y: p.y, t: performance.now() }; alvo = (BASE - p.y) / (BASE - LABIO); });
      api.ouvir(api.tela, 'pointermove', ev => { if (gesto) alvo = (BASE - api.ponto(ev).y) / (BASE - LABIO); });
      api.ouvir(api.tela, 'pointerup', ev => {
        if (!gesto) return;
        const p = api.ponto(ev);
        const dx = p.x - gesto.x;
        const dy = p.y - gesto.y;
        if (performance.now() - gesto.t < 300 && Math.hypot(dx, dy) > 45) {
          if (Math.abs(dy) > Math.abs(dx)) { if (dy < 0) pular(); else truque('agarra'); } else truque(dx < 0 ? 'giro' : 'mortal');
        }
        gesto = null;
        alvo = null;
      });
      botoesDeToque(api, [['↑ Pular', pular], ['← Giro', () => truque('giro')], ['↓ Agarra', () => truque('agarra')], ['→ Mortal', () => truque('mortal')]]);
      novo();

      function criarCoisa() {
        const r = Math.random();
        const x = L + 30;
        if (r < 0.5) { const f = sortear(0.1, 0.95); for (let k = 0; k < 3; k++) e.coisas.push({ tipo: 'concha', x: x + k * 34, f }); }
        else if (r < 0.85) e.coisas.push({ tipo: 'pedra', x, f: sortear(0.05, 0.72) });
        else e.coisas.push({ tipo: 'gaivota', x, h: sortear(40, 120), fase: Math.random() * 6 });
      }
      function atualizar(dt) {
        e.tempo -= dt;
        if (e.tempo <= 0) { e.tempo = 0; acabar(); return; }
        e.vel = 230 + (60 - e.tempo) * 3;
        e.invul = Math.max(0, e.invul - dt);
        e.caiu = Math.max(0, e.caiu - dt);
        if (e.caiu <= 0) e.pontos += 10 * dt;
        // Subir e descer na onda
        if (!e.ar && e.caiu <= 0) {
          if (teclas.has('ArrowUp') || teclas.has('KeyW')) e.f += 1.3 * dt;
          if (teclas.has('ArrowDown') || teclas.has('KeyS')) e.f -= 1.3 * dt;
          if (alvo != null) { const d = alvo - e.f; e.f += Math.sign(d) * Math.min(Math.abs(d), 1.7 * dt); }
          e.f = Math.max(0, Math.min(1, e.f));
        }
        // No ar
        if (e.ar) {
          e.ar.vh -= 900 * dt;
          e.ar.h += e.ar.vh * dt;
          if (e.truque) {
            e.truque.t += dt;
            if (e.truque.t >= DURACAO_TRUQUE) { e.truques.push(e.truque.tipo); e.truque = null; som('passo'); }
          }
          if (e.ar.h <= 0) {
            if (e.truque) cair('Caiu no meio do truque!');
            else {
              e.ar = null;
              if (e.truques.length) {
                const pts = e.truques.reduce((s, _, i) => s + 100 * (i + 1), 0);
                e.pontos += pts;
                e.melhor = Math.max(e.melhor, e.truques.length);
                e.popups.push({ x: X, y: LABIO - 60, texto: `${e.truques.map(t => TRUQUES[t].nome).join(' + ')}! +${pts}`, ate: 1.4, cor: '#ffe46b' });
                som('poder');
              }
              e.truques = [];
              e.f = 0.92;
            }
          }
        }
        // As coisas da onda
        e.proxima -= dt;
        if (e.proxima <= 0) { criarCoisa(); e.proxima = sortear(0.6, 1.2); }
        const by = e.ar ? LABIO - e.ar.h : yDe(e.f);
        for (const c of e.coisas) {
          c.x -= e.vel * dt;
          if (c.tipo === 'gaivota') { c.x -= 60 * dt; c.fase += dt * 8; }
          if (c.pego) continue;
          if (c.tipo === 'concha' && perto(c.x, yDe(c.f), X, by - 10, 28)) { c.pego = true; e.pontos += 25; som('moeda'); e.popups.push({ x: c.x, y: yDe(c.f) - 20, texto: '+25', ate: 0.8 }); }
          if (c.tipo === 'pedra' && !e.ar && e.caiu <= 0 && Math.abs(c.x - X) < 24 && Math.abs(c.f - e.f) < 0.11) cair('Bateu na pedra!');
          if (c.tipo === 'gaivota' && e.ar && perto(c.x, LABIO - c.h, X, by - 30, 30)) cair('Uma gaivota no caminho!');
        }
        e.coisas = e.coisas.filter(c => !c.pego && c.x > -60);
      }

      function desenhar(t, dt) {
        const g = api.g;
        g.fillStyle = degrade(g, 0, 130, [[0, '#4fb0e3'], [1, '#c3e9f7']]);
        g.fillRect(0, 0, L, 130);
        el(g, 520, 50, 22, 22, '#fff4c2');
        forma(g, '#7d9a6a', [0, 130, 60, 112, 140, 106, 200, 130]);
        // O mar e a onda grande
        g.fillStyle = degrade(g, 120, A, [[0, '#2f8fb8'], [1, '#155a7e']]);
        g.fillRect(0, 120, L, A - 120);
        g.fillStyle = degrade(g, LABIO - 10, BASE + 40, [[0, '#8fe0ea'], [0.5, '#3fb0cc'], [1, '#1f7fa6']]);
        g.beginPath();
        g.moveTo(0, BASE + 60);
        g.lineTo(0, LABIO + 30);
        for (let x = 0; x <= L; x += 20) g.lineTo(x, LABIO + Math.sin(x * 0.03 + t * 3) * 4 - (x < 120 ? (120 - x) * 0.3 : 0));
        g.lineTo(L, BASE + 60);
        g.closePath();
        g.fill();
        // Riscos de velocidade na face da onda
        const desl = (t * (e?.vel || 230)) % 80;
        for (let k = 0; k < 14; k++) {
          const y = LABIO + 20 + (k * 37) % (BASE - LABIO);
          const x = ((k * 97) % L) - desl + 80;
          ret(g, x, y, 34 + (k % 3) * 12, 2, 'rgba(255,255,255,0.3)', 1);
        }
        // A crista com espuma e o tubo à esquerda
        for (let x = 0; x <= L; x += 14) el(g, x, LABIO + Math.sin(x * 0.03 + t * 3) * 4, 9, 5, 'rgba(255,255,255,0.9)');
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.moveTo(0, LABIO - 30); g.quadraticCurveTo(110, LABIO - 50, 120, LABIO); g.quadraticCurveTo(70, LABIO - 10, 40, BASE); g.lineTo(0, BASE); g.closePath(); g.fill();
        for (let k = 0; k < 10; k++) el(g, 20 + Math.sin(t * 4 + k) * 20, LABIO + k * 18, 10, 6, 'rgba(255,255,255,0.7)');
        ret(g, 0, BASE + 50, L, A - BASE - 50, 'rgba(10,50,70,0.35)');
        if (!e) return;
        // Conchas, pedras e gaivotas
        for (const c of e.coisas) {
          if (c.tipo === 'concha') {
            const y = yDe(c.f);
            el(g, c.x, y, 10, 7, '#f4c7c3'); el(g, c.x, y - 1, 6, 4, '#fbe3c8');
          } else if (c.tipo === 'pedra') {
            const y = yDe(c.f);
            forma(g, '#5b5550', [c.x - 22, y + 10, c.x - 12, y - 18, c.x + 4, y - 26, c.x + 20, y - 8, c.x + 24, y + 10]);
            el(g, c.x, y + 10, 26, 6, 'rgba(255,255,255,0.7)');
          } else {
            const y = LABIO - c.h;
            const a = Math.sin(c.fase) * 7;
            linha(g, '#f7f7f2', 3, [c.x - 15, y - a, c.x, y, c.x + 15, y - a]);
            el(g, c.x, y + 1, 4, 2.4, '#f7f7f2');
          }
        }
        // O coelho na prancha
        const by = e.ar ? LABIO - e.ar.h : yDe(e.f);
        g.save();
        g.translate(X, by);
        if (e.invul > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.45;
        if (e.caiu > 0) {
          g.rotate((1.1 - e.caiu) * 9);
          g.translate(0, (1.1 - e.caiu) * 30);
        } else if (e.truque) {
          const q = e.truque.t / DURACAO_TRUQUE;
          if (e.truque.tipo === 'giro') g.scale(Math.cos(q * Math.PI * 2), 1);
          else if (e.truque.tipo === 'mortal') { g.translate(0, -24); g.rotate(q * Math.PI * 2); g.translate(0, 24); } else g.scale(1, 0.82);
        } else if (!e.ar) g.rotate(-0.15 + (e.f - 0.5) * 0.2);
        el(g, 0, 2, 34, 6, '#e05a5a');
        ret(g, -30, 0, 60, 2, 'rgba(255,255,255,0.7)', 1);
        coelho(g, ctx, 0, -2, 1.25, { dir: 1, t, pose: e.truque?.tipo === 'agarra' ? 'sentado' : null });
        g.restore();
        if (!e.ar && e.caiu <= 0) for (let k = 0; k < 6; k++) el(g, X - 30 - k * 8, by + Math.sin(t * 20 + k) * 3, 5 - k * 0.6, 3, 'rgba(255,255,255,0.75)');
        // Placar
        texto(g, `${Math.ceil(e.tempo)}s`, 20, 22, '#fff', '700 18px "Cinzel", Georgia, serif', 'left');
        texto(g, num(Math.floor(e.pontos)), L - 20, 22, '#ffe46b', '700 20px "Cinzel", Georgia, serif', 'right');
        for (let k = 0; k < e.vidas; k++) el(g, L - 30 - k * 24, 50, 6, 13, '#e05a5a', 1.2);
        if (e.ar) texto(g, e.truques.map(x => TRUQUES[x].nome).join(' + ') || 'No ar! ← → ↓', L / 2, 22, '#ffffff', '700 16px "Cinzel", Georgia, serif');
        desenharPopups(g, e, dt);
      }

      let ultimoT = 0;
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t, ultimoT ? t - ultimoT : 0);
          ultimoT = t;
        },
      };
    },
  });
}

/* ─── Pescaria no Gelo ───────────────────────────── */

const PEIXES_GELO = {
  comum: { valor: 1, cor: '#8fb8d8', tam: 13, vel: [70, 110], chance: 0.55 },
  listrado: { valor: 1, cor: '#e0a050', tam: 12, vel: [110, 150], chance: 0.3 },
  dourado: { valor: 2, cor: '#e8c24a', tam: 11, vel: [150, 200], chance: 0.15 },
};

export function abrirPescaGelo(ctx) {
  const L = 600;
  const A = 420;
  const GELO = 95;
  const BX = 300;
  return janela({
    titulo: 'Pescaria no Gelo', largura: L, altura: A, jogo: 'pesca_gelo', ctx,
    montar(api) {
      let e;
      const teclas = new Set();
      function novo() {
        e = { tempo: 75, minhocas: 3, pontos: 0, pegos: 0, hx: BX, hy: 170, tx: BX, ty: 170, fisgado: null, coisas: [], proximo: 0.4, proximaQueda: 2, peixao: false, popups: [], situacao: 'inicio', choque: 0 };
        api.inicio('Pescaria no Gelo', [
          'Leve o anzol com a minhoca até um peixe (mouse, dedo ou setas) e traga o peixe até o buraco no gelo.',
          'O siri belisca a linha e leva a minhoca. A bota que afunda derruba o peixe do anzol. A lata de minhocas dá mais uma. No fim aparece o Peixão: só morde se o anzol já tiver um peixinho!',
        ], () => { e.situacao = 'jogando'; });
      }
      api.reiniciar = novo;
      const mirar = ev => { const p = api.ponto(ev); e.tx = p.x; e.ty = p.y; };
      api.ouvir(api.tela, 'pointermove', mirar);
      api.ouvir(api.tela, 'pointerdown', mirar);
      api.ouvir(document, 'keydown', ev => { if (/^Arrow|^Key[WASD]$/.test(ev.code)) { ev.preventDefault(); teclas.add(ev.code); } });
      api.ouvir(document, 'keyup', ev => teclas.delete(ev.code));
      novo();

      const anzol = () => [e.hx, e.hy + 6];
      function sortearPeixe() {
        let r = Math.random();
        let tipo = 'comum';
        for (const [k, p] of Object.entries(PEIXES_GELO)) { if (r < p.chance) { tipo = k; break; } r -= p.chance; }
        const p = PEIXES_GELO[tipo];
        const d = Math.random() < 0.5 ? 1 : -1;
        e.coisas.push({ tipo, d, x: d > 0 ? -30 : L + 30, y: sortear(GELO + 50, A - 50), vel: sortear(...p.vel), fase: Math.random() * 6 });
      }
      function soltar(msg) {
        if (!e.fisgado) return;
        e.fisgado.solto = true;
        e.fisgado = null;
        if (msg) e.popups.push({ x: e.hx, y: e.hy, texto: msg, ate: 1.2, cor: '#ffd08a' });
      }
      function perderMinhoca(msg) {
        e.minhocas--;
        e.choque = 0.5;
        soltar();
        e.popups.push({ x: e.hx, y: e.hy - 10, texto: msg, ate: 1.3, cor: '#ff9a9a' });
        som('bater');
        if (e.minhocas <= 0) acabar(false);
      }
      function acabar(peixao) {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som(peixao ? 'vida' : 'fim');
        api.terminar(e.pontos, [peixao ? 'Você pescou o Peixão!' : 'Fim da pescaria.', `${e.pegos} ${e.pegos === 1 ? 'peixe' : 'peixes'} · ${e.pontos} ${e.pontos === 1 ? 'ponto' : 'pontos'}`]);
      }

      function atualizar(dt) {
        e.tempo -= dt;
        if (e.tempo <= 0) { e.tempo = 0; acabar(false); return; }
        e.choque = Math.max(0, e.choque - dt);
        if (teclas.has('ArrowUp') || teclas.has('KeyW')) e.ty -= 280 * dt;
        if (teclas.has('ArrowDown') || teclas.has('KeyS')) e.ty += 280 * dt;
        if (teclas.has('ArrowLeft') || teclas.has('KeyA')) e.tx -= 280 * dt;
        if (teclas.has('ArrowRight') || teclas.has('KeyD')) e.tx += 280 * dt;
        e.tx = Math.max(50, Math.min(L - 50, e.tx));
        e.ty = Math.max(GELO + 10, Math.min(A - 25, e.ty));
        const vmax = e.fisgado?.tipo === 'peixao' ? 150 : 320;
        const dx = e.tx - e.hx;
        const dy = e.ty - e.hy;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) { const k = Math.min(1, (vmax * dt) / dist); e.hx += dx * k; e.hy += dy * k; }
        // Aparecem peixes, siris, botas e latas de minhoca; o Peixão chega no fim.
        e.proximo -= dt;
        if (e.proximo <= 0) {
          if (Math.random() < 0.18) { const d = Math.random() < 0.5 ? 1 : -1; e.coisas.push({ tipo: 'siri', d, x: d > 0 ? -30 : L + 30, y: sortear(GELO + 90, A - 40), vel: sortear(45, 70), fase: 0 }); } else sortearPeixe();
          e.proximo = sortear(0.6, 1.3);
        }
        e.proximaQueda -= dt;
        if (e.proximaQueda <= 0) {
          e.coisas.push({ tipo: Math.random() < 0.3 ? 'lata' : 'bota', x: sortear(70, L - 70), y: GELO + 5, vel: sortear(35, 55), fase: Math.random() * 6 });
          e.proximaQueda = sortear(2.5, 4.5);
        }
        if (!e.peixao && e.tempo <= 25) { e.peixao = true; e.coisas.push({ tipo: 'peixao', d: 1, x: -80, y: A - 95, vel: 45, fase: 0 }); e.popups.push({ x: L / 2, y: 140, texto: 'O Peixão apareceu!', ate: 2, cor: '#ffe46b' }); som('alerta'); }
        const [ax, ay] = anzol();
        for (const c of e.coisas) {
          c.fase += dt * 3;
          if (c === e.fisgado) { c.x = ax + Math.sin(c.fase * 3) * 3; c.y = ay + (c.tipo === 'peixao' ? 24 : 12); continue; }
          if (c.tipo === 'bota' || c.tipo === 'lata') { c.y += c.vel * dt; c.x += Math.sin(c.fase) * 18 * dt; } else {
            c.x += c.d * c.vel * dt * (c.solto ? 1.8 : 1);
            if (c.tipo === 'peixao' && (c.x > L - 60 || c.x < 60) && !c.solto) { if (c.x > L - 60 && c.d > 0) c.d = -1; else if (c.x < 60 && c.d < 0) c.d = 1; }
            if (c.tipo === 'siri') c.y += Math.sin(c.fase * 2) * 10 * dt;
          }
          if (c.solto || e.situacao !== 'jogando') continue;
          if (PEIXES_GELO[c.tipo] && !e.fisgado && perto(c.x + c.d * 10, c.y, ax, ay, 16)) { e.fisgado = c; som('pisao'); }
          else if (c.tipo === 'peixao' && perto(c.x + c.d * 30, c.y, ax, ay, 34)) {
            if (e.fisgado && e.fisgado.tipo !== 'peixao') { e.coisas = e.coisas.filter(x => x !== e.fisgado); e.fisgado = c; som('poder'); e.popups.push({ x: ax, y: ay - 30, texto: 'Fisgou o Peixão!', ate: 1.5, cor: '#ffe46b' }); }
            else if (!e.fisgado) { perderMinhoca('O Peixão comeu a minhoca!'); c.x -= c.d * 40; }
          } else if (c.tipo === 'siri' && perto(c.x, c.y, ax, ay, 26)) { perderMinhoca('O siri beliscou a linha!'); c.solto = true; }
          else if (c.tipo === 'bota' && e.fisgado && perto(c.x, c.y, e.fisgado.x, e.fisgado.y, 26)) { soltar('A bota derrubou o peixe!'); som('quebra'); }
          else if (c.tipo === 'lata' && perto(c.x, c.y, ax, ay, 24)) { c.pego = true; e.minhocas = Math.min(5, e.minhocas + 1); e.popups.push({ x: ax, y: ay - 20, texto: '+1 minhoca', ate: 1, cor: '#ffb0c0' }); som('moeda'); }
        }
        // Peixe trazido até o buraco
        if (e.fisgado && perto(ax, ay, BX, GELO + 14, 30)) {
          const c = e.fisgado;
          e.fisgado = null;
          c.pego = true;
          if (c.tipo === 'peixao') { e.pontos += 10; e.pegos++; acabar(true); return; }
          const v = PEIXES_GELO[c.tipo].valor;
          e.pontos += v;
          e.pegos++;
          e.popups.push({ x: BX, y: GELO - 10, texto: `+${v}`, ate: 1, cor: v > 1 ? '#ffe46b' : '#fbf3e0' });
          som('moeda');
        }
        e.coisas = e.coisas.filter(c => !c.pego && c.x > -120 && c.x < L + 120 && c.y < A + 20);
        if (e.fisgado && !e.coisas.includes(e.fisgado)) e.fisgado = null;
      }

      function desenharPeixe(g, c, t) {
        g.save();
        g.translate(c.x, c.y);
        g.scale(c.d || 1, 1);
        if (c.tipo === 'peixao') {
          forma(g, '#4f6f8a', [-40, 0, -70, -26 + Math.sin(t * 6) * 4, -70, 26 + Math.sin(t * 6) * 4]);
          el(g, 0, 0, 48, 28, '#5f86a6');
          el(g, 4, 8, 36, 12, '#a9c4d8');
          el(g, 30, -8, 5, 5, '#ffffff'); el(g, 31, -8, 2.5, 2.5, '#1b1403');
          linha(g, '#3a5a72', 2, [40, 6, 48, 10]);
          forma(g, '#4f6f8a', [-10, -26, 10, -40, 16, -24]);
        } else {
          const def = PEIXES_GELO[c.tipo];
          const r = def.tam;
          forma(g, def.cor, [-r * 0.8, 0, -r * 1.5, -r * 0.6 + Math.sin(t * 10 + c.fase) * 2, -r * 1.5, r * 0.6 + Math.sin(t * 10 + c.fase) * 2]);
          el(g, 0, 0, r, r * 0.6, def.cor);
          if (c.tipo === 'listrado') for (const dx of [-4, 3]) ret(g, dx, -r * 0.5, 3, r, 'rgba(120,60,20,0.5)');
          el(g, r * 0.55, -r * 0.15, 2, 2, '#1b1403');
          if (c.tipo === 'dourado') el(g, -r * 0.2, -r * 0.2, 2, 2, '#fff7c0');
        }
        g.restore();
      }
      function desenhar(t, dt) {
        const g = api.g;
        // Dentro da cabana, o gelo e o buraco
        ret(g, 0, 0, L, 50, '#6f8fa6');
        for (let x = 0; x < L; x += 30) ret(g, x, 0, 2, 50, 'rgba(20,40,60,0.3)');
        g.fillStyle = degrade(g, 46, GELO, [[0, '#f4f9fc'], [0.2, '#cfe6f2'], [1, '#8fc0dc']]);
        g.fillRect(0, 46, L, GELO - 46);
        ret(g, BX - 26, 46, 52, GELO - 46, '#1f5f86');
        el(g, BX, 48, 28, 6, '#2a6f96');
        // A água e as paredes de gelo
        g.fillStyle = degrade(g, GELO, A, [[0, '#2f7fae'], [1, '#0d2d48']]);
        g.fillRect(0, GELO, L, A - GELO);
        g.save(); g.globalAlpha = 0.1;
        for (let k = 0; k < 4; k++) forma(g, '#ffffff', [BX - 20 + k * 10, GELO, BX - 10 + k * 10, GELO, BX - 60 + k * 50 + Math.sin(t + k) * 10, A, BX - 100 + k * 50, A]);
        g.restore();
        forma(g, '#a9d2e6', [0, GELO, 40, GELO + 60, 20, 200, 50, 300, 24, A, 0, A]);
        forma(g, '#a9d2e6', [L, GELO, L - 36, GELO + 80, L - 16, 230, L - 46, 330, L - 20, A, L, A]);
        ret(g, 0, A - 16, L, 16, '#3a5a72');
        for (let k = 0; k < 10; k++) el(g, 30 + k * 60, A - 14, 14, 6, '#4f6f8a');
        for (let k = 0; k < 6; k++) { const f = (t * 0.2 + k / 6) % 1; g.strokeStyle = `rgba(255,255,255,${(0.4 * (1 - f)).toFixed(2)})`; g.lineWidth = 1; g.beginPath(); g.arc(80 + k * 90, A - 20 - f * (A - GELO - 30), 3, 0, Math.PI * 2); g.stroke(); }
        if (!e) return;
        // O coelho sentado no gelo, a vara e a linha
        coelho(g, ctx, 240, 50, 1.3, { pose: 'sentado', t, roupa: { ...(ctx.visual?.roupa || {}), mao: null } });
        linha(g, '#7a4a2a', 3, [262, 26, BX, 8]);
        linha(g, e.choque > 0 ? '#ffe46b' : 'rgba(255,255,255,0.85)', 1, [BX, 8, BX, GELO, e.hx, e.hy]);
        for (const c of e.coisas) {
          if (PEIXES_GELO[c.tipo] || c.tipo === 'peixao') desenharPeixe(g, c, t);
          else if (c.tipo === 'siri') {
            g.save(); g.translate(c.x, c.y);
            el(g, 0, 0, 16, 9, '#d8504a');
            for (const d of [-1, 1]) { el(g, d * 20, -6, 6, 5, '#d8504a'); linha(g, '#d8504a', 2, [d * 10, -2, d * 18, -5]); for (let k = 0; k < 3; k++) linha(g, '#d8504a', 1.5, [d * 8, 4, d * (14 + k * 3), 10 + Math.sin(t * 12 + k) * 2]); }
            el(g, -5, -9, 2, 2, '#1b1403'); el(g, 5, -9, 2, 2, '#1b1403');
            g.restore();
          } else if (c.tipo === 'bota') {
            g.save(); g.translate(c.x, c.y); g.rotate(Math.sin(c.fase) * 0.3);
            ret(g, -10, -14, 12, 20, '#5b4a3f', 3); ret(g, -10, 2, 24, 8, '#5b4a3f', 3); ret(g, -10, 8, 24, 3, '#2a2018');
            g.restore();
          } else if (c.tipo === 'lata') {
            ret(g, c.x - 10, c.y - 12, 20, 24, '#9aa3ad', 4);
            ret(g, c.x - 10, c.y - 4, 20, 9, '#e07a8a');
            linha(g, '#e07a8a', 3, [c.x - 4, c.y - 12, c.x - 2, c.y - 20, c.x + 3, c.y - 16]);
          }
        }
        // O anzol
        g.strokeStyle = '#ccd'; g.lineWidth = 2;
        g.beginPath(); g.arc(e.hx - 4, e.hy, 5, 0, Math.PI); g.stroke();
        if (!e.fisgado) el(g, e.hx - 4, e.hy + 6, 4, 2.5, '#e07a8a');
        // Placar
        texto(g, `${Math.ceil(e.tempo)}s`, 16, 22, '#fff', '700 18px "Cinzel", Georgia, serif', 'left');
        texto(g, `Peixes: ${e.pontos}`, L - 16, 22, '#ffe46b', '700 18px "Cinzel", Georgia, serif', 'right');
        for (let k = 0; k < e.minhocas; k++) {
          const x = L - 26 - k * 22;
          g.strokeStyle = '#e07a8a'; g.lineWidth = 4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x - 7, 70); g.quadraticCurveTo(x - 2, 62, x + 2, 70); g.quadraticCurveTo(x + 5, 76, x + 8, 68); g.stroke();
        }
        desenharPopups(g, e, dt);
      }

      let ultimoT = 0;
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t, ultimoT ? t - ultimoT : 0);
          ultimoT = t;
        },
      };
    },
  });
}

/* ─── Aventura a Jato ────────────────────────────── */

export function abrirJato(ctx) {
  const L = 600;
  const A = 420;
  const X = 140;
  const MAR = A - 34;
  return janela({
    titulo: 'Aventura a Jato', largura: L, altura: A, jogo: 'jato', ctx,
    montar(api) {
      let e;
      function novo() {
        e = { tempo: 75, comb: 100, y: 200, vy: 0, cenouras: 0, coisas: [], proxima: 0.6, proximaLata: 5, vel: 200, dist: 0, invul: 0, popups: [], situacao: 'inicio', segurando: false, caindo: 0, chegou: false };
        api.inicio('Aventura a Jato', [
          'Segure Espaço (ou o mouse, ou o dedo) para ligar o jato e subir. Solte para descer.',
          'Pegue as cenouras e as latas de combustível. Desvie das nuvens de tempestade e das gaivotas. Sem combustível, a aventura acaba!',
        ], () => { e.situacao = 'jogando'; });
      }
      api.reiniciar = novo;
      const ligar = v => { if (e) e.segurando = v; };
      api.ouvir(document, 'keydown', ev => { if (['Space', 'ArrowUp', 'KeyW'].includes(ev.code)) { ev.preventDefault(); ligar(true); } });
      api.ouvir(document, 'keyup', ev => { if (['Space', 'ArrowUp', 'KeyW'].includes(ev.code)) ligar(false); });
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); ligar(true); });
      for (const tipo of ['pointerup', 'pointerleave', 'pointercancel']) api.ouvir(api.tela, tipo, () => ligar(false));
      botoesDeToque(api, [['Segure para voar', () => ligar(true), () => ligar(false)]]);
      novo();

      function criar() {
        const r = Math.random();
        const x = L + 40;
        if (r < 0.5) {
          const y0 = sortear(70, MAR - 70);
          const onda = Math.random() < 0.5;
          for (let k = 0; k < 6; k++) e.coisas.push({ tipo: 'cenoura', x: x + k * 30, y: y0 + (onda ? Math.sin(k * 0.9) * 40 : 0) });
        } else if (r < 0.78) e.coisas.push({ tipo: 'nuvem', x: x + 20, y: sortear(60, MAR - 90), fase: Math.random() * 6 });
        else e.coisas.push({ tipo: 'gaivota', x, y: sortear(50, MAR - 60), fase: Math.random() * 6, y0: 0 });
      }
      function bater() {
        if (e.invul > 0) return;
        e.comb = Math.max(0, e.comb - 22);
        e.invul = 1.3;
        e.popups.push({ x: X, y: e.y - 40, texto: 'Ai! -combustível', ate: 1, cor: '#ff9a9a' });
        som('bater');
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som(e.chegou ? 'fase' : 'fim');
        const pontos = e.cenouras + (e.chegou ? 20 : 0);
        api.terminar(pontos, [e.chegou ? 'Você chegou ao fim da aventura! (+20)' : 'Acabou o combustível!', `${e.cenouras} cenouras pegas no caminho`]);
      }

      function atualizar(dt) {
        if (e.caindo > 0) {
          e.caindo -= dt;
          e.vy += 600 * dt;
          e.y = Math.min(MAR, e.y + e.vy * dt);
          if (e.caindo <= 0) acabar();
          return;
        }
        e.tempo -= dt;
        if (e.tempo <= 0) { e.tempo = 0; e.chegou = true; acabar(); return; }
        e.vel = 200 + (75 - e.tempo) * 2.4;
        e.invul = Math.max(0, e.invul - dt);
        const jato = e.segurando && e.comb > 0;
        e.vy += (jato ? -950 : 560) * dt;
        e.vy = Math.max(-320, Math.min(380, e.vy));
        e.y += e.vy * dt;
        e.comb -= (jato ? 6.5 : 1.6) * dt;
        if (e.y < 34) { e.y = 34; e.vy = 0; }
        if (e.y > MAR - 10) { e.y = MAR - 10; e.vy = -320; e.comb -= 10; e.popups.push({ x: X, y: e.y - 40, texto: 'Splash!', ate: 0.8, cor: '#bfe4f7' }); som('agua'); }
        if (e.comb <= 0) { e.comb = 0; e.caindo = 1.2; e.vy = 0; som('morte'); return; }
        e.proxima -= dt;
        if (e.proxima <= 0) { criar(); e.proxima = sortear(0.7, 1.3); }
        e.proximaLata -= dt;
        if (e.proximaLata <= 0) { e.coisas.push({ tipo: 'lata', x: L + 30, y: sortear(70, MAR - 60) }); e.proximaLata = sortear(4.5, 7); }
        for (const c of e.coisas) {
          c.x -= e.vel * dt;
          if (c.tipo === 'gaivota') { c.x -= 70 * dt; c.fase += dt * 8; c.y += Math.sin(c.fase * 0.3) * 30 * dt; }
          if (c.pego) continue;
          if (c.tipo === 'cenoura' && perto(c.x, c.y, X, e.y - 20, 26)) { c.pego = true; e.cenouras++; som('moeda'); }
          else if (c.tipo === 'lata' && perto(c.x, c.y, X, e.y - 20, 30)) { c.pego = true; e.comb = Math.min(100, e.comb + 35); e.popups.push({ x: c.x, y: c.y - 20, texto: '+combustível', ate: 1, cor: '#7fe08a' }); som('poder'); }
          else if (c.tipo === 'nuvem' && Math.abs(c.x - X) < 54 && Math.abs(c.y - (e.y - 20)) < 32) bater();
          else if (c.tipo === 'gaivota' && perto(c.x, c.y, X, e.y - 20, 28)) bater();
        }
        e.coisas = e.coisas.filter(c => !c.pego && c.x > -80);
        e.dist += e.vel * dt;
      }

      function desenhar(t, dt) {
        const g = api.g;
        g.fillStyle = degrade(g, 0, MAR, [[0, '#3f7fd0'], [0.7, '#9fd0f0'], [1, '#e6f4fb']]);
        g.fillRect(0, 0, L, MAR);
        const d = e ? e.dist : t * 100;
        // Montanhas e nuvens de fundo (paralaxe)
        for (let k = 0; k < 4; k++) {
          const x = ((k * 260 - d * 0.1) % 1040 + 1040) % 1040 - 220;
          forma(g, '#b9cfdf', [x, MAR, x + 90, MAR - 110, x + 140, MAR - 80, x + 220, MAR]);
          forma(g, '#f4f9fc', [x + 70, MAR - 86, x + 90, MAR - 110, x + 112, MAR - 92]);
        }
        for (let k = 0; k < 5; k++) {
          const x = ((k * 170 - d * 0.3) % 850 + 850) % 850 - 120;
          for (const [dx, dy, r] of [[0, 0, 20], [22, -8, 24], [46, 0, 18]]) el(g, x + dx, 60 + (k * 41) % 120 + dy, r, r * 0.7, 'rgba(255,255,255,0.75)');
        }
        g.fillStyle = degrade(g, MAR, A, [[0, '#2f8fb8'], [1, '#155a7e']]);
        g.fillRect(0, MAR, L, A - MAR);
        for (let k = 0; k < 12; k++) ret(g, ((k * 61 - d * 0.6) % 640 + 640) % 640 - 20, MAR + 6 + (k * 7) % 22, 26, 2, 'rgba(255,255,255,0.35)', 1);
        if (!e) return;
        for (const c of e.coisas) {
          if (c.tipo === 'cenoura') {
            g.save(); g.translate(c.x, c.y); g.rotate(0.5);
            forma(g, '#e07a2a', [-6, -12, 6, -12, 0, 14]); el(g, 0, -15, 3, 6, '#4f8a3c');
            g.restore();
          } else if (c.tipo === 'lata') {
            ret(g, c.x - 12, c.y - 16, 24, 32, '#e8c24a', 4); ret(g, c.x - 6, c.y - 22, 12, 8, '#55585f', 2);
            texto(g, 'J', c.x, c.y, '#8a2a20', '700 14px sans-serif');
          } else if (c.tipo === 'nuvem') {
            for (const [dx, dy, r] of [[-30, 4, 22], [-6, -10, 28], [22, 2, 24], [0, 10, 26]]) el(g, c.x + dx, c.y + dy, r, r * 0.7, '#5b5f73');
            if (Math.sin(t * 4 + c.fase) > 0.7) linha(g, '#ffe46b', 3, [c.x - 4, c.y + 18, c.x + 6, c.y + 32, c.x - 2, c.y + 34, c.x + 8, c.y + 50]);
          } else {
            const a = Math.sin(c.fase) * 8;
            linha(g, '#f7f7f2', 3, [c.x - 16, c.y - a, c.x, c.y, c.x + 16, c.y - a]);
            el(g, c.x, c.y + 1, 5, 3, '#f7f7f2'); el(g, c.x - 5, c.y + 1, 2, 1.2, '#f0a030');
          }
        }
        // O coelho com o jato nas costas
        g.save();
        g.translate(X, e.y);
        if (e.invul > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.45;
        g.rotate(e.caindo > 0 ? (1.2 - e.caindo) * 3 : Math.max(-0.3, Math.min(0.3, e.vy / 900)));
        ret(g, -26, -50, 12, 30, '#d0473a', 6); ret(g, -16, -50, 12, 30, '#d0473a', 6);
        if (e.segurando && e.comb > 0 && e.caindo <= 0) {
          for (const dx of [-20, -10]) { el(g, dx, -14 + Math.sin(t * 40) * 2, 5, 12 + Math.sin(t * 30 + dx) * 3, '#f4b03a'); el(g, dx, -16, 3, 6, '#fff1a8'); }
        }
        coelho(g, ctx, 0, 0, 1.2, { dir: 1, t, andando: false });
        g.restore();
        // Placar
        texto(g, `🥕 ${e.cenouras}`, 16, 24, '#ffe46b', '700 18px "Cinzel", Georgia, serif', 'left');
        texto(g, `${Math.ceil(e.tempo)}s`, L - 16, 24, '#fff', '700 18px "Cinzel", Georgia, serif', 'right');
        ret(g, L / 2 - 80, 14, 160, 14, 'rgba(0,0,0,0.35)', 7);
        ret(g, L / 2 - 78, 16, 156 * (e.comb / 100), 10, e.comb > 30 ? '#7fe08a' : '#ff8a6a', 5);
        texto(g, 'Combustível', L / 2, 40, '#fbf3e0', '700 11px "Cinzel", Georgia, serif');
        desenharPopups(g, e, dt);
      }

      let ultimoT = 0;
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t, ultimoT ? t - ultimoT : 0);
          ultimoT = t;
        },
      };
    },
  });
}

/* ─── Caça ao Tesouro ────────────────────────────── */

const ACHADOS = {
  moeda: { nome: 'Uma moeda antiga!', pontos: 3, cor: '#e8c24a' },
  pompom: { nome: 'Um Pompom de pelúcia perdido!', pontos: 5, cor: '#f2a7c8' },
  osso: { nome: 'Um osso de peixe. Eca!', pontos: 0, cor: '#e8e2d0' },
  bota: { nome: 'Uma bota velha...', pontos: 0, cor: '#5b4a3f' },
};
export function dicaDoTesouro(d) {
  if (d <= 1) return { texto: 'Fervendo!', cor: '#e0402a' };
  if (d === 2) return { texto: 'Quente', cor: '#f08a3a' };
  if (d === 3) return { texto: 'Morno', cor: '#e8c24a' };
  if (d <= 5) return { texto: 'Frio', cor: '#6fb0e0' };
  return { texto: 'Congelando', cor: '#3f6fd0' };
}

export function abrirTesouro(ctx) {
  const L = 600;
  const A = 420;
  const COLS = 8;
  const LINHAS = 6;
  const CW = 64;
  const CH = 52;
  const X0 = (L - COLS * CW) / 2;
  const Y0 = 76;
  const PAS = [8, 7, 6];
  return janela({
    titulo: 'Caça ao Tesouro', largura: L, altura: A, jogo: 'tesouro', ctx,
    montar(api) {
      let e;
      function rodada(n) {
        const tesouro = { c: Math.floor(Math.random() * COLS), l: Math.floor(Math.random() * LINHAS) };
        const achados = new Map();
        const tipos = Object.keys(ACHADOS);
        while (achados.size < 7) {
          const c = Math.floor(Math.random() * COLS);
          const l = Math.floor(Math.random() * LINHAS);
          if (c === tesouro.c && l === tesouro.l) continue;
          achados.set(`${c},${l}`, tipos[Math.floor(Math.random() * tipos.length)]);
        }
        Object.assign(e, { rodada: n, tesouro, achados, cavados: new Map(), pas: PAS[n], achou: false, msg: 'Clique num quadrado para cavar.', espera: 0 });
      }
      function novo() {
        e = { pontos: 0, achadosTotal: 0, cursor: { c: 3, l: 2 }, situacao: 'inicio', popups: [] };
        rodada(0);
        api.inicio('Caça ao Tesouro', [
          'O mapa do Capitão esconde um tesouro em cada rodada (são 3). Cave com as pás: cada buraco diz se o tesouro está quente ou frio.',
          'Ache o tesouro antes de acabarem as pás! Cada pá que sobrar vale pontos. Pelo caminho dá para achar moedas e Pompons perdidos. (Mouse, dedo, ou setas e Enter.)',
        ], () => { e.situacao = 'jogando'; });
      }
      api.reiniciar = novo;
      function cavar(c, l) {
        if (e.situacao !== 'jogando' || e.espera > 0 || e.cavados.has(`${c},${l}`)) return;
        e.cursor = { c, l };
        e.pas--;
        const chave = `${c},${l}`;
        if (c === e.tesouro.c && l === e.tesouro.l) {
          const pts = 20 + e.pas * 5;
          e.pontos += pts;
          e.cavados.set(chave, { tesouro: true });
          e.achou = true;
          e.msg = `Tesouro! +${pts} pontos (20 + ${e.pas} ${e.pas === 1 ? 'pá' : 'pás'} sobrando).`;
          e.espera = 2.2;
          som('vida');
          return;
        }
        const d = Math.max(Math.abs(c - e.tesouro.c), Math.abs(l - e.tesouro.l));
        const dica = dicaDoTesouro(d);
        const achado = e.achados.get(chave);
        e.cavados.set(chave, { dica, achado });
        if (achado) {
          const a = ACHADOS[achado];
          e.pontos += a.pontos;
          e.achadosTotal++;
          e.msg = `${dica.texto}. E olha: ${a.nome}${a.pontos ? ` +${a.pontos}` : ''}`;
          som(a.pontos ? 'moeda' : 'passo');
        } else {
          e.msg = `${dica.texto}.`;
          som('passo');
        }
        if (e.pas <= 0) { e.msg = 'Acabaram as pás! O tesouro estava ali (o X vermelho).'; e.espera = 2.6; som('alerta'); }
      }
      function seguir() {
        if (e.rodada + 1 < PAS.length) { rodada(e.rodada + 1); return; }
        e.situacao = 'fim';
        som('fim');
        api.terminar(e.pontos, [`${e.pontos} pontos nas 3 rodadas`, `${e.achadosTotal} ${e.achadosTotal === 1 ? 'coisa achada' : 'coisas achadas'} pelo caminho`]);
      }
      api.ouvir(api.tela, 'pointerdown', ev => {
        const p = api.ponto(ev);
        const c = Math.floor((p.x - X0) / CW);
        const l = Math.floor((p.y - Y0) / CH);
        if (c >= 0 && c < COLS && l >= 0 && l < LINHAS) cavar(c, l);
      });
      api.ouvir(document, 'keydown', ev => {
        if (!e || e.situacao !== 'jogando') return;
        const mov = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.code];
        if (mov) { ev.preventDefault(); e.cursor.c = Math.max(0, Math.min(COLS - 1, e.cursor.c + mov[0])); e.cursor.l = Math.max(0, Math.min(LINHAS - 1, e.cursor.l + mov[1])); }
        if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); cavar(e.cursor.c, e.cursor.l); }
      });
      novo();

      function desenhar(t) {
        const g = api.g;
        ret(g, 0, 0, L, A, '#5b3420');
        ret(g, 12, 10, L - 24, A - 20, '#e8d5a6', 10);
        ret(g, 20, 18, L - 40, A - 36, '#efe0b6', 8);
        texto(g, `Rodada ${e.rodada + 1} de 3`, 34, 40, '#5b3420', '700 17px "Cinzel", Georgia, serif', 'left');
        texto(g, `${e.pontos} pontos`, L - 34, 40, '#8a2a20', '700 17px "Cinzel", Georgia, serif', 'right');
        for (let k = 0; k < e.pas; k++) {
          const x = 250 + k * 17;
          ret(g, x, 30, 3, 16, '#7a4a2a');
          forma(g, '#9aa3ad', [x - 4, 44, x + 7, 44, x + 6, 54, x + 1.5, 57, x - 3, 54]);
        }
        // A grade do mapa
        for (let c = 0; c < COLS; c++) {
          for (let l = 0; l < LINHAS; l++) {
            const x = X0 + c * CW;
            const y = Y0 + l * CH;
            const k = e.cavados.get(`${c},${l}`);
            ret(g, x + 2, y + 2, CW - 4, CH - 4, (c + l) % 2 ? 'rgba(160,130,80,0.18)' : 'rgba(160,130,80,0.08)', 4);
            if (!k) {
              if ((c * 7 + l * 3) % 9 === 0) { linha(g, '#6d9a52', 2, [x + 20, y + 36, x + 24, y + 22, x + 28, y + 36]); }
              continue;
            }
            el(g, x + CW / 2, y + CH / 2 + 4, 22, 12, '#6b4a2b');
            el(g, x + CW / 2, y + CH / 2 + 2, 18, 9, '#3a2414');
            if (k.tesouro) {
              ret(g, x + 16, y + 10, 32, 22, '#8a5a32', 4); ret(g, x + 16, y + 10, 32, 6, '#d8b13a', 2);
              for (let s = 0; s < 3; s++) el(g, x + 20 + s * 12, y + 8 - Math.abs(Math.sin(t * 4 + s)) * 4, 3, 3, '#ffe46b');
            } else {
              ret(g, x + 4, y + 4, CW - 8, 14, k.dica.cor, 4);
              texto(g, k.dica.texto, x + CW / 2, y + 11, '#ffffff', '700 10px "Cinzel", Georgia, serif');
              if (k.achado) el(g, x + CW / 2, y + CH / 2 + 4, 7, 6, ACHADOS[k.achado].cor);
            }
          }
        }
        // O tesouro aparece quando as pás acabam
        if (!e.achou && e.pas <= 0) {
          const x = X0 + e.tesouro.c * CW + CW / 2;
          const y = Y0 + e.tesouro.l * CH + CH / 2;
          linha(g, '#c0392b', 5, [x - 14, y - 14, x + 14, y + 14]);
          linha(g, '#c0392b', 5, [x + 14, y - 14, x - 14, y + 14]);
        }
        const cx = X0 + e.cursor.c * CW;
        const cy = Y0 + e.cursor.l * CH;
        g.strokeStyle = `rgba(138,42,32,${(0.5 + Math.sin(t * 5) * 0.3).toFixed(2)})`;
        g.lineWidth = 3;
        g.strokeRect(cx + 2, cy + 2, CW - 4, CH - 4);
        texto(g, e.msg, L / 2, A - 22, '#3a2414', '700 14px "EB Garamond", Georgia, serif');
      }

      return {
        passo(dt, t) {
          if (e.situacao === 'jogando' && e.espera > 0) { e.espera -= dt; if (e.espera <= 0) seguir(); }
          desenhar(t);
        },
      };
    },
  });
}

/* ─── O piano do Farol ───────────────────────────── */

const TECLAS_PIANO = [
  ['Dó', 261.63, 'KeyA', false], ['Dó#', 277.18, 'KeyW', true], ['Ré', 293.66, 'KeyS', false], ['Ré#', 311.13, 'KeyE', true],
  ['Mi', 329.63, 'KeyD', false], ['Fá', 349.23, 'KeyF', false], ['Fá#', 369.99, 'KeyT', true], ['Sol', 392.0, 'KeyG', false],
  ['Sol#', 415.3, 'KeyY', true], ['Lá', 440.0, 'KeyH', false], ['Lá#', 466.16, 'KeyU', true], ['Si', 493.88, 'KeyJ', false],
  ['Dó', 523.25, 'KeyK', false],
];
// "Brilha, brilha, estrelinha" (cantiga tradicional): a tecla branca (0 = Dó ... 7 = Dó de cima) e a duração.
const MUSICA_FAROL = [[0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2]];

export function abrirPiano() {
  let audio = null;
  function tocar(freq, dur = 0.9, quando = 0) {
    if (mudo()) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + quando;
      for (const [mult, tipo, vol] of [[1, 'triangle', 0.12], [2, 'sine', 0.04]]) {
        const o = audio.createOscillator();
        const v = audio.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(freq * mult, t0);
        v.gain.setValueAtTime(vol, t0);
        v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(v).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      }
    } catch { /* sem som neste navegador */ }
  }
  const botoes = TECLAS_PIANO.map(([nome, freq, , preta]) => {
    const b = h('button', { type: 'button', class: `litoral-tecla ${preta ? 'preta' : ''}`.trim(), 'aria-label': nome }, preta ? '' : nome);
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); apertar(b, freq); });
    return b;
  });
  function apertar(b, freq) {
    tocar(freq);
    b.classList.add('apertada');
    setTimeout(() => b.classList.remove('apertada'), 160);
  }
  const brancas = TECLAS_PIANO.map((x, i) => i).filter(i => !TECLAS_PIANO[i][3]);
  const aoTeclar = ev => {
    if (ev.repeat || ev.target.closest?.('input, textarea')) return;
    const i = TECLAS_PIANO.findIndex(x => x[2] === ev.code);
    if (i >= 0) { ev.preventDefault(); apertar(botoes[i], TECLAS_PIANO[i][1]); }
  };
  document.addEventListener('keydown', aoTeclar);
  function musica() {
    let quando = 0;
    for (const [k, dur] of MUSICA_FAROL) {
      const i = brancas[k];
      const b = botoes[i];
      tocar(TECLAS_PIANO[i][1], 0.45 * dur + 0.2, quando);
      setTimeout(() => { b.classList.add('apertada'); setTimeout(() => b.classList.remove('apertada'), 200); }, quando * 1000);
      quando += 0.45 * dur;
    }
  }
  return modal({
    titulo: 'O piano do faroleiro', tamanho: 'grande',
    corpo: h('div', { class: 'litoral-piano-caixa' },
      h('p', { class: 'suave' }, 'Toque com o mouse, com o dedo ou com o teclado (A W S E D F T G Y H U J K).'),
      h('div', { class: 'litoral-piano' }, botoes),
      h('div', { class: 'minijogo-botoes' }, botao('Tocar a música do faroleiro', { classe: 'btn-ouro', icone: 'musica', onclick: musica }))),
    aoFechar: () => document.removeEventListener('keydown', aoTeclar),
  });
}

/* ─── Vista do telescópio (Mirante) e da luneta (Ninho do Corvo) ── */

const VISTAS = {
  telescopio: { titulo: 'Pelo telescópio do Mirante', legenda: 'Lá vem o Saltador! E aquele ali... é o Raposo remando numa banheira com uma colher?' },
  luneta: { titulo: 'Pela luneta do Ninho do Corvo', legenda: 'O Grande Iceberg, uma baleia dando oi e uma gaivota fugindo com a cenoura de alguém!' },
};
export function desenharVista(g, tipo, t, L = 600, A = 340) {
  g.fillStyle = degrade(g, 0, A * 0.55, tipo === 'telescopio' ? [[0, '#3a2f6a'], [1, '#f2a070']] : [[0, '#4f9fe0'], [1, '#d4effa']]);
  g.fillRect(0, 0, L, A * 0.55);
  g.fillStyle = degrade(g, A * 0.55, A, [[0, '#3f8fb8'], [1, '#174f72']]);
  g.fillRect(0, A * 0.55, L, A * 0.45);
  for (let k = 0; k < 14; k++) ret(g, ((k * 83 + t * 20) % (L + 60)) - 30, A * 0.6 + (k * 17) % (A * 0.38), 30, 2, 'rgba(255,255,255,0.3)', 1);
  const mar = A * 0.55;
  if (tipo === 'telescopio') {
    // O Saltador navegando
    const nx = 380 + Math.sin(t * 0.3) * 30;
    const balanco = Math.sin(t * 1.2) * 0.04;
    g.save(); g.translate(nx, mar + 30); g.rotate(balanco);
    forma(g, '#5b3420', [-110, -30, 110, -30, 92, 0, -92, 0]);
    ret(g, -110, -36, 220, 8, '#7a4a2a');
    for (const [mx, alt] of [[-40, 150], [40, 120]]) {
      ret(g, mx - 3, -30 - alt, 6, alt, '#4a2e18');
      forma(g, '#f2e8cf', [mx - 40, -20 - alt * 0.9, mx + 40, -20 - alt * 0.9, mx + 46, -40 - alt * 0.3, mx - 46, -40 - alt * 0.3]);
    }
    g.restore();
    // O Raposo remando numa banheira
    const rx = 140 + Math.sin(t * 0.8) * 20;
    const ry = mar + 70 + Math.sin(t * 2) * 3;
    el(g, rx, ry, 46, 16, '#f2f2ee'); ret(g, rx - 46, ry - 14, 92, 12, '#f2f2ee', 6);
    for (const dx of [-36, 36]) ret(g, rx + dx - 3, ry + 6, 6, 10, '#d8b13a');
    el(g, rx, ry - 26, 16, 18, '#d8763a'); el(g, rx + 12, ry - 32, 9, 7, '#d8763a');
    forma(g, '#d8763a', [rx - 8, ry - 40, rx - 2, ry - 58, rx + 4, ry - 40]);
    forma(g, '#d8763a', [rx + 4, ry - 40, rx + 12, ry - 56, rx + 14, ry - 38]);
    el(g, rx + 20, ry - 31, 3, 3, '#1b1403'); el(g, rx + 14, ry - 36, 2, 2, '#1b1403');
    const remo = Math.sin(t * 5) * 0.6;
    g.save(); g.translate(rx + 20, ry - 18); g.rotate(remo);
    ret(g, -2, 0, 4, 34, '#c8ccd4'); el(g, 0, 36, 7, 10, '#c8ccd4');
    g.restore();
    el(g, rx + 60, ry + 4, 10, 3, 'rgba(255,255,255,0.6)');
  } else {
    // O Grande Iceberg com coelhinhos dançando
    forma(g, '#eef7fb', [60, mar + 20, 100, mar - 40, 140, mar - 20, 180, mar - 70, 230, mar - 10, 260, mar + 20]);
    forma(g, '#bfe0f0', [180, mar - 70, 230, mar - 10, 260, mar + 20, 200, mar + 20]);
    for (let k = 0; k < 4; k++) { const pulo = Math.abs(Math.sin(t * 7 + k)) * 4; el(g, 110 + k * 30, mar + 4 - pulo, 5, 7, ['#e9dcc3', '#c99a6b', '#f2a7c8', '#9aa3ad'][k]); el(g, 108 + k * 30, mar - 6 - pulo, 1.5, 4, ['#e9dcc3', '#c99a6b', '#f2a7c8', '#9aa3ad'][k]); }
    // A baleia
    const ciclo = t % 6;
    const bx = 440;
    el(g, bx, mar + 60, 70, 16, '#3f5f7a');
    if (ciclo < 3) for (let k = 0; k < 8; k++) { const f = (ciclo / 3 + k / 8) % 1; el(g, bx - 20 + Math.sin(k * 2) * 20 * f, mar + 44 - f * 70, 4, 4, `rgba(220,240,255,${(1 - f).toFixed(2)})`); }
    const cauda = Math.sin(t * 2) * 0.3;
    g.save(); g.translate(bx + 70, mar + 52); g.rotate(cauda);
    forma(g, '#3f5f7a', [0, 0, 18, -26, 30, -30, 14, -8, 30, 4]);
    g.restore();
    // A gaivota com a cenoura
    const gx = ((t * 60) % (L + 100)) - 50;
    const gy = 70 + Math.sin(t * 2) * 10;
    const a = Math.sin(t * 9) * 8;
    linha(g, '#f7f7f2', 3, [gx - 16, gy - a, gx, gy, gx + 16, gy - a]);
    el(g, gx, gy + 1, 5, 3, '#f7f7f2');
    g.save(); g.translate(gx + 6, gy + 6); g.rotate(1.2);
    forma(g, '#e07a2a', [-3, -8, 3, -8, 0, 10]); el(g, 0, -10, 2, 4, '#4f8a3c');
    g.restore();
  }
  // O círculo da lente
  g.save();
  g.fillStyle = '#0a0a10';
  g.beginPath();
  g.rect(0, 0, L, A);
  g.ellipse(L / 2, A / 2, A * 0.62, A * 0.46, 0, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.restore();
  g.strokeStyle = '#b8922a';
  g.lineWidth = 6;
  g.beginPath(); g.ellipse(L / 2, A / 2, A * 0.62, A * 0.46, 0, 0, Math.PI * 2); g.stroke();
}
export function abrirVista(ctx, tipo = 'telescopio') {
  const v = VISTAS[tipo] || VISTAS.telescopio;
  const tela = h('canvas', { class: 'litoral-vista', width: 1200, height: 680 });
  const g = tela.getContext('2d');
  let quadro = 0;
  let parado = false;
  const laco = agora => {
    if (parado) return;
    quadro = requestAnimationFrame(laco);
    g.setTransform(2, 0, 0, 2, 0, 0);
    try { desenharVista(g, tipo, agora / 1000); } catch (e) { console.error('Vista:', e); }
  };
  quadro = requestAnimationFrame(laco);
  return modal({
    titulo: v.titulo, tamanho: 'grande',
    corpo: h('div', { class: 'litoral-vista-caixa' }, tela, h('p', { class: 'litoral-legenda' }, v.legenda)),
    aoFechar: () => { parado = true; cancelAnimationFrame(quadro); },
  });
}

/* ─── O Baú de itens raros (Porão) ───────────────── */

// O dia de hoje no fuso do servidor (o mesmo de src/cobranca.js).
export function hojeNoClube(agora = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora); } catch { return agora.toISOString().slice(0, 10); }
}
export async function abrirBau(ctx) {
  const tres = [...RARIDADES].sort(() => Math.random() - 0.5).slice(0, 3);
  const lista = h('ul', { class: 'litoral-bau-lista' }, tres.map(x => h('li', null, x)));
  const ja = await ctx.progresso.ler('navio.bau');
  if (ja === hojeNoClube()) {
    modal({ titulo: 'Baú de itens raros', corpo: h('div', { class: 'litoral-bau' }, h('p', null, 'O baú já foi aberto hoje. O Capitão só põe um presente por dia. Volte amanhã!'), h('p', { class: 'suave' }, 'Mas dá para espiar as coisas raras lá dentro:'), lista) });
    return;
  }
  let r;
  try { r = await ctx.terminarMinijogo('bau_capitao', 1); } catch (e) { aviso(e.message || 'O baú está emperrado. Tente de novo daqui a pouco.', 'erro'); return; }
  try { await ctx.progresso.gravar('navio.bau', true); } catch { /* o presente já veio */ }
  som('vida');
  modal({
    titulo: 'Baú de itens raros',
    corpo: h('div', { class: 'litoral-bau' },
      h('p', { class: 'arcade-cenouras' }, r?.ganhou > 0 ? `🥕 +${r.ganhou} cenouras de presente do Capitão!` : 'Você já ganhou o máximo de cenouras de hoje, mas o baú abriu mesmo assim!'),
      h('p', { class: 'suave' }, 'Coisas raras que o Capitão trouxe de terras distantes:'),
      lista),
  });
}

// Para os testes (sem janela): os desenhos e as regras puras.
export const _jogos = { desenharVista, dicaDoTesouro, hojeNoClube, ACHADOS, PEIXES_GELO, TRUQUES };
