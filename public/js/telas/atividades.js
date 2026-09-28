import {
  estado, get, post, put, patch, del, h, trocar, icone, pode, cabecalho, vazio, botao, botaoIcone, modalForm, confirmar,
  aviso, tentar, campo, barra, avatar, entradaQuantidade, num, pacotes, dataCurta, dataHora, relativo,
} from '../core.js';
import { livroDeAtividade } from '../livro-mc.js';

const STATUS = {
  aberta: { nome: 'Aberta', classe: 'st-aberta' },
  concluida: { nome: 'Concluída', classe: 'st-concluida' },
  encerrada: { nome: 'Encerrada', classe: 'st-encerrada' },
};
const PACOTES = [[64, 'Pacote de 64 (a maioria dos itens)'], [16, 'Pacote de 16 (ovos, placas, pérolas)'], [1, 'Não empilha (ferramentas, armaduras)']];

let abaAtual = 'aberta';

const chipStatus = s => h('span', { class: `status ${STATUS[s].classe}` }, STATUS[s].nome);
const pct = (v, t) => (t ? Math.floor(Math.min(100, (v / t) * 100)) : 0);
const qtdTexto = (n, a) => `${num(n)} ${a.item}${pacotes(n, a.pacote) ? ` (${pacotes(n, a.pacote)})` : ''}`;

/* ─── Lista ───────────────────────────────────────── */

export async function atividades() {
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const { atividades: lista, contagem } = await get(`/api/atividades${abaAtual === 'todas' ? '' : `?status=${abaAtual}`}`);
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    const abas = [['aberta', 'Abertas', contagem.aberta], ['concluida', 'Concluídas', contagem.concluida], ['encerrada', 'Encerradas', contagem.encerrada], ['todas', 'Todas', total]];

    trocar(raiz, 
      cabecalho({
        titulo: 'Mural de Atividades', icone: 'tarefas',
        sub: 'O que a cidade precisa. Assuma uma parte, registre o que entregou e receba de acordo com o seu esforço.',
        acoes: [pode('atividades.criar') && botao('Nova atividade', { icone: 'mais', classe: 'btn-ouro', onclick: () => formAtividade(null, id => { location.hash = `#/atividades/${id}`; }) })],
      }),
      h('div', { class: 'abas', role: 'tablist' }, abas.map(([k, nome, n]) =>
        h('button', { class: `aba ${abaAtual === k ? 'ativa' : ''}`.trim(), role: 'tab', 'aria-selected': String(abaAtual === k), onclick: () => { abaAtual = k; desenhar(); } },
          nome, h('span', { class: 'aba-n' }, n)))),
      lista.length
        ? h('div', { class: 'grade-ativ' }, lista.map(cartao))
        : vazio(abaAtual === 'aberta' ? 'Nenhuma atividade aberta' : 'Nada por aqui',
          abaAtual === 'aberta' ? 'Quando a cidade precisar de algo, o pedido aparece aqui.' : null));
  }

  await desenhar();
  return raiz;
}

function cartao(a) {
  const p = pct(a.total, a.meta);
  return h('a', { class: 'ativ-card', href: `#/atividades/${a.id}` },
    h('div', { class: 'ativ-topo' },
      chipStatus(a.status),
      a.participando && h('span', { class: 'etiqueta etiqueta-ok' }, icone('mao'), 'Você ajuda'),
      a.prazo && h('span', { class: 'ativ-prazo' }, icone('calendario'), `até ${dataCurta(a.prazo)}`)),
    h('h3', null, a.titulo),
    h('p', { class: 'ativ-meta' }, icone('bau'), `Meta: ${qtdTexto(a.meta, a)}`),
    barra(a.total, a.meta),
    h('div', { class: 'ativ-numeros' },
      h('span', null, h('strong', null, num(a.total)), ` / ${num(a.meta)}`),
      h('span', { class: 'ativ-pct' }, `${p}%`)),
    h('div', { class: 'ativ-rodape' },
      h('span', null, icone('usuarios'), `${a.n_participantes} ${a.n_participantes === 1 ? 'pessoa' : 'pessoas'}`),
      a.recompensa_valor != null && h('span', { class: 'ativ-recompensa' }, icone('moeda'), `${num(a.recompensa_valor)} ${a.recompensa_unidade}`.trim())));
}

/* ─── Detalhe ─────────────────────────────────────── */

export async function atividade(id) {
  const raiz = h('div', { class: 'pagina' });

  async function desenhar() {
    const { atividade: a, divisao, contribuicoes } = await get(`/api/atividades/${id}`);
    const falta = Math.max(0, a.meta - a.total);
    const aberta = a.status === 'aberta';
    const minhaParte = divisao.find(p => p.usuario_id === estado.eu.id);

    const acoes = [botao('Baixar .book', {
      icone: 'baixar', titulo: 'Baixa a atividade, com quem ajudou e quanto cada um recebe, como livro para o mod Scribble',
      onclick: () => livroDeAtividade(a, divisao, contribuicoes, estado.eu.nome).baixar(),
    })];
    if (a.podeParticipar && aberta) {
      if (a.participando) {
        acoes.push(botao('Registrar entrega', { icone: 'bau', classe: 'btn-ouro', onclick: () => formEntrega(a, desenhar) }));
      } else {
        acoes.push(botao('Registrar entrega', { icone: 'bau', onclick: () => formEntrega(a, desenhar) }));
        acoes.push(botao('Quero ajudar', { icone: 'mao', classe: 'btn-ouro', onclick: () => formAjudar(a, null, desenhar) }));
      }
    }

    const gestao = a.gestor ? h('div', { class: 'gestao' },
      h('span', { class: 'gestao-rotulo' }, 'Gerenciar'),
      botao('Editar', { icone: 'editar', classe: 'btn-pequeno', onclick: () => formAtividade(a, desenhar) }),
      a.status !== 'aberta' && botao('Reabrir', { classe: 'btn-pequeno', onclick: () => mudarStatus(a, 'aberta', desenhar) }),
      a.status !== 'concluida' && botao('Marcar como concluída', { icone: 'check', classe: 'btn-pequeno', onclick: () => mudarStatus(a, 'concluida', desenhar) }),
      a.status !== 'encerrada' && botao('Encerrar', { classe: 'btn-pequeno', onclick: () => mudarStatus(a, 'encerrada', desenhar) }),
      botao('Apagar', {
        icone: 'lixo', classe: 'btn-pequeno btn-perigo-texto',
        onclick: async () => {
          if (!await confirmar(`A atividade "${a.titulo}" e todas as entregas registradas nela serão apagadas.`, { ok: 'Apagar', perigo: true })) return;
          if (await tentar(() => del(`/api/atividades/${a.id}`), 'Atividade apagada.')) location.hash = '#/atividades';
        },
      })) : null;

    const temRecompensa = a.recompensa_valor != null;

    trocar(raiz, 
      cabecalho({ titulo: a.titulo, voltar: { href: '#/atividades', texto: 'Mural de Atividades' }, acoes }),
      h('div', { class: 'ativ-info' },
        chipStatus(a.status),
        h('span', null, icone('usuario'), `Pedido por ${a.criado_por_nome || 'desconhecido'} ${relativo(a.criado_em)}`),
        a.prazo && h('span', null, icone('calendario'), `Prazo: ${dataCurta(a.prazo)}`)),
      gestao,

      h('section', { class: 'progresso' },
        h('div', { class: 'progresso-numeros' },
          h('div', null,
            h('span', { class: 'progresso-grande' }, num(a.total)),
            h('span', { class: 'progresso-de' }, ` / ${num(a.meta)} ${a.item}`)),
          h('span', { class: 'progresso-pct' }, `${pct(a.total, a.meta)}%`)),
        barra(a.total, a.meta),
        h('div', { class: 'progresso-rodape' },
          h('span', null, falta ? `Faltam ${qtdTexto(falta, a)}` : 'Meta alcançada!'),
          pacotes(a.meta, a.pacote) && h('span', { class: 'suave' }, `Meta em pacotes: ${pacotes(a.meta, a.pacote)}`)),
        temRecompensa && h('p', { class: 'recompensa' }, icone('moeda'),
          h('span', null, 'Recompensa de ', h('strong', null, `${num(a.recompensa_valor)} ${a.recompensa_unidade}`.trim()),
            ', dividida entre quem ajudou conforme o quanto cada um entregou.')),
        minhaParte && h('p', { class: 'minha-parte' }, icone('mao'),
          h('span', null, 'Você ',
            minhaParte.compromisso ? `se comprometeu com ${qtdTexto(minhaParte.compromisso, a)} e ` : '',
            `já entregou ${qtdTexto(minhaParte.entregue, a)}.`,
            temRecompensa && minhaParte.parte != null && minhaParte.entregue ? ` Sua parte até agora: ${num(minhaParte.parte)} ${a.recompensa_unidade}.` : ''),
          a.participando && aberta && h('span', { class: 'minha-parte-acoes' },
            h('button', { class: 'link', type: 'button', onclick: () => formAjudar(a, minhaParte.compromisso, desenhar) }, 'Mudar compromisso'),
            !minhaParte.entregue && h('button', {
              class: 'link', type: 'button',
              onclick: async () => {
                if (!await confirmar('Você vai deixar de ajudar nesta atividade.', { ok: 'Sair da tarefa' })) return;
                if (await tentar(() => del(`/api/atividades/${a.id}/participar`), 'Você saiu da tarefa.')) desenhar();
              },
            }, 'Sair da tarefa')))),

      a.descricao && h('section', { class: 'painel' }, h('div', { class: 'texto-livre' }, a.descricao)),

      h('div', { class: 'ativ-grade' },
        h('section', { class: 'painel' },
          h('header', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Quem está ajudando')),
          divisao.length ? h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
            h('thead', null, h('tr', null,
              h('th', null, 'Pessoa'), h('th', { class: 'num' }, 'Prometeu'), h('th', { class: 'num' }, 'Entregou'),
              h('th', { class: 'num' }, '% do total'), temRecompensa && h('th', { class: 'num' }, 'Recebe'))),
            h('tbody', null, divisao.map(p => h('tr', { class: p.usuario_id === estado.eu.id ? 'eu-linha' : '' },
              h('td', { 'data-rotulo': 'Pessoa' }, h('span', { class: 'pessoa' }, avatar(p.nome, 'avatar-p'), p.nome)),
              h('td', { class: 'num', 'data-rotulo': 'Prometeu' }, p.compromisso ? num(p.compromisso) : ''),
              h('td', { class: 'num', 'data-rotulo': 'Entregou' }, h('strong', null, num(p.entregue)),
                p.entregue && p.conferido < p.entregue ? h('small', { class: 'suave', title: 'Ainda não conferido' }, ` (${num(p.entregue - p.conferido)} a conferir)`) : null),
              h('td', { class: 'num', 'data-rotulo': '% do total' }, `${num(p.fracao * 100)}%`),
              temRecompensa && h('td', { class: 'num', 'data-rotulo': 'Recebe' }, p.parte != null ? `${num(p.parte)} ${a.recompensa_unidade}`.trim() : '')))))) : h('p', { class: 'painel-vazio' }, 'Ninguém assumiu esta tarefa ainda. Que tal ser o primeiro?')),

        h('section', { class: 'painel' },
          h('header', { class: 'painel-cab' }, h('h2', null, icone('bau'), 'Entregas')),
          contribuicoes.length ? h('ul', { class: 'entregas' }, contribuicoes.map(c => h('li', { class: 'entrega' },
            avatar(c.usuario_nome, 'avatar-p'),
            h('div', { class: 'entrega-texto' },
              h('p', null, h('strong', null, c.usuario_nome), ' entregou ', h('strong', null, qtdTexto(c.quantidade, a))),
              c.nota && h('p', { class: 'entrega-nota' }, c.nota),
              h('small', { class: 'suave', title: dataHora(c.criado_em) }, relativo(c.criado_em))),
            h('div', { class: 'entrega-acoes' },
              c.conferida
                ? h('span', { class: 'etiqueta etiqueta-ok', title: 'Conferido por quem gerencia a atividade' }, icone('check'), 'Conferida')
                : a.gestor
                  ? botao('Conferir', { icone: 'check', classe: 'btn-pequeno', onclick: async () => { if (await tentar(() => patch(`/api/atividades/contribuicoes/${c.id}`, { conferida: true }))) desenhar(); } })
                  : h('span', { class: 'etiqueta', title: 'Aguardando quem gerencia a atividade conferir' }, 'A conferir'),
              c.conferida && a.gestor && botaoIcone('x', 'Desfazer conferência', async () => { if (await tentar(() => patch(`/api/atividades/contribuicoes/${c.id}`, { conferida: false }))) desenhar(); }),
              c.podeApagar && botaoIcone('lixo', 'Remover entrega', async () => {
                if (!await confirmar(`A entrega de ${qtdTexto(c.quantidade, a)} de ${c.usuario_nome} será removida.`, { ok: 'Remover', perigo: true })) return;
                if (await tentar(() => del(`/api/atividades/contribuicoes/${c.id}`), 'Entrega removida.')) desenhar();
              }, 'perigo'))))) : h('p', { class: 'painel-vazio' }, 'Nenhuma entrega registrada ainda.'))));
  }

  await desenhar();
  return raiz;
}

async function mudarStatus(a, status, depois) {
  const textos = {
    aberta: ['A atividade volta a receber ajuda e entregas.', 'Reabrir'],
    concluida: ['A atividade será marcada como concluída e para de receber entregas.', 'Concluir'],
    encerrada: ['A atividade será encerrada e para de receber entregas. As entregas feitas continuam registradas.', 'Encerrar'],
  };
  const [msg, ok] = textos[status];
  if (!await confirmar(msg, { ok })) return;
  if (await tentar(() => put(`/api/atividades/${a.id}`, { status }), 'Atividade atualizada.')) depois();
}

/* ─── Formulários ─────────────────────────────────── */

function formAjudar(a, compromissoAtual, depois) {
  const qtd = entradaQuantidade({ pacote: a.pacote, inicial: compromissoAtual || 0, item: a.item });
  modalForm({
    titulo: compromissoAtual != null ? 'Mudar compromisso' : `Quero ajudar · ${a.titulo}`,
    textoOk: compromissoAtual != null ? 'Salvar' : 'Assumir tarefa',
    conteudo: [
      h('p', { class: 'form-intro' }, `Quanto você pretende entregar? Faltam ${qtdTexto(Math.max(0, a.meta - a.total), a)}. Se não souber ainda, pode deixar em branco.`),
      qtd.el,
    ],
    aoEnviar: async () => {
      await post(`/api/atividades/${a.id}/participar`, { compromisso: qtd.valor() });
      aviso(compromissoAtual != null ? 'Compromisso atualizado.' : 'Você assumiu a tarefa. Obrigado!');
      depois();
    },
  });
}

function formEntrega(a, depois) {
  const qtd = entradaQuantidade({ pacote: a.pacote, item: a.item });
  const nota = h('input', { class: 'input', maxlength: '200', placeholder: 'Ex.: deixei no baú do celeiro' });
  modalForm({
    titulo: `Registrar entrega · ${a.titulo}`,
    textoOk: 'Registrar entrega',
    conteudo: [
      h('p', { class: 'form-intro' }, `Quantos ${a.item} você entregou agora? Faltam ${qtdTexto(Math.max(0, a.meta - a.total), a)}.`),
      qtd.el,
      campo('Observação', nota, { ajuda: 'Opcional. Ajuda quem vai conferir a entrega.' }),
    ],
    aoEnviar: async () => {
      const q = qtd.valor();
      if (q < 1) throw new Error('Informe quantos itens você entregou.');
      await post(`/api/atividades/${a.id}/contribuicoes`, { quantidade: q, nota: nota.value });
      aviso(`Entrega de ${qtdTexto(q, a)} registrada.`);
      depois();
    },
  });
}

function formAtividade(a, depois) {
  const s = a
    ? { titulo: a.titulo, item: a.item, pacote: a.pacote, descricao: a.descricao, prazo: a.prazo || '', recompensa_valor: a.recompensa_valor ?? '', recompensa_unidade: a.recompensa_unidade }
    : { titulo: '', item: '', pacote: 64, descricao: '', prazo: '', recompensa_valor: '', recompensa_unidade: 'Lírios' };
  const meta = entradaQuantidade({ pacote: s.pacote, inicial: a?.meta || 0, item: s.item || 'itens' });

  modalForm({
    titulo: a ? 'Editar atividade' : 'Nova atividade',
    tamanho: 'medio',
    textoOk: a ? 'Salvar' : 'Publicar atividade',
    conteudo: [
      campo('Título', h('input', { class: 'input', value: s.titulo, maxlength: '120', placeholder: 'Ex.: Batatas para o banquete da colheita', oninput: e => { s.titulo = e.target.value; } }), { obrigatorio: true }),
      h('div', { class: 'form-grade' },
        campo('Item necessário', h('input', { class: 'input', value: s.item, maxlength: '60', placeholder: 'Ex.: Batatas', oninput: e => { s.item = e.target.value; meta.mudarItem(s.item); } }), { obrigatorio: true }),
        campo('Como o item empilha', h('select', { class: 'input', onchange: e => { s.pacote = Number(e.target.value); meta.mudarPacote(s.pacote); } },
          PACOTES.map(([v, n]) => h('option', { value: String(v), selected: s.pacote === v }, n))))),
      h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Meta', h('b', { class: 'obrig' }, ' *')), meta.el),
      campo('Descrição', h('textarea', { class: 'input', rows: '4', maxlength: '3000', placeholder: 'Para que é, onde entregar, quem procurar…', oninput: e => { s.descricao = e.target.value; } }, s.descricao)),
      h('div', { class: 'form-grade' },
        campo('Prazo', h('input', { class: 'input', type: 'date', value: s.prazo, oninput: e => { s.prazo = e.target.value; } }), { ajuda: 'Opcional.' }),
        campo('Recompensa total', h('div', { class: 'recompensa-entrada' },
          h('input', { class: 'input', type: 'number', min: '0', step: 'any', value: s.recompensa_valor, placeholder: 'Ex.: 300', oninput: e => { s.recompensa_valor = e.target.value; } }),
          h('input', { class: 'input', value: s.recompensa_unidade, maxlength: '40', placeholder: 'Lírios', 'aria-label': 'Unidade da recompensa', oninput: e => { s.recompensa_unidade = e.target.value; } })),
        { ajuda: 'Opcional. Será dividida entre quem ajudou, proporcional ao que cada um entregou.' })),
    ],
    aoEnviar: async () => {
      if (!s.titulo.trim()) throw new Error('Dê um título à atividade.');
      if (!s.item.trim()) throw new Error('Diga qual item é preciso.');
      const corpo = { ...s, meta: meta.valor(), prazo: s.prazo || null };
      if (corpo.meta < 1) throw new Error('Defina a meta (quantos itens são precisos).');
      if (a) {
        await put(`/api/atividades/${a.id}`, corpo);
        aviso('Atividade atualizada.');
        depois();
      } else {
        const { id } = await post('/api/atividades', corpo);
        aviso('Atividade publicada.');
        depois(id);
      }
    },
  });
}
