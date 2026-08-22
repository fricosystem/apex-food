'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { identificadorAuditoria, papeisAuditoria, resultadoAuditoria, textoAuditoria } = require('../api/_lib/auditoria-segura');

test('sanitização remove controles e limita o texto da auditoria', () => {
  assert.equal(textoAuditoria('  ação\n  operacional\tsegura  '), 'ação operacional segura');
  assert.equal(textoAuditoria('x'.repeat(300)).length, 240);
  assert.equal(textoAuditoria('   '), null);
});

test('identificadores de auditoria aceitam apenas formato opaco seguro', () => {
  assert.equal(identificadorAuditoria('restaurante-1'), 'restaurante-1');
  assert.equal(identificadorAuditoria('req:abc_123'), 'req:abc_123');
  assert.equal(identificadorAuditoria('uid com espaço'), null);
  assert.equal(identificadorAuditoria('token/fora-do-formato'), null);
});

test('papéis de auditoria são deduplicados, limitados e sem valores arbitrários', () => {
  assert.deepEqual(papeisAuditoria(['diretor', 'diretor', 'garcom', 'papel inválido', 4]), ['diretor', 'garcom']);
  assert.equal(papeisAuditoria(Array.from({ length: 20 }, (_, indice) => `papel-${indice}`)).length, 10);
});

test('resultado de auditoria usa conjunto fechado', () => {
  assert.equal(resultadoAuditoria('sucesso'), 'sucesso');
  assert.equal(resultadoAuditoria('negado'), 'negado');
  assert.equal(resultadoAuditoria('resultado-inventado'), 'erro');
});
