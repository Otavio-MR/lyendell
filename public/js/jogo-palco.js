// Cola entre o ajustarJogo (ajuste-tela.js) e as telas de jogo da Recreação: o tabuleiro sempre cabe na janela,
// descontando o que fica em cima (cabeçalho, placar) e o que fica embaixo (botões, controles de toque).
//
//   const palco = h('div', { class: 'cobra-moldura palco' }, canvas, sobre);
//   const ajuste = palcoDoJogo(palco, { proporcao: 1, abaixo: [dpad], tela: true });
//   cabecalho.append(ajuste.botao)   // só quando tela: true
import { h, icone } from './core.js';
import { ajustarJogo } from './ajuste-tela.js';

// Altura (px) que o resto da tela ocupa: tudo acima do palco (posição na página) mais os irmãos que ficam
// empilhados embaixo dele. Em tela cheia, só o que for pedido em `dentro()`.
function reserva(palco, abaixo, dentro) {
  return cheio => {
    if (cheio) return dentro ? dentro() : 0;
    const topo = palco.getBoundingClientRect().top + window.scrollY;
    let extra = 0;
    for (const el of abaixo()) {
      if (!el || el.hidden || !el.isConnected) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      // Só conta o que está de fato embaixo do palco (no layout deitado, os controles ficam do lado).
      if (el.offsetTop <= palco.offsetTop + 8) continue;
      if (el.offsetLeft + el.offsetWidth <= palco.offsetLeft + 2 || el.offsetLeft >= palco.offsetLeft + palco.offsetWidth - 2) continue; // ficou do lado
      extra += el.offsetHeight + 12;
    }
    return topo + extra + 14;
  };
}

// opcoes: proporcao (largura / altura do tabuleiro), abaixo (elementos que ficam embaixo, lista ou função),
// maxLargura, aoMudar, tela (true: o palco tem botão e saída de tela cheia), dentro (altura reservada em tela cheia),
// travarDeitado (tela cheia deita o celular).
export function palcoDoJogo(palco, { proporcao = 1, abaixo = [], maxLargura = 640, aoMudar = null, tela = false, dentro = null, travarDeitado = false, escapeSai = true } = {}) {
  palco.classList.add('palco');
  const lista = typeof abaixo === 'function' ? abaixo : () => abaixo;
  let margem = reserva(palco, lista, dentro);
  // proporcao pode ser uma função (tabuleiros que mudam de forma, como a memória): o palco ganha altura = largura / proporcao.
  if (typeof proporcao === 'function') {
    const lerProporcao = proporcao;
    const base = margem;
    proporcao = 1;
    margem = cheio => {
      const vh = window.visualViewport?.height ? Math.round(window.visualViewport.height) : window.innerHeight;
      const m = base(cheio);
      const util = vh - m - (cheio ? 8 : 0);
      return vh - (cheio ? 8 : 0) - util * (Number(lerProporcao()) || 1);
    };
  }
  const ajuste = ajustarJogo(palco, { proporcao, margemY: margem, maxLargura, aoMudar, travarDeitado, escapeSai, compacto: true });
  if (tela) {
    // O botão do cabeçalho some quando o palco ocupa a tela toda: esta saída fica dentro do palco.
    palco.append(h('button', { type: 'button', class: 'palco-sair', title: 'Sair da tela cheia', 'aria-label': 'Sair da tela cheia', onclick: () => ajuste.sair() }, icone('x')));
  }
  return ajuste;
}

// Em tela cheia o placar e os botões de toque (cobrinha, pac-coelho) vão para dentro do palco e voltam ao sair.
const deitadoBaixo = () => matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
export function dentroDaTelaCheia(placar, dpad) {
  if (deitadoBaixo()) return 0; // deitado: o placar e as setas ficam por cima, nos cantos
  const toque = dpad.parentElement?.classList.contains('palco') || getComputedStyle(dpad).display !== 'none';
  const comSetas = toque && matchMedia('(pointer: coarse)').matches;
  return (placar.offsetHeight || 44) + (comSetas ? (dpad.offsetHeight || 190) + 12 : 0) + 24;
}
export function encaixarNoPalco(cheio, palco, placar, dpad, area) {
  const dentro = placar.parentElement === palco;
  if (cheio && !dentro) { palco.prepend(placar); palco.append(dpad); } else if (!cheio && dentro) { area.prepend(placar); area.append(dpad); }
}
