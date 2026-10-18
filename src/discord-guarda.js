// Convocação da Guarda no Discord: "preciso de guardas agora". A mensagem vai pelo mesmo tipo de webhook dos
// anúncios, com um link para o site; quem clicar entra na convocação e aperta "Compareci".
//
// Configuração no .env e no Render (sem webhook, nada é enviado e o site segue funcionando):
//   DISCORD_WEBHOOK_GUARDA   o webhook do canal da Guarda (se faltar, usa o dos anúncios)
//   DISCORD_CARGO_GUARDAS    o ID do cargo dos Guardas no Discord (para marcar @Guardas)
//   SITE_URL                 o endereço do site, para o link
const cfg = () => ({
  webhook: (process.env.DISCORD_WEBHOOK_GUARDA || process.env.DISCORD_WEBHOOK_ANUNCIOS || '').trim(),
  cargo: (process.env.DISCORD_CARGO_GUARDAS || '').trim(),
  site: (process.env.SITE_URL || process.env.VAPID_CONTATO || 'https://casa-luckham.onrender.com').replace(/\/+$/, ''),
});
const ativo = () => /^https?:\/\//.test(cfg().webhook);

const link = id => `${cfg().site}/#/guarda-escala/convocacao/${id}`;

function montar(conv, { encerrada = false } = {}) {
  const c = cfg();
  const embed = {
    title: encerrada ? '🛡️ Convocação encerrada' : '🛡️ A Guarda do Coelho é convocada!',
    url: link(conv.id),
    description: [conv.motivo, conv.local ? `📍 **Onde:** ${conv.local}` : '', encerrada ? '' : `Abra o link, confirme que foi convocado e aperte **Compareci** quando chegar.`].filter(Boolean).join('\n\n').slice(0, 4000),
    color: encerrada ? 0x6b6b6b : 0xc0553a,
    author: { name: `${conv.criada_por_nome || 'Comando da Guarda'}`.slice(0, 256) },
    footer: { text: 'Casa Luckham · Guarda do Coelho' },
  };
  return {
    content: !encerrada && c.cargo ? `<@&${c.cargo}>` : '',
    embeds: [embed],
    allowed_mentions: { parse: [], roles: !encerrada && c.cargo ? [c.cargo] : [] },
  };
}

async function chamar(metodo, sufixo, corpo, tentativa = 0) {
  const r = await fetch(`${cfg().webhook}${sufixo}`, {
    method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 429 && tentativa < 1) {
    const espera = Math.min(10, Number((await r.json().catch(() => ({}))).retry_after) || 2);
    await new Promise(ok => setTimeout(ok, espera * 1000));
    return chamar(metodo, sufixo, corpo, tentativa + 1);
  }
  if (r.status === 404 && metodo !== 'POST') return null;
  if (!r.ok) throw new Error(`Discord respondeu ${r.status}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Manda a convocação e devolve o id da mensagem (ou null se não deu). Nunca derruba o site.
async function enviar(conv) {
  if (!ativo()) return null;
  try { return (await chamar('POST', '?wait=true', montar(conv)))?.id || null; } catch (e) { console.error('Discord (convocação):', e.message); return null; }
}

async function encerrar(conv) {
  if (!ativo() || !conv.discord_msg) return;
  try { await chamar('PATCH', `/messages/${conv.discord_msg}`, montar(conv, { encerrada: true })); } catch (e) { console.error('Discord (encerrar):', e.message); }
}

module.exports = { ativo, enviar, encerrar, link };
