'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Visão Geral usa agregador tenant-aware e filtros server-side', () => {
  const operacional = ler('api/v1/operacional.js');
  const handler = ler('api/_lib/visao-geral-handler.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(operacional, /'visao-geral': require\('\.\.\/\_lib\/visao-geral-handler'\)/);
  assert.match(handler, /obterIdentidadeOperacional\(req, PAPEIS_LEITURA\)/);
  assert.match(handler, /queryString\(req, 'periodo'\)/);
  assert.match(handler, /queryString\(req, 'inicio'\)/);
  assert.match(handler, /queryString\(req, 'fim'\)/);
  assert.match(handler, /caminhoRestaurante\(identidade\.idRestaurante\)/);
  assert.match(cliente, /listarVisaoGeral\(parametros = \{\}\)/);
  assert.match(cliente, /modulo: 'visao-geral'/);
});

test('Home não carrega bridges de preview e hidrata a partir da Visão Geral', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const home = ler('scripts/home/home.js');
  const ponte = ler('scripts/home/dados-visao-geral.js');
  const fragmento = ler('paginas/home.html');
  const blocoHome = shell.slice(shell.indexOf("home: {"), shell.indexOf("'novo-pedido':"));
  assert.match(blocoHome, /scripts\/home\/dados-visao-geral\.js\?v=etapa17-visao/);
  assert.doesNotMatch(blocoHome, /dados-relatorios\.js|dados-pedidos\.js|dados-financeiros\.js|dados-cardapio\.js|dados-mesas\.js/);
  assert.match(home, /dadosVisaoGeralApexFood/);
  assert.match(ponte, /listarVisaoGeral/);
  assert.match(ponte, /apex:visao-geral-atualizada/);
  assert.match(fragmento, /homeVendasGrafico/);
  assert.match(fragmento, /homePedidosTabela/);
});

test('Visão Geral não contém os valores fixos de preview removidos', () => {
  const home = ler('paginas/home.html');
  const renderer = ler('scripts/home/home.js');
  for (const valorFicticio of ['R$ 4.872,50', 'R$ 28.450,00', 'Pizza Margherita + Refri', 'PED-4521', 'Sistema de IA Operacional']) {
    assert.doesNotMatch(home, new RegExp(valorFicticio.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(renderer, /pedidos estimados|Despesas estimadas|Base operacional de preview/);
});
