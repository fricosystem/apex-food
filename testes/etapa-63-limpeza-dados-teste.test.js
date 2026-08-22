const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('Cardápio oferece arquivamento lógico sem excluir documentos', () => {
  const handler = ler('api/_lib/cardapio-handler.js');
  assert.match(handler, /async function arquivarRecurso\(identidade, recurso, id, idRequisicao\)/);
  assert.match(handler, /if \(corpo\.arquivar === true\) return arquivarRecurso/);
  assert.match(handler, /estado: 'excluido'/);
  assert.match(handler, /excluidoEm: FieldValue\.serverTimestamp\(\)/);
});

test('Salão oferece arquivamento lógico e protege mesas com atendimento ativo', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /async function arquivarRecurso\(identidade, recurso, id, idRequisicao\)/);
  assert.match(handler, /MESA_EM_ATENDIMENTO/);
  assert.match(handler, /if \(corpo\.arquivar === true\) return arquivarRecurso/);
  assert.match(handler, /estado: 'excluido'/);
});

test('Equipe oferece arquivamento lógico e protege profissionais com carga ativa', () => {
  const handler = ler('api/_lib/equipe-handler.js');
  assert.match(handler, /async function arquivarRecurso\(identidade, recurso, id, idRequisicao\)/);
  assert.match(handler, /FUNCIONARIO_EM_ATENDIMENTO/);
  assert.match(handler, /if \(corpo\.arquivar === true\) return arquivarRecurso/);
  assert.match(handler, /estado: 'excluido'/);
});

test('Financeiro preserva histórico e permite edição controlada ou arquivamento lógico', () => {
  const handler = ler('api/_lib/financeiro-handler.js');
  assert.match(handler, /corpo\.descricao !== undefined/);
  assert.match(handler, /corpo\.categoria !== undefined/);
  assert.match(handler, /corpo\.arquivar === true/);
  assert.match(handler, /corpo\.arquivar === true \? 'excluida' : corpo\.estado/);
  assert.match(handler, /atualizacoes\.excluidoEm = FieldValue\.serverTimestamp\(\)/);
});
