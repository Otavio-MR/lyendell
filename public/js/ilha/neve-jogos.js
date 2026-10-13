// Os minijogos da região "neve" da Ilha do Club Coelho (importado por neve.js só quando a pessoa clica):
//   Guerra de Bolas de Neve (Forte Nevado), Corrida de Trenó (Estação de Esqui), Mina de Ouro (com a britadeira),
//   Resgate dos Pompons (Piscina Subterrânea), Separar o Lixo (Usina de Reciclagem), o Quiz da Ilha (Escola) e a
//   mesa do Lig 4 (Sótão), que abre uma partida de verdade da Recreação.
// Cada minijogo abre numa janela com o seu canvas (teclado, mouse e toque) e, no fim, manda os pontos com
// ctx.terminarMinijogo (as cenouras ficam no servidor: src/clube-ilha/neve.js).

import { h, trocar, botao, modal, aviso } from '../core.js';
import { som } from '../arcade.js';
import { rt, criarPartida, entrarNaPartida } from '../tempo-real.js';
import { desenharCoelho, sorte } from '../desenho-coelho.js';
import { el, ret, grad, brilho, forma, raposinho, desenharPompom, CORES_POMPOM, pinheiro, desenharLixo, peca, nevar, montanha } from './neve.js';

function escrever(g, t, x, y, cor = '#fbf3e0', fonte = '700 16px "Cinzel", Georgia, serif', alinhar = 'center') {
  g.font = fonte;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillText(t, x + 1.5, y + 1.5);
  g.fillStyle = cor;
  g.fillText(t, x, y);
}
function linha(g, cor, larg, pts) {
  g.strokeStyle = cor;
  g.lineWidth = larg;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
const hash = (k, s = 1) => { const v = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const sortear = lista => lista[Math.floor(Math.random() * lista.length)];
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
function coracao(g, x, y, r, cor) {
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  g.fill();
}

// A moldura comum: janela, canvas que acompanha o tamanho, laço de quadros, a caixa por cima e a tela de fim.
function abrirJanela({ titulo, largura, altura, jogo, ctx, montar }) {
  const tela = h('canvas', { class: 'minijogo-tela', style: { aspectRatio: `${largura} / ${altura}` }, tabindex: '0' });
  const g = tela.getContext('2d');
  const sobre = h('div', { class: 'cobra-sobre minijogo-sobre' });
  const extra = h('div', { class: 'minijogo-extra neve-extra' });
  let quadro = 0;
  let ultimo = 0;
  let parado = false;
  const limpezas = [];
  const m = modal({
    titulo, tamanho: 'grande', classe: 'minijogo', fecharFora: false,
    corpo: h('div', { class: 'minijogo-corpo' }, h('div', { class: 'minijogo-moldura', style: { '--razao': String(largura / altura) } }, tela, sobre), extra),
    aoFechar: () => { parado = true; cancelAnimationFrame(quadro); limpezas.forEach(f => f()); },
  });
  const ajustar = () => {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; }
    g.setTransform(w / largura, 0, 0, hh / altura, 0, 0);
  };
  const api = {
    tela, g, sobre, extra, m,
    ponto(ev) {
      const r = tela.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * largura, y: ((ev.clientY - r.top) / r.height) * altura };
    },
    ouvir(alvo, tipo, f, opcoes) { alvo.addEventListener(tipo, f, opcoes); limpezas.push(() => alvo.removeEventListener(tipo, f, opcoes)); },
    caixa(...filhos) { trocar(sobre, h('div', { class: 'cobra-caixa' }, ...filhos)); sobre.hidden = false; },
    esconder() { sobre.hidden = true; tela.focus({ preventScroll: true }); },
    // Botão que fica apertado enquanto o dedo (ou o mouse) está nele.
    botaoSegurar(rotulo, aoMudar, classe = '') {
      const b = h('button', { type: 'button', class: `neve-botao ${classe}`.trim() }, rotulo);
      const solta = () => { b.classList.remove('apertado'); aoMudar(false); };
      b.addEventListener('pointerdown', ev => { ev.preventDefault(); b.setPointerCapture?.(ev.pointerId); b.classList.add('apertado'); aoMudar(true); });
      for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(tipo, solta);
      b.addEventListener('contextmenu', ev => ev.preventDefault());
      return b;
    },
    async terminar(pontos, linhas) {
      api.caixa(h('h2', null, 'Fim!'), linhas.map(l => h('p', null, l)), h('p', { class: 'suave' }, 'Guardando as cenouras...'));
      let r = null;
      let falha = null;
      try { r = await ctx.terminarMinijogo(jogo, pontos); } catch (e) { falha = e.message || 'Não deu para guardar as cenouras agora.'; }
      if (parado) return r;
      api.caixa(
        h('h2', null, 'Fim!'),
        linhas.map(l => h('p', null, l)),
        r ? h('p', { class: 'arcade-cenouras' }, r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje. Volte amanhã!' : 'Nenhuma cenoura desta vez.')
          : h('p', { class: 'suave' }, falha),
        h('div', { class: 'minijogo-botoes' },
          botao('Jogar de novo', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => api.reiniciar() }),
          botao('Sair', { onclick: () => m.fechar() })));
      return r;
    },
    reiniciar: () => {},
  };
  const jogoAtual = montar(api);
  function laco(agora) {
    if (parado) return;
    quadro = requestAnimationFrame(laco);
    const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    ajustar();
    try { jogoAtual.passo(dt, agora / 1000); } catch (e) { console.error(titulo, e); }
  }
  quadro = requestAnimationFrame(laco);
  setTimeout(() => tela.focus({ preventScroll: true }), 50);
  return m;
}

/* ─── Guerra de Bolas de Neve ─────────────────────────────── */

// Os muros dos raposinhos (do mais longe para o mais perto) e os lugares atrás de cada um.
const MUROS = [
  { x: 600, base: 236, w: 140, e: 1.05, spots: [565, 635] },
  { x: 452, base: 272, w: 150, e: 1.25, spots: [418, 488] },
  { x: 706, base: 314, w: 164, e: 1.45, spots: [664, 746] },
];
const GORROS = ['#e05a4a', '#7b5ab8', '#3a9a5a', '#2f6b9a', '#e07a2a'];
function muroDeNeve(g, x, base, w, e) {
  const alt = 46 * e;
  el(g, x, base + 3, w * 0.55, 8 * e, 'rgba(60,90,130,0.25)');
  ret(g, x - w / 2, base - alt, w, alt, grad(g, 0, base - alt, 0, base, [[0, '#ffffff'], [1, '#d0e2f2']]), 8 * e);
  const n = Math.max(3, Math.round(w / (30 * e)));
  const passo = w / n;
  for (let i = 0; i < n; i++) ret(g, x - w / 2 + i * passo + 2, base - alt - 12 * e, passo - 7, 15 * e, '#f6fbff', 4 * e);
  g.strokeStyle = 'rgba(140,170,205,0.45)';
  g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(x - w / 2 + 4, base - alt / 2); g.lineTo(x + w / 2 - 4, base - alt / 2); g.stroke();
}

export function abrirGuerraNeve(ctx) {
  const L = 800;
  const A = 450;
  const PX = 140;
  const PE = 1.9;
  const PISO = 404;
  const TOPO_MURO = 372;
  const meta = r => 4 + r * 2;
  const maxAtivos = r => Math.min(4, 1 + Math.ceil(r / 2));
  const tempoEmPe = r => Math.max(0.85, 2.1 - r * 0.22);
  const chanceJogar = r => Math.min(0.85, 0.3 + r * 0.11);
  const tempoVoo = r => Math.max(0.6, 1.25 - r * 0.11);
  const RODADAS = 5;
  return abrirJanela({
    titulo: 'Guerra de Bolas de Neve', largura: L, altura: A, jogo: 'neve_guerra', ctx,
    montar(api) {
      let e;
      let mira = { x: 560, y: 250 };
      const teclas = new Set();
      let segurando = false;
      const querAbaixar = () => teclas.size > 0 || segurando;

      function novo() {
        e = { situacao: 'inicio', rodada: 1, acertos: 0, total: 0, pontos: 0, vidas: 3, raposas: [], bolas: [], inimigas: [], agach: 0, recarga: 0, proxima: 1, popups: [], respingos: [], tremor: 0, banner: null };
        api.caixa(h('h2', null, 'Guerra de Bolas de Neve'),
          h('p', null, 'Os raposinhos estão escondidos atrás dos fortes! Clique (ou toque) neles para jogar uma bola de neve.'),
          h('p', { class: 'suave' }, 'Para fugir das bolas deles, abaixe atrás do muro: segure Espaço, a seta para baixo ou o botão Abaixar. O raposinho de gorro dourado vale 3. São 5 rodadas, cada uma mais difícil.'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; e.banner = { texto: 'Rodada 1', ate: 1.4 }; api.esconder(); } }));
      }
      api.reiniciar = novo;
      api.ouvir(api.tela, 'pointermove', ev => { mira = api.ponto(ev); });
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); mira = api.ponto(ev); jogar(mira); });
      api.ouvir(document, 'keydown', ev => { if (['Space', 'ArrowDown', 'KeyS'].includes(ev.code)) { ev.preventDefault(); teclas.add(ev.code); } });
      api.ouvir(document, 'keyup', ev => teclas.delete(ev.code));
      trocar(api.extra, h('div', { class: 'neve-botoes' }, api.botaoSegurar('Abaixar', v => { segurando = v; }, 'largo')));
      novo();

      const pe = f => ({ x: f.x, y: f.muro.base + 30 * f.muro.e - f.a * 56 * f.muro.e });
      const cabeca = f => { const p = pe(f); return { x: p.x - 6 * f.muro.e, y: p.y - 33 * f.muro.e, r: 20 * f.muro.e }; };
      const cabecaJogador = () => ({ x: PX + 11 * PE, y: PISO + e.agach * 56 - 27 * PE });

      function jogar(p) {
        if (e.situacao !== 'jogando' || e.banner || e.recarga > 0 || e.agach > 0.3 || p.x < 290) return;
        const x0 = PX + 26;
        const y0 = PISO - 40 * PE;
        const dist = Math.hypot(p.x - x0, p.y - y0);
        e.bolas.push({ x0, y0, x1: p.x, y1: p.y, t: 0, dur: 0.26 + dist / 1500, arco: dist * 0.22 });
        e.recarga = 0.36;
        som('pulo');
      }
      function surgir() {
        const ocupados = new Set(e.raposas.map(f => f.id));
        const livres = [];
        MUROS.forEach((m, i) => m.spots.forEach((x, j) => { if (!ocupados.has(i * 10 + j)) livres.push({ m, x, id: i * 10 + j }); }));
        if (!livres.length) return;
        const s = sortear(livres);
        const dourado = Math.random() < 0.08;
        e.raposas.push({
          muro: s.m, x: s.x, id: s.id, a: 0, fase: 'subindo', tempo: 0, emPe: tempoEmPe(e.rodada) + Math.random() * 0.6,
          jogar: Math.random() < chanceJogar(e.rodada), braco: 0, soltou: false, gorro: dourado ? '#e8c24a' : sortear(GORROS), dourado, atingido: 0, fase0: Math.random() * 6,
        });
      }
      function respingo(x, y, n = 8, cor = '255,255,255') {
        for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2; const v = 40 + Math.random() * 90; e.respingos.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, vida: 0.5 + Math.random() * 0.3, cor }); }
      }
      function proximaRodada() {
        e.pontos += 2;
        som('fase');
        if (e.rodada >= RODADAS) { acabar(true); return; }
        e.rodada++;
        e.acertos = 0;
        e.vidas = Math.min(3, e.vidas + 1);
        e.inimigas = [];
        for (const f of e.raposas) if (f.fase !== 'atingido') f.fase = 'descendo';
        e.banner = { texto: `Rodada ${e.rodada}`, ate: 1.6 };
        e.proxima = 1.8;
      }
      function acabar(venceu) {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        api.terminar(e.pontos, [venceu ? 'Você venceu os raposinhos!' : 'Os raposinhos venceram desta vez.', `${e.total} ${e.total === 1 ? 'raposinho acertado' : 'raposinhos acertados'} · rodada ${e.rodada}`, `${e.pontos} pontos`]);
      }

      function atualizar(dt) {
        const abaixa = querAbaixar();
        e.agach = limitar(e.agach + (abaixa ? 8 : -6) * dt, 0, 1);
        e.recarga = Math.max(0, e.recarga - dt);
        e.tremor = Math.max(0, e.tremor - dt);
        if (e.banner) { e.banner.ate -= dt; if (e.banner.ate <= 0) e.banner = null; }
        e.proxima -= dt;
        const ativas = e.raposas.filter(f => f.fase !== 'atingido' && f.fase !== 'descendo').length;
        if (!e.banner && e.proxima <= 0 && ativas < maxAtivos(e.rodada)) { surgir(); e.proxima = Math.max(0.35, 1.1 - e.rodada * 0.12) + Math.random() * 0.6; }
        for (const f of e.raposas) {
          f.tempo += dt;
          if (f.fase === 'subindo') { f.a = Math.min(1, f.a + dt * 4); if (f.a >= 1) { f.fase = 'em pe'; f.tempo = 0; } }
          else if (f.fase === 'em pe') {
            if (f.jogar && !f.soltou && f.tempo > f.emPe * 0.4) {
              f.braco = Math.min(1, f.braco + dt * 3.5);
              if (f.braco >= 1) {
                f.soltou = true;
                const alvo = cabecaJogador();
                const erra = Math.random() < 0.18;
                const mao = { x: pe(f).x - 3 * f.muro.e, y: pe(f).y - 44 * f.muro.e };
                const x1 = PX + 11 * PE + (erra ? 50 + Math.random() * 40 : (Math.random() - 0.5) * 16);
                const y1 = PISO - 27 * PE + (erra ? -30 : (Math.random() - 0.5) * 14);
                e.inimigas.push({ x0: mao.x, y0: mao.y, x1, y1, t: 0, dur: tempoVoo(e.rodada), arco: 60 + Math.random() * 40, erra, alvo });
              }
            } else if (f.soltou) f.braco = Math.max(0, f.braco - dt * 3);
            if (f.tempo > f.emPe + (f.jogar ? 0.4 : 0)) f.fase = 'descendo';
          } else if (f.fase === 'descendo') { f.a -= dt * 4; if (f.a <= 0) f.fim = true; }
          else if (f.fase === 'atingido') { f.atingido += dt; if (f.atingido > 0.55) f.a -= dt * 5; if (f.a <= 0) f.fim = true; }
        }
        e.raposas = e.raposas.filter(f => !f.fim);
        // As minhas bolas
        for (const b of e.bolas) {
          b.t += dt;
          if (b.t < b.dur) continue;
          b.fim = true;
          let acertou = null;
          for (const f of e.raposas) {
            if (f.fase === 'atingido' || f.a < 0.55) continue;
            const c = cabeca(f);
            if (Math.hypot(b.x1 - c.x, b.y1 - c.y) < c.r + 7) { acertou = f; break; }
          }
          if (acertou) {
            acertou.fase = 'atingido';
            acertou.atingido = 0;
            const v = acertou.dourado ? 3 : 1;
            e.pontos += v;
            e.acertos++;
            e.total++;
            e.popups.push({ x: b.x1, y: b.y1 - 20, texto: v > 1 ? `+${v}!` : '+1', ate: 1, cor: v > 1 ? '#ffe46b' : '#ffffff' });
            som(v > 1 ? 'moeda' : 'pisao');
            respingo(b.x1, b.y1, 12);
            if (e.acertos >= meta(e.rodada)) proximaRodada();
          } else respingo(b.x1, b.y1, 7);
        }
        e.bolas = e.bolas.filter(b => !b.fim);
        // As bolas dos raposinhos
        for (const b of e.inimigas) {
          b.t += dt;
          if (b.t < b.dur) continue;
          b.fim = true;
          if (!b.erra && e.agach < 0.5) {
            e.vidas--;
            e.tremor = 0.4;
            som('bater');
            respingo(b.x1, b.y1, 14);
            e.popups.push({ x: PX + 20, y: PISO - 120, texto: 'Ploft!', ate: 0.9, cor: '#ff9a9a' });
            if (e.vidas <= 0) { acabar(false); return; }
          } else respingo(b.x1, Math.max(b.y1, TOPO_MURO - 6), 8);
        }
        e.inimigas = e.inimigas.filter(b => !b.fim);
        for (const p of e.popups) { p.ate -= dt; p.y -= 30 * dt; }
        e.popups = e.popups.filter(p => p.ate > 0);
        for (const r of e.respingos) { r.vida -= dt; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 300 * dt; }
        e.respingos = e.respingos.filter(r => r.vida > 0);
      }

      const posBola = (b, f) => ({ x: b.x0 + (b.x1 - b.x0) * f, y: b.y0 + (b.y1 - b.y0) * f - Math.sin(f * Math.PI) * b.arco });
      function desenhar(t) {
        const g = api.g;
        g.save();
        if (e.tremor > 0) g.translate((Math.random() - 0.5) * 10 * e.tremor, (Math.random() - 0.5) * 10 * e.tremor);
        g.fillStyle = grad(g, 0, 0, 0, 220, [[0, '#7fb3e0'], [1, '#e6f2fb']]);
        g.fillRect(-10, -10, L + 20, 240);
        montanha(g, 160, 222, 380, 130, '#a9bfd6');
        montanha(g, 470, 222, 300, 100, '#9db4cc');
        montanha(g, 700, 222, 420, 160, '#a3b9d1');
        g.fillStyle = grad(g, 0, 210, 0, A, [[0, '#e3eef8'], [1, '#fbfdff']]);
        g.fillRect(-10, 212, L + 20, A);
        for (const [x, s] of [[320, 0.7], [380, 0.6], [770, 0.75], [520, 0.55]]) pinheiro(g, x, 222, s);
        // Os muros e os raposinhos (cada um atrás do seu muro)
        for (const m of MUROS) {
          for (const f of e.raposas) {
            if (f.muro !== m) continue;
            const p = pe(f);
            g.save();
            g.beginPath();
            g.rect(0, 0, L, m.base - 4);
            g.clip();
            g.translate(p.x, p.y);
            g.scale(m.e, m.e);
            raposinho(g, 0, 0, { dir: -1, t: t + f.fase0, gorro: f.gorro, arremesso: f.braco, bola: !f.soltou });
            g.restore();
            if (f.fase === 'atingido') {
              const c = cabeca(f);
              el(g, c.x + 4, c.y + 2, 10 * m.e, 8 * m.e, 'rgba(255,255,255,0.9)');
              for (let k = 0; k < 3; k++) { const a = t * 6 + (k * Math.PI * 2) / 3; escrever(g, '★', c.x + Math.cos(a) * 18 * m.e, c.y - 18 * m.e + Math.sin(a) * 5, '#ffe46b', '700 12px sans-serif'); }
            }
          }
          muroDeNeve(g, m.x, m.base, m.w, m.e);
        }
        for (const b of e.inimigas) {
          const f = Math.min(1, b.t / b.dur);
          const p = posBola(b, f);
          el(g, p.x, p.y, 5 + f * 5, 5 + f * 5, '#ffffff');
          el(g, p.x - 2, p.y - 2, 2 + f, 2 + f, '#eef6ff');
        }
        // Eu, atrás do meu forte
        const pisoAgora = PISO + e.agach * 56;
        g.save();
        g.translate(PX, pisoAgora);
        g.scale(PE, PE);
        desenharCoelho(g, 0, 0, { pelo: ctx.visual?.cor, roupa: ctx.visual?.roupa, dir: 1, t });
        if (e.recarga <= 0 && e.agach < 0.3 && e.situacao === 'jogando') el(g, 22, -22, 4.5, 4.5, '#ffffff');
        g.restore();
        g.fillStyle = grad(g, 0, TOPO_MURO, 0, A, [[0, '#ffffff'], [1, '#cfe1f1']]);
        g.beginPath();
        g.moveTo(-10, TOPO_MURO + 6);
        g.lineTo(240, TOPO_MURO + 6);
        g.quadraticCurveTo(290, TOPO_MURO + 30, 300, A + 10);
        g.lineTo(-10, A + 10);
        g.closePath();
        g.fill();
        for (let i = 0; i < 6; i++) ret(g, -6 + i * 42, TOPO_MURO - 8, 34, 18, '#f6fbff', 6);
        for (let k = 0; k < 4; k++) el(g, 40 + k * 20, TOPO_MURO + 40 + (k % 2) * 8, 8, 8, '#eef5fb');
        // Aviso: bola chegando
        const perigo = e.inimigas.some(b => !b.erra && b.dur - b.t < 0.55);
        if (perigo && e.agach < 0.5) escrever(g, '!', PX + 18, pisoAgora - 120 + Math.sin(t * 20) * 2, '#ff6b6b', '700 30px sans-serif');
        for (const b of e.bolas) {
          const f = Math.min(1, b.t / b.dur);
          const p = posBola(b, f);
          el(g, p.x, p.y, 7 * (1 - f * 0.45), 7 * (1 - f * 0.45), '#ffffff');
        }
        for (const r of e.respingos) el(g, r.x, r.y, 3 * Math.max(0, r.vida * 2), 3 * Math.max(0, r.vida * 2), `rgba(${r.cor},${Math.min(1, r.vida * 2)})`);
        nevar(g, t, { n: 40, x1: L, y1: A, semente: 5, vento: 20 });
        g.restore();
        if (e.tremor > 0) { g.fillStyle = `rgba(255,80,80,${e.tremor * 0.4})`; g.fillRect(0, 0, L, A); }
        // A mira
        if (e.situacao === 'jogando' && e.agach < 0.3 && mira.x > 290) {
          g.strokeStyle = e.recarga > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(224,90,74,0.9)';
          g.lineWidth = 2;
          g.beginPath(); g.arc(mira.x, mira.y, 14, 0, Math.PI * 2); g.stroke();
          linha(g, g.strokeStyle, 2, [mira.x - 20, mira.y, mira.x - 8, mira.y]);
          linha(g, g.strokeStyle, 2, [mira.x + 8, mira.y, mira.x + 20, mira.y]);
          linha(g, g.strokeStyle, 2, [mira.x, mira.y - 20, mira.x, mira.y - 8]);
          linha(g, g.strokeStyle, 2, [mira.x, mira.y + 8, mira.x, mira.y + 20]);
        }
        for (const p of e.popups) escrever(g, p.texto, p.x, p.y, p.cor, '700 20px "Cinzel", Georgia, serif');
        for (let k = 0; k < 3; k++) coracao(g, 26 + k * 30, 28, 11, k < e.vidas ? '#e05a6a' : 'rgba(0,0,0,0.2)');
        escrever(g, `Rodada ${e.rodada} de ${RODADAS}`, L - 20, 22, '#ffffff', '700 17px "Cinzel", Georgia, serif', 'right');
        escrever(g, `Acertos: ${e.acertos} de ${meta(e.rodada)}`, L - 20, 46, '#ffe46b', '700 15px "Cinzel", Georgia, serif', 'right');
        escrever(g, `${e.pontos} pontos`, L / 2, 22, '#ffffff', '700 17px "Cinzel", Georgia, serif');
        if (e.banner) {
          g.fillStyle = 'rgba(14,24,40,0.55)';
          g.fillRect(0, A / 2 - 40, L, 80);
          escrever(g, e.banner.texto, L / 2, A / 2, '#ffe46b', '700 38px "Cinzel", Georgia, serif');
        }
      }
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Corrida de Trenó ────────────────────────────────────── */

const RIVAIS = [
  { nome: 'Pipoca', cor: '#f7f3ea', cachecol: '#e05a4a', treno: '#c0392b', fator: 0.95, juizo: 0.78 },
  { nome: 'Fubá', cor: '#c99a6b', cachecol: '#2f6b9a', treno: '#2f6b9a', fator: 0.975, juizo: 0.85 },
  { nome: 'Nevasca', cor: '#9aa3ad', cachecol: '#3a8a5a', treno: '#3a8a5a', fator: 1, juizo: 0.92 },
];
export function gerarPistaTreno(semente, comprimento = 15000) {
  const rnd = sorte(semente);
  const obst = [];
  let y = 650;
  while (y < comprimento - 450) {
    const n = rnd() < 0.38 ? 2 : 1;
    const usados = [];
    for (let k = 0; k < n; k++) {
      let x = 0;
      let tent = 0;
      do { x = 80 + rnd() * 440; tent++; } while (usados.some(u => Math.abs(u - x) < 150) && tent < 12);
      usados.push(x);
      const r = rnd();
      const tipo = r < 0.33 ? 'pedra' : r < 0.6 ? 'arvore' : r < 0.8 ? 'gelo' : 'turbo';
      obst.push({ tipo, x, y: y + rnd() * 40, id: obst.length });
    }
    y += 130 + rnd() * 100 - Math.min(40, (y / comprimento) * 40);
  }
  return obst;
}
const ORDINAL = n => `${n}º`;

function desenharTrenoDeCima(g, r, sy, t) {
  g.save();
  g.translate(r.x, sy);
  if (r.turbo > 0) {
    for (let k = 0; k < 5; k++) {
      const f = (t * 6 + k / 5) % 1;
      el(g, (hash(k, Math.floor(t * 6)) - 0.5) * 14, -26 - f * 30, 6 * (1 - f), 6 * (1 - f), `rgba(255,${180 - f * 80},60,${1 - f})`);
    }
  }
  g.rotate(r.giro > 0 ? r.giro * 14 : -r.vx / 1500);
  el(g, 4, 5, 17, 27, 'rgba(40,60,90,0.18)');
  ret(g, -16, -24, 4, 50, '#5b3c22', 2);
  ret(g, 12, -24, 4, 50, '#5b3c22', 2);
  ret(g, -14, -20, 28, 40, r.treno, 7);
  ret(g, -14, -20, 28, 6, 'rgba(255,255,255,0.3)', 3);
  const orelha = 9 + Math.min(6, r.v / 90);
  const balanco = Math.sin(t * 9) * 0.08;
  el(g, 0, -4, 11, 12, r.cor);
  ret(g, -9, 1, 18, 5, r.cachecol, 2);
  ret(g, 4, 2, 4, 10, r.cachecol, 2);
  el(g, 0, 9, 8.5, 8, r.cor);
  for (const s of [-1, 1]) {
    el(g, s * 4, 7 - orelha / 2, 2.8, orelha / 2 + 2, r.cor, s * (0.18 + balanco));
    el(g, s * 4, 7 - orelha / 2, 1.2, orelha / 2, '#e9a7a0', s * (0.18 + balanco));
  }
  el(g, 0, -15, 4.5, 4.5, '#fbf8f1');
  g.restore();
}
function obstaculoTreno(g, o, sy, t) {
  if (o.tipo === 'pedra') {
    el(g, o.x + 3, sy + 8, 24, 8, 'rgba(40,60,90,0.18)');
    el(g, o.x, sy, 22, 17, '#7d7a76');
    el(g, o.x - 5, sy - 5, 12, 8, '#9a968f');
    el(g, o.x - 2, sy - 12, 14, 5, '#f7fbff');
  } else if (o.tipo === 'arvore') {
    pinheiro(g, o.x, sy + 18, 0.62);
  } else if (o.tipo === 'gelo') {
    el(g, o.x, sy, 46, 18, 'rgba(150,215,245,0.85)');
    el(g, o.x, sy, 40, 14, 'rgba(190,235,255,0.9)');
    linha(g, 'rgba(255,255,255,0.9)', 2, [o.x - 24, sy - 4, o.x - 6, sy - 8]);
    linha(g, 'rgba(255,255,255,0.7)', 2, [o.x + 4, sy + 6, o.x + 22, sy + 2]);
  } else {
    brilho(g, o.x, sy, 34, 'rgba(255,200,60,A)', 0.35 + Math.sin(t * 8) * 0.1);
    ret(g, o.x - 20, sy - 22, 40, 44, '#e8a830', 8);
    for (let k = 0; k < 2; k++) {
      const yy = sy - 12 + k * 14 + ((t * 30) % 6);
      linha(g, '#ffffff', 4, [o.x - 12, yy - 4, o.x, yy + 4, o.x + 12, yy - 4]);
    }
  }
}

export function abrirCorridaTreno(ctx) {
  const L = 600;
  const A = 450;
  const LEN = 15000;
  const TELA_Y = 130;
  return abrirJanela({
    titulo: 'Corrida de Trenó', largura: L, altura: A, jogo: 'neve_treno', ctx,
    montar(api) {
      let e;
      const teclas = new Set();
      let alvoX = null;
      let melhor = null;
      ctx.progresso?.ler('neve.treno').then(v => { melhor = v; }).catch(() => {});

      function novo() {
        const faixas = [120, 240, 360, 480];
        const eu = { nome: 'Você', cor: ctx.visual?.cor || '#e9dcc3', cachecol: '#e8c24a', treno: '#7b5ab8', x: faixas[1], y: 0, v: 0, vx: 0, giro: 0, turbo: 0, gelo: 0, chegou: null, cpu: null, fator: 1 };
        const outros = RIVAIS.map((r, k) => ({ ...r, x: faixas[[0, 2, 3][k]], y: 0, v: 0, vx: 0, giro: 0, turbo: 0, gelo: 0, chegou: null, cpu: { faixa: faixas[[0, 2, 3][k]], pensar: 0, desejado: 0 } }));
        e = { situacao: 'inicio', obst: gerarPistaTreno(Date.now() & 0xffff, LEN), eu, corredores: [eu, ...outros], ordem: [], tempo: 0, contagem: 3.2, popups: [], fimEm: 0 };
        api.caixa(h('h2', null, 'Corrida de Trenó'),
          h('p', null, 'Desça a montanha contra três coelhos! Desvie das pedras e das árvores, pegue as setas de turbo e cuidado com o gelo, que faz o trenó escorregar.'),
          h('p', { class: 'suave' }, 'Setas (ou A e D) para virar. No mouse ou no dedo, o trenó segue para onde você aponta.'),
          melhor ? h('p', { class: 'suave' }, `Seu melhor: ${ORDINAL(melhor)} lugar.`) : null,
          botao('Largar!', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; api.esconder(); som('alerta'); } }));
      }
      api.reiniciar = novo;
      api.ouvir(document, 'keydown', ev => { if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(ev.code)) { ev.preventDefault(); teclas.add(ev.code); } });
      api.ouvir(document, 'keyup', ev => teclas.delete(ev.code));
      let apertando = false;
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); apertando = true; alvoX = api.ponto(ev).x; api.tela.setPointerCapture?.(ev.pointerId); });
      api.ouvir(api.tela, 'pointermove', ev => { if (apertando || ev.pointerType === 'mouse') alvoX = api.ponto(ev).x; });
      const soltar = ev => { apertando = false; if (ev.pointerType !== 'mouse') alvoX = null; };
      api.ouvir(api.tela, 'pointerup', soltar);
      api.ouvir(api.tela, 'pointercancel', soltar);
      api.ouvir(api.tela, 'pointerleave', () => { if (!apertando) alvoX = null; });
      const esq = api.botaoSegurar('◀', v => { if (v) teclas.add('btnE'); else teclas.delete('btnE'); });
      const dir = api.botaoSegurar('▶', v => { if (v) teclas.add('btnD'); else teclas.delete('btnD'); });
      trocar(api.extra, h('div', { class: 'neve-botoes' }, esq, dir));
      novo();

      function desejoJogador(r) {
        const esquerda = teclas.has('ArrowLeft') || teclas.has('KeyA') || teclas.has('btnE');
        const direita = teclas.has('ArrowRight') || teclas.has('KeyD') || teclas.has('btnD');
        if (esquerda && !direita) return -330;
        if (direita && !esquerda) return 330;
        if (alvoX != null) return limitar((alvoX - r.x) * 4, -330, 330);
        return 0;
      }
      function pensarCpu(r, dt) {
        const c = r.cpu;
        c.pensar -= dt;
        if (c.pensar > 0) return c.desejado;
        c.pensar = 0.1 + Math.random() * 0.12;
        if (Math.random() < 0.02) c.faixa = 90 + Math.random() * 420;
        let perigo = null;
        for (const o of e.obst) {
          if (o.y < r.y + 10 || o.y > r.y + 250 || (o.tipo !== 'pedra' && o.tipo !== 'arvore')) continue;
          if (Math.abs(o.x - r.x) < 42 && (!perigo || o.y < perigo.y)) perigo = o;
        }
        let alvo = c.faixa;
        if (perigo && Math.random() < r.juizo) {
          alvo = perigo.x + (r.x < perigo.x ? -75 : 75);
          if (alvo < 60) alvo = perigo.x + 75;
          if (alvo > 540) alvo = perigo.x - 75;
        } else {
          const turbo = e.obst.find(o => o.tipo === 'turbo' && o.y > r.y + 60 && o.y < r.y + 300 && Math.abs(o.x - r.x) < 150);
          if (turbo && Math.random() < r.juizo * 0.7) alvo = turbo.x;
        }
        c.desejado = limitar((alvo - r.x) * 3.5, -300, 300);
        return c.desejado;
      }
      function atualizar(dt) {
        if (e.contagem > 0) {
          const antes = Math.ceil(e.contagem);
          e.contagem -= dt;
          if (Math.ceil(e.contagem) !== antes && e.contagem > 0) som('alerta');
          if (e.contagem <= 0) som('poder');
          return;
        }
        e.tempo += dt;
        for (const r of e.corredores) {
          if (r.chegou != null) { r.v = Math.max(0, r.v - 260 * dt); r.y += r.v * dt; continue; }
          let fator = r.fator || 1;
          if (r.cpu) { const dif = r.y - e.eu.y; if (dif < -450) fator *= 1.08; else if (dif > 650) fator *= 0.93; }
          const vmax = 470 * fator * (r.turbo > 0 ? 1.45 : 1);
          if (r.giro > 0) { r.giro -= dt; r.v = Math.max(90, r.v - 320 * dt); }
          else r.v += Math.sign(vmax - r.v) * Math.min(Math.abs(vmax - r.v), (r.turbo > 0 ? 520 : 170) * dt);
          r.turbo = Math.max(0, r.turbo - dt);
          r.gelo = Math.max(0, r.gelo - dt);
          let desejado = r.cpu ? pensarCpu(r, dt) : desejoJogador(r);
          if (r.giro > 0) desejado = 0;
          const resposta = r.gelo > 0 ? 1.1 : 7;
          r.vx += (desejado - r.vx) * Math.min(1, resposta * dt);
          r.x += r.vx * dt;
          if (r.x < 48) { r.x = 48; r.vx = Math.abs(r.vx) * 0.3; r.v *= 1 - 0.9 * dt; }
          if (r.x > 552) { r.x = 552; r.vx = -Math.abs(r.vx) * 0.3; r.v *= 1 - 0.9 * dt; }
          r.y += r.v * dt;
          for (const o of e.obst) {
            const dy = o.y - r.y;
            if (dy < -30 || dy > 30) continue;
            const dx = o.x - r.x;
            if (o.tipo === 'pedra' || o.tipo === 'arvore') {
              if (r.giro <= 0 && Math.hypot(dx, dy) < (o.tipo === 'pedra' ? 26 : 24)) {
                r.giro = 0.9;
                r.v = Math.min(r.v, 140);
                if (!r.cpu) { som('bater'); e.popups.push({ x: r.x, texto: 'Opa!', ate: 0.9, cor: '#ff9a9a' }); }
              }
            } else if (o.tipo === 'gelo') {
              if (Math.abs(dx) < 46 && Math.abs(dy) < 16) { if (!r.cpu && r.gelo <= 0) e.popups.push({ x: r.x, texto: 'Escorregou!', ate: 0.9, cor: '#a8e0ff' }); r.gelo = 0.9; }
            } else if (Math.abs(dx) < 26 && Math.abs(dy) < 24 && r.turboPego !== o.id) {
              r.turboPego = o.id;
              r.turbo = 1.5;
              if (!r.cpu) { som('poder'); e.popups.push({ x: r.x, texto: 'Turbo!', ate: 0.9, cor: '#ffe46b' }); }
            }
          }
          if (r.y >= LEN) {
            r.chegou = e.tempo;
            e.ordem.push(r);
            if (!r.cpu) { e.fimEm = 1.6; som(e.ordem.length === 1 ? 'vida' : 'fim'); }
          }
        }
        for (const p of e.popups) p.ate -= dt;
        e.popups = e.popups.filter(p => p.ate > 0);
        if (e.eu.chegou != null) {
          e.fimEm -= dt;
          if (e.fimEm <= 0 && e.situacao === 'jogando') acabar();
        }
      }
      function posicaoAgora(r) {
        if (r.chegou != null) return e.ordem.indexOf(r) + 1;
        return e.ordem.length + 1 + e.corredores.filter(o => o !== r && o.chegou == null && o.y > r.y).length;
      }
      async function acabar() {
        e.situacao = 'fim';
        const pos = e.ordem.indexOf(e.eu) + 1;
        const linhas = [pos === 1 ? 'Você venceu a corrida!' : `Você chegou em ${ORDINAL(pos)} lugar.`, `Tempo: ${e.eu.chegou.toFixed(1)} s`];
        if (melhor == null || pos < melhor) {
          if (melhor != null) linhas.push('É o seu melhor lugar até agora!');
          try { melhor = await ctx.progresso.gravar('neve.treno', pos); } catch { /* fica para a próxima */ }
        }
        api.terminar(5 - pos, linhas);
      }

      function desenhar(t) {
        const g = api.g;
        const cam = e.eu.y - TELA_Y;
        g.fillStyle = '#f2f7fc';
        g.fillRect(0, 0, L, A);
        const b0 = Math.floor(cam / 50) - 1;
        for (let b = b0; b < b0 + A / 50 + 3; b++) {
          const sy = b * 50 - cam;
          el(g, 60 + hash(b, 21) * 480, sy, 30 + hash(b, 22) * 50, 3, 'rgba(140,175,215,0.22)');
          el(g, 60 + hash(b, 23) * 480, sy + 20, 1.6, 1.6, '#ffffff');
        }
        g.fillStyle = grad(g, 0, 0, 44, 0, [[0, '#d8e6f2'], [1, '#f2f7fc']]);
        g.fillRect(0, 0, 44, A);
        g.fillStyle = grad(g, L - 44, 0, L, 0, [[0, '#f2f7fc'], [1, '#d8e6f2']]);
        g.fillRect(L - 44, 0, 44, A);
        const larg0 = Math.floor(cam / 110) - 1;
        const arvores = [];
        for (let b = larg0; b < larg0 + A / 110 + 3; b++) for (const lado of [0, 1]) arvores.push([lado ? L - 18 + hash(b, 30 + lado) * 10 : 14 + hash(b, 30) * 10, b * 110 - cam + hash(b, 32 + lado) * 50, 0.55 + hash(b, 34 + lado) * 0.25]);
        // A largada e a chegada
        if (-cam > -40 && -cam < A + 40) { ret(g, 44, -cam - 4, L - 88, 8, '#c0392b'); }
        const yChegada = LEN - cam;
        if (yChegada > -60 && yChegada < A + 60) {
          for (let k = 0; k < 26; k++) for (let j = 0; j < 2; j++) ret(g, 44 + k * 20, yChegada + j * 10 - 10, 20, 10, (k + j) % 2 ? '#1b1b22' : '#ffffff');
          ret(g, 44, yChegada - 70, 8, 70, '#7a4a2a');
          ret(g, L - 52, yChegada - 70, 8, 70, '#7a4a2a');
          ret(g, 44, yChegada - 78, L - 88, 26, '#e8c24a', 4);
          escrever(g, 'Chegada', L / 2, yChegada - 65, '#2a1c08', '700 17px "Cinzel", Georgia, serif');
        }
        const visiveis = e.obst.filter(o => o.y - cam > -60 && o.y - cam < A + 60);
        for (const o of visiveis) if (o.tipo === 'gelo' || o.tipo === 'turbo') obstaculoTreno(g, o, o.y - cam, t);
        const emPe = [...visiveis.filter(o => o.tipo === 'pedra' || o.tipo === 'arvore').map(o => ({ y: o.y - cam, f: () => obstaculoTreno(g, o, o.y - cam, t) })),
          ...arvores.map(([x, y, s]) => ({ y, f: () => pinheiro(g, x, y, s) })),
          ...e.corredores.map(r => ({ y: r.y - cam, f: () => desenharTrenoDeCima(g, r, r.y - cam, t) }))];
        emPe.sort((a, b) => a.y - b.y).forEach(o => o.f());
        for (const r of e.corredores) {
          const sy = r.y - cam;
          if (sy < -40 || sy > A + 40) continue;
          ret(g, r.x - 26, sy - 46, 52, 16, r.cpu ? 'rgba(14,24,40,0.6)' : 'rgba(216,177,58,0.92)', 8);
          escrever(g, r.nome, r.x, sy - 38, r.cpu ? '#ffffff' : '#1b1403', '700 11px "Cinzel", Georgia, serif');
        }
        // Quem está fora da tela aparece numa setinha
        for (const r of e.corredores) {
          if (!r.cpu) continue;
          const sy = r.y - cam;
          if (sy < -30) { forma(g, r.treno, [r.x - 8, 14, r.x + 8, 14, r.x, 4]); }
          else if (sy > A + 30) { forma(g, r.treno, [r.x - 8, A - 14, r.x + 8, A - 14, r.x, A - 4]); }
        }
        for (const p of e.popups) escrever(g, p.texto, p.x, TELA_Y - 60 - (0.9 - p.ate) * 30, p.cor, '700 18px "Cinzel", Georgia, serif');
        nevar(g, t, { n: 30, x1: L, y1: A, semente: 9, vel: -60 - e.eu.v * 0.3, vento: 10 });
        // Placar: a posição, a barra da descida e o turbo
        ret(g, 10, 10, 74, 50, 'rgba(14,24,40,0.65)', 10);
        escrever(g, ORDINAL(posicaoAgora(e.eu)), 47, 36, '#ffe46b', '700 30px "Cinzel", Georgia, serif');
        ret(g, L - 22, 20, 8, A - 40, 'rgba(14,24,40,0.3)', 4);
        for (const r of e.corredores) el(g, L - 18, 20 + (A - 40) * limitar(r.y / LEN, 0, 1), r.cpu ? 6 : 8, r.cpu ? 6 : 8, r.cpu ? r.treno : '#e8c24a');
        if (e.eu.turbo > 0) escrever(g, 'TURBO!', L / 2, A - 26, '#ffb030', '700 22px "Cinzel", Georgia, serif');
        escrever(g, `${e.tempo.toFixed(1)} s`, 96, 36, '#ffffff', '700 15px "Cinzel", Georgia, serif', 'left');
        if (e.situacao === 'jogando' && e.contagem > 0) {
          const n = Math.ceil(e.contagem);
          escrever(g, n > 3 ? '3' : String(n), L / 2, A / 2 - 30, '#ffffff', '700 70px "Cinzel", Georgia, serif');
        } else if (e.situacao === 'jogando' && e.tempo < 0.8) escrever(g, 'Já!', L / 2, A / 2 - 30, '#ffe46b', '700 70px "Cinzel", Georgia, serif');
        if (e.eu.chegou != null) {
          g.fillStyle = 'rgba(14,24,40,0.5)';
          g.fillRect(0, A / 2 - 40, L, 80);
          escrever(g, `${ORDINAL(e.ordem.indexOf(e.eu) + 1)} lugar!`, L / 2, A / 2, '#ffe46b', '700 40px "Cinzel", Georgia, serif');
        }
      }
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Mina de Ouro ────────────────────────────────────────── */

export function gerarMina(rnd = Math.random, COLS = 14, ROWS = 8) {
  const grade = [];
  for (let gy = 0; gy < ROWS; gy++) {
    const fileira = [];
    const fundo = gy / (ROWS - 1);
    for (let gx = 0; gx < COLS; gx++) {
      let tipo = 'terra';
      let ouro = 0;
      const r = rnd();
      const pRocha = gy > 0 ? 0.05 + fundo * 0.09 : 0;
      if (r < pRocha) tipo = 'rocha';
      else if (r < pRocha + 0.11) tipo = 'pedra';
      if (gy === 0 && gx <= 1) tipo = 'terra';
      if (tipo === 'terra') {
        const o = rnd();
        if (gy >= 5 && o < 0.035) ouro = 5;
        else if (gy >= 3 && o < 0.09) ouro = 3;
        else if (o < 0.17 + fundo * 0.07) ouro = 1;
      }
      fileira.push({ tipo, ouro, item: 0, balanca: 0, cai: false, passo: 0 });
    }
    grade.push(fileira);
  }
  return grade;
}

export function abrirMinaOuro(ctx) {
  const COLS = 14;
  const ROWS = 8;
  const C = 40;
  const TOPO = 100;
  const L = COLS * C;
  const A = TOPO + ROWS * C;
  const CARGA = 3;
  const DIRS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  return abrirJanela({
    titulo: 'Mina de Ouro', largura: L, altura: A, jogo: 'neve_mina', ctx,
    montar(api) {
      let e;
      const teclas = [];
      let toque = null;
      function novo() {
        e = { situacao: 'inicio', tempo: 60, pontos: 0, entregues: 0, grade: gerarMina(Math.random, COLS, ROWS), j: { gx: 2, gy: -1, mov: null, carga: [], tonto: 0, dir: 1 }, popups: [], poeira: [], avisoCheio: 0 };
        api.caixa(h('h2', null, 'Mina de Ouro'),
          h('p', null, 'Cave com a britadeira para achar pepitas (a terra com pontinhos dourados esconde ouro). Leve até 3 de cada vez e volte ao carrinho, lá em cima à esquerda, para guardar.'),
          h('p', { class: 'suave' }, 'Setas ou W A S D para andar e cavar (no celular, segure o dedo para o lado em que quer ir). Cuidado: se cavar embaixo de uma pedra solta, ela balança e cai! Rocha escura não dá para cavar. Pepita grande vale 3, a pedra preciosa vale 5. Você tem 60 segundos.'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; api.esconder(); } }));
      }
      api.reiniciar = novo;
      api.ouvir(document, 'keydown', ev => { const d = DIRS[ev.code]; if (!d) return; ev.preventDefault(); if (!teclas.includes(ev.code)) teclas.push(ev.code); });
      api.ouvir(document, 'keyup', ev => { const i = teclas.indexOf(ev.code); if (i >= 0) teclas.splice(i, 1); });
      const ondeEstou = () => { const j = e.j; const f = j.mov ? j.mov.f : 0; const gx = j.mov ? j.gx + (j.mov.gx - j.gx) * f : j.gx; const gy = j.mov ? j.gy + (j.mov.gy - j.gy) * f : j.gy; return { x: gx * C + C / 2, y: TOPO + gy * C + C / 2 }; };
      function direcaoDoToque(p) {
        const eu = ondeEstou();
        const dx = p.x - eu.x;
        const dy = p.y - eu.y;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return null;
        return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      }
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); toque = api.ponto(ev); api.tela.setPointerCapture?.(ev.pointerId); });
      api.ouvir(api.tela, 'pointermove', ev => { if (toque) toque = api.ponto(ev); });
      for (const tipo of ['pointerup', 'pointercancel']) api.ouvir(api.tela, tipo, () => { toque = null; });
      const seta = (rot, d) => api.botaoSegurar(rot, v => { if (v) teclas.push(`btn${d}`); else { const i = teclas.indexOf(`btn${d}`); if (i >= 0) teclas.splice(i, 1); } });
      DIRS.btnE = [-1, 0]; DIRS.btnD = [1, 0]; DIRS.btnC = [0, -1]; DIRS.btnB = [0, 1];
      trocar(api.extra, h('div', { class: 'neve-botoes cruz' }, seta('▲', 'C'), seta('◀', 'E'), seta('▼', 'B'), seta('▶', 'D')));
      novo();

      const celula = (gx, gy) => (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS ? e.grade[gy][gx] : null);
      function direcao() {
        if (teclas.length) return DIRS[teclas[teclas.length - 1]];
        if (toque) return direcaoDoToque(toque);
        return null;
      }
      function tentarMover([dx, dy]) {
        const j = e.j;
        if (dx) j.dir = dx;
        const nx = j.gx + dx;
        const ny = j.gy + dy;
        if (nx < 0 || nx >= COLS || ny < -1 || ny >= ROWS) return;
        if (ny === -1) { j.mov = { gx: nx, gy: ny, f: 0, dur: 0.13, cavando: false }; return; }
        const c = celula(nx, ny);
        if (c.tipo === 'rocha' || c.tipo === 'pedra') return;
        if (c.tipo === 'terra') { j.mov = { gx: nx, gy: ny, f: 0, dur: 0.34, cavando: true }; som('passo'); }
        else j.mov = { gx: nx, gy: ny, f: 0, dur: 0.13, cavando: false };
      }
      function poeira(x, y, n = 6, cor = '160,120,80') {
        for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2; const v = 30 + Math.random() * 70; e.poeira.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.4 + Math.random() * 0.3, cor }); }
      }
      function chegou() {
        const j = e.j;
        if (j.gy === -1) {
          if (j.gx <= 1 && j.carga.length) {
            const soma = j.carga.reduce((a, b) => a + b, 0);
            e.pontos += soma;
            e.entregues += j.carga.length;
            e.popups.push({ x: 60, y: 60, texto: `+${soma}`, ate: 1.1, cor: '#ffe46b' });
            j.carga = [];
            som('vida');
          }
          return;
        }
        const c = celula(j.gx, j.gy);
        if (c.item) {
          if (j.carga.length < CARGA) {
            j.carga.push(c.item);
            e.popups.push({ x: j.gx * C + C / 2, y: TOPO + j.gy * C, texto: c.item === 5 ? 'Pedra preciosa!' : c.item === 3 ? 'Pepitona!' : 'Pepita!', ate: 0.9, cor: c.item === 5 ? '#9af0ff' : '#ffe46b' });
            c.item = 0;
            som('moeda');
          } else if (e.avisoCheio <= 0) {
            e.popups.push({ x: j.gx * C + C / 2, y: TOPO + j.gy * C, texto: 'Mochila cheia!', ate: 1, cor: '#ffb0a0' });
            e.avisoCheio = 2;
          }
        }
      }
      function atingir() {
        const j = e.j;
        j.tonto = 1.6;
        const perdeu = j.carga.length;
        j.carga = [];
        som('bater');
        const p = ondeEstou();
        e.popups.push({ x: p.x, y: p.y - 20, texto: perdeu ? 'Desabou! Perdeu as pepitas.' : 'Desabou!', ate: 1.3, cor: '#ff9a9a' });
        poeira(p.x, p.y, 14, '150,140,130');
      }
      function ocupaJogador(gx, gy) {
        const j = e.j;
        return (j.gx === gx && j.gy === gy) || (j.mov && j.mov.gx === gx && j.mov.gy === gy);
      }
      function atualizar(dt) {
        e.tempo -= dt;
        e.avisoCheio -= dt;
        if (e.tempo <= 0) { e.tempo = 0; acabar(); return; }
        const j = e.j;
        if (j.tonto > 0) j.tonto -= dt;
        if (j.mov) {
          j.mov.f += dt / j.mov.dur;
          if (j.mov.cavando && Math.random() < dt * 30) { const p = ondeEstou(); poeira(p.x + j.dir * 14, p.y + 4, 1); }
          if (j.mov.f >= 1) {
            const c = celula(j.mov.gx, j.mov.gy);
            if (j.mov.cavando && c) { c.tipo = 'vazio'; if (c.ouro) { c.item = c.ouro; c.ouro = 0; } poeira(j.mov.gx * C + C / 2, TOPO + j.mov.gy * C + C / 2, 8); }
            j.gx = j.mov.gx;
            j.gy = j.mov.gy;
            j.mov = null;
            chegou();
          }
        } else if (j.tonto <= 0) {
          const d = direcao();
          if (d) tentarMover(d);
        }
        // As pedras soltas: balançam quando o chão embaixo some e caem
        for (let gy = ROWS - 2; gy >= 0; gy--) for (let gx = 0; gx < COLS; gx++) {
          const c = e.grade[gy][gx];
          if (c.tipo !== 'pedra') continue;
          const baixo = e.grade[gy + 1][gx];
          if (baixo.tipo !== 'vazio') { c.balanca = 0; c.cai = false; continue; }
          if (!c.cai) { c.balanca += dt; if (c.balanca > 0.75) { c.cai = true; c.passo = 0; } continue; }
          c.passo -= dt;
          if (c.passo > 0) continue;
          c.tipo = 'vazio';
          c.cai = false;
          c.balanca = 0;
          if (ocupaJogador(gx, gy + 1)) { atingir(); continue; }
          baixo.tipo = 'pedra';
          baixo.item = 0;
          baixo.cai = true;
          baixo.balanca = 1;
          baixo.passo = 0.09;
          if (gy + 1 === ROWS - 1 || e.grade[gy + 2]?.[gx]?.tipo !== 'vazio') { som('pisao'); poeira(gx * C + C / 2, TOPO + (gy + 2) * C - 4, 6, '150,140,130'); }
        }
        for (const p of e.popups) { p.ate -= dt; p.y -= 26 * dt; }
        e.popups = e.popups.filter(p => p.ate > 0);
        for (const p of e.poeira) { p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
        e.poeira = e.poeira.filter(p => p.vida > 0);
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        const sobrou = e.j.carga.length;
        api.terminar(e.pontos, [`${e.pontos} ${e.pontos === 1 ? 'ponto' : 'pontos'} de ouro no carrinho`, `${e.entregues} ${e.entregues === 1 ? 'pepita entregue' : 'pepitas entregues'}`, sobrou ? `(${sobrou} ficaram na mochila: só vale o que chega no carrinho!)` : 'Bom trabalho, mineiro!']);
      }
      function pepita(g, x, y, v, t) {
        if (v === 5) {
          brilho(g, x, y, 18, 'rgba(150,240,255,A)', 0.4 + Math.sin(t * 5) * 0.15);
          forma(g, '#6be0ff', [x, y - 9, x + 8, y - 2, x, y + 9, x - 8, y - 2]);
          forma(g, '#d8fbff', [x, y - 9, x + 3, y - 2, x, y + 4, x - 3, y - 2]);
        } else {
          const r = v === 3 ? 9 : 6;
          el(g, x, y + 2, r, r * 0.8, '#c8962a');
          el(g, x - r * 0.25, y, r * 0.7, r * 0.55, '#f0c84a');
          el(g, x - r * 0.35, y - r * 0.2, r * 0.3, r * 0.25, '#fff3b0');
        }
      }
      function desenhar(t) {
        const g = api.g;
        // A galeria lá em cima, com o carrinho
        g.fillStyle = grad(g, 0, 0, 0, TOPO, [[0, '#1a120c'], [1, '#3a2a1e']]);
        g.fillRect(0, 0, L, TOPO);
        for (let k = 0; k < 12; k++) el(g, hash(k, 41) * L, hash(k, 42) * 50, 20, 8, 'rgba(0,0,0,0.25)');
        for (const x of [180, 420]) { linha(g, '#3a2a1a', 1.5, [x, 0, x, 22]); ret(g, x - 7, 22, 14, 16, '#3a2a1a', 3); ret(g, x - 4, 25, 8, 10, '#ffd98a', 2); brilho(g, x, 30, 80, 'rgba(255,190,100,A)', 0.25 + Math.sin(t * 9 + x) * 0.03); }
        ret(g, 0, TOPO - 6, L, 4, '#8a8a94');
        for (let x = 4; x < L; x += 22) ret(g, x, TOPO - 8, 6, 8, '#5b3c22');
        peca(g, 'carrinho-mina', 40, TOPO - 4, t, e.pontos > 0 ? 'cheio' : 'vazio', { escala: 0.85 });
        escrever(g, 'Carrinho', 40, 30, '#ffe9a8', '700 11px "Cinzel", Georgia, serif');
        // As casas da mina
        for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
          const c = e.grade[gy][gx];
          const x = gx * C;
          const y = TOPO + gy * C;
          const k = gy * COLS + gx;
          ret(g, x, y, C, C, '#24180f');
          ret(g, x, y + C - 6, C, 6, 'rgba(0,0,0,0.25)');
          if (c.tipo === 'terra') {
            ret(g, x, y, C, C, gy % 2 ? '#7a5a3a' : '#80603e');
            for (let i = 0; i < 4; i++) el(g, x + 6 + hash(k, 50 + i) * 28, y + 6 + hash(k, 60 + i) * 28, 2 + hash(k, 70 + i) * 2, 1.6, 'rgba(50,30,15,0.4)');
            ret(g, x, y, C, 2, 'rgba(255,255,255,0.06)');
            if (c.ouro) {
              for (let i = 0; i < (c.ouro > 1 ? 4 : 2); i++) el(g, x + 8 + hash(k, 80 + i) * 24, y + 8 + hash(k, 90 + i) * 24, 1.8, 1.8, c.ouro === 5 ? '#9af0ff' : '#f0c84a');
              const pisca = Math.max(0, Math.sin(t * 2 + k * 1.7));
              if (pisca > 0.9) brilho(g, x + C / 2, y + C / 2, 16, c.ouro === 5 ? 'rgba(150,240,255,A)' : 'rgba(255,220,120,A)', (pisca - 0.9) * 6);
            }
          } else if (c.tipo === 'rocha') {
            ret(g, x + 1, y + 1, C - 2, C - 2, '#4a4a52', 5);
            ret(g, x + 4, y + 4, C - 10, 6, '#5d5d66', 3);
            linha(g, '#33333a', 1.5, [x + 10, y + 14, x + 18, y + 24, x + 15, y + 34]);
          } else if (c.tipo === 'pedra') {
            const treme = c.balanca > 0 && !c.cai ? Math.sin(t * 50) * 2 : 0;
            ret(g, x, y, C, C, '#2c2016');
            el(g, x + C / 2 + treme, y + C / 2 + 2, 17, 16, '#8a8680');
            el(g, x + C / 2 - 5 + treme, y + C / 2 - 4, 7, 5, '#a9a59e');
            linha(g, '#6b6862', 1.5, [x + 14 + treme, y + 26, x + 22 + treme, y + 22]);
            if (c.balanca > 0 && !c.cai) escrever(g, '!', x + C / 2, y - 6, '#ff6b6b', '700 18px sans-serif');
          }
          if (c.item) pepita(g, x + C / 2, y + C / 2 + 6, c.item, t);
        }
        // O meu coelho com a britadeira
        const j = e.j;
        const p = ondeEstou();
        const cavando = j.mov?.cavando;
        const treme = cavando ? Math.sin(t * 70) * 1.5 : 0;
        g.save();
        g.translate(p.x + treme, p.y + 18);
        g.scale(0.66, 0.66);
        if (j.tonto > 0) g.globalAlpha = 0.5 + Math.abs(Math.sin(t * 12)) * 0.5;
        desenharCoelho(g, 0, 0, { pelo: ctx.visual?.cor, roupa: { ...(ctx.visual?.roupa || {}), mao: null }, dir: j.dir, t, andando: !!j.mov && !cavando, passo: t });
        g.restore();
        const vertical = j.mov && j.mov.gx === j.gx;
        g.save();
        g.translate(p.x + (vertical ? 10 : j.dir * 15) + treme, p.y + (vertical ? 4 : 2));
        if (!vertical && j.dir < 0) g.scale(-1, 1);
        if (!vertical) g.rotate(-Math.PI / 2);
        ret(g, -9, -14, 18, 4, '#3a3a44', 2);
        ret(g, -5, -11, 10, 14, '#e8c24a', 3);
        ret(g, -5, -6, 10, 2, '#1b1b22');
        ret(g, -1.5, 3, 3, 9 + (cavando ? Math.abs(Math.sin(t * 60)) * 3 : 0), '#a9a097');
        g.restore();
        j.carga.forEach((v, i) => pepita(g, p.x - 10 + i * 10, p.y - 26, v, t));
        if (j.tonto > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + (k * Math.PI * 2) / 3; escrever(g, '★', p.x + Math.cos(a) * 14, p.y - 30 + Math.sin(a) * 4, '#ffe46b', '700 10px sans-serif'); }
        for (const q of e.poeira) el(g, q.x, q.y, 3 * Math.max(0, q.vida * 2), 3 * Math.max(0, q.vida * 2), `rgba(${q.cor},${Math.min(1, q.vida * 2)})`);
        for (const q of e.popups) escrever(g, q.texto, q.x, q.y, q.cor, '700 15px "Cinzel", Georgia, serif');
        // Placar
        escrever(g, `${Math.ceil(e.tempo)}s`, L - 16, 22, e.tempo < 10 ? '#ff9a9a' : '#ffffff', '700 20px "Cinzel", Georgia, serif', 'right');
        escrever(g, `Ouro: ${e.pontos}`, L - 16, 50, '#ffe46b', '700 17px "Cinzel", Georgia, serif', 'right');
        escrever(g, 'Mochila', 260, 22, '#e8e2d0', '700 13px "Cinzel", Georgia, serif', 'right');
        for (let i = 0; i < CARGA; i++) {
          ret(g, 270 + i * 26, 10, 22, 22, 'rgba(0,0,0,0.35)', 5);
          if (j.carga[i]) pepita(g, 281 + i * 26, 20, j.carga[i], t);
        }
      }
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Resgate dos Pompons ─────────────────────────────────── */
// Um labirinto de gelo: inclinar para um lado faz todos os pompons escorregarem até bater em algo. Buraco
// derruba o pompom (a fase recomeça); neve segura; a saída resgata. Cada fase é sorteada e testada por um
// "resolvedor" (busca em largura) antes de aparecer, então sempre tem solução.

const N_POMPOM = 9;
const DIRS_POMPOM = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// cel: matriz de 'g' (gelo), 'p' (parede), 'b' (buraco), 'n' (neve), 's' (saída). pos: [[x, y], ...].
export function simularPompons(cel, pos, [dx, dy]) {
  const ordem = pos.map((_, i) => i).sort((a, b) => (pos[b][0] * dx + pos[b][1] * dy) - (pos[a][0] * dx + pos[a][1] * dy));
  const ocupado = new Set(pos.map(p => `${p[0]},${p[1]}`));
  const res = pos.map(p => ({ x: p[0], y: p[1], x0: p[0], y0: p[1], fim: null, passos: 0 }));
  for (const i of ordem) {
    const r = res[i];
    ocupado.delete(`${r.x},${r.y}`);
    for (;;) {
      const nx = r.x + dx;
      const ny = r.y + dy;
      const tipo = cel[ny]?.[nx] ?? 'p';
      if (tipo === 'p' || ocupado.has(`${nx},${ny}`)) break;
      r.x = nx;
      r.y = ny;
      r.passos++;
      if (tipo === 'b') { r.fim = 'caiu'; break; }
      if (tipo === 's') { r.fim = 'salvo'; break; }
      if (tipo === 'n') break;
    }
    if (!r.fim) ocupado.add(`${r.x},${r.y}`);
  }
  return res;
}
export function resolverPompons(cel, pos, max = 12, limite = 5000) {
  const chave = p => p.map(q => `${q[0]},${q[1]}`).sort().join(';');
  const vistos = new Set([chave(pos)]);
  let fila = [{ pos, cam: [] }];
  while (fila.length) {
    const prox = [];
    for (const no of fila) {
      for (const d of DIRS_POMPOM) {
        const r = simularPompons(cel, no.pos, d);
        if (r.some(q => q.fim === 'caiu') || r.every(q => q.passos === 0)) continue;
        const resto = r.filter(q => !q.fim).map(q => [q.x, q.y]);
        if (!resto.length) return [...no.cam, d];
        const k = chave(resto);
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (vistos.size > limite) return null;
        if (no.cam.length + 1 < max) prox.push({ pos: resto, cam: [...no.cam, d] });
      }
    }
    fila = prox;
  }
  return null;
}
// alivio: quando não sai fase com solução, tenta de novo com menos obstáculos (mas os mesmos pompons).
export function gerarFasePompons(nivel, rnd = Math.random, alivio = 0) {
  const N = N_POMPOM;
  const n = Math.min(4, 1 + Math.floor(nivel / 2));
  const paredes = Math.max(1, 3 + Math.min(9, nivel) - alivio * 3);
  const buracos = Math.max(0, Math.min(7, nivel) - alivio * 2);
  const neves = Math.min(4, 1 + Math.floor(nivel / 3));
  const minimo = Math.min(7, 2 + Math.floor(nivel / 2));
  let melhor = null;
  for (let tent = 0; tent < 140; tent++) {
    const cel = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x === 0 || y === 0 || x === N - 1 || y === N - 1 ? 'p' : 'g')));
    const lado = Math.floor(rnd() * 4);
    const k = 1 + Math.floor(rnd() * (N - 2));
    const [sx, sy] = lado === 0 ? [k, 0] : lado === 1 ? [N - 1, k] : lado === 2 ? [k, N - 1] : [0, k];
    cel[sy][sx] = 's';
    const livre = () => {
      for (let i = 0; i < 60; i++) {
        const x = 1 + Math.floor(rnd() * (N - 2));
        const y = 1 + Math.floor(rnd() * (N - 2));
        if (cel[y][x] === 'g') return [x, y];
      }
      return null;
    };
    const por = (tipo, q) => { for (let i = 0; i < q; i++) { const c = livre(); if (c) cel[c[1]][c[0]] = tipo; } };
    por('p', paredes);
    por('b', buracos);
    por('n', neves);
    const pos = [];
    for (let i = 0; i < n; i++) {
      const c = livre();
      if (!c || pos.some(p => p[0] === c[0] && p[1] === c[1])) continue;
      pos.push(c);
    }
    if (pos.length !== n) continue;
    const sol = resolverPompons(cel, pos);
    if (!sol) continue;
    const fase = { cel, pompons: pos, minimo: sol.length, solucao: sol };
    if (sol.length >= minimo) return fase;
    if (!melhor || sol.length > melhor.minimo) melhor = fase;
  }
  if (melhor) return melhor;
  if (alivio < 3) return gerarFasePompons(nivel, rnd, alivio + 1);
  const cel = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x === 0 || y === 0 || x === N - 1 || y === N - 1 ? 'p' : 'g')));
  cel[0][4] = 's';
  return { cel, pompons: [[4, 6]], minimo: 1, solucao: [[0, -1]] };
}

export function abrirResgatePompons(ctx) {
  const N = N_POMPOM;
  const C = 44;
  const L = 560;
  const A = 446;
  const X0 = (L - N * C) / 2;
  const Y0 = 44;
  const VEL = 14;
  const TECLAS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  return abrirJanela({
    titulo: 'Resgate dos Pompons', largura: L, altura: A, jogo: 'neve_pompons', ctx,
    montar(api) {
      let e;
      function carregar(nivel) {
        const fase = gerarFasePompons(nivel);
        e.nivel = nivel;
        e.fase = fase;
        e.pompons = fase.pompons.map((p, i) => ({ x: p[0], y: p[1], cor: CORES_POMPOM[(i + nivel) % CORES_POMPOM.length] }));
        e.movimentos = 0;
        e.anim = null;
        e.banner = { texto: `Fase ${nivel}`, ate: 1, cor: '#ffe46b' };
      }
      function recomecar() {
        if (!e.fase) return;
        e.pompons = e.fase.pompons.map((p, i) => ({ x: p[0], y: p[1], cor: CORES_POMPOM[(i + e.nivel) % CORES_POMPOM.length] }));
        e.movimentos = 0;
        e.anim = null;
      }
      function novo() {
        e = { situacao: 'inicio', tempo: 90, pontos: 0, fases: 0, nivel: 1, fase: null, pompons: [], anim: null, banner: null, espera: 0, depois: null };
        carregar(1);
        e.banner = null;
        api.caixa(h('h2', null, 'Resgate dos Pompons'),
          h('p', null, 'Os Pompons estão presos num labirinto de gelo! Incline o gelo para um lado e todos escorregam até bater em alguma coisa. Leve todos até a saída brilhante.'),
          h('p', { class: 'suave' }, 'Setas ou W A S D, deslize o dedo, ou use os botões. Buraco derruba o pompom (a fase recomeça); a neve segura. R recomeça a fase. Você tem 90 segundos para resgatar o máximo que puder.'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; e.banner = { texto: 'Fase 1', ate: 1, cor: '#ffe46b' }; api.esconder(); } }));
      }
      api.reiniciar = novo;
      function inclinar(i) {
        if (!e || e.situacao !== 'jogando' || e.anim || e.espera > 0) return;
        const d = DIRS_POMPOM[i];
        const pos = e.pompons.map(p => [p.x, p.y]);
        const res = simularPompons(e.fase.cel, pos, d);
        if (res.every(r => r.passos === 0)) return;
        e.movimentos++;
        e.anim = { d, res, t: 0, dur: Math.max(...res.map(r => r.passos)) / VEL + 0.08 };
        som('passo');
      }
      api.ouvir(document, 'keydown', ev => {
        if (ev.code === 'KeyR' && e?.situacao === 'jogando' && !e.anim) { recomecar(); return; }
        const i = TECLAS[ev.code];
        if (i == null) return;
        ev.preventDefault();
        if (!ev.repeat) inclinar(i);
      });
      let inicioToque = null;
      api.ouvir(api.tela, 'pointerdown', ev => { ev.preventDefault(); inicioToque = api.ponto(ev); });
      api.ouvir(api.tela, 'pointerup', ev => {
        if (!inicioToque) return;
        const p = api.ponto(ev);
        const dx = p.x - inicioToque.x;
        const dy = p.y - inicioToque.y;
        inicioToque = null;
        if (Math.hypot(dx, dy) < 24) return;
        inclinar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      });
      const b = (rot, i) => { const x = h('button', { type: 'button', class: 'neve-botao' }, rot); x.addEventListener('pointerdown', ev => { ev.preventDefault(); inclinar(i); }); return x; };
      const reco = h('button', { type: 'button', class: 'neve-botao pequeno' }, 'Recomeçar fase');
      reco.addEventListener('click', () => { if (e?.situacao === 'jogando' && !e.anim) recomecar(); });
      trocar(api.extra, h('div', { class: 'neve-botoes cruz' }, b('▲', 0), b('◀', 3), b('▼', 2), b('▶', 1)), h('div', { class: 'neve-botoes' }, reco));
      novo();

      function atualizar(dt) {
        e.tempo -= dt;
        if (e.banner) { e.banner.ate -= dt; if (e.banner.ate <= 0) e.banner = null; }
        if (e.tempo <= 0) { e.tempo = 0; acabar(); return; }
        if (e.espera > 0) { e.espera -= dt; if (e.espera <= 0 && e.depois) { const f = e.depois; e.depois = null; f(); } return; }
        if (!e.anim) return;
        e.anim.t += dt;
        if (e.anim.t < e.anim.dur) return;
        const { res } = e.anim;
        e.anim = null;
        if (res.some(r => r.fim === 'caiu')) {
          som('agua');
          e.pompons = res.map((r, i) => ({ x: r.x, y: r.y, cor: e.pompons[i]?.cor, fim: r.fim })).filter(p => !p.fim);
          e.banner = { texto: 'Ops! Caiu no buraco.', ate: 1, cor: '#ff9a9a' };
          e.espera = 1;
          e.depois = recomecar;
          return;
        }
        const ficam = [];
        res.forEach((r, i) => { if (!r.fim) ficam.push({ x: r.x, y: r.y, cor: e.pompons[i].cor }); else som('moeda'); });
        e.pompons = ficam;
        if (!ficam.length) {
          e.pontos += e.fase.pompons.length;
          e.fases++;
          som('fase');
          e.banner = { texto: 'Todos salvos!', ate: 1, cor: '#7fe08a' };
          e.espera = 1;
          e.depois = () => carregar(e.nivel + 1);
        }
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        api.terminar(e.pontos, [`${e.pontos} ${e.pontos === 1 ? 'pompom resgatado' : 'pompons resgatados'}`, `${e.fases} ${e.fases === 1 ? 'fase completa' : 'fases completas'}`]);
      }
      function desenharCasa(g, tipo, x, y, t, k) {
        if (tipo === 'p') {
          ret(g, x, y, C, C, '#6aa8d2', 4);
          ret(g, x + 2, y + 2, C - 4, C - 10, '#a8d8f2', 4);
          ret(g, x + 5, y + 5, C - 16, 5, 'rgba(255,255,255,0.75)', 2);
          return;
        }
        ret(g, x, y, C, C, (k % 2) ? '#cfe9f7' : '#d8eef9');
        linha(g, 'rgba(255,255,255,0.6)', 1.5, [x + 8, y + C - 10, x + C - 12, y + 8]);
        if (tipo === 'n') {
          for (const [dx, dy, r] of [[12, 28, 11], [26, 26, 12], [20, 16, 10], [32, 16, 8]]) el(g, x + dx, y + dy, r, r * 0.8, '#ffffff');
          el(g, x + 18, y + 14, 4, 3, '#eef5fb');
        } else if (tipo === 'b') {
          el(g, x + C / 2, y + C / 2, 18, 15, '#9fc6de');
          el(g, x + C / 2, y + C / 2 + 1, 15, 12, '#123d63');
          const f = (t * 0.8 + k * 0.3) % 1;
          g.strokeStyle = `rgba(160,220,255,${0.6 * (1 - f)})`;
          g.lineWidth = 1.5;
          g.beginPath();
          g.ellipse(x + C / 2, y + C / 2 + 1, 4 + f * 10, 3 + f * 8, 0, 0, Math.PI * 2);
          g.stroke();
        } else if (tipo === 's') {
          brilho(g, x + C / 2, y + C / 2, 34, 'rgba(255,230,120,A)', 0.55 + Math.sin(t * 4) * 0.15);
          ret(g, x + 4, y + 4, C - 8, C - 8, '#ffe9a8', 10);
          escrever(g, '★', x + C / 2, y + C / 2 + 1, '#e0a020', '700 22px sans-serif');
        }
      }
      function desenhar(t) {
        const g = api.g;
        g.fillStyle = grad(g, 0, 0, 0, A, [[0, '#1d5f8a'], [1, '#0d3a63']]);
        g.fillRect(0, 0, L, A);
        nevar(g, t, { n: 30, x1: L, y1: A, semente: 12, vel: -20, vento: 6, cor: '200,235,255', alfa: 0.35 });
        const cel = e.fase.cel;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) desenharCasa(g, cel[y][x], X0 + x * C, Y0 + y * C, t, y * N + x);
        const lista = e.anim ? e.anim.res.map((r, i) => {
          const s = Math.min(r.passos, e.anim.t * VEL);
          const [dx, dy] = e.anim.d;
          let escala = 1;
          let alfa = 1;
          if (r.fim && s >= r.passos - 0.4) { const f = limitar((e.anim.t * VEL - r.passos + 0.4) / 0.9, 0, 1); escala = r.fim === 'caiu' ? 1 - f : 1 + f * 0.3; alfa = 1 - f; }
          return { x: r.x0 + dx * s, y: r.y0 + dy * s, cor: e.pompons[i]?.cor, escala, alfa };
        }) : e.pompons.map(p => ({ ...p, escala: 1, alfa: 1 }));
        for (const p of lista.sort((a, b) => a.y - b.y)) {
          if (p.alfa <= 0.02) continue;
          g.save();
          g.globalAlpha = p.alfa;
          desenharPompom(g, X0 + p.x * C + C / 2, Y0 + p.y * C + C / 2 + 14 * p.escala, e.anim ? 0 : t + p.x, p.cor, e.anim ? 'dormindo' : 'pulando', 1.05 * p.escala);
          g.restore();
        }
        escrever(g, `${Math.ceil(e.tempo)}s`, 16, 22, e.tempo < 15 ? '#ff9a9a' : '#ffffff', '700 20px "Cinzel", Georgia, serif', 'left');
        escrever(g, `Fase ${e.nivel}`, L / 2, 22, '#ffe46b', '700 18px "Cinzel", Georgia, serif');
        escrever(g, `Salvos: ${e.pontos}`, L - 16, 22, '#ffffff', '700 17px "Cinzel", Georgia, serif', 'right');
        if (e.banner) {
          g.fillStyle = 'rgba(14,24,40,0.55)';
          g.fillRect(0, A / 2 - 34, L, 68);
          escrever(g, e.banner.texto, L / 2, A / 2, e.banner.cor, '700 30px "Cinzel", Georgia, serif');
        }
      }
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Separar o Lixo (Usina de Reciclagem) ───────────────── */

const TIPOS_LIXO = [
  { tipo: 'papel', lixeira: 0, cor: '#f4f1ea', nomes: ['Jornal velho', 'Caixa de papelão', 'Folha de caderno'] },
  { tipo: 'plastico', lixeira: 1, cor: '#e05a4a', nomes: ['Garrafa de plástico', 'Pote de iogurte', 'Tampa de plástico'] },
  { tipo: 'metal', lixeira: 2, cor: '#c8c8d0', nomes: ['Lata de refrigerante', 'Lata de conserva', 'Tampinha de metal'] },
  { tipo: 'vidro', lixeira: 3, cor: '#7fd0a0', nomes: ['Pote de geleia', 'Garrafa de vidro', 'Vidro de perfume'] },
];
const LIXEIRAS_JOGO = [['Papel', '#2f6b9a'], ['Plástico', '#c0392b'], ['Metal', '#d8b13a'], ['Vidro', '#3a8a5a']];

export function abrirSepararLixo(ctx) {
  const L = 600;
  const A = 400;
  const ESTEIRA = 160;
  const FIM = 520;
  const BX = [90, 230, 370, 510];
  const BY = 330;
  return abrirJanela({
    titulo: 'Separar o Lixo', largura: L, altura: A, jogo: 'neve_lixo', ctx,
    montar(api) {
      let e;
      function novo() {
        e = { situacao: 'inicio', tempo: 45, decorrido: 0, pontos: 0, certos: 0, errados: 0, perdidos: 0, combo: 0, itens: [], proximo: 0.4, popups: [], tampa: [0, 0, 0, 0] };
        api.caixa(h('h2', null, 'Separar o Lixo'),
          h('p', null, 'O lixo vem pela esteira. Mande cada coisa para a lixeira certa antes que ela caia do fim da esteira!'),
          h('p', { class: 'suave' }, 'Papel no azul, plástico no vermelho, metal no amarelo e vidro no verde. Clique na lixeira (ou aperte 1, 2, 3 ou 4): vai sempre o item da frente, o que está brilhando. Errar tira um ponto. 45 segundos.'),
          botao('Começar', { classe: 'btn-ouro', icone: 'frente', onclick: () => { e.situacao = 'jogando'; api.esconder(); } }));
      }
      api.reiniciar = novo;
      const daFrente = () => e.itens.filter(i => !i.voando && !i.caindo).sort((a, b) => b.x - a.x)[0] || null;
      function separar(k) {
        if (!e || e.situacao !== 'jogando') return;
        const i = daFrente();
        e.tampa[k] = 0.25;
        if (!i) return;
        const certo = TIPOS_LIXO[i.t].lixeira === k;
        i.voando = { de: [i.x, ESTEIRA], para: [BX[k], BY - 40], f: 0, certo, k };
      }
      api.ouvir(document, 'keydown', ev => { const k = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(ev.code); if (k < 0) return; ev.preventDefault(); separar(k % 4); });
      api.ouvir(api.tela, 'pointerdown', ev => {
        ev.preventDefault();
        const p = api.ponto(ev);
        if (p.y < BY - 90) return;
        let melhor = 0;
        BX.forEach((x, k) => { if (Math.abs(p.x - x) < Math.abs(p.x - BX[melhor])) melhor = k; });
        if (Math.abs(p.x - BX[melhor]) < 70) separar(melhor);
      });
      trocar(api.extra, h('div', { class: 'neve-botoes lixeiras' }, LIXEIRAS_JOGO.map(([nome, cor], k) => {
        const b = h('button', { type: 'button', class: 'neve-botao', style: { '--cor': cor } }, `${k + 1}. ${nome}`);
        b.addEventListener('pointerdown', ev => { ev.preventDefault(); separar(k); });
        return b;
      })));
      novo();

      function atualizar(dt) {
        e.tempo -= dt;
        e.decorrido += dt;
        if (e.tempo <= 0) { e.tempo = 0; acabar(); return; }
        const vel = 70 + e.decorrido * 1.8;
        e.proximo -= dt;
        if (e.proximo <= 0) {
          const t = Math.floor(Math.random() * 4);
          e.itens.push({ t, nome: sortear(TIPOS_LIXO[t].nomes), x: -20, k: Math.floor(Math.random() * 9) });
          e.proximo = Math.max(0.55, 1.5 - e.decorrido * 0.022) * (0.8 + Math.random() * 0.4);
        }
        for (const i of e.itens) {
          if (i.voando) {
            i.voando.f += dt / 0.32;
            if (i.voando.f >= 1) {
              i.fim = true;
              const [x, y] = i.voando.para;
              if (i.voando.certo) { e.certos++; e.combo++; const v = e.combo % 5 === 0 ? 2 : 1; e.pontos += v; e.popups.push({ x, y: y - 20, texto: v > 1 ? `+${v} combo!` : '+1', ate: 0.9, cor: '#7fe08a' }); som('moeda'); }
              else { e.errados++; e.combo = 0; e.pontos = Math.max(0, e.pontos - 1); e.popups.push({ x, y: y - 20, texto: `Não! ${i.nome} vai no ${LIXEIRAS_JOGO[TIPOS_LIXO[i.t].lixeira][0].toLowerCase()}.`, ate: 1.4, cor: '#ff9a9a' }); som('bater'); }
            }
          } else if (i.caindo) {
            i.caindo += dt;
            if (i.caindo > 0.6) i.fim = true;
          } else {
            i.x += vel * dt;
            if (i.x > FIM) { i.caindo = 0.001; e.perdidos++; e.combo = 0; e.popups.push({ x: FIM, y: ESTEIRA - 30, texto: 'Caiu!', ate: 0.8, cor: '#ffb0a0' }); som('pisao'); }
          }
        }
        e.itens = e.itens.filter(i => !i.fim);
        for (let k = 0; k < 4; k++) e.tampa[k] = Math.max(0, e.tampa[k] - dt);
        for (const p of e.popups) { p.ate -= dt; p.y -= 24 * dt; }
        e.popups = e.popups.filter(p => p.ate > 0);
      }
      function acabar() {
        if (e.situacao === 'fim') return;
        e.situacao = 'fim';
        som('fim');
        api.terminar(e.pontos, [`${e.pontos} pontos`, `Certos: ${e.certos} · Errados: ${e.errados} · Caíram: ${e.perdidos}`, 'A ilha agradece!']);
      }
      function desenhar(t) {
        const g = api.g;
        g.fillStyle = '#56636b';
        g.fillRect(0, 0, L, A);
        for (let x = 0; x < L; x += 100) ret(g, x + 4, 6, 92, 240, '#5d6b73', 4);
        ret(g, 0, 30, L, 12, '#8a6a44');
        g.fillStyle = grad(g, 0, 250, 0, A, [[0, '#8a9094'], [1, '#a2a8ac']]);
        g.fillRect(0, 250, L, A - 250);
        // A boca da máquina que solta o lixo
        ret(g, -10, ESTEIRA - 90, 70, 90, '#3f7a5a', 8);
        ret(g, 4, ESTEIRA - 60, 40, 40, '#141a1c', 6);
        escrever(g, '♻', 24, ESTEIRA - 76, '#bff0c8', '700 18px sans-serif');
        // A esteira
        ret(g, 0, ESTEIRA, FIM + 10, 18, '#2a3236', 6);
        for (let x = 0; x < FIM; x += 20) el(g, (x + e.decorrido * (70 + e.decorrido * 1.8)) % FIM, ESTEIRA + 9, 5, 3, '#4f5c64');
        for (let x = 30; x < FIM; x += 80) ret(g, x, ESTEIRA + 18, 8, 60, '#3f4a50');
        ret(g, FIM - 70, ESTEIRA - 2, 80, 4, 'rgba(232,194,74,0.7)');
        // As lixeiras
        LIXEIRAS_JOGO.forEach(([nome, cor], k) => {
          const x = BX[k];
          el(g, x, BY + 52, 54, 8, 'rgba(0,0,0,0.2)');
          forma(g, cor, [x - 50, BY - 40, x + 50, BY - 40, x + 42, BY + 50, x - 42, BY + 50]);
          g.save();
          g.translate(x - 54, BY - 40);
          g.rotate(-e.tampa[k] * 2);
          ret(g, 0, -12, 108, 12, cor, 4);
          ret(g, 0, -12, 108, 4, 'rgba(255,255,255,0.3)', 2);
          g.restore();
          escrever(g, nome, x, BY + 6, '#ffffff', '700 15px "Cinzel", Georgia, serif');
          escrever(g, String(k + 1), x, BY + 32, 'rgba(255,255,255,0.7)', '700 14px "Cinzel", Georgia, serif');
        });
        const frente = daFrente();
        for (const i of e.itens) {
          const tl = TIPOS_LIXO[i.t];
          let x = i.x;
          let y = ESTEIRA;
          let rot = 0;
          if (i.voando) {
            const f = i.voando.f;
            x = i.voando.de[0] + (i.voando.para[0] - i.voando.de[0]) * f;
            y = i.voando.de[1] + (i.voando.para[1] - i.voando.de[1]) * f - Math.sin(f * Math.PI) * 60;
            rot = f * 6;
          } else if (i.caindo) {
            x = FIM + i.caindo * 60;
            y = ESTEIRA + i.caindo * i.caindo * 600;
            rot = i.caindo * 5;
          }
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          g.scale(1.5, 1.5);
          if (i === frente) brilho(g, 0, -10, 24, 'rgba(255,240,150,A)', 0.6);
          desenharLixo(g, tl.tipo, tl.cor, 0, 0, i.k);
          g.restore();
        }
        if (frente) {
          ret(g, frente.x - 70, ESTEIRA - 66, 140, 22, 'rgba(14,24,40,0.75)', 8);
          escrever(g, frente.nome, frente.x, ESTEIRA - 55, '#ffe9a8', '700 12px "Cinzel", Georgia, serif');
        }
        for (const p of e.popups) escrever(g, p.texto, limitar(p.x, 120, L - 120), p.y, p.cor, '700 15px "Cinzel", Georgia, serif');
        escrever(g, `${Math.ceil(e.tempo)}s`, L - 16, 22, e.tempo < 10 ? '#ff9a9a' : '#ffffff', '700 20px "Cinzel", Georgia, serif', 'right');
        escrever(g, `${e.pontos} pontos`, L / 2, 22, '#ffe46b', '700 18px "Cinzel", Georgia, serif');
        if (e.combo >= 3) escrever(g, `Combo ${e.combo}`, L / 2, 48, '#7fe08a', '700 14px "Cinzel", Georgia, serif');
      }
      return {
        passo(dt, t) {
          if (e.situacao === 'jogando') atualizar(dt);
          desenhar(t);
        },
      };
    },
  });
}

/* ─── Quiz da Ilha (Escola) ───────────────────────────────── */

// [pergunta, resposta certa, outras duas]
export const PERGUNTAS_ILHA = [
  ['Qual é a moeda do Club Coelho?', 'Cenouras', 'Moedas de ouro', 'Pedrinhas'],
  ['Como se chamam os bichinhos fofos e redondos da Ilha?', 'Pompons', 'Bolotas', 'Fofurinhas'],
  ['Quem é o capitão pirata que visita a Ilha?', 'Capitão Saltarrocha', 'Capitão Orelhão', 'Capitão Raposo'],
  ['Qual é o nome do navio do capitão pirata?', 'O Saltador', 'O Pulador', 'O Cenourão'],
  ['Onde fica a Guerra de Bolas de Neve?', 'No Forte Nevado', 'Na Praia', 'No Sótão'],
  ['O que tem no Sótão da Cabana do Esqui?', 'A mesa do Lig 4', 'Uma piscina', 'Uma máquina de reciclagem'],
  ['Como se chega à Estação de Esqui, no topo da montanha?', 'Pelo teleférico', 'Pelo farol', 'Pela escada da Mina'],
  ['Qual minijogo fica no topo da montanha?', 'Corrida de Trenó', 'Pescaria no Gelo', 'Fábrica de Pizzas'],
  ['Na Usina de Reciclagem, o plástico vai na lixeira de que cor?', 'Vermelha', 'Azul', 'Verde'],
  ['Na Usina de Reciclagem, o vidro vai na lixeira de que cor?', 'Verde', 'Amarela', 'Vermelha'],
  ['O que se usa para cavar na Mina de Ouro?', 'Uma britadeira', 'Uma colher', 'Um guarda-chuva'],
  ['Da Piscina Subterrânea dá para ir para qual sala?', 'Sala da Caldeira', 'Salão de Dança', 'Pizzaria'],
  ['Quem é o vilão do Club Coelho?', 'O Raposo', 'O Lobo Mau', 'O Gato de Botas'],
  ['Como se chama a guarda que protege a Ilha em segredo?', 'Guarda Secreta do Coelho', 'Patrulha do Iceberg', 'Ordem da Cenoura'],
  ['Onde a Dona Cacau serve chocolate quente?', 'Na Cabana do Esqui', 'No Farol', 'Na Escola'],
  ['O que a torre do Forte Nevado mostra?', 'Um relógio', 'Um mapa', 'Um telescópio'],
  ['Qual é a faixa mais alta do Desafio Ninja?', 'Faixa preta', 'Faixa rosa', 'Faixa de cenoura'],
  ['Qual sala tem uma grande janela para o fundo do mar?', 'Piscina Subterrânea', 'Cabana do Esqui', 'Escola'],
  ['Quantas pistas tem a largada da Corrida de Trenó?', '4', '2', '7'],
  ['O que canta de tempos em tempos na Cabana do Esqui?', 'O relógio cuco', 'A chaleira', 'Um pompom'],
];

export function abrirQuizIlha(ctx) {
  const lista = [...PERGUNTAS_ILHA].sort(() => Math.random() - 0.5).slice(0, 5);
  let atual = 0;
  let acertos = 0;
  const corpo = h('div', { class: 'neve-quiz' });
  const m = modal({ titulo: 'Quiz da Ilha', tamanho: 'pequeno', corpo });
  function pergunta() {
    const [p, certa, ...outras] = lista[atual];
    const opcoes = [certa, ...outras].sort(() => Math.random() - 0.5);
    const botoes = opcoes.map(o => h('button', { type: 'button', class: 'btn neve-quiz-opcao', onclick: () => responder(o, certa, botoes) }, o));
    trocar(corpo,
      h('p', { class: 'neve-quiz-conta' }, `Pergunta ${atual + 1} de ${lista.length} · ${acertos} ${acertos === 1 ? 'acerto' : 'acertos'}`),
      h('h3', { class: 'neve-quiz-pergunta' }, p),
      h('div', { class: 'neve-quiz-opcoes' }, botoes));
  }
  function responder(o, certa, botoes) {
    for (const b of botoes) {
      b.disabled = true;
      if (b.textContent === certa) b.classList.add('certa');
      else if (b.textContent === o) b.classList.add('errada');
    }
    if (o === certa) { acertos++; som('moeda'); } else som('bater');
    setTimeout(() => { atual++; if (atual < lista.length) pergunta(); else fim(); }, 1100);
  }
  async function fim() {
    trocar(corpo, h('h3', { class: 'neve-quiz-pergunta' }, `Você acertou ${acertos} de ${lista.length}!`), h('p', { class: 'suave' }, 'Guardando as cenouras...'));
    let texto = '';
    try {
      const r = await ctx.terminarMinijogo('neve_quiz', acertos);
      texto = r.ganhou > 0 ? `🥕 +${r.ganhou} cenouras!` : r.teto ? 'Você já ganhou o máximo de cenouras de hoje.' : 'Nenhuma cenoura desta vez.';
    } catch (e) { texto = e.message || 'Não deu para guardar as cenouras agora.'; }
    trocar(corpo,
      h('h3', { class: 'neve-quiz-pergunta' }, acertos === lista.length ? 'Nota 10! A Professora Orelhuda está orgulhosa!' : `Você acertou ${acertos} de ${lista.length}!`),
      h('p', { class: 'arcade-cenouras' }, texto),
      h('div', { class: 'minijogo-botoes' },
        botao('Outro quiz', { classe: 'btn-ouro', icone: 'aleatorio', onclick: () => { m.fechar(); abrirQuizIlha(ctx); } }),
        botao('Sair', { onclick: () => m.fechar() })));
  }
  pergunta();
  return m;
}

/* ─── A mesa do Lig 4 (Sótão) ─────────────────────────────── */

export function abrirMesaLig4() {
  if (!rt.conectado) { aviso('Sem conexão com a recreação agora. Tente de novo em um instante.', 'erro'); return null; }
  if (rt.minhaSala) {
    const m = modal({
      titulo: 'Mesa do Lig 4', tamanho: 'pequeno',
      corpo: h('div', { class: 'neve-lig4' }, h('p', null, 'Você já está numa partida da Recreação. Termine aquela antes de puxar uma cadeira aqui.'),
        h('div', { class: 'minijogo-botoes' }, h('a', { class: 'btn btn-ouro', href: `#/recreacao/sala/${rt.minhaSala}`, onclick: () => m.fechar() }, 'Voltar para a minha partida'))),
    });
    return m;
  }
  const abertas = (rt.salas || []).filter(s => s.jogo === 'lig4' && s.status === 'esperando' && s.jogadores.length < s.max);
  const m = modal({
    titulo: 'Mesa do Lig 4', tamanho: 'pequeno',
    corpo: h('div', { class: 'neve-lig4' },
      h('p', null, 'Solte as peças e faça quatro em linha antes do outro! A partida abre na Recreação e qualquer morador pode sentar do outro lado.'),
      h('div', { class: 'minijogo-botoes' },
        botao('Versus', { classe: 'btn-ouro', icone: 'lig4', onclick: () => { m.fechar(); criarPartida('lig4'); } }),
        botao('Contra a Raposa', { icone: 'raposa', onclick: () => { m.fechar(); criarPartida('lig4', { modo: 'raposa' }); } })),
      abertas.length ? h('div', { class: 'neve-lig4-abertas' },
        h('h3', null, 'Mesas esperando alguém'),
        abertas.map(s => h('div', { class: 'neve-lig4-linha' },
          h('span', null, `${s.jogadores[0]} espera um adversário`),
          botao('Sentar', { classe: 'btn-pequeno btn-ouro', onclick: () => { m.fechar(); entrarNaPartida(s.id); } })))) : null),
  });
  return m;
}
