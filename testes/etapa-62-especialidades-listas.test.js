'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const equipe = require('../api/_lib/equipe');
const cozinha = require('../api/_lib/cozinha-distribuicao');

function documento(id, dados) {
  return { id, ref: { id }, data: () => dados };
}

test('modais de funcionários e produtos usam listas dinâmicas de habilidades', () => {
  const funcionarios = ler('paginas/equipe/funcionarios.html');
  const produtos = ler('paginas/cardapio/produtos.html');
  const controllerFuncionarios = ler('scripts/equipe/funcionarios.js');
  const controllerProdutos = ler('scripts/cardapio/produtos.js');
  for (const campo of ['listaEspecialidadesCozinhaFuncionario', 'listaEstacoesCozinhaFuncionario', 'adicionarEspecialidadeCozinhaFuncionario', 'adicionarEstacaoCozinhaFuncionario']) assert.match(funcionarios, new RegExp(campo));
  for (const campo of ['listaEspecialidadesNecessariasProduto', 'listaEstacoesNecessariasProduto', 'adicionarEspecialidadeNecessariaProduto', 'adicionarEstacaoNecessariaProduto']) assert.match(produtos, new RegExp(campo));
  assert.match(controllerFuncionarios, /lerListaEquipe\('especialidade'\)/);
  assert.match(controllerProdutos, /lerListaRequisitoProduto\('especialidade'\)/);
});

test('listas de habilidades mantêm layout responsivo nos modais', () => {
  const funcionarios = ler('paginas/equipe/funcionarios.html');
  const produtos = ler('paginas/cardapio/produtos.html');
  const controllerFuncionarios = ler('scripts/equipe/funcionarios.js');
  const controllerProdutos = ler('scripts/cardapio/produtos.js');
  for (const fragmento of [funcionarios, produtos]) {
    assert.match(fragmento, /sm:col-span-2 min-w-0 rounded-xl/);
    assert.match(fragmento, /flex min-w-0 flex-col .*sm:flex-row/);
    assert.match(fragmento, /w-full shrink-0 .*sm:w-auto/);
  }
  for (const controller of [controllerFuncionarios, controllerProdutos]) {
    assert.match(controller, /flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center/);
    assert.match(controller, /min-w-0 w-full flex-1/);
    assert.match(controller, /w-full shrink-0 whitespace-nowrap .*sm:w-auto/);
  }
});

test('backend normaliza listas antigas e novas sem duplicidade de caixa', () => {
  const dados = equipe.dadosFuncionario({ nome: 'Cozinheiro Teste', cargo: 'Cozinheiro', setor: 'Cozinha', turno: 'Integral', especialidadesCozinha: 'Massas, massas, Chapa', estacoesCozinha: ['Forno', 'forno', 'Bancada fria'] });
  assert.deepEqual(dados.especialidadesCozinha, ['Massas', 'Chapa']);
  assert.deepEqual(dados.estacoesCozinha, ['Forno', 'Bancada fria']);
});

test('distribuição exige todas as habilidades e estações do produto', () => {
  const cozinheiroIncompleto = documento('FUN-INCOMPLETO', { nome: 'Incompleto', setor: 'Cozinha', papelOperacional: 'cozinha', status: 'ativo', disponibilidadeAtendimento: 'disponivel', especialidadesCozinha: ['massas'], estacoesCozinha: ['forno'], capacidadeTarefas: 2, capacidadePedidos: 2, capacidadeComandas: 2 });
  const cozinheiroCompatível = documento('FUN-COMPATIVEL', { nome: 'Compatível', setor: 'Cozinha', papelOperacional: 'cozinha', status: 'ativo', disponibilidadeAtendimento: 'disponivel', especialidadesCozinha: ['massas', 'chapa'], estacoesCozinha: ['forno', 'chapa'], capacidadeTarefas: 2, capacidadePedidos: 2, capacidadeComandas: 2 });
  const selecionado = cozinha.selecionarCozinheiroResponsavel({ funcionariosDocumentos: [cozinheiroIncompleto, cozinheiroCompatível], tarefa: { especialidadesNecessarias: ['Massas', 'Chapa'], estacoesNecessarias: ['Forno', 'Chapa'] } });
  assert.equal(selecionado.id, 'FUN-COMPATIVEL');
});

test('tarefa mantém requisitos de preparo para a ficha da cozinha', () => {
  const tarefas = cozinha.tarefasDoPedido({ itens: [{ idProduto: 'PRD-1', nomeProduto: 'Prato', quantidade: 1, especialidadesNecessarias: ['massas'], estacoesNecessarias: ['forno'] }] });
  assert.deepEqual(tarefas[0].especialidadesNecessarias, ['massas']);
  assert.deepEqual(tarefas[0].estacoesNecessarias, ['forno']);
});
