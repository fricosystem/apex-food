const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('mutação financeira preserva movimentacao no singular', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /const recursoBruto = corpo\?\.recurso \|\| queryString\(req, 'recurso'\)/);
  assert.match(handler, /mutacao && recursoBruto === 'movimentacao' \? 'movimentacao'/);
  assert.match(handler, /RECURSOS_MUTACAO\.has\(recurso\)/);
});

test('consulta financeira continua usando movimentacoes no plural', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /RECURSOS_LEITURA = new Set\(\['resumos', 'relatorios', 'contas', 'movimentacoes'/);
  assert.match(handler, /movimentacao: 'movimentacoes'/);
});
