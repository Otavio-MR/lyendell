import { estado, get, post, h, trocar, icone, podeAlgum, aviso, avatar, cargoPrincipal, vazio } from './core.js';
import { inicio } from './telas/inicio.js';
import { modulo, livro } from './telas/livros.js';
import { galeria } from './telas/galeria.js';
import { anuncios } from './telas/anuncios.js';
import { atividades, atividade } from './telas/atividades.js';
import { usuarios, cargos, diario } from './telas/admin.js';
import { perfil } from './telas/perfil.js';

const app = document.getElementById('app');

const MENU = [
  { secao: 'Cidade', itens: [
    { rota: '/', nome: 'Início', icone: 'casa' },
    { rota: '/anuncios', nome: 'Mural de Anúncios', icone: 'megafone', perm: ['anuncios.ver'] },
    { rota: '/atividades', nome: 'Mural de Atividades', icone: 'tarefas', perm: ['atividades.ver'] },
    { rota: '/galeria', nome: 'Galeria', icone: 'imagem', perm: ['galeria.ver'] },
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
  [/^\/(tabelionato|guarda)\/(\d+)$/, (m, id) => livro(m, id)],
  [/^\/admin\/usuarios$/, () => usuarios()],
  [/^\/admin\/cargos$/, () => cargos()],
  [/^\/admin\/diario$/, () => diario()],
  [/^\/perfil$/, () => perfil()],
];

async function iniciar() {
  try { estado.eu = await get('/api/auth/me'); } catch { estado.eu = null; }
  if (estado.eu) montar(); else telaLogin();
}

window.addEventListener('sessao-expirada', () => {
  aviso('Sua sessão terminou. Entre de novo.', 'erro');
  telaLogin();
});

/* ─── Login ───────────────────────────────────────── */

function telaLogin() {
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
    h('div', { class: 'eu' },
      h('a', { class: 'eu-link', href: '#/perfil', title: 'Meu perfil' },
        avatar(eu.nome),
        h('span', { class: 'eu-texto' }, h('strong', null, eu.nome), h('small', null, cargoPrincipal(eu)))),
      h('button', { class: 'btn-icone', type: 'button', title: 'Sair', 'aria-label': 'Sair', onclick: sair }, icone('sair'))));

  const alternarMenu = aberto => document.body.classList.toggle('menu-aberto', aberto);
  const topo = h('header', { class: 'topo' },
    h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Abrir menu', onclick: () => alternarMenu(true) }, icone('menu')),
    h('a', { class: 'marca marca-topo', href: '#/' }, h('img', { src: '/img/brasao.png', alt: '' }), h('strong', null, 'Casa Luckham')),
    h('a', { href: '#/perfil', 'aria-label': 'Meu perfil' }, avatar(eu.nome)));

  trocar(app, h('div', { class: 'layout' },
    lateral,
    h('div', { class: 'veu', onclick: () => alternarMenu(false) }),
    h('div', { class: 'principal' }, topo, h('main', { id: 'tela', class: 'tela' }))));

  rotear();
}

/* ─── Rotas ───────────────────────────────────────── */

let geracao = 0;

async function rotear() {
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
export const recarregarTela = rotear;

iniciar();
