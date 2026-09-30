// Tela da trilha sonora: o rádio da Casa, as playlists do Spotify/YouTube e (para quem cuida) adicionar músicas.

import { h, trocar, icone, botao, botaoIcone, cabecalho, vazio, campo, aviso, confirmar, api, post, put, del, tentar, modalForm, aoSair } from '../core.js';
import { trilha, ouvirTrilha, carregarTrilha, tocar, pausar, abrirExterna, fecharExterna, linkOriginal, musicaAtual } from '../trilha.js';

const FONTES = [
  { nome: 'Pixabay Music', url: 'https://pixabay.com/music/search/medieval/', texto: 'Grátis, sem precisar dar crédito. Procure por "medieval" ou "tavern".' },
  { nome: 'Kevin MacLeod (incompetech)', url: 'https://incompetech.com/music/royalty-free/music.html', texto: 'Grátis, mas pede crédito: coloque "Kevin MacLeod (incompetech.com), CC BY 4.0" no campo Crédito.' },
  { nome: 'OpenGameArt', url: 'https://opengameart.org/art-search-advanced?keys=medieval&field_art_type_tid%5B%5D=12', texto: 'Músicas de jogos, muitas em domínio público (CC0).' },
];

export async function paginaTrilha() {
  await carregarTrilha();
  const raiz = h('div', { class: 'pagina' });
  aoSair(ouvirTrilha(desenhar));

  function linhaMusica(m, i) {
    const atual = musicaAtual()?.id === m.id;
    const tocandoEsta = atual && trilha.tocando;
    return h('li', { class: `trilha-item ${atual ? 'atual' : ''}`.trim() },
      h('button', { class: 'btn-icone trilha-play', type: 'button', title: tocandoEsta ? 'Pausar' : 'Tocar', 'aria-label': tocandoEsta ? 'Pausar' : 'Tocar', onclick: () => (tocandoEsta ? pausar() : tocar(i)) },
        icone(tocandoEsta ? 'pausa' : 'play')),
      h('div', { class: 'trilha-texto' },
        h('strong', null, m.titulo),
        h('small', null, [m.autor, m.tipo === 'link' ? 'link direto' : null].filter(Boolean).join(' · ') || 'Trilha de Lyendell'),
        m.credito && h('small', { class: 'trilha-credito' }, m.credito)),
      trilha.podeGerenciar && acoesDe(m, i, trilha.fila));
  }

  function acoesDe(m, i, lista) {
    return h('div', { class: 'trilha-acoes' },
      botaoIcone('cima', 'Subir', () => mover(lista, i, -1)),
      botaoIcone('baixo', 'Descer', () => mover(lista, i, 1)),
      botaoIcone('editar', 'Editar', () => editar(m)),
      botaoIcone('lixo', 'Tirar da trilha', async () => {
        if (!await confirmar(`Tirar "${m.titulo}" da trilha sonora?`, { ok: 'Tirar', perigo: true })) return;
        if (await tentar(() => del(`/api/trilha/${m.id}`), 'Música tirada da trilha.')) await carregarTrilha();
      }, 'perigo'));
  }

  async function mover(lista, i, passo) {
    const j = i + passo;
    if (j < 0 || j >= lista.length) return;
    const ordem = [...trilha.fila, ...trilha.externas];
    const a = ordem.indexOf(lista[i]);
    const b = ordem.indexOf(lista[j]);
    [ordem[a], ordem[b]] = [ordem[b], ordem[a]];
    if (await tentar(() => post('/api/trilha/ordem', { ids: ordem.map(x => x.id) }))) await carregarTrilha();
  }

  function editar(m) {
    const titulo = h('input', { class: 'input', value: m.titulo, maxlength: '100' });
    const autor = h('input', { class: 'input', value: m.autor, maxlength: '80' });
    const credito = h('input', { class: 'input', value: m.credito, maxlength: '200' });
    modalForm({
      titulo: 'Editar música',
      conteudo: [campo('Título', titulo), campo('Artista ou autor', autor), campo('Crédito', credito, { ajuda: 'Algumas músicas grátis pedem o nome do autor e a licença.' })],
      async aoEnviar() {
        await put(`/api/trilha/${m.id}`, { titulo: titulo.value, autor: autor.value, credito: credito.value });
        await carregarTrilha();
      },
    });
  }

  function cartaoExterna(m, i) {
    const aberta = trilha.externaAberta === m.id;
    return h('article', { class: `trilha-externa ${m.tipo}` },
      h('span', { class: 'trilha-marca' }, m.tipo === 'spotify' ? 'Spotify' : 'YouTube'),
      h('strong', null, m.titulo),
      m.autor && h('small', { class: 'suave' }, m.autor),
      h('div', { class: 'trilha-externa-botoes' },
        botao(aberta ? 'Fechar' : 'Ouvir aqui', { icone: aberta ? 'x' : 'play', classe: 'btn-ouro btn-pequeno', onclick: () => (aberta ? fecharExterna() : abrirExterna(m)) }),
        h('a', { class: 'btn btn-pequeno', href: linkOriginal(m), target: '_blank', rel: 'noopener' }, `Abrir no ${m.tipo === 'spotify' ? 'Spotify' : 'YouTube'}`)),
      trilha.podeGerenciar && acoesDe(m, i, trilha.externas));
  }

  function formularioNovo() {
    let modo = 'arquivo';
    const caixa = h('div');
    const desenharForm = () => {
      const erroEl = h('p', { class: 'form-erro', hidden: true });
      const titulo = h('input', { class: 'input', maxlength: '100', placeholder: modo === 'arquivo' ? 'Se deixar em branco, usa o nome do arquivo' : 'Ex.: Taverna do Coelho' });
      const autor = h('input', { class: 'input', maxlength: '80', placeholder: 'Ex.: Kevin MacLeod' });
      const credito = h('input', { class: 'input', maxlength: '200', placeholder: 'Ex.: Kevin MacLeod (incompetech.com), CC BY 4.0' });
      const arquivo = h('input', { class: 'input', type: 'file', accept: 'audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/webm,.mp3,.ogg,.m4a,.webm,.opus' });
      const url = h('input', { class: 'input', type: 'url', placeholder: 'https://open.spotify.com/playlist/... ou https://www.youtube.com/watch?v=...' });
      const enviar = botao(modo === 'arquivo' ? 'Enviar música' : 'Adicionar', { classe: 'btn-ouro', tipo: 'submit', icone: 'mais' });
      const form = h('form', { class: 'form', novalidate: true },
        modo === 'arquivo'
          ? campo('Arquivo da música', arquivo, { ajuda: 'MP3, OGG, M4A ou WEBM, até 8 MB (uns 6 minutos de música).' })
          : campo('Link', url, { ajuda: 'Playlist, álbum ou música do Spotify; vídeo ou playlist do YouTube; ou o link direto de um arquivo de áudio (ex.: archive.org).' }),
        h('div', { class: 'form-grade' }, campo('Título', titulo), campo('Artista ou autor', autor)),
        campo('Crédito', credito, { ajuda: 'Só se a licença pedir (como as do Kevin MacLeod).' }),
        erroEl,
        h('div', null, enviar));
      form.addEventListener('submit', async e => {
        e.preventDefault();
        erroEl.hidden = true;
        enviar.disabled = true;
        enviar.classList.add('carregando');
        try {
          if (modo === 'arquivo') {
            if (!arquivo.files[0]) throw new Error('Escolha o arquivo da música.');
            if (arquivo.files[0].size > 8 * 1024 * 1024) throw new Error('Esse arquivo passa de 8 MB. Tente uma versão menor (128 kbps já fica bom).');
            const fd = new FormData();
            fd.append('arquivo', arquivo.files[0]);
            fd.append('titulo', titulo.value);
            fd.append('autor', autor.value);
            fd.append('credito', credito.value);
            await api('POST', '/api/trilha/arquivo', fd);
          } else {
            await post('/api/trilha/link', { url: url.value, titulo: titulo.value, autor: autor.value, credito: credito.value });
          }
          aviso('Adicionada à trilha sonora.');
          await carregarTrilha();
        } catch (err) {
          erroEl.textContent = err.message;
          erroEl.hidden = false;
        } finally {
          enviar.disabled = false;
          enviar.classList.remove('carregando');
        }
      });
      trocar(caixa,
        h('div', { class: 'segmentado' },
          h('button', { class: `seg ${modo === 'arquivo' ? 'ativo' : ''}`, type: 'button', onclick: () => { modo = 'arquivo'; desenharForm(); } }, 'Enviar arquivo'),
          h('button', { class: `seg ${modo === 'link' ? 'ativo' : ''}`, type: 'button', onclick: () => { modo = 'link'; desenharForm(); } }, 'Colar link')),
        form);
    };
    desenharForm();
    return h('section', { class: 'painel' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('mais'), 'Adicionar à trilha')),
      caixa,
      h('div', { class: 'trilha-fontes' },
        h('h3', null, 'Onde achar música medieval grátis'),
        h('ul', null, FONTES.map(f => h('li', null,
          h('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.nome), ': ', f.texto)))));
  }

  const formulario = trilha.podeGerenciar ? formularioNovo() : null;

  function desenhar() {
    trocar(raiz,
      cabecalho({ titulo: 'Trilha sonora', icone: 'musica', sub: 'Música medieval para acompanhar a visita. O rádio da Casa continua tocando enquanto você navega pelo site.' }),
      h('div', { class: 'trilha-grade' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('musica'), 'Rádio da Casa'), trilha.fila.length > 0 && h('small', { class: 'suave' }, `${trilha.fila.length} ${trilha.fila.length === 1 ? 'música' : 'músicas'}`)),
          trilha.fila.length
            ? h('ol', { class: 'trilha-lista' }, trilha.fila.map(linhaMusica))
            : vazio('O rádio ainda está vazio', trilha.podeGerenciar
              ? 'Envie arquivos de música (MP3) ou cole links diretos de áudio. Eles tocam para todo mundo, de graça e sem anúncio.'
              : 'Quando a Casa colocar músicas, elas aparecem aqui. Enquanto isso, ouça as playlists ao lado.')),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('estrela'), 'Playlists')),
          trilha.externas.length
            ? h('div', { class: 'trilha-externas' }, trilha.externas.map(cartaoExterna))
            : h('p', { class: 'painel-vazio' }, 'Nenhuma playlist ainda.'),
          h('p', { class: 'suave trilha-nota' }, 'No Spotify, quem está logado ouve as músicas inteiras; sem login, o Spotify toca só 30 segundos de cada uma. O YouTube pode mostrar anúncios.'))),
      formulario);
  }
  desenhar();
  return raiz;
}
