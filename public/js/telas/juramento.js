// Juramento da Casa Luckham: o texto que se repete diante da bandeira para morar na Capital,
// e todos que já juraram. Só Moradores e Nobres juram (quem está em Outros é de outra casa ou presta
// serviço à Capital). Quem tem registro conta como quem já jurou; a Família Nobre e a Tabeliã cuidam da
// lista numa telinha própria: colocam pelo nome (puxado do Tabelionato) e retiram.

import { h, trocar, icone, botao, cabecalho, avatar, get, put, aviso, tentar, modal, pode, dataCurta, normalizar, estado } from '../core.js';
import { livroDoJuramento, livroDosJuramentados } from '../livro-mc.js';

export const JURAMENTO = {
  titulo: 'Juramento da Casa Luckham',
  intro: 'Para se tornar um morador da Capital, você deve fazer um juramento de honra e servidão à Casa Luckham, dando assim a sua palavra e força de vontade aos Luckham, fazendo que carregue o símbolo com orgulho e bravura.',
  chamada: 'Repita as seguintes palavras em frente à bandeira:',
  linhas: [
    'Eu, por minha própria vontade, diante de todos aqui presentes, juro minha lealdade à Casa Luckham.',
    'Eu me comprometo a honrar seu nome, respeitar seus membros e defender seus interesses.',
    'Juro permanecer leal nos tempos de paz e firme nos tempos de conflito.',
    'Não trairei aqueles que depositarem sua confiança em mim, nem abandonarei a Casa enquanto meu juramento permanecer de pé.',
    'A partir deste momento, minha palavra está dada e minha lealdade, oferecida.',
  ],
  fecho: 'Pela honra. Pela lealdade. Pela Casa Luckham.',
};

// O juramento inteiro em texto (para copiar e colar no chat do jogo ou no Discord).
const textoCorrido = () => [
  `**${JURAMENTO.titulo.toUpperCase()}**`, '', `*${JURAMENTO.intro}*`, '', `**${JURAMENTO.chamada.toUpperCase()}**`, '',
  `"${[...JURAMENTO.linhas, JURAMENTO.fecho].join('\n\n')}"`,
].join('\n');

const tipoDoLivro = nome => (/nobre/i.test(nome) ? 'Nobre' : 'Morador');

export async function juramento() {
  const raiz = h('div', { class: 'pagina juramento-pagina' });
  let d = await get('/api/juramento');
  const verRegistro = pode('tabelionato.ver');
  let busca = '';
  let filtro = 'todos';
  const lista = h('div', { class: 'juramento-lista' });
  const contagem = h('p', { class: 'juramento-contagem' });
  const filtros = h('div', { class: 'segmentado' });

  async function recarregar() {
    d = await get('/api/juramento');
    desenharTudo();
  }

  const filtrar = lista => lista
    .filter(p => filtro === 'todos' || tipoDoLivro(p.livro) === filtro)
    .filter(p => !busca || normalizar(`${p.nome} ${p.nick || ''}`).includes(busca));

  function cartao(p, ordem) {
    const nome = h('strong', { class: 'juramento-nome' }, p.nome);
    return h('div', { class: 'juramento-pessoa' },
      h('span', { class: 'juramento-ordem', title: 'Ordem do juramento' }, `nº ${ordem}`),
      avatar(p.nome, 'avatar-g', p.foto),
      verRegistro ? h('a', { href: `#/tabelionato/${p.livro_id}/registro/${p.registro_id}`, title: 'Ver o registro no Tabelionato' }, nome) : nome,
      p.nick && h('small', null, 'Endereço: ', h('span', { class: 'juramento-nick' }, p.nick)),
      h('span', { class: 'etiqueta' }, tipoDoLivro(p.livro)),
      p.desde && h('small', { class: 'juramento-data' }, icone('bandeira'), ` Jurou em ${dataCurta(p.desde)}`));
  }

  function desenharLista() {
    const juraram = d.juraram.map((p, i) => ({ ...p, ordem: i + 1 }));
    const escolhidos = filtrar(juraram);
    trocar(contagem, h('strong', null, juraram.length), juraram.length === 1 ? ' pessoa já deu a sua palavra à Casa Luckham.' : ' pessoas já deram a sua palavra à Casa Luckham.');
    trocar(lista, escolhidos.length
      ? escolhidos.map(p => cartao(p, p.ordem))
      : h('p', { class: 'painel-vazio' }, juraram.length ? 'Ninguém com esse nome.' : 'Ninguém fez o juramento ainda.'));
  }

  // A telinha da Família Nobre e da Tabeliã: colocar na lista pelo nome do Tabelionato e retirar.
  function gerenciar() {
    let procura = '';
    const sugestoes = h('div', { class: 'jura-sugestoes' });
    const tabela = h('tbody');
    const titulo = h('span');
    const campo = h('input', {
      class: 'input', type: 'search', placeholder: 'Digite o nome ou o endereço (Moradores e Nobres do Tabelionato)...',
      oninput: e => { procura = normalizar(e.target.value.trim()); desenharSugestoes(); },
    });

    async function mudar(p, jurou) {
      const ok = await tentar(() => put(`/api/juramento/${p.registro_id}`, { jurou }),
        jurou ? `${p.nome} foi colocado na lista.` : `${p.nome} foi retirado da lista.`);
      if (!ok) return;
      await recarregar();
      desenharSugestoes();
      desenharTabela();
    }

    function desenharSugestoes() {
      const fora = d.naoJuraram;
      if (!fora.length) {
        trocar(sugestoes, h('p', { class: 'suave' }, 'Todos os Moradores e Nobres registrados já estão na lista.'));
        return;
      }
      const achados = fora.filter(p => !procura || normalizar(`${p.nome} ${p.nick || ''}`).includes(procura)).slice(0, 12);
      trocar(sugestoes, achados.length
        ? achados.map(p => h('button', { type: 'button', class: 'jura-sugestao', onclick: () => mudar(p, true) },
          avatar(p.nome, 'avatar-p', p.foto),
          h('span', null, h('strong', null, p.nome), h('small', null, [tipoDoLivro(p.livro), p.nick && `Endereço: ${p.nick}`].filter(Boolean).join(' · '))),
          h('span', { class: 'jura-colocar' }, icone('mais'), 'Colocar')))
        : h('p', { class: 'suave' }, 'Ninguém fora da lista com esse nome.'));
    }

    function desenharTabela() {
      titulo.textContent = `Na lista (${d.juraram.length})`;
      trocar(tabela, d.juraram.length
        ? d.juraram.map((p, i) => h('tr', null,
          h('td', { class: 'jura-num' }, i + 1),
          h('td', null, h('strong', null, p.nome)),
          h('td', null, p.nick || ''),
          h('td', null, tipoDoLivro(p.livro)),
          h('td', null, p.desde ? dataCurta(p.desde) : ''),
          h('td', { class: 'jura-acao' }, botao('Retirar', { icone: 'x', classe: 'btn-pequeno btn-perigo-texto', onclick: () => mudar(p, false) }))))
        : h('tr', null, h('td', { colspan: '6', class: 'painel-vazio' }, 'Ninguém na lista.')));
    }

    desenharSugestoes();
    desenharTabela();
    modal({
      titulo: 'Quem fez o juramento', tamanho: 'grande',
      corpo: h('div', { class: 'jura-gerenciar' },
        h('p', { class: 'suave' }, 'Quem tem registro de Morador ou de Nobre já entra na lista. Retire quem ainda não jurou, e coloque de volta quando jurar.'),
        h('section', null,
          h('h3', null, icone('mais'), 'Colocar na lista'),
          campo, sugestoes),
        h('section', null,
          h('h3', null, icone('usuarios'), titulo),
          h('div', { class: 'jura-tabela-caixa' },
            h('table', { class: 'jura-tabela' },
              h('thead', null, h('tr', null, h('th', null, 'nº'), h('th', null, 'Nome'), h('th', null, 'Endereço'), h('th', null, 'Registro'), h('th', null, 'Jurou em'), h('th', null, ''))),
              tabela)))),
    });
    setTimeout(() => campo.focus(), 50);
  }

  const contar = tipo => d.juraram.filter(p => tipoDoLivro(p.livro) === tipo).length;
  const desenharFiltros = () => trocar(filtros, [['todos', 'Todos', d.juraram.length], ['Morador', 'Moradores', contar('Morador')], ['Nobre', 'Nobres', contar('Nobre')]]
    .map(([k, nome, n]) => h('button', { type: 'button', class: `seg ${filtro === k ? 'ativo' : ''}`.trim(), onclick: () => { filtro = k; desenharTudo(); } }, `${nome} (${n})`)));
  const desenharTudo = () => { desenharFiltros(); desenharLista(); };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCorrido());
      aviso('Juramento copiado. É só colar no chat!');
    } catch {
      aviso('Não consegui copiar. Selecione o texto e copie à mão.', 'erro');
    }
  };

  trocar(raiz,
    cabecalho({
      titulo: JURAMENTO.titulo, icone: 'bandeira', sub: 'Quem quer morar na Capital jura lealdade à Casa diante da bandeira.',
      acoes: [
        botao('Copiar', { icone: 'pergaminho', titulo: 'Copia o juramento para colar no chat do jogo ou no Discord', onclick: copiar }),
        botao('Baixar .book', { icone: 'baixar', classe: 'btn-ouro', titulo: 'O juramento como livro para o mod Scribble', onclick: () => livroDoJuramento(JURAMENTO, estado.eu.nome).baixar('Juramento da Casa Luckham') }),
      ],
    }),
    h('article', { class: 'juramento-pergaminho' },
      h('img', { class: 'juramento-brasao', src: '/img/brasao.png', alt: 'Brasão da Casa Luckham' }),
      h('p', { class: 'juramento-intro' }, JURAMENTO.intro),
      h('h2', { class: 'juramento-chamada' }, JURAMENTO.chamada),
      h('blockquote', { class: 'juramento-texto' },
        JURAMENTO.linhas.map(l => h('p', null, l)),
        h('p', { class: 'juramento-fecho' }, JURAMENTO.fecho))),
    h('section', { class: 'painel juramento-juraram' },
      h('div', { class: 'painel-cab' },
        h('h2', null, icone('usuarios'), 'Os que juraram'),
        h('div', { class: 'juramento-botoes' },
          d.podeMarcar && botao('Colocar ou retirar', { icone: 'editar', classe: 'btn-pequeno btn-ouro', titulo: 'Quem fez o juramento (Família Nobre e Tabeliã)', onclick: gerenciar }),
          botao('Lista em .book', {
            icone: 'baixar', classe: 'btn-pequeno', titulo: 'Todos que juraram, num livro para o mod Scribble',
            onclick: () => livroDosJuramentados(d.juraram, estado.eu.nome).baixar('Os que juraram'),
          }))),
      contagem,
      h('div', { class: 'juramento-filtros' },
        filtros,
        h('input', { class: 'input', type: 'search', placeholder: 'Procurar pelo nome ou endereço...', oninput: e => { busca = normalizar(e.target.value.trim()); desenharLista(); } })),
      lista));
  desenharTudo();
  return raiz;
}
