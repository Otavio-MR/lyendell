// Caixa de Pegadinhas: a página do Bobo da Corte (só quem tem o cargo vê).
// Escolhe a pegadinha, escolhe quem vai cair e pronto. Também joga confete em todo mundo e conta piadas na praça.

import { h, trocar, icone, botao, cabecalho, avatarPessoa, get, post, aviso, tentar, modal, pode, relativo, normalizar, aoSair, estado } from '../core.js';

const PARA_ALGUEM = ['torta', 'ponta', 'pum', 'nariz', 'coelhos'];
const REACOES = { riu: 'riu muito', vinganca: 'jurou vingança', aplaudiu: 'aplaudiu' };
const PIADAS = [
  'Sabe por que o coelho da Casa Luckham é o melhor vigia? Porque ele está sempre de orelha em pé!',
  'Qual é o rei dos queijos? O reiqueijão!',
  'O que o tomate foi fazer no banco? Tirar extrato!',
  'Por que o livro de matemática ficou triste? Porque tinha muitos problemas!',
  'O que é um pontinho verde no canto da sala? Uma ervilha de castigo!',
  'Por que a galinha atravessou a estrada? Para fugir do Ladrão de Galinhas!',
  'O que a vaca foi fazer no espaço? Procurar a Via Láctea!',
  'Por que o esqueleto não brigou com ninguém? Porque não tinha estômago para isso!',
  'Qual é o animal mais antigo do mundo? A zebra, porque é em preto e branco!',
  'Por que o cavaleiro levou uma escada para o baile? Porque disseram que a festa era de alto nível!',
  'O que o zero disse para o oito? Que cinto bonito!',
  'Por que o coelho atravessou o mapa de Lyendell? Porque a cenoura estava do outro lado!',
];

const minutos = ms => {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

export async function caixaDePegadinhas() {
  if (!pode('bobo.pegadinhas')) {
    const e = new Error('Só o Bobo da Corte abre a Caixa de Pegadinhas.');
    e.status = 403;
    throw e;
  }
  const raiz = h('div', { class: 'pagina bobo-pagina' });
  let d = await get('/api/bobo');
  let tipo = 'torta';
  let alvo = null;
  let busca = '';
  let carregadoEm = Date.now();
  const falta = chave => Math.max(0, (d.esperas[chave] || 0) - (Date.now() - carregadoEm));

  async function recarregar() {
    d = await get('/api/bobo');
    carregadoEm = Date.now();
    desenhar();
  }

  const listaPessoas = h('div', { class: 'bobo-pessoas' });
  const campoBusca = h('input', { class: 'input', type: 'search', placeholder: 'Procurar alguém...', oninput: e => { busca = normalizar(e.target.value); desenharPessoas(); } });
  const botaoPregar = botao('Pregar a peça!', { classe: 'btn-ouro btn-grande', icone: 'bobo' });
  const prontoEl = h('span');

  function desenharPessoas() {
    const lista = d.pessoas.filter(p => !busca || normalizar(p.nome).includes(busca))
      .sort((a, b) => (b.online - a.online) || a.nome.localeCompare(b.nome, 'pt-BR'));
    trocar(listaPessoas, lista.length ? lista.map(p => {
      const protegido = Math.max(0, p.protegidoPor - (Date.now() - carregadoEm));
      return h('button', {
        type: 'button', class: `bobo-pessoa ${alvo === p.id ? 'escolhida' : ''} ${protegido ? 'protegida' : ''}`.replace(/\s+/g, ' ').trim(), disabled: !!protegido,
        title: protegido ? `Caiu numa pegadinha há pouco. Livre de novo em ${minutos(protegido)}.` : p.online ? 'No site agora: cai na hora!' : 'Fora do site: cai quando entrar.',
        onclick: () => { alvo = p.id; desenharPessoas(); desenharBotao(); },
      }, avatarPessoa(p, 'avatar-p'), h('span', { class: 'bobo-pessoa-nome' }, p.nome),
      h('small', null, protegido ? `livre em ${minutos(protegido)}` : p.online ? 'no site' : 'fora'),
      p.online && !protegido && h('span', { class: 'ponto-online' }));
    }) : h('p', { class: 'painel-vazio' }, 'Ninguém com esse nome.'));
  }

  function desenharBotao() {
    const espera = falta('pegadinha');
    botaoPregar.disabled = !!espera || !alvo;
    trocar(prontoEl, espera ? `Próxima pegadinha em ${minutos(espera)}` : alvo ? '' : 'Escolha quem vai cair.');
  }

  botaoPregar.addEventListener('click', async () => {
    const pessoa = d.pessoas.find(p => p.id === alvo);
    if (!pessoa) return;
    botaoPregar.disabled = true;
    const r = await tentar(() => post('/api/bobo/pegadinha', { tipo, alvo }));
    if (r) {
      aviso(r.naHora ? `${pessoa.nome} caiu na pegadinha agora mesmo!` : `Pegadinha armada! ${pessoa.nome} cai quando entrar no site.`);
      alvo = null;
      await recarregar();
    } else desenharBotao();
  });

  // Piada na praça
  const campoPiada = h('textarea', { class: 'input', rows: '3', maxlength: '300', placeholder: 'Escreva a piada (ela aparece em destaque no chat da cidade)...' });
  const botaoPiada = botao('Contar na praça', { classe: 'btn-ouro', icone: 'megafone' });
  botaoPiada.addEventListener('click', async () => {
    const texto = campoPiada.value.trim();
    if (!texto) { aviso('Escreva a piada primeiro.', 'erro'); return; }
    botaoPiada.disabled = true;
    if (await tentar(() => post('/api/bobo/piada', { texto }), 'Piada contada! Todo mundo no chat viu.')) { campoPiada.value = ''; await recarregar(); } else botaoPiada.disabled = false;
  });

  const botaoConfete = botao('Jogar confete em todo mundo', { classe: 'btn-ouro', icone: 'confete' });
  botaoConfete.addEventListener('click', async () => {
    botaoConfete.disabled = true;
    if (await tentar(() => post('/api/bobo/pegadinha', { tipo: 'confete' }), 'Confete para todo mundo!')) await recarregar(); else botaoConfete.disabled = false;
  });

  function desenhar() {
    const t = Object.fromEntries(d.tipos.map(x => [x.chave, x]));
    const esperaConfete = falta('confete');
    const esperaPiada = falta('piada');
    botaoConfete.disabled = !!esperaConfete;
    botaoPiada.disabled = !!esperaPiada;
    desenharPessoas();
    desenharBotao();
    trocar(raiz,
      cabecalho({ titulo: 'Caixa de Pegadinhas', icone: 'bobo', sub: 'Coisas que só o Bobo da Corte pode fazer. Cada peça tem seu tempo: uma a cada 10 minutos, e quem caiu fica livre por 2 horas.' }),
      h('div', { class: 'bobo-relogios' },
        relogioDe('bobo', 'Pegadinha', falta('pegadinha')),
        relogioDe('confete', 'Confete', esperaConfete),
        relogioDe('megafone', 'Piada', esperaPiada)),
      h('div', { class: 'bobo-grade' },
        h('section', { class: 'painel bobo-armar' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('bobo'), '1. Escolha a pegadinha')),
          h('div', { class: 'bobo-tipos' }, PARA_ALGUEM.map(k => h('button', {
            type: 'button', class: `bobo-tipo ${tipo === k ? 'ativo' : ''}`.trim(), onclick: () => { tipo = k; desenhar(); },
          }, h('span', { class: 'bobo-tipo-icone' }, icone(t[k].icone)), h('strong', null, t[k].nome), h('small', null, t[k].texto)))),
          h('div', { class: 'painel-cab bobo-cab2' }, h('h2', null, icone('usuarios'), '2. Escolha quem vai cair')),
          campoBusca, listaPessoas,
          h('div', { class: 'bobo-acao' }, botaoPregar, h('p', { class: 'suave' }, prontoEl))),
        h('div', { class: 'bobo-lado' },
          h('section', { class: 'painel' },
            h('div', { class: 'painel-cab' }, h('h2', null, icone('confete'), 'Para todo mundo')),
            h('p', { class: 'suave' }, t.confete.texto),
            botaoConfete,
            esperaConfete > 0 && h('p', { class: 'suave' }, `Mais confete em ${minutos(esperaConfete)}.`)),
          h('section', { class: 'painel' },
            h('div', { class: 'painel-cab' }, h('h2', null, icone('megafone'), 'Piada na praça')),
            campoPiada,
            h('div', { class: 'bobo-piada-botoes' },
              botao('Me dá uma ideia', { icone: 'aleatorio', classe: 'btn-pequeno', onclick: () => { campoPiada.value = PIADAS[Math.floor(Math.random() * PIADAS.length)]; } }),
              botaoPiada),
            esperaPiada > 0 && h('p', { class: 'suave' }, `A plateia ainda está rindo. Próxima piada em ${minutos(esperaPiada)}.`)),
          mural(d.historico, t))));
  }

  // Os relógios andam sozinhos (sem precisar recarregar a página).
  const intervalo = setInterval(() => {
    if (!raiz.isConnected) return;
    for (const el of raiz.querySelectorAll('[data-chave]')) {
      const f = falta(el.dataset.chave);
      el.classList.toggle('pronto', !f);
      el.querySelector('strong').textContent = f ? minutos(f) : 'pronta!';
    }
    if (!falta('pegadinha') && prontoEl.textContent.startsWith('Próxima')) desenharBotao();
  }, 5000);
  aoSair(() => clearInterval(intervalo));

  desenhar();
  return raiz;
}

function relogioDe(ic, nome, falta) {
  const chave = { bobo: 'pegadinha', confete: 'confete', megafone: 'piada' }[ic];
  return h('div', { class: `bobo-relogio ${falta ? '' : 'pronto'}`.trim(), 'data-chave': chave }, icone(ic), h('span', null, nome), h('strong', null, falta ? minutos(falta) : 'pronta!'));
}

function mural(historico, t) {
  return h('section', { class: 'painel' },
    h('div', { class: 'painel-cab' }, h('h2', null, icone('pergaminho'), 'Mural das pegadinhas')),
    historico.recentes.length
      ? h('ol', { class: 'bobo-mural' }, historico.recentes.slice(0, 12).map(p => h('li', null,
        icone(t[p.tipo]?.icone || 'bobo'),
        h('span', null, h('strong', null, p.de_nome), p.alvo_nome ? ` pregou "${t[p.tipo]?.nome || p.tipo}" em ` : ` jogou ${(t[p.tipo]?.nome || p.tipo).toLowerCase()} em todo mundo`, p.alvo_nome && h('strong', null, p.alvo_nome),
          p.reacao && h('em', null, ` (${p.alvo_nome} ${REACOES[p.reacao] || p.reacao})`)),
        h('time', null, relativo(p.criado_em)))))
      : h('p', { class: 'painel-vazio' }, 'Nenhuma pegadinha ainda. A corte está quieta demais...'),
    historico.vitimas.length > 0 && h('div', { class: 'bobo-vitimas' },
      h('h3', null, 'Quem mais caiu'),
      h('ol', { class: 'mini-ranking' }, historico.vitimas.map(v => h('li', null, h('span', null, v.nome), h('strong', null, v.n))))));
}

// No perfil de alguém: o Bobo escolhe a pegadinha ali mesmo.
export function botaoPegadinha(pessoa) {
  if (!pode('bobo.pegadinhas') || pessoa.id === estado.eu.id) return null;
  return botao('Pregar uma peça', {
    icone: 'bobo', classe: 'btn-bobo',
    onclick: async () => {
      let d;
      try { d = await get('/api/bobo'); } catch (e) { aviso(e.message, 'erro'); return; }
      const t = Object.fromEntries(d.tipos.map(x => [x.chave, x]));
      const alvo = d.pessoas.find(p => p.id === pessoa.id);
      const espera = d.esperas.pegadinha;
      const m = modal({
        titulo: `Pregar uma peça em ${pessoa.nome}`,
        corpo: espera ? h('p', null, `Calma, Bobo! A próxima pegadinha fica pronta em ${minutos(espera)}.`)
          : alvo?.protegidoPor ? h('p', null, `${pessoa.nome} caiu numa pegadinha há pouco. Livre de novo em ${minutos(alvo.protegidoPor)}.`)
            : h('div', { class: 'bobo-tipos' }, PARA_ALGUEM.map(k => h('button', {
              type: 'button', class: 'bobo-tipo',
              onclick: async () => {
                const r = await tentar(() => post('/api/bobo/pegadinha', { tipo: k, alvo: pessoa.id }));
                if (!r) return;
                m.fechar();
                aviso(r.naHora ? `${pessoa.nome} caiu na pegadinha agora mesmo!` : `Pegadinha armada! ${pessoa.nome} cai quando entrar no site.`);
              },
            }, h('span', { class: 'bobo-tipo-icone' }, icone(t[k].icone)), h('strong', null, t[k].nome), h('small', null, t[k].texto)))),
        rodape: [h('a', { class: 'btn', href: '#/bobo', onclick: () => m.fechar() }, 'Abrir a Caixa de Pegadinhas')],
      });
    },
  });
}
