// Quem mora (ou trabalha) num lugar do mapa: as pessoas dos registros do Tabelionato
// (Moradores, Nobres e Outros), de onde vêm a foto e os dados mostrados nas casas e nos prédios.
const { db } = require('./db');
const { chaveNome } = require('./util');

const LIVRO_DE_PESSOAS = /morador|nobre|outro/;
// Dados mostrados no mapa, nesta ordem, quando o registro tiver (pelo nome do campo, sem acento).
const DADOS_MOSTRADOS = [
  ['idade'], ['profissao', 'oficio'], ['cargo'], ['titulo'], ['estado civil'], ['a qual familia pertence', 'familia'],
  ['cargo na familia'], ['casa'], ['genero'], ['nickname', 'nick', 'nick do minecraft'],
];
const nomeDoCampo = c => chaveNome(c.nome).replace(/:$/, '').trim();

async function pessoasRegistradas() {
  const livros = (await db.all("SELECT id, nome, campos FROM livros WHERE modulo = 'tabelionato' ORDER BY ordem, id"))
    .filter(l => LIVRO_DE_PESSOAS.test(chaveNome(l.nome)));
  const pessoas = [];
  for (const l of livros) {
    const campos = JSON.parse(l.campos);
    const campoNome = campos.find(c => c.tipo === 'texto' && /^nome\b/.test(nomeDoCampo(c)));
    const campoNick = campos.find(c => c.tipo === 'texto' && /^nick/.test(nomeDoCampo(c)));
    const primeiro = campos.find(c => c.tipo === 'texto' || c.tipo === 'selecao');
    const fotos = campos.filter(c => c.tipo === 'imagem');
    const registros = await db.all("SELECT id, numero, dados FROM registros WHERE livro_id = ? AND situacao = 'aprovado' ORDER BY numero", l.id);
    for (const reg of registros) {
      const d = JSON.parse(reg.dados);
      const nome = String(d[campoNome?.id] || d[campoNick?.id] || d[primeiro?.id] || '').trim();
      if (!nome) continue;
      const detalhes = [];
      for (const nomes of DADOS_MOSTRADOS) {
        const c = campos.find(x => x !== campoNome && nomes.includes(nomeDoCampo(x)) && d[x.id] !== undefined && d[x.id] !== '' && d[x.id] !== false);
        if (c && !detalhes.some(x => x.id === c.id)) {
          detalhes.push({ id: c.id, rotulo: c.nome.replace(/:$/, '').trim(), valor: Array.isArray(d[c.id]) ? d[c.id].join(', ') : String(d[c.id]) });
        }
      }
      pessoas.push({
        nome, chave: chaveNome(nome), livro: l.nome, livro_id: l.id, registro_id: reg.id, numero: reg.numero,
        foto: fotos.map(c => d[c.id]).find(Boolean) || null,
        detalhes: detalhes.slice(0, 6).map(({ rotulo, valor }) => ({ rotulo, valor })),
      });
    }
  }
  return pessoas;
}

// Liga um nome às pessoas registradas: o nome exato, ou o único registro que tem todas as palavras
// ("Rudeus" acha "Rudeus Greyrat").
// Quando é só um palpite pelo nome da casa (ninguém foi escolhido à mão):
//  - nome de família ("Casa da Família Lombardi") não liga ninguém: nem todo Lombardi mora ali;
//  - quem já foi escolhido à mão para algum lugar fica de fora (mora lá, não aqui).
function acharPessoas(nome, pessoas, { palpite = false, escolhidos = new Set() } = {}) {
  const k = chaveNome(nome);
  if (palpite && /\bfamilia\b/.test(k)) return [];
  const livre = p => !(palpite && escolhidos.has(p.registro_id));
  const exata = pessoas.find(p => p.chave === k);
  if (exata) return livre(exata) ? [exata] : [];
  const palavras = k.split(' ');
  const parecidas = pessoas.filter(p => palavras.every(w => p.chave.split(' ').includes(w)) && livre(p));
  return parecidas.length === 1 ? parecidas : [];
}

// O que vai para a tela (sem a chave de busca).
const semChave = ({ chave, ...p }) => p;

module.exports = { pessoasRegistradas, acharPessoas, semChave };
