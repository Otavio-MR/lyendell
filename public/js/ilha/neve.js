// Região "neve" da Ilha do Club Coelho (veja clube-ilha.js): o Forte Nevado, a Vila de Esqui, a Cabana do Esqui
// e o Sótão, a Estação de Esqui no topo da montanha, a Caverna da Mina (com a Mina de Ouro, o Lago Secreto e a
// Piscina Subterrânea), a Escola e a Usina de Reciclagem. Tudo num quadro de 1000 x 600, no mesmo estilo de
// clube-salas.js: o fundo desenhado uma vez, o que se mexe em "animar" e os objetos na ordem de profundidade.
// Não usa nada da página: dá para testar no Node. Os minijogos ficam em neve-jogos.js (com DOM), que só é
// importado quando a pessoa clica.
import { registrarRegiao } from '../clube-ilha.js';
import { desenharCoelho, sorte } from '../desenho-coelho.js';
import { registrarPecas, desenharSprite, temSprite } from '../sprites.js';

const W = 1000;
const H = 600;
const JOGO = 'Club Coelho: Ilha (neve)';
// Sprite enviado em #/recreacao/sprites para uma peça daqui (false sem sprite: desenha o de sempre).
const sp = (g, peca, anim, x, y, o) => desenharSprite(g, `ilha-neve.${peca}`, anim, x, y, o);

/* ─── Utilidades de desenho ─── */

export function el(g, x, y, rx, ry, cor, rot = 0) {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2);
  g.fill();
}
export function ret(g, x, y, w, h, cor, r = 0) {
  g.fillStyle = cor;
  g.beginPath();
  if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}
export function grad(g, x0, y0, x1, y1, paradas) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
// cor com "A" no lugar da transparência: 'rgba(255,220,140,A)'.
export function brilho(g, x, y, r, cor, forca = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  gr.addColorStop(0, cor.replace('A', String(Math.max(0, forca))));
  gr.addColorStop(1, cor.replace('A', '0'));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  g.fill();
}
export function texto(g, t, x, y, { cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center', sombra = null } = {}) {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  if (sombra) { g.fillStyle = sombra; g.fillText(t, x + 1.5, y + 1.5); }
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
export function forma(g, cor, pts) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
function linha(g, cor, larg, pts) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
const sombraNoChao = (g, x, y, rx, ry = rx * 0.28) => el(g, x, y, rx, ry, 'rgba(40,60,90,0.2)');
// Um número "aleatório" fixo para cada k (os flocos de neve e as faíscas sempre no mesmo lugar).
const hash = (k, s = 1) => { const v = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const mod = (a, m) => ((a % m) + m) % m;

export function placa(g, x, y, w, h, textoPlaca, { fundo = '#8a6a44', borda = '#5b4228', cor = '#fbf3e0', fonte = '700 15px "Cinzel", Georgia, serif', neve = true } = {}) {
  ret(g, x - w / 2, y - h / 2, w, h, fundo, 6);
  g.strokeStyle = borda;
  g.lineWidth = 3;
  g.beginPath();
  if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, 6); else g.rect(x - w / 2, y - h / 2, w, h);
  g.stroke();
  if (neve) { ret(g, x - w / 2 - 2, y - h / 2 - 5, w + 4, 8, '#f7fbff', 4); el(g, x - w / 4, y - h / 2 + 2, 5, 4, '#f7fbff'); }
  texto(g, textoPlaca, x, y + 1, { cor, fonte });
}
// Placa de seta de madeira com um chapeuzinho de neve (dir 1: para a direita).
export function setaPlaca(g, x, y, textoPlaca, dir) {
  sombraNoChao(g, x, y + 2, 20);
  ret(g, x - 3, y - 84, 6, 84, '#6b4a2b');
  const w = 112;
  const x0 = x - w / 2;
  g.fillStyle = '#8a6a44';
  g.beginPath();
  if (dir < 0) { g.moveTo(x0 - 14, y - 72); g.lineTo(x0, y - 88); g.lineTo(x0 + w, y - 88); g.lineTo(x0 + w, y - 56); g.lineTo(x0, y - 56); } else { g.moveTo(x0 + w + 14, y - 72); g.lineTo(x0 + w, y - 88); g.lineTo(x0, y - 88); g.lineTo(x0, y - 56); g.lineTo(x0 + w, y - 56); }
  g.closePath();
  g.fill();
  ret(g, x0 - 2, y - 93, w + 4, 8, '#f7fbff', 4);
  texto(g, textoPlaca, x + dir * 6, y - 71, { fonte: '700 14px "Cinzel", Georgia, serif' });
}
function nuvem(g, x, y, k = 1, a = 0.92) {
  for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]]) el(g, x + dx * k, y + dy * k, r * k, r * 0.75 * k, `rgba(255,255,255,${a})`);
}
function ceu(g, y1, topo = '#7fb3e0', base = '#e3f1fb') {
  g.fillStyle = grad(g, 0, 0, 0, y1, [[0, topo], [1, base]]);
  g.fillRect(0, 0, W, y1);
}
// Uma montanha com o pico nevado.
export function montanha(g, x, base, larg, alt, cor, neve = '#f4f8fd') {
  forma(g, cor, [x - larg / 2, base, x, base - alt, x + larg / 2, base]);
  forma(g, 'rgba(0,0,0,0.06)', [x, base - alt, x + larg / 2, base, x + larg * 0.1, base]);
  const f = 0.34;
  const yc = base - alt * (1 - f);
  forma(g, neve, [x - (larg / 2) * f, yc, x, base - alt, x + (larg / 2) * f, yc, x + larg * f * 0.22, yc + 10, x + larg * f * 0.05, yc - 2, x - larg * f * 0.15, yc + 12]);
}
// Pinheiro com neve nos galhos (x, y: o pé).
export function pinheiro(g, x, y, s = 1, cor = '#2f5d47') {
  sombraNoChao(g, x, y + 1, 26 * s);
  ret(g, x - 4 * s, y - 14 * s, 8 * s, 14 * s, '#5b3c22');
  for (let i = 0; i < 3; i++) {
    const yb = y - (10 + i * 20) * s;
    const hh = 36 * s;
    const hw = (34 - i * 8) * s;
    forma(g, cor, [x - hw, yb, x, yb - hh, x + hw, yb]);
    forma(g, 'rgba(0,0,0,0.12)', [x, yb - hh, x + hw, yb, x + hw * 0.2, yb]);
    forma(g, '#f7fbff', [x - hw * 0.55, yb - hh * 0.45, x, yb - hh, x + hw * 0.55, yb - hh * 0.45, x + hw * 0.22, yb - hh * 0.36, x, yb - hh * 0.5, x - hw * 0.25, yb - hh * 0.34]);
    forma(g, 'rgba(247,251,255,0.9)', [x - hw, yb, x - hw * 0.7, yb - 5 * s, x - hw * 0.3, yb - 2 * s, x - hw * 0.4, yb + 2 * s]);
  }
}
function chaoNeve(g, y0, y1 = H, semente = 3) {
  g.fillStyle = grad(g, 0, y0, 0, y1, [[0, '#e3eef8'], [1, '#fbfdff']]);
  g.fillRect(0, y0, W, y1 - y0);
  for (let x = -20; x < W + 40; x += 48) el(g, x, y0 + 2, 32, 10, '#eef5fb');
  const rnd = sorte(semente);
  for (let k = 0; k < 22; k++) el(g, rnd() * W, y0 + 20 + rnd() * (y1 - y0 - 20), 40 + rnd() * 90, 5 + rnd() * 9, 'rgba(140,170,210,0.13)');
  for (let k = 0; k < 70; k++) el(g, rnd() * W, y0 + rnd() * (y1 - y0), 1.3, 1.3, 'rgba(255,255,255,0.95)');
}
function chaoTabuas(g, y0, y1, cores = ['#a8774a', '#9c6c42', '#b07e50'], linhaCor = 'rgba(60,35,15,0.35)', semente = 11) {
  const rnd = sorte(semente);
  let y = y0;
  while (y < y1) {
    const h = 12 + (y - y0) * 0.06;
    g.fillStyle = cores[Math.floor(rnd() * cores.length)];
    g.fillRect(0, y, W, h);
    g.fillStyle = linhaCor;
    g.fillRect(0, y + h - 1.5, W, 1.5);
    for (let x = rnd() * 200; x < W; x += 180 + rnd() * 160) g.fillRect(x, y, 1.5, h);
    y += h;
  }
}
function chaoPedra(g, y0, y1, cores, fundo, semente = 17) {
  g.fillStyle = fundo;
  g.fillRect(0, y0, W, y1 - y0);
  const rnd = sorte(semente);
  for (let k = 0; k < 160; k++) {
    const y = y0 + rnd() * (y1 - y0);
    const s = 0.5 + (y - y0) / (y1 - y0);
    el(g, rnd() * W, y, (8 + rnd() * 18) * s, (3 + rnd() * 6) * s, cores[Math.floor(rnd() * cores.length)]);
  }
}
// O tapete de "Saída" lá embaixo, no meio.
function tapeteSaida(g, cor = '#7a2f2f', rotulo = 'Saída') {
  ret(g, 430, 566, 140, 32, cor, 6);
  texto(g, rotulo, 500, 583, { fonte: '700 13px "Cinzel", Georgia, serif', cor: '#f4dd80' });
}
// Neve que cai (n flocos). Também serve para poeira e bolhas (cor e vento).
export function nevar(g, t, { n = 70, vel = 38, vento = 14, semente = 1, x0 = 0, x1 = W, y0 = 0, y1 = H, cor = '255,255,255', alfa = 0.85, tam = 1 } = {}) {
  const lw = x1 - x0;
  const lh = y1 - y0;
  for (let k = 0; k < n; k++) {
    const a = hash(k, semente);
    const b = hash(k + 100, semente);
    const c = hash(k + 200, semente);
    const x = x0 + mod(a * lw + t * vento * (0.5 + c) + Math.sin(t * 1.3 + k) * 10, lw);
    const y = y0 + mod(b * lh + t * vel * (0.6 + c * 0.8), lh);
    const r = (1 + c * 2.2) * tam;
    el(g, x, y, r, r, `rgba(${cor},${alfa * (0.5 + c * 0.5)})`);
  }
}
const NEVE = (opcoes = {}) => ({ y: 1e4, desenhar: (g, t) => nevar(g, t, opcoes) });
export function fumaca(g, x, y, t, k = 1) {
  for (let i = 0; i < 4; i++) {
    const f = (t * 0.22 + i / 4) % 1;
    el(g, x + Math.sin(f * 5 + i) * 8 * k + f * 18 * k, y - f * 85 * k, (6 + f * 14) * k, (5 + f * 11) * k, `rgba(236,240,246,${0.5 * (1 - f)})`);
  }
}
// Neve em cima de uma beirada (telhado, parapeito).
function neveEm(g, x, y, w) {
  ret(g, x - 3, y - 7, w + 6, 10, '#f7fbff', 5);
  for (let i = 0; i < Math.floor(w / 26); i++) el(g, x + 10 + i * 26, y + 2, 4, 5 + (i % 2) * 2, '#f7fbff');
}
function janelaQuente(g, x, y, w, h, quadro = '#5b3c22') {
  ret(g, x - 4, y - 4, w + 8, h + 8, quadro, 4);
  ret(g, x, y, w, h, grad(g, 0, y, 0, y + h, [[0, '#ffe7a3'], [1, '#f5b85a']]), 2);
  g.fillStyle = quadro;
  g.fillRect(x + w / 2 - 1.5, y, 3, h);
  g.fillRect(x, y + h / 2 - 1.5, w, 3);
  neveEm(g, x - 4, y + h + 6, w + 8);
}
function janelaNevando(g, x, y, w, h, t, semente = 5) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  nevar(g, t, { n: 18, x0: x, x1: x + w, y0: y, y1: y + h, vel: 22, vento: 8, semente, tam: 0.8 });
  g.restore();
}

/* ─── Coelhos da região (NPCs) e o raposinho ─── */

const NPCS = {
  'npc-cacau': { nome: 'Dona Cacau', sala: 'no balcão de chocolate quente da Cabana do Esqui', pelo: '#8a6a4f', roupa: { cabeca: 'gorro', pescoco: 'cachecol', corpo: 'avental' }, escala: 1.25 },
  'npc-professora': { nome: 'Professora Orelhuda', sala: 'ao lado do quadro da Escola', pelo: '#f7f3ea', roupa: { rosto: 'oculos', pescoco: 'perolas', corpo: 'vestido' }, escala: 1.25 },
  'npc-mineiro': { nome: 'Velho Mineiro', sala: 'na Caverna da Mina', pelo: '#9aa3ad', roupa: { cabeca: 'gorro', rosto: 'bigode', corpo: 'colete', mao: 'lanterna' }, escala: 1.2 },
  'npc-operario': { nome: 'Operária da Usina', sala: 'na Usina de Reciclagem', pelo: '#c99a6b', roupa: { cabeca: 'bone', corpo: 'colete' }, escala: 1.2 },
  'npc-instrutor': { nome: 'Instrutor de Esqui', sala: 'na largada da Estação de Esqui', pelo: '#d9b48a', roupa: { cabeca: 'gorro', rosto: 'escuros', pescoco: 'cachecol', corpo: 'moletom' }, escala: 1.2 },
};
function npc(g, id, x, y, t, dir = 1) {
  const n = NPCS[id];
  if (temSprite(`ilha-neve.${id}`)) {
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
// O que cada NPC fala quando a gente clica (uma frase por vez, sorteada).
const FALAS = {
  'npc-cacau': ['Chocolate quente com marshmallow, saindo!', 'Lá em cima, no Sótão, tem a mesa do Lig 4. Quer jogar?', 'O relógio cuco canta de tempos em tempos. Ele é mais velho que eu!'],
  'npc-professora': ['Clique no quadro para o Quiz da Ilha!', 'Sabia que os Pompons adoram o frio da Piscina Subterrânea?', 'A lição de hoje muda toda hora. Coelho curioso aprende mais!'],
  'npc-mineiro': ['Lá dentro tem ouro! Pegue uma britadeira e cuidado com as pedras soltas.', 'Dizem que, atrás de uma fenda aqui na caverna, tem um lago que brilha...', 'A escada desce para a Piscina Subterrânea. Água geladinha!'],
  'npc-operario': ['Papel no azul, plástico no vermelho, metal no amarelo e vidro no verde!', 'Esta máquina transforma lixo em coisas novas. Que barulheira boa!', 'Quer ajudar? Clique na esteira e separe o lixo.'],
  'npc-instrutor': ['Clique na largada para a Corrida de Trenó!', 'Pegue as setas de turbo e fuja das pedras. O gelo faz o trenó escorregar!', 'Daqui de cima dá para ver a ilha inteirinha.'],
};

// Um raposinho (filhote de raposa) em pé, com gorro (x, y: os pés). arremesso: 0 a 1 (o braço girando).
export function raposinho(g, x, y, { dir = 1, t = 0, gorro = '#4a8fd8', arremesso = 0, bola = true, semSprite = false } = {}) {
  if (!semSprite && sp(g, 'raposinho', arremesso > 0.2 ? 'arremessando' : 'parado', x, y, { t, dir })) return;
  g.save();
  g.translate(x, y - Math.abs(Math.sin(t * 3)) * 1.2);
  g.scale(dir, 1);
  el(g, -15, -14, 12, 7, '#d8743a', -0.7);
  el(g, -23, -21, 5, 4, '#fbf3e6', -0.7);
  el(g, 0, -14, 12, 13, '#d8743a');
  el(g, 2, -10, 7, 8.5, '#fbf3e6');
  el(g, -5, -2, 5.5, 3, '#3a2416');
  el(g, 6, -2, 5.5, 3, '#3a2416');
  g.save();
  g.translate(3, -21);
  g.rotate(0.5 - arremesso * 2.6);
  ret(g, -2.5, 0, 5, 13, '#c4652f', 2.5);
  if (bola) el(g, 0, 14, 4.5, 4.5, '#ffffff');
  g.restore();
  el(g, 6, -32, 11, 10, '#d8743a');
  el(g, 14, -28.5, 7.5, 4.5, '#fbf3e6');
  el(g, 21, -30, 2.2, 1.9, '#1b1403');
  el(g, 11, -34, 1.8, 2.1, '#1b1403');
  el(g, 11.5, -34.7, 0.6, 0.6, '#ffffff');
  forma(g, '#d8743a', [-2, -38, 0, -52, 7, -40]);
  forma(g, '#d8743a', [7, -40, 12, -53, 15, -38]);
  forma(g, '#3a2416', [0, -41, 0.8, -48, 4.5, -41]);
  forma(g, '#3a2416', [9, -41, 11.5, -49, 13, -40]);
  g.fillStyle = gorro;
  g.beginPath();
  g.ellipse(6, -39, 11.5, 7.5, 0, Math.PI, 0);
  g.fill();
  ret(g, -6, -41, 24, 4.5, '#ffffff', 2);
  el(g, 6, -47.5, 3.5, 3.5, '#ffffff');
  g.restore();
}

/* ─── As peças que podem virar sprite (desenhadas com o pé em 0, 0) ─── */

function forteNeveCorpo(g) {
  ret(g, -112, -64, 224, 64, grad(g, 0, -64, 0, 0, [[0, '#ffffff'], [1, '#d3e3f2']]), 10);
  for (let i = 0; i < 7; i++) {
    ret(g, -112 + i * 33, -84, 25, 26, '#f6fbff', 6);
    ret(g, -112 + i * 33, -62, 25, 4, 'rgba(150,180,210,0.35)', 2);
  }
  g.strokeStyle = 'rgba(140,170,205,0.5)';
  g.lineWidth = 1.5;
  for (const [y, d] of [[-42, 0], [-20, 18]]) {
    g.beginPath(); g.moveTo(-108, y); g.lineTo(108, y); g.stroke();
    for (let x = -96 + d; x < 108; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 21); g.stroke(); }
  }
  ret(g, -112, -14, 224, 14, 'rgba(120,150,190,0.22)', 6);
  for (const [x, y] of [[-80, -52], [-20, -30], [50, -50], [90, -18]]) el(g, x, y, 1.6, 1.6, '#ffffff');
}
function pilhaBolasCorpo(g) {
  const r = 9;
  const filas = [4, 3, 2, 1];
  for (let i = 0; i < 4; i++) for (let j = 0; j < filas[i]; j++) {
    const x = (j - (filas[i] - 1) / 2) * r * 2;
    const y = -r - i * r * 1.7;
    el(g, x, y, r, r, '#eef5fb');
    el(g, x + 2, y + 4, r * 0.65, r * 0.32, 'rgba(140,170,210,0.35)');
    el(g, x - 3, y - 3, r * 0.4, r * 0.35, '#ffffff');
  }
}
function bonecoNeveCorpo(g, t = 0) {
  el(g, 0, -22, 25, 22, '#f2f7fc');
  el(g, 4, -14, 18, 10, 'rgba(140,170,210,0.25)');
  el(g, 0, -57, 18, 16, '#f6fbff');
  el(g, 0, -86, 14, 13, '#ffffff');
  for (const [dx, rot] of [[-6, -0.22], [6, 0.22]]) {
    el(g, dx, -108, 4.6, 14, '#ffffff', rot);
    el(g, dx, -107, 2, 9, '#f2b8c0', rot);
  }
  el(g, -4.5, -89, 1.9, 2.1, '#1b1403');
  el(g, 4.5, -89, 1.9, 2.1, '#1b1403');
  forma(g, '#e07a2a', [0, -85, 15, -82, 0, -80]);
  ret(g, -16, -74, 32, 7, '#c0392b', 3);
  ret(g, 5, -71, 7, 19 + Math.sin(t * 2) * 1.5, '#c0392b', 3);
  for (const y of [-60, -50, -28]) el(g, 0, y, 2.2, 2.2, '#2a2a30');
  linha(g, '#6b4a2b', 3, [-16, -58, -38, -74]);
  linha(g, '#6b4a2b', 3, [16, -58, 38, -70]);
  linha(g, '#6b4a2b', 2, [-31, -69, -36, -80]);
}
function posteNeveCorpo(g) {
  ret(g, -3, -120, 6, 120, '#2f2f38');
  ret(g, -10, -4, 20, 6, '#2f2f38', 2);
  ret(g, -12, -140, 24, 24, '#2f2f38', 4);
  ret(g, -9, -137, 18, 18, '#ffe9a8', 3);
  el(g, 0, -143, 15, 5, '#f7fbff');
}
function cadeiraTeleCorpo(g) {
  linha(g, '#3a3a44', 2.5, [0, 0, 0, 26]);
  ret(g, -18, 26, 36, 6, '#c0392b', 3);
  ret(g, 13, 8, 5, 22, '#c0392b', 2);
  linha(g, '#3a3a44', 2, [-18, 18, 15, 18]);
  ret(g, -17, 23, 34, 3, '#f7fbff', 2);
}
function relogioCucoCorpo(g) {
  forma(g, '#4a2e18', [-34, -20, 34, -20, 0, -50]);
  forma(g, '#f7fbff', [-30, -24, 0, -49, 30, -24, 18, -25, 0, -38, -16, -25]);
  ret(g, -25, -22, 50, 50, '#8a5a32', 3);
  ret(g, -6, -18, 12, 12, '#3a2414', 2);
  el(g, 0, 8, 15, 15, '#fbf6e6');
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, Math.cos(a) * 12, 8 + Math.sin(a) * 12, 1.1, 1.1, '#3a2414'); }
  for (const dx of [-22, 22]) el(g, dx, 20, 5, 3, '#4f8a3c', dx > 0 ? 0.6 : -0.6);
}
function carrinhoMinaCorpo(g, t = 0, anim = 'vazio') {
  forma(g, '#6c5a4a', [-32, -46, 32, -46, 25, -11, -25, -11]);
  ret(g, -34, -50, 68, 7, '#4a3c30', 2);
  for (const x of [-22, 0, 22]) ret(g, x - 1.5, -44, 3, 32, 'rgba(0,0,0,0.18)');
  for (const x of [-26, 26]) el(g, x, -40, 1.8, 1.8, '#a9a097');
  if (anim === 'cheio') {
    el(g, 0, -50, 28, 11, '#d8a830');
    for (const [x, y, r] of [[-14, -54, 6], [2, -58, 7], [16, -53, 6], [-4, -50, 5], [10, -48, 5]]) { el(g, x, y, r, r * 0.8, '#f0c84a'); el(g, x - 2, y - 2, r * 0.35, r * 0.3, '#fff3b0'); }
  }
  for (const x of [-18, 18]) { el(g, x, -8, 7.5, 7.5, '#2f2f38'); el(g, x, -8, 2.5, 2.5, '#8a8a94'); }
}
function trenoCorpo(g, t = 0, anim = 'parado', o = {}) {
  const cor = o.cor || '#c0392b';
  g.strokeStyle = '#5b3c22';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-32, -2);
  g.lineTo(24, -2);
  g.quadraticCurveTo(38, -2, 34, -16);
  g.stroke();
  for (const x of [-22, 0, 18]) ret(g, x - 2, -14, 4, 12, '#5b3c22');
  ret(g, -30, -20, 56, 9, cor, 3);
  ret(g, -30, -20, 56, 3, 'rgba(255,255,255,0.3)', 2);
}
const COR_POMPOM = { rosa: '#f08ab8', azul: '#5aa8e8', amarelo: '#f4d03f', verde: '#6fcf6a', roxo: '#a678e0', preto: '#3a3540', branco: '#f4f1ea', laranja: '#f39a3c' };
export const CORES_POMPOM = Object.values(COR_POMPOM);
function pompomCorpo(g, t = 0, anim = 'pulando', o = {}) {
  const cor = o.cor || COR_POMPOM.rosa;
  const dormindo = anim === 'dormindo';
  const pulo = dormindo ? 0 : -Math.abs(Math.sin(t * 5)) * 7;
  const achata = dormindo ? 0.85 : 1;
  g.save();
  g.translate(0, pulo);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, Math.cos(a) * 12, -14 * achata + Math.sin(a) * 11 * achata, 4.5, 4.5, cor); }
  el(g, 0, -14 * achata, 13, 12 * achata, cor);
  for (const [dx, rot] of [[-3, -0.4], [0, 0], [3, 0.4]]) el(g, dx, -28 * achata, 1.6, 5, cor, rot);
  el(g, -4, -19 * achata, 5, 3.5, 'rgba(255,255,255,0.35)');
  if (dormindo) {
    linha(g, '#1b1403', 1.4, [-6, -14, -2, -14]);
    linha(g, '#1b1403', 1.4, [2, -14, 6, -14]);
  } else {
    el(g, -4, -15, 2.1, 2.7, '#1b1403');
    el(g, 4, -15, 2.1, 2.7, '#1b1403');
    el(g, -3.4, -16, 0.7, 0.7, '#ffffff');
    el(g, 4.6, -16, 0.7, 0.7, '#ffffff');
  }
  el(g, 0, -10 * achata, 1.8, 1.2, '#e9867d');
  g.restore();
}
export function desenharPompom(g, x, y, t, cor = COR_POMPOM.rosa, anim = 'pulando', escala = 1) {
  el(g, x, y + 1, 12 * escala, 3.5 * escala, 'rgba(0,0,0,0.22)');
  if (sp(g, 'pompom', anim, x, y, { t, cor, escala })) return;
  g.save();
  g.translate(x, y);
  g.scale(escala, escala);
  pompomCorpo(g, t, anim, { cor });
  g.restore();
}
function lareiraCorpo(g, t = 0) {
  ret(g, -62, -400, 124, 210, '#7f7d78');
  for (let y = -392; y < -200; y += 22) for (let x = -58 + ((y / 22) % 2 ? 0 : 14); x < 56; x += 30) ret(g, x, y, 26, 18, (x + y) % 3 ? '#8c8a86' : '#9c9a95', 3);
  ret(g, -96, -196, 192, 196, '#8c8a86', 4);
  const rnd = sorte(23);
  for (let y = -188; y < 0; y += 24) for (let x = -92 + (y % 48 ? 0 : 16); x < 90; x += 34) ret(g, x, y, 30, 20, ['#9c9a95', '#87857f', '#a5a39d'][Math.floor(rnd() * 3)], 4);
  ret(g, -106, -206, 212, 16, '#6b4226', 3);
  ret(g, -58, -128, 116, 128, '#2a1c10', 46);
  ret(g, -58, -40, 116, 40, '#2a1c10');
  for (const [dx, rot] of [[-14, 0.35], [14, -0.35]]) { g.save(); g.translate(dx, -12); g.rotate(rot); ret(g, -24, -5, 48, 10, '#5b3c22', 4); g.restore(); }
  const tremor = k => Math.sin(t * 11 + k) * 3;
  el(g, tremor(1) * 0.6, -36, 24, 34 + tremor(2), '#e0682a');
  el(g, tremor(3) * 0.7 - 10, -30, 12, 22 + tremor(4), '#f08a2a');
  el(g, tremor(5) * 0.7 + 12, -30, 12, 20 + tremor(6), '#f08a2a');
  el(g, tremor(7) * 0.5, -26, 13, 22 + tremor(8), '#f4b03a');
  el(g, 0, -18, 7, 11, '#fff1a8');
  // Na prateleira: canecas e um porta-retrato
  for (const [x, c] of [[-70, '#c0392b'], [-50, '#2f6b9a']]) { ret(g, x, -224, 14, 16, c, 3); el(g, x + 7, -224, 6, 2, '#6b3a1e'); }
  ret(g, 40, -236, 30, 28, '#b8922a', 3);
  ret(g, 44, -232, 22, 20, '#a8d0ec', 2);
  el(g, 55, -224, 5, 5, '#f7f3ea');
}
function balcaoCacauCorpo(g, t = 0) {
  ret(g, -115, -76, 230, 18, '#c9a06a', 4);
  ret(g, -110, -58, 220, 58, '#7a4a2a', 2);
  for (let x = -100; x < 100; x += 52) ret(g, x, -50, 44, 42, '#6b3e22', 3);
  ret(g, -84, -112, 46, 36, '#4a4a54', 9);
  el(g, -61, -112, 22, 6, '#3a3a44');
  el(g, -61, -111, 18, 4, '#6b3a1e');
  ret(g, -90, -100, 6, 12, '#3a3a44', 2);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.6 + k / 3) % 1;
    el(g, -61 + Math.sin(f * 6 + k) * 6, -118 - f * 40, 4 + f * 7, 4 + f * 6, `rgba(255,255,255,${0.45 * (1 - f)})`);
  }
  for (let i = 0; i < 4; i++) {
    const x = -10 + i * 28;
    ret(g, x, -96, 18, 20, ['#c0392b', '#2f6b9a', '#3a7a3c', '#d8b13a'][i], 4);
    ret(g, x + 17, -91, 5, 10, ['#c0392b', '#2f6b9a', '#3a7a3c', '#d8b13a'][i], 3);
    el(g, x + 9, -97, 8, 4, '#ffffff');
    el(g, x + 6, -100, 3, 2.5, '#fbe9f0');
  }
}
function mesaLig4Corpo(g, t = 0) {
  for (const x of [-210, 200]) ret(g, x, -56, 10, 56, '#5b3420');
  ret(g, -240, -78, 480, 24, '#8a5a32', 6);
  ret(g, -240, -84, 480, 14, '#a8774a', 6);
  ret(g, -200, -86, 400, 4, '#e8dcc3', 2);
  ret(g, -226, -24, 452, 11, '#7a4a2a', 4);
  for (const x of [-210, -10, 200]) ret(g, x, -14, 8, 14, '#5b3420');
  // O tabuleiro do Lig 4
  ret(g, -58, -84, 8, 10, '#1f3f80');
  ret(g, 50, -84, 8, 10, '#1f3f80');
  ret(g, -54, -172, 108, 92, '#2f5fb0', 8);
  const cores = '.......|.......|...a...|..vav..|.avva..|vaavva.'.split('|');
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    const v = cores[r][c];
    el(g, -42 + c * 14, -160 + r * 14, 5.4, 5.4, v === 'a' ? '#e8c24a' : v === 'v' ? '#d8504a' : '#1a2a50');
  }
  // Pratos, canecas e velas
  for (const x of [-170, -110, 110, 170]) { el(g, x, -80, 16, 5, '#f2e8cf'); el(g, x, -81, 9, 3, '#e07a2a'); }
  for (const x of [-140, 140]) {
    ret(g, x - 3, -108, 6, 26, '#f2e8cf', 2);
    const f = Math.sin(t * 9 + x) * 1.5;
    el(g, x, -114 + f * 0.3, 3.5, 6 + f, '#f4b03a');
    el(g, x, -112, 1.6, 3, '#fff1a8');
  }
}
function portaoLargadaCorpo(g) {
  for (const x of [-196, 186]) {
    ret(g, x, -186, 12, 186, '#7a4a2a', 3);
    el(g, x + 6, -190, 10, 5, '#f7fbff');
  }
  ret(g, -204, -188, 408, 46, '#c0392b', 6);
  for (let k = 0; k < 34; k++) { ret(g, -204 + k * 12, -188, 6, 6, k % 2 ? '#1b1b22' : '#ffffff'); ret(g, -204 + k * 12, -148, 6, 6, k % 2 ? '#ffffff' : '#1b1b22'); }
  texto(g, 'Corrida de Trenó', 0, -164, { fonte: '700 22px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.35)' });
  ret(g, -180, -10, 360, 6, '#e8c24a', 3);
  for (const x of [-90, 0, 90]) { ret(g, x - 3, -40, 6, 40, '#e9dcc3', 2); el(g, x, -42, 6, 3, '#f7fbff'); }
}
function maquinaReciclagemCorpo(g, t = 0) {
  forma(g, '#5d6b73', [-90, -236, 90, -236, 60, -286, -60, -286]);
  forma(g, '#2a3236', [-70, -282, 70, -282, 58, -268, -58, -268]);
  ret(g, -122, -240, 244, 240, '#3f7a5a', 12);
  ret(g, -122, -240, 244, 10, '#4f8f6a', 6);
  ret(g, -102, -218, 204, 86, '#2c5a42', 8);
  for (const [x, v] of [[-62, 0.9], [-12, 1.7]]) {
    el(g, x, -176, 21, 21, '#e8e2d0');
    el(g, x, -176, 17, 17, '#fbf6e6');
    const a = -2.4 + Math.sin(t * v) * 0.9 + 1.2;
    linha(g, '#c0392b', 2.5, [x, -176, x + Math.cos(a) * 14, -176 + Math.sin(a) * 14]);
    el(g, x, -176, 2.5, 2.5, '#3a3a44');
  }
  for (let k = 0; k < 4; k++) {
    const aceso = (Math.floor(t * 3) + k) % 4 === 0;
    el(g, 40 + (k % 2) * 26, -194 + Math.floor(k / 2) * 26, 8, 8, aceso ? ['#7fe08a', '#ffe46b', '#ff8a8a', '#6be0ff'][k] : '#1e3a2c');
  }
  ret(g, -56, -112, 112, 46, '#141a1c', 8);
  for (let k = 0; k < 5; k++) ret(g, -50 + k * 22, -110, 14, 6, '#2a3236', 2);
  texto(g, '♻', 0, -42, { cor: '#bff0c8', fonte: '700 44px sans-serif' });
  g.save();
  g.translate(96, -40);
  g.rotate(t * 1.5);
  el(g, 0, 0, 26, 26, '#a9a097');
  for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); ret(g, -5, -32, 10, 10, '#a9a097', 2); }
  el(g, 0, 0, 8, 8, '#5d6b73');
  g.restore();
}
function carteiraCorpo(g) {
  ret(g, -34, -50, 68, 10, '#b07e50', 3);
  ret(g, -30, -40, 4, 40, '#5b3c22');
  ret(g, 26, -40, 4, 40, '#5b3c22');
  ret(g, -30, -40, 60, 14, '#9c6c42', 2);
  ret(g, -16, -58, 22, 8, '#5aa0d8', 2);
  ret(g, -16, -58, 22, 2, '#ffffff', 1);
  ret(g, 10, -55, 14, 3, '#e8c24a', 1);
}
function raposinhoCorpo(g, t = 0, anim = 'parado') {
  raposinho(g, 0, 0, { t, arremesso: anim === 'arremessando' ? 1 : 0, semSprite: true });
}

const ANIM = (id, nome, quadros = 1, fps = 1) => ({ id, nome, quadros, fps });
const PARADO = [ANIM('parado', 'Parado')];
const NO_CHAO = ' A sombra continua feita pelo jogo.';
const PECAS = {
  'forte-neve': { nome: 'Forte de neve', desc: `Os dois fortes de blocos de neve do Forte Nevado. A bandeira e o raposinho espiando continuam feitos pelo jogo.${NO_CHAO}`, l: 228, a: 90, anims: PARADO, corpo: forteNeveCorpo },
  'pilha-bolas': { nome: 'Pilha de bolas de neve', desc: `As pirâmides de bolas de neve do Forte Nevado.${NO_CHAO}`, l: 74, a: 64, anims: PARADO, corpo: pilhaBolasCorpo },
  'boneco-neve': { nome: 'Boneco de neve orelhudo', desc: `O boneco de neve com orelhas de coelho e cachecol vermelho (no Forte e na Vila).${NO_CHAO}`, l: 80, a: 124, anims: [ANIM('parado', 'Parado', 2, 2)], corpo: bonecoNeveCorpo },
  'poste-neve': { nome: 'Poste com neve', desc: `Os postes de luz da Vila de Esqui. O brilho da lâmpada continua feito pelo jogo.${NO_CHAO}`, l: 30, a: 150, anims: [ANIM('aceso', 'Aceso')], corpo: posteNeveCorpo },
  'cadeira-teleferico': { nome: 'Cadeirinha do teleférico', desc: 'As cadeirinhas que sobem e descem pelo cabo do teleférico (a âncora é onde a cadeira prende no cabo).', l: 40, a: 34, ancora: 'topo', anims: PARADO, corpo: cadeiraTeleCorpo },
  'relogio-cuco': { nome: 'Relógio cuco', desc: 'O relógio cuco na parede da Cabana do Esqui. Os ponteiros, o pêndulo e o passarinho continuam feitos pelo jogo.', l: 70, a: 80, ancora: 'centro', anims: PARADO, corpo: relogioCucoCorpo },
  'carrinho-mina': { nome: 'Carrinho de mina', desc: `Os carrinhos que andam nos trilhos da Mina, vazios ou cheios de ouro.${NO_CHAO}`, l: 70, a: 66, anims: [ANIM('vazio', 'Vazio'), ANIM('cheio', 'Cheio de ouro')], corpo: carrinhoMinaCorpo },
  treno: { nome: 'Trenó', desc: 'Os trenós da Estação de Esqui e da Corrida de Trenó. Olhando para a direita; marque "pintar com a cor" para cada um ter a sua cor.', l: 72, a: 24, anims: PARADO, corpo: trenoCorpo, tingir: true },
  pompom: { nome: 'Pompom', desc: 'Os Pompons, bichinhos de pelúcia redondos (na Piscina e no Resgate dos Pompons). Marque "pintar com a cor" e desenhe em tons claros: cada um tem a sua cor. A sombra continua feita pelo jogo.', l: 40, a: 40, anims: [ANIM('pulando', 'Pulando', 4, 8), ANIM('dormindo', 'Dormindo')], corpo: pompomCorpo, tingir: true },
  lareira: { nome: 'Lareira da Cabana', desc: 'A lareira de pedra da Cabana do Esqui, com a chaminé até o teto. O clarão do fogo continua feito pelo jogo.', l: 212, a: 400, anims: [ANIM('fogo', 'Fogo aceso', 4, 8)], corpo: lareiraCorpo },
  'balcao-cacau': { nome: 'Balcão do chocolate quente', desc: 'O balcão da Dona Cacau, com o caldeirão de chocolate soltando vapor e as canecas com marshmallow. A Dona Cacau é outra peça.', l: 232, a: 160, anims: [ANIM('vapor', 'Soltando vapor', 4, 3)], corpo: balcaoCacauCorpo },
  'mesa-lig4': { nome: 'Mesa do Lig 4', desc: 'A mesa comprida do Sótão, com o tabuleiro do Lig 4, os pratos e as velas.', l: 484, a: 176, anims: [ANIM('velas', 'Velas acesas', 2, 4)], corpo: mesaLig4Corpo },
  'portao-largada': { nome: 'Largada da Corrida de Trenó', desc: 'O portão da largada no topo da montanha (as letras fazem parte do desenho). As bandeirinhas continuam feitas pelo jogo.', l: 412, a: 194, anims: PARADO, corpo: portaoLargadaCorpo },
  'maquina-reciclagem': { nome: 'Máquina de reciclagem', desc: 'A grande máquina da Usina de Reciclagem, com os ponteiros, as luzes e a engrenagem girando.', l: 270, a: 290, anims: [ANIM('funcionando', 'Funcionando', 4, 6)], corpo: maquinaReciclagemCorpo },
  carteira: { nome: 'Carteira da Escola', desc: `As carteiras dos alunos, com um caderno e um lápis.${NO_CHAO}`, l: 70, a: 60, anims: PARADO, corpo: carteiraCorpo },
  raposinho: { nome: 'Raposinho', desc: 'Os raposinhos (filhotes de raposa) que espiam do forte e jogam bolas de neve na Guerra de Bolas de Neve. Olhando para a direita.', l: 54, a: 58, anims: [ANIM('parado', 'Parado', 2, 3), ANIM('arremessando', 'Arremessando')], corpo: raposinhoCorpo },
};
// Desenha uma peça (o sprite, se tiver; senão o desenho de sempre). o.dir = -1 vira para a esquerda.
export function peca(g, id, x, y, t = 0, anim = null, o = {}) {
  const p = PECAS[id];
  const a = anim || p.anims[0].id;
  if (sp(g, id, a, x, y, { t, ...o })) return;
  g.save();
  g.translate(x, y);
  if (o.dir === -1) g.scale(-1, 1);
  if (o.escala) g.scale(o.escala, o.escala);
  p.corpo(g, t, a, o);
  g.restore();
}

/* ─── Forte Nevado ─── */

function torreDoRelogio(g) {
  const x = 500;
  const b = 314;
  el(g, x, b, 74, 10, 'rgba(60,80,110,0.2)');
  ret(g, x - 44, b - 172, 88, 172, '#8a6a52');
  const rnd = sorte(31);
  for (let y = b - 168; y < b - 6; y += 16) for (let xx = x - 42 + ((y / 16) % 2 ? 0 : 10); xx < x + 38; xx += 22) ret(g, xx, y, 18, 12, ['#9c7c62', '#94745a', '#a5856a'][Math.floor(rnd() * 3)], 2);
  ret(g, x - 52, b - 184, 104, 14, '#6b4f3c', 3);
  neveEm(g, x - 52, b - 182, 104);
  ret(g, x - 48, b - 254, 96, 72, '#b88c5a', 4);
  forma(g, '#6b3a2a', [x - 64, b - 252, x + 64, b - 252, x, b - 326]);
  forma(g, '#f7fbff', [x - 60, b - 256, x, b - 324, x + 60, b - 256, x + 40, b - 252, x + 22, b - 266, x, b - 258, x - 24, b - 268, x - 42, b - 252]);
  linha(g, '#3a2a1a', 2, [x, b - 326, x, b - 352]);
  forma(g, '#e07a2a', [x - 2, b - 352, x + 18, b - 349, x - 2, b - 346]);
  el(g, x - 4, b - 349, 3, 5, '#4f8a3c');
  el(g, x, b - 214, 34, 34, '#5b3c22');
  el(g, x, b - 214, 29, 29, '#fbf6e6');
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, x + Math.cos(a) * 24, b - 214 + Math.sin(a) * 24, k % 3 ? 1.4 : 2.4, k % 3 ? 1.4 : 2.4, '#3a2414'); }
  for (const dy of [-130, -84]) ret(g, x - 10, b + dy, 20, 30, '#ffe39a', 9);
  ret(g, x - 18, b - 50, 36, 50, '#4a2e18', 16);
  el(g, x + 10, b - 24, 2.5, 2.5, '#e8c24a');
}
function fundoForte(g) {
  ceu(g, 320, '#86b9e4', '#e8f4fc');
  brilho(g, 830, 76, 90, 'rgba(255,246,216,A)', 0.7);
  el(g, 830, 76, 30, 30, '#fff8e2');
  nuvem(g, 80, 70, 0.9);
  nuvem(g, 620, 46, 0.7);
  montanha(g, 150, 304, 440, 176, '#a9bfd6');
  montanha(g, 400, 304, 360, 120, '#9db4cc');
  montanha(g, 870, 304, 480, 206, '#a3b9d1');
  for (const [x, s] of [[24, 0.9], [78, 1.1], [150, 0.8], [330, 0.85], [670, 0.9], [820, 1.05], [880, 0.85], [960, 1.1]]) pinheiro(g, x, 306, s);
  chaoNeve(g, 300, H, 21);
  el(g, 50, 470, 150, 36, 'rgba(150,175,205,0.22)');
  el(g, 950, 470, 150, 36, 'rgba(150,175,205,0.22)');
  el(g, 500, 520, 320, 54, 'rgba(150,175,205,0.14)');
  torreDoRelogio(g);
}
function animarForte(g, t) {
  // A hora de verdade no relógio da torre.
  const d = new Date();
  const hh = (d.getHours() % 12) + d.getMinutes() / 60;
  const mm = d.getMinutes() + d.getSeconds() / 60;
  const cx = 500;
  const cy = 100;
  linha(g, '#1b1403', 3.5, [cx, cy, cx + Math.cos((hh / 12) * Math.PI * 2 - Math.PI / 2) * 14, cy + Math.sin((hh / 12) * Math.PI * 2 - Math.PI / 2) * 14]);
  linha(g, '#1b1403', 2, [cx, cy, cx + Math.cos((mm / 60) * Math.PI * 2 - Math.PI / 2) * 22, cy + Math.sin((mm / 60) * Math.PI * 2 - Math.PI / 2) * 22]);
  el(g, cx, cy, 3, 3, '#c0392b');
  for (const y of [199, 245]) brilho(g, 500, y, 34, 'rgba(255,220,140,A)', 0.18 + Math.sin(t * 2 + y) * 0.04);
  for (let k = 0; k < 12; k++) {
    const a = Math.max(0, Math.sin(t * 2.2 + k * 1.7));
    el(g, 60 + hash(k, 9) * 880, 320 + hash(k, 10) * 270, a * 2.2, a * 2.2, `rgba(255,255,255,${a})`);
  }
}
function bandeira(g, x, y, t, cor, alt = 110) {
  ret(g, x - 2.5, y - alt, 5, alt, '#5b3c22');
  el(g, x, y - alt - 2, 4.5, 4.5, '#e8c24a');
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x + 2, y - alt + 2);
  for (let k = 0; k <= 8; k++) g.lineTo(x + 2 + k * 6, y - alt + 2 + Math.sin(t * 5 - k * 0.7) * 3 * (k / 8));
  for (let k = 8; k >= 0; k--) g.lineTo(x + 2 + k * 6, y - alt + 30 + Math.sin(t * 5 - k * 0.7) * 3 * (k / 8));
  g.closePath();
  g.fill();
}
function forte(g, x, y, t, cor, lado, comRaposa = false) {
  sombraNoChao(g, x, y + 2, 120, 16);
  if (comRaposa) {
    // Um raposinho espia por cima do muro de vez em quando.
    const ciclo = Math.floor(t / 6);
    const f = (t % 6) / 6;
    if (f < 0.32) {
      const h = Math.sin((f / 0.32) * Math.PI);
      const rx = x - 80 + hash(ciclo, 4) * 160;
      raposinho(g, rx, y - 20 - h * 30, { dir: -1, t, gorro: ['#e05a4a', '#7b5ab8', '#3a9a5a'][ciclo % 3], bola: false });
    }
  }
  peca(g, 'forte-neve', x, y, t);
  bandeira(g, x + lado * 98, y - 60, t, cor);
}
function pilhaBolas(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 38, 8);
  peca(g, 'pilha-bolas', x, y, t);
}
function bonecoNeve(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 30, 8);
  peca(g, 'boneco-neve', x, y, t);
}
function placaGuerra(g) {
  sombraNoChao(g, 500, 402, 70, 8);
  ret(g, 444, 360, 7, 42, '#6b4a2b');
  ret(g, 549, 360, 7, 42, '#6b4a2b');
  placa(g, 500, 356, 168, 46, 'Guerra de Bolas', { fundo: '#2f6b9a', borda: '#1f4a70', fonte: '700 17px "Cinzel", Georgia, serif' });
  texto(g, 'de Neve', 500, 376, { cor: '#ffe9a8', fonte: '700 12px "Cinzel", Georgia, serif' });
}

/* ─── Vila de Esqui ─── */

function entradaMina(g) {
  forma(g, '#77736d', [20, 346, 30, 260, 70, 214, 120, 206, 160, 236, 178, 300, 186, 346]);
  forma(g, '#8a867f', [40, 300, 72, 226, 116, 216, 98, 250, 70, 300]);
  el(g, 100, 216, 52, 14, '#f7fbff');
  el(g, 62, 226, 22, 9, '#f7fbff');
  ret(g, 64, 258, 72, 88, '#1a1410', 34);
  ret(g, 64, 300, 72, 46, '#1a1410');
  brilho(g, 100, 320, 40, 'rgba(255,190,90,A)', 0.18);
  ret(g, 56, 256, 10, 90, '#7a5434');
  ret(g, 134, 256, 10, 90, '#7a5434');
  ret(g, 50, 248, 100, 13, '#8a6040', 3);
  neveEm(g, 50, 250, 100);
  for (let k = 0; k < 6; k++) ret(g, 72 - k * 3, 336 + k * 6, 56 + k * 6, 3, '#5b3c22');
  linha(g, '#8a8a94', 2, [78, 336, 62, 372]);
  linha(g, '#8a8a94', 2, [122, 336, 138, 372]);
  ret(g, 150, 284, 5, 62, '#5b3c22');
  ret(g, 145, 270, 15, 16, '#3a2a1a', 3);
  ret(g, 148, 273, 9, 10, '#ffd98a', 2);
  placa(g, 100, 232, 76, 24, 'Mina', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function usina(g) {
  ret(g, 192, 202, 150, 144, '#7f9a8a');
  for (let x = 196; x < 340; x += 10) ret(g, x, 202, 4, 144, 'rgba(0,0,0,0.07)');
  ret(g, 186, 194, 162, 12, '#5d6b73', 2);
  neveEm(g, 186, 196, 162);
  ret(g, 300, 136, 20, 62, '#6c7a80', 2);
  ret(g, 296, 132, 28, 8, '#5d6b73', 2);
  el(g, 310, 130, 13, 4, '#f7fbff');
  ret(g, 232, 268, 66, 78, '#4f5f58', 3);
  for (let y = 272; y < 344; y += 8) ret(g, 234, y, 62, 3, 'rgba(255,255,255,0.08)');
  el(g, 210, 238, 13, 13, '#3a9a5a');
  texto(g, '♻', 210, 239, { cor: '#ffffff', fonte: '700 17px sans-serif' });
  for (const x of [312]) { ret(g, x, 238, 22, 18, '#3a4a44', 2); ret(g, x + 2, 240, 18, 14, '#a8d8e8', 2); }
  placa(g, 265, 222, 112, 24, 'Reciclagem', { fundo: '#3a7a5a', borda: '#245a3c', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function cabanaEsqui(g) {
  ret(g, 376, 196, 248, 150, '#9a6a3e');
  for (let y = 200; y < 346; y += 14) {
    ret(g, 376, y, 248, 12, y % 28 ? '#a3713f' : '#94633a', 5);
    el(g, 378, y + 6, 6, 6, '#c9935a');
    el(g, 622, y + 6, 6, 6, '#c9935a');
  }
  ret(g, 558, 106, 28, 70, '#8a7d70', 2);
  ret(g, 554, 102, 36, 8, '#77706a', 2);
  el(g, 572, 100, 18, 5, '#f7fbff');
  forma(g, '#6b3a2a', [354, 204, 646, 204, 500, 96]);
  forma(g, '#f7fbff', [350, 206, 500, 92, 650, 206, 630, 208, 612, 200, 590, 214, 566, 198, 540, 210, 500, 196, 470, 212, 440, 198, 410, 214, 388, 200, 370, 210]);
  el(g, 500, 162, 18, 18, '#5b3c22');
  el(g, 500, 162, 14, 14, '#ffe39a');
  linha(g, '#5b3c22', 2.5, [486, 162, 514, 162]);
  linha(g, '#5b3c22', 2.5, [500, 148, 500, 176]);
  janelaQuente(g, 396, 234, 50, 48);
  janelaQuente(g, 554, 234, 50, 48);
  ret(g, 466, 266, 68, 80, '#5b3c22', 6);
  ret(g, 471, 272, 28, 74, '#7a5434', 4);
  ret(g, 501, 272, 28, 74, '#7a5434', 4);
  el(g, 495, 310, 2.5, 2.5, '#e8c24a');
  el(g, 505, 310, 2.5, 2.5, '#e8c24a');
  ret(g, 452, 340, 96, 8, '#7a5434', 2);
  for (const [x, c] of [[446, '#c0392b'], [454, '#2f6b9a']]) { ret(g, x, 282, 5, 62, c, 2); el(g, x + 2.5, 282, 3, 4, c); }
  placa(g, 500, 222, 150, 26, 'Cabana do Esqui', { fundo: '#7a2f2f', borda: '#4a1c1c', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function escola(g) {
  ret(g, 660, 214, 140, 132, '#c96b55');
  for (let y = 218; y < 346; y += 12) for (let x = 660 + ((y / 12) % 2 ? 0 : 10); x < 800; x += 20) ret(g, x + 1, y + 1, 18, 10, (x + y) % 3 ? '#c4644e' : '#b85a46', 1);
  forma(g, '#4a5a7a', [646, 218, 814, 218, 730, 168]);
  forma(g, '#f7fbff', [650, 216, 730, 166, 810, 216, 790, 216, 772, 206, 750, 214, 730, 202, 708, 214, 686, 206, 668, 216]);
  ret(g, 714, 134, 32, 38, '#e9dcc3', 2);
  forma(g, '#4a5a7a', [708, 136, 752, 136, 730, 112]);
  el(g, 730, 112, 14, 5, '#f7fbff');
  ret(g, 720, 142, 20, 22, '#3a2a1a', 8);
  for (const x of [672, 754]) { ret(g, x, 254, 34, 32, '#e9dcc3', 2); ret(g, x + 3, 257, 28, 26, '#a8d0ec', 2); linha(g, '#e9dcc3', 2, [x + 17, 257, x + 17, 283]); neveEm(g, x, 290, 34); }
  ret(g, 710, 282, 38, 64, '#5b3c22', 4);
  el(g, 740, 316, 2.5, 2.5, '#e8c24a');
  placa(g, 730, 236, 80, 22, 'Escola', { fundo: '#e9dcc3', borda: '#8a6a44', cor: '#4a2e18', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function estacaoTeleferico(g) {
  linha(g, '#3a3a44', 2.5, [912, 206, 1010, 36]);
  linha(g, '#3a3a44', 2.5, [888, 210, 980, 36]);
  ret(g, 832, 300, 146, 46, '#8a6040', 3);
  for (let x = 836; x < 976; x += 16) ret(g, x, 302, 2, 44, 'rgba(0,0,0,0.12)');
  ret(g, 838, 226, 10, 76, '#6b4a2b');
  ret(g, 962, 226, 10, 76, '#6b4a2b');
  ret(g, 824, 214, 162, 16, '#6b3a2a', 3);
  neveEm(g, 824, 216, 162);
  el(g, 900, 232, 26, 26, '#5d6b73');
  el(g, 900, 232, 20, 20, '#8a96a0');
  el(g, 900, 232, 5, 5, '#3a3a44');
  placa(g, 900, 282, 108, 24, 'Teleférico', { fundo: '#2f6b9a', borda: '#1f4a70', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function fundoVila(g) {
  ceu(g, 340, '#7eaee0', '#e6f2fb');
  nuvem(g, 50, 60, 0.8);
  nuvem(g, 330, 34, 0.6);
  montanha(g, 330, 344, 560, 196, '#b1c5da');
  montanha(g, 790, 344, 780, 326, '#9fb6cf');
  for (const [x, s] of [[16, 0.8], [176, 0.75], [352, 0.85], [640, 0.8], [812, 0.7], [990, 0.8]]) pinheiro(g, x, 340, s);
  chaoNeve(g, 334, H, 33);
  el(g, 500, 470, 440, 86, 'rgba(150,175,205,0.16)');
  forma(g, 'rgba(150,175,205,0.2)', [0, 470, 140, 480, 160, 540, 0, 580]);
  forma(g, 'rgba(150,175,205,0.2)', [W, 470, 860, 480, 840, 540, W, 580]);
  for (const x of [100, 265, 500, 728, 900]) el(g, x, 368, 40, 12, 'rgba(150,175,205,0.2)');
  entradaMina(g);
  usina(g);
  cabanaEsqui(g);
  escola(g);
  estacaoTeleferico(g);
}
function animarVila(g, t) {
  fumaca(g, 572, 96, t, 1.1);
  fumaca(g, 310, 128, t + 1.7, 0.9);
  for (const x of [421, 579]) brilho(g, x, 258, 50, 'rgba(255,214,140,A)', 0.2 + Math.sin(t * 2 + x) * 0.04);
  brilho(g, 500, 162, 30, 'rgba(255,214,140,A)', 0.3);
  brilho(g, 152, 278, 34, 'rgba(255,200,110,A)', 0.3 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7) * 0.04);
  // A roda e as cadeirinhas do teleférico
  for (let k = 0; k < 4; k++) {
    const a = t * 2 + (k * Math.PI) / 2;
    linha(g, '#3a3a44', 2, [900 - Math.cos(a) * 18, 232 - Math.sin(a) * 18, 900 + Math.cos(a) * 18, 232 + Math.sin(a) * 18]);
  }
  for (let k = 0; k < 4; k++) {
    const s = (t * 0.045 + k / 4) % 1;
    peca(g, 'cadeira-teleferico', 912 + s * 98, 206 - s * 170, t);
    const d = 1 - ((t * 0.045 + k / 4 + 0.12) % 1);
    peca(g, 'cadeira-teleferico', 888 + d * 92, 210 - d * 174, t);
  }
  for (let k = 0; k < 10; k++) {
    const a = Math.max(0, Math.sin(t * 2 + k * 1.9));
    el(g, 40 + hash(k, 12) * 920, 360 + hash(k, 13) * 230, a * 2, a * 2, `rgba(255,255,255,${a})`);
  }
}
function poste(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 16);
  peca(g, 'poste-neve', x, y, t);
  brilho(g, x, y - 128, 54, 'rgba(255,230,150,A)', 0.28 + Math.sin(t * 2 + x) * 0.03);
}
function trenoParado(g, x, y, t, cor, dir = 1) {
  sombraNoChao(g, x, y + 2, 34, 6);
  peca(g, 'treno', x, y, t, null, { cor, dir });
}

/* ─── Cabana do Esqui ─── */

const RELOGIO = { cucoAte: 0 };
function paredeDeToras(g, y1, c1 = '#94643a', c2 = '#8a5a34') {
  for (let y = 0; y < y1; y += 30) {
    ret(g, 0, y, W, 28, (y / 30) % 2 ? c1 : c2);
    ret(g, 0, y + 25, W, 4, 'rgba(50,25,10,0.3)');
    ret(g, 0, y + 2, W, 3, 'rgba(255,255,255,0.06)');
  }
}
function fundoCabana(g) {
  paredeDeToras(g, 384);
  ret(g, 0, 0, W, 24, '#5b3c22');
  chaoTabuas(g, 380, H);
  ret(g, 0, 374, W, 10, '#5b3c22');
  el(g, 470, 500, 220, 58, '#8a2f3a');
  el(g, 470, 500, 198, 50, '#b84a50');
  el(g, 470, 500, 146, 35, '#d8b13a');
  el(g, 470, 500, 92, 21, '#8a2f3a');
  // A janela com a neve lá fora
  ret(g, 282, 82, 156, 160, '#5b3c22', 6);
  ret(g, 290, 90, 140, 144, grad(g, 0, 90, 0, 234, [[0, '#9cc4e8'], [1, '#e8f2fb']]));
  montanha(g, 340, 234, 160, 80, '#b8cadd');
  pinheiro(g, 400, 234, 0.7);
  ret(g, 290, 214, 140, 20, '#f4f8fd');
  ret(g, 357, 90, 6, 144, '#5b3c22');
  ret(g, 290, 158, 140, 6, '#5b3c22');
  ret(g, 274, 240, 172, 10, '#6b4226', 3);
  forma(g, '#2f6b9a', [270, 74, 304, 74, 296, 246, 266, 246]);
  forma(g, '#2f6b9a', [450, 74, 416, 74, 424, 246, 454, 246]);
  ret(g, 262, 68, 196, 8, '#5b3c22', 3);
  // Os esquis na parede
  ret(g, 466, 100, 84, 8, '#5b3c22', 3);
  for (const [k, c] of ['#c0392b', '#2f6b9a', '#e8c24a', '#3a7a3c'].entries()) {
    const x = 474 + k * 20;
    ret(g, x, 96, 8, 196, c, 4);
    el(g, x + 4, 96, 4, 6, c);
    ret(g, x, 180, 8, 14, '#1b1b22', 2);
  }
  // O cardápio
  ret(g, 640, 150, 164, 104, '#2b3a2e', 6);
  g.strokeStyle = '#7a5434';
  g.lineWidth = 5;
  g.strokeRect(640, 150, 164, 104);
  texto(g, 'Chocolate Quente', 722, 172, { cor: '#f4e9c8', fonte: '700 15px "Cinzel", Georgia, serif' });
  for (const [k, l] of ['Com marshmallow', 'Com chantilly', 'Com canela', 'Bolinho de neve'].entries()) texto(g, l, 722, 196 + k * 16, { cor: '#e8e2d0', fonte: '13px "EB Garamond", Georgia, serif' });
  // A escada para o Sótão
  for (let i = 0; i < 9; i++) {
    const sx = 846 + i * 17;
    const sy = 380 - (i + 1) * 30;
    ret(g, sx, sy + 10, W - sx, 20, '#7a4f2c');
    ret(g, sx, sy, W - sx, 11, '#a8774a');
  }
  linha(g, '#5b3c22', 5, [836, 330, 1000, 52]);
  for (let i = 0; i < 9; i++) linha(g, '#6b4226', 3, [846 + i * 17, 372 - (i + 1) * 30, 846 + i * 17, 330 - i * 30 - (i * 2.5)]);
  placa(g, 912, 128, 84, 26, 'Sótão', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  tapeteSaida(g);
}
function animarCabana(g, t) {
  brilho(g, 160, 330, 230, 'rgba(255,150,70,A)', 0.2 + Math.sin(t * 7) * 0.025 + Math.sin(t * 13) * 0.015);
  janelaNevando(g, 290, 90, 140, 144, t, 7);
  // O relógio cuco: pêndulo, ponteiros e o passarinho
  const cx = 575;
  const cy = 120;
  const ang = Math.sin(t * 3) * 0.35;
  linha(g, '#b8922a', 2, [cx, cy + 26, cx + Math.sin(ang) * 64, cy + 26 + Math.cos(ang) * 64]);
  el(g, cx + Math.sin(ang) * 64, cy + 26 + Math.cos(ang) * 64, 8, 8, '#d8b13a');
  for (const [dx, y] of [[-8, 74], [8, 60]]) { linha(g, '#3a2a1a', 1, [cx + dx, cy + 26, cx + dx, cy + y]); forma(g, '#6b4226', [cx + dx - 4, cy + y, cx + dx + 4, cy + y, cx + dx + 3, cy + y + 14, cx + dx - 3, cy + y + 14]); }
  peca(g, 'relogio-cuco', cx, cy, t);
  linha(g, '#1b1403', 2, [cx, cy + 8, cx + Math.cos(t * 0.05 - 1.5) * 7, cy + 8 + Math.sin(t * 0.05 - 1.5) * 7]);
  linha(g, '#1b1403', 1.2, [cx, cy + 8, cx + Math.cos(t * 0.6 - 1.5) * 11, cy + 8 + Math.sin(t * 0.6 - 1.5) * 11]);
  const agora = Date.now();
  const ciclo = t % 24;
  const sai = RELOGIO.cucoAte > agora ? Math.min(1, (RELOGIO.cucoAte - agora) / 400) : ciclo < 1.6 ? Math.sin((ciclo / 1.6) * Math.PI) : 0;
  if (sai > 0.05) {
    const bx = cx;
    const by = cy - 12;
    linha(g, '#3a2a1a', 1.5, [bx, by, bx, by - 4 + sai * 4]);
    el(g, bx, by + 2 - sai * 6, 6, 5, '#e8c24a');
    el(g, bx + 4, by - 1 - sai * 6, 3.5, 3.5, '#e8c24a');
    forma(g, '#e07a2a', [bx + 7, by - 1 - sai * 6, bx + 12, by - sai * 6, bx + 7, by + 1 - sai * 6]);
    texto(g, 'Cuco!', bx + 34, by - 18, { cor: '#fff7d0', fonte: '700 14px "Cinzel", Georgia, serif', sombra: 'rgba(0,0,0,0.5)' });
  }
}
function lareira(g, t) {
  peca(g, 'lareira', 160, 384, t);
}
function balcaoCacau(g, t) {
  npc(g, 'npc-cacau', 712, 352, t, -1);
  peca(g, 'balcao-cacau', 712, 420, t);
}
function poltrona(g, x, y, cor, dir) {
  sombraNoChao(g, x, y + 2, 44);
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  ret(g, -38, -88, 54, 70, cor, 14);
  ret(g, -40, -40, 80, 30, cor, 8);
  ret(g, -44, -54, 18, 44, cor, 8);
  ret(g, 28, -54, 18, 44, cor, 8);
  ret(g, -30, -50, 56, 16, 'rgba(255,255,255,0.12)', 6);
  for (const dx of [-36, 30]) ret(g, dx, -10, 6, 10, '#3a2414');
  g.restore();
}
function mesinha(g, x, y) {
  sombraNoChao(g, x, y + 2, 34);
  ret(g, x - 4, y - 36, 8, 36, '#4a2e18');
  el(g, x, y - 2, 16, 4, '#4a2e18');
  el(g, x, y - 38, 34, 10, '#8a5a32');
  el(g, x, y - 41, 34, 10, '#b07e50');
  ret(g, x - 14, y - 52, 11, 12, '#c0392b', 3);
  el(g, x - 8.5, y - 53, 5, 2.5, '#ffffff');
  ret(g, x + 4, y - 50, 14, 6, '#e8c24a', 2);
}

/* ─── Sótão ─── */

function fundoSotao(g) {
  g.fillStyle = '#7a5434';
  g.fillRect(0, 0, W, 404);
  for (let x = 0; x < W; x += 40) { ret(g, x, 0, 38, 404, x % 80 ? '#7f5838' : '#744f30'); ret(g, x + 38, 0, 2, 404, 'rgba(40,20,8,0.4)'); }
  // A janela redonda com a noite nevando
  el(g, 500, 124, 70, 70, '#4a2e18');
  el(g, 500, 124, 60, 60, grad(g, 0, 64, 0, 184, [[0, '#1d2f55'], [1, '#4a6a9a']]));
  for (let k = 0; k < 12; k++) el(g, 460 + hash(k, 3) * 80, 84 + hash(k, 4) * 50, 1, 1, 'rgba(255,255,255,0.8)');
  el(g, 520, 98, 9, 9, '#f6efd2');
  el(g, 500, 176, 56, 14, '#e8f0f8');
  linha(g, '#4a2e18', 6, [440, 124, 560, 124]);
  linha(g, '#4a2e18', 6, [500, 64, 500, 184]);
  // O telhado inclinado (as vigas)
  forma(g, '#3f2614', [0, 0, 400, 0, 0, 330]);
  forma(g, '#3f2614', [W, 0, W - 400, 0, W, 330]);
  for (let k = 1; k < 5; k++) { linha(g, '#5b3a20', 6, [k * 80, 0, 0, k * 66]); linha(g, '#5b3a20', 6, [W - k * 80, 0, W, k * 66]); }
  linha(g, '#2a180a', 10, [400, 0, 0, 330]);
  linha(g, '#2a180a', 10, [W - 400, 0, W, 330]);
  // Bandeirinhas
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(330, 60);
  g.quadraticCurveTo(500, 110, 670, 60);
  g.stroke();
  for (let k = 0; k < 11; k++) {
    const f = k / 10;
    const x = 330 + f * 340;
    const y = 60 + 4 * 25 * f * (1 - f);
    forma(g, ['#c0392b', '#e8c24a', '#2f6b9a', '#3a7a3c'][k % 4], [x - 8, y, x + 8, y, x, y + 16]);
  }
  chaoTabuas(g, 400, H, ['#8a5a32', '#7f5230', '#94633a'], 'rgba(40,20,8,0.4)', 13);
  ret(g, 0, 396, W, 8, '#4a2e18');
  // A abertura da escada (desce para a Cabana)
  forma(g, '#1a0f06', [60, 412, 210, 412, 230, 470, 40, 470]);
  for (let k = 0; k < 4; k++) ret(g, 64 + k * 4, 420 + k * 12, 150 - k * 2, 6, '#5b3a20');
  ret(g, 40, 404, 6, 70, '#5b3c22');
  ret(g, 204, 404, 6, 70, '#5b3c22');
  ret(g, 40, 404, 170, 6, '#6b4226', 3);
  placa(g, 126, 380, 92, 24, 'Cabana', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  // A estante e o baú
  ret(g, 840, 214, 120, 188, '#5b3420', 4);
  const cores = ['#c0392b', '#2f6b34', '#d8b13a', '#5aa0d8', '#7b5ab8', '#e07a2a'];
  for (let p = 0; p < 4; p++) {
    const y = 222 + p * 44;
    ret(g, 844, y + 38, 112, 5, '#8a5a32');
    for (let k = 0; k < 9; k++) ret(g, 848 + k * 12, y + 10 + (k % 3) * 2, 10, 28 - (k % 3) * 2, cores[(k + p) % 6], 1);
  }
}
function animarSotao(g, t) {
  janelaNevandoRedonda(g, t);
  for (const x of [300, 700]) {
    const bal = Math.sin(t * 1.3 + x) * 0.05;
    const lx = x + Math.sin(bal) * 50;
    linha(g, '#3a2a1a', 1.5, [x, 0, lx, 50]);
    ret(g, lx - 9, 50, 18, 24, '#3a2a1a', 4);
    ret(g, lx - 6, 53, 12, 18, '#ffd98a', 3);
    brilho(g, lx, 62, 110, 'rgba(255,200,120,A)', 0.24 + Math.sin(t * 9 + x) * 0.02);
  }
}
function janelaNevandoRedonda(g, t) {
  g.save();
  g.beginPath();
  g.arc(500, 124, 58, 0, Math.PI * 2);
  g.clip();
  nevar(g, t, { n: 22, x0: 440, x1: 560, y0: 64, y1: 184, vel: 20, vento: 10, semente: 8, tam: 0.8 });
  g.restore();
}
function mesaLig4(g, t) {
  sombraNoChao(g, 500, 474, 250, 18);
  peca(g, 'mesa-lig4', 500, 474, t);
  brilho(g, 360, 362, 40, 'rgba(255,200,120,A)', 0.3);
  brilho(g, 640, 362, 40, 'rgba(255,200,120,A)', 0.3);
}
function bau(g, x, y) {
  sombraNoChao(g, x, y + 2, 40);
  ret(g, x - 38, y - 40, 76, 40, '#8a5a32', 4);
  g.fillStyle = '#9c6a3c';
  g.beginPath();
  g.ellipse(x, y - 40, 38, 18, 0, Math.PI, 0);
  g.fill();
  for (const dx of [-28, 24]) ret(g, x + dx, y - 56, 5, 56, '#d8b13a');
  ret(g, x - 7, y - 36, 14, 14, '#e8c24a', 2);
}

/* ─── Estação de Esqui (topo da montanha) ─── */

function fundoMontanha(g) {
  ceu(g, 330, '#3f7cc8', '#d4e9f8');
  brilho(g, 840, 70, 110, 'rgba(255,246,216,A)', 0.8);
  el(g, 840, 70, 30, 30, '#fffbe8');
  g.fillStyle = grad(g, 0, 200, 0, 320, [[0, '#8cc2e6'], [1, '#4f94c8']]);
  g.fillRect(0, 205, W, 120);
  // A ilha lá embaixo, vista de cima
  el(g, 560, 262, 210, 30, '#e8dcb0');
  el(g, 556, 258, 190, 24, '#86b866');
  el(g, 500, 252, 70, 12, '#f4f8fd');
  forma(g, '#f4f8fd', [470, 254, 500, 232, 532, 254]);
  for (const [x, y, c] of [[600, 258, '#c0392b'], [618, 262, '#e9dcc3'], [640, 256, '#b5835a'], [580, 266, '#7d5aa0']]) ret(g, x, y - 5, 7, 6, c, 1);
  ret(g, 728, 246, 5, 14, '#f7f3ea');
  el(g, 730, 246, 4, 3, '#c0392b');
  el(g, 380, 270, 26, 7, '#e8dcb0');
  el(g, 380, 268, 20, 5, '#86b866');
  for (let k = 0; k < 18; k++) ret(g, hash(k, 2) * W, 220 + hash(k, 3) * 100, 16 + hash(k, 4) * 20, 2, 'rgba(255,255,255,0.35)', 1);
  for (const [x, y, k] of [[-30, 300, 1.2], [180, 312, 1], [700, 306, 1.3], [880, 296, 1]]) nuvem(g, x, y, k, 0.95);
  // O topo nevado
  g.fillStyle = grad(g, 0, 300, 0, H, [[0, '#e6f0f9'], [1, '#ffffff']]);
  g.beginPath();
  g.moveTo(0, 352);
  g.quadraticCurveTo(500, 284, W, 352);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  const rnd = sorte(41);
  for (let k = 0; k < 50; k++) el(g, rnd() * W, 340 + rnd() * 250, 1.3, 1.3, 'rgba(255,255,255,0.95)');
  // As quatro pistas descendo da largada
  for (let k = 0; k < 4; k++) {
    const a0 = 320 + k * 90;
    const b0 = 120 + k * 190;
    forma(g, 'rgba(120,160,210,0.16)', [a0 + 8, 386, a0 + 82, 386, b0 + 172, H, b0 + 12, H]);
    linha(g, 'rgba(120,160,210,0.35)', 2, [a0 + 20, 386, b0 + 40, H]);
    linha(g, 'rgba(120,160,210,0.35)', 2, [a0 + 70, 386, b0 + 150, H]);
  }
  // A chegada do teleférico
  linha(g, '#3a3a44', 2.5, [118, 250, -20, 360]);
  linha(g, '#3a3a44', 2.5, [96, 256, -20, 344]);
  ret(g, 30, 338, 170, 50, '#8a6040', 3);
  ret(g, 40, 262, 10, 78, '#6b4a2b');
  ret(g, 178, 262, 10, 78, '#6b4a2b');
  ret(g, 24, 250, 182, 16, '#6b3a2a', 3);
  neveEm(g, 24, 252, 182);
  el(g, 110, 270, 22, 22, '#5d6b73');
  el(g, 110, 270, 16, 16, '#8a96a0');
  placa(g, 114, 318, 150, 24, 'Estação de Esqui', { fundo: '#2f6b9a', borda: '#1f4a70', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function animarMontanha(g, t) {
  for (const [x, y, k] of [[260, 286, 0.8], [600, 296, 0.7]]) nuvem(g, mod(x + t * 6, W + 200) - 100, y, k, 0.6);
  for (let k = 0; k < 3; k++) {
    const a = t * 1.5 + (k * Math.PI * 2) / 3;
    linha(g, '#3a3a44', 2, [110 - Math.cos(a) * 15, 270 - Math.sin(a) * 15, 110 + Math.cos(a) * 15, 270 + Math.sin(a) * 15]);
  }
  // A biruta
  ret(g, 930, 300, 4, 80, '#5b3c22');
  const v = Math.sin(t * 1.7) * 0.15;
  for (let k = 0; k < 4; k++) {
    const x = 934 - k * 12;
    forma(g, k % 2 ? '#ffffff' : '#e05a4a', [x, 302 + k * 2 + v * k * 10, x - 12, 304 + (k + 1) * 2 + v * (k + 1) * 10, x - 12, 314 + (k + 1) * 0.5 + v * (k + 1) * 10, x, 316 - k * 0.5 + v * k * 10]);
  }
}
function largada(g, t) {
  sombraNoChao(g, 500, 388, 200, 10);
  peca(g, 'portao-largada', 500, 388, t);
  for (let k = 0; k < 6; k++) {
    const x = 330 + k * 68;
    linha(g, '#3a2a1a', 1, [x, 196, x + 34, 196]);
    g.fillStyle = ['#e8c24a', '#2f6b9a', '#3a7a3c', '#ffffff', '#e05a4a', '#7b5ab8'][k];
    g.beginPath();
    g.moveTo(x + 4, 196);
    g.lineTo(x + 30, 196);
    g.lineTo(x + 17 + Math.sin(t * 6 + k) * 3, 214);
    g.closePath();
    g.fill();
  }
}
function binoculo(g, x, y) {
  sombraNoChao(g, x, y + 2, 20);
  ret(g, x - 3, y - 70, 6, 70, '#5d6b73');
  ret(g, x - 16, y - 92, 32, 22, '#2f6b9a', 6);
  el(g, x - 16, y - 81, 7, 9, '#1f4a70');
  el(g, x + 16, y - 81, 7, 9, '#1f4a70');
  el(g, x + 20, y - 81, 3, 5, '#a8d0ec');
  el(g, x, y - 96, 12, 4, '#f7fbff');
}

/* ─── Caverna da Mina ─── */

function paredeCaverna(g, y1, topo, base, semente, pontos = ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.05)']) {
  g.fillStyle = grad(g, 0, 0, 0, y1, [[0, topo], [1, base]]);
  g.fillRect(0, 0, W, y1);
  const rnd = sorte(semente);
  for (let k = 0; k < 90; k++) el(g, rnd() * W, rnd() * y1, 14 + rnd() * 40, 8 + rnd() * 22, pontos[k % 2], rnd() * 3);
}
function estalactites(g, cor, semente, n = 16, max = 60) {
  const rnd = sorte(semente);
  for (let k = 0; k < n; k++) {
    const x = rnd() * W;
    const w = 10 + rnd() * 18;
    forma(g, cor, [x - w, 0, x + w, 0, x + rnd() * 4 - 2, 16 + rnd() * max]);
  }
}
function fundoMina(g) {
  paredeCaverna(g, 400, '#241c16', '#4a3c30', 51);
  estalactites(g, '#1e1712', 52, 14, 40);
  chaoPedra(g, 384, H, ['#6e5a46', '#64503e', '#7a6650'], '#5c4a3a', 53);
  // Saída para a Vila (a luz do dia)
  ret(g, -10, 200, 140, 200, '#1a1410', 60);
  ret(g, 4, 214, 112, 186, grad(g, 0, 214, 0, 400, [[0, '#dcecf8'], [1, '#ffffff']]), 52);
  el(g, 60, 380, 60, 18, '#f4f8fd');
  pinheiro(g, 40, 372, 0.55);
  // Túnel da Mina de Ouro
  ret(g, 330, 226, 120, 164, '#120c08', 56);
  brilho(g, 390, 330, 70, 'rgba(255,200,80,A)', 0.35);
  for (const [x, y] of [[370, 300], [408, 320], [384, 350], [420, 290]]) { el(g, x, y, 3, 3, '#f0c84a'); }
  ret(g, 322, 222, 12, 170, '#7a5434');
  ret(g, 446, 222, 12, 170, '#7a5434');
  ret(g, 314, 212, 152, 16, '#8a6040', 3);
  placa(g, 390, 192, 130, 26, 'Mina de Ouro', { fundo: '#b8922a', borda: '#6b5420', cor: '#2a1c08', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  // A escada que desce para a Piscina
  ret(g, 640, 226, 124, 164, '#0e1218', 50);
  brilho(g, 702, 360, 80, 'rgba(110,190,255,A)', 0.4);
  for (let k = 0; k < 6; k++) ret(g, 654 + k * 3, 300 + k * 16, 96 - k * 6, 8, `rgba(150,170,190,${0.5 - k * 0.06})`);
  ret(g, 632, 222, 12, 170, '#7a5434');
  ret(g, 756, 222, 12, 170, '#7a5434');
  ret(g, 624, 212, 152, 16, '#8a6040', 3);
  placa(g, 700, 192, 120, 26, 'Piscina', { fundo: '#2f6b9a', borda: '#1f4a70', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  // A fenda estreita (sem placa: um segredo)
  forma(g, '#07090c', [930, 236, 952, 230, 960, 290, 968, 330, 958, 392, 920, 392, 930, 340, 918, 300]);
  brilho(g, 942, 340, 40, 'rgba(120,220,255,A)', 0.22);
  // As vigas de madeira
  for (const x of [220, 560, 860]) {
    ret(g, x - 9, 120, 18, 270, '#6b4a2b');
    ret(g, x - 9, 120, 6, 270, 'rgba(255,255,255,0.08)');
  }
  ret(g, 140, 108, 800, 18, '#7a5434', 3);
  // Os trilhos lá no fundo
  ret(g, 0, 392, W, 4, '#8a8a94');
  ret(g, 0, 404, W, 4, '#8a8a94');
  for (let x = 6; x < W; x += 28) ret(g, x, 390, 8, 20, '#5b3c22');
  for (const [x, y] of [[860, 470], [150, 560], [540, 590]]) { el(g, x, y, 30, 12, '#4a3c30'); el(g, x - 6, y - 4, 16, 6, '#5c4a3a'); }
}
function animarMina(g, t) {
  // As lanternas penduradas na viga
  for (const x of [300, 520, 780]) {
    const f = 0.3 + Math.sin(t * 11 + x) * 0.04 + Math.sin(t * 5.3 + x) * 0.04;
    linha(g, '#3a2a1a', 1.5, [x, 126, x, 146]);
    ret(g, x - 8, 146, 16, 20, '#3a2a1a', 3);
    ret(g, x - 5, 149, 10, 14, '#ffd98a', 2);
    brilho(g, x, 156, 140, 'rgba(255,190,100,A)', f);
  }
  brilho(g, 60, 300, 120, 'rgba(230,245,255,A)', 0.18);
  brilho(g, 942, 330, 30, 'rgba(120,220,255,A)', 0.12 + Math.sin(t * 2) * 0.08);
  // Um carrinho passa nos trilhos de tempos em tempos
  const f = (t % 16) / 16;
  if (f < 0.5) {
    const x = -60 + (f / 0.5) * (W + 120);
    peca(g, 'carrinho-mina', x, 404, t, 'cheio');
  }
  nevar(g, t, { n: 25, vel: 6, vento: 4, semente: 55, cor: '255,220,170', alfa: 0.25, tam: 0.6, y1: 380 });
}
function carrinhoParado(g, x, y, t, anim = 'cheio') {
  sombraNoChao(g, x, y + 2, 36, 7);
  peca(g, 'carrinho-mina', x, y, t, anim);
}
function caixote(g, x, y) {
  sombraNoChao(g, x, y + 2, 30);
  ret(g, x - 28, y - 46, 56, 46, '#8a6040', 3);
  linha(g, '#5b3c22', 3, [x - 26, y - 44, x + 26, y - 2]);
  linha(g, '#5b3c22', 3, [x + 26, y - 44, x - 26, y - 2]);
  g.strokeStyle = '#5b3c22';
  g.lineWidth = 3;
  g.strokeRect(x - 27, y - 45, 54, 44);
  for (const dx of [-14, 12]) { linha(g, '#a9a097', 3, [x + dx, y - 46, x + dx - 10, y - 74]); ret(g, x + dx - 20, y - 80, 20, 6, '#6b6e74', 2); }
}

/* ─── Mina de Ouro ─── */

const VEIOS = (() => {
  const rnd = sorte(61);
  const lista = [];
  for (let k = 0; k < 14; k++) {
    let x = rnd() * W;
    let y = 30 + rnd() * 320;
    const pts = [x, y];
    for (let i = 0; i < 4; i++) { x += 14 + rnd() * 24; y += -16 + rnd() * 32; pts.push(x, y); }
    lista.push(pts);
  }
  return lista;
})();
function fundoMinaOuro(g) {
  paredeCaverna(g, 410, '#120d0a', '#33261c', 62, ['rgba(0,0,0,0.25)', 'rgba(255,200,120,0.04)']);
  estalactites(g, '#0d0907', 63, 18, 50);
  for (const pts of VEIOS) {
    linha(g, '#8a6a20', 5, pts);
    linha(g, '#e8c24a', 2, pts);
  }
  chaoPedra(g, 394, H, ['#3e3026', '#463628', '#4f3e2e'], '#382a20', 64);
  // A volta para a caverna
  ret(g, -10, 228, 130, 176, '#050302', 50);
  brilho(g, 30, 330, 70, 'rgba(255,190,100,A)', 0.2);
  ret(g, 112, 222, 12, 180, '#6b4a2b');
  ret(g, 0, 214, 132, 14, '#7a5434', 3);
  placa(g, 62, 196, 100, 24, 'Caverna', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  // Um túnel escuro lá no fundo, com trilhos
  ret(g, 820, 250, 110, 150, '#050302', 50);
  ret(g, 812, 244, 12, 156, '#6b4a2b');
  ret(g, 926, 244, 12, 156, '#6b4a2b');
  ret(g, 804, 236, 142, 14, '#7a5434', 3);
  for (const [a, b] of [[836, 690], [914, 980]]) linha(g, '#8a8a94', 3, [a, 400, b, H]);
  for (let k = 0; k < 8; k++) { const f = k / 8; ret(g, 836 + (690 - 836) * f - 6, 404 + f * 190, 92 + f * 210, 5, '#5b3c22'); }
  // Pepitas grandes na parede
  for (const [x, y, r] of [[220, 300, 18], [690, 160, 14], [520, 90, 12], [140, 120, 10]]) { el(g, x, y, r, r * 0.8, '#b8922a'); el(g, x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.4, '#f0d070'); }
}
function animarMinaOuro(g, t) {
  for (let i = 0; i < VEIOS.length; i++) {
    const pts = VEIOS[i];
    const k = Math.floor(t * 0.7 + i * 0.37) % (pts.length / 2);
    const a = Math.max(0, Math.sin(t * 3 + i * 2.1));
    const x = pts[k * 2];
    const y = pts[k * 2 + 1];
    brilho(g, x, y, 14, 'rgba(255,240,170,A)', a * 0.9);
    linha(g, `rgba(255,250,210,${a})`, 1.5, [x - 5 * a, y, x + 5 * a, y]);
    linha(g, `rgba(255,250,210,${a})`, 1.5, [x, y - 5 * a, x, y + 5 * a]);
  }
  for (const x of [280, 560]) {
    linha(g, '#3a2a1a', 1.5, [x, 0, x, 70]);
    ret(g, x - 8, 70, 16, 20, '#3a2a1a', 3);
    ret(g, x - 5, 73, 10, 14, '#ffd98a', 2);
    brilho(g, x, 80, 150, 'rgba(255,180,90,A)', 0.28 + Math.sin(t * 10 + x) * 0.04);
  }
  nevar(g, t, { n: 30, vel: 8, vento: 3, semente: 66, cor: '255,210,140', alfa: 0.3, tam: 0.6, y1: 400 });
}
function britadeiras(g, t) {
  const x = 650;
  const y = 432;
  sombraNoChao(g, x, y + 2, 90, 12);
  ret(g, x - 84, y - 120, 8, 120, '#5b3c22');
  ret(g, x + 76, y - 120, 8, 120, '#5b3c22');
  ret(g, x - 90, y - 124, 180, 10, '#7a5434', 3);
  ret(g, x - 84, y - 40, 168, 8, '#7a5434', 2);
  for (let k = 0; k < 3; k++) {
    const bx = x - 50 + k * 50;
    const treme = k === 1 ? Math.sin(t * 60) * 0.8 : 0;
    ret(g, bx - 18 + treme, y - 112, 36, 6, '#3a3a44', 3);
    ret(g, bx - 3 + treme, y - 108, 6, 10, '#3a3a44');
    ret(g, bx - 10 + treme, y - 98, 20, 34, '#e8c24a', 4);
    ret(g, bx - 10 + treme, y - 90, 20, 4, '#1b1b22');
    ret(g, bx - 2 + treme, y - 64, 4, 22, '#a9a097');
    forma(g, '#a9a097', [bx - 3 + treme, y - 42, bx + 3 + treme, y - 42, bx + treme, y - 34]);
  }
  placa(g, x, y - 150, 170, 30, 'Pegue a britadeira!', { fundo: '#b8922a', borda: '#6b5420', cor: '#2a1c08', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}
function pilhaOuro(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 34, 8);
  for (const [dx, dy, r] of [[-18, -8, 10], [0, -10, 12], [16, -8, 10], [-8, -20, 9], [8, -22, 9], [0, -32, 8]]) { el(g, x + dx, y + dy, r, r * 0.8, '#d8a830'); el(g, x + dx - 3, y + dy - 3, r * 0.35, r * 0.3, '#fff3b0'); }
  brilho(g, x, y - 18, 40, 'rgba(255,220,120,A)', 0.2 + Math.sin(t * 3) * 0.08);
}

/* ─── Lago Secreto ─── */

// O segredo da cachoeira: cinco toques abrem a água (e a pessoa vê o Pompom dourado e o recado do Capitão).
const CACHOEIRA = { cliques: 0, aberta: false, toque: 0 };
const CRISTAIS = [[90, 380, 34, '#6be0ff'], [150, 392, 22, '#b48cff'], [230, 384, 18, '#6be0ff'], [780, 388, 26, '#b48cff'], [850, 380, 38, '#6be0ff'], [920, 394, 20, '#ff9ae0'], [700, 396, 14, '#6be0ff']];
function cristal(g, x, y, h, cor) {
  forma(g, cor, [x - h * 0.25, y, x - h * 0.3, y - h * 0.7, x, y - h, x + h * 0.3, y - h * 0.7, x + h * 0.25, y]);
  forma(g, 'rgba(255,255,255,0.35)', [x - h * 0.12, y - h * 0.1, x - h * 0.16, y - h * 0.66, x, y - h * 0.94, x, y - h * 0.1]);
}
function fundoLagoSecreto(g) {
  paredeCaverna(g, 420, '#0b0f22', '#1c2340', 71, ['rgba(0,0,0,0.25)', 'rgba(120,160,255,0.05)']);
  estalactites(g, '#080b18', 72, 20, 70);
  // O lago
  g.fillStyle = grad(g, 0, 250, 0, 420, [[0, '#0f3a5a'], [1, '#1d6a8a']]);
  g.beginPath();
  g.moveTo(0, 270);
  g.quadraticCurveTo(500, 236, W, 270);
  g.lineTo(W, 420);
  g.lineTo(0, 420);
  g.closePath();
  g.fill();
  // A pedra atrás da cachoeira
  ret(g, 430, 50, 140, 240, '#141a30', 30);
  chaoPedra(g, 404, H, ['#2a3048', '#252b42', '#30374f'], '#1f243a', 73);
  for (const [x, y, w, c] of CRISTAIS) cristal(g, x, y, w * 2, c);
  // A volta para a Mina
  ret(g, -10, 300, 110, 130, '#04050a', 40);
  ret(g, 0, 296, 104, 10, '#3a2a1a', 3);
  placa(g, 52, 280, 84, 22, 'Mina', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 12px "Cinzel", Georgia, serif', neve: false });
  for (let k = 0; k < 40; k++) el(g, hash(k, 74) * W, 420 + hash(k, 75) * 180, 2, 1.4, 'rgba(120,255,200,0.45)');
}
function animarLagoSecreto(g, t) {
  // Os cristais pulsando
  for (const [i, [x, y, w, c]] of CRISTAIS.entries()) brilho(g, x, y - w, w * 2.6, c === '#b48cff' ? 'rgba(180,140,255,A)' : c === '#ff9ae0' ? 'rgba(255,150,220,A)' : 'rgba(110,224,255,A)', 0.25 + Math.sin(t * 1.6 + i) * 0.12);
  // A cachoeira brilhante
  const aberta = CACHOEIRA.aberta;
  const lado = aberta ? 46 : 0;
  if (aberta) {
    brilho(g, 500, 180, 70, 'rgba(255,220,120,A)', 0.5);
    ret(g, 466, 130, 68, 110, '#0b0f22', 24);
    desenharPompom(g, 500, 228, t, '#f0c84a', 'dormindo', 1.3);
    texto(g, 'z', 522 + Math.sin(t * 2) * 3, 180 - ((t * 10) % 20), { cor: 'rgba(255,240,180,0.9)', fonte: '700 14px sans-serif' });
    texto(g, 'S. R. esteve aqui', 500, 112, { cor: '#ffe9a8', fonte: 'italic 700 11px "EB Garamond", Georgia, serif' });
  }
  for (const s of [-1, 1]) {
    const x0 = aberta ? 500 + s * (lado + 12) : 500 + s * 30;
    const w = aberta ? 26 : 30;
    g.fillStyle = grad(g, 0, 50, 0, 300, [[0, 'rgba(160,240,255,0.85)'], [1, 'rgba(90,200,240,0.6)']]);
    g.fillRect(Math.min(x0, x0 - s * w), 50, w, 250);
  }
  g.save();
  g.beginPath();
  if (aberta) { g.rect(442, 50, 34, 250); g.rect(524, 50, 34, 250); } else g.rect(470, 50, 60, 250);
  g.clip();
  for (let k = 0; k < 16; k++) {
    const x = 444 + hash(k, 76) * 112;
    const y = 50 + mod(hash(k, 77) * 250 + t * 160, 250);
    ret(g, x, y, 2, 20, 'rgba(255,255,255,0.6)', 1);
  }
  g.restore();
  brilho(g, 500, 300, 90, 'rgba(140,240,255,A)', 0.35 + Math.sin(t * 3) * 0.05);
  for (let k = 0; k < 5; k++) {
    const f = (t * 0.8 + k / 5) % 1;
    g.strokeStyle = `rgba(200,250,255,${0.5 * (1 - f)})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(500, 302, 30 + f * 90, (30 + f * 90) * 0.18, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // O último toque faz a água brilhar mais
  const desde = (Date.now() - CACHOEIRA.toque) / 1000;
  if (desde < 1) brilho(g, 500, 170, 160, 'rgba(200,250,255,A)', 0.5 * (1 - desde));
  // Vaga-lumes da caverna
  for (let k = 0; k < 14; k++) {
    const x = 60 + hash(k, 78) * 880 + Math.sin(t * 0.7 + k) * 30;
    const y = 120 + hash(k, 79) * 260 + Math.cos(t * 0.9 + k * 2) * 20;
    const a = 0.4 + Math.sin(t * 3 + k) * 0.4;
    brilho(g, x, y, 10, 'rgba(140,255,200,A)', a);
    el(g, x, y, 1.6, 1.6, `rgba(220,255,230,${Math.max(0, a)})`);
  }
  for (let k = 0; k < 12; k++) {
    const x = mod(hash(k, 80) * W + t * 10, W);
    ret(g, x, 300 + hash(k, 81) * 110, 20 + hash(k, 82) * 30, 2, 'rgba(160,240,255,0.25)', 1);
  }
}

/* ─── Piscina Subterrânea ─── */

const PEIXES_JANELA = [
  { y: 110, vel: 30, cor: '#f0a040', tam: 12, fase: 0 }, { y: 160, vel: -22, cor: '#ff7ab8', tam: 9, fase: 2 },
  { y: 200, vel: 40, cor: '#7fe0ff', tam: 8, fase: 4 }, { y: 140, vel: -15, cor: '#e8c24a', tam: 18, fase: 1 },
  { y: 230, vel: 26, cor: '#a678e0', tam: 10, fase: 3 },
];
function fundoPiscina(g) {
  g.fillStyle = '#4c5866';
  g.fillRect(0, 0, W, 390);
  const rnd = sorte(81);
  for (let y = 0; y < 390; y += 30) for (let x = (y / 30) % 2 ? -30 : 0; x < W; x += 60) ret(g, x + 2, y + 2, 56, 26, ['#56636f', '#4f5c68', '#5c6975'][Math.floor(rnd() * 3)], 4);
  // A grande janela de vidro
  ret(g, 206, 36, 588, 238, '#2f3a44', 14);
  ret(g, 220, 50, 560, 210, grad(g, 0, 50, 0, 260, [[0, '#1d6fa8'], [1, '#0d3a63']]), 6);
  for (let x = 236; x < 780; x += 40) for (const y of [44, 266]) el(g, x, y, 3, 3, '#8a96a0');
  ret(g, 220, 238, 560, 22, '#c9b07a');
  for (const x of [256, 336, 470, 620, 720]) { linha(g, '#2f7a4a', 5, [x, 248, x + 6, 190]); linha(g, '#3a8a5a', 4, [x + 12, 248, x + 10, 210]); }
  for (const [x, c] of [[400, '#e05a8a'], [560, '#f39a3c'], [680, '#e8c24a']]) { el(g, x, 240, 14, 8, c); el(g, x - 8, 232, 6, 6, c); el(g, x + 8, 232, 6, 6, c); }
  // A piscina
  ret(g, 120, 278, 760, 104, '#d9e4ec', 8);
  ret(g, 134, 288, 732, 86, grad(g, 0, 288, 0, 374, [[0, '#4fb4e0'], [1, '#2a86c0']]), 6);
  for (let x = 134; x < 866; x += 24) ret(g, x, 288, 1.5, 86, 'rgba(255,255,255,0.12)');
  for (const x of [170, 830]) { linha(g, '#c8d0d8', 4, [x, 268, x, 300]); linha(g, '#c8d0d8', 4, [x + 18, 268, x + 18, 300]); for (const y of [278, 290]) linha(g, '#c8d0d8', 3, [x, y, x + 18, y]); }
  // O chão de azulejos
  for (let i = 0; i < 9; i++) {
    const ya = 382 + (H - 382) * ((i / 9) ** 1.2);
    const yb = 382 + (H - 382) * (((i + 1) / 9) ** 1.2);
    for (let j = 0; j < 16; j++) { g.fillStyle = (i + j) % 2 ? '#dfeef6' : '#bcd8e8'; g.fillRect((W / 16) * j, ya, W / 16 + 1, yb - ya + 1); }
  }
  // A escada para a Mina e a porta da Caldeira
  ret(g, 8, 210, 104, 176, '#262e36', 40);
  for (let k = 0; k < 6; k++) ret(g, 20 + k * 2, 236 + k * 24, 80 - k * 4, 10, '#6c7a86');
  placa(g, 60, 196, 80, 22, 'Mina', { fundo: '#5b3c22', borda: '#3a2414', fonte: '700 12px "Cinzel", Georgia, serif', neve: false });
  ret(g, 880, 214, 96, 172, '#5d6b73', 6);
  ret(g, 888, 222, 80, 156, '#6f7d86', 4);
  for (const y of [232, 368]) for (const x of [894, 962]) el(g, x, y, 3, 3, '#3a4650');
  el(g, 928, 300, 18, 18, '#b8922a');
  el(g, 928, 300, 12, 12, '#6f7d86');
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; linha(g, '#b8922a', 3, [928, 300, 928 + Math.cos(a) * 18, 300 + Math.sin(a) * 18]); }
  placa(g, 928, 196, 150, 24, 'Sala da Caldeira', { fundo: '#7a2f2f', borda: '#4a1c1c', fonte: '700 12px "Cinzel", Georgia, serif', neve: false });
}
function animarPiscina(g, t) {
  g.save();
  g.beginPath();
  g.rect(220, 50, 560, 188);
  g.clip();
  for (let k = 0; k < 5; k++) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.beginPath();
    g.moveTo(260 + k * 120 + Math.sin(t + k) * 20, 50);
    g.lineTo(300 + k * 120, 50);
    g.lineTo(250 + k * 120, 240);
    g.lineTo(210 + k * 120, 240);
    g.closePath();
    g.fill();
  }
  for (const p of PEIXES_JANELA) {
    const lw = 560 + 80;
    const x = 180 + mod(p.fase * 100 + t * p.vel, lw);
    const y = p.y + Math.sin(t * 1.5 + p.fase) * 6;
    const d = p.vel > 0 ? 1 : -1;
    const r = p.tam;
    forma(g, p.cor, [x - d * r * 0.8, y, x - d * r * 1.5, y - r * 0.6 + Math.sin(t * 10 + p.fase) * 2, x - d * r * 1.5, y + r * 0.6 + Math.sin(t * 10 + p.fase) * 2]);
    el(g, x, y, r, r * 0.6, p.cor);
    el(g, x + d * r * 0.5, y - r * 0.15, 1.8, 1.8, '#1b1403');
  }
  for (let k = 0; k < 12; k++) {
    const x = 240 + hash(k, 83) * 520 + Math.sin(t * 2 + k) * 4;
    const y = 240 - mod(hash(k, 84) * 190 + t * 30, 190);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, 2 + hash(k, 85) * 2, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  // Reflexos na água da piscina
  for (let k = 0; k < 14; k++) {
    const x = 140 + mod(hash(k, 86) * 720 + Math.sin(t * 0.8 + k) * 30, 720);
    ret(g, x, 296 + hash(k, 87) * 70, 30 + hash(k, 88) * 30, 2, 'rgba(255,255,255,0.35)', 1);
  }
  // Pompons nadando de boia
  for (let k = 0; k < 3; k++) {
    const x = 240 + mod(k * 220 + t * 18 * (k % 2 ? -1 : 1), 520);
    const y = 330 + k * 12 + Math.sin(t * 2 + k) * 3;
    el(g, x, y + 6, 18, 6, ['#e05a4a', '#ffffff', '#e8c24a'][k]);
    el(g, x, y + 6, 10, 3, '#4fb4e0');
    desenharPompom(g, x, y + 4, t * 0.3, CORES_POMPOM[(k * 3) % 8], 'pulando', 0.9);
  }
}
function cadeiraSalvaVidas(g, x, y) {
  sombraNoChao(g, x, y + 2, 36);
  for (const dx of [-26, 22]) { linha(g, '#f4f4f4', 5, [x + dx, y, x + dx * 0.5, y - 110]); }
  for (const yy of [-30, -60, -90]) linha(g, '#f4f4f4', 4, [x - 24 + (yy / -110) * 12, y + yy, x + 20 - (yy / -110) * 10, y + yy]);
  ret(g, x - 22, y - 118, 44, 10, '#e05a4a', 3);
  ret(g, x - 20, y - 150, 8, 34, '#e05a4a', 2);
  forma(g, '#e8c24a', [x - 30, y - 170, x + 34, y - 170, x + 2, y - 190]);
  linha(g, '#f4f4f4', 3, [x + 2, y - 170, x + 2, y - 118]);
}
function cercadinhoPompons(g, t) {
  const x = 760;
  const y = 492;
  sombraNoChao(g, x, y + 4, 100, 16);
  el(g, x, y - 10, 96, 24, '#9fd0ec');
  el(g, x, y - 12, 88, 20, '#c8e8f8');
  for (let k = 0; k < 5; k++) {
    const a = t * (0.6 + k * 0.1) + k * 1.3;
    desenharPompom(g, x + Math.cos(a) * 60, y - 12 + Math.sin(a) * 10, t + k * 0.4, CORES_POMPOM[k + 1], 'pulando', 0.75);
  }
  for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; ret(g, x + Math.cos(a) * 98 - 2, y - 6 + Math.sin(a) * -18 - 24, 4, 26, '#f4f4f4', 2); }
  linha(g, '#f4f4f4', 3, [x - 98, y - 24, x + 98, y - 24]);
  ret(g, x - 50, y - 92, 6, 70, '#6b4a2b');
  placa(g, x - 47, y - 100, 170, 30, 'Resgate dos Pompons', { fundo: '#2f6b9a', borda: '#1f4a70', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
}

/* ─── Escola ─── */

export const LICOES = [
  ['Matemática', '3 cenouras + 2 cenouras = um lanche'],
  ['Geografia', 'A Ilha tem neve no norte e praia no sul'],
  ['Ciências', 'Pompons dormem enrolados como bolinhas'],
  ['História', 'O Capitão Saltarrocha chegou no Saltador'],
  ['Artes', 'Boneco de neve com orelhas fica mais fofo'],
  ['Educação Física', '10 pulinhos na neve antes do recreio'],
  ['Português', 'Raposinho se escreve com S, não com Z'],
  ['Música', 'O relógio cuco canta em Dó maior'],
];
function fundoEscola(g) {
  g.fillStyle = '#e8d9b8';
  g.fillRect(0, 0, W, 384);
  for (let x = 0; x < W; x += 34) ret(g, x, 0, 16, 280, 'rgba(200,170,120,0.14)');
  ret(g, 0, 280, W, 104, '#b07e50');
  for (let x = 0; x < W; x += 50) ret(g, x, 286, 46, 92, '#a4734a', 3);
  ret(g, 0, 276, W, 8, '#8a5a32');
  chaoTabuas(g, 380, H, ['#c4955e', '#b88a54', '#cc9d66'], 'rgba(80,50,20,0.3)', 19);
  ret(g, 0, 376, W, 8, '#7a4a2a');
  // A janela com neve
  ret(g, 56, 80, 170, 170, '#f4efe2', 6);
  ret(g, 66, 90, 150, 150, grad(g, 0, 90, 0, 240, [[0, '#9cc4e8'], [1, '#e8f2fb']]));
  pinheiro(g, 110, 240, 0.8);
  ret(g, 66, 220, 150, 20, '#f4f8fd');
  ret(g, 138, 90, 6, 150, '#f4efe2');
  ret(g, 66, 162, 150, 6, '#f4efe2');
  // O quadro-negro (as lições mudam em "animar")
  ret(g, 290, 60, 420, 210, '#8a5a32', 8);
  ret(g, 302, 72, 396, 186, '#2b4a3a', 4);
  ret(g, 300, 262, 400, 10, '#a8774a', 3);
  for (const [x, c] of [[340, '#ffffff'], [356, '#ffe46b'], [372, '#ff9ab8']]) ret(g, x, 258, 12, 4, c, 2);
  ret(g, 640, 256, 30, 8, '#c9a06a', 2);
  // O alfabeto e o relógio
  for (const [k, l] of 'ABCDEFG'.split('').entries()) {
    ret(g, 740 + k * 34, 30, 28, 30, ['#e05a5a', '#5aa0d8', '#7fb069', '#d8b13a', '#7b5ab8', '#e07a2a', '#e05a8a'][k], 4);
    texto(g, l, 754 + k * 34, 46, { cor: '#ffffff', fonte: '700 16px "Cinzel", Georgia, serif' });
  }
  el(g, 820, 120, 28, 28, '#7a4a2a');
  el(g, 820, 120, 23, 23, '#fbf6e6');
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; el(g, 820 + Math.cos(a) * 18, 120 + Math.sin(a) * 18, 1.3, 1.3, '#3a2414'); }
  // A estante
  ret(g, 880, 150, 100, 230, '#7a4a2a', 4);
  for (let p = 0; p < 4; p++) {
    const y = 160 + p * 54;
    ret(g, 884, y + 46, 92, 5, '#5b3420');
    for (let k = 0; k < 7; k++) ret(g, 888 + k * 12, y + 14 + (k % 3) * 3, 10, 32 - (k % 3) * 3, ['#c0392b', '#2f6b34', '#d8b13a', '#5aa0d8', '#7b5ab8'][(k + p) % 5], 1);
  }
  tapeteSaida(g, '#2f6b9a');
}
function animarEscola(g, t) {
  janelaNevando(g, 66, 90, 150, 150, t, 9);
  linha(g, '#1b1403', 2.5, [820, 120, 820 + Math.cos(t * 0.02 - 1.5) * 12, 120 + Math.sin(t * 0.02 - 1.5) * 12]);
  linha(g, '#1b1403', 1.5, [820, 120, 820 + Math.cos(t * 0.3 - 1.5) * 18, 120 + Math.sin(t * 0.3 - 1.5) * 18]);
  // A lição do quadro troca a cada 9 segundos, escrita aos poucos com giz
  const n = Math.floor(t / 9);
  const [materia, frase] = LICOES[n % LICOES.length];
  const f = Math.min(1, (t % 9) / 2.5);
  texto(g, `Aula de ${materia}`, 500, 104, { cor: '#ffe46b', fonte: '700 22px "Cinzel", Georgia, serif' });
  linha(g, 'rgba(255,255,255,0.5)', 2, [380, 122, 620, 122]);
  const visivel = frase.slice(0, Math.ceil(frase.length * f));
  texto(g, visivel, 500, 160, { cor: '#f4f4ee', fonte: '20px "EB Garamond", Georgia, serif' });
  texto(g, 'Clique aqui para o Quiz da Ilha', 500, 222, { cor: 'rgba(255,255,255,0.7)', fonte: 'italic 15px "EB Garamond", Georgia, serif' });
  // Um desenhinho de giz: uma cenoura
  g.strokeStyle = 'rgba(255,170,90,0.85)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(640, 180); g.lineTo(670, 196); g.lineTo(642, 196); g.closePath();
  g.stroke();
  linha(g, 'rgba(140,220,140,0.85)', 2, [640, 182, 630, 172]);
  linha(g, 'rgba(140,220,140,0.85)', 2, [641, 184, 634, 168]);
}
function carteira(g, x, y, t) {
  sombraNoChao(g, x, y + 2, 34, 8);
  peca(g, 'carteira', x, y, t);
}
function mesaProfessora(g, t) {
  const x = 790;
  const y = 412;
  npc(g, 'npc-professora', 745, 400, t, -1);
  sombraNoChao(g, x, y + 2, 60, 10);
  ret(g, x - 58, y - 56, 116, 14, '#8a5a32', 4);
  ret(g, x - 54, y - 44, 108, 44, '#7a4a2a', 3);
  ret(g, x - 44, y - 36, 88, 28, '#6b3e22', 3);
  // O globo e a cenoura (no lugar da maçã)
  ret(g, x + 22, y - 62, 4, 8, '#5b3c22');
  el(g, x + 24, y - 76, 14, 14, '#5aa0d8');
  el(g, x + 20, y - 80, 7, 5, '#7fb069');
  el(g, x + 28, y - 70, 5, 3, '#7fb069');
  forma(g, '#e07a2a', [x - 30, y - 60, x - 14, y - 60, x - 22, y - 74]);
  el(g, x - 22, y - 76, 3, 5, '#4f8a3c');
}

/* ─── Usina de Reciclagem ─── */

const LIXO = [['papel', '#f4f1ea'], ['plastico', '#e05a4a'], ['metal', '#c8c8d0'], ['vidro', '#7fd0a0']];
function fundoReciclagem(g) {
  g.fillStyle = '#56636b';
  g.fillRect(0, 0, W, 384);
  for (let x = 0; x < W; x += 100) {
    ret(g, x + 4, 10, 92, 364, '#5d6b73', 4);
    for (const y of [20, 360]) for (const dx of [12, 88]) el(g, x + dx, y, 3, 3, '#3f4a50');
  }
  // Canos
  ret(g, 0, 40, W, 16, '#8a6a44');
  ret(g, 0, 40, W, 4, 'rgba(255,255,255,0.15)');
  for (const x of [140, 860]) { ret(g, x, 40, 16, 200, '#8a6a44'); ret(g, x - 6, 230, 28, 12, '#6b4a2b', 3); }
  ret(g, 760, 70, 200, 10, '#3a7a5a');
  for (const x of [780, 900]) ret(g, x, 70, 10, 140, '#3a7a5a');
  // O chão de concreto, com a faixa de cuidado
  g.fillStyle = grad(g, 0, 380, 0, H, [[0, '#8a9094'], [1, '#a2a8ac']]);
  g.fillRect(0, 380, W, H - 380);
  const rnd = sorte(91);
  for (let k = 0; k < 40; k++) el(g, rnd() * W, 390 + rnd() * 200, 20 + rnd() * 40, 3 + rnd() * 4, 'rgba(0,0,0,0.06)');
  for (let x = 0; x < W; x += 40) forma(g, (x / 40) % 2 ? '#1b1b22' : '#e8c24a', [x, 384, x + 40, 384, x + 30, 396, x - 10, 396]);
  ret(g, 0, 376, W, 8, '#3f4a50');
  // As esteiras (entrada e saída da máquina)
  ret(g, 0, 300, 400, 36, '#2a3236', 6);
  ret(g, 0, 300, 400, 8, '#3f4a50', 4);
  for (let x = 20; x < 400; x += 60) { ret(g, x, 336, 10, 44, '#3f4a50'); }
  ret(g, 600, 310, 400, 30, '#2a3236', 6);
  ret(g, 600, 310, 400, 8, '#3f4a50', 4);
  for (let x = 640; x < W; x += 60) ret(g, x, 340, 10, 40, '#3f4a50');
  placa(g, 200, 268, 160, 26, 'Separe o lixo!', { fundo: '#e8c24a', borda: '#8a6a20', cor: '#2a1c08', fonte: '700 13px "Cinzel", Georgia, serif', neve: false });
  tapeteSaida(g, '#3a7a5a');
}
function animarReciclagem(g, t) {
  // Os rolos e o lixo andando na esteira
  for (let x = 0; x < 400; x += 20) el(g, mod(x + t * 40, 400), 304, 6, 3, '#4f5c64');
  for (let k = 0; k < 6; k++) {
    const x = mod(k * 70 + t * 40, 420) - 20;
    const [tipo, cor] = LIXO[k % 4];
    desenharLixo(g, tipo, cor, x, 298, k);
  }
  for (let x = 600; x < W; x += 20) el(g, 600 + mod(x - 600 + t * 40, 400), 314, 6, 3, '#4f5c64');
  for (let k = 0; k < 4; k++) {
    const x = 600 + mod(k * 110 + t * 40, 420);
    ret(g, x - 18, 282, 36, 28, ['#d8d0c0', '#c86a5a', '#a9a9b4', '#6fb08a'][k], 4);
    linha(g, 'rgba(0,0,0,0.3)', 2, [x - 18, 290, x + 18, 290]);
    linha(g, 'rgba(0,0,0,0.3)', 2, [x - 18, 302, x + 18, 302]);
  }
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.5 + k / 4) % 1;
    el(g, 500 + Math.sin(f * 6 + k) * 20, 210 - f * 120, 8 + f * 18, 6 + f * 14, `rgba(220,230,235,${0.35 * (1 - f)})`);
  }
}
export function desenharLixo(g, tipo, cor, x, y, k = 0) {
  if (tipo === 'papel') { ret(g, x - 10, y - 14, 20, 14, cor, 2); linha(g, '#9aa0a8', 1, [x - 7, y - 10, x + 7, y - 10]); linha(g, '#9aa0a8', 1, [x - 7, y - 6, x + 5, y - 6]); }
  else if (tipo === 'plastico') { ret(g, x - 6, y - 22, 12, 22, cor, 4); ret(g, x - 3, y - 27, 6, 6, '#3a6ab0', 1); }
  else if (tipo === 'metal') { ret(g, x - 8, y - 18, 16, 18, cor, 3); ret(g, x - 8, y - 12, 16, 5, k % 2 ? '#c0392b' : '#2f6b9a'); el(g, x, y - 18, 8, 2.5, '#e8e8f0'); }
  else { ret(g, x - 6, y - 20, 12, 20, cor, 5); ret(g, x - 3, y - 28, 6, 9, cor, 2); el(g, x - 2, y - 12, 2, 5, 'rgba(255,255,255,0.5)'); }
}
function maquinaReciclagem(g, t) {
  sombraNoChao(g, 500, 376, 140, 12);
  peca(g, 'maquina-reciclagem', 500, 376, t);
}
const LIXEIRAS = [['Papel', '#2f6b9a'], ['Plástico', '#c0392b'], ['Metal', '#d8b13a'], ['Vidro', '#3a8a5a']];
function lixeiras(g, t) {
  for (const [k, [nome, cor]] of LIXEIRAS.entries()) {
    const x = 640 + k * 74;
    const y = 470;
    sombraNoChao(g, x, y + 2, 28, 7);
    forma(g, cor, [x - 26, y - 64, x + 26, y - 64, x + 22, y, x - 22, y]);
    ret(g, x - 29, y - 72, 58, 10, cor, 4);
    ret(g, x - 29, y - 72, 58, 3, 'rgba(255,255,255,0.3)', 2);
    texto(g, nome, x, y - 36, { cor: '#ffffff', fonte: '700 11px "Cinzel", Georgia, serif' });
  }
}

/* ─── As salas ─── */

const salas = {
  forte: {
    fundo: fundoForte, animar: animarForte,
    objetos: [
      { y: 450, desenhar: (g, t) => forte(g, 250, 450, t, '#4a8fd8', -1) },
      { y: 450, desenhar: (g, t) => forte(g, 750, 450, t, '#e05a4a', 1, true) },
      { y: 520, desenhar: (g, t) => pilhaBolas(g, 392, 520, t) }, { y: 520, desenhar: (g, t) => pilhaBolas(g, 608, 520, t) },
      { y: 402, desenhar: placaGuerra },
      { y: 362, desenhar: (g, t) => bonecoNeve(g, 150, 362, t) },
      { y: 458, desenhar: g => setaPlaca(g, 72, 458, 'Praça', -1) }, { y: 458, desenhar: g => setaPlaca(g, 928, 458, 'Plaza', 1) },
      NEVE({ n: 80, semente: 2 }),
    ],
    pontos: [
      { x0: 420, y0: 326, x1: 580, y1: 404, ir: [500, 420], acao: 'neve.guerra', rotulo: 'Guerra de Bolas de Neve' },
      { x0: 140, y0: 360, x1: 360, y1: 452, ir: [250, 470], acao: 'neve.guerra', rotulo: 'Guerra de Bolas de Neve' },
      { x0: 640, y0: 360, x1: 860, y1: 452, ir: [750, 470], acao: 'neve.guerra', rotulo: 'Guerra de Bolas de Neve' },
      { x0: 458, y0: 56, x1: 542, y1: 142, ir: [500, 340], acao: 'neve.relogio', rotulo: 'Torre do Relógio' },
      { x0: 0, y0: 380, x1: 118, y1: 560, ir: [45, 470], acao: 'sala:praca', rotulo: 'Voltar à Praça' },
      { x0: 882, y0: 380, x1: 1000, y1: 560, ir: [955, 470], acao: 'sala:plaza', rotulo: 'Ir à Plaza' },
    ],
  },
  vila_esqui: {
    fundo: fundoVila, animar: animarVila,
    objetos: [
      { y: 428, desenhar: (g, t) => poste(g, 360, 428, t) }, { y: 428, desenhar: (g, t) => poste(g, 640, 428, t) },
      { y: 480, desenhar: (g, t) => bonecoNeve(g, 200, 480, t) },
      { y: 452, desenhar: (g, t) => trenoParado(g, 780, 452, t, '#2f6b9a', -1) },
      { y: 510, desenhar: g => setaPlaca(g, 66, 510, 'Praia', -1) }, { y: 510, desenhar: g => setaPlaca(g, 934, 510, 'Dojo', 1) },
      NEVE({ n: 70, semente: 3 }),
    ],
    pontos: [
      { x0: 52, y0: 248, x1: 150, y1: 348, ir: [100, 362], acao: 'sala:mina', rotulo: 'Caverna da Mina' },
      { x0: 228, y0: 262, x1: 302, y1: 348, ir: [265, 362], acao: 'sala:reciclagem', rotulo: 'Usina de Reciclagem' },
      { x0: 462, y0: 256, x1: 538, y1: 348, ir: [500, 362], acao: 'sala:cabana', rotulo: 'Cabana do Esqui' },
      { x0: 704, y0: 270, x1: 754, y1: 348, ir: [728, 362], acao: 'sala:escola', rotulo: 'Escola' },
      { x0: 826, y0: 200, x1: 980, y1: 350, ir: [895, 366], acao: 'sala:montanha', rotulo: 'Teleférico para a Montanha' },
      { x0: 0, y0: 420, x1: 120, y1: 590, ir: [45, 530], acao: 'sala:praia', rotulo: 'Descer para a Praia' },
      { x0: 880, y0: 420, x1: 1000, y1: 590, ir: [955, 530], acao: 'sala:patio_dojo', rotulo: 'Caminho do Dojo' },
    ],
  },
  cabana: {
    fundo: fundoCabana, animar: animarCabana,
    objetos: [
      { y: 370, desenhar: lareira },
      { y: 420, desenhar: balcaoCacau },
      { y: 470, desenhar: g => poltrona(g, 290, 470, '#2f6b34', -1) },
      { y: 540, desenhar: g => poltrona(g, 150, 540, '#8a2f3a', 1) },
      { y: 530, desenhar: g => mesinha(g, 380, 530) },
      { y: 560, desenhar: g => mesinha(g, 760, 560) },
    ],
    pontos: [
      { x0: 600, y0: 300, x1: 824, y1: 422, ir: [712, 436], acao: 'neve.cacau', rotulo: 'Pedir um chocolate quente' },
      { x0: 540, y0: 70, x1: 612, y1: 240, ir: [575, 392], acao: 'neve.cuco', rotulo: 'Relógio cuco' },
      { x0: 64, y0: 176, x1: 256, y1: 384, ir: [160, 400], acao: 'neve.lareira', rotulo: 'Sentar perto da lareira' },
      { x0: 836, y0: 100, x1: 1000, y1: 384, ir: [890, 400], acao: 'sala:sotao', rotulo: 'Subir ao Sótão' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:vila_esqui', rotulo: 'Voltar à Vila de Esqui' },
    ],
  },
  sotao: {
    fundo: fundoSotao, animar: animarSotao,
    objetos: [
      { y: 474, desenhar: mesaLig4 },
      { y: 440, desenhar: g => bau(g, 760, 440) },
    ],
    pontos: [
      { x0: 270, y0: 290, x1: 730, y1: 478, ir: [500, 500], acao: 'neve.lig4', rotulo: 'Jogar Lig 4' },
      { x0: 40, y0: 366, x1: 230, y1: 474, ir: [126, 480], acao: 'sala:cabana', rotulo: 'Descer para a Cabana' },
      { x0: 716, y0: 380, x1: 804, y1: 446, ir: [760, 462], acao: 'neve.bau', rotulo: 'Baú velho' },
    ],
  },
  montanha: {
    fundo: fundoMontanha, animar: animarMontanha,
    objetos: [
      { y: 388, desenhar: largada },
      ...[0, 1, 2, 3].map(k => ({ y: 404, desenhar: (g, t) => trenoParado(g, 365 + k * 90, 404, t, ['#c0392b', '#2f6b9a', '#3a8a5a', '#d8b13a'][k]) })),
      { y: 420, desenhar: (g, t) => npc(g, 'npc-instrutor', 760, 420, t, -1) },
      { y: 410, desenhar: g => binoculo(g, 880, 410) },
      NEVE({ n: 90, semente: 4, vento: 60, vel: 50 }),
    ],
    pontos: [
      { x0: 300, y0: 190, x1: 700, y1: 420, ir: [500, 432], acao: 'neve.treno', rotulo: 'Corrida de Trenó' },
      { x0: 728, y0: 340, x1: 790, y1: 424, ir: [720, 440], acao: 'neve.conversa:npc-instrutor', rotulo: 'Instrutor de Esqui' },
      { x0: 856, y0: 310, x1: 906, y1: 412, ir: [870, 430], acao: 'neve.binoculo', rotulo: 'Binóculo' },
      { x0: 20, y0: 240, x1: 210, y1: 400, ir: [114, 404], acao: 'sala:vila_esqui', rotulo: 'Teleférico: descer para a Vila' },
    ],
  },
  mina: {
    fundo: fundoMina, animar: animarMina,
    objetos: [
      { y: 436, desenhar: (g, t) => npc(g, 'npc-mineiro', 250, 436, t, 1) },
      { y: 488, desenhar: (g, t) => carrinhoParado(g, 560, 488, t) },
      { y: 520, desenhar: g => caixote(g, 820, 520) },
    ],
    pontos: [
      { x0: 0, y0: 210, x1: 124, y1: 404, ir: [60, 420], acao: 'sala:vila_esqui', rotulo: 'Saída para a Vila de Esqui' },
      { x0: 326, y0: 210, x1: 454, y1: 392, ir: [390, 402], acao: 'sala:mina_ouro', rotulo: 'Mina de Ouro' },
      { x0: 636, y0: 210, x1: 764, y1: 392, ir: [700, 402], acao: 'sala:piscina', rotulo: 'Descer para a Piscina' },
      { x0: 912, y0: 226, x1: 974, y1: 396, ir: [930, 410], acao: 'sala:lago_secreto', rotulo: 'Uma fenda estreita...' },
      { x0: 224, y0: 360, x1: 280, y1: 440, ir: [290, 450], acao: 'neve.conversa:npc-mineiro', rotulo: 'Velho Mineiro' },
    ],
  },
  mina_ouro: {
    fundo: fundoMinaOuro, animar: animarMinaOuro,
    objetos: [
      { y: 432, desenhar: britadeiras },
      { y: 470, desenhar: (g, t) => carrinhoParado(g, 360, 470, t) },
      { y: 540, desenhar: (g, t) => pilhaOuro(g, 470, 540, t) },
    ],
    pontos: [
      { x0: 560, y0: 270, x1: 744, y1: 436, ir: [650, 452], acao: 'neve.garimpo', rotulo: 'Jogar Mina de Ouro' },
      { x0: 0, y0: 220, x1: 130, y1: 404, ir: [60, 440], acao: 'sala:mina', rotulo: 'Voltar à Caverna da Mina' },
    ],
  },
  lago_secreto: {
    fundo: fundoLagoSecreto, animar: animarLagoSecreto,
    objetos: [],
    pontos: [
      { x0: 432, y0: 50, x1: 568, y1: 320, ir: [500, 424], acao: 'neve.cachoeira', rotulo: 'Cachoeira brilhante' },
      { x0: 60, y0: 300, x1: 260, y1: 400, ir: [170, 428], acao: 'neve.cristal', rotulo: 'Cristais' },
      { x0: 680, y0: 300, x1: 940, y1: 400, ir: [820, 428], acao: 'neve.cristal', rotulo: 'Cristais' },
      { x0: 0, y0: 296, x1: 100, y1: 440, ir: [56, 450], acao: 'sala:mina', rotulo: 'Voltar à Mina' },
    ],
  },
  piscina: {
    fundo: fundoPiscina, animar: animarPiscina,
    objetos: [
      { y: 492, desenhar: cercadinhoPompons },
      { y: 412, desenhar: g => cadeiraSalvaVidas(g, 360, 412) },
    ],
    pontos: [
      { x0: 660, y0: 376, x1: 860, y1: 500, ir: [760, 520], acao: 'neve.pompons', rotulo: 'Resgate dos Pompons' },
      { x0: 0, y0: 196, x1: 116, y1: 400, ir: [60, 420], acao: 'sala:mina', rotulo: 'Subir para a Mina' },
      { x0: 876, y0: 196, x1: 980, y1: 392, ir: [928, 412], acao: 'sala:caldeira', rotulo: 'Sala da Caldeira' },
      { x0: 220, y0: 50, x1: 780, y1: 260, ir: [500, 404], acao: 'neve.janela', rotulo: 'A janela do fundo do mar' },
    ],
  },
  escola: {
    fundo: fundoEscola, animar: animarEscola,
    objetos: [
      { y: 412, desenhar: mesaProfessora },
      ...[[180, 470], [340, 470], [660, 480], [180, 548], [340, 548], [660, 550]].map(([x, y]) => ({ y, desenhar: (g, t) => carteira(g, x, y, t) })),
    ],
    pontos: [
      { x0: 290, y0: 60, x1: 710, y1: 272, ir: [500, 400], acao: 'neve.quiz', rotulo: 'Quiz da Ilha' },
      { x0: 724, y0: 330, x1: 770, y1: 404, ir: [700, 420], acao: 'neve.conversa:npc-professora', rotulo: 'Professora Orelhuda' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:vila_esqui', rotulo: 'Voltar à Vila de Esqui' },
    ],
  },
  reciclagem: {
    fundo: fundoReciclagem, animar: animarReciclagem,
    objetos: [
      { y: 376, desenhar: maquinaReciclagem },
      { y: 470, desenhar: lixeiras },
      { y: 440, desenhar: (g, t) => npc(g, 'npc-operario', 230, 440, t, 1) },
    ],
    pontos: [
      { x0: 0, y0: 250, x1: 400, y1: 340, ir: [200, 400], acao: 'neve.separar', rotulo: 'Separar o lixo' },
      { x0: 380, y0: 90, x1: 620, y1: 380, ir: [500, 396], acao: 'neve.separar', rotulo: 'Máquina de reciclagem' },
      { x0: 610, y0: 396, x1: 900, y1: 474, ir: [760, 490], acao: 'neve.separar', rotulo: 'Separar o lixo' },
      { x0: 204, y0: 370, x1: 256, y1: 444, ir: [280, 452], acao: 'neve.conversa:npc-operario', rotulo: 'Operária da Usina' },
      { x0: 420, y0: 560, x1: 580, y1: 600, ir: [500, 585], acao: 'sala:vila_esqui', rotulo: 'Voltar à Vila de Esqui' },
    ],
  },
};

/* ─── O mapa da ilha ─── */

const info = {
  forte: { nome: 'Forte Nevado', desc: 'Dois fortes de neve, a torre do relógio e a Guerra de Bolas de Neve.', regiao: 'neve', icone: 'escudo', mapa: { x: 520, y: 240 } },
  vila_esqui: { nome: 'Vila de Esqui', desc: 'A Cabana, a Escola, a Usina, a Mina e o teleférico.', regiao: 'neve', icone: 'casa', mapa: { x: 650, y: 176 } },
  cabana: { nome: 'Cabana do Esqui', desc: 'Lareira, chocolate quente e o relógio cuco.', regiao: 'neve', icone: 'fogo', mapa: { x: 600, y: 140 } },
  sotao: { nome: 'Sótão da Cabana', desc: 'A mesa comprida com o Lig 4.', regiao: 'neve', icone: 'lig4', mapa: null },
  montanha: { nome: 'Estação de Esqui', desc: 'O topo da montanha e a Corrida de Trenó.', regiao: 'neve', icone: 'bandeira', mapa: { x: 760, y: 72 } },
  mina: { nome: 'Caverna da Mina', desc: 'Trilhos, carrinhos e túneis para todo lado.', regiao: 'neve', icone: 'lanterna', mapa: { x: 470, y: 160 } },
  mina_ouro: { nome: 'Mina de Ouro', desc: 'Cave com a britadeira e junte pepitas.', regiao: 'neve', icone: 'moeda', mapa: null },
  lago_secreto: { nome: 'Lago Secreto', desc: 'Uma caverna com uma cachoeira que brilha.', regiao: 'neve', icone: 'gota', mapa: null },
  piscina: { nome: 'Piscina Subterrânea', desc: 'A janela para o fundo do mar e o Resgate dos Pompons.', regiao: 'neve', icone: 'gota', mapa: null },
  escola: { nome: 'Escola', desc: 'Lições engraçadas e o Quiz da Ilha.', regiao: 'neve', icone: 'livro', mapa: { x: 740, y: 210 } },
  reciclagem: { nome: 'Usina de Reciclagem', desc: 'Esteiras, a grande máquina e o lixo para separar.', regiao: 'neve', icone: 'aleatorio', mapa: { x: 840, y: 150 } },
};

/* ─── As ações dos pontos de clique ─── */

const jogos = () => import('./neve-jogos.js');
const sorteio = lista => lista[Math.floor(Math.random() * lista.length)];
const acoes = {
  async 'neve.guerra'(ctx) { (await jogos()).abrirGuerraNeve(ctx); },
  async 'neve.treno'(ctx) { (await jogos()).abrirCorridaTreno(ctx); },
  async 'neve.garimpo'(ctx) { (await jogos()).abrirMinaOuro(ctx); },
  async 'neve.pompons'(ctx) { (await jogos()).abrirResgatePompons(ctx); },
  async 'neve.separar'(ctx) { (await jogos()).abrirSepararLixo(ctx); },
  async 'neve.quiz'(ctx) { (await jogos()).abrirQuizIlha(ctx); },
  async 'neve.lig4'(ctx) { (await jogos()).abrirMesaLig4(ctx); },
  'neve.relogio'(ctx) {
    const d = new Date();
    ctx.aviso(`Dom, dom! São ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')} na Ilha do Club Coelho.`);
  },
  'neve.cacau'(ctx) {
    ctx.enviar('clube:emote', { e: 'cafe' });
    ctx.aviso(sorteio(['Um chocolate quente com marshmallow!', 'Chocolate quente com chantilly, cuidado que está quente!', 'Chocolate com canela, o favorito da Dona Cacau.']));
  },
  'neve.cuco'(ctx) {
    RELOGIO.cucoAte = Date.now() + 1800;
    ctx.aviso('Cuco! Cuco!');
  },
  'neve.lareira'(ctx) {
    ctx.enviar('clube:emote', { e: 'sentar' });
    ctx.aviso('Que quentinho perto da lareira...');
  },
  'neve.conversa'(ctx, id) {
    const n = NPCS[id];
    if (n) ctx.aviso(`${n.nome}: ${sorteio(FALAS[id])}`);
  },
  'neve.binoculo'(ctx) {
    ctx.aviso(sorteio(['Dá para ver a ilha inteirinha: a Praça, a Plaza, a Praia e o Farol lá no sul!', 'Lá longe, no mar, tem um iceberg enorme...', 'Olhando bem, dá para ver um navio pirata perto da Praia!']));
  },
  'neve.bau'(ctx) {
    ctx.aviso(sorteio(['No baú: fotos antigas da Cabana, quando ela ainda era uma casinha.', 'No baú: um cachecol de tricô e um bilhete: "Volto no inverno. S. R."', 'No baú: um tabuleiro de Lig 4 reserva, com uma peça faltando.']));
  },
  'neve.janela'(ctx) {
    ctx.aviso(sorteio(['Um cardume passou nadando pela janela!', 'Lá no fundo, um peixe dourado parece piscar para você.', 'As algas balançam devagarinho do outro lado do vidro.']));
  },
  'neve.cristal'(ctx) {
    ctx.aviso(sorteio(['Plim! O cristal canta quando você encosta.', 'Os cristais brilham mais forte perto da cachoeira.', 'Plom! Esse cristal faz um som mais grave.']));
  },
  async 'neve.cachoeira'(ctx) {
    CACHOEIRA.toque = Date.now();
    if (!CACHOEIRA.aberta) {
      try { if (await ctx.progresso.ler('neve.cachoeira')) CACHOEIRA.aberta = true; } catch { /* sem conexão: segue contando */ }
    }
    if (CACHOEIRA.aberta) {
      ctx.aviso('Atrás da cachoeira, o Pompom dourado continua dormindo. Ao lado, alguém escreveu: "S. R. esteve aqui".');
      return;
    }
    CACHOEIRA.cliques++;
    const falas = ['A água brilha um pouquinho mais forte...', 'Parece que tem um eco lá atrás da água.', 'Você ouve um ronquinho atrás da cachoeira!', 'A água começa a se abrir...'];
    if (CACHOEIRA.cliques < 5) { ctx.aviso(falas[CACHOEIRA.cliques - 1]); return; }
    CACHOEIRA.aberta = true;
    ctx.aviso('Segredo descoberto! Atrás da cachoeira dorme um Pompom dourado, e na pedra está escrito "S. R. esteve aqui".');
    try { await ctx.progresso.gravar('neve.cachoeira', true); } catch { /* fica aberta só nesta visita */ }
  },
};

/* ─── Sprites (veja sprites.js) ─── */

export const SPRITES = [
  ...Object.entries(NPCS).map(([id, n]) => ({
    chave: `ilha-neve.${id}`, jogo: JOGO, nome: n.nome,
    desc: `O NPC ${n.sala}. O sprite troca o coelho inteiro, com a roupa. Olhando para a direita.`,
    largura: Math.round(44 * n.escala), altura: Math.round(56 * n.escala), ancora: 'pe',
    animacoes: [ANIM('parado', 'Parado', 2, 3)],
    previa: (g, anim, t) => { g.save(); g.scale(n.escala, n.escala); desenharCoelho(g, 0, 0, { pelo: n.pelo, roupa: n.roupa, dir: 1, t, semSprite: true }); g.restore(); },
  })),
  ...Object.entries(PECAS).map(([id, p]) => ({
    chave: `ilha-neve.${id}`, jogo: JOGO, nome: p.nome, desc: p.desc, largura: p.l, altura: p.a, ancora: p.ancora || 'pe',
    animacoes: p.anims, previa: (g, anim, t) => p.corpo(g, t, anim, {}), ...(p.tingir ? { tingir: true } : {}),
  })),
];
registrarPecas(SPRITES);

registrarRegiao({ id: 'neve', salas, info, acoes });

// Para os testes: as salas, as ações e o estado dos segredos.
export const _neve = { salas, info, acoes, NPCS, CACHOEIRA, RELOGIO };
