// As roupas e os acessórios do coelho (Club Coelho e Lyendell Dorme), desenhados à mão no canvas.
// Tudo nas coordenadas do coelho de desenho-coelho.js: olhando para a direita, pés em (0, 0), corpo em
// (0, -13), cabeça em (11, -27), olho em (15, -28), focinho em (20, -24.5).
// Cada parte tem a sua vez: costas (atrás do corpo), corpo (por cima do pelo, recortado no corpo),
// pescoço, rosto e cabeça (depois da cabeça) e a mão (por último, na patinha da frente).

function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}
function forma(g, cor, pontos, fechar = true) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pontos[0], pontos[1]);
  for (let i = 2; i < pontos.length; i += 2) g.lineTo(pontos[i], pontos[i + 1]);
  if (fechar) g.closePath();
  g.fill();
}
function linha(g, cor, larg, ...pontos) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(pontos[0], pontos[1]);
  for (let i = 2; i < pontos.length; i += 2) g.lineTo(pontos[i], pontos[i + 1]);
  g.stroke();
}
function estrela(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/* ─── Cabeça ─── */
const CABECA = {
  laco(g) {
    el(g, 4, -36, 4.5, 3, '#e05a8a', -0.5);
    el(g, 10, -36, 4.5, 3, '#e05a8a', 0.5);
    el(g, 7, -36, 1.8, 1.8, '#b83a68');
  },
  chapeu(g) {
    el(g, 10, -34.5, 14, 3.4, '#e6c56b');
    g.fillStyle = '#d9b14f';
    g.beginPath();
    g.ellipse(10, -37, 7.5, 5.5, 0, Math.PI, 0);
    g.fill();
    g.fillRect(3, -36.5, 14, 2);
    g.fillStyle = '#b5543a';
    g.fillRect(3, -37, 14, 1.6);
  },
  flores(g) {
    for (const [fx, cor] of [[3, '#f0a0c0'], [8, '#f4dd80'], [13, '#a8d8f0'], [18, '#f0a0c0']]) {
      el(g, fx, -35.5, 2.4, 2.4, cor);
      el(g, fx, -35.5, 0.9, 0.9, '#fff7');
    }
  },
  coroa(g) {
    forma(g, '#e8c24a', [3, -35, 4, -42, 7.5, -38, 10, -44, 12.5, -38, 16, -42, 17, -35]);
    el(g, 10, -37, 1.2, 1.2, '#d8674a');
    el(g, 5.5, -36.5, 0.8, 0.8, '#5aa0d8');
    el(g, 14.5, -36.5, 0.8, 0.8, '#5aa0d8');
  },
  gorro(g) {
    g.fillStyle = '#c0392b';
    g.beginPath();
    g.ellipse(11, -32, 10, 8.5, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#ecdcc8';
    g.fillRect(1, -33.5, 20, 3.5);
    g.strokeStyle = 'rgba(0,0,0,0.15)';
    g.lineWidth = 0.8;
    for (let k = 4; k < 20; k += 3) linha(g, 'rgba(0,0,0,0.12)', 0.8, k, -34, k, -38);
    el(g, 11, -41.5, 3.6, 3.6, '#f7f3ea');
  },
  bone(g) {
    g.fillStyle = '#d8b13a';
    g.beginPath();
    g.ellipse(10, -33, 9.5, 6.5, 0, Math.PI, 0);
    g.fill();
    el(g, 20, -33, 7.5, 2.2, '#b8922a');
    el(g, 10, -39.3, 1.4, 1.1, '#b8922a');
    el(g, 8, -36, 2.2, 2, '#2f6b34');
  },
  cozinheiro(g) {
    g.fillStyle = '#f2efe6';
    g.fillRect(3, -38.5, 16, 5);
    el(g, 6, -44, 5.5, 5.5, '#ffffff');
    el(g, 11, -47, 6.5, 6.5, '#ffffff');
    el(g, 16, -44, 5.5, 5.5, '#ffffff');
    linha(g, 'rgba(0,0,0,0.08)', 0.8, 3, -38.5, 19, -38.5);
  },
  fones(g) {
    g.strokeStyle = '#2a2a33';
    g.lineWidth = 2.4;
    g.beginPath();
    g.ellipse(9, -30, 9, 10.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    el(g, 6.5, -27.5, 3.6, 5, '#5aa0d8');
    el(g, 6.5, -27.5, 2, 3.2, '#2a2a33');
  },
  bruxa(g) {
    el(g, 11, -34, 14, 3, '#3a2a5a');
    forma(g, '#4a3670', [3.5, -35, 18.5, -35, 13, -46, 4, -59]);
    g.fillStyle = '#d8b13a';
    g.fillRect(4, -38, 14, 2.2);
    estrela(g, 11, -42, 2, '#f4dd80');
  },
  pirata(g) {
    g.fillStyle = '#1e1a18';
    g.beginPath();
    g.moveTo(-1, -34);
    g.quadraticCurveTo(11, -30, 23, -34);
    g.quadraticCurveTo(21, -40, 17, -40);
    g.quadraticCurveTo(11, -46, 5, -40);
    g.quadraticCurveTo(1, -40, -1, -34);
    g.fill();
    linha(g, '#d8b13a', 1, 0, -34.5, 22, -34.5);
    el(g, 11, -38.5, 2, 1.8, '#f2ead8');
    linha(g, '#f2ead8', 0.8, 9, -36, 13, -36);
  },
  cartola(g) {
    el(g, 11, -34.5, 12.5, 2.8, '#1b1b22');
    g.fillStyle = '#22222b';
    g.fillRect(4, -53, 14, 18.5);
    el(g, 11, -53, 7, 1.6, '#2e2e38');
    g.fillStyle = '#b83a3a';
    g.fillRect(4, -39, 14, 3);
  },
  viking(g) {
    g.fillStyle = '#9aa3ad';
    g.beginPath();
    g.ellipse(11, -31.5, 10.5, 8.5, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#7a6a4a';
    g.fillRect(0.5, -33, 21, 3);
    for (const k of [3, 8, 13, 18]) el(g, k, -31.5, 0.7, 0.7, '#d8b13a');
    // Chifres
    g.fillStyle = '#f2ead8';
    g.beginPath(); g.moveTo(19, -35); g.quadraticCurveTo(28, -38, 26, -48); g.quadraticCurveTo(24, -41, 17, -38); g.fill();
    g.beginPath(); g.moveTo(3, -35); g.quadraticCurveTo(-6, -38, -4, -48); g.quadraticCurveTo(-2, -41, 5, -38); g.fill();
  },
  tiara(g) {
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      el(g, 11 + Math.cos(a) * 8.5, -31 + Math.sin(a) * 6, 1.3, 1.3, '#fbf6ee');
    }
    estrela(g, 11, -39.5, 2.6, '#e8c24a');
    el(g, 11, -39.5, 1.1, 1.1, '#5ac2d8');
  },
};

/* ─── Rosto ─── */
const ROSTO = {
  oculos(g) {
    g.strokeStyle = '#1b1403';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(15, -28, 3.2, 0, Math.PI * 2);
    g.moveTo(10.5, -28);
    g.arc(8.5, -28, 2.6, 0, Math.PI * 2);
    g.stroke();
  },
  escuros(g) {
    g.fillStyle = '#121216';
    g.beginPath();
    g.roundRect ? g.roundRect(11.5, -30.5, 7.5, 5, 1.6) : g.rect(11.5, -30.5, 7.5, 5);
    g.fill();
    g.beginPath();
    g.roundRect ? g.roundRect(5.5, -30.5, 5, 4.5, 1.4) : g.rect(5.5, -30.5, 5, 4.5);
    g.fill();
    linha(g, '#121216', 1.2, 10.5, -28.5, 11.5, -28.5);
    linha(g, 'rgba(255,255,255,0.55)', 0.8, 13, -29.5, 15, -29.5);
  },
  monoculo(g) {
    g.strokeStyle = '#d8b13a';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(15, -28, 3.3, 0, Math.PI * 2);
    g.stroke();
    el(g, 15, -28, 3, 3, 'rgba(200,230,255,0.25)');
    linha(g, '#d8b13a', 0.6, 12.5, -25.8, 11, -20, 13, -16);
  },
  bigode(g) {
    g.fillStyle = '#4a3020';
    g.beginPath();
    g.moveTo(19.5, -23);
    g.quadraticCurveTo(16, -25, 13.5, -21.5);
    g.quadraticCurveTo(15.5, -22.5, 19.5, -21.6);
    g.quadraticCurveTo(23.5, -22.5, 25.5, -21.5);
    g.quadraticCurveTo(23, -25, 19.5, -23);
    g.fill();
  },
  mascara(g) {
    g.fillStyle = '#7b4ab8';
    g.beginPath();
    g.moveTo(5, -31);
    g.quadraticCurveTo(13, -34, 21, -30.5);
    g.quadraticCurveTo(20, -25.5, 15.5, -25);
    g.quadraticCurveTo(12.5, -27.5, 9.5, -25.5);
    g.quadraticCurveTo(5, -26.5, 5, -31);
    g.fill();
    el(g, 15, -28.3, 1.9, 1.4, '#1b1403');
    linha(g, '#d8b13a', 0.8, 5, -31, 21, -30.5);
    linha(g, '#e48ab8', 1.6, 5, -31, 1, -37);
  },
  tapaolho(g) {
    linha(g, '#1b1403', 1, 7, -33, 21, -24);
    el(g, 15, -28, 3.2, 3, '#1b1403');
  },
};

/* ─── Pescoço ─── */
const PESCOCO = {
  cachecol(g) {
    el(g, 5, -19, 8, 3.5, '#c0392b', 0.2);
    g.fillStyle = '#c0392b';
    g.fillRect(-2, -18, 4, 9);
    g.fillStyle = '#e8d9b0';
    g.fillRect(-2, -12, 4, 1.4);
  },
  gravata(g) {
    forma(g, '#b83a3a', [12, -17.5, 7.5, -20.5, 7.5, -14.5]);
    forma(g, '#b83a3a', [12, -17.5, 16.5, -20.5, 16.5, -14.5]);
    el(g, 12, -17.5, 1.6, 1.6, '#8a2424');
  },
  perolas(g) {
    for (let k = 0; k < 8; k++) {
      const a = 0.25 + (k / 7) * 1.9;
      el(g, 9 + Math.cos(a) * 8, -24 + Math.sin(a) * 6.5, 1.25, 1.25, '#fbf6ee');
    }
  },
  medalha(g) {
    forma(g, '#2f6b34', [5, -21, 8, -21, 10.5, -12, 8.5, -11]);
    forma(g, '#2f6b34', [13, -20.5, 10, -20.5, 9, -12, 11, -11.5]);
    el(g, 9.8, -9.5, 3.6, 3.6, '#e8c24a');
    el(g, 9.8, -9.5, 2.4, 2.4, '#d8b13a');
    el(g, 9.8, -10, 0.8, 1.4, '#f7f3ea');
  },
};

/* ─── Costas (atrás do corpo) ─── */
const COSTAS = {
  mochila(g) {
    g.fillStyle = '#8a5a2b';
    g.beginPath();
    g.roundRect ? g.roundRect(-22, -27, 12, 17, 3) : g.rect(-22, -27, 12, 17);
    g.fill();
    g.fillStyle = '#6e4520';
    g.fillRect(-22, -21, 12, 2);
    el(g, -16, -16, 3, 2.2, '#a8743a');
  },
  capa(g, t) {
    const onda = Math.sin(t * 3) * 2;
    g.fillStyle = '#9c2b2b';
    g.beginPath();
    g.moveTo(4, -24);
    g.quadraticCurveTo(-10, -26, -18 + onda, -14);
    g.quadraticCurveTo(-24 + onda, -4, -16 + onda, 0);
    g.lineTo(-4, -2);
    g.quadraticCurveTo(-2, -14, 4, -24);
    g.fill();
    linha(g, '#d8b13a', 1.2, -18 + onda, -14, -24 + onda * 0.8, -4);
  },
  asas(g, t) {
    const bate = Math.sin(t * 7) * 0.18;
    for (const [rot, rx, ry, cx, cy] of [[-0.6 - bate, 11, 6, -14, -28], [-0.15 - bate * 0.6, 8, 4.5, -14, -20]]) {
      el(g, cx, cy, rx, ry, 'rgba(200,232,255,0.65)', rot);
      g.strokeStyle = 'rgba(150,190,240,0.9)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      g.stroke();
    }
    el(g, -8, -22, 1, 1, '#f4dd80');
  },
};

/* ─── Corpo (recortado no corpo do coelho) ─── */
const CORPO = {
  camiseta(g) {
    g.fillStyle = '#2f6b34';
    g.fillRect(-16, -26, 32, 19);
    linha(g, 'rgba(0,0,0,0.15)', 1, -16, -7.5, 16, -7.5);
    el(g, 5, -15, 3.8, 3.8, '#d8b13a');
    el(g, 5, -15, 1.5, 2.4, '#2f6b34');
  },
  avental(g) {
    g.fillStyle = '#f2efe6';
    g.beginPath();
    g.roundRect ? g.roundRect(-1, -23, 18, 21, 4) : g.rect(-1, -23, 18, 21);
    g.fill();
    g.fillStyle = '#e05a5a';
    g.fillRect(-16, -15, 32, 2);
    g.strokeStyle = 'rgba(0,0,0,0.15)';
    g.lineWidth = 0.8;
    g.strokeRect(4, -12, 7, 5);
  },
  moletom(g) {
    g.fillStyle = '#7b5ab8';
    g.fillRect(-16, -26, 32, 20);
    g.fillStyle = '#6a4aa3';
    g.beginPath();
    g.roundRect ? g.roundRect(0, -14, 12, 7, 2) : g.rect(0, -14, 12, 7);
    g.fill();
    linha(g, '#f2efe6', 0.9, 9, -23, 9, -18);
    linha(g, '#f2efe6', 0.9, 12, -23, 12.5, -18.5);
  },
  colete(g) {
    g.fillStyle = '#7a4a2a';
    g.fillRect(-16, -26, 24, 20);
    g.fillRect(12, -26, 4, 20);
    for (const y of [-21, -16, -11]) el(g, 6.5, y, 0.9, 0.9, '#d8b13a');
    linha(g, 'rgba(0,0,0,0.25)', 0.8, 8, -26, 8, -6);
  },
  vestido(g) {
    g.fillStyle = '#e48ab8';
    g.fillRect(-16, -26, 32, 22);
    for (const [x, y] of [[-8, -20], [2, -22], [9, -14], [-3, -12], [-11, -10]]) el(g, x, y, 1.3, 1.3, '#fbf6ee');
  },
  smoking(g) {
    g.fillStyle = '#1f1f26';
    g.fillRect(-16, -26, 32, 20);
    forma(g, '#f7f5ef', [5, -25, 15, -25, 11, -9]);
    el(g, 11.5, -21, 2.4, 1.4, '#111');
    for (const y of [-17, -13]) el(g, 10.5, y, 0.7, 0.7, '#555');
  },
  armadura(g) {
    g.fillStyle = '#a8b0ba';
    g.fillRect(-16, -26, 32, 21);
    for (const y of [-20, -14]) linha(g, '#7f8893', 1.2, -16, y, 16, y);
    for (const [x, y] of [[-10, -23], [-2, -23], [6, -23], [12, -17], [-6, -11], [4, -11]]) el(g, x, y, 0.8, 0.8, '#e8ecf0');
    el(g, 6, -17, 3, 3.4, '#d8b13a');
  },
};
// O vestido tem saia: um pedaço que sai do corpo (desenhado depois do recorte).
function saia(g) {
  forma(g, '#e48ab8', [-13, -9, 13, -9, 17, -2, -17, -2]);
  for (const x of [-11, -4, 3, 10]) el(g, x, -4.5, 1.2, 1.2, '#fbf6ee');
}

/* ─── Na mão (patinha da frente) ─── */
const MAO = {
  balao(g, t) {
    const b = Math.sin(t * 2) * 1.5;
    g.strokeStyle = '#ddd';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(15, -13);
    g.quadraticCurveTo(26, -34, 22 + b, -57);
    g.stroke();
    el(g, 22 + b, -66, 7, 8.5, '#e05a5a');
    el(g, 19.5 + b, -69, 1.8, 2.6, 'rgba(255,255,255,0.55)', -0.4);
    forma(g, '#c04040', [21 + b, -57.8, 23 + b, -57.8, 22 + b, -56]);
  },
  sorvete(g) {
    forma(g, '#d9a35a', [12.5, -16, 18.5, -16, 15.5, -6]);
    el(g, 15.5, -18, 3.4, 3, '#f2a7c8');
    el(g, 15.5, -21.5, 3, 2.7, '#9ccc8a');
    el(g, 16, -24, 1, 1, '#c0392b');
  },
  lanterna(g, t) {
    linha(g, '#3a2a1a', 1, 15, -13, 15, -17);
    g.fillStyle = '#4a3420';
    g.fillRect(12.5, -11.5, 5, 7);
    const brilho = 0.75 + Math.sin(t * 5) * 0.1;
    el(g, 15, -8, 2, 2.5, `rgba(255,214,110,${brilho})`);
    const gr = g.createRadialGradient ? g.createRadialGradient(15, -8, 0, 15, -8, 12) : null;
    if (gr) {
      gr.addColorStop(0, 'rgba(255,214,110,0.35)');
      gr.addColorStop(1, 'rgba(255,214,110,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(15, -8, 12, 0, Math.PI * 2);
      g.fill();
    }
  },
  vara(g, t) {
    linha(g, '#7a4a2a', 1.4, 13, -9, 31, -46);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(31, -46);
    g.lineTo(34, -16 + Math.sin(t * 2) * 1.5);
    g.stroke();
    el(g, 34, -15 + Math.sin(t * 2) * 1.5, 1.6, 1.6, '#e05a5a');
  },
  espada(g) {
    linha(g, '#c9a46a', 2.6, 17, -16, 31, -38);
    linha(g, '#7a4a2a', 3, 12, -10, 16, -15.5);
    linha(g, '#5b3c22', 2, 13, -18, 19, -13);
  },
  bandeira(g, t) {
    linha(g, '#5b3c22', 1.4, 15, -4, 15, -58);
    const o = Math.sin(t * 4) * 2;
    g.fillStyle = '#1f4a2a';
    g.beginPath();
    g.moveTo(15, -57);
    g.quadraticCurveTo(25, -60 + o, 35, -55);
    g.lineTo(35, -44);
    g.quadraticCurveTo(25, -48 + o, 15, -45);
    g.closePath();
    g.fill();
    el(g, 25, -50.5 + o * 0.5, 2.4, 2.4, '#e8c24a');
  },
  varinha(g, t) {
    linha(g, '#3a2a40', 1.4, 13, -11, 24, -26);
    estrela(g, 25, -28, 3.4 + Math.sin(t * 6) * 0.5, '#f4dd80');
    for (let k = 0; k < 3; k++) {
      const f = (t * 1.5 + k / 3) % 1;
      el(g, 26 + Math.sin(k * 2 + t) * 4, -28 - f * 12, 0.8 * (1 - f), 0.8 * (1 - f), '#fff6c0');
    }
  },
  violao(g) {
    linha(g, '#5b3c22', 2.2, 10, -13, 27, -27);
    el(g, 6, -11, 7, 5.5, '#c97a3a', -0.5);
    el(g, 11.5, -15, 4.5, 3.6, '#c97a3a', -0.5);
    el(g, 8, -12.5, 1.8, 1.8, '#3a2414');
    linha(g, 'rgba(255,255,255,0.4)', 0.4, 3, -8, 27, -27);
  },
  cafe(g, t) {
    g.fillStyle = '#ece0bf';
    g.beginPath();
    g.roundRect ? g.roundRect(12.5, -17, 6, 7, 1.5) : g.rect(12.5, -17, 6, 7);
    g.fill();
    g.strokeStyle = '#ece0bf';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(19, -13.5, 2, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    el(g, 15.5, -16.5, 2.5, 0.8, '#6b4226');
    for (let k = 0; k < 2; k++) {
      const f = (t * 0.8 + k * 0.5) % 1;
      linha(g, `rgba(255,255,255,${0.5 * (1 - f)})`, 0.7, 14 + k * 2.5, -19 - f * 8, 15 + k * 2.5 + Math.sin(t * 3 + k) * 1.2, -22 - f * 8);
    }
  },
};

export const PARTES = ['costas', 'corpo', 'pescoco', 'rosto', 'cabeca', 'mao'];
const DESENHOS = { cabeca: CABECA, rosto: ROSTO, pescoco: PESCOCO, costas: COSTAS, corpo: CORPO, mao: MAO };

// Converte o acessório antigo (um só) em roupa por partes.
export function roupaDoAcessorio(a) {
  if (!a || a === 'nenhum') return {};
  if (ROSTO[a]) return { rosto: a };
  if (PESCOCO[a]) return { pescoco: a };
  return CABECA[a] ? { cabeca: a } : {};
}

// Desenha uma parte da roupa (se existir). pelo: cor da patinha que segura o item.
export function desenharParte(g, parte, id, t = 0, pelo = '#e9dcc3') {
  const f = id && DESENHOS[parte]?.[id];
  if (!f) return;
  if (parte === 'corpo') {
    g.save();
    g.beginPath();
    g.ellipse(0, -13, 15, 11.5, 0, 0, Math.PI * 2);
    g.clip();
    f(g, t);
    g.restore();
    if (id === 'vestido') saia(g);
    return;
  }
  if (parte === 'mao') {
    f(g, t);
    el(g, 14.5, -12, 3.2, 2.8, pelo); // a patinha segurando
    return;
  }
  f(g, t);
}
