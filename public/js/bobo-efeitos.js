// Pegadinhas do Bobo da Corte na tela de quem caiu (o confete, na tela de todo mundo).
// Tudo dura poucos segundos e some sozinho; nada atrapalha o que a pessoa estava fazendo por muito tempo.

import { h, icone, post, aviso } from './core.js';

const TEXTOS = {
  torta: de => `${de} acertou uma torta de creme bem na sua cara!`,
  ponta: de => `${de} virou o seu mundo de ponta-cabeça!`,
  pum: de => `Você sentou na almofada de pum de ${de}!`,
  nariz: de => `${de} pôs um nariz de palhaço em você! Todo mundo vai ver na sua foto por 30 minutos.`,
  coelhos: de => `${de} soltou uma manada de coelhinhos na sua tela!`,
  confete: de => `${de} jogou confete em todo mundo!`,
};

export function mostrarPegadinha(p) {
  try {
    EFEITOS[p.tipo]?.();
  } catch (e) {
    console.error('Pegadinha:', e);
  }
  cartao(p);
}

// O aviso de quem pregou a peça, com o que a pessoa achou (o Bobo fica sabendo).
function cartao(p) {
  const caixa = document.getElementById('toasts');
  if (!caixa) return;
  const texto = (TEXTOS[p.tipo] || (de => `${de} pregou uma peça em você!`))(`${p.de.nome} (Bobo da Corte)`);
  const reagir = reacao => async () => {
    el.remove();
    try { await post(`/api/bobo/pegadinhas/${p.id}/reacao`, { reacao }); } catch (e) { aviso(e.message, 'erro'); }
  };
  const el = h('div', { class: 'toast chamada chamada-bobo', role: 'status' },
    icone('bobo'),
    h('div', { class: 'chamada-texto' },
      h('span', null, texto),
      p.tipo !== 'confete' && h('div', { class: 'bobo-reacoes' },
        h('button', { class: 'btn btn-ouro btn-pequeno', type: 'button', onclick: reagir('riu') }, 'Kkkk, essa foi boa!'),
        h('button', { class: 'btn btn-pequeno', type: 'button', onclick: reagir('vinganca') }, 'Vou me vingar!'))),
    h('button', { class: 'chamada-fechar', type: 'button', 'aria-label': 'Fechar', onclick: () => el.remove() }, icone('x')));
  caixa.append(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, 15_000);
}

// Os efeitos sozinhos (ex.: o confete do modo festa nos joguinhos).
export function efeito(tipo) {
  EFEITOS[tipo]?.();
}

const camada = (classe, filhos, ms) => {
  const el = h('div', { class: `bobo-camada ${classe}`, 'aria-hidden': 'true' }, filhos);
  document.body.append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
};
const sorte = (a, b) => a + Math.random() * (b - a);
// Contorno de respingo: uma estrela torta com pontas de tamanhos diferentes.
function forma() {
  const n = 28;
  const pontos = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? sorte(36, 43) : sorte(44, 50);
    return `${(50 + Math.cos(a) * r).toFixed(1)}% ${(50 + Math.sin(a) * r).toFixed(1)}%`;
  });
  return `polygon(${pontos.join(', ')})`;
}

const EFEITOS = {
  // A torta gruda na tela; três cliques (ou toques) limpam.
  torta() {
    let limpezas = 0;
    // Um respingo grande no meio (com pedaços da massa e creme escorrendo) e outros menores em volta.
    const respingo = (x, y, tam, atraso, grande = false) => h('span', {
      class: `bobo-gota ${grande ? 'grande' : ''}`.trim(),
      style: { left: `${x}%`, top: `${y}%`, '--tam': `${tam}px`, animationDelay: `${atraso}s`, clipPath: forma() },
    });
    const escorridos = Array.from({ length: 5 }, (_, i) => h('span', { class: 'bobo-escorre', style: { left: `calc(50% + ${(i - 2) * sorte(28, 44)}px)`, top: `calc(50% + ${sorte(40, 90)}px)`, animationDelay: `${0.4 + i * 0.15}s`, '--alto': `${sorte(60, 150)}px` } }));
    const massa = Array.from({ length: 7 }, () => h('span', { class: 'bobo-massa', style: { left: `calc(50% + ${sorte(-150, 150)}px)`, top: `calc(50% + ${sorte(-120, 120)}px)`, transform: `rotate(${sorte(0, 360)}deg)` } }));
    const gotas = [respingo(50, 50, Math.min(innerWidth, innerHeight) * 0.62, 0, true),
      ...Array.from({ length: 10 }, () => respingo(sorte(8, 92), sorte(10, 90), sorte(40, 120), sorte(0.05, 0.3)))];
    const el = camada('bobo-torta', [...gotas, ...escorridos, ...massa, h('p', { class: 'bobo-limpe' }, 'Limpe a tela! (clique 3 vezes)')]);
    el.style.pointerEvents = 'auto';
    const limpar = () => {
      limpezas++;
      el.style.setProperty('--limpo', limpezas / 3);
      if (limpezas >= 3) { el.classList.add('saindo'); setTimeout(() => el.remove(), 400); }
    };
    el.addEventListener('click', limpar);
    setTimeout(() => { if (el.isConnected) { el.classList.add('saindo'); setTimeout(() => el.remove(), 400); } }, 14_000);
  },

  // O site vira de ponta-cabeça por 8 segundos (os avisos ficam de pé, para dar para desvirar).
  ponta() {
    const app = document.getElementById('app');
    if (!app) return;
    // Gira em volta do meio da tela (não do meio da página inteira), sem barra de rolagem de lado.
    app.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
    document.documentElement.classList.add('bobo-girando');
    app.classList.add('bobo-ponta');
    setTimeout(() => app.classList.remove('bobo-ponta'), 8000);
    setTimeout(() => { document.documentElement.classList.remove('bobo-girando'); app.style.transformOrigin = ''; }, 9000);
  },

  // Barulho de almofada de pum, uma nuvenzinha e a tela tremendo.
  pum() {
    somDePum();
    camada('bobo-pum', h('span', { class: 'bobo-nuvem' }, icone('pum')), 2600);
    const app = document.getElementById('app');
    app?.classList.remove('bobo-tremer');
    void app?.offsetWidth;
    app?.classList.add('bobo-tremer');
    setTimeout(() => app?.classList.remove('bobo-tremer'), 700);
  },

  // Um narizão quica no meio da tela (o nariz de verdade aparece na foto).
  nariz() {
    camada('bobo-nariz', h('span', { class: 'bobo-narizao' }), 2200);
  },

  // Coelhinhos pulando de um lado ao outro.
  coelhos() {
    const coelhos = Array.from({ length: 14 }, (_, i) => h('span', {
      class: 'bobo-coelho',
      style: { top: `${sorte(12, 82)}%`, animationDelay: `${(i * 0.18 + sorte(0, 0.3)).toFixed(2)}s`, animationDuration: `${sorte(2.6, 4).toFixed(2)}s`, '--tam': `${sorte(38, 72)}px` },
    }, icone('coelho')));
    camada('bobo-coelhos', coelhos, 6800);
  },

  // Confete caindo na tela de todo mundo.
  confete() {
    const cores = ['#d8b13a', '#d8674a', '#5aa0d8', '#b77be6', '#7fb069', '#e48ab8', '#f4dd80'];
    const pedacos = Array.from({ length: 110 }, () => h('span', {
      class: 'bobo-confete',
      style: { left: `${sorte(0, 100)}%`, background: cores[Math.floor(Math.random() * cores.length)], animationDelay: `${sorte(0, 1.6).toFixed(2)}s`, animationDuration: `${sorte(2.4, 4.2).toFixed(2)}s`, '--giro': `${sorte(-720, 720).toFixed(0)}deg`, '--vento': `${sorte(-80, 80).toFixed(0)}px` },
    }));
    camada('bobo-confetes', pedacos, 6500);
  },
};

// Pfffrrrt: ruído com um filtro que treme e um tom grave descendo (sem arquivo de som).
function somDePum() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    const dur = 0.85;
    const ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 320;
    filtro.Q.value = 9;
    const tremor = ctx.createOscillator();
    tremor.frequency.setValueAtTime(34, t);
    tremor.frequency.linearRampToValueAtTime(18, t + dur);
    const forca = ctx.createGain();
    forca.gain.value = 160;
    tremor.connect(forca).connect(filtro.frequency);
    const tom = ctx.createOscillator();
    tom.type = 'sawtooth';
    tom.frequency.setValueAtTime(120, t);
    tom.frequency.exponentialRampToValueAtTime(52, t + dur);
    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
    volume.gain.setValueAtTime(0.35, t + dur * 0.6);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    fonte.connect(filtro);
    tom.connect(filtro);
    filtro.connect(volume).connect(ctx.destination);
    for (const n of [fonte, tremor, tom]) { n.start(t); n.stop(t + dur); }
    setTimeout(() => ctx.close(), (dur + 0.3) * 1000);
  } catch {
    // sem som, a pegadinha continua engraçada
  }
}
