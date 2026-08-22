'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('teste controlado FCM é restrito à identidade autenticada e ao restaurante ativo', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  const emissor = ler('api/_lib/fcm-notificacoes.js');
  assert.match(handler, /obterIdentidadeOperacional\(req, PAPEIS_NOTIFICACOES_LEITURA(?:,\s*\[[^\]]+\])?\)/);
  assert.match(handler, /idUsuario: identidade\.idUsuario/);
  assert.match(emissor, /!idUsuario \|\| dados\.idUsuario === idUsuario/);
  assert.match(emissor, /caminhoRestaurante\(idRestaurante\)/);
  assert.doesNotMatch(handler, /tokenFcm.*req\.query/i);
});

test('teste controlado exige App Check, CSRF e rate limit no mesmo endpoint', () => {
  const handler = ler('api/_lib/notificacoes-handler.js');
  assert.match(handler, /appCheck: true/);
  assert.match(handler, /mutacao = \['POST', 'PATCH'\]\.includes/);
  assert.match(handler, /consumir\(req, 'notificacoes_dispositivo', 30, 60 \* 1000\)/);
});

test('revogação e reativação preservam transação e auditoria', () => {
  const helper = ler('api/_lib/dispositivos-notificacao.js');
  const handler = ler('api/_lib/notificacoes-handler.js');
  assert.match(helper, /runTransaction/);
  assert.match(helper, /statusDispositivo: 'revogado'/);
  assert.match(helper, /statusDispositivo: 'ativo'/);
  assert.match(helper, /idUsuario === identidade\.idUsuario/);
  assert.match(handler, /registrarAuditoriaOperacional/);
});

test('painel responsivo mantém largura adaptável e estados sem dados reais', () => {
  const controller = ler('scripts/compartilhados/notificacoes.js');
  assert.match(controller, /w-\[min\(92vw,30rem\)\]/);
  assert.match(controller, /max-h-\[min\(70vh,32rem\)\]/);
  assert.match(controller, /Nenhum dispositivo registrado/);
  assert.match(controller, /As atualizações operacionais aparecerão aqui/);
});

test('administração FCM não aumenta funções Vercel nem usa storage local', () => {
  const arquivos = [
    ler('api/_lib/notificacoes-handler.js'),
    ler('api/_lib/dispositivos-notificacao.js'),
    ler('scripts/compartilhados/notificacoes.js'),
    ler('scripts/api/modulos-client.js'),
  ];
  for (const conteudo of arquivos) {
    assert.doesNotMatch(conteudo, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/);
  }
  assert.equal(fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js')).length, 4);
});
