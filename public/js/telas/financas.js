// Gestão Financeira (folha de pagamento) da Capital, em Lírios. Quem cuida é o Mestre da Moeda;
// a Família Nobre acompanha tudo só para consulta. O servidor confere as permissões: aqui só
// escondemos os botões de quem não pode mexer (financas.gerir, financas.aprovar).
// Esta tela é carregada só quando alguém abre #/financas (import dinâmico em app.js).
import {
  get, post, put, h, trocar, icone, botao, cabecalho, modalForm, confirmar, aviso, tentar, campo, interruptor,
  num, dataCurta, dataHora, hojeIso, normalizar,
} from '../core.js';
import {
  API, lirios, valorSinal, diaDaSemana, diasEntre, listaDeDias, semanaDe, periodoTexto, SEMANA_CURTA,
  nomeFrequencia, SIT_VINCULO, SIT_FOLHA, SIT_ENTREGA, SIT_PRESENCA, TIPO_MOV, etiqueta, chipDemo, chipTravado,
  td, tabela, painel, carregando, entradaData, entradaNumero, entradaTexto, areaTexto, selecao, segmentado,
  entradaFrequencia, seletorPeriodo, pedirTexto, listaAuditoria,
} from './financas-comum.js';
import { gerarFolha, folhas, folha, tesouro, relatorios, configuracoes } from './financas-folha.js';

const ABAS = [
  ['visao', 'Visão geral'],
  ['cidadaos', 'Cidadãos e profissões'],
  ['presencas', 'Presenças e turnos'],
  ['producao', 'Produção e entregas'],
  ['salarios', 'Tabela de salários'],
  ['gerar', 'Gerar folha'],
  ['folhas', 'Folhas'],
  ['tesouro', 'Tesouro e movimentações'],
  ['relatorios', 'Relatórios'],
  ['config', 'Configurações'],
];

const TELAS = {
  visao, cidadaos, cidadao, presencas, producao, salarios,
  gerar: gerarFolha, folhas, folha, tesouro, relatorios, config: configuracoes,
};
// Páginas de detalhe ficam com a aba de onde vieram acesa.
const ABA_DE = { cidadao: 'cidadaos', folha: 'folhas' };

export async function financas(aba = 'visao', id = null) {
  if (!TELAS[aba] || (ABA_DE[aba] && !id)) aba = ABA_DE[aba] || 'visao';
  const painelDados = await get(`${API}/painel`);
  const podes = painelDados.podes || {};
  const ctx = { painel: painelDados, podes };
  const ativa = ABA_DE[aba] || aba;
  const c = painelDados.contagens;
  const contas = {
    producao: [c.entregas_pendentes, 'entregas esperando conferência'],
    folhas: [c.folhas_revisao + c.folhas_a_pagar, 'folhas em revisão ou a pagar'],
    salarios: [c.profissoes_demonstracao + c.itens_demonstracao, 'valores de demonstração ainda não conferidos'],
  };
  const corpo = h('div', { class: 'fin-corpo' }, carregando());
  const raiz = h('div', { class: 'pagina fin' },
    cabecalho({
      titulo: 'Gestão Financeira', icone: 'moeda',
      sub: 'O tesouro da Capital, em Lírios: profissões e salários, presenças, produção entregue, folhas de pagamento e movimentações.',
    }),
    !podes.gerir && !podes.aprovar && h('p', { class: 'nota fin-nao-imprime' }, icone('olho'),
      'Você acompanha a Gestão Financeira só para consulta. Quem lança e paga é o Mestre da Moeda.'),
    h('nav', { class: 'abas fin-abas', 'aria-label': 'Partes da Gestão Financeira' }, ABAS.map(([k, nome]) => {
      const [n, dica] = contas[k] || [0];
      return h('a', { class: `aba ${k === ativa ? 'ativa' : ''}`.trim(), href: `#/financas/${k}`, 'aria-current': k === ativa ? 'page' : null },
        nome, n ? h('span', { class: `aba-n ${k === 'salarios' ? '' : 'aba-alerta'}`.trim(), title: `${n} ${dica}` }, n) : null);
    })),
    corpo);
  await TELAS[aba](corpo, ctx, id);
  // No celular as abas rolam de lado: deixa a aba aberta à vista.
  requestAnimationFrame(() => {
    const nav = raiz.querySelector('.fin-abas');
    const atual = nav?.querySelector('.aba.ativa');
    if (atual && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = atual.offsetLeft - nav.offsetLeft - 16;
  });
  return raiz;
}

// Recarrega uma parte da tela mostrando o erro no lugar, se houver.
async function seguro(area, fn) {
  try { await fn(); } catch (e) { trocar(area, h('p', { class: 'form-erro' }, e.message)); }
}

/* ─── 1. Visão geral ─────────────────────────────── */

function cartaoNumero(ic, valor, nome, dica, classe = '') {
  return h('div', { class: `numero fin-numero ${classe}`.trim() },
    h('span', { class: 'numero-icone' }, icone(ic)),
    h('strong', null, num(valor), h('small', { class: 'fin-moeda' }, ' Lírios')),
    h('span', null, nome, dica && h('small', { class: 'fin-dica' }, dica)));
}

async function visao(corpo, { painel: p }) {
  const t = p.tesouro;
  const c = p.contagens;
  const { folhas: lista } = await get(`${API}/folhas`);
  const demo = c.profissoes_demonstracao + c.itens_demonstracao;
  const pend = [
    c.entregas_pendentes && ['producao', 'bau', `${c.entregas_pendentes} ${c.entregas_pendentes === 1 ? 'entrega espera' : 'entregas esperam'} conferência`, 'Conferir'],
    c.folhas_revisao && ['folhas', 'documento', `${c.folhas_revisao} ${c.folhas_revisao === 1 ? 'folha está' : 'folhas estão'} em revisão, esperando aprovação`, 'Revisar'],
    c.folhas_a_pagar && ['folhas', 'moeda', `${c.folhas_a_pagar} ${c.folhas_a_pagar === 1 ? 'folha aprovada espera' : 'folhas aprovadas esperam'} pagamento`, 'Pagar'],
    demo && ['salarios', 'alerta', `${demo} ${demo === 1 ? 'valor de demonstração ainda não foi conferido' : 'valores de demonstração ainda não foram conferidos'} na Tabela de salários`, 'Conferir'],
  ].filter(Boolean);

  trocar(corpo,
    h('div', { class: 'numeros fin-numeros' },
      cartaoNumero('moeda', t.saldo, 'Saldo atual', 'o que existe hoje no tesouro', 'fin-destaque'),
      cartaoNumero('check', t.disponivel, 'Disponível', 'saldo menos o reservado'),
      cartaoNumero('cadeado', t.reservado, 'Reservado', 'folhas aprovadas ainda não pagas'),
      cartaoNumero('baixar', t.receitas, 'Receitas', 'entradas (sem o saldo inicial)'),
      cartaoNumero('enviar', t.despesas, 'Despesas', 'saídas que não são salários'),
      cartaoNumero('relogio', t.salarios_previstos, 'Salários previstos', 'folhas em revisão: ainda não é dinheiro pago', 'fin-previsto'),
      cartaoNumero('documento', t.salarios_aprovados, 'Salários aprovados', 'folhas aprovadas ou pagas'),
      cartaoNumero('moeda', t.salarios_pagos, 'Salários pagos', 'já saíram do tesouro')),
    h('p', { class: 'nota' }, icone('alerta'),
      h('span', null, h('strong', null, 'Previsto não é pago. '),
        'Uma folha em revisão só mostra quanto vai custar. Ao ser aprovada, o valor fica reservado; o dinheiro só sai do tesouro quando a folha é paga.')),
    h('div', { class: 'fin-grade' },
      painel('Pendências', 'tarefas', pend.length
        ? h('div', { class: 'fin-pendencias' }, pend.map(([aba, ic, texto, acao]) => h('a', { class: 'nota nota-link nota-ouro', href: `#/financas/${aba}` }, icone(ic), h('span', null, texto), h('strong', null, acao))))
        : h('p', { class: 'painel-vazio' }, 'Nada pendente. Tudo em dia.')),
      painel('Orçamento', 'balanca', [h('dl', { class: 'fin-dl' },
        h('dt', null, 'Teto de planejamento da folha'), h('dd', null, lirios(p.config.teto_folha)),
        h('dt', null, 'Reserva mínima do tesouro'), h('dd', null, lirios(p.config.reserva)),
        h('dt', null, 'Frequência padrão'), h('dd', null, nomeFrequencia(p.config.frequencia_padrao)),
        h('dt', null, 'Saldo inicial'), h('dd', null, lirios(t.saldo_inicial)),
        h('dt', null, 'Pessoas com vínculo ativo'), h('dd', null, `${num(c.trabalhadores)} (${num(c.vinculos_ativos)} ${c.vinculos_ativos === 1 ? 'vínculo' : 'vínculos'})`)),
      h('a', { class: 'fin-mais', href: '#/financas/config' }, 'Os limites só geram alertas, nunca cortam pagamentos. Mudar nas Configurações')])),
    h('div', { class: 'fin-grade' },
      painel('Últimas movimentações', 'moeda', p.movimentos.length
        ? h('ul', { class: 'fin-lista' }, p.movimentos.map(m => h('li', null,
          h('span', { class: 'fin-lista-texto' }, h('strong', null, m.descricao), h('small', { class: 'suave' }, `${TIPO_MOV[m.tipo] || m.tipo}, ${dataHora(m.criado_em)}`)),
          valorSinal(m.valor))))
        : h('p', { class: 'painel-vazio' }, 'Nenhuma movimentação ainda.'),
      h('a', { href: '#/financas/tesouro' }, 'Ver tudo')),
      painel('Últimas folhas', 'documento', lista.length
        ? h('ul', { class: 'fin-lista' }, lista.slice(0, 5).map(f => h('li', null,
          h('a', { class: 'fin-lista-texto', href: `#/financas/folha/${f.id}` }, h('strong', null, `Folha nº ${f.id}`), h('small', { class: 'suave' }, periodoTexto(f.inicio, f.fim))),
          h('span', { class: 'fin-lista-fim' }, etiqueta(SIT_FOLHA, f.situacao), h('span', { class: 'nowrap' }, lirios(f.total))))))
        : h('p', { class: 'painel-vazio' }, 'Nenhuma folha ainda. Comece em Gerar folha.'),
      h('a', { href: '#/financas/folhas' }, 'Ver todas'))));
}

/* ─── 2. Cidadãos e profissões ───────────────────── */

const chipVinculo = v => h('span', { class: `etiqueta ${SIT_VINCULO[v.situacao]?.[1] || ''}`.trim(), title: `${v.profissao_nome}: ${SIT_VINCULO[v.situacao]?.[0] || v.situacao}` },
  v.profissao_nome, v.situacao !== 'ativo' && h('small', null, ` (${SIT_VINCULO[v.situacao]?.[0].toLowerCase()})`));

async function cidadaos(corpo, { podes }) {
  const [{ cidadaos: lista }, { profissoes }] = await Promise.all([get(`${API}/cidadaos`), get(`${API}/profissoes`)]);
  let busca = '';
  let filtro = '';
  const area = h('div');
  const contador = h('span', { class: 'contador' });

  function desenhar() {
    const b = normalizar(busca.trim());
    const vis = lista.filter(c => {
      if (b && !normalizar(`${c.nome} ${c.nick || ''} ${c.profissao_registro || ''}`).includes(b)) return false;
      const vivos = c.vinculos.filter(v => v.situacao !== 'encerrado');
      if (filtro === 'sem') return !vivos.length;
      if (filtro === 'com') return vivos.some(v => v.situacao === 'ativo');
      if (filtro) return vivos.some(v => String(v.profissao_id) === filtro);
      return true;
    });
    contador.textContent = `${vis.length} de ${lista.length} ${lista.length === 1 ? 'cidadão' : 'cidadãos'}`;
    trocar(area, tabela(['Cidadão', 'Profissão no registro', 'Vínculos', ''], vis.map(c => {
      const vivos = c.vinculos.filter(v => v.situacao !== 'encerrado');
      const encerrados = c.vinculos.length - vivos.length;
      return h('tr', null,
        td('Cidadão', [
          h('a', { href: `#/financas/cidadao/${c.registro_id}` }, h('strong', null, c.nome)),
          h('small', { class: 'suave bloco' }, [c.livro, c.numero && `nº ${c.numero}`, c.nick && `nick ${c.nick}`].filter(Boolean).join(', ')),
          !c.registrado && h('span', { class: 'etiqueta fin-ruim', title: 'O registro saiu da lista de aprovados do Tabelionato' }, icone('alerta'), 'Fora dos registros'),
        ]),
        td('Profissão no registro', c.profissao_registro ? h('span', { class: 'suave', title: 'Só referência: escrito no registro do Tabelionato, não cria vínculo' }, c.profissao_registro) : h('span', { class: 'suave' }, 'não informada')),
        td('Vínculos', vivos.length || encerrados
          ? h('div', { class: 'chips' }, vivos.map(chipVinculo), encerrados ? h('span', { class: 'suave' }, `${encerrados} ${encerrados === 1 ? 'encerrado' : 'encerrados'}`) : null)
          : h('span', { class: 'suave' }, 'sem vínculo')),
        h('td', { class: 'acoes-linha' },
          podes.gerir && c.registrado && botao('Vincular', { icone: 'mais', classe: 'btn-pequeno', onclick: () => formVinculo(c, profissoes, () => { location.hash = `#/financas/cidadao/${c.registro_id}`; }) }),
          h('a', { class: 'btn btn-pequeno', href: `#/financas/cidadao/${c.registro_id}` }, 'Abrir')));
    }), { vazio: lista.length ? 'Ninguém com esse filtro.' : 'Nenhum cidadão aprovado no Tabelionato ainda.' }));
  }

  const opcoes = [['', 'Todas as situações'], ['com', 'Com vínculo ativo'], ['sem', 'Sem vínculo'],
    ...profissoes.map(p => [String(p.id), `${p.nome}${p.ativa ? '' : ' (desativada)'}`])];
  trocar(corpo,
    h('p', { class: 'form-intro fin-intro' }, 'Os cidadãos vêm dos registros aprovados do Tabelionato. Cada pessoa pode ter vínculos com uma ou mais profissões; a profissão escrita no registro é só uma dica e nunca vira vínculo sozinha. As profissões e os salários ficam na ', h('a', { href: '#/financas/salarios' }, 'Tabela de salários'), '.'),
    h('div', { class: 'ferramentas' },
      h('label', { class: 'busca' }, icone('busca'), h('input', { class: 'input', type: 'search', placeholder: 'Buscar pelo nome', 'aria-label': 'Buscar pelo nome', oninput: e => { busca = e.target.value; desenhar(); } })),
      selecao(opcoes, '', { class: 'input filtro', 'aria-label': 'Filtrar por profissão', onchange: e => { filtro = e.target.value; desenhar(); } }),
      contador),
    area);
  desenhar();
}

// Novo vínculo de um cidadão com uma profissão.
function formVinculo(cid, profissoes, aoSalvar) {
  const ativas = profissoes.filter(p => p.ativa);
  const sel = selecao([['', 'Escolha a profissão'], ...ativas.map(p => [p.id, `${p.nome} (${p.remuneracao === 'fixo' ? 'salário fixo' : 'por produção'})`])], '');
  const inicio = entradaData(hojeIso());
  const salario = entradaNumero('', { placeholder: 'Usa o da profissão' });
  const turnos = entradaNumero('', { step: '1', min: '1', max: '100', placeholder: 'Usa o da profissão' });
  const obs = areaTexto('', { maxlength: '500', rows: '2' });
  const info = h('p', { class: 'campo-ajuda' });
  const extras = h('div', { class: 'form-grade', hidden: true },
    campo('Salário-base próprio (Lírios)', salario, { ajuda: 'Só se esta pessoa ganha diferente da tabela.' }),
    campo('Turnos previstos próprios', turnos, { ajuda: 'Por período de pagamento.' }));
  sel.addEventListener('change', () => {
    const p = ativas.find(x => String(x.id) === sel.value);
    extras.hidden = p?.remuneracao !== 'fixo';
    trocar(info, !p ? '' : p.remuneracao === 'fixo'
      ? `Tabela: ${lirios(p.salario_base)}, ${nomeFrequencia(p.frequencia).toLowerCase()}, ${p.turnos_previstos} turnos previstos${p.proporcional ? ', proporcional à presença' : ''}.`
      : `Recebe pelas entregas aceitas: ${p.itens.filter(i => i.ativo).map(i => `${i.nome} (${lirios(i.valor)} por ${i.unidade})`).join('; ') || 'nenhum produto cadastrado ainda'}.`,
    p?.demonstracao ? [' ', chipDemo()] : null);
  });
  modalForm({
    titulo: `Novo vínculo · ${cid.nome}`, textoOk: 'Criar vínculo',
    conteudo: [
      cid.profissao_registro && h('p', { class: 'nota' }, icone('pergaminho'), `No registro do Tabelionato está escrito "${cid.profissao_registro}". É só uma referência: escolha a profissão abaixo.`),
      campo('Profissão', sel, { obrigatorio: true }), info,
      campo('Início do vínculo', inicio, { obrigatorio: true }),
      extras,
      campo('Observação', obs),
    ],
    aoEnviar: async () => {
      if (!sel.value) throw new Error('Escolha a profissão.');
      await post(`${API}/vinculos`, {
        registro_id: cid.registro_id, profissao_id: Number(sel.value), inicio: inicio.value,
        salario_base: extras.hidden ? null : salario.value, turnos_previstos: extras.hidden ? null : turnos.value, observacao: obs.value,
      });
      aviso('Vínculo criado.');
      aoSalvar?.();
    },
  });
}

function formEditarVinculo(v, aoSalvar) {
  const fixo = v.remuneracao === 'fixo';
  const salario = entradaNumero(v.salario_base ?? '', { placeholder: `Tabela: ${num(v.salario_efetivo)}` });
  const turnos = entradaNumero(v.turnos_previstos ?? '', { step: '1', min: '1', max: '100', placeholder: `Tabela: ${v.turnos_efetivos}` });
  const inicio = entradaData(v.inicio);
  const obs = areaTexto(v.observacao, { maxlength: '500', rows: '2' });
  const just = areaTexto('', { maxlength: '500', rows: '2' });
  modalForm({
    titulo: `Editar vínculo · ${v.cidadao_nome}`, textoOk: 'Salvar',
    conteudo: [
      h('p', { class: 'form-intro' }, `${v.profissao_nome}, ${fixo ? 'salário fixo' : 'por produção'}.`),
      fixo && h('div', { class: 'form-grade' },
        campo('Salário-base próprio (Lírios)', salario, { ajuda: 'Deixe vazio para usar o valor da tabela.' }),
        campo('Turnos previstos próprios', turnos, { ajuda: 'Vazio usa o da profissão.' })),
      campo('Início do vínculo', inicio, { obrigatorio: true }),
      campo('Observação', obs),
      campo('Justificativa', just, { obrigatorio: true, ajuda: 'Por que mudou. Fica no histórico.' }),
    ],
    aoEnviar: async () => {
      await put(`${API}/vinculos/${v.id}`, {
        ...(fixo ? { salario_base: salario.value, turnos_previstos: turnos.value } : {}),
        inicio: inicio.value, observacao: obs.value, justificativa: just.value,
      });
      aviso('Vínculo atualizado.');
      aoSalvar();
    },
  });
}

async function mudarSituacao(v, nova, aoSalvar) {
  if (nova === 'encerrado') {
    const fim = entradaData(hojeIso(), { min: v.inicio });
    const just = areaTexto('', { maxlength: '500', rows: '2' });
    modalForm({
      titulo: `Encerrar vínculo · ${v.cidadao_nome}`, textoOk: 'Encerrar vínculo', classeOk: 'btn-perigo',
      conteudo: [
        h('p', { class: 'form-intro' }, `O vínculo de ${v.profissao_nome} termina na data abaixo. Depois dela não entram presenças, entregas nem salário. O histórico continua guardado.`),
        campo('Último dia do vínculo', fim, { obrigatorio: true }),
        campo('Justificativa', just, { obrigatorio: true }),
      ],
      aoEnviar: async () => {
        if (!fim.value) throw new Error('Informe a data de fim.');
        if (just.value.trim().length < 5) throw new Error('Escreva a justificativa (pelo menos 5 letras).');
        if (!await confirmar(`Encerrar o vínculo de ${v.cidadao_nome} como ${v.profissao_nome} em ${dataCurta(fim.value)}?`, { titulo: 'Encerrar vínculo?', ok: 'Encerrar', perigo: true })) return false;
        await put(`${API}/vinculos/${v.id}`, { situacao: 'encerrado', fim: fim.value, justificativa: just.value });
        aviso('Vínculo encerrado.');
        aoSalvar();
      },
    });
    return;
  }
  const suspender = nova === 'suspenso';
  const j = await pedirTexto({
    titulo: `${suspender ? 'Suspender' : 'Reativar'} vínculo · ${v.cidadao_nome}`,
    texto: suspender
      ? `Enquanto estiver suspenso, o vínculo de ${v.profissao_nome} não recebe salário fixo nem aceita novas presenças na folha.`
      : `O vínculo de ${v.profissao_nome} volta a ficar ativo${v.situacao === 'encerrado' ? ' e a data de fim é apagada' : ''}.`,
    ok: suspender ? 'Suspender' : 'Reativar', perigo: suspender,
  });
  if (!j) return;
  const corpo = { situacao: nova, justificativa: j };
  if (v.situacao === 'encerrado') corpo.fim = '';
  if (await tentar(() => put(`${API}/vinculos/${v.id}`, corpo), suspender ? 'Vínculo suspenso.' : 'Vínculo reativado.')) aoSalvar();
}

// Página de um cidadão: vínculos, observações, presenças, entregas, pagamentos e histórico.
async function cidadao(corpo, { podes }, id) {
  async function desenhar() {
    const [d, { profissoes }] = await Promise.all([get(`${API}/cidadaos/${id}`), get(`${API}/profissoes`)]);
    const c = d.cidadao;
    const recarregar = () => seguro(corpo, desenhar);
    const vinc = new Map(d.vinculos.map(v => [v.id, v]));
    const obs = areaTexto(d.observacoes, { maxlength: '2000', rows: '4', disabled: !podes.gerir, 'aria-label': 'Observações administrativas' });

    const linhasVinculos = d.vinculos.map(v => h('tr', { class: v.situacao === 'encerrado' ? 'inativo' : null },
      td('Profissão', [h('strong', null, v.profissao_nome), h('small', { class: 'suave bloco' }, v.remuneracao === 'fixo' ? 'Salário fixo' : 'Por produção')]),
      td('Situação', etiqueta(SIT_VINCULO, v.situacao)),
      td('Remuneração', v.remuneracao === 'fixo'
        ? [lirios(v.salario_efetivo), h('small', { class: 'suave bloco' }, `${nomeFrequencia(v.frequencia)}${v.salario_base != null ? ', valor próprio' : ''}`)]
        : h('span', { class: 'suave' }, 'pelas entregas aceitas')),
      td('Turnos previstos', v.remuneracao === 'fixo' ? `${v.turnos_efetivos}${v.turnos_previstos != null ? ' (próprio)' : ''}${v.proporcional ? ', proporcional' : ''}` : h('span', { class: 'suave' }, 'não se aplica')),
      td('Período', `${dataCurta(v.inicio)}${v.fim ? ` a ${dataCurta(v.fim)}` : ', sem fim'}`),
      td('Observação', v.observacao ? h('span', { class: 'texto-livre' }, v.observacao) : h('span', { class: 'suave' }, 'nenhuma')),
      h('td', { class: 'acoes-linha' }, podes.gerir && [
        botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formEditarVinculo(v, recarregar) }),
        v.situacao === 'ativo' && botao('Suspender', { classe: 'btn-pequeno', onclick: () => mudarSituacao(v, 'suspenso', recarregar) }),
        v.situacao !== 'ativo' && botao('Reativar', { classe: 'btn-pequeno', onclick: () => mudarSituacao(v, 'ativo', recarregar) }),
        v.situacao !== 'encerrado' && botao('Encerrar', { classe: 'btn-pequeno btn-perigo-texto', onclick: () => mudarSituacao(v, 'encerrado', recarregar) }),
      ])));

    trocar(corpo,
      h('a', { class: 'voltar', href: '#/financas/cidadaos' }, icone('voltar'), 'Todos os cidadãos'),
      h('section', { class: 'painel fin-painel fin-cidadao-topo' },
        h('div', null,
          h('h2', { class: 'fin-nome' }, c.nome),
          h('p', { class: 'suave' }, [c.livro, c.numero && `registro nº ${c.numero}`, c.nick && `nick ${c.nick}`].filter(Boolean).join(', ') || 'Sem registro'),
          c.profissao_registro && h('p', { class: 'fin-dica-registro' }, icone('pergaminho'), `Profissão escrita no registro do Tabelionato: ${c.profissao_registro} (só referência, não cria vínculo).`),
          !c.registrado && h('p', { class: 'nota nota-vermelha' }, icone('alerta'), 'Este registro saiu da lista de aprovados do Tabelionato. O histórico continua aqui, mas confira antes de pagar.')),
        podes.gerir && c.registrado && botao('Novo vínculo', { icone: 'mais', classe: 'btn-ouro', onclick: () => formVinculo(c, profissoes, recarregar) })),
      painel('Vínculos', 'chave', tabela(['Profissão', 'Situação', 'Remuneração', 'Turnos previstos', 'Período', 'Observação', ''], linhasVinculos,
        { vazio: 'Nenhum vínculo. Sem vínculo, a pessoa não entra na folha.' })),
      painel('Observações administrativas', 'pena', [
        obs,
        h('div', { class: 'fin-linha-acoes' },
          d.observacoes_por && h('small', { class: 'suave' }, `Última mudança por ${d.observacoes_por}, ${dataHora(d.observacoes_em)}.`),
          h('span', { class: 'espaco' }),
          podes.gerir && botao('Salvar observações', { classe: 'btn-pequeno', onclick: async () => { if (await tentar(() => put(`${API}/cidadaos/${id}/observacoes`, { observacoes: obs.value }), 'Observações salvas.')) recarregar(); } })),
      ]),
      painel('Pagamentos', 'moeda', tabela(['Folha', 'Período', 'Descrição', 'Valor', 'Folha', 'Pagamento'], d.pagamentos.map(i => h('tr', null,
        td('Folha', h('a', { href: `#/financas/folha/${i.folha_id}` }, `Folha nº ${i.folha_id}`)),
        td('Período', periodoTexto(i.inicio, i.fim)),
        td('Descrição', [i.profissao_nome && h('strong', null, `${i.profissao_nome}: `), i.descricao, i.justificativa && h('small', { class: 'suave bloco' }, `Justificativa: ${i.justificativa}`)]),
        td('Valor', lirios(i.valor), 'num'),
        td('Situação da folha', etiqueta(SIT_FOLHA, i.folha_situacao)),
        td('Pagamento', i.pago ? h('span', { class: 'etiqueta fin-bom' }, icone('check'), `Pago em ${dataCurta(i.pago_em)}`) : h('span', { class: 'etiqueta' }, 'Ainda não pago'))),
      ), { vazio: 'Nenhum pagamento em folha ainda.' })),
      painel('Presenças recentes', 'calendario', tabela(['Dia', 'Profissão', 'Situação', 'Turnos', 'Observação', 'Folha'], d.presencas.slice(0, 40).map(p => h('tr', null,
        td('Dia', `${SEMANA_CURTA[diaDaSemana(p.data)]}, ${dataCurta(p.data)}`),
        td('Profissão', vinc.get(p.vinculo_id)?.profissao_nome || ''),
        td('Situação', etiqueta(Object.fromEntries(Object.entries(SIT_PRESENCA).map(([k, [n, , cl]]) => [k, [n, cl]])), p.situacao)),
        td('Turnos', num(p.turnos)),
        td('Observação', p.observacao || h('span', { class: 'suave' }, 'nenhuma')),
        td('Folha', p.folha_id ? chipTravado(p.folha_id) : h('span', { class: 'suave' }, 'livre')))),
      { vazio: 'Nenhuma presença registrada.' }), h('a', { href: '#/financas/presencas' }, 'Grade de presenças')),
      painel('Entregas', 'bau', tabela(['Dia', 'Produto', 'Quantidade', 'Valor', 'Situação', 'Folha'], d.entregas.slice(0, 40).map(e => h('tr', null,
        td('Dia', dataCurta(e.data)),
        td('Produto', [e.item_nome, h('small', { class: 'suave bloco' }, vinc.get(e.vinculo_id)?.profissao_nome || '')]),
        td('Quantidade', `${num(e.quantidade)} ${e.unidade}`),
        td('Valor', e.valor_unitario != null ? lirios(e.quantidade * e.valor_unitario) : h('span', { class: 'suave' }, 'na conferência'), 'num'),
        td('Situação', [etiqueta(SIT_ENTREGA, e.situacao), e.motivo && h('small', { class: 'suave bloco' }, e.motivo)]),
        td('Folha', e.folha_id ? chipTravado(e.folha_id) : h('span', { class: 'suave' }, 'livre')))),
      { vazio: 'Nenhuma entrega registrada.' }), h('a', { href: '#/financas/producao' }, 'Produção e entregas')),
      painel('Histórico de mudanças', 'relogio', listaAuditoria(d.historico, { comEntidade: true })));
  }
  await desenhar();
}

/* ─── 3. Presenças e turnos ──────────────────────── */

async function presencas(corpo, { podes }) {
  let periodo = semanaDe();
  const area = h('div', { class: 'fin-area' });

  trocar(corpo,
    h('p', { class: 'form-intro fin-intro' }, 'Só para profissões de salário fixo. Toque num dia para registrar ou corrigir. Presença, licença e missão oficial contam como turno cumprido; falta justificada conta só se a profissão disser. O dia que já entrou numa folha fica travado: corrija com um ajuste na folha.'),
    seletorPeriodo({
      ...periodo, atalhos: ['semana', 'passada'],
      aoMudar: (i, f) => {
        if (!i || !f) return aviso('Escolha o início e o fim.', 'erro');
        if (diasEntre(i, f) > 31) return aviso('Escolha no máximo 31 dias.', 'erro');
        periodo = { inicio: i, fim: f };
        desenhar();
      },
    }),
    area);

  async function desenhar() {
    trocar(area, carregando());
    await seguro(area, async () => {
      const [{ vinculos }, { presencas: lista }, { folhas: todas }] = await Promise.all([
        get(`${API}/vinculos`), get(`${API}/presencas?inicio=${periodo.inicio}&fim=${periodo.fim}`), get(`${API}/folhas`)]);
      // Dias que já estão numa folha (em revisão, aprovada ou paga): o servidor não aceita registro novo neles.
      const fechadas = todas.filter(f => f.situacao !== 'rejeitada' && f.inicio <= periodo.fim && f.fim >= periodo.inicio);
      const folhaDoDia = dia => fechadas.find(f => f.inicio <= dia && f.fim >= dia)?.id;
      const dias = listaDeDias(periodo.inicio, periodo.fim);
      const mapa = new Map(lista.map(p => [`${p.vinculo_id}|${p.data}`, p]));
      const fixos = vinculos.filter(v => v.remuneracao === 'fixo'
        && ((v.situacao === 'ativo' && v.inicio <= periodo.fim && (!v.fim || v.fim >= periodo.inicio)) || lista.some(p => p.vinculo_id === v.id)));
      if (!fixos.length) {
        trocar(area, h('p', { class: 'tabela-vazia fin-vazia' }, 'Nenhum vínculo de salário fixo ativo neste período. Crie vínculos em Cidadãos e profissões.'));
        return;
      }
      const hoje = hojeIso();
      const linhas = fixos.map(v => {
        let turnos = 0;
        let faltas = 0;
        const celulas = dias.map(dia => {
          const p = mapa.get(`${v.id}|${dia}`);
          const dentro = dia >= v.inicio && (!v.fim || dia <= v.fim);
          if (p) {
            if (['presente', 'licenca', 'missao'].includes(p.situacao)) turnos += Number(p.turnos);
            if (p.situacao === 'falta') faltas++;
          }
          if (!p && !dentro) return h('td', { class: 'fin-cel-fora', title: 'Fora do período do vínculo' }, '·');
          const fechada = !p && folhaDoDia(dia);
          if (fechada) return h('td', null, h('span', { class: 'fin-cel fin-travada', title: `Sem registro; o dia já está na folha nº ${fechada}` }, icone('cadeado')));
          const [nome, letra, cls] = p ? SIT_PRESENCA[p.situacao] : ['Sem registro', '', ''];
          const titulo = p
            ? `${nome}, ${num(p.turnos)} ${Number(p.turnos) === 1 ? 'turno' : 'turnos'}${p.observacao ? `: ${p.observacao}` : ''}${p.folha_id ? ` (na folha nº ${p.folha_id})` : ''}`
            : `Sem registro em ${dataCurta(dia)}`;
          const conteudo = [letra, p && Number(p.turnos) !== 1 && p.situacao !== 'falta' ? h('small', null, num(p.turnos)) : null, p?.folha_id ? icone('cadeado') : null];
          const pode = podes.gerir && !p?.folha_id && v.situacao !== 'encerrado';
          return h('td', { class: dia === hoje ? 'fin-hoje' : null }, pode
            ? h('button', { type: 'button', class: `fin-cel ${cls}`.trim(), title: titulo, 'aria-label': `${v.cidadao_nome}, ${dataCurta(dia)}: ${titulo}`, onclick: () => formPresenca(v, dia, p, desenhar) }, conteudo)
            : h('span', { class: `fin-cel ${cls} ${p?.folha_id ? 'fin-travada' : ''}`.trim(), title: titulo }, conteudo));
        });
        return h('tr', null,
          h('th', { scope: 'row', class: 'fin-grade-nome' },
            h('a', { href: `#/financas/cidadao/${v.registro_id}` }, v.cidadao_nome),
            h('small', { class: 'suave bloco' }, `${v.profissao_nome}, ${v.turnos_efetivos} turnos ${nomeFrequencia(v.frequencia).toLowerCase()}`),
            v.situacao !== 'ativo' && etiqueta(SIT_VINCULO, v.situacao),
            podes.gerir && v.situacao !== 'encerrado' && h('button', { class: 'link fin-marcar', type: 'button', onclick: () => formVariosDias(v, dias, mapa, desenhar) }, 'Marcar vários dias')),
          celulas,
          h('td', { class: 'fin-grade-soma', title: 'Turnos cumpridos (presença, licença e missão) e faltas no período' }, h('strong', null, num(turnos)), faltas ? h('small', { class: 'bloco fin-saida' }, `${faltas} ${faltas === 1 ? 'falta' : 'faltas'}`) : null));
      });
      trocar(area,
        h('div', { class: 'tabela-wrap fin-grade-wrap' }, h('table', { class: 'tabela fin-grade-presencas' },
          h('thead', null, h('tr', null, h('th', { class: 'fin-grade-nome' }, 'Vínculo'),
            dias.map(d => h('th', { class: `fin-dia ${d === hoje ? 'fin-hoje' : ''}`.trim() }, h('span', null, SEMANA_CURTA[diaDaSemana(d)]), h('small', null, `${d.slice(8, 10)}/${d.slice(5, 7)}`))),
            h('th', null, 'Turnos'))),
          h('tbody', null, linhas))),
        h('div', { class: 'fin-legenda' }, Object.values(SIT_PRESENCA).map(([nome, letra, cls]) => h('span', null, h('span', { class: `fin-cel ${cls}` }, letra), nome)),
          h('span', null, h('span', { class: 'fin-cel fin-travada' }, icone('cadeado')), 'já está numa folha'),
          h('span', null, h('span', { class: 'fin-cel-fora' }, '·'), 'fora do vínculo')));
    });
  }
  await desenhar();
}

function campoSituacaoPresenca(inicial, aoMudar) {
  return segmentado(Object.entries(SIT_PRESENCA).map(([k, [nome]]) => [k, nome]), inicial, aoMudar);
}

function formPresenca(v, dia, p, aoSalvar) {
  const turnos = entradaNumero(p ? p.turnos : 1, { step: '0.5', min: '0', max: '10' });
  const caixaTurnos = campo('Turnos neste dia', turnos, { ajuda: 'Normalmente 1. Use 0,5 para meio turno ou 2 para turno dobrado.' });
  const sit = campoSituacaoPresenca(p?.situacao || 'presente', s => { caixaTurnos.hidden = s === 'falta'; });
  caixaTurnos.hidden = sit.valor() === 'falta';
  const obs = entradaTexto(p?.observacao, { maxlength: '300', placeholder: 'Opcional' });
  const just = p ? areaTexto('', { maxlength: '500', rows: '2' }) : null;
  const m = modalForm({
    titulo: `${p ? 'Corrigir' : 'Registrar'} presença · ${dataCurta(dia)}`, textoOk: p ? 'Salvar correção' : 'Registrar',
    extraRodape: p && botao('Apagar registro', { icone: 'lixo', classe: 'btn-perigo-texto', onclick: apagar }),
    conteudo: [
      h('p', { class: 'form-intro' }, `${v.cidadao_nome}, ${v.profissao_nome}. ${SEMANA_CURTA[diaDaSemana(dia)]}, ${dataCurta(dia)}.`),
      campo('Situação', sit.el, { obrigatorio: true }),
      caixaTurnos,
      campo('Observação', obs),
      just && campo('Justificativa da correção', just, { obrigatorio: true, ajuda: 'Fica no histórico junto com o valor de antes.' }),
    ],
    aoEnviar: async () => {
      const dados = { situacao: sit.valor(), turnos: turnos.value || 1, observacao: obs.value };
      if (p) {
        await put(`${API}/presencas/${p.id}`, { ...dados, justificativa: just.value });
        aviso('Presença corrigida.');
      } else {
        const r = await post(`${API}/presencas`, { vinculo_id: v.id, itens: [{ data: dia, ...dados }] });
        if (!r.criadas.length) throw new Error(`Não registrado: ${r.recusadas[0]?.motivo || 'recusado'}.`);
        aviso('Presença registrada.');
      }
      aoSalvar();
    },
  });
  async function apagar() {
    const j = await pedirTexto({ titulo: 'Apagar registro de presença', texto: `O registro de ${dataCurta(dia)} de ${v.cidadao_nome} será apagado. A mudança fica no histórico.`, ok: 'Apagar', perigo: true });
    if (!j) return;
    if (await tentar(() => post(`${API}/presencas/${p.id}/apagar`, { justificativa: j }), 'Registro apagado.')) { m.fechar(); aoSalvar(); }
  }
}

// Marcar vários dias de uma vez (ex.: a semana inteira de um guarda) com a mesma situação.
function formVariosDias(v, dias, mapa, aoSalvar) {
  const turnos = entradaNumero(1, { step: '0.5', min: '0', max: '10' });
  const caixaTurnos = campo('Turnos em cada dia', turnos);
  const sit = campoSituacaoPresenca('presente', s => { caixaTurnos.hidden = s === 'falta'; });
  const obs = entradaTexto('', { maxlength: '300', placeholder: 'Opcional' });
  const caixas = dias.map(d => {
    const ja = mapa.get(`${v.id}|${d}`);
    const fora = d < v.inicio || (v.fim && d > v.fim);
    const semana = diaDaSemana(d);
    const input = h('input', { type: 'checkbox', value: d, checked: !ja && !fora && semana !== 0 && semana !== 6, disabled: !!ja || fora });
    return h('label', { class: `marcador fin-dia-opcao ${ja || fora ? 'suave' : ''}`.trim(), title: ja ? 'Já tem registro (corrija na grade)' : fora ? 'Fora do período do vínculo' : null },
      input, `${SEMANA_CURTA[semana]} ${d.slice(8, 10)}/${d.slice(5, 7)}${ja ? ` (${SIT_PRESENCA[ja.situacao][1]})` : ''}`);
  });
  modalForm({
    titulo: `Marcar vários dias · ${v.cidadao_nome}`, textoOk: 'Registrar dias',
    conteudo: [
      h('p', { class: 'form-intro' }, `${v.profissao_nome}. Os dias que já têm registro ficam de fora: corrija esses na grade.`),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Dias'), h('div', { class: 'fin-dias-opcoes' }, caixas)),
      campo('Situação', sit.el, { obrigatorio: true }),
      caixaTurnos,
      campo('Observação', obs),
    ],
    aoEnviar: async form => {
      const datas = [...form.querySelectorAll('.fin-dias-opcoes input:checked')].map(i => i.value);
      if (!datas.length) throw new Error('Marque pelo menos um dia.');
      const r = await post(`${API}/presencas`, { vinculo_id: v.id, itens: datas.map(data => ({ data, situacao: sit.valor(), turnos: turnos.value || 1, observacao: obs.value })) });
      if (r.criadas.length) aviso(`${r.criadas.length} ${r.criadas.length === 1 ? 'dia registrado' : 'dias registrados'}.`);
      if (r.recusadas.length) {
        aviso(`Não registrados: ${r.recusadas.map(x => `${dataCurta(x.data)} (${x.motivo})`).join('; ')}.`, 'erro');
      }
      aoSalvar();
    },
  });
}

/* ─── 4. Produção e entregas ─────────────────────── */

async function producao(corpo, { podes }) {
  const [{ profissoes }, { vinculos }] = await Promise.all([get(`${API}/profissoes`), get(`${API}/vinculos`)]);
  const profsProd = profissoes.filter(p => p.remuneracao === 'producao');
  const vincProd = vinculos.filter(v => v.remuneracao === 'producao');
  const profDe = new Map(profissoes.map(p => [p.id, p]));
  const vincDe = new Map(vinculos.map(v => [v.id, v]));
  const f = { situacao: 'pendente', inicio: '', fim: '', profissao_id: '', registro_id: '' };
  const area = h('div', { class: 'fin-area' });
  const pessoas = [...new Map(vincProd.map(v => [v.registro_id, v.cidadao_nome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const sit = segmentado([['pendente', 'Esperando conferência'], ['aceita', 'Aceitas'], ['rejeitada', 'Rejeitadas'], ['', 'Todas']], f.situacao, v => { f.situacao = v; desenhar(); });

  trocar(corpo,
    h('div', { class: 'fin-barra' },
      h('p', { class: 'form-intro' }, 'Entregas das profissões pagas por produção. Só as aceitas entram na folha, com o valor unitário da tabela no momento em que foram aceitas.'),
      podes.gerir && botao('Registrar entrega', { icone: 'mais', classe: 'btn-ouro', onclick: () => formEntrega({ vincProd, profDe, aoSalvar: desenhar }) })),
    h('div', { class: 'fin-filtros' },
      sit.el,
      selecao([['', 'Todas as profissões'], ...profsProd.map(p => [p.id, p.nome])], '', { class: 'input filtro', 'aria-label': 'Profissão', onchange: e => { f.profissao_id = e.target.value; desenhar(); } }),
      selecao([['', 'Todos os trabalhadores'], ...pessoas], '', { class: 'input filtro', 'aria-label': 'Trabalhador', onchange: e => { f.registro_id = e.target.value; desenhar(); } })),
    seletorPeriodo({ inicio: '', fim: '', botao: 'Filtrar', atalhos: ['semana', 'passada', 'mes'], aoMudar: (i, fim) => { f.inicio = i; f.fim = fim; desenhar(); } }),
    area);

  async function desenhar() {
    trocar(area, carregando());
    await seguro(area, async () => {
      const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
      const { entregas } = await get(`${API}/entregas?${q}`);
      let aceito = 0;
      let estimado = 0;
      const linhas = entregas.map(e => {
        const est = e.valor == null ? Number(e.quantidade) * Number(e.valor_atual) : null;
        if (e.situacao === 'aceita') aceito += e.valor;
        if (e.situacao === 'pendente') estimado += est;
        const editavel = podes.gerir && !e.folha_id;
        return h('tr', { class: e.situacao === 'rejeitada' ? 'inativo' : null },
          td('Dia', [dataCurta(e.data), h('small', { class: 'suave bloco' }, `nº ${e.id}`)]),
          td('Trabalhador', [h('a', { href: `#/financas/cidadao/${e.registro_id}` }, e.cidadao_nome), h('small', { class: 'suave bloco' }, e.profissao_nome)]),
          td('Produto', [e.item_nome, e.demonstracao && e.situacao !== 'rejeitada' ? h('span', { class: 'bloco' }, chipDemo()) : null]),
          td('Quantidade', `${num(e.quantidade)} ${e.unidade}`),
          td('Valor unitário', e.valor_unitario != null ? lirios(e.valor_unitario) : h('span', { class: 'suave', title: 'Valor atual da tabela; fica guardado quando a entrega for aceita' }, `${lirios(e.valor_atual)} (atual)`)),
          td('Valor', e.valor != null ? h('strong', null, lirios(e.valor)) : e.situacao === 'pendente' ? h('span', { class: 'suave' }, `${lirios(est)} estimado`) : h('span', { class: 'suave' }, 'sem valor'), 'num'),
          td('Referência', [e.referencia || h('span', { class: 'suave' }, 'nenhuma'), e.observacao && h('small', { class: 'suave bloco' }, e.observacao)]),
          td('Situação', [etiqueta(SIT_ENTREGA, e.situacao), e.motivo && h('small', { class: 'suave bloco' }, `Motivo: ${e.motivo}`),
            e.revisado_por_nome && h('small', { class: 'suave bloco' }, `por ${e.revisado_por_nome}`), e.folha_id && chipTravado(e.folha_id)]),
          h('td', { class: 'acoes-linha' }, editavel && [
            e.situacao !== 'aceita' && botao('Aceitar', { icone: 'check', classe: 'btn-pequeno btn-ouro', onclick: () => aceitar(e) }),
            e.situacao !== 'rejeitada' && botao('Rejeitar', { classe: 'btn-pequeno btn-perigo-texto', onclick: () => rejeitar(e) }),
            botao('Corrigir', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formEntrega({ vincProd: [vincDe.get(e.vinculo_id)].filter(Boolean), profDe, antes: e, aoSalvar: desenhar }) }),
          ]));
      });
      trocar(area,
        entregas.length ? h('p', { class: 'fin-resumo' },
          `${entregas.length} ${entregas.length === 1 ? 'entrega' : 'entregas'}.`,
          aceito ? [' Aceito: ', h('strong', null, lirios(aceito)), '.'] : null,
          estimado ? [' Esperando conferência: ', h('strong', null, `${lirios(estimado)} estimados`), ' (ainda não contam).'] : null) : null,
        tabela(['Dia', 'Trabalhador', 'Produto', 'Quantidade', 'Valor unitário', 'Valor', 'Referência', 'Situação', ''], linhas,
          { vazio: f.situacao === 'pendente' ? 'Nenhuma entrega esperando conferência.' : 'Nenhuma entrega com esses filtros.' }));
    });
  }

  async function aceitar(e) {
    if (await tentar(() => post(`${API}/entregas/${e.id}/aceitar`), `Entrega aceita: ${num(e.quantidade)} ${e.unidade} de ${e.item_nome}.`)) desenhar();
  }
  async function rejeitar(e) {
    const motivo = await pedirTexto({
      titulo: 'Rejeitar entrega', texto: `${e.cidadao_nome}: ${num(e.quantidade)} ${e.unidade} de ${e.item_nome} (${dataCurta(e.data)}). A entrega rejeitada não é paga.`,
      rotulo: 'Motivo', ajuda: 'Qualidade, quantidade errada, item trocado... A pessoa e o histórico veem o motivo.', ok: 'Rejeitar', perigo: true, minimo: 3,
    });
    if (motivo && await tentar(() => post(`${API}/entregas/${e.id}/rejeitar`, { motivo }), 'Entrega rejeitada.')) desenhar();
  }
  await desenhar();
}

// Registrar (ou corrigir, com "antes") uma entrega de produção.
function formEntrega({ vincProd, profDe, antes = null, aoSalvar }) {
  const ativos = antes ? vincProd : vincProd.filter(v => v.situacao === 'ativo');
  if (!ativos.length) { aviso('Nenhum trabalhador com vínculo de produção ativo. Crie o vínculo em Cidadãos e profissões.', 'erro'); return; }
  const selV = selecao([['', 'Escolha o trabalhador'], ...ativos.map(v => [v.id, `${v.cidadao_nome}, ${v.profissao_nome}`])], antes ? antes.vinculo_id : ativos.length === 1 ? ativos[0].id : '', { disabled: !!antes });
  const selI = selecao([], '');
  const qtd = entradaNumero(antes?.quantidade ?? '', { step: 'any', min: '0.01' });
  const data = entradaData(antes?.data || hojeIso(), { max: hojeIso() });
  const ref = entradaTexto(antes?.referencia, { maxlength: '80', placeholder: 'Ex.: baú 12 do armazém' });
  const obs = areaTexto(antes?.observacao, { maxlength: '500', rows: '2' });
  const info = h('p', { class: 'campo-ajuda fin-item-info' });
  const total = h('p', { class: 'fin-estimado' });
  const aceitarJa = interruptor('Aceitar já', false, null, 'Confere agora e guarda o valor unitário atual. Sem isso, a entrega espera conferência.');
  const just = antes ? areaTexto('', { maxlength: '500', rows: '2' }) : null;
  let itens = [];

  function itemAtual() { return itens.find(i => String(i.id) === selI.value); }
  function atualizar() {
    const it = itemAtual();
    const q = Number(String(qtd.value).replace(',', '.')) || 0;
    trocar(info, it ? [`Unidade: ${it.unidade}. Valor atual: ${lirios(it.valor)} por ${it.unidade}.`, it.demonstracao ? [' ', chipDemo()] : null] : '');
    trocar(total, it && q ? ['Valor: ', `${num(q)} × ${lirios(it.valor)} = `, h('strong', null, lirios(Math.round(q * it.valor * 100) / 100))] : '');
  }
  function trocarVinculo() {
    const v = ativos.find(x => String(x.id) === String(selV.value));
    const prof = v && profDe.get(v.profissao_id);
    itens = prof ? prof.itens.filter(i => i.ativo || i.id === antes?.item_id) : [];
    trocar(selI, h('option', { value: '' }, v ? (itens.length ? 'Escolha o produto' : 'Esta profissão não tem produtos') : 'Escolha antes o trabalhador'),
      itens.map(i => h('option', { value: i.id, selected: i.id === antes?.item_id || itens.length === 1 }, `${i.nome} (${lirios(i.valor)} por ${i.unidade})${i.ativo ? '' : ' (desativado)'}`)));
    atualizar();
  }
  selV.addEventListener('change', trocarVinculo);
  selI.addEventListener('change', atualizar);
  qtd.addEventListener('input', atualizar);
  trocarVinculo();

  modalForm({
    titulo: antes ? `Corrigir entrega nº ${antes.id}` : 'Registrar entrega', textoOk: antes ? 'Salvar correção' : 'Registrar entrega',
    conteudo: [
      antes && h('p', { class: 'nota' }, icone('alerta'), 'Corrigir devolve a entrega para conferência: ela precisa ser aceita de novo.'),
      campo('Trabalhador', selV, { obrigatorio: true }),
      campo('Produto ou recurso', selI, { obrigatorio: true }), info,
      h('div', { class: 'form-grade' }, campo('Quantidade', qtd, { obrigatorio: true }), campo('Dia da entrega', data, { obrigatorio: true })),
      total,
      campo('Referência', ref, { ajuda: 'Opcional e única: evita registrar a mesma entrega duas vezes.' }),
      campo('Observação', obs),
      !antes && aceitarJa,
      just && campo('Justificativa da correção', just, { obrigatorio: true }),
    ],
    aoEnviar: async () => {
      if (!selV.value) throw new Error('Escolha o trabalhador.');
      if (!selI.value) throw new Error('Escolha o produto.');
      const corpo = { vinculo_id: Number(selV.value), item_id: Number(selI.value), quantidade: qtd.value, data: data.value, referencia: ref.value, observacao: obs.value };
      if (antes) corpo.justificativa = just.value;
      else corpo.aceitar = aceitarJa.querySelector('input').checked;
      const enviar = extra => (antes ? put(`${API}/entregas/${antes.id}`, { ...corpo, ...extra }) : post(`${API}/entregas`, { ...corpo, ...extra }));
      try {
        await enviar({});
      } catch (e) {
        if (e.status !== 409 || !/entrega igual/.test(e.message)) throw e;
        // Mesma pessoa, produto, dia e quantidade: só passa se quem registra confirmar e justificar.
        const j = antes
          ? (await confirmar(`${e.message}`, { titulo: 'Entrega repetida?', ok: 'É outra entrega' })) && corpo.justificativa
          : await pedirTexto({ titulo: 'Entrega repetida?', texto: e.message, rotulo: 'Por que é outra entrega', ok: 'Registrar mesmo assim' });
        if (!j) throw e;
        await enviar({ repetida: true, justificativa: j });
      }
      aviso(antes ? 'Entrega corrigida: voltou para conferência.' : corpo.aceitar ? 'Entrega registrada e aceita.' : 'Entrega registrada. Espera conferência.');
      aoSalvar();
    },
  });
}

/* ─── 5. Tabela de salários ──────────────────────── */

const simNao = v => (v ? 'Sim' : 'Não');

async function salarios(corpo, { podes }) {
  async function desenhar() {
    const { profissoes, unidades } = await get(`${API}/profissoes`);
    const recarregar = () => seguro(corpo, desenhar);
    const fixas = profissoes.filter(p => p.remuneracao === 'fixo');
    const prod = profissoes.filter(p => p.remuneracao === 'producao');

    const acoesProf = p => podes.gerir && h('div', { class: 'fin-linha-acoes' },
      botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formProfissao(p, recarregar) }),
      p.demonstracao && botao('Confirmar valor', { icone: 'check', classe: 'btn-pequeno btn-ouro', onclick: () => confirmarProfissao(p, recarregar) }));
    const topoProf = p => h('header', { class: 'fin-prof-cab' },
      h('h3', null, p.nome),
      h('div', { class: 'chips' },
        !p.ativa && h('span', { class: 'etiqueta' }, 'Desativada'),
        p.demonstracao && chipDemo(),
        h('span', { class: 'etiqueta' }, icone('usuarios'), `${p.vinculos_ativos} ${p.vinculos_ativos === 1 ? 'vínculo ativo' : 'vínculos ativos'}`)));

    const cartaoFixa = p => h('article', { class: `painel fin-prof ${p.ativa ? '' : 'fin-inativa'}`.trim() },
      topoProf(p),
      h('p', { class: 'fin-prof-valor' }, h('strong', null, lirios(p.salario_base)), h('span', { class: 'suave' }, ` ${nomeFrequencia(p.frequencia).toLowerCase()}`)),
      h('dl', { class: 'fin-dl' },
        h('dt', null, 'Turnos previstos por período'), h('dd', null, String(p.turnos_previstos)),
        h('dt', null, 'Proporcional à presença'), h('dd', null, simNao(p.proporcional)),
        h('dt', null, 'Falta justificada conta'), h('dd', null, simNao(p.justificada_conta)),
        p.regra && [h('dt', null, 'Regra'), h('dd', null, p.regra)]),
      acoesProf(p));

    const cartaoProducao = p => h('article', { class: `painel fin-prof fin-prof-larga ${p.ativa ? '' : 'fin-inativa'}`.trim() },
      topoProf(p),
      p.regra && h('p', { class: 'suave' }, p.regra),
      tabela(['Produto ou recurso', 'Unidade', 'Valor por unidade', 'Situação', ''], p.itens.map(i => h('tr', { class: i.ativo ? null : 'inativo' },
        td('Produto ou recurso', h('strong', null, i.nome)),
        td('Unidade', i.unidade),
        td('Valor por unidade', lirios(i.valor), 'num'),
        td('Situação', h('div', { class: 'chips' }, i.ativo ? h('span', { class: 'etiqueta fin-bom' }, 'Ativo') : h('span', { class: 'etiqueta' }, 'Desativado'), i.demonstracao && chipDemo())),
        h('td', { class: 'acoes-linha' }, podes.gerir && [
          botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formItem(p, i, unidades, recarregar) }),
          i.demonstracao && botao('Confirmar valor', { icone: 'check', classe: 'btn-pequeno btn-ouro', onclick: () => confirmarItem(i, recarregar) }),
          botao(i.ativo ? 'Desativar' : 'Reativar', { classe: 'btn-pequeno btn-fantasma', onclick: () => ativarItem(i, !i.ativo, recarregar) }),
        ]))), { vazio: 'Nenhum produto ainda. Sem produtos, não há o que registrar nas entregas.' }),
      podes.gerir && h('div', { class: 'fin-linha-acoes' },
        botao('Adicionar produto', { icone: 'mais', classe: 'btn-pequeno', onclick: () => formItem(p, null, unidades, recarregar) }),
        botao('Editar profissão', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formProfissao(p, recarregar) }),
        p.demonstracao && botao('Confirmar regra', { icone: 'check', classe: 'btn-pequeno btn-ouro', onclick: () => confirmarProfissao(p, recarregar) })));

    trocar(corpo,
      h('div', { class: 'fin-barra' },
        h('p', { class: 'form-intro' }, 'Os valores marcados como "demonstração" são exemplos para começar: confira cada um antes de pagar de verdade. Mudar o salário-base tira a marca sozinho; se o valor já estiver certo, use "Confirmar valor".'),
        podes.gerir && botao('Nova profissão', { icone: 'mais', classe: 'btn-ouro', onclick: () => formProfissao(null, recarregar) })),
      h('h2', { class: 'fin-secao' }, icone('relogio'), 'Salário fixo'),
      fixas.length ? h('div', { class: 'fin-profs' }, fixas.map(cartaoFixa)) : h('p', { class: 'painel-vazio' }, 'Nenhuma profissão de salário fixo.'),
      h('h2', { class: 'fin-secao' }, icone('bau'), 'Por produção'),
      h('p', { class: 'nota' }, icone('alerta'), 'Mudar o valor de um produto vale só para as entregas aceitas daqui em diante. As entregas já aceitas guardaram o valor da época.'),
      prod.length ? h('div', { class: 'fin-profs' }, prod.map(cartaoProducao)) : h('p', { class: 'painel-vazio' }, 'Nenhuma profissão por produção.'));
  }
  await desenhar();
}

async function confirmarProfissao(p, aoSalvar) {
  const texto = p.remuneracao === 'fixo'
    ? `O salário de ${p.nome} (${lirios(p.salario_base)} ${nomeFrequencia(p.frequencia).toLowerCase()}) passa a valer como valor conferido, sem a marca de demonstração.`
    : `A regra de ${p.nome} passa a valer como conferida, sem a marca de demonstração. Os produtos são conferidos um a um.`;
  if (!await confirmar(texto, { titulo: 'Confirmar valor?', ok: 'Confirmar' })) return;
  if (await tentar(() => put(`${API}/profissoes/${p.id}`, { demonstracao: false, justificativa: 'Valor conferido pelo Mestre da Moeda' }), 'Valor confirmado.')) aoSalvar();
}
async function confirmarItem(i, aoSalvar) {
  if (!await confirmar(`"${i.nome}" a ${lirios(i.valor)} por ${i.unidade} passa a valer como valor conferido.`, { titulo: 'Confirmar valor?', ok: 'Confirmar' })) return;
  if (await tentar(() => put(`${API}/itens/${i.id}`, { demonstracao: false, justificativa: 'Valor conferido pelo Mestre da Moeda' }), 'Valor confirmado.')) aoSalvar();
}
async function ativarItem(i, ativo, aoSalvar) {
  if (!ativo && !await confirmar(`"${i.nome}" deixa de aparecer para novas entregas. As entregas já registradas continuam.`, { titulo: 'Desativar produto?', ok: 'Desativar' })) return;
  if (await tentar(() => put(`${API}/itens/${i.id}`, { ativo }), ativo ? 'Produto reativado.' : 'Produto desativado.')) aoSalvar();
}

function formProfissao(p, aoSalvar) {
  const nome = entradaTexto(p?.nome, { maxlength: '60', placeholder: 'Ex.: Guarda, Fazendeiro' });
  const rem = segmentado([['fixo', 'Salário fixo'], ['producao', 'Por produção']], p?.remuneracao || 'fixo', v => { fixos.hidden = v !== 'fixo'; });
  const salario = entradaNumero(p?.salario_base ?? '');
  const freq = entradaFrequencia(p?.frequencia || 'semanal');
  const turnos = entradaNumero(p?.turnos_previstos ?? 5, { step: '1', min: '1', max: '100' });
  const prop = interruptor('Proporcional à presença', p ? p.proporcional : true, null, 'Paga a parte dos turnos cumpridos (ex.: 3 de 5 turnos = 3/5 do salário).');
  const justConta = interruptor('Falta justificada conta como turno', p ? p.justificada_conta : false);
  const regra = entradaTexto(p?.regra, { maxlength: '300', placeholder: 'Ex.: Salário semanal, proporcional à presença' });
  const ativa = p && interruptor('Profissão ativa', p.ativa, null, 'Desativada, não aceita vínculos novos.');
  const just = p ? areaTexto('', { maxlength: '500', rows: '2' }) : null;
  const fixos = h('div', { class: 'form-grade', hidden: (p?.remuneracao || 'fixo') !== 'fixo' },
    campo('Salário-base (Lírios)', salario, { obrigatorio: true, ajuda: 'Por período de pagamento.' }),
    campo('Frequência', freq.el),
    campo('Turnos previstos por período', turnos),
    h('div', { class: 'largo fin-interruptores' }, prop, justConta));
  const marcado = el => el.querySelector('input').checked;
  modalForm({
    titulo: p ? `Editar profissão · ${p.nome}` : 'Nova profissão', textoOk: p ? 'Salvar' : 'Criar profissão', tamanho: 'medio',
    conteudo: [
      campo('Nome', nome, { obrigatorio: true }),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Como recebe'), rem.el,
        p?.vinculos_ativos ? h('small', { class: 'campo-ajuda' }, 'Com vínculos, não dá para trocar entre salário fixo e produção: crie outra profissão.') : null),
      fixos,
      campo('Regra (texto livre)', regra),
      ativa,
      just && campo('Justificativa', just, { ajuda: 'Opcional, mas ajuda quem ler o histórico.' }),
    ],
    aoEnviar: async () => {
      const corpo = {
        nome: nome.value, remuneracao: rem.valor(), regra: regra.value,
        ...(rem.valor() === 'fixo' ? {
          salario_base: salario.value, frequencia: freq.valor(), turnos_previstos: turnos.value,
          proporcional: marcado(prop), justificada_conta: marcado(justConta),
        } : {}),
      };
      if (rem.valor() === 'fixo' && salario.value === '') throw new Error('Informe o salário-base.');
      if (p) {
        await put(`${API}/profissoes/${p.id}`, { ...corpo, ativa: marcado(ativa), justificativa: just.value });
        aviso('Profissão atualizada.');
      } else {
        await post(`${API}/profissoes`, corpo);
        aviso(rem.valor() === 'producao' ? 'Profissão criada. Agora cadastre os produtos e os valores.' : 'Profissão criada.');
      }
      aoSalvar();
    },
  });
}

function formItem(prof, i, unidades, aoSalvar) {
  const nome = entradaTexto(i?.nome, { maxlength: '80', placeholder: 'Ex.: Baú de batata, Lingote de ferro' });
  const unidade = selecao(unidades.map(u => [u, u]), i?.unidade || unidades[0]);
  const valor = entradaNumero(i?.valor ?? '');
  const ativo = i && interruptor('Ativo', i.ativo, null, 'Desativado, não aparece para novas entregas.');
  const just = i ? areaTexto('', { maxlength: '500', rows: '2' }) : null;
  modalForm({
    titulo: i ? `Editar produto · ${i.nome}` : `Novo produto · ${prof.nome}`, textoOk: i ? 'Salvar' : 'Adicionar',
    conteudo: [
      i && h('p', { class: 'nota' }, icone('alerta'), 'O valor novo vale só para as entregas aceitas daqui em diante.'),
      campo('Produto ou recurso', nome, { obrigatorio: true }),
      h('div', { class: 'form-grade' }, campo('Unidade', unidade), campo('Valor por unidade (Lírios)', valor, { obrigatorio: true })),
      ativo,
      just && campo('Justificativa', just, { ajuda: 'Opcional.' }),
    ],
    aoEnviar: async () => {
      const corpo = { nome: nome.value, unidade: unidade.value, valor: valor.value };
      if (i) await put(`${API}/itens/${i.id}`, { ...corpo, ativo: ativo.querySelector('input').checked, justificativa: just.value });
      else await post(`${API}/profissoes/${prof.id}/itens`, corpo);
      aviso(i ? 'Produto atualizado.' : 'Produto adicionado.');
      aoSalvar();
    },
  });
}

