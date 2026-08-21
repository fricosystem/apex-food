const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('validar QR público lê o restaurante como snapshot', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /const restauranteDocumento = await encontrado\.restauranteRef\.get\(\)/);
  assert.match(helper, /restauranteDocumento\.exists \? restauranteDocumento\.data\(\)/);
  assert.doesNotMatch(helper, /encontrado\.restauranteRef\.data\(/);
});

test('tela pública mantém validação QR antes da identificação', () => {
  const controller = ler('scripts/publico/mesa.js');
  assert.match(controller, /requisitar\(`\?acao=validar&qr=/);
  assert.match(controller, /acao: 'abrir'/);
  assert.match(controller, /credentials: 'same-origin'/);
});
