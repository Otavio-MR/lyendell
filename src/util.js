class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const erro = (status, mensagem) => new ErroHttp(status, mensagem);

// Texto livre: normaliza acentos, remove espaços das pontas e corta no tamanho máximo.
function texto(valor, max = 200) {
  if (valor == null) return '';
  return String(valor).normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
}

// Texto de uma linha só (nomes, títulos).
function linha(valor, max = 120) {
  return texto(valor, max * 2).replace(/\s+/g, ' ').slice(0, max);
}

// Chave usada para comparar nomes de personagem: sem acento, sem maiúscula.
// Assim "José", "jose" e "JOSÉ" são a mesma pessoa no login.
function chaveNome(nome) {
  return String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function inteiro(valor, { min = 0, max = 1e9 } = {}) {
  if (valor === '' || valor == null) return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function idDaRota(req, nome = 'id') {
  const n = inteiro(req.params[nome], { min: 1 });
  if (n == null) throw erro(404, 'Não encontrado.');
  return n;
}

function dataValida(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

module.exports = { ErroHttp, erro, texto, linha, chaveNome, inteiro, idDaRota, dataValida };
