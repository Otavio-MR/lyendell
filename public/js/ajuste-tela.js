// Ajuste de tela dos jogos: cabe na janela (largura e altura), acompanha a rotação e o redimensionamento e
// tem botão de tela cheia (com "modo foco" no lugar, para os navegadores que não têm tela cheia, como o iPhone).
//
//   const palco = h('div', { class: 'palco' }, canvas);
//   const ajuste = ajustarJogo(palco, { proporcao: 4 / 3, margemY: 200, aoMudar: ({ largura, altura }) => redesenhar() });
//   cabecalho.append(ajuste.botao);        // botão "Tela cheia" (opcional)
//
// O palco ganha as variáveis --palco-w e --palco-h (px) e a classe .palco-foco enquanto está em tela cheia.
// A limpeza (ouvintes) acontece sozinha ao sair da tela (aoSair do core).
//
// Opções:
//   proporcao: largura / altura da área do jogo (o canvas); margemX/margemY: o que sobra em volta (px).
//     margemY e margemX também podem ser funções: (cheio) => px (cheio: está em tela cheia ou modo foco).
//   maxLargura: largura máxima do jogo (px).
//   aoMudar({ largura, altura, cheio }): chamada a cada medida (redesenhe aqui).
//   travarDeitado: ao entrar em tela cheia de verdade, tenta deitar a tela do celular (jogos largos).
//   escapeSai: false para o jogo usar o Esc para outra coisa (no modo foco o Esc não sai).
//   compacto: o botão é só um ícone (sem texto), do tamanho dos outros botões de ícone.
// Devolve { medir, botao, entrar, sair, alternar, ativo() }.
import { h, aoSair, icone, trocar } from './core.js';

// O ícone de "voltar ao tamanho normal": as quatro setas do "expandir", viradas para dentro.
export function iconeReduzir() {
  const svg = icone('expandir');
  svg.innerHTML = '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>';
  return svg;
}

export const emTelaCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export function ajustarJogo(palco, { proporcao = 1, margemY = 190, margemX = 0, maxLargura = 1100, aoMudar = null, travarDeitado = false, escapeSai = true, compacto = false } = {}) {
  let foco = false;
  let ultimo = '';
  const valor = (v, cheio) => (typeof v === 'function' ? Number(v(cheio)) || 0 : v);
  const ativo = () => foco || emTelaCheia();

  const rotular = cheio => {
    const texto = cheio ? 'Sair da tela cheia' : 'Tela cheia';
    botao.title = texto;
    botao.setAttribute('aria-label', texto);
    botao.setAttribute('aria-pressed', cheio ? 'true' : 'false');
    trocar(botao, cheio ? iconeReduzir() : icone('expandir'), !compacto && h('span', null, texto));
  };

  const medir = () => {
    if (!palco.isConnected) return;
    const cheio = ativo();
    const vw = document.documentElement?.clientWidth || window.innerWidth || 800;
    const vh = window.visualViewport?.height ? Math.round(window.visualViewport.height) : (window.innerHeight || 600);
    const limiteW = Math.max(200, Math.min(maxLargura, (cheio ? vw : palco.parentElement?.clientWidth || vw) - valor(margemX, cheio)));
    const limiteH = Math.max(140, cheio ? vh - 8 - valor(margemY, cheio) : vh - valor(margemY, cheio));
    const largura = Math.floor(Math.min(limiteW, limiteH * proporcao));
    const altura = Math.floor(largura / proporcao);
    palco.style.setProperty('--palco-w', `${largura}px`);
    palco.style.setProperty('--palco-h', `${altura}px`);
    palco.classList.toggle('palco-foco', cheio);
    document.body.classList.toggle('tem-palco-foco', cheio);
    const marca = `${cheio}`;
    if (marca !== ultimo) { ultimo = marca; rotular(cheio); }
    if (aoMudar) aoMudar({ largura, altura, cheio });
  };

  const destravar = () => { try { screen.orientation?.unlock?.(); } catch { /* sem suporte */ } };
  const sair = () => {
    foco = false;
    if (emTelaCheia()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* tudo bem */ } }
    destravar();
    medir();
  };
  const entrar = async () => {
    const pedir = palco.requestFullscreen || palco.webkitRequestFullscreen;
    if (pedir) {
      try {
        // Alguns navegadores embutidos deixam o pedido pendente para sempre: depois de um tempo, cai no modo foco.
        await Promise.race([pedir.call(palco), new Promise((_, no) => setTimeout(() => no(new Error('demorou')), 900))]);
        if (!emTelaCheia()) throw new Error('sem tela cheia');
        if (travarDeitado) { try { await screen.orientation?.lock?.('landscape'); } catch { /* o aparelho não deixa */ } }
        medir();
        return;
      } catch { /* cai no modo foco */ }
    }
    foco = true;
    medir();
  };
  const alternar = () => (ativo() ? sair() : entrar());
  const botao = h('button', {
    type: 'button', class: compacto ? 'btn-icone botao-tela-cheia' : 'btn btn-pequeno botao-tela-cheia', onclick: alternar,
  });
  rotular(false);

  const aoTecla = e => { if (escapeSai && e.key === 'Escape' && foco) sair(); };
  const ouvintes = [['resize', medir], ['orientationchange', medir], ['fullscreenchange', medir], ['webkitfullscreenchange', medir]];
  ouvintes.forEach(([n, f]) => window.addEventListener(n, f));
  document.addEventListener('fullscreenchange', medir);
  document.addEventListener('keydown', aoTecla);
  window.visualViewport?.addEventListener('resize', medir);
  // Depois de girar o celular o navegador demora um pouco para informar o tamanho certo.
  const girou = () => { setTimeout(medir, 150); setTimeout(medir, 500); };
  window.addEventListener('orientationchange', girou);
  // O palco pode ser montado antes de entrar na página: o observador do pai nasce no primeiro quadro.
  let observador = null;
  let encerrado = false;
  aoSair(() => {
    encerrado = true;
    ouvintes.forEach(([n, f]) => window.removeEventListener(n, f));
    window.removeEventListener('orientationchange', girou);
    window.visualViewport?.removeEventListener('resize', medir);
    document.removeEventListener('fullscreenchange', medir);
    document.removeEventListener('keydown', aoTecla);
    observador?.disconnect();
    document.body.classList.remove('tem-palco-foco');
    destravar();
    if (emTelaCheia()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* tudo bem */ } }
  });
  // A tela pode demorar para pôr o palco na página (carrega o jogo antes): espera ele aparecer para medir.
  const comecar = n => {
    if (encerrado) return;
    if (!palco.isConnected) { if (n < 200) setTimeout(() => comecar(n + 1), 25); return; }
    if (typeof ResizeObserver === 'function' && palco.parentElement) { observador = new ResizeObserver(medir); observador.observe(palco.parentElement); }
    medir();
  };
  setTimeout(() => comecar(0), 0);
  return { medir, botao, entrar, sair, alternar, ativo };
}
