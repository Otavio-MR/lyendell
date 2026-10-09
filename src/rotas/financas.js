// Gestão Financeira (Folha de Pagamento) da Capital. Tudo aqui pede permissão no servidor:
//   financas.ver      ver o painel, as folhas, o tesouro e os relatórios (Mestre da Moeda e Família Nobre);
//   financas.gerir    cadastrar profissões, valores, vínculos, presenças, entregas, ajustes e movimentações;
//   financas.aprovar  fechar a folha (aprovar ou rejeitar), pagar e estornar;
//   financas.excecao  autorizar pagamento ou saída acima do saldo disponível (com justificativa).
// Nada é apagado em silêncio: corrigir pede justificativa e fica na auditoria (financas_auditoria).
const express = require('express');
const { db } = require('../db');
const { exigirLogin, exigir, pode } = require('../auth');
const { erro, texto, linha, chaveNome, idDaRota, dataValida } = require('../util');
const F = require('../financas');

const { r2, json, SITUACOES_PRESENCA, UNIDADES, diasDaFrequencia, auditar } = F;

const r = express.Router();
r.use(exigirLogin, exigir('financas.ver'));

const gerir = exigir('financas.gerir');
const aprovar = exigir('financas.aprovar');

/* ─── Leitura dos campos ─────────────────────────── */

function numero(v, { min = 0, max = 1e7, nome = 'O valor' } = {}) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw erro(400, `${nome} precisa ser um número entre ${min} e ${max}.`);
  return r2(n);
}
function data(v, nome = 'a data') {
  const d = dataValida(v);
  if (!d) throw erro(400, `Informe ${nome} (dia, mês e ano).`);
  return d;
}
function justificativa(body, obrigatoria = true) {
  const j = texto(body?.justificativa, 500);
  if (obrigatoria && j.length < 5) throw erro(400, 'Escreva a justificativa (pelo menos 5 letras): ela fica no histórico.');
  return j || null;
}
// Autorização excepcional: só quem tem financas.excecao, e sempre com justificativa.
function excecao(req, motivoDoBloqueio) {
  const j = texto(req.body?.excecao_justificativa, 500);
  if (!pode(req, 'financas.excecao')) throw erro(409, `${motivoDoBloqueio} Só quem pode autorizar pagamento excepcional libera isso.`);
  if (j.length < 5) throw erro(409, `${motivoDoBloqueio} Para autorizar mesmo assim, escreva a justificativa da exceção.`);
  return { justificativa: j, por: req.usuario.nome, em: new Date().toISOString() };
}
const quem = req => req.usuario.nome;

async function buscar(tabela, id, nome) {
  const l = await db.get(`SELECT * FROM ${tabela} WHERE id = ?`, id);
  if (!l) throw erro(404, `${nome} não encontrado.`);
  return l;
}
// O período de uma presença ou entrega já está numa folha (fechada ou em revisão)?
async function periodoFechado(dia) {
  return db.get("SELECT id, situacao FROM folhas WHERE situacao <> 'rejeitada' AND inicio <= ? AND fim >= ? LIMIT 1", dia, dia);
}

/* ─── Painel ─────────────────────────────────────── */

r.get('/painel', async (req, res) => {
  const tesouro = await F.resumoTesouro();
  const config = await F.lerConfig();
  const n = async (sql, ...a) => (await db.get(sql, ...a)).n;
  res.json({
    tesouro, config,
    contagens: {
      vinculos_ativos: await n("SELECT COUNT(*) AS n FROM vinculos WHERE situacao = 'ativo'"),
      trabalhadores: await n("SELECT COUNT(DISTINCT registro_id) AS n FROM vinculos WHERE situacao = 'ativo'"),
      entregas_pendentes: await n("SELECT COUNT(*) AS n FROM entregas WHERE situacao = 'pendente'"),
      folhas_revisao: await n("SELECT COUNT(*) AS n FROM folhas WHERE situacao = 'revisao'"),
      folhas_a_pagar: await n("SELECT COUNT(*) AS n FROM folhas WHERE situacao = 'aprovada'"),
      profissoes_demonstracao: await n("SELECT COUNT(*) AS n FROM profissoes WHERE demonstracao = 1 AND ativa = 1 AND remuneracao = 'fixo'"),
      itens_demonstracao: await n('SELECT COUNT(*) AS n FROM producao_itens WHERE demonstracao = 1 AND ativo = 1'),
    },
    ultimas_folhas: (await db.all('SELECT id FROM folhas ORDER BY id DESC LIMIT 5')).map(f => f.id),
    movimentos: await db.all('SELECT * FROM tesouro_movimentos ORDER BY id DESC LIMIT 8'),
    podes: { gerir: pode(req, 'financas.gerir'), aprovar: pode(req, 'financas.aprovar'), excecao: pode(req, 'financas.excecao') },
  });
});

/* ─── Configurações ──────────────────────────────── */

r.get('/config', async (req, res) => res.json({ config: await F.lerConfig() }));

r.put('/config', gerir, async (req, res) => {
  const antes = await F.lerConfig();
  const config = {
    ...antes,
    teto_folha: numero(req.body?.teto_folha, { nome: 'O teto da folha' }) ?? antes.teto_folha,
    reserva: numero(req.body?.reserva, { nome: 'A reserva' }) ?? antes.reserva,
    frequencia_padrao: diasDaFrequencia(req.body?.frequencia_padrao) ? req.body.frequencia_padrao : antes.frequencia_padrao,
  };
  await db.run("INSERT INTO meta (chave, valor) VALUES ('financas_config', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor", JSON.stringify(config));
  await auditar(req, 'config', null, 'editar', { antes, depois: config, justificativa: justificativa(req.body, false), diario: 'Mudou as configurações da Gestão Financeira' });
  res.json({ config });
});

/* ─── Profissões e tabela de valores ─────────────── */

async function listarProfissoes() {
  const profissoes = await db.all('SELECT * FROM profissoes ORDER BY ativa DESC, ordem, nome');
  const itens = await db.all('SELECT * FROM producao_itens ORDER BY ativo DESC, nome');
  const vinculos = await db.all("SELECT profissao_id, COUNT(*) AS n FROM vinculos WHERE situacao = 'ativo' GROUP BY profissao_id");
  const nVinc = new Map(vinculos.map(v => [v.profissao_id, v.n]));
  return profissoes.map(p => ({
    ...p, proporcional: !!p.proporcional, justificada_conta: !!p.justificada_conta, demonstracao: !!p.demonstracao, ativa: !!p.ativa,
    vinculos_ativos: nVinc.get(p.id) || 0,
    itens: itens.filter(i => i.profissao_id === p.id).map(i => ({ ...i, ativo: !!i.ativo, demonstracao: !!i.demonstracao })),
  }));
}

function lerProfissao(body, antes = null) {
  const p = {
    nome: linha(body?.nome ?? antes?.nome, 60),
    remuneracao: ['fixo', 'producao'].includes(body?.remuneracao) ? body.remuneracao : antes?.remuneracao || 'fixo',
    salario_base: numero(body?.salario_base, { nome: 'O salário-base' }) ?? antes?.salario_base ?? 0,
    frequencia: body?.frequencia != null ? String(body.frequencia) : antes?.frequencia || 'semanal',
    turnos_previstos: body?.turnos_previstos != null ? Math.round(numero(body.turnos_previstos, { min: 1, max: 100, nome: 'Os turnos previstos' })) : antes?.turnos_previstos ?? 5,
    proporcional: body?.proporcional != null ? (body.proporcional ? 1 : 0) : antes?.proporcional ?? 1,
    justificada_conta: body?.justificada_conta != null ? (body.justificada_conta ? 1 : 0) : antes?.justificada_conta ?? 0,
    regra: body?.regra != null ? texto(body.regra, 300) : antes?.regra || '',
    ativa: body?.ativa != null ? (body.ativa ? 1 : 0) : antes?.ativa ?? 1,
  };
  if (p.nome.length < 2) throw erro(400, 'Dê um nome para a profissão.');
  if (!diasDaFrequencia(p.frequencia)) throw erro(400, 'Frequência inválida: use semanal, quinzenal, mensal ou um número de dias.');
  return p;
}

r.get('/profissoes', async (req, res) => res.json({ profissoes: await listarProfissoes(), unidades: UNIDADES }));

r.post('/profissoes', gerir, async (req, res) => {
  const p = lerProfissao(req.body);
  if (await db.get('SELECT id FROM profissoes WHERE chave = ?', chaveNome(p.nome))) throw erro(409, 'Já existe uma profissão com esse nome.');
  const { ordem } = await db.get('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM profissoes');
  const { id } = await db.run(`INSERT INTO profissoes (nome, chave, remuneracao, salario_base, frequencia, turnos_previstos, proporcional, justificada_conta, regra, ativa, ordem, criado_por_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  p.nome, chaveNome(p.nome), p.remuneracao, p.salario_base, p.frequencia, p.turnos_previstos, p.proporcional, p.justificada_conta, p.regra, p.ativa, ordem + 1, quem(req));
  await auditar(req, 'profissao', id, 'criar', { depois: p, diario: `Criou a profissão ${p.nome}` });
  res.status(201).json({ id });
});

r.put('/profissoes/:id', gerir, async (req, res) => {
  const id = idDaRota(req);
  const antes = await buscar('profissoes', id, 'Profissão');
  const p = lerProfissao(req.body, antes);
  if (p.remuneracao !== antes.remuneracao && (await db.get('SELECT COUNT(*) AS n FROM vinculos WHERE profissao_id = ?', id)).n) {
    throw erro(409, 'Esta profissão já tem vínculos: não dá para trocar entre salário fixo e produção. Crie outra profissão.');
  }
  const outra = await db.get('SELECT id FROM profissoes WHERE chave = ? AND id <> ?', chaveNome(p.nome), id);
  if (outra) throw erro(409, 'Já existe uma profissão com esse nome.');
  // Mexer no salário (ou dizer que conferiu) tira a marca de "demonstração".
  const demonstracao = req.body?.demonstracao != null ? (req.body.demonstracao ? 1 : 0)
    : (p.salario_base !== antes.salario_base ? 0 : antes.demonstracao);
  await db.run(`UPDATE profissoes SET nome = ?, chave = ?, remuneracao = ?, salario_base = ?, frequencia = ?, turnos_previstos = ?, proporcional = ?,
    justificada_conta = ?, regra = ?, ativa = ?, demonstracao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
  p.nome, chaveNome(p.nome), p.remuneracao, p.salario_base, p.frequencia, p.turnos_previstos, p.proporcional, p.justificada_conta, p.regra, p.ativa, demonstracao, quem(req), id);
  await auditar(req, 'profissao', id, 'editar', { antes, depois: { ...p, demonstracao }, justificativa: justificativa(req.body, false), diario: `Editou a profissão ${p.nome}` });
  res.json({ ok: true });
});

function lerItem(body, antes = null) {
  const it = {
    nome: linha(body?.nome ?? antes?.nome, 80),
    unidade: UNIDADES.includes(body?.unidade) ? body.unidade : antes?.unidade || 'unidade',
    valor: numero(body?.valor, { nome: 'O valor por unidade' }) ?? antes?.valor,
    ativo: body?.ativo != null ? (body.ativo ? 1 : 0) : antes?.ativo ?? 1,
  };
  if (it.nome.length < 2) throw erro(400, 'Dê um nome para o produto ou recurso.');
  if (it.valor == null) throw erro(400, 'Informe o valor (em Lírios) por unidade.');
  return it;
}

r.post('/profissoes/:id/itens', gerir, async (req, res) => {
  const p = await buscar('profissoes', idDaRota(req), 'Profissão');
  if (p.remuneracao !== 'producao') throw erro(400, 'Produtos e recursos só existem nas profissões pagas por produção.');
  const it = lerItem(req.body);
  const { id } = await db.run('INSERT INTO producao_itens (profissao_id, nome, unidade, valor, ativo, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
    p.id, it.nome, it.unidade, it.valor, it.ativo, quem(req));
  await auditar(req, 'item', id, 'criar', { depois: { ...it, profissao: p.nome }, diario: `Criou o item de produção ${it.nome} (${p.nome})` });
  res.status(201).json({ id });
});

r.put('/itens/:id', gerir, async (req, res) => {
  const id = idDaRota(req);
  const antes = await buscar('producao_itens', id, 'Produto');
  const it = lerItem(req.body, antes);
  const demonstracao = req.body?.demonstracao != null ? (req.body.demonstracao ? 1 : 0) : (it.valor !== antes.valor ? 0 : antes.demonstracao);
  await db.run(`UPDATE producao_itens SET nome = ?, unidade = ?, valor = ?, ativo = ?, demonstracao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
    it.nome, it.unidade, it.valor, it.ativo, demonstracao, quem(req), id);
  // O valor novo só vale para as próximas entregas aceitas: as já aceitas guardaram o valor da época.
  await auditar(req, 'item', id, 'editar', { antes, depois: { ...it, demonstracao }, justificativa: justificativa(req.body, false), diario: `Editou o item de produção ${it.nome}` });
  res.json({ ok: true });
});

/* ─── Cidadãos e vínculos ────────────────────────── */

async function vinculosCompletos(where = '', ...args) {
  return db.all(`SELECT v.*, p.nome AS profissao_nome, p.remuneracao, p.salario_base AS p_salario_base, p.turnos_previstos AS p_turnos_previstos,
      p.frequencia, p.proporcional
    FROM vinculos v JOIN profissoes p ON p.id = v.profissao_id ${where} ORDER BY v.cidadao_nome, p.ordem, v.id`, ...args);
}
const formatarVinculo = v => ({
  ...v, proporcional: !!v.proporcional,
  salario_efetivo: v.salario_base ?? v.p_salario_base, turnos_efetivos: v.turnos_previstos ?? v.p_turnos_previstos,
});

r.get('/cidadaos', async (req, res) => {
  const pessoas = await F.cidadaos();
  const vinculos = (await vinculosCompletos()).map(formatarVinculo);
  const extras = new Map((await db.all('SELECT * FROM cidadao_financas')).map(e => [e.registro_id, e]));
  const lista = [...pessoas.values()].map(p => ({
    registro_id: p.registro_id, nome: p.nome, livro: p.livro, numero: p.numero, foto: p.foto, nick: p.nick,
    profissao_registro: F.profissaoDoRegistro(p), registrado: true,
    observacoes: extras.get(p.registro_id)?.observacoes || '',
    vinculos: vinculos.filter(v => v.registro_id === p.registro_id),
  }));
  // Quem tem vínculo mas saiu dos registros aprovados continua aparecendo (o histórico é preservado).
  for (const v of vinculos) {
    if (pessoas.has(v.registro_id)) continue;
    let p = lista.find(x => x.registro_id === v.registro_id);
    if (!p) lista.push(p = { registro_id: v.registro_id, nome: v.cidadao_nome, registrado: false, vinculos: [], observacoes: extras.get(v.registro_id)?.observacoes || '' });
    if (!p.vinculos.includes(v)) p.vinculos.push(v);
  }
  lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  res.json({ cidadaos: lista });
});

r.get('/cidadaos/:id', async (req, res) => {
  const registroId = idDaRota(req);
  const pessoas = await F.cidadaos();
  const p = pessoas.get(registroId);
  const vinculos = (await vinculosCompletos('WHERE v.registro_id = ?', registroId)).map(formatarVinculo);
  if (!p && !vinculos.length) throw erro(404, 'Cidadão não encontrado entre os registros aprovados do Tabelionato.');
  const ids = vinculos.map(v => v.id);
  const marcas = ids.map(() => '?').join(',') || 'NULL';
  const presencas = ids.length ? await db.all(`SELECT * FROM presencas WHERE vinculo_id IN (${marcas}) ORDER BY data DESC LIMIT 200`, ...ids) : [];
  const entregas = ids.length ? await db.all(`SELECT e.*, i.nome AS item_nome, i.unidade FROM entregas e JOIN producao_itens i ON i.id = e.item_id
    WHERE e.vinculo_id IN (${marcas}) ORDER BY e.data DESC, e.id DESC LIMIT 200`, ...ids) : [];
  const pagamentos = await db.all(`SELECT i.*, f.inicio, f.fim, f.situacao AS folha_situacao FROM folha_itens i JOIN folhas f ON f.id = i.folha_id
    WHERE i.registro_id = ? AND f.situacao <> 'rejeitada' ORDER BY f.inicio DESC, i.id`, registroId);
  const extra = await db.get('SELECT * FROM cidadao_financas WHERE registro_id = ?', registroId);
  const historico = ids.length ? await db.all(`SELECT * FROM financas_auditoria WHERE (entidade = 'vinculo' AND entidade_id IN (${marcas})) OR (entidade = 'cidadao' AND entidade_id = ?)
    ORDER BY id DESC LIMIT 100`, ...ids, registroId) : await db.all("SELECT * FROM financas_auditoria WHERE entidade = 'cidadao' AND entidade_id = ? ORDER BY id DESC LIMIT 100", registroId);
  res.json({
    cidadao: p ? { ...p, profissao_registro: F.profissaoDoRegistro(p), registrado: true } : { registro_id: registroId, nome: vinculos[0].cidadao_nome, registrado: false },
    observacoes: extra?.observacoes || '', observacoes_por: extra?.atualizado_por_nome || null, observacoes_em: extra?.atualizado_em || null,
    vinculos, presencas, entregas,
    pagamentos: pagamentos.map(i => ({ ...i, detalhes: json(i.detalhes, {}), pago: !!i.pago_em })),
    historico,
  });
});

r.put('/cidadaos/:id/observacoes', gerir, async (req, res) => {
  const registroId = idDaRota(req);
  const pessoas = await F.cidadaos();
  if (!pessoas.has(registroId) && !await db.get('SELECT id FROM vinculos WHERE registro_id = ?', registroId)) throw erro(404, 'Cidadão não encontrado.');
  const antes = await db.get('SELECT observacoes FROM cidadao_financas WHERE registro_id = ?', registroId);
  const observacoes = texto(req.body?.observacoes, 2000);
  await db.run(`INSERT INTO cidadao_financas (registro_id, observacoes, atualizado_por_nome, atualizado_em) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT (registro_id) DO UPDATE SET observacoes = excluded.observacoes, atualizado_por_nome = excluded.atualizado_por_nome, atualizado_em = excluded.atualizado_em`,
  registroId, observacoes, quem(req));
  await auditar(req, 'cidadao', registroId, 'observacoes', { antes: antes?.observacoes ?? '', depois: observacoes });
  res.json({ ok: true });
});

r.get('/vinculos', async (req, res) => {
  const situacao = ['ativo', 'suspenso', 'encerrado'].includes(req.query.situacao) ? req.query.situacao : null;
  const lista = situacao ? await vinculosCompletos('WHERE v.situacao = ?', situacao) : await vinculosCompletos();
  res.json({ vinculos: lista.map(formatarVinculo) });
});

r.post('/vinculos', gerir, async (req, res) => {
  const registroId = Number(req.body?.registro_id);
  const pessoas = await F.cidadaos();
  const pessoa = pessoas.get(registroId);
  if (!pessoa) throw erro(400, 'Escolha um cidadão dos registros aprovados do Tabelionato.');
  const prof = await buscar('profissoes', Number(req.body?.profissao_id) || 0, 'Profissão');
  if (!prof.ativa) throw erro(400, 'Esta profissão está desativada.');
  if (await db.get("SELECT id FROM vinculos WHERE registro_id = ? AND profissao_id = ? AND situacao <> 'encerrado'", registroId, prof.id)) {
    throw erro(409, `${pessoa.nome} já tem um vínculo de ${prof.nome} ativo ou suspenso.`);
  }
  const v = {
    inicio: data(req.body?.inicio, 'o início do vínculo'),
    salario_base: prof.remuneracao === 'fixo' ? numero(req.body?.salario_base, { nome: 'O salário-base' }) : null,
    turnos_previstos: prof.remuneracao === 'fixo' && req.body?.turnos_previstos !== '' && req.body?.turnos_previstos != null
      ? Math.round(numero(req.body.turnos_previstos, { min: 1, max: 100, nome: 'Os turnos previstos' })) : null,
    observacao: texto(req.body?.observacao, 500),
  };
  const { id } = await db.run(`INSERT INTO vinculos (registro_id, cidadao_nome, profissao_id, situacao, salario_base, turnos_previstos, inicio, observacao, criado_por_nome)
    VALUES (?, ?, ?, 'ativo', ?, ?, ?, ?, ?)`, registroId, pessoa.nome, prof.id, v.salario_base, v.turnos_previstos, v.inicio, v.observacao, quem(req));
  await auditar(req, 'vinculo', id, 'criar', { depois: { ...v, cidadao: pessoa.nome, profissao: prof.nome }, diario: `Vinculou ${pessoa.nome} como ${prof.nome}` });
  res.status(201).json({ id });
});

r.put('/vinculos/:id', gerir, async (req, res) => {
  const id = idDaRota(req);
  const antes = await buscar('vinculos', id, 'Vínculo');
  const prof = await buscar('profissoes', antes.profissao_id, 'Profissão');
  const b = req.body || {};
  const v = {
    situacao: ['ativo', 'suspenso', 'encerrado'].includes(b.situacao) ? b.situacao : antes.situacao,
    salario_base: prof.remuneracao === 'fixo' && 'salario_base' in b ? numero(b.salario_base, { nome: 'O salário-base' }) : antes.salario_base,
    turnos_previstos: prof.remuneracao === 'fixo' && 'turnos_previstos' in b
      ? (b.turnos_previstos === '' || b.turnos_previstos == null ? null : Math.round(numero(b.turnos_previstos, { min: 1, max: 100, nome: 'Os turnos previstos' })))
      : antes.turnos_previstos,
    inicio: b.inicio ? data(b.inicio, 'o início do vínculo') : antes.inicio,
    fim: 'fim' in b ? (b.fim ? data(b.fim, 'o fim do vínculo') : null) : antes.fim,
    observacao: 'observacao' in b ? texto(b.observacao, 500) : antes.observacao,
  };
  if (v.situacao === 'encerrado' && !v.fim) throw erro(400, 'Para encerrar o vínculo, informe a data de fim.');
  if (v.situacao !== 'encerrado' && antes.situacao === 'encerrado') {
    if (await db.get("SELECT id FROM vinculos WHERE registro_id = ? AND profissao_id = ? AND situacao <> 'encerrado' AND id <> ?", antes.registro_id, antes.profissao_id, id)) {
      throw erro(409, 'Já existe outro vínculo dessa profissão ativo para esta pessoa.');
    }
  }
  if (v.fim && v.fim < v.inicio) throw erro(400, 'O fim do vínculo precisa vir depois do início.');
  const j = justificativa(b);
  await db.run(`UPDATE vinculos SET situacao = ?, salario_base = ?, turnos_previstos = ?, inicio = ?, fim = ?, observacao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?`,
    v.situacao, v.salario_base, v.turnos_previstos, v.inicio, v.fim, v.observacao, quem(req), id);
  await auditar(req, 'vinculo', id, v.situacao !== antes.situacao ? v.situacao : 'editar', {
    antes, depois: v, justificativa: j, diario: `${v.situacao !== antes.situacao ? `Deixou ${v.situacao}` : 'Editou'} o vínculo de ${antes.cidadao_nome} (${prof.nome})`,
  });
  res.json({ ok: true });
});

/* ─── Presenças e turnos ─────────────────────────── */

r.get('/presencas', async (req, res) => {
  const cond = [];
  const args = [];
  if (dataValida(req.query.inicio)) { cond.push('pr.data >= ?'); args.push(req.query.inicio); }
  if (dataValida(req.query.fim)) { cond.push('pr.data <= ?'); args.push(req.query.fim); }
  if (Number(req.query.vinculo_id)) { cond.push('pr.vinculo_id = ?'); args.push(Number(req.query.vinculo_id)); }
  if (Number(req.query.registro_id)) { cond.push('v.registro_id = ?'); args.push(Number(req.query.registro_id)); }
  const presencas = await db.all(`SELECT pr.*, v.registro_id, v.cidadao_nome, p.nome AS profissao_nome
    FROM presencas pr JOIN vinculos v ON v.id = pr.vinculo_id JOIN profissoes p ON p.id = v.profissao_id
    ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY pr.data DESC, v.cidadao_nome LIMIT 2000`, ...args);
  res.json({ presencas, situacoes: SITUACOES_PRESENCA });
});

function lerPresenca(x) {
  const situacao = SITUACOES_PRESENCA.includes(x?.situacao) ? x.situacao : null;
  if (!situacao) throw erro(400, 'Situação inválida: presente, falta, justificada, licença ou missão.');
  const turnos = situacao === 'falta' ? 0 : (numero(x?.turnos ?? 1, { min: 0, max: 10, nome: 'Os turnos do dia' }) ?? 1);
  return { data: data(x?.data), situacao, turnos, observacao: texto(x?.observacao, 300) };
}

// Uma presença ou várias de uma vez ({ vinculo_id, itens: [{ data, situacao, turnos }] }).
r.post('/presencas', gerir, async (req, res) => {
  const v = await buscar('vinculos', Number(req.body?.vinculo_id) || 0, 'Vínculo');
  const prof = await buscar('profissoes', v.profissao_id, 'Profissão');
  if (prof.remuneracao !== 'fixo') throw erro(400, `${prof.nome} é paga por produção: registre as entregas, não os turnos.`);
  const lista = (Array.isArray(req.body?.itens) ? req.body.itens : [req.body]).slice(0, 62).map(lerPresenca);
  const criadas = [];
  const recusadas = [];
  for (const p of lista) {
    if (p.data < v.inicio || (v.fim && p.data > v.fim)) { recusadas.push({ data: p.data, motivo: 'fora do período do vínculo' }); continue; }
    const fechada = await periodoFechado(p.data);
    if (fechada) { recusadas.push({ data: p.data, motivo: `o dia já está na folha nº ${fechada.id}` }); continue; }
    try {
      const { id } = await db.run('INSERT INTO presencas (vinculo_id, data, situacao, turnos, observacao, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
        v.id, p.data, p.situacao, p.turnos, p.observacao, quem(req));
      criadas.push(id);
      await auditar(req, 'presenca', id, 'criar', { depois: { ...p, vinculo_id: v.id, cidadao: v.cidadao_nome } });
    } catch (e) {
      if (!/UNIQUE/i.test(e.message)) throw e;
      recusadas.push({ data: p.data, motivo: 'já tem registro nesse dia (corrija o que existe)' });
    }
  }
  if (!criadas.length && recusadas.length === 1) throw erro(409, `Não registrado: ${recusadas[0].motivo}.`);
  res.status(201).json({ criadas, recusadas });
});

async function presencaEditavel(id) {
  const p = await buscar('presencas', id, 'Registro de presença');
  if (p.folha_id) throw erro(409, `Esta presença já entrou na folha nº ${p.folha_id}. Para corrigir, faça um ajuste na folha.`);
  const fechada = await periodoFechado(p.data);
  if (fechada) throw erro(409, `O dia já está na folha nº ${fechada.id}. Para corrigir, faça um ajuste na folha.`);
  return p;
}

r.put('/presencas/:id', gerir, async (req, res) => {
  const antes = await presencaEditavel(idDaRota(req));
  const p = lerPresenca({ ...antes, ...req.body, data: antes.data });
  const j = justificativa(req.body);
  await db.run("UPDATE presencas SET situacao = ?, turnos = ?, observacao = ?, atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ?",
    p.situacao, p.turnos, p.observacao, quem(req), antes.id);
  await auditar(req, 'presenca', antes.id, 'corrigir', { antes, depois: p, justificativa: j });
  res.json({ ok: true });
});

r.post('/presencas/:id/apagar', gerir, async (req, res) => {
  const antes = await presencaEditavel(idDaRota(req));
  const j = justificativa(req.body);
  await db.run('DELETE FROM presencas WHERE id = ?', antes.id);
  await auditar(req, 'presenca', antes.id, 'apagar', { antes, justificativa: j });
  res.json({ ok: true });
});

/* ─── Produção e entregas ────────────────────────── */

r.get('/entregas', async (req, res) => {
  const cond = [];
  const args = [];
  if (dataValida(req.query.inicio)) { cond.push('e.data >= ?'); args.push(req.query.inicio); }
  if (dataValida(req.query.fim)) { cond.push('e.data <= ?'); args.push(req.query.fim); }
  if (['pendente', 'aceita', 'rejeitada'].includes(req.query.situacao)) { cond.push('e.situacao = ?'); args.push(req.query.situacao); }
  if (Number(req.query.registro_id)) { cond.push('v.registro_id = ?'); args.push(Number(req.query.registro_id)); }
  if (Number(req.query.profissao_id)) { cond.push('v.profissao_id = ?'); args.push(Number(req.query.profissao_id)); }
  const entregas = await db.all(`SELECT e.*, v.registro_id, v.cidadao_nome, p.nome AS profissao_nome, i.nome AS item_nome, i.unidade, i.valor AS valor_atual, i.demonstracao
    FROM entregas e JOIN vinculos v ON v.id = e.vinculo_id JOIN profissoes p ON p.id = v.profissao_id JOIN producao_itens i ON i.id = e.item_id
    ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY e.data DESC, e.id DESC LIMIT 2000`, ...args);
  res.json({ entregas: entregas.map(e => ({ ...e, demonstracao: !!e.demonstracao, valor: e.valor_unitario != null ? r2(e.quantidade * e.valor_unitario) : null })) });
});

async function lerEntrega(body, antes = null) {
  const v = await buscar('vinculos', Number(body?.vinculo_id ?? antes?.vinculo_id) || 0, 'Vínculo');
  const prof = await buscar('profissoes', v.profissao_id, 'Profissão');
  if (prof.remuneracao !== 'producao') throw erro(400, `${prof.nome} tem salário fixo: registre presenças e turnos, não entregas.`);
  const item = await buscar('producao_itens', Number(body?.item_id ?? antes?.item_id) || 0, 'Produto');
  if (item.profissao_id !== prof.id) throw erro(400, `"${item.nome}" não é um produto de ${prof.nome}.`);
  if (!item.ativo && item.id !== antes?.item_id) throw erro(400, `"${item.nome}" está desativado na tabela de valores.`);
  const e = {
    vinculo_id: v.id, item_id: item.id,
    quantidade: numero(body?.quantidade ?? antes?.quantidade, { min: 0.01, max: 100000, nome: 'A quantidade' }),
    data: data(body?.data ?? antes?.data, 'o dia da entrega'),
    referencia: linha(body?.referencia ?? antes?.referencia ?? '', 80),
    observacao: texto(body?.observacao ?? antes?.observacao ?? '', 500),
  };
  if (e.quantidade == null) throw erro(400, 'Informe a quantidade entregue.');
  if (e.data < v.inicio || (v.fim && e.data > v.fim)) throw erro(400, 'A entrega está fora do período do vínculo.');
  return { e, v, prof, item };
}

// A mesma entrega não entra duas vezes: a referência (ex.: "baú 12 do armazém") é única, e uma entrega igual
// (pessoa, produto, dia e quantidade) só passa se quem registra confirmar com justificativa.
async function conferirDuplicada(req, e, exceto = 0) {
  if (e.referencia) {
    const ja = await db.get("SELECT id FROM entregas WHERE referencia = ? AND situacao <> 'rejeitada' AND id <> ?", e.referencia, exceto);
    if (ja) throw erro(409, `Já existe a entrega nº ${ja.id} com a referência "${e.referencia}".`);
  }
  const igual = await db.get("SELECT id FROM entregas WHERE vinculo_id = ? AND item_id = ? AND data = ? AND quantidade = ? AND situacao <> 'rejeitada' AND id <> ?",
    e.vinculo_id, e.item_id, e.data, e.quantidade, exceto);
  if (igual && !req.body?.repetida) throw erro(409, `Já existe uma entrega igual (nº ${igual.id}: mesmo produto, dia e quantidade). Se for outra entrega mesmo, confirme e justifique.`);
  return igual ? justificativa(req.body) : null;
}

r.post('/entregas', gerir, async (req, res) => {
  const { e, v, item } = await lerEntrega(req.body);
  const jRepetida = await conferirDuplicada(req, e);
  const aceitar = !!req.body?.aceitar;
  const { id } = await db.run(`INSERT INTO entregas (vinculo_id, item_id, quantidade, valor_unitario, data, referencia, situacao, observacao, criado_por_nome, revisado_por_nome, revisado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${aceitar ? "datetime('now')" : 'NULL'})`,
  e.vinculo_id, e.item_id, e.quantidade, aceitar ? item.valor : null, e.data, e.referencia, aceitar ? 'aceita' : 'pendente', e.observacao, quem(req), aceitar ? quem(req) : null);
  await auditar(req, 'entrega', id, aceitar ? 'criar_aceita' : 'criar', {
    depois: { ...e, item: item.nome, cidadao: v.cidadao_nome, valor_unitario: aceitar ? item.valor : null }, justificativa: jRepetida,
  });
  res.status(201).json({ id });
});

async function entregaEditavel(id) {
  const e = await buscar('entregas', id, 'Entrega');
  if (e.folha_id) throw erro(409, `Esta entrega já entrou na folha nº ${e.folha_id}. Para corrigir, faça um ajuste na folha.`);
  return e;
}

r.post('/entregas/:id/aceitar', gerir, async (req, res) => {
  const antes = await entregaEditavel(idDaRota(req));
  if (antes.situacao === 'aceita') throw erro(409, 'Esta entrega já foi aceita.');
  const item = await buscar('producao_itens', antes.item_id, 'Produto');
  // O valor unitário fica guardado na hora de aceitar: mudar a tabela depois não muda o que já foi aceito.
  const r1 = await db.run("UPDATE entregas SET situacao = 'aceita', valor_unitario = ?, motivo = NULL, revisado_por_nome = ?, revisado_em = datetime('now') WHERE id = ? AND situacao <> 'aceita' AND folha_id IS NULL",
    item.valor, quem(req), antes.id);
  if (!r1.changes) throw erro(409, 'A entrega mudou enquanto isso. Recarregue.');
  await auditar(req, 'entrega', antes.id, 'aceitar', { antes, depois: { situacao: 'aceita', valor_unitario: item.valor } });
  res.json({ ok: true });
});

r.post('/entregas/:id/rejeitar', gerir, async (req, res) => {
  const antes = await entregaEditavel(idDaRota(req));
  const motivo = texto(req.body?.motivo, 300);
  if (motivo.length < 3) throw erro(400, 'Diga o motivo da rejeição (qualidade, quantidade errada...).');
  await db.run("UPDATE entregas SET situacao = 'rejeitada', valor_unitario = NULL, motivo = ?, revisado_por_nome = ?, revisado_em = datetime('now') WHERE id = ? AND folha_id IS NULL",
    motivo, quem(req), antes.id);
  await auditar(req, 'entrega', antes.id, 'rejeitar', { antes, depois: { situacao: 'rejeitada' }, justificativa: motivo });
  res.json({ ok: true });
});

// Corrigir uma entrega (ainda fora de folha): volta para conferência, com justificativa no histórico.
r.put('/entregas/:id', gerir, async (req, res) => {
  const antes = await entregaEditavel(idDaRota(req));
  const { e } = await lerEntrega({ ...req.body, vinculo_id: antes.vinculo_id }, antes);
  await conferirDuplicada(req, e, antes.id);
  const j = justificativa(req.body);
  await db.run(`UPDATE entregas SET item_id = ?, quantidade = ?, data = ?, referencia = ?, observacao = ?, situacao = 'pendente', valor_unitario = NULL, motivo = NULL,
    atualizado_por_nome = ?, atualizado_em = datetime('now') WHERE id = ? AND folha_id IS NULL`,
  e.item_id, e.quantidade, e.data, e.referencia, e.observacao, quem(req), antes.id);
  await auditar(req, 'entrega', antes.id, 'corrigir', { antes, depois: e, justificativa: j });
  res.json({ ok: true });
});

/* ─── Folha de pagamento ─────────────────────────── */

// A prévia: só simulação, nada é gravado e o tesouro não muda.
r.get('/folha/previa', async (req, res) => {
  res.json({ previa: await F.calcularFolha(data(req.query.inicio, 'o início do período'), data(req.query.fim, 'o fim do período')) });
});

r.get('/folhas', async (req, res) => {
  const folhas = await db.all(`SELECT f.*, COALESCE(SUM(i.valor), 0) AS total, COALESCE(SUM(CASE WHEN i.pago_em IS NOT NULL THEN i.valor ELSE 0 END), 0) AS pago,
      COUNT(DISTINCT i.registro_id) AS pessoas
    FROM folhas f LEFT JOIN folha_itens i ON i.folha_id = f.id GROUP BY f.id ORDER BY f.inicio DESC, f.id DESC`);
  res.json({ folhas: folhas.map(f => ({ ...f, total: r2(f.total), pago: r2(f.pago), alertas: json(f.alertas, []), excecao: f.excecao ? json(f.excecao, null) : null })) });
});

r.get('/folhas/:id', async (req, res) => {
  const folha = await F.lerFolha(idDaRota(req));
  const auditoria = await db.all("SELECT * FROM financas_auditoria WHERE entidade = 'folha' AND entidade_id = ? ORDER BY id", folha.id);
  res.json({ folha, auditoria, tesouro: await F.resumoTesouro() });
});

// Fechar a folha para revisão: grava os itens calculados e prende as presenças e entregas nela
// (assim nada entra em duas folhas). Ainda não mexe no tesouro.
r.post('/folhas', gerir, async (req, res) => {
  const inicio = data(req.body?.inicio, 'o início do período');
  const fim = data(req.body?.fim, 'o fim do período');
  const previa = await F.calcularFolha(inicio, fim);
  const sobreposta = previa.alertas.find(a => a.folha_id);
  if (sobreposta) throw erro(409, sobreposta.texto);
  if (!previa.itens.some(i => i.valor !== 0)) throw erro(400, 'Não há nada a pagar neste período (todos os valores deram 0).');
  const { id } = await db.run('INSERT INTO folhas (inicio, fim, situacao, observacao, alertas, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
    inicio, fim, 'revisao', texto(req.body?.observacao, 500), JSON.stringify(previa.alertas), quem(req));
  try {
    const presencas = previa.itens.flatMap(i => i.detalhes.presencas || []);
    const entregas = previa.itens.flatMap(i => i.detalhes.entregas || []);
    await db.lote([
      ...previa.itens.map(i => ['INSERT INTO folha_itens (folha_id, registro_id, cidadao_nome, vinculo_id, profissao_nome, tipo, descricao, calculado, valor, detalhes, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, i.registro_id, i.cidadao_nome, i.vinculo_id, i.profissao_nome, i.tipo, i.descricao, i.calculado, i.valor, JSON.stringify(i.detalhes), quem(req)]),
      ...presencas.map(p => ['UPDATE presencas SET folha_id = ? WHERE id = ? AND folha_id IS NULL', id, p]),
      ...entregas.map(e => ["UPDATE entregas SET folha_id = ? WHERE id = ? AND folha_id IS NULL AND situacao = 'aceita'", id, e]),
    ]);
    // Se outra pessoa fechou uma folha com as mesmas entregas ao mesmo tempo, esta não fica pela metade.
    const presas = (await db.get("SELECT COUNT(*) AS n FROM entregas WHERE folha_id = ?", id)).n;
    if (presas !== entregas.length) throw erro(409, 'Algumas entregas entraram em outra folha enquanto esta era fechada. Calcule de novo.');
  } catch (e) {
    await db.lote([
      ['DELETE FROM folha_itens WHERE folha_id = ?', id], ['UPDATE presencas SET folha_id = NULL WHERE folha_id = ?', id],
      ['UPDATE entregas SET folha_id = NULL WHERE folha_id = ?', id], ['DELETE FROM folhas WHERE id = ?', id],
    ]);
    throw e;
  }
  await auditar(req, 'folha', id, 'fechar', { depois: { inicio, fim, total: previa.total, itens: previa.itens.length }, diario: `Fechou a folha nº ${id} (${inicio} a ${fim}) para revisão: ${previa.total} Lírios` });
  res.status(201).json({ id });
});

// Revisar o valor de um item antes de aprovar (sempre com justificativa; acima do calculado também).
r.put('/folhas/:id/itens/:item', gerir, async (req, res) => {
  const folha = await buscar('folhas', idDaRota(req), 'Folha');
  if (folha.situacao !== 'revisao') throw erro(409, 'Só a folha em revisão muda. Depois de aprovada, corrija com um ajuste.');
  const item = await db.get('SELECT * FROM folha_itens WHERE id = ? AND folha_id = ?', idDaRota(req, 'item'), folha.id);
  if (!item) throw erro(404, 'Item não encontrado nesta folha.');
  if (item.pago_em) throw erro(409, 'Este item já foi pago.');
  const valor = numero(req.body?.valor, { min: item.tipo === 'ajuste' ? -1e7 : 0, nome: 'O valor' });
  if (valor == null) throw erro(400, 'Informe o valor.');
  const j = justificativa(req.body);
  await db.run('UPDATE folha_itens SET valor = ?, justificativa = ? WHERE id = ?', valor, j, item.id);
  await auditar(req, 'folha', folha.id, 'revisar_item', {
    antes: { item: item.id, cidadao: item.cidadao_nome, valor: item.valor }, depois: { item: item.id, valor, acima_do_calculado: valor > item.calculado }, justificativa: j,
  });
  res.json({ ok: true });
});

// Ajuste: um pagamento a mais (ou desconto, valor negativo) com justificativa. Na folha em revisão, entra
// junto; na aprovada ou paga, é a forma registrada de corrigir (a folha volta a ter algo a pagar).
r.post('/folhas/:id/ajustes', gerir, async (req, res) => {
  const folha = await buscar('folhas', idDaRota(req), 'Folha');
  if (folha.situacao === 'rejeitada') throw erro(409, 'A folha foi rejeitada.');
  const registroId = Number(req.body?.registro_id);
  const pessoas = await F.cidadaos();
  const daFolha = await db.get('SELECT cidadao_nome FROM folha_itens WHERE folha_id = ? AND registro_id = ? LIMIT 1', folha.id, registroId);
  const nome = pessoas.get(registroId)?.nome || daFolha?.cidadao_nome;
  if (!nome) throw erro(400, 'Escolha um cidadão dos registros do Tabelionato.');
  const valor = numero(req.body?.valor, { min: -1e7, nome: 'O valor do ajuste' });
  if (!valor) throw erro(400, 'Informe o valor do ajuste (negativo para desconto).');
  const descricao = linha(req.body?.descricao, 120) || (valor > 0 ? 'Ajuste' : 'Desconto');
  const j = justificativa(req.body);
  let exc = null;
  if (folha.situacao !== 'revisao' && valor > 0) {
    const t = await F.resumoTesouro();
    if (valor > t.disponivel) exc = excecao(req, `O ajuste (${valor} Lírios) passa do saldo disponível (${t.disponivel} Lírios).`);
  }
  const { id } = await db.run(`INSERT INTO folha_itens (folha_id, registro_id, cidadao_nome, tipo, descricao, calculado, valor, detalhes, justificativa, criado_por_nome)
    VALUES (?, ?, ?, 'ajuste', ?, 0, ?, ?, ?, ?)`, folha.id, registroId, nome, descricao, valor, JSON.stringify(exc ? { excecao: exc } : {}), j, quem(req));
  if (folha.situacao === 'paga') await db.run("UPDATE folhas SET situacao = 'aprovada' WHERE id = ?", folha.id);
  await auditar(req, 'folha', folha.id, 'ajuste', { depois: { item: id, cidadao: nome, valor, descricao, excecao: exc }, justificativa: j, diario: `Ajuste de ${valor} Lírios para ${nome} na folha nº ${folha.id}` });
  res.status(201).json({ id });
});

r.post('/folhas/:id/aprovar', aprovar, async (req, res) => {
  const folha = await F.lerFolha(idDaRota(req));
  if (folha.situacao !== 'revisao') throw erro(409, 'Esta folha não está esperando aprovação.');
  if (!req.body?.confirmar) throw erro(400, 'Confirme a aprovação da folha.');
  const demo = folha.alertas.some(a => /demonstra/.test(a.texto));
  if (demo && !req.body?.aceitar_demonstracao) throw erro(409, 'A folha usa valores de demonstração. Confira a tabela de valores ou confirme que quer aprovar assim mesmo.');
  const t = await F.resumoTesouro();
  // A própria folha (em revisão) ainda não está reservada: o disponível é o de agora.
  let exc = null;
  if (folha.total > t.disponivel) exc = excecao(req, `A folha (${folha.total} Lírios) passa do saldo disponível do tesouro (${t.disponivel} Lírios).`);
  const r1 = await db.run("UPDATE folhas SET situacao = 'aprovada', aprovado_por_nome = ?, aprovado_em = datetime('now'), excecao = ? WHERE id = ? AND situacao = 'revisao'",
    quem(req), exc ? JSON.stringify(exc) : null, folha.id);
  if (!r1.changes) throw erro(409, 'A folha mudou enquanto isso. Recarregue.');
  await auditar(req, 'folha', folha.id, 'aprovar', {
    depois: { total: folha.total, disponivel_antes: t.disponivel, excecao: exc, valores_de_demonstracao: demo }, justificativa: exc?.justificativa,
    diario: `Aprovou a folha nº ${folha.id}: ${folha.total} Lírios${exc ? ' (pagamento excepcional autorizado)' : ''}`,
  });
  res.json({ ok: true });
});

r.post('/folhas/:id/rejeitar', aprovar, async (req, res) => {
  const folha = await buscar('folhas', idDaRota(req), 'Folha');
  if (folha.situacao !== 'revisao') throw erro(409, 'Só a folha em revisão pode ser rejeitada. Depois de aprovada, corrija com ajustes.');
  const motivo = texto(req.body?.motivo, 500);
  if (motivo.length < 5) throw erro(400, 'Escreva o motivo da rejeição.');
  // As presenças e entregas voltam a ficar livres para a próxima folha; a folha rejeitada fica no histórico.
  await db.lote([
    ["UPDATE folhas SET situacao = 'rejeitada', rejeitado_por_nome = ?, rejeitado_em = datetime('now'), motivo = ? WHERE id = ? AND situacao = 'revisao'", quem(req), motivo, folha.id],
    ['UPDATE presencas SET folha_id = NULL WHERE folha_id = ?', folha.id],
    ['UPDATE entregas SET folha_id = NULL WHERE folha_id = ?', folha.id],
  ]);
  await auditar(req, 'folha', folha.id, 'rejeitar', { justificativa: motivo, diario: `Rejeitou a folha nº ${folha.id}` });
  res.json({ ok: true });
});

// Pagar: aqui o dinheiro sai do tesouro. Cada item vira um movimento "salário"; um item nunca é pago
// duas vezes (índice único no banco), nem com dois cliques ao mesmo tempo.
r.post('/folhas/:id/pagar', aprovar, async (req, res) => {
  const folha = await F.lerFolha(idDaRota(req));
  if (!['aprovada', 'paga'].includes(folha.situacao)) throw erro(409, 'Só a folha aprovada é paga.');
  const escolhidos = Array.isArray(req.body?.itens) && req.body.itens.length ? new Set(req.body.itens.map(Number)) : null;
  const aPagar = folha.itens.filter(i => !i.pago && (!escolhidos || escolhidos.has(i.id)));
  if (!aPagar.length) throw erro(409, 'Não há itens a pagar (já foram pagos).');
  const total = r2(aPagar.reduce((t, i) => t + i.valor, 0));
  const t = await F.resumoTesouro();
  let exc = null;
  if (total > t.saldo) exc = excecao(req, `O pagamento (${total} Lírios) passa do saldo do tesouro (${t.saldo} Lírios).`);
  let pagos = 0;
  let valorPago = 0;
  for (const i of aPagar) {
    // Item de 0 Lírios (ex.: guarda sem presença) fica quitado sem movimento no tesouro.
    if (!i.valor) {
      const z = await db.run("UPDATE folha_itens SET pago_em = datetime('now'), pago_por_nome = ? WHERE id = ? AND pago_em IS NULL", quem(req), i.id);
      pagos += z.changes;
      continue;
    }
    try {
      await db.lote([
        [`INSERT INTO tesouro_movimentos (tipo, valor, descricao, categoria, periodo, registro_id, folha_id, folha_item_id, excecao, criado_por_nome, autorizado_por_nome)
          VALUES ('salario', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        -i.valor, `${i.cidadao_nome}${i.profissao_nome ? ` (${i.profissao_nome})` : ''}: ${i.descricao}`, i.tipo === 'ajuste' ? 'Ajuste de folha' : 'Salários',
        `${F.br(folha.inicio)} a ${F.br(folha.fim)}`, i.registro_id, folha.id, i.id, exc ? JSON.stringify(exc) : null, quem(req), folha.aprovado_por_nome],
        ["UPDATE folha_itens SET pago_em = datetime('now'), pago_por_nome = ? WHERE id = ? AND pago_em IS NULL", quem(req), i.id],
      ]);
      pagos++;
      valorPago = r2(valorPago + i.valor);
    } catch (e) {
      if (!/UNIQUE/i.test(e.message)) throw e; // já pago por outro clique
    }
  }
  const falta = (await db.get('SELECT COUNT(*) AS n FROM folha_itens WHERE folha_id = ? AND pago_em IS NULL', folha.id)).n;
  if (!falta) await db.run("UPDATE folhas SET situacao = 'paga' WHERE id = ?", folha.id);
  if (pagos) {
    await auditar(req, 'folha', folha.id, 'pagar', {
      depois: { itens: pagos, valor: valorPago, excecao: exc, folha_quitada: !falta }, justificativa: exc?.justificativa,
      diario: `Pagou ${valorPago} Lírios da folha nº ${folha.id} (${pagos} ${pagos === 1 ? 'item' : 'itens'})`,
    });
  }
  res.json({ pagos, valor: valorPago, quitada: !falta });
});

/* ─── Tesouro e movimentações ────────────────────── */

r.get('/tesouro', async (req, res) => {
  const cond = [];
  const args = [];
  if (dataValida(req.query.inicio)) { cond.push('date(criado_em) >= ?'); args.push(req.query.inicio); }
  if (dataValida(req.query.fim)) { cond.push('date(criado_em) <= ?'); args.push(req.query.fim); }
  if (typeof req.query.tipo === 'string' && /^[a-z_]{3,20}$/.test(req.query.tipo)) { cond.push('tipo = ?'); args.push(req.query.tipo); }
  const movimentos = await db.all(`SELECT * FROM tesouro_movimentos ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 1000`, ...args);
  const estornados = new Set((await db.all('SELECT estorno_de FROM tesouro_movimentos WHERE estorno_de IS NOT NULL')).map(m => m.estorno_de));
  res.json({
    tesouro: await F.resumoTesouro(), config: await F.lerConfig(),
    movimentos: movimentos.map(m => ({ ...m, valor: r2(m.valor), estornado: estornados.has(m.id), excecao: m.excecao ? json(m.excecao, null) : null })),
  });
});

const TIPOS_MOVIMENTO = { receita: 'entrada', despesa: 'saida', ajuste: null, transferencia: null };

r.post('/movimentos', gerir, async (req, res) => {
  const tipo = Object.hasOwn(TIPOS_MOVIMENTO, req.body?.tipo) ? req.body.tipo : null;
  if (!tipo) throw erro(400, 'Tipo inválido: receita, despesa, ajuste ou transferência.');
  const direcao = TIPOS_MOVIMENTO[tipo] || (['entrada', 'saida'].includes(req.body?.direcao) ? req.body.direcao : null);
  if (!direcao) throw erro(400, 'Diga se é entrada ou saída do tesouro.');
  const valor = numero(req.body?.valor, { min: 0.01, nome: 'O valor' });
  if (valor == null) throw erro(400, 'Informe o valor em Lírios.');
  const descricao = linha(req.body?.descricao, 160);
  if (descricao.length < 3) throw erro(400, 'Descreva a movimentação.');
  // Ajustes e transferências sempre explicam o motivo.
  const j = justificativa(req.body, tipo === 'ajuste' || tipo === 'transferencia');
  let exc = null;
  if (direcao === 'saida') {
    const t = await F.resumoTesouro();
    if (valor > t.disponivel) exc = excecao(req, `A saída (${valor} Lírios) passa do saldo disponível (${t.disponivel} Lírios; o resto está reservado para folhas aprovadas).`);
  }
  const registroId = Number(req.body?.registro_id) || null;
  const { id } = await db.run(`INSERT INTO tesouro_movimentos (tipo, valor, descricao, categoria, periodo, registro_id, justificativa, excecao, criado_por_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  tipo, direcao === 'saida' ? -valor : valor, descricao, linha(req.body?.categoria, 60), linha(req.body?.periodo, 40), registroId, j, exc ? JSON.stringify(exc) : null, quem(req));
  await auditar(req, 'movimento', id, 'criar', {
    depois: { tipo, direcao, valor, descricao, excecao: exc }, justificativa: j || exc?.justificativa,
    diario: `${direcao === 'saida' ? 'Saída' : 'Entrada'} de ${valor} Lírios no tesouro (${tipo}): ${descricao}`,
  });
  res.status(201).json({ id });
});

// Corrigir uma movimentação: nunca apaga, lança o estorno (o valor contrário) com justificativa.
// Pagamentos de folha não se estornam aqui: corrija com um ajuste na folha.
r.post('/movimentos/:id/estornar', aprovar, async (req, res) => {
  const m = await buscar('tesouro_movimentos', idDaRota(req), 'Movimentação');
  if (m.tipo === 'salario') throw erro(409, 'Pagamento de folha não se estorna: faça um ajuste (desconto) na folha.');
  if (m.tipo === 'estorno') throw erro(409, 'Um estorno não se estorna. Lance uma movimentação nova.');
  if (m.tipo === 'saldo_inicial') throw erro(409, 'O saldo inicial não se estorna: corrija com um ajuste.');
  const j = justificativa(req.body);
  let exc = null;
  if (m.valor > 0) {
    const t = await F.resumoTesouro();
    if (m.valor > t.disponivel) exc = excecao(req, `Estornar esta entrada tira ${r2(m.valor)} Lírios, mais que o saldo disponível (${t.disponivel} Lírios).`);
  }
  try {
    const { id } = await db.run(`INSERT INTO tesouro_movimentos (tipo, valor, descricao, categoria, periodo, registro_id, estorno_de, justificativa, excecao, criado_por_nome)
      VALUES ('estorno', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    -m.valor, `Estorno: ${m.descricao}`, m.categoria, m.periodo, m.registro_id, m.id, j, exc ? JSON.stringify(exc) : null, quem(req));
    await auditar(req, 'movimento', m.id, 'estornar', { antes: m, depois: { estorno: id }, justificativa: j, diario: `Estornou a movimentação nº ${m.id} (${r2(m.valor)} Lírios)` });
    res.status(201).json({ id });
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw erro(409, 'Esta movimentação já foi estornada.');
    throw e;
  }
});

/* ─── Relatórios ─────────────────────────────────── */

r.get('/relatorios/:tipo', async (req, res) => {
  const inicio = dataValida(req.query.inicio) || '0000-01-01';
  const fim = dataValida(req.query.fim) || '9999-12-31';
  const tipo = req.params.tipo;
  if (tipo === 'profissao') {
    const linhas = await db.all(`SELECT COALESCE(NULLIF(i.profissao_nome, ''), 'Ajustes') AS profissao, COUNT(DISTINCT i.registro_id) AS pessoas,
        SUM(i.valor) AS total, SUM(CASE WHEN i.pago_em IS NOT NULL THEN i.valor ELSE 0 END) AS pago
      FROM folha_itens i JOIN folhas f ON f.id = i.folha_id
      WHERE f.situacao IN ('aprovada', 'paga') AND f.inicio <= ? AND f.fim >= ? GROUP BY 1 ORDER BY total DESC`, fim, inicio);
    return res.json({ linhas: linhas.map(l => ({ ...l, total: r2(l.total), pago: r2(l.pago) })) });
  }
  if (tipo === 'producao') {
    const linhas = await db.all(`SELECT v.registro_id, v.cidadao_nome, p.nome AS profissao, i.nome AS item, i.unidade,
        SUM(CASE WHEN e.situacao = 'aceita' THEN e.quantidade ELSE 0 END) AS aceita,
        SUM(CASE WHEN e.situacao = 'pendente' THEN e.quantidade ELSE 0 END) AS pendente,
        SUM(CASE WHEN e.situacao = 'rejeitada' THEN e.quantidade ELSE 0 END) AS rejeitada,
        SUM(CASE WHEN e.situacao = 'aceita' THEN e.quantidade * e.valor_unitario ELSE 0 END) AS valor, COUNT(*) AS entregas
      FROM entregas e JOIN vinculos v ON v.id = e.vinculo_id JOIN profissoes p ON p.id = v.profissao_id JOIN producao_itens i ON i.id = e.item_id
      WHERE e.data >= ? AND e.data <= ? GROUP BY v.registro_id, v.cidadao_nome, p.nome, i.id ORDER BY v.cidadao_nome, i.nome`, inicio, fim);
    return res.json({ linhas: linhas.map(l => ({ ...l, valor: r2(l.valor) })) });
  }
  if (tipo === 'presencas') {
    const linhas = await db.all(`SELECT v.id AS vinculo_id, v.registro_id, v.cidadao_nome, p.nome AS profissao,
        SUM(CASE WHEN pr.situacao = 'presente' THEN 1 ELSE 0 END) AS presentes,
        SUM(CASE WHEN pr.situacao = 'falta' THEN 1 ELSE 0 END) AS faltas,
        SUM(CASE WHEN pr.situacao = 'justificada' THEN 1 ELSE 0 END) AS justificadas,
        SUM(CASE WHEN pr.situacao = 'licenca' THEN 1 ELSE 0 END) AS licencas,
        SUM(CASE WHEN pr.situacao = 'missao' THEN 1 ELSE 0 END) AS missoes,
        SUM(CASE WHEN pr.situacao IN ('presente', 'licenca', 'missao') THEN pr.turnos ELSE 0 END) AS turnos
      FROM presencas pr JOIN vinculos v ON v.id = pr.vinculo_id JOIN profissoes p ON p.id = v.profissao_id
      WHERE pr.data >= ? AND pr.data <= ? GROUP BY v.id ORDER BY v.cidadao_nome, p.nome`, inicio, fim);
    return res.json({ linhas });
  }
  if (tipo === 'movimentos') {
    const linhas = await db.all('SELECT * FROM tesouro_movimentos WHERE date(criado_em) >= ? AND date(criado_em) <= ? ORDER BY id', inicio, fim);
    const entradas = r2(linhas.filter(m => m.valor > 0).reduce((t, m) => t + m.valor, 0));
    const saidas = r2(linhas.filter(m => m.valor < 0).reduce((t, m) => t - m.valor, 0));
    return res.json({ linhas: linhas.map(m => ({ ...m, valor: r2(m.valor) })), entradas, saidas });
  }
  if (tipo === 'pendentes') {
    const itens = await db.all(`SELECT i.*, f.inicio, f.fim FROM folha_itens i JOIN folhas f ON f.id = i.folha_id
      WHERE f.situacao IN ('aprovada', 'paga') AND i.pago_em IS NULL ORDER BY f.inicio, i.cidadao_nome`);
    const entregas = await db.all(`SELECT e.*, v.cidadao_nome, i.nome AS item_nome, i.unidade FROM entregas e JOIN vinculos v ON v.id = e.vinculo_id
      JOIN producao_itens i ON i.id = e.item_id WHERE e.situacao = 'pendente' ORDER BY e.data`);
    const folhas = await db.all("SELECT * FROM folhas WHERE situacao = 'revisao' ORDER BY inicio");
    return res.json({ itens: itens.map(i => ({ ...i, valor: r2(i.valor) })), entregas, folhas });
  }
  throw erro(404, 'Relatório não encontrado.');
});

r.get('/auditoria', async (req, res) => {
  const cond = [];
  const args = [];
  if (typeof req.query.entidade === 'string' && /^[a-z_]{3,20}$/.test(req.query.entidade)) { cond.push('entidade = ?'); args.push(req.query.entidade); }
  if (Number(req.query.id)) { cond.push('entidade_id = ?'); args.push(Number(req.query.id)); }
  const linhas = await db.all(`SELECT * FROM financas_auditoria ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 500`, ...args);
  res.json({ auditoria: linhas.map(a => ({ ...a, antes: json(a.antes, null), depois: json(a.depois, null) })) });
});

module.exports = r;
