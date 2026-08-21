const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Relatórios usam a agregação server-side da Visão Geral', () => {
  const bridge = ler('scripts/relatorios/dados-relatorios.js');
  assert.match(bridge, /listarVisaoGeral\(ultimosParametros\)/);
  assert.match(bridge, /resposta\?\.meta\?\.fonte !== 'firestore'/);
  assert.match(bridge, /vendasPorCanal \|\| relatorios\.canais/);
  assert.match(bridge, /relatorios\.produtosMaisVendidos/);
  assert.match(bridge, /relatorios\.performanceEquipe/);
  assert.match(bridge, /relatorios\.avaliacoes/);
});

test('Relatórios preservam filtros de período e atualização automática real', () => {
  const bridge = ler('scripts/relatorios/dados-relatorios.js');
  assert.match(bridge, /ultimosParametros = \{ \.\.\.ultimosParametros, \.\.\.parametros \}/);
  assert.match(bridge, /window\.recarregarRelatorios = carregarDadosRelatorios/);
  assert.match(bridge, /setTimeout/);
  assert.match(bridge, /visibilitychange/);
  assert.match(bridge, /beforeunload/);
});

test('Visão Geral e Relatórios usam a mesma origem declarada no servidor', () => {
  const home = ler('scripts/home/dados-visao-geral.js');
  const relatorios = ler('scripts/relatorios/dados-relatorios.js');
  const handler = ler('api/_lib/visao-geral-handler.js');
  assert.match(home, /listarVisaoGeral\(ultimosParametros\)/);
  assert.match(relatorios, /listarVisaoGeral\(ultimosParametros\)/);
  assert.match(handler, /meta: \{ idRestaurante: identidade\.idRestaurante/);
  assert.match(handler, /fonte: 'firestore'/);
});

test('Relatórios não recalculam vendas a partir de pedidos no navegador', () => {
  const bridge = ler('scripts/relatorios/dados-relatorios.js');
  assert.doesNotMatch(bridge, /construirDados|porDia|porSemana|porMes|porProduto|Promise\.allSettled\(\[api\.listarPedidos/);
  assert.doesNotMatch(bridge, /Pizza Margherita|João Mendes|18\/08\/2026|dadosRelatoriosPreview/);
});
