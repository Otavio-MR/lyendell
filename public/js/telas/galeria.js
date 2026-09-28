import {
  get, put, del, api, reduzirImagem, h, trocar, icone, pode, cabecalho, vazio, botao, botaoIcone, modal, modalForm, confirmar,
  aviso, tentar, campo, dataHora, num,
} from '../core.js';

export async function galeria(albumParam) {
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const consulta = albumParam ? `?album=${albumParam}` : '';
    const [{ albuns, total, semAlbum }, { fotos }] = await Promise.all([
      get('/api/galeria/albuns'),
      get(`/api/galeria/fotos${consulta}`),
    ]);
    const atual = albumParam === 'sem-album'
      ? { nome: 'Sem álbum' }
      : albuns.find(a => String(a.id) === String(albumParam));
    const gerenciar = pode('galeria.gerenciar');

    const aba = (href, nome, n, ativo) => h('a', { class: `aba ${ativo ? 'ativa' : ''}`.trim(), href }, nome, h('span', { class: 'aba-n' }, n));

    trocar(raiz, 
      cabecalho({
        titulo: 'Galeria', icone: 'imagem',
        sub: 'Retratos da capital, dos moradores e dos grandes momentos de Lyendell.',
        acoes: [
          gerenciar && botao('Novo álbum', { icone: 'pasta', onclick: () => formAlbum(null, id => { location.hash = `#/galeria/${id}`; }) }),
          pode('galeria.enviar') && botao('Enviar fotos', { icone: 'enviar', classe: 'btn-ouro', onclick: () => formEnvio(albuns, atual?.id, desenhar) }),
        ],
      }),
      h('div', { class: 'abas abas-rolam' },
        aba('#/galeria', 'Todas', total, !albumParam),
        albuns.map(a => aba(`#/galeria/${a.id}`, a.nome, a.total, String(a.id) === String(albumParam))),
        semAlbum > 0 && aba('#/galeria/sem-album', 'Sem álbum', semAlbum, albumParam === 'sem-album')),
      atual && atual.id && (atual.descricao || gerenciar) ? h('div', { class: 'album-info' },
        atual.descricao && h('p', null, atual.descricao),
        gerenciar && h('div', { class: 'album-acoes' },
          botao('Editar álbum', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formAlbum(atual, desenhar) }),
          botao('Apagar álbum', {
            icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto',
            onclick: async () => {
              if (!await confirmar(`O álbum "${atual.nome}" será apagado. As fotos dele continuam na galeria, sem álbum.`, { ok: 'Apagar álbum', perigo: true })) return;
              if (await tentar(() => del(`/api/galeria/albuns/${atual.id}`), 'Álbum apagado.')) location.hash = '#/galeria';
            },
          }))) : null,
      fotos.length
        ? h('div', { class: 'mosaico' }, fotos.map((f, i) =>
          h('button', { class: 'foto', type: 'button', onclick: () => lightbox(fotos, i, albuns, desenhar) },
            h('img', { src: f.arquivo, alt: f.titulo || 'Foto da galeria', loading: 'lazy' }),
            f.titulo && h('span', { class: 'foto-legenda' }, f.titulo))))
        : vazio('Nenhuma foto aqui ainda', pode('galeria.enviar') ? 'Envie a primeira foto clicando em "Enviar fotos".' : 'Quando alguém enviar fotos, elas aparecem aqui.'));
  }

  await desenhar();
  return raiz;
}

function lightbox(fotos, inicio, albuns, recarregar) {
  let i = inicio;
  const img = h('img', { class: 'lb-img', alt: '' });
  const info = h('div', { class: 'lb-info' });
  const palco = h('div', { class: 'lb-palco' },
    botaoIcone('voltar', 'Foto anterior', () => ir(-1), 'lb-nav lb-ant'),
    img,
    botaoIcone('frente', 'Próxima foto', () => ir(1), 'lb-nav lb-prox'));

  const janela = modal({ corpo: h('div', { class: 'lb' }, palco, info), classe: 'modal-lb', tamanho: 'grande' });

  function ir(passo) {
    i = (i + passo + fotos.length) % fotos.length;
    desenhar();
  }

  function desenhar() {
    const f = fotos[i];
    img.src = f.arquivo;
    img.alt = f.titulo || 'Foto da galeria';
    const album = albuns.find(a => a.id === f.album_id);
    trocar(info, 
      h('div', { class: 'lb-texto' },
        h('h3', null, f.titulo || 'Sem título'),
        f.descricao && h('p', null, f.descricao),
        h('small', { class: 'suave' },
          `Enviada por ${f.enviado_por_nome || 'desconhecido'} em ${dataHora(f.enviado_em)}`,
          album ? ` · Álbum: ${album.nome}` : '',
          fotos.length > 1 ? ` · ${i + 1} de ${num(fotos.length)}` : '')),
      h('div', { class: 'lb-acoes' },
        f.podeMexer && botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formFoto(f, albuns, () => { janela.fechar(); recarregar(); }) }),
        f.podeMexer && botao('Apagar', {
          icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto',
          onclick: async () => {
            if (!await confirmar('Esta foto será apagada para sempre.', { ok: 'Apagar', perigo: true })) return;
            if (await tentar(() => del(`/api/galeria/fotos/${f.id}`), 'Foto apagada.')) { janela.fechar(); recarregar(); }
          },
        }),
        h('a', { class: 'btn btn-pequeno', href: f.arquivo, target: '_blank', rel: 'noopener' }, icone('olho'), h('span', null, 'Tamanho real')),
        botao('Fechar', { classe: 'btn-pequeno', onclick: () => janela.fechar() })));
    palco.querySelectorAll('.lb-nav').forEach(b => { b.hidden = fotos.length < 2; });
  }

  const teclas = e => {
    if (!document.body.contains(janela.caixa)) { document.removeEventListener('keydown', teclas); return; }
    if (e.key === 'ArrowLeft') ir(-1);
    if (e.key === 'ArrowRight') ir(1);
  };
  document.addEventListener('keydown', teclas);
  desenhar();
}

function seletorAlbum(albuns, atual) {
  return h('select', { class: 'input', name: 'album_id' },
    h('option', { value: '' }, 'Sem álbum'),
    albuns.map(a => h('option', { value: String(a.id), selected: a.id === atual }, a.nome)));
}

function formEnvio(albuns, albumAtual, depois) {
  const arquivos = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', multiple: true, hidden: true });
  const previas = h('div', { class: 'envio-previas' });
  const titulo = h('input', { class: 'input', maxlength: '100', placeholder: 'Ex.: Festa da colheita na praça' });
  const descricao = h('textarea', { class: 'input', rows: '3', maxlength: '500' });
  const album = seletorAlbum(albuns, albumAtual);
  const escolher = h('button', { class: 'envio-soltar', type: 'button', onclick: () => arquivos.click() },
    icone('enviar'), h('strong', null, 'Escolher imagens'), h('small', null, 'PNG, JPG, GIF ou WEBP. Pode escolher várias; fotos grandes são reduzidas automaticamente.'));

  let lista = [];
  const mostrar = () => {
    trocar(previas, ...lista.map(f => {
      const url = URL.createObjectURL(f);
      const img = h('img', { src: url, alt: f.name });
      img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      return img;
    }));
    escolher.querySelector('strong').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'imagem escolhida' : 'imagens escolhidas'}` : 'Escolher imagens';
  };
  arquivos.addEventListener('change', () => { lista = [...arquivos.files]; mostrar(); });

  modalForm({
    titulo: 'Enviar fotos',
    tamanho: 'medio',
    textoOk: 'Enviar',
    conteudo: [
      escolher, arquivos, previas,
      campo('Título', titulo, { ajuda: 'Opcional. Se enviar várias, todas recebem este título.' }),
      campo('Descrição', descricao),
      campo('Álbum', album),
    ],
    aoEnviar: async (form, janela) => {
      if (!lista.length) throw new Error('Escolha pelo menos uma imagem.');
      let enviadas = 0;
      for (const f of lista) {
        const fd = new FormData();
        fd.append('titulo', titulo.value);
        fd.append('descricao', descricao.value);
        fd.append('album_id', album.value);
        fd.append('arquivo', await reduzirImagem(f));
        try {
          await api('POST', '/api/galeria/fotos', fd);
          enviadas++;
        } catch (e) {
          janela.mostrarErro(`"${f.name}": ${e.message}`);
          if (enviadas) { aviso(`${enviadas} foto(s) enviada(s).`); depois(); }
          lista = lista.slice(enviadas);
          mostrar();
          return false;
        }
      }
      aviso(enviadas === 1 ? 'Foto enviada.' : `${enviadas} fotos enviadas.`);
      depois();
    },
  });
}

function formFoto(f, albuns, depois) {
  const titulo = h('input', { class: 'input', maxlength: '100', value: f.titulo });
  const descricao = h('textarea', { class: 'input', rows: '3', maxlength: '500' }, f.descricao);
  const album = seletorAlbum(albuns, f.album_id);
  modalForm({
    titulo: 'Editar foto',
    conteudo: [campo('Título', titulo), campo('Descrição', descricao), campo('Álbum', album)],
    aoEnviar: async () => {
      await put(`/api/galeria/fotos/${f.id}`, { titulo: titulo.value, descricao: descricao.value, album_id: album.value || null });
      aviso('Foto atualizada.');
      depois();
    },
  });
}

function formAlbum(a, depois) {
  const nome = h('input', { class: 'input', maxlength: '60', value: a?.nome || '', placeholder: 'Ex.: Construção do castelo' });
  const descricao = h('textarea', { class: 'input', rows: '3', maxlength: '300' }, a?.descricao || '');
  modalForm({
    titulo: a ? 'Editar álbum' : 'Novo álbum',
    textoOk: a ? 'Salvar' : 'Criar álbum',
    conteudo: [campo('Nome', nome, { obrigatorio: true }), campo('Descrição', descricao)],
    aoEnviar: async () => {
      if (!nome.value.trim()) throw new Error('Dê um nome ao álbum.');
      if (a) {
        await put(`/api/galeria/albuns/${a.id}`, { nome: nome.value, descricao: descricao.value });
        aviso('Álbum atualizado.');
        depois();
      } else {
        const { id } = await api('POST', '/api/galeria/albuns', { nome: nome.value, descricao: descricao.value });
        aviso('Álbum criado.');
        depois(id);
      }
    },
  });
}
