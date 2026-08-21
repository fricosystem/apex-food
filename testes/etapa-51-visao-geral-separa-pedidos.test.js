const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('agregador marca vendas por movimentação sem inflar pedidos', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  assert.match(handler, /origemMovimentacao: true/);
  assert.match(handler, /registro\.origemMovimentacao === true \? 0 : 1/);
  assert.match(handler, /registro\.origemMovimentacao !== true && dentroPeriodo/);
});

test('picos operacionais ignoram movimentações financeiras manuais', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  assert.match(handler, /ESTADOS_CANCELADOS\.has\(registro\.estado\) \|\| registro\.origemMovimentacao === true/);
});
