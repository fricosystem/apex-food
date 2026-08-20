'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Cardápio usa coleções canônicas em português', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  assert.match(handler, /categorias:\s*'categoriasCardapio'/);
  assert.match(handler, /produtos:\s*'produtosCardapio'/);
  assert.match(handler, /promocoes:\s*'promocoesCardapio'/);
  assert.match(handler, /const RECURSOS_ESCRITA = new Set\(\['categorias', 'produtos', 'promocoes', 'estoque'\]\)/);
});

test('Promoções possuem contrato de criação e atualização server-side', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  assert.match(handler, /function validarPromocao\(corpo\)/);
  assert.match(handler, /valorCentavos/);
  assert.match(handler, /ESTADOS_PROMOCAO/);
  assert.match(handler, /camposAtualizaveisPromocao\(corpo\)/);
  assert.match(handler, /recurso === 'promocoes' \? dados\.estado : 'ativo'/);
});

test('telas de Cardápio expõem campos reais e não mantêm métricas fictícias', () => {
  const produtos = ler('paginas/cardapio/produtos.html');
  const promocoes = ler('paginas/cardapio/promocoes.html');
  const dados = ler('scripts/cardapio/dados-cardapio.js');
  assert.match(produtos, /id="custoNovoProduto"/);
  assert.match(produtos, /id="estoqueNovoProduto"/);
  assert.match(produtos, /id="unidadeNovoProduto"/);
  assert.match(produtos, /id="tempoPreparoNovoProduto"/);
  assert.match(promocoes, /id="tipoPromocao"/);
  assert.match(promocoes, /id="descontoPromocao"/);
  assert.doesNotMatch(promocoes, /text-yellow mt-2">15%/);
  assert.doesNotMatch(promocoes, /R\$ 4\.280/);
  assert.match(dados, /window\.location\.hostname/);
});

test('estoque usa movimentação transacional e cliente same-origin', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(handler, /TIPOS_ESTOQUE/);
  assert.match(handler, /movimentacoesEstoque/);
  assert.match(handler, /runTransaction/);
  assert.match(handler, /ESTOQUE_INSUFICIENTE/);
  assert.match(cliente, /registrarMovimentacaoEstoque/);
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY/);
});
