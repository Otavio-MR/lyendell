// A Escola Luckham: um sistema próprio (fora do Tabelionato) para dirigir a escola.
// O servidor confere as permissões (escola.ver, escola.alunos, escola.lecionar, escola.gerir); aqui só mostramos
// as abas e os botões de quem pode usar. Esta tela é carregada só quando alguém abre #/escola (import dinâmico em app.js).
import { get, put, h, trocar, icone, cabecalho, campo, aviso, vazio, ehCrianca, dataHora, estado, hojeIso } from '../core.js';
import {
  API, painel as painelCaixa, carregando, vazioSimples, plural, diaCurtoSemana, seguro,
  selecao, areaTexto, entradaNumero, entradaTexto, detalheLegivel,
} from './escola-comum.js';
import { alunos, ficha, professores, matricularAluno, inscreverProfessor } from './escola-pessoas.js';
import { turmas, aulas, chamada, notas, marcarAula } from './escola-ensino.js';

const TELAS = { visao, alunos, ficha, professores, turmas, aulas, chamada, notas, config: configuracoes };
// Páginas de detalhe ficam com a aba de onde vieram acesa.
const ABA_DE = { ficha: 'alunos', chamada: 'aulas' };
// Rotas com número: #/escola/alunos/12 abre a ficha e #/escola/aulas/5 abre a chamada.
const DETALHE = { alunos: 'ficha', aulas: 'chamada' };

export async function escola(aba = 'visao', id = null) {
  if (ehCrianca()) {
    return vazio('Essa porta é alta demais!', 'A escola é coisa de gente grande. Vamos brincar em outro lugar?', h('a', { class: 'btn', href: '#/recreacao' }, 'Ir brincar'));
  }
  if (id && DETALHE[aba]) aba = DETALHE[aba];
  else if (!id && ABA_DE[aba]) aba = ABA_DE[aba];
  const dados = await get(`${API}/painel`);
  const ctx = { painel: dados, podes: dados.podes || {}, config: dados.config, id };

  const abas = [
    ['visao', 'Visão geral', true],
    ['alunos', 'Alunos', ctx.podes.alunos],
    ['professores', 'Professores', true],
    ['turmas', 'Turmas e disciplinas', true],
    ['aulas', 'Aulas', true],
    ['notas', 'Notas', ctx.podes.alunos],
    ['config', 'Configurações', ctx.podes.gerir],
  ].filter(a => a[2]);
  const ativa = ABA_DE[aba] || aba;
  if (!TELAS[aba] || !abas.some(a => a[0] === ativa)) { aba = 'visao'; }
  const abaAtiva = ABA_DE[aba] || aba;

  const contas = () => {
    const p = ctx.painel.pendencias;
    return p ? { alunos: [p.alunos_em_analise, 'alunos em análise'], professores: [p.inscritos_professores, 'professores inscritos esperando avaliação'] } : {};
  };
  const nav = h('nav', { class: 'abas escola-abas', 'aria-label': 'Partes da Escola' });
  const desenharAbas = () => {
    const c = contas();
    trocar(nav, abas.map(([k, nome]) => {
      const [n, dica] = c[k] || [0];
      return h('a', { class: `aba ${k === abaAtiva ? 'ativa' : ''}`.trim(), href: `#/escola/${k}`, 'aria-current': k === abaAtiva ? 'page' : null },
        nome, n ? h('span', { class: 'aba-n aba-alerta', title: `${n} ${dica}` }, n) : null);
    }));
  };

  const corpo = h('div', { class: 'escola-corpo' }, carregando());
  const raiz = h('div', { class: 'pagina escola' },
    cabecalho({ titulo: ctx.config.nome || 'Escola Luckham', icone: 'capelo', sub: ctx.config.lema || 'Alunos, professores, aulas e notas da escola de Lyendell.' }),
    !ctx.podes.alunos && h('p', { class: 'nota' }, icone('olho'), 'Você acompanha a escola só para consulta: disciplinas, professores, turmas e o calendário de aulas.'),
    nav, corpo);
  desenharAbas();

  // Refaz a aba em volta do que mudou (e os números das abas), sem voltar ao topo da página.
  ctx.recarregar = async () => {
    try { ctx.painel = await get(`${API}/painel`); ctx.config = ctx.painel.config; } catch { /* mantém os dados antigos */ }
    desenharAbas();
    await seguro(corpo, () => TELAS[aba](corpo, ctx, id));
  };
  await seguro(corpo, () => TELAS[aba](corpo, ctx, id));
  requestAnimationFrame(() => {
    const atual = nav.querySelector('.aba.ativa');
    if (atual && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = atual.offsetLeft - nav.offsetLeft - 16;
  });
  return raiz;
}

/* ─── 1. Visão geral: a primeira tela, enxuta ───── */

const paragrafos = texto => String(texto || '').split(/\n+/).filter(Boolean).map(t => h('p', null, t));
const MAX_AULAS = 5;

function papel(titulo, texto, ic) {
  if (!texto) return null;
  return h('article', { class: 'escola-papel' },
    h('h3', null, ic && icone(ic), titulo),
    h('div', { class: 'escola-papel-texto' }, paragrafos(texto)));
}

// Um cartão de "O que precisa da sua atenção": o número grande, o que é e a ação.
function cartaoAtencao(href, ic, n, texto, acao) {
  return h('a', { class: 'escola-atencao-card', href },
    h('span', { class: 'escola-atencao-n' }, icone(ic), h('strong', null, n)),
    h('span', { class: 'escola-atencao-texto' }, texto),
    h('span', { class: 'escola-atencao-acao' }, acao));
}

// Atalho grande de ação (botão que abre o formulário).
const atalho = (rotulo, ic, onclick, principal = false) => h('button', {
  class: `escola-atalho ${principal ? 'escola-atalho-principal' : ''}`.trim(), type: 'button',
  onclick: async e => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await onclick(); } catch (err) { aviso(err.message, 'erro'); } finally { b.disabled = false; }
  },
}, icone(ic), h('span', null, rotulo));

// Uma linha por aula: dia e hora, disciplina, onde e com quem.
function linhaDeAula(au, { chamada = false, destacar = false } = {}) {
  const detalhe = [au.turma_nome || 'Todas as turmas', au.professor_nome && `com ${au.professor_nome}`, au.local].filter(Boolean).join(' · ');
  return h('li', { class: destacar ? 'escola-aula-sua' : null },
    h('span', { class: 'escola-data' }, h('strong', null, diaCurtoSemana(au.data)), au.hora && h('small', null, au.hora)),
    h('span', { class: 'escola-lista-texto' }, h('strong', null, au.disciplina_nome), h('small', { class: 'suave' }, detalhe)),
    chamada
      ? h('a', { class: 'btn btn-pequeno btn-ouro', href: `#/escola/aulas/${au.id}` }, icone('tarefas'), 'Fazer chamada')
      : null);
}

// Disciplinas e professores, compacto: uma linha por disciplina; a vaga aberta aparece em destaque.
function disciplinasCompactas(lista) {
  if (!lista.length) return vazioSimples('Nenhuma disciplina cadastrada ainda.');
  return h('ul', { class: 'escola-disc-lista' }, lista.map(d => h('li', { class: d.titular ? null : 'escola-disc-vaga' },
    h('strong', { class: 'escola-disc-nome' }, d.nome),
    h('span', { class: 'escola-disc-quem' },
      d.titular ? h('span', { class: 'escola-disc-titular' }, d.titular.nome) : h('span', { class: 'etiqueta escola-ouro' }, icone('alerta'), 'Vaga aberta'),
      d.substituto && h('small', { class: 'suave escola-disc-subst' }, `Substituto: ${d.substituto.nome}`)))));
}

async function visao(corpo, ctx) {
  const p = ctx.painel;
  const c = ctx.config;
  const pend = p.pendencias;
  const gerir = ctx.podes.gerir;
  const leciona = ctx.podes.lecionar && !gerir;
  const a = p.alunos;
  const hoje = hojeIso();
  const doDia = p.proximas_aulas.filter(au => au.data === hoje);
  const meuNome = String(estado.eu?.nome || '').trim().toLowerCase();
  const minha = au => !!au.professor_nome && au.professor_nome.trim().toLowerCase() === meuNome;

  /* A faixa de cima: para quem é a escola (o nome e o lema já estão no título da página). */
  const faixa = h('section', { class: 'escola-faixa', 'aria-label': 'A escola' },
    h('img', { class: 'escola-faixa-brasao', src: '/img/brasao.png', alt: '' }),
    h('p', { class: 'escola-faixa-texto' },
      h('strong', null, `Crianças e jovens de ${c.idade_min} a ${c.idade_max} anos`),
      c.diretor && h('span', null, ` · Direção: ${c.diretor}`),
      a && h('span', { class: 'escola-faixa-numeros' }, ` · ${plural(a.matriculados, 'aluno matriculado', 'alunos matriculados')} · ${plural(p.numeros.turmas, 'turma', 'turmas')}`)));

  /* A ação principal de cada papel. */
  let principal;
  if (gerir) {
    const itens = [];
    if (pend.inscritos_professores) itens.push(cartaoAtencao('#/escola/professores', 'usuario', pend.inscritos_professores, pend.inscritos_professores === 1 ? 'professor inscrito espera a sua avaliação' : 'professores inscritos esperam a sua avaliação', 'Avaliar'));
    if (pend.alunos_em_analise) itens.push(cartaoAtencao('#/escola/alunos?situacao=em_analise', 'relogio', pend.alunos_em_analise, pend.alunos_em_analise === 1 ? 'aluno em análise, esperando matrícula' : 'alunos em análise, esperando matrícula', 'Analisar'));
    if (pend.disciplinas_sem_titular.length) {
      const lista = pend.disciplinas_sem_titular;
      itens.push(cartaoAtencao('#/escola/professores', 'alerta', lista.length, `${lista.length === 1 ? 'disciplina sem titular' : 'disciplinas sem titular'}: ${lista.slice(0, 2).map(d => d.nome).join(', ')}${lista.length > 2 ? ` e mais ${lista.length - 2}` : ''}`, 'Escolher'));
    }
    principal = h('section', { class: 'escola-principal', 'aria-labelledby': 'escola-atencao-t' },
      h('h2', { id: 'escola-atencao-t', class: 'escola-titulo-bloco' }, 'O que precisa da sua atenção'),
      itens.length
        ? h('div', { class: 'escola-atencao' }, itens)
        : h('p', { class: 'escola-tudo-certo' }, icone('check'), 'Tudo em dia: nada esperando pela Direção.'),
      h('div', { class: 'escola-atalhos' },
        atalho('Matricular aluno', 'mais', () => matricularAluno(ctx), true),
        atalho('Inscrever professor', 'usuario', () => inscreverProfessor(ctx)),
        atalho('Marcar aula', 'calendario', () => marcarAula(ctx))));
  } else if (leciona) {
    principal = h('section', { class: 'escola-principal', 'aria-labelledby': 'escola-hoje-t' },
      h('h2', { id: 'escola-hoje-t', class: 'escola-titulo-bloco' }, 'Suas aulas de hoje'),
      doDia.length
        ? h('ul', { class: 'escola-lista escola-hoje' }, [...doDia].sort((x, y) => Number(minha(y)) - Number(minha(x))).map(au => linhaDeAula(au, { chamada: ctx.podes.alunos, destacar: minha(au) })))
        : h('p', { class: 'escola-tudo-certo' }, icone('calendario'), 'Nenhuma aula marcada para hoje.'),
      h('div', { class: 'escola-atalhos' }, atalho('Marcar aula', 'calendario', () => marcarAula(ctx), true)));
  } else {
    const resumo = String(c.edital_alunos || c.como_inscrever || '').split(/\n+/).filter(Boolean)[0] || '';
    principal = h('section', { class: 'escola-principal escola-convite', 'aria-labelledby': 'escola-convite-t' },
      h('h2', { id: 'escola-convite-t', class: 'escola-titulo-bloco' }, 'A Escola Luckham convoca!'),
      resumo && h('p', { class: 'escola-convite-texto' }, resumo),
      h('div', { class: 'escola-atalhos' },
        h('button', { class: 'escola-atalho escola-atalho-principal', type: 'button', onclick: () => {
          const d = document.getElementById('escola-sobre');
          if (!d) return;
          d.open = true;
          d.scrollIntoView({ behavior: 'smooth', block: 'start' });
          d.querySelector('summary')?.focus({ preventScroll: true });
        } }, icone('pergaminho'), h('span', null, 'Como entrar na escola'))));
  }

  /* No máximo dois blocos úteis. */
  const aulasDoBloco = p.proximas_aulas.filter(au => !(leciona && au.data === hoje)).slice(0, MAX_AULAS);
  const blocoAulas = painelCaixa('Próximas aulas', 'calendario', aulasDoBloco.length
    ? h('ul', { class: 'escola-lista' }, aulasDoBloco.map(au => linhaDeAula(au)))
    : vazioSimples('Nenhuma aula marcada para os próximos dias.'),
  h('a', { href: '#/escola/aulas' }, 'Ver o calendário'));
  const blocoDisciplinas = painelCaixa('Disciplinas e professores', 'livro', disciplinasCompactas(p.disciplinas),
    h('a', { href: '#/escola/professores' }, 'Ver o corpo docente'));

  /* "Sobre a escola": os textos longos do jornal, fechados por padrão. */
  const textos = [
    papel('Editais para alunos', c.edital_alunos, 'capelo'),
    papel('Editais para professores', c.edital_professores, 'pena'),
    papel('Como se inscrever', c.como_inscrever, 'pergaminho'),
    papel('Seleção', c.selecao, 'balanca'),
  ].filter(Boolean);
  const sobre = h('details', { class: 'escola-sobre', id: 'escola-sobre' },
    h('summary', null, icone('pergaminho'), h('span', null, h('strong', null, 'Sobre a escola'), h('small', { class: 'suave' }, 'Editais, como se inscrever, seleção e regras')), icone('baixo', 'escola-sobre-seta')),
    h('div', { class: 'escola-sobre-corpo' },
      h('div', { class: 'escola-mural-selos' },
        h('span', { class: 'escola-selo' }, icone('coracao'), `Para crianças e jovens de ${c.idade_min} a ${c.idade_max} anos`),
        c.diretor && h('span', { class: 'escola-selo' }, icone('coroa'), `Direção: ${c.diretor}`),
        h('span', { class: 'escola-selo' }, icone('trofeu'), `Média para passar: ${String(c.media_aprovacao).replace('.', ',')}`),
        h('span', { class: 'escola-selo' }, icone('check'), `Frequência mínima: ${c.frequencia_minima}%`)),
      textos.length ? h('div', { class: 'escola-editais' }, textos) : vazioSimples('A Direção ainda não escreveu os editais.'),
      c.rodape && h('p', { class: 'escola-rodape-mural' }, c.rodape)));

  trocar(corpo, faixa, principal, h('div', { class: 'escola-duplo' }, blocoAulas, blocoDisciplinas), sobre);
}

/* ─── 7. Configurações e histórico ───────────────── */

const ENTIDADES = [['', 'Tudo'], ['aluno', 'Alunos'], ['professor', 'Professores'], ['disciplina', 'Disciplinas'], ['turma', 'Turmas'], ['aula', 'Aulas'], ['nota', 'Notas'], ['config', 'Configurações']];
const NOME_ENTIDADE = Object.fromEntries(ENTIDADES);
let filtroHistorico = '';

async function configuracoes(corpo, ctx) {
  const { config: c } = await get(`${API}/config`);
  const nome = entradaTexto(c.nome, { maxlength: '60' });
  const diretor = entradaTexto(c.diretor, { maxlength: '80' });
  const idadeMin = entradaNumero(c.idade_min, { step: '1', min: '0', max: '120', inputmode: 'numeric' });
  const idadeMax = entradaNumero(c.idade_max, { step: '1', min: '0', max: '120', inputmode: 'numeric' });
  const media = entradaNumero(c.media_aprovacao, { step: '0.1', min: '0', max: '10' });
  const freq = entradaNumero(c.frequencia_minima, { step: '1', min: '0', max: '100', inputmode: 'numeric' });
  const area = (v, linhas = 3) => areaTexto(v, { maxlength: '1500', rows: String(linhas) });
  const lema = area(c.lema, 2);
  const editalAlunos = area(c.edital_alunos, 4);
  const editalProf = area(c.edital_professores, 4);
  const selecaoT = area(c.selecao, 3);
  const comoInscrever = area(c.como_inscrever, 3);
  const rodape = area(c.rodape, 2);
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const salvar = h('button', { class: 'btn btn-ouro', type: 'submit' }, 'Salvar configurações');

  const form = h('form', { class: 'form escola-config', novalidate: true, onsubmit: async e => {
    e.preventDefault();
    erroEl.hidden = true;
    salvar.disabled = true;
    salvar.classList.add('carregando');
    try {
      await put(`${API}/config`, {
        nome: nome.value, diretor: diretor.value, idade_min: idadeMin.value, idade_max: idadeMax.value,
        media_aprovacao: media.value, frequencia_minima: freq.value, lema: lema.value, edital_alunos: editalAlunos.value,
        edital_professores: editalProf.value, selecao: selecaoT.value, como_inscrever: comoInscrever.value, rodape: rodape.value,
      });
      aviso('Configurações salvas.');
      await ctx.recarregar();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.hidden = false;
    } finally {
      salvar.disabled = false;
      salvar.classList.remove('carregando');
    }
  } },
  h('div', { class: 'form-grade' },
    campo('Nome da escola', nome, { obrigatorio: true }),
    campo('Diretor', diretor, { ajuda: 'Aparece no mural, no boletim e na carteirinha.' }),
    campo('Idade mínima do aluno', idadeMin, { ajuda: 'Anos completos.' }),
    campo('Idade máxima do aluno', idadeMax),
    campo('Média para passar (0 a 10)', media, { ajuda: 'Quem tem média igual ou maior está aprovado.' }),
    campo('Frequência mínima (%)', freq, { ajuda: 'Faltas justificadas contam como presença.' }),
    campo('Lema', lema, { classe: 'largo' }),
    campo('Edital para alunos', editalAlunos, { classe: 'largo' }),
    campo('Edital para professores', editalProf, { classe: 'largo' }),
    campo('Seleção', selecaoT, { classe: 'largo' }),
    campo('Como se inscrever', comoInscrever, { classe: 'largo' }),
    campo('Frase do rodapé', rodape, { classe: 'largo' })),
  erroEl,
  h('div', { class: 'escola-barra-acoes' }, salvar));

  const historico = h('div', { class: 'escola-historico-area' }, carregando());
  async function carregarHistorico() {
    trocar(historico, carregando());
    await seguro(historico, async () => {
      const { historico: lista } = await get(`${API}/historico${filtroHistorico ? `?entidade=${filtroHistorico}` : ''}`);
      trocar(historico, lista.length
        ? h('ol', { class: 'escola-historico' }, lista.map(l => h('li', null,
          h('div', { class: 'escola-hist-topo' },
            h('strong', null, `${l.usuario_nome || 'Sistema'} ${l.acao}`),
            h('span', { class: 'suave' }, dataHora(l.criado_em))),
          h('p', { class: 'escola-hist-detalhe' }, detalheLegivel(l.detalhe)),
          h('small', { class: 'suave' }, NOME_ENTIDADE[l.entidade] || l.entidade))))
        : vazioSimples('Nada registrado ainda.'));
    });
  }

  trocar(corpo,
    painelCaixa('Configurações da escola', 'ajustes', [
      h('p', { class: 'form-intro' }, 'Os textos aparecem em "Sobre a escola", na Visão geral. A faixa de idade vale ao matricular e quando a idade de um aluno é mudada.'),
      form]),
    painelCaixa('Histórico', 'relogio', [
      h('div', { class: 'ferramentas' },
        selecao(ENTIDADES, filtroHistorico, { class: 'input filtro', 'aria-label': 'Filtrar o histórico', onchange: e => { filtroHistorico = e.target.value; carregarHistorico(); } }),
        h('span', { class: 'contador' }, 'As 300 mudanças mais recentes')),
      historico]));
  carregarHistorico();
}
