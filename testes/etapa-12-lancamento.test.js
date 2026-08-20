'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const limite = require('../api/_lib/limite');
const appCheck = require('../api/_lib/app-check');
const scanner = require('../scripts/seguranca/verificar-segredos');

function requisicao(ip = '203.0.113.10') {
  return { headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } };
}

function guardarAmbiente(nomes) {
  return Object.fromEntries(nomes.map((nome) => [nome, process.env[nome]]));
}

function restaurarAmbiente(ambiente) {
  for (const [nome, valor] of Object.entries(ambiente)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
}

test('Development mantém rate limiting local e rejeita excesso', async () => {
  const ambiente = guardarAmbiente(['APP_ENV', 'RATE_LIMIT_URL', 'RATE_LIMIT_TOKEN']);
  process.env.APP_ENV = 'development';
  delete process.env.RATE_LIMIT_URL;
  delete process.env.RATE_LIMIT_TOKEN;
  const nome = `teste-etapa-12-${Date.now()}`;
  await limite.consumir(requisicao(), nome, 1, 60_000);
  await assert.rejects(
    () => limite.consumir(requisicao(), nome, 1, 60_000),
    (erro) => erro.code === 'MUITAS_TENTATIVAS' && erro.status === 429,
  );
  restaurarAmbiente(ambiente);
});

test('Preview sem provedor distribuído falha fechado', async () => {
  const ambiente = guardarAmbiente(['APP_ENV', 'RATE_LIMIT_URL', 'RATE_LIMIT_TOKEN']);
  process.env.APP_ENV = 'preview';
  delete process.env.RATE_LIMIT_URL;
  delete process.env.RATE_LIMIT_TOKEN;
  await assert.rejects(
    () => limite.consumir(requisicao(), 'preview-sem-provedor', 5, 60_000),
    (erro) => erro.code === 'LIMITE_NAO_CONFIGURADO' && erro.status === 503,
  );
  restaurarAmbiente(ambiente);
});

test('rate limiting distribuído aceita resposta permitida sem expor token', async () => {
  const servidor = http.createServer((req, res) => {
    assert.equal(req.method, 'POST');
    assert.match(String(req.headers.authorization), /^Bearer /);
    let corpo = '';
    req.on('data', (parte) => { corpo += parte; });
    req.on('end', () => {
      const payload = JSON.parse(corpo);
      assert.equal(payload.limite, 5);
      assert.equal(payload.janelaSegundos, 60);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ permitido: true }));
    });
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  const ambiente = guardarAmbiente(['APP_ENV', 'RATE_LIMIT_URL', 'RATE_LIMIT_TOKEN']);
  process.env.APP_ENV = 'preview';
  process.env.RATE_LIMIT_URL = `http://127.0.0.1:${endereco.port}`;
  process.env.RATE_LIMIT_TOKEN = 'token-de-teste-nao-publico';
  await assert.doesNotReject(() => limite.consumir(requisicao(), 'preview-com-provedor', 5, 60_000));
  restaurarAmbiente(ambiente);
  await new Promise((resolve) => servidor.close(resolve));
});

test('App Check fica desligado em Development e exige token apenas em enforce', async () => {
  const ambiente = guardarAmbiente(['APP_ENV', 'APP_CHECK_MODE']);
  process.env.APP_ENV = 'development';
  delete process.env.APP_CHECK_MODE;
  assert.equal(appCheck.modoAppCheck(), 'off');
  await assert.doesNotReject(() => appCheck.verificarAppCheck({ headers: {} }));

  process.env.APP_CHECK_MODE = 'enforce';
  await assert.rejects(
    () => appCheck.verificarAppCheck({ headers: {} }),
    (erro) => erro.code === 'APPCHECK_INVALIDO' && erro.status === 401,
  );
  restaurarAmbiente(ambiente);
});

test('Vercel publica headers de segurança globais sem remover os rewrites operacionais', () => {
  const configuracao = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const headers = configuracao.headers.find((item) => item.source === '/(.*)');
  assert.ok(headers);
  const nomes = new Set(headers.headers.map((item) => item.key));
  for (const nome of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.ok(nomes.has(nome), `header ausente: ${nome}`);
  }
  const rewritesOperacionais = configuracao.rewrites.filter((item) => item.source.startsWith('/api/v1/'));
  assert.equal(rewritesOperacionais.length, 5);
});

test('scanner de segredos não encontra credenciais no repositório', () => {
  assert.deepEqual(scanner.verificar(), []);
});
