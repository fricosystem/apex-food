'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('helper de estoque valida saldo e grava saída na mesma transação do pedido', () => {
  const helper = ler('api/_lib/estoque-pedidos.js');
  assert.match(helper, /async function baixarEstoqueParaPedido/);
  assert.match(helper, /estoqueAnterior < quantidade/);
  assert.match(helper, /ESTOQUE_INSUFICIENTE/);
  assert.match(helper, /transacao\.update\(documento\.ref/);
  assert.match(helper, /movimentacoesEstoque/);
  assert.match(helper, /tipo: 'saida'/);
  assert.match(helper, /referenciaTipo: 'pedido'/);
});

test('devolução de estoque é registrada uma única vez em cancelamento ou rejeição', () => {
  const helper = ler('api/_lib/estoque-pedidos.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(helper, /async function devolverEstoqueDoPedido/);
  assert.match(helper, /tipo: 'entrada'/);
  assert.match(helper, /referenciaTipo: 'pedido_cancelado'/);
  assert.match(pedidos, /pedido\.estoqueBaixado === true && pedido\.estoqueRestaurado !== true/);
  assert.match(pedidos, /devolverEstoqueDoPedido/);
  assert.match(pedidos, /agora\.estoqueRestaurado = true/);
});

test('pedido público valida estoque dentro da transação antes de persistir', () => {
  const qr = ler('api/_lib/qrcode-mesas.js');
  assert.match(qr, /const produtoDocumentos = await Promise\.all/);
  assert.match(qr, /baixarEstoqueParaPedido/);
  assert.match(qr, /Baixa automática do pedido enviado pela comanda digital/);
  assert.match(qr, /estoqueBaixado: true/);
  assert.match(qr, /PRODUTO_INDISPONIVEL/);
});

test('pedido administrativo aplica a mesma baixa de estoque do QR', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /Baixa automática do pedido administrativo/);
  assert.match(pedidos, /estoqueBaixado: true/);
  assert.match(pedidos, /const produtoDocumento = produtoDocumentos\[indice\]/);
});

test('cardápio público não lista produto desativado ou esgotado', () => {
  const qr = ler('api/_lib/qrcode-mesas.js');
  assert.match(qr, /dados\.disponibilidade !== false/);
  assert.match(qr, /Number\(dados\.estoque \|\| 0\) > 0/);
  assert.match(qr, /categoriasIds\.has/);
});

test('bridge do cardápio não injeta mocks e começa sem dados até o Firestore responder', () => {
  const dados = ler('scripts/cardapio/dados-cardapio.js');
  assert.doesNotMatch(dados, /previewCardapio|window\.location\.hostname|Festival da Pizza|Hambúrguer Artesanal/);
  assert.match(dados, /window\.dadosCardapioApexFood = \{ categorias: \[\], produtos: \[\], promocoes: \[\] \}/);
  assert.match(dados, /listarCardapio\(\)/);
  assert.match(dados, /etapa20-cardapio-estoque/);
});

test('Novo Pedido não oferece itens sem estoque e limita o carrinho ao saldo conhecido', () => {
  const novoPedido = ler('scripts/pedidos/novo-pedido.js');
  assert.match(novoPedido, /Number\(produto\.estoque \|\| 0\) > 0/);
  assert.match(novoPedido, /Math\.min\(Number\(produto\.estoque \|\| 0\)/);
  assert.match(novoPedido, /produto\.disponibilidade === false/);
});

test('Etapa 20 mantém cliente same-origin e não adiciona segredo no frontend', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  const mesa = ler('scripts/publico/mesa.js');
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage|sessionStorage/);
  assert.doesNotMatch(mesa, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage|sessionStorage/);
});
