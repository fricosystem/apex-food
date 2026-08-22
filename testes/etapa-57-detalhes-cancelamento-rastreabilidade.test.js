'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('detalhe de comanda usa coleções em português e remove autoria interna', () => {
  const helper = ler('api/_lib/detalhes-comanda.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(helper, /collection\('comandas'\)/);
  assert.match(helper, /collection\('pedidos'\)/);
  assert.match(helper, /collection\('fichasCozinha'\)/);
  assert.match(helper, /historicoStatus/);
  assert.match(helper, /dtoDocumento/);
  assert.match(pedidos, /detalhesComanda/);
  assert.match(financeiro, /PAPEIS_LEITURA_CAIXA/);
});

test('detalhe de comanda reúne pedidos, participantes, sessões, fichas e histórico', () => {
  const helper = ler('api/_lib/detalhes-comanda.js');
  for (const campo of ['pedidos', 'participantes', 'sessoes', 'fichas', 'historico', 'resumo']) assert.match(helper, new RegExp(`\\b${campo}\\b`));
  assert.match(helper, /quantidadePedidos/);
  assert.match(helper, /pedidosPendentes/);
});

test('cancelamento QR exige motivo e devolve estoque apenas uma vez', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /textoObrigatorio\(corpo\.motivoCancelamento \|\| corpo\.motivoRejeicao \|\| corpo\.motivo/);
  assert.match(pedidos, /pedido\.estoqueBaixado === true && pedido\.estoqueRestaurado !== true/);
  assert.match(pedidos, /estoqueRestaurado = true/);
  assert.match(pedidos, /motivoCancelamento/);
});

test('cancelamento de ficha atualiza tarefas, histórico e carga dos cozinheiros', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /tarefasFichaCancelamento/);
  assert.match(pedidos, /statusTarefa: 'cancelada'/);
  assert.match(pedidos, /historicoStatus/);
  assert.match(pedidos, /comandasAtivas: Math\.max\(0, Number\(carga\.comandasAtivas/);
  assert.match(pedidos, /tarefasAtivas: tarefasRestantes/);
  assert.match(pedidos, /statusDistribuicaoCozinha: 'cancelada'/);
});

test('histórico do pedido e da comanda é gravado uma única vez por transição', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const ocorrenciasPedido = (pedidos.match(/transacao\.set\(pedidoRef\.collection\('historicoStatus'\)\.doc\(\), evento\)/g) || []).length;
  assert.equal(ocorrenciasPedido, 1);
  assert.match(pedidos, /comandaRef\.collection\('historicoStatus'\)/);
  assert.match(pedidos, /versao: Number\(comanda\.versao \|\| 1\) \+ 1/);
});

test('pedidos ativos, garçons e caixa possuem modal de detalhes e carregam o endpoint real', () => {
  const ativosHtml = ler('paginas/pedidos/pedidos-ativos.html');
  const ativosJs = ler('scripts/pedidos/pedidos-ativos.js');
  const garcomHtml = ler('paginas/pedidos/atendimento-garcom.html');
  const garcomJs = ler('scripts/pedidos/atendimento-garcom.js');
  const caixaHtml = ler('paginas/financeiro/fechamento-caixa.html');
  const caixaJs = ler('scripts/financeiro/fechamento-caixa.js');
  assert.match(ativosHtml, /participantesModalPedido/);
  assert.match(ativosHtml, /historicoModalPedido/);
  assert.match(ativosJs, /obterDetalhesComanda/);
  assert.match(garcomHtml, /modalDetalhesGarcom/);
  assert.match(garcomJs, /obterDetalhesComanda/);
  assert.match(caixaHtml, /modalDetalhesComandaCaixa/);
  assert.match(caixaJs, /obterDetalhesComandaCaixa/);
});

test('assets da Fase 5 são versionados e a arquitetura continua sem nova função serverless', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(shell, /etapa28-detalhes-rastreabilidade/);
  assert.match(cliente, /obterDetalhesComandaCaixa/);
  const funcoes = fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js'));
  assert.equal(funcoes.length, 4);
  assert.equal(fs.existsSync(path.join(raiz, '.github', 'workflows')), false);
});
