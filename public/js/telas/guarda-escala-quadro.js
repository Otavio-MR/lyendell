// Aba "Quadro" da Escala da Guarda: quem é o Lorde Comandante, o General (braço direito) e os Guardas.
// O Lorde Comandante escolhe o General e os Guardas; o General escolhe só os Guardas; o Lorde Comandante só o
// administrador do site muda (em Administração, Usuários). O servidor confere cada nomeação.
import { get, post, h, trocar, icone, aviso, confirmar, vazio } from '../core.js';
import { API, carregando, painel, pessoa } from './guarda-escala-comum.js';

async function enviar(rota, corpo, ok) {
  try { await post(`${API}/quadro/${rota}`, corpo); aviso(ok); return true; } catch (e) { aviso(e.message || 'Não deu certo.', 'erro'); return false; }
}

function cartao(u, { cargo, pode, recarregar }) {
  const acoes = [];
  if (pode && cargo === 'Guarda') {
    acoes.push(h('button', { type: 'button', class: 'btn btn-pequeno', 'aria-label': `Exonerar ${u.nome}`, onclick: async () => {
      if (await confirmar(`Tirar ${u.nome} da Guarda?`, { titulo: 'Exonerar guarda', ok: 'Exonerar', perigo: true }) && await enviar('exonerar', { usuario_id: u.id, cargo: 'Guarda' }, `${u.nome} saiu da Guarda.`)) recarregar();
    } }, 'Exonerar'));
  }
  if (pode && cargo === 'General') {
    acoes.push(h('button', { type: 'button', class: 'btn btn-pequeno', 'aria-label': `Exonerar o General ${u.nome}`, onclick: async () => {
      if (await confirmar(`${u.nome} deixa de ser General e volta a ser Guarda?`, { titulo: 'Exonerar o General', ok: 'Exonerar', perigo: true }) && await enviar('exonerar', { usuario_id: u.id, cargo: 'General' }, `${u.nome} voltou a ser Guarda.`)) recarregar();
    } }, 'Exonerar'));
  }
  return h('li', { class: 'gesc-qd-pessoa' }, pessoa(u, 'avatar-p'), h('strong', null, u.nome), acoes.length ? h('span', { class: 'gesc-qd-acoes' }, acoes) : null);
}

// Escolhe alguém da lista e nomeia.
function formNomear({ titulo, cargo, opcoes, recarregar }) {
  if (!opcoes.length) return h('p', { class: 'suave' }, 'Não há mais ninguém para nomear.');
  const sel = h('select', { class: 'input', 'aria-label': titulo }, h('option', { value: '' }, 'Escolha quem...'), opcoes.map(u => h('option', { value: String(u.id) }, u.nome)));
  const btn = h('button', { type: 'button', class: 'btn btn-ouro', onclick: async () => {
    if (!sel.value) { aviso('Escolha quem será nomeado.', 'erro'); return; }
    const nome = sel.options[sel.selectedIndex].text;
    btn.disabled = true;
    try { if (await enviar('nomear', { usuario_id: Number(sel.value), cargo }, `${nome} agora é ${cargo}.`)) recarregar(); } finally { btn.disabled = false; }
  } }, icone('mais'), h('span', null, titulo));
  return h('div', { class: 'gesc-qd-nomear' }, sel, btn);
}

function bloco(titulo, descricao, lista, opcoes, formulario) {
  return painel(titulo, 'escudo', h('div', { class: 'gesc-qd-bloco' },
    h('p', { class: 'suave' }, descricao),
    lista.length ? h('ul', { class: 'gesc-qd-lista' }, lista.map(u => cartao(u, opcoes))) : h('p', { class: 'suave' }, 'Ninguém ainda.'),
    formulario));
}

export async function quadro(corpo, ctx) {
  trocar(corpo, carregando());
  const d = await get(`${API}/quadro`);
  const recarregar = () => quadro(corpo, ctx);
  const geral = d.generais;
  trocar(corpo, h('div', { class: 'gesc-quadro' },
    h('div', { class: 'gesc-qd-hierarquia' },
      bloco('Lorde Comandante', 'Comanda a Guarda do Coelho. Escolhe o General e os Guardas. Só o administrador do site muda quem é o Lorde Comandante.', d.lorde, { cargo: 'Lorde Comandante', pode: false, recarregar }),
      bloco('General', 'O braço direito do Lorde Comandante: faz o mesmo que ele na Guarda, mas quem decide quem é o General é o Lorde Comandante.', geral, { cargo: 'General', pode: d.podes.nomear_general, recarregar },
        d.podes.nomear_general && formNomear({ titulo: 'Nomear General', cargo: 'General', opcoes: [...d.candidatos, ...d.guardas], recarregar })),
      bloco('Guardas', 'Fazem as rondas e atendem nos turnos da agenda.', d.guardas, { cargo: 'Guarda', pode: d.podes.nomear, recarregar },
        d.podes.nomear && formNomear({ titulo: 'Nomear Guarda', cargo: 'Guarda', opcoes: d.candidatos, recarregar }))),
    !d.podes.nomear && !d.podes.nomear_general && h('p', { class: 'nota' }, icone('escudo'), h('span', null, 'Só o Lorde Comandante e o General nomeiam os guardas.')),
    !d.lorde.length && vazio('Nenhum Lorde Comandante', 'Peça ao administrador do site para dar o cargo Lorde Comandante a quem comanda a Guarda.')));
}
