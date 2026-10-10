// O "fliperama": a moldura comum dos jogos de ação de uma pessoa só desenhados num canvas
// (Barris do Raposo, Super Coelho, Travessia). Cada jogo é um módulo em public/js/jogos/ que só cuida das
// regras e do desenho; aqui ficam a tela, o teclado, os botões de toque, o som, o relógio (60 passos por
// segundo), a pausa, o recorde, o jogo junto (versus e co-op, todos no mesmo jogo: veja junto.js), os códigos
// secretos e a transmissão para quem assiste.
//
// O módulo do jogo exporta um objeto (def) assim:
//   { id, nome, icone, sub, subJunto: { versus, coop }, largura, altura, cor,
//     controles: { cima, baixo, pular: 'Pular', acao: 'Correr' | null, deslizar, cimaPula },
//     instrucoes: { teclado, toque }, comoJogar: [[emoji, nome, texto], ...],
//     pecasComoJogar: { nome: 'chave.da.peca' } (opcional: o nome da linha segue o nome da peça do sprite),
//     criar(ctx) -> jogo, desenharFoto(g, foto, t) }
// ctx = { sorte, segredo(chave), som(nome), junto, largura, altura, velocidade() } (junto: null quando a pessoa
//        joga sozinha; velocidade(): 0.5 enquanto a pessoa leva a pegadinha "lento", para o coelho andar devagar)
// jogo = { pontos, acabou, atualizar(dt, entrada), desenhar(g, t), resumo(), foto(),
//          usarSegredo?(chave), mudouSegredo?(chave, ligado), adm? }
// adm (opcional, só sozinho): o que o menu de administrador pode fazer na partida. Tudo opcional:
//   { invencivel(ligar), vidas(n), pontos(n), fases() -> [[valor, nome]], irFase(valor), proxima(), terminar(),
//     acoes: [{ id, nome, grupo, ajuda, campos, executar(valores) }] } (cada um devolve uma frase ou lança Error)
// entrada = { esq, dir, cima, baixo, pular, acao, apertou: Set('esq'|'dir'|'cima'|'baixo'|'pular'|'acao'|'toque') }

import { h, trocar, icone, botao, cabecalho, aviso, get, post, pode, aoSair, estado, num } from './core.js';
import { rt, ouvir, transmitir, enviarQuadro, pararTransmissao } from './tempo-real.js';
import { juntoNoJogo, sorteJunto, textoDoFimJunto } from './junto.js';
import { segredosDoJogo, SEGREDOS } from './segredos.js';
import { menuAdm, admDirecao, admPodeAgir, admVelocidade } from './adm-jogos.js';
import { nomeDe } from './sprites.js';

const PASSO = 1 / 60;
const TECLAS = {
  ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowUp: 'cima', KeyW: 'cima', ArrowDown: 'baixo', KeyS: 'baixo',
  Space: 'pular', KeyZ: 'pular', KeyK: 'pular', KeyX: 'acao', KeyJ: 'acao', ShiftLeft: 'acao', ShiftRight: 'acao',
};
const NOME_DIR = { esq: 'esquerda', dir: 'direita', cima: 'cima', baixo: 'baixo' };
const DIR_DO_NOME = { esquerda: 'esq', direita: 'dir', cima: 'cima', baixo: 'baixo' };
const RITMOS = { lenta: 0.5, normal: 1, rapida: 1.5 };
const NAO_VALE_ADM = 'Partida com o menu de administrador: não vale recorde.';

/* ─── Som: efeitos feitos na hora com o WebAudio (sem arquivos) ─── */

const CHAVE_MUDO = 'arcade-mudo';
let audio = null;
let mudo = (() => { try { return localStorage.getItem(CHAVE_MUDO) === '1'; } catch { return false; } })();

function nota(freq, ini, dur, { tipo = 'square', vol = 0.06, ate = null } = {}) {
  const o = audio.createOscillator();
  const v = audio.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, ini);
  if (ate) o.frequency.exponentialRampToValueAtTime(ate, ini + dur);
  v.gain.setValueAtTime(vol, ini);
  v.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
  o.connect(v).connect(audio.destination);
  o.start(ini);
  o.stop(ini + dur + 0.02);
}
function ruido(ini, dur, vol = 0.05) {
  const n = Math.floor(audio.sampleRate * dur);
  const buf = audio.createBuffer(1, n, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = audio.createBufferSource();
  const v = audio.createGain();
  v.gain.value = vol;
  s.buffer = buf;
  s.connect(v).connect(audio.destination);
  s.start(ini);
}
const SONS = {
  pulo: t => nota(320, t, 0.14, { ate: 700, vol: 0.04 }),
  moeda: t => { nota(988, t, 0.07, { vol: 0.04 }); nota(1319, t + 0.07, 0.22, { vol: 0.04 }); },
  poder: t => [523, 659, 784, 1047].forEach((f, i) => nota(f, t + i * 0.06, 0.1, { vol: 0.04 })),
  vida: t => [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => nota(f, t + i * 0.08, 0.1, { vol: 0.04 })),
  pisao: t => nota(220, t, 0.12, { ate: 80, vol: 0.06 }),
  quebra: t => ruido(t, 0.18, 0.06),
  tiro: t => nota(1400, t, 0.08, { ate: 500, vol: 0.03 }),
  passo: t => nota(500, t, 0.04, { tipo: 'triangle', vol: 0.03 }),
  alerta: t => { nota(880, t, 0.1, { vol: 0.04 }); nota(880, t + 0.16, 0.1, { vol: 0.04 }); },
  agua: t => ruido(t, 0.35, 0.05),
  bater: t => { ruido(t, 0.12, 0.07); nota(120, t, 0.15, { ate: 50, vol: 0.06 }); },
  morte: t => { nota(660, t, 0.5, { ate: 110, vol: 0.05 }); },
  fase: t => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, t + i * 0.1, 0.16, { vol: 0.045 })),
  fim: t => [392, 330, 262, 196].forEach((f, i) => nota(f, t + i * 0.18, 0.22, { tipo: 'triangle', vol: 0.06 })),
};
export function som(nome) {
  if (mudo || !SONS[nome]) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    SONS[nome](audio.currentTime + 0.01);
  } catch { /* sem som neste navegador */ }
}

/* ─── Canvas que acompanha o tamanho da tela (e a densidade de pixels) ─── */

function prepararCanvas(tela, def) {
  const g = tela.getContext('2d');
  return () => {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    g.setTransform(w / def.largura, 0, 0, hh / def.altura, 0, 0);
    return g;
  };
}

function novoCanvas(def, classe = '') {
  return h('canvas', {
    class: `arcade-tela ${classe}`.trim(), tabindex: '0', 'aria-label': def.nome,
    style: { aspectRatio: `${def.largura} / ${def.altura}`, background: def.cor || '#060b07' },
  });
}

// O canvas cabe na altura da janela (sem precisar rolar a página para jogar).
const larguraMaxima = def => `calc((100vh - 230px) * ${def.largura} / ${def.altura})`;

/* ─── A tela do jogo ─── */

export function telaArcade(def) {
  if (!pode('recreacao.usar')) { const e = new Error('Sem acesso à Recreação.'); e.status = 403; throw e; }
  const tela = novoCanvas(def);
  const contexto = prepararCanvas(tela, def);
  const sobre = h('div', { class: 'cobra-sobre arcade-sobre' });
  const pontosEl = h('strong', null, '0');
  const recordeEl = h('strong', null, '...');
  const plateiaEl = h('span', { class: 'plateia', hidden: true });
  const botaoSom = h('button', { type: 'button', class: 'btn-icone arcade-som', onclick: () => alternarSom() });
  const ranking = h('div');
  const toque = matchMedia('(pointer: coarse)').matches;

  let jogo = null;
  let situacao = 'inicio'; // inicio, jogando, pausado, fim
  let recorde = null;
  let pontosAntes = -1;
  let acumulado = 0;
  let ultimo = 0;
  let quadro = 0;
  const inicioDaPagina = performance.now();
  const entrada = { esq: false, dir: false, cima: false, baixo: false, pular: false, acao: false, apertou: new Set() };
  let pendentes = new Set();
  const seguros = { teclado: new Set(), toque: new Map() }; // o que está apertado em cada lugar

  // Junto: todos no mesmo jogo, com a mesma sorte, largando juntos; não dá para pausar.
  let fimJunto = null;
  const jt = juntoNoJogo(def.id, {
    aoLargar: () => { if (situacao === 'inicio') comecar(); },
    aoAcabar: s => { fimJunto = s; situacao = 'fim'; mostrarSobre(); },
  });
  const sorte = jt ? sorteJunto(jt.semente) : Math.random;
  const seg = segredosDoJogo(def.id, {
    bloqueado: !!jt,
    aoMudar: (chave, ligado) => jogo?.mudouSegredo?.(chave, ligado),
    aoUsar: chave => (jogo && situacao !== 'fim' ? !!jogo.usarSegredo?.(chave) : false),
  });

  // Menu de administrador: só sozinho (as partidas ao vivo já têm o menu da sala). Usou, a partida não vale recorde.
  let admUsado = false;
  let ritmo = 1; // a velocidade do jogo escolhida no menu
  const menu = jt ? null : menuAdm({
    titulo: def.nome,
    get acoes() { return acoesAdm(); },
    aoUsar: () => { admUsado = true; },
  });

  function desenharBotaoSom() {
    trocar(botaoSom, icone(mudo ? 'mudo' : 'volume'));
    botaoSom.title = mudo ? 'Ligar o som' : 'Desligar o som';
    botaoSom.setAttribute('aria-label', botaoSom.title);
  }
  function alternarSom() {
    mudo = !mudo;
    try { localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0'); } catch { /* tudo bem */ }
    desenharBotaoSom();
  }

  function novoJogo() {
    seg.novaPartida();
    admUsado = false;
    ritmo = 1;
    menu?.novaPartida();
    jogo = def.criar({ sorte, segredo: chave => seg.ativo(chave), som, junto: jt, largura: def.largura, altura: def.altura, velocidade: admVelocidade });
    situacao = 'inicio';
    pontosAntes = -1;
    acumulado = 0;
    atualizarPlacar();
    mostrarSobre();
  }

  function comecar() {
    if (jt && (!jt.largou() || jt.acabou())) return;
    if (situacao === 'fim') novoJogo();
    if (situacao === 'inicio' || situacao === 'pausado') situacao = 'jogando';
    ultimo = 0;
    mostrarSobre();
    tela.focus({ preventScroll: true });
    som('passo');
  }

  function pausar() {
    if (jt || situacao !== 'jogando') return;
    situacao = 'pausado';
    mostrarSobre();
  }

  async function fim() {
    situacao = 'fim';
    const pontos = Math.max(0, Math.floor(jogo.pontos || 0));
    som('fim');
    const r = jogo.resumo?.() || {};
    mostrarSobre();
    if (jt) return;
    if (admUsado || menu?.usado()) { anexarAoFim(h('p', { class: 'cobra-recorde' }, icone('alerta'), NAO_VALE_ADM)); return; }
    if (pontos <= 0) return;
    if (!seg.valeRecorde()) { anexarAoFim(h('p', { class: 'cobra-recorde' }, icone('estrela'), 'Modo secreto ligado: esta partida não vale recorde.')); return; }
    try {
      const resp = await post('/api/recreacao/recordes', { jogo: def.id, pontos, detalhe: String(r.detalhe || '').slice(0, 60) });
      if (resp.recorde) {
        recorde = pontos;
        atualizarPlacar();
        anexarAoFim(h('p', { class: 'cobra-recorde' }, icone('trofeu'), resp.anterior == null ? 'Primeiro recorde registrado!' : 'Novo recorde pessoal!'));
        carregarRanking();
      }
      if (resp.cenouras > 0) anexarAoFim(h('p', { class: 'arcade-cenouras' }, `🥕 +${resp.cenouras} cenouras para gastar no Club Coelho`));
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }
  const anexarAoFim = el => { const caixa = sobre.querySelector('.cobra-caixa'); if (caixa && situacao === 'fim') caixa.insertBefore(el, caixa.lastChild); };

  function mostrarSobre() {
    if (situacao === 'jogando') { sobre.hidden = true; return; }
    sobre.hidden = false;
    const instr = toque ? def.instrucoes?.toque : def.instrucoes?.teclado;
    if (situacao === 'inicio' && jt) {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Prepare-se!'),
        h('p', null, jt.modo === 'coop' ? 'Todos juntos, do mesmo lado.' : 'Todos juntos, cada um por si.'),
        def.subJunto?.[jt.modo] && h('p', null, def.subJunto[jt.modo]),
        instr && h('p', { class: 'suave' }, instr)));
    } else if (situacao === 'fim' && jt) {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, 'Fim de jogo!'),
        h('p', { class: 'cobra-placar' }, fimJunto ? textoDoFimJunto(fimJunto) : 'A partida acabou.'),
        jt.botoesFim()));
    } else if (situacao === 'inicio') {
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, def.nome),
        h('p', null, def.sub),
        instr && h('p', { class: 'suave' }, instr),
        botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: comecar })));
    } else if (situacao === 'pausado') {
      trocar(sobre, h('div', { class: 'cobra-caixa' }, h('h2', null, 'Pausado'), botao('Continuar', { classe: 'btn-ouro', icone: 'play', onclick: comecar })));
    } else {
      const r = jogo?.resumo?.() || {};
      trocar(sobre, h('div', { class: 'cobra-caixa' },
        h('h2', null, r.titulo || 'Fim de jogo'),
        h('p', { class: 'cobra-placar' }, `${num(Math.floor(jogo?.pontos || 0))} pontos`),
        (r.linhas || []).map(l => h('p', null, l)),
        botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => { novoJogo(); comecar(); } })));
    }
  }

  function atualizarPlacar() {
    const p = Math.floor(jogo?.pontos || 0);
    if (p === pontosAntes) return;
    pontosAntes = p;
    pontosEl.textContent = num(p);
    recordeEl.textContent = recorde == null ? '0' : num(recorde);
  }

  /* Entrada: teclado, botões na tela e deslizar o dedo */

  function juntar() {
    for (const k of ['esq', 'dir', 'cima', 'baixo', 'pular', 'acao']) {
      entrada[k] = seguros.teclado.has(k) || [...seguros.toque.values()].includes(k);
    }
  }
  function apertar(k) {
    pendentes.add(k);
    if (situacao === 'inicio' && !jt && (k === 'pular' || (def.controles?.deslizar && NOME_DIR[k]))) comecar();
  }

  const digitando = e => e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-fundo');
  const aoApertar = e => {
    if (digitando(e)) return;
    const k = TECLAS[e.code];
    if (k) {
      e.preventDefault();
      if (!e.repeat) apertar(k);
      seguros.teclado.add(k);
      juntar();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (situacao === 'jogando') pausar(); else if (situacao === 'pausado') comecar();
    }
    if (e.code === 'Enter' && !jt && situacao !== 'jogando') { e.preventDefault(); comecar(); }
  };
  const aoSoltar = e => {
    const k = TECLAS[e.code];
    if (!k) return;
    seguros.teclado.delete(k);
    juntar();
  };
  const aoSairDaJanela = () => { seguros.teclado.clear(); seguros.toque.clear(); juntar(); pausar(); };
  document.addEventListener('keydown', aoApertar);
  document.addEventListener('keyup', aoSoltar);
  window.addEventListener('blur', aoSairDaJanela);

  // Botão de toque: segura enquanto o dedo estiver em cima (cada dedo no seu botão).
  function botaoToque(k, conteudo, classe, rotulo) {
    const b = h('button', { type: 'button', class: `arcade-botao ${classe}`, 'aria-label': rotulo }, conteudo);
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      seguros.toque.set(e.pointerId, k);
      b.classList.add('apertado');
      apertar(k);
      if (NOME_DIR[k]) seg.direcao(NOME_DIR[k]);
      juntar();
    });
    const soltar = e => { if (seguros.toque.get(e.pointerId) === k) seguros.toque.delete(e.pointerId); b.classList.remove('apertado'); juntar(); };
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('lostpointercapture', soltar);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }
  const c = def.controles || {};
  const controles = h('div', { class: 'arcade-controles' },
    h('div', { class: `arcade-cruz ${c.cima || c.baixo ? 'com-cima' : ''}`.trim() },
      c.cima && botaoToque('cima', icone('cima'), 'b-cima', 'Para cima'),
      !c.semLados && botaoToque('esq', icone('voltar'), 'b-esq', 'Para a esquerda'), // semLados: jogos que só pulam e abaixam
      !c.semLados && botaoToque('dir', icone('frente'), 'b-dir', 'Para a direita'),
      c.baixo && botaoToque('baixo', icone('baixo'), 'b-baixo', 'Para baixo')),
    h('div', { class: 'arcade-acoes' },
      c.acao && botaoToque('acao', h('span', null, c.acao), 'b-acao', c.acao),
      c.pular && botaoToque('pular', h('span', null, c.pular), 'b-pular', c.pular)));

  // Deslizar o dedo no canvas (Travessia): cada deslizada é um pulinho; um toque é para frente.
  let inicioToque = null;
  tela.addEventListener('pointerdown', e => {
    if (situacao !== 'jogando' && !jt && e.pointerType !== 'mouse') { comecar(); return; }
    inicioToque = { x: e.clientX, y: e.clientY };
  });
  tela.addEventListener('pointerup', e => {
    if (!inicioToque || !c.deslizar) { inicioToque = null; return; }
    const dx = e.clientX - inicioToque.x;
    const dy = e.clientY - inicioToque.y;
    inicioToque = null;
    if (situacao !== 'jogando') return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { apertar('toque'); return; }
    const k = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dir' : 'esq') : (dy > 0 ? 'baixo' : 'cima');
    seg.direcao(NOME_DIR[k]);
    apertar(k);
  });
  tela.addEventListener('pointercancel', () => { inicioToque = null; });

  // O que o jogo recebe: a entrada depois das pegadinhas do administrador (valem também no jogo junto).
  // Congelado: nada mexe. Invertido: os lados trocam (e o toque para frente vira para trás).
  // O "pular com a seta para cima" (cimaPula) vem depois da troca, para seguir a seta que valeu.
  function comoFica(k) {
    if (NOME_DIR[k]) return DIR_DO_NOME[admDirecao(NOME_DIR[k])] || null;
    if (!admPodeAgir()) return null;
    if (k === 'toque' && admDirecao('cima') === 'baixo') return 'baixo';
    return k;
  }
  function entradaDoJogo(bruta) {
    const ent = { esq: false, dir: false, cima: false, baixo: false, pular: false, acao: false, apertou: new Set() };
    for (const k of ['esq', 'dir', 'cima', 'baixo', 'pular', 'acao']) {
      if (!bruta[k]) continue;
      const v = comoFica(k);
      if (v) ent[v] = true;
    }
    for (const k of bruta.apertou) {
      const v = comoFica(k);
      if (v) ent.apertou.add(v);
    }
    if (def.controles?.cimaPula) {
      if (ent.cima) ent.pular = true;
      if (ent.apertou.has('cima')) ent.apertou.add('pular');
    }
    return ent;
  }

  /* O relógio do jogo */

  function passo(agora) {
    quadro = requestAnimationFrame(passo);
    const dt = ultimo ? Math.min(0.1, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    if (!jogo) return;
    try {
      if (situacao === 'jogando') {
        acumulado += dt * (jt ? 1 : ritmo);
        let n = 0;
        while (acumulado >= PASSO && n < 6) {
          entrada.apertou = pendentes;
          pendentes = new Set();
          jogo.atualizar(PASSO, entradaDoJogo(entrada));
          acumulado -= PASSO;
          n++;
          if (jogo.acabou && !jt) break;
        }
        if (n === 6) acumulado = 0;
        atualizarPlacar();
        if (jogo.acabou && !jt) fim();
      } else {
        pendentes.clear();
      }
      const g = contexto();
      jogo.desenhar(g, (agora - inicioDaPagina) / 1000);
      if (!jt && rt.conectado && rt.plateia > 0) enviarQuadro({ f: jogo.foto(), p: Math.floor(jogo.pontos || 0), s: situacao });
    } catch (e) {
      console.error(`${def.nome}:`, e); // um erro não pode travar a página
    }
  }

  const aoEsconder = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', aoEsconder);
  const comecarTransmissao = () => { if (rt.conectado && !jt) transmitir(def.id, {}); };
  aoSair(ouvir('estado', comecarTransmissao));
  aoSair(ouvir('solo:plateia', () => {
    plateiaEl.hidden = !rt.plateia;
    trocar(plateiaEl, icone('olho'), ` ${rt.plateia} assistindo`);
    if (rt.plateia && jogo) enviarQuadro({ f: jogo.foto(), p: Math.floor(jogo.pontos || 0), s: situacao }, true);
  }));
  comecarTransmissao();
  aoSair(() => {
    cancelAnimationFrame(quadro);
    if (!jt) pararTransmissao();
    document.removeEventListener('keydown', aoApertar);
    document.removeEventListener('keyup', aoSoltar);
    window.removeEventListener('blur', aoSairDaJanela);
    document.removeEventListener('visibilitychange', aoEsconder);
  });

  /* As ações do menu de administrador: as comuns ficam aqui e usam os ganchos que o jogo oferece (jogo.adm) */

  function partidaAdm() {
    if (!jogo || situacao === 'fim' || jogo.acabou) throw new Error('A partida acabou: comece outra para usar isso.');
    return jogo.adm || {};
  }
  // Marca a partida antes de mexer (assim o fim de jogo já sabe que ela não vale recorde).
  const usar = fn => valores => {
    const a = partidaAdm();
    menu?.marcar();
    return fn(a, valores);
  };
  const ate = (n, min, max) => Math.max(min, Math.min(max, Math.floor(Number(n)) || min));
  function acoesAdm() {
    const a = jogo?.adm || {};
    const lista = [];
    if (a.invencivel) {
      lista.push({
        id: 'invencivel', nome: 'Invencível', grupo: 'Ajudar', ajuda: 'Nada machuca o coelho até desligar.',
        campos: [{ id: 'ligar', nome: 'Invencível', tipo: 'escolha', opcoes: [['sim', 'Ligar'], ['nao', 'Desligar']] }],
        executar: usar((x, v) => x.invencivel(v.ligar !== 'nao')),
      });
    }
    if (a.vidas) {
      lista.push({
        id: 'vidas', nome: 'Dar vidas', grupo: 'Ajudar',
        campos: [{ id: 'n', nome: 'Quantas', tipo: 'numero', min: 1, max: 50, padrao: 3 }],
        executar: usar((x, v) => x.vidas(ate(v.n, 1, 50))),
      });
    }
    if (a.pontos) {
      lista.push({
        id: 'pontos', nome: 'Dar pontos', grupo: 'Ajudar',
        campos: [{ id: 'n', nome: 'Quantos', tipo: 'numero', min: 1, max: 1000000, padrao: 1000 }],
        executar: usar((x, v) => x.pontos(ate(v.n, 1, 1000000))),
      });
    }
    if (a.proxima) lista.push({ id: 'proxima', nome: 'Passar de fase', grupo: 'Mexer na partida', executar: usar(x => x.proxima()) });
    if (a.fases && a.irFase) {
      lista.push({
        id: 'fase', nome: 'Escolher a fase', grupo: 'Mexer na partida', ajuda: 'Começa a fase escolhida agora.',
        campos: [{ id: 'fase', nome: 'Fase', tipo: 'escolha', opcoes: a.fases() }],
        executar: usar((x, v) => x.irFase(v.fase)),
      });
    }
    lista.push({
      id: 'velocidade', nome: 'Velocidade do jogo', grupo: 'Mexer na partida', ajuda: 'Vale até o fim desta partida.',
      campos: [{
        id: 'ritmo', nome: 'Velocidade', tipo: 'escolha', opcoes: [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']],
        padrao: Object.keys(RITMOS).find(k => RITMOS[k] === ritmo) || 'normal',
      }],
      executar: usar((x, v) => {
        ritmo = RITMOS[v.ritmo] || 1;
        return `Velocidade do jogo: ${{ lenta: 'lenta', rapida: 'rápida' }[v.ritmo] || 'normal'}.`;
      }),
    });
    if (a.terminar) {
      lista.push({
        id: 'terminar', nome: 'Terminar a partida', grupo: 'Mexer na partida', perigo: true, ajuda: 'Acaba agora, com os pontos que tem.',
        executar: usar(x => {
          const r = x.terminar();
          if (situacao !== 'jogando' && jogo.acabou) fim(); // jogando, o relógio do jogo encerra no próximo passo
          return r || 'A partida foi encerrada.';
        }),
      });
    }
    for (const extra of a.acoes || []) lista.push({ ...extra, executar: usar((x, v) => extra.executar(v)) });
    // Os códigos secretos deste jogo, ligados direto (com o mesmo aviso e o mesmo selo de quando são digitados).
    for (const [chave, s] of Object.entries(SEGREDOS)) {
      if (!s.jogos.includes(def.id)) continue;
      lista.push({
        id: `segredo-${chave}`, nome: `Código: ${s.nome}`, grupo: 'Modo', ajuda: s.efeito,
        executar: usar(() => {
          const r = seg.usar(chave);
          if (r === 'recusado') throw new Error(`${s.nome}: não deu para usar agora.`);
          return r === 'usado' ? `${s.nome}: feito.` : `${s.nome}: ${r === 'ligado' ? 'ligado' : 'desligado'}.`;
        }),
      });
    }
    return lista;
  }

  function carregarRanking() {
    get('/api/recreacao/ranking').then(r => {
      const lista = r[def.id] || [];
      const meu = lista.find(l => l.nome === estado.eu.nome);
      if (meu && (recorde == null || meu.pontos > recorde)) recorde = meu.pontos;
      pontosAntes = -1;
      atualizarPlacar();
      trocar(ranking, lista.length
        ? h('ol', { class: 'mini-ranking' }, lista.map(l => h('li', { class: l.nome === estado.eu.nome ? 'eu-linha' : '' }, h('span', null, l.nome), h('strong', null, num(l.pontos)))))
        : h('p', { class: 'painel-vazio' }, 'Ninguém jogou ainda. Seja o primeiro!'));
    }).catch(() => {});
  }

  desenharBotaoSom();
  novoJogo();
  if (!jt) carregarRanking();
  quadro = requestAnimationFrame(passo);

  return h('div', { class: 'pagina' },
    cabecalho({
      titulo: jt ? `${def.nome}: ${jt.modo === 'coop' ? 'co-op' : 'versus'}` : def.nome, icone: def.icone, voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: jt ? def.subJunto?.[jt.modo] || def.sub : def.sub,
    }),
    // Jogo largo (como o Super Coelho): a tela usa a largura toda e o ranking vai para baixo.
    h('div', { class: `jogo-solo ${def.largura / def.altura > 1.4 ? 'arcade-largo' : ''}`.trim() },
      h('div', { class: 'jogo-area arcade-area', style: { maxWidth: larguraMaxima(def) } },
        h('div', { class: 'cobra-placar-linha' },
          h('span', null, 'Pontos: ', pontosEl),
          plateiaEl,
          !jt && h('span', null, icone('trofeu'), ' Recorde: ', recordeEl),
          botaoSom),
        h('div', { class: 'cobra-moldura arcade-moldura' }, tela, sobre),
        controles),
      h('aside', { class: 'jogo-lateral arcade-lateral' },
        jt ? jt.painel : h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Melhores')),
          ranking),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pergunta'), 'Como jogar')),
          h('ul', { class: 'pac-legenda arcade-legenda' },
            (def.comoJogar || []).map(([emoji, nome, texto]) => h('li', null, h('span', { class: 'arcade-emoji' }, emoji), h('span', null, h('strong', null, nomeDe(def.pecasComoJogar?.[nome], nome)), ' ', texto))))))));
}

/* ─── Quem assiste: o mesmo desenho, com o último quadro recebido ─── */

// O visor de quem assiste, enquanto o módulo do jogo ainda está chegando.
export function visorArcade(carregar) {
  const el = h('div', { class: 'jogo-area arcade-area' }, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
  let visor = null;
  let ultimo = null;
  let parado = false;
  carregar().then(m => {
    if (parado) return;
    visor = assistirArcade(m.default);
    el.replaceWith(visor.el);
    if (ultimo) visor.quadro(ultimo);
  }).catch(e => { trocar(el, h('p', { class: 'painel-vazio' }, `Não deu para abrir o jogo: ${e.message}`)); });
  return {
    get el() { return visor ? visor.el : el; },
    quadro(q) { ultimo = q; visor?.quadro(q); },
    parar() { parado = true; visor?.parar(); },
  };
}

export function assistirArcade(def) {
  const tela = novoCanvas(def, 'espectador');
  const contexto = prepararCanvas(tela, def);
  const pontosEl = h('strong', null, '0');
  const aviso_ = h('div', { class: 'assistir-aviso', hidden: true });
  let ultimoQuadro = null;
  let parado = false;
  let quadro = 0;
  const inicio = performance.now();
  function laco(agora) {
    if (parado) return;
    quadro = requestAnimationFrame(laco);
    if (!ultimoQuadro?.f) return;
    try { def.desenharFoto(contexto(), ultimoQuadro.f, (agora - inicio) / 1000); } catch (e) { console.error(e); }
  }
  quadro = requestAnimationFrame(laco);
  const TEXTO = { inicio: 'Preparando o jogo...', pausado: 'Pausado' };
  return {
    el: h('div', { class: 'jogo-area arcade-area', style: { maxWidth: larguraMaxima(def) } },
      h('div', { class: 'cobra-placar-linha' }, h('span', null, 'Pontos: ', pontosEl)),
      h('div', { class: 'cobra-moldura arcade-moldura' }, tela, aviso_)),
    quadro(q) {
      ultimoQuadro = q;
      pontosEl.textContent = num(q.p || 0);
      const texto = q.s === 'fim' ? `Fim de jogo: ${num(q.p || 0)} pontos` : TEXTO[q.s];
      aviso_.hidden = !texto;
      if (texto) aviso_.textContent = texto;
    },
    parar() { parado = true; cancelAnimationFrame(quadro); },
  };
}
