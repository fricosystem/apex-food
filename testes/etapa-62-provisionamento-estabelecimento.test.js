'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const provisionamento = require('../api/_lib/provisionamento-estabelecimento');

const diretorValido = {
  nomeCompleto: 'Diretor APEX Food',
  cpf: '52998224725',
  telefoneWhatsapp: '11987654321',
  endereco: {
    cep: '01311000',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    complemento: 'Sala 10',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
  },
};

test('valida CPF e CNPJ com dígitos verificadores', () => {
  assert.equal(provisionamento.validarCpf('529.982.247-25'), true);
  assert.equal(provisionamento.validarCpf('529.982.247-26'), false);
  assert.equal(provisionamento.validarCnpj('11.222.333/0001-81'), true);
  assert.equal(provisionamento.validarCnpj('11.222.333/0001-82'), false);
});

test('normaliza e valida dados do estabelecimento em CNPJ ou CPF', () => {
  const cnpj = provisionamento.validarDadosEstabelecimento({ nome: 'APEX Food Centro', tipoDocumento: 'cnpj', documento: '11.222.333/0001-81' });
  assert.deepEqual(cnpj, {
    nome: 'APEX Food Centro',
    tipoDocumento: 'cnpj',
    documentoNormalizado: '11222333000181',
    documentoMascarado: '11.***.***/****-81',
  });
  assert.throws(() => provisionamento.validarDadosEstabelecimento({ nome: 'APEX Food Centro', tipoDocumento: 'cpf', documento: '11.222.333/0001-81' }), /CPF válido/);
});

test('valida os dados completos do Diretor e mantém endereço estruturado', () => {
  const diretor = provisionamento.validarDadosDiretor(diretorValido);
  assert.equal(diretor.nomeCompleto, 'Diretor APEX Food');
  assert.equal(diretor.cpfNormalizado, '52998224725');
  assert.equal(diretor.telefoneWhatsapp, '11987654321');
  assert.equal(diretor.endereco.estado, 'SP');
  assert.equal(diretor.endereco.cep, '01311000');
  assert.throws(() => provisionamento.validarDadosDiretor({ ...diretorValido, endereco: { ...diretorValido.endereco, estado: 'São Paulo' } }), /UF/);
});

test('contrato não persiste senha no documento de usuário ou no rascunho', () => {
  const backend = ler('api/_lib/provisionamento-estabelecimento.js');
  const html = ler('paginas/autenticacao.html');
  assert.match(backend, /dadosDiretorValidados/);
  assert.match(backend, /getAdminAuth\(\)\.createUser/);
  assert.match(backend, /password: senha/);
  assert.doesNotMatch(backend, /senha:\s*senha/);
  assert.doesNotMatch(backend, /senha:\s*corpo/);
  assert.match(html, /auth-provisionamento-form/);
  assert.match(html, /provision-senha/);
});

test('wizard possui etapas de estabelecimento, Diretor, conta e revisão', () => {
  const html = ler('paginas/autenticacao.html');
  const controller = ler('scripts/auth/auth.js');
  for (const etapa of ['provision-nome', 'provision-documento', 'provision-diretor-nome', 'provision-diretor-cpf', 'provision-diretor-telefone', 'provision-cep', 'provision-cidade', 'provision-estado', 'provision-email', 'provision-senha', 'provision-confirmar-senha', 'provision-confirmacao']) {
    assert.match(html, new RegExp(`id="${etapa}"`), `campo ausente: ${etapa}`);
  }
  assert.match(html, /data-provision-step="5"/);
  assert.match(controller, /acao: 'iniciar'/);
  assert.match(controller, /acao: 'salvar_diretor'/);
  assert.match(controller, /acao: 'concluir'/);
  assert.doesNotMatch(controller, /body: \{ nome \}/);
});

test('provisionamento exige identificador opaco, chave idempotente e período de teste controlado', () => {
  assert.equal(provisionamento.garantirIdProvisionamento('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(provisionamento.garantirChaveIdempotencia('provisionamento-chave-01'), 'provisionamento-chave-01');
  assert.throws(() => provisionamento.garantirChaveIdempotencia('curta'), /Chave de operação inválida/);
  assert.throws(() => provisionamento.garantirIdProvisionamento('cpf-52998224725'), /Provisionamento inválido/);
  assert.equal(provisionamento.validarDiasTeste(30), 30);
  assert.equal(provisionamento.validarDiasTeste(0), 0);
  assert.throws(() => provisionamento.validarDiasTeste(91), /entre 0 e 90/);
});
