import { estado, get, post, h, trocar, icone, pode, podeAlgum, aviso, avatar, cargoPrincipal, vazio, limparTela, ehCrianca, ehMorador, veModulo } from './core.js';
import { MENU_CRIANCA, SECOES_CRIANCA } from './crianca.js';
import { ligar, desligar, ouvir, rt } from './tempo-real.js';
import { inicio } from './telas/inicio.js';
import { modulo, livro, aprovacoes, envios, MODULOS } from './telas/livros.js';
import { galeria } from './telas/galeria.js';
import { anuncios } from './telas/anuncios.js';
import { atividades, atividade } from './telas/atividades.js';
import { usuarios, cargos, diario } from './telas/admin.js';
import { perfil } from './telas/perfil.js';
import { pessoa, comunidade } from './telas/pessoas.js';
import { mapa } from './telas/mapa.js';
import { radioDoCanto, carregarTrilha, pararTudo } from './trilha.js';
import { recreacao, sala, cobrinha, quebraCabeca, assistir, memoria } from './telas/recreacao.js';
import { pacCoelho } from './telas/pac-coelho.js';
import { leis, gerenciaLeis } from './telas/leis.js';
import { campoMinado, jogo2048 } from './telas/jogos-sozinho.js';
import { perguntasQuiz } from './telas/quiz.js';
import { caixaDePegadinhas } from './telas/bobo.js';
import { propostas } from './telas/propostas.js';
import { juramento } from './telas/juramento.js';
import { telaArcade } from './arcade.js';
import { clube } from './telas/clube.js';
import { ARCADE } from './jogos/lista.js';
import { telaSprites } from './telas/sprites.js';
import { ligarSpritesAoVivo } from './sprites.js';
import { registrarServiceWorker } from './notificacoes.js';
import { iniciarEfeitosAdm } from './adm-jogos.js';

const app = document.getElementById('app');

// adulto: não aparece para personagem criança.
// perm: aparece para quem tem alguma dessas permissões. morador: só para os moradores (os Aliados, convidados
// de outras casas, não veem). modulo: módulo de livros, que aparece para quem vê o módulo ou, para os Aliados,
// quando ele tem livros marcados para Convidados e Aliados.
const MENU = [
  { secao: 'Cidade', itens: [
    { rota: '/', nome: 'Início', icone: 'casa' },
    { rota: '/nadir', nome: 'A Grande Nadir', icone: 'lua', perm: ['nadir.usar'] },
    { rota: '/comunidade', nome: 'Comunidade', icone: 'usuarios' },
    { rota: '/mapa', nome: 'Mapa de Lyendell', icone: 'mapa' },
    { rota: '/anuncios', nome: 'Mural de Anúncios', icone: 'megafone', perm: ['anuncios.ver', 'aliados.ver'] },
    { rota: '/congresso', nome: 'Congresso', icone: 'coluna', modulo: 'congresso' },
    { rota: '/juramento', nome: 'Juramento', icone: 'bandeira', perm: ['tabelionato.ver', 'aliados.ver'] },
    { rota: '/leis', nome: 'Leis de Lyendell', icone: 'balanca', modulo: 'leis' },
    { rota: '/atividades', nome: 'Mural de Atividades', icone: 'tarefas', perm: ['atividades.ver', 'aliados.ver'] },
    { rota: '/escola', nome: 'Escola Luckham', icone: 'capelo', perm: ['escola.ver'], adulto: true },
    { rota: '/galeria', nome: 'Galeria', icone: 'imagem', perm: ['galeria.ver'] },
    { rota: '/recreacao', nome: 'Recreação', icone: 'jogos', perm: ['recreacao.usar'] },
    { rota: '/clube', nome: 'Club Coelho', icone: 'balao', perm: ['recreacao.usar'] },
    { rota: '/bobo', nome: 'Caixa de Pegadinhas', icone: 'bobo', perm: ['bobo.pegadinhas'] },
  ] },
  { secao: 'Registros', itens: [
    { rota: '/tabelionato', nome: 'Tabelionato', icone: 'pergaminho', modulo: 'tabelionato' },
    { rota: '/guarda', nome: 'Guarda do Coelho', icone: 'escudo', modulo: 'guarda' },
    { rota: '/hospital', nome: 'Hospital', icone: 'cruz', modulo: 'hospital' },
  ] },
  { secao: 'Administração', itens: [
    { rota: '/admin/usuarios', nome: 'Usuários', icone: 'usuarios', perm: ['usuarios.ver'] },
    { rota: '/admin/cargos', nome: 'Cargos', icone: 'chave', perm: ['usuarios.ver', 'cargos.gerenciar'] },
    { rota: '/admin/diario', nome: 'Diário do sistema', icone: 'livro', perm: ['diario.ver'] },
    { rota: '/financas', nome: 'Gestão Financeira', icone: 'moeda', perm: ['financas.ver'] },
  ] },
];

const ROTAS = [
  [/^\/$/, () => inicio()],
  // A Grande Nadir (a IA da Casa) e o Livro de Nadir, de quem ensina a ela.
  [/^\/nadir$/, async () => (await import('./telas/nadir.js')).nadir()],
  [/^\/nadir\/livro(?:\/(perguntas))?$/, async aba => (await import('./telas/nadir.js')).livroDeNadir(aba)],
  [/^\/anuncios$/, () => anuncios()],
  [/^\/atividades$/, () => atividades()],
  [/^\/atividades\/(\d+)$/, id => atividade(id)],
  [/^\/galeria(?:\/(\d+|sem-album))?$/, album => galeria(album)],
  // Leis de Lyendell: todo mundo lê arrumado; quem escreve as leis gerencia os livros em /leis/livros.
  [/^\/leis$/, () => leis()],
  [/^\/leis\/livros$/, () => gerenciaLeis(() => modulo('leis'))],
  [/^\/leis\/(\d+)$/, id => gerenciaLeis(() => livro('leis', id), () => leis(id))],
  [/^\/leis\/(\d+)\/registro\/(\d+)$/, (id, reg) => gerenciaLeis(() => livro('leis', id, reg), () => leis(id, reg))],
  [/^\/(tabelionato|guarda|hospital|congresso)$/, m => modulo(m)],
  [/^\/congresso\/propostas$/, () => propostas()],
  [/^\/(tabelionato|guarda|hospital|congresso|leis)\/aprovacoes$/, m => aprovacoes(m)],
  [/^\/(tabelionato|guarda|hospital|congresso|leis)\/envios$/, m => envios(m)],
  [/^\/(tabelionato|guarda|hospital|congresso)\/(\d+)$/, (m, id) => livro(m, id)],
  [/^\/(tabelionato|guarda|hospital|congresso)\/(\d+)\/registro\/(\d+)$/, (m, id, reg) => livro(m, id, reg)],
  [/^\/(tabelionato|guarda|hospital|congresso)\/(\d+)\/registro\/(\d+)$/, (m, id, reg) => livro(m, id, reg)],
  [/^\/recreacao\/memoria$/, () => memoria()],
  [/^\/recreacao\/campo-minado$/, () => campoMinado()],
  [/^\/recreacao\/2048$/, () => jogo2048()],
  ...Object.values(ARCADE).map(j => [new RegExp(`^${j.rota.slice(1)}$`), async () => telaArcade((await j.carregar()).default)]),
  [/^\/admin\/usuarios$/, () => usuarios()],
  [/^\/admin\/cargos$/, () => cargos()],
  [/^\/admin\/diario$/, () => diario()],
  // Gestão Financeira: carregada só quando alguém abre (o arquivo é grande e poucos usam).
  [/^\/financas(?:\/([a-z]+))?$/, async aba => (await import('./telas/financas.js')).financas(aba || 'visao')],
  [/^\/financas\/(folha|cidadao)\/(\d+)$/, async (aba, id) => (await import('./telas/financas.js')).financas(aba, id)],
  // Escola Luckham: #/escola/<aba>; com número, abre a ficha do aluno (#/escola/alunos/12) ou a chamada (#/escola/aulas/5).
  [/^\/escola(?:\/([a-z]+))?(?:\/(\d+))?$/, async (aba, id) => (await import('./telas/escola.js')).escola(aba || 'visao', id ? Number(id) : null)],
  [/^\/recreacao$/, () => recreacao()],
  [/^\/clube$/, () => clube()],
  [/^\/bobo$/, () => caixaDePegadinhas()],
  [/^\/juramento$/, () => juramento()],
  [/^\/recreacao\/cobrinha$/, () => cobrinha()],
  [/^\/recreacao\/quebra-cabeca$/, () => quebraCabeca()],
  [/^\/recreacao\/pac-coelho$/, () => pacCoelho()],
  [/^\/recreacao\/perguntas$/, () => perguntasQuiz()],
  [/^\/recreacao\/sprites$/, () => telaSprites()],
  [/^\/recreacao\/arena$/, async () => (await import('./telas/arena.js')).telaArena()],
  [/^\/recreacao\/batalha$/, async () => (await import('./telas/batalha.js')).telaBatalha()],
  [/^\/recreacao\/sala\/([0-9a-f]+)$/, id => sala(id)],
  [/^\/recreacao\/assistir\/(\d+)$/, id => assistir(id)],
  [/^\/comunidade$/, () => comunidade()],
  [/^\/mapa$/, () => mapa()],
  [/^\/pessoa\/(\d+)$/, id => pessoa(id)],
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

// Internet caiu ou voltou: avisa, em vez de deixar os botões falharem sem explicação.
window.addEventListener('offline', () => aviso('Você está sem internet. Tente de novo quando a conexão voltar.', 'erro'));
window.addEventListener('online', () => aviso('A conexão voltou.'));

window.addEventListener('sessao-expirada', () => {
  desligar();
  pararTudo();
  aviso('Sua sessão terminou. Entre de novo.', 'erro');
  telaLogin();
});

/* ─── Login ───────────────────────────────────────── */

function telaLogin() {
  limparTela();
  document.body.classList.remove('modo-crianca'); // a tela de entrar é a mesma para todos
  document.title = 'Entrar · Casa Luckham';
  const nome = h('input', { class: 'input', name: 'nome', autocomplete: 'username', autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', placeholder: 'Ex.: Evran Luckham', required: true, autofocus: true });
  const senha = h('input', { class: 'input', type: 'password', name: 'senha', autocomplete: 'current-password', autocapitalize: 'off', enterkeyhint: 'go', required: true });
  const olho = h('button', { class: 'btn-icone senha-olho', type: 'button', 'aria-label': 'Mostrar a senha', 'aria-pressed': 'false', onclick: () => {
    const ver = senha.type === 'password';
    senha.type = ver ? 'text' : 'password';
    olho.setAttribute('aria-pressed', String(ver));
    olho.setAttribute('aria-label', ver ? 'Esconder a senha' : 'Mostrar a senha');
    senha.focus();
  } }, icone('olho'));
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const entrar = h('button', { class: 'btn btn-ouro btn-grande', type: 'submit' }, 'Entrar');

  const form = h('form', { class: 'login-form', novalidate: true },
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Nome do personagem'), nome),
    h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Senha'), h('span', { class: 'senha-linha' }, senha, olho)),
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
  // Personagem criança: o site inteiro muda de cara (céu estrelado, letra de caderno, nomes de criança).
  const crianca = ehCrianca();
  document.body.classList.toggle('modo-crianca', crianca);
  const nav = h('nav', { class: 'menu', 'aria-label': 'Menu principal' },
    MENU.map(s => {
      const itens = s.itens.filter(i => (!i.morador || ehMorador()) && (!i.adulto || !crianca) && (i.modulo ? veModulo(i.modulo) : !i.perm || podeAlgum(...i.perm)));
      if (!itens.length) return null;
      return h('div', { class: 'menu-secao' },
        h('p', { class: 'menu-titulo' }, crianca ? SECOES_CRIANCA[s.secao] || s.secao : s.secao),
        itens.map(i => h('a', { class: 'menu-item', href: `#${i.rota}`, 'data-rota': i.rota }, icone(i.icone), h('span', null, crianca ? MENU_CRIANCA[i.rota] || i.nome : i.nome))));
    }));

  const sair = async () => {
    desligar();
    pararTudo();
    await post('/api/auth/logout').catch(() => {});
    estado.eu = null;
    location.hash = '';
    telaLogin();
  };

  // No celular o menu é uma gaveta: fechada, fica fora do alcance do teclado e do leitor de tela.
  const celular = matchMedia('(max-width: 960px)');
  let abrirMenu;
  const sincronizarGaveta = () => { lateral.inert = celular.matches && !document.body.classList.contains('menu-aberto'); };
  const alternarMenu = aberto => {
    document.body.classList.toggle('menu-aberto', aberto);
    abrirMenu?.setAttribute('aria-expanded', String(aberto));
    sincronizarGaveta();
    if (aberto) setTimeout(() => (lateral.querySelector('.menu-item.ativo') || lateral.querySelector('.menu-item'))?.focus(), 60);
  };
  const lateral = h('aside', { class: 'lateral', id: 'menu-lateral', 'aria-label': 'Navegação do site' },
    h('div', { class: 'lateral-cab' },
      h('a', { class: 'marca', href: '#/' },
        h('img', { src: '/img/brasao.png', alt: '' }),
        h('span', null, h('strong', null, 'Casa Luckham'), h('small', null, crianca ? 'a minha cidade' : 'Lyendell'))),
      h('button', { class: 'btn-icone menu-fechar', type: 'button', 'aria-label': 'Fechar menu', onclick: () => alternarMenu(false) }, icone('x'))),
    nav,
    h('div', { class: 'eu' },
      h('a', { class: 'eu-link', href: `#/pessoa/${eu.id}`, title: 'Meu perfil' },
        meuAvatar(),
        h('span', { class: 'eu-texto' }, h('strong', null, eu.nome), h('small', null, cargoPrincipal(eu)))),
      h('button', { class: 'btn-icone', type: 'button', title: 'Sair', 'aria-label': 'Sair', onclick: sair }, icone('sair'))));

  abrirMenu = h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Abrir menu', 'aria-controls': 'menu-lateral', 'aria-expanded': 'false', onclick: () => alternarMenu(true) }, icone('menu'));
  const topo = h('header', { class: 'topo' },
    abrirMenu,
    h('a', { class: 'marca marca-topo', href: '#/' }, h('img', { src: '/img/brasao.png', alt: '' }), h('strong', null, 'Casa Luckham')),
    h('a', { href: `#/pessoa/${eu.id}`, 'aria-label': 'Meu perfil' }, meuAvatar()));

  trocar(app, h('div', { class: 'layout' },
    h('a', { class: 'pular', href: '#tela', onclick: e => { e.preventDefault(); focarConteudo(); } }, 'Pular para o conteúdo'),
    lateral,
    h('div', { class: 'veu', onclick: () => alternarMenu(false) }),
    h('div', { class: 'principal' }, topo, h('main', { id: 'tela', class: 'tela', tabindex: '-1' })),
    radioDoCanto()));
  sincronizarGaveta();
  celular.addEventListener?.('change', sincronizarGaveta);
  menuAlternar = alternarMenu;
  // Esc fecha a gaveta e devolve o foco ao botão do topo; arrastar a gaveta para a esquerda também fecha.
  lateral.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) { alternarMenu(false); abrirMenu.focus(); } });
  let toqueX = null;
  lateral.addEventListener('touchstart', e => { toqueX = e.touches[0].clientX; }, { passive: true });
  lateral.addEventListener('touchend', e => {
    if (toqueX != null && e.changedTouches[0].clientX - toqueX < -70) alternarMenu(false);
    toqueX = null;
  }, { passive: true });
  vigiarPagina();

  if (pode('recreacao.usar')) ligar();
  iniciarEfeitosAdm(); // as pegadinhas do menu de administrador chegam em qualquer tela
  ligarSpritesAoVivo(ouvir); // alguém trocou um sprite: todos recarregam
  registrarServiceWorker(); // para as notificações no celular/PC
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
let menuAlternar = null;

// Enquanto a tela carrega: blocos cinzentos no lugar do conteúdo (aparecem só se demorar um pouco).
function esqueletoDaTela() {
  const bloco = classe => h('div', { class: `esq ${classe}`.trim() });
  return h('div', { class: 'esqueleto-tela', role: 'status', 'aria-label': 'Carregando' },
    bloco('esq-titulo'), bloco('esq-linha'), bloco('esq-linha curta'),
    h('div', { class: 'esq-grade' }, bloco('esq-cartao'), bloco('esq-cartao'), bloco('esq-cartao')));
}

// Depois de trocar de tela o foco vai para o título (teclado e leitor de tela começam do começo, sem rolar a página).
function focarConteudo() {
  const tela = document.getElementById('tela');
  if (!tela) return;
  const alvo = tela.querySelector('.pag-titulo, h1') || tela;
  if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
  alvo.focus({ preventScroll: true });
}

// Pequenos reforços de acessibilidade e de uso que valem para qualquer tela (feitos aqui para não repetir em cada uma):
// papéis e estados das abas, rótulos de botões só de ícone, dica de rolagem lateral e o player que sai da frente ao rolar.
function vigiarPagina() {
  const tela = document.getElementById('tela');
  if (!tela || tela.dataset.vigiada) return;
  tela.dataset.vigiada = '1';
  let marcado = false;
  const refinar = () => {
    marcado = false;
    for (const abas of tela.querySelectorAll('.abas')) {
      const botoes = [...abas.children].filter(x => x.matches('button, a'));
      if (!botoes.length) continue;
      if (botoes.every(x => x.tagName === 'BUTTON')) {
        abas.setAttribute('role', 'tablist');
        for (const b of botoes) { b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(b.classList.contains('ativa'))); b.tabIndex = b.classList.contains('ativa') ? 0 : -1; }
        if (!botoes.some(b => b.classList.contains('ativa'))) botoes[0].tabIndex = 0;
      } else {
        if (!abas.hasAttribute('aria-label')) abas.setAttribute('aria-label', 'Seções desta tela');
        for (const b of botoes) { if (b.classList.contains('ativa')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
      }
    }
    for (const s of tela.querySelectorAll('.seg')) s.setAttribute('aria-pressed', String(s.classList.contains('ativo')));
    for (const b of tela.querySelectorAll('button:not([aria-label]), a:not([aria-label])')) {
      if (b.title && !b.textContent.trim()) b.setAttribute('aria-label', b.title);
    }
    for (const i of tela.querySelectorAll('input:not([aria-label]):not([type=hidden]):not([type=checkbox]):not([type=radio]), select:not([aria-label]), textarea:not([aria-label])')) {
      if (!i.labels?.length && !i.hasAttribute('aria-labelledby')) {
        const nome = i.placeholder || i.title;
        if (nome) i.setAttribute('aria-label', nome);
      }
    }
    for (const t of tela.querySelectorAll('.tabela-wrap')) {
      if (!t.hasAttribute('tabindex')) { t.tabIndex = 0; t.setAttribute('role', 'region'); if (!t.hasAttribute('aria-label')) t.setAttribute('aria-label', 'Tabela (role para os lados se precisar)'); }
    }
    for (const r of tela.querySelectorAll('.abas, .tabela-wrap')) marcarRolagem(r);
    // A aba da tela atual aparece inteira, mesmo numa fileira que rola.
    for (const a of tela.querySelectorAll('.abas .ativa')) {
      const faixa = a.parentElement;
      if (faixa && faixa.scrollWidth > faixa.clientWidth + 2 && !faixa.dataset.centrada) {
        faixa.dataset.centrada = '1';
        faixa.scrollLeft = Math.max(0, a.offsetLeft - (faixa.clientWidth - a.offsetWidth) / 2);
      }
    }
  };
  new MutationObserver(() => { if (!marcado) { marcado = true; requestAnimationFrame(refinar); } })
    .observe(tela, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  // Setas esquerda e direita andam entre as abas.
  tela.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const aba = e.target.closest?.('[role=tab]');
    if (!aba) return;
    const todas = [...aba.parentElement.querySelectorAll('[role=tab]')];
    let i = todas.indexOf(aba);
    if (e.key === 'ArrowLeft') i = (i - 1 + todas.length) % todas.length;
    else if (e.key === 'ArrowRight') i = (i + 1) % todas.length;
    else i = e.key === 'Home' ? 0 : todas.length - 1;
    e.preventDefault();
    todas.forEach((t, k) => { t.tabIndex = k === i ? 0 : -1; });
    todas[i].focus();
  });
  tela.addEventListener('scroll', e => { if (e.target.matches?.('.abas, .tabela-wrap')) marcarRolagem(e.target); }, true);
  window.addEventListener('resize', () => tela.querySelectorAll('.abas, .tabela-wrap').forEach(marcarRolagem));

  // No celular o botão do player (que fica no canto) some enquanto a pessoa rola a página para baixo e volta quando ela para.
  let ultimo = window.scrollY;
  let parar;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > ultimo + 6 && y > 120 && matchMedia('(max-width: 960px)').matches) document.body.classList.add('rolando-baixo');
    else if (y < ultimo - 6) document.body.classList.remove('rolando-baixo');
    ultimo = y;
    clearTimeout(parar);
    parar = setTimeout(() => document.body.classList.remove('rolando-baixo'), 900);
  }, { passive: true });
}

// Marca numa faixa que rola para os lados se há mais conteúdo à esquerda e/ou à direita (o CSS desenha a sombra).
function marcarRolagem(el) {
  const sobra = el.scrollWidth - el.clientWidth;
  el.classList.toggle('rola-esq', sobra > 2 && el.scrollLeft > 2);
  el.classList.toggle('rola-dir', sobra > 2 && el.scrollLeft < sobra - 2);
}

async function rotear() {
  // O site foi atualizado com esta aba aberta: troca de tela já carregando a versão nova.
  if (estado.novaVersao) { location.reload(); return; }
  if (!estado.eu) return;
  const tela = document.getElementById('tela');
  if (!tela) return;
  const caminho = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  if (document.body.classList.contains('menu-aberto')) menuAlternar?.(false);

  document.querySelectorAll('.menu-item').forEach(a => {
    const r = a.dataset.rota;
    const ativo = r === '/' ? caminho === '/' : caminho === r || caminho.startsWith(`${r}/`);
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const g = ++geracao;
  limparTela();
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    trocar(tela, esqueletoDaTela());
    tela.setAttribute('aria-busy', 'true');
    try {
      const el = await fn(...m.slice(1));
      if (g !== geracao) return;
      trocar(tela, el);
      tela.removeAttribute('aria-busy');
      const titulo = tela.querySelector('.pag-titulo')?.textContent;
      document.title = titulo ? `${titulo} · Casa Luckham` : 'Casa Luckham · Lyendell';
      window.scrollTo(0, 0);
      focarConteudo();
      atualizarAvisos();
    } catch (err) {
      if (g !== geracao) return;
      tela.removeAttribute('aria-busy');
      const tentar = h('button', { class: 'btn btn-ouro', type: 'button', onclick: () => rotear() }, 'Tentar de novo');
      trocar(tela, err.status === 403
        ? ehCrianca()
          ? vazio('Essa porta é alta demais!', 'Isso é coisa de gente grande. Vamos brincar em outro lugar?', h('a', { class: 'btn', href: '#/recreacao' }, 'Ir brincar'))
          : vazio('Acesso restrito', 'Seu cargo não dá acesso a esta parte do sistema.', h('a', { class: 'btn', href: '#/' }, 'Voltar ao início'))
        : vazio('Não deu para abrir esta tela', err.status === 0 ? 'Parece que a conexão caiu. Confira a internet e tente de novo.' : err.message,
          h('div', { class: 'vazio-acoes' }, tentar, h('a', { class: 'btn', href: '#/' }, 'Voltar ao início'))));
    }
    return;
  }
  trocar(tela, ehCrianca()
    ? vazio('Ué, me perdi!', 'Esse caminho não leva a lugar nenhum.', h('a', { class: 'btn', href: '#/' }, 'Voltar para a minha toca'))
    : vazio('Página não encontrada', 'Esse caminho não existe em Lyendell.', h('a', { class: 'btn', href: '#/' }, 'Voltar ao início')));
}

window.addEventListener('hashchange', rotear);

// Números no menu: registros esperando a sua aprovação (dourado) ou envios seus recusados (vermelho).
async function atualizarAvisos() {
  if (!estado.eu) return;
  let p;
  try { p = await get('/api/pendencias'); } catch { return; }
  for (const m of Object.keys(MODULOS)) {
    const item = document.querySelector(`.menu-item[data-rota="/${m}"]`);
    if (!item) continue;
    item.querySelector('.menu-aviso')?.remove();
    const { aprovar = 0, recusados = 0, propostas: novas = 0 } = p[m] || {};
    if (aprovar + novas) item.append(h('span', { class: 'menu-aviso', title: [aprovar && `${aprovar} aguardando a sua aprovação`, novas && `${novas} ${novas === 1 ? 'proposta do povo' : 'propostas do povo'} para avaliar`].filter(Boolean).join(' e ') }, aprovar + novas));
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
