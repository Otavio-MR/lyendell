import { estado, get, h, icone, chipCargo, barra, num, pacotes, relativo, dataCurta, seloNivel, avatarPessoa, normalizar } from '../core.js';
import { barraNivel } from './pessoas.js';
import { MODULOS } from './livros.js';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Registros esperando a aprovação de quem entrou, e envios dele que foram recusados.
function avisosDeAprovacao(p = {}) {
  const itens = [];
  for (const [m, info] of Object.entries(MODULOS)) {
    const { aprovar = 0, recusados = 0 } = p[m] || {};
    if (aprovar) {
      itens.push(h('a', { class: 'nota nota-link nota-ouro', href: `#/${m}/aprovacoes` }, icone('relogio'),
        h('span', null, `${aprovar} ${aprovar === 1 ? 'registro aguarda' : 'registros aguardam'} a sua aprovação ${info.no}.`),
        h('strong', null, 'Revisar')));
    }
    if (recusados) {
      itens.push(h('a', { class: 'nota nota-link nota-vermelha', href: `#/${m}/envios` }, icone('alerta'),
        h('span', null, `${recusados} ${recusados === 1 ? 'envio seu foi recusado' : 'envios seus foram recusados'} ${info.no}.`),
        h('strong', null, 'Ver e corrigir')));
    }
  }
  return itens.length ? h('div', { class: 'avisos-inicio' }, itens) : null;
}

// Nível, sequência de dias e as missões de hoje: o motivo para voltar amanhã.
function painelProgresso(pr) {
  const feitas = pr.missoes.filter(m => m.feito >= m.meta).length;
  return h('section', { class: 'painel progresso-inicio' },
    h('div', { class: 'progresso-topo' },
      seloNivel(pr.nivel, 'grande'),
      h('div', { class: 'progresso-nivel' },
        h('strong', null, pr.nivel.titulo),
        barraNivel(pr.nivel)),
      h('div', { class: 'perfil-sequencia', title: 'Dias seguidos entrando no site' },
        icone('fogo'), h('strong', null, pr.sequencia), h('small', null, pr.sequencia === 1 ? 'dia seguido' : 'dias seguidos'))),
    h('div', { class: 'missoes' },
      h('div', { class: 'missoes-cab' },
        h('h3', null, icone('tarefas'), 'Missões de hoje'),
        h('small', { class: 'suave' }, feitas === pr.missoes.length ? 'Todas cumpridas! Amanhã tem mais.' : `${feitas} de ${pr.missoes.length} cumpridas · renovam à meia-noite`)),
      h('ul', null, pr.missoes.map(m => {
        const pronta = m.feito >= m.meta;
        return h('li', { class: `missao ${pronta ? 'pronta' : ''}`.trim() },
          h('span', { class: 'missao-marca' }, icone(pronta ? 'check' : 'alvo')),
          h('div', { class: 'missao-texto' },
            h('span', null, m.texto),
            m.meta > 1 && !pronta && h('div', { class: 'missao-barra' }, barra(m.feito, m.meta), h('small', null, `${m.feito}/${m.meta}`))),
          h('span', { class: 'missao-xp' }, `+${m.xp} XP`));
      }))),
    h('p', { class: 'progresso-dica suave' }, 'Ganhe XP conversando no chat, jogando, ajudando nas atividades e deixando recados. Subir de nível libera molduras novas para a foto.'));
}

// As últimas leis e mudanças votadas no Congresso: todo mundo precisa saber o que mudou.
function painelCongresso(lista) {
  if (!lista?.length) return null; // sem nada publicado ainda, o painel nem aparece
  const classe = t => ({ aprovada: 'lei-aprovada', rejeitada: 'lei-rejeitada' })[normalizar(t)] || '';
  return h('section', { class: 'painel' },
    h('header', { class: 'painel-cab' }, h('h2', null, icone('coluna'), 'Novidades do Congresso'), h('a', { href: '#/congresso' }, 'Ver tudo')),
    h('div', { class: 'lista-simples' }, lista.map(x => h('a', { class: 'anuncio-mini lei-mini', href: `#/congresso/${x.livro_id}` },
      h('div', { class: 'anuncio-mini-topo' },
        x.etiquetas.map((t, i) => h('span', { class: `etiqueta ${i === 0 ? 'etiqueta-ouro' : classe(t)}`.trim() }, t))),
      h('strong', null, x.titulo),
      x.resumo && h('p', null, x.resumo),
      h('small', null, x.data ? `Votada em ${dataCurta(x.data)}` : `Publicada ${relativo(x.em)}`, x.numero ? ` · nº ${x.numero}` : '')))));
}

function painelComunidade(pr) {
  if (!pr.novidades.length && !pr.semana.length) return null;
  return h('div', { class: 'inicio-grade' },
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('estrela'), 'Conquistas recentes'), h('a', { href: '#/comunidade' }, 'Comunidade')),
      pr.novidades.length
        ? h('div', { class: 'novidades' }, pr.novidades.map(n => h('a', { class: 'novidade', href: `#/pessoa/${n.id}` },
          avatarPessoa(n, 'avatar-p'),
          h('span', null, h('strong', null, n.nome), ' ganhou ', h('strong', { class: 'novidade-conquista' }, icone(n.conquista.icone), n.conquista.nome)),
          h('small', null, relativo(n.em)))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém ganhou conquistas ainda.')),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('fogo'), 'Mais ativos da semana')),
      pr.semana.length
        ? h('ol', { class: 'mini-ranking' }, pr.semana.map(p => h('li', { class: p.id === estado.eu.id ? 'eu-linha' : '' },
          h('a', { href: `#/pessoa/${p.id}`, class: 'semana-pessoa' }, avatarPessoa(p, 'avatar-p'), h('span', null, p.nome)),
          h('strong', null, `${num(p.xp)} XP`))))
        : h('p', { class: 'painel-vazio' }, 'Ainda ninguém nesta semana.')));
}

export async function inicio() {
  const [d, pr] = await Promise.all([get('/api/inicio'), get('/api/auth/progresso').catch(() => null)]);
  const eu = estado.eu;
  const n = d.numeros;

  const numeros = [
    n.tabelionato != null && { rotulo: 'Registros no Tabelionato', valor: n.tabelionato, icone: 'pergaminho', href: '#/tabelionato' },
    n.guarda != null && { rotulo: 'Registros da Guarda', valor: n.guarda, icone: 'escudo', href: '#/guarda' },
    n.hospital != null && { rotulo: 'Registros do Hospital', valor: n.hospital, icone: 'cruz', href: '#/hospital' },
    n.congresso != null && { rotulo: 'Leis e mudanças', valor: n.congresso, icone: 'coluna', href: '#/congresso' },
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

    avisosDeAprovacao(d.pendencias),

    painelCongresso(d.congresso),

    pr && painelProgresso(pr),

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

    pr && painelComunidade(pr),

    d.fotos && d.fotos.length ? h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('imagem'), 'Da galeria'), h('a', { href: '#/galeria' }, 'Abrir galeria')),
      h('div', { class: 'fotos-faixa' }, d.fotos.map(f =>
        h('a', { href: '#/galeria', class: 'foto-mini', title: f.titulo || '' }, h('img', { src: f.arquivo, alt: f.titulo || 'Foto da galeria', loading: 'lazy' }))))) : null);
}
