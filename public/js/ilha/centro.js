// Região "centro" da Ilha do Club Coelho (veja clube-ilha.js): a Sala de Leitura (em cima do Café), o Fliperama
// (em cima do Salão de Dança), a Plaza com o Pet Shop dos Pompons, a Pizzaria, o Teatro e o Hotel dos Pompons
// (Saguão, Spa e Cobertura), o Parque dos Pompons e a Pista de Skate. As salas antigas (Praça, Café, Armarinho,
// Salão e Lago) continuam em clube-salas.js. Os minijogos e as janelas (Mancala, Fábrica de Pizzas, Lança-Pompom,
// os livros e os roteiros) ficam em centro-jogos.js, que só carrega na hora de abrir.
// Não usa nada da página: dá para importar e testar no Node.
import { registrarRegiao } from '../clube-ilha.js';
import { DESENHO, W, H } from '../clube-salas.js';
import { desenharCoelho, sorte } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, temSprite } from '../sprites.js';

const { el, ret, grad, brilho, texto, forma, placa, nuvem, sombraNoChao, naOrigem, chaoPedras, chaoTabuas, chaoXadrez, chaoGrama, arvoreRedonda, setaPlaca, setaDupla, poste } = DESENHO;
// Sprite enviado em #/recreacao/sprites para uma peça daqui (false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `ilha-centro.${peca}`, anim, x, y, o);
const jogos = () => import('./centro-jogos.js');
const agora = () => Date.now() / 1000;
const pular = (t, fase, alt = 12, vel = 4) => Math.abs(Math.sin(t * vel + fase)) * alt;
function noRetangulo(g, x, y, w, hh, f) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, hh);
  g.clip();
  f();
  g.restore();
}
function linha(g, cor, larg, pts) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
const tapete = (g, texto_, cor) => {
  ret(g, 430, 568, 140, 30, cor, 6);
  texto(g, texto_, 500, 584, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
};

/* ─── Pompons ─── */

export const CORES_POMPOM = { rosa: '#f28ab8', azul: '#6fb6f0', amarelo: '#f4d35e', verde: '#7fd07a', roxo: '#b07ee8', preto: '#3a3440', branco: '#f7f3ea', laranja: '#f39a4a' };
const CORES = Object.values(CORES_POMPOM);

// Um pompom (x, y: embaixo, no chão; r: o raio). pulo: a altura do pulinho (a sombra fica no chão).
export function pompom(g, x, y, r, cor, t = 0, pulo = 0, sombra = true) {
  if (sombra) el(g, x, y, r * (0.9 - Math.min(0.4, pulo / 60)), r * 0.25, 'rgba(0,0,0,0.22)');
  if (!sp(g, 'pompom', 'pulando', x, y - pulo, { t, cor, escala: r / 16 })) pompomCorpo(g, x, y - pulo, r, cor, t);
}
function pompomCorpo(g, x, y, r, cor, t = 0) {
  const cy = y - r;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, x + Math.cos(a) * r * 0.84, cy + Math.sin(a) * r * 0.84, r * 0.24, r * 0.24, cor); }
  el(g, x, cy, r * 0.95, r * 0.92, cor);
  for (let k = -1; k <= 1; k++) el(g, x + k * r * 0.2, cy - r * 0.92, r * 0.1, r * 0.26, cor, k * 0.5);
  el(g, x - r * 0.32, cy - r * 0.42, r * 0.34, r * 0.22, 'rgba(255,255,255,0.28)', -0.4);
  const piscar = ((t * 0.7 + Math.abs(x) * 0.013) % 4) < 0.12;
  for (const d of [-1, 1]) {
    if (piscar) { ret(g, x + d * r * 0.3 - r * 0.16, cy - r * 0.02, r * 0.32, Math.max(1, r * 0.07), '#1b1403'); continue; }
    el(g, x + d * r * 0.3, cy - r * 0.04, r * 0.2, r * 0.26, '#ffffff');
    el(g, x + d * r * 0.3 + r * 0.04, cy + r * 0.02, r * 0.12, r * 0.16, '#1b1403');
    el(g, x + d * r * 0.3 + r * 0.08, cy - r * 0.07, r * 0.05, r * 0.05, '#ffffff');
  }
  el(g, x - r * 0.56, cy + r * 0.26, r * 0.13, r * 0.08, 'rgba(255,110,140,0.45)');
  el(g, x + r * 0.56, cy + r * 0.26, r * 0.13, r * 0.08, 'rgba(255,110,140,0.45)');
  g.strokeStyle = '#1b1403';
  g.lineWidth = Math.max(1, r * 0.07);
  g.beginPath(); g.arc(x, cy + r * 0.26, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

/* ─── NPCs ─── */

const NPCS = {
  'npc-bibliotecaria': { nome: 'Dona Traça, a bibliotecária', sala: 'na Sala de Leitura, perto das estantes', pelo: '#d9b48a', roupa: { rosto: 'oculos', pescoco: 'perolas', corpo: 'vestido' }, escala: 1.25 },
  'npc-tratadora': { nome: 'Tratadora do Pet Shop', sala: 'no balcão do Pet Shop dos Pompons', pelo: '#f7f3ea', roupa: { cabeca: 'laco', corpo: 'avental' }, escala: 1.25 },
  'npc-pizzaiolo': { nome: 'Pizzaiolo', sala: 'no balcão da Pizzaria', pelo: '#c99a6b', roupa: { cabeca: 'cozinheiro', rosto: 'bigode', corpo: 'avental' }, escala: 1.25 },
  'npc-diretor': { nome: 'Diretor do Teatro', sala: 'ao lado dos roteiros, no Teatro', pelo: '#9aa3ad', roupa: { cabeca: 'cartola', rosto: 'monoculo', costas: 'capa' }, escala: 1.2 },
  'npc-recepcionista': { nome: 'Recepcionista do Hotel', sala: 'na recepção do Hotel dos Pompons', pelo: '#8a6a4f', roupa: { pescoco: 'gravata', corpo: 'smoking' }, escala: 1.25 },
};
function npc(g, id, x, y, t, dir = 1) {
  const n = NPCS[id];
  if (temSprite(`ilha-centro.${id}`)) {
    el(g, x, y + n.escala, 15 * n.escala, 4.5 * n.escala, 'rgba(0,0,0,0.28)');
    sp(g, id, 'parado', x, y, { t, dir });
    return;
  }
  g.save();
  g.translate(x, y);
  g.scale(n.escala, n.escala);
  desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir, t });
  g.restore();
}

/* ─── Sala de Leitura ─── */

const LIVROS = ['#8a2f3a', '#2f6b34', '#d8b13a', '#3a5a8a', '#7b5ab8', '#b5523a', '#4a7a6a', '#c9a06a'];

function fundoLeitura(g) {
  g.fillStyle = '#3d5a3c';
  g.fillRect(0, 0, W, 340);
  for (let x = 0; x < W; x += 32) { g.fillStyle = 'rgba(255,240,200,0.05)'; g.fillRect(x, 0, 10, 250); }
  for (let x = 16; x < W; x += 64) for (let y = 24; y < 240; y += 56) el(g, x, y, 3, 3, 'rgba(232,194,74,0.2)');
  g.fillStyle = '#5b3a20'; g.fillRect(0, 250, W, 90);
  for (let x = 10; x < W; x += 70) ret(g, x, 262, 58, 64, '#6b4226', 4);
  g.fillStyle = '#3a2414'; g.fillRect(0, 246, W, 6); g.fillRect(0, 334, W, 8);
  chaoTabuas(g, 340, H, ['#7a4a2a', '#6f4226', '#845232']);
  el(g, 610, 468, 250, 72, '#5a1a24');
  el(g, 610, 468, 236, 64, '#8a2f3a');
  el(g, 610, 468, 190, 49, '#b8922a');
  el(g, 610, 468, 178, 44, '#8a2f3a');
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; el(g, 610 + Math.cos(a) * 212, 468 + Math.sin(a) * 57, 5, 3, '#d8b13a'); }
  el(g, 610, 468, 60, 16, '#b8922a');
  if (!sp(g, 'estante-historia', 'parado', 230, 336, { quadro: 0 })) estanteHistoria(g);
  if (!sp(g, 'janela-redonda', 'parado', 540, 130, { quadro: 0 })) janelaLeitura(g);
  if (!sp(g, 'lareira-leitura', 'parado', 830, 338, { quadro: 0 })) lareiraLeitura(g);
  if (!sp(g, 'escada-leitura', 'parado', 115, 600, { quadro: 0 })) escadaLeitura(g);
}
function estanteHistoria(g) {
  ret(g, 40, 36, 380, 300, '#4a2e18', 6);
  ret(g, 52, 48, 356, 280, '#2a190c', 3);
  const rnd = sorte(21);
  for (let p = 0; p < 5; p++) {
    const base = 48 + p * 56 + 50;
    ret(g, 48, base, 364, 6, '#5b3c22');
    let x = 58;
    while (x < 398) {
      const cor = LIVROS[Math.floor(rnd() * LIVROS.length)];
      if (rnd() < 0.08 && x < 360) {
        ret(g, x, base - 8, 32, 8, cor, 1); ret(g, x + 2, base - 15, 28, 7, LIVROS[(p + 3) % 8], 1);
        x += 36;
        continue;
      }
      const w = 8 + Math.floor(rnd() * 8);
      const hh = 30 + Math.floor(rnd() * 16);
      if (x + w > 402) break;
      ret(g, x, base - hh, w, hh, cor, 1);
      ret(g, x + 1, base - hh + 5, w - 2, 2, 'rgba(232,194,74,0.6)');
      ret(g, x + 1, base - 9, w - 2, 2, 'rgba(232,194,74,0.45)');
      x += w + 1;
    }
  }
  placa(g, 230, 22, 210, 26, 'História da Ilha', { fonte: '700 13px "Cinzel", Georgia, serif' });
  linha(g, '#8a5a32', 4, [330, 60, 356, 336]);
  linha(g, '#8a5a32', 4, [354, 60, 380, 336]);
  for (let k = 0; k < 8; k++) linha(g, '#8a5a32', 3, [333 + k * 3.2, 86 + k * 33, 357 + k * 3.2, 86 + k * 33]);
}
function janelaLeitura(g) {
  el(g, 540, 130, 76, 76, '#4a2e18');
  g.save();
  g.beginPath(); g.arc(540, 130, 64, 0, Math.PI * 2); g.clip();
  g.fillStyle = grad(g, 0, 66, 0, 194, [[0, '#1d2a5a'], [0.65, '#6a5a9a'], [1, '#e8a070']]);
  g.fillRect(476, 66, 128, 128);
  for (const [x, y] of [[500, 86], [522, 100], [590, 80], [560, 74], [508, 112]]) el(g, x, y, 1.2, 1.2, '#ffffff');
  el(g, 572, 92, 10, 10, '#fff4c2');
  forma(g, '#8a94b8', [470, 182, 516, 120, 546, 152, 575, 108, 610, 172, 610, 200, 470, 200]);
  forma(g, '#eef2fa', [506, 134, 516, 120, 527, 134, 516, 130]);
  forma(g, '#eef2fa', [564, 124, 575, 108, 587, 126, 575, 120]);
  g.restore();
  linha(g, '#4a2e18', 5, [540, 66, 540, 194]);
  linha(g, '#4a2e18', 5, [476, 130, 604, 130]);
  ret(g, 466, 204, 148, 10, '#5b3c22', 3);
}
function lareiraLeitura(g) {
  // O retrato do Capitão Saltarrocha em cima da lareira
  ret(g, 772, 26, 116, 104, '#b8922a', 4);
  ret(g, 780, 34, 100, 88, '#2f4a6a', 2);
  el(g, 830, 122, 60, 16, '#24384f');
  g.save(); g.translate(822, 122); g.scale(1.6, 1.6);
  desenharCoelho(g, 0, 0, { pelo: '#9aa3ad', roupa: { cabeca: 'pirata', rosto: 'tapaolho', corpo: 'colete' }, dir: 1, t: 0 });
  g.restore();
  ret(g, 740, 150, 180, 188, '#8c8a86', 4);
  const rnd = sorte(4);
  for (let y = 156; y < 334; y += 18) for (let x = 744 + ((y / 18) % 2) * 12; x < 914; x += 26) ret(g, x, y, 22, 14, ['#9c9a95', '#87857f', '#a5a39d'][Math.floor(rnd() * 3)], 3);
  ret(g, 726, 138, 208, 16, '#5b3c22', 3);
  el(g, 830, 232, 52, 30, '#1e140c');
  ret(g, 778, 232, 104, 106, '#1e140c');
  for (const [dx, rot] of [[-16, 0.35], [16, -0.35]]) { g.save(); g.translate(830 + dx, 326); g.rotate(rot); ret(g, -26, -5, 52, 10, '#5b3c22', 3); g.restore(); }
  // Em cima: o navio na garrafa e duas velas
  el(g, 790, 126, 22, 10, 'rgba(200,230,240,0.6)');
  forma(g, '#8a5a32', [778, 128, 802, 128, 798, 133, 782, 133]);
  forma(g, '#fbf3e0', [790, 127, 790, 116, 799, 126]);
  for (const x of [860, 880]) { ret(g, x - 4, 118, 8, 20, '#f2e8cf', 2); el(g, x, 114, 2.5, 4, '#ffd060'); }
}
function escadaLeitura(g) {
  forma(g, '#1e140c', [40, 508, 190, 508, 206, H, 24, H]);
  for (let k = 0; k < 5; k++) {
    const y = 518 + k * 18;
    const f = k / 5;
    forma(g, k % 2 ? '#6b4226' : '#5b3a20', [40 - f * 14, y, 190 + f * 14, y, 192 + f * 14, y + 10, 38 - f * 14, y + 10]);
  }
  for (const [x0, x1] of [[40, 24], [190, 206]]) {
    linha(g, '#4a2e18', 5, [x0, 486, x1, 580]);
    for (let k = 0; k < 4; k++) ret(g, x0 + (x1 - x0) * (k / 3) - 2, 488 + k * 30, 4, 22, '#5b3c22');
  }
  placa(g, 115, 492, 104, 22, 'Café', { fonte: '700 12px "Cinzel", Georgia, serif' });
}
function animarLeitura(g, t) {
  const tremor = k => Math.sin(t * 11 + k) * 3;
  el(g, 830 + tremor(1) * 0.5, 306, 30, 28 + tremor(2), '#e0682a');
  el(g, 830 + tremor(3) * 0.6, 312, 20, 20 + tremor(4), '#f4b03a');
  el(g, 830, 320, 10, 10, '#fff1a8');
  brilho(g, 830, 300, 170, 'rgba(255,150,70,A)', 0.24 + Math.sin(t * 7) * 0.04);
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.6 + k / 4) % 1;
    el(g, 820 + k * 7 + Math.sin(f * 9 + k) * 8, 300 - f * 70, 1.6, 1.6, `rgba(255,200,90,${1 - f})`);
  }
  for (const x of [860, 880]) { el(g, x, 112 + Math.sin(t * 9 + x) * 0.8, 2.5, 4, '#ffd060'); brilho(g, x, 112, 22, 'rgba(255,220,120,A)', 0.3); }
  // A luz da janela e a poeirinha dançando
  g.fillStyle = 'rgba(255,230,190,0.05)';
  g.beginPath(); g.moveTo(490, 190); g.lineTo(590, 190); g.lineTo(700, 470); g.lineTo(470, 470); g.closePath(); g.fill();
  for (let k = 0; k < 10; k++) {
    const x = 500 + ((k * 53 + t * 6) % 170);
    const y = 220 + ((k * 71 + t * 9) % 230);
    el(g, x, y, 1.2, 1.2, `rgba(255,240,200,${0.3 + 0.3 * Math.sin(t * 2 + k)})`);
  }
}
function poltrona(g, x, y, dir) {
  sombraNoChao(g, x, y + 2, 44);
  if (!sp(g, 'poltrona', 'parado', x, y, { dir })) poltronaCorpo(g, x, y, dir);
}
function poltronaCorpo(g, x, y, dir = 1) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  ret(g, -38, -86, 50, 70, '#2f5a3c', 18);
  for (const [bx, by] of [[-24, -66], [-4, -66], [-14, -50]]) el(g, bx, by, 2, 2, '#1f3e28');
  ret(g, -40, -42, 80, 28, '#3a6a48', 10);
  ret(g, -46, -60, 20, 48, '#2a5034', 9);
  ret(g, 28, -52, 18, 40, '#2a5034', 9);
  ret(g, -38, -16, 6, 16, '#3a2414');
  ret(g, 32, -16, 6, 16, '#3a2414');
  g.restore();
}
function mesaMancala(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 70);
  if (!sp(g, 'mesa-mancala', 'parado', x, y, { t })) mesaMancalaCorpo(g, x, y);
}
function mesaMancalaCorpo(g, x, y) {
  for (const dx of [-86, 86]) {
    ret(g, x + dx - 3, y - 26, 6, 26, '#4a2e18');
    el(g, x + dx, y - 28, 20, 7, '#6b4226'); el(g, x + dx, y - 31, 20, 7, '#8a5a32');
  }
  ret(g, x - 5, y - 46, 10, 46, '#4a2e18');
  el(g, x, y - 2, 26, 6, '#4a2e18');
  el(g, x, y - 48, 70, 18, '#6b4226');
  el(g, x, y - 52, 70, 18, '#8a5a32');
  ret(g, x - 54, y - 64, 108, 24, '#c08a50', 11);
  ret(g, x - 54, y - 64, 108, 4, 'rgba(255,255,255,0.15)', 2);
  el(g, x - 46, y - 52, 5, 9, '#6b4226');
  el(g, x + 46, y - 52, 5, 9, '#6b4226');
  for (let i = 0; i < 6; i++) for (const yy of [-58, -46]) {
    const cx = x - 32 + i * 12.8;
    el(g, cx, y + yy, 5, 3.4, '#6b4226');
    el(g, cx - 1.5, y + yy - 0.5, 1.6, 1.2, '#f39a4a');
    el(g, cx + 1.5, y + yy + 0.5, 1.6, 1.2, '#f39a4a');
  }
}
function livroCapitao(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 26);
  brilho(g, x, y - 80, 60, 'rgba(255,215,120,A)', 0.22 + Math.sin(t * 2.5) * 0.08);
  if (!sp(g, 'livro-capitao', 'parado', x, y, { t })) livroCapitaoCorpo(g, x, y);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.5 + k / 3) % 1;
    el(g, x - 20 + k * 20, y - 86 - f * 30, 1.6, 1.6, `rgba(255,230,140,${1 - f})`);
  }
}
function livroCapitaoCorpo(g, x, y) {
  ret(g, x - 6, y - 62, 12, 62, '#4a2e18');
  el(g, x, y - 2, 22, 6, '#3a2414');
  forma(g, '#5b3c22', [x - 36, y - 60, x + 36, y - 60, x + 30, y - 76, x - 30, y - 76]);
  forma(g, '#3a1f12', [x - 33, y - 70, x + 33, y - 70, x + 30, y - 76, x - 30, y - 76]);
  forma(g, '#e9dcc3', [x - 30, y - 72, x, y - 68, x, y - 88, x - 28, y - 92]);
  forma(g, '#f4ead2', [x + 30, y - 72, x, y - 68, x, y - 88, x + 28, y - 92]);
  for (let k = 0; k < 4; k++) { linha(g, 'rgba(90,60,30,0.45)', 1, [x - 25, y - 86 + k * 4.5, x - 5, y - 83 + k * 4.5]); linha(g, 'rgba(90,60,30,0.45)', 1, [x + 5, y - 83 + k * 4.5, x + 25, y - 86 + k * 4.5]); }
  ret(g, x + 2, y - 70, 3, 14, '#c0392b');
  el(g, x, y - 42, 7, 7, '#d8b13a');
  el(g, x, y - 43, 3.5, 3, '#3a2414');
}

/* ─── Fliperama ─── */

export const MAQUINAS = [
  { jogo: 'corrida', nome: 'Corrida do Coelho', cor: '#e05a5a', x: 150 },
  { jogo: 'barris', nome: 'Barris do Raposo', cor: '#e8a040', x: 325 },
  { jogo: 'travessia', nome: 'Travessia', cor: '#5cc86a', x: 500 },
  { jogo: 'super-coelho', nome: 'Super Coelho', cor: '#5aa0e8', x: 675 },
  { jogo: 'pac-coelho', nome: 'Pac-Coelho', cor: '#e8c24a', x: 850 },
];

function fundoFliperama(g) {
  g.fillStyle = grad(g, 0, 0, 0, 372, [[0, '#0e0820'], [1, '#26133f']]);
  g.fillRect(0, 0, W, 372);
  const rnd = sorte(31);
  for (let k = 0; k < 50; k++) el(g, rnd() * W, rnd() * 140, 1.1, 1.1, 'rgba(255,255,255,0.4)');
  for (const [y, cor] of [[118, 'rgba(255,122,217,0.55)'], [132, 'rgba(107,224,255,0.45)']]) {
    g.strokeStyle = cor; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) { g.lineTo(x + 20, y - 10); g.lineTo(x + 40, y); }
    g.stroke();
  }
  g.fillStyle = '#160c28'; g.fillRect(0, 300, W, 72);
  ret(g, 0, 366, W, 6, '#6be0ff');
  g.fillStyle = '#1a1030'; g.fillRect(0, 372, W, H - 372);
  const formas = ['#ff7ad9', '#6be0ff', '#ffe46b', '#7fe08a'];
  for (let k = 0; k < 120; k++) {
    const y = 380 + rnd() * 220;
    const x = rnd() * W;
    const s = 3 + (y - 372) * 0.03;
    const cor = formas[k % 4];
    const tipo = k % 3;
    if (tipo === 0) forma(g, cor, [x, y - s, x + s, y + s, x - s, y + s]);
    else if (tipo === 1) { g.strokeStyle = cor; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke(); }
    else linha(g, cor, 1.5, [x - s, y, x - s / 2, y - s / 2, x, y, x + s / 2, y - s / 2, x + s, y]);
  }
  if (!sp(g, 'escada-fliperama', 'parado', 110, 600, { quadro: 0 })) escadaFliperama(g);
}
function escadaFliperama(g) {
  forma(g, '#07040d', [36, 508, 184, 508, 200, H, 20, H]);
  for (let k = 0; k < 5; k++) {
    const y = 518 + k * 18;
    const f = k / 5;
    forma(g, '#1d132e', [36 - f * 14, y, 184 + f * 14, y, 186 + f * 14, y + 10, 34 - f * 14, y + 10]);
    ret(g, 36 - f * 14, y, 148 + f * 28, 2, k % 2 ? '#ff7ad9' : '#6be0ff');
  }
  for (const [x0, x1] of [[36, 20], [184, 200]]) linha(g, '#6be0ff', 3, [x0, 488, x1, 580]);
  placa(g, 110, 492, 104, 22, 'Salão', { fundo: '#2a1d42', borda: '#ff7ad9', cor: '#6be0ff', fonte: '700 12px "Cinzel", Georgia, serif' });
}
function animarFliperama(g, t) {
  const letras = 'FLIPERAMA';
  g.font = '700 34px "Cinzel", Georgia, serif';
  for (let k = 0; k < letras.length; k++) {
    const aceso = (Math.floor(t * 6) % (letras.length + 3)) !== k;
    const cor = ['#ff7ad9', '#6be0ff', '#ffe46b'][(k + Math.floor(t)) % 3];
    texto(g, letras[k], 340 + k * 40, 58, { cor: aceso ? cor : '#3a2a50', fonte: '700 34px "Cinzel", Georgia, serif' });
  }
  brilho(g, 500, 58, 220, 'rgba(255,122,217,A)', 0.12 + Math.sin(t * 3) * 0.03);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const a = Math.sin(t * 0.7 + k * 2) * 0.5;
    g.fillStyle = ['rgba(255,122,217,0.06)', 'rgba(107,224,255,0.06)', 'rgba(255,228,107,0.06)'][k];
    g.beginPath(); g.moveTo(200 + k * 300, 0); g.lineTo(200 + k * 300 + Math.sin(a) * 600 - 60, H); g.lineTo(200 + k * 300 + Math.sin(a) * 600 + 60, H); g.closePath(); g.fill();
  }
  g.restore();
}
function maquina(g, m, t) {
  sombraNoChao(g, m.x, 374, 60, 12);
  if (!sp(g, 'maquina', 'parado', m.x, 372, { t, cor: m.cor })) maquinaCorpo(g, m.x, 372, m.cor);
  telaMaquina(g, m, t);
  texto(g, m.nome, m.x, 372 - 195, { cor: '#ffffff', fonte: '700 11px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.6)' });
}
function maquinaCorpo(g, x, y, cor) {
  ret(g, x - 52, y - 214, 104, 214, '#1b1430', 6);
  ret(g, x - 52, y - 214, 7, 214, cor, 3);
  ret(g, x + 45, y - 214, 7, 214, cor, 3);
  ret(g, x - 46, y - 210, 92, 30, cor, 4);
  ret(g, x - 46, y - 210, 92, 6, 'rgba(255,255,255,0.3)', 3);
  ret(g, x - 46, y - 176, 92, 80, '#0b0816', 4);
  forma(g, '#2a1f48', [x - 48, y - 94, x + 48, y - 94, x + 54, y - 70, x - 54, y - 70]);
  ret(g, x - 25, y - 96, 4, 14, '#c8ccd4');
  el(g, x - 23, y - 98, 6, 6, '#e05a5a');
  el(g, x + 8, y - 82, 5, 3, '#6be0ff');
  el(g, x + 22, y - 84, 5, 3, '#ffe46b');
  el(g, x + 36, y - 86, 5, 3, '#ff7ad9');
  ret(g, x - 46, y - 68, 92, 68, '#241a3e', 4);
  ret(g, x - 9, y - 50, 18, 22, '#3a2a5a', 3);
  ret(g, x - 2, y - 46, 4, 12, '#ffe46b', 2);
}
// A telinha de cada máquina, com um pedacinho do jogo rodando (na frente do corpo, sprite ou não).
function telaMaquina(g, m, t) {
  const x0 = m.x - 42;
  const y0 = 372 - 172;
  const w = 84;
  const hh = 72;
  noRetangulo(g, x0, y0, w, hh, () => {
    const cx = m.x;
    if (m.jogo === 'corrida') {
      ret(g, x0, y0, w, hh, '#2f6b34');
      ret(g, cx - 24, y0, 48, hh, '#55555e');
      for (let k = 0; k < 6; k++) ret(g, cx - 1.5, y0 + ((k * 16 + t * 90) % 96) - 16, 3, 9, '#f4dd80');
      const cy = y0 + ((t * 60) % 110) - 20;
      ret(g, cx + 6, cy, 12, 16, '#e05a5a', 3);
      el(g, cx - 10 + Math.sin(t * 3) * 6, y0 + 58, 6, 7, '#f7f3ea');
    } else if (m.jogo === 'barris') {
      ret(g, x0, y0, w, hh, '#0b0816');
      for (let k = 0; k < 3; k++) {
        const yy = y0 + 18 + k * 22;
        linha(g, '#d8504a', 3, [x0 + (k % 2 ? 0 : 10), yy - (k % 2 ? 4 : 0), x0 + w - (k % 2 ? 10 : 0), yy - (k % 2 ? 0 : 4)]);
      }
      const f = (t * 0.45) % 1;
      const fila = Math.floor(f * 3);
      const p = (f * 3) % 1;
      const bx = fila % 2 ? x0 + w - 10 - p * (w - 20) : x0 + 10 + p * (w - 20);
      el(g, bx, y0 + 12 + fila * 22, 5, 5, '#a8774a');
      el(g, x0 + 14, y0 + 62, 5, 6, '#f7f3ea');
    } else if (m.jogo === 'travessia') {
      ret(g, x0, y0, w, hh, '#55555e');
      ret(g, x0, y0, w, 10, '#5cc86a');
      ret(g, x0, y0 + hh - 10, w, 10, '#5cc86a');
      for (let k = 0; k < 4; k++) {
        const vel = (k % 2 ? -1 : 1) * (30 + k * 12);
        for (let c = 0; c < 2; c++) {
          const cx2 = x0 + (((t * vel + c * 50 + k * 17) % 100) + 100) % 100 - 8;
          ret(g, cx2, y0 + 13 + k * 12, 16, 8, ['#e05a5a', '#ffe46b', '#6be0ff', '#ff7ad9'][k], 2);
        }
      }
      el(g, cx, y0 + hh - 6 - Math.floor((t * 1.5) % 6) * 10, 4, 4, '#f7f3ea');
    } else if (m.jogo === 'super-coelho') {
      ret(g, x0, y0, w, hh, '#6fb6f0');
      el(g, x0 + 18 - ((t * 10) % 40), y0 + 14, 10, 5, '#ffffff');
      const des = (t * 40) % 28;
      for (let k = 0; k < 5; k++) ret(g, x0 + k * 28 - des, y0 + hh - 12, 26, 12, '#a8774a');
      ret(g, x0 + 52 - des, y0 + 30, 14, 10, '#e8c24a', 2);
      el(g, cx - 14, y0 + hh - 18 - pular(t, 0, 22, 3), 5, 6, '#f7f3ea');
    } else {
      ret(g, x0, y0, w, hh, '#05030a');
      g.strokeStyle = '#3a5ae8'; g.lineWidth = 2;
      g.strokeRect?.(x0 + 4, y0 + 4, w - 8, hh - 8);
      linha(g, '#3a5ae8', 2, [x0 + 20, y0 + 22, x0 + 64, y0 + 22]);
      linha(g, '#3a5ae8', 2, [x0 + 20, y0 + 50, x0 + 64, y0 + 50]);
      const px = x0 + 8 + ((t * 30) % (w - 16));
      for (let k = 0; k < 8; k++) { const dx = x0 + 10 + k * 9.5; if (dx > px) el(g, dx, y0 + 36, 1.5, 1.5, '#f4dd80'); }
      const boca = Math.abs(Math.sin(t * 10)) * 0.8;
      g.fillStyle = '#e8c24a';
      g.beginPath(); g.moveTo(px, y0 + 36); g.arc(px, y0 + 36, 7, boca * 0.5, Math.PI * 2 - boca * 0.5); g.closePath(); g.fill();
      el(g, px - 22, y0 + 36, 6, 6, '#e05a5a');
    }
    for (let y = y0; y < y0 + hh; y += 3) ret(g, x0, y, w, 1, 'rgba(0,0,0,0.18)');
    if (Math.floor(t * 1.5) % 2) texto(g, 'INSIRA CENOURA', cx, y0 + hh - 6, { cor: '#ffffff', fonte: '700 7px sans-serif' });
  });
  brilho(g, m.x, y0 + hh / 2, 80, `${m.cor === '#e8c24a' ? 'rgba(232,194,74,A)' : 'rgba(150,200,255,A)'}`, 0.1 + Math.sin(t * 5 + m.x) * 0.03);
}

/* ─── Plaza ─── */

function fundoPlaza(g) {
  g.fillStyle = grad(g, 0, 0, 0, 380, [[0, '#1c2350'], [0.55, '#5a4a8a'], [1, '#f0a070']]);
  g.fillRect(0, 0, W, 380);
  const rnd = sorte(17);
  for (let k = 0; k < 60; k++) el(g, rnd() * W, rnd() * 170, 1.1, 1.1, 'rgba(255,255,255,0.7)');
  brilho(g, 260, 46, 60, 'rgba(255,250,220,A)', 0.4);
  el(g, 260, 46, 20, 20, '#fff8dc');
  el(g, 268, 42, 17, 17, '#2a3060');
  forma(g, '#3a2a5a', [0, 380, 0, 300, 120, 260, 260, 300, 400, 270, 560, 300, 700, 260, 860, 300, 1000, 270, 1000, 380]);
  if (!sp(g, 'fachada-petshop', 'parado', 140, 370, { quadro: 0 })) fachadaPetShop(g);
  if (!sp(g, 'fachada-pizzaria', 'parado', 375, 370, { quadro: 0 })) fachadaPizzaria(g);
  if (!sp(g, 'fachada-teatro', 'parado', 620, 370, { quadro: 0 })) fachadaTeatro(g);
  if (!sp(g, 'fachada-hotel', 'parado', 870, 370, { quadro: 0 })) fachadaHotel(g);
  ret(g, 0, 368, W, 34, '#bdb5a5');
  for (let x = 0; x < W; x += 50) ret(g, x, 368, 2, 34, 'rgba(0,0,0,0.12)');
  ret(g, 0, 398, W, 4, '#8a8478');
  chaoPedras(g, 402, H, ['#8a8a92', '#7e7e88', '#94949c', '#86868f'], '#5a5a62');
  // Os caminhos: Forte Nevado (com neve) e Floresta (folhas) à esquerda, Parque à direita.
  forma(g, '#d8dde4', [0, 404, 130, 414, 130, 456, 0, 466]);
  for (const [x, y, r] of [[30, 430, 14], [88, 426, 10], [60, 452, 9]]) el(g, x, y, r, r * 0.45, '#ffffff');
  forma(g, '#a8875a', [0, 474, 130, 488, 130, 546, 0, 566]);
  for (let k = 0; k < 9; k++) el(g, 12 + k * 13, 494 + (k * 17) % 60, 4, 2.4, ['#c0703a', '#d8a040', '#7a9a3a'][k % 3], k);
  forma(g, '#7fb069', [W, 440, W - 130, 456, W - 130, 534, W, 552]);
  for (let k = 0; k < 6; k++) el(g, W - 120 + k * 20, 470 + (k % 2) * 40, 3, 3, ['#f0a0c0', '#f4dd80', '#ffffff'][k % 3]);
  // A rua que desce para a Praça (embaixo, à esquerda).
  forma(g, '#a8a39a', [190, 548, 330, 548, 350, H, 170, H]);
  for (let k = 0; k < 3; k++) ret(g, 252 - k * 2, 556 + k * 14, 16 + k * 4, 6, 'rgba(255,255,255,0.45)', 2);
  placa(g, 260, 586, 160, 26, 'Praça do Clube', { fundo: '#7a5434', borda: '#4a2e18', cor: '#f4dd80', fonte: '700 13px "Cinzel", Georgia, serif' });
  // A tampa do bueiro (dizem que tem alguém lá embaixo).
  el(g, 520, 506, 36, 11, '#4a4a52');
  el(g, 520, 505, 32, 9, '#5d5d66');
  for (let k = -2; k <= 2; k++) linha(g, '#45454d', 1.5, [520 + k * 10 - 4, 498 + Math.abs(k), 520 + k * 10 + 4, 512 - Math.abs(k)]);
}
function fachadaPetShop(g) {
  forma(g, '#c25a8a', [18, 154, 262, 154, 236, 112, 44, 112]);
  ret(g, 30, 150, 220, 220, '#f7c6d9');
  for (let y = 160; y < 370; y += 18) ret(g, 30, y, 220, 1.5, 'rgba(200,90,140,0.15)');
  ret(g, 24, 146, 232, 12, '#e48ab8', 4);
  placa(g, 140, 188, 176, 36, 'Pet Shop', { fundo: '#fff4f8', borda: '#e05a8a', cor: '#c25a8a', fonte: '700 19px "Cinzel", Georgia, serif' });
  for (const x of [66, 214]) pegada(g, x, 188, '#e05a8a', 0.7);
  for (let k = 0; k < 11; k++) forma(g, k % 2 ? '#ffffff' : '#e05a8a', [36 + k * 19.5, 226, 55.5 + k * 19.5, 226, 54 + k * 19.5, 248, 38 + k * 19.5, 248]);
  for (const x of [40, 178]) {
    ret(g, x, 262, 62, 76, '#8a4a6a', 4);
    ret(g, x + 4, 266, 54, 68, '#fff1d8', 3);
  }
  pompomCorpo(g, 62, 332, 11, CORES_POMPOM.azul, 0);
  pompomCorpo(g, 84, 332, 9, CORES_POMPOM.amarelo, 0);
  pompomCorpo(g, 208, 332, 12, CORES_POMPOM.verde, 0);
  ret(g, 112, 278, 56, 92, '#8a4a6a', 26);
  ret(g, 118, 284, 44, 86, '#b56a8e', 22);
  el(g, 140, 306, 12, 12, '#fff1d8');
  el(g, 156, 334, 3, 3, '#e8c24a');
}
function pegada(g, x, y, cor, k = 1) {
  el(g, x, y + 3 * k, 6 * k, 5 * k, cor);
  for (const [dx, dy] of [[-6, -4], [-2, -8], [3, -8], [7, -4]]) el(g, x + dx * k, y + dy * k, 2.2 * k, 2.6 * k, cor);
}
function fachadaPizzaria(g) {
  ret(g, 436, 76, 28, 64, '#7a2f2a');
  ret(g, 432, 72, 36, 8, '#5a201c', 2);
  ret(g, 265, 130, 220, 240, '#b5523a');
  for (let y = 134; y < 370; y += 12) for (let x = 265 + ((y / 12) % 2) * 12; x < 485; x += 24) ret(g, x + 1, y + 1, 22, 10, (x + y) % 3 ? '#b5523a' : '#a8462f');
  ret(g, 258, 122, 234, 14, '#7a2f2a', 3);
  const cores = ['#2f8a3c', '#f4efe2', '#c0392b'];
  for (let k = 0; k < 12; k++) forma(g, cores[k % 3], [270 + k * 17.5, 222, 287.5 + k * 17.5, 222, 286 + k * 17.5, 246, 272 + k * 17.5, 246]);
  // A placa: uma fatia de pizza gigante
  forma(g, '#e0a050', [320, 150, 430, 150, 375, 214]);
  forma(g, '#f4d35e', [330, 158, 420, 158, 375, 206]);
  for (const [x, y] of [[355, 168], [392, 166], [375, 186], [362, 180]]) el(g, x, y, 5, 4, '#c0392b');
  ret(g, 316, 144, 118, 12, '#c0703a', 6);
  placa(g, 375, 140, 150, 28, 'Pizzaria', { fundo: '#2f8a3c', borda: '#1f5a28', cor: '#fbf3e0', fonte: '700 16px "Cinzel", Georgia, serif' });
  for (const x of [278, 412]) {
    ret(g, x, 262, 60, 70, '#5b2a1c', 4);
    ret(g, x + 4, 266, 52, 62, '#ffd890', 3);
    ret(g, x + 4, 296, 52, 3, '#5b2a1c');
  }
  ret(g, 347, 280, 56, 90, '#5b3c22', 4);
  ret(g, 352, 286, 46, 84, '#7a5434', 3);
  el(g, 375, 306, 11, 11, '#ffd890');
  el(g, 392, 334, 3, 3, '#e8c24a');
}
function fachadaTeatro(g) {
  ret(g, 500, 120, 240, 250, '#7a2f3a');
  forma(g, '#d8c8a8', [488, 124, 752, 124, 620, 58]);
  forma(g, '#b8a888', [512, 118, 728, 118, 620, 72]);
  el(g, 620, 100, 12, 10, '#e8c24a');
  ret(g, 494, 118, 252, 10, '#e9dcc3', 2);
  for (const x of [506, 548, 678, 720]) {
    ret(g, x, 150, 16, 220, '#e9dcc3');
    ret(g, x - 3, 146, 22, 8, '#d8c8a8', 2);
    for (let k = 0; k < 3; k++) ret(g, x + 3 + k * 4, 156, 1.5, 210, 'rgba(0,0,0,0.08)');
  }
  ret(g, 560, 150, 120, 56, '#2a1d12', 6);
  for (const [x, cena] of [[530, 0], [700, 1]]) {
    ret(g, x - 18, 228, 36, 52, '#e8c24a', 2);
    ret(g, x - 15, 231, 30, 46, cena ? '#2a3a6a' : '#e8a070', 1);
    if (cena) { ret(g, x - 8, 254, 16, 20, '#9aa3ad'); forma(g, '#9aa3ad', [x - 9, 254, x - 5, 248, x - 1, 254]); forma(g, '#9aa3ad', [x + 1, 254, x + 5, 248, x + 9, 254]); el(g, x + 7, 238, 4, 4, '#fff4c2'); }
    else { ret(g, x - 15, 262, 30, 15, '#3a6a9a'); forma(g, '#5b3c22', [x - 8, 262, x + 8, 262, x + 5, 268, x - 5, 268]); forma(g, '#fbf3e0', [x, 262, x, 246, x + 8, 260]); }
  }
  ret(g, 586, 282, 68, 88, '#4a1420', 4);
  ret(g, 590, 286, 29, 84, '#8a2f3a', 3);
  ret(g, 621, 286, 29, 84, '#8a2f3a', 3);
  el(g, 614, 330, 2.5, 2.5, '#e8c24a');
  el(g, 626, 330, 2.5, 2.5, '#e8c24a');
  ret(g, 568, 362, 104, 8, '#c9c0b0', 2);
}
function fachadaHotel(g) {
  ret(g, 755, 20, 230, 350, '#46648f');
  ret(g, 748, 14, 244, 12, '#2f4466', 3);
  for (let y = 26; y < 270; y += 2) if (y % 48 === 0) ret(g, 755, y, 230, 3, 'rgba(0,0,0,0.15)');
  for (let c = 0; c < 4; c++) for (let l = 0; l < 5; l++) {
    const x = 772 + c * 54;
    const y = 40 + l * 46;
    ret(g, x, y, 32, 30, '#2f4466', 3);
    ret(g, x + 3, y + 3, 26, 24, '#1a2640', 2);
    ret(g, x - 2, y + 30, 36, 4, '#e9dcc3', 2);
  }
  placa(g, 870, 276, 196, 30, 'Hotel dos Pompons', { fundo: '#e8c24a', borda: '#8a6a20', cor: '#2f4466', fonte: '700 15px "Cinzel", Georgia, serif' });
  forma(g, '#8a2f3a', [818, 300, 922, 300, 934, 318, 806, 318]);
  for (let k = 0; k < 6; k++) el(g, 820 + k * 20, 318, 10, 4, '#8a2f3a');
  ret(g, 834, 318, 72, 52, '#24344f', 4);
  ret(g, 840, 322, 28, 48, 'rgba(160,210,240,0.45)', 2);
  ret(g, 872, 322, 28, 48, 'rgba(160,210,240,0.35)', 2);
  ret(g, 868, 318, 4, 52, '#e8c24a');
}
function animarPlaza(g, t) {
  for (let k = 0; k < 20; k++) {
    const x = 566 + (k % 10) * 12;
    const y = k < 10 ? 154 : 202;
    el(g, x, y, 2.6, 2.6, (Math.floor(t * 5) + k) % 4 === 0 ? '#fff4b0' : '#b88a30');
  }
  for (const y of [166, 190]) for (const x of [564, 676]) el(g, x, y, 2.6, 2.6, (Math.floor(t * 5) + y) % 3 === 0 ? '#fff4b0' : '#b88a30');
  texto(g, 'TEATRO', 620, 178, { cor: '#ffe9a0', fonte: '700 22px "Cinzel", Georgia, serif', sombra: 'rgba(255,200,80,0.6)' });
  brilho(g, 620, 178, 90, 'rgba(255,220,120,A)', 0.14 + Math.sin(t * 4) * 0.04);
  // As janelas do hotel acendem e apagam devagar
  for (let c = 0; c < 4; c++) for (let l = 0; l < 5; l++) {
    const fase = Math.sin(t * 0.25 + c * 1.7 + l * 2.3);
    if (fase > -0.2) { ret(g, 775 + c * 54, 43 + l * 46, 26, 24, `rgba(255,214,140,${0.55 + fase * 0.3})`, 2); brilho(g, 788 + c * 54, 55 + l * 46, 24, 'rgba(255,214,140,A)', 0.12); }
  }
  for (const x of [282, 416]) brilho(g, x + 26, 297, 46, 'rgba(255,200,120,A)', 0.2 + Math.sin(t * 3 + x) * 0.04);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.22 + k / 3) % 1;
    el(g, 450 + Math.sin(f * 6 + k) * 8, 70 - f * 60, 6 + f * 12, 5 + f * 9, `rgba(230,230,240,${0.4 * (1 - f)})`);
  }
  // Um pompom espia pela vitrine do Pet Shop
  const espia = pular(t, 0, 10, 2.2);
  noRetangulo(g, 182, 266, 54, 68, () => pompomCorpo(g, 220, 340 - espia, 9, CORES_POMPOM.rosa, t));
  for (const [x, y] of [[90, 30], [700, 40], [520, 22]]) el(g, x, y, 1.4 + Math.sin(t * 3 + x) * 0.6, 1.4 + Math.sin(t * 3 + x) * 0.6, '#ffffff');
}

/* ─── Pet Shop dos Pompons ─── */

const GAIOLAS = [[40, 92], [128, 92], [216, 92], [40, 196], [128, 196], [216, 196]];

function fundoPetshop(g) {
  g.fillStyle = '#d4efe4';
  g.fillRect(0, 0, W, 360);
  for (let y = 30; y < 290; y += 60) for (let x = 20 + ((y / 60) % 2) * 40; x < W; x += 80) pegada(g, x, y, 'rgba(120,180,160,0.25)', 0.8);
  ret(g, 0, 296, W, 64, '#f7c6d9');
  ret(g, 0, 292, W, 6, '#ffffff');
  for (let x = 20; x < W; x += 50) ret(g, x, 306, 30, 44, 'rgba(255,255,255,0.25)', 4);
  chaoXadrez(g, 360, H, '#f7e3ec', '#fdf3f7');
  if (!sp(g, 'gaiolas', 'parado', 170, 302, { quadro: 0 })) gaiolasFundo(g);
  if (!sp(g, 'cartaz-pompom', 'parado', 370, 152, { quadro: 0 })) cartazPompom(g);
  placa(g, 600, 52, 330, 44, 'Pet Shop dos Pompons', { fundo: '#fff4f8', borda: '#e05a8a', cor: '#c25a8a', fonte: '700 21px "Cinzel", Georgia, serif' });
  // Prateleiras com biscoitos e brinquedos
  for (const y of [150, 236]) {
    ret(g, 470, y, 260, 8, '#c08a50', 2);
    for (let k = 0; k < 6; k++) {
      const x = 482 + k * 42;
      if ((k + y) % 3 === 0) { el(g, x + 14, y - 12, 12, 12, CORES[(k + 3) % 8]); linha(g, '#ffffff', 2, [x + 4, y - 12, x + 24, y - 12]); continue; }
      ret(g, x, y - 34, 30, 34, CORES[(k * 3 + y) % 8], 5);
      ret(g, x + 4, y - 26, 22, 12, '#fff8f0', 3);
      el(g, x + 15, y - 20, 4, 4, CORES[(k + 1) % 8]);
    }
  }
  placa(g, 830, 110, 200, 34, 'Adote um Pompom!', { fundo: '#e05a8a', borda: '#a83a68', cor: '#fff4f8', fonte: '700 15px "Cinzel", Georgia, serif' });
  el(g, 830, 150, 10, 9, '#e05a8a'); el(g, 820, 146, 7, 7, '#e05a8a'); el(g, 840, 146, 7, 7, '#e05a8a');
  forma(g, '#e05a8a', [814, 148, 846, 148, 830, 164]);
  tapete(g, 'Saída', '#c25a8a');
}
function gaiolasFundo(g) {
  ret(g, 32, 84, 276, 218, '#c08a50', 6);
  for (const [x, y] of GAIOLAS) {
    ret(g, x, y, 80, 96, '#fdf0dc', 4);
    ret(g, x, y + 78, 80, 18, '#e8c86a', 3);
    for (let k = 0; k < 7; k++) linha(g, '#d8b050', 1.5, [x + 6 + k * 11, y + 82, x + 10 + k * 11, y + 92]);
  }
}
function cartazPompom(g) {
  g.save();
  g.translate(370, 152);
  g.rotate(0.09);
  ret(g, -40, -64, 84, 132, 'rgba(0,0,0,0.25)', 3);
  ret(g, -44, -68, 84, 132, '#fff8e8', 3);
  g.strokeStyle = '#e05a8a'; g.lineWidth = 3; g.strokeRect?.(-40, -64, 76, 124);
  texto(g, 'Pompom', -2, -50, { cor: '#c25a8a', fonte: '700 12px "Cinzel", Georgia, serif' });
  texto(g, 'do Mês', -2, -36, { cor: '#c25a8a', fonte: '700 12px "Cinzel", Georgia, serif' });
  pompomCorpo(g, -2, 30, 26, CORES_POMPOM.roxo, 0);
  forma(g, '#e8c24a', [-16, 40, 12, 40, 6, 54, -10, 54]);
  el(g, 36, -60, 3, 3, '#9aa3ad');
  g.restore();
}
function animarPetshop(g, t) {
  GAIOLAS.forEach(([x, y], k) => {
    const cor = CORES[k + 1];
    pompomCorpo(g, x + 40 + Math.sin(t * 0.8 + k * 2) * 14, y + 82 - pular(t, k * 0.9, 16, 3 + k * 0.3), 15, cor, t + k);
  });
  for (const [x, y] of GAIOLAS) {
    for (let k = 1; k < 8; k++) ret(g, x + k * 10, y, 2, 96, 'rgba(160,160,170,0.85)');
    ret(g, x, y, 80, 3, '#a0a0aa');
    ret(g, x, y + 93, 80, 3, '#a0a0aa');
  }
}
function cercadinho(g, parte, t) {
  if (parte === 'fundo') {
    if (!sp(g, 'cercadinho-fundo', 'parado', 470, 426, { t })) cercaFundoCorpo(g);
  } else if (!sp(g, 'cercadinho-frente', 'parado', 470, 548, { t })) cercaFrenteCorpo(g);
}
function cercaFundoCorpo(g) {
  forma(g, '#bfe6d6', [320, 426, 620, 426, 650, 540, 290, 540]);
  for (let k = 0; k < 14; k++) {
    const x = 322 + k * 22.6;
    ret(g, x - 4, 394, 8, 32, ['#f7c6d9', '#fff4f8', '#b8e0f0'][k % 3], 3);
  }
  ret(g, 318, 402, 304, 5, '#e05a8a', 2);
  for (const [x0, x1] of [[320, 290], [620, 650]]) {
    for (let k = 0; k <= 4; k++) { const f = k / 4; ret(g, x0 + (x1 - x0) * f - 4, 394 + f * 114, 8, 32, '#fff4f8', 3); }
    linha(g, '#e05a8a', 4, [x0, 404, x1, 518]);
  }
  el(g, 400, 470, 9, 9, '#e05a5a');
  linha(g, '#ffffff', 2, [392, 470, 408, 470]);
}
function cercaFrenteCorpo(g) {
  for (let k = 0; k < 16; k++) {
    const x = 292 + k * 23.8;
    ret(g, x - 5, 506, 10, 40, ['#f7c6d9', '#fff4f8', '#b8e0f0'][k % 3], 3);
    el(g, x, 507, 5, 4, ['#f7c6d9', '#fff4f8', '#b8e0f0'][k % 3]);
  }
  ret(g, 288, 518, 364, 6, '#e05a8a', 2);
}
function pomponsNoCercado(g, t) {
  for (let k = 0; k < 5; k++) {
    const x = 470 + Math.sin(t * 0.45 + k * 1.7) * 130;
    const y = 470 + Math.cos(t * 0.38 + k * 2.1) * 30 + k * 6;
    pompom(g, x, y, 14 - (k % 2) * 3, CORES[(k * 3) % 8], t + k, pular(t, k, 14, 3.5));
  }
}
function balcaoPetshop(g, t) {
  npc(g, 'npc-tratadora', 830, 300, t, -1);
  if (!sp(g, 'balcao-petshop', 'parado', 820, 386, { t })) balcaoPetshopCorpo(g);
}
function balcaoPetshopCorpo(g) {
  ret(g, 690, 300, 260, 22, '#f2a7c8', 5);
  ret(g, 696, 322, 248, 64, '#e48ab8', 3);
  for (let x = 712; x < 930; x += 46) ret(g, x, 332, 34, 44, '#f7c6d9', 4);
  ret(g, 880, 268, 50, 34, '#9aa3ad', 5);
  ret(g, 886, 274, 38, 12, '#2a3a2e', 2);
  ret(g, 720, 276, 30, 26, 'rgba(220,240,255,0.6)', 6);
  for (let k = 0; k < 4; k++) el(g, 728 + (k % 2) * 12, 292 - Math.floor(k / 2) * 8, 4, 3, '#c08a50');
}
function caixaRoxa(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 46, 12);
  const f = t % 4;
  const rot = f < 0.6 ? Math.sin(f * 40) * 0.07 : 0;
  if (!sp(g, 'caixa-roxa', 'balancando', x, y, { t, rot })) caixaRoxaCorpo(g, x, y, rot);
  for (let k = 0; k < 4; k++) {
    const a = t * 1.5 + k * 1.6;
    const r = 50 + Math.sin(t * 2 + k) * 8;
    const s = 2 + Math.sin(t * 6 + k * 2) * 1.5;
    if (s > 1) { el(g, x + Math.cos(a) * r, y - 40 + Math.sin(a) * r * 0.6, s, s * 2.4, 'rgba(210,150,255,0.8)'); el(g, x + Math.cos(a) * r, y - 40 + Math.sin(a) * r * 0.6, s * 2.4, s, 'rgba(210,150,255,0.8)'); }
  }
}
function caixaRoxaCorpo(g, x, y, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  ret(g, -40, -66, 80, 66, '#6a3a9a', 4);
  ret(g, -40, -66, 80, 66, 'rgba(255,255,255,0.0)');
  forma(g, '#8a5ac0', [-40, -66, 40, -66, 30, -80, -50, -80]);
  forma(g, '#4e2a74', [40, -66, 40, 0, 50, -12, 50, -80, 30, -80]);
  ret(g, -40, -40, 80, 8, '#4e2a74');
  texto(g, '?', 0, -18, { cor: '#e8d0ff', fonte: '700 22px sans-serif' });
  g.restore();
}

/* ─── Pizzaria ─── */

const pianoEstado = { ate: 0 };
export const tocouPiano = () => { pianoEstado.ate = Date.now() + 2500; };

function fundoPizzaria(g) {
  g.fillStyle = '#9a4a3a';
  g.fillRect(0, 0, W, 340);
  for (let y = 0; y < 280; y += 20) for (let x = ((y / 20) % 2) * -22; x < W; x += 44) ret(g, x + 1.5, y + 1.5, 41, 17, (x + y) % 3 ? '#b5523a' : '#a8462f', 2);
  ret(g, 0, 276, W, 64, '#2f5a3a');
  for (let x = 10; x < W; x += 60) ret(g, x, 286, 48, 46, '#3a6a48', 3);
  ret(g, 0, 272, W, 6, '#e9dcc3');
  chaoXadrez(g, 340, H, '#2a2a2a', '#efe6d4');
  if (!sp(g, 'forno', 'parado', 170, 340, { quadro: 0 })) forno(g);
  // O quadro do cardápio
  ret(g, 330, 60, 190, 150, '#2b3a2e', 6);
  g.strokeStyle = '#7a5434'; g.lineWidth = 6; g.strokeRect?.(330, 60, 190, 150);
  texto(g, 'Cardápio', 425, 86, { cor: '#f4e9c8', fonte: '700 19px "Cinzel", Georgia, serif' });
  ['Pizza de Cenoura', 'Pizza de Trevo', 'Pizza de Mel', 'Suco de Cenoura'].forEach((l, k) => texto(g, l, 425, 116 + k * 22, { cor: '#e8e2d0', fonte: '15px "EB Garamond", Georgia, serif' }));
  if (!sp(g, 'porta-cozinha', 'parado', 780, 340, { quadro: 0 })) portaCozinha(g);
  tapete(g, 'Saída', '#2f8a3c');
}
function forno(g) {
  ret(g, 150, 0, 40, 96, '#6a6a72');
  ret(g, 146, 88, 48, 10, '#55555e', 2);
  el(g, 170, 210, 124, 120, '#a85a30');
  for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(70,30,15,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(170, 210, 124 - k * 4, 120 - k * 16, 0, Math.PI, 0); g.stroke(); }
  ret(g, 46, 210, 248, 130, '#b5523a', 4);
  for (let y = 214; y < 340; y += 14) for (let x = 50 + ((y / 14) % 2) * 14; x < 290; x += 28) ret(g, x, y, 26, 12, (x + y) % 3 ? '#a8462f' : '#c0603e', 2);
  el(g, 170, 248, 66, 46, '#2a120a');
  ret(g, 104, 248, 132, 60, '#2a120a');
  ret(g, 96, 306, 148, 12, '#8a3a2a', 3);
  for (const [dx, rot] of [[-20, 0.3], [20, -0.3]]) { g.save(); g.translate(170 + dx, 300); g.rotate(rot); ret(g, -28, -5, 56, 10, '#5b3c22', 3); g.restore(); }
  // A pá de pizza encostada
  g.save(); g.translate(290, 330); g.rotate(-0.25);
  ret(g, -4, -170, 8, 120, '#c08a50', 3);
  el(g, 0, -40, 26, 34, '#d8a868');
  g.restore();
}
function portaCozinha(g) {
  placa(g, 780, 140, 196, 30, 'Fábrica de Pizzas', { fundo: '#c0392b', borda: '#7a1f1a', cor: '#fff4c2', fonte: '700 14px "Cinzel", Georgia, serif' });
  ret(g, 716, 166, 128, 174, '#3a2414', 6);
  ret(g, 724, 174, 54, 166, '#8a5a32', 3);
  ret(g, 782, 174, 54, 166, '#8a5a32', 3);
  for (const x of [751, 809]) { el(g, x, 216, 16, 16, '#5b3c22'); el(g, x, 216, 12, 12, '#ffe9a8'); ret(g, x - 14, 290, 28, 6, '#c9cdd4', 2); }
}
function animarPizzaria(g, t) {
  const tremor = k => Math.sin(t * 11 + k) * 3;
  for (let k = 0; k < 3; k++) el(g, 140 + k * 30 + tremor(k), 290, 18, 22 + tremor(k + 2), k % 2 ? '#f4b03a' : '#e0682a');
  el(g, 170, 298, 30, 8, '#fff1a8');
  brilho(g, 170, 280, 150, 'rgba(255,140,60,A)', 0.28 + Math.sin(t * 8) * 0.05);
  for (const x of [751, 809]) brilho(g, x, 216, 24, 'rgba(255,220,140,A)', 0.3 + Math.sin(t * 5 + x) * 0.1);
  for (const x of [190, 560, 840]) {
    linha(g, '#2a1a10', 2, [x, 0, x, 50]);
    forma(g, '#2f8a3c', [x - 26, 72, x + 26, 72, x + 12, 48, x - 12, 48]);
    el(g, x, 74, 8, 4, '#fff4c2');
    brilho(g, x, 80, 110, 'rgba(255,220,150,A)', 0.18);
  }
  if (Date.now() < pianoEstado.ate) {
    for (let k = 0; k < 3; k++) {
      const f = (t * 0.8 + k / 3) % 1;
      texto(g, k % 2 ? '♪' : '♫', 900 + Math.sin(f * 6 + k) * 16, 230 - f * 80, { cor: `rgba(255,230,140,${1 - f})`, fonte: '700 20px serif' });
    }
  }
}
function balcaoPizzaria(g, t) {
  npc(g, 'npc-pizzaiolo', 470, 296, t, 1);
  if (!sp(g, 'balcao-pizzaria', 'parado', 470, 384, { t })) balcaoPizzariaCorpo(g);
  for (let k = 0; k < 2; k++) {
    const f = (t * 0.5 + k * 0.5) % 1;
    el(g, 560 + k * 10 + Math.sin(f * 6) * 4, 280 - f * 30, 3 + f * 5, 3 + f * 5, `rgba(255,255,255,${0.4 * (1 - f)})`);
  }
}
function balcaoPizzariaCorpo(g) {
  ret(g, 340, 300, 270, 22, '#e9dcc3', 4);
  ret(g, 346, 322, 258, 62, '#2f5a3a', 2);
  for (let x = 360; x < 600; x += 48) ret(g, x, 332, 36, 42, '#3a6a48', 3);
  ret(g, 548, 284, 6, 16, '#c9cdd4');
  el(g, 564, 284, 34, 9, '#c9cdd4');
  el(g, 564, 281, 30, 8, '#e0a050');
  el(g, 564, 280, 26, 6, '#f4d35e');
  for (const [dx, dy] of [[-10, 0], [8, -1], [0, 2], [14, 1]]) el(g, 564 + dx, 280 + dy, 3, 2, '#e07a2a');
  ret(g, 370, 280, 40, 22, '#b8922a', 4);
}
function mesaPizzaria(g, x, y) {
  sombraNoChao(g, x, y + 2, 56);
  if (!sp(g, 'mesa-pizzaria', 'parado', x, y)) mesaPizzariaCorpo(g, x, y);
}
function mesaPizzariaCorpo(g, x, y) {
  for (const dx of [-58, 58]) {
    ret(g, x + dx - 14, y - 26, 28, 8, '#5b3c22', 3);
    ret(g, x + dx - 12, y - 56, 24, 32, '#7a4a2a', 4);
    ret(g, x + dx - 10, y - 20, 4, 20, '#3a2414'); ret(g, x + dx + 6, y - 20, 4, 20, '#3a2414');
  }
  ret(g, x - 4, y - 42, 8, 42, '#3a2414');
  g.save();
  g.beginPath(); g.ellipse(x, y - 48, 46, 14, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#f4efe2'; g.fillRect(x - 46, y - 62, 92, 28);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) ret(g, x - 46 + i * 11.5, y - 62 + j * 9.3, 11.5, 9.3, '#c0392b');
  g.restore();
  forma(g, '#c0392b', [x - 46, y - 48, x + 46, y - 48, x + 42, y - 34, x - 42, y - 34]);
  el(g, x - 8, y - 50, 14, 5, '#e0a050');
  el(g, x - 8, y - 51, 11, 4, '#f4d35e');
  el(g, x + 20, y - 50, 4, 7, 'rgba(255,160,60,0.8)');
}
function piano(g, x, y) {
  sombraNoChao(g, x, y + 2, 64, 12);
  if (!sp(g, 'piano', 'parado', x, y)) pianoCorpo(g, x, y);
}
function pianoCorpo(g, x, y) {
  ret(g, x - 62, y - 150, 124, 150, '#2a1a14', 5);
  ret(g, x - 56, y - 142, 112, 54, '#3a241a', 3);
  ret(g, x - 66, y - 84, 132, 12, '#3a241a', 3);
  ret(g, x - 60, y - 74, 120, 14, '#f7f3ea');
  for (let k = 0; k < 12; k++) if (k % 7 !== 2 && k % 7 !== 6) ret(g, x - 56 + k * 10, y - 74, 5, 8, '#111');
  for (let k = 0; k < 13; k++) ret(g, x - 60 + k * 9.3, y - 74, 0.8, 14, 'rgba(0,0,0,0.25)');
  ret(g, x - 56, y - 60, 6, 60, '#2a1a14');
  ret(g, x + 50, y - 60, 6, 60, '#2a1a14');
  ret(g, x - 30, y - 168, 60, 18, '#f2e8cf', 2);
  for (let k = 0; k < 3; k++) linha(g, 'rgba(60,40,20,0.5)', 1, [x - 26, y - 162 + k * 5, x + 26, y - 162 + k * 5]);
  ret(g, x + 40, y - 172, 6, 22, '#b8922a');
  el(g, x + 43, y - 176, 2.5, 4, '#ffd060');
}

/* ─── Teatro ─── */

export const CENARIOS = [
  { id: 'pirata', nome: 'Mar dos Piratas' },
  { id: 'castelo', nome: 'Castelo Encantado' },
  { id: 'espaco', nome: 'Espaço Sideral' },
  { id: 'floresta', nome: 'Floresta Encantada' },
];
// O cenário que está no palco (troca para quem está vendo; no começo de cada dia, cada cenário tem a sua vez).
const teatro = { cenario: Math.floor(Date.now() / 86_400_000) % CENARIOS.length, antes: 0, trocou: 0 };
export function trocarCenario() {
  teatro.antes = teatro.cenario;
  teatro.cenario = (teatro.cenario + 1) % CENARIOS.length;
  teatro.trocou = Date.now();
  return CENARIOS[teatro.cenario];
}
export const cenarioAtual = () => CENARIOS[teatro.cenario];

function fundoTeatro(g) {
  g.fillStyle = '#3a0f18';
  g.fillRect(0, 0, W, 430);
  for (let x = 0; x < W; x += 50) ret(g, x + 4, 0, 42, 430, 'rgba(0,0,0,0.15)', 4);
  for (const x of [36, 964]) { ret(g, x - 6, 200, 12, 30, '#b8922a', 3); el(g, x, 196, 7, 9, '#ffd890'); }
  g.fillStyle = '#5a1a24';
  g.fillRect(0, 430, W, H - 430);
  const rnd = sorte(12);
  for (let k = 0; k < 90; k++) el(g, rnd() * W, 436 + rnd() * 160, 3, 1.5, 'rgba(232,194,74,0.15)');
  forma(g, '#7a2a34', [440, 430, 560, 430, 600, H, 400, H]);
  forma(g, '#8a5a32', [116, 300, 884, 300, 940, 432, 60, 432]);
  for (let k = 1; k < 12; k++) linha(g, 'rgba(60,35,15,0.35)', 1.5, [116 + k * 64, 300, 60 + k * 73.3, 432]);
  ret(g, 56, 430, 888, 16, '#4a2e18', 3);
  ret(g, 56, 430, 888, 4, '#b8922a');
  if (!sp(g, 'palco', 'parado', 500, 446, { quadro: 0 })) moldura(g);
  tapete(g, 'Saída', '#8a2f3a');
}
function moldura(g) {
  for (const x of [66, 884]) {
    ret(g, x, 18, 50, 416, '#b8922a', 4);
    ret(g, x + 8, 26, 34, 400, '#d8b13a', 3);
    for (let y = 60; y < 420; y += 48) el(g, x + 25, y, 6, 6, '#8a6a20');
  }
  ret(g, 66, 18, 868, 54, '#b8922a', 4);
  ret(g, 74, 26, 852, 38, '#d8b13a', 3);
  for (let x = 110; x < 900; x += 40) el(g, x, 45, 5, 5, '#8a6a20');
  el(g, 500, 46, 40, 30, '#b8922a');
  // As máscaras do teatro (alegria e tristeza)
  for (const [dx, triste] of [[-14, false], [14, true]]) {
    el(g, 500 + dx, 44, 14, 17, '#fbf3e0');
    el(g, 500 + dx - 5, 40, 3, 2.4, '#3a1f12');
    el(g, 500 + dx + 5, 40, 3, 2.4, '#3a1f12');
    g.strokeStyle = '#3a1f12'; g.lineWidth = 2;
    g.beginPath();
    if (triste) g.arc(500 + dx, 58, 6, 1.2 * Math.PI, 1.8 * Math.PI); else g.arc(500 + dx, 48, 6, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  }
}
function pintarCenario(g, n, t) {
  const id = CENARIOS[n].id;
  const [x0, y0, w, hh] = [116, 72, 768, 228];
  noRetangulo(g, x0, y0, w, hh, () => {
    if (id === 'pirata') {
      g.fillStyle = grad(g, 0, y0, 0, y0 + hh, [[0, '#f7a072'], [0.6, '#ffd59a'], [1, '#ffe9c4']]);
      g.fillRect(x0, y0, w, hh);
      el(g, 640, 200, 40, 40, '#fff0c0');
      g.fillStyle = grad(g, 0, 210, 0, 300, [[0, '#3d8ab8'], [1, '#1d5a80']]);
      g.fillRect(x0, 210, w, 90);
      for (let k = 0; k < 14; k++) ret(g, x0 + ((k * 73 + t * 20) % w), 222 + (k % 4) * 18, 40, 2.5, 'rgba(255,255,255,0.35)', 1);
      el(g, 240, 236, 110, 26, '#e8d090');
      linha(g, '#7a5434', 6, [240, 230, 252, 150]);
      for (let k = 0; k < 5; k++) el(g, 252 + Math.cos(k * 1.3) * 26, 150 + Math.sin(k * 1.3) * 8, 30, 8, '#3a8a3c', k * 1.3);
      const by = Math.sin(t * 1.5) * 4;
      g.save(); g.translate(640, 232 + by); g.rotate(Math.sin(t * 1.5) * 0.04);
      forma(g, '#5b3c22', [-90, -10, 90, -10, 64, 22, -64, 22]);
      ret(g, -90, -16, 180, 8, '#3a2414');
      linha(g, '#3a2414', 5, [0, -16, 0, -130]);
      linha(g, '#3a2414', 4, [-50, -16, -50, -96]);
      forma(g, '#fbf3e0', [6, -124, 6, -40, 70, -48]);
      forma(g, '#fbf3e0', [-44, -92, -44, -34, 4, -40]);
      forma(g, '#1b1b1b', [0, -132, 30, -128, 0, -114]);
      el(g, 12, -124, 3, 3, '#ffffff');
      g.restore();
      for (let k = 0; k < 2; k++) { const gx = 300 + ((t * 30 + k * 200) % 500); linha(g, '#3a3a3a', 2, [gx - 8, 120 + k * 20, gx, 124 + k * 20, gx + 8, 120 + k * 20]); }
    } else if (id === 'castelo') {
      g.fillStyle = grad(g, 0, y0, 0, y0 + hh, [[0, '#0e1636'], [1, '#3a3a7a']]);
      g.fillRect(x0, y0, w, hh);
      const rnd = sorte(5);
      for (let k = 0; k < 40; k++) el(g, x0 + rnd() * w, y0 + rnd() * 120, 1.2, 1.2, `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 2 + k)})`);
      el(g, 240, 120, 30, 30, '#fff4c2');
      el(g, 252, 114, 26, 26, '#18204a');
      el(g, 300, 330, 300, 90, '#1f3a2a');
      el(g, 720, 330, 320, 100, '#24432f');
      const cx = 540;
      ret(g, cx - 110, 170, 220, 130, '#8a8aa0');
      for (const dx of [-130, -40, 40, 130]) {
        const alto = Math.abs(dx) > 100 ? 120 : 160;
        ret(g, cx + dx - 22, 300 - alto, 44, alto, '#9a9ab0');
        forma(g, '#5a3a8a', [cx + dx - 28, 300 - alto, cx + dx + 28, 300 - alto, cx + dx, 300 - alto - 46]);
        linha(g, '#3a3a3a', 2, [cx + dx, 300 - alto - 46, cx + dx, 300 - alto - 70]);
        const o = Math.sin(t * 3 + dx) * 4;
        forma(g, '#e05a5a', [cx + dx, 300 - alto - 70, cx + dx + 20, 300 - alto - 64 + o, cx + dx, 300 - alto - 58]);
        ret(g, cx + dx - 6, 300 - alto + 30, 12, 18, '#ffd890', 6);
      }
      ret(g, cx - 24, 240, 48, 60, '#3a2a1a', 22);
      for (let k = 0; k < 9; k++) ret(g, cx - 110 + k * 26, 160, 16, 12, '#8a8aa0');
    } else if (id === 'espaco') {
      g.fillStyle = grad(g, 0, y0, 0, y0 + hh, [[0, '#05020f'], [1, '#2a1048']]);
      g.fillRect(x0, y0, w, hh);
      const rnd = sorte(9);
      for (let k = 0; k < 80; k++) { const s = 0.8 + rnd() * 1.4; el(g, x0 + rnd() * w, y0 + rnd() * hh, s, s, `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t * (1 + k % 3) + k))})`); }
      el(g, 300, 180, 58, 58, '#e8a040');
      el(g, 286, 166, 20, 12, 'rgba(255,255,255,0.25)');
      g.strokeStyle = '#f4dd80'; g.lineWidth = 6;
      g.beginPath(); g.ellipse(300, 180, 100, 20, -0.25, 0, Math.PI * 2); g.stroke();
      el(g, 420, 110, 14, 14, '#c8ccd4');
      const rx = 560 + ((t * 40) % 420);
      g.save(); g.translate(rx, 220 - ((t * 40) % 420) * 0.25); g.rotate(-0.25);
      ret(g, -30, -10, 60, 20, '#f7f3ea', 10);
      forma(g, '#e05a5a', [30, -10, 48, 0, 30, 10]);
      forma(g, '#e05a5a', [-24, -10, -36, -22, -30, -10]);
      forma(g, '#e05a5a', [-24, 10, -36, 22, -30, 10]);
      el(g, 6, 0, 6, 6, '#6fb6f0');
      el(g, -40, 0, 10 + Math.sin(t * 30) * 3, 6, '#ffb040');
      g.restore();
      const f = (t * 0.2) % 1;
      linha(g, 'rgba(255,255,255,0.6)', 2, [820 - f * 300, 90 + f * 60, 860 - f * 300, 80 + f * 60]);
    } else {
      g.fillStyle = grad(g, 0, y0, 0, y0 + hh, [[0, '#1f1440'], [0.6, '#2a4a5a'], [1, '#1f3a2a']]);
      g.fillRect(x0, y0, w, hh);
      el(g, 700, 120, 34, 34, '#f4f0d0');
      brilho(g, 700, 120, 90, 'rgba(240,240,200,A)', 0.3);
      for (const [x, r] of [[160, 26], [280, 34], [420, 22], [560, 30], [820, 36]]) {
        ret(g, x - r * 0.25, 160, r * 0.5, 140, '#2a1a24');
        el(g, x, 150, r * 2, r * 1.6, '#24402e');
        el(g, x - r * 0.6, 136, r, r * 0.8, '#2f5238');
      }
      for (const [x, s, cor] of [[230, 1, '#e05a8a'], [480, 1.3, '#6be0ff'], [700, 0.9, '#b07ee8'], [360, 0.7, '#ffe46b']]) {
        ret(g, x - 5 * s, 270, 10 * s, 30, '#f2e8cf', 3);
        el(g, x, 270, 22 * s, 14 * s, cor);
        brilho(g, x, 268, 50 * s, 'rgba(200,255,240,A)', 0.25 + Math.sin(t * 2 + x) * 0.1);
        el(g, x - 8 * s, 266, 3, 2, '#ffffff'); el(g, x + 6 * s, 264, 2.5, 2, '#ffffff');
      }
      for (let k = 0; k < 14; k++) {
        const fx = 140 + ((k * 61 + Math.sin(t * 0.7 + k) * 40) % 720);
        const fy = 140 + Math.sin(t * 1.3 + k * 2) * 50 + (k % 4) * 20;
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + k));
        el(g, fx, fy, 2.4, 2.4, `rgba(230,255,140,${a})`);
        brilho(g, fx, fy, 10, 'rgba(230,255,140,A)', a * 0.5);
      }
    }
  });
}
function animarTeatro(g, t) {
  const f = (Date.now() - teatro.trocou) / 1000;
  const fecha = f < 0.6 ? f / 0.6 : f < 0.9 ? 1 : f < 1.5 ? 1 - (f - 0.9) / 0.6 : 0;
  pintarCenario(g, f < 0.75 ? teatro.antes : teatro.cenario, t);
  // As cortinas: as de lado ficam abertas; na troca, as duas fecham até o meio e abrem de novo.
  const lado = 70 + fecha * 330;
  for (const d of [-1, 1]) {
    const xb = d < 0 ? 116 : 884;
    g.fillStyle = grad(g, xb, 0, xb - d * lado, 0, [[0, '#6a0f1e'], [1, '#a81e32']]);
    g.beginPath();
    g.moveTo(xb, 72);
    g.lineTo(xb - d * lado, 72);
    g.quadraticCurveTo(xb - d * (lado - 30), 200, xb - d * (lado + (fecha > 0.9 ? 0 : 20)), 300);
    g.lineTo(xb, 300);
    g.closePath();
    g.fill();
    for (let k = 1; k < 5; k++) linha(g, 'rgba(0,0,0,0.18)', 3, [xb - d * lado * (k / 5), 72, xb - d * lado * (k / 5) - d * 6, 300]);
  }
  for (let k = 0; k < 16; k++) el(g, 140 + k * 48, 84, 28, 18, k % 2 ? '#a81e32' : '#8a1626');
  ret(g, 116, 72, 768, 14, '#8a1626');
  for (let k = 0; k < 16; k++) el(g, 140 + k * 48, 100, 4, 4, '#e8c24a');
  // Holofotes e as luzinhas da beira do palco
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [x, fase] of [[150, 0], [850, 2]]) {
    const alvo = 500 + Math.sin(t * 0.6 + fase) * 220;
    g.fillStyle = 'rgba(255,240,190,0.07)';
    g.beginPath(); g.moveTo(x, 80); g.lineTo(alvo - 70, 420); g.lineTo(alvo + 70, 420); g.closePath(); g.fill();
    el(g, alvo, 410, 70, 16, 'rgba(255,240,190,0.08)');
  }
  g.restore();
  for (let k = 0; k < 18; k++) {
    const x = 90 + k * 48;
    el(g, x, 436, 5, 3, '#fff4c2');
    brilho(g, x, 432, 20, 'rgba(255,230,150,A)', 0.25 + Math.sin(t * 2 + k) * 0.05);
  }
  if (f < 2.5) texto(g, CENARIOS[teatro.cenario].nome, 500, 130, { cor: `rgba(255,244,194,${Math.max(0, Math.min(1, (2.5 - f) * 1.5)) * (f > 0.9 ? 1 : 0)})`, fonte: '700 26px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
}
function alavanca(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 30);
  const f = (Date.now() - teatro.trocou) / 1000;
  const puxada = f < 0.8;
  if (!sp(g, 'alavanca', puxada ? 'puxada' : 'parado', x, y, { t })) alavancaCorpo(g, x, y, puxada);
  el(g, x - 14, y - 76, 4, 4, puxada ? '#7fe08a' : '#3a5a3a');
  el(g, x + 14, y - 76, 4, 4, teatro.cenario % 2 ? '#ffe46b' : '#5a5a3a');
}
function alavancaCorpo(g, x, y, puxada) {
  ret(g, x - 30, y - 90, 60, 90, '#3a3f48', 6);
  ret(g, x - 24, y - 84, 48, 18, '#24282e', 3);
  texto(g, 'CENÁRIO', x, y - 58, { cor: '#ffe46b', fonte: '700 9px sans-serif' });
  ret(g, x - 6, y - 46, 12, 30, '#1b1e23', 3);
  const a = puxada ? 0.7 : -0.7;
  g.save(); g.translate(x, y - 30); g.rotate(a);
  ret(g, -3, -46, 6, 46, '#c9cdd4', 3);
  el(g, 0, -48, 9, 9, '#e05a5a');
  g.restore();
}
function estanteRoteiros(g, x, y) {
  sombraNoChao(g, x, y + 2, 26);
  if (!sp(g, 'estante-roteiros', 'parado', x, y)) estanteRoteirosCorpo(g, x, y);
}
function estanteRoteirosCorpo(g, x, y) {
  ret(g, x - 3, y - 70, 6, 70, '#2a2a2e');
  linha(g, '#2a2a2e', 3, [x, y - 4, x - 18, y]);
  linha(g, '#2a2a2e', 3, [x, y - 4, x + 18, y]);
  forma(g, '#3a3a3e', [x - 32, y - 68, x + 32, y - 68, x + 28, y - 104, x - 28, y - 104]);
  forma(g, '#f4ead2', [x - 26, y - 72, x + 2, y - 72, x + 2, y - 102, x - 24, y - 100]);
  forma(g, '#fbf3e0', [x + 26, y - 74, x - 2, y - 72, x - 2, y - 100, x + 24, y - 102]);
  for (let k = 0; k < 4; k++) { linha(g, 'rgba(60,40,20,0.5)', 1, [x - 22, y - 96 + k * 6, x - 4, y - 95 + k * 6]); linha(g, 'rgba(60,40,20,0.5)', 1, [x + 4, y - 95 + k * 6, x + 22, y - 96 + k * 6]); }
  ret(g, x - 34, y - 70, 68, 5, '#2a2a2e', 2);
  for (let k = 0; k < 3; k++) ret(g, x + 30 + k * 3, y - 40 + k * 10, 26, 6, ['#e8c24a', '#f4ead2', '#e05a8a'][k], 1);
}
function poltronasTeatro(g, x, y, n) {
  for (let k = 0; k < n; k++) {
    const px = x + k * 52;
    sombraNoChao(g, px, y + 2, 24);
    if (!sp(g, 'poltrona-teatro', 'parado', px, y)) poltronaTeatroCorpo(g, px, y);
  }
}
function poltronaTeatroCorpo(g, x, y) {
  ret(g, x - 22, y - 58, 44, 40, '#8a1626', 10);
  ret(g, x - 18, y - 54, 36, 30, '#a81e32', 8);
  ret(g, x - 24, y - 24, 48, 14, '#7a1220', 5);
  ret(g, x - 26, y - 40, 6, 32, '#b8922a', 2);
  ret(g, x + 20, y - 40, 6, 32, '#b8922a', 2);
  ret(g, x - 20, y - 10, 4, 10, '#3a2414');
  ret(g, x + 16, y - 10, 4, 10, '#3a2414');
}

/* ─── Hotel dos Pompons: Saguão ─── */

function fundoHotel(g) {
  g.fillStyle = '#efe3c8';
  g.fillRect(0, 0, W, 350);
  for (let x = 0; x < W; x += 120) { ret(g, x + 50, 20, 20, 250, '#e2d2b0'); ret(g, x + 46, 20, 28, 10, '#c9a24a'); }
  ret(g, 0, 0, W, 22, '#c9a24a');
  ret(g, 0, 266, W, 84, '#7a4a2a');
  for (let x = 12; x < W; x += 66) ret(g, x, 278, 54, 60, '#8a5a32', 4);
  ret(g, 0, 262, W, 6, '#c9a24a');
  chaoXadrez(g, 350, H, '#efe6d4', '#c9b79a');
  forma(g, '#8a2f3a', [446, 350, 554, 350, 610, H, 390, H]);
  forma(g, '#a8343e', [456, 350, 544, 350, 596, H, 404, H]);
  linha(g, '#e8c24a', 2, [452, 350, 398, H]);
  linha(g, '#e8c24a', 2, [548, 350, 602, H]);
  // O quadro das chaves (cada chaveiro é um pompom)
  ret(g, 200, 86, 260, 126, '#7a4a2a', 6);
  ret(g, 208, 94, 244, 110, '#5b3420', 3);
  for (let k = 0; k < 16; k++) {
    const x = 224 + (k % 8) * 30;
    const y = 108 + Math.floor(k / 8) * 50;
    el(g, x, y, 2, 2, '#c9a24a');
    if (k % 5 === 3) continue;
    ret(g, x - 2, y + 2, 4, 14, '#e8c24a', 1);
    el(g, x, y + 22, 6, 6, CORES[k % 8]);
  }
  if (!sp(g, 'quadro-fundador', 'parado', 552, 186, { quadro: 0 })) quadroFundador(g);
  if (!sp(g, 'elevador', 'parado', 690, 352, { quadro: 0 })) elevador(g);
  if (!sp(g, 'porta-spa', 'parado', 865, 352, { quadro: 0 })) portaSpa(g);
  tapete(g, 'Saída', '#2f4466');
}
function quadroFundador(g) {
  ret(g, 506, 78, 92, 108, '#b8922a', 4);
  ret(g, 514, 86, 76, 92, '#4a6a8a', 2);
  pompomCorpo(g, 552, 168, 26, CORES_POMPOM.branco, 0);
  ret(g, 536, 100, 32, 18, '#1b1b1b', 2);
  ret(g, 530, 116, 44, 5, '#1b1b1b', 2);
  g.strokeStyle = '#e8c24a'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(560, 140, 6, 0, Math.PI * 2); g.stroke();
  placa(g, 552, 196, 84, 16, 'O Fundador', { fundo: '#b8922a', borda: '#8a6a20', cor: '#2a1d12', fonte: '700 9px "Cinzel", Georgia, serif' });
}
function elevador(g) {
  placa(g, 690, 60, 140, 26, 'Cobertura', { fundo: '#2f4466', borda: '#c9a24a', cor: '#e8c24a', fonte: '700 13px "Cinzel", Georgia, serif' });
  el(g, 690, 104, 26, 18, '#c9a24a');
  el(g, 690, 106, 21, 14, '#2a1d12');
  ret(g, 622, 126, 136, 226, '#c9a24a', 6);
  ret(g, 632, 136, 116, 214, '#8a6a20', 3);
  for (const x of [636, 692]) {
    ret(g, x, 140, 52, 210, '#d8b860', 2);
    ret(g, x + 6, 150, 40, 190, 'rgba(255,255,255,0.12)', 2);
    for (let k = 0; k < 3; k++) ret(g, x + 10, 170 + k * 56, 32, 38, 'rgba(120,90,30,0.25)', 4);
  }
  ret(g, 760, 230, 10, 24, '#8a6a20', 3);
  el(g, 765, 236, 3, 3, '#ffe46b');
  el(g, 765, 248, 3, 3, '#ffe46b');
}
function portaSpa(g) {
  placa(g, 865, 140, 160, 26, 'Spa dos Pompons', { fundo: '#5fb8b0', borda: '#2f7a74', cor: '#fbf3e0', fonte: '700 13px "Cinzel", Georgia, serif' });
  ret(g, 800, 162, 130, 190, '#7a4a2a', 6);
  ret(g, 810, 172, 54, 180, 'rgba(160,220,215,0.85)', 3);
  ret(g, 866, 172, 54, 180, 'rgba(160,220,215,0.85)', 3);
  for (const [x, y, r] of [[830, 200, 8], [850, 240, 5], [890, 210, 10], [900, 280, 6], [836, 300, 9], [880, 330, 5]]) {
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
  ret(g, 858, 250, 4, 24, '#c9a24a', 2);
  ret(g, 868, 250, 4, 24, '#c9a24a', 2);
}
function animarHotel(g, t) {
  const a = -0.9 + (Math.sin(t * 0.5) + 1) * 0.9;
  g.save(); g.translate(690, 120); g.rotate(a);
  ret(g, -1.5, -14, 3, 14, '#e8c24a', 1);
  g.restore();
  // O lustre
  linha(g, '#8a6a20', 2, [330, 0, 330, 34]);
  if (!sp(g, 'lustre', 'brilhando', 330, 30, { t })) lustreCorpo(g, 330, 30, t);
  brilho(g, 330, 60, 140, 'rgba(255,230,160,A)', 0.2 + Math.sin(t * 2) * 0.03);
}
function lustreCorpo(g, x, y, t) {
  el(g, x, y + 22, 50, 10, '#c9a24a');
  el(g, x, y + 18, 40, 7, '#e8c24a');
  for (let k = 0; k < 7; k++) {
    const dx = -42 + k * 14;
    linha(g, 'rgba(255,255,255,0.6)', 1, [x + dx, y + 26, x + dx, y + 40]);
    el(g, x + dx, y + 42, 3, 5, (Math.floor(t * 4) + k) % 3 ? '#e8f4ff' : '#ffffff');
  }
  for (const dx of [-30, 0, 30]) { ret(g, x + dx - 3, y + 2, 6, 14, '#f2e8cf', 2); el(g, x + dx, y, 2.5, 4, '#ffd060'); }
}
function balcaoHotel(g, t) {
  npc(g, 'npc-recepcionista', 330, 296, t, 1);
  if (!sp(g, 'balcao-hotel', 'parado', 330, 384, { t })) balcaoHotelCorpo(g);
}
function balcaoHotelCorpo(g) {
  ret(g, 186, 300, 288, 22, '#c9a24a', 4);
  ret(g, 192, 322, 276, 62, '#5b3420', 2);
  for (let x = 206; x < 460; x += 52) ret(g, x, 332, 40, 42, '#6b4226', 3);
  ret(g, 192, 340, 276, 4, '#c9a24a');
  el(g, 420, 296, 12, 4, '#8a6a20');
  el(g, 420, 290, 9, 8, '#e8c24a');
  el(g, 420, 283, 2, 2, '#e8c24a');
  forma(g, '#f4ead2', [230, 298, 270, 294, 270, 288, 232, 292]);
  forma(g, '#e9dcc3', [310, 298, 270, 294, 270, 288, 308, 292]);
}
function carrinhoMalas(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 50);
  if (!sp(g, 'carrinho-malas', 'parado', x, y, { t })) carrinhoMalasCorpo(g, x, y);
  pompom(g, x + 4, y - 112, 12, CORES_POMPOM.laranja, t, pular(t, 1, 5, 2), false);
}
function carrinhoMalasCorpo(g, x, y) {
  for (const dx of [-36, 36]) { el(g, x + dx, y - 6, 7, 7, '#2a2a2e'); el(g, x + dx, y - 6, 3, 3, '#c9cdd4'); }
  ret(g, x - 46, y - 18, 92, 8, '#c9a24a', 3);
  for (const dx of [-44, 40]) ret(g, x + dx, y - 130, 4, 116, '#c9a24a', 2);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 4;
  g.beginPath(); g.arc(x - 2, y - 130, 42, Math.PI, 0); g.stroke();
  ret(g, x - 38, y - 58, 70, 40, '#8a2f3a', 5);
  ret(g, x - 38, y - 42, 70, 4, '#5a1a24');
  ret(g, x - 30, y - 90, 54, 32, '#3a6a9a', 5);
  ret(g, x - 26, y - 104, 40, 14, '#d8b13a', 4);
}
function vasoPalmeira(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 24);
  if (!sp(g, 'vaso-palmeira', 'parado', x, y, { t })) vasoPalmeiraCorpo(g, x, y);
}
function vasoPalmeiraCorpo(g, x, y) {
  forma(g, '#c9a24a', [x - 22, y - 40, x + 22, y - 40, x + 16, y, x - 16, y]);
  ret(g, x - 25, y - 46, 50, 8, '#e8c24a', 3);
  linha(g, '#6b4a2b', 5, [x, y - 44, x + 4, y - 110]);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI + (k / 5) * Math.PI;
    g.save(); g.translate(x + 4, y - 110); g.rotate(a + Math.PI / 2);
    el(g, 0, -28, 9, 30, k % 2 ? '#3a8a3c' : '#4f9a4c');
    g.restore();
  }
}

/* ─── Spa dos Pompons ─── */

const spa = { ate: 0 };
export const soltarBolhas = () => { spa.ate = Date.now() + 6000; };

function fundoSpa(g) {
  g.fillStyle = '#5fb8b0';
  g.fillRect(0, 0, W, 360);
  for (let y = 24; y < 360; y += 26) for (let x = ((y / 26) % 2) * 13; x < W; x += 26) ret(g, x + 1, y + 1, 24, 24, (x + y) % 4 ? '#68c0b8' : '#58aea6', 2);
  ret(g, 0, 0, W, 24, '#e9dcc3');
  ret(g, 0, 340, W, 20, '#e9dcc3');
  chaoXadrez(g, 360, H, '#e8e2d6', '#dcd4c4');
  el(g, 520, 140, 72, 72, '#c9a06a');
  g.save();
  g.beginPath(); g.arc(520, 140, 62, 0, Math.PI * 2); g.clip();
  g.fillStyle = grad(g, 0, 78, 0, 202, [[0, '#f7a072'], [0.6, '#ffd59a'], [1, '#4a8bb4']]);
  g.fillRect(458, 78, 124, 124);
  ret(g, 458, 160, 124, 42, '#3d8ab8');
  el(g, 520, 162, 18, 18, '#fff0c0');
  for (let k = 0; k < 4; k++) ret(g, 470 + k * 26, 172 + (k % 2) * 10, 16, 2, 'rgba(255,255,255,0.5)', 1);
  g.restore();
  linha(g, '#c9a06a', 4, [520, 78, 520, 202]);
  // A prateleira das toalhas
  ret(g, 720, 150, 220, 8, '#8a5a32', 2);
  ret(g, 720, 246, 220, 8, '#8a5a32', 2);
  for (let k = 0; k < 6; k++) {
    for (const y of [150, 246]) {
      const x = 738 + k * 34;
      const cor = ['#f7f3ea', '#f2a7c8', '#b8e0f0', '#f4dd80'][(k + y) % 4];
      el(g, x, y - 14, 14, 14, cor);
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y - 14, 7, 0, Math.PI * 1.6); g.stroke();
    }
  }
  for (const [x, y] of [[620, 360], [970, 360], [260, 360]]) {
    forma(g, '#c08a50', [x - 20, y - 36, x + 20, y - 36, x + 14, y, x - 14, y]);
    for (let k = 0; k < 5; k++) el(g, x + (k - 2) * 9, y - 60 - (k % 2) * 14, 8, 26, '#3a8a5c', (k - 2) * 0.35);
  }
  // A porta de volta para o Saguão
  ret(g, 30, 186, 104, 174, '#7a4a2a', 6);
  ret(g, 38, 194, 88, 166, '#a8774a', 4);
  el(g, 112, 280, 4, 4, '#e8c24a');
  placa(g, 82, 168, 110, 22, 'Saguão', { fonte: '700 12px "Cinzel", Georgia, serif' });
}
function animarSpa(g, t) {
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.18 + k / 6) % 1;
    el(g, 400 + k * 44 + Math.sin(f * 5 + k) * 20, 470 - f * 200, 30 + f * 30, 12 + f * 10, `rgba(255,255,255,${0.16 * (1 - f)})`);
  }
  const muitas = Date.now() < spa.ate;
  const n = muitas ? 40 : 14;
  for (let k = 0; k < n; k++) {
    const vel = 22 + (k % 5) * 6;
    const y = 470 - ((t * vel + k * 53) % 470);
    const x = (k < 14 ? 860 : 120) + Math.sin(t * 1.2 + k) * 30 - ((470 - y) * (k % 3 === 0 ? 0.9 : 0.4)) * (k < 14 ? 1 : -0.6);
    const r = 4 + (k % 4) * 3;
    g.strokeStyle = `rgba(255,255,255,${0.75 - (470 - y) / 900})`;
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    el(g, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.2, 'rgba(255,255,255,0.6)');
  }
}
function banheira(g, x, y, t) {
  sombraNoChao(g, x, y + 4, 190, 20);
  if (!sp(g, 'banheira', 'parado', x, y, { t })) banheiraCorpo(g, x, y);
  g.save();
  g.beginPath(); g.ellipse(x, y - 42, 160, 40, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = grad(g, 0, y - 82, 0, y - 2, [[0, '#7fd6e0'], [1, '#3aa0b8']]);
  g.fillRect(x - 160, y - 82, 320, 80);
  for (let k = 0; k < 6; k++) {
    const r = ((t * 30 + k * 26) % 150);
    g.strokeStyle = `rgba(255,255,255,${0.35 * (1 - r / 150)})`; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, y - 42, r, r * 0.25, 0, 0, Math.PI * 2); g.stroke();
  }
  for (let k = 0; k < 8; k++) el(g, x - 130 + ((k * 37 + t * 25) % 260), y - 30 - (k % 3) * 10, 3, 3, 'rgba(255,255,255,0.7)');
  g.restore();
  [[-80, CORES_POMPOM.amarelo], [0, CORES_POMPOM.rosa], [80, CORES_POMPOM.azul]].forEach(([dx, cor], k) => {
    const by = Math.sin(t * 2 + k * 2) * 3;
    noRetangulo(g, x + dx - 30, y - 120, 60, 82 + by, () => pompomCorpo(g, x + dx, y - 28 + by, 18, cor, t + k));
    el(g, x + dx, y - 62 + by, 15, 8, '#f7f3ea');
    el(g, x + dx + 4, y - 68 + by, 9, 6, '#f7f3ea');
  });
}
function banheiraCorpo(g, x, y) {
  el(g, x, y - 34, 190, 50, '#b8aea0');
  el(g, x, y - 40, 182, 48, '#e8e2d6');
  el(g, x, y - 42, 166, 44, '#d0c8ba');
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; el(g, x + Math.cos(a) * 176, y - 36 + Math.sin(a) * 46, 12, 7, '#a8a090'); }
}
function maquinaBolhas(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 40);
  if (!sp(g, 'maquina-bolhas', 'parado', x, y, { t })) maquinaBolhasCorpo(g, x, y, t);
}
function maquinaBolhasCorpo(g, x, y, t = 0) {
  ret(g, x - 34, y - 90, 68, 90, '#e05a8a', 10);
  ret(g, x - 26, y - 80, 52, 30, '#fff4f8', 6);
  for (let k = 0; k < 3; k++) {
    el(g, x - 14 + k * 14, y - 65, 5, 5, '#2a3a2e');
    linha(g, '#e05a5a', 1.5, [x - 14 + k * 14, y - 65, x - 14 + k * 14 + Math.cos(t * 2 + k) * 4, y - 65 + Math.sin(t * 2 + k) * 4]);
  }
  ret(g, x - 8, y - 120, 16, 32, '#c9cdd4', 4);
  el(g, x, y - 124, 18, 8, '#c9cdd4');
  ret(g, x - 24, y - 40, 48, 14, '#b84a6a', 4);
  texto(g, 'BOLHAS', x, y - 33, { cor: '#fff4f8', fonte: '700 9px sans-serif' });
}
function macaPompom(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 50);
  if (!sp(g, 'maca-pompom', 'parado', x, y, { t })) macaCorpo(g, x, y);
  pompomCorpo(g, x, y - 46, 17, CORES_POMPOM.verde, 0);
  for (const dx of [-5, 5]) { el(g, x + dx, y - 64, 5, 5, '#9ccc6a'); el(g, x + dx, y - 64, 3, 3, '#cfe8a0'); }
  if (Math.floor(t) % 4 < 3) texto(g, 'z', x + 24, y - 80 - (t % 1) * 10, { cor: 'rgba(255,255,255,0.8)', fonte: '700 14px sans-serif' });
}
function macaCorpo(g, x, y) {
  ret(g, x - 50, y - 44, 100, 12, '#c08a50', 4);
  ret(g, x - 46, y - 50, 92, 8, '#f7f3ea', 4);
  for (const dx of [-42, 36]) ret(g, x + dx, y - 34, 6, 34, '#8a5a32');
}

/* ─── Cobertura do Hotel ─── */

function fundoCobertura(g) {
  g.fillStyle = grad(g, 0, 0, 0, 260, [[0, '#1a2a5a'], [0.55, '#7a5aa0'], [1, '#f4a070']]);
  g.fillRect(0, 0, W, 260);
  const rnd = sorte(41);
  for (let k = 0; k < 50; k++) el(g, rnd() * W, rnd() * 120, 1.1, 1.1, 'rgba(255,255,255,0.75)');
  brilho(g, 720, 252, 120, 'rgba(255,200,120,A)', 0.5);
  el(g, 720, 256, 40, 40, '#ffd890');
  forma(g, '#6a6a9a', [0, 262, 0, 190, 90, 130, 150, 170, 230, 110, 330, 200, 380, 262]);
  forma(g, '#eef2fa', [70, 146, 90, 130, 108, 148, 92, 142]);
  forma(g, '#eef2fa', [208, 128, 230, 110, 252, 132, 232, 124]);
  g.fillStyle = grad(g, 0, 256, 0, 300, [[0, '#4a6aa0'], [1, '#2a4a7a']]);
  g.fillRect(0, 256, W, 44);
  for (let k = 0; k < 7; k++) ret(g, 690 - k * 6, 262 + k * 5, 60 + k * 12, 2, 'rgba(255,220,150,0.45)', 1);
  forma(g, '#3a3050', [860, 262, 880, 240, 960, 236, 1000, 250, 1000, 262]);
  ret(g, 922, 190, 12, 50, '#f2e8cf');
  for (let k = 0; k < 3; k++) ret(g, 922, 196 + k * 14, 12, 5, '#c0392b');
  ret(g, 918, 182, 20, 10, '#3a3a3a', 2);
  chaoTabuas(g, 300, H, ['#c9a06a', '#b8905a', '#d4ac74'], 'rgba(90,60,30,0.3)');
  ret(g, 0, 300, W, 40, 'rgba(200,230,255,0.22)');
  ret(g, 0, 296, W, 5, '#9aa3ad');
  for (let x = 0; x < W; x += 100) ret(g, x, 296, 4, 44, '#9aa3ad');
  // A piscina
  forma(g, '#e9e2d4', [396, 376, 904, 376, 966, 546, 354, 546]);
  forma(g, '#cfc6b4', [410, 386, 890, 386, 946, 534, 372, 534]);
  for (const x of [880, 900]) linha(g, '#c9cdd4', 3, [x, 360, x + 6, 400]);
  linha(g, '#c9cdd4', 3, [880, 368, 900, 368]);
  if (!sp(g, 'elevador-cobertura', 'parado', 105, 352, { quadro: 0 })) elevadorCobertura(g);
  for (const x of [200, 960]) { ret(g, x - 3, 110, 6, 230, '#5b3c22'); el(g, x, 108, 6, 6, '#5b3c22'); }
}
function elevadorCobertura(g) {
  forma(g, '#2f4466', [30, 168, 180, 168, 168, 148, 42, 148]);
  ret(g, 40, 168, 130, 184, '#46648f', 4);
  ret(g, 52, 196, 106, 156, '#c9a24a', 3);
  ret(g, 56, 200, 48, 152, '#d8b860', 2);
  ret(g, 106, 200, 48, 152, '#d8b860', 2);
  placa(g, 105, 182, 110, 20, 'Saguão', { fundo: '#2f4466', borda: '#c9a24a', cor: '#e8c24a', fonte: '700 11px "Cinzel", Georgia, serif' });
}
function animarCobertura(g, t) {
  g.save();
  g.beginPath(); g.moveTo(410, 386); g.lineTo(890, 386); g.lineTo(946, 534); g.lineTo(372, 534); g.closePath(); g.clip();
  g.fillStyle = grad(g, 0, 386, 0, 534, [[0, '#6fd0e8'], [1, '#2a8ab8']]);
  g.fillRect(372, 386, 574, 148);
  for (let k = 0; k < 16; k++) {
    const x = 380 + ((k * 61 + t * 16) % 560);
    const y = 396 + ((k * 37) % 130);
    ret(g, x, y, 30 + (k % 3) * 12, 2, 'rgba(255,255,255,0.35)', 1);
  }
  const bx = 650 + Math.sin(t * 0.4) * 160;
  const by = 460 + Math.cos(t * 0.5) * 30;
  g.strokeStyle = '#e05a5a'; g.lineWidth = 8;
  g.beginPath(); g.ellipse(bx, by, 26, 9, 0, 0, Math.PI * 2); g.stroke();
  pompomCorpo(g, bx, by + 2 + Math.sin(t * 2) * 2, 14, CORES_POMPOM.amarelo, t);
  g.restore();
  // O farol lá longe
  g.save();
  g.globalCompositeOperation = 'lighter';
  const a = Math.sin(t * 0.9) * 1.2;
  g.fillStyle = 'rgba(255,240,180,0.12)';
  g.beginPath(); g.moveTo(928, 188); g.lineTo(928 + Math.cos(a + Math.PI) * 400, 188 + Math.sin(a) * 60 - 20); g.lineTo(928 + Math.cos(a + Math.PI) * 400, 188 + Math.sin(a) * 60 + 20); g.closePath(); g.fill();
  g.restore();
  el(g, 928, 188, 5, 5, '#fff4c2');
  // O varal de luzinhas
  for (let k = 0; k < 18; k++) {
    const f = k / 17;
    const x = 200 + f * 760;
    const y = 112 + Math.sin(f * Math.PI) * 50;
    if (k === 0) linha(g, '#2a2a2e', 1.5, [200, 112, 960, 112]);
    const aceso = (Math.floor(t * 2) + k) % 3 !== 0;
    const cor = ['#ff7ad9', '#6be0ff', '#ffe46b', '#7fe08a'][k % 4];
    el(g, x, y + 5, 3.5, 5, aceso ? cor : '#555');
    if (aceso) brilho(g, x, y + 5, 14, 'rgba(255,240,180,A)', 0.25);
  }
  g.strokeStyle = '#2a2a2e'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(200, 112); g.quadraticCurveTo(580, 212, 960, 112); g.stroke();
  for (const [x, y] of [[120, 30], [400, 60], [600, 20], [860, 50]]) el(g, x, y, 1.2 + Math.sin(t * 3 + x) * 0.7, 1.2 + Math.sin(t * 3 + x) * 0.7, '#ffffff');
}
function espreguicadeira(g, x, y) {
  sombraNoChao(g, x, y + 2, 60);
  if (!sp(g, 'espreguicadeira', 'parado', x, y)) espreguicadeiraCorpo(g, x, y);
}
function espreguicadeiraCorpo(g, x, y) {
  forma(g, '#f7f3ea', [x - 60, y - 22, x + 24, y - 22, x + 30, y - 30, x - 54, y - 30]);
  forma(g, '#f7f3ea', [x + 24, y - 22, x + 58, y - 64, x + 66, y - 58, x + 32, y - 22]);
  for (let k = 0; k < 6; k++) ret(g, x - 54 + k * 14, y - 30, 7, 8, '#5fb8b0');
  for (const dx of [-52, 20]) ret(g, x + dx, y - 22, 5, 22, '#8a8a92');
  ret(g, x - 40, y - 38, 26, 10, '#f2a7c8', 4);
}
function guardaSol(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 20);
  if (!sp(g, 'guarda-sol', 'parado', x, y, { t })) guardaSolCorpo(g, x, y);
}
function guardaSolCorpo(g, x, y) {
  ret(g, x - 2, y - 150, 4, 150, '#c9cdd4');
  for (let k = 0; k < 8; k++) forma(g, k % 2 ? '#f7f3ea' : '#e05a5a', [x, y - 170, x - 80 + k * 20, y - 136, x - 60 + k * 20, y - 136]);
  el(g, x, y - 172, 4, 4, '#e8c24a');
}

/* ─── Parque dos Pompons ─── */

function fundoParque(g) {
  g.fillStyle = grad(g, 0, 0, 0, 340, [[0, '#7ec8e3'], [1, '#d4f1fb']]);
  g.fillRect(0, 0, W, 340);
  brilho(g, 130, 70, 90, 'rgba(255,240,180,A)', 0.6);
  el(g, 130, 70, 32, 32, '#fff4c2');
  nuvem(g, 300, 60, 0.9); nuvem(g, 620, 90, 0.7); nuvem(g, 820, 40, 0.8);
  el(g, 250, 340, 380, 80, '#86b866');
  el(g, 800, 340, 400, 90, '#79ab5c');
  for (const [x, r] of [[40, 30], [320, 26], [560, 34], [700, 28], [980, 32]]) arvoreRedonda(g, x, 344, r, '#4f8a3c');
  chaoGrama(g, 340, H);
  for (let x = 0; x < W; x += 24) { ret(g, x + 4, 330, 10, 26, '#fbf8f1', 3); forma(g, '#fbf8f1', [x + 4, 330, x + 9, 322, x + 14, 330]); }
  ret(g, 0, 338, W, 5, '#e8e2d0');
  g.fillStyle = '#d8c89a';
  g.beginPath();
  g.moveTo(0, 470); g.quadraticCurveTo(250, 430, 500, 470); g.quadraticCurveTo(750, 510, W, 460);
  g.lineTo(W, 530); g.quadraticCurveTo(750, 580, 500, 540); g.quadraticCurveTo(250, 500, 0, 545);
  g.closePath(); g.fill();
  // A caixa de areia
  ret(g, 226, 528, 190, 64, '#a8774a', 6);
  ret(g, 234, 534, 174, 52, '#f0dca0', 4);
  forma(g, '#e0c880', [300, 566, 340, 566, 334, 550, 320, 542, 306, 550]);
  ret(g, 314, 536, 10, 10, '#e0c880');
  forma(g, '#e05a5a', [360, 570, 380, 570, 378, 552, 362, 552]);
  if (!sp(g, 'placa-parque', 'parado', 500, 350, { quadro: 0 })) placaParque(g);
}
function placaParque(g) {
  for (const x of [400, 600]) ret(g, x - 4, 290, 8, 60, '#6b4a2b');
  placa(g, 500, 300, 240, 36, 'Parque dos Pompons', { fundo: '#7fd07a', borda: '#3a7a3c', cor: '#fbf3e0', fonte: '700 17px "Cinzel", Georgia, serif' });
  for (const [x, c] of [[388, '#f28ab8'], [612, '#6fb6f0']]) pompomCorpo(g, x, 290, 9, c, 0);
}
function animarParque(g, t) {
  for (let k = 0; k < 4; k++) {
    const x = 120 + ((t * (24 + k * 6) + k * 230) % 760);
    const y = 470 + Math.sin(t * 0.7 + k * 1.9) * 40 + (k % 2) * 30;
    pompom(g, x, y, 11 + (k % 2) * 3, CORES[(k * 2 + 1) % 8], t + k, pular(t, k * 0.8, 16, 4.5));
  }
  const kx = 720 + Math.sin(t * 0.5) * 60;
  const ky = 90 + Math.sin(t * 0.9) * 20;
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(kx, ky + 24); g.quadraticCurveTo(kx - 60, 260, 600, 420); g.stroke();
  forma(g, '#e05a8a', [kx, ky - 24, kx + 18, ky, kx, ky + 24, kx - 18, ky]);
  forma(g, '#f4dd80', [kx, ky - 24, kx + 18, ky, kx, ky]);
  for (let k = 0; k < 3; k++) el(g, kx - 4 + Math.sin(t * 3 + k) * 6, ky + 34 + k * 12, 4, 2.5, ['#6fb6f0', '#7fd07a', '#f39a4a'][k]);
}
function escorregador(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 80, 14);
  if (!sp(g, 'escorregador', 'parado', x, y, { t })) escorregadorCorpo(g, x, y);
  const f = (t * 0.35) % 1;
  if (f < 0.6) {
    const p = f / 0.6;
    pompom(g, x - 40 + p * 110, y - 120 + p * 108, 12, CORES_POMPOM.laranja, t, 0, false);
  }
}
function escorregadorCorpo(g, x, y) {
  for (const dx of [-60, -24]) ret(g, x + dx, y - 130, 6, 130, '#e05a5a', 2);
  for (let k = 0; k < 6; k++) ret(g, x - 60, y - 20 - k * 20, 42, 4, '#f4dd80', 2);
  ret(g, x - 64, y - 136, 46, 10, '#6fb6f0', 3);
  forma(g, '#f4dd80', [x - 24, y - 128, x - 10, y - 134, x + 84, y - 6, x + 70, y]);
  forma(g, '#e8c24a', [x - 24, y - 128, x + 70, y, x + 74, y + 2, x - 20, y - 124]);
  linha(g, '#e05a5a', 3, [x - 18, y - 140, x + 76, y - 14]);
}
function balanco(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 90, 14);
  if (!sp(g, 'balanco', 'parado', x, y, { t })) balancoCorpo(g, x, y);
  [[-34, CORES_POMPOM.roxo, 0], [34, CORES_POMPOM.verde, 1.6]].forEach(([dx, cor, fase]) => {
    const a = Math.sin(t * 2.2 + fase) * 0.5;
    const px = x + dx + Math.sin(a) * 100;
    const py = y - 150 + Math.cos(a) * 100;
    linha(g, '#8a8a92', 2, [x + dx - 12, y - 150, px - 12, py]);
    linha(g, '#8a8a92', 2, [x + dx + 12, y - 150, px + 12, py]);
    ret(g, px - 16, py, 32, 6, '#a8774a', 2);
    pompom(g, px, py + 1, 13, cor, t + fase, 0, false);
  });
}
function balancoCorpo(g, x, y) {
  for (const d of [-1, 1]) {
    linha(g, '#4a7aa0', 7, [x + d * 80, y, x + d * 70, y - 154]);
    linha(g, '#4a7aa0', 7, [x + d * 56, y, x + d * 70, y - 154]);
  }
  ret(g, x - 80, y - 160, 160, 10, '#5a8ab0', 4);
}
function gangorra(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 80, 12);
  const a = Math.sin(t * 1.6) * 0.22;
  g.save(); g.translate(x, y - 30); g.rotate(a);
  ret(g, -86, -5, 172, 10, '#e05a5a', 4);
  for (const d of [-1, 1]) ret(g, d * 70 - 3, -18, 6, 14, '#c9cdd4', 2);
  g.restore();
  [[-1, CORES_POMPOM.azul], [1, CORES_POMPOM.rosa]].forEach(([d, cor], k) => {
    const px = x + d * 76 * Math.cos(a);
    const py = y - 34 + d * 76 * Math.sin(a);
    pompom(g, px, py, 13, cor, t + k, 0, false);
  });
  if (!sp(g, 'gangorra', 'parado', x, y, { t })) forma(g, '#f4dd80', [x - 18, y, x + 18, y, x + 4, y - 30, x - 4, y - 30]);
}
function canhao(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 64, 14);
  if (!sp(g, 'canhao-pompom', 'parado', x, y, { t })) canhaoCorpo(g, x, y);
  const espia = pular(t, 0, 8, 1.8);
  g.save(); g.translate(x + 30, y - 92); g.rotate(-0.7);
  noRetangulo(g, -30, -60, 60, 46, () => pompomCorpo(g, 0, -12 - espia, 14, CORES_POMPOM.rosa, t));
  g.restore();
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.7 + k / 3) % 1;
    el(g, x + 60 + f * 30, y - 130 - f * 30, 2 + (1 - f) * 2, 2 + (1 - f) * 2, `rgba(255,230,120,${1 - f})`);
  }
}
function canhaoCorpo(g, x, y) {
  g.save(); g.translate(x + 30, y - 92); g.rotate(-0.7);
  ret(g, -26, -16, 52, 96, '#6a3a9a', 14);
  for (let k = 0; k < 4; k++) ret(g, -26, 0 + k * 22, 52, 6, ['#f4dd80', '#7fd07a', '#6fb6f0', '#f28ab8'][k]);
  el(g, 0, -16, 26, 9, '#4e2a74');
  el(g, 0, -16, 19, 6, '#1b1030');
  g.restore();
  for (const dx of [-26, 26]) { el(g, x + dx, y - 24, 22, 22, '#8a5a32'); el(g, x + dx, y - 24, 16, 16, '#a8774a'); el(g, x + dx, y - 24, 5, 5, '#5b3c22'); }
  placa(g, x, y - 4, 120, 20, 'Lança-Pompom', { fundo: '#e05a8a', borda: '#a83a68', cor: '#fff4f8', fonte: '700 11px "Cinzel", Georgia, serif' });
}

/* ─── Pista de Skate ─── */

const CURVA_HP = x => {
  const d = Math.abs(x - 500);
  if (d <= 140) return 380;
  const f = Math.min(1, (d - 140) / 150);
  return 380 - f * f * 180;
};
function fundoSkate(g) {
  g.fillStyle = grad(g, 0, 0, 0, 260, [[0, '#8fd3f4'], [1, '#e0f4ff']]);
  g.fillRect(0, 0, W, 260);
  nuvem(g, 100, 50, 0.8); nuvem(g, 680, 70, 0.9);
  ret(g, 0, 150, W, 140, '#b0b0b8');
  for (let x = 0; x < W; x += 80) ret(g, x, 150, 2, 140, 'rgba(0,0,0,0.12)');
  ret(g, 0, 144, W, 8, '#9a9aa4');
  // Grafites
  const grafite = (t_, x, y, cor, borda, tam) => {
    g.font = `900 ${tam}px "Cinzel", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = borda; g.lineWidth = 6; g.strokeText?.(t_, x, y);
    g.fillStyle = cor; g.fillText(t_, x, y);
  };
  grafite('SKATE', 160, 200, '#ff7ad9', '#2a1d42', 46);
  grafite('POMPONS', 840, 196, '#6be0ff', '#1b2a4a', 40);
  for (const [x, y, r, cor] of [[300, 180, 18, 'rgba(127,224,138,0.8)'], [700, 230, 14, 'rgba(255,228,107,0.8)'], [60, 250, 12, 'rgba(255,122,217,0.6)']]) { el(g, x, y, r, r, cor); el(g, x + r, y + r * 0.8, r * 0.3, r * 0.3, cor); }
  forma(g, '#f39a4a', [470, 168, 520, 168, 495, 240]);
  el(g, 486, 162, 6, 12, '#5cc86a', -0.4); el(g, 504, 162, 6, 12, '#5cc86a', 0.4);
  // O half-pipe
  if (!sp(g, 'half-pipe', 'parado', 500, 402, { quadro: 0 })) halfPipe(g);
  g.fillStyle = '#a8a8b0';
  g.fillRect(0, 402, W, H - 402);
  for (let k = 0; k < 8; k++) linha(g, 'rgba(60,60,70,0.35)', 2, [500 + (k - 3.5) * 120, 402, 500 + (k - 3.5) * 220, H]);
  for (const y of [450, 520]) linha(g, 'rgba(60,60,70,0.3)', 2, [0, y, W, y]);
  linha(g, 'rgba(60,60,70,0.5)', 1.5, [620, 470, 650, 490, 640, 510, 690, 540]);
  forma(g, '#b8a27a', [0, 450, 120, 462, 120, 540, 0, 556]);
}
function halfPipe(g) {
  g.fillStyle = grad(g, 0, 200, 0, 402, [[0, '#e0e0e8'], [1, '#b8b8c4']]);
  g.beginPath();
  g.moveTo(170, 200); g.lineTo(212, 200);
  for (let x = 212; x <= 788; x += 8) g.lineTo(x, CURVA_HP(x));
  g.lineTo(830, 200); g.lineTo(830, 402); g.lineTo(170, 402);
  g.closePath(); g.fill();
  ret(g, 160, 192, 54, 12, '#7a7a86', 2);
  ret(g, 786, 192, 54, 12, '#7a7a86', 2);
  linha(g, '#d8dde4', 4, [210, 198, 216, 198]);
  ret(g, 170, 380, 660, 22, '#9a9aa6');
  for (let x = 240; x < 780; x += 60) linha(g, 'rgba(0,0,0,0.08)', 2, [x, CURVA_HP(x) + 2, x, 400]);
}
function animarSkate(g, t) {
  for (let k = 0; k < 2; k++) {
    const u = Math.sin(t * 1.25 + k * Math.PI);
    const x = 500 + u * 285;
    const y = CURVA_HP(x);
    const dx = 2;
    const ang = Math.atan2(CURVA_HP(x + dx) - CURVA_HP(x - dx), dx * 2);
    g.save(); g.translate(x, y); g.rotate(ang);
    ret(g, -20, -6, 40, 5, '#2a2a2e', 2);
    el(g, -13, 0, 3.5, 3.5, '#e8c24a'); el(g, 13, 0, 3.5, 3.5, '#e8c24a');
    pompomCorpo(g, 0, -6, 15, k ? CORES_POMPOM.preto : CORES_POMPOM.laranja, t + k);
    g.restore();
  }
}
function rampa(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 70, 12);
  if (!sp(g, 'rampa', 'parado', x, y, { t })) rampaCorpo(g, x, y);
}
function rampaCorpo(g, x, y) {
  forma(g, '#c9a06a', [x - 70, y, x + 60, y, x + 60, y - 60]);
  forma(g, '#a8804a', [x + 60, y, x + 76, y - 8, x + 76, y - 66, x + 60, y - 60]);
  for (let k = 1; k < 5; k++) linha(g, 'rgba(90,60,30,0.35)', 1.5, [x - 70 + k * 26, y, x - 70 + k * 26, y - k * 12]);
}
function corrimao(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 90, 8);
  if (!sp(g, 'corrimao', 'parado', x, y, { t })) corrimaoCorpo(g, x, y);
  const f = (t * 0.4) % 1;
  const px = x - 100 + f * 200;
  const sobe = f < 0.15 ? Math.sin((f / 0.15) * Math.PI / 2) * 36 : f > 0.85 ? Math.cos(((f - 0.85) / 0.15) * Math.PI / 2) * 36 : 36;
  ret(g, px - 18, y - sobe - 2, 36, 5, '#2a2a2e', 2);
  pompomCorpo(g, px, y - sobe - 2, 13, CORES_POMPOM.azul, t);
}
function corrimaoCorpo(g, x, y) {
  ret(g, x - 100, y - 36, 200, 5, '#c9cdd4', 2);
  for (const dx of [-90, 0, 90]) ret(g, x + dx - 2, y - 34, 4, 34, '#8a8a92');
}
function cones(g, x, y) {
  for (const dx of [0, 34]) {
    sombraNoChao(g, x + dx, y + 2, 12);
    forma(g, '#f39a4a', [x + dx - 11, y, x + dx + 11, y, x + dx + 3, y - 30, x + dx - 3, y - 30]);
    ret(g, x + dx - 8, y - 16, 16, 5, '#ffffff');
    ret(g, x + dx - 14, y - 3, 28, 4, '#d8742a', 2);
  }
}

/* ─── As salas ─── */

const porta = (x0, y0, x1, y1, ir, sala, rotulo) => ({ x0, y0, x1, y1, ir, acao: `sala:${sala}`, rotulo });
const SAIDA = (sala, rotulo) => porta(420, 560, 580, 600, [500, 585], sala, rotulo);

export const SALAS_CENTRO = {
  leitura: {
    fundo: fundoLeitura, animar: animarLeitura,
    objetos: [
      { y: 395, desenhar: (g, t) => npc(g, 'npc-bibliotecaria', 140, 395, t, 1) },
      { y: 404, desenhar: (g, t) => livroCapitao(g, 340, 404, t) },
      { y: 452, desenhar: (g, t) => mesaMancala(g, 480, 452, t) },
      { y: 420, desenhar: g => poltrona(g, 710, 420, 1) },
      { y: 424, desenhar: g => poltrona(g, 940, 424, -1) },
    ],
    pontos: [
      porta(24, 488, 206, 600, [115, 494], 'cafe', 'Descer para o Café'),
      { x0: 296, y0: 300, x1: 384, y1: 412, ir: [340, 430], acao: 'livroCapitao', rotulo: 'O Livro do Capitão Saltarrocha' },
      { x0: 40, y0: 36, x1: 420, y1: 336, ir: [230, 372], acao: 'historia', rotulo: 'Livros da História da Ilha' },
      { x0: 390, y0: 380, x1: 570, y1: 462, ir: [480, 478], acao: 'mancala', rotulo: 'Jogar Mancala das Cenouras' },
      { x0: 660, y0: 330, x1: 760, y1: 424, ir: [700, 428], acao: 'sentar', rotulo: 'Sentar perto da lareira' },
      { x0: 890, y0: 334, x1: 990, y1: 428, ir: [930, 432], acao: 'sentar', rotulo: 'Sentar perto da lareira' },
    ],
  },
  fliperama: {
    fundo: fundoFliperama, animar: animarFliperama,
    objetos: MAQUINAS.map(m => ({ y: 372, desenhar: (g, t) => maquina(g, m, t) })),
    pontos: [
      porta(20, 488, 200, 600, [110, 494], 'danca', 'Descer para o Salão de Dança'),
      ...MAQUINAS.map(m => ({ x0: m.x - 54, y0: 150, x1: m.x + 54, y1: 376, ir: [m.x, 396], acao: `jogo:${m.jogo}`, rotulo: `Jogar ${m.nome}` })),
    ],
  },
  plaza: {
    fundo: fundoPlaza, animar: animarPlaza,
    objetos: [
      ...[255, 495, 745].map(x => ({ y: 396, desenhar: (g, t) => poste(g, x, 396, t) })),
      { y: 474, desenhar: g => setaDupla(g, 66, 474, ['Forte Nevado', 'Floresta'], -1) },
      { y: 474, desenhar: g => setaPlaca(g, 870, 474, 'Parque', 1) },
    ],
    pontos: [
      porta(105, 270, 175, 376, [140, 398], 'petshop', 'Pet Shop dos Pompons'),
      porta(340, 272, 410, 376, [375, 398], 'pizzaria', 'Pizzaria'),
      porta(578, 272, 662, 376, [620, 398], 'teatro', 'Teatro'),
      porta(828, 290, 912, 376, [870, 398], 'hotel', 'Hotel dos Pompons'),
      porta(0, 396, 132, 468, [40, 430], 'forte', 'Forte Nevado'),
      porta(0, 470, 132, 575, [40, 520], 'floresta', 'Floresta'),
      porta(866, 430, 1000, 560, [960, 495], 'parque', 'Parque dos Pompons'),
      porta(170, 548, 350, 600, [260, 582], 'praca', 'Voltar à Praça'),
    ],
  },
  petshop: {
    fundo: fundoPetshop, animar: animarPetshop,
    objetos: [
      { y: 386, desenhar: balcaoPetshop },
      { y: 426, desenhar: (g, t) => cercadinho(g, 'fundo', t) },
      { y: 490, desenhar: pomponsNoCercado },
      { y: 548, desenhar: (g, t) => cercadinho(g, 'frente', t) },
      { y: 532, desenhar: (g, t) => caixaRoxa(g, 900, 532, t) },
    ],
    pontos: [
      { x0: 318, y0: 80, x1: 418, y1: 226, ir: [370, 396], acao: 'portaSecreta', rotulo: 'Um cartaz meio torto...' },
      { x0: 850, y0: 440, x1: 960, y1: 548, ir: [870, 566], acao: 'caixaRoxa', rotulo: 'Uma caixa roxa estranha' },
      { x0: 286, y0: 390, x1: 654, y1: 552, ir: [470, 568], acao: 'carinho', rotulo: 'Fazer carinho nos pompons' },
      { x0: 32, y0: 84, x1: 308, y1: 302, ir: [170, 396], acao: 'carinho', rotulo: 'Os pompons das casinhas' },
      { x0: 690, y0: 220, x1: 950, y1: 390, ir: [820, 404], acao: 'adotar', rotulo: 'Adotar um pompom' },
      SAIDA('plaza', 'Voltar à Plaza'),
    ],
  },
  pizzaria: {
    fundo: fundoPizzaria, animar: animarPizzaria,
    objetos: [
      { y: 384, desenhar: balcaoPizzaria },
      { y: 474, desenhar: g => mesaPizzaria(g, 190, 474) },
      { y: 508, desenhar: g => mesaPizzaria(g, 640, 508) },
      { y: 384, desenhar: g => piano(g, 916, 384) },
    ],
    pontos: [
      { x0: 712, y0: 124, x1: 848, y1: 345, ir: [780, 366], acao: 'pizzas', rotulo: 'Fábrica de Pizzas de Cenoura' },
      { x0: 340, y0: 230, x1: 610, y1: 388, ir: [470, 404], acao: 'pedirPizza', rotulo: 'Pedir uma fatia' },
      { x0: 850, y0: 200, x1: 990, y1: 390, ir: [900, 404], acao: 'piano', rotulo: 'Tocar o piano' },
      SAIDA('plaza', 'Voltar à Plaza'),
    ],
  },
  teatro: {
    fundo: fundoTeatro, animar: animarTeatro,
    objetos: [
      { y: 474, desenhar: (g, t) => estanteRoteiros(g, 130, 474, t) },
      { y: 478, desenhar: (g, t) => npc(g, 'npc-diretor', 196, 478, t, -1) },
      { y: 480, desenhar: (g, t) => alavanca(g, 880, 480, t) },
      { y: 548, desenhar: g => poltronasTeatro(g, 70, 548, 5) },
      { y: 548, desenhar: g => poltronasTeatro(g, 722, 548, 5) },
      { y: 598, desenhar: g => poltronasTeatro(g, 50, 598, 6) },
      { y: 598, desenhar: g => poltronasTeatro(g, 690, 598, 6) },
    ],
    pontos: [
      { x0: 840, y0: 376, x1: 924, y1: 484, ir: [880, 494], acao: 'cenario', rotulo: 'Trocar o cenário' },
      { x0: 86, y0: 364, x1: 176, y1: 478, ir: [130, 494], acao: 'roteiros', rotulo: 'Roteiros das peças' },
      SAIDA('plaza', 'Voltar à Plaza'),
    ],
  },
  hotel: {
    fundo: fundoHotel, animar: animarHotel,
    objetos: [
      { y: 384, desenhar: balcaoHotel },
      { y: 480, desenhar: (g, t) => carrinhoMalas(g, 110, 480, t) },
      { y: 372, desenhar: (g, t) => vasoPalmeira(g, 590, 372, t) },
      { y: 372, desenhar: (g, t) => vasoPalmeira(g, 960, 372, t) },
    ],
    pontos: [
      porta(622, 56, 760, 356, [690, 374], 'hotel_cobertura', 'Elevador para a Cobertura'),
      porta(796, 126, 934, 356, [865, 374], 'hotel_spa', 'Spa dos Pompons'),
      { x0: 186, y0: 230, x1: 474, y1: 388, ir: [330, 404], acao: 'recepcao', rotulo: 'Recepção' },
      SAIDA('plaza', 'Voltar à Plaza'),
    ],
  },
  hotel_spa: {
    fundo: fundoSpa, animar: animarSpa,
    objetos: [
      { y: 530, desenhar: (g, t) => banheira(g, 520, 530, t) },
      { y: 474, desenhar: (g, t) => maquinaBolhas(g, 880, 474, t) },
      { y: 448, desenhar: (g, t) => macaPompom(g, 210, 448, t) },
    ],
    pontos: [
      porta(30, 160, 136, 370, [96, 396], 'hotel', 'Voltar ao Saguão'),
      { x0: 340, y0: 440, x1: 700, y1: 560, ir: [520, 572], acao: 'banho', rotulo: 'Banho de espuma' },
      { x0: 836, y0: 340, x1: 930, y1: 480, ir: [870, 494], acao: 'bolhas', rotulo: 'Ligar a máquina de bolhas' },
      { x0: 150, y0: 370, x1: 270, y1: 452, ir: [210, 470], acao: 'carinho', rotulo: 'Pompom relaxando' },
    ],
  },
  hotel_cobertura: {
    fundo: fundoCobertura, animar: animarCobertura,
    objetos: [
      { y: 470, desenhar: g => espreguicadeira(g, 220, 470) },
      { y: 560, desenhar: g => espreguicadeira(g, 250, 560) },
      { y: 452, desenhar: (g, t) => guardaSol(g, 316, 452, t) },
    ],
    pontos: [
      porta(36, 140, 176, 356, [105, 376], 'hotel', 'Elevador para o Saguão'),
      { x0: 380, y0: 380, x1: 950, y1: 540, ir: [650, 560], acao: 'piscina', rotulo: 'Pular na piscina' },
    ],
  },
  parque: {
    fundo: fundoParque, animar: animarParque,
    objetos: [
      { y: 432, desenhar: (g, t) => escorregador(g, 190, 432, t) },
      { y: 410, desenhar: (g, t) => balanco(g, 450, 410, t) },
      { y: 424, desenhar: (g, t) => canhao(g, 720, 424, t) },
      { y: 548, desenhar: (g, t) => gangorra(g, 620, 548, t) },
      { y: 486, desenhar: g => setaPlaca(g, 70, 486, 'Plaza', -1) },
      { y: 486, desenhar: g => setaPlaca(g, 930, 486, 'Pista de Skate', 1) },
    ],
    pontos: [
      { x0: 650, y0: 300, x1: 800, y1: 432, ir: [720, 446], acao: 'lancaPompom', rotulo: 'Jogar Lança-Pompom' },
      { x0: 360, y0: 250, x1: 540, y1: 414, ir: [450, 426], acao: 'brincar:balanco', rotulo: 'Balanço' },
      { x0: 110, y0: 290, x1: 270, y1: 436, ir: [200, 448], acao: 'brincar:escorregador', rotulo: 'Escorregador' },
      { x0: 520, y0: 486, x1: 720, y1: 552, ir: [620, 566], acao: 'brincar:gangorra', rotulo: 'Gangorra' },
      porta(0, 420, 110, 585, [40, 500], 'plaza', 'Voltar à Plaza'),
      porta(890, 420, 1000, 585, [960, 500], 'skate', 'Pista de Skate'),
    ],
  },
  skate: {
    fundo: fundoSkate, animar: animarSkate,
    objetos: [
      { y: 520, desenhar: (g, t) => corrimao(g, 470, 520, t) },
      { y: 560, desenhar: (g, t) => rampa(g, 820, 560, t) },
      { y: 470, desenhar: g => cones(g, 240, 470) },
      { y: 470, desenhar: g => setaPlaca(g, 70, 470, 'Parque', -1) },
    ],
    pontos: [
      { x0: 360, y0: 470, x1: 580, y1: 526, ir: [470, 540], acao: 'manobra', rotulo: 'Manobra no corrimão' },
      { x0: 740, y0: 486, x1: 900, y1: 566, ir: [820, 576], acao: 'manobra', rotulo: 'Pular a rampa' },
      { x0: 170, y0: 190, x1: 830, y1: 404, ir: [500, 420], acao: 'manobra', rotulo: 'Manobra no half-pipe' },
      porta(0, 420, 120, 585, [40, 500], 'parque', 'Voltar ao Parque'),
    ],
  },
};

/* ─── O mapa e as ações ─── */

export const INFO_CENTRO = {
  praca: { nome: 'Praça do Clube', desc: 'A fonte, o Café, o Armarinho, o Salão de Dança e os caminhos para toda a ilha.', regiao: 'centro', icone: 'casa', mapa: { x: 500, y: 330 } },
  cafe: { nome: 'Café da Cenoura', desc: 'Café quentinho, bolo de cenoura e a escada para a Sala de Leitura.', regiao: 'centro', icone: 'cenoura', mapa: null },
  loja: { nome: 'Armarinho', desc: 'Roupas, acessórios e móveis para a toca.', regiao: 'centro', icone: 'loja', mapa: null },
  danca: { nome: 'Salão de Dança', desc: 'Pista colorida, a Dança da Toca, o Fliperama lá em cima e a Caldeira no porão.', regiao: 'centro', icone: 'musica', mapa: null },
  lago: { nome: 'Lago Cintilante', desc: 'Pescaria com o velho pescador.', regiao: 'centro', icone: 'gota', mapa: { x: 382, y: 368 } },
  leitura: { nome: 'Sala de Leitura', desc: 'A lareira, a história da ilha, a Mancala das Cenouras e um livro muito antigo.', regiao: 'centro', icone: 'livro', mapa: null },
  fliperama: { nome: 'Fliperama', desc: 'As máquinas com os jogos da Recreação, em cima do Salão de Dança.', regiao: 'centro', icone: 'jogos', mapa: null },
  plaza: { nome: 'Plaza', desc: 'Pet Shop, Pizzaria, Teatro e o Hotel dos Pompons.', regiao: 'centro', icone: 'estrela', mapa: { x: 612, y: 300 } },
  petshop: { nome: 'Pet Shop dos Pompons', desc: 'Pompons fofos, carinho e uma caixa roxa muito estranha.', regiao: 'centro', icone: 'pata', mapa: null },
  pizzaria: { nome: 'Pizzaria', desc: 'O piano, o forno e a Fábrica de Pizzas de Cenoura.', regiao: 'centro', icone: 'torta', mapa: null },
  teatro: { nome: 'Teatro', desc: 'O palco com cenários que trocam e roteiros para encenar.', regiao: 'centro', icone: 'mascara', mapa: null },
  hotel: { nome: 'Hotel dos Pompons', desc: 'O Saguão, o Spa dos Pompons e a Cobertura com piscina.', regiao: 'centro', icone: 'lua', mapa: null },
  hotel_spa: { nome: 'Spa dos Pompons', desc: 'Banho de espuma e muitas bolhas.', regiao: 'centro', icone: 'gota', mapa: null },
  hotel_cobertura: { nome: 'Cobertura do Hotel', desc: 'Piscina e a vista da ilha inteira.', regiao: 'centro', icone: 'sol', mapa: null },
  parque: { nome: 'Parque dos Pompons', desc: 'Balanço, escorregador e o Lança-Pompom.', regiao: 'centro', icone: 'balao', mapa: { x: 598, y: 398 } },
  skate: { nome: 'Pista de Skate', desc: 'O half-pipe dos pompons skatistas.', regiao: 'centro', icone: 'estrada', mapa: null },
};

const sorteio = lista => lista[Math.floor(Math.random() * lista.length)];
const NOMES_POMPOM = ['Fofucho', 'Bolinha', 'Algodão', 'Pipoca', 'Jujuba', 'Nuvem', 'Paçoca', 'Brigadeiro', 'Pompoca', 'Tufinho'];
const COR_DO_NOME = { '#f28ab8': 'rosa', '#6fb6f0': 'azul', '#f4d35e': 'amarelo', '#7fd07a': 'verde', '#b07ee8': 'roxo', '#3a3440': 'preto', '#f7f3ea': 'branco', '#f39a4a': 'laranja' };
const MANOBRAS = ['Kickflip da Cenoura!', 'Ollie Orelhudo!', 'Giro 360 do Pompom!', 'Grind no Corrimão!', 'Manual Saltitante!', 'Heelflip do Raposo (só que melhor)!'];
const RECEPCAO = [
  'Bem-vindo ao Hotel dos Pompons! Os pompons hospedados agradecem o silêncio.',
  'O seu quarto é o 404... a gente ainda não achou ele.',
  'Café da manhã das 7 às 10. Cenouras à vontade!',
  'Tocou o sininho! Ding! A recepcionista sorri.',
];
export const JOGOS_FLIPERAMA = Object.fromEntries(MAQUINAS.map(m => [m.jogo, m.nome]));

export const ACOES_CENTRO = {
  async historia(ctx) { (await jogos()).abrirHistoria(ctx); },
  async livroCapitao(ctx) { (await jogos()).abrirLivroCapitao(ctx); },
  async mancala(ctx) { (await jogos()).abrirMancala(ctx); },
  async pizzas(ctx) { (await jogos()).abrirPizzaria(ctx); },
  async lancaPompom(ctx) { (await jogos()).abrirLancaPompom(ctx); },
  async roteiros(ctx) { (await jogos()).abrirRoteiros(ctx); },
  async piano(ctx) { tocouPiano(); (await jogos()).tocarPiano(); ctx.enviar('clube:emote', { e: 'estrela' }); },
  sentar(ctx) { ctx.enviar('clube:emote', { e: 'sentar' }); },
  jogo(ctx, id) {
    if (!JOGOS_FLIPERAMA[id]) return;
    ctx.aviso(`Ligando a máquina: ${JOGOS_FLIPERAMA[id]}!`);
    if (typeof location !== 'undefined') location.hash = `#/recreacao/${id}`;
  },
  carinho(ctx) {
    ctx.enviar('clube:emote', { e: 'coracao' });
    ctx.aviso(sorteio(['O pompom fez "prrr" de felicidade!', 'Que fofura! O pompom pulou de alegria.', 'O pompom fechou os olhinhos e pediu mais carinho.', 'Os pompons fizeram uma rodinha em volta de você!']));
  },
  // Adotar de verdade: o pompom fica salvo e segue o coelho por todo o clube (veja pompom-adotar.js).
  async adotar(ctx) {
    const { abrirAdocao } = await import('./pompom-adotar.js');
    await abrirAdocao(ctx);
  },
  portaSecreta(ctx) {
    ctx.aviso('O cartaz estava solto... ele gira e mostra uma passagem secreta!');
    setTimeout(() => ctx.irPara('qg'), 700);
  },
  caixaRoxa(ctx) {
    ctx.enviar('clube:emote', { e: 'susto' });
    ctx.aviso('Você espiou dentro da caixa roxa... e caiu lá dentro!');
    setTimeout(() => ctx.irPara('dimensao_caixas'), 700);
  },
  pedirPizza(ctx) {
    ctx.enviar('clube:emote', { e: 'cenoura' });
    ctx.aviso(sorteio(['Uma fatia de Pizza de Cenoura saindo!', 'Pizza de Trevo, bem quentinha!', 'O pizzaiolo jogou a massa para o alto e pegou de volta!']));
  },
  cenario(ctx) {
    const c = trocarCenario();
    ctx.aviso(`Cenário novo no palco: ${c.nome}!`);
  },
  recepcao(ctx) {
    ctx.enviar('clube:emote', { e: 'oi' });
    ctx.aviso(sorteio(RECEPCAO));
  },
  banho(ctx) {
    ctx.enviar('clube:emote', { e: 'coracao' });
    ctx.aviso('Banho de espuma com os pompons. Que relaxante!');
  },
  bolhas(ctx) {
    soltarBolhas();
    ctx.aviso('A máquina de bolhas está a todo vapor!');
  },
  piscina(ctx) {
    ctx.enviar('clube:emote', { e: 'risada' });
    ctx.aviso('Tchibum! A água está uma delícia.');
  },
  brincar(ctx, onde) {
    ctx.enviar('clube:emote', { e: 'risada' });
    ctx.aviso({ balanco: 'Lá no alto! Os pompons do balanço vibram junto.', escorregador: 'Escorregou! Weee!', gangorra: 'Sobe e desce com os pompons!' }[onde] || 'Que divertido!');
  },
  manobra(ctx) {
    ctx.enviar('clube:emote', { e: 'estrela' });
    ctx.aviso(sorteio(MANOBRAS));
  },
};

/* ─── Sprites (veja sprites.js) ─── */

const JOGO = 'Club Coelho: Ilha (centro)';
const NO_FUNDO = ' Faz parte do fundo da sala, então fica parado (vale só o primeiro quadro).';
const PARADO = [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }];
const peca = (chave, nome, desc, largura, altura, animacoes, previa, extra = {}) => ({
  chave: `ilha-centro.${chave}`, jogo: JOGO, nome, desc, largura, altura, ancora: 'pe', animacoes, previa, ...extra,
});
const sombraJogo = ' A sombra continua feita pelo jogo.';

export const SPRITES = [
  ...Object.entries(NPCS).map(([id, n]) => peca(id, n.nome, `O NPC ${n.sala}. O sprite troca o coelho inteiro, com a roupa. Olhando para a direita.`,
    Math.round(44 * n.escala), Math.round(56 * n.escala), [{ id: 'parado', nome: 'Parado', quadros: 2, fps: 3 }],
    (g, a, t) => { g.save(); g.scale(n.escala, n.escala); desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir: 1, t, semSprite: true }); g.restore(); })),
  peca('pompom', 'Pompom', 'Os pompons, os bichinhos de pelúcia da ilha (no Pet Shop, no Hotel, no Parque...). Marque "pintar com a cor" e desenhe em tons claros: cada pompom fica de uma cor. O jogo faz o pulinho e a sombra.',
    32, 34, [{ id: 'pulando', nome: 'Pulando', quadros: 2, fps: 3 }], (g, a, t) => pompomCorpo(g, 0, -Math.abs(Math.sin(t * 3)) * 6, 16, CORES_POMPOM.rosa, t), { tingir: true }),
  // Sala de Leitura
  peca('estante-historia', 'Estante da História da Ilha', `A estante enorme com os livros da história da ilha e a escadinha.${NO_FUNDO}`, 380, 314, PARADO, g => naOrigem(g, 230, 336, () => estanteHistoria(g))),
  peca('janela-redonda', 'Janela redonda da Leitura', `A janela redonda com a montanha nevada lá fora.${NO_FUNDO}`, 152, 160, PARADO, g => naOrigem(g, 540, 130, () => janelaLeitura(g)), { ancora: 'centro' }),
  peca('lareira-leitura', 'Lareira da Leitura', `A lareira de pedra com o retrato do Capitão Saltarrocha em cima. O fogo continua feito pelo jogo.${NO_FUNDO}`, 210, 314, PARADO, g => naOrigem(g, 830, 338, () => lareiraLeitura(g))),
  peca('escada-leitura', 'Escada para o Café', `A escada no chão que desce para o Café, com a placa.${NO_FUNDO}`, 186, 116, PARADO, g => naOrigem(g, 115, 600, () => escadaLeitura(g))),
  peca('poltrona', 'Poltrona verde', `As poltronas perto da lareira. Olhando para a direita: o jogo vira a outra.${sombraJogo}`, 92, 90, PARADO, g => poltronaCorpo(g, 0, 0, 1)),
  peca('mesa-mancala', 'Mesa da Mancala', `A mesa com o tabuleiro da Mancala das Cenouras e os dois banquinhos.${sombraJogo}`, 196, 72, PARADO, g => mesaMancalaCorpo(g, 0, 0)),
  peca('livro-capitao', 'Livro do Capitão Saltarrocha', `O livro antigo aberto no atril. O brilho dourado continua feito pelo jogo.${sombraJogo}`, 74, 96, PARADO, g => livroCapitaoCorpo(g, 0, 0)),
  // Fliperama
  peca('maquina', 'Máquina do Fliperama', 'As máquinas de fliperama (a telinha com o jogo e o nome de cada uma continuam feitos pelo jogo, por cima). Marque "pintar com a cor" para cada máquina ter a sua cor.', 112, 214, PARADO, g => maquinaCorpo(g, 0, 0, '#e05a5a'), { tingir: true }),
  peca('escada-fliperama', 'Escada para o Salão', `A escada de neon que desce do Fliperama para o Salão de Dança.${NO_FUNDO}`, 186, 116, PARADO, g => naOrigem(g, 110, 600, () => escadaFliperama(g))),
  // Plaza
  peca('fachada-petshop', 'Fachada do Pet Shop', `O Pet Shop dos Pompons na Plaza. O pompom que espia pela vitrine continua feito pelo jogo.${NO_FUNDO}`, 248, 264, PARADO, g => naOrigem(g, 140, 370, () => fachadaPetShop(g))),
  peca('fachada-pizzaria', 'Fachada da Pizzaria', `A Pizzaria na Plaza. A fumaça e a luz das janelas continuam feitas pelo jogo.${NO_FUNDO}`, 234, 300, PARADO, g => naOrigem(g, 375, 370, () => fachadaPizzaria(g))),
  peca('fachada-teatro', 'Fachada do Teatro', `O Teatro na Plaza. O letreiro com as lâmpadas piscando continua feito pelo jogo.${NO_FUNDO}`, 266, 314, PARADO, g => naOrigem(g, 620, 370, () => fachadaTeatro(g))),
  peca('fachada-hotel', 'Fachada do Hotel dos Pompons', `O Hotel na Plaza. As janelas que acendem continuam feitas pelo jogo.${NO_FUNDO}`, 244, 358, PARADO, g => naOrigem(g, 870, 370, () => fachadaHotel(g))),
  // Pet Shop
  peca('gaiolas', 'Casinhas dos pompons', `As seis casinhas da parede do Pet Shop. Os pompons e as grades continuam feitos pelo jogo.${NO_FUNDO}`, 276, 218, PARADO, g => naOrigem(g, 170, 302, () => gaiolasFundo(g))),
  peca('cartaz-pompom', 'Cartaz do Pompom do Mês', `O cartaz meio torto do Pet Shop (que esconde uma passagem secreta).${NO_FUNDO}`, 96, 140, PARADO, g => naOrigem(g, 370, 152, () => cartazPompom(g)), { ancora: 'centro' }),
  peca('balcao-petshop', 'Balcão do Pet Shop', 'O balcão com a caixa registradora e o pote de biscoitos. A tratadora é outra peça.', 260, 118, PARADO, g => naOrigem(g, 820, 386, () => balcaoPetshopCorpo(g))),
  peca('cercadinho-fundo', 'Cercadinho (fundo)', 'A parte de trás e os lados do cercadinho dos pompons, com o chão e a bolinha. Os pompons são outra peça.', 364, 154, PARADO, g => naOrigem(g, 470, 426, () => cercaFundoCorpo(g)), { ancora: 'topo' }),
  peca('cercadinho-frente', 'Cercadinho (frente)', 'A cerquinha da frente do cercadinho dos pompons.', 364, 44, PARADO, g => naOrigem(g, 470, 548, () => cercaFrenteCorpo(g))),
  peca('caixa-roxa', 'Caixa roxa estranha', `A caixa roxa do Pet Shop, que leva para a Dimensão das Caixas. O jogo faz o tremidinho e os brilhos.${sombraJogo}`, 92, 82, [{ id: 'balancando', nome: 'Parada', quadros: 1, fps: 1 }], g => caixaRoxaCorpo(g, 0, 0, 0)),
  // Pizzaria
  peca('forno', 'Forno a lenha', `O forno de tijolos com a pá de pizza. O fogo continua feito pelo jogo.${NO_FUNDO}`, 260, 340, PARADO, g => naOrigem(g, 170, 340, () => forno(g))),
  peca('porta-cozinha', 'Porta da Fábrica de Pizzas', `A porta de vai e vem da cozinha, com a placa.${NO_FUNDO}`, 196, 214, PARADO, g => naOrigem(g, 780, 340, () => portaCozinha(g))),
  peca('balcao-pizzaria', 'Balcão da Pizzaria', 'O balcão verde com a pizza na vitrine. O vapor e o pizzaiolo são feitos por fora.', 270, 110, PARADO, g => naOrigem(g, 470, 384, () => balcaoPizzariaCorpo(g))),
  peca('mesa-pizzaria', 'Mesa da Pizzaria', `A mesa com a toalha xadrez, a pizza e duas cadeiras.${sombraJogo}`, 144, 62, PARADO, g => mesaPizzariaCorpo(g, 0, 0)),
  peca('piano', 'Piano', `O piano da Pizzaria (as notinhas que saem quando alguém toca continuam feitas pelo jogo).${sombraJogo}`, 132, 178, PARADO, g => pianoCorpo(g, 0, 0)),
  // Teatro
  peca('palco', 'Moldura do palco', `A moldura dourada do palco, com as máscaras do teatro. O cenário, as cortinas e as luzes continuam feitos pelo jogo.${NO_FUNDO}`, 868, 428, PARADO, g => naOrigem(g, 500, 446, () => moldura(g))),
  peca('alavanca', 'Alavanca do cenário', 'A caixa com a alavanca que troca o cenário do palco (as luzinhas são feitas pelo jogo).',
    64, 112, [{ id: 'parado', nome: 'Para cima', quadros: 1, fps: 1 }, { id: 'puxada', nome: 'Puxada', quadros: 1, fps: 1 }], (g, a) => alavancaCorpo(g, 0, 0, a === 'puxada')),
  peca('estante-roteiros', 'Estante dos roteiros', `A estante de partitura com os roteiros das peças.${sombraJogo}`, 92, 106, PARADO, g => estanteRoteirosCorpo(g, 0, 0)),
  peca('poltrona-teatro', 'Poltrona do Teatro', `As poltronas vermelhas da plateia (uma de cada vez, o jogo enfileira).${sombraJogo}`, 54, 60, PARADO, g => poltronaTeatroCorpo(g, 0, 0)),
  // Hotel
  peca('quadro-fundador', 'Retrato do Fundador', `O retrato do pompom fundador do hotel, de cartola e monóculo.${NO_FUNDO}`, 94, 124, PARADO, g => naOrigem(g, 552, 186, () => quadroFundador(g))),
  peca('elevador', 'Elevador do Hotel', `O elevador dourado para a Cobertura, com a placa e o mostrador (o ponteiro é feito pelo jogo).${NO_FUNDO}`, 150, 300, PARADO, g => naOrigem(g, 690, 352, () => elevador(g))),
  peca('porta-spa', 'Porta do Spa', `A porta de vidro com bolhas que leva ao Spa dos Pompons.${NO_FUNDO}`, 160, 226, PARADO, g => naOrigem(g, 865, 352, () => portaSpa(g))),
  peca('lustre', 'Lustre do Saguão', 'O lustre de cristal do Saguão (a âncora é o ponto do teto). O brilho em volta continua feito pelo jogo.',
    104, 50, [{ id: 'brilhando', nome: 'Brilhando', quadros: 3, fps: 4 }], (g, a, t) => lustreCorpo(g, 0, -4, t), { ancora: 'topo' }),
  peca('balcao-hotel', 'Recepção do Hotel', 'O balcão da recepção com o sininho e o livro de hóspedes. O recepcionista é outra peça.', 290, 110, PARADO, g => naOrigem(g, 330, 384, () => balcaoHotelCorpo(g))),
  peca('carrinho-malas', 'Carrinho de malas', `O carrinho dourado com as malas. O pompom em cima é feito pelo jogo.${sombraJogo}`, 104, 176, PARADO, g => carrinhoMalasCorpo(g, 0, 0)),
  peca('vaso-palmeira', 'Palmeira no vaso', `As palmeiras douradas do Saguão.${sombraJogo}`, 80, 146, PARADO, g => vasoPalmeiraCorpo(g, 0, 0)),
  // Spa
  peca('banheira', 'Banheira do Spa', 'A banheira redonda de pedra (a água, a espuma e os pompons de toalha continuam feitos pelo jogo).', 380, 100, PARADO, g => banheiraCorpo(g, 0, 0)),
  peca('maquina-bolhas', 'Máquina de bolhas', `A máquina que solta as bolhas do Spa (os ponteiros e as bolhas são feitos pelo jogo).${sombraJogo}`, 72, 134, PARADO, g => maquinaBolhasCorpo(g, 0, 0, 0)),
  peca('maca-pompom', 'Maca do Spa', `A maca onde um pompom descansa com rodelas de pepino (o pompom é feito pelo jogo).${sombraJogo}`, 104, 52, PARADO, g => macaCorpo(g, 0, 0)),
  // Cobertura
  peca('elevador-cobertura', 'Elevador da Cobertura', `A casinha do elevador no telhado, com a placa "Saguão".${NO_FUNDO}`, 152, 206, PARADO, g => naOrigem(g, 105, 352, () => elevadorCobertura(g))),
  peca('espreguicadeira', 'Espreguiçadeira', `As espreguiçadeiras da piscina.${sombraJogo}`, 130, 70, PARADO, g => espreguicadeiraCorpo(g, 0, 0)),
  peca('guarda-sol', 'Guarda-sol', `O guarda-sol listrado.${sombraJogo}`, 164, 176, PARADO, g => guardaSolCorpo(g, 0, 0)),
  // Parque
  peca('placa-parque', 'Placa do Parque', `A placa "Parque dos Pompons" com os dois postes.${NO_FUNDO}`, 244, 84, PARADO, g => naOrigem(g, 500, 350, () => placaParque(g))),
  peca('escorregador', 'Escorregador', `O escorregador do parque (o pompom escorregando é feito pelo jogo).${sombraJogo}`, 170, 146, PARADO, g => escorregadorCorpo(g, 0, 0)),
  peca('balanco', 'Balanço', `A armação do balanço. Os assentos com os pompons balançando são feitos pelo jogo.${sombraJogo}`, 172, 166, PARADO, g => balancoCorpo(g, 0, 0)),
  peca('gangorra', 'Base da gangorra', 'O apoio do meio da gangorra (a tábua e os pompons sobem e descem feitos pelo jogo).', 40, 32, PARADO, g => forma(g, '#f4dd80', [-18, 0, 18, 0, 4, -30, -4, -30])),
  peca('canhao-pompom', 'Canhão do Lança-Pompom', `O canhão colorido do Lança-Pompom com a placa. O pompom espiando e as faíscas são feitos pelo jogo.${sombraJogo}`, 132, 160, PARADO, g => canhaoCorpo(g, 0, 0)),
  // Pista de Skate
  peca('half-pipe', 'Half-pipe', `O half-pipe da Pista de Skate. Os pompons skatistas são feitos pelo jogo.${NO_FUNDO}`, 680, 212, PARADO, g => naOrigem(g, 500, 402, () => halfPipe(g))),
  peca('rampa', 'Rampa de skate', `A rampa de madeira.${sombraJogo}`, 150, 70, PARADO, g => rampaCorpo(g, 0, 0)),
  peca('corrimao', 'Corrimão de skate', `O corrimão de manobras (o pompom no skate é feito pelo jogo).${sombraJogo}`, 204, 40, PARADO, g => corrimaoCorpo(g, 0, 0)),
];
registrarPecas(SPRITES);

// Para os testes: os desenhos soltos.
export const _desenhos = { pompom, pompomCorpo, pintarCenario, CURVA_HP };

registrarRegiao({ id: 'centro', salas: SALAS_CENTRO, info: INFO_CENTRO, acoes: ACOES_CENTRO });
