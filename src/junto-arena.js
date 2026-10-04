// Arena da Toca junto (estilo Clash Royale): o jogo roda aqui no servidor, 20 passos por segundo.
// Os navegadores só mandam as cartas ({ tipo: 'carta', carta, x, y }) e o baralho do começo
// ({ tipo: 'baralho', cartas: [8 chaves] }), e desenham os quadros.
//
// A arena tem 18 x 32 casas, em pé: o lado 0 embaixo (y de 17 a 32) e o lado 1 em cima (y de 0 a 15),
// com o rio no meio (y de 15 a 17) e duas pontes. Cada lado tem 2 torres e a Toca do Rei (o castelo),
// que só acorda quando apanha ou quando uma torre do seu lado cai. Torre derrubada vale uma coroa;
// derrubar o castelo vale 3 coroas e acaba na hora. 3 minutos (o último com cenouras em dobro) e,
// empatado, 1 minuto de prorrogação (morte súbita); depois, desempata a torre mais fraca (ou empate).
//
// Quem joga em cada lado (assentos):
//  - Versus: 1 pessoa = você contra o Raposo; 2 = um contra um; 3 ou 4 = 2 contra 2 (com 3, o Raposo
//    completa a dupla de cima). Cada um tem as suas cenouras e o seu baralho; as torres são da dupla.
//  - Co-op: todas as pessoas embaixo contra o Raposo (com 3 ou mais pessoas, 2 Raposos). Quanto mais
//    gente (dif), mais cenouras, mais vida nas torres e nas tropas do Raposo.
// Quem sai no meio deixa o lugar para o Raposo, que continua com as cartas e as cenouras dele.
// Puro (sem rede e sem relógio): a mesma semente com os mesmos comandos dá os mesmos quadros.

const ESCALA = Math.max(0.01, Number(process.env.ARENA_ESCALA) || 1); // só para os testes (partida curta)

const PASSO = 0.05;         // segundos de jogo por passo
const LARG = 18;
const ALT = 32;
const MEIO = 16;
const RIO_CIMA = 15;        // o rio vai de y = 15 a y = 17
const RIO_BAIXO = 17;
const PONTES = [3.5, 14.5]; // o meio de cada ponte (x)
const MEIA_PONTE = 1;
const TEMPO_NORMAL = 180 * ESCALA;
const TEMPO_EXTRA = 60 * ESCALA;
const DOBRO_DESDE = 120 * ESCALA; // o último minuto tem cenouras em dobro (e a prorrogação também)
const MAX_CENOURAS = 10;
const CENOURAS_INICIO = 5;
const RECARGA = 2.8;        // segundos por cenoura
const CHEGADA = 1;          // a tropa leva 1 s para entrar na arena
const ENTRE_CARTAS = 0.25;  // ninguém joga duas cartas em menos de 0,25 s
const FX_DURA = 0.7;        // os acontecimentos ficam no quadro por esse tempo (quem perdeu um quadro vê no outro)

// alvo: 'terra' (só o que anda no chão), 'tudo' (chão e ar) ou 'construcoes' (só torres e construções).
// alc: alcance de borda a borda (casas); vel: casas por segundo; cad: segundos entre golpes;
// visao: até onde enxerga um inimigo; area: raio do respingo; massa: quem empurra quem.
const UNIDADES = {
  ratinho: { nome: 'Ratinho', hp: 60, dano: 60, cad: 1.0, alc: 0.5, vel: 1.6, visao: 5.5, raio: 0.3, massa: 1, alvo: 'terra' },
  esquilo: { nome: 'Esquilo', hp: 100, dano: 60, cad: 1.3, alc: 4.5, vel: 1.5, visao: 5.5, raio: 0.35, massa: 1, alvo: 'tudo', tiro: 'bolota' },
  espadachim: { nome: 'Coelho Espadachim', hp: 1250, dano: 145, cad: 1.2, alc: 0.6, vel: 1.0, visao: 5.5, raio: 0.5, massa: 6, alvo: 'terra' },
  arqueiro: { nome: 'Coelho Arqueiro', hp: 220, dano: 78, cad: 0.9, alc: 5, vel: 1.0, visao: 5.5, raio: 0.4, massa: 2, alvo: 'tudo', tiro: 'flecha' },
  javali: { nome: 'Javali', hp: 1200, dano: 230, cad: 1.6, alc: 0.5, vel: 2.0, visao: 9.5, raio: 0.55, massa: 6, alvo: 'construcoes', pula: true },
  coruja: { nome: 'Coruja', hp: 600, dano: 220, cad: 1.6, alc: 2.0, vel: 1.5, visao: 5.5, raio: 0.5, massa: 3, alvo: 'tudo', voa: true, tiro: 'pena' },
  ourico: { nome: 'Ouriço', hp: 1350, dano: 190, cad: 1.5, alc: 0.6, vel: 1.0, visao: 5.5, raio: 0.55, massa: 7, alvo: 'terra', area: 1.6, emVolta: true },
  corvo: { nome: 'Corvo Mago', hp: 820, dano: 150, cad: 1.5, alc: 4.0, vel: 1.0, visao: 6, raio: 0.55, massa: 4, alvo: 'tudo', voa: true, area: 1.4, tiro: 'magia' },
  urso: { nome: 'Urso Gigante', hp: 2950, dano: 185, cad: 1.5, alc: 0.6, vel: 0.75, visao: 7.5, raio: 0.8, massa: 18, alvo: 'construcoes' },
  carvalho: { nome: 'Carvalho Ancião', hp: 4500, dano: 270, cad: 2.5, alc: 0.6, vel: 0.6, visao: 7, raio: 0.95, massa: 30, alvo: 'construcoes', morte: { filho: 'broto', qtd: 2, dano: 200, area: 2 } },
  broto: { nome: 'Broto', hp: 900, dano: 90, cad: 2.0, alc: 0.5, vel: 0.75, visao: 7, raio: 0.5, massa: 6, alvo: 'construcoes' },
  vigia: { nome: 'Torre de Vigia', hp: 850, dano: 160, cad: 1.1, alc: 5, visao: 5, raio: 0.9, alvo: 'tudo', construcao: true, vida: 30, tiro: 'virote' },
  princesa: { nome: 'Torre', hp: 2200, dano: 80, cad: 0.8, alc: 6, visao: 6, raio: 1.5, alvo: 'tudo', construcao: true, torre: true, tiro: 'flecha' },
  rei: { nome: 'Toca do Rei', hp: 3500, dano: 80, cad: 1.0, alc: 5, visao: 5, raio: 2.0, alvo: 'tudo', construcao: true, torre: true, tiro: 'pedra' },
};
const TIPOS = Object.keys(UNIDADES); // o número de cada tipo no quadro
const VEL_TIRO = { flecha: 11, bolota: 9, pena: 10, magia: 7, virote: 12, pedra: 9, bomba: 11 };
const TIROS = Object.keys(VEL_TIRO);

// As cartas. feitico: { raio, dano, torre (fração do dano nas torres), espera (s) ou voa (sai do castelo) }.
const CARTAS = [
  { k: 'ratinhos', nome: 'Ratinhos', custo: 1, un: 'ratinho', qtd: 3 },
  { k: 'esquilos', nome: 'Enxame de Esquilos', custo: 2, un: 'esquilo', qtd: 3 },
  { k: 'espadachim', nome: 'Coelho Espadachim', custo: 3, un: 'espadachim', qtd: 1 },
  { k: 'arqueiros', nome: 'Coelhos Arqueiros', custo: 3, un: 'arqueiro', qtd: 2 },
  { k: 'bolotas', nome: 'Chuva de Bolotas', custo: 3, feitico: { raio: 3, dano: 240, torre: 0.3, espera: 0.8 } },
  { k: 'javali', nome: 'Javali', custo: 4, un: 'javali', qtd: 1 },
  { k: 'coruja', nome: 'Coruja', custo: 4, un: 'coruja', qtd: 1 },
  { k: 'ourico', nome: 'Ouriço', custo: 4, un: 'ourico', qtd: 1 },
  { k: 'bomba', nome: 'Bomba de Cenoura', custo: 4, feitico: { raio: 2.5, dano: 500, torre: 0.3, voa: true, empurra: 1 } },
  { k: 'vigia', nome: 'Torre de Vigia', custo: 4, un: 'vigia', qtd: 1 },
  { k: 'corvo', nome: 'Corvo Mago', custo: 5, un: 'corvo', qtd: 1 },
  { k: 'urso', nome: 'Urso Gigante', custo: 5, un: 'urso', qtd: 1 },
  { k: 'carvalho', nome: 'Carvalho Ancião', custo: 7, un: 'carvalho', qtd: 1 },
];
const CARTA = Object.fromEntries(CARTAS.map(c => [c.k, c]));
const IDX_CARTA = Object.fromEntries(CARTAS.map((c, i) => [c.k, i]));
const BARALHO_PADRAO = ['javali', 'espadachim', 'arqueiros', 'esquilos', 'ourico', 'coruja', 'bolotas', 'bomba'];
// Os baralhos do Raposo (um por partida, sorteado).
const BARALHOS_RAPOSO = [
  ['urso', 'corvo', 'arqueiros', 'espadachim', 'ratinhos', 'bolotas', 'bomba', 'vigia'],
  ['javali', 'espadachim', 'esquilos', 'ourico', 'coruja', 'bolotas', 'bomba', 'vigia'],
  ['carvalho', 'corvo', 'arqueiros', 'ourico', 'ratinhos', 'esquilos', 'bolotas', 'bomba'],
  ['urso', 'javali', 'coruja', 'espadachim', 'esquilos', 'arqueiros', 'bolotas', 'bomba'],
];
// Quanto vale cada tropa (as cenouras da carta divididas pela quantidade): a IA mede as ameaças assim.
const VALOR = { ratinho: 0.34, esquilo: 0.67, espadachim: 3, arqueiro: 1.5, javali: 4, coruja: 4, ourico: 4, corvo: 5, urso: 5, carvalho: 7, broto: 1.5, vigia: 4 };
const FORMACAO = { 1: [[0, 0]], 2: [[-0.55, 0], [0.55, 0]], 3: [[0, -0.5], [-0.6, 0.35], [0.6, 0.35]] };
// As torres do lado 0 (o lado 1 é o espelho em y): [x, y, tipo]. Índice no quadro: lado * 3 + k.
const LUGAR_TORRES = [[3.5, 25.5, 'princesa'], [14.5, 25.5, 'princesa'], [9, 29, 'rei']];
// Acontecimentos que vão no quadro: [id, tipo, x*10, y*10, a, b].
const FX = { carta: 0, bomba: 1, bolotas: 2, morte: 3, torre: 4, area: 5, fala: 6 };
// O que o Raposo fala (o navegador tem os textos, na mesma ordem).
const FALA = { comeco: 0, derrubou: 1, perdeu: 2, venceu: 3, perdeuJogo: 4, empurrao: 5 };

const r1 = x => Math.round(x * 10) / 10;
const d10 = x => Math.round(x * 10);
const hipot = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const vivo = e => !!e && e.hp > 0 && !e.morto;
const yDoLado = (lado, y) => (lado === 0 ? y : ALT - y); // a perspectiva do lado: o meu lado sempre embaixo

// Números "aleatórios" a partir da semente (o mesmo gerador do Pac-Coelho).
function sorteDe(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar(lista, sorte) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/* ─── Começo ─── */

function prepararBaralho(sim, s, cartas) {
  const ordem = embaralhar(cartas, sim.sorte);
  s.baralho = [...cartas];
  s.mao = ordem.slice(0, 4);
  s.fila = ordem.slice(4);
}

function novaIa(sim, s, preferido) {
  s.ia = { espera: 1 + sim.sorte() * 1.5, apoios: 0, ultimoApoio: -99, ladoPreferido: preferido, ultimaDefesa: -99 };
}

function novo({ modo, n, dif, semente } = {}) {
  n = Math.max(1, Math.min(4, Math.floor(Number(n) || 1)));
  dif = Math.max(1, Number(dif) || 1);
  const coop = modo === 'coop';
  const sim = {
    modo: coop ? 'coop' : 'versus', n, dif, sorte: sorteDe(Number(semente) || 0),
    t: 0, acum: 0, tiques: 0, proxId: 1, prorrogacao: false, fim: null, vencedor: null,
    coroas: [0, 0], ents: [], tiros: [], feiticos: [], fx: [], assentos: [], dano: [],
  };
  // Os assentos: as pessoas primeiro (o assento i é a pessoa i), depois os Raposos.
  const lados = [];
  if (coop) for (let i = 0; i < n; i++) lados.push(0);
  else for (let i = 0; i < n; i++) lados.push(i % 2);
  const raposos = coop ? (n >= 3 ? 2 : 1) : n % 2 === 1 ? 1 : 0;
  // Co-op: o Raposo ganha cenouras e vida conforme a gente do outro lado (um pouco menos que a equipe junta).
  const multCoop = coop ? Math.max(1, (n / raposos) * (raposos === 2 ? 0.55 : 0.7) * (1 + (dif - 1) * 0.3)) : 1;
  const nivelCoop = coop ? 1 + 0.05 * (n - 1) : 1;
  for (let i = 0; i < n; i++) sim.assentos.push({ i, lado: lados[i], raposo: false, saiu: false, cen: CENOURAS_INICIO, ultima: -9, jogadas: 0, mult: 1, nivel: 1 });
  const baralhosRaposo = embaralhar(BARALHOS_RAPOSO, sim.sorte);
  for (let r = 0; r < raposos; r++) {
    sim.assentos.push({ i: -1, lado: 1, raposo: true, saiu: false, cen: CENOURAS_INICIO, ultima: -9, jogadas: 0, mult: multCoop, nivel: nivelCoop });
  }
  sim.assentos.forEach((s, k) => {
    prepararBaralho(sim, s, s.raposo ? baralhosRaposo[k % baralhosRaposo.length] : BARALHO_PADRAO);
    if (s.raposo) novaIa(sim, s, raposos === 2 ? (k - n) % 2 : Math.floor(sim.sorte() * 2));
  });
  sim.dano = sim.assentos.map(() => 0);
  // As torres (sempre os 6 primeiros: lado 0 e depois lado 1). Co-op: as do Raposo têm mais vida.
  for (const lado of [0, 1]) {
    const mult = coop && lado === 1 ? 1 + 0.05 * (n - 1) : 1;
    for (const [x, y, tipo] of LUGAR_TORRES) {
      const e = criar(sim, tipo, null, lado, x, yDoLado(lado, y), mult);
      if (tipo === 'rei') e.dormindo = true;
    }
  }
  sim.torres = sim.ents.slice(0, 6);
  if (sim.assentos.some(s => s.raposo)) falar(sim, FALA.comeco);
  return sim;
}

function criar(sim, tipo, dono, lado, x, y, mult = 1) {
  const d = UNIDADES[tipo];
  const e = { id: sim.proxId++, tipo, d, dono, lado, x, y, hp: d.hp * mult, max: d.hp * mult, cd: d.cad * 0.4, alvo: null, chega: 0, estado: 0, golpe: 0 };
  sim.ents.push(e);
  return e;
}

function efeito(sim, tipo, x, y, a = 0, b = 0) {
  sim.fx.push({ id: sim.proxId++, tipo, x, y, a, b, ate: sim.t + FX_DURA });
}
function falar(sim, fala, lado = 1) {
  const rei = sim.torres?.[lado * 3 + 2];
  const k = sim.assentos.findIndex(s => s.raposo && s.lado === lado);
  if (k < 0) return;
  efeito(sim, FX.fala, rei ? rei.x : 9, rei ? rei.y : yDoLado(lado, 29), fala, k);
}

/* ─── Comandos ─── */

// Onde o lado pode pôr uma tropa (ou construção). Feitiço vale em qualquer lugar da arena.
function lugarValido(sim, lado, x, y, carta) {
  if (!(x >= 0.5 && x <= LARG - 0.5 && y >= 0.5 && y <= ALT - 0.5)) return false;
  if (carta.feitico) return true;
  const py = yDoLado(lado, y);
  let ok = py >= RIO_BAIXO;
  // Torre do outro lado derrubada: dá para pôr tropas do lado dela até perto do castelo (o "bolso").
  if (!ok && py >= 10 && py < RIO_CIMA) {
    const torre = sim.torres[(1 - lado) * 3 + (x < LARG / 2 ? 0 : 1)];
    ok = !vivo(torre);
  }
  if (!ok) return false;
  const raio = UNIDADES[carta.un].raio;
  for (const e of sim.ents) {
    if (!vivo(e) || !e.d.construcao) continue;
    const folga = UNIDADES[carta.un].construcao ? e.d.raio + raio : e.d.raio + 0.1;
    if (hipot(x, y, e.x, e.y) < folga) return false;
  }
  return true;
}

// Joga uma carta do assento k. Devolve true se valeu (o mesmo caminho para as pessoas e para o Raposo).
function jogarCarta(sim, k, chave, x, y) {
  const s = sim.assentos[k];
  if (!s || sim.fim) return false;
  const carta = CARTA[chave];
  x = Number(x);
  y = Number(y);
  if (!carta || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const pos = s.mao.indexOf(chave);
  if (pos < 0 || s.cen < carta.custo - 1e-9) return false;
  if (sim.t - s.ultima < ENTRE_CARTAS - 1e-9) return false;
  if (!lugarValido(sim, s.lado, x, y, carta)) return false;
  s.cen -= carta.custo;
  s.ultima = sim.t;
  s.jogadas++;
  // O ciclo: a carta jogada vai para o fim da fila e a próxima entra no lugar dela.
  s.fila.push(chave);
  s.mao[pos] = s.fila.shift();
  efeito(sim, FX.carta, x, y, IDX_CARTA[chave], k);
  if (carta.feitico) {
    const f = carta.feitico;
    if (f.voa) {
      const rei = sim.torres[s.lado * 3 + 2];
      sim.tiros.push({ id: sim.proxId++, k: 'bomba', x: rei.x, y: rei.y, tx: x, ty: y, alvo: null, vel: VEL_TIRO.bomba, lado: s.lado, dono: k, feitico: f, carta: chave });
    } else {
      sim.feiticos.push({ id: sim.proxId++, k: chave, x, y, espera: f.espera, lado: s.lado, dono: k, f });
    }
    return true;
  }
  const qtd = carta.qtd || 1;
  for (const [ox, oy] of FORMACAO[qtd] || FORMACAO[1]) {
    const e = criar(sim, carta.un, k, s.lado, x + ox, y + (s.lado === 0 ? oy : -oy), s.nivel);
    e.chega = CHEGADA;
    e.estado = 2;
  }
  return true;
}

function agir(sim, i, ev) {
  const s = sim.assentos[i];
  if (!s || s.raposo || s.saiu || sim.fim || !ev) return null;
  if (ev.tipo === 'carta') {
    return jogarCarta(sim, i, String(ev.carta || ''), ev.x, ev.y) ? { mudou: false } : null;
  }
  if (ev.tipo === 'baralho') {
    // O baralho escolhido antes da partida: vale enquanto a pessoa não jogou nenhuma carta.
    const cartas = Array.isArray(ev.cartas) ? ev.cartas.map(String) : [];
    if (s.jogadas > 0 || cartas.length !== 8 || new Set(cartas).size !== 8 || !cartas.every(c => CARTA[c])) return null;
    prepararBaralho(sim, s, cartas);
    return { mudou: false };
  }
  return null;
}

// Quem saiu deixa o lugar para o Raposo (com as cartas e as cenouras que tinha).
function sair(sim, i) {
  const s = sim.assentos[i];
  if (!s || s.saiu) return;
  s.saiu = true;
  s.raposo = true;
  novaIa(sim, s, s.lado === 0 ? i % 2 : (i + 1) % 2);
}

/* ─── Alvos e caminhos ─── */

const distBorda = (a, b) => hipot(a.x, a.y, b.x, b.y) - a.d.raio - b.d.raio;

function podeMirar(e, o) {
  if (o.lado === e.lado || !vivo(o) || o.chega > 0) return false;
  if (e.d.alvo === 'construcoes') return !!o.d.construcao;
  if (e.d.alvo === 'terra') return !o.d.voa;
  return true;
}
const atingeTipo = (alvoDe, o) => (alvoDe === 'construcoes' ? !!o.d.construcao : alvoDe === 'terra' ? !o.d.voa : true);

const precisaAtravessar = (e, ty) => !e.d.voa && !e.d.pula && (e.y > MEIO) !== (ty > MEIO);

// A ponte que dá o caminho mais curto de e até (tx, ty), com a entrada e a saída.
function melhorPonte(e, tx, ty) {
  const deBaixo = e.y > MEIO;
  const yEntra = deBaixo ? RIO_BAIXO + 0.4 : RIO_CIMA - 0.4;
  const ySai = deBaixo ? RIO_CIMA - 0.6 : RIO_BAIXO + 0.6;
  let melhor = PONTES[0];
  let menor = Infinity;
  for (const bx of PONTES) {
    const d = hipot(e.x, e.y, bx, yEntra) + hipot(bx, ySai, tx, ty);
    if (d < menor) { menor = d; melhor = bx; }
  }
  return { bx: melhor, yEntra, ySai, d: menor };
}

const caminho = (e, o) => (precisaAtravessar(e, o.y) ? melhorPonte(e, o.x, o.y).d : hipot(e.x, e.y, o.x, o.y));

function predioMaisPerto(sim, e) {
  let melhor = null;
  let menor = Infinity;
  for (const o of sim.ents) {
    if (!o.d.construcao || o.lado === e.lado || !vivo(o)) continue;
    const d = caminho(e, o);
    if (d < menor) { menor = d; melhor = o; }
  }
  return melhor;
}

function procurar(sim, e) {
  const ate = e.d.construcao ? e.d.alc : e.d.visao;
  let melhor = null;
  let menor = Infinity;
  for (const o of sim.ents) {
    if (!podeMirar(e, o)) continue;
    const d = distBorda(e, o);
    if (d <= ate && d < menor) { menor = d; melhor = o; }
  }
  if (melhor || e.d.construcao) return melhor;
  return predioMaisPerto(sim, e); // ninguém à vista: segue para a construção inimiga mais perto
}

function pontoDoCaminho(e, alvo) {
  if (!precisaAtravessar(e, alvo.y)) return [alvo.x, alvo.y];
  const { bx, yEntra, ySai } = melhorPonte(e, alvo.x, alvo.y);
  const noRio = e.y >= RIO_CIMA && e.y <= RIO_BAIXO;
  if (Math.abs(e.x - bx) < MEIA_PONTE - 0.15 && (noRio || Math.abs(e.y - yEntra) < 0.8)) {
    return [Math.max(bx - 0.6, Math.min(bx + 0.6, e.x)), ySai];
  }
  return [bx, yEntra];
}

/* ─── Golpes, tiros e feitiços ─── */

function ferir(sim, o, dano, dono) {
  if (!vivo(o) || dano <= 0) return;
  const real = Math.min(dano, o.hp);
  o.hp -= dano;
  if (o.d.torre && dono != null && sim.dano[dono] != null) sim.dano[dono] += real;
  if (o.dormindo) o.dormindo = false; // o castelo acorda quando apanha
}

function respingo(sim, cx, cy, raio, dano, lado, alvoDe, dono, menos = null) {
  for (const o of sim.ents) {
    if (o === menos || o.lado === lado || !vivo(o) || !atingeTipo(alvoDe, o)) continue;
    if (hipot(cx, cy, o.x, o.y) <= raio + o.d.raio * 0.5) ferir(sim, o, dano, dono);
  }
}

function golpear(sim, e, alvo) {
  if (e.d.tiro) {
    sim.tiros.push({ id: sim.proxId++, k: e.d.tiro, x: e.x, y: e.y, tx: alvo.x, ty: alvo.y, alvo, vel: VEL_TIRO[e.d.tiro], lado: e.lado, dono: e.dono, dano: e.d.dano, area: e.d.area || 0, alvoDe: e.d.alvo });
    return;
  }
  ferir(sim, alvo, e.d.dano, e.dono);
  if (e.d.area) {
    const c = e.d.emVolta ? e : alvo;
    respingo(sim, c.x, c.y, e.d.area, e.d.dano, e.lado, e.d.alvo, e.dono, alvo);
    efeito(sim, FX.area, c.x, c.y, Math.round(e.d.area * 10), TIPOS.indexOf(e.tipo));
  }
}

function explodirFeitico(sim, f, x, y, lado, dono, chave) {
  for (const o of sim.ents) {
    if (o.lado === lado || !vivo(o)) continue;
    const d = hipot(x, y, o.x, o.y);
    if (d > f.raio + o.d.raio * 0.6) continue;
    ferir(sim, o, f.dano * (o.d.torre ? f.torre : 1), dono);
    // A bomba empurra as tropas pequenas para longe do meio.
    if (f.empurra && !o.d.construcao && (o.d.massa || 1) <= 7 && d > 1e-6) {
      const k = f.empurra * (1 - (d / (f.raio + 1)) * 0.5);
      o.x += ((o.x - x) / d) * k;
      o.y += ((o.y - y) / d) * k;
    }
  }
  efeito(sim, chave === 'bomba' ? FX.bomba : FX.bolotas, x, y, Math.round(f.raio * 10), dono);
}

function moverTiros(sim) {
  const restam = [];
  for (const p of sim.tiros) {
    if (p.alvo && vivo(p.alvo)) { p.tx = p.alvo.x; p.ty = p.alvo.y; }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const passo = p.vel * PASSO;
    if (d <= passo + 0.05) {
      p.x = p.tx;
      p.y = p.ty;
      if (p.feitico) explodirFeitico(sim, p.feitico, p.tx, p.ty, p.lado, p.dono, p.carta);
      else {
        if (p.alvo && vivo(p.alvo)) ferir(sim, p.alvo, p.dano, p.dono);
        if (p.area) {
          respingo(sim, p.tx, p.ty, p.area, p.dano, p.lado, p.alvoDe, p.dono, p.alvo);
          efeito(sim, FX.area, p.tx, p.ty, Math.round(p.area * 10), -1);
        }
      }
      continue;
    }
    p.x += (dx / d) * passo;
    p.y += (dy / d) * passo;
    restam.push(p);
  }
  sim.tiros = restam;
}

function andarFeiticos(sim) {
  if (!sim.feiticos.length) return;
  const restam = [];
  for (const f of sim.feiticos) {
    f.espera -= PASSO;
    if (f.espera <= 1e-9) explodirFeitico(sim, f.f, f.x, f.y, f.lado, f.dono, f.k);
    else restam.push(f);
  }
  sim.feiticos = restam;
}

/* ─── Cada um no seu passo ─── */

function agirEnt(sim, e) {
  if (e.chega > 0) { e.chega -= PASSO; e.estado = 2; return; }
  if (e.golpe > 0) e.golpe -= PASSO;
  if (e.cd > 0) e.cd -= PASSO;
  if (e.d.vida) { e.hp -= (e.max / e.d.vida) * PASSO; if (e.hp <= 0) return; }
  if (e.dormindo) { e.estado = 1; return; }
  let alvo = e.alvo && podeMirar(e, e.alvo) ? e.alvo : null;
  let perto = !!alvo && distBorda(e, alvo) <= e.d.alc;
  if (!perto) {
    alvo = procurar(sim, e);
    perto = !!alvo && distBorda(e, alvo) <= e.d.alc;
  }
  e.alvo = alvo;
  if (perto) {
    if (e.cd <= 0) { golpear(sim, e, alvo); e.cd = e.d.cad; e.golpe = 0.25; }
    e.estado = e.golpe > 0 ? 3 : 1;
    return;
  }
  e.estado = e.d.construcao ? 1 : 0;
  if (e.d.construcao || !alvo) return;
  const [wx, wy] = pontoDoCaminho(e, alvo);
  const dx = wx - e.x;
  const dy = wy - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const passo = Math.min(d, e.d.vel * PASSO);
  e.x += (dx / d) * passo;
  e.y += (dy / d) * passo;
}

// Ninguém fica um em cima do outro, nem dentro de torre, nem no rio fora das pontes.
function separar(sim) {
  const moveis = sim.ents.filter(e => vivo(e) && !e.d.construcao);
  const fixos = sim.ents.filter(e => vivo(e) && e.d.construcao);
  for (let a = 0; a < moveis.length; a++) {
    const p = moveis[a];
    for (let b = a + 1; b < moveis.length; b++) {
      const q = moveis[b];
      if (!!p.d.voa !== !!q.d.voa) continue;
      const min = p.d.raio + q.d.raio;
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 1e-6) { dx = (p.id % 2 ? 1 : -1) * 0.01; dy = 0.005; d = Math.hypot(dx, dy); }
      const sobra = min - d;
      const mp = p.chega > 0 ? 1000 : p.d.massa || 1;
      const mq = q.chega > 0 ? 1000 : q.d.massa || 1;
      const kp = (sobra * mq) / (mp + mq);
      const kq = (sobra * mp) / (mp + mq);
      p.x -= (dx / d) * kp; p.y -= (dy / d) * kp;
      q.x += (dx / d) * kq; q.y += (dy / d) * kq;
    }
  }
  for (const p of moveis) {
    if (!p.d.voa) {
      for (const f of fixos) {
        const min = p.d.raio + f.d.raio;
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-6) { p.x += min; continue; }
        p.x = f.x + (dx / d) * min;
        p.y = f.y + (dy / d) * min;
      }
      // O rio: fora das pontes, volta para a ponte ou para a margem (o que estiver mais perto).
      if (!p.d.pula && p.y > RIO_CIMA && p.y < RIO_BAIXO) {
        const bx = Math.abs(p.x - PONTES[0]) < Math.abs(p.x - PONTES[1]) ? PONTES[0] : PONTES[1];
        const foraX = Math.abs(p.x - bx) - (MEIA_PONTE - p.d.raio * 0.5);
        if (foraX > 0) {
          const margem = p.y < MEIO ? RIO_CIMA : RIO_BAIXO;
          if (foraX < Math.abs(p.y - margem)) p.x = bx + Math.sign(p.x - bx) * (MEIA_PONTE - p.d.raio * 0.5);
          else p.y = margem;
        }
      }
    }
    p.x = Math.max(0.4, Math.min(LARG - 0.4, p.x));
    p.y = Math.max(0.4, Math.min(ALT - 0.4, p.y));
  }
}

function acabar(sim, vencedor, motivo) {
  if (sim.fim) return;
  sim.fim = motivo;
  sim.vencedor = vencedor;
  if (sim.assentos.some(s => s.raposo && s.lado === 1)) falar(sim, vencedor === 1 ? FALA.venceu : FALA.perdeuJogo);
}

function morreu(sim, e) {
  efeito(sim, e.d.torre ? FX.torre : FX.morte, e.x, e.y, TIPOS.indexOf(e.tipo), e.lado);
  if (e.d.torre) {
    const outro = 1 - e.lado;
    if (e.tipo === 'rei') {
      sim.coroas[outro] = 3;
      acabar(sim, outro, 'castelo');
    } else {
      sim.coroas[outro] = Math.min(3, sim.coroas[outro] + 1);
      const rei = sim.torres[e.lado * 3 + 2];
      if (rei.dormindo) rei.dormindo = false; // uma torre caiu: o castelo acorda
      falar(sim, e.lado === 1 ? FALA.perdeu : FALA.derrubou);
    }
    return;
  }
  const m = e.d.morte;
  if (m) {
    respingo(sim, e.x, e.y, m.area, m.dano, e.lado, 'terra', e.dono);
    for (let k = 0; k < m.qtd; k++) {
      const filho = criar(sim, m.filho, e.dono, e.lado, e.x + (k ? 0.6 : -0.6), e.y, e.max / e.d.hp);
      filho.cd = 0.5;
    }
  }
}

function limparMortos(sim) {
  let algum = false;
  for (const e of sim.ents) {
    if (e.hp <= 0 && !e.morto) { e.morto = true; algum = true; morreu(sim, e); }
  }
  if (algum) sim.ents = sim.ents.filter(e => !e.morto || e.d.torre);
}

// A torre mais fraca de cada lado decide o desempate (a de quem tem a torre mais fraca perde).
function desempatar(sim) {
  const fraca = lado => Math.min(...sim.torres.filter(t => t.lado === lado && vivo(t)).map(t => t.hp), Infinity);
  const a = fraca(0);
  const b = fraca(1);
  if (Math.abs(a - b) < 1) acabar(sim, -1, 'empate');
  else acabar(sim, a > b ? 0 : 1, 'desempate');
}

function conferirFim(sim) {
  if (sim.fim) return;
  const [a, b] = sim.coroas;
  if (!sim.prorrogacao && sim.t >= TEMPO_NORMAL - 1e-9) {
    if (a !== b) { acabar(sim, a > b ? 0 : 1, 'coroas'); return; }
    sim.prorrogacao = true;
  }
  if (sim.prorrogacao) {
    if (a !== b) acabar(sim, a > b ? 0 : 1, 'morte-subita');
    else if (sim.t >= TEMPO_NORMAL + TEMPO_EXTRA - 1e-9) desempatar(sim);
  }
}

const dobro = sim => sim.prorrogacao || sim.t >= DOBRO_DESDE - 1e-9;

function tique(sim) {
  sim.t = Math.round((sim.t + PASSO) * 1000) / 1000;
  sim.tiques++;
  const taxa = (PASSO * (dobro(sim) ? 2 : 1)) / RECARGA;
  for (const s of sim.assentos) s.cen = Math.min(MAX_CENOURAS, s.cen + taxa * s.mult);
  for (const e of sim.ents) if (vivo(e)) agirEnt(sim, e);
  moverTiros(sim);
  andarFeiticos(sim);
  separar(sim);
  limparMortos(sim);
  sim.assentos.forEach((s, k) => { if (s.raposo && !sim.fim) pensar(sim, s, k); });
  conferirFim(sim);
  if (sim.fx.length && sim.fx[0].ate <= sim.t) sim.fx = sim.fx.filter(f => f.ate > sim.t);
}

// Um passo do relógio do servidor (uns 50 ms; o jogo anda em passos fixos de 50 ms).
function passo(sim, dt) {
  if (sim.fim) return false;
  sim.acum += Math.max(0, Math.min(0.25, Number(dt) || 0));
  for (let n = 0; sim.acum >= PASSO - 1e-9 && !sim.fim && n < 8; n++) {
    tique(sim);
    sim.acum -= PASSO;
  }
  if (sim.acum > PASSO) sim.acum = 0; // servidor engasgado: não tenta correr atrás
  return true;
}

/* ─── O Raposo ─── */

const ehTanque = tipo => tipo === 'urso' || tipo === 'carvalho';
const cartaDaUnidade = tipo => CARTAS.find(c => c.un === tipo);

// O lugar mais valioso para um feitiço de raio r contra as tropas do lado "lado".
function melhorGrupo(sim, lado, r, filtro = () => true) {
  let melhor = { valor: 0, x: 0, y: 0 };
  const alvos = sim.ents.filter(o => o.lado === lado && vivo(o) && !o.d.torre && filtro(o));
  for (const c of alvos) {
    let valor = 0;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const o of alvos) {
      if (hipot(c.x, c.y, o.x, o.y) > r) continue;
      valor += (VALOR[o.tipo] || 1) * (o.hp / o.max);
      sx += o.x; sy += o.y; n++;
    }
    if (valor > melhor.valor) melhor = { valor, x: sx / n, y: sy / n };
  }
  return melhor;
}

function tentar(sim, k, chave, x, y, lado) {
  // Procura um lugar válido perto do pedido (o Raposo não erra de um jeito bobo).
  const py0 = yDoLado(lado, y);
  for (const [ox, oy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, 2], [1.5, 1], [-1.5, 1], [0, -1]]) {
    const nx = Math.max(0.6, Math.min(LARG - 0.6, x + ox));
    const ny = yDoLado(lado, Math.max(0.6, Math.min(ALT - 0.6, py0 + oy)));
    if (jogarCarta(sim, k, chave, nx, ny)) return true;
  }
  return false;
}

function notaDefesa(c, faixa) {
  const u = UNIDADES[c.un];
  if (!u || u.alvo === 'construcoes') return -1;
  if (u.construcao) return faixa.tanque >= 3 ? 4 : faixa.v >= 4 && faixa.ar < faixa.v ? 1.5 : -1;
  let n = 2;
  const qtd = c.qtd || 1;
  if (faixa.ar > faixa.v * 0.5 && u.alvo !== 'tudo') return 0.1;
  if (faixa.ar > 0 && u.alvo === 'tudo') n += 2;
  if (faixa.enxame >= 3) n += u.area ? 3 : u.hp * qtd < 400 ? -1.5 : 0;
  if (faixa.tanque >= 3) n += ((u.dano / u.cad) * qtd) / 50 + (qtd > 1 ? 1 : 0);
  n -= Math.abs(c.custo - Math.min(faixa.v, 6)) * 0.35;
  return n;
}

function pensar(sim, s, k) {
  const ia = s.ia;
  if ((ia.espera -= PASSO) > 0) return;
  ia.espera = (0.45 + sim.sorte() * 0.4) / sim.dif;
  const eu = s.lado;
  const outro = 1 - eu;
  const P = y => yDoLado(eu, y);
  const mao = s.mao.map(c => CARTA[c]);
  const cabe = c => c.custo <= s.cen + 1e-9;
  const inimigos = sim.ents.filter(e => e.lado === outro && vivo(e) && !e.d.torre);
  const meus = sim.ents.filter(e => e.lado === eu && vivo(e) && !e.d.construcao);
  const deles = sim.assentos.filter(x => x.lado === outro);
  const cenDeles = deles.reduce((t, x) => t + x.cen, 0) / Math.max(1, deles.length);

  // 1. Torre quase caindo: termina com um feitiço.
  for (const t of sim.torres) {
    if (t.lado !== outro || !vivo(t)) continue;
    for (const c of mao) {
      if (!c.feitico || !cabe(c)) continue;
      if (t.hp <= c.feitico.dano * c.feitico.torre) { if (jogarCarta(sim, k, c.k, t.x, t.y)) return; }
    }
  }

  // 2. Ameaças: o que vem pelo lado esquerdo e pelo direito.
  const faixas = [0, 1].map(() => ({ v: 0, ar: 0, enxame: 0, tanque: 0, def: 0, lider: null }));
  for (const e of inimigos) {
    if (P(e.y) < 12.5 || e.d.construcao) continue;
    const f = faixas[e.x < LARG / 2 ? 0 : 1];
    const valor = (VALOR[e.tipo] || 1) * (e.hp / e.max);
    f.v += valor;
    if (e.d.voa) f.ar += valor;
    if (e.max <= 260) f.enxame++;
    if (e.d.alvo === 'construcoes') f.tanque += valor;
    if (!f.lider || P(e.y) > P(f.lider.y)) f.lider = e;
  }
  for (const m of meus) if (P(m.y) > 13) faixas[m.x < LARG / 2 ? 0 : 1].def += (VALOR[m.tipo] || 1) * (m.hp / m.max) * (m.d.alvo === 'construcoes' ? 0.2 : 1);
  const ordem = [0, 1].sort((a, b) => (faixas[b].v - faixas[b].def * 0.8) - (faixas[a].v - faixas[a].def * 0.8));
  const faixa = faixas[ordem[0]];
  const lado = ordem[0];
  const precisa = faixa.v - faixa.def * 0.8;
  if (faixa.lider && precisa >= 1.2 && P(faixa.lider.y) >= 14.5) {
    const lid = faixa.lider;
    // Feitiço num grupo que vale a pena.
    for (const c of mao) {
      if (!c.feitico || !cabe(c)) continue;
      const g = melhorGrupo(sim, outro, c.feitico.raio * 0.85);
      if (g.valor >= c.custo + 0.8) {
        const adiante = c.feitico.voa ? 0.6 : 0.3;
        if (jogarCarta(sim, k, c.k, g.x, g.y + (eu === 0 ? adiante : -adiante))) { ia.ultimaDefesa = sim.t; return; }
      }
    }
    const opcoes = mao.filter(c => !c.feitico && cabe(c)).map(c => ({ c, nota: notaDefesa(c, faixa) })).filter(o => o.nota > 0.5)
      .sort((a, b) => b.nota - a.nota);
    const escolha = opcoes[0];
    if (escolha) {
      const u = UNIDADES[escolha.c.un];
      let x;
      let py;
      if (u.construcao) { x = lado === 0 ? 7.5 : 10.5; py = 22; }
      else if (u.alc >= 3) { x = lado === 0 ? 5.5 : 12.5; py = 27.5; }
      else {
        x = lid.x;
        py = Math.max(RIO_BAIXO + 0.6, Math.min(30, P(lid.y) + 1.8));
      }
      x += (sim.sorte() - 0.5) * (1.2 / sim.dif);
      if (tentar(sim, k, escolha.c.k, x, yDoLado(eu, py), eu)) { ia.ultimaDefesa = sim.t; return; }
    }
    // Sem resposta boa agora: guarda as cenouras (a não ser que estejam cheias).
    if (s.cen < MAX_CENOURAS - 0.3) return;
  }

  // 3. Apoio: atrás do meu tanque, ou das tropas que sobraram da defesa e estão atacando.
  const tanque = meus.find(m => ehTanque(m.tipo) && P(m.y) > 14 && P(m.y) < 26);
  const atacando = meus.filter(m => P(m.y) < 19);
  const valorAtaque = atacando.reduce((t, m) => t + (VALOR[m.tipo] || 1) * (m.hp / m.max), 0);
  const lider = tanque || (valorAtaque >= 3 ? atacando.reduce((a, b) => (P(a.y) < P(b.y) ? a : b)) : null);
  if (lider && sim.t - ia.ultimoApoio > 3.5 && ia.apoios < 3 && s.cen >= 4) {
    const apoio = mao.filter(c => cabe(c) && !c.feitico && UNIDADES[c.un].alvo !== 'construcoes' && !UNIDADES[c.un].construcao)
      .sort((a, b) => (UNIDADES[b.un].alc >= 2) - (UNIDADES[a.un].alc >= 2) || b.custo - a.custo)[0];
    if (apoio) {
      const py = Math.max(RIO_BAIXO + 0.5, P(lider.y) + 2);
      if (tentar(sim, k, apoio.k, lider.x, yDoLado(eu, py), eu)) { ia.ultimoApoio = sim.t; ia.apoios++; return; }
    }
  }

  // 4. Ataque: com as cenouras juntas (ou cheias), começa um empurrão.
  const limiar = 8.6 - (sim.dif - 1) * 2;
  const cheio = s.cen >= MAX_CENOURAS - 0.3;
  if (s.cen < limiar && !cheio) return;
  const vidaTorre = l => { const t = sim.torres[outro * 3 + l]; return vivo(t) ? t.hp : 0; };
  let faixaAtaque = vidaTorre(0) === vidaTorre(1) ? ia.ladoPreferido : vidaTorre(0) < vidaTorre(1) ? 0 : 1;
  if (sim.sorte() < 0.25) faixaAtaque = 1 - faixaAtaque; // de vez em quando troca o lado (para não ficar previsível)
  const ponte = PONTES[faixaAtaque];
  const tanqueMao = mao.find(c => cabe(c) && ehTanque(c.un));
  if (tanqueMao) {
    if (tentar(sim, k, tanqueMao.k, faixaAtaque === 0 ? 4.5 : 13.5, yDoLado(eu, 29.5), eu)) {
      ia.apoios = 0;
      ia.ultimoApoio = sim.t - 1;
      if (sim.sorte() < 0.5) falar(sim, FALA.empurrao, eu);
      return;
    }
  }
  const javali = mao.find(c => cabe(c) && c.un === 'javali');
  if (javali && (cenDeles < 5 || cheio || sim.sorte() < 0.4)) {
    if (tentar(sim, k, javali.k, ponte, yDoLado(eu, RIO_BAIXO + 0.8), eu)) return;
  }
  if (!cheio) return;
  // Cheio e sem tanque: uma tropa atrás do castelo para girar as cartas, ou na ponte.
  const giro = mao.filter(c => cabe(c) && !c.feitico && !UNIDADES[c.un].construcao).sort((a, b) => a.custo - b.custo)[0];
  if (giro) {
    const atras = UNIDADES[giro.un].alvo === 'construcoes' || giro.custo >= 4;
    tentar(sim, k, giro.k, atras ? (faixaAtaque === 0 ? 3 : 15) : ponte, yDoLado(eu, atras ? 30 : RIO_BAIXO + 1.2), eu);
  }
}

/* ─── O que vai para os navegadores ─── */

// Quadro: t (segundos de jogo), s ('pronto' | 'jogando' | 'fim'), rl (segundos que faltam), x2 (cenouras em
// dobro), pr (prorrogação), c (coroas [lado 0, lado 1]), T (vida das 6 torres), TM (vida máxima),
// R (castelos acordados [lado 0, lado 1]), a (por assento: [lado, cenouras*10, 4 cartas da mão, próxima,
// 0 pessoa | 1 Raposo | 2 saiu]), u (tropas: [id, tipo, assento, x*10, y*10, vida %, estado]),
// p (tiros: [id, tipo, x*10, y*10]), fx (acontecimentos: [id, tipo, x*10, y*10, a, b]), f ([vencedor, motivo]).
function quadro(sim) {
  const restante = sim.prorrogacao ? TEMPO_NORMAL + TEMPO_EXTRA - sim.t : TEMPO_NORMAL - sim.t;
  const q = {
    t: Math.round(sim.t * 100) / 100,
    s: sim.fim ? 'fim' : sim.tiques ? 'jogando' : 'pronto',
    rl: r1(Math.max(0, restante)),
    c: sim.coroas,
    T: sim.torres.map(t => Math.max(0, Math.ceil(t.hp))),
    TM: sim.torres.map(t => Math.round(t.max)),
    R: [sim.torres[2].dormindo ? 0 : 1, sim.torres[5].dormindo ? 0 : 1],
    a: sim.assentos.map(s => [s.lado, Math.floor(s.cen * 10), ...s.mao.map(c => IDX_CARTA[c]), IDX_CARTA[s.fila[0]], s.saiu ? 2 : s.raposo ? 1 : 0]),
    u: [],
  };
  if (dobro(sim)) q.x2 = 1;
  if (sim.prorrogacao) q.pr = 1;
  for (const e of sim.ents) {
    if (e.d.torre || !vivo(e)) continue;
    q.u.push([e.id, TIPOS.indexOf(e.tipo), e.dono ?? -1, d10(e.x), d10(e.y), Math.max(1, Math.round((e.hp / e.max) * 100)), e.estado]);
  }
  if (sim.tiros.length) q.p = sim.tiros.map(p => [p.id, TIROS.indexOf(p.k), d10(p.x), d10(p.y)]);
  if (sim.feiticos.length) q.fe = sim.feiticos.map(f => [f.id, IDX_CARTA[f.k], d10(f.x), d10(f.y), r1(f.espera)]);
  if (sim.fx.length) q.fx = sim.fx.map(f => [f.id, f.tipo, d10(f.x), d10(f.y), f.a, f.b]);
  if (sim.fim) q.f = [sim.vencedor, sim.fim];
  return q;
}

// null enquanto joga; senão { motivo, vencedores }. porTempo: o tempo da sala acabou e é preciso decidir agora.
function resultado(sim, presentes, porTempo = false) {
  const humanos = sim.assentos.filter(s => s.i >= 0).map(s => s.i);
  const lista = (Array.isArray(presentes) ? presentes : humanos).filter(i => sim.assentos[i] && sim.assentos[i].i === i && !sim.assentos[i].saiu);
  if (!sim.fim && porTempo) {
    const [a, b] = sim.coroas;
    if (a !== b) acabar(sim, a > b ? 0 : 1, 'coroas');
    else desempatar(sim);
  }
  if (!sim.fim) return null;
  return { motivo: sim.fim, vencedores: sim.vencedor < 0 ? [] : lista.filter(i => sim.assentos[i].lado === sim.vencedor) };
}

// Os pontos de cada pessoa: 1000 por coroa do seu lado + o dano que fez nas torres do outro lado.
const pontos = sim => sim.assentos.filter(s => s.i >= 0).map(s => sim.coroas[s.lado] * 1000 + Math.floor(sim.dano[s.i] || 0));

module.exports = {
  novo, agir, passo, quadro, resultado, sair, pontos,
  // Para os testes.
  _interno: {
    PASSO, LARG, ALT, MEIO, PONTES, TEMPO_NORMAL, TEMPO_EXTRA, DOBRO_DESDE, RECARGA, CHEGADA, ENTRE_CARTAS, MAX_CENOURAS,
    UNIDADES, TIPOS, TIROS, CARTAS, CARTA, IDX_CARTA, BARALHO_PADRAO, BARALHOS_RAPOSO, FX, FALA, LUGAR_TORRES,
    jogarCarta, lugarValido, criar, tique, pensar, podeMirar, procurar, predioMaisPerto, pontoDoCaminho, melhorPonte, yDoLado, vivo,
  },
};
