const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('produto aceita lista de ingredientes validada no servidor', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  assert.match(handler, /function listaIngredientes\(valor/);
  assert.match(handler, /ingredientes = listaIngredientes\(corpo\.ingredientes/);
  assert.match(handler, /const ingredientes = listaIngredientes\(corpo\.ingredientes, 'ingredientes'\)/);
  assert.match(handler, /ingredientes,\n  \};/);
  assert.match(handler, /INGREDIENTES_DUPLICADOS/);
});

test('produto permite persistir ingredientes na criação e edição', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  assert.match(handler, /const ingredientes = listaIngredientes\(corpo\.ingredientes, 'ingredientes'\)/);
  assert.match(handler, /if \(corpo\.ingredientes !== undefined\) atualizacoes\.ingredientes = listaIngredientes/);
});

test('cardápio público expõe apenas o snapshot seguro de ingredientes', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /function ingredientesProdutoPublicos\(valor\)/);
  assert.match(helper, /ingredientes: ingredientesProdutoPublicos\(dados\.ingredientes\)/);
  assert.match(helper, /removivel: dados\.removivel !== false/);
});

test('pedido público valida remoções e deriva mantidos e retirados do produto no servidor', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /function validarIngredientesRemovidos\(valor\)/);
  assert.match(helper, /ingredientesRemovidos: validarIngredientesRemovidos/);
  assert.match(helper, /INGREDIENTE_INVALIDO/);
  assert.match(helper, /INGREDIENTE_NAO_REMOVIVEL/);
  assert.match(helper, /const ingredientesMantidos = ingredientes\.filter/);
  assert.match(helper, /const ingredientesRemovidos = ingredientes\.filter/);
  assert.match(helper, /ingredientesMantidos: item\.ingredientesMantidos/);
});

test('snapshot de ingredientes é copiado para a ficha e a tarefa da cozinha', () => {
  const distribuicao = ler('api/_lib/cozinha-distribuicao.js');
  const tarefas = ler('api/_lib/cozinha-tarefas-handler.js');
  const detalhes = ler('api/_lib/detalhes-comanda.js');
  assert.match(distribuicao, /ingredientes: Array\.isArray\(item\.ingredientes\)/);
  assert.match(distribuicao, /ingredientesMantidos: tarefa\.ingredientesMantidos/);
  assert.match(distribuicao, /ingredientesRemovidos: tarefa\.ingredientesRemovidos/);
  assert.match(tarefas, /ingredientesRemovidos: Array\.isArray\(dados\.ingredientesRemovidos\)/);
  assert.match(detalhes, /ingredientesMantidos: Array\.isArray\(tarefa\.data\(\)\?\.ingredientesMantidos\)/);
});

test('modal Editar produto possui lista dinâmica e salva ingredientes no payload', () => {
  const pagina = ler('paginas/cardapio/produtos.html');
  const script = ler('scripts/cardapio/produtos.js');
  assert.match(pagina, /adicionarIngredienteProduto/);
  assert.match(pagina, /listaIngredientesProduto/);
  assert.match(pagina, /Cliente poderá manter ou retirar|cliente poderá manter ou retirar/);
  assert.match(script, /function renderizarIngredientesProduto\(\)/);
  assert.match(script, /function lerIngredientesFormulario\(\)/);
  assert.match(script, /ingredientes: lerIngredientesFormulario\(\)/);
  assert.match(script, /atualizarCardapio\(\{ \.\.\.payload, id: produtoEditandoId \}\)/);
});

test('comanda pública permite personalizar o preparo e envia somente IDs de ingredientes removidos', () => {
  const pagina = ler('paginas/publico/mesa.html');
  const script = ler('scripts/publico/mesa.js');
  assert.match(pagina, /mesaPublicaIngredientesModal/);
  assert.match(pagina, /mesaPublicaIngredientesLista/);
  assert.match(pagina, /mesaPublicaIngredientesConfirmar/);
  assert.match(script, /function abrirPersonalizacao\(produto/);
  assert.match(script, /function confirmarPersonalizacao\(\)/);
  assert.match(script, /ingredientesRemovidos: Array\.isArray\(item\.ingredientesRemovidos\)/);
  assert.match(script, /Personalização adicionada ao carrinho/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
});

test('fila da cozinha mostra o preparo personalizado do cliente', () => {
  const cozinha = ler('scripts/pedidos/fila-cozinha.js');
  assert.match(cozinha, /function personalizacaoCozinhaMarkup\(tarefa\)/);
  assert.match(cozinha, /Manter:/);
  assert.match(cozinha, /Retirar:/);
  assert.match(cozinha, /Preparo do cliente/);
});
