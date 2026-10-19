// Escola Luckham: a assinatura da Direção nas fichas de alunos e professores.
// Usa a mesma almofada de assinatura dos registros (public/js/assinatura.js) e a mesma "última assinatura" guardada no navegador.
import { post, h, icone, modal, aviso, estado, dataHora } from '../core.js';
import { almofadaDeAssinatura, corpoDaAssinatura, desenharAssinatura, lerAssinatura, lerUltimaAssinatura, guardarUltimaAssinatura } from '../assinatura.js';
import { API } from './escola-comum.js';

const ROTA = { aluno: 'alunos', professor: 'professores' };

// modo: 'confirmar' (logo depois de matricular ou inscrever; dá para continuar sem assinar), 'assinar' ou 'refazer'.
// Depois de assinar (ou de continuar sem assinar) chama depois().
export function pedirAssinaturaEscola({ tipo, id, nome, modo = 'assinar', depois }) {
  const eu = estado.eu;
  const chave = `lyendell.assinatura.${eu.id}`;
  const confirmando = modo === 'confirmar';
  const refazer = modo === 'refazer';
  const quando = tipo === 'aluno' ? 'a matrícula' : 'a inscrição';
  let enviando = false;
  let fechada = false;

  const bOk = h('button', { class: 'btn btn-ouro', type: 'button', disabled: true, onclick: () => enviar() },
    confirmando ? 'Assinar e confirmar' : refazer ? 'Trocar a assinatura' : 'Assinar a ficha');
  const bSem = confirmando && h('button', { class: 'btn btn-fantasma assinar-sem', type: 'button', onclick: () => seguirSemAssinar() }, 'Continuar sem assinar');
  const bCancelar = !confirmando && h('button', { class: 'btn', type: 'button', onclick: () => janela.fechar() }, 'Cancelar');
  const almofada = almofadaDeAssinatura({ aoMudar: vazio => { bOk.disabled = enviando || vazio; } });
  const ultima = lerUltimaAssinatura(chave);
  const bUsar = ultima && h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => almofada.definir(ultima) },
    icone('pena'), h('span', null, 'Usar a minha última assinatura'));

  function travar(sim) {
    enviando = sim;
    bOk.disabled = sim || almofada.vazio();
    for (const b of [bSem, bCancelar, bUsar]) if (b) b.disabled = sim;
    bOk.classList.toggle('carregando', sim);
  }

  function seguirSemAssinar() {
    if (enviando) return;
    janela.fechar();
  }

  async function enviar() {
    if (enviando || almofada.vazio()) return;
    travar(true);
    try {
      await post(`${API}/${ROTA[tipo]}/${id}/assinar`, corpoDaAssinatura(almofada.tracos()));
      guardarUltimaAssinatura(almofada.tracos(), chave);
      aviso(confirmando ? `Assinado: ${tipo === 'aluno' ? 'a matrícula' : 'a inscrição'} está confirmada pela Direção.` : 'Assinatura da Direção guardada na ficha.');
      fechada = true;
      janela.fechar();
    } catch (e) {
      aviso(e.message, 'erro');
      travar(false);
    }
  }

  const janela = modal({
    titulo: confirmando ? `Assine para confirmar ${quando}` : refazer ? 'Refazer a assinatura' : 'Assinar a ficha',
    tamanho: 'medio', classe: 'modal-assinar',
    aoFechar: () => { if (depois && fechada) Promise.resolve(depois()).catch(() => {}); },
    corpo: h('div', { class: 'assinar' },
      h('p', { class: 'assinar-intro' }, confirmando
        ? `${nome} já está ${tipo === 'aluno' ? 'na escola' : 'inscrito'}. Assine no papel, com o mouse, o dedo ou a caneta, para confirmar ${quando}. A assinatura é opcional e dá para fazê-la depois, na ficha.`
        : `Assine a ficha de ${nome} no papel, com o mouse, o dedo ou a caneta. ${refazer ? 'A nova assinatura toma o lugar da anterior.' : ''}`.trim()),
      almofada.elemento,
      h('p', { class: 'assinar-quem' }, h('strong', null, eu.nome), h('span', null, 'Direção da Escola')),
      bUsar),
    rodape: [bSem, h('span', { class: 'espaco' }), bCancelar, bOk],
  });
  return janela;
}

// O bloco "Assinatura da Direção" da ficha: a assinatura desenhada com nome e data, ou o convite para assinar.
// d: { assinatura, assinado_por_nome, assinado_em }; podeAssinar: quem tem escola.gerir.
export function blocoAssinatura({ tipo, id, nome, d, podeAssinar, aoMudar }) {
  const tracos = lerAssinatura(d.assinatura);
  const abrir = modo => pedirAssinaturaEscola({ tipo, id, nome, modo, depois: aoMudar });
  const tinta = h('div', { class: 'escola-assina-tinta' });
  if (tracos) desenharAssinatura(tinta, tracos, { ajustar: true, rotulo: `Assinatura da Direção na ficha de ${nome}` });
  return h('div', { class: `escola-assina ${tracos ? 'assinada' : ''}`.trim() },
    tracos
      ? [tinta,
        h('p', { class: 'escola-assina-quem' }, h('strong', null, d.assinado_por_nome || 'Direção'), h('small', { class: 'suave' }, d.assinado_em ? ` · ${dataHora(d.assinado_em)}` : ''))]
      : h('p', { class: 'suave escola-assina-vazia' }, podeAssinar ? 'Esta ficha ainda não foi assinada pela Direção.' : 'A Direção ainda não assinou esta ficha.'),
    podeAssinar && h('button', {
      class: `btn ${tracos ? '' : 'btn-ouro'}`.trim(), type: 'button', onclick: () => abrir(tracos ? 'refazer' : 'assinar'),
    }, icone('pena'), h('span', null, tracos ? 'Refazer a assinatura' : 'Assinar')));
}
