import {
  estado, get, post, api, del, h, trocar, icone, cabecalho, campo, aviso, tentar, confirmar, avatar, chipCargo, botao, recortarAvatar,
} from '../core.js';

export async function perfil() {
  const eu = estado.eu;
  const { catalogo } = await get('/api/auth/catalogo');
  const minhas = new Set(eu.permissoes);

  const atual = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const nova = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', maxlength: '100' });
  const repetir = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', maxlength: '100' });
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const salvar = botao('Trocar senha', { classe: 'btn-ouro', tipo: 'submit' });

  const form = h('form', { class: 'form', novalidate: true },
    campo('Senha atual', atual),
    campo('Nova senha', nova, { ajuda: 'Mínimo de 4 caracteres.' }),
    campo('Repita a nova senha', repetir),
    erroEl,
    h('div', null, salvar));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    erroEl.hidden = true;
    const falha = msg => { erroEl.textContent = msg; erroEl.hidden = false; };
    if (nova.value.length < 4) return falha('A nova senha precisa ter pelo menos 4 caracteres.');
    if (nova.value !== repetir.value) return falha('As duas senhas novas não são iguais.');
    salvar.disabled = true;
    try {
      await post('/api/auth/senha', { atual: atual.value, nova: nova.value });
      form.reset();
      aviso('Senha trocada. Outros aparelhos conectados foram desconectados.');
    } catch (err) {
      falha(err.message);
    } finally {
      salvar.disabled = false;
    }
  });

  /* Foto de perfil */
  const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
  const caixaFoto = h('div', { class: 'perfil-foto' });

  function desenharFoto(enviando = false) {
    trocar(caixaFoto,
      h('button', { class: 'perfil-foto-botao', type: 'button', title: 'Trocar foto', disabled: enviando, onclick: () => arquivo.click() },
        avatar(eu.nome, 'avatar-g', eu.foto),
        h('span', { class: 'perfil-foto-camada' }, enviando ? h('span', { class: 'giro giro-p' }) : icone('editar'))),
      h('div', { class: 'perfil-foto-acoes' },
        botao(eu.foto ? 'Trocar foto' : 'Colocar foto', { icone: 'imagem', classe: 'btn-pequeno', desativado: enviando, onclick: () => arquivo.click() }),
        eu.foto && !enviando && botao('Remover', {
          classe: 'btn-pequeno btn-fantasma',
          onclick: async () => {
            if (!await confirmar('Sua foto de perfil será removida e as suas iniciais voltam a aparecer.', { ok: 'Remover foto' })) return;
            if (await tentar(() => del('/api/auth/foto'), 'Foto removida.')) atualizarFoto(null);
          },
        })),
      arquivo);
  }

  function atualizarFoto(url) {
    eu.foto = url;
    window.dispatchEvent(new Event('perfil-atualizado'));
    desenharFoto();
  }

  arquivo.addEventListener('change', async () => {
    const f = arquivo.files[0];
    arquivo.value = '';
    if (!f) return;
    desenharFoto(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', await recortarAvatar(f));
      const { foto } = await api('POST', '/api/auth/foto', fd);
      aviso('Foto de perfil atualizada.');
      atualizarFoto(foto);
    } catch (e) {
      aviso(e.message, 'erro');
      desenharFoto();
    }
  });

  desenharFoto();

  const cargos = eu.is_root
    ? [h('span', { class: 'chip chip-ouro' }, icone('coroa'), 'Administrador')]
    : eu.cargos.length ? eu.cargos.map(chipCargo) : [h('span', { class: 'chip' }, 'Morador')];

  return h('div', { class: 'pagina pagina-estreita' },
    cabecalho({ titulo: 'Meu perfil', icone: 'usuario' }),
    h('section', { class: 'painel perfil-topo' },
      caixaFoto,
      h('div', null,
        h('h2', null, eu.nome),
        h('div', { class: 'chips' }, cargos),
        h('p', { class: 'suave' }, 'Todo usuário também é morador de Lyendell. A foto é recortada em quadrado automaticamente.'))),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('chave'), 'O que você pode fazer')),
      h('div', { class: 'perm-grade' }, catalogo.map(g => {
        const tenho = g.itens.filter(i => minhas.has(i.chave));
        return h('div', { class: 'perm-grupo' },
          h('h3', null, g.grupo),
          tenho.length
            ? h('ul', { class: 'lista-check' }, tenho.map(i => h('li', null, icone('check'), i.nome)))
            : h('p', { class: 'suave' }, 'Sem acesso.'));
      }))),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('cadeado'), 'Trocar senha')),
      form));
}
