'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Pedidos usam handler tenant-aware com transações e estados fechados', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /collection\('pedidos'\)/);
  assert.match(handler, /collection\('comandas'\)/);
  assert.match(handler, /collection\('historicoStatus'\)/);
  assert.match(handler, /const ESTADOS_PEDIDO = new Set\(\['novo', 'preparo', 'pronto', 'entregue', 'finalizado', 'cancelado', 'rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'servido', 'rejeitado_garcom'\]\)/);
  assert.match(handler, /const TRANSICOES/);
  assert.match(handler, /runTransaction/);
  assert.match(handler, /motivoCancelamento/);
  assert.match(handler, /PEDIDO_NAO_ENCONTRADO/);
});

test('Pedidos são expostos pelo agregador e pelo rewrite operacional', () => {
  const operacional = ler('api/v1/operacional.js');
  const vercel = JSON.parse(ler('vercel.json'));
  assert.match(operacional, /pedidos: require\('\.\.\/\_lib\/pedidos-handler'\)/);
  assert.match(operacional, /url\.includes\('\/pedidos'\)/);
  assert.ok(vercel.rewrites.some(item => item.source === '/api/v1/pedidos' && item.destination.includes('modulo=pedidos')));
});

test('cliente same-origin possui leitura, criação e transição de pedidos', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /listarPedidos/);
  assert.match(cliente, /criarPedido/);
  assert.match(cliente, /atualizarStatusPedido/);
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage/);
});

test('Fase 6 mantém histórico e marcos de fechamento no backend', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /finalizadoEm/);
  assert.match(handler, /canceladoEm/);
  assert.match(handler, /historicoStatus/);
});

test('Pedidos não carregam fixtures no ambiente Development', () => {
  const dados = ler('scripts/pedidos/dados-pedidos.js');
  assert.match(dados, /const ambientePedidosLocal = \['localhost', '127\.0\.0\.1'\]/);
  assert.match(dados, /window\.dadosPedidosApexFood = ambientePedidosLocal \? dadosPedidosPreview : estadoPedidosVazio/);
  assert.match(dados, /apexModulosApi\.listarPedidos/);
});

test('controllers de Pedidos usam a API e mantêm a fonte única', () => {
  const novo = ler('scripts/pedidos/novo-pedido.js');
  const ativos = ler('scripts/pedidos/pedidos-ativos.js');
  const cozinha = ler('scripts/pedidos/fila-cozinha.js');
  const historico = ler('scripts/pedidos/historico-pedidos.js');
  assert.match(novo, /apexModulosApi\.criarPedido/);
  assert.match(ativos, /apexModulosApi\.atualizarStatusPedido/);
  assert.match(cozinha, /apexModulosApi\.atualizarStatusPedido/);
  assert.doesNotMatch(cozinha, /pedidosCozinha\.splice/);
  assert.match(historico, /exportarHistorico/);
});

test('estados vazios de Pedidos usam linguagem profissional', () => {
  const controllers = [
    ler('scripts/pedidos/novo-pedido.js'),
    ler('scripts/pedidos/pedidos-ativos.js'),
    ler('scripts/pedidos/fila-cozinha.js'),
    ler('scripts/pedidos/historico-pedidos.js'),
  ];
  for (const controller of controllers) {
    assert.doesNotMatch(controller, /Nenhum .*real|pedido real|produto real|pedidos reais|item real|transição real/);
  }
  assert.match(controllers[0], /Nenhum produto encontrado/);
  assert.match(controllers[1], /Nenhum pedido encontrado/);
  assert.match(controllers[2], /Nenhum pedido encontrado/);
  assert.match(ler('paginas/pedidos/historico-pedidos.html'), /Nenhum pedido encontrado/);
});
