'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.APP_ENV = 'development';
process.env.SESSION_SECRET = 's'.repeat(64);
process.env.CSRF_SECRET = 'c'.repeat(64);

const modulos = require('../api/_lib/modulos-operacionais');

function documentoFake(id, dados) {
  return { id, data: () => dados };
}

test('limita paginação ao teto server-side', () => {
  assert.equal(modulos.limitarInteiro('20', 100, 200), 20);
  assert.equal(modulos.limitarInteiro('9999', 100, 200), 200);
  assert.equal(modulos.limitarInteiro('invalido', 100, 200), 100);
});

test('valida textos e valores monetários como inteiros', () => {
  assert.equal(modulos.textoObrigatorio('  Pizza  ', 'nome'), 'Pizza');
  assert.equal(modulos.inteiroPositivo(5990, 'precoCentavos'), 5990);
  assert.equal(modulos.inteiroNaoNegativo(0, 'estoque'), 0);
  assert.throws(() => modulos.textoObrigatorio('', 'nome'), (erro) => erro.code === 'PAYLOAD_INVALIDO');
  assert.throws(() => modulos.inteiroPositivo(59.9, 'precoCentavos'), (erro) => erro.code === 'PAYLOAD_INVALIDO');
});

test('mascara contato antes de formar DTO de reserva', () => {
  assert.equal(modulos.mascararContato('(11) 98888-1201'), '***********1201');
  const dto = modulos.dtoReserva(documentoFake('res-1', { nomeCliente: 'Cliente', contatoCliente: '(11) 98888-1201', estado: 'confirmada' }));
  assert.equal(dto.contatoCliente, undefined);
  assert.equal(dto.contatoClienteMascarado, '***********1201');
});

test('converte timestamps conhecidos para ISO e remove autoria interna', () => {
  const data = new Date('2026-08-19T12:00:00.000Z');
  const dto = modulos.dtoDocumento(documentoFake('produto-1', { nome: 'Pizza', criadoEm: { toDate: () => data }, criadoPor: 'uid-secreto', idRestaurante: 'restaurante-1' }));
  assert.equal(dto.criadoEm, data.toISOString());
  assert.equal(dto.criadoPor, undefined);
  assert.equal(dto.idRestaurante, undefined);
});

test('mantém enumerações de mesas e reservas fechadas', () => {
  assert.equal(modulos.ESTADOS_MESA.has('disponivel'), true);
  assert.equal(modulos.ESTADOS_MESA.has('qualquer-coisa'), false);
  assert.equal(modulos.ESTADOS_RESERVA.has('confirmada'), true);
  assert.equal(modulos.ESTADOS_RESERVA.has('excluida'), false);
});

test('endpoints usam transação e auditoria para mutações operacionais', () => {
  const cardapio = fs.readFileSync(path.join(__dirname, '../api/v1/cardapio/index.js'), 'utf8');
  const salao = fs.readFileSync(path.join(__dirname, '../api/v1/salao/index.js'), 'utf8');
  assert.match(cardapio, /runTransaction/);
  assert.match(cardapio, /registrarAuditoriaOperacional/);
  assert.match(salao, /runTransaction/);
  assert.match(salao, /eventosMesas/);
  assert.match(salao, /RESERVA_EM_CONFLITO/);
});

test('frontend operacional não usa Firebase client, localStorage ou tokens', () => {
  const arquivos = [
    '../scripts/api/modulos-client.js',
    '../scripts/cardapio/dados-cardapio.js',
    '../scripts/salao/dados-mesas.js',
    '../scripts/salao/dados-reservas.js',
  ];
  for (const relativo of arquivos) {
    const conteudo = fs.readFileSync(path.join(__dirname, relativo), 'utf8');
    assert.doesNotMatch(conteudo, /localStorage|sessionStorage|firebase\/app|idToken|refreshToken/);
  }
});

test('nomes de coleções permanecem em português e dentro do tenant', () => {
  const cardapio = fs.readFileSync(path.join(__dirname, '../api/v1/cardapio/index.js'), 'utf8');
  const salao = fs.readFileSync(path.join(__dirname, '../api/v1/salao/index.js'), 'utf8');
  assert.match(cardapio, /categoriasCardapio/);
  assert.match(cardapio, /produtos/);
  assert.match(cardapio, /promocoes/);
  assert.match(salao, /mesas/);
  assert.match(salao, /reservas/);
  assert.match(salao, /configuracaoSalao/);
});
