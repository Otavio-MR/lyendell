// Recreação: salão com chat e partidas ao vivo, e os jogos de uma pessoa só (Pac-Coelho, cobrinha e quebra-cabeça).

import { h, trocar, icone, botao, botaoIcone, cabecalho, vazio, avatar, aviso, confirmar, get, post, pode, aoSair, dataHora, estado, num } from '../core.js';
import { rt, ouvir, enviar, lendoChat, criarPartida, entrarNaPartida } from '../tempo-real.js';
import { abrirSalaQuiz, telaQuiz, teclaQuiz } from './quiz.js';

const AO_VIVO = [
  { id: 'quiz', nome: 'Quiz de Lyendell', icone: 'pergunta', texto: 'Perguntas sobre a Casa Luckham, coelhos, Minecraft e regras de RP. Até 10 pessoas.', abrir: abrirSalaQuiz, botao: 'Abrir sala' },
  { id: 'velha', nome: 'Jogo da Velha', icone: 'velha', texto: 'Três em linha, contra outro morador.' },
  { id: 'ppt', nome: 'Pedra, Papel e Tesoura', icone: 'tesoura', texto: 'Melhor de três. A mão do outro só aparece quando os dois escolhem.' },
];
const SOZINHO = [
  { href: '#/recreacao/pac-coelho', nome: 'Pac-Coelho', icone: 'coelho', texto: 'Coma as moedas, fuja das raposas e pegue a cenoura.' },
  { href: '#/recreacao/cobrinha', nome: 'Cobrinha', icone: 'cobra', texto: 'Coma as cenouras sem bater nas bordas nem em si mesma.' },
  { href: '#/recreacao/quebra-cabeca', nome: 'Quebra-cabeça', icone: 'peca', texto: 'Monte uma foto da galeria no menor tempo.' },
];
const ICONE_JOGO = { velha: 'velha', ppt: 'tesoura', quiz: 'pergunta' };
const MAOS = { pedra: 'Pedra', papel: 'Papel', tesoura: 'Tesoura' };
const VENCE = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };
const VERBO = { pedra: 'quebra', papel: 'embrulha', tesoura: 'corta' };
const TAMANHOS = ['3x3', '4x4', '5x5'];

// Ouve um evento da conexão só enquanto a tela estiver aberta.
const escutar = (tipo, fn) => aoSair(ouvir(tipo, fn));

// Sem o poder de usar a Recreação, a tela mostra "Acesso restrito" (o menu já esconde a aba).
function exigirAcesso() {
  if (pode('recreacao.usar')) return;
  const e = new Error('Sem acesso à Recreação.');
  e.status = 403;
  throw e;
}

const paraData = s => new Date(String(s).replace(' ', 'T') + 'Z');
function hora(s) {
  const d = paraData(s);
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? hh : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hh}`;
}
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Desenhos grandes dos jogos (X, O e as mãos) em SVG.
function desenho(nome, classe = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `desenho ${classe}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = {
    X: '<path d="M6 6l12 12M18 6 6 18"/>',
    O: '<circle cx="12" cy="12" r="6.5"/>',
  }[nome] || '';
  if (!svg.innerHTML) return icone(nome, classe);
  return svg;
}

/* ─── Salão ───────────────────────────────────────── */

export function recreacao() {
  exigirAcesso();
  lendoChat(!document.hidden);
  const aoVisibilidade = () => lendoChat(!document.hidden);
  document.addEventListener('visibilitychange', aoVisibilidade);
  aoSair(() => { document.removeEventListener('visibilitychange', aoVisibilidade); lendoChat(false); });

  const chat = painelChat();
  const jogos = h('div', { class: 'rec-jogos' });
  const abertas = h('div');
  const online = h('div');
  const ranking = painelRanking();

  function desenharJogos() {
    const minha = rt.minhaSala && rt.partidas.get(rt.minhaSala);
    trocar(jogos,
      minha && h('a', { class: 'nota nota-ouro nota-link', href: `#/recreacao/sala/${minha.id}` },
        icone('jogos'), h('span', null, textoMinhaSala(minha)),
        h('strong', null, 'Voltar')),
      AO_VIVO.map(j => h('div', { class: 'jogo-cartao' },
        h('span', { class: 'jogo-icone' }, icone(j.icone)),
        h('div', { class: 'jogo-texto' }, h('strong', null, j.nome, h('span', { class: 'ao-vivo' }, 'ao vivo')), h('small', null, j.texto)),
        h('div', { class: 'jogo-botoes' },
          botao(j.botao || 'Abrir partida', { classe: 'btn-ouro btn-pequeno', desativado: !rt.conectado || !!minha, onclick: () => (j.abrir ? j.abrir() : criarPartida(j.id)) }),
          j.id === 'quiz' && pode('recreacao.perguntas') && h('a', { class: 'btn btn-pequeno', href: '#/recreacao/perguntas' }, icone('editar'), h('span', null, 'Perguntas'))))),
      SOZINHO.map(j => h('a', { class: 'jogo-cartao', href: j.href },
        h('span', { class: 'jogo-icone' }, icone(j.icone)),
        h('div', { class: 'jogo-texto' }, h('strong', null, j.nome), h('small', null, j.texto)),
        h('span', { class: 'btn btn-pequeno' }, 'Jogar'))));
  }

  function textoMinhaSala(m) {
    if (m.grupo) return m.status === 'esperando' ? `Você está na sala do ${m.nomeJogo} (${m.jogadores.length} de ${m.max}), esperando começar.` : `Você está jogando o ${m.nomeJogo}.`;
    return m.status === 'esperando' ? `Sua partida de ${m.nomeJogo} está esperando um adversário.` : `Você está numa partida de ${m.nomeJogo}.`;
  }

  function descricaoSala(s) {
    if (s.grupo) {
      return s.status === 'esperando'
        ? `${s.jogadores[0]} está juntando gente · ${s.jogadores.length} de ${s.max}`
        : `${s.jogadores.length} ${s.jogadores.length === 1 ? 'pessoa jogando' : 'pessoas jogando'}`;
    }
    return s.status === 'esperando' ? `${s.jogadores[0]} espera um adversário` : `${s.jogadores[0]} contra ${s.jogadores[1]}`;
  }

  function desenharAbertas() {
    trocar(abertas, rt.salas.length
      ? h('div', { class: 'lista-salas' }, rt.salas.map(s => {
        const minha = s.id === rt.minhaSala;
        let acao;
        if (minha) acao = h('a', { class: 'btn btn-pequeno btn-ouro', href: `#/recreacao/sala/${s.id}` }, 'Voltar');
        else if (s.status === 'esperando') acao = botao('Entrar', { classe: 'btn-ouro btn-pequeno', desativado: !!rt.minhaSala || s.jogadores.length >= s.max, onclick: () => entrarNaPartida(s.id) });
        else acao = h('a', { class: 'btn btn-pequeno', href: `#/recreacao/sala/${s.id}` }, icone('olho'), h('span', null, 'Assistir'));
        return h('div', { class: 'sala-linha' },
          h('span', { class: 'jogo-icone pequeno' }, icone(ICONE_JOGO[s.jogo])),
          h('div', { class: 'sala-texto' },
            h('strong', null, s.nomeJogo),
            h('small', null, descricaoSala(s), s.espectadores ? ` · ${s.espectadores} assistindo` : '')),
          acao);
      }))
      : h('p', { class: 'painel-vazio' }, 'Nenhuma partida aberta. Abra uma e chame alguém!'));
  }

  function desenharOnline() {
    const jogando = new Set(rt.salas.filter(s => s.status === 'jogando').flatMap(s => s.jogadores));
    trocar(online, !rt.conectado
      ? h('p', { class: 'painel-vazio' }, 'Conectando...')
      : h('div', { class: 'online-lista' }, rt.online.map(p => h('div', { class: 'online-pessoa' },
        h('span', { class: 'online-av' }, avatar(p.nome, 'avatar-p', p.foto)),
        h('span', { class: 'online-nome' }, p.nome),
        jogando.has(p.nome) && h('span', { class: 'etiqueta etiqueta-ouro' }, 'jogando')))));
    tituloOnline.textContent = rt.conectado ? `Online agora (${rt.online.length})` : 'Online agora';
  }

  const tituloOnline = h('span');
  const tudo = () => { desenharJogos(); desenharAbertas(); desenharOnline(); };
  escutar('estado', tudo);
  escutar('online', desenharOnline);
  escutar('salas', () => { desenharAbertas(); desenharOnline(); desenharJogos(); });
  escutar('sala', desenharJogos);
  escutar('sala:fechada', desenharJogos);
  tudo();

  return h('div', { class: 'pagina' },
    cabecalho({ titulo: 'Recreação', icone: 'jogos', sub: 'Converse com os moradores de Lyendell e jogue uma partida.' }),
    h('div', { class: 'rec-grade' },
      chat,
      h('div', { class: 'rec-lado' },
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('jogos'), 'Jogos')), jogos),
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('bandeira'), 'Partidas abertas')), abertas),
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), tituloOnline)), online))),
    ranking);
}

function painelChat() {
  const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-label': 'Mensagens do chat' });
  const entrada = h('input', { class: 'input', maxlength: '500', placeholder: 'Escreva uma mensagem...', autocomplete: 'off', 'aria-label': 'Mensagem' });
  const botaoEnviar = h('button', { class: 'btn btn-ouro', type: 'submit', title: 'Enviar', 'aria-label': 'Enviar' }, icone('aviao'));
  const situacao = h('span', { class: 'chat-situacao' });
  const form = h('form', { class: 'chat-form' }, entrada, botaoEnviar);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    if (enviar('chat:enviar', { texto })) entrada.value = '';
    entrada.focus();
  });

  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 90;
  const descer = () => { lista.scrollTop = lista.scrollHeight; };

  function linha(m, anterior) {
    const junto = anterior && anterior.usuario_nome === m.usuario_nome && paraData(m.criado_em) - paraData(anterior.criado_em) < 5 * 60_000;
    const minha = m.usuario_id != null && m.usuario_id === rt.eu?.id;
    const podeApagar = minha || rt.eu?.moderar;
    return h('div', { class: `chat-msg ${junto ? 'junto' : ''} ${minha ? 'minha' : ''}`.replace(/\s+/g, ' ').trim() },
      junto ? h('span', { class: 'chat-av' }) : h('span', { class: 'chat-av' }, avatar(m.usuario_nome, 'avatar-p', m.foto)),
      h('div', { class: 'chat-corpo' },
        !junto && h('div', { class: 'chat-cab' }, h('strong', null, m.usuario_nome), h('time', { title: dataHora(m.criado_em) }, hora(m.criado_em))),
        h('p', { class: 'chat-texto' }, m.texto)),
      podeApagar && botaoIcone('lixo', 'Apagar mensagem', async () => {
        if (await confirmar(minha ? 'Apagar sua mensagem do chat?' : `Apagar a mensagem de ${m.usuario_nome}?`, { ok: 'Apagar', perigo: true })) enviar('chat:apagar', { id: m.id });
      }, 'chat-apagar perigo'));
  }

  function tudo() {
    trocar(lista, rt.historico.length
      ? rt.historico.map((m, i) => linha(m, rt.historico[i - 1]))
      : h('p', { class: 'chat-vazio' }, rt.conectado ? 'Ninguém falou nada ainda. Diga olá!' : 'Conectando ao chat...'));
    entrada.disabled = botaoEnviar.disabled = !rt.conectado;
    situacao.className = `chat-situacao ${rt.conectado ? 'on' : ''}`;
    situacao.textContent = rt.conectado ? 'ao vivo' : 'conectando...';
    setTimeout(descer, 0);
  }

  escutar('estado', tudo);
  escutar('chat:apagada', tudo);
  escutar('chat:msg', ({ msg }) => {
    const n = rt.historico.length;
    if (n === 1) { tudo(); return; }
    const acompanhava = pertoDoFim();
    lista.append(linha(msg, rt.historico[n - 2]));
    if (acompanhava || msg.usuario_id === rt.eu?.id) descer();
  });
  tudo();

  return h('section', { class: 'painel rec-chat' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('chat'), 'Chat da cidade'), situacao),
    lista, form);
}

function painelRanking() {
  const corpo = h('div', null, h('p', { class: 'painel-vazio' }, 'Carregando...'));
  let dados = null;
  let aba = 'quiz';
  let tamanho = '3x3';
  const ABAS = [['quiz', 'Quiz'], ['velha', 'Jogo da Velha'], ['ppt', 'Pedra, Papel e Tesoura'], ['pacman', 'Pac-Coelho'], ['cobrinha', 'Cobrinha'], ['quebra', 'Quebra-cabeça']];
  const eu = estado.eu.nome;

  function tabela(cols, linhas) {
    if (!linhas.length) return h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda.');
    return h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela ranking' },
      h('thead', null, h('tr', null, h('th', { class: 'col-num' }, '#'), h('th', null, 'Morador'), cols.map(c => h('th', { class: 'num' }, c[0])))),
      h('tbody', null, linhas.map((l, i) => h('tr', { class: l.nome === eu ? 'eu-linha' : '' },
        h('td', { class: 'col-num' }, i < 3 ? h('span', { class: `medalha m${i + 1}` }, i + 1) : i + 1),
        h('td', null, l.nome),
        cols.map(c => h('td', { class: 'num' }, c[1](l))))))));
  }

  function desenhar() {
    if (!dados) return;
    let conteudo;
    if (aba === 'velha' || aba === 'ppt') {
      conteudo = tabela([['Vitórias', l => l.vitorias], ['Derrotas', l => l.derrotas], ['Empates', l => l.empates]], dados[aba]);
    } else if (aba === 'quiz') {
      conteudo = [
        tabela([['Vitórias', l => l.vitorias], ['Acertos', l => l.acertos], ['Partidas', l => l.partidas], ['Melhor', l => num(l.melhor)]], dados.quiz),
        h('p', { class: 'suave ranking-nota' }, 'Vitória conta só em partida com pelo menos duas pessoas.'),
      ];
    } else if (aba === 'pacman') {
      conteudo = tabela([['Pontos', l => num(l.pontos)]], dados.pacman);
    } else if (aba === 'cobrinha') {
      conteudo = tabela([['Cenouras', l => l.pontos]], dados.cobrinha);
    } else {
      conteudo = [
        h('div', { class: 'segmentado ranking-tamanhos' }, TAMANHOS.map(t =>
          h('button', { class: `seg ${t === tamanho ? 'ativo' : ''}`, type: 'button', onclick: () => { tamanho = t; desenhar(); } }, t))),
        tabela([['Tempo', l => relogio(l.segundos)]], dados.quebra[tamanho]),
      ];
    }
    trocar(corpo,
      h('nav', { class: 'abas abas-rolam' }, ABAS.map(([k, nome]) =>
        h('button', { class: `aba ${aba === k ? 'ativa' : ''}`.trim(), type: 'button', onclick: () => { aba = k; desenhar(); } }, nome))),
      conteudo);
  }

  get('/api/recreacao/ranking')
    .then(r => { dados = r; desenhar(); })
    .catch(e => trocar(corpo, h('p', { class: 'painel-vazio' }, e.message)));

  return h('section', { class: 'painel rec-ranking' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Ranking')),
    corpo);
}

/* ─── Partida ao vivo ─────────────────────────────── */

export function sala(id) {
  exigirAcesso();
  const raiz = h('div', { class: 'pagina rec-partida' });
  let pedido = false;
  let tabuleiroAntes = null;
  let rodadasAntes = null;
  const tituloOriginal = () => { document.title = `${rt.partidas.get(id)?.nomeJogo || 'Partida'} · Casa Luckham`; };

  const pedir = () => {
    if (rt.conectado && !pedido) pedido = enviar('sala:assistir', { id }, { silencioso: true });
  };

  function desenhar() {
    const s = rt.partidas.get(id);
    if (!s) {
      trocar(raiz, pedido && rt.conectado && naoExiste
        ? vazio('Partida não encontrada', 'Ela já terminou ou foi cancelada.', h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar à Recreação'))
        : h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
      return;
    }
    if (s.grupo) {
      trocar(raiz, telaQuiz(s, acoesQuiz));
      if (!document.hidden) tituloOriginal();
      avisarNaAba(s);
      return;
    }
    const eu = s.eu;
    const jogador = eu >= 0;
    const [a, b] = s.jogadores;
    const outro = jogador ? s.jogadores[1 - eu] : null;
    const e = s.estado;

    const acoes = [];
    if (jogador && s.status === 'esperando') acoes.push(botao('Cancelar partida', { icone: 'x', onclick: sair }));
    else if (jogador && s.status === 'jogando') acoes.push(botao('Desistir', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: desistir }));
    else if (!jogador) acoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));

    trocar(raiz,
      cabecalho({ titulo: s.nomeJogo, icone: ICONE_JOGO[s.jogo], voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes }),
      h('div', { class: 'partida-caixa' },
        h('div', { class: 'duelo' },
          cartaoJogador(s, 0),
          h('span', { class: 'duelo-vs' }, s.jogo === 'ppt' && e ? `${e.placar[0]} × ${e.placar[1]}` : 'vs'),
          b ? cartaoJogador(s, 1) : h('div', { class: 'jogador vazio-jogador' }, h('span', { class: 'giro giro-p' }), h('span', null, 'Esperando adversário'))),
        h('p', { class: `partida-status ${statusClasse(s)}` }, textoStatus(s)),
        s.status === 'esperando'
          ? h('div', { class: 'esperando' },
            h('p', null, jogador
              ? 'A partida aparece para todos no salão da Recreação. Assim que alguém entrar, ela começa.'
              : 'Assim que alguém entrar, a partida começa.'),
            !jogador && !rt.minhaSala && botao('Entrar nesta partida', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }))
          : s.jogo === 'velha' ? tabuleiroVelha(s) : mesaPpt(s),
        rodape(s, outro),
        s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} ${s.espectadores === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}`)));
    if (!document.hidden) tituloOriginal();
    tabuleiroAntes = e?.tabuleiro ? [...e.tabuleiro] : null;
    rodadasAntes = e?.rodadas ? e.rodadas.length : null;
    avisarNaAba(s);
  }

  function cartaoJogador(s, i) {
    const p = s.jogadores[i];
    const e = s.estado;
    const vez = s.status === 'jogando' && s.jogo === 'velha' && e?.vez === i;
    const venceu = s.status === 'fim' && s.vencedor === i;
    let detalhe = null;
    if (s.jogo === 'velha' && e) detalhe = h('span', { class: `simbolo ${e.simbolos[i].toLowerCase()}` }, desenho(e.simbolos[i]));
    if (s.jogo === 'ppt' && e && s.status === 'jogando') detalhe = h('span', { class: `escolheu ${e.escolheu[i] ? 'sim' : ''}` }, e.escolheu[i] ? icone('check') : h('span', { class: 'pontinhos' }, '...'));
    let situacao = i === s.eu ? 'Você' : '';
    if (p.saiu) situacao = 'Saiu';
    else if (!p.conectado) situacao = 'Caiu, esperando voltar...';
    return h('div', { class: `jogador ${vez ? 'na-vez' : ''} ${venceu ? 'venceu' : ''} ${!p.conectado || p.saiu ? 'ausente' : ''}`.replace(/\s+/g, ' ').trim() },
      avatar(p.nome, '', p.foto),
      h('div', { class: 'jogador-texto' }, h('strong', null, p.nome), situacao && h('small', null, situacao)),
      venceu && h('span', { class: 'coroa' }, icone('coroa')),
      detalhe);
  }

  function statusClasse(s) {
    if (s.status !== 'fim') return s.status === 'jogando' && minhaVez(s) ? 'destaque' : '';
    if (s.empate) return '';
    return s.eu >= 0 ? (s.vencedor === s.eu ? 'vitoria' : 'derrota') : 'destaque';
  }

  function minhaVez(s) {
    if (s.eu < 0 || s.status !== 'jogando') return false;
    if (s.grupo) return s.estado?.fase === 'pergunta' && s.estado.minha == null && !s.jogadores[s.eu].saiu;
    return s.jogo === 'velha' ? s.estado.vez === s.eu : !s.estado.minha;
  }

  function textoStatus(s) {
    const nome = i => (i === s.eu ? 'Você' : s.jogadores[i]?.nome);
    if (s.status === 'esperando') return s.eu >= 0 ? 'Esperando alguém entrar...' : `${s.jogadores[0].nome} está esperando um adversário.`;
    if (s.status === 'jogando') {
      if (s.jogo === 'velha') {
        const v = s.estado.vez;
        if (v === s.eu) return 'Sua vez!';
        return `Vez de ${s.jogadores[v].nome}`;
      }
      const n = s.estado.rodadas.length + 1;
      if (s.eu < 0) return `Rodada ${n}`;
      return s.estado.minha ? `Rodada ${n} · esperando ${s.jogadores[1 - s.eu].nome} escolher...` : `Rodada ${n} · escolha a sua mão!`;
    }
    if (s.empate) return s.jogo === 'velha' ? 'Deu velha! Empate.' : 'Empate.';
    const perdedor = 1 - s.vencedor;
    if (s.motivo === 'abandono') return `${nome(perdedor)} ${perdedor === s.eu ? 'desistiu' : 'saiu da partida'}. ${s.vencedor === s.eu ? 'Vitória sua!' : `${nome(s.vencedor)} venceu.`}`;
    if (s.motivo === 'caiu') return `${nome(perdedor)} caiu e não voltou a tempo. ${s.vencedor === s.eu ? 'Vitória sua!' : `${nome(s.vencedor)} venceu.`}`;
    return s.vencedor === s.eu ? 'Você venceu!' : `${nome(s.vencedor)} venceu!`;
  }

  function tabuleiroVelha(s) {
    const e = s.estado;
    const podeJogar = minhaVez(s);
    return h('div', { class: `velha ${podeJogar ? 'pode' : ''} ${s.status === 'fim' ? 'terminou' : ''}`.replace(/\s+/g, ' ').trim() },
      e.tabuleiro.map((v, i) => h('button', {
        class: ['velha-casa', v && `marcada ${v.toLowerCase()}`, e.linha?.includes(i) && 'vencedora', v && tabuleiroAntes && !tabuleiroAntes[i] && 'nova'].filter(Boolean).join(' '),
        type: 'button',
        disabled: !podeJogar || !!v,
        'aria-label': `Casa ${i + 1}${v ? `, ${v}` : ', livre'}`,
        onclick: () => enviar('sala:jogar', { id: s.id, jogada: { casa: i } }),
      }, v && desenho(v))));
  }

  function mesaPpt(s) {
    const e = s.estado;
    const nomes = s.jogadores.map((p, i) => (i === s.eu ? 'Você' : p.nome));
    const ultima = e.rodadas[e.rodadas.length - 1];
    const nova = ultima && rodadasAntes != null && e.rodadas.length > rodadasAntes;

    let escolha = null;
    if (s.status === 'jogando' && s.eu >= 0) {
      escolha = e.minha
        ? h('div', { class: 'ppt-escolhida' }, h('span', { class: 'mao grande' }, icone(e.minha)),
          h('p', null, `Você escolheu ${MAOS[e.minha].toLowerCase()}.`), h('small', { class: 'suave' }, 'A escolha do outro aparece quando ele escolher.'))
        : h('div', { class: 'ppt-maos' }, Object.keys(MAOS).map(m =>
          h('button', { class: 'ppt-mao', type: 'button', onclick: () => enviar('sala:jogar', { id: s.id, jogada: { escolha: m } }) },
            h('span', { class: 'mao' }, icone(m)), h('span', null, MAOS[m]))));
    }

    return h('div', { class: 'ppt' },
      ultima && h('div', { class: `ppt-revela ${nova ? 'nova' : ''}`.trim() },
        h('div', { class: `ppt-lado ${ultima.vencedor === 0 ? 'ganhou' : ultima.vencedor === 1 ? 'perdeu' : ''}` },
          h('span', { class: 'mao grande' }, icone(ultima.escolhas[0])), h('small', null, nomes[0])),
        h('div', { class: 'ppt-resultado' },
          h('small', { class: 'sobrelinha' }, `Rodada ${e.rodadas.length}`),
          h('strong', null, ultima.vencedor == null
            ? `Empate: os dois de ${MAOS[ultima.escolhas[0]].toLowerCase()}`
            : (() => { const g = ultima.escolhas[ultima.vencedor]; return `${MAOS[g]} ${VERBO[g]} ${VENCE[g]}`; })()),
          h('small', null, ultima.vencedor == null ? 'Ninguém marca ponto.' : `Ponto para ${nomes[ultima.vencedor] === 'Você' ? 'você' : nomes[ultima.vencedor]}`)),
        h('div', { class: `ppt-lado ${ultima.vencedor === 1 ? 'ganhou' : ultima.vencedor === 0 ? 'perdeu' : ''}` },
          h('span', { class: 'mao grande' }, icone(ultima.escolhas[1])), h('small', null, nomes[1]))),
      escolha,
      e.rodadas.length > 1 && h('ol', { class: 'ppt-rodadas' }, e.rodadas.map((r, i) =>
        h('li', null, h('span', null, `Rodada ${i + 1}`),
          h('span', { class: 'ppt-rodada-maos' }, icone(r.escolhas[0]), '×', icone(r.escolhas[1])),
          h('span', { class: 'suave' }, r.vencedor == null ? 'empate' : nomes[r.vencedor])))));
  }

  function rodape(s, outro) {
    if (s.status !== 'fim' || s.eu < 0) return null;
    if (!outro || outro.saiu || s.jogadores[s.eu].saiu) {
      return h('div', { class: 'partida-rodape' }, h('p', { class: 'suave' }, `${outro?.nome || 'O outro jogador'} saiu da partida.`),
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão'));
    }
    const eu = s.jogadores[s.eu];
    const pediu = s.revanche.includes(eu.id);
    const outroPediu = s.revanche.includes(outro.id);
    return h('div', { class: 'partida-rodape' },
      outroPediu && !pediu && h('p', { class: 'revanche-pedido' }, `${outro.nome} quer revanche!`),
      pediu
        ? h('p', { class: 'suave' }, h('span', { class: 'giro giro-p' }), ` Esperando ${outro.nome} aceitar a revanche...`)
        : botao(outroPediu ? 'Aceitar revanche' : 'Pedir revanche', { icone: 'espada', classe: 'btn-ouro', onclick: () => enviar('sala:revanche', { id: s.id }) }),
      h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão'));
  }

  async function sair() {
    enviar('sala:sair', { id });
    location.hash = '#/recreacao';
  }

  async function desistir() {
    if (!await confirmar('Se sair agora, você perde a partida.', { titulo: 'Desistir da partida?', ok: 'Desistir', perigo: true })) return;
    sair();
  }

  const acoesQuiz = {
    async sair() {
      const s = rt.partidas.get(id);
      const outros = s ? s.jogadores.length - 1 : 0;
      if (s?.dono === s?.jogadores[s.eu]?.id && outros > 0
        && !await confirmar(`A sala fecha para todos (${outros === 1 ? '1 pessoa já entrou' : `${outros} pessoas já entraram`}).`, { titulo: 'Fechar a sala?', ok: 'Fechar', perigo: true })) return;
      sair();
    },
    async desistir() {
      if (!await confirmar('Se sair agora, você não entra no resultado deste quiz.', { titulo: 'Sair do quiz?', ok: 'Sair', perigo: true })) return;
      sair();
    },
    responder: i => enviar('sala:jogar', { id, jogada: { alternativa: i } }),
    comecar: () => enviar('sala:comecar', { id }),
    revanche: () => enviar('sala:revanche', { id }),
  };

  // Contagem regressiva do quiz (os números com data-fim) e as teclas A, B, C e D.
  const relogioQuiz = setInterval(() => {
    for (const el of raiz.querySelectorAll('[data-fim]')) el.textContent = Math.max(0, Math.ceil((Number(el.dataset.fim) - Date.now()) / 1000));
  }, 250);
  const aoTeclar = ev => teclaQuiz(ev, rt.partidas.get(id), acoesQuiz.responder);
  document.addEventListener('keydown', aoTeclar);
  aoSair(() => { clearInterval(relogioQuiz); document.removeEventListener('keydown', aoTeclar); });

  // Se a pessoa está em outra aba do navegador, o título avisa que é a vez dela.
  function avisarNaAba(s) {
    if (document.hidden && (minhaVez(s) || (s.status === 'fim' && s.eu >= 0))) document.title = minhaVez(s) ? '(!) Sua vez · Casa Luckham' : '(!) Fim de partida · Casa Luckham';
  }
  const aoVoltarNaAba = () => { if (!document.hidden) tituloOriginal(); };
  document.addEventListener('visibilitychange', aoVoltarNaAba);

  let naoExiste = false;
  escutar('estado', () => { pedido = false; pedir(); desenhar(); });
  escutar('sala', ({ sala: s }) => { if (s.id === id) desenhar(); });
  escutar('sala:fechada', ({ id: fechada, motivo }) => {
    if (fechada !== id) return;
    if (motivo === 'dono') location.hash = '#/recreacao'; // quem abriu fechou a sala
    else desenhar();
  });
  escutar('erro', () => { if (!rt.partidas.has(id)) { naoExiste = true; desenhar(); } });

  aoSair(() => {
    document.removeEventListener('visibilitychange', aoVoltarNaAba);
    const s = rt.partidas.get(id);
    if (!s) return;
    // Quem assistia para de assistir; quem jogou uma partida já terminada libera a sala.
    // Partida em andamento continua: a faixa no rodapé do site leva de volta.
    if (s.eu < 0 || s.status === 'fim') {
      enviar('sala:sair', { id }, { silencioso: true });
      rt.partidas.delete(id);
    }
  });

  pedir();
  desenhar();
  return raiz;
}

/* ─── Cobrinha ────────────────────────────────────── */

const DIRECOES = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

export function cobrinha() {
  exigirAcesso();
  const N = 20;
  const LADO = 600;
  const C = LADO / N;
  const tela = h('canvas', { class: 'cobra-tela', width: LADO, height: LADO, 'aria-label': 'Tabuleiro da cobrinha' });
  const g = tela.getContext('2d');
  const pontosEl = h('strong', null, '0');
  const recordeEl = h('strong', null, '...');
  const sobre = h('div', { class: 'cobra-sobre' });
  const ranking = h('div');

  let cobra, direcao, fila, comida, pontos, passoMs, situacao, timer;
  let recorde = null;

  function novoJogo() {
    cobra = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }];
    direcao = [1, 0];
    fila = [];
    pontos = 0;
    passoMs = 135;
    pontosEl.textContent = '0';
    novaComida();
    situacao = 'pronto';
    desenharTudo();
    mostrarSobre();
  }

  function novaComida() {
    const livres = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!cobra.some(p => p.x === x && p.y === y)) livres.push({ x, y });
    comida = livres[Math.floor(Math.random() * livres.length)] || null;
  }

  function comecar() {
    if (situacao === 'fim') novoJogo();
    if (situacao === 'jogando') return;
    situacao = 'jogando';
    mostrarSobre();
    clearTimeout(timer);
    timer = setTimeout(passo, passoMs);
  }

  function pausar() {
    if (situacao !== 'jogando') return;
    situacao = 'pausado';
    clearTimeout(timer);
    mostrarSobre();
  }

  function virar(d) {
    const ultima = fila[fila.length - 1] || direcao;
    if (d[0] === -ultima[0] && d[1] === -ultima[1]) return; // não dá meia-volta
    if (d[0] === ultima[0] && d[1] === ultima[1]) return;
    if (fila.length < 3) fila.push(d);
    if (situacao === 'pronto' || situacao === 'pausado') comecar();
  }

  function passo() {
    if (situacao !== 'jogando') return;
    if (fila.length) direcao = fila.shift();
    const cabeca = { x: cobra[0].x + direcao[0], y: cobra[0].y + direcao[1] };
    const come = comida && cabeca.x === comida.x && cabeca.y === comida.y;
    const corpo = come ? cobra : cobra.slice(0, -1); // a ponta do rabo sai do lugar neste passo
    if (cabeca.x < 0 || cabeca.y < 0 || cabeca.x >= N || cabeca.y >= N || corpo.some(p => p.x === cabeca.x && p.y === cabeca.y)) {
      fimDeJogo();
      return;
    }
    cobra.unshift(cabeca);
    if (come) {
      pontos++;
      pontosEl.textContent = pontos;
      passoMs = Math.max(58, 135 - pontos * 2.5);
      novaComida();
      if (!comida) { fimDeJogo(); return; } // encheu o tabuleiro
    } else {
      cobra.pop();
    }
    desenharTudo();
    timer = setTimeout(passo, passoMs);
  }

  async function fimDeJogo() {
    situacao = 'fim';
    clearTimeout(timer);
    desenharTudo(true);
    mostrarSobre();
    if (!pontos) return;
    try {
      const r = await post('/api/recreacao/recordes', { jogo: 'cobrinha', pontos });
      if (r.recorde) {
        recorde = pontos;
        recordeEl.textContent = pontos;
        if (situacao === 'fim') mostrarSobre(r.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!');
        carregarRanking();
      }
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }

  function mostrarSobre(extra) {
    if (situacao === 'jogando') { sobre.hidden = true; return; }
    sobre.hidden = false;
    const toque = matchMedia('(pointer: coarse)').matches;
    if (situacao === 'pronto') {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Cobrinha'),
        h('p', null, toque ? 'Deslize o dedo no tabuleiro ou use as setas abaixo.' : 'Use as setas ou W A S D. Espaço pausa.'),
        botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar })));
    } else if (situacao === 'pausado') {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Pausado'), botao('Continuar', { classe: 'btn-ouro', onclick: comecar })));
    } else {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim de jogo'),
        h('p', { class: 'cobra-placar' }, `${pontos} ${pontos === 1 ? 'cenoura' : 'cenouras'}`),
        extra && h('p', { class: 'cobra-recorde' }, icone('trofeu'), extra),
        botao('Jogar de novo', { classe: 'btn-ouro', onclick: () => { novoJogo(); comecar(); } })));
    }
  }

  function desenharTudo(bateu = false) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        g.fillStyle = (x + y) % 2 ? '#0c170f' : '#0f1c12';
        g.fillRect(x * C, y * C, C, C);
      }
    }
    if (comida) desenharCenoura(comida.x, comida.y);
    cobra.forEach((p, i) => {
      const t = i / Math.max(1, cobra.length - 1);
      g.fillStyle = i === 0 ? (bateu ? '#d8674a' : '#d8b13a') : `rgb(${Math.round(127 - 50 * t)}, ${Math.round(176 - 60 * t)}, ${Math.round(105 - 40 * t)})`;
      const m = i === 0 ? 1.5 : 3;
      arredondado(p.x * C + m, p.y * C + m, C - m * 2, C - m * 2, i === 0 ? 9 : 7);
    });
    // Olhinhos na direção em que a cobra anda.
    const cab = cobra[0];
    const [dx, dy] = direcao;
    g.fillStyle = '#1b1403';
    for (const lado of [-1, 1]) {
      const ex = cab.x * C + C / 2 + dx * C * 0.18 + dy * lado * C * 0.2;
      const ey = cab.y * C + C / 2 + dy * C * 0.18 + dx * lado * C * 0.2;
      g.beginPath();
      g.arc(ex, ey, C * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  }

  function arredondado(x, y, w, hh, r) {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, hh, r) : g.rect(x, y, w, hh);
    g.fill();
  }

  function desenharCenoura(x, y) {
    const cx = x * C + C / 2;
    const cy = y * C + C / 2;
    g.fillStyle = '#5b8c3e';
    g.beginPath();
    g.ellipse(cx - C * 0.1, cy - C * 0.3, C * 0.08, C * 0.18, -0.5, 0, Math.PI * 2);
    g.ellipse(cx + C * 0.1, cy - C * 0.3, C * 0.08, C * 0.18, 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8812f';
    g.beginPath();
    g.moveTo(cx - C * 0.24, cy - C * 0.16);
    g.quadraticCurveTo(cx, cy - C * 0.28, cx + C * 0.24, cy - C * 0.16);
    g.lineTo(cx, cy + C * 0.42);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120, 50, 10, 0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx - C * 0.12, cy);
    g.lineTo(cx - C * 0.02, cy);
    g.moveTo(cx + C * 0.04, cy + C * 0.14);
    g.lineTo(cx + C * 0.12, cy + C * 0.14);
    g.stroke();
  }

  // Teclado
  const aoTeclar = e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    const d = DIRECOES[e.code];
    if (d) { e.preventDefault(); virar(d); return; }
    if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      if (situacao === 'jogando') pausar(); else comecar();
    }
    if (e.code === 'Enter' && situacao === 'fim') { e.preventDefault(); novoJogo(); comecar(); }
  };
  document.addEventListener('keydown', aoTeclar);

  // Toque: deslizar o dedo no tabuleiro
  let inicio = null;
  tela.addEventListener('pointerdown', e => { inicio = { x: e.clientX, y: e.clientY }; });
  tela.addEventListener('pointerup', e => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    virar(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  });

  const aoEsconder = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', aoEsconder);
  aoSair(() => {
    clearTimeout(timer);
    situacao = 'fim';
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('visibilitychange', aoEsconder);
  });

  const seta = (ic, d, rotulo) => h('button', { class: `dpad-${ic}`, type: 'button', 'aria-label': rotulo, onpointerdown: e => { e.preventDefault(); virar(d); } }, icone(ic));

  function carregarRanking() {
    get('/api/recreacao/ranking').then(r => {
      const meu = r.cobrinha.find(l => l.nome === estado.eu.nome);
      if (meu && (recorde == null || meu.pontos > recorde)) recorde = meu.pontos;
      recordeEl.textContent = recorde ?? '0';
      trocar(ranking, r.cobrinha.length
        ? h('ol', { class: 'mini-ranking' }, r.cobrinha.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, l.pontos))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda. Seja o primeiro!'));
    }).catch(() => {});
  }
  carregarRanking();
  novoJogo();

  return h('div', { class: 'pagina' },
    cabecalho({ titulo: 'Cobrinha', icone: 'cobra', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub: 'Cada cenoura faz a cobra crescer e andar mais rápido.' }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area' },
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Cenouras: ', pontosEl),
          h('span', null, icone('trofeu'), ' Seu recorde: ', recordeEl)),
        h('div', { class: 'cobra-moldura' }, tela, sobre),
        h('div', { class: 'dpad' },
          seta('cima', [0, -1], 'Para cima'), seta('voltar', [-1, 0], 'Para a esquerda'),
          seta('frente', [1, 0], 'Para a direita'), seta('baixo', [0, 1], 'Para baixo'))),
      h('aside', { class: 'painel jogo-lateral' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Melhores')),
        ranking)));
}

/* ─── Quebra-cabeça ───────────────────────────────── */

let tamanhoEscolhido = '3x3';

export function quebraCabeca() {
  exigirAcesso();
  const raiz = h('div', { class: 'pagina' });
  let urlImagem = null;
  let cronometro = null;
  aoSair(() => {
    clearInterval(cronometro);
    if (urlImagem) URL.revokeObjectURL(urlImagem);
  });

  const cab = sub => cabecalho({ titulo: 'Quebra-cabeça', icone: 'peca', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub });

  function escolher() {
    clearInterval(cronometro);
    const grade = h('div', { class: 'qc-fotos' }, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
    const tamanhos = h('div', { class: 'segmentado' });
    const desenharTamanhos = () => trocar(tamanhos, TAMANHOS.map(t =>
      h('button', { class: `seg ${t === tamanhoEscolhido ? 'ativo' : ''}`, type: 'button', onclick: () => { tamanhoEscolhido = t; desenharTamanhos(); } },
        `${t} · ${{ '3x3': 'fácil', '4x4': 'médio', '5x5': 'difícil' }[t]}`)));
    desenharTamanhos();

    const opcao = (src, titulo) => h('button', { class: 'qc-foto', type: 'button', title: titulo, onclick: () => montar(src, titulo) },
      h('img', { src, alt: titulo, loading: 'lazy' }));

    const brasao = opcao('/img/brasao.png', 'Brasão da Casa Luckham');
    (pode('galeria.ver') ? get('/api/galeria/fotos') : Promise.resolve({ fotos: [] }))
      .then(({ fotos }) => trocar(grade, brasao, fotos.filter(f => !/\.gif$/i.test(f.arquivo)).map(f => opcao(f.arquivo, f.titulo || 'Foto da galeria')),
        !fotos.length && h('p', { class: 'suave qc-dica' }, 'Quando houver fotos na Galeria, elas aparecem aqui para montar.')))
      .catch(() => trocar(grade, brasao));

    trocar(raiz, cab('Escolha uma imagem da galeria e o tamanho. Troque as peças de lugar até formar a imagem.'),
      h('section', { class: 'painel' },
        h('div', { class: 'painel-cab qc-cab' }, h('h2', null, icone('ajustes'), 'Tamanho'), tamanhos),
        grade));
  }

  async function montar(src, titulo) {
    trocar(raiz, cab(titulo), h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
    try {
      const novo = await recortarQuadrado(src);
      if (urlImagem) URL.revokeObjectURL(urlImagem);
      urlImagem = novo;
    } catch {
      aviso('Não consegui abrir essa imagem. Escolha outra.', 'erro');
      escolher();
      return;
    }
    jogar(titulo);
  }

  function jogar(titulo) {
    const n = Number(tamanhoEscolhido[0]);
    const variante = tamanhoEscolhido;
    const total = n * n;
    let pecas = embaralhar(total);
    let selecionada = null;
    let movimentos = 0;
    let comeco = null;
    let resolvido = false;
    clearInterval(cronometro);

    const tempoEl = h('strong', null, '0:00');
    const movEl = h('strong', null, '0');
    const tabuleiro = h('div', { class: 'qc-tabuleiro', style: { '--n': n } });
    const resultado = h('div', { class: 'qc-resultado', hidden: true });
    const previa = h('img', { class: 'qc-previa', src: urlImagem, alt: 'Imagem completa', hidden: true });
    const ranking = h('div');

    const segundos = () => (comeco ? (Date.now() - comeco) / 1000 : 0);

    function desenhar() {
      trocar(tabuleiro, pecas.map((p, i) => {
        const lin = Math.floor(p / n);
        const col = p % n;
        return h('button', {
          class: `qc-peca ${selecionada === i ? 'selecionada' : ''}`.trim(),
          type: 'button',
          'data-i': i,
          'aria-label': `Peça ${i + 1}`,
          style: {
            backgroundImage: `url("${urlImagem}")`,
            backgroundSize: `${n * 100}% ${n * 100}%`,
            backgroundPosition: `${(col / (n - 1)) * 100}% ${(lin / (n - 1)) * 100}%`,
          },
        });
      }));
    }

    function trocarPecas(a, b) {
      if (resolvido || a === b) return;
      if (!comeco) {
        comeco = Date.now();
        cronometro = setInterval(() => { tempoEl.textContent = relogio(segundos()); }, 250);
      }
      [pecas[a], pecas[b]] = [pecas[b], pecas[a]];
      movimentos++;
      movEl.textContent = movimentos;
      selecionada = null;
      desenhar();
      for (const i of [a, b]) tabuleiro.children[i].classList.add('trocou');
      if (pecas.every((p, i) => p === i)) terminou();
    }

    function tocar(i) {
      if (resolvido) return;
      if (selecionada == null) selecionada = i;
      else if (selecionada === i) selecionada = null;
      else { trocarPecas(selecionada, i); return; }
      desenhar();
    }

    // Clicar numa peça e depois em outra troca as duas. Arrastar uma sobre a outra também.
    let origem = null;
    tabuleiro.addEventListener('pointerdown', e => {
      const b = e.target.closest('.qc-peca');
      if (!b || resolvido) return;
      origem = Number(b.dataset.i);
      b.classList.add('segurando');
    });
    tabuleiro.addEventListener('pointerup', e => {
      if (origem == null) return;
      const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.qc-peca');
      const de = origem;
      origem = null;
      tabuleiro.querySelector('.segurando')?.classList.remove('segurando');
      if (!alvo || !tabuleiro.contains(alvo)) return;
      const para = Number(alvo.dataset.i);
      if (para !== de) trocarPecas(de, para);
      else tocar(de);
    });
    tabuleiro.addEventListener('pointercancel', () => { origem = null; tabuleiro.querySelector('.segurando')?.classList.remove('segurando'); });
    // Teclado (Enter ou espaço numa peça) funciona como clique.
    tabuleiro.addEventListener('click', e => {
      if (e.detail !== 0) return;
      const b = e.target.closest('.qc-peca');
      if (b) tocar(Number(b.dataset.i));
    });

    async function terminou() {
      resolvido = true;
      clearInterval(cronometro);
      const s = Math.max(1, Math.round(segundos()));
      tempoEl.textContent = relogio(s);
      tabuleiro.classList.add('resolvido');
      resultado.hidden = false;
      trocar(resultado,
        h('h2', null, 'Montado!'),
        h('p', null, `${relogio(s)} · ${movimentos} ${movimentos === 1 ? 'troca' : 'trocas'} · ${variante}`),
        h('div', { class: 'qc-resultado-acoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', onclick: () => jogar(titulo) }),
          botao('Outra imagem', { onclick: escolher })));
      try {
        const r = await post('/api/recreacao/recordes', { jogo: 'quebra', variante, pontos: s, detalhe: `${movimentos} trocas` });
        if (r.recorde) resultado.insertBefore(h('p', { class: 'cobra-recorde' }, icone('trofeu'), r.anterior == null ? 'Primeiro tempo registrado!' : `Novo recorde pessoal! (antes: ${relogio(r.anterior)})`), resultado.children[2]);
        carregarRanking();
      } catch (e) {
        aviso(e.message, 'erro');
      }
    }

    function carregarRanking() {
      get('/api/recreacao/ranking').then(r => {
        const lista = r.quebra[variante] || [];
        trocar(ranking, lista.length
          ? h('ol', { class: 'mini-ranking' }, lista.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, relogio(l.segundos)))))
          : h('p', { class: 'painel-vazio' }, 'Ninguém montou nesse tamanho ainda.'));
      }).catch(() => {});
    }

    desenhar();
    carregarRanking();
    trocar(raiz, cab(titulo),
      h('div', { class: 'jogo-solo' },
        h('div', { class: 'jogo-area' },
          h('div', { class: 'cobra-placar-linha' },
            h('span', null, icone('relogio'), ' ', tempoEl),
            h('span', null, 'Trocas: ', movEl),
            h('span', { class: 'suave' }, variante)),
          h('div', { class: 'qc-moldura' }, tabuleiro, previa),
          resultado,
          h('div', { class: 'qc-botoes' },
            botao('Ver a imagem', { icone: 'olho', classe: 'btn-pequeno', onclick: e => {
              previa.hidden = !previa.hidden;
              e.currentTarget.querySelector('span').textContent = previa.hidden ? 'Ver a imagem' : 'Esconder a imagem';
            } }),
            botao('Embaralhar de novo', { icone: 'ajustes', classe: 'btn-pequeno', onclick: () => jogar(titulo) }),
            botao('Outra imagem', { icone: 'imagem', classe: 'btn-pequeno', onclick: escolher }))),
        h('aside', { class: 'painel jogo-lateral' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), `Melhores ${variante}`)),
          ranking,
          h('p', { class: 'suave qc-dica' }, 'Toque numa peça e depois em outra para trocar as duas de lugar. No computador, também dá para arrastar.'))));
  }

  escolher();
  return raiz;
}

function embaralhar(total) {
  const p = [...Array(total).keys()];
  do {
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
  } while (p.filter((x, i) => x === i).length > Math.floor(total / 4)); // quase nenhuma peça já no lugar
  return p;
}

// Recorta o centro da imagem em quadrado; as peças usam essa imagem como fundo.
async function recortarQuadrado(src, lado = 720) {
  const resp = await fetch(src, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error('imagem');
  const img = await createImageBitmap(await resp.blob());
  const menor = Math.min(img.width, img.height);
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const g = tela.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#0e1811'; // fundo para imagens com partes transparentes (ex.: o brasão)
  g.fillRect(0, 0, lado, lado);
  g.drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, lado, lado);
  img.close?.();
  const blob = await new Promise(ok => tela.toBlob(ok, 'image/webp', 0.9));
  return URL.createObjectURL(blob || await new Promise(ok => tela.toBlob(ok, 'image/png')));
}
