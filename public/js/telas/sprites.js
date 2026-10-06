// Sprites dos jogos (#/recreacao/sprites): a lista das peças de cada jogo, com o desenho de sempre animado,
// o molde para baixar (já com os quadros do desenho atual, para pintar por cima), o envio do PNG em tira
// de quadros e a prévia do sprite enviado. Quem tem "sprites.editar" troca; sem sprite, vale o desenho de sempre.
// Também dá para renomear cada peça (o nome novo vale nos jogos, na loja do clube...) e criar itens novos
// para o Club Coelho (roupas e móveis que só existem como sprite).
import { h, trocar, icone, botao, botaoIcone, cabecalho, vazio, aviso, aoSair, api, confirmar, interruptor, pode, modalForm, campo, num } from '../core.js';
import { carregarSprites, aoMudarSprites, todasAsPecas, desenharSprite, spriteDe, nomeDe, nomeTrocado, itensNovosDoClube } from '../sprites.js';
import { desenharCoelho } from '../desenho-coelho.js';
import { registrarItensNovos } from '../clube-salas.js';

// O coelho de guia atrás das roupas (meio apagado).
function guia(g, peca) {
  if (!peca.guiaCoelho) return;
  g.save();
  g.globalAlpha *= 0.3;
  desenharCoelho(g, 0, 0, { semSprite: true });
  g.restore();
}

// Cada módulo daqui exporta SPRITES e registra as suas peças quando é importado.
const FONTES = [
  () => import('../desenho-coelho.js'),
  () => import('../roupas-coelho.js'),
  () => import('../jogos/travessia.js'),
  () => import('../jogos/barris.js'),
  () => import('../desenho-cobra.js'),
  () => import('../jogos/super-coelho.js'),
  () => import('./pac-coelho.js'),
  () => import('./festa.js'),
  () => import('../festa-minijogos.js'),
  () => import('./clube.js'),
  () => import('../clube-salas.js'),
  () => import('../clube-minijogos.js'),
  () => import('./cidade-mundo.js'),
  () => import('../jogos/corrida.js'),
  () => import('./arena.js'),
  () => import('./batalha.js'),
];

const ESCALAS = [1, 2, 3, 4];
let escalaMolde = 2;
const MAX_NOME = 40;
const PRECO_MAX = 5000;
// Onde vai cada item novo do clube.
const ONDE_ITEM = [
  ['cabeca', 'Na cabeça'], ['rosto', 'No rosto'], ['pescoco', 'No pescoço'], ['costas', 'Nas costas'],
  ['corpo', 'No corpo (roupa)'], ['mao', 'Na mão'], ['movel', 'Móvel da toca'],
];
const NOME_ONDE = Object.fromEntries(ONDE_ITEM);
const ONDE_MOVEL = [['chao', 'Em pé no chão (cadeira, mesa...)'], ['parede', 'Pendurado na parede'], ['tapete', 'Deitado no chão, por baixo de tudo (tapete)']];
const NOME_ONDE_MOVEL = { chao: 'em pé no chão', parede: 'na parede', tapete: 'deitado no chão' };
const JOGO_ROUPAS = 'Roupas e acessórios';
const JOGO_CLUBE = 'Club Coelho';

const nomePeca = p => nomeDe(p.chave, p.nome);

// Desenha a prévia de uma peça (o desenho de sempre) num canvas, com a âncora no lugar certo e com folga.
function caberNaCaixa(g, peca, w, hh, desenhar) {
  const folga = 8;
  const k = Math.min((w - folga * 2) / peca.largura, (hh - folga * 2) / peca.altura);
  const ax = w / 2;
  const ay = peca.ancora === 'centro' ? hh / 2 : peca.ancora === 'topo' ? (hh - peca.altura * k) / 2 : (hh + peca.altura * k) / 2;
  g.save();
  g.translate(ax, ay);
  g.scale(k, k);
  desenhar(g);
  g.restore();
}

// O molde: uma tira com os quadros da animação, cada um do tamanho da peça vezes a escala, já com o desenho atual.
function gerarMolde(peca, anim) {
  const n = anim.quadros || 1;
  const L = Math.round(peca.largura * escalaMolde);
  const A = Math.round(peca.altura * escalaMolde);
  const c = document.createElement('canvas');
  c.width = L * n;
  c.height = A;
  const g = c.getContext('2d');
  for (let q = 0; q < n; q++) {
    g.save();
    g.beginPath(); g.rect(q * L, 0, L, A); g.clip();
    const ax = q * L + L / 2;
    const ay = peca.ancora === 'centro' ? A / 2 : peca.ancora === 'topo' ? 0 : A;
    g.translate(ax, ay);
    g.scale(escalaMolde, escalaMolde);
    try { peca.previa?.(g, anim.id, q / (anim.fps || 8)); } catch { /* prévia com problema: quadro vazio */ }
    g.restore();
  }
  c.toBlob(b => {
    const a = h('a', { href: URL.createObjectURL(b), download: `${peca.chave}.${anim.id}.png` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }, 'image/png');
}

async function enviarSprite(peca, anim, arquivo, atual) {
  if (!/^image\/(png|gif|webp)$/.test(arquivo.type)) { aviso('Envie um PNG (ou GIF/WEBP) com fundo transparente.', 'erro'); return; }
  // Lê o tamanho para adivinhar quantos quadros a tira tem (quadros do tamanho da peça, lado a lado).
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; }).catch(() => null);
  URL.revokeObjectURL(url);
  if (!img) { aviso('Não consegui abrir essa imagem.', 'erro'); return; }
  const proporcao = peca.largura / peca.altura;
  const quadros = Math.max(1, Math.min(64, Math.round(img.naturalWidth / (img.naturalHeight * proporcao))));
  const fd = new FormData();
  fd.append('arquivo', arquivo); // vai do jeito que está (pixel art não pode ser diminuída nem virar JPG)
  const { url: src } = await api('POST', '/api/upload', fd);
  await api('PUT', `/api/sprites/${peca.chave}.${anim.id}`, {
    src, quadros, fps: atual?.fps ?? anim.fps ?? 8, tingir: atual?.tingir ?? !!peca.tingir, suave: atual?.suave ?? false,
    nomePeca: nomePeca(peca), nomeAnim: peca.animacoes.length > 1 ? anim.nome : '',
  });
  aviso(`Sprite de "${nomePeca(peca)}: ${anim.nome}" enviado (${quadros} ${quadros === 1 ? 'quadro' : 'quadros'}).`);
  await carregarSprites(true);
}

export async function telaSprites() {
  const raiz = h('div', { class: 'pagina' });
  await Promise.all(FONTES.map(f => f().catch(e => console.warn('Sprites: módulo sem peças', e))));
  let { sprites, podeEditar } = await carregarSprites(true);
  if (!pode('sprites.editar') && !podeEditar) {
    trocar(raiz, cabecalho({ titulo: 'Sprites dos jogos', icone: 'imagem', voltar: { href: '#/recreacao', texto: 'Recreação' } }),
      vazio('Só a Família Nobre troca os sprites', 'Peça para quem tem a permissão "Trocar os desenhos dos joguinhos".'));
    return raiz;
  }
  // Os itens novos do Club Coelho viram peças antes de montar a lista.
  registrarItensNovos(itensNovosDoClube());
  const ORDEM = ['Todos os jogos', JOGO_ROUPAS, 'Travessia', 'Barris do Raposo', 'Super Coelho', 'Pac-Coelho', 'Cobrinha', 'Festa na Toca', 'Festa: minijogos', JOGO_CLUBE, 'Club Coelho: minijogos', 'Lyendell Dorme', 'Corrida do Coelho', 'Arena da Toca', 'Batalha da Toca'];
  const lugar = j => (ORDEM.includes(j) ? ORDEM.indexOf(j) : ORDEM.length);
  let pecas = [];
  let jogos = [];
  let jogo = null;
  let rascunhoNome = null; // { chave, valor }: o nome que está sendo digitado (sobrevive quando a lista é refeita)
  let irPara = null;       // a peça para rolar até ela depois de desenhar (item recém-criado)
  const telas = []; // canvases animados: { c, desenhar }
  const corpo = h('div', { class: 'sprites-lista' });
  const abas = h('div', { class: 'segmentado sprites-abas' });

  function atualizarPecas() {
    pecas = todasAsPecas();
    jogos = [...new Set(pecas.map(p => p.jogo || 'Outros'))].sort((a, b) => lugar(a) - lugar(b));
    if (!jogos.includes(jogo)) jogo = jogos[0];
  }

  function desenharAbas() {
    trocar(abas, jogos.map(j => {
      const n = pecas.filter(p => (p.jogo || 'Outros') === j).reduce((s, p) => s + p.animacoes.filter(a => sprites[`${p.chave}.${a.id}`]).length, 0);
      return h('button', { type: 'button', class: j === jogo ? 'seg ativo' : 'seg', onclick: () => { jogo = j; desenhar(); } }, j, n ? h('span', { class: 'sprites-conta' }, String(n)) : null);
    }));
  }

  /* ─── Nome da peça ─── */
  async function salvarNome(p, valor) {
    const nome = String(valor || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
    if (p.itemNovo && !nome) { aviso('O item precisa de um nome.', 'erro'); return; }
    try {
      await api('PUT', `/api/sprites/nome/${p.chave}`, { nome });
      rascunhoNome = null;
      aviso(nome ? `Agora se chama "${nome}".` : `Voltou ao nome de sempre: "${p.nome}".`);
      await carregarSprites(true);
    } catch (x) { aviso(x.message || 'Não deu para renomear.', 'erro'); }
  }
  function nomeDaPeca(p) {
    const original = !p.itemNovo && nomeTrocado(p.chave);
    const voltar = original && botao('Voltar ao nome original', { classe: 'btn-pequeno', icone: 'voltar', titulo: `Volta a se chamar "${p.nome}"`, onclick: () => salvarNome(p, '') });
    if (rascunhoNome?.chave !== p.chave) {
      return h('div', { class: 'sprites-nome' },
        h('h2', null, nomePeca(p)),
        botaoIcone('editar', 'Renomear', () => { rascunhoNome = { chave: p.chave, valor: nomePeca(p) }; desenhar(); }),
        original && h('small', { class: 'suave' }, `Nome de sempre: ${p.nome}`),
        voltar);
    }
    const entrada = h('input', {
      class: 'input sprites-nome-entrada', maxlength: String(MAX_NOME), value: rascunhoNome.valor, 'aria-label': `Novo nome de ${nomePeca(p)}`,
      oninput: e => { rascunhoNome.valor = e.target.value; },
      onkeydown: e => {
        if (e.key === 'Enter') { e.preventDefault(); salvarNome(p, entrada.value); }
        else if (e.key === 'Escape') { rascunhoNome = null; desenhar(); }
      },
    });
    setTimeout(() => {
      if (!entrada.isConnected || document.activeElement === entrada) return;
      entrada.focus();
      entrada.setSelectionRange?.(entrada.value.length, entrada.value.length);
    }, 0);
    return h('div', { class: 'sprites-nome editando' },
      entrada,
      botao('Salvar', { classe: 'btn-pequeno btn-ouro', icone: 'check', onclick: () => salvarNome(p, entrada.value) }),
      botao('Cancelar', { classe: 'btn-pequeno', onclick: () => { rascunhoNome = null; desenhar(); } }),
      voltar,
      h('small', { class: 'suave' }, `Até ${MAX_NOME} letras. O nome novo aparece em todo lugar onde o nome desta peça aparece.`));
  }

  /* ─── Itens novos do Club Coelho ─── */
  const itemDe = p => itensNovosDoClube().find(i => i.id === p.itemNovo?.id) || p.itemNovo;

  function formItem(item, tipoInicial) {
    const editando = !!item;
    const nome = h('input', { class: 'input', name: 'nome', maxlength: String(MAX_NOME), required: true, value: item?.nome || '', placeholder: 'Ex.: Chapéu de girassol' });
    const tipo = h('select', { class: 'input', name: 'tipo', disabled: editando },
      ONDE_ITEM.map(([k, rotulo]) => h('option', { value: k, selected: (item?.tipo || tipoInicial) === k }, rotulo)));
    const preco = h('input', { class: 'input', name: 'preco', type: 'number', min: '0', max: String(PRECO_MAX), step: '1', inputmode: 'numeric', value: String(item?.preco ?? 100) });
    const onde = h('select', { class: 'input', name: 'onde', disabled: editando },
      ONDE_MOVEL.map(([k, rotulo]) => h('option', { value: k, selected: (item?.onde || 'chao') === k }, rotulo)));
    const largura = h('input', { class: 'input', name: 'largura', type: 'number', min: '16', max: '400', step: '1', value: String(item?.largura ?? 80) });
    const altura = h('input', { class: 'input', name: 'altura', type: 'number', min: '16', max: '400', step: '1', value: String(item?.altura ?? 80) });
    const doMovel = h('div', { class: 'sprites-item-movel' },
      campo('Onde fica na toca', onde, { ajuda: editando ? 'Não muda depois de criado (as tocas já decoradas contam com isso).' : null }),
      h('div', { class: 'sprites-item-tamanho' },
        campo('Largura', largura, { ajuda: 'Na toca, que tem 1000 x 600. A cadeira tem 44, o sofá 150.' }),
        campo('Altura', altura, { ajuda: 'O abajur tem 86, a estante 140.' })));
    const mostrarMovel = () => { doMovel.hidden = tipo.value !== 'movel'; };
    tipo.addEventListener('change', mostrarMovel);
    mostrarMovel();
    modalForm({
      titulo: editando ? `Editar: ${item.nome}` : 'Novo item do Club Coelho',
      textoOk: editando ? 'Salvar' : 'Criar item',
      conteudo: [
        !editando && h('p', { class: 'suave' }, 'O item novo vira uma peça aqui na lista: baixe o molde, desenhe e envie o PNG. Ele só aparece na loja do Armarinho depois que o sprite chegar.'),
        campo('Nome', nome, { obrigatorio: true, ajuda: `Até ${MAX_NOME} letras. É o nome na loja e no guarda-roupa.` }),
        campo('Onde vai', tipo, { ajuda: editando ? 'Não muda depois de criado (quem comprou já está usando).' : 'Roupas e acessórios vão no coelho; o móvel vai na toca.' }),
        campo('Preço em cenouras', preco, { ajuda: `De 0 a ${num(PRECO_MAX)}. Com 0, todo mundo já ganha o item (e ele não aparece na loja).` }),
        doMovel,
      ],
      aoEnviar: async () => {
        const n = nome.value.replace(/\s+/g, ' ').trim();
        if (!n) throw new Error('Dê um nome ao item.');
        const pr = Number(preco.value);
        if (preco.value === '' || !Number.isInteger(pr) || pr < 0 || pr > PRECO_MAX) throw new Error(`O preço é um número inteiro de 0 a ${num(PRECO_MAX)}.`);
        const corpoPedido = { nome: n.slice(0, MAX_NOME), preco: pr };
        if (tipo.value === 'movel') Object.assign(corpoPedido, { largura: Number(largura.value) || 80, altura: Number(altura.value) || 80 });
        if (editando) {
          await api('PUT', `/api/sprites/itens/${item.id}`, corpoPedido);
          aviso('Item salvo.');
        } else {
          const r = await api('POST', '/api/sprites/itens', { ...corpoPedido, tipo: tipo.value, onde: onde.value });
          const chave = r.item.tipo === 'movel' ? `clube.movel-${r.item.id}` : `roupa.${r.item.id}`;
          jogo = r.item.tipo === 'movel' ? JOGO_CLUBE : JOGO_ROUPAS;
          irPara = chave;
          aviso('Item criado! Agora baixe o molde, desenhe e envie o PNG.');
        }
        await carregarSprites(true);
      },
    });
  }

  async function mudarLoja(i, ativo) {
    if (!ativo && !await confirmar(`"${i.nome}" sai da loja do Armarinho. Quem já comprou continua com ele (e pode usar).`, { titulo: 'Tirar da loja?', ok: 'Tirar da loja' })) return;
    try {
      await api('PUT', `/api/sprites/itens/${i.id}`, { ativo });
      aviso(ativo ? `"${i.nome}" voltou para a loja.` : `"${i.nome}" saiu da loja.`);
      await carregarSprites(true);
    } catch (x) { aviso(x.message, 'erro'); }
  }

  function painelItem(p) {
    const i = itemDe(p);
    if (!i) return null;
    const situacao = !i.ativo ? ['fora', 'Fora da loja: quem já tem continua usando.']
      : !i.sprite ? ['espera', 'Esperando o sprite: entra na loja assim que o PNG for enviado.']
        : i.preco === 0 ? ['gratis', 'De graça: todo mundo já tem.'] : ['venda', 'À venda no Armarinho.'];
    const detalhes = [NOME_ONDE[i.tipo] || i.tipo, `${num(i.preco)} cenouras`];
    if (i.tipo === 'movel') detalhes.push(`${i.largura} x ${i.altura}, ${NOME_ONDE_MOVEL[i.onde] || 'no chão'}`);
    return h('div', { class: `sprites-item ${situacao[0]}` },
      h('span', { class: 'sprites-item-selo' }, icone('loja'), 'Item novo do clube'),
      h('span', null, detalhes.join(' · ')),
      h('strong', { class: 'sprites-item-situacao' }, situacao[1]),
      h('div', { class: 'sprites-botoes' },
        botao('Editar item', { classe: 'btn-pequeno', icone: 'editar', onclick: () => formItem(i) }),
        i.ativo ? botao('Tirar da loja', { classe: 'btn-pequeno', icone: 'x', onclick: () => mudarLoja(i, false) })
          : botao('Pôr de volta na loja', { classe: 'btn-pequeno', icone: 'loja', onclick: () => mudarLoja(i, true) })));
  }

  function barraNovoItem() {
    if (jogo !== JOGO_ROUPAS && jogo !== JOGO_CLUBE) return null;
    const roupa = jogo === JOGO_ROUPAS;
    return h('section', { class: 'painel sprites-novo-item' },
      h('div', null,
        h('strong', null, roupa ? 'Roupa ou acessório novo' : 'Móvel novo para as tocas'),
        h('small', { class: 'suave' }, roupa
          ? 'Crie um item novo para o Club Coelho: escolha o nome, onde vai e o preço, e depois envie o sprite.'
          : 'Crie um móvel novo para decorar as tocas: escolha o nome, o tamanho e o preço, e depois envie o sprite.')),
      botao('Novo item', { icone: 'mais', classe: 'btn-ouro', onclick: () => formItem(null, roupa ? 'cabeca' : 'movel') }));
  }

  function linhaAnimacao(peca, anim) {
    const chave = `${peca.chave}.${anim.id}`;
    const s = sprites[chave];
    const antes = h('canvas', { class: 'sprites-previa', width: 160, height: 160, title: 'O desenho de sempre' });
    const depois = h('canvas', { class: 'sprites-previa', width: 160, height: 160, title: 'O seu sprite' });
    const semDesenho = (g, texto) => {
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(texto, 80, 80);
    };
    telas.push({ c: antes, desenhar: (g, t) => {
      caberNaCaixa(g, peca, 160, 160, gg => { guia(gg, peca); peca.previa?.(gg, anim.id, t); });
      if (peca.itemNovo && !peca.guiaCoelho) semDesenho(g, 'item novo: só sprite');
    } });
    telas.push({ c: depois, desenhar: (g, t) => {
      let tem = false;
      caberNaCaixa(g, peca, 160, 160, gg => { guia(gg, peca); tem = desenharSprite(gg, peca.chave, anim.id, 0, 0, { t, cor: '#c99a6b', ancora: peca.ancora }); });
      if (!tem) semDesenho(g, 'sem sprite');
    } });
    const arquivo = h('input', { type: 'file', accept: 'image/png,image/gif,image/webp', hidden: true, onchange: async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { await enviarSprite(peca, anim, f, s); } catch (x) { aviso(x.message || 'Não deu para enviar.', 'erro'); }
    } });
    const salvar = async muda => {
      try {
        await api('PUT', `/api/sprites/${chave}`, { quadros: s.quadros, fps: s.fps, tingir: s.tingir, suave: s.suave, ...muda });
        await carregarSprites(true);
      } catch (x) { aviso(x.message, 'erro'); }
    };
    const numero = (rotulo, valor, min, max, campoNome) => h('label', { class: 'sprites-num' }, h('span', null, rotulo),
      h('input', { type: 'number', min, max, value: valor, onchange: e => salvar({ [campoNome]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }) }));
    const nomeCompleto = `${nomePeca(peca)}: ${anim.nome}`;
    return h('div', { class: 'sprites-anim' },
      h('div', { class: 'sprites-anim-cab' },
        h('strong', null, anim.nome),
        h('small', null, `${anim.quadros || 1} ${anim.quadros === 1 ? 'quadro' : 'quadros'} sugeridos, ${anim.fps || 8} por segundo`)),
      h('div', { class: 'sprites-previas' },
        h('figure', null, antes, h('figcaption', null, peca.itemNovo ? 'Molde (o coelho é só guia)' : 'Desenho de sempre')),
        h('figure', null, depois, h('figcaption', null, s ? `Seu sprite (${s.quadros} ${s.quadros === 1 ? 'quadro' : 'quadros'})` : spriteDe(peca.chave, anim.id) ? 'Sem sprite próprio: usa outro desta peça' : 'Seu sprite'))),
      h('div', { class: 'sprites-botoes' },
        botao('Baixar molde', { icone: 'baixo', onclick: () => gerarMolde(peca, anim) }),
        arquivo,
        botao(s ? 'Trocar PNG' : 'Enviar PNG', { icone: 'imagem', classe: 'btn-ouro', onclick: () => arquivo.click() }),
        s && botao(peca.itemNovo ? 'Tirar o sprite' : 'Voltar ao desenho de sempre', { icone: 'lixo', onclick: async () => {
          const texto = peca.itemNovo ? `"${nomeCompleto}" fica sem desenho e sai da loja até um sprite novo chegar.` : `O jogo volta a desenhar "${nomeCompleto}" do jeito de sempre.`;
          if (!await confirmar(texto, { titulo: 'Tirar o sprite?', ok: 'Tirar', perigo: true })) return;
          const q = new URLSearchParams({ nomePeca: nomePeca(peca), nomeAnim: peca.animacoes.length > 1 ? anim.nome : '' });
          try { await api('DELETE', `/api/sprites/${chave}?${q}`); await carregarSprites(true); } catch (x) { aviso(x.message, 'erro'); }
        } })),
      s && h('div', { class: 'sprites-ajustes' },
        numero('Quadros', s.quadros, 1, 64, 'quadros'),
        numero('Por segundo', s.fps, 1, 30, 'fps'),
        interruptor('Pintar com a cor do jogador', s.tingir, v => salvar({ tingir: v }), 'As partes claras pegam a cor do pelo de cada um.'),
        interruptor('Suavizar', s.suave, v => salvar({ suave: v }), 'Desligado = pixel art nítida.'),
        h('small', { class: 'suave' }, `Enviado por ${s.por || 'alguém'}.`)));
  }

  function desenhar() {
    telas.length = 0;
    atualizarPecas();
    desenharAbas();
    trocar(corpo,
      barraNovoItem(),
      pecas.filter(p => (p.jogo || 'Outros') === jogo).map(p => h('section', { class: 'painel sprites-peca', 'data-peca': p.chave },
        h('div', { class: 'painel-cab' }, nomeDaPeca(p),
          h('small', { class: 'suave' }, `${p.largura} x ${p.altura} no jogo (o molde sai em ${Math.round(p.largura * escalaMolde)} x ${Math.round(p.altura * escalaMolde)} por quadro)`)),
        p.itemNovo && painelItem(p),
        p.desc && h('p', { class: 'suave sprites-desc' }, p.desc),
        h('div', { class: 'sprites-anims' }, p.animacoes.map(a => linhaAnimacao(p, a))))));
    if (irPara) {
      const alvo = [...corpo.querySelectorAll('[data-peca]')].find(el => el.dataset.peca === irPara);
      if (alvo) { irPara = null; setTimeout(() => alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
    }
  }

  const escala = h('div', { class: 'segmentado' }, ESCALAS.map(e => h('button', {
    type: 'button', class: e === escalaMolde ? 'seg ativo' : 'seg',
    onclick: ev => { escalaMolde = e; [...ev.currentTarget.parentNode.children].forEach(b => b.classList.toggle('ativo', b === ev.currentTarget)); desenhar(); },
  }, `${e}x`)));

  trocar(raiz,
    cabecalho({ titulo: 'Sprites dos jogos', icone: 'imagem', voltar: { href: '#/recreacao', texto: 'Recreação' },
      sub: 'Troque os desenhos dos joguinhos pelos seus. Sem sprite, o jogo continua com o desenho de sempre.' }),
    h('section', { class: 'painel sprites-como' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('ajustes'), 'Como fazer')),
      h('ol', null,
        h('li', null, h('strong', null, 'Baixe o molde'), ' da animação: é um PNG com os quadros lado a lado, já com o desenho de sempre em cada um, para pintar por cima ou apagar e fazer do zero.'),
        h('li', null, 'Desenhe no ', h('strong', null, 'Aseprite'), ', no ', h('strong', null, 'Piskel'), ' (grátis, no navegador) ou onde preferir, com ', h('strong', null, 'fundo transparente'), '. Mantenha os quadros do mesmo tamanho, da esquerda para a direita, com o personagem olhando para a direita e o pé na base do quadro.'),
        h('li', null, h('strong', null, 'Envie o PNG'), '. O site conta os quadros sozinho (dá para corrigir) e o jogo passa a usar na hora, para todo mundo.'),
        h('li', null, 'O lápis do lado do nome ', h('strong', null, 'renomeia a peça'), ': o nome novo aparece nos jogos e na loja do clube. Em ', h('strong', null, JOGO_ROUPAS), ' e ', h('strong', null, JOGO_CLUBE), ' dá para criar ', h('strong', null, 'itens novos'), ' para o Club Coelho.')),
      h('div', { class: 'sprites-escala' }, h('span', null, 'Tamanho do molde:'), escala,
        h('small', { class: 'suave' }, 'Pode desenhar maior que o molde: o jogo diminui para caber. Para pixel art, 1x ou 2x.'))),
    abas, corpo);
  desenhar();

  // Prévias animadas (as duas colunas de cada animação).
  const inicio = performance.now();
  let raf = 0;
  const passo = agora => {
    raf = requestAnimationFrame(passo);
    const t = (agora - inicio) / 1000;
    for (const { c, desenhar: d } of telas) {
      if (!c.isConnected) continue;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      try { d(g, t); } catch { /* prévia quebrada não derruba a tela */ }
    }
  };
  raf = requestAnimationFrame(passo);
  // Mudou algo (sprite, nome, item novo, também de outra pessoa): a lista é refeita, guardando o que está sendo digitado.
  const tirar = aoMudarSprites(() => {
    carregarSprites().then(r => {
      sprites = r.sprites;
      registrarItensNovos(r.itens || itensNovosDoClube());
      desenhar();
    });
  });
  aoSair(() => { cancelAnimationFrame(raf); tirar(); });
  return raiz;
}
