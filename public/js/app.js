import { estado, get, post, h, trocar, icone, pode, podeAlgum, aviso, avatar, cargoPrincipal, vazio, limparTela } from './core.js';
import { ligar, desligar, ouvir, rt } from './tempo-real.js';
import { inicio } from './telas/inicio.js';
import { modulo, livro, aprovacoes, envios } from './telas/livros.js';
import { galeria } from './telas/galeria.js';
import { anuncios } from './telas/anuncios.js';
import { atividades, atividade } from './telas/atividades.js';
import { usuarios, cargos, diario } from './telas/admin.js';
import { perfil } from './telas/perfil.js';
import { pessoa, comunidade } from './telas/pessoas.js';
import { paginaTrilha } from './telas/trilha.js';
import { painelTrilha, botaoTrilhaTopo, carregarTrilha, pararTudo } from './trilha.js';
import { recreacao, sala, cobrinha, quebraCabeca, assistir } from './telas/recreacao.js';
import { pacCoelho } from './telas/pac-coelho.js';
import { perguntasQuiz } from './telas/quiz.js';

const app = document.getElementById('app');

const MENU = [
  { secao: 'Cidade', itens: [
    { rota: '/', nome: 'Início', icone: 'casa' },
    { rota: '/comunidade', nome: 'Comunidade', icone: 'usuarios' },
    { rota: '/anuncios', nome: 'Mural de Anúncios', icone: 'megafone', perm: ['anuncios.ver'] },
    { rota: '/atividades', nome: 'Mural de Atividades', icone: 'tarefas', perm: ['atividades.ver'] },
    { rota: '/galeria', nome: 'Galeria', icone: 'imagem', perm: ['galeria.ver'] },
    { rota: '/recreacao', nome: 'Recreação', icone: 'jogos', perm: ['recreacao.usar'] },
    { rota: '/trilha', nome: 'Trilha sonora', icone: 'musica' },
  ] },
  { secao: 'Registros', itens: [
    { rota: '/tabelionato', nome: 'Tabelionato', icone: 'pergaminho', perm: ['tabelionato.ver'] },
    { rota: '/guarda', nome: 'Guarda do Coelho', icone: 'escudo', perm: ['guarda.ver'] },
  ] },
  { secao: 'Administração', itens: [
    { rota: '/admin/usuarios', nome: 'Usuários', icone: 'usuarios', perm: ['usuarios.ver'] },
    { rota: '/admin/cargos', nome: 'Cargos', icone: 'chave', perm: ['usuarios.ver', 'cargos.gerenciar'] },
    { rota: '/admin/diario', nome: 'Diário do sistema', icone: 'livro', perm: ['diario.ver'] },
  ] },
];

const ROTAS = [
  [/^\/$/, () => inicio()],
  [/^\/anuncios$/, () => anuncios()],
  [/^\/atividades$/, () => atividades()],
  [/^\/atividades\/(\d+)$/, id => atividade(id)],
  [/^\/galeria(?:\/(\d+|sem-album))?$/, album => galeria(album)],
  [/^\/(tabelionato|guarda)$/, m => modulo(m)],
  [/^\/(tabelionato|guarda)\/aprovacoes$/, m => aprovacoes(m)],
  [/^\/(tabelionato|guarda)\/envios$/, m => envios(m)],
  [/^\/(tabelionato|guarda)\/(\d+)$/, (m, id) => livro(m, id)],
  [/^\/admin\/usuarios$/, () => usuarios()],
  [/^\/admin\/cargos$/, () => cargos()],
  [/^\/admin\/diario$/, () => diario()],
  [/^\/recreacao$/, () => recreacao()],
  [/^\/recreacao\/cobrinha$/, () => cobrinha()],
  [/^\/recreacao\/quebra-cabeca$/, () => quebraCabeca()],
  [/^\/recreacao\/pac-coelho$/, () => pacCoelho()],
  [/^\/recreacao\/perguntas$/, () => perguntasQuiz()],
  [/^\/recreacao\/sala\/([0-9a-f]+)$/, id => sala(id)],
  [/^\/recreacao\/assistir\/(\d+)$/, id => assistir(id)],
  [/^\/comunidade$/, () => comunidade()],
  [/^\/pessoa\/(\d+)$/, id => pessoa(id)],
  [/^\/trilha$/, () => paginaTrilha()],
  [/^\/perfil$/, () => perfil()],
];

async function iniciar() {
  try { estado.eu = await get('/api/auth/me'); } catch { estado.eu = null; }
  if (estado.eu) montar(); else telaLogin();
}

// Aviso fixo quando sai uma versão nova do site com a página aberta.
window.addEventListener('nova-versao', () => {
  if (document.getElementById('nova-versao')) return;
  document.body.append(h('div', { id: 'nova-versao', class: 'nova-versao', role: 'status' },
    icone('alerta'),
    h('span', null, 'O site foi atualizado. Recarregue para usar a versão nova.'),
    h('button', { class: 'btn btn-ouro btn-pequeno', type: 'button', onclick: () => location.reload() }, 'Recarregar')));
});

window.addEventListener('sessao-expirada', () => {
  desligar();
  pararTudo();
  aviso('Sua sessão terminou. Entre de novo.', 'erro');
  telaLogin();
});

/* ─── Login ───────────────────────────────────────── */

function telaLogin() {
  limparTela();
  document.title = 'Entrar · Casa Luckham';
  const nome = h('input', { class: 'input', name: 'nome', autocomplete: 'username', placeholder: 'Ex.: Evran Luckham', required: true, autofocus: true });
  const senha = h('input', { class: 'input', type: 'password', name: 'senha', autocomplete: 'current-password', required: true });
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const entrar = h('button', { class: 'btn btn-ouro btn-grande', type: 'submit' }, 'Entrar');

  const form = h('form', { class: 'login-form', novalidate: true },
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Nome do personagem'), nome),
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Senha'), senha),
    erroEl, entrar);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    erroEl.hidden = true;
    if (!nome.value.trim() || !senha.value) {
      erroEl.textContent = 'Preencha o nome do personagem e a senha.';
      erroEl.hidden = false;
      return;
    }
    entrar.disabled = true;
    entrar.classList.add('carregando');
    try {
      estado.eu = await post('/api/auth/login', { nome: nome.value, senha: senha.value });
      if (!location.hash) location.hash = '#/';
      montar();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.hidden = false;
      senha.select();
    } finally {
      entrar.disabled = false;
      entrar.classList.remove('carregando');
    }
  });

  trocar(app, h('main', { class: 'login' },
    h('div', { class: 'login-caixa' },
      h('img', { src: '/img/brasao.png', alt: 'Brasão da Casa Luckham', class: 'login-brasao' }),
      h('p', { class: 'sobrelinha' }, 'Cidade de Lyendell'),
      h('h1', { class: 'login-titulo' }, 'Casa Luckham'),
      h('p', { class: 'login-sub' }, 'Administração da cidade'),
      form,
      h('p', { class: 'login-rodape' }, 'Acesso só para moradores registrados. Esqueceu a senha? Fale com a administração da Casa.'))));
  requestAnimationFrame(() => nome.focus());
}

/* ─── Layout ──────────────────────────────────────── */

function montar() {
  const eu = estado.eu;
  const nav = h('nav', { class: 'menu', 'aria-label': 'Menu principal' },
    MENU.map(s => {
      const itens = s.itens.filter(i => !i.perm || podeAlgum(...i.perm));
      if (!itens.length) return null;
      return h('div', { class: 'menu-secao' },
        h('p', { class: 'menu-titulo' }, s.secao),
        itens.map(i => h('a', { class: 'menu-item', href: `#${i.rota}`, 'data-rota': i.rota }, icone(i.icone), h('span', null, i.nome))));
    }));

  const sair = async () => {
    desligar();
    pararTudo();
    await post('/api/auth/logout').catch(() => {});
    estado.eu = null;
    location.hash = '';
    telaLogin();
  };

  const lateral = h('aside', { class: 'lateral' },
    h('a', { class: 'marca', href: '#/' },
      h('img', { src: '/img/brasao.png', alt: '' }),
      h('span', null, h('strong', null, 'Casa Luckham'), h('small', null, 'Lyendell'))),
    nav,
    painelTrilha(),
    h('div', { class: 'eu' },
      h('a', { class: 'eu-link', href: `#/pessoa/${eu.id}`, title: 'Meu perfil' },
        meuAvatar(),
        h('span', { class: 'eu-texto' }, h('strong', null, eu.nome), h('small', null, cargoPrincipal(eu)))),
      h('button', { class: 'btn-icone', type: 'button', title: 'Sair', 'aria-label': 'Sair', onclick: sair }, icone('sair'))));

  const alternarMenu = aberto => document.body.classList.toggle('menu-aberto', aberto);
  const topo = h('header', { class: 'topo' },
    h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Abrir menu', onclick: () => alternarMenu(true) }, icone('menu')),
    h('a', { class: 'marca marca-topo', href: '#/' }, h('img', { src: '/img/brasao.png', alt: '' }), h('strong', null, 'Casa Luckham')),
    h('div', { class: 'topo-direita' },
      botaoTrilhaTopo(),
      h('a', { href: `#/pessoa/${eu.id}`, 'aria-label': 'Meu perfil' }, meuAvatar())));

  trocar(app, h('div', { class: 'layout' },
    lateral,
    h('div', { class: 'veu', onclick: () => alternarMenu(false) }),
    h('div', { class: 'principal' }, topo, h('main', { id: 'tela', class: 'tela' }))));

  if (pode('recreacao.usar')) ligar();
  carregarTrilha();
  rotear();
}

function meuAvatar() {
  const el = avatar(estado.eu.nome, '', estado.eu.foto);
  el.dataset.meuAvatar = '';
  return el;
}

// Quando a pessoa troca a foto no perfil, o menu e o topo atualizam na hora.
window.addEventListener('perfil-atualizado', () => {
  document.querySelectorAll('[data-meu-avatar]').forEach(el => el.replaceWith(meuAvatar()));
});

/* ─── Rotas ───────────────────────────────────────── */

let geracao = 0;

async function rotear() {
  // O site foi atualizado com esta aba aberta: troca de tela já carregando a versão nova.
  if (estado.novaVersao) { location.reload(); return; }
  if (!estado.eu) return;
  const tela = document.getElementById('tela');
  if (!tela) return;
  const caminho = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  document.body.classList.remove('menu-aberto');

  document.querySelectorAll('.menu-item').forEach(a => {
    const r = a.dataset.rota;
    a.classList.toggle('ativo', r === '/' ? caminho === '/' : caminho === r || caminho.startsWith(`${r}/`));
  });

  const g = ++geracao;
  limparTela();
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    trocar(tela, h('div', { class: 'carregando-tela' }, h('span', { class: 'giro' })));
    try {
      const el = await fn(...m.slice(1));
      if (g !== geracao) return;
      trocar(tela, el);
      const titulo = tela.querySelector('.pag-titulo')?.textContent;
      document.title = titulo ? `${titulo} · Casa Luckham` : 'Casa Luckham · Lyendell';
      window.scrollTo(0, 0);
      atualizarAvisos();
    } catch (err) {
      if (g !== geracao) return;
      trocar(tela, err.status === 403
        ? vazio('Acesso restrito', 'Seu cargo não dá acesso a esta parte do sistema.', h('a', { class: 'btn', href: '#/' }, 'Voltar ao início'))
        : vazio('Algo deu errado', err.message, h('a', { class: 'btn', href: '#/' }, 'Voltar ao início')));
    }
    return;
  }
  trocar(tela, vazio('Página não encontrada', 'Esse caminho não existe em Lyendell.', h('a', { class: 'btn', href: '#/' }, 'Voltar ao início')));
}

window.addEventListener('hashchange', rotear);

// Números no menu: registros esperando a sua aprovação (dourado) ou envios seus recusados (vermelho).
async function atualizarAvisos() {
  if (!estado.eu) return;
  let p;
  try { p = await get('/api/pendencias'); } catch { return; }
  for (const m of ['tabelionato', 'guarda']) {
    const item = document.querySelector(`.menu-item[data-rota="/${m}"]`);
    if (!item) continue;
    item.querySelector('.menu-aviso')?.remove();
    const { aprovar = 0, recusados = 0 } = p[m] || {};
    if (aprovar) item.append(h('span', { class: 'menu-aviso', title: `${aprovar} aguardando a sua aprovação` }, aprovar));
    else if (recusados) item.append(h('span', { class: 'menu-aviso recusado', title: `${recusados} envio(s) seu(s) recusado(s)` }, recusados));
  }
}
window.addEventListener('avisos', atualizarAvisos);

// Mensagens do chat que chegaram enquanto a pessoa estava em outra parte do site.
ouvir('naoLidas', () => {
  const item = document.querySelector('.menu-item[data-rota="/recreacao"]');
  if (!item) return;
  item.querySelector('.menu-aviso')?.remove();
  if (rt.naoLidas) item.append(h('span', { class: 'menu-aviso chat', title: `${rt.naoLidas} mensagem(ns) nova(s) no chat` }, rt.naoLidas > 99 ? '99+' : rt.naoLidas));
});
export const recarregarTela = rotear;

iniciar();
