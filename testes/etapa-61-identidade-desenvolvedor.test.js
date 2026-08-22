'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const globalAuth = require('../api/_lib/autorizacao-global');

const configuracaoUid = { uids: ['uid-desenvolvedor'], emails: [] };
const configuracaoEmail = { uids: [], emails: ['desenvolvedor@apexfood.com'] };

test('gate global autoriza UID configurado e rejeita UID diferente', () => {
  assert.equal(globalAuth.usuarioAutorizadoGlobal({ uid: 'uid-desenvolvedor', email: 'qualquer@apexfood.com' }, configuracaoUid), true);
  assert.equal(globalAuth.usuarioAutorizadoGlobal({ uid: 'uid-outro', email: 'desenvolvedor@apexfood.com' }, configuracaoUid), false);
});

test('gate global aceita email configurado somente no registro Auth ativo', () => {
  assert.equal(globalAuth.usuarioAutorizadoGlobal({ uid: 'uid-desenvolvedor', email: ' DESENVOLVEDOR@APEXFOOD.COM ' }, configuracaoEmail), true);
  assert.equal(globalAuth.usuarioAutorizadoGlobal({ uid: 'uid-desenvolvedor', email: 'outro@apexfood.com' }, configuracaoEmail), false);
  assert.equal(globalAuth.usuarioAutorizadoGlobal({ uid: 'uid-desenvolvedor', email: 'desenvolvedor@apexfood.com', disabled: true }, configuracaoEmail), false);
});

test('configuração global reconhece lista de UIDs e emails separada por vírgula', () => {
  const anteriorUid = process.env.APEX_DESENVOLVEDOR_UID;
  const anteriorEmail = process.env.APEX_DESENVOLVEDOR_EMAIL;
  process.env.APEX_DESENVOLVEDOR_UID = ' uid-a,uid-b ';
  process.env.APEX_DESENVOLVEDOR_EMAIL = ' Dev@ApexFood.com, outro@apexfood.com ';
  try {
    const configuracao = globalAuth.configuracaoDesenvolvedor();
    assert.deepEqual(configuracao.uids, ['uid-a', 'uid-b']);
    assert.deepEqual(configuracao.emails, ['dev@apexfood.com', 'outro@apexfood.com']);
    assert.equal(globalAuth.acessoGlobalConfigurado(), true);
  } finally {
    if (anteriorUid === undefined) delete process.env.APEX_DESENVOLVEDOR_UID;
    else process.env.APEX_DESENVOLVEDOR_UID = anteriorUid;
    if (anteriorEmail === undefined) delete process.env.APEX_DESENVOLVEDOR_EMAIL;
    else process.env.APEX_DESENVOLVEDOR_EMAIL = anteriorEmail;
  }
});

test('contrato de sessão expõe somente o DTO global mínimo', () => {
  const session = ler('api/v1/auth/session.js');
  const eu = ler('api/v1/eu.js');
  for (const arquivo of [session, eu]) {
    assert.match(arquivo, /acessoGlobal/);
    assert.match(arquivo, /papeisGlobais/);
    assert.match(arquivo, /usuarioAutorizadoGlobal/);
    assert.doesNotMatch(arquivo, /senha|privateKey|token/i);
  }
});

test('módulo Desenvolvedor usa o dispatcher existente e gate server-side', () => {
  const dispatcher = ler('api/v1/operacional.js');
  const handler = ler('api/_lib/desenvolvedor-handler.js');
  assert.match(dispatcher, /desenvolvedor: require\('\.\.\/\_lib\/desenvolvedor-handler'\)/);
  assert.match(dispatcher, /moduloDaRequisicao/);
  assert.match(handler, /obterIdentidadeDesenvolvedor/);
  assert.match(handler, /appCheck: true/);
});

test('cliente de módulos expõe consulta global somente como recurso dedicado', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /consultarAcessoDesenvolvedor/);
  assert.match(cliente, /requisitar\('\/operacional\?modulo=desenvolvedor'\)/);
  assert.doesNotMatch(cliente, /APEX_DESENVOLVEDOR_UID|APEX_DESENVOLVEDOR_EMAIL/);
});

test('documentação de ambiente não contém valor real do acesso global', () => {
  const ambiente = ler('configuracoes/firebase/ambientes.md');
  assert.match(ambiente, /APEX_DESENVOLVEDOR_UID/);
  assert.match(ambiente, /APEX_DESENVOLVEDOR_EMAIL/);
  assert.doesNotMatch(ambiente, /CJfeqnrjzRVttoo5mlwa0UTh4Ex2/);
});
