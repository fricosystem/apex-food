'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analisarIndices, analisarRestaurante } = require('../scripts/migracao/gerar-relatorio-integridade');

function baseRestaurante() {
  return { id: 'restaurante-1', dados: { idRestaurante: 'restaurante-1', nome: 'Teste', tipoDocumento: 'cnpj', documentoNormalizado: 'doc-1', estado: 'ativo', idDiretor: 'diretor-1' } };
}

test('análise de índices detecta conflito fiscal entre restaurantes sem expor documentos completos', () => {
  const problemas = analisarIndices([
    { id: 'indice-1', dados: { idRestaurante: 'restaurante-1', tipoDocumento: 'cnpj', documentoNormalizado: 'mesma-chave' } },
    { id: 'indice-2', dados: { idRestaurante: 'restaurante-2', tipoDocumento: 'cnpj', documentoNormalizado: 'mesma-chave' } },
  ]);
  assert.equal(problemas.filter((item) => item.codigo === 'INDICE_FISCAL_CONFLITO').length, 2);
  assert.ok(problemas.every((item) => !/mesma-chave|indice-1|indice-2/.test(JSON.stringify(item))));
});

test('análise de referências detecta usuário ausente, usuário inativo e operação sem tenant', () => {
  const resultado = analisarRestaurante({
    documento: baseRestaurante(),
    membros: [
      { id: 'diretor-1', dados: { idUsuario: 'diretor-1', idRestaurante: 'restaurante-1', estado: 'ativo', papeis: ['diretor'] } },
      { id: 'usuario-2', dados: { idUsuario: 'usuario-2', idRestaurante: 'restaurante-1', estado: 'ativo', papeis: ['garcom'] } },
    ],
    usuarios: [{ id: 'diretor-1', dados: { idUsuario: 'diretor-1', estado: 'ativo' } }, { id: 'usuario-2', dados: { idUsuario: 'usuario-2', estado: 'suspenso' } }],
    papeis: [],
    indices: [{ id: 'indice-1', dados: { idRestaurante: 'restaurante-1', tipoDocumento: 'cnpj', documentoNormalizado: 'doc-1' } }],
    operacionais: { pedidos: [{ id: 'pedido-1', dados: {} }] },
  });
  const codigos = new Set(resultado.problemas.map((item) => item.codigo));
  assert.ok(codigos.has('MEMBRO_USUARIO_INATIVO'));
  assert.ok(codigos.has('OPERACIONAL_SEM_TENANT'));
  assert.equal(codigos.has('MEMBRO_USUARIO_AUSENTE'), false);

  const ausente = analisarRestaurante({
    documento: baseRestaurante(),
    membros: [{ id: 'diretor-1', dados: { idUsuario: 'diretor-1', idRestaurante: 'restaurante-1', estado: 'ativo', papeis: ['diretor'] } }],
    usuarios: [{ id: 'outro-usuario', dados: { idUsuario: 'outro-usuario', estado: 'ativo' } }],
    papeis: [],
    indices: [{ id: 'indice-1', dados: { idRestaurante: 'restaurante-1', tipoDocumento: 'cnpj', documentoNormalizado: 'doc-1' } }],
  });
  assert.equal(ausente.problemas.some((item) => item.codigo === 'MEMBRO_USUARIO_AUSENTE'), true);
});
