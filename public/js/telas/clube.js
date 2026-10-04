// Club Coelho: o clube social da Recreação, no estilo do Club Penguin. Cada um passeia com o seu coelho
// pelas salas (clique no chão para andar), conversa em balões, faz emotes, dança, compra roupas e móveis
// com cenouras e decora a própria toca. As regras e os preços ficam no servidor (src/clube.js); os
// desenhos em desenho-coelho.js, roupas-coelho.js e clube-salas.js; os minijogos em clube-minijogos.js.

import { h, trocar, icone, botao, cabecalho, modal, get, post, put, aviso, aoSair, estado, pode, num, normalizar } from '../core.js';
import { rt, ouvir, enviar } from '../tempo-real.js';
import { desenharCoelho, quebrarTexto } from '../desenho-coelho.js';
import { SALAS, W, H, fundoToca, desenharMovel, MOVEIS } from '../clube-salas.js';
import { abrirPescaria, abrirDanca } from '../clube-minijogos.js';
import { PARTES } from '../roupas-coelho.js';
import { aoMudarSprites } from '../sprites.js';

const VEL = 170; // o mesmo do servidor
const EMOTES = [
  ['oi', '👋', 'Acenar'], ['coracao', '❤️', 'Coração'], ['risada', '😂', 'Rir'], ['susto', '😮', 'Susto'], ['pergunta', '❓', 'Hein?'],
  ['zzz', '💤', 'Sono'], ['cenoura', '🥕', 'Cenoura'], ['estrela', '⭐', 'Estrela'],
];
const EMOJI = Object.fromEntries(EMOTES.map(([k, e]) => [k, e]));
const NOME_PARTE = { pelo: 'Pelo', cabeca: 'Cabeça', rosto: 'Rosto', pescoco: 'Pescoço', costas: 'Costas', corpo: 'Roupa', mao: 'Na mão' };
const ABAS_LOJA = [['roupas', 'Roupas'], ['pelos', 'Pelos'], ['moveis', 'Móveis'], ['toca', 'Chão e parede']];
const SALAS_MAPA = [['praca', 'Praça do Clube', 'A fonte, os bancos e as portas para todo o clube.'], ['cafe', 'Café da Cenoura', 'Um café quentinho e um bolo de cenoura.'],
  ['loja', 'Armarinho', 'Roupas, acessórios e móveis para a toca.'], ['danca', 'Salão de Dança', 'Pista colorida e a máquina Dança da Toca.'],
  ['lago', 'Lago Cintilante', 'Pescaria com o velho pescador.']];

function exigirAcesso() {
  if (pode('recreacao.usar')) return;
  const e = new Error('Sem acesso à Recreação.');
  e.status = 403;
  throw e;
}

export async function clube() {
  exigirAcesso();
  const dados = await get('/api/clube');
  const cat = new Map(dados.catalogo.map(i => [i.id, i]));
  const eu = dados.eu;
  const meuId = estado.eu.id;

  /* ─── Elementos da página ─── */
  const tela = h('canvas', { class: 'clube-tela', tabindex: '0', 'aria-label': 'O Club Coelho. Clique no chão para andar.' });
  const g = tela.getContext('2d');
  const moedasEl = h('strong', null, num(eu.moedas));
  const chip = h('span', { class: 'clube-moedas', title: 'Suas cenouras' }, '🥕 ', moedasEl);
  const entrada = h('input', { class: 'input', maxlength: '120', placeholder: 'Escreva e aperte Enter...', 'aria-label': 'Falar' });
  const formChat = h('form', { class: 'clube-falar' }, entrada, h('button', { class: 'btn btn-ouro', type: 'submit', 'aria-label': 'Falar' }, icone('aviao')));
  const botaoDecorar = botao('Decorar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => comecarDecorar() });
  const painelDecorar = h('section', { class: 'painel clube-decorar', hidden: true });
  const conversa = h('ol', { class: 'clube-conversa', 'aria-live': 'polite' });
  const barra = h('div', { class: 'clube-barra' },
    formChat,
    h('div', { class: 'clube-emotes' },
      EMOTES.map(([k, e, nome]) => h('button', { type: 'button', class: 'clube-emote', title: nome, 'aria-label': nome, onclick: () => emote(k) }, e)),
      h('button', { type: 'button', class: 'clube-emote largo', title: 'Dançar', onclick: () => emote('dancar') }, '💃 Dançar'),
      h('button', { type: 'button', class: 'clube-emote largo', title: 'Sentar', onclick: () => emote('sentar') }, 'Sentar')),
    h('div', { class: 'clube-acoes' },
      botao('Meu coelho', { icone: 'coelho', classe: 'btn-pequeno', onclick: () => abrirGuardaRoupa() }),
      botao('Loja', { icone: 'loja', classe: 'btn-pequeno', onclick: () => abrirLoja() }),
      botao('Mapa', { icone: 'mapa', classe: 'btn-pequeno', onclick: () => abrirMapa() }),
      botao('Minha toca', { icone: 'casa', classe: 'btn-pequeno', onclick: () => irPara(`toca:${meuId}`) }),
      botaoDecorar));

  /* ─── Estado ─── */
  let sala = null;
  let nomeSala = '';
  let toca = null;            // a toca em que estou (com os móveis)
  let pessoas = new Map();    // id -> coelho na sala
  let aoChegar = null;        // o que fazer quando o meu coelho chegar no lugar clicado
  let sobre = null;           // ponto de clique embaixo do mouse
  let mouse = null;
  let cenario = null;
  let chaveCenario = '';
  let decorando = null;       // { toca (rascunho), sel, arrastando }
  let querSala = 'praca';
  let quadro = 0;
  const inicio = performance.now();

  const tipoSala = () => (sala?.startsWith('toca:') ? 'toca' : sala);
  const minhaToca = () => sala === `toca:${meuId}`;
  const corDoPelo = v => cat.get(v?.pelo)?.cor || '#e9dcc3';
  const roupaDe = (v, cafe) => {
    const r = {};
    for (const p of PARTES) if (v?.[p]) r[p] = v[p];
    if (cafe) r.mao = 'cafe';
    return r;
  };
  const visualDesenho = v => ({ cor: corDoPelo(v), roupa: roupaDe(v) });
  function mudarMoedas(n) { eu.moedas = n; moedasEl.textContent = num(n); }

  /* ─── Conexão ─── */
  function irPara(destino) {
    querSala = destino;
    if (decorando) pararDecorar(false);
    if (rt.conectado) enviar('clube:entrar', { sala: destino });
  }
  const escutar = (tipo, f) => aoSair(ouvir(tipo, f));
  escutar('estado', () => { if (rt.conectado) enviar('clube:entrar', { sala: sala || querSala }, { silencioso: true }); });
  escutar('clube:sala', m => {
    if (decorando && m.sala !== `toca:${meuId}`) pararDecorar(false);
    sala = m.sala;
    querSala = m.sala;
    nomeSala = m.nomeSala;
    toca = m.toca;
    pessoas = new Map(m.pessoas.map(p => [p.id, novaPessoa(p)]));
    aoChegar = null;
    botaoDecorar.hidden = !minhaToca();
    trocar(conversa);
    anotarNaConversa(null, `Você entrou: ${nomeSala}.`);
  });
  escutar('clube:chegou', ({ p }) => { pessoas.set(p.id, novaPessoa(p)); });
  escutar('clube:saiu', ({ id }) => { pessoas.delete(id); });
  escutar('clube:andar', m => {
    const p = pessoas.get(m.id);
    if (!p) return;
    if (Math.hypot(p.x - m.x, p.y - m.y) > 60) { p.x = m.x; p.y = m.y; }
    Object.assign(p, { tx: m.tx, ty: m.ty, d: m.d, dancando: false, sentado: false });
  });
  escutar('clube:fala', ({ id, texto }) => {
    const p = pessoas.get(id);
    if (!p) return;
    p.fala = { texto, ate: Date.now() + 7000 };
    anotarNaConversa(p.nome, texto, id === meuId);
  });
  escutar('clube:emote', m => {
    const p = pessoas.get(m.id);
    if (!p) return;
    if (m.e === 'dancar' || m.e === 'sentar') Object.assign(p, { x: m.x, y: m.y, tx: m.x, ty: m.y, dancando: m.dancando, sentado: m.sentado });
    else if (m.e === 'cafe') p.cafeAte = Date.now() + 30000;
    else p.emote = { e: m.e, ate: Date.now() + 2800 };
  });
  escutar('clube:visual', ({ id, visual }) => { const p = pessoas.get(id); if (p) p.visual = visual; });
  escutar('clube:toca', m => { if (sala === `toca:${m.toca.dono}`) toca = m.toca; });

  function novaPessoa(p) {
    return { ...p, passo: 0, andando: false, fala: null, emote: null, cafeAte: 0 };
  }
  function anotarNaConversa(nome, texto, minha = false) {
    conversa.append(h('li', { class: minha ? 'minha' : '' }, nome ? [h('strong', null, nome), ' ', texto] : h('em', null, texto)));
    while (conversa.children.length > 40) conversa.firstChild.remove();
    conversa.scrollTop = conversa.scrollHeight;
  }

  formChat.addEventListener('submit', ev => {
    ev.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    if (enviar('clube:falar', { texto })) entrada.value = '';
  });
  function emote(k) {
    if (decorando) return;
    enviar('clube:emote', { e: k });
  }

  /* ─── Andar e clicar ─── */
  function pontoDoMouse(ev) {
    const r = tela.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }
  function pontoNaSala(x, y) {
    return (SALAS[tipoSala()]?.pontos || []).find(p => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) || null;
  }
  function coelhoEm(x, y) {
    let achou = null;
    for (const p of pessoas.values()) {
      if (p.id === meuId) continue;
      if (Math.abs(p.x - x) < 24 && y > p.y - 66 && y < p.y + 8 && (!achou || p.y > achou.y)) achou = p;
    }
    return achou;
  }
  function andarAte(x, y, depois = null) {
    const chao = dados.salas[tipoSala()]?.chao || [0, 0, W, H];
    const tx = Math.round(Math.max(chao[0], Math.min(chao[2], x)));
    const ty = Math.round(Math.max(chao[1], Math.min(chao[3], y)));
    const eu_ = pessoas.get(meuId);
    if (!eu_) return;
    if (tx !== Math.round(eu_.x)) eu_.d = tx > eu_.x ? 1 : -1;
    Object.assign(eu_, { tx, ty, dancando: false, sentado: false });
    aoChegar = depois;
    enviar('clube:andar', { x: tx, y: ty }, { silencioso: true });
  }

  tela.addEventListener('pointerdown', ev => {
    tela.focus({ preventScroll: true });
    const { x, y } = pontoDoMouse(ev);
    if (decorando) { pegarMovel(x, y, ev); return; }
    const outro = coelhoEm(x, y);
    if (outro) { cartaoDaPessoa(outro); return; }
    const ponto = pontoNaSala(x, y);
    if (ponto) { andarAte(ponto.ir[0], ponto.ir[1], () => agir(ponto.acao)); return; }
    andarAte(x, y);
  });
  tela.addEventListener('pointermove', ev => {
    const p = pontoDoMouse(ev);
    mouse = ev.pointerType === 'mouse' ? p : null;
    if (decorando?.arrastando) { arrastarMovel(p.x, p.y); return; }
    sobre = mouse && !decorando ? pontoNaSala(p.x, p.y) : null;
    tela.style.cursor = sobre || (mouse && coelhoEm(p.x, p.y)) ? 'pointer' : decorando ? 'grab' : 'default';
  });
  tela.addEventListener('pointerup', () => { if (decorando) decorando.arrastando = null; });
  tela.addEventListener('pointerleave', () => { mouse = null; sobre = null; });

  function agir(acao) {
    if (acao.startsWith('sala:')) { irPara(acao.slice(5)); return; }
    if (acao === 'loja') abrirLoja();
    else if (acao === 'provador') abrirGuardaRoupa();
    else if (acao === 'tocas') abrirMapa(true);
    else if (acao === 'cafe') { enviar('clube:emote', { e: 'cafe' }); aviso('Um café de cenoura quentinho!'); }
    else if (acao === 'pesca') abrirPescaria({ visual: visualDesenho(eu.visual), aoTerminar: r => mudarMoedas(r.moedas) });
    else if (acao === 'danca') abrirDanca({ visual: visualDesenho(eu.visual), aoTerminar: r => mudarMoedas(r.moedas) });
  }

  /* ─── Desenho ─── */
  function prepararCenario() {
    const tipo = tipoSala();
    const chave = tipo === 'toca' ? `toca:${toca?.piso}:${toca?.parede}` : tipo;
    if (chave === chaveCenario && cenario) return;
    chaveCenario = chave;
    cenario ??= document.createElement('canvas');
    cenario.width = W;
    cenario.height = H;
    const c = cenario.getContext('2d');
    c.clearRect(0, 0, W, H);
    if (tipo === 'toca') fundoToca(c, toca || {}); else SALAS[tipo]?.fundo?.(c);
  }

  function ajustarTela() {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    g.setTransform(w / W, 0, 0, hh / H, 0, 0);
  }

  function mover(dt) {
    for (const p of pessoas.values()) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      p.andando = dist > 1;
      if (!p.andando) {
        if (p.id === meuId && aoChegar) { const f = aoChegar; aoChegar = null; f(); }
        continue;
      }
      const k = Math.min(1, (VEL * dt) / dist);
      p.x += dx * k;
      p.y += dy * k;
      p.passo += dt;
    }
  }

  function desenhar(agora) {
    quadro = requestAnimationFrame(desenhar);
    const t = (agora - inicio) / 1000;
    const dt = Math.min(0.5, desenhar.ultimo ? (agora - desenhar.ultimo) / 1000 : 0);
    desenhar.ultimo = agora;
    if (!tela.isConnected) return;
    ajustarTela();
    if (!sala) {
      g.fillStyle = '#0e1811';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ece0bf';
      g.font = '700 26px "Cinzel", Georgia, serif';
      g.textAlign = 'center';
      g.fillText('Entrando no clube...', W / 2, H / 2);
      return;
    }
    try {
      mover(dt);
      prepararCenario();
      g.drawImage(cenario, 0, 0, W, H);
      const def = SALAS[tipoSala()];
      def?.animar?.(g, t);
      const camada = [];
      for (const o of def?.objetos || []) camada.push({ y: o.y, f: () => o.desenhar(g, t) });
      const moveis = decorando ? decorando.toca.moveis : toca?.moveis || [];
      if (tipoSala() === 'toca') {
        for (const m of moveis) {
          const info = MOVEIS[m.id];
          if (!info) continue;
          if (info.chao) desenharMovel(g, m.id, m.x, m.y, m.v, t);
          else if (info.parede) desenharMovel(g, m.id, m.x, m.y, m.v, t);
          else camada.push({ y: m.y, f: () => desenharMovel(g, m.id, m.x, m.y, m.v, t) });
        }
      }
      const agoraMs = Date.now();
      for (const p of pessoas.values()) {
        camada.push({
          y: p.y,
          f: () => {
            g.save();
            g.translate(p.x, p.y);
            g.scale(1.35, 1.35);
            desenharCoelho(g, 0, 0, {
              pelo: corDoPelo(p.visual), roupa: roupaDe(p.visual, p.cafeAte > agoraMs), dir: p.d || 1, passo: p.passo, andando: p.andando, t: t + (p.id % 7),
              pose: p.dancando ? 'dancando' : p.sentado ? 'sentado' : null,
            });
            g.restore();
          },
        });
      }
      camada.sort((a, b) => a.y - b.y).forEach(c => c.f());
      for (const p of pessoas.values()) desenharNome(p);
      for (const p of pessoas.values()) desenharFala(p, agoraMs, t);
      if (decorando) desenharSelecao();
      if (sobre && mouse) desenharRotulo(sobre.rotulo, mouse.x, mouse.y);
      // Nome da sala
      g.font = '700 18px "Cinzel", Georgia, serif';
      const largura = g.measureText(nomeSala).width + 28;
      g.fillStyle = 'rgba(14,24,17,0.72)';
      g.beginPath();
      if (g.roundRect) g.roundRect(12, 12, largura, 32, 10); else g.rect(12, 12, largura, 32);
      g.fill();
      g.fillStyle = '#e8c24a';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(nomeSala, 26, 29);
    } catch (e) {
      console.error('Club Coelho:', e);
    }
  }

  function desenharNome(p) {
    g.font = '700 13px "EB Garamond", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = g.measureText(p.nome).width + 14;
    g.fillStyle = p.id === meuId ? 'rgba(216,177,58,0.92)' : 'rgba(14,24,17,0.7)';
    g.beginPath();
    if (g.roundRect) g.roundRect(p.x - w / 2, p.y + 8, w, 18, 9); else g.rect(p.x - w / 2, p.y + 8, w, 18);
    g.fill();
    g.fillStyle = p.id === meuId ? '#1b1403' : '#fbf3e0';
    g.fillText(p.nome, p.x, p.y + 17.5);
  }

  function desenharFala(p, agoraMs, t) {
    const topo = p.y - 82;
    if (p.fala && p.fala.ate > agoraMs) {
      g.font = '15px "EB Garamond", Georgia, serif';
      const linhas = quebrarTexto(g, p.fala.texto, 190);
      const w = Math.max(...linhas.map(l => g.measureText(l).width)) + 22;
      const hh = linhas.length * 18 + 12;
      const y = topo - hh;
      g.globalAlpha = Math.min(1, (p.fala.ate - agoraMs) / 500);
      g.fillStyle = '#fffaf0';
      g.strokeStyle = '#8a6a44';
      g.lineWidth = 1.5;
      g.beginPath();
      if (g.roundRect) g.roundRect(p.x - w / 2, y, w, hh, 10); else g.rect(p.x - w / 2, y, w, hh);
      g.fill();
      g.stroke();
      g.beginPath(); g.moveTo(p.x - 7, y + hh); g.lineTo(p.x, y + hh + 9); g.lineTo(p.x + 7, y + hh); g.closePath(); g.fill();
      g.fillStyle = '#2a2016';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      linhas.forEach((l, k) => g.fillText(l, p.x, y + 15 + k * 18));
      g.globalAlpha = 1;
    } else if (p.emote && p.emote.ate > agoraMs) {
      const vida = 1 - (p.emote.ate - agoraMs) / 2800;
      g.font = '30px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.globalAlpha = vida > 0.85 ? (1 - vida) / 0.15 : 1;
      g.fillText(EMOJI[p.emote.e] || '', p.x + 16, topo - 6 - Math.sin(Math.min(1, vida * 3) * Math.PI) * 12);
      g.globalAlpha = 1;
    }
    if (p.dancando) {
      g.font = '700 16px serif';
      g.fillStyle = `hsl(${(t * 120) % 360}, 80%, 70%)`;
      g.fillText('♪', p.x - 22, topo + 14 - ((t * 30) % 20));
    }
  }

  function desenharRotulo(texto, x, y) {
    g.font = '700 14px "Cinzel", Georgia, serif';
    const w = g.measureText(texto).width + 20;
    const bx = Math.min(W - w - 6, Math.max(6, x + 14));
    const by = Math.max(6, y - 34);
    g.fillStyle = 'rgba(14,24,17,0.9)';
    g.strokeStyle = '#b8922a';
    g.lineWidth = 1.5;
    g.beginPath();
    if (g.roundRect) g.roundRect(bx, by, w, 26, 8); else g.rect(bx, by, w, 26);
    g.fill();
    g.stroke();
    g.fillStyle = '#e8c24a';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(texto, bx + 10, by + 13.5);
  }

  /* ─── Cartão de quem foi clicado ─── */
  function cartaoDaPessoa(p) {
    const previa = previaCoelho(p.visual, 160, 2.6);
    const m = modal({
      titulo: p.nome, tamanho: 'pequeno',
      corpo: h('div', { class: 'clube-cartao' }, previa,
        h('div', { class: 'clube-cartao-botoes' },
          botao('Acenar', { classe: 'btn-ouro', onclick: () => { emote('oi'); m.fechar(); } }),
          botao('Visitar a toca', { icone: 'casa', onclick: () => { irPara(`toca:${p.id}`); m.fechar(); } }),
          h('a', { class: 'btn', href: `#/pessoa/${p.id}`, onclick: () => m.fechar() }, icone('usuario'), h('span', null, 'Ver perfil')))),
    });
  }

  /* ─── Prévias (canvas pequeno com o coelho ou o item) ─── */
  // visual: o visual ou uma função que devolve o visual de agora (a prévia do guarda-roupa muda junto).
  function previaCoelho(visual, tam = 120, escala = 2.2, animar = false) {
    const c = h('canvas', { class: 'clube-previa', width: tam * 2, height: tam * 2, style: { width: `${tam}px`, height: `${tam}px` } });
    const cg = c.getContext('2d');
    const pintar = t => {
      cg.setTransform(2, 0, 0, 2, 0, 0);
      cg.clearRect(0, 0, tam, tam);
      cg.save();
      cg.translate(tam / 2 - 4, tam * 0.86);
      cg.scale(escala, escala);
      const v = typeof visual === 'function' ? visual() : visual;
      desenharCoelho(cg, 0, 0, { pelo: corDoPelo(v), roupa: roupaDe(v), t });
      cg.restore();
    };
    pintar(0);
    if (animar) {
      const laco = agora => { if (!c.isConnected && c.dataset.ligado) return; c.dataset.ligado = '1'; pintar(agora / 1000); requestAnimationFrame(laco); };
      requestAnimationFrame(laco);
    }
    c.repintar = () => pintar(0);
    return c;
  }
  function previaItem(item, tam = 84) {
    const c = h('canvas', { class: 'clube-previa', width: tam * 2, height: tam * 2, style: { width: `${tam}px`, height: `${tam}px` } });
    const cg = c.getContext('2d');
    cg.setTransform(2, 0, 0, 2, 0, 0);
    if (item.tipo === 'movel') {
      const info = MOVEIS[item.id] || { w: 80, h: 80 };
      const k = Math.min(1, (tam - 12) / Math.max(info.w, info.h));
      cg.translate(tam / 2, info.parede ? tam / 2 : tam - 8);
      cg.scale(k, k);
      desenharMovel(cg, item.id, 0, 0, 0, 1);
    } else if (item.tipo === 'piso' || item.tipo === 'parede') {
      const grande = document.createElement('canvas');
      grande.width = W;
      grande.height = H;
      fundoToca(grande.getContext('2d'), item.tipo === 'piso' ? { piso: item.id, parede: 'parede-terra' } : { piso: 'piso-madeira', parede: item.id });
      if (item.tipo === 'piso') cg.drawImage(grande, 300, 380, 300, 200, 0, 0, tam, tam);
      else cg.drawImage(grande, 120, 60, 260, 260, 0, 0, tam, tam);
    } else {
      const v = { pelo: item.tipo === 'pelo' ? item.id : eu.visual.pelo, ...(PARTES.includes(item.tipo) ? { [item.tipo]: item.id } : {}) };
      cg.translate(tam / 2 - 3, tam * 0.88);
      const escala = item.tipo === 'mao' || item.tipo === 'cabeca' ? 1.15 : 1.4;
      cg.scale(escala, escala);
      desenharCoelho(cg, 0, 0, { pelo: corDoPelo(v), roupa: roupaDe(v), t: 1 });
    }
    return c;
  }

  /* ─── Guarda-roupa ─── */
  const tem = id => { const i = cat.get(id); return !!i && (i.preco === 0 || (eu.itens[id] || 0) > 0); };
  let salvarVisual = null;
  function abrirGuardaRoupa() {
    let aba = 'pelo';
    const previa = previaCoelho(() => eu.visual, 200, 3.6, true);
    const abas = h('div', { class: 'segmentado clube-abas' });
    const grade = h('div', { class: 'clube-grade' });
    function desenharAbas() {
      trocar(abas, ['pelo', ...PARTES].map(k => h('button', { type: 'button', class: `seg ${k === aba ? 'ativo' : ''}`.trim(), onclick: () => { aba = k; desenharAbas(); desenharGrade(); } }, NOME_PARTE[k])));
    }
    function vestir(parte, id) {
      eu.visual = { ...eu.visual, [parte]: id || undefined };
      if (parte !== 'pelo' && !id) delete eu.visual[parte];
      clearTimeout(salvarVisual);
      salvarVisual = setTimeout(async () => {
        try { const r = await put('/api/clube/visual', eu.visual); eu.visual = r.visual; } catch (e) { aviso(e.message, 'erro'); }
      }, 350);
      const p = pessoas.get(meuId);
      if (p) p.visual = eu.visual;
      desenharGrade();
    }
    function desenharGrade() {
      const lista = dados.catalogo.filter(i => i.tipo === aba && tem(i.id));
      trocar(grade,
        aba !== 'pelo' && h('button', { type: 'button', class: `clube-item ${!eu.visual[aba] ? 'ativo' : ''}`.trim(), onclick: () => vestir(aba, null) },
          h('span', { class: 'clube-item-nada' }, icone('x')), h('span', null, 'Nada')),
        lista.map(i => h('button', { type: 'button', class: `clube-item ${eu.visual[aba] === i.id ? 'ativo' : ''}`.trim(), onclick: () => vestir(aba, i.id) },
          previaItem(i, 70), h('span', null, i.nome))),
        !lista.length && aba !== 'pelo' && h('p', { class: 'suave' }, 'Você ainda não tem nada aqui. Passe no Armarinho!'));
    }
    desenharAbas();
    desenharGrade();
    modal({
      titulo: 'Meu coelho', tamanho: 'grande',
      corpo: h('div', { class: 'clube-guarda' }, h('div', { class: 'clube-guarda-previa' }, previa), h('div', null, abas, grade)),
      rodape: [botao('Comprar mais coisas', { icone: 'loja', onclick: () => abrirLoja() })],
    });
  }

  /* ─── Loja ─── */
  function abrirLoja() {
    let aba = 'roupas';
    const abas = h('div', { class: 'segmentado clube-abas' });
    const grade = h('div', { class: 'clube-grade loja' });
    const saldo = h('p', { class: 'clube-saldo' });
    const doTipo = { roupas: i => PARTES.includes(i.tipo), pelos: i => i.tipo === 'pelo', moveis: i => i.tipo === 'movel', toca: i => i.tipo === 'piso' || i.tipo === 'parede' };
    function desenharAbas() {
      trocar(abas, ABAS_LOJA.map(([k, nome]) => h('button', { type: 'button', class: `seg ${k === aba ? 'ativo' : ''}`.trim(), onclick: () => { aba = k; desenharAbas(); desenharGrade(); } }, nome)));
    }
    async function comprar(i) {
      try {
        const r = await post('/api/clube/comprar', { item: i.id });
        eu.itens = r.itens;
        mudarMoedas(r.moedas);
        aviso(`Comprou: ${i.nome}!`);
        if (PARTES.includes(i.tipo) || i.tipo === 'pelo') {
          eu.visual = { ...eu.visual, [i.tipo]: i.id };
          const v = await put('/api/clube/visual', eu.visual);
          eu.visual = v.visual;
          const p = pessoas.get(meuId);
          if (p) p.visual = eu.visual;
        }
        desenharGrade();
      } catch (e) {
        aviso(e.message, 'erro');
      }
    }
    function desenharGrade() {
      trocar(saldo, 'Você tem ', h('strong', null, `🥕 ${num(eu.moedas)}`), ' cenouras. Ganhe mais jogando na Recreação, pescando no Lago ou dançando no Salão.');
      const lista = dados.catalogo.filter(i => doTipo[aba](i) && i.preco > 0).sort((a, b) => a.preco - b.preco);
      trocar(grade, lista.map(i => {
        const qtd = eu.itens[i.id] || 0;
        const jaTem = i.tipo !== 'movel' && qtd > 0;
        return h('div', { class: `clube-item loja ${jaTem ? 'ativo' : ''}`.trim() },
          previaItem(i, 84),
          h('strong', null, i.nome),
          h('span', { class: 'clube-preco' }, `🥕 ${num(i.preco)}`),
          jaTem ? h('small', { class: 'suave' }, 'Já é seu')
            : botao(qtd ? `Comprar outro (${qtd})` : 'Comprar', { classe: 'btn-pequeno btn-ouro', desativado: eu.moedas < i.preco, onclick: () => comprar(i) }));
      }));
    }
    desenharAbas();
    desenharGrade();
    modal({ titulo: 'Armarinho da Dona Felpuda', tamanho: 'grande', corpo: h('div', { class: 'clube-loja' }, saldo, abas, grade) });
  }

  /* ─── Mapa ─── */
  let mapaAberto = null;
  function abrirMapa(soTocas = false) {
    const corpo = h('div', { class: 'clube-mapa' }, h('p', { class: 'painel-vazio' }, 'Carregando...'));
    mapaAberto = { corpo, soTocas, busca: '' };
    const m = modal({ titulo: soTocas ? 'Tocas dos moradores' : 'Mapa do clube', tamanho: 'grande', corpo, aoFechar: () => { mapaAberto = null; } });
    mapaAberto.m = m;
    enviar('clube:mapa', {});
  }
  escutar('clube:mapa', d => {
    if (!mapaAberto) return;
    const { corpo, m } = mapaAberto;
    const lista = h('div', { class: 'clube-tocas' });
    const busca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar a toca de alguém...', oninput: ev => { mapaAberto.busca = normalizar(ev.target.value); desenharTocas(); } });
    const ir = destino => { irPara(destino); m.fechar(); };
    function desenharTocas() {
      const minhas = d.tocas.filter(t => t.id === meuId);
      const outras = d.tocas.filter(t => t.id !== meuId && (!mapaAberto.busca || normalizar(t.nome).includes(mapaAberto.busca)))
        .sort((a, b) => b.aqui - a.aqui || b.moveis - a.moveis);
      trocar(lista, [...minhas, ...outras].map(t => h('div', { class: 'clube-toca-linha' },
        h('span', { class: 'clube-toca-icone' }, icone('casa')),
        h('div', null, h('strong', null, t.id === meuId ? 'A minha toca' : `Toca de ${t.nome}`),
          h('small', null, `${t.moveis} ${t.moveis === 1 ? 'móvel' : 'móveis'}${t.aqui ? ` · ${t.aqui} ${t.aqui === 1 ? 'pessoa lá' : 'pessoas lá'}` : ''}${t.aberta ? '' : ' · fechada'}`)),
        botao('Visitar', { classe: 'btn-pequeno', onclick: () => ir(`toca:${t.id}`) }))),
      !outras.length && h('p', { class: 'suave' }, mapaAberto.busca ? 'Ninguém com esse nome.' : 'Ainda não tem outras tocas. Chame o pessoal para o clube!'));
    }
    desenharTocas();
    trocar(corpo,
      !mapaAberto.soTocas && h('div', { class: 'clube-salas' }, SALAS_MAPA.map(([id, nome, desc]) => h('button', { type: 'button', class: `clube-sala-cartao ${sala === id ? 'aqui' : ''}`.trim(), onclick: () => ir(id) },
        h('strong', null, nome), h('small', null, desc), h('span', { class: 'clube-sala-n' }, icone('usuarios'), ` ${d.contagem[id] || 0}`)))),
      h('h3', { class: 'clube-subtitulo' }, icone('casa'), 'Tocas'),
      busca, lista);
  });

  /* ─── Decorar a minha toca ─── */
  function comecarDecorar() {
    if (!minhaToca() || !toca) return;
    decorando = { toca: JSON.parse(JSON.stringify(toca)), original: toca, sel: null, arrastando: null };
    aoChegar = null;
    painelDecorar.hidden = false;
    desenharPainelDecorar();
  }
  function pararDecorar(salvar) {
    if (!decorando) return;
    const rascunho = decorando.toca;
    const original = decorando.original;
    decorando = null;
    painelDecorar.hidden = true;
    if (!salvar) { if (minhaToca()) toca = original; return; }
    put('/api/clube/toca', rascunho).then(r => { toca = { ...toca, ...r.toca }; eu.toca = r.toca; aviso('Toca decorada!'); }).catch(e => aviso(e.message, 'erro'));
  }
  function disponiveis(id) {
    const usados = decorando.toca.moveis.filter(m => m.id === id).length;
    return (eu.itens[id] || 0) - usados;
  }
  function desenharPainelDecorar() {
    if (!decorando) return;
    const t = decorando.toca;
    const meusMoveis = dados.catalogo.filter(i => i.tipo === 'movel' && (eu.itens[i.id] || 0) > 0);
    const opcoes = tipo => dados.catalogo.filter(i => i.tipo === tipo && tem(i.id));
    trocar(painelDecorar,
      h('div', { class: 'painel-cab' }, h('h2', null, icone('editar'), 'Decorar a toca'),
        h('div', { class: 'clube-decorar-botoes' },
          botao('Cancelar', { classe: 'btn-pequeno', onclick: () => pararDecorar(false) }),
          botao('Salvar', { classe: 'btn-pequeno btn-ouro', icone: 'check', onclick: () => pararDecorar(true) }))),
      h('p', { class: 'suave' }, 'Clique num móvel para colocar na toca e arraste para mudar de lugar. Selecionado, dá para virar ou guardar.'),
      decorando.sel && h('div', { class: 'clube-decorar-sel' },
        h('strong', null, cat.get(decorando.sel.id)?.nome),
        botao('Virar', { classe: 'btn-pequeno', icone: 'aleatorio', onclick: () => { decorando.sel.v = decorando.sel.v ? 0 : 1; } }),
        botao('Guardar', { classe: 'btn-pequeno btn-perigo-texto', icone: 'x', onclick: () => { t.moveis = t.moveis.filter(m => m !== decorando.sel); decorando.sel = null; desenharPainelDecorar(); } })),
      h('div', { class: 'clube-grade moveis' }, meusMoveis.length
        ? meusMoveis.map(i => {
          const n = disponiveis(i.id);
          return h('button', {
            type: 'button', class: 'clube-item', disabled: n <= 0 || t.moveis.length >= 40,
            onclick: () => {
              const info = MOVEIS[i.id] || {};
              // Cada móvel novo aparece num lugar diferente (fora da porta), para não ficar um em cima do outro.
              const n = t.moveis.length;
              const m = { id: i.id, x: 160 + ((n * 173) % 680), y: info.parede ? 150 + (n % 2) * 60 : 420 + (n % 3) * 50, v: 0 };
              t.moveis.push(m);
              decorando.sel = m;
              desenharPainelDecorar();
            },
          }, previaItem(i, 64), h('span', null, i.nome), h('small', null, n > 0 ? `${n} para pôr` : 'todos na toca'));
        })
        : h('p', { class: 'suave' }, 'Você ainda não tem móveis. O Armarinho vende!')),
      h('div', { class: 'clube-decorar-opcoes' },
        h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Chão'),
          h('select', { class: 'input', onchange: ev => { t.piso = ev.target.value; toca = { ...toca, piso: t.piso }; } },
            opcoes('piso').map(i => h('option', { value: i.id, selected: t.piso === i.id }, i.nome)))),
        h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Parede'),
          h('select', { class: 'input', onchange: ev => { t.parede = ev.target.value; toca = { ...toca, parede: t.parede }; } },
            opcoes('parede').map(i => h('option', { value: i.id, selected: t.parede === i.id }, i.nome)))),
        h('label', { class: 'mapa-check' }, h('input', { type: 'checkbox', checked: t.aberta, onchange: ev => { t.aberta = ev.target.checked; } }),
          h('span', null, 'Aberta para visitas'))));
  }
  function caixaMovel(m) {
    const info = MOVEIS[m.id] || { w: 60, h: 60 };
    return info.parede ? [m.x - info.w / 2, m.y - info.h / 2, m.x + info.w / 2, m.y + info.h / 2] : [m.x - info.w / 2, m.y - info.h, m.x + info.w / 2, m.y + 4];
  }
  function pegarMovel(x, y, ev) {
    const lista = [...decorando.toca.moveis].sort((a, b) => b.y - a.y);
    const m = lista.find(k => { const [x0, y0, x1, y1] = caixaMovel(k); return x >= x0 && x <= x1 && y >= y0 && y <= y1; }) || null;
    decorando.sel = m;
    decorando.arrastando = m ? { m, dx: m.x - x, dy: m.y - y } : null;
    if (m) tela.setPointerCapture?.(ev.pointerId);
    desenharPainelDecorar();
  }
  function arrastarMovel(x, y) {
    const { m, dx, dy } = decorando.arrastando;
    const info = MOVEIS[m.id] || {};
    m.x = Math.round(Math.max(60, Math.min(940, x + dx)));
    m.y = Math.round(info.parede ? Math.max(90, Math.min(290, y + dy)) : Math.max(300, Math.min(590, y + dy)));
  }
  function desenharSelecao() {
    const m = decorando.sel;
    if (!m) return;
    const [x0, y0, x1, y1] = caixaMovel(m);
    g.save();
    g.strokeStyle = '#e8c24a';
    g.lineWidth = 2;
    g.setLineDash([6, 5]);
    g.strokeRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    g.restore();
  }
  const aoTeclar = ev => {
    if (!decorando?.sel || ev.target.closest?.('input, textarea, select')) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      decorando.toca.moveis = decorando.toca.moveis.filter(m => m !== decorando.sel);
      decorando.sel = null;
      desenharPainelDecorar();
    }
  };
  document.addEventListener('keydown', aoTeclar);

  /* ─── Começo ─── */
  if (dados.presente) setTimeout(() => aviso(`Presente do dia: +${dados.presente} cenouras!`), 600);
  if (rt.conectado) enviar('clube:entrar', { sala: querSala });
  quadro = requestAnimationFrame(desenhar);
  // Chegou ou mudou um sprite (veja clube-salas.js): o fundo guardado da sala é desenhado de novo.
  const tirarSprites = aoMudarSprites(() => { chaveCenario = ''; });
  aoSair(() => {
    tirarSprites();
    cancelAnimationFrame(quadro);
    clearTimeout(salvarVisual);
    document.removeEventListener('keydown', aoTeclar);
    enviar('clube:sair', {}, { silencioso: true });
  });

  return h('div', { class: 'pagina clube' },
    cabecalho({
      titulo: 'Club Coelho', icone: 'balao', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Passeie com o seu coelho, converse, dance e decore a sua toca. Clique no chão para andar e nas portas para entrar.',
      acoes: [chip],
    }),
    h('div', { class: 'clube-palco' }, tela),
    barra,
    painelDecorar,
    h('section', { class: 'painel clube-conversa-painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('chat'), 'Conversa da sala')), conversa));
}
