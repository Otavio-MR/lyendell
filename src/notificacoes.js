// Notificações no celular e no PC (Web Push): quem ativa no site recebe um aviso do sistema mesmo com o site
// fechado. O que cada um recebe depende do cargo: todo morador recebe os avisos gerais (anúncios, procurados,
// leis, atividades, recados no mural, os próprios envios aprovados ou recusados), e cada cargo ganha os seus
// (a Tabeliã, os registros para aprovar no Tabelionato; a Senadora, as propostas do povo; e assim por diante).
// Os Aliados (que não são moradores) recebem as novidades marcadas para Convidados e Aliados.
// Mensagem do chat não vira notificação (é coisa demais e incomodaria).
// As chaves (VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTATO) ficam no .env e no Render; sem elas, nada é enviado.
const webpush = require('web-push');
const { db } = require('./db');
const { carregarUsuario } = require('./auth');

// Os tipos de aviso. Quem vê o tipo (e pode ligar): sem "perm" nem "algum", todo mundo; com "perm", quem tem
// essa permissão; com "algum", quem tem pelo menos uma dessas. "padrao: false" começa desligado.
const APROVAR = ['tabelionato.aprovar', 'guarda.aprovar', 'hospital.aprovar', 'congresso.aprovar', 'leis.aprovar'];
const TIPOS = {
  anuncios: { nome: 'Anúncios novos no mural', perm: 'anuncios.ver' },
  procurados: { nome: 'Procurados e banidos da Capital' }, // aviso público, como os cartazes da tela inicial
  leis: { nome: 'Leis de Lyendell publicadas', perm: 'leis.ver' },
  atividades: { nome: 'Atividades novas (pedidos de ajuda)', perm: 'atividades.ver' },
  recados: { nome: 'Recados no seu mural' },
  meus_envios: { nome: 'Seus registros e propostas aprovados ou recusados' },
  // Para os Aliados (convidados de outras casas): anúncios, atividades e registros marcados para eles.
  aliados: { nome: 'Novidades para Convidados e Aliados', perm: 'aliados.ver' },
  // Dos cargos
  aprovacoes: { nome: 'Registros esperando a sua aprovação', algum: APROVAR, cargo: true },
  propostas: { nome: 'Propostas do povo para avaliar', perm: 'congresso.aprovar', cargo: true },
  entregas: { nome: 'Entregas para conferir nas atividades que você cuida', algum: ['atividades.gerenciar', 'atividades.criar'], cargo: true },
  sprites: { nome: 'Sprites dos jogos trocados por outra pessoa', perm: 'sprites.editar', cargo: true, padrao: false },
};
const PADRAO = Object.keys(TIPOS).filter(t => TIPOS[t].padrao !== false);

// A pessoa pode receber (e ver na lista) esse tipo?
function podeTipo(u, tipo) {
  const t = TIPOS[tipo];
  if (!t || !u) return false;
  if (u.is_root) return true;
  if (t.perm) return u.permissoes.has(t.perm);
  if (t.algum) return t.algum.some(p => u.permissoes.has(p));
  return true;
}
const tiposDe = u => Object.keys(TIPOS).filter(t => podeTipo(u, t));

const chaves = {
  publica: process.env.VAPID_PUBLICA || '',
  privada: process.env.VAPID_PRIVADA || '',
  contato: process.env.VAPID_CONTATO || 'https://casa-luckham.onrender.com',
};
let ativo = false;
try {
  if (chaves.publica && chaves.privada) {
    webpush.setVapidDetails(chaves.contato, chaves.publica, chaves.privada);
    ativo = true;
  }
} catch (e) {
  console.error('Notificações desligadas (chaves VAPID inválidas):', e.message);
}

// O que cada aparelho desligou fica guardado como { fora: [...] } (assim um tipo novo, ou de um cargo novo,
// já vem ligado). O formato antigo era a lista dos ligados: o que não estava nela conta como desligado.
const ANTIGOS = ['anuncios', 'procurados', 'leis', 'atividades'];
function desligados(tiposSalvos) {
  let v = null;
  try { v = JSON.parse(tiposSalvos || 'null'); } catch { v = null; }
  if (Array.isArray(v)) return ANTIGOS.filter(t => !v.includes(t));
  if (v && Array.isArray(v.fora)) return v.fora.filter(t => TIPOS[t]);
  return Object.keys(TIPOS).filter(t => TIPOS[t].padrao === false);
}
// Os ligados de alguém: o que o cargo deixa, menos o que desligou.
const ligadosDe = (u, tiposSalvos) => { const fora = new Set(desligados(tiposSalvos)); return tiposDe(u).filter(t => !fora.has(t)); };
// Salvar a escolha: tudo o que a pessoa vê e não marcou fica desligado.
const guardarEscolha = (u, ligados) => JSON.stringify({ fora: tiposDe(u).filter(t => !(Array.isArray(ligados) ? ligados : PADRAO).includes(t)) });

// Para os testes: em vez de mandar de verdade, guarda o que seria enviado.
const enviadosTeste = [];
const modoTeste = process.env.NOTIFICACOES_TESTE === '1';

async function enviarUma(insc, carga) {
  if (modoTeste) {
    enviadosTeste.push({ usuario_id: insc.usuario_id, endpoint: insc.endpoint, ...carga });
    return true;
  }
  try {
    await webpush.sendNotification({ endpoint: insc.endpoint, keys: { p256dh: insc.p256dh, auth: insc.auth } }, JSON.stringify(carga), { TTL: 60 * 60 * 24 });
    return true;
  } catch (e) {
    // 404/410: a inscrição não existe mais (a pessoa desativou ou trocou de navegador). Sai da lista.
    if (e.statusCode === 404 || e.statusCode === 410) await db.run('DELETE FROM push_inscricoes WHERE id = ?', insc.id);
    else console.error('Notificação não enviada:', e.statusCode || e.message);
    return false;
  }
}

// Avisa quem ligou esse tipo e pode recebê-lo. Opções:
//   exceto: quem fez (não recebe o próprio aviso);
//   para: só essas pessoas (ids), por exemplo o dono do mural ou quem mandou o registro;
//   perm: só quem tem essa permissão (ex.: "guarda.aprovar" para o registro da Guarda).
//   Com "para" e "perm" juntos, vale quem está em um OU no outro (ex.: quem criou a atividade ou quem gerencia).
// carga: { titulo, corpo, url, tag }. Não espera nem derruba quem chamou.
function avisar(tipo, carga, { exceto = null, para = null, perm = null } = {}) {
  if ((!ativo && !modoTeste) || !TIPOS[tipo]) return;
  const alvo = para ? new Set(para.filter(x => x != null)) : null;
  (async () => {
    const lista = await db.all('SELECT * FROM push_inscricoes');
    const usuarios = new Map();
    let n = 0;
    for (const insc of lista) {
      if (insc.usuario_id === exceto) continue;
      if (!usuarios.has(insc.usuario_id)) usuarios.set(insc.usuario_id, await carregarUsuario(insc.usuario_id).catch(() => null));
      const u = usuarios.get(insc.usuario_id);
      if (!u || !u.ativo) continue;
      if (alvo || perm) {
        const naLista = alvo?.has(insc.usuario_id);
        const temPerm = perm && (u.is_root || u.permissoes.has(perm));
        if (!naLista && !temPerm) continue;
      }
      if (!ligadosDe(u, insc.tipos).includes(tipo)) continue;
      if (await enviarUma(insc, { tipo, icone: '/img/brasao.png', ...carga })) n++;
    }
    if (n) console.log(`Notificação "${tipo}" enviada para ${n} ${n === 1 ? 'aparelho' : 'aparelhos'}.`);
  })().catch(e => console.error('Erro ao notificar:', e.message));
}

async function inscrever(usuario, inscricao, tipos) {
  const endpoint = String(inscricao?.endpoint || '');
  const p256dh = String(inscricao?.keys?.p256dh || '');
  const auth = String(inscricao?.keys?.auth || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return false;
  await db.run(`INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, tipos) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, tipos = excluded.tipos`,
  usuario.id, endpoint, p256dh, auth, guardarEscolha(usuario, tipos));
  return true;
}

module.exports = {
  TIPOS, PADRAO, chaves, ativo: () => ativo || modoTeste, avisar, inscrever, enviarUma, enviadosTeste,
  podeTipo, tiposDe, ligadosDe, guardarEscolha,
};
