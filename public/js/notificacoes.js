// Notificações no celular/PC (Web Push): ativar neste aparelho, escolher o que receber, testar e desativar.
// O aviso chega pelo service worker (/sw.js), mesmo com o site fechado.
import { h, trocar, icone, botao, aviso, api, interruptor } from './core.js';

const suporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let registro = null;
// Registra o service worker uma vez (o app chama ao abrir o site).
export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    registro = await navigator.serviceWorker.register('/sw.js');
    // Tocou na notificação com o site aberto: vai para a página do aviso.
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.abrir) location.href = e.data.abrir; });
  } catch (e) {
    console.warn('Service worker não registrado:', e.message);
  }
  return registro;
}

// Sem esperar o service worker ficar pronto (em navegador que não deixa registrar, isso nunca acontece).
async function registroAtual() {
  return registro || await navigator.serviceWorker.getRegistration().catch(() => null) || null;
}
async function inscricaoAtual() {
  const reg = await registroAtual();
  return reg ? reg.pushManager.getSubscription() : null;
}

// A chave pública vem em base64url; o navegador quer os bytes.
function bytesDaChave(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function ativarNotificacoes(tipos) {
  const d = await api('GET', '/api/notificacoes');
  if (!d.ativo || !d.chave) throw new Error('As notificações ainda não foram ligadas no servidor.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('O navegador não deixou mandar notificações. Libere nas configurações do site e tente de novo.');
  const reg = await registroAtual() || await registrarServiceWorker();
  if (!reg) throw new Error('Este navegador não deixou ligar as notificações. Tente o Chrome, o Edge ou o Firefox.');
  if (!reg.active) await navigator.serviceWorker.ready;
  let insc = await reg.pushManager.getSubscription();
  if (!insc) insc = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(d.chave) });
  await api('POST', '/api/notificacoes/inscrever', { inscricao: insc.toJSON(), tipos });
}

export async function desativarNotificacoes() {
  const insc = await inscricaoAtual();
  if (!insc) return;
  await api('POST', '/api/notificacoes/sair', { endpoint: insc.endpoint }).catch(() => {});
  await insc.unsubscribe().catch(() => {});
}

// Já está recebendo neste aparelho?
export async function notificacoesAtivas() {
  if (!suporta() || Notification.permission !== 'granted') return false;
  const insc = await inscricaoAtual().catch(() => null);
  return !!insc;
}

// O painel (no perfil e na tela inicial): explica, ativa, escolhe os tipos, testa e desativa.
export function painelNotificacoes({ compacto = false, aoMudar } = {}) {
  const el = h('section', { class: `painel notif-painel ${compacto ? 'compacto' : ''}`.trim() });

  async function desenhar() {
    if (!suporta()) {
      trocar(el, cab(), h('p', { class: 'suave' }, ehIphone() && !instalado()
        ? 'No iPhone: toque em Compartilhar e em "Adicionar à Tela de Início". Abra o site por esse ícone e ative aqui.'
        : 'Este navegador não recebe notificações. Tente o Chrome, o Edge ou o Firefox.'));
      return;
    }
    let d;
    let insc = null;
    try {
      insc = await inscricaoAtual().catch(() => null);
      d = await api('GET', `/api/notificacoes${insc ? `?endpoint=${encodeURIComponent(insc.endpoint)}` : ''}`);
    } catch {
      trocar(el, cab(), h('p', { class: 'suave' }, 'Não deu para ver as notificações agora.'));
      return;
    }
    if (!d.ativo) {
      trocar(el, cab(), h('p', { class: 'suave' }, 'As notificações ainda não foram ligadas no servidor.'));
      return;
    }
    const ligado = !!insc && d.inscrito && Notification.permission === 'granted';
    const escolhidos = new Set(d.escolhidos);
    const bloqueado = Notification.permission === 'denied';
    trocar(el,
      cab(ligado),
      !ligado && h('p', { class: 'suave' }, 'Receba um aviso no celular ou no computador quando sair um anúncio, alguém for procurado ou banido da Capital, uma lei nova, um pedido de ajuda ou um recado para você, e também os avisos do seu cargo (como registros para aprovar). Chega mesmo com o site fechado.'),
      bloqueado && h('p', { class: 'nota' }, icone('alerta'), 'O navegador está bloqueando as notificações deste site. Libere nas configurações do site (o cadeado ao lado do endereço) e volte aqui.'),
      ehIphone() && !instalado() && h('p', { class: 'suave' }, 'No iPhone, primeiro adicione o site à Tela de Início (Compartilhar > Adicionar à Tela de Início) e abra por lá.'),
      (!compacto || ligado) && h('div', { class: 'notif-tipos' },
        // Os de todo morador e, separados, os do cargo da pessoa (cada cargo vê os seus).
        [['Para todos', d.tipos.filter(t => !t.cargo)], ['Do seu cargo', d.tipos.filter(t => t.cargo)]].filter(([, l]) => l.length).map(([titulo, lista]) => [
          h('h3', { class: 'notif-grupo' }, titulo),
          lista.map(t => interruptor(t.nome, escolhidos.has(t.id), async v => {
            if (v) escolhidos.add(t.id); else escolhidos.delete(t.id);
            if (ligado) await api('PUT', '/api/notificacoes/tipos', { endpoint: insc.endpoint, tipos: [...escolhidos] }).catch(x => aviso(x.message, 'erro'));
          })),
        ]),
        h('small', { class: 'suave' }, 'Mensagens do chat não viram notificação.')),
      h('div', { class: 'notif-botoes' },
        ligado
          ? [botao('Mandar um teste', { icone: 'enviar', onclick: async () => {
            try { await api('POST', '/api/notificacoes/teste', { endpoint: insc.endpoint }); aviso('Aviso de teste enviado. Deve aparecer em instantes.'); } catch (x) { aviso(x.message, 'erro'); }
          } }),
          botao('Desativar neste aparelho', { onclick: async () => { await desativarNotificacoes(); aviso('Notificações desativadas neste aparelho.'); desenhar(); aoMudar?.(false); } })]
          : botao('Ativar notificações', { icone: 'alerta', classe: 'btn-ouro', desativado: bloqueado, onclick: async ev => {
            ev.currentTarget.disabled = true;
            try {
              await ativarNotificacoes([...escolhidos]);
              aviso('Pronto! Os avisos de Lyendell vão chegar neste aparelho.');
              aoMudar?.(true);
            } catch (x) { aviso(x.message || 'Não deu para ativar.', 'erro'); }
            desenhar();
          } }),
        compacto && !ligado && botao('Agora não', { classe: 'btn-fantasma', onclick: () => { try { localStorage.setItem('notif-dispensado', '1'); } catch { /* sem armazenamento */ } el.remove(); } })),
      d.aparelhos > (ligado ? 1 : 0) && h('small', { class: 'suave' }, `Ativo em ${d.aparelhos} ${d.aparelhos === 1 ? 'aparelho' : 'aparelhos'} seus.`));
  }
  const cab = (ligado = false) => h('div', { class: 'painel-cab' }, h('h2', null, icone('alerta'), ligado ? 'Notificações ligadas neste aparelho' : 'Notificações no celular e no PC'));
  trocar(el, cab(), h('p', { class: 'suave' }, 'Carregando...'));
  desenhar();
  return el;
}

// Na tela inicial: o convite aparece até a pessoa ativar ou dispensar.
export async function conviteNotificacoes() {
  if (!suporta()) return null;
  try { if (localStorage.getItem('notif-dispensado')) return null; } catch { /* sem armazenamento */ }
  if (await notificacoesAtivas()) return null;
  return painelNotificacoes({ compacto: true, aoMudar: ligado => { if (ligado) document.querySelector('.notif-painel.compacto')?.remove(); } });
}
