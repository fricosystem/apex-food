const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('bridge de Pedidos inicia vazio, consulta dados reais e mantém estados operacionais', () => {
  const bridge = ler('scripts/pedidos/dados-pedidos.js');
  assert.doesNotMatch(bridge, /dadosPedidosPreview|ambientePedidosLocal|localhost|Pizza Margherita|PED-45/);
  assert.match(bridge, /window\.dadosPedidosApexFood = estadoPedidosVazio/);
  assert.match(bridge, /listarPedidos\(\{ limite: 300 \}\)/);
  assert.match(bridge, /listarCardapio\(\)/);
  assert.match(bridge, /listarSalao\('mesas'\)/);
  assert.match(bridge, /listarEquipe\('funcionarios'\)/);
  assert.match(bridge, /statusPedidos\[status\]/);
});

test('bridge de Financeiro inicia vazio e substitui o estado somente após resposta real', () => {
  const bridge = ler('scripts/financeiro/dados-financeiros.js');
  assert.doesNotMatch(bridge, /dadosFinanceirosPreview|emPreviewLocal|localhost|MOV-08|Hortifruti Verde Vida/);
  assert.match(bridge, /window\.dadosFinanceirosApexFood = \{/);
  assert.match(bridge, /listarFinanceiro\('', parametros\)/);
  assert.match(bridge, /meta\?\.idRestaurante/);
  assert.match(bridge, /apex:financeiro-atualizado/);
});

test('bridge de Equipe inicia vazio, consulta as três coleções reais e atualiza com backoff', () => {
  const bridge = ler('scripts/equipe/dados-equipe.js');
  assert.doesNotMatch(bridge, /preview|localhost|FUN-00[1-9]|João Mendes|Agosto\/2026/i);
  assert.match(bridge, /window\.dadosEquipeApexFood = estadoVazio\(\)/);
  assert.match(bridge, /listarEquipe\(\)/);
  assert.match(bridge, /funcionarios: \(dados\.funcionarios \|\| \[\]\)/);
  assert.match(bridge, /escalas: \(dados\.escalas \|\| \[\]\)/);
  assert.match(bridge, /comissoes: \(dados\.comissoes \|\| \[\]\)/);
  assert.match(bridge, /setTimeout/);
  assert.match(bridge, /beforeunload/);
});

test('formulário de Escala não embute funcionários fictícios', () => {
  const pagina = ler('paginas/equipe/escala-trabalho.html');
  assert.match(pagina, /Nenhum funcionário disponível/);
  assert.doesNotMatch(pagina, /FUN-00[1-9]|João Mendes|Maria Oliveira|Pedro Santos/);
});

test('shell versiona os módulos na integração global de dados reais', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  for (const termo of ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global']) assert.match(shell, new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(index, /modulos-client\.js\?v=fase61-desenvolvedor-global/);
  assert.match(index, /apex-shell\.js\?v=fase61-desenvolvedor-global/);
});
