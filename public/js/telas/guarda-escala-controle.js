// Aba "Controle" da Escala da Guarda (só para quem gere): quem mais trabalha e quem está se dedicando.
import { get, h, trocar, icone, aviso, vazio } from '../core.js';
import { API, carregando, painel, tabela, td, entradaData, somarDias, dataBr, horasTexto, pessoa } from './guarda-escala-comum.js';

const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['custom', 'Personalizado']];
const est = { per: '30', de: '', ate: '' };

export async function controle(corpo, ctx) {
  const resultado = h('div', { class: 'gesc-ctl-res', 'aria-live': 'polite' }, carregando());
  const botoes = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Período do controle' });
  const de = entradaData(est.de || somarDias(ctx.hoje, -29), { 'aria-label': 'Início do período' });
  const ate = entradaData(est.ate || ctx.hoje, { 'aria-label': 'Fim do período' });
  const custom = h('div', { class: 'gesc-ctl-custom', hidden: est.per !== 'custom' },
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'De'), de),
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Até'), ate),
    h('button', { class: 'btn', type: 'button', onclick: () => { if (!de.value || !ate.value) { aviso('Preencha as duas datas.', 'erro'); return; } if (de.value > ate.value) { aviso('O começo do período vem depois do fim.', 'erro'); return; } est.de = de.value; est.ate = ate.value; carregar(); } }, icone('calendario'), h('span', null, 'Ver')));

  function desenharBotoes() {
    trocar(botoes, PERIODOS.map(([k, n]) => h('button', {
      type: 'button', class: `seg ${est.per === k ? 'ativo' : ''}`.trim(), 'aria-pressed': String(est.per === k),
      onclick: () => { est.per = k; desenharBotoes(); custom.hidden = k !== 'custom'; if (k !== 'custom') carregar(); else if (est.de) carregar(); },
    }, n)));
  }
  let senha = 0;
  async function carregar() {
    const minha = ++senha;
    let q;
    if (est.per === 'custom') q = `de=${est.de || de.value}&ate=${est.ate || ate.value}`;
    else q = `de=${somarDias(ctx.hoje, -(Number(est.per) - 1))}&ate=${ctx.hoje}`;
    try {
      const r = await get(`${API}/controle?${q}`);
      if (minha !== senha) return;
      trocar(resultado, ranking(r, ctx));
    } catch (e) {
      if (minha !== senha) return;
      trocar(resultado, h('p', { class: 'form-erro', role: 'alert' }, e.message));
    }
  }
  desenharBotoes();
  trocar(corpo,
    h('section', { class: 'painel gesc-ctl-filtro' },
      h('div', { class: 'painel-cab' }, h('h2', null, icone('trofeu'), 'Quem mais trabalha')),
      h('p', { class: 'suave' }, 'Horas dos turnos que você marcou como cumpridos, mais as convocações atendidas. Marque cada turno como Cumprido ou Faltou na agenda para o controle ficar certo.'),
      botoes, custom),
    resultado);
  await carregar();
}

const pct = (v, max) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

function ranking(r, ctx) {
  const g = r.guardas;
  if (!g.length) {
    return vazio('Nenhum guarda cadastrado', 'Dê o cargo Guarda (ou Comandante da Guarda) aos usuários, em Administração, Usuários. Eles passam a aparecer aqui e na agenda.', h('a', { class: 'btn', href: '#/admin/usuarios' }, 'Abrir usuários'));
  }
  const maxHoras = Math.max(0, ...g.map(x => x.horas_marcadas));
  const tot = g.reduce((s, x) => ({
    cumpridas: s.cumpridas + x.horas_cumpridas, turnos: s.turnos + x.turnos, faltas: s.faltas + x.faltas,
    conv: s.conv + x.convocacoes, atend: s.atend + x.atendidas, ret: s.ret + x.removidas,
  }), { cumpridas: 0, turnos: 0, faltas: 0, conv: 0, atend: 0, ret: 0 });
  const lider = g[0].pontos > 0 ? g[0] : null;
  const card = (n, rot, classe = '') => h('div', { class: `gesc-total ${classe}`.trim() }, h('b', null, n), h('span', null, rot));

  const linhas = g.map((x, i) => {
    const primeiro = lider && x.usuario_id === lider.usuario_id;
    const alerta = x.faltas > 0 || x.removidas > 0;
    return h('tr', { class: `${primeiro ? 'gesc-lider' : ''} ${alerta ? 'gesc-alerta' : ''}`.trim(), style: { '--cor': ctx.cor(x.usuario_id) } },
      td('', h('div', { class: 'gesc-ctl-quem' },
        h('span', { class: 'gesc-pos' }, primeiro ? icone('coroa') : `${i + 1}º`),
        pessoa(x, 'avatar-m'),
        h('span', null, h('strong', null, x.nome), primeiro && h('small', { class: 'gesc-ouro' }, 'Mais dedicado do período')))),
      td('Horas', h('div', { class: 'gesc-horas-cel' },
        h('div', { class: 'gesc-barra-h', role: 'img', 'aria-label': `${horasTexto(x.horas_cumpridas)} cumpridas de ${horasTexto(x.horas_marcadas)} marcadas` },
          h('i', { class: 'marcada', style: { width: `${pct(x.horas_marcadas, maxHoras)}%` } }),
          h('i', { class: 'cumprida', style: { width: `${pct(x.horas_cumpridas, maxHoras)}%` } })),
        h('small', null, h('b', null, horasTexto(x.horas_cumpridas)), ` cumpridas de ${horasTexto(x.horas_marcadas)}`))),
      td('Turnos', `${x.turnos_cumpridos} cumpridos de ${x.turnos}`),
      td('Faltas', x.faltas ? h('span', { class: 'etiqueta gesc-et-ruim' }, x.faltas) : '0', 'num'),
      td('Convocações', h('span', null, `${x.atendidas} de ${x.convocacoes} atendidas`, x.removidas > 0 && h('span', { class: 'etiqueta gesc-et-ruim gesc-retirada' }, `${x.removidas} retirada(s)`))),
      td('Taxa', x.taxa_convocacao == null ? '-' : `${x.taxa_convocacao}%`, 'num'),
      td('Pontos', h('strong', { class: 'gesc-pontos' }, String(x.pontos).replace('.', ',')), 'num'));
  });

  return h('div', null,
    h('div', { class: 'gesc-totais-grade' },
      card(horasTexto(tot.cumpridas), 'horas cumpridas'),
      card(`${tot.turnos}`, 'turnos marcados'),
      card(`${tot.atend} de ${tot.conv}`, 'convocações atendidas'),
      card(`${tot.faltas + tot.ret}`, 'faltas e retiradas', tot.faltas + tot.ret ? 'ruim' : '')),
    painel(`Ranking de ${dataBr(r.de)} a ${dataBr(r.ate)}`, 'trofeu',
      tabela(['Guarda', 'Horas', 'Turnos', 'Faltas', 'Convocações', 'Taxa', 'Pontos'], linhas, { classe: 'gesc-tabela', vazio: 'Sem dados neste período.' })),
    h('p', { class: 'suave gesc-legenda-ctl' }, 'Pontos = horas cumpridas + convocações atendidas. Taxa = convocações atendidas dividida pelas recebidas. A barra clara mostra as horas marcadas e a dourada as cumpridas.'));
}
