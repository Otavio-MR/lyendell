// O mapa ilustrado da Ilha do Club Coelho (1000 x 600): o mar em volta, as praias, a montanha nevada ao
// norte, a floresta a oeste, o iceberg no mar, o ancoradouro e o dojo a leste. A parte parada é desenhada uma
// vez (desenharIlhaFixa, guardada num canvas pela tela do clube) e o que mexe vai por cima (desenharIlhaViva).
// Os lugares (botões com o nome e quantas pessoas estão lá) são feitos pela tela do clube, em cima do canvas,
// com as posições de INFO_SALAS[id].mapa. Não usa nada da página: dá para testar no Node.
import { sorte } from '../desenho-coelho.js';

export const MAPA_W = 1000;
export const MAPA_H = 600;

function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}
function grad(g, x0, y0, x1, y1, paradas) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
function forma(g, cor, pts) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
// O contorno da ilha (no sentido do relógio, começando a noroeste).
const COSTA = [
  [130, 150], [220, 84], [360, 52], [520, 34], [700, 26], [830, 40], [930, 74], [976, 140], [968, 250], [930, 330],
  [882, 398], [820, 446], [744, 478], [700, 512], [636, 516], [588, 556], [540, 540], [486, 508], [404, 500],
  [320, 482], [222, 470], [140, 450], [74, 410], [52, 320], [70, 228],
];
// Um caminho suave passando pelo meio de cada lado (fica com cara de desenho à mão).
function contorno(g, pts, escala = 1, cx = 520, cy = 290) {
  const p = pts.map(([x, y]) => [cx + (x - cx) * escala, cy + (y - cy) * escala]);
  const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.beginPath();
  const m0 = meio(p[p.length - 1], p[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < p.length; i++) {
    const m = meio(p[i], p[(i + 1) % p.length]);
    g.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
  }
  g.closePath();
}
function arvore(g, x, y, r, cor) {
  el(g, x, y + r * 0.9, r * 0.8, r * 0.25, 'rgba(0,0,0,0.18)');
  g.fillStyle = '#5b3c22';
  g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.8);
  forma(g, cor, [x - r, y + r * 0.3, x + r, y + r * 0.3, x, y - r * 1.4]);
  forma(g, 'rgba(255,255,255,0.12)', [x - r * 0.2, y - r * 0.9, x, y - r * 1.4, x + r * 0.1, y - r * 0.5]);
}
function copa(g, x, y, r, cor) {
  el(g, x, y + r * 0.8, r * 0.8, r * 0.25, 'rgba(0,0,0,0.15)');
  g.fillStyle = '#5b3c22';
  g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.7);
  el(g, x, y - r * 0.2, r, r * 0.85, cor);
  el(g, x - r * 0.3, y - r * 0.45, r * 0.4, r * 0.3, 'rgba(255,255,255,0.12)');
}

export function desenharIlhaFixa(g) {
  // O mar
  g.fillStyle = grad(g, 0, 0, 0, MAPA_H, [[0, '#2f7fb0'], [1, '#1d5a86']]);
  g.fillRect(0, 0, MAPA_W, MAPA_H);
  const rnd = sorte(77);
  for (let k = 0; k < 90; k++) {
    const x = rnd() * MAPA_W;
    const y = rnd() * MAPA_H;
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
  // Água rasa, areia e grama
  g.fillStyle = 'rgba(120,210,230,0.45)';
  contorno(g, COSTA, 1.07); g.fill();
  g.fillStyle = '#ecd9a0';
  contorno(g, COSTA, 1.0); g.fill();
  g.fillStyle = grad(g, 0, 40, 0, 520, [[0, '#7fae64'], [1, '#8cc06c']]);
  contorno(g, COSTA, 0.955); g.fill();
  // A neve ao norte (com a borda ondulada) e a montanha
  g.save();
  contorno(g, COSTA, 0.955); g.clip();
  g.fillStyle = '#eef4fa';
  g.beginPath();
  const borda = x => 262 + Math.sin(x / 26) * 9 - (x < 540 ? (540 - x) * 0.85 : 0);
  g.moveTo(380, 0); g.lineTo(1000, 0);
  for (let x = 1000; x >= 380; x -= 10) g.lineTo(x, borda(x));
  g.closePath(); g.fill();
  for (let k = 0; k < 40; k++) el(g, 420 + rnd() * 560, 40 + rnd() * 190, 10 + rnd() * 16, 3, 'rgba(180,200,225,0.35)');
  g.restore();
  for (const [x, y, w, hh, cor] of [[700, 150, 150, 120, '#a9b8cc'], [800, 140, 120, 100, '#9aaac0'], [600, 160, 110, 80, '#b4c2d4']]) {
    forma(g, cor, [x - w / 2, y, x, y - hh, x + w / 2, y]);
    forma(g, '#ffffff', [x - w * 0.18, y - hh * 0.64, x, y - hh, x + w * 0.18, y - hh * 0.64, x + w * 0.06, y - hh * 0.7, x - w * 0.05, y - hh * 0.6]);
    forma(g, 'rgba(0,0,0,0.08)', [x, y - hh, x + w / 2, y, x + w * 0.1, y]);
  }
  for (let k = 0; k < 14; k++) arvore(g, 440 + rnd() * 520, 120 + rnd() * 110, 7 + rnd() * 3, '#3f7a5a');
  // A floresta a oeste
  for (let k = 0; k < 46; k++) {
    const x = 100 + rnd() * 240;
    const y = 170 + rnd() * 220;
    if (Math.hypot(x - 382, y - 368) < 50) continue;
    (k % 3 ? arvore : copa)(g, x, y, 9 + rnd() * 6, ['#2f6b3c', '#3a7a44', '#2a5e36'][k % 3]);
  }
  // O lago (com o riozinho que desce da montanha)
  g.strokeStyle = '#5aa8d8'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(560, 200); g.quadraticCurveTo(470, 260, 420, 330); g.stroke();
  el(g, 382, 368, 44, 26, '#5aa8d8');
  el(g, 376, 362, 30, 14, 'rgba(255,255,255,0.25)');
  // As trilhas de terra ligando tudo
  g.strokeStyle = 'rgba(190,160,110,0.9)'; g.lineWidth = 7;
  g.setLineDash?.([]);
  for (const pts of [
    [500, 330, 560, 280, 520, 240], [500, 330, 560, 320, 612, 300], [612, 300, 620, 350, 598, 398], [500, 330, 470, 400, 440, 465],
    [500, 330, 440, 340, 382, 368], [612, 300, 650, 230, 650, 176], [520, 240, 470, 200, 470, 160], [650, 176, 700, 200, 740, 210],
    [650, 176, 750, 160, 840, 150], [650, 176, 620, 150, 600, 140], [740, 210, 820, 230, 885, 232], [382, 368, 300, 300, 200, 260],
    [200, 260, 150, 330, 110, 390], [440, 465, 560, 480, 660, 490], [660, 490, 600, 510, 560, 535], [612, 300, 700, 380, 660, 490],
  ]) {
    g.beginPath(); g.moveTo(pts[0], pts[1]); g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); g.stroke();
  }
  g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 2;
  g.setLineDash?.([6, 8]);
  g.beginPath(); g.moveTo(500, 330); g.quadraticCurveTo(560, 320, 612, 300); g.stroke();
  g.setLineDash?.([]);
  // As casinhas da cidade, no meio
  for (const [x, y, cor] of [[470, 310, '#c0503a'], [530, 306, '#6a4a8a'], [496, 352, '#3b2a5a'], [590, 282, '#e05a8a'], [636, 284, '#2f8a3c'], [632, 322, '#46648f']]) {
    g.fillStyle = '#f2e8cf'; g.fillRect(x - 9, y - 6, 18, 14);
    forma(g, cor, [x - 12, y - 6, x + 12, y - 6, x, y - 18]);
  }
  // O dojo a leste: o morrinho e as cerejeiras
  el(g, 905, 205, 70, 40, '#a8c08a');
  for (const [x, y] of [[860, 180], [950, 200], [930, 250], [870, 250]]) { el(g, x, y, 13, 10, '#f2a7c8'); el(g, x - 4, y - 3, 6, 4, '#fbd0e0'); }
  // O ancoradouro: o píer de madeira entrando no mar
  g.fillStyle = '#8a5a32'; g.fillRect(426, 478, 20, 74);
  for (let y = 482; y < 552; y += 8) { g.fillStyle = 'rgba(60,35,15,0.4)'; g.fillRect(426, y, 20, 1.5); }
  g.fillStyle = '#6b4226'; g.fillRect(410, 540, 52, 12);
  // O iceberg no mar
  forma(g, 'rgba(255,255,255,0.25)', [862, 548, 980, 548, 990, 560, 852, 560]);
  forma(g, '#f4fbff', [866, 548, 884, 500, 912, 486, 940, 494, 970, 520, 980, 548]);
  forma(g, '#cfe6f4', [912, 486, 940, 494, 970, 520, 980, 548, 930, 548]);
  // A rosa dos ventos e o título
  const [rx, ry] = [80, 80];
  el(g, rx, ry, 34, 34, 'rgba(251,243,224,0.85)');
  forma(g, '#8a2f3a', [rx, ry - 30, rx + 7, ry, rx, ry + 30, rx - 7, ry]);
  forma(g, '#3a2a1a', [rx - 30, ry, rx, ry - 7, rx + 30, ry, rx, ry + 7]);
  forma(g, '#e8c24a', [rx, ry - 30, rx + 7, ry, rx - 7, ry]);
  g.font = '700 13px "Cinzel", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#3a2a1a'; g.fillText('N', rx, ry - 42 + 0);
  g.fillStyle = 'rgba(251,243,224,0.92)';
  g.beginPath();
  if (g.roundRect) g.roundRect(330, 560, 340, 34, 10); else g.rect(330, 560, 340, 34);
  g.fill();
  g.font = '700 20px "Cinzel", Georgia, serif';
  g.fillStyle = '#5b3c22';
  g.fillText('Ilha do Club Coelho', 500, 578);
}

// O que mexe: as ondinhas, as nuvens, as gaivotas e o barquinho dando a volta na ilha.
export function desenharIlhaViva(g, t) {
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    const x = 520 + Math.cos(a) * 500;
    const y = 290 + Math.sin(a) * 300;
    const f = (t * 0.5 + k * 0.37) % 1;
    g.strokeStyle = `rgba(255,255,255,${0.4 * (1 - f)})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 6 + f * 10, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }
  // O barquinho
  const a = t * 0.05;
  const bx = 520 + Math.cos(a) * 470;
  const by = 300 + Math.sin(a) * 285;
  if (bx > 10 && bx < 990 && by > 10 && by < 590) {
    const d = -Math.sin(a) > 0 ? 1 : -1;
    el(g, bx, by + 4, 14, 3, 'rgba(255,255,255,0.4)');
    forma(g, '#8a5a32', [bx - 12, by, bx + 12, by, bx + 8 * d, by + 5, bx - 8 * d, by + 5]);
    g.fillStyle = '#5b3c22'; g.fillRect(bx - 1, by - 18, 2, 18);
    forma(g, '#fbf3e0', [bx + 1, by - 17, bx + 1, by - 2, bx + 11 * d, by - 3]);
  }
  // Nuvens que passam por cima
  for (let k = 0; k < 4; k++) {
    const x = ((t * (8 + k * 3) + k * 290) % 1240) - 120;
    const y = 60 + k * 120 + Math.sin(t * 0.2 + k) * 10;
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 26], [50, 0, 20]]) el(g, x + dx, y + dy, r, r * 0.7, 'rgba(255,255,255,0.32)');
  }
  // Gaivotas
  for (let k = 0; k < 3; k++) {
    const x = ((t * 22 + k * 330) % 1100) - 50;
    const y = 470 + k * 30 + Math.sin(t * 2 + k) * 8;
    const asa = Math.sin(t * 8 + k) * 3;
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - 7, y - asa); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 7, y - asa); g.stroke();
  }
  // Brilho no iceberg e fumacinha na cabana
  el(g, 900 + Math.sin(t * 2) * 6, 505, 2, 2, `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 4)})`);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.3 + k / 3) % 1;
    el(g, 600 + Math.sin(f * 5) * 4, 128 - f * 30, 3 + f * 5, 2 + f * 4, `rgba(240,240,250,${0.5 * (1 - f)})`);
  }
}
