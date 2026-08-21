'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('bridge de Relatórios deriva dados das operações autorizadas e começa vazio', () => {
  const bridge = ler('scripts/relatorios/dados-relatorios.js');
  assert.match(bridge, /estadoVazio/);
  assert.match(bridge, /listarPedidos/);
  assert.match(bridge, /listarCardapio/);
  assert.match(bridge, /listarEquipe/);
  assert.match(bridge, /listarFinanceiro/);
  assert.match(bridge, /Object\.assign\(window\.dadosRelatoriosApexFood/);
  assert.doesNotMatch(bridge, /Base operacional de preview|18\/08\/2026|rankingBase|const avaliacoes = \[/);
});

test('controllers de Relatórios não mantêm avisos provisórios e escutam recarga', () => {
  const arquivos = [
    'scripts/relatorios/vendas-por-periodo.js',
    'scripts/relatorios/produtos-mais-vendidos.js',
    'scripts/relatorios/horarios-de-pico.js',
    'scripts/relatorios/avaliacoes-clientes.js',
    'scripts/relatorios/performance-equipe.js',
  ];
  const conjunto = arquivos.map(ler).join('\n');
  assert.match(conjunto, /createObjectURL/);
  assert.match(conjunto, /apex:relatorios-atualizado/);
  assert.doesNotMatch(conjunto, /preparada para integração|atualizado no preview|preparado para integração/);
});

test('Cardápio Digital possui configuração server-side e não exibe link fixo', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  const fragmento = ler('paginas/cardapio/cardapio-digital.html');
  const controller = ler('scripts/cardapio/cardapio-digital.js');
  assert.match(handler, /configuracoesCardapioDigital/);
  assert.match(handler, /validarConfiguracao/);
  assert.match(handler, /camposAtualizaveisConfiguracao/);
  assert.match(fragmento, /linkPublicoCardapio/);
  assert.match(controller, /listarCardapio\('configuracao'\)/);
  assert.match(controller, /atualizarCardapio/);
  assert.doesNotMatch(fragmento, /cardapio\.apexfood\.com\.br\/restaurante\/apex/);
  assert.doesNotMatch(controller, /Alterações publicadas no Cardápio Digital|QR Code preparado para download/);
});

test('Dashboard de Desempenho usa período dinâmico e recarrega módulos', () => {
  const fragmento = ler('paginas/desempenho/dashboard-desempenho.html');
  const controller = ler('scripts/desempenho/dashboard-desempenho.js');
  assert.match(fragmento, /dashboardDesempenhoPeriodo/);
  assert.doesNotMatch(fragmento, /Agosto\/2026/);
  assert.match(controller, /apex:relatorios-atualizado/);
  assert.match(controller, /apex:equipe-atualizado/);
  assert.match(controller, /apex:pedidos-atualizado/);
});

test('shell e index versionam os módulos revisados na Fase 11', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /['"]?comissoes['"]?:[^\n]*fase11/);
  assert.match(shell, /vendas-por-periodo[^\n]*fase11/);
  assert.match(index, /apex-shell\.js\?v=etapa19-fluxo-operacional/);
});

test('relatórios e comissões não exibem valores ou períodos fixos', () => {
  const arquivos = [
    'paginas/relatorios/produtos-mais-vendidos.html',
    'paginas/relatorios/performance-equipe.html',
    'paginas/desempenho/dashboard-desempenho.html',
    'paginas/equipe/comissoes.html',
  ];
  const conjunto = arquivos.map(ler).join('\n');
  const vendas = ler('scripts/relatorios/vendas-por-periodo.js');
  const comissoes = ler('scripts/equipe/comissoes.js');
  assert.doesNotMatch(conjunto, /Agosto\/2026|Julho\/2026|Junho\/2026/);
  assert.doesNotMatch(vendas, /8\.6|5\.2|11\.8/);
  assert.match(vendas, /calcularVariacao/);
  assert.match(comissoes, /periodosDisponiveisComissao/);
  assert.match(comissoes, /Nenhum registro encontrado para exportar/);
});
