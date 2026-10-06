// Os minijogos e as janelas da região "segredos" da Ilha do Club Coelho (importado só na hora, pelas ações
// de public/js/ilha/segredos.js):
//   abrirDesafioNinja  o Desafio Ninja do Dojo (cartas de fogo, água e neve contra um ninja do computador),
//                      com as versões do Dojo do Fogo, da Água e da Neve; vencer sobe a faixa
//   abrirMissao        a Missão do dia do QG (mensagem cifrada, cortar o fio certo e achar as diferenças)
//   abrirTelefone      o Telefone Espião (teletransporte para as salas do mapa da ilha)
//   abrirJornal        os jornais antigos da Sala da Caldeira
// Cada minijogo abre numa janela com o seu canvas (mouse, dedo e teclado); no fim, o resultado vai para
// /api/clube/minijogo pela função "terminar" que a ação passa (ctx.terminarMinijogo).

import { h, trocar, botao, modal, aviso } from '../core.js';
import { som } from '../arcade.js';
import { desenharCoelho } from '../desenho-coelho.js';
import {
  el, ret, contorno, grad, brilho, texto, forma, linha, chama, SIMBOLO, simboloNeve, FAIXAS, FAIXA_MAX, nomeDaFaixa, NOME_ELEMENTO, caixaRoxa,
} from './segredos.js';

const aleatorio = n => Math.floor(Math.random() * n);
const embaralhar = lista => { const a = [...lista]; for (let i = a.length - 1; i > 0; i--) { const j = aleatorio(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const suave = f => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f));

/* ─── A moldura comum (janela, canvas, laço e a tela de fim) ─── */

function abrirJanela({ titulo, largura, altura, classe = '', terminar, montar }) {
  const tela = h('canvas', { class: 'minijogo-tela', style: { aspectRatio: `${largura} / ${altura}` }, tabindex: '0' });
  const g = tela.getContext('2d');
  const sobre = h('div', { class: 'cobra-sobre minijogo-sobre' });
  const extra = h('div', { class: 'minijogo-extra' });
  let quadro = 0;
  let ultimo = 0;
  let parado = false;
  const limpezas = [];
  const m = modal({
    titulo, tamanho: 'grande', classe: `minijogo ${classe}`.trim(), fecharFora: false,
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
    get parado() { return parado; },
    ponto(ev) {
      const r = tela.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * largura, y: ((ev.clientY - r.top) / r.height) * altura };
    },
    ouvir(alvo, tipo, f, opcoes) { alvo.addEventListener(tipo, f, opcoes); limpezas.push(() => alvo.removeEventListener(tipo, f, opcoes)); },
    caixa(...filhos) { trocar(sobre, h('div', { class: 'cobra-caixa' }, ...filhos)); sobre.hidden = false; },
    esconder() { sobre.hidden = true; tela.focus({ preventScroll: true }); },
    async terminar(jogo, pontos, linhas, extraFim = null) {
      api.caixa(h('h2', null, 'Fim!'), linhas.map(l => h('p', null, l)), extraFim, h('p', { class: 'suave' }, 'Guardando as cenouras...'));
      let r = null;
      try { r = await terminar(jogo, pontos); } catch (e) { aviso(e.message || 'Não deu para guardar as cenouras.', 'erro'); }
      if (parado) return r;
      api.caixa(
        h('h2', null, 'Fim!'),
        linhas.map(l => h('p', null, l)),
        extraFim,
        r && h('p', { class: 'arcade-cenouras' }, r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje. Volte amanhã!' : 'Nenhuma cenoura desta vez.'),
        h('div', { class: 'minijogo-botoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => api.reiniciar() }),
          botao('Sair', { onclick: () => m.fechar() })));
      return r;
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

// A faixa desenhada (para a tela de fim e as regras).
function faixaEl(n, legenda) {
  const f = FAIXAS[Math.max(0, Math.min(FAIXA_MAX, n))];
  return h('div', { class: 'ilha-seg-faixa' }, h('span', { class: 'ilha-seg-faixa-cor', style: { background: f.cor } }), h('span', null, legenda));
}

/* ═══════════════ Desafio Ninja ═══════════════ */

const ELEMENTOS = ['fogo', 'agua', 'neve'];
const VENCE = { fogo: 'neve', neve: 'agua', agua: 'fogo' };              // a chave vence o valor
const PERDE_PARA = { neve: 'fogo', agua: 'neve', fogo: 'agua' };          // quem vence cada elemento
const VERBO = { fogo: 'derrete', neve: 'congela', agua: 'apaga' };
const CORES_CARTA = [
  { nome: 'vermelha', cor: '#d8433a' }, { nome: 'azul', cor: '#3f7fd8' }, { nome: 'amarela', cor: '#e8b628' },
  { nome: 'verde', cor: '#43a047' }, { nome: 'laranja', cor: '#ef8a2c' }, { nome: 'roxa', cor: '#8d4fd0' },
];
const PODERES = {
  menor: { curto: 'MENOR VENCE', desc: 'Na próxima rodada, com o mesmo elemento, o número menor vence.' },
  mais2: { curto: '+2 NA PRÓXIMA', desc: 'A sua próxima carta vale 2 a mais.' },
  apaga: { curto: 'APAGA', desc: 'Apaga uma carta que o outro ganhou (do elemento que esta carta vence).' },
};
const VARIANTES = {
  '': { titulo: 'Desafio Ninja', jogo: 'ninja', rival: 'Ninja Sombra', faixaRival: '#1c1a1f', regra: null, fundo: ['#3a2414', '#6b4426'], chao: '#c9c08a' },
  fogo: {
    titulo: 'Desafio do Fogo', jogo: 'ninja_fogo', rival: 'Ninja da Brasa', faixaRival: '#d9381a', fundo: ['#1a0505', '#7a1a08'], chao: '#2a2220',
    regra: 'Calor do vulcão: a cada rodada uma carta da mão esquenta. Se não for usada em 2 rodadas, ela queima e vira outra. Cartas de fogo valem +2.',
  },
  agua: {
    titulo: 'Desafio da Água', jogo: 'ninja_agua', rival: 'Ninja da Maré', faixaRival: '#1f6fc4', fundo: ['#0d2f3c', '#3f8d9a'], chao: '#c9b26a',
    regra: 'Correnteza: depois de cada rodada, a carta da ponta esquerda é levada pela água (se não foi ela que você jogou) e as outras escorregam. Cartas de água valem +2.',
  },
  neve: {
    titulo: 'Desafio da Neve', jogo: 'ninja_neve', rival: 'Ninja da Geada', faixaRival: '#7cc4ec', fundo: ['#0b1a3a', '#6a9ad8'], chao: '#cdeafc',
    regra: 'Geada: a cada rodada uma carta da mão congela e não pode ser jogada. Cartas de neve valem +2.',
  },
};
const L = 800;
const A = 500;
const RODADAS = 15;
const TEMPO_RODADA = 12;
const CARTA = { w: 100, h: 136 };
const MAO_Y = 422;
const maoX = i => 300 + i * 108;
const ARENA = { eu: [325, 222], ele: [475, 222] };

let contadorCarta = 0;
function novaCarta(variante) {
  const c = { id: ++contadorCarta, el: ELEMENTOS[aleatorio(3)], valor: 2 + aleatorio(11), cor: aleatorio(6), poder: null, calor: 0, congelada: false };
  if (Math.random() < 0.18) c.poder = ['menor', 'mais2', 'apaga'][aleatorio(3)];
  // O elemento do dojo aparece um pouco mais
  if (variante && Math.random() < 0.12) c.el = variante;
  return c;
}

// Três cartas que ganham o jogo: 3 do mesmo elemento com cores diferentes, ou uma de cada elemento com
// cores diferentes. Devolve as três (ou null).
export function trincaVencedora(ganhas) {
  for (const elem of ELEMENTOS) {
    const porCor = new Map();
    for (const c of ganhas) if (c.el === elem && !porCor.has(c.cor)) porCor.set(c.cor, c);
    if (porCor.size >= 3) return [...porCor.values()].slice(0, 3);
  }
  const [F, Ag, N] = ELEMENTOS.map(e => ganhas.filter(c => c.el === e));
  for (const a of F) for (const b of Ag) if (b.cor !== a.cor) for (const c of N) if (c.cor !== a.cor && c.cor !== b.cor) return [a, b, c];
  return null;
}
// Quem vence a rodada: 'eu', 'ele' ou null (empate). bonus: { eu, ele } (o +2 do poder e o do dojo).
export function quemVence(minha, dele, { menor = false, bonusEu = 0, bonusEle = 0 } = {}) {
  if (minha.el !== dele.el) return VENCE[minha.el] === dele.el ? 'eu' : 'ele';
  const a = minha.valor + bonusEu;
  const b = dele.valor + bonusEle;
  if (a === b) return null;
  return (menor ? a < b : a > b) ? 'eu' : 'ele';
}

function desenharCarta(g, c, x, y, { w = CARTA.w, h = CARTA.h, costas = false, alfa = 1, rot = 0, escalaX = 1, destaque = 0, variante = '', t = 0, bonus = 0 } = {}) {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alfa));
  g.translate(x, y);
  g.rotate(rot);
  g.scale(Math.max(0.02, Math.abs(escalaX)), 1);
  ret(g, -w / 2 + 3, -h / 2 + 5, w, h, 'rgba(0,0,0,0.35)', 9);
  if (destaque) brilho(g, 0, 0, w * 0.95, 'rgba(255,230,120,A)', 0.55 * destaque);
  if (costas) {
    ret(g, -w / 2, -h / 2, w, h, '#1c2340', 9);
    contorno(g, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, '#b8922a', 2, 7);
    g.strokeStyle = 'rgba(184,146,42,0.25)'; g.lineWidth = 1;
    for (let k = -h; k < h; k += 10) { g.beginPath(); g.moveTo(-w / 2 + 6, k); g.lineTo(w / 2 - 6, k + w * 0.6); g.stroke(); }
    el(g, 0, 4, w * 0.2, w * 0.2, '#b8922a');
    el(g, 0, 4, w * 0.15, w * 0.15, '#1c2340');
    el(g, -w * 0.05, -w * 0.2, w * 0.035, w * 0.12, '#b8922a', -0.2);
    el(g, w * 0.05, -w * 0.2, w * 0.035, w * 0.12, '#b8922a', 0.2);
    ret(g, -w * 0.15, -1, w * 0.3, 4, '#d8433a', 2);
    g.restore();
    return;
  }
  const cor = CORES_CARTA[c.cor].cor;
  ret(g, -w / 2, -h / 2, w, h, cor, 9);
  ret(g, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, '#f8eed6', 6);
  const tinta = { fogo: '#ffdcc4', agua: '#d4eaff', neve: '#eaf6ff' }[c.el];
  el(g, 0, -h * 0.04, w * 0.33, w * 0.33, tinta);
  SIMBOLO[c.el](g, 0, -h * 0.04, w * 0.25, t);
  // O número, no canto (e o bônus do dojo, se tiver)
  el(g, -w / 2 + 17, -h / 2 + 18, 14, 14, cor);
  texto(g, String(c.valor), -w / 2 + 17, -h / 2 + 19, { cor: '#fff', fonte: `700 ${c.valor >= 10 ? 15 : 18}px "Cinzel", Georgia, serif` });
  if (bonus) {
    ret(g, w / 2 - 34, -h / 2 + 9, 26, 18, '#1b1403', 5);
    texto(g, `+${bonus}`, w / 2 - 21, -h / 2 + 18, { cor: '#ffe46b', fonte: '700 12px "Cinzel", Georgia, serif' });
  }
  // A faixa de baixo: o poder ou o nome do elemento
  ret(g, -w / 2 + 5, h / 2 - 27, w - 10, 22, c.poder ? '#1b1403' : cor, 5);
  texto(g, c.poder ? PODERES[c.poder].curto : NOME_ELEMENTO[c.el].toUpperCase(), 0, h / 2 - 15.5, { cor: c.poder ? '#ffe46b' : '#fff', fonte: `700 ${c.poder ? 9 : 11}px "Cinzel", Georgia, serif` });
  if (c.poder) { el(g, w / 2 - 14, h / 2 - 38, 8, 8, '#1b1403'); texto(g, '★', w / 2 - 14, h / 2 - 37.5, { cor: '#ffe46b', fonte: '700 11px serif' }); }
  // Congelada (Dojo da Neve) ou esquentando (Dojo do Fogo)
  if (c.congelada) {
    ret(g, -w / 2, -h / 2, w, h, 'rgba(200,235,255,0.62)', 9);
    linha(g, 'rgba(255,255,255,0.9)', 2, [-w / 2 + 10, -h / 2 + 20, -4, 0, 10, 10, w / 2 - 12, h / 2 - 30]);
    linha(g, 'rgba(255,255,255,0.9)', 1.5, [-4, 0, -18, 26]);
    simboloNeve(g, w / 2 - 18, h / 2 - 18, 10, 0);
  }
  if (c.calor) {
    g.save();
    g.globalAlpha *= 0.45 + Math.sin(t * 8) * 0.15;
    ret(g, -w / 2, -h / 2, w, h, c.calor === 1 ? 'rgba(255,90,30,0.55)' : 'rgba(255,150,60,0.35)', 9);
    g.restore();
    chama(g, w / 2 - 15, -h / 2 + 22, 11, '#d9381a', Math.sin(t * 9) * 1.5);
    chama(g, w / 2 - 15, -h / 2 + 25, 7, '#ffe27a', 0);
    texto(g, String(c.calor), w / 2 - 15, -h / 2 + 44, { cor: '#fff', fonte: '700 12px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
  }
  g.restore();
}
function cartinha(g, c, x, y, w = 22, h = 30, brilhar = 0) {
  if (brilhar) brilho(g, x, y, 26, 'rgba(255,230,120,A)', 0.8 * brilhar);
  ret(g, x - w / 2, y - h / 2, w, h, CORES_CARTA[c.cor].cor, 4);
  ret(g, x - w / 2 + 2.5, y - h / 2 + 2.5, w - 5, h - 5, '#f8eed6', 3);
  SIMBOLO[c.el](g, x, y, w * 0.3, 0);
}
// O ninja do computador: um coelho de pelo escuro com a máscara e a faixa na testa.
function ninja(g, x, y, k, t, dir, corFaixa, andando = false) {
  g.save(); g.translate(x, y); g.scale(k, k);
  desenharCoelho(g, 0, 0, { pelo: '#3a3440', dir, t, andando, passo: t, semSprite: true });
  g.scale(dir, 1);
  const pulo = andando ? 0 : Math.sin(t * 2) * 0.6;
  g.translate(0, -pulo);
  el(g, 0, -13, 15.4, 11.6, '#1f1b26');
  ret(g, -14, -12, 28, 3.5, corFaixa, 1);
  el(g, 11, -27, 9.8, 9.3, '#1f1b26');
  ret(g, 9, -31, 12.5, 5, '#3a3440', 2);
  el(g, 15, -28.6, 1.8, 2, '#fff7c0');
  el(g, 15.4, -28.6, 0.9, 1.2, '#1b1403');
  ret(g, 1.5, -35, 20, 3.6, corFaixa, 1);
  const o = Math.sin(t * 6) * 2;
  linha(g, corFaixa, 2.4, [2, -33, -8, -36 + o, -15, -31 - o]);
  linha(g, corFaixa, 2, [2, -33, -9, -30 + o, -14, -26 + o]);
  g.restore();
}
// O coelho de quem joga, com a faixa que já ganhou.
function coelhoComFaixa(g, x, y, k, t, visual, faixa) {
  g.save(); g.translate(x, y); g.scale(k, k);
  desenharCoelho(g, 0, 0, { pelo: visual.cor, roupa: visual.roupa, dir: 1, t });
  if (faixa > 0) {
    const pulo = Math.sin(t * 2) * 0.6;
    ret(g, -14, -12 - pulo, 28, 3.5, FAIXAS[faixa].cor, 1);
    ret(g, 8, -12 - pulo, 3.5, 8, FAIXAS[faixa].cor, 1);
  }
  g.restore();
}

export function abrirDesafioNinja({ visual = { cor: '#e9dcc3', roupa: {} }, variante = '', faixa = 0, terminar, comecar = async () => null, subirFaixa = async () => ({ faixa, subiu: false }) }) {
  const V = VARIANTES[variante] || VARIANTES[''];
  const nivelRival = Math.min(1, (faixa + (variante ? 3 : 0)) / 10);
  let faixaAgora = faixa;
  return abrirJanela({
    titulo: V.titulo, largura: L, altura: A, classe: 'ilha-seg-ninja', terminar,
    montar(api) {
      let e;
      let mouse = null;
      const bonusDoDojo = c => (variante && c.el === variante ? 2 : 0);
      const novoLado = () => ({ mao: Array.from({ length: 5 }, () => novaCarta(variante)), ganhas: [], mais2: 0, mais2Agora: 0 });
      function novo() {
        e = {
          fase: 'inicio', rodada: 1, eu: novoLado(), ele: novoLado(), menor: false, menorAgora: false, tempo: TEMPO_RODADA, anim: 0,
          jogada: null, vencedor: null, msg: '', sub: '', part: [], textos: [], sel: 2, trinca: null, ficha: null, tremor: 0, levada: null,
        };
        api.caixa(
          h('h2', null, V.titulo),
          h('p', null, 'Escolha uma carta por rodada. ', h('strong', null, 'Fogo vence neve, neve vence água, água vence fogo.'), ' Com o mesmo elemento, vence o número maior.'),
          h('p', null, 'Ganhe juntando 3 cartas do mesmo elemento de cores diferentes, ou uma de cada elemento, também de cores diferentes.'),
          h('p', { class: 'suave' }, 'Cartas com ★ têm poder quando vencem: menor vence, +2 na próxima ou apagar uma carta do outro.'),
          V.regra && h('p', { class: 'ilha-seg-regra' }, V.regra),
          faixaEl(faixaAgora, faixaAgora ? `Você tem a ${nomeDaFaixa(faixaAgora)}. Vencer sobe uma faixa.` : 'Vença para ganhar a faixa branca!'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecarPartida }));
      }
      function comecarPartida() {
        api.esconder();
        e.ficha = null;
        comecar().then(f => { if (e) e.ficha = f; }).catch(() => {});
        comecarRodada();
      }
      api.reiniciar = () => { novo(); comecarPartida(); };

      /* ─── Rodadas ─── */
      function comecarRodada() {
        e.fase = 'escolher';
        e.tempo = TEMPO_RODADA;
        e.anim = 0;
        e.jogada = null;
        e.vencedor = null;
        e.menorAgora = e.menor;
        e.menor = false;
        for (const lado of [e.eu, e.ele]) {
          for (const c of lado.mao) c.congelada = false;
          if (variante === 'neve') lado.mao[aleatorio(lado.mao.length)].congelada = true;
          if (variante === 'fogo') {
            const frias = lado.mao.filter(c => !c.calor);
            if (frias.length) frias[aleatorio(frias.length)].calor = 3;
          }
        }
        if (e.eu.mao[e.sel]?.congelada) e.sel = e.eu.mao.findIndex(c => !c.congelada);
        e.msg = e.menorAgora ? 'Nesta rodada, com o mesmo elemento, o MENOR vence!' : '';
      }
      function escolher(i) {
        if (e.fase !== 'escolher' || !e.eu.mao[i]) return;
        if (e.eu.mao[i].congelada) { e.tremor = 0.4; e.textos.push({ x: maoX(i), y: MAO_Y - 80, t: 'Congelada!', cor: '#bfe8ff', vida: 1 }); som('bater'); return; }
        const j = escolhaDoRival();
        e.jogada = { iEu: i, iEle: j, eu: e.eu.mao[i], ele: e.ele.mao[j] };
        e.fase = 'revelar';
        e.anim = 0;
        som('pulo');
      }
      // O ninja do computador: quer completar a trinca dele, atrapalhar a sua e usar as cartas fortes.
      function escolhaDoRival() {
        const opcoes = e.ele.mao.map((c, i) => ({ c, i })).filter(o => !o.c.congelada);
        const perigo = ELEMENTOS.filter(x => CORES_CARTA.some((_, cor) => trincaVencedora([...e.eu.ganhas, { el: x, cor }])));
        let melhor = null;
        for (const { c, i } of opcoes) {
          let s = 0;
          if (trincaVencedora([...e.ele.ganhas, c])) s += 5;
          else {
            if (!e.ele.ganhas.some(k => k.el === c.el && k.cor === c.cor)) s += 1;
            if (!e.ele.ganhas.some(k => k.el === c.el)) s += 0.5;
          }
          s += (c.valor + bonusDoDojo(c)) / 12 * 1.5;
          if (perigo.some(x => VENCE[c.el] === x)) s += 1.6 * nivelRival;
          if (c.poder) s += 0.4;
          if (c.calor === 1) s += 0.9;
          if (variante === 'agua' && i === 0) s += 0.7;
          s += (Math.random() - 0.5) * (3.6 - nivelRival * 2.6);
          if (!melhor || s > melhor.s) melhor = { i, s };
        }
        return melhor ? melhor.i : 0;
      }
      function resolver() {
        const { eu: minha, ele: dele } = e.jogada;
        const bonusEu = bonusDoDojo(minha) + e.eu.mais2;
        const bonusEle = bonusDoDojo(dele) + e.ele.mais2;
        e.eu.mais2Agora = e.eu.mais2; e.ele.mais2Agora = e.ele.mais2;
        e.eu.mais2 = 0; e.ele.mais2 = 0;
        const v = quemVence(minha, dele, { menor: e.menorAgora, bonusEu, bonusEle });
        e.vencedor = v;
        if (!v) {
          e.msg = 'Empate!';
          e.sub = minha.el === dele.el ? 'Mesmo elemento e mesmo valor.' : '';
          explosao(400, ARENA.eu[1], 'empate');
          som('bater');
          return;
        }
        const carta = v === 'eu' ? minha : dele;
        const outra = v === 'eu' ? dele : minha;
        const [px, py] = v === 'eu' ? ARENA.ele : ARENA.eu;
        if (carta.el !== outra.el) {
          e.msg = `${NOME_ELEMENTO[carta.el]} ${VERBO[carta.el]} ${NOME_ELEMENTO[outra.el].toLowerCase()}!`;
          e.sub = '';
        } else {
          const a = carta.valor + (v === 'eu' ? bonusEu : bonusEle);
          const b = outra.valor + (v === 'eu' ? bonusEle : bonusEu);
          e.msg = `${a} contra ${b}: ${e.menorAgora ? 'o menor' : 'o maior'} vence!`;
          e.sub = `As duas são de ${NOME_ELEMENTO[carta.el].toLowerCase()}.`;
        }
        explosao(px, py, carta.el);
        som(v === 'eu' ? 'moeda' : 'pisao');
      }
      function aplicarPoder(quem, carta) {
        const lado = e[quem];
        const outro = e[quem === 'eu' ? 'ele' : 'eu'];
        const [tx, ty] = quem === 'eu' ? [130, 245] : [670, 245];
        if (carta.poder === 'menor') { e.menor = true; e.textos.push({ x: tx, y: ty, t: 'Próxima: menor vence!', cor: '#ffe46b', vida: 1.6 }); }
        if (carta.poder === 'mais2') { lado.mais2 = 2; e.textos.push({ x: tx, y: ty, t: '+2 na próxima!', cor: '#ffe46b', vida: 1.6 }); }
        if (carta.poder === 'apaga') {
          const alvo = [...outro.ganhas].reverse().find(k => k.el === VENCE[carta.el]);
          if (alvo) {
            outro.ganhas.splice(outro.ganhas.indexOf(alvo), 1);
            e.textos.push({ x: tx, y: ty, t: `Apagou uma carta de ${NOME_ELEMENTO[alvo.el].toLowerCase()}!`, cor: '#ff9a9a', vida: 1.8 });
            som('quebra');
          } else e.textos.push({ x: tx, y: ty, t: 'Nada para apagar.', cor: '#cfc4a2', vida: 1.2 });
        }
      }
      function recolher() {
        const { iEu, iEle, eu: minha, ele: dele } = e.jogada;
        if (e.vencedor) {
          const carta = e.vencedor === 'eu' ? minha : dele;
          e[e.vencedor].ganhas.push({ ...carta, calor: 0, congelada: false });
          if (carta.poder) aplicarPoder(e.vencedor, carta);
        }
        for (const [lado, i] of [[e.eu, iEu], [e.ele, iEle]]) {
          if (variante === 'agua') {
            lado.mao.splice(i, 1);
            if (i !== 0) {
              const levada = lado.mao.shift();
              if (lado === e.eu && levada) { e.levada = { c: levada, f: 0 }; e.textos.push({ x: maoX(0), y: MAO_Y - 84, t: 'A correnteza levou!', cor: '#9fdcff', vida: 1.4 }); som('agua'); }
            }
            while (lado.mao.length < 5) lado.mao.push(novaCarta(variante));
          } else {
            lado.mao[i] = novaCarta(variante);
          }
          if (variante === 'fogo') {
            lado.mao.forEach((c, k) => {
              if (!c.calor) return;
              c.calor--;
              if (c.calor <= 0) {
                lado.mao[k] = novaCarta(variante);
                if (lado === e.eu) { explosao(maoX(k), MAO_Y, 'fogo', 18); e.textos.push({ x: maoX(k), y: MAO_Y - 84, t: 'Queimou!', cor: '#ffb070', vida: 1.3 }); }
              }
            });
          }
        }
        const minhaTrinca = trincaVencedora(e.eu.ganhas);
        const delaTrinca = trincaVencedora(e.ele.ganhas);
        if (minhaTrinca || delaTrinca) {
          e.trinca = { quem: minhaTrinca ? 'eu' : 'ele', cartas: minhaTrinca || delaTrinca };
          e.fase = 'vitoria';
          e.anim = 0;
          e.msg = minhaTrinca ? 'Você venceu!' : `${V.rival} venceu!`;
          e.sub = '';
          som(minhaTrinca ? 'fase' : 'morte');
          return;
        }
        e.rodada++;
        if (e.rodada > RODADAS) {
          const a = e.eu.ganhas.length;
          const b = e.ele.ganhas.length;
          e.trinca = { quem: a > b ? 'eu' : a < b ? 'ele' : null, cartas: [] };
          e.fase = 'vitoria';
          e.anim = 0;
          e.msg = a > b ? 'Acabaram as rodadas: você tem mais cartas!' : a < b ? 'Acabaram as rodadas: o ninja tem mais cartas.' : 'Acabaram as rodadas: empate!';
          e.sub = '';
          return;
        }
        comecarRodada();
      }
      async function acabar() {
        e.fase = 'fim';
        const venceu = e.trinca?.quem === 'eu';
        const empate = e.trinca?.quem == null;
        const pontos = Math.min(25, e.eu.ganhas.length + (venceu ? 10 : 0));
        let extraFim = null;
        if (venceu) {
          const r = await subirFaixa(e.ficha);
          if (r?.subiu) { faixaAgora = r.faixa; extraFim = faixaEl(faixaAgora, `O Sensei lhe dá a ${nomeDaFaixa(faixaAgora)}!`); som('vida'); } else if ((r?.faixa ?? faixaAgora) >= FAIXA_MAX) extraFim = faixaEl(FAIXA_MAX, 'Você já é faixa preta: o maior ninja da ilha!');
          else extraFim = h('p', { class: 'suave' }, 'A faixa não subiu desta vez: o Sensei dá uma faixa por minuto, sempre depois de uma partida inteira.');
        }
        if (api.parado) return;
        api.terminar(V.jogo, pontos, [venceu ? 'Você venceu o desafio!' : empate ? 'Empate!' : `${V.rival} venceu desta vez.`, `${e.eu.ganhas.length} ${e.eu.ganhas.length === 1 ? 'carta conquistada' : 'cartas conquistadas'}`], extraFim);
      }

      /* ─── Efeitos ─── */
      function explosao(x, y, tipo, n = 34) {
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 60 + Math.random() * 160;
          const p = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.7 + Math.random() * 0.7, r: 3 + Math.random() * 4, tipo };
          p.max = p.vida;
          if (tipo === 'fogo') { p.vy = -Math.abs(p.vy) * 0.8; p.cor = ['#ffe27a', '#f5892a', '#d9381a'][k % 3]; }
          if (tipo === 'agua') { p.vy -= 80; p.cor = ['#7fd0ff', '#bfeaff', '#2f8ad8'][k % 3]; }
          if (tipo === 'neve') { p.vx *= 0.6; p.vy *= 0.6; p.cor = '#ffffff'; }
          if (tipo === 'empate') { p.cor = ['#cfc4a2', '#ffffff'][k % 2]; p.vida *= 0.6; p.max = p.vida; }
          e.part.push(p);
        }
      }

      /* ─── Entrada ─── */
      function cartaNoPonto(x, y) {
        for (let i = 0; i < e.eu.mao.length; i++) if (Math.abs(x - maoX(i)) < CARTA.w / 2 && Math.abs(y - MAO_Y) < CARTA.h / 2 + 10) return i;
        return -1;
      }
      api.ouvir(api.tela, 'pointerdown', ev => { const p = api.ponto(ev); const i = cartaNoPonto(p.x, p.y); if (i >= 0) { e.sel = i; escolher(i); } });
      api.ouvir(api.tela, 'pointermove', ev => { mouse = ev.pointerType === 'mouse' ? api.ponto(ev) : null; });
      api.ouvir(api.tela, 'pointerleave', () => { mouse = null; });
      api.ouvir(document, 'keydown', ev => {
        if (!e || e.fase !== 'escolher' || !api.sobre.hidden) return;
        if (/^Digit[1-5]$/.test(ev.code)) { ev.preventDefault(); e.sel = Number(ev.code.slice(5)) - 1; escolher(e.sel); }
        else if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { ev.preventDefault(); e.sel = (e.sel + 4) % 5; }
        else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { ev.preventDefault(); e.sel = (e.sel + 1) % 5; }
        else if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); escolher(e.sel); }
      });
      novo();

      /* ─── Laço ─── */
      function atualizar(dt) {
        e.anim += dt;
        e.tremor = Math.max(0, e.tremor - dt);
        if (e.fase === 'escolher') {
          e.tempo -= dt;
          if (e.tempo <= 0) {
            const livres = e.eu.mao.map((c, i) => i).filter(i => !e.eu.mao[i].congelada);
            e.textos.push({ x: 400, y: 330, t: 'O tempo acabou: uma carta foi escolhida!', cor: '#ffb070', vida: 1.4 });
            escolher(livres[aleatorio(livres.length)]);
          }
        } else if (e.fase === 'revelar' && e.anim >= 0.7) { e.fase = 'choque'; e.anim = 0; resolver(); }
        else if (e.fase === 'choque' && e.anim >= 1.5) { e.fase = 'recolher'; e.anim = 0; }
        else if (e.fase === 'recolher' && e.anim >= 0.7) recolher();
        else if (e.fase === 'vitoria' && e.anim >= 2.2) acabar();
        for (const p of e.part) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt;
          if (p.tipo === 'agua') p.vy += 420 * dt;
          if (p.tipo === 'fogo') p.vy -= 60 * dt;
          if (p.tipo === 'neve') { p.vx *= 0.96; p.vy *= 0.96; }
        }
        e.part = e.part.filter(p => p.vida > 0);
        for (const tx of e.textos) { tx.vida -= dt; tx.y -= 22 * dt; }
        e.textos = e.textos.filter(tx => tx.vida > 0);
        if (e.levada) { e.levada.f += dt / 0.9; if (e.levada.f >= 1) e.levada = null; }
      }

      function desenharFundo(g, t) {
        g.fillStyle = grad(g, 0, 0, 0, A, [[0, V.fundo[0]], [0.62, V.fundo[1]], [0.62, V.chao], [1, V.chao]]);
        g.fillRect(0, 0, L, A);
        if (variante === 'fogo') {
          forma(g, '#2a1410', [250, 310, 380, 140, 420, 140, 550, 310]);
          el(g, 400, 142, 26, 6, '#ff7a2a');
          brilho(g, 400, 140, 80, 'rgba(255,120,40,A)', 0.35 + Math.sin(t * 2) * 0.08);
          for (let k = 0; k < 18; k++) { const f = (t * 0.3 + k / 18) % 1; el(g, (k * 97) % L, A - f * A, 2, 2, `rgba(255,${120 + (k % 3) * 40},40,${1 - f})`); }
        } else if (variante === 'agua') {
          g.fillStyle = 'rgba(200,240,255,0.35)';
          g.fillRect(330, 0, 140, 310);
          for (let k = 0; k < 10; k++) { const f = (t * 1.5 + k * 0.31) % 1; ret(g, 336 + k * 13, f * 330 - 30, 3, 30, 'rgba(255,255,255,0.5)', 1.5); }
        } else if (variante === 'neve') {
          for (let k = 0; k < 8; k++) el(g, ((k * 130 + t * 12) % (L + 200)) - 100, 270 + (k % 3) * 14, 80, 20, 'rgba(255,255,255,0.6)');
          for (let k = 0; k < 40; k++) { const f = (t * 0.2 + k / 40) % 1; el(g, (k * 53 + Math.sin(t + k) * 20) % L, f * A, 1.8, 1.8, 'rgba(255,255,255,0.8)'); }
        } else {
          for (let x = 0; x < L; x += 34) { g.fillStyle = x % 68 ? 'rgba(0,0,0,0.08)' : 'rgba(255,220,170,0.05)'; g.fillRect(x, 0, 34, 310); }
          ret(g, 0, 0, L, 18, '#24150b');
          ret(g, 0, 300, L, 10, '#2e1b0e');
        }
        // O tablado das cartas
        g.strokeStyle = 'rgba(192,57,43,0.7)'; g.lineWidth = 5;
        g.beginPath(); g.ellipse(400, 300, 170, 30, 0, 0, Math.PI * 2); g.stroke();
      }
      function desenharGanhas(g, lado, x0, y0, t) {
        ret(g, x0, y0, 228, 112, 'rgba(10,8,14,0.55)', 10);
        ELEMENTOS.forEach((elem, k) => {
          const cx = x0 + 40 + k * 74;
          SIMBOLO[elem](g, cx, y0 + 16, 9, t);
          const lista = lado.ganhas.filter(c => c.el === elem);
          lista.slice(-6).forEach((c, j) => {
            const brilha = e.trinca?.cartas.some(q => q.id === c.id) ? 0.6 + Math.sin(t * 6) * 0.4 : 0;
            cartinha(g, c, cx - 14 + (j % 2) * 28, y0 + 44 + Math.floor(j / 2) * 24, 22, 30, brilha);
          });
        });
      }
      function desenhar(t) {
        const g = api.g;
        desenharFundo(g, t);
        // Os dois coelhos
        coelhoComFaixa(g, 96, 300, 2.5, t, visual, faixaAgora);
        ninja(g, 704, 300, 2.5, t, -1, V.faixaRival);
        texto(g, V.rival, 704, 318, { cor: '#fbf3e0', fonte: '700 14px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
        // Em cima: rodada, a mão do ninja e o que ele ganhou
        ret(g, 8, 8, 180, 52, 'rgba(10,8,14,0.55)', 10);
        texto(g, `Rodada ${Math.min(e.rodada, RODADAS)} de ${RODADAS}`, 98, 26, { cor: '#e8c24a', fonte: '700 15px "Cinzel", Georgia, serif' });
        texto(g, V.titulo, 98, 46, { cor: '#cfc4a2', fonte: '700 11px "Cinzel", Georgia, serif' });
        e.ele.mao.forEach((c, i) => {
          const jogada = e.jogada && e.jogada.iEle === i && e.fase !== 'escolher';
          if (!jogada) desenharCarta(g, c, 270 + i * 54, 52, { w: 44, h: 60, costas: true });
        });
        desenharGanhas(g, e.ele, 564, 8, t);
        // Embaixo: o que eu ganhei
        desenharGanhas(g, e.eu, 8, 368, t);
        // O tempo da rodada
        if (e.fase === 'escolher') {
          const f = Math.max(0, e.tempo / TEMPO_RODADA);
          ret(g, 250, 340, 540, 8, 'rgba(0,0,0,0.4)', 4);
          ret(g, 250, 340, 540 * f, 8, f < 0.3 ? '#ff7a5a' : '#e8c24a', 4);
          texto(g, 'Escolha uma carta', 520, 326, { cor: '#fbf3e0', fonte: '700 14px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
        }
        // A minha mão
        const tremor = e.tremor ? Math.sin(e.tremor * 60) * 4 : 0;
        e.eu.mao.forEach((c, i) => {
          if (e.jogada && e.jogada.iEu === i && e.fase !== 'escolher') return;
          const sobre = e.fase === 'escolher' && ((mouse && Math.abs(mouse.x - maoX(i)) < CARTA.w / 2 && Math.abs(mouse.y - MAO_Y) < CARTA.h / 2) || (!mouse && e.sel === i));
          desenharCarta(g, c, maoX(i) + (c.congelada ? tremor : 0), MAO_Y - (sobre ? 12 : 0), { destaque: sobre ? 1 : 0, bonus: bonusDoDojo(c), t });
        });
        if (e.levada) {
          const f = e.levada.f;
          desenharCarta(g, e.levada.c, maoX(0) - 60 - f * 200, MAO_Y + f * 60, { alfa: 1 - f, rot: -f * 0.8, t });
          for (let k = 0; k < 5; k++) el(g, maoX(0) - 80 - f * 180 + k * 14, MAO_Y + 70, 10 * (1 - f) + 2, 4, 'rgba(160,220,255,0.6)');
        }
        // As cartas jogadas: voam para o meio, viram, batem e a vencedora vai para quem ganhou
        if (e.jogada && e.fase !== 'escolher') {
          const { eu: minha, ele: dele, iEu, iEle } = e.jogada;
          let pe;
          let pd;
          let virar = 1;
          let alfaPerde = 1;
          if (e.fase === 'revelar') {
            const f = suave(e.anim / 0.7);
            pe = [maoX(iEu) + (ARENA.eu[0] - maoX(iEu)) * f, MAO_Y + (ARENA.eu[1] - MAO_Y) * f];
            pd = [270 + iEle * 54 + (ARENA.ele[0] - 270 - iEle * 54) * f, 52 + (ARENA.ele[1] - 52) * f];
            virar = Math.cos(Math.PI * (1 - f));
          } else if (e.fase === 'choque') {
            const bate = Math.sin(Math.min(1, e.anim / 0.35) * Math.PI) * 22;
            pe = [ARENA.eu[0] + bate, ARENA.eu[1]];
            pd = [ARENA.ele[0] - bate, ARENA.ele[1]];
          } else {
            pe = [...ARENA.eu];
            pd = [...ARENA.ele];
            const f = suave(e.anim / 0.7);
            alfaPerde = 1 - f;
            if (e.vencedor) {
              const destino = e.vencedor === 'eu' ? [120, 430] : [680, 70];
              const de = e.vencedor === 'eu' ? pe : pd;
              de[0] += (destino[0] - de[0]) * f;
              de[1] += (destino[1] - de[1]) * f;
            }
          }
          const escalaV = e.fase === 'recolher' && e.vencedor ? 1 - suave(e.anim / 0.7) * 0.7 : 1;
          for (const [c, p, quem] of [[minha, pe, 'eu'], [dele, pd, 'ele']]) {
            const ganhou = e.vencedor === quem;
            const perdeu = e.vencedor && !ganhou;
            const giro = quem === 'ele' ? virar : 1;
            const verso = e.fase === 'revelar' && giro < 0;
            const alfa = e.fase === 'recolher' && (perdeu || !e.vencedor) ? alfaPerde : 1;
            const k = ganhou ? escalaV : 1;
            desenharCarta(g, c, p[0], p[1], { costas: verso, escalaX: giro, w: CARTA.w * k, h: CARTA.h * k, alfa, destaque: ganhou && e.fase === 'choque' ? 1 : 0, bonus: bonusDoDojo(c), t });
            // O efeito do elemento vencedor em cima da carta que perdeu
            if (perdeu && e.fase !== 'revelar') efeitoNaCarta(g, e.jogada[e.vencedor].el, p[0], p[1], e.fase === 'choque' ? e.anim : 1.5 + e.anim, alfa);
          }
          if (e.fase !== 'revelar' && e.msg) {
            ret(g, 230, 106, 340, e.sub ? 46 : 32, 'rgba(10,8,14,0.72)', 10);
            texto(g, e.msg, 400, 122, { cor: '#ffe46b', fonte: '700 18px "Cinzel", Georgia, serif' });
            if (e.sub) texto(g, e.sub, 400, 142, { cor: '#cfc4a2', fonte: '13px "EB Garamond", Georgia, serif' });
          }
        } else if (e.fase === 'escolher' && e.msg) {
          ret(g, 230, 196, 340, 32, 'rgba(10,8,14,0.72)', 10);
          texto(g, e.msg, 400, 212, { cor: '#ffe46b', fonte: '700 14px "Cinzel", Georgia, serif' });
        }
        if (e.fase === 'vitoria') {
          const f = Math.min(1, e.anim / 0.5);
          ret(g, 180, 170, 440, 80, `rgba(10,8,14,${0.8 * f})`, 14);
          texto(g, e.msg, 400, 200, { cor: `rgba(255,228,107,${f})`, fonte: '700 24px "Cinzel", Georgia, serif' });
          if (e.trinca?.cartas.length) e.trinca.cartas.forEach((c, k) => cartinha(g, c, 360 + k * 40, 232, 30, 40 * Math.min(1, f * 1.2) + 0.1, 0.6 + Math.sin(t * 6) * 0.4));
        }
        // Partículas e textos
        for (const p of e.part) {
          const a = Math.max(0, p.vida / p.max);
          if (p.tipo === 'neve') simboloNeve(g, p.x, p.y, p.r * 1.4, t);
          else el(g, p.x, p.y, p.r * (0.5 + a * 0.5), p.r * (0.5 + a * 0.5), p.cor);
        }
        for (const tx of e.textos) texto(g, tx.t, tx.x, tx.y, { cor: tx.cor, fonte: '700 15px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.7)' });
        if (e.eu.mais2) texto(g, '+2 na próxima', 96, 182, { cor: '#ffe46b', fonte: '700 12px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
        if (e.ele.mais2) texto(g, '+2 na próxima', 704, 182, { cor: '#ffe46b', fonte: '700 12px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
      }
      // O elemento que venceu agindo na carta que perdeu: chamas, uma onda ou o gelo.
      function efeitoNaCarta(g, elem, x, y, tt, alfa) {
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, alfa));
        const f = Math.min(1, tt / 0.6);
        if (elem === 'fogo') {
          for (let k = 0; k < 5; k++) chama(g, x - 36 + k * 18, y + 60 - f * 50, 16 + f * 18 + Math.sin(tt * 12 + k) * 4, k % 2 ? '#f5892a' : '#d9381a', Math.sin(tt * 10 + k) * 3);
          ret(g, x - 50, y - 68, 100, 136, `rgba(30,10,5,${0.5 * f})`, 9);
        } else if (elem === 'agua') {
          g.fillStyle = `rgba(60,150,230,${0.55 * f})`;
          g.beginPath();
          g.moveTo(x - 60, y + 70);
          const crista = y + 70 - f * 150;
          g.quadraticCurveTo(x - 50, crista - 10, x + 10 + Math.sin(tt * 8) * 6, crista);
          g.quadraticCurveTo(x + 50, crista + 20, x + 60, y + 70);
          g.closePath();
          g.fill();
          for (let k = 0; k < 6; k++) el(g, x - 40 + k * 16, crista + 6 + Math.sin(tt * 10 + k) * 4, 5, 3, 'rgba(255,255,255,0.8)');
        } else {
          ret(g, x - 54, y - 72, 108, 144, `rgba(190,230,255,${0.6 * f})`, 10);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + 0.3;
            forma(g, `rgba(255,255,255,${0.85 * f})`, [x + Math.cos(a) * 30, y + Math.sin(a) * 40, x + Math.cos(a) * (40 + f * 30), y + Math.sin(a) * (50 + f * 30), x + Math.cos(a + 0.15) * 34, y + Math.sin(a + 0.15) * 44]);
          }
          simboloNeve(g, x, y, 24 * f, tt);
        }
        g.restore();
      }

      return {
        passo(dt, t) {
          if (['escolher', 'revelar', 'choque', 'recolher', 'vitoria'].includes(e.fase) && api.sobre.hidden) atualizar(dt);
          else if (e.fase === 'fim') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ═══════════════ Missão do dia (QG) ═══════════════ */

const ML = 640;
const MA = 420;
const TEMPO_MISSAO = 75;
const ETAPAS = { cifra: 'Mensagem cifrada', fios: 'Desarme a armadilha', diferencas: 'Ache as diferenças' };
const FRASES = ['O RAPOSO ESTA NO FAROL', 'POMPONS NA MINA DE OURO', 'CENOURAS ESCONDIDAS NO PORAO', 'ENCONTRO SECRETO NO DOJO', 'ALERTA NO ICEBERG', 'PIZZA DE CENOURA AS SEIS', 'O CAPITAO VOLTOU', 'SENHA DA GUARDA E TOCA', 'PEGADAS DE RAPOSA NA NEVE'];
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const cifrar = (frase, k) => frase.replace(/[A-Z]/g, l => ABC[(ABC.indexOf(l) + k + 26 * 4) % 26]);

const CORES_FIO = [['vermelho', '#d8433a'], ['azul', '#3f7fd8'], ['amarelo', '#f2c63a'], ['verde', '#43a047'], ['branco', '#f4f1ea'], ['preto', '#26262b']];
// Fios e a regra do manual (a resposta é sempre um fio só).
export function gerarFios() {
  for (;;) {
    const n = 4 + aleatorio(3);
    const fios = Array.from({ length: n }, () => aleatorio(6));
    const conta = c => fios.filter(f => f === c).length;
    const nome = c => CORES_FIO[c][0];
    const regras = [];
    for (let c = 0; c < 6; c++) {
      if (conta(c) === 1) {
        regras.push({ texto: `Corte o único fio ${nome(c)}.`, certo: fios.indexOf(c) });
        if (fios.indexOf(c) < n - 1) regras.push({ texto: `Corte o fio logo abaixo do fio ${nome(c)}.`, certo: fios.indexOf(c) + 1 }, { texto: `Corte o fio logo abaixo do fio ${nome(c)}.`, certo: fios.indexOf(c) + 1 });
      }
      if (conta(c) >= 2) regras.push({ texto: `Corte o último fio ${nome(c)} (contando de cima para baixo).`, certo: fios.lastIndexOf(c) }, { texto: `Corte o último fio ${nome(c)} (contando de cima para baixo).`, certo: fios.lastIndexOf(c) });
    }
    for (let i = 1; i < n - 1; i++) {
      if (conta(fios[i - 1]) === 1 && conta(fios[i + 1]) === 1 && fios[i - 1] !== fios[i + 1]) regras.push({ texto: `Corte o fio que fica entre o ${nome(fios[i - 1])} e o ${nome(fios[i + 1])}.`, certo: i });
    }
    regras.push({ texto: 'Se houver mais de um fio vermelho, corte o último vermelho. Se não, corte o fio de baixo.', certo: conta(0) >= 2 ? fios.lastIndexOf(0) : n - 1 });
    const r = regras[aleatorio(regras.length)];
    if (r) return { fios, ...r };
  }
}

const TIPOS_ITEM = ['cenoura', 'pompom', 'estrela', 'caixa', 'livro', 'xicara', 'flor', 'lua'];
const CORES_ITEM = ['#e07a2a', '#f29bbd', '#7fb8f0', '#f2d04a', '#7fd08a', '#b58ae8', '#d8433a', '#f4f1ea'];
// A cena das diferenças: 9 coisas em 3 prateleiras; a da direita tem 3 diferenças.
export function gerarDiferencas() {
  const itens = [];
  for (let fila = 0; fila < 3; fila++) for (let col = 0; col < 3; col++) {
    itens.push({ tipo: TIPOS_ITEM[aleatorio(TIPOS_ITEM.length)], cor: CORES_ITEM[aleatorio(CORES_ITEM.length)], x: 50 + col * 95 + aleatorio(16) - 8, y: 92 + fila * 96, k: 1 });
  }
  const direita = itens.map(i => ({ ...i }));
  const escolhidos = embaralhar(itens.map((_, i) => i)).slice(0, 3);
  const mudancas = embaralhar(['cor', 'some', 'tipo', 'tam']).slice(0, 3);
  escolhidos.forEach((i, k) => {
    const d = direita[i];
    if (mudancas[k] === 'cor') d.cor = CORES_ITEM.filter(c => c !== d.cor)[aleatorio(CORES_ITEM.length - 1)];
    if (mudancas[k] === 'some') d.some = true;
    if (mudancas[k] === 'tipo') d.tipo = TIPOS_ITEM.filter(c => c !== d.tipo)[aleatorio(TIPOS_ITEM.length - 1)];
    if (mudancas[k] === 'tam') d.k = 1.45;
  });
  return { esquerda: itens, direita, difs: escolhidos.map(i => ({ i, achou: false })) };
}
function desenharItem(g, it, ox, oy) {
  if (it.some) return;
  const x = ox + it.x;
  const y = oy + it.y;
  const k = it.k;
  g.save(); g.translate(x, y); g.scale(k, k);
  if (it.tipo === 'cenoura') { forma(g, it.cor, [-8, -14, 8, -14, 0, 16]); for (const r of [-0.4, 0, 0.4]) el(g, Math.sin(r) * 6, -19, 3, 7, '#4f8a3c', r); }
  else if (it.tipo === 'pompom') { el(g, 0, 0, 14, 13, it.cor); for (let a = 0; a < 6.28; a += 0.8) el(g, Math.cos(a) * 12, Math.sin(a) * 11, 4.5, 4.5, it.cor); el(g, -4, -2, 2, 2.6, '#1b1403'); el(g, 4, -2, 2, 2.6, '#1b1403'); }
  else if (it.tipo === 'estrela') { g.fillStyle = it.cor; g.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j / 10) * Math.PI * 2; const d = j % 2 ? 7 : 16; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); g.fill(); }
  else if (it.tipo === 'caixa') caixaRoxa(g, -3, 14, 26, 0, it.cor);
  else if (it.tipo === 'livro') { ret(g, -12, -16, 24, 30, it.cor, 3); ret(g, -9, -13, 3, 24, 'rgba(255,255,255,0.4)'); ret(g, -4, -8, 12, 3, 'rgba(0,0,0,0.3)'); }
  else if (it.tipo === 'xicara') { ret(g, -11, -8, 20, 18, it.cor, 4); g.strokeStyle = it.cor; g.lineWidth = 3; g.beginPath(); g.arc(11, 1, 5, -1.4, 1.4); g.stroke(); el(g, -1, 12, 16, 3, '#cfc4a2'); }
  else if (it.tipo === 'flor') { linha(g, '#4f8a3c', 3, [0, 16, 0, -2]); for (let a = 0; a < 6.28; a += 1.256) el(g, Math.cos(a) * 7, -6 + Math.sin(a) * 7, 5, 5, it.cor); el(g, 0, -6, 4, 4, '#f2d04a'); }
  else if (it.tipo === 'lua') { el(g, 0, 0, 14, 14, it.cor); el(g, 6, -4, 12, 12, '#3a2a4a'); }
  g.restore();
}

export function abrirMissao({ visual = { cor: '#e9dcc3', roupa: {} }, terminar }) {
  return abrirJanela({
    titulo: 'Missão do dia', largura: ML, altura: MA, classe: 'ilha-seg-missao', terminar,
    montar(api) {
      let m;
      let flash = null;
      function novo() {
        m = { situacao: 'inicio', etapas: embaralhar(Object.keys(ETAPAS)), k: 0, tempo: TEMPO_MISSAO, pontos: 0, feitas: 0, etapa: null, textos: [], pausa: 0 };
        api.caixa(
          h('h2', null, 'Missão do dia'),
          h('p', null, 'Agente, o Raposo aprontou de novo! Resolva as três etapas antes do tempo acabar.'),
          h('p', { class: 'suave' }, 'Decifre a mensagem girando a roda, corte o fio que o manual manda e ache as três diferenças. Errar custa segundos.'),
          botao('Aceitar a missão', { classe: 'btn-ouro', icone: 'frente', onclick: () => { m.situacao = 'jogando'; prepararEtapa(); api.esconder(); } }));
      }
      api.reiniciar = () => { novo(); m.situacao = 'jogando'; prepararEtapa(); api.esconder(); };
      function prepararEtapa() {
        const tipo = m.etapas[m.k];
        if (tipo === 'cifra') {
          const frase = FRASES[aleatorio(FRASES.length)];
          const chave = 3 + aleatorio(8);
          m.etapa = { tipo, frase, chave, codigo: cifrar(frase, chave), giro: aleatorio(26), ok: false };
          if (m.etapa.giro === chave) m.etapa.giro = (chave + 5) % 26;
        } else if (tipo === 'fios') {
          m.etapa = { tipo, ...gerarFios(), cortado: -1, ok: false, ondeCorte: 0 };
        } else {
          m.etapa = { tipo, ...gerarDiferencas(), erros: [], ok: false };
        }
      }
      function errar(seg, texto_, x, y) {
        m.tempo = Math.max(0, m.tempo - seg);
        m.textos.push({ t: `${texto_} (-${seg}s)`, x, y, cor: '#ff9a9a', vida: 1.3 });
        flash = { cor: 'rgba(255,60,60,', vida: 0.35 };
        som('bater');
      }
      function etapaFeita() {
        m.etapa.ok = true;
        m.pontos += 25;
        m.feitas++;
        m.pausa = 1.1;
        flash = { cor: 'rgba(80,255,150,', vida: 0.4 };
        som('fase');
      }
      function acabar() {
        if (m.situacao === 'fim') return;
        m.situacao = 'fim';
        const bonus = m.feitas === 3 ? Math.floor(m.tempo) : 0;
        m.pontos += bonus;
        som(m.feitas === 3 ? 'vida' : 'fim');
        api.terminar('missao_qg', m.pontos, [
          m.feitas === 3 ? 'Missão cumprida, agente!' : `Etapas resolvidas: ${m.feitas} de 3.`,
          bonus ? `Bônus de tempo: ${bonus}` : 'O tempo acabou.',
          `${m.pontos} pontos`,
        ]);
      }

      /* ─── Entrada ─── */
      const BOTOES_CIFRA = { esq: [150, 290, 30], dir: [450, 290, 30], enviar: [520, 266, 108, 48] };
      function girar(d) { if (m.etapa?.tipo === 'cifra' && !m.etapa.ok) { m.etapa.giro = (m.etapa.giro + d + 26) % 26; som('passo'); } }
      function enviarCifra() {
        const et = m.etapa;
        if (et?.tipo !== 'cifra' || et.ok) return;
        if (et.giro === et.chave) etapaFeita(); else errar(5, 'Ainda embaralhado!', 320, 200);
      }
      function clique(x, y) {
        if (m.situacao !== 'jogando' || m.pausa > 0 || !m.etapa || m.etapa.ok) return;
        const et = m.etapa;
        if (et.tipo === 'cifra') {
          const [ex, ey, er] = BOTOES_CIFRA.esq;
          const [dx, dy, dr] = BOTOES_CIFRA.dir;
          const [bx, by, bw, bh] = BOTOES_CIFRA.enviar;
          if (Math.hypot(x - ex, y - ey) < er + 6) girar(-1);
          else if (Math.hypot(x - dx, y - dy) < dr + 6) girar(1);
          else if (x > bx && x < bx + bw && y > by && y < by + bh) enviarCifra();
          else if (Math.hypot(x - 300, y - 290) < 110) girar(x < 300 ? -1 : 1);
        } else if (et.tipo === 'fios') {
          if (x < 110 || x > 530) return;
          let melhor = -1;
          let dist = 16;
          et.fios.forEach((_, i) => { const d = Math.abs(y - yFio(et, i, x)); if (d < dist) { dist = d; melhor = i; } });
          if (melhor < 0) return;
          et.cortado = melhor;
          et.ondeCorte = x;
          if (melhor === et.certo) { etapaFeita(); m.textos.push({ t: 'Desarmada!', x: 320, y: 240, cor: '#7dffb0', vida: 1.2 }); }
          else {
            errar(8, 'Fio errado! BZZT', 320, 240);
            m.pausa = 0.8;
            setTimeout(() => { if (m.etapa === et) Object.assign(et, gerarFios(), { cortado: -1 }); }, 800);
          }
        } else {
          const lados = [[20, 64], [330, 64]];
          for (const [ox, oy] of lados) {
            if (x < ox || x > ox + 290 || y < oy || y > oy + 336) continue;
            const lx = x - ox;
            const ly = y - oy;
            const d = et.difs.find(q => !q.achou && Math.hypot(et.esquerda[q.i].x - lx, et.esquerda[q.i].y - ly) < 32);
            if (d) {
              d.achou = true;
              som('moeda');
              if (et.difs.every(q => q.achou)) etapaFeita();
            } else { errar(3, 'Não é aqui', x, y - 20); et.erros.push({ x, y, vida: 0.8 }); }
            return;
          }
        }
      }
      const yFio = (et, i, x) => 130 + i * (230 / (et.fios.length - 1)) + Math.sin(((x - 110) / 420) * Math.PI) * (8 + (i % 3) * 6);
      api.ouvir(api.tela, 'pointerdown', ev => { const p = api.ponto(ev); clique(p.x, p.y); });
      api.ouvir(document, 'keydown', ev => {
        if (m?.situacao !== 'jogando' || m.etapa?.tipo !== 'cifra' || !api.sobre.hidden) return;
        if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { ev.preventDefault(); girar(-1); }
        else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { ev.preventDefault(); girar(1); }
        else if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); enviarCifra(); }
      });
      novo();

      function atualizar(dt) {
        if (m.situacao !== 'jogando') return;
        if (m.pausa > 0) {
          m.pausa -= dt;
          if (m.pausa <= 0 && m.etapa?.ok) {
            m.k++;
            if (m.k >= 3) { acabar(); return; }
            prepararEtapa();
          }
        } else {
          m.tempo -= dt;
          if (m.tempo <= 0) { m.tempo = 0; acabar(); return; }
        }
        for (const tx of m.textos) { tx.vida -= dt; tx.y -= 20 * dt; }
        m.textos = m.textos.filter(tx => tx.vida > 0);
        if (m.etapa?.erros) { for (const er of m.etapa.erros) er.vida -= dt; m.etapa.erros = m.etapa.erros.filter(er => er.vida > 0); }
        if (flash) { flash.vida -= dt; if (flash.vida <= 0) flash = null; }
      }

      function desenharCifra(g, et, t) {
        ret(g, 20, 54, 600, 116, '#03150c', 8);
        contorno(g, 20, 54, 600, 116, '#2a6a4a', 2, 8);
        texto(g, 'MENSAGEM INTERCEPTADA', 36, 72, { cor: '#5fbf8a', fonte: '700 11px "Cinzel", Georgia, serif', alinhar: 'left' });
        texto(g, et.codigo, 320, 96, { cor: '#7dffb0', fonte: '700 22px "Courier New", monospace' });
        texto(g, 'DECIFRADA', 36, 124, { cor: '#bfa65e', fonte: '700 11px "Cinzel", Georgia, serif', alinhar: 'left' });
        texto(g, cifrar(et.codigo, -et.giro), 320, 148, { cor: et.ok ? '#7dffb0' : '#ffe46b', fonte: '700 22px "Courier New", monospace' });
        // A roda: por fora as letras da mensagem, por dentro o que cada uma vira
        const cx = 300;
        const cy = 290;
        el(g, cx, cy, 112, 112, '#1c2a40');
        el(g, cx, cy, 108, 108, '#24344c');
        el(g, cx, cy, 82, 82, '#0f1828');
        el(g, cx, cy, 58, 58, '#1c2a40');
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + (i / 26) * Math.PI * 2;
          texto(g, ABC[i], cx + Math.cos(a) * 95, cy + Math.sin(a) * 95, { cor: '#bff0ff', fonte: '700 13px "Courier New", monospace' });
          texto(g, ABC[(i - et.giro + 26) % 26], cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, { cor: '#ffe46b', fonte: '700 12px "Courier New", monospace' });
        }
        forma(g, '#ff7a5a', [cx - 6, cy - 120, cx + 6, cy - 120, cx, cy - 108]);
        texto(g, `GIRO ${et.giro}`, cx, cy, { cor: '#bff0ff', fonte: '700 14px "Cinzel", Georgia, serif' });
        for (const [k, [x, y, r]] of [['◀', BOTOES_CIFRA.esq], ['▶', BOTOES_CIFRA.dir]]) {
          el(g, x, y, r, r, '#33496c');
          el(g, x, y, r - 4, r - 4, '#2c4060');
          texto(g, k, x, y + 1, { cor: '#bff0ff', fonte: '700 20px sans-serif' });
        }
        const [bx, by, bw, bh] = BOTOES_CIFRA.enviar;
        ret(g, bx, by, bw, bh, et.ok ? '#2f8a4a' : '#b8922a', 10);
        texto(g, et.ok ? 'CERTO!' : 'ENVIAR', bx + bw / 2, by + bh / 2 + 1, { cor: '#1b1403', fonte: '700 16px "Cinzel", Georgia, serif' });
        texto(g, 'Gire até a mensagem fazer sentido.', 568, 336, { cor: '#cfc4a2', fonte: '13px "EB Garamond", Georgia, serif' });
        if (Math.sin(t * 3) > 0 && !et.ok) el(g, 600, 120, 4, 4, '#ff5a5a');
      }
      function desenharFios(g, et, t) {
        ret(g, 40, 98, 560, 300, '#3a4048', 14);
        ret(g, 52, 110, 536, 276, '#24282e', 10);
        for (const [x, y] of [[54, 112], [584, 112], [54, 382], [584, 382]]) el(g, x, y, 4, 4, '#8a9098');
        ret(g, 80, 118, 30, 250, '#5a6068', 4);
        ret(g, 530, 118, 30, 250, '#5a6068', 4);
        // O relógio da armadilha
        ret(g, 250, 352, 140, 28, '#0a0a0a', 4);
        texto(g, `00:${String(Math.ceil(m.tempo)).padStart(2, '0')}`, 320, 367, { cor: '#ff4a3a', fonte: '700 18px "Courier New", monospace' });
        et.fios.forEach((c, i) => {
          const cor = CORES_FIO[c][1];
          for (const [lw, cc] of [[8, 'rgba(0,0,0,0.5)'], [6, cor]]) {
            g.strokeStyle = cc; g.lineWidth = lw; g.lineCap = 'round';
            g.beginPath();
            for (let x = 110; x <= 530; x += 10) {
              if (et.cortado === i && Math.abs(x - et.ondeCorte) < 10) { g.stroke(); g.beginPath(); continue; }
              g.lineTo(x, yFio(et, i, x));
            }
            g.stroke();
          }
          el(g, 104, yFio(et, i, 110), 7, 7, '#c9a03a');
          el(g, 536, yFio(et, i, 530), 7, 7, '#c9a03a');
        });
        if (et.cortado >= 0) {
          const y = yFio(et, et.cortado, et.ondeCorte);
          for (let k = 0; k < 6; k++) { const a = t * 20 + k; linha(g, '#ffe46b', 2, [et.ondeCorte, y, et.ondeCorte + Math.cos(a) * 14, y + Math.sin(a) * 14]); }
        }
        el(g, 570, 126, 6, 6, et.ok ? '#3cff8a' : Math.sin(t * 8) > 0 ? '#ff3a3a' : '#5a1a1a');
        // O manual (a regra)
        ret(g, 30, 50, 580, 42, '#f6efdc', 6);
        contorno(g, 30, 50, 580, 42, '#8a6a44', 2, 6);
        g.font = '700 14px "EB Garamond", Georgia, serif';
        texto(g, et.texto, 320, 71, { cor: '#3a2a1a', fonte: et.texto.length > 70 ? '700 12px "EB Garamond", Georgia, serif' : '700 15px "EB Garamond", Georgia, serif' });
      }
      function desenharDiferencas(g, et) {
        for (const [ox, oy, lista] of [[20, 64, et.esquerda], [330, 64, et.direita]]) {
          ret(g, ox, oy, 290, 336, '#3a2a4a', 8);
          ret(g, ox, oy + 290, 290, 46, '#2a1e36', 0);
          for (const fy of [112, 208, 304]) ret(g, ox + 8, oy + fy, 274, 8, '#7a5434', 2);
          for (const it of lista) desenharItem(g, it, ox, oy);
          contorno(g, ox, oy, 290, 336, '#b8922a', 2, 8);
          for (const d of et.difs) if (d.achou) {
            const it = et.esquerda[d.i];
            g.strokeStyle = '#3cff8a'; g.lineWidth = 3;
            g.beginPath(); g.arc(ox + it.x, oy + it.y, 26, 0, Math.PI * 2); g.stroke();
          }
        }
        for (const er of et.erros) { linha(g, `rgba(255,80,80,${er.vida / 0.8})`, 4, [er.x - 10, er.y - 10, er.x + 10, er.y + 10]); linha(g, `rgba(255,80,80,${er.vida / 0.8})`, 4, [er.x + 10, er.y - 10, er.x - 10, er.y + 10]); }
        texto(g, `Diferenças: ${et.difs.filter(d => d.achou).length} de 3`, 320, 410, { cor: '#ffe46b', fonte: '700 13px "Cinzel", Georgia, serif' });
      }
      function desenhar(t) {
        const g = api.g;
        g.fillStyle = grad(g, 0, 0, 0, MA, [[0, '#0a1322'], [1, '#17283f']]);
        g.fillRect(0, 0, ML, MA);
        g.strokeStyle = 'rgba(95,212,255,0.07)'; g.lineWidth = 1;
        for (let x = 0; x < ML; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, MA); g.stroke(); }
        // A barra de cima: etapa, tempo e pontos
        ret(g, 0, 0, ML, 44, '#13203a');
        const tipo = m.etapas[Math.min(2, m.k)];
        texto(g, m.situacao === 'inicio' ? 'Guarda Secreta do Coelho' : `Etapa ${Math.min(3, m.k + 1)} de 3: ${ETAPAS[tipo]}`, 14, 22, { cor: '#bff0ff', fonte: '700 15px "Cinzel", Georgia, serif', alinhar: 'left' });
        const f = m.tempo / TEMPO_MISSAO;
        ret(g, 420, 15, 150, 14, 'rgba(0,0,0,0.4)', 7);
        ret(g, 420, 15, 150 * f, 14, f < 0.25 ? '#ff5a5a' : '#5fd4ff', 7);
        texto(g, `${Math.ceil(m.tempo)}s`, 600, 22, { cor: '#fff', fonte: '700 14px "Cinzel", Georgia, serif' });
        for (let k = 0; k < 3; k++) el(g, 380 + k * 12, 22, 4, 4, k < m.feitas ? '#3cff8a' : '#33496c');
        if (m.etapa) {
          if (m.etapa.tipo === 'cifra') desenharCifra(g, m.etapa, t);
          else if (m.etapa.tipo === 'fios') desenharFios(g, m.etapa, t);
          else desenharDiferencas(g, m.etapa, t);
        } else {
          // A tela de espera: o coelho agente e o rosto do Raposo
          g.save(); g.translate(220, 330); g.scale(3, 3);
          desenharCoelho(g, 0, 0, { pelo: visual.cor, roupa: visual.roupa, dir: 1, t });
          g.restore();
          texto(g, 'MISSÃO SECRETA', 420, 200, { cor: '#5fd4ff', fonte: '700 26px "Cinzel", Georgia, serif' });
        }
        if (m.etapa?.ok) {
          ret(g, 200, 180, 240, 60, 'rgba(10,30,20,0.85)', 12);
          texto(g, 'Etapa resolvida!', 320, 210, { cor: '#7dffb0', fonte: '700 22px "Cinzel", Georgia, serif' });
        }
        for (const tx of m.textos) texto(g, tx.t, tx.x, tx.y, { cor: tx.cor, fonte: '700 16px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.7)' });
        if (flash) { g.fillStyle = `${flash.cor}${0.25 * flash.vida})`; g.fillRect(0, 0, ML, MA); }
      }

      return {
        passo(dt, t) {
          if (api.sobre.hidden) atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ═══════════════ Telefone Espião ═══════════════ */

const NOME_REGIAO = { centro: 'Centro da ilha', neve: 'Neve e montanha', litoral: 'Litoral e mar', segredos: 'Segredos' };

export function abrirTelefone({ salas = [], aoEscolher }) {
  const grupos = {};
  for (const s of salas) (grupos[s.regiao] ||= []).push(s);
  let m = null;
  const lista = Object.keys(grupos).length
    ? Object.entries(grupos).map(([regiao, ss]) => h('section', { class: 'ilha-seg-fone-grupo' },
      h('h3', null, NOME_REGIAO[regiao] || regiao),
      ss.sort((a, b) => a.nome.localeCompare(b.nome)).map(s => h('button', {
        type: 'button', class: 'ilha-seg-fone-sala',
        onclick: () => { som('poder'); m.fechar(); aoEscolher(s.id); },
      }, h('strong', null, s.nome), s.desc && h('small', null, s.desc)))))
    : h('p', { class: 'suave' }, 'Nenhum lugar no mapa ainda.');
  m = modal({
    titulo: 'Telefone Espião', classe: 'ilha-seg-fone-modal',
    corpo: h('div', { class: 'ilha-seg-fone' },
      h('div', { class: 'ilha-seg-fone-antena' }),
      h('div', { class: 'ilha-seg-fone-tela' },
        h('p', { class: 'ilha-seg-fone-topo' }, 'GUARDA SECRETA DO COELHO'),
        h('p', { class: 'ilha-seg-fone-dica' }, 'Escolha um lugar da ilha para se teletransportar.'),
        lista),
      h('div', { class: 'ilha-seg-fone-botao', 'aria-hidden': 'true' })),
  });
  return m;
}

/* ═══════════════ Jornais antigos (Sala da Caldeira) ═══════════════ */

export const EDICOES = [
  {
    manchete: 'A ILHA É NOSSA!', data: 'Primavera do ano 1',
    texto: 'Os primeiros coelhos da Casa Luckham desembarcaram hoje na ilha gelada. Encontraram neve, pedras e muito espaço para cavar tocas. A primeira construção foi, claro, o Café da Cenoura.',
    nota: 'Classificados: procura-se pá de neve. Paga-se em cenouras.',
  },
  {
    manchete: 'UM NAVIO NO HORIZONTE', data: 'Verão do ano 1',
    texto: 'O Saltador ancorou perto da praia! O Capitão Saltarrocha, um coelho pirata de tapa-olho, trouxe itens raros de terras distantes e prometeu voltar. Ninguém sabe quando.',
    nota: 'O capitão deixou um livro na Sala de Leitura. Dizem que ele guarda uma chave.',
  },
  {
    manchete: 'MISTÉRIO: CENOURAS SOMEM DO ARMAZÉM', data: 'Outono do ano 1',
    texto: 'Pela terceira noite seguida, sacos de cenoura desapareceram. Na neve, pegadas pontudas e um tufo de pelo laranja. O suspeito tem nome: um tal de Raposo.',
    nota: 'Viu alguma coisa? Fale com a Guarda. Ninguém sabe onde ela fica.',
  },
  {
    manchete: 'INAUGURADO O DOJO NA MONTANHA', data: 'Inverno do ano 1',
    texto: 'Um velho coelho de barba comprida subiu a montanha e abriu um Dojo. O Sensei ensina o Desafio Ninja: fogo vence neve, neve vence água e água vence fogo.',
    nota: 'Dica do Sensei: "Uma faixa por vez, jovem coelho."',
  },
  {
    manchete: 'POMPONS INVADEM A PRAÇA', data: 'Primavera do ano 2',
    texto: 'Bichinhos redondos e fofos de todas as cores apareceram pulando pela ilha. Para cuidar deles abriu o Pet Shop dos Pompons, na Plaza.',
    nota: 'O Pompom preto é tímido. O rosa adora dançar.',
  },
  {
    manchete: 'CALDEIRA NOVA AQUECE O SALÃO', data: 'Inverno do ano 2',
    texto: 'Uma caldeira enorme foi instalada no porão do Salão de Dança. Agora ninguém dança de cachecol. O zelador jura que ouve vozes dentro do duto de ventilação.',
    nota: 'Atenção: não mexa nos tijolos soltos da parede.',
  },
  {
    manchete: 'CAIXA ESTRANHA NO PET SHOP', data: 'Verão do ano 3',
    texto: 'Uma caixa roxa que ninguém encomendou apareceu no Pet Shop. Quem entrou nela conta que viu caixas flutuando e escadas que nunca terminam.',
    nota: 'O Pet Shop avisa: a caixa não está à venda.',
  },
];

export function abrirJornal() {
  let i = EDICOES.length - 1;
  const folha = h('article', { class: 'ilha-seg-jornal' });
  const desenharFolha = () => {
    const ed = EDICOES[i];
    trocar(folha,
      h('header', { class: 'ilha-seg-jornal-cab' }, h('span', null, `Edição ${i + 1}`), h('strong', null, 'Gazeta da Ilha'), h('span', null, '1 cenoura')),
      h('p', { class: 'ilha-seg-jornal-data' }, ed.data),
      h('h3', null, ed.manchete),
      h('p', null, ed.texto),
      h('aside', null, ed.nota));
  };
  desenharFolha();
  const anterior = botao('Edição anterior', { icone: 'anterior', onclick: () => { i = (i + EDICOES.length - 1) % EDICOES.length; desenharFolha(); } });
  const proxima = botao('Próxima edição', { icone: 'proxima', onclick: () => { i = (i + 1) % EDICOES.length; desenharFolha(); } });
  return modal({ titulo: 'Jornais antigos da ilha', corpo: h('div', { class: 'ilha-seg-jornal-corpo' }, folha), rodape: [anterior, proxima] });
}
