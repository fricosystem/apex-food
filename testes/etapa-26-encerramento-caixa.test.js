'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('contrato financeiro define fila operacional de comandas do caixa', () => {
  const financeiro = ler('api/_lib/financeiro.js');
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(financeiro, /PAPEIS_LEITURA_CAIXA/);
  assert.match(financeiro, /PAPEIS_MUTACAO_CAIXA/);
  assert.match(financeiro, /ESTADOS_ENCAMINHAMENTO_CAIXA/);
  assert.match(financeiro, /encaminhada.*recebida.*concluida.*cancelada/);
  assert.match(financeiro, /dtoEncaminhamentoCaixa/);
  assert.match(handler, /encaminhamentosCaixa/);
  assert.match(handler, /atualizarEncaminhamentoCaixa/);
});

test('garçom encaminha somente comanda em consumo sem pedidos pendentes', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /async function encaminharComandaCaixa/);
  assert.match(handler, /statusComanda !== 'em_consumo'/);
  assert.match(handler, /COMANDA_COM_PEDIDOS_PENDENTES/);
  assert.match(handler, /COMANDA_SEM_PEDIDOS/);
  assert.match(handler, /statusComanda: 'encaminhada_caixa'/);
  assert.match(handler, /estadoAtendimento: 'encaminhada_caixa'/);
  assert.match(handler, /collection\('encaminhamentosCaixa'\)/);
  assert.match(handler, /chaveIdempotencia/);
});

test('caixa recebe e conclui encaminhamento com transação e estados fechados', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /async function atualizarEncaminhamentoCaixa/);
  assert.match(handler, /statusEncaminhamento: para/);
  assert.match(handler, /de === 'encaminhada' && \['recebida', 'cancelada'\]/);
  assert.match(handler, /de === 'recebida' && para === 'concluida'/);
  assert.match(handler, /statusComanda: 'encerrada'/);
  assert.match(handler, /estado: 'disponivel'/);
  assert.match(handler, /estadoAtendimento: null/);
  assert.match(handler, /idComandaAberta: null/);
  assert.match(handler, /estadoSessao: 'encerrada'/);
  assert.match(handler, /estadoParticipante: 'encerrado'/);
  assert.match(handler, /runTransaction/);
});

test('conclusão do caixa bloqueia pedidos ainda pendentes e usa idempotência', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /const estadosPendentes = new Set/);
  assert.match(handler, /COMANDA_COM_PEDIDOS_PENDENTES/);
  assert.match(handler, /collection\('chavesIdempotencia'\)/);
  assert.match(handler, /IDEMPOTENCIA_REUTILIZADA/);
  assert.match(handler, /hashPayload/);
  assert.match(handler, /repetido: reutilizado/);
});

test('cliente same-origin expõe encaminhamento e operações do caixa sem credenciais locais', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /listarEncaminhamentosCaixa/);
  assert.match(cliente, /atualizarEncaminhamentoCaixa/);
  assert.match(cliente, /encaminharComandaCaixa/);
  assert.match(cliente, /X-CSRF-Token/);
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage|sessionStorage/);
});

test('fechamento de caixa apresenta a fila operacional sem processar pagamentos', () => {
  const pagina = ler('paginas/financeiro/fechamento-caixa.html');
  const controller = ler('scripts/financeiro/fechamento-caixa.js');
  assert.match(pagina, /Comandas encaminhadas ao caixa/);
  assert.match(pagina, /listaEncaminhamentosCaixa/);
  assert.match(pagina, /não processa pagamentos/);
  assert.match(controller, /Confirmar recebimento/);
  assert.match(controller, /Concluir atendimento/);
  assert.match(controller, /atualizarEncaminhamentoCaixa/);
  assert.match(controller, /chaveIdempotencia/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|cartão|CVV|senha/);
});

test('pedidos servidos permanecem visíveis até o encaminhamento da comanda', () => {
  const dados = ler('scripts/pedidos/dados-pedidos.js');
  const pagina = ler('paginas/pedidos/pedidos-ativos.html');
  const controller = ler('scripts/pedidos/pedidos-ativos.js');
  assert.match(dados, /'servido'\.includes|includes\(item\.status\).*servido|pronto', 'servido'/);
  assert.match(pagina, /encaminharCaixaModalPedido/);
  assert.match(controller, /encaminharComandaAoCaixa/);
  assert.match(controller, /status !== 'servido'/);
  assert.match(controller, /encaminharComandaCaixa/);
});

test('mapa de mesas reflete encaminhamento ao caixa e liberação posterior', () => {
  const dados = ler('scripts/salao/dados-mesas.js');
  const mapa = ler('scripts/salao/mapa-mesas.js');
  assert.match(dados, /estadoAtendimento: mesa\.estadoAtendimento/);
  assert.match(mapa, /encaminhada_caixa/);
  assert.match(mapa, /Encaminhada ao caixa/);
  assert.match(mapa, /mesa\.status === 'disponivel'/);
});

test('assets alterados preservam etapas anteriores e atualizam o caixa na Etapa 7', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /pedidos-ativos[^\n]*etapa19-fluxo-operacional/);
  assert.match(shell, /mapa-mesas[^\n]*etapa21-salao-tempo-real/);
  assert.match(shell, /fechamento-caixa[^\n]*etapa19-fluxo-operacional/);
  assert.match(index, /apex-shell\.js\?v=etapa37-mesa-sem-flicker/);
});
