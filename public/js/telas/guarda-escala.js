// Escala da Guarda do Coelho: a agenda de turnos, as convocações ("Preciso de guardas agora", avisadas no Discord)
// e o controle de quem mais trabalha. O servidor confere as permissões (escala.ver e escala.gerir); aqui só mostramos
// as abas e os botões de quem pode usar. Carregada só quando alguém abre #/guarda-escala (import dinâmico em app.js).
//   #/guarda-escala[/agenda|convocacoes|controle]    #/guarda-escala/convocacao/<id>
import { get, h, trocar, icone, cabecalho, vazio, pode, estado, ehCrianca } from '../core.js';
import { API, carregando, seguro, corDos, agoraBr } from './guarda-escala-comum.js';
import { agenda } from './guarda-escala-agenda.js';
import { convocacoes, convocacaoDetalhe as detalhe } from './guarda-escala-conv.js';
import { controle } from './guarda-escala-controle.js';
import { quadro } from './guarda-escala-quadro.js';

const TELAS = { agenda, convocacoes, quadro, controle };

const portaAlta = () => vazio('Essa porta é alta demais!', 'A escala da Guarda é coisa de gente grande. Vamos brincar em outro lugar?', h('a', { class: 'btn', href: '#/recreacao' }, 'Ir brincar'));

async function contexto() {
  const { guardas } = await get(`${API}/guardas`);
  return { eu: estado.eu, gerir: pode('escala.gerir'), guardas, cor: corDos(guardas), hoje: agoraBr().dia };
}

export async function guardaEscala(aba = 'agenda') {
  if (ehCrianca()) return portaAlta();
  const ctx = await contexto();
  const abas = [['agenda', 'Agenda', 'calendario'], ['convocacoes', 'Convocações', 'megafone'], ['quadro', 'Quadro', 'usuarios'], ctx.gerir && ['controle', 'Controle', 'trofeu']].filter(Boolean);
  if (!abas.some(a => a[0] === aba)) aba = 'agenda';

  const nav = h('nav', { class: 'abas gesc-abas', 'aria-label': 'Partes da Escala da Guarda' },
    abas.map(([k, nome, ic]) => h('a', { class: `aba ${k === aba ? 'ativa' : ''}`.trim(), href: `#/guarda-escala/${k}`, 'aria-current': k === aba ? 'page' : null }, icone(ic), nome)));
  const corpo = h('div', { class: 'gesc-corpo' }, carregando());
  ctx.recarregar = () => seguro(corpo, () => TELAS[aba](corpo, ctx));

  const raiz = h('div', { class: `pagina gesc${aba === 'agenda' ? ' gesc-ag' : ''}` },
    cabecalho({ titulo: 'Escala da Guarda do Coelho', icone: 'escudo', sub: 'Os horários dos guardas, as convocações na hora e o controle de quem se dedica.' }),
    !ctx.guardas.length && h('p', { class: 'nota nota-ouro' }, icone('alerta'),
      h('span', null, ctx.gerir ? 'Ainda não há guardas cadastrados. Dê o cargo Guarda aos usuários (Administração, Usuários) para poder marcar turnos.' : 'Ainda não há guardas cadastrados.')),
    nav, corpo);
  await ctx.recarregar();
  return raiz;
}

export async function convocacaoDetalhe(id) {
  if (ehCrianca()) return portaAlta();
  const ctx = await contexto();
  return detalhe(Number(id), ctx);
}
