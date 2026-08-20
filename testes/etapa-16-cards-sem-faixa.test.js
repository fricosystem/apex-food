'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('cards da Visão Geral não exibem faixa colorida lateral', () => {
  const home = ler('estilos/home/home.css');
  const pseudoFaixa = home.match(/\.home-modulo::before\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.equal(pseudoFaixa, '.home-modulo::before {\n  display: none;\n}');
  assert.doesNotMatch(pseudoFaixa, /background:/);
});

test('cards de Pedidos e Fila da Cozinha usam borda lateral laranja fina uniforme', () => {
  const pedidos = ler('estilos/pedidos/pedidos.css');
  const fila = ler('estilos/pedidos/fila-cozinha.css');
  assert.match(pedidos, /\.pedido-card\.prioridade-alta\s*\{\s*border-left:\s*1px solid #ea580c;/);
  assert.match(pedidos, /\.pedido-card\.prioridade-normal\s*\{\s*border-left:\s*1px solid #ea580c;/);
  assert.match(pedidos, /\.pedido-card\.prioridade-baixa\s*\{\s*border-left:\s*1px solid #ea580c;/);
  assert.match(fila, /\.cozinha-card\.prioridade-alta\s*\{\s*border-left:\s*1px solid #ea580c;/);
  assert.match(fila, /\.cozinha-card\.prioridade-normal\s*\{\s*border-left:\s*1px solid #ea580c;/);
  assert.doesNotMatch(pedidos, /prioridade-(alta|normal|baixa)[^}]*border-left:\s*3px/);
  assert.doesNotMatch(fila, /prioridade-(alta|normal)[^}]*border-left:\s*3px/);
});

test('regra compartilhada aplica borda laranja fina aos cards do conteúdo', () => {
  const tokens = ler('estilos/compartilhados/tokens-apex.css');
  assert.match(tokens, /#conteudoPagina \[class~="bg-card"\]\[class~="border"\]/);
  assert.match(tokens, /#conteudoPagina \.pedido-card/);
  assert.match(tokens, /border-left:\s*1px solid var\(--apex-laranja\)/);
});

test('linhas de árvore não são confundidas com faixas de cards', () => {
  const pedidos = ler('estilos/pedidos/pedidos.css');
  const mapa = ler('estilos/mapa-mesas.css');
  assert.match(pedidos, /\.tree-item::before/);
  assert.match(mapa, /\.tree-item::before/);
});
