// Comunidade: todo mundo que usa o site e o perfil público de cada um (com conquistas e mural de recados).

import { estado, get, post, del, h, trocar, icone, botao, botaoIcone, cabecalho, vazio, avatarPessoa, seloNivel, barra, chipCargo, chipCrianca, ehCrianca, confirmar, tentar, aviso, num, relativo, dataCurta, dataHora, normalizar, aoSair, pode } from '../core.js';
import { rt, ouvir } from '../tempo-real.js';

const escutar = (tipo, fn) => aoSair(ouvir(tipo, fn));

// Capa pronta (classe) ou imagem enviada.
export function capaDe(capa, classe = 'perfil-capa') {
  if (capa && capa.startsWith('/uploads/')) return h('div', { class: `${classe} capa-imagem`, style: { backgroundImage: `url("${capa}")` } });
  return h('div', { class: `${classe} capa-${capa || 'floresta'}` });
}

const estaOnline = id => rt.online.some(o => o.id === id);
const jogandoAgora = id => rt.transmissoes.find(t => t.id === id);

export function barraNivel(n) {
  const feito = n.xp - n.xpNivel;
  const falta = n.xpProximo - n.xpNivel;
  return h('div', { class: 'nivel-barra', title: `${num(feito)} de ${num(falta)} XP para o nível ${n.nivel + 1}` },
    barra(feito, falta),
    h('small', null, `${num(n.xp)} XP · faltam ${num(n.xpProximo - n.xp)} para o nível ${n.nivel + 1}`));
}

// Cabeçalho do perfil (também usado na prévia da tela "Meu perfil").
export function cartaoPerfil(p, { acoes = [], conquistas = [] } = {}) {
  const emblemas = (p.emblemas || []).map(c => conquistas.find(x => x.chave === c)).filter(Boolean);
  return h('section', { class: 'perfil-cartao', style: p.cor ? { '--cor-perfil': p.cor } : null },
    capaDe(p.capa),
    h('div', { class: 'perfil-cabeca' },
      h('div', { class: 'perfil-avatar' },
        avatarPessoa(p, 'avatar-xg'),
        estaOnline(p.id) && h('span', { class: 'perfil-online', title: 'No site agora' })),
      h('div', { class: 'perfil-nome' },
        h('h1', { class: 'pag-titulo perfil-titulo' }, p.nome),
        p.titulo_perfil && h('p', { class: 'perfil-frase' }, p.titulo_perfil),
        h('div', { class: 'chips' }, p.crianca && chipCrianca(), (p.cargos?.length ? p.cargos : [{ nome: 'Morador', cor: '#9a9b74' }]).map(chipCargo))),
      acoes.length ? h('div', { class: 'perfil-acoes' }, acoes) : null),
    h('div', { class: 'perfil-progresso' },
      h('div', { class: 'perfil-nivel' },
        seloNivel(p.nivel, 'grande'),
        h('div', null, h('strong', null, p.nivel.titulo), barraNivel(p.nivel))),
      h('div', { class: 'perfil-sequencia', title: 'Dias seguidos entrando no site' },
        icone('fogo'), h('strong', null, p.sequencia || 0), h('small', null, p.sequencia === 1 ? 'dia seguido' : 'dias seguidos'))),
    emblemas.length ? h('div', { class: 'perfil-emblemas' }, emblemas.map(c =>
      h('span', { class: 'emblema', title: c.desc }, icone(c.icone), c.nome))) : null);
}

/* ─── Perfil público ──────────────────────────────── */

export async function pessoa(id) {
  id = Number(id);
  const d = await get(`/api/pessoas/${id}`);
  const p = d.pessoa;
  const souEu = p.id === estado.eu.id;
  const raiz = h('div', { class: 'pagina perfil-pagina' });
  const topo = h('div');
  const mural = h('div', { class: 'mural' });

  function desenharTopo() {
    const jogo = jogandoAgora(p.id);
    trocar(topo, cartaoPerfil(p, {
      conquistas: d.conquistas,
      acoes: [
        souEu && h('a', { class: 'btn btn-ouro', href: '#/perfil' }, icone('paleta'), h('span', null, 'Personalizar')),
        jogo && h('a', { class: 'btn', href: `#/recreacao/assistir/${p.id}` }, icone('olho'), h('span', null, `Assistir ${jogo.nomeJogo}`)),
      ].filter(Boolean),
    }));
  }
  escutar('online', desenharTopo);
  escutar('transmissoes', desenharTopo);
  desenharTopo();

  const e = d.estatisticas;
  const numeros = [
    ['trofeu', num(e.vitorias), 'vitórias ao vivo'],
    ['jogos', num(e.partidas), 'partidas ao vivo'],
    ['pergunta', num(e.acertos), 'acertos no quiz'],
    ['coelho', num(e.pacman), 'recorde no Pac-Coelho'],
    ['cobra', num(e.cobrinha), 'cenouras na Cobrinha'],
    ['chat', num(e.mensagens), 'mensagens no chat'],
  ];
  const ganhas = d.conquistas.filter(c => c.em);

  /* Mural de recados */
  const campoRecado = h('textarea', { class: 'input', rows: '2', maxlength: '300', placeholder: souEu ? 'Escreva algo no seu mural...' : `Deixe um recado para ${p.nome}...` });
  const enviar = botao('Enviar recado', { classe: 'btn-ouro btn-pequeno', icone: 'aviao', tipo: 'submit' });
  const formRecado = h('form', { class: 'mural-form' }, campoRecado, enviar);
  formRecado.addEventListener('submit', async ev => {
    ev.preventDefault();
    const texto = campoRecado.value.trim();
    if (!texto) return;
    enviar.disabled = true;
    const ok = await tentar(() => post(`/api/pessoas/${p.id}/recados`, { texto }), 'Recado enviado.');
    enviar.disabled = false;
    if (ok) { campoRecado.value = ''; carregarMural(); }
  });

  async function carregarMural() {
    const { recados } = await get(`/api/pessoas/${p.id}/recados`);
    const moderar = pode('usuarios.editar') || pode('recreacao.moderar');
    trocar(mural, recados.length
      ? recados.map(r => h('article', { class: 'recado' },
        r.autor_id ? h('a', { href: `#/pessoa/${r.autor_id}` }, avatarPessoa({ nome: r.autor_nome, foto: r.autor_foto, moldura: r.autor_moldura }, 'avatar-p'))
          : avatarPessoa({ nome: r.autor_nome }, 'avatar-p'),
        h('div', { class: 'recado-corpo' },
          h('div', { class: 'recado-cab' },
            r.autor_id ? h('a', { href: `#/pessoa/${r.autor_id}`, style: r.autor_cor ? { color: r.autor_cor } : null }, r.autor_nome) : h('strong', null, r.autor_nome),
            h('time', { title: dataHora(r.criado_em) }, relativo(r.criado_em))),
          h('p', { class: 'texto-livre' }, r.texto)),
        (r.autor_id === estado.eu.id || souEu || moderar) && botaoIcone('lixo', 'Apagar recado', async () => {
          if (!await confirmar('Apagar este recado?', { ok: 'Apagar', perigo: true })) return;
          if (await tentar(() => del(`/api/pessoas/recados/${r.id}`))) carregarMural();
        }, 'perigo')))
      : h('p', { class: 'painel-vazio' }, souEu ? 'Seu mural ainda está vazio.' : `Seja a primeira pessoa a deixar um recado para ${p.nome}!`));
  }
  carregarMural();

  trocar(raiz,
    h('a', { class: 'voltar', href: '#/comunidade' }, icone('voltar'), ehCrianca() ? 'Todo mundo' : 'Comunidade'),
    topo,
    h('div', { class: 'perfil-grade' },
      h('div', { class: 'perfil-coluna' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('usuario'), 'Sobre')),
          p.bio ? h('p', { class: 'texto-livre perfil-bio' }, p.bio) : h('p', { class: 'painel-vazio' }, souEu ? 'Conte um pouco sobre você em "Personalizar".' : 'Ainda não escreveu nada sobre si.'),
          h('ul', { class: 'perfil-fatos' },
            p.mc_nick && h('li', null, icone('coelho'), 'Minecraft: ', h('strong', null, p.mc_nick)),
            h('li', null, icone('calendario'), `No site desde ${dataCurta(p.desde)}`),
            p.visto && h('li', null, icone('relogio'), estaOnline(p.id) ? 'No site agora' : `Visto ${relativo(p.visto)}`),
            h('li', null, icone('fogo'), `Maior sequência: ${p.sequencia_max} ${p.sequencia_max === 1 ? 'dia' : 'dias'}`))),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Na Recreação')),
          h('div', { class: 'perfil-numeros' }, numeros.map(([ic, v, t]) => h('div', { class: 'perfil-numero' }, icone(ic), h('strong', null, v), h('small', null, t)))))),
      h('div', { class: 'perfil-coluna' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('chat'), 'Mural de recados')),
          formRecado,
          mural))),
    h('section', { class: 'painel' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('estrela'), 'Conquistas'), h('small', { class: 'suave' }, `${ganhas.length} de ${d.conquistas.length}`)),
      h('div', { class: 'conquistas' }, d.conquistas.map(c => h('div', { class: `conquista ${c.em ? 'ganha' : ''}`.trim(), title: c.desc },
        h('span', { class: 'conquista-icone' }, icone(c.em ? c.icone : 'cadeado')),
        h('div', null,
          h('strong', null, c.nome),
          h('small', null, c.desc),
          c.em ? h('small', { class: 'conquista-data' }, `Desde ${dataCurta(c.em)}`)
            : c.meta > 1 && h('div', { class: 'conquista-progresso' }, barra(c.valor, c.meta), h('small', null, `${num(c.valor)} / ${num(c.meta)}`))))))));
  return raiz;
}

/* ─── Comunidade ──────────────────────────────────── */

export async function comunidade() {
  const { pessoas } = await get('/api/pessoas');
  let busca = '';
  let ordem = 'semana';
  const lista = h('div', { class: 'comunidade' });

  function desenhar() {
    const b = normalizar(busca.trim());
    const ordenadas = pessoas.filter(p => !b || normalizar(`${p.nome} ${p.titulo_perfil}`).includes(b));
    if (ordem === 'semana') ordenadas.sort((a, c) => c.xpSemana - a.xpSemana || c.nivel.xp - a.nivel.xp);
    else if (ordem === 'nivel') ordenadas.sort((a, c) => c.nivel.xp - a.nivel.xp);
    else ordenadas.sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR'));
    trocar(lista, ordenadas.length ? ordenadas.map(p => {
      const jogo = jogandoAgora(p.id);
      return h('a', { class: 'pessoa-cartao', href: `#/pessoa/${p.id}`, style: p.cor ? { '--cor-perfil': p.cor } : null },
        capaDe(p.capa, 'pessoa-capa'),
        h('div', { class: 'pessoa-foto' }, avatarPessoa(p, 'avatar-g'), estaOnline(p.id) && h('span', { class: 'perfil-online', title: 'No site agora' })),
        h('strong', { class: 'pessoa-nome' }, p.nome),
        p.crianca && chipCrianca(),
        h('small', { class: 'pessoa-frase' }, p.titulo_perfil || (p.cargos[0]?.nome ?? 'Morador')),
        h('div', { class: 'pessoa-rodape' },
          seloNivel(p.nivel),
          h('small', null, p.nivel.titulo),
          jogo ? h('span', { class: 'etiqueta etiqueta-ouro' }, icone('olho'), jogo.nomeJogo)
            : ordem === 'semana' && p.xpSemana > 0 && h('small', { class: 'suave' }, `+${num(p.xpSemana)} XP na semana`)));
    }) : vazio('Ninguém encontrado', 'Tente outro nome.'));
  }

  escutar('online', desenhar);
  escutar('transmissoes', desenhar);
  desenhar();

  const ordens = [['semana', 'Mais ativos da semana'], ['nivel', 'Maior nível'], ['nome', 'Nome']];
  const seletor = h('div', { class: 'segmentado' });
  const desenharSeletor = () => trocar(seletor, ordens.map(([k, t]) =>
    h('button', { class: `seg ${ordem === k ? 'ativo' : ''}`, type: 'button', onclick: () => { ordem = k; desenharSeletor(); desenhar(); } }, t)));
  desenharSeletor();

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: 'Comunidade', icone: 'usuarios',
      sub: 'Quem vive em Lyendell. Abra um perfil para ver as conquistas e deixar um recado.',
      acoes: [h('a', { class: 'btn btn-ouro', href: '#/perfil' }, icone('paleta'), h('span', null, 'Personalizar meu perfil'))],
    }),
    h('div', { class: 'ferramentas' },
      h('label', { class: 'busca' }, icone('busca'), h('input', { class: 'input', type: 'search', placeholder: 'Procurar pessoa...', oninput: e => { busca = e.target.value; desenhar(); } })),
      seletor),
    lista);
}
