'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TIPOS_NOTIFICACAO, destinatariosParaEvento } = require('../api/_lib/notificacoes');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

const estadosNominais = [
  'aguardando_confirmacao_garcom',
  'confirmado_garcom',
  'enviado_cozinha',
  'em_preparo',
  'pronto',
  'servido',
];

test('contrato nominal reúne os estados QR em ordem única', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const inicio = pedidos.indexOf('const TRANSICOES_QR');
  const fim = pedidos.indexOf('function pedidoPublicoQr');
  const transicoes = pedidos.slice(inicio, fim);
  let anterior = -1;
  for (const estado of estadosNominais) {
    const posicao = transicoes.indexOf(`  ${estado}:`);
    assert.ok(posicao > anterior, `estado ${estado} deve aparecer depois do anterior`);
    anterior = posicao;
  }
  assert.match(transicoes, /rascunho: new Set\(\['aguardando_confirmacao_garcom', 'cancelado'\]\)/);
  assert.match(pedidos, /pronto: new Set\(\['servido', 'cancelado'\]\)/);
});

test('pedido público cria comanda em consumo e aguarda confirmação do garçom', () => {
  const qr = ler('api/_lib/qrcode-mesas.js');
  assert.match(qr, /const statusPedido = 'aguardando_confirmacao_garcom'/);
  assert.match(qr, /statusComanda: 'em_consumo'/);
  assert.match(qr, /estadoAtendimento: 'aguardando_confirmacao'/);
  assert.match(qr, /collection\('itens'\)/);
  assert.match(qr, /collection\('eventos'\)/);
  assert.match(qr, /TIPOS_NOTIFICACAO\.novoPedidoGarcom/);
});

test('confirmação, cozinha, preparo, pronto e serviço usam transação e ficha de cozinha', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(pedidos, /runTransaction\(async transacao/);
  assert.match(pedidos, /para === 'confirmado_garcom'/);
  assert.match(pedidos, /para === 'enviado_cozinha'/);
  assert.match(pedidos, /collection\('fichasCozinha'\)/);
  assert.match(pedidos, /statusFicha: 'aguardando_preparo'/);
  assert.match(pedidos, /statusFicha: para === 'em_preparo' \? 'em_preparo' : 'pronto'/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.pedidoEnviadoCozinha/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.pedidoPronto/);
});

test('encaminhamento ao caixa bloqueia pendências e atualiza comanda e mesa', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(pedidos, /COMANDA_COM_PEDIDOS_PENDENTES/);
  assert.match(pedidos, /statusComanda: 'encaminhada_caixa'/);
  assert.match(pedidos, /collection\('encaminhamentosCaixa'\)/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.comandaEncaminhadaCaixa/);
  assert.match(financeiro, /de === 'encaminhada' && \['recebida', 'cancelada'\]/);
  assert.match(financeiro, /de === 'recebida' && para === 'concluida'/);
  assert.match(financeiro, /statusComanda: 'encerrada'/);
  assert.match(financeiro, /estado: 'disponivel'/);
  assert.match(financeiro, /estadoSessao: 'encerrada'/);
  assert.match(financeiro, /TIPOS_NOTIFICACAO\.atendimentoEncerrado/);
});

test('notificações nominais cobrem os destinatários operacionais esperados', () => {
  assert.ok(destinatariosParaEvento(TIPOS_NOTIFICACAO.novoPedidoGarcom).some(item => item.papelDestino === 'garcom'));
  assert.ok(destinatariosParaEvento(TIPOS_NOTIFICACAO.pedidoEnviadoCozinha).some(item => item.papelDestino === 'cozinha'));
  assert.deepEqual(destinatariosParaEvento(TIPOS_NOTIFICACAO.pedidoPronto, 'garcom-1')[0], { papelDestino: 'garcom', idUsuarioDestino: 'garcom-1' });
  assert.ok(destinatariosParaEvento(TIPOS_NOTIFICACAO.comandaEncaminhadaCaixa).some(item => item.papelDestino === 'caixa'));
  assert.ok(destinatariosParaEvento(TIPOS_NOTIFICACAO.atendimentoEncerrado, 'garcom-1').some(item => item.idUsuarioDestino === 'garcom-1'));
});

test('encerramento operacional não implementa processamento de pagamento', () => {
  const financeiro = ler('api/_lib/financeiro-handler.js');
  const notificacoes = ler('api/_lib/notificacoes.js');
  assert.doesNotMatch(financeiro, /CVV|senhaCartao|numeroCartao|adquirencia/i);
  assert.doesNotMatch(notificacoes, /cartao|cvv|troco|adquirencia/i);
});
