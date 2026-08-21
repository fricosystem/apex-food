'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('bridge financeiro inicia vazio e carrega somente dados reais', () => {
  const bridge = ler('scripts/financeiro/dados-financeiros.js');
  assert.doesNotMatch(bridge, /dadosFinanceirosPreview|emPreviewLocal|localhost|MOV-08|Hortifruti Verde Vida/);
  assert.match(bridge, /window\.dadosFinanceirosApexFood = \{/);
  assert.match(bridge, /window\.apexFinanceiroRecarregar/);
  assert.match(bridge, /listarFinanceiro\('', parametros\)/);
  assert.match(bridge, /meta\?\.idRestaurante/);
});

test('handler financeiro preserva centavos, idempotência e auditoria', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  const helper = ler('api/_lib/financeiro.js');
  assert.match(handler, /executarIdempotente/);
  assert.match(handler, /idempotenciaDaRequisicao\(req, corpo\)/);
  assert.match(handler, /chavesIdempotencia/);
  assert.match(handler, /registrarAuditoriaOperacional/);
  assert.match(helper, /valorCentavos/);
  assert.match(helper, /saldoConferidoCentavos/);
  assert.match(helper, /CONFIRMACAO_NECESSARIA/);
});

test('controllers financeiros usam operações persistidas e não placeholders', () => {
  const controllers = [
    ler('scripts/financeiro/fluxo-caixa.js'),
    ler('scripts/financeiro/contas-pagar-receber.js'),
    ler('scripts/financeiro/fechamento-caixa.js'),
    ler('scripts/financeiro/relatorios-financeiros.js'),
  ];
  const conjunto = controllers.join('\n');
  assert.match(conjunto, /criarMovimentacaoFinanceira/);
  assert.match(conjunto, /criarContaFinanceira/);
  assert.match(conjunto, /atualizarContaFinanceira/);
  assert.match(conjunto, /fecharCaixaFinanceiro/);
  assert.match(conjunto, /createObjectURL/);
  assert.match(conjunto, /window\.print/);
  assert.doesNotMatch(conjunto, /salvo no preview|salva no preview|preparada para integração|atualizado no preview/);
});

test('Dashboard Financeiro e Fechamento não exibem períodos ou alertas fixos', () => {
  const dashboard = ler('paginas/financeiro/dashboard-financeiro.html');
  const fechamento = ler('paginas/financeiro/fechamento-caixa.html');
  const contas = ler('paginas/financeiro/contas-pagar-receber.html');
  const controller = ler('scripts/financeiro/dashboard-financeiro.js');
  assert.doesNotMatch(dashboard, /Mar — Ago\/2026|1 conta vencida|3 contas na semana/);
  assert.doesNotMatch(fechamento, /Caixa do dia 18\/08\/2026|72 pedidos registrados/);
  assert.doesNotMatch(contas, /1 conta vencida|3 contas na semana|Distribuidora APEX Bebidas/);
  assert.match(dashboard, /dashboardFinanceiroPeriodo/);
  assert.match(controller, /Nenhum caixa aberto/);
});

test('shell e index versionam as rotas financeiras da Fase 9', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /dashboard-financeiro[^\n]*etapa22-dados-reais-global/);
  for (const rota of ['fluxo-caixa', 'contas-pagar-receber', 'relatorios-financeiros']) {
    assert.match(shell, new RegExp(`${rota}[^\\n]*etapa22-dados-reais-global`));
  }
  assert.match(shell, /fechamento-caixa[^\n]*dados-financeiros\.js\?v=etapa22-dados-reais-global/);
  assert.match(index, /apex-shell\.js\?v=etapa22-dados-reais-global/);
});

test('contrato financeiro documenta coleções, estados e permissões', () => {
  const contrato = ler('docs/fase9-financeiro-contrato.md');
  assert.match(contrato, /fechamentosCaixa/);
  assert.match(contrato, /movimentacoesCaixa/);
  assert.match(contrato, /contasPagar/);
  assert.match(contrato, /chavesIdempotencia/);
  assert.match(contrato, /saldoEsperadoCentavos/);
  assert.match(contrato, /papéis financeiros autorizados/);
});
