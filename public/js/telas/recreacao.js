// Recreação: salão com chat e partidas ao vivo, e os jogos de uma pessoa só (Pac-Coelho, cobrinha, quebra-cabeça e memória).

import { h, trocar, icone, botao, botaoIcone, cabecalho, vazio, avatar, avatarPessoa, aviso, confirmar, get, post, pode, aoSair, dataHora, estado, num } from '../core.js';
import { rt, ouvir, enviar, lendoChat, criarPartida, entrarNaPartida, transmitir, enviarQuadro, pararTransmissao } from '../tempo-real.js';
import { assistirPac } from './pac-coelho.js';
import { abrirSalaQuiz, telaQuiz, teclaQuiz } from './quiz.js';
import { SuavizadorCobras } from '../cobras-suave.js';

const AO_VIVO = [
  { id: 'quiz', nome: 'Quiz de Lyendell', icone: 'pergunta', texto: 'Perguntas sobre a Casa Luckham, coelhos, Minecraft e regras de RP. Até 10 pessoas.', abrir: abrirSalaQuiz, botao: 'Abrir sala' },
  { id: 'velha', nome: 'Jogo da Velha', icone: 'velha', texto: 'Três em linha, contra outro morador.' },
  { id: 'cobras', nome: 'Cobrinha ao vivo', icone: 'cobra', texto: 'De 2 a 4 cobras no mesmo tabuleiro. Quem bater sai; vence quem sobrar.', botao: 'Abrir sala' },
  { id: 'ppt', nome: 'Pedra, Papel e Tesoura', icone: 'tesoura', texto: 'Melhor de três. A mão do outro só aparece quando os dois escolhem.' },
  { id: 'lig4', nome: 'Lig 4', icone: 'lig4', texto: 'Solte as peças e faça quatro em linha antes do outro.' },
];
const SOZINHO = [
  { href: '#/recreacao/pac-coelho', nome: 'Pac-Coelho', icone: 'coelho', texto: 'Coma as moedas, fuja das raposas e pegue a cenoura.' },
  { href: '#/recreacao/cobrinha', nome: 'Cobrinha', icone: 'cobra', texto: 'Coma as cenouras sem bater nas bordas nem em si mesma.' },
  { href: '#/recreacao/quebra-cabeca', nome: 'Quebra-cabeça', icone: 'peca', texto: 'Monte uma foto da galeria no menor tempo.' },
  { href: '#/recreacao/memoria', nome: 'Jogo da Memória', icone: 'cartas', texto: 'Ache os pares com o menor número de jogadas.' },
];
const ICONE_JOGO = { velha: 'velha', ppt: 'tesoura', quiz: 'pergunta', lig4: 'lig4', cobras: 'cobra' };
const ICONE_SOLO = { pacman: 'coelho', cobrinha: 'cobra', quebra: 'peca', memoria: 'cartas' };
const MAOS = { pedra: 'Pedra', papel: 'Papel', tesoura: 'Tesoura' };
const VENCE = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };
const VERBO = { pedra: 'quebra', papel: 'embrulha', tesoura: 'corta' };
const TAMANHOS = ['3x3', '4x4', '5x5'];

// Nome ou foto que levam ao perfil da pessoa.
const linkPerfil = (id, filho) => (id ? h('a', { class: 'link-perfil', href: `#/pessoa/${id}` }, filho) : filho);

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
    if (m.grupo) return m.status === 'esperando' ? `Você está na sala de ${m.nomeJogo} (${m.jogadores.length} de ${m.max}), esperando começar.` : `Você está jogando ${m.nomeJogo}.`;
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
    const solos = rt.transmissoes.filter(t => t.id !== rt.eu?.id);
    trocar(abertas, rt.salas.length || solos.length
      ? h('div', { class: 'lista-salas' }, solos.map(t => h('div', { class: 'sala-linha' },
        h('span', { class: 'jogo-icone pequeno' }, icone(ICONE_SOLO[t.jogo])),
        h('div', { class: 'sala-texto' },
          h('strong', null, t.nomeJogo),
          h('small', null, `${t.nome} está jogando`, t.espectadores ? ` · ${t.espectadores} assistindo` : '')),
        h('a', { class: 'btn btn-pequeno', href: `#/recreacao/assistir/${t.id}` }, icone('olho'), h('span', null, 'Assistir')))),
      rt.salas.map(s => {
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
      : h('p', { class: 'painel-vazio' }, 'Ninguém jogando agora. Abra uma partida e chame alguém!'));
  }

  function desenharOnline() {
    const jogando = new Set([...rt.salas.filter(s => s.status === 'jogando').flatMap(s => s.jogadores), ...rt.transmissoes.map(t => t.nome)]);
    trocar(online, !rt.conectado
      ? h('p', { class: 'painel-vazio' }, 'Conectando...')
      : h('div', { class: 'online-lista' }, rt.online.map(p => h('a', { class: 'online-pessoa', href: `#/pessoa/${p.id}` },
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
  escutar('transmissoes', () => { desenharAbertas(); desenharOnline(); });
  escutar('sala', desenharJogos);
  escutar('sala:fechada', desenharJogos);
  tudo();

  return h('div', { class: 'pagina' },
    cabecalho({ titulo: 'Recreação', icone: 'jogos', sub: 'Converse com os moradores de Lyendell e jogue uma partida.' }),
    h('div', { class: 'rec-grade' },
      chat,
      h('div', { class: 'rec-lado' },
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('jogos'), 'Jogos')), jogos),
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('bandeira'), 'Jogando agora')), abertas),
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), tituloOnline)), online))),
    ranking);
}

function painelChat() {
  const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-label': 'Mensagens do chat' });
  const entrada = h('input', { class: 'input', maxlength: '500', placeholder: 'Escreva uma mensagem...', autocomplete: 'off', 'aria-label': 'Mensagem' });
  const botaoEnviar = h('button', { class: 'btn btn-ouro', type: 'submit', title: 'Enviar', 'aria-label': 'Enviar' }, icone('aviao'));
  const situacao = h('span', { class: 'chat-situacao' });
  const notaTexto = h('span');
  const notaTempo = h('strong', { class: 'chat-nota-tempo' });
  const nota = h('p', { class: 'chat-nota', role: 'status', hidden: true }, notaTexto, notaTempo);
  const mostrarNota = (texto, silencio, ate = 0) => {
    notaTexto.textContent = texto;
    nota.classList.toggle('silencio', silencio);
    nota.dataset.ate = String(ate);
    nota.hidden = false;
  };
  const form = h('form', { class: 'chat-form' }, entrada, botaoEnviar);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    if (enviar('chat:enviar', { texto })) entrada.value = '';
    entrada.focus();
  });

  // Anti-spam: enquanto a pessoa está silenciada, a caixa fica travada e o aviso mostra quanto falta.
  let relogio = null;
  function travar() {
    clearInterval(relogio);
    relogio = null;
    const passo = () => {
      const falta = rt.silenciadoAte - Date.now();
      entrada.disabled = botaoEnviar.disabled = !rt.conectado || falta > 0;
      entrada.placeholder = falta > 0 ? 'Sem falar no chat por spam...' : 'Escreva uma mensagem...';
      if (falta > 0 && nota.hidden) mostrarNota('Você está sem falar no chat por spam.', true, rt.silenciadoAte); // abriu a tela já silenciado
      notaTempo.textContent = falta > 0 ? ` Faltam ${Math.ceil(falta / 1000)} s.` : '';
      if (falta <= 0 || !form.isConnected) {
        clearInterval(relogio);
        relogio = null;
        if (falta <= 0 && !nota.hidden && nota.classList.contains('silencio')) nota.hidden = true;
      }
    };
    passo();
    if (rt.silenciadoAte > Date.now()) relogio = setInterval(passo, 1000);
  }

  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 90;
  const descer = () => { lista.scrollTop = lista.scrollHeight; };

  function linha(m, anterior) {
    const junto = anterior && anterior.usuario_nome === m.usuario_nome && paraData(m.criado_em) - paraData(anterior.criado_em) < 5 * 60_000;
    const minha = m.usuario_id != null && m.usuario_id === rt.eu?.id;
    const podeApagar = minha || rt.eu?.moderar;
    return h('div', { class: `chat-msg ${junto ? 'junto' : ''} ${minha ? 'minha' : ''}`.replace(/\s+/g, ' ').trim() },
      junto ? h('span', { class: 'chat-av' }) : h('span', { class: 'chat-av' }, linkPerfil(m.usuario_id, avatarPessoa({ nome: m.usuario_nome, foto: m.foto, moldura: m.moldura }, 'avatar-p'))),
      h('div', { class: 'chat-corpo' },
        !junto && h('div', { class: 'chat-cab' },
          linkPerfil(m.usuario_id, h('strong', { style: m.cor ? { color: m.cor } : null }, m.usuario_nome)),
          h('time', { title: dataHora(m.criado_em) }, hora(m.criado_em))),
        h('p', { class: 'chat-texto' }, m.texto)),
      podeApagar && botaoIcone('lixo', 'Apagar mensagem', async () => {
        if (await confirmar(minha ? 'Apagar sua mensagem do chat?' : `Apagar a mensagem de ${m.usuario_nome}?`, { ok: 'Apagar', perigo: true })) enviar('chat:apagar', { id: m.id });
      }, 'chat-apagar perigo'));
  }

  function tudo() {
    trocar(lista, rt.historico.length
      ? rt.historico.map((m, i) => linha(m, rt.historico[i - 1]))
      : h('p', { class: 'chat-vazio' }, rt.conectado ? 'Ninguém falou nada ainda. Diga olá!' : 'Conectando ao chat...'));
    travar();
    situacao.className = `chat-situacao ${rt.conectado ? 'on' : ''}`;
    situacao.textContent = rt.conectado ? 'ao vivo' : 'conectando...';
    setTimeout(descer, 0);
  }

  escutar('estado', tudo);
  escutar('chat:apagada', tudo);
  // Mensagem barrada: o motivo aparece aqui mesmo e o texto volta para a caixa.
  // As que chegam depois, no mesmo silêncio, não apagam a explicação do castigo.
  escutar('chat:recusada', m => {
    const mesmoSilencio = m.ate && !nota.hidden && nota.dataset.ate === String(m.ate);
    if (!mesmoSilencio) mostrarNota(m.motivo, !!m.ate, m.ate);
    if (!entrada.value.trim()) entrada.value = m.texto;
    travar();
  });
  escutar('chat:msg', ({ msg }) => {
    const n = rt.historico.length;
    if (n === 1) { tudo(); return; }
    const acompanhava = pertoDoFim();
    lista.append(linha(msg, rt.historico[n - 2]));
    if (msg.usuario_id === rt.eu?.id && !nota.classList.contains('silencio')) nota.hidden = true;
    if (acompanhava || msg.usuario_id === rt.eu?.id) descer();
  });
  tudo();

  return h('section', { class: 'painel rec-chat' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('chat'), 'Chat da cidade'), situacao),
    lista, nota, form);
}

function painelRanking() {
  const corpo = h('div', null, h('p', { class: 'painel-vazio' }, 'Carregando...'));
  let dados = null;
  let aba = 'quiz';
  let tamanho = '3x3';
  let tamanhoMem = '4x4';
  const ABAS = [['quiz', 'Quiz'], ['cobras', 'Cobrinha ao vivo'], ['velha', 'Jogo da Velha'], ['ppt', 'Pedra, Papel e Tesoura'], ['lig4', 'Lig 4'],
    ['pacman', 'Pac-Coelho'], ['cobrinha', 'Cobrinha'], ['quebra', 'Quebra-cabeça'], ['memoria', 'Memória']];
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
    if (aba === 'velha' || aba === 'ppt' || aba === 'lig4') {
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
    } else if (aba === 'cobras') {
      conteudo = tabela([['Vitórias', l => l.vitorias], ['Partidas', l => l.partidas], ['Cenouras', l => l.cenouras]], dados.cobras);
    } else if (aba === 'memoria') {
      conteudo = [
        h('div', { class: 'segmentado ranking-tamanhos' }, Object.keys(MEMORIA).map(t =>
          h('button', { class: `seg ${t === tamanhoMem ? 'ativo' : ''}`, type: 'button', onclick: () => { tamanhoMem = t; desenhar(); } }, t))),
        tabela([['Jogadas', l => l.jogadas]], dados.memoria[tamanhoMem]),
      ];
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
    if (s.jogo === 'cobras') {
      trocar(raiz, telaCobras(s));
      if (!document.hidden) tituloOriginal();
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
          : s.jogo === 'velha' ? tabuleiroVelha(s) : s.jogo === 'lig4' ? tabuleiroLig4(s) : mesaPpt(s),
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
    const vez = s.status === 'jogando' && (s.jogo === 'velha' || s.jogo === 'lig4') && e?.vez === i;
    const venceu = s.status === 'fim' && s.vencedor === i;
    let detalhe = null;
    if (s.jogo === 'velha' && e) detalhe = h('span', { class: `simbolo ${e.simbolos[i].toLowerCase()}` }, desenho(e.simbolos[i]));
    if (s.jogo === 'lig4') detalhe = h('span', { class: `lig4-disco p${i}`, title: i === 0 ? 'Peças douradas' : 'Peças vermelhas' });
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
    return s.jogo === 'velha' || s.jogo === 'lig4' ? s.estado.vez === s.eu : !s.estado.minha;
  }

  function textoStatus(s) {
    const nome = i => (i === s.eu ? 'Você' : s.jogadores[i]?.nome);
    if (s.status === 'esperando') return s.eu >= 0 ? 'Esperando alguém entrar...' : `${s.jogadores[0].nome} está esperando um adversário.`;
    if (s.status === 'jogando') {
      if (s.jogo === 'velha' || s.jogo === 'lig4') {
        const v = s.estado.vez;
        if (v === s.eu) return 'Sua vez!';
        return `Vez de ${s.jogadores[v].nome}`;
      }
      const n = s.estado.rodadas.length + 1;
      if (s.eu < 0) return `Rodada ${n}`;
      return s.estado.minha ? `Rodada ${n} · esperando ${s.jogadores[1 - s.eu].nome} escolher...` : `Rodada ${n} · escolha a sua mão!`;
    }
    if (s.empate) return s.jogo === 'velha' ? 'Deu velha! Empate.' : s.jogo === 'lig4' ? 'Tabuleiro cheio! Empate.' : 'Empate.';
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

  // Lig 4: sete colunas; clicar numa coluna (ou apertar 1 a 7) solta a peça, que cai até embaixo.
  function tabuleiroLig4(s) {
    const e = s.estado;
    const podeJogar = minhaVez(s);
    return h('div', { class: `lig4 ${podeJogar ? 'pode' : ''} ${s.status === 'fim' ? 'terminou' : ''}`.replace(/\s+/g, ' ').trim() },
      Array.from({ length: 7 }, (_, col) => {
        const cheia = e.tabuleiro[col] != null;
        return h('button', {
          class: 'lig4-coluna', type: 'button', disabled: !podeJogar || cheia, 'aria-label': `Coluna ${col + 1}${cheia ? ', cheia' : ''}`,
          onclick: () => enviar('sala:jogar', { id: s.id, jogada: { coluna: col } }),
        }, Array.from({ length: 6 }, (_, lin) => {
          const casa = lin * 7 + col;
          const v = e.tabuleiro[casa];
          const nova = v != null && casa === e.ultima && tabuleiroAntes && tabuleiroAntes[casa] == null;
          return h('span', {
            class: ['lig4-casa', v != null && `p${v}`, e.linha?.includes(casa) && 'vencedora', nova && 'nova'].filter(Boolean).join(' '),
            style: nova ? { '--queda': lin + 1 } : null,
          });
        }));
      }));
  }

  /* Cobrinha ao vivo: o tabuleiro (canvas) é o mesmo durante a partida e só é redesenhado a cada quadro. */
  // A tela desenha 60 vezes por segundo, deslizando as cobras entre os quadros do servidor (veja cobras-suave.js).
  let visorCobras = null;
  let quadroCobras = null;
  let fimLargada = 0;
  let placarCobras = null;
  let chavePlacar = '';
  let laco = 0;
  const suave = new SuavizadorCobras();

  function virarCobra(dir) {
    const s = rt.partidas.get(id);
    if (!s || s.jogo !== 'cobras' || s.status !== 'jogando' || s.eu < 0 || s.jogadores[s.eu].saiu) return;
    if (!suave.virar(dir, performance.now())) return; // meia-volta ou a mesma direção: nem manda
    enviar('cobras:virar', { id, dir }, { silencioso: true });
  }

  function receberQuadroCobras(q) {
    const s = rt.partidas.get(id);
    quadroCobras = q;
    if (q.fase === 'largada') fimLargada = Date.now() + q.largada;
    suave.receber(q, performance.now(), s?.eu ?? -1);
    avisoCobras();
    desenharPlacarCobras();
    if (q.fase === 'jogando') { if (!laco) laco = requestAnimationFrame(desenharLaco); } else desenharAgora();
  }

  function desenharAgora() {
    const s = rt.partidas.get(id);
    if (visorCobras && quadroCobras && s) desenharArena(visorCobras, quadroCobras, suave.quadro(performance.now()), s.eu);
  }

  function desenharLaco() {
    laco = 0;
    if (!visorCobras?.tela.isConnected || !quadroCobras) return;
    desenharAgora();
    if (quadroCobras.fase === 'jogando') laco = requestAnimationFrame(desenharLaco);
  }

  function telaDasCobras() {
    if (visorCobras) return visorCobras;
    const tela = h('canvas', { class: 'cobras-tela', width: 640, height: 480, 'aria-label': 'Tabuleiro da cobrinha ao vivo' });
    const aviso_ = h('div', { class: 'cobras-aviso', hidden: true });
    let inicio = null;
    tela.addEventListener('pointerdown', e => { inicio = { x: e.clientX, y: e.clientY }; });
    tela.addEventListener('pointerup', e => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      inicio = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      virarCobra(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    });
    visorCobras = { tela, g: tela.getContext('2d', { alpha: false }), aviso: aviso_, moldura: h('div', { class: 'cobras-moldura' }, tela, aviso_), fundo: null };
    return visorCobras;
  }

  function avisoCobras() {
    const s = rt.partidas.get(id);
    const q = quadroCobras;
    if (!visorCobras || !q || !s) return;
    let texto = '';
    if (q.fase === 'largada') texto = `${Math.max(1, Math.ceil((fimLargada - Date.now()) / 1000))}`;
    else if (q.fase === 'fim' || s.status === 'fim') {
      if (s.empate) texto = 'Empate!';
      else if (s.vencedor === s.eu) texto = 'Você venceu!';
      else texto = `${s.jogadores[s.vencedor]?.nome || 'Alguém'} venceu!`;
    } else if (s.eu >= 0 && q.c[s.eu] && !q.c[s.eu].v) texto = 'Você bateu! Assistindo o resto...';
    visorCobras.aviso.hidden = !texto;
    visorCobras.aviso.textContent = texto;
    visorCobras.aviso.classList.toggle('contagem', q.fase === 'largada');
  }

  function desenharPlacarCobras() {
    const s = rt.partidas.get(id);
    const q = quadroCobras;
    if (!placarCobras || !q || !s) return;
    const ordem = q.classificacao ? q.classificacao.map(c => c.i) : s.jogadores.map((_, i) => i);
    // O placar só é refeito quando muda alguma coisa (os quadros chegam várias vezes por segundo).
    const chave = JSON.stringify([ordem, q.c.map(c => [c.v, c.p]), s.status, s.vencedor, s.jogadores.map(p => p.saiu)]);
    if (chave === chavePlacar && placarCobras.childElementCount) return;
    chavePlacar = chave;
    trocar(placarCobras,
      h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Placar')),
      h('ol', { class: 'cobras-lista' }, ordem.map(i => {
        const p = s.jogadores[i];
        const c = q.c[i];
        if (!p || !c) return null;
        const venceu = s.status === 'fim' && s.vencedor === i;
        let situacao = 'jogando';
        if (!c.v) situacao = p.saiu ? 'saiu' : 'bateu';
        else if (q.fase === 'fim' || s.status === 'fim') situacao = 'sobrou';
        return h('li', { class: `${i === s.eu ? 'eu-linha' : ''} ${c.v ? '' : 'fora'}`.trim() },
          h('span', { class: 'cobras-cor', style: { background: CORES_COBRAS[i] } }),
          h('span', { class: 'cobras-nome' }, h('strong', null, p.nome), h('small', null, i === s.eu ? `você · ${situacao}` : situacao)),
          venceu && h('span', { class: 'coroa' }, icone('coroa')),
          h('span', { class: 'cobras-pontos', title: 'Cenouras comidas' }, c.p));
      })));
  }

  function telaCobras(s) {
    const jogador = s.eu >= 0;
    const eu = jogador ? s.jogadores[s.eu] : null;
    const souDono = jogador && s.dono === eu.id;
    const botoes = [];
    if (jogador && s.status === 'esperando') botoes.push(botao(souDono ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: acoesQuiz.sair }));
    else if (jogador && s.status === 'jogando' && !eu.saiu) botoes.push(botao('Sair da partida', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: desistirCobras }));
    else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
    const topo = cabecalho({
      titulo: s.nomeJogo, icone: 'cobra', voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes,
      sub: 'De 2 a 4 cobras no mesmo tabuleiro. Quem bater sai e vira cenouras; vence quem sobrar.',
    });
    if (s.status === 'esperando') return [topo, esperaCobras(s, { jogador, souDono })];
    const v = telaDasCobras();
    placarCobras = h('aside', { class: 'painel cobras-placar' });
    chavePlacar = '';
    if (s.estado) receberQuadroCobras(s.estado);
    const toque = matchMedia('(pointer: coarse)').matches;
    const seta = (ic, d, rotulo) => h('button', { class: `dpad-${ic}`, type: 'button', 'aria-label': rotulo, onpointerdown: ev => { ev.preventDefault(); virarCobra(d); } }, icone(ic));
    return [topo,
      h('div', { class: 'cobras-jogo' },
        h('div', { class: 'cobras-area' },
          v.moldura,
          jogador && s.status === 'jogando' && h('div', { class: 'dpad' },
            seta('cima', [0, -1], 'Para cima'), seta('voltar', [-1, 0], 'Para a esquerda'),
            seta('frente', [1, 0], 'Para a direita'), seta('baixo', [0, 1], 'Para baixo')),
          jogador && s.status === 'jogando' && h('p', { class: 'suave cobras-dica' },
            toque ? 'Deslize o dedo no tabuleiro ou use as setas abaixo.' : 'Use as setas ou W A S D. Sua cobra tem o contorno branco na cabeça.')),
        placarCobras),
      s.status === 'fim' && h('div', { class: 'partida-rodape' },
        souDono && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: acoesQuiz.revanche }),
        jogador && !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outra partida.'),
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')),
      s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} ${s.espectadores === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}`)];
  }

  function esperaCobras(s, { jogador, souDono }) {
    const dono = s.jogadores.find(p => p.id === s.dono);
    const basta = s.jogadores.length >= s.min;
    return h('div', { class: 'quiz-espera painel' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na sala: ${s.jogadores.length} de ${s.max}`)),
      h('div', { class: 'quiz-na-sala' }, s.jogadores.map((p, i) => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
        avatar(p.nome, '', p.foto),
        h('span', null, h('span', { class: 'cobras-cor', style: { background: CORES_COBRAS[i] } }), ' ', p.nome),
        p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
      h('div', { class: 'quiz-espera-acao' },
        souDono
          ? [
            botao(basta ? 'Começar a partida' : 'Esperando mais gente...', { classe: 'btn-ouro btn-grande', icone: 'frente', desativado: !basta, onclick: acoesQuiz.comecar }),
            h('p', { class: 'suave' }, basta
              ? 'Quem entrar depois de começar só pode assistir. Cabem até 4.'
              : 'Precisa de pelo menos 2 jogadores (até 4). A sala aparece no salão para todos.'),
          ]
          : jogador
            ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ` Esperando ${dono?.nome || 'quem abriu a sala'} começar...`)
            : [
              s.jogadores.length < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
              h('p', { class: 'suave' }, 'Você está assistindo.'),
            ]));
  }

  async function desistirCobras() {
    if (!await confirmar('Se sair agora, sua cobra sai do jogo e vira cenouras.', { titulo: 'Sair da partida?', ok: 'Sair', perigo: true })) return;
    sair();
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
  // Teclas: A-D no quiz, setas na cobrinha ao vivo e 1 a 7 no Lig 4.
  const aoTeclar = ev => {
    const s = rt.partidas.get(id);
    if (ev.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    if (s?.jogo === 'cobras') {
      const d = DIRECOES[ev.code];
      if (d && s.status === 'jogando' && s.eu >= 0) { ev.preventDefault(); virarCobra(d); }
      return;
    }
    if (s?.jogo === 'lig4') {
      const col = Number(ev.key) - 1;
      if (col >= 0 && col < 7 && minhaVez(s)) { ev.preventDefault(); enviar('sala:jogar', { id, jogada: { coluna: col } }); }
      return;
    }
    teclaQuiz(ev, s, acoesQuiz.responder);
  };
  document.addEventListener('keydown', aoTeclar);
  // Contagem da largada da cobrinha.
  const relogioCobras = setInterval(() => { if (quadroCobras?.fase === 'largada') avisoCobras(); }, 200);
  escutar('cobras:quadro', ({ id: sid, q }) => { if (sid === id) receberQuadroCobras(q); });
  // Mede o atraso da conexão de tempos em tempos (a sua cobra vira na tela na hora certa).
  let pingou = false;
  const pingar = () => { if (rt.partidas.get(id)?.jogo === 'cobras') enviar('ping', { t: performance.now() }, { silencioso: true }); };
  escutar('pong', ({ t }) => {
    const ida = performance.now() - t;
    suave.rtt = pingou ? suave.rtt * 0.7 + ida * 0.3 : ida;
    pingou = true;
  });
  const relogioPing = setInterval(pingar, 2000);
  setTimeout(pingar, 300);
  aoSair(() => {
    clearInterval(relogioQuiz);
    clearInterval(relogioCobras);
    clearInterval(relogioPing);
    cancelAnimationFrame(laco);
    document.removeEventListener('keydown', aoTeclar);
  });

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

const N_COBRA = 20;
const LADO_COBRA = 600;
const C_COBRA = LADO_COBRA / N_COBRA;

// Cenoura numa casa do tabuleiro (x, y em casas; C = tamanho da casa).
function desenharCenoura(g, x, y, C) {
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

// Desenha o tabuleiro da cobrinha: e = { cobra: [{x, y}], comida: {x, y} | null, direcao: [dx, dy], bateu }.
function desenharCobrinha(g, { cobra, comida, direcao, bateu }) {
  const C = C_COBRA;
  for (let y = 0; y < N_COBRA; y++) {
    for (let x = 0; x < N_COBRA; x++) {
      g.fillStyle = (x + y) % 2 ? '#0c170f' : '#0f1c12';
      g.fillRect(x * C, y * C, C, C);
    }
  }
  if (comida) desenharCenoura(g, comida.x, comida.y, C);
  cobra.forEach((p, i) => {
    const t = i / Math.max(1, cobra.length - 1);
    g.fillStyle = i === 0 ? (bateu ? '#d8674a' : '#d8b13a') : `rgb(${Math.round(127 - 50 * t)}, ${Math.round(176 - 60 * t)}, ${Math.round(105 - 40 * t)})`;
    const m = i === 0 ? 1.5 : 3;
    g.beginPath();
    if (g.roundRect) g.roundRect(p.x * C + m, p.y * C + m, C - m * 2, C - m * 2, i === 0 ? 9 : 7);
    else g.rect(p.x * C + m, p.y * C + m, C - m * 2, C - m * 2);
    g.fill();
  });
  // Olhinhos na direção em que a cobra anda.
  const cab = cobra[0];
  if (!cab) return;
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

/* ─── Cobrinha ao vivo: o desenho ─────────────────── */

// Cor de cada cobra (a ordem de quem entrou na sala): dourada, vermelha, azul e roxa.
const CORES_COBRAS = ['#d8b13a', '#d8674a', '#5aa0d8', '#b77be6'];
const escurecer = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - t)));
  return `rgb(${c.join(', ')})`;
};

// O fundo quadriculado e a cenoura ficam prontos numa imagem guardada (desenhar 768 casas a cada
// quadro de tela, 60 vezes por segundo, é trabalho à toa).
function prepararArena(visor, q) {
  const C = visor.tela.width / q.l;
  if (visor.fundo?.l === q.l && visor.fundo?.a === q.a) return C;
  const fundo = document.createElement('canvas');
  fundo.width = visor.tela.width;
  fundo.height = visor.tela.height;
  const g = fundo.getContext('2d');
  for (let y = 0; y < q.a; y++) {
    for (let x = 0; x < q.l; x++) {
      g.fillStyle = (x + y) % 2 ? '#0c170f' : '#0f1c12';
      g.fillRect(x * C, y * C, C, C);
    }
  }
  const cenoura = document.createElement('canvas');
  cenoura.width = Math.ceil(C);
  cenoura.height = Math.ceil(C);
  desenharCenoura(cenoura.getContext('2d'), 0, 0, C);
  visor.fundo = { l: q.l, a: q.a, img: fundo, cenoura };
  return C;
}

// q = quadro do servidor (as cenouras); cobras = o que o suavizador diz para desenhar agora:
// [{ i, pontos: [[x, y]...] em casas (podem ser fracionados), dir }]. eu = índice de quem vê (ou -1).
function desenharArena(visor, q, cobras, eu) {
  const g = visor.g;
  const C = prepararArena(visor, q);
  g.drawImage(visor.fundo.img, 0, 0);
  for (let k = 0; k + 1 < q.f.length; k += 2) g.drawImage(visor.fundo.cenoura, q.f[k] * C, q.f[k + 1] * C);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const c of cobras) {
    if (!c || !c.pontos.length) continue;
    const cor = CORES_COBRAS[c.i];
    const pts = c.pontos.map(([x, y]) => [x * C + C / 2, y * C + C / 2]);
    const linha = () => {
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (pts.length === 1) g.lineTo(pts[0][0] + 0.01, pts[0][1]);
    };
    // Corpo: uma linha grossa passando pelo meio das casas, com um brilho no meio.
    g.strokeStyle = escurecer(cor, 0.42);
    g.lineWidth = C * 0.74;
    linha();
    g.stroke();
    g.strokeStyle = escurecer(cor, 0.18);
    g.lineWidth = C * 0.38;
    linha();
    g.stroke();
    // Cabeça
    const [hx, hy] = pts[0];
    g.fillStyle = cor;
    g.beginPath();
    g.arc(hx, hy, C * 0.47, 0, Math.PI * 2);
    g.fill();
    if (c.i === eu) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
    }
    const [dx, dy] = c.dir;
    g.fillStyle = '#1b1403';
    for (const lado of [-1, 1]) {
      g.beginPath();
      g.arc(hx + dx * C * 0.18 + dy * lado * C * 0.2, hy + dy * C * 0.18 + dx * lado * C * 0.2, C * 0.1, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// Mostra quantas pessoas estão assistindo quem joga.
function contadorPlateia() {
  const el = h('span', { class: 'plateia', hidden: !rt.plateia });
  const desenhar = () => { el.hidden = !rt.plateia; trocar(el, icone('olho'), ` ${rt.plateia} assistindo`); };
  escutar('solo:plateia', desenhar);
  desenhar();
  return el;
}

export function cobrinha() {
  exigirAcesso();
  const N = N_COBRA;
  const tela = h('canvas', { class: 'cobra-tela', width: LADO_COBRA, height: LADO_COBRA, 'aria-label': 'Tabuleiro da cobrinha' });
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
    transmitirQuadro();
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

  let bateuAgora = false;
  function desenharTudo(bateu = false) {
    bateuAgora = bateu;
    desenharCobrinha(g, { cobra, comida, direcao, bateu });
    transmitirQuadro();
  }

  // Quem assiste recebe a cobra, a cenoura e a situação a cada passo.
  function transmitirQuadro() {
    if (!cobra) return;
    enviarQuadro({ c: cobra.flatMap(p => [p.x, p.y]), f: comida ? [comida.x, comida.y] : null, d: direcao, pts: pontos, s: situacao, b: bateuAgora ? 1 : 0 }, true);
  }
  escutar('estado', () => { if (rt.conectado) { transmitir('cobrinha'); transmitirQuadro(); } });
  if (rt.conectado) transmitir('cobrinha');

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
    pararTransmissao();
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
          contadorPlateia(),
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
  let fonteAtual = null;
  let cronometro = null;
  let transmissao = null; // { info, estado() } enquanto monta uma imagem
  aoSair(() => {
    clearInterval(cronometro);
    pararTransmissao();
    if (urlImagem) URL.revokeObjectURL(urlImagem);
  });
  escutar('estado', () => {
    if (rt.conectado && transmissao) { transmitir('quebra', transmissao.info); enviarQuadro(transmissao.estado(), true); }
  });

  const cab = sub => cabecalho({ titulo: 'Quebra-cabeça', icone: 'peca', voltar: { href: '#/recreacao', texto: 'Recreação' }, sub });

  function escolher() {
    clearInterval(cronometro);
    if (transmissao) { transmissao = null; pararTransmissao(); }
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
      fonteAtual = src;
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
      trocar(tabuleiro, pecas.map((p, i) => h('button', {
        class: `qc-peca ${selecionada === i ? 'selecionada' : ''}`.trim(),
        type: 'button',
        'data-i': i,
        'aria-label': `Peça ${i + 1}`,
        style: estiloPeca(urlImagem, n, p),
      })));
      if (transmissao) enviarQuadro(transmissao.estado(), true);
    }

    // Quem assiste vê a mesma imagem e a posição de cada peça.
    transmissao = {
      info: { src: fonteAtual, n, titulo, variante },
      estado: () => ({ p: pecas, mov: movimentos, seg: Math.round(segundos()), ok: resolvido ? 1 : 0 }),
    };
    if (rt.conectado) transmitir('quebra', transmissao.info);

    function trocarPecas(a, b) {
      if (resolvido || a === b) return;
      if (!comeco) {
        comeco = Date.now();
        cronometro = setInterval(() => {
          tempoEl.textContent = relogio(segundos());
          if (transmissao) enviarQuadro(transmissao.estado());
        }, 1000);
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
      setTimeout(() => { if (transmissao) enviarQuadro(transmissao.estado(), true); }, 80);
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
            contadorPlateia(),
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

// Fundo de uma peça do quebra-cabeça: a parte certa da imagem para a peça p.
function estiloPeca(url, n, p) {
  const lin = Math.floor(p / n);
  const col = p % n;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${n * 100}% ${n * 100}%`,
    backgroundPosition: `${(col / (n - 1)) * 100}% ${(lin / (n - 1)) * 100}%`,
  };
}

/* ─── Jogo da Memória ─────────────────────────────── */

// Tamanhos (linhas x colunas) e as figuras das cartas (ícones do site).
const MEMORIA = { '4x4': [4, 4], '4x6': [4, 6], '6x6': [6, 6] };
const FIGURAS = ['coelho', 'coroa', 'escudo', 'espada', 'moeda', 'pergaminho', 'balanca', 'cruz', 'coluna', 'alvo',
  'bandeira', 'bau', 'chave', 'alianca', 'pena', 'mapa', 'estrela', 'musica', 'trofeu', 'cobra'];
let tamanhoMemoria = '4x4';

const embaralharLista = lista => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Uma carta: o verso (o coelho da Casa) e a frente (a figura). Vira com animação.
function cartaMemoria(fig, onclick) {
  return h(onclick ? 'button' : 'div', { class: 'mem-carta', type: onclick ? 'button' : null, onclick, 'aria-label': 'Carta' },
    h('span', { class: 'mem-verso' }, icone('coelho')),
    h('span', { class: 'mem-frente' }, fig && icone(fig)));
}

export function memoria() {
  exigirAcesso();
  const grade = h('div', { class: 'mem-grade' });
  const moldura = h('div', { class: 'mem-moldura' });
  const jogadasEl = h('strong', null, '0');
  const paresEl = h('strong', null, '0');
  const tempoEl = h('strong', null, '0:00');
  const recordeEl = h('strong', null, '...');
  const sobre = h('div', { class: 'cobra-sobre mem-sobre', hidden: true });
  const ranking = h('div');
  const seletor = h('div', { class: 'segmentado' });
  const tituloRanking = h('span');
  let cartas = [];
  let botoes = [];
  let abertas = [];
  let jogadas = 0;
  let achados = 0;
  let inicio = 0;
  let seg = 0;
  let situacao = 'pronto';
  let relogioId = null;
  let fecharTimer = null;
  let recorde = null;

  function novoJogo() {
    clearInterval(relogioId);
    clearTimeout(fecharTimer);
    const [lin, col] = MEMORIA[tamanhoMemoria];
    const figs = embaralharLista(FIGURAS).slice(0, (lin * col) / 2);
    cartas = embaralharLista([...figs, ...figs]).map(fig => ({ fig, achada: false }));
    abertas = [];
    jogadas = 0;
    achados = 0;
    seg = 0;
    situacao = 'pronto';
    moldura.style.setProperty('--colunas', col);
    moldura.style.setProperty('--linhas', lin);
    botoes = cartas.map((c, i) => cartaMemoria(c.fig, () => clicar(i)));
    trocar(grade, botoes);
    sobre.hidden = true;
    desenharSeletor();
    atualizar();
    carregarRanking();
    if (rt.conectado) transmitir('memoria', { n: tamanhoMemoria });
    transmitirQuadro(true);
  }

  // Duas cartas diferentes ficam abertas um instante; clicar noutra já fecha as duas.
  function fecharAbertas() {
    clearTimeout(fecharTimer);
    fecharTimer = null;
    abertas = [];
  }

  function clicar(i) {
    if (situacao === 'fim' || cartas[i].achada || abertas.includes(i)) return;
    if (fecharTimer) fecharAbertas();
    if (situacao === 'pronto') {
      situacao = 'jogando';
      inicio = Date.now();
      relogioId = setInterval(tique, 500);
    }
    abertas.push(i);
    if (abertas.length === 2) {
      jogadas++;
      const [a, b] = abertas;
      if (cartas[a].fig === cartas[b].fig) {
        cartas[a].achada = true;
        cartas[b].achada = true;
        achados++;
        abertas = [];
        if (achados === cartas.length / 2) fimDeJogo();
      } else {
        fecharTimer = setTimeout(() => { fecharAbertas(); atualizar(); transmitirQuadro(true); }, 900);
      }
    }
    atualizar();
    transmitirQuadro(true);
  }

  function tique() {
    seg = Math.floor((Date.now() - inicio) / 1000);
    tempoEl.textContent = relogio(seg);
    transmitirQuadro();
  }

  function atualizar() {
    botoes.forEach((b, i) => {
      b.classList.toggle('virada', abertas.includes(i));
      b.classList.toggle('achada', cartas[i].achada);
      b.disabled = situacao === 'fim' || cartas[i].achada;
    });
    jogadasEl.textContent = jogadas;
    paresEl.textContent = `${achados} de ${cartas.length / 2}`;
    tempoEl.textContent = relogio(seg);
  }

  async function fimDeJogo() {
    situacao = 'fim';
    clearInterval(relogioId);
    seg = Math.floor((Date.now() - inicio) / 1000);
    const caixa = h('div', { class: 'cobra-caixa' },
      h('h2', null, 'Todos os pares!'),
      h('p', { class: 'cobra-placar' }, `${jogadas} jogadas em ${relogio(seg)}`),
      botao('Jogar de novo', { classe: 'btn-ouro', icone: 'frente', onclick: novoJogo }));
    trocar(sobre, caixa);
    sobre.hidden = false;
    atualizar();
    transmitirQuadro(true);
    try {
      const r = await post('/api/recreacao/recordes', { jogo: 'memoria', variante: tamanhoMemoria, pontos: jogadas, detalhe: relogio(seg) });
      if (r.recorde) {
        caixa.insertBefore(h('p', { class: 'cobra-recorde' }, icone('trofeu'), r.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!'), caixa.lastChild);
        carregarRanking();
      }
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }

  function desenharSeletor() {
    trocar(seletor, Object.keys(MEMORIA).map(t => h('button', {
      class: `seg ${t === tamanhoMemoria ? 'ativo' : ''}`.trim(), type: 'button',
      onclick: () => { if (t !== tamanhoMemoria) { tamanhoMemoria = t; novoJogo(); } },
    }, `${t} (${(MEMORIA[t][0] * MEMORIA[t][1]) / 2} pares)`)));
  }

  // Quem assiste recebe as cartas abertas e achadas (as fechadas vão como -1, sem entregar a figura).
  function transmitirQuadro(urgente = false) {
    enviarQuadro({
      t: tamanhoMemoria, j: jogadas, seg, s: situacao,
      v: cartas.map((c, i) => (c.achada || abertas.includes(i) ? FIGURAS.indexOf(c.fig) : -1)),
      ac: cartas.map(c => (c.achada ? 1 : 0)),
    }, urgente);
  }
  escutar('estado', () => { if (rt.conectado) { transmitir('memoria', { n: tamanhoMemoria }); transmitirQuadro(true); } });

  function carregarRanking() {
    tituloRanking.textContent = `Melhores (${tamanhoMemoria})`;
    get('/api/recreacao/ranking').then(r => {
      const lista = r.memoria?.[tamanhoMemoria] || [];
      const meu = lista.find(l => l.nome === estado.eu.nome);
      recorde = meu ? meu.jogadas : null;
      recordeEl.textContent = recorde ?? '-';
      trocar(ranking, lista.length
        ? h('ol', { class: 'mini-ranking' }, lista.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, `${l.jogadas} jogadas`))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda neste tamanho. Seja o primeiro!'));
    }).catch(() => {});
  }

  aoSair(() => {
    clearInterval(relogioId);
    clearTimeout(fecharTimer);
    situacao = 'fim';
    pararTransmissao();
  });
  novoJogo();

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: 'Jogo da Memória', icone: 'cartas', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Vire duas cartas por vez e ache os pares. Quanto menos jogadas, melhor.',
      acoes: [botao('Embaralhar de novo', { icone: 'aleatorio', onclick: novoJogo })],
    }),
    h('div', { class: 'jogo-solo' },
      h('div', { class: 'jogo-area' },
        seletor,
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Jogadas: ', jogadasEl),
          h('span', null, 'Pares: ', paresEl),
          h('span', null, icone('relogio'), ' ', tempoEl),
          contadorPlateia(),
          h('span', null, icone('trofeu'), ' Seu recorde: ', recordeEl)),
        (moldura.append(grade, sobre), moldura)),
      h('aside', { class: 'painel jogo-lateral' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), tituloRanking)),
        ranking)));
}

/* ─── Assistir quem joga sozinho ──────────────────── */

function assistirMemoria() {
  const grade = h('div', { class: 'mem-grade espectador' });
  const moldura = h('div', { class: 'mem-moldura' });
  const jogadasEl = h('strong', null, '0');
  const tempoEl = h('strong', null, '0:00');
  const tamanhoEl = h('span', { class: 'suave' });
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  let chave = '';
  let cartas = [];
  return {
    el: h('div', { class: 'jogo-area' },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, 'Jogadas: ', jogadasEl), h('span', null, icone('relogio'), ' ', tempoEl), tamanhoEl),
      (moldura.append(grade, aviso_), moldura)),
    quadro(q) {
      const [lin, col] = MEMORIA[q.t] || MEMORIA['4x4'];
      if (chave !== `${q.t}:${q.v.length}`) {
        chave = `${q.t}:${q.v.length}`;
        moldura.style.setProperty('--colunas', col);
        moldura.style.setProperty('--linhas', lin);
        cartas = q.v.map(() => cartaMemoria(null));
        trocar(grade, cartas);
      }
      q.v.forEach((f, i) => {
        const c = cartas[i];
        if (!c) return;
        if (f >= 0) trocar(c.lastChild, icone(FIGURAS[f]));
        c.classList.toggle('virada', f >= 0 && !q.ac[i]);
        c.classList.toggle('achada', !!q.ac[i]);
      });
      jogadasEl.textContent = q.j ?? 0;
      tempoEl.textContent = relogio(q.seg || 0);
      tamanhoEl.textContent = q.t || '';
      aviso_.hidden = q.s !== 'fim';
      if (q.s === 'fim') aviso_.textContent = `Achou todos os pares em ${q.j} jogadas!`;
    },
    parar() {},
  };
}

function assistirCobrinha() {
  const tela = h('canvas', { class: 'cobra-tela', width: LADO_COBRA, height: LADO_COBRA, 'aria-label': 'Tabuleiro da cobrinha' });
  const g = tela.getContext('2d');
  const pontosEl = h('strong', null, '0');
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  desenharCobrinha(g, { cobra: [], comida: null, direcao: [1, 0] });
  return {
    el: h('div', { class: 'jogo-area' },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, 'Cenouras: ', pontosEl)),
      h('div', { class: 'cobra-moldura' }, tela, aviso_)),
    quadro(q) {
      const cobra = [];
      for (let i = 0; i + 1 < (q.c || []).length; i += 2) cobra.push({ x: q.c[i], y: q.c[i + 1] });
      desenharCobrinha(g, { cobra, comida: q.f ? { x: q.f[0], y: q.f[1] } : null, direcao: q.d || [1, 0], bateu: !!q.b });
      pontosEl.textContent = q.pts ?? 0;
      const texto = { pronto: 'Preparando...', pausado: 'Pausado', fim: `Fim de jogo: ${q.pts} ${q.pts === 1 ? 'cenoura' : 'cenouras'}` }[q.s];
      aviso_.hidden = !texto;
      if (texto) aviso_.textContent = texto;
    },
    parar() {},
  };
}

function assistirQuebra(t) {
  const info = t.info || {};
  const n = Math.min(5, Math.max(3, Number(info.n) || 3));
  const tabuleiro = h('div', { class: 'qc-tabuleiro espectador', style: { '--n': n } });
  const tempoEl = h('strong', null, '0:00');
  const movEl = h('strong', null, '0');
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  let url = null;
  let ultimo = null;
  let parado = false;
  const desenhar = q => {
    if (!url || !Array.isArray(q?.p)) return;
    trocar(tabuleiro, q.p.map(peca => h('div', { class: 'qc-peca', style: estiloPeca(url, n, peca) })));
    tabuleiro.classList.toggle('resolvido', !!q.ok);
  };
  recortarQuadrado(info.src || '/img/brasao.png')
    .then(u => { if (parado) { URL.revokeObjectURL(u); return; } url = u; desenhar(ultimo); })
    .catch(() => { aviso_.hidden = false; aviso_.textContent = 'Não consegui abrir a imagem deste quebra-cabeça.'; });
  return {
    el: h('div', { class: 'jogo-area' },
      h('div', { class: 'cobra-placar-linha' },
        h('span', null, icone('relogio'), ' ', tempoEl),
        h('span', null, 'Trocas: ', movEl),
        h('span', { class: 'suave' }, [info.variante, info.titulo].filter(Boolean).join(' · '))),
      h('div', { class: 'qc-moldura' }, tabuleiro, aviso_)),
    quadro(q) {
      ultimo = q;
      desenhar(q);
      tempoEl.textContent = relogio(q.seg || 0);
      movEl.textContent = q.mov || 0;
      aviso_.hidden = !q.ok;
      if (q.ok) aviso_.textContent = 'Montado!';
    },
    parar() { parado = true; if (url) URL.revokeObjectURL(url); },
  };
}

const TELA_DO_JOGO = { pacman: '#/recreacao/pac-coelho', cobrinha: '#/recreacao/cobrinha', quebra: '#/recreacao/quebra-cabeca', memoria: '#/recreacao/memoria' };

export function assistir(id) {
  exigirAcesso();
  id = Number(id);
  lendoChat(!document.hidden);
  const aoVisibilidade = () => lendoChat(!document.hidden);
  document.addEventListener('visibilitychange', aoVisibilidade);
  aoSair(() => { document.removeEventListener('visibilitychange', aoVisibilidade); lendoChat(false); });

  const topo = h('div');
  const area = h('div', { class: 'assistir-area' }, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
  let visor = null;
  let chave = null;
  let atual = null;
  let acabou = false;
  let pedido = false;
  const pedir = () => { if (rt.conectado && !pedido) pedido = enviar('solo:assistir', { id }, { silencioso: true }); };

  function desenharTopo() {
    const t = atual;
    trocar(topo, cabecalho({
      titulo: t ? `${t.nome} ${acabou ? 'parou de jogar' : 'está jogando'}` : 'Assistir', icone: 'olho',
      voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: t ? `${t.nomeJogo}${!acabou && t.espectadores > 1 ? ` · ${t.espectadores} pessoas assistindo` : ''}` : 'Conectando...',
      acoes: t ? [
        h('a', { class: 'btn', href: `#/pessoa/${t.id}` }, icone('usuario'), h('span', null, 'Ver perfil')),
        h('a', { class: 'btn btn-ouro', href: TELA_DO_JOGO[t.jogo] }, icone('jogos'), h('span', null, 'Jogar também')),
      ] : [],
    }));
  }

  function montar(t) {
    atual = t;
    acabou = false;
    area.querySelector('.assistir-parou')?.remove();
    const nova = `${t.jogo}:${JSON.stringify(t.info || {})}`;
    if (nova !== chave || !visor) {
      visor?.parar();
      chave = nova;
      visor = t.jogo === 'pacman' ? assistirPac() : t.jogo === 'cobrinha' ? assistirCobrinha() : t.jogo === 'memoria' ? assistirMemoria() : assistirQuebra(t);
      trocar(area, visor.el);
    }
    if (t.quadro) visor.quadro(t.quadro);
    desenharTopo();
  }

  escutar('solo:info', ({ t }) => { if (t.id === id) montar(t); });
  escutar('solo:quadro', ({ id: de, q }) => {
    if (de !== id || !visor) return;
    try { visor.quadro(q); } catch (e) { console.error(e); }
  });
  escutar('solo:fim', ({ id: de }) => {
    if (de !== id) return;
    acabou = true;
    pedido = false;
    desenharTopo();
    if (!area.querySelector('.assistir-parou')) {
      area.prepend(h('p', { class: 'nota assistir-parou' }, icone('relogio'),
        h('span', null, `${atual?.nome || 'A pessoa'} saiu do jogo. Se voltar a jogar, a transmissão continua aqui sozinha.`)));
    }
  });
  escutar('transmissoes', () => {
    const t = rt.transmissoes.find(x => x.id === id);
    if (t && acabou) pedir();
    else if (t && atual && !acabou) { atual.espectadores = t.espectadores; desenharTopo(); }
  });
  escutar('estado', () => { pedido = false; pedir(); });
  escutar('erro', ({ mensagem }) => {
    if (!visor && /não está jogando/.test(mensagem)) {
      trocar(area, vazio('Essa pessoa não está jogando agora', 'Quando ela começar um jogo, a transmissão aparece aqui e em "Jogando agora" na Recreação.',
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar à Recreação')));
    }
  });
  aoSair(() => { visor?.parar(); enviar('solo:sair', { id }, { silencioso: true }); });

  pedir();
  desenharTopo();
  return h('div', { class: 'pagina assistir' }, topo, h('div', { class: 'assistir-grade' }, area, painelChat()));
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
