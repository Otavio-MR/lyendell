// Service worker da Casa Luckham: recebe os avisos (Web Push) mesmo com o site fechado e abre a página certa
// quando a pessoa toca na notificação. Não guarda o site em cache (o site sempre vem novo do servidor).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'Casa Luckham';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: d.corpo || '',
    icon: d.icone || '/img/brasao.png',
    badge: '/img/favicon.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/#/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#/', self.location.origin).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        return c.navigate(url).catch(() => c.postMessage({ abrir: url }));
      }
    }
    return self.clients.openWindow(url);
  })());
});
