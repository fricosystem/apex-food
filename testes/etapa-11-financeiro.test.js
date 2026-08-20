'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.APP_ENV = 'development';
process.env.SESSION_SECRET = 's'.repeat(64);
process.env.CSRF_SECRET = 'c'.repeat(64);

const financeiro = require('../api/_lib/financeiro');

function documentoFake(id, dados) {
  return { id, data: () => dados };
}

test('mantém papéis Financeiro restritos e separados do frontend', () => {
  assert.equal(financeiro.PAPEIS_LEITURA_FINANCEIRO.includes('financeiro'), true);
  assert.equal(financeiro.PAPEIS_LEITURA_FINANCEIRO.includes('garcom'), false);
  assert.equal(financeiro.PAPEIS_MUTACAO_FINANCEIRO.includes('proprietario'), true);
  assert.equal(financeiro.PAPEIS_MUTACAO_FINANCEIRO.includes('gerente'), false);
  assert.equal(financeiro.PAPEIS_FECHAMENTO.includes('financeiro'), true);
});

test('converte valores monetários para centavos sem aceitar precisão indevida', () => {
  assert.equal(financeiro.centavos('1234,50', 'valor', { positivo: true }), 123450);
  assert.equal(financeiro.centavos(12.3, 'valor', { positivo: true }), 1230);
  assert.equal(financeiro.reais(123450), 1234.5);
  assert.throws(() => financeiro.centavos('12,345', 'valor', { positivo: true }), (erro) => erro.code === 'VALOR_INVALIDO');
  assert.throws(() => financeiro.centavos(-1, 'valor', { positivo: true }), (erro) => erro.code === 'VALOR_INVALIDO');
  assert.throws(() => financeiro.centavos('NaN', 'valor'), (erro) => erro.code === 'VALOR_INVALIDO');
});

test('normaliza datas financeiras e rejeita datas impossíveis', () => {
  assert.equal(financeiro.dataFinanceira('18/08/2026'), '2026-08-18');
  assert.equal(financeiro.dataFinanceira('2026-08-18'), '2026-08-18');
  assert.equal(financeiro.dataExibicao('2026-08-18'), '18/08/2026');
  assert.throws(() => financeiro.dataFinanceira('31/02/2026'), (erro) => erro.code === 'DATA_INVALIDA');
  assert.throws(() => financeiro.dataFinanceira('18-08-2026'), (erro) => erro.code === 'DATA_INVALIDA');
});

test('valida contas com estado inicial controlado e dinheiro em centavos', () => {
  const pagar = financeiro.validarConta({ tipo: 'pagar', descricao: 'Fornecedor', categoria: 'Insumos', vencimento: '2026-08-20', valor: '1240,50', recorrente: true });
  const receber = financeiro.validarConta({ tipo: 'receber', descricao: 'Evento', categoria: 'Eventos', vencimento: '20/08/2026', valor: 4200 });
  assert.deepEqual({ tipo: pagar.tipo, valorCentavos: pagar.valorCentavos, vencimento: pagar.vencimento, estado: pagar.estado, moeda: pagar.moeda }, { tipo: 'pagar', valorCentavos: 124050, vencimento: '2026-08-20', estado: 'pendente', moeda: 'BRL' });
  assert.equal(receber.estado, 'prevista');
  assert.equal(receber.recorrente, false);
  assert.throws(() => financeiro.validarConta({ tipo: 'qualquer', descricao: 'x', categoria: 'x', vencimento: '2026-08-20', valor: 10 }), (erro) => erro.code === 'PAYLOAD_INVALIDO');
});

test('valida movimentações sem aceitar autoria, tenant ou estado final do cliente', () => {
  const dados = financeiro.validarMovimentacao({ tipo: 'saida', descricao: 'Compra', categoria: 'Suprimentos', valor: '380,00', idRestaurante: 'outro', estado: 'conciliado', criadoPor: 'uid-falso' });
  assert.equal(dados.valorCentavos, 38000);
  assert.equal(dados.estado, 'pendente');
  assert.equal(dados.moeda, 'BRL');
  assert.equal(dados.idRestaurante, undefined);
  assert.equal(dados.criadoPor, undefined);
});

test('DTOs financeiros retornam reais para a UI, mas nunca autoria ou tenant', () => {
  const movimento = financeiro.dtoMovimentacao(documentoFake('MOV-1', { data: '2026-08-18', tipo: 'entrada', categoria: 'Vendas', descricao: 'Venda', origem: 'Pedidos', forma: 'Pix', valorCentavos: 312050, estado: 'conciliado', criadoPor: 'uid-secreto', idRestaurante: 'restaurante-secreto' }));
  const conta = financeiro.dtoConta(documentoFake('CP-1', { descricao: 'Fornecedor', categoria: 'Insumos', vencimento: '2026-08-20', valorCentavos: 124050, estado: 'pendente', idRestaurante: 'restaurante-secreto' }), 'pagar');
  const fechamento = financeiro.dtoFechamento(documentoFake('CX-1', { data: '2026-08-18', aberturaCentavos: 120000, vendasCentavos: 487250, saldoEsperadoCentavos: 544250, saldoConferidoCentavos: 544250, estado: 'aberto', operador: 'Operador', criadoPor: 'uid-secreto', idRestaurante: 'restaurante-secreto' }));
  assert.equal(movimento.valor, 3120.5);
  assert.equal(conta.valor, 1240.5);
  assert.equal(fechamento.diferenca, 0);
  assert.equal(movimento.criadoPor, undefined);
  assert.equal(movimento.idRestaurante, undefined);
  assert.equal(conta.idRestaurante, undefined);
  assert.equal(fechamento.idRestaurante, undefined);
});

test('fechamento exige confirmação e calcula diferença no servidor', () => {
  assert.deepEqual(financeiro.validarFechamento({ confirmado: true, saldoConferido: '5442,50' }), { saldoConferidoCentavos: 544250 });
  assert.throws(() => financeiro.validarFechamento({ confirmado: false, saldoConferido: 100 }), (erro) => erro.code === 'CONFIRMACAO_NECESSARIA');
  assert.deepEqual(financeiro.validarEstadoMovimentacao('conciliado'), 'conciliado');
  assert.throws(() => financeiro.validarEstadoMovimentacao('aprovado'), (erro) => erro.code === 'PAYLOAD_INVALIDO');
});

test('contrato do endpoint usa coleções canônicas, transações, idempotência e auditoria', () => {
  const endpoint = fs.readFileSync(path.join(__dirname, '../api/_lib/financeiro-handler.js'), 'utf8');
  const helper = fs.readFileSync(path.join(__dirname, '../api/_lib/financeiro.js'), 'utf8');
  assert.match(endpoint, /fechamentosCaixa/);
  assert.match(endpoint, /movimentacoesCaixa/);
  assert.match(endpoint, /contasPagar/);
  assert.match(endpoint, /contasReceber/);
  assert.match(endpoint, /relatoriosFinanceiros/);
  assert.match(endpoint, /resumosFinanceiros/);
  assert.match(endpoint, /chavesIdempotencia/);
  assert.match(endpoint, /runTransaction/);
  assert.match(endpoint, /registrarAuditoriaOperacional/);
  assert.match(endpoint, /FECHAMENTO_IMUTAVEL/);
  assert.match(helper, /inteiros em centavos|valorCentavos/);
});

test('frontend Financeiro não usa Firebase client, storage local ou tokens', () => {
  const arquivos = [
    '../scripts/api/modulos-client.js',
    '../scripts/financeiro/dados-financeiros.js',
    '../scripts/financeiro/dashboard-financeiro.js',
    '../scripts/financeiro/fechamento-caixa.js',
    '../scripts/financeiro/fluxo-caixa.js',
    '../scripts/financeiro/contas-pagar-receber.js',
    '../scripts/financeiro/relatorios-financeiros.js',
  ];
  for (const relativo of arquivos) {
    const conteudo = fs.readFileSync(path.join(__dirname, relativo), 'utf8');
    assert.doesNotMatch(conteudo, /localStorage|sessionStorage|firebase\/app|idToken|refreshToken|private_key/);
  }
});

test('agregador e Vercel mantêm Financeiro em uma função pública', () => {
  const agregador = fs.readFileSync(path.join(__dirname, '../api/v1/operacional.js'), 'utf8');
  const vercel = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
  assert.match(agregador, /financeiro-handler/);
  assert.match(agregador, /url\.includes\('\/financeiro'\)/);
  assert.match(vercel, /operacional\?modulo=financeiro/);
});

test('documentação Financeiro fixa centavos, imutabilidade, idempotência e fallback local', () => {
  const documento = fs.readFileSync(path.join(__dirname, '../docs/firebase/etapa-11-auditoria-financeiro.md'), 'utf8');
  assert.match(documento, /inteiros em centavos/);
  assert.match(documento, /fechamento transacional e imutável/);
  assert.match(documento, /chaveIdempotencia/);
  assert.match(documento, /localhost/);
});
