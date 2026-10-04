// Jogos juntos: várias pessoas no MESMO jogo, ao mesmo tempo, vendo umas às outras.
//
// Dois jeitos de rodar:
//  - No navegador (Travessia, Barris do Raposo, Super Coelho): o mundo é o mesmo para todos (mesma semente
//    e o mesmo relógio), cada um controla o próprio coelho no seu navegador e manda onde está; o servidor
//    repassa as posições, decide quem pegou cada item primeiro ("pegar") e cuida das vidas, da chegada,
//    das fases e de quem venceu.
//  - No servidor (Pac-Coelho e 2048): o servidor roda o jogo (src/junto-pac.js e src/junto-2048.js), recebe
//    os comandos de cada um e manda os quadros.
//
// Versus: cada um por si (quem chega primeiro, ou quem sobra vivo). Co-op: todos do mesmo lado, com vidas
// da equipe. Quanto mais gente, mais difícil (dif: 1 com uma pessoa, +0,15 por pessoa a mais).

class ErroJunto extends Error {}

const LARGADA_MS = Number(process.env.JUNTO_LARGADA_MS) || 3500;
const ENTRE_FASES_MS = Number(process.env.JUNTO_FASE_MS) || 3000;

// fim do versus: 'chegada' (quem chega primeiro vence) ou 'sobrevivente' (quem sobra vivo vence).
// regra do co-op: 'qualquer' (alguém chegou: a fase passa para todos) ou 'todos' (todos os vivos precisam chegar).
const JOGOS = {
  travessia: { nome: 'Travessia', max: 6, minutos: 8, versus: { vidas: 1, fim: 'sobrevivente' }, coop: { vidas: [2, 1], regra: 'todos', fases: 1 } },
  barris: { nome: 'Barris do Raposo', max: 4, minutos: 8, versus: { vidas: 3, fim: 'chegada' }, coop: { vidas: [2, 1], regra: 'qualquer', fases: 3 } },
  supercoelho: { nome: 'Super Coelho', max: 4, minutos: 15, fasesVersus: 4, versus: { vidas: 3, fim: 'chegada' }, coop: { vidas: [3, 1], regra: 'qualquer', fases: 4 } },
  pacman: { nome: 'Pac-Coelho', max: 4, minutos: 8, servidor: './junto-pac' },
  2048: { nome: '2048', max: 6, minutos: 5, servidor: './junto-2048' },
  // Corrida do Coelho (estilo o dinossauro do Chrome): cada navegador roda o mesmo caminho; no co-op todos
  // precisam cruzar a chegada (a distância cresce com a gente).
  corrida: { nome: 'Corrida do Coelho', max: 8, minutos: 6, versus: { vidas: 1, fim: 'sobrevivente' }, coop: { vidas: [2, 1], regra: 'todos', fases: 1 } },
  // Arena da Toca (estilo Clash Royale): cartas, cenouras de energia e torres. O servidor roda a partida;
  // sozinho (ou faltando gente) joga contra o Raposo.
  arena: { nome: 'Arena da Toca', max: 4, minimo: 1, minutos: 5, servidor: './junto-arena' },
  // Batalha da Toca (estilo Free Fire): todos caem na ilha, pegam armas e o último de pé vence. O servidor
  // roda a partida e completa com robôs.
  batalha: { nome: 'Batalha da Toca', max: 10, minimo: 1, minutos: 8, servidor: './junto-batalha' },
};
const MOTORES = {};
const motor = jogo => (JOGOS[jogo].servidor ? (MOTORES[jogo] ??= require(JOGOS[jogo].servidor)) : null);

function opcoes(o = {}) {
  const jogo = JOGOS[o.jogo] ? String(o.jogo) : 'travessia';
  const r = { jogo, modo: o.modo === 'coop' ? 'coop' : 'versus' };
  // Super Coelho no versus: a corrida é numa fase só (quem abriu a sala escolhe).
  if (jogo === 'supercoelho') r.fase = Math.max(0, Math.min(JOGOS.supercoelho.fasesVersus - 1, Math.floor(Number(o.fase) || 0)));
  return r;
}
const minimo = o => JOGOS[o.jogo].minimo ?? (o.modo === 'versus' ? 2 : 1);
const maximo = o => JOGOS[o.jogo].max;
const nomeDo = o => `${JOGOS[o.jogo].nome} (${o.modo === 'coop' ? 'co-op' : 'versus'})`;
const dificuldade = n => Math.round((1 + 0.15 * Math.max(0, n - 1)) * 100) / 100;

// visuais: o visual de cada um no Club Coelho ({ pelo: '#cor', roupa: {...} }), para o coelho no jogo.
function novo(o, n, visuais = [], agora = Date.now()) {
  const def = JOGOS[o.jogo];
  const inicio = agora + LARGADA_MS;
  const e = {
    jogo: o.jogo, modo: o.modo, semente: Math.floor(Math.random() * 2 ** 31), n, dif: dificuldade(n),
    inicio, limite: inicio + def.minutos * 60_000,
    fase: o.jogo === 'supercoelho' && o.modo === 'versus' ? o.fase : 0,
    fases: o.modo === 'coop' && def.coop ? def.coop.fases : 1,
    faseInicio: inicio,
    p: Array.from({ length: n }, () => ({ vidas: def.versus ? (o.modo === 'versus' ? def.versus.vidas : 0) : 0, fora: false, chegou: false, pontos: 0, saiu: false })),
    vidasEquipe: o.modo === 'coop' && def.coop ? def.coop.vidas[0] + def.coop.vidas[1] * n : null,
    visuais: Array.from({ length: n }, (_, i) => visuais[i] || null),
    pegos: new Set(),
    fim: null, vencedores: null, terminou: null,
  };
  const m = motor(o.jogo);
  if (m) e.sim = m.novo({ modo: o.modo, n, dif: e.dif, semente: e.semente });
  return e;
}

const vivos = e => e.p.map((p, i) => (!p.fora && !p.saiu ? i : -1)).filter(i => i >= 0);
const presentes = e => e.p.map((p, i) => (!p.saiu ? i : -1)).filter(i => i >= 0);
function maisPontos(e, lista) {
  if (!lista.length) return [];
  const max = Math.max(...lista.map(i => e.p[i].pontos));
  const melhores = lista.filter(i => e.p[i].pontos === max);
  return melhores.length === 1 ? melhores : [];
}

function acabar(e, motivo, vencedores, agora = Date.now()) {
  if (e.fim) return true;
  e.fim = motivo;
  e.vencedores = vencedores;
  e.terminou = agora;
  return true;
}

// Confere se a partida acabou (depois de cada mudança). Devolve true quando acabou.
function verificar(e, agora = Date.now()) {
  if (e.fim) return true;
  if (e.sim) {
    const r = motor(e.jogo).resultado(e.sim, presentes(e));
    if (r) return acabar(e, r.motivo, r.vencedores, agora);
    if (agora >= e.limite) return acabar(e, 'tempo', motor(e.jogo).resultado(e.sim, presentes(e), true)?.vencedores || [], agora);
    return false;
  }
  const def = JOGOS[e.jogo];
  const v = vivos(e);
  if (e.modo === 'coop') {
    if (!v.length) return acabar(e, 'perderam', [], agora);
    if (def.coop.regra === 'todos' && v.every(i => e.p[i].chegou)) return acabar(e, 'chegaram', presentes(e), agora);
  } else {
    const n = presentes(e).length;
    if (def.versus.fim === 'sobrevivente' && v.length <= 1 && e.n > 1) {
      return acabar(e, 'sobrou', v.length ? v : maisPontos(e, presentes(e)), agora);
    }
    if (!v.length) return acabar(e, 'todos-fora', maisPontos(e, presentes(e)), agora);
    if (n <= 1 && e.n > 1) return acabar(e, 'sozinho', presentes(e), agora); // os outros saíram
  }
  if (agora >= e.limite) {
    return acabar(e, 'tempo', e.modo === 'coop' ? [] : maisPontos(e, presentes(e)), agora);
  }
  return false;
}

// Um acontecimento mandado por quem está jogando. Devolve o que repassar:
// { todos: [ev...] } vai para todos (até quem mandou), { outros: ev } só para os outros; mudou = a sala muda.
function evento(e, i, ev = {}, agora = Date.now()) {
  if (e.fim) return null;
  if (agora < e.inicio - 500) throw new ErroJunto('Espere a largada.');
  const p = e.p[i];
  if (!p || p.saiu) return null;
  const tipo = String(ev.tipo || '');
  if (e.sim) {
    const r = motor(e.jogo).agir(e.sim, i, ev, agora);
    copiarPontos(e);
    return { mudou: !!r?.mudou, quadro: !!r };
  }
  const def = JOGOS[e.jogo];
  switch (tipo) {
    case 'pegar': {
      // Quem pegou primeiro leva (moeda, cenoura, marreta, poder...). A chave vale por fase.
      if (p.fora) return null;
      const chave = `${e.fase}:${String(ev.chave || '').slice(0, 40)}`;
      if (e.pegos.has(chave)) return null;
      e.pegos.add(chave);
      p.pontos += Math.max(0, Math.min(10_000, Math.floor(Number(ev.valor) || 0)));
      return { todos: [{ tipo: 'pegou', chave: ev.chave, i, valor: ev.valor ?? 0 }] };
    }
    case 'morri': {
      if (p.fora) return null;
      if (e.modo === 'coop') {
        if (e.vidasEquipe > 0) {
          e.vidasEquipe--;
          return { todos: [{ tipo: 'renasce', i }], mudou: true };
        }
        p.fora = true;
      } else {
        p.vidas--;
        if (p.vidas > 0) return { todos: [{ tipo: 'renasce', i }], mudou: true };
        p.fora = true;
      }
      return { todos: [{ tipo: 'fora', i }], mudou: true, conferir: true };
    }
    case 'cheguei': {
      if (p.fora || p.chegou) return null;
      if (e.modo === 'versus') {
        acabar(e, 'chegou', [i], agora);
        return { todos: [{ tipo: 'chegou', i }], mudou: true };
      }
      if (def.coop.regra === 'todos') {
        p.chegou = true;
        return { todos: [{ tipo: 'chegou', i }], mudou: true, conferir: true };
      }
      // Dois chegando quase juntos: só o primeiro passa a fase (o resto chega durante a troca e é ignorado).
      if (agora < e.faseInicio) return null;
      // Alguém chegou: a fase passa para todos (quem já está fora continua fora).
      e.fase++;
      if (e.fase >= e.fases) {
        acabar(e, 'chegaram', presentes(e), agora);
        return { todos: [{ tipo: 'chegou', i }], mudou: true };
      }
      e.faseInicio = agora + ENTRE_FASES_MS;
      return { todos: [{ tipo: 'fase', i, fase: e.fase }], mudou: true };
    }
    case 'pontos': {
      // Quanto já fez (distância, altura, Lírios): desempata e aparece no placar.
      p.pontos = Math.max(p.pontos, Math.max(0, Math.min(10_000_000, Math.floor(Number(ev.n) || 0))));
      return { outros: { tipo: 'pontos', i, n: p.pontos } };
    }
    default: {
      // Acontecimentos do próprio jogo (quebrou um barril, acordou um inimigo, bateu num bloco...): só repassa.
      const texto = JSON.stringify(ev);
      if (texto.length > 400 || !/^[a-z]{2,20}$/.test(tipo)) return null;
      return { outros: { ...ev, i } };
    }
  }
}

// Os jogos do servidor contam os pontos de cada um (para o placar e o resultado).
function copiarPontos(e) {
  const lista = motor(e.jogo).pontos?.(e.sim);
  if (lista) lista.forEach((v, k) => { if (e.p[k]) e.p[k].pontos = Math.floor(v) || 0; });
}

// Alguém saiu no meio: conta como fora (e o jogo do servidor tira o coelho dele).
function sair(e, i) {
  const p = e.p[i];
  if (!p) return;
  p.saiu = true;
  p.fora = true;
  if (e.sim) motor(e.jogo).sair(e.sim, i);
}

// Jogos do servidor: um passo do relógio (Pac-Coelho). Devolve true se precisa mandar um quadro.
const temPasso = e => !!(e.sim && motor(e.jogo).passo);
function passo(e, dt, agora = Date.now()) {
  if (!e.sim || e.fim || agora < e.inicio) return false;
  const mudou = motor(e.jogo).passo(e.sim, dt, agora) !== false;
  if (mudou) copiarPontos(e);
  return mudou;
}
const quadro = e => (e.sim ? motor(e.jogo).quadro(e.sim) : null);
// Jogos do servidor com um quadro para cada um (só o que está perto dele, ex.: Batalha da Toca). i = -1: quem assiste.
const temQuadroPara = e => !!(e.sim && motor(e.jogo).quadroPara);
const quadroPara = (e, i) => motor(e.jogo).quadroPara(e.sim, i);

// Os tempos vão como "daqui a quantos ms" (o relógio de cada navegador pode estar adiantado ou atrasado).
function visao(e, agora = Date.now()) {
  return {
    jogo: e.jogo, modo: e.modo, semente: e.semente, n: e.n, dif: e.dif,
    largadaEm: e.inicio - agora, faseEm: e.faseInicio - agora, acabaEm: e.limite - agora,
    fase: e.fase, fases: e.fases, vidasEquipe: e.vidasEquipe, visuais: e.visuais,
    p: e.p.map(({ vidas, fora, chegou, pontos, saiu }) => ({ vidas, fora, chegou, pontos, saiu })),
    fim: e.fim, vencedores: e.vencedores, quadro: e.sim ? motor(e.jogo).quadro(e.sim) : null,
  };
}

module.exports = {
  JOGOS, ErroJunto, LARGADA_MS, opcoes, minimo, maximo, nomeDo, dificuldade, novo, evento, verificar, sair, passo, temPasso, quadro, temQuadroPara, quadroPara, visao,
};
