// Os nomes que quem troca os sprites deu às peças dos jogos (tabela sprites_nomes), guardados na memória.
// O servidor usa para os nomes que ele mesmo manda para o navegador (o catálogo do Club Coelho, por exemplo).
// Muda pela rota PUT /api/sprites/nome/:chave, que chama recarregar() e avisa quem ouve (aoMudar).
const { db } = require('./db');

const MAX_NOME = 40;
const nomes = new Map(); // chave da peça -> nome escolhido
const ouvintes = new Set();
let carga = null;

async function recarregar() {
  const linhas = await db.all('SELECT chave, nome FROM sprites_nomes');
  nomes.clear();
  for (const l of linhas) nomes.set(l.chave, l.nome);
  for (const fn of ouvintes) { try { fn(); } catch (e) { console.error('Nomes dos sprites:', e.message); } }
}

// Carrega uma vez (na primeira vez que alguém precisa).
function pronto() {
  carga ??= recarregar().catch(e => { carga = null; throw e; });
  return carga;
}

// O nome da peça (o escolhido, ou o de sempre).
const nomeDe = (chave, padrao) => (chave && nomes.get(chave)) || padrao;
const todos = () => Object.fromEntries(nomes);

function aoMudar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

// Limpa o nome que veio do navegador: uma linha, sem espaços sobrando, até 40 letras.
const limparNome = v => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME).trim();

module.exports = { MAX_NOME, pronto, recarregar, nomeDe, todos, aoMudar, limparNome };
