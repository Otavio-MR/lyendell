// Convocações da Guarda: a lista, o botão "Preciso de guardas agora", e a página de uma convocação
// (para onde vai o link do Discord): o guarda aperta "Compareci" e o Comandante confere, confirma ou retira.
import { get, post, h, trocar, icone, modal, modalForm, confirmar, aviso, botao, campo, vazio, interruptor } from '../core.js';
import {
  API, carregando, areaTexto, entradaTexto, pedirTexto, plural, pessoa, etiquetaConvocado, dataHoraBr, horaBr, quando, copiar,
} from './guarda-escala-comum.js';

/* ─── Lista ──────────────────────────────────────── */

export async function convocacoes(corpo, ctx) {
  const { convocacoes: lista } = await get(`${API}/convocacoes`);
  const pendentes = lista.filter(c => !c.encerrada_em && c.minha_situacao === 'convocado');
  trocar(corpo,
    ctx.gerir && h('section', { class: 'gesc-chamar' },
      h('div', { class: 'gesc-chamar-texto' },
        h('h2', null, 'Algo urgente na cidade?'),
        h('p', null, 'Convoque a Guarda inteira de uma vez. Cada guarda recebe o aviso (no Discord, se estiver ligado), abre o link e aperta "Compareci". Depois você confere quem apareceu.')),
      h('button', { class: 'btn btn-ouro gesc-chamar-btn', type: 'button', onclick: () => formularioConvocar(ctx) }, icone('megafone'), h('span', null, 'Preciso de guardas agora'))),
    pendentes.length > 0 && h('p', { class: 'nota nota-vermelha', role: 'status' }, icone('alerta'),
      h('span', null, `Você foi convocado ${pendentes.length === 1 ? 'e ainda não confirmou presença em uma convocação aberta' : `e ainda não confirmou presença em ${pendentes.length} convocações abertas`}.`)),
    lista.length
      ? h('div', { class: 'gesc-conv-lista' }, lista.map(c => cartaoConvocacao(c, ctx)))
      : vazio(ctx.gerir ? 'Nenhuma convocação ainda' : 'Você ainda não foi convocado', ctx.gerir
        ? 'Quando precisar de guardas na hora, use o botão "Preciso de guardas agora". As convocações feitas aparecem aqui, com quem compareceu.'
        : 'Quando o Comandante convocar a Guarda, a convocação aparece aqui e no Discord.'));
}

function cartaoConvocacao(c, ctx) {
  const aberta = !c.encerrada_em;
  const falta = !ctx.gerir && aberta && c.minha_situacao === 'convocado';
  return h('a', { class: `gesc-conv ${aberta ? 'aberta' : ''} ${falta ? 'pede-resposta' : ''}`.trim(), href: `#/guarda-escala/convocacao/${c.id}` },
    h('div', { class: 'gesc-conv-topo' },
      h('span', { class: aberta ? 'etiqueta etiqueta-ouro' : 'etiqueta' }, aberta ? 'Aberta' : 'Encerrada'),
      c.minha_situacao && etiquetaConvocado(c.minha_situacao),
      h('span', { class: 'suave gesc-conv-quando' }, quando(c.criada_em))),
    h('h3', null, c.motivo),
    c.local && h('p', { class: 'gesc-conv-local' }, icone('mapa'), c.local),
    h('div', { class: 'gesc-conv-rodape' },
      h('span', null, icone('usuarios'), `${c.compareceram} de ${c.convocados} compareceram`),
      h('span', { class: 'suave' }, `por ${c.criada_por_nome}, ${dataHoraBr(c.criada_em)}`)),
    falta && h('strong', { class: 'gesc-conv-cta' }, 'Toque para confirmar que compareceu', icone('frente')));
}

/* ─── Formulário "Preciso de guardas agora" ──────── */

function formularioConvocar(ctx) {
  const motivo = areaTexto('', { maxlength: '600', required: true, rows: '3', placeholder: 'Ex.: Invasão de raposos na muralha norte, todos ao portão!' });
  const local = entradaTexto('', { maxlength: '120', placeholder: 'Ex.: Portão leste (opcional)' });
  const caixas = ctx.guardas.map(g => h('input', { type: 'checkbox', value: g.id, checked: true, 'aria-label': g.nome }));
  let discord = true;
  const marcar = v => caixas.forEach(c => { c.checked = v; });
  modalForm({
    titulo: 'Convocar a Guarda', tamanho: 'medio', textoOk: 'Convocar agora',
    conteudo: [
      campo('Motivo', motivo, { obrigatorio: true, ajuda: 'Aparece no aviso do Discord e na página da convocação.' }),
      campo('Local', local),
      h('fieldset', { class: 'gesc-fs' },
        h('legend', { class: 'campo-rotulo' }, 'Quem convocar'),
        h('div', { class: 'gesc-fs-acoes' },
          h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => marcar(true) }, 'Todos'),
          h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => marcar(false) }, 'Ninguém')),
        h('div', { class: 'gesc-checks' }, ctx.guardas.map((g, i) => h('label', { class: 'gesc-check', style: { '--cor': ctx.cor(g.id) } }, caixas[i], pessoa(g), h('span', null, g.nome))))),
      interruptor('Avisar no Discord', true, v => { discord = v; }, 'Manda a convocação com o link para o canal da Guarda.'),
    ],
    aoEnviar: async () => {
      const ids = caixas.filter(c => c.checked).map(c => Number(c.value));
      if (!ids.length) throw new Error('Escolha pelo menos um guarda para convocar.');
      const r = await post(`${API}/convocacoes`, { motivo: motivo.value, local: local.value, usuario_ids: ids, discord });
      resultadoConvocacao(r, discord);
      ctx.recarregar();
    },
  });
}

function resultadoConvocacao(r, pediuDiscord) {
  const caminho = `#/guarda-escala/convocacao/${r.id}`;
  const linkCompleto = r.link || `${location.origin}/${caminho}`;
  let aviso1;
  if (r.no_discord) aviso1 = ['ok', 'Aviso enviado no Discord.'];
  else if (!pediuDiscord) aviso1 = ['info', 'Você escolheu não avisar no Discord. Compartilhe o link abaixo com os guardas.'];
  else if (!r.discord_ativo) aviso1 = ['alerta', 'O Discord não está configurado neste site, então ninguém foi avisado lá. Compartilhe o link abaixo com os guardas.'];
  else aviso1 = ['alerta', 'Não foi possível enviar ao Discord agora. Compartilhe o link abaixo com os guardas.'];
  const campoLink = h('input', { class: 'input', readonly: true, value: linkCompleto, 'aria-label': 'Link da convocação', onfocus: e => e.target.select() });
  const m = modal({
    titulo: 'Guarda convocada', tamanho: 'pequeno',
    corpo: h('div', { class: 'gesc-resultado' },
      h('p', { class: 'gesc-resultado-n' }, icone('megafone'), h('strong', null, plural(r.convocados, 'guarda convocado', 'guardas convocados'))),
      h('p', { class: `nota ${aviso1[0] === 'alerta' ? 'nota-ouro' : ''}`.trim(), role: 'status' }, icone(aviso1[0] === 'alerta' ? 'alerta' : 'check'), aviso1[1]),
      h('div', { class: 'gesc-linha-data' }, campoLink, h('button', { class: 'btn', type: 'button', onclick: () => copiar(linkCompleto, campoLink) }, icone('documento'), h('span', null, 'Copiar link')))),
    rodape: [h('span', { class: 'espaco' }), h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Fechar'),
      h('a', { class: 'btn btn-ouro', href: caminho, onclick: () => m.fechar() }, 'Abrir a convocação')],
  });
}

/* ─── Página de uma convocação ───────────────────── */

export async function convocacaoDetalhe(id, ctx) {
  const raiz = h('div', { class: 'pagina gesc gesc-detalhe' });
  const tela = h('div', { class: 'gesc-det-corpo' }, carregando());
  trocar(raiz, tela);
  const voltar = h('a', { class: 'voltar', href: '#/guarda-escala/convocacoes' }, icone('voltar'), 'Escala da Guarda');

  async function carregar() {
    let d;
    try { d = await get(`${API}/convocacoes/${id}`); } catch (e) {
      const msg = e.status === 403 ? ['Você não foi convocado', 'Esta convocação não é para você. Só os guardas convocados e o Comandante da Guarda podem abrir esta página. Se acha que é um engano, fale com o Comandante.']
        : e.status === 404 ? ['Convocação não encontrada', 'Ela pode ter sido apagada, ou o link está incompleto.']
        : ['Não deu para abrir a convocação', e.message];
      trocar(tela, h('p', null, voltar), vazio(msg[0], msg[1], h('a', { class: 'btn', href: '#/guarda-escala/convocacoes' }, 'Ver minhas convocações')));
      return;
    }
    // O Comandante que também foi convocado responde como qualquer guarda (o botão dele vem antes da lista).
    const meu = d.eu ? painelGuarda({ ...d, convocados: d.convocados.filter(k => k.usuario_id === ctx.eu.id) }, carregar) : null;
    trocar(tela, h('p', null, voltar), cabecalhoDetalhe(d), meu, ctx.gerir ? painelGerir(d, ctx, carregar) : null);
  }
  await carregar();
  return raiz;
}

function cabecalhoDetalhe(d) {
  const c = d.convocacao;
  return h('header', { class: `gesc-det-cab ${c.encerrada_em ? '' : 'aberta'}`.trim() },
    h('div', { class: 'gesc-det-etq' },
      h('span', { class: c.encerrada_em ? 'etiqueta' : 'etiqueta etiqueta-ouro' }, icone(c.encerrada_em ? 'cadeado' : 'megafone'), c.encerrada_em ? 'Convocação encerrada' : 'Convocação aberta'),
      c.no_discord && h('span', { class: 'etiqueta' }, 'Avisada no Discord')),
    h('h1', { class: 'pag-titulo gesc-det-motivo' }, c.motivo),
    c.local && h('p', { class: 'gesc-conv-local' }, icone('mapa'), h('span', null, h('b', null, 'Onde: '), c.local)),
    h('p', { class: 'suave' }, `Convocada por ${c.criada_por_nome}, ${dataHoraBr(c.criada_em)}.${c.encerrada_em ? ` Encerrada em ${dataHoraBr(c.encerrada_em)}.` : ''}`));
}

// O guarda convocado: um botão enorme "Compareci" e o estado da sua resposta.
function painelGuarda(d, recarregar) {
  const { eu, convocacao: c, convocados } = d;
  const meu = convocados[0] || {};
  const bloco = (cls, ic, titulo, texto) => h('div', { class: `gesc-resp ${cls}`, role: 'status' }, icone(ic), h('div', null, h('strong', null, titulo), texto && h('p', null, texto)));
  if (eu.situacao === 'removido') {
    return bloco('removida', 'alerta', 'O Comandante retirou a sua presença',
      `${meu.removido_por_nome ? `Por ${meu.removido_por_nome}. ` : ''}Motivo: ${meu.motivo_remocao || 'não informado'}. Se tiver dúvida, fale com o Comandante.`);
  }
  if (eu.situacao === 'compareceu') {
    return bloco(meu.conferido ? 'conferida' : 'aguarda', meu.conferido ? 'check' : 'relogio',
      meu.conferido ? `Presença confirmada pelo Comandante` : `Você confirmou às ${horaBr(eu.respondeu_em)}`,
      meu.conferido ? `Você apertou "Compareci" às ${horaBr(eu.respondeu_em)}. Obrigado pelo serviço!` : 'Aguardando a conferência do Comandante da Guarda.');
  }
  if (c.encerrada_em) return bloco('encerrada', 'cadeado', 'Esta convocação já foi encerrada', 'Não dá mais para confirmar presença. Se você esteve lá, fale com o Comandante.');
  const b = h('button', {
    class: 'btn btn-ouro gesc-compareci', type: 'button',
    onclick: async () => {
      b.disabled = true; b.classList.add('carregando');
      try { await post(`${API}/convocacoes/${c.id}/comparecer`); aviso('Presença registrada. O Comandante vai conferir.'); await recarregar(); } catch (e) { aviso(e.message, 'erro'); b.disabled = false; b.classList.remove('carregando'); }
    },
  }, icone('check'), h('span', null, 'Compareci'));
  return h('section', { class: 'gesc-resp pede' },
    h('p', null, 'Você foi convocado. Quando chegar ao posto, aperte o botão abaixo para registrar a sua presença.'),
    b,
    h('p', { class: 'suave gesc-aviso-honra' }, 'Aperte só quando estiver lá: o Comandante confere depois e pode retirar a presença de quem não apareceu.'));
}

// O Comandante: todos os convocados, confirmar, retirar e encerrar.
function painelGerir(d, ctx, recarregar) {
  const { convocacao: c, convocados, totais } = d;
  const confirmarPresenca = async k => {
    try { await post(`${API}/convocacoes/${c.id}/confirmar`, { usuario_id: k.usuario_id }); aviso(`Presença de ${k.nome} confirmada.`); await recarregar(); } catch (e) { aviso(e.message, 'erro'); }
  };
  const retirar = async k => {
    const motivo = await pedirTexto({ titulo: `Retirar a presença de ${k.nome}`, texto: 'Use quando o guarda apertou "Compareci" e não apareceu. A retirada conta nos controles.', rotulo: 'Motivo', ajuda: 'Obrigatório. O guarda vê esse motivo e fica registrado.', ok: 'Retirar presença', perigo: true, minimo: 3 });
    if (!motivo) return;
    try { await post(`${API}/convocacoes/${c.id}/remover`, { usuario_id: k.usuario_id, motivo }); aviso(`Presença de ${k.nome} retirada.`); await recarregar(); } catch (e) { aviso(e.message, 'erro'); }
  };
  const encerrar = async () => {
    if (!await confirmar('Depois de encerrada, os guardas não conseguem mais apertar "Compareci". Você ainda poderá confirmar ou retirar presenças.', { titulo: 'Encerrar a convocação?', ok: 'Encerrar convocação' })) return;
    try { await post(`${API}/convocacoes/${c.id}/encerrar`); aviso('Convocação encerrada.'); await recarregar(); } catch (e) { aviso(e.message, 'erro'); }
  };
  const aguardando = convocados.filter(k => k.situacao === 'compareceu' && !k.conferido).length;
  return h('section', { class: 'painel gesc-confere' },
    h('div', { class: 'painel-cab' },
      h('h2', null, icone('usuarios'), 'Quem foi convocado'),
      h('div', { class: 'gesc-confere-acoes' },
        botao('Atualizar', { icone: 'aleatorio', onclick: recarregar }),
        !c.encerrada_em && botao('Encerrar convocação', { icone: 'cadeado', classe: 'btn-perigo-texto', onclick: encerrar }))),
    h('p', { class: 'gesc-totais' },
      h('span', null, h('b', null, totais.compareceram), ` de ${totais.convocados} compareceram`),
      totais.removidos > 0 && h('span', { class: 'gesc-ruim' }, `${totais.removidos} retirada(s)`),
      aguardando > 0 && h('span', { class: 'gesc-ouro' }, `${aguardando} aguardando a sua conferência`)),
    h('ul', { class: 'gesc-conv-gente' }, convocados.map(k => {
      const fechado = k.situacao === 'compareceu' && k.conferido;
      return h('li', { class: `gesc-gente sit-${k.situacao}`, style: { '--cor': ctx.cor(k.usuario_id) } },
        pessoa(k, 'avatar-m'),
        h('div', { class: 'gesc-gente-info' },
          h('strong', null, k.nome),
          h('div', { class: 'gesc-gente-sit' }, etiquetaConvocado(k.situacao),
            k.conferido && k.situacao === 'compareceu' && h('span', { class: 'etiqueta' }, icone('check'), 'Conferido'),
            k.respondeu_em && h('span', { class: 'suave' }, `apertou às ${horaBr(k.respondeu_em)}`)),
          k.situacao === 'removido' && h('p', { class: 'gesc-gente-motivo' }, `${k.removido_por_nome ? `${k.removido_por_nome}: ` : ''}${k.motivo_remocao || ''}`)),
        h('div', { class: 'gesc-gente-acoes' },
          !fechado && botao(k.situacao === 'removido' ? 'Restaurar' : 'Confirmar', { icone: 'check', classe: 'btn-pequeno', onclick: () => confirmarPresenca(k) }),
          k.situacao !== 'removido' && botao('Retirar presença', { icone: 'x', classe: 'btn-pequeno btn-perigo-texto', onclick: () => retirar(k) })));
    })));
}
