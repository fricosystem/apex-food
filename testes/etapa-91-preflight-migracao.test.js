'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { validarPreflight } = require('../scripts/migracao/preflight-migracao');

function ambienteValido(overrides = {}) {
  return {
    APP_ENV: 'preview',
    FIREBASE_PROJECT_ID: 'apex-food-staging-123',
    FIREBASE_CLIENT_EMAIL: 'staging@apex-food-staging-123.iam.gserviceaccount.com',
    ['FIREBASE_' + 'PRIVATE_KEY']: 'valor-sintetico-nao-segredo',
    SESSION_SECRET: 's'.repeat(48),
    CSRF_SECRET: 'c'.repeat(48),
    APP_CHECK_MODE: 'observe',
    ...overrides,
  };
}

test('preflight aceita relatório somente leitura em ambiente Preview separado', () => {
  const resultado = validarPreflight({ env: ambienteValido(), argumentos: ['--somente-leitura', '--limite=500'] });
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.erros, []);
  assert.equal(resultado.modo, 'somente_leitura');
});

test('preflight aceita Development somente com o projeto Development e flag segura', () => {
  const resultado = validarPreflight({ env: ambienteValido({ APP_ENV: 'development', FIREBASE_PROJECT_ID: 'apex-food-6c1cb' }), argumentos: ['--somente-leitura'] });
  assert.equal(resultado.valido, true);
});

test('preflight exige modo explícito e rejeita flags destrutivas', () => {
  const semModo = validarPreflight({ env: ambienteValido(), argumentos: [] });
  assert.ok(semModo.erros.includes('CONFIRMACAO_SOMENTE_LEITURA_AUSENTE'));
  const destrutivo = validarPreflight({ env: ambienteValido(), argumentos: ['--somente-leitura', '--aplicar'] });
  assert.ok(destrutivo.erros.includes('MODO_DESTRUTIVO_NAO_PERMITIDO'));
});

test('preflight rejeita projeto Development fora de Development e segredos inseguros', () => {
  const resultado = validarPreflight({ env: ambienteValido({ FIREBASE_PROJECT_ID: 'apex-food-6c1cb', CSRF_SECRET: 's'.repeat(48) }), argumentos: ['--somente-leitura'] });
  assert.ok(resultado.erros.includes('PROJETO_DEVELOPMENT_FORA_DO_AMBIENTE'));
  assert.ok(resultado.erros.includes('SEGREDOS_IGUAIS'));
});

test('produção exige App Check enforce e credenciais de projeto separado', () => {
  const resultado = validarPreflight({ env: ambienteValido({ APP_ENV: 'production', FIREBASE_PROJECT_ID: 'apex-food-production-123', APP_CHECK_MODE: 'observe' }), argumentos: ['--somente-leitura'] });
  assert.ok(resultado.erros.includes('APPCHECK_PRODUCTION_DEVE_SER_ENFORCE'));
});
