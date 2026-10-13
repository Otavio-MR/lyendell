// Os minijogos do Club Coelho, que dão cenouras: a Pescaria (no Lago) e a Dança da Toca (no Salão de Dança).
// Cada um abre numa janela com o seu canvas; no fim, o resultado vai para /api/clube/minijogo.

import { h, trocar, botao, modal, post, aviso, num } from './core.js';
import { som } from './arcade.js';
import { desenharCoelho, sorte, elipse as el } from './desenho-coelho.js';
import { registrarPecas, desenharSprite } from './sprites.js';

// Sprite enviado em #/recreacao/sprites para uma peça dos minijogos (false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `clube-mini.${peca}`, anim, x, y, o);

const mudo = () => { try { return localStorage.getItem('arcade-mudo') === '1'; } catch { return false; } };
function ret(g, x, y, w, hh, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, hh, r); else g.rect(x, y, w, hh);
  g.fill();
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

// A moldura comum: janela, canvas que acompanha o tamanho, laço de 60 quadros e a tela de fim.
function abrirMinijogo({ titulo, largura, altura, jogo, aoTerminar, montar }) {
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
    corpo: h('div', { class: 'minijogo-corpo' }, h('div', { class: 'minijogo-moldura', style: { '--razao': String(largura / altura) } }, tela, sobre), extra),
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
    aoLimpar: f => limpezas.push(f),
    ponto(ev) {
      const r = tela.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * largura, y: ((ev.clientY - r.top) / r.height) * altura };
    },
    ouvir(alvo, tipo, f) { alvo.addEventListener(tipo, f); limpezas.push(() => alvo.removeEventListener(tipo, f)); },
    async terminar(pontos, linhas) {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Fim!'), linhas.map(l => h('p', null, l)), h('p', { class: 'suave' }, 'Guardando as cenouras...')));
      sobre.hidden = false;
      let r = null;
      try { r = await post('/api/clube/minijogo', { jogo, pontos }); } catch (e) { aviso(e.message, 'erro'); }
      if (parado) return;
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim!'),
        linhas.map(l => h('p', null, l)),
        r && h('p', { class: 'arcade-cenouras' }, r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje. Volte amanhã!' : 'Nenhuma cenoura desta vez.'),
        h('div', { class: 'minijogo-botoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => api.reiniciar() }),
          botao('Sair', { onclick: () => m.fechar() }))));
      if (r) aoTerminar?.(r);
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

/* ─── Pescaria ────────────────────────────────────── */

const PEIXES = {
  peixe: { valor: 1, cor: '#8fb8d8', tam: 13, vel: [60, 100], chance: 0.5 },
  grande: { valor: 2, cor: '#4a7fb0', tam: 20, vel: [40, 70], chance: 0.2 },
  dourado: { valor: 3, cor: '#e8c24a', tam: 12, vel: [110, 150], chance: 0.1 },
  bota: { valor: 0, cor: '#5b4a3f', tam: 14, vel: [30, 45], chance: 0.1 },
  aguaviva: { valor: 0, cor: 'rgba(240,160,220,0.75)', tam: 14, vel: [20, 35], chance: 0.1 },
};
// A peça de sprite de cada coisa que nada no lago.
const PECA_PEIXE = { peixe: 'peixe', grande: 'peixe-grande', dourado: 'peixe-dourado', bota: 'bota', aguaviva: 'agua-viva' };
const ANIM_PEIXE = { bota: 'boiando' };

// p: { tipo, x, y, d (1 = nadando para a direita), fase }.
function desenharPeixe(g, p, t) {
  g.save();
  g.translate(p.x, p.y);
  g.scale(p.d, 1);
  if (!sp(g, PECA_PEIXE[p.tipo], ANIM_PEIXE[p.tipo] || 'nadando', 0, 0, { t: t + p.fase })) corpoDoPeixe(g, p.tipo, t, p.fase);
  g.restore();
}
function corpoDoPeixe(g, tipo, t, fase) {
  const def = PEIXES[tipo];
  if (tipo === 'aguaviva') {
    el(g, 0, 0, 14, 11, def.cor);
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = 'rgba(240,160,220,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-9 + k * 6, 6); g.quadraticCurveTo(-11 + k * 6 + Math.sin(t * 4 + k) * 4, 16, -9 + k * 6, 26); g.stroke();
    }
  } else if (tipo === 'bota') {
    ret(g, -10, -12, 12, 18, def.cor, 3);
    ret(g, -10, 2, 24, 8, def.cor, 3);
    ret(g, -10, 8, 24, 3, '#2a2018');
  } else {
    const r = def.tam;
    g.fillStyle = def.cor;
    g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(-r * 1.5, -r * 0.6 + Math.sin(t * 10 + fase) * 2); g.lineTo(-r * 1.5, r * 0.6 + Math.sin(t * 10 + fase) * 2); g.closePath(); g.fill();
    el(g, 0, 0, r, r * 0.6, def.cor);
    el(g, r * 0.1, r * 0.15, r * 0.7, r * 0.3, 'rgba(255,255,255,0.18)');
    el(g, r * 0.55, -r * 0.15, 2, 2, '#1b1403');
    if (tipo === 'dourado') el(g, -r * 0.2, -r * 0.2, 2, 2, '#fff7c0');
  }
}
// O siri que anda no fundo do lago (x, y: as patas no chão).
function desenharSiri(g, x, y, d, t) {
  if (!sp(g, 'siri', 'andando', x, y, { t, dir: d })) corpoDoSiri(g, x, y);
}
function corpoDoSiri(g, x, y) {
  g.save(); g.translate(x, y);
  el(g, 0, -8, 16, 9, '#d8504a');
  for (const d of [-1, 1]) { el(g, d * 20, -14, 6, 5, '#d8504a'); g.strokeStyle = '#d8504a'; g.lineWidth = 2; g.beginPath(); g.moveTo(d * 10, -10); g.lineTo(d * 18, -13); g.stroke(); }
  el(g, -5, -17, 2, 2, '#1b1403'); el(g, 5, -17, 2, 2, '#1b1403');
  g.restore();
}
// O trapiche lá em cima, de onde o coelho pesca (sup: a altura da água).
function desenharTrapichePesca(g, sup) {
  if (!sp(g, 'trapiche', 'parado', 130, sup + 22)) corpoDoTrapichePesca(g, sup);
}
function corpoDoTrapichePesca(g, sup) {
  ret(g, 0, sup - 30, 260, 14, '#8a5a32', 2);
  for (const x of [30, 120, 210]) ret(g, x, sup - 18, 8, 40, '#5b3c22');
}
// Uma alga do fundo (x, y: a raiz). k muda a altura e o balanço.
function desenharAlga(g, x, y, t, k) {
  if (!sp(g, 'alga', 'balancando', x, y, { t: t + k * 0.4 })) corpoDaAlga(g, x, y, t, k);
}
function corpoDaAlga(g, x, y, t, k) {
  g.strokeStyle = '#2f7a4a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(t * 1.5 + k) * 12, y - 38, x + Math.sin(t * 1.2 + k) * 6, y - 63 - (k % 3) * 12); g.stroke();
}
// O anzol na ponta da linha (x, y: onde a linha acaba), com ou sem a minhoca.
function desenharAnzol(g, x, y, comIsca) {
  if (!sp(g, 'anzol', comIsca ? 'com-isca' : 'sem-isca', x - 4, y + 3)) corpoDoAnzol(g, x, y, comIsca);
}
function corpoDoAnzol(g, x, y, comIsca) {
  g.strokeStyle = '#ccd'; g.lineWidth = 2;
  g.beginPath(); g.arc(x - 4, y, 5, 0, Math.PI); g.stroke();
  if (comIsca) el(g, x - 4, y + 5, 4, 2.5, '#e07a8a');
}

export function abrirPescaria({ visual, aoTerminar }) {
  const L = 600;
  const A = 420;
  const SUPERFICIE = 120;
  const FUNDO = 395;
  const X_ANZOL = 330;
  return abrirMinijogo({
    titulo: 'Pescaria no Lago', largura: L, altura: A, jogo: 'pesca', aoTerminar,
    montar(api) {
      let e;
      let alvoY = 200;
      const teclas = new Set();
      function novo() {
        e = { tempo: 90, iscas: 3, pontos: 0, pegos: 0, y: 200, fisgado: null, peixes: [], proximo: 0.6, siri: { x: 100, d: 1 }, popups: [], situacao: 'inicio', choque: 0, bolhas: [] };
        api.sobre.hidden = false;
        trocar(api.sobre, h('div', { class: 'cobra-caixa' },
          h('h2', null, 'Pescaria'),
          h('p', null, 'Mova o anzol para cima e para baixo (mouse, dedo ou setas). Fisgue um peixe e traga até a superfície.'),
          h('p', { class: 'suave' }, 'Cuidado: a água-viva solta o peixe ou come a isca, e o siri lá no fundo corta a linha. A bota velha não vale nada.'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; api.sobre.hidden = true; api.tela.focus(); } })));
      }
      api.reiniciar = novo;
      api.ouvir(api.tela, 'pointermove', ev => { alvoY = api.ponto(ev).y; });
      api.ouvir(api.tela, 'pointerdown', ev => { alvoY = api.ponto(ev).y; });
      api.ouvir(document, 'keydown', ev => { if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(ev.code)) { ev.preventDefault(); teclas.add(ev.code); } });
      api.ouvir(document, 'keyup', ev => teclas.delete(ev.code));
      novo();

      function sortearPeixe() {
        let r = Math.random();
        let tipo = 'peixe';
        for (const [k, p] of Object.entries(PEIXES)) { if (r < p.chance) { tipo = k; break; } r -= p.chance; }
        const p = PEIXES[tipo];
        const d = Math.random() < 0.5 ? 1 : -1;
        e.peixes.push({
          tipo, d, x: d > 0 ? -30 : L + 30, y: SUPERFICIE + 40 + Math.random() * (FUNDO - SUPERFICIE - 70),
          vel: p.vel[0] + Math.random() * (p.vel[1] - p.vel[0]), fase: Math.random() * 6,
        });
      }
      function perderIsca(texto) {
        e.iscas--;
        e.fisgado = null;
        e.choque = 0.5;
        e.popups.push({ x: X_ANZOL, y: e.y, texto, ate: 1.2, cor: '#ff9a9a' });
        som('bater');
        if (e.iscas <= 0) acabar();
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        api.terminar(e.pontos, [`${e.pegos} ${e.pegos === 1 ? 'peixe pescado' : 'peixes pescados'}`, `${e.pontos} ${e.pontos === 1 ? 'ponto' : 'pontos'}`]);
      }

      function atualizar(dt) {
        if (teclas.has('ArrowUp') || teclas.has('KeyW')) alvoY -= 260 * dt;
        if (teclas.has('ArrowDown') || teclas.has('KeyS')) alvoY += 260 * dt;
        alvoY = Math.max(SUPERFICIE - 30, Math.min(FUNDO, alvoY));
        const dy = alvoY - e.y;
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), 330 * dt);
        e.tempo -= dt;
        e.choque = Math.max(0, e.choque - dt);
        if (e.tempo <= 0) { e.tempo = 0; acabar(); return; }
        e.proximo -= dt;
        if (e.proximo <= 0) { sortearPeixe(); e.proximo = 0.7 + Math.random() * 0.9; }
        // O siri anda no fundo
        e.siri.x += e.siri.d * 45 * dt;
        if (e.siri.x < 40 || e.siri.x > L - 40) e.siri.d *= -1;
        if (e.y > FUNDO - 18 && Math.abs(e.siri.x - X_ANZOL) < 30) perderIsca('O siri cortou a linha!');
        for (const p of e.peixes) {
          if (p === e.fisgado) continue;
          p.x += p.d * p.vel * dt;
          p.fase += dt * 3;
          if (p.tipo === 'aguaviva') p.y += Math.sin(p.fase) * 25 * dt;
          const boca = p.x + p.d * PEIXES[p.tipo].tam;
          if (Math.abs(boca - X_ANZOL) < 12 && Math.abs(p.y - e.y) < 12 && e.y > SUPERFICIE) {
            if (p.tipo === 'aguaviva') { p.longe = true; perderIsca(e.fisgado ? 'Zap! O peixe fugiu.' : 'Zap! Lá se foi a isca.'); }
            else if (!e.fisgado) { e.fisgado = p; som('pisao'); }
          }
        }
        e.peixes = e.peixes.filter(p => p === e.fisgado || (!p.longe && p.x > -60 && p.x < L + 60));
        if (e.fisgado) {
          e.fisgado.x = X_ANZOL + Math.sin(performance.now() / 60) * 3;
          e.fisgado.y = e.y + 8;
          if (e.y <= SUPERFICIE + 4) {
            const v = PEIXES[e.fisgado.tipo].valor;
            e.pontos += v;
            if (v) e.pegos++;
            e.popups.push({ x: X_ANZOL, y: SUPERFICIE - 10, texto: v ? `+${v}` : 'Uma bota velha!', ate: 1.2, cor: v === 3 ? '#ffe46b' : '#fbf3e0' });
            som(v ? 'moeda' : 'agua');
            e.peixes = e.peixes.filter(p => p !== e.fisgado);
            e.fisgado = null;
          }
        }
        for (const p of e.popups) { p.ate -= dt; p.y -= 30 * dt; }
        e.popups = e.popups.filter(p => p.ate > 0);
        if (Math.random() < dt * 3) e.bolhas.push({ x: Math.random() * L, y: FUNDO, v: 20 + Math.random() * 30 });
        for (const b of e.bolhas) b.y -= b.v * dt;
        e.bolhas = e.bolhas.filter(b => b.y > SUPERFICIE);
      }

      function desenhar(t) {
        const g = api.g;
        // Céu e o trapiche
        let gr = g.createLinearGradient(0, 0, 0, SUPERFICIE);
        gr.addColorStop(0, '#f7a072'); gr.addColorStop(1, '#ffe2b8');
        g.fillStyle = gr; g.fillRect(0, 0, L, SUPERFICIE);
        el(g, 440, 58, 24, 24, '#fff0c0');
        desenharTrapichePesca(g, SUPERFICIE);
        // Água
        gr = g.createLinearGradient(0, SUPERFICIE, 0, A);
        gr.addColorStop(0, '#3d8ab8'); gr.addColorStop(1, '#123d5a');
        g.fillStyle = gr; g.fillRect(0, SUPERFICIE, L, A - SUPERFICIE);
        g.save();
        g.globalAlpha = 0.08;
        for (let k = 0; k < 5; k++) {
          g.fillStyle = '#ffffff';
          g.beginPath(); g.moveTo(80 + k * 120 + Math.sin(t + k) * 20, SUPERFICIE); g.lineTo(110 + k * 120, SUPERFICIE); g.lineTo(60 + k * 120, A); g.lineTo(20 + k * 120, A); g.closePath(); g.fill();
        }
        g.restore();
        for (let x = 0; x < L; x += 30) el(g, x + ((t * 20) % 30), SUPERFICIE + 2, 10, 2, 'rgba(255,255,255,0.35)');
        ret(g, 0, FUNDO + 6, L, A - FUNDO - 6, '#c9b07a');
        for (let k = 0; k < 9; k++) desenharAlga(g, 30 + k * 68, FUNDO + 8, t, k);
        for (const b of e.bolhas) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(b.x, b.y, 3, 0, Math.PI * 2); g.stroke(); }
        // O siri
        desenharSiri(g, e.siri.x, FUNDO, e.siri.d, t);
        for (const p of e.peixes) desenharPeixe(g, p, t);
        // O coelho pescando no trapiche, a vara e a linha
        g.save(); g.translate(170, SUPERFICIE - 30); g.scale(1.4, 1.4);
        desenharCoelho(g, 0, 0, { pelo: visual.cor, roupa: { ...visual.roupa, mao: null }, pose: 'sentado', t });
        g.restore();
        g.strokeStyle = '#7a4a2a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(195, SUPERFICIE - 48); g.lineTo(X_ANZOL, 30); g.stroke();
        g.strokeStyle = e.choque > 0 ? '#ffe46b' : 'rgba(255,255,255,0.8)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(X_ANZOL, 30); g.lineTo(X_ANZOL, e.y); g.stroke();
        desenharAnzol(g, X_ANZOL, e.y, !e.fisgado);
        // Placar
        texto(g, `${Math.ceil(e.tempo)}s`, 30, 22, '#fff', '700 18px "Cinzel", Georgia, serif', 'left');
        texto(g, `Peixes: ${e.pontos}`, L - 20, 22, '#ffe46b', '700 18px "Cinzel", Georgia, serif', 'right');
        texto(g, 'Iscas', L - 30 - e.iscas * 22, 50, '#fbf3e0', '700 15px "Cinzel", Georgia, serif', 'right');
        for (let k = 0; k < e.iscas; k++) { const x = L - 30 - k * 22; g.strokeStyle = '#e07a8a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 7, 52); g.quadraticCurveTo(x - 2, 44, x + 2, 52); g.quadraticCurveTo(x + 5, 58, x + 8, 50); g.stroke(); }
        for (const p of e.popups) texto(g, p.texto, p.x, p.y, p.cor, '700 18px "Cinzel", Georgia, serif');
      }

      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Dança da Toca ───────────────────────────────── */

const SETAS = ['←', '↓', '↑', '→'];
const CORES_SETA = ['#ff7ad9', '#6be0ff', '#7fe08a', '#ffe46b'];
const TECLA_FAIXA = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3 };
const NIVEIS = { facil: { nome: 'Fácil', vel: 230, meio: false, duplas: 0 }, medio: { nome: 'Médio', vel: 290, meio: 0.2, duplas: 0.05 }, dificil: { nome: 'Difícil', vel: 360, meio: 0.45, duplas: 0.12 } };
const BPM = 120;
const BATIDA = 60 / BPM;
const BATIDAS = 96;
const NOTAS_MUSICA = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
const BAIXO = [130.8, 110.0, 87.3, 98.0]; // Dó, Lá menor, Fá, Sol (4 batidas cada)
// O sprite da seta aponta para a direita; o jogo gira para cada faixa (esquerda, baixo, cima, direita).
const GIRO_SETA = [Math.PI, Math.PI / 2, -Math.PI / 2, 0];

// Uma pessoa da plateia, em sombra (x, y: os pés).
function desenharPlateia(g, x, y, t) {
  if (!sp(g, 'plateia', 'pulando', x, y, { t })) corpoDaPlateia(g, x, y);
}
function corpoDaPlateia(g, x, y) {
  el(g, x, y - 16, 12, 16, 'rgba(0,0,0,0.55)');
  el(g, x - 4, y - 38, 3, 9, 'rgba(0,0,0,0.55)');
  el(g, x + 4, y - 38, 3, 9, 'rgba(0,0,0,0.55)');
}
// A seta-alvo de cima de cada faixa (apertada fica branca e acesa).
function desenharAlvo(g, faixa, x, y, apertada) {
  if (!sp(g, 'alvo', apertada ? 'apertado' : 'normal', x, y, { rot: GIRO_SETA[faixa], cor: apertada ? '#ffffff' : CORES_SETA[faixa] })) {
    texto(g, SETAS[faixa], x, y, apertada ? '#ffffff' : CORES_SETA[faixa], '700 40px sans-serif');
  }
}
// A seta que vem subindo pela faixa.
function desenharNota(g, faixa, x, y) {
  if (!sp(g, 'seta', 'subindo', x, y, { rot: GIRO_SETA[faixa], cor: CORES_SETA[faixa] })) texto(g, SETAS[faixa], x, y, CORES_SETA[faixa], '700 38px sans-serif');
}

function criarCoreografia(nivel, semente) {
  const n = NIVEIS[nivel];
  const rnd = sorte(semente);
  const notas = [];
  for (let b = 4; b < BATIDAS; b++) {
    const vale = nivel === 'facil' ? b % 2 === 0 : true;
    if (vale) {
      const faixa = Math.floor(rnd() * 4);
      notas.push({ t: b * BATIDA, faixa });
      if (n.duplas && rnd() < n.duplas) notas.push({ t: b * BATIDA, faixa: (faixa + 1 + Math.floor(rnd() * 3)) % 4 });
    }
    if (n.meio && rnd() < n.meio) notas.push({ t: (b + 0.5) * BATIDA, faixa: Math.floor(rnd() * 4) });
  }
  return notas.map((x, i) => ({ ...x, i, julgada: null }));
}

export function abrirDanca({ visual, aoTerminar }) {
  const L = 600;
  const A = 420;
  const ALVO = 70;
  const FAIXAS = [210, 270, 330, 390];
  return abrirMinijogo({
    titulo: 'Dança da Toca', largura: L, altura: A, jogo: 'danca', aoTerminar,
    montar(api) {
      let e;
      let audio = null;
      let inicioAudio = 0;
      let inicioRelogio = 0;
      let agendadoAte = 0;
      const apertadas = new Set();

      const relogio = () => (audio ? audio.currentTime - inicioAudio : performance.now() / 1000 - inicioRelogio);

      function tocar(freq, quando, dur, tipo = 'square', vol = 0.05) {
        const o = audio.createOscillator();
        const v = audio.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(freq, quando);
        v.gain.setValueAtTime(vol, quando);
        v.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
        o.connect(v).connect(audio.destination);
        o.start(quando);
        o.stop(quando + dur + 0.05);
      }
      function bumbo(quando) {
        const o = audio.createOscillator();
        const v = audio.createGain();
        o.frequency.setValueAtTime(140, quando);
        o.frequency.exponentialRampToValueAtTime(45, quando + 0.12);
        v.gain.setValueAtTime(0.18, quando);
        v.gain.exponentialRampToValueAtTime(0.0001, quando + 0.18);
        o.connect(v).connect(audio.destination);
        o.start(quando);
        o.stop(quando + 0.2);
      }
      // A música é feita na hora, um pouco adiantada: bumbo, chimbal, baixo e a melodia das setas.
      function agendarMusica() {
        if (!audio || mudo()) return;
        const ate = relogio() + 0.25;
        while (agendadoAte < Math.min(ate, BATIDAS * BATIDA + 1)) {
          const b = Math.round(agendadoAte / (BATIDA / 2));
          const quando = inicioAudio + agendadoAte;
          if (b % 2 === 0) {
            bumbo(quando);
            const batida = b / 2;
            tocar(BAIXO[Math.floor(batida / 4) % 4], quando, BATIDA * 0.9, 'triangle', 0.08);
          }
          tocar(b % 2 ? 6000 : 8000, quando, 0.03, 'square', 0.012);
          agendadoAte += BATIDA / 2;
        }
        for (const n of e.notas) {
          if (n.agendada || n.t > ate) continue;
          n.agendada = true;
          if (n.t >= relogio() - 0.05) tocar(NOTAS_MUSICA[(n.faixa + Math.floor(n.t / (BATIDA * 4))) % NOTAS_MUSICA.length] * 2, inicioAudio + n.t, 0.16, 'square', 0.03);
        }
      }

      function escolherNivel() {
        e = null;
        api.sobre.hidden = false;
        trocar(api.sobre, h('div', { class: 'cobra-caixa' },
          h('h2', null, 'Dança da Toca'),
          h('p', null, 'Aperte a seta certa quando ela chegar na linha de cima. Acertos seguidos fazem combo!'),
          h('p', { class: 'suave' }, 'Setas do teclado (ou W A S D), ou os botões embaixo.'),
          h('div', { class: 'minijogo-botoes' }, Object.entries(NIVEIS).map(([k, n]) => botao(n.nome, { classe: k === 'medio' ? 'btn-ouro' : '', onclick: () => comecar(k) })))));
      }
      function comecar(nivel) {
        e = { nivel, notas: criarCoreografia(nivel, Date.now() & 0xffff), pontos: 0, combo: 0, maior: 0, contagem: { perfeito: 0, otimo: 0, bom: 0, errou: 0 }, aviso: null, situacao: 'jogando', pulo: 0 };
        api.sobre.hidden = true;
        try {
          audio ??= new (window.AudioContext || window.webkitAudioContext)();
          if (audio.state === 'suspended') audio.resume();
          inicioAudio = audio.currentTime + 0.5;
        } catch { audio = null; }
        inicioRelogio = performance.now() / 1000 + 0.5;
        agendadoAte = 0;
        api.tela.focus();
      }
      api.reiniciar = escolherNivel;

      function julgar(faixa) {
        if (!e || e.situacao !== 'jogando') return;
        const agora = relogio();
        const n = e.notas.find(x => !x.julgada && x.faixa === faixa && Math.abs(x.t - agora) < 0.16);
        apertadas.add(faixa);
        setTimeout(() => apertadas.delete(faixa), 110);
        if (!n) return;
        const erro = Math.abs(n.t - agora);
        const tipo = erro < 0.05 ? 'perfeito' : erro < 0.1 ? 'otimo' : 'bom';
        n.julgada = tipo;
        e.combo++;
        e.maior = Math.max(e.maior, e.combo);
        e.contagem[tipo]++;
        const base = { perfeito: 300, otimo: 200, bom: 100 }[tipo];
        e.pontos += Math.round(base * (1 + Math.min(1, Math.floor(e.combo / 10) * 0.1)));
        e.aviso = { texto: { perfeito: 'Perfeito!', otimo: 'Ótimo!', bom: 'Bom' }[tipo], cor: { perfeito: '#ffe46b', otimo: '#7fe08a', bom: '#6be0ff' }[tipo], ate: 0.6 };
        e.pulo = 0.25;
      }
      api.ouvir(document, 'keydown', ev => {
        const f = TECLA_FAIXA[ev.code];
        if (f == null || ev.repeat) return;
        ev.preventDefault();
        julgar(f);
      });
      const botoes = h('div', { class: 'danca-botoes' }, SETAS.map((s, k) => {
        const b = h('button', { type: 'button', class: 'danca-botao', style: { '--cor': CORES_SETA[k] }, 'aria-label': ['Esquerda', 'Baixo', 'Cima', 'Direita'][k] }, s);
        b.addEventListener('pointerdown', ev => { ev.preventDefault(); julgar(k); });
        return b;
      }));
      trocar(api.extra, botoes);
      escolherNivel();

      function atualizar() {
        agendarMusica();
        const agora = relogio();
        for (const n of e.notas) {
          if (!n.julgada && agora - n.t > 0.16) {
            n.julgada = 'errou';
            e.contagem.errou++;
            e.combo = 0;
            e.aviso = { texto: 'Errou', cor: '#ff8a8a', ate: 0.5 };
          }
        }
        if (agora > BATIDAS * BATIDA + 1.2 && e.situacao === 'jogando') {
          e.situacao = 'fim';
          const c = e.contagem;
          api.terminar(e.pontos, [`${num(e.pontos)} pontos (${NIVEIS[e.nivel].nome})`, `Perfeitos: ${c.perfeito} · Ótimos: ${c.otimo} · Bons: ${c.bom} · Errou: ${c.errou}`, `Maior combo: ${e.maior}`]);
        }
      }

      let ultimoT = 0;
      function desenhar(t) {
        const g = api.g;
        const dt = ultimoT ? t - ultimoT : 0;
        ultimoT = t;
        const agora = e ? relogio() : t;
        const batida = agora / BATIDA;
        // Pista e luzes
        g.fillStyle = '#120a22';
        g.fillRect(0, 0, L, A);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) {
          const hue = (agora * 30 + (i + j) * 36) % 360;
          const aceso = Math.sin(batida * Math.PI + i + j) > 0.4;
          g.fillStyle = `hsla(${hue}, 70%, ${aceso ? 45 : 18}%, 0.55)`;
          g.fillRect(j * 60 + 1, 300 + i * 22 + 1, 58, 20);
        }
        for (let k = 0; k < 5; k++) {
          const a = t * 0.7 + k * 1.3;
          g.fillStyle = `hsla(${(k * 70 + t * 40) % 360}, 90%, 60%, 0.07)`;
          g.beginPath(); g.moveTo(300, 0); g.lineTo(300 + Math.cos(a) * 500, 420); g.lineTo(300 + Math.cos(a + 0.15) * 500, 420); g.closePath(); g.fill();
        }
        // O meu coelho dançando e a plateia
        for (let k = 0; k < 6; k++) {
          const x = 40 + k * 20 + (k > 2 ? 400 : 0);
          desenharPlateia(g, x, 420 - Math.abs(Math.sin(batida * Math.PI + k)) * 6, t + k * 0.3);
        }
        g.save();
        g.translate(100, 300 - (e?.pulo || 0) * 40);
        g.scale(2, 2);
        desenharCoelho(g, 0, 0, { pelo: visual.cor, roupa: visual.roupa, pose: 'dancando', t: (agora * Math.PI) / (BATIDA * 7) });
        g.restore();
        if (e) e.pulo = Math.max(0, e.pulo - dt);
        // As faixas e as setas-alvo
        for (let k = 0; k < 4; k++) {
          ret(g, FAIXAS[k] - 26, 0, 52, A, 'rgba(255,255,255,0.04)');
          const ap = apertadas.has(k);
          g.save();
          g.globalAlpha = ap ? 1 : 0.55;
          desenharAlvo(g, k, FAIXAS[k], ALVO, ap);
          g.restore();
        }
        if (!e) return;
        const vel = NIVEIS[e.nivel].vel;
        for (const n of e.notas) {
          if (n.julgada && n.julgada !== 'errou') continue;
          const y = ALVO + (n.t - agora) * vel;
          if (y < -40 || y > A + 40) continue;
          g.save();
          g.globalAlpha = n.julgada === 'errou' ? 0.25 : 1;
          el(g, FAIXAS[n.faixa], y, 24, 24, 'rgba(0,0,0,0.35)');
          desenharNota(g, n.faixa, FAIXAS[n.faixa], y);
          g.restore();
        }
        texto(g, num(e.pontos), L - 20, 24, '#ffe46b', '700 20px "Cinzel", Georgia, serif', 'right');
        if (e.combo >= 5) texto(g, `Combo ${e.combo}`, L - 20, 52, '#ff7ad9', '700 16px "Cinzel", Georgia, serif', 'right');
        if (e.aviso && e.aviso.ate > 0) {
          e.aviso.ate -= dt;
          texto(g, e.aviso.texto, 300, 150, e.aviso.cor, '700 28px "Cinzel", Georgia, serif');
        }
        const fim = BATIDAS * BATIDA;
        ret(g, 20, A - 12, 160, 6, 'rgba(255,255,255,0.15)', 3);
        ret(g, 20, A - 12, 160 * Math.max(0, Math.min(1, agora / fim)), 6, '#ffe46b', 3);
      }

      return {
        passo(dt, t) {
          if (e?.situacao === 'jogando') atualizar();
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Sprites (veja sprites.js) ───────────────────── */
// Cada prévia é o desenho de sempre, sem sprite, com a âncora da peça em (0, 0).
const mini = (chave, nome, desc, largura, altura, ancora, animacoes, previa, extra = {}) => ({
  chave: `clube-mini.${chave}`, jogo: 'Club Coelho: minijogos', nome, desc, largura, altura, ancora, animacoes, previa, ...extra,
});
const NOME_PEIXE = { peixe: 'Peixe', grande: 'Peixe grande', dourado: 'Peixe dourado', bota: 'Bota velha', aguaviva: 'Água-viva' };
const DESC_PEIXE = {
  peixe: 'O peixe comum da Pescaria (vale 1).', grande: 'O peixe grande e lento da Pescaria (vale 2).', dourado: 'O peixe dourado e rápido da Pescaria (vale 3).',
  bota: 'A bota velha que às vezes vem no anzol (não vale nada).', aguaviva: 'A água-viva que solta o peixe ou come a isca.',
};
// Caixa de cada um, centrada no ponto do peixe (o rabo fica para trás).
const CAIXA_PEIXE = { peixe: [40, 20], grande: [60, 28], dourado: [36, 18], bota: [28, 24], aguaviva: [28, 52] };

export const SPRITES = [
  ...Object.keys(PEIXES).map(tipo => mini(PECA_PEIXE[tipo], NOME_PEIXE[tipo],
    `${DESC_PEIXE[tipo]} Olhando para a direita: o jogo vira quando nada para a esquerda.`,
    ...CAIXA_PEIXE[tipo], 'centro',
    tipo === 'bota' ? [{ id: 'boiando', nome: 'Boiando', quadros: 1, fps: 1 }] : [{ id: 'nadando', nome: 'Nadando', quadros: 4, fps: 6 }],
    (g, anim, t) => corpoDoPeixe(g, tipo, t, 0))),
  mini('siri', 'Siri', 'O siri que anda no fundo do lago e corta a linha. O jogo vira para o lado em que ele anda.',
    52, 24, 'pe', [{ id: 'andando', nome: 'Andando', quadros: 1, fps: 6 }], g => corpoDoSiri(g, 0, 0)),
  mini('anzol', 'Anzol', 'O anzol na ponta da linha, com a minhoca (isca) ou já sem ela, quando tem um peixe fisgado.',
    14, 12, 'centro', [{ id: 'com-isca', nome: 'Com a isca', quadros: 1, fps: 1 }, { id: 'sem-isca', nome: 'Sem a isca', quadros: 1, fps: 1 }],
    (g, anim) => corpoDoAnzol(g, 4, -3, anim !== 'sem-isca')),
  mini('trapiche', 'Trapiche da Pescaria', 'O cais de madeira lá em cima, de onde o coelho pesca.',
    260, 52, 'pe', [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }], g => { g.save(); g.translate(-130, 0); corpoDoTrapichePesca(g, -22); g.restore(); }),
  mini('alga', 'Alga', 'As algas que balançam no fundo do lago (a âncora é a raiz).',
    30, 92, 'pe', [{ id: 'balancando', nome: 'Balançando', quadros: 4, fps: 4 }], (g, anim, t) => corpoDaAlga(g, 0, 0, t, 2)),
  mini('seta', 'Seta da Dança', 'As setas que sobem pelas faixas da Dança da Toca. Desenhe apontando para a direita: o jogo gira para cada faixa. Marque "pintar com a cor" e desenhe em tons claros para cada faixa ter a sua cor.',
    44, 44, 'centro', [{ id: 'subindo', nome: 'Subindo', quadros: 1, fps: 1 }], g => texto(g, '→', 0, 0, CORES_SETA[3], '700 38px sans-serif'), { tingir: true }),
  mini('alvo', 'Seta-alvo da Dança', 'As setas paradas lá em cima, onde é a hora de apertar (ficam meio apagadas e acendem quando apertadas). Apontando para a direita; com "pintar com a cor", cada faixa tem a sua cor e a apertada fica branca.',
    44, 44, 'centro', [{ id: 'normal', nome: 'Esperando', quadros: 1, fps: 1 }, { id: 'apertado', nome: 'Apertada', quadros: 1, fps: 1 }],
    (g, anim) => texto(g, '→', 0, 0, anim === 'apertado' ? '#ffffff' : CORES_SETA[3], '700 40px sans-serif'), { tingir: true }),
  mini('plateia', 'Plateia', 'As sombras da plateia que pulam no ritmo da Dança da Toca (o pulo o jogo faz).',
    24, 48, 'pe', [{ id: 'pulando', nome: 'Na plateia', quadros: 1, fps: 4 }], g => corpoDaPlateia(g, 0, 0)),
];
registrarPecas(SPRITES);

// Para os testes: os desenhos que não dependem da janela do minijogo.
export const _desenhos = { desenharPeixe, desenharSiri, desenharTrapichePesca, desenharAlga, desenharAnzol, desenharPlateia, desenharAlvo, desenharNota };
