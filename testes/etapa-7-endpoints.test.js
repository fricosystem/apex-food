'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_ENV = 'development';
process.env.APP_ORIGIN = 'http://localhost:4173';
process.env.ALLOWED_ORIGINS = 'http://localhost:4173';
process.env.CSRF_SECRET = 'c'.repeat(64);

function respostaFalsa() {
  const cabecalhos = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    setHeader(nome, valor) { cabecalhos.set(nome, valor); },
    getHeader(nome) { return cabecalhos.get(nome); },
    end(texto) { this.corpo = texto; this.writableEnded = true; },
    cabecalhos,
  };
}

async function chamar(modulo, requisicao) {
  const handler = require(modulo);
  const resposta = respostaFalsa();
  await handler(requisicao, resposta);
  return resposta;
}

test('health check não revela configuração quando secrets estão ausentes', async () => {
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.FIREBASE_WEB_API_KEY;
  delete process.env.SESSION_SECRET;
  const resposta = await chamar('../api/v1/health', {
    method: 'GET',
    url: '/api/v1/health',
    headers: {},
  });
  assert.equal(resposta.statusCode, 503);
  assert.match(resposta.corpo, /SERVICO_NAO_PRONTO/);
  assert.doesNotMatch(resposta.corpo, /FIREBASE_PRIVATE_KEY|private_key|client_email/);
});

test('rota protegida exige sessão', async () => {
  const resposta = await chamar('../api/v1/eu', {
    method: 'GET',
    url: '/api/v1/eu',
    headers: {},
  });
  assert.equal(resposta.statusCode, 401);
  assert.match(resposta.corpo, /NAO_AUTENTICADO/);
});

test('origem não autorizada é bloqueada', async () => {
  const resposta = await chamar('../api/v1/health', {
    method: 'GET',
    url: '/api/v1/health',
    headers: { origin: 'https://origem-invalida.example' },
  });
  assert.equal(resposta.statusCode, 403);
  assert.match(resposta.corpo, /ORIGEM_NAO_PERMITIDA/);
});

test('mutação sem CSRF é bloqueada antes do Firebase', async () => {
  const resposta = await chamar('../api/v1/auth/login', {
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { origin: 'http://localhost:4173' },
    body: { email: 'teste@apexfood.com', senha: 'SenhaForte!123' },
  });
  assert.equal(resposta.statusCode, 403);
  assert.match(resposta.corpo, /CSRF_INVALIDO/);
});
