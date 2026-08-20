'use strict';

const CACHE_NAME = 'apex-food-notificacao-teste-etapa10';

self.addEventListener('install', (evento) => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil((async () => {
    const destino = new URL(evento.notification.data?.url || '/', self.location.origin).href;
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const clienteExistente = clientes.find(cliente => cliente.url.startsWith(self.location.origin));
    if (clienteExistente) {
      await clienteExistente.focus();
      if (clienteExistente.navigate) await clienteExistente.navigate(destino);
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(destino);
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'limpar-badge') {
    evento.waitUntil?.(Promise.resolve());
  }
});
