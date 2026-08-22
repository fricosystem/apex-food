const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const documento = (id, dados) => ({ id, ref: { id }, data: () => dados });
const cozinha = require('../api/_lib/cozinha-distribuicao');

test('produtos e funcionários expõem os contratos de preparo da cozinha', () => {
  const cardapio = ler('api/_lib/cardapio-handler.js');
  const equipe = ler('api/_lib/equipe.js');
  const funcionarios = ler('paginas/equipe/funcionarios.html');
  const produtos = ler('paginas/cardapio/produtos.html');
  for (const campo of ['especialidadesNecessarias', 'estacoesNecessarias']) assert.match(cardapio, new RegExp(campo));
  for (const campo of ['especialidadesCozinha', 'estacoesCozinha', 'capacidadeTarefas']) assert.match(equipe, new RegExp(campo));
  assert.match(funcionarios, /Capacidade de tarefas/);
  assert.match(funcionarios, /Especialidades de cozinha/);
  assert.match(funcionarios, /id="listaEspecialidadesCozinhaFuncionario"/);
  assert.match(funcionarios, /id="listaEstacoesCozinhaFuncionario"/);
  assert.match(produtos, /id="listaEspecialidadesNecessariasProduto"/);
  assert.match(produtos, /id="listaEstacoesNecessariasProduto"/);
});

test('listas de preparo são normalizadas no servidor e produtos legados continuam com listas vazias', () => {
  const cardapio = ler('api/_lib/cardapio-handler.js');
  assert.match(cardapio, /listaCodigosOperacionais/);
  assert.match(cardapio, /Array\.isArray\(corpo\.especialidadesNecessarias\)/);
  assert.match(cardapio, /Array\.isArray\(corpo\.estacoesNecessarias\)/);
  const dados = ler('scripts/cardapio/dados-cardapio.js');
  assert.match(dados, /especialidadesNecessarias: Array\.isArray/);
  assert.match(dados, /estacoesNecessarias: Array\.isArray/);
});

test('pontuação da cozinha aplica carga de tarefas, pedidos e comandas', () => {
  const pontuacao = cozinha.pontuacaoCozinheiro({ tarefasAtivas: 1, pedidosPendentes: 2, comandasAtivas: 1 }, { capacidadeTarefas: 2, capacidadePedidos: 4, capacidadeComandas: 2 });
  assert.equal(pontuacao, 0.5);
});

test('seleção da cozinha exige papel, setor, disponibilidade, escala e compatibilidade', () => {
  const selecionado = cozinha.selecionarCozinheiroResponsavel({
    funcionariosDocumentos: [
      documento('COZ-1', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'cozinha', disponibilidadeAtendimento: 'disponivel', especialidadesCozinha: ['massas'], estacoesCozinha: ['forno'], capacidadeTarefas: 4, capacidadePedidos: 4, capacidadeComandas: 4 }),
      documento('COZ-2', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'cozinha', disponibilidadeAtendimento: 'disponivel', especialidadesCozinha: ['chapa'], estacoesCozinha: ['chapa'], capacidadeTarefas: 4, capacidadePedidos: 4, capacidadeComandas: 4 }),
      documento('GAR-1', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', especialidadesCozinha: ['massas'], estacoesCozinha: ['forno'], capacidadeTarefas: 4, capacidadePedidos: 4, capacidadeComandas: 4 }),
    ],
    tarefa: { especialidadesNecessarias: ['massas'], estacoesNecessarias: ['forno'] },
  });
  assert.equal(selecionado.id, 'COZ-1');
  assert.equal(cozinha.selecionarCozinheiroResponsavel({ funcionariosDocumentos: [documento('COZ-3', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'cozinha', disponibilidadeAtendimento: 'indisponivel', especialidadesCozinha: ['massas'], estacoesCozinha: ['forno'] })], tarefa: { especialidadesNecessarias: ['massas'], estacoesNecessarias: ['forno'] } }), null);
});

test('desempate da cozinha é determinístico por prioridade, atribuição anterior e ID', () => {
  const selecionado = cozinha.selecionarCozinheiroResponsavel({ funcionariosDocumentos: [
    documento('COZ-2', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'cozinha', disponibilidadeAtendimento: 'disponivel', capacidadeTarefas: 4, capacidadePedidos: 4, capacidadeComandas: 4, prioridadeDistribuicao: 1 }),
    documento('COZ-1', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'cozinha', disponibilidadeAtendimento: 'disponivel', capacidadeTarefas: 4, capacidadePedidos: 4, capacidadeComandas: 4, prioridadeDistribuicao: 0 }),
  ], tarefa: {} });
  assert.equal(selecionado.id, 'COZ-1');
});

test('tarefasDoPedido cria uma tarefa por item com exigências e observações', () => {
  const tarefas = cozinha.tarefasDoPedido({ itens: [{ idProduto: 'PRD-1', nome: 'Lasanha', quantidade: 2, observacoes: 'Sem cebola', especialidadesNecessarias: ['massas'], estacoesNecessarias: ['forno'] }] });
  assert.equal(tarefas.length, 1);
  assert.deepEqual(tarefas[0], { indice: 0, idProduto: 'PRD-1', nomeProduto: 'Lasanha', quantidade: 2, observacoes: 'Sem cebola', ingredientes: [], ingredientesMantidos: [], ingredientesRemovidos: [], especialidadesNecessarias: ['massas'], estacoesNecessarias: ['forno'] });
});

test('distribuição gera fila geral quando não há cozinheiro compatível', () => {
  const operacoes = [];
  const transacao = { set: (...args) => operacoes.push(['set', ...args]), update: (...args) => operacoes.push(['update', ...args]) };
  const restaurante = { collection: () => ({ doc: () => ({ id: 'EVT-1' }) }) };
  const resultado = cozinha.distribuirTarefasCozinha({ transacao, restaurante, idRestaurante: 'REST-1', fichaRef: { id: 'PED-1', collection: () => ({ doc: () => ({ id: '001' }) }) }, pedido: { id: 'PED-1', itens: [{ idProduto: 'PRD-1', nome: 'Produto', quantidade: 1, especialidadesNecessarias: ['inexistente'] }] }, funcionariosDocumentos: [], idAtor: 'USR-1' });
  assert.equal(resultado.statusDistribuicaoCozinha, 'aguardando_atribuicao');
  assert.equal(resultado.tarefasAguardandoAtribuicao, 1);
  assert.ok(operacoes.some(item => item[0] === 'set'));
});

test('ficha e tarefa usam coleções em português e status agregados', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const distribuidor = ler('api/_lib/cozinha-distribuicao.js');
  const tarefas = ler('api/_lib/cozinha-tarefas-handler.js');
  assert.match(pedidos, /collection\('fichasCozinha'\)/);
  assert.match(pedidos, /const fichaRef = restaurante\.collection\('fichasCozinha'\)\.doc\(pedidoRef\.id\)/);
  assert.match(pedidos, /recurso === 'fichas' \? 'fichasCozinha'/);
  assert.match(pedidos, /statusDistribuicaoCozinha/);
  assert.match(distribuidor, /collection\('tarefas'\)/);
  assert.match(distribuidor, /cozinheiro_atribuido/);
  assert.match(tarefas, /todasProntas/);
  assert.match(tarefas, /statusFicha/);
  assert.match(tarefas, /TAREFA_FORA_DO_ESCOPO/);
});

test('transição de tarefa é idempotente e lê dependências antes de gravar', () => {
  const tarefas = ler('api/_lib/cozinha-tarefas-handler.js');
  assert.match(tarefas, /chavesIdempotencia/);
  assert.match(tarefas, /hashPayload/);
  assert.match(tarefas, /tarefaRef\.collection\('historicoStatus'\)/);
  assert.ok(tarefas.indexOf('transacao.get\(funcionarioRef\)') < tarefas.indexOf('transacao.update\(tarefaRef'));
  assert.ok(tarefas.indexOf('transacao.get\(mesaRef\)') < tarefas.indexOf('transacao.update\(tarefaRef'));
});

test('cliente e fila usam a ação individual de tarefa sem retirar o fluxo legado', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  const fila = ler('scripts/pedidos/fila-cozinha.js');
  const dados = ler('scripts/pedidos/dados-pedidos.js');
  assert.match(cliente, /listarFichasCozinha/);
  assert.match(cliente, /atualizarTarefaCozinha/);
  assert.match(fila, /data-acao-tarefa/);
  assert.match(fila, /atualizarTarefaCozinha/);
  assert.match(fila, /Fluxo legado/);
  assert.match(dados, /fichasCozinha/);
});

test('produto e funcionário enviam listas ao endpoint real', () => {
  const produtos = ler('scripts/cardapio/produtos.js');
  const funcionarios = ler('scripts/equipe/funcionarios.js');
  assert.match(produtos, /especialidadesNecessarias: lerListaRequisitoProduto/);
  assert.match(produtos, /estacoesNecessarias: lerListaRequisitoProduto/);
  assert.match(funcionarios, /especialidadesCozinha: lerListaEquipe/);
  assert.match(funcionarios, /estacoesCozinha: lerListaEquipe/);
});

test('não há nova função serverless para a Fase 4 e assets foram versionados', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(shell, /etapa27-cozinha-distribuicao/);
  assert.match(pedidos, /tarefaCozinha/);
  const funcoes = fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js'));
  assert.equal(funcoes.length, 4);
  assert.equal(fs.existsSync(path.join(raiz, '.github', 'workflows')), false);
});
