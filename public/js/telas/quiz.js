// Quiz de Lyendell: abrir sala, a tela da partida ao vivo e o cadastro de perguntas.

import { h, trocar, icone, botao, botaoIcone, cabecalho, vazio, avatar, confirmar, get, post, put, del, pode, modalForm, campo, tentar, num, normalizar } from '../core.js';
import { rt, criarPartida, entrarNaPartida } from '../tempo-real.js';

const LETRAS = ['A', 'B', 'C', 'D'];
const QUANTIDADES = [5, 10, 15];
// Os modos do quiz: cada um por si, a sala inteira junta (co-op) ou dois times (versus).
export const MODOS_QUIZ = {
  todos: { nome: 'Todos contra todos', curto: 'todos contra todos', texto: 'Cada um por si: vence quem fizer mais pontos.' },
  equipe: { nome: 'Em equipe (co-op)', curto: 'em equipe', texto: 'A sala inteira é um time: juntos, vocês precisam acertar 60% de todas as respostas.' },
  times: { nome: 'Dois times (versus)', curto: 'dois times', texto: 'O jogo sorteia dois times no começo; vence o time que somar mais pontos.' },
};
const NOMES_TIMES = ['Time Dourado', 'Time Azul'];

/* ─── Abrir uma sala ──────────────────────────────── */

export async function abrirSalaQuiz() {
  const dados = await tentar(() => get('/api/recreacao/quiz'));
  if (!dados) return;
  const escolhidas = new Set(dados.categorias.filter(c => c.total).map(c => c.id));
  let quantidade = 10;

  const categorias = h('div', { class: 'quiz-cats' });
  const desenharCats = () => trocar(categorias, dados.categorias.map(c => h('label', { class: `quiz-cat ${escolhidas.has(c.id) ? 'ativa' : ''} ${c.total ? '' : 'vazia'}`.replace(/\s+/g, ' ').trim() },
    h('input', {
      type: 'checkbox', checked: escolhidas.has(c.id), disabled: !c.total,
      onchange: e => { e.target.checked ? escolhidas.add(c.id) : escolhidas.delete(c.id); desenharCats(); },
    }),
    h('span', { class: 'quiz-cat-check' }, icone('check')),
    h('span', null, h('strong', null, c.nome), h('small', null, c.total ? `${c.total} perguntas` : 'nenhuma pergunta ainda')))));
  desenharCats();

  let modo = 'todos';
  const modos = h('div', { class: 'modos-escolha' });
  const desenharModos = () => trocar(modos, Object.entries(MODOS_QUIZ).map(([k, m]) => h('button', {
    type: 'button', class: `modo-opcao ${k === modo ? 'ativo' : ''}`.trim(), 'aria-pressed': String(k === modo),
    onclick: () => { modo = k; desenharModos(); },
  }, h('strong', null, m.nome), h('small', null, m.texto))));
  desenharModos();

  const qtd = h('div', { class: 'segmentado' });
  const desenharQtd = () => trocar(qtd, QUANTIDADES.map(n =>
    h('button', { class: `seg ${n === quantidade ? 'ativo' : ''}`, type: 'button', onclick: () => { quantidade = n; desenharQtd(); } }, `${n} perguntas`)));
  desenharQtd();

  modalForm({
    titulo: 'Abrir sala do Quiz',
    textoOk: 'Abrir sala',
    conteudo: [
      h('p', { class: 'form-intro' }, 'A sala aparece para todos no salão. Quando quiser, você começa: cada pergunta vale até 1000 pontos, e quem responde mais rápido ganha mais.'),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Modo'), modos),
      campo('Categorias', categorias),
      campo('Tamanho da partida', qtd),
    ],
    aoEnviar() {
      if (!escolhidas.size) throw new Error('Escolha pelo menos uma categoria.');
      criarPartida('quiz', { categorias: [...escolhidas], quantidade, modo });
    },
  });
}

/* ─── Tela da partida ─────────────────────────────── */

// Tela do quiz dentro da sala. "acoes" vem da tela da sala: sair, desistir e responder.
export function telaQuiz(s, acoes) {
  const e = s.estado;
  const jogador = s.eu >= 0;
  const euId = jogador ? s.jogadores[s.eu].id : null;
  const souDono = jogador && s.dono === euId;
  const pessoa = id => s.jogadores.find(p => p.id === id);

  const botoes = [];
  if (s.status === 'esperando' && jogador) botoes.push(botao(souDono ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: acoes.sair }));
  else if (s.status === 'jogando' && jogador) botoes.push(botao('Sair do quiz', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: acoes.desistir }));
  else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));

  const cats = (s.opcoes?.categorias || []).map(c => ({ luckham: 'Família Luckham', coelhos: 'Coelhos', minecraft: 'Minecraft', rp: 'Regras de RP' }[c]));
  const topo = cabecalho({
    titulo: s.nomeJogo, icone: 'pergunta', voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes,
    sub: `${MODOS_QUIZ[s.opcoes?.modo || 'todos'].nome} · ${cats.join(', ')} · ${s.opcoes?.quantidade || ''} perguntas`,
  });

  if (s.status === 'esperando') return [topo, salaDeEspera(s, { jogador, souDono, acoes })];
  if (s.status === 'fim' || e?.fase === 'fim') return [topo, resultado(s, { jogador, euId, souDono, acoes })];

  const revelada = e.fase === 'resposta';
  const minha = e.minha;
  const podeResponder = jogador && !s.jogadores[s.eu].saiu && !revelada && minha == null;
  const escolhas = {};
  for (const r of e.respostas || []) (escolhas[r.alt] ||= []).push(r.id);

  const alternativas = h('div', { class: `quiz-alts ${revelada ? 'revelada' : ''}`.trim() }, e.alternativas.map((t, i) => {
    const classes = ['quiz-alt', `alt-${i}`];
    if (minha === i) classes.push('marcada');
    if (revelada && i === e.correta) classes.push('certa');
    else if (revelada && minha === i) classes.push('errada');
    else if (minha != null && minha !== i && !revelada) classes.push('apagada');
    return h('button', { class: classes.join(' '), type: 'button', disabled: !podeResponder, onclick: () => acoes.responder(i) },
      h('span', { class: 'quiz-letra' }, LETRAS[i]),
      h('span', { class: 'quiz-alt-texto' }, t),
      revelada && i === e.correta && h('span', { class: 'quiz-alt-marca' }, icone('check')),
      revelada && escolhas[i] && h('span', { class: 'quiz-quem' }, escolhas[i].map(id => {
        const p = pessoa(id);
        return p ? h('span', { title: p.nome }, avatar(p.nome, 'avatar-p', p.foto)) : null;
      })));
  }));

  // Barra do tempo: começa do que falta e desce até zero.
  const cheia = h('div', { class: 'quiz-tempo-cheia', style: { width: `${revelada ? 0 : (e.restante / e.tempoTotal) * 100}%` } });
  if (!revelada) {
    setTimeout(() => {
      cheia.style.transition = `width ${e.restante}ms linear`;
      cheia.style.width = '0%';
    }, 30);
  }

  let status;
  if (revelada) {
    const minhaResp = (e.respostas || []).find(r => r.id === euId);
    let texto;
    let classe = '';
    if (!jogador) texto = `A resposta certa é a ${LETRAS[e.correta]}.`;
    else if (!minhaResp) { texto = 'O tempo acabou e você não respondeu.'; classe = 'errou'; }
    else if (minhaResp.alt === e.correta) { texto = `Acertou! +${num(minhaResp.pontos)} pontos`; classe = 'acertou'; }
    else { texto = `Errou! A certa é a ${LETRAS[e.correta]}.`; classe = 'errou'; }
    status = h('div', { class: `quiz-status ${classe}`.trim() },
      h('strong', null, texto),
      h('small', null, e.ultima ? 'Resultado final em ' : 'Próxima pergunta em ', h('span', { 'data-fim': Date.now() + e.proxima }, Math.ceil(e.proxima / 1000)), ' s'));
  } else {
    const ativos = s.jogadores.filter(p => !p.saiu);
    const faltam = ativos.length - e.responderam.length;
    status = h('div', { class: 'quiz-status' },
      h('strong', null, !jogador ? 'Os jogadores estão respondendo...' : minha != null ? 'Resposta enviada!' : 'Escolha uma resposta'),
      h('small', null, minha != null || !jogador
        ? (faltam > 0 ? `Esperando ${faltam === 1 ? '1 pessoa' : `${faltam} pessoas`} responder...` : 'Todos responderam!')
        : 'Use o mouse ou as teclas A, B, C e D (ou 1 a 4).'));
  }

  return [topo, h('div', { class: 'quiz-jogo' },
    h('section', { class: 'painel quiz-pergunta' },
      h('div', { class: 'quiz-topo' },
        h('span', { class: 'quiz-numero' }, `Pergunta ${e.numero} de ${e.total}`),
        h('span', { class: 'chip chip-ouro' }, e.categoria),
        h('span', { class: `quiz-relogio ${revelada ? 'parado' : ''}`.trim() }, icone('relogio'),
          revelada ? '0' : h('span', { 'data-fim': Date.now() + e.restante }, Math.ceil(e.restante / 1000)))),
      h('div', { class: 'quiz-tempo' }, cheia),
      h('h2', { class: 'quiz-texto' }, e.texto),
      alternativas,
      status),
    placar(s, { euId, revelada })),
    s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} ${s.espectadores === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}`)];
}

function salaDeEspera(s, { jogador, souDono, acoes }) {
  const dono = s.jogadores.find(p => p.id === s.dono);
  return h('div', { class: 'quiz-espera painel' },
    h('div', { class: 'painel-cab' },
      h('h2', null, icone('usuarios'), `Na sala: ${s.jogadores.length} de ${s.max}`)),
    h('p', { class: 'modo-da-sala' }, icone(s.opcoes?.modo === 'equipe' ? 'usuarios' : 'espada'), h('strong', null, MODOS_QUIZ[s.opcoes?.modo || 'todos'].nome), ' ', MODOS_QUIZ[s.opcoes?.modo || 'todos'].texto),
    h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
      avatar(p.nome, '', p.foto),
      h('span', null, p.nome),
      p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
    h('div', { class: 'quiz-espera-acao' },
      souDono
        ? [
          botao(s.jogadores.length > 1 ? 'Começar o quiz' : s.opcoes?.modo === 'times' ? 'Esperando mais gente...' : 'Começar sozinho (treino)', {
            classe: 'btn-ouro btn-grande', icone: 'frente', onclick: acoes.comecar, desativado: s.opcoes?.modo === 'times' && s.jogadores.length < 2,
          }),
          h('p', { class: 'suave' }, s.jogadores.length > 1
            ? 'Quem entrar depois de começar só pode assistir.'
            : 'A sala aparece no salão para todos. Com uma pessoa só vale como treino e não conta vitória.'),
        ]
        : jogador
          ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ` Esperando ${dono?.nome || 'quem abriu a sala'} começar...`)
          : [
            s.jogadores.length < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
            h('p', { class: 'suave' }, 'Você está assistindo.'),
          ]));
}

// O que a equipe (co-op) ou cada time (versus) já fez.
function resumoModo(e) {
  const r = e.resumo;
  if (!r || r.modo === 'todos') return null;
  if (r.modo === 'equipe') {
    const pct = Math.min(100, (r.acertos / r.meta) * 100);
    return h('div', { class: 'quiz-equipe' },
      h('p', null, h('strong', null, `Equipe: ${r.acertos} de ${r.meta} acertos`), h('small', null, r.acertos >= r.meta ? ' Meta batida!' : ' para bater a meta')),
      h('div', { class: `barra ${pct >= 100 ? 'completa' : ''}`.trim() }, h('div', { class: 'barra-cheia', style: { width: `${pct}%` } })));
  }
  return h('div', { class: 'quiz-times' }, [0, 1].map(t => h('div', { class: `quiz-time t${t} ${r.pontos[t] > r.pontos[1 - t] ? 'na-frente' : ''}`.trim() },
    h('small', null, NOMES_TIMES[t]), h('strong', null, num(r.pontos[t])))));
}

function placar(s, { euId, revelada }) {
  const e = s.estado;
  const ganhos = Object.fromEntries((e.respostas || []).map(r => [r.id, r.pontos]));
  const responderam = new Set(e.responderam || []);
  return h('aside', { class: 'painel quiz-placar' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Placar')),
    resumoModo(e),
    h('ol', { class: 'quiz-lista' }, e.placar.map((pl, n) => {
      const p = s.jogadores.find(x => x.id === pl.id);
      if (!p) return null;
      let marca = null;
      if (p.saiu) marca = h('small', { class: 'suave' }, 'saiu');
      else if (revelada && ganhos[p.id] > 0) marca = h('small', { class: 'quiz-ganho' }, `+${num(ganhos[p.id])}`);
      else if (!revelada && responderam.has(p.id)) marca = h('span', { class: 'quiz-respondeu', title: 'Já respondeu' }, icone('check'));
      else if (!p.conectado) marca = h('small', { class: 'quiz-caiu' }, 'caiu');
      return h('li', { class: `${p.id === euId ? 'eu-linha' : ''} ${p.saiu ? 'saiu' : ''} ${pl.time != null ? `time-t${pl.time}` : ''}`.replace(/\s+/g, ' ').trim() },
        h('span', { class: 'quiz-pos' }, n + 1),
        avatar(p.nome, 'avatar-p', p.foto),
        h('span', { class: 'quiz-nome' }, p.nome),
        marca,
        h('strong', null, num(pl.pontos)));
    })));
}

function resultado(s, { jogador, euId, souDono, acoes }) {
  const e = s.estado;
  const lista = e.placar.filter(pl => !pl.saiu).map(pl => ({ ...pl, p: s.jogadores.find(x => x.id === pl.id) })).filter(x => x.p);
  const minhaPos = lista.findIndex(x => x.id === euId);
  const podio = lista.slice(0, 3);
  let titulo = 'Fim do quiz!';
  let venci = jogador && minhaPos === 0;
  const r = e.resumo;
  if (r?.modo === 'equipe') {
    venci = r.vencedores.length > 0;
    titulo = venci ? `A equipe venceu! ${r.acertos} acertos (a meta era ${r.meta})` : `Faltou pouco: ${r.acertos} de ${r.meta} acertos`;
  } else if (r?.modo === 'times') {
    const meuTime = e.placar.find(pl => pl.id === euId)?.time;
    venci = r.time != null && meuTime === r.time;
    titulo = r.time == null ? `Empate: ${num(r.pontos[0])} a ${num(r.pontos[1])}`
      : `${NOMES_TIMES[r.time]} venceu: ${num(r.pontos[r.time])} a ${num(r.pontos[1 - r.time])}${jogador && meuTime != null ? (venci ? '. Vitória sua!' : '.') : ''}`;
  } else if (jogador && minhaPos === 0) titulo = lista.length > 1 ? 'Você venceu o quiz!' : 'Treino concluído!';
  else if (jogador && minhaPos > 0) titulo = `Você ficou em ${minhaPos + 1}º lugar`;
  else if (lista[0]) titulo = `${lista[0].p.nome} venceu o quiz!`;

  return h('div', { class: 'quiz-fim' },
    h('p', { class: `partida-status ${venci ? 'vitoria' : 'destaque'}` }, titulo),
    resumoModo(e),
    h('div', { class: 'quiz-podio' }, [1, 0, 2].map(i => podio[i] && h('div', { class: `degrau d${i + 1}` },
      i === 0 && h('span', { class: 'coroa' }, icone('coroa')),
      avatar(podio[i].p.nome, 'avatar-g', podio[i].p.foto),
      h('strong', null, podio[i].p.nome),
      h('small', null, `${num(podio[i].pontos)} pontos`),
      h('div', { class: 'degrau-base' }, `${i + 1}º`)))),
    h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela ranking' },
      h('thead', null, h('tr', null, h('th', { class: 'col-num' }, '#'), h('th', null, 'Morador'), h('th', { class: 'num' }, 'Acertos'), h('th', { class: 'num' }, 'Pontos'))),
      h('tbody', null, lista.map((x, n) => h('tr', { class: x.id === euId ? 'eu-linha' : '' },
        h('td', { class: 'col-num' }, n + 1),
        h('td', null, x.p.nome),
        h('td', { class: 'num' }, `${x.acertos} de ${e.total}`),
        h('td', { class: 'num' }, num(x.pontos))))))),
    h('div', { class: 'partida-rodape' },
      souDono && botao('Jogar de novo', { icone: 'frente', classe: 'btn-ouro', onclick: acoes.revanche }),
      jogador && !souDono && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outra rodada.'),
      h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')));
}

// Teclas A-D ou 1-4 respondem.
export function teclaQuiz(ev, s, responder) {
  if (!s?.grupo || s.status !== 'jogando' || s.estado?.fase !== 'pergunta' || s.eu < 0 || s.estado.minha != null) return;
  if (ev.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
  const tecla = ev.key.toUpperCase();
  const i = LETRAS.indexOf(tecla) >= 0 ? LETRAS.indexOf(tecla) : ['1', '2', '3', '4'].indexOf(tecla);
  if (i < 0) return;
  ev.preventDefault();
  responder(i);
}

/* ─── Cadastro de perguntas ───────────────────────── */

export async function perguntasQuiz() {
  if (!pode('recreacao.perguntas')) {
    const e = new Error('Sem acesso às perguntas do quiz.');
    e.status = 403;
    throw e;
  }
  const raiz = h('div', { class: 'pagina' });
  let dados = await get('/api/recreacao/perguntas');
  let filtro = '';
  let busca = '';

  const lista = h('div', { class: 'perguntas-lista' });
  const abas = h('nav', { class: 'abas abas-rolam' });
  const campoBusca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar pergunta ou resposta...', oninput: e => { busca = e.target.value; desenharLista(); } });

  async function recarregar() {
    dados = await get('/api/recreacao/perguntas');
    desenharAbas();
    desenharLista();
  }

  function desenharAbas() {
    const conta = c => dados.perguntas.filter(p => !c || p.categoria === c).length;
    trocar(abas, [['', 'Todas'], ...Object.entries(dados.categorias)].map(([k, nome]) =>
      h('button', { class: `aba ${filtro === k ? 'ativa' : ''}`.trim(), type: 'button', onclick: () => { filtro = k; desenharAbas(); desenharLista(); } },
        nome, h('span', { class: 'aba-n' }, conta(k)))));
  }

  function desenharLista() {
    const b = normalizar(busca.trim());
    const itens = dados.perguntas.filter(p => (!filtro || p.categoria === filtro)
      && (!b || normalizar([p.texto, ...p.alternativas].join(' ')).includes(b)));
    trocar(lista, itens.length
      ? itens.map(p => h('article', { class: 'pergunta-cartao' },
        h('div', { class: 'pergunta-cab' },
          h('span', { class: 'chip chip-ouro' }, dados.categorias[p.categoria]),
          h('span', { class: 'espaco' }),
          botaoIcone('editar', 'Editar pergunta', () => formPergunta(p)),
          botaoIcone('lixo', 'Apagar pergunta', async () => {
            if (!await confirmar(`Apagar a pergunta "${p.texto}"?`, { ok: 'Apagar', perigo: true })) return;
            if (await tentar(() => del(`/api/recreacao/perguntas/${p.id}`), 'Pergunta apagada.')) recarregar();
          }, 'perigo')),
        h('p', { class: 'pergunta-texto' }, p.texto),
        h('ol', { class: 'pergunta-alts' }, p.alternativas.map((a, i) => h('li', { class: i === p.correta ? 'certa' : '' },
          h('span', { class: 'quiz-letra' }, LETRAS[i]), h('span', null, a), i === p.correta && icone('check')))),
        p.criado_por_nome && h('small', { class: 'suave' }, `Criada por ${p.criado_por_nome}`)))
      : vazio('Nenhuma pergunta aqui', busca ? 'Nada encontrado com essa busca.' : 'Crie a primeira pergunta desta categoria.'));
  }

  function formPergunta(p = null) {
    const categoria = h('select', { class: 'input' }, Object.entries(dados.categorias).map(([k, nome]) =>
      h('option', { value: k, selected: (p?.categoria || filtro || 'luckham') === k }, nome)));
    const texto = h('textarea', { class: 'input', rows: '3', maxlength: '300', placeholder: 'Ex.: Qual é o lema da Casa Luckham?' }, p?.texto || '');
    let correta = p?.correta ?? 0;
    const entradas = LETRAS.map((l, i) => h('input', { class: 'input', maxlength: '120', value: p?.alternativas[i] || '', placeholder: `Alternativa ${l}` }));
    const linhas = LETRAS.map((l, i) => h('label', { class: 'alt-linha' },
      h('input', { type: 'radio', name: 'correta', checked: correta === i, onchange: () => { correta = i; }, 'aria-label': `A certa é a ${l}` }),
      h('span', { class: 'quiz-letra' }, l),
      entradas[i]));
    modalForm({
      titulo: p ? 'Editar pergunta' : 'Nova pergunta',
      tamanho: 'medio',
      conteudo: [
        campo('Categoria', categoria),
        campo('Pergunta', texto, { obrigatorio: true }),
        campo('Alternativas', h('div', { class: 'alt-grade' }, linhas), { ajuda: 'Marque a bolinha da alternativa certa. No jogo, a ordem das alternativas é embaralhada.' }),
      ],
      async aoEnviar() {
        const corpo = { categoria: categoria.value, texto: texto.value, alternativas: entradas.map(e => e.value), correta };
        if (p) await put(`/api/recreacao/perguntas/${p.id}`, corpo);
        else await post('/api/recreacao/perguntas', corpo);
        await recarregar();
      },
    });
  }

  desenharAbas();
  desenharLista();
  trocar(raiz,
    cabecalho({
      titulo: 'Perguntas do quiz', icone: 'pergunta', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Corrija, apague ou crie perguntas. Cada partida sorteia as perguntas das categorias escolhidas.',
      acoes: [botao('Nova pergunta', { icone: 'mais', classe: 'btn-ouro', onclick: () => formPergunta() })],
    }),
    abas,
    h('div', { class: 'ferramentas' }, h('label', { class: 'busca' }, icone('busca'), campoBusca)),
    lista);
  return raiz;
}
