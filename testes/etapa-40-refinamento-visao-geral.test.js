'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');
const { internals } = require('../api/_lib/visao-geral-handler');

test('período anterior mantém a mesma duração e termina antes do período atual', () => {
  assert.deepEqual(internals.periodoAnterior({ tipo: 'dia', inicio: '2026-08-21', fim: '2026-08-21' }), { tipo: 'comparacao', inicio: '2026-08-20', fim: '2026-08-20' });
  assert.deepEqual(internals.periodoAnterior({ tipo: 'semana', inicio: '2026-08-15', fim: '2026-08-21' }), { tipo: 'comparacao', inicio: '2026-08-08', fim: '2026-08-14' });
  assert.deepEqual(internals.periodoAnterior({ tipo: 'personalizado', inicio: '2026-08-10', fim: '2026-08-12' }), { tipo: 'comparacao', inicio: '2026-08-07', fim: '2026-08-09' });
});

test('variação real não divide por zero e classifica alta, baixa e estabilidade', () => {
  assert.deepEqual(internals.compararValores(12500, 10000), { disponivel: true, atual: 12500, anterior: 10000, percentual: 25, direcao: 'alta' });
  assert.equal(internals.compararValores(8000, 10000).direcao, 'baixa');
  assert.equal(internals.compararValores(10000, 10000).direcao, 'estavel');
  assert.equal(internals.compararValores(100, 0).disponivel, false);
});

test('comparações usam vendas, pedidos, ticket, despesas, resultado e avaliações', () => {
  const atual = { totalVendasCentavos: 15000, totalPedidos: 3, despesasTotalCentavos: 3000 };
  const anterior = { totalVendasCentavos: 10000, totalPedidos: 2, despesasTotalCentavos: 2500 };
  const atualAvaliacoes = { indicadores: { totalAvaliacoes: 4, notaMedia: 4.5 } };
  const anteriorAvaliacoes = { indicadores: { totalAvaliacoes: 2, notaMedia: 4 } };
  const comparacoes = internals.construirComparacoes(atual, anterior, atualAvaliacoes, anteriorAvaliacoes);
  assert.equal(comparacoes.vendas.percentual, 50);
  assert.equal(comparacoes.pedidos.percentual, 50);
  assert.equal(comparacoes.ticketMedio.percentual, 0);
  assert.equal(comparacoes.despesas.percentual, 20);
  assert.equal(comparacoes.resultado.percentual, 60);
  assert.equal(comparacoes.avaliacoes.percentual, 100);
  assert.equal(comparacoes.notaMedia.percentual, 12.5);
});

test('contrato da resposta mantém período anterior e série de canal anterior', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  const ponte = ler('scripts/home/dados-visao-geral.js');
  assert.match(handler, /periodoAnterior\(periodo\)/);
  assert.match(handler, /periodo: \{ \.\.\.periodo, anterior: periodoAnteriorAtual \}/);
  assert.match(handler, /vendasPorCanalAnterior: seriesAnterior\.vendasPorCanal/);
  assert.match(handler, /comparacoes/);
  assert.match(ponte, /setTimeout/);
  assert.match(ponte, /document\.hidden/);
  assert.match(ponte, /visibilitychange/);
  assert.match(ponte, /apexVisaoGeralPararAtualizacao/);
  assert.doesNotMatch(ponte, /setInterval/);
});

test('indicadores da Home exibem comparações e mantêm atualização manual', () => {
  const home = ler('scripts/home/home.js');
  const fragmento = ler('paginas/home.html');
  for (const id of ['homeFaturamentoComparacao', 'homeTicketComparacao', 'homePedidosComparacao']) assert.match(fragmento, new RegExp(`id="${id}"`));
  assert.match(home, /comparacoesDoCanal/);
  assert.match(home, /textoComparacao/);
  assert.match(home, /homeFaturamentoComparacao/);
  assert.match(home, /homeAtualizarDados/);
});

test('atualização automática só agenda quando a Visão Geral está ativa', () => {
  const ponte = ler('scripts/home/dados-visao-geral.js');
  assert.match(ponte, /paginaVisaoGeralAtiva/);
  assert.match(ponte, /!paginaVisaoGeralAtiva\(\)/);
  assert.match(ponte, /if \(document\.hidden\) pararAtualizacao\(\)/);
});

test('feedback de sincronização e comparações está presente na interface', () => {
  const home = ler('scripts/home/home.js');
  const ponte = ler('scripts/home/dados-visao-geral.js');
  assert.match(home, /dataHoraParaBR/);
  assert.match(home, /Atualização automática ativa/);
  assert.match(home, /Não foi possível atualizar os dados agora/);
  assert.match(ponte, /dados\.sincronizando = true/);
  assert.match(ponte, /dados\.sincronizando = false/);
  assert.match(ponte, /Math\.min\(60000/);
});

test('série anterior por canal é transportada para comparação específica', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  const bridge = ler('scripts/home/dados-visao-geral.js');
  const home = ler('scripts/home/home.js');
  assert.match(handler, /vendasPorCanalAnterior/);
  assert.match(bridge, /vendasPorCanalAnterior/);
  assert.match(home, /relatorios\.vendasPorCanalAnterior/);
  assert.match(home, /ticketMedio: compararValoresLocal/);
});

test('assets da Etapa 17 usam versão própria sem alterar a estrutura do shell', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /home\.html\?v=etapa17-visao/);
  assert.match(shell, /dados-visao-geral\.js\?v=etapa17-visao/);
  assert.match(shell, /home\.js\?v=etapa17-visao/);
  assert.match(index, /apex-shell\.js\?v=etapa36-comanda-clean/);
  assert.ok(fs.readdirSync(path.join(raiz, 'api', 'v1')).length <= 12);
});
