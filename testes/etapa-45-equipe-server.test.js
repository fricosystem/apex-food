const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');
const equipe = require('../api/_lib/equipe');

test('handler da Equipe aceita os recursos normalizados para criar e atualizar', () => {
  const handler = ler('api/_lib/equipe-handler.js');
  assert.match(handler, /const RECURSOS_MUTACAO = new Set\(\['funcionarios', 'escalas'\]\)/);
  assert.match(handler, /recurso === 'funcionarios' \? criarFuncionario/);
  assert.match(handler, /recurso === 'funcionarios' \? atualizarFuncionario/);
});

test('jornada que atravessa a meia-noite aceita intervalo após meia-noite', () => {
  assert.deepEqual(equipe.validarJornada('23:00', '02:00', '00:30'), { inicio: 1380, fim: 1560 });
  assert.throws(() => equipe.validarJornada('23:00', '02:00', '03:00'), erro => erro.code === 'INTERVALO_INVALIDO');
});

test('conflito de escala considera a janela noturna em ambos os lados', () => {
  assert.equal(equipe.jornadasSobrepostas([1380, 1560], [60, 120]), true);
  assert.equal(equipe.jornadasSobrepostas([1380, 1560], [1320, 1380]), false);
  assert.equal(equipe.jornadasSobrepostas([660, 1140], [720, 960]), true);
});

test('período de comissão é opcional, textual e limitado', () => {
  assert.equal(equipe.periodoComissao('Agosto/2026'), 'Agosto/2026');
  assert.equal(equipe.periodoComissao(''), '');
  assert.equal(equipe.periodoComissao(' Agosto/2026 '), 'Agosto/2026');
  assert.throws(() => equipe.periodoComissao('Agosto@2026'), erro => erro.code === 'PERIODO_INVALIDO');
  assert.throws(() => equipe.periodoComissao('x'.repeat(41)), erro => erro.code === 'PERIODO_INVALIDO');
});

test('DTO público de funcionário não expõe telefone completo, autoria ou restaurante', () => {
  const dto = equipe.dtoFuncionario({
    id: 'FUN-1',
    data: () => ({
      idRestaurante: 'restaurante-1',
      nome: 'Ana Souza',
      cargo: 'Garçonete',
      telefone: '+55 11 99999-9999',
      telefoneMascarado: '********9999',
      criadoPor: 'usuario-1',
      atualizadoPor: 'usuario-1',
      percentualComissao: 5,
    }),
  });
  assert.equal(dto.telefone, '********9999');
  assert.equal(dto.id, 'FUN-1');
  assert.equal('telefoneCompleto' in dto, false);
  assert.equal('idRestaurante' in dto, false);
  assert.equal('criadoPor' in dto, false);
});
