// Peças da Escala da Guarda do Coelho usadas por todas as abas: datas (horário de Brasília), cores dos guardas,
// etiquetas de situação, cópia de texto e a leitura dos erros da API.
import { h, icone, avatar, aviso } from '../core.js';

export { painel, carregando, td, tabela, seguro, agir, selecao, areaTexto, entradaData, entradaTexto, segmentado, pedirTexto, plural } from './escola-comum.js';
export { semanaDe, mesDe, somarDias, diaDaSemana, listaDeDias, SEMANA_CURTA } from './financas-comum.js';

export const API = '/api/guarda-escala';
export const FUSO = 'America/Sao_Paulo';

/* ─── Datas e horas ──────────────────────────────── */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA_LONGA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const paraDia = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
export const diaSemana = s => paraDia(s).getUTCDay(); // 0 = domingo
export const dataBr = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export const diaMes = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const nomeMes = s => `${MESES[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;
export const semanaAbrev = s => SEMANA_ABREV[diaSemana(s)];
export const diaLongo = s => { const t = `${SEMANA_LONGA[diaSemana(s)]}, ${+s.slice(8, 10)} de ${MESES[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`; return t.charAt(0).toUpperCase() + t.slice(1); };

// O servidor guarda criada_em / respondeu_em em UTC ("AAAA-MM-DD HH:MM:SS"). Aqui tudo vira horário de Brasília.
const instante = s => (s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + (String(s).length <= 10 ? 'T12:00:00Z' : 'Z')));
const partesBr = s => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(instante(s)).map(x => [x.type, x.value]));
  return p;
};
export const diaBrDe = s => { if (!s) return ''; const p = partesBr(s); return `${p.year}-${p.month}-${p.day}`; };
export const horaBr = s => { if (!s) return ''; const p = partesBr(s); return `${p.hour}:${p.minute}`; };
export const dataHoraBr = s => (s ? `${dataBr(diaBrDe(s))} às ${horaBr(s)}` : '');
export const agoraBr = () => { const p = partesBr(new Date()); return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }; };
export function quando(s) {
  if (!s) return '';
  const seg = (Date.now() - instante(s).getTime()) / 1000;
  if (seg < 60) return 'agora mesmo';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  return dataHoraBr(s);
}

export const minutos = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const viraNoite = t => minutos(t.fim) <= minutos(t.inicio);
export const horasTexto = n => `${String(Number(n || 0).toFixed(1)).replace('.', ',').replace(/,0$/, '')} h`;
export const faixa = t => `${t.inicio} às ${t.fim}${viraNoite(t) ? ' (dia seguinte)' : ''}`;

/* ─── Guardas e cores ────────────────────────────── */

const PALETA = ['#7fb069', '#e0b84a', '#7ea6c9', '#e0805f', '#b48ead', '#5fb3a8', '#d98fb0', '#a8b85a'];
// A cor de cada guarda segue a ordem do cadastro (por id), então não muda quando alguém é filtrado.
export function corDos(guardas) {
  const mapa = new Map();
  [...guardas].sort((a, b) => a.id - b.id).forEach((g, i) => mapa.set(g.id, PALETA[i % PALETA.length]));
  return id => mapa.get(id) || '#9a9b74';
}

export const SIT_TURNO = {
  agendado: ['Agendado', 'etiqueta'],
  cumprido: ['Cumprido', 'etiqueta etiqueta-ok'],
  faltou: ['Faltou', 'etiqueta gesc-et-ruim'],
};
export const etiquetaTurno = s => { const [nome, classe] = SIT_TURNO[s] || [s, 'etiqueta']; return h('span', { class: classe }, nome); };

export const SIT_CONVOCADO = {
  convocado: ['Convocado', 'etiqueta etiqueta-ouro'],
  compareceu: ['Compareceu', 'etiqueta etiqueta-ok'],
  removido: ['Presença retirada', 'etiqueta gesc-et-ruim'],
};
export const etiquetaConvocado = s => { const [nome, classe] = SIT_CONVOCADO[s] || [s, 'etiqueta']; return h('span', { class: classe }, nome); };

export const pessoa = (g, classe = 'avatar-p') => avatar(g.nome || g.guarda_nome, classe, g.foto || g.guarda_foto);

/* ─── Peças de tela ──────────────────────────────── */

export const botaoAcao = (texto, ic, onclick, classe = '') => h('button', { class: `btn ${classe}`.trim(), type: 'button', onclick }, ic && icone(ic), h('span', null, texto));

// Copia um texto para a área de transferência (com plano B para navegador sem a API).
export async function copiar(texto, entrada) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Link copiado.');
  } catch {
    if (entrada) { entrada.focus(); entrada.select(); }
    try { document.execCommand('copy'); aviso('Link copiado.'); } catch { aviso('Não deu para copiar sozinho: selecione o link e copie.', 'erro'); }
  }
}

// Guarda a escolha da visão (mês ou semana) entre visitas, sem quebrar se o navegador bloquear o armazenamento.
export const lembrar = (chave, valor) => {
  try {
    if (valor === undefined) return localStorage.getItem(`gesc-${chave}`);
    localStorage.setItem(`gesc-${chave}`, valor);
  } catch { /* sem armazenamento */ }
  return null;
};
