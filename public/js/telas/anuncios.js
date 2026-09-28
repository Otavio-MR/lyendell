import {
  estado, get, post, put, del, h, trocar, icone, pode, cabecalho, vazio, botao, modal, modalForm, confirmar,
  aviso, tentar, campo, avatar, dataHora, relativo,
} from '../core.js';
import { entradaImagem } from './livros.js';
import { livroDeAnuncio } from '../livro-mc.js';

const IMPORTANCIAS = [
  ['comum', 'Comum'],
  ['importante', 'Importante'],
  ['urgente', 'Urgente'],
];

export async function anuncios() {
  const raiz = h('div', { class: 'pagina pagina-estreita' });

  async function desenhar() {
    const { anuncios: lista } = await get('/api/anuncios');
    trocar(raiz, 
      cabecalho({
        titulo: 'Mural de Anúncios', icone: 'megafone',
        sub: 'Avisos, decretos e novidades da cidade de Lyendell.',
        acoes: [pode('anuncios.publicar') && botao('Novo anúncio', { icone: 'mais', classe: 'btn-ouro', onclick: () => formAnuncio(null, desenhar) })],
      }),
      lista.length
        ? h('div', { class: 'mural' }, lista.map(a => cartao(a, desenhar)))
        : vazio('O mural está vazio', pode('anuncios.publicar') ? 'Publique o primeiro anúncio da cidade.' : 'Quando houver anúncios, eles aparecem aqui.'));
  }

  await desenhar();
  return raiz;
}

function cartao(a, recarregar) {
  const moderar = pode('anuncios.moderar');
  return h('article', { class: `anuncio imp-${a.importancia} ${a.fixado ? 'fixado' : ''}`.trim() },
    h('header', { class: 'anuncio-cab' },
      h('div', { class: 'anuncio-etiquetas' },
        a.fixado && h('span', { class: 'etiqueta etiqueta-ouro' }, icone('alfinete'), 'Fixado'),
        a.importancia !== 'comum' && h('span', { class: `etiqueta imp-${a.importancia}` }, a.importancia === 'urgente' ? 'Urgente' : 'Importante')),
      h('h2', null, a.titulo),
      h('p', { class: 'anuncio-autor' }, avatar(a.autor_nome, 'avatar-p'),
        h('span', null, h('strong', null, a.autor_nome || 'desconhecido'), ' · ',
          h('span', { title: dataHora(a.criado_em) }, relativo(a.criado_em)),
          a.editado_em ? ' · editado' : ''))),
    a.conteudo && h('div', { class: 'texto-livre anuncio-texto' }, a.conteudo),
    a.imagem && h('button', { class: 'anuncio-img', type: 'button', onclick: () => modal({ corpo: h('img', { src: a.imagem, alt: a.titulo, class: 'img-cheia' }), classe: 'modal-lb', tamanho: 'grande' }) },
      h('img', { src: a.imagem, alt: a.titulo, loading: 'lazy' })),
    h('footer', { class: 'anuncio-acoes' },
      botao('Baixar .book', {
        icone: 'baixar', classe: 'btn-pequeno btn-fantasma', titulo: 'Baixa o anúncio como livro para o mod Scribble',
        onclick: () => livroDeAnuncio(a, estado.eu.nome).baixar(),
      }),
      h('span', { class: 'espaco' }),
      moderar && botao(a.fixado ? 'Desafixar' : 'Fixar no topo', {
        icone: 'alfinete', classe: 'btn-pequeno btn-fantasma',
        onclick: async () => { if (await tentar(() => post(`/api/anuncios/${a.id}/fixar`, { fixado: !a.fixado }))) recarregar(); },
      }),
      a.podeMexer && botao('Editar', { icone: 'editar', classe: 'btn-pequeno btn-fantasma', onclick: () => formAnuncio(a, recarregar) }),
      a.podeMexer && botao('Apagar', {
        icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto',
        onclick: async () => {
          if (!await confirmar(`O anúncio "${a.titulo}" será apagado.`, { ok: 'Apagar', perigo: true })) return;
          if (await tentar(() => del(`/api/anuncios/${a.id}`), 'Anúncio apagado.')) recarregar();
        },
      })));
}

function formAnuncio(a, depois) {
  const s = { titulo: a?.titulo || '', conteudo: a?.conteudo || '', importancia: a?.importancia || 'comum', imagem: a?.imagem || '', fixado: false };
  const envio = { n: 0 };
  const opcoesImp = h('div', { class: 'segmentado', role: 'radiogroup', 'aria-label': 'Importância' });
  const desenharImp = () => trocar(opcoesImp, ...IMPORTANCIAS.map(([v, n]) =>
    h('button', { type: 'button', class: `seg imp-${v} ${s.importancia === v ? 'ativo' : ''}`.trim(), 'aria-pressed': String(s.importancia === v), onclick: () => { s.importancia = v; desenharImp(); } }, n)));
  desenharImp();

  modalForm({
    titulo: a ? 'Editar anúncio' : 'Novo anúncio',
    tamanho: 'medio',
    textoOk: a ? 'Salvar' : 'Publicar',
    conteudo: [
      campo('Título', h('input', { class: 'input', value: s.titulo, maxlength: '120', placeholder: 'Ex.: Feira de trocas no sábado', oninput: e => { s.titulo = e.target.value; } }), { obrigatorio: true }),
      campo('Mensagem', h('textarea', { class: 'input', rows: '6', maxlength: '5000', oninput: e => { s.conteudo = e.target.value; } }, s.conteudo)),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Importância'), opcoesImp),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Imagem (opcional)'), entradaImagem(s.imagem, v => { s.imagem = v; }, envio)),
      !a && pode('anuncios.moderar') && h('label', { class: 'marcador' },
        h('input', { type: 'checkbox', onchange: e => { s.fixado = e.target.checked; } }), h('span', null, 'Fixar no topo do mural')),
    ],
    aoEnviar: async () => {
      if (envio.n) throw new Error('Espere a imagem terminar de enviar.');
      if (!s.titulo.trim()) throw new Error('Dê um título ao anúncio.');
      const corpo = { ...s, imagem: s.imagem || null };
      if (a) await put(`/api/anuncios/${a.id}`, corpo);
      else await post('/api/anuncios', corpo);
      aviso(a ? 'Anúncio atualizado.' : 'Anúncio publicado.');
      depois();
    },
  });
}
