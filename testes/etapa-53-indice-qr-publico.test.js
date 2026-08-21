const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('índice do QR público cobre mesas.qrHash em collection group', () => {
  const arquivo = JSON.parse(fs.readFileSync(path.join(raiz, 'firestore.indexes.json'), 'utf8'));
  const indice = (arquivo.fieldOverrides || []).find((item) => item.collectionGroup === 'mesas' && item.fieldPath === 'qrHash');
  assert.ok(indice);
  assert.deepEqual(indice.indexes, [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }]);
});
