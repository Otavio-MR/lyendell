// Palavrões e palavras feias trocados por palavras de criança, para quem é personagem criança.
// Os adultos continuam vendo a mensagem como foi escrita; a criança recebe do servidor a versão limpa
// (a palavra feia nem chega no navegador dela). Cada palavrão vira sempre a mesma palavra boba.
//
// Para achar a palavra mesmo disfarçada: ignora acento e maiúscula, troca números e símbolos que
// imitam letras (p0rr4, @, $) e junta letras repetidas (porraaaa).

const { chaveNome } = require('./util');

// Palavras inteiras (já sem acento e sem letra repetida, como ficam depois de normalizar).
// De propósito ficam de fora palavras que também têm sentido inocente no RP: pau, rola, pinto, piranha, droga,
// burro e veado (os bichos), lixo, trouxa, chupar (uma laranja)...
const PALAVRAS = [
  // palavrões
  'pora', 'porada', 'porinha', 'caralho', 'caralha', 'caralhada', 'krl', 'crl', 'karalho', 'merda', 'merdinha', 'mrd',
  'bosta', 'bostinha', 'bostao', 'foda', 'fodase', 'fds', 'foder', 'fode', 'fodeu', 'fodido', 'fodida', 'fudido', 'fudida',
  'fudeu', 'fuder', 'fodao', 'puta', 'puto', 'putas', 'putos', 'putaria', 'putinha', 'putinho', 'putona', 'putao',
  'fdp', 'pqp', 'vsf', 'vtnc', 'tnc', 'tomanocu', 'cu', 'cuzao', 'cuzinho', 'cuzona', 'buceta', 'boceta', 'xoxota', 'xereca',
  'piroca', 'pica', 'punheta', 'siririca', 'boquete', 'cacete', 'cacetada', 'escroto', 'escrota', 'cagar', 'cagado',
  'cagada', 'cagao', 'porcaria', 'transar', 'tesao', 'tezao', 'gozar', 'gozei', 'gozou', 'sexo', 'pornografia',
  'porno', 'safado', 'safada', 'prostituta', 'vadia', 'vagabundo', 'vagabunda', 'arombado', 'arombada', 'arombados',
  'desgraca', 'desgracado', 'desgracada', 'maldito', 'maldita', 'inferno', 'capeta',
  // xingamentos
  'idiota', 'imbecil', 'babaca', 'otario', 'otaria', 'retardado', 'retardada', 'mongol', 'corno', 'corna', 'viado',
  'bicha', 'sapatao', 'cretino', 'cretina',
  // em inglês
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'bitches', 'dick', 'cunt', 'asshole', 'ashole', 'wtf', 'stfu',
  'nigga', 'niger', 'bastard', 'damn', 'porn',
].map(p => juntarRepetidas(p));
const PROIBIDAS = new Set(PALAVRAS);

// As palavras de criança que entram no lugar.
const TROCAS = ['abobrinha', 'pipoca', 'batatinha', 'jujuba', 'bolinho', 'pirulito', 'cocada', 'pudim', 'cenourinha', 'nuvenzinha', 'brigadeiro', 'minhoca'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

function juntarRepetidas(p) {
  return p.replace(/(.)\1+/g, '$1');
}

// A palavra como o filtro enxerga: sem acento, minúscula, sem disfarce e sem letra repetida.
function normalizar(palavra) {
  const semDisfarce = [...chaveNome(palavra)].map(ch => LEET[ch] ?? ch).join('').replace(/[^a-z]/g, '');
  return juntarRepetidas(semDisfarce);
}

const ehFeia = palavra => {
  const n = normalizar(palavra);
  return n.length > 0 && PROIBIDAS.has(n);
};

function troca(palavra, original) {
  let h = 0;
  for (const ch of palavra) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const t = TROCAS[h % TROCAS.length];
  if (original.length > 1 && original === original.toUpperCase() && /[A-ZÀ-Ý]/.test(original)) return t.toUpperCase();
  return /^[A-ZÀ-Ý]/.test(original) ? t[0].toUpperCase() + t.slice(1) : t;
}

// O texto do jeito que a criança vê. Palavra = letras, números e os símbolos que imitam letras.
function paraCriancas(texto) {
  const s = String(texto ?? '');
  const partes = s.split(/([\p{L}\p{N}@$!]+)/u); // as palavras ficam nas posições ímpares
  let mudou = false;
  for (let i = 1; i < partes.length; i += 2) {
    // "!" só conta como letra no meio da palavra (no fim é exclamação mesmo).
    const corpo = partes[i].replace(/!+$/, '');
    if (!ehFeia(corpo)) continue;
    partes[i] = troca(normalizar(corpo), corpo) + partes[i].slice(corpo.length);
    mudou = true;
  }
  return mudou ? partes.join('') : s;
}

module.exports = { paraCriancas, ehFeia };
