// Desafio: os jogos de uma pessoa só jogados por várias pessoas ao mesmo tempo, com a mesma semente
// (mesmo labirinto, mesmas cenouras, mesmo campo, mesmo embaralhado). Cada um joga no seu navegador e
// manda os pontos; o servidor (src/desafio.js) marca o tempo e decide quem venceu.
//  - desafioNoJogo(jogo): usado pelas telas dos jogos (Pac-Coelho, Cobrinha, 2048, Campo Minado, Quebra-cabeça).
//  - telaDesafio(sala): a sala do desafio (espera, placar ao vivo e resultado).

import { h, trocar, icone, botao, cabecalho, avatar, confirmar, aoSair, num } from '../core.js';
import { rt, ouvir, enviar, entrarNaPartida, criarPartida } from '../tempo-real.js';
import { fotosDoQuebra } from './mesa.js';

const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const CORES = ['#d8b13a', '#d8674a', '#5aa0d8', '#b77be6', '#7fb069', '#e48ab8'];

// As mesmas metas e tempos de src/desafio.js (só para mostrar antes de começar).
export const JOGOS_DESAFIO = {
  pacman: { nome: 'Pac-Coelho', icone: 'coelho', rota: '#/recreacao/pac-coelho', minutos: 3, meta: 3000, coop: true, unidade: n => `${num(n)} pts` },
  cobrinha: { nome: 'Cobrinha', icone: 'cobra', rota: '#/recreacao/cobrinha', minutos: 3, meta: 15, coop: true, unidade: n => `${n} ${n === 1 ? 'cenoura' : 'cenouras'}` },
  2048: { nome: '2048', icone: 'blocos', rota: '#/recreacao/2048', minutos: 3, meta: 2500, coop: true, unidade: n => `${num(n)} pts` },
  barris: { nome: 'Barris do Raposo', icone: 'barril', rota: '#/recreacao/barris', minutos: 3, meta: 4000, coop: true, unidade: n => `${num(n)} pts` },
  supercoelho: { nome: 'Super Coelho', icone: 'cenoura', rota: '#/recreacao/super-coelho', minutos: 4, meta: 5000, coop: true, unidade: n => `${num(n)} pts` },
  travessia: { nome: 'Travessia', icone: 'estrada', rota: '#/recreacao/travessia', minutos: 3, meta: 60, coop: true, unidade: n => `${n} ${n === 1 ? 'fileira' : 'fileiras'}` },
  minado: { nome: 'Campo Minado', icone: 'minado', rota: '#/recreacao/campo-minado', minutos: 6, coop: false, unidade: n => `${n} casas abertas` },
  quebra: { nome: 'Quebra-cabeça', icone: 'peca', rota: '#/recreacao/quebra-cabeca', minutos: 5, coop: false, unidade: n => `${n} peças no lugar` },
};
const DIFICULDADES = { facil: 'Fácil (9x9, 10)', medio: 'Médio (16x16, 40)', dificil: 'Difícil (30x16, 99)' };

export function explicacao(jogo, modo, n = 1) {
  const d = JOGOS_DESAFIO[jogo];
  if (jogo === 'minado') return 'Corrida: todos recebem o mesmo campo, com a mesma primeira casa já aberta. Quem limpar primeiro vence; quem pisar numa armadilha está fora.';
  if (jogo === 'quebra') return 'Corrida: a mesma foto, embaralhada do mesmo jeito para todos. Quem montar primeiro vence.';
  if (modo === 'coop') return `Meta da equipe: todos jogam ao mesmo tempo e os pontos somam (quem perde joga de novo e continua somando). Cheguem a ${d.unidade(d.meta * Math.max(1, n))} em ${d.minutos} minutos (${d.unidade(d.meta)} por pessoa).`;
  return `Corrida: todos jogam a mesma partida (mesma sorte para todos) ao mesmo tempo, por até ${d.minutos} minutos. Vence quem fizer mais.`;
}

// Abre a sala de um desafio (no salão, nos botões Versus e Co-op dos jogos de uma pessoa só).
export function abrirDesafio(jogo, modo) {
  criarPartida('desafio', { jogo, modo });
}

// Gerador de números "aleatórios" a partir da semente: a mesma semente dá a mesma sequência para todos.
export function sorteComSemente(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const minhaSalaDeDesafio = jogo => {
  const s = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  return s && s.jogo === 'desafio' && s.status === 'jogando' && s.opcoes?.jogo === jogo && s.eu >= 0 && s.estado
    && !s.jogadores[s.eu].saiu && !s.estado.prog[s.eu]?.fim ? s : null;
};
export const emDesafio = jogo => !!minhaSalaDeDesafio(jogo);

// O que o desafio pôs na tela do jogo. Devolve null se a pessoa não está num desafio deste jogo.
// aoLargar: começa o jogo (na hora da largada). aoAcabar: o desafio acabou antes (tempo, alguém completou, meta).
export function desafioNoJogo(jogo, { aoLargar, aoAcabar } = {}) {
  const s0 = minhaSalaDeDesafio(jogo);
  if (!s0) return null;
  const id = s0.id;
  const def = JOGOS_DESAFIO[jogo];
  let largada = Date.now() + s0.estado.largadaEm;
  let limite = Date.now() + s0.estado.acabaEm;
  let terminei = false;
  let acabou = false;
  let largou = false;
  let ultimos = 0;
  let enviadoEm = 0;
  let pendente = null;

  const tempoEl = h('strong', null, relogio(s0.estado.duracao / 1000));
  const lista = h('ol', { class: 'desafio-lista' });
  const meta = h('div', { class: 'desafio-meta', hidden: s0.estado.modo !== 'coop' });
  const painel = h('aside', { class: 'painel jogo-lateral desafio-lado' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone(s0.estado.modo === 'coop' ? 'usuarios' : 'trofeu'), `Desafio ${s0.estado.modo === 'coop' ? 'co-op' : 'versus'}`)),
    h('p', { class: 'desafio-tempo' }, icone('relogio'), ' Falta ', tempoEl),
    meta, lista,
    h('p', { class: 'suave desafio-dica' }, 'Sair desta tela encerra a sua partida do desafio.'));
  const contagem = h('div', { class: 'desafio-contagem', hidden: true });
  document.body.append(contagem);

  function desenhar(s) {
    const e = s.estado;
    if (!e) return;
    largada = Date.now() + e.largadaEm;
    limite = Date.now() + e.acabaEm;
    const ordem = s.jogadores.map((p, i) => ({ p, i, g: e.prog[i] }))
      .sort((a, b) => (e.modo === 'coop' ? 0 : (b.g.completo - a.g.completo) || b.g.pontos - a.g.pontos));
    trocar(lista, ordem.map(({ p, i, g }) => h('li', { class: `${i === s.eu ? 'eu-linha' : ''} ${p.saiu ? 'fora' : ''}`.trim() },
      h('span', { class: 'cobras-cor', style: { background: CORES[i % CORES.length] } }),
      h('span', { class: 'desafio-nome' }, p.nome, h('small', null, p.saiu ? 'saiu' : g.completo ? `terminou em ${relogio(g.seg)}` : g.fim ? (jogo === 'minado' ? 'pisou numa armadilha' : 'terminou') : 'jogando')),
      h('strong', null, def.unidade(g.pontos)))));
    if (e.modo === 'coop') {
      const pct = Math.min(100, Math.round((e.total / e.meta) * 100));
      trocar(meta, h('div', { class: 'desafio-meta-texto' }, 'Equipe: ', h('strong', null, def.unidade(e.total)), ` de ${def.unidade(e.meta)}`),
        h('div', { class: `barra ${pct >= 100 ? 'completa' : ''}`.trim() }, h('div', { class: 'barra-cheia', style: { width: `${pct}%` } })));
    }
  }

  function tique() {
    const agora = Date.now();
    if (acabou) { tempoEl.textContent = '0:00'; contagem.hidden = true; return; }
    tempoEl.textContent = relogio(Math.max(0, Math.ceil((agora < largada ? limite - largada : limite - agora) / 1000)));
    if (!largou && agora >= largada) {
      largou = true;
      contagem.hidden = false;
      trocar(contagem, h('span', { class: 'desafio-ja' }, 'Já!'));
      setTimeout(() => { contagem.hidden = true; }, 700);
      aoLargar?.();
    } else if (!largou) {
      contagem.hidden = false;
      trocar(contagem, h('span', null, Math.ceil((largada - agora) / 1000)), h('small', null, `Desafio de ${def.nome}`));
    }
  }

  function terminouLaFora(s) {
    if (acabou) return;
    acabou = true;
    aoAcabar?.();
    const caixa = h('div', { class: 'desafio-fim', role: 'dialog' },
      h('h2', null, icone('trofeu'), 'O desafio acabou!'),
      h('p', null, s ? textoDoFim(s) : 'A sala foi fechada.'),
      s && h('a', { class: 'btn btn-ouro', href: `#/recreacao/sala/${id}`, onclick: () => caixa.remove() }, 'Ver o resultado'),
      h('a', { class: 'btn', href: '#/recreacao', onclick: () => caixa.remove() }, 'Voltar ao salão'));
    document.body.append(caixa);
    aoSair(() => caixa.remove());
  }

  aoSair(ouvir('sala', () => {
    const s = rt.partidas.get(id);
    if (!s) return;
    desenhar(s);
    if (s.status === 'fim') terminouLaFora(s);
  }));
  aoSair(ouvir('sala:fechada', () => { if (!rt.partidas.get(id)) terminouLaFora(null); }));
  const intervalo = setInterval(tique, 200);
  aoSair(() => {
    clearInterval(intervalo);
    clearTimeout(pendente);
    contagem.remove();
    // Saiu da tela no meio do desafio: vale o que fez até aqui (não dá para recomeçar a mesma partida).
    if (!terminei && !acabou && largou) enviar('sala:jogar', { id, jogada: { tipo: 'fim', pontos: ultimos, completo: false } }, { silencioso: true });
  });
  desenhar(s0);
  setTimeout(tique, 0); // depois que a tela do jogo terminou de se montar

  const mandar = () => {
    pendente = null;
    enviadoEm = Date.now();
    enviar('sala:jogar', { id, jogada: { tipo: 'progresso', pontos: ultimos } }, { silencioso: true });
  };

  // Co-op: quem perde joga de novo e os pontos continuam somando para a equipe até o tempo acabar.
  const coop = s0.estado.modo === 'coop';
  let guardados = 0; // pontos das partidas anteriores (co-op)
  const botaoSala = () => h('a', { class: `btn ${coop ? '' : 'btn-ouro'}`.trim(), href: `#/recreacao/sala/${id}` }, icone('trofeu'), h('span', null, 'Ver o desafio'));

  return {
    id,
    coop,
    opcoes: s0.opcoes,
    sorte: sorteComSemente(s0.estado.semente),
    painel,
    largou: () => largou,
    acabou: () => acabou || terminei,
    // Pontos da partida atual (no máximo uns 3 envios por segundo).
    progresso(pontos) {
      if (terminei || acabou || !largou) return;
      ultimos = guardados + pontos;
      if (pendente) return;
      pendente = setTimeout(mandar, Math.max(0, 350 - (Date.now() - enviadoEm)));
    },
    // A partida desta pessoa acabou (perdeu as vidas, bateu, sem jogadas, limpou o campo, montou).
    // No co-op, os pontos ficam guardados e dá para jogar de novo.
    terminar(pontos, completo = false) {
      if (terminei || acabou) return;
      clearTimeout(pendente);
      pendente = null;
      if (coop) {
        guardados += pontos;
        ultimos = guardados;
        mandar();
        return;
      }
      terminei = true;
      ultimos = pontos;
      enviar('sala:jogar', { id, jogada: { tipo: 'fim', pontos, completo } }, { silencioso: true });
    },
    // Os botões da caixa de fim de jogo: no co-op, jogar de novo (somando); no versus, só ver o desafio.
    botoesFim(jogarDeNovo) {
      if (!coop || acabou) return botaoSala();
      return [h('p', { class: 'suave' }, `Seus pontos já somaram para a equipe (${JOGOS_DESAFIO[jogo].unidade(guardados)}).`),
        botao('Jogar de novo e somar mais', { classe: 'btn-ouro', icone: 'frente', onclick: jogarDeNovo }), botaoSala()];
    },
  };
}

function textoDoFim(s) {
  const e = s.estado;
  const v = e.vencedores || [];
  const def = JOGOS_DESAFIO[e.jogo];
  if (e.modo === 'coop') {
    return v.length ? `A equipe chegou na meta: ${def.unidade(e.total)} de ${def.unidade(e.meta)}!` : `A equipe fez ${def.unidade(e.total)}, mas a meta era ${def.unidade(e.meta)}.`;
  }
  if (v.length !== 1) return 'Empate! Ninguém ficou na frente sozinho.';
  const quem = v[0] === s.eu ? 'Você' : s.jogadores[v[0]].nome;
  const g = e.prog[v[0]];
  if (g.completo) return `${quem} ${e.jogo === 'minado' ? 'limpou o campo' : 'montou a imagem'} primeiro, em ${relogio(g.seg)}!`;
  return `${quem} venceu com ${def.unidade(g.pontos)}!`;
}

/* ─── Sala do desafio ─────────────────────────────── */

const fuiJogar = new Set(); // para ir sozinho para o jogo só uma vez por rodada

export function telaDesafio(s, { sair, sairJa }) {
  const o = s.opcoes || {};
  const def = JOGOS_DESAFIO[o.jogo];
  const jogador = s.eu >= 0;
  const eu = jogador ? s.jogadores[s.eu] : null;
  const souDono = jogador && s.dono === eu.id;
  const e = s.estado;
  const aindaJogo = jogador && s.status === 'jogando' && !eu.saiu && e && !e.prog[s.eu]?.fim;

  // Começou: quem está na sala vai direto para o jogo.
  if (aindaJogo && location.hash === `#/recreacao/sala/${s.id}`) {
    const rodada = `${s.id}:${e.semente}`;
    if (!fuiJogar.has(rodada)) {
      fuiJogar.add(rodada);
      setTimeout(() => { location.hash = def.rota; }, 0);
    }
  }

  const botoes = [];
  if (jogador && s.status === 'esperando') botoes.push(botao(souDono ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: sair }));
  else if (jogador && s.status === 'jogando' && !eu.saiu) {
    botoes.push(botao('Sair', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: async () => { if (await confirmar('Você sai deste desafio (os outros continuam).', { titulo: 'Sair?', ok: 'Sair', perigo: true })) sairJa(); } }));
  } else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
  const topo = cabecalho({ titulo: s.nomeJogo, icone: def.icone, voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes, sub: explicacao(o.jogo, o.modo, s.jogadores.length) });

  if (s.status === 'esperando' || !e) return [topo, espera(s, { jogador, souDono, def })];
  return [topo, h('div', { class: 'partida-caixa desafio-sala' },
    s.status === 'fim'
      ? h('p', { class: `partida-status ${(e.vencedores || []).includes(s.eu) ? 'vitoria' : 'destaque'}` }, textoDoFim(s))
      : h('p', { class: 'partida-status' }, icone('relogio'), ' Falta ', h('strong', { 'data-ate': Date.now() + e.acabaEm }, relogio(Math.max(0, e.acabaEm / 1000)))),
    aindaJogo && h('a', { class: 'btn btn-ouro btn-grande', href: def.rota }, icone('frente'), h('span', null, `Ir jogar ${def.nome}`)),
    e.modo === 'coop' && h('div', { class: 'desafio-meta' },
      h('div', { class: 'desafio-meta-texto' }, 'Equipe: ', h('strong', null, def.unidade(e.total)), ` de ${def.unidade(e.meta)}`),
      h('div', { class: `barra ${e.total >= e.meta ? 'completa' : ''}`.trim() }, h('div', { class: 'barra-cheia', style: { width: `${Math.min(100, Math.round((e.total / e.meta) * 100))}%` } }))),
    placar(s, def),
    s.status === 'fim' && h('div', { class: 'partida-rodape' },
      souDono && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: () => enviar('sala:revanche', { id: s.id }) }),
      jogador && !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outro.'),
      h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')),
    s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} assistindo`))];
}

function placar(s, def) {
  const e = s.estado;
  const v = e.vencedores || [];
  const ordem = s.jogadores.map((p, i) => ({ p, i, g: e.prog[i] }))
    .sort((a, b) => (b.g.completo - a.g.completo) || (a.g.completo ? a.g.seg - b.g.seg : b.g.pontos - a.g.pontos));
  return h('ol', { class: 'desafio-placar' }, ordem.map(({ p, i, g }, k) => h('li', { class: `${i === s.eu ? 'eu-linha' : ''} ${p.saiu ? 'fora' : ''}`.trim() },
    h('span', { class: 'desafio-pos' }, e.modo === 'coop' ? '' : `${k + 1}º`),
    avatar(p.nome, 'avatar-p', p.foto),
    h('span', { class: 'desafio-nome' }, h('strong', null, p.nome),
      h('small', null, p.saiu ? 'saiu' : g.completo ? `terminou em ${relogio(g.seg)}` : g.fim ? (e.jogo === 'minado' ? 'pisou numa armadilha' : 'terminou') : s.status === 'fim' ? 'o tempo acabou' : 'jogando...')),
    v.includes(i) && s.status === 'fim' && h('span', { class: 'coroa' }, icone('coroa')),
    h('strong', { class: 'desafio-pontos' }, def.unidade(g.pontos)))));
}

function espera(s, { jogador, souDono, def }) {
  const o = s.opcoes || {};
  const mudar = novas => enviar('sala:opcoes', { id: s.id, opcoes: novas });
  const seg = (lista, atual, aoEscolher) => h('div', { class: 'segmentado' }, lista.map(([k, nome]) => h('button', {
    type: 'button', class: `seg ${k === atual ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => aoEscolher(k),
  }, nome)));
  const opcoes = [];
  if (def.coop) {
    opcoes.push(h('div', { class: 'modos-escolha' }, [['versus', 'Versus: quem faz mais'], ['coop', 'Co-op: meta da equipe']].map(([k, nome]) => h('button', {
      type: 'button', class: `modo-opcao ${k === o.modo ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ modo: k }),
    }, h('strong', null, nome), h('small', null, explicacao(o.jogo, k, s.jogadores.length))))));
  }
  if (o.jogo === 'minado') opcoes.push(seg(Object.entries(DIFICULDADES), o.dificuldade, k => mudar({ dificuldade: k })));
  if (o.jogo === 'quebra') opcoes.push(seg([[3, '3x3'], [4, '4x4'], [5, '5x5']], o.n, k => mudar({ n: k })), fotosDoQuebra(s, souDono, mudar));
  const basta = o.modo === 'versus' ? s.jogadores.length >= 2 : s.jogadores.length >= 1;
  return h('div', { class: 'quiz-espera painel' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na sala: ${s.jogadores.length} de ${s.max}`)),
    h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
      avatar(p.nome, '', p.foto), h('span', null, p.nome),
      p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
    opcoes.length > 0 && h('div', { class: 'mesa-opcoes' }, opcoes),
    !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala escolhe as opções.'),
    h('div', { class: 'quiz-espera-acao' },
      souDono
        ? [botao(basta ? 'Começar' : 'Esperando mais gente...', { classe: 'btn-ouro btn-grande', icone: 'frente', desativado: !basta, onclick: () => enviar('sala:comecar', { id: s.id }) }),
          h('p', { class: 'suave' }, o.modo === 'versus' ? 'Versus precisa de pelo menos 2 pessoas (até 6).' : 'Dá para jogar sozinho contra a meta, mas a graça é chamar mais gente (até 6).')]
        : jogador
          ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando quem abriu a sala começar...')
          : [s.jogadores.length < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
            h('p', { class: 'suave' }, 'Você está assistindo.')]));
}
