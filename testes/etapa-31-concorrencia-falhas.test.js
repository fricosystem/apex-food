'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('operações críticas usam transação e idempotência server-side', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  const notificacoes = ler('api/_lib/notificacoes-handler.js');
  for (const arquivo of [qrcode, pedidos, financeiro, notificacoes]) assert.match(arquivo, /chavesIdempotencia/);
  for (const arquivo of [qrcode, pedidos, financeiro, notificacoes]) assert.match(arquivo, /runTransaction/);
  assert.match(financeiro, /executarIdempotente/);
  assert.match(pedidos, /repeticaoIdempotente/);
  assert.match(notificacoes, /IDEMPOTENCIA_REUTILIZADA/);
});

test('reutilização da chave com payload diferente é tratada como conflito', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  const notificacoes = ler('api/_lib/notificacoes-handler.js');
  for (const arquivo of [qrcode, pedidos, financeiro, notificacoes]) {
    assert.match(arquivo, /hashPayload/);
    assert.match(arquivo, /IDEMPOTENCIA_REUTILIZADA/);
  }
  assert.match(financeiro, /chaveResumo/);
});

test('transições QR rejeitam estado anterior incompatível e não fazem salto de fluxo', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /TRANSICAO_INVALIDA/);
  assert.match(pedidos, /PEDIDO_NAO_ENCONTRADO/);
  assert.match(pedidos, /COMANDA_NAO_ENCONTRADA/);
  assert.match(pedidos, /COMANDA_ENCERRADA/);
  assert.match(pedidos, /COMANDA_COM_PEDIDOS_PENDENTES/);
});

test('caixa rejeita recebimento ou conclusão fora da ordem e verifica comanda, mesa e pedidos', () => {
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(financeiro, /TRANSICAO_CAIXA_INVALIDA/);
  assert.match(financeiro, /ENCAMINHAMENTO_NAO_ENCONTRADO/);
  assert.match(financeiro, /COMANDA_NAO_ENCONTRADA/);
  assert.match(financeiro, /MESA_NAO_ENCONTRADA/);
  assert.match(financeiro, /COMANDA_COM_PEDIDOS_PENDENTES/);
  assert.match(financeiro, /runTransaction\(async \(transacao/);
});

test('endpoint operacional preserva origem, método, CSRF e App Check administrativo', () => {
  const operacional = ler('api/v1/operacional.js');
  const middleware = ler('api/_lib/middleware.js');
  const notificacoes = ler('api/_lib/notificacoes-handler.js');
  assert.match(operacional, /notificacoes: require/);
  assert.match(middleware, /validarOrigem/);
  assert.match(middleware, /validarTokenCsrf/);
  assert.match(middleware, /verificarAppCheck/);
  assert.match(middleware, /exigirMetodo/);
  assert.match(notificacoes, /obterIdentidadeOperacional\(req, PAPEIS_NOTIFICACOES_LEITURA\)/);
});

test('rate limit e sessão pública continuam separados das operações administrativas', () => {
  const qr = ler('api/v1/qrcode-mesa.js');
  const limite = ler('api/_lib/limite.js');
  assert.match(qr, /limitarAcaoPublica/);
  assert.match(qr, /qrcode\.\$\{acao\}/);
  assert.match(qr, /appCheck:\s*false/);
  assert.match(limite, /ambienteExigeDistribuido/);
  assert.match(limite, /LIMITE_NAO_CONFIGURADO/);
});

test('notificações não podem ser fabricadas, movidas entre tenants ou lidas por papel incompatível', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const helper = ler('api/_lib/notificacoes.js');
  assert.match(handler, /identidade\.idRestaurante/);
  assert.match(handler, /papelDestino/);
  assert.match(handler, /idUsuarioDestino/);
  assert.match(handler, /NOTIFICACAO_NAO_ENCONTRADA/);
  assert.match(handler, /NOTIFICACAO_FORA_DO_ESCOPO/);
  assert.match(handler, /caminhoRestaurante\(identidade\.idRestaurante\)/);
  assert.match(helper, /expiraEm/);
  assert.doesNotMatch(handler, /req\.body\.idRestaurante/);
});

test('frontend não usa armazenamento local ou credenciais para repetir operações', () => {
  const arquivos = [
    ler('scripts/api/modulos-client.js'),
    ler('scripts/compartilhados/notificacoes.js'),
    ler('scripts/publico/mesa.js'),
  ];
  for (const arquivo of arquivos) {
    assert.doesNotMatch(arquivo, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|deviceId|fingerprint/i);
  }
});
