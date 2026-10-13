// A Escola Luckham: um sistema próprio (fora do Tabelionato) para dirigir a escola.
// O servidor confere as permissões (escola.ver, escola.alunos, escola.lecionar, escola.gerir); aqui só mostramos
// as abas e os botões de quem pode usar. Esta tela é carregada só quando alguém abre #/escola (import dinâmico em app.js).
import { get, put, h, trocar, icone, cabecalho, campo, aviso, vazio, ehCrianca, dataHora } from '../core.js';
import {
  API, painel as painelCaixa, carregando, vazioSimples, foto, plural, diaCurtoSemana, seguro, etiqueta, SIT_AULA,
  selecao, areaTexto, entradaNumero, entradaTexto, detalheLegivel,
} from './escola-comum.js';
import { alunos, ficha, professores } from './escola-pessoas.js';
import { turmas, aulas, chamada, notas } from './escola-ensino.js';

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

/* ─── 1. Visão geral: o mural da escola ──────────── */

const paragrafos = texto => String(texto || '').split(/\n+/).filter(Boolean).map(t => h('p', null, t));

function papel(titulo, texto, ic) {
  if (!texto) return null;
  return h('article', { class: 'escola-papel' },
    h('h3', null, ic && icone(ic), titulo),
    h('div', { class: 'escola-papel-texto' }, paragrafos(texto)));
}

function pessoaDaDisciplina(rotulo, p) {
  return h('div', { class: `escola-docente ${p ? '' : 'escola-vaga'}`.trim() },
    p ? foto(p, 'avatar-m') : h('span', { class: 'escola-vaga-marca' }, icone('usuario')),
    h('span', { class: 'escola-docente-texto' },
      h('small', null, rotulo),
      p ? h('strong', null, p.nome) : h('em', null, 'Vaga aberta')));
}

async function visao(corpo, ctx) {
  const p = ctx.painel;
  const c = ctx.config;
  const pend = p.pendencias;
  const avisos = [];
  if (pend) {
    if (pend.inscritos_professores) avisos.push(['professores', 'usuario', `${plural(pend.inscritos_professores, 'professor inscrito espera', 'professores inscritos esperam')} a sua avaliação`, 'Avaliar']);
    if (pend.alunos_em_analise) avisos.push(['alunos?situacao=em_analise', 'relogio', `${plural(pend.alunos_em_analise, 'aluno está', 'alunos estão')} em análise, esperando matrícula`, 'Analisar']);
    if (pend.disciplinas_sem_titular.length) {
      const lista = pend.disciplinas_sem_titular;
      avisos.push(['professores', 'alerta', `${plural(lista.length, 'disciplina está', 'disciplinas estão')} sem professor titular: ${lista.map(d => d.nome).join(', ')}`, 'Escolher']);
    }
  }
  const a = p.alunos;

  trocar(corpo,
    // O mural, no jeito do jornal "A Escola Luckham convoca!"
    h('section', { class: 'escola-mural' },
      h('img', { class: 'escola-mural-brasao', src: '/img/brasao.png', alt: '' }),
      h('div', { class: 'escola-mural-texto' },
        h('p', { class: 'escola-mural-sobre' }, 'A Escola Luckham convoca!'),
        h('h2', null, c.nome),
        c.lema && h('p', { class: 'escola-lema' }, c.lema),
        h('div', { class: 'escola-mural-selos' },
          h('span', { class: 'escola-selo' }, icone('coracao'), `Para crianças e jovens de ${c.idade_min} a ${c.idade_max} anos`),
          c.diretor && h('span', { class: 'escola-selo' }, icone('coroa'), `Direção: ${c.diretor}`),
          h('span', { class: 'escola-selo' }, icone('trofeu'), `Média para passar: ${String(c.media_aprovacao).replace('.', ',')}`),
          h('span', { class: 'escola-selo' }, icone('check'), `Frequência mínima: ${c.frequencia_minima}%`)))),

    avisos.length && h('div', { class: 'escola-avisos' }, avisos.map(([rota, ic, texto, acao]) =>
      h('a', { class: 'nota nota-link nota-ouro', href: `#/escola/${rota}` }, icone(ic), h('span', null, texto), h('strong', null, acao)))),

    a && h('div', { class: 'numeros escola-numeros' },
      numero('capelo', a.matriculados, a.matriculados === 1 ? 'aluno matriculado' : 'alunos matriculados', '#/escola/alunos?situacao=matriculado'),
      numero('livro', p.numeros.disciplinas, p.numeros.disciplinas === 1 ? 'disciplina' : 'disciplinas', '#/escola/turmas'),
      numero('usuarios', p.numeros.turmas, p.numeros.turmas === 1 ? 'turma' : 'turmas', '#/escola/turmas'),
      numero('alerta', a.sem_turma, a.sem_turma === 1 ? 'matriculado sem turma' : 'matriculados sem turma', '#/escola/alunos?turma=sem', a.sem_turma ? 'escola-numero-alerta' : ''),
      a.afastados ? numero('cadeado', a.afastados, a.afastados === 1 ? 'aluno afastado' : 'alunos afastados', '#/escola/alunos?situacao=afastado') : null),

    h('div', { class: 'escola-editais' },
      papel('Editais para alunos', c.edital_alunos, 'capelo'),
      papel('Editais para professores', c.edital_professores, 'pena')),

    h('div', { class: 'escola-editais' },
      papel('Como se inscrever', c.como_inscrever, 'pergaminho'),
      papel('Seleção', c.selecao, 'balanca')),

    painelCaixa('Disciplinas e professores', 'livro', p.disciplinas.length
      ? h('div', { class: 'escola-disciplinas' }, p.disciplinas.map(d => h('article', { class: 'escola-disciplina' },
        h('h3', null, d.nome),
        d.descricao && h('p', { class: 'suave' }, d.descricao),
        pessoaDaDisciplina('Professor titular', d.titular),
        pessoaDaDisciplina('Substituto', d.substituto),
        d.inscritos ? h('a', { class: 'etiqueta escola-ouro', href: '#/escola/professores', title: 'Professores inscritos esperando avaliação' }, icone('relogio'), plural(d.inscritos, 'inscrito', 'inscritos')) : null)))
      : vazioSimples('Nenhuma disciplina cadastrada ainda.'),
    h('a', { href: '#/escola/professores' }, 'Ver o corpo docente')),

    painelCaixa('Próximas aulas', 'calendario', p.proximas_aulas.length
      ? h('ul', { class: 'escola-lista' }, p.proximas_aulas.map(au => h('li', null,
        h('span', { class: 'escola-data' }, h('strong', null, diaCurtoSemana(au.data)), au.hora && h('small', null, au.hora)),
        h('span', { class: 'escola-lista-texto' },
          h('strong', null, au.disciplina_nome),
          h('small', { class: 'suave' }, [au.tema, au.turma_nome || 'Todas as turmas', au.professor_nome && `com ${au.professor_nome}`, au.local].filter(Boolean).join(' · '))),
        etiqueta(SIT_AULA, au.situacao))))
      : vazioSimples('Nenhuma aula marcada para os próximos dias.'),
    h('a', { href: '#/escola/aulas' }, 'Ver o calendário completo')),

    c.rodape && h('p', { class: 'escola-rodape-mural' }, c.rodape));
}

function numero(ic, valor, nome, href, classe = '') {
  return h('a', { class: `numero escola-numero ${classe}`.trim(), href },
    h('span', { class: 'numero-icone' }, icone(ic)), h('strong', null, valor), h('span', null, nome));
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
      h('p', { class: 'form-intro' }, 'Os textos aparecem no mural da Visão geral. A faixa de idade vale ao matricular e quando a idade de um aluno é mudada.'),
      form]),
    painelCaixa('Histórico', 'relogio', [
      h('div', { class: 'ferramentas' },
        selecao(ENTIDADES, filtroHistorico, { class: 'input filtro', 'aria-label': 'Filtrar o histórico', onchange: e => { filtroHistorico = e.target.value; carregarHistorico(); } }),
        h('span', { class: 'contador' }, 'As 300 mudanças mais recentes')),
      historico]));
  carregarHistorico();
}
