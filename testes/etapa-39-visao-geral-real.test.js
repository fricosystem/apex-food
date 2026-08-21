'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');
const { internals } = require('../api/_lib/visao-geral-handler');

const periodo = { tipo: 'mes', inicio: '2026-08-01', fim: '2026-08-31' };
const documento = (id, dados) => ({ id, dados });

function pedido(id, dados = {}) {
  return internals.normalizarPedido(documento(id, dados));
}

function movimentacao(id, dados = {}) {
  return internals.normalizarMovimentacao(documento(id, dados));
}

test('séries reais ignoram pedidos cancelados e agregam despesas do caixa em centavos', () => {
  const pedidos = [
    pedido('p-1', { data: '2026-08-21', estado: 'finalizado', totalCentavos: 12345, horario: '12:30', canal: 'salao' }),
    pedido('p-2', { data: '2026-08-22', estado: 'cancelado', totalCentavos: 9000, horario: '19:30', canal: 'delivery' }),
  ];
  const saidas = [movimentacao('m-1', { data: '2026-08-21', tipo: 'saida', valorCentavos: 1000, estado: 'conciliado' })];
  const resultado = internals.construirSeries(pedidos, periodo, saidas, []);
  assert.equal(resultado.totalVendasCentavos, 12345);
  assert.equal(resultado.totalPedidos, 1);
  assert.equal(resultado.despesasTotalCentavos, 1000);
  assert.deepEqual(resultado.vendasDiarias[0], {
    data: '2026-08-21',
    label: '21/08',
    pedidos: 1,
    vendasCentavos: 12345,
    despesasCentavos: 1000,
    vendas: 123.45,
    despesas: 10,
    resultado: 113.45,
    ticketMedio: 123.45,
  });
  assert.equal(resultado.vendasSemanais[0].despesas, 10);
  assert.equal(resultado.vendasSemanais[0].resultado, 113.45);
  assert.equal(resultado.picos.picoAlmoco, '12h–13h');
  assert.equal(resultado.picos.picoJantar, '—');
});

test('séries mensais usam chave cronológica e relatório financeiro como complemento real', () => {
  const pedidos = [pedido('p-1', { data: '2026-08-21', estado: 'concluido', totalCentavos: 5000, horario: '19:10' })];
  const relatorios = [{ chaveMes: '2026-08', mes: 'Ago/2026', vendasCentavos: 5000, despesasCentavos: 2300, categorias: [] }];
  const resultado = internals.construirSeries(pedidos, periodo, [], relatorios);
  assert.equal(resultado.vendasMensais.length, 1);
  assert.equal(resultado.vendasMensais[0].periodo, 'Ago/2026');
  assert.equal(resultado.vendasMensais[0].despesas, 23);
  assert.equal(resultado.despesasTotalCentavos, 2300);
  assert.equal(resultado.vendasSemanais[0].resultado, 27);
  assert.equal(resultado.picos.picoJantar, '19h–20h');
});

test('categorias por pedidos usam o produto e o catálogo do restaurante ativo', () => {
  const pedidos = [pedido('p-1', { data: '2026-08-21', estado: 'servido', itens: [
    { produtoId: 'produto-1', categoriaId: 'categoria-1', quantidade: 2, subtotalCentavos: 3000 },
    { produtoId: 'produto-2', categoriaId: 'categoria-2', quantidade: 1, subtotalCentavos: 1200 },
  ] })];
  const produtos = [documento('produto-1', { nome: 'Prato executivo', categoriaId: 'categoria-1' }), documento('produto-2', { nome: 'Suco', categoriaId: 'categoria-2' })];
  const categorias = [documento('categoria-1', { nome: 'Pratos' }), documento('categoria-2', { nome: 'Bebidas' })];
  const resultado = internals.construirCategoriasDePedidos(pedidos, produtos, categorias, periodo);
  assert.deepEqual(resultado.map(item => item.nome), ['Pratos', 'Bebidas']);
  assert.deepEqual(resultado.map(item => item.valor), [30, 12]);
  assert.deepEqual(resultado.map(item => item.percentual), [71, 29]);
});

test('avaliações reais retornam DTO público, distribuição e taxa de resposta', () => {
  const avaliacoes = [
    documento('a-1', { data: '2026-08-10', nota: 5, nomeCliente: 'Ana Lima', comentario: 'Excelente', categoria: 'Atendimento', respondida: true, canal: 'salao' }),
    documento('a-2', { data: '2026-08-11', nota: 3, nomeCliente: 'Bruno Alves', comentario: 'Regular', respondida: false, canal: 'delivery' }),
    documento('a-3', { data: '2026-09-01', nota: 1, nomeCliente: 'Fora do período' }),
  ];
  const resultado = internals.construirAvaliacoes(avaliacoes, periodo);
  assert.equal(resultado.indicadores.totalAvaliacoes, 2);
  assert.equal(resultado.indicadores.notaMedia, 4);
  assert.equal(resultado.indicadores.taxaResposta, 50);
  assert.equal(resultado.distribuicaoNotas.find(item => item.nota === 5).quantidade, 1);
  assert.equal(resultado.avaliacoes[0].iniciais, 'BA');
  assert.equal(resultado.avaliacoes[0].data, '11/08/2026');
});

test('reservas preservam data ISO para filtros e data brasileira para exibição', () => {
  const reserva = internals.normalizarReserva(documento('r-1', { inicioEm: '2026-08-24T19:30:00.000Z', nomeCliente: 'Carlos Souza', idMesa: 'mesa-4', quantidadePessoas: 4, estado: 'confirmada' }));
  assert.equal(reserva.dataIso, '2026-08-24');
  assert.equal(reserva.data, '24/08/2026');
  assert.equal(reserva.horario, '19:30');
  assert.equal(reserva.mesa, 'mesa-4');
});

test('contrato server-side consulta relatórios e não aceita restaurante pelo frontend', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  const home = ler('scripts/home/home.js');
  const ponte = ler('scripts/home/dados-visao-geral.js');
  assert.match(handler, /relatoriosFinanceiros/);
  assert.match(handler, /caminhoRestaurante\(identidade\.idRestaurante\)/);
  assert.match(handler, /obterIdentidadeOperacional\(req, PAPEIS_LEITURA\)/);
  assert.match(home, /reserva\.dataIso \|\| dataBRParaISO/);
  assert.match(home, /aguardando_confirmacao_garcom/);
  assert.match(ponte, /listarVisaoGeral\((?:parametros|ultimosParametros)\)/);
  assert.doesNotMatch(home, /firebase|FIREBASE_PRIVATE_KEY|SESSION_SECRET|localStorage|sessionStorage/i);
});

test('indicadores reais são expostos no contrato do agregador para todos os blocos da Home', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  for (const campo of ['despesasCentavos', 'resultadoCentavos', 'picoAlmoco', 'picoJantar', 'totalAvaliacoes', 'categoriasVisao', 'avaliacoes']) {
    assert.match(handler, new RegExp(campo));
  }
});

test('série por canal e controles da Home permanecem disponíveis sem bridges paralelas', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  const shell = ler('scripts/shell/apex-shell.js');
  const fragmento = ler('paginas/home.html');
  const renderer = ler('scripts/home/home.js');
  assert.match(handler, /vendasPorCanal/);
  assert.match(handler, /normalizarCanal/);
  assert.match(shell, /dados-visao-geral\.js\?v=etapa17-visao/);
  assert.match(shell, /home\.js\?v=etapa17-visao/);
  for (const id of ['homeAlternarGrafico', 'homeAtualizarDados', 'homeAlternarMesas', 'homeBuscaPedidos', 'homeExportarPedidos', 'homeImprimirPedidos']) {
    assert.match(fragmento, new RegExp(`id="${id}"`));
  }
  assert.match(renderer, /agruparSeriePorCanal/);
  assert.match(renderer, /exportarPedidos/);
  assert.match(renderer, /apexVisaoGeralRecarregar/);
});

test('série por canal normaliza rótulos e mantém valores reais separados', () => {
  const pedidos = [
    pedido('p-1', { data: '2026-08-21', estado: 'finalizado', totalCentavos: 10000, canal: 'salao' }),
    pedido('p-2', { data: '2026-08-21', estado: 'finalizado', totalCentavos: 5000, canal: 'delivery' }),
  ];
  const resultado = internals.construirSeries(pedidos, periodo, [], []);
  assert.deepEqual(resultado.canais.map(item => [item.id, item.nome, item.vendas]), [['salao', 'Restaurante', 100], ['delivery', 'Delivery', 50]]);
  assert.deepEqual(resultado.vendasPorCanal.map(item => [item.canal, item.data, item.vendas]), [['delivery', '2026-08-21', 50], ['salao', '2026-08-21', 100]]);
});

test('Home atualiza mesas e reservas depois da resposta e não mantém hashes nos módulos', () => {
  const renderer = ler('scripts/home/home.js');
  const fragmento = ler('paginas/home.html');
  assert.match(renderer, /mesasAtuais/);
  assert.match(renderer, /reservasAtuais/);
  assert.doesNotMatch(fragmento, /href="#\//);
  for (const rota of ['/operacional', '/relatorios-financeiros', '/mapa-mesas', '/produtos-mais-vendidos', '/avaliacoes-clientes', '/performance-equipe']) {
    assert.match(fragmento, new RegExp(`href="${rota}"`));
  }
});
