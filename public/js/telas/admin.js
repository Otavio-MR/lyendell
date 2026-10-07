import {
  estado, get, post, put, del, h, trocar, icone, pode, cabecalho, vazio, botao, modal, modalForm, confirmar,
  aviso, tentar, campo, interruptor, avatar, chipCargo, chipCrianca, dataHora, relativo, num, normalizar,
} from '../core.js';

/* ─── Usuários ────────────────────────────────────── */

export async function usuarios() {
  const raiz = h('div', { class: 'pagina' });
  let busca = '';

  async function desenhar() {
    const [{ usuarios: lista, concediveis }, { cargos }] = await Promise.all([get('/api/usuarios'), get('/api/cargos')]);
    const porId = new Map(cargos.map(c => [c.id, c]));
    const corpo = h('tbody');

    const filtrar = () => {
      const q = normalizar(busca.trim());
      const visiveis = lista.filter(u => !q || normalizar(u.nome).includes(q) || u.cargos.some(id => normalizar(porId.get(id)?.nome).includes(q)));
      trocar(corpo, ...visiveis.map(u => linha(u)));
    };

    const linha = u => {
      const chips = u.is_root
        ? [h('span', { class: 'chip chip-ouro' }, icone('coroa'), 'Administrador')]
        : u.cargos.length ? u.cargos.map(id => porId.get(id)).filter(Boolean).map(chipCargo) : [h('span', { class: 'chip' }, 'Morador')];
      if (u.crianca) chips.unshift(chipCrianca());
      const eu = u.id === estado.eu.id;
      return h('tr', { class: u.ativo ? '' : 'inativo' },
        h('td', { 'data-rotulo': 'Personagem' }, h('span', { class: 'pessoa' }, avatar(u.nome, 'avatar-p', u.foto), h('strong', null, u.nome), eu && h('small', { class: 'suave' }, ' (você)'))),
        h('td', { 'data-rotulo': 'Cargos' }, h('div', { class: 'chips' }, chips)),
        h('td', { 'data-rotulo': 'Situação' }, u.ativo ? h('span', { class: 'status st-aberta' }, 'Ativo') : h('span', { class: 'status st-encerrada' }, 'Desativado')),
        h('td', { 'data-rotulo': 'Último acesso', class: 'suave', title: dataHora(u.ultimo_acesso) }, u.ultimo_acesso ? relativo(u.ultimo_acesso) : 'nunca entrou'),
        h('td', { class: 'acoes-linha' },
          u.gerenciavel && pode('usuarios.editar') && botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formUsuario(u, cargos, concediveis, desenhar) }),
          u.gerenciavel && pode('usuarios.remover') && !u.is_root && !eu && botao('Remover', {
            icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto',
            onclick: async () => {
              if (!await confirmar(`${u.nome} perderá o acesso ao sistema. O que essa pessoa registrou continua guardado.`, { titulo: 'Remover usuário?', ok: 'Remover', perigo: true })) return;
              if (await tentar(() => del(`/api/usuarios/${u.id}`), 'Usuário removido.')) desenhar();
            },
          })));
    };

    trocar(raiz, 
      cabecalho({
        titulo: 'Usuários', icone: 'usuarios',
        sub: 'Quem tem acesso ao sistema. O login é o nome do personagem; o cargo define o que cada um pode fazer.',
        acoes: [pode('usuarios.criar') && botao('Novo usuário', { icone: 'mais', classe: 'btn-ouro', onclick: () => formUsuario(null, cargos, concediveis, desenhar) })],
      }),
      h('div', { class: 'ferramentas' },
        h('label', { class: 'busca' }, icone('busca'),
          h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nome ou cargo', value: busca, oninput: e => { busca = e.target.value; filtrar(); } })),
        h('span', { class: 'contador' }, `${num(lista.length)} ${lista.length === 1 ? 'usuário' : 'usuários'}`)),
      h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela tabela-responsiva' },
        h('thead', null, h('tr', null, h('th', null, 'Personagem'), h('th', null, 'Cargos'), h('th', null, 'Situação'), h('th', null, 'Último acesso'), h('th', null, ''))),
        corpo)));
    filtrar();
  }

  await desenhar();
  return raiz;
}

function formUsuario(u, cargos, concediveis, depois) {
  const eu = u?.id === estado.eu.id;
  const s = { nome: u?.nome || '', senha: '', cargos: new Set(u?.cargos || []), ativo: u ? u.ativo : true, crianca: !!u?.crianca };
  const podeConceder = new Set(concediveis);
  // Quem tem um cargo que "não é morador" (como os Aliados) não recebe o cargo base (Morador).
  const naoMorador = () => cargos.some(c => c.exclui_base && s.cargos.has(c.id));
  let caixaBase = null;

  const listaCargos = h('div', { class: 'cargos-escolha' },
    cargos.map(c => {
      const base = c.base;
      const bloqueado = base || !podeConceder.has(c.id) || u?.is_root;
      const caixa = h('input', {
        type: 'checkbox', checked: base ? !naoMorador() : s.cargos.has(c.id), disabled: bloqueado,
        onchange: e => {
          if (e.target.checked) s.cargos.add(c.id); else s.cargos.delete(c.id);
          if (caixaBase) caixaBase.checked = !naoMorador();
        },
      });
      if (base) caixaBase = caixa;
      return h('label', { class: `cargo-opcao ${bloqueado ? 'bloqueado' : ''}`.trim(), style: { '--cor': c.cor }, title: !base && !podeConceder.has(c.id) ? 'Este cargo tem poderes que você não tem' : '' },
        caixa,
        h('span', { class: 'cargo-opcao-texto' },
          h('strong', null, c.nome),
          h('small', null, base ? 'Todo usuário é morador, menos quem tem um cargo que não é morador (como os Aliados).' : c.descricao)));
    }));

  const senha = h('input', { class: 'input', type: 'text', autocomplete: 'new-password', maxlength: '100', oninput: e => { s.senha = e.target.value; } });

  // Para tirar uma foto de perfil imprópria de outra pessoa.
  const fotoLinha = u?.foto && !eu ? h('div', { class: 'foto-admin' },
    avatar(u.nome, '', u.foto),
    h('span', { class: 'suave' }, 'Foto de perfil'),
    botao('Remover foto', {
      classe: 'btn-pequeno btn-perigo-texto',
      onclick: async () => {
        if (!await confirmar(`A foto de perfil de ${u.nome} será removida.`, { ok: 'Remover foto', perigo: true })) return;
        if (await tentar(() => del(`/api/usuarios/${u.id}/foto`), 'Foto removida.')) { fotoLinha.remove(); depois(); }
      },
    })) : null;

  modalForm({
    titulo: u ? `Editar · ${u.nome}` : 'Novo usuário',
    tamanho: 'medio',
    textoOk: u ? 'Salvar' : 'Criar usuário',
    conteudo: [
      fotoLinha,
      h('div', { class: 'form-grade' },
        campo('Nome do personagem', h('input', { class: 'input', value: s.nome, maxlength: '40', placeholder: 'Ex.: Alianor Bulton Luckham', autocomplete: 'off', oninput: e => { s.nome = e.target.value; } }),
          { obrigatorio: true, ajuda: 'É o login. Maiúsculas e minúsculas não importam.' }),
        campo(u ? 'Nova senha' : 'Senha', senha, { obrigatorio: !u, ajuda: u ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 4 caracteres. Passe para a pessoa em particular.' })),
      !u?.is_root && interruptor('Personagem criança', s.crianca, v => { s.crianca = v; },
        'Pode ter cargo (até Família Nobre), mas só olha, brinca, conversa e ajuda nas atividades: não registra, não edita, não apaga e não aprova nada. O site aparece para ele do jeito de uma criança.'),
      !u?.is_root && h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Cargos'), listaCargos),
      u && !u.is_root && !eu && interruptor('Acesso ativo', s.ativo, v => { s.ativo = v; }, 'Desligado, a pessoa não consegue entrar, mas nada do que ela fez é apagado.'),
    ],
    aoEnviar: async () => {
      if (s.nome.trim().length < 2) throw new Error('Informe o nome do personagem.');
      if (!u && s.senha.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.');
      const corpo = { nome: s.nome };
      if (s.senha) corpo.senha = s.senha;
      if (!u?.is_root) { corpo.cargos = [...s.cargos]; corpo.crianca = s.crianca; }
      if (u && !u.is_root && !eu) corpo.ativo = s.ativo;
      if (u) await put(`/api/usuarios/${u.id}`, corpo);
      else await post('/api/usuarios', { ...corpo, senha: s.senha });
      aviso(u ? 'Usuário atualizado.' : `${s.nome.trim()} já pode entrar no sistema.`);
      if (eu) estado.eu = await get('/api/auth/me');
      depois();
    },
  });
}

/* ─── Cargos ──────────────────────────────────────── */

export async function cargos() {
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const { cargos: lista, catalogo, exclusivas = [] } = await get('/api/cargos');
    const extra = { lista, exclusivas };
    const gerenciar = pode('cargos.gerenciar');
    trocar(raiz, 
      cabecalho({
        titulo: 'Cargos', icone: 'chave',
        sub: gerenciar
          ? 'Cada cargo libera partes do sistema. Uma pessoa pode ter vários cargos: ela soma os poderes de todos.'
          : 'O que cada cargo pode fazer no sistema. Só o administrador altera os cargos.',
        acoes: [gerenciar && botao('Novo cargo', { icone: 'mais', classe: 'btn-ouro', onclick: () => formCargo(null, catalogo, desenhar, false, extra) })],
      }),
      h('div', { class: 'grade-cargos' }, lista.map(c => {
        const nomes = new Map(catalogo.flatMap(g => g.itens.map(i => [i.chave, g.grupo])));
        const grupos = [...new Set(c.permissoes.map(p => nomes.get(p)).filter(Boolean))];
        return h('button', { class: 'cargo-card', type: 'button', style: { '--cor': c.cor }, onclick: () => formCargo(c, catalogo, desenhar, !gerenciar, extra) },
          h('div', { class: 'cargo-card-topo' },
            h('h3', null, c.nome),
            c.base && h('span', { class: 'etiqueta' }, 'Base de todos'),
            c.exclui_base && h('span', { class: 'etiqueta etiqueta-aliados', title: 'Quem tem este cargo não recebe as permissões do Morador' }, 'Não é morador')),
          h('p', null, c.descricao),
          h('div', { class: 'cargo-card-rodape' },
            h('span', null, icone('usuarios'), c.base ? `Todos os moradores (${c.usuarios})` : `${c.usuarios} ${c.usuarios === 1 ? 'pessoa' : 'pessoas'}`),
            h('span', null, icone('chave'), `${c.permissoes.length} ${c.permissoes.length === 1 ? 'permissão' : 'permissões'}`)),
          grupos.length ? h('div', { class: 'chips' }, grupos.map(g => h('span', { class: 'chip chip-suave' }, g))) : null);
      })));
  }

  await desenhar();
  return raiz;
}

function formCargo(c, catalogo, depois, somenteLeitura = false, { lista = [], exclusivas = [] } = {}) {
  const s = { nome: c?.nome || '', descricao: c?.descricao || '', cor: c?.cor || '#d8b13a', permissoes: new Set(c?.permissoes || []), exclui_base: !!c?.exclui_base };
  const minhas = new Set(estado.eu.permissoes);
  // "Aprovar registros" só pode estar num cargo: se outro já tem, aqui fica travado.
  const donoDe = chave => (exclusivas.includes(chave) ? lista.find(x => x.id !== c?.id && x.permissoes.includes(chave)) : null);
  const travada = chave => exclusivas.includes(chave) && (c?.base || !!donoDe(chave));
  const posso = p => (estado.eu.is_root || minhas.has(p)) && !travada(p);

  const grupos = catalogo.map(g => {
    const caixas = g.itens.map(i => h('input', {
      type: 'checkbox', checked: s.permissoes.has(i.chave), disabled: somenteLeitura || !posso(i.chave),
      onchange: e => { if (e.target.checked) s.permissoes.add(i.chave); else s.permissoes.delete(i.chave); },
    }));
    const todos = () => {
      const marcar = !g.itens.every(i => s.permissoes.has(i.chave));
      g.itens.forEach((i, k) => {
        if (!posso(i.chave)) return;
        caixas[k].checked = marcar;
        if (marcar) s.permissoes.add(i.chave); else s.permissoes.delete(i.chave);
      });
    };
    return h('fieldset', { class: 'perm-grupo' },
      h('legend', null, g.grupo, !somenteLeitura && h('button', { class: 'link', type: 'button', onclick: todos }, 'marcar/desmarcar tudo')),
      g.itens.map((i, k) => h('label', { class: 'marcador' }, caixas[k], h('span', null, i.nome,
        travada(i.chave) && h('small', { class: 'suave' }, donoDe(i.chave) ? ` (já pertence ao cargo "${donoDe(i.chave).nome}")` : ' (não vale para o Morador)')))));
  });

  // "Não é morador": quem tem o cargo não recebe as permissões do Morador e só vê o que for marcado para
  // Convidados e Aliados (e o que o próprio cargo der). Só o administrador principal muda; o Morador não tem.
  const naoMorador = c?.base ? null : interruptor('Não é morador (não recebe as permissões do Morador)', s.exclui_base, v => { s.exclui_base = v; },
    'Para convidados e aliados de outras casas: quem tem este cargo vê só o que for marcado para Convidados e Aliados, o próprio perfil e os avisos públicos da tela inicial, mais o que este cargo der.');
  if (naoMorador && (somenteLeitura || !estado.eu.is_root)) naoMorador.querySelectorAll('input, button').forEach(x => { x.disabled = true; });

  if (somenteLeitura) {
    const leitura = modal({
      titulo: c.nome, tamanho: 'medio',
      corpo: [h('p', { class: 'form-intro' }, c.descricao), c.exclui_base && h('p', { class: 'nota' }, icone('alerta'), 'Quem tem este cargo não é morador: não recebe as permissões do Morador.'), h('div', { class: 'perm-grade' }, grupos)],
      rodape: [h('span', { class: 'espaco' }), botao('Fechar', { onclick: () => leitura.fechar() })],
    });
    return;
  }

  const janela = modalForm({
    titulo: c ? `Cargo · ${c.nome}` : 'Novo cargo',
    tamanho: 'grande',
    textoOk: c ? 'Salvar cargo' : 'Criar cargo',
    conteudo: [
      h('div', { class: 'form-grade form-grade-cargo' },
        campo('Nome', h('input', { class: 'input', value: s.nome, maxlength: '40', placeholder: 'Ex.: Tesoureiro', oninput: e => { s.nome = e.target.value; } }), { obrigatorio: true }),
        campo('Cor', h('input', { class: 'input input-cor', type: 'color', value: s.cor, oninput: e => { s.cor = e.target.value; } }))),
      campo('Descrição', h('input', { class: 'input', value: s.descricao, maxlength: '200', placeholder: 'O que esse cargo faz', oninput: e => { s.descricao = e.target.value; } })),
      c?.base && h('p', { class: 'nota' }, icone('alerta'), 'Este é o cargo base: o que marcar aqui vale para TODOS os moradores (todos os usuários, menos quem tem um cargo que não é morador, como os Aliados).'),
      naoMorador,
      h('div', { class: 'perm-grade' }, grupos),
    ],
    extraRodape: c && !c.base && botao('Apagar cargo', {
      icone: 'lixo', classe: 'btn-perigo-texto',
      onclick: async () => {
        const qtd = c.usuarios ? ` ${c.usuarios === 1 ? 'A pessoa que tem este cargo perde' : `As ${c.usuarios} pessoas que têm este cargo perdem`} os poderes dele.` : '';
        if (!await confirmar(`O cargo "${c.nome}" será apagado.${qtd}`, { ok: 'Apagar cargo', perigo: true })) return;
        if (await tentar(() => del(`/api/cargos/${c.id}`), 'Cargo apagado.')) { janela.fechar(); depois(); }
      },
    }),
    aoEnviar: async () => {
      if (s.nome.trim().length < 2) throw new Error('Dê um nome ao cargo.');
      const corpo = { ...s, permissoes: [...s.permissoes] };
      if (c) await put(`/api/cargos/${c.id}`, corpo);
      else await post('/api/cargos', corpo);
      aviso(c ? 'Cargo atualizado.' : 'Cargo criado.');
      estado.eu = await get('/api/auth/me');
      depois();
    },
  });
}

/* ─── Diário ──────────────────────────────────────── */

export async function diario() {
  const raiz = h('div', { class: 'pagina' });
  const corpo = h('tbody');
  const mais = h('div', { class: 'carregar-mais' });
  let busca = '';
  let ultimo = null;
  let espera;

  async function carregar(reiniciar) {
    if (reiniciar) { trocar(corpo); ultimo = null; }
    const params = new URLSearchParams();
    if (busca) params.set('q', busca);
    if (ultimo) params.set('antes', ultimo);
    const { itens, mais: temMais } = await get(`/api/diario?${params}`);
    if (itens.length) ultimo = itens[itens.length - 1].id;
    corpo.append(...itens.map(i => h('tr', null,
      h('td', { class: 'suave nowrap', 'data-rotulo': 'Quando', title: dataHora(i.criado_em) }, dataHora(i.criado_em)),
      h('td', { 'data-rotulo': 'Quem' }, h('strong', null, i.usuario_nome || 'sistema')),
      h('td', { 'data-rotulo': 'O quê' }, i.acao, i.detalhe && h('span', { class: 'suave' }, `: ${i.detalhe}`)))));
    if (!corpo.children.length) corpo.append(h('tr', null, h('td', { colspan: '3', class: 'tabela-vazia' }, 'Nada encontrado.')));
    trocar(mais, temMais ? botao('Carregar mais', { onclick: () => carregar(false) }) : '');
  }

  raiz.append(
    cabecalho({ titulo: 'Diário do sistema', icone: 'livro', sub: 'Tudo o que foi feito no sistema, de quem entrou a quem apagou um registro.' }),
    h('div', { class: 'ferramentas' },
      h('label', { class: 'busca' }, icone('busca'),
        h('input', {
          class: 'input', type: 'search', placeholder: 'Buscar por pessoa ou ação',
          oninput: e => { busca = e.target.value.trim(); clearTimeout(espera); espera = setTimeout(() => carregar(true), 300); },
        }))),
    h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela tabela-responsiva' },
      h('thead', null, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Quem'), h('th', null, 'O quê'))),
      corpo)),
    mais);

  await carregar(true);
  return raiz;
}
