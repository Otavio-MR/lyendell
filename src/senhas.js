const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Senhas guardadas com scrypt + sal aleatório. Nunca em texto puro.
async function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(String(senha).normalize('NFC'), sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

async function verificarSenha(senha, guardado) {
  const [alg, salHex, hashHex] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido = await scrypt(String(senha).normalize('NFC'), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, obtido);
}

// Usado quando o nome não existe, para o login levar o mesmo tempo nos dois casos.
const HASH_FALSO = (() => {
  const sal = crypto.randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${crypto.scryptSync(crypto.randomBytes(12).toString('hex'), sal, 64).toString('hex')}`;
})();

function validarSenhaNova(senha) {
  const s = String(senha ?? '');
  if (s.length < 4) return 'A senha precisa ter pelo menos 4 caracteres.';
  if (s.length > 100) return 'A senha pode ter no máximo 100 caracteres.';
  return null;
}

module.exports = { hashSenha, verificarSenha, HASH_FALSO, validarSenhaNova };
