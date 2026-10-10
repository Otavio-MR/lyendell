// Menu de administrador no Lyendell Dorme (veja src/adm-jogos.js): pular de fase, dar mais tempo, decidir
// quem vence, reviver, proteger, matar, trocar a classe ou silenciar alguém, e ver a classe de cada um
// (só o administrador fica sabendo: o texto de volta vai só para a conexão dele).
// As regras de cada ação ficam em src/cidade.js (adm*); aqui fica o relógio das fases e o aviso.

const cidade = require('../cidade');

const FASES = { papeis: 'Cartas', noite: 'Noite', amanhecer: 'Amanhecer', dia: 'Dia (conversa e votação)', execucao: 'Execução', cacador: 'Tiro do Caçador' };
const SEGUINTE = { papeis: 'a noite', noite: 'o amanhecer', amanhecer: 'o dia', dia: 'a execução', execucao: 'a noite', cacador: 'depois do tiro' };

const PAPEIS = Object.entries(cidade.PAPEIS).map(([k, p]) => [k, p.nome]);

function acoes(s) {
  const e = s.estado;
  if (!e || e.fase === 'fim') return [];
  const fase = `${FASES[e.fase] || e.fase}${e.dia ? ` ${e.dia}` : ''}`;
  const lista = [
    { id: 'pular', nome: 'Pular para a próxima fase', grupo: 'Mexer na partida', ajuda: `Agora: ${fase}. Vai para ${SEGUINTE[e.fase] || 'a próxima fase'}.` },
    { id: 'tempo', nome: 'Mais tempo nesta fase', grupo: 'Mexer na partida', ajuda: `Agora: ${fase}.`, campos: [{ id: 'segundos', nome: 'Segundos a mais', tipo: 'numero', min: 5, max: 600, padrao: 60 }] },
    {
      id: 'vencer', nome: 'Terminar com a vitória de um time', grupo: 'Mexer na partida', perigo: true, ajuda: 'A partida acaba agora.',
      campos: [{ id: 'time', nome: 'Quem vence', tipo: 'escolha', padrao: 'coelhos', opcoes: [['coelhos', 'Os Coelhos'], ['raposos', 'Os Raposos'], ['neutro', 'Os neutros (Bobo, Gatuno, Andarilho)'], ['ninguem', 'Ninguém']] }],
    },
    { id: 'anunciar', nome: 'Aviso no diário da partida', grupo: 'Mexer na partida', ajuda: 'Todo mundo lê.', campos: [{ id: 'texto', nome: 'Aviso', tipo: 'texto', padrao: '' }] },
    { id: 'reviver', nome: 'Reviver um jogador', grupo: 'Ajudar', alvo: 'jogador' },
    { id: 'papel', nome: 'Ver a classe de alguém', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Só você fica sabendo.' },
    { id: 'papeis', nome: 'Ver a classe de todos', grupo: 'Ajudar', ajuda: 'Só você fica sabendo.' },
    { id: 'matar', nome: 'Matar um jogador', grupo: 'Atrapalhar', alvo: 'jogador', perigo: true, ajuda: 'Um raio cai na cabeça dele.' },
    { id: 'trocar', nome: 'Trocar a classe de alguém', grupo: 'Atrapalhar', alvo: 'jogador', ajuda: 'Só ele fica sabendo (e os Raposos, se ele virar Raposo).', campos: [{ id: 'papel', nome: 'Nova classe', tipo: 'escolha', padrao: 'coelho', opcoes: PAPEIS }] },
    { id: 'silenciar', nome: 'Silenciar no chat do jogo', grupo: 'Atrapalhar', alvo: 'jogador', campos: [{ id: 'segundos', nome: 'Segundos', tipo: 'numero', min: 5, max: 600, padrao: 60 }] },
  ];
  if (e.fase === 'noite') lista.splice(5, 0, { id: 'proteger', nome: 'Proteger nesta noite', grupo: 'Ajudar', alvo: 'jogador', ajuda: 'Nada de noite mata essa pessoa (ninguém fica sabendo).' });
  return lista;
}

const numero = (v, min, max, padrao) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};

async function executar(s, acao, dados, ctx) {
  const e = s.estado;
  const alvo = Number(dados.alvo);
  const nome = () => e.j[alvo]?.nome || 'jogador';
  // Mudou quem está pronto (alguém morreu, voltou...): a fase pode acabar antes.
  const conferirRelogio = () => { if (e.fase !== 'fim') ctx.agendarCidade(s, cidade.todosProntos(e)); };
  try {
    switch (acao) {
      case 'pular': {
        const antes = FASES[e.fase] || e.fase;
        e.prazo = Date.now();
        ctx.passoCidade(s); // vira a fase, leva cada um para a toca e marca o relógio da próxima (ou termina)
        return `Fase pulada: ${antes} acabou.`;
      }
      case 'tempo': {
        const seg = numero(dados.segundos, 5, 600, 60);
        cidade.admMaisTempo(e, seg * 1000);
        ctx.agendarCidade(s);
        return `Mais ${seg} s nesta fase.`;
      }
      case 'vencer': {
        cidade.admVencer(e, String(dados.time || ''));
        ctx.terminarCidade(s);
        return `Partida encerrada: ${e.vencedores.texto}`;
      }
      case 'anunciar': {
        const t = cidade.admAnunciar(e, dados.texto);
        return `Aviso no diário: "${t}".`;
      }
      case 'reviver':
        cidade.admReviver(e, alvo);
        conferirRelogio();
        return `${nome()} voltou à vida.`;
      case 'proteger':
        cidade.admProteger(e, alvo);
        return `${nome()} está protegido nesta noite.`;
      case 'papel':
        return cidade.admPapel(e, alvo);
      case 'papeis':
        return e.j.map((p, i) => cidade.admPapel(e, i)).join(' ');
      case 'matar': {
        const acabou = cidade.admMatar(e, alvo);
        if (acabou) { ctx.terminarCidade(s); return `${nome()} morreu, e a partida acabou: ${e.vencedores.texto}`; }
        conferirRelogio();
        return `${nome()} foi atingido por um raio.`;
      }
      case 'trocar': {
        const papel = String(dados.papel || '');
        const antigo = cidade.admTrocarPapel(e, alvo, papel);
        conferirRelogio();
        return `${nome()} era ${cidade.PAPEIS[antigo].nome} e agora é ${cidade.PAPEIS[papel].nome}.`;
      }
      case 'silenciar': {
        const seg = numero(dados.segundos, 5, 600, 60);
        const p = cidade.admSilenciar(e, alvo, seg);
        ctx.paraUsuario(p.id, 'adm:aviso', { texto: `O administrador te silenciou no chat do jogo por ${seg} s.` });
        return `${p.nome} está sem falar no chat do jogo por ${seg} s.`;
      }
      default:
        throw new ctx.ErroAdm('Ação desconhecida.');
    }
  } catch (x) {
    throw x instanceof cidade.ErroCidade ? new ctx.ErroAdm(x.message) : x;
  }
}

module.exports = { jogos: ['cidade'], acoes, executar };
