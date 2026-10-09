// Gestão Financeira da Capital: as contas da folha de pagamento e do tesouro, em Lírios.
// Os cidadãos são os registros aprovados do Tabelionato (Moradores, Nobres e Outros, via pessoasRegistradas):
// vínculos, presenças, entregas e pagamentos apontam para registros.id e guardam o nome da época.
//
// Regras do cálculo (a prévia é só simulação; nada muda no tesouro até a folha ser aprovada e paga):
//   salário fixo:  base do período × turnos cumpridos ÷ turnos previstos (quando a profissão é proporcional),
//                  nunca acima da base sem um ajuste com justificativa;
//   produção:      quantidade aceita × valor unitário conferido no momento em que a entrega foi aceita;
//   várias profissões: o total da pessoa é a soma dos vínculos, cada presença e cada entrega entra uma vez só.
const { db } = require('./db');
const { pessoasRegistradas } = require('./moradores');
const { anotar } = require('./diario');
const { erro, chaveNome } = require('./util');
const { CONFIG_PADRAO } = require('./financas-padrao');

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const json = (s, padrao) => { try { return JSON.parse(s); } catch { return padrao; } };

// Frequência de pagamento: semanal, quinzenal, mensal ou "Nd" (a cada N dias).
const FREQUENCIAS = { semanal: 7, quinzenal: 14, mensal: 30 };
function diasDaFrequencia(f) {
  if (FREQUENCIAS[f]) return FREQUENCIAS[f];
  const m = /^(\d{1,3})d$/.exec(String(f || ''));
  return m && Number(m[1]) >= 1 ? Number(m[1]) : null;
}
const nomeFrequencia = f => (FREQUENCIAS[f] ? f : `a cada ${diasDaFrequencia(f)} dias`);

// Presença: o que conta como turno cumprido. Licença e missão oficial são exceções autorizadas (contam);
// falta justificada conta só se a profissão disser; falta comum não conta.
const SITUACOES_PRESENCA = ['presente', 'falta', 'justificada', 'licenca', 'missao'];
const UNIDADES = ['unidade', 'pilha', 'baú', 'lote', 'item'];

// Datas "AAAA-MM-DD" (sem fuso: é só o dia).
const diaUTC = s => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const diasEntre = (a, b) => Math.round((diaUTC(b) - diaUTC(a)) / 86400000) + 1;
const maior = (a, b) => (a > b ? a : b);
const menor = (a, b) => (a < b ? a : b);
// "2030-01-07" vira "07/01/2030" nos textos.
const br = d => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

async function lerConfig() {
  const l = await db.get("SELECT valor FROM meta WHERE chave = 'financas_config'");
  return { ...CONFIG_PADRAO, ...(l ? json(l.valor, {}) : {}) };
}

/* ─── Auditoria ──────────────────────────────────── */

// Toda operação financeira fica registrada: o quê, antes e depois, quem fez, quando e por quê.
async function auditar(req, entidade, entidadeId, acao, { antes = null, depois = null, justificativa = null, diario = null } = {}) {
  await db.run(`INSERT INTO financas_auditoria (entidade, entidade_id, acao, antes, depois, justificativa, usuario_id, usuario_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  entidade, entidadeId ?? null, acao, antes == null ? null : JSON.stringify(antes), depois == null ? null : JSON.stringify(depois),
  justificativa || null, req.usuario?.id ?? null, req.usuario?.nome ?? '');
  if (diario) await anotar(req, 'financas', diario);
}

/* ─── Cidadãos ───────────────────────────────────── */

// Os cidadãos registrados (aprovados no Tabelionato), por id do registro.
async function cidadaos() {
  const lista = await pessoasRegistradas();
  return new Map(lista.map(p => [p.registro_id, p]));
}
// A profissão escrita no registro do Tabelionato (só para consulta: nunca vira vínculo sozinha).
const profissaoDoRegistro = p => p?.detalhes?.find(d => /^(profiss|oficio)/.test(chaveNome(d.rotulo)))?.valor || null;

/* ─── Tesouro ────────────────────────────────────── */

async function resumoTesouro() {
  const m = await db.get(`SELECT
      COALESCE(SUM(valor), 0) AS saldo,
      COALESCE(SUM(CASE WHEN tipo = 'saldo_inicial' THEN valor ELSE 0 END), 0) AS inicial,
      COALESCE(SUM(CASE WHEN tipo NOT IN ('saldo_inicial', 'salario', 'estorno') AND valor > 0 THEN valor
                        WHEN tipo = 'estorno' AND valor < 0 THEN valor ELSE 0 END), 0) AS receitas,
      COALESCE(SUM(CASE WHEN tipo NOT IN ('salario', 'estorno') AND valor < 0 THEN -valor
                        WHEN tipo = 'estorno' AND valor > 0 THEN -valor ELSE 0 END), 0) AS despesas,
      COALESCE(SUM(CASE WHEN tipo = 'salario' THEN -valor ELSE 0 END), 0) AS pagos
    FROM tesouro_movimentos`);
  const f = await db.get(`SELECT
      COALESCE(SUM(CASE WHEN f.situacao = 'revisao' THEN i.valor ELSE 0 END), 0) AS previstos,
      COALESCE(SUM(CASE WHEN f.situacao IN ('aprovada', 'paga') THEN i.valor ELSE 0 END), 0) AS aprovados,
      COALESCE(SUM(CASE WHEN f.situacao IN ('aprovada', 'paga') AND i.pago_em IS NULL THEN i.valor ELSE 0 END), 0) AS reservado
    FROM folha_itens i JOIN folhas f ON f.id = i.folha_id`);
  const saldo = r2(m.saldo);
  const reservado = r2(Math.max(0, f.reservado));
  return {
    saldo, saldo_inicial: r2(m.inicial), receitas: r2(m.receitas), despesas: r2(m.despesas),
    salarios_previstos: r2(f.previstos), salarios_aprovados: r2(f.aprovados), salarios_pagos: r2(m.pagos),
    reservado, disponivel: r2(saldo - reservado),
  };
}

/* ─── Folha de pagamento ─────────────────────────── */

// Folhas que já cobrem algum dia do período (as rejeitadas não contam).
const folhasNoPeriodo = (inicio, fim, exceto = 0) => db.all(
  "SELECT id, inicio, fim, situacao FROM folhas WHERE situacao <> 'rejeitada' AND inicio <= ? AND fim >= ? AND id <> ? ORDER BY inicio", fim, inicio, exceto);

// Calcula a folha de um período sem gravar nada (a prévia). Devolve os itens, o total por pessoa e os alertas.
async function calcularFolha(inicio, fim) {
  if (inicio > fim) throw erro(400, 'O início do período precisa vir antes do fim.');
  const dias = diasEntre(inicio, fim);
  if (dias > 92) throw erro(400, 'Escolha um período de no máximo 3 meses.');
  const config = await lerConfig();
  const pessoas = await cidadaos();
  const alertas = [];
  const alertar = (nivel, texto, extra = {}) => alertas.push({ nivel, texto, ...extra });
  const itens = [];

  const sobrepostas = await folhasNoPeriodo(inicio, fim);
  for (const f of sobrepostas) {
    alertar('erro', `A folha nº ${f.id} (${br(f.inicio)} a ${br(f.fim)}) já cobre parte deste período. Escolha outro período ou rejeite aquela folha antes.`, { folha_id: f.id });
  }

  const nomeDe = (registroId, guardado) => pessoas.get(registroId)?.nome || guardado || `Registro ${registroId}`;
  const avisados = new Set();
  const avisarSumido = (registroId, nome) => {
    if (pessoas.has(registroId) || avisados.has(registroId)) return;
    avisados.add(registroId);
    alertar('aviso', `${nome} não está mais entre os registros aprovados do Tabelionato. Confira antes de pagar.`, { registro_id: registroId });
  };

  // Salário fixo: um item por vínculo que valeu em algum dia do período.
  const fixos = await db.all(`SELECT v.*, p.nome AS profissao_nome, p.salario_base AS p_base, p.turnos_previstos AS p_turnos, p.frequencia,
      p.proporcional, p.justificada_conta, p.demonstracao
    FROM vinculos v JOIN profissoes p ON p.id = v.profissao_id
    WHERE p.remuneracao = 'fixo' AND v.inicio <= ? AND (v.fim IS NULL OR v.fim >= ?)
    ORDER BY v.cidadao_nome, p.ordem`, fim, inicio);
  const frequenciasDiferentes = new Set();
  for (const v of fixos) {
    const nome = nomeDe(v.registro_id, v.cidadao_nome);
    avisarSumido(v.registro_id, nome);
    if (v.situacao === 'suspenso') {
      alertar('info', `${nome} (${v.profissao_nome}): vínculo suspenso, sem salário fixo neste período.`, { registro_id: v.registro_id, vinculo_id: v.id });
      continue;
    }
    if (sobrepostas.length) continue; // o período já foi (em parte) pago em outra folha
    const de = maior(inicio, v.inicio);
    const ate = v.fim ? menor(fim, v.fim) : fim;
    const diasFreq = diasDaFrequencia(v.frequencia) || 7;
    if (dias !== diasFreq) frequenciasDiferentes.add(`${v.profissao_nome} (${nomeFrequencia(v.frequencia)})`);
    const baseCheia = Number(v.salario_base ?? v.p_base) || 0;
    const base = r2(baseCheia * dias / diasFreq);
    const previstos = Math.max(1, Math.round((Number(v.turnos_previstos ?? v.p_turnos) || 0) * dias / diasFreq));
    const presencas = await db.all(`SELECT id, situacao, turnos FROM presencas
      WHERE vinculo_id = ? AND data >= ? AND data <= ? AND folha_id IS NULL`, v.id, de, ate);
    const soma = s => presencas.filter(x => x.situacao === s).reduce((t, x) => t + Number(x.turnos), 0);
    const conta = s => presencas.filter(x => x.situacao === s).length;
    const cumpridos = r2(soma('presente') + soma('licenca') + soma('missao') + (v.justificada_conta ? soma('justificada') : 0));
    let valor = 0;
    if (baseCheia <= 0) {
      alertar('aviso', `${nome} (${v.profissao_nome}): salário-base não configurado.`, { registro_id: v.registro_id, vinculo_id: v.id });
    } else if (v.proporcional) {
      if (!presencas.length) {
        alertar('aviso', `${nome} (${v.profissao_nome}): nenhuma presença registrada no período, então o salário proporcional fica em 0.`, { registro_id: v.registro_id, vinculo_id: v.id });
      }
      valor = r2(base * Math.min(cumpridos, previstos) / previstos);
      if (cumpridos > previstos) {
        alertar('aviso', `${nome} (${v.profissao_nome}): ${cumpridos} turnos cumpridos, acima dos ${previstos} previstos. O pagamento fica no salário-base; para pagar mais, ajuste com justificativa.`, { registro_id: v.registro_id, vinculo_id: v.id });
      }
    } else {
      valor = base;
      if (de > inicio || ate < fim) {
        alertar('aviso', `${nome} (${v.profissao_nome}): o vínculo cobre só de ${br(de)} a ${br(ate)}, mas o salário fixo é do período inteiro. Confira.`, { registro_id: v.registro_id, vinculo_id: v.id });
      }
    }
    if (v.demonstracao) {
      alertar('aviso', `${v.profissao_nome}: o salário ainda é o valor de demonstração. Confira na Tabela de salários.`, { profissao: v.profissao_nome, chave: `demo-p-${v.profissao_id}` });
    }
    itens.push({
      tipo: 'fixo', registro_id: v.registro_id, cidadao_nome: nome, vinculo_id: v.id, profissao_nome: v.profissao_nome,
      descricao: v.proporcional ? `Salário: ${cumpridos} de ${previstos} turnos` : 'Salário fixo do período',
      calculado: valor, valor,
      detalhes: {
        base, base_frequencia: baseCheia, frequencia: v.frequencia, previstos, cumpridos, proporcional: !!v.proporcional,
        presentes: conta('presente'), faltas: conta('falta'), justificadas: conta('justificada'), licencas: conta('licenca'), missoes: conta('missao'),
        de, ate, presencas: presencas.map(x => x.id),
      },
    });
  }
  if (frequenciasDiferentes.size) {
    alertar('info', `O período tem ${dias} ${dias === 1 ? 'dia' : 'dias'}, diferente da frequência de ${[...frequenciasDiferentes].join(', ')}: o salário-base e os turnos previstos foram proporcionais aos dias.`);
  }

  // Produção: as entregas aceitas ainda não pagas até o fim do período (as atrasadas de períodos anteriores
  // também entram, com aviso), um item por vínculo, produto e valor unitário.
  const entregas = await db.all(`SELECT e.*, v.registro_id, v.cidadao_nome, p.nome AS profissao_nome, i.nome AS item_nome, i.unidade, i.demonstracao
    FROM entregas e JOIN vinculos v ON v.id = e.vinculo_id JOIN profissoes p ON p.id = v.profissao_id JOIN producao_itens i ON i.id = e.item_id
    WHERE e.situacao = 'aceita' AND e.folha_id IS NULL AND e.data <= ?
    ORDER BY v.cidadao_nome, e.data, e.id`, fim);
  const grupos = new Map();
  for (const e of entregas) {
    const k = `${e.vinculo_id}:${e.item_id}:${e.valor_unitario}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(e);
  }
  const demoItens = new Set();
  for (const lista of grupos.values()) {
    const e = lista[0];
    const nome = nomeDe(e.registro_id, e.cidadao_nome);
    avisarSumido(e.registro_id, nome);
    const quantidade = r2(lista.reduce((t, x) => t + Number(x.quantidade), 0));
    const valor = r2(lista.reduce((t, x) => t + Number(x.quantidade) * Number(x.valor_unitario), 0));
    const antigas = lista.filter(x => x.data < inicio);
    if (antigas.length) {
      alertar('info', `${nome}: ${antigas.length} ${antigas.length === 1 ? 'entrega aceita' : 'entregas aceitas'} de antes do período (${e.item_nome}) ainda não pagas entraram nesta folha.`, { registro_id: e.registro_id });
    }
    if (e.demonstracao && !demoItens.has(e.item_id)) {
      demoItens.add(e.item_id);
      alertar('aviso', `"${e.item_nome}" (${e.profissao_nome}) ainda usa o valor de demonstração. Detalhe o valor por produto ou recurso antes de pagar de verdade.`, { item_id: e.item_id });
    }
    itens.push({
      tipo: 'producao', registro_id: e.registro_id, cidadao_nome: nome, vinculo_id: e.vinculo_id, profissao_nome: e.profissao_nome,
      descricao: `${e.item_nome}, ${quantidade} ${e.unidade} × ${r2(e.valor_unitario)} Lírios`,
      calculado: valor, valor,
      detalhes: { item_id: e.item_id, item: e.item_nome, unidade: e.unidade, quantidade, valor_unitario: r2(e.valor_unitario), entregas: lista.map(x => x.id) },
    });
  }

  // Entregas que ainda esperam conferência no período não entram (só as aceitas são pagas).
  const pendentes = await db.get("SELECT COUNT(*) AS n FROM entregas WHERE situacao = 'pendente' AND data <= ?", fim);
  if (pendentes.n) alertar('aviso', `${pendentes.n} ${pendentes.n === 1 ? 'entrega espera' : 'entregas esperam'} conferência e não ${pendentes.n === 1 ? 'entra' : 'entram'} nesta folha.`);

  // Entregas iguais (mesma pessoa, produto, dia e quantidade) aceitas mais de uma vez: pode ser registro duplicado.
  const repetidas = await db.all(`SELECT e.vinculo_id, e.item_id, e.data, e.quantidade, COUNT(*) AS n, MIN(v.cidadao_nome) AS nome
    FROM entregas e JOIN vinculos v ON v.id = e.vinculo_id
    WHERE e.situacao = 'aceita' AND e.folha_id IS NULL AND e.data <= ?
    GROUP BY e.vinculo_id, e.item_id, e.data, e.quantidade HAVING COUNT(*) > 1`, fim);
  for (const x of repetidas) {
    alertar('aviso', `${x.nome}: ${x.n} entregas iguais (${x.quantidade} no dia ${br(x.data)}). Confira se não é registro duplicado.`);
  }

  // Totais por pessoa (a soma dos vínculos) e o geral.
  const porPessoa = new Map();
  for (const it of itens) {
    if (!porPessoa.has(it.registro_id)) porPessoa.set(it.registro_id, { registro_id: it.registro_id, nome: it.cidadao_nome, total: 0, itens: 0 });
    const p = porPessoa.get(it.registro_id);
    p.total = r2(p.total + it.valor);
    p.itens++;
  }
  const total = r2(itens.reduce((t, it) => t + it.valor, 0));
  const tesouro = await resumoTesouro();
  alertasDoOrcamento(alertar, total, tesouro, config);
  if (!itens.length) alertar('info', 'Nenhum pagamento a fazer neste período.');

  return {
    inicio, fim, dias, itens, total, alertas: alertasUnicos(alertas), tesouro, config,
    pessoas: [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

// O orçamento só avisa: nunca corta nem reduz pagamento para caber.
function alertasDoOrcamento(alertar, total, tesouro, config) {
  if (config.teto_folha > 0 && total > config.teto_folha) {
    alertar('aviso', `A folha (${total} Lírios) passa do teto de planejamento de ${config.teto_folha} Lírios.`, { chave: 'teto' });
  }
  if (total > tesouro.disponivel) {
    alertar('erro', `A folha (${total} Lírios) passa do saldo disponível do tesouro (${tesouro.disponivel} Lírios). Só aprova com autorização de pagamento excepcional.`, { chave: 'saldo' });
  } else if (config.reserva > 0 && tesouro.disponivel - total < config.reserva) {
    alertar('aviso', `Depois desta folha sobram ${r2(tesouro.disponivel - total)} Lírios disponíveis, abaixo da reserva de ${config.reserva} Lírios.`, { chave: 'reserva' });
  }
}

function alertasUnicos(lista) {
  const vistos = new Set();
  return lista.filter(a => {
    const k = a.chave || a.texto;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// Uma folha gravada, com os itens e os totais.
async function lerFolha(id) {
  const f = await db.get('SELECT * FROM folhas WHERE id = ?', id);
  if (!f) throw erro(404, 'Folha não encontrada.');
  const itens = (await db.all('SELECT * FROM folha_itens WHERE folha_id = ? ORDER BY cidadao_nome, id', id))
    .map(i => ({ ...i, calculado: r2(i.calculado), valor: r2(i.valor), detalhes: json(i.detalhes, {}), pago: !!i.pago_em }));
  const total = r2(itens.reduce((t, i) => t + i.valor, 0));
  const pago = r2(itens.filter(i => i.pago).reduce((t, i) => t + i.valor, 0));
  const porPessoa = new Map();
  for (const it of itens) {
    if (!porPessoa.has(it.registro_id)) porPessoa.set(it.registro_id, { registro_id: it.registro_id, nome: it.cidadao_nome, total: 0, pago: 0, itens: 0 });
    const p = porPessoa.get(it.registro_id);
    p.total = r2(p.total + it.valor);
    if (it.pago) p.pago = r2(p.pago + it.valor);
    p.itens++;
  }
  return {
    ...f, alertas: json(f.alertas, []), excecao: f.excecao ? json(f.excecao, null) : null,
    itens, total, pago, a_pagar: r2(total - pago),
    pessoas: [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

module.exports = {
  r2, json, br, FREQUENCIAS, diasDaFrequencia, SITUACOES_PRESENCA, UNIDADES, diasEntre,
  lerConfig, auditar, cidadaos, profissaoDoRegistro, resumoTesouro, folhasNoPeriodo, calcularFolha, alertasDoOrcamento, lerFolha,
};
