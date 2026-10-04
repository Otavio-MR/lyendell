// Sprites dos jogos: as imagens que a Família Nobre envia em #/recreacao/sprites para trocar os desenhos
// feitos por código. Cada peça (ex.: "barris.barril") tem animações (ex.: "rolando"), e cada animação é
// uma imagem com os quadros lado a lado, da esquerda para a direita.
//
// Nos jogos:  if (!desenharSprite(g, 'barris.barril', 'rolando', x, y, { t })) { ...desenho de sempre... }
// Sem sprite enviado (ou ainda carregando), desenharSprite devolve false e o jogo desenha como antes.
//
// Cada jogo descreve as suas peças numa lista SPRITES (chave, nome, tamanho no jogo, âncora, animações e uma
// prévia com o desenho de sempre) e chama registrarPecas(SPRITES). A tela de sprites mostra essas listas.
// Não mexe na página quando é importado: dá para importar nos testes do Node (lá nunca há sprite).

const PECAS = new Map(); // chave da peça -> { chave, nome, largura, altura, ancora, animacoes: [{ id, nome, quadros, fps }] }
let enviados = {};       // "peca.animacao" -> { src, quadros, fps, tingir, suave, img }
let pedido = null;
const ouvintes = new Set();
const noNavegador = typeof document !== 'undefined' && typeof Image !== 'undefined';

export function registrarPecas(lista) {
  for (const p of lista || []) PECAS.set(p.chave, p);
}
export const pecaDe = chave => PECAS.get(chave) || null;
export const todasAsPecas = () => [...PECAS.values()];

// Busca no servidor o que já foi enviado (uma vez; "forcar" busca de novo, quando alguém troca um sprite).
export function carregarSprites(forcar = false) {
  if (!noNavegador) return Promise.resolve({});
  if (pedido && !forcar) return pedido;
  pedido = fetch('/api/sprites', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : { sprites: {} }))
    .then(({ sprites = {}, podeEditar = false }) => {
      const novos = {};
      for (const [chave, s] of Object.entries(sprites)) {
        const velho = enviados[chave];
        const img = velho && velho.src === s.src ? velho.img : new Image();
        if (img.src !== new URL(s.src, location.href).href) {
          img.onload = () => avisar();
          img.src = s.src;
        }
        novos[chave] = { ...s, img };
      }
      enviados = novos;
      cacheTinta.clear();
      avisar();
      return { sprites: enviados, podeEditar };
    })
    .catch(() => { pedido = null; return { sprites: enviados, podeEditar: false }; });
  return pedido;
}

// Avisa quem quiser saber (a tela de sprites, o fundo já desenhado de algum jogo...).
export function aoMudarSprites(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function avisar() { for (const fn of ouvintes) try { fn(); } catch { /* quem ouve se vira */ } }

// Liga o aviso ao vivo: quando alguém troca um sprite, todos recarregam (chamado uma vez pelo app).
export function ligarSpritesAoVivo(ouvir) {
  ouvir('sprites', () => carregarSprites(true));
}

const pronto = s => s && s.img && s.img.complete && s.img.naturalWidth > 0;

// O sprite de uma animação, já carregado (ou null). Sem a animação pedida, usa a primeira da peça que tiver.
export function spriteDe(chave, anim) {
  if (noNavegador && !pedido) carregarSprites();
  const s = enviados[anim ? `${chave}.${anim}` : chave];
  if (pronto(s)) return s;
  const p = PECAS.get(chave);
  if (p) for (const a of p.animacoes || []) { const x = enviados[`${chave}.${a.id}`]; if (pronto(x)) return x; }
  return null;
}
export const temSprite = (chave, anim) => !!spriteDe(chave, anim);

// Sprite pintado com uma cor (o pelo de cada jogador): as partes claras pegam a cor, o contorno escuro fica.
const cacheTinta = new Map();
function tingido(s, cor) {
  const chave = `${s.src}|${cor}`;
  let c = cacheTinta.get(chave);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = s.img.naturalWidth;
  c.height = s.img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = cor;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(s.img, 0, 0);
  if (cacheTinta.size > 200) cacheTinta.clear();
  cacheTinta.set(chave, c);
  return c;
}

// Desenha um quadro do sprite com o pé (ou o centro) em x, y. Devolve false se não há sprite (o jogo desenha o de sempre).
// opcoes: t (segundos, para animar), quadro (fixo), progresso (0 a 1, para animação que acontece uma vez),
//         dir (1 ou -1, vira para a esquerda), rot (radianos), escala, largura/altura (no lugar das da peça),
//         alpha, cor (pinta, se o sprite foi enviado com "pintar com a cor do jogador").
export function desenharSprite(g, chave, anim, x, y, o = {}) {
  const s = spriteDe(chave, anim);
  if (!s) return false;
  const p = PECAS.get(chave) || {};
  const quadros = Math.max(1, s.quadros || 1);
  let q;
  if (Number.isInteger(o.quadro)) q = ((o.quadro % quadros) + quadros) % quadros;
  else if (o.progresso != null) q = Math.min(quadros - 1, Math.max(0, Math.floor(o.progresso * quadros)));
  else q = Math.floor((o.t ?? performance.now() / 1000) * (s.fps || 8)) % quadros;
  const fw = s.img.naturalWidth / quadros;
  const fh = s.img.naturalHeight;
  const escala = o.escala ?? 1;
  const caixaL = (o.largura ?? p.largura ?? fw) * escala;
  const caixaA = (o.altura ?? p.altura ?? fh) * escala;
  // Cabe na caixa da peça sem esticar (a proporção do desenho é a do quadro enviado).
  const k = Math.min(caixaL / fw, caixaA / fh);
  const w = fw * k;
  const h = fh * k;
  const ancora = o.ancora ?? p.ancora ?? 'pe';
  const fonte = s.tingir && o.cor ? tingido(s, o.cor) : s.img;
  g.save();
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  if ((o.dir ?? 1) < 0) g.scale(-1, 1);
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  g.imageSmoothingEnabled = !!s.suave;
  const topo = ancora === 'centro' ? -h / 2 : ancora === 'topo' ? 0 : -h;
  g.drawImage(fonte, q * fw, 0, fw, fh, -w / 2, topo, w, h);
  g.restore();
  return true;
}

// Só para os testes no Node: finge sprites carregados ({ "peca.animacao": { quadros, fps, largura, altura } }).
// O "img" falso tem o tamanho da tira; um canvas falso que anota drawImage mostra se o jogo usou o sprite.
export function _spritesDeTeste(mapa = {}) {
  enviados = {};
  for (const [chave, s] of Object.entries(mapa)) {
    const quadros = s.quadros || 1;
    enviados[chave] = { src: `/teste/${chave}.png`, quadros, fps: s.fps || 8, tingir: false, suave: false,
      img: { complete: true, naturalWidth: (s.largura || 32) * quadros, naturalHeight: s.altura || 32 } };
  }
  pedido = Promise.resolve({ sprites: enviados, podeEditar: false });
}
