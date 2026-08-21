const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('ciclo QR mantém as transições operacionais em ordem', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /aguardando_confirmacao_garcom: new Set\(\['confirmado_garcom', 'rejeitado_garcom', 'cancelado'\]\)/);
  assert.match(handler, /confirmado_garcom: new Set\(\['enviado_cozinha', 'cancelado'\]\)/);
  assert.match(handler, /enviado_cozinha: new Set\(\['em_preparo', 'cancelado'\]\)/);
  assert.match(handler, /em_preparo: new Set\(\['pronto', 'cancelado'\]\)/);
  assert.match(handler, /pronto: new Set\(\['servido', 'cancelado'\]\)/);
  assert.match(handler, /servido: new Set\(\)/);
});

test('fila da cozinha exibe apenas estados de produção e mapeia estados legados', () => {
  const cozinha = ler('scripts/pedidos/fila-cozinha.js');
  assert.match(cozinha, /filter\(pedido => \['enviado_cozinha', 'em_preparo', 'pronto', 'novo', 'preparo'\]\.includes\(pedido\.status\)\)/);
  assert.match(cozinha, /\(item\.estados \|\| \[item\.id\]\)\.includes\(pedido\.status\)/);
  assert.match(cozinha, /\['enviado_cozinha', 'em_preparo', 'novo', 'preparo'\]\.includes\(pedido\.status\)/);
});

test('garçom confirma, rejeita, envia, serve e encaminha sem liberar a mesa antes do caixa', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const ativos = ler('scripts/pedidos/pedidos-ativos.js');
  assert.match(pedidos, /exigirPapelTransicaoQr/);
  assert.match(pedidos, /para === 'confirmado_garcom'/);
  assert.match(pedidos, /para === 'enviado_cozinha'/);
  assert.match(pedidos, /'enviado_cozinha', 'servido'\]\.includes\(para\)/);
  assert.match(pedidos, /estadoAtendimento: estadoMesa/);
  assert.match(ativos, /encaminharComandaCaixa/);
  assert.match(ativos, /pedido\.status !== 'servido'/);
});

test('caixa encerra comanda, sessão pública e libera a mesa somente após conclusão', () => {
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(financeiro, /de === 'encaminhada' && \['recebida', 'cancelada'\]\.includes\(para\)/);
  assert.match(financeiro, /de === 'recebida' && para === 'concluida'/);
  assert.match(financeiro, /statusComanda: 'encerrada'/);
  assert.match(financeiro, /estadoSessao: 'encerrada'/);
  assert.match(financeiro, /estado: 'disponivel'/);
  assert.match(financeiro, /COMANDA_COM_PEDIDOS_PENDENTES/);
  assert.match(ler('scripts/financeiro/fechamento-caixa.js'), /Nenhum pagamento é processado nesta tela/);
});

test('versionamento operacional evita cache antigo no shell e no bridge financeiro', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  const financeiro = ler('scripts/financeiro/dados-financeiros.js');
  assert.match(shell, /pedidos-ativos\.html\?v=etapa19-fluxo-operacional/);
  assert.match(shell, /fila-cozinha\.html\?v=etapa19-fluxo-operacional/);
  assert.match(shell, /fechamento-caixa\.html\?v=etapa19-fluxo-operacional/);
  assert.match(index, /apex-shell\.js\?v=etapa22-dados-reais-global/);
  assert.match(index, /modulos-client\.js\?v=etapa22-dados-reais-global/);
  assert.match(financeiro, /modulos-client\.js\?v=etapa22-dados-reais-global/);
});
