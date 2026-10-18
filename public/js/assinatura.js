// A assinatura desenhada: almofada para assinar com mouse, toque ou caneta, e o desenho dos traços em SVG.
// Os traços vivem numa grade fixa de 600 x 200 (a mesma que o servidor guarda), qualquer que seja o tamanho na tela.
import { h } from './core.js';

export const LARGURA = 600;
export const ALTURA = 200;
export const MAX_TRACOS = 40;
export const MAX_PONTOS = 600;
const ESPESSURA = 2.6; // em unidades da grade: fina como ponta de pena
const DISTANCIA_MINIMA = 1.6; // pontos mais perto que isso não valem a pena guardar
const SVG_NS = 'http://www.w3.org/2000/svg';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// Prepara os traços para enviar: números inteiros dentro da grade, no máximo 40 traços e 600 pontos por traço
// (traço comprido perde pontos em intervalos regulares, mantendo o primeiro e o último).
export function normalizarTracos(tracos) {
  if (!Array.isArray(tracos)) return [];
  const saida = [];
  for (const t of tracos) {
    if (saida.length >= MAX_TRACOS) break;
    if (!Array.isArray(t)) continue;
    const validos = [];
    for (const q of t) {
      const x = Number(q?.[0]);
      const y = Number(q?.[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) validos.push([limitar(Math.round(x), 0, LARGURA), limitar(Math.round(y), 0, ALTURA)]);
    }
    if (!validos.length) continue;
    let pontos = validos;
    if (validos.length > MAX_PONTOS) {
      pontos = [];
      for (let i = 0; i < MAX_PONTOS; i++) pontos.push(validos[Math.round(i * (validos.length - 1) / (MAX_PONTOS - 1))]);
    }
    saida.push(pontos);
  }
  return saida;
}

// Lê o que vem do servidor (texto JSON '{"tracos":[...]}', objeto ou nada) e devolve a lista de traços, ou null.
export function lerAssinatura(valor) {
  let v = valor;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  const tracos = normalizarTracos(v?.tracos);
  const total = tracos.reduce((n, t) => n + t.length, 0);
  return tracos.length && total >= 3 ? tracos : null;
}

// Pontos que entram no corpo do pedido (o servidor ignora assinatura com menos de 3 pontos).
export const corpoDaAssinatura = tracos => ({ assinatura: { tracos: normalizarTracos(tracos) } });

// Traço suavizado: curvas quadráticas passando pelos pontos médios.
function caminho(pontos) {
  if (pontos.length === 1) return `M${pontos[0][0]} ${pontos[0][1]}h0.01`;
  let d = `M${pontos[0][0]} ${pontos[0][1]}`;
  if (pontos.length === 2) return `${d}L${pontos[1][0]} ${pontos[1][1]}`;
  for (let i = 1; i < pontos.length - 1; i++) {
    const mx = (pontos[i][0] + pontos[i + 1][0]) / 2;
    const my = (pontos[i][1] + pontos[i + 1][1]) / 2;
    d += `Q${pontos[i][0]} ${pontos[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const u = pontos[pontos.length - 1];
  return `${d}L${u[0]} ${u[1]}`;
}

// Desenha os traços como SVG dentro de "alvo" (troca o que houver lá). Sem innerHTML: tudo por createElementNS.
// opcoes: cor (padrão: a cor do texto do alvo), espessura, ajustar (corta o desenho ao que foi riscado), rotulo.
export function desenharAssinatura(alvo, tracos, opcoes = {}) {
  const lista = normalizarTracos(tracos);
  let x0 = 0; let y0 = 0; let larg = LARGURA; let alt = ALTURA;
  if (opcoes.ajustar && lista.length) {
    const xs = lista.flat().map(p => p[0]);
    const ys = lista.flat().map(p => p[1]);
    const folga = 8;
    x0 = Math.max(0, Math.min(...xs) - folga);
    y0 = Math.max(0, Math.min(...ys) - folga);
    larg = Math.max(40, Math.min(LARGURA, Math.max(...xs) + folga) - x0);
    alt = Math.max(30, Math.min(ALTURA, Math.max(...ys) + folga) - y0);
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${x0} ${y0} ${larg} ${alt}`);
  svg.setAttribute('class', 'assinatura-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opcoes.rotulo || 'Assinatura desenhada');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', opcoes.cor || 'currentColor');
  g.setAttribute('stroke-width', String(opcoes.espessura || ESPESSURA));
  g.setAttribute('stroke-linecap', 'round');
  g.setAttribute('stroke-linejoin', 'round');
  for (const t of lista) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', caminho(t));
    g.append(p);
  }
  svg.append(g);
  if (alvo) { alvo.replaceChildren(svg); }
  return svg;
}

/* ─── A última assinatura, guardada neste navegador ─ */

const CHAVE_PADRAO = 'lyendell.assinatura';

export function lerUltimaAssinatura(chave = CHAVE_PADRAO) {
  try { return lerAssinatura(localStorage.getItem(chave)); } catch { return null; }
}

export function guardarUltimaAssinatura(tracos, chave = CHAVE_PADRAO) {
  try { localStorage.setItem(chave, JSON.stringify({ tracos: normalizarTracos(tracos) })); return true; } catch { return false; }
}

/* ─── A almofada de assinatura ───────────────────── */

// Devolve { elemento, tracos(), vazio(), limpar(), desfazer(), definir(tracos) }.
// aoMudar(vazio) é chamado quando um traço termina, some ou a assinatura é trocada.
export function almofadaDeAssinatura({ aoMudar, inicial, tinta = '#1f2540' } = {}) {
  let tracos = normalizarTracos(inicial || []);
  let atual = null; // traço em andamento
  let idPonteiro = null;
  const canvas = h('canvas', {
    class: 'assinatura-tela', width: LARGURA, height: ALTURA, role: 'img', style: { touchAction: 'none' },
    'aria-label': 'Espaço para assinar com o mouse, o dedo ou a caneta. A assinatura é opcional.',
  });
  canvas.style.touchAction = 'none';
  const ctx = canvas.getContext('2d');
  const dica = h('span', { class: 'assinatura-dica', 'aria-hidden': 'true' }, 'Assine aqui');
  const palco = h('div', { class: 'assinatura-palco' },
    h('span', { class: 'assinatura-x', 'aria-hidden': 'true' }, 'X'),
    h('span', { class: 'assinatura-linha', 'aria-hidden': 'true' }),
    dica, canvas);
  const bLimpar = h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => limpar() }, 'Limpar');
  const bDesfazer = h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => desfazer() }, 'Desfazer o último traço');
  const elemento = h('div', { class: 'assinatura' }, palco, h('div', { class: 'assinatura-acoes' }, bDesfazer, bLimpar));

  const vazio = () => !tracos.length || tracos.reduce((n, t) => n + t.length, 0) < 3;

  function traco(pontos) {
    ctx.beginPath();
    if (pontos.length === 1) {
      ctx.arc(pontos[0][0], pontos[0][1], ESPESSURA / 2, 0, Math.PI * 2);
      ctx.fillStyle = tinta;
      ctx.fill();
      return;
    }
    ctx.moveTo(pontos[0][0], pontos[0][1]);
    if (pontos.length === 2) ctx.lineTo(pontos[1][0], pontos[1][1]);
    else {
      for (let i = 1; i < pontos.length - 1; i++) {
        ctx.quadraticCurveTo(pontos[i][0], pontos[i][1], (pontos[i][0] + pontos[i + 1][0]) / 2, (pontos[i][1] + pontos[i + 1][1]) / 2);
      }
      const u = pontos[pontos.length - 1];
      ctx.lineTo(u[0], u[1]);
    }
    ctx.stroke();
  }

  // Ajusta a resolução do canvas ao tamanho na tela (e à densidade de pixels), mantendo a grade 600 x 200.
  function redesenhar() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width > 0) {
      const w = Math.round(rect.width * dpr);
      if (canvas.width !== w) { canvas.width = w; canvas.height = Math.round(w * ALTURA / LARGURA); }
    }
    const k = canvas.width / LARGURA;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, LARGURA, ALTURA);
    ctx.lineWidth = ESPESSURA;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tinta;
    for (const t of tracos) traco(t);
    if (atual) traco(atual);
  }

  function atualizarEstado() {
    const v = vazio();
    elemento.classList.toggle('vazia', v);
    dica.hidden = !!(tracos.length || atual);
    bDesfazer.disabled = !tracos.length;
    bLimpar.disabled = !tracos.length;
  }

  function ponto(e) {
    const rect = canvas.getBoundingClientRect();
    return [limitar((e.clientX - rect.left) * LARGURA / rect.width, 0, LARGURA), limitar((e.clientY - rect.top) * ALTURA / rect.height, 0, ALTURA)];
  }

  function acrescentar(e) {
    if (!atual) return;
    const p = ponto(e);
    const u = atual[atual.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) < DISTANCIA_MINIMA) return;
    if (atual.length < MAX_PONTOS * 4) atual.push(p);
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (idPonteiro != null) return;
    if (tracos.length >= MAX_TRACOS) return;
    e.preventDefault();
    idPonteiro = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    atual = [ponto(e)];
    atualizarEstado();
    redesenhar();
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== idPonteiro || !atual) return;
    e.preventDefault();
    const extras = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const x of (extras.length ? extras : [e])) acrescentar(x);
    redesenhar();
  });
  const terminar = e => {
    if (e.pointerId !== idPonteiro) return;
    idPonteiro = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    if (atual) {
      tracos.push(atual);
      tracos = normalizarTracos(tracos);
      atual = null;
    }
    redesenhar();
    atualizarEstado();
    aoMudar?.(vazio());
  };
  canvas.addEventListener('pointerup', terminar);
  canvas.addEventListener('pointercancel', terminar);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function limpar() { tracos = []; atual = null; redesenhar(); atualizarEstado(); aoMudar?.(true); }
  function desfazer() { tracos = tracos.slice(0, -1); redesenhar(); atualizarEstado(); aoMudar?.(vazio()); }
  function definir(novos) { tracos = normalizarTracos(novos || []); atual = null; redesenhar(); atualizarEstado(); aoMudar?.(vazio()); }

  // O canvas só tem tamanho depois de entrar na página: observa o tamanho e redesenha na mesma grade.
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => redesenhar()).observe(canvas);
  else window.addEventListener('resize', redesenhar);
  queueMicrotask(redesenhar);
  atualizarEstado();

  return { elemento, tracos: () => normalizarTracos(tracos), vazio, limpar, desfazer, definir };
}
