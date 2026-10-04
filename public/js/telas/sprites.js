// Sprites dos jogos (#/recreacao/sprites): a lista das peças de cada jogo, com o desenho de sempre animado,
// o molde para baixar (já com os quadros do desenho atual, para pintar por cima), o envio do PNG em tira
// de quadros e a prévia do sprite enviado. Quem tem "sprites.editar" troca; sem sprite, vale o desenho de sempre.
import { h, trocar, icone, botao, cabecalho, vazio, aviso, aoSair, api, confirmar, interruptor, pode } from '../core.js';
import { carregarSprites, aoMudarSprites, todasAsPecas, desenharSprite, spriteDe } from '../sprites.js';
import { desenharCoelho } from '../desenho-coelho.js';

// O coelho de guia atrás das roupas (meio apagado).
function guia(g, peca) {
  if (!peca.guiaCoelho) return;
  g.save();
  g.globalAlpha *= 0.3;
  desenharCoelho(g, 0, 0, { semSprite: true });
  g.restore();
}

// Cada módulo daqui exporta SPRITES e registra as suas peças quando é importado.
const FONTES = [
  () => import('../desenho-coelho.js'),
  () => import('../roupas-coelho.js'),
  () => import('../jogos/travessia.js'),
  () => import('../jogos/barris.js'),
  () => import('../desenho-cobra.js'),
  () => import('../jogos/super-coelho.js'),
  () => import('./pac-coelho.js'),
  () => import('./festa.js'),
  () => import('../festa-minijogos.js'),
  () => import('./clube.js'),
  () => import('../clube-salas.js'),
  () => import('../clube-minijogos.js'),
  () => import('./cidade-mundo.js'),
  () => import('../jogos/corrida.js'),
  () => import('./arena.js'),
  () => import('./batalha.js'),
];

const ESCALAS = [1, 2, 3, 4];
let escalaMolde = 2;

// Desenha a prévia de uma peça (o desenho de sempre) num canvas, com a âncora no lugar certo e com folga.
function caberNaCaixa(g, peca, w, hh, desenhar) {
  const folga = 8;
  const k = Math.min((w - folga * 2) / peca.largura, (hh - folga * 2) / peca.altura);
  const ax = w / 2;
  const ay = peca.ancora === 'centro' ? hh / 2 : peca.ancora === 'topo' ? (hh - peca.altura * k) / 2 : (hh + peca.altura * k) / 2;
  g.save();
  g.translate(ax, ay);
  g.scale(k, k);
  desenhar(g);
  g.restore();
}

// O molde: uma tira com os quadros da animação, cada um do tamanho da peça vezes a escala, já com o desenho atual.
function gerarMolde(peca, anim) {
  const n = anim.quadros || 1;
  const L = Math.round(peca.largura * escalaMolde);
  const A = Math.round(peca.altura * escalaMolde);
  const c = document.createElement('canvas');
  c.width = L * n;
  c.height = A;
  const g = c.getContext('2d');
  for (let q = 0; q < n; q++) {
    g.save();
    g.beginPath(); g.rect(q * L, 0, L, A); g.clip();
    const ax = q * L + L / 2;
    const ay = peca.ancora === 'centro' ? A / 2 : peca.ancora === 'topo' ? 0 : A;
    g.translate(ax, ay);
    g.scale(escalaMolde, escalaMolde);
    try { peca.previa?.(g, anim.id, q / (anim.fps || 8)); } catch { /* prévia com problema: quadro vazio */ }
    g.restore();
  }
  c.toBlob(b => {
    const a = h('a', { href: URL.createObjectURL(b), download: `${peca.chave}.${anim.id}.png` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }, 'image/png');
}

async function enviarSprite(peca, anim, arquivo, atual) {
  if (!/^image\/(png|gif|webp)$/.test(arquivo.type)) { aviso('Envie um PNG (ou GIF/WEBP) com fundo transparente.', 'erro'); return; }
  // Lê o tamanho para adivinhar quantos quadros a tira tem (quadros do tamanho da peça, lado a lado).
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; }).catch(() => null);
  URL.revokeObjectURL(url);
  if (!img) { aviso('Não consegui abrir essa imagem.', 'erro'); return; }
  const proporcao = peca.largura / peca.altura;
  const quadros = Math.max(1, Math.min(64, Math.round(img.naturalWidth / (img.naturalHeight * proporcao))));
  const fd = new FormData();
  fd.append('arquivo', arquivo); // vai do jeito que está (pixel art não pode ser diminuída nem virar JPG)
  const { url: src } = await api('POST', '/api/upload', fd);
  await api('PUT', `/api/sprites/${peca.chave}.${anim.id}`, {
    src, quadros, fps: atual?.fps ?? anim.fps ?? 8, tingir: atual?.tingir ?? !!peca.tingir, suave: atual?.suave ?? false,
  });
  aviso(`Sprite de "${peca.nome}: ${anim.nome}" enviado (${quadros} ${quadros === 1 ? 'quadro' : 'quadros'}).`);
  await carregarSprites(true);
}

export async function telaSprites() {
  const raiz = h('div', { class: 'pagina' });
  await Promise.all(FONTES.map(f => f().catch(e => console.warn('Sprites: módulo sem peças', e))));
  let { sprites, podeEditar } = await carregarSprites(true);
  if (!pode('sprites.editar') && !podeEditar) {
    trocar(raiz, cabecalho({ titulo: 'Sprites dos jogos', icone: 'imagem', voltar: { href: '#/recreacao', texto: 'Recreação' } }),
      vazio('Só a Família Nobre troca os sprites', 'Peça para quem tem a permissão "Trocar os desenhos dos joguinhos".'));
    return raiz;
  }
  const pecas = todasAsPecas();
  const ORDEM = ['Todos os jogos', 'Roupas e acessórios', 'Travessia', 'Barris do Raposo', 'Super Coelho', 'Pac-Coelho', 'Cobrinha', 'Festa na Toca', 'Festa: minijogos', 'Club Coelho', 'Club Coelho: minijogos', 'Lyendell Dorme', 'Corrida do Coelho', 'Arena da Toca', 'Batalha da Toca'];
  const lugar = j => (ORDEM.includes(j) ? ORDEM.indexOf(j) : ORDEM.length);
  const jogos = [...new Set(pecas.map(p => p.jogo || 'Outros'))].sort((a, b) => lugar(a) - lugar(b));
  let jogo = jogos[0];
  const telas = []; // canvases animados: { c, desenhar }
  const corpo = h('div', { class: 'sprites-lista' });
  const abas = h('div', { class: 'segmentado sprites-abas' });

  function desenharAbas() {
    trocar(abas, jogos.map(j => {
      const n = pecas.filter(p => (p.jogo || 'Outros') === j).reduce((s, p) => s + p.animacoes.filter(a => sprites[`${p.chave}.${a.id}`]).length, 0);
      return h('button', { type: 'button', class: j === jogo ? 'seg ativo' : 'seg', onclick: () => { jogo = j; desenhar(); } }, j, n ? h('span', { class: 'sprites-conta' }, String(n)) : null);
    }));
  }

  function linhaAnimacao(peca, anim) {
    const chave = `${peca.chave}.${anim.id}`;
    const s = sprites[chave];
    const antes = h('canvas', { class: 'sprites-previa', width: 160, height: 160, title: 'O desenho de sempre' });
    const depois = h('canvas', { class: 'sprites-previa', width: 160, height: 160, title: 'O seu sprite' });
    telas.push({ c: antes, desenhar: (g, t) => caberNaCaixa(g, peca, 160, 160, gg => { guia(gg, peca); peca.previa?.(gg, anim.id, t); }) });
    telas.push({ c: depois, desenhar: (g, t) => {
      let tem = false;
      caberNaCaixa(g, peca, 160, 160, gg => { guia(gg, peca); tem = desenharSprite(gg, peca.chave, anim.id, 0, 0, { t, cor: '#c99a6b', ancora: peca.ancora }); });
      if (!tem) {
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('sem sprite', 80, 80);
      }
    } });
    const arquivo = h('input', { type: 'file', accept: 'image/png,image/gif,image/webp', hidden: true, onchange: async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { await enviarSprite(peca, anim, f, s); } catch (x) { aviso(x.message || 'Não deu para enviar.', 'erro'); }
    } });
    const salvar = async muda => {
      try {
        await api('PUT', `/api/sprites/${chave}`, { quadros: s.quadros, fps: s.fps, tingir: s.tingir, suave: s.suave, ...muda });
        await carregarSprites(true);
      } catch (x) { aviso(x.message, 'erro'); }
    };
    const numero = (rotulo, valor, min, max, campo) => h('label', { class: 'sprites-num' }, h('span', null, rotulo),
      h('input', { type: 'number', min, max, value: valor, onchange: e => salvar({ [campo]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }) }));
    return h('div', { class: 'sprites-anim' },
      h('div', { class: 'sprites-anim-cab' },
        h('strong', null, anim.nome),
        h('small', null, `${anim.quadros || 1} ${anim.quadros === 1 ? 'quadro' : 'quadros'} sugeridos, ${anim.fps || 8} por segundo`)),
      h('div', { class: 'sprites-previas' },
        h('figure', null, antes, h('figcaption', null, 'Desenho de sempre')),
        h('figure', null, depois, h('figcaption', null, s ? `Seu sprite (${s.quadros} ${s.quadros === 1 ? 'quadro' : 'quadros'})` : spriteDe(peca.chave, anim.id) ? 'Sem sprite próprio: usa outro desta peça' : 'Seu sprite'))),
      h('div', { class: 'sprites-botoes' },
        botao('Baixar molde', { icone: 'baixo', onclick: () => gerarMolde(peca, anim) }),
        arquivo,
        botao(s ? 'Trocar PNG' : 'Enviar PNG', { icone: 'imagem', classe: 'btn-ouro', onclick: () => arquivo.click() }),
        s && botao('Voltar ao desenho de sempre', { icone: 'lixo', onclick: async () => {
          if (!await confirmar(`O jogo volta a desenhar "${peca.nome}: ${anim.nome}" do jeito de sempre.`, { titulo: 'Tirar o sprite?', ok: 'Tirar', perigo: true })) return;
          try { await api('DELETE', `/api/sprites/${chave}`); await carregarSprites(true); } catch (x) { aviso(x.message, 'erro'); }
        } })),
      s && h('div', { class: 'sprites-ajustes' },
        numero('Quadros', s.quadros, 1, 64, 'quadros'),
        numero('Por segundo', s.fps, 1, 30, 'fps'),
        interruptor('Pintar com a cor do jogador', s.tingir, v => salvar({ tingir: v }), 'As partes claras pegam a cor do pelo de cada um.'),
        interruptor('Suavizar', s.suave, v => salvar({ suave: v }), 'Desligado = pixel art nítida.'),
        h('small', { class: 'suave' }, `Enviado por ${s.por || 'alguém'}.`)));
  }

  function desenhar() {
    telas.length = 0;
    desenharAbas();
    trocar(corpo, pecas.filter(p => (p.jogo || 'Outros') === jogo).map(p => h('section', { class: 'painel sprites-peca' },
      h('div', { class: 'painel-cab' }, h('h2', null, p.nome),
        h('small', { class: 'suave' }, `${p.largura} x ${p.altura} no jogo (o molde sai em ${Math.round(p.largura * escalaMolde)} x ${Math.round(p.altura * escalaMolde)} por quadro)`)),
      p.desc && h('p', { class: 'suave sprites-desc' }, p.desc),
      h('div', { class: 'sprites-anims' }, p.animacoes.map(a => linhaAnimacao(p, a))))));
  }

  const escala = h('div', { class: 'segmentado' }, ESCALAS.map(e => h('button', {
    type: 'button', class: e === escalaMolde ? 'seg ativo' : 'seg',
    onclick: ev => { escalaMolde = e; [...ev.currentTarget.parentNode.children].forEach(b => b.classList.toggle('ativo', b === ev.currentTarget)); desenhar(); },
  }, `${e}x`)));

  trocar(raiz,
    cabecalho({ titulo: 'Sprites dos jogos', icone: 'imagem', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Troque os desenhos dos joguinhos pelos seus. Sem sprite, o jogo continua com o desenho de sempre.' }),
    h('section', { class: 'painel sprites-como' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('ajustes'), 'Como fazer')),
      h('ol', null,
        h('li', null, h('strong', null, 'Baixe o molde'), ' da animação: é um PNG com os quadros lado a lado, já com o desenho de sempre em cada um, para pintar por cima ou apagar e fazer do zero.'),
        h('li', null, 'Desenhe no ', h('strong', null, 'Aseprite'), ', no ', h('strong', null, 'Piskel'), ' (grátis, no navegador) ou onde preferir, com ', h('strong', null, 'fundo transparente'), '. Mantenha os quadros do mesmo tamanho, da esquerda para a direita, com o personagem olhando para a direita e o pé na base do quadro.'),
        h('li', null, h('strong', null, 'Envie o PNG'), '. O site conta os quadros sozinho (dá para corrigir) e o jogo passa a usar na hora, para todo mundo.')),
      h('div', { class: 'sprites-escala' }, h('span', null, 'Tamanho do molde:'), escala,
        h('small', { class: 'suave' }, 'Pode desenhar maior que o molde: o jogo diminui para caber. Para pixel art, 1x ou 2x.'))),
    abas, corpo);
  desenhar();

  // Prévias animadas (as duas colunas de cada animação).
  const inicio = performance.now();
  let raf = 0;
  const passo = agora => {
    raf = requestAnimationFrame(passo);
    const t = (agora - inicio) / 1000;
    for (const { c, desenhar: d } of telas) {
      if (!c.isConnected) continue;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      try { d(g, t); } catch { /* prévia quebrada não derruba a tela */ }
    }
  };
  raf = requestAnimationFrame(passo);
  const tirar = aoMudarSprites(() => {
    carregarSprites().then(r => { sprites = r.sprites; desenhar(); });
  });
  aoSair(() => { cancelAnimationFrame(raf); tirar(); });
  return raiz;
}
