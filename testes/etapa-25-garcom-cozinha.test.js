'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('handler preserva pedidos legados e reconhece a máquina de estados QR', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /pedidoPublicoQr/);
  assert.match(handler, /TRANSICOES_QR/);
  assert.match(handler, /aguardando_confirmacao_garcom/);
  assert.match(handler, /confirmado_garcom/);
  assert.match(handler, /enviado_cozinha/);
  assert.match(handler, /em_preparo/);
  assert.match(handler, /servido/);
  assert.match(handler, /rejeitado_garcom/);
  assert.match(handler, /if \(pedidoPublicoQr\(documento\.data\(\)\)\) return atualizarStatusPedidoQr/);
});

test('confirmação do garçom atribui responsável e exige papel autorizado', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /PAPEIS_GARCOM = \['proprietario', 'administrador', 'gerente', 'garcom'\]/);
  assert.match(handler, /exigirPapelTransicaoQr/);
  assert.match(handler, /idGarcomResponsavel = identidade\.idUsuario/);
  assert.match(handler, /GARCOM_JA_RESPONSAVEL/);
  assert.match(handler, /confirmado_garcom: 'confirmadoGarcomEm'/);
});

test('pedido só chega à cozinha após confirmação e cozinha possui ficha própria', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /confirmado_garcom: new Set\(\['enviado_cozinha', 'cancelado'\]\)/);
  assert.match(handler, /PAPEIS_COZINHA = \['proprietario', 'administrador', 'gerente', 'cozinha'\]/);
  assert.match(handler, /collection\('fichasCozinha'\)/);
  assert.match(handler, /statusFicha: 'aguardando_preparo'/);
  assert.match(handler, /statusFicha: para === 'em_preparo' \? 'em_preparo' : 'pronto'/);
  assert.match(handler, /FICHA_COZINHA_NAO_ENCONTRADA/);
});

test('transições atualizam pedido, comanda, mesa, histórico, eventos e auditoria', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /statusPedido: para/);
  assert.match(handler, /transacao\.set\(pedidoRef\.collection\('historicoStatus'\)/);
  assert.match(handler, /transacao\.set\(pedidoRef\.collection\('eventos'\)/);
  assert.match(handler, /statusComanda = 'em_consumo'/);
  assert.match(handler, /estadoAtendimento: estadoMesa/);
  assert.match(handler, /registrarAuditoriaOperacional/);
  assert.match(handler, /transacao\.update\(fichaRef/);
});

test('mutação QR usa chave de idempotência e não libera mesa ao servir', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /chaveIdempotenciaPedido/);
  assert.match(handler, /collection\('chavesIdempotencia'\)/);
  assert.match(handler, /hashPayload/);
  assert.match(handler, /idempotente: repeticaoIdempotente/);
  assert.match(handler, /servido: 'ocupada'/);
  assert.doesNotMatch(handler.slice(handler.indexOf('async function atualizarStatusPedidoQr'), handler.indexOf('async function atualizarStatusPedido(')), /estado: 'disponivel'/);
});

test('bridge de pedidos expõe estados QR e mantém compatibilidade com pedidos legados', () => {
  const dados = ler('scripts/pedidos/dados-pedidos.js');
  assert.match(dados, /statusPedido \|\| pedido\.status/);
  assert.match(dados, /aguardando_confirmacao_garcom/);
  assert.match(dados, /confirmado_garcom/);
  assert.match(dados, /enviado_cozinha/);
  assert.match(dados, /em_preparo/);
  assert.match(dados, /servido/);
  assert.match(dados, /\['novo', 'rascunho', 'aguardando_confirmacao_garcom'/);
});

test('tela de pedidos ativos oferece confirmação, recusa, envio à cozinha e serviço', () => {
  const pagina = ler('paginas/pedidos/pedidos-ativos.html');
  const controller = ler('scripts/pedidos/pedidos-ativos.js');
  assert.match(pagina, /id="recusarModalPedido"/);
  assert.match(controller, /confirmado_garcom/);
  assert.match(controller, /enviado_cozinha/);
  assert.match(controller, /servido/);
  assert.match(controller, /rejeitado_garcom/);
  assert.match(controller, /motivoRejeicao/);
  assert.match(controller, /chaveIdempotencia/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage/);
});

test('fila da cozinha só opera pedidos enviados e não marca pedido como entregue', () => {
  const controller = ler('scripts/pedidos/fila-cozinha.js');
  assert.match(controller, /enviado_cozinha/);
  assert.match(controller, /em_preparo/);
  assert.match(controller, /status: proximo/);
  assert.match(controller, /pronto/);
  assert.doesNotMatch(controller, /status === 'pronto' \? 'entregue'/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage/);
});

test('assets das telas administrativas preservam a Etapa 5 e versionam Pedidos Ativos na Etapa 6', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  for (const rota of ['novo-pedido', 'historico-pedidos', 'fila-cozinha']) {
    assert.match(shell, new RegExp(`${rota}[^\\n]*etapa5-garcom-cozinha`));
  }
  assert.match(shell, /pedidos-ativos[^\\n]*etapa6-caixa/);
});
