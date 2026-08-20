'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('bridge da Equipe restringe dados de preview ao ambiente local', () => {
  const bridge = ler('scripts/equipe/dados-equipe.js');
  assert.match(bridge, /const ambienteEquipeLocal = \['localhost', '127\.0\.0\.1'\]/);
  assert.match(bridge, /window\.dadosEquipeApexFood = ambienteEquipeLocal \? previewEquipe : estadoEquipeVazio/);
  assert.match(bridge, /window\.recarregarEquipeReal/);
});

test('cliente da Equipe permanece same-origin e versionado', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /listarEquipe/);
  assert.match(cliente, /criarEquipe/);
  assert.match(cliente, /atualizarEquipe/);
  assert.doesNotMatch(cliente, /initializeApp|firebase-admin|FIREBASE_PRIVATE_KEY|localStorage/);
});

test('controllers da Equipe usam persistência e não exibem placeholders', () => {
  const funcionarios = ler('scripts/equipe/funcionarios.js');
  const escala = ler('scripts/equipe/escala-trabalho.js');
  const comissoes = ler('scripts/equipe/comissoes.js');
  assert.match(funcionarios, /atualizarEquipe/);
  assert.match(funcionarios, /recarregarEquipeReal/);
  assert.match(escala, /criarEquipe/);
  assert.match(escala, /atualizarEquipe/);
  assert.match(escala, /recarregarEquipeReal/);
  assert.match(comissoes, /exportarComissoes/);
  assert.match(comissoes, /createObjectURL/);
  for (const controller of [funcionarios, escala, comissoes]) {
    assert.doesNotMatch(controller, /salvo no preview|salva no preview|Período atualizado no preview|preparada para integração/);
  }
});

test('shell e index versionam as rotas da Fase 8', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /funcionarios\.html\?v=fase8/);
  assert.match(shell, /escala-trabalho\.html\?v=fase8/);
  assert.match(shell, /comissoes\.html\?v=fase11/);
  assert.match(index, /apex-shell\.js\?v=etapa3-qr/);
});

test('contrato de equipe mantém coleções públicas e privadas separadas', () => {
  const handler = ler('api/_lib/equipe-handler.js');
  const helper = ler('api/_lib/equipe.js');
  const contrato = ler('docs/fase8-equipe-contrato.md');
  assert.match(handler, /dadosPrivadosFuncionarios/);
  assert.match(handler, /PAPEIS_MUTACAO_EQUIPE/);
  assert.match(helper, /ESCALA_EM_CONFLITO/);
  assert.match(contrato, /dadosPrivadosFuncionarios/);
  assert.match(contrato, /Comissões são somente leitura/);
});
