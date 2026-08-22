'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('histórico da comanda usa subcoleção server-side e tenant da sessão', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /async function listarHistoricoComanda/);
  assert.match(handler, /idDocumento\(queryString\(req, 'idComanda'\)/);
  assert.match(handler, /caminhoRestaurante\(identidade\.idRestaurante\)/);
  assert.match(handler, /collection\('historicoStatus'\)/);
  assert.match(handler, /orderBy\('criadoEm', 'desc'\)/);
  assert.match(handler, /limitarInteiro/);
});

test('histórico público não devolve autoria sensível ou documentos crus', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /statusAnterior/);
  assert.match(handler, /statusNovo/);
  assert.match(handler, /papelExecutor/);
  assert.match(handler, /idRequisicao/);
  assert.match(handler, /timestampParaIso/);
  assert.doesNotMatch(handler, /evento\.ip|evento\.token|FIREBASE_PRIVATE_KEY/);
});

test('recurso de histórico da comanda é roteado sem criar endpoint novo', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  const endpoint = ler('api/v1/operacional.js');
  assert.match(handler, /historicoComanda/);
  assert.match(handler, /if \(recurso === 'historicoComanda'\)/);
  assert.match(endpoint, /pedidos-handler/);
});

test('fila do caixa aceita filtro de status no servidor', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /const statusEncaminhamento = queryString\(req, 'status'\)/);
  assert.match(handler, /statusEncaminhamento === 'todos'/);
  assert.match(handler, /item\.statusEncaminhamento === statusEncaminhamento/);
  assert.match(handler, /statusEncaminhamento: statusEncaminhamento \|\| null/);
});

test('cliente same-origin expõe histórico e filtro sem credenciais locais', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  const financeiro = ler('scripts/financeiro/dados-financeiros.js');
  assert.match(cliente, /listarHistoricoComanda/);
  assert.match(cliente, /recurso: 'historicoComanda'/);
  assert.match(financeiro, /listarFinanceiro\('', parametros\)/);
  assert.doesNotMatch(cliente, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|initializeApp/);
});

test('pedidos arquivados preservam status de serviço e estado da comanda', () => {
  const handlerPedidos = ler('api/_lib/pedidos-handler.js');
  const handlerFinanceiro = ler('api/_lib/financeiro-handler.js');
  const dados = ler('scripts/pedidos/dados-pedidos.js');
  assert.match(handlerPedidos, /estadoComanda: 'encaminhada_caixa'/);
  assert.match(handlerFinanceiro, /estadoComanda: 'encerrada'/);
  assert.match(dados, /pedido\.estadoComanda \|\| pedido\.statusComanda/);
  assert.match(dados, /item\.status === 'servido' && pedidosDaComandaEncerrados/);
});

test('histórico de pedidos apresenta trilha operacional e estados novos', () => {
  const pagina = ler('paginas/pedidos/historico-pedidos.html');
  const controller = ler('scripts/pedidos/historico-pedidos.js');
  assert.match(pagina, /Trilha operacional da comanda/);
  assert.match(pagina, /filtroHistoricoStatus/);
  assert.match(pagina, /rejeitado_garcom/);
  assert.match(pagina, /servido/);
  assert.match(controller, /carregarTrilhaComanda/);
  assert.match(controller, /listarHistoricoComanda/);
  assert.match(controller, /Nenhum evento operacional encontrado/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage/);
});

test('dashboard financeiro separa contagens operacionais de pagamentos', () => {
  const pagina = ler('paginas/financeiro/dashboard-financeiro.html');
  const controller = ler('scripts/financeiro/dashboard-financeiro.js');
  assert.match(pagina, /Operação de comandas/);
  assert.match(pagina, /não representam pagamentos processados/);
  assert.match(controller, /renderizarComandas/);
  assert.match(controller, /dashboardComandasPendentes/);
  assert.match(controller, /statusEncaminhamento === 'concluida'/);
});

test('fila do caixa aplica filtros e mantém mensagens operacionais diretas', () => {
  const pagina = ler('paginas/financeiro/fechamento-caixa.html');
  const controller = ler('scripts/financeiro/fechamento-caixa.js');
  assert.match(pagina, /filtroEncaminhamentoCaixa/);
  assert.match(pagina, /Encaminhadas/);
  assert.match(pagina, /Concluídas/);
  assert.match(controller, /filtroAtualEncaminhamentoCaixa/);
  assert.match(controller, /status: filtroAtualEncaminhamentoCaixa\(\)/);
  assert.doesNotMatch(controller, /cartão|CVV|senha|localStorage|sessionStorage/);
});

test('Etapa 7 versiona assets de histórico e mantém mesa pública na Etapa 4', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  const documento = ler('docs/etapa6-encerramento-caixa.md');
  assert.match(shell, /historico-pedidos[^\n]*etapa7-historico/);
  assert.match(shell, /dashboard-financeiro[^\n]*etapa7-historico/);
  assert.match(shell, /fechamento-caixa[^\n]*etapa19-fluxo-operacional/);
  assert.match(shell, /mesa[^\\n]*etapa23-comanda-passos-mobile/);
  assert.match(index, /apex-shell\.js\?v=etapa31-especialidades/);
  assert.match(documento, /sem processar pagamentos|não processa pagamentos/i);
});
