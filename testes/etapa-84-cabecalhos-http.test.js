'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { aplicarCors, responder } = require('../api/_lib/http');

function respostaFalsa() {
  const cabecalhos = new Map();
  return {
    statusCode: 0,
    corpo: null,
    setHeader(nome, valor) { cabecalhos.set(nome, valor); },
    end(corpo) { this.corpo = corpo; },
    getHeader(nome) { return cabecalhos.get(nome); },
    cabecalhos,
  };
}

test('resposta JSON inclui cabeçalhos de proteção sem alterar o contrato do corpo', () => {
  const res = respostaFalsa();
  responder(res, 200, { ok: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.corpo), { ok: true });
  assert.equal(res.cabecalhos.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.cabecalhos.get('X-Frame-Options'), 'DENY');
  assert.equal(res.cabecalhos.get('Referrer-Policy'), 'no-referrer');
  assert.equal(res.cabecalhos.get('Cross-Origin-Resource-Policy'), 'same-origin');
});

test('CORS autorizado permite App Check no preflight', () => {
  const anterior = { APP_ORIGIN: process.env.APP_ORIGIN, ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS };
  process.env.APP_ORIGIN = 'https://apexfood.test';
  process.env.ALLOWED_ORIGINS = 'https://apexfood.test';
  try {
    const res = respostaFalsa();
    const permitido = aplicarCors({ headers: { origin: 'https://apexfood.test' } }, res);
    assert.equal(permitido, true);
    assert.match(res.cabecalhos.get('Access-Control-Allow-Headers'), /X-Firebase-AppCheck/);
  } finally {
    if (anterior.APP_ORIGIN === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = anterior.APP_ORIGIN;
    if (anterior.ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS; else process.env.ALLOWED_ORIGINS = anterior.ALLOWED_ORIGINS;
  }
});
