'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('painel de notificações mantém shell único e adiciona abas de atualizações e dispositivos', () => {
  const controller = ler('scripts/compartilhados/notificacoes.js');
  assert.match(controller, /data-aba-notificacoes="atualizacoes"/);
  assert.match(controller, /data-aba-notificacoes="dispositivos"/);
  assert.match(controller, /listaDispositivosApex/);
  assert.match(controller, /painelNotificacoesApex/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET|tokenFcm/i);
});

test('painel consulta dispositivos pelo cliente same-origin e não expõe token', () => {
  const controller = ler('scripts/compartilhados/notificacoes.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(controller, /listarDispositivosNotificacao/);
  assert.match(controller, /atualizarDispositivoNotificacao/);
  assert.match(controller, /testarDispositivoNotificacao/);
  assert.match(cliente, /recurso: 'dispositivos'/);
  assert.match(cliente, /X-CSRF-Token/);
  assert.doesNotMatch(controller, /getToken|vapidKey|firebase/i);
});

test('administração permite teste controlado, preferências, revogação e reativação com mensagens profissionais', () => {
  const controller = ler('scripts/compartilhados/notificacoes.js');
  assert.match(controller, /Alertas operacionais/);
  assert.match(controller, /Avisos do sistema/);
  assert.match(controller, /data-teste-dispositivo/);
  assert.match(controller, /Enviar teste/);
  assert.match(controller, /data-acao-dispositivo/);
  assert.match(controller, /Revogar este dispositivo/);
  assert.match(controller, /Reativar este dispositivo/);
  assert.match(controller, /Nenhum dispositivo registrado/);
  assert.match(controller, /Último teste aceito/);
  assert.match(controller, /falha\(s\) consecutiva\(s\)/);
  assert.match(controller, /ultimaEntregaEm/);
});

test('renderização usa apenas metadados públicos do dispositivo', () => {
  const controller = ler('scripts/compartilhados/notificacoes.js');
  assert.match(controller, /plataforma/);
  assert.match(controller, /origem/);
  assert.match(controller, /ultimoUsoEm/);
  assert.doesNotMatch(controller, /tokenFcm|hashToken|userAgent|deviceId|fingerprint/i);
});
