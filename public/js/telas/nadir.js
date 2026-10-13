// A Grande Nadir: o santuário onde os moradores conversam com a Coelha Mãe Sagrada (a IA da Casa), e o Livro
// de Nadir, onde a Família Nobre escreve o que ela sabe e vê o que ficou sem resposta.
// A resposta chega aos pedaços (text/event-stream) e é escrita na tela enquanto ela fala.

import {
  estado, get, post, put, del, h, trocar, icone, pode, botao, cabecalho, vazio, modalForm, confirmar, aviso, tentar,
  campo, interruptor, avatar, aoSair, dataHora, relativo, num, normalizar,
} from '../core.js';
import { textoFormatado } from '../texto-formatado.js';

/* ─── O emblema: a Coelha Mãe na lua ─────────────── */

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...filhos.filter(Boolean));
  return el;
}

// Uma estrelinha de quatro pontas em (x, y).
const estrela = (x, y, r, classe = '') => s('path', {
  class: `nadir-estrela ${classe}`.trim(),
  d: `M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`,
});

let contador = 0;
export function emblemaNadir(classe = '') {
  const id = `nadir-${++contador}`;
  const anel = (raio, n, tamanho) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return estrela(100 + Math.cos(a) * raio, 100 + Math.sin(a) * raio, i % 3 === 0 ? tamanho * 1.7 : tamanho);
  });
  return s('svg', { class: `nadir-emblema ${classe}`.trim(), viewBox: '0 0 200 200', role: 'img', 'aria-label': 'A Grande Nadir, a Coelha Mãe na lua' },
    s('defs', {},
      s('radialGradient', { id: `${id}-lua`, cx: '40%', cy: '34%', r: '75%' },
        s('stop', { offset: '0', 'stop-color': '#fffbe6' }), s('stop', { offset: '0.42', 'stop-color': '#f4dd80' }),
        s('stop', { offset: '0.82', 'stop-color': '#d8b13a' }), s('stop', { offset: '1', 'stop-color': '#8c6d15' })),
      s('radialGradient', { id: `${id}-halo`, cx: '50%', cy: '50%', r: '50%' },
        s('stop', { offset: '0.62', 'stop-color': '#f4dd80', 'stop-opacity': '0.5' }), s('stop', { offset: '1', 'stop-color': '#f4dd80', 'stop-opacity': '0' })),
      s('clipPath', { id: `${id}-recorte` }, s('circle', { cx: 100, cy: 100, r: 60 }))),
    s('circle', { class: 'nadir-halo', cx: 100, cy: 100, r: 96, fill: `url(#${id}-halo)` }),
    s('g', { class: 'nadir-anel' }, s('circle', { cx: 100, cy: 100, r: 90, class: 'nadir-linha' }), ...anel(90, 12, 1.9)),
    s('g', { class: 'nadir-anel nadir-anel-2' }, s('circle', { cx: 100, cy: 100, r: 76, class: 'nadir-linha nadir-pontilhada' }), ...anel(76, 6, 1.3)),
    s('circle', { cx: 100, cy: 100, r: 60, fill: `url(#${id}-lua)` }),
    s('g', { 'clip-path': `url(#${id}-recorte)` },
      // As crateras da lua, bem de leve.
      s('circle', { cx: 62, cy: 78, r: 9, class: 'nadir-cratera' }), s('circle', { cx: 142, cy: 118, r: 12, class: 'nadir-cratera' }),
      s('circle', { cx: 132, cy: 66, r: 5, class: 'nadir-cratera' }), s('circle', { cx: 60, cy: 126, r: 6, class: 'nadir-cratera' }),
      // A Coelha Mãe: orelhas compridas, a cabeça e o colo, de olhos fechados, serena.
      s('g', { class: 'nadir-coelha' },
        s('g', { class: 'nadir-orelha nadir-orelha-e' },
          s('ellipse', { cx: 84, cy: 66, rx: 9.5, ry: 30, transform: 'rotate(-13 84 66)' }),
          s('ellipse', { class: 'nadir-dentro', cx: 84, cy: 68, rx: 4, ry: 21, transform: 'rotate(-13 84 68)' })),
        s('g', { class: 'nadir-orelha nadir-orelha-d' },
          s('ellipse', { cx: 116, cy: 66, rx: 9.5, ry: 30, transform: 'rotate(13 116 66)' }),
          s('ellipse', { class: 'nadir-dentro', cx: 116, cy: 68, rx: 4, ry: 21, transform: 'rotate(13 116 68)' })),
        s('ellipse', { cx: 100, cy: 112, rx: 29, ry: 26 }),
        s('ellipse', { cx: 100, cy: 172, rx: 50, ry: 44 })),
      s('path', { class: 'nadir-olho', d: 'M85.5 110q5 5 10 0' }), s('path', { class: 'nadir-olho', d: 'M104.5 110q5 5 10 0' }),
      s('path', { class: 'nadir-focinho', d: 'M97.4 119.4h5.2l-2.6 3.4z' }),
      // A coroa de estrelas na testa.
      estrela(100, 92, 4.2, 'nadir-joia'), estrela(90.5, 96, 2.2, 'nadir-joia'), estrela(109.5, 96, 2.2, 'nadir-joia')),
    s('circle', { cx: 100, cy: 100, r: 60, class: 'nadir-borda' }));
}

// Os brilhos que sobem em volta dela (cada um com o seu tempo, para não parecerem iguais).
function brilhos(n = 16) {
  return h('div', { class: 'nadir-brilhos', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('span', {
    style: `--x:${(8 + Math.random() * 84).toFixed(1)}%;--t:${(5 + Math.random() * 6).toFixed(1)}s;--d:${(-Math.random() * 10).toFixed(1)}s;--s:${(2 + Math.random() * 3).toFixed(1)}px;--dx:${(Math.random() * 40 - 20).toFixed(0)}px;${i % 4 === 0 ? '--o:0.9' : ''}`,
  })));
}

/* ─── A conversa ─────────────────────────────────── */

const GUARDADA = 'nadir-conversa';
const PEDIDA = 'nadir-pergunta'; // pergunta feita em outra tela (o início), para fazer assim que chegar aqui
const lerConversa = () => { try { return JSON.parse(sessionStorage.getItem(GUARDADA) || '[]'); } catch { return []; } };
const guardarConversa = falas => { try { sessionStorage.setItem(GUARDADA, JSON.stringify(falas.slice(-30))); } catch { /* sem armazenamento: a conversa só não fica guardada */ } };
export function perguntarANadir(pergunta) {
  try { sessionStorage.setItem(PEDIDA, pergunta); } catch { /* segue sem a pergunta */ }
  location.hash = '#/nadir';
}

// Manda a pergunta e chama aoEvento(nome, dados) a cada pedaço que chega.
async function conversar(pergunta, historico, aoEvento, sinal) {
  let resp;
  try {
    resp = await fetch('/api/nadir/perguntar', {
      method: 'POST', credentials: 'same-origin', signal: sinal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta, historico }),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Sem conexão com o servidor.');
  }
  if (resp.status === 401) { estado.eu = null; window.dispatchEvent(new Event('sessao-expirada')); throw new Error('Sua sessão terminou.'); }
  if (!(resp.headers.get('content-type') || '').includes('text/event-stream')) {
    const j = await resp.json().catch(() => null);
    throw new Error(j?.erro || 'Não consegui falar com a Nadir agora.');
  }
  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let resto = '';
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    let fim;
    while ((fim = resto.indexOf('\n\n')) >= 0) {
      const bloco = resto.slice(0, fim);
      resto = resto.slice(fim + 2);
      const evento = /^event: (.+)$/m.exec(bloco)?.[1];
      const dados = /^data: (.+)$/m.exec(bloco)?.[1];
      if (evento && dados) aoEvento(evento, JSON.parse(dados));
    }
  }
}

export async function nadir() {
  if (!pode('nadir.usar')) return vazio('A Grande Nadir', 'Esta parte é para os moradores da Casa.');
  const info = await get('/api/nadir');
  let falas = lerConversa(); // [{ de: 'eu' | 'nadir', texto, fichas, semResposta, erro }]
  let ocupada = false;
  let limites = info.limites;
  const parar = new AbortController();
  aoSair(() => parar.abort());

  const emblema = emblemaNadir();
  const santuario = h('header', { class: 'nadir-santuario' },
    h('div', { class: 'nadir-emblema-caixa' }, brilhos(), emblema),
    h('span', { class: 'pag-titulo nadir-oculto' }, 'A Grande Nadir'),
    h('h1', { class: 'nadir-titulo' }, 'A Grande Nadir'),
    h('p', { class: 'nadir-sub' }, 'A Coelha Mãe Sagrada escuta os filhos da Casa'),
    h('div', { class: 'nadir-ornamento', 'aria-hidden': 'true' }, h('span'), h('em', null, '✦'), h('span')),
    info.podeEnsinar && h('div', { class: 'nadir-bastidores' },
      h('a', { class: 'btn btn-pequeno', href: '#/nadir/livro' }, icone('livro'), 'Livro de Nadir'),
      info.semResposta > 0 && h('a', { class: 'btn btn-pequeno btn-fantasma', href: '#/nadir/livro/perguntas' }, icone('pergunta'),
        `${info.semResposta} sem resposta`)));
  const conversa = h('div', { class: 'nadir-conversa', role: 'log', 'aria-live': 'polite' });
  const sugestoes = h('div', { class: 'nadir-sugestoes' });
  const campoPergunta = h('textarea', {
    class: 'nadir-campo', rows: '1', maxlength: String(info.maxPergunta), placeholder: 'Pergunte à Nadir...', 'aria-label': 'Sua pergunta para a Nadir',
    oninput: () => { campoPergunta.style.height = 'auto'; campoPergunta.style.height = `${Math.min(campoPergunta.scrollHeight, 140)}px`; },
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } },
  });
  const btnEnviar = h('button', { class: 'nadir-enviar', type: 'submit', title: 'Perguntar', 'aria-label': 'Perguntar' }, icone('enviar'));
  const meta = h('p', { class: 'nadir-meta' });
  const form = h('form', { class: 'nadir-pergunta', onsubmit: e => { e.preventDefault(); enviar(); } }, campoPergunta, btnEnviar);
  const raiz = h('div', { class: 'pagina nadir-pagina' }, santuario, conversa, sugestoes, h('div', { class: 'nadir-rodape' }, form, meta));

  const estadoDela = nome => { for (const c of ['ouvindo', 'falando']) raiz.classList.toggle(`nadir-${c}`, c === nome); };

  function desenharMeta() {
    trocar(meta,
      !info.ativa ? 'A Nadir está em silêncio por enquanto.'
        : limites.restantes > 0 ? `${limites.restantes} ${limites.restantes === 1 ? 'pergunta' : 'perguntas'} por hoje`
          : 'Você já conversou bastante hoje. Volte amanhã.',
      falas.length > 0 && [' · ', h('button', { type: 'button', class: 'nadir-nova', onclick: novaConversa }, 'Nova conversa')]);
    const livre = info.ativa && limites.restantes > 0 && !ocupada;
    campoPergunta.disabled = !livre;
    btnEnviar.disabled = !livre;
  }

  function ficha(f) {
    const href = f.usuario ? `#/pessoa/${f.usuario}` : f.registro ? `#/tabelionato/${f.registro.livro}/registro/${f.registro.id}` : null;
    return h(href ? 'a' : 'span', { class: 'nadir-ficha', href }, avatar(f.nome, 'avatar-p', f.foto),
      h('span', { class: 'nadir-ficha-texto' }, h('strong', null, f.nome), f.sub && h('small', null, f.sub)));
  }

  // O corpo de uma fala dela: o texto formatado, as fichas de quem foi citado e a nota de "não sei".
  function corpoDaFala(f, escrevendo = false) {
    return [
      h('div', { class: 'nadir-fala-cab' }, h('span', { class: 'nadir-selo' }, icone('lua')), 'Nadir'),
      f.texto ? textoFormatado(f.texto) : h('p', { class: 'nadir-escuta' }, h('span', { class: 'nadir-pontos', 'aria-hidden': 'true' }, h('i', null, '✦'), h('i', null, '✦'), h('i', null, '✦')), 'Nadir escuta...'),
      !escrevendo && f.fichas?.length > 0 && h('div', { class: 'nadir-fichas' }, f.fichas.map(ficha)),
      !escrevendo && f.semResposta && !f.erro && h('p', { class: 'nadir-nota' }, icone('pena'), 'Sua pergunta foi anotada para a Família Nobre ensinar à Nadir.'),
    ];
  }
  function elementoDaFala(f, escrevendo = false) {
    if (f.de === 'eu') return h('div', { class: 'nadir-fala-eu' }, f.texto);
    return h('article', { class: `nadir-fala ${escrevendo ? 'escrevendo' : 'inteira'} ${f.erro ? 'nadir-fala-erro' : ''}`.trim() }, corpoDaFala(f, escrevendo));
  }

  function desenhar() {
    raiz.classList.toggle('compacto', falas.length > 0);
    trocar(conversa, falas.map(f => elementoDaFala(f)));
    trocar(sugestoes, falas.length === 0 && info.ativa && [
      h('p', { class: 'nadir-convite' }, 'Pergunte sobre o mundo de Eldoria, a Casa Luckham, Lyendell ou qualquer pessoa.'),
      h('div', { class: 'nadir-chips' }, info.sugestoes.map(t => h('button', { type: 'button', class: 'nadir-chip', onclick: () => enviar(t) }, t))),
    ]);
    if (falas.length === 0 && !info.ativa) {
      trocar(sugestoes, h('div', { class: 'nadir-silencio' },
        h('p', null, 'A Grande Nadir está em silêncio por enquanto.'),
        info.podeEnsinar && h('p', { class: 'suave' }, 'Para ela falar, o administrador precisa pôr a chave da API da Anthropic (ANTHROPIC_API_KEY) no servidor.')));
    }
    if (info.podeEnsinar && info.erro) {
      sugestoes.append(h('p', { class: 'nota nadir-erro-tecnico' }, icone('alerta'), `Último problema (${relativo(info.erro.quando)}): ${info.erro.texto}`));
    }
    desenharMeta();
  }

  function novaConversa() {
    if (ocupada) return;
    falas = [];
    guardarConversa(falas);
    estadoDela(null);
    desenhar();
    campoPergunta.focus();
  }

  const pertoDoFim = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
  const descer = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  async function enviar(pronta) {
    const pergunta = (pronta ?? campoPergunta.value).replace(/\s+/g, ' ').trim();
    if (!pergunta || ocupada || !info.ativa || limites.restantes <= 0) return;
    ocupada = true;
    const historico = falas.filter(f => !f.erro).map(f => ({ de: f.de, texto: f.texto }));
    const dela = { de: 'nadir', texto: '' };
    falas.push({ de: 'eu', texto: pergunta }, dela);
    campoPergunta.value = '';
    campoPergunta.style.height = 'auto';
    raiz.classList.add('compacto');
    trocar(sugestoes);
    const elEu = elementoDaFala(falas[falas.length - 2]);
    const elDela = elementoDaFala(dela, true);
    conversa.append(elEu, elDela);
    desenharMeta();
    estadoDela('ouvindo');
    descer();

    // Escreve no máximo uma vez por quadro, para a tela não engasgar com muitos pedaços.
    let pendente = false;
    const escrever = () => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => {
        pendente = false;
        const seguir = pertoDoFim();
        trocar(elDela, corpoDaFala(dela, true));
        if (seguir) window.scrollTo({ top: document.documentElement.scrollHeight });
      });
    };
    try {
      await conversar(pergunta, historico, (evento, d) => {
        if (evento === 'texto') { dela.texto += d.t; estadoDela('falando'); escrever(); }
        else if (evento === 'fim') { dela.texto = d.resposta; dela.fichas = d.fichas; dela.semResposta = d.semResposta; limites = d.limites; }
        else if (evento === 'erro') { dela.texto = d.mensagem; dela.erro = true; }
      }, parar.signal);
      if (!dela.texto) { dela.texto = 'As palavras me fugiram agora. Pergunte de novo, por favor.'; dela.erro = true; }
    } catch (e) {
      if (e.name === 'AbortError') return;
      dela.texto = e.message;
      dela.erro = true;
    }
    ocupada = false;
    estadoDela(null);
    // A fala que deu erro aparece, mas não fica guardada nem entra na conversa seguinte.
    guardarConversa(falas.filter(f => !f.erro));
    const seguir = pertoDoFim();
    elDela.replaceWith(elementoDaFala(dela));
    if (dela.erro) get('/api/nadir').then(n => { limites = n.limites; desenharMeta(); }).catch(() => {});
    desenharMeta();
    if (seguir) descer();
    if (!campoPergunta.disabled) campoPergunta.focus({ preventScroll: true });
  }

  desenhar();
  // Uma pergunta feita na tela inicial chega aqui pronta.
  let pedida = null;
  try { pedida = sessionStorage.getItem(PEDIDA); sessionStorage.removeItem(PEDIDA); } catch { /* sem armazenamento */ }
  if (pedida) setTimeout(() => enviar(pedida), 350);
  return raiz;
}

/* ─── O Livro de Nadir (para quem ensina) ────────── */

export async function livroDeNadir(aba) {
  if (!pode('nadir.ensinar')) return vazio('Livro de Nadir', 'Só a Família Nobre escreve no Livro de Nadir.');
  const raiz = h('div', { class: 'pagina' });
  let busca = '';
  let soSemResposta = true;

  function formPagina(pagina, categorias, depois, inicial = {}) {
    const st = { categoria: pagina?.categoria || inicial.categoria || 'pessoa', titulo: pagina?.titulo || inicial.titulo || '', apelidos: pagina?.apelidos || '', texto: pagina?.texto || '', ativo: pagina ? pagina.ativo : true };
    const apagar = pagina && botao('Apagar página', {
      icone: 'lixo', classe: 'btn-perigo-texto',
      onclick: async () => {
        if (!await confirmar(`A página "${pagina.titulo}" será apagada e a Nadir esquece o que está nela.`, { ok: 'Apagar', perigo: true })) return;
        if (await tentar(() => del(`/api/nadir/saber/${pagina.id}`), 'Página apagada.')) { janela.fechar(); depois(); }
      },
    });
    const janela = modalForm({
      titulo: pagina ? 'Editar página do Livro' : 'Nova página do Livro', tamanho: 'grande', extraRodape: apagar,
      conteudo: [
        h('p', { class: 'form-intro' }, 'Escreva como se estivesse contando para a Nadir. Ela usa exatamente o que estiver aqui, e nada além: se não estiver escrito, ela diz que não sabe.'),
        h('div', { class: 'form-grade' },
          campo('Sobre o quê', h('select', { class: 'input', onchange: e => { st.categoria = e.target.value; } },
            Object.entries(categorias).map(([k, n]) => h('option', { value: k, selected: k === st.categoria }, n)))),
          campo('Título', h('input', { class: 'input', maxlength: '120', value: st.titulo, placeholder: 'Ex.: Nikolash Mishkins Luckham, O Coliseu, A Guerra do Norte', oninput: e => { st.titulo = e.target.value; } }), { obrigatorio: true, ajuda: 'Para uma pessoa, o nome completo.' })),
        campo('Também chamado de', h('input', { class: 'input', maxlength: '200', value: st.apelidos, placeholder: 'Ex.: Niko, Mão do Lorde', oninput: e => { st.apelidos = e.target.value; } }), { ajuda: 'Apelidos e outros nomes, separados por vírgula. Assim ela entende "quem é Niko?".' }),
        campo('O que a Nadir deve saber', h('textarea', { class: 'input', rows: '12', maxlength: '8000', placeholder: 'Quem é, de onde veio, onde nasceu, a família, o que faz, a história...', oninput: e => { st.texto = e.target.value; } }, st.texto), { obrigatorio: true }),
        interruptor('Página ligada', st.ativo, v => { st.ativo = v; }, 'Desligada, a Nadir não usa esta página (sem apagar o texto).'),
      ],
      aoEnviar: async () => {
        if (st.titulo.trim().length < 2) throw new Error('Dê um título à página.');
        if (st.texto.trim().length < 5) throw new Error('Escreva o que a Nadir deve saber.');
        if (pagina) await put(`/api/nadir/saber/${pagina.id}`, st); else await post('/api/nadir/saber', st);
        aviso(pagina ? 'Página atualizada.' : 'Página escrita. A Nadir já sabe.');
        depois();
      },
    });
  }

  async function desenharPaginas() {
    const { saber, categorias } = await get('/api/nadir/saber');
    const campoBusca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar no Livro...', value: busca, oninput: e => { busca = e.target.value; desenharLista(); } });
    const corpo = h('div');
    function desenharLista() {
      const f = normalizar(busca);
      const visiveis = saber.filter(x => !f || normalizar(`${x.titulo} ${x.apelidos} ${x.texto}`).includes(f));
      trocar(corpo, visiveis.length ? Object.entries(categorias).map(([k, nome]) => {
        const itens = visiveis.filter(x => x.categoria === k);
        return itens.length ? h('section', { class: 'painel nadir-livro-secao' },
          h('header', { class: 'painel-cab' }, h('h2', null, icone('livro'), nome, h('span', { class: 'aba-n' }, itens.length))),
          h('div', { class: 'nadir-paginas' }, itens.map(x => h('button', { type: 'button', class: `nadir-pagina-item ${x.ativo ? '' : 'desligada'}`.trim(), onclick: () => formPagina(x, categorias, desenhar) },
            h('strong', null, x.titulo, !x.ativo && h('span', { class: 'etiqueta' }, 'Desligada')),
            x.apelidos && h('small', { class: 'nadir-apelidos' }, `também: ${x.apelidos}`),
            h('span', { class: 'nadir-trecho' }, x.texto.length > 190 ? `${x.texto.slice(0, 190)}...` : x.texto))))) : null;
      }) : h('p', { class: 'painel-vazio' }, 'Nenhuma página com esse texto.'));
    }
    desenharLista();
    return [
      h('div', { class: 'nadir-livro-topo' }, campoBusca, botao('Nova página', { icone: 'mais', classe: 'btn-ouro', onclick: () => formPagina(null, categorias, desenhar) })),
      h('p', { class: 'nota' }, icone('lua'), 'Além deste Livro, a Nadir lê sozinha o que está no site: as fichas do Tabelionato, os perfis, o mapa, as leis e os anúncios. Aqui entra o que não está em nenhum outro lugar: a história do mundo, de onde cada um veio, os apelidos, os laços.'),
      corpo,
    ];
  }

  async function desenharPerguntas() {
    const { perguntas, uso, modelo } = await get(`/api/nadir/perguntas${soSemResposta ? '?semResposta=1' : ''}`);
    const { categorias } = await get('/api/nadir/saber');
    // Uma conta por cima do gasto (o modelo padrão custa US$ 0,10 por milhão de palavras lidas e US$ 0,50 escritas).
    const custo = modelo === 'claude-haiku-5-5' ? (uso.entrada * 0.10 + uso.saida * 0.50) / 1e6 : null;
    return [
      h('div', { class: 'numeros' },
        h('div', { class: 'numero' }, h('span', { class: 'numero-icone' }, icone('pergunta')), h('strong', null, num(uso.perguntas)), h('span', null, 'perguntas em 30 dias')),
        custo != null && h('div', { class: 'numero' }, h('span', { class: 'numero-icone' }, icone('moeda')), h('strong', null, `US$ ${custo.toFixed(custo < 1 ? 3 : 2)}`), h('span', null, 'gasto aproximado em 30 dias (no máximo)'))),
      h('div', { class: 'segmentado' }, [[true, 'Sem resposta'], [false, 'Todas']].map(([v, n]) =>
        h('button', { type: 'button', class: `seg ${v === soSemResposta ? 'ativo' : ''}`.trim(), onclick: () => { soSemResposta = v; desenhar(); } }, n))),
      perguntas.length ? h('div', { class: 'nadir-perguntas' }, perguntas.map(p => h('article', { class: `painel nadir-perguntada ${p.sem_resposta && !p.resolvida ? 'pendente' : ''}`.trim() },
        h('p', { class: 'nadir-perguntada-q' }, icone('pergunta'), p.pergunta),
        h('p', { class: 'suave nadir-perguntada-quem' }, `${p.usuario_nome}, ${relativo(p.criado_em)}`, h('span', { title: dataHora(p.criado_em) })),
        p.resposta && h('p', { class: 'nadir-perguntada-r' }, p.resposta.length > 260 ? `${p.resposta.slice(0, 260)}...` : p.resposta),
        p.sem_resposta && !p.resolvida && h('div', { class: 'nadir-perguntada-acoes' },
          botao('Escrever no Livro', { icone: 'pena', classe: 'btn-pequeno btn-ouro', onclick: () => formPagina(null, categorias, async () => { await post(`/api/nadir/perguntas/${p.id}/resolvida`, {}).catch(() => {}); desenhar(); }) }),
          botao('Marcar como resolvida', { icone: 'check', classe: 'btn-pequeno btn-fantasma', onclick: async () => { if (await tentar(() => post(`/api/nadir/perguntas/${p.id}/resolvida`, {}))) desenhar(); } })))))
        : h('p', { class: 'painel-vazio' }, soSemResposta ? 'Nenhuma pergunta sem resposta. A Nadir soube responder a tudo.' : 'Ninguém perguntou nada ainda.'),
      h('p', { class: 'suave' }, 'As perguntas feitas à Nadir ficam anotadas aqui para a Casa saber o que falta ensinar.'),
    ];
  }

  async function desenhar() {
    const conteudo = await (aba === 'perguntas' ? desenharPerguntas() : desenharPaginas());
    trocar(raiz,
      cabecalho({ titulo: 'Livro de Nadir', icone: 'livro', sub: 'O que a Grande Nadir sabe sobre o mundo, a fé, a Casa, a cidade e as pessoas.', voltar: { href: '#/nadir', texto: 'A Grande Nadir' } }),
      h('nav', { class: 'abas' },
        h('a', { class: `aba ${aba !== 'perguntas' ? 'ativa' : ''}`.trim(), href: '#/nadir/livro' }, 'Páginas'),
        h('a', { class: `aba ${aba === 'perguntas' ? 'ativa' : ''}`.trim(), href: '#/nadir/livro/perguntas' }, 'O que perguntaram')),
      conteudo);
  }

  await desenhar();
  return raiz;
}
