// A janela do Pet Shop: adotar um Pompom (cor e nome), mudar o nome, deixar em casa ou levar para passear.
// O pompom adotado segue o coelho por todas as salas do clube, e todo mundo vê (telas/clube.js).
import { h, trocar, botao, modal, get, post, put, aviso, interruptor } from '../core.js';
import { desenharPompom, CORES_POMPOM } from './neve.js';

const IDS = ['rosa', 'azul', 'amarelo', 'verde', 'roxo', 'preto', 'branco', 'laranja'];
const NOMES = { rosa: 'Rosa', azul: 'Azul', amarelo: 'Amarelo', verde: 'Verde', roxo: 'Roxo', preto: 'Preto', branco: 'Branco', laranja: 'Laranja' };
export const corDoPompom = id => CORES_POMPOM[IDS.indexOf(id)] || CORES_POMPOM[0];
const SUGESTOES = ['Fofura', 'Algodão', 'Bolinha', 'Pipoca', 'Nuvem', 'Chiclete', 'Pantufa', 'Docinho', 'Trovão', 'Biscoito'];

function retrato(cor, tam = 72) {
  const c = h('canvas', { class: 'pompom-retrato', width: tam * 2, height: tam * 2, style: { width: `${tam}px`, height: `${tam}px` } });
  const g = c.getContext('2d');
  let raf = 0;
  const inicio = performance.now();
  const passo = agora => {
    if (!c.isConnected && agora - inicio > 2000) return;
    raf = requestAnimationFrame(passo);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(2, 0, 0, 2, 0, 0);
    desenharPompom(g, tam / 2, tam * 0.78, (agora - inicio) / 1000, corDoPompom(cor), 'pulando', tam / 40);
  };
  raf = requestAnimationFrame(passo);
  return c;
}

export async function abrirAdocao(ctx) {
  const d = await get('/api/clube');
  let pompom = d.eu.pompom;
  const preco = d.pompom?.preco ?? 100;
  const corpo = h('div', { class: 'pompom-janela' });
  const m = modal({ titulo: 'Pet Shop dos Pompons', tamanho: 'medio', corpo });

  function desenharAdocao(trocando = false) {
    let escolhida = pompom?.cor || IDS[Math.floor(Math.random() * IDS.length)];
    const nome = h('input', { class: 'input', maxlength: '20', placeholder: 'Nome do pompom', value: SUGESTOES[Math.floor(Math.random() * SUGESTOES.length)] });
    const grade = h('div', { class: 'pompom-cores' });
    const desenharCores = () => trocar(grade, IDS.map(id => h('button', {
      type: 'button', class: `pompom-cor ${id === escolhida ? 'ativo' : ''}`.trim(), title: NOMES[id],
      onclick: () => { escolhida = id; desenharCores(); },
    }, retrato(id, 56), h('small', null, NOMES[id]))));
    desenharCores();
    trocar(corpo,
      h('p', null, trocando ? `Trocar o ${pompom.nome} por outro pompom? Ele vai morar com a tratadora, que cuida muito bem dele.` : 'A tratadora deixa você adotar um pompom! Ele segue o seu coelho por todo o clube, e todo mundo vê.'),
      h('h3', { class: 'pompom-titulo' }, 'Escolha a cor'), grade,
      h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Nome'), nome),
      h('div', { class: 'pompom-botoes' },
        trocando && botao('Voltar', { onclick: () => desenharMeu() }),
        botao(`Adotar por ${preco} cenouras`, { classe: 'btn-ouro', onclick: async ev => {
          ev.currentTarget.disabled = true;
          try {
            const r = await post('/api/clube/pompom', { cor: escolhida, nome: nome.value });
            pompom = r.pompom;
            ctx.mudarMoedas(r.moedas);
            ctx.enviar('clube:emote', { e: 'coracao' });
            aviso(`${pompom.nome} agora é seu! Ele vai seguir você por todo o clube.`);
            desenharMeu();
          } catch (x) { aviso(x.message, 'erro'); ev.currentTarget.disabled = false; }
        } })));
  }

  function desenharMeu() {
    const nome = h('input', { class: 'input', maxlength: '20', value: pompom.nome });
    trocar(corpo,
      h('div', { class: 'pompom-meu' }, retrato(pompom.cor, 96),
        h('div', null, h('strong', { class: 'pompom-nome' }, pompom.nome), h('small', null, `Pompom ${NOMES[pompom.cor].toLowerCase()}`))),
      interruptor('Passeando comigo', pompom.passear, async v => {
        try { pompom = (await put('/api/clube/pompom', { passear: v })).pompom; aviso(v ? `${pompom.nome} está passeando com você!` : `${pompom.nome} ficou em casa descansando.`); } catch (x) { aviso(x.message, 'erro'); }
      }, 'Desligado, ele fica em casa e não aparece no clube.'),
      h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Nome'), nome),
      h('div', { class: 'pompom-botoes' },
        botao('Mudar o nome', { onclick: async () => {
          try { pompom = (await put('/api/clube/pompom', { nome: nome.value })).pompom; aviso(`Agora ele se chama ${pompom.nome}.`); desenharMeu(); } catch (x) { aviso(x.message, 'erro'); }
        } }),
        botao('Fazer carinho', { onclick: () => { ctx.enviar('clube:emote', { e: 'coracao' }); aviso(`${pompom.nome} fez "prrr" de felicidade!`); } }),
        botao('Trocar de pompom', { onclick: () => desenharAdocao(true) }),
        botao('Fechar', { classe: 'btn-ouro', onclick: () => m.fechar() })));
  }

  if (pompom) desenharMeu(); else desenharAdocao();
}
