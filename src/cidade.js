// Lyendell Dorme: o jogo do "Cidade Dorme" (Lobisomem) da Recreação, de 4 a 15 pessoas.
// À noite os Raposos escolhem um coelho para pegar e as outras classes usam os poderes; de dia a cidade
// conversa e vota em quem executar. Os coelhos vencem se acabarem com os Raposos (e com o Gatuno);
// os Raposos vencem se ficarem em número igual ou maior que o resto.
// Aqui só ficam as regras (sem rede): src/recreacao.js cuida das salas, dos tempos e de mandar a visão de cada um.

const adm = require('./adm-jogos');

class ErroCidade extends Error {}

const ESCALA = Number(process.env.CIDADE_ESCALA) || 1; // os testes rodam o jogo bem mais rápido
const TEMPOS = {
  papeis: 12_000, noite: 45_000, amanhecer: 9_000, execucao: 8_000, cacador: 20_000,
};
const TEMPOS_DIA = [60_000, 120_000, 180_000];
const ms = fase => Math.round(TEMPOS[fase] * ESCALA);
const MAX_CHAT = 150;
const MIN = 4;
const MAX = 15;

// time: coelhos (a cidade), raposos ou neutro (cada um com o próprio objetivo).
// acao: o que faz à noite (o resto não faz nada à noite).
const PAPEIS = {
  coelho: { nome: 'Coelho', time: 'coelhos', desc: 'Um morador comum de Lyendell. Não tem poder à noite, mas de dia o seu voto é a maior arma da cidade.' },
  vidente: { nome: 'Vidente', time: 'coelhos', acao: 'investigar', desc: 'Toda noite escolhe alguém e descobre se é Raposo. O Raposo Alfa e o Traidor enganam a visão: parecem coelhos.' },
  aprendiz: { nome: 'Aprendiz de Vidente', time: 'coelhos', desc: 'Não faz nada até a Vidente morrer. Aí você vira a nova Vidente.' },
  curandeira: { nome: 'Curandeira', time: 'coelhos', acao: 'proteger', desc: 'Toda noite protege alguém (pode ser você) de morrer. Não pode proteger a mesma pessoa duas noites seguidas.' },
  guarda: { nome: 'Guarda-Costas', time: 'coelhos', acao: 'guardar', desc: 'Toda noite fica de guarda na casa de alguém. Se atacarem essa pessoa, você morre no lugar dela.' },
  cacador: { nome: 'Caçador', time: 'coelhos', desc: 'Quando morrer, de noite ou na votação, você atira em alguém e leva junto.' },
  boticaria: { nome: 'Boticária', time: 'coelhos', acao: 'pocoes', desc: 'À noite vê quem os Raposos estão atacando. Tem uma poção de vida (salva a vítima) e uma de veneno (mata alguém), cada uma uma vez no jogo.' },
  nobre: { nome: 'Nobre', time: 'coelhos', desc: 'Tem sangue Luckham: o seu voto de dia vale por dois.' },
  cupido: { nome: 'Cupido', time: 'coelhos', acao: 'flechar', desc: 'Na primeira noite flecha dois apaixonados. Se um morrer, o outro morre de tristeza. Se os dois forem os últimos vivos, vencem juntos.' },
  vigia: { nome: 'Vigia', time: 'coelhos', acao: 'vigiar', desc: 'Toda noite vigia a casa de alguém e, de manhã, sabe quem foi lá.' },
  medium: { nome: 'Médium', time: 'coelhos', desc: 'Fala com os mortos: lê o chat deles e, à noite, pode escrever lá (sem mostrar o nome).' },
  sacerdote: { nome: 'Sacerdote do Septo', time: 'coelhos', acao: 'agua', desc: 'Uma vez no jogo joga água benta em alguém à noite. Se for Raposo, ele morre; se não for, quem morre é você.' },
  anciao: { nome: 'Ancião', time: 'coelhos', desc: 'Já viu muita coisa: sobrevive ao primeiro ataque que sofrer à noite.' },
  raposo: { nome: 'Raposo', time: 'raposos', acao: 'atacar', desc: 'À noite, junto com os outros Raposos, escolhe um coelho para pegar. De dia, finge ser coelho.' },
  alfa: { nome: 'Raposo Alfa', time: 'raposos', acao: 'atacar', desc: 'O chefe dos Raposos: o seu voto desempata o ataque, e a Vidente vê você como coelho.' },
  farejadora: { nome: 'Raposa Farejadora', time: 'raposos', acao: 'atacar', desc: 'Ataca com os Raposos e, toda noite, fareja alguém e descobre a classe exata.' },
  traidor: { nome: 'Traidor', time: 'raposos', desc: 'Um coelho que se vendeu aos Raposos. Você sabe quem eles são (eles não sabem quem você é). Não ataca: ajude-os de dia. A Vidente vê você como coelho.' },
  bobo: { nome: 'Bobo da Corte', time: 'neutro', desc: 'Só quer atenção: você vence se a cidade te executar na votação. O jogo continua para os outros.' },
  gatuno: { nome: 'Gatuno', time: 'neutro', acao: 'matar', desc: 'Um gato solitário da Rua Gatuno: toda noite mata alguém. Vence se sobrar sozinho ou com mais uma pessoa.' },
  andarilho: { nome: 'Andarilho', time: 'neutro', acao: 'colete', desc: 'Só quer chegar vivo ao fim. Tem 2 coletes: vestido à noite, salva você de um ataque. Vence se estiver vivo no fim, ganhe quem ganhar.' },
};
const ASSASSINOS = new Set(['raposo', 'alfa', 'farejadora']); // os que atacam à noite
const ESPECIAIS_COELHOS = ['cacador', 'guarda', 'boticaria', 'cupido', 'vigia', 'nobre', 'medium', 'sacerdote', 'anciao', 'aprendiz'];
const OPCIONAIS = Object.keys(PAPEIS).filter(p => p !== 'coelho' && p !== 'raposo');

const embaralhar = (lista, rng = Math.random) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Opções da sala: tempo do dia, se mostra a classe de quem morre e quais classes podem sair.
function validarOpcoes(bruto = {}) {
  const tempoDia = TEMPOS_DIA.includes(Number(bruto.tempoDia)) ? Number(bruto.tempoDia) : 120_000;
  const desligadas = [...new Set((Array.isArray(bruto.desligadas) ? bruto.desligadas : []).filter(p => OPCIONAIS.includes(p)))];
  return { tempoDia, revelar: bruto.revelar !== false, desligadas };
}

// Quais classes entram numa partida de n pessoas.
function distribuir(n, opcoes = validarOpcoes(), rng = Math.random) {
  const pode = p => !opcoes.desligadas.includes(p);
  const papeis = [];
  const nRaposos = n <= 6 ? 1 : n <= 10 ? 2 : 3;
  const raposos = [nRaposos >= 2 && pode('alfa') && 'alfa', nRaposos >= 3 && pode('farejadora') && 'farejadora'].filter(Boolean);
  while (raposos.length < nRaposos) raposos.push('raposo');
  papeis.push(...raposos);
  if (n >= 9 && pode('traidor')) papeis.push('traidor');
  const nNeutros = n >= 12 ? 2 : n >= 7 ? 1 : 0;
  const neutros = embaralhar(['bobo', 'andarilho', ...(n >= 9 ? ['gatuno'] : [])].filter(pode), rng);
  papeis.push(...neutros.slice(0, nNeutros));
  const vagas = n - papeis.length;
  const comuns = Math.max(1, Math.floor(vagas / 4));
  const especiais = [pode('vidente') && 'vidente', pode('curandeira') && 'curandeira',
    ...embaralhar(ESPECIAIS_COELHOS.filter(p => pode(p) && (p !== 'aprendiz' || pode('vidente'))), rng)].filter(Boolean);
  papeis.push(...especiais.slice(0, vagas - comuns));
  while (papeis.length < n) papeis.push('coelho');
  return papeis;
}

function novo(jogadores, opcoes = validarOpcoes(), rng = Math.random, agora = Date.now()) {
  const n = jogadores.length;
  if (n < MIN) throw new ErroCidade(`Lyendell Dorme precisa de pelo menos ${MIN} pessoas.`);
  if (n > MAX) throw new ErroCidade(`Lyendell Dorme cabe no máximo ${MAX} pessoas.`);
  const papeis = embaralhar(distribuir(n, opcoes, rng), rng);
  const e = {
    fase: 'papeis', dia: 0, prazo: agora + ms('papeis'), duracao: ms('papeis'), opcoes,
    j: jogadores.map((p, i) => ({
      id: p.id, nome: p.nome, papel: papeis[i], vivo: true, causa: null, morreuDia: null,
      vidas: papeis[i] === 'anciao' ? 2 : 1, coletes: papeis[i] === 'andarilho' ? 2 : 0, notas: [],
    })),
    papeisNoJogo: embaralhar(papeis, rng), // a lista de classes da partida é pública (sem dizer de quem é cada uma)
    amantes: null, ultimaProtecao: null, pocoes: { vida: true, veneno: true }, aguaUsada: false,
    noite: null, votos: {}, cacadores: [], depoisDoCacador: null, diario: [], executado: null,
    vencedores: null, bobosVencedores: [], chat: { dia: [], raposos: [], mortos: [] }, proximaMsg: 1, rng,
  };
  for (const [i, p] of e.j.entries()) {
    nota(e, i, `Você é ${artigo(p.papel)} ${PAPEIS[p.papel].nome}.`);
    if (ASSASSINOS.has(p.papel)) {
      const outros = e.j.filter((x, k) => k !== i && ASSASSINOS.has(x.papel)).map(x => x.nome);
      nota(e, i, outros.length ? `Os outros Raposos: ${outros.join(', ')}.` : 'Você é o único Raposo. Cuidado!');
    }
    if (p.papel === 'traidor') nota(e, i, `Os Raposos são: ${e.j.filter(x => ASSASSINOS.has(x.papel)).map(x => x.nome).join(', ')}.`);
  }
  registrar(e, 'Anoitece em Lyendell. Cada um olha a sua carta em segredo...');
  return e;
}

const artigo = papel => (['curandeira', 'boticaria', 'farejadora', 'vidente'].includes(papel) ? 'a' : 'o');
const nota = (e, i, texto) => e.j[i].notas.push({ dia: e.dia, texto });
const registrar = (e, texto, tipo = 'info') => e.diario.push({ dia: e.dia, fase: e.fase, texto, tipo });
const vivos = e => e.j.map((p, i) => i).filter(i => e.j[i].vivo);
const ehAssassino = (e, i) => ASSASSINOS.has(e.j[i].papel);
const nomeDe = (e, i) => e.j[i].nome;

/* ─── Ações ───────────────────────────────────────── */

// O que a pessoa i pode fazer agora (a tela mostra isso, e o servidor confere por aqui).
function acoesDe(e, i) {
  const p = e.j[i];
  if (!p) return [];
  if (e.fase === 'cacador') {
    if (e.cacadores[0] !== i) return [];
    return [{ tipo: 'atirar', titulo: 'Você morreu. Em quem atirar antes de cair?', alvos: vivos(e).filter(k => k !== i), escolhido: e.tiro ?? null }];
  }
  if (!p.vivo) return [];
  if (e.fase === 'dia') {
    return [{ tipo: 'votar', titulo: 'Em quem votar para executar?', alvos: vivos(e).filter(k => k !== i), pular: true, escolhido: e.votos[i] ?? null }];
  }
  if (e.fase !== 'noite') return [];
  const n = e.noite;
  const outrosVivos = vivos(e).filter(k => k !== i);
  const lista = [];
  if (ehAssassino(e, i)) lista.push({ tipo: 'atacar', titulo: 'Quem os Raposos vão pegar esta noite?', alvos: vivos(e).filter(k => !ehAssassino(e, k)), escolhido: n.ataques[i] ?? null });
  const escolha = tipo => (n.escolhas[i]?.tipo === tipo ? n.escolhas[i].alvo : undefined);
  switch (p.papel) {
    case 'farejadora': lista.push({ tipo: 'farejar', titulo: 'Quem farejar? (descobre a classe)', alvos: outrosVivos.filter(k => !ehAssassino(e, k)), escolhido: escolha('farejar'), pular: true }); break;
    case 'vidente': lista.push({ tipo: 'investigar', titulo: 'Quem você quer ver se é Raposo?', alvos: outrosVivos, escolhido: escolha('investigar'), pular: true }); break;
    case 'curandeira': lista.push({ tipo: 'proteger', titulo: 'Quem proteger esta noite?', alvos: vivos(e).filter(k => k !== e.ultimaProtecao), escolhido: escolha('proteger'), pular: true }); break;
    case 'guarda': lista.push({ tipo: 'guardar', titulo: 'Na casa de quem ficar de guarda?', alvos: outrosVivos, escolhido: escolha('guardar'), pular: true }); break;
    case 'vigia': lista.push({ tipo: 'vigiar', titulo: 'Qual casa vigiar?', alvos: outrosVivos, escolhido: escolha('vigiar'), pular: true }); break;
    case 'gatuno': lista.push({ tipo: 'matar', titulo: 'Quem o Gatuno vai pegar?', alvos: outrosVivos, escolhido: escolha('matar'), pular: true }); break;
    case 'sacerdote':
      if (!e.aguaUsada) lista.push({ tipo: 'agua', titulo: 'Jogar a água benta em alguém? (só uma vez no jogo)', alvos: outrosVivos, escolhido: escolha('agua'), pular: true });
      break;
    case 'cupido':
      if (e.dia === 1) lista.push({ tipo: 'flechar', titulo: 'Escolha os dois apaixonados', alvos: vivos(e), max: 2, escolhido: n.flechas || [] });
      break;
    case 'andarilho':
      if (p.coletes > 0) lista.push({ tipo: 'colete', titulo: `Vestir um colete esta noite? (sobram ${p.coletes})`, escolhido: n.coletes[i] ?? null });
      break;
    case 'boticaria':
      if (e.pocoes.vida || e.pocoes.veneno) {
        lista.push({
          tipo: 'pocoes', titulo: 'As poções', vitima: alvoDosRaposos(e), vida: e.pocoes.vida, veneno: e.pocoes.veneno,
          usarVida: !!n.vida, alvos: outrosVivos, escolhido: n.veneno ?? null, pronto: n.prontos.has(i),
        });
      }
      break;
  }
  return lista;
}

// Quem os Raposos estão atacando agora: o mais votado; no empate, o voto do Alfa decide (senão, sorteio).
function alvoDosRaposos(e, sortear = false) {
  const n = e.noite;
  const contagem = new Map();
  for (const [i, alvo] of Object.entries(n.ataques)) {
    if (alvo == null || !e.j[i].vivo) continue;
    contagem.set(alvo, (contagem.get(alvo) || 0) + 1);
  }
  if (!contagem.size) return null;
  const max = Math.max(...contagem.values());
  const empatados = [...contagem.keys()].filter(k => contagem.get(k) === max);
  if (empatados.length === 1) return empatados[0];
  const alfa = e.j.findIndex(p => p.papel === 'alfa' && p.vivo);
  if (alfa >= 0 && empatados.includes(n.ataques[alfa])) return n.ataques[alfa];
  return sortear ? empatados[Math.floor(e.rng() * empatados.length)] : empatados[0];
}

// Cada um que tem algo a fazer à noite está pronto?
function prontoNaNoite(e, i) {
  const n = e.noite;
  for (const a of acoesDe(e, i)) {
    if (a.tipo === 'atacar' && n.ataques[i] == null) return false;
    if (a.tipo === 'flechar' && (n.flechas || []).length < 2) return false;
    if (a.tipo === 'colete' && n.coletes[i] == null) return false;
    if (a.tipo === 'pocoes' && !n.prontos.has(i)) return false;
    if (['farejar', 'investigar', 'proteger', 'guardar', 'vigiar', 'matar', 'agua'].includes(a.tipo) && n.escolhas[i]?.tipo !== a.tipo) return false;
  }
  return true;
}

function todosProntos(e) {
  if (e.fase === 'noite') return vivos(e).every(i => prontoNaNoite(e, i));
  if (e.fase === 'dia') return vivos(e).every(i => e.votos[i] !== undefined);
  if (e.fase === 'cacador') return e.tiro !== undefined;
  return false;
}

// jogada = { tipo, alvo } (alvo null = não fazer nada), { tipo: 'flechar', alvos: [a, b] },
// { tipo: 'colete', vestir }, { tipo: 'pocoes', vida, veneno, pronto }.
function agir(e, i, jogada = {}) {
  // Pegadinha do menu de administrador: congelado não usa poder nem vota até o gelo derreter.
  if (!adm.podeAgir(e.j[i]?.id)) throw new ErroCidade('Você está congelado! Espere o gelo derreter.');
  const a = acoesDe(e, i).find(x => x.tipo === jogada.tipo);
  if (!a) throw new ErroCidade(e.fase === 'noite' || e.fase === 'dia' ? 'Você não pode fazer isso agora.' : 'Espere a sua vez.');
  const alvoValido = (alvo, { nulo = true } = {}) => {
    if (alvo == null && nulo) return null;
    if (!Number.isInteger(alvo) || !a.alvos.includes(alvo)) throw new ErroCidade('Escolha alguém da lista.');
    return alvo;
  };
  const n = e.noite;
  switch (a.tipo) {
    case 'atacar': n.ataques[i] = alvoValido(jogada.alvo, { nulo: false }); break;
    case 'votar': e.votos[i] = jogada.alvo === -1 || jogada.alvo == null ? -1 : alvoValido(jogada.alvo); break;
    case 'atirar': e.tiro = alvoValido(jogada.alvo); break;
    case 'flechar': {
      const alvos = Array.isArray(jogada.alvos) ? [...new Set(jogada.alvos)] : [];
      if (alvos.length !== 2) throw new ErroCidade('Escolha duas pessoas diferentes.');
      n.flechas = alvos.map(x => alvoValido(x, { nulo: false }));
      break;
    }
    case 'colete': n.coletes[i] = !!jogada.vestir; break;
    case 'pocoes':
      if (jogada.vida !== undefined) {
        if (jogada.vida && !e.pocoes.vida) throw new ErroCidade('A poção de vida já foi usada.');
        n.vida = !!jogada.vida;
      }
      if (jogada.veneno !== undefined) {
        if (jogada.veneno != null && !e.pocoes.veneno) throw new ErroCidade('O veneno já foi usado.');
        n.veneno = alvoValido(jogada.veneno);
      }
      if (jogada.pronto) n.prontos.add(i);
      else n.prontos.delete(i);
      break;
    default: n.escolhas[i] = { tipo: a.tipo, alvo: alvoValido(jogada.alvo) };
  }
}

/* ─── Mortes ──────────────────────────────────────── */

const CAUSAS = {
  raposos: 'foi pego pelos Raposos', gatuno: 'foi arranhado até a morte pelo Gatuno', veneno: 'foi envenenado',
  agua: 'era Raposo e caiu com a água benta', sacerdote: 'jogou água benta em quem não era Raposo e pagou com a vida',
  guarda: 'morreu protegendo alguém', tristeza: 'morreu de tristeza', cacador: 'levou um tiro do Caçador',
  execucao: 'foi executado pela cidade', saiu: 'foi embora da cidade',
  adm: 'foi atingido por um raio do administrador',
};

// Protegido pelo menu de administrador nesta noite (nada de noite o mata).
const blindado = (e, i) => !!e.noite?.blindados?.has(i);

// Mata e leva junto quem estiver apaixonado; Caçador que morre fica na fila para atirar.
function matar(e, i, causa, mortes) {
  const p = e.j[i];
  if (!p.vivo) return;
  if (causa !== 'saiu' && causa !== 'adm' && blindado(e, i)) { nota(e, i, 'Uma proteção misteriosa te salvou esta noite!'); return; }
  p.vivo = false;
  p.causa = causa;
  p.morreuDia = e.dia;
  mortes.push(i);
  if (p.papel === 'cacador' && causa !== 'saiu') e.cacadores.push(i);
  if (e.amantes?.includes(i)) {
    const outro = e.amantes.find(k => k !== i);
    if (e.j[outro].vivo) matar(e, outro, 'tristeza', mortes);
  }
}

function textoMorte(e, i) {
  const p = e.j[i];
  const papel = e.opcoes.revelar ? ` Era ${artigo(p.papel)} ${PAPEIS[p.papel].nome}.` : '';
  const amante = p.causa === 'tristeza' ? ` (estava apaixonado por ${nomeDe(e, e.amantes.find(k => k !== i))})` : '';
  return `${p.nome} ${CAUSAS[p.causa]}${amante}.${papel}`;
}

function resolverNoite(e) {
  const n = e.noite;
  // Tudo acontece ao mesmo tempo: quem morre nesta noite ainda usa o poder dela.
  const vivosNoInicio = new Set(vivos(e));
  const vivoNaNoite = i => vivosNoInicio.has(i);
  // [quem, alvo] de cada escolha de um tipo (tipo null = de todos os tipos).
  const escolhaDe = tipo => Object.entries(n.escolhas)
    .filter(([i, x]) => (tipo == null || x.tipo === tipo) && x.alvo != null && vivoNaNoite(Number(i)))
    .map(([i, x]) => [Number(i), x.alvo]);
  // Cupido: sem escolha, as flechas caem em duas pessoas ao acaso.
  if (e.dia === 1 && e.j.some(p => p.papel === 'cupido' && p.vivo) && !e.amantes) {
    const par = n.flechas?.length === 2 ? n.flechas : embaralhar(vivos(e), e.rng).slice(0, 2);
    e.amantes = par;
    const [a, b] = par;
    nota(e, a, `A flecha do Cupido te acertou: você está apaixonado por ${nomeDe(e, b)}.`);
    nota(e, b, `A flecha do Cupido te acertou: você está apaixonado por ${nomeDe(e, a)}.`);
    const cupido = e.j.findIndex(p => p.papel === 'cupido');
    if (cupido >= 0 && !par.includes(cupido)) nota(e, cupido, `Você flechou ${nomeDe(e, a)} e ${nomeDe(e, b)}.`);
  }
  const protegidos = new Set(escolhaDe('proteger').map(([, alvo]) => alvo));
  const curandeira = escolhaDe('proteger')[0];
  e.ultimaProtecao = curandeira ? curandeira[1] : null;
  const guardas = new Map(escolhaDe('guardar').map(([g, alvo]) => [alvo, g]));
  const coletes = new Set(Object.entries(n.coletes).filter(([i, v]) => v && vivoNaNoite(Number(i))).map(([i]) => Number(i)));
  for (const i of coletes) e.j[i].coletes--;
  const vitima = alvoDosRaposos(e, true);
  const boticaria = e.j.findIndex((p, i) => p.papel === 'boticaria' && vivoNaNoite(i));
  const vida = n.vida && e.pocoes.vida && vitima != null && boticaria >= 0;
  if (vida) e.pocoes.vida = false;
  const mortes = [];
  const salvos = [];
  // Um ataque (dos Raposos ou do Gatuno) passa pela proteção, pelo guarda, pelo colete, pela poção e pelo Ancião.
  const atacar = (alvo, causa) => {
    const p = e.j[alvo];
    if (!p.vivo) return;
    if (blindado(e, alvo)) { nota(e, alvo, 'Você foi atacado, mas uma proteção misteriosa te salvou!'); return; }
    if (protegidos.has(alvo)) { salvos.push({ alvo, por: 'curandeira' }); return; }
    const guarda = guardas.get(alvo);
    if (guarda != null && e.j[guarda].vivo) { matar(e, guarda, 'guarda', mortes); nota(e, guarda, `Você protegeu ${p.nome} e não sobreviveu.`); return; }
    if (coletes.has(alvo)) { nota(e, alvo, 'Você foi atacado, mas o colete te salvou!'); return; }
    if (causa === 'raposos' && vida) { salvos.push({ alvo, por: 'boticaria' }); return; }
    if (p.papel === 'anciao' && p.vidas > 1) { p.vidas--; nota(e, alvo, 'Você foi atacado esta noite, mas aguentou firme. Da próxima vez não vai ter jeito.'); return; }
    matar(e, alvo, causa, mortes);
  };
  if (vitima != null) atacar(vitima, 'raposos');
  for (const [, alvo] of escolhaDe('matar')) atacar(alvo, 'gatuno');
  if (n.veneno != null && e.pocoes.veneno && boticaria >= 0) {
    e.pocoes.veneno = false;
    matar(e, n.veneno, 'veneno', mortes);
  }
  for (const [sacerdote, alvo] of escolhaDe('agua')) {
    e.aguaUsada = true;
    if (ehAssassino(e, alvo)) matar(e, alvo, 'agua', mortes);
    else matar(e, sacerdote, 'sacerdote', mortes);
  }
  for (const s of salvos) {
    const quem = e.j.findIndex(p => p.papel === s.por);
    if (quem >= 0) nota(e, quem, `Você salvou ${nomeDe(e, s.alvo)} esta noite!`);
  }
  // O que os investigadores descobriram (o Raposo Alfa e o Traidor parecem coelhos).
  for (const [i, alvo] of escolhaDe('investigar')) {
    const raposo = ['raposo', 'farejadora'].includes(e.j[alvo].papel);
    nota(e, i, `${nomeDe(e, alvo)} ${raposo ? 'É RAPOSO!' : 'não é Raposo.'}`);
  }
  for (const [i, alvo] of escolhaDe('farejar')) nota(e, i, `Você farejou ${nomeDe(e, alvo)}: é ${artigo(e.j[alvo].papel)} ${PAPEIS[e.j[alvo].papel].nome}.`);
  for (const [i, alvo] of escolhaDe('vigiar')) {
    // Quem foi lá: quem escolheu essa casa para o seu poder, os Raposos (se atacaram ali) e a Boticária (se usou poção ali).
    const visitas = new Set(escolhaDe(null).filter(([k, x]) => x === alvo && k !== i).map(([k]) => k));
    if (vitima === alvo) for (const [k, x] of Object.entries(n.ataques)) if (x === alvo) visitas.add(Number(k));
    if (boticaria >= 0 && (n.veneno === alvo || (vida && vitima === alvo))) visitas.add(boticaria);
    const nomes = [...visitas].map(k => nomeDe(e, k));
    nota(e, i, nomes.length ? `Foram à casa de ${nomeDe(e, alvo)}: ${nomes.join(', ')}.` : `Ninguém foi à casa de ${nomeDe(e, alvo)}.`);
  }
  registrar(e, `Amanhece o dia ${e.dia}.`, 'sol');
  if (!mortes.length) registrar(e, 'Ninguém morreu esta noite!', 'bom');
  for (const m of mortes) registrar(e, textoMorte(e, m), 'morte');
  return mortes;
}

function resolverDia(e) {
  const peso = i => (e.j[i].papel === 'nobre' ? 2 : 1);
  const contagem = new Map();
  for (const [i, alvo] of Object.entries(e.votos)) {
    if (!e.j[i].vivo || alvo === undefined) continue;
    contagem.set(alvo, (contagem.get(alvo) || 0) + peso(Number(i)));
  }
  const ordem = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const mortes = [];
  e.executado = null;
  if (!ordem.length || ordem[0][0] === -1 || (ordem[1] && ordem[1][1] === ordem[0][1])) {
    registrar(e, ordem.length && ordem[1] && ordem[1][1] === ordem[0][1] ? 'Deu empate na votação: ninguém foi executado.' : 'A cidade decidiu não executar ninguém hoje.');
    return mortes;
  }
  const [alvo, votos] = ordem[0];
  e.executado = alvo;
  matar(e, alvo, 'execucao', mortes);
  registrar(e, `Com ${votos} ${votos === 1 ? 'voto' : 'votos'}, ${textoMorte(e, alvo)}`, 'morte');
  for (const m of mortes.slice(1)) registrar(e, textoMorte(e, m), 'morte');
  if (e.j[alvo].papel === 'bobo') {
    e.bobosVencedores.push(alvo);
    registrar(e, `O Bobo da Corte riu por último: ${nomeDe(e, alvo)} queria ser executado e venceu!`, 'bom');
  }
  return mortes;
}

/* ─── Fim de jogo ─────────────────────────────────── */

function conferirFim(e) {
  const v = vivos(e);
  const assassinos = v.filter(i => ehAssassino(e, i));
  const gatuno = v.find(i => e.j[i].papel === 'gatuno');
  const doTime = time => e.j.map((p, i) => i).filter(i => PAPEIS[e.j[i].papel].time === time);
  let fim = null;
  if (!v.length) fim = { time: 'ninguem', texto: 'Ninguém sobreviveu à noite de Lyendell.', indices: [] };
  else if (e.amantes && v.length === 2 && e.amantes.every(i => e.j[i].vivo)) {
    fim = { time: 'amantes', texto: `O amor venceu: ${e.amantes.map(i => nomeDe(e, i)).join(' e ')} são os últimos de pé!`, indices: [...e.amantes] };
  } else if (gatuno != null && v.length <= 2) fim = { time: 'gatuno', texto: `O Gatuno ${nomeDe(e, gatuno)} venceu sozinho!`, indices: [gatuno] };
  else if (!assassinos.length && gatuno == null) fim = { time: 'coelhos', texto: 'Os Coelhos venceram! Lyendell está livre dos Raposos.', indices: doTime('coelhos') };
  else if (assassinos.length && gatuno == null) {
    const timeRaposos = v.filter(i => PAPEIS[e.j[i].papel].time === 'raposos').length;
    if (timeRaposos >= v.length - timeRaposos) fim = { time: 'raposos', texto: 'Os Raposos venceram! A toca é deles agora.', indices: doTime('raposos') };
  }
  if (!fim && e.dia >= 20) fim = { time: 'ninguem', texto: 'Vinte dias se passaram e ninguém venceu.', indices: [] };
  if (!fim) return null;
  // Quem vence junto: o Bobo executado e o Andarilho vivo.
  const extras = [...e.bobosVencedores, ...v.filter(i => e.j[i].papel === 'andarilho')];
  fim.indices = [...new Set([...fim.indices, ...extras])];
  return fim;
}

/* ─── Fases ───────────────────────────────────────── */

function abrir(e, fase, agora, duracao = ms(fase)) {
  e.fase = fase;
  e.prazo = agora + duracao;
  e.duracao = duracao;
}

function comecarNoite(e, agora) {
  e.dia++;
  e.votos = {};
  e.executado = null;
  e.noite = { ataques: {}, escolhas: {}, coletes: {}, flechas: null, vida: false, veneno: null, prontos: new Set() };
  // A Aprendiz assume quando a Vidente já morreu.
  if (!e.j.some(p => p.papel === 'vidente' && p.vivo)) {
    const aprendiz = e.j.findIndex(p => p.papel === 'aprendiz' && p.vivo);
    if (aprendiz >= 0) {
      e.j[aprendiz].papel = 'vidente';
      nota(e, aprendiz, 'A Vidente morreu: agora você é a nova Vidente.');
    }
  }
  abrir(e, 'noite', agora);
  registrar(e, `Noite ${e.dia}: a cidade dorme...`, 'lua');
}

// Depois de mortes: Caçador (se houver), fim de jogo ou a próxima fase.
function seguir(e, agora, proxima) {
  if (e.cacadores.length) {
    e.depoisDoCacador = proxima;
    e.tiro = undefined;
    abrir(e, 'cacador', agora);
    return;
  }
  const fim = conferirFim(e);
  if (fim) {
    e.vencedores = fim;
    e.fase = 'fim';
    e.prazo = 0;
    registrar(e, fim.texto, 'fim');
    return;
  }
  if (proxima === 'dia') abrir(e, 'dia', agora, Math.round(e.opcoes.tempoDia * ESCALA));
  else comecarNoite(e, agora);
}

// O tempo da fase acabou (ou todo mundo já fez o que tinha que fazer): passa para a próxima.
function avancar(e, agora = Date.now()) {
  switch (e.fase) {
    case 'papeis': comecarNoite(e, agora); break;
    case 'noite': {
      resolverNoite(e);
      e.noite = null;
      abrir(e, 'amanhecer', agora);
      break;
    }
    case 'amanhecer': seguir(e, agora, 'dia'); break;
    case 'dia': {
      resolverDia(e);
      abrir(e, 'execucao', agora);
      break;
    }
    case 'execucao': seguir(e, agora, 'noite'); break;
    case 'cacador': {
      const cacador = e.cacadores.shift();
      const mortes = [];
      if (e.tiro != null && e.j[e.tiro].vivo) {
        matar(e, e.tiro, 'cacador', mortes);
        registrar(e, `O Caçador ${nomeDe(e, cacador)} atirou!`, 'morte');
        for (const m of mortes) registrar(e, textoMorte(e, m), 'morte');
      } else {
        registrar(e, `O Caçador ${nomeDe(e, cacador)} não atirou em ninguém.`);
      }
      e.tiro = undefined;
      seguir(e, agora, e.depoisDoCacador);
      break;
    }
    default: break;
  }
}

// Todo mundo já fez a sua parte: a fase acaba logo (um respiro para ver o que aconteceu), sem esperar o tempo todo.
function encurtar(e, agora = Date.now()) {
  const fim = agora + Math.round((e.fase === 'cacador' ? 800 : 2000) * ESCALA);
  if (fim < e.prazo) e.prazo = fim;
}

// Alguém saiu da sala no meio da partida: morre (sem tiro de Caçador) e o jogo segue.
function sair(e, i, agora = Date.now()) {
  if (e.fase === 'fim' || !e.j[i].vivo) return;
  const mortes = [];
  matar(e, i, 'saiu', mortes);
  for (const m of mortes) registrar(e, textoMorte(e, m), 'morte');
  if (e.fase === 'cacador' && e.cacadores[0] === i) { e.tiro = null; return; }
  const fim = conferirFim(e);
  if (fim) {
    e.vencedores = fim;
    e.fase = 'fim';
    e.prazo = 0;
    registrar(e, fim.texto, 'fim');
  }
  void agora;
}

/* ─── Chat ────────────────────────────────────────── */

// Canais: "dia" (a praça: os vivos falam de dia, todo mundo lê), "raposos" (os Raposos combinam o ataque)
// e "mortos" (quem morreu conversa; a Médium lê e, à noite, escreve sem mostrar o nome).
function podeFalar(e, i, canal) {
  const p = e.j[i];
  if (!p) return false;
  if (e.fase === 'fim') return canal === 'dia';
  if (canal === 'dia') return p.vivo && ['papeis', 'amanhecer', 'dia', 'execucao', 'cacador'].includes(e.fase);
  if (canal === 'raposos') return p.vivo && ehAssassino(e, i);
  if (canal === 'mortos') return !p.vivo || (p.papel === 'medium' && e.fase === 'noite');
  return false;
}

function podeLer(e, i, canal) {
  if (canal === 'dia') return true;
  if (i < 0) return e.fase === 'fim';
  const p = e.j[i];
  if (e.fase === 'fim' || !p.vivo) return true; // quem morreu vê tudo
  if (canal === 'raposos') return ehAssassino(e, i);
  if (canal === 'mortos') return p.papel === 'medium';
  return false;
}

function falar(e, i, canal, texto) {
  const mudo = (e.mudos?.[i] || 0) - Date.now();
  if (mudo > 0) throw new ErroCidade(`O administrador te silenciou: espere ${Math.ceil(mudo / 1000)} s para falar.`);
  if (!podeFalar(e, i, canal)) {
    throw new ErroCidade(canal === 'dia' && e.fase === 'noite' ? 'A cidade está dormindo. Espere amanhecer.' : 'Você não pode falar aqui agora.');
  }
  const p = e.j[i];
  const anonimo = canal === 'mortos' && p.vivo; // a Médium
  const msg = { n: e.proximaMsg++, canal, de: anonimo ? null : i, nome: anonimo ? 'Médium' : p.nome, texto, em: Date.now() };
  e.chat[canal].push(msg);
  if (e.chat[canal].length > MAX_CHAT) e.chat[canal].shift();
  return msg;
}

/* ─── O que cada um vê ────────────────────────────── */

function visao(e, i, agora = Date.now()) {
  const eu = i >= 0 ? e.j[i] : null;
  const fim = e.fase === 'fim';
  const veTudo = fim || (eu && !eu.vivo);
  const aliado = k => !!eu && ehAssassino(e, k) && (ehAssassino(e, i) || eu.papel === 'traidor');
  const jogadores = e.j.map((p, k) => ({
    vivo: p.vivo,
    papel: k === i || veTudo || aliado(k) || (!p.vivo && e.opcoes.revelar) ? p.papel : null,
    causa: p.vivo ? null : p.causa,
    aliado: aliado(k) && k !== i,
    amante: !!(eu && e.amantes?.includes(i) && e.amantes.includes(k) && k !== i) || (veTudo && !!e.amantes?.includes(k)),
    voto: e.fase === 'dia' || e.fase === 'execucao' ? e.votos[k] ?? null : null,
  }));
  const contagemVotos = {};
  if (e.fase === 'dia' || e.fase === 'execucao') {
    for (const [k, alvo] of Object.entries(e.votos)) {
      if (alvo === undefined || !e.j[k].vivo) continue;
      contagemVotos[alvo] = (contagemVotos[alvo] || 0) + (e.j[k].papel === 'nobre' ? 2 : 1);
    }
  }
  // Os Raposos veem os votos uns dos outros; a Boticária vê só quem está sendo atacado.
  let ataque = null;
  if (e.fase === 'noite' && eu?.vivo && ehAssassino(e, i)) ataque = { votos: e.noite.ataques, alvo: alvoDosRaposos(e) };
  return {
    fase: e.fase, dia: e.dia, restante: e.prazo ? Math.max(0, e.prazo - agora) : 0, duracao: e.duracao,
    opcoes: { tempoDia: e.opcoes.tempoDia, revelar: e.opcoes.revelar },
    jogadores, votos: contagemVotos, ataque,
    papeisNoJogo: e.papeisNoJogo,
    executado: e.executado,
    eu: eu ? {
      papel: eu.papel, vivo: eu.vivo, notas: eu.notas, acoes: acoesDe(e, i),
      cacador: e.fase === 'cacador' && e.cacadores[0] === i, pronto: e.fase === 'noite' && eu.vivo ? prontoNaNoite(e, i) : null,
    } : null,
    cacadorDaVez: e.fase === 'cacador' ? e.cacadores[0] : null,
    diario: e.diario.slice(-60),
    canais: ['dia', 'raposos', 'mortos'].filter(c => podeLer(e, i, c)),
    falar: i >= 0 ? ['dia', 'raposos', 'mortos'].filter(c => podeFalar(e, i, c)) : [],
    chat: Object.fromEntries(['dia', 'raposos', 'mortos'].filter(c => podeLer(e, i, c)).map(c => [c, e.chat[c].slice(-40)])),
    vencedores: e.vencedores,
  };
}

// Quem recebe uma mensagem do chat (índices dos jogadores; -1 = quem assiste).
const leitores = (e, canal) => [-1, ...e.j.map((p, i) => i)].filter(i => podeLer(e, i, canal));

/* ─── Menu de administrador (src/adm/cidade.js) ───── */
// Mexem direto no estado; quem chama cuida do relógio das fases e de mandar a sala de novo.

const nomePapel = papel => `${artigo(papel)} ${PAPEIS[papel].nome}`;
const NOMES_TIMES = { coelhos: 'Coelhos', raposos: 'Raposos', neutro: 'Neutros' };

function conferirAlvo(e, i, { vivo = null } = {}) {
  if (!Number.isInteger(i) || !e.j[i]) throw new ErroCidade('Escolha um jogador da partida.');
  if (vivo === true && !e.j[i].vivo) throw new ErroCidade(`${e.j[i].nome} já está morto.`);
  if (vivo === false && e.j[i].vivo) throw new ErroCidade(`${e.j[i].nome} está vivo.`);
  return e.j[i];
}
const vezDoCacador = (e, i) => e.fase === 'cacador' && e.cacadores[0] === i;

// Mais tempo na fase de agora (ms).
function admMaisTempo(e, extra, agora = Date.now()) {
  if (e.fase === 'fim') throw new ErroCidade('A partida já acabou.');
  e.prazo = Math.max(e.prazo, agora) + extra;
  e.duracao = Math.max(e.duracao, e.prazo - agora);
}

// Termina agora com a vitória de um time (coelhos, raposos, neutro) ou de ninguém.
function admVencer(e, time) {
  if (e.fase === 'fim') throw new ErroCidade('A partida já acabou.');
  if (![...Object.keys(NOMES_TIMES), 'ninguem'].includes(time)) throw new ErroCidade('Escolha o time que vence.');
  const indices = time === 'ninguem' ? [] : e.j.map((p, i) => i).filter(i => PAPEIS[e.j[i].papel].time === time);
  if (time !== 'ninguem' && !indices.length) throw new ErroCidade(`Ninguém nesta partida é do time dos ${NOMES_TIMES[time]}.`);
  const texto = time === 'ninguem' ? 'O administrador encerrou a partida: ninguém venceu.'
    : time === 'neutro' ? `Os neutros venceram (${indices.map(i => nomeDe(e, i)).join(', ')}), por decisão do administrador!`
      : `Os ${NOMES_TIMES[time]} venceram, por decisão do administrador!`;
  e.vencedores = { time, texto, indices };
  e.fase = 'fim';
  e.prazo = 0;
  e.cacadores = [];
  registrar(e, texto, 'fim');
}

// Volta à vida (o Caçador que está escolhendo em quem atirar não pode voltar no meio da escolha).
function admReviver(e, i) {
  const p = conferirAlvo(e, i, { vivo: false });
  if (e.fase === 'fim') throw new ErroCidade('A partida já acabou.');
  if (p.causa === 'saiu') throw new ErroCidade(`${p.nome} saiu da sala: não dá para voltar.`);
  if (vezDoCacador(e, i)) throw new ErroCidade('Espere o Caçador atirar.');
  Object.assign(p, { vivo: true, causa: null, morreuDia: null });
  e.cacadores = e.cacadores.filter(k => k !== i);
  nota(e, i, 'O administrador te trouxe de volta à vida!');
  registrar(e, `Um milagre em Lyendell: ${p.nome} voltou à vida!`, 'bom');
}

// Ninguém mata essa pessoa nesta noite (ataques, veneno, água benta, tristeza).
function admProteger(e, i) {
  const p = conferirAlvo(e, i, { vivo: true });
  if (e.fase !== 'noite' || !e.noite) throw new ErroCidade('Só dá para proteger alguém de noite.');
  e.noite.blindados ??= new Set();
  e.noite.blindados.add(i);
  return p;
}

// Mata na hora. Caçador morto atira na próxima virada de fase. Devolve true se a partida acabou.
function admMatar(e, i) {
  const p = conferirAlvo(e, i, { vivo: true });
  if (e.fase === 'fim') throw new ErroCidade('A partida já acabou.');
  const mortes = [];
  matar(e, i, 'adm', mortes);
  for (const m of mortes) registrar(e, textoMorte(e, m), 'morte');
  // Quem morreu agora some das escolhas (não dá para votar nem atacar um morto).
  for (const k of mortes) {
    if (e.noite) {
      delete e.noite.ataques[k];
      e.noite.prontos.delete(k);
      for (const [x, alvo] of Object.entries(e.noite.ataques)) if (alvo === k) delete e.noite.ataques[x];
      for (const [x, esc] of Object.entries(e.noite.escolhas)) if (esc?.alvo === k) delete e.noite.escolhas[x];
      if (e.noite.veneno === k) e.noite.veneno = null;
    }
    delete e.votos[k];
    for (const [x, alvo] of Object.entries(e.votos)) if (alvo === k) delete e.votos[x];
    if (e.tiro === k) e.tiro = undefined;
  }
  if (e.cacadores.length) return false; // o Caçador atira antes de conferir o fim
  const fim = conferirFim(e);
  if (!fim) return false;
  e.vencedores = fim;
  e.fase = 'fim';
  e.prazo = 0;
  registrar(e, fim.texto, 'fim');
  void p;
  return true;
}

// Troca a classe de alguém vivo (o que ele já tinha escolhido nesta noite é desfeito).
function admTrocarPapel(e, i, papel) {
  const p = conferirAlvo(e, i, { vivo: true });
  if (!PAPEIS[papel]) throw new ErroCidade('Escolha uma classe.');
  if (e.fase === 'fim') throw new ErroCidade('A partida já acabou.');
  if (p.papel === papel) throw new ErroCidade(`${p.nome} já é ${nomePapel(papel)}.`);
  if (vezDoCacador(e, i)) throw new ErroCidade('Espere o Caçador atirar.');
  const antigo = p.papel;
  p.papel = papel;
  p.vidas = papel === 'anciao' ? 2 : 1;
  p.coletes = papel === 'andarilho' ? 2 : 0;
  if (e.noite) {
    delete e.noite.ataques[i];
    delete e.noite.escolhas[i];
    delete e.noite.coletes[i];
    e.noite.prontos.delete(i);
  }
  nota(e, i, `O administrador trocou a sua classe: agora você é ${nomePapel(papel)}.`);
  if (ASSASSINOS.has(papel)) {
    const outros = e.j.filter((x, k) => k !== i && x.vivo && ASSASSINOS.has(x.papel));
    nota(e, i, outros.length ? `Os outros Raposos: ${outros.map(x => x.nome).join(', ')}.` : 'Você é o único Raposo. Cuidado!');
    for (const [k, x] of e.j.entries()) if (k !== i && x.vivo && (ASSASSINOS.has(x.papel) || x.papel === 'traidor')) nota(e, k, `${p.nome} agora é Raposo.`);
  }
  if (papel === 'traidor') nota(e, i, `Os Raposos são: ${e.j.filter(x => x.vivo && ASSASSINOS.has(x.papel)).map(x => x.nome).join(', ') || 'ninguém (todos morreram)'}.`);
  return antigo;
}

// Não fala no chat do jogo por alguns segundos.
function admSilenciar(e, i, segundos, agora = Date.now()) {
  const p = conferirAlvo(e, i);
  e.mudos ??= {};
  e.mudos[i] = agora + segundos * 1000;
  return p;
}

// Um aviso no diário da partida (todo mundo lê).
function admAnunciar(e, texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!t) throw new ErroCidade('Escreva o aviso.');
  registrar(e, `Aviso do administrador: ${t}`, 'info');
  return t;
}

// A classe de cada um (para o administrador, e só para ele).
function admPapel(e, i) {
  const p = conferirAlvo(e, i);
  const time = { coelhos: 'time dos Coelhos', raposos: 'time dos Raposos', neutro: 'neutro' }[PAPEIS[p.papel].time];
  return `${p.nome} é ${nomePapel(p.papel)} (${time})${p.vivo ? '' : ', já morto'}${e.amantes?.includes(i) ? ', apaixonado' : ''}.`;
}

module.exports = {
  PAPEIS, ASSASSINOS, OPCIONAIS, MIN, MAX, TEMPOS_DIA, ErroCidade,
  validarOpcoes, distribuir, novo, acoesDe, agir, todosProntos, encurtar, avancar, sair, falar, podeFalar, leitores, visao, conferirFim, alvoDosRaposos,
  admMaisTempo, admVencer, admReviver, admProteger, admMatar, admTrocarPapel, admSilenciar, admAnunciar, admPapel,
};
