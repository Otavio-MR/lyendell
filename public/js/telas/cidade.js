// Lyendell Dorme na tela: a sala de espera (com as opções de quem abriu), a partida e o fim.
// A tela é criada uma vez por sala e só atualiza as partes que mudam: o chat e o que a pessoa está
// digitando não somem quando alguém vota. As regras ficam no servidor (src/cidade.js).
// No meio fica a vila dos coelhos (telas/cidade-mundo.js): cada um anda com o seu coelho e usa o
// poder clicando na toca (de noite) ou no coelho (de dia) de alguém.

import { h, trocar, icone, botao, cabecalho, avatar, confirmar, aviso } from '../core.js';
import { enviar, entrarNaPartida, rt } from '../tempo-real.js';
import { criarMundo, previaDoCoelho, corDoJogador, PELOS, NOMES_PELO, ACESSORIOS, EMOTES } from './cidade-mundo.js';
import { admPodeAgir } from '../adm-jogos.js';

// Nomes, times e textos das classes (os mesmos de src/cidade.js).
export const PAPEIS = {
  coelho: { nome: 'Coelho', time: 'coelhos', icone: 'coelho', desc: 'Um morador comum de Lyendell. Não tem poder à noite, mas de dia o seu voto é a maior arma da cidade.' },
  vidente: { nome: 'Vidente', time: 'coelhos', icone: 'olho', desc: 'Toda noite escolhe alguém e descobre se é Raposo. O Raposo Alfa e o Traidor enganam a visão: parecem coelhos.' },
  aprendiz: { nome: 'Aprendiz de Vidente', time: 'coelhos', icone: 'livro', desc: 'Não faz nada até a Vidente morrer. Aí você vira a nova Vidente.' },
  curandeira: { nome: 'Curandeira', time: 'coelhos', icone: 'cruz', desc: 'Toda noite protege alguém (pode ser você) de morrer. Não pode proteger a mesma pessoa duas noites seguidas.' },
  guarda: { nome: 'Guarda-Costas', time: 'coelhos', icone: 'escudo', desc: 'Toda noite fica de guarda na casa de alguém. Se atacarem essa pessoa, você morre no lugar dela.' },
  cacador: { nome: 'Caçador', time: 'coelhos', icone: 'alvo', desc: 'Quando morrer, de noite ou na votação, você atira em alguém e leva junto.' },
  boticaria: { nome: 'Boticária', time: 'coelhos', icone: 'pocao', desc: 'À noite vê quem os Raposos estão atacando. Tem uma poção de vida (salva a vítima) e uma de veneno (mata alguém), cada uma uma vez no jogo.' },
  nobre: { nome: 'Nobre', time: 'coelhos', icone: 'coroa', desc: 'Tem sangue Luckham: o seu voto de dia vale por dois.' },
  cupido: { nome: 'Cupido', time: 'coelhos', icone: 'coracao', desc: 'Na primeira noite flecha dois apaixonados. Se um morrer, o outro morre de tristeza. Se os dois forem os últimos vivos, vencem juntos.' },
  vigia: { nome: 'Vigia', time: 'coelhos', icone: 'lanterna', desc: 'Toda noite vigia a casa de alguém e, de manhã, sabe quem foi lá.' },
  medium: { nome: 'Médium', time: 'coelhos', icone: 'vela', desc: 'Fala com os mortos: lê o chat deles e, à noite, pode escrever lá (sem mostrar o nome).' },
  sacerdote: { nome: 'Sacerdote do Septo', time: 'coelhos', icone: 'gota', desc: 'Uma vez no jogo joga água benta em alguém à noite. Se for Raposo, ele morre; se não for, quem morre é você.' },
  anciao: { nome: 'Ancião', time: 'coelhos', icone: 'relogio', desc: 'Já viu muita coisa: sobrevive ao primeiro ataque que sofrer à noite.' },
  raposo: { nome: 'Raposo', time: 'raposos', icone: 'raposa', desc: 'À noite, junto com os outros Raposos, escolhe um coelho para pegar. De dia, finge ser coelho.' },
  alfa: { nome: 'Raposo Alfa', time: 'raposos', icone: 'raposa', desc: 'O chefe dos Raposos: o seu voto desempata o ataque, e a Vidente vê você como coelho.' },
  farejadora: { nome: 'Raposa Farejadora', time: 'raposos', icone: 'raposa', desc: 'Ataca com os Raposos e, toda noite, fareja alguém e descobre a classe exata.' },
  traidor: { nome: 'Traidor', time: 'raposos', icone: 'moeda', desc: 'Um coelho que se vendeu aos Raposos. Você sabe quem eles são (eles não sabem quem você é). Não ataca: ajude-os de dia. A Vidente vê você como coelho.' },
  bobo: { nome: 'Bobo da Corte', time: 'neutro', icone: 'mascara', desc: 'Só quer atenção: você vence se a cidade te executar na votação. O jogo continua para os outros.' },
  gatuno: { nome: 'Gatuno', time: 'neutro', icone: 'gato', desc: 'Um gato solitário da Rua Gatuno: toda noite mata alguém. Vence se sobrar sozinho ou com mais uma pessoa.' },
  andarilho: { nome: 'Andarilho', time: 'neutro', icone: 'bandeira', desc: 'Só quer chegar vivo ao fim. Tem 2 coletes: vestido à noite, salva você de um ataque. Vence se estiver vivo no fim, ganhe quem ganhar.' },
};
const OPCIONAIS = Object.keys(PAPEIS).filter(p => p !== 'coelho' && p !== 'raposo');
const TIMES = { coelhos: 'Time dos Coelhos', raposos: 'Time dos Raposos', neutro: 'Neutro: joga sozinho' };
const OBJETIVOS = {
  coelhos: 'Descobrir e executar todos os Raposos (e o Gatuno, se houver).',
  raposos: 'Pegar os coelhos até os Raposos serem tantos quanto o resto da cidade.',
};
const CANAIS = { dia: 'Praça', raposos: 'Raposos', mortos: 'Mortos' };
const FASES = {
  papeis: { icone: 'lua', titulo: 'Anoitece', texto: 'Veja a sua carta em segredo. Não conte a ninguém!' },
  noite: { icone: 'lua', titulo: 'Noite', texto: 'A cidade dorme. Quem tem poder, use agora.' },
  amanhecer: { icone: 'sol', titulo: 'Amanhece', texto: 'Veja o que aconteceu durante a noite.' },
  dia: { icone: 'sol', titulo: 'Dia', texto: 'Conversem na praça e votem em quem acham que é Raposo.' },
  execucao: { icone: 'sol', titulo: 'A votação acabou', texto: 'A cidade decidiu.' },
  cacador: { icone: 'alvo', titulo: 'O Caçador caiu', texto: 'Antes de cair, ele escolhe em quem atirar.' },
  fim: { icone: 'trofeu', titulo: 'Fim de jogo', texto: '' },
};
const CAUSAS = {
  raposos: 'pego pelos Raposos', gatuno: 'pego pelo Gatuno', veneno: 'envenenado', agua: 'caiu com a água benta',
  sacerdote: 'errou a água benta', guarda: 'morreu protegendo alguém', tristeza: 'morreu de tristeza', cacador: 'tiro do Caçador',
  execucao: 'executado pela cidade', saiu: 'foi embora', adm: 'raio do administrador',
};
const ICONE_DIARIO = { morte: 'caveira', sol: 'sol', lua: 'lua', bom: 'check', fim: 'trofeu' };
// O que aparece no menu ao clicar na toca ou no coelho de alguém.
const VERBOS = {
  atacar: ['Pegar esta noite', 'pata'], farejar: ['Farejar', 'raposa'], investigar: ['Ver se é Raposo', 'olho'], proteger: ['Proteger', 'cruz'],
  guardar: ['Ficar de guarda aqui', 'escudo'], vigiar: ['Vigiar esta toca', 'lanterna'], matar: ['Pegar (Gatuno)', 'gato'],
  agua: ['Jogar a água benta', 'gota'], votar: ['Votar para executar', 'mao'], atirar: ['Atirar', 'alvo'],
};
const NOMES_EMOTE = { oi: 'Acenar', coracao: 'Coração', risada: 'Rir', susto: 'Susto', pergunta: 'Hein?', zzz: 'Sono' };
const CHAVE_VISUAL = 'lyendell-coelho';
function visualGuardado() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_VISUAL) || 'null');
    if (v && PELOS.includes(v.pelo) && v.acessorio in ACESSORIOS) return v;
  } catch { /* sem localStorage: escolhe um */ }
  return { pelo: PELOS[Math.floor(Math.random() * PELOS.length)], acessorio: 'nenhum' };
}
function guardarVisual(v) {
  try { localStorage.setItem(CHAVE_VISUAL, JSON.stringify(v)); } catch { /* tudo bem */ }
}
const relogio = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const nomeDoPapel = p => PAPEIS[p]?.nome || p;

// Uma carta pequena de classe (ícone e nome), com a explicação ao passar o mouse.
const etiquetaPapel = (p, mais = '') => h('span', { class: `cid-papel time-${PAPEIS[p]?.time}`, title: PAPEIS[p]?.desc }, icone(PAPEIS[p]?.icone || 'coelho'), nomeDoPapel(p), mais);

// sair: sair da sala de espera (pergunta antes se for quem abriu); sairJa: sair sem perguntar.
export function criarTelaCidade(id, { sair, sairJa }) {
  const el = h('div', { class: 'cidade' });
  const topo = h('div');
  const corpo = h('div');
  el.append(topo, corpo);
  let s = null;
  let faseAntes = null;
  let fimLocal = 0;
  let duracao = 1;
  let flechas = [];
  // Chat: as mensagens de cada canal (sem repetir) e o canal aberto.
  const msgs = { dia: [], raposos: [], mortos: [] };
  const vistas = new Set();
  const naoLidas = { dia: 0, raposos: 0, mortos: 0 };
  let canal = 'dia';
  const listaChat = h('div', { class: 'cid-chat-lista', role: 'log', 'aria-live': 'polite' });
  const abasChat = h('div', { class: 'cid-chat-abas', role: 'tablist' });
  const entrada = h('input', { class: 'input', maxlength: '300', placeholder: 'Escreva para a praça...', 'aria-label': 'Mensagem' });
  const formChat = h('form', { class: 'cid-chat-form' }, entrada, h('button', { class: 'btn btn-ouro', type: 'submit', 'aria-label': 'Enviar' }, icone('aviao')));
  const painelChat = h('section', { class: 'painel cid-chat' }, abasChat, listaChat, formChat);
  formChat.addEventListener('submit', ev => {
    ev.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    if (enviar('cidade:falar', { id, canal, texto })) entrada.value = '';
  });
  const faixaTempo = h('span', { class: 'cid-tempo' });
  const barraTempo = h('span', { class: 'cid-barra' }, h('span'));

  // A vila: o canvas, o menu que abre ao clicar em alguém e a barra de emotes.
  const menu = h('div', { class: 'vila-menu', hidden: true, role: 'menu' });
  const mundo = criarMundo(id, { aoClicar: clicouNaVila, nomeDoPapel });
  mundo.el.append(menu);
  const barraEmotes = h('div', { class: 'vila-emotes', 'aria-label': 'Emotes' },
    Object.entries(EMOTES).map(([chave, emoji], k) => h('button', {
      type: 'button', class: 'vila-emote', title: `${NOMES_EMOTE[chave]} (tecla ${k + 1})`, 'aria-label': NOMES_EMOTE[chave],
      onclick: () => mundo.emotar(chave),
    }, emoji)));
  const areaVila = h('div', { class: 'cid-vila' }, mundo.el, barraEmotes);
  let visualEnviado = false;
  const fecharMenu = () => { menu.hidden = true; };
  document.addEventListener('pointerdown', fecharFora);
  function fecharFora(ev) { if (!menu.hidden && !menu.contains(ev.target) && ev.target !== mundo.el.querySelector('canvas')) fecharMenu(); }

  function guardar(m) {
    if (vistas.has(m.n)) return false;
    vistas.add(m.n);
    msgs[m.canal].push(m);
    if (msgs[m.canal].length > 150) msgs[m.canal].shift();
    return true;
  }

  function desenharChat() {
    const e = s?.estado;
    const canais = e?.canais || ['dia'];
    if (!canais.includes(canal)) canal = 'dia';
    naoLidas[canal] = 0;
    trocar(abasChat, canais.map(c => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(c === canal), class: `cid-chat-aba c-${c} ${c === canal ? 'ativa' : ''}`.trim(),
      onclick: () => { canal = c; desenharChat(); },
    }, CANAIS[c], naoLidas[c] > 0 && h('span', { class: 'aba-n aba-alerta' }, naoLidas[c]))));
    const perto = listaChat.scrollHeight - listaChat.scrollTop - listaChat.clientHeight < 60;
    trocar(listaChat, msgs[canal].length
      ? msgs[canal].map(m => h('p', { class: `cid-msg ${m.de === s?.eu ? 'minha' : ''}`.trim() },
        h('strong', null, m.nome), ' ', m.texto))
      : h('p', { class: 'cid-chat-vazio' }, canal === 'raposos' ? 'Combinem aqui quem pegar. Só os Raposos leem.' : canal === 'mortos' ? 'Aqui só os mortos (e a Médium) leem.' : 'Ninguém falou ainda.'));
    if (perto || !listaChat.dataset.rolou) { listaChat.scrollTop = listaChat.scrollHeight; listaChat.dataset.rolou = '1'; }
    const pode = (e?.falar || []).includes(canal);
    entrada.disabled = !pode;
    formChat.querySelector('button').disabled = !pode;
    entrada.placeholder = pode
      ? { dia: 'Escreva para a praça...', raposos: 'Fale só com os Raposos...', mortos: s?.estado?.eu?.vivo ? 'Escreva aos mortos (sem o seu nome)...' : 'Fale com os outros mortos...' }[canal]
      : canal === 'dia' && e?.fase === 'noite' ? 'A cidade está dormindo...' : s?.eu < 0 ? 'Você está assistindo.' : 'Você não pode falar aqui agora.';
  }

  // Mensagem nova chegou pelo WebSocket.
  function mensagem(m) {
    if (!guardar(m)) return;
    mundo.balao(m);
    if (m.canal !== canal) naoLidas[m.canal]++;
    desenharChat();
  }

  function tique() {
    const resta = Math.max(0, fimLocal - Date.now());
    faixaTempo.textContent = s?.estado?.fase === 'fim' || !fimLocal ? '' : relogio(resta);
    barraTempo.firstChild.style.width = `${Math.min(100, (resta / duracao) * 100)}%`;
  }
  const relogioId = setInterval(tique, 250);

  // Congelado (pegadinha do menu de administrador): nada de poder nem voto até passar (o servidor também confere).
  const jogar = jogada => {
    if (!admPodeAgir()) { aviso('Você está congelado! Espere o gelo derreter.', 'erro'); return; }
    enviar('sala:jogar', { id, jogada });
  };

  /* A vila: clicar no chão anda; clicar numa toca ou num coelho abre o menu do que dá para fazer. */
  function opcoesPara(k) {
    const e = s?.status === 'jogando' ? s.estado : null;
    const lista = [];
    for (const a of e?.eu?.acoes || []) {
      if (a.tipo === 'flechar' && a.alvos.includes(k)) {
        const marcado = flechas.includes(k);
        lista.push({
          rotulo: marcado ? 'Tirar a flecha' : `Flechar${flechas.length === 1 ? ' (o segundo apaixonado)' : ' (escolha dois)'}`, icone: 'coracao', ativo: marcado,
          fazer: () => {
            flechas = marcado ? flechas.filter(x => x !== k) : [...flechas, k].slice(-2);
            if (flechas.length === 2) jogar({ tipo: 'flechar', alvos: flechas });
            atualizar(s);
          },
        });
      } else if (a.tipo === 'pocoes') {
        if (a.veneno && a.alvos.includes(k)) {
          const marcado = a.escolhido === k;
          lista.push({ rotulo: marcado ? 'Desistir do veneno' : 'Envenenar', icone: 'pocao', ativo: marcado, fazer: () => jogar({ tipo: 'pocoes', veneno: marcado ? null : k, pronto: a.pronto }) });
        }
      } else if (a.alvos?.includes(k) && VERBOS[a.tipo]) {
        const marcado = a.escolhido === k;
        const [rotulo, ic] = VERBOS[a.tipo];
        lista.push({
          rotulo: marcado ? `${rotulo} (escolhido)` : rotulo, icone: ic, ativo: marcado,
          fazer: () => { if (!marcado) jogar({ tipo: a.tipo, alvo: k }); },
        });
      }
    }
    return lista;
  }

  function clicouNaVila({ tipo, k, x, y, sx, sy }) {
    fecharMenu();
    if (tipo === 'chao') { mundo.andarAte(x, y); return; }
    if (!s || k < 0 || !s.jogadores[k]) return;
    const e = s.status === 'jogando' ? s.estado : null;
    const p = s.jogadores[k];
    const x2 = e?.jogadores[k];
    const opcoes = opcoesPara(k);
    const irAte = () => {
      const alvo = tipo === 'coelho' ? mundo.pertoDe(k) : mundo.porta(k);
      if (alvo) mundo.andarAte(alvo.x, alvo.y);
    };
    const papel = x2?.papel;
    trocar(menu,
      h('div', { class: 'vila-menu-cab' },
        h('span', { class: 'vila-menu-cor', style: { background: corDoJogador(k) } }),
        h('strong', null, k === s.eu ? `${p.nome} (você)` : p.nome),
        x2 && !x2.vivo && h('small', null, icone('caveira'), ` ${CAUSAS[x2.causa] || 'morreu'}`)),
      papel && etiquetaPapel(papel),
      x2?.aliado && h('small', { class: 'vila-menu-nota' }, icone('raposa'), ' Raposo, como você'),
      x2?.amante && h('small', { class: 'vila-menu-nota' }, icone('coracao'), ' Apaixonados'),
      opcoes.map(o => h('button', {
        type: 'button', role: 'menuitem', class: `vila-menu-acao ${o.ativo ? 'ativa' : ''}`.trim(),
        onclick: () => { o.fazer(); if (!o.ativo) irAte(); fecharMenu(); },
      }, icone(o.icone), o.rotulo)),
      s.eu >= 0 && (k !== s.eu || tipo === 'toca') && h('button', {
        type: 'button', role: 'menuitem', class: 'vila-menu-acao suave',
        onclick: () => { irAte(); fecharMenu(); },
      }, icone('frente'), tipo === 'coelho' ? 'Ir até ele' : k === s.eu ? 'Voltar para a minha toca' : 'Ir até a toca'));
    if (!opcoes.length && s.eu >= 0 && tipo === 'toca' && k === s.eu) { irAte(); return; }
    menu.hidden = false;
    // O menu abre perto do clique, sem sair da vila.
    const caixa = mundo.el.getBoundingClientRect();
    const lw = menu.offsetWidth;
    const lh = menu.offsetHeight;
    menu.style.left = `${Math.max(6, Math.min(caixa.width - lw - 6, sx + 10))}px`;
    menu.style.top = `${Math.max(6, Math.min(caixa.height - lh - 6, sy - lh / 2))}px`;
  }

  // O que a vila destaca: as tocas (de noite) ou os coelhos (votação, Caçador) onde dá para usar o poder agora.
  function destaques(e) {
    const tocas = new Set();
    const coelhos = new Set();
    if (e && s.status === 'jogando' && e.fase !== 'fim') {
      for (const a of e.eu?.acoes || []) {
        if (!a.alvos || a.tipo === 'pocoes') continue;
        const falta = a.tipo === 'flechar' ? a.escolhido.length < 2 : a.escolhido === undefined || a.escolhido === null;
        if (!falta) continue;
        for (const k of a.alvos) (a.tipo === 'votar' || a.tipo === 'atirar' ? coelhos : tocas).add(k);
      }
    }
    return { tocas, coelhos };
  }

  // A cor do pelo e o acessório do meu coelho (fica guardado neste navegador).
  function painelCoelho() {
    const meu = s.mundo?.visuais?.[s.jogadores[s.eu].id] || visualGuardado();
    const mudar = novo => {
      const v = { ...meu, ...novo };
      guardarVisual(v);
      enviar('cidade:visual', { id, ...v });
    };
    return h('section', { class: 'painel cid-meu-coelho' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('coelho'), 'O seu coelho')),
      h('div', { class: 'cid-coelho-linha' },
        h('div', { class: 'cid-coelho-previa' }, previaDoCoelho(meu)),
        h('div', { class: 'cid-coelho-opcoes' },
          h('p', { class: 'cid-opcao-titulo' }, 'Pelo'),
          h('div', { class: 'cid-pelos' }, PELOS.map((cor, k) => h('button', {
            type: 'button', class: `cid-pelo ${meu.pelo === cor ? 'ativo' : ''}`.trim(), title: NOMES_PELO[k], 'aria-label': NOMES_PELO[k],
            'aria-pressed': String(meu.pelo === cor), style: { background: cor }, onclick: () => mudar({ pelo: cor }),
          }))),
          h('p', { class: 'cid-opcao-titulo' }, 'Acessório'),
          h('div', { class: 'cid-chips' }, Object.entries(ACESSORIOS).map(([chave, nome]) => h('button', {
            type: 'button', class: `filtro-chip ${meu.acessorio === chave ? 'ativo' : ''}`.trim(), 'aria-pressed': String(meu.acessorio === chave),
            onclick: () => mudar({ acessorio: chave }),
          }, nome))))),
      h('p', { class: 'suave cid-coelho-dica' }, 'Ande pela vila com as setas ou W A S D (ou clicando no chão). Teclas 1 a 6 fazem emotes.'));
  }

  /* Sala de espera */
  function espera() {
    const jogador = s.eu >= 0;
    const souDono = jogador && s.dono === s.jogadores[s.eu].id;
    const o = s.opcoes || { tempoDia: 120000, revelar: true, desligadas: [] };
    const mudar = novas => enviar('cidade:opcoes', { id, opcoes: { ...o, ...novas } });
    const basta = s.jogadores.length >= s.min;
    const n = s.jogadores.length;
    return h('div', { class: 'cid-espera' },
      areaVila,
      jogador && painelCoelho(),
      h('section', { class: 'painel' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('usuarios'), `Na sala: ${n} de ${s.max}`)),
        h('div', { class: 'quiz-na-sala' }, s.jogadores.map(p => h('div', { class: `quiz-pessoa ${p.conectado ? '' : 'ausente'}`.trim() },
          avatar(p.nome, '', p.foto), h('span', null, p.nome),
          p.id === s.dono && h('span', { class: 'quiz-dono', title: 'Abriu a sala' }, icone('coroa'))))),
        h('p', { class: 'suave cid-conta' }, `Com ${n} ${n === 1 ? 'pessoa' : 'pessoas'}: ${n <= 6 ? 1 : n <= 10 ? 2 : 3} ${n <= 6 ? 'Raposo' : 'Raposos'}${n >= 7 ? `, ${n >= 12 ? 2 : 1} neutro${n >= 12 ? 's' : ''}` : ''}${n >= 9 ? ' e talvez um Traidor' : ''}. O resto são coelhos, quase todos com poder.`),
        h('div', { class: 'quiz-espera-acao' },
          souDono
            ? [botao(basta ? 'Começar a partida' : `Esperando gente (mínimo ${s.min})...`, { classe: 'btn-ouro btn-grande', icone: 'lua', desativado: !basta, onclick: () => enviar('sala:comecar', { id }) }),
              h('p', { class: 'suave' }, `De ${s.min} a ${s.max} pessoas. A sala aparece no salão para todos.`)]
            : jogador
              ? h('p', { class: 'quiz-aguarde' }, h('span', { class: 'giro giro-p' }), ' Esperando quem abriu a sala começar...')
              : [s.jogadores.length < s.max && !rt.minhaSala && botao('Entrar nesta sala', { classe: 'btn-ouro', onclick: () => entrarNaPartida(s.id) }),
                h('p', { class: 'suave' }, 'Você está assistindo.')])),
      h('section', { class: 'painel cid-opcoes' },
        h('div', { class: 'painel-cab' }, h('h2', null, icone('ajustes'), 'Opções'), !souDono && h('small', { class: 'suave' }, 'Só quem abriu a sala muda')),
        h('div', { class: 'cid-opcao' }, h('span', null, 'Tempo do dia'),
          h('div', { class: 'segmentado' }, [60000, 120000, 180000].map(t => h('button', {
            type: 'button', class: `seg ${o.tempoDia === t ? 'ativo' : ''}`.trim(), disabled: !souDono, onclick: () => mudar({ tempoDia: t }),
          }, `${t / 60000} min`)))),
        h('label', { class: 'mapa-check cid-opcao' }, h('input', { type: 'checkbox', checked: o.revelar, disabled: !souDono, onchange: ev => mudar({ revelar: ev.target.checked }) }),
          h('span', null, 'Mostrar a classe de quem morre')),
        h('p', { class: 'cid-opcao-titulo' }, 'Classes que podem sair', h('small', { class: 'suave' }, ' (clique para ligar ou desligar)')),
        h('div', { class: 'cid-classes' }, OPCIONAIS.map(p => {
          const ligada = !o.desligadas.includes(p);
          return h('button', {
            type: 'button', class: `cid-papel time-${PAPEIS[p].time} ${ligada ? '' : 'desligada'}`.trim(), title: PAPEIS[p].desc, disabled: !souDono,
            'aria-pressed': String(ligada),
            onclick: () => mudar({ desligadas: ligada ? [...o.desligadas, p] : o.desligadas.filter(x => x !== p) }),
          }, icone(PAPEIS[p].icone), PAPEIS[p].nome);
        }))),
      comoJogar());
  }

  function comoJogar() {
    return h('details', { class: 'painel cid-regras' },
      h('summary', null, icone('pergunta'), 'Como jogar'),
      h('p', null, 'Cada pessoa recebe uma carta secreta. À noite a cidade dorme: os ', h('strong', null, 'Raposos'),
        ' escolhem juntos um coelho para pegar, e quem tem poder usa (a Vidente investiga, a Curandeira protege...).'),
      h('p', null, 'De manhã todos veem quem morreu. De dia a cidade conversa na praça e vota em quem executar. Empate ou "pular" não executa ninguém.'),
      h('p', null, h('strong', null, 'Coelhos'), ' vencem quando não sobra nenhum Raposo (nem o Gatuno). ', h('strong', null, 'Raposos'),
        ' vencem quando são tantos quanto o resto. Os neutros têm o próprio objetivo.'),
      h('div', { class: 'cid-classes' }, Object.keys(PAPEIS).map(p => h('div', { class: 'cid-regra-papel' }, etiquetaPapel(p), h('small', null, PAPEIS[p].desc)))));
  }

  /* Partida */
  function cartaMinha(e) {
    const p = e.eu.papel;
    const info = PAPEIS[p];
    const aliados = e.jogadores.map((x, k) => (x.aliado ? s.jogadores[k].nome : null)).filter(Boolean);
    const amante = e.jogadores.findIndex(x => x.amante);
    return h('section', { class: `painel cid-carta time-${info.time} ${e.eu.vivo ? '' : 'morta'}`.trim() },
      h('p', { class: 'cid-carta-sobre' }, 'Sua carta'),
      h('span', { class: 'cid-carta-icone' }, icone(info.icone)),
      h('h2', null, info.nome),
      h('p', { class: 'cid-carta-time' }, TIMES[info.time]),
      h('p', { class: 'cid-carta-desc' }, info.desc),
      OBJETIVOS[info.time] && h('p', { class: 'cid-carta-objetivo' }, h('strong', null, 'Objetivo: '), OBJETIVOS[info.time]),
      aliados.length > 0 && h('p', { class: 'cid-carta-extra' }, icone('raposa'), ` Raposos: ${aliados.join(', ')}`),
      amante >= 0 && h('p', { class: 'cid-carta-extra' }, icone('coracao'), ` Apaixonado por ${s.jogadores[amante].nome}`),
      !e.eu.vivo && h('p', { class: 'cid-carta-extra' }, icone('caveira'), ' Você morreu. Agora vê todas as cartas e fala com os mortos.'),
      e.eu.notas.length > 0 && h('div', { class: 'cid-notas' },
        h('p', { class: 'cid-notas-titulo' }, 'Só você sabe'),
        h('ol', null, [...e.eu.notas].reverse().slice(0, 12).map(n => h('li', null, n.dia ? h('small', null, `Noite ${n.dia}`) : null, n.texto)))));
  }

  function listaDePapeis(e) {
    const contagem = {};
    for (const p of e.papeisNoJogo) contagem[p] = (contagem[p] || 0) + 1;
    return h('section', { class: 'painel cid-no-jogo' },
      h('p', { class: 'cid-notas-titulo' }, 'Classes nesta partida'),
      h('div', { class: 'cid-classes' }, Object.entries(contagem).map(([p, q]) => etiquetaPapel(p, q > 1 ? ` x${q}` : ''))));
  }

  function praca(e) {
    const acoes = e.eu?.acoes || [];
    const principal = acoes.find(a => a.alvos && a.tipo !== 'pocoes' && a.tipo !== 'flechar');
    const votantes = {};
    e.jogadores.forEach((x, k) => { if (x.voto != null && x.voto >= 0) (votantes[x.voto] ||= []).push(s.jogadores[k].nome); });
    const ataque = e.ataque?.votos || {};
    const patas = {};
    for (const alvo of Object.values(ataque)) if (alvo != null) patas[alvo] = (patas[alvo] || 0) + 1;
    return h('div', { class: 'cid-praca' }, e.jogadores.map((x, k) => {
      const p = s.jogadores[k];
      const alvoPossivel = principal?.alvos.includes(k);
      const escolhido = principal && principal.escolhido === k;
      const papel = x.papel;
      return h(alvoPossivel ? 'button' : 'div', {
        type: alvoPossivel ? 'button' : null,
        class: ['cid-pessoa', !x.vivo && 'morta', k === s.eu && 'eu', x.aliado && 'aliado', escolhido && 'escolhida', alvoPossivel && 'clicavel',
          k === e.cacadorDaVez && 'cacador', e.executado === k && 'executada', p.saiu && 'saiu'].filter(Boolean).join(' '),
        style: { '--toca': corDoJogador(k) },
        onclick: alvoPossivel ? () => jogar({ tipo: principal.tipo, alvo: k }) : null,
        title: papel ? `${p.nome}: ${nomeDoPapel(papel)}` : p.nome,
      },
      h('span', { class: 'cid-av' }, avatar(p.nome, '', p.foto), !x.vivo && h('span', { class: 'cid-caveira' }, icone('caveira'))),
      h('strong', null, p.nome, k === s.eu && h('small', null, ' (você)')),
      papel ? etiquetaPapel(papel) : h('span', { class: 'cid-papel oculto' }, x.vivo ? '?' : 'classe secreta'),
      !x.vivo && x.causa && h('small', { class: 'cid-causa' }, CAUSAS[x.causa]),
      x.amante && h('span', { class: 'cid-marca amor', title: 'Apaixonados' }, icone('coracao')),
      x.aliado && h('span', { class: 'cid-marca raposa', title: 'Raposo, como você' }, icone('raposa')),
      e.votos[k] > 0 && h('span', { class: 'cid-votos', title: `Votos: ${(votantes[k] || []).join(', ')}` }, e.votos[k]),
      patas[k] > 0 && h('span', { class: 'cid-votos patas', title: 'Votos dos Raposos' }, icone('pata'), patas[k]),
      e.fase === 'dia' && x.voto != null && h('small', { class: 'cid-votou' }, x.voto === -1 ? 'quer pular' : `vota em ${s.jogadores[x.voto]?.nome}`));
    }));
  }

  // O que fazer agora (cada ação com as pessoas possíveis em botões).
  function painelAcao(e) {
    const acoes = e.eu?.acoes || [];
    const nome = k => s.jogadores[k]?.nome;
    const chips = a => h('div', { class: 'cid-chips' },
      a.alvos.map(k => h('button', {
        type: 'button', class: `filtro-chip ${a.escolhido === k ? 'ativo' : ''}`.trim(), 'aria-pressed': String(a.escolhido === k),
        onclick: () => jogar({ tipo: a.tipo, alvo: k }),
      }, nome(k))),
      a.pular && h('button', {
        // No voto, null é "ainda não votou" e -1 é "pular"; nas outras ações, null é "não fazer nada".
        type: 'button', class: `filtro-chip ${(a.tipo === 'votar' ? a.escolhido === -1 : a.escolhido === null) ? 'ativo' : ''}`.trim(),
        onclick: () => jogar({ tipo: a.tipo, alvo: a.tipo === 'votar' ? -1 : null }),
      }, a.tipo === 'votar' ? 'Ninguém (pular)' : 'Não fazer nada'));
    let conteudo;
    if (s.eu < 0) conteudo = h('p', { class: 'suave' }, 'Você está assistindo. As cartas só aparecem quando alguém morre.');
    else if (!acoes.length) {
      const fase = e.fase;
      conteudo = h('p', { class: 'suave' }, !e.eu.vivo ? (fase === 'cacador' ? 'O Caçador está escolhendo...' : 'Você está morto: assista e converse com os mortos.')
        : fase === 'noite' ? 'Você está dormindo. Espere amanhecer.'
          : fase === 'papeis' ? 'Leia a sua carta. A primeira noite já vai começar.'
            : fase === 'cacador' ? 'O Caçador está escolhendo em quem atirar...'
              : 'Veja o que aconteceu no diário da cidade.');
    } else {
      conteudo = acoes.map(a => {
        if (a.tipo === 'flechar') {
          flechas = flechas.filter(k => a.alvos.includes(k)).slice(0, 2);
          if (a.escolhido.length === 2 && !flechas.length) flechas = [...a.escolhido];
          return h('div', { class: 'cid-acao' }, h('p', { class: 'cid-acao-titulo' }, icone('coracao'), a.titulo),
            h('div', { class: 'cid-chips' }, a.alvos.map(k => h('button', {
              type: 'button', class: `filtro-chip ${flechas.includes(k) ? 'ativo' : ''}`.trim(),
              onclick: () => { flechas = flechas.includes(k) ? flechas.filter(x => x !== k) : [...flechas, k].slice(-2); atualizar(s); },
            }, nome(k)))),
            botao(a.escolhido.length === 2 ? 'Trocar as flechas' : 'Flechar', { icone: 'coracao', classe: 'btn-ouro btn-pequeno', desativado: flechas.length !== 2, onclick: () => jogar({ tipo: 'flechar', alvos: flechas }) }),
            a.escolhido.length === 2 && h('small', { class: 'suave' }, `Flechados: ${a.escolhido.map(nome).join(' e ')}`));
        }
        if (a.tipo === 'colete') {
          return h('div', { class: 'cid-acao' }, h('p', { class: 'cid-acao-titulo' }, icone('escudo'), a.titulo),
            h('div', { class: 'cid-chips' },
              h('button', { type: 'button', class: `filtro-chip ${a.escolhido === true ? 'ativo' : ''}`.trim(), onclick: () => jogar({ tipo: 'colete', vestir: true }) }, 'Vestir o colete'),
              h('button', { type: 'button', class: `filtro-chip ${a.escolhido === false ? 'ativo' : ''}`.trim(), onclick: () => jogar({ tipo: 'colete', vestir: false }) }, 'Hoje não')));
        }
        if (a.tipo === 'pocoes') {
          return h('div', { class: 'cid-acao' }, h('p', { class: 'cid-acao-titulo' }, icone('pocao'), 'As suas poções'),
            h('p', { class: 'cid-vitima' }, a.vitima != null ? `Os Raposos estão atacando: ${nome(a.vitima)}` : 'Os Raposos ainda não escolheram ninguém.'),
            a.vida && h('label', { class: 'mapa-check' }, h('input', { type: 'checkbox', checked: a.usarVida, onchange: ev => jogar({ tipo: 'pocoes', vida: ev.target.checked, pronto: a.pronto }) }),
              h('span', null, 'Usar a poção de vida em quem for atacado')),
            !a.vida && h('p', { class: 'suave' }, 'A poção de vida já foi usada.'),
            a.veneno ? [h('p', { class: 'suave' }, 'Envenenar alguém?'), h('div', { class: 'cid-chips' },
              a.alvos.map(k => h('button', {
                type: 'button', class: `filtro-chip ${a.escolhido === k ? 'ativo' : ''}`.trim(), onclick: () => jogar({ tipo: 'pocoes', veneno: k, pronto: a.pronto }),
              }, nome(k))),
              h('button', { type: 'button', class: `filtro-chip ${a.escolhido == null ? 'ativo' : ''}`.trim(), onclick: () => jogar({ tipo: 'pocoes', veneno: null, pronto: a.pronto }) }, 'Ninguém'))]
              : h('p', { class: 'suave' }, 'O veneno já foi usado.'),
            botao(a.pronto ? 'Pronto (clique para mudar)' : 'Pronto', { icone: 'check', classe: `btn-pequeno ${a.pronto ? '' : 'btn-ouro'}`.trim(), onclick: () => jogar({ tipo: 'pocoes', pronto: !a.pronto }) }));
        }
        return h('div', { class: 'cid-acao' }, h('p', { class: 'cid-acao-titulo' }, icone(a.tipo === 'atacar' ? 'pata' : a.tipo === 'votar' ? 'mao' : a.tipo === 'atirar' ? 'alvo' : PAPEIS[e.eu.papel].icone), a.titulo),
          chips(a));
      });
    }
    return h('section', { class: `painel cid-acoes ${acoes.length && e.eu?.pronto === false ? 'pendente' : ''}`.trim() },
      conteudo,
      e.fase === 'noite' && e.eu?.pronto && acoes.length > 0 && h('p', { class: 'cid-pronto' }, icone('check'), 'Pronto! Você ainda pode mudar até a noite acabar.'));
  }

  function diario(e) {
    return h('section', { class: 'painel cid-diario' },
      h('p', { class: 'cid-notas-titulo' }, 'Diário da cidade'),
      h('ol', null, [...e.diario].reverse().map(d => h('li', { class: `d-${d.tipo}` }, icone(ICONE_DIARIO[d.tipo] || 'pena'), h('span', null, d.texto)))));
  }

  function fimDeJogo(e) {
    const v = e.vencedores;
    const venceu = s.eu >= 0 && v?.indices.includes(s.eu);
    return h('section', { class: `painel cid-fim ${venceu ? 'venci' : ''}`.trim() },
      h('span', { class: 'cid-fim-icone' }, icone(v?.time === 'raposos' ? 'raposa' : v?.time === 'gatuno' ? 'gato' : v?.time === 'amantes' ? 'coracao' : v?.time === 'neutro' ? 'mascara' : 'coelho')),
      h('h2', null, v?.texto || 'Fim de jogo.'),
      s.eu >= 0 && h('p', { class: 'cid-fim-voce' }, venceu ? 'Você venceu!' : 'Não foi desta vez.'),
      v?.indices.length > 0 && h('p', { class: 'suave' }, `Vencedores: ${v.indices.map(k => s.jogadores[k].nome).join(', ')}`),
      h('div', { class: 'partida-rodape' },
        s.eu >= 0 && s.dono === s.jogadores[s.eu]?.id && botao('Jogar de novo', { icone: 'lua', classe: 'btn-ouro', onclick: () => enviar('sala:revanche', { id }) }),
        s.eu >= 0 && s.dono !== s.jogadores[s.eu]?.id && h('p', { class: 'suave' }, 'Quem abriu a sala pode começar outra partida com quem ficou.'),
        h('a', { class: 'btn', href: '#/recreacao' }, 'Voltar ao salão')));
  }

  function faixa(e) {
    const f = FASES[e.fase] || FASES.noite;
    const titulo = e.fase === 'noite' ? `Noite ${e.dia}` : e.fase === 'dia' ? `Dia ${e.dia}` : f.titulo;
    return h('div', { class: `cid-faixa f-${e.fase}` },
      h('span', { class: 'cid-faixa-icone' }, icone(f.icone)),
      h('div', null, h('strong', null, titulo), h('small', null, e.fase === 'fim' ? e.vencedores?.texto : f.texto)),
      faixaTempo, barraTempo);
  }

  function atualizar(nova) {
    s = nova;
    const jogador = s.eu >= 0;
    const eu = jogador ? s.jogadores[s.eu] : null;
    const souDono = jogador && s.dono === eu.id;
    const botoes = [];
    if (jogador && s.status === 'esperando') botoes.push(botao(souDono ? 'Fechar a sala' : 'Sair da sala', { icone: 'x', onclick: sair }));
    else if (jogador && s.status === 'jogando' && !eu.saiu) {
      botoes.push(botao('Sair da partida', {
        icone: 'bandeira', classe: 'btn-perigo-texto',
        onclick: async () => { if (await confirmar('Se sair agora, o seu personagem morre e você não entra no resultado.', { titulo: 'Sair da partida?', ok: 'Sair', perigo: true })) sairJa(); },
      }));
    } else if (!jogador) botoes.push(h('a', { class: 'btn', href: '#/recreacao' }, icone('voltar'), h('span', null, 'Parar de assistir')));
    trocar(topo, cabecalho({
      titulo: 'Lyendell Dorme', icone: 'lua', voltar: { href: '#/recreacao', texto: 'Recreação' }, acoes: botoes,
      sub: 'Os Raposos atacam à noite; de dia a cidade descobre e executa. De 4 a 15 pessoas.',
    }));
    const e = s.estado;
    el.classList.toggle('noite', !!e && ['papeis', 'noite'].includes(e.fase));
    if (jogador && !visualEnviado) {
      visualEnviado = true;
      if (!s.mundo?.visuais?.[eu.id]) enviar('cidade:visual', { id, ...visualGuardado() }, { silencioso: true });
    }
    mundo.atualizar(s, { destaquesNovos: destaques(e) });
    barraEmotes.hidden = !jogador || !!eu?.saiu;
    if (!menu.hidden && s.status !== 'jogando') fecharMenu();
    if (s.status === 'esperando' || !e) {
      faseAntes = null;
      trocar(corpo, espera());
      return;
    }
    for (const c of Object.keys(e.chat || {})) for (const m of e.chat[c]) guardar(m);
    fimLocal = e.fase === 'fim' ? 0 : Date.now() + e.restante;
    duracao = Math.max(1, e.duracao || 1);
    // Em outra aba do navegador, o título avisa quando a fase muda.
    const avisoAba = { noite: '(!) Anoiteceu', dia: '(!) Amanheceu: hora de votar', cacador: '(!) O Caçador caiu', fim: '(!) Fim de jogo' }[e.fase];
    if (faseAntes !== e.fase && document.hidden && jogador && avisoAba) document.title = `${avisoAba} · Casa Luckham`;
    if (faseAntes !== e.fase && e.fase === 'noite') flechas = [];
    faseAntes = e.fase;
    trocar(corpo,
      faixa(e),
      e.fase === 'fim' && fimDeJogo(e),
      h('div', { class: 'cid-grade' },
        h('div', { class: 'cid-esquerda' }, e.eu && cartaMinha(e), listaDePapeis(e)),
        h('div', { class: 'cid-centro' }, areaVila, e.fase !== 'fim' && painelAcao(e), praca(e)),
        h('div', { class: 'cid-direita' }, painelChat, diario(e))),
      s.espectadores > 0 && h('p', { class: 'espectadores' }, icone('olho'), `${s.espectadores} ${s.espectadores === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}`));
    desenharChat();
    tique();
  }

  return {
    el, atualizar, mensagem,
    posicoes: m => mundo.receberPos(m),
    emote: m => mundo.receberEmote(m),
    parar: () => {
      clearInterval(relogioId);
      mundo.parar();
      document.removeEventListener('pointerdown', fecharFora);
    },
  };
}
