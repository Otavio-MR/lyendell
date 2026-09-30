// Base compartilhada por todas as telas: estado, API, criação de elementos, modais e formatação.

export const estado = { eu: null };

// Coisas que uma tela deixa rodando (relógio de jogo, teclado, conexão) e que param quando se troca de tela.
const limpezas = [];
export function aoSair(fn) { limpezas.push(fn); }
export function limparTela() {
  while (limpezas.length) {
    try { limpezas.pop()(); } catch (e) { console.error(e); }
  }
}
export const pode = p => !!estado.eu && estado.eu.permissoes.includes(p);
export const podeAlgum = (...ps) => ps.some(pode);

/* ─── API ─────────────────────────────────────────── */

export class ErroApi extends Error {
  constructor(mensagem, status) { super(mensagem); this.status = status; }
}

// Versão do site no servidor. Se mudar com a página aberta, o site foi atualizado
// e esta aba ainda roda o código antigo (app.js recarrega na próxima troca de tela).
let versaoDoSite = null;
function conferirVersao(resp) {
  const v = resp.headers.get('x-versao');
  if (!v) return;
  if (!versaoDoSite) versaoDoSite = v;
  else if (v !== versaoDoSite && !estado.novaVersao) {
    estado.novaVersao = true;
    window.dispatchEvent(new Event('nova-versao'));
  }
}

export async function api(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (corpo instanceof FormData) opcoes.body = corpo;
  else if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let resp;
  try { resp = await fetch(url, opcoes); } catch { throw new ErroApi('Sem conexão com o servidor.', 0); }
  conferirVersao(resp);
  const json = (resp.headers.get('content-type') || '').includes('application/json') ? await resp.json() : null;
  if (!resp.ok) {
    if (resp.status === 401 && estado.eu && !url.includes('/auth/')) {
      estado.eu = null;
      window.dispatchEvent(new Event('sessao-expirada'));
    }
    throw new ErroApi(json?.erro || 'Algo deu errado.', resp.status);
  }
  return json;
}
export const get = url => api('GET', url);
export const post = (url, corpo = {}) => api('POST', url, corpo);
export const put = (url, corpo = {}) => api('PUT', url, corpo);
export const patch = (url, corpo = {}) => api('PATCH', url, corpo);
export const del = url => api('DELETE', url);

// Diminui a imagem antes de enviar (lado maior até 1920px, formato WEBP).
// Uma captura de tela do Minecraft cai de vários MB para uns 300 KB. GIF fica como está, por causa da animação.
export async function reduzirImagem(arquivo, { maxLado = 1920, qualidade = 0.85 } = {}) {
  if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return arquivo;
  let imagem;
  try { imagem = await createImageBitmap(arquivo); } catch { return arquivo; }
  const escala = Math.min(1, maxLado / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  tela.getContext('2d').drawImage(imagem, 0, 0, largura, altura);
  imagem.close?.();
  const gerar = tipo => new Promise(ok => tela.toBlob(ok, tipo, qualidade));
  let blob = await gerar('image/webp');
  // Navegador que não gera WEBP: se a original era JPG, gera JPG; senão manda a original.
  if (blob?.type !== 'image/webp') blob = arquivo.type === 'image/jpeg' ? await gerar('image/jpeg') : null;
  if (!blob || blob.size >= arquivo.size) return arquivo;
  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${arquivo.name.replace(/\.\w+$/, '')}.${extensao}`, { type: blob.type });
}

export async function enviarImagem(arquivo) {
  const fd = new FormData();
  fd.append('arquivo', await reduzirImagem(arquivo));
  return (await api('POST', '/api/upload', fd)).url;
}

/* ─── Elementos ───────────────────────────────────── */

// h('div', { class: 'x', onclick: fn }, 'texto', filho, [lista]). Texto sempre entra como texto, nunca como HTML.
export function h(tag, attrs, ...filhos) {
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    filhos.unshift(attrs);
    attrs = null;
  }
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, x] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, x);
          else el.style[p] = x;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  anexar(el, filhos);
  return el;
}

// Troca o conteúdo de um elemento ignorando null/false (o replaceChildren nativo escreveria "null").
export function trocar(el, ...filhos) {
  el.replaceChildren();
  return anexar(el, filhos);
}

export function anexar(el, filhos) {
  for (const f of [filhos].flat(Infinity)) {
    if (f == null || f === false || f === '') continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

const ICONES = {
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  megafone: '<path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 5.5a9 9 0 0 1 0 13"/>',
  tarefas: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8.5 10 1.5 1.5 3-3"/><path d="M14.5 11H16"/><path d="m8.5 16 1.5 1.5 3-3"/><path d="M14.5 17H16"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  pergaminho: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-3"/><path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2h11a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2"/><path d="M9 9h5M9 13h5"/>',
  escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.4c1.8.8 3 2.8 3 5.6"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  chave: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.8-8.8"/><path d="m16 7 3 3"/><path d="m18.5 4.5 2 2"/>',
  livro: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lixo: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  alfinete: '<path d="M12 16v5"/><path d="M8 3h8l-1.5 6 3.5 4v1H6v-1l3.5-4z"/>',
  voltar: '<path d="m15 5-7 7 7 7"/>',
  frente: '<path d="m9 5 7 7-7 7"/>',
  cima: '<path d="m6 15 6-6 6 6"/>',
  pontos: '<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cadeado: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  coroa: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 19h14"/>',
  loja: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v9h13v-9"/><path d="M10 21v-5h4v5"/>',
  documento: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/><path d="M9 12.5h7M9 16.5h7"/>',
  alianca: '<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="m10.5 4.5 1.5-2 1.5 2-1.5 2z"/>',
  grades: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M7.5 3v18M12 3v18M16.5 3v18M3 12h18"/>',
  alvo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  balanca: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 6a3 3 0 0 0 6 0z"/><path d="m19 7-3 6a3 3 0 0 0 6 0z"/>',
  mapa: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  moeda: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9.5v5"/>',
  espada: '<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"/><path d="m6 11.5 6.5 6.5"/><path d="m3 21 3.5-3.5"/>',
  pena: '<path d="M20 4C11 4 6 9 5 19"/><path d="M20 4c0 7-4.5 11.5-12 12"/><path d="M4 21l1-2"/>',
  bandeira: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  bau: '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 12h18"/><path d="M5 8V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V8"/><rect x="10.5" y="10.5" width="3" height="4" rx=".6"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5a3 3 0 0 0 3 4.5M16 5.5h3a3 3 0 0 1-3 4.5"/><path d="M12 13v4M8 21h8M9.5 21v-4h5v4"/>',
  enviar: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  pasta: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2.5h7.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  mao: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5v-6a1.5 1.5 0 0 1 3 0V11"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4.5-2.5 8-7 8-3 0-4.5-1.5-6-4l-1.5-3a1.5 1.5 0 0 1 2.6-1.5L8 15"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  secao: '<path d="M4 6h16M4 12h10M4 18h7"/>',
  baixar: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  jogos: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.8" cy="13.8" r=".9"/>',
  chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  aviao: '<path d="M21 3 3 10.5l7.2 2.8L13 21z"/><path d="m10.2 13.3 4.3-4.3"/>',
  velha: '<path d="M9 4v16M15 4v16M4 9h16M4 15h16"/>',
  peca: '<path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4z"/>',
  cobra: '<path d="M4 17c0-3 3-3 3-6s-3-3-3-6"/><path d="M7 11c3 0 3 6 6 6s3-6 6-6"/><circle cx="19" cy="11" r="1.6"/>',
  pedra: '<path d="M3.5 15.5 6 9l4.5-3.5 5.5 1L20.5 11l-.5 5.5-3.5 3h-10z"/><path d="m10.5 5.5 1.5 5-6-1.5M12 10.5l4.5 1.5 4-1M12 10.5l-1.5 9"/>',
  papel: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/>',
  tesoura: '<circle cx="6" cy="6" r="2.8"/><circle cx="6" cy="18" r="2.8"/><path d="M8.2 7.8 20 19M8.2 16.2 20 5"/>',
  pergunta: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.8v.5"/><path d="M12 17.2v.3"/>',
  coelho: '<path d="M9.5 10.5C7.8 7.6 7.4 3.6 8.8 3.1s2.9 3.2 3 7"/><path d="M14.5 10.5c1.7-2.9 2.1-6.9.7-7.4s-2.9 3.2-3 7"/><circle cx="12" cy="15" r="6"/><path d="M10 14.2v.3M14 14.2v.3M11 17.3c.6.4 1.4.4 2 0"/>',
  fogo: '<path d="M12 3c1 3.5 5 5.6 5 10.2a5 5 0 0 1-10 0c0-2.6 1.2-4.2 2.6-5.2.2 1.9 1 3.1 2.2 3.6C11 9 11 6 12 3z"/>',
  musica: '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  play: '<path d="M7.5 4.8v14.4L19 12z"/>',
  pausa: '<path d="M8.5 5v14M15.5 5v14"/>',
  proxima: '<path d="M6 5.5l9 6.5-9 6.5z"/><path d="M18.5 5v14"/>',
  anterior: '<path d="M18 5.5 9 12l9 6.5z"/><path d="M5.5 5v14"/>',
  volume: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4"/><path d="M19 6.3a8 8 0 0 1 0 11.4"/>',
  mudo: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
  aleatorio: '<path d="M3 7h3.5c2 0 3.3 1 4.5 3l2 4c1.2 2 2.5 3 4.5 3H21"/><path d="M3 17h3.5c1.4 0 2.4-.5 3.3-1.5"/><path d="M14.2 8.5C15.1 7.5 16.1 7 17.5 7H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
  paleta: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-2l-.4-1a1.8 1.8 0 0 1 1.7-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>',
  presente: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3 9h18v-3H3zM12 6v14"/><path d="M12 6c-1-2.5-4.5-3.5-5-1.5S9.5 6 12 6zM12 6c1-2.5 4.5-3.5 5-1.5S14.5 6 12 6z"/>',
};
export const NOMES_ICONES = Object.keys(ICONES);

export function icone(nome, classe = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ico ${classe}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONES[nome] || ICONES.livro;
  return svg;
}

export function botao(texto, { icone: ic, classe = '', onclick, tipo = 'button', titulo, desativado } = {}) {
  return h('button', { class: `btn ${classe}`.trim(), type: tipo, onclick, title: titulo, disabled: desativado },
    ic && icone(ic), texto && h('span', null, texto));
}

export function botaoIcone(ic, rotulo, onclick, classe = '') {
  return h('button', { class: `btn-icone ${classe}`.trim(), type: 'button', title: rotulo, 'aria-label': rotulo, onclick }, icone(ic));
}

export function cabecalho({ titulo, sub, icone: ic, acoes = [], voltar }) {
  return h('header', { class: 'pag-cab' },
    h('div', { class: 'pag-cab-texto' },
      voltar && h('a', { class: 'voltar', href: voltar.href }, icone('voltar'), voltar.texto),
      h('h1', { class: 'pag-titulo' }, ic && h('span', { class: 'pag-icone' }, icone(ic)), titulo),
      sub && h('p', { class: 'pag-sub' }, sub)),
    acoes.filter(Boolean).length ? h('div', { class: 'pag-acoes' }, acoes) : null);
}

export function vazio(titulo, texto, acao) {
  return h('div', { class: 'vazio' },
    h('img', { src: '/img/brasao.png', alt: '', class: 'vazio-brasao' }),
    h('h3', null, titulo),
    texto && h('p', null, texto),
    acao);
}

// Foto de perfil, ou as iniciais do nome quando a pessoa ainda não tem foto.
export function avatar(nome, classe = '', foto = null) {
  return h('span', { class: `avatar ${foto ? 'com-foto' : ''} ${classe}`.replace(/\s+/g, ' ').trim(), 'aria-hidden': 'true' },
    foto ? h('img', { src: foto, alt: '', loading: 'lazy' }) : iniciais(nome));
}

// Foto com a moldura escolhida no perfil (bronze, prata, ouro...). p = { nome, foto, moldura }.
export function avatarPessoa(p, classe = '') {
  const el = avatar(p.nome, classe, p.foto);
  if (p.moldura && p.moldura !== 'simples') el.classList.add('moldura', `moldura-${p.moldura}`);
  return el;
}

// Nível no formato "Nv 5" com o título do coelho no balão.
export function seloNivel(n, classe = '') {
  return h('span', { class: `selo-nivel ${classe}`.trim(), title: `${n.titulo} · ${n.xp} XP` }, `Nv ${n.nivel}`);
}

// Recorta o centro da imagem em quadrado e diminui para foto de perfil (256px, uns poucos KB).
export async function recortarAvatar(arquivo, lado = 256) {
  let imagem;
  try { imagem = await createImageBitmap(arquivo); } catch { throw new Error('Não consegui abrir essa imagem. Tente outra (PNG, JPG ou WEBP).'); }
  const menor = Math.min(imagem.width, imagem.height);
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const g = tela.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(imagem, (imagem.width - menor) / 2, (imagem.height - menor) / 2, menor, menor, 0, 0, lado, lado);
  imagem.close?.();
  const gerar = tipo => new Promise(ok => tela.toBlob(ok, tipo, 0.9));
  let blob = await gerar('image/webp');
  if (blob?.type !== 'image/webp') blob = await gerar('image/png');
  return new File([blob], `perfil.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type });
}

export function chipCargo(c) {
  return h('span', { class: 'chip', style: { '--cor': c.cor } }, c.nome);
}

export function barra(valor, total) {
  const pct = total ? Math.min(100, (valor / total) * 100) : 0;
  return h('div', { class: `barra ${pct >= 100 ? 'completa' : ''}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(valor) },
    h('div', { class: 'barra-cheia', style: { width: `${pct}%` } }));
}

/* ─── Avisos, modais e confirmações ──────────────── */

export function aviso(mensagem, tipo = 'ok') {
  const el = h('div', { class: `toast ${tipo}`, role: 'status' }, icone(tipo === 'erro' ? 'alerta' : 'check'), h('span', null, mensagem));
  document.getElementById('toasts').append(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, tipo === 'erro' ? 5000 : 3200);
}

const pilha = [];
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && pilha.length) pilha[pilha.length - 1].fechar();
});

export function modal({ titulo, corpo, rodape, tamanho = '', classe = '', fecharFora = true, aoFechar } = {}) {
  const fundo = h('div', { class: 'modal-fundo' });
  const caixa = h('div', { class: `modal ${tamanho} ${classe}`.trim(), role: 'dialog', 'aria-modal': 'true' });
  let fechado = false;
  const m = {
    caixa,
    fechar() {
      if (fechado) return;
      fechado = true;
      pilha.splice(pilha.indexOf(m), 1);
      fundo.classList.add('saindo');
      setTimeout(() => fundo.remove(), 160);
      if (!pilha.length) document.body.classList.remove('sem-rolagem');
      aoFechar?.();
    },
  };
  if (titulo) {
    caixa.append(h('header', { class: 'modal-cab' },
      h('h2', null, titulo),
      botaoIcone('x', 'Fechar', () => m.fechar())));
  }
  caixa.append(h('div', { class: 'modal-corpo' }, corpo));
  if (rodape) caixa.append(h('footer', { class: 'modal-rodape' }, rodape));
  fundo.append(caixa);
  if (fecharFora) fundo.addEventListener('mousedown', e => { if (e.target === fundo) m.fechar(); });
  document.body.append(fundo);
  document.body.classList.add('sem-rolagem');
  pilha.push(m);
  setTimeout(() => caixa.querySelector('[autofocus], input:not([type=hidden]):not([type=file]):not([disabled]), textarea, select')?.focus(), 30);
  return m;
}

// Modal com formulário: cuida do botão de enviar, do "carregando" e da mensagem de erro.
// aoEnviar pode devolver false para manter o modal aberto.
let contadorForm = 0;
export function modalForm({ titulo, conteudo, textoOk = 'Salvar', classeOk = 'btn-ouro', tamanho = '', extraRodape, aoEnviar }) {
  const id = `form-${++contadorForm}`;
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const ok = h('button', { class: `btn ${classeOk}`, type: 'submit', form: id }, textoOk);
  const form = h('form', { class: 'form', id, novalidate: true }, conteudo, erroEl);
  const m = modal({
    titulo, tamanho, fecharFora: false, corpo: form,
    rodape: [extraRodape, h('span', { class: 'espaco' }), h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Cancelar'), ok],
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    erroEl.hidden = true;
    ok.disabled = true;
    ok.classList.add('carregando');
    try {
      if ((await aoEnviar(form, m)) !== false) m.fechar();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.hidden = false;
    } finally {
      ok.disabled = false;
      ok.classList.remove('carregando');
    }
  });
  m.mostrarErro = msg => { erroEl.textContent = msg; erroEl.hidden = false; };
  return m;
}

export function confirmar(mensagem, { titulo = 'Tem certeza?', ok = 'Confirmar', perigo = false } = {}) {
  return new Promise(resolve => {
    let resposta = false;
    const m = modal({
      titulo, tamanho: 'pequeno', aoFechar: () => resolve(resposta),
      corpo: h('p', { class: 'confirmar-texto' }, mensagem),
      rodape: [
        h('span', { class: 'espaco' }),
        h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
        h('button', { class: `btn ${perigo ? 'btn-perigo' : 'btn-ouro'}`, type: 'button', autofocus: true, onclick: () => { resposta = true; m.fechar(); } }, ok),
      ],
    });
  });
}

// Executa uma ação da API mostrando o erro num aviso, se houver.
export async function tentar(fn, sucesso) {
  try {
    const r = await fn();
    if (sucesso) aviso(sucesso);
    return r ?? true;
  } catch (e) {
    aviso(e.message, 'erro');
    return null;
  }
}

/* ─── Campos de formulário ────────────────────────── */

export function campo(rotulo, entrada, { ajuda, obrigatorio, classe = '' } = {}) {
  return h('label', { class: `campo ${classe}`.trim() },
    h('span', { class: 'campo-rotulo' }, rotulo, obrigatorio && h('b', { class: 'obrig', title: 'Obrigatório' }, ' *')),
    entrada,
    ajuda && h('small', { class: 'campo-ajuda' }, ajuda));
}

export function interruptor(rotulo, ligado, aoMudar, ajuda) {
  const input = h('input', { type: 'checkbox', checked: ligado, onchange: e => aoMudar?.(e.target.checked) });
  return h('label', { class: 'interruptor' },
    input, h('span', { class: 'interruptor-trilho' }),
    h('span', { class: 'interruptor-texto' }, h('strong', null, rotulo), ajuda && h('small', null, ajuda)));
}

// Entrada de quantidade no estilo Minecraft: pacotes + unidades avulsas.
export function entradaQuantidade({ pacote = 64, inicial = 0, item = 'itens', aoMudar } = {}) {
  const pac = h('input', { class: 'input', type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: '0' });
  const avu = h('input', { class: 'input', type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: '0' });
  const rotuloPac = h('span', { class: 'campo-rotulo' });
  const rotuloAvu = h('span', { class: 'campo-rotulo' });
  const caixaPac = h('label', { class: 'campo' }, rotuloPac, pac);
  const total = h('strong');
  const extra = h('span', { class: 'suave' });
  const el = h('div', { class: 'qtd' },
    h('div', { class: 'qtd-linha' }, caixaPac, h('label', { class: 'campo' }, rotuloAvu, avu)),
    h('p', { class: 'qtd-total' }, 'Total: ', total, extra));
  let tam = pacote;
  let nomeItem = item;
  const valor = () => (tam > 1 ? (parseInt(pac.value, 10) || 0) * tam : 0) + (parseInt(avu.value, 10) || 0);
  const atualizar = () => {
    const v = valor();
    total.textContent = `${num(v)} ${nomeItem}`;
    extra.textContent = tam > 1 && v >= tam ? ` (${pacotes(v, tam)})` : '';
    aoMudar?.(v);
  };
  function definir(v, novoTam = tam) {
    tam = novoTam;
    caixaPac.hidden = tam <= 1;
    rotuloPac.textContent = `Pacotes (de ${tam})`;
    rotuloAvu.textContent = tam > 1 ? 'Unidades avulsas' : 'Quantidade';
    if (tam > 1) {
      pac.value = v >= tam ? Math.floor(v / tam) : '';
      avu.value = v % tam || '';
    } else {
      pac.value = '';
      avu.value = v || '';
    }
    atualizar();
  }
  pac.addEventListener('input', atualizar);
  avu.addEventListener('input', atualizar);
  definir(inicial, pacote);
  return {
    el, valor, definir,
    mudarPacote(novo) { const v = valor(); definir(v, novo); },
    mudarItem(novo) { nomeItem = novo || 'itens'; atualizar(); },
  };
}

/* ─── Formatação ──────────────────────────────────── */

const paraData = s => new Date(String(s).replace(' ', 'T') + (String(s).length <= 10 ? 'T12:00:00' : 'Z'));

export function dataHora(s) {
  if (!s) return '';
  return paraData(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function dataCurta(s) {
  if (!s) return '';
  return paraData(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function relativo(s) {
  if (!s) return '';
  const d = paraData(s);
  const seg = (Date.now() - d.getTime()) / 1000;
  if (seg < 60) return 'agora mesmo';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 172800) return 'ontem';
  if (seg < 604800) return `há ${Math.floor(seg / 86400)} dias`;
  return dataCurta(s);
}

export const num = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const diaNumero = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const dias = n => `${n} ${n === 1 ? 'dia' : 'dias'}`;

// Campo "tempo entre duas datas" (ex.: pena entre a prisão e a soltura prevista).
// relativo: acrescenta quanto falta ou se já foi cumprida, contando a partir de hoje.
export function textoDuracao(c, dados, { relativo = true } = {}) {
  const ini = dados?.[c.inicio];
  const fim = dados?.[c.fim];
  if (!ini) return '';
  if (!fim) return 'Sem data prevista';
  const total = diaNumero(fim) - diaNumero(ini);
  const base = total <= 0 ? 'Menos de 1 dia' : dias(total);
  if (!relativo) return base;
  const hoje = diaNumero(hojeIso());
  if (hoje > diaNumero(fim)) return `${base} · cumprida`;
  if (hoje === diaNumero(fim)) return `${base} · termina hoje`;
  if (hoje >= diaNumero(ini)) return `${base} · faltam ${dias(diaNumero(fim) - hoje)}`;
  return base;
}

// Valor de um campo "Escolher de outro livro": um nome ou uma lista de nomes.
export const listaDeNomes = v => (Array.isArray(v) ? v : v ? [v] : []);

export function pacotes(n, tam = 64) {
  if (!tam || tam <= 1 || n < tam) return '';
  const p = Math.floor(n / tam);
  const r = n % tam;
  return `${p} pacote${p > 1 ? 's' : ''}${r ? ` e ${r}` : ''}`;
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return ((partes[0][0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function cargoPrincipal(u) {
  if (u.is_root) return 'Administrador';
  return u.cargos?.[0]?.nome || 'Morador';
}
