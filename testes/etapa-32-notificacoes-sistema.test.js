'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('manifest e Service Worker preservam o ícone oficial do PWA', () => {
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  const serviceWorker = ler('service-worker.js');
  const sistema = ler('scripts/compartilhados/notificacoes-sistema.js');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.src === '/assets/apex-food-logo-aprimorada.png'));
  assert.match(serviceWorker, /notificationclick/);
  assert.match(sistema, /icone: '\/assets\/apex-food-logo-aprimorada\.png'/);
  assert.match(sistema, /badge: '\/assets\/apex-food-logo-aprimorada\.png'/);
});

test('controlador registra Service Worker e envia notificação pela API do PWA', () => {
  const sistema = ler('scripts/compartilhados/notificacoes-sistema.js');
  assert.match(sistema, /navigator\.serviceWorker\.register\(`\/service-worker\.js\?v=\$\{CONFIG\.versao\}`/);
  assert.match(sistema, /Notification\.requestPermission/);
  assert.match(sistema, /registro\.showNotification/);
  assert.match(sistema, /navigator\.setAppBadge/);
  assert.match(sistema, /tag: `apex-food-teste-\$\{origem\}`/);
  assert.match(sistema, /requireInteraction: false/);
  assert.doesNotMatch(sistema, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|CSRF_SECRET|SESSION_SECRET|idToken|refreshToken/i);
});

test('notificação somente acompanha sessão autenticada e marcador temporário de login', () => {
  const guard = ler('scripts/auth/sessao-guard.js');
  const auth = ler('scripts/auth/auth.js');
  const sistema = ler('scripts/compartilhados/notificacoes-sistema.js');
  assert.match(guard, /apex:sessao-autenticada/);
  assert.match(guard, /possuiRestauranteAtivo/);
  assert.match(auth, /solicitarNotificacaoDeLogin/);
  assert.match(auth, /finishRedirect\('login'\)/);
  assert.match(auth, /apexNotificacoesSistema\?\.solicitarPermissao/);
  assert.match(sistema, /apex-notificacao/);
  assert.match(sistema, /origem === 'login'/);
});

test('autenticação e shell carregam o controller sem duplicar navegação', () => {
  const autenticacao = ler('paginas/autenticacao.html');
  const index = ler('index.html');
  assert.match(autenticacao, /notificacoes-sistema\.js\?v=etapa11-fcm/);
  assert.match(index, /notificacoes-sistema\.js\?v=etapa11-fcm/);
  assert.match(index, /notificacoes-sistema\.js\?v=etapa11-fcm/);
  assert.equal((index.match(/id="sidebarContentDesktop"/g) || []).length, 1);
  assert.equal((index.match(/id="conteudoPagina"/g) || []).length, 1);
});

test('service worker não processa credenciais nem cria notificações operacionais reais', () => {
  const serviceWorker = ler('service-worker.js');
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /clients\.openWindow/);
  assert.doesNotMatch(serviceWorker, /FIREBASE_PRIVATE_KEY|CSRF_SECRET|SESSION_SECRET|localStorage|sessionStorage|idToken|refreshToken/i);
  assert.doesNotMatch(serviceWorker, /pedidos|comandas|cozinha|caixa/i);
});
