'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_ENV = 'development';
process.env.SESSION_SECRET = 's'.repeat(64);
process.env.CSRF_SECRET = 'c'.repeat(64);

const { ApiError } = require('../api/_lib/http');
const { validarEmailApex, validarSenha } = require('../api/_lib/firebase-auth-rest');
const { criarTokenCsrf, validarTokenCsrf } = require('../api/_lib/sessao');
const { definirContexto, lerContexto } = require('../api/_lib/contexto');

function respostaFalsa() {
  const cabecalhos = new Map();
  return {
    setHeader(nome, valor) { cabecalhos.set(nome, valor); },
    getHeader(nome) { return cabecalhos.get(nome); },
    cabecalhos,
  };
}

function cookieDaResposta(resposta, nome) {
  const cookies = resposta.cabecalhos.get('Set-Cookie') || [];
  const lista = Array.isArray(cookies) ? cookies : [cookies];
  const item = lista.find((valor) => valor.startsWith(`${nome}=`));
  assert.ok(item, `cookie ${nome} não encontrado`);
  return item.split(';')[0];
}

test('normaliza e valida email APEX Food com ponto opcional', () => {
  assert.equal(validarEmailApex('  Nome.Teste@APEXFOOD.COM '), 'nome.teste@apexfood.com');
  assert.equal(validarEmailApex(' Nome@APEXFOOD.COM '), 'nome@apexfood.com');
  assert.throws(() => validarEmailApex('nome..teste@apexfood.com'), (erro) => erro instanceof ApiError && erro.status === 400);
  assert.throws(() => validarEmailApex('nome@outro.com'), (erro) => erro instanceof ApiError && erro.status === 400);
});

test('aplica política mínima de senha de 8 caracteres no backend', () => {
  assert.equal(validarSenha('SenhaF!8').length, 8);
  assert.equal(validarSenha('SenhaForte!123').length, 14);
  assert.throws(() => validarSenha('curta'), (erro) => erro instanceof ApiError && erro.code === 'SENHA_INVALIDA');
});

test('emite e valida CSRF por dupla submissão', () => {
  const resposta = respostaFalsa();
  const token = criarTokenCsrf(resposta);
  const cookie = cookieDaResposta(resposta, 'apex_csrf');
  const requisicao = { headers: { cookie, 'x-csrf-token': token } };
  assert.doesNotThrow(() => validarTokenCsrf(requisicao));
  assert.throws(() => validarTokenCsrf({ headers: { cookie, 'x-csrf-token': `${token}x` } }), (erro) => erro.code === 'CSRF_INVALIDO');
});

test('assina e lê contexto de restaurante sem localStorage', () => {
  const resposta = respostaFalsa();
  definirContexto(resposta, 'restaurante_123');
  const cookie = cookieDaResposta(resposta, 'apex_contexto');
  const contexto = lerContexto({ headers: { cookie } });
  assert.equal(contexto.idRestaurante, 'restaurante_123');
});
