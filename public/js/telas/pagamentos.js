import {
  estado, get, post, put, del, h, trocar, icone, botao, modal, modalForm, confirmar, aviso, tentar, dataCurta,
} from '../core.js';
import { livroDePagamentos } from '../livro-mc.js';

// Tabela de pagamentos de um registro (ex.: comerciante que paga a cada 14 dias).
// Todos veem; só quem tem a permissão de pagamentos (a Tabeliã) marca como pago.

const SITUACAO = {
  pago: { texto: 'Pago', classe: 'pg-pago', icone: 'check' },
  atrasado: { texto: 'Atrasado', classe: 'pg-atrasado', icone: 'alerta' },
  hoje: { texto: 'Vence hoje', classe: 'pg-hoje', icone: 'relogio' },
  proximo: { texto: 'Próximo', classe: 'pg-proximo', icone: 'calendario' },
  futuro: { texto: 'A vencer', classe: 'pg-futuro', icone: 'calendario' },
};

const RAPIDOS = [['Lírios', 'Lírios: '], ['Itens', 'Itens: '], ['Serviço', 'Serviço prestado: ']];

const diaMes = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function resumoCobranca(c) {
  if (!c || c.semInicio) return h('span', { class: 'suave' }, 'sem data de início');
  if (c.atrasados) return h('span', { class: 'etiqueta pg-atrasado' }, icone('alerta'), `${c.atrasados} ${c.atrasados === 1 ? 'atrasado' : 'atrasados'}`);
  if (c.encerrada) return h('span', { class: 'etiqueta' }, 'Encerrada');
  if (c.venceHoje) return h('span', { class: 'etiqueta pg-hoje' }, icone('relogio'), 'Vence hoje');
  return h('span', { class: 'etiqueta pg-pago' }, icone('check'), c.proximo ? `Em dia · ${diaMes(c.proximo)}` : 'Em dia');
}

export function verPagamentos(registroId, aoMudar) {
  const corpo = h('div', { class: 'pagamentos' }, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
  let dados = null;
  let mudou = false;
  const btnBook = botao('Baixar .book', {
    icone: 'baixar', desativado: true,
    onclick: () => dados && livroDePagamentos(dados, estado.eu.nome).baixar(),
  });
  const janela = modal({
    titulo: 'Pagamentos', tamanho: 'grande', corpo,
    aoFechar: () => { if (mudou) aoMudar?.(); },
    rodape: [btnBook, h('span', { class: 'espaco' }), botao('Fechar', { onclick: () => janela.fechar() })],
  });

  async function carregar() {
    try {
      dados = await get(`/api/registros/${registroId}/pagamentos`);
    } catch (e) {
      trocar(corpo, h('p', { class: 'form-erro' }, e.message));
      return;
    }
    btnBook.disabled = false;
    janela.caixa.querySelector('.modal-cab h2').textContent = `Pagamentos · ${dados.registro.titulo}`;
    desenhar();
  }

  function desenhar() {
    const d = dados;
    if (!d.inicio) {
      trocar(corpo, h('p', { class: 'nota' }, icone('alerta'),
        `Preencha "${d.campoInicio}" neste registro para os pagamentos começarem a contar.`));
      return;
    }

    const linhas = d.parcelas.map(x => {
      const s = SITUACAO[x.status];
      const pendente = x.status === 'atrasado' || x.status === 'hoje';
      return h('tr', { class: `parcela ${s.classe}`, 'data-status': x.status },
        h('td', { class: 'pg-marca' }, h('span', { class: 'pg-bolinha', title: s.texto }, x.status === 'pago' ? icone('check') : '')),
        h('td', { 'data-rotulo': 'Parcela' }, x.numero ? `${x.numero}ª` : 'Avulsa'),
        h('td', { 'data-rotulo': 'Período', class: 'suave nowrap' }, x.inicio ? `${diaMes(x.inicio)} a ${diaMes(x.vencimento)}` : ''),
        h('td', { 'data-rotulo': 'Vencimento' }, h('strong', null, dataCurta(x.vencimento))),
        h('td', { 'data-rotulo': 'Situação' },
          h('span', { class: `etiqueta ${s.classe}` }, icone(s.icone),
            x.status === 'atrasado' ? `Atrasado há ${x.diasAtraso} ${x.diasAtraso === 1 ? 'dia' : 'dias'}` : s.texto),
          x.pagamento && h('small', { class: 'suave bloco' }, `em ${dataCurta(x.pagamento.pago_em)}`)),
        h('td', { 'data-rotulo': 'Observação', class: 'pg-obs' },
          x.pagamento && [h('span', null, x.pagamento.observacao), h('small', { class: 'suave bloco' }, `marcado por ${x.pagamento.marcado_por_nome}`)]),
        h('td', { class: 'acoes-linha' }, d.podeMarcar && (x.pagamento
          ? botao('Desfazer', { classe: 'btn-pequeno btn-fantasma', onclick: () => desfazer(x) })
          : botao('Marcar como paga', { icone: 'check', classe: `btn-pequeno ${pendente ? 'btn-ouro' : ''}`.trim(), onclick: () => marcar(x) }))));
    });

    trocar(corpo,
      h('div', { class: 'pg-resumo' },
        h('p', null, `Pagamento a cada ${d.intervalo} dias, contando de ${dataCurta(d.inicio)} (${d.campoInicio}).`),
        h('div', { class: 'chips' },
          d.atrasados
            ? h('span', { class: 'etiqueta pg-atrasado' }, icone('alerta'), `${d.atrasados} ${d.atrasados === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}`)
            : h('span', { class: 'etiqueta pg-pago' }, icone('check'), 'Em dia'),
          d.proximo && h('span', { class: 'etiqueta' }, icone('calendario'), `Próximo: ${dataCurta(d.proximo)}`),
          d.fim && h('span', { class: 'etiqueta' }, `Cobrança encerrada em ${dataCurta(d.fim)}`)),
        d.podeMarcar
          ? h('div', { class: 'pg-ferramentas' }, d.fim
            ? botao('Retomar cobrança', { classe: 'btn-pequeno', onclick: retomar })
            : botao('Encerrar cobrança', { classe: 'btn-pequeno btn-perigo-texto', onclick: encerrar }))
          : h('p', { class: 'suave' }, 'Só a Tabeliã marca os pagamentos.')),
      d.parcelas.length
        ? h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela tabela-responsiva tabela-pagamentos' },
          h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Parcela'), h('th', null, 'Período'), h('th', null, 'Vencimento'),
            h('th', null, 'Situação'), h('th', null, 'Observação'), h('th', null, ''))),
          h('tbody', null, linhas)))
        : h('p', { class: 'tabela-vazia' }, 'Nenhuma parcela ainda.'));

    // Leva a lista até a primeira parcela que precisa de atenção.
    requestAnimationFrame(() => {
      corpo.querySelector('[data-status="atrasado"], [data-status="hoje"], [data-status="proximo"]')?.scrollIntoView({ block: 'center' });
    });
  }

  function marcar(x) {
    const obs = h('textarea', { class: 'input', rows: '3', maxlength: '300', placeholder: 'Ex.: 30 Lírios, ou 2 pacotes de trigo' });
    const data = h('input', { class: 'input', type: 'date', value: hojeLocal(), max: hojeLocal() });
    const rapidos = h('div', { class: 'segmentado' }, RAPIDOS.map(([n, prefixo]) => h('button', {
      type: 'button', class: 'seg',
      onclick: () => { obs.value = prefixo; obs.focus(); obs.setSelectionRange(prefixo.length, prefixo.length); },
    }, n)));
    modalForm({
      titulo: `Marcar como paga · ${dataCurta(x.vencimento)}`,
      textoOk: 'Marcar como paga',
      conteudo: [
        h('p', { class: 'form-intro' }, `${dados.registro.titulo}: ${x.numero ? `${x.numero}ª parcela, ` : ''}com vencimento em ${dataCurta(x.vencimento)}.`),
        h('div', { class: 'campo' },
          h('span', { class: 'campo-rotulo' }, 'Como foi pago', h('b', { class: 'obrig' }, ' *')),
          rapidos, obs,
          h('small', { class: 'campo-ajuda' }, 'Obrigatório. Diga se foi em Lírios (e quantos) ou com o que foi pago.')),
        h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Data do pagamento'), data),
      ],
      aoEnviar: async () => {
        if (!obs.value.trim() || RAPIDOS.some(([, p]) => obs.value.trim() === p.trim())) throw new Error('Escreva como foi pago.');
        await post(`/api/registros/${registroId}/pagamentos`, { vencimento: x.vencimento, observacao: obs.value, pago_em: data.value });
        aviso('Pagamento registrado.');
        mudou = true;
        await carregar();
      },
    });
  }

  async function desfazer(x) {
    if (!await confirmar(`O pagamento da parcela de ${dataCurta(x.vencimento)} será desmarcado.`, { ok: 'Desmarcar', perigo: true })) return;
    if (await tentar(() => del(`/api/pagamentos/${x.pagamento.id}`), 'Pagamento desmarcado.')) { mudou = true; carregar(); }
  }

  async function encerrar() {
    const ok = await confirmar(`${dados.registro.titulo} deixa de ser cobrado pelas parcelas que vencem depois de hoje. Use quando o comércio fechar. As parcelas já vencidas continuam na lista.`, { titulo: 'Encerrar cobrança?', ok: 'Encerrar' });
    if (ok && await tentar(() => put(`/api/registros/${registroId}/cobranca`, { fim: hojeLocal() }), 'Cobrança encerrada.')) { mudou = true; carregar(); }
  }

  async function retomar() {
    if (await tentar(() => put(`/api/registros/${registroId}/cobranca`, { fim: null }), 'Cobrança retomada.')) { mudou = true; carregar(); }
  }

  carregar();
}
