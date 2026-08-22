'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const { analisarRestaurante, consolidarRelatorio, inteiroSeguro } = require('../scripts/migracao/gerar-relatorio-integridade');

function restaurante(dados = {}) {
  return { id: 'restaurante-1', dados: { idRestaurante: 'restaurante-1', nome: 'Teste', tipoDocumento: 'cnpj', documentoNormalizado: 'documento-teste', estado: 'ativo', idDiretor: 'diretor-1', ...dados } };
}

test('relatório de integridade aceita um tenant coerente sem produzir problemas', () => {
  const resultado = analisarRestaurante({
    documento: restaurante(),
    membros: [{ id: 'diretor-1', dados: { idUsuario: 'diretor-1', idRestaurante: 'restaurante-1', estado: 'ativo', papeis: ['diretor'] } }],
    papeis: [{ id: 'recepcao', dados: { codigo: 'recepcao', nome: 'Recepção', estado: 'ativo', permissoes: ['salao.visualizar'] } }],
    indices: [{ id: 'cnpj_documento-teste', dados: { idRestaurante: 'restaurante-1' } }],
    operacionais: { mesas: [{ id: 'mesa-1', dados: { idRestaurante: 'restaurante-1' } }] },
  });
  assert.deepEqual(resultado.problemas, []);
  assert.equal(resultado.membros.ativos, 1);
  assert.equal(resultado.papeis.ativos, 1);
});

test('relatório detecta inconsistências críticas de tenant, papéis globais e permissões', () => {
  const resultado = analisarRestaurante({
    documento: restaurante(),
    membros: [
      { id: 'diretor-1', dados: { idUsuario: 'diretor-1', idRestaurante: 'outro-restaurante', estado: 'ativo', papeis: ['desenvolvedor', 'inexistente'] } },
    ],
    papeis: [{ id: 'desenvolvedor', dados: { codigo: 'desenvolvedor', estado: 'ativo', permissoes: ['desenvolvedor.gerenciar'] } }],
    indices: [{ id: 'cnpj_documento-teste', dados: { idRestaurante: 'restaurante-1' } }],
    operacionais: { pedidos: [{ id: 'pedido-1', dados: { idRestaurante: 'outro-restaurante' } }] },
  });
  const codigos = new Set(resultado.problemas.map((item) => item.codigo));
  for (const codigo of ['PAPEL_GLOBAL_LOCAL', 'PAPEL_PERMISSAO_INVALIDA', 'MEMBRO_TENANT_INCONSISTENTE', 'MEMBRO_PAPEL_GLOBAL', 'MEMBRO_PAPEL_DESCONHECIDO', 'OPERACIONAL_TENANT_INCONSISTENTE']) assert.ok(codigos.has(codigo), `problema ausente: ${codigo}`);
  assert.ok(resultado.problemas.every((item) => !/documento-teste|diretor-1|pedido-1/.test(item.mensagem)));
});

test('relatório identifica restaurante operacional sem membro ativo e índice fiscal ausente', () => {
  const resultado = analisarRestaurante({ documento: restaurante(), membros: [], papeis: [], indices: [] });
  const codigos = new Set(resultado.problemas.map((item) => item.codigo));
  assert.ok(codigos.has('RESTAURANTE_SEM_MEMBRO_ATIVO'));
  assert.ok(codigos.has('INDICE_FISCAL_AUSENTE'));
});

test('consolidação informa modo somente leitura e conta problemas por código', () => {
  const relatorio = consolidarRelatorio({ restaurantes: [{ idRestaurante: 'restaurante-1' }], problemas: [{ codigo: 'PAPEL_GLOBAL_LOCAL', severidade: 'critica' }, { codigo: 'PAPEL_GLOBAL_LOCAL', severidade: 'critica' }], leituras: 3 });
  assert.equal(relatorio.modo, 'somente_leitura');
  assert.equal(relatorio.resumo.problemasCriticos, 2);
  assert.equal(relatorio.resumo.problemasPorCodigo.PAPEL_GLOBAL_LOCAL, 2);
});

test('limite é positivo, finito e limitado para impedir varreduras acidentais', () => {
  assert.equal(inteiroSeguro('0'), 500);
  assert.equal(inteiroSeguro('100'), 100);
  assert.equal(inteiroSeguro('999999'), 5000);
});

test('script de migração não contém escrita Firestore nem opção destrutiva implícita', () => {
  const script = ler('scripts/migracao/gerar-relatorio-integridade.js');
  assert.match(script, /modo: 'somente_leitura'/);
  assert.match(script, /get\(\)/);
  assert.doesNotMatch(script, /\.collection\([^)]*\)\.(set|update|delete|add)\(/);
  assert.doesNotMatch(script, /--aplicar|--forcar|delete\(\)/);
});
