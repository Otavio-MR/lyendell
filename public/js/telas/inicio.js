import { estado, get, h, icone, chipCargo, barra, num, pacotes, relativo, dataCurta } from '../core.js';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export async function inicio() {
  const d = await get('/api/inicio');
  const eu = estado.eu;
  const n = d.numeros;

  const numeros = [
    n.tabelionato != null && { rotulo: 'Registros no Tabelionato', valor: n.tabelionato, icone: 'pergaminho', href: '#/tabelionato' },
    n.guarda != null && { rotulo: 'Registros da Guarda', valor: n.guarda, icone: 'escudo', href: '#/guarda' },
    n.atividades != null && { rotulo: 'Atividades abertas', valor: n.atividades, icone: 'tarefas', href: '#/atividades' },
    n.fotos != null && { rotulo: 'Fotos na galeria', valor: n.fotos, icone: 'imagem', href: '#/galeria' },
    n.usuarios != null && { rotulo: 'Usuários ativos', valor: n.usuarios, icone: 'usuarios', href: '#/admin/usuarios' },
  ].filter(Boolean);

  const cargos = eu.is_root
    ? [h('span', { class: 'chip chip-ouro' }, icone('coroa'), 'Administrador')]
    : eu.cargos.length ? eu.cargos.map(chipCargo) : [h('span', { class: 'chip' }, 'Morador')];

  return h('div', { class: 'pagina inicio' },
    h('section', { class: 'boas-vindas' },
      h('img', { src: '/img/brasao.png', alt: '', class: 'bv-brasao' }),
      h('div', { class: 'bv-texto' },
        h('p', { class: 'sobrelinha' }, 'Cidade de Lyendell · Casa Luckham'),
        h('h1', { class: 'pag-titulo bv-titulo' }, `${saudacao()}, ${eu.nome}`),
        h('div', { class: 'chips' }, cargos))),

    numeros.length ? h('div', { class: 'numeros' }, numeros.map(x =>
      h('a', { class: 'numero', href: x.href },
        h('span', { class: 'numero-icone' }, icone(x.icone)),
        h('strong', null, num(x.valor)),
        h('span', null, x.rotulo)))) : null,

    h('div', { class: 'inicio-grade' },
      d.anuncios && h('section', { class: 'painel' },
        h('header', { class: 'painel-cab' }, h('h2', null, icone('megafone'), 'Últimos anúncios'), h('a', { href: '#/anuncios' }, 'Ver mural')),
        d.anuncios.length
          ? h('div', { class: 'lista-simples' }, d.anuncios.map(a =>
            h('a', { class: 'anuncio-mini', href: '#/anuncios' },
              h('div', { class: 'anuncio-mini-topo' },
                a.fixado ? h('span', { class: 'etiqueta' }, icone('alfinete'), 'Fixado') : null,
                a.importancia !== 'comum' ? h('span', { class: `etiqueta imp-${a.importancia}` }, a.importancia === 'urgente' ? 'Urgente' : 'Importante') : null),
              h('strong', null, a.titulo),
              h('p', null, a.conteudo.length > 140 ? `${a.conteudo.slice(0, 140)}…` : a.conteudo),
              h('small', null, `${a.autor_nome} · ${relativo(a.criado_em)}`))))
          : h('p', { class: 'painel-vazio' }, 'Nenhum anúncio ainda.')),

      d.atividades && h('section', { class: 'painel' },
        h('header', { class: 'painel-cab' }, h('h2', null, icone('tarefas'), 'Precisamos de ajuda'), h('a', { href: '#/atividades' }, 'Ver todas')),
        d.atividades.length
          ? h('div', { class: 'lista-simples' }, d.atividades.map(a =>
            h('a', { class: 'ativ-mini', href: `#/atividades/${a.id}` },
              h('div', { class: 'ativ-mini-topo' },
                h('strong', null, a.titulo),
                h('span', { class: 'suave' }, `${Math.floor(Math.min(100, (a.total / a.meta) * 100))}%`)),
              barra(a.total, a.meta),
              h('small', null, `${num(a.total)} de ${num(a.meta)} ${a.item}`,
                pacotes(a.meta, a.pacote) ? ` (${pacotes(a.meta, a.pacote)})` : '',
                a.prazo ? ` · até ${dataCurta(a.prazo)}` : ''))))
          : h('p', { class: 'painel-vazio' }, 'Nenhuma atividade aberta no momento.'))),

    d.fotos && d.fotos.length ? h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('imagem'), 'Da galeria'), h('a', { href: '#/galeria' }, 'Abrir galeria')),
      h('div', { class: 'fotos-faixa' }, d.fotos.map(f =>
        h('a', { href: '#/galeria', class: 'foto-mini', title: f.titulo || '' }, h('img', { src: f.arquivo, alt: f.titulo || 'Foto da galeria', loading: 'lazy' }))))) : null);
}
