// A sala de um jogo junto (versus ou co-op, todos no mesmo jogo): quem entrou, o modo, começar e o resultado.
// Quando começa, cada um vai sozinho para a tela do jogo (que se liga à sala por junto.js).

import { h, icone, botao, cabecalho, avatar, confirmar } from '../core.js';
import { enviar, entrarNaPartida, rt, criarPartida } from '../tempo-real.js';
import { CORES_JUNTO, textoDoFimJunto } from '../junto.js';

// Os jogos que dá para jogar juntos (os mesmos de src/junto.js) e o que cada modo quer dizer.
export const JOGOS_JUNTO = {
  travessia: {
    nome: 'Travessia', icone: 'estrada', rota: '#/recreacao/travessia', max: 6,
    versus: 'Todos atravessam o mesmo mundo ao mesmo tempo. Uma vida só: vence quem sobrar.',
    coop: 'A equipe atravessa junta até a linha de chegada; as vidas são da equipe e quem cai volta com os outros.',
  },
  barris: {
    nome: 'Barris do Raposo', icone: 'barril', rota: '#/recreacao/barris', max: 4,
    versus: 'Todos na mesma torre, com os mesmos barris: quem chegar primeiro na princesa vence. 3 vidas cada.',
    coop: 'Basta um chegar na princesa para a equipe passar de nível. 3 níveis, com as vidas da equipe.',
  },
  supercoelho: {
    nome: 'Super Coelho', icone: 'cenoura', rota: '#/recreacao/super-coelho', max: 4, fases: ['1-1 Campos', '1-2 Tocas', '1-3 Copas', '1-4 Castelo'],
    versus: 'Corrida na mesma fase: quem pegar o mastro (ou a alavanca do castelo) primeiro vence. 3 vidas cada.',
    coop: 'As quatro fases juntos: quando alguém chega no mastro, todos passam. As vidas são da equipe.',
  },
  pacman: {
    nome: 'Pac-Coelho', icone: 'coelho', rota: '#/recreacao/pac-coelho', max: 4,
    versus: 'Todos no mesmo labirinto: vence quem comer mais Lírios. As raposas caçam quem estiver mais perto.',
    coop: 'Todos no mesmo labirinto para limpar os Lírios juntos, com as vidas da equipe.',
  },
  2048: {
    nome: '2048', icone: 'blocos', rota: '#/recreacao/2048', max: 6,
    versus: 'Batalha: cada um no seu tabuleiro, todos na tela. Juntar blocos grandes joga pedras no tabuleiro dos outros; vence quem sobrar.',
    coop: 'Um tabuleiro só, e todos mexem nele ao mesmo tempo. Cheguem no bloco da meta antes do tempo acabar.',
  },
};

export function abrirJunto(jogo, modo) {
  criarPartida('junto', { jogo, modo });
}

const fuiJogar = new Set(); // para ir sozinho para o jogo só uma vez por partida

export function telaJunto(s, { sair, sairJa }) {
  const o = s.opcoes || {};
  const def = JOGOS_JUNTO[o.jogo];
  const jogador = s.eu >= 0;
  const eu = jogador ? s.jogadores[s.eu] : null;
  const souDono = jogador && s.dono === eu.id;
  const e = s.estado;
  const aindaJogo = jogador && s.status === 'jogando' && !eu.saiu && e && !e.p[s.eu]?.saiu;

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
    botoes.push(botao('Sair', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: async () => { if (await confirmar('Você sai da partida (os outros continuam).', { titulo: 'Sair?', ok: 'Sair', perigo: true })) sairJa(); } }));
  } else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
  const topo = cabecalho({ titulo: s.nomeJogo, icone: def.icone, voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes, sub: def[o.modo] });

  if (s.status === 'esperando' || !e) return [topo, espera(s, { jogador, souDono, def })];
  const v = e.vencedores || [];
  return [topo, h('div', { class: 'partida-caixa desafio-sala' },
    s.status === 'fim'
      ? h('p', { class: `partida-status ${v.includes(s.eu) ? 'vitoria' : 'destaque'}` }, textoDoFimJunto(s))
      : h('p', { class: 'partida-status' }, icone('jogos'), ' A partida está acontecendo.'),
    aindaJogo && s.status === 'jogando' && h('a', { class: 'btn btn-ouro btn-grande', href: def.rota }, icone('frente'), h('span', null, `Voltar para ${def.nome}`)),
    e.modo === 'coop' && e.vidasEquipe != null && h('p', { class: 'suave' }, icone('coracao'), ` Vidas da equipe: ${e.vidasEquipe}${e.fases > 1 ? ` · fase ${Math.min(e.fase + 1, e.fases)} de ${e.fases}` : ''}`),
    h('ol', { class: 'desafio-placar' }, s.jogadores.map((p, i) => {
      const g = e.p[i] || {};
      return h('li', { class: `${i === s.eu ? 'eu-linha' : ''} ${p.saiu || g.saiu ? 'fora' : ''}`.trim() },
        h('span', { class: 'cobras-cor', style: { background: CORES_JUNTO[i % CORES_JUNTO.length] } }),
        avatar(p.nome, 'avatar-p', p.foto),
        h('span', { class: 'desafio-nome' }, h('strong', null, p.nome),
          h('small', null, p.saiu || g.saiu ? 'saiu' : g.chegou ? 'chegou' : g.fora ? 'ficou de fora' : s.status === 'fim' ? 'até o fim' : 'jogando...')),
        v.includes(i) && s.status === 'fim' && h('span', { class: 'coroa' }, icone('coroa')),
        h('strong', { class: 'desafio-pontos' }, g.pontos ? String(g.pontos) : ''));
    })),
    s.status === 'fim' && h('div', { class: 'partida-rodape' },
      souDono && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: () => enviar('sala:revanche', { id: s.id }) }),
      jogador && !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outra.'),
      h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')),
    s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} assistindo`))];
}

function espera(s, { jogador, souDono, def }) {
  const o = s.opcoes || {};
  const mudar = novas => enviar('sala:opcoes', { id: s.id, opcoes: novas });
  const n = s.jogadores.length;
  const opcoes = [h('div', { class: 'modos-escolha' }, [['versus', 'Versus: cada um por si'], ['coop', 'Co-op: todos juntos']].map(([k, nome]) => h('button', {
    type: 'button', class: `modo-opcao ${k === o.modo ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ modo: k }),
  }, h('strong', null, nome), h('small', null, def[k]))))];
  if (def.fases && o.modo === 'versus') {
    opcoes.push(h('div', { class: 'segmentado' }, def.fases.map((nome, k) => h('button', {
      type: 'button', class: `seg ${k === o.fase ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ fase: k }),
    }, nome))));
  }
  const basta = o.modo === 'versus' ? n >= 2 : n >= 1;
  return h('div', { class: 'quiz-espera painel' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na sala: ${n} de ${s.max}`)),
    h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
      avatar(p.nome, '', p.foto), h('span', null, p.nome),
      p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
    h('div', { class: 'mesa-opcoes' }, opcoes),
    h('p', { class: 'suave' }, `Quanto mais gente, mais difícil: com ${n} ${n === 1 ? 'pessoa' : 'pessoas'}, dificuldade x${(1 + 0.15 * Math.max(0, n - 1)).toFixed(2).replace('.', ',')}. Cada um aparece com o seu coelho do Club Coelho.`),
    !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala escolhe as opções.'),
    h('div', { class: 'quiz-espera-acao' },
      souDono
        ? [botao(basta ? 'Começar' : 'Esperando mais gente...', { classe: 'btn-ouro btn-grande', icone: 'frente', desativado: !basta, onclick: () => enviar('sala:comecar', { id: s.id }) }),
          h('p', { class: 'suave' }, o.modo === 'versus' ? `Versus precisa de pelo menos 2 pessoas (até ${s.max}).` : `Dá para jogar sozinho, mas a graça é chamar mais gente (até ${s.max}).`)]
        : jogador
          ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando quem abriu a sala começar...')
          : [n < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
            h('p', { class: 'suave' }, 'Você está assistindo.')]));
}
