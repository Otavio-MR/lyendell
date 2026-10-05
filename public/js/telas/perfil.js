// Meu perfil: foto, capa, cor, moldura, frase, "sobre mim", nick do Minecraft e emblemas, com prévia ao vivo.
// Mais embaixo: o que o cargo permite fazer e a troca de senha.

import { painelNotificacoes } from '../notificacoes.js';
import {
  estado, get, post, put, api, del, h, trocar, icone, cabecalho, campo, aviso, tentar, confirmar, avatar, botao, recortarAvatar, reduzirImagem,
} from '../core.js';
import { cartaoPerfil } from './pessoas.js';

export async function perfil() {
  const eu = estado.eu;
  const [{ catalogo }, dados] = await Promise.all([get('/api/auth/catalogo'), get('/api/auth/perfil')]);
  const { opcoes, conquistas } = dados;
  const minhas = new Set(eu.permissoes);
  const ganhas = conquistas.filter(c => c.em);
  const nivel = dados.perfil.nivel;

  // Rascunho do que a pessoa está escolhendo (só vai para o servidor no "Salvar").
  const r = {
    titulo_perfil: dados.perfil.titulo_perfil || '',
    bio: dados.perfil.bio || '',
    cor: dados.perfil.cor || null,
    capa: dados.perfil.capa || 'floresta',
    moldura: dados.perfil.moldura || 'simples',
    mc_nick: dados.perfil.mc_nick || '',
    emblemas: dados.perfil.emblemas || [],
    aniversario: dados.perfil.aniversario || '',
  };
  let mudou = false;

  const previa = h('div', { class: 'perfil-previa' });
  const cargos = eu.is_root ? [{ nome: 'Administrador', cor: '#d8b13a' }, ...eu.cargos] : eu.cargos;
  const desenharPrevia = () => trocar(previa, cartaoPerfil({
    id: eu.id, nome: eu.nome, foto: eu.foto, cargos, nivel, sequencia: dados.perfil.sequencia, ...r,
  }, { conquistas }));
  const alterar = (campo_, valor) => {
    r[campo_] = valor;
    mudou = true;
    salvar.disabled = false;
    desenharPrevia();
  };

  /* Foto */
  const arquivoFoto = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
  const caixaFoto = h('div', { class: 'perfil-foto' });
  function desenharFoto(enviando = false) {
    trocar(caixaFoto,
      h('button', { class: 'perfil-foto-botao', type: 'button', title: 'Trocar foto', disabled: enviando, onclick: () => arquivoFoto.click() },
        avatar(eu.nome, 'avatar-g', eu.foto),
        h('span', { class: 'perfil-foto-camada' }, enviando ? h('span', { class: 'giro giro-p' }) : icone('editar'))),
      h('div', { class: 'perfil-foto-acoes' },
        botao(eu.foto ? 'Trocar foto' : 'Colocar foto', { icone: 'imagem', classe: 'btn-pequeno', desativado: enviando, onclick: () => arquivoFoto.click() }),
        botao('Usar a cabeça da minha skin', {
          icone: 'coelho', classe: 'btn-pequeno', desativado: enviando,
          onclick: async () => {
            const nick = entradaNick.value.trim();
            if (!nick) { aviso('Escreva o seu nick do Minecraft no campo "Nick do Minecraft" primeiro.', 'erro'); entradaNick.focus(); return; }
            const res = await tentar(() => put('/api/auth/perfil', { mc_nick: nick, foto_mc: true }), 'Agora a sua foto é a cabeça da sua skin.');
            if (res) { r.mc_nick = nick; atualizarFoto(res.foto); }
          },
        }),
        eu.foto && !enviando && botao('Remover', {
          classe: 'btn-pequeno btn-fantasma',
          onclick: async () => {
            if (!await confirmar('Sua foto de perfil será removida e as suas iniciais voltam a aparecer.', { ok: 'Remover foto' })) return;
            if (await tentar(() => del('/api/auth/foto'), 'Foto removida.')) atualizarFoto(null);
          },
        })),
      arquivoFoto);
  }
  function atualizarFoto(url) {
    eu.foto = url;
    window.dispatchEvent(new Event('perfil-atualizado'));
    desenharFoto();
    desenharPrevia();
  }
  arquivoFoto.addEventListener('change', async () => {
    const f = arquivoFoto.files[0];
    arquivoFoto.value = '';
    if (!f) return;
    desenharFoto(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', await recortarAvatar(f));
      const { foto } = await api('POST', '/api/auth/foto', fd);
      aviso('Foto de perfil atualizada.');
      atualizarFoto(foto);
    } catch (e) {
      aviso(e.message, 'erro');
      desenharFoto();
    }
  });

  /* Capa */
  const arquivoCapa = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
  const capas = h('div', { class: 'escolha-capas' });
  function desenharCapas(enviando = false) {
    const propria = r.capa?.startsWith('/uploads/');
    trocar(capas,
      opcoes.capas.map(c => h('button', {
        class: `escolha-capa capa-${c.chave} ${r.capa === c.chave ? 'ativa' : ''}`.trim(), type: 'button', title: c.nome,
        onclick: () => { alterar('capa', c.chave); desenharCapas(); },
      }, h('span', null, c.nome))),
      h('button', {
        class: `escolha-capa capa-propria ${propria ? 'ativa capa-imagem' : ''}`.trim(), type: 'button', disabled: enviando,
        style: propria ? { backgroundImage: `url("${r.capa}")` } : null, onclick: () => arquivoCapa.click(),
      }, enviando ? h('span', { class: 'giro giro-p' }) : h('span', null, icone('imagem'), propria ? 'Trocar imagem' : 'Minha imagem')),
      arquivoCapa);
  }
  arquivoCapa.addEventListener('change', async () => {
    const f = arquivoCapa.files[0];
    arquivoCapa.value = '';
    if (!f) return;
    desenharCapas(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', await reduzirImagem(f, { maxLado: 1600 }));
      const { capa } = await api('POST', '/api/auth/capa', fd);
      r.capa = capa;
      aviso('Capa trocada.');
      desenharPrevia();
    } catch (e) {
      aviso(e.message, 'erro');
    }
    desenharCapas();
  });

  /* Cor */
  const cores = h('div', { class: 'escolha-cores' });
  const desenharCores = () => trocar(cores,
    h('button', { class: `escolha-cor sem-cor ${!r.cor ? 'ativa' : ''}`.trim(), type: 'button', title: 'Padrão (dourado do site)', onclick: () => { alterar('cor', null); desenharCores(); } }, icone('x')),
    opcoes.cores.map(c => h('button', {
      class: `escolha-cor ${r.cor === c ? 'ativa' : ''}`.trim(), type: 'button', title: c, style: { '--c': c }, 'aria-label': `Cor ${c}`,
      onclick: () => { alterar('cor', c); desenharCores(); },
    })));

  /* Moldura */
  const molduras = h('div', { class: 'escolha-molduras' });
  const desenharMolduras = () => trocar(molduras, opcoes.molduras.map(m => {
    const liberada = nivel.nivel >= m.nivel;
    return h('button', {
      class: `escolha-moldura ${r.moldura === m.chave ? 'ativa' : ''} ${liberada ? '' : 'trancada'}`.replace(/\s+/g, ' ').trim(), type: 'button', disabled: !liberada,
      title: liberada ? m.nome : `Libera no nível ${m.nivel}`, onclick: () => { alterar('moldura', m.chave); desenharMolduras(); },
    },
    h('span', { class: `avatar avatar-p ${m.chave !== 'simples' ? `moldura moldura-${m.chave}` : ''}`.trim() }, liberada ? '' : icone('cadeado')),
    h('small', null, liberada ? m.nome : `Nível ${m.nivel}`));
  }));

  /* Texto */
  const entradaFrase = h('input', { class: 'input', maxlength: '60', value: r.titulo_perfil, placeholder: 'Ex.: Pesquisadora da Casa, amante de mapas', oninput: e => alterar('titulo_perfil', e.target.value) });
  const entradaBio = h('textarea', { class: 'input', rows: '4', maxlength: '600', placeholder: 'Conte quem é o seu personagem, do que gosta, o que faz em Lyendell...', oninput: e => alterar('bio', e.target.value) }, r.bio);
  const entradaNick = h('input', { class: 'input', maxlength: '16', value: r.mc_nick, placeholder: 'Ex.: porcoaranha97', oninput: e => alterar('mc_nick', e.target.value.trim()) });

  /* Aniversário do RP: 1 ano no RP = 1 mês de verdade, então ele volta no mesmo dia, um mês sim e um mês não.
     Guardado como "MM-DD"; o mês só diz se é nos meses ímpares (01) ou pares (02). */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const [mesSalvo = '', diaSalvo = ''] = r.aniversario ? r.aniversario.split('-') : [];
  const paridadeSalva = mesSalvo ? (Number(mesSalvo) % 2 ? 'impar' : 'par') : '';
  const escolhaDia = h('select', { class: 'input', 'aria-label': 'Dia do aniversário' },
    h('option', { value: '' }, 'Dia'), Array.from({ length: 31 }, (_, k) => {
      const v = String(k + 1).padStart(2, '0');
      return h('option', { value: v, selected: v === diaSalvo }, `dia ${k + 1}`);
    }));
  const escolhaMeses = h('select', { class: 'input', 'aria-label': 'Em quais meses' },
    h('option', { value: '' }, 'Quais meses'),
    h('option', { value: 'impar', selected: paridadeSalva === 'impar' }, 'Meses ímpares (janeiro, março, maio...)'),
    h('option', { value: 'par', selected: paridadeSalva === 'par' }, 'Meses pares (fevereiro, abril, junho...)'));
  const proximo = h('small', { class: 'aniversario-proximo' });
  // O próximo aniversário (hoje conta), para a pessoa conferir se escolheu certo.
  const mostrarProximo = () => {
    const dia = Number(escolhaDia.value);
    const par = escolhaMeses.value;
    if (!dia || !par) { proximo.textContent = ''; return; }
    const agora = new Date();
    for (let k = 0; k < 3; k++) {
      const d = new Date(agora.getFullYear(), agora.getMonth() + k, 1);
      if (((d.getMonth() + 1) % 2 === 1) !== (par === 'impar')) continue;
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const quando = Math.min(dia, ultimo);
      if (k === 0 && quando < agora.getDate()) continue;
      proximo.textContent = k === 0 && quando === agora.getDate() ? 'É hoje! Parabéns!' : `Próximo aniversário: ${quando} de ${MESES[d.getMonth()]}.`;
      return;
    }
  };
  const mudarAniversario = () => {
    alterar('aniversario', escolhaDia.value && escolhaMeses.value ? `${escolhaMeses.value === 'impar' ? '01' : '02'}-${escolhaDia.value}` : '');
    mostrarProximo();
  };
  escolhaDia.addEventListener('change', mudarAniversario);
  escolhaMeses.addEventListener('change', mudarAniversario);
  mostrarProximo();
  const entradaAniversario = h('div', { class: 'aniversario-campo' },
    h('div', { class: 'aniversario-escolha' }, escolhaDia, h('span', { class: 'suave' }, 'dos'), escolhaMeses,
      h('button', { type: 'button', class: 'link', onclick: () => { escolhaDia.value = ''; escolhaMeses.value = ''; mudarAniversario(); } }, 'tirar')),
    proximo);

  /* Emblemas */
  const emblemas = h('div', { class: 'escolha-emblemas' });
  const desenharEmblemas = () => trocar(emblemas, ganhas.length
    ? ganhas.map(c => {
      const escolhido = r.emblemas.includes(c.chave);
      return h('button', {
        class: `emblema ${escolhido ? 'ativo' : ''}`.trim(), type: 'button', title: c.desc,
        onclick: () => {
          if (escolhido) alterar('emblemas', r.emblemas.filter(x => x !== c.chave));
          else if (r.emblemas.length >= 3) { aviso('Escolha no máximo 3 emblemas.', 'erro'); return; }
          else alterar('emblemas', [...r.emblemas, c.chave]);
          desenharEmblemas();
        },
      }, icone(c.icone), c.nome);
    })
    : h('p', { class: 'suave' }, 'Você ainda não tem conquistas. Jogue, converse e ajude nas atividades para ganhar as primeiras!'));

  const salvar = botao('Salvar perfil', { classe: 'btn-ouro', icone: 'check', desativado: true });
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    salvar.classList.add('carregando');
    const corpo = { titulo_perfil: r.titulo_perfil, bio: r.bio, cor: r.cor, moldura: r.moldura, mc_nick: r.mc_nick, emblemas: r.emblemas, aniversario: r.aniversario };
    if (!r.capa?.startsWith('/uploads/')) corpo.capa = r.capa;
    try {
      const res = await put('/api/auth/perfil', corpo);
      if (res.foto !== eu.foto) atualizarFoto(res.foto);
      mudou = false;
      aviso('Perfil salvo.');
    } catch (e) {
      aviso(e.message, 'erro');
      salvar.disabled = false;
    } finally {
      salvar.classList.remove('carregando');
    }
  });

  desenharPrevia();
  desenharFoto();
  desenharCapas();
  desenharCores();
  desenharMolduras();
  desenharEmblemas();

  /* Senha */
  const atual = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const nova = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', maxlength: '100' });
  const repetir = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', maxlength: '100' });
  const erroEl = h('p', { class: 'form-erro', role: 'alert', hidden: true });
  const trocarSenha = botao('Trocar senha', { classe: 'btn-ouro', tipo: 'submit' });
  const formSenha = h('form', { class: 'form', novalidate: true },
    campo('Senha atual', atual),
    campo('Nova senha', nova, { ajuda: 'Mínimo de 4 caracteres.' }),
    campo('Repita a nova senha', repetir),
    erroEl,
    h('div', null, trocarSenha));
  formSenha.addEventListener('submit', async e => {
    e.preventDefault();
    erroEl.hidden = true;
    const falha = msg => { erroEl.textContent = msg; erroEl.hidden = false; };
    if (nova.value.length < 4) return falha('A nova senha precisa ter pelo menos 4 caracteres.');
    if (nova.value !== repetir.value) return falha('As duas senhas novas não são iguais.');
    trocarSenha.disabled = true;
    try {
      await post('/api/auth/senha', { atual: atual.value, nova: nova.value });
      formSenha.reset();
      aviso('Senha trocada. Outros aparelhos conectados foram desconectados.');
    } catch (err) {
      falha(err.message);
    } finally {
      trocarSenha.disabled = false;
    }
  });

  return h('div', { class: 'pagina perfil-editor' },
    cabecalho({
      titulo: 'Meu perfil', icone: 'usuario', sub: 'Deixe o seu perfil com a sua cara. É isso que todo mundo vê na Comunidade.',
      acoes: [h('a', { class: 'btn', href: `#/pessoa/${eu.id}` }, icone('olho'), h('span', null, 'Ver como os outros veem'))],
    }),
    previa,
    h('div', { class: 'perfil-grade' },
      h('div', { class: 'perfil-coluna' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('imagem'), 'Foto')),
          caixaFoto,
          h('p', { class: 'suave perfil-dica' }, 'A foto é recortada em quadrado sozinha. Com o nick do Minecraft, dá para usar a cabeça da sua skin.')),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('paleta'), 'Capa, cor e moldura')),
          campo('Capa', capas),
          campo('Cor de destaque', cores, { ajuda: 'Aparece no seu perfil e no seu nome no chat.' }),
          campo('Moldura da foto', molduras, { ajuda: 'Novas molduras são liberadas quando você sobe de nível.' }))),
      h('div', { class: 'perfil-coluna' },
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('pena'), 'Sobre você')),
          h('div', { class: 'form' },
            campo('Frase', entradaFrase, { ajuda: 'Aparece embaixo do seu nome.' }),
            campo('Sobre mim', entradaBio),
            campo('Nick do Minecraft', entradaNick),
            campo('Aniversário no RP', entradaAniversario, { ajuda: '1 ano no RP é 1 mês de verdade: o aniversário volta no mesmo dia, um mês sim e um mês não. No dia, você aparece nos aniversariantes da tela inicial para todo mundo dar parabéns.' }))),
        h('section', { class: 'painel' },
          h('div', { class: 'painel-cab' }, h('h2', null, icone('estrela'), 'Emblemas em destaque')),
          h('p', { class: 'suave perfil-dica' }, 'Escolha até 3 conquistas para mostrar no topo do perfil.'),
          emblemas))),
    h('div', { class: 'perfil-salvar' }, salvar, h('small', { class: 'suave' }, 'Foto e capa com imagem são salvas na hora; o resto, neste botão.')),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('chave'), 'O que você pode fazer')),
      h('div', { class: 'perm-grade' }, catalogo.map(g => {
        const tenho = g.itens.filter(i => minhas.has(i.chave));
        return h('div', { class: 'perm-grupo' },
          h('h3', null, g.grupo),
          tenho.length
            ? h('ul', { class: 'lista-check' }, tenho.map(i => h('li', null, icone('check'), i.nome)))
            : h('p', { class: 'suave' }, 'Sem acesso.'));
      }))),
    painelNotificacoes(),
    h('section', { class: 'painel' },
      h('header', { class: 'painel-cab' }, h('h2', null, icone('cadeado'), 'Trocar senha')),
      formSenha));
}
