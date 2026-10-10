// Arena da Toca (estilo Clash Royale) no navegador. O jogo roda no servidor (src/junto-arena.js):
// aqui só se escolhe o baralho, mandam as cartas ({ tipo: 'carta', carta, x, y }) e desenham os quadros
// que chegam 20 vezes por segundo, misturando dois quadros seguidos para o movimento ficar suave.
//
// Sem sala: a tela de começo, com o montador de baralho (8 de 13 cartas, guardado neste navegador para
// cada pessoa), "Jogar contra o Raposo" (abre e já começa uma sala de 1), "Chamar alguém" e as partidas
// que estão acontecendo, para assistir. Numa sala da arena: a arena em pé, com o seu lado sempre embaixo,
// a mão de 4 cartas, a próxima e as cenouras. Arraste a carta para a arena, ou toque na carta e depois no
// lugar (teclas 1 a 4 escolhem a carta; Esc desiste).

import { h, trocar, icone, botao, cabecalho, aoSair, estado, pode, aviso } from '../core.js';
import { rt, ouvir, enviar, criarPartida } from '../tempo-real.js';
import { juntoNoJogo, CORES_JUNTO } from '../junto.js';
import { abrirJunto } from './junto.js';
import { registrarPecas, desenharSprite, aoMudarSprites, usarNomeDaPeca } from '../sprites.js';
import { desenharCoelho, desenharRaposa, elipse, sombrear } from '../desenho-coelho.js';
import { admPodeAgir } from '../adm-jogos.js';

/* ─── As regras que o navegador precisa saber (as mesmas de src/junto-arena.js) ─── */

const LARG = 18;
const ALT = 32;
const T = 24; // pixels por casa no desenho (a tela estica para caber)
const W = LARG * T;
const H = ALT * T;
const PONTES = [3.5, 14.5];
const MAX_CENOURAS = 10;
const RECARGA = 2.8;
const ATRASO_MS = 110; // o desenho anda um pouco atrás do último quadro (para ter dois para misturar)
// Os tipos na ordem do servidor (o quadro manda o número).
const TIPOS = ['ratinho', 'esquilo', 'espadachim', 'arqueiro', 'javali', 'coruja', 'ourico', 'corvo', 'urso', 'carvalho', 'broto', 'vigia', 'princesa', 'rei'];
const TIROS = ['flecha', 'bolota', 'pena', 'magia', 'virote', 'pedra', 'bomba'];
const RAIO = { ratinho: 0.3, esquilo: 0.35, espadachim: 0.5, arqueiro: 0.4, javali: 0.55, coruja: 0.5, ourico: 0.55, corvo: 0.55, urso: 0.8, carvalho: 0.95, broto: 0.5, vigia: 0.9, princesa: 1.5, rei: 2.0 };
const VOA = new Set(['coruja', 'corvo']);
const LUGAR_TORRES = [[3.5, 25.5], [14.5, 25.5], [9, 29]];
const FX = { carta: 0, bomba: 1, bolotas: 2, morte: 3, torre: 4, area: 5, fala: 6 };
const FALAS = ['Essa toca vai ser minha!', 'Hehehe! Uma torre a menos.', 'Grrr... foi sorte sua!', 'A toca é do Raposo!', 'Isso não vai ficar assim...', 'Lá vou eu!'];

// As cartas, na ordem do servidor. alvo: o que acerta; papel: para que serve.
export const CARTAS = [
  { k: 'ratinhos', nome: 'Ratinhos', custo: 1, un: 'ratinho', qtd: 3, vida: 60, dano: 60, alvo: 'Chão', vel: 'Rápido', papel: 'Três ratinhos baratos que distraem e mordem. Morrem com qualquer respingo.' },
  { k: 'esquilos', nome: 'Enxame de Esquilos', custo: 2, un: 'esquilo', qtd: 3, vida: 100, dano: 60, alvo: 'Chão e ar', vel: 'Rápido', papel: 'Três esquilos que jogam bolotas de longe. Bons e baratos contra quem voa.' },
  { k: 'espadachim', nome: 'Coelho Espadachim', custo: 3, un: 'espadachim', qtd: 1, vida: 1250, dano: 145, alvo: 'Chão', vel: 'Médio', papel: 'Aguenta bastante e bate firme. O defensor de todo baralho.' },
  { k: 'arqueiros', nome: 'Coelhos Arqueiros', custo: 3, un: 'arqueiro', qtd: 2, vida: 220, dano: 78, alvo: 'Chão e ar', vel: 'Médio', papel: 'Dois arqueiros de alcance longo. Derrubam corujas e corvos atrás de um tanque.' },
  { k: 'bolotas', nome: 'Chuva de Bolotas', custo: 3, raio: 3, dano: 240, alvo: 'Chão e ar', papel: 'Feitiço em área larga. Acaba com enxames, ratinhos e arqueiros. Nas torres tira menos.' },
  { k: 'javali', nome: 'Javali', custo: 4, un: 'javali', qtd: 1, vida: 1200, dano: 230, alvo: 'Construções', vel: 'Muito rápido', papel: 'Corre direto para as torres e pula o rio. Não liga para as tropas.' },
  { k: 'coruja', nome: 'Coruja', custo: 4, un: 'coruja', qtd: 1, vida: 600, dano: 220, alvo: 'Chão e ar', vel: 'Rápido', voa: true, papel: 'Voa por cima do rio e bate forte num alvo só. Quem só acerta o chão não pega.' },
  { k: 'ourico', nome: 'Ouriço', custo: 4, un: 'ourico', qtd: 1, vida: 1350, dano: 190, alvo: 'Chão', vel: 'Médio', papel: 'Espinhos para todo lado: acerta todo mundo em volta. O terror dos enxames.' },
  { k: 'bomba', nome: 'Bomba de Cenoura', custo: 4, raio: 2.5, dano: 500, alvo: 'Chão e ar', papel: 'Sai do seu castelo e explode onde cair, empurrando os pequenos. Nas torres tira menos.' },
  { k: 'vigia', nome: 'Torre de Vigia', custo: 4, un: 'vigia', qtd: 1, vida: 850, dano: 160, alvo: 'Chão e ar', papel: 'Construção que atira em tudo e puxa Ursos e Javalis. Dura 30 segundos.' },
  { k: 'corvo', nome: 'Corvo Mago', custo: 5, un: 'corvo', qtd: 1, vida: 820, dano: 150, alvo: 'Chão e ar', vel: 'Médio', voa: true, papel: 'Voa e lança magia que respinga em volta. Ótimo atrás de um tanque.' },
  { k: 'urso', nome: 'Urso Gigante', custo: 5, un: 'urso', qtd: 1, vida: 2950, dano: 185, alvo: 'Construções', vel: 'Lento', papel: 'O tanque: aguenta as torres enquanto o resto do empurrão ataca.' },
  { k: 'carvalho', nome: 'Carvalho Ancião', custo: 7, un: 'carvalho', qtd: 1, vida: 4500, dano: 270, alvo: 'Construções', vel: 'Muito lento', papel: 'Uma árvore enorme que só quer as torres. Quando cai, solta dois Brotos e machuca quem está perto.' },
];
const CARTA = Object.fromEntries(CARTAS.map(c => [c.k, c]));
const BARALHO_PADRAO = ['javali', 'espadachim', 'arqueiros', 'esquilos', 'ourico', 'coruja', 'bolotas', 'bomba'];
const COR_MEU = '#4f8fd8';
const COR_OUTRO = '#d8574a';

const yDoLado = (lado, y) => (lado === 0 ? y : ALT - y);
const relogio = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ─── O baralho guardado (por pessoa, neste navegador) ─── */

const chaveBaralho = () => `arena.baralho.${estado.eu?.id ?? 'anonimo'}`;
function lerBaralho() {
  try {
    const l = JSON.parse(localStorage.getItem(chaveBaralho()) || 'null');
    if (Array.isArray(l) && l.length === 8 && new Set(l).size === 8 && l.every(k => CARTA[k])) return l;
  } catch { /* sem armazenamento: vale o padrão */ }
  return [...BARALHO_PADRAO];
}
function guardarBaralho(l) {
  try { localStorage.setItem(chaveBaralho(), JSON.stringify(l)); } catch { /* sem armazenamento: só nesta tela */ }
}

/* ─── Desenhos por código (sem sprite enviado) ─── */
// Cada um desenha com os pés em (0, 0), olhando para a direita. t = segundos (animação); bate = 0..1 do golpe.

function caminho(g, pontos, cor) {
  g.fillStyle = cor;
  g.beginPath();
  pontos.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}
function traco(g, x1, y1, x2, y2, cor, larg = 2) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
const sombra = (g, rx, ry = rx * 0.32) => elipse(g, 0, 0, rx, ry, 'rgba(0,0,0,0.28)');

function pintarRatinho(g, t, bate, cor) {
  sombra(g, 8);
  const pulo = Math.abs(Math.sin(t * 14)) * 2;
  g.save();
  g.translate(bate * 3, -pulo);
  g.strokeStyle = '#c9a0a0'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-7, -5); g.quadraticCurveTo(-13, -4, -12, -10); g.stroke();
  elipse(g, 0, -5, 8, 5.2, '#9aa0a6');
  elipse(g, 6, -8, 4.6, 4, '#a9afb5');
  elipse(g, 4.5, -12.5, 2.8, 2.8, '#a9afb5');
  elipse(g, 4.5, -12.5, 1.5, 1.5, '#e6a4a4');
  elipse(g, 8, -9, 1, 1.1, '#1b1403');
  elipse(g, 10.5, -7.5, 1.1, 0.9, '#e6a4a4');
  g.fillStyle = cor; g.fillRect(1, -9, 3, 5);
  g.restore();
}

function pintarEsquilo(g, t, bate, cor) {
  sombra(g, 8);
  const pulo = Math.abs(Math.sin(t * 12)) * 2.2;
  g.save();
  g.translate(0, -pulo);
  elipse(g, -7, -14, 5, 9, '#c98545', -0.35);
  elipse(g, -6, -13, 3, 6.5, '#e0a465', -0.35);
  elipse(g, 0, -8, 6, 7, '#b06a32');
  elipse(g, 1.5, -6, 3.2, 4.5, '#e8c79c');
  elipse(g, 5, -15, 4.6, 4.2, '#b06a32');
  caminho(g, [[3, -18], [4.5, -23], [6, -18]], '#8a4f22');
  elipse(g, 7, -16, 1, 1.1, '#1b1403');
  elipse(g, 9.4, -14.5, 0.9, 0.8, '#3a2416');
  g.fillStyle = cor; g.fillRect(1.5, -12, 6, 2.2);
  // A bolota na mão (sobe quando joga).
  const bx = 7 + bate * 3;
  const by = -8 - bate * 7;
  elipse(g, bx, by, 2.2, 2.6, '#a8742f');
  elipse(g, bx, by - 2, 2.5, 1.3, '#6b4a2a');
  g.restore();
}

function pintarCoelhoGuerreiro(g, t, bate, cor, { pelo, arma, semSprite, andando }) {
  g.save();
  g.scale(0.6, 0.6);
  desenharCoelho(g, 0, 0, { pelo, andando, passo: t, t, semSprite });
  // Capacete ou lenço na cor do lado.
  if (arma === 'espada') {
    elipse(g, 11, -33, 10, 5.5, cor);
    g.fillStyle = sombrear(cor.length === 7 ? cor : '#4f8fd8', -0.25); g.fillRect(2, -33, 18, 3);
    // Espada: gira no golpe.
    g.save();
    g.translate(14, -13);
    g.rotate(-1.1 + bate * 1.9);
    g.fillStyle = '#8a6a3a'; g.fillRect(-1.5, -2, 3, 6);
    g.fillStyle = '#d8b13a'; g.fillRect(-4, -3.5, 8, 2.2);
    caminho(g, [[-2, -3.5], [2, -3.5], [1.2, -24], [0, -27], [-1.2, -24]], '#dfe6ee');
    g.restore();
    // Escudo
    elipse(g, -2, -14, 6, 8, sombrear(cor.length === 7 ? cor : '#4f8fd8', -0.1));
    elipse(g, -2, -14, 2.2, 2.6, '#d8b13a');
  } else {
    g.fillStyle = cor; g.fillRect(4, -21, 14, 3.5);
    // Aljava nas costas e o arco na frente.
    g.fillStyle = '#7a5034'; g.fillRect(-14, -30, 5, 16);
    traco(g, -13, -31, -14, -36, '#e9dcc3', 1.2); traco(g, -11, -31, -10, -37, '#e9dcc3', 1.2);
    const puxa = bate * 5;
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(18, -16, 11, -1.2, 1.2); g.stroke();
    traco(g, 18 + 11 * Math.cos(-1.2), -16 + 11 * Math.sin(-1.2), 16 - puxa, -16, '#e9e2d0', 0.9);
    traco(g, 16 - puxa, -16, 18 + 11 * Math.cos(1.2), -16 + 11 * Math.sin(1.2), '#e9e2d0', 0.9);
    if (bate > 0.2) traco(g, 14 - puxa, -16, 30 - puxa, -16, '#c9b07a', 1.4);
  }
  g.restore();
}

function pintarJavali(g, t, bate, cor) {
  sombra(g, 15);
  const passo = Math.sin(t * 16);
  g.save();
  g.translate(bate * 4, -Math.abs(passo) * 1.5);
  for (const [px, k] of [[-9, 1], [-4, -1], [6, 1], [11, -1]]) { g.fillStyle = '#3e2a1c'; g.fillRect(px + passo * 2.5 * k - 1.6, -6, 3.2, 6); }
  elipse(g, 0, -11, 15, 8.5, '#6b4a33');
  caminho(g, [[-12, -16], [-6, -21], [0, -17], [5, -21], [10, -16]], '#4a3122');
  g.fillStyle = cor; g.fillRect(-6, -18, 9, 6);
  g.save();
  g.translate(13, -10);
  g.rotate(bate * 0.35);
  elipse(g, 0, 0, 7.5, 6, '#7a573c');
  elipse(g, 6, 1, 3.5, 3, '#d99a8a');
  elipse(g, 7, 0.5, 0.7, 0.7, '#3a2416'); elipse(g, 7, 2, 0.7, 0.7, '#3a2416');
  caminho(g, [[3, 3], [6, 6], [4, 2]], '#f5efe0');
  elipse(g, 1.5, -2.5, 1, 1.1, '#1b1403');
  caminho(g, [[-3, -4], [-1, -9], [1, -4]], '#5a3a26');
  g.restore();
  g.restore();
}

function pintarCoruja(g, t, bate, cor) {
  const asa = Math.sin(t * 13) * 0.7;
  g.save();
  g.translate(bate * 3, 0);
  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * 7, -15);
    g.rotate(s * (0.4 + asa));
    elipse(g, s * 7, 0, 9, 4.5, '#6e5238');
    g.restore();
  }
  elipse(g, 0, -12, 9, 11.5, '#8a6a4a');
  elipse(g, 1, -9, 6, 7, '#d9c39a');
  caminho(g, [[-6, -21], [-4, -27], [-2, -21]], '#6e5238');
  caminho(g, [[2, -21], [4, -27], [6, -21]], '#6e5238');
  elipse(g, 1, -18, 7.5, 5.5, '#e6d3ad');
  for (const ox of [-2.2, 4.2]) { elipse(g, ox, -18, 2.5, 2.5, '#f4c430'); elipse(g, ox + 0.4, -18, 1.2, 1.4, '#1b1403'); }
  caminho(g, [[0.2, -16.5], [2, -16.5], [1.1, -13.5]], '#e0a23a');
  g.fillStyle = cor; g.fillRect(-5, -7, 10, 2);
  elipse(g, -2, 0, 1.6, 1, '#e0a23a'); elipse(g, 3, 0, 1.6, 1, '#e0a23a');
  g.restore();
}

function pintarOurico(g, t, bate, cor) {
  sombra(g, 12);
  const k = 1 + bate * 0.3;
  const pulo = Math.abs(Math.sin(t * 10)) * 1.2;
  g.save();
  g.translate(0, -pulo);
  g.save();
  g.translate(-1, -9);
  g.rotate(bate * 0.6);
  g.fillStyle = '#4a3528';
  g.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI;
    const r = (i % 2 ? 9 : 15) * k;
    g.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.85);
  }
  g.closePath();
  g.fill();
  g.restore();
  elipse(g, -1, -8, 12, 8, '#6b4f3c');
  elipse(g, 9, -6, 5.5, 4.5, '#e3c9a0');
  elipse(g, 14, -6, 1.6, 1.4, '#1b1403');
  elipse(g, 9.5, -8, 1, 1.1, '#1b1403');
  g.fillStyle = cor; g.fillRect(3, -11, 3, 7);
  elipse(g, -6, -1, 2.5, 1.4, '#3a2a20'); elipse(g, 5, -1, 2.5, 1.4, '#3a2a20');
  g.restore();
}

function pintarCorvo(g, t, bate, cor) {
  const asa = Math.sin(t * 9) * 0.6;
  g.save();
  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * 6, -14);
    g.rotate(s * (0.3 + asa));
    caminho(g, [[0, 0], [s * 16, -4], [s * 13, 3], [s * 4, 4]], '#1d1d26');
    g.restore();
  }
  elipse(g, 0, -12, 10, 9, '#23232b');
  elipse(g, 8, -19, 5.5, 5, '#2b2b35');
  caminho(g, [[12, -20], [18, -18], [12, -17]], '#9aa0a6');
  elipse(g, 9.5, -20, 1.1, 1.2, '#f4dd80');
  // Chapéu de mago com estrela.
  caminho(g, [[2, -23], [14, -23], [9, -36]], '#5b3a8a');
  g.fillStyle = '#f4dd80'; g.fillRect(7, -29, 2, 2);
  g.fillStyle = cor; g.fillRect(2, -24, 12, 2);
  // Cajado com a bolinha de magia (brilha no golpe).
  traco(g, -6, -2, -9, -24, '#7a5034', 2);
  const r = 2.8 + bate * 2.5;
  elipse(g, -9, -26, r + 2, r + 2, 'rgba(180,120,255,0.35)');
  elipse(g, -9, -26, r, r, '#c9a0ff');
  g.restore();
}

function pintarUrso(g, t, bate, cor) {
  sombra(g, 20);
  const passo = Math.sin(t * 7);
  g.save();
  g.translate(0, -Math.abs(passo) * 1.5);
  for (const [px, k] of [[-12, 1], [-4, -1], [6, 1], [13, -1]]) { g.fillStyle = '#5a3a24'; g.fillRect(px + passo * 2 * k - 3.5, -9, 7, 9); }
  elipse(g, 0, -20, 20, 15, '#7a5034');
  elipse(g, 3, -15, 12, 8, '#8f6340');
  g.strokeStyle = cor; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-10, -32); g.lineTo(6, -8); g.stroke();
  elipse(g, 16, -30, 11, 10, '#7a5034');
  elipse(g, 10, -39, 4, 4, '#7a5034'); elipse(g, 10, -39, 2, 2, '#c99a6b');
  elipse(g, 21, -39, 4, 4, '#7a5034'); elipse(g, 21, -39, 2, 2, '#c99a6b');
  elipse(g, 24, -27, 5.5, 4.2, '#c99a6b');
  elipse(g, 27, -28, 1.8, 1.5, '#1b1403');
  elipse(g, 19, -32, 1.4, 1.6, '#1b1403');
  // A pata que bate.
  g.save();
  g.translate(16, -18);
  g.rotate(-0.4 - bate * 1.2);
  elipse(g, 6, 0, 7, 5, '#6b4630');
  g.restore();
  g.restore();
}

function pintarCarvalho(g, t, bate, cor) {
  sombra(g, 22);
  const passo = Math.sin(t * 5);
  g.save();
  g.translate(0, -Math.abs(passo) * 1.2);
  for (const k of [-1, 1]) { g.fillStyle = '#5a3a20'; g.fillRect(k * 7 + passo * 2 * k - 4, -8, 8, 8); }
  g.fillStyle = '#6b4a2a'; g.fillRect(-11, -44, 22, 38);
  traco(g, -5, -40, -6, -12, '#4e341c', 1.5); traco(g, 4, -38, 5, -16, '#4e341c', 1.5);
  // Galhos-braços (um bate).
  g.save(); g.translate(10, -34); g.rotate(-0.5 + bate * 1.3); traco(g, 0, 0, 16, 2, '#5a3a20', 4); traco(g, 12, 1, 17, -5, '#5a3a20', 2.5); g.restore();
  g.save(); g.translate(-10, -34); g.rotate(0.5); traco(g, 0, 0, -14, 4, '#5a3a20', 4); g.restore();
  elipse(g, 0, -56, 24, 17, '#2f6b34');
  elipse(g, -12, -50, 13, 11, '#3a7a3c');
  elipse(g, 12, -52, 14, 11, '#3f8a41');
  elipse(g, 2, -66, 13, 9, '#4f9440');
  g.fillStyle = cor; g.fillRect(-11, -24, 22, 3);
  elipse(g, -4, -34, 2.6, 2, '#f4dd80'); elipse(g, 5, -34, 2.6, 2, '#f4dd80');
  traco(g, -4, -27, 5, -27, '#2c1a0c', 2);
  g.restore();
}

function pintarBroto(g, t, bate, cor) {
  sombra(g, 9);
  const passo = Math.sin(t * 8);
  g.save();
  g.translate(bate * 2, -Math.abs(passo));
  g.fillStyle = '#6b4a2a'; g.fillRect(-4, -18, 8, 18);
  elipse(g, -6, -22, 7, 4, '#4f9440', -0.5);
  elipse(g, 6, -24, 7, 4, '#5aa04a', 0.5);
  elipse(g, 0, -27, 4, 6, '#3f8a41');
  g.fillStyle = cor; g.fillRect(-4, -9, 8, 2);
  elipse(g, -1.5, -14, 1.2, 1, '#f4dd80'); elipse(g, 2, -14, 1.2, 1, '#f4dd80');
  g.restore();
}

function pintarVigia(g, t, bate, cor) {
  sombra(g, 20, 7);
  g.fillStyle = '#5a3a20';
  for (const px of [-15, 11]) g.fillRect(px, -36, 4, 36);
  traco(g, -13, -4, 13, -30, '#4a2e18', 2.5); traco(g, 13, -4, -13, -30, '#4a2e18', 2.5);
  g.fillStyle = '#8a6438'; g.fillRect(-19, -40, 38, 7);
  g.fillStyle = '#6b4a2a'; g.fillRect(-17, -50, 3, 10); g.fillRect(14, -50, 3, 10);
  caminho(g, [[-21, -50], [21, -50], [0, -62]], '#a0522d');
  // Bandeira na cor do lado.
  traco(g, 0, -62, 0, -72, '#3a2416', 1.4);
  caminho(g, [[0, -72], [10, -69], [0, -66]], cor);
  // Besta em cima (recua no tiro).
  g.save();
  g.translate(-bate * 3, -44);
  g.fillStyle = '#4e341c'; g.fillRect(-6, -2, 14, 3);
  g.strokeStyle = '#2c1a0c'; g.lineWidth = 1.5; g.beginPath(); g.arc(6, 0, 6, -1.3, 1.3); g.stroke();
  g.restore();
}

// Torre (princesa): pedra, bandeira do lado e um coelho arqueiro em cima. Os pés no meio da base.
function pintarTorre(g, cor, destruida, t = 0, semSprite = false) {
  sombra(g, 34, 9);
  if (destruida) {
    for (const [x, y, r, c] of [[-16, -6, 12, '#6f6a60'], [10, -5, 14, '#7c776c'], [-2, -12, 11, '#8a857a'], [18, -10, 7, '#5f5a50'], [-22, -4, 7, '#7c776c']]) elipse(g, x, y, r, r * 0.6, c);
    traco(g, -6, -20, 6, -10, '#3a352e', 2);
    return;
  }
  g.fillStyle = '#8a857a'; g.fillRect(-26, -54, 52, 54);
  g.fillStyle = '#9c978a';
  for (let y = -50; y < 0; y += 10) for (let x = -24 + ((y / 10) % 2 ? 6 : 0); x < 24; x += 14) g.fillRect(x, y, 11, 7);
  g.fillStyle = '#6f6a60';
  for (let x = -28; x < 28; x += 11) g.fillRect(x, -62, 7, 9);
  g.fillRect(-29, -55, 58, 5);
  traco(g, 22, -62, 22, -80, '#3a2416', 1.6);
  caminho(g, [[22, -80], [34, -76], [22, -71]], cor);
  g.save();
  g.translate(-2, -55);
  g.scale(0.55, 0.55);
  desenharCoelho(g, 0, 0, { pelo: '#e9dcc3', t, semSprite });
  g.restore();
}

// Toca do Rei: o castelo maior. O rei (o coelho de quem joga, ou o Raposo) é desenhado à parte, por cima.
function pintarCastelo(g, cor, destruido, acordado) {
  sombra(g, 44, 11);
  if (destruido) {
    for (const [x, y, r, c] of [[-22, -7, 15, '#6f6a60'], [14, -6, 17, '#7c776c'], [-4, -15, 14, '#8a857a'], [26, -12, 9, '#5f5a50'], [-30, -5, 9, '#7c776c'], [4, -26, 8, '#6f6a60']]) elipse(g, x, y, r, r * 0.6, c);
    return;
  }
  g.fillStyle = '#7c776c'; g.fillRect(-40, -58, 80, 58);
  g.fillStyle = '#8f8a7d';
  for (let y = -54; y < 0; y += 10) for (let x = -38 + ((y / 10) % 2 ? 7 : 0); x < 38; x += 15) g.fillRect(x, y, 12, 7);
  g.fillStyle = '#5f5a50';
  for (let x = -42; x < 42; x += 12) g.fillRect(x, -67, 8, 10);
  g.fillRect(-43, -59, 86, 5);
  // Porta da toca e as duas bandeiras.
  elipse(g, 0, -12, 11, 13, '#2b2016');
  g.fillStyle = '#2b2016'; g.fillRect(-11, -12, 22, 12);
  for (const s of [-1, 1]) {
    traco(g, s * 36, -67, s * 36, -88, '#3a2416', 1.8);
    caminho(g, [[s * 36, -88], [s * 36 + 13, -84], [s * 36, -79]], cor);
  }
  if (!acordado) {
    g.fillStyle = 'rgba(240,240,255,0.85)';
    g.font = 'bold 11px sans-serif';
    g.fillText('z', 20, -76);
    g.font = 'bold 8px sans-serif';
    g.fillText('z', 27, -84);
  }
}

function pintarTiro(g, k) {
  if (k === 'flecha') { traco(g, -8, 0, 6, 0, '#c9b07a', 1.6); caminho(g, [[6, -2.5], [11, 0], [6, 2.5]], '#dfe6ee'); traco(g, -8, 0, -11, -3, '#e9e2d0', 1.2); traco(g, -8, 0, -11, 3, '#e9e2d0', 1.2); }
  else if (k === 'virote') { traco(g, -6, 0, 5, 0, '#4e341c', 2.6); caminho(g, [[5, -3], [10, 0], [5, 3]], '#9aa0a6'); }
  else if (k === 'bolota') { elipse(g, 0, 1, 3, 3.4, '#a8742f'); elipse(g, 0, -1.6, 3.4, 1.8, '#6b4a2a'); }
  else if (k === 'pena') { elipse(g, 0, 0, 7, 2.2, '#e6d3ad', 0); traco(g, -7, 0, 7, 0, '#8a6a4a', 0.8); }
  else if (k === 'magia') { elipse(g, 0, 0, 7, 7, 'rgba(180,120,255,0.3)'); elipse(g, 0, 0, 4, 4, '#c9a0ff'); elipse(g, -1, -1, 1.6, 1.6, '#fff'); }
  else if (k === 'pedra') { elipse(g, 0, 0, 4.5, 4.5, '#6f6a60'); elipse(g, -1.2, -1.4, 1.6, 1.4, '#9c978a'); }
  else if (k === 'bomba') pintarBomba(g, 0);
}

function pintarBomba(g, t) {
  g.save();
  g.rotate(Math.sin(t * 9) * 0.4);
  caminho(g, [[-5, -8], [5, -8], [1.5, 11], [-1.5, 11]], '#f08a24');
  traco(g, -3, -3, 0, -3, '#c4661a', 1); traco(g, -1, 3, 1.5, 3, '#c4661a', 1);
  elipse(g, -2, -11, 2.5, 5, '#4f9440', -0.4); elipse(g, 2, -11, 2.5, 5, '#3f8a41', 0.4);
  const brilho = 2 + Math.abs(Math.sin(t * 20)) * 2;
  elipse(g, 0, -16, brilho, brilho, '#ffd84a');
  g.restore();
}

function pintarExplosao(g, p, r) {
  // p = 0..1 do começo ao fim; r em pixels.
  const k = 0.4 + p * 0.6;
  g.save();
  g.globalAlpha *= 1 - p;
  elipse(g, 0, 0, r * k, r * k * 0.72, '#ffb347');
  elipse(g, 0, 0, r * k * 0.7, r * k * 0.5, '#ffe08a');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    elipse(g, Math.cos(a) * r * k * 0.9, Math.sin(a) * r * k * 0.65, 4, 4, '#f08a24');
  }
  g.restore();
}

function pintarBolotasCaindo(g, p, r) {
  // Sombra que cresce e bolotas descendo.
  elipse(g, 0, 0, r, r * 0.72, `rgba(90,60,30,${0.15 + p * 0.2})`);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39;
    const d = ((i * 37) % 10) / 10 * r * 0.8;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d * 0.72 - (1 - p) * 60;
    g.save(); g.translate(x, y); pintarTiro(g, 'bolota'); g.restore();
  }
}

const PINTAR = {
  ratinho: pintarRatinho,
  esquilo: pintarEsquilo,
  espadachim: (g, t, b, cor, o) => pintarCoelhoGuerreiro(g, t, b, cor, { pelo: '#e9dcc3', arma: 'espada', ...o }),
  arqueiro: (g, t, b, cor, o) => pintarCoelhoGuerreiro(g, t, b, cor, { pelo: '#c99a6b', arma: 'arco', ...o }),
  javali: pintarJavali,
  coruja: pintarCoruja,
  ourico: pintarOurico,
  corvo: pintarCorvo,
  urso: pintarUrso,
  carvalho: pintarCarvalho,
  broto: pintarBroto,
  vigia: pintarVigia,
};

/* ─── Sprites ─── */

const TAM = { ratinho: [22, 20], esquilo: [26, 28], espadachim: [32, 38], arqueiro: [32, 36], javali: [42, 30], coruja: [36, 32], ourico: [34, 28], corvo: [42, 40], urso: [52, 48], carvalho: [60, 74], broto: [28, 32], vigia: [48, 76] };
const DESC_UN = {
  ratinho: 'Os Ratinhos (3 por carta). Bem pequenos.',
  esquilo: 'Os esquilos do Enxame (3 por carta), que jogam bolotas. Em "Atacando", o arremesso.',
  espadachim: 'O Coelho Espadachim, com espada e escudo. Em "Atacando", o golpe.',
  arqueiro: 'Os Coelhos Arqueiros (2 por carta), de arco. Em "Atacando", puxando a corda.',
  javali: 'O Javali que corre para as torres e pula o rio.',
  coruja: 'A Coruja, que voa (o jogo desenha a sombra no chão e ela mais alto).',
  ourico: 'O Ouriço de espinhos. Em "Atacando", os espinhos se arrepiam para todo lado.',
  corvo: 'O Corvo Mago, que voa e lança magia com o cajado (o jogo desenha a sombra no chão).',
  urso: 'O Urso Gigante, o tanque. Em "Atacando", a patada.',
  carvalho: 'O Carvalho Ancião, a árvore enorme. Em "Atacando", o galho batendo.',
  broto: 'Os Brotos que saem quando o Carvalho Ancião cai.',
};
const pecaUnidade = un => ({
  chave: `arena.${un}`, jogo: 'Arena da Toca', nome: CARTAS.find(c => c.un === un)?.nome.replace(/^Enxame de /, '') || 'Broto',
  desc: `${DESC_UN[un]} Olhando para a direita (o jogo espelha para a esquerda); a cor do lado aparece num círculo embaixo.`,
  largura: TAM[un][0], altura: TAM[un][1], ancora: 'pe',
  animacoes: [{ id: 'andando', nome: 'Andando', quadros: 4, fps: 8 }, { id: 'atacando', nome: 'Atacando', quadros: 3, fps: 8 }],
  previa: (g, anim, t) => PINTAR[un](g, t, anim === 'atacando' ? Math.abs(Math.sin(t * 4)) : 0, COR_MEU, { semSprite: true, andando: anim === 'andando' }),
});
const pecaTiro = (k, nome, desc) => ({
  chave: `arena.${k}`, jogo: 'Arena da Toca', nome, desc: `${desc} Apontando para a direita (o jogo gira na direção do voo).`,
  largura: 24, altura: 12, ancora: 'centro', animacoes: [{ id: 'voando', nome: 'Voando', quadros: 1, fps: 8 }],
  previa: g => pintarTiro(g, k),
});

export const SPRITES = [
  ...['ratinho', 'esquilo', 'espadachim', 'arqueiro', 'javali', 'coruja', 'ourico', 'corvo', 'urso', 'carvalho', 'broto'].map(pecaUnidade),
  {
    chave: 'arena.vigia', jogo: 'Arena da Toca', nome: 'Torre de Vigia',
    desc: 'A construção da carta Torre de Vigia, com a besta em cima. A bandeira é da cor do lado no desenho de sempre.',
    largura: 48, altura: 76, ancora: 'pe',
    animacoes: [{ id: 'parada', nome: 'Parada', quadros: 1, fps: 4 }, { id: 'atirando', nome: 'Atirando', quadros: 3, fps: 10 }],
    previa: (g, anim, t) => pintarVigia(g, t, anim === 'atirando' ? Math.abs(Math.sin(t * 6)) : 0, COR_MEU),
  },
  {
    chave: 'arena.torre', jogo: 'Arena da Toca', nome: 'Torre',
    desc: 'As duas torres de cada lado (3 x 3 casas), com o arqueiro em cima. "Destruída" é o que sobra quando ela cai.',
    largura: 72, altura: 96, ancora: 'pe',
    animacoes: [{ id: 'normal', nome: 'Normal', quadros: 1, fps: 4 }, { id: 'destruida', nome: 'Destruída', quadros: 1, fps: 4 }],
    previa: (g, anim, t) => pintarTorre(g, COR_MEU, anim === 'destruida', t, true),
  },
  {
    chave: 'arena.castelo', jogo: 'Arena da Toca', nome: 'Toca do Rei',
    desc: 'O castelo (4 x 4 casas). O rei em cima é o coelho de quem joga (ou o Raposo) e o jogo desenha por cima. "Dormindo" até apanhar ou uma torre cair.',
    largura: 96, altura: 100, ancora: 'pe',
    animacoes: [
      { id: 'dormindo', nome: 'Dormindo', quadros: 1, fps: 4 },
      { id: 'acordado', nome: 'Acordado', quadros: 1, fps: 4 },
      { id: 'destruido', nome: 'Destruído', quadros: 1, fps: 4 },
    ],
    previa: (g, anim) => pintarCastelo(g, COR_MEU, anim === 'destruido', anim !== 'dormindo'),
  },
  pecaTiro('flecha', 'Flecha', 'Das torres e dos Coelhos Arqueiros.'),
  pecaTiro('bolota', 'Bolota', 'Que os esquilos jogam.'),
  pecaTiro('pena', 'Pena afiada', 'Que a Coruja lança.'),
  pecaTiro('magia', 'Bola de magia', 'Do Corvo Mago (respinga em volta).'),
  pecaTiro('virote', 'Virote', 'Da Torre de Vigia.'),
  pecaTiro('pedra', 'Pedra', 'Da Toca do Rei.'),
  {
    chave: 'arena.bomba', jogo: 'Arena da Toca', nome: 'Bomba de Cenoura',
    desc: 'O feitiço Bomba de Cenoura: "Voando" sai do castelo até o alvo; "Explosão" acontece uma vez onde cai (o jogo aumenta conforme o raio).',
    largura: 28, altura: 40, ancora: 'centro',
    animacoes: [{ id: 'voando', nome: 'Voando', quadros: 2, fps: 10 }, { id: 'explosao', nome: 'Explosão', quadros: 6, fps: 12 }],
    previa: (g, anim, t) => (anim === 'explosao' ? pintarExplosao(g, t % 1, 20) : pintarBomba(g, t)),
  },
  {
    chave: 'arena.bolotas', jogo: 'Arena da Toca', nome: 'Chuva de Bolotas',
    desc: 'O feitiço Chuva de Bolotas: "Caindo" enquanto as bolotas descem (uma vez, do começo ao fim). O jogo estica conforme o raio.',
    largura: 80, altura: 80, ancora: 'centro',
    animacoes: [{ id: 'caindo', nome: 'Caindo', quadros: 6, fps: 8 }],
    previa: (g, anim, t) => pintarBolotasCaindo(g, t % 1, 30),
  },
  {
    chave: 'arena.grama', jogo: 'Arena da Toca', nome: 'Grama da arena',
    desc: 'Uma casa de grama (24 x 24), repetida na arena toda. Com vários quadros, cada casa usa um (para variar).',
    largura: 24, altura: 24, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarGrama(g, -12, -12, 0, 0),
  },
  {
    chave: 'arena.rio', jogo: 'Arena da Toca', nome: 'Rio',
    desc: 'Uma casa de água do rio do meio (24 x 24), repetida. Com vários quadros, cada casa usa um.',
    largura: 24, altura: 24, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarRio(g, -12, -12, 0),
  },
  {
    chave: 'arena.ponte', jogo: 'Arena da Toca', nome: 'Ponte',
    desc: 'Cada uma das duas pontes de madeira (2 casas de largura, atravessando o rio de 2 casas).',
    largura: 56, altura: 64, ancora: 'centro',
    animacoes: [{ id: 'parado', nome: 'Parado', quadros: 1, fps: 1 }],
    previa: g => pintarPonte(g),
  },
];
registrarPecas(SPRITES);
// O nome de cada carta acompanha o nome da peça (quem troca os sprites pode renomear): a tropa ou o feitiço.
for (const c of CARTAS) usarNomeDaPeca(c, 'nome', `arena.${c.un || c.k}`);

function pintarGrama(g, x, y, cx, cy) {
  g.fillStyle = (cx + cy) % 2 ? '#3f7a34' : '#468a3a';
  g.fillRect(x, y, T, T);
  if ((cx * 7 + cy * 13) % 5 === 0) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 6, y + 9, 2, 5); g.fillRect(x + 14, y + 4, 2, 4); }
}
function pintarRio(g, x, y, cx) {
  g.fillStyle = '#2f6f9a';
  g.fillRect(x, y, T, T);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x + 2, y + 8 + (cx % 2) * 6);
  g.quadraticCurveTo(x + 8, y + 4 + (cx % 2) * 6, x + 14, y + 8 + (cx % 2) * 6);
  g.stroke();
}
function pintarPonte(g) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-26, -28, 52, 60);
  g.fillStyle = '#8a6438'; g.fillRect(-24, -32, 48, 64);
  g.strokeStyle = '#5a3a20'; g.lineWidth = 1;
  for (let y = -32; y <= 32; y += 8) { g.beginPath(); g.moveTo(-24, y); g.lineTo(24, y); g.stroke(); }
  g.fillStyle = '#5a3a20'; g.fillRect(-27, -32, 4, 64); g.fillRect(23, -32, 4, 64);
}

/* ─── O visor: a arena num canvas ─── */

// cena = { unidades, torres, tiros, feiticos, fx, vira, ladoEu, reis: [desenho do rei de cada lado], escolha, mira }
export function criarVisor() {
  const escala = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const tela = h('canvas', { class: 'arena-tela', width: W * escala, height: H * escala, 'aria-label': 'Arena da Toca' });
  const g = tela.getContext('2d');
  let fundo = null;
  let versao = 0;
  aoSair(aoMudarSprites(() => { versao++; }));

  function prepararFundo() {
    if (fundo && fundo.versao === versao) return fundo.img;
    const img = h('canvas', { width: W * escala, height: H * escala });
    const f = img.getContext('2d');
    f.scale(escala, escala);
    for (let cy = 0; cy < ALT; cy++) {
      for (let cx = 0; cx < LARG; cx++) {
        const x = cx * T;
        const y = cy * T;
        if (cy === 15 || cy === 16) {
          if (!desenharSprite(f, 'arena.rio', 'parado', x + T / 2, y + T / 2, { quadro: cx })) pintarRio(f, x, y, cx);
        } else if (!desenharSprite(f, 'arena.grama', 'parado', x + T / 2, y + T / 2, { quadro: cx * 7 + cy * 13 })) pintarGrama(f, x, y, cx, cy);
      }
    }
    // Os caminhos de terra de cada lado (das torres até as pontes).
    f.fillStyle = 'rgba(160,120,70,0.22)';
    for (const px of PONTES) { f.fillRect(px * T - T * 0.7, 3 * T, T * 1.4, 26 * T); }
    f.fillRect(5 * T, 3.3 * T, 8 * T, T * 1.2);
    f.fillRect(5 * T, 27.5 * T, 8 * T, T * 1.2);
    // Margens do rio.
    f.fillStyle = 'rgba(30,50,20,0.55)';
    f.fillRect(0, 15 * T - 3, W, 3);
    f.fillRect(0, 17 * T, W, 3);
    for (const px of PONTES) {
      f.save();
      f.translate(px * T, 16 * T);
      if (!desenharSprite(f, 'arena.ponte', 'parado', 0, 0)) pintarPonte(f);
      f.restore();
    }
    // Bordas escuras (cerca de arbustos).
    f.fillStyle = 'rgba(10,30,12,0.55)';
    f.fillRect(0, 0, W, 6); f.fillRect(0, H - 6, W, 6);
    fundo = { img, versao };
    return img;
  }

  // Posição na tela (pixels lógicos) de um ponto da arena.
  const px = (cena, x, y) => [x * T, (cena.vira ? ALT - y : y) * T];

  function desenharTorre(cena, k, t) {
    const torre = cena.torres[k];
    const lado = k < 3 ? 0 : 1;
    const [lx, ly] = LUGAR_TORRES[k % 3];
    const [x, y] = px(cena, lx, yDoLado(lado, ly));
    const rei = k % 3 === 2;
    const raio = (rei ? RAIO.rei : RAIO.princesa) * T;
    const cor = corDoLado(cena, lado);
    const caida = torre.hp <= 0;
    const pe = y + raio * 0.75;
    g.save();
    g.translate(x, pe);
    if (rei) {
      const anim = caida ? 'destruido' : torre.acordado ? 'acordado' : 'dormindo';
      if (!desenharSprite(g, 'arena.castelo', anim, 0, 0, { t })) pintarCastelo(g, cor, caida, torre.acordado);
      if (!caida) {
        // O rei: o coelho de quem joga (com coroa) ou o Raposo.
        const quem = cena.reis?.[lado];
        g.save();
        g.translate(0, -62);
        g.scale(0.62, 0.62);
        if (quem?.raposo) desenharRaposa(g, 0, 0, { t, dir: cena.vira === (lado === 0) ? 1 : -1 });
        else {
          desenharCoelho(g, 0, 0, { pelo: quem?.pelo || '#e9dcc3', roupa: quem?.roupa || null, t });
          if (!quem?.roupa?.cabeca) caminho(g, [[3, -50], [5, -58], [8, -52], [11, -59], [14, -52], [17, -58], [19, -50]], '#d8b13a');
        }
        g.restore();
      }
    } else if (!desenharSprite(g, 'arena.torre', caida ? 'destruida' : 'normal', 0, 0, { t })) pintarTorre(g, cor, caida, t);
    g.restore();
    if (!caida) barraDeVida(x, pe - (rei ? 110 : 92), rei ? 64 : 52, torre.hp / torre.max, cor, Math.ceil(torre.hp));
  }

  function barraDeVida(x, y, larg, frac, cor, numero = null) {
    const f = Math.max(0, Math.min(1, frac));
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x - larg / 2 - 1, y - 1, larg + 2, 6);
    g.fillStyle = cor;
    g.fillRect(x - larg / 2, y, larg * f, 4);
    if (numero != null) {
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 3;
      g.strokeText(String(numero), x, y - 3);
      g.fillText(String(numero), x, y - 3);
      g.textAlign = 'start';
    }
  }

  function desenharUnidade(cena, u, t) {
    const [x, y] = px(cena, u.x, u.y);
    const cor = corDoLado(cena, u.lado);
    const voa = VOA.has(u.tipo);
    const raio = (RAIO[u.tipo] || 0.5) * T;
    const chegando = u.e === 2;
    const bate = u.e === 3 ? Math.abs(Math.sin(t * 9 + u.id)) : u.e === 1 && u.tipo !== 'vigia' ? 0.15 : 0;
    const anim = u.e === 3 ? (u.tipo === 'vigia' ? 'atirando' : 'atacando') : u.tipo === 'vigia' ? 'parada' : 'andando';
    const tAnim = u.e === 0 || u.e === 3 ? t + u.id * 0.37 : 0;
    // O círculo do lado (e a cor de quem jogou, no 2 contra 2).
    g.save();
    g.globalAlpha = chegando ? 0.5 : 1;
    elipse(g, x, y, raio * 1.1, raio * 0.45, `${cor}55`);
    g.strokeStyle = u.corDono || cor;
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(x, y, raio * 1.1, raio * 0.45, 0, 0, Math.PI * 2);
    g.stroke();
    const alto = voa ? 18 + Math.sin(t * 3 + u.id) * 2 : 0;
    if (voa) elipse(g, x, y, raio * 0.9, raio * 0.35, 'rgba(0,0,0,0.3)');
    g.translate(x, y - alto);
    if (u.dir < 0) g.scale(-1, 1);
    if (!desenharSprite(g, `arena.${u.tipo}`, anim, 0, 0, { t: tAnim })) PINTAR[u.tipo]?.(g, tAnim, bate, cor, { andando: u.e === 0 });
    g.restore();
    if (chegando) {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y - raio, raio + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (u.falta ?? 0.5)));
      g.stroke();
    }
    if (u.vida < 100 && !chegando) barraDeVida(x, y - (TAM[u.tipo]?.[1] || 30) - alto - 4, Math.max(18, raio * 2.2), u.vida / 100, cor);
  }

  function desenharEfeitos(cena, agora) {
    for (const f of cena.fx) {
      const p = Math.max(0, Math.min(1, (agora - f.ini) / f.dura));
      if (agora < f.ini) continue;
      const [x, y] = px(cena, f.x, f.y);
      g.save();
      g.translate(x, y);
      if (f.tipo === FX.bomba) {
        if (!desenharSprite(g, 'arena.bomba', 'explosao', 0, 0, { progresso: p, escala: (f.a / 10) * T / 14 })) pintarExplosao(g, p, (f.a / 10) * T);
      } else if (f.tipo === FX.bolotas) {
        elipse(g, 0, 0, (f.a / 10) * T * (0.6 + p * 0.4), (f.a / 10) * T * 0.72 * (0.6 + p * 0.4), `rgba(168,116,47,${0.45 * (1 - p)})`);
      } else if (f.tipo === FX.morte) {
        g.globalAlpha = 1 - p;
        for (let i = 0; i < 5; i++) elipse(g, Math.cos(i * 1.3) * (6 + p * 12), -6 + Math.sin(i * 1.3) * (4 + p * 8) - p * 10, 5 + p * 4, 4 + p * 3, '#d8d8d8');
      } else if (f.tipo === FX.torre) {
        pintarExplosao(g, p, 60);
      } else if (f.tipo === FX.area) {
        const r = (f.a / 10) * T;
        g.globalAlpha = 1 - p;
        g.strokeStyle = TIPOS[f.b] === 'ourico' ? '#e3c9a0' : '#c9a0ff';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(0, 0, r * (0.5 + p * 0.5), r * 0.7 * (0.5 + p * 0.5), 0, 0, Math.PI * 2);
        g.stroke();
      } else if (f.tipo === FX.carta && f.b !== cena.eu) {
        // A carta que o outro lado jogou aparece um pouco em cima do lugar.
        const c = CARTAS[f.a];
        if (c) {
          g.globalAlpha = 1 - p * p;
          g.font = 'bold 11px sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(0,0,0,0.8)';
          g.fillStyle = corDoLado(cena, f.lado ?? 1);
          g.strokeText(c.nome, 0, -36 - p * 12);
          g.fillText(c.nome, 0, -36 - p * 12);
        }
      } else if (f.tipo === FX.fala) {
        balao(FALAS[f.a] || '', p, y < 150 ? 70 : -120);
      }
      g.restore();
    }
  }

  function balao(texto, p, y) {
    g.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
    g.font = 'bold 12px sans-serif';
    const larg = g.measureText(texto).width + 16;
    g.fillStyle = 'rgba(250,244,228,0.95)';
    g.strokeStyle = '#8c6d15';
    g.lineWidth = 1.5;
    g.beginPath();
    g.rect(-larg / 2, y - 16, larg, 24);
    g.fill();
    g.stroke();
    if (y < 0) caminho(g, [[-5, y + 8], [5, y + 8], [0, y + 16]], 'rgba(250,244,228,0.95)');
    else caminho(g, [[-5, y - 16], [5, y - 16], [0, y - 24]], 'rgba(250,244,228,0.95)');
    g.fillStyle = '#2c2214';
    g.textAlign = 'center';
    g.fillText(texto, 0, y);
    g.textAlign = 'start';
  }

  // Onde não dá para pôr tropa (escurece) e a mira da carta escolhida.
  function desenharEscolha(cena) {
    const e = cena.escolha;
    if (!e) return;
    const c = CARTAS[e.carta];
    if (!c.raio) {
      g.fillStyle = 'rgba(200,60,40,0.22)';
      const meuLado = cena.ladoEu < 0 ? 0 : cena.ladoEu;
      const outro = 1 - meuLado;
      for (const metade of [0, 1]) {
        const caiu = cena.torres[outro * 3 + metade]?.hp <= 0;
        const x0 = metade ? LARG / 2 : 0;
        // Na tela, o meu lado está sempre embaixo: proibido de 0 a 17 (menos o bolso de 10 a 15).
        if (caiu) { g.fillRect(x0 * T, 0, (LARG / 2) * T, 10 * T); g.fillRect(x0 * T, 15 * T, (LARG / 2) * T, 2 * T); }
        else g.fillRect(x0 * T, 0, (LARG / 2) * T, 17 * T);
      }
    }
    if (!cena.mira) return;
    const [x, y] = px(cena, cena.mira.x, cena.mira.y);
    g.save();
    g.globalAlpha = cena.mira.ok ? 0.75 : 0.35;
    if (c.raio) {
      g.strokeStyle = cena.mira.ok ? '#ffe08a' : '#e05a4a';
      g.lineWidth = 2;
      g.setLineDash?.([6, 4]);
      g.beginPath();
      g.arc(x, y, c.raio * T, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash?.([]);
    } else {
      const raio = (RAIO[c.un] || 0.5) * T;
      g.strokeStyle = cena.mira.ok ? '#fff' : '#e05a4a';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, raio * 1.4, raio * 0.6, 0, 0, Math.PI * 2);
      g.stroke();
      g.translate(x, y - (VOA.has(c.un) ? 18 : 0));
      PINTAR[c.un]?.(g, 0, 0, corDoLado(cena, cena.ladoEu < 0 ? 0 : cena.ladoEu), {});
    }
    g.restore();
  }

  function desenhar(cena, t, agora) {
    g.setTransform(escala, 0, 0, escala, 0, 0);
    g.drawImage(prepararFundo(), 0, 0, W, H);
    desenharEscolha(cena);
    // Torres e tropas juntas, de cima para baixo na tela (quem está mais embaixo fica na frente).
    const coisas = [];
    for (let k = 0; k < 6; k++) {
      if (!cena.torres[k]) continue;
      const lado = k < 3 ? 0 : 1;
      const yy = yDoLado(lado, LUGAR_TORRES[k % 3][1]);
      coisas.push({ y: cena.vira ? ALT - yy : yy, torre: k });
    }
    for (const u of cena.unidades) coisas.push({ y: (cena.vira ? ALT - u.y : u.y) + (VOA.has(u.tipo) ? 2 : 0), u });
    coisas.sort((a, b) => a.y - b.y);
    for (const c of coisas) {
      if (c.torre != null) desenharTorre(cena, c.torre, t);
      else desenharUnidade(cena, c.u, t);
    }
    for (const p of cena.feiticos) {
      const [x, y] = px(cena, p.x, p.y);
      const prog = Math.max(0, Math.min(1, 1 - p.espera / 0.8));
      g.save();
      g.translate(x, y);
      if (!desenharSprite(g, 'arena.bolotas', 'caindo', 0, 0, { progresso: prog, escala: (3 * T) / 40 })) pintarBolotasCaindo(g, prog, 3 * T);
      g.restore();
    }
    for (const p of cena.tiros) {
      const [x, y] = px(cena, p.x, p.y);
      const [vx, vy] = [p.vx || 0, cena.vira ? -(p.vy || 0) : p.vy || 0];
      g.save();
      g.translate(x, y - (p.k === 'bomba' ? 22 : 10));
      const rot = Math.atan2(vy, vx);
      if (p.k === 'bomba') {
        elipse(g, 0, 22, 6, 2.5, 'rgba(0,0,0,0.3)');
        if (!desenharSprite(g, 'arena.bomba', 'voando', 0, 0, { t })) pintarBomba(g, t);
      } else if (!desenharSprite(g, `arena.${p.k}`, 'voando', 0, 0, { t, rot })) { g.rotate(rot); pintarTiro(g, p.k); }
      g.restore();
    }
    desenharEfeitos(cena, agora);
  }

  return { tela, g, desenhar };
}

// Azul para o meu lado (ou o de baixo, para quem assiste), vermelho para o outro.
function corDoLado(cena, lado) {
  const meu = cena.ladoEu < 0 ? 0 : cena.ladoEu;
  return lado === meu ? COR_MEU : COR_OUTRO;
}

/* ─── A arte das cartas (para a mão e o montador de baralho) ─── */

const artes = new Map();
let versaoArte = 0;
aoMudarSprites(() => { versaoArte++; artes.clear(); });
function arteDaCarta(k, lado = 64) {
  const chave = `${k}:${lado}:${versaoArte}`;
  if (artes.has(chave)) return artes.get(chave);
  const c = CARTA[k];
  const escala = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const tela = h('canvas', { width: lado * escala, height: lado * escala });
  const g = tela.getContext('2d');
  g.scale(escala, escala);
  const grad = g.createLinearGradient(0, 0, 0, lado);
  grad.addColorStop(0, c.raio ? '#3a2b55' : c.un === 'vigia' ? '#3d3420' : '#24412b');
  grad.addColorStop(1, '#0e1811');
  g.fillStyle = grad;
  g.fillRect(0, 0, lado, lado);
  g.save();
  if (c.k === 'bomba') {
    g.translate(lado / 2, lado / 2 + 2);
    g.scale(lado / 40, lado / 40);
    if (!desenharSprite(g, 'arena.bomba', 'voando', 0, 0, { t: 0.3 })) pintarBomba(g, 0.3);
  } else if (c.k === 'bolotas') {
    g.translate(lado / 2, lado * 0.72);
    g.scale(lado / 110, lado / 110);
    if (!desenharSprite(g, 'arena.bolotas', 'caindo', 0, 0, { progresso: 0.6 })) pintarBolotasCaindo(g, 0.6, 30);
  } else {
    const [lw, la] = TAM[c.un];
    const k2 = Math.min((lado * 0.78) / lw, (lado * 0.78) / la) * (c.qtd > 1 ? 0.8 : 1);
    const copias = c.qtd > 1 ? (c.qtd === 2 ? [[-0.18, 0], [0.16, 0.06]] : [[-0.2, -0.02], [0.2, 0], [0, 0.08]]) : [[0, 0]];
    for (const [ox, oy] of copias) {
      g.save();
      g.translate(lado / 2 + ox * lado, lado * (VOA.has(c.un) ? 0.8 : 0.88) + oy * lado);
      g.scale(k2, k2);
      if (!desenharSprite(g, `arena.${c.un}`, c.un === 'vigia' ? 'parada' : 'andando', 0, 0, { quadro: 0 })) PINTAR[c.un](g, 0, 0, COR_MEU, {});
      g.restore();
    }
  }
  g.restore();
  artes.set(chave, tela);
  return tela;
}
function imagemDaCarta(k, lado = 64) {
  const fonte = arteDaCarta(k, lado);
  const c = h('canvas', { class: 'arena-arte', width: fonte.width, height: fonte.height });
  c.getContext('2d').drawImage(fonte, 0, 0);
  return c;
}

/* ─── A tela ─── */

export function telaArena() {
  if (!pode('recreacao.usar')) { const e = new Error('Sem acesso à Recreação.'); e.status = 403; throw e; }
  const partida = arenaJunto();
  if (partida) return partida;
  const vendo = salaAssistida();
  if (vendo) return assistirArena(vendo);
  return telaComeco();
}

// A sala da arena que estou assistindo (pedi para assistir agora há pouco, ou já estava).
let pedidoAssistir = null;
function salaAssistida() {
  const lista = [...rt.partidas.values()].filter(s => s.jogo === 'junto' && s.opcoes?.jogo === 'arena' && s.eu < 0 && s.status === 'jogando' && s.estado);
  return lista.find(s => s.id === pedidoAssistir) || lista[0] || null;
}

// Espera uma sala minha chegar no estado pedido (uma vez) e faz algo: começar sozinho, por exemplo.
function quandoSala(cond, fazer, ms = 12000) {
  let relogioEspera = null;
  const parar = ouvir('sala', m => {
    const s = m.sala;
    if (!s || !cond(s)) return;
    parar();
    clearTimeout(relogioEspera);
    fazer(s);
  });
  relogioEspera = setTimeout(parar, ms);
}

function jogarSozinho() {
  if (!rt.conectado) { aviso('Sem conexão com a recreação agora. Tentando reconectar...', 'erro'); return; }
  const minha = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  const ehArena = s => s.jogo === 'junto' && s.opcoes?.jogo === 'arena';
  if (minha && ehArena(minha) && minha.status === 'esperando' && minha.dono === rt.eu?.id) {
    enviar('sala:comecar', { id: minha.id });
    location.hash = `#/recreacao/sala/${minha.id}`;
    return;
  }
  // Sala de 1 já começa: o mínimo da arena é 1 (o Raposo joga do outro lado).
  quandoSala(s => ehArena(s) && s.status === 'esperando' && s.dono === rt.eu?.id && s.jogadores.length === 1 && s.opcoes?.modo === 'versus',
    s => enviar('sala:comecar', { id: s.id }));
  criarPartida('junto', { jogo: 'arena', modo: 'versus' });
}

function telaComeco() {
  let baralho = lerBaralho();
  let detalhe = null;
  const meuBaralho = h('div', { class: 'arena-baralho' });
  const colecao = h('div', { class: 'arena-colecao' });
  const media = h('strong');
  const info = h('div', { class: 'arena-detalhe' });
  const aoVivo = h('div');

  function cartaBotao(c, { noBaralho }) {
    const dentro = baralho.includes(c.k);
    return h('button', {
      type: 'button', class: `arena-carta-mini ${dentro && !noBaralho ? 'escolhida' : ''} ${detalhe === c.k ? 'vendo' : ''}`.replace(/\s+/g, ' ').trim(),
      title: `${c.nome} (${c.custo} cenouras)`, 'aria-pressed': noBaralho ? null : String(dentro),
      onclick: () => {
        detalhe = c.k;
        if (dentro) baralho = baralho.filter(x => x !== c.k);
        else if (baralho.length < 8) baralho = [...baralho, c.k];
        else aviso('O baralho já tem 8 cartas: tire uma antes de pôr outra.', 'erro');
        if (baralho.length === 8) guardarBaralho(baralho);
        desenhar();
      },
    }, imagemDaCarta(c.k, 56), h('span', { class: 'arena-custo' }, String(c.custo)), h('small', null, c.nome));
  }

  function desenhar() {
    trocar(meuBaralho, baralho.map(k => cartaBotao(CARTA[k], { noBaralho: true })),
      Array.from({ length: 8 - baralho.length }, () => h('div', { class: 'arena-carta-vazia' }, icone('mais'))));
    trocar(colecao, CARTAS.map(c => cartaBotao(c, { noBaralho: false })));
    const m = baralho.reduce((t, k) => t + CARTA[k].custo, 0) / Math.max(1, baralho.length);
    media.textContent = m.toFixed(1).replace('.', ',');
    const c = CARTA[detalhe];
    trocar(info, c
      ? [h('h3', null, c.nome, ' ', h('span', { class: 'arena-custo-texto' }, icone('cenoura'), String(c.custo))),
        h('p', null, c.papel),
        h('dl', { class: 'arena-stats' },
          c.qtd > 1 && [h('dt', null, 'Quantidade'), h('dd', null, String(c.qtd))],
          c.vida && [h('dt', null, 'Vida'), h('dd', null, String(c.vida))],
          [h('dt', null, 'Dano'), h('dd', null, String(c.dano))],
          [h('dt', null, 'Acerta'), h('dd', null, c.alvo)],
          c.vel && [h('dt', null, 'Velocidade'), h('dd', null, c.vel)],
          c.raio && [h('dt', null, 'Raio'), h('dd', null, `${String(c.raio).replace('.', ',')} casas`)],
          c.voa && [h('dt', null, 'Voa'), h('dd', null, 'sim')])]
      : h('p', { class: 'suave' }, 'Toque numa carta para pôr ou tirar do baralho (e ver o que ela faz).'));
  }

  function desenharAoVivo() {
    const lista = (rt.salas || []).filter(s => s.jogo === 'junto' && s.opcoes?.jogo === 'arena' && s.status === 'jogando');
    trocar(aoVivo, lista.length
      ? h('ul', { class: 'arena-ao-vivo' }, lista.map(s => h('li', null,
        h('span', null, h('strong', null, s.jogadores.join(', ')), h('small', null, ` ${s.opcoes.modo === 'coop' ? 'co-op' : 'versus'}`)),
        botao('Assistir', { icone: 'olho', classe: 'btn-pequeno', onclick: () => assistir(s.id) }))))
      : h('p', { class: 'suave' }, 'Ninguém está jogando agora.'));
  }

  function assistir(id) {
    pedidoAssistir = id;
    // Quando a sala chegar (como espectador), a tela vira a arena ao vivo.
    quandoSala(s => s.id === id && s.eu < 0 && s.status === 'jogando', () => {
      if (location.hash !== '#/recreacao/arena' || !raiz.isConnected) return;
      const vista = assistirArena(rt.partidas.get(id));
      raiz.replaceChildren(...vista.childNodes);
    });
    enviar('sala:assistir', { id });
  }

  aoSair(ouvir('salas', desenharAoVivo));
  desenhar();
  desenharAoVivo();

  const raiz = h('div', { class: 'pagina arena-pagina' },
    cabecalho({
      titulo: 'Arena da Toca', icone: 'escudo', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Monte o baralho, junte cenouras e derrube as torres do outro lado. Sozinho, contra o Raposo; ou chame alguém.',
    }),
    h('div', { class: 'arena-comeco' },
      h('section', { class: 'painel arena-montador' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('cartas'), 'Seu baralho'),
          h('span', { class: 'suave' }, 'Custo médio: ', media)),
        meuBaralho,
        h('div', { class: 'arena-baralho-acoes' },
          botao('Baralho padrão', { icone: 'aleatorio', classe: 'btn-pequeno', onclick: () => { baralho = [...BARALHO_PADRAO]; guardarBaralho(baralho); desenhar(); } }),
          h('small', { class: 'suave' }, 'Fica guardado neste navegador. Precisa ter 8 cartas.')),
        h('h3', { class: 'arena-sub' }, 'Todas as cartas'),
        colecao,
        info),
      h('div', { class: 'arena-coluna' },
        h('section', { class: 'painel arena-jogar' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('espada'), 'Jogar')),
          botao('Jogar contra o Raposo', {
            icone: 'raposa', classe: 'btn-ouro btn-grande',
            onclick: () => { if (baralho.length !== 8) { aviso('Escolha 8 cartas para o baralho.', 'erro'); return; } guardarBaralho(baralho); jogarSozinho(); },
          }),
          botao('Chamar alguém (versus)', { icone: 'usuarios', onclick: () => { guardarBaralho(baralho); abrirJunto('arena', 'versus'); } }),
          botao('Co-op contra o Raposo', { icone: 'escudo', onclick: () => { guardarBaralho(baralho); abrirJunto('arena', 'coop'); } }),
          h('p', { class: 'suave' }, 'No versus, com 2 pessoas é um contra um; com 3 ou 4, dois contra dois (faltando um, o Raposo completa a dupla). No co-op, todos do mesmo lado contra o Raposo, que fica mais forte com mais gente.')),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
          h('ul', { class: 'arena-regras' },
            h('li', null, h('strong', null, 'Cenouras: '), 'começam em 5, vão até 10 e voltam uma a cada 2,8 segundos (em dobro no último minuto).'),
            h('li', null, h('strong', null, 'Cartas: '), 'arraste uma carta para a arena, ou toque nela e depois no lugar. Tropas só no seu lado; feitiços em qualquer lugar.'),
            h('li', null, h('strong', null, 'Torres: '), 'cada torre derrubada é uma coroa. A Toca do Rei acorda quando apanha ou quando uma torre cai; derrubar ela vale 3 coroas e acaba na hora.'),
            h('li', null, h('strong', null, 'Tempo: '), '3 minutos. Empatado, 1 minuto de morte súbita; depois perde quem tem a torre mais fraca.'),
            h('li', null, h('strong', null, 'Dica: '), 'Urso e Javali só batem em construções: a Torre de Vigia puxa eles. Enxames morrem com Chuva de Bolotas e Ouriço; quem voa só apanha de quem acerta o ar.'))),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('olho'), 'Acontecendo agora')),
          aoVivo))));
  return raiz;
}

/* ─── Os quadros do servidor: guardar, misturar dois e montar a cena ─── */

function criarLeitor() {
  const quadros = []; // { t (ms de jogo), q, chegou }
  let base = Infinity;
  const vistos = new Map(); // fx id -> efeito
  const ultimoX = new Map(); // id da tropa -> { x, dir }
  let ultimo = null;

  function receber(q, acertar = true) {
    if (!q || !Array.isArray(q.u) || !Array.isArray(q.a)) return;
    const agora = performance.now();
    const t = (Number(q.t) || 0) * 1000;
    if (acertar && q.s === 'jogando') base = Math.min(agora - t, base + 2);
    const ult = quadros[quadros.length - 1];
    if (ult && t < ult.t) return;
    if (ult && t === ult.t) quadros[quadros.length - 1] = { t, q };
    else quadros.push({ t, q });
    if (quadros.length > 30) quadros.shift();
    ultimo = q;
    for (const [id, tipo, x, y, a, b] of q.fx || []) {
      if (vistos.has(id)) continue;
      const dura = { [FX.bomba]: 600, [FX.bolotas]: 450, [FX.morte]: 500, [FX.torre]: 1100, [FX.area]: 350, [FX.carta]: 1400, [FX.fala]: 2800 }[tipo] || 500;
      vistos.set(id, { id, tipo, x: x / 10, y: y / 10, a, b, ini: agora + (acertar ? ATRASO_MS : 0), dura, lado: q.a[b]?.[0] });
    }
    if (vistos.size > 120) for (const [id, f] of vistos) if (agora - f.ini > f.dura + 4000) vistos.delete(id);
  }

  // O que desenhar agora: entre os dois quadros em volta de "agora - atraso".
  function montar(agora, acabou) {
    if (!quadros.length) return null;
    let ia = quadros.length - 1;
    let b = null;
    if (base !== Infinity && !acabou) {
      const alvo = agora - base - ATRASO_MS;
      ia = 0;
      for (let j = quadros.length - 1; j >= 0; j--) if (quadros[j].t <= alvo) { ia = j; b = quadros[j + 1] || null; break; }
    }
    const a = quadros[ia];
    const k = b ? Math.max(0, Math.min(1, (agora - base - ATRASO_MS - a.t) / (b.t - a.t || 1))) : 0;
    const qa = a.q;
    const porId = new Map((b?.q.u || []).map(u => [u[0], u]));
    const unidades = [];
    const juntar = (u, ub) => {
      const [id, ti, dono, x, y, vida, e] = u;
      const xx = ub ? (x + (ub[3] - x) * k) / 10 : x / 10;
      const yy = ub ? (y + (ub[4] - y) * k) / 10 : y / 10;
      const tipo = TIPOS[ti];
      const lado = qa.a[dono]?.[0] ?? 0;
      let mem = ultimoX.get(id);
      if (!mem) { mem = { x: xx, dir: lado === 0 ? 1 : -1 }; ultimoX.set(id, mem); }
      if (xx - mem.x > 0.02) mem.dir = 1;
      else if (xx - mem.x < -0.02) mem.dir = -1;
      mem.x = xx;
      unidades.push({ id, tipo, dono, lado, x: xx, y: yy, vida: ub ? ub[5] : vida, e: ub && k > 0.5 ? ub[6] : e, dir: mem.dir });
    };
    for (const u of qa.u) juntar(u, porId.get(u[0]));
    if (b) { const ja = new Set(qa.u.map(u => u[0])); for (const u of b.q.u) if (!ja.has(u[0]) && k > 0.3) juntar(u, null); }
    if (ultimoX.size > 400) ultimoX.clear();
    const tirosB = new Map((b?.q.p || []).map(p => [p[0], p]));
    const tiros = (qa.p || []).map(([id, ti, x, y]) => {
      const pb = tirosB.get(id);
      return { id, k: TIROS[ti], x: (pb ? x + (pb[2] - x) * k : x) / 10, y: (pb ? y + (pb[3] - y) * k : y) / 10, vx: pb ? pb[2] - x : 0, vy: pb ? pb[3] - y : 0 };
    });
    const atual = ultimo;
    const torres = atual.T.map((hp, i) => ({ hp, max: atual.TM?.[i] || hp || 1, acordado: i % 3 === 2 ? !!atual.R?.[i < 3 ? 0 : 1] : true }));
    const feiticos = (qa.fe || []).map(([id, c, x, y, espera]) => ({ id, carta: c, x: x / 10, y: y / 10, espera: Math.max(0, espera - k * 0.05) }));
    const fx = [...vistos.values()].filter(f => agora - f.ini < f.dura);
    return { unidades, tiros, torres, feiticos, fx };
  }

  return { receber, montar, ultimo: () => ultimo, haQuadros: () => quadros.length > 0 };
}

/* ─── Jogando (numa sala da arena) ─── */

function arenaJunto() {
  const ganchos = {};
  const jt = juntoNoJogo('arena', { aoLargar: () => ganchos.largar?.(), aoAcabar: s => ganchos.acabar?.(s) });
  if (!jt) return null;
  const coop = jt.modo === 'coop';
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const visor = criarVisor();
  const tela = visor.tela;
  const leitor = criarLeitor();
  const inicio = performance.now();
  let acabou = false;
  let animacao = 0;
  let escolha = null;    // { slot, carta (índice) }
  let mira = null;       // { x, y, ok } na arena
  let arrastando = null; // { slot, x0, y0, moveu }
  let pendentes = [];    // cartas que mandei e o servidor ainda não mostrou
  let baralhoMandado = false;

  const meuLado = () => leitor.ultimo()?.a?.[jt.eu]?.[0] ?? 0;
  const vira = () => meuLado() === 1;

  /* Topo: coroas e relógio; embaixo: a mão */
  const coroasOutro = h('span', { class: 'arena-coroas outro' });
  const coroasMeu = h('span', { class: 'arena-coroas meu' });
  const relogioEl = h('strong', { class: 'arena-relogio' }, '3:00');
  const dobroEl = h('span', { class: 'arena-dobro', hidden: true }, 'x2');
  const avisoEl = h('div', { class: 'arena-aviso', hidden: true });
  const sobre = h('div', { class: 'arena-sobre', hidden: true });
  const proximaEl = h('div', { class: 'arena-proxima' });
  const slots = [0, 1, 2, 3].map(slot => h('button', { type: 'button', class: 'arena-carta', 'data-slot': slot, 'aria-label': `Carta ${slot + 1}` }));
  const cenouraCheio = h('span', { class: 'arena-cenouras-cheio' });
  const cenouraBarra = h('div', { class: 'arena-cenouras-barra' }, cenouraCheio);
  const cenouraNum = h('strong', null, '5');
  const ladoLista = h('div');

  function textoCartaInvalida(motivo) {
    avisoEl.textContent = motivo;
    avisoEl.hidden = false;
    clearTimeout(avisoEl._t);
    avisoEl._t = setTimeout(() => { avisoEl.hidden = true; }, 1300);
  }

  /* Cenouras: o valor do último quadro mais o que voltou desde então */
  let cenQuadro = { v: 5, em: performance.now(), x2: false };
  function cenourasAgora() {
    const q = leitor.ultimo();
    if (!q || acabou || q.s !== 'jogando') return cenQuadro.v;
    const passou = (performance.now() - cenQuadro.em) / 1000;
    return Math.min(MAX_CENOURAS, cenQuadro.v + (passou * (cenQuadro.x2 ? 2 : 1)) / RECARGA);
  }

  /* Mão de cartas */
  let chaveMao = '';
  function atualizarMao(q) {
    const a = q.a[jt.eu];
    if (!a) return;
    const chave = `${a.slice(2, 7).join()}|${escolha?.slot ?? -1}`;
    if (chave !== chaveMao) {
      // A carta do lugar escolhido mudou (joguei): desmarca.
      if (escolha && a[2 + escolha.slot] !== escolha.carta) { escolha = null; }
      chaveMao = `${a.slice(2, 7).join()}|${escolha?.slot ?? -1}`;
      slots.forEach((el, slot) => {
        const c = CARTAS[a[2 + slot]];
        el.classList.toggle('escolhida', escolha?.slot === slot);
        el.dataset.carta = c.k;
        el.title = `${c.nome}: ${c.custo} cenouras. ${c.papel}`;
        trocar(el, imagemDaCarta(c.k, 64), h('span', { class: 'arena-custo' }, String(c.custo)), h('small', null, c.nome));
      });
      const prox = CARTAS[a[6]];
      trocar(proximaEl, h('small', null, 'Próxima'), prox && imagemDaCarta(prox.k, 40));
      pendentes = pendentes.filter(p => performance.now() - p.em < 900);
    }
    const cen = cenourasAgora();
    slots.forEach((el, slot) => {
      const c = CARTAS[a[2 + slot]];
      el.classList.toggle('cara', c.custo > cen + 1e-6);
    });
    cenouraCheio.style.width = `${(cen / MAX_CENOURAS) * 100}%`;
    cenouraNum.textContent = String(Math.floor(cen + 1e-6));
  }

  /* Coroas, relógio, quem está em cada lado */
  let chaveLado = '';
  function atualizarTopo(q) {
    const eu = meuLado();
    const desde = performance.now() - cenQuadro.em;
    const resta = Math.max(0, (Number(q.rl) || 0) - (q.s === 'jogando' && !acabou ? desde / 1000 : 0));
    relogioEl.textContent = relogio(Math.ceil(resta));
    relogioEl.classList.toggle('prorrogacao', !!q.pr);
    dobroEl.hidden = !q.x2;
    const coroas = (el, n) => {
      const chave = String(n);
      if (el.dataset.n === chave) return;
      el.dataset.n = chave;
      trocar(el, [0, 1, 2].map(k => h('span', { class: `arena-coroa ${k < n ? 'ganha' : ''}`.trim() }, icone('coroa'))));
    };
    coroas(coroasMeu, q.c[eu]);
    coroas(coroasOutro, q.c[1 - eu]);
    const chave = JSON.stringify([q.a.map(a => [a[0], a[7]]), q.c]);
    if (chave === chaveLado) return;
    chaveLado = chave;
    const nomeDe = k => (k < jt.n ? jt.jogadores[k]?.nome || `Jogador ${k + 1}` : 'Raposo');
    const linha = (a, k) => h('li', { class: k === jt.eu ? 'eu-linha' : '' },
      h('span', { class: 'cobras-cor', style: { background: k < jt.n ? jt.jogadores[k]?.cor : COR_OUTRO } }),
      h('span', { class: 'desafio-nome' }, nomeDe(k), h('small', null, a[7] === 2 ? 'saiu: o Raposo joga no lugar' : a[7] === 1 ? 'o computador' : k === jt.eu ? 'você' : 'jogando')));
    const grupo = (lado, titulo) => h('div', { class: 'arena-grupo' },
      h('h3', null, titulo, ' ', h('span', { class: 'arena-coroas-texto' }, icone('coroa'), String(q.c[lado]))),
      h('ol', { class: 'desafio-lista' }, q.a.map((a, k) => (a[0] === lado ? linha(a, k) : null))));
    trocar(ladoLista, grupo(eu, coop ? 'A equipe' : 'Seu lado'), grupo(1 - eu, 'Do outro lado'));
  }

  /* O rei de cada lado: o coelho do primeiro do lado, ou o Raposo */
  function reis(q) {
    return [0, 1].map(lado => {
      const k = q.a.findIndex(a => a[0] === lado);
      if (k < 0 || k >= jt.n) return { raposo: true };
      const v = jt.jogadores[k]?.visual;
      return { pelo: v?.pelo || null, roupa: v?.roupa || null };
    });
  }

  /* Onde o dedo (ou o mouse) está na arena */
  function pontoNaArena(ev) {
    const r = tela.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return null;
    const x = ((ev.clientX - r.left) / r.width) * LARG;
    const ty = ((ev.clientY - r.top) / r.height) * ALT;
    return { x, y: vira() ? ALT - ty : ty };
  }

  // A mesma conta do servidor (para avisar na hora; quem decide é o servidor).
  function lugarOk(c, x, y) {
    if (!(x >= 0.5 && x <= LARG - 0.5 && y >= 0.5 && y <= ALT - 0.5)) return false;
    if (c.raio) return true;
    const q = leitor.ultimo();
    const lado = meuLado();
    const py = yDoLado(lado, y);
    let ok = py >= 17;
    if (!ok && py >= 10 && py < 15) ok = (q?.T?.[(1 - lado) * 3 + (x < LARG / 2 ? 0 : 1)] ?? 1) <= 0;
    if (!ok) return false;
    const raio = RAIO[c.un] || 0.5;
    for (let k = 0; k < 6; k++) {
      if ((q?.T?.[k] ?? 1) <= 0) continue;
      const [tx, ty] = LUGAR_TORRES[k % 3];
      const r = k % 3 === 2 ? RAIO.rei : RAIO.princesa;
      if (Math.hypot(x - tx, y - yDoLado(k < 3 ? 0 : 1, ty)) < (c.un === 'vigia' ? r + raio : r + 0.1)) return false;
    }
    return true;
  }

  function jogar(slot, x, y) {
    const q = leitor.ultimo();
    if (!q || acabou || q.s !== 'jogando') return;
    const c = CARTAS[q.a[jt.eu]?.[2 + slot]];
    if (!c) return;
    if (!admPodeAgir()) { textoCartaInvalida('Você está congelado! Espere passar.'); return; } // pegadinha do administrador
    if (!lugarOk(c, x, y)) { textoCartaInvalida(c.raio ? 'Fora da arena.' : 'Tropas só no seu lado da arena (ou no bolso de uma torre caída).'); return; }
    if (c.custo > cenourasAgora() + 0.05) { textoCartaInvalida(`Faltam cenouras: ${c.nome} custa ${c.custo}.`); return; }
    jt.evento({ tipo: 'carta', carta: c.k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    pendentes.push({ carta: CARTAS.indexOf(c), x, y, em: performance.now() });
    escolha = null;
    mira = null;
    chaveMao = '';
  }

  function escolher(slot) {
    const q = leitor.ultimo();
    if (!q || acabou) return;
    const carta = q.a[jt.eu]?.[2 + slot];
    if (carta == null) return;
    escolha = escolha?.slot === slot ? null : { slot, carta };
    chaveMao = '';
    if (!escolha) mira = null;
  }

  // Cartas: tocar escolhe; arrastar até a arena joga.
  slots.forEach((el, slot) => {
    el.addEventListener('pointerdown', ev => {
      if (acabou) return;
      ev.preventDefault();
      arrastando = { slot, x0: ev.clientX, y0: ev.clientY, moveu: false, ja: escolha?.slot === slot };
      if (!arrastando.ja) escolher(slot);
    });
    // Teclado (Enter ou espaço na carta): escolhe.
    el.addEventListener('click', ev => { if (ev.detail === 0) escolher(slot); });
  });
  const aoMover = ev => {
    if (arrastando) {
      if (Math.hypot(ev.clientX - arrastando.x0, ev.clientY - arrastando.y0) > 12) arrastando.moveu = true;
    }
    if (!escolha) return;
    const p = pontoNaArena(ev);
    const c = CARTAS[escolha.carta];
    mira = p ? { ...p, ok: lugarOk(c, p.x, p.y) && c.custo <= cenourasAgora() + 0.05 } : null;
  };
  const aoSoltar = ev => {
    const a = arrastando;
    arrastando = null;
    if (!a) return;
    const p = pontoNaArena(ev);
    if (a.moveu && p && escolha) jogar(escolha.slot, p.x, p.y);
    else if (a.moveu && !p) { /* soltou fora: a carta continua escolhida */ }
    else if (a.ja) { escolha = null; mira = null; chaveMao = ''; } // tocou de novo na mesma: desmarca
  };
  window.addEventListener('pointermove', aoMover);
  window.addEventListener('pointerup', aoSoltar);
  window.addEventListener('pointercancel', () => { arrastando = null; });
  // Tocar na arena com uma carta escolhida joga ali.
  tela.addEventListener('pointerdown', ev => {
    if (!escolha || arrastando) return;
    ev.preventDefault();
    const p = pontoNaArena(ev);
    if (p) jogar(escolha.slot, p.x, p.y);
  });
  tela.addEventListener('pointerleave', () => { if (!arrastando) mira = null; });
  const aoTeclar = ev => {
    if (ev.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo')) return;
    if (/^[1-4]$/.test(ev.key)) { ev.preventDefault(); escolher(Number(ev.key) - 1); }
    else if (ev.key === 'Escape' && escolha) { escolha = null; mira = null; chaveMao = ''; }
  };
  document.addEventListener('keydown', aoTeclar);

  /* O baralho escolhido vai para o servidor na largada (antes de jogar qualquer carta) */
  function mandarBaralho() {
    if (baralhoMandado || acabou) return;
    baralhoMandado = true;
    jt.evento({ tipo: 'baralho', cartas: lerBaralho() });
  }
  ganchos.largar = mandarBaralho;
  ganchos.acabar = s => {
    acabou = true;
    escolha = null;
    mira = null;
    // A caixa de fim do junto fala de um jeito geral: aqui o texto certo da arena.
    setTimeout(() => {
      const caixa = document.querySelector('.desafio-fim');
      const p = caixa?.querySelector('p');
      if (p) p.textContent = textoDoFim(leitor.ultimo(), meuLado(), coop, s);
      caixa?.classList.add('arena-fim');
    }, 0);
    mostrarFim();
  };
  // Sozinho contra o Raposo: "Jogar de novo" começa outra partida na mesma sala.
  const botoesJunto = jt.botoesFim;
  jt.botoesFim = () => {
    const lista = botoesJunto();
    if (jt.n === 1) {
      lista.unshift(h('button', {
        type: 'button', class: 'btn btn-ouro',
        onclick: () => {
          quandoSala(s => s.id === jt.id && s.status === 'esperando', s => enviar('sala:comecar', { id: s.id }));
          enviar('sala:revanche', { id: jt.id });
          location.hash = `#/recreacao/sala/${jt.id}`;
        },
      }, icone('frente'), h('span', null, 'Jogar de novo')));
    }
    return lista;
  };

  function mostrarFim() {
    const q = leitor.ultimo();
    if (!q?.f) return;
    const [v] = q.f;
    const eu = meuLado();
    sobre.hidden = false;
    trocar(sobre, h('div', { class: `arena-placa ${v === eu ? 'vitoria' : v < 0 ? 'empate' : 'derrota'}` },
      h('strong', null, v < 0 ? 'Empate' : v === eu ? (coop ? 'A equipe venceu!' : 'Vitória!') : 'Derrota'),
      h('span', null, `${q.c[eu]} x ${q.c[1 - eu]} coroas`)));
  }

  /* Antes da largada */
  function atualizarSobre() {
    if (acabou) return;
    const antes = !jt.largou();
    if (antes === !sobre.hidden) return;
    sobre.hidden = !antes;
    if (antes) {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Prepare-se!'),
        h('p', null, coop ? 'Todos do mesmo lado contra o Raposo: defendam juntos e derrubem a Toca dele.' : jt.n === 1 ? 'Você contra o Raposo. Derrube as torres dele!' : jt.n >= 3 ? 'Dois contra dois: cada um com as suas cartas e cenouras, as torres são da dupla.' : 'Um contra um: derrube mais torres que o outro.'),
        h('p', { class: 'suave' }, toque ? 'Arraste uma carta até a arena, ou toque na carta e depois no lugar.' : 'Arraste uma carta até a arena, ou escolha com 1 a 4 e clique no lugar.')));
    }
  }

  /* Desenho a 60 quadros por segundo */
  function laco(agora) {
    animacao = requestAnimationFrame(laco);
    try {
      const q = leitor.ultimo();
      if (!q) return;
      const cena = leitor.montar(agora, acabou);
      if (!cena) return;
      const eu = meuLado();
      for (const u of cena.unidades) if (jt.modo === 'versus' && jt.n >= 3 && u.dono < jt.n) u.corDono = jt.jogadores[u.dono]?.cor;
      // As cartas que acabei de jogar aparecem como sombra até o servidor mostrar.
      pendentes = pendentes.filter(p => agora - p.em < 700);
      const fantasmas = pendentes.filter(p => !CARTAS[p.carta].raio).map(p => ({
        id: -1, tipo: CARTAS[p.carta].un, dono: jt.eu, lado: eu, x: p.x, y: p.y, vida: 100, e: 2, dir: 1, falta: 1,
      }));
      visor.desenhar({
        ...cena, unidades: [...cena.unidades, ...fantasmas], vira: eu === 1, ladoEu: eu, eu: jt.eu, reis: reis(q),
        escolha: escolha && !acabou ? escolha : null, mira,
      }, (agora - inicio) / 1000, agora);
      atualizarMao(q);
      atualizarTopo(q);
      atualizarSobre();
    } catch (err) {
      console.error('Arena da Toca:', err); // um erro não pode travar o jogo
    }
  }

  jt.aoQuadro = q => {
    try {
      leitor.receber(q);
      const a = q?.a?.[jt.eu];
      if (a) cenQuadro = { v: a[1] / 10, em: performance.now(), x2: !!q.x2 };
      if (q.s === 'jogando' && !baralhoMandado && jt.largou()) mandarBaralho();
    } catch (e) { console.error('Arena da Toca:', e); }
  };
  const q0 = jt.estado()?.quadro;
  if (q0) { leitor.receber(q0, false); const a = q0.a?.[jt.eu]; if (a) cenQuadro = { v: a[1] / 10, em: performance.now(), x2: !!q0.x2 }; }
  animacao = requestAnimationFrame(laco);
  aoSair(() => {
    cancelAnimationFrame(animacao);
    jt.aoQuadro = () => {};
    window.removeEventListener('pointermove', aoMover);
    window.removeEventListener('pointerup', aoSoltar);
    document.removeEventListener('keydown', aoTeclar);
    clearTimeout(avisoEl._t);
  });

  const titulo = coop ? 'co-op' : jt.n === 1 ? 'contra o Raposo' : jt.n >= 3 ? '2 contra 2' : 'versus';
  return h('div', { class: 'pagina arena-pagina' },
    cabecalho({
      titulo: `Arena da Toca: ${titulo}`, icone: 'escudo', voltar: { href: '#/recreacao', texto: 'Recreação' },
      acoes: [h('a', { class: 'btn', href: `#/recreacao/sala/${jt.id}` }, icone('usuarios'), h('span', null, 'Ver a sala'))],
    }),
    h('div', { class: 'arena-jogo' },
      h('div', { class: 'arena-centro' },
        h('div', { class: 'arena-topo' }, coroasOutro, h('span', { class: 'arena-tempo' }, icone('relogio'), relogioEl, dobroEl), coroasMeu),
        h('div', { class: 'arena-moldura' }, tela, sobre, avisoEl),
        h('div', { class: 'arena-mao' },
          proximaEl,
          h('div', { class: 'arena-cartas' }, slots),
          h('div', { class: 'arena-cenouras', title: 'Cenouras (a energia das cartas)' }, icone('cenoura'), cenouraNum, cenouraBarra))),
      h('aside', { class: 'arena-lado' },
        h('section', { class: 'painel' }, h('div', { class: 'painel-cab' }, h('h2', null, icone(coop ? 'usuarios' : 'trofeu'), 'Quem joga')), ladoLista),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Lembrete')),
          h('ul', { class: 'arena-regras' },
            h('li', null, 'Tropas só no seu lado; feitiços em qualquer lugar.'),
            h('li', null, 'Torre caída abre o "bolso": dá para pôr tropas daquele lado até perto do castelo.'),
            h('li', null, 'No último minuto as cenouras voltam em dobro.'),
            h('li', null, 'Empatado aos 3 minutos: 1 minuto de morte súbita.'))))));
}

function textoDoFim(q, eu, coop, s) {
  if (!q?.f) return s ? 'Fim de jogo.' : 'A sala foi fechada.';
  const [v, motivo] = q.f;
  const placar = `${q.c[eu]} x ${q.c[1 - eu]}`;
  if (v < 0) return `Empate (${placar}): ninguém derrubou mais torres e as torres mais fracas ficaram iguais.`;
  const como = {
    castelo: v === eu ? 'derrubou a Toca do Rei' : 'perdeu a Toca do Rei',
    coroas: `por ${placar} coroas`,
    'morte-subita': 'na morte súbita',
    desempate: 'no desempate (perdeu quem tinha a torre mais fraca)',
    adm: 'pela escolha do administrador',
  }[motivo] || '';
  if (v === eu) return coop ? (motivo === 'castelo' ? 'A equipe derrubou a Toca do Raposo!' : `A equipe venceu o Raposo ${como}!`) : `Vitória! Você ${motivo === 'castelo' ? como : `venceu ${como}`}.`;
  return coop ? `O Raposo venceu a equipe ${motivo === 'castelo' ? 'derrubando a Toca do Rei' : como}.` : `Derrota: ${motivo === 'castelo' ? `você ${como}` : `o outro lado venceu ${como}`}.`;
}

/* ─── Assistindo a uma partida da arena ─── */

function assistirArena(s0) {
  const id = s0.id;
  const visor = criarVisor();
  const leitor = criarLeitor();
  const inicio = performance.now();
  let animacao = 0;
  let acabou = s0.status === 'fim';
  const jogadores = s0.jogadores.map((p, i) => ({ nome: p.nome, cor: CORES_JUNTO[i % CORES_JUNTO.length], visual: s0.estado?.visuais?.[i] || null }));
  const n = s0.estado?.n || jogadores.length;
  const relogioEl = h('strong', { class: 'arena-relogio' }, '3:00');
  const placar = h('div', { class: 'arena-assistir-placar' });
  const sobre = h('div', { class: 'arena-sobre', hidden: true });
  let ultimoEm = performance.now();

  function atualizar(q) {
    const resta = Math.max(0, (Number(q.rl) || 0) - (q.s === 'jogando' ? (performance.now() - ultimoEm) / 1000 : 0));
    relogioEl.textContent = relogio(Math.ceil(resta));
    const nome = k => (k < n ? jogadores[k]?.nome : 'Raposo');
    const chave = JSON.stringify([q.c, q.a.map(a => [a[0], Math.floor(a[1] / 10), a[7]])]);
    if (placar.dataset.chave === chave) return;
    placar.dataset.chave = chave;
    trocar(placar, [0, 1].map(lado => h('div', { class: `arena-assistir-lado ${lado ? 'outro' : 'meu'}` },
      h('strong', null, icone('coroa'), ` ${q.c[lado]}`),
      q.a.map((a, k) => (a[0] === lado ? h('span', null, nome(k), h('small', null, ` ${Math.floor(a[1] / 10)} cenouras`)) : null)))));
  }

  function laco(agora) {
    animacao = requestAnimationFrame(laco);
    try {
      const q = leitor.ultimo();
      if (!q) return;
      const cena = leitor.montar(agora, acabou);
      const reis = [0, 1].map(lado => {
        const k = q.a.findIndex(a => a[0] === lado);
        if (k < 0 || k >= n) return { raposo: true };
        return { pelo: jogadores[k]?.visual?.pelo || null, roupa: jogadores[k]?.visual?.roupa || null };
      });
      visor.desenhar({ ...cena, vira: false, ladoEu: -1, eu: -1, reis }, (agora - inicio) / 1000, agora);
      atualizar(q);
      if (q.f && sobre.hidden) {
        sobre.hidden = false;
        const [v] = q.f;
        trocar(sobre, h('div', { class: 'arena-placa empate' }, h('strong', null, v < 0 ? 'Empate' : v === 0 ? 'Venceu o lado de baixo' : 'Venceu o lado de cima'), h('span', null, `${q.c[0]} x ${q.c[1]} coroas`)));
      }
    } catch (err) { console.error('Arena da Toca (assistindo):', err); }
  }

  aoSair(ouvir('junto:quadro', m => { if (m.id === id) { leitor.receber(m.q); ultimoEm = performance.now(); } }));
  aoSair(ouvir('sala', m => { if (m.sala?.id === id && m.sala.status === 'fim') acabou = true; }));
  aoSair(() => {
    cancelAnimationFrame(animacao);
    // Parar de assistir (como na tela da sala).
    if (rt.partidas.get(id)?.eu < 0) { enviar('sala:sair', { id }, { silencioso: true }); rt.partidas.delete(id); }
    if (pedidoAssistir === id) pedidoAssistir = null;
  });
  if (s0.estado?.quadro) leitor.receber(s0.estado.quadro, false);
  animacao = requestAnimationFrame(laco);

  return h('div', { class: 'pagina arena-pagina' },
    cabecalho({
      titulo: `Arena da Toca: assistindo`, icone: 'olho', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: `${jogadores.map(p => p.nome).join(', ')} (${s0.estado?.modo === 'coop' ? 'co-op' : 'versus'})`,
    }),
    h('div', { class: 'arena-jogo' },
      h('div', { class: 'arena-centro' },
        h('div', { class: 'arena-topo' }, h('span', { class: 'arena-tempo' }, icone('relogio'), relogioEl)),
        h('div', { class: 'arena-moldura' }, visor.tela, sobre),
        placar),
      h('aside', { class: 'arena-lado' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('olho'), 'Assistindo')),
          h('p', { class: 'suave' }, 'O lado azul está embaixo; o vermelho, em cima. Você vê as cartas que cada lado joga.'),
          h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir'))))));
}

// Para os testes no Node.
export const _interno = { TIPOS, TIROS, CARTA, BARALHO_PADRAO, criarLeitor, textoDoFim, lerBaralho, guardarBaralho, arteDaCarta, PINTAR };
