// Peças da Gestão Financeira usadas por várias abas: formatação em Lírios, datas do período, etiquetas,
// tabelas, CSV, pedidos de justificativa e o reenvio com autorização (exceção de saldo, valores de demonstração).
import { h, icone, num, dataCurta, dataHora, hojeIso, modal, confirmar, pode, campo } from '../core.js';

export const API = '/api/financas';

/* ─── Valores e datas ────────────────────────────── */

export const lirios = n => `${num(n)} Lírios`;
// Valor com sinal e cor: entrada (positivo) em verde, saída (negativo) em vermelho.
export const valorSinal = n => h('span', { class: `nowrap ${n < 0 ? 'fin-saida' : n > 0 ? 'fin-entrada' : ''}`.trim() },
  `${n > 0 ? '+' : ''}${lirios(n)}`);

const diaUTC = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
const iso = d => d.toISOString().slice(0, 10);
export const somarDias = (s, n) => { const d = diaUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const diaDaSemana = s => diaUTC(s).getUTCDay(); // 0 = domingo
export const diasEntre = (a, b) => Math.round((diaUTC(b) - diaUTC(a)) / 864e5) + 1;
export function listaDeDias(inicio, fim) {
  const dias = [];
  for (let d = inicio; d <= fim && dias.length < 93; d = somarDias(d, 1)) dias.push(d);
  return dias;
}
// Semana de segunda a domingo que contém o dia.
export function semanaDe(s = hojeIso()) {
  const inicio = somarDias(s, -((diaDaSemana(s) + 6) % 7));
  return { inicio, fim: somarDias(inicio, 6) };
}
export const semanaPassada = () => semanaDe(somarDias(semanaDe().inicio, -7));
export function mesDe(s = hojeIso()) {
  const inicio = `${s.slice(0, 8)}01`;
  const d = diaUTC(inicio);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { inicio, fim: iso(d) };
}
export const periodoTexto = (inicio, fim) => `${dataCurta(inicio)} a ${dataCurta(fim)}`;
export const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* ─── Nomes e etiquetas ──────────────────────────── */

const FREQ = { semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };
export const nomeFrequencia = f => FREQ[f] || (/^\d+d$/.test(f || '') ? `A cada ${parseInt(f, 10)} dias` : f || '');

export const SIT_VINCULO = {
  ativo: ['Ativo', 'fin-bom'], suspenso: ['Suspenso', 'fin-ouro'], encerrado: ['Encerrado', ''],
};
export const SIT_FOLHA = {
  revisao: ['Em revisão', 'fin-ouro'], aprovada: ['Aprovada, a pagar', 'fin-azul'], rejeitada: ['Rejeitada', 'fin-ruim'], paga: ['Paga', 'fin-bom'],
};
export const SIT_ENTREGA = {
  pendente: ['Esperando conferência', 'fin-ouro'], aceita: ['Aceita', 'fin-bom'], rejeitada: ['Rejeitada', 'fin-ruim'],
};
// Presenças: nome, letra da grade e cor.
export const SIT_PRESENCA = {
  presente: ['Presente', 'P', 'fin-bom'], falta: ['Falta', 'F', 'fin-ruim'], justificada: ['Falta justificada', 'J', 'fin-ouro'],
  licenca: ['Licença', 'L', 'fin-azul'], missao: ['Missão oficial', 'M', 'fin-azul'],
};
export const TIPO_MOV = {
  saldo_inicial: 'Saldo inicial', receita: 'Receita', despesa: 'Despesa', ajuste: 'Ajuste', transferencia: 'Transferência', salario: 'Salário', estorno: 'Estorno',
};
export const TIPO_ITEM = { fixo: 'Salário fixo', producao: 'Produção', ajuste: 'Ajuste' };

export const etiqueta = (mapa, chave, extra) => {
  const [nome, classe] = mapa[chave] || [chave, ''];
  return h('span', { class: `etiqueta ${classe}`.trim() }, extra && icone(extra), nome);
};
export const chipDemo = () => h('span', { class: 'etiqueta fin-demo', title: 'Valor de exemplo que ainda não foi conferido pelo Mestre da Moeda' }, icone('alerta'), 'Valor de demonstração');
export const chipTravado = folhaId => h('span', { class: 'etiqueta', title: `Já está na folha nº ${folhaId}: corrija com um ajuste na folha` }, icone('cadeado'), `Folha nº ${folhaId}`);

/* ─── Tabelas ────────────────────────────────────── */

// Célula com rótulo (o rótulo aparece no celular, quando a tabela vira cartões).
export const td = (rotulo, conteudo, classe) => h('td', { 'data-rotulo': rotulo || null, class: classe || null }, conteudo);
export function tabela(cabecalhos, linhas, { classe = '', vazio = 'Nada por aqui.' } = {}) {
  if (!linhas.length) return h('p', { class: 'tabela-vazia fin-vazia' }, vazio);
  return h('div', { class: 'tabela-wrap' }, h('table', { class: `tabela tabela-responsiva ${classe}`.trim() },
    h('thead', null, h('tr', null, cabecalhos.map(c => h('th', { class: /^(Valor|Total|Pago|A pagar|Calculado|Qtd)/.test(c) ? 'num' : null }, c)))),
    h('tbody', null, linhas)));
}

export const painel = (titulo, ic, conteudo, acao) => h('section', { class: 'painel fin-painel' },
  h('div', { class: 'painel-cab' }, h('h2', null, ic && icone(ic), titulo), acao),
  conteudo);

export const carregando = () => h('div', { class: 'carregando-tela fin-carregando' }, h('span', { class: 'giro' }));

/* ─── Campos ─────────────────────────────────────── */

export const entradaData = (valor, attrs = {}) => h('input', { class: 'input', type: 'date', value: valor || '', ...attrs });
export const entradaNumero = (valor, attrs = {}) => h('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.01', min: '0', value: valor ?? '', ...attrs });
export const entradaTexto = (valor, attrs = {}) => h('input', { class: 'input', value: valor || '', ...attrs });
export const areaTexto = (valor, attrs = {}) => h('textarea', { class: 'input', rows: '3', ...attrs }, valor || '');
export function selecao(opcoes, valor, attrs = {}) {
  return h('select', { class: 'input', ...attrs }, opcoes.map(([v, nome]) => h('option', { value: v, selected: String(v) === String(valor ?? '') }, nome)));
}
// Grupo de botões (um escolhido). Devolve { el, valor() }.
export function segmentado(opcoes, valor, aoMudar) {
  let atual = valor;
  const el = h('div', { class: 'segmentado', role: 'radiogroup' });
  const desenhar = () => el.replaceChildren(...opcoes.map(([v, nome]) => h('button', {
    type: 'button', class: `seg ${v === atual ? 'ativo' : ''}`.trim(), role: 'radio', 'aria-checked': String(v === atual),
    onclick: () => { atual = v; desenhar(); aoMudar?.(v); },
  }, nome)));
  desenhar();
  return { el, valor: () => atual };
}

// Frequência de pagamento: semanal, quinzenal, mensal ou "a cada N dias" (guardada como "Nd").
export function entradaFrequencia(valor = 'semanal') {
  const outra = !FREQ[valor];
  const sel = selecao([['semanal', 'Semanal (7 dias)'], ['quinzenal', 'Quinzenal (14 dias)'], ['mensal', 'Mensal (30 dias)'], ['outra', 'A cada N dias']], outra ? 'outra' : valor);
  const dias = h('input', { class: 'input fin-dias', type: 'number', min: '1', max: '365', step: '1', inputmode: 'numeric', value: outra ? parseInt(valor, 10) || 10 : 10, 'aria-label': 'Número de dias' });
  const caixaDias = h('span', { class: 'fin-freq-dias', hidden: !outra }, dias, h('span', { class: 'suave' }, 'dias'));
  sel.addEventListener('change', () => { caixaDias.hidden = sel.value !== 'outra'; });
  return {
    el: h('div', { class: 'fin-freq' }, sel, caixaDias),
    valor() {
      if (sel.value !== 'outra') return sel.value;
      const n = parseInt(dias.value, 10);
      if (!(n >= 1 && n <= 365)) throw new Error('Diga a cada quantos dias (de 1 a 365).');
      return `${n}d`;
    },
  };
}

// Escolha de período com atalhos. aoMudar(inicio, fim) roda quando a pessoa aplica.
export function seletorPeriodo({ inicio, fim, aoMudar, atalhos = ['semana', 'passada', 'mes'], botao = 'Ver' }) {
  const ini = entradaData(inicio, { 'aria-label': 'Início do período' });
  const fi = entradaData(fim, { 'aria-label': 'Fim do período' });
  const ATALHOS = { semana: ['Esta semana', semanaDe], passada: ['Semana passada', semanaPassada], mes: ['Este mês', mesDe] };
  const aplicar = () => {
    if (ini.value && fi.value && ini.value > fi.value) { fi.value = ini.value; }
    aoMudar(ini.value, fi.value);
  };
  return h('div', { class: 'fin-periodo' },
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'De'), ini),
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Até'), fi),
    h('button', { class: 'btn', type: 'button', onclick: aplicar }, icone('calendario'), h('span', null, botao)),
    atalhos.length ? h('div', { class: 'segmentado fin-atalhos' }, atalhos.map(k => h('button', {
      type: 'button', class: 'seg',
      onclick: () => { const p = ATALHOS[k][1](); ini.value = p.inicio; fi.value = p.fim; aplicar(); },
    }, ATALHOS[k][0]))) : null);
}

/* ─── Diálogos ───────────────────────────────────── */

// Pede um texto (justificativa, motivo). Devolve o texto, ou null se a pessoa desistir.
export function pedirTexto({ titulo, texto, rotulo = 'Justificativa', ajuda = 'Fica registrada no histórico.', ok = 'Confirmar', perigo = false, minimo = 5, valor = '' }) {
  return new Promise(resolve => {
    let resposta = null;
    const area = areaTexto(valor, { maxlength: '500', autofocus: true });
    const erro = h('p', { class: 'form-erro', role: 'alert', hidden: true });
    const enviar = e => {
      e?.preventDefault();
      const v = area.value.trim();
      if (v.length < minimo) { erro.textContent = `Escreva pelo menos ${minimo} letras.`; erro.hidden = false; area.focus(); return; }
      resposta = v;
      m.fechar();
    };
    const m = modal({
      titulo, tamanho: 'pequeno', fecharFora: false, aoFechar: () => resolve(resposta),
      corpo: h('form', { class: 'form', onsubmit: enviar },
        texto && h('p', { class: 'confirmar-texto' }, texto),
        campo(rotulo, area, { ajuda, obrigatorio: true }), erro),
      rodape: [
        h('span', { class: 'espaco' }),
        h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
        h('button', { class: `btn ${perigo ? 'btn-perigo' : 'btn-ouro'}`, type: 'button', onclick: enviar }, ok),
      ],
    });
  });
}

// Envia uma ação que o servidor pode barrar (409) por passar do saldo disponível ou por usar valores de
// demonstração. Pergunta o que faltar e reenvia com a autorização. Devolve a resposta, ou null se a pessoa desistir.
// Sem a permissão de exceção, o erro do saldo segue para quem chamou (e aparece para a pessoa).
export async function enviarComAutorizacao(fn, corpo = {}) {
  for (;;) {
    try {
      return await fn(corpo);
    } catch (e) {
      if (e.status !== 409) throw e;
      if (/demonstra/i.test(e.message) && !corpo.aceitar_demonstracao) {
        const ok = await confirmar(`${e.message} (Valores de demonstração são exemplos que ainda não foram conferidos na Tabela de salários.)`,
          { titulo: 'Valores de demonstração', ok: 'Aprovar assim mesmo' });
        if (!ok) return null;
        corpo = { ...corpo, aceitar_demonstracao: true };
        continue;
      }
      if (/saldo/i.test(e.message) && pode('financas.excecao') && !corpo.excecao_justificativa) {
        const j = await pedirTexto({
          titulo: 'Autorizar pagamento excepcional',
          texto: `${e.message.replace(/ Para autorizar mesmo assim.*$/, '')} Você pode autorizar mesmo assim, como exceção.`,
          rotulo: 'Justificativa da exceção', ajuda: 'Obrigatória. Fica registrada no histórico com o seu nome.', ok: 'Autorizar e enviar', perigo: true,
        });
        if (!j) return null;
        corpo = { ...corpo, excecao_justificativa: j };
        continue;
      }
      throw e;
    }
  }
}

/* ─── CSV ────────────────────────────────────────── */

// Número no formato do Excel brasileiro (vírgula decimal).
export const csvNum = n => (n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
// Baixa um CSV (UTF-8 com BOM e ";" para o Excel em português).
export function baixarCsv(nome, cabecalhos, linhas) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const texto = [cabecalhos, ...linhas].map(l => l.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', texto], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: nome, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ─── Histórico (auditoria) ──────────────────────── */

const ACOES = {
  criar: 'Criou', criar_aceita: 'Registrou já aceita', editar: 'Editou', corrigir: 'Corrigiu', apagar: 'Apagou', aceitar: 'Aceitou', rejeitar: 'Rejeitou',
  fechar: 'Fechou para revisão', aprovar: 'Aprovou', pagar: 'Pagou', ajuste: 'Lançou ajuste', revisar_item: 'Revisou o valor de um item',
  estornar: 'Estornou', observacoes: 'Mudou as observações', ativo: 'Reativou', suspenso: 'Suspendeu', encerrado: 'Encerrou',
};
const ENTIDADES = { vinculo: 'vínculo', cidadao: 'cidadão', folha: 'folha', presenca: 'presença', entrega: 'entrega', profissao: 'profissão', item: 'item', movimento: 'movimentação', config: 'configurações' };
const OCULTOS = new Set(['id', 'chave', 'criado_em', 'criado_por_nome', 'atualizado_em', 'atualizado_por_nome', 'ordem', 'presencas', 'entregas']);
const lerJson = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const mostrar = v => (v == null || v === '' ? 'vazio' : typeof v === 'object' ? JSON.stringify(v) : String(v));

// O que mudou entre o antes e o depois, em linhas curtas ("salario_base: 40 → 50").
function mudancas(antes, depois) {
  antes = lerJson(antes);
  depois = lerJson(depois);
  if (depois == null || typeof depois !== 'object') return depois == null ? [] : [`${mostrar(antes)} → ${mostrar(depois)}`];
  return Object.entries(depois)
    .filter(([k, v]) => !OCULTOS.has(k) && (antes == null || typeof antes !== 'object' || mostrar(antes[k]) !== mostrar(v)))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${antes && typeof antes === 'object' && k in antes ? `${mostrar(antes[k])} → ` : ''}${mostrar(v)}`);
}

export function listaAuditoria(linhas, { comEntidade = false } = {}) {
  if (!linhas.length) return h('p', { class: 'painel-vazio' }, 'Nenhuma mudança registrada.');
  return h('ol', { class: 'fin-historico' }, linhas.map(a => {
    const det = mudancas(a.antes, a.depois);
    return h('li', null,
      h('div', { class: 'fin-hist-topo' },
        h('strong', null, `${ACOES[a.acao] || a.acao}${comEntidade ? ` ${ENTIDADES[a.entidade] || a.entidade}${a.entidade_id ? ` nº ${a.entidade_id}` : ''}` : ''}`),
        h('span', { class: 'suave' }, `${a.usuario_nome || 'Sistema'}, ${dataHora(a.criado_em)}`)),
      a.justificativa && h('p', { class: 'fin-hist-just' }, icone('pena'), a.justificativa),
      det.length ? h('details', { class: 'fin-hist-det' }, h('summary', null, 'Ver o que mudou'), h('ul', null, det.slice(0, 20).map(t => h('li', null, t)))) : null);
  }));
}
