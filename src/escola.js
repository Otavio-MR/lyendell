// A Escola Luckham: as contas (frequência, médias e boletim) e a configuração.
// Frequência: falta justificada é abonada, então conta como presença: (presentes + justificadas) / total de chamadas.
// Média de uma disciplina: média das notas ponderada pelo peso; a média geral é a média das disciplinas que têm nota.
// Passa quem tem média igual ou maior que a média de aprovação da escola (padrão 6).
const { db } = require('./db');
const { CONFIG_PADRAO } = require('./escola-padrao');

const r1 = n => Math.round(n * 10) / 10;

async function lerConfig() {
  const l = await db.get("SELECT valor FROM meta WHERE chave = 'escola_config'");
  let salvo = {};
  try { salvo = JSON.parse(l?.valor || '{}'); } catch { salvo = {}; }
  return { ...CONFIG_PADRAO, ...salvo };
}

const percentual = (presentes, justificadas, total) => (total ? Math.round(((presentes + justificadas) / total) * 100) : null);

function contar(linhas) {
  const c = { presentes: 0, faltas: 0, justificadas: 0 };
  for (const l of linhas) {
    if (l.situacao === 'presente') c.presentes = Number(l.n);
    else if (l.situacao === 'falta') c.faltas = Number(l.n);
    else if (l.situacao === 'justificada') c.justificadas = Number(l.n);
  }
  const total = c.presentes + c.faltas + c.justificadas;
  return { ...c, total, percentual: percentual(c.presentes, c.justificadas, total) };
}

// A frequência de um aluno em todas as aulas que não foram canceladas.
async function frequenciaDe(alunoId) {
  return contar(await db.all(`SELECT p.situacao, COUNT(*) AS n FROM escola_presencas p JOIN escola_aulas a ON a.id = p.aula_id
    WHERE p.aluno_id = ? AND a.situacao <> 'cancelada' GROUP BY p.situacao`, alunoId));
}

// A frequência de todos os alunos de uma vez (para a lista): { alunoId: { percentual, total } }.
async function frequenciaDeTodos() {
  const linhas = await db.all(`SELECT p.aluno_id, p.situacao, COUNT(*) AS n FROM escola_presencas p JOIN escola_aulas a ON a.id = p.aula_id
    WHERE a.situacao <> 'cancelada' GROUP BY p.aluno_id, p.situacao`);
  const por = new Map();
  for (const l of linhas) { if (!por.has(l.aluno_id)) por.set(l.aluno_id, []); por.get(l.aluno_id).push(l); }
  return new Map([...por].map(([id, ls]) => [id, contar(ls)]));
}

const mediaPonderada = notas => {
  const pesos = notas.reduce((s, n) => s + Number(n.peso), 0);
  return pesos ? r1(notas.reduce((s, n) => s + Number(n.nota) * Number(n.peso), 0) / pesos) : null;
};
const situacaoDaMedia = (media, config) => (media == null ? 'sem_notas' : media >= Number(config.media_aprovacao) ? 'aprovado' : 'recuperacao');

// O boletim de um aluno: cada disciplina (mesmo sem nota) com as notas, a média e a situação.
async function boletimDe(alunoId, config) {
  const disciplinas = await db.all('SELECT id, nome, ativa FROM escola_disciplinas ORDER BY ordem, nome');
  const notas = await db.all('SELECT * FROM escola_notas WHERE aluno_id = ? ORDER BY data, id', alunoId);
  const itens = [];
  for (const d of disciplinas) {
    const minhas = notas.filter(n => n.disciplina_id === d.id);
    if (!d.ativa && !minhas.length) continue;
    const media = mediaPonderada(minhas);
    itens.push({
      disciplina_id: d.id, disciplina_nome: d.nome, media, situacao: situacaoDaMedia(media, config),
      notas: minhas.map(n => ({ id: n.id, titulo: n.titulo, data: n.data, nota: n.nota, peso: n.peso, observacao: n.observacao, lancado_por_nome: n.lancado_por_nome })),
    });
  }
  const medias = itens.filter(i => i.media != null).map(i => i.media);
  const mediaGeral = medias.length ? r1(medias.reduce((s, m) => s + m, 0) / medias.length) : null;
  return { disciplinas: itens, media_geral: mediaGeral, situacao: situacaoDaMedia(mediaGeral, config), media_aprovacao: Number(config.media_aprovacao) };
}

// A média geral de todos os alunos de uma vez (para a lista): { alunoId: media }.
async function mediasDeTodos() {
  const notas = await db.all('SELECT aluno_id, disciplina_id, nota, peso FROM escola_notas');
  const por = new Map();
  for (const n of notas) {
    if (!por.has(n.aluno_id)) por.set(n.aluno_id, new Map());
    const m = por.get(n.aluno_id);
    if (!m.has(n.disciplina_id)) m.set(n.disciplina_id, []);
    m.get(n.disciplina_id).push(n);
  }
  return new Map([...por].map(([id, m]) => {
    const medias = [...m.values()].map(mediaPonderada).filter(x => x != null);
    return [id, medias.length ? r1(medias.reduce((s, x) => s + x, 0) / medias.length) : null];
  }));
}

module.exports = { lerConfig, frequenciaDe, frequenciaDeTodos, boletimDe, mediasDeTodos, mediaPonderada, situacaoDaMedia, r1, percentual };
