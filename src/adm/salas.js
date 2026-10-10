// Menu de administrador nas partidas ao vivo de recreacao.js (veja src/adm-jogos.js):
//  - Jogo da Velha, Pedra Papel e Tesoura, Lig 4 e Damas (um contra o outro ou contra a Raposa);
//  - Quiz de Lyendell;
//  - Cobrinha ao vivo;
//  - as mesas compartilhadas: Campo Minado, Quebra-cabeça e Jogo da Memória (co-op e versus).
// acoes(s) diz o que dá para fazer agora em cada sala; executar(s, acao, dados, ctx) faz e devolve uma frase.
// O núcleo já marcou a partida (não vale para o ranking) antes de chamar executar.

const adm = require('../adm-jogos');
const cobras = require('../cobras');
const damas = require('../damas');
const { MESAS } = require('../mesa');

const { ErroAdm } = adm;
const COBRAS_PASSO_MS = Number(process.env.COBRAS_PASSO_MS) || 125; // o mesmo de recreacao.js

const POR_VEZ = new Set(['velha', 'lig4', 'damas']);
const MESA = new Set(['minado', 'quebra', 'memoria']);
const MAOS = ['pedra', 'papel', 'tesoura'];
const VENCE = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };
const NOME_MAO = { pedra: 'pedra', papel: 'papel', tesoura: 'tesoura' };

const ehRaposa = s => s.opcoes?.modo === 'raposa';
const ativos = s => s.jogadores.filter(p => !p.saiu);
const indicesAtivos = s => s.jogadores.map((p, i) => (p.saiu ? -1 : i)).filter(i => i >= 0);
const versus = s => s.opcoes?.modo === 'versus';
const sorteio = lista => lista[Math.floor(Math.random() * lista.length)];
const embaralhar = lista => [...lista].sort(() => Math.random() - 0.5);

// Um número inteiro dentro dos limites (ou o padrão, se não veio número).
function numero(v, min, max, padrao) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
}
// O jogador escolhido no menu (o índice em s.jogadores), que precisa ainda estar na partida.
function jogador(s, v) {
  const i = Number(v);
  if (!Number.isInteger(i) || !s.jogadores[i] || s.jogadores[i].saiu) throw new ErroAdm('Escolha um jogador que está na partida.');
  return i;
}
// Uma das opções oferecidas no campo (o valor que chegou precisa estar na lista).
function opcao(lista, v) {
  const achada = lista.find(([x]) => String(x) === String(v));
  if (!achada) throw new ErroAdm('Escolha uma das opções.');
  return achada[0];
}

const campoAlvo = { alvo: 'jogador' };
const campoNumero = (id, nome, min, max, padrao) => ({ id, nome, tipo: 'numero', min, max, padrao });
const campoEscolha = (id, nome, opcoes, padrao) => ({ id, nome, tipo: 'escolha', opcoes, padrao: padrao ?? opcoes[0]?.[0] });

/* ─── Jogos de vez (Velha, Lig 4, Damas) e Pedra Papel e Tesoura ─── */

// Os dois lados da partida: os jogadores, ou os coelhos (lado 0) contra a Raposa (lado 1).
function lados(s) {
  if (!ehRaposa(s)) return s.jogadores.map((p, i) => [i, p.nome]);
  const h = ativos(s);
  return [[0, h.length > 1 ? `Os coelhos (${h.map(p => p.nome).join(' e ')})` : `${h[0]?.nome || 'Os coelhos'}`], [1, 'A Raposa']];
}
const nomeLado = (s, j) => lados(s).find(([x]) => x === j)?.[1] || '?';

// Termina a partida do jeito certo para o modo (o núcleo não grava nada: a sala está marcada).
function encerrar(s, ctx, resultado) {
  const motivo = resultado.empate ? 'empate' : 'vitoria';
  if (ehRaposa(s)) { ctx.finalizarRaposa(s, resultado, motivo); return; }
  ctx.finalizar(s, resultado, motivo);
  ctx.avisarLobby();
}

// Contra a Raposa: se a vez ficou com ela, ela pensa e joga; se ficou com os coelhos, ela espera.
function seguirRaposa(s, ctx) {
  if (!ehRaposa(s) || s.status !== 'jogando') return;
  if (s.estado.vez === 1) ctx.agendarRaposa(s);
  else clearTimeout(s.timer);
}

// Quem pode receber a vez. Contra a Raposa: cada coelho (o índice dele) ou a Raposa (-1).
function opcoesDeVez(s) {
  if (!ehRaposa(s)) return s.jogadores.map((p, i) => [i, p.nome]);
  return [...indicesAtivos(s).map(i => [i, s.jogadores[i].nome]), [-1, 'A Raposa']];
}

const NOMES_VELHA = ['Canto de cima, à esquerda', 'Meio de cima', 'Canto de cima, à direita', 'Meio da esquerda', 'Centro',
  'Meio da direita', 'Canto de baixo, à esquerda', 'Meio de baixo', 'Canto de baixo, à direita'];
const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// Lig 4: as 4 (ou mais) casas em linha que passam por (lin, col), ou null.
function quatroEmLinha(t, lin, col, i) {
  for (const [dl, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const casas = [[lin, col]];
    for (const lado of [1, -1]) {
      let l = lin + dl * lado;
      let c = col + dc * lado;
      while (l >= 0 && l < 6 && c >= 0 && c < 7 && t[l * 7 + c] === i) { casas.push([l, c]); l += dl * lado; c += dc * lado; }
    }
    if (casas.length >= 4) return casas.map(([l, c]) => l * 7 + c);
  }
  return null;
}
const linhaLivreLig4 = (t, col) => { for (let l = 5; l >= 0; l--) if (t[l * 7 + col] == null) return l; return -1; };

// Damas: o nome da casa (como na tela: a1 embaixo à esquerda) e da peça.
const nomeCasaDamas = i => `${'abcdefgh'[i & 7]}${8 - (i >> 3)}`;
const corDamas = (e, j) => (j === e.claras ? 'claras' : 'escuras');
const nomePecaDamas = (s, i) => {
  const p = s.estado.tabuleiro[i];
  return `${nomeCasaDamas(i)}: ${p.d ? 'dama' : 'pedra'} ${corDamas(s.estado, p.j)} (${nomeLado(s, p.j)})`;
};
// Depois de mexer no tabuleiro das Damas: quem ficou sem peças (ou sem jogada na sua vez) perde.
function conferirDamas(s, ctx) {
  const e = s.estado;
  for (const j of [0, 1]) {
    if (!e.tabuleiro.some(p => p && p.j === j)) { encerrar(s, ctx, { vencedor: 1 - j }); return true; }
  }
  if (!damas.jogadasPossiveis(e, e.vez).length) { encerrar(s, ctx, { vencedor: 1 - e.vez }); return true; }
  return false;
}

function podeDesfazer(s) {
  const e = s.estado;
  if (s.jogo === 'damas') return !!e.historico?.length;
  if (s.jogo === 'lig4') return e.ultima != null && e.tabuleiro[e.ultima] != null;
  return !!e.ordem?.length; // Velha: a ordem das jogadas (e das peças que o menu pôs)
}

// Velha: tira a última peça da ordem. A vez volta para quem jogou (a peça que o menu pôs não mexe na vez).
// Devolve o lado de quem tinha jogado, ou null se a peça foi do menu.
function desfazerVelha(e) {
  const casa = e.ordem.pop();
  const dono = e.simbolos.indexOf(e.tabuleiro[casa]);
  e.tabuleiro[casa] = null;
  e.linha = null;
  const doMenu = (e.admPostas || []).includes(casa);
  if (doMenu) { e.admPostas = e.admPostas.filter(c => c !== casa); return null; }
  e.vez = dono;
  return dono;
}
// Contra a Raposa: um lance dos coelhos desfeito devolve o turno da dupla (um lance cada).
const voltarTurno = s => { if (ehRaposa(s) && s.raposa) s.raposa.turno = Math.max(0, s.raposa.turno - 1); };

function acoesDeVez(s) {
  const e = s.estado;
  const L = lados(s);
  const lista = [
    { id: 'vencedor', nome: 'Declarar vencedor', grupo: 'Mexer na partida', perigo: true, ajuda: 'Termina a partida agora com a vitória de quem você escolher.', campos: [campoEscolha('quem', 'Quem vence', L)] },
    { id: 'empate', nome: 'Terminar empatado', grupo: 'Mexer na partida', perigo: true, ajuda: 'Termina a partida agora, sem vencedor.' },
  ];
  if (POR_VEZ.has(s.jogo)) {
    if (podeDesfazer(s)) lista.push({ id: 'desfazer', nome: 'Desfazer a última jogada', grupo: 'Mexer na partida', ajuda: ehRaposa(s) ? 'Volta até a última jogada dos coelhos.' : 'Volta o tabuleiro e a vez para antes do último lance.' });
    const vezes = opcoesDeVez(s);
    const agora = ehRaposa(s) ? (e.vez === 1 ? -1 : null) : e.vez;
    lista.push({ id: 'vez', nome: 'Dar a vez', grupo: 'Mexer na partida', ajuda: 'Passa a vez para quem você escolher.', campos: [campoEscolha('quem', 'Para quem', vezes, vezes.find(([v]) => v !== agora)?.[0])] });
  }
  if (s.jogo === 'velha') {
    const livres = e.tabuleiro.map((v, i) => (v ? null : [i, NOMES_VELHA[i]])).filter(Boolean);
    if (livres.length) lista.push({ id: 'colocar', nome: 'Pôr uma peça', grupo: 'Ajudar', ajuda: 'Marca uma casa para alguém (a vez não muda).', campos: [campoEscolha('quem', 'Para quem', L, e.vez), campoEscolha('casa', 'Casa', livres)] });
  }
  if (s.jogo === 'lig4') {
    const colunas = [0, 1, 2, 3, 4, 5, 6].filter(c => e.tabuleiro[c] == null).map(c => [c, `Coluna ${c + 1}`]);
    if (colunas.length) lista.push({ id: 'colocar', nome: 'Pôr uma peça', grupo: 'Ajudar', ajuda: 'Solta uma peça de alguém numa coluna (a vez não muda).', campos: [campoEscolha('quem', 'Para quem', L, e.vez), campoEscolha('coluna', 'Coluna', colunas, 3)] });
  }
  if (s.jogo === 'damas') {
    const pedras = e.tabuleiro.map((p, i) => (p && !p.d ? [i, nomePecaDamas(s, i)] : null)).filter(Boolean);
    const todas = e.tabuleiro.map((p, i) => (p ? [i, nomePecaDamas(s, i)] : null)).filter(Boolean);
    if (pedras.length) lista.push({ id: 'dama', nome: 'Promover a dama', grupo: 'Ajudar', ajuda: 'Uma pedra vira dama na hora.', campos: [campoEscolha('casa', 'Pedra', pedras)] });
    lista.push({ id: 'remover', nome: 'Tirar uma peça', grupo: 'Ajudar', ajuda: 'Some com uma peça do tabuleiro (quem ficar sem peças perde).', campos: [campoEscolha('casa', 'Peça', todas)] });
  }
  if (s.jogo === 'ppt') {
    lista.push({ id: 'rodada', nome: 'Ganhar a rodada', grupo: 'Ajudar', ajuda: 'A rodada atual vai para quem você escolher (melhor de 3).', campos: [campoEscolha('quem', 'Quem ganha', L)] });
  }
  return lista;
}

function executarDeVez(s, acao, dados, ctx) {
  const e = s.estado;
  const L = lados(s);
  switch (acao) {
    case 'vencedor': {
      const v = opcao(L, dados.quem);
      if (s.jogo === 'ppt') e.placar[v] = Math.max(e.placar[v], 2);
      encerrar(s, ctx, { vencedor: v });
      return `Partida terminada: ${nomeLado(s, v)} venceu.`;
    }
    case 'empate':
      encerrar(s, ctx, { empate: true });
      return 'Partida terminada empatada.';
    case 'desfazer': {
      if (!podeDesfazer(s)) throw new ErroAdm('Não há jogada para desfazer.');
      clearTimeout(s.timer); // contra a Raposa: ela para de pensar
      if (s.jogo === 'damas') {
        const um = () => { if (e.historico[e.historico.length - 1].vez === 0) voltarTurno(s); damas.desfazer(e); };
        um();
        // Contra a Raposa: volta até a vez dos coelhos (a jogada da Raposa sai junto).
        while (ehRaposa(s) && e.vez !== 0 && e.historico.length) um();
      } else if (s.jogo === 'velha') {
        const um = () => { if (desfazerVelha(e) === 0) voltarTurno(s); };
        um();
        while (ehRaposa(s) && e.vez !== 0 && e.ordem.length) um();
      } else {
        const casa = e.ultima;
        const dono = e.tabuleiro[casa];
        e.tabuleiro[casa] = null;
        e.ultima = null;
        e.linha = null;
        if (e.admColocou !== casa) e.vez = dono; // a peça que o menu pôs não era a vez de ninguém
        e.admColocou = null;
      }
      seguirRaposa(s, ctx);
      return 'Última jogada desfeita.';
    }
    case 'vez': {
      const v = opcao(opcoesDeVez(s), dados.quem);
      const lado = ehRaposa(s) ? (v === -1 ? 1 : 0) : v;
      if (s.jogo === 'damas' && !damas.jogadasPossiveis(e, lado).length) throw new ErroAdm('Esse lado não tem nenhuma jogada agora.');
      e.vez = lado;
      if (ehRaposa(s) && v >= 0) s.raposa.turno = ativos(s).indexOf(s.jogadores[v]);
      seguirRaposa(s, ctx);
      return v === -1 ? 'Agora é a vez da Raposa.' : `Agora é a vez de ${s.jogadores[v].nome}.`;
    }
    case 'colocar': {
      const quem = opcao(L, dados.quem);
      if (s.jogo === 'velha') {
        const casa = Number(dados.casa);
        if (!Number.isInteger(casa) || casa < 0 || casa > 8 || e.tabuleiro[casa]) throw new ErroAdm('Essa casa não está livre.');
        const sim = e.simbolos[quem];
        e.tabuleiro[casa] = sim;
        (e.ordem ??= []).push(casa); // entra na ordem das jogadas (o desfazer tira na ordem certa)
        (e.admPostas ??= []).push(casa);
        const linha = LINHAS.find(l => l.every(c => e.tabuleiro[c] === sim));
        if (linha) { e.linha = linha; encerrar(s, ctx, { vencedor: quem }); return `${nomeLado(s, quem)} completou a linha e venceu.`; }
        if (e.tabuleiro.every(Boolean)) { encerrar(s, ctx, { empate: true }); return 'O tabuleiro encheu: deu velha.'; }
        seguirRaposa(s, ctx);
        return `Peça de ${nomeLado(s, quem)} posta: ${NOMES_VELHA[casa].toLowerCase()}.`;
      }
      const col = Number(dados.coluna);
      const lin = Number.isInteger(col) && col >= 0 && col < 7 ? linhaLivreLig4(e.tabuleiro, col) : -1;
      if (lin < 0) throw new ErroAdm('Essa coluna está cheia.');
      e.tabuleiro[lin * 7 + col] = quem;
      e.ultima = lin * 7 + col;
      e.admColocou = e.ultima;
      const linha = quatroEmLinha(e.tabuleiro, lin, col, quem);
      if (linha) { e.linha = linha; encerrar(s, ctx, { vencedor: quem }); return `${nomeLado(s, quem)} fez 4 em linha e venceu.`; }
      if (e.tabuleiro.every(v => v != null)) { encerrar(s, ctx, { empate: true }); return 'O tabuleiro encheu: empate.'; }
      seguirRaposa(s, ctx);
      return `Peça de ${nomeLado(s, quem)} posta na coluna ${col + 1}.`;
    }
    case 'dama':
    case 'remover': {
      const casa = Number(dados.casa);
      const p = Number.isInteger(casa) ? e.tabuleiro[casa] : null;
      if (!p || (acao === 'dama' && p.d)) throw new ErroAdm('Escolha uma peça do tabuleiro.');
      const nome = nomePecaDamas(s, casa);
      if (acao === 'dama') p.d = 1;
      else e.tabuleiro[casa] = null;
      e.ultima = null;
      if (conferirDamas(s, ctx)) return `${acao === 'dama' ? 'Promovida' : 'Tirada'}: ${nome}. A partida acabou.`;
      seguirRaposa(s, ctx);
      return acao === 'dama' ? `Virou dama: ${nome}.` : `Peça tirada: ${nome}.`;
    }
    case 'rodada': {
      const v = opcao(L, dados.quem);
      const outra = e.escolhas[1 - v] || sorteio(MAOS);
      const minha = MAOS.find(m => VENCE[m] === outra);
      const escolhas = v === 0 ? [minha, outra] : [outra, minha];
      e.rodadas.push({ escolhas, vencedor: v });
      e.escolhas = [null, null];
      e.placar[v]++;
      if (e.placar[v] >= 2) { encerrar(s, ctx, { vencedor: v }); return `${nomeLado(s, v)} ganhou a rodada (${NOME_MAO[minha]}) e a partida.`; }
      return `${nomeLado(s, v)} ganhou a rodada com ${NOME_MAO[minha]}.`;
    }
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
}

/* ─── Quiz ────────────────────────────────────────── */

function acoesQuiz(s) {
  const e = s.estado;
  const lista = [];
  if (e.fase === 'pergunta') {
    lista.push({ id: 'revelar', nome: 'Revelar a resposta agora', grupo: 'Mexer na partida', ajuda: 'Fecha a pergunta e mostra a certa (conta quem já respondeu).' });
    lista.push({ id: 'pular', nome: 'Pular a pergunta', grupo: 'Mexer na partida', ajuda: 'Vai para a próxima sem ninguém ganhar pontos por esta.' });
  } else if (e.fase === 'resposta') {
    lista.push({ id: 'pular', nome: 'Ir para a próxima agora', grupo: 'Mexer na partida', ajuda: 'Não espera o tempo de mostrar a resposta.' });
  }
  lista.push(
    { id: 'dar', nome: 'Dar pontos', grupo: 'Ajudar', ...campoAlvo, campos: [campoNumero('pontos', 'Pontos', 0, 20000, 500), campoNumero('acertos', 'Acertos a mais', 0, 50, 0)] },
    { id: 'tirar', nome: 'Tirar pontos', grupo: 'Atrapalhar', ...campoAlvo, campos: [campoNumero('pontos', 'Pontos', 1, 20000, 500)] },
    { id: 'terminar', nome: 'Terminar o quiz', grupo: 'Mexer na partida', perigo: true, ajuda: 'Acaba agora, com o placar de agora.' },
  );
  return lista;
}

function executarQuiz(s, acao, dados, ctx) {
  const e = s.estado;
  switch (acao) {
    case 'revelar':
      if (e.fase !== 'pergunta') throw new ErroAdm('A pergunta já fechou.');
      ctx.revelar(s);
      return 'Resposta revelada.';
    case 'pular': {
      clearTimeout(s.timer);
      if (e.atual + 1 >= e.perguntas.length) { ctx.terminarQuiz(s); return 'Era a última pergunta: o quiz terminou.'; }
      ctx.abrirPergunta(s, e.atual + 1);
      return `Pulou para a pergunta ${e.atual + 1}.`;
    }
    case 'dar':
    case 'tirar': {
      const i = jogador(s, dados.alvo);
      const placar = e.placar[s.jogadores[i].id];
      if (!placar) throw new ErroAdm('Esse jogador não tem placar.');
      const pontos = numero(dados.pontos, 0, 20000, 500);
      if (acao === 'dar') {
        placar.pontos += pontos;
        placar.acertos += numero(dados.acertos, 0, 50, 0);
        return `${s.jogadores[i].nome} ganhou ${pontos} pontos.`;
      }
      placar.pontos = Math.max(0, placar.pontos - pontos);
      return `${s.jogadores[i].nome} perdeu ${pontos} pontos.`;
    }
    case 'terminar':
      clearTimeout(s.timer);
      ctx.terminarQuiz(s);
      return 'Quiz terminado.';
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
}

/* ─── Cobrinha ao vivo ────────────────────────────── */

const RITMOS = [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']];
const FATOR_RITMO = { lenta: 1.7, normal: 1, rapida: 0.6 };

// Relógio dos passos no ritmo escolhido (o normal é o do núcleo, agendarPasso).
function lacoCobras(s, ctx, e) {
  s.proximoPasso += Math.round(COBRAS_PASSO_MS * FATOR_RITMO[e.ritmo]);
  s.timer = setTimeout(() => {
    if (!ctx.salas.has(s.id) || s.status !== 'jogando' || s.estado !== e) return;
    cobras.passo(e);
    if (cobras.acabou(e)) { ctx.terminarCobras(s); return; }
    ctx.enviarQuadroCobras(s);
    lacoCobras(s, ctx, e);
  }, Math.max(0, s.proximoPasso - Date.now()));
}
function comecarRitmo(s, ctx, e) {
  s.proximoPasso = Date.now();
  if (e.ritmo === 'normal') ctx.agendarPasso(s);
  else lacoCobras(s, ctx, e);
}
function mudarRitmo(s, ctx, ritmo) {
  const e = s.estado;
  e.ritmo = ritmo;
  clearTimeout(s.timer);
  if (e.fase === 'largada') {
    // Ainda na contagem: a largada acontece na hora marcada, já no ritmo novo.
    s.timer = setTimeout(() => {
      if (!ctx.salas.has(s.id) || s.status !== 'jogando' || s.estado !== e) return;
      e.fase = 'jogando';
      comecarRitmo(s, ctx, e);
    }, Math.max(0, e.largada - Date.now()));
    return;
  }
  comecarRitmo(s, ctx, e);
}

// As opções de quem vence, conforme o modo.
function vencedoresCobras(s) {
  const e = s.estado;
  if (e.modo === 'colheita') return [[1, 'A equipe venceu'], [0, 'A equipe perdeu']];
  if (e.modo === 'duplas') return [[0, 'Dupla dourada'], [1, 'Dupla azul'], [-1, 'Empate']];
  return [...indicesAtivos(s).map(i => [i, s.jogadores[i].nome]), [-1, 'Empate (ninguém vence)']];
}

function acoesCobras(s) {
  const e = s.estado;
  const mortas = e.cobras.some((c, i) => !c.viva && !s.jogadores[i]?.saiu);
  const lista = [
    { id: 'crescer', nome: 'Crescer a cobra', grupo: 'Ajudar', ...campoAlvo, campos: [campoNumero('casas', 'Quantas casas', 1, 40, 5)] },
    { id: 'encolher', nome: 'Encolher a cobra', grupo: 'Atrapalhar', ...campoAlvo, campos: [campoNumero('casas', 'Quantas casas', 1, 40, 3)] },
    { id: 'escudo', nome: 'Escudo', grupo: 'Ajudar', ajuda: 'Não morre: passa pelas paredes e pelas cobras.', ...campoAlvo, campos: [campoNumero('segundos', 'Segundos', 1, 60, 10)] },
  ];
  if (mortas) lista.push({ id: 'reviver', nome: 'Reviver', grupo: 'Ajudar', ajuda: 'A cobra volta num canto livre, com 3 de tamanho.', ...campoAlvo });
  lista.push(
    { id: 'ritmo', nome: 'Velocidade da partida', grupo: 'Mexer na partida', campos: [campoEscolha('ritmo', 'Velocidade', RITMOS, e.ritmo || 'normal')] },
    { id: 'cenouras', nome: 'Cenouras extras', grupo: 'Mexer na partida', campos: [campoNumero('quantas', 'Quantas', 1, 30, 10)] },
    { id: 'terminar', nome: 'Terminar e escolher o vencedor', grupo: 'Mexer na partida', perigo: true, campos: [campoEscolha('quem', 'Resultado', vencedoresCobras(s))] },
  );
  return lista;
}

function executarCobras(s, acao, dados, ctx) {
  const e = s.estado;
  let texto;
  switch (acao) {
    case 'crescer':
    case 'encolher': {
      const i = jogador(s, dados.alvo);
      const n = numero(dados.casas, 1, 40, 5);
      if (!cobras[acao](e, i, n)) throw new ErroAdm('A cobra dessa pessoa não está viva.');
      texto = `A cobra de ${s.jogadores[i].nome} ${acao === 'crescer' ? 'cresceu' : 'encolheu'} ${n} ${n === 1 ? 'casa' : 'casas'}.`;
      break;
    }
    case 'escudo': {
      const i = jogador(s, dados.alvo);
      const seg = numero(dados.segundos, 1, 60, 10);
      if (!cobras.darEscudo(e, i, seg * 1000)) throw new ErroAdm('A cobra dessa pessoa não está viva.');
      texto = `${s.jogadores[i].nome} tem escudo por ${seg} s.`;
      break;
    }
    case 'reviver': {
      const i = jogador(s, dados.alvo);
      if (e.cobras[i].viva) throw new ErroAdm('Essa cobra já está viva.');
      if (!cobras.reviver(e, i)) throw new ErroAdm('Não há canto livre agora. Tente de novo daqui a pouco.');
      texto = `A cobra de ${s.jogadores[i].nome} voltou ao jogo.`;
      break;
    }
    case 'ritmo': {
      const ritmo = opcao(RITMOS, dados.ritmo);
      mudarRitmo(s, ctx, ritmo);
      texto = `Velocidade: ${RITMOS.find(([k]) => k === ritmo)[1].toLowerCase()}.`;
      break;
    }
    case 'cenouras': {
      const n = cobras.colocarComida(e, numero(dados.quantas, 1, 30, 10));
      texto = n ? `${n} cenouras extras no tabuleiro.` : 'O tabuleiro já está cheio de cenouras.';
      break;
    }
    case 'terminar': {
      const v = Number(opcao(vencedoresCobras(s), dados.quem));
      const todas = e.cobras.map((c, i) => i);
      const venceram = e.modo === 'colheita' ? (v ? todas : []) : e.modo === 'duplas' ? (v < 0 ? [] : todas.filter(i => e.times[i] === v)) : v < 0 ? [] : [v];
      cobras.forcarResultado(e, venceram);
      ctx.terminarCobras(s);
      return 'Partida terminada com o resultado escolhido.';
    }
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
  ctx.enviarQuadroCobras(s);
  return texto;
}

/* ─── Mesas compartilhadas ────────────────────────── */

const quemDoAlvo = (s, dados) => (versus(s) ? jogador(s, dados.alvo) : null);
const ajudaQuem = s => (versus(s) ? campoAlvo : {});

// A mesa termina agora (e.forcado: os índices de quem vence; sem e.forcado, vale a contagem de sempre).
function terminarMesaJa(s, ctx, fim) {
  const e = s.estado;
  e.fim = fim;
  e.terminou = Date.now();
  if (s.jogo === 'memoria') { e.abertas = []; e.fechar = false; }
  ctx.terminarMesa(s);
}

function acoesMesa(s) {
  const e = s.estado;
  const vs = versus(s);
  const lista = [];
  if (s.jogo === 'minado') {
    lista.push(
      { id: 'resolver', nome: 'Abrir o campo todo', grupo: 'Mexer na partida', perigo: true, ajuda: vs ? 'Todas as casas seguras vão para quem você escolher, e a partida acaba.' : 'Limpa o campo: a equipe vence.', ...ajudaQuem(s) },
      { id: 'abrir', nome: 'Abrir casas seguras', grupo: 'Ajudar', ajuda: 'Abre casas sem armadilha (pode abrir mais de uma vez em volta dos zeros).', ...ajudaQuem(s), campos: [campoNumero('quantas', 'Quantas', 1, 50, 5)] },
    );
    if (vs) lista.push({ id: 'pontos', nome: 'Dar casas', grupo: 'Ajudar', ajuda: 'Soma casas no placar de alguém.', ...campoAlvo, campos: [campoNumero('quantas', 'Quantas', 1, 500, 10)] });
    if (vs && e.fora.some((f, i) => f && !s.jogadores[i]?.saiu)) {
      lista.push({ id: 'voltar', nome: 'Tirar da armadilha', grupo: 'Ajudar', ajuda: 'Quem pisou numa armadilha volta a jogar.', campos: [campoEscolha('quem', 'Quem', indicesAtivos(s).filter(i => e.fora[i]).map(i => [i, s.jogadores[i].nome]))] });
    }
  }
  if (s.jogo === 'quebra') {
    lista.push(
      { id: 'resolver', nome: 'Montar a imagem toda', grupo: 'Mexer na partida', perigo: true, ajuda: vs ? 'As peças que faltam vão para quem você escolher, e a partida acaba.' : 'A imagem fica montada: a equipe vence.', ...ajudaQuem(s) },
      { id: 'encaixar', nome: 'Encaixar peças', grupo: 'Ajudar', ajuda: 'Põe peças no lugar certo.', ...ajudaQuem(s), campos: [campoNumero('quantas', 'Quantas', 1, 25, 3)] },
    );
    if (vs) lista.push({ id: 'pontos', nome: 'Dar peças', grupo: 'Ajudar', ajuda: 'Soma peças no placar de alguém.', ...campoAlvo, campos: [campoNumero('quantas', 'Quantas', 1, 50, 2)] });
  }
  if (s.jogo === 'memoria') {
    lista.push(
      { id: 'resolver', nome: 'Achar todos os pares', grupo: 'Mexer na partida', perigo: true, ajuda: vs ? 'Os pares que faltam vão para quem você escolher, e a partida acaba.' : 'A equipe acha todos os pares e vence.', ...ajudaQuem(s) },
      { id: 'par', nome: 'Achar um par', grupo: 'Ajudar', ajuda: vs ? 'Um par vai para quem você escolher.' : 'Um par fica achado (não gasta jogada).', ...ajudaQuem(s) },
      { id: 'espiar', nome: 'Mostrar todas as cartas', grupo: 'Ajudar', ajuda: 'Todo mundo vê as cartas por alguns segundos.', campos: [campoNumero('segundos', 'Segundos', 1, 10, 3)] },
      { id: 'vez', nome: 'Dar a vez', grupo: 'Mexer na partida', ...campoAlvo },
    );
    if (vs) lista.push({ id: 'pontos', nome: 'Dar pares', grupo: 'Ajudar', ajuda: 'Soma pares no placar de alguém.', ...campoAlvo, campos: [campoNumero('quantas', 'Quantos', 1, 20, 1)] });
  }
  const resultado = vs
    ? [...indicesAtivos(s).map(i => [i, s.jogadores[i].nome]), [-1, 'Quem tiver mais pontos'], [-2, 'Empate (ninguém vence)']]
    : [[1, 'A equipe vence'], [0, 'A equipe perde']];
  lista.push({ id: 'terminar', nome: vs ? 'Terminar e escolher o vencedor' : 'Terminar a partida', grupo: 'Mexer na partida', perigo: true, campos: [campoEscolha('quem', 'Resultado', resultado)] });
  return lista;
}

// Campo Minado: as armadilhas são plantadas no primeiro clique; o menu planta antes, se precisar.
function plantarSePreciso(e) {
  if (e.minas) return;
  MESAS.minado.plantar(e, Math.floor(e.lin / 2) * e.col + Math.floor(e.col / 2)); // como se o primeiro clique fosse no meio
  e.inicio = Date.now();
}

function executarMesa(s, acao, dados, ctx) {
  const e = s.estado;
  const vs = versus(s);
  const ativosIdx = indicesAtivos(s);
  if (s.jogo === 'memoria' && e.fechar && acao !== 'vez') MESAS.memoria.fecharCartas(e, ativosIdx); // as duas erradas viram e a vez passa
  switch (acao) {
    case 'terminar': {
      const lista = vs ? [...ativosIdx.map(i => [i, s.jogadores[i].nome]), [-1, ''], [-2, '']] : [[1, ''], [0, '']];
      const v = Number(opcao(lista, dados.quem));
      if (vs) { if (v >= 0) e.forcado = [v]; else if (v === -2) e.forcado = []; } else e.forcado = v ? ativosIdx : [];
      terminarMesaJa(s, ctx, 'adm');
      return 'Partida terminada com o resultado escolhido.';
    }
    case 'pontos': {
      const i = jogador(s, dados.alvo);
      const max = { minado: 500, quebra: 50, memoria: 20 }[s.jogo];
      const n = numero(dados.quantas, 1, max, 1);
      if (s.jogo === 'minado') e.casas[i] = (e.casas[i] || 0) + n;
      if (s.jogo === 'quebra') e.certas[i] = (e.certas[i] || 0) + n;
      if (s.jogo === 'memoria') e.pares[i] = (e.pares[i] || 0) + n;
      return `${s.jogadores[i].nome} ganhou ${n} no placar.`;
    }
    default:
  }
  if (s.jogo === 'minado') return executarMinado(s, acao, dados, ctx);
  if (s.jogo === 'quebra') return executarQuebra(s, acao, dados, ctx);
  return executarMemoria(s, acao, dados, ctx);
}

function executarMinado(s, acao, dados, ctx) {
  const e = s.estado;
  const vs = versus(s);
  switch (acao) {
    case 'resolver': {
      const quem = quemDoAlvo(s, dados);
      plantarSePreciso(e);
      e.abertas.forEach((a, k) => {
        if (a || e.minas.has(k)) return;
        e.abertas[k] = 1;
        e.bandeiras[k] = 0;
        if (vs) { e.deQuem[k] = quem; e.casas[quem] = (e.casas[quem] || 0) + 1; }
      });
      for (const m of e.minas) e.bandeiras[m] = 1;
      terminarMesaJa(s, ctx, vs ? 'limpo' : 'ganhou');
      return vs ? `Campo aberto: as casas foram para ${s.jogadores[quem].nome}.` : 'Campo limpo: a equipe venceu.';
    }
    case 'abrir': {
      const quem = vs ? quemDoAlvo(s, dados) : indicesAtivos(s)[0];
      const n = numero(dados.quantas, 1, 50, 5);
      plantarSePreciso(e);
      const fechadas = () => e.abertas.map((a, k) => k).filter(k => !e.abertas[k] && !e.minas.has(k) && (vs || !e.bandeiras[k]));
      let abertas = 0;
      for (let k = 0; k < n && !e.fim; k++) {
        const livres = fechadas();
        if (!livres.length) break;
        MESAS.minado.abrir(e, sorteio(livres), quem);
        abertas++;
      }
      if (!abertas) throw new ErroAdm('Não sobrou casa segura para abrir.');
      if (e.fim) { e.terminou = Date.now(); ctx.terminarMesa(s); return 'Abriu as últimas casas: o campo está limpo.'; }
      return `Abriu ${abertas} ${abertas === 1 ? 'casa segura' : 'casas seguras'}${vs ? ` para ${s.jogadores[quem].nome}` : ''}.`;
    }
    case 'voltar': {
      const i = Number(dados.quem);
      if (!vs || !e.fora[i] || s.jogadores[i]?.saiu) throw new ErroAdm('Essa pessoa não está fora.');
      e.fora[i] = false;
      return `${s.jogadores[i].nome} voltou a jogar.`;
    }
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
}

function executarQuebra(s, acao, dados, ctx) {
  const e = s.estado;
  const vs = versus(s);
  // Põe a peça k no lugar dela (trocando com a que estava lá); no versus, as peças certas ficam de quem.
  const encaixar = (k, quem) => {
    const j = e.pecas.indexOf(k);
    [e.pecas[k], e.pecas[j]] = [e.pecas[j], e.pecas[k]];
    if (vs) for (const x of [k, j]) if (e.pecas[x] === x && e.deQuem[x] === -1) { e.deQuem[x] = quem; e.certas[quem]++; }
  };
  const erradas = () => e.pecas.map((p, k) => (p === k ? -1 : k)).filter(k => k >= 0);
  switch (acao) {
    case 'resolver': {
      const quem = quemDoAlvo(s, dados);
      for (const k of erradas()) if (e.pecas[k] !== k) encaixar(k, quem);
      terminarMesaJa(s, ctx, 'montado');
      return vs ? `Imagem montada: as peças foram para ${s.jogadores[quem].nome}.` : 'Imagem montada: a equipe venceu.';
    }
    case 'encaixar': {
      const quem = quemDoAlvo(s, dados);
      const n = numero(dados.quantas, 1, 25, 3);
      const lista = embaralhar(erradas()).slice(0, n);
      let feitas = 0;
      for (const k of lista) if (e.pecas[k] !== k) { encaixar(k, quem); feitas++; }
      if (!feitas) throw new ErroAdm('Todas as peças já estão no lugar.');
      if (e.pecas.every((p, k) => p === k)) { terminarMesaJa(s, ctx, 'montado'); return 'Encaixou as últimas peças: a imagem está montada.'; }
      return `Encaixou ${feitas} ${feitas === 1 ? 'peça' : 'peças'}${vs ? ` para ${s.jogadores[quem].nome}` : ''}.`;
    }
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
}

function executarMemoria(s, acao, dados, ctx) {
  const e = s.estado;
  const vs = versus(s);
  // Os pares que faltam: [carta, carta], sem os que têm carta aberta agora (se der).
  const faltam = () => {
    const pares = new Map();
    e.cartas.forEach((f, k) => { if (e.achada[k] < 0) pares.set(f, [...(pares.get(f) || []), k]); });
    return [...pares.values()];
  };
  const achar = ([a, b], quem) => {
    e.achada[a] = quem;
    e.achada[b] = quem;
    e.pares[quem] = (e.pares[quem] || 0) + 1;
    e.abertas = e.abertas.filter(k => k !== a && k !== b);
  };
  const acabou = () => e.achada.every(x => x >= 0);
  const fimNatural = () => (e.modo === 'coop' ? 'ganhou' : 'acabou');
  switch (acao) {
    case 'resolver': {
      const quem = vs ? quemDoAlvo(s, dados) : e.vez;
      for (const par of faltam()) achar(par, quem);
      terminarMesaJa(s, ctx, fimNatural());
      return vs ? `Todos os pares foram para ${s.jogadores[quem].nome}.` : 'A equipe achou todos os pares.';
    }
    case 'par': {
      const quem = vs ? quemDoAlvo(s, dados) : e.vez;
      const lista = faltam();
      if (!lista.length) throw new ErroAdm('Não falta par nenhum.');
      const livres = lista.filter(([a, b]) => !e.abertas.includes(a) && !e.abertas.includes(b));
      achar(sorteio(livres.length ? livres : lista), quem);
      if (acabou()) { terminarMesaJa(s, ctx, fimNatural()); return 'Era o último par: a partida acabou.'; }
      return `Um par achado${vs ? ` para ${s.jogadores[quem].nome}` : ''}.`;
    }
    case 'espiar': {
      const seg = numero(dados.segundos, 1, 10, 3);
      e.espiar = Date.now() + seg * 1000;
      setTimeout(() => { if (ctx.salas.has(s.id) && s.estado === e && s.status === 'jogando') ctx.enviarSala(s); }, seg * 1000 + 50);
      return `Todas as cartas à mostra por ${seg} s.`;
    }
    case 'vez': {
      const i = jogador(s, dados.alvo);
      clearTimeout(s.timer); // o núcleo ia virar as cartas erradas e passar a vez
      e.abertas = [];
      e.fechar = false;
      e.vez = i;
      return `Agora é a vez de ${s.jogadores[i].nome}.`;
    }
    default:
      throw new ErroAdm('Ação desconhecida.');
  }
}

/* ─── O registro ──────────────────────────────────── */

module.exports = {
  jogos: ['velha', 'ppt', 'lig4', 'damas', 'quiz', 'cobras', 'minado', 'quebra', 'memoria'],
  acoes(s) {
    if (s.jogo === 'quiz') return acoesQuiz(s);
    if (s.jogo === 'cobras') return acoesCobras(s);
    if (MESA.has(s.jogo)) return acoesMesa(s);
    return acoesDeVez(s);
  },
  async executar(s, acao, dados, ctx) {
    if (s.jogo === 'quiz') return executarQuiz(s, acao, dados, ctx);
    if (s.jogo === 'cobras') return executarCobras(s, acao, dados, ctx);
    if (MESA.has(s.jogo)) return executarMesa(s, acao, dados, ctx);
    return executarDeVez(s, acao, dados, ctx);
  },
};
