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

test('cards de Pedidos e Fila da Cozinha preservam espaço sem cor lateral', () => {
  const pedidos = ler('estilos/pedidos/pedidos.css');
  const fila = ler('estilos/pedidos/fila-cozinha.css');
  assert.match(pedidos, /\.pedido-card\.prioridade-alta\s*\{\s*border-left:\s*3px solid transparent;/);
  assert.match(pedidos, /\.pedido-card\.prioridade-normal\s*\{\s*border-left:\s*3px solid transparent;/);
  assert.match(pedidos, /\.pedido-card\.prioridade-baixa\s*\{\s*border-left:\s*3px solid transparent;/);
  assert.match(fila, /\.cozinha-card\.prioridade-alta\s*\{\s*border-left:\s*3px solid transparent;/);
  assert.match(fila, /\.cozinha-card\.prioridade-normal\s*\{\s*border-left:\s*3px solid transparent;/);
  assert.doesNotMatch(pedidos, /prioridade-(alta|normal|baixa)[^}]*#(ef4444|eab308|22c55e)/);
  assert.doesNotMatch(fila, /prioridade-(alta|normal)[^}]*#(ef4444|eab308)/);
});

test('linhas de árvore não são confundidas com faixas de cards', () => {
  const pedidos = ler('estilos/pedidos/pedidos.css');
  const mapa = ler('estilos/mapa-mesas.css');
  assert.match(pedidos, /\.tree-item::before/);
  assert.match(mapa, /\.tree-item::before/);
});
