// Aba "Agenda" da Escala da Guarda: o calendário (mês e semana), o resumo de quem está de turno,
// o painel de um turno e o formulário para marcar e editar turnos (só para quem tem escala.gerir).
import { get, post, put, del, h, trocar, icone, modal, modalForm, confirmar, aviso, botao, campo } from '../core.js';
import {
  API, selecao, entradaData, entradaTexto, semanaDe, mesDe, somarDias, listaDeDias, SEMANA_CURTA,
  dataBr, diaMes, diaLongo, nomeMes, semanaAbrev, agoraBr, minutos, viraNoite, horasTexto, faixa, diaBrDe,
  etiquetaTurno, SIT_TURNO, pessoa, lembrar,
} from './guarda-escala-comum.js';

// Semana de segunda a domingo (como na Gestão Financeira). A visão e o filtro escolhidos ficam guardados entre as trocas de aba.
const est = { visao: lembrar('visao') === 'semana' ? 'semana' : 'mes', ref: null, filtro: 'todos' };
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const MOBILE = '(max-width: 760px)';
// Hora curta para caber na pílula: 08:00 vira 8h, 09:30 vira 9h30.
const hc = s => { const [a, b] = s.split(':'); return `${+a}h${b === '00' ? '' : b}`; };

const abs = (dia, hhmm) => Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)) + minutos(hhmm) * 60000;
const inicioAbs = t => abs(t.data, t.inicio);
const fimAbs = t => abs(t.data, t.fim) + (viraNoite(t) ? 86400000 : 0);
const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

function periodo() {
  if (est.visao === 'semana') { const s = semanaDe(est.ref); return { de: s.inicio, ate: s.fim }; }
  const m = mesDe(est.ref);
  return { de: semanaDe(m.inicio).inicio, ate: semanaDe(m.fim).fim };
}

export async function agenda(corpo, ctx) {
  const base = await get(`${API}/agenda`); // só para saber o "hoje" de Brasília
  ctx.hoje = base.hoje;
  if (!est.ref) est.ref = base.hoje;
  if (est.filtro !== 'todos' && est.filtro !== 'meus' && !ctx.guardas.some(g => g.id === est.filtro)) est.filtro = 'todos';

  const resumoEl = h('div', { class: 'gesc-resumo-vaga' });
  const gradeEl = h('div', { class: 'gesc-grade-vaga', 'aria-live': 'polite' });
  const tituloEl = h('h2', { class: 'gesc-titulo-per', 'aria-live': 'polite' });
  const filtroEl = h('select', { class: 'input gesc-filtro', 'aria-label': 'Filtrar por guarda', onchange: () => { const v = filtroEl.value; est.filtro = v === 'todos' || v === 'meus' ? v : Number(v); desenharGrade(); desenharLegenda(); ajustarPilulas(gradeEl); } });
  const legendaEl = h('div', { class: 'gesc-legenda', role: 'group', 'aria-label': 'Cores dos guardas' });
  const seg = h('div', { class: 'segmentado gesc-visao', role: 'group', 'aria-label': 'Tipo de visão' });
  let dados = { turnos: [], convocacoes: [] };
  let senha = 0;

  const filtrar = lista => lista.filter(t => est.filtro === 'todos' || (est.filtro === 'meus' ? t.meu : t.usuario_id === est.filtro));

  function desenharFiltro() {
    const euGuarda = ctx.guardas.some(g => g.id === ctx.eu.id);
    const ops = [['todos', 'Todos os guardas'], ...(euGuarda ? [['meus', 'Só os meus turnos']] : []), ...ctx.guardas.map(g => [g.id, g.nome])];
    if (est.filtro === 'meus' && !euGuarda) est.filtro = 'todos';
    trocar(filtroEl, ops.map(([v, n]) => h('option', { value: v, selected: String(v) === String(est.filtro) }, n)));
  }
  function desenharLegenda() {
    trocar(legendaEl, ctx.guardas.map(g => h('button', {
      type: 'button', class: `gesc-leg ${est.filtro === g.id ? 'ativa' : ''}`.trim(), style: { '--cor': ctx.cor(g.id) }, 'aria-pressed': String(est.filtro === g.id),
      title: est.filtro === g.id ? 'Mostrar todos de novo' : `Ver só ${g.nome}`,
      onclick: () => { est.filtro = est.filtro === g.id ? 'todos' : g.id; desenharFiltro(); desenharGrade(); desenharLegenda(); ajustarPilulas(gradeEl); },
    }, h('i', { class: 'gesc-leg-cor' }), g.nome)));
  }
  function desenharVisao() {
    trocar(seg, [['mes', 'Mês'], ['semana', 'Semana']].map(([v, n]) => h('button', {
      type: 'button', class: `seg ${est.visao === v ? 'ativo' : ''}`.trim(), 'aria-pressed': String(est.visao === v),
      onclick: () => { est.visao = v; lembrar('visao', v); desenharVisao(); carregarGrade(); },
    }, n)));
  }
  function titulo() {
    if (est.visao === 'mes') return maiuscula(nomeMes(est.ref));
    const s = semanaDe(est.ref);
    return `${diaMes(s.inicio)} a ${dataBr(s.fim)}`;
  }
  function andar(n) {
    if (est.visao === 'semana') est.ref = somarDias(est.ref, 7 * n);
    else est.ref = n < 0 ? somarDias(mesDe(est.ref).inicio, -1) : somarDias(mesDe(est.ref).fim, 1);
    carregarGrade();
  }

  async function carregarGrade() {
    const minha = ++senha;
    const { de, ate } = periodo();
    tituloEl.textContent = titulo();
    gradeEl.setAttribute('aria-busy', 'true');
    try {
      const r = await get(`${API}/agenda?de=${de}&ate=${ate}`);
      if (minha !== senha) return;
      dados = r;
      desenharGrade();
      requestAnimationFrame(() => ajustarPilulas(gradeEl));
    } catch (e) {
      if (minha !== senha) return;
      trocar(gradeEl, h('p', { class: 'form-erro', role: 'alert' }, e.message));
    } finally { if (minha === senha) gradeEl.removeAttribute('aria-busy'); }
  }
  async function carregarResumo() {
    const r = await get(`${API}/agenda?de=${somarDias(ctx.hoje, -1)}&ate=${somarDias(ctx.hoje, 7)}`);
    trocar(resumoEl, resumo(r.turnos, ctx));
  }
  ctx.atualizar = () => Promise.all([carregarResumo().catch(() => {}), carregarGrade()]);

  function desenharGrade() {
    const turnos = filtrar(dados.turnos);
    const convs = new Map();
    for (const c of dados.convocacoes) { const d = diaBrDe(c.criada_em); (convs.get(d) || convs.set(d, []).get(d)).push(c); }
    const por = new Map();
    for (const t of turnos) (por.get(t.data) || por.set(t.data, []).get(t.data)).push(t);
    trocar(gradeEl,
      est.visao === 'mes' ? gradeMes(por, convs, ctx) : gradeSemana(por, convs, ctx),
      !turnos.length && h('p', { class: 'gesc-sem-turnos' }, icone('calendario'),
        est.filtro === 'todos'
          ? (ctx.gerir ? 'Nenhum turno neste período. Clique em um dia (ou em "Marcar turno") para definir quem atende e quando.' : 'Nenhum turno marcado neste período. O Comandante da Guarda define os horários.')
          : 'Nenhum turno deste filtro neste período.'));
  }

  const diaSugerido = () => (est.visao === 'semana' || est.ref.slice(0, 7) !== ctx.hoje.slice(0, 7) ? (est.visao === 'semana' ? est.ref : mesDe(est.ref).inicio) : ctx.hoje);

  desenharFiltro(); desenharLegenda(); desenharVisao();
  trocar(corpo,
    h('div', { class: 'gesc-barra' },
      h('div', { class: 'gesc-nav' },
        h('button', { class: 'btn-icone', type: 'button', 'aria-label': est.visao === 'mes' ? 'Mês anterior' : 'Semana anterior', onclick: () => andar(-1) }, icone('voltar')),
        h('button', { class: 'btn', type: 'button', onclick: () => { est.ref = ctx.hoje; carregarGrade(); } }, 'Hoje'),
        h('button', { class: 'btn-icone', type: 'button', 'aria-label': est.visao === 'mes' ? 'Mês seguinte' : 'Semana seguinte', onclick: () => andar(1) }, icone('frente')),
        tituloEl),
      h('div', { class: 'gesc-barra-dir' },
        seg, filtroEl,
        ctx.gerir && botao('Marcar turno', { icone: 'mais', classe: 'btn-ouro', onclick: () => formularioTurno(ctx, { dia: diaSugerido() }) }))),
    h('div', { class: 'gesc-faixa-topo' }, resumoEl, legendaEl),
    gradeEl);
  // Fecha o painel do resumo ao clicar fora ou apertar Esc.
  const fecharResumo = e => {
    if (!resumoEl.isConnected) { document.removeEventListener('click', fecharResumo); document.removeEventListener('keydown', fecharResumo); return; }
    const d = resumoEl.querySelector('details');
    if (d?.open && (e.type === 'keydown' ? e.key === 'Escape' : !d.contains(e.target))) d.open = false;
  };
  document.addEventListener('click', fecharResumo); document.addEventListener('keydown', fecharResumo);
  // Pílulas que não cabem na célula viram "+N" (a altura das células depende da janela).
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => ajustarPilulas(gradeEl)).observe(gradeEl);
  // Os botões de navegação mudam de rótulo com a visão: refaz depois de trocar.
  seg.addEventListener('click', () => {
    corpo.querySelector('.gesc-nav .btn-icone:first-child')?.setAttribute('aria-label', est.visao === 'mes' ? 'Mês anterior' : 'Semana anterior');
    corpo.querySelector('.gesc-nav .btn-icone:nth-child(3)')?.setAttribute('aria-label', est.visao === 'mes' ? 'Mês seguinte' : 'Semana seguinte');
  });
  await Promise.all([carregarResumo(), carregarGrade()]);
}

/* ─── Resumo: quem está de turno ─────────────────── */

function resumo(turnos, ctx) {
  const ag = agoraBr();
  const agora = abs(ag.dia, ag.hora);
  const agoraT = turnos.filter(t => inicioAbs(t) <= agora && agora < fimAbs(t));
  const hojeT = turnos.filter(t => t.data === ctx.hoje);
  const proximos = turnos.filter(t => inicioAbs(t) > agora && t.data > ctx.hoje).slice(0, 5);
  const meu = turnos.find(t => t.meu && fimAbs(t) > agora && t.situacao === 'agendado');
  const linha = (t, extra) => h('li', { class: `gesc-res-item ${t.meu ? 'meu' : ''}`.trim(), style: { '--cor': ctx.cor(t.usuario_id) } },
    pessoa(t), h('span', { class: 'gesc-res-texto' }, h('strong', null, t.guarda_nome), h('small', null, extra)));
  const coluna = (tit, ic, lista, vazio, fn) => h('div', { class: 'gesc-res-col' },
    h('h3', null, icone(ic), tit),
    lista.length ? h('ul', { class: 'gesc-res-lista' }, lista.map(fn)) : h('p', { class: 'gesc-res-vazio' }, vazio));
  const nomes = [...new Set(agoraT.map(t => t.guarda_nome))].join(', ');
  const linhaMeu = meu && (inicioAbs(meu) <= agora ? `Você está de turno até as ${meu.fim}` : `Seu próximo turno: ${semanaAbrev(meu.data)}, ${diaMes(meu.data)}, ${meu.inicio} às ${meu.fim}`);
  return h('details', { class: 'gesc-resumo', 'aria-label': 'Resumo da escala' },
    h('summary', { class: 'gesc-res-sum' },
      icone('escudo'),
      h('span', { class: 'gesc-res-txt' },
        linhaMeu && h('span', { class: 'gesc-res-meu' }, linhaMeu),
        h('span', null, h('b', null, 'Agora: '), agoraT.length ? nomes : 'ninguém de turno'),
        h('span', null, h('b', null, 'Hoje: '), hojeT.length ? `${hojeT.length} ${hojeT.length === 1 ? 'turno' : 'turnos'}` : 'sem turnos')),
      h('span', { class: 'gesc-res-abre' }, 'Detalhes')),
    h('div', { class: 'gesc-res-painel' },
      h('div', { class: 'gesc-res-grade' },
        coluna('De turno agora', 'escudo', agoraT, 'Ninguém está de turno neste momento.', t => linha(t, `até as ${t.fim}${viraNoite(t) ? ' (dia seguinte)' : ''}`)),
        coluna('Hoje', 'calendario', hojeT, 'Nenhum turno marcado para hoje.', t => linha(t, `${t.inicio} às ${t.fim}${t.situacao !== 'agendado' ? ` · ${SIT_TURNO[t.situacao][0]}` : ''}`)),
        coluna('Próximos turnos', 'relogio', proximos, 'Nada marcado para os próximos dias.', t => linha(t, `${semanaAbrev(t.data)}, ${diaMes(t.data)} · ${t.inicio} às ${t.fim}`)))));
}

/* ─── Mês ────────────────────────────────────────── */

function pilula(t, ctx) {
  return h('button', {
    type: 'button', class: `gesc-pil sit-${t.situacao} ${t.meu ? 'meu' : ''}`.trim(), style: { '--cor': ctx.cor(t.usuario_id) },
    title: `${t.guarda_nome}, ${dataBr(t.data)}, ${faixa(t)}`,
    'aria-label': `${t.guarda_nome}, ${diaLongo(t.data)}, das ${t.inicio} às ${t.fim}${viraNoite(t) ? ' (termina no dia seguinte)' : ''}, ${SIT_TURNO[t.situacao][0]}${t.meu ? ', seu turno' : ''}`,
    onclick: e => { e.stopPropagation(); abrirTurno(t, ctx); },
  },
  t.situacao === 'cumprido' ? icone('check') : t.situacao === 'faltou' ? icone('x') : null,
  h('span', { class: 'gesc-pil-nome' }, t.guarda_nome),
  h('span', { class: 'gesc-pil-hora' }, `${hc(t.inicio)}-${hc(t.fim)}`, viraNoite(t) && h('sup', null, '+1')));
}

function marcasConvocacao(lista, ctx) {
  if (!lista?.length) return null;
  const c = lista[0];
  const texto = `Convocação: ${c.motivo}${lista.length > 1 ? ` (e mais ${lista.length - 1})` : ''}`;
  const dentro = [icone('megafone'), lista.length > 1 && h('b', null, lista.length)];
  return ctx.gerir
    ? h('a', { class: 'gesc-conv-marca', href: `#/guarda-escala/convocacao/${c.id}`, title: texto, 'aria-label': texto }, dentro)
    : h('a', { class: 'gesc-conv-marca', href: '#/guarda-escala/convocacoes', title: texto, 'aria-label': texto }, dentro);
}

function gradeMes(por, convs, ctx) {
  const { de, ate } = periodo();
  const dias = listaDeDias(de, ate);
  const mes = est.ref.slice(0, 7);
  return h('div', { class: 'gesc-mes', style: { '--linhas': dias.length / 7 } },
    h('div', { class: 'gesc-mes-cab', 'aria-hidden': 'true' }, ORDEM_SEMANA.map(i => h('span', null, SEMANA_CURTA[i]))),
    h('div', { class: 'gesc-mes-grade' }, dias.map(d => {
      const lista = por.get(d) || [];
      const clique = () => (ctx.gerir ? formularioTurno(ctx, { dia: d }) : lista.length && abrirDia(d, lista, ctx));
      const cel = h('div', {
        class: `gesc-dia ${d.slice(0, 7) !== mes ? 'fora' : ''} ${d === ctx.hoje ? 'hoje' : ''} ${lista.length ? '' : 'sem-turno'}`.trim(),
        onclick: e => { if (e.target === cel) clique(); },
      },
      h('div', { class: 'gesc-dia-cab' },
        ctx.gerir || lista.length
          ? h('button', { type: 'button', class: 'gesc-dia-num', 'aria-label': ctx.gerir ? `Marcar turno em ${dataBr(d)}` : `Ver os turnos de ${dataBr(d)}`, title: ctx.gerir ? 'Marcar turno neste dia' : null, onclick: clique },
            h('b', null, +d.slice(8)), h('span', { class: 'gesc-dia-rot' }, `${semanaAbrev(d)}, ${diaMes(d)}`), d === ctx.hoje && h('em', null, 'hoje'))
          : h('span', { class: 'gesc-dia-num sem-botao' }, h('b', null, +d.slice(8)), h('span', { class: 'gesc-dia-rot' }, `${semanaAbrev(d)}, ${diaMes(d)}`)),
        lista.length > 0 && h('button', { type: 'button', class: 'gesc-mais', hidden: true, onclick: () => abrirDia(d, lista, ctx), 'aria-label': `Ver os ${lista.length} turnos de ${dataBr(d)}` }),
        marcasConvocacao(convs.get(d), ctx)),
      lista.length > 0 && h('div', { class: 'gesc-dia-pils' }, lista.map(t => pilula(t, ctx))));
      return cel;
    })));
}

// Esconde as pílulas que passam da altura da célula e mostra "+N" no lugar (no celular a lista mostra tudo).
function ajustarPilulas(gradeEl) {
  const celular = matchMedia(MOBILE).matches;
  for (const box of gradeEl.querySelectorAll('.gesc-dia-pils')) {
    const pils = [...box.querySelectorAll('.gesc-pil')];
    const mais = box.parentElement.querySelector('.gesc-mais');
    pils.forEach(p => p.classList.remove('extra'));
    mais.hidden = true;
    if (celular || box.scrollHeight <= box.clientHeight + 1) continue;
    mais.hidden = false;
    let n = pils.length;
    while (n > 0 && box.scrollHeight > box.clientHeight + 1) { n--; pils[n].classList.add('extra'); mais.textContent = `+${pils.length - n}`; }
  }
}

/* ─── Semana ─────────────────────────────────────── */

function cartaoSemana(t, ctx) {
  const ini = minutos(t.inicio) / 14.4; // % do dia (1440 min)
  const dur = ((minutos(t.fim) - minutos(t.inicio) + (viraNoite(t) ? 1440 : 0)) / 14.4);
  return h('button', {
    type: 'button', class: `gesc-cartao sit-${t.situacao} ${t.meu ? 'meu' : ''}`.trim(), style: { '--cor': ctx.cor(t.usuario_id) },
    'aria-label': `${t.guarda_nome}, das ${t.inicio} às ${t.fim}${viraNoite(t) ? ' (termina no dia seguinte)' : ''}, ${SIT_TURNO[t.situacao][0]}${t.meu ? ', seu turno' : ''}`,
    onclick: () => abrirTurno(t, ctx),
  },
  h('span', { class: 'gesc-cartao-topo' }, pessoa(t), h('strong', null, t.guarda_nome)),
  h('span', { class: 'gesc-cartao-hora' }, `${t.inicio} às ${t.fim}`, viraNoite(t) && h('small', null, ' +1 dia')),
  h('span', { class: 'gesc-faixa', 'aria-hidden': 'true' }, h('i', { style: { left: `${ini}%`, width: `${Math.min(dur, 100 - ini)}%` } }), viraNoite(t) && h('i', { class: 'volta', style: { left: '0', width: `${dur - (100 - ini)}%` } })),
  t.obs && h('span', { class: 'gesc-cartao-obs' }, t.obs),
  t.situacao !== 'agendado' && etiquetaTurno(t.situacao));
}

function gradeSemana(por, convs, ctx) {
  const s = semanaDe(est.ref);
  return h('div', { class: 'gesc-sem' }, listaDeDias(s.inicio, s.fim).map(d => {
    const lista = por.get(d) || [];
    return h('section', { class: `gesc-sem-dia ${d === ctx.hoje ? 'hoje' : ''} ${lista.length ? '' : 'sem-turno'}`.trim(), 'aria-label': diaLongo(d) },
      h('header', null, h('span', null, semanaAbrev(d)), h('b', null, diaMes(d)), d === ctx.hoje && h('em', null, 'hoje'), marcasConvocacao(convs.get(d), ctx),
        ctx.gerir && h('button', { type: 'button', class: 'gesc-sem-add', onclick: () => formularioTurno(ctx, { dia: d }), 'aria-label': `Marcar turno em ${dataBr(d)}`, title: 'Marcar turno neste dia' }, icone('mais'))),
      h('div', { class: 'gesc-sem-lista' }, lista.length ? lista.map(t => cartaoSemana(t, ctx)) : h('p', { class: 'gesc-sem-vazio' }, 'Sem turnos')));
  }));
}

/* ─── Painéis ────────────────────────────────────── */

function abrirDia(d, lista, ctx) {
  const m = modal({
    titulo: diaLongo(d), tamanho: 'pequeno',
    corpo: h('ul', { class: 'gesc-dia-lista' }, lista.map(t => h('li', null, h('button', {
      type: 'button', class: `gesc-cartao sit-${t.situacao} ${t.meu ? 'meu' : ''}`.trim(), style: { '--cor': ctx.cor(t.usuario_id) },
      onclick: () => { m.fechar(); abrirTurno(t, ctx); },
    }, h('span', { class: 'gesc-cartao-topo' }, pessoa(t), h('strong', null, t.guarda_nome)),
    h('span', { class: 'gesc-cartao-hora' }, `${t.inicio} às ${t.fim}`, viraNoite(t) && h('small', null, ' +1 dia')),
    t.obs && h('span', { class: 'gesc-cartao-obs' }, t.obs), t.situacao !== 'agendado' && etiquetaTurno(t.situacao))))),
    rodape: [ctx.gerir && botao('Marcar turno neste dia', { icone: 'mais', onclick: () => { m.fechar(); formularioTurno(ctx, { dia: d }); } }), h('span', { class: 'espaco' }),
      h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Fechar')],
  });
}

function abrirTurno(t, ctx) {
  const mudar = sit => async () => {
    await post(`${API}/turnos/${t.id}/situacao`, { situacao: sit });
    aviso(`Turno marcado como ${SIT_TURNO[sit][0].toLowerCase()}.`);
    m.fechar();
    ctx.atualizar();
  };
  const apagar = async () => {
    if (!await confirmar(`O turno de ${t.guarda_nome} em ${dataBr(t.data)}, das ${t.inicio} às ${t.fim}, será apagado da agenda.`, { titulo: 'Apagar este turno?', ok: 'Apagar turno', perigo: true })) return;
    try { await del(`${API}/turnos/${t.id}`); } catch (e) { aviso(e.message, 'erro'); return; }
    aviso('Turno apagado.');
    m.fechar();
    ctx.atualizar();
  };
  const linhaDl = (r, v) => v ? h('div', null, h('dt', null, r), h('dd', null, v)) : null;
  const m = modal({
    titulo: 'Turno da Guarda', tamanho: 'pequeno',
    corpo: h('div', { class: 'gesc-turno', style: { '--cor': ctx.cor(t.usuario_id) } },
      h('div', { class: 'gesc-turno-guarda' }, pessoa(t, 'avatar-m'), h('div', null, h('strong', null, t.guarda_nome), t.meu && h('small', null, 'É você'))),
      h('dl', { class: 'gesc-dl' },
        linhaDl('Dia', diaLongo(t.data)),
        linhaDl('Horário', faixa(t)),
        linhaDl('Duração', horasTexto(t.horas)),
        h('div', null, h('dt', null, 'Situação'), h('dd', null, etiquetaTurno(t.situacao))),
        linhaDl('Observação', t.obs),
        linhaDl('Marcado por', t.criado_por_nome)),
      ctx.gerir && h('div', { class: 'gesc-turno-sit' },
        h('span', { class: 'campo-rotulo' }, 'Registrar como'),
        h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Situação do turno' }, Object.entries(SIT_TURNO).map(([k, [n]]) =>
          h('button', { type: 'button', class: `seg ${t.situacao === k ? 'ativo' : ''}`.trim(), 'aria-pressed': String(t.situacao === k), disabled: t.situacao === k, onclick: e => { e.currentTarget.disabled = true; return mudar(k)().catch(err => { aviso(err.message, 'erro'); e.currentTarget.disabled = false; }); } }, n))))),
    rodape: ctx.gerir
      ? [botao('Apagar', { icone: 'lixo', classe: 'btn-perigo-texto', onclick: apagar }), h('span', { class: 'espaco' }),
        h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Fechar'),
        botao('Editar', { icone: 'editar', classe: 'btn-ouro', onclick: () => { m.fechar(); formularioTurno(ctx, { turno: t }); } })]
      : [h('span', { class: 'espaco' }), h('button', { class: 'btn', type: 'button', onclick: () => m.fechar() }, 'Fechar')],
  });
}

/* ─── Formulário de turno ────────────────────────── */

export function formularioTurno(ctx, { dia = '', turno = null } = {}) {
  const edicao = !!turno;
  const avisoNoite = h('p', { class: 'gesc-aviso-noite', role: 'status', hidden: true }, icone('alerta'));
  const ini = h('input', { class: 'input', type: 'time', required: true, value: turno?.inicio || '08:00', 'aria-label': 'Início do turno' });
  const fim = h('input', { class: 'input', type: 'time', required: true, value: turno?.fim || '12:00', 'aria-label': 'Fim do turno' });
  const checarNoite = () => {
    const ok = ini.value && fim.value && ini.value !== fim.value && minutos(fim.value) < minutos(ini.value);
    avisoNoite.hidden = !ok;
    if (ok) avisoNoite.replaceChildren(icone('alerta'), 'Esse turno vira a noite: termina às ' + fim.value + ' do dia seguinte.');
  };
  ini.addEventListener('input', checarNoite); fim.addEventListener('input', checarNoite);
  const obs = entradaTexto(turno?.obs || '', { maxlength: '200', placeholder: 'Ex.: Portão leste, ronda da muralha' });
  const horas = h('div', { class: 'form-grade gesc-horas' }, campo('Início', ini, { obrigatorio: true }), campo('Fim', fim, { obrigatorio: true }));

  let corpo;
  let ler;
  if (edicao) {
    const quem = selecao(ctx.guardas.map(g => [g.id, g.nome]), turno.usuario_id, { 'aria-label': 'Guarda' });
    const data = entradaData(turno.data, { required: true, 'aria-label': 'Dia do turno' });
    corpo = [campo('Guarda', quem), campo('Dia', data, { obrigatorio: true }), horas, avisoNoite, campo('Observação (opcional)', obs)];
    ler = () => ({ id: turno.id, corpo: { usuario_id: Number(quem.value), data: data.value, inicio: ini.value, fim: fim.value, obs: obs.value } });
  } else {
    const escolhido = typeof est.filtro === 'number' ? est.filtro : null;
    const caixas = ctx.guardas.map(g => h('input', { type: 'checkbox', value: g.id, checked: ctx.guardas.length === 1 || g.id === escolhido, 'aria-label': g.nome }));
    const marcar = v => caixas.forEach(c => { c.checked = v; });
    const dias = new Set(dia ? [dia] : []);
    const chipsEl = h('div', { class: 'chips gesc-chips', 'aria-live': 'polite' });
    const novoDia = entradaData('', { 'aria-label': 'Escolher um dia' });
    const desenharChips = () => trocar(chipsEl, dias.size
      ? [...dias].sort().map(d => h('span', { class: 'chip chip-ouro' }, `${semanaAbrev(d)} ${dataBr(d)}`,
        h('button', { type: 'button', class: 'chip-x', 'aria-label': `Tirar o dia ${dataBr(d)}`, onclick: () => { dias.delete(d); desenharChips(); } }, icone('x'))))
      : h('span', { class: 'suave' }, 'Nenhum dia escolhido ainda.'));
    const somar = () => {
      if (!novoDia.value) { aviso('Escolha o dia no campo de data.', 'erro'); novoDia.focus(); return; }
      dias.add(novoDia.value); novoDia.value = ''; desenharChips();
    };
    novoDia.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); somar(); } });
    const ate = entradaData('', { 'aria-label': 'Repetir até o dia' });
    const repetir = () => {
      if (!dias.size) { aviso('Escolha primeiro o primeiro dia.', 'erro'); return; }
      if (!ate.value) { aviso('Escolha até que dia repetir.', 'erro'); ate.focus(); return; }
      const primeiro = [...dias].sort()[0];
      let n = 0;
      for (let d = somarDias(primeiro, 7); d <= ate.value && n < 60; d = somarDias(d, 7)) { dias.add(d); n++; }
      if (!n) aviso('A data final precisa ser pelo menos uma semana depois do primeiro dia.', 'erro');
      else aviso(`${n} semana(s) a mais incluída(s), sempre no mesmo dia da semana.`);
      desenharChips();
    };
    desenharChips();
    corpo = [
      h('fieldset', { class: 'gesc-fs' },
        h('legend', { class: 'campo-rotulo' }, 'Guardas ', h('b', { class: 'obrig', title: 'Obrigatório' }, '*')),
        h('div', { class: 'gesc-fs-acoes' },
          h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => marcar(true) }, 'Marcar todos'),
          h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => marcar(false) }, 'Limpar')),
        h('div', { class: 'gesc-checks' }, ctx.guardas.map((g, i) => h('label', { class: 'gesc-check', style: { '--cor': ctx.cor(g.id) } }, caixas[i], pessoa(g), h('span', null, g.nome))))),
      h('fieldset', { class: 'gesc-fs' },
        h('legend', { class: 'campo-rotulo' }, 'Dias ', h('b', { class: 'obrig', title: 'Obrigatório' }, '*')),
        h('div', { class: 'gesc-linha-data' }, novoDia, h('button', { class: 'btn', type: 'button', onclick: somar }, icone('mais'), h('span', null, 'Adicionar dia'))),
        chipsEl,
        h('div', { class: 'gesc-linha-data gesc-repetir' }, h('span', { class: 'suave' }, 'Repetir toda semana até'), ate, h('button', { class: 'btn', type: 'button', onclick: repetir }, 'Repetir'))),
      horas, avisoNoite, campo('Observação (opcional)', obs),
    ];
    ler = () => {
      const usuario_ids = caixas.filter(c => c.checked).map(c => Number(c.value));
      if (!usuario_ids.length) throw new Error('Escolha pelo menos um guarda.');
      if (!dias.size) throw new Error('Escolha pelo menos um dia (use "Adicionar dia").');
      return { corpo: { usuario_ids, datas: [...dias].sort(), inicio: ini.value, fim: fim.value, obs: obs.value } };
    };
  }
  checarNoite();
  modalForm({
    titulo: edicao ? 'Editar turno' : 'Marcar turno', tamanho: 'medio', textoOk: edicao ? 'Salvar' : 'Marcar turno',
    conteudo: corpo,
    aoEnviar: async () => {
      if (ini.value === fim.value) throw new Error('O início e o fim não podem ser iguais.');
      const { id, corpo: c } = ler();
      if (edicao) { await put(`${API}/turnos/${id}`, c); aviso('Turno atualizado.'); }
      else { const r = await post(`${API}/turnos`, c); aviso(`${r.criados} ${r.criados === 1 ? 'turno marcado' : 'turnos marcados'}.`); }
      ctx.atualizar();
    },
  });
}
