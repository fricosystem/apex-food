'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('modelo FCM usa coleção em português e hash determinístico do token', () => {
  const helper = ler('api/_lib/dispositivos-notificacao.js');
  assert.match(helper, /COLECAO_DISPOSITIVOS = 'dispositivosNotificacao'/);
  assert.match(helper, /createHash\('sha256'\)/);
  assert.match(helper, /slice\(0, 40\)/);
  assert.match(helper, /tokenFcm/);
  assert.doesNotMatch(helper, /deviceId|fingerprint|localStorage|sessionStorage/i);
});

test('registro FCM é limitado pela sessão ativa e grava somente pelo servidor', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const helper = ler('api/_lib/dispositivos-notificacao.js');
  assert.match(handler, /recurso === 'dispositivos'/);
  assert.match(handler, /obterIdentidadeOperacional/);
  assert.match(helper, /idRestaurante: identidade\.idRestaurante/);
  assert.match(helper, /idUsuario: identidade\.idUsuario/);
  assert.match(helper, /DISPOSITIVO_FORA_DO_ESCOPO/);
});

test('DTO de dispositivo nunca devolve token FCM ou hash privado', () => {
  const helper = ler('api/_lib/dispositivos-notificacao.js');
  const dto = helper.slice(helper.indexOf('function dtoDispositivo'), helper.indexOf('function validarPreferencias'));
  assert.doesNotMatch(dto, /tokenFcm/);
  assert.doesNotMatch(dto, /hashToken/);
  assert.match(dto, /statusDispositivo/);
  assert.match(dto, /preferencias/);
});

test('dispositivo possui estados, plataformas, origens, expiração e revogação controlados', () => {
  const helper = ler('api/_lib/dispositivos-notificacao.js');
  assert.match(helper, /android.*desktop.*tablet.*web/);
  assert.match(helper, /pwa.*navegador/);
  assert.match(helper, /ativo.*revogado/);
  assert.match(helper, /90 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(helper, /acao === 'revogar'/);
  assert.match(helper, /acao === 'reativar'/);
  assert.match(helper, /acao === 'preferencias'/);
});

test('endpoint consolidado aceita registro e mutação FCM sem criar nova função', () => {
  const endpoint = ler('api/v1/operacional.js');
  const handler = ler('api/_lib/notificacoes-handler.js');
  assert.match(endpoint, /notificacoes: require\('\.\.\/\_lib\/notificacoes-handler'\)/);
  assert.match(handler, /metodos: \['GET', 'POST', 'PATCH'\]/);
  assert.match(handler, /appCheck: true/);
  assert.match(handler, /registrarAuditoriaOperacional/);
});

test('configuração pública FCM contém somente Web config e VAPID pública', () => {
  const config = ler('configuracoes/firebase-messaging-publico.js');
  assert.match(config, /apexFirebaseMessagingConfig/);
  assert.match(config, /vapidKey/);
  assert.match(config, /projectId: 'apex-food-6c1cb'/);
  assert.doesNotMatch(config, /FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET|client_email|private_key/i);
});

test('controller registra token FCM com VAPID e backend same-origin', () => {
  const controller = ler('scripts/compartilhados/notificacoes-sistema.js');
  assert.match(controller, /getToken/);
  assert.match(controller, /vapidKey/);
  assert.match(controller, /serviceWorkerRegistration/);
  assert.match(controller, /registrarDispositivoNotificacao/);
  assert.match(controller, /plataformaAtual/);
  assert.match(controller, /origemAtual/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/i);
});

test('Service Worker trata FCM em segundo plano sem remover o fluxo local', () => {
  const serviceWorker = ler('service-worker.js');
  assert.match(serviceWorker, /firebase-messaging-compat\.js/);
  assert.match(serviceWorker, /onBackgroundMessage/);
  assert.match(serviceWorker, /self\.registration\.showNotification/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /self\.skipWaiting/);
});

test('shell e autenticação carregam configuração e controller FCM versionados', () => {
  const index = ler('index.html');
  const autenticacao = ler('paginas/autenticacao.html');
  assert.match(index, /firebase-messaging-publico\.js\?v=etapa11-fcm/);
  assert.match(index, /notificacoes-sistema\.js\?v=etapa11-fcm/);
  assert.match(autenticacao, /firebase-messaging-publico\.js\?v=etapa11-fcm/);
  assert.match(autenticacao, /notificacoes-sistema\.js\?v=etapa11-fcm/);
});

test('emissor FCM envia somente a dispositivos ativos e revoga tokens inválidos', () => {
  const emissor = ler('api/_lib/fcm-notificacoes.js');
  assert.match(emissor, /statusDispositivo', '==', 'ativo'/);
  assert.match(emissor, /preferencias\?\.operacionais !== false/);
  assert.match(emissor, /sendEachForMulticast/);
  assert.match(emissor, /registration-token-not-registered/);
  assert.match(emissor, /invalid-registration-token/);
  assert.match(emissor, /statusDispositivo: 'revogado'/);
  assert.match(emissor, /icon: '\/assets\/apex-food-logo-aprimorada\.png'/);
  assert.doesNotMatch(emissor, /FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET|localStorage|sessionStorage/i);
});

test('eventos operacionais chamam FCM depois da transação e preservam idempotência', () => {
  const qr = ler('api/_lib/qrcode-mesas.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  for (const arquivo of [qr, pedidos, financeiro]) {
    assert.match(arquivo, /enviarNotificacaoFcm/);
    assert.match(arquivo, /if \(!(?:repeticaoIdempotente|reutilizado)\)/);
  }
});

test('mutações de dispositivos FCM usam rate limit fail-closed', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  assert.match(handler, /consumir\(req, 'notificacoes_dispositivo', 30, 60 \* 1000\)/);
  assert.match(handler, /const \{ consumir \} = require\('\.\/limite'\)/);
});
