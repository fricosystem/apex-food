'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.APP_ENV = 'development';
process.env.SESSION_SECRET = 's'.repeat(64);
process.env.CSRF_SECRET = 'c'.repeat(64);

const equipe = require('../api/_lib/equipe');

function documentoFake(id, dados) {
  return { id, data: () => dados };
}

test('mantém papéis de Equipe fechados e separados por operação', () => {
  assert.equal(equipe.PAPEIS_MUTACAO_EQUIPE.includes('proprietario'), true);
  assert.equal(equipe.PAPEIS_MUTACAO_EQUIPE.includes('gerente'), false);
  assert.equal(equipe.PAPEIS_ESCALA.includes('gerente'), true);
  assert.equal(equipe.PAPEIS_COMISSAO.includes('financeiro'), true);
});

test('valida funcionário, percentual e enums sem aceitar valores arbitrários', () => {
  const dados = equipe.dadosFuncionario({ nome: '  Ana Souza  ', cargo: 'Garçom', setor: 'Salão', turno: 'Jantar', telefone: '(11) 98888-1234', percentualComissao: 4.5 });
  assert.equal(dados.nome, 'Ana Souza');
  assert.equal(dados.iniciais, 'AS');
  assert.equal(dados.percentualComissao, 4.5);
  assert.equal(dados.telefoneMascarado, '***********1234');
  assert.throws(() => equipe.dadosFuncionario({ nome: 'A', cargo: 'Garçom', setor: 'Outro', turno: 'Jantar' }), (erro) => erro.code === 'PAYLOAD_INVALIDO');
  assert.throws(() => equipe.percentualSeguro(100.01), (erro) => erro.code === 'PAYLOAD_INVALIDO');
});

test('normaliza datas e valida horários com virada de meia-noite', () => {
  assert.equal(equipe.dataEquipe('18/08/2026'), '2026-08-18');
  assert.equal(equipe.dataEquipe('2026-08-18'), '2026-08-18');
  assert.deepEqual(equipe.validarJornada('16:00', '00:00', '20:00'), { inicio: 960, fim: 1440 });
  assert.throws(() => equipe.validarJornada('10:00', '10:10', ''), (erro) => erro.code === 'JORNADA_INVALIDA');
  assert.throws(() => equipe.horaEquipe('25:00', 'entrada'), (erro) => erro.code === 'HORARIO_INVALIDO');
});

test('DTO de funcionário não devolve email ou autoria privada', () => {
  const dto = equipe.dtoFuncionario(documentoFake('FUN-1', {
    nome: 'Ana Souza', cargo: 'Garçom', setor: 'Salão', telefoneMascarado: '***********1234', email: 'ana@privado.invalid', telefone: '(11) 98888-1234', criadoPor: 'uid-secreto', idRestaurante: 'restaurante-secreto', estado: 'ativo',
  }));
  assert.equal(dto.id, 'FUN-1');
  assert.equal(dto.telefone, '***********1234');
  assert.equal(dto.email, undefined);
  assert.equal(dto.criadoPor, undefined);
  assert.equal(dto.idRestaurante, undefined);
});

test('DTOs de escala e comissão retornam somente o contrato visual mínimo', () => {
  const escala = equipe.dtoEscala(documentoFake('ESC-1', { funcionarioId: 'FUN-1', data: '2026-08-18', entrada: '16:00', saida: '00:00', intervalo: '20:00', turno: 'Jantar', status: 'agendado', idRestaurante: 'segredo' }));
  const comissao = equipe.dtoComissao(documentoFake('COM-1', { funcionarioId: 'FUN-1', periodo: 'Agosto/2026', vendasCentavos: 12345, percentual: 5, comissaoCentavos: 617, pedidos: 3, variacaoPercentual: 2.5, posicao: 1, idRestaurante: 'segredo' }));
  assert.equal(escala.data, '2026-08-18');
  assert.equal(escala.idRestaurante, undefined);
  assert.equal(comissao.vendasCentavos, 12345);
  assert.equal(comissao.comissaoCentavos, 617);
  assert.equal(comissao.idRestaurante, undefined);
});

test('endpoint de Equipe usa coleções canônicas, auditoria e transação de jornada', () => {
  const endpoint = fs.readFileSync(path.join(__dirname, '../api/_lib/equipe-handler.js'), 'utf8');
  const helper = fs.readFileSync(path.join(__dirname, '../api/_lib/equipe.js'), 'utf8');
  assert.match(endpoint, /funcionarios/);
  assert.match(endpoint, /dadosPrivadosFuncionarios/);
  assert.match(endpoint, /escalas/);
  assert.match(endpoint, /comissoes/);
  assert.match(endpoint, /runTransaction/);
  assert.match(endpoint, /registrarAuditoriaOperacional/);
  assert.match(helper, /ESCALA_EM_CONFLITO/);
});

test('frontend de Equipe não usa Firebase client, localStorage ou tokens', () => {
  const arquivos = [
    '../scripts/api/modulos-client.js',
    '../scripts/equipe/dados-equipe.js',
    '../scripts/equipe/funcionarios.js',
    '../scripts/equipe/escala-trabalho.js',
    '../scripts/equipe/comissoes.js',
  ];
  for (const relativo of arquivos) {
    const conteudo = fs.readFileSync(path.join(__dirname, relativo), 'utf8');
    assert.doesNotMatch(conteudo, /localStorage|sessionStorage|firebase\/app|idToken|refreshToken|private_key/);
  }
});

test('agregador mantém os módulos operacionais em uma única função pública', () => {
  const agregador = fs.readFileSync(path.join(__dirname, '../api/v1/operacional.js'), 'utf8');
  const vercel = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
  assert.match(agregador, /cardapio-handler/);
  assert.match(agregador, /salao-handler/);
  assert.match(agregador, /equipe-handler/);
  assert.match(vercel, /operacional\?modulo=cardapio/);
  assert.match(vercel, /operacional\?modulo=salao/);
  assert.match(vercel, /operacional\?modulo=equipe/);
});

test('documentação de Equipe mantém PII privada e cálculo server-side', () => {
  const documento = fs.readFileSync(path.join(__dirname, '../docs/firebase/etapa-10-auditoria-equipe.md'), 'utf8');
  assert.match(documento, /dadosPrivadosFuncionarios/);
  assert.match(documento, /cálculo server-side/);
  assert.match(documento, /Exportar dados de Equipe/);
});
