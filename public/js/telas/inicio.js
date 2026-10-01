import { estado, get, h, icone, chipCargo, chipCrianca, barra, num, pacotes, relativo, dataCurta, seloNivel, avatarPessoa, normalizar, pode, avatar } from '../core.js';
import { MENU_CRIANCA, falaDoDia, curiosidadeDoDia } from '../crianca.js';
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
function painelProgresso(pr, { crianca = false } = {}) {
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
        h('h3', null, icone('tarefas'), crianca ? 'Aventuras de hoje' : 'Missões de hoje'),
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
    h('p', { class: 'progresso-dica suave' }, crianca
      ? 'Brincar, conversar e ajudar os grandes faz o seu coelhinho crescer. Quanto maior ele fica, mais molduras bonitas você ganha!'
      : 'Ganhe XP conversando no chat, jogando, ajudando nas atividades e deixando recados. Subir de nível libera molduras novas para a foto.'));
}

// As últimas publicações do Congresso e das Leis de Lyendell: todo mundo precisa saber o que mudou.
function painelNovidades(lista, { titulo, icone: ic, href }) {
  if (!lista?.length) return null; // sem nada publicado ainda, o painel nem aparece
  const classe = t => ({ aprovada: 'lei-aprovada', rejeitada: 'lei-rejeitada' })[normalizar(t)] || '';
  return h('section', { class: 'painel' },
    h('header', { class: 'painel-cab' }, h('h2', null, icone(ic), titulo), h('a', { href }, 'Ver tudo')),
    h('div', { class: 'lista-simples' }, lista.map(x => h('a', { class: 'anuncio-mini lei-mini', href: `${href}/${x.livro_id}/registro/${x.id}` },
      h('div', { class: 'anuncio-mini-topo' },
        x.etiquetas.map((t, i) => h('span', { class: `etiqueta ${i === 0 ? 'etiqueta-ouro' : classe(t)}`.trim() }, t))),
      h('strong', null, x.titulo),
      x.resumo && h('p', null, x.resumo),
      h('small', null, x.data ? `${href === '#/leis' ? 'Feita' : 'Votada'} em ${dataCurta(x.data)}` : `Publicada ${relativo(x.em)}`, x.numero ? ` · nº ${x.numero}` : '')))));
}

function painelComunidade(pr, { crianca = false } = {}) {
  if (!pr.novidades.length && !pr.semana.length) return null;
  return h('div', { class: 'inicio-grade' },
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('estrela'), crianca ? 'Quem ganhou medalha' : 'Conquistas recentes'), h('a', { href: '#/comunidade' }, crianca ? 'Todo mundo' : 'Comunidade')),
      pr.novidades.length
        ? h('div', { class: 'novidades' }, pr.novidades.map(n => h('a', { class: 'novidade', href: `#/pessoa/${n.id}` },
          avatarPessoa(n, 'avatar-p'),
          h('span', null, h('strong', null, n.nome), ' ganhou ', h('strong', { class: 'novidade-conquista' }, icone(n.conquista.icone), n.conquista.nome)),
          h('small', null, relativo(n.em)))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém ganhou conquistas ainda.')),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('fogo'), crianca ? 'Quem mais brincou na semana' : 'Mais ativos da semana')),
      pr.semana.length
        ? h('ol', { class: 'mini-ranking' }, pr.semana.map(p => h('li', { class: p.id === estado.eu.id ? 'eu-linha' : '' },
          h('a', { href: `#/pessoa/${p.id}`, class: 'semana-pessoa' }, avatarPessoa(p, 'avatar-p'), h('span', null, p.nome)),
          h('strong', null, `${num(p.xp)} XP`))))
        : h('p', { class: 'painel-vazio' }, 'Ainda ninguém nesta semana.')));
}

// A toca da criança: o coelho da Casa conversa com ela, as portas grandes levam aos lugares
// e o resto (números, anúncios, registros) fica para os grandes.
function inicioCrianca(d, pr) {
  const eu = estado.eu;
  const portas = [
    pode('recreacao.usar') && ['/recreacao', 'jogos', 'Jogos e amigos esperando'],
    ['/mapa', 'mapa', 'Onde será que fica o tesouro?'],
    ['/comunidade', 'usuarios', 'Ver quem mora na cidade'],
    pode('atividades.ver') && ['/atividades', 'tarefas', 'Os grandes precisam de mim'],
    pode('galeria.ver') && ['/galeria', 'imagem', 'Retratos e desenhos'],
    pode('leis.ver') && ['/leis', 'balanca', 'O que não pode fazer'],
  ].filter(Boolean);
  return h('div', { class: 'pagina inicio inicio-crianca' },
    h('section', { class: 'cr-boas-vindas' },
      h('div', { class: 'cr-eu' }, avatar(eu.nome, 'avatar-g', eu.foto)),
      h('div', { class: 'cr-texto' },
        h('h1', { class: 'pag-titulo' }, `Oi, ${eu.nome.split(' ')[0]}!`),
        h('div', { class: 'chips' }, chipCrianca(), eu.cargos.map(chipCargo)),
        h('div', { class: 'cr-fala' },
          h('span', { class: 'cr-coelho', 'aria-hidden': 'true' }, icone('coelho')),
          h('p', null, h('small', null, 'O coelho da Casa diz:'), falaDoDia())))),
    h('nav', { class: 'cr-portas', 'aria-label': 'Aonde ir' }, portas.map(([rota, ic, texto], i) =>
      h('a', { class: `cr-porta cor-${i % 6}`, href: `#${rota}` },
        h('span', { class: 'cr-porta-icone' }, icone(ic)),
        h('strong', null, MENU_CRIANCA[rota]),
        h('small', null, texto)))),
    pr && painelProgresso(pr, { crianca: true }),
    h('section', { class: 'painel cr-curiosidade' },
      h('span', { class: 'cr-curiosidade-icone' }, icone('estrela')),
      h('div', null, h('strong', null, 'Você sabia?'), h('p', null, curiosidadeDoDia()))),
    painelNovidades(d.leis, { titulo: 'Regras novas dos grandes', icone: 'balanca', href: '#/leis' }),
    d.atividades?.length > 0 && h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('tarefas'), 'Os grandes precisam de ajuda!'), h('a', { href: '#/atividades' }, 'Quero ajudar')),
      h('div', { class: 'lista-simples' }, d.atividades.map(a => h('a', { class: 'ativ-mini', href: `#/atividades/${a.id}` },
        h('div', { class: 'ativ-mini-topo' }, h('strong', null, a.titulo), h('span', { class: 'suave' }, `${Math.floor(Math.min(100, (a.total / a.meta) * 100))}%`)),
        barra(a.total, a.meta),
        h('small', null, `Precisa de ${num(a.meta)} ${a.item}`))))),
    pr && painelComunidade(pr, { crianca: true }));
}

export async function inicio() {
  const [d, pr] = await Promise.all([get('/api/inicio'), get('/api/auth/progresso').catch(() => null)]);
  const eu = estado.eu;
  if (eu.crianca) return inicioCrianca(d, pr);
  const n = d.numeros;

  const numeros = [
    n.tabelionato != null && { rotulo: 'Registros no Tabelionato', valor: n.tabelionato, icone: 'pergaminho', href: '#/tabelionato' },
    n.guarda != null && { rotulo: 'Registros da Guarda', valor: n.guarda, icone: 'escudo', href: '#/guarda' },
    n.hospital != null && { rotulo: 'Registros do Hospital', valor: n.hospital, icone: 'cruz', href: '#/hospital' },
    n.congresso != null && { rotulo: 'Votações no Congresso', valor: n.congresso, icone: 'coluna', href: '#/congresso' },
    n.leis != null && { rotulo: 'Leis de Lyendell', valor: n.leis, icone: 'balanca', href: '#/leis' },
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

    painelNovidades(d.leis, { titulo: 'Novas Leis de Lyendell', icone: 'balanca', href: '#/leis' }),

    painelNovidades(d.congresso, { titulo: 'Novidades do Congresso', icone: 'coluna', href: '#/congresso' }),

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
