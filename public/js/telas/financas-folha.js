// Gestão Financeira, a parte do dinheiro: gerar a folha (prévia), folhas e recibos, tesouro, relatórios
// e configurações. A prévia não grava nada; fechar grava para revisão; aprovar reserva o valor no tesouro;
// só pagar tira o dinheiro do tesouro.
import {
  get, post, put, h, trocar, icone, botao, modal, modalForm, confirmar, aviso, tentar, campo, barra, num, dataCurta, dataHora,
} from '../core.js';
import {
  API, lirios, valorSinal, semanaPassada, mesDe, periodoTexto, nomeFrequencia, SIT_FOLHA, TIPO_MOV, TIPO_ITEM,
  etiqueta, td, tabela, painel, carregando, entradaNumero, entradaTexto, areaTexto, selecao, segmentado, entradaFrequencia,
  seletorPeriodo, pedirTexto, enviarComAutorizacao, baixarCsv, csvNum, listaAuditoria,
} from './financas-comum.js';

async function seguro(area, fn) {
  try { await fn(); } catch (e) { trocar(area, h('p', { class: 'form-erro' }, e.message)); }
}

const NIVEL = { erro: ['fin-alerta-erro', 'alerta', 'Erro'], aviso: ['fin-alerta-aviso', 'alerta', 'Aviso'], info: ['fin-alerta-info', 'pergunta', 'Informação'] };
function listaAlertas(alertas) {
  if (!alertas?.length) return null;
  const ordem = { erro: 0, aviso: 1, info: 2 };
  return h('ul', { class: 'fin-alertas' }, [...alertas].sort((a, b) => (ordem[a.nivel] ?? 3) - (ordem[b.nivel] ?? 3)).map(a => {
    const [cls, ic, nome] = NIVEL[a.nivel] || NIVEL.info;
    return h('li', { class: `fin-alerta ${cls}` }, icone(ic), h('span', null, h('strong', null, `${nome}: `), a.texto));
  }));
}

// Uma linha explicando de onde veio o valor de um item da folha.
function textoDetalhes(i) {
  const d = i.detalhes || {};
  if (i.tipo === 'fixo') {
    return [
      `base do período ${lirios(d.base)} (${lirios(d.base_frequencia)} ${nomeFrequencia(d.frequencia).toLowerCase()})`,
      d.proporcional ? `${num(d.cumpridos)} de ${d.previstos} turnos cumpridos` : 'salário cheio (não proporcional)',
      `presenças ${d.presentes || 0}, faltas ${d.faltas || 0}, justificadas ${d.justificadas || 0}, licenças ${d.licencas || 0}, missões ${d.missoes || 0}`,
      d.de && d.ate && `vínculo de ${dataCurta(d.de)} a ${dataCurta(d.ate)} no período`,
    ].filter(Boolean).join('; ');
  }
  if (i.tipo === 'producao') return `${num(d.quantidade)} ${d.unidade} × ${lirios(d.valor_unitario)}, ${(d.entregas || []).length} ${(d.entregas || []).length === 1 ? 'entrega aceita' : 'entregas aceitas'}`;
  if (d.excecao) return `Exceção autorizada por ${d.excecao.por}: ${d.excecao.justificativa}`;
  return '';
}

function cartao(ic, valor, nome, dica, classe = '') {
  return h('div', { class: `numero fin-numero ${classe}`.trim() },
    h('span', { class: 'numero-icone' }, icone(ic)),
    h('strong', null, typeof valor === 'number' ? [num(valor), h('small', { class: 'fin-moeda' }, ' Lírios')] : valor),
    h('span', null, nome, dica && h('small', { class: 'fin-dica' }, dica)));
}

// Imprimir (ou salvar como PDF pelo navegador). "recibo" imprime só o recibo aberto.
function imprimir(modo = 'pagina') {
  document.querySelectorAll('.fin details').forEach(d => { d.open = true; });
  document.body.classList.add(`fin-imprimir-${modo}`);
  const limpar = () => document.body.classList.remove(`fin-imprimir-${modo}`);
  window.addEventListener('afterprint', limpar, { once: true });
  window.print();
  setTimeout(limpar, 1000);
}

/* ─── 6. Gerar folha ─────────────────────────────── */

export async function gerarFolha(corpo, { podes }) {
  let periodo = semanaPassada();
  const area = h('div', { class: 'fin-area' }, h('p', { class: 'painel-vazio' }, 'Escolha o período (a semana passada já vem marcada) e toque em "Calcular prévia".'));
  trocar(corpo,
    h('p', { class: 'form-intro fin-intro' }, 'A prévia calcula quanto cada pessoa recebe no período: salário fixo pelos turnos registrados e produção pelas entregas aceitas ainda não pagas. Ela não grava nada. Para valer, feche a folha para revisão; depois ela é aprovada e paga.'),
    seletorPeriodo({ ...periodo, botao: 'Calcular prévia', atalhos: ['passada', 'semana', 'mes'], aoMudar: (i, f) => { if (!i || !f) return aviso('Escolha o início e o fim.', 'erro'); periodo = { inicio: i, fim: f }; calcular(); } }),
    area);

  async function calcular() {
    trocar(area, carregando());
    await seguro(area, async () => {
      const { previa: p } = await get(`${API}/folha/previa?inicio=${periodo.inicio}&fim=${periodo.fim}`);
      const t = p.tesouro;
      const sobreposta = p.alertas.some(a => a.nivel === 'erro' && a.folha_id);
      const obs = areaTexto('', { maxlength: '500', rows: '2', placeholder: 'Opcional' });
      const teto = p.config.teto_folha;
      const dispDepois = Math.round((t.disponivel - p.total) * 100) / 100;
      const pessoas = p.pessoas.map(pe => {
        const itens = p.itens.filter(i => i.registro_id === pe.registro_id);
        return h('details', { class: 'fin-pessoa', open: p.pessoas.length <= 4 },
          h('summary', null, h('span', { class: 'fin-pessoa-nome' }, pe.nome, h('small', { class: 'suave' }, ` ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`)),
            h('strong', { class: 'fin-pessoa-total' }, lirios(pe.total))),
          h('ul', { class: 'fin-itens' }, itens.map(i => h('li', null,
            h('div', { class: 'fin-item-topo' }, h('span', null, h('strong', null, i.profissao_nome), `: ${i.descricao}`), h('strong', { class: 'nowrap' }, lirios(i.valor))),
            h('small', { class: 'suave' }, textoDetalhes(i))))));
      });
      trocar(area,
        h('div', { class: 'fin-previa-faixa', role: 'status' }, icone('alerta'),
          h('div', null, h('strong', null, 'Prévia: simulação, nada foi gravado e o tesouro não mudou.'),
            h('span', null, ` Período de ${periodoTexto(p.inicio, p.fim)} (${p.dias} ${p.dias === 1 ? 'dia' : 'dias'}).`))),
        listaAlertas(p.alertas),
        h('div', { class: 'numeros fin-numeros' },
          cartao('moeda', p.total, 'Total da folha', 'previsto, ainda não pago', 'fin-destaque'),
          cartao('usuarios', String(p.pessoas.length), 'Pessoas', `${p.itens.length} ${p.itens.length === 1 ? 'item' : 'itens'}`),
          cartao('check', t.disponivel, 'Disponível agora', 'saldo menos o reservado'),
          cartao('balanca', dispDepois, 'Disponível depois', 'se esta folha for aprovada', dispDepois < 0 ? 'fin-negativo' : ''),
          cartao('cadeado', Math.round((t.saldo - p.total) * 100) / 100, 'Saldo depois de pagar', `hoje: ${lirios(t.saldo)}`)),
        painel('Orçamento', 'balanca', [
          h('p', null, teto > 0 ? `Teto de planejamento: ${lirios(p.total)} de ${lirios(teto)} (${Math.round((p.total / teto) * 100)}%).` : 'Sem teto de planejamento.'),
          teto > 0 && barra(Math.min(p.total, teto), teto),
          h('p', { class: 'suave fin-mt' }, `Reserva mínima: ${lirios(p.config.reserva)}. Depois desta folha sobram ${lirios(dispDepois)} disponíveis. Os limites só avisam, nunca cortam pagamento.`),
        ]),
        painel('Por pessoa', 'usuarios', p.pessoas.length ? h('div', { class: 'fin-pessoas' }, pessoas) : h('p', { class: 'painel-vazio' }, 'Ninguém a pagar neste período.'),
          h('span', { class: 'fin-total-geral' }, 'Total geral: ', h('strong', null, lirios(p.total)))),
        podes.gerir && h('section', { class: 'painel fin-painel fin-fechar' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('documento'), 'Fechar folha para revisão')),
          h('p', { class: 'form-intro' }, 'Grava estes valores e prende as presenças e entregas nesta folha (assim nada é pago duas vezes). O tesouro ainda não muda: depois a folha precisa ser aprovada e paga.'),
          campo('Observação', obs),
          sobreposta && h('p', { class: 'form-erro' }, 'Já existe uma folha que cobre parte deste período. Escolha outro período ou rejeite aquela folha antes.'),
          h('div', { class: 'fin-linha-acoes' },
            botao('Fechar folha para revisão', {
              icone: 'cadeado', classe: 'btn-ouro', desativado: sobreposta || !p.itens.length,
              onclick: async () => {
                if (!await confirmar(`Fechar a folha de ${periodoTexto(p.inicio, p.fim)} com ${lirios(p.total)} para ${p.pessoas.length} ${p.pessoas.length === 1 ? 'pessoa' : 'pessoas'}? Os valores ficam gravados para revisão; o tesouro ainda não muda.`,
                  { titulo: 'Fechar folha para revisão?', ok: 'Fechar folha' })) return;
                const r = await tentar(() => post(`${API}/folhas`, { inicio: p.inicio, fim: p.fim, observacao: obs.value }), 'Folha fechada para revisão.');
                if (r?.id) location.hash = `#/financas/folha/${r.id}`;
              },
            }))));
    });
  }
}

/* ─── 7. Folhas ──────────────────────────────────── */

export async function folhas(corpo) {
  const { folhas: lista } = await get(`${API}/folhas`);
  trocar(corpo,
    h('div', { class: 'fin-barra' },
      h('p', { class: 'form-intro' }, 'Em revisão: valores gravados, esperando aprovação. Aprovada: o valor fica reservado no tesouro, esperando pagamento. Paga: o dinheiro já saiu do tesouro.'),
      h('a', { class: 'btn btn-ouro', href: '#/financas/gerar' }, icone('mais'), h('span', null, 'Gerar folha'))),
    tabela(['Folha', 'Período', 'Situação', 'Total', 'Pago', 'Pessoas', 'Responsáveis'], lista.map(f => h('tr', { tabindex: '0', onclick: () => { location.hash = `#/financas/folha/${f.id}`; }, onkeydown: e => { if (e.key === 'Enter') location.hash = `#/financas/folha/${f.id}`; } },
      td('Folha', h('a', { href: `#/financas/folha/${f.id}` }, h('strong', null, `Folha nº ${f.id}`))),
      td('Período', periodoTexto(f.inicio, f.fim)),
      td('Situação', h('div', { class: 'chips' }, etiqueta(SIT_FOLHA, f.situacao), f.excecao && h('span', { class: 'etiqueta fin-ruim', title: f.excecao.justificativa }, 'Exceção'),
        f.alertas.length ? h('span', { class: 'etiqueta', title: 'Alertas no fechamento' }, icone('alerta'), f.alertas.length) : null)),
      td('Total', lirios(f.total), 'num'),
      td('Pago', lirios(f.pago), 'num'),
      td('Pessoas', String(f.pessoas)),
      td('Responsáveis', h('small', { class: 'suave' },
        `Fechada por ${f.criado_por_nome || 'alguém'} em ${dataCurta(f.criado_em)}`,
        f.aprovado_por_nome && `; aprovada por ${f.aprovado_por_nome}`,
        f.rejeitado_por_nome && `; rejeitada por ${f.rejeitado_por_nome}`)))),
    { classe: 'tabela-clicavel', vazio: 'Nenhuma folha ainda. Comece em Gerar folha.' }));
}

export async function folha(corpo, { podes }, id) {
  let cidadaosCache = null;
  async function desenhar() {
    const { folha: f, auditoria, tesouro: t } = await get(`${API}/folhas/${id}`);
    const recarregar = () => seguro(corpo, desenhar);
    const revisao = f.situacao === 'revisao';
    const aprovada = f.situacao === 'aprovada';
    const podePagar = podes.aprovar && aprovada;
    const selecionados = new Set();
    const btnSel = botao('Pagar selecionados', { icone: 'check', classe: 'btn-pequeno', desativado: true, onclick: () => pagar([...selecionados]) });
    const atualizarSel = () => {
      const soma = f.itens.filter(i => selecionados.has(i.id)).reduce((s, i) => s + i.valor, 0);
      btnSel.disabled = !selecionados.size;
      btnSel.querySelector('span').textContent = selecionados.size ? `Pagar selecionados (${selecionados.size}, ${lirios(Math.round(soma * 100) / 100)})` : 'Pagar selecionados';
    };

    const pessoas = f.pessoas.map(pe => {
      const itens = f.itens.filter(i => i.registro_id === pe.registro_id);
      const quitado = pe.pago >= pe.total && itens.every(i => i.pago);
      return h('details', { class: 'fin-pessoa', open: f.pessoas.length <= 4 },
        h('summary', null,
          h('span', { class: 'fin-pessoa-nome' }, pe.nome, h('small', { class: 'suave' }, ` ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`)),
          h('span', { class: 'fin-pessoa-fim' },
            f.situacao !== 'rejeitada' && f.situacao !== 'revisao' && (quitado ? h('span', { class: 'etiqueta fin-bom' }, icone('check'), 'Pago') : h('span', { class: 'etiqueta fin-azul' }, `Falta ${lirios(Math.round((pe.total - pe.pago) * 100) / 100)}`)),
            h('strong', { class: 'fin-pessoa-total' }, lirios(pe.total)))),
        tabela([podePagar ? '' : null, 'Tipo', 'Descrição', 'Calculado', 'Valor', 'Pagamento', ''].filter(x => x !== null), itens.map(i => h('tr', null,
          podePagar && h('td', { class: 'fin-sel' }, !i.pago && h('label', { class: 'marcador', title: 'Escolher para pagar' },
            h('input', { type: 'checkbox', 'aria-label': `Escolher ${i.descricao} para pagar`, onchange: e => { if (e.target.checked) selecionados.add(i.id); else selecionados.delete(i.id); atualizarSel(); } }))),
          td('Tipo', [h('span', { class: 'etiqueta' }, TIPO_ITEM[i.tipo] || i.tipo), i.profissao_nome && h('small', { class: 'suave bloco' }, i.profissao_nome)]),
          td('Descrição', [i.descricao, textoDetalhes(i) && h('small', { class: 'suave bloco' }, textoDetalhes(i)),
            i.justificativa && h('small', { class: 'bloco fin-just' }, icone('pena'), `Justificativa: ${i.justificativa}`)]),
          td('Calculado', i.tipo === 'ajuste' ? h('span', { class: 'suave' }, 'ajuste') : lirios(i.calculado), 'num'),
          td('Valor', [h('strong', { class: i.valor < 0 ? 'fin-saida' : null }, lirios(i.valor)), i.tipo !== 'ajuste' && i.valor !== i.calculado && h('small', { class: 'bloco fin-ouro-texto' }, 'revisado')], 'num'),
          td('Pagamento', i.pago ? [h('span', { class: 'etiqueta fin-bom' }, icone('check'), 'Pago'), h('small', { class: 'suave bloco' }, `${dataHora(i.pago_em)}${i.pago_por_nome ? `, por ${i.pago_por_nome}` : ''}`)]
            : h('span', { class: 'suave' }, f.situacao === 'rejeitada' ? 'não será pago' : 'ainda não pago')),
          h('td', { class: 'acoes-linha' }, podes.gerir && revisao && !i.pago && botao('Revisar valor', { icone: 'editar', classe: 'btn-pequeno', onclick: () => revisarItem(f, i, recarregar) })))),
        { classe: 'fin-tabela-itens' }),
        f.situacao !== 'rejeitada' && h('div', { class: 'fin-linha-acoes' }, botao('Recibo', { icone: 'documento', classe: 'btn-pequeno', onclick: () => recibo(f, pe) })));
    });

    const acoes = [
      podes.aprovar && revisao && botao('Aprovar folha', { icone: 'check', classe: 'btn-ouro', onclick: () => aprovar(f, t) }),
      podes.aprovar && revisao && botao('Rejeitar', { classe: 'btn-perigo-texto', onclick: () => rejeitar(f) }),
      podePagar && botao(`Pagar tudo (${lirios(f.a_pagar)})`, { icone: 'moeda', classe: 'btn-ouro', onclick: () => pagar(null) }),
      podePagar && btnSel,
      podes.gerir && f.situacao !== 'rejeitada' && botao('Adicionar ajuste', { icone: 'mais', onclick: () => formAjuste(f) }),
    ].filter(Boolean);

    trocar(corpo,
      h('a', { class: 'voltar fin-nao-imprime', href: '#/financas/folhas' }, icone('voltar'), 'Todas as folhas'),
      h('section', { class: 'painel fin-painel fin-folha-topo' },
        h('div', { class: 'fin-folha-titulo' },
          h('h2', { class: 'fin-nome' }, `Folha nº ${f.id}`),
          etiqueta(SIT_FOLHA, f.situacao),
          h('span', { class: 'espaco' }),
          h('div', { class: 'fin-linha-acoes fin-nao-imprime' },
            botao('Exportar CSV', { icone: 'baixar', classe: 'btn-pequeno', onclick: () => csvFolha(f) }),
            botao('Imprimir / salvar PDF', { icone: 'documento', classe: 'btn-pequeno', onclick: () => imprimir('pagina') }))),
        h('p', { class: 'fin-periodo-grande' }, periodoTexto(f.inicio, f.fim)),
        h('ul', { class: 'fin-quem' },
          h('li', null, icone('cadeado'), `Fechada para revisão por ${f.criado_por_nome || 'alguém'} em ${dataHora(f.criado_em)}.`),
          f.aprovado_por_nome && h('li', null, icone('check'), `Aprovada por ${f.aprovado_por_nome} em ${dataHora(f.aprovado_em)}.`),
          f.rejeitado_por_nome && h('li', null, icone('x'), `Rejeitada por ${f.rejeitado_por_nome} em ${dataHora(f.rejeitado_em)}. Motivo: ${f.motivo}`),
          f.observacao && h('li', null, icone('pena'), `Observação: ${f.observacao}`)),
        f.excecao && h('p', { class: 'nota nota-vermelha' }, icone('alerta'),
          h('span', null, h('strong', null, 'Pagamento excepcional autorizado '), `por ${f.excecao.por} em ${dataHora(f.excecao.em)}: ${f.excecao.justificativa}`))),
      h('div', { class: 'numeros fin-numeros' },
        cartao('moeda', f.total, 'Total', revisao ? 'em revisão: ainda não é dinheiro pago' : f.situacao === 'rejeitada' ? 'folha rejeitada, nada será pago' : null, 'fin-destaque'),
        cartao('check', f.pago, 'Já pago', 'saiu do tesouro'),
        cartao('relogio', f.a_pagar, 'A pagar', aprovada ? 'reservado no tesouro' : null),
        cartao('balanca', t.disponivel, 'Disponível no tesouro', `saldo ${lirios(t.saldo)}`)),
      acoes.length ? h('div', { class: 'gestao fin-nao-imprime' }, h('span', { class: 'gestao-rotulo' }, 'Ações'), acoes) : null,
      revisao && h('p', { class: 'nota fin-nao-imprime' }, icone('alerta'), 'Em revisão: confira os valores. Revisar um valor ou acrescentar um ajuste pede justificativa. Aprovar reserva o total no tesouro; pagar é um passo à parte.'),
      aprovada && h('p', { class: 'nota fin-nao-imprime' }, icone('alerta'), 'Aprovada: o valor está reservado. Ao pagar, o dinheiro sai do tesouro. Para corrigir agora, use um ajuste (positivo ou desconto).'),
      f.alertas.length ? painel('Alertas no fechamento', 'alerta', listaAlertas(f.alertas)) : null,
      painel('Por pessoa', 'usuarios', f.pessoas.length ? h('div', { class: 'fin-pessoas' }, pessoas) : h('p', { class: 'painel-vazio' }, 'Nenhum item.'),
        h('span', { class: 'fin-total-geral' }, 'Total geral: ', h('strong', null, lirios(f.total)))),
      painel('Histórico da folha', 'relogio', listaAuditoria([...auditoria].reverse())));

    async function aprovar() {
      if (!await confirmar(`Aprovar a folha nº ${f.id} (${periodoTexto(f.inicio, f.fim)}) de ${lirios(f.total)}? O valor fica reservado no tesouro e os itens só mudam por ajuste. O dinheiro só sai quando a folha for paga.`,
        { titulo: 'Aprovar folha?', ok: 'Aprovar' })) return;
      try {
        const r = await enviarComAutorizacao(c => post(`${API}/folhas/${f.id}/aprovar`, c), { confirmar: true });
        if (!r) return;
        aviso('Folha aprovada. O valor está reservado; falta pagar.');
        recarregar();
      } catch (e) { aviso(e.message, 'erro'); }
    }
    async function rejeitar() {
      const motivo = await pedirTexto({
        titulo: `Rejeitar a folha nº ${f.id}?`,
        texto: 'A folha fica no histórico como rejeitada e nada dela é pago. As presenças e entregas voltam a ficar livres para uma folha nova.',
        rotulo: 'Motivo da rejeição', ok: 'Rejeitar folha', perigo: true,
      });
      if (motivo && await tentar(() => post(`${API}/folhas/${f.id}/rejeitar`, { motivo }), 'Folha rejeitada.')) recarregar();
    }
    async function pagar(itens) {
      const lista = f.itens.filter(i => !i.pago && (!itens || itens.includes(i.id)));
      const total = Math.round(lista.reduce((s, i) => s + i.valor, 0) * 100) / 100;
      if (!lista.length) return aviso('Nada a pagar.', 'erro');
      if (!await confirmar(`O dinheiro sai do tesouro: ${lirios(total)} para ${lista.length} ${lista.length === 1 ? 'item' : 'itens'}. Saldo hoje: ${lirios(t.saldo)}; depois: ${lirios(Math.round((t.saldo - total) * 100) / 100)}.`,
        { titulo: itens ? 'Pagar os itens escolhidos?' : 'Pagar a folha inteira?', ok: 'Pagar' })) return;
      try {
        const r = await enviarComAutorizacao(c => post(`${API}/folhas/${f.id}/pagar`, { ...c, ...(itens ? { itens } : {}) }));
        if (!r) return;
        aviso(`${r.pagos} ${r.pagos === 1 ? 'item pago' : 'itens pagos'}: ${lirios(r.valor)}.${r.quitada ? ' Folha quitada.' : ''}`);
        recarregar();
      } catch (e) { aviso(e.message, 'erro'); }
    }
    async function formAjuste() {
      if (!cidadaosCache) {
        try { cidadaosCache = (await get(`${API}/cidadaos`)).cidadaos; } catch (e) { aviso(e.message, 'erro'); return; }
      }
      const naFolha = new Map(f.pessoas.map(p => [p.registro_id, p.nome]));
      const opcoes = [['', 'Escolha o cidadão'],
        ...f.pessoas.map(p => [p.registro_id, `${p.nome} (na folha)`]),
        ...cidadaosCache.filter(c => c.registrado && !naFolha.has(c.registro_id)).map(c => [c.registro_id, c.nome])];
      const pessoa = selecao(opcoes, '');
      const tipo = segmentado([['mais', 'Pagamento a mais'], ['desconto', 'Desconto']], 'mais');
      const valor = entradaNumero('', { min: '0.01' });
      const desc = entradaTexto('', { maxlength: '120', placeholder: 'Ex.: Turno extra no festival, Correção de entrega' });
      const just = areaTexto('', { maxlength: '500', rows: '2' });
      modalForm({
        titulo: `Ajuste na folha nº ${f.id}`, textoOk: 'Lançar ajuste',
        conteudo: [
          h('p', { class: 'form-intro' }, revisao ? 'O ajuste entra nesta folha e será aprovado junto com ela.' : 'A folha já foi aprovada: o ajuste é a forma registrada de corrigir. Ele volta a deixar algo a pagar.'),
          campo('Cidadão', pessoa, { obrigatorio: true }),
          h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Tipo'), tipo.el),
          h('div', { class: 'form-grade' }, campo('Valor (Lírios)', valor, { obrigatorio: true }), campo('Descrição', desc)),
          campo('Justificativa', just, { obrigatorio: true }),
        ],
        aoEnviar: async () => {
          if (!pessoa.value) throw new Error('Escolha o cidadão.');
          const v = Number(String(valor.value).replace(',', '.'));
          if (!(v > 0)) throw new Error('Informe um valor maior que zero.');
          const r = await enviarComAutorizacao(c => post(`${API}/folhas/${f.id}/ajustes`, {
            ...c, registro_id: Number(pessoa.value), valor: tipo.valor() === 'desconto' ? -v : v, descricao: desc.value, justificativa: just.value,
          }));
          if (!r) return false;
          aviso('Ajuste lançado.');
          recarregar();
        },
      });
    }
  }
  await desenhar();
}

function revisarItem(f, i, aoSalvar) {
  const valor = entradaNumero(i.valor, { min: i.tipo === 'ajuste' ? null : '0' });
  const just = areaTexto('', { maxlength: '500', rows: '2' });
  const aviso2 = h('p', { class: 'form-erro', hidden: true }, 'O valor fica acima do calculado. Explique bem na justificativa.');
  valor.addEventListener('input', () => { aviso2.hidden = !(Number(valor.value) > i.calculado) || i.tipo === 'ajuste'; });
  modalForm({
    titulo: `Revisar valor · ${i.cidadao_nome}`, textoOk: 'Salvar valor',
    conteudo: [
      h('p', { class: 'form-intro' }, `${i.profissao_nome ? `${i.profissao_nome}: ` : ''}${i.descricao}. Calculado: ${lirios(i.calculado)}.`),
      campo('Valor a pagar (Lírios)', valor, { obrigatorio: true }),
      aviso2,
      campo('Justificativa', just, { obrigatorio: true, ajuda: 'Por que o valor muda. Fica no histórico da folha.' }),
    ],
    aoEnviar: async () => {
      await put(`${API}/folhas/${f.id}/itens/${i.id}`, { valor: valor.value, justificativa: just.value });
      aviso('Valor revisado.');
      aoSalvar();
    },
  });
}

function recibo(f, pe) {
  const itens = f.itens.filter(i => i.registro_id === pe.registro_id);
  const pagos = itens.filter(i => i.pago);
  const ultimo = pagos.sort((a, b) => String(b.pago_em).localeCompare(String(a.pago_em)))[0];
  const falta = Math.round((pe.total - pe.pago) * 100) / 100;
  const linha = (rotulo, valor) => h('div', { class: 'doc-linha' }, h('span', { class: 'doc-rotulo' }, rotulo), h('span', { class: 'doc-valor' }, valor));
  const doc = h('div', { class: 'documento fin-recibo' },
    h('div', { class: 'doc-cab' },
      h('img', { src: '/img/brasao.png', alt: '', class: 'doc-brasao' }),
      h('p', { class: 'doc-sobre' }, 'Tesouro da Capital · Lyendell'),
      h('h3', { class: 'doc-titulo' }, 'Recibo de pagamento'),
      h('p', { class: 'doc-livro' }, `Folha nº ${f.id}, de ${periodoTexto(f.inicio, f.fim)}`)),
    h('div', { class: 'doc-campos' },
      linha('Cidadão', pe.nome),
      linha('Situação da folha', SIT_FOLHA[f.situacao]?.[0] || f.situacao),
      linha('Aprovada por', f.aprovado_por_nome ? `${f.aprovado_por_nome}, ${dataHora(f.aprovado_em)}` : 'ainda não aprovada'),
      linha('Total', lirios(pe.total)),
      linha('Pago', lirios(pe.pago)),
      linha('A receber', lirios(falta))),
    h('table', { class: 'fin-recibo-tabela' },
      h('thead', null, h('tr', null, h('th', null, 'Descrição'), h('th', { class: 'num' }, 'Valor'), h('th', null, 'Pagamento'))),
      h('tbody', null, itens.map(i => h('tr', null,
        h('td', null, `${i.profissao_nome ? `${i.profissao_nome}: ` : ''}${i.descricao}`, i.justificativa && h('small', { class: 'bloco' }, `Justificativa: ${i.justificativa}`)),
        h('td', { class: 'num' }, lirios(i.valor)),
        h('td', null, i.pago ? `pago em ${dataCurta(i.pago_em)}` : 'a pagar'))))),
    h('p', { class: 'doc-assinatura' }, falta <= 0 && pagos.length
      ? `Pago integralmente. Último pagamento em ${dataHora(ultimo.pago_em)}${ultimo.pago_por_nome ? `, por ${ultimo.pago_por_nome}` : ''}.`
      : `Ainda a pagar: ${lirios(falta)}.`));
  const m = modal({
    titulo: `Recibo · ${pe.nome}`, tamanho: 'medio', classe: 'modal-documento fin-modal-recibo', corpo: doc,
    rodape: [botao('Imprimir / salvar PDF', { icone: 'documento', onclick: () => imprimir('recibo') }), h('span', { class: 'espaco' }), botao('Fechar', { onclick: () => m.fechar() })],
  });
}

function csvFolha(f) {
  baixarCsv(`folha-${f.id}.csv`,
    ['Folha', 'Início', 'Fim', 'Situação da folha', 'Cidadão', 'Profissão', 'Tipo', 'Descrição', 'Calculado (Lírios)', 'Valor (Lírios)', 'Justificativa', 'Pago', 'Pago em', 'Pago por'],
    f.itens.map(i => [f.id, f.inicio, f.fim, SIT_FOLHA[f.situacao]?.[0] || f.situacao, i.cidadao_nome, i.profissao_nome || '', TIPO_ITEM[i.tipo] || i.tipo, i.descricao,
      csvNum(i.calculado), csvNum(i.valor), i.justificativa || '', i.pago ? 'Sim' : 'Não', i.pago_em ? dataHora(i.pago_em) : '', i.pago_por_nome || '']));
}

/* ─── 8. Tesouro e movimentações ─────────────────── */

export async function tesouro(corpo, { podes }) {
  const f = { inicio: '', fim: '', tipo: '' };
  const area = h('div', { class: 'fin-area' });
  const resumo = h('div');
  let dados = null;

  trocar(corpo,
    resumo,
    h('div', { class: 'fin-barra' },
      h('p', { class: 'form-intro' }, 'Toda entrada e saída do tesouro da Capital. Nada se apaga: para corrigir, estorne (lança o valor contrário com justificativa). Pagamentos de folha se corrigem com ajuste na folha.'),
      h('div', { class: 'fin-linha-acoes' },
        botao('Exportar CSV', { icone: 'baixar', onclick: () => dados && csvMovimentos(dados.movimentos) }),
        podes.gerir && botao('Nova movimentação', { icone: 'mais', classe: 'btn-ouro', onclick: () => formMovimento(desenhar) }))),
    h('div', { class: 'fin-filtros' },
      selecao([['', 'Todos os tipos'], ...Object.entries(TIPO_MOV)], '', { class: 'input filtro', 'aria-label': 'Tipo', onchange: e => { f.tipo = e.target.value; desenhar(); } })),
    seletorPeriodo({ inicio: '', fim: '', botao: 'Filtrar', aoMudar: (i, fim) => { f.inicio = i; f.fim = fim; desenhar(); } }),
    area);

  async function desenhar() {
    trocar(area, carregando());
    await seguro(area, async () => {
      dados = await get(`${API}/tesouro?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`);
      const t = dados.tesouro;
      trocar(resumo, h('div', { class: 'numeros fin-numeros' },
        cartao('moeda', t.saldo, 'Saldo atual', null, 'fin-destaque'),
        cartao('check', t.disponivel, 'Disponível', 'saldo menos o reservado'),
        cartao('cadeado', t.reservado, 'Reservado', 'folhas aprovadas a pagar'),
        cartao('baixar', t.receitas, 'Receitas'),
        cartao('enviar', t.despesas, 'Despesas'),
        cartao('documento', t.salarios_pagos, 'Salários pagos')));
      const ms = dados.movimentos;
      const entradas = ms.filter(m => m.valor > 0).reduce((s, m) => s + m.valor, 0);
      const saidas = ms.filter(m => m.valor < 0).reduce((s, m) => s - m.valor, 0);
      trocar(area,
        ms.length ? h('p', { class: 'fin-resumo' }, `${ms.length} ${ms.length === 1 ? 'movimentação' : 'movimentações'} na lista. Entradas: `, h('strong', { class: 'fin-entrada' }, lirios(entradas)), '. Saídas: ', h('strong', { class: 'fin-saida' }, lirios(saidas)), '.') : null,
        tabela(['Nº', 'Data', 'Tipo', 'Descrição', 'Valor', 'Quem', ''], ms.map(m => h('tr', { class: m.estornado ? 'inativo' : null },
          td('Nº', String(m.id)),
          td('Data', dataHora(m.criado_em)),
          td('Tipo', h('div', { class: 'chips' }, h('span', { class: `etiqueta ${m.valor < 0 ? 'fin-ruim' : 'fin-bom'}` }, TIPO_MOV[m.tipo] || m.tipo),
            m.estornado && h('span', { class: 'etiqueta' }, 'Estornado'), m.estorno_de && h('span', { class: 'etiqueta' }, `estorno do nº ${m.estorno_de}`),
            m.excecao && h('span', { class: 'etiqueta fin-ruim', title: `${m.excecao.por}: ${m.excecao.justificativa}` }, icone('alerta'), 'Exceção'))),
          td('Descrição', [h('strong', null, m.descricao),
            (m.categoria || m.periodo) && h('small', { class: 'suave bloco' }, [m.categoria, m.periodo].filter(Boolean).join(', ')),
            m.folha_id && h('a', { class: 'bloco', href: `#/financas/folha/${m.folha_id}` }, `Folha nº ${m.folha_id}`),
            m.justificativa && h('small', { class: 'bloco fin-just' }, icone('pena'), m.justificativa),
            m.excecao && h('small', { class: 'bloco fin-saida' }, `Exceção autorizada por ${m.excecao.por}: ${m.excecao.justificativa}`)]),
          td('Valor', valorSinal(m.valor), 'num'),
          td('Quem', h('small', null, m.criado_por_nome || 'Sistema', m.autorizado_por_nome && h('span', { class: 'suave bloco' }, `aprovado por ${m.autorizado_por_nome}`))),
          h('td', { class: 'acoes-linha' }, podes.aprovar && !m.estornado && !['salario', 'estorno'].includes(m.tipo)
            && botao('Estornar', { classe: 'btn-pequeno btn-perigo-texto', onclick: () => estornar(m) })))),
        { vazio: 'Nenhuma movimentação com esses filtros.' }));
    });
  }

  async function estornar(m) {
    const j = await pedirTexto({
      titulo: `Estornar a movimentação nº ${m.id}?`,
      texto: `"${m.descricao}" (${lirios(m.valor)}). O estorno lança o valor contrário (${lirios(-m.valor)}) no tesouro. A movimentação original continua na lista, marcada como estornada.`,
      ok: 'Estornar', perigo: true,
    });
    if (!j) return;
    try {
      const r = await enviarComAutorizacao(c => post(`${API}/movimentos/${m.id}/estornar`, { ...c, justificativa: j }));
      if (!r) return;
      aviso('Movimentação estornada.');
      desenhar();
    } catch (e) { aviso(e.message, 'erro'); }
  }
  await desenhar();
}

function formMovimento(aoSalvar) {
  const direcao = segmentado([['entrada', 'Entrada'], ['saida', 'Saída']], 'entrada');
  const caixaDirecao = h('div', { class: 'campo', hidden: true }, h('span', { class: 'campo-rotulo' }, 'Direção'), direcao.el);
  const rotJust = h('b', { class: 'obrig', hidden: true }, ' *');
  const tipo = segmentado([['receita', 'Receita'], ['despesa', 'Despesa'], ['ajuste', 'Ajuste'], ['transferencia', 'Transferência']], 'receita', v => {
    caixaDirecao.hidden = !['ajuste', 'transferencia'].includes(v);
    rotJust.hidden = caixaDirecao.hidden;
  });
  const valor = entradaNumero('', { min: '0.01' });
  const desc = entradaTexto('', { maxlength: '160', placeholder: 'Ex.: Imposto do Mercado, Compra de tochas para a Guarda' });
  const cat = entradaTexto('', { maxlength: '60', placeholder: 'Ex.: Impostos, Obras' });
  const per = entradaTexto('', { maxlength: '40', placeholder: 'Ex.: semana 40, outubro' });
  const just = areaTexto('', { maxlength: '500', rows: '2' });
  modalForm({
    titulo: 'Nova movimentação', textoOk: 'Lançar', tamanho: 'medio',
    conteudo: [
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Tipo'), tipo.el,
        h('small', { class: 'campo-ajuda' }, 'Receita entra no tesouro, despesa sai. Ajuste e transferência podem ir para os dois lados e sempre pedem justificativa.')),
      caixaDirecao,
      h('div', { class: 'form-grade' }, campo('Valor (Lírios)', valor, { obrigatorio: true }), campo('Descrição', desc, { obrigatorio: true })),
      h('div', { class: 'form-grade' }, campo('Categoria', cat), campo('Período de referência', per)),
      h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Justificativa', rotJust), just),
    ],
    aoEnviar: async () => {
      const t = tipo.valor();
      const corpo = { tipo: t, valor: valor.value, descricao: desc.value, categoria: cat.value, periodo: per.value, justificativa: just.value };
      if (t === 'ajuste' || t === 'transferencia') {
        corpo.direcao = direcao.valor();
        if (just.value.trim().length < 5) throw new Error('Ajuste e transferência pedem justificativa (pelo menos 5 letras).');
      }
      const saida = t === 'despesa' || corpo.direcao === 'saida';
      if (saida && !await confirmar(`Sair ${lirios(Number(String(valor.value).replace(',', '.')) || 0)} do tesouro?`, { titulo: 'Confirmar saída', ok: 'Lançar saída' })) return false;
      const r = await enviarComAutorizacao(c => post(`${API}/movimentos`, { ...corpo, ...c }));
      if (!r) return false;
      aviso('Movimentação lançada.');
      aoSalvar();
    },
  });
}

function csvMovimentos(ms, nome = 'tesouro-movimentacoes.csv') {
  baixarCsv(nome, ['Nº', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Período', 'Valor (Lírios)', 'Folha', 'Justificativa', 'Exceção', 'Estornado', 'Estorno de', 'Lançado por', 'Aprovado por'],
    ms.map(m => [m.id, dataHora(m.criado_em), TIPO_MOV[m.tipo] || m.tipo, m.descricao, m.categoria || '', m.periodo || '', csvNum(m.valor), m.folha_id || '', m.justificativa || '',
      m.excecao ? (typeof m.excecao === 'string' ? m.excecao : `${m.excecao.por}: ${m.excecao.justificativa}`) : '', m.estornado ? 'Sim' : '', m.estorno_de || '', m.criado_por_nome || '', m.autorizado_por_nome || '']));
}

/* ─── 9. Relatórios ──────────────────────────────── */

const RELATORIOS = [
  ['profissao', 'Por profissão'], ['producao', 'Produção por trabalhador'], ['presencas', 'Presenças e turnos'],
  ['movimentos', 'Receitas e despesas'], ['pendentes', 'Pagamentos pendentes'], ['folhas', 'Histórico de folhas'],
];

export async function relatorios(corpo) {
  let tipo = 'profissao';
  let periodo = mesDe();
  const area = h('div', { class: 'fin-area' });
  const seg = segmentado(RELATORIOS, tipo, v => { tipo = v; desenhar(); });
  trocar(corpo,
    h('div', { class: 'fin-filtros' }, seg.el),
    seletorPeriodo({ ...periodo, botao: 'Gerar', aoMudar: (i, f) => { periodo = { inicio: i, fim: f }; desenhar(); } }),
    area);

  async function desenhar() {
    trocar(area, carregando());
    await seguro(area, async () => {
      const q = new URLSearchParams(Object.entries(periodo).filter(([, v]) => v));
      const sufixo = `${periodo.inicio || 'inicio'}_${periodo.fim || 'hoje'}`;
      const csv = (cab, linhas) => botao('Exportar CSV', { icone: 'baixar', classe: 'btn-pequeno', onclick: () => baixarCsv(`relatorio-${tipo}-${sufixo}.csv`, cab, linhas) });
      const titulo = RELATORIOS.find(r => r[0] === tipo)[1];
      const caixa = (conteudo, botaoCsv, nota) => painel(titulo, 'documento', [nota && h('p', { class: 'suave fin-mb' }, nota), conteudo], botaoCsv);

      if (tipo === 'profissao') {
        const { linhas } = await get(`${API}/relatorios/profissao?${q}`);
        trocar(area, caixa(tabela(['Profissão', 'Pessoas', 'Total', 'Pago', 'A pagar'], linhas.map(l => h('tr', null,
          td('Profissão', h('strong', null, l.profissao)), td('Pessoas', String(l.pessoas)), td('Total', lirios(l.total), 'num'), td('Pago', lirios(l.pago), 'num'),
          td('A pagar', lirios(Math.round((l.total - l.pago) * 100) / 100), 'num'))), { vazio: 'Nenhuma folha aprovada no período.' }),
        csv(['Profissão', 'Pessoas', 'Total (Lírios)', 'Pago (Lírios)', 'A pagar (Lírios)'], linhas.map(l => [l.profissao, l.pessoas, csvNum(l.total), csvNum(l.pago), csvNum(l.total - l.pago)])),
        'Folhas aprovadas e pagas que cobrem o período.'));
      } else if (tipo === 'producao') {
        const { linhas } = await get(`${API}/relatorios/producao?${q}`);
        trocar(area, caixa(tabela(['Trabalhador', 'Produto', 'Aceita', 'Esperando', 'Rejeitada', 'Valor aceito', 'Entregas'], linhas.map(l => h('tr', null,
          td('Trabalhador', [h('a', { href: `#/financas/cidadao/${l.registro_id}` }, l.cidadao_nome), h('small', { class: 'suave bloco' }, l.profissao)]),
          td('Produto', l.item), td('Aceita', `${num(l.aceita)} ${l.unidade}`), td('Esperando', num(l.pendente)), td('Rejeitada', num(l.rejeitada)),
          td('Valor aceito', lirios(l.valor), 'num'), td('Entregas', String(l.entregas)))), { vazio: 'Nenhuma entrega no período.' }),
        csv(['Trabalhador', 'Profissão', 'Produto', 'Unidade', 'Aceita', 'Esperando', 'Rejeitada', 'Valor aceito (Lírios)', 'Entregas'],
          linhas.map(l => [l.cidadao_nome, l.profissao, l.item, l.unidade, csvNum(l.aceita), csvNum(l.pendente), csvNum(l.rejeitada), csvNum(l.valor), l.entregas]))));
      } else if (tipo === 'presencas') {
        const { linhas } = await get(`${API}/relatorios/presencas?${q}`);
        trocar(area, caixa(tabela(['Cidadão', 'Presenças', 'Faltas', 'Justificadas', 'Licenças', 'Missões', 'Turnos'], linhas.map(l => h('tr', null,
          td('Cidadão', [h('a', { href: `#/financas/cidadao/${l.registro_id}` }, l.cidadao_nome), h('small', { class: 'suave bloco' }, l.profissao)]),
          td('Presenças', String(l.presentes)), td('Faltas', String(l.faltas)), td('Justificadas', String(l.justificadas)), td('Licenças', String(l.licencas)),
          td('Missões', String(l.missoes)), td('Turnos', h('strong', null, num(l.turnos))))), { vazio: 'Nenhuma presença no período.' }),
        csv(['Cidadão', 'Profissão', 'Presenças', 'Faltas', 'Justificadas', 'Licenças', 'Missões', 'Turnos'],
          linhas.map(l => [l.cidadao_nome, l.profissao, l.presentes, l.faltas, l.justificadas, l.licencas, l.missoes, csvNum(l.turnos)])),
        'Turnos: presença, licença e missão oficial.'));
      } else if (tipo === 'movimentos') {
        const { linhas, entradas, saidas } = await get(`${API}/relatorios/movimentos?${q}`);
        trocar(area, caixa([
          h('p', { class: 'fin-resumo' }, 'Entradas: ', h('strong', { class: 'fin-entrada' }, lirios(entradas)), '. Saídas: ', h('strong', { class: 'fin-saida' }, lirios(saidas)),
            '. Resultado: ', valorSinal(Math.round((entradas - saidas) * 100) / 100), '.'),
          tabela(['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor'], linhas.map(m => h('tr', null,
            td('Data', dataHora(m.criado_em)), td('Tipo', TIPO_MOV[m.tipo] || m.tipo), td('Descrição', m.descricao), td('Categoria', m.categoria || h('span', { class: 'suave' }, 'nenhuma')),
            td('Valor', valorSinal(m.valor), 'num'))), { vazio: 'Nenhuma movimentação no período.' }),
        ], botao('Exportar CSV', { icone: 'baixar', classe: 'btn-pequeno', onclick: () => csvMovimentos(linhas, `relatorio-movimentos-${sufixo}.csv`) })));
      } else if (tipo === 'pendentes') {
        const { itens, entregas, folhas: emRevisao } = await get(`${API}/relatorios/pendentes`);
        const totalItens = itens.reduce((s, i) => s + i.valor, 0);
        trocar(area, caixa([
          h('h3', { class: 'fin-sub' }, `Itens aprovados ainda não pagos (${lirios(Math.round(totalItens * 100) / 100)})`),
          tabela(['Folha', 'Cidadão', 'Descrição', 'Valor'], itens.map(i => h('tr', null,
            td('Folha', h('a', { href: `#/financas/folha/${i.folha_id}` }, `nº ${i.folha_id}, ${periodoTexto(i.inicio, i.fim)}`)), td('Cidadão', i.cidadao_nome),
            td('Descrição', `${i.profissao_nome ? `${i.profissao_nome}: ` : ''}${i.descricao}`), td('Valor', lirios(i.valor), 'num'))), { vazio: 'Nada aprovado esperando pagamento.' }),
          h('h3', { class: 'fin-sub' }, `Entregas esperando conferência (${entregas.length})`),
          tabela(['Dia', 'Trabalhador', 'Produto', 'Quantidade'], entregas.map(e => h('tr', null,
            td('Dia', dataCurta(e.data)), td('Trabalhador', e.cidadao_nome), td('Produto', e.item_nome), td('Quantidade', `${num(e.quantidade)} ${e.unidade}`))), { vazio: 'Nenhuma entrega esperando.' }),
          h('h3', { class: 'fin-sub' }, `Folhas em revisão (${emRevisao.length})`),
          tabela(['Folha', 'Período', 'Fechada por'], emRevisao.map(fo => h('tr', null,
            td('Folha', h('a', { href: `#/financas/folha/${fo.id}` }, `Folha nº ${fo.id}`)), td('Período', periodoTexto(fo.inicio, fo.fim)), td('Fechada por', fo.criado_por_nome || ''))), { vazio: 'Nenhuma folha em revisão.' }),
        ], csv(['Pendência', 'Folha', 'Cidadão', 'Descrição', 'Dia ou período', 'Quantidade', 'Valor (Lírios)'], [
          ...itens.map(i => ['Item aprovado a pagar', i.folha_id, i.cidadao_nome, `${i.profissao_nome ? `${i.profissao_nome}: ` : ''}${i.descricao}`, `${i.inicio} a ${i.fim}`, '', csvNum(i.valor)]),
          ...entregas.map(e => ['Entrega esperando conferência', '', e.cidadao_nome, e.item_nome, e.data, `${csvNum(e.quantidade)} ${e.unidade}`, '']),
          ...emRevisao.map(fo => ['Folha em revisão', fo.id, '', '', `${fo.inicio} a ${fo.fim}`, '', '']),
        ]), 'Mostra tudo o que está pendente agora (não depende do período).'));
      } else {
        const { folhas: todas } = await get(`${API}/folhas`);
        const lista = todas.filter(fo => (!periodo.fim || fo.inicio <= periodo.fim) && (!periodo.inicio || fo.fim >= periodo.inicio));
        trocar(area, caixa(tabela(['Folha', 'Período', 'Situação', 'Total', 'Pago', 'Pessoas', 'Aprovada por'], lista.map(fo => h('tr', null,
          td('Folha', h('a', { href: `#/financas/folha/${fo.id}` }, `Folha nº ${fo.id}`)), td('Período', periodoTexto(fo.inicio, fo.fim)), td('Situação', etiqueta(SIT_FOLHA, fo.situacao)),
          td('Total', lirios(fo.total), 'num'), td('Pago', lirios(fo.pago), 'num'), td('Pessoas', String(fo.pessoas)),
          td('Aprovada por', fo.aprovado_por_nome || h('span', { class: 'suave' }, fo.rejeitado_por_nome ? `rejeitada por ${fo.rejeitado_por_nome}` : 'ainda não')))), { vazio: 'Nenhuma folha no período.' }),
        csv(['Folha', 'Início', 'Fim', 'Situação', 'Total (Lírios)', 'Pago (Lírios)', 'Pessoas', 'Fechada por', 'Aprovada por', 'Rejeitada por', 'Motivo'],
          lista.map(fo => [fo.id, fo.inicio, fo.fim, SIT_FOLHA[fo.situacao]?.[0] || fo.situacao, csvNum(fo.total), csvNum(fo.pago), fo.pessoas, fo.criado_por_nome || '', fo.aprovado_por_nome || '', fo.rejeitado_por_nome || '', fo.motivo || '']))));
      }
    });
  }
  await desenhar();
}

/* ─── 10. Configurações ──────────────────────────── */

export async function configuracoes(corpo, { podes }) {
  const { config } = await get(`${API}/config`);
  const teto = entradaNumero(config.teto_folha, { disabled: !podes.gerir });
  const reserva = entradaNumero(config.reserva, { disabled: !podes.gerir });
  const freq = entradaFrequencia(config.frequencia_padrao);
  if (!podes.gerir) freq.el.querySelectorAll('select, input').forEach(el => { el.disabled = true; });
  const just = areaTexto('', { maxlength: '500', rows: '2', disabled: !podes.gerir });
  const erro = h('p', { class: 'form-erro', hidden: true });
  const salvar = botao('Salvar configurações', { icone: 'check', classe: 'btn-ouro' });
  salvar.addEventListener('click', async () => {
    erro.hidden = true;
    salvar.disabled = true;
    try {
      await put(`${API}/config`, { teto_folha: teto.value, reserva: reserva.value, frequencia_padrao: freq.valor(), justificativa: just.value });
      just.value = '';
      aviso('Configurações salvas.');
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    } finally { salvar.disabled = false; }
  });
  trocar(corpo, h('div', { class: 'fin-config' },
    h('p', { class: 'nota nota-ouro' }, icone('alerta'), h('span', null, h('strong', null, 'Os limites só geram alertas. '), 'Passar do teto ou da reserva aparece como aviso na prévia e na folha, mas nunca corta nem reduz pagamento.')),
    painel('Orçamento da folha', 'balanca', h('div', { class: 'form' },
      campo('Teto de planejamento da folha (Lírios)', teto, { ajuda: 'Quanto se espera gastar numa folha regular. Use 0 para não ter teto.' }),
      campo('Reserva mínima do tesouro (Lírios)', reserva, { ajuda: 'Avisa quando o disponível depois da folha fica abaixo disso.' }),
      campo('Frequência padrão de pagamento', freq.el, { ajuda: 'Sugestão para as profissões novas. Cada profissão tem a sua na Tabela de salários.' }),
      podes.gerir && campo('Justificativa', just, { ajuda: 'Opcional. Fica no histórico.' }),
      erro,
      podes.gerir && h('div', { class: 'fin-linha-acoes' }, salvar))),
    painel('Salários e valores', 'moeda', h('p', null, 'Os salários das profissões, a frequência de cada uma e os valores por produto ficam na ', h('a', { href: '#/financas/salarios' }, 'Tabela de salários'), '.'))));
}
