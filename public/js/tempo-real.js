// Conexão ao vivo da Recreação (chat, quem está online e partidas).
// Uma única conexão para o site todo: ela continua aberta enquanto a pessoa navega,
// para avisar quando alguém entra na partida dela ou manda mensagem no chat.

import { estado, get, h, icone, aviso } from './core.js';

export const rt = {
  conectado: false,
  eu: null,
  online: [],
  historico: [],
  salas: [],        // partidas abertas (resumo para o salão)
  partidas: new Map(), // id -> visão completa das partidas que eu jogo ou assisto
  minhaSala: null,
  naoLidas: 0,
  lendoChat: false,
  transmissoes: [], // quem está jogando Pac-Coelho, Cobrinha ou Quebra-cabeça agora (dá para assistir)
  plateia: 0,       // quantas pessoas me assistem jogar
  silenciadoAte: 0, // anti-spam: até quando não posso falar no chat (horário em ms)
};

const ouvintes = new Map();
export function ouvir(tipo, fn) {
  if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
  ouvintes.get(tipo).add(fn);
  return () => ouvintes.get(tipo)?.delete(fn);
}
function emitir(tipo, dados) {
  for (const fn of [...(ouvintes.get(tipo) || [])]) {
    try { fn(dados); } catch (e) { console.error(e); }
  }
}

let ws = null;
let ligado = false;
let tentativas = 0;
let relogio = null;
let criando = false;
let indoPara = null;

export function ligar() {
  if (ligado) return;
  ligado = true;
  abrir();
}

export function desligar() {
  ligado = false;
  clearTimeout(relogio);
  const velho = ws;
  ws = null;
  velho?.close(1000);
  Object.assign(rt, { conectado: false, eu: null, online: [], historico: [], salas: [], minhaSala: null, naoLidas: 0, transmissoes: [], plateia: 0 });
  rt.partidas.clear();
  document.getElementById('partida-ativa')?.remove();
  emitir('estado');
  emitir('naoLidas');
}

function abrir() {
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
  const conexao = new WebSocket(`${protocolo}://${location.host}/ws`);
  ws = conexao;
  conexao.onmessage = e => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    tratar(m);
    emitir(m.tipo, m);
  };
  conexao.onclose = () => {
    if (ws !== conexao) return; // conexão antiga, já substituída
    ws = null;
    const estava = rt.conectado;
    rt.conectado = false;
    emitir('estado');
    if (!ligado) return;
    // Volta a tentar com calma crescente: 1s, 2s, 4s... até 20s.
    const atraso = estava ? 800 : Math.min(20_000, 1000 * 2 ** tentativas++);
    relogio = setTimeout(reconectar, atraso);
  };
}

async function reconectar() {
  if (!ligado) return;
  // Se a sessão acabou, a API avisa (e o site volta para o login) em vez de ficar tentando para sempre.
  try { await get('/api/pendencias'); } catch (e) {
    if (e.status === 401 || !estado.eu) return;
  }
  if (ligado && !ws) abrir();
}

export function enviar(tipo, dados = {}, { silencioso = false } = {}) {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ tipo, dados }));
    return true;
  }
  if (!silencioso) aviso('Sem conexão com a recreação agora. Tentando reconectar...', 'erro');
  return false;
}

// Enquanto o chat está na tela, as mensagens novas não contam como "não lidas".
export function lendoChat(sim) {
  rt.lendoChat = sim;
  if (sim && rt.naoLidas) {
    rt.naoLidas = 0;
    emitir('naoLidas');
  }
}

export function criarPartida(jogo, opcoes) {
  criando = enviar('sala:criar', { jogo, opcoes });
}
export function entrarNaPartida(id) {
  if (enviar('sala:entrar', { id })) indoPara = id;
}

const rotaDaSala = id => `#/recreacao/sala/${id}`;
const estouNaSala = id => location.hash === rotaDaSala(id);

function tratar(m) {
  // Mensagens que chegam várias vezes por segundo: só a tela do jogo cuida delas (via emitir).
  if (m.tipo === 'cobras:quadro' || m.tipo === 'pong') return;
  switch (m.tipo) {
    case 'ola':
      tentativas = 0;
      Object.assign(rt, { conectado: true, eu: m.eu, online: m.online, historico: m.historico, salas: m.salas, minhaSala: m.minhaSala, transmissoes: m.transmissoes || [], silenciadoAte: m.eu?.silenciadoAte || 0 });
      emitir('estado');
      break;
    case 'online':
      rt.online = m.online;
      break;
    case 'salas':
      rt.salas = m.salas;
      break;
    case 'chat:msg':
      rt.historico.push(m.msg);
      if (rt.historico.length > 200) rt.historico.splice(0, rt.historico.length - 200);
      if (!rt.lendoChat && m.msg.usuario_id !== rt.eu?.id) {
        rt.naoLidas++;
        emitir('naoLidas');
      }
      break;
    case 'chat:apagada':
      rt.historico = rt.historico.filter(x => x.id !== m.id);
      break;
    case 'chat:recusada':
      if (m.ate) rt.silenciadoAte = m.ate;
      break;
    case 'sala': {
      const s = m.sala;
      const antes = rt.partidas.get(s.id);
      rt.partidas.set(s.id, s);
      if (s.eu >= 0 && s.status !== 'fim' && !s.jogadores[s.eu].saiu) rt.minhaSala = s.id;
      else if (rt.minhaSala === s.id) rt.minhaSala = null;
      if (s.eu >= 0 && (criando || indoPara === s.id)) {
        criando = false;
        indoPara = null;
        if (!estouNaSala(s.id)) location.hash = rotaDaSala(s.id);
      } else if (antes && s.eu >= 0 && !estouNaSala(s.id)) {
        avisarMudanca(antes, s);
      }
      break;
    }
    case 'sala:fechada': {
      const antes = rt.partidas.get(m.id);
      rt.partidas.delete(m.id);
      if (rt.minhaSala === m.id) rt.minhaSala = null;
      if (m.motivo === 'dono') aviso(`Quem abriu a sala de ${antes?.nomeJogo || 'jogo'} desistiu, e ela foi fechada.`, 'erro');
      break;
    }
    case 'aviso':
      if (m.de !== rt.eu?.id && !location.hash.startsWith('#/recreacao')) chamar(m.texto, 'Ver', '#/recreacao', 9000);
      break;
    case 'transmissoes':
      rt.transmissoes = m.transmissoes;
      break;
    case 'solo:plateia':
      rt.plateia = m.espectadores;
      break;
    case 'progresso':
      m.notas.slice(0, 4).forEach(mostrarNota);
      break;
    case 'erro':
      if (criando || indoPara) { criando = false; indoPara = null; }
      aviso(m.mensagem, 'erro');
      break;
  }
  atualizarBarra();
}

// Algo mudou numa partida minha enquanto eu estava em outra tela.
function avisarMudanca(antes, s) {
  const comecou = antes.status === 'esperando' && s.status === 'jogando';
  if (!s.grupo) {
    if (s.eu === 0 && comecou) chamar(`${s.jogadores[1].nome} entrou na sua partida de ${s.nomeJogo}!`, 'Jogar agora', rotaDaSala(s.id), 20_000);
    return;
  }
  if (comecou) chamar(s.jogo === 'quiz' ? `O ${s.nomeJogo} começou!` : `A partida de ${s.nomeJogo} começou!`, s.jogo === 'quiz' ? 'Ir para o quiz' : 'Ir para a partida', rotaDaSala(s.id), 20_000);
  else if (s.status === 'esperando' && s.dono === rt.eu?.id && s.jogadores.length > antes.jogadores.length) {
    chamar(`${s.jogadores[s.jogadores.length - 1].nome} entrou na sua sala do ${s.nomeJogo} (${s.jogadores.length} de ${s.max}).`, 'Ver a sala', rotaDaSala(s.id), 12_000);
  }
}

// Aviso com botão (ex.: "Fulano entrou na sua partida"). Fica mais tempo que um aviso comum.
function chamar(texto, rotulo, href, duracao, ic = 'jogos', classe = '') {
  const el = h('div', { class: `toast chamada ${classe}`.trim(), role: 'status' },
    icone(ic),
    h('div', { class: 'chamada-texto' },
      h('span', null, texto),
      h('a', { class: 'btn btn-ouro btn-pequeno', href, onclick: () => el.remove() }, rotulo)),
    h('button', { class: 'chamada-fechar', type: 'button', 'aria-label': 'Fechar', onclick: () => el.remove() }, icone('x')));
  document.getElementById('toasts').append(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, duracao);
}

// Conquista, missão cumprida, nível novo ou recado: aparece na hora, em qualquer tela.
function mostrarNota(n) {
  const meuPerfil = `#/pessoa/${rt.eu?.id || estado.eu?.id}`;
  if (n.tipo === 'conquista') chamar(`Conquista desbloqueada: ${n.nome}! ${n.desc}`, 'Ver no perfil', meuPerfil, 9000, n.icone || 'trofeu', 'chamada-ouro');
  else if (n.tipo === 'missao') chamar(`Missão do dia cumprida: ${n.texto}. +${n.xp} XP`, 'Ver missões', '#/', 7000, 'check', 'chamada-verde');
  else if (n.tipo === 'nivel') chamar(`Você subiu para o nível ${n.nivel}: ${n.titulo}!${n.moldura ? ` Moldura ${n.moldura} liberada.` : ''}`, 'Personalizar', '#/perfil', 10000, 'estrela', 'chamada-ouro');
  else if (n.tipo === 'recado') chamar(`${n.de} deixou um recado no seu perfil: "${n.texto.length > 80 ? `${n.texto.slice(0, 80)}…` : n.texto}"`, 'Ver recado', meuPerfil, 10000, 'chat');
  emitir('nota', n);
}

/* ─── Transmitir os jogos de uma pessoa só ─── */

let ultimoQuadro = 0;
// Avisa que estou jogando (aparece para todos em "Jogando agora").
export function transmitir(jogo, info = {}) {
  ultimoQuadro = 0;
  enviar('solo:inicio', { jogo, info }, { silencioso: true });
}
// Manda o estado do jogo; no máximo uns 15 por segundo (ou sempre, com urgente).
export function enviarQuadro(q, urgente = false) {
  if (!rt.conectado) return;
  const agora = performance.now();
  if (!urgente && agora - ultimoQuadro < 66) return;
  if (agora - ultimoQuadro < 42) return;
  ultimoQuadro = agora;
  enviar('solo:quadro', { q }, { silencioso: true });
}
export function pararTransmissao() {
  rt.plateia = 0;
  enviar('solo:fim', {}, { silencioso: true });
}

// Faixa "você tem uma partida em andamento" quando a pessoa sai da tela do jogo sem sair da partida.
export function atualizarBarra() {
  const s = rt.minhaSala && rt.partidas.get(rt.minhaSala);
  const jogandoDesafio = s?.jogo === 'desafio' && location.hash.startsWith('#/recreacao/') && !location.hash.startsWith('#/recreacao/sala');
  const mostrar = s && (s.status === 'jogando' || (s.grupo && s.status === 'esperando')) && !estouNaSala(s.id) && !!estado.eu && !jogandoDesafio;
  let barra = document.getElementById('partida-ativa');
  if (!mostrar) { barra?.remove(); return; }
  let minhaVez;
  let texto;
  if (s.grupo) {
    minhaVez = s.jogo === 'quiz' && s.status === 'jogando' && s.estado?.fase === 'pergunta' && s.estado.minha == null;
    if (s.status === 'esperando') texto = `Sala de ${s.nomeJogo} (${s.jogadores.length} de ${s.max}) esperando começar`;
    else if (s.jogo === 'quiz') texto = `${s.nomeJogo}: pergunta ${s.estado?.numero} de ${s.estado?.total}${minhaVez ? ' · responda!' : ''}`;
    else if (s.jogo === 'cidade') {
      // Lyendell Dorme: avisa quando tem algo a fazer (votar de dia, usar o poder à noite, o tiro do Caçador).
      const e = s.estado;
      minhaVez = !!e?.eu?.acoes?.length && (e.fase === 'noite' ? e.eu.pronto === false : e.fase === 'dia' ? e.eu.acoes[0]?.escolhido == null : e.fase === 'cacador');
      texto = `${s.nomeJogo}: ${e?.fase === 'noite' ? `noite ${e.dia}` : e?.fase === 'dia' ? `dia ${e.dia}, hora de votar` : 'a partida está rolando'}${minhaVez ? ' · é a sua vez!' : ''}`;
    }
    else texto = `${s.nomeJogo}: sua partida está rolando!`;
  } else {
    const outro = s.jogadores[1 - s.eu];
    if (s.raposa) {
      minhaVez = s.raposa.vezDe === rt.eu?.id;
      texto = `${s.nomeJogo} contra a Raposa${minhaVez ? ' · sua vez!' : ''}`;
    } else {
      minhaVez = ['velha', 'lig4', 'damas'].includes(s.jogo) ? s.estado?.vez === s.eu : !s.estado?.minha;
      texto = `Partida de ${s.nomeJogo} contra ${outro?.nome || '...'}${minhaVez ? ' · sua vez!' : ''}`;
    }
  }
  if (!barra) {
    barra = h('a', { id: 'partida-ativa', class: 'partida-ativa' });
    document.body.append(barra);
  }
  barra.href = rotaDaSala(s.id);
  barra.classList.toggle('minha-vez', minhaVez);
  barra.replaceChildren(icone('jogos'), h('span', null, texto), h('strong', null, 'Voltar'));
}
window.addEventListener('hashchange', atualizarBarra);
