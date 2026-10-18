import { ehLivroDeCartaz, dadosDoCartaz, desenharCartaz, baixarCartaz } from '../cartaz.js';
import {
  estado, get, post, put, del, h, trocar, icone, pode, ehCrianca, cabecalho, vazio, botao, botaoIcone, modal, modalForm, confirmar,
  aviso, tentar, campo, interruptor, enviarImagem, dataHora, dataCurta, num, normalizar, ErroApi,
  textoDuracao, listaDeNomes, relativo, chipAliados, ehMorador,
} from '../core.js';
import { livroDeRegistro, livroDeRegistros, livroDeMoradores, documentoDeIdentidade, modeloDePessoas } from '../livro-mc.js';
import { verPagamentos, resumoCobranca } from './pagamentos.js';
import { nomeInfantil } from '../crianca.js';
import { almofadaDeAssinatura, desenharAssinatura, lerAssinatura, corpoDaAssinatura, lerUltimaAssinatura, guardarUltimaAssinatura } from '../assinatura.js';

// Para os Aliados (convidados de outras casas): só os livros abertos para Convidados e Aliados aparecem.
const notaAliado = m => !pode(`${m}.ver`) && pode('aliados.ver') && h('p', { class: 'nota' }, icone('alianca'),
  h('span', null, 'Aqui aparecem só os livros abertos para Convidados e Aliados.'));

// Para a criança: os livros são dos grandes; dá para olhar, mas não pode rabiscar.
const notaCrianca = () => ehCrianca() && h('p', { class: 'nota nota-crianca' }, icone('coelho'),
  h('span', null, 'Esses livros são dos grandes. Dá para olhar tudinho, mas não pode rabiscar!'));

// Tabelionato, Guarda do Coelho, Hospital e Congresso usam a mesma tela: livros com formulários configuráveis.
// "no" é como o nome entra numa frase ("aguarda a sua aprovação no Hospital"); "enviam" dá o exemplo de quem envia.
export const MODULOS = {
  tabelionato: {
    titulo: 'Tabelionato', icone: 'pergaminho', no: 'no Tabelionato', enviam: 'Escribas',
    sub: 'Os livros oficiais de Lyendell: moradores, nobreza, comércio, documentos, casamentos e propriedades.',
    quemComanda: 'a Tabeliã',
    aprovador: 'da Tabeliã',
  },
  guarda: {
    titulo: 'Guarda do Coelho', icone: 'escudo', no: 'na Guarda do Coelho', enviam: 'Guardas',
    sub: 'Prisioneiros, efetivo da guarda e procurados da capital.',
    quemComanda: 'o Comandante da Guarda',
    aprovador: 'do Comandante da Guarda',
  },
  hospital: {
    titulo: 'Hospital', icone: 'cruz', no: 'no Hospital', enviam: 'Médicos',
    sub: 'Os pacientes atendidos no hospital da capital e a equipe que cuida deles.',
    quemComanda: 'o Diretor do Hospital',
    aprovador: 'do Diretor do Hospital',
  },
  congresso: {
    titulo: 'Congresso', icone: 'coluna', no: 'no Congresso', enviam: 'a Família Nobre',
    sub: 'PECs, leis e regras votadas no Congresso, publicadas pela nossa Senadora.',
    quemComanda: 'a Senadora',
    aprovador: 'da Senadora',
  },
  leis: {
    titulo: 'Leis de Lyendell', icone: 'balanca', no: 'nas Leis de Lyendell', enviam: 'outros cargos',
    sub: 'Onde o Lorde Comandante e a Família Nobre escrevem as leis. Os moradores leem tudo arrumado em "Ler as leis".',
    quemComanda: 'o Lorde Comandante e a Família Nobre',
    aprovador: 'do Lorde Comandante ou da Família Nobre',
  },
};

// Onde começa o módulo. As Leis de Lyendell começam na leitura (todo morador); os livros ficam em /leis/livros.
export const inicioDoModulo = m => (m === 'leis' ? '#/leis/livros' : `#/${m}`);

const ICONES_LIVRO = ['livro', 'casa', 'coroa', 'loja', 'documento', 'alianca', 'chave', 'escudo', 'grades', 'alvo',
  'pergaminho', 'balanca', 'mapa', 'moeda', 'espada', 'pena', 'bandeira', 'bau', 'usuarios', 'cruz', 'coluna'];

const TIPOS = [
  ['texto', 'Texto curto'], ['texto_longo', 'Texto longo'], ['numero', 'Número'], ['data', 'Data'],
  ['selecao', 'Lista de opções'], ['sim_nao', 'Sim ou não'], ['imagem', 'Imagem'],
  ['referencia', 'Escolher de outro livro'], ['duracao', 'Tempo entre duas datas'],
];

const idLocal = () => 'c' + Math.random().toString(36).slice(2, 10);
// Número do registro dentro do livro (1, 2, 3...). Registro que ainda aguarda aprovação não tem número.
const numeroDe = r => (r.numero ? String(r.numero) : '');

function tituloDe(l, dados) {
  const c = l.campos.find(x => (x.tipo === 'texto' || x.tipo === 'selecao') && dados[x.id]);
  return c ? String(dados[c.id]) : 'Registro sem título';
}

// Campos calculados (tempo entre datas) não têm valor guardado: saem dos outros campos do registro.
const temValor = (c, dados) => (c.tipo === 'duracao' ? !!textoDuracao(c, dados) : dados[c.id] != null && dados[c.id] !== '');

function valorCurto(c, v, dados) {
  if (c.tipo === 'duracao') return textoDuracao(c, dados);
  if (v == null || v === '') return '';
  switch (c.tipo) {
    case 'data': return dataCurta(v);
    case 'sim_nao': return v ? 'Sim' : 'Não';
    case 'numero': return num(v);
    case 'selecao': return h('span', { class: 'etiqueta' }, v);
    case 'referencia': return listaDeNomes(v).join(', ');
    case 'imagem': return h('img', { class: 'miniatura', src: v, alt: '', loading: 'lazy' });
    case 'texto_longo': return v.length > 80 ? `${v.slice(0, 80)}…` : v;
    default: return String(v);
  }
}

function valorCompleto(c, v, dados) {
  switch (c.tipo) {
    case 'imagem': return h('a', { class: 'doc-foto', href: v, target: '_blank', rel: 'noopener', title: 'Abrir a imagem inteira' }, h('img', { class: 'doc-imagem', src: v, alt: c.nome }));
    case 'texto_longo': return h('div', { class: 'texto-livre' }, v);
    case 'selecao': return String(v);
    default: return valorCurto(c, v, dados);
  }
}

/* ─── Lista de livros de um módulo ────────────────── */

export async function modulo(m) {
  const info = MODULOS[m];
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const { livros, contagem } = await get(`/api/modulos/${m}/livros`);
    const configurar = pode(`${m}.configurar`);
    trocar(raiz, 
      cabecalho({
        titulo: info.titulo, sub: info.sub, icone: info.icone,
        acoes: [m === 'leis' && h('a', { class: 'btn', href: '#/leis' }, icone('olho'), h('span', null, 'Ler as leis')), configurar && botao('Novo livro', {
          icone: 'mais', classe: 'btn-ouro',
          onclick: () => configurarLivro(m, null, id => { location.hash = `#/${m}/${id}`; }),
        })],
      }),
      abasModulo(m, '', contagem),
      notaCrianca(),
      notaAliado(m),
      livros.length
        ? h('div', { class: 'grade-livros' }, livros.map(l => cartaoLivro(m, l)))
        : vazio('Nenhum livro ainda', configurar ? 'Crie o primeiro livro de registros.' : 'Quando houver livros, eles aparecem aqui.'));
  }

  await desenhar();
  return raiz;
}

function cartaoLivro(m, l) {
  return h('a', { class: 'livro-card', href: `#/${m}/${l.id}` },
    h('span', { class: 'livro-icone' }, icone(l.icone)),
    h('div', { class: 'livro-info' }, h('h3', null, ehCrianca() ? nomeInfantil(l.nome) : l.nome), l.descricao && h('p', null, l.descricao)),
    h('div', { class: 'livro-rodape' },
      h('span', null, h('strong', null, num(l.total)), l.total === 1 ? ' registro' : ' registros'),
      l.pendentes > 0 && h('span', { class: 'etiqueta etiqueta-ouro', title: 'Registros aguardando a sua aprovação' }, icone('relogio'), `${l.pendentes} aguardando`),
      l.atrasados > 0 && h('span', { class: 'etiqueta pg-atrasado', title: 'Registros com pagamento atrasado' }, icone('alerta'), `${l.atrasados} com pagamento atrasado`),
      !l.aberto && h('span', { class: 'etiqueta', title: 'Só quem comanda o módulo registra aqui' }, icone('cadeado'), 'Restrito'),
      l.aliados && ehMorador() && chipAliados()));
}

// No Tabelionato, o que o administrador registra é aprovado pela Tabeliã (nem ele aprova o próprio registro).
const soATabeliaAprova = (m, r) => m === 'tabelionato' && estado.eu.is_root && r.criado_por === estado.eu.id;

/* ─── Abas do módulo: livros, aprovação e meus envios ─ */

export function abasModulo(m, atual, contagem = {}) {
  const abas = [['', 'Livros', null]];
  // Congresso: as propostas do povo (o número é o que espera a Senadora, para ela, ou o que está na pauta).
  // (Os Aliados, convidados de outras casas, não entram nas propostas: são do povo de Lyendell.)
  if (m === 'congresso' && pode('congresso.ver')) abas.push(['propostas', 'Propostas do povo', contagem.propostas || 0]);
  if (pode(`${m}.aprovar`)) abas.push(['aprovacoes', 'Aguardando aprovação', contagem.aprovacoes || 0]);
  if (contagem.envios || (pode(`${m}.registrar`) && !pode(`${m}.aprovar`))) abas.push(['envios', 'Meus envios', contagem.envios || 0]);
  if (abas.length < 2) return null;
  return h('nav', { class: 'abas', 'aria-label': 'Seções do módulo' }, abas.map(([k, nome, n]) =>
    h('a', { class: `aba ${atual === k ? 'ativa' : ''}`.trim(), href: k ? `#/${m}/${k}` : inicioDoModulo(m) },
      nome, n != null && h('span', { class: `aba-n ${(k === 'aprovacoes' || (k === 'propostas' && pode('congresso.aprovar'))) && n ? 'aba-alerta' : ''}`.trim() }, n))));
}

export const aprovacoes = m => filaModulo(m, 'aprovacoes');
export const envios = m => filaModulo(m, 'envios');

async function filaModulo(m, modo) {
  const info = MODULOS[m];
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const { registros, livros, permissoes, contagem } = await get(`/api/modulos/${m}/${modo}`);
    // Em "Meus envios", os recusados vêm primeiro: são os que precisam de atenção.
    const lista = modo === 'envios'
      ? [...registros].sort((a, b) => (b.situacao === 'recusado') - (a.situacao === 'recusado') || b.id - a.id)
      : registros;
    trocar(raiz,
      cabecalho({ titulo: info.titulo, sub: info.sub, icone: info.icone }),
      abasModulo(m, modo, contagem),
      h('p', { class: 'fila-intro' }, modo === 'aprovacoes'
        ? `Registros enviados por quem não aprova (ex.: ${info.enviam}). Eles só entram no livro oficial depois de aprovados.`
        : `Seus registros que ainda não entraram no livro oficial. Eles aguardam a aprovação ${info.aprovador}; os recusados podem ser corrigidos e reenviados.`),
      lista.length
        ? h('div', { class: 'fila' }, lista.map(r => cartaoPendente(m, r, livros[r.livro_id], permissoes, desenhar, modo)))
        : vazio(modo === 'aprovacoes' ? 'Nada aguardando aprovação' : 'Nenhum envio pendente',
          modo === 'aprovacoes' ? 'Quando alguém enviar um registro, ele aparece aqui.' : 'Tudo o que você enviou já foi aprovado.'));
  }

  await desenhar();
  return raiz;
}

function cartaoPendente(m, r, l, permissoes, recarregar, modo) {
  const d = { livro: l, permissoes: { ...permissoes, configurar: false, pagamentos: false } };
  const titulo = tituloDe(l, r.dados);
  const recusado = r.situacao === 'recusado';
  const meuEnvio = r.criado_por === estado.eu.id;
  const campos = l.campos.filter(c => c.tipo !== 'secao' && c.tipo !== 'imagem' && temValor(c, r.dados)).slice(0, 8);
  return h('article', { class: `pendente ${r.situacao}` },
    h('header', { class: 'pendente-cab' },
      h('span', { class: 'livro-icone' }, icone(l.icone)),
      h('div', { class: 'pendente-titulo' }, h('small', null, l.nome), h('h3', null, titulo)),
      h('span', { class: `status ${recusado ? 'st-recusado' : 'st-pendente'}` }, recusado ? 'Recusado' : 'Aguardando')),
    recusado && h('p', { class: 'pendente-motivo' }, icone('alerta'),
      h('span', null, `Recusado por ${r.revisado_por_nome || 'desconhecido'} ${relativo(r.revisado_em)}`, r.motivo ? `: ${r.motivo}` : '.')),
    campos.length ? h('dl', { class: 'pendente-campos' }, campos.map(c => [h('dt', null, c.nome), h('dd', null, valorCurto(c, r.dados[c.id], r.dados))])) : null,
    h('p', { class: 'pendente-autor' }, `Enviado por ${r.criado_por_nome || 'desconhecido'} ${relativo(r.criado_em)}`,
      r.atualizado_em ? ` · alterado ${relativo(r.atualizado_em)}` : ''),
    h('footer', { class: 'pendente-acoes' },
      botao('Ver documento', { icone: 'olho', classe: 'btn-pequeno', onclick: () => verRegistro(m, d, r, recarregar, recarregar) }),
      (permissoes.editar || meuEnvio) && botao(recusado && meuEnvio ? 'Corrigir e reenviar' : 'Editar', {
        icone: 'editar', classe: 'btn-pequeno', onclick: () => formRegistro(l, r, recarregar),
      }),
      h('span', { class: 'espaco' }),
      modo === 'envios' && meuEnvio && botao('Cancelar envio', {
        classe: 'btn-pequeno btn-perigo-texto',
        onclick: async () => {
          if (!await confirmar(`O envio "${titulo}" será cancelado e apagado.`, { ok: 'Cancelar envio', perigo: true })) return;
          if (await tentar(() => del(`/api/registros/${r.id}`), 'Envio cancelado.')) { window.dispatchEvent(new Event('avisos')); recarregar(); }
        },
      }),
      modo === 'aprovacoes' && permissoes.aprovar && soATabeliaAprova(m, r) && h('small', { class: 'suave' }, 'Espera a aprovação da Tabeliã'),
      modo === 'aprovacoes' && permissoes.aprovar && !soATabeliaAprova(m, r) && [
        botao('Recusar', { classe: 'btn-pequeno', onclick: () => recusar(r, titulo, recarregar) }),
        botao('Aprovar', { icone: 'check', classe: 'btn-pequeno btn-ouro', onclick: () => aprovar(m, r, titulo, recarregar) }),
      ]));
}

/* ─── Um livro: registros ─────────────────────────── */

// abrir: id de um registro para já abrir o documento dele (ex.: vindo do mapa).
export async function livro(m, id, abrir = null) {
  const info = MODULOS[m];
  const raiz = h('div', { class: 'pagina' });
  const filtros = {};
  let busca = '';
  let filtroPagamento = '';
  let vista = 'cartazes'; // livro de Procurados: os cartazes ou a tabela
  let d;

  async function carregar() {
    d = await get(`/api/livros/${id}/registros`);
    if (d.livro.modulo !== m) throw new ErroApi('Livro não encontrado.', 404);
    desenhar();
  }

  // Depois de registrar ou editar, abre o documento (de onde dá para baixar o .book).
  async function abrirDepois(idRegistro) {
    await carregar();
    const reg = d.registros.find(x => x.id === idRegistro);
    if (reg) verRegistro(m, d, reg, carregar, abrirDepois);
  }

  const PAGAMENTOS = {
    atrasado: c => c && c.atrasados > 0,
    emdia: c => c && !c.semInicio && !c.atrasados && !c.encerrada,
  };

  function desenhar() {
    const l = d.livro;
    const campos = l.campos.filter(c => c.tipo !== 'secao');
    let colunas = campos.filter(c => c.destaque);
    if (!colunas.length) colunas = campos.slice(0, 4);
    const selecoes = campos.filter(c => c.tipo === 'selecao').slice(0, 3);

    const contador = h('span', { class: 'contador' });
    const lista = h('div', { class: 'tabela-wrap' });
    const ver = r => verRegistro(m, d, r, carregar, abrirDepois);
    let visiveis = d.registros;

    const tabela = regs => h('table', { class: 'tabela tabela-clicavel' },
      h('thead', null, h('tr', null,
        h('th', { class: 'col-num' }, 'Nº'),
        colunas.map(c => h('th', null, c.nome)),
        l.cobranca && h('th', null, 'Pagamentos'),
        h('th', null, 'Registrado em'))),
      h('tbody', null, regs.map(r => h('tr', {
        tabindex: '0',
        onclick: () => ver(r),
        onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) ver(r); },
      },
      h('td', { class: 'col-num' }, numeroDe(r)),
      colunas.map(c => h('td', { 'data-rotulo': c.nome }, valorCurto(c, r.dados[c.id], r.dados))),
      l.cobranca && h('td', { 'data-rotulo': 'Pagamentos' },
        h('button', {
          class: 'celula-botao', type: 'button', title: 'Ver a tabela de pagamentos',
          onclick: e => { e.stopPropagation(); verPagamentos(r.id, carregar); },
        }, resumoCobranca(r.cobranca))),
      h('td', { class: 'suave', 'data-rotulo': 'Registrado em' }, dataCurta(r.criado_em))))));

    // Livro de Procurados: os registros como cartazes de procurado (clique abre o registro).
    const cartazes = regs => h('div', { class: 'cartazes' }, regs.map(r => {
      const c = h('canvas', { class: 'cartaz', width: 600, height: 860, 'aria-label': `Cartaz de ${tituloDe(l, r.dados)}` });
      desenharCartaz(c, dadosDoCartaz(l, r.dados));
      return h('button', { type: 'button', class: 'cartaz-botao', onclick: () => ver(r) }, c,
        r.situacao && r.situacao !== 'aprovado' && h('span', { class: `cartaz-situacao ${r.situacao}` }, r.situacao === 'pendente' ? 'Aguardando aprovação' : 'Recusado'));
    }));

    function filtrar() {
      const q = normalizar(busca.trim());
      visiveis = d.registros.filter(r =>
        (!q || normalizar(`${Object.values(r.dados).join(' ')} ${r.numero ?? ''}`).includes(q))
        && selecoes.every(c => !filtros[c.id] || r.dados[c.id] === filtros[c.id])
        && (!filtroPagamento || PAGAMENTOS[filtroPagamento](r.cobranca)));
      const total = d.registros.length;
      contador.textContent = visiveis.length === total
        ? `${num(total)} ${total === 1 ? 'registro' : 'registros'}`
        : `${num(visiveis.length)} de ${num(total)}`;
      trocar(lista, visiveis.length
        ? (ehLivroDeCartaz(l) && vista === 'cartazes' ? cartazes(visiveis) : tabela(visiveis))
        : h('p', { class: 'tabela-vazia' }, total ? 'Nada encontrado com esses filtros.' : 'Nenhum registro neste livro ainda.'));
    }

    trocar(raiz, 
      cabecalho({
        titulo: l.nome, sub: l.descricao, icone: l.icone,
        voltar: { href: inicioDoModulo(m), texto: info.titulo },
        acoes: [
          d.permissoes.configurar && botao('Configurar livro', {
            icone: 'ajustes',
            onclick: () => configurarLivro(m, { ...l, total: d.registros.length }, () => carregar(), () => { location.hash = inicioDoModulo(m); }),
          }),
          l.podeRegistrar && botao('Novo registro', { icone: 'mais', classe: 'btn-ouro', onclick: () => formRegistro(l, null, abrirDepois) }),
        ],
      }),
      notaCrianca(),
      l.aliados && ehMorador() && h('p', { class: 'nota' }, chipAliados(), h('span', null, 'Este livro está aberto para Convidados e Aliados: eles leem os registros aprovados.')),
      !l.aberto && !l.podeRegistrar && pode(`${m}.registrar`)
        ? h('p', { class: 'nota' }, icone('cadeado'), `Livro restrito: só ${info.quemComanda} registra aqui.`)
        : null,
      d.aguardando.aprovar > 0 && h('a', { class: 'nota nota-link', href: `#/${m}/aprovacoes` }, icone('relogio'),
        h('span', null, `${d.aguardando.aprovar} ${d.aguardando.aprovar === 1 ? 'registro deste livro aguarda' : 'registros deste livro aguardam'} a sua aprovação.`),
        h('strong', null, 'Ver')),
      d.aguardando.meus > 0 && h('a', { class: 'nota nota-link', href: `#/${m}/envios` }, icone('pena'),
        h('span', null, `Você tem ${d.aguardando.meus} ${d.aguardando.meus === 1 ? 'envio' : 'envios'} neste livro ainda sem aprovação.`),
        h('strong', null, 'Meus envios')),
      h('div', { class: 'ferramentas' },
        h('label', { class: 'busca' }, icone('busca'),
          h('input', { class: 'input', type: 'search', placeholder: 'Buscar em todos os campos', value: busca, oninput: e => { busca = e.target.value; filtrar(); } })),
        selecoes.map(c => h('select', {
          class: 'input filtro', 'aria-label': `Filtrar por ${c.nome}`,
          onchange: e => { filtros[c.id] = e.target.value; filtrar(); },
        },
        h('option', { value: '' }, `${c.nome}: todos`),
        c.opcoes.map(o => h('option', { value: o, selected: filtros[c.id] === o }, o)))),
        l.cobranca && h('select', {
          class: 'input filtro', 'aria-label': 'Filtrar por pagamentos',
          onchange: e => { filtroPagamento = e.target.value; filtrar(); },
        },
        h('option', { value: '' }, 'Pagamentos: todos'),
        h('option', { value: 'atrasado', selected: filtroPagamento === 'atrasado' }, 'Com atraso'),
        h('option', { value: 'emdia', selected: filtroPagamento === 'emdia' }, 'Em dia')),
        ehLivroDeCartaz(l) && h('div', { class: 'segmentado' }, [['cartazes', 'Cartazes'], ['tabela', 'Tabela']].map(([v, n]) => h('button', {
          type: 'button', class: `seg ${vista === v ? 'ativo' : ''}`.trim(), onclick: () => { vista = v; desenhar(); },
        }, n))),
        contador,
        botao('Baixar .book', {
          icone: 'baixar', classe: 'btn-pequeno',
          titulo: 'Baixa os registros mostrados como um livro para o mod Scribble',
          onclick: () => {
            if (!visiveis.length) return aviso('Não há registros para colocar no livro.', 'erro');
            livroDeRegistros(info.titulo, l, visiveis, estado.eu.nome).baixar();
          },
        }),
        modeloDePessoas(info.titulo, l) === 'moradores' && botao('Lista de moradores', {
          icone: 'baixar', classe: 'btn-pequeno',
          titulo: 'Baixa a relação oficial dos moradores (nome, profissão e idade) como um livro bonito para o mod Scribble',
          onclick: () => listaDeMoradores(l, d.registros),
        })),
      lista);
    filtrar();
  }

  await carregar();
  if (abrir) {
    const reg = d.registros.find(x => x.id === Number(abrir));
    if (reg) setTimeout(() => verRegistro(m, d, reg, carregar, abrirDepois), 0);
  }
  return raiz;
}

/* ─── Lista de moradores e documento de identidade ── */

// A relação dos moradores para entregar ao Império: a Tabeliã escolhe quem entra (por situação) e a ordem.
// Só entram registros aprovados; por padrão ficam de fora os Falecidos e os Exilados.
function listaDeMoradores(l, registros) {
  const aprovados = registros.filter(r => !r.situacao || r.situacao === 'aprovado');
  if (!aprovados.length) return aviso('Não há moradores aprovados para colocar na lista.', 'erro');
  const campoSituacao = l.campos.find(c => c.id === 'situacao' || normalizar(c.nome).replace(/:\s*$/, '') === 'situacao');
  const contagem = new Map();
  for (const r of aprovados) {
    const s = (campoSituacao && r.dados[campoSituacao.id]) || '';
    contagem.set(s, (contagem.get(s) || 0) + 1);
  }
  const FORA = new Set(['falecido', 'exilado']);
  const marcadas = new Set([...contagem.keys()].filter(s => !FORA.has(normalizar(s))));
  let ordem = 'alfabetica';
  const total = () => aprovados.filter(r => marcadas.has((campoSituacao && r.dados[campoSituacao.id]) || '')).length;
  const resumo = h('p', { class: 'suave' });
  const atualizar = () => { resumo.textContent = `${total()} ${total() === 1 ? 'morador entra' : 'moradores entram'} na lista.`; };
  atualizar();
  modalForm({
    titulo: 'Lista de moradores para o Império', textoOk: 'Baixar o livro', classeOk: 'btn-ouro',
    conteudo: [
      h('p', { class: 'form-intro' }, 'Um livro bonito com o nome, a profissão e a idade de cada morador, para apresentar ao Império. Só moradores (Nobres e Outros não entram).'),
      campoSituacao && contagem.size > 1 && h('div', { class: 'campo' },
        h('span', { class: 'campo-rotulo' }, 'Quem entra'),
        h('div', { class: 'marcadores' }, [...contagem].map(([s, n]) => h('label', { class: 'marcador' },
          h('input', { type: 'checkbox', checked: marcadas.has(s), onchange: e => { if (e.target.checked) marcadas.add(s); else marcadas.delete(s); atualizar(); } }),
          h('span', null, `${s || 'Sem situação'} (${n})`))))),
      h('div', { class: 'campo' },
        h('span', { class: 'campo-rotulo' }, 'Ordem'),
        h('div', { class: 'segmentado' }, [['alfabetica', 'Pelo nome'], ['registro', 'Pelo número do registro']].map(([v, n]) => h('button', {
          type: 'button', class: `seg ${ordem === v ? 'ativo' : ''}`.trim(),
          onclick: e => { ordem = v; e.currentTarget.parentElement.querySelectorAll('.seg').forEach(b => b.classList.toggle('ativo', b === e.currentTarget)); },
        }, n)))),
      resumo,
    ],
    aoEnviar: async () => {
      const entram = aprovados.filter(r => marcadas.has((campoSituacao && r.dados[campoSituacao.id]) || ''));
      if (!entram.length) throw new Error('Marque pelo menos uma situação.');
      livroDeMoradores(l, entram, estado.eu.nome, { ordem, tabeliao: await nomeDaTabelia() }).baixar('Moradores de Lyendell');
    },
  });
}

// O documento de identidade da pessoa registrada: nome, endereço (nick), residência e cargo.
// Ela assina: o nome da Tabeliã vem do cargo "Tabeliã" (sem ele, sai só "Tabelionato de Lyendell").
const nomeDaTabelia = async () => { try { return (await get('/api/tabeliao')).nome || ''; } catch { return ''; } };

async function baixarIdentidade(m, l, r) {
  documentoDeIdentidade(MODULOS[m].titulo, l, r, estado.eu.nome, { tabeliao: await nomeDaTabelia() }).baixar();
}

/* ─── Ver registro (como documento oficial) ───────── */

// O cargo de quem aprova, para a linha de assinatura ("da Tabeliã" vira "Tabeliã").
const cargoDe = m => {
  const t = MODULOS[m].aprovador.replace(/^d[aeo]s?\s+/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function verRegistro(m, d, r, recarregar, reabrir) {
  const l = d.livro;
  const titulo = tituloDe(l, r.dados);
  const aprovado = !r.situacao || r.situacao === 'aprovado';
  // Quem enviou pode corrigir ou cancelar o próprio registro enquanto ele não foi aprovado.
  const meuEnvio = !aprovado && r.criado_por === estado.eu.id;
  const podeEditar = d.permissoes.editar || meuEnvio;
  const podeApagar = d.permissoes.apagar || meuEnvio;
  const tracos = lerAssinatura(r.assinatura);
  const podeAssinar = !!d.permissoes.aprovar && aprovado && !ehCrianca();
  const linhas = [];
  let secaoPendente = null;
  for (const c of l.campos) {
    if (c.tipo === 'secao') { secaoPendente = c; continue; }
    const v = r.dados[c.id];
    if (!temValor(c, r.dados)) continue;
    if (secaoPendente) { linhas.push(h('h3', { class: 'doc-secao' }, h('span', null, secaoPendente.nome))); secaoPendente = null; }
    const largo = c.tipo === 'texto_longo' || c.tipo === 'imagem';
    linhas.push(h('div', { class: `doc-linha ${largo ? 'larga' : ''} ${c.tipo === 'imagem' ? 'doc-linha-foto' : ''}`.trim() },
      h('span', { class: 'doc-rotulo' }, c.nome),
      h('div', { class: 'doc-valor' }, valorCompleto(c, v, r.dados))));
  }

  // Depois de assinar, o documento abre de novo já com a assinatura no papel.
  const aposAssinar = () => { janela.fechar(); (reabrir || recarregar)(r.id); };

  // No fim do papel: a linha de assinatura. Aprovado: a assinatura desenhada (ou só a linha com o nome), o cargo e a data.
  function blocoAssinatura() {
    if (r.situacao === 'recusado') return null;
    if (!aprovado) {
      return h('section', { class: 'doc-assina', 'aria-label': 'Assinatura' },
        h('div', { class: 'doc-assina-col' },
          h('div', { class: 'doc-assina-tinta' }),
          h('p', { class: 'doc-assina-nome doc-assina-espera' }, `Assinatura ${MODULOS[m].aprovador}`)));
    }
    if (!tracos && !r.revisado_por_nome && !podeAssinar) return null;
    const tinta = h('div', { class: 'doc-assina-tinta' });
    if (tracos) desenharAssinatura(tinta, tracos, { ajustar: true, rotulo: `Assinatura de ${r.revisado_por_nome || 'quem aprovou'}` });
    const convite = podeAssinar && !tracos && h('div', { class: 'doc-convite' },
      h('p', null, 'Este registro ainda não foi assinado. Assine no papel, com o mouse ou o dedo.'),
      botao('Assinar este registro', { icone: 'pena', classe: 'btn-ouro', onclick: () => pedirAssinatura(m, r, titulo, { modo: 'assinar', depois: aposAssinar }) }));
    const assinou = tracos || r.revisado_por_nome;
    return h('section', { class: `doc-assina ${tracos ? 'assinado' : ''}`.trim(), 'aria-label': 'Assinatura' },
      assinou && h('span', { class: 'selo-lacre', 'aria-hidden': 'true' }, icone('coelho')),
      h('div', { class: 'doc-assina-col' },
        convite,
        tinta,
        assinou && h('p', { class: 'doc-assina-nome' }, r.revisado_por_nome || 'Aprovado'),
        assinou && h('p', { class: 'doc-assina-cargo' }, cargoDe(m), r.revisado_em && h('time', null, ` · ${dataCurta(r.revisado_em)}`))));
  }

  const cartaz = ehLivroDeCartaz(l) ? h('canvas', { class: 'cartaz cartaz-doc', width: 600, height: 860 }) : null;
  if (cartaz) desenharCartaz(cartaz, dadosDoCartaz(l, r.dados));
  const doc = h('article', { class: `documento documento-livro sit-${r.situacao || 'aprovado'}` },
    cartaz,
    r.numero && h('div', { class: 'doc-numero', title: `Registro nº ${r.numero}` }, h('small', null, 'Registro nº'), h('strong', null, String(r.numero).padStart(4, '0'))),
    h('header', { class: 'doc-cab' },
      h('img', { src: '/img/brasao.png', alt: '', class: 'doc-brasao' }),
      h('p', { class: 'doc-sobre' }, `${MODULOS[m].titulo} de Lyendell`),
      h('h2', { class: 'doc-titulo' }, titulo),
      h('p', { class: 'doc-livro' }, r.numero ? `${l.nome} · Registro nº ${r.numero}` : `${l.nome} · sem número até ser aprovado`)),
    !aprovado && h('p', { class: `doc-situacao ${r.situacao}` },
      r.situacao === 'pendente'
        ? `Aguardando aprovação ${MODULOS[m].aprovador}`
        : `Recusado por ${r.revisado_por_nome || 'desconhecido'}${r.motivo ? `: ${r.motivo}` : ''}`),
    h('div', { class: 'doc-campos' }, linhas.length ? linhas : h('p', { class: 'suave' }, 'Registro sem informações.')),
    !aprovado && h('div', { class: `doc-carimbo sit-${r.situacao}`, 'aria-hidden': 'true' }, h('span', null, r.situacao === 'pendente' ? 'Aguardando aprovação' : 'Recusado')),
    blocoAssinatura(),
    h('footer', { class: 'doc-assinatura' },
      h('p', null, `Registrado por ${r.criado_por_nome || 'desconhecido'} em ${dataHora(r.criado_em)}.`),
      r.atualizado_em && h('p', null, `Alterado por ${r.atualizado_por_nome} em ${dataHora(r.atualizado_em)}.`)));

  const cancelar = meuEnvio && !d.permissoes.apagar;
  const janela = modal({
    corpo: h('div', { class: 'papel-mesa' }, doc), tamanho: 'medio', classe: 'modal-documento modal-livro',
    rodape: [
      podeApagar && botao(cancelar ? 'Cancelar envio' : 'Apagar', {
        icone: 'lixo', classe: 'btn-perigo-texto',
        onclick: async () => {
          const msg = cancelar ? `O envio "${titulo}" será cancelado e apagado.` : `O registro "${titulo}" será apagado para sempre.`;
          if (!await confirmar(msg, { ok: cancelar ? 'Cancelar envio' : 'Apagar', perigo: true })) return;
          if (await tentar(() => del(`/api/registros/${r.id}`), cancelar ? 'Envio cancelado.' : 'Registro apagado.')) {
            janela.fechar();
            window.dispatchEvent(new Event('avisos'));
            recarregar();
          }
        },
      }),
      h('span', { class: 'espaco' }),
      aprovado && l.cobranca && botao('Pagamentos', { icone: 'moeda', onclick: () => verPagamentos(r.id, recarregar) }),
      cartaz && botao('Baixar cartaz', { icone: 'imagem', titulo: 'Baixa o cartaz de procurado como imagem (PNG)', onclick: () => baixarCartaz(dadosDoCartaz(l, r.dados)) }),
      aprovado && modeloDePessoas(MODULOS[m].titulo, l) && botao('Documento de identidade', {
        icone: 'baixar', titulo: 'Baixa o documento de identidade desta pessoa (um livro com os dados que quase nunca mudam) para o mod Scribble',
        onclick: () => baixarIdentidade(m, l, r),
      }),
      botao('Baixar .book', {
        icone: 'baixar', titulo: 'Baixa este registro como livro para o mod Scribble (só com o nome de quem aprovou, sem a assinatura)',
        onclick: () => livroDeRegistro(MODULOS[m].titulo, l, r, estado.eu.nome).baixar(),
      }),
      podeAssinar && tracos && botao('Refazer a assinatura', { icone: 'pena', onclick: () => pedirAssinatura(m, r, titulo, { modo: 'assinar', refazer: true, depois: aposAssinar }) }),
      podeEditar && botao('Editar', { icone: 'editar', onclick: () => { janela.fechar(); formRegistro(l, r, reabrir || recarregar); } }),
      d.permissoes.aprovar && r.situacao === 'pendente' && !soATabeliaAprova(m, r) && botao('Recusar', { onclick: () => recusar(r, titulo, () => { janela.fechar(); recarregar(); }) }),
      d.permissoes.aprovar && r.situacao === 'pendente' && !soATabeliaAprova(m, r) && botao('Aprovar', {
        icone: 'check', classe: 'btn-ouro',
        onclick: () => aprovar(m, r, titulo, () => { janela.fechar(); (reabrir || recarregar)(r.id); }),
      }),
      botao('Fechar', { onclick: () => janela.fechar() }),
    ],
  });
}

// Aprovar abre a almofada: o aprovador assina o papel (ou aprova sem assinar, que é opcional).
function aprovar(m, r, titulo, depois) {
  pedirAssinatura(m, r, titulo, { modo: 'aprovar', depois });
}

// A janela "Assine para aprovar" (e "Assinar o registro", "Refazer a assinatura").
function pedirAssinatura(m, r, titulo, { modo, refazer = false, depois }) {
  const eu = estado.eu;
  const chave = `lyendell.assinatura.${eu.id}`;
  const aprovando = modo === 'aprovar';
  let enviando = false;
  const bOk = h('button', { class: 'btn btn-ouro', type: 'button', disabled: true, onclick: () => enviar(true) },
    aprovando ? 'Aprovar e assinar' : refazer ? 'Trocar a assinatura' : 'Assinar o registro');
  const bSem = aprovando && h('button', { class: 'btn btn-fantasma assinar-sem', type: 'button', onclick: () => enviar(false) }, 'Aprovar sem assinar');
  const bCancelar = h('button', { class: 'btn', type: 'button', onclick: () => janela.fechar() }, 'Cancelar');
  const almofada = almofadaDeAssinatura({ aoMudar: vazio => { bOk.disabled = enviando || vazio; } });
  const ultima = lerUltimaAssinatura(chave);
  const bUsar = ultima && h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => almofada.definir(ultima) },
    icone('pena'), h('span', null, 'Usar a minha última assinatura'));

  function travar(sim) {
    enviando = sim;
    bOk.disabled = sim || almofada.vazio();
    for (const b of [bSem, bCancelar, bUsar]) if (b) b.disabled = sim;
    bOk.classList.toggle('carregando', sim);
  }

  async function enviar(comAssinatura) {
    if (enviando) return;
    if (comAssinatura && almofada.vazio()) return;
    travar(true);
    try {
      const corpo = comAssinatura ? corpoDaAssinatura(almofada.tracos()) : undefined;
      await post(`/api/registros/${r.id}/${aprovando ? 'aprovar' : 'assinar'}`, corpo);
      if (comAssinatura) guardarUltimaAssinatura(almofada.tracos(), chave);
      aviso(aprovando
        ? (comAssinatura ? 'Registro aprovado e assinado. Já está no livro oficial.' : 'Registro aprovado. Já está no livro oficial.')
        : 'Assinatura guardada no registro.');
      window.dispatchEvent(new Event('avisos'));
      janela.fechar();
      depois();
    } catch (e) {
      aviso(e.message, 'erro');
      travar(false);
    }
  }

  const janela = modal({
    titulo: aprovando ? 'Assine para aprovar' : refazer ? 'Refazer a assinatura' : 'Assinar o registro',
    tamanho: 'medio', classe: 'modal-assinar',
    corpo: h('div', { class: 'assinar' },
      h('p', { class: 'assinar-intro' }, aprovando
        ? `Você vai aprovar "${titulo}". Assine no papel, com o mouse, o dedo ou a caneta. A assinatura é opcional.`
        : `Assine "${titulo}" no papel, com o mouse, o dedo ou a caneta. ${refazer ? 'A nova assinatura toma o lugar da anterior.' : ''}`.trim()),
      almofada.elemento,
      h('p', { class: 'assinar-quem' }, h('strong', null, eu.nome), h('span', null, cargoDe(m))),
      bUsar),
    rodape: [bSem, h('span', { class: 'espaco' }), bCancelar, bOk],
  });
}

function recusar(r, titulo, depois) {
  const motivo = h('textarea', { class: 'input', rows: '3', maxlength: '500', placeholder: 'Ex.: faltou a data de abertura; o nome está errado' });
  modalForm({
    titulo: `Recusar · ${titulo}`,
    textoOk: 'Recusar registro',
    classeOk: 'btn-perigo',
    conteudo: [
      h('p', { class: 'form-intro' }, `${r.criado_por_nome || 'Quem enviou'} vai ver o motivo em "Meus envios" e pode corrigir e mandar de novo.`),
      campo('Motivo', motivo, { ajuda: 'Opcional, mas ajuda quem enviou a corrigir.' }),
    ],
    aoEnviar: async () => {
      await post(`/api/registros/${r.id}/recusar`, { motivo: motivo.value });
      aviso('Registro recusado.');
      window.dispatchEvent(new Event('avisos'));
      depois();
    },
  });
}

/* ─── Formulário de registro ──────────────────────── */

// inicial: dados já preenchidos para um registro novo (ex.: a proposta do povo aprovada indo para o livro).
export async function formRegistro(l, r, aoSalvar, inicial = null) {
  const valores = { ...(r?.dados || inicial || {}) };
  // Antes de abrir, busca os nomes dos campos "Escolher de outro livro" (ex.: a lista de guardas).
  const fontes = {};
  await Promise.all([...new Set(l.campos.filter(c => c.tipo === 'referencia').map(c => c.livro))].map(async id => {
    fontes[id] = await get(`/api/livros/${id}/opcoes`).catch(() => null);
  }));
  const calculados = [];
  const ctx = { envio: { n: 0 }, fontes, calculados, mudou: () => calculados.forEach(f => f()), semLimite: ['congresso', 'leis'].includes(l.modulo) };
  const nomeDo = id => l.campos.find(x => x.id === id)?.nome || id;

  modalForm({
    titulo: r ? `Editar registro · ${l.nome}` : `Novo registro · ${l.nome}`,
    tamanho: 'medio', classe: 'modal-papel',
    textoOk: r ? 'Salvar alterações' : 'Registrar',
    conteudo: [
      h('header', { class: 'folha-cab' },
        h('img', { src: '/img/brasao.png', alt: '', class: 'folha-brasao' }),
        h('p', { class: 'folha-sobre' }, `${MODULOS[l.modulo].titulo} de Lyendell`),
        h('p', { class: 'folha-livro' }, r?.numero ? `${l.nome} · Registro nº ${r.numero}` : l.nome)),
      h('div', { class: 'form-grade' }, l.campos.map(c => entradaDoCampo(c, valores, ctx))),
    ],
    aoEnviar: async () => {
      if (ctx.envio.n) throw new Error('Espere a imagem terminar de enviar.');
      const faltando = l.campos.find(c => c.obrigatorio && (valores[c.id] == null || String(valores[c.id]).trim() === ''));
      if (faltando) throw new Error(`Preencha o campo "${faltando.nome}".`);
      for (const c of l.campos.filter(x => x.tipo === 'duracao')) {
        const ini = valores[c.inicio];
        const fim = valores[c.fim];
        if (ini && fim && fim < ini) throw new Error(`"${nomeDo(c.fim)}" não pode ser antes de "${nomeDo(c.inicio)}".`);
      }
      let idSalvo = r?.id;
      let situacao;
      if (r) ({ situacao } = await put(`/api/registros/${r.id}`, { dados: valores }));
      else ({ id: idSalvo, situacao } = await post(`/api/livros/${l.id}/registros`, { dados: valores }));
      const aprovador = MODULOS[l.modulo].aprovador;
      if (situacao === 'pendente' && !r) aviso(`Registro enviado para aprovação ${aprovador}. Acompanhe em "Meus envios".`);
      else if (situacao === 'pendente' && r.situacao === 'recusado') aviso(`Registro corrigido e reenviado para aprovação ${aprovador}.`);
      else aviso(r ? 'Registro atualizado.' : 'Registro feito.');
      window.dispatchEvent(new Event('avisos'));
      aoSalvar(idSalvo, situacao);
    },
  });
}

function entradaDoCampo(c, valores, ctx) {
  if (c.tipo === 'secao') return h('h3', { class: 'form-secao' }, c.nome);
  const v = valores[c.id];
  const definir = x => { valores[c.id] = x; ctx.mudou(); };
  const opcoes = { ajuda: c.ajuda, obrigatorio: c.obrigatorio };

  switch (c.tipo) {
    case 'duracao': {
      // Calculado na hora, conforme as datas são preenchidas.
      const saida = h('p', { class: 'calculado' });
      const atualizar = () => { saida.textContent = textoDuracao(c, valores) || 'Preencha as datas para calcular.'; };
      ctx.calculados.push(atualizar);
      atualizar();
      return h('div', { class: 'campo' },
        h('span', { class: 'campo-rotulo' }, c.nome),
        saida,
        h('small', { class: 'campo-ajuda' }, c.ajuda || 'Calculado automaticamente.'));
    }
    case 'referencia':
      return entradaReferencia(c, v, definir, ctx.fontes[c.livro]);
    case 'texto_longo':
      return campo(c.nome, h('textarea', { class: 'input', rows: ctx.semLimite ? '8' : '4', maxlength: ctx.semLimite ? null : '10000', oninput: e => definir(e.target.value) }, v ?? ''), { ...opcoes, classe: 'largo' });
    case 'numero':
      return campo(c.nome, h('input', { class: 'input', type: 'number', step: 'any', value: v ?? '', oninput: e => definir(e.target.value) }), opcoes);
    case 'data':
      return campo(c.nome, h('input', { class: 'input', type: 'date', value: v ?? '', oninput: e => definir(e.target.value) }), opcoes);
    case 'selecao': {
      const lista = [...c.opcoes];
      if (v && !lista.includes(v)) lista.push(v);
      return campo(c.nome, h('select', { class: 'input', onchange: e => definir(e.target.value) },
        h('option', { value: '' }, 'Escolha uma opção'),
        lista.map(o => h('option', { value: o, selected: o === v }, o))), opcoes);
    }
    case 'sim_nao':
      return h('div', { class: 'campo' }, interruptor(c.nome, !!v, definir, c.ajuda));
    case 'imagem':
      return h('div', { class: 'campo largo' },
        h('span', { class: 'campo-rotulo' }, c.nome, c.obrigatorio && h('b', { class: 'obrig' }, ' *')),
        entradaImagem(v, definir, ctx.envio),
        c.ajuda && h('small', { class: 'campo-ajuda' }, c.ajuda));
    default:
      return campo(c.nome, h('input', { class: 'input', type: 'text', maxlength: '300', value: v ?? '', oninput: e => definir(e.target.value) }), opcoes);
  }
}

// Escolher nomes já registrados em outro livro (ex.: guardas responsáveis pela prisão).
function entradaReferencia(c, v, definir, fonte) {
  const rotulo = h('span', { class: 'campo-rotulo' }, c.nome, c.obrigatorio && h('b', { class: 'obrig' }, ' *'));
  const ajuda = c.ajuda && h('small', { class: 'campo-ajuda' }, c.ajuda);
  if (!fonte) {
    return h('div', { class: 'campo largo' }, rotulo,
      h('p', { class: 'nota' }, icone('alerta'), 'Não foi possível carregar a lista de nomes deste campo.'));
  }
  const nomes = fonte.opcoes.map(o => o.titulo);
  const semNinguem = !nomes.length && h('small', { class: 'campo-ajuda' }, `Ainda não há ninguém registrado em "${fonte.livro.nome}".`);

  if (!c.multiplo) {
    const atual = listaDeNomes(v)[0] || '';
    const lista = atual && !nomes.includes(atual) ? [...nomes, atual] : nomes;
    return h('div', { class: 'campo' }, rotulo,
      h('select', { class: 'input', onchange: e => definir(e.target.value) },
        h('option', { value: '' }, `Escolha em "${fonte.livro.nome}"`),
        lista.map(n => h('option', { value: n, selected: n === atual }, n))),
      semNinguem, ajuda);
  }

  const escolhidos = [...listaDeNomes(v)];
  const chips = h('div', { class: 'opcoes-chips' });
  const seletor = h('select', {
    class: 'input', 'aria-label': `Adicionar em ${c.nome}`,
    onchange: e => {
      if (e.target.value && !escolhidos.includes(e.target.value)) {
        escolhidos.push(e.target.value);
        definir([...escolhidos]);
      }
      desenhar();
    },
  });
  function desenhar() {
    trocar(chips, ...(escolhidos.length
      ? escolhidos.map((n, i) => h('span', { class: 'opcao-chip' }, n,
        h('button', { type: 'button', 'aria-label': `Tirar ${n}`, onclick: () => { escolhidos.splice(i, 1); definir([...escolhidos]); desenhar(); } }, icone('x'))))
      : [h('span', { class: 'suave' }, 'Ninguém escolhido ainda.')]));
    const restantes = nomes.filter(n => !escolhidos.includes(n));
    trocar(seletor,
      h('option', { value: '' }, restantes.length ? `Adicionar de "${fonte.livro.nome}"` : 'Todos já foram escolhidos'),
      ...restantes.map(n => h('option', { value: n }, n)));
    seletor.value = '';
    seletor.disabled = !restantes.length;
  }
  desenhar();
  return h('div', { class: 'campo largo' }, rotulo, chips, seletor, semNinguem, ajuda);
}

export function entradaImagem(inicial, definir, envio) {
  const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
  const caixa = h('div', { class: 'img-entrada' });
  let atual = inicial || '';

  function desenhar(previa, enviando) {
    const url = previa ?? atual;
    trocar(caixa, 
      url ? h('img', { src: url, alt: '', class: 'img-previa' }) : h('div', { class: 'img-vazia' }, icone('imagem')),
      h('div', { class: 'img-acoes' },
        botao(enviando ? 'Enviando…' : url ? 'Trocar imagem' : 'Escolher imagem', { icone: 'enviar', desativado: enviando, onclick: () => arquivo.click() }),
        url && !enviando && botao('Remover', { classe: 'btn-fantasma', onclick: () => { atual = ''; definir(''); desenhar(); } }),
        h('small', { class: 'campo-ajuda' }, 'PNG, JPG, GIF ou WEBP. Fotos grandes são reduzidas automaticamente.')),
      arquivo);
  }

  arquivo.addEventListener('change', async () => {
    const f = arquivo.files[0];
    if (!f) return;
    envio.n++;
    const previa = URL.createObjectURL(f);
    desenhar(previa, true);
    try {
      atual = await enviarImagem(f);
      definir(atual);
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      envio.n--;
      arquivo.value = '';
      URL.revokeObjectURL(previa);
      desenhar();
    }
  });

  desenhar();
  return caixa;
}

/* ─── Configurar livro (formulário, seções, opções) ─ */

function marcador(texto, ligado, aoMudar) {
  return h('label', { class: 'marcador' },
    h('input', { type: 'checkbox', checked: !!ligado, onchange: e => aoMudar(e.target.checked) }),
    h('span', null, texto));
}

function editorOpcoes(c) {
  const chips = h('div', { class: 'opcoes-chips' });
  const entrada = h('input', { class: 'input input-pequeno', placeholder: 'Nova opção', maxlength: '60' });
  const desenhar = () => trocar(chips, ...(c.opcoes.length
    ? c.opcoes.map((o, i) => h('span', { class: 'opcao-chip' }, o,
      h('button', { type: 'button', 'aria-label': `Remover ${o}`, onclick: () => { c.opcoes.splice(i, 1); desenhar(); } }, icone('x'))))
    : [h('span', { class: 'suave' }, 'Nenhuma opção ainda.')]));
  const adicionar = () => {
    const v = entrada.value.trim();
    if (v && !c.opcoes.includes(v)) { c.opcoes.push(v); desenhar(); }
    entrada.value = '';
    entrada.focus();
  };
  entrada.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
  desenhar();
  return h('div', { class: 'opcoes-editor' },
    h('span', { class: 'campo-rotulo' }, 'Opções da lista'),
    chips,
    h('div', { class: 'opcoes-add' }, entrada, botao('Adicionar', { icone: 'mais', onclick: adicionar })));
}

async function configurarLivro(m, l, aoSalvar, aoApagar) {
  // Livros que podem servir de lista para um campo "Escolher de outro livro".
  const outrosLivros = (await Promise.all(Object.keys(MODULOS).map(mm =>
    get(`/api/modulos/${mm}/livros`).then(r => r.livros.map(x => ({ id: x.id, nome: x.nome, modulo: mm }))).catch(() => []))))
    .flat().filter(x => x.id !== l?.id);

  const s = l
    ? { nome: l.nome, descricao: l.descricao, icone: l.icone, aberto: l.aberto, aliados: !!l.aliados, campos: structuredClone(l.campos) }
    : { nome: '', descricao: '', icone: 'livro', aberto: true, aliados: false, campos: [{ id: idLocal(), nome: 'Nome', tipo: 'texto', obrigatorio: true, destaque: true }] };
  s.campos.forEach(c => { if (c.tipo === 'selecao' && !c.opcoes) c.opcoes = []; });
  if (m === 'tabelionato') s.cobranca = l?.cobranca ? { ...l.cobranca } : { ativo: false, campo: '', intervalo: 14 };

  const listaCampos = h('div', { class: 'campos-cfg' });
  const grade = h('div', { class: 'icones-grade', role: 'group', 'aria-label': 'Ícone do livro' });
  const caixaCobranca = h('div', { class: 'cfg-cobranca' });

  // Pagamentos periódicos (só no Tabelionato): cada registro ganha uma tabela de pagamentos.
  function desenharCobranca() {
    if (m !== 'tabelionato') return;
    const datas = s.campos.filter(c => c.tipo === 'data');
    if (!datas.some(c => c.id === s.cobranca.campo)) s.cobranca.campo = datas[0]?.id || '';
    trocar(caixaCobranca,
      h('div', { class: 'cfg-cab' },
        h('h3', null, 'Pagamentos periódicos'),
        h('p', { class: 'suave' }, 'Cada registro deste livro ganha uma tabela de pagamentos, como a dos comerciantes. Só quem tem a permissão de pagamentos (a Tabeliã) marca como pago.')),
      interruptor('Cobrar pagamentos periódicos', s.cobranca.ativo, v => { s.cobranca.ativo = v; desenharCobranca(); }),
      s.cobranca.ativo && (datas.length
        ? h('div', { class: 'form-grade' },
          campo('Contar a partir do campo', h('select', { class: 'input', onchange: e => { s.cobranca.campo = e.target.value; } },
            datas.map(c => h('option', { value: c.id, selected: c.id === s.cobranca.campo }, c.nome || '(campo sem nome)')))),
          campo('A cada quantos dias', h('input', {
            class: 'input', type: 'number', min: '1', max: '365', step: '1', value: String(s.cobranca.intervalo),
            oninput: e => { s.cobranca.intervalo = Number(e.target.value); },
          }), { ajuda: 'O primeiro pagamento vence esse número de dias depois da data escolhida.' }))
        : h('p', { class: 'nota' }, icone('alerta'), 'Adicione ao formulário um campo do tipo Data (ex.: Data de abertura) para os pagamentos terem de onde começar a contar.')));
  }

  function desenharIcones() {
    trocar(grade, ...ICONES_LIVRO.map(n => h('button', {
      type: 'button', class: `icone-opcao ${s.icone === n ? 'ativo' : ''}`.trim(),
      'aria-pressed': String(s.icone === n), 'aria-label': n,
      onclick: () => { s.icone = n; desenharIcones(); },
    }, icone(n))));
  }

  function desenharCampos() {
    trocar(listaCampos, ...s.campos.map((c, i) => linhaCampo(c, i)));
    desenharCobranca();
  }

  function linhaCampo(c, i) {
    const mover = passo => {
      const j = i + passo;
      if (j < 0 || j >= s.campos.length) return;
      [s.campos[i], s.campos[j]] = [s.campos[j], s.campos[i]];
      desenharCampos();
    };
    const controles = h('div', { class: 'cfg-controles' },
      botaoIcone('cima', 'Subir', () => mover(-1)),
      botaoIcone('baixo', 'Descer', () => mover(1)),
      botaoIcone('lixo', c.tipo === 'secao' ? 'Remover seção' : 'Remover campo', () => { s.campos.splice(i, 1); desenharCampos(); }, 'perigo'));

    if (c.tipo === 'secao') {
      return h('div', { class: 'campo-cfg secao' },
        h('div', { class: 'campo-cfg-linha' },
          h('span', { class: 'tag-secao' }, icone('secao'), 'Seção'),
          h('input', { class: 'input', value: c.nome, placeholder: 'Título da seção', maxlength: '60', oninput: e => { c.nome = e.target.value; } }),
          controles));
    }

    return h('div', { class: 'campo-cfg' },
      h('div', { class: 'campo-cfg-linha' },
        h('input', { class: 'input', value: c.nome, placeholder: 'Nome do campo', maxlength: '60', 'aria-label': 'Nome do campo', oninput: e => { c.nome = e.target.value; } }),
        h('select', {
          class: 'input cfg-tipo', 'aria-label': 'Tipo do campo',
          onchange: e => { c.tipo = e.target.value; prepararTipo(c); desenharCampos(); },
        }, TIPOS.map(([v, n]) => h('option', { value: v, selected: c.tipo === v }, n))),
        controles),
      h('div', { class: 'campo-cfg-extras' },
        c.tipo !== 'duracao' && marcador('Obrigatório', c.obrigatorio, v => { c.obrigatorio = v; }),
        marcador('Aparece na lista', c.destaque, v => { c.destaque = v; }),
        h('input', { class: 'input input-pequeno', value: c.ajuda || '', maxlength: '140', placeholder: 'Dica para quem preenche (opcional)', oninput: e => { c.ajuda = e.target.value; } })),
      c.tipo === 'selecao' && editorOpcoes(c),
      c.tipo === 'referencia' && editorReferencia(c),
      c.tipo === 'duracao' && editorDuracao(c));
  }

  // Valores iniciais ao trocar o tipo de um campo.
  function prepararTipo(c) {
    if (c.tipo === 'selecao' && !c.opcoes) c.opcoes = [];
    if (c.tipo === 'referencia' && !c.livro) c.livro = outrosLivros[0]?.id;
    if (c.tipo === 'duracao') {
      const datas = s.campos.filter(x => x.tipo === 'data');
      c.inicio = c.inicio || datas[0]?.id || '';
      c.fim = c.fim || datas.find(x => x.id !== c.inicio)?.id || '';
    }
  }

  function editorReferencia(c) {
    if (!outrosLivros.length) return h('p', { class: 'nota' }, icone('alerta'), 'Não há outro livro para escolher nomes.');
    if (!outrosLivros.some(x => x.id === c.livro)) c.livro = outrosLivros[0].id;
    const nomeModulo = mm => MODULOS[mm].titulo;
    return h('div', { class: 'opcoes-editor' },
      h('div', { class: 'form-grade' },
        campo('Puxar os nomes do livro', h('select', { class: 'input', onchange: e => { c.livro = Number(e.target.value); } },
          Object.keys(MODULOS).map(mm => h('optgroup', { label: nomeModulo(mm) },
            outrosLivros.filter(x => x.modulo === mm).map(x => h('option', { value: String(x.id), selected: x.id === c.livro }, x.nome)))))),
        h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Quantos'),
          marcador('Pode escolher vários', c.multiplo, v => { c.multiplo = v; }))));
  }

  function editorDuracao(c) {
    const datas = s.campos.filter(x => x.tipo === 'data');
    if (datas.length < 2) return h('p', { class: 'nota' }, icone('alerta'), 'Este cálculo precisa de dois campos do tipo Data no formulário (ex.: prisão e soltura).');
    if (!datas.some(x => x.id === c.inicio)) c.inicio = datas[0].id;
    if (!datas.some(x => x.id === c.fim) || c.fim === c.inicio) c.fim = datas.find(x => x.id !== c.inicio).id;
    const seletor = (valor, definir) => h('select', { class: 'input', onchange: e => definir(e.target.value) },
      datas.map(x => h('option', { value: x.id, selected: x.id === valor }, x.nome || '(campo sem nome)')));
    return h('div', { class: 'opcoes-editor' },
      h('div', { class: 'form-grade' },
        campo('Contar a partir de', seletor(c.inicio, v => { c.inicio = v; })),
        campo('Até', seletor(c.fim, v => { c.fim = v; }))),
      h('small', { class: 'campo-ajuda' }, 'Mostra quantos dias há entre as duas datas e quanto falta. Se a data final ficar em branco, aparece "Sem data prevista".'));
  }

  const adicionar = tipo => {
    s.campos.push(tipo === 'secao' ? { id: idLocal(), nome: '', tipo: 'secao' } : { id: idLocal(), nome: '', tipo: 'texto' });
    desenharCampos();
    listaCampos.lastElementChild?.querySelector('input')?.focus();
  };

  desenharIcones();
  desenharCampos();

  const janela = modalForm({
    titulo: l ? `Configurar · ${l.nome}` : `Novo livro · ${MODULOS[m].titulo}`,
    tamanho: 'grande',
    textoOk: l ? 'Salvar livro' : 'Criar livro',
    conteudo: [
      h('div', { class: 'form-grade' },
        campo('Nome do livro', h('input', { class: 'input', value: s.nome, maxlength: '60', placeholder: 'Ex.: Registro de Nascimentos', oninput: e => { s.nome = e.target.value; } }), { obrigatorio: true }),
        campo('Descrição', h('input', { class: 'input', value: s.descricao, maxlength: '240', placeholder: 'Para que serve este livro', oninput: e => { s.descricao = e.target.value; } }))),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Ícone'), grade),
      interruptor('Registro aberto', s.aberto, v => { s.aberto = v; },
        `Ligado: quem tem permissão de registrar no módulo pode registrar aqui. Desligado: só ${MODULOS[m].quemComanda} e a Família Nobre.`),
      interruptor('Visível para Convidados e Aliados', s.aliados, v => { s.aliados = v; },
        'Ligado: os Aliados (convidados de outras casas, que não são moradores) leem os registros aprovados deste livro. Eles nunca registram, editam ou aprovam.'),
      h('div', { class: 'cfg-cab' },
        h('h3', null, 'Formulário de registro'),
        h('p', { class: 'suave' }, 'Os campos que aparecem ao fazer um registro. Use seções para dividir o formulário em partes. Se remover um campo, o que já foi preenchido nele deixa de aparecer.')),
      listaCampos,
      h('div', { class: 'cfg-adicionar' },
        botao('Adicionar campo', { icone: 'mais', onclick: () => adicionar('campo') }),
        botao('Adicionar seção', { icone: 'secao', onclick: () => adicionar('secao') })),
      m === 'tabelionato' && caixaCobranca,
    ],
    extraRodape: l && botao('Apagar livro', {
      icone: 'lixo', classe: 'btn-perigo-texto',
      onclick: async () => {
        const qtd = l.total ? ` e ${l.total === 1 ? 'o registro dele' : `os ${l.total} registros dele`}` : '';
        if (!await confirmar(`O livro "${l.nome}"${qtd} será apagado para sempre.`, { ok: 'Apagar livro', perigo: true })) return;
        if (await tentar(() => del(`/api/livros/${l.id}`), 'Livro apagado.')) { janela.fechar(); aoApagar?.(); }
      },
    }),
    aoEnviar: async () => {
      if (!s.nome.trim()) throw new Error('Dê um nome ao livro.');
      const semNome = s.campos.find(c => !c.nome.trim());
      if (semNome) throw new Error(semNome.tipo === 'secao' ? 'Toda seção precisa de um título.' : 'Todo campo precisa de um nome.');
      const semLivro = s.campos.find(c => c.tipo === 'referencia' && !c.livro);
      if (semLivro) throw new Error(`Escolha de qual livro o campo "${semLivro.nome}" puxa os nomes.`);
      const semDatas = s.campos.find(c => c.tipo === 'duracao' && (!c.inicio || !c.fim || c.inicio === c.fim));
      if (semDatas) throw new Error(`O campo "${semDatas.nome}" precisa de duas datas diferentes (início e fim).`);
      const semOpcoes = s.campos.find(c => c.tipo === 'selecao' && !c.opcoes.length);
      if (semOpcoes) throw new Error(`O campo "${semOpcoes.nome}" precisa de pelo menos uma opção.`);
      if (s.cobranca?.ativo) {
        if (!s.cobranca.campo) throw new Error('Os pagamentos precisam de um campo de data para começar a contar.');
        if (!(s.cobranca.intervalo >= 1 && s.cobranca.intervalo <= 365)) throw new Error('O intervalo dos pagamentos precisa ser de 1 a 365 dias.');
      }
      if (l) {
        await put(`/api/livros/${l.id}`, s);
        aviso('Livro atualizado.');
        aoSalvar?.(l.id);
      } else {
        const { id } = await post(`/api/modulos/${m}/livros`, s);
        aviso('Livro criado.');
        aoSalvar?.(id);
      }
    },
  });
}
