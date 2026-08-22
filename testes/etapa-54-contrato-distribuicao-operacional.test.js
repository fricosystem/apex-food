const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const contrato = () => ler('docs/contrato-distribuicao-operacional-20260822.md');

test('contrato operacional define a sequência completa da comanda até o caixa', () => {
  const texto = contrato();
  for (const estado of ['aberta', 'em_consumo', 'encaminhada_caixa', 'encerrada', 'disponivel']) {
    assert.match(texto, new RegExp('`' + estado + '`'));
  }
  for (const colecao of ['pedidos', 'comandas', 'mesas', 'sessoesMesa', 'fichasCozinha', 'funcionarios', 'encaminhamentosCaixa', 'avaliacoes']) {
    assert.match(texto, new RegExp('`' + colecao + '`'));
  }
});

test('contrato operacional define a máquina de estados QR e ações por papel', () => {
  const texto = contrato();
  for (const estado of ['rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'servido', 'rejeitado_garcom', 'cancelado']) {
    assert.match(texto, new RegExp('`' + estado + '`'));
  }
  for (const papel of ['Garçom responsável', 'Cozinha responsável', 'Supervisor', 'Caixa']) assert.match(texto, new RegExp(papel));
});

test('contrato operacional define os campos de capacidade e disponibilidade da equipe', () => {
  const texto = contrato();
  for (const campo of ['papelOperacional', 'disponibilidadeAtendimento', 'capacidadeMesas', 'capacidadeComandas', 'capacidadePedidos', 'especialidadesCozinha', 'estacoesCozinha', 'cargaAtual', 'ultimaAtribuicaoEm']) {
    assert.match(texto, new RegExp('`' + campo + '`'));
  }
});

test('contrato operacional define algoritmo determinístico de distribuição', () => {
  const texto = contrato();
  assert.match(texto, /menor pontuação/);
  assert.match(texto, /ocupacaoMesas/);
  assert.match(texto, /ocupacaoComandas/);
  assert.match(texto, /ocupacaoPedidos/);
  assert.match(texto, /última atribuição/);
  assert.match(texto, /ID do funcionário/);
  assert.match(texto, /aguardando_atribuicao/);
});

test('contrato operacional define compatibilidade de tarefas da cozinha', () => {
  const texto = contrato();
  for (const termo of ['especialidadesNecessarias', 'estacoesNecessarias', 'fila_geral', 'tarefas por grupo de preparo', 'todas as tarefas estiverem prontas']) assert.match(texto, new RegExp(termo));
});

test('contrato operacional exige motivo e trilha para cancelamentos', () => {
  const texto = contrato();
  for (const termo of ['motivo obrigatório', 'estado terminal', 'ator', 'papel', 'requisição', 'versão do documento', 'chave de idempotência']) assert.match(texto, new RegExp(termo));
});

test('contrato operacional define detalhe completo e ações do caixa', () => {
  const texto = contrato();
  for (const campo of ['idEncaminhamento', 'idComanda', 'idMesa', 'idGarcomResponsavel', 'pedidos', 'totalCentavos', 'statusEncaminhamento']) assert.match(texto, new RegExp(`\\"${campo}\\"`));
  assert.match(texto, /`encaminhada` → `recebida` → `concluida`/);
  assert.match(texto, /não processará pagamento/);
  assert.match(texto, /mesa `disponivel`/);
});

test('contrato operacional define avaliação única pós-caixa', () => {
  const texto = contrato();
  for (const campo of ['nota', 'comentario', 'origem', 'estado']) assert.match(texto, new RegExp(`\\"${campo}\\"`));
  assert.match(texto, /nota será inteira de 1 a 5/);
  assert.match(texto, /mais de uma vez/);
  assert.match(texto, /coleção `avaliacoes`/);
});

test('contrato preserva a arquitetura server-side e o limite de funções', () => {
  const texto = contrato();
  assert.match(texto, /handlers server-side existentes/);
  assert.match(texto, /sem nova função em `api\/v1\/`/);
  assert.match(texto, /App Check/);
  assert.match(texto, /CSRF/);
  assert.match(texto, /preços, cargas e vínculos serão recalculados no servidor/);
});

test('implementação atual contém a base de transições que será expandida', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(pedidos, /TRANSICOES_QR/);
  assert.match(pedidos, /idGarcomResponsavel/);
  assert.match(pedidos, /fichasCozinha/);
  assert.match(pedidos, /encaminhada_caixa/);
  assert.match(financeiro, /statusEncaminhamento/);
  assert.match(financeiro, /estado: 'disponivel'/);
  assert.match(financeiro, /estadoSessao: 'encerrada'/);
});
