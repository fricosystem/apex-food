'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('endpoint QR aplica rate limit por operação pública', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /require\('\.\.\/\_lib\/limite'\)/);
  assert.match(endpoint, /async function limitarAcaoPublica/);
  assert.match(endpoint, /`qrcode\.\$\{acao\}`/);
  assert.match(endpoint, /validar: \[30, 60_000\]/);
  assert.match(endpoint, /abrir: \[10, 60_000\]/);
  assert.match(endpoint, /pedido: \[20, 60_000\]/);
  assert.match(endpoint, /await limitarAcaoPublica\(req, 'cardapio'\)/);
  assert.match(endpoint, /await limitarAcaoPublica\(req, 'comanda'\)/);
});

test('rate limit fail-closed continua exigindo provedor distribuído fora de Development', () => {
  const limite = ler('api/_lib/limite.js');
  assert.match(limite, /ambienteExigeDistribuido/);
  assert.match(limite, /LIMITE_NAO_CONFIGURADO/);
  assert.match(limite, /LIMITE_NAO_DISPONIVEL/);
  assert.match(limite, /chavePseudonimizada/);
  assert.doesNotMatch(limite, /console\.log\(.*ip/i);
});

test('cliente público interpreta limites 429/503 sem expor detalhes internos', () => {
  const mesa = ler('scripts/publico/mesa.js');
  assert.match(mesa, /aguardeSegundos/);
  assert.match(mesa, /Muitas tentativas em sequência/);
  assert.match(mesa, /temporariamente indisponível/);
  assert.match(mesa, /idRequisicao/);
  assert.doesNotMatch(mesa, /console\.log\(.*token|console\.log\(.*cookie/i);
});

test('polling da mesa usa timeout com jitter, backoff e pausa por visibilidade', () => {
  const mesa = ler('scripts/publico/mesa.js');
  assert.match(mesa, /agendarPolling/);
  assert.match(mesa, /Math\.random\(\)/);
  assert.match(mesa, /Math\.min\(60000/);
  assert.match(mesa, /document\.hidden/);
  assert.match(mesa, /visibilitychange/);
  assert.match(mesa, /clearTimeout/);
  assert.doesNotMatch(mesa, /setInterval\(\(\) => atualizarComanda/);
});

test('polling interrompe ao perder sessão e não confirma operação visualmente', () => {
  const mesa = ler('scripts/publico/mesa.js');
  assert.match(mesa, /estado\.pollingAtivo = false/);
  assert.match(mesa, /mostrarErro\(erro\.message/);
  assert.match(mesa, /return false/);
  assert.match(mesa, /chaveIdempotencia\('pedido-mesa'\)/);
});

test('mutação continua protegida por CSRF e sem armazenamento local', () => {
  const mesa = ler('scripts/publico/mesa.js');
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(mesa, /X-CSRF-Token/);
  assert.match(endpoint, /mutacao: metodo === 'POST'/);
  assert.doesNotMatch(mesa, /localStorage|sessionStorage|deviceId|fingerprint/i);
});

test('versionamento da Etapa 9 preserva os contratos anteriores das telas administrativas', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /mesa[^\n]*etapa8-seguranca/);
  assert.match(shell, /historico-pedidos[^\n]*etapa7-historico/);
  assert.match(shell, /fechamento-caixa[^\n]*etapa7-historico/);
  assert.match(index, /apex-shell\.js\?v=etapa16-visao/);
});
