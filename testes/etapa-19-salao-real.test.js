'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Fase 7 amplia o handler de Salão com mesas e transições de reservas', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /async function criarMesa/);
  assert.match(handler, /MESA_DUPLICADA/);
  assert.match(handler, /nomeNormalizado/);
  assert.match(handler, /TRANSICOES_RESERVA/);
  assert.match(handler, /eventosMesas/);
});

test('cliente same-origin possui operações explícitas de Mesas e Reservas', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /criarMesa/);
  assert.match(cliente, /atualizarReserva/);
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage/);
});

test('bridges de Salão iniciam vazios e carregam somente dados reais', () => {
  const mesas = ler('scripts/salao/dados-mesas.js');
  const reservas = ler('scripts/salao/dados-reservas.js');
  assert.match(mesas, /window\.dadosMesas = \[\]/);
  assert.match(reservas, /window\.dadosReservasApexFood = \[\]/);
  assert.doesNotMatch(mesas, /dadosMesasPreview|ambienteMesasLocal|localhost/);
  assert.doesNotMatch(reservas, /dadosReservasPreview|ambienteReservasLocal|localhost/);
  assert.match(mesas, /modulos-client\.js\?v=etapa21-salao-tempo-real/);
  assert.match(reservas, /modulos-client\.js\?v=etapa21-salao-tempo-real/);
});

test('controllers de Salão usam operações persistidas e não mantêm placeholders', () => {
  const mapa = ler('scripts/salao/mapa-mesas.js');
  const reservas = ler('scripts/salao/reservas.js');
  const configuracao = ler('scripts/salao/configuracao-mesas.js');
  assert.match(mapa, /atualizarSalao/);
  assert.match(reservas, /criarReserva/);
  assert.match(reservas, /atualizarReserva/);
  assert.match(configuracao, /criarMesa/);
  assert.match(configuracao, /atualizarSalao/);
  for (const controller of [mapa, reservas, configuracao]) {
    assert.doesNotMatch(controller, /salva no preview|salvas no preview|preparada para integração|preparado para integração/);
  }
});

test('shell preserva Salão e versiona Mapa de Mesas na Etapa 6', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /mapa-mesas\.html\?v=etapa21-salao-tempo-real/);
  assert.match(shell, /reservas\.html\?v=etapa21-salao-tempo-real/);
  assert.match(shell, /configuracao-mesas\.html\?v=etapa21-salao-tempo-real/);
  assert.match(shell, /scripts\/salao\/dados-mesas\.js\?v=etapa21-salao-tempo-real/);
  assert.match(shell, /scripts\/salao\/dados-reservas\.js\?v=etapa21-salao-tempo-real/);
});
