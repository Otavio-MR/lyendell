// Os minijogos e as janelas da região "centro" da Ilha do Club Coelho (veja centro.js, que carrega este
// arquivo só na hora): a Mancala das Cenouras (Sala de Leitura), a Fábrica de Pizzas de Cenoura (Pizzaria),
// o Lança-Pompom (Parque dos Pompons), o Livro do Capitão Saltarrocha, os livros da história da ilha, os
// roteiros do Teatro e o piano da Pizzaria. Os minijogos são contra o computador (ou sozinho), e no fim
// as cenouras vão por ctx.terminarMinijogo (veja clube-ilha.js).

import { h, trocar, botao, modal, aviso } from '../core.js';
import { som } from '../arcade.js';
import { sorte } from '../desenho-coelho.js';
import { pompom, CORES_POMPOM, cenarioAtual, CENARIOS } from './centro.js';

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
function texto(g, t, x, y, cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center') {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillText(t, x + 1.5, y + 1.5);
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
function gradV(g, y0, y1, paradas) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
// Uma cenourinha deitada (x, y: o meio).
function cenourinha(g, x, y, k = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.fillStyle = '#f08a2a';
  g.beginPath(); g.moveTo(-7, -3); g.quadraticCurveTo(-9, 0, -7, 3); g.lineTo(8, 0.6); g.lineTo(8, -0.6); g.closePath(); g.fill();
  el(g, -9, -2, 2.4, 1.3, '#4f9a3c', -0.6);
  el(g, -9, 2, 2.4, 1.3, '#4f9a3c', 0.6);
  g.fillStyle = 'rgba(120,50,10,0.35)';
  g.fillRect(-3, -2, 0.8, 4); g.fillRect(2, -1.4, 0.8, 2.8);
  g.restore();
}

// A moldura comum: janela, canvas que acompanha o tamanho, laço de 60 quadros e a tela de fim (com as cenouras).
function abrirJanela(ctx, { titulo, largura, altura, jogo, montar }) {
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
    ouvir(alvo, tipo, f, o) { alvo.addEventListener(tipo, f, o); limpezas.push(() => alvo.removeEventListener(tipo, f, o)); },
    mostrar(...conteudo) { trocar(sobre, h('div', { class: 'cobra-caixa' }, ...conteudo)); sobre.hidden = false; },
    esconder() { sobre.hidden = true; tela.focus({ preventScroll: true }); },
    async terminar(pontos, linhas) {
      api.mostrar(h('h2', null, 'Fim!'), linhas.map(l => h('p', null, l)), h('p', { class: 'suave' }, 'Guardando as cenouras...'));
      let r = null;
      try { r = await ctx.terminarMinijogo(jogo, pontos); } catch (e) { aviso(e.message, 'erro'); }
      if (parado) return;
      api.mostrar(
        h('h2', null, 'Fim!'),
        linhas.map(l => h('p', null, l)),
        r && h('p', { class: 'arcade-cenouras' }, r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje. Volte amanhã!' : 'Nenhuma cenoura desta vez.'),
        h('div', { class: 'minijogo-botoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => api.reiniciar() }),
          botao('Sair', { onclick: () => m.fechar() })));
    },
    reiniciar: () => {},
  };
  const atual = montar(api);
  function laco(agora) {
    if (parado) return;
    quadro = requestAnimationFrame(laco);
    const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    ajustar();
    try { atual.passo(dt, agora / 1000); } catch (e) { console.error(titulo, e); }
  }
  quadro = requestAnimationFrame(laco);
  setTimeout(() => tela.focus({ preventScroll: true }), 50);
  return m;
}

/* ─── Mancala das Cenouras ────────────────────────── */
// Tabuleiro (Kalah): casas 0 a 5 são as suas (embaixo, da esquerda para a direita), 6 é o seu celeiro (à
// direita), 7 a 12 são as do computador (em cima, da direita para a esquerda) e 13 é o celeiro dele.

export function semear(tab, i, quem) {
  const t = tab.slice();
  let n = t[i];
  t[i] = 0;
  let k = i;
  const pula = quem === 0 ? 13 : 6;
  const passos = [];
  while (n > 0) {
    k = (k + 1) % 14;
    if (k === pula) continue;
    t[k]++;
    passos.push(k);
    n--;
  }
  const celeiro = quem === 0 ? 6 : 13;
  const meuLado = quem === 0 ? k <= 5 : k >= 7 && k <= 12;
  let captura = 0;
  if (meuLado && t[k] === 1 && t[12 - k] > 0) {
    captura = t[12 - k] + 1;
    t[celeiro] += captura;
    t[k] = 0;
    t[12 - k] = 0;
  }
  const fim = fimDeJogo(t);
  if (fim) recolher(t);
  return { t, passos, extra: k === celeiro && !fim, captura, fim };
}
const soma = (t, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += t[i]; return s; };
export const fimDeJogo = t => soma(t, 0, 5) === 0 || soma(t, 7, 12) === 0;
function recolher(t) {
  t[6] += soma(t, 0, 5);
  t[13] += soma(t, 7, 12);
  for (let i = 0; i < 14; i++) if (i !== 6 && i !== 13) t[i] = 0;
}
export const jogadasDe = (t, quem) => (quem === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]).filter(i => t[i] > 0);

// O computador pensa algumas jogadas para a frente (minimax com poda); no fácil, às vezes joga qualquer uma.
function avaliar(t, quem, prof, alfa, beta) {
  if (prof === 0 || fimDeJogo(t)) return t[13] - t[6];
  const lista = jogadasDe(t, quem);
  if (quem === 1) {
    let melhor = -Infinity;
    for (const i of lista) {
      const r = semear(t, i, 1);
      const v = avaliar(r.t, r.extra ? 1 : 0, prof - 1, alfa, beta);
      melhor = Math.max(melhor, v);
      alfa = Math.max(alfa, v);
      if (alfa >= beta) break;
    }
    return melhor;
  }
  let pior = Infinity;
  for (const i of lista) {
    const r = semear(t, i, 0);
    const v = avaliar(r.t, r.extra ? 0 : 1, prof - 1, alfa, beta);
    pior = Math.min(pior, v);
    beta = Math.min(beta, v);
    if (alfa >= beta) break;
  }
  return pior;
}
export function jogadaDoComputador(t, nivel = 'medio', rnd = Math.random) {
  const lista = jogadasDe(t, 1);
  if (!lista.length) return null;
  if (nivel === 'facil' && rnd() < 0.45) return lista[Math.floor(rnd() * lista.length)];
  const prof = nivel === 'facil' ? 1 : nivel === 'medio' ? 3 : 6;
  let melhor = null;
  let valor = -Infinity;
  for (const i of lista) {
    const r = semear(t, i, 1);
    const v = avaliar(r.t, r.extra ? 1 : 0, prof - 1, -Infinity, Infinity) + rnd() * 0.5;
    if (v > valor) { valor = v; melhor = i; }
  }
  return melhor;
}

export function abrirMancala(ctx) {
  const L = 640;
  const A = 340;
  // Onde fica cada casa na tela.
  const posicao = i => {
    if (i === 6) return { x: 580, y: 170, rx: 34, ry: 86 };
    if (i === 13) return { x: 60, y: 170, rx: 34, ry: 86 };
    if (i <= 5) return { x: 140 + i * 72, y: 228, rx: 30, ry: 36 };
    return { x: 140 + (12 - i) * 72, y: 112, rx: 30, ry: 36 };
  };
  const NIVEIS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  return abrirJanela(ctx, {
    titulo: 'Mancala das Cenouras', largura: L, altura: A, jogo: 'mancala',
    montar(api) {
      let e = null;
      let sobreCasa = -1;
      function escolher() {
        e = null;
        api.mostrar(
          h('h2', null, 'Mancala das Cenouras'),
          h('p', null, 'Escolha uma das suas casinhas (embaixo): as cenouras dela são plantadas uma em cada casa, para a direita e subindo pelo lado do computador.'),
          h('p', { class: 'suave' }, 'Caiu no seu celeiro (à direita)? Joga de novo. Caiu numa casinha sua vazia? Leva as cenouras da casa da frente. Ganha quem guardar mais cenouras.'),
          h('div', { class: 'minijogo-botoes' }, Object.entries(NIVEIS).map(([k, n]) => botao(n, { classe: k === 'medio' ? 'btn-ouro' : '', onclick: () => comecar(k) }))));
      }
      function comecar(nivel) {
        const t = Array(14).fill(4);
        t[6] = 0; t[13] = 0;
        e = { nivel, t, vez: 0, anim: null, recado: 'Sua vez!', pensar: 0, fim: false };
        api.esconder();
      }
      api.reiniciar = escolher;
      escolher();

      function jogar(i, quem) {
        if (!e || e.anim || e.fim || e.vez !== quem || !jogadasDe(e.t, quem).includes(i)) return false;
        const r = semear(e.t, i, quem);
        const mostra = e.t.slice();
        mostra[i] = 0;
        e.anim = { r, mostra, de: i, quem, passo: 0, relogio: 0 };
        som('passo');
        return true;
      }
      function terminouAnimacao() {
        const { r, quem } = e.anim;
        e.t = r.t;
        e.anim = null;
        if (r.captura) { e.recado = quem === 0 ? `Captura! +${r.captura} cenouras` : `O computador capturou ${r.captura}!`; som('moeda'); }
        if (r.fim) {
          e.fim = true;
          const [eu, pc] = [e.t[6], e.t[13]];
          som('fim');
          api.terminar(eu, [`Você: ${eu} · Computador: ${pc}`, eu > pc ? 'Você venceu!' : eu === pc ? 'Empate!' : 'O computador venceu desta vez.', `Nível: ${NIVEIS[e.nivel]}`]);
          return;
        }
        e.vez = r.extra ? quem : 1 - quem;
        if (!r.captura) e.recado = e.vez === 0 ? (r.extra ? 'Caiu no celeiro: jogue de novo!' : 'Sua vez!') : 'O computador está pensando...';
        if (e.vez === 1) e.pensar = 0.8;
      }
      function casaEm(x, y) {
        for (let i = 0; i <= 5; i++) { const p = posicao(i); if (((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1.2) return i; }
        return -1;
      }
      api.ouvir(api.tela, 'pointerdown', ev => { const p = api.ponto(ev); const i = casaEm(p.x, p.y); if (i >= 0) jogar(i, 0); });
      api.ouvir(api.tela, 'pointermove', ev => { const p = api.ponto(ev); sobreCasa = casaEm(p.x, p.y); api.tela.style.cursor = sobreCasa >= 0 ? 'pointer' : 'default'; });
      api.ouvir(document, 'keydown', ev => { const n = Number(ev.key); if (n >= 1 && n <= 6) { ev.preventDefault(); jogar(n - 1, 0); } });

      function desenharCasa(g, i, n, t) {
        const p = posicao(i);
        const celeiro = i === 6 || i === 13;
        el(g, p.x, p.y + 3, p.rx, p.ry, 'rgba(60,30,10,0.5)');
        el(g, p.x, p.y, p.rx, p.ry, '#6b3f1f');
        el(g, p.x, p.y + 4, p.rx * 0.86, p.ry * 0.82, '#53301a');
        const pode = e && !e.anim && !e.fim && e.vez === 0 && i <= 5 && n > 0;
        if (pode && (sobreCasa === i || Math.sin(t * 4) > 0.6)) { g.strokeStyle = sobreCasa === i ? '#ffe46b' : 'rgba(255,228,107,0.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y, p.rx + 3, p.ry + 3, 0, 0, Math.PI * 2); g.stroke(); }
        const rnd = sorte(i * 31 + 7);
        for (let k = 0; k < Math.min(n, 24); k++) {
          const a = k * 2.4;
          const raio = Math.sqrt(k + 0.5) / Math.sqrt(Math.max(n, 8)) * 0.78;
          cenourinha(g, p.x + Math.cos(a) * p.rx * raio, p.y + Math.sin(a) * p.ry * raio, celeiro ? 0.9 : 0.85, rnd() * 6);
        }
        const ly = i <= 5 ? p.y + p.ry + 16 : i >= 7 && i <= 12 ? p.y - p.ry - 14 : p.y + p.ry + 16;
        texto(g, String(n), p.x, ly, celeiro ? '#ffe46b' : '#fbf3e0', `700 ${celeiro ? 18 : 15}px "Cinzel", Georgia, serif`);
      }
      return {
        passo(dt, t) {
          const g = api.g;
          if (e?.anim) {
            e.anim.relogio += dt;
            while (e.anim && e.anim.relogio > 0.17) {
              e.anim.relogio -= 0.17;
              const k = e.anim.r.passos[e.anim.passo];
              if (k === undefined) { terminouAnimacao(); break; }
              e.anim.mostra[k]++;
              e.anim.passo++;
              som('passo');
            }
          } else if (e && !e.fim && e.vez === 1) {
            e.pensar -= dt;
            if (e.pensar <= 0) { const i = jogadaDoComputador(e.t, e.nivel); if (i != null) jogar(i, 1); }
          }
          g.fillStyle = gradV(g, 0, A, [[0, '#2a190c'], [1, '#4a2e18']]);
          g.fillRect(0, 0, L, A);
          ret(g, 14, 50, L - 28, 240, '#8a5a32', 60);
          ret(g, 22, 58, L - 44, 224, '#a8774a', 54);
          for (let k = 0; k < 9; k++) { g.strokeStyle = 'rgba(90,55,25,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 70 + k * 25); g.bezierCurveTo(200, 60 + k * 25, 400, 84 + k * 25, 600, 70 + k * 25); g.stroke(); }
          const mostra = e?.anim ? e.anim.mostra : e?.t || [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
          for (let i = 0; i < 14; i++) desenharCasa(g, i, mostra[i], t);
          texto(g, 'Computador', 320, 22, '#d8c8a8', '700 15px "Cinzel", Georgia, serif');
          texto(g, 'Você', 320, 318, '#ffe46b', '700 15px "Cinzel", Georgia, serif');
          if (e) texto(g, e.recado, 320, 170, '#fff4c2', '700 15px "Cinzel", Georgia, serif');
          if (e && !e.anim && e.vez === 1 && !e.fim) for (let k = 0; k < 3; k++) el(g, 300 + k * 20, 196, 3, 3, Math.floor(t * 4) % 3 === k ? '#ffe46b' : '#6b4a2b');
        },
      };
    },
  });
}

/* ─── Fábrica de Pizzas de Cenoura ────────────────── */

export const INGREDIENTES = [
  { id: 'tomate', nome: 'Molho de tomate', tipo: 'molho', cor: '#d8402a', tecla: '1' },
  { id: 'molho-cenoura', nome: 'Molho de cenoura', tipo: 'molho', cor: '#f08a2a', tecla: '2' },
  { id: 'queijo', nome: 'Queijo', tipo: 'queijo', cor: '#f4d35e', tecla: '3' },
  { id: 'cenoura', nome: 'Cenoura', tipo: 'cobertura', cor: '#f39a4a', tecla: '4' },
  { id: 'cogumelo', nome: 'Cogumelo', tipo: 'cobertura', cor: '#d8c8a8', tecla: '5' },
  { id: 'trevo', nome: 'Trevo', tipo: 'cobertura', cor: '#5cb85c', tecla: '6' },
  { id: 'pimentao', nome: 'Pimentão', tipo: 'cobertura', cor: '#c0392b', tecla: '7' },
];
const COBERTURAS = INGREDIENTES.filter(i => i.tipo === 'cobertura');

// O pedido de cada pizza: o molho e quantas de cada cobertura (fica mais difícil a cada pizza certa).
export function novoPedido(feitas, rnd = Math.random) {
  const molho = rnd() < 0.5 ? 'tomate' : 'molho-cenoura';
  const tipos = Math.min(3, 1 + Math.floor(feitas / 4) + (rnd() < 0.4 ? 1 : 0));
  const escolhidas = [...COBERTURAS].sort(() => rnd() - 0.5).slice(0, tipos);
  const maximo = Math.min(5, 2 + Math.floor(feitas / 3));
  const cobertura = {};
  for (const c of escolhidas) cobertura[c.id] = 1 + Math.floor(rnd() * maximo);
  return { molho, cobertura };
}
// Pôr um ingrediente na pizza: devolve 'ok', 'pronta' ou o motivo do erro.
export function porNaPizza(p, id) {
  const ing = INGREDIENTES.find(i => i.id === id);
  if (!ing) return 'erro';
  if (ing.tipo === 'molho') {
    if (p.molho) return 'Já tinha molho!';
    if (id !== p.pedido.molho) return 'Molho errado!';
    p.molho = id;
  } else if (ing.tipo === 'queijo') {
    if (!p.molho) return 'Primeiro o molho!';
    if (p.queijo) return 'Queijo demais!';
    p.queijo = true;
  } else {
    if (!p.molho || !p.queijo) return 'Primeiro molho e queijo!';
    const quer = p.pedido.cobertura[id] || 0;
    const tem = p.cobertura.filter(c => c.id === id).length;
    if (tem >= quer) return quer ? `${ing.nome} demais!` : `Não pediram ${ing.nome.toLowerCase()}!`;
    p.cobertura.push({ id, x: (Math.random() - 0.5) * 70, y: (Math.random() - 0.5) * 34, rot: Math.random() * 6 });
  }
  const completa = p.molho && p.queijo && Object.entries(p.pedido.cobertura).every(([k, n]) => p.cobertura.filter(c => c.id === k).length === n);
  return completa ? 'pronta' : 'ok';
}
function desenharCobertura(g, id, x, y, rot, k = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  if (id === 'cenoura') { el(g, 0, 0, 7, 5, '#f39a4a'); el(g, 0, 0, 4, 2.8, '#f8b870'); el(g, 0, 0, 1.4, 1, '#e07a2a'); }
  else if (id === 'cogumelo') { el(g, 0, -2, 8, 5, '#d8c8a8'); ret(g, -2.5, -1, 5, 7, '#efe6d4', 1); el(g, -3, -3, 1.4, 1, '#a89878'); }
  else if (id === 'trevo') { for (let a = 0; a < 3; a++) el(g, Math.cos(a * 2.1) * 3.5, Math.sin(a * 2.1) * 3.5, 3.6, 3.6, '#5cb85c'); el(g, 0, 0, 1.4, 1.4, '#3a8a3c'); }
  else { g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 5.5, 0.3, Math.PI * 1.8); g.stroke(); }
  g.restore();
}
function desenharPizza(g, p, x, y, t) {
  el(g, x, y + 6, 66, 18, 'rgba(0,0,0,0.25)');
  el(g, x, y, 64, 28, '#e0b070');
  el(g, x, y - 2, 58, 24, '#f0cc8a');
  if (p.molho) el(g, x, y - 2, 52, 21, p.molho === 'tomate' ? '#d8402a' : '#f08a2a');
  if (p.queijo) {
    el(g, x, y - 3, 47, 18, '#f4d35e');
    for (let k = 0; k < 7; k++) el(g, x - 36 + k * 12, y - 3 + Math.sin(k * 2.3) * 8, 6, 3, '#f8e08a');
  }
  for (const c of p.cobertura) desenharCobertura(g, c.id, x + c.x * 0.8, y - 3 + c.y * 0.6, c.rot);
  if (p.estado === 'errada') { g.strokeStyle = '#ff5a5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 30, y - 18); g.lineTo(x + 30, y + 12); g.moveTo(x + 30, y - 18); g.lineTo(x - 30, y + 12); g.stroke(); }
  if (p.estado === 'pronta') for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.6; el(g, x + Math.cos(a) * 70, y - 10 + Math.sin(a) * 26, 2.5, 2.5, '#fff4c2'); }
}

export function abrirPizzaria(ctx) {
  const L = 640;
  const A = 420;
  const ESTEIRA = 214;
  const POTES = INGREDIENTES.map((ing, k) => ({ ...ing, x: 52 + k * 89, y: 350 }));
  return abrirJanela(ctx, {
    titulo: 'Fábrica de Pizzas de Cenoura', largura: L, altura: A, jogo: 'pizzaria',
    montar(api) {
      let e = null;
      let aperto = { id: null, ate: 0 };
      function apresentar() {
        e = null;
        api.mostrar(
          h('h2', null, 'Fábrica de Pizzas de Cenoura'),
          h('p', null, 'As pizzas passam na esteira. Monte cada uma igual ao pedido: primeiro o molho certo, depois o queijo e então as coberturas, na quantidade certa.'),
          h('p', { class: 'suave' }, 'Toque nos potes embaixo (ou aperte de 1 a 7). Ingrediente errado estraga a pizza; 5 pizzas estragadas e acabou. A esteira acelera a cada pizza certa!'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar }));
      }
      function comecar() {
        e = { tempo: 80, erros: 0, feitas: 0, vel: 70, pizza: null, popups: [], fim: false, saindo: [] };
        novaPizza();
        api.esconder();
      }
      function novaPizza() {
        e.pizza = { x: -70, pedido: novoPedido(e.feitas), molho: null, queijo: false, cobertura: [], estado: 'montando' };
      }
      api.reiniciar = apresentar;
      apresentar();

      function usar(id) {
        if (!e || e.fim || !e.pizza) return;
        aperto = { id, ate: performance.now() + 140 };
        const p = e.pizza;
        if (p.x < 40) return;
        const r = porNaPizza(p, id);
        if (r === 'ok') { som('passo'); return; }
        if (r === 'pronta') {
          p.estado = 'pronta';
          e.feitas++;
          e.vel = Math.min(220, 70 + e.feitas * 8);
          e.popups.push({ x: p.x, y: ESTEIRA - 60, texto: 'Perfeita!', cor: '#7fe08a', ate: 1 });
          som('moeda');
        } else {
          p.estado = 'errada';
          e.erros++;
          e.popups.push({ x: p.x, y: ESTEIRA - 60, texto: r, cor: '#ff9a9a', ate: 1.2 });
          som('bater');
        }
        e.saindo.push(p);
        novaPizza();
        if (e.erros >= 5) acabar();
      }
      function acabar() {
        if (e.fim) return;
        e.fim = true;
        som('fim');
        api.terminar(e.feitas, [`${e.feitas} ${e.feitas === 1 ? 'pizza certinha' : 'pizzas certinhas'}`, `${e.erros} ${e.erros === 1 ? 'pizza estragada' : 'pizzas estragadas'}`]);
      }
      api.ouvir(document, 'keydown', ev => {
        const ing = INGREDIENTES.find(i => i.tecla === ev.key);
        if (ing) { ev.preventDefault(); usar(ing.id); }
      });
      api.ouvir(api.tela, 'pointerdown', ev => {
        const p = api.ponto(ev);
        const pote = POTES.find(q => Math.abs(p.x - q.x) < 42 && Math.abs(p.y - q.y) < 46);
        if (pote) usar(pote.id);
      });

      function desenharPote(g, q, t) {
        const apertado = aperto.id === q.id && performance.now() < aperto.ate;
        const y = q.y + (apertado ? 4 : 0);
        ret(g, q.x - 38, y - 40, 76, 84, apertado ? '#5b4a6a' : '#3a2f48', 10);
        ret(g, q.x - 32, y - 34, 64, 46, '#241c30', 8);
        if (q.tipo === 'molho') { el(g, q.x, y - 10, 24, 14, q.cor); el(g, q.x - 6, y - 14, 8, 4, 'rgba(255,255,255,0.3)'); }
        else if (q.tipo === 'queijo') { for (let k = 0; k < 5; k++) ret(g, q.x - 22 + k * 9, y - 22 + (k % 2) * 6, 7, 22, '#f4d35e', 2); }
        else for (let k = 0; k < 4; k++) desenharCobertura(g, q.id, q.x - 12 + (k % 2) * 22, y - 18 + Math.floor(k / 2) * 14, k * 1.3, 1.1);
        texto(g, q.nome.replace('Molho de ', 'Molho '), q.x, y + 24, '#fbf3e0', '700 9.5px "Cinzel", Georgia, serif');
        texto(g, q.tecla, q.x + 28, y - 30, '#ffe46b', '700 11px sans-serif');
      }
      function desenharPedido(g, p) {
        ret(g, 396, 10, 232, 128, '#fbf3e0', 6);
        ret(g, 396, 10, 232, 22, '#c0392b', 6);
        texto(g, 'Pedido', 512, 22, '#fff4c2', '700 13px "Cinzel", Georgia, serif');
        const linhas = [[p.pedido.molho, 1, p.molho ? 1 : 0], ['queijo', 1, p.queijo ? 1 : 0], ...Object.entries(p.pedido.cobertura).map(([k, n]) => [k, n, p.cobertura.filter(c => c.id === k).length])];
        linhas.forEach(([id, n, tem], k) => {
          const ing = INGREDIENTES.find(i => i.id === id);
          const y = 46 + k * 18;
          texto(g, `${ing.nome}${n > 1 ? ` x${n}` : ''}`, 412, y, tem >= n ? '#3a8a3c' : '#3a2a1a', '700 12px "EB Garamond", Georgia, serif', 'left');
          texto(g, tem >= n ? '✔' : `${tem}/${n}`, 612, y, tem >= n ? '#3a8a3c' : '#8a6a44', '700 12px sans-serif', 'right');
        });
      }
      return {
        passo(dt, t) {
          const g = api.g;
          if (e && !e.fim) {
            e.tempo -= dt;
            if (e.tempo <= 0) { e.tempo = 0; acabar(); }
            e.pizza.x += e.vel * dt;
            if (e.pizza.x > L + 60) {
              e.erros++;
              e.popups.push({ x: L - 70, y: ESTEIRA - 60, texto: 'Passou do ponto!', cor: '#ff9a9a', ate: 1.2 });
              som('bater');
              novaPizza();
              if (e.erros >= 5) acabar();
            }
          }
          if (e) {
            for (const p of e.saindo) { p.x += (p.estado === 'pronta' ? 520 : 260) * dt; p.y = (p.y || 0) + (p.estado === 'errada' ? 140 * dt : -60 * dt); }
            e.saindo = e.saindo.filter(p => p.x < L + 100);
            for (const p of e.popups) { p.ate -= dt; p.y -= 30 * dt; }
            e.popups = e.popups.filter(p => p.ate > 0);
          }
          // A cozinha
          g.fillStyle = gradV(g, 0, A, [[0, '#7a3a2a'], [1, '#3a1f18']]);
          g.fillRect(0, 0, L, A);
          for (let y = 0; y < 170; y += 20) for (let x = ((y / 20) % 2) * -20; x < L; x += 40) ret(g, x + 1, y + 1, 38, 18, (x + y) % 3 ? '#8a4434' : '#7e3c2e', 2);
          ret(g, 0, ESTEIRA + 22, L, 46, '#3a3a44');
          ret(g, 0, ESTEIRA + 22, L, 6, '#55555e');
          const des = ((t * (e?.vel || 60)) % 32);
          for (let x = -32; x < L + 32; x += 32) ret(g, x + des, ESTEIRA + 30, 16, 32, '#4a4a54');
          for (let x = 30; x < L; x += 120) { el(g, x, ESTEIRA + 70, 10, 10, '#2a2a30'); el(g, x, ESTEIRA + 70, 4, 4, '#8a8a92'); }
          ret(g, 0, ESTEIRA + 82, L, 6, '#2a2a30');
          for (const p of e?.saindo || []) desenharPizza(g, p, p.x, ESTEIRA + 12 + (p.y || 0), t);
          if (e?.pizza) { desenharPizza(g, e.pizza, e.pizza.x, ESTEIRA + 12, t); desenharPedido(g, e.pizza); }
          for (const q of POTES) desenharPote(g, q, t);
          if (e) {
            texto(g, `${Math.ceil(e.tempo)}s`, 20, 22, '#fff', '700 18px "Cinzel", Georgia, serif', 'left');
            texto(g, `Pizzas: ${e.feitas}`, 20, 48, '#ffe46b', '700 16px "Cinzel", Georgia, serif', 'left');
            for (let k = 0; k < 5; k++) el(g, 30 + k * 18, 76, 6, 6, k < e.erros ? '#d8402a' : 'rgba(255,255,255,0.2)');
            for (const p of e.popups) texto(g, p.texto, p.x, p.y, p.cor, '700 18px "Cinzel", Georgia, serif');
          }
        },
      };
    },
  });
}

/* ─── Lança-Pompom ────────────────────────────────── */

const V_TIRO = 640;
const GRAV = 900;
// O ângulo (para cima, em radianos) que leva de (x0, y0) até (x1, y1) na tela, ou null se não alcança.
export function anguloPara(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const D = y1 - y0;
  const k = (GRAV * dx * dx) / (2 * V_TIRO * V_TIRO);
  const disc = dx * dx - 4 * k * (k - D);
  if (dx <= 0 || disc < 0) return null;
  return Math.atan((dx - Math.sqrt(disc)) / (2 * k));
}
// Onde o pompom está t segundos depois de sair do canhão.
export const voo = (x0, y0, ang, t) => ({ x: x0 + V_TIRO * Math.cos(ang) * t, y: y0 - V_TIRO * Math.sin(ang) * t + 0.5 * GRAV * t * t });

// A fase: os canhões (alguns giram), as cenouras no caminho certo e o ninho no fim.
export function criarFase(semente = 7) {
  const rnd = sorte(semente);
  const canhoes = [];
  let x = 90;
  let y = 300;
  for (let i = 0; i < 12; i++) {
    canhoes.push({ x, y, tipo: i === 0 ? 'fixo' : i < 3 ? (i % 2 ? 'gira' : 'fixo') : rnd() < 0.7 ? 'gira' : 'fixo' });
    x += 200 + rnd() * 70;
    y = Math.max(110, Math.min(320, y + (rnd() - 0.5) * 220));
  }
  const ninho = { x: x + 40, y: 300 };
  const cenouras = [];
  for (let i = 0; i < canhoes.length; i++) {
    const c = canhoes[i];
    const alvo = canhoes[i + 1] || ninho;
    const ang = anguloPara(c.x, c.y, alvo.x, alvo.y);
    c.ang = ang ?? 0.6;
    c.amp = c.tipo === 'gira' ? 0.35 + rnd() * 0.25 : 0;
    c.vel = 1.4 + rnd() * 1.2;
    c.fase = rnd() * 6;
    const tempo = (alvo.x - c.x) / (V_TIRO * Math.cos(c.ang));
    for (const f of [0.3, 0.5, 0.7]) { const p = voo(c.x, c.y, c.ang, tempo * f); cenouras.push({ x: p.x, y: p.y, pega: false }); }
  }
  return { canhoes, ninho, cenouras };
}
export const anguloDoCanhao = (c, t) => c.ang + (c.amp ? Math.sin(t * c.vel + c.fase) * c.amp : 0);

export function abrirLancaPompom(ctx) {
  const L = 640;
  const A = 400;
  const cor = Object.values(CORES_POMPOM)[Math.floor(Math.random() * 8)];
  return abrirJanela(ctx, {
    titulo: 'Lança-Pompom', largura: L, altura: A, jogo: 'lanca_pompom',
    montar(api) {
      let e = null;
      function apresentar() {
        e = null;
        api.mostrar(
          h('h2', null, 'Lança-Pompom'),
          h('p', null, 'Ajude o pompom a chegar ao ninho! Aperte espaço ou toque na tela para disparar o canhão. Os canhões que giram precisam da hora certa.'),
          h('p', { class: 'suave' }, 'Pegue as cenouras no caminho. Caiu na água? Volta para o último canhão (são 3 vidas).'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar }));
      }
      function comecar() {
        const fase = criarFase(1 + Math.floor(Math.random() * 999));
        e = { ...fase, em: 0, voando: null, vidas: 3, pegas: 0, tempo: 120, cam: 0, relogio: 0, fim: false, popups: [], respingo: null };
        api.esconder();
      }
      api.reiniciar = apresentar;
      apresentar();

      function disparar() {
        if (!e || e.fim || e.voando) return;
        const c = e.canhoes[e.em];
        const ang = anguloDoCanhao(c, e.relogio);
        e.voando = { x0: c.x, y0: c.y, ang, t: 0, x: c.x, y: c.y };
        som('pulo');
      }
      api.ouvir(document, 'keydown', ev => { if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'Enter') { ev.preventDefault(); disparar(); } });
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); disparar(); });

      function acabar(chegou) {
        if (e.fim) return;
        e.fim = true;
        const pontos = e.pegas + (chegou ? 15 : 0);
        som(chegou ? 'fase' : 'fim');
        api.terminar(pontos, [chegou ? 'O pompom chegou ao ninho!' : 'O pompom não chegou desta vez.', `${e.pegas} ${e.pegas === 1 ? 'cenoura pega' : 'cenouras pegas'}${chegou ? ' + 15 de chegada' : ''}`]);
      }
      function atualizar(dt) {
        e.relogio += dt;
        e.tempo -= dt;
        if (e.tempo <= 0) { e.tempo = 0; acabar(false); return; }
        const v = e.voando;
        if (v) {
          v.t += dt;
          const p = voo(v.x0, v.y0, v.ang, v.t);
          v.x = p.x; v.y = p.y;
          for (const c of e.cenouras) if (!c.pega && Math.hypot(c.x - v.x, c.y - v.y) < 24) { c.pega = true; e.pegas++; e.popups.push({ x: c.x, y: c.y, texto: '+1', ate: 0.8 }); som('moeda'); }
          if (Math.hypot(e.ninho.x - v.x, e.ninho.y - 20 - v.y) < 52) { e.voando = null; e.em = e.canhoes.length; acabar(true); return; }
          for (let i = e.em + 1; i < e.canhoes.length; i++) {
            const c = e.canhoes[i];
            if (Math.hypot(c.x - v.x, c.y - v.y) < 34) { e.em = i; e.voando = null; som('pisao'); break; }
          }
          if (e.voando && (v.y > A + 20 || v.t > 3.5)) {
            e.respingo = { x: v.x, ate: 0.8 };
            e.voando = null;
            e.vidas--;
            som('agua');
            if (e.vidas <= 0) acabar(false);
          }
        }
        if (e.respingo) { e.respingo.ate -= dt; if (e.respingo.ate <= 0) e.respingo = null; }
        for (const p of e.popups) { p.ate -= dt; p.y -= 40 * dt; }
        e.popups = e.popups.filter(p => p.ate > 0);
        const foco = e.voando ? e.voando.x : (e.canhoes[e.em] || e.ninho).x;
        e.cam += (foco - 200 - e.cam) * Math.min(1, dt * 4);
      }
      function desenharCanhao(g, c, ang, t, comPompom) {
        g.save(); g.translate(c.x, c.y); g.rotate(-ang);
        if (comPompom) { g.save(); g.rotate(Math.PI / 2); pompom(g, 0, 22, 13, cor, t, 0, false); g.restore(); }
        ret(g, -16, -17, 52, 34, c.tipo === 'gira' ? '#6a3a9a' : '#3a6a9a', 12);
        for (let k = 0; k < 3; k++) ret(g, -6 + k * 13, -17, 5, 34, ['#f4dd80', '#7fd07a', '#f28ab8'][k]);
        el(g, 36, 0, 7, 17, '#2a1d42');
        g.restore();
        el(g, c.x, c.y + 4, 16, 16, '#8a5a32');
        el(g, c.x, c.y + 4, 6, 6, '#5b3c22');
        if (c.tipo === 'gira') for (let k = 0; k < 3; k++) { const a = t * 3 + (k * Math.PI * 2) / 3; el(g, c.x + Math.cos(a) * 24, c.y + 4 + Math.sin(a) * 24, 2, 2, 'rgba(255,255,255,0.6)'); }
      }
      return {
        passo(dt, t) {
          const g = api.g;
          if (e && !e.fim) atualizar(dt);
          g.fillStyle = gradV(g, 0, A, [[0, '#7ec8e3'], [0.7, '#d4f1fb'], [1, '#ffe9c4']]);
          g.fillRect(0, 0, L, A);
          const cam = e ? e.cam : 0;
          for (let k = 0; k < 6; k++) { const x = ((k * 190 - cam * 0.2) % 1140 + 1140) % 1140 - 100; el(g, x, 60 + (k % 3) * 30, 40, 14, 'rgba(255,255,255,0.85)'); el(g, x + 30, 54 + (k % 3) * 30, 28, 14, 'rgba(255,255,255,0.85)'); }
          for (let k = 0; k < 8; k++) { const x = ((k * 160 - cam * 0.45) % 1280 + 1280) % 1280 - 160; el(g, x, A - 40, 120, 70, k % 2 ? '#86b866' : '#79ab5c'); }
          g.fillStyle = gradV(g, A - 40, A, [[0, '#4a8bb4'], [1, '#2f6f9a']]);
          g.fillRect(0, A - 40, L, 40);
          for (let k = 0; k < 10; k++) ret(g, ((k * 83 - cam * 0.8 + t * 20) % 700 + 700) % 700 - 40, A - 30 + (k % 3) * 8, 26, 2, 'rgba(255,255,255,0.45)', 1);
          if (!e) { pompom(g, 320, 260 - Math.abs(Math.sin(t * 3)) * 30, 26, cor, t, 0); return; }
          g.save();
          g.translate(-cam, 0);
          for (const c of e.cenouras) if (!c.pega && c.x > cam - 40 && c.x < cam + L + 40) { cenourinha(g, c.x, c.y + Math.sin(t * 3 + c.x) * 2, 2, -0.6); }
          // O ninho
          const n = e.ninho;
          el(g, n.x, n.y + 6, 60, 14, 'rgba(0,0,0,0.2)');
          g.fillStyle = '#a8774a'; g.beginPath(); g.ellipse(n.x, n.y - 8, 56, 26, 0, 0, Math.PI); g.fill();
          for (let k = 0; k < 6; k++) { g.strokeStyle = '#7a5434'; g.lineWidth = 2; g.beginPath(); g.ellipse(n.x, n.y - 8 + k * 3, 54 - k * 4, 6, 0, 0, Math.PI); g.stroke(); }
          ret(g, n.x + 40, n.y - 110, 4, 104, '#6b4a2b');
          g.fillStyle = '#e05a8a'; g.beginPath(); g.moveTo(n.x + 44, n.y - 110); g.lineTo(n.x + 80, n.y - 98 + Math.sin(t * 4) * 3); g.lineTo(n.x + 44, n.y - 86); g.fill();
          for (let k = 0; k < 3; k++) pompom(g, n.x - 30 + k * 30, n.y - 14, 10, Object.values(CORES_POMPOM)[k * 2], t + k, Math.abs(Math.sin(t * 4 + k)) * 6, false);
          e.canhoes.forEach((c, i) => {
            if (c.x < cam - 60 || c.x > cam + L + 60) return;
            desenharCanhao(g, c, anguloDoCanhao(c, e.relogio), t, i === e.em && !e.voando && !e.fim);
          });
          const c = e.canhoes[e.em];
          if (c && !e.voando && !e.fim) {
            const ang = anguloDoCanhao(c, e.relogio);
            for (let k = 1; k <= 5; k++) { const p = voo(c.x, c.y, ang, k * 0.05); el(g, p.x, p.y, 2.5, 2.5, `rgba(255,255,255,${0.9 - k * 0.15})`); }
          }
          if (e.voando) {
            const v = e.voando;
            g.save(); g.translate(v.x, v.y); g.rotate(v.t * 10);
            pompom(g, 0, 13, 13, cor, t, 0, false);
            g.restore();
          }
          if (e.respingo) for (let k = 0; k < 6; k++) { const f = 1 - e.respingo.ate / 0.8; el(g, e.respingo.x + (k - 2.5) * 10 * (1 + f), A - 40 - Math.sin((k / 5) * Math.PI) * 30 * f, 4, 4, 'rgba(255,255,255,0.8)'); }
          for (const p of e.popups) texto(g, p.texto, p.x, p.y, '#ffe46b', '700 16px "Cinzel", Georgia, serif');
          g.restore();
          texto(g, `${Math.ceil(e.tempo)}s`, 20, 22, '#ffffff', '700 18px "Cinzel", Georgia, serif', 'left');
          cenourinha(g, L - 90, 22, 1.8, -0.4);
          texto(g, String(e.pegas), L - 66, 22, '#ffe46b', '700 18px "Cinzel", Georgia, serif', 'left');
          for (let k = 0; k < 3; k++) pompom(g, 30 + k * 24, 56, 8, k < e.vidas ? cor : 'rgba(0,0,0,0.2)', t, 0, false);
          const prog = Math.min(1, e.em / e.canhoes.length);
          ret(g, 200, 14, 240, 8, 'rgba(0,0,0,0.25)', 4);
          ret(g, 200, 14, 240 * prog, 8, '#7fd07a', 4);
        },
      };
    },
  });
}

/* ─── O Livro do Capitão Saltarrocha ──────────────── */

const PAGINAS_CAPITAO = [
  ['Diário de Bordo', 'Este é o diário do Capitão Saltarrocha, o coelho de tapa-olho que navega o Saltador por todos os mares. Quem ler com cuidado vai achar o que eu escondo aqui.'],
  ['A primeira viagem', 'Achei esta ilha numa noite de tempestade, seguindo uma gaivota que levava uma cenoura no bico. Onde tem cenoura, tem coelho feliz. Ancorei o Saltador e fiquei.'],
  ['O mapa e o Raposo', 'O Raposo vive tentando roubar o meu mapa do tesouro. Por isso guardo o mapa no meu Quartel, no Saltador, e a porta do Quartel só abre com a minha chave.'],
  ['O esconderijo', 'Ninguém procura nada numa biblioteca, e o Raposo não gosta de ler. A chave do Quartel fica aqui, dentro deste livro, entre esta página e a próxima.'],
];
function desenharChave(c, t) {
  const g = c.getContext('2d');
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.clearRect(0, 0, 220, 110);
  const gr = g.createRadialGradient(110, 55, 0, 110, 55, 60);
  gr.addColorStop(0, `rgba(255,220,120,${0.45 + Math.sin(t * 3) * 0.1})`);
  gr.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 220, 110);
  g.save(); g.translate(110, 55); g.rotate(-0.25 + Math.sin(t * 1.5) * 0.06);
  g.strokeStyle = '#b8922a'; g.lineWidth = 7;
  g.beginPath(); g.arc(-44, 0, 16, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8c24a';
  g.fillRect(-28, -4, 82, 8);
  g.fillRect(36, 2, 8, 16); g.fillRect(48, 2, 6, 12);
  el(g, -44, 0, 6, 6, '#8a2f3a');
  g.restore();
  for (let k = 0; k < 4; k++) { const a = t * 2 + k * 1.6; el(g, 110 + Math.cos(a) * 70, 55 + Math.sin(a) * 30, 2, 2, '#fff4c2'); }
}
export async function abrirLivroCapitao(ctx) {
  let tem = false;
  try { tem = (await ctx.progresso.ler('navio.chave')) === true; } catch { tem = false; }
  let pagina = 0;
  let quadro = 0;
  const corpo = h('div', { class: 'ilha-livro' });
  const m = modal({ titulo: 'Livro do Capitão Saltarrocha', tamanho: 'grande', corpo, aoFechar: () => cancelAnimationFrame(quadro) });
  function desenhar() {
    cancelAnimationFrame(quadro);
    const ultima = pagina === PAGINAS_CAPITAO.length;
    let conteudo;
    if (!ultima) {
      const [titulo, txt] = PAGINAS_CAPITAO[pagina];
      conteudo = [h('h3', null, titulo), h('p', null, txt)];
    } else {
      const c = h('canvas', { class: 'ilha-livro-chave', width: 440, height: 220, style: { width: '220px', height: '110px' } });
      const animar = agora => { if (!c.isConnected && quadro) return; desenharChave(c, agora / 1000); quadro = requestAnimationFrame(animar); };
      quadro = requestAnimationFrame(animar);
      conteudo = [
        h('h3', null, tem ? 'A chave já é sua' : 'Uma chave escondida!'),
        h('p', null, tem ? 'O lugar da chave está vazio: você já pegou. Ela abre o Quartel do Capitão, no convés do Saltador.' : 'Entre as páginas, num buraquinho recortado no papel, brilha uma chave dourada com uma pedra vermelha.'),
        c,
        !tem && botao('Pegar a chave', {
          classe: 'btn-ouro', icone: 'chave',
          onclick: async () => {
            try {
              await ctx.progresso.gravar('navio.chave', true);
              tem = true;
              ctx.enviar?.('clube:emote', { e: 'estrela' });
              aviso('Você pegou a chave do Quartel do Capitão! Ela abre a porta do capitão no Saltador.');
              desenhar();
            } catch (e) { aviso(e.message || 'Não deu para pegar a chave.', 'erro'); }
          },
        }),
      ];
    }
    trocar(corpo,
      h('div', { class: 'ilha-livro-pagina' }, ...conteudo),
      h('div', { class: 'ilha-livro-nav' },
        botao('Voltar', { icone: 'voltar', desativado: pagina === 0, onclick: () => { pagina--; desenhar(); } }),
        h('span', { class: 'suave' }, `Página ${pagina + 1} de ${PAGINAS_CAPITAO.length + 1}`),
        botao(ultima ? 'Fechar' : 'Virar a página', { icone: ultima ? 'x' : 'frente', classe: 'btn-ouro', onclick: () => { if (ultima) m.fechar(); else { pagina++; desenhar(); } } })));
  }
  desenhar();
  return m;
}

/* ─── Os livros da história da ilha ───────────────── */

const HISTORIA = [
  ['Como a ilha nasceu', 'Dizem os mais velhos que a ilha era só um iceberg, até que um coelho plantou a primeira cenoura no gelo. A cenoura cresceu tanto que o gelo derreteu em volta, e no lugar nasceram a praça, o lago e a floresta. A montanha nevada ficou de lembrança.'],
  ['A chegada dos coelhos', 'Os primeiros coelhos chegaram num barquinho de casca de noz, fugindo do inverno. Construíram o Café da Cenoura para se esquentar e, quando o café ficou pequeno, fizeram a Praça inteira em volta dele.'],
  ['Os Pompons', 'Ninguém sabe de onde vieram os Pompons. Um dia apareceu um rosa dentro de um gorro esquecido no Armarinho; no outro, um azul dormindo no Café. Hoje eles têm um Pet Shop, um Hotel e até um Parque só deles.'],
  ['O Capitão Saltarrocha', 'O Capitão chega de vez em quando no Saltador, o navio mais saltitante dos sete mares. Traz itens raros, conta histórias de piratas e sempre esquece alguma coisa na ilha. Desconfie dos livros que ele deixa por aí.'],
  ['O Raposo', 'O Raposo vive tentando estragar a diversão: já tentou derreter o Forte Nevado, esconder as cenouras do Café e trocar o cenário do Teatro por um retrato dele mesmo. Até hoje não deu certo.'],
  ['Segredos da ilha', 'Há quem diga que existe uma Guarda Secreta do Coelho cuidando da ilha, que no porão do Salão de Dança tem uma caldeira enorme e que, se muita gente dançar junta no iceberg, ele balança. Mas isso é só boato... não é?'],
];
export function abrirHistoria() {
  let atual = 0;
  const texto_ = h('div', { class: 'ilha-livro-pagina' });
  const lista = h('div', { class: 'ilha-capitulos' });
  function desenhar() {
    trocar(lista, HISTORIA.map(([t], k) => h('button', { type: 'button', class: `ilha-capitulo ${k === atual ? 'ativo' : ''}`.trim(), onclick: () => { atual = k; desenhar(); } }, `${k + 1}. ${t}`)));
    const [t, p] = HISTORIA[atual];
    trocar(texto_, h('h3', null, t), h('p', null, p));
  }
  desenhar();
  return modal({ titulo: 'História da Ilha', tamanho: 'grande', corpo: h('div', { class: 'ilha-livro ilha-historia' }, lista, texto_) });
}

/* ─── Os roteiros do Teatro ───────────────────────── */

const ROTEIROS = {
  pirata: ['Arr! Quem roubou a minha cenoura de estimação?', 'Capitão, avistei terra! Ou é um pompom gigante...', 'Içar as velas! E alguém traga um lanchinho.', 'Este mapa leva ao tesouro... ou à Pizzaria. Tanto faz!', 'Ninguém anda na prancha hoje: é dia de folga.'],
  castelo: ['Quem ousa bater na porta do meu castelo de cenoura?', 'Majestade, o dragão pediu para entrar. Ele trouxe bolo.', 'Eu sou o cavaleiro mais corajoso... menos quando tem trovão.', 'Princesa, eu vim salvar você! Ah, você já se salvou. Legal.', 'Que comece o grande baile real dos coelhos!'],
  espaco: ['Base Lunar, aqui é a Capitã Orelha. Achamos queijo!', 'Três, dois, um... decolar! Esqueci o capacete.', 'Um planeta feito só de cenouras? Pousar imediatamente!', 'Alienígena à vista! Ele está acenando... olá, amigo!', 'No espaço ninguém ouve você pular. Mas eu pulo assim mesmo.'],
  floresta: ['Os cogumelos brilham... a floresta está acordando!', 'Uma fada me disse que este caminho leva ao Lago. Ou ao jantar.', 'Quem está aí? Ah, é só um vaga-lume tímido.', 'Por favor, árvore falante, me conte um segredo.', 'Que a magia da floresta proteja todos os pompons!'],
};
export function abrirRoteiros(ctx) {
  let atual = cenarioAtual().id;
  const corpo = h('div', { class: 'ilha-roteiros' });
  function desenhar() {
    trocar(corpo,
      h('p', { class: 'suave' }, 'Escolha uma peça e clique numa fala para dizer no palco. O cenário de agora vem primeiro!'),
      h('div', { class: 'segmentado clube-abas' }, CENARIOS.map(c => h('button', { type: 'button', class: `seg ${c.id === atual ? 'ativo' : ''}`.trim(), onclick: () => { atual = c.id; desenhar(); } }, c.nome))),
      h('ol', { class: 'ilha-falas' }, ROTEIROS[atual].map(f => h('li', null,
        h('span', null, `"${f}"`),
        botao('Falar', { classe: 'btn-pequeno btn-ouro', icone: 'chat', onclick: () => { if (ctx.enviar('clube:falar', { texto: f })) m.fechar(); } })))));
  }
  const m = modal({ titulo: 'Roteiros do Teatro', tamanho: 'grande', corpo });
  desenhar();
  return m;
}

/* ─── O piano da Pizzaria ─────────────────────────── */

let audioPiano = null;
export function tocarPiano() {
  if (mudo()) return;
  try {
    audioPiano ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioPiano.state === 'suspended') audioPiano.resume();
    const escala = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const t0 = audioPiano.currentTime + 0.02;
    let i = Math.floor(Math.random() * 4);
    for (let k = 0; k < 7; k++) {
      i = Math.max(0, Math.min(escala.length - 1, i + Math.floor(Math.random() * 5) - 2));
      const quando = t0 + k * 0.22;
      for (const [mult, vol] of [[1, 0.08], [2, 0.02]]) {
        const o = audioPiano.createOscillator();
        const v = audioPiano.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(escala[i] * mult, quando);
        v.gain.setValueAtTime(vol, quando);
        v.gain.exponentialRampToValueAtTime(0.0001, quando + 0.6);
        o.connect(v).connect(audioPiano.destination);
        o.start(quando);
        o.stop(quando + 0.65);
      }
    }
  } catch { /* sem som neste navegador */ }
}

