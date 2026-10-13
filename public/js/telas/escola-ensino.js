// Escola Luckham: turmas e disciplinas, aulas com chamada e as notas.
import {
  get, post, put, del, h, trocar, icone, botao, campo, aviso, modalForm, confirmar, interruptor, barra, hojeIso, dataCurta,
} from '../core.js';
import {
  API, SIT_AULA, SIT_PRESENCA, etiqueta, notaBr, matriculaNum, plural, painel, tabela, td, foto, agir, selecao,
  areaTexto, entradaData, entradaNumero, entradaTexto, diaLongo, diaCurtoSemana,
} from './escola-comum.js';

const caixaGrande = (...filhos) => h('div', { class: 'escola-vazio-grande' }, ...filhos);

/* ─── 4. Turmas e disciplinas ────────────────────── */

export async function turmas(corpo, ctx) {
  const [{ disciplinas }, { turmas: lista }] = await Promise.all([get(`${API}/disciplinas`), get(`${API}/turmas`)]);
  const gerir = ctx.podes.gerir;

  trocar(corpo,
    painel('Disciplinas', 'livro', disciplinas.length
      ? h('div', { class: 'escola-cartoes' }, disciplinas.map(d => h('article', { class: `escola-cartao ${d.ativa ? '' : 'escola-inativa'}`.trim() },
        h('div', { class: 'escola-cartao-cab' },
          h('h3', null, d.nome),
          d.ativa ? null : h('span', { class: 'etiqueta' }, 'Desativada')),
        d.descricao && h('p', { class: 'suave' }, d.descricao),
        h('dl', { class: 'escola-dl' },
          h('dt', null, 'Titular'), h('dd', null, d.titular ? d.titular.nome : h('em', { class: 'suave' }, 'vaga aberta')),
          h('dt', null, 'Substituto'), h('dd', null, d.substituto ? d.substituto.nome : h('em', { class: 'suave' }, 'vaga aberta')),
          gerir && d.inscritos ? [h('dt', null, 'Inscritos'), h('dd', null, h('a', { href: `#/escola/professores?disciplina=${d.id}` }, `${d.inscritos} em avaliação`))] : null),
        gerir && h('div', { class: 'escola-cartao-acoes' },
          botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formDisciplina(d, ctx) }),
          botao(d.ativa ? 'Desativar' : 'Reativar', { icone: d.ativa ? 'cadeado' : 'check', classe: 'btn-pequeno', onclick: e => alternarDisciplina(d, ctx, e.currentTarget) })))))
      : caixaGrande(h('p', null, 'Nenhuma disciplina cadastrada.'), gerir && botao('Criar a primeira disciplina', { icone: 'mais', classe: 'btn-ouro', onclick: () => formDisciplina(null, ctx) })),
    gerir && botao('Nova disciplina', { icone: 'mais', classe: 'btn-ouro', onclick: () => formDisciplina(null, ctx) })),

    painel('Turmas', 'usuarios', lista.length
      ? h('div', { class: 'escola-cartoes' }, lista.map(t => cartaoTurma(t, gerir, ctx)))
      : caixaGrande(h('p', null, 'Nenhuma turma cadastrada.'), gerir && botao('Criar a primeira turma', { icone: 'mais', classe: 'btn-ouro', onclick: () => formTurma(null, ctx) })),
    gerir && botao('Nova turma', { icone: 'mais', classe: 'btn-ouro', onclick: () => formTurma(null, ctx) })));
}

function cartaoTurma(t, gerir, ctx) {
  const faixa = t.idade_min != null || t.idade_max != null
    ? `${t.idade_min != null && t.idade_max != null ? `${t.idade_min} a ${t.idade_max} anos` : t.idade_min != null ? `a partir de ${t.idade_min} anos` : `até ${t.idade_max} anos`}`
    : '';
  const cheia = t.vagas != null && t.vagas_livres === 0;
  return h('article', { class: `escola-cartao ${t.ativa ? '' : 'escola-inativa'}`.trim() },
    h('div', { class: 'escola-cartao-cab' },
      h('h3', null, t.nome),
      !t.ativa && h('span', { class: 'etiqueta' }, 'Desativada'),
      cheia && t.ativa && h('span', { class: 'etiqueta escola-ruim' }, 'Cheia')),
    t.descricao && h('p', { class: 'suave' }, t.descricao),
    h('dl', { class: 'escola-dl' },
      faixa ? [h('dt', null, 'Idade'), h('dd', null, faixa)] : null,
      t.horario ? [h('dt', null, 'Horário'), h('dd', null, t.horario)] : null,
      t.local ? [h('dt', null, 'Local'), h('dd', null, t.local)] : null,
      h('dt', null, 'Alunos'), h('dd', null, h('a', { href: `#/escola/alunos?turma=${t.id}&situacao=matriculado` }, `${t.alunos} ${t.alunos === 1 ? 'matriculado' : 'matriculados'}`)),
      h('dt', null, 'Vagas'), h('dd', null, t.vagas == null ? 'sem limite' : `${plural(t.vagas_livres, 'livre', 'livres')} de ${t.vagas}`)),
    t.vagas != null && barra(t.alunos, t.vagas),
    gerir && h('div', { class: 'escola-cartao-acoes' },
      botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formTurma(t, ctx) }),
      botao('', { icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto', titulo: 'Apagar turma', onclick: () => apagarTurma(t, ctx) })));
}

function formDisciplina(d, ctx) {
  const novo = !d;
  let ativa = d ? d.ativa : true;
  const nome = entradaTexto(d?.nome, { maxlength: '80' });
  const descricao = areaTexto(d?.descricao, { maxlength: '600', rows: '3' });
  modalForm({
    titulo: novo ? 'Nova disciplina' : `Editar disciplina · ${d.nome}`, tamanho: 'pequeno', textoOk: novo ? 'Criar' : 'Salvar',
    conteudo: [
      campo('Nome', nome, { obrigatorio: true }),
      campo('Descrição', descricao, { ajuda: 'O que se aprende nesta disciplina.' }),
      !novo && interruptor('Disciplina ativa', ativa, v => { ativa = v; }, 'Desativada, ela some da lista de quem não gere a escola.'),
    ],
    aoEnviar: async () => {
      const corpo = { nome: nome.value, descricao: descricao.value, ...(novo ? {} : { ativa }) };
      if (novo) await post(`${API}/disciplinas`, corpo); else await put(`${API}/disciplinas/${d.id}`, corpo);
      aviso(novo ? 'Disciplina criada.' : 'Disciplina atualizada.');
      await ctx.recarregar();
    },
  });
}

async function alternarDisciplina(d, ctx, botaoEl) {
  if (d.ativa && !await confirmar(`Desativar ${d.nome}? Ela deixa de aparecer para quem não gere a escola e não aceita novos professores. Nada é apagado.`, { titulo: 'Desativar disciplina', ok: 'Desativar' })) return;
  const ok = await agir(botaoEl, () => put(`${API}/disciplinas/${d.id}`, { ativa: !d.ativa }), d.ativa ? 'Disciplina desativada.' : 'Disciplina reativada.');
  if (ok) await ctx.recarregar();
}

function formTurma(t, ctx) {
  const novo = !t;
  let ativa = t ? t.ativa : true;
  const nome = entradaTexto(t?.nome, { maxlength: '60' });
  const descricao = areaTexto(t?.descricao, { maxlength: '400', rows: '2' });
  const idMin = entradaNumero(t?.idade_min ?? '', { step: '1', min: '0', max: '120', inputmode: 'numeric' });
  const idMax = entradaNumero(t?.idade_max ?? '', { step: '1', min: '0', max: '120', inputmode: 'numeric' });
  const horario = entradaTexto(t?.horario, { maxlength: '80', placeholder: 'Ex.: segundas e quartas, de manhã' });
  const local = entradaTexto(t?.local, { maxlength: '80', placeholder: 'Ex.: Sala 1 da Escola' });
  const vagas = entradaNumero(t?.vagas ?? '', { step: '1', min: '1', max: '500', inputmode: 'numeric', placeholder: 'Sem limite' });
  modalForm({
    titulo: novo ? 'Nova turma' : `Editar turma · ${t.nome}`, tamanho: 'medio', textoOk: novo ? 'Criar' : 'Salvar',
    conteudo: [
      h('div', { class: 'form-grade' },
        campo('Nome da turma', nome, { obrigatorio: true }),
        campo('Vagas', vagas, { ajuda: t ? `Hoje ${t.alunos} matriculados. Vazio é sem limite.` : 'Vazio é sem limite.' }),
        campo('Idade mínima da turma', idMin),
        campo('Idade máxima da turma', idMax),
        campo('Horário', horario),
        campo('Local', local),
        campo('Descrição', descricao, { classe: 'largo' }),
        !novo && h('div', { class: 'campo largo' }, interruptor('Turma ativa', ativa, v => { ativa = v; }, 'Turma desativada não recebe novos alunos.'))),
    ],
    aoEnviar: async () => {
      const corpo = {
        nome: nome.value, descricao: descricao.value, idade_min: idMin.value, idade_max: idMax.value, horario: horario.value,
        local: local.value, vagas: vagas.value, ...(novo ? {} : { ativa }),
      };
      if (novo) await post(`${API}/turmas`, corpo); else await put(`${API}/turmas/${t.id}`, corpo);
      aviso(novo ? 'Turma criada.' : 'Turma atualizada.');
      await ctx.recarregar();
    },
  });
}

async function apagarTurma(t, ctx) {
  if (!await confirmar(`Apagar a turma ${t.nome}? Turma com alunos ou aulas não pode ser apagada: desative-a.`, { titulo: 'Apagar turma', ok: 'Apagar', perigo: true })) return;
  try { await del(`${API}/turmas/${t.id}`); aviso('Turma apagada.'); await ctx.recarregar(); } catch (e) { aviso(e.message, 'erro'); }
}

/* ─── 5. Aulas ───────────────────────────────────── */

const fAulas = { quando: 'proximas', disciplina: '', turma: '', situacao: '' };

function diaMais(dias) {
  const d = new Date(`${hojeIso()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function aulas(corpo, ctx) {
  const [{ disciplinas }, { turmas: listaTurmas }, { professores }] = await Promise.all([
    get(`${API}/disciplinas`), get(`${API}/turmas`), get(`${API}/professores`)]);
  const lecionar = ctx.podes.lecionar;
  const area = h('div');
  const contador = h('span', { class: 'contador' });

  async function carregar() {
    trocar(area, h('div', { class: 'carregando-tela escola-carregando' }, h('span', { class: 'giro' })));
    const q = new URLSearchParams();
    if (fAulas.quando === 'proximas') q.set('de', hojeIso());
    if (fAulas.quando === 'passadas') q.set('ate', diaMais(-1));
    if (fAulas.disciplina) q.set('disciplina_id', fAulas.disciplina);
    if (fAulas.turma) q.set('turma_id', fAulas.turma);
    if (fAulas.situacao) q.set('situacao', fAulas.situacao);
    try {
      let { aulas: lista } = await get(`${API}/aulas?${q}`);
      // O servidor devolve da mais nova para a mais velha; as próximas aulas ficam melhor em ordem de calendário.
      if (fAulas.quando === 'proximas') lista = [...lista].reverse();
      contador.textContent = plural(lista.length, 'aula', 'aulas');
      trocar(area, tabela(['Quando', 'Aula', 'Turma', 'Professor', 'Situação', ctx.podes.alunos ? 'Chamada' : null, ''].filter(x => x !== null), lista.map(a => linhaAula(a)),
        { vazio: 'Nenhuma aula encontrada com esse filtro.' }));
    } catch (e) {
      trocar(area, h('p', { class: 'form-erro', role: 'alert' }, e.message));
    }
  }

  function linhaAula(a) {
    const c = a.chamada;
    return h('tr', { class: a.situacao === 'cancelada' ? 'escola-linha-cancelada' : null },
      td('Quando', [h('strong', null, diaCurtoSemana(a.data)), h('small', { class: 'suave bloco' }, a.hora || 'sem hora')]),
      td('Aula', [h('strong', null, a.disciplina_nome), h('small', { class: 'suave bloco' }, [a.tema, a.local].filter(Boolean).join(' · ') || 'sem tema')]),
      td('Turma', a.turma_nome || h('span', { class: 'suave' }, 'todas')),
      td('Professor', a.professor_nome || h('span', { class: 'suave' }, 'não definido')),
      td('Situação', etiqueta(SIT_AULA, a.situacao)),
      ctx.podes.alunos ? td('Chamada', c ? h('span', { title: `${c.presentes} presentes, ${c.faltas} faltas, ${c.justificadas} justificadas` }, `${c.presentes}/${c.total} presentes`) : h('span', { class: 'suave' }, 'não feita')) : null,
      h('td', { class: 'acoes-linha' },
        ctx.podes.alunos && a.situacao !== 'cancelada' && h('a', { class: 'btn btn-pequeno', href: `#/escola/aulas/${a.id}` }, lecionar ? (c ? 'Chamada' : 'Fazer chamada') : 'Ver chamada'),
        lecionar && botao('', { icone: 'editar', classe: 'btn-pequeno', titulo: 'Editar aula', onclick: () => formAula(a, { disciplinas, turmas: listaTurmas, professores }, ctx) }),
        lecionar && a.situacao !== 'cancelada' && botao('', { icone: 'x', classe: 'btn-pequeno', titulo: 'Cancelar aula', onclick: e => cancelarAula(a, ctx, e.currentTarget) }),
        ctx.podes.gerir && botao('', { icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto', titulo: 'Apagar aula', onclick: () => apagarAula(a, ctx) })));
  }

  const muda = chave => e => { fAulas[chave] = e.target.value; carregar(); };
  trocar(corpo,
    h('div', { class: 'ferramentas escola-ferramentas' },
      selecao([['proximas', 'Próximas aulas'], ['passadas', 'Aulas passadas'], ['todas', 'Todas']], fAulas.quando, { class: 'input filtro', 'aria-label': 'Período', onchange: muda('quando') }),
      selecao([['', 'Todas as disciplinas'], ...disciplinas.filter(d => d.ativa).map(d => [String(d.id), d.nome])], fAulas.disciplina, { class: 'input filtro', 'aria-label': 'Disciplina', onchange: muda('disciplina') }),
      selecao([['', 'Todas as turmas'], ...listaTurmas.map(t => [String(t.id), t.nome])], fAulas.turma, { class: 'input filtro', 'aria-label': 'Turma', onchange: muda('turma') }),
      selecao([['', 'Qualquer situação'], ['agendada', 'Agendadas'], ['realizada', 'Realizadas'], ['cancelada', 'Canceladas']], fAulas.situacao, { class: 'input filtro', 'aria-label': 'Situação', onchange: muda('situacao') }),
      lecionar && botao('Marcar aula', { icone: 'mais', classe: 'btn-ouro', onclick: () => formAula(null, { disciplinas, turmas: listaTurmas, professores }, ctx) }),
      contador),
    area);
  await carregar();
}

function formAula(a, { disciplinas, turmas: listaTurmas, professores }, ctx) {
  const novo = !a;
  const ativas = disciplinas.filter(d => d.ativa || (a && d.id === a.disciplina_id));
  const disc = selecao([['', 'Escolha a disciplina'], ...ativas.map(d => [String(d.id), d.nome])], a?.disciplina_id ?? '');
  const turma = selecao([['', 'Todas as turmas'], ...listaTurmas.filter(t => t.ativa || (a && t.id === a.turma_id)).map(t => [String(t.id), t.nome])], a?.turma_id ?? '');
  const prof = h('select', { class: 'input' });
  const data = entradaData(a?.data || hojeIso());
  const hora = h('input', { class: 'input', type: 'time', value: a?.hora || '' });
  const tema = entradaTexto(a?.tema, { maxlength: '120', placeholder: 'Ex.: Os reinos de Eldoria' });
  const local = entradaTexto(a?.local, { maxlength: '80' });
  const obs = areaTexto(a?.observacao, { maxlength: '500', rows: '2' });
  const situacao = selecao([['agendada', 'Agendada'], ['realizada', 'Realizada'], ['cancelada', 'Cancelada']], a?.situacao || 'agendada');

  function professoresDaDisciplina() {
    const id = Number(disc.value);
    const deles = professores.filter(p => p.disciplina_id === id && ['titular', 'substituto'].includes(p.situacao));
    // Quem já está na aula aparece mesmo se mudou de situação depois.
    const atual = Number(prof.value) || a?.professor_id || 0;
    trocar(prof,
      h('option', { value: '' }, 'O titular da disciplina (automático)'),
      ...deles.map(p => h('option', { value: String(p.id) }, `${p.nome} (${p.situacao})`)));
    prof.value = deles.some(p => p.id === atual) ? String(atual) : '';
  }
  disc.addEventListener('change', () => { prof.value = ''; professoresDaDisciplina(); });
  professoresDaDisciplina();
  if (a?.professor_id) prof.value = professores.some(p => p.id === a.professor_id && p.disciplina_id === a.disciplina_id) ? String(a.professor_id) : '';

  modalForm({
    titulo: novo ? 'Marcar aula' : `Editar aula · ${a.disciplina_nome}`, tamanho: 'medio', textoOk: novo ? 'Marcar' : 'Salvar',
    conteudo: [
      h('div', { class: 'form-grade' },
        campo('Disciplina', disc, { obrigatorio: true }),
        campo('Turma', turma, { ajuda: 'Sem turma, a aula espera todos os matriculados.' }),
        campo('Dia', data, { obrigatorio: true }),
        campo('Horário', hora),
        campo('Professor', prof),
        campo('Local', local),
        campo('Tema', tema, { classe: 'largo' }),
        novo ? null : campo('Situação', situacao),
        campo('Observação', obs, { classe: 'largo' })),
    ],
    aoEnviar: async () => {
      const corpo = {
        disciplina_id: disc.value, turma_id: turma.value || null, professor_id: prof.value || null, data: data.value, hora: hora.value,
        tema: tema.value, local: local.value, observacao: obs.value, ...(novo ? {} : { situacao: situacao.value }),
      };
      if (novo) await post(`${API}/aulas`, corpo); else await put(`${API}/aulas/${a.id}`, corpo);
      aviso(novo ? 'Aula marcada.' : 'Aula atualizada.');
      await ctx.recarregar();
    },
  });
}

async function cancelarAula(a, ctx, botaoEl) {
  if (!await confirmar(`Cancelar a aula de ${a.disciplina_nome} do dia ${dataCurta(a.data)}? Aula cancelada não tem chamada.`, { titulo: 'Cancelar aula', ok: 'Cancelar aula', perigo: true })) return;
  const ok = await agir(botaoEl, () => put(`${API}/aulas/${a.id}`, { situacao: 'cancelada' }), 'Aula cancelada.');
  if (ok) await ctx.recarregar();
}

async function apagarAula(a, ctx) {
  if (!await confirmar(`Apagar a aula de ${a.disciplina_nome} do dia ${dataCurta(a.data)}? Aula que já teve chamada não pode ser apagada: cancele-a.`, { titulo: 'Apagar aula', ok: 'Apagar', perigo: true })) return;
  try { await del(`${API}/aulas/${a.id}`); aviso('Aula apagada.'); await ctx.recarregar(); } catch (e) { aviso(e.message, 'erro'); }
}

/* ─── 5b. A chamada de uma aula ──────────────────── */

export async function chamada(corpo, ctx, id) {
  const { aula, esperados } = await get(`${API}/aulas/${id}`);
  const podeMarcar = ctx.podes.lecionar && aula.situacao !== 'cancelada';
  // Estado da tela: uma marca por aluno (null = ainda sem marca).
  const marcas = new Map(esperados.map(e => [e.aluno_id, { situacao: e.situacao, observacao: e.observacao || '' }]));
  const resumo = h('div', { class: 'escola-chamada-resumo' });
  const lista = h('div', { class: 'escola-chamada-lista' });
  const salvar = h('button', { class: 'btn btn-ouro', type: 'button' }, icone('check'), h('span', null, 'Salvar chamada'));

  function contar() {
    const c = { presente: 0, falta: 0, justificada: 0, vazio: 0 };
    for (const m of marcas.values()) c[m.situacao || 'vazio']++;
    trocar(resumo,
      h('span', { class: 'etiqueta escola-bom' }, plural(c.presente, 'presente', 'presentes')),
      h('span', { class: 'etiqueta escola-ruim' }, plural(c.falta, 'falta', 'faltas')),
      h('span', { class: 'etiqueta escola-ouro' }, plural(c.justificada, 'justificada', 'justificadas')),
      c.vazio ? h('span', { class: 'etiqueta' }, `${c.vazio} sem marca`) : null);
  }

  function linha(e) {
    const m = marcas.get(e.aluno_id);
    const botoes = h('div', { class: 'escola-marcas', role: 'group', 'aria-label': `Presença de ${e.nome}` });
    const pintar = () => trocar(botoes, Object.entries(SIT_PRESENCA).map(([k, [nome]]) => h('button', {
      type: 'button', class: `escola-marca escola-marca-${k} ${m.situacao === k ? 'ativa' : ''}`.trim(), 'aria-pressed': String(m.situacao === k), disabled: !podeMarcar,
      onclick: () => { m.situacao = m.situacao === k ? null : k; pintar(); contar(); },
    }, nome)));
    pintar();
    e.pintar = pintar;
    return h('div', { class: 'escola-chamada-linha' },
      h('div', { class: 'escola-chamada-aluno' },
        foto(e, 'avatar-m'),
        h('div', null, h('strong', null, e.nome), h('small', { class: 'suave bloco' }, `Matrícula ${matriculaNum(e.numero)}`))),
      botoes,
      h('input', {
        class: 'input input-pequeno escola-chamada-obs', placeholder: 'Observação', maxlength: '200', 'aria-label': `Observação sobre ${e.nome}`, value: m.observacao, disabled: !podeMarcar,
        oninput: ev => { m.observacao = ev.target.value; },
      }));
  }

  salvar.addEventListener('click', async () => {
    const itens = esperados.filter(e => marcas.get(e.aluno_id).situacao).map(e => ({ aluno_id: e.aluno_id, situacao: marcas.get(e.aluno_id).situacao, observacao: marcas.get(e.aluno_id).observacao }));
    if (!itens.length) { aviso('Marque a presença de pelo menos um aluno.', 'erro'); return; }
    const faltam = esperados.length - itens.length;
    if (faltam && !await confirmar(`${plural(faltam, 'aluno está', 'alunos estão')} sem marca e ficarão sem registro nesta aula. Salvar mesmo assim?`, { titulo: 'Alunos sem marca', ok: 'Salvar' })) return;
    const r = await agir(salvar, () => put(`${API}/aulas/${aula.id}/chamada`, { itens }));
    if (r) {
      aviso(`Chamada salva: ${plural(r.presentes, 'presente', 'presentes')}, ${plural(r.faltas, 'falta', 'faltas')}, ${plural(r.justificadas, 'justificada', 'justificadas')}.`);
      await ctx.recarregar();
    }
  });

  trocar(corpo,
    h('a', { class: 'voltar', href: '#/escola/aulas' }, icone('voltar'), 'Voltar às aulas'),
    h('section', { class: 'painel escola-chamada-topo' },
      h('div', null,
        h('h2', null, aula.disciplina_nome),
        h('p', { class: 'escola-chamada-data' }, diaLongo(aula.data), aula.hora && ` às ${aula.hora}`),
        h('p', { class: 'suave' }, [aula.tema, aula.turma_nome || 'Todas as turmas', aula.professor_nome && `com ${aula.professor_nome}`, aula.local].filter(Boolean).join(' · '))),
      etiqueta(SIT_AULA, aula.situacao)),
    aula.situacao === 'cancelada'
      ? h('p', { class: 'nota nota-vermelha' }, icone('alerta'), 'Esta aula foi cancelada: não tem chamada.')
      : !esperados.length
        ? caixaGrande(h('p', null, aula.turma_id ? 'Nenhum aluno matriculado nesta turma.' : 'Nenhum aluno matriculado na escola.'),
          h('a', { class: 'btn', href: '#/escola/alunos' }, 'Ver os alunos'))
        : painel('Chamada', 'tarefas', [
          h('div', { class: 'escola-chamada-barra' }, resumo,
            podeMarcar && botao('Marcar todos presentes', { icone: 'check', onclick: () => {
              for (const m of marcas.values()) m.situacao = 'presente';
              esperados.forEach(e => e.pintar());
              contar();
            } })),
          !ctx.podes.lecionar && h('p', { class: 'nota' }, icone('olho'), 'Você vê a chamada, mas só quem leciona pode marcar.'),
          trocar(lista, esperados.map(linha)),
          podeMarcar && h('div', { class: 'escola-barra-acoes' }, salvar)]));
  contar();
}

/* ─── 6. Notas ───────────────────────────────────── */

const fNotas = { disciplina: '', turma: '' };

export async function notas(corpo, ctx) {
  const [{ disciplinas }, { turmas: listaTurmas }] = await Promise.all([get(`${API}/disciplinas`), get(`${API}/turmas`)]);
  const ativas = disciplinas.filter(d => d.ativa);
  if (!ativas.some(d => String(d.id) === fNotas.disciplina)) fNotas.disciplina = ativas[0] ? String(ativas[0].id) : '';
  const lecionar = ctx.podes.lecionar;
  const area = h('div');
  const { media_aprovacao: mediaMin } = ctx.config;
  let grade = null;
  const novaAvaliacao = botao('Nova avaliação', { icone: 'mais', classe: 'btn-ouro', onclick: () => grade && formAvaliacao(grade, ctx, carregar) });
  novaAvaliacao.disabled = true;

  async function carregar() {
    novaAvaliacao.disabled = true;
    if (!fNotas.disciplina) { trocar(area, caixaGrande(h('p', null, 'Cadastre uma disciplina para lançar notas.'))); return; }
    trocar(area, h('div', { class: 'carregando-tela escola-carregando' }, h('span', { class: 'giro' })));
    try {
      grade = await get(`${API}/notas/grade?disciplina_id=${fNotas.disciplina}${fNotas.turma ? `&turma_id=${fNotas.turma}` : ''}`);
      novaAvaliacao.disabled = !grade.alunos.length;
      if (!grade.alunos.length) {
        trocar(area, caixaGrande(h('p', null, 'Nenhum aluno matriculado nesta turma.'), h('a', { class: 'btn', href: '#/escola/alunos' }, 'Ver os alunos')));
        return;
      }
      const cabecalhos = [...grade.avaliacoes.map(v => `${v.titulo}`), 'Média'];
      trocar(area,
        !grade.avaliacoes.length && h('p', { class: 'nota' }, icone('alerta'), lecionar ? 'Nenhuma avaliação lançada ainda. Use "Nova avaliação" para começar.' : 'Nenhuma avaliação lançada ainda.'),
        tabela(['Aluno', ...cabecalhos], grade.alunos.map(al => h('tr', null,
          td('Aluno', h('div', { class: 'escola-nota-aluno' }, foto(al, 'avatar-p'), h('a', { href: `#/escola/alunos/${al.aluno_id}` }, h('strong', null, al.nome)))),
          ...grade.avaliacoes.map(v => td(`${v.titulo}${Number(v.peso) !== 1 ? ` (peso ${notaBr(v.peso)})` : ''}`, celulaNota(al, v))),
          td('Média', h('strong', { class: al.media != null && al.media < mediaMin ? 'escola-ruim-texto' : al.media != null ? 'escola-bom-texto' : '' }, notaBr(al.media)))))),
        grade.avaliacoes.length ? h('p', { class: 'suave escola-legenda' }, `Média ponderada pelo peso de cada avaliação. Para passar: ${notaBr(mediaMin)}.${lecionar ? ' Toque numa nota para corrigir ou apagar.' : ''}`) : null);
    } catch (e) {
      trocar(area, h('p', { class: 'form-erro', role: 'alert' }, e.message));
    }
  }

  function celulaNota(al, v) {
    const n = al.notas[v.titulo];
    const rotulo = n ? notaBr(n.nota) : '-';
    if (!lecionar) return h('span', { class: n ? '' : 'suave' }, rotulo);
    return h('button', {
      type: 'button', class: `escola-nota-celula ${n ? '' : 'vazia'}`.trim(), title: n ? 'Corrigir ou apagar esta nota' : 'Lançar a nota deste aluno',
      onclick: () => (n ? formNota(al, v, n, carregar) : formNotaNova(al, v, grade, carregar)),
    }, rotulo);
  }

  const mudar = chave => e => { fNotas[chave] = e.target.value; carregar(); };
  trocar(corpo,
    h('div', { class: 'ferramentas escola-ferramentas' },
      selecao(ativas.length ? ativas.map(d => [String(d.id), d.nome]) : [['', 'Sem disciplinas']], fNotas.disciplina, { class: 'input filtro', 'aria-label': 'Disciplina', onchange: mudar('disciplina') }),
      selecao([['', 'Todos os matriculados'], ...listaTurmas.map(t => [String(t.id), t.nome])], fNotas.turma, { class: 'input filtro', 'aria-label': 'Turma', onchange: mudar('turma') }),
      lecionar && novaAvaliacao),
    area);
  await carregar();
}

const campoNota = (valor, attrs = {}) => entradaNumero(valor ?? '', { step: '0.1', min: '0', max: '10', inputmode: 'decimal', placeholder: '0 a 10', ...attrs });

// Lança uma avaliação para vários alunos de uma vez.
function formAvaliacao(grade, ctx, recarregar) {
  const titulo = entradaTexto('', { maxlength: '80', placeholder: 'Ex.: Prova 1' });
  const data = entradaData(hojeIso());
  const peso = entradaNumero(1, { step: '0.1', min: '0.1', max: '10', inputmode: 'decimal' });
  const campos = grade.alunos.map(al => ({ al, entrada: campoNota('', { 'aria-label': `Nota de ${al.nome}` }) }));
  modalForm({
    titulo: `Nova avaliação · ${grade.disciplina.nome}`, tamanho: 'medio', textoOk: 'Lançar notas',
    conteudo: [
      h('p', { class: 'form-intro' }, 'Deixe em branco a nota de quem faltou: ele fica sem nota nesta avaliação. Notas de 0 a 10.'),
      h('div', { class: 'form-grade' },
        campo('Nome da avaliação', titulo, { obrigatorio: true }),
        campo('Dia', data),
        campo('Peso', peso, { ajuda: 'De 0,1 a 10. Prova vale mais que trabalho.' })),
      h('div', { class: 'escola-notas-form' }, campos.map(({ al, entrada }) => h('label', { class: 'escola-notas-linha' },
        h('span', { class: 'escola-nota-aluno' }, foto(al, 'avatar-p'), h('span', null, al.nome)), entrada))),
    ],
    aoEnviar: async () => {
      const r = await post(`${API}/notas`, {
        disciplina_id: grade.disciplina.id, titulo: titulo.value, data: data.value, peso: peso.value,
        notas: campos.map(({ al, entrada }) => ({ aluno_id: al.aluno_id, nota: entrada.value })),
      });
      aviso(`${plural(r.criadas, 'nota lançada', 'notas lançadas')}.`);
      await recarregar();
    },
  });
}

// Nota de um aluno que ainda não tem esta avaliação (entrou depois, por exemplo).
function formNotaNova(al, v, grade, recarregar) {
  const nota = campoNota('');
  modalForm({
    titulo: `${v.titulo} · ${al.nome}`, tamanho: 'pequeno', textoOk: 'Lançar',
    conteudo: [h('p', { class: 'form-intro' }, `${al.nome} ainda não tem a nota de "${v.titulo}" em ${grade.disciplina.nome}.`), campo('Nota', nota, { obrigatorio: true })],
    aoEnviar: async () => {
      await post(`${API}/notas`, { disciplina_id: grade.disciplina.id, titulo: v.titulo, data: v.data, peso: v.peso, notas: [{ aluno_id: al.aluno_id, nota: nota.value }] });
      aviso('Nota lançada.');
      await recarregar();
    },
  });
}

function formNota(al, v, n, recarregar) {
  const nota = campoNota(String(n.nota).replace('.', ','), { type: 'text', inputmode: 'decimal' });
  const apagar = botao('Apagar nota', { icone: 'lixo', classe: 'btn-perigo-texto', onclick: async () => {
    if (!await confirmar(`Apagar a nota de ${al.nome} em "${v.titulo}"?`, { titulo: 'Apagar nota', ok: 'Apagar', perigo: true })) return;
    try { await del(`${API}/notas/${n.id}`); aviso('Nota apagada.'); m.fechar(); await recarregar(); } catch (e) { aviso(e.message, 'erro'); }
  } });
  const m = modalForm({
    titulo: `${v.titulo} · ${al.nome}`, tamanho: 'pequeno', textoOk: 'Salvar', extraRodape: apagar,
    conteudo: [campo('Nota (0 a 10)', nota, { obrigatorio: true })],
    aoEnviar: async () => {
      await put(`${API}/notas/${n.id}`, { nota: nota.value });
      aviso('Nota corrigida.');
      await recarregar();
    },
  });
}
