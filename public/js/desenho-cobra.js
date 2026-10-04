// O desenho da cobrinha: a de uma pessoa só (e de quem assiste) e a ao vivo. Cada peça pode virar sprite
// (veja sprites.js); sem sprite, o desenho de sempre. Não mexe na página: dá para importar nos testes do Node.

import { registrarPecas, desenharSprite, spriteDe, aoMudarSprites } from './sprites.js';

export const N_COBRA = 20;
export const LADO_COBRA = 600;
export const C_COBRA = LADO_COBRA / N_COBRA;

// Só o sprite daquela animação (sem trocar por outra animação da peça).
const temExato = (chave, anim) => !!spriteDe(`${chave}.${anim}`);
const anguloDe = ([dx, dy]) => Math.atan2(dy, dx);

// Cada troca de sprite muda a versão: quem guardou o fundo pronto desenha de novo.
let versao = 0;
aoMudarSprites(() => { versao++; });
export const versaoSprites = () => versao;

// As peças que podem virar sprite. Tamanhos na casa da cobrinha sozinha (30); ao vivo o jogo ajusta à casa.
export const SPRITES = [
  {
    chave: 'cobrinha.cabeca', jogo: 'Cobrinha', nome: 'Cabeça da cobra',
    desc: 'A cabeça, olhando para a DIREITA (o jogo gira para cima, para baixo e para a esquerda). Vale para a Cobrinha sozinha e para a ao vivo. Marque "pintar com a cor do jogador" para cada cobra ao vivo ter a sua cor.',
    largura: 30, altura: 30, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'andando', nome: 'Andando', quadros: 2, fps: 6 }, { id: 'bateu', nome: 'Bateu', quadros: 1, fps: 1 }],
    previa: (g, anim) => cabecaSozinha(g, -15, -15, 30, anim === 'bateu' ? '#d8674a' : '#d8b13a', [1, 0]),
  },
  {
    chave: 'cobrinha.corpo', jogo: 'Cobrinha', nome: 'Corpo da cobra',
    desc: 'Um gomo do corpo, deitado (a cabeça fica à DIREITA). O jogo põe um gomo em cada casa e gira na direção da cobra. Com "pintar com a cor do jogador", cada cobra fica da sua cor.',
    largura: 30, altura: 30, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'normal', nome: 'Normal', quadros: 1, fps: 1 }],
    previa: g => gomoSozinho(g, -15, -15, 30, 'rgb(127, 176, 105)'),
  },
  {
    chave: 'cobrinha.rabo', jogo: 'Cobrinha', nome: 'Ponta do rabo',
    desc: 'O último gomo, com a cabeça à DIREITA. Sem este sprite, a ponta usa o do corpo.',
    largura: 30, altura: 30, ancora: 'centro', tingir: true,
    animacoes: [{ id: 'normal', nome: 'Normal', quadros: 1, fps: 1 }],
    previa: g => gomoSozinho(g, -15, -15, 30, 'rgb(77, 116, 65)'),
  },
  {
    chave: 'cobrinha.cenoura', jogo: 'Cobrinha', nome: 'Cenoura',
    desc: 'A comida da cobra, no meio da casa.',
    largura: 30, altura: 30, ancora: 'centro',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 1 }],
    previa: g => desenharCenoura(g, -0.5, -0.5, 30, true),
  },
  {
    chave: 'cobrinha.chao', jogo: 'Cobrinha', nome: 'Casa do tabuleiro',
    desc: 'Uma casa do chão quadriculado (as casas clara e escura se alternam; pode enviar só uma). Desenhe até a borda, sem folga.',
    largura: 30, altura: 30, ancora: 'centro',
    animacoes: [{ id: 'claro', nome: 'Casa clara', quadros: 1, fps: 1 }, { id: 'escuro', nome: 'Casa escura', quadros: 1, fps: 1 }],
    previa: (g, anim) => { g.fillStyle = anim === 'escuro' ? '#0c170f' : '#0f1c12'; g.fillRect(-15, -15, 30, 30); },
  },
];
registrarPecas(SPRITES);

// Uma casa do chão (x, y em casas; C = tamanho da casa). Devolve false se não há sprite.
export function casaComSprite(g, x, y, C, t = 0) {
  return desenharSprite(g, 'cobrinha.chao', (x + y) % 2 ? 'escuro' : 'claro', x * C + C / 2, y * C + C / 2, { t, escala: C / 30 });
}

// Cenoura numa casa do tabuleiro (x, y em casas; C = tamanho da casa).
export function desenharCenoura(g, x, y, C, semSprite = false) {
  const cx = x * C + C / 2;
  const cy = y * C + C / 2;
  if (!semSprite && desenharSprite(g, 'cobrinha.cenoura', 'parada', cx, cy, { t: performance.now() / 1000, escala: C / 30 })) return;
  g.fillStyle = '#5b8c3e';
  g.beginPath();
  g.ellipse(cx - C * 0.1, cy - C * 0.3, C * 0.08, C * 0.18, -0.5, 0, Math.PI * 2);
  g.ellipse(cx + C * 0.1, cy - C * 0.3, C * 0.08, C * 0.18, 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8812f';
  g.beginPath();
  g.moveTo(cx - C * 0.24, cy - C * 0.16);
  g.quadraticCurveTo(cx, cy - C * 0.28, cx + C * 0.24, cy - C * 0.16);
  g.lineTo(cx, cy + C * 0.42);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(120, 50, 10, 0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - C * 0.12, cy);
  g.lineTo(cx - C * 0.02, cy);
  g.moveTo(cx + C * 0.04, cy + C * 0.14);
  g.lineTo(cx + C * 0.12, cy + C * 0.14);
  g.stroke();
}

// Um gomo da cobrinha sozinha (px, py: canto da casa).
function gomoSozinho(g, px, py, C, cor, cabeca = false) {
  g.fillStyle = cor;
  const m = cabeca ? 1.5 : 3;
  g.beginPath();
  if (g.roundRect) g.roundRect(px + m, py + m, C - m * 2, C - m * 2, cabeca ? 9 : 7);
  else g.rect(px + m, py + m, C - m * 2, C - m * 2);
  g.fill();
}
// Olhinhos na direção em que a cobra anda (px, py: canto da casa da cabeça).
function olhosSozinha(g, px, py, C, [dx, dy]) {
  g.fillStyle = '#1b1403';
  for (const lado of [-1, 1]) {
    const ex = px + C / 2 + dx * C * 0.18 + dy * lado * C * 0.2;
    const ey = py + C / 2 + dy * C * 0.18 + dx * lado * C * 0.2;
    g.beginPath();
    g.arc(ex, ey, C * 0.09, 0, Math.PI * 2);
    g.fill();
  }
}
function cabecaSozinha(g, px, py, C, cor, direcao) {
  gomoSozinho(g, px, py, C, cor, true);
  olhosSozinha(g, px, py, C, direcao);
}

// Desenha o tabuleiro da cobrinha: e = { cobra: [{x, y}], comida: {x, y} | null, direcao: [dx, dy], bateu }.
export function desenharCobrinha(g, { cobra, comida, direcao, bateu, arcoIris = false }) {
  const C = C_COBRA;
  const t = performance.now() / 1000;
  for (let y = 0; y < N_COBRA; y++) {
    for (let x = 0; x < N_COBRA; x++) {
      if (casaComSprite(g, x, y, C, t)) continue;
      g.fillStyle = (x + y) % 2 ? '#0c170f' : '#0f1c12';
      g.fillRect(x * C, y * C, C, C);
    }
  }
  if (comida) desenharCenoura(g, comida.x, comida.y, C);
  const animCabeca = temExato('cobrinha.cabeca', bateu ? 'bateu' : 'andando') ? (bateu ? 'bateu' : 'andando') : 'andando';
  const cabecaSprite = temExato('cobrinha.cabeca', animCabeca);
  const corpoSprite = temExato('cobrinha.corpo', 'normal');
  const raboSprite = temExato('cobrinha.rabo', 'normal');
  const corDe = i => {
    const k = i / Math.max(1, cobra.length - 1);
    return arcoIris && !(i === 0 && bateu) ? `hsl(${Math.round((i * 26 + performance.now() / 12) % 360)} 78% ${i === 0 ? 62 : 56}%)`
      : i === 0 ? (bateu ? '#d8674a' : '#d8b13a') : `rgb(${Math.round(127 - 50 * k)}, ${Math.round(176 - 60 * k)}, ${Math.round(105 - 40 * k)})`;
  };
  // Com sprite, a cor só pinta se ele foi enviado com "pintar"; no arco-íris ela muda aos poucos (de 15 em 15 graus).
  const corSprite = i => (arcoIris && !(i === 0 && bateu)
    ? `hsl(${(Math.round(((i * 26 + performance.now() / 12) % 360) / 15) * 15) % 360} 78% ${i === 0 ? 62 : 56}%)` : corDe(i));
  cobra.forEach((p, i) => {
    if (i === 0 && cabecaSprite) return; // a cabeça vai por cima, depois do corpo
    const rabo = raboSprite && i > 0 && i === cobra.length - 1;
    if (i > 0 && (corpoSprite || rabo)) {
      const ant = cobra[i - 1];
      desenharSprite(g, rabo ? 'cobrinha.rabo' : 'cobrinha.corpo', 'normal', p.x * C + C / 2, p.y * C + C / 2,
        { t, rot: anguloDe([ant.x - p.x, ant.y - p.y]), cor: corSprite(i) });
      return;
    }
    gomoSozinho(g, p.x * C, p.y * C, C, corDe(i), i === 0);
  });
  const cab = cobra[0];
  if (!cab) return;
  if (cabecaSprite) {
    desenharSprite(g, 'cobrinha.cabeca', animCabeca, cab.x * C + C / 2, cab.y * C + C / 2, { t, rot: anguloDe(direcao), cor: corSprite(0) });
    return;
  }
  olhosSozinha(g, cab.x * C, cab.y * C, C, direcao);
}

const escurecer = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - t)));
  return `rgb(${c.join(', ')})`;
};

// O corpo ao vivo: uma linha grossa passando pelo meio das casas, com um brilho no meio.
function linhaDoCorpo(g, pts, cor, C) {
  const linha = () => {
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (pts.length === 1) g.lineTo(pts[0][0] + 0.01, pts[0][1]);
  };
  g.strokeStyle = escurecer(cor, 0.42);
  g.lineWidth = C * 0.74;
  linha();
  g.stroke();
  g.strokeStyle = escurecer(cor, 0.18);
  g.lineWidth = C * 0.38;
  linha();
  g.stroke();
}

// Uma cobra ao vivo: pts = os pontos já em pixels (o meio das casas), cor da cobra, C = tamanho da casa,
// minha = é a cobra de quem vê (ganha um contorno branco), dir = [dx, dy].
export function desenharCobraAoVivo(g, pts, cor, C, minha, dir) {
  const t = performance.now() / 1000;
  const escala = C / 30;
  const corpoSprite = temExato('cobrinha.corpo', 'normal');
  const raboSprite = temExato('cobrinha.rabo', 'normal') && pts.length > 1;
  if (corpoSprite || raboSprite) {
    // Sem sprite do corpo, a linha vai até o penúltimo ponto e só a ponta do rabo é sprite.
    if (!corpoSprite) linhaDoCorpo(g, pts.slice(0, -1), cor, C);
    // Do rabo para a frente: cada gomo um pouco por cima do de trás.
    for (let k = pts.length - 1; k >= 1; k--) {
      const rabo = raboSprite && k === pts.length - 1;
      if (!rabo && !corpoSprite) continue;
      const [x, y] = pts[k];
      const [ax, ay] = pts[k - 1];
      desenharSprite(g, rabo ? 'cobrinha.rabo' : 'cobrinha.corpo', 'normal', x, y, { t, escala, rot: Math.atan2(ay - y, ax - x), cor });
    }
  } else {
    linhaDoCorpo(g, pts, cor, C);
  }
  // Cabeça
  const [hx, hy] = pts[0];
  if (temExato('cobrinha.cabeca', 'andando')) {
    desenharSprite(g, 'cobrinha.cabeca', 'andando', hx, hy, { t, escala, rot: anguloDe(dir), cor });
    if (minha) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(hx, hy, C * 0.47, 0, Math.PI * 2);
      g.stroke();
    }
    return;
  }
  g.fillStyle = cor;
  g.beginPath();
  g.arc(hx, hy, C * 0.47, 0, Math.PI * 2);
  g.fill();
  if (minha) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.stroke();
  }
  const [dx, dy] = dir;
  g.fillStyle = '#1b1403';
  for (const lado of [-1, 1]) {
    g.beginPath();
    g.arc(hx + dx * C * 0.18 + dy * lado * C * 0.2, hy + dy * C * 0.18 + dx * lado * C * 0.2, C * 0.1, 0, Math.PI * 2);
    g.fill();
  }
}
