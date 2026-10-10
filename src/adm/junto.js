// Menu do administrador nos jogos juntos (src/junto.js): Travessia, Barris do Raposo, Super Coelho e Corrida
// do Coelho (rodam no navegador; o servidor cuida das vidas, fases e vencedores), Pac-Coelho e 2048 (rodam
// aqui no servidor). Arena e Batalha têm o seu próprio arquivo.
//
// Ajudar: vidas, reviver quem ficou de fora, escudo (as quedas não contam), pontos, e as coisas de cada jogo
// (assustar as raposas, peça escolhida no 2048...). Mexer na partida: fases, tempo, quem vence.
// As pegadinhas (inverter, congelar, lento) nos jogos do servidor são aplicadas em junto.js, por usuário.

const junto = require('../junto');
const { ErroAdm } = require('../adm-jogos');

const NO_NAVEGADOR = ['travessia', 'barris', 'supercoelho', 'corrida'];
const PECAS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

const jogador = { alvo: 'jogador' };
const campoNumero = (id, nome, min, max, padrao) => ({ id, nome, tipo: 'numero', min, max, padrao });
const segundos = (padrao = 15) => campoNumero('segundos', 'Segundos', 1, 120, padrao);

// Mexer na partida: igual em todos os jogos juntos.
function acoesDaPartida(e) {
  const lista = [
    { id: 'mais_tempo', nome: 'Mais tempo', grupo: 'Mexer na partida', ajuda: 'Atrasa o fim da partida.', campos: [campoNumero('minutos', 'Minutos', 1, 30, 2)] },
    { id: 'menos_tempo', nome: 'Menos tempo', grupo: 'Mexer na partida', ajuda: 'Adianta o fim da partida (fica pelo menos 5 segundos).', campos: [campoNumero('minutos', 'Minutos', 1, 30, 1)] },
  ];
  if (e.modo === 'coop') lista.push({ id: 'vitoria', nome: 'A equipe vence agora', grupo: 'Mexer na partida', ajuda: 'Termina a partida com vitória da equipe.', perigo: true });
  else lista.push({ id: 'vencedor', nome: 'Terminar escolhendo o vencedor', grupo: 'Mexer na partida', ...jogador, ajuda: 'Termina a partida agora e esse jogador vence.', perigo: true });
  lista.push({ id: 'sem_vencedor', nome: 'Terminar sem vencedor', grupo: 'Mexer na partida', ajuda: 'Termina a partida agora, sem ninguém vencer.', perigo: true });
  return lista;
}

function acoesNoNavegador(e) {
  const coop = e.modo === 'coop';
  const lista = [
    coop
      ? { id: 'vidas', nome: 'Mais vidas para a equipe', grupo: 'Ajudar', campos: [campoNumero('n', 'Quantas', 1, 20, 1)] }
      : { id: 'vidas', nome: 'Mais vidas', grupo: 'Ajudar', ...jogador, campos: [campoNumero('n', 'Quantas', 1, 20, 1)] },
    { id: 'reviver', nome: 'Reviver um jogador', grupo: 'Ajudar', ...jogador, ajuda: 'Quem ficou de fora volta para a partida.' },
    { id: 'escudo', nome: 'Escudo', grupo: 'Ajudar', ...jogador, ajuda: 'Por alguns segundos, cair não gasta vida.', campos: [segundos()] },
    { id: 'pontos', nome: 'Dar pontos', grupo: 'Ajudar', ...jogador, campos: [campoNumero('n', 'Pontos', 1, 1_000_000, 500)] },
  ];
  if (coop && e.fases > 1) {
    lista.push(
      { id: 'pular_fase', nome: 'Pular a fase', grupo: 'Mexer na partida', ajuda: 'Todos vão para a próxima fase (na última, a equipe vence).' },
      { id: 'ir_fase', nome: 'Ir para a fase', grupo: 'Mexer na partida', campos: [{ id: 'fase', nome: 'Fase', tipo: 'escolha', padrao: Math.min(e.fase + 1, e.fases - 1), opcoes: Array.from({ length: e.fases }, (_, k) => [k, `Fase ${k + 1}`]) }] },
    );
  }
  return lista;
}

function acoesPac(e) {
  const coop = e.modo === 'coop';
  const lista = [];
  if (coop) {
    lista.push(
      { id: 'vidas', nome: 'Mais vidas para a equipe', grupo: 'Ajudar', campos: [campoNumero('n', 'Quantas', 1, 20, 1)] },
      { id: 'reviver', nome: 'Reviver um coelho', grupo: 'Ajudar', ...jogador, ajuda: 'Quem ficou de fora volta para o labirinto.' },
    );
  }
  lista.push(
    { id: 'escudo', nome: 'Escudo', grupo: 'Ajudar', ...jogador, ajuda: 'As raposas não pegam esse coelho por alguns segundos.', campos: [segundos(10)] },
    { id: 'pontos', nome: 'Dar pontos', grupo: 'Ajudar', ...jogador, campos: [campoNumero('n', 'Pontos', 1, 100_000, 500)] },
    { id: 'assustar', nome: 'Assustar as raposas agora', grupo: 'Mexer na partida', ajuda: 'Como se alguém comesse uma cenoura grande.' },
    { id: 'sem_raposas', nome: 'Tirar as raposas', grupo: 'Mexer na partida', ajuda: 'As raposas voltam para a toca e ficam presas um tempo.', campos: [campoNumero('segundos', 'Segundos', 1, 60, 10)] },
    { id: 'limpar', nome: 'Pular a fase', grupo: 'Mexer na partida', ajuda: 'Limpa o labirinto: a partida acaba como se todos os Lírios tivessem sido comidos.', perigo: true },
  );
  return lista;
}

function acoes2048(e) {
  const coop = e.modo === 'coop';
  const alvo = coop ? {} : jogador;
  const lista = [
    { id: 'peca', nome: 'Criar uma peça', grupo: 'Ajudar', ...alvo, ajuda: coop ? 'Uma peça escolhida numa casa vazia do tabuleiro.' : 'Uma peça escolhida numa casa vazia do tabuleiro dessa pessoa.', campos: [{ id: 'valor', nome: 'Peça', tipo: 'escolha', padrao: 64, opcoes: PECAS.map(v => [v, String(v)]) }] },
    { id: 'desfazer', nome: 'Desfazer a última jogada', grupo: 'Ajudar', ...alvo },
    { id: 'pontos', nome: 'Dar pontos', grupo: 'Ajudar', ...alvo, campos: [campoNumero('n', 'Pontos', 1, 1_000_000, 500)] },
  ];
  if (!coop) lista.push({ id: 'pedras', nome: 'Tirar as pedras', grupo: 'Ajudar', ...jogador, ajuda: 'Limpa as pedras do tabuleiro dessa pessoa.' });
  return lista;
}

module.exports = {
  jogos: ['junto:travessia', 'junto:barris', 'junto:supercoelho', 'junto:corrida', 'junto:pacman', 'junto:2048'],

  acoes(s) {
    const e = s.estado;
    // As pegadinhas nos jogos do servidor valem por usuário: guarda quem é cada lugar (o menu lista as ações
    // ao abrir, antes de qualquer pegadinha na sala).
    junto.ligar(e, s.jogadores.map(p => p.id));
    if (e.fim) return [];
    const doJogo = NO_NAVEGADOR.includes(e.jogo) ? acoesNoNavegador(e) : e.jogo === 'pacman' ? acoesPac(e) : e.jogo === '2048' ? acoes2048(e) : [];
    return [...doJogo, ...acoesDaPartida(e)];
  },

  async executar(s, acao, dados, ctx) {
    const e = s.estado;
    const agora = Date.now();
    junto.ligar(e, s.jogadores.map(p => p.id));
    if (e.fim) throw new ErroAdm('A partida já acabou.');
    const sim = e.sim;
    const motor = sim ? junto.motor(e.jogo) : null;
    const nomeDe = i => s.jogadores[i]?.nome || 'jogador';
    const numero = (v, min, max, padrao) => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
    };
    const alvo = () => {
      const i = Number(dados.alvo);
      if (!Number.isInteger(i) || !e.p[i] || e.p[i].saiu || s.jogadores[i]?.saiu) throw new ErroAdm('Escolha um jogador que ainda está na partida.');
      return i;
    };
    // No 2048 co-op o tabuleiro é um só (não precisa escolher ninguém).
    const alvoOuEquipe = () => (e.modo === 'coop' ? 0 : alvo());
    // Avisos para quem está na sala: acontecimentos do jogo (que as telas já entendem) e recados.
    const repassar = ev => { for (const uid of ctx.quemVeJunto(s)) ctx.paraUsuario(uid, 'junto:evento', { id: s.id, ev }); };
    const recado = (i, texto) => ctx.paraUsuario(s.jogadores[i].id, 'adm:aviso', { sala: s.id, texto });
    // Jogos do servidor: os pontos do motor vão para o placar e o quadro novo sai já.
    const quadroNovo = () => { if (sim) { junto.copiarPontosDoMotor(e); ctx.enviarQuadroJunto(s); } };
    const terminarSeAcabou = () => {
      if (junto.verificar(e, Date.now())) { ctx.terminarJunto(s); return true; }
      return false;
    };

    try {
      switch (acao) {
        /* ─── Ajudar ─── */
        case 'vidas': {
          const n = numero(dados.n, 1, 20, 1);
          if (e.jogo === 'pacman') {
            const total = motor.admin.maisVidas(sim, n);
            quadroNovo();
            return `+${n} ${n === 1 ? 'vida' : 'vidas'} para a equipe (agora ${total}).`;
          }
          if (e.modo === 'coop') {
            const total = junto.maisVidas(e, -1, n);
            return `+${n} ${n === 1 ? 'vida' : 'vidas'} para a equipe (agora ${total}).`;
          }
          const i = alvo();
          const total = junto.maisVidas(e, i, n);
          recado(i, `O administrador te deu +${n} ${n === 1 ? 'vida' : 'vidas'}!`);
          return `+${n} ${n === 1 ? 'vida' : 'vidas'} para ${nomeDe(i)} (agora ${total}).`;
        }
        case 'reviver': {
          const i = alvo();
          if (e.jogo === 'pacman') {
            motor.admin.reviver(sim, i);
            quadroNovo();
          } else {
            junto.reviver(e, i);
            // A sala nova vai antes do aviso: a tela de quem voltou recomeça já sabendo que está no jogo.
            ctx.enviarSala(s);
            repassar({ tipo: 'reviveu', i });
          }
          recado(i, 'O administrador te trouxe de volta para a partida!');
          return `${nomeDe(i)} voltou para a partida.`;
        }
        case 'escudo': {
          const i = alvo();
          const seg = numero(dados.segundos, 1, 120, 15);
          if (e.jogo === 'pacman') {
            motor.admin.escudo(sim, i, seg);
            quadroNovo();
          } else junto.darEscudo(e, i, seg, agora);
          recado(i, `Escudo! Por ${seg} segundos ${e.jogo === 'pacman' ? 'as raposas não te pegam' : 'cair não gasta vida'}.`);
          return `Escudo para ${nomeDe(i)} por ${seg} segundos.`;
        }
        case 'pontos': {
          const n = numero(dados.n, 1, 1_000_000, 500);
          if (sim) {
            const i = e.jogo === '2048' ? alvoOuEquipe() : alvo();
            const total = motor.admin.darPontos(sim, i, n);
            quadroNovo();
            return e.jogo === '2048' && e.modo === 'coop' ? `+${n} pontos para a equipe (agora ${total}).` : `+${n} pontos para ${nomeDe(i)} (agora ${total}).`;
          }
          const i = alvo();
          const total = junto.darPontos(e, i, n);
          repassar({ tipo: 'pontos', i, n: total });
          return `+${n} pontos para ${nomeDe(i)} (agora ${total}).`;
        }

        /* ─── Pac-Coelho ─── */
        case 'assustar':
          motor.admin.assustar(sim);
          quadroNovo();
          return 'As raposas ficaram assustadas!';
        case 'sem_raposas': {
          const seg = numero(dados.segundos, 1, 60, 10);
          motor.admin.tirarRaposas(sim, seg);
          quadroNovo();
          return `As raposas voltaram para a toca e ficam lá por ${seg} segundos.`;
        }
        case 'limpar':
          motor.admin.limpar(sim);
          junto.copiarPontosDoMotor(e);
          if (!terminarSeAcabou()) quadroNovo();
          return 'O labirinto foi limpo: a fase acabou.';

        /* ─── 2048 ─── */
        case 'peca': {
          const valor = Number(dados.valor);
          if (!PECAS.includes(valor)) throw new ErroAdm('Escolha uma peça de 2 a 2048.');
          const i = alvoOuEquipe();
          if (!motor.admin.colocar(sim, i, valor)) throw new ErroAdm('O tabuleiro está cheio: não cabe outra peça.');
          if (!terminarSeAcabou()) quadroNovo();
          return e.modo === 'coop' ? `Peça ${valor} criada no tabuleiro da equipe.` : `Peça ${valor} criada no tabuleiro de ${nomeDe(i)}.`;
        }
        case 'desfazer': {
          const i = alvoOuEquipe();
          if (!motor.admin.desfazer(sim, i)) throw new ErroAdm('Não há jogada para desfazer.');
          quadroNovo();
          return e.modo === 'coop' ? 'A última jogada da equipe foi desfeita.' : `A última jogada de ${nomeDe(i)} foi desfeita.`;
        }
        case 'pedras': {
          const i = alvo();
          const n = motor.admin.tirarPedras(sim, i);
          quadroNovo();
          return n ? `${n} ${n === 1 ? 'pedra saiu' : 'pedras saíram'} do tabuleiro de ${nomeDe(i)}.` : `${nomeDe(i)} não tinha pedras.`;
        }

        /* ─── Fases (co-op do Barris e do Super Coelho) ─── */
        case 'pular_fase': {
          if (junto.pularFase(e, agora)) {
            ctx.terminarJunto(s);
            return 'Era a última fase: a equipe venceu.';
          }
          return `Todos foram para a fase ${e.fase + 1} de ${e.fases}.`;
        }
        case 'ir_fase': {
          const f = numero(dados.fase, 0, e.fases - 1, e.fase);
          junto.irParaFase(e, f, agora);
          return `Todos foram para a fase ${f + 1} de ${e.fases}.`;
        }

        /* ─── Mexer na partida ─── */
        case 'mais_tempo':
        case 'menos_tempo': {
          const min = numero(dados.minutos, 1, 30, 1);
          const resta = junto.mudarTempo(e, acao === 'mais_tempo' ? min : -min, agora);
          ctx.agendarJunto(s); // o relógio do fim muda de hora
          const texto = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
          return `${acao === 'mais_tempo' ? `+${min}` : `-${min}`} min: agora faltam ${texto}.`;
        }
        case 'vencedor': {
          const i = alvo();
          junto.terminarAdm(e, [i], agora);
          ctx.terminarJunto(s);
          return `Partida encerrada: ${nomeDe(i)} venceu.`;
        }
        case 'vitoria':
          junto.terminarAdm(e, junto.presentes(e), agora);
          ctx.terminarJunto(s);
          return 'Partida encerrada: a equipe venceu.';
        case 'sem_vencedor':
          junto.terminarAdm(e, [], agora);
          ctx.terminarJunto(s);
          return 'Partida encerrada sem vencedor.';
        default:
          throw new ErroAdm('Ação desconhecida.');
      }
    } catch (x) {
      if (x instanceof ErroAdm || x instanceof TypeError || x instanceof ReferenceError || x instanceof RangeError) throw x;
      throw new ErroAdm(x.message);
    }
  },
};
