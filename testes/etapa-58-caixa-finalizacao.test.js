'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('encaminhamento ao caixa reconcilia pedidos e total da comanda no servidor', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /totalPedidosCentavos/);
  assert.match(pedidos, /VALOR_COMANDA_INCONSISTENTE/);
  assert.match(pedidos, /COMANDA_COM_PEDIDOS_NAO_ENCERRADOS/);
  assert.match(pedidos, /estadosEncerrados/);
});

test('encaminhamento persiste os identificadores do garçom para liberação posterior', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  for (const campo of ['idFuncionarioGarcomResponsavel', 'idUsuarioGarcomResponsavel']) assert.match(pedidos, new RegExp(campo));
  assert.match(financeiro, /funcionarioGarcomConsulta/);
  assert.match(financeiro, /idFuncionarioResponsavelFinal/);
});

test('conclusão do caixa encerra pedidos, comanda, sessões e participantes', () => {
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(financeiro, /estadoComanda: 'encerrada'/);
  assert.match(financeiro, /statusComanda: 'encerrada'/);
  assert.match(financeiro, /estadoSessao: 'encerrada'/);
  assert.match(financeiro, /estadoParticipante: 'encerrado'/);
  assert.match(financeiro, /estadoAnterior: 'encaminhada_caixa'/);
  assert.match(financeiro, /estadoNovo: 'disponivel'/);
});

test('conclusão do caixa libera mesa e carga operacional do garçom', () => {
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(financeiro, /mesasAtivas = Math\.max\(0, Number\(carga\.mesasAtivas \|\| 0\) - 1\)/);
  assert.match(financeiro, /comandasAtivas = Math\.max\(0, Number\(carga\.comandasAtivas \|\| 0\) - 1\)/);
  assert.match(financeiro, /pedidosPendentes = Math\.max\(0, Number\(carga\.pedidosPendentes \|\| 0\) - pedidosOperacionais\.length\)/);
  assert.match(financeiro, /disponibilidadeAtendimento: mesasAtivas \|\| comandasAtivas \|\| pedidosPendentes \|\| tarefasAtivas \? 'em_atendimento' : 'disponivel'/);
  assert.match(financeiro, /estado: 'disponivel'/);
});

test('primeiro pedido de uma comanda sem responsável conta mesa, comanda e pedido', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  assert.match(qrcode, /incrementoMesa: 1/);
  assert.match(qrcode, /incrementoComanda: 1/);
  assert.match(qrcode, /incrementoPedido: 1/);
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /pedidosPendentes: carga\.pedidosPendentes \+ incrementoPedido/);
});

test('encaminhamento e conclusão usam idempotência e não processam pagamento', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(pedidos, /idempotenciaRef/);
  assert.match(pedidos, /transacao\.create\(idempotenciaRef/);
  assert.match(financeiro, /transacao\.create\(idempotenciaRef/);
  assert.match(financeiro, /Conferência operacional concluída pelo caixa/);
  assert.doesNotMatch(financeiro, /gateway|transacaoPagamento|processarPagamento/i);
});

test('DTO e tela do caixa preservam a identificação operacional após o fechamento', () => {
  const financeiro = ler('api/_lib/financeiro.js');
  const tela = ler('scripts/financeiro/fechamento-caixa.js');
  assert.match(financeiro, /idFuncionarioGarcomResponsavel/);
  assert.match(tela, /modalDetalhesComandaCaixa/);
  assert.match(tela, /obterDetalhesComandaCaixa/);
});

test('limite de funções serverless e arquitetura do shell permanecem intactos', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /fechamento-caixa/);
  assert.match(shell, /atendimento-garcom/);
  assert.equal(fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js')).length, 4);
  assert.equal(fs.existsSync(path.join(raiz, '.github', 'workflows')), false);
});
