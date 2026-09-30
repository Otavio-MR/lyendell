// Trilha sonora: o player do canto da tela, que continua tocando enquanto a pessoa navega pelo site.
// As músicas são arquivos enviados para o próprio site (grátis e sem conta em lugar nenhum).
// Nos três pontinhos ficam a lista de músicas e, para quem cuida da trilha, adicionar e tirar músicas.

import { get, api, del, h, trocar, icone, aviso, confirmar } from './core.js';

const CHAVE = 'lyendell-trilha';
const TAMANHO_MAX = 8 * 1024 * 1024;
const ACEITA = 'audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/webm,.mp3,.ogg,.m4a,.webm,.opus';
const audio = new Audio();
audio.preload = 'none';

export const trilha = {
  fila: [],
  atual: -1,
  tocando: false,
  carregando: false,
  volume: 0.5,
  mudo: false,
  aleatorio: false,
  mini: false,       // player recolhido numa bolinha
  podeGerenciar: false,
  enviando: null,    // texto do envio em andamento ("Enviando 2 de 3...")
};

const ouvintes = new Set();
export function ouvirTrilha(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
const avisar = () => ouvintes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

function lerPreferencias() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; }
}
function salvarPreferencias() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      volume: trilha.volume, mudo: trilha.mudo, aleatorio: trilha.aleatorio, mini: trilha.mini, musica: trilha.fila[trilha.atual]?.id ?? null,
    }));
  } catch {}
}

const pref = lerPreferencias();
trilha.volume = typeof pref.volume === 'number' ? pref.volume : 0.5;
trilha.mudo = !!pref.mudo;
trilha.aleatorio = !!pref.aleatorio;
// No celular o player começa recolhido para não cobrir a tela.
trilha.mini = typeof pref.mini === 'boolean' ? pref.mini : matchMedia('(max-width: 640px)').matches;
audio.volume = trilha.volume;
audio.muted = trilha.mudo;

export async function carregarTrilha() {
  let dados;
  try { dados = await get('/api/trilha'); } catch { return; }
  const tocandoAntes = trilha.fila[trilha.atual]?.id;
  trilha.fila = dados.musicas;
  trilha.podeGerenciar = dados.podeGerenciar;
  const procurar = tocandoAntes ?? pref.musica;
  const i = trilha.fila.findIndex(m => m.id === procurar);
  trilha.atual = i >= 0 ? i : (trilha.fila.length ? 0 : -1);
  avisar();
}

export const musicaAtual = () => trilha.fila[trilha.atual] || null;

function carregarMusica(i) {
  trilha.atual = i;
  const m = musicaAtual();
  if (!m) return;
  audio.src = m.url;
  salvarPreferencias();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: m.titulo, artist: m.autor || 'Trilha de Lyendell', album: 'Casa Luckham',
      artwork: [{ src: '/img/brasao.png', sizes: '512x512', type: 'image/png' }],
    });
  }
}

export async function tocar(i = trilha.atual) {
  if (!trilha.fila.length) return;
  if (i < 0) i = 0;
  if (i !== trilha.atual || !audio.src) carregarMusica(i);
  trilha.carregando = true;
  avisar();
  try {
    await audio.play();
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('Não tocou:', e.message);
  } finally {
    trilha.carregando = false;
    avisar();
  }
}

export function pausar() { audio.pause(); }
export function alternar() { if (audio.paused) tocar(); else pausar(); }

function sortearOutra() {
  if (trilha.fila.length < 2) return trilha.atual;
  let i;
  do i = Math.floor(Math.random() * trilha.fila.length); while (i === trilha.atual);
  return i;
}

export function proxima() {
  if (!trilha.fila.length) return;
  tocar(trilha.aleatorio ? sortearOutra() : (trilha.atual + 1) % trilha.fila.length);
}
export function anterior() {
  if (!trilha.fila.length) return;
  if (audio.currentTime > 4) { audio.currentTime = 0; return; } // como nos players: volta ao começo primeiro
  tocar((trilha.atual - 1 + trilha.fila.length) % trilha.fila.length);
}
export function definirVolume(v) {
  trilha.volume = Math.max(0, Math.min(1, v));
  audio.volume = trilha.volume;
  if (trilha.volume > 0 && trilha.mudo) { trilha.mudo = false; audio.muted = false; }
  salvarPreferencias();
  avisar();
}
export function alternarMudo() {
  trilha.mudo = !trilha.mudo;
  audio.muted = trilha.mudo;
  salvarPreferencias();
  avisar();
}
export function alternarAleatorio() {
  trilha.aleatorio = !trilha.aleatorio;
  salvarPreferencias();
  avisar();
}
function recolher(mini) {
  trilha.mini = mini;
  salvarPreferencias();
  avisar();
}
function esvaziarAudio() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load(); // o load() descarta o evento 'pause' que estava na fila, então o estado muda aqui mesmo
  trilha.tocando = false;
  trilha.carregando = false;
  avisar();
}
// Ao sair da conta: para a música e tira o player da tela.
export function pararTudo() {
  esvaziarAudio();
  desmontar?.();
  desmontar = null;
}

let errosSeguidos = 0;
audio.addEventListener('play', () => { trilha.tocando = true; avisar(); });
audio.addEventListener('pause', () => { trilha.tocando = false; avisar(); });
audio.addEventListener('playing', () => { errosSeguidos = 0; });
audio.addEventListener('ended', proxima);
// Música que não abre: pula para a próxima, sem ficar em volta se todas falharem.
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  errosSeguidos++;
  if (errosSeguidos < trilha.fila.length) proxima();
  else { trilha.tocando = false; avisar(); }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => tocar());
  navigator.mediaSession.setActionHandler('pause', pausar);
  navigator.mediaSession.setActionHandler('nexttrack', proxima);
  navigator.mediaSession.setActionHandler('previoustrack', anterior);
}

/* ─── Adicionar e tirar músicas ───────────────────── */

async function adicionar(arquivos) {
  let certas = 0;
  for (const [n, arq] of arquivos.entries()) {
    if (arq.size > TAMANHO_MAX) {
      aviso(`"${arq.name}" passa de 8 MB. Tente uma versão menor (128 kbps já fica bom).`, 'erro');
      continue;
    }
    trilha.enviando = arquivos.length > 1 ? `Enviando ${n + 1} de ${arquivos.length}...` : 'Enviando...';
    avisar();
    const fd = new FormData();
    fd.append('arquivo', arq);
    try {
      await api('POST', '/api/trilha/arquivo', fd);
      certas++;
    } catch (e) {
      aviso(`"${arq.name}": ${e.message}`, 'erro');
    }
  }
  trilha.enviando = null;
  await carregarTrilha();
  if (certas) aviso(certas === 1 ? 'Música adicionada à trilha.' : `${certas} músicas adicionadas à trilha.`);
}

async function remover(m) {
  if (!await confirmar(`Tirar "${m.titulo}" da trilha sonora? O arquivo também é apagado do site.`, { ok: 'Tirar', perigo: true })) return;
  const eraAtual = musicaAtual()?.id === m.id;
  const tocava = eraAtual && trilha.tocando;
  const posicao = trilha.atual;
  try {
    await del(`/api/trilha/${m.id}`);
  } catch (e) {
    aviso(e.message, 'erro');
    return;
  }
  if (eraAtual) esvaziarAudio();
  await carregarTrilha();
  // Tirou a que estava tocando: segue para a que ficou no lugar dela.
  if (eraAtual) {
    trilha.atual = trilha.fila.length ? Math.min(posicao, trilha.fila.length - 1) : -1;
    if (tocava) tocar(trilha.atual);
    else avisar();
  }
  aviso('Música tirada da trilha.');
}

/* ─── O player do canto da tela ───────────────────── */

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let barraTempo = null;
let desmontar = null;

function atualizarTempo() {
  if (!barraTempo || document.activeElement === barraTempo) return;
  const d = audio.duration;
  const ok = Number.isFinite(d) && d > 0;
  barraTempo.value = ok ? String(Math.round((audio.currentTime / d) * 1000)) : '0';
  barraTempo.style.setProperty('--p', ok ? `${(audio.currentTime / d) * 100}%` : '0%');
  barraTempo.title = ok ? `${mmss(audio.currentTime)} de ${mmss(d)}` : '';
}
audio.addEventListener('timeupdate', atualizarTempo);
audio.addEventListener('loadedmetadata', atualizarTempo);
audio.addEventListener('emptied', atualizarTempo);

export function radioDoCanto() {
  desmontar?.();
  let menuAberto = false;
  const el = h('div', { class: 'radio', role: 'region', 'aria-label': 'Trilha sonora', hidden: true });

  const escolher = h('input', {
    type: 'file', accept: ACEITA, multiple: true, hidden: true,
    onchange: e => {
      const arquivos = [...e.target.files];
      e.target.value = '';
      if (arquivos.length) adicionar(arquivos);
    },
  });
  // Soltar o controle devolve o teclado para a tela (as setas dos jogos não mexem no volume).
  const volume = h('input', {
    class: 'radio-volume', type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Volume',
    oninput: e => definirVolume(Number(e.target.value)),
    onchange: e => e.target.blur(),
  });
  barraTempo = h('input', {
    class: 'radio-tempo', type: 'range', min: '0', max: '1000', step: '1', value: '0', 'aria-label': 'Posição na música',
    oninput: e => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
      e.target.style.setProperty('--p', `${Number(e.target.value) / 10}%`);
    },
    onchange: e => { e.target.blur(); atualizarTempo(); },
  });

  const botao = (ic, rotulo, onclick, classe = '') =>
    h('button', { class: `btn-icone ${classe}`.trim(), type: 'button', title: rotulo, 'aria-label': rotulo, onclick }, ic);
  const disco = () => h('span', { class: `radio-disco ${trilha.tocando ? 'girando' : ''}`.trim() }, icone('musica'));

  function linha(m, i) {
    const atual = i === trilha.atual;
    return h('li', { class: `radio-item ${atual ? 'atual' : ''}`.trim() },
      h('button', { class: 'radio-item-tocar', type: 'button', title: `Tocar "${m.titulo}"`, onclick: () => tocar(i) },
        icone(atual && trilha.tocando ? 'volume' : 'play'),
        h('span', null, h('strong', null, m.titulo), m.autor && h('small', null, m.autor))),
      trilha.podeGerenciar && botao(icone('lixo'), `Tirar "${m.titulo}" da trilha`, () => remover(m), 'perigo'));
  }

  function menu() {
    const n = trilha.fila.length;
    return h('div', { class: 'radio-menu' },
      h('div', { class: 'radio-menu-cab' },
        h('strong', null, 'Músicas'),
        n > 0 && h('small', null, `${n} ${n === 1 ? 'música' : 'músicas'}`)),
      n
        ? h('ol', { class: 'radio-lista' }, trilha.fila.map(linha))
        : h('p', { class: 'radio-menu-vazio' }, trilha.podeGerenciar ? 'Nenhuma música ainda. Adicione a primeira!' : 'Nenhuma música ainda.'),
      trilha.podeGerenciar && h('div', { class: 'radio-menu-pe' },
        h('button', { class: 'btn btn-ouro btn-pequeno', type: 'button', disabled: !!trilha.enviando, onclick: () => escolher.click() },
          trilha.enviando ? h('span', { class: 'giro giro-p' }) : icone('mais'),
          h('span', null, trilha.enviando || 'Adicionar música')),
        h('small', null, 'Arquivo MP3, OGG, M4A ou WEBM, até 8 MB cada. Dá para escolher várias de uma vez.')));
  }

  function desenhar() {
    const m = musicaAtual();
    const vazia = !trilha.fila.length;
    el.hidden = vazia && !trilha.podeGerenciar; // sem música e sem poder adicionar, não há o que mostrar
    el.classList.toggle('mini', trilha.mini);
    document.body.classList.toggle('com-radio', !el.hidden);
    document.body.classList.toggle('radio-mini', !el.hidden && trilha.mini);
    volume.value = String(trilha.mudo ? 0 : trilha.volume);

    if (trilha.mini) {
      menuAberto = false;
      trocar(el,
        h('button', {
          class: 'radio-bolinha', type: 'button', 'aria-label': 'Abrir o player da trilha sonora',
          title: m ? `${trilha.tocando ? 'Tocando' : 'Trilha sonora'}: ${m.titulo}` : 'Trilha sonora', onclick: () => recolher(false),
        }, disco()),
        escolher);
      return;
    }

    const rolagem = el.querySelector('.radio-lista')?.scrollTop || 0; // a lista não volta ao topo ao trocar de música
    const subtitulo = trilha.enviando
      || (vazia ? 'Nenhuma música ainda' : [m?.autor, `${trilha.atual + 1} de ${trilha.fila.length}`].filter(Boolean).join(' · '));
    trocar(el,
      menuAberto && menu(),
      h('div', { class: 'radio-cab' },
        disco(),
        h('div', { class: 'radio-texto' },
          h('strong', { title: m?.titulo || '' }, m?.titulo || 'Trilha sonora'),
          h('small', null, subtitulo)),
        h('button', {
          class: `btn-icone radio-pontos ${menuAberto ? 'ativo' : ''}`.trim(), type: 'button',
          title: trilha.podeGerenciar ? 'Músicas (adicionar e tirar)' : 'Músicas', 'aria-label': 'Músicas', 'aria-expanded': String(menuAberto),
          onclick: () => { menuAberto = !menuAberto; desenhar(); },
        }, icone('pontos')),
        botao(icone('baixo'), 'Recolher o player', () => recolher(true))),
      !vazia && barraTempo,
      !vazia && h('div', { class: 'radio-botoes' },
        botao(icone('anterior'), 'Anterior', anterior),
        botao(trilha.carregando ? h('span', { class: 'giro giro-p' }) : icone(trilha.tocando ? 'pausa' : 'play'),
          trilha.tocando ? 'Pausar' : 'Tocar', alternar, 'radio-play'),
        botao(icone('proxima'), 'Próxima', proxima),
        botao(icone('aleatorio'), trilha.aleatorio ? 'Ordem aleatória (ligada)' : 'Ordem aleatória', alternarAleatorio, trilha.aleatorio ? 'ativo' : ''),
        botao(icone(trilha.mudo ? 'mudo' : 'volume'), trilha.mudo ? 'Ligar o som' : 'Sem som', alternarMudo),
        volume),
      escolher);
    const lista = el.querySelector('.radio-lista');
    if (lista) lista.scrollTop = rolagem;
    atualizarTempo();
  }

  // Clicar fora ou apertar Esc fecha os três pontinhos (a confirmação de tirar música não conta como fora).
  const fora = e => {
    if (!menuAberto || el.contains(e.target) || e.target.closest?.('.modal-fundo')) return;
    menuAberto = false;
    desenhar();
  };
  const esc = e => {
    if (e.key !== 'Escape' || !menuAberto || document.querySelector('.modal-fundo')) return;
    menuAberto = false;
    desenhar();
  };
  document.addEventListener('pointerdown', fora);
  document.addEventListener('keydown', esc);
  const parar = ouvirTrilha(desenhar);
  desmontar = () => {
    parar();
    document.removeEventListener('pointerdown', fora);
    document.removeEventListener('keydown', esc);
    document.body.classList.remove('com-radio', 'radio-mini');
  };
  desenhar();
  return el;
}
