// Menu do administrador na Festa na Toca (src/festa.js): cenouras e cenouras douradas para alguém, andar casas,
// escolher o próximo dado, pular o minijogo, ir para a última rodada e terminar a festa. As pegadinhas nos
// minijogos (rodam no navegador) ficam em public/js/festa-minijogos.js.
// Os coelhos da casa também podem ser escolhidos: por isso o campo "quem" lista todos os coelhos da festa.

const festa = require('../festa');
const { ErroAdm } = require('../adm-jogos');

const quem = e => ({ id: 'quem', nome: 'Coelho', tipo: 'escolha', opcoes: e.j.map((p, k) => [k, p.nome]) });
const numero = (id, nome, min, max, padrao) => ({ id, nome, tipo: 'numero', min, max, padrao });

module.exports = {
  jogos: ['festa'],

  acoes(s) {
    const e = s.estado;
    if (e.fim) return [];
    const lista = [
      { id: 'douradas', nome: 'Dar cenouras douradas', grupo: 'Ajudar', ajuda: 'Número negativo tira.', campos: [quem(e), numero('n', 'Quantas', -10, 10, 1)] },
      { id: 'cenouras', nome: 'Dar cenouras', grupo: 'Ajudar', ajuda: 'Número negativo tira (nunca fica abaixo de 0).', campos: [quem(e), numero('n', 'Quantas', -500, 500, 20)] },
      { id: 'mover', nome: 'Andar casas', grupo: 'Ajudar', ajuda: 'Leva o coelho para a frente pelo caminho principal (sem cair na casa).', campos: [quem(e), numero('n', 'Casas', 1, 40, 5)] },
      { id: 'dado', nome: 'Escolher o próximo dado', grupo: 'Mexer na partida', ajuda: 'O próximo dado desse coelho vai dar esse número.', campos: [quem(e), numero('valor', 'Número (1 a 10)', 1, 10, 10)] },
    ];
    if (e.fase === 'minijogo' && ['apresenta', 'jogando'].includes(e.minijogo?.passo)) {
      lista.push({ id: 'pular_minijogo', nome: 'Pular o minijogo', grupo: 'Mexer na partida', ajuda: 'Fecha o minijogo de agora sem vencedores.' });
    }
    if (e.rodada < e.rodadas && e.fase !== 'bonus') lista.push({ id: 'ultima_rodada', nome: 'Ir para a última rodada', grupo: 'Mexer na partida', ajuda: 'A rodada de agora vira a última; depois vêm as estrelas bônus.' });
    lista.push(
      { id: 'terminar', nome: 'Terminar a festa', grupo: 'Mexer na partida', ajuda: 'Termina agora; vence quem tem mais cenouras douradas.', perigo: true },
      { id: 'vencedor', nome: 'Terminar escolhendo o vencedor', grupo: 'Mexer na partida', ajuda: 'Termina agora e esse coelho fica em primeiro.', campos: [quem(e)], perigo: true },
    );
    return lista;
  },

  async executar(s, acao, dados, ctx) {
    const e = s.estado;
    if (e.fim) throw new ErroAdm('A festa já acabou.');
    const k = Number(dados.quem);
    const coelho = () => {
      if (!Number.isInteger(k) || !e.j[k]) throw new ErroAdm('Escolha um coelho da festa.');
      return e.j[k];
    };
    const inteiro = (v, min, max) => {
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n) || n < min || n > max) throw new ErroAdm(`Escolha um número de ${min} a ${max}.`);
      return n;
    };
    try {
      switch (acao) {
        case 'douradas': {
          const p = coelho();
          const n = inteiro(dados.n, -10, 10);
          const mudou = festa.admin.douradas(e, k, n);
          return `${p.nome}: ${mudou >= 0 ? '+' : ''}${mudou} ${Math.abs(mudou) === 1 ? 'cenoura dourada' : 'cenouras douradas'} (agora ${p.douradas}).`;
        }
        case 'cenouras': {
          const p = coelho();
          const n = inteiro(dados.n, -500, 500);
          const mudou = festa.admin.cenouras(e, k, n);
          return `${p.nome}: ${mudou >= 0 ? '+' : ''}${mudou} cenouras (agora ${p.cenouras}).`;
        }
        case 'mover': {
          const p = coelho();
          const n = inteiro(dados.n, 1, 40);
          festa.admin.mover(e, k, n);
          return `${p.nome} andou ${n} ${n === 1 ? 'casa' : 'casas'}.`;
        }
        case 'dado': {
          const p = coelho();
          const v = inteiro(dados.valor, 1, 10);
          festa.admin.forcarDado(e, k, v);
          return `O próximo dado de ${p.nome} vai dar ${v}.`;
        }
        case 'pular_minijogo':
          festa.admin.pularMinijogo(e, Date.now());
          return 'Minijogo pulado.';
        case 'ultima_rodada':
          festa.admin.ultimaRodada(e);
          return `A rodada ${e.rodada} é a última.`;
        case 'terminar':
          festa.admin.terminar(e, null);
          ctx.terminarFesta(s);
          return 'A festa terminou.';
        case 'vencedor': {
          const p = coelho();
          festa.admin.terminar(e, k);
          ctx.terminarFesta(s);
          return `A festa terminou: ${p.nome} venceu.`;
        }
        default:
          throw new ErroAdm('Ação desconhecida.');
      }
    } catch (x) {
      if (x instanceof festa.ErroFesta) throw new ErroAdm(x.message);
      throw x;
    }
  },
};
