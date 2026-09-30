// Casas do mapa: onde cada casa fica ao longo da rua (lado esquerdo e direito, alinhadas)
// e como ler uma lista colada ("Casa 02 - Layla Weeslay"). Aqui não tem nada de tela, só as contas.
//
// Lados: numa via em pé, "esquerda" é o lado oeste (à esquerda no mapa) e "direita" o leste;
// numa via deitada, "esquerda" é o lado de cima (norte) e "direita" o de baixo.
// Os números crescem de cima para baixo (via em pé) ou da esquerda para a direita (via deitada).

import { AVENIDAS, RUAS, CIDADE, PREDIOS } from './mapa-lyendell.js';

export const TAMANHO_CASA = 14;
export const VIAS_DO_MAPA = [...AVENIDAS.map(v => ({ ...v, tipo: 'avenida' })), ...RUAS.map(v => ({ ...v, tipo: 'rua' }))];
export const viaPorId = id => VIAS_DO_MAPA.find(v => v.id === id) || null;
export const linhasDaVia = v => [v.pontos, ...(v.ramos || [])];

const meiaLargura = v => (v.tipo === 'avenida' ? 11 : 7.5);
const afastamento = v => meiaLargura(v) + 5 + TAMANHO_CASA / 2;
const meio = n => Math.round(n * 2) / 2;
export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Pontos a cada "passo" ao longo de uma linha (para medir distâncias).
export function amostrar(pontos, passo = 4) {
  const saida = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const [a, b] = [pontos[i], pontos[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
    for (let k = 0; k < n; k++) saida.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  saida.push(pontos[pontos.length - 1]);
  return saida;
}

export function dentro([x, y], poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

const perto = (p, pts, limite) => pts.some(q => Math.abs(q[0] - p[0]) < limite && Math.abs(q[1] - p[1]) < limite && Math.hypot(q[0] - p[0], q[1] - p[1]) < limite);
const AMOSTRAS = VIAS_DO_MAPA.map(v => ({ v, pts: linhasDaVia(v).flatMap(l => amostrar(l, 3)) }));
const MURO = amostrar([...CIDADE, CIDADE[0]], 4);

// A casa cabe aqui? Não pode ficar em cima de outra via, da muralha nem de um prédio público.
function cabe(p, via) {
  for (const { v, pts } of AMOSTRAS) {
    const limite = v.id === via.id ? afastamento(v) - 0.6 : meiaLargura(v) + TAMANHO_CASA / 2 + 3;
    if (perto(p, pts, limite)) return false;
  }
  if (!dentro(p, CIDADE) || perto(p, MURO, TAMANHO_CASA / 2 + 6)) return false;
  return !PREDIOS.some(pr => Math.abs(pr.x - p[0]) < (pr.grande ? 36 : 30) && Math.abs(pr.y - p[1]) < (pr.grande ? 40 : 34));
}

function orientar(a, b) {
  const vertical = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
  if ((vertical && b[1] < a[1]) || (!vertical && b[0] < a[0])) [a, b] = [b, a];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { a, b, vertical, len, dir: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
}

// Para que lado a casa fica: "esquerda" = oeste (via em pé) ou norte (via deitada).
function normal({ dir, vertical }, lado) {
  let n = [dir[1], -dir[0]];
  if ((vertical && n[0] > 0) || (!vertical && n[1] > 0)) n = [-n[0], -n[1]];
  return lado === 'direita' ? [-n[0], -n[1]] : n;
}

// O trecho reto mais comprido da via: é nele que as casas são enfileiradas.
export function trechoPrincipal(via) {
  const trechos = linhasDaVia(via).flatMap(l => l.slice(1).map((b, i) => [l[i], b]));
  const [a, b] = trechos.reduce((m, t) => (Math.hypot(t[1][0] - t[0][0], t[1][1] - t[0][1]) > Math.hypot(m[1][0] - m[0][0], m[1][1] - m[0][1]) ? t : m));
  return orientar(a, b);
}

const numeroDe = c => parseInt(c.numero, 10) || 0;
const porNumero = (a, b) => numeroDe(a) - numeroDe(b) || String(a.numero).localeCompare(String(b.numero));

// Enfileira as casas de uma via: os dois lados na mesma altura, espalhadas pelos trechos livres.
export function distribuir(via, casas) {
  const t = trechoPrincipal(via);
  const af = afastamento(via);
  const lados = { esquerda: casas.filter(c => c.lado !== 'direita').sort(porNumero), direita: casas.filter(c => c.lado === 'direita').sort(porNumero) };
  const usados = Object.keys(lados).filter(l => lados[l].length);
  const ponto = (s, lado) => {
    const n = normal(t, lado);
    return [t.a[0] + t.dir[0] * s + n[0] * af, t.a[1] + t.dir[1] * s + n[1] * af];
  };
  let livres = [];
  for (let s = 0; s <= t.len; s += 2) if (usados.every(l => cabe(ponto(s, l), via))) livres.push(s);
  if (!livres.length) livres = Array.from({ length: Math.floor(t.len / 2) + 1 }, (_, i) => i * 2);
  const linhas = Math.max(1, ...usados.map(l => lados[l].length));
  const posicoes = Array.from({ length: linhas }, (_, j) => livres[Math.min(livres.length - 1, Math.round(((j + 0.5) * livres.length) / linhas - 0.5))]);
  return usados.flatMap(l => lados[l].map((c, j) => {
    const [x, y] = ponto(posicoes[j], l);
    return { ...c, via: via.id, lado: l, x: meio(x), y: meio(y) };
  }));
}

// Casa solta (clicada ou arrastada): encosta alinhada na via mais perto, do lado em que estiver.
export function encaixar([x, y]) {
  let melhor = null;
  for (const v of VIAS_DO_MAPA) {
    for (const l of linhasDaVia(v)) {
      for (let i = 0; i < l.length - 1; i++) {
        const t = orientar(l[i], l[i + 1]);
        const s = Math.max(0, Math.min(t.len, (x - t.a[0]) * t.dir[0] + (y - t.a[1]) * t.dir[1]));
        const base = [t.a[0] + t.dir[0] * s, t.a[1] + t.dir[1] * s];
        const d = Math.hypot(x - base[0], y - base[1]);
        if (!melhor || d < melhor.d) melhor = { v, t, s, base, d };
      }
    }
  }
  if (!melhor || melhor.d > 45) return { via: null, lado: null, x: meio(x), y: meio(y) };
  const esq = normal(melhor.t, 'esquerda');
  const lado = (x - melhor.base[0]) * esq[0] + (y - melhor.base[1]) * esq[1] >= 0 ? 'esquerda' : 'direita';
  const n = normal(melhor.t, lado);
  const af = afastamento(melhor.v);
  return { via: melhor.v.id, lado, x: meio(melhor.base[0] + n[0] * af), y: meio(melhor.base[1] + n[1] * af) };
}

/* ─── Lista colada ────────────────────────────────── */

const COMERCIO = /\b(bar|taverna|peixaria|pousada|estalagem|hospedaria|loja|mercado|mercearia|padaria|ferraria|acougue|armazem|oficina|alfaiataria|botica|boticario|farmacia|estabulo|joalheria|carpintaria|restaurante|emporio|feira)\b/;

// "Sem Dono" ou "Sem Morador" (é a mesma coisa), comércio ("Bar sem dono", "Pousada Estrela Cadente") ou quem mora ali.
export function classificar(bruto) {
  const texto = String(bruto ?? '').replace(/\s+/g, ' ').trim().replace(/\b([Ff])amilia\b/g, '$1amília');
  const n = normalizar(texto);
  if (!n || /^sem dono$/.test(n)) return { situacao: 'sem_dono', texto: '' };
  if (/^sem morador(es)?$/.test(n)) return { situacao: 'sem_dono', texto: '' };
  if (COMERCIO.test(n)) return { situacao: 'comercio', texto };
  return { situacao: 'ocupada', texto };
}

const LADO_ESQUERDO = /^(lado )?(esquerd[oa]|oeste|cima|de cima|norte)$/;
const LADO_DIREITO = /^(lado )?(direit[oa]|leste|baixo|de baixo|sul)$/;

// Lê "Avenida X", "Esquerda", "Casa 02 - Fulano"... Linhas que não entende voltam em "ignoradas".
export function lerLista(texto) {
  const casas = [];
  const ignoradas = [];
  let lado = 'esquerda';
  let via = null;
  for (const bruta of String(texto ?? '').split(/\r?\n/)) {
    const l = bruta.trim();
    if (!l || /^[-–—_=*\s]+$/.test(l)) continue;
    const n = normalizar(l).replace(/[:.]$/, '');
    if (LADO_ESQUERDO.test(n)) { lado = 'esquerda'; continue; }
    if (LADO_DIREITO.test(n)) { lado = 'direita'; continue; }
    const m = l.match(/^casa\s*(?:n[º°o.]*\s*)?(\d+[a-z]?)\s*(?:[-–—:.]\s*)?(.*)$/i);
    if (m) {
      casas.push({ numero: m[1].padStart(2, '0'), lado, ...classificar(m[2]) });
      continue;
    }
    const achada = VIAS_DO_MAPA.find(v => normalizar(v.nome) === n);
    if (achada) { via = achada.id; continue; }
    ignoradas.push(l);
  }
  return { via, casas, ignoradas };
}
