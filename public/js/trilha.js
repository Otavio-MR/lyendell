// Trilha sonora: um rádio que continua tocando enquanto a pessoa navega pelo site.
// As músicas enviadas (ou links diretos de áudio) tocam aqui; playlists do Spotify e do YouTube
// abrem numa janelinha com o player oficial deles.

import { get, h, trocar, icone } from './core.js';

const CHAVE = 'lyendell-trilha';
const audio = new Audio();
audio.preload = 'none';

export const trilha = {
  fila: [],       // músicas que o rádio toca (arquivos e links diretos)
  externas: [],   // playlists do Spotify e do YouTube
  atual: -1,
  tocando: false,
  carregando: false,
  volume: 0.5,
  mudo: false,
  aleatorio: false,
  podeGerenciar: false,
  externaAberta: null,
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
      volume: trilha.volume, mudo: trilha.mudo, aleatorio: trilha.aleatorio, musica: trilha.fila[trilha.atual]?.id ?? null,
    }));
  } catch {}
}

const pref = lerPreferencias();
trilha.volume = typeof pref.volume === 'number' ? pref.volume : 0.5;
trilha.mudo = !!pref.mudo;
trilha.aleatorio = !!pref.aleatorio;
audio.volume = trilha.volume;
audio.muted = trilha.mudo;

export async function carregarTrilha() {
  let dados;
  try { dados = await get('/api/trilha'); } catch { return; }
  const tocandoAntes = trilha.fila[trilha.atual]?.id;
  trilha.fila = dados.musicas.filter(m => m.tipo === 'arquivo' || m.tipo === 'link');
  trilha.externas = dados.musicas.filter(m => m.tipo === 'spotify' || m.tipo === 'youtube');
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
  fecharExterna(); // duas músicas ao mesmo tempo não dá
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
export function pararTudo() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  fecharExterna();
}

let errosSeguidos = 0;
audio.addEventListener('play', () => { trilha.tocando = true; avisar(); });
audio.addEventListener('pause', () => { trilha.tocando = false; avisar(); });
audio.addEventListener('playing', () => { errosSeguidos = 0; });
audio.addEventListener('ended', proxima);
// Música que não abre (link quebrado): pula para a próxima, sem ficar em volta se todas falharem.
audio.addEventListener('error', () => {
  if (!audio.src) return;
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

/* ─── Playlists do Spotify e do YouTube (janelinha) ─── */

export function enderecoExterno(m) {
  if (m.tipo === 'spotify') return `https://open.spotify.com/embed/${m.url}?utm_source=generator&theme=0`;
  if (m.url.startsWith('list:')) return `https://www.youtube-nocookie.com/embed/videoseries?list=${m.url.slice(5)}&autoplay=1`;
  return `https://www.youtube-nocookie.com/embed/${m.url.slice(2)}?autoplay=1`;
}
export function linkOriginal(m) {
  if (m.tipo === 'spotify') return `https://open.spotify.com/${m.url}`;
  if (m.url.startsWith('list:')) return `https://www.youtube.com/playlist?list=${m.url.slice(5)}`;
  return `https://www.youtube.com/watch?v=${m.url.slice(2)}`;
}

export function abrirExterna(m) {
  pausar();
  fecharExterna();
  const janela = h('div', { id: 'radio-externa', class: `radio-externa ${m.tipo}`, role: 'dialog', 'aria-label': m.titulo },
    h('div', { class: 'radio-externa-cab' },
      icone('musica'),
      h('strong', null, m.titulo),
      h('button', { class: 'btn-icone', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: fecharExterna }, icone('x'))),
    h('iframe', {
      src: enderecoExterno(m), title: m.titulo, loading: 'lazy',
      allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
      referrerpolicy: 'strict-origin-when-cross-origin',
    }));
  document.body.append(janela);
  trilha.externaAberta = m.id;
  avisar();
}

export function fecharExterna() {
  const j = document.getElementById('radio-externa');
  if (!j) return;
  j.remove();
  trilha.externaAberta = null;
  avisar();
}

/* ─── O player da barra lateral ───────────────────── */

export function painelTrilha() {
  const el = h('div', { class: 'player', 'aria-label': 'Trilha sonora' });
  const volume = h('input', {
    class: 'player-volume', type: 'range', min: '0', max: '1', step: '0.05', value: String(trilha.volume), 'aria-label': 'Volume',
    oninput: e => definirVolume(Number(e.target.value)),
  });

  function desenhar() {
    const m = musicaAtual();
    volume.value = String(trilha.mudo ? 0 : trilha.volume);
    if (!trilha.fila.length) {
      const primeira = trilha.externas[0];
      trocar(el,
        h('a', { class: 'player-titulo', href: '#/trilha' }, icone('musica'), h('span', null, 'Trilha sonora')),
        primeira
          ? h('button', { class: 'btn btn-pequeno player-externa', type: 'button', onclick: () => (trilha.externaAberta ? fecharExterna() : abrirExterna(primeira)) },
            icone(trilha.externaAberta ? 'x' : 'play'), h('span', null, trilha.externaAberta ? 'Fechar a playlist' : 'Ouvir a playlist'))
          : h('small', { class: 'suave' }, 'Ainda sem músicas.'));
      return;
    }
    trocar(el,
      h('a', { class: 'player-titulo', href: '#/trilha', title: 'Abrir a trilha sonora' },
        h('span', { class: `player-disco ${trilha.tocando ? 'girando' : ''}`.trim() }, icone('musica')),
        h('span', { class: 'player-texto' },
          h('strong', null, m?.titulo || 'Trilha sonora'),
          h('small', null, trilha.tocando ? (m?.autor || 'Tocando') : 'Trilha de Lyendell'))),
      h('div', { class: 'player-botoes' },
        h('button', { class: 'btn-icone', type: 'button', title: 'Anterior', 'aria-label': 'Anterior', onclick: anterior }, icone('anterior')),
        h('button', { class: 'btn-icone player-play', type: 'button', title: trilha.tocando ? 'Pausar' : 'Tocar', 'aria-label': trilha.tocando ? 'Pausar' : 'Tocar', onclick: alternar },
          trilha.carregando ? h('span', { class: 'giro giro-p' }) : icone(trilha.tocando ? 'pausa' : 'play')),
        h('button', { class: 'btn-icone', type: 'button', title: 'Próxima', 'aria-label': 'Próxima', onclick: proxima }, icone('proxima')),
        h('button', { class: `btn-icone ${trilha.aleatorio ? 'ativo' : ''}`.trim(), type: 'button', title: 'Ordem aleatória', 'aria-label': 'Ordem aleatória', onclick: alternarAleatorio }, icone('aleatorio')),
        h('button', { class: 'btn-icone', type: 'button', title: trilha.mudo ? 'Ligar o som' : 'Sem som', 'aria-label': 'Sem som', onclick: alternarMudo }, icone(trilha.mudo ? 'mudo' : 'volume'))),
      volume);
  }
  ouvirTrilha(desenhar);
  desenhar();
  return el;
}

// Botão pequeno do topo (celular): toca e pausa.
export function botaoTrilhaTopo() {
  const b = h('button', { class: 'btn-icone topo-musica', type: 'button', 'aria-label': 'Trilha sonora' });
  const desenhar = () => {
    b.classList.toggle('ativo', trilha.tocando);
    b.title = trilha.tocando ? 'Pausar a trilha' : 'Tocar a trilha';
    trocar(b, icone(trilha.tocando ? 'pausa' : 'musica'));
  };
  b.addEventListener('click', () => {
    if (trilha.fila.length) alternar();
    else location.hash = '#/trilha';
  });
  ouvirTrilha(desenhar);
  desenhar();
  return b;
}
