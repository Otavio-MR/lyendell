// A Ilha do Club Coelho: o registro das salas que ficam fora de clube-salas.js. Cada região da ilha
// (public/js/ilha/*.js) chama registrarRegiao com as salas que desenha, as informações do mapa e as ações
// dos pontos de clique. Não usa nada da página: dá para importar e testar no Node.
//
//   salas: { id: { fundo(g), animar(g, t), objetos: [{ y, desenhar(g, t) }], pontos: [{ x0, y0, x1, y1, ir: [x, y], acao, rotulo }] } }
//   info:  { id: { nome, desc, regiao, icone, mapa: { x, y } | null } }   (mapa null = sala escondida, fora do mapa)
//   acoes: { nome: (ctx, arg) => {} }   o ponto com acao "nome" ou "nome:arg" chama a função
//
// ctx (montado pela tela do clube): { visual, eu, sala, irPara(destino), aviso(texto, tipo), enviar(tipo, dados),
//   mudarMoedas(n), terminarMinijogo(jogo, pontos) -> Promise<{ ganhou, moedas }>, progresso: { ler(chave), gravar(chave, valor) },
//   presentes() -> [{ id, nome, x, y }] }
import { SALAS } from './clube-salas.js';

// As salas de sempre (de clube-salas.js), para o mapa da ilha.
export const INFO_SALAS = {
  praca: { nome: 'Praça do Clube', desc: 'A fonte, os bancos e as portas para todo o clube.', regiao: 'centro', icone: 'casa', mapa: { x: 500, y: 330 } },
  cafe: { nome: 'Café da Cenoura', desc: 'Um café quentinho e um bolo de cenoura.', regiao: 'centro', icone: 'cenoura', mapa: null },
  loja: { nome: 'Armarinho', desc: 'Roupas, acessórios e móveis para a toca.', regiao: 'centro', icone: 'loja', mapa: null },
  danca: { nome: 'Salão de Dança', desc: 'Pista colorida e a máquina Dança da Toca.', regiao: 'centro', icone: 'musica', mapa: null },
  lago: { nome: 'Lago Cintilante', desc: 'Pescaria com o velho pescador.', regiao: 'centro', icone: 'gota', mapa: { x: 380, y: 360 } },
};

export const ACOES = {};
const regioes = [];

export function registrarRegiao({ id = null, salas = {}, info = {}, acoes = {} } = {}) {
  Object.assign(SALAS, salas);
  Object.assign(INFO_SALAS, info);
  Object.assign(ACOES, acoes);
  if (id) regioes.push(id);
}
export const regioesCarregadas = () => [...regioes];

// "nome:arg" -> [função, arg] (ou null se ninguém registrou essa ação).
export function acaoDaIlha(acao) {
  const i = acao.indexOf(':');
  const nome = i < 0 ? acao : acao.slice(0, i);
  const arg = i < 0 ? undefined : acao.slice(i + 1);
  return ACOES[nome] ? [ACOES[nome], arg] : null;
}
