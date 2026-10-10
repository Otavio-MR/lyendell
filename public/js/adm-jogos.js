// Menu de administrador nos jogos (permissão jogos.admin). Um botão "ADM" no canto da tela de cada jogo abre
// um painel com três partes:
//  - Este jogo: o que dá para fazer na partida (as ações do próprio jogo no navegador, nos jogos de uma pessoa
//    só, e as que o servidor oferece, nas partidas ao vivo: escolher quem vence, dar vida, pular fase...);
//  - Pegadinhas: atrapalhar (controles invertidos, congelar, lento) ou efeitos na tela de alguém;
//  - Cenouras: dar ou tirar cenouras do Club Coelho de qualquer pessoa.
// Partida em que o menu foi usado não vale para o ranking nem recordes (o jogo pergunta com usado()).
//
// Também ficam aqui os efeitos que chegam para quem levou a pegadinha. Os jogos rodados no navegador
// consultam admDirecao(), admTecla(), admPodeAgir() e admVelocidade() antes de mover o coelho.

import { h, icone, botao, modal, confirmar, aviso, get, post, trocar, pode, aoSair, normalizar } from './core.js';
import { ouvir, enviar, rt } from './tempo-real.js';

export const podeAdm = () => pode('jogos.admin');

/* ─── Efeitos recebidos ───────────────────────────── */

export const EFEITOS = {
  inverter: { nome: 'Controles invertidos', tipo: 'atrapalhar', padrao: 15 },
  congelar: { nome: 'Congelar', tipo: 'atrapalhar', padrao: 5 },
  lento: { nome: 'Deixar lento', tipo: 'atrapalhar', padrao: 15 },
  confete: { nome: 'Chuva de confete', tipo: 'visual', padrao: 6 },
  ponta: { nome: 'Tela de ponta-cabeça', tipo: 'visual', padrao: 10 },
  espelho: { nome: 'Tela espelhada', tipo: 'visual', padrao: 15 },
  tremor: { nome: 'Terremoto na tela', tipo: 'visual', padrao: 6 },
  arcoiris: { nome: 'Cores malucas', tipo: 'visual', padrao: 15 },
  escuro: { nome: 'Apagar as luzes', tipo: 'visual', padrao: 8 },
  gigante: { nome: 'Zoom gigante', tipo: 'visual', padrao: 10 },
  minusculo: { nome: 'Tela minúscula', tipo: 'visual', padrao: 10 },
  torta: { nome: 'Torta na cara', tipo: 'visual', padrao: 0 },
  pum: { nome: 'Almofada de pum', tipo: 'visual', padrao: 0 },
  coelhos: { nome: 'Manada de coelhos', tipo: 'visual', padrao: 0 },
};
// Os da Caixa de Pegadinhas do Bobo (bobo-efeitos.js) que servem aqui também.
const DO_BOBO = new Set(['confete', 'torta', 'pum', 'coelhos']);
// Os que viram uma classe no #app enquanto durarem.
const CLASSES = { ponta: 'adm-ponta', espelho: 'adm-espelho', tremor: 'adm-tremor', arcoiris: 'adm-arcoiris', gigante: 'adm-gigante', minusculo: 'adm-minusculo' };

const ate = {}; // efeito -> até quando (ms)
export const admEfeito = nome => (ate[nome] || 0) > Date.now();
export const admPodeAgir = () => !admEfeito('congelar');
export const admVelocidade = () => (admEfeito('lento') ? 0.5 : 1);

const OPOSTO = {
  cima: 'baixo', baixo: 'cima', esquerda: 'direita', direita: 'esquerda',
  up: 'down', down: 'up', left: 'right', right: 'left',
  c: 'b', b: 'c', e: 'd', d: 'e', N: 'S', S: 'N', L: 'O', O: 'L',
};
// A direção que vale agora para mim: null congelado; a contrária, invertido. Aceita nomes, 0..3 e vetores.
export function admDirecao(dir) {
  if (admEfeito('congelar')) return null;
  if (!admEfeito('inverter')) return dir;
  if (typeof dir === 'string') return OPOSTO[dir] ?? dir;
  if (typeof dir === 'number' && Number.isInteger(dir) && dir >= 0 && dir < 4) return (dir + 2) % 4;
  if (Array.isArray(dir)) return dir.map(v => (typeof v === 'number' ? -v : v));
  if (dir && typeof dir === 'object') {
    const r = { ...dir };
    for (const k of ['x', 'y', 'dx', 'dy']) if (typeof r[k] === 'number') r[k] = -r[k];
    return r;
  }
  return dir;
}
// A tecla que vale agora (setas e WASD trocadas quando invertido; null congelado).
const TECLA_OPOSTA = {
  ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft',
  w: 's', s: 'w', a: 'd', d: 'a', W: 'S', S: 'W', A: 'D', D: 'A',
};
export function admTecla(tecla) {
  if (admEfeito('congelar') && (TECLA_OPOSTA[tecla] || tecla === ' ')) return null;
  return admEfeito('inverter') ? TECLA_OPOSTA[tecla] ?? tecla : tecla;
}

function aplicarEfeito({ efeito, ate: fim, segundos }) {
  const def = EFEITOS[efeito];
  if (!def) return;
  const ms = Math.max(0, (Number(segundos) || 0) * 1000);
  if (def.tipo === 'atrapalhar') {
    ate[efeito] = Date.now() + ms;
    mostrarSelo();
  } else if (DO_BOBO.has(efeito)) {
    import('./bobo-efeitos.js').then(x => x.efeito(efeito)).catch(() => {});
  } else if (efeito === 'escuro') {
    const el = h('div', { class: 'adm-escuro', 'aria-hidden': 'true' });
    document.body.append(el);
    setTimeout(() => el.remove(), ms);
  } else if (CLASSES[efeito]) {
    const app = document.getElementById('app');
    if (app) {
      app.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      document.documentElement.classList.add('bobo-girando');
      app.classList.add(CLASSES[efeito]);
      setTimeout(() => {
        app.classList.remove(CLASSES[efeito]);
        if (!Object.values(CLASSES).some(c => app.classList.contains(c))) { app.style.transformOrigin = ''; document.documentElement.classList.remove('bobo-girando'); }
      }, ms);
    }
  }
  aviso(`Pegadinha! ${def.nome}${def.tipo === 'atrapalhar' ? ` por ${Math.round(ms / 1000)} s` : ''}.`);
  void fim;
}

// Selo no canto enquanto um efeito que atrapalha estiver valendo (para a pessoa entender o que houve).
let seloEl = null;
let seloRelogio = null;
function mostrarSelo() {
  clearInterval(seloRelogio);
  const desenhar = () => {
    const lista = Object.keys(ate).filter(admEfeito);
    if (!lista.length) { seloEl?.remove(); seloEl = null; clearInterval(seloRelogio); return; }
    if (!seloEl) { seloEl = h('div', { class: 'adm-selo-efeito', role: 'status' }); document.body.append(seloEl); }
    trocar(seloEl, lista.map(k => h('span', null, EFEITOS[k].nome, ' ', h('b', null, `${Math.ceil((ate[k] - Date.now()) / 1000)} s`))));
  };
  desenhar();
  seloRelogio = setInterval(desenhar, 250);
}

let iniciado = false;
export function iniciarEfeitosAdm() {
  if (iniciado) return;
  iniciado = true;
  ouvir('adm:efeito', aplicarEfeito);
  ouvir('adm:aviso', m => aviso(m.texto));
  ouvir('adm:cenouras', m => {
    if (m.mudou > 0) aviso(`O administrador te deu ${m.mudou} cenouras! Agora você tem ${m.moedas}.`);
    else if (m.mudou < 0) aviso(`O administrador tirou ${-m.mudou} cenouras suas. Agora você tem ${m.moedas}.`);
  });
}

/* ─── O menu ──────────────────────────────────────── */

// opcoes:
//   titulo: nome do jogo (ou uma função que devolve o nome)
//   sala(): id da partida ao vivo (as ações vêm do servidor), ou null
//   acoes: ações do próprio jogo no navegador: [{ id, nome, grupo, ajuda, perigo, campos, executar(valores) }]
//          campos: [{ id, nome, tipo: 'numero' | 'escolha' | 'texto', min, max, padrao, opcoes: [[valor, nome]] }]
//          executar devolve uma frase do que aconteceu (ou lança Error)
//   jogadores(): [{ id, nome }] para escolher quem leva a pegadinha (sem isso: quem está online)
//   aoUsar(): chamado na primeira vez que o menu mexe na partida (o jogo para de mandar recorde)
// Devolve { usado(), marcar(), novaPartida(), destruir() }.
export function menuAdm(opcoes = {}) {
  const nada = { usado: () => false, marcar() {}, novaPartida() {}, destruir() {}, el: null };
  if (!podeAdm()) return nada;
  let usado = false;
  const faixa = h('div', { class: 'adm-faixa', hidden: true }, icone('alerta'), 'Modo admin: esta partida não vale para o ranking');
  const botaoAbrir = h('button', { type: 'button', class: 'adm-botao', title: 'Menu de administrador', 'aria-label': 'Menu de administrador', onclick: () => abrirPainel() },
    icone('chave'), h('span', null, 'ADM'));
  const raiz = h('div', { class: 'adm-raiz' }, faixa, botaoAbrir);
  document.body.append(raiz);
  const desligar = [];
  const api = {
    el: raiz,
    usado: () => usado,
    marcar() {
      // semRanking: lugares sem ranking (o Club Coelho) não mostram a faixa de "não vale para o ranking".
      if (!usado) { usado = true; if (!opcoes.semRanking) faixa.hidden = false; try { opcoes.aoUsar?.(); } catch (e) { console.error(e); } }
    },
    // Uma partida nova (o jogo recomeçou): volta a valer.
    novaPartida() { usado = false; faixa.hidden = true; },
    destruir() { raiz.remove(); desligar.forEach(f => f()); },
  };
  aoSair(api.destruir);
  // Nas partidas ao vivo, o servidor avisa quando a partida passa a não valer.
  desligar.push(ouvir('adm:aviso', m => { if (opcoes.sala?.() && m.sala === opcoes.sala()) { usado = true; faixa.hidden = false; } }));

  function abrirPainel() {
    let aba = 'jogo';
    const corpo = h('div', { class: 'adm-painel' });
    const abas = h('div', { class: 'segmentado adm-abas' });
    const conteudo = h('div', { class: 'adm-conteudo' });
    corpo.append(abas, conteudo);
    const tirar = [];
    const titulo = typeof opcoes.titulo === 'function' ? opcoes.titulo() : opcoes.titulo;
    modal({ titulo: `Menu de administrador${titulo ? ` · ${titulo}` : ''}`, tamanho: 'grande', corpo, classe: 'adm-modal', aoFechar: () => tirar.forEach(f => f()) });

    const desenharAbas = () => trocar(abas, [['jogo', 'Este jogo'], ['pegadinhas', 'Pegadinhas'], ['cenouras', 'Cenouras']]
      .map(([k, nome]) => h('button', { type: 'button', class: `seg ${k === aba ? 'ativo' : ''}`.trim(), onclick: () => { aba = k; desenharAbas(); desenhar(); } }, nome)));

    // As ações do servidor (partidas ao vivo).
    let servidor = null; // { acoes, jogadores, vale }
    const pedir = () => { const id = opcoes.sala?.(); if (id) enviar('adm:listar', { id }); };
    tirar.push(ouvir('adm:acoes', m => {
      if (m.id !== opcoes.sala?.()) return;
      servidor = m;
      if (!m.vale) api.marcar();
      if (aba !== 'cenouras') desenhar();
    }));
    tirar.push(ouvir('adm:feito', m => aviso(m.texto)));
    pedir();

    function desenhar() {
      if (aba === 'jogo') trocar(conteudo, abaJogo());
      else if (aba === 'pegadinhas') trocar(conteudo, abaPegadinhas());
      else trocar(conteudo, abaCenouras());
    }

    function abaJogo() {
      const locais = (opcoes.acoes || []).map(a => ({ ...a, local: true }));
      const remotas = servidor?.acoes || [];
      const todas = [...locais, ...remotas];
      if (opcoes.sala?.() && !servidor) return h('p', { class: 'suave' }, 'Carregando as ações da partida...');
      if (!todas.length) return h('p', { class: 'suave' }, opcoes.sala?.() ? 'Nada para mexer agora (a partida precisa estar em andamento).' : 'Este jogo não tem ações no menu.');
      const grupos = new Map();
      for (const a of todas) {
        const g = a.grupo || 'Partida';
        if (!grupos.has(g)) grupos.set(g, []);
        grupos.get(g).push(a);
      }
      return [
        h('p', { class: 'adm-nota' }, icone('alerta'), 'Mexer na partida tira ela do ranking e dos recordes.'),
        ...[...grupos].map(([g, lista]) => h('section', { class: 'adm-grupo' }, h('h3', null, g), h('div', { class: 'adm-acoes' }, lista.map(cartaoAcao)))),
      ];
    }

    function cartaoAcao(a) {
      const entradas = {};
      const campos = [...(a.alvo === 'jogador' ? [{ id: 'alvo', nome: 'Jogador', tipo: 'escolha', opcoes: (servidor?.jogadores || []).filter(p => !p.saiu).map(p => [p.i, p.nome]) }] : []), ...(a.campos || [])];
      const linhas = campos.map(c => {
        let el;
        if (c.tipo === 'escolha') {
          el = h('select', { class: 'input' }, (c.opcoes || []).map(([v, n]) => h('option', { value: String(v) }, n)));
          if (c.padrao != null) el.value = String(c.padrao);
        } else {
          el = h('input', { class: 'input', type: c.tipo === 'numero' ? 'number' : 'text', value: c.padrao ?? '', min: c.min, max: c.max });
        }
        entradas[c.id] = { el, c };
        return h('label', { class: 'adm-campo' }, h('span', null, c.nome), el);
      });
      const ler = () => Object.fromEntries(Object.entries(entradas).map(([k, { el, c }]) => {
        const v = el.value;
        if (c.tipo === 'numero') return [k, Number(v)];
        if (c.tipo === 'escolha' && (c.opcoes || []).every(([x]) => typeof x === 'number')) return [k, Number(v)];
        return [k, v];
      }));
      const fazer = async () => {
        if (a.perigo && !await confirmar(`${a.nome}? ${a.ajuda || ''}`.trim(), { ok: a.nome, perigo: true })) return;
        const valores = ler();
        if (a.local) {
          try {
            const r = await a.executar(valores);
            api.marcar();
            aviso(r || `${a.nome}: feito.`);
          } catch (e) { aviso(e.message, 'erro'); }
          return;
        }
        api.marcar();
        enviar('adm:jogo', { id: opcoes.sala(), acao: a.id, dados: valores });
      };
      return h('div', { class: 'adm-acao' },
        h('div', { class: 'adm-acao-cab' }, h('strong', null, a.nome), a.ajuda && h('small', null, a.ajuda)),
        linhas.length ? h('div', { class: 'adm-campos' }, linhas) : null,
        botao(a.perigo ? 'Fazer' : 'Usar', { classe: `btn-pequeno ${a.perigo ? 'btn-perigo' : 'btn-ouro'}`, onclick: fazer }));
    }

    function alvosPossiveis() {
      if (servidor?.jogadores?.length) return servidor.jogadores.filter(p => !p.saiu).map(p => ({ id: p.id, nome: p.nome }));
      if (opcoes.jogadores) return opcoes.jogadores();
      return (rt.online || []).map(p => ({ id: p.id, nome: p.nome }));
    }

    function abaPegadinhas() {
      const lista = alvosPossiveis();
      const sala = opcoes.sala?.();
      const alvo = h('select', { class: 'input' },
        sala && h('option', { value: 'sala' }, 'Todos da partida'),
        lista.map(p => h('option', { value: String(p.id) }, p.nome)));
      const segundos = h('input', { class: 'input', type: 'number', min: 1, max: 120, placeholder: 'padrão' });
      const usar = efeito => {
        const v = alvo.value;
        if (!v) { aviso('Escolha quem leva a pegadinha.', 'erro'); return; }
        const dados = { efeito, segundos: Number(segundos.value) || undefined };
        if (v === 'sala') dados.sala = sala; else dados.alvos = [Number(v)];
        // Atrapalhar alguém (ou a mim mesmo) numa partida tira a partida do ranking.
        if (EFEITOS[efeito].tipo === 'atrapalhar') api.marcar();
        enviar('adm:efeito', dados);
      };
      const grade = tipo => h('div', { class: 'adm-efeitos' }, Object.entries(EFEITOS).filter(([, e]) => e.tipo === tipo)
        .map(([k, e]) => h('button', { type: 'button', class: 'btn btn-pequeno', onclick: () => usar(k) }, e.nome)));
      return [
        h('div', { class: 'adm-campos' },
          h('label', { class: 'adm-campo' }, h('span', null, 'Quem leva'), alvo),
          h('label', { class: 'adm-campo' }, h('span', null, 'Duração (segundos)'), segundos)),
        lista.length || sala ? null : h('p', { class: 'suave' }, 'Ninguém online agora.'),
        h('section', { class: 'adm-grupo' }, h('h3', null, 'Atrapalhar'), h('small', { class: 'suave' }, 'Mexe no controle de quem leva. Numa partida, ela deixa de valer para o ranking.'), grade('atrapalhar')),
        h('section', { class: 'adm-grupo' }, h('h3', null, 'Efeitos na tela'), grade('visual')),
        h('p', { class: 'suave' }, 'Para ajudar alguém (vida, escudo, pontos) ou mexer na partida, use a aba Este jogo.'),
      ];
    }

    let pessoas = null;
    function abaCenouras() {
      const busca = h('input', { class: 'input', placeholder: 'Procurar pelo nome...' });
      const escolha = h('select', { class: 'input' }, h('option', { value: '' }, 'Carregando...'));
      const qtd = h('input', { class: 'input', type: 'number', min: 1, value: 100 });
      const resultado = h('p', { class: 'suave', role: 'status' });
      const preencher = () => {
        const q = normalizar(busca.value);
        const lista = (pessoas || []).filter(p => !q || normalizar(p.nome).includes(q));
        trocar(escolha, lista.map(p => h('option', { value: String(p.id) }, p.nome)));
        if (!lista.length) escolha.append(h('option', { value: '' }, 'Ninguém com esse nome'));
      };
      busca.addEventListener('input', preencher);
      if (pessoas) preencher();
      else get('/api/pessoas').then(r => { pessoas = r.pessoas.map(p => ({ id: p.id, nome: p.nome })); preencher(); }).catch(e => aviso(e.message, 'erro'));
      const mandar = sinal => async () => {
        const id = Number(escolha.value);
        const n = Math.floor(Number(qtd.value));
        if (!id || !(n > 0)) { aviso('Escolha a pessoa e a quantidade.', 'erro'); return; }
        try {
          const r = await post('/api/clube/adm/cenouras', { usuario_id: id, quantidade: sinal * n });
          trocar(resultado, `${r.nome}: ${r.mudou >= 0 ? '+' : ''}${r.mudou} cenouras (agora tem ${r.moedas}).`);
        } catch (e) { aviso(e.message, 'erro'); }
      };
      return [
        h('p', { class: 'suave' }, 'As cenouras são a moeda do Club Coelho. Dar não tem o teto do dia; tirar nunca deixa o saldo negativo. Fica tudo no diário do sistema.'),
        h('div', { class: 'adm-campos' },
          h('label', { class: 'adm-campo' }, h('span', null, 'Procurar'), busca),
          h('label', { class: 'adm-campo' }, h('span', null, 'Pessoa'), escolha),
          h('label', { class: 'adm-campo' }, h('span', null, 'Quantas'), qtd)),
        h('div', { class: 'adm-botoes' },
          botao('Dar cenouras', { icone: 'mais', classe: 'btn-ouro', onclick: mandar(1) }),
          botao('Tirar cenouras', { classe: 'btn-perigo', onclick: mandar(-1) })),
        resultado,
      ];
    }

    desenharAbas();
    desenhar();
  }

  return api;
}
