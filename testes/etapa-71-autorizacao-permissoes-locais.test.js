'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const { exigirPermissao } = require('../api/_lib/autorizacao');
const catalogo = require('../api/_lib/permissoes-locais');
const notificacoes = require('../api/_lib/notificacoes');

const identidade = (papeis, permissoes) => ({ idUsuario: 'usuario-teste', idRestaurante: 'restaurante-teste', papeis, permissoes });

test('catálogo funcional é fechado e não contém autorização global', () => {
  const codigos = catalogo.CATALOGO_PERMISSOES.map((item) => item.codigo);
  for (const codigo of ['cardapio.gerenciar', 'equipe.gerenciar', 'pedidos.operar', 'cozinha.operar', 'caixa.operar', 'financeiro.operar', 'salao.operar', 'relatorios.visualizar']) assert.ok(codigos.includes(codigo));
  assert.equal(codigos.some((codigo) => codigo.startsWith('desenvolvedor.')), false);
  assert.equal(catalogo.PAPEIS_NATIVOS_POR_CODIGO.get('desenvolvedor'), undefined);
});

test('permissão personalizada concede somente o módulo explicitamente associado', () => {
  const recepcao = identidade(['recepcao'], ['estabelecimento.visualizar', 'salao.visualizar']);
  assert.doesNotThrow(() => exigirPermissao(recepcao, ['salao.visualizar']));
  assert.throws(() => exigirPermissao(recepcao, ['salao.operar']), /PERMISSAO_INSUFICIENTE|permissão/);
  assert.throws(() => exigirPermissao(recepcao, ['pedidos.operar']), /PERMISSAO_INSUFICIENTE|permissão/);
});

test('Diretor, Cozinheiro e aliases operacionais conservam as permissões esperadas', () => {
  const diretor = catalogo.PAPEIS_NATIVOS_POR_CODIGO.get('diretor');
  const cozinheiro = catalogo.PAPEIS_NATIVOS_POR_CODIGO.get('cozinheiro');
  const cozinha = catalogo.PAPEIS_NATIVOS_POR_CODIGO.get('cozinha');
  assert.ok(diretor.permissoes.includes('papeis.gerenciar'));
  assert.ok(diretor.permissoes.includes('financeiro.operar'));
  assert.deepEqual(cozinheiro.permissoes, cozinha.permissoes);
  assert.ok(cozinheiro.permissoes.includes('cozinha.operar'));
  assert.equal(catalogo.PAPEIS_NATIVOS_POR_CODIGO.get('porteiro').permissoes.includes('pedidos.operar'), false);
});

test('notificação funcional alcança categoria personalizada apenas com a permissão da fila', () => {
  const expiracao = new Date(Date.now() + 10000);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'garcom', permissaoDestino: 'pedidos.operar', idUsuarioDestino: null, expiraEm: expiracao }, identidade(['recepcao'], ['pedidos.operar'])), true);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'garcom', permissaoDestino: 'pedidos.operar', idUsuarioDestino: null, expiraEm: expiracao }, identidade(['recepcao'], ['salao.visualizar'])), false);
  assert.equal(notificacoes.visivelParaIdentidade({ papelDestino: 'cozinha', permissaoDestino: 'cozinha.operar', idUsuarioDestino: 'outro-usuario', expiraEm: expiracao }, identidade(['recepcao'], ['cozinha.operar'])), false);
});

test('resolução local consulta somente papéis ativos dentro do restaurante do contexto', () => {
  const autorizacao = ler('api/_lib/autorizacao.js');
  assert.match(autorizacao, /collection\('restaurantes'\)\.doc\(idRestaurante\)\.collection\('papeis'\)/);
  assert.match(autorizacao, /where\('estado', '==', 'ativo'\)/);
  assert.match(autorizacao, /permissoesDiretas/);
  assert.doesNotMatch(autorizacao, /collectionGroup\(['"]papeis['"]\)/);
});

test('handlers operacionais exigem permissões funcionais e não aceitam Desenvolvedor local', () => {
  const cardapio = ler('api/_lib/cardapio-handler.js');
  const salao = ler('api/_lib/salao-handler.js');
  const equipe = ler('api/_lib/equipe-handler.js');
  const pedidos = ler('api/_lib/pedidos-handler.js');
  const cozinha = ler('api/_lib/cozinha-tarefas-handler.js');
  const financeiro = ler('api/_lib/financeiro-handler.js');
  const papeis = ler('api/_lib/papeis.js');
  assert.match(cardapio, /cardapio\.gerenciar/);
  assert.match(salao, /salao\.operar/);
  assert.match(equipe, /equipe\.gerenciar/);
  assert.match(pedidos, /pedidos\.operar/);
  assert.match(cozinha, /cozinha\.operar/);
  assert.match(financeiro, /caixa\.operar/);
  assert.match(papeis, /PAPEL_RESERVADO/);
  assert.match(papeis, /PAPEIS_NATIVOS_POR_CODIGO/);
});
