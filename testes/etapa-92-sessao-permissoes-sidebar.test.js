'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const endpointSessao = fs.readFileSync(`${__dirname}/../api/v1/auth/session.js`, 'utf8');
const guardSessao = fs.readFileSync(`${__dirname}/../scripts/auth/sessao-guard.js`, 'utf8');
const shell = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');

test('sessão expõe permissões efetivas mínimas para o filtro orientativo da sidebar', () => {
  assert.match(endpointSessao, /permissoes:\s*Array\.isArray\(identidade\.permissoes\)/);
  assert.match(endpointSessao, /identidade\.permissoes\.slice\(0, 40\)/);
  assert.match(guardSessao, /restauranteAtivo\.permissoes/);
  assert.match(shell, /permissoesNavegacao = Array\.isArray\(restauranteAtivo\?\.permissoes\)/);
});

test('sidebar mantém itens quando a sessão ainda não informou permissões e filtra somente quando a lista está presente', () => {
  assert.match(shell, /return !permissoesNavegacao \|\| !permissao \|\| permissoesNavegacao\.includes\(permissao\)/);
  assert.doesNotMatch(shell, /permissoesNavegacao = \[\];\s*\/\/ acesso vazio/);
});
