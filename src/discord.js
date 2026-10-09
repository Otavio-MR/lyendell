// Anúncios no Discord da Casa Luckham. Cada anúncio publicado no site vai para um canal do servidor por um
// webhook (o "bot" de mensagens do canal: Configurações do canal > Integrações > Webhooks), marcando quem
// precisa saber (@Moradores, @Aliados ou @everyone). Editar ou apagar o anúncio no site edita ou apaga a
// mensagem lá também. A imagem vai anexada (no site, as imagens só abrem para quem está logado).
//
// Configuração no .env e no Render (sem o webhook, nada é enviado):
//   DISCORD_WEBHOOK_ANUNCIOS  o endereço do webhook do canal (https://discord.com/api/webhooks/...)
//   DISCORD_CARGO_MORADORES   o ID do cargo dos Moradores no Discord (para marcar @Moradores)
//   DISCORD_CARGO_ALIADOS     o ID do cargo dos Aliados no Discord (para marcar @Aliados)
//   SITE_URL                  o endereço do site, para o link do anúncio (padrão: o do Render)
const { db } = require('./db');

const cfg = () => ({
  webhook: (process.env.DISCORD_WEBHOOK_ANUNCIOS || '').trim(),
  moradores: (process.env.DISCORD_CARGO_MORADORES || '').trim(),
  aliados: (process.env.DISCORD_CARGO_ALIADOS || '').trim(),
  site: (process.env.SITE_URL || process.env.VAPID_CONTATO || 'https://casa-luckham.onrender.com').replace(/\/+$/, ''),
});
const ativo = () => /^https?:\/\//.test(cfg().webhook);

// Quem marcar. "nao": não manda para o Discord; "ninguem": manda sem marcar ninguém.
const MARCAR = {
  nao: 'Não mandar para o Discord',
  ninguem: 'Mandar sem marcar ninguém',
  moradores: '@Moradores',
  aliados: '@Aliados',
  moradores_aliados: '@Moradores e @Aliados',
  todos: '@everyone (todo o servidor)',
};
// O padrão: anúncio aberto para os Aliados marca os dois; os outros, só os Moradores.
const marcarPadrao = aliados => (aliados ? 'moradores_aliados' : 'moradores');

// O que o formulário do site precisa saber (quais marcações dá para usar).
function opcoesParaOSite() {
  if (!ativo()) return null;
  const c = cfg();
  const tem = { moradores: !!c.moradores, aliados: !!c.aliados };
  return Object.entries(MARCAR)
    .filter(([k]) => (k === 'moradores' ? tem.moradores : k === 'aliados' ? tem.aliados : k === 'moradores_aliados' ? tem.moradores || tem.aliados : true))
    .map(([valor, nome]) => ({ valor, nome }));
}

function mencoes(marcar) {
  const c = cfg();
  const cargos = [];
  if ((marcar === 'moradores' || marcar === 'moradores_aliados') && c.moradores) cargos.push(c.moradores);
  if ((marcar === 'aliados' || marcar === 'moradores_aliados') && c.aliados) cargos.push(c.aliados);
  const todos = marcar === 'todos';
  return {
    texto: [todos ? '@everyone' : '', ...cargos.map(id => `<@&${id}>`)].filter(Boolean).join(' '),
    // Só pinga quem o site escolheu: um "@everyone" escrito no meio do texto não pinga ninguém.
    permitidas: { parse: todos ? ['everyone'] : [], roles: cargos },
  };
}

const ESTILO = {
  comum: { emoji: '📢', cor: 0xd8b13a, rotulo: '' },
  importante: { emoji: '⚠️', cor: 0xe08a2e, rotulo: 'Importante' },
  urgente: { emoji: '🚨', cor: 0xd8674a, rotulo: 'URGENTE' },
};

// O texto do anúncio já usa o mesmo jeito de escrever do Discord (**negrito**, *itálico*, ~~riscado~~,
// __sublinhado__, listas com "-"). Só os marcadores de lista que o Discord não entende viram "-".
function paraDiscord(texto) {
  return String(texto || '')
    .split('\n')
    .map(l => l.replace(/^(\s*)[•·▪◦]\s+/, '$1- '))
    .join('\n')
    .slice(0, 4000);
}

async function montar(a) {
  const c = cfg();
  const e = ESTILO[a.importancia] || ESTILO.comum;
  const m = mencoes(a.discord_marcar || marcarPadrao(a.aliados));
  const embed = {
    title: `${e.emoji} ${a.titulo}`.slice(0, 256),
    url: `${c.site}/#/anuncios`,
    description: paraDiscord(a.conteudo) || undefined,
    color: e.cor,
    author: { name: `${a.autor_nome || 'Casa Luckham'}${e.rotulo ? ` · ${e.rotulo}` : ''}`.slice(0, 256) },
    footer: { text: `Casa Luckham · Mural de Anúncios${a.aliados ? ' · Aberto para Convidados e Aliados' : ''}` },
    timestamp: new Date(`${String(a.criado_em).replace(' ', 'T')}Z`).toISOString(),
  };
  let arquivo = null;
  const nome = String(a.imagem || '').match(/^\/uploads\/([\w.-]+)$/)?.[1];
  if (nome) {
    const l = await db.get('SELECT tipo, dados FROM arquivos WHERE nome = ?', nome);
    if (l) {
      const ext = (l.tipo.split('/')[1] || 'png').replace('jpeg', 'jpg');
      arquivo = { nome: `anuncio.${ext}`, tipo: l.tipo, dados: Buffer.from(l.dados) };
      embed.image = { url: `attachment://${arquivo.nome}` };
    }
  }
  const payload = { content: m.texto, embeds: [embed], allowed_mentions: m.permitidas };
  // Sem imagem, a lista vazia tira o anexo antigo quando o anúncio é editado.
  payload.attachments = arquivo ? [{ id: 0, filename: arquivo.nome }] : [];
  return { payload, arquivo };
}

// Uma chamada ao webhook (com o anexo, se tiver). Espera e tenta de novo uma vez se o Discord pedir calma.
async function chamar(metodo, sufixo, corpo, tentativa = 0) {
  const url = `${cfg().webhook}${sufixo}`;
  let opcoes = { method: metodo };
  if (corpo) {
    if (corpo.arquivo) {
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify(corpo.payload));
      fd.append('files[0]', new Blob([corpo.arquivo.dados], { type: corpo.arquivo.tipo }), corpo.arquivo.nome);
      opcoes.body = fd;
    } else {
      opcoes = { ...opcoes, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo.payload) };
    }
  }
  const r = await fetch(url, opcoes);
  if (r.status === 429 && tentativa < 1) {
    const espera = Math.min(10, Number((await r.json().catch(() => ({}))).retry_after) || 2);
    await new Promise(ok => setTimeout(ok, espera * 1000));
    return chamar(metodo, sufixo, corpo, tentativa + 1);
  }
  if (r.status === 404 && metodo !== 'POST') return null; // a mensagem foi apagada no Discord
  if (!r.ok) throw new Error(`Discord respondeu ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

const lerAnuncio = id => db.get('SELECT * FROM anuncios WHERE id = ?', id);

// Publica (ou atualiza) a mensagem do anúncio, conforme a escolha de quem publicou. Nunca derruba o site:
// se o Discord falhar, fica só o registro no log.
function sincronizar(id) {
  if (!ativo()) return Promise.resolve();
  return (async () => {
    const a = await lerAnuncio(id);
    if (!a) return;
    const marcar = a.discord_marcar || marcarPadrao(a.aliados);
    if (marcar === 'nao') {
      if (a.discord_msg) {
        await chamar('DELETE', `/messages/${a.discord_msg}`);
        await db.run('UPDATE anuncios SET discord_msg = NULL WHERE id = ?', id);
      }
      return;
    }
    const corpo = await montar(a);
    if (a.discord_msg) {
      const r = await chamar('PATCH', `/messages/${a.discord_msg}`, corpo);
      if (r) return;
      // Apagaram a mensagem no Discord: manda de novo.
    }
    const msg = await chamar('POST', '?wait=true', corpo);
    if (msg?.id) await db.run('UPDATE anuncios SET discord_msg = ? WHERE id = ?', String(msg.id), id);
  })().catch(e => console.error('Anúncio no Discord:', e.message));
}

function apagar(discordMsg) {
  if (!ativo() || !discordMsg) return Promise.resolve();
  return chamar('DELETE', `/messages/${discordMsg}`).catch(e => console.error('Apagar anúncio no Discord:', e.message));
}

module.exports = { ativo, MARCAR, marcarPadrao, opcoesParaOSite, sincronizar, apagar, paraDiscord, mencoes };
