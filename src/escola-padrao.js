// A Escola Luckham: valores iniciais (do jornal "A Escola Luckham convoca!") e a migração dos registros que a
// escola tinha no Tabelionato (os livros "Corpo Docente" e "Matrículas") para o sistema próprio da escola.
// Tudo é idempotente: pode rodar de novo sem repetir nada (cada item importado guarda de qual registro veio).
const { chaveNome } = require('./util');

// As disciplinas do jornal. Os professores são escolhidos por disciplina (um titular e um substituto).
const DISCIPLINAS_PADRAO = [
  'História de Eldoria',
  'Matemática e Economia',
  'Geografia de Eldoria',
  'Autodefesa',
  'Linguagem: falar, ler e escrever',
  'Etiqueta',
];

// Os textos da escola, do jornal. O Diretor edita tudo em Configurações.
const CONFIG_PADRAO = {
  nome: 'Escola Luckham',
  diretor: 'Lorde Evran Luckham',
  idade_min: 1,
  idade_max: 16,
  media_aprovacao: 6,
  frequencia_minima: 75,
  lema: 'Pela educação, pelo conhecimento e pelo futuro de Eldoria.',
  edital_alunos: 'Aos pais e responsáveis, a Escola Luckham convida seus filhos a fazerem parte dessa jornada de aprendizado. Aqui, as crianças poderão aprender, desenvolver suas habilidades e estudar de forma independente, sem distinção de origem ou Casa.',
  edital_professores: 'A Escola Luckham, sob a direção do Lorde Evran Luckham, abre inscrições para professores comprometidos com a educação das próximas gerações.',
  selecao: 'A seleção será feita entre os inscritos, com um professor titular por disciplina. Também será possível indicar um substituto de confiança, caso necessário.',
  como_inscrever: 'Procure o Lorde Evran Luckham, Diretor da Escola Luckham, ou alguém do Tabelionato de Lyendell, incluindo a Srta. Layla Weeslay.',
  rodape: 'De Lyendell para toda Eldoria, que o conhecimento viaje por nossas estradas e que nenhuma boa história seja esquecida.',
};

/* ─── Valores iniciais ───────────────────────────── */

// Entram uma vez só (meta 'escola_semeada'). Depois a Escola é do Diretor: o que ele apagar ou mudar não volta.
async function semearEscola(db) {
  if (await db.get("SELECT valor FROM meta WHERE chave = 'escola_semeada'")) return;
  const vazio = !(await db.get('SELECT COUNT(*) AS n FROM escola_disciplinas')).n;
  await db.lote([
    ...(vazio ? DISCIPLINAS_PADRAO.map((nome, i) => [
      "INSERT INTO escola_disciplinas (nome, chave, ordem, criado_por_nome) VALUES (?, ?, ?, 'Sistema')", nome, chaveNome(nome), i]) : []),
    ["INSERT INTO meta (chave, valor) VALUES ('escola_config', ?) ON CONFLICT (chave) DO NOTHING", JSON.stringify(CONFIG_PADRAO)],
    ["INSERT INTO meta (chave, valor) VALUES ('escola_semeada', '1')"],
  ]);
}

/* ─── Migração: do Tabelionato para a Escola ─────── */

const json = (s, padrao) => { try { return JSON.parse(s); } catch { return padrao; } };
const nomeDoCampo = c => chaveNome(c.nome).replace(/:\s*$/, '').trim();
const texto = v => (v == null ? '' : String(Array.isArray(v) ? v.join(', ') : v).trim());
const dia = v => (/^\d{4}-\d{2}-\d{2}$/.test(texto(v)) ? texto(v) : null);
const foto = v => (texto(v).startsWith('/uploads/') ? texto(v) : null);

// Acha o campo do livro pelo nome (sem acento nem maiúscula); "n" escolhe entre campos com o mesmo nome.
function achar(campos, nomes, n = 0) {
  const lista = campos.filter(c => nomes.includes(nomeDoCampo(c)));
  return lista[n] || null;
}

// Em qual disciplina cai o texto que estava no formulário do Tabelionato (cria a disciplina se não existir).
async function disciplinaDe(db, nome, criadas) {
  const chave = chaveNome(nome);
  const todas = await db.all('SELECT id, nome, chave FROM escola_disciplinas');
  const achada = todas.find(d => d.chave === chave)
    || todas.find(d => chave.startsWith(d.chave.split(':')[0]) && d.chave.split(':')[0].length >= 6)
    || todas.find(d => d.chave.startsWith(chave.split(':')[0]) && chave.split(':')[0].length >= 6);
  if (achada) return achada.id;
  const limpo = texto(nome).replace(/\.$/, '') || 'Disciplina';
  const { id } = await db.run("INSERT INTO escola_disciplinas (nome, chave, ordem, criado_por_nome) VALUES (?, ?, ?, 'Importado do Tabelionato')",
    limpo, chaveNome(limpo) || `d${Date.now()}`, todas.length);
  criadas.push(limpo);
  return id;
}

const SITUACAO_ALUNO = { matriculado: 'matriculado', afastado: 'afastado', concluido: 'concluido' };
const SITUACAO_PROFESSOR = { titular: 'titular', substituto: 'substituto', afastado: 'afastado', desligado: 'desligado', 'em avaliacao': 'avaliacao' };

// Traz para a Escola os registros dos livros "Corpo Docente" e "Matrículas" que o Tabelionato tinha, e tira os
// dois livros do Tabelionato (passam para o módulo "escola_arquivo": nada é apagado, só deixa de aparecer lá).
// Devolve um resumo do que foi feito (vazio se não havia nada).
async function importarEscola(db) {
  const resumo = { alunos: 0, professores: 0, disciplinas: [], livros: [] };
  const livros = (await db.all("SELECT id, nome, campos FROM livros WHERE modulo = 'tabelionato'"))
    .filter(l => /escola/.test(chaveNome(l.nome)));
  for (const l of livros) {
    const nome = chaveNome(l.nome);
    const campos = json(l.campos, []);
    const imagens = campos.filter(c => c.tipo === 'imagem');
    const regs = await db.all("SELECT id, numero, situacao, dados, criado_por_nome, criado_em FROM registros WHERE livro_id = ? AND situacao <> 'recusado' ORDER BY id", l.id);
    if (/matricula|aluno/.test(nome)) {
      const c = {
        nome: achar(campos, ['nome do aluno', 'aluno', 'nome']), endereco: achar(campos, ['endereco', 'nick']),
        idade: achar(campos, ['idade']), resp: achar(campos, ['nome do responsavel', 'responsavel']),
        respEndereco: achar(campos, ['endereco do responsavel']), data: achar(campos, ['data da matricula', 'data']),
        situacao: achar(campos, ['situacao']), obs: achar(campos, ['observacoes pedagogicas', 'observacoes']), etapa: achar(campos, ['etapa de aprendizagem', 'etapa']),
      };
      for (const r of regs) {
        if (await db.get('SELECT id FROM escola_alunos WHERE origem_registro_id = ?', r.id)) continue;
        const d = json(r.dados, {});
        const nomeAluno = texto(d[c.nome?.id]);
        if (!nomeAluno) continue;
        const idade = Number.parseInt(texto(d[c.idade?.id]), 10);
        const notas = [texto(d[c.obs?.id])];
        if (r.situacao === 'pendente') notas.push('Veio do Tabelionato, onde o registro ainda aguardava aprovação.');
        const situacao = SITUACAO_ALUNO[chaveNome(texto(d[c.situacao?.id]))] || 'matriculado';
        const numero = r.numero && !(await db.get('SELECT id FROM escola_alunos WHERE numero = ?', r.numero)) ? r.numero : null;
        const { id } = await db.run(`INSERT INTO escola_alunos (numero, nome, endereco, foto, idade, responsavel_nome, responsavel_endereco, situacao, data_matricula, etapa, observacoes, origem_registro_id, criado_por_nome, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        numero, nomeAluno, texto(d[c.endereco?.id]), foto(d[imagens[0]?.id]), Number.isFinite(idade) ? idade : null, texto(d[c.resp?.id]), texto(d[c.respEndereco?.id]),
        situacao, dia(d[c.data?.id]) || String(r.criado_em).slice(0, 10), texto(d[c.etapa?.id]), notas.filter(Boolean).join('\n'), r.id, r.criado_por_nome || 'Tabelionato', r.criado_em);
        if (!numero) await db.run('UPDATE escola_alunos SET numero = (SELECT COALESCE(MAX(numero), 0) + 1 FROM escola_alunos) WHERE id = ? AND numero IS NULL', id);
        await db.run("INSERT INTO escola_historico (entidade, entidade_id, acao, detalhe, usuario_nome) VALUES ('aluno', ?, 'importar', ?, 'Sistema')", id, `Matrícula trazida do Tabelionato (registro ${r.id})`);
        resumo.alunos++;
      }
    } else if (/docente|professor/.test(nome)) {
      const c = {
        nome: achar(campos, ['nome do professor', 'professor', 'nome']), endereco: achar(campos, ['endereco']), disciplina: achar(campos, ['disciplina']),
        obs: achar(campos, ['observacoes'], 0), ingresso: achar(campos, ['data de ingresso', 'ingresso']), situacao: achar(campos, ['situacao']),
        subNome: achar(campos, ['nome do substituto']), subEndereco: achar(campos, ['endereco do substituto']), subObs: achar(campos, ['observacoes'], 1),
      };
      for (const r of regs) {
        if (await db.get('SELECT id FROM escola_professores WHERE origem_registro_id = ?', r.id)) continue;
        const d = json(r.dados, {});
        const nomeProf = texto(d[c.nome?.id]);
        if (!nomeProf) continue;
        const disciplinaId = await disciplinaDe(db, texto(d[c.disciplina?.id]) || 'Sem disciplina', resumo.disciplinas);
        const inserir = async (nomePessoa, endereco, fotoUrl, situacao, obs) => {
          try {
            const { id } = await db.run(`INSERT INTO escola_professores (disciplina_id, nome, endereco, foto, situacao, ingresso, observacoes, origem_registro_id, criado_por_nome, criado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            disciplinaId, nomePessoa, endereco, fotoUrl, situacao, dia(d[c.ingresso?.id]), obs, r.id, r.criado_por_nome || 'Tabelionato', r.criado_em);
            await db.run("INSERT INTO escola_historico (entidade, entidade_id, acao, detalhe, usuario_nome) VALUES ('professor', ?, 'importar', ?, 'Sistema')", id, `Trazido do Tabelionato (registro ${r.id})`);
            resumo.professores++;
          } catch (e) {
            // Já existe titular (ou substituto) nessa disciplina: entra como inscrito, para o Diretor decidir.
            if (!/UNIQUE/i.test(e.message) || situacao === 'avaliacao') throw e;
            await inserir(nomePessoa, endereco, fotoUrl, 'avaliacao', obs);
          }
        };
        await inserir(nomeProf, texto(d[c.endereco?.id]), foto(d[imagens[0]?.id]), SITUACAO_PROFESSOR[chaveNome(texto(d[c.situacao?.id]))] || 'avaliacao', texto(d[c.obs?.id]));
        if (texto(d[c.subNome?.id])) {
          await inserir(texto(d[c.subNome.id]), texto(d[c.subEndereco?.id]), foto(d[imagens[1]?.id]), 'substituto', texto(d[c.subObs?.id]));
        }
      }
    } else continue;
    // O livro sai do Tabelionato (guardado, sem aparecer em lugar nenhum).
    await db.run("UPDATE livros SET modulo = 'escola_arquivo' WHERE id = ?", l.id);
    resumo.livros.push(l.nome);
  }
  return resumo;
}

module.exports = { DISCIPLINAS_PADRAO, CONFIG_PADRAO, semearEscola, importarEscola };
