const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('normalização de mesas preserva dígitos e diferencia nomes numerados', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /replace\(\/\[\\u0300-\\u036f\]\/g/);
  assert.doesNotMatch(handler, /replace\(\/\[\\\\u0300-\\\\u036f\]\/g/);
});
