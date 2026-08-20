'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const contrato = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/firebase/contrato-real-v1.json'), 'utf8'));
const indicesFirestore = JSON.parse(fs.readFileSync(path.join(__dirname, '../firestore.indexes.json'), 'utf8'));

const nomesTecnicosProibidos = new Set([
  'endpoint',
  'qrCodeId',
  'qrCodeReferencia',
  'createdAt',
  'updatedAt',
  'userId',
  'restaurantId',
  'password',
  'token',
]);

const colecoes = [
  ...Object.keys(contrato.colecoesGlobais),
  ...Object.keys(contrato.colecoesDoRestaurante),
];

test('manifesto do contrato real possui versão e ambiente explícitos', () => {
  assert.equal(contrato.versao, '1.0.0');
  assert.equal(contrato.projeto, 'apex-food-6c1cb');
  assert.equal(contrato.ambiente, 'Development');
  assert.equal(contrato.idioma, 'pt-BR');
  assert.equal(contrato.moeda, 'BRL');
  assert.equal(contrato.modelo, 'multi-tenant');
});

test('todas as subcoleções do restaurante estão sob o tenant', () => {
  for (const [nome, definicao] of Object.entries(contrato.colecoesDoRestaurante)) {
    assert.match(definicao.caminho, /^restaurantes\/\{idRestaurante\}\//, nome);
    assert.equal(typeof definicao.estadoContrato, 'string');
    assert.ok(definicao.campos && typeof definicao.campos === 'object', nome);
    if (nome !== 'membros') assert.equal(definicao.campos.idRestaurante, 'texto', nome);
  }
});

test('coleções e campos não usam nomes técnicos proibidos em inglês', () => {
  for (const nome of colecoes) assert.equal(nomesTecnicosProibidos.has(nome), false, nome);
  for (const definicao of Object.values(contrato.colecoesGlobais)) {
    for (const campo of Object.keys(definicao.campos)) assert.equal(nomesTecnicosProibidos.has(campo), false, campo);
  }
  for (const definicao of Object.values(contrato.colecoesDoRestaurante)) {
    for (const campo of Object.keys(definicao.campos)) assert.equal(nomesTecnicosProibidos.has(campo), false, campo);
  }
});

test('manifesto cobre as coleções canônicas implementadas no backend', () => {
  const cardapio = contrato.endpointsModulos['/api/v1/cardapio'];
  const salao = contrato.endpointsModulos['/api/v1/salao'];
  const equipe = contrato.endpointsModulos['/api/v1/equipe'];
  const financeiro = contrato.endpointsModulos['/api/v1/financeiro'];
  for (const nome of ['categoriasCardapio', 'produtos', 'promocoes']) assert.ok(cardapio.colecoes.includes(nome));
  for (const nome of ['mesas', 'reservas', 'configuracaoSalao', 'eventosMesas']) assert.ok(salao.colecoes.includes(nome));
  for (const nome of ['funcionarios', 'dadosPrivadosFuncionarios', 'escalas', 'comissoes']) assert.ok(equipe.colecoes.includes(nome));
  for (const nome of ['fechamentosCaixa', 'movimentacoesCaixa', 'contasPagar', 'contasReceber', 'relatoriosFinanceiros', 'resumosFinanceiros', 'chavesIdempotencia']) assert.ok(financeiro.colecoes.includes(nome));
});

test('contratos ainda não integrados são marcados explicitamente', () => {
  assert.equal(contrato.colecoesDoRestaurante.pedidos.estadoContrato, 'contrato_definido_integracao_pendente');
  assert.equal(contrato.colecoesDoRestaurante.promocoes.estadoContrato, 'contrato_definido_integracao_pendente');
  assert.equal(contrato.colecoesDoRestaurante.configuracaoCardapioDigital.estadoContrato, 'contrato_definido_integracao_pendente');
  assert.equal(contrato.colecoesDoRestaurante.comissoes.estadoContrato, 'implementada_leitura');
});

test('contrato financeiro usa rota em português para idempotência', () => {
  const handler = fs.readFileSync(path.join(__dirname, '../api/_lib/financeiro-handler.js'), 'utf8');
  assert.match(handler, /rota: 'financeiro'/);
  assert.doesNotMatch(handler, /endpoint:\s*'financeiro'/);
  assert.equal(contrato.colecoesDoRestaurante.chavesIdempotencia.campos.rota, 'texto');
});

test('contratos de API operacionais mantêm métodos e recursos controlados', () => {
  const cardapio = contrato.endpointsModulos['/api/v1/cardapio'];
  const salao = contrato.endpointsModulos['/api/v1/salao'];
  const equipe = contrato.endpointsModulos['/api/v1/equipe'];
  const financeiro = contrato.endpointsModulos['/api/v1/financeiro'];
  for (const endpoint of [cardapio, salao, equipe, financeiro]) assert.deepEqual(endpoint.metodos, ['GET', 'POST', 'PATCH']);
  assert.deepEqual(cardapio.mutacao, ['categoria', 'produto']);
  assert.deepEqual(salao.mutacao, ['reserva', 'mesa']);
  assert.deepEqual(equipe.mutacao, ['funcionario', 'escala']);
  assert.deepEqual(financeiro.mutacao, ['conta', 'movimentacao', 'fechamento']);
});

test('índice automático de grupo cobre a listagem de restaurantes por membro ativo', () => {
  const isencao = indicesFirestore.fieldOverrides.find((item) => item.collectionGroup === 'membros' && item.fieldPath === 'idUsuario');
  assert.ok(isencao);
  assert.deepEqual(isencao.indexes, [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }]);
  assert.deepEqual(indicesFirestore.indexes, []);
});

test('regras comuns preservam segurança, centavos, DTO mínimo e auditoria', () => {
  assert.match(contrato.regrasComuns.sessao, /HttpOnly/);
  assert.match(contrato.regrasComuns.contexto, /idRestaurante/);
  assert.match(contrato.regrasComuns.csrf, /Dupla submissão/);
  assert.match(contrato.regrasComuns.dinheiro, /centavos/);
  assert.match(contrato.regrasComuns.auditoria, /append-only/);
  assert.match(contrato.regrasComuns.dto, /idRestaurante/);
});
