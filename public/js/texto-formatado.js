// Texto com formatação simples, no mesmo jeito de escrever do Discord, para o anúncio sair igual no site e
// no canal: **negrito**, *itálico* (ou _itálico_), __sublinhado__, ~~riscado~~, listas com "- " (ou "• ")
// e listas numeradas ("1. "), citação com "> ". Os emojis vão como são. Monta os elementos um a um (nada de
// innerHTML), então o texto de quem escreveu nunca vira código na página.

import { h } from './core.js';

// Os marcadores, do mais comprido para o mais curto (assim ** não é lido como dois *).
const MARCAS = [
  ['**', 'strong'], ['__', 'u'], ['~~', 's'], ['*', 'em'], ['_', 'em'],
];

function linhaFormatada(texto) {
  const saida = [];
  let i = 0;
  let solto = '';
  const soltar = () => { if (solto) { saida.push(solto); solto = ''; } };
  while (i < texto.length) {
    const marca = MARCAS.find(([m]) => texto.startsWith(m, i));
    if (marca) {
      const [m, tag] = marca;
      const fim = texto.indexOf(m, i + m.length);
      // Só vale se fechar na mesma linha e tiver algo dentro (ex.: "2 * 3 * 4" fica como está se não fechar).
      if (fim > i + m.length && !(m.length === 1 && /\s/.test(texto[i + 1]))) {
        soltar();
        saida.push(h(tag, null, ...linhaFormatada(texto.slice(i + m.length, fim))));
        i = fim + m.length;
        continue;
      }
    }
    solto += texto[i];
    i++;
  }
  soltar();
  return saida;
}

export function textoFormatado(texto, classe = 'texto-formatado') {
  const raiz = h('div', { class: classe });
  let lista = null;
  let tipoLista = '';
  for (const bruta of String(texto || '').split('\n')) {
    const item = /^\s*(?:[-•·*]\s+)(.*)$/.exec(bruta);
    const numero = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(bruta);
    const citacao = /^\s*>\s?(.*)$/.exec(bruta);
    if (item || numero) {
      const tipo = item ? 'ul' : 'ol';
      if (!lista || tipoLista !== tipo) { lista = h(tipo); tipoLista = tipo; raiz.append(lista); }
      lista.append(h('li', null, ...linhaFormatada((item || numero)[1])));
      continue;
    }
    lista = null;
    if (citacao) raiz.append(h('blockquote', null, ...linhaFormatada(citacao[1])));
    else if (!bruta.trim()) raiz.append(h('div', { class: 'tf-espaco' }));
    else raiz.append(h('p', null, ...linhaFormatada(bruta)));
  }
  return raiz;
}

// O texto sem as marcas (para resumos, como "Últimos anúncios" na tela inicial e o livro do Minecraft).
export function semFormatacao(texto) {
  return String(texto || '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2').replace(/(^|[^\w])_(?!\s)(.+?)_/g, '$1$2')
    .replace(/^\s*[•·]\s+/gm, '- ').replace(/^\s*>\s?/gm, '');
}
