// Mesas compartilhadas na tela: Campo Minado, Quebra-cabeça e Memória, cada um com versus e co-op.
// O tabuleiro fica no servidor (src/mesa.js); aqui só se desenha e se manda o clique de cada um.

import { h, trocar, icone, botao, cabecalho, avatar, get, pode, confirmar } from '../core.js';
import { enviar, entrarNaPartida, rt } from '../tempo-real.js';
import { pintarCasa, DIFICULDADES } from './jogos-sozinho.js';
import { cartaMemoria, FIGURAS, estiloPeca, recortarQuadrado } from './recreacao.js';

const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const CORES = ['#d8b13a', '#d8674a', '#5aa0d8', '#b77be6', '#7fb069', '#e48ab8'];
const MODOS_MEMORIA = {
  versus: { nome: 'Versus: quem acha mais pares', texto: 'Cada um vira duas cartas na sua vez. Achou o par, joga de novo. Vence quem achar mais pares.' },
  coop: { nome: 'Co-op: a equipe contra a meta', texto: 'Todos jogam juntos, cada um na sua vez. A equipe precisa achar todos os pares sem passar da meta de jogadas.' },
};
const MODOS_MINADO = {
  versus: { nome: 'Versus: quem abre mais casas', texto: 'Todos abrem o mesmo campo ao mesmo tempo. Cada casa aberta é sua; quem pisa numa armadilha está fora. Vence quem abrir mais.' },
  coop: { nome: 'Co-op: a equipe limpa o campo', texto: 'Todos abrem o mesmo campo. Cuidado: se alguém pisar numa armadilha, a equipe inteira perde.' },
};
const MODOS_QUEBRA = {
  versus: { nome: 'Versus: quem põe mais peças', texto: 'A mesma imagem para todos: cada peça que você põe no lugar certo fica presa e é sua. Vence quem puser mais.' },
  coop: { nome: 'Co-op: a equipe monta junta', texto: 'Todos montam a mesma imagem, trocando as peças de lugar.' },
};
const MODOS = { minado: MODOS_MINADO, quebra: MODOS_QUEBRA, memoria: MODOS_MEMORIA };
const SUB = {
  minado: s => MODOS_MINADO[s.opcoes?.modo || 'coop'].texto,
  quebra: s => MODOS_QUEBRA[s.opcoes?.modo || 'coop'].texto,
  memoria: s => MODOS_MEMORIA[s.opcoes?.modo || 'versus'].texto,
};
const versus = s => s.opcoes?.modo === 'versus';
const ICONE = { minado: 'minado', quebra: 'peca', memoria: 'cartas' };

// A imagem recortada do quebra-cabeça fica guardada (recortar é demorado).
const imagens = new Map();
function imagemDoQuebra(src, depois) {
  if (imagens.has(src)) return imagens.get(src);
  imagens.set(src, null);
  recortarQuadrado(src).then(url => { imagens.set(src, url); depois(); }).catch(() => imagens.delete(src));
  return null;
}

// Escolha local de peça no quebra-cabeça (a primeira das duas que vão trocar).
let escolhida = null;

export function telaMesa(s, { sair, sairJa, redesenhar }) {
  const jogador = s.eu >= 0;
  const eu = jogador ? s.jogadores[s.eu] : null;
  const souDono = jogador && s.dono === eu.id;
  const botoes = [];
  if (jogador && s.status === 'esperando') botoes.push(botao(souDono ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: sair }));
  else if (jogador && s.status === 'jogando' && !eu.saiu) {
    botoes.push(botao('Sair', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: async () => { if (await confirmar('Você sai desta partida (os outros continuam).', { titulo: 'Sair?', ok: 'Sair', perigo: true })) sairJa(); } }));
  } else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
  const topo = cabecalho({ titulo: s.nomeJogo, icone: ICONE[s.jogo], voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes, sub: SUB[s.jogo](s) });
  if (s.status === 'esperando' || !s.estado) return [topo, espera(s, { jogador, souDono })];
  const e = s.estado;
  const corpo = s.jogo === 'minado' ? campoMinado(s, e) : s.jogo === 'quebra' ? quebraCabeca(s, e, redesenhar) : memoria(s, e);
  return [topo, h('div', { class: 'mesa' }, corpo, lateral(s, e)), s.status === 'fim' && fim(s, e, { jogador, souDono })];
}

/* Sala de espera: quem está e as opções (quem abriu escolhe). */
function espera(s, { jogador, souDono }) {
  const o = s.opcoes || {};
  const mudar = novas => enviar('sala:opcoes', { id: s.id, opcoes: novas });
  const seg = (lista, atual, aoEscolher) => h('div', { class: 'segmentado' }, lista.map(([k, nome]) => h('button', {
    type: 'button', class: `seg ${k === atual ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => aoEscolher(k),
  }, nome)));
  const modos = h('div', { class: 'modos-escolha' }, Object.entries(MODOS[s.jogo]).map(([k, m]) => h('button', {
    type: 'button', class: `modo-opcao ${k === o.modo ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ modo: k }),
  }, h('strong', null, m.nome), h('small', null, m.texto))));
  let opcoes;
  const n = s.jogadores.length;
  if (s.jogo === 'minado') {
    opcoes = [modos, seg(Object.entries(DIFICULDADES).map(([k, d]) => [k, `${d.nome} (${d.col}x${d.lin}, ${d.minas})`]), o.dificuldade, k => mudar({ dificuldade: k })),
      n > 1 && h('p', { class: 'suave' }, `Com ${n} pessoas o campo tem ${Math.round(12 * (n - 1))}% mais armadilhas.`)];
  } else if (s.jogo === 'memoria') {
    opcoes = [modos, seg([['4x4', '4x4 (8 pares)'], ['4x6', '4x6 (12 pares)'], ['6x6', '6x6 (18 pares)']], o.tamanho, k => mudar({ tamanho: k }))];
  } else {
    opcoes = [modos, seg([[3, '3x3'], [4, '4x4'], [5, '5x5']], o.n, k => mudar({ n: k })),
      n >= 3 && h('p', { class: 'suave' }, `Com ${n} pessoas a imagem tem pelo menos ${n >= 5 ? '5x5' : '4x4'} peças.`),
      fotosDoQuebra(s, souDono, mudar)];
  }
  const basta = o.modo === 'versus' ? s.jogadores.length >= 2 : s.jogadores.length >= 1;
  return h('div', { class: 'quiz-espera painel' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na sala: ${s.jogadores.length} de ${s.max}`)),
    h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
      avatar(p.nome, '', p.foto), h('span', null, p.nome),
      p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
    h('div', { class: 'mesa-opcoes' }, opcoes),
    !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala escolhe as opções.'),
    h('div', { class: 'quiz-espera-acao' },
      souDono
        ? [botao(basta ? 'Começar' : 'Esperando mais gente...', { classe: 'btn-ouro btn-grande', icone: 'frente', desativado: !basta, onclick: () => enviar('sala:comecar', { id: s.id }) }),
          h('p', { class: 'suave' }, o.modo === 'versus' ? 'Versus precisa de pelo menos 2 pessoas (até 6).' : 'Dá para jogar sozinho, mas a graça é chamar mais gente (até 6).')]
        : jogador
          ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando quem abriu a sala começar...')
          : [s.jogadores.length < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
            h('p', { class: 'suave' }, 'Você está assistindo.')]));
}

export function fotosDoQuebra(s, souDono, mudar) {
  const grade = h('div', { class: 'qc-fotos mesa-fotos' });
  const opcao = (src, titulo) => h('button', {
    class: `qc-foto ${s.opcoes?.src === src ? 'escolhida' : ''}`.trim(), type: 'button', title: titulo, disabled: !souDono,
    onclick: () => mudar({ src, titulo }),
  }, h('img', { src, alt: titulo, loading: 'lazy' }));
  const brasao = opcao('/img/brasao.png', 'Brasão da Casa Luckham');
  trocar(grade, brasao);
  (pode('galeria.ver') ? get('/api/galeria/fotos') : Promise.resolve({ fotos: [] }))
    .then(({ fotos }) => trocar(grade, brasao, fotos.filter(f => !/\.gif$/i.test(f.arquivo)).slice(0, 30).map(f => opcao(f.arquivo, f.titulo || 'Foto da galeria'))))
    .catch(() => {});
  return grade;
}

/* Campo Minado: o mesmo campo para todos. */
function campoMinado(s, e) {
  const d = DIFICULDADES[e.d];
  const vs = versus(s);
  const estouFora = vs && s.eu >= 0 && e.fora?.[s.eu];
  const podeJogar = s.eu >= 0 && s.status === 'jogando' && !s.jogadores[s.eu].saiu && !estouFora;
  const grade = h('div', { class: `minado-grade ${s.status === 'fim' ? 'terminou' : ''} ${vs ? 'versus' : ''}`.trim(), style: { '--col': d.col, '--lin': d.lin } });
  let segurar = null;
  let segurou = false;
  const jogar = (casa, tipo) => podeJogar && enviar('sala:jogar', { id: s.id, jogada: { tipo, casa } });
  [...e.v].forEach((c, i) => {
    const el = h(podeJogar ? 'button' : 'div', { type: podeJogar ? 'button' : null, 'data-i': i, class: 'minado-casa fechada' });
    pintarCasa(el, c);
    if (e.ultimo?.casa === i) { el.classList.add('ultimo'); el.style.setProperty('--quem', CORES[e.ultimo.i % CORES.length]); }
    const dono = vs && e.q ? parseInt(e.q[i], 36) : NaN;
    if (!Number.isNaN(dono)) { el.classList.add('de-alguem'); el.style.setProperty('--dono', CORES[dono % CORES.length]); }
    grade.append(el);
  });
  grade.addEventListener('click', ev => {
    const el = ev.target.closest('[data-i]');
    if (!el) return;
    if (segurou) { segurou = false; return; }
    jogar(Number(el.dataset.i), 'abrir');
  });
  grade.addEventListener('contextmenu', ev => {
    const el = ev.target.closest('[data-i]');
    if (!el) return;
    ev.preventDefault();
    if (!segurou) jogar(Number(el.dataset.i), 'marcar');
  });
  grade.addEventListener('pointerdown', ev => {
    const el = ev.target.closest('[data-i]');
    if (!el || ev.pointerType === 'mouse') return;
    segurou = false;
    clearTimeout(segurar);
    segurar = setTimeout(() => { segurou = true; jogar(Number(el.dataset.i), 'marcar'); }, 380);
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) grade.addEventListener(t, () => clearTimeout(segurar));
  return h('div', { class: 'jogo-area' },
    h('div', { class: 'cobra-placar-linha' },
      h('span', null, icone('minado'), ' ', h('strong', null, e.restam)),
      vs && s.eu >= 0 && h('span', null, 'Suas casas: ', h('strong', null, e.casas?.[s.eu] || 0)),
      estouFora && s.status === 'jogando' && h('span', { class: 'mesa-fora' }, 'Você pisou numa armadilha: assistindo'),
      h('span', null, icone('relogio'), ' ', h('strong', { 'data-desde': s.status === 'jogando' ? Date.now() - e.seg * 1000 : null }, relogio(e.seg))),
      h('span', { class: 'suave' }, `${d.nome} · botão direito ou segurar o dedo põe bandeira`)),
    h('div', { class: `minado-moldura ${d.col > 16 ? 'largo' : ''}`.trim() }, grade));
}

/* Quebra-cabeça: as mesmas peças para todos. */
function quebraCabeca(s, e, redesenhar) {
  const url = imagemDoQuebra(e.src, redesenhar);
  const podeJogar = s.eu >= 0 && s.status === 'jogando' && !s.jogadores[s.eu].saiu;
  const presa = i => versus(s) && e.deQuem && e.deQuem[i] !== -1;
  if (escolhida != null && (escolhida >= e.p.length || !podeJogar)) escolhida = null;
  const tabuleiro = h('div', { class: `qc-tabuleiro ${e.fim ? 'resolvido' : ''}`.trim(), style: { '--n': e.n } },
    !url ? h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' }))
      : e.p.map((p, i) => h(podeJogar && !presa(i) ? 'button' : 'div', {
        type: podeJogar && !presa(i) ? 'button' : null,
        class: ['qc-peca', i === escolhida && 'selecionada', p === i && 'no-lugar', presa(i) && e.deQuem[i] >= 0 && 'presa', e.ultimo && (e.ultimo.a === i || e.ultimo.b === i) && 'trocada'].filter(Boolean).join(' '),
        style: { ...estiloPeca(url, e.n, p), '--quem': CORES[(e.ultimo?.i ?? 0) % CORES.length], '--dono': presa(i) && e.deQuem[i] >= 0 ? CORES[e.deQuem[i] % CORES.length] : null },
        onclick: podeJogar && !presa(i) ? () => {
          if (escolhida == null) { escolhida = i; redesenhar(); return; }
          if (escolhida !== i) enviar('sala:jogar', { id: s.id, jogada: { tipo: 'trocar', a: escolhida, b: i } });
          escolhida = null;
          redesenhar();
        } : null,
      })));
  return h('div', { class: 'jogo-area' },
    h('div', { class: 'cobra-placar-linha' },
      h('span', null, icone('relogio'), ' ', h('strong', { 'data-desde': s.status === 'jogando' ? Date.now() - e.seg * 1000 : null }, relogio(e.seg))),
      versus(s) && s.eu >= 0 ? h('span', null, 'Suas peças: ', h('strong', null, e.certas?.[s.eu] || 0)) : h('span', null, 'Trocas: ', h('strong', null, e.movs)),
      h('span', { class: 'suave' }, `${e.titulo || 'Imagem'} · clique numa peça e depois em outra para trocar`)),
    h('div', { class: 'qc-moldura' }, tabuleiro));
}

/* Memória: cada um na sua vez. */
function memoria(s, e) {
  const [lin, col] = { '4x4': [4, 4], '4x6': [4, 6], '6x6': [6, 6] }[e.t];
  const minhaVez = s.eu >= 0 && s.status === 'jogando' && e.vez === s.eu && e.abertas.length < 2;
  const grade = h('div', { class: 'mem-grade' }, e.v.map((f, i) => {
    const carta = cartaMemoria(f >= 0 ? FIGURAS[f] : null, minhaVez && f < 0 ? () => enviar('sala:jogar', { id: s.id, jogada: { casa: i } }) : null);
    if (f >= 0 && e.quem[i] < 0) carta.classList.add('virada');
    if (e.quem[i] >= 0) { carta.classList.add('achada'); carta.style.setProperty('--quem', CORES[e.quem[i] % CORES.length]); }
    if (!minhaVez && carta.tagName === 'BUTTON') carta.disabled = true;
    return carta;
  }));
  const vezDe = s.jogadores[e.vez];
  const texto = s.status === 'fim' ? '' : e.vez === s.eu ? (e.abertas.length === 1 ? 'Sua vez: vire a segunda carta!' : 'Sua vez: vire duas cartas!') : `Vez de ${vezDe?.nome || '...'}`;
  return h('div', { class: 'jogo-area' },
    h('div', { class: 'cobra-placar-linha' },
      h('span', { class: `mesa-vez ${e.vez === s.eu && s.status === 'jogando' ? 'minha' : ''}`.trim() }, texto),
      e.meta ? h('span', null, 'Jogadas: ', h('strong', null, `${e.jogadas} de ${e.meta}`)) : h('span', null, 'Jogadas: ', h('strong', null, e.jogadas))),
    h('div', { class: 'mem-moldura', style: { '--colunas': col, '--linhas': lin } }, grade));
}

/* Ao lado: quem está jogando (e os pares de cada um, na memória). */
function lateral(s, e) {
  return h('aside', { class: 'painel mesa-lado' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), 'Na mesa')),
    h('ol', { class: 'cobras-lista' }, s.jogadores.map((p, i) => h('li', { class: `${i === s.eu ? 'eu-linha' : ''} ${p.saiu ? 'fora' : ''} ${s.jogo === 'memoria' && e.vez === i && s.status === 'jogando' ? 'na-vez' : ''}`.replace(/\s+/g, ' ').trim() },
      h('span', { class: 'cobras-cor', style: { background: CORES[i % CORES.length] } }),
      h('span', { class: 'cobras-nome' }, h('strong', null, p.nome), h('small', null, p.saiu ? 'saiu' : !p.conectado ? 'caiu' : i === s.eu ? 'você' : '')),
      e.vencedores?.includes(i) && versus(s) && h('span', { class: 'coroa' }, icone('coroa')),
      s.jogo === 'minado' && versus(s) && e.fora?.[i] && h('small', { class: 'mesa-fora' }, 'fora'),
      s.jogo === 'memoria' && h('span', { class: 'cobras-pontos', title: 'Pares achados' }, e.pares[i] || 0),
      s.jogo === 'minado' && versus(s) && h('span', { class: 'cobras-pontos', title: 'Casas abertas' }, e.casas?.[i] || 0),
      s.jogo === 'quebra' && h('span', { class: 'cobras-pontos', title: versus(s) ? 'Peças postas no lugar' : 'Trocas feitas' }, versus(s) ? e.certas?.[i] || 0 : e.porPessoa?.[i] || 0)))),
    s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} assistindo`));
}

function fim(s, e, { jogador, souDono }) {
  let titulo;
  let venci = false;
  if (versus(s) && s.jogo !== 'memoria') {
    const v = e.vencedores || [];
    venci = v.includes(s.eu);
    const oque = s.jogo === 'minado' ? 'abriu mais casas' : 'pôs mais peças';
    titulo = v.length === 1 ? (venci ? `Você ${oque} e venceu!` : `${s.jogadores[v[0]].nome} ${oque} e venceu!`) : 'Empate!';
  } else if (s.jogo === 'minado') {
    venci = e.fim === 'ganhou';
    titulo = venci ? `Campo limpo! A equipe venceu em ${relogio(e.seg)}.` : `${s.jogadores[e.quemExplodiu]?.nome || 'Alguém'} pisou numa armadilha! A equipe perdeu.`;
  } else if (s.jogo === 'quebra') {
    venci = true;
    titulo = `Montado! ${e.movs} trocas em ${relogio(e.seg)}.`;
  } else if (e.modo === 'coop') {
    venci = e.fim === 'ganhou';
    titulo = venci ? `A equipe achou todos os pares em ${e.jogadas} jogadas (a meta era ${e.meta})!` : `Passou da meta de ${e.meta} jogadas. Tentem de novo!`;
  } else {
    const v = e.vencedores || [];
    venci = v.includes(s.eu);
    titulo = v.length === 1 ? (venci ? 'Você achou mais pares e venceu!' : `${s.jogadores[v[0]].nome} achou mais pares e venceu!`) : 'Empate nos pares!';
  }
  return h('div', { class: 'partida-rodape mesa-fim' },
    h('p', { class: `partida-status ${venci ? 'vitoria' : 'destaque'}` }, titulo),
    souDono && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: () => enviar('sala:revanche', { id: s.id }) }),
    jogador && !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outra.'),
    h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão'));
}
