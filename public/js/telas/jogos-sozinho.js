// Campo Minado e 2048: jogos de uma pessoa só que rodam inteiros no navegador (nada ao vivo pela rede,
// então não travam). Quem joga aparece em "Jogando agora" e os outros podem assistir.

import { h, trocar, icone, botao, cabecalho, aviso, get, post, pode, aoSair, estado, num } from '../core.js';
import { rt, ouvir, transmitir, enviarQuadro, pararTransmissao } from '../tempo-real.js';

const escutar = (tipo, fn) => aoSair(ouvir(tipo, fn));
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function exigirAcesso() {
  if (pode('recreacao.usar')) return;
  const e = new Error('Sem acesso à Recreação.');
  e.status = 403;
  throw e;
}

// Quantas pessoas estão assistindo quem joga.
function contadorPlateia() {
  const el = h('span', { class: 'plateia', hidden: !rt.plateia });
  const desenhar = () => { el.hidden = !rt.plateia; trocar(el, icone('olho'), ` ${rt.plateia} assistindo`); };
  escutar('solo:plateia', desenhar);
  desenhar();
  return el;
}

// Os melhores de um jogo, ao lado do tabuleiro. lista(r) tira a lista do /ranking; texto(l) mostra o resultado.
function rankingLateral(titulo) {
  const tituloEl = h('span', null, titulo);
  const corpo = h('div');
  return {
    el: h('aside', { class: 'painel jogo-lateral' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), tituloEl)), corpo),
    async carregar(novoTitulo, lista, texto) {
      tituloEl.textContent = novoTitulo;
      try {
        const itens = lista(await get('/api/recreacao/ranking')) || [];
        trocar(corpo, itens.length
          ? h('ol', { class: 'mini-ranking' }, itens.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, texto(l)))))
          : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda. Seja o primeiro!'));
        return itens.find(l => l.nome === estado.eu.nome) || null;
      } catch {
        return null;
      }
    },
  };
}

// Manda o resultado; devolve se foi recorde pessoal.
async function guardarResultado(corpo, caixa) {
  try {
    const r = await post('/api/recreacao/recordes', corpo);
    if (r.recorde) caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('trofeu'), r.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!'), caixa.lastChild);
    return r.recorde;
  } catch (e) {
    aviso(e.message, 'erro');
    return false;
  }
}

/* ─── Campo Minado ────────────────────────────────── */

export const DIFICULDADES = {
  facil: { nome: 'Fácil', lin: 9, col: 9, minas: 10 },
  medio: { nome: 'Médio', lin: 16, col: 16, minas: 40 },
  dificil: { nome: 'Difícil', lin: 16, col: 30, minas: 99 },
};
let dificuldadeAtual = 'facil';

function vizinhosDe(i, lin, col) {
  const [l, c] = [Math.floor(i / col), i % col];
  const v = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dl || dc) && l + dl >= 0 && l + dl < lin && c + dc >= 0 && c + dc < col) v.push((l + dl) * col + c + dc);
    }
  }
  return v;
}

// Uma casa do campo, pelo código que também vai para quem assiste:
// "." fechada, "f" bandeira, "0" a "8" aberta, "m" armadilha (no fim), "x" a que explodiu, "e" bandeira errada.
function pintarCasa(el, codigo) {
  if (el.dataset.c === codigo) return;
  el.dataset.c = codigo;
  el.className = `minado-casa ${codigo === '.' ? 'fechada' : codigo === 'f' ? 'fechada bandeira' : /\d/.test(codigo) ? `aberta n${codigo}` : codigo === 'e' ? 'fechada errada' : `aberta mina ${codigo === 'x' ? 'explodiu' : ''}`}`.trim();
  if (codigo === 'f' || codigo === 'e') trocar(el, icone('bandeira'));
  else if (codigo === 'm' || codigo === 'x') trocar(el, icone('minado'));
  else trocar(el, /[1-8]/.test(codigo) ? codigo : '');
}

export function campoMinado() {
  exigirAcesso();
  const grade = h('div', { class: 'minado-grade' });
  const moldura = h('div', { class: 'minado-moldura' }, grade);
  const sobre = h('div', { class: 'cobra-sobre', hidden: true });
  const restantesEl = h('strong', null, '0');
  const tempoEl = h('strong', null, '0:00');
  const recordeEl = h('strong', null, '...');
  const seletor = h('div', { class: 'segmentado' });
  const ranking = rankingLateral('Melhores');
  const botaoModo = h('button', { type: 'button', class: 'seg minado-modo', 'aria-pressed': 'false' });
  let d;
  let minas = null; // as armadilhas só são postas no primeiro clique (o primeiro clique nunca explode)
  let abertas;
  let bandeiras;
  let numeros;
  let casas = [];
  let situacao = 'pronto';
  let explodiu = -1;
  let inicio = 0;
  let seg = 0;
  let relogioId = null;
  let modoBandeira = false;
  let segurou = false;

  function novoJogo() {
    clearInterval(relogioId);
    d = DIFICULDADES[dificuldadeAtual];
    const total = d.lin * d.col;
    minas = null;
    abertas = new Uint8Array(total);
    bandeiras = new Uint8Array(total);
    numeros = new Int8Array(total);
    situacao = 'pronto';
    explodiu = -1;
    seg = 0;
    grade.style.setProperty('--col', d.col);
    grade.style.setProperty('--lin', d.lin);
    moldura.classList.toggle('largo', d.col > 16);
    casas = Array.from({ length: total }, (_, i) => h('button', { type: 'button', class: 'minado-casa fechada', 'aria-label': `Casa ${i + 1}`, 'data-i': i }));
    trocar(grade, casas);
    sobre.hidden = true;
    desenharSeletor();
    desenhar();
    carregarRanking();
    if (rt.conectado) transmitir('minado', { d: dificuldadeAtual });
    transmitirQuadro(true);
  }

  function plantar(primeira) {
    const total = d.lin * d.col;
    const proibidas = new Set([primeira, ...vizinhosDe(primeira, d.lin, d.col)]);
    const livres = [];
    for (let i = 0; i < total; i++) if (!proibidas.has(i)) livres.push(i);
    for (let k = livres.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [livres[k], livres[j]] = [livres[j], livres[k]];
    }
    minas = new Set(livres.slice(0, d.minas));
    for (let i = 0; i < total; i++) numeros[i] = vizinhosDe(i, d.lin, d.col).filter(v => minas.has(v)).length;
  }

  function abrir(i) {
    if (situacao === 'fim' || abertas[i] || bandeiras[i]) return;
    if (!minas) {
      plantar(i);
      situacao = 'jogando';
      inicio = Date.now();
      relogioId = setInterval(tique, 500);
    }
    if (minas.has(i)) { perder(i); return; }
    // Abre a casa; se for zero, abre em volta (e assim por diante).
    const fila = [i];
    while (fila.length) {
      const k = fila.pop();
      if (abertas[k] || bandeiras[k]) continue;
      abertas[k] = 1;
      if (numeros[k] === 0) for (const v of vizinhosDe(k, d.lin, d.col)) if (!abertas[v] && !minas.has(v)) fila.push(v);
    }
    let fechadas = 0;
    for (let k = 0; k < abertas.length; k++) if (!abertas[k]) fechadas++;
    if (fechadas === d.minas) ganhar();
  }

  // Clicar num número com as bandeiras certas em volta abre o resto em volta.
  function abrirEmVolta(i) {
    const viz = vizinhosDe(i, d.lin, d.col);
    if (viz.filter(v => bandeiras[v]).length !== numeros[i]) return;
    for (const v of viz) if (!abertas[v] && !bandeiras[v]) { abrir(v); if (situacao === 'fim') return; }
  }

  function marcar(i) {
    if (situacao === 'fim' || abertas[i]) return;
    bandeiras[i] = bandeiras[i] ? 0 : 1;
  }

  function clicar(i, bandeira = false) {
    if (situacao === 'fim') return;
    if (bandeira || (modoBandeira && !abertas[i])) marcar(i);
    else if (abertas[i]) abrirEmVolta(i);
    else abrir(i);
    desenhar();
    transmitirQuadro(true);
  }

  function tique() {
    seg = Math.floor((Date.now() - inicio) / 1000);
    tempoEl.textContent = relogio(seg);
    transmitirQuadro();
  }

  function codigoDe(i) {
    if (situacao === 'fim' && minas) {
      if (i === explodiu) return 'x';
      if (minas.has(i) && !bandeiras[i]) return 'm';
      if (bandeiras[i] && !minas.has(i)) return 'e';
    }
    if (bandeiras[i]) return 'f';
    return abertas[i] ? String(numeros[i]) : '.';
  }

  function desenhar() {
    casas.forEach((el, i) => pintarCasa(el, codigoDe(i)));
    let marcadas = 0;
    for (const b of bandeiras) marcadas += b;
    restantesEl.textContent = d.minas - marcadas;
    tempoEl.textContent = relogio(seg);
    grade.classList.toggle('terminou', situacao === 'fim');
  }

  function parar() {
    situacao = 'fim';
    clearInterval(relogioId);
    seg = Math.max(1, Math.floor((Date.now() - inicio) / 1000));
  }

  function perder(i) {
    explodiu = i;
    parar();
    desenhar();
    trocar(sobre, h('div', { class: 'cobra-caixa' },
      h('h2', null, 'Pisou numa armadilha!'),
      h('p', null, `Faltavam ${abertas.length - d.minas - abertas.reduce((a, b) => a + b, 0)} casas.`),
      botao('Tentar de novo', { classe: 'btn-ouro', icone: 'frente', onclick: novoJogo })));
    sobre.hidden = false;
    transmitirQuadro(true);
  }

  async function ganhar() {
    parar();
    // No fim, as armadilhas que faltavam ganham bandeira.
    for (const m of minas) bandeiras[m] = 1;
    desenhar();
    const caixa = h('div', { class: 'cobra-caixa' },
      h('h2', null, 'Campo limpo!'),
      h('p', { class: 'cobra-placar' }, `${d.nome} em ${relogio(seg)}`),
      botao('Jogar de novo', { classe: 'btn-ouro', icone: 'frente', onclick: novoJogo }));
    trocar(sobre, caixa);
    sobre.hidden = false;
    transmitirQuadro(true);
    if (await guardarResultado({ jogo: 'minado', variante: dificuldadeAtual, pontos: seg, detalhe: relogio(seg) }, caixa)) carregarRanking();
  }

  function desenharSeletor() {
    trocar(seletor, Object.entries(DIFICULDADES).map(([k, x]) => h('button', {
      class: `seg ${k === dificuldadeAtual ? 'ativo' : ''}`.trim(), type: 'button',
      onclick: () => { if (k !== dificuldadeAtual) { dificuldadeAtual = k; novoJogo(); } },
    }, `${x.nome} (${x.col}x${x.lin}, ${x.minas})`)));
  }

  // No celular, um botão troca o que o toque faz (abrir ou pôr bandeira).
  function pintarModo() {
    botaoModo.classList.toggle('ativo', modoBandeira);
    botaoModo.setAttribute('aria-pressed', String(modoBandeira));
    trocar(botaoModo, icone(modoBandeira ? 'bandeira' : 'mao'), modoBandeira ? ' Tocar põe bandeira' : ' Tocar abre a casa');
  }
  botaoModo.addEventListener('click', () => { modoBandeira = !modoBandeira; pintarModo(); });
  pintarModo();

  // Mouse: clique abre, botão direito põe bandeira. Dedo: segurar um pouco põe bandeira.
  let segurar = null;
  grade.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-i]');
    if (!el || e.pointerType === 'mouse') return;
    segurou = false;
    clearTimeout(segurar);
    segurar = setTimeout(() => { segurou = true; clicar(Number(el.dataset.i), true); navigator.vibrate?.(20); }, 380);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) grade.addEventListener(ev, () => clearTimeout(segurar));
  grade.addEventListener('click', e => {
    const el = e.target.closest('[data-i]');
    if (!el) return;
    if (segurou) { segurou = false; return; }
    clicar(Number(el.dataset.i));
  });
  grade.addEventListener('contextmenu', e => {
    const el = e.target.closest('[data-i]');
    if (!el) return;
    e.preventDefault();
    if (!segurou) clicar(Number(el.dataset.i), true);
  });

  function transmitirQuadro(urgente = false) {
    if (!casas.length) return;
    let marcadas = 0;
    for (const b of bandeiras) marcadas += b;
    enviarQuadro({ d: dificuldadeAtual, v: casas.map((_, i) => codigoDe(i)).join(''), s: situacao, seg, r: d.minas - marcadas, x: explodiu >= 0 }, urgente);
  }
  escutar('estado', () => { if (rt.conectado) { transmitir('minado', { d: dificuldadeAtual }); transmitirQuadro(true); } });

  async function carregarRanking() {
    const meu = await ranking.carregar(`Melhores (${d.nome})`, r => r.minado?.[dificuldadeAtual], l => relogio(l.segundos));
    recordeEl.textContent = meu ? relogio(meu.segundos) : '-';
  }

  aoSair(() => { clearInterval(relogioId); clearTimeout(segurar); situacao = 'fim'; pararTransmissao(); });
  novoJogo();

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: 'Campo Minado', icone: 'minado', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Abra todas as casas sem pisar nas armadilhas. O número diz quantas armadilhas há em volta. Botão direito (ou segurar o dedo) põe bandeira.',
      acoes: [botao('Novo jogo', { icone: 'aleatorio', onclick: novoJogo })],
    }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area' },
        seletor,
        h('div', { class: 'cobra-placar-linha minado-placar' },
          h('span', null, icone('minado'), ' ', restantesEl),
          h('span', null, icone('relogio'), ' ', tempoEl),
          contadorPlateia(),
          h('span', null, icone('trofeu'), ' Seu recorde: ', recordeEl),
          botaoModo),
        (moldura.append(sobre), moldura)),
      ranking.el));
}

export function assistirMinado() {
  const grade = h('div', { class: 'minado-grade espectador' });
  const moldura = h('div', { class: 'minado-moldura' }, grade);
  const restantesEl = h('strong', null, '0');
  const tempoEl = h('strong', null, '0:00');
  const nivelEl = h('span', { class: 'suave' });
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  let chave = '';
  let casas = [];
  return {
    el: h('div', { class: 'jogo-area' },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, icone('minado'), ' ', restantesEl), h('span', null, icone('relogio'), ' ', tempoEl), nivelEl),
      (moldura.append(aviso_), moldura)),
    quadro(q) {
      const d = DIFICULDADES[q.d] || DIFICULDADES.facil;
      if (chave !== `${q.d}:${q.v.length}`) {
        chave = `${q.d}:${q.v.length}`;
        grade.style.setProperty('--col', d.col);
        grade.style.setProperty('--lin', d.lin);
        moldura.classList.toggle('largo', d.col > 16);
        casas = [...q.v].map(() => h('div', { class: 'minado-casa fechada' }));
        trocar(grade, casas);
      }
      [...q.v].forEach((c, i) => casas[i] && pintarCasa(casas[i], c));
      restantesEl.textContent = q.r ?? 0;
      tempoEl.textContent = relogio(q.seg || 0);
      nivelEl.textContent = d.nome;
      aviso_.hidden = q.s !== 'fim';
      if (q.s === 'fim') aviso_.textContent = q.x ? 'Pisou numa armadilha!' : `Campo limpo em ${relogio(q.seg || 0)}!`;
    },
    parar() {},
  };
}

/* ─── 2048 ────────────────────────────────────────── */

const DIRECOES_2048 = {
  ArrowLeft: 'esquerda', ArrowRight: 'direita', ArrowUp: 'cima', ArrowDown: 'baixo',
  KeyA: 'esquerda', KeyD: 'direita', KeyW: 'cima', KeyS: 'baixo',
};

// Um bloco na tela: a posição vem das variáveis --l e --c (o CSS desliza de uma casa para outra).
function blocoNaTela(el, b) {
  el.style.setProperty('--l', b.l);
  el.style.setProperty('--c', b.c);
}

export function jogo2048() {
  exigirAcesso();
  const fundo = h('div', { class: 'b2048-fundo' }, Array.from({ length: 16 }, () => h('span')));
  const camada = h('div', { class: 'b2048-blocos' });
  const tabuleiro = h('div', { class: 'b2048', tabindex: '0', 'aria-label': 'Tabuleiro do 2048. Use as setas.' }, fundo, camada);
  const sobre = h('div', { class: 'cobra-sobre', hidden: true });
  const moldura = h('div', { class: 'b2048-moldura' }, tabuleiro, sobre);
  const pontosEl = h('strong', null, '0');
  const maiorEl = h('strong', null, '2');
  const recordeEl = h('strong', null, '...');
  const faixa = h('p', { class: 'b2048-faixa', hidden: true });
  const ranking = rankingLateral('Melhores');
  let blocos = []; // { id, v, l, c }
  let elementos = new Map(); // id -> elemento
  let proximoId = 1;
  let pontos = 0;
  let situacao = 'jogando';
  let chegou2048 = false;
  const timers = new Set();
  const depois = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  function novoJogo() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    blocos = [];
    elementos = new Map();
    trocar(camada);
    pontos = 0;
    situacao = 'jogando';
    chegou2048 = false;
    faixa.hidden = true;
    sobre.hidden = true;
    novoBloco();
    novoBloco();
    desenhar();
    carregarRanking();
    if (rt.conectado) transmitir('2048', {});
    transmitirQuadro();
    tabuleiro.focus({ preventScroll: true });
  }

  function livres() {
    const ocupadas = new Set(blocos.map(b => b.l * 4 + b.c));
    return Array.from({ length: 16 }, (_, i) => i).filter(i => !ocupadas.has(i));
  }

  function novoBloco() {
    const l = livres();
    if (!l.length) return;
    const i = l[Math.floor(Math.random() * l.length)];
    blocos.push({ id: proximoId++, v: Math.random() < 0.9 ? 2 : 4, l: Math.floor(i / 4), c: i % 4, novo: true });
  }

  // Desliza tudo para um lado. Dois blocos iguais que se encontram viram um (só uma vez por jogada).
  function mover(dir) {
    if (situacao !== 'jogando') return;
    const vertical = dir === 'cima' || dir === 'baixo';
    const inverso = dir === 'direita' || dir === 'baixo';
    let mexeu = false;
    const saem = [];
    for (let k = 0; k < 4; k++) {
      const linha = blocos.filter(b => (vertical ? b.c : b.l) === k)
        .sort((a, b) => (vertical ? a.l - b.l : a.c - b.c) * (inverso ? -1 : 1));
      let pos = 0;
      let anterior = null;
      for (const b of linha) {
        const antes = vertical ? b.l : b.c;
        if (anterior && anterior.v === b.v && !anterior.juntou) {
          // Junta com o anterior: este bloco desliza até lá e some.
          const alvo = vertical ? anterior.l : anterior.c;
          if (vertical) b.l = alvo; else b.c = alvo;
          anterior.v *= 2;
          anterior.juntou = true;
          pontos += anterior.v;
          saem.push(b);
          mexeu = true;
          continue;
        }
        const novo = inverso ? 3 - pos : pos;
        if (vertical) b.l = novo; else b.c = novo;
        if (novo !== antes) mexeu = true;
        anterior = b;
        pos++;
      }
    }
    if (!mexeu) return;
    for (const b of blocos) b.novo = false;
    const juntaram = blocos.filter(b => b.juntou);
    // Os que somem deslizam até o bloco com que juntaram, e só depois saem.
    for (const b of saem) {
      const el = elementos.get(b.id);
      if (el) { blocoNaTela(el, b); el.classList.add('saindo'); depois(() => el.remove(), 110); }
      elementos.delete(b.id);
    }
    blocos = blocos.filter(b => !saem.includes(b));
    novoBloco();
    desenhar(juntaram);
    for (const b of juntaram) b.juntou = false;
    if (!chegou2048 && blocos.some(b => b.v >= 2048)) {
      chegou2048 = true;
      faixa.hidden = false;
      faixa.textContent = 'Chegou no 2048! Pode continuar para fazer mais pontos.';
    }
    if (!temJogada()) fim();
    transmitirQuadro();
  }

  function temJogada() {
    if (livres().length) return true;
    const em = new Map(blocos.map(b => [b.l * 4 + b.c, b.v]));
    for (let i = 0; i < 16; i++) {
      if (i % 4 < 3 && em.get(i) === em.get(i + 1)) return true;
      if (i < 12 && em.get(i) === em.get(i + 4)) return true;
    }
    return false;
  }

  function desenhar(juntaram = []) {
    for (const b of blocos) {
      let el = elementos.get(b.id);
      if (!el) {
        el = h('span', { class: `b2048-bloco ${b.novo ? 'novo' : ''}`.trim() });
        elementos.set(b.id, el);
        camada.append(el);
      }
      blocoNaTela(el, b);
      const pinta = () => {
        el.dataset.v = b.v > 2048 ? 'grande' : b.v;
        el.textContent = b.v;
      };
      if (juntaram.includes(b)) {
        // O número muda quando o outro bloco chega, com um pulinho.
        depois(() => { pinta(); el.classList.remove('juntou'); void el.offsetWidth; el.classList.add('juntou'); }, 100);
      } else {
        pinta();
      }
    }
    pontosEl.textContent = num(pontos);
    maiorEl.textContent = Math.max(...blocos.map(b => b.v));
  }

  async function fim() {
    situacao = 'fim';
    const maior = Math.max(...blocos.map(b => b.v));
    const caixa = h('div', { class: 'cobra-caixa' },
      h('h2', null, 'Sem jogadas!'),
      h('p', { class: 'cobra-placar' }, `${num(pontos)} pontos · maior bloco: ${maior}`),
      botao('Jogar de novo', { classe: 'btn-ouro', icone: 'frente', onclick: novoJogo }));
    depois(() => { trocar(sobre, caixa); sobre.hidden = false; }, 400);
    transmitirQuadro();
    if (await guardarResultado({ jogo: '2048', pontos, detalhe: `maior bloco ${maior}` }, caixa)) carregarRanking();
  }

  function transmitirQuadro() {
    const g = Array(16).fill(0);
    for (const b of blocos) g[b.l * 4 + b.c] = b.v;
    enviarQuadro({ g, p: pontos, s: situacao }, true);
  }
  escutar('estado', () => { if (rt.conectado) { transmitir('2048', {}); transmitirQuadro(); } });

  async function carregarRanking() {
    const meu = await ranking.carregar('Melhores do 2048', r => r['2048'], l => `${num(l.pontos)} pts`);
    recordeEl.textContent = meu ? num(meu.pontos) : '-';
  }

  // Teclas (setas ou W A S D) e deslizar o dedo (ou arrastar o mouse) no tabuleiro.
  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const dir = DIRECOES_2048[e.code];
    if (!dir) return;
    e.preventDefault();
    mover(dir);
  };
  document.addEventListener('keydown', aoTeclar);
  let toque = null;
  tabuleiro.addEventListener('pointerdown', e => { toque = [e.clientX, e.clientY]; });
  tabuleiro.addEventListener('pointerup', e => {
    if (!toque) return;
    const [dx, dy] = [e.clientX - toque[0], e.clientY - toque[1]];
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'direita' : 'esquerda') : (dy > 0 ? 'baixo' : 'cima'));
  });
  tabuleiro.addEventListener('pointercancel', () => { toque = null; });

  aoSair(() => {
    document.removeEventListener('keydown', aoTeclar);
    for (const t of timers) clearTimeout(t);
    situacao = 'fim';
    pararTransmissao();
  });
  novoJogo();

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: '2048', icone: 'blocos', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Deslize com as setas (ou o dedo): os blocos iguais que se encontram viram um só, com o dobro. Chegue no 2048!',
      acoes: [botao('Novo jogo', { icone: 'aleatorio', onclick: novoJogo })],
    }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area' },
        h('div', { class: 'cobra-placar-linha b2048-placar' },
          h('span', null, 'Pontos: ', pontosEl),
          h('span', null, 'Maior bloco: ', maiorEl),
          contadorPlateia(),
          h('span', null, icone('trofeu'), ' Seu recorde: ', recordeEl)),
        faixa,
        moldura),
      ranking.el));
}

export function assistir2048() {
  const camada = h('div', { class: 'b2048-blocos' });
  const fundo = h('div', { class: 'b2048-fundo' }, Array.from({ length: 16 }, () => h('span')));
  const tabuleiro = h('div', { class: 'b2048 espectador' }, fundo, camada);
  const pontosEl = h('strong', null, '0');
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  return {
    el: h('div', { class: 'jogo-area' },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, 'Pontos: ', pontosEl)),
      h('div', { class: 'b2048-moldura' }, tabuleiro, aviso_)),
    quadro(q) {
      trocar(camada, (q.g || []).flatMap((v, i) => {
        if (!v) return [];
        const el = h('span', { class: 'b2048-bloco', 'data-v': v > 2048 ? 'grande' : v }, v);
        blocoNaTela(el, { l: Math.floor(i / 4), c: i % 4 });
        return [el];
      }));
      pontosEl.textContent = num(q.p || 0);
      aviso_.hidden = q.s !== 'fim';
      if (q.s === 'fim') aviso_.textContent = `Fim de jogo: ${num(q.p || 0)} pontos`;
    },
    parar() {},
  };
}
