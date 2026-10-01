// Ícones dos lugares do mapa (prédios, lojas, pontos e, se quiser, as casas). Todos no mesmo traço
// dos ícones do site: 24 x 24, só contorno. A ordem aqui é a ordem do seletor de ícones.
import { ICONES } from './core.js';

function septo() {
  // Estrela de sete pontas.
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 7;
    const raio = i % 2 ? 4.2 : 9;
    pts.push(`${Math.round((12 + raio * Math.cos(ang)) * 10) / 10} ${Math.round((12 + raio * Math.sin(ang)) * 10) / 10}`);
  }
  return `<path d="M${pts.join(' L')} Z"/>`;
}

const DESENHOS = {
  castelo: '<path d="M2.5 21h19"/><path d="M3.5 21V8h2V6h1.8v2h1.7v13"/><path d="M15 21V8h1.7V6h1.8v2h2v13"/>'
    + '<path d="M9 21V11h6v10"/><path d="M12 11V4.5l3 1-3 1"/><path d="M10.5 21v-2.5a1.5 1.5 0 0 1 3 0V21"/>',
  septo: septo(),
  taverna: '<path d="M5 8h10v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10.5h2.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H15"/>'
    + '<path d="M5 8c0-2.2 1.6-3.5 3.2-3.2.9-1.4 3-1.4 3.8 0C13.6 4.5 15 5.8 15 8"/><path d="M8.5 11.5v5.5M11.5 11.5v5.5"/>',
  ferraria: '<path d="M3 7h13.5a4.5 4.5 0 0 0 4.5 3.5h-4l-1.5 3H8.5L6.5 10H4z"/><path d="M9.5 13.5v2.5L7 20.5h10l-2.5-4.5v-2.5"/>',
  fazenda: '<path d="M12 21V8"/><path d="M12 8c-2.5 0-3.5-2-3.5-4.5 2.5 0 3.5 2 3.5 4.5zM12 8c2.5 0 3.5-2 3.5-4.5-2.5 0-3.5 2-3.5 4.5z"/>'
    + '<path d="M12 13c-2.5 0-3.5-2-3.5-4.5 2.5 0 3.5 2 3.5 4.5zM12 13c2.5 0 3.5-2 3.5-4.5-2.5 0-3.5 2-3.5 4.5z"/>'
    + '<path d="M12 18c-2.5 0-3.5-2-3.5-4.5 2.5 0 3.5 2 3.5 4.5zM12 18c2.5 0 3.5-2 3.5-4.5-2.5 0-3.5 2-3.5 4.5z"/>',
  porto: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 10.5h8"/><path d="M4.5 13.5a7.5 7.5 0 0 0 15 0"/><path d="m3 15 1.5-1.5L6 15M18 15l1.5-1.5L21 15"/>',
  estabulo: '<path d="M6 20.5 5.5 11a6.5 6.5 0 0 1 13 0l-.5 9.5h-3.5l.5-9.5a3 3 0 0 0-6 0l.5 9.5z"/><path d="M6 15.5h2.6M15.4 15.5H18"/>',
  torre: '<path d="M7 21V9h10v12"/><path d="M6 9V4h2.5v2h2V4h3v2h2V4H18v5"/><path d="M5 21h14"/><path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4"/><path d="M11 11.5h2"/>',
  poco: '<path d="M5 13h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M5 16.5h14"/><path d="M6.5 13V7.5M17.5 13V7.5"/><path d="M4 8 12 3.5 20 8"/><path d="M12 7.5v3"/>',
  jardim: '<circle cx="12" cy="9.5" r="6"/><path d="M12 15.5V21M8.5 21h7"/><path d="M12 13l-2.5-2.5M12 11.5l2-2"/>',
  sino: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21.2h4"/><path d="M12 3v2"/>',
  peixe: '<path d="M2.5 12c3-5 9.5-6 14-1.2.6.7.6 1.7 0 2.4-4.5 4.8-11 3.8-14-1.2z"/><path d="m16.5 12 5-4v8z"/><circle cx="7" cy="11" r=".9"/>',
  padaria: '<path d="M4 15c0-5 3.6-8 8-8s8 3 8 8v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 9.5 10 13M13 8.5v4M16.5 9.8 15.3 13"/>',
  pocao: '<path d="M10 3h4M10.5 3v5L6 15.5A3.5 3.5 0 0 0 9 21h6a3.5 3.5 0 0 0 3-5.5L13.5 8V3"/><path d="M7.5 14h9"/>',
  barraca: '<path d="M3 10 12 4l9 6"/><path d="M5 10v10M19 10v10M3 20h18"/><path d="M5 10c0 2 1.5 3 3.5 3S12 12 12 10c0 2 1.5 3 3.5 3S19 12 19 10"/>',
};

// [id, nome no seletor]. Os que não estão em DESENHOS vêm dos ícones do site (core.js).
const LISTA = [
  ['casa', 'Casa'], ['loja', 'Loja'], ['barraca', 'Mercado'], ['taverna', 'Taverna'], ['padaria', 'Padaria'],
  ['peixe', 'Peixaria'], ['ferraria', 'Ferraria'], ['pocao', 'Boticário'], ['fazenda', 'Fazenda'], ['estabulo', 'Estábulo'],
  ['porto', 'Porto'], ['castelo', 'Castelo'], ['torre', 'Torre'], ['septo', 'Templo'], ['sino', 'Capela'],
  ['coluna', 'Senado'], ['pergaminho', 'Cartório'], ['balanca', 'Justiça'], ['escudo', 'Guarda'], ['grades', 'Prisão'],
  ['espada', 'Arena'], ['alvo', 'Treino'], ['moeda', 'Banco'], ['cruz', 'Hospital'], ['livro', 'Biblioteca'],
  ['musica', 'Teatro'], ['jardim', 'Jardim'], ['poco', 'Poço'], ['bau', 'Armazém'], ['coroa', 'Nobreza'],
  ['bandeira', 'Bandeira'], ['coelho', 'Coelho'], ['chave', 'Chave'], ['estrela', 'Outro'],
];

export const ICONES_MAPA = LISTA.map(([id, nome]) => ({ id, nome, svg: DESENHOS[id] || ICONES[id] || ICONES.estrela }));
const POR_ID = new Map(ICONES_MAPA.map(i => [i.id, i]));
export const desenhoDoIcone = id => (POR_ID.get(id) || POR_ID.get('estrela')).svg;
export const nomeDoIcone = id => POR_ID.get(id)?.nome || '';
