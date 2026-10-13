// Escola Luckham: os alunos (lista, ficha, matrícula, situação) e os professores (inscrição, titular e substituto).
import {
  get, post, put, del, h, trocar, icone, botao, campo, aviso, modalForm, confirmar, normalizar, estado, dataCurta, dataHora, barra,
} from '../core.js';
import { entradaImagem } from './livros.js';
import {
  API, SIT_ALUNO, SIT_PROFESSOR, SIT_PRESENCA, SIT_BOLETIM, etiqueta, notaBr, matriculaNum, idadeTexto, plural, painel, vazioSimples,
  tabela, td, foto, agir, consulta, detalheLegivel, selecao, areaTexto, entradaData, entradaNumero, entradaTexto,
} from './escola-comum.js';

/* ─── Alunos: a lista ────────────────────────────── */

// O que a pessoa filtrou fica guardado: depois de matricular alguém a lista volta do mesmo jeito.
const filtro = { busca: '', situacao: '', turma: '' };

const ORDEM_SITUACAO = ['', 'em_analise', 'matriculado', 'afastado', 'concluido', 'desligado'];

export async function alunos(corpo, ctx) {
  const q = consulta();
  if (q.has('situacao')) filtro.situacao = ORDEM_SITUACAO.includes(q.get('situacao')) ? q.get('situacao') : '';
  if (q.has('turma')) filtro.turma = q.get('turma');
  const [{ alunos: lista, contagem }, { turmas }] = await Promise.all([get(`${API}/alunos`), get(`${API}/turmas`)]);
  const { media_aprovacao: mediaMin, frequencia_minima: freqMin } = ctx.config;
  const area = h('div');
  const contador = h('span', { class: 'contador' });
  const chips = h('div', { class: 'segmentado escola-situacoes', role: 'group', 'aria-label': 'Filtrar por situação' });
  const total = Object.values(contagem).reduce((s, n) => s + n, 0);

  function desenharChips() {
    trocar(chips, ORDEM_SITUACAO.map(s => {
      const n = s ? contagem[s] || 0 : total;
      if (s && !n && filtro.situacao !== s) return null;
      return h('button', {
        type: 'button', class: `seg ${filtro.situacao === s ? 'ativo' : ''}`.trim(), 'aria-pressed': String(filtro.situacao === s),
        onclick: () => { filtro.situacao = s; desenharChips(); desenhar(); },
      }, `${s ? SIT_ALUNO[s][0] : 'Todos'} (${n})`);
    }));
  }

  function desenhar() {
    const b = normalizar(filtro.busca.trim());
    const vis = lista.filter(a => {
      if (filtro.situacao && a.situacao !== filtro.situacao) return false;
      if (filtro.turma === 'sem' && a.turma_id != null) return false;
      if (filtro.turma && filtro.turma !== 'sem' && String(a.turma_id) !== filtro.turma) return false;
      return !b || normalizar(`${a.nome} ${a.endereco} ${a.procedencia} ${a.responsavel_nome} ${a.numero ?? ''}`).includes(b);
    });
    contador.textContent = `${vis.length} de ${lista.length} ${lista.length === 1 ? 'aluno' : 'alunos'}`;
    trocar(area, vis.length
      ? h('div', { class: 'escola-alunos-grade' }, vis.map(a => cartaoAluno(a, mediaMin, freqMin)))
      : h('div', { class: 'escola-vazio-grande' },
        h('p', null, lista.length ? 'Nenhum aluno com esse filtro.' : 'Nenhum aluno na escola ainda.'),
        ctx.podes.gerir && !lista.length && botao('Matricular o primeiro aluno', { icone: 'mais', classe: 'btn-ouro', onclick: () => formAluno(null, turmas, ctx) })));
  }

  const opcoesTurma = [['', 'Todas as turmas'], ['sem', 'Sem turma'], ...turmas.map(t => [String(t.id), `${t.nome}${t.ativa ? '' : ' (desativada)'}`])];
  trocar(corpo,
    h('div', { class: 'ferramentas escola-ferramentas' },
      h('label', { class: 'busca' }, icone('busca'),
        h('input', { class: 'input', type: 'search', placeholder: 'Buscar aluno', 'aria-label': 'Buscar aluno', value: filtro.busca, oninput: e => { filtro.busca = e.target.value; desenhar(); } })),
      selecao(opcoesTurma, filtro.turma, { class: 'input filtro', 'aria-label': 'Filtrar por turma', onchange: e => { filtro.turma = e.target.value; desenhar(); } }),
      ctx.podes.gerir && botao('Matricular aluno', { icone: 'mais', classe: 'btn-ouro', onclick: () => formAluno(null, turmas, ctx) }),
      contador),
    chips,
    area);
  desenharChips();
  desenhar();
}

function cartaoAluno(a, mediaMin, freqMin) {
  const f = a.frequencia;
  const freqRuim = f && f.percentual != null && f.percentual < freqMin;
  const mediaRuim = a.media != null && a.media < mediaMin;
  return h('a', { class: `escola-aluno escola-aluno-${a.situacao}`, href: `#/escola/alunos/${a.id}` },
    h('div', { class: 'escola-aluno-topo' },
      foto(a, 'avatar-m'),
      h('div', { class: 'escola-aluno-nome' },
        h('strong', null, a.nome),
        h('small', { class: 'suave' }, `Matrícula ${matriculaNum(a.numero)}`))),
    h('div', { class: 'escola-aluno-linhas' },
      etiqueta(SIT_ALUNO, a.situacao),
      a.idade != null && h('span', { class: 'etiqueta' }, idadeTexto(a.idade)),
      h('span', { class: `etiqueta ${a.turma_nome ? '' : 'escola-ouro'}`.trim() }, a.turma_nome || 'Sem turma')),
    h('div', { class: 'escola-aluno-notas' },
      h('span', { class: freqRuim ? 'escola-ruim-texto' : '', title: f ? `${f.total} chamadas` : 'Ainda sem chamadas' },
        h('small', null, 'Frequência'), h('strong', null, f && f.percentual != null ? `${f.percentual}%` : '-')),
      h('span', { class: mediaRuim ? 'escola-ruim-texto' : '' },
        h('small', null, 'Média'), h('strong', null, notaBr(a.media)))));
}

/* ─── Alunos: formulário de matrícula e edição ───── */

function opcoesDeTurma(turmas, atual) {
  return [['', 'Sem turma'], ...turmas.filter(t => t.ativa || t.id === atual).map(t => [String(t.id),
    `${t.nome}${t.vagas != null ? ` (${plural(t.vagas_livres, 'vaga livre', 'vagas livres')})` : ''}${t.ativa ? '' : ' (desativada)'}`])];
}

export function formAluno(aluno, turmas, ctx, aoSalvar) {
  const novo = !aluno;
  const a = aluno || {};
  let fotoUrl = a.foto || '';
  const envio = { n: 0 };
  const nome = entradaTexto(a.nome, { maxlength: '80', autocomplete: 'off' });
  const idade = entradaNumero(a.idade ?? '', { step: '1', min: '0', max: '120', inputmode: 'numeric' });
  const endereco = entradaTexto(a.endereco, { maxlength: '60', placeholder: 'O nick, como no Registro de Moradores' });
  const procedencia = entradaTexto(a.procedencia, { maxlength: '80', placeholder: 'Ex.: Vale do Norte, Porto Alvo' });
  const respNome = entradaTexto(a.responsavel_nome, { maxlength: '80' });
  const respEndereco = entradaTexto(a.responsavel_endereco, { maxlength: '60' });
  const respProcedencia = entradaTexto(a.responsavel_procedencia, { maxlength: '80', placeholder: 'Cidade ou região, se for de fora' });
  const turma = selecao(opcoesDeTurma(turmas, a.turma_id), a.turma_id ?? '');
  const data = entradaData(a.data_matricula || '');
  const etapa = entradaTexto(a.etapa, { maxlength: '400', placeholder: 'Ex.: alfabetização, primeiro ano' });
  const obs = areaTexto(a.observacoes, { maxlength: '2000', rows: '3' });
  const situacao = selecao([['matriculado', 'Matriculado agora'], ['em_analise', 'Em análise (inscrição)']], 'matriculado');
  const { idade_min: min, idade_max: max } = ctx.config;

  modalForm({
    titulo: novo ? 'Matricular aluno' : `Editar ficha · ${a.nome}`, tamanho: 'medio', textoOk: novo ? 'Matricular' : 'Salvar',
    conteudo: [
      novo && h('p', { class: 'form-intro' }, `A escola aceita alunos de ${min} a ${max} anos. A mesma pessoa não se matricula duas vezes e turma cheia não aceita mais ninguém.`),
      h('div', { class: 'form-grade' },
        campo('Nome do aluno', nome, { obrigatorio: true }),
        campo('Idade', idade, { obrigatorio: true, ajuda: 'Em anos.' }),
        campo('Endereço do aluno', endereco, { ajuda: 'O nick dele, como no Tabelionato. Vazio se não tem.' }),
        campo('Vem de (cidade ou região)', procedencia, { ajuda: 'A cidade ou região de onde a pessoa vem, se for de fora de Lyendell.' }),
        campo('Turma', turma),
        campo('Nome do responsável', respNome),
        campo('Endereço do responsável', respEndereco, { ajuda: 'O nick dele.' }),
        campo('Responsável vem de', respProcedencia),
        novo ? campo('Situação inicial', situacao) : null,
        campo('Data da matrícula', data, { ajuda: novo ? 'Vazio usa o dia de hoje.' : null }),
        campo('Etapa ou série', etapa, { classe: 'largo' }),
        h('div', { class: 'campo largo' }, h('span', { class: 'campo-rotulo' }, 'Foto'), entradaImagem(fotoUrl, v => { fotoUrl = v; }, envio)),
        campo('Observações', obs, { classe: 'largo', ajuda: 'Saúde, cuidados, combinados com a família.' })),
    ],
    aoEnviar: async () => {
      if (envio.n) throw new Error('Espere a foto terminar de enviar.');
      const corpo = {
        nome: nome.value, idade: idade.value, endereco: endereco.value, procedencia: procedencia.value, foto: fotoUrl, turma_id: turma.value || null,
        responsavel_nome: respNome.value, responsavel_endereco: respEndereco.value, responsavel_procedencia: respProcedencia.value, data_matricula: data.value || null,
        etapa: etapa.value, observacoes: obs.value,
      };
      if (novo) {
        const r = await post(`${API}/alunos`, { ...corpo, situacao: situacao.value });
        aviso(r.numero ? `Matrícula feita: ${nome.value.trim()}, matrícula nº ${String(r.numero).padStart(4, '0')}.` : 'Inscrição recebida: o aluno está em análise.');
      } else {
        await put(`${API}/alunos/${a.id}`, corpo);
        aviso('Ficha atualizada.');
      }
      if (aoSalvar) await aoSalvar(); else await ctx.recarregar();
    },
  });
}

// Matricular, afastar, concluir, desligar ou reativar. Afastar e desligar pedem o motivo.
export function formSituacaoAluno(a, ctx) {
  const outras = Object.entries(SIT_ALUNO).filter(([k]) => k !== a.situacao);
  const sel = selecao(outras.map(([k, [nome]]) => [k, k === 'matriculado' ? (a.situacao === 'em_analise' ? 'Matricular' : 'Matriculado (reativar)') : nome]), outras[0][0]);
  const motivo = areaTexto('', { maxlength: '300', rows: '2' });
  const caixaMotivo = campo('Motivo', motivo, { obrigatorio: true, ajuda: 'Fica no histórico do aluno.' });
  const ver = () => { caixaMotivo.hidden = !['afastado', 'desligado'].includes(sel.value); };
  sel.addEventListener('change', ver);
  ver();
  modalForm({
    titulo: `Situação · ${a.nome}`, tamanho: 'pequeno', textoOk: 'Mudar situação',
    conteudo: [
      h('p', { class: 'form-intro' }, 'Hoje: ', etiqueta(SIT_ALUNO, a.situacao)),
      campo('Nova situação', sel),
      caixaMotivo,
    ],
    aoEnviar: async () => {
      const r = await post(`${API}/alunos/${a.id}/situacao`, { situacao: sel.value, motivo: motivo.value });
      aviso(r.numero && sel.value === 'matriculado' ? `Matriculado. Matrícula nº ${String(r.numero).padStart(4, '0')}.` : 'Situação atualizada.');
      await ctx.recarregar();
    },
  });
}

/* ─── Alunos: a ficha ────────────────────────────── */

async function baixarLivro(botaoEl, gerar, arquivo) {
  await agir(botaoEl, async () => {
    const mod = await import('../livro-mc.js');
    gerar(mod).baixar(arquivo);
  });
}

const linhaDado = (rotulo, valor) => (valor == null || valor === '' ? null : [h('dt', null, rotulo), h('dd', null, valor)]);

export async function ficha(corpo, ctx, id) {
  const [d, { turmas }] = await Promise.all([get(`${API}/alunos/${id}`), ctx.podes.gerir ? get(`${API}/turmas`) : { turmas: [] }]);
  const a = d.aluno;
  const f = d.frequencia;
  const bol = d.boletim;
  const cfg = { ...ctx.config, ...d.config };
  const freqRuim = f.percentual != null && f.percentual < cfg.frequencia_minima;
  const autor = estado.eu.nome;
  const arquivoBase = a.nome.replace(/[\\/:*?"<>|]/g, '').trim();

  const btnBoletim = botao('Boletim (.book)', { icone: 'baixar', onclick: e => baixarLivro(e.currentTarget, m => m.boletimDoAluno({ ...a, frequencia: d.frequencia }, bol, cfg, autor), `Boletim ${arquivoBase}`) });
  const btnCarteira = botao('Carteirinha (.book)', { icone: 'baixar', onclick: e => baixarLivro(e.currentTarget, m => m.carteirinhaDoAluno(a, cfg, autor), `Carteirinha ${arquivoBase}`) });

  trocar(corpo,
    h('a', { class: 'voltar', href: '#/escola/alunos' }, icone('voltar'), 'Voltar aos alunos'),
    h('section', { class: 'painel escola-ficha-topo' },
      foto(a, 'avatar-xg'),
      h('div', { class: 'escola-ficha-id' },
        h('h2', null, a.nome),
        h('div', { class: 'escola-aluno-linhas' },
          etiqueta(SIT_ALUNO, a.situacao),
          h('span', { class: 'etiqueta' }, `Matrícula ${matriculaNum(a.numero)}`),
          a.idade != null && h('span', { class: 'etiqueta' }, idadeTexto(a.idade)),
          h('span', { class: `etiqueta ${a.turma_nome ? '' : 'escola-ouro'}`.trim() }, a.turma_nome || 'Sem turma'))),
      h('div', { class: 'escola-ficha-acoes' },
        btnBoletim, btnCarteira,
        ctx.podes.gerir && botao('Editar', { icone: 'editar', onclick: () => formAluno(a, turmas, ctx, () => ctx.recarregar()) }),
        ctx.podes.gerir && botao('Mudar situação', { icone: 'ajustes', onclick: () => formSituacaoAluno(a, ctx) }),
        ctx.podes.gerir && botao('Apagar', { icone: 'lixo', classe: 'btn-perigo-texto', onclick: () => apagarAluno(a) }))),

    h('div', { class: 'escola-ficha-grade' },
      painel('Dados', 'usuario', h('dl', { class: 'escola-dl' },
        linhaDado('Endereço', a.endereco),
        linhaDado('Vem de', a.procedencia),
        linhaDado('Responsável', a.responsavel_nome),
        linhaDado('Endereço do responsável', a.responsavel_endereco),
        linhaDado('Responsável vem de', a.responsavel_procedencia),
        linhaDado('Data da matrícula', a.data_matricula && dataCurta(a.data_matricula)),
        linhaDado('Etapa', a.etapa),
        linhaDado('Observações', a.observacoes),
        linhaDado('Cadastrado por', a.criado_por_nome && `${a.criado_por_nome}${a.criado_em ? `, ${dataHora(a.criado_em)}` : ''}`))),

      painel('Frequência', 'calendario', f.total
        ? h('div', { class: 'escola-freq' },
          h('div', { class: 'escola-freq-cab' },
            h('strong', { class: freqRuim ? 'escola-ruim-texto' : 'escola-bom-texto' }, `${f.percentual}%`),
            h('span', { class: 'suave' }, `de presença em ${plural(f.total, 'chamada', 'chamadas')}`)),
          barra(f.percentual, 100),
          h('p', { class: 'suave' }, `${f.presentes} ${f.presentes === 1 ? 'presença' : 'presenças'}, ${plural(f.faltas, 'falta', 'faltas')} e ${plural(f.justificadas, 'justificada', 'justificadas')}. Faltas justificadas contam como presença.`),
          freqRuim && h('p', { class: 'nota nota-vermelha' }, icone('alerta'), `Abaixo da frequência mínima da escola (${cfg.frequencia_minima}%).`))
        : vazioSimples('Ainda não houve chamada com este aluno.'))),

    painel('Boletim', 'livro', bol.disciplinas.length
      ? [tabela(['Disciplina', 'Avaliações', 'Média', 'Situação'], bol.disciplinas.map(b => h('tr', null,
        td('Disciplina', h('strong', null, b.disciplina_nome)),
        td('Avaliações', b.notas.length
          ? h('div', { class: 'chips' }, b.notas.map(n => h('span', { class: 'etiqueta', title: `${dataCurta(n.data)}${Number(n.peso) !== 1 ? `, peso ${notaBr(n.peso)}` : ''}` },
            `${n.titulo}: ${notaBr(n.nota)}`)))
          : h('span', { class: 'suave' }, 'Sem notas')),
        td('Média', h('strong', null, notaBr(b.media))),
        td('Situação', etiqueta(SIT_BOLETIM, b.situacao)))), { vazio: 'Sem disciplinas.' }),
      h('p', { class: 'escola-boletim-total' },
        h('span', null, 'Média geral ', h('strong', null, notaBr(bol.media_geral))),
        etiqueta(SIT_BOLETIM, bol.situacao),
        h('span', { class: 'suave' }, `Para passar: ${notaBr(bol.media_aprovacao)}`))]
      : vazioSimples('Nenhuma disciplina cadastrada.')),

    painel('Presenças recentes', 'tarefas', d.presencas.length
      ? h('ul', { class: 'escola-lista' }, d.presencas.map(p => h('li', null,
        h('span', { class: 'escola-data' }, h('strong', null, dataCurta(p.data)), p.hora && h('small', null, p.hora)),
        h('span', { class: 'escola-lista-texto' },
          h('strong', null, p.disciplina_nome),
          h('small', { class: 'suave' }, [p.tema, p.observacao].filter(Boolean).join(' · '))),
        etiqueta(SIT_PRESENCA, p.situacao))))
      : vazioSimples('Nenhuma presença registrada.')),

    ctx.podes.gerir && painel('Histórico', 'relogio', d.historico.length
      ? h('ol', { class: 'escola-historico' }, d.historico.map(l => h('li', null,
        h('div', { class: 'escola-hist-topo' }, h('strong', null, `${l.usuario_nome || 'Sistema'} ${l.acao}`), h('span', { class: 'suave' }, dataHora(l.criado_em))),
        h('p', { class: 'escola-hist-detalhe' }, detalheLegivel(l.detalhe)))))
      : vazioSimples('Nada registrado ainda.')));

  async function apagarAluno(al) {
    if (!await confirmar(`Apagar a ficha de ${al.nome}? Isso não pode ser desfeito. Quem já tem frequência ou notas não pode ser apagado: mude a situação para desligado.`, { titulo: 'Apagar aluno', ok: 'Apagar', perigo: true })) return;
    try {
      await del(`${API}/alunos/${al.id}`);
      aviso('Ficha apagada.');
      location.hash = '#/escola/alunos';
    } catch (e) { aviso(e.message, 'erro'); }
  }
}

/* ─── Professores ────────────────────────────────── */

let disciplinaFiltro = '';
const ORDEM_SIT_PROF = ['titular', 'substituto', 'avaliacao', 'afastado', 'desligado'];

export async function professores(corpo, ctx) {
  const q = consulta();
  if (q.has('disciplina')) disciplinaFiltro = q.get('disciplina');
  const [{ professores: lista }, { disciplinas }] = await Promise.all([get(`${API}/professores`), get(`${API}/disciplinas`)]);
  const gerir = ctx.podes.gerir;
  const ativas = disciplinas.filter(d => d.ativa);
  const area = h('div', { class: 'escola-docentes-area' });

  function desenhar() {
    const visiveis = disciplinas.filter(d => !disciplinaFiltro || String(d.id) === disciplinaFiltro);
    trocar(area, visiveis.length ? visiveis.map(d => {
      const deles = lista.filter(p => p.disciplina_id === d.id).sort((x, y) => ORDEM_SIT_PROF.indexOf(x.situacao) - ORDEM_SIT_PROF.indexOf(y.situacao));
      const titular = deles.find(p => p.situacao === 'titular');
      const substituto = deles.find(p => p.situacao === 'substituto');
      const inscritos = deles.filter(p => p.situacao === 'avaliacao');
      const afastados = deles.filter(p => p.situacao === 'afastado');
      const desligados = deles.filter(p => p.situacao === 'desligado');
      const card = p => cartaoProfessor(p, { lista, gerir, ctx, disciplinas: ativas });
      return painel(d.nome, 'livro', [
        !d.ativa && h('p', { class: 'nota' }, icone('alerta'), 'Esta disciplina está desativada.'),
        h('div', { class: 'escola-docentes' },
          titular ? card(titular) : vagaAberta('Professor titular', d, gerir, ctx, ativas),
          substituto ? card(substituto) : vagaAberta('Substituto', d, gerir, ctx, ativas)),
        gerir && inscritos.length ? [h('h3', { class: 'escola-sub' }, `Inscritos em avaliação (${inscritos.length})`), h('div', { class: 'escola-docentes' }, inscritos.map(card))] : null,
        gerir && afastados.length ? [h('h3', { class: 'escola-sub' }, `Afastados (${afastados.length})`), h('div', { class: 'escola-docentes' }, afastados.map(card))] : null,
        gerir && desligados.length ? h('details', { class: 'escola-desligados' }, h('summary', null, `Desligados (${desligados.length})`), h('div', { class: 'escola-docentes' }, desligados.map(card))) : null,
      ]);
    }) : vazioSimples('Nenhuma disciplina com esse filtro.'));
  }

  trocar(corpo,
    h('div', { class: 'ferramentas escola-ferramentas' },
      selecao([['', 'Todas as disciplinas'], ...disciplinas.map(d => [String(d.id), d.nome + (d.ativa ? '' : ' (desativada)')])], disciplinaFiltro,
        { class: 'input filtro', 'aria-label': 'Filtrar por disciplina', onchange: e => { disciplinaFiltro = e.target.value; desenhar(); } }),
      gerir && botao('Inscrever professor', { icone: 'mais', classe: 'btn-ouro', onclick: () => formProfessor(null, ativas, ctx) }),
      h('span', { class: 'contador' }, gerir ? 'Um titular e um substituto por disciplina' : 'Os professores da escola')),
    !gerir && h('p', { class: 'form-intro' }, 'Cada disciplina tem um professor titular e, se for preciso, um substituto de confiança.'),
    area);
  desenhar();
}

function vagaAberta(rotulo, d, gerir, ctx, ativas) {
  return h('div', { class: 'escola-professor escola-professor-vago' },
    h('span', { class: 'escola-vaga-marca' }, icone('usuario')),
    h('div', { class: 'escola-professor-corpo' }, h('small', { class: 'suave' }, rotulo), h('strong', null, 'Vaga aberta'),
      gerir && d.ativa && h('div', { class: 'escola-professor-acoes' }, botao('Inscrever professor', { icone: 'mais', classe: 'btn-pequeno', onclick: () => formProfessor(null, ativas, ctx, d.id) }))));
}

function cartaoProfessor(p, { lista, gerir, ctx, disciplinas }) {
  const atribuir = (nova, e) => mudarSituacaoProfessor(p, nova, lista, ctx, e.currentTarget);
  return h('div', { class: `escola-professor escola-professor-${p.situacao}` },
    foto(p, 'avatar-m'),
    h('div', { class: 'escola-professor-corpo' },
      h('small', { class: 'suave' }, SIT_PROFESSOR[p.situacao]?.[0] || p.situacao),
      h('strong', null, p.nome),
      (p.endereco || p.procedencia) && h('span', { class: 'suave' }, p.endereco || `Vem de ${p.procedencia}`),
      p.ingresso && h('small', { class: 'suave' }, `Desde ${dataCurta(p.ingresso)}`),
      gerir && p.observacoes && h('p', { class: 'escola-professor-obs' }, p.observacoes),
      gerir && h('div', { class: 'escola-professor-acoes' },
        p.situacao !== 'titular' && p.situacao !== 'desligado' && botao('Titular', { icone: 'coroa', classe: 'btn-pequeno', titulo: 'Tornar titular da disciplina', onclick: e => atribuir('titular', e) }),
        p.situacao !== 'substituto' && p.situacao !== 'desligado' && botao('Substituto', { icone: 'alianca', classe: 'btn-pequeno', titulo: 'Tornar substituto da disciplina', onclick: e => atribuir('substituto', e) }),
        botao('Situação', { icone: 'ajustes', classe: 'btn-pequeno', titulo: 'Afastar, desligar ou voltar à avaliação', onclick: () => escolherSituacao(p, lista, ctx) }),
        botao('', { icone: 'editar', classe: 'btn-pequeno', titulo: 'Editar', onclick: () => formProfessor(p, disciplinas, ctx) }),
        botao('', { icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto', titulo: 'Apagar', onclick: () => apagarProfessor(p, ctx) }))));
}

// Muda a situação do professor. Se o lugar de titular (ou de substituto) já tem dono, o servidor devolve 409:
// então perguntamos para onde o atual vai e reenviamos com "trocar".
async function mudarSituacaoProfessor(p, nova, lista, ctx, botaoEl, motivo = '') {
  if (botaoEl) botaoEl.disabled = true;
  try {
    let r;
    try {
      r = await post(`${API}/professores/${p.id}/situacao`, { situacao: nova, motivo });
    } catch (e) {
      const dono = e.status === 409 && ['titular', 'substituto'].includes(nova) ? lista.find(x => x.disciplina_id === p.disciplina_id && x.situacao === nova && x.id !== p.id) : null;
      if (!dono) throw e;
      const destino = await perguntarDestino(p, dono, nova, lista);
      if (!destino) return;
      r = await post(`${API}/professores/${p.id}/situacao`, { situacao: nova, motivo, trocar: destino });
    }
    aviso(r.trocado ? `${p.nome} agora é ${nova}. ${r.trocado.nome} passou a ${SIT_PROFESSOR[r.trocado.para][0].toLowerCase()}.` : `${p.nome} agora é ${SIT_PROFESSOR[nova][0].toLowerCase()}.`);
    await ctx.recarregar();
  } catch (e) {
    aviso(e.message, 'erro');
  } finally {
    if (botaoEl) botaoEl.disabled = false;
  }
}

// Diz para onde vai quem já ocupa o lugar. Devolve a situação escolhida, ou null se a pessoa desistir.
function perguntarDestino(novo, dono, lugar, lista) {
  return new Promise(resolve => {
    let resposta = null;
    const ocupado = s => lista.some(x => x.disciplina_id === novo.disciplina_id && x.situacao === s && x.id !== novo.id && x.id !== dono.id);
    const opcoes = [['substituto', 'Substituto'], ['afastado', 'Afastado'], ['desligado', 'Desligado'], ['avaliacao', 'Em avaliação']]
      .filter(([s]) => s !== lugar && !(s === 'substituto' && ocupado('substituto')));
    const sel = selecao(opcoes, opcoes[0][0]);
    const m = modalForm({
      titulo: `O lugar de ${lugar} está ocupado`, tamanho: 'pequeno', textoOk: 'Trocar',
      conteudo: [
        h('p', { class: 'confirmar-texto' }, `${dono.nome} já é ${lugar} de ${dono.disciplina_nome}. Para onde ${dono.nome} vai quando ${novo.nome} assumir?`),
        campo(`Nova situação de ${dono.nome}`, sel),
      ],
      aoEnviar: () => { resposta = sel.value; },
    });
    const fechar = m.fechar;
    m.fechar = () => { fechar(); resolve(resposta); };
  });
}

// Afastar, desligar ou voltar à avaliação (com motivo, que fica no histórico).
function escolherSituacao(p, lista, ctx) {
  const opcoes = ['avaliacao', 'afastado', 'desligado'].filter(s => s !== p.situacao).map(s => [s, SIT_PROFESSOR[s][0]]);
  const sel = selecao(opcoes, opcoes[0][0]);
  const motivo = areaTexto('', { maxlength: '300', rows: '2' });
  modalForm({
    titulo: `Situação · ${p.nome}`, tamanho: 'pequeno', textoOk: 'Mudar situação',
    conteudo: [
      h('p', { class: 'form-intro' }, `${p.disciplina_nome}. Hoje: `, etiqueta(SIT_PROFESSOR, p.situacao)),
      campo('Nova situação', sel),
      campo('Motivo', motivo, { ajuda: 'Opcional. Fica no histórico.' }),
    ],
    aoEnviar: async () => {
      await post(`${API}/professores/${p.id}/situacao`, { situacao: sel.value, motivo: motivo.value });
      aviso('Situação atualizada.');
      await ctx.recarregar();
    },
  });
}

function formProfessor(p, disciplinas, ctx, disciplinaInicial = null) {
  const novo = !p;
  const x = p || {};
  let fotoUrl = x.foto || '';
  const envio = { n: 0 };
  const nome = entradaTexto(x.nome, { maxlength: '80', autocomplete: 'off' });
  const endereco = entradaTexto(x.endereco, { maxlength: '60', placeholder: 'O nick, como no Registro de Moradores' });
  const procedencia = entradaTexto(x.procedencia, { maxlength: '80', placeholder: 'Ex.: Vale do Norte, Porto Alvo' });
  const travada = !novo && ['titular', 'substituto'].includes(x.situacao);
  const sel = selecao([['', 'Escolha a disciplina'], ...disciplinas.map(d => [String(d.id), d.nome])], x.disciplina_id ?? disciplinaInicial ?? '', { disabled: travada || null });
  const ingresso = entradaData(x.ingresso || '');
  const obs = areaTexto(x.observacoes, { maxlength: '1000', rows: '3' });
  modalForm({
    titulo: novo ? 'Inscrever professor' : `Editar professor · ${x.nome}`, tamanho: 'medio', textoOk: novo ? 'Inscrever' : 'Salvar',
    conteudo: [
      novo && h('p', { class: 'form-intro' }, 'O professor entra "em avaliação". Depois você escolhe o titular e o substituto de cada disciplina. Quem leciona duas disciplinas se inscreve duas vezes.'),
      h('div', { class: 'form-grade' },
        campo('Nome', nome, { obrigatorio: true }),
        campo('Endereço', endereco, { ajuda: 'O nick dele, como no Tabelionato. Vazio se não tem.' }),
        campo('Vem de (cidade ou região)', procedencia, { ajuda: 'A cidade ou região de onde a pessoa vem, se for de fora de Lyendell.' }),
        campo('Disciplina', sel, { obrigatorio: true, ajuda: travada ? 'Titular e substituto não mudam de disciplina: troque a situação antes.' : null }),
        campo('Data de ingresso', ingresso, { ajuda: novo ? 'Vazio usa o dia de hoje.' : null }),
        h('div', { class: 'campo largo' }, h('span', { class: 'campo-rotulo' }, 'Foto'), entradaImagem(fotoUrl, v => { fotoUrl = v; }, envio)),
        campo('Observações', obs, { classe: 'largo', ajuda: 'Experiência, horários, combinados.' })),
    ],
    aoEnviar: async () => {
      if (envio.n) throw new Error('Espere a foto terminar de enviar.');
      const corpo = { nome: nome.value, endereco: endereco.value, procedencia: procedencia.value, disciplina_id: sel.value, foto: fotoUrl, ingresso: ingresso.value || null, observacoes: obs.value };
      if (novo) await post(`${API}/professores`, corpo); else await put(`${API}/professores/${x.id}`, corpo);
      aviso(novo ? 'Professor inscrito, em avaliação.' : 'Dados atualizados.');
      await ctx.recarregar();
    },
  });
}

async function apagarProfessor(p, ctx) {
  if (!await confirmar(`Apagar ${p.nome} do corpo docente de ${p.disciplina_nome}? Quem já deu aulas não pode ser apagado: mude a situação para desligado.`, { titulo: 'Apagar professor', ok: 'Apagar', perigo: true })) return;
  try {
    await del(`${API}/professores/${p.id}`);
    aviso('Professor apagado.');
    await ctx.recarregar();
  } catch (e) { aviso(e.message, 'erro'); }
}
