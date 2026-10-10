// Menu de administrador na Arena da Toca e na Batalha da Toca (jogos juntos que rodam no servidor; veja
// src/adm-jogos.js). As regras de cada ação ficam nos motores (junto-arena.js e junto-batalha.js, em
// "admin"); aqui ficam a lista do menu, as conferências e o quadro novo para todos na hora.
//
// As pegadinhas que atrapalham (congelar, lento, invertido) valem dentro do próprio motor, que precisa saber
// o usuário de cada pessoa: ligar() põe a lista da sala na partida (sim.uids). Robôs e Raposos não são
// usuários e nunca são atrapalhados.

const { ErroAdm } = require('../adm-jogos');
const junto = require('../junto');
const arena = require('../junto-arena');
const batalha = require('../junto-batalha');

const CARTAS = arena._interno.CARTAS.map(c => [c.k, `${c.nome} (${c.custo})`]);
const FAIXAS = [[0, 'Esquerda'], [1, 'Direita'], [2, 'Meio']];
const TORRES = ['torre da esquerda', 'torre da direita', 'Toca do Rei'];
const RITMOS = [[0.5, 'Metade da velocidade'], [1, 'Normal'], [1.5, '1,5 vez mais rápido'], [2, '2 vezes mais rápido'], [3, '3 vezes mais rápido']];
const ITENS = [['tudo', 'Tudo (mochila, munição, curas e granadas)'], ['municao', 'Munição cheia'], ['curas', 'Bandagens e poções de escudo'], ['granadas', 'Granadas de cenoura'], ['mochila', 'Mochila']];
const NOME_ITENS = { tudo: 'mochila, munição, curas e granadas', municao: 'munição cheia', curas: 'bandagens e poções de escudo', granadas: 'granadas de cenoura', mochila: 'a mochila' };

const simDa = s => s.estado?.sim || null;

// Quem é cada assento: os usuários da sala, na ordem (o assento i é s.jogadores[i]).
function ligar(s) {
  const sim = simDa(s);
  if (!sim) return null;
  const m = s.estado.jogo === 'arena' ? arena : batalha;
  m.admin.donos(sim, s.jogadores.map(p => p.id));
  return sim;
}

const numero = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};
const inteiro = (v, min, max, padrao) => Math.round(numero(v, min, max, padrao));

// O jogador escolhido no menu (índice em s.jogadores), ainda na partida.
function pessoa(s, dados) {
  const i = Number(dados.alvo);
  if (!Number.isInteger(i) || !s.jogadores[i]) throw new ErroAdm('Escolha um jogador.');
  if (s.jogadores[i].saiu || s.estado.p?.[i]?.saiu) throw new ErroAdm(`${s.jogadores[i].nome} saiu da partida.`);
  return i;
}

// Mudou a partida: confere se acabou (e termina) ou manda o quadro novo para todos na hora.
function depois(s, ctx) {
  if (junto.verificar(s.estado)) ctx.terminarJunto(s);
  else ctx.enviarQuadroJunto(s);
}

/* ─── Arena da Toca ─── */

// Quem joga em cada lado (as pessoas pelo nome; os Raposos como "Raposo").
function nomeDoLado(s, sim, lado) {
  const nomes = [];
  sim.assentos.forEach((a, k) => {
    if (a.lado !== lado) return;
    const n = a.i >= 0 && !a.saiu ? s.jogadores[k]?.nome : 'Raposo';
    if (n && !nomes.includes(n)) nomes.push(n);
  });
  return `${lado === 0 ? 'Lado de baixo' : 'Lado de cima'} (${nomes.join(' e ') || 'ninguém'})`;
}

function acoesArena(s, sim) {
  const lados = [0, 1].map(l => [l, nomeDoLado(s, sim, l)]);
  const torres = [];
  sim.torres.forEach((t, idx) => {
    if (t.tipo !== 'rei' && arena._interno.vivo(t)) torres.push([idx, `${lados[t.lado][1]}: ${TORRES[idx % 3]}`]);
  });
  const raposos = sim.assentos.filter(a => a.raposo);
  const resta = Math.max(0, Math.ceil(arena.admin.restanteNormal(sim)));
  const lista = [
    { id: 'encher', nome: 'Encher as cenouras de energia', grupo: 'Ajudar', alvo: 'jogador' },
    { id: 'infinita', nome: 'Energia infinita', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'As cenouras ficam sempre cheias.', campos: [{ id: 'segundos', nome: 'Segundos', tipo: 'numero', min: 3, max: 120, padrao: 20 }] },
    { id: 'consertar', nome: 'Curar e reconstruir as torres', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'As torres do lado dele voltam inteiras (torre caída volta e a coroa é devolvida).' },
    {
      id: 'carta', nome: 'Soltar uma carta de graça', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Tropa: do lado dele, perto do rio. Feitiço: na torre do outro lado.',
      campos: [{ id: 'carta', nome: 'Carta', tipo: 'escolha', padrao: 'urso', opcoes: CARTAS }, { id: 'faixa', nome: 'Onde', tipo: 'escolha', padrao: 0, opcoes: FAIXAS }],
    },
  ];
  if (torres.length) lista.push({ id: 'torre', nome: 'Destruir uma torre', grupo: 'Mexer na partida', ajuda: 'Vale uma coroa para o outro lado.', campos: [{ id: 'torre', nome: 'Torre', tipo: 'escolha', padrao: torres[0][0], opcoes: torres }] });
  lista.push(
    { id: 'rei', nome: 'Derrubar a Toca do Rei', grupo: 'Mexer na partida', perigo: true, ajuda: 'Cai o castelo do outro lado: quem você escolher vence com 3 coroas.', campos: [{ id: 'lado', nome: 'Quem vence', tipo: 'escolha', padrao: 0, opcoes: lados }] },
    { id: 'velocidade', nome: 'Velocidade da partida', grupo: 'Mexer na partida', ajuda: `Agora: ${(RITMOS.find(r => r[0] === (sim.ritmo || 1)) || [0, `${sim.ritmo}x`])[1]}.`, campos: [{ id: 'ritmo', nome: 'Velocidade', tipo: 'escolha', padrao: sim.ritmo || 1, opcoes: RITMOS }] },
    { id: 'tempo', nome: 'Mudar o tempo', grupo: 'Mexer na partida', ajuda: `Faltam ${resta} s${sim.prorrogacao ? ' de prorrogação' : ''}. Número negativo tira tempo.`, campos: [{ id: 'segundos', nome: 'Segundos (a mais ou a menos)', tipo: 'numero', min: -300, max: 600, padrao: 60 }] },
  );
  if (raposos.some(a => !a.parado)) lista.push({ id: 'tirarRaposo', nome: 'Tirar o Raposo', grupo: 'Mexer na partida', ajuda: 'O Raposo para de jogar cartas (as torres dele continuam lá).' });
  if (raposos.some(a => a.parado)) lista.push({ id: 'voltarRaposo', nome: 'O Raposo volta a jogar', grupo: 'Mexer na partida' });
  if (sim.assentos.length < 8) lista.push({ id: 'colocarRaposo', nome: 'Colocar mais um Raposo', grupo: 'Mexer na partida', ajuda: 'Um Raposo a mais joga cartas pelo lado escolhido.', campos: [{ id: 'lado', nome: 'Lado', tipo: 'escolha', padrao: 1, opcoes: lados }] });
  lista.push(
    { id: 'vencedor', nome: 'Terminar escolhendo o vencedor', grupo: 'Mexer na partida', perigo: true, ajuda: 'A partida acaba agora.', campos: [{ id: 'lado', nome: 'Quem vence', tipo: 'escolha', padrao: 0, opcoes: [...lados, [-1, 'Empate']] }] },
    { id: 'zerar', nome: 'Zerar as cenouras de energia', grupo: 'Atrapalhar', alvo: 'jogador' },
  );
  return lista;
}

// A sala tem um tempo máximo (junto.js); se a partida ficou mais longa (tempo a mais ou mais devagar), estica.
function esticar(s, ctx) {
  const e = s.estado;
  const sim = e.sim;
  const agora = Date.now();
  const precisa = Math.max(agora, e.inicio) + (arena.admin.restante(sim) / (sim.ritmo || 1)) * 1000 + 5000;
  if (precisa > e.limite) {
    e.limite = precisa;
    ctx.agendarJunto(s);
  }
}

function executarArena(s, sim, acao, dados, ctx) {
  const A = arena.admin;
  const assento = () => {
    const i = pessoa(s, dados);
    if (!sim.assentos[i] || sim.assentos[i].saiu) throw new ErroAdm('Essa pessoa saiu: o Raposo joga no lugar dela.');
    return i;
  };
  const nome = i => s.jogadores[i].nome;
  let texto;
  switch (acao) {
    case 'encher': { const i = assento(); A.encher(sim, i); texto = `${nome(i)} ficou com as cenouras de energia cheias.`; break; }
    case 'zerar': { const i = assento(); A.zerar(sim, i); texto = `${nome(i)} ficou sem cenouras de energia.`; break; }
    case 'infinita': {
      const i = assento();
      const seg = inteiro(dados.segundos, 3, 120, 20);
      A.infinita(sim, i, seg);
      texto = `${nome(i)} tem energia infinita por ${seg} s.`;
      break;
    }
    case 'consertar': {
      const i = assento();
      const { curadas, levantadas } = A.consertar(sim, sim.assentos[i].lado);
      if (!curadas && !levantadas) throw new ErroAdm(`As torres do lado de ${nome(i)} já estão inteiras.`);
      texto = `Torres do lado de ${nome(i)}: ${levantadas ? `${levantadas} reconstruída${levantadas > 1 ? 's' : ''}` : ''}${levantadas && curadas ? ' e ' : ''}${curadas ? `${curadas} curada${curadas > 1 ? 's' : ''}` : ''}.`;
      break;
    }
    case 'carta': {
      const i = assento();
      const carta = arena._interno.CARTA[String(dados.carta)];
      if (!carta) throw new ErroAdm('Escolha uma carta.');
      const faixa = inteiro(dados.faixa, 0, 2, 0);
      A.soltar(sim, i, carta.k, faixa);
      texto = `${carta.nome} de graça para ${nome(i)} (${FAIXAS[faixa][1].toLowerCase()}).`;
      break;
    }
    case 'torre': {
      const idx = Number(dados.torre);
      const t = sim.torres[idx];
      if (!t || t.tipo === 'rei' || !A.derrubar(sim, idx)) throw new ErroAdm('Essa torre já caiu.');
      texto = `Caiu a ${TORRES[idx % 3]} do ${nomeDoLado(s, sim, t.lado).replace(/^Lado/, 'lado')}.`;
      break;
    }
    case 'rei': {
      const lado = inteiro(dados.lado, 0, 1, 0);
      A.derrubar(sim, (1 - lado) * 3 + 2);
      texto = `A Toca do Rei caiu: vence o ${nomeDoLado(s, sim, lado).replace(/^Lado/, 'lado')}.`;
      break;
    }
    case 'velocidade': {
      const r = numero(dados.ritmo, 0.5, 3, 1);
      A.ritmo(sim, r);
      esticar(s, ctx);
      texto = r === 1 ? 'A partida voltou à velocidade normal.' : `A partida agora anda ${r < 1 ? 'na metade da velocidade' : `${String(r).replace('.', ',')} vezes mais rápido`}.`;
      break;
    }
    case 'tempo': {
      const seg = inteiro(dados.segundos, -300, 600, 60);
      if (!seg) throw new ErroAdm('Diga quantos segundos.');
      A.tempo(sim, seg);
      esticar(s, ctx);
      texto = seg > 0 ? `Mais ${seg} s de partida.` : `Menos ${-seg} s de partida.`;
      break;
    }
    case 'tirarRaposo': { const n = A.pararRaposos(sim, true); texto = n > 1 ? `Os ${n} Raposos pararam de jogar.` : 'O Raposo parou de jogar.'; break; }
    case 'voltarRaposo': { const n = A.pararRaposos(sim, false); texto = n > 1 ? `Os ${n} Raposos voltaram a jogar.` : 'O Raposo voltou a jogar.'; break; }
    case 'colocarRaposo': {
      const lado = inteiro(dados.lado, 0, 1, 1);
      if (!A.novoRaposo(sim, lado)) throw new ErroAdm('Não cabe mais nenhum Raposo.');
      texto = `Mais um Raposo no ${lado === 0 ? 'lado de baixo' : 'lado de cima'}.`;
      break;
    }
    case 'vencedor': {
      const lado = inteiro(dados.lado, -1, 1, 0);
      A.vencer(sim, lado);
      texto = lado < 0 ? 'A partida acabou empatada.' : `A partida acabou: vence o ${nomeDoLado(s, sim, lado).replace(/^Lado/, 'lado')}.`;
      break;
    }
    default: throw new ErroAdm('Ação desconhecida.');
  }
  depois(s, ctx);
  return texto;
}

/* ─── Batalha da Toca ─── */

function acoesBatalha(s, sim) {
  const B = batalha.admin;
  const z = B.zona(sim);
  const pessoas = s.jogadores.map((p, i) => [i, p.nome]).filter(([i]) => !s.jogadores[i].saiu && B.estado(sim, i) !== 'saiu');
  const lista = [
    { id: 'vida', nome: 'Vida cheia', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Quem já caiu volta para a ilha, no meio da área segura.' },
    { id: 'escudo', nome: 'Escudo cheio', grupo: 'Ajudar', alvo: 'jogador' },
    { id: 'invencivel', nome: 'Invencível', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Nada machuca (nem a área).', campos: [{ id: 'segundos', nome: 'Segundos', tipo: 'numero', min: 3, max: 120, padrao: 15 }] },
    {
      id: 'arma', nome: 'Dar uma arma', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Com o pente e a munição cheios. Mãos cheias: troca a da mão.',
      campos: [{ id: 'arma', nome: 'Arma', tipo: 'escolha', padrao: 3, opcoes: B.ARMAS.map((n, k) => [k, n]) }, { id: 'raridade', nome: 'Raridade', tipo: 'escolha', padrao: 4, opcoes: B.RARIDADES.map((n, k) => [k, n]) }],
    },
    { id: 'itens', nome: 'Dar itens', grupo: 'Ajudar', alvo: 'jogador', campos: [{ id: 'qual', nome: 'O quê', tipo: 'escolha', padrao: 'tudo', opcoes: ITENS }] },
    { id: 'teleporte', nome: 'Teletransportar', grupo: 'Ajudar', alvo: 'jogador', campos: [{ id: 'destino', nome: 'Para onde', tipo: 'escolha', padrao: 'centro', opcoes: [['centro', 'Centro da área segura'], ['longe', 'Longe de todo mundo']] }] },
  ];
  const fase = `Fase ${z.fase + 1} de 6${z.modo === 'fecha' ? ', fechando' : z.modo === 'fim' ? ', fechada de vez' : ''}${z.parada ? ', parada' : ''}.`;
  if (z.modo !== 'fim') lista.push({ id: 'zonaFechar', nome: 'Fechar a área segura agora', grupo: 'Mexer na partida', ajuda: `${fase} Vai direto para o círculo seguinte.` });
  lista.push({ id: 'zonaRitmo', nome: 'Velocidade da área segura', grupo: 'Mexer na partida', ajuda: fase, campos: [{ id: 'ritmo', nome: 'Velocidade', tipo: 'escolha', padrao: z.ritmo, opcoes: [[0.5, 'Metade'], [1, 'Normal'], [2, '2 vezes mais rápido'], [4, '4 vezes mais rápido']] }] });
  lista.push(z.parada
    ? { id: 'zonaVoltar', nome: 'A área segura volta a fechar', grupo: 'Mexer na partida' }
    : { id: 'zonaParar', nome: 'Parar a área segura', grupo: 'Mexer na partida', ajuda: 'O círculo fica parado (quem está fora continua perdendo vida).' });
  const robos = B.robos(sim);
  if (robos) lista.push({ id: 'tirarRobos', nome: 'Tirar os robôs', grupo: 'Mexer na partida', perigo: true, ajuda: `${robos} Raposo${robos > 1 ? 's' : ''} na ilha. Sem eles, se sobrar uma pessoa, ela vence.` });
  if (B.total(sim) < 24) lista.push({ id: 'colocarRobos', nome: 'Colocar mais robôs', grupo: 'Mexer na partida', ajuda: 'Caem do céu dentro da área segura.', campos: [{ id: 'quantos', nome: 'Quantos', tipo: 'numero', min: 1, max: 24 - B.total(sim), padrao: Math.min(4, 24 - B.total(sim)) }] });
  lista.push(
    { id: 'vencedor', nome: 'Terminar escolhendo o vencedor', grupo: 'Mexer na partida', perigo: true, ajuda: 'A partida acaba agora.', campos: [{ id: 'quem', nome: 'Quem vence', tipo: 'escolha', padrao: pessoas[0]?.[0] ?? -1, opcoes: [...pessoas, [-1, 'Ninguém (os Raposos)']] }] },
    { id: 'desarmar', nome: 'Tirar as armas', grupo: 'Atrapalhar', alvo: 'jogador', ajuda: 'As armas caem no chão, perto dele.' },
  );
  return lista;
}

function executarBatalha(s, sim, acao, dados, ctx) {
  const B = batalha.admin;
  const nome = i => s.jogadores[i].nome;
  // Alguém ainda na ilha (no balão, caindo ou de pé).
  const naIlha = () => {
    const i = pessoa(s, dados);
    const est = B.estado(sim, i);
    if (est === 'fora') throw new ErroAdm(`${nome(i)} já caiu (use Vida cheia para trazer de volta).`);
    if (est === 'saiu') throw new ErroAdm(`${nome(i)} saiu da partida.`);
    return i;
  };
  let texto;
  switch (acao) {
    case 'vida': {
      const i = pessoa(s, dados);
      const r = B.vida(sim, i);
      if (!r) throw new ErroAdm(`${nome(i)} saiu da partida.`);
      texto = r === 'reviveu' ? `${nome(i)} voltou para a ilha com a vida cheia.` : `${nome(i)} está com a vida cheia.`;
      break;
    }
    case 'escudo': { const i = naIlha(); B.escudo(sim, i); texto = `${nome(i)} está com o escudo cheio.`; break; }
    case 'invencivel': {
      const i = naIlha();
      const seg = inteiro(dados.segundos, 3, 120, 15);
      B.invencivel(sim, i, seg);
      texto = `${nome(i)} está invencível por ${seg} s.`;
      break;
    }
    case 'arma': {
      const i = naIlha();
      const t = inteiro(dados.arma, 0, B.ARMAS.length - 1, 3);
      const r = inteiro(dados.raridade, 0, B.RARIDADES.length - 1, 4);
      B.arma(sim, i, t, r);
      texto = `${nome(i)} ganhou: ${B.ARMAS[t]} (${B.RARIDADES[r]}), com munição.`;
      break;
    }
    case 'itens': {
      const i = naIlha();
      const qual = NOME_ITENS[dados.qual] ? dados.qual : 'tudo';
      B.itens(sim, i, qual);
      texto = `${nome(i)} ganhou ${NOME_ITENS[qual]}.`;
      break;
    }
    case 'teleporte': {
      const i = naIlha();
      const destino = dados.destino === 'longe' ? 'longe' : 'centro';
      B.teleportar(sim, i, destino);
      texto = `${nome(i)} foi para ${destino === 'longe' ? 'longe de todo mundo' : 'o centro da área segura'}.`;
      break;
    }
    case 'desarmar': {
      const i = naIlha();
      const n = B.desarmar(sim, i);
      if (!n) throw new ErroAdm(`${nome(i)} já está sem armas.`);
      texto = `${nome(i)} ficou sem armas (${n === 1 ? 'a arma caiu' : 'as armas caíram'} no chão).`;
      break;
    }
    case 'zonaFechar':
      if (!B.fecharZona(sim)) throw new ErroAdm('A área segura já fechou de vez.');
      texto = `A área segura fechou na hora (agora na fase ${B.zona(sim).fase + 1}).`;
      break;
    case 'zonaRitmo': {
      const r = numero(dados.ritmo, 0.5, 4, 1);
      B.ritmoZona(sim, r);
      texto = r === 1 ? 'A área segura voltou ao ritmo normal.' : `A área segura agora anda ${r < 1 ? 'na metade do ritmo' : `${r} vezes mais rápido`}.`;
      break;
    }
    case 'zonaParar': B.pararZona(sim, true); texto = 'A área segura parou.'; break;
    case 'zonaVoltar': B.pararZona(sim, false); texto = 'A área segura voltou a fechar.'; break;
    case 'tirarRobos': { const n = B.tirarRobos(sim); texto = `${n} robô${n === 1 ? '' : 's'} fora da ilha.`; break; }
    case 'colocarRobos': {
      const n = B.colocarRobos(sim, inteiro(dados.quantos, 1, 24, 4));
      if (!n) throw new ErroAdm('A ilha já está cheia.');
      texto = `${n} robô${n === 1 ? '' : 's'} a mais caindo na ilha.`;
      break;
    }
    case 'vencedor': {
      const quem = Number(dados.quem);
      const i = Number.isInteger(quem) && s.jogadores[quem] && !s.jogadores[quem].saiu ? quem : -1;
      B.vencer(sim, i);
      texto = i < 0 ? 'A partida acabou sem vencedor.' : sim.modo === 'coop' ? `A partida acabou: a equipe de ${nome(i)} vence.` : `A partida acabou: ${nome(i)} vence.`;
      break;
    }
    default: throw new ErroAdm('Ação desconhecida.');
  }
  depois(s, ctx);
  return texto;
}

module.exports = {
  jogos: ['junto:arena', 'junto:batalha'],
  acoes(s) {
    const sim = ligar(s);
    if (!sim || sim.fim || s.estado.fim) return [];
    return s.estado.jogo === 'arena' ? acoesArena(s, sim) : acoesBatalha(s, sim);
  },
  async executar(s, acao, dados, ctx) {
    const sim = ligar(s);
    if (!sim || sim.fim || s.estado.fim) throw new ErroAdm('A partida já acabou.');
    return s.estado.jogo === 'arena' ? executarArena(s, sim, acao, dados, ctx) : executarBatalha(s, sim, acao, dados, ctx);
  },
  ligar, // para quem quiser ligar as pegadinhas na hora em que a partida começa
};
