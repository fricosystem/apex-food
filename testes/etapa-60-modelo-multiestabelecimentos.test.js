'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('contrato multiestabelecimento mantém coleções e campos em português', () => {
  const esquema = JSON.parse(ler('configuracoes/firebase/schema-development.json'));
  assert.equal(esquema.versaoEstrutura, '2.0.0');
  assert.equal(esquema.acessoFirestore, 'api-server-side-admin-sdk');
  assert.equal(esquema.dadosMultiestabelecimentoCriados, false);
  assert.deepEqual(esquema.tiposDocumentoEstabelecimento, ['cnpj', 'cpf']);
  for (const colecao of ['usuarios', 'restaurantes', 'indicesDocumentosEstabelecimentos', 'provisionamentosEstabelecimentos', 'resumosEstabelecimentos', 'registrosAuditoriaGlobais']) {
    assert.ok(esquema.colecoesRaiz.includes(colecao), `coleção ausente: ${colecao}`);
  }
  for (const subcolecao of ['membros', 'papeis', 'catalogoPermissoes', 'planos', 'excecoesLimites', 'metricasDiarias']) {
    assert.ok(esquema.subcolecoesRestaurante.includes(subcolecao), `subcoleção ausente: ${subcolecao}`);
  }
});

test('contrato define identidade global separada de papéis locais', () => {
  const esquema = JSON.parse(ler('configuracoes/firebase/schema-development.json'));
  assert.ok(esquema.tiposConta.includes('desenvolvedor'));
  assert.ok(esquema.tiposConta.includes('diretor'));
  assert.ok(esquema.papeisNativos.includes('desenvolvedor'));
  assert.ok(esquema.papeisNativos.includes('diretor'));
  assert.ok(esquema.papeisNativos.includes('porteiro'));
  assert.ok(esquema.papeisNativos.includes('garcom'));
  assert.ok(esquema.papeisNativos.includes('cozinheiro'));
  assert.ok(esquema.papeisNativos.includes('caixa'));
  assert.ok(esquema.regrasInvariantes.some((regra) => /acessoGlobal.*UID server-side/i.test(regra)));
});

test('contrato define estados de provisionamento e estabelecimento para saga segura', () => {
  const esquema = JSON.parse(ler('configuracoes/firebase/schema-development.json'));
  for (const estado of ['rascunho', 'em_processamento', 'concluido', 'erro_reconciliacao', 'cancelado', 'expirado']) {
    assert.ok(esquema.estadosProvisionamento.includes(estado), `estado de provisionamento ausente: ${estado}`);
  }
  for (const estado of ['em_teste', 'ativo', 'suspenso', 'desativado', 'encerrado']) {
    assert.ok(esquema.estadosRestaurante.includes(estado), `estado de restaurante ausente: ${estado}`);
  }
});

test('contrato não contém senha ou segredo em nenhum campo documentado', () => {
  const documento = ler('configuracoes/firebase/Modelo-Multiestabelecimentos.md');
  const esquema = ler('configuracoes/firebase/schema-development.json');
  assert.match(documento, /Senhas não pertencem ao Firestore/);
  assert.match(documento, /Nunca guardar senha/);
  assert.match(documento, /UID Firebase configurado no backend/);
  assert.doesNotMatch(esquema, /"senha"\s*:/i);
  assert.doesNotMatch(esquema, /privateKey|client_email|apiKey/i);
});

test('regras do Firestore continuam deny-by-default durante a fase documental', () => {
  const regras = ler('firestore.rules');
  assert.match(regras, /rules_version = '2'/);
  assert.match(regras, /allow read, write: if false/);
});
