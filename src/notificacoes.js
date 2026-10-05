// Notificações no celular e no PC (Web Push): quem ativa no site recebe um aviso do sistema mesmo com o site
// fechado, quando sai um anúncio, um procurado ou banido, uma lei nova ou uma atividade.
// As chaves (VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTATO) ficam no .env e no Render; sem elas, nada é enviado.
const webpush = require('web-push');
const { db } = require('./db');
const { carregarUsuario } = require('./auth');

// Os tipos de aviso que cada um escolhe receber, e quem pode receber cada um.
const TIPOS = {
  anuncios: { nome: 'Anúncios novos no mural', perm: 'anuncios.ver' },
  procurados: { nome: 'Procurados e banidos da Capital', perm: 'guarda.ver' },
  leis: { nome: 'Leis de Lyendell publicadas', perm: 'leis.ver' },
  atividades: { nome: 'Atividades novas (pedidos de ajuda)', perm: 'atividades.ver' },
};
const PADRAO = Object.keys(TIPOS);

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

const tiposValidos = lista => (Array.isArray(lista) ? [...new Set(lista.filter(t => TIPOS[t]))] : PADRAO);

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

// Avisa todo mundo que escolheu esse tipo e pode ver aquilo (menos quem fez, se "exceto" vier).
// carga: { titulo, corpo, url, tag }. Não espera nem derruba quem chamou.
function avisar(tipo, carga, { exceto = null } = {}) {
  if ((!ativo && !modoTeste) || !TIPOS[tipo]) return;
  (async () => {
    const lista = await db.all('SELECT * FROM push_inscricoes');
    const permissoes = new Map();
    let n = 0;
    for (const insc of lista) {
      if (insc.usuario_id === exceto) continue;
      if (!tiposValidos(JSON.parse(insc.tipos || 'null')).includes(tipo)) continue;
      if (!permissoes.has(insc.usuario_id)) {
        const u = await carregarUsuario(insc.usuario_id).catch(() => null);
        permissoes.set(insc.usuario_id, !!u && u.ativo && (u.is_root || u.permissoes.has(TIPOS[tipo].perm)));
      }
      if (!permissoes.get(insc.usuario_id)) continue;
      if (await enviarUma(insc, { tipo, icone: '/img/brasao.png', ...carga })) n++;
    }
    if (n) console.log(`Notificação "${tipo}" enviada para ${n} ${n === 1 ? 'aparelho' : 'aparelhos'}.`);
  })().catch(e => console.error('Erro ao notificar:', e.message));
}

async function inscrever(usuarioId, inscricao, tipos) {
  const endpoint = String(inscricao?.endpoint || '');
  const p256dh = String(inscricao?.keys?.p256dh || '');
  const auth = String(inscricao?.keys?.auth || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return false;
  await db.run(`INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, tipos) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, tipos = excluded.tipos`,
  usuarioId, endpoint, p256dh, auth, JSON.stringify(tiposValidos(tipos)));
  return true;
}

module.exports = { TIPOS, PADRAO, chaves, ativo: () => ativo || modoTeste, avisar, inscrever, enviarUma, tiposValidos, enviadosTeste };
