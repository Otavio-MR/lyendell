// Festa na Toca na tela: a sala de espera, o tabuleiro do Jardim da Toca (com os coelhos andando, o dado, a
// cenoura dourada e as decisões de cada vez), os minijogos e o pódio. As regras ficam no servidor (src/festa.js);
// os minijogos em public/js/festa-minijogos.js. A tela é criada uma vez por sala e só atualiza o que muda.

import { h, trocar, icone, botao, cabecalho, avatar, confirmar } from '../core.js';
import { enviar, entrarNaPartida, rt, ouvir } from '../tempo-real.js';
import { desenharCoelho, elipse, sombrear } from '../desenho-coelho.js';
import { CORES_JUNTO, sorteJunto } from '../junto.js';
import { som } from '../arcade.js';
import { registrarPecas, desenharSprite, aoMudarSprites } from '../sprites.js';
import { admDirecao, admPodeAgir, admVelocidade } from '../adm-jogos.js';

const L = 1200;
const A = 800;
const COR_CASA = { azul: '#4f8fd8', vermelha: '#d8584a', sorte: '#7fb069', raposo: '#8a4fb0', loja: '#e0a43a', inicio: '#e8c24a' };
const ICONE_CASA = { sorte: '?', raposo: '🦊', loja: '🛒', inicio: '★' };
const TECLAS = {
  ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowUp: 'cima', KeyW: 'cima', ArrowDown: 'baixo', KeyS: 'baixo',
  Space: 'pular', KeyZ: 'pular', KeyK: 'pular', KeyX: 'acao', KeyJ: 'acao', Enter: 'acao',
};
const cor = k => CORES_JUNTO[k % CORES_JUNTO.length];

/* ─── Desenhos do tabuleiro (em qualquer canvas: o jogo e a prévia da tela de sprites) ─── */

// Uma casa do caminho, com o ícone do tipo.
function pintarCasa(g, x, y, tipo) {
  const corCasa = COR_CASA[tipo] || COR_CASA.azul;
  elipse(g, x, y + 4, 24, 10, 'rgba(0,0,0,0.25)');
  elipse(g, x, y, 24, 17, sombrear(corCasa, -0.25));
  elipse(g, x, y - 3, 22, 15, corCasa);
  elipse(g, x - 6, y - 8, 8, 4, 'rgba(255,255,255,0.3)');
  const ic = ICONE_CASA[tipo];
  if (ic) {
    g.font = '700 18px "Cinzel", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(ic, x, y - 3);
  }
}

// A cenoura dourada, com o meio em (0, 0) e já inclinada.
function pintarDourada(g) {
  g.save();
  g.rotate(0.5);
  g.fillStyle = '#e8c24a';
  g.beginPath(); g.moveTo(-8, -16); g.lineTo(8, -16); g.lineTo(0, 22); g.closePath(); g.fill();
  g.fillStyle = '#5aa04a';
  for (const r of [-0.4, 0, 0.4]) { g.save(); g.translate(0, -16); g.rotate(r); elipse(g, 0, -8, 3.5, 9, '#5aa04a'); g.restore(); }
  g.restore();
}

// O cubo do dado (sem o número), com o meio em (0, 0).
function pintarDado(g) {
  g.fillStyle = '#fbf6ee';
  g.strokeStyle = '#8a6a44';
  g.lineWidth = 3;
  g.beginPath();
  if (g.roundRect) g.roundRect(-22, -22, 44, 44, 9); else g.rect(-22, -22, 44, 44);
  g.fill(); g.stroke();
}

// Uma árvore da borda (sem a sombra), com o tronco começando em (x, y).
function pintarArvore(f, x, y) {
  f.fillStyle = '#6b4a2b'; f.fillRect(x - 4, y, 8, 18);
  elipse(f, x, y - 8, 26, 24, '#3a7a3c');
  elipse(f, x - 8, y - 14, 12, 10, 'rgba(255,255,255,0.12)');
}

// Um canteiro da horta (x, y = canto de cima do canteiro).
function pintarCanteiro(f, x, y) {
  f.fillStyle = '#7a5434';
  f.fillRect(x, y, 30, 12);
  elipse(f, x + 15, y + 3, 4, 3, '#e07a2a');
  elipse(f, x + 15, y - 3, 3, 5, '#5aa04a');
}

// O fundo do tabuleiro (desenhado uma vez num canvas guardado): jardim, lago, horta, toca, caminhos e árvores.
function pintarFundoFesta(f, tab) {
  const gr = f.createRadialGradient(L / 2, A / 2, 100, L / 2, A / 2, 760);
  gr.addColorStop(0, '#8fc46a');
  gr.addColorStop(1, '#4f8a3c');
  f.fillStyle = gr;
  f.fillRect(0, 0, L, A);
  // Lago, horta e flores
  elipse(f, 600, 300, 150, 70, '#3d7ea6');
  elipse(f, 600, 296, 136, 60, '#5aa0c8');
  for (const [x, y] of [[540, 290], [650, 310], [610, 280]]) { elipse(f, x, y, 12, 7, '#4f8f45'); elipse(f, x + 3, y - 2, 3, 3, '#f0c0d8'); }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
    const x = 470 + c * 38;
    const y = 500 + r * 26;
    if (!desenharSprite(f, 'festa.canteiro', 'parado', x + 15, y + 2, { quadro: r * 7 + c })) pintarCanteiro(f, x, y);
  }
  // A toca no meio
  elipse(f, 600, 420, 90, 40, 'rgba(0,0,0,0.2)');
  f.fillStyle = '#6fa055';
  f.beginPath(); f.ellipse(600, 410, 84, 60, 0, Math.PI, 0); f.fill();
  elipse(f, 600, 410, 26, 22, '#3a2414');
  f.font = '700 18px "Cinzel", Georgia, serif';
  f.textAlign = 'center';
  f.fillStyle = '#1b1403';
  f.fillText('Toca', 600, 372);
  let semente = 7;
  const rnd = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 70; k++) elipse(f, rnd() * L, rnd() * A, 2.5, 2.5, ['#f0a0c0', '#f4dd80', '#ffffff', '#b0a0f0'][k % 4]);
  // Caminhos entre as casas
  f.lineCap = 'round';
  for (const c of tab) for (const p of c.prox) {
    const d = tab[p];
    f.strokeStyle = '#c9b07a';
    f.lineWidth = 16;
    f.beginPath(); f.moveTo(c.x, c.y); f.lineTo(d.x, d.y); f.stroke();
  }
  for (const c of tab) for (const p of c.prox) {
    const d = tab[p];
    f.strokeStyle = '#dcc79a';
    f.lineWidth = 8;
    f.beginPath(); f.moveTo(c.x, c.y); f.lineTo(d.x, d.y); f.stroke();
  }
  // Árvores nas bordas
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    const x = 600 + Math.cos(a) * 580;
    const y = 400 + Math.sin(a) * 380;
    elipse(f, x, y + 18, 26, 8, 'rgba(0,0,0,0.2)');
    if (!desenharSprite(f, 'festa.arvore', 'parada', x, y + 18, { quadro: k })) pintarArvore(f, x, y);
  }
}

// Uma casa no tabuleiro (sprite enviado ou o desenho de sempre) e, se for a dela, a cenoura dourada brilhando.
function desenharCasaFesta(g, c, t, dourada) {
  if (!desenharSprite(g, `festa.casa-${c.tipo}`, 'parada', c.x, c.y, { t })) pintarCasa(g, c.x, c.y, c.tipo);
  // A cenoura dourada brilha na casa dela
  if (c.id === dourada) {
    const pulso = 1 + Math.sin(t * 4) * 0.08;
    const brilho = g.createRadialGradient(c.x, c.y - 40, 0, c.x, c.y - 40, 60);
    brilho.addColorStop(0, 'rgba(255,230,120,0.75)');
    brilho.addColorStop(1, 'rgba(255,230,120,0)');
    g.fillStyle = brilho;
    g.beginPath(); g.arc(c.x, c.y - 40, 60, 0, Math.PI * 2); g.fill();
    const yy = c.y - 40 + Math.sin(t * 2) * 4;
    if (!desenharSprite(g, 'festa.cenoura-dourada', 'brilhando', c.x, yy, { t, escala: pulso })) {
      g.save();
      g.translate(c.x, yy);
      g.scale(pulso, pulso);
      pintarDourada(g);
      g.restore();
    }
  }
}

// Um dado já no lugar (g transladado e girado): o cubo e o número por cima.
function desenharDadoFesta(g, v, t, girando) {
  if (!desenharSprite(g, 'festa.dado', girando ? 'girando' : 'parado', 0, 0, { t })) pintarDado(g);
  g.font = '700 24px "Cinzel", Georgia, serif';
  g.fillStyle = '#1b1403';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(v), 0, 1);
}

/* ─── Sprites (veja ../sprites.js) ─── */

const NOME_CASA = { azul: 'Casa azul', vermelha: 'Casa vermelha', sorte: 'Casa da sorte (?)', raposo: 'Casa do Raposo', loja: 'Casa da lojinha', inicio: 'Casa do começo' };
const DESC_CASA = {
  azul: 'Dá 3 cenouras para quem para nela.',
  vermelha: 'Tira 3 cenouras de quem para nela.',
  sorte: 'Sorteia uma surpresa. Inclua o ponto de interrogação no desenho.',
  raposo: 'O Raposo apronta. Inclua o símbolo da raposa no desenho.',
  loja: 'A lojinha dos dados especiais. Inclua o símbolo da loja no desenho.',
  inicio: 'Onde todos começam. Inclua a estrela no desenho.',
};
export const SPRITES = [
  ...Object.keys(COR_CASA).map(tipo => ({
    chave: `festa.casa-${tipo}`, jogo: 'Festa na Toca', nome: NOME_CASA[tipo],
    desc: `${DESC_CASA[tipo]} Vista de cima, um pouco inclinada, como as outras casas do Jardim da Toca (o coelho fica em pé no meio).`,
    largura: 52, altura: 40, ancora: 'centro',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 4 }],
    previa: g => pintarCasa(g, 0, 0, tipo),
  })),
  {
    chave: 'festa.cenoura-dourada', jogo: 'Festa na Toca', nome: 'Cenoura dourada',
    desc: 'A cenoura dourada que flutua em cima da casa dela. O jogo faz ela subir, descer e pulsar, com o brilho por trás.',
    largura: 44, altura: 56, ancora: 'centro',
    animacoes: [{ id: 'brilhando', nome: 'Brilhando', quadros: 1, fps: 6 }],
    previa: g => pintarDourada(g),
  },
  {
    chave: 'festa.dado', jogo: 'Festa na Toca', nome: 'Dado',
    desc: 'O dado que aparece em cima de quem jogou. Só o cubo, sem número: o jogo escreve o número por cima. Girando, o jogo ainda balança o desenho.',
    largura: 48, altura: 48, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 4 }, { id: 'girando', nome: 'Girando', quadros: 4, fps: 12 }],
    previa: g => pintarDado(g),
  },
  {
    chave: 'festa.arvore', jogo: 'Festa na Toca', nome: 'Árvore da borda',
    desc: 'As 26 árvores em volta do jardim, com o pé do tronco na base do quadro (a sombra o jogo faz). Com vários quadros, cada árvore usa um (para variar).',
    largura: 54, altura: 52, ancora: 'pe',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: g => pintarArvore(g, 0, -18),
  },
  {
    chave: 'festa.canteiro', jogo: 'Festa na Toca', nome: 'Canteiro da horta',
    desc: 'Cada canteiro da horta perto da toca (são 21). Com vários quadros, cada canteiro usa um (para variar).',
    largura: 32, altura: 22, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarCanteiro(g, -15, -2),
  },
];
registrarPecas(SPRITES);

// Sprite trocado: o fundo já desenhado do tabuleiro é refeito na próxima vez.
let versaoSprites = 0;
aoMudarSprites(() => { versaoSprites++; });

// Só para os testes no Node (os desenhos sem a tela).
export const _festaDeTeste = { pintarFundoFesta, desenharCasaFesta, desenharDadoFesta };

export function criarTelaFesta(id, { sair, sairJa }) {
  const el = h('div', { class: 'festa' });
  const topo = h('div');
  const corpo = h('div');
  el.append(topo, corpo);

  // O tabuleiro (um canvas que fica sempre o mesmo) e o painel do lado.
  const tela = h('canvas', { class: 'festa-tabuleiro', 'aria-label': 'O tabuleiro do Jardim da Toca' });
  const g = tela.getContext('2d');
  const lado = h('aside', { class: 'festa-lado' });
  const acoes = h('section', { class: 'painel festa-acoes' });
  const placar = h('section', { class: 'painel festa-placar' });
  const historico = h('section', { class: 'painel festa-historico' });
  lado.append(acoes, placar, historico);
  const telaTabuleiro = h('div', { class: 'festa-grade' }, h('div', { class: 'festa-palco' }, tela), lado);

  let s = null;
  let e = null;
  let quadro = 0;
  const inicio = performance.now();
  const mostrados = new Map(); // k -> { x, y, de, para, desde } (o coelho pulando de casa em casa)
  let dadoGirando = null;      // { ate, valores } animação do dado
  let ultimoDado = null;
  let fundo = null;
  let minijogo = null;         // o minijogo rodando agora (veja rodarMinijogo)
  let modulo = null;

  /* ─── Desenho do tabuleiro ─── */

  let versaoFundo = -1;
  function prepararFundo() {
    if ((fundo && versaoFundo === versaoSprites) || !e) return;
    versaoFundo = versaoSprites;
    fundo = document.createElement('canvas');
    fundo.width = L;
    fundo.height = A;
    pintarFundoFesta(fundo.getContext('2d'), e.tab);
  }

  function desenharCasa(c, t) {
    desenharCasaFesta(g, c, t, e.dourada);
  }

  // Onde cada coelho aparece (vários na mesma casa ficam lado a lado) e o pulinho entre as casas.
  function posicaoDe(k, agora) {
    const p = e.j[k];
    const c = e.tab[p.pos];
    const juntos = e.j.map((q, x) => (q.pos === p.pos ? x : -1)).filter(x => x >= 0);
    const lugar = juntos.indexOf(k);
    const n = juntos.length;
    const porFila = n <= 4 ? n : Math.ceil(n / 2);
    const fila = Math.floor(lugar / porFila);
    const naFila = fila ? n - porFila : porFila;
    const passo = n <= 4 ? 26 : 24;
    const alvo = { x: c.x + ((lugar % porFila) - (naFila - 1) / 2) * passo + (fila ? passo / 2 : 0), y: c.y - 6 + (n > 4 ? (fila ? 10 : -10) : 0) };
    let m = mostrados.get(k);
    if (!m) { m = { x: alvo.x, y: alvo.y, de: alvo, para: alvo, desde: 0 }; mostrados.set(k, m); }
    if (Math.abs(m.para.x - alvo.x) > 0.5 || Math.abs(m.para.y - alvo.y) > 0.5) {
      m.de = { x: m.x, y: m.y };
      m.para = alvo;
      m.desde = agora;
      if (k === e.vez && e.passo === 'andar') som('passo');
    }
    const f = Math.min(1, (agora - m.desde) / 280);
    m.x = m.de.x + (m.para.x - m.de.x) * f;
    m.y = m.de.y + (m.para.y - m.de.y) * f - Math.sin(f * Math.PI) * 26;
    return { x: m.x, y: m.y, pulando: f < 1 };
  }

  function desenharTabuleiro(agoraMs) {
    const t = (agoraMs - inicio) / 1000;
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    g.setTransform(w / L, 0, 0, hh / A, 0, 0);
    prepararFundo();
    if (fundo) g.drawImage(fundo, 0, 0, L, A);
    for (const c of e.tab) desenharCasa(c, t);
    // As escolhas de caminho brilham para quem está na vez.
    if (e.passo === 'pausa' && e.pausa?.tipo === 'caminho') {
      for (const id of e.pausa.opcoes) {
        const c = e.tab[id];
        g.strokeStyle = `rgba(255,240,150,${0.6 + Math.sin(t * 6) * 0.3})`;
        g.lineWidth = 4;
        g.beginPath(); g.ellipse(c.x, c.y - 3, 30, 22, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    const pos = new Map(e.j.map((_, k) => [k, posicaoDe(k, agoraMs)]));
    const ordem = e.j.map((_, k) => k).sort((a, b) => (pos.get(a).y - pos.get(b).y) || a - b);
    // Casa cheia: o nome só aparece para quem está na vez e para mim (os outros ficam com uma bolinha da cor).
    const lotada = k => e.j.filter(q => q.pos === e.j[k].pos).length > 4;
    for (const k of ordem) {
      const p = e.j[k];
      const { x, y, pulando } = pos.get(k);
      if (k === e.vez && e.fase === 'turno') {
        elipse(g, x, y + 8, 26 + Math.sin(t * 5) * 3, 9, 'rgba(255,240,150,0.55)');
      }
      g.save();
      g.translate(x, y + 6);
      g.scale(lotada(k) ? 0.85 : 1.1, lotada(k) ? 0.85 : 1.1);
      desenharCoelho(g, 0, 0, { pelo: p.visual?.pelo || ['#e9dcc3', '#9aa3ad', '#c99a6b', '#f7f3ea'][k % 4], roupa: p.visual?.roupa || null, andando: pulando, passo: t, t: t + k, dir: 1 });
      g.restore();
    }
    // Os nomes vêm depois de todos os coelhos (para nenhum coelho tapar o nome de quem está na frente).
    for (const k of [...ordem.filter(k => k !== e.vez && k !== s.eu), ...[s.eu, e.vez].filter(k => k != null && k >= 0 && e.j[k])]) {
      const p = e.j[k];
      const { x, y } = pos.get(k);
      if (lotada(k) && k !== e.vez && k !== s.eu) {
        elipse(g, x, y + 14, 4.5, 4.5, cor(k));
        continue;
      }
      g.font = '700 13px "EB Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const wNome = g.measureText(p.nome).width + 12;
      g.fillStyle = cor(k);
      g.beginPath();
      if (g.roundRect) g.roundRect(x - wNome / 2, y + 12, wNome, 17, 8); else g.rect(x - wNome / 2, y + 12, wNome, 17);
      g.fill();
      g.fillStyle = '#1b1403';
      g.fillText(p.nome, x, y + 21);
    }
    // O dado em cima de quem jogou
    if (e.dado && e.fase === 'turno' && (e.passo === 'dado' || e.passo === 'andar' || e.passo === 'pausa')) {
      const k = e.vez;
      const m = mostrados.get(k);
      if (m) {
        const girando = dadoGirando && agoraMs < dadoGirando.ate;
        const valores = girando ? e.dado.valores.map(() => 1 + Math.floor(Math.random() * 10)) : e.dado.valores;
        valores.forEach((v, x) => {
          const dx = m.x + (x - (valores.length - 1) / 2) * 52;
          const dy = m.y - 92 + (girando ? Math.sin(t * 20 + x) * 6 : 0);
          g.save();
          g.translate(dx, dy);
          if (girando) g.rotate(Math.sin(t * 18 + x) * 0.3);
          desenharDadoFesta(g, v, t, girando);
          g.restore();
        });
        if (e.andar?.restam > 0 && !girando) {
          g.font = '700 20px "Cinzel", Georgia, serif';
          g.fillStyle = '#fff';
          g.fillText(`faltam ${e.andar.restam}`, m.x, m.y - 128);
        }
      }
    }
    // Faixa grande: últimas rodadas, estrela bônus
    if (e.fase === 'anuncio' || e.fase === 'bonus') {
      g.fillStyle = 'rgba(14,24,17,0.8)';
      g.fillRect(0, A / 2 - 70, L, 140);
      g.font = '700 36px "Cinzel", Georgia, serif';
      g.fillStyle = '#e8c24a';
      g.textAlign = 'center';
      g.fillText(e.fase === 'anuncio' ? 'Últimas 3 rodadas!' : 'Estrelas bônus!', L / 2, A / 2 - 18);
      g.font = '22px "EB Garamond", Georgia, serif';
      g.fillStyle = '#fbf3e0';
      g.fillText(e.msg?.texto || '', L / 2, A / 2 + 28);
    }
  }

  function laco(agoraMs) {
    quadro = requestAnimationFrame(laco);
    if (!e || !tela.isConnected) return;
    try { desenharTabuleiro(agoraMs); } catch (x) { console.error('Festa:', x); }
  }
  quadro = requestAnimationFrame(laco);

  /* ─── Painel: as decisões, o placar e o que aconteceu ─── */

  const agir = acao => enviar('festa:acao', { id, acao });
  const minhaVez = () => s.eu >= 0 && e.fase === 'turno' && e.vez === s.eu;

  function desenharAcoes() {
    const eu = s.eu >= 0 ? e.j[s.eu] : null;
    let conteudo;
    if (e.fase === 'ordem') {
      conteudo = [h('h2', null, icone('aleatorio'), 'Quem começa?'),
        h('p', null, 'Cada um joga o dado: quem tirar mais começa.'),
        h('ul', { class: 'festa-ordem' }, e.j.map((p, k) => h('li', null, h('span', { class: 'cobras-cor', style: { background: cor(k) } }), p.nome, h('strong', null, p.ordemDado ?? '...')))),
        eu && eu.ordemDado == null && botao('Jogar o dado', { classe: 'btn-ouro btn-grande', icone: 'aleatorio', onclick: () => agir({ tipo: 'rolar' }) })];
    } else if (e.fase === 'turno') {
      const p = e.j[e.vez];
      if (!minhaVez()) {
        conteudo = [h('h2', null, h('span', { class: 'cobras-cor', style: { background: cor(e.vez) } }), `Vez de ${p.nome}`),
          h('p', { class: 'suave' }, e.passo === 'pausa' ? 'Decidindo...' : e.passo === 'andar' ? 'Andando pelo jardim...' : 'Jogando o dado...')];
      } else if (e.passo === 'decidir') {
        conteudo = [h('h2', null, icone('estrela'), 'Sua vez!'),
          botao('Jogar o dado', { classe: 'btn-ouro btn-grande', icone: 'aleatorio', onclick: () => agir({ tipo: 'rolar' }) }),
          eu.itens.length > 0 && h('div', { class: 'festa-itens' }, h('p', { class: 'suave' }, 'Ou use um item antes:'),
            eu.itens.map(it => botao(e.itensLoja[it].nome, { classe: 'btn-pequeno', onclick: () => agir({ tipo: 'item', item: it }), titulo: e.itensLoja[it].desc })))];
      } else if (e.passo === 'pausa' && e.pausa?.tipo === 'caminho') {
        conteudo = [h('h2', null, icone('mapa'), 'Para onde?'), h('p', null, 'O caminho se divide (as casas que brilham).'),
          h('div', { class: 'festa-botoes' }, e.pausa.opcoes.map((id, k) => botao(k === 0 ? 'Seguir em frente' : 'Pegar o atalho', { classe: k === 0 ? 'btn-ouro' : '', onclick: () => agir({ tipo: 'caminho', k }) })))];
      } else if (e.passo === 'pausa' && e.pausa?.tipo === 'compra') {
        conteudo = [h('h2', null, '🥕 Cenoura dourada!'), h('p', null, `Comprar por ${e.precoDourada} cenouras? Você tem ${eu.cenouras}.`),
          h('div', { class: 'festa-botoes' }, botao('Comprar!', { classe: 'btn-ouro', onclick: () => agir({ tipo: 'comprar', sim: true }) }), botao('Agora não', { onclick: () => agir({ tipo: 'comprar', sim: false }) }))];
      } else if (e.passo === 'pausa' && e.pausa?.tipo === 'loja') {
        conteudo = [h('h2', null, icone('loja'), 'Lojinha do jardim'), h('p', { class: 'suave' }, `Você tem ${eu.cenouras} cenouras e ${eu.itens.length} de 3 itens.`),
          h('div', { class: 'festa-botoes coluna' }, Object.entries(e.itensLoja).map(([k, it]) => botao(`${it.nome} (${it.preco})`, {
            classe: 'btn-pequeno', desativado: eu.cenouras < it.preco, titulo: it.desc, onclick: () => agir({ tipo: 'loja', item: k }),
          })), botao('Não quero nada', { classe: 'btn-pequeno', onclick: () => agir({ tipo: 'loja', item: null }) }))];
      } else {
        conteudo = [h('h2', null, icone('estrela'), 'Sua vez!'), h('p', { class: 'suave' }, e.passo === 'andar' ? 'Andando...' : '')];
      }
    } else if (e.fase === 'fim') {
      conteudo = podio();
    } else {
      conteudo = [h('h2', null, icone('estrela'), e.fase === 'bonus' ? 'Estrelas bônus' : 'Atenção!'), e.msg && h('p', null, e.msg.texto)];
    }
    trocar(acoes, h('p', { class: 'festa-rodada' }, `Rodada ${Math.min(e.rodada, e.rodadas)} de ${e.rodadas}`, e.ultimas && h('span', { class: 'jogo-novo' }, 'em dobro')),
      e.msg && e.fase === 'turno' && h('p', { class: `festa-msg m-${e.msg.tipo}` }, e.msg.texto), conteudo);
  }

  function desenharPlacar() {
    const ordem = e.j.map((p, k) => ({ p, k })).sort((a, b) => b.p.douradas - a.p.douradas || b.p.cenouras - a.p.cenouras);
    trocar(placar, h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Placar')),
      h('ol', { class: 'festa-lista' }, ordem.map(({ p, k }) => h('li', { class: `${k === s.eu ? 'eu-linha' : ''} ${k === e.vez && e.fase === 'turno' ? 'na-vez' : ''}`.trim() },
        h('span', { class: 'cobras-cor', style: { background: cor(k) } }),
        h('span', { class: 'festa-nome' }, p.nome, p.itens.length > 0 && h('small', null, p.itens.map(i => e.itensLoja[i].nome).join(', '))),
        h('span', { class: 'festa-douradas', title: 'Cenouras douradas' }, `⭐ ${p.douradas}`),
        h('span', { class: 'festa-cenouras', title: 'Cenouras' }, `🥕 ${p.cenouras}`)))));
    trocar(historico, h('div', { class: 'painel-cab' }, h('h2', null, icone('pergaminho'), 'O que aconteceu')),
      h('ol', { class: 'festa-hist' }, [...e.historico].reverse().map(t => h('li', null, t))));
  }

  function podio() {
    const r = e.ranking || [];
    return [h('h2', null, icone('trofeu'), 'Fim da festa!'),
      h('ol', { class: 'festa-podio' }, r.map(x => h('li', { class: `p${x.pos}` },
        h('strong', null, `${x.pos}º`), h('span', { class: 'cobras-cor', style: { background: cor(x.k) } }), e.j[x.k].nome,
        h('small', null, `⭐ ${x.d} · 🥕 ${x.c}`)))),
      s.eu >= 0 && h('p', { class: 'suave' }, 'Um quinto das suas cenouras foi para o Club Coelho (até 40).'),
      h('div', { class: 'festa-botoes' },
        s.eu >= 0 && s.dono === s.jogadores[s.eu]?.id && botao('Outra festa', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => enviar('sala:revanche', { id }) }),
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão'))];
  }

  /* ─── Minijogos ─── */

  function telaDoMinijogo() {
    const m = e.minijogo;
    if (m.passo === 'apresenta') {
      const def = modulo?.MINIJOGOS?.[m.id];
      const times = m.formato === 'times'
        ? h('div', { class: 'festa-times' }, ['azul', 'vermelho'].map(t => h('div', { class: `festa-time t-${t}` },
          h('strong', null, t === 'azul' ? 'Time Azul' : 'Time Vermelho'),
          e.j.map((p, k) => (m.times[k] === t ? h('span', null, p.nome) : null)))))
        : h('p', { class: 'festa-formato' }, 'Todos contra todos!');
      return h('div', { class: 'painel festa-minijogo-cartao' },
        h('p', { class: 'festa-rodada' }, 'Hora do minijogo!'),
        h('h2', null, def?.emoji || '🎉', ' ', m.nome),
        times,
        def && h('p', null, def.regras),
        def && h('p', { class: 'suave' }, matchMedia('(pointer: coarse)').matches ? def.controles?.toque : def.controles?.teclado),
        h('p', { class: 'suave' }, 'Quem vencer ganha 10 cenouras.'),
        s.eu >= 0 && !m.prontos[s.eu] ? botao('Pronto!', { classe: 'btn-ouro btn-grande', icone: 'check', onclick: () => agir({ tipo: 'pronto' }) })
          : h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando os outros...'));
    }
    if (m.passo === 'resultado') {
      const tipo = m.tipo;
      return h('div', { class: 'painel festa-minijogo-cartao' },
        h('h2', null, icone('trofeu'), m.nome),
        h('p', { class: 'partida-status vitoria' }, m.pulado ? 'O administrador pulou este minijogo.' : m.vencedores?.length ? `${m.vencedores.map(k => e.j[k].nome).join(' e ')} ${m.vencedores.length > 1 ? 'venceram' : 'venceu'}! +10 cenouras` : 'Ninguém venceu.'),
        h('ol', { class: 'festa-lista' }, e.j.map((p, k) => {
          const r = m.placar?.[k];
          const texto = !r ? '' : tipo === 'pontos' ? `${r.pontos} pts` : tipo === 'corrida' ? (r.vivo ? `chegou em ${r.tempo.toFixed(1)} s` : `${Math.round(r.pontos)}%`) : r.vivo ? 'sobreviveu!' : `caiu aos ${Math.floor(r.tempo)} s`;
          return h('li', { class: m.vencedores?.includes(k) ? 'eu-linha' : '' }, h('span', { class: 'cobras-cor', style: { background: cor(k) } }), h('span', { class: 'festa-nome' }, p.nome), h('strong', null, texto));
        })));
    }
    return minijogo?.el || h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' }));
  }

  // Roda o minijogo no navegador: canvas, teclado e toque, o relógio de todos e a ligação com o servidor.
  function rodarMinijogo(m) {
    const def = modulo.MINIJOGOS[m.id];
    const canvas = h('canvas', { class: 'festa-mini-tela', tabindex: '0', style: { aspectRatio: '640 / 400' } });
    const cg = canvas.getContext('2d');
    let inicioLocal = Date.now() + (m.inicioEm ?? 3000);
    const entrada = { esq: false, dir: false, cima: false, baixo: false, pular: false, acao: false, apertou: new Set() };
    let pendentes = new Set();
    const presos = new Set();
    const juntar = () => { for (const k of ['esq', 'dir', 'cima', 'baixo', 'pular', 'acao']) entrada[k] = presos.has(k); };
    let ultimaPos = 0;
    let reportei = false;
    let cpusReportados = false;
    const eu = s.eu;
    const ctx = {
      semente: m.semente, sorte: sorteJunto(m.semente), eu, formato: m.formato, largura: 640, altura: 400,
      jogadores: e.j.map((p, k) => ({ nome: p.nome, cor: cor(k), visual: p.visual, cpu: p.cpu, time: m.times[k] })),
      tempo: () => (Date.now() - inicioLocal) / 1000,
      pos: d => { const agora = Date.now(); if (agora - ultimaPos > 70) { ultimaPos = agora; enviar('junto:pos', { id, d }, { silencioso: true }); } },
      evento: ev => enviar('junto:evento', { id, ev }, { silencioso: true }),
      pegar: chave => enviar('junto:evento', { id, ev: { tipo: 'pegar', chave: String(chave) } }, { silencioso: true }),
      reportar: r => { if (reportei || eu < 0) return; reportei = true; enviar('junto:evento', { id, ev: { tipo: 'resultado', k: eu, r } }, { silencioso: true }); },
      som,
      // Pegadinhas do administrador (controles invertidos, congelado, lento): o minijogo aplica na entrada.
      adm: { direcao: admDirecao, podeAgir: admPodeAgir, velocidade: admVelocidade },
    };
    const inst = def.criar(ctx);
    const tirar = [
      ouvir('junto:pos', x => { if (x.id === id && x.i !== eu) inst.aoPos?.(x.i, x.d); }),
      ouvir('junto:evento', x => {
        if (x.id !== id || !x.ev) return;
        if (x.ev.tipo === 'pegou') inst.aoPegou?.(x.ev.i, x.ev.chave);
        else inst.aoEvento?.(x.ev.i, x.ev);
      }),
    ];
    const aoApertar = ev => {
      const k = TECLAS[ev.code];
      if (!k || ev.target.closest?.('input, textarea, select')) return;
      ev.preventDefault();
      if (!ev.repeat) pendentes.add(k);
      presos.add(k);
      juntar();
    };
    const aoSoltar = ev => { const k = TECLAS[ev.code]; if (k) { presos.delete(k); juntar(); } };
    document.addEventListener('keydown', aoApertar);
    document.addEventListener('keyup', aoSoltar);
    // Botões de toque
    const b = def.botoes || {};
    const botaoToque = (k, rotulo) => {
      const bt = h('button', { type: 'button', class: 'arcade-botao', 'aria-label': rotulo }, rotulo);
      bt.addEventListener('pointerdown', ev => { ev.preventDefault(); pendentes.add(k); presos.add(k); juntar(); bt.classList.add('apertado'); });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) bt.addEventListener(t, () => { presos.delete(k); juntar(); bt.classList.remove('apertado'); });
      return bt;
    };
    const controles = h('div', { class: 'arcade-controles festa-controles' },
      h('div', { class: 'festa-cruz' }, b.esq && botaoToque('esq', '◀'), b.cima && botaoToque('cima', '▲'), b.baixo && botaoToque('baixo', '▼'), b.dir && botaoToque('dir', '▶')),
      h('div', { class: 'arcade-acoes' }, b.acao && botaoToque('acao', b.acao), b.pular && botaoToque('pular', b.pular)));
    // Clique ou toque no canvas: mira e atira (no Tiro ao Alvo)
    canvas.addEventListener('pointerdown', ev => {
      const r = canvas.getBoundingClientRect();
      inst.apontar?.(((ev.clientX - r.left) / r.width) * 640, ((ev.clientY - r.top) / r.height) * 400, true);
    });
    let anterior = 0;
    let acumulado = 0;
    let raf = 0;
    const passo = agoraMs => {
      raf = requestAnimationFrame(passo);
      const dt = anterior ? Math.min(0.1, (agoraMs - anterior) / 1000) : 0;
      anterior = agoraMs;
      try {
        acumulado += dt;
        let n = 0;
        while (acumulado >= 1 / 60 && n < 6) {
          entrada.apertou = pendentes;
          pendentes = new Set();
          inst.atualizar(1 / 60, entrada);
          acumulado -= 1 / 60;
          n++;
        }
        if (n === 6) acumulado = 0;
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(r.width * dpr));
        const hh = Math.max(1, Math.round(r.height * dpr));
        if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
        cg.setTransform(w / 640, 0, 0, hh / 400, 0, 0);
        inst.desenhar(cg, (agoraMs - inicio) / 1000);
        // Quem é o primeiro de verdade manda também o resultado dos coelhos da casa.
        if (!cpusReportados && inst.acabou?.() && eu >= 0 && eu === e.j.findIndex(p => !p.cpu && !p.saiu)) {
          cpusReportados = true;
          e.j.forEach((p, k) => { if (p.cpu) enviar('junto:evento', { id, ev: { tipo: 'resultado', k, r: inst.resultadoCpu(k) } }, { silencioso: true }); });
        }
      } catch (x) {
        console.error('Minijogo:', x);
      }
    };
    raf = requestAnimationFrame(passo);
    setTimeout(() => canvas.focus({ preventScroll: true }), 50);
    return {
      el: h('div', { class: 'festa-mini' }, h('div', { class: 'festa-mini-moldura' }, canvas), controles),
      acertarRelogio: inicioEm => { if (inicioEm != null) inicioLocal = Math.min(inicioLocal, Date.now() + inicioEm); },
      parar() {
        cancelAnimationFrame(raf);
        tirar.forEach(f => f());
        document.removeEventListener('keydown', aoApertar);
        document.removeEventListener('keyup', aoSoltar);
      },
    };
  }

  /* ─── Sala de espera ─── */

  function espera() {
    const jogador = s.eu >= 0;
    const souDono = jogador && s.dono === s.jogadores[s.eu].id;
    const o = s.opcoes || {};
    const mudar = novas => enviar('sala:opcoes', { id, opcoes: { ...o, ...novas } });
    const n = s.jogadores.length;
    const basta = o.cpus ? n >= 1 : n >= 2;
    return h('div', { class: 'cid-espera' },
      h('section', { class: 'painel' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na festa: ${n} de 10`)),
        h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
          avatar(p.nome, '', p.foto), h('span', null, p.nome),
          p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
        o.cpus && n < 4 && h('p', { class: 'suave' }, `${4 - n} ${4 - n === 1 ? 'lugar vai' : 'lugares vão'} para os coelhos da casa (o computador).`),
        h('div', { class: 'quiz-espera-acao' },
          souDono
            ? [botao(basta ? 'Começar a festa' : 'Esperando mais gente...', { classe: 'btn-ouro btn-grande', icone: 'estrela', desativado: !basta, onclick: () => enviar('sala:comecar', { id }) })]
            : jogador
              ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando quem abriu a sala começar...')
              : [n < 10 && !rt.minhaSala && botao('Entrar nesta festa', { classe: 'btn-ouro', onclick: () => entrarNaPartida(id) }), h('p', { class: 'suave' }, 'Você está assistindo.')])),
      h('section', { class: 'painel cid-opcoes' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('ajustes'), 'Opções'), !souDono && h('small', { class: 'suave' }, 'Só quem abriu a sala muda')),
        h('div', { class: 'cid-opcao' }, h('span', null, 'Rodadas'),
          h('div', { class: 'segmentado' }, [10, 15, 20].map(r => h('button', { type: 'button', class: `seg ${o.rodadas === r ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ rodadas: r }) }, `${r}`)))),
        h('label', { class: 'mapa-check cid-opcao' }, h('input', { type: 'checkbox', checked: o.cpus, disabled: !souDono, onchange: ev => mudar({ cpus: ev.target.checked }) }),
          h('span', null, 'Completar com coelhos da casa até 4'))),
      h('details', { class: 'painel cid-regras', open: true },
        h('summary', null, icone('pergunta'), 'Como jogar'),
        h('p', null, 'Na sua vez, jogue o dado (1 a 10) e ande pelo Jardim da Toca. Casa azul: +3 cenouras. Vermelha: -3. ', h('strong', null, '?'), ' sorteia uma surpresa, ', h('strong', null, '🦊'), ' é o Raposo aprontando, e ', h('strong', null, '🛒'), ' é a lojinha dos dados especiais.'),
        h('p', null, 'Ao passar pela ', h('strong', null, 'cenoura dourada'), ' (a que brilha), compre-a por 20 cenouras: ela muda de lugar. Depois que todos jogam, vem um minijogo; quem vence ganha 10 cenouras.'),
        h('p', null, 'No fim há três estrelas bônus. Vence quem tiver mais cenouras douradas (no empate, mais cenouras).')));
  }

  /* ─── Atualizar ─── */

  async function garantirModulo() {
    if (modulo) return;
    modulo = await import('../festa-minijogos.js');
    if (s) atualizar(s);
  }

  function atualizar(nova) {
    s = nova;
    const jogador = s.eu >= 0;
    const eu = jogador ? s.jogadores[s.eu] : null;
    const botoes = [];
    if (jogador && s.status === 'esperando') botoes.push(botao(s.dono === eu.id ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: sair }));
    else if (jogador && s.status === 'jogando' && !eu.saiu) {
      botoes.push(botao('Sair da festa', { icone: 'bandeira', classe: 'btn-perigo-texto', onclick: async () => { if (await confirmar('Um coelho da casa joga no seu lugar até o fim.', { titulo: 'Sair da festa?', ok: 'Sair', perigo: true })) sairJa(); } }));
    } else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
    trocar(topo, cabecalho({ titulo: 'Festa na Toca', icone: 'estrela', voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes, sub: 'Tabuleiro com minijogos: junte cenouras douradas pelo Jardim da Toca. De 1 a 10 pessoas.' }));
    e = s.estado;
    if (s.status === 'esperando' || !e) {
      minijogo?.parar();
      minijogo = null;
      fundo = null;
      mostrados.clear();
      trocar(corpo, espera());
      return;
    }
    // O dado acabou de sair: gira um pouquinho antes de mostrar.
    const chaveDado = e.dado ? `${e.rodada}:${e.vez}:${e.dado.valores.join(',')}` : null;
    if (chaveDado && chaveDado !== ultimoDado) { ultimoDado = chaveDado; dadoGirando = { ate: performance.now() + 800 }; som('pulo'); }
    if (e.fase === 'minijogo') {
      garantirModulo();
      const m = e.minijogo;
      if (m?.passo === 'jogando' && modulo) {
        if (!minijogo || minijogo.n !== m.n) {
          minijogo?.parar();
          minijogo = rodarMinijogo(m);
          minijogo.n = m.n;
        }
        minijogo.acertarRelogio(m.inicioEm);
      } else if (minijogo && m?.passo !== 'jogando') {
        minijogo.parar();
        minijogo = null;
        if (m?.passo === 'resultado') som('fase');
      }
      const jaMostrando = m?.passo === 'jogando' && minijogo && corpo.contains(minijogo.el);
      if (!jaMostrando) {
        trocar(corpo, h('div', { class: 'festa-grade' }, h('div', { class: 'festa-palco' }, telaDoMinijogo()), h('aside', { class: 'festa-lado' }, placar, historico)));
      }
      desenharPlacar();
      return;
    }
    if (minijogo) { minijogo.parar(); minijogo = null; }
    if (!corpo.contains(telaTabuleiro)) {
      lado.replaceChildren(acoes, placar, historico);
      trocar(corpo, telaTabuleiro);
    }
    desenharAcoes();
    desenharPlacar();
  }

  return {
    el, atualizar,
    parar() { cancelAnimationFrame(quadro); minijogo?.parar(); },
  };
}

