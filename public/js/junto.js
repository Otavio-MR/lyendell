// Jogos juntos no navegador: a ligação de um jogo com a sala "junto" (src/junto.js).
// Todos jogam o MESMO jogo ao mesmo tempo: o mundo vem da mesma semente e do mesmo relógio, cada um
// controla o seu coelho e manda onde está; os outros aparecem na tela de cada um.
//
// juntoNoJogo(jogo) devolve null quando a pessoa não está numa sala junto desse jogo. Senão, devolve:
//   id, jogo, modo ('versus' | 'coop'), semente, dif (1 = uma pessoa; +0,15 por pessoa a mais), n, eu,
//   jogadores: [{ nome, cor, visual: { pelo, roupa } }]
//   tempo(): segundos desde a largada (o mesmo para todos; negativo antes)
//   fase(), faseTempo(): a fase do co-op e os segundos desde que ela começou (negativo antes)
//   largou(), acabou(), estado(): o que o servidor contou da partida (vidas, quem está fora...)
//   pos(d): manda onde estou (o jogo escolhe o formato; uns 12 por segundo)
//   evento(ev): manda um acontecimento do jogo ({ tipo: 'quebrou', ... }) para os outros
//   pegar(chave, valor): pede um item; só pegue de verdade quando chegar aoPegou
//   morri(), cheguei(), pontos(n)
//   o jogo põe: aoPos(i, d), aoEvento(i, ev), aoPegou(i, chave, valor), aoRenascer(i), aoFora(i),
//               aoChegou(i), aoFase(fase), aoQuadro(q) (jogos do servidor)
//   painel: o quadro do lado da tela (quem está jogando, vidas, fase)

import { h, trocar, icone, aoSair } from './core.js';
import { rt, ouvir, enviar } from './tempo-real.js';

export const CORES_JUNTO = ['#e8c24a', '#5aa0d8', '#e05a8a', '#7fb069', '#b77be6', '#e0884a', '#4fc1b8', '#d8d8d8', '#a0783c', '#9db3f0'];
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nada = () => {};

// Gerador de números "aleatórios" a partir da semente (a mesma semente dá a mesma sequência para todos).
export function sorteJunto(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const minhaSalaJunto = jogo => {
  const s = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  return s && s.jogo === 'junto' && s.status === 'jogando' && s.opcoes?.jogo === jogo && s.eu >= 0 && s.estado && !s.jogadores[s.eu].saiu ? s : null;
};
export const emJunto = jogo => !!minhaSalaJunto(jogo);

export function textoDoFimJunto(s) {
  const e = s.estado;
  const v = e.vencedores || [];
  if (e.modo === 'coop') return v.length ? 'A equipe conseguiu! Todos venceram juntos.' : 'Não foi desta vez: a equipe ficou sem vidas.';
  if (v.length !== 1) return 'Empate! Ninguém ficou na frente sozinho.';
  const quem = v[0] === s.eu ? 'Você' : s.jogadores[v[0]].nome;
  return { chegou: `${quem} chegou primeiro e venceu!`, sobrou: `${quem} foi quem sobrou e venceu!` }[e.fim] || `${quem} venceu!`;
}

export function juntoNoJogo(jogo, { aoLargar, aoAcabar } = {}) {
  const s0 = minhaSalaJunto(jogo);
  if (!s0) return null;
  const id = s0.id;
  let sala = s0;
  let inicio = Date.now() + s0.estado.largadaEm;
  let faseInicio = Date.now() + s0.estado.faseEm;
  let limite = Date.now() + s0.estado.acabaEm;
  let faseVista = s0.estado.fase;
  let largou = false;
  let acabou = false;
  let ultimaPos = 0;
  let posPendente = null;
  let timerPos = null;

  const jt = {
    id, jogo, modo: s0.estado.modo, semente: s0.estado.semente, dif: s0.estado.dif, n: s0.estado.n, eu: s0.eu,
    jogadores: s0.jogadores.map((p, i) => ({ nome: p.nome, cor: CORES_JUNTO[i % CORES_JUNTO.length], visual: s0.estado.visuais?.[i] || null })),
    tempo: () => (Date.now() - inicio) / 1000,
    fase: () => sala.estado?.fase ?? 0,
    faseTempo: () => (Date.now() - faseInicio) / 1000,
    largou: () => largou,
    acabou: () => acabou,
    estado: () => sala.estado,
    sala: () => sala,
    pos(d) {
      posPendente = d;
      const espera = 80 - (Date.now() - ultimaPos);
      if (espera <= 0) mandarPos();
      else if (!timerPos) timerPos = setTimeout(mandarPos, espera);
    },
    evento: ev => enviar('junto:evento', { id, ev }, { silencioso: true }),
    pegar: (chave, valor = 0) => enviar('junto:evento', { id, ev: { tipo: 'pegar', chave: String(chave), valor } }, { silencioso: true }),
    morri: () => enviar('junto:evento', { id, ev: { tipo: 'morri' } }, { silencioso: true }),
    cheguei: () => enviar('junto:evento', { id, ev: { tipo: 'cheguei' } }, { silencioso: true }),
    pontos: n => enviar('junto:evento', { id, ev: { tipo: 'pontos', n: Math.floor(n) } }, { silencioso: true }),
    aoPos: nada, aoEvento: nada, aoPegou: nada, aoRenascer: nada, aoFora: nada, aoChegou: nada, aoFase: nada, aoQuadro: nada,
    painel: null,
    // Os botões da caixa de fim de jogo.
    botoesFim: () => [h('a', { class: 'btn btn-ouro', href: `#/recreacao/sala/${id}` }, icone('trofeu'), h('span', null, 'Ver a sala')),
      h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')],
  };
  function mandarPos() {
    clearTimeout(timerPos);
    timerPos = null;
    if (!posPendente || acabou) return;
    ultimaPos = Date.now();
    enviar('junto:pos', { id, d: posPendente }, { silencioso: true });
    posPendente = null;
  }

  /* O quadro do lado: quem está jogando, vidas, fase e o tempo */
  const tempoEl = h('strong', null, '...');
  const lista = h('ol', { class: 'desafio-lista junto-lista' });
  const equipe = h('div', { class: 'desafio-meta', hidden: jt.modo !== 'coop' });
  jt.painel = h('aside', { class: 'painel jogo-lateral desafio-lado' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone(jt.modo === 'coop' ? 'usuarios' : 'trofeu'), jt.modo === 'coop' ? 'Juntos: co-op' : 'Juntos: versus')),
    h('p', { class: 'desafio-tempo' }, icone('relogio'), ' Falta ', tempoEl),
    equipe, lista,
    h('p', { class: 'suave desafio-dica' }, `Dificuldade x${jt.dif.toFixed(2).replace('.', ',')} (sobe com o número de jogadores).`));

  function desenharPainel() {
    const e = sala.estado;
    if (!e) return;
    trocar(lista, sala.jogadores.map((p, i) => {
      const g = e.p[i] || {};
      const situacao = p.saiu || g.saiu ? 'saiu' : g.fora ? 'fora' : g.chegou ? 'chegou!' : jt.modo === 'versus' && g.vidas ? `${'♥'.repeat(Math.min(5, g.vidas))}` : 'jogando';
      return h('li', { class: `${i === jt.eu ? 'eu-linha' : ''} ${g.fora || p.saiu ? 'fora' : ''}`.trim() },
        h('span', { class: 'cobras-cor', style: { background: jt.jogadores[i]?.cor } }),
        h('span', { class: 'desafio-nome' }, p.nome, h('small', null, situacao)),
        h('strong', null, g.pontos ? String(g.pontos) : ''));
    }));
    if (jt.modo === 'coop') {
      trocar(equipe, h('div', { class: 'desafio-meta-texto' },
        e.vidasEquipe != null && [icone('coracao'), ' Vidas da equipe: ', h('strong', null, e.vidasEquipe)],
        e.fases > 1 && h('span', null, ` · Fase ${Math.min(e.fase + 1, e.fases)} de ${e.fases}`)));
    }
  }

  const contagem = h('div', { class: 'desafio-contagem', hidden: true });
  document.body.append(contagem);
  function tique() {
    const e = sala.estado;
    if (!e) return;
    if (acabou) { tempoEl.textContent = '0:00'; contagem.hidden = true; return; }
    const agora = Date.now();
    tempoEl.textContent = relogio(Math.max(0, (limite - agora) / 1000));
    if (!largou && agora >= inicio) {
      largou = true;
      contagem.hidden = false;
      trocar(contagem, h('span', { class: 'desafio-ja' }, 'Já!'));
      setTimeout(() => { contagem.hidden = true; }, 700);
      aoLargar?.();
    } else if (!largou) {
      contagem.hidden = false;
      trocar(contagem, h('span', null, Math.ceil((inicio - agora) / 1000)), h('small', null, `${jt.modo === 'coop' ? 'Co-op' : 'Versus'}: todos juntos`));
    }
  }

  function terminou(s) {
    if (acabou) return;
    acabou = true;
    clearTimeout(timerPos);
    aoAcabar?.(s);
    const caixa = h('div', { class: 'desafio-fim', role: 'dialog' },
      h('h2', null, icone('trofeu'), 'Fim de jogo!'),
      h('p', null, s ? textoDoFimJunto(s) : 'A sala foi fechada.'),
      ...jt.botoesFim().map(b => { b.addEventListener('click', () => caixa.remove()); return b; }));
    document.body.append(caixa);
    aoSair(() => caixa.remove());
  }

  aoSair(ouvir('sala', () => {
    const s = rt.partidas.get(id);
    if (!s || !s.estado) return;
    sala = s;
    limite = Math.min(limite, Date.now() + s.estado.acabaEm);
    // O relógio: a estimativa mais cedo é a mais certa (a mensagem só pode chegar atrasada).
    inicio = Math.min(inicio, Date.now() + s.estado.largadaEm);
    if (s.estado.fase !== faseVista) {
      faseVista = s.estado.fase;
      faseInicio = Date.now() + s.estado.faseEm;
      jt.aoFase(s.estado.fase);
    } else {
      faseInicio = Math.min(faseInicio, Date.now() + s.estado.faseEm);
    }
    desenharPainel();
    if (s.status === 'fim') terminou(s);
  }));
  aoSair(ouvir('sala:fechada', () => { if (!rt.partidas.get(id)) terminou(null); }));
  aoSair(ouvir('junto:pos', m => { if (m.id === id && m.i !== jt.eu) jt.aoPos(m.i, m.d); }));
  aoSair(ouvir('junto:quadro', m => { if (m.id === id) jt.aoQuadro(m.q); }));
  aoSair(ouvir('junto:evento', m => {
    if (m.id !== id) return;
    const ev = m.ev || {};
    switch (ev.tipo) {
      case 'pegou': jt.aoPegou(ev.i, ev.chave, ev.valor); break;
      case 'renasce': jt.aoRenascer(ev.i); break;
      case 'fora': jt.aoFora(ev.i); break;
      case 'chegou': jt.aoChegou(ev.i); break;
      case 'fase': break; // a fase nova chega junto com a sala (com a hora de começar)
      case 'pontos': {
        const g = sala.estado?.p?.[ev.i];
        if (g) { g.pontos = ev.n; desenharPainel(); }
        break;
      }
      default: jt.aoEvento(ev.i, ev);
    }
  }));
  const intervalo = setInterval(tique, 200);
  aoSair(() => { clearInterval(intervalo); clearTimeout(timerPos); contagem.remove(); });
  desenharPainel();
  setTimeout(tique, 0);
  return jt;
}

