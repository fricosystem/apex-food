'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('diagnóstico FCM usa estados públicos em português e DTO mínimo', () => {
  const emissor = ler('api/_lib/fcm-notificacoes.js');
  const dispositivos = ler('api/_lib/dispositivos-notificacao.js');
  assert.match(emissor, /sem_teste.*enviado.*falhou.*revogado.*indisponivel/);
  assert.match(emissor, /ultimoResultadoEntrega/);
  assert.match(emissor, /falhasConsecutivas/);
  assert.match(dispositivos, /ultimoResultadoEntrega/);
  assert.match(dispositivos, /ultimaEntregaEm/);
  assert.doesNotMatch(emissor, /tokenFcm.*registrosEntregasNotificacao/);
});

test('resumo de entrega preserva quantidades e retenção sem códigos brutos', () => {
  const emissor = ler('api/_lib/fcm-notificacoes.js');
  assert.match(emissor, /registrosEntregasNotificacao/);
  assert.match(emissor, /quantidadeTentativas/);
  assert.match(emissor, /quantidadeAceita/);
  assert.match(emissor, /quantidadeFalha/);
  assert.match(emissor, /quantidadeRevogada/);
  assert.match(emissor, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(emissor, /codigoErro|error\.message|tokenFcm.*quantidade/);
});

test('consulta de diagnóstico exige papel de gestão e usa caminho tenant-aware', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(handler, /recurso === 'entregas'/);
  assert.match(handler, /exigirPapel\(identidade, PAPEIS_GESTAO\)/);
  assert.match(handler, /listarRegistrosEntrega/);
  assert.match(cliente, /listarDiagnosticoNotificacao/);
  assert.match(cliente, /recurso: 'entregas'/);
});

test('teste controlado informa resultado FCM e atualiza diagnóstico sem mudar operação do restaurante', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const emissor = ler('api/_lib/fcm-notificacoes.js');
  assert.match(handler, /FCM_INDISPONIVEL/);
  assert.match(handler, /DISPOSITIVO_SEM_NOTIFICACAO/);
  assert.match(handler, /enviados/);
  assert.match(emissor, /atualizarDiagnostico/);
  assert.match(emissor, /diagnostico\.batch\.commit/);
  assert.doesNotMatch(handler, /pedidos|comandas|fichasCozinha|mesas/);
});
