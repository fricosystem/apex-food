'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');
const notificacoes = require('../api/_lib/notificacoes');

function criarTransacaoDeTeste() {
  const operacoes = [];
  return {
    operacoes,
    set(referencia, dados, opcoes) { operacoes.push({ tipo: 'set', id: referencia.id, dados, opcoes }); },
  };
}

function criarRestauranteDeTeste() {
  return { collection: nome => ({ doc: id => ({ colecao: nome, id }) }) };
}

test('contrato define estados, tipos e papéis de notificações em português', () => {
  assert.deepEqual(notificacoes.STATUS_NOTIFICACAO, ['nova', 'lida', 'arquivada']);
  assert.equal(notificacoes.TIPOS_NOTIFICACAO.novoPedidoGarcom, 'novo_pedido_garcom');
  assert.ok(notificacoes.PAPEIS_NOTIFICACAO.includes('caixa'));
  assert.ok(notificacoes.PRIORIDADES_NOTIFICACAO.includes('critica'));
});

test('emissão cria uma notificação por fila de destino com chave determinística', () => {
  const transacao = criarTransacaoDeTeste();
  notificacoes.criarNotificacoesNaTransacao(transacao, criarRestauranteDeTeste(), {
    tipoNotificacao: notificacoes.TIPOS_NOTIFICACAO.novoPedidoGarcom,
    titulo: 'Novo pedido — mesa 4',
    mensagem: 'Cliente enviou um pedido.',
    eventoOrigem: 'pedido:abc:status:aguardando_confirmacao_garcom',
    idMesa: 'mesa-4',
    idComanda: 'comanda-1',
    idPedido: 'pedido-1',
  });
  assert.equal(transacao.operacoes.length, 5);
  assert.equal(new Set(transacao.operacoes.map(item => item.id)).size, 5);
  assert.ok(transacao.operacoes.every(item => item.dados.statusNotificacao === 'nova'));
  assert.ok(transacao.operacoes.every(item => item.dados.expiraEm instanceof Date));
});

test('destinatário individual é usado para pedido pronto e não amplia a fila', () => {
  const destinos = notificacoes.destinatariosParaEvento(notificacoes.TIPOS_NOTIFICACAO.pedidoPronto, 'garcom-1');
  assert.equal(destinos[0].papelDestino, 'garcom');
  assert.equal(destinos[0].idUsuarioDestino, 'garcom-1');
  assert.equal(destinos.filter(item => item.papelDestino === 'garcom').length, 1);
  assert.ok(destinos.some(item => item.papelDestino === 'gerente'));
});

test('visibilidade respeita papel, usuário destinado e expiração', () => {
  const identidadeGarcom = { idUsuario: 'garcom-1', papeis: ['garcom'] };
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'garcom', idUsuarioDestino: null, expiraEm: new Date(Date.now() + 10000) }, identidadeGarcom), true);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'garcom', idUsuarioDestino: 'garcom-2', expiraEm: new Date(Date.now() + 10000) }, identidadeGarcom), false);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'garcom', idUsuarioDestino: null, expiraEm: new Date(Date.now() - 10000) }, identidadeGarcom), false);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'caixa', idUsuarioDestino: null, expiraEm: new Date(Date.now() + 10000) }, identidadeGarcom), false);
});

test('handler autenticado usa GET/POST/PATCH, CSRF em mutação e endpoint operacional consolidado', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const dispatcher = ler('api/v1/operacional.js');
  assert.match(handler, /metodos: \['GET', 'POST', 'PATCH'\]/);
  assert.match(handler, /mutacao, appCheck: true/);
  assert.match(handler, /obterIdentidadeOperacional\(req, PAPEIS_NOTIFICACOES_LEITURA(?:,\s*\[[^\]]+\])?\)/);
  assert.match(handler, /runTransaction/);
  assert.match(handler, /chavesIdempotencia/);
  assert.match(dispatcher, /notificacoes: require\('\.\.\/_lib\/notificacoes-handler'\)/);
  assert.equal(fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js')).length, 4);
});

test('emissão está conectada ao pedido público, transições QR e fila do caixa', () => {
  const qr = ler('api/_lib/qrcode-mesas.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  for (const conteudo of [qr, pedidos, financeiro]) assert.match(conteudo, /criarNotificacoesNaTransacao/);
  assert.match(qr, /TIPOS_NOTIFICACAO\.novoPedidoGarcom/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.pedidoEnviadoCozinha/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.pedidoPronto/);
  assert.match(pedidos, /TIPOS_NOTIFICACAO\.comandaEncaminhadaCaixa/);
  assert.match(financeiro, /TIPOS_NOTIFICACAO\.comandaRecebidaCaixa/);
  assert.match(financeiro, /TIPOS_NOTIFICACAO\.atendimentoEncerrado/);
});

test('cliente same-origin e central não usam Firebase client, storage local ou credenciais', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  const controller = ler('scripts/compartilhados/notificacoes.js');
  assert.match(cliente, /listarNotificacoes/);
  assert.match(cliente, /atualizarNotificacao/);
  assert.match(controller, /apexModulosApi\.listarNotificacoes/);
  assert.match(controller, /apexModulosApi\.atualizarNotificacao/);
  assert.match(controller, /button\[aria-label\^="Notificações"\]/);
  assert.match(controller, /data-apex-notificacoes-trigger/);
  assert.match(controller, /evento\.target\.closest/);
  const index = ler('index.html');
  assert.match(index, /data-apex-notificacoes-trigger="true"/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|firebase|FIREBASE_PRIVATE_KEY|idToken/i);
});

test('shell versiona os assets e preserva o shell único', () => {
  const index = ler('index.html');
  assert.match(index, /apex-shell\.js\?v=fase61-desenvolvedor-global/);
  assert.match(index, /scripts\/api\/modulos-client\.js\?v=fase61-desenvolvedor-global/);
  assert.match(index, /scripts\/compartilhados\/notificacoes\.js\?v=etapa14-header-notificacoes/);
  assert.equal((index.match(/id="sidebarContentDesktop"/g) || []).length, 1);
  assert.equal((index.match(/id="conteudoPagina"/g) || []).length, 1);
});
