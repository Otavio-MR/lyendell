// Campo Minado e 2048: jogos de uma pessoa só que rodam inteiros no navegador (nada ao vivo pela rede,
// então não travam). Quem joga aparece em "Jogando agora" e os outros podem assistir.

import { h, trocar, icone, botao, cabecalho, aviso, get, post, pode, aoSair, estado, num } from '../core.js';
import { rt, ouvir, transmitir, enviarQuadro, pararTransmissao } from '../tempo-real.js';
import { juntoNoJogo } from '../junto.js';
import { segredosDoJogo, SEGREDOS } from '../segredos.js';
import { efeito } from '../bobo-efeitos.js';
import { menuAdm, admDirecao, admPodeAgir } from '../adm-jogos.js';

const escutar = (tipo, fn) => aoSair(ouvir(tipo, fn));
const NAO_VALE_ADM = 'Partida com o menu de administrador: não vale recorde.';

// O menu de administrador de um jogo daqui. ativa() lança Error quando não dá para mexer agora; marca a partida
// antes de mexer (assim o fim de jogo já sabe que ela não vale recorde). jogo: a chave dos códigos secretos.
function menuSozinho({ titulo, jogo, seg, acoes, ativa, aoUsar }) {
  let menu = null;
  const usar = fn => valores => { ativa?.(); menu.marcar(); return fn(valores); };
  const codigos = () => Object.entries(SEGREDOS).filter(([, s]) => s.jogos.includes(jogo)).map(([chave, s]) => ({
    id: `segredo-${chave}`, nome: `Código: ${s.nome}`, grupo: 'Modo', ajuda: s.efeito,
    executar: usar(() => {
      const r = seg.usar(chave);
      if (r === 'recusado') throw new Error(`${s.nome}: não deu para usar agora.`);
      return r === 'usado' ? `${s.nome}: feito.` : `${s.nome}: ${r === 'ligado' ? 'ligado' : 'desligado'}.`;
    }),
  }));
  menu = menuAdm({
    titulo,
    get acoes() { return [...acoes().map(a => ({ ...a, executar: a.livre ? a.executar : usar(a.executar) })), ...codigos()]; },
    aoUsar,
  });
  return menu;
}
const ligarDesligar = [{ id: 'ligar', nome: 'Ligar', tipo: 'escolha', opcoes: [['sim', 'Ligar'], ['nao', 'Desligar']] }];
const quantos = (n, max) => Math.max(1, Math.min(max, Math.floor(Number(n)) || 1));
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
export function pintarCasa(el, codigo) {
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
  const sorte = Math.random;
  const dificuldade = () => dificuldadeAtual;
  const pontoXyzzy = h('span', { class: 'xyzzy-ponto', hidden: true, 'aria-hidden': 'true' });
  const segredos = segredosDoJogo('minado', { aoMudar: () => { pontoXyzzy.hidden = !segredos.ativo('minado-xyzzy'); pontoXyzzy.classList.remove('perigo'); } });

  // Menu de administrador. Usou, a partida não vale recorde (até o próximo jogo).
  let admUsado = false;
  let revelar = false; // as armadilhas aparecem no campo (só aqui, quem assiste não vê)
  const fechadasSeguras = () => casas.map((_, i) => i).filter(i => !abertas[i] && !bandeiras[i] && !minas.has(i));
  // Antes da primeira casa não há armadilhas: o menu começa o jogo pela casa do meio.
  const comecarPeloMeio = () => { const m = Math.floor(d.lin / 2) * d.col + Math.floor(d.col / 2); bandeiras[m] = 0; abrir(m); };
  const depoisDeMexer = () => { desenhar(); transmitirQuadro(true); };
  const menu = menuSozinho({
    titulo: 'Campo Minado', jogo: 'minado', seg: segredos,
    aoUsar: () => { admUsado = true; },
    ativa: () => { if (situacao === 'fim') throw new Error('A partida acabou: comece outra para usar isso.'); },
    acoes: () => [
      {
        id: 'segura', nome: 'Abrir uma casa segura', grupo: 'Ajudar', ajuda: 'Abre uma casa sem armadilha.',
        executar() {
          if (!minas) { comecarPeloMeio(); depoisDeMexer(); return 'Abri a casa do meio para começar.'; }
          const lista = fechadasSeguras();
          if (!lista.length) throw new Error('Não sobrou casa segura fechada.');
          abrir(lista[Math.floor(Math.random() * lista.length)]);
          depoisDeMexer();
          return 'Uma casa segura foi aberta.';
        },
      },
      {
        id: 'bandeiras', nome: 'Bandeira nas armadilhas', grupo: 'Ajudar', ajuda: 'Põe bandeira em todas as armadilhas (e tira as erradas).',
        executar() {
          if (!minas) throw new Error('As armadilhas só aparecem depois da primeira casa aberta.');
          bandeiras.fill(0);
          for (const m of minas) bandeiras[m] = 1;
          depoisDeMexer();
          return `${minas.size} bandeiras nas armadilhas.`;
        },
      },
      {
        id: 'revelar', nome: 'Revelar as armadilhas', grupo: 'Modo', ajuda: 'As armadilhas aparecem no campo até desligar.', campos: ligarDesligar,
        executar({ ligar }) {
          revelar = ligar !== 'nao';
          desenhar();
          if (revelar && !minas) return 'Revelar ligado: as armadilhas aparecem depois da primeira casa aberta.';
          return revelar ? 'As armadilhas estão à mostra.' : 'As armadilhas voltaram a ficar escondidas.';
        },
      },
      {
        id: 'resolver', nome: 'Resolver o campo', grupo: 'Mexer na partida', ajuda: 'Abre todas as casas seguras: vitória na hora.',
        executar() {
          if (!minas) comecarPeloMeio();
          if (situacao !== 'fim') {
            for (const i of fechadasSeguras()) abertas[i] = 1;
            ganhar();
          }
          return 'Campo resolvido.';
        },
      },
      {
        id: 'zerar', nome: 'Zerar o relógio', grupo: 'Mexer na partida',
        executar() {
          inicio = Date.now();
          seg = 0;
          tempoEl.textContent = relogio(0);
          return 'O relógio voltou para 0:00.';
        },
      },
      {
        id: 'explodir', nome: 'Terminar a partida', grupo: 'Mexer na partida', perigo: true, ajuda: 'Pisa numa armadilha e perde.',
        executar() {
          if (!minas) comecarPeloMeio();
          if (situacao !== 'fim') perder([...minas][0]);
          return 'A partida foi encerrada.';
        },
      },
    ],
  });

  function novoJogo() {
    clearInterval(relogioId);
    admUsado = false;
    revelar = false;
    menu.novaPartida();
    d = DIFICULDADES[dificuldade()];
    const total = d.lin * d.col;
    minas = null;
    abertas = new Uint8Array(total);
    bandeiras = new Uint8Array(total);
    numeros = new Int8Array(total);
    situacao = 'pronto';
    explodiu = -1;
    seg = 0;
    segredos.novaPartida();
    grade.style.setProperty('--col', d.col);
    grade.style.setProperty('--lin', d.lin);
    moldura.classList.toggle('largo', d.col > 16);
    casas = Array.from({ length: total }, (_, i) => h('button', { type: 'button', class: 'minado-casa fechada', 'aria-label': `Casa ${i + 1}`, 'data-i': i }));
    trocar(grade, casas);
    sobre.hidden = true;
    desenharSeletor();
    desenhar();
    carregarRanking();
    if (rt.conectado) transmitir('minado', { d: dificuldade() });
    transmitirQuadro(true);
  }

  function plantar(primeira) {
    const total = d.lin * d.col;
    const proibidas = new Set([primeira, ...vizinhosDe(primeira, d.lin, d.col)]);
    const livres = [];
    for (let i = 0; i < total; i++) if (!proibidas.has(i)) livres.push(i);
    for (let k = livres.length - 1; k > 0; k--) {
      const j = Math.floor(sorte() * (k + 1));
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
    if (situacao === 'fim' || !admPodeAgir()) return; // congelado (pegadinha do administrador): não abre nada
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
    casas.forEach((el, i) => pintarCasa(el, revelar && minas?.has(i) && !abertas[i] && !bandeiras[i] && situacao !== 'fim' ? 'm' : codigoDe(i)));
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
    if (segredos.ativo('festa')) efeito('confete');
    const caixa = h('div', { class: 'cobra-caixa' },
      h('h2', null, 'Campo limpo!'),
      h('p', { class: 'cobra-placar' }, `${d.nome} em ${relogio(seg)}`),
      botao('Jogar de novo', { classe: 'btn-ouro', icone: 'frente', onclick: novoJogo }));
    trocar(sobre, caixa);
    sobre.hidden = false;
    transmitirQuadro(true);
    if (admUsado || menu.usado()) { caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('alerta'), NAO_VALE_ADM), caixa.lastChild); return; }
    if (!segredos.valeRecorde()) { caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('estrela'), 'Modo secreto ligado: esta partida não vale recorde.'), caixa.lastChild); return; }
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
  // xyzzy: com o mouse em cima de uma casa com armadilha, o pontinho fica vermelho.
  grade.addEventListener('pointermove', e => {
    if (!segredos.ativo('minado-xyzzy')) return;
    const i = Number(e.target.closest('[data-i]')?.dataset.i ?? -1);
    pontoXyzzy.classList.toggle('perigo', !!(minas && i >= 0 && minas.has(i) && !abertas[i]));
  });
  grade.addEventListener('pointerleave', () => pontoXyzzy.classList.remove('perigo'));

  function transmitirQuadro(urgente = false) {
    if (!casas.length) return;
    let marcadas = 0;
    for (const b of bandeiras) marcadas += b;
    enviarQuadro({ d: dificuldade(), v: casas.map((_, i) => codigoDe(i)).join(''), s: situacao, seg, r: d.minas - marcadas, x: explodiu >= 0 }, urgente);
  }
  escutar('estado', () => { if (rt.conectado) { transmitir('minado', { d: dificuldade() }); transmitirQuadro(true); } });

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
          botaoModo,
          pontoXyzzy),
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
  // Aberto pela sala junto (versus ou co-op): todos no mesmo jogo, que roda no servidor.
  const jt = juntoNoJogo('2048');
  if (jt) return jogo2048Junto(jt);
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
  const sorte = Math.random;
  let historico = []; // para desfazer (código secreto)
  let ouroUsado = false;
  const botaoDesfazer = botao('Desfazer', { icone: 'voltar', classe: 'btn-pequeno', onclick: () => desfazer() });
  botaoDesfazer.hidden = true;
  const seg = segredosDoJogo('2048', {
    aoMudar: chave => {
      if (chave === '2048-desfazer') botaoDesfazer.hidden = !seg.ativo('2048-desfazer');
      if (chave === '2048-coelho') desenhar();
    },
    aoUsar: chave => {
      if (chave !== '2048-ouro' || ouroUsado || situacao !== 'jogando') return false;
      const l = livres();
      if (!l.length) return false;
      const i = l[Math.floor(Math.random() * l.length)];
      blocos.push({ id: proximoId++, v: 128, l: Math.floor(i / 4), c: i % 4, novo: true });
      ouroUsado = true;
      desenhar();
      transmitirQuadro();
      return true;
    },
  });

  // Menu de administrador. Usou, a partida não vale recorde (até o próximo jogo).
  let admUsado = false;
  const ativa = () => { if (situacao === 'fim') throw new Error('A partida acabou: comece outra (ou desfaça a última jogada).'); };
  const depoisDeMexer = () => { desenhar(); transmitirQuadro(); };
  const menu = menuSozinho({
    titulo: '2048', jogo: '2048', seg,
    aoUsar: () => { admUsado = true; },
    ativa,
    acoes: () => [
      {
        id: 'peca', nome: 'Criar uma peça', grupo: 'Ajudar', ajuda: 'O bloco escolhido aparece num espaço vazio.',
        campos: [{ id: 'v', nome: 'Bloco', tipo: 'escolha', opcoes: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map(v => [v, String(v)]), padrao: 128 }],
        executar({ v }) {
          const l = livres();
          if (!l.length) throw new Error('Não tem espaço vazio no tabuleiro.');
          const i = l[Math.floor(Math.random() * l.length)];
          blocos.push({ id: proximoId++, v, l: Math.floor(i / 4), c: i % 4, novo: true });
          depoisDeMexer();
          if (!temJogada()) fim();
          return `Apareceu um bloco de ${v}.`;
        },
      },
      {
        id: 'desfazer', nome: 'Desfazer a última jogada', grupo: 'Ajudar', livre: true, ajuda: 'Funciona até depois do fim do jogo.',
        executar() {
          if (!historico.length) throw new Error('Não tem jogada para desfazer.');
          desfazer();
          return 'A última jogada foi desfeita.';
        },
      },
      {
        id: 'limpar', nome: 'Tirar os blocos pequenos', grupo: 'Ajudar', ajuda: 'Somem todos os blocos de 2 e de 4.',
        executar() {
          const saem = blocos.filter(b => b.v <= 4);
          if (!saem.length) throw new Error('Não tem bloco de 2 nem de 4.');
          if (saem.length === blocos.length) saem.pop(); // sempre fica um bloco
          for (const b of saem) { elementos.get(b.id)?.remove(); elementos.delete(b.id); }
          blocos = blocos.filter(b => !saem.includes(b));
          depoisDeMexer();
          return `Sumiram ${saem.length} ${saem.length === 1 ? 'bloco pequeno' : 'blocos pequenos'}.`;
        },
      },
      {
        id: 'dobrar', nome: 'Dobrar o maior bloco', grupo: 'Ajudar',
        executar() {
          const maior = blocos.reduce((m, b) => (b.v > m.v ? b : m), blocos[0]);
          maior.v *= 2;
          depoisDeMexer();
          return `O maior bloco virou ${maior.v}.`;
        },
      },
      {
        id: 'pontos', nome: 'Dar pontos', grupo: 'Ajudar', campos: [{ id: 'n', nome: 'Quantos', tipo: 'numero', min: 1, max: 1000000, padrao: 1000 }],
        executar({ n }) {
          const k = quantos(n, 1000000);
          pontos += k;
          depoisDeMexer();
          return `+${num(k)} pontos.`;
        },
      },
      {
        id: 'terminar', nome: 'Terminar a partida', grupo: 'Mexer na partida', perigo: true, ajuda: 'Acaba agora, com os pontos que tem.',
        executar() { fim(); return 'A partida foi encerrada.'; },
      },
    ],
  });

  function desfazer() {
    const antes = historico.pop();
    if (!antes) { aviso('Não tem jogada para desfazer.'); return; }
    for (const t of timers) clearTimeout(t);
    timers.clear();
    elementos = new Map();
    trocar(camada);
    blocos = antes.blocos.map(b => ({ ...b, id: proximoId++ }));
    pontos = antes.pontos;
    chegou2048 = antes.chegou2048;
    situacao = 'jogando';
    sobre.hidden = true;
    desenhar();
    transmitirQuadro();
  }
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
    historico = [];
    ouroUsado = false;
    seg.novaPartida();
    admUsado = false;
    menu.novaPartida();
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
    const i = l[Math.floor(sorte() * l.length)];
    blocos.push({ id: proximoId++, v: sorte() < 0.9 ? 2 : 4, l: Math.floor(i / 4), c: i % 4, novo: true });
  }

  // Desliza tudo para um lado. Dois blocos iguais que se encontram viram um (só uma vez por jogada).
  function mover(dir) {
    if (situacao !== 'jogando') return;
    const foto = { blocos: blocos.map(b => ({ v: b.v, l: b.l, c: b.c })), pontos, chegou2048 };
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
    historico.push(foto);
    if (historico.length > 50) historico.shift();
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
        if (seg.ativo('2048-coelho')) trocar(el, icone('coelho', 'b2048-coelho'), h('span', null, b.v));
        else el.textContent = b.v;
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
    if (admUsado || menu.usado()) { caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('alerta'), NAO_VALE_ADM), caixa.lastChild); return; }
    if (!seg.valeRecorde()) { caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('estrela'), 'Modo secreto ligado: esta partida não vale recorde.'), caixa.lastChild); return; }
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
    // Pegadinhas do administrador: congelado não mexe; invertido vai para o lado contrário.
    const vale = admDirecao(dir);
    if (vale) mover(vale);
  };
  document.addEventListener('keydown', aoTeclar);
  let toque = null;
  tabuleiro.addEventListener('pointerdown', e => { toque = [e.clientX, e.clientY]; });
  tabuleiro.addEventListener('pointerup', e => {
    if (!toque) return;
    const [dx, dy] = [e.clientX - toque[0], e.clientY - toque[1]];
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'direita' : 'esquerda') : (dy > 0 ? 'baixo' : 'cima');
    seg.direcao(dir);
    const vale = admDirecao(dir);
    if (vale) mover(vale);
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
          botaoDesfazer,
          contadorPlateia(),
          h('span', null, icone('trofeu'), ' Seu recorde: ', recordeEl)),
        faixa,
        moldura),
      ranking.el));
}

/* 2048 junto: o servidor roda (src/junto-2048.js); aqui só se desenha e se manda a direção. */
const SETA = { cima: '↑', baixo: '↓', esquerda: '←', direita: '→' };

function tabuleiro2048(g, classe = '') {
  const camada = h('div', { class: 'b2048-blocos' });
  const fundo = h('div', { class: 'b2048-fundo' }, Array.from({ length: 16 }, () => h('span')));
  trocar(camada, (g || []).flatMap((v, i) => {
    if (!v) return [];
    const el = v < 0
      ? h('span', { class: 'b2048-bloco pedra', title: `Pedra: some em ${-v} jogadas` }, icone('pedra'), h('small', null, -v))
      : h('span', { class: 'b2048-bloco', 'data-v': v > 2048 ? 'grande' : v }, v);
    blocoNaTela(el, { l: Math.floor(i / 4), c: i % 4 });
    return [el];
  }));
  return h('div', { class: `b2048 ${classe}`.trim() }, fundo, camada);
}

function jogo2048Junto(jt) {
  const area = h('div', { class: 'jogo-area b2048-junto' });
  const info = h('div', { class: 'cobra-placar-linha' });
  let q = jt.estado()?.quadro || null;

  function desenhar() {
    if (!q) { trocar(area, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' }))); return; }
    if (q.modo === 'coop') {
      const quem = q.ultimo ? jt.jogadores[q.ultimo.i] : null;
      trocar(info,
        h('span', null, 'Meta: ', h('strong', null, q.alvo)),
        h('span', null, 'Pontos: ', h('strong', null, num(q.pontos))),
        h('span', null, 'Jogadas: ', h('strong', null, q.jogadas)),
        quem && h('span', { class: 'b2048-quem', style: { '--cor': quem.cor } }, `${quem.nome} ${SETA[q.ultimo.dir]}`));
      trocar(area, info, h('div', { class: 'b2048-moldura' }, tabuleiro2048(q.g)));
      return;
    }
    const meu = q.t[jt.eu];
    trocar(info,
      h('span', null, 'Seus pontos: ', h('strong', null, num(meu?.pontos || 0))),
      h('span', null, 'Pedras que você jogou: ', h('strong', null, meu?.pedras || 0)),
      meu?.fora && h('span', { class: 'mesa-fora' }, 'Sem jogadas: você está fora'));
    trocar(area, info,
      h('div', { class: 'b2048-moldura' }, tabuleiro2048(meu?.g, meu?.fora ? 'fora' : '')),
      h('div', { class: 'b2048-outros' }, q.t.map((t, i) => i === jt.eu ? null : h('div', { class: `b2048-outro ${t.fora ? 'fora' : ''}`.trim() },
        h('p', null, h('span', { class: 'cobras-cor', style: { background: jt.jogadores[i]?.cor } }), h('strong', null, jt.jogadores[i]?.nome), ' ', num(t.pontos), t.fora ? ' (fora)' : ''),
        tabuleiro2048(t.g, 'mini')))));
  }
  jt.aoQuadro = novo => { q = novo; desenhar(); };

  const mover = dir => { if (jt.largou() && !jt.acabou()) jt.evento({ tipo: 'mover', dir }); };
  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const dir = DIRECOES_2048[e.code];
    if (!dir) return;
    e.preventDefault();
    mover(dir);
  };
  document.addEventListener('keydown', aoTeclar);
  let toque = null;
  area.addEventListener('pointerdown', e => { toque = [e.clientX, e.clientY]; });
  area.addEventListener('pointerup', e => {
    if (!toque) return;
    const [dx, dy] = [e.clientX - toque[0], e.clientY - toque[1]];
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'direita' : 'esquerda') : (dy > 0 ? 'baixo' : 'cima'));
  });
  aoSair(() => document.removeEventListener('keydown', aoTeclar));
  desenhar();

  const coop = jt.modo === 'coop';
  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: `2048: ${coop ? 'co-op' : 'versus'}`, icone: 'blocos', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: coop ? 'Um tabuleiro só, e todos mexem nele ao mesmo tempo. Cheguem no bloco da meta antes do tempo acabar!'
        : 'Batalha: juntar um bloco de 64 ou mais joga uma pedra no tabuleiro de outra pessoa. Quem ficar sem jogada está fora.',
    }),
    h('div', { class: 'jogo-solo' }, area, jt.painel));
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
