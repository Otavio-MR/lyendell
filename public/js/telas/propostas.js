// Propostas do povo (Congresso): qualquer morador manda uma ideia de lei, PEC, regra...; a Senadora avalia
// (viável vai para a pauta, inviável volta com o motivo) e, depois da sessão, registra a votação.
// A aprovada pode ser publicada no livro do Congresso, com o formulário já preenchido.

import { estado, get, post, put, del, h, trocar, icone, botao, botaoIcone, cabecalho, vazio, avatarPessoa, modal, modalForm, confirmar,
  aviso, tentar, campo, relativo, dataCurta, hojeIso, normalizar } from '../core.js';
import { abasModulo, formRegistro } from './livros.js';
import { livroDaPauta, livroDeProposta } from '../livro-mc.js';

const SITUACAO = {
  enviada: { nome: 'Esperando a Senadora', icone: 'relogio' },
  em_pauta: { nome: 'Na pauta do Congresso', icone: 'coluna' },
  aprovada: { nome: 'Aprovada', icone: 'check' },
  rejeitada: { nome: 'Rejeitada', icone: 'x' },
  inviavel: { nome: 'Inviável', icone: 'alerta' },
};
const PASSO = {
  enviada: 'mandou a proposta', em_pauta: 'levou para a pauta do Congresso', inviavel: 'achou inviável',
  aprovada: 'registrou: aprovada na votação', rejeitada: 'registrou: rejeitada na votação', adiada: 'registrou: votação adiada',
  publicada: 'publicou no livro do Congresso',
};
const FILTROS = [['enviada', 'Esperando a Senadora'], ['em_pauta', 'Na pauta'], ['aprovada', 'Aprovadas'], ['rejeitada', 'Rejeitadas'],
  ['inviavel', 'Inviáveis'], ['minhas', 'Minhas'], ['todas', 'Todas']];
const AJUDA_TIPO = 'Lei: uma regra nova. PEC: muda as regras mais importantes da cidade (a Constituição). Emenda: muda uma lei que já existe.';
let filtroAtual = null;

const votosTexto = p => (p.a_favor != null || p.contra != null
  ? `${p.a_favor ?? 0} a favor, ${p.contra ?? 0} contra${p.abstencoes ? `, ${p.abstencoes} ${p.abstencoes === 1 ? 'abstenção' : 'abstenções'}` : ''}` : '');

export async function propostas() {
  const raiz = h('div', { class: 'pagina propostas-pagina' });
  let d;
  let livros = [];
  let contagemModulo = {};

  async function carregar() {
    const [dados, mod] = await Promise.all([get('/api/propostas'), get('/api/modulos/congresso/livros')]);
    d = dados;
    livros = mod.livros;
    contagemModulo = mod.contagem;
    if (!filtroAtual) {
      filtroAtual = d.pode.avaliar && d.contagem.enviada ? 'enviada' : d.contagem.em_pauta ? 'em_pauta' : d.contagem.minhas && !d.pode.avaliar ? 'minhas' : 'todas';
    }
    desenhar();
    window.dispatchEvent(new Event('avisos'));
  }

  function lista() {
    const eu = estado.eu.id;
    const escolhidas = d.propostas.filter(p => filtroAtual === 'todas' || (filtroAtual === 'minhas' ? p.autor_id === eu : p.situacao === filtroAtual));
    // As que ainda vão ser decididas: as mais apoiadas primeiro. As decididas: as mais recentes primeiro.
    return escolhidas.sort((a, b) => (['enviada', 'em_pauta'].includes(filtroAtual) ? b.apoios - a.apoios : 0)
      || String(b.atualizado_em).localeCompare(String(a.atualizado_em)) || b.id - a.id);
  }

  function desenhar() {
    const emPauta = d.propostas.filter(p => p.situacao === 'em_pauta');
    const escolhidas = lista();
    trocar(raiz,
      cabecalho({
        titulo: 'Propostas do povo', icone: 'coluna', voltar: { href: '#/congresso', texto: 'Congresso' },
        sub: 'Tem uma ideia de lei, PEC ou regra para Lyendell? Mande para a Senadora. Ela avalia se é viável e leva as boas para o Congresso votar.',
        acoes: [
          d.pode.avaliar && emPauta.length > 0 && botao('Pauta em livro (.book)', {
            icone: 'baixar', onclick: () => livroDaPauta(emPauta, estado.eu.nome).baixar('Pauta do Congresso'),
          }),
          d.pode.propor && botao('Mandar uma proposta', { icone: 'pena', classe: 'btn-ouro', onclick: () => formProposta(d, null, carregar) }),
        ],
      }),
      abasModulo('congresso', 'propostas', contagemModulo),
      h('ol', { class: 'propostas-passos' },
        passo('pena', '1. Você manda', 'Qualquer morador manda a sua ideia e pode apoiar as dos outros.'),
        passo('balanca', '2. A Senadora avalia', 'As viáveis vão para a pauta; as inviáveis voltam com o motivo.'),
        passo('coluna', '3. O Congresso vota', 'Aprovada, rejeitada ou adiada. A aprovada vira lei no livro do Congresso.')),
      h('div', { class: 'segmentado propostas-filtros' }, FILTROS.map(([k, nome]) => {
        const n = k === 'todas' ? d.propostas.length : d.contagem[k] || 0;
        if (k === 'minhas' && !n && !d.pode.propor) return null;
        return h('button', {
          type: 'button', class: `seg ${filtroAtual === k ? 'ativo' : ''}`.trim(), onclick: () => { filtroAtual = k; desenhar(); },
        }, nome, h('span', { class: `aba-n ${k === 'enviada' && d.pode.avaliar && n ? 'aba-alerta' : ''}`.trim() }, n));
      })),
      escolhidas.length
        ? h('div', { class: 'propostas-lista' }, escolhidas.map(p => cartao(p)))
        : vazio(...vazioDoFiltro()));
  }

  function vazioDoFiltro() {
    return {
      enviada: ['Nenhuma proposta esperando', d.pode.avaliar ? 'Quando alguém mandar uma proposta, ela aparece aqui para você avaliar.' : 'A Senadora já avaliou todas as propostas.'],
      em_pauta: ['Nada na pauta', 'As propostas viáveis aparecem aqui até o Congresso votar.'],
      aprovada: ['Nenhuma aprovada ainda', 'Quando o Congresso aprovar uma proposta do povo, ela aparece aqui.'],
      rejeitada: ['Nenhuma rejeitada', 'As propostas que o Congresso recusar aparecem aqui.'],
      inviavel: ['Nenhuma inviável', 'As propostas que a Senadora achar inviáveis aparecem aqui, com o motivo.'],
      minhas: ['Você ainda não mandou nenhuma', 'Tem uma ideia para a cidade? Clique em "Mandar uma proposta".'],
      todas: ['Nenhuma proposta ainda', d.pode.propor ? 'Seja a primeira pessoa a mandar uma ideia para o Congresso!' : 'Quando os moradores mandarem ideias, elas aparecem aqui.'],
    }[filtroAtual];
  }

  function cartao(p) {
    const s = SITUACAO[p.situacao];
    const minha = p.autor_id === estado.eu.id;
    const podeApoiar = d.pode.propor && !minha && ['enviada', 'em_pauta'].includes(p.situacao);
    const acoes = [];
    if (podeApoiar) {
      acoes.push(botao(p.apoiei ? 'Apoiando' : 'Apoiar', {
        icone: p.apoiei ? 'check' : 'coracao', classe: `btn-pequeno ${p.apoiei ? 'btn-ouro' : ''}`.trim(),
        onclick: async () => { if (await tentar(() => post(`/api/propostas/${p.id}/apoio`))) carregar(); },
      }));
    }
    if (minha && p.situacao === 'enviada') {
      acoes.push(botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formProposta(d, p, carregar) }));
      acoes.push(botao('Retirar', {
        icone: 'x', classe: 'btn-pequeno btn-perigo-texto',
        onclick: async () => {
          if (await confirmar(`Retirar a proposta "${p.titulo}"? Ela some da lista.`, { ok: 'Retirar', perigo: true })
            && await tentar(() => del(`/api/propostas/${p.id}`), 'Proposta retirada.')) carregar();
        },
      }));
    }
    if (d.pode.avaliar) {
      if (p.situacao === 'enviada' || p.situacao === 'inviavel') {
        acoes.push(botao(p.situacao === 'inviavel' ? 'Reconsiderar: levar à pauta' : 'Viável: levar ao Congresso', { icone: 'coluna', classe: 'btn-pequeno btn-ouro', onclick: () => avaliar(p, true, carregar) }));
        if (p.situacao === 'enviada') acoes.push(botao('Inviável', { icone: 'alerta', classe: 'btn-pequeno btn-perigo-texto', onclick: () => avaliar(p, false, carregar) }));
      } else if (p.situacao === 'em_pauta') {
        acoes.push(botao('Registrar a votação', { icone: 'balanca', classe: 'btn-pequeno btn-ouro', onclick: () => decidir(p, carregar) }));
        acoes.push(botao('Tirar da pauta (inviável)', { icone: 'alerta', classe: 'btn-pequeno btn-perigo-texto', onclick: () => avaliar(p, false, carregar) }));
      } else {
        if (p.situacao === 'aprovada' && !p.publicada) acoes.push(botao('Publicar no livro do Congresso', { icone: 'livro', classe: 'btn-pequeno btn-ouro', onclick: () => publicar(p, livros, carregar) }));
        acoes.push(botao('Corrigir a votação', { icone: 'editar', classe: 'btn-pequeno', onclick: () => decidir(p, carregar) }));
      }
      acoes.push(botaoIcone('lixo', 'Apagar a proposta', async () => {
        if (await confirmar(`Apagar a proposta "${p.titulo}", de ${p.autor_nome}? Isso não tem volta.`, { ok: 'Apagar', perigo: true })
          && await tentar(() => del(`/api/propostas/${p.id}`), 'Proposta apagada.')) carregar();
      }, 'perigo'));
    }
    // Qualquer um baixa a proposta como livro do Minecraft (mod Scribble), no modelo da Casa.
    acoes.push(botao('Baixar .book', {
      icone: 'baixar', classe: 'btn-pequeno', titulo: 'Baixa a proposta como livro para o mod Scribble',
      onclick: () => livroDeProposta(p, estado.eu.nome).baixar(),
    }));
    if (p.publicada) acoes.push(h('a', { class: 'btn btn-pequeno', href: `#/congresso/${p.publicada.livro_id}/registro/${p.publicada.registro_id}` }, icone('livro'), h('span', null, 'Ver no livro')));

    return h('article', { class: `painel proposta proposta-${p.situacao}` },
      h('div', { class: 'proposta-topo' },
        h('span', { class: 'etiqueta etiqueta-ouro' }, p.tipo),
        h('span', { class: `proposta-situacao situacao-${p.situacao}` }, icone(s.icone), s.nome),
        (p.apoios > 0 || ['enviada', 'em_pauta'].includes(p.situacao)) && h('span', { class: 'proposta-apoios', title: 'Moradores que apoiam' }, icone('coracao'), ` ${p.apoios} ${p.apoios === 1 ? 'apoio' : 'apoios'}`)),
      h('h3', { class: 'proposta-titulo' }, p.titulo),
      h('p', { class: 'proposta-autor' },
        p.autor_id ? h('a', { href: `#/pessoa/${p.autor_id}` }, avatarPessoa({ nome: p.autor_nome, foto: p.foto, moldura: p.moldura }, 'avatar-p')) : avatarPessoa({ nome: p.autor_nome }, 'avatar-p'),
        h('span', null, 'Proposta de ', h('strong', null, p.autor_nome), ` · ${relativo(p.criado_em)}`)),
      h('div', { class: 'proposta-bloco' }, h('h4', null, 'O que muda'), textoGrande(p.resumo)),
      p.texto && h('details', { class: 'proposta-mais' }, h('summary', null, 'Texto completo'), h('p', { class: 'texto-livre' }, p.texto)),
      p.justificativa && h('div', { class: 'proposta-bloco' }, h('h4', null, 'Por que é uma boa ideia'), textoGrande(p.justificativa)),
      p.parecer && h('div', { class: `proposta-parecer ${p.situacao === 'inviavel' ? 'ruim' : ''}`.trim() },
        h('strong', null, icone('balanca'), ` Parecer${p.parecer_nome ? ` de ${p.parecer_nome}` : ' da Senadora'}`), h('p', { class: 'texto-livre' }, p.parecer)),
      ['aprovada', 'rejeitada'].includes(p.situacao) && h('div', { class: `proposta-votacao ${p.situacao}` },
        h('strong', null, icone(p.situacao === 'aprovada' ? 'check' : 'x'), p.situacao === 'aprovada' ? ' Aprovada no Congresso' : ' Rejeitada no Congresso',
          p.votacao ? ` em ${dataCurta(p.votacao)}` : ''),
        votosTexto(p) && h('p', null, votosTexto(p)),
        p.resultado && h('p', { class: 'texto-livre' }, p.resultado)),
      p.historico.length > 1 && h('details', { class: 'proposta-mais proposta-andamento' }, h('summary', null, 'Andamento'),
        h('ol', null, p.historico.map(x => h('li', null,
          h('time', null, dataCurta(x.em)), ' ', h('strong', null, x.por), ` ${PASSO[x.acao] || x.acao}`,
          x.votacao ? ` (votação em ${dataCurta(x.votacao)})` : '', x.votos ? `: ${x.votos[0]} a ${x.votos[1]}` : '',
          x.texto && h('em', null, ` "${x.texto}"`))))),
      h('div', { class: 'proposta-acoes' }, acoes));
  }

  await carregar();
  return raiz;
}

// Texto comprido: mostra o começo e um botão para ler o resto.
const CORTE = 700;
function textoGrande(texto) {
  if (texto.length <= CORTE * 1.3) return h('p', { class: 'texto-livre' }, texto);
  const corte = texto.lastIndexOf(' ', CORTE) > CORTE * 0.7 ? texto.lastIndexOf(' ', CORTE) : CORTE;
  const el = h('p', { class: 'texto-livre' }, `${texto.slice(0, corte)}…`);
  const botaoLer = h('button', { type: 'button', class: 'link-botao', onclick: () => { el.textContent = texto; botaoLer.remove(); } }, `Ler tudo (${Math.ceil(texto.length / 1000)} mil letras)`);
  return h('div', null, el, botaoLer);
}

const passo = (ic, titulo, texto) => h('li', null, h('span', { class: 'propostas-passo-icone' }, icone(ic)), h('div', null, h('strong', null, titulo), h('small', null, texto)));

/* ─── Formulários ─────────────────────────────────── */

function formProposta(d, p, depois) {
  const v = { tipo: p?.tipo || 'Lei', titulo: p?.titulo || '', resumo: p?.resumo || '', texto: p?.texto || '', justificativa: p?.justificativa || '' };
  const entrada = (k, attrs) => h('input', { class: 'input', value: v[k], oninput: e => { v[k] = e.target.value; }, ...attrs });
  const area = (k, attrs) => h('textarea', { class: 'input', oninput: e => { v[k] = e.target.value; }, ...attrs }, v[k]);
  modalForm({
    titulo: p ? 'Editar a proposta' : 'Mandar uma proposta ao Congresso', tamanho: 'medio', textoOk: p ? 'Salvar' : 'Mandar para a Senadora',
    conteudo: h('div', { class: 'form-grade' },
      campo('Tipo', h('select', { class: 'input', onchange: e => { v.tipo = e.target.value; } }, d.tipos.map(t => h('option', { value: t, selected: t === v.tipo }, t))), { ajuda: AJUDA_TIPO, obrigatorio: true }),
      campo('Título', entrada('titulo', { maxlength: '200', placeholder: 'Ex.: Lei da Feira aos Domingos' }), { obrigatorio: true }),
      campo('O que muda', area('resumo', { rows: '4', placeholder: 'Em poucas palavras: o que muda para os moradores de Lyendell?' }), { obrigatorio: true, classe: 'largo' }),
      campo('Texto completo', area('texto', { rows: '10', placeholder: 'Se quiser, escreva a lei inteira, artigo por artigo. Não tem limite de tamanho.' }), { classe: 'largo' }),
      campo('Por que é uma boa ideia', area('justificativa', { rows: '4', placeholder: 'Convença a Senadora e o Congresso!' }), { classe: 'largo' }),
      !p && h('p', { class: 'suave largo' }, `A Senadora avalia e você é avisado na hora. Dá para ter até ${d.limite} propostas esperando ao mesmo tempo.`)),
    aoEnviar: async () => {
      if (p) await put(`/api/propostas/${p.id}`, v);
      else await post('/api/propostas', v);
      aviso(p ? 'Proposta atualizada.' : 'Proposta enviada! A Senadora vai avaliar.');
      depois();
    },
  });
}

function avaliar(p, viavel, depois) {
  const v = { parecer: '' };
  modalForm({
    titulo: viavel ? `Levar ao Congresso: ${p.titulo}` : `Inviável: ${p.titulo}`,
    textoOk: viavel ? 'Levar para a pauta' : 'Marcar como inviável', classeOk: viavel ? 'btn-ouro' : 'btn-perigo',
    conteudo: h('div', { class: 'form-grade' },
      h('p', { class: 'form-intro largo' }, viavel
        ? `A proposta vai para a pauta do Congresso, e ${p.autor_nome} é avisado na hora. Depois da sessão, registre a votação.`
        : `${p.autor_nome} vai ler o motivo. Seja clara e gentil: a ideia pode voltar melhor.`),
      campo(viavel ? 'Recado para quem propôs (opcional)' : 'Por que é inviável', h('textarea', { class: 'input', rows: '5', oninput: e => { v.parecer = e.target.value; } }),
        { obrigatorio: !viavel, classe: 'largo' })),
    aoEnviar: async () => {
      await post(`/api/propostas/${p.id}/avaliar`, { viavel, parecer: v.parecer });
      aviso(viavel ? 'Proposta na pauta do Congresso.' : 'Proposta marcada como inviável.');
      depois();
    },
  });
}

function decidir(p, depois) {
  const v = {
    resultado: p.situacao === 'rejeitada' ? 'rejeitada' : 'aprovada', votacao: p.votacao || hojeIso(),
    a_favor: p.a_favor ?? '', contra: p.contra ?? '', abstencoes: p.abstencoes ?? '', observacao: p.resultado || '',
  };
  const escolhas = h('div', { class: 'modos-escolha' });
  const OPCOES = [['aprovada', 'Aprovada', 'Vira lei: depois dá para publicar no livro do Congresso.'], ['rejeitada', 'Rejeitada', 'O Congresso recusou a proposta.'],
    ['adiada', 'Adiada', 'Fica na pauta para a próxima sessão.']];
  const desenharEscolhas = () => trocar(escolhas, OPCOES.map(([k, nome, txt]) => h('button', {
    type: 'button', class: `modo-opcao ${v.resultado === k ? 'ativo' : ''}`.trim(), onclick: () => { v.resultado = k; desenharEscolhas(); },
  }, h('strong', null, nome), h('small', null, txt))));
  desenharEscolhas();
  const numero = k => h('input', { class: 'input', type: 'number', min: '0', max: '999', value: v[k], oninput: e => { v[k] = e.target.value; } });
  modalForm({
    titulo: `Votação: ${p.titulo}`, tamanho: 'medio', textoOk: 'Salvar a votação',
    conteudo: h('div', { class: 'form-grade' },
      h('div', { class: 'largo' }, escolhas),
      campo('Data da votação', h('input', { class: 'input', type: 'date', value: v.votacao, onchange: e => { v.votacao = e.target.value; } })),
      campo('Votos a favor', numero('a_favor')),
      campo('Votos contra', numero('contra')),
      campo('Abstenções', numero('abstencoes')),
      campo('Observação (opcional)', h('textarea', { class: 'input', rows: '3', oninput: e => { v.observacao = e.target.value; } }, v.observacao), { classe: 'largo' })),
    aoEnviar: async () => {
      await post(`/api/propostas/${p.id}/decidir`, v);
      aviso({ aprovada: 'Proposta aprovada!', rejeitada: 'Proposta rejeitada.', adiada: 'Votação adiada: a proposta continua na pauta.' }[v.resultado]);
      depois();
    },
  });
}

// O registro no livro do Congresso já vem preenchido com a proposta (a Senadora confere e salva).
function dadosParaOLivro(l, p) {
  const dados = {};
  const por = (ids, nomes, valor) => {
    if (valor == null || valor === '') return;
    const c = l.campos.find(x => ids.includes(x.id)) || l.campos.find(x => x.tipo !== 'secao' && nomes.some(n => normalizar(x.nome).includes(n)));
    if (!c || dados[c.id] != null) return;
    if (c.tipo === 'selecao') {
      const op = (c.opcoes || []).find(o => normalizar(o) === normalizar(String(valor)));
      if (op) dados[c.id] = op;
    } else if (c.tipo === 'numero') dados[c.id] = Number(valor);
    else dados[c.id] = valor;
  };
  por(['titulo'], ['titulo'], p.titulo);
  por(['tipo'], ['tipo'], p.tipo);
  por(['votacao'], ['votacao'], p.votacao || hojeIso());
  por(['resultado'], ['resultado'], 'Aprovada');
  por(['resumo'], ['o que muda', 'resumo'], p.resumo);
  por(['texto'], ['texto completo'], p.texto);
  por(['a_favor'], ['a favor'], p.a_favor);
  por(['contra'], ['votos contra'], p.contra);
  por(['abstencoes'], ['abstenc'], p.abstencoes);
  por(['autor'], ['quem propos', 'autor'], p.autor_nome);
  por(['situacao'], ['situacao'], 'Em vigor');
  return dados;
}

function publicar(p, livros, depois) {
  const podem = livros.filter(l => l.podeRegistrar);
  if (!podem.length) { aviso('Não há livro no Congresso onde você possa registrar.', 'erro'); return; }
  const abrir = l => formRegistro(l, null, async idSalvo => {
    if (await tentar(() => post(`/api/propostas/${p.id}/publicada`, { registro: idSalvo }), 'Publicada no livro do Congresso!')) depois();
  }, dadosParaOLivro(l, p));
  if (podem.length === 1) { abrir(podem[0]); return; }
  // Mais de um livro: a Senadora escolhe (o de leis vem primeiro).
  const ordem = [...podem].sort((a, b) => /lei/i.test(b.nome) - /lei/i.test(a.nome));
  const m = modal({
    titulo: 'Em qual livro publicar?', tamanho: 'pequeno',
    corpo: h('div', { class: 'propostas-livros' }, ordem.map(l => h('button', { type: 'button', class: 'btn', onclick: () => { m.fechar(); abrir(l); } }, icone(l.icone || 'livro'), h('span', null, l.nome)))),
  });
}
