// Juramento da Casa Luckham: o texto que se repete diante da bandeira para morar na Capital,
// e todos que já juraram (as pessoas registradas no Tabelionato: Moradores, Nobres e Outros).

import { h, trocar, icone, botao, cabecalho, avatar, get, aviso, pode, dataCurta, normalizar, estado } from '../core.js';
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

const tipoDoLivro = nome => (/nobre/i.test(nome) ? 'Nobre' : /outro/i.test(nome) ? 'Outros' : 'Morador');

export async function juramento() {
  const raiz = h('div', { class: 'pagina juramento-pagina' });
  const { pessoas } = await get('/api/juramento');
  const verRegistro = pode('tabelionato.ver');
  let busca = '';
  let filtro = 'todos';
  const lista = h('div', { class: 'juramento-lista' });
  const contagem = h('p', { class: 'juramento-contagem' });

  function desenharLista() {
    const escolhidos = pessoas
      .map((p, i) => ({ ...p, ordem: i + 1 }))
      .filter(p => filtro === 'todos' || tipoDoLivro(p.livro) === filtro)
      .filter(p => !busca || normalizar(`${p.nome} ${p.nick || ''}`).includes(busca));
    trocar(contagem, h('strong', null, pessoas.length), pessoas.length === 1 ? ' pessoa já deu a sua palavra à Casa Luckham.' : ' pessoas já deram a sua palavra à Casa Luckham.');
    trocar(lista, escolhidos.length
      ? escolhidos.map(p => {
        const cartao = [
          h('span', { class: 'juramento-ordem', title: 'Ordem do juramento' }, `nº ${p.ordem}`),
          avatar(p.nome, 'avatar-g', p.foto),
          h('strong', { class: 'juramento-nome' }, p.nome),
          p.nick && h('small', null, 'Endereço: ', h('span', { class: 'juramento-nick' }, p.nick)),
          h('span', { class: 'etiqueta' }, tipoDoLivro(p.livro)),
          p.desde && h('small', { class: 'juramento-data' }, icone('bandeira'), ` Jurou em ${dataCurta(p.desde)}`),
        ];
        return verRegistro
          ? h('a', { class: 'juramento-pessoa', href: `#/tabelionato/${p.livro_id}/registro/${p.registro_id}`, title: 'Ver o registro no Tabelionato' }, cartao)
          : h('div', { class: 'juramento-pessoa' }, cartao);
      })
      : h('p', { class: 'painel-vazio' }, pessoas.length ? 'Ninguém com esse nome.' : 'Ninguém registrado no Tabelionato ainda.'));
  }

  const contar = tipo => pessoas.filter(p => tipoDoLivro(p.livro) === tipo).length;
  const filtros = h('div', { class: 'segmentado' });
  const desenharFiltros = () => trocar(filtros, [['todos', 'Todos', pessoas.length], ['Morador', 'Moradores', contar('Morador')], ['Nobre', 'Nobres', contar('Nobre')], ['Outros', 'Outros', contar('Outros')]]
    .filter(([k, , n]) => k === 'todos' || n)
    .map(([k, nome, n]) => h('button', { type: 'button', class: `seg ${filtro === k ? 'ativo' : ''}`.trim(), onclick: () => { filtro = k; desenharFiltros(); desenharLista(); } }, `${nome} (${n})`)));
  desenharFiltros();

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
        pessoas.length > 0 && botao('Lista em .book', {
          icone: 'baixar', classe: 'btn-pequeno', titulo: 'Todos que juraram, num livro para o mod Scribble',
          onclick: () => livroDosJuramentados(pessoas, estado.eu.nome).baixar('Os que juraram'),
        })),
      contagem,
      h('div', { class: 'juramento-filtros' },
        filtros,
        h('input', { class: 'input', type: 'search', placeholder: 'Procurar pelo nome ou endereço...', oninput: e => { busca = normalizar(e.target.value.trim()); desenharLista(); } })),
      lista));
  desenharLista();
  return raiz;
}
