// A Escola Luckham: um sistema próprio (fora do Tabelionato) para dirigir a escola.
//   escola.ver       ver a escola: disciplinas, professores titulares e substitutos, turmas e calendário (todo morador);
//   escola.alunos    ver os alunos, as matrículas, a frequência e o boletim (Diretor, Professor, Família Nobre);
//   escola.lecionar  fazer a chamada das aulas e lançar notas (Diretor, Professor, Família Nobre);
//   escola.gerir     matricular, inscrever professores, criar disciplinas, turmas e aulas, configurar (Diretor da Escola).
// Regras: um titular e um substituto por disciplina; a escola aceita só a faixa de idade da configuração (padrão
// 1 a 16 anos); a mesma pessoa não se matricula duas vezes; turma cheia não aceita mais ninguém; aula cancelada
// não tem chamada. Tudo o que muda fica no histórico (escola_historico) e no diário do sistema.
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { anotar } = require('../diario');
const { urlValida } = require('../uploads');
const { hoje } = require('../cobranca');
const { erro, texto, linha, chaveNome, idDaRota, dataValida } = require('../util');
const E = require('../escola');

const r = express.Router();
r.use(exigirLogin, exigir('escola.ver'));

const veAlunos = req => pode(req, 'escola.alunos') || pode(req, 'escola.gerir');
const leciona = req => pode(req, 'escola.lecionar') || pode(req, 'escola.gerir');
const exigirAlunos = (req, res, next) => next(veAlunos(req) ? undefined : erro(403, 'Você não tem permissão para ver os alunos.'));
const exigirLeciona = (req, res, next) => next(leciona(req) ? undefined : erro(403, 'Você não tem permissão para isso.'));
const gerir = exigir('escola.gerir');

const SITUACOES_ALUNO = ['em_analise', 'matriculado', 'afastado', 'concluido', 'desligado'];
const SITUACOES_PROFESSOR = ['avaliacao', 'titular', 'substituto', 'afastado', 'desligado'];
const SITUACOES_PRESENCA = ['presente', 'falta', 'justificada'];
const quem = req => req.usuario.nome;

// Tudo o que muda na escola vai para o histórico (e, nas coisas maiores, para o diário do sistema).
async function hist(req, entidade, id, acao, detalhe, diario = true) {
  await db.run('INSERT INTO escola_historico (entidade, entidade_id, acao, detalhe, usuario_nome) VALUES (?, ?, ?, ?, ?)', entidade, id ?? null, acao, String(detalhe).slice(0, 400), quem(req));
  if (diario) await anotar(req, `Escola: ${acao}`, detalhe);
}

async function buscar(tabela, id, nome) {
  const l = await db.get(`SELECT * FROM ${tabela} WHERE id = ?`, id);
  if (!l) throw erro(404, `${nome} não encontrado.`);
  return l;
}
const diaOu = (v, nome) => { const d = dataValida(v); if (!d) throw erro(400, `Informe ${nome} (dia, mês e ano).`); return d; };
const horaValida = v => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '');
const fotoOu = (v, atual = null) => (v === undefined ? atual : (urlValida(v) ? v : null));
function inteiroOuNulo(v, { min = 0, max = 1000, nome = 'O número' } = {}) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw erro(400, `${nome} precisa ser um número inteiro de ${min} a ${max}.`);
  return n;
}

/* ─── Painel e configuração ──────────────────────── */

const CAMPOS_PUBLICOS_CONFIG = ['nome', 'diretor', 'idade_min', 'idade_max', 'media_aprovacao', 'frequencia_minima', 'lema', 'edital_alunos', 'edital_professores', 'selecao', 'como_inscrever', 'rodape'];

async function disciplinasComProfessores(req) {
  const disciplinas = await db.all('SELECT * FROM escola_disciplinas ORDER BY ativa DESC, ordem, nome');
  const professores = await db.all("SELECT * FROM escola_professores WHERE situacao IN ('titular', 'substituto', 'avaliacao') ORDER BY id");
  const pessoa = p => (p ? { id: p.id, nome: p.nome, endereco: p.endereco, foto: p.foto, ingresso: p.ingresso } : null);
  return disciplinas.filter(d => d.ativa || pode(req, 'escola.gerir')).map(d => ({
    id: d.id, nome: d.nome, descricao: d.descricao, ativa: !!d.ativa, ordem: d.ordem,
    titular: pessoa(professores.find(p => p.disciplina_id === d.id && p.situacao === 'titular')),
    substituto: pessoa(professores.find(p => p.disciplina_id === d.id && p.situacao === 'substituto')),
    inscritos: pode(req, 'escola.gerir') ? professores.filter(p => p.disciplina_id === d.id && p.situacao === 'avaliacao').length : null,
  }));
}

async function turmasComContagem(req) {
  const turmas = await db.all('SELECT * FROM escola_turmas ORDER BY ativa DESC, ordem, nome');
  const conta = new Map((await db.all("SELECT turma_id, COUNT(*) AS n FROM escola_alunos WHERE situacao = 'matriculado' AND turma_id IS NOT NULL GROUP BY turma_id")).map(x => [x.turma_id, Number(x.n)]));
  return turmas.filter(t => t.ativa || pode(req, 'escola.gerir')).map(t => ({
    ...t, ativa: !!t.ativa, alunos: conta.get(t.id) || 0, vagas_livres: t.vagas == null ? null : Math.max(0, t.vagas - (conta.get(t.id) || 0)),
  }));
}

async function listaDeAulas(req, { id, de, ate, disciplina_id, turma_id, situacao, limite = 300 } = {}) {
  const cond = [];
  const args = [];
  if (id) { cond.push('a.id = ?'); args.push(id); }
  if (de) { cond.push('a.data >= ?'); args.push(de); }
  if (ate) { cond.push('a.data <= ?'); args.push(ate); }
  if (disciplina_id) { cond.push('a.disciplina_id = ?'); args.push(disciplina_id); }
  if (turma_id) { cond.push('a.turma_id = ?'); args.push(turma_id); }
  if (situacao) { cond.push('a.situacao = ?'); args.push(situacao); }
  const aulas = await db.all(`SELECT a.*, d.nome AS disciplina_nome, t.nome AS turma_nome, p.nome AS professor_nome
    FROM escola_aulas a JOIN escola_disciplinas d ON d.id = a.disciplina_id LEFT JOIN escola_turmas t ON t.id = a.turma_id LEFT JOIN escola_professores p ON p.id = a.professor_id
    ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY a.data DESC, a.hora DESC, a.id DESC LIMIT ${Number(limite)}`, ...args);
  if (!veAlunos(req) || !aulas.length) return aulas.map(a => ({ ...a, chamada: null }));
  const marcas = aulas.map(() => '?').join(',');
  const linhas = await db.all(`SELECT aula_id, situacao, COUNT(*) AS n FROM escola_presencas WHERE aula_id IN (${marcas}) GROUP BY aula_id, situacao`, ...aulas.map(a => a.id));
  return aulas.map(a => {
    const mine = linhas.filter(l => l.aula_id === a.id);
    const c = (s) => Number(mine.find(l => l.situacao === s)?.n || 0);
    const total = c('presente') + c('falta') + c('justificada');
    return { ...a, chamada: total ? { presentes: c('presente'), faltas: c('falta'), justificadas: c('justificada'), total } : null };
  });
}

r.get('/painel', async (req, res) => {
  const config = await E.lerConfig();
  const disciplinas = await disciplinasComProfessores(req);
  const ativas = disciplinas.filter(d => d.ativa);
  const out = {
    config: Object.fromEntries(CAMPOS_PUBLICOS_CONFIG.map(k => [k, config[k]])),
    disciplinas: ativas,
    numeros: { disciplinas: ativas.length, com_titular: ativas.filter(d => d.titular).length, turmas: (await turmasComContagem(req)).filter(t => t.ativa).length },
    proximas_aulas: (await listaDeAulas(req, { de: hoje(), situacao: 'agendada', limite: 200 })).reverse().slice(0, 6),
    podes: { alunos: veAlunos(req), lecionar: leciona(req), gerir: pode(req, 'escola.gerir') },
  };
  if (veAlunos(req)) {
    const c = Object.fromEntries((await db.all('SELECT situacao, COUNT(*) AS n FROM escola_alunos GROUP BY situacao')).map(x => [x.situacao, Number(x.n)]));
    out.alunos = { matriculados: c.matriculado || 0, em_analise: c.em_analise || 0, afastados: c.afastado || 0, concluidos: c.concluido || 0, desligados: c.desligado || 0 };
    const sem = await db.get("SELECT COUNT(*) AS n FROM escola_alunos WHERE situacao = 'matriculado' AND turma_id IS NULL");
    out.alunos.sem_turma = Number(sem.n);
  }
  if (pode(req, 'escola.gerir')) {
    out.pendencias = {
      inscritos_professores: Number((await db.get("SELECT COUNT(*) AS n FROM escola_professores WHERE situacao = 'avaliacao'")).n),
      alunos_em_analise: out.alunos.em_analise,
      disciplinas_sem_titular: ativas.filter(d => !d.titular).map(d => ({ id: d.id, nome: d.nome, inscritos: d.inscritos })),
    };
  }
  res.json(out);
});

r.get('/config', async (req, res) => {
  const config = await E.lerConfig();
  res.json({ config: pode(req, 'escola.gerir') ? config : Object.fromEntries(CAMPOS_PUBLICOS_CONFIG.map(k => [k, config[k]])) });
});

r.put('/config', gerir, async (req, res) => {
  const antes = await E.lerConfig();
  const b = req.body || {};
  const num = (k, min, max, nome) => (b[k] === undefined || b[k] === '' ? antes[k] : (() => {
    const n = Number(String(b[k]).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) throw erro(400, `${nome} precisa ser um número entre ${min} e ${max}.`);
    return n;
  })());
  const config = {
    ...antes,
    nome: b.nome === undefined ? antes.nome : (linha(b.nome, 60) || antes.nome),
    diretor: b.diretor === undefined ? antes.diretor : linha(b.diretor, 80),
    idade_min: Math.round(num('idade_min', 0, 120, 'A idade mínima')),
    idade_max: Math.round(num('idade_max', 0, 120, 'A idade máxima')),
    media_aprovacao: num('media_aprovacao', 0, 10, 'A média de aprovação'),
    frequencia_minima: Math.round(num('frequencia_minima', 0, 100, 'A frequência mínima')),
  };
  if (config.idade_min > config.idade_max) throw erro(400, 'A idade mínima não pode ser maior que a máxima.');
  for (const k of ['lema', 'edital_alunos', 'edital_professores', 'selecao', 'como_inscrever', 'rodape']) {
    config[k] = b[k] === undefined ? antes[k] : texto(b[k], 1500);
  }
  await db.run("INSERT INTO meta (chave, valor) VALUES ('escola_config', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor", JSON.stringify(config));
  await hist(req, 'config', null, 'mudou as configurações', 'Configurações da escola');
  res.json({ config });
});

/* ─── Disciplinas ────────────────────────────────── */

r.get('/disciplinas', async (req, res) => res.json({ disciplinas: await disciplinasComProfessores(req) }));

function lerDisciplina(body, atual = {}) {
  const d = {
    nome: linha(body?.nome ?? atual.nome, 80),
    descricao: texto(body?.descricao ?? atual.descricao ?? '', 600),
    ativa: body?.ativa !== undefined ? (body.ativa ? 1 : 0) : (atual.ativa ?? 1),
  };
  if (d.nome.length < 2) throw erro(400, 'Dê um nome para a disciplina.');
  return d;
}

r.post('/disciplinas', gerir, async (req, res) => {
  const d = lerDisciplina(req.body);
  if (await db.get('SELECT id FROM escola_disciplinas WHERE chave = ?', chaveNome(d.nome))) throw erro(409, 'Já existe uma disciplina com esse nome.');
  const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM escola_disciplinas');
  const { id } = await db.run('INSERT INTO escola_disciplinas (nome, chave, descricao, ativa, ordem, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)', d.nome, chaveNome(d.nome), d.descricao, d.ativa, ordem + 1, quem(req));
  await hist(req, 'disciplina', id, 'criou a disciplina', d.nome);
  res.status(201).json({ id });
});

r.put('/disciplinas/:id', gerir, async (req, res) => {
  const atual = await buscar('escola_disciplinas', idDaRota(req), 'Disciplina');
  const d = lerDisciplina(req.body, atual);
  if (await db.get('SELECT id FROM escola_disciplinas WHERE chave = ? AND id <> ?', chaveNome(d.nome), atual.id)) throw erro(409, 'Já existe uma disciplina com esse nome.');
  await db.run('UPDATE escola_disciplinas SET nome = ?, chave = ?, descricao = ?, ativa = ? WHERE id = ?', d.nome, chaveNome(d.nome), d.descricao, d.ativa, atual.id);
  await hist(req, 'disciplina', atual.id, 'mudou a disciplina', d.nome !== atual.nome ? `${atual.nome} virou ${d.nome}` : d.nome, false);
  res.json({ ok: true });
});

/* ─── Professores ────────────────────────────────── */

r.get('/professores', async (req, res) => {
  const todos = pode(req, 'escola.gerir');
  const linhas = await db.all(`SELECT p.*, d.nome AS disciplina_nome FROM escola_professores p JOIN escola_disciplinas d ON d.id = p.disciplina_id
    ${todos ? '' : "WHERE p.situacao IN ('titular', 'substituto')"} ORDER BY d.ordem, d.nome, CASE p.situacao WHEN 'titular' THEN 0 WHEN 'substituto' THEN 1 WHEN 'avaliacao' THEN 2 WHEN 'afastado' THEN 3 ELSE 4 END, p.nome`);
  res.json({
    professores: linhas.map(p => ({
      id: p.id, disciplina_id: p.disciplina_id, disciplina_nome: p.disciplina_nome, nome: p.nome, endereco: p.endereco, foto: p.foto, situacao: p.situacao, ingresso: p.ingresso,
      ...(todos ? { observacoes: p.observacoes, origem_registro_id: p.origem_registro_id } : {}),
    })),
  });
});

async function lerProfessor(body, atual = {}) {
  const p = {
    nome: linha(body?.nome ?? atual.nome, 80),
    endereco: linha(body?.endereco ?? atual.endereco ?? '', 60),
    disciplina_id: Number(body?.disciplina_id ?? atual.disciplina_id) || 0,
    foto: fotoOu(body?.foto, atual.foto ?? null),
    ingresso: body?.ingresso === undefined ? (atual.ingresso ?? null) : (body.ingresso ? diaOu(body.ingresso, 'a data de ingresso') : null),
    observacoes: texto(body?.observacoes ?? atual.observacoes ?? '', 1000),
  };
  if (p.nome.length < 2) throw erro(400, 'Informe o nome do professor.');
  const d = await db.get('SELECT id, ativa FROM escola_disciplinas WHERE id = ?', p.disciplina_id);
  if (!d) throw erro(400, 'Escolha a disciplina.');
  if (!d.ativa && p.disciplina_id !== atual.disciplina_id) throw erro(400, 'Esta disciplina está desativada.');
  return p;
}

// A inscrição de um professor (começa "em avaliação"; o Diretor escolhe titular e substituto depois).
r.post('/professores', gerir, async (req, res) => {
  const p = await lerProfessor(req.body);
  const igual = await db.get("SELECT id FROM escola_professores WHERE disciplina_id = ? AND situacao <> 'desligado' AND ((? <> '' AND lower(endereco) = lower(?)) OR lower(nome) = lower(?))", p.disciplina_id, p.endereco, p.endereco, p.nome);
  if (igual) throw erro(409, `${p.nome} já está inscrito nesta disciplina.`);
  const { id } = await db.run(`INSERT INTO escola_professores (disciplina_id, nome, endereco, foto, situacao, ingresso, observacoes, criado_por_nome) VALUES (?, ?, ?, ?, 'avaliacao', ?, ?, ?)`,
    p.disciplina_id, p.nome, p.endereco, p.foto, p.ingresso || hoje(), p.observacoes, quem(req));
  const d = await db.get('SELECT nome FROM escola_disciplinas WHERE id = ?', p.disciplina_id);
  await hist(req, 'professor', id, 'inscreveu o professor', `${p.nome} em ${d.nome}`);
  res.status(201).json({ id });
});

r.put('/professores/:id', gerir, async (req, res) => {
  const atual = await buscar('escola_professores', idDaRota(req), 'Professor');
  const p = await lerProfessor(req.body, atual);
  if (p.disciplina_id !== atual.disciplina_id && ['titular', 'substituto'].includes(atual.situacao)) {
    throw erro(409, 'Quem é titular ou substituto não muda de disciplina: troque a situação antes.');
  }
  await db.run("UPDATE escola_professores SET disciplina_id = ?, nome = ?, endereco = ?, foto = ?, ingresso = ?, observacoes = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?",
    p.disciplina_id, p.nome, p.endereco, p.foto, p.ingresso, p.observacoes, quem(req), atual.id);
  await hist(req, 'professor', atual.id, 'mudou os dados do professor', p.nome, false);
  res.json({ ok: true });
});

// Muda a situação (titular, substituto, em avaliação, afastado, desligado). Se o lugar de titular (ou de
// substituto) já tem dono, é preciso dizer para onde ele vai ("trocar"), senão volta 409 com quem ocupa.
r.post('/professores/:id/situacao', gerir, async (req, res) => {
  const p = await buscar('escola_professores', idDaRota(req), 'Professor');
  const nova = req.body?.situacao;
  if (!SITUACOES_PROFESSOR.includes(nova)) throw erro(400, 'Situação inválida.');
  if (nova === p.situacao) throw erro(409, 'O professor já está nessa situação.');
  const d = await db.get('SELECT nome FROM escola_disciplinas WHERE id = ?', p.disciplina_id);
  const comandos = [];
  let trocado = null;
  if (nova === 'titular' || nova === 'substituto') {
    const ocupante = await db.get('SELECT * FROM escola_professores WHERE disciplina_id = ? AND situacao = ? AND id <> ?', p.disciplina_id, nova, p.id);
    if (ocupante) {
      const destino = req.body?.trocar;
      if (!destino) throw erro(409, `${ocupante.nome} já é ${nova} de ${d.nome}. Escolha para onde ${ocupante.nome} vai (substituto, afastado, desligado ou em avaliação).`);
      if (!SITUACOES_PROFESSOR.includes(destino) || destino === nova) throw erro(400, 'Destino inválido para quem sai do lugar.');
      if (destino === 'substituto' || destino === 'titular') {
        // O destino também é um lugar único: o ocupante vai para lá se estiver livre (ou for o próprio professor que sobe).
        const donoDoDestino = await db.get('SELECT id FROM escola_professores WHERE disciplina_id = ? AND situacao = ? AND id <> ? AND id <> ?', p.disciplina_id, destino, ocupante.id, p.id);
        if (donoDoDestino) throw erro(409, `O lugar de ${destino} já está ocupado. Escolha outro destino.`);
      }
      comandos.push(["UPDATE escola_professores SET situacao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?", destino, quem(req), ocupante.id]);
      trocado = { id: ocupante.id, nome: ocupante.nome, para: destino };
    }
  }
  // Quem estava num lugar único e sai libera o lugar antes de o outro entrar (a ordem importa por causa do índice único).
  comandos.push(["UPDATE escola_professores SET situacao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?", nova, quem(req), p.id]);
  try {
    await db.lote(comandos);
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw erro(409, 'Alguém acabou de ocupar esse lugar. Recarregue e tente de novo.');
    throw e;
  }
  const motivo = texto(req.body?.motivo, 300);
  await hist(req, 'professor', p.id, 'mudou a situação do professor', `${p.nome} em ${d.nome}: ${p.situacao} para ${nova}${trocado ? `; ${trocado.nome} foi para ${trocado.para}` : ''}${motivo ? `. ${motivo}` : ''}`);
  res.json({ ok: true, trocado });
});

r.delete('/professores/:id', gerir, async (req, res) => {
  const p = await buscar('escola_professores', idDaRota(req), 'Professor');
  if ((await db.get('SELECT COUNT(*) AS n FROM escola_aulas WHERE professor_id = ?', p.id)).n) throw erro(409, 'Este professor já deu aulas. Em vez de apagar, mude a situação para desligado.');
  if (['titular', 'substituto'].includes(p.situacao)) throw erro(409, 'Troque a situação antes de apagar quem é titular ou substituto.');
  await db.run('DELETE FROM escola_professores WHERE id = ?', p.id);
  await hist(req, 'professor', p.id, 'apagou o professor', p.nome);
  res.json({ ok: true });
});

/* ─── Turmas ─────────────────────────────────────── */

r.get('/turmas', async (req, res) => res.json({ turmas: await turmasComContagem(req) }));

function lerTurma(body, atual = {}) {
  const t = {
    nome: linha(body?.nome ?? atual.nome, 60),
    descricao: texto(body?.descricao ?? atual.descricao ?? '', 400),
    idade_min: body?.idade_min === undefined ? (atual.idade_min ?? null) : inteiroOuNulo(body.idade_min, { max: 120, nome: 'A idade mínima da turma' }),
    idade_max: body?.idade_max === undefined ? (atual.idade_max ?? null) : inteiroOuNulo(body.idade_max, { max: 120, nome: 'A idade máxima da turma' }),
    horario: linha(body?.horario ?? atual.horario ?? '', 80),
    local: linha(body?.local ?? atual.local ?? '', 80),
    vagas: body?.vagas === undefined ? (atual.vagas ?? null) : inteiroOuNulo(body.vagas, { min: 1, max: 500, nome: 'As vagas' }),
    ativa: body?.ativa !== undefined ? (body.ativa ? 1 : 0) : (atual.ativa ?? 1),
  };
  if (t.nome.length < 2) throw erro(400, 'Dê um nome para a turma.');
  if (t.idade_min != null && t.idade_max != null && t.idade_min > t.idade_max) throw erro(400, 'A idade mínima da turma não pode ser maior que a máxima.');
  return t;
}

r.post('/turmas', gerir, async (req, res) => {
  const t = lerTurma(req.body);
  if (await db.get('SELECT id FROM escola_turmas WHERE lower(nome) = lower(?)', t.nome)) throw erro(409, 'Já existe uma turma com esse nome.');
  const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM escola_turmas');
  const { id } = await db.run('INSERT INTO escola_turmas (nome, descricao, idade_min, idade_max, horario, local, vagas, ativa, ordem, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    t.nome, t.descricao, t.idade_min, t.idade_max, t.horario, t.local, t.vagas, t.ativa, ordem + 1, quem(req));
  await hist(req, 'turma', id, 'criou a turma', t.nome);
  res.status(201).json({ id });
});

r.put('/turmas/:id', gerir, async (req, res) => {
  const atual = await buscar('escola_turmas', idDaRota(req), 'Turma');
  const t = lerTurma(req.body, atual);
  if (await db.get('SELECT id FROM escola_turmas WHERE lower(nome) = lower(?) AND id <> ?', t.nome, atual.id)) throw erro(409, 'Já existe uma turma com esse nome.');
  const matriculados = Number((await db.get("SELECT COUNT(*) AS n FROM escola_alunos WHERE turma_id = ? AND situacao = 'matriculado'", atual.id)).n);
  if (t.vagas != null && t.vagas < matriculados) throw erro(409, `A turma já tem ${matriculados} alunos matriculados: as vagas não podem ser menos que isso.`);
  await db.run('UPDATE escola_turmas SET nome = ?, descricao = ?, idade_min = ?, idade_max = ?, horario = ?, local = ?, vagas = ?, ativa = ? WHERE id = ?',
    t.nome, t.descricao, t.idade_min, t.idade_max, t.horario, t.local, t.vagas, t.ativa, atual.id);
  await hist(req, 'turma', atual.id, 'mudou a turma', t.nome, false);
  res.json({ ok: true });
});

r.delete('/turmas/:id', gerir, async (req, res) => {
  const t = await buscar('escola_turmas', idDaRota(req), 'Turma');
  const alunos = Number((await db.get('SELECT COUNT(*) AS n FROM escola_alunos WHERE turma_id = ?', t.id)).n);
  const aulas = Number((await db.get('SELECT COUNT(*) AS n FROM escola_aulas WHERE turma_id = ?', t.id)).n);
  if (alunos || aulas) throw erro(409, 'Esta turma tem alunos ou aulas. Em vez de apagar, desative a turma.');
  await db.run('DELETE FROM escola_turmas WHERE id = ?', t.id);
  await hist(req, 'turma', t.id, 'apagou a turma', t.nome);
  res.json({ ok: true });
});

/* ─── Alunos ─────────────────────────────────────── */

const alunoPublico = (a, extra = {}) => ({
  id: a.id, numero: a.numero, nome: a.nome, endereco: a.endereco, foto: a.foto, idade: a.idade, responsavel_nome: a.responsavel_nome, responsavel_endereco: a.responsavel_endereco,
  turma_id: a.turma_id, turma_nome: a.turma_nome ?? null, situacao: a.situacao, data_matricula: a.data_matricula, etapa: a.etapa, ...extra,
});

r.get('/alunos', exigirAlunos, async (req, res) => {
  const cond = [];
  const args = [];
  if (SITUACOES_ALUNO.includes(req.query.situacao)) { cond.push('a.situacao = ?'); args.push(req.query.situacao); }
  if (Number(req.query.turma_id)) { cond.push('a.turma_id = ?'); args.push(Number(req.query.turma_id)); }
  if (req.query.turma_id === 'sem') cond.push('a.turma_id IS NULL');
  const alunos = await db.all(`SELECT a.*, t.nome AS turma_nome FROM escola_alunos a LEFT JOIN escola_turmas t ON t.id = a.turma_id
    ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY CASE a.situacao WHEN 'em_analise' THEN 0 WHEN 'matriculado' THEN 1 WHEN 'afastado' THEN 2 WHEN 'concluido' THEN 3 ELSE 4 END, a.nome`, ...args);
  const q = chaveNome(req.query.q || '');
  const freq = await E.frequenciaDeTodos();
  const medias = await E.mediasDeTodos();
  const contagem = Object.fromEntries((await db.all('SELECT situacao, COUNT(*) AS n FROM escola_alunos GROUP BY situacao')).map(x => [x.situacao, Number(x.n)]));
  res.json({
    alunos: alunos.filter(a => !q || chaveNome(`${a.nome} ${a.endereco} ${a.responsavel_nome} ${a.numero ?? ''}`).includes(q)).map(a => alunoPublico(a, {
      frequencia: freq.get(a.id) ? { percentual: freq.get(a.id).percentual, total: freq.get(a.id).total } : null, media: medias.get(a.id) ?? null,
    })),
    contagem,
  });
});

async function lerAluno(body, atual = {}, config) {
  const a = {
    nome: linha(body?.nome ?? atual.nome, 80),
    endereco: linha(body?.endereco ?? atual.endereco ?? '', 60),
    foto: fotoOu(body?.foto, atual.foto ?? null),
    idade: body?.idade === undefined ? (atual.idade ?? null) : inteiroOuNulo(body.idade, { max: 120, nome: 'A idade' }),
    responsavel_nome: linha(body?.responsavel_nome ?? atual.responsavel_nome ?? '', 80),
    responsavel_endereco: linha(body?.responsavel_endereco ?? atual.responsavel_endereco ?? '', 60),
    turma_id: body?.turma_id === undefined ? (atual.turma_id ?? null) : (body.turma_id ? Number(body.turma_id) : null),
    data_matricula: body?.data_matricula === undefined ? (atual.data_matricula ?? null) : (body.data_matricula ? diaOu(body.data_matricula, 'a data da matrícula') : null),
    etapa: texto(body?.etapa ?? atual.etapa ?? '', 400),
    observacoes: texto(body?.observacoes ?? atual.observacoes ?? '', 2000),
  };
  if (a.nome.length < 2) throw erro(400, 'Informe o nome do aluno.');
  if (a.idade == null) throw erro(400, 'Informe a idade do aluno.');
  // A faixa de idade da escola vale ao matricular e quando a idade é mudada (não impede mexer em outros dados de quem fez aniversário).
  if (a.idade !== (atual.idade ?? null) && (a.idade < Number(config.idade_min) || a.idade > Number(config.idade_max))) {
    throw erro(400, `A ${config.nome} aceita alunos de ${config.idade_min} a ${config.idade_max} anos (isso muda em Configurações).`);
  }
  if (a.turma_id != null) {
    const t = await db.get('SELECT id, ativa FROM escola_turmas WHERE id = ?', a.turma_id);
    if (!t) throw erro(400, 'Essa turma não existe.');
    if (!t.ativa && a.turma_id !== atual.turma_id) throw erro(400, 'Essa turma está desativada.');
  }
  return a;
}

async function conferirDuplicado(a, exceto = 0) {
  const lista = await db.all("SELECT id, nome, endereco FROM escola_alunos WHERE situacao NOT IN ('desligado') AND id <> ?", exceto);
  const dup = lista.find(x => (a.endereco && x.endereco && chaveNome(x.endereco) === chaveNome(a.endereco)) || chaveNome(x.nome) === chaveNome(a.nome));
  if (dup) throw erro(409, `${dup.nome} já está na escola${dup.endereco ? ` (endereço ${dup.endereco})` : ''}. A mesma pessoa não se matricula duas vezes.`);
}

async function conferirVaga(turmaId, exceto = 0) {
  if (turmaId == null) return;
  const t = await db.get('SELECT nome, vagas FROM escola_turmas WHERE id = ?', turmaId);
  if (t?.vagas == null) return;
  const n = Number((await db.get("SELECT COUNT(*) AS n FROM escola_alunos WHERE turma_id = ? AND situacao = 'matriculado' AND id <> ?", turmaId, exceto)).n);
  if (n >= t.vagas) throw erro(409, `A turma ${t.nome} está cheia (${t.vagas} vagas).`);
}

// Dá o número da matrícula (corrido, sem buracos) a quem ainda não tem.
const daNumero = id => db.run('UPDATE escola_alunos SET numero = (SELECT COALESCE(MAX(numero), 0) + 1 FROM escola_alunos) WHERE id = ? AND numero IS NULL', id);

r.post('/alunos', gerir, async (req, res) => {
  const config = await E.lerConfig();
  const a = await lerAluno(req.body, {}, config);
  const situacao = req.body?.situacao === 'em_analise' ? 'em_analise' : 'matriculado';
  await conferirDuplicado(a);
  if (situacao === 'matriculado') await conferirVaga(a.turma_id);
  const { id } = await db.run(`INSERT INTO escola_alunos (nome, endereco, foto, idade, responsavel_nome, responsavel_endereco, turma_id, situacao, data_matricula, etapa, observacoes, criado_por_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  a.nome, a.endereco, a.foto, a.idade, a.responsavel_nome, a.responsavel_endereco, a.turma_id, situacao, situacao === 'matriculado' ? (a.data_matricula || hoje()) : a.data_matricula, a.etapa, a.observacoes, quem(req));
  if (situacao === 'matriculado') await daNumero(id);
  const { numero } = await db.get('SELECT numero FROM escola_alunos WHERE id = ?', id);
  await hist(req, 'aluno', id, situacao === 'matriculado' ? 'matriculou o aluno' : 'recebeu a inscrição do aluno', `${a.nome}${numero ? ` (matrícula nº ${numero})` : ''}`);
  res.status(201).json({ id, numero });
});

r.get('/alunos/:id', exigirAlunos, async (req, res) => {
  const a = await db.get('SELECT a.*, t.nome AS turma_nome FROM escola_alunos a LEFT JOIN escola_turmas t ON t.id = a.turma_id WHERE a.id = ?', idDaRota(req));
  if (!a) throw erro(404, 'Aluno não encontrado.');
  const config = await E.lerConfig();
  res.json({
    aluno: { ...alunoPublico(a), observacoes: a.observacoes, criado_por_nome: a.criado_por_nome, criado_em: a.criado_em, origem_registro_id: a.origem_registro_id },
    frequencia: await E.frequenciaDe(a.id),
    boletim: await E.boletimDe(a.id, config),
    presencas: await db.all(`SELECT p.situacao, p.observacao, au.data, au.hora, au.tema, d.nome AS disciplina_nome FROM escola_presencas p JOIN escola_aulas au ON au.id = p.aula_id
      JOIN escola_disciplinas d ON d.id = au.disciplina_id WHERE p.aluno_id = ? AND au.situacao <> 'cancelada' ORDER BY au.data DESC, au.id DESC LIMIT 40`, a.id),
    historico: pode(req, 'escola.gerir') ? await db.all("SELECT acao, detalhe, usuario_nome, criado_em FROM escola_historico WHERE entidade = 'aluno' AND entidade_id = ? ORDER BY id DESC LIMIT 60", a.id) : [],
    config: { media_aprovacao: Number(config.media_aprovacao), frequencia_minima: Number(config.frequencia_minima), nome: config.nome },
  });
});

r.put('/alunos/:id', gerir, async (req, res) => {
  const atual = await buscar('escola_alunos', idDaRota(req), 'Aluno');
  const config = await E.lerConfig();
  const a = await lerAluno(req.body, atual, config);
  if (chaveNome(a.nome) !== chaveNome(atual.nome) || chaveNome(a.endereco) !== chaveNome(atual.endereco)) await conferirDuplicado(a, atual.id);
  if (a.turma_id !== atual.turma_id && atual.situacao === 'matriculado') await conferirVaga(a.turma_id, atual.id);
  await db.run(`UPDATE escola_alunos SET nome = ?, endereco = ?, foto = ?, idade = ?, responsavel_nome = ?, responsavel_endereco = ?, turma_id = ?, data_matricula = ?, etapa = ?, observacoes = ?,
    atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
  a.nome, a.endereco, a.foto, a.idade, a.responsavel_nome, a.responsavel_endereco, a.turma_id, a.data_matricula, a.etapa, a.observacoes, quem(req), atual.id);
  const mudou = [];
  if (a.turma_id !== atual.turma_id) mudou.push('turma');
  if (a.idade !== atual.idade) mudou.push(`idade ${atual.idade ?? '?'} para ${a.idade}`);
  await hist(req, 'aluno', atual.id, 'mudou a ficha do aluno', `${a.nome}${mudou.length ? `: ${mudou.join(', ')}` : ''}`, false);
  res.json({ ok: true });
});

// Matricular quem estava em análise, afastar, concluir, desligar ou reativar. Afastar e desligar pedem o motivo.
r.post('/alunos/:id/situacao', gerir, async (req, res) => {
  const a = await buscar('escola_alunos', idDaRota(req), 'Aluno');
  const nova = req.body?.situacao;
  if (!SITUACOES_ALUNO.includes(nova)) throw erro(400, 'Situação inválida.');
  if (nova === a.situacao) throw erro(409, 'O aluno já está nessa situação.');
  const motivo = texto(req.body?.motivo, 300);
  if (['afastado', 'desligado'].includes(nova) && motivo.length < 3) throw erro(400, 'Diga o motivo (fica no histórico).');
  if (nova === 'matriculado') await conferirVaga(a.turma_id, a.id);
  await db.run("UPDATE escola_alunos SET situacao = ?, data_matricula = COALESCE(data_matricula, ?), atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?", nova, hoje(), quem(req), a.id);
  if (nova === 'matriculado') await daNumero(a.id);
  const { numero } = await db.get('SELECT numero FROM escola_alunos WHERE id = ?', a.id);
  await hist(req, 'aluno', a.id, 'mudou a situação do aluno', `${a.nome}: ${a.situacao} para ${nova}${motivo ? `. ${motivo}` : ''}`);
  res.json({ ok: true, numero });
});

r.delete('/alunos/:id', gerir, async (req, res) => {
  const a = await buscar('escola_alunos', idDaRota(req), 'Aluno');
  const usos = Number((await db.get('SELECT (SELECT COUNT(*) FROM escola_presencas WHERE aluno_id = ?) + (SELECT COUNT(*) FROM escola_notas WHERE aluno_id = ?) AS n', a.id, a.id)).n);
  if (usos) throw erro(409, 'Este aluno já tem frequência ou notas. Em vez de apagar, mude a situação para desligado.');
  await db.run('DELETE FROM escola_alunos WHERE id = ?', a.id);
  await hist(req, 'aluno', a.id, 'apagou a ficha do aluno', a.nome);
  res.json({ ok: true });
});

/* ─── Aulas e chamada ────────────────────────────── */

r.get('/aulas', async (req, res) => {
  res.json({
    aulas: await listaDeAulas(req, {
      de: dataValida(req.query.de) || null, ate: dataValida(req.query.ate) || null,
      disciplina_id: Number(req.query.disciplina_id) || 0, turma_id: Number(req.query.turma_id) || 0,
      situacao: ['agendada', 'realizada', 'cancelada'].includes(req.query.situacao) ? req.query.situacao : null,
    }),
  });
});

async function lerAula(body, atual = {}) {
  const a = {
    disciplina_id: Number(body?.disciplina_id ?? atual.disciplina_id) || 0,
    turma_id: body?.turma_id === undefined ? (atual.turma_id ?? null) : (body.turma_id ? Number(body.turma_id) : null),
    professor_id: body?.professor_id === undefined ? (atual.professor_id ?? null) : (body.professor_id ? Number(body.professor_id) : null),
    data: body?.data === undefined && atual.data ? atual.data : diaOu(body?.data, 'o dia da aula'),
    hora: body?.hora === undefined ? (atual.hora ?? '') : horaValida(body.hora),
    tema: linha(body?.tema ?? atual.tema ?? '', 120),
    local: linha(body?.local ?? atual.local ?? '', 80),
    observacao: texto(body?.observacao ?? atual.observacao ?? '', 500),
    situacao: ['agendada', 'realizada', 'cancelada'].includes(body?.situacao) ? body.situacao : (atual.situacao || 'agendada'),
  };
  if (!await db.get('SELECT id FROM escola_disciplinas WHERE id = ?', a.disciplina_id)) throw erro(400, 'Escolha a disciplina da aula.');
  if (a.turma_id != null && !await db.get('SELECT id FROM escola_turmas WHERE id = ?', a.turma_id)) throw erro(400, 'Essa turma não existe.');
  if (a.professor_id != null) {
    const p = await db.get('SELECT disciplina_id FROM escola_professores WHERE id = ?', a.professor_id);
    if (!p) throw erro(400, 'Esse professor não existe.');
    if (p.disciplina_id !== a.disciplina_id) throw erro(400, 'Esse professor não é dessa disciplina.');
  }
  return a;
}

r.post('/aulas', exigirLeciona, async (req, res) => {
  const a = await lerAula(req.body);
  // Sem professor escolhido, a aula é do titular da disciplina (se houver).
  if (a.professor_id == null) a.professor_id = (await db.get("SELECT id FROM escola_professores WHERE disciplina_id = ? AND situacao = 'titular'", a.disciplina_id))?.id ?? null;
  const { id } = await db.run('INSERT INTO escola_aulas (disciplina_id, turma_id, professor_id, data, hora, tema, local, situacao, observacao, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    a.disciplina_id, a.turma_id, a.professor_id, a.data, a.hora, a.tema, a.local, a.situacao === 'cancelada' ? 'cancelada' : 'agendada', a.observacao, quem(req));
  const d = await db.get('SELECT nome FROM escola_disciplinas WHERE id = ?', a.disciplina_id);
  await hist(req, 'aula', id, 'marcou a aula', `${d.nome} em ${a.data}${a.hora ? ` às ${a.hora}` : ''}`, false);
  res.status(201).json({ id });
});

// Os alunos que a aula espera: os matriculados da turma (ou todos os matriculados, se a aula não tem turma),
// mais quem já tem presença anotada (mesmo se saiu da turma depois).
async function esperadosDaAula(aula) {
  const base = aula.turma_id
    ? await db.all("SELECT id, numero, nome, foto FROM escola_alunos WHERE situacao = 'matriculado' AND turma_id = ? ORDER BY nome", aula.turma_id)
    : await db.all("SELECT id, numero, nome, foto FROM escola_alunos WHERE situacao = 'matriculado' ORDER BY nome");
  const marcas = new Map((await db.all('SELECT aluno_id, situacao, observacao FROM escola_presencas WHERE aula_id = ?', aula.id)).map(p => [p.aluno_id, p]));
  const extras = [...marcas.keys()].filter(id => !base.some(b => b.id === id));
  const outros = extras.length ? await db.all(`SELECT id, numero, nome, foto FROM escola_alunos WHERE id IN (${extras.map(() => '?').join(',')}) ORDER BY nome`, ...extras) : [];
  return [...base, ...outros].map(al => ({ aluno_id: al.id, numero: al.numero, nome: al.nome, foto: al.foto, situacao: marcas.get(al.id)?.situacao ?? null, observacao: marcas.get(al.id)?.observacao ?? '' }));
}

r.get('/aulas/:id', exigirAlunos, async (req, res) => {
  const aula = (await listaDeAulas(req, { id: idDaRota(req) }))[0];
  if (!aula) throw erro(404, 'Aula não encontrada.');
  res.json({ aula, esperados: await esperadosDaAula(aula) });
});

r.put('/aulas/:id', exigirLeciona, async (req, res) => {
  const atual = await buscar('escola_aulas', idDaRota(req), 'Aula');
  const a = await lerAula(req.body, atual);
  if (a.situacao === 'cancelada' && (await db.get('SELECT COUNT(*) AS n FROM escola_presencas WHERE aula_id = ?', atual.id)).n) throw erro(409, 'Esta aula já tem chamada. Apague a chamada (zerando as presenças) antes de cancelar.');
  await db.run('UPDATE escola_aulas SET disciplina_id = ?, turma_id = ?, professor_id = ?, data = ?, hora = ?, tema = ?, local = ?, situacao = ?, observacao = ? WHERE id = ?',
    a.disciplina_id, a.turma_id, a.professor_id, a.data, a.hora, a.tema, a.local, a.situacao, a.observacao, atual.id);
  await hist(req, 'aula', atual.id, a.situacao !== atual.situacao ? `marcou a aula como ${a.situacao}` : 'mudou a aula', `${a.data}${a.tema ? `: ${a.tema}` : ''}`, false);
  res.json({ ok: true });
});

r.delete('/aulas/:id', gerir, async (req, res) => {
  const a = await buscar('escola_aulas', idDaRota(req), 'Aula');
  if ((await db.get('SELECT COUNT(*) AS n FROM escola_presencas WHERE aula_id = ?', a.id)).n) throw erro(409, 'Esta aula já tem chamada. Em vez de apagar, cancele a aula.');
  await db.run('DELETE FROM escola_aulas WHERE id = ?', a.id);
  await hist(req, 'aula', a.id, 'apagou a aula', a.data, false);
  res.json({ ok: true });
});

// A chamada: uma lista de { aluno_id, situacao, observacao }. Dá para refazer (a última vale) e a aula vira "realizada".
r.put('/aulas/:id/chamada', exigirLeciona, async (req, res) => {
  const aula = await buscar('escola_aulas', idDaRota(req), 'Aula');
  if (aula.situacao === 'cancelada') throw erro(409, 'Esta aula foi cancelada: não tem chamada.');
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  if (!itens.length) throw erro(400, 'Marque a presença de pelo menos um aluno.');
  const esperados = new Set((await esperadosDaAula(aula)).map(e => e.aluno_id));
  const comandos = [];
  for (const it of itens) {
    const alunoId = Number(it?.aluno_id);
    if (!esperados.has(alunoId)) throw erro(400, 'Esse aluno não é desta aula (confira a turma e se ele está matriculado).');
    if (!SITUACOES_PRESENCA.includes(it?.situacao)) throw erro(400, 'Situação de presença inválida: presente, falta ou justificada.');
    comandos.push([`INSERT INTO escola_presencas (aula_id, aluno_id, situacao, observacao, registrado_por_nome) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (aula_id, aluno_id) DO UPDATE SET situacao = excluded.situacao, observacao = excluded.observacao, registrado_por_nome = excluded.registrado_por_nome, registrado_em = datetime('now')`,
    aula.id, alunoId, it.situacao, linha(it.observacao ?? '', 200), quem(req)]);
  }
  comandos.push(["UPDATE escola_aulas SET situacao = 'realizada' WHERE id = ?", aula.id]);
  await db.lote(comandos);
  const c = (s) => itens.filter(i => i.situacao === s).length;
  await hist(req, 'aula', aula.id, 'fez a chamada', `${aula.data}: ${c('presente')} presentes, ${c('falta')} faltas, ${c('justificada')} justificadas`, false);
  res.json({ ok: true, presentes: c('presente'), faltas: c('falta'), justificadas: c('justificada') });
});

/* ─── Notas e boletim ────────────────────────────── */

r.get('/alunos/:id/boletim', exigirAlunos, async (req, res) => {
  const a = await buscar('escola_alunos', idDaRota(req), 'Aluno');
  const config = await E.lerConfig();
  res.json({ aluno: alunoPublico(a), boletim: await E.boletimDe(a.id, config), frequencia: await E.frequenciaDe(a.id), config: { nome: config.nome, media_aprovacao: Number(config.media_aprovacao), frequencia_minima: Number(config.frequencia_minima), diretor: config.diretor } });
});

function lerNota(v, nome = 'A nota') {
  const n = Number(String(v).replace(',', '.'));
  if (v === '' || v == null || !Number.isFinite(n) || n < 0 || n > 10) throw erro(400, `${nome} precisa ser um número de 0 a 10.`);
  return Math.round(n * 10) / 10;
}
function lerPeso(v) {
  if (v === '' || v == null) return 1;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0.1 || n > 10) throw erro(400, 'O peso precisa ser um número de 0,1 a 10.');
  return Math.round(n * 10) / 10;
}

// A grade de uma disciplina numa turma: as avaliações já lançadas (colunas) e a nota de cada aluno (linhas).
r.get('/notas/grade', exigirAlunos, async (req, res) => {
  const disciplinaId = Number(req.query.disciplina_id) || 0;
  const turmaId = Number(req.query.turma_id) || 0;
  const d = await db.get('SELECT id, nome FROM escola_disciplinas WHERE id = ?', disciplinaId);
  if (!d) throw erro(400, 'Escolha a disciplina.');
  const alunos = turmaId
    ? await db.all("SELECT id, numero, nome, foto FROM escola_alunos WHERE situacao = 'matriculado' AND turma_id = ? ORDER BY nome", turmaId)
    : await db.all("SELECT id, numero, nome, foto FROM escola_alunos WHERE situacao = 'matriculado' ORDER BY nome");
  const notas = alunos.length ? await db.all(`SELECT * FROM escola_notas WHERE disciplina_id = ? AND aluno_id IN (${alunos.map(() => '?').join(',')}) ORDER BY data, id`, disciplinaId, ...alunos.map(a => a.id)) : [];
  const avaliacoes = [];
  for (const n of notas) if (!avaliacoes.some(a => chaveNome(a.titulo) === chaveNome(n.titulo))) avaliacoes.push({ titulo: n.titulo, data: n.data, peso: n.peso });
  res.json({
    disciplina: d, avaliacoes,
    alunos: alunos.map(a => ({
      aluno_id: a.id, numero: a.numero, nome: a.nome, foto: a.foto,
      notas: Object.fromEntries(notas.filter(n => n.aluno_id === a.id).map(n => [n.titulo, { id: n.id, nota: n.nota }])),
      media: E.mediaPonderada(notas.filter(n => n.aluno_id === a.id)),
    })),
  });
});

// Lança uma avaliação para vários alunos de uma vez: { disciplina_id, titulo, data, peso, notas: [{ aluno_id, nota, observacao }] }.
r.post('/notas', exigirLeciona, async (req, res) => {
  const b = req.body || {};
  const d = await db.get('SELECT id, nome FROM escola_disciplinas WHERE id = ?', Number(b.disciplina_id) || 0);
  if (!d) throw erro(400, 'Escolha a disciplina.');
  const titulo = linha(b.titulo, 80);
  if (titulo.length < 2) throw erro(400, 'Dê um nome para a avaliação (ex.: Prova 1).');
  const data = b.data ? diaOu(b.data, 'o dia da avaliação') : hoje();
  const peso = lerPeso(b.peso);
  const lista = Array.isArray(b.notas) ? b.notas.filter(n => n && n.nota !== '' && n.nota != null) : [];
  if (!lista.length) throw erro(400, 'Lance a nota de pelo menos um aluno.');
  const comandos = [];
  for (const n of lista) {
    const al = await db.get("SELECT id, nome FROM escola_alunos WHERE id = ? AND situacao IN ('matriculado', 'afastado', 'concluido')", Number(n.aluno_id) || 0);
    if (!al) throw erro(400, 'Aluno não encontrado ou fora da escola.');
    const jaTem = (await db.all('SELECT titulo FROM escola_notas WHERE aluno_id = ? AND disciplina_id = ?', al.id, d.id)).some(x => chaveNome(x.titulo) === chaveNome(titulo));
    if (jaTem) throw erro(409, `${al.nome} já tem a avaliação "${titulo}" em ${d.nome}. Para corrigir, edite a nota.`);
    comandos.push(['INSERT INTO escola_notas (aluno_id, disciplina_id, titulo, data, nota, peso, observacao, lancado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      al.id, d.id, titulo, data, lerNota(n.nota, `A nota de ${al.nome}`), peso, linha(n.observacao ?? '', 200), quem(req)]);
  }
  await db.lote(comandos);
  await hist(req, 'nota', null, 'lançou notas', `${titulo} em ${d.nome}: ${comandos.length} ${comandos.length === 1 ? 'aluno' : 'alunos'}`);
  res.status(201).json({ criadas: comandos.length });
});

r.put('/notas/:id', exigirLeciona, async (req, res) => {
  const atual = await buscar('escola_notas', idDaRota(req), 'Nota');
  const b = req.body || {};
  const nota = b.nota === undefined ? atual.nota : lerNota(b.nota);
  const peso = b.peso === undefined ? atual.peso : lerPeso(b.peso);
  const titulo = b.titulo === undefined ? atual.titulo : linha(b.titulo, 80);
  if (titulo.length < 2) throw erro(400, 'Dê um nome para a avaliação.');
  const data = b.data === undefined ? atual.data : diaOu(b.data, 'o dia da avaliação');
  await db.run('UPDATE escola_notas SET nota = ?, peso = ?, titulo = ?, data = ?, observacao = ? WHERE id = ?', nota, peso, titulo, data, b.observacao === undefined ? atual.observacao : linha(b.observacao, 200), atual.id);
  const al = await db.get('SELECT nome FROM escola_alunos WHERE id = ?', atual.aluno_id);
  await hist(req, 'nota', atual.id, 'corrigiu uma nota', `${al?.nome}: ${titulo}, de ${atual.nota} para ${nota}`);
  res.json({ ok: true });
});

r.delete('/notas/:id', exigirLeciona, async (req, res) => {
  const n = await buscar('escola_notas', idDaRota(req), 'Nota');
  const al = await db.get('SELECT nome FROM escola_alunos WHERE id = ?', n.aluno_id);
  await db.run('DELETE FROM escola_notas WHERE id = ?', n.id);
  await hist(req, 'nota', n.id, 'apagou uma nota', `${al?.nome}: ${n.titulo} (${n.nota})`);
  res.json({ ok: true });
});

/* ─── Histórico ──────────────────────────────────── */

r.get('/historico', gerir, async (req, res) => {
  const cond = [];
  const args = [];
  if (typeof req.query.entidade === 'string' && /^[a-z_]{3,20}$/.test(req.query.entidade)) { cond.push('entidade = ?'); args.push(req.query.entidade); }
  if (Number(req.query.id)) { cond.push('entidade_id = ?'); args.push(Number(req.query.id)); }
  res.json({ historico: await db.all(`SELECT * FROM escola_historico ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 300`, ...args) });
});

module.exports = r;
