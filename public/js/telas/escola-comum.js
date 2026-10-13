// Peças da Escola Luckham usadas por várias abas: etiquetas de situação, tabelas, campos, datas e notas.
import { h, icone, dataCurta, avatar, aviso } from '../core.js';

export { selecao, areaTexto, entradaData, entradaNumero, entradaTexto, segmentado, pedirTexto } from './financas-comum.js';

export const API = '/api/escola';

// Os dados de busca que vêm no endereço (#/escola/alunos?situacao=em_analise).
export const consulta = () => new URLSearchParams(location.hash.split('?')[1] || '');

/* ─── Situações ──────────────────────────────────── */

// [nome, classe da etiqueta]
export const SIT_ALUNO = {
  em_analise: ['Em análise', 'escola-ouro'], matriculado: ['Matriculado', 'escola-bom'], afastado: ['Afastado', 'escola-azul'],
  concluido: ['Concluído', 'escola-azul'], desligado: ['Desligado', 'escola-ruim'],
};
export const SIT_PROFESSOR = {
  avaliacao: ['Em avaliação', 'escola-ouro'], titular: ['Titular', 'escola-bom'], substituto: ['Substituto', 'escola-azul'],
  afastado: ['Afastado', 'escola-azul'], desligado: ['Desligado', 'escola-ruim'],
};
export const SIT_AULA = {
  agendada: ['Agendada', 'escola-ouro'], realizada: ['Realizada', 'escola-bom'], cancelada: ['Cancelada', 'escola-ruim'],
};
export const SIT_PRESENCA = {
  presente: ['Presente', 'escola-bom'], falta: ['Falta', 'escola-ruim'], justificada: ['Justificada', 'escola-ouro'],
};
export const SIT_BOLETIM = {
  aprovado: ['Aprovado', 'escola-bom'], recuperacao: ['Em recuperação', 'escola-ruim'], sem_notas: ['Sem notas', ''],
};

export const etiqueta = (mapa, chave, extra) => {
  const [nome, classe] = mapa[chave] || [chave, ''];
  return h('span', { class: `etiqueta ${classe}`.trim() }, extra && icone(extra), nome);
};

/* ─── Formatação ─────────────────────────────────── */

export const notaBr = n => (n == null ? '-' : Number(n).toFixed(1).replace('.', ','));
export const matriculaNum = n => (n ? `nº ${String(n).padStart(4, '0')}` : 'sem número');
export const idadeTexto = n => (n == null ? '' : `${n} ${n === 1 ? 'ano' : 'anos'}`);
const paraDia = s => new Date(`${String(s).slice(0, 10)}T12:00:00`);
export function diaLongo(s) {
  if (!s) return '';
  const t = paraDia(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function diaCurtoSemana(s) {
  if (!s) return '';
  return paraDia(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
}
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ─── Peças de tela ──────────────────────────────── */

export const carregando = () => h('div', { class: 'carregando-tela escola-carregando' }, h('span', { class: 'giro' }));

export const painel = (titulo, ic, conteudo, acao) => h('section', { class: 'painel escola-painel' },
  h('div', { class: 'painel-cab' }, h('h2', null, ic && icone(ic), titulo), acao),
  conteudo);

export const vazioSimples = texto => h('p', { class: 'painel-vazio escola-vazio' }, texto);

// Célula com rótulo (o rótulo aparece no celular, quando a tabela vira cartão).
export const td = (rotulo, conteudo, classe) => h('td', { 'data-rotulo': rotulo || null, class: classe || null }, conteudo);
export function tabela(cabecalhos, linhas, { classe = '', vazio = 'Nada por aqui.' } = {}) {
  if (!linhas.length) return h('p', { class: 'tabela-vazia escola-tabela-vazia' }, vazio);
  return h('div', { class: 'tabela-wrap' }, h('table', { class: `tabela tabela-responsiva ${classe}`.trim() },
    h('thead', null, h('tr', null, cabecalhos.map(c => h('th', null, c)))),
    h('tbody', null, linhas)));
}

// Foto de pessoa (aluno ou professor): a foto enviada ou as iniciais.
export const foto = (p, classe = 'avatar-m') => avatar(p.nome, classe, p.foto);

// Mostra o erro de uma área que falhou ao carregar, sem derrubar a tela inteira.
export async function seguro(area, fn) {
  try { await fn(); } catch (e) {
    area.replaceChildren(h('p', { class: 'form-erro', role: 'alert' }, e.status === 403 ? 'Você não tem permissão para ver isto.' : e.message));
  }
}

// Roda uma ação mostrando o erro num aviso e desabilitando o botão enquanto envia.
export async function agir(botao, fn, sucesso) {
  if (botao) botao.disabled = true;
  try {
    const r = await fn();
    if (sucesso) aviso(sucesso);
    return r ?? true;
  } catch (e) {
    aviso(e.message, 'erro');
    return null;
  } finally {
    if (botao) botao.disabled = false;
  }
}

export const dataOuTraco = s => (s ? dataCurta(s) : '-');

// O detalhe do histórico vem do servidor com os nomes internos das situações e pontos nos decimais.
export const detalheLegivel = t => String(t || '')
  .replace(/em_analise/g, 'em análise').replace(/avaliacao/g, 'em avaliação').replace(/concluido/g, 'concluído')
  .replace(/(\d)\.(\d)/g, '$1,$2');
