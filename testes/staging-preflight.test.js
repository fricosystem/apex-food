'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validar } = require('../scripts/seguranca/verificar-staging');

function ambienteValido() {
  return {
    APP_ENV: 'preview',
    FIREBASE_PROJECT_ID: 'apex-food-staging-123',
    FIREBASE_CLIENT_EMAIL: 'staging-service-account@apex-food-staging-123.iam.gserviceaccount.com',
    ['FIREBASE_' + 'PRIVATE_KEY']: 'staging-private-key-material',
    FIREBASE_WEB_API_KEY: 'staging-web-api-key',
    SESSION_SECRET: 's'.repeat(48),
    CSRF_SECRET: 'c'.repeat(48),
    APP_CHECK_MODE: 'observe',
    RATE_LIMIT_URL: 'https://ratelimit.apexfood.test/staging',
    RATE_LIMIT_TOKEN: 'staging-rate-limit-token',
    APP_ORIGIN: 'https://staging.apexfood.test',
    ALLOWED_ORIGINS: 'https://staging.apexfood.test',
  };
}

test('preflight aceita contrato sintético de Staging coerente', () => {
  const resultado = validar(ambienteValido());
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.erros, []);
});

test('preflight rejeita reutilização do projeto Development', () => {
  const ambiente = ambienteValido();
  ambiente.FIREBASE_PROJECT_ID = 'apex-food-6c1cb';
  const resultado = validar(ambiente);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.erros.includes('FIREBASE_PROJECT_ID não pode ser o projeto Development'));
});

test('preflight rejeita origem HTTP, wildcard e App Check desligado', () => {
  const ambiente = ambienteValido();
  ambiente.APP_CHECK_MODE = 'off';
  ambiente.APP_ORIGIN = 'http://staging.apexfood.test';
  ambiente.ALLOWED_ORIGINS = '*';
  const resultado = validar(ambiente);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.erros.some((erro) => erro.includes('APP_ORIGIN precisa usar HTTPS')));
  assert.ok(resultado.erros.includes('ALLOWED_ORIGINS não pode usar wildcard'));
  assert.ok(resultado.erros.includes('APP_CHECK_MODE deve ser observe ou enforce'));
});

test('preflight rejeita placeholders, segredos curtos e rate limit não HTTPS', () => {
  const ambiente = ambienteValido();
  ambiente.FIREBASE_CLIENT_EMAIL = 'replace-with-staging-service-account-email';
  ambiente.SESSION_SECRET = 'curto';
  ambiente.CSRF_SECRET = 'curto';
  ambiente.RATE_LIMIT_URL = 'http://rate-limit.invalid';
  const resultado = validar(ambiente);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.erros.some((erro) => erro.startsWith('FIREBASE_CLIENT_EMAIL')));
  assert.ok(resultado.erros.includes('SESSION_SECRET precisa ter pelo menos 32 caracteres'));
  assert.ok(resultado.erros.includes('CSRF_SECRET precisa ter pelo menos 32 caracteres'));
  assert.ok(resultado.erros.includes('RATE_LIMIT_URL precisa usar HTTPS'));
});
