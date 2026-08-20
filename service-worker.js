'use strict';

const CACHE_NAME = 'apex-food-notificacao-teste-etapa10';
const FIREBASE_SDK = '12.1.0';
const FIREBASE_PUBLIC_CONFIG = {
  apiKey: 'AIzaSyBmEaHXaK6fF541AzXlFn2BQ-CA91axlDo',
  authDomain: 'apex-food-6c1cb.firebaseapp.com',
  projectId: 'apex-food-6c1cb',
  storageBucket: 'apex-food-6c1cb.firebasestorage.app',
  messagingSenderId: '771860546633',
  appId: '1:771860546633:web:4e609e3c334ed02d352b98',
};

let firebaseMessaging = null;
try {
  importScripts(
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/firebase-messaging-compat.js`,
  );
  firebase.initializeApp(FIREBASE_PUBLIC_CONFIG);
  firebaseMessaging = firebase.messaging();
} catch {
  firebaseMessaging = null;
}

if (firebaseMessaging) {
  firebaseMessaging.onBackgroundMessage((payload) => {
    const notification = payload?.notification || {};
    const dados = payload?.data || {};
    const titulo = notification.title || dados.titulo || 'APEX Food';
    const corpo = notification.body || dados.mensagem || 'Há uma atualização operacional.';
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: notification.icon || '/assets/apex-food-logo-aprimorada.png',
      badge: notification.badge || '/assets/apex-food-logo-aprimorada.png',
      tag: `apex-food-real-${dados.idNotificacao || Date.now()}`,
      data: { url: dados.url || '/' },
    });
  });
}

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
