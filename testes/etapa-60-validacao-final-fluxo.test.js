'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('fluxo QR mantém a sequência pública até o garçom', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  assert.match(qrcode, /statusPedido = 'aguardando_confirmacao_garcom'/);
  assert.match(qrcode, /idSessaoMesa/);
  assert.match(qrcode, /idParticipante/);
  assert.match(qrcode, /idGarcomResponsavel/);
  assert.match(pedidos, /aguardando_confirmacao_garcom: new Set\(\['confirmado_garcom'/);
  assert.match(pedidos, /confirmado_garcom: new Set\(\['enviado_cozinha'/);
});

test('fluxo operacional mantém a sequência cozinha, serviço e caixa', () => {
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const cozinha = ler('api/_lib/cozinha-tarefas-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  assert.match(pedidos, /enviado_cozinha: new Set\(\['em_preparo'/);
  assert.match(pedidos, /em_preparo: new Set\(\['pronto'/);
  assert.match(pedidos, /pronto: new Set\(\['servido'/);
  assert.match(cozinha, /statusTarefa: para/);
  assert.match(cozinha, /statusFicha/);
  assert.match(financeiro, /statusEncaminhamento: para/);
  assert.match(financeiro, /estado: 'disponivel'/);
  assert.match(financeiro, /estadoSessao: 'encerrada'/);
});

test('avaliação fecha o fluxo e alimenta as coleções e relatórios existentes', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  const visao = ler('api/_lib/visao-geral-handler.js');
  const avaliacao = ler('testes/etapa-59-avaliacao-satisfacao.test.js');
  assert.match(qrcode, /collection\('avaliacoes'\)/);
  assert.match(qrcode, /idComanda/);
  assert.match(qrcode, /idParticipante/);
  assert.match(visao, /construirAvaliacoes/);
  assert.match(visao, /notaMedia/);
  assert.match(avaliacao, /AVALIACAO_JA_ENVIADA/);
});

test('segurança final mantém tenant server-side, cookies protegidos e frontend sem sessão sensível', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  const auth = ler('api/_lib/autorizacao.js');
  const frontend = [
    'scripts/publico/mesa.js',
    'scripts/pedidos/atendimento-garcom.js',
    'scripts/pedidos/pedidos-ativos.js',
    'scripts/financeiro/fechamento-caixa.js',
  ].map(ler).join('\n');
  assert.match(qrcode, /caminhoRestaurante\(cookie\.idRestaurante\)/);
  assert.match(qrcode, /HttpOnly|httpOnly|cookiesSeguros/);
  assert.match(auth, /idRestaurante/);
  assert.doesNotMatch(frontend, /firebase-admin|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/);
  assert.doesNotMatch(frontend, /localStorage/);
});

test('publicação final preserva arquitetura e limite da Vercel', () => {
  const vercel = ler('vercel.json');
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(vercel, /apex-shell|rewrites/);
  assert.match(shell, /href: '\/'/);
  assert.match(shell, /href: '\/mesa'/);
  assert.match(shell, /href: '\/atendimento-garcom'/);
  assert.equal(fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js')).length, 4);
  assert.equal(fs.existsSync(path.join(raiz, '.github', 'workflows')), false);
});
