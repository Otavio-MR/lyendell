// Códigos secretos dos joguinhos: uma sequência de setas (teclado, dedo ou as setinhas da tela) ou uma
// palavra escrita no teclado liga um modo secreto. Repetir o código desliga.
// Os que facilitam o jogo deixam a partida sem recorde; os de enfeite (e os que dificultam) valem.
// Cada código descoberto fica guardado no perfil (Livro de segredos, na Recreação) e dá conquista.

import { h, icone, post, get, aoSair, trocar } from './core.js';

// seq: setas; texto: palavra (sem acento). instantaneo: acontece uma vez na hora (não liga nem desliga).
export const SEGREDOS = {
  'cobra-arcoiris': {
    jogos: ['cobrinha'], nome: 'Cobra arco-íris', recorde: true,
    seq: ['baixo', 'baixo', 'cima', 'cima', 'esquerda', 'esquerda', 'direita', 'direita'],
    efeito: 'A cobra fica com todas as cores do arco-íris.',
    dica: 'Cobrinha: duas para baixo, duas para cima, e assim por diante para cada lado.',
  },
  'cobra-portal': {
    jogos: ['cobrinha'], nome: 'Paredes de portal', recorde: false,
    seq: ['esquerda', 'direita', 'esquerda', 'direita', 'esquerda', 'direita'],
    efeito: 'A cobra sai por uma parede e entra pela do outro lado.',
    dica: 'Cobrinha: fique indeciso entre a esquerda e a direita, três vezes.',
  },
  'cobra-turbo': {
    jogos: ['cobrinha'], nome: 'Cobra turbo', recorde: true,
    seq: ['cima', 'baixo', 'cima', 'baixo', 'cima', 'baixo'],
    efeito: 'A cobra anda muito mais rápido. Difícil, mas vale recorde!',
    dica: 'Cobrinha: sobe e desce, sobe e desce, sobe e desce.',
  },
  'pac-konami': {
    jogos: ['pacman'], nome: 'Código Konami', recorde: false, instantaneo: true,
    seq: ['cima', 'cima', 'baixo', 'baixo', 'esquerda', 'direita', 'esquerda', 'direita'],
    efeito: 'Mais 5 vidas para o coelho (uma vez por partida).',
    dica: 'Pac-Coelho: o código mais famoso da história dos videogames.',
  },
  'pac-buuu': {
    jogos: ['pacman'], nome: 'Buuu!', recorde: false, instantaneo: true,
    texto: 'buuu',
    efeito: 'As raposas levam um susto e ficam com medo (uma vez por nível).',
    dica: 'Pac-Coelho: escreva o barulho que assusta as raposas.',
  },
  'pac-neve': {
    jogos: ['pacman'], nome: 'Coelho da neve', recorde: true,
    texto: 'neve',
    efeito: 'O coelho dourado fica branquinho como a neve.',
    dica: 'Pac-Coelho: escreva o que cai do céu no inverno.',
  },
  '2048-desfazer': {
    jogos: ['2048'], nome: 'Voltar no tempo', recorde: false,
    seq: ['cima', 'cima', 'baixo', 'baixo', 'esquerda', 'direita', 'esquerda', 'direita'],
    efeito: 'Aparece o botão de desfazer a última jogada.',
    dica: '2048: o código mais famoso dos videogames também funciona aqui.',
  },
  '2048-ouro': {
    jogos: ['2048'], nome: 'Bloco de ouro', recorde: false, instantaneo: true,
    texto: 'ouro',
    efeito: 'Um bloco de 128 aparece num espaço vazio (uma vez por partida).',
    dica: '2048: escreva o metal mais precioso.',
  },
  '2048-coelho': {
    jogos: ['2048'], nome: 'Blocos coelhinhos', recorde: true,
    texto: 'coelho',
    efeito: 'Cada bloco ganha um coelhinho.',
    dica: '2048: escreva o bicho da Casa Luckham.',
  },
  'minado-xyzzy': {
    jogos: ['minado'], nome: 'Palavra mágica', recorde: false,
    texto: 'xyzzy',
    efeito: 'Passe o mouse numa casa: se tiver armadilha, o pontinho vermelho acende.',
    dica: 'Campo Minado: a palavra mágica do Campo Minado antigo do Windows.',
  },
  'memoria-espiar': {
    jogos: ['memoria'], nome: 'Espiadinha', recorde: false, instantaneo: true,
    texto: 'espiar',
    efeito: 'Todas as cartas aparecem por 2 segundos (uma vez por partida).',
    dica: 'Memória: escreva o que você queria fazer com as cartas viradas.',
  },
  'quebra-numeros': {
    jogos: ['quebra'], nome: 'Peças numeradas', recorde: false,
    texto: 'numeros',
    efeito: 'Cada peça mostra o número do lugar certo dela.',
    dica: 'Quebra-cabeça: escreva o que ajudaria a saber o lugar de cada peça.',
  },
  'quebra-ima': {
    jogos: ['quebra'], nome: 'Ímã', recorde: false,
    texto: 'ima',
    efeito: 'As peças que já estão no lugar certo brilham.',
    dica: 'Quebra-cabeça: escreva o objeto que puxa as coisas para perto.',
  },
  festa: {
    jogos: ['minado', 'memoria', 'quebra'], nome: 'Modo festa', recorde: true,
    texto: 'festa',
    efeito: 'Chuva de confete quando você ganha.',
    dica: 'Campo Minado, Memória ou Quebra-cabeça: escreva o que dá vontade de fazer quando ganha.',
  },
};
export const NOME_JOGO = { cobrinha: 'Cobrinha', pacman: 'Pac-Coelho', 2048: '2048', minado: 'Campo Minado', memoria: 'Memória', quebra: 'Quebra-cabeça' };
const SETA = { cima: '↑', baixo: '↓', esquerda: '←', direita: '→' };
const TECLAS = {
  ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esquerda', ArrowRight: 'direita',
  KeyW: 'cima', KeyS: 'baixo', KeyA: 'esquerda', KeyD: 'direita',
};
export const comoFazer = s => (s.seq ? s.seq.map(d => SETA[d]).join(' ') : `escreva "${s.texto}"`);
const semAcento = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Os códigos que esta pessoa já descobriu (para o Livro de segredos).
export const segredosDescobertos = () => get('/api/recreacao/segredos');

// Liga o detector numa tela de jogo. bloqueado: no desafio os códigos não funcionam (todos jogam igual).
// aoMudar(chave, ligado): um modo foi ligado ou desligado. aoUsar(chave): código de uma vez só (devolve
// false se não deu para usar agora, ex.: já usado nesta partida).
export function segredosDoJogo(jogo, { bloqueado = false, aoMudar, aoUsar } = {}) {
  const meus = Object.entries(SEGREDOS).filter(([, s]) => s.jogos.includes(jogo));
  const ativos = new Set();
  let ajudou = false; // usou algum código que facilita nesta partida
  let setas = [];
  let letras = '';
  const avisados = new Set();
  const selo = h('div', { class: 'segredo-selo', hidden: true });
  document.body.append(selo);

  function desenharSelo() {
    selo.hidden = !ativos.size;
    trocar(selo, [...ativos].map(chave => h('span', { class: 'segredo-modo' },
      icone('estrela'), SEGREDOS[chave].nome,
      h('button', { type: 'button', class: 'segredo-desligar', title: 'Desligar', 'aria-label': `Desligar ${SEGREDOS[chave].nome}`, onclick: () => alternar(chave) }, icone('x')))),
    ajudou && h('small', null, 'esta partida não vale recorde'));
  }

  function anunciar(chave, texto, recusado = false) {
    const s = SEGREDOS[chave];
    const flash = h('div', { class: 'segredo-flash', 'aria-hidden': 'true' }, h('span', null, 'CÓDIGO SECRETO!'));
    document.body.append(flash);
    setTimeout(() => flash.remove(), 1400);
    const caixa = document.getElementById('toasts');
    if (caixa) {
      const el = h('div', { class: 'toast chamada chamada-segredo', role: 'status' }, icone('estrela'),
        h('div', { class: 'chamada-texto' }, h('strong', null, s.nome), h('span', null, texto || s.efeito),
          !s.recorde && !recusado && h('small', null, s.instantaneo ? 'Esta partida não vale mais recorde.' : 'Enquanto estiver ligado, a partida não vale recorde.')));
      caixa.append(el);
      setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, 6000);
    }
    // Guarda no Livro de segredos (as conquistas chegam pela conexão ao vivo).
    if (!avisados.has(chave)) {
      avisados.add(chave);
      post('/api/recreacao/segredos', { chave }).catch(() => {});
    }
  }

  function alternar(chave) {
    const s = SEGREDOS[chave];
    if (s.instantaneo) {
      if (aoUsar?.(chave) === false) {
        anunciar(chave, 'Esse já foi usado agora. Tente de novo mais tarde!', true);
        return;
      }
      if (!s.recorde) ajudou = true;
      anunciar(chave);
      desenharSelo();
      return;
    }
    const ligar = !ativos.has(chave);
    if (ligar) {
      ativos.add(chave);
      if (!s.recorde) ajudou = true;
      anunciar(chave);
    } else {
      ativos.delete(chave);
    }
    aoMudar?.(chave, ligar);
    desenharSelo();
  }

  function conferir() {
    for (const [chave, s] of meus) {
      const certo = s.seq
        ? setas.length >= s.seq.length && s.seq.every((d, i) => setas[setas.length - s.seq.length + i] === d)
        : letras.endsWith(s.texto);
      if (certo) {
        setas = [];
        letras = '';
        alternar(chave);
        return;
      }
    }
  }

  const direcao = d => {
    if (bloqueado || !SETA[d]) return;
    setas = [...setas, d].slice(-12);
    conferir();
  };
  const aoTeclar = e => {
    if (bloqueado || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (TECLAS[e.code]) direcao(TECLAS[e.code]);
    if (e.key?.length === 1) {
      const l = semAcento(e.key);
      if (/^[a-z]$/.test(l)) { letras = (letras + l).slice(-12); conferir(); }
    }
  };
  document.addEventListener('keydown', aoTeclar, true);
  aoSair(() => { document.removeEventListener('keydown', aoTeclar, true); selo.remove(); });

  return {
    direcao, // as setas que não vêm do teclado (dedo, setinhas da tela)
    ativo: chave => ativos.has(chave),
    // Começa uma partida: só fica sem recorde se um código que facilita ainda estiver ligado.
    novaPartida() {
      ajudou = [...ativos].some(c => !SEGREDOS[c].recorde);
      desenharSelo();
    },
    valeRecorde: () => !ajudou,
  };
}
