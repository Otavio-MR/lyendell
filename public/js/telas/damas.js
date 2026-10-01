// Tabuleiro das Damas (as regras ficam no servidor, em src/damas.js; ele manda as jogadas que valem).
// Quem joga clica numa peça e depois nas casas por onde ela passa; numa captura em sequência,
// clica casa por casa até o fim. Cada um vê as próprias peças embaixo.

import { h, trocar, icone } from '../core.js';

// O que está escolhido: a peça e as casas já clicadas. Some quando o tabuleiro muda.
let escolha = { chave: '', de: null, passos: [] };

// Cor das peças do jogador j: quem começou joga com as claras.
export const nomeCor = (e, j) => (j === e.claras ? 'claras' : 'escuras');

// s = a sala (com s.estado vindo de damas.visao); podeJogar = é a minha vez; jogar(jogada) manda ao servidor.
export function tabuleiroDamas(s, { podeJogar, jogar }) {
  const e = s.estado;
  const chave = `${s.id}:${e.vez}:${JSON.stringify(e.ultima)}`;
  if (escolha.chave !== chave) {
    escolha = { chave, de: null, passos: [] };
    // Só uma peça pode jogar (ex.: captura obrigatória): já vem escolhida.
    const origens = [...new Set(e.jogadas.map(x => x.de))];
    if (podeJogar && origens.length === 1) escolha.de = origens[0];
  }
  // Quem joga com as escuras vê o tabuleiro virado (as próprias peças embaixo).
  const virado = s.eu >= 0 && s.eu !== e.claras;
  const caixa = h('div', { class: 'damas-caixa' });
  const captura = e.jogadas[0]?.capturadas.length || 0;

  function candidatas() {
    if (escolha.de == null) return [];
    return e.jogadas.filter(x => x.de === escolha.de && escolha.passos.every((p, k) => x.caminho[k] === p));
  }

  function clicar(i) {
    if (!podeJogar) return;
    const peca = e.tabuleiro[i];
    // Clicou numa peça sua que pode jogar: escolhe (ou troca de peça).
    if (peca && peca.j === s.eu && e.jogadas.some(x => x.de === i)) {
      escolha.de = escolha.de === i && !escolha.passos.length ? null : i;
      escolha.passos = [];
      desenhar();
      return;
    }
    const proximas = candidatas().filter(x => x.caminho[escolha.passos.length] === i);
    if (!proximas.length) return;
    escolha.passos.push(i);
    // As jogadas que valem capturam todas o mesmo número de peças (lei da maioria), então têm o mesmo
    // número de passos: chegou ao fim de uma, a jogada está feita.
    const completa = proximas.find(x => x.caminho.length === escolha.passos.length);
    if (completa) {
      jogar({ de: completa.de, caminho: completa.caminho });
      return;
    }
    desenhar();
  }

  function desenhar() {
    const cands = candidatas();
    const destinos = new Set(cands.map(x => x.caminho[escolha.passos.length]).filter(v => v != null));
    const capturando = new Set(cands.length ? cands[0].capturadas.slice(0, escolha.passos.length) : []);
    const podeMover = new Set(podeJogar ? e.jogadas.map(x => x.de) : []);
    const ultima = e.ultima;
    const caminhoUltimo = new Set(ultima ? [ultima.de, ...ultima.caminho] : []);
    const capturadasUltima = new Set(ultima?.capturadas || []);
    const casas = [];
    for (let v = 0; v < 64; v++) {
      const i = virado ? 63 - v : v;
      const [l, c] = [i >> 3, i & 7];
      const escura = (l + c) % 2 === 1;
      const peca = e.tabuleiro[i];
      const passo = escolha.passos.indexOf(i);
      const classes = ['damas-casa', escura ? 'escura' : 'clara',
        caminhoUltimo.has(i) && 'ultima', capturadasUltima.has(i) && 'capturada-ultima',
        destinos.has(i) && 'destino', passo >= 0 && 'passo', i === escolha.de && 'escolhida',
        podeMover.has(i) && 'pode-mover'].filter(Boolean).join(' ');
      casas.push(h(escura ? 'button' : 'div', {
        class: classes, type: escura ? 'button' : null,
        'aria-label': escura ? `Casa ${'abcdefgh'[c]}${8 - l}${peca ? `, ${peca.d ? 'dama' : 'pedra'} ${nomeCor(e, peca.j)}` : ''}` : null,
        onclick: escura ? () => clicar(i) : null,
      },
      peca && h('span', {
        class: `damas-peca ${nomeCor(e, peca.j)} ${peca.d ? 'dama' : ''} ${capturando.has(i) ? 'sendo-capturada' : ''} ${ultima && i === ultima.caminho[ultima.caminho.length - 1] ? 'chegou' : ''}`.replace(/\s+/g, ' ').trim(),
      }, peca.d ? icone('coroa') : null),
      passo >= 0 && h('span', { class: 'damas-passo' }, passo + 1)));
    }
    trocar(caixa,
      podeJogar && captura > 0 && h('p', { class: 'damas-aviso' }, icone('alerta'),
        captura === 1 ? 'Captura obrigatória: você precisa capturar.' : `Captura obrigatória: a jogada tem que capturar ${captura} peças (lei da maioria).`),
      h('div', { class: `damas ${podeJogar ? 'pode' : ''} ${s.status === 'fim' ? 'terminou' : ''}`.replace(/\s+/g, ' ').trim() }, casas),
      e.empateEm != null && s.status === 'jogando' && h('p', { class: 'damas-aviso suave' }, icone('relogio'),
        `Só damas andando: empate em ${e.empateEm} ${e.empateEm === 1 ? 'lance' : 'lances'} se ninguém capturar.`),
      podeJogar && escolha.de != null && escolha.passos.length > 0 && h('button', {
        type: 'button', class: 'btn btn-pequeno damas-desfazer', onclick: () => { escolha.passos = []; desenhar(); },
      }, icone('voltar'), h('span', null, 'Recomeçar o caminho')));
  }

  desenhar();
  return caixa;
}
