'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const auth = fs.readFileSync(path.join(__dirname, '../scripts/auth/auth.js'), 'utf8');
const pagina = fs.readFileSync(path.join(__dirname, '../paginas/autenticacao.html'), 'utf8');

test('login resolve restaurante ativo antes do redirecionamento ao shell', () => {
  assert.match(auth, /await api\.requisitar\('\/restaurantes'\)/);
  assert.match(auth, /await prepararRestauranteAtivo\(\)/);
  assert.match(auth, /window\.location\.href = origem \?/);
  assert.doesNotMatch(auth, /localStorage|sessionStorage/);
});

test('conta com múltiplos restaurantes possui seleção real sem armazenar contexto no navegador', () => {
  assert.match(auth, /restaurantes\/trocar/);
  assert.match(auth, /state\.contextoResolve/);
  assert.match(auth, /auth-context-choice/);
  assert.match(pagina, /id="auth-context-choice"/);
  assert.match(pagina, /id="auth-restaurant-select"/);
  assert.match(pagina, /id="auth-context-submit"/);
});

test('conta sem restaurante recebe erro controlado em vez de fallback fictício', () => {
  assert.match(auth, /RESTAURANTE_NAO_SELECIONADO/);
  assert.match(auth, /ainda não está vinculada a um restaurante ativo/);
  assert.doesNotMatch(auth, /dadosFicticios|mockRestaurante|restauranteDemo/);
});
