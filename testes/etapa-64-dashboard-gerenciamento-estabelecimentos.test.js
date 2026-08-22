'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const desenvolvedor = require('../api/_lib/desenvolvedor');

test('serviço global define estados, planos e recursos de limite controlados', () => {
  for (const estado of ['rascunho', 'em_teste', 'ativo', 'suspenso', 'desativado', 'encerrado']) assert.ok(desenvolvedor.ESTADOS_ESTABELECIMENTO.has(estado));
  for (const plano of ['teste', 'basico', 'profissional', 'enterprise']) assert.ok(desenvolvedor.PLANOS.has(plano));
  for (const recurso of ['usuariosAtivos', 'mesas', 'produtosCardapio', 'pedidosMensais', 'armazenamentoMb']) assert.ok(desenvolvedor.RECURSOS_LIMITE.has(recurso));
});

test('DTO global usa documento mascarado, resumo agregado e não expõe senha ou documento bruto', () => {
  const backend = ler('api/_lib/desenvolvedor.js');
  const auditoria = ler('api/_lib/auditoria-global.js');
  assert.match(backend, /documentoMascarado/);
  assert.match(backend, /resumosEstabelecimentos/);
  assert.match(auditoria, /registrosAuditoriaGlobais/);
  assert.doesNotMatch(backend, /senha/);
  assert.doesNotMatch(backend, /documentoNormalizado.*return/);
});

test('handler global separa consultas de mutações e usa o gate do Desenvolvedor', () => {
  const handler = ler('api/_lib/desenvolvedor-handler.js');
  assert.match(handler, /obterIdentidadeDesenvolvedor/);
  assert.match(handler, /acao === 'dashboard'/);
  assert.match(handler, /acao === 'listar_estabelecimentos'/);
  assert.match(handler, /acao === 'alterar_estado'/);
  assert.match(handler, /acao === 'definir_plano'/);
  assert.match(handler, /acao === 'definir_limite'/);
  assert.match(handler, /acao === 'criar_excecao'/);
  assert.match(handler, /appCheck: true/);
  assert.match(handler, /mutacao/);
});

test('auditoria global não se mistura ao histórico operacional do restaurante', () => {
  const auditoria = ler('api/_lib/auditoria-global.js');
  assert.match(auditoria, /registrosAuditoriaGlobais/);
  assert.match(auditoria, /tipoAtor: 'desenvolvedor'/);
  assert.match(auditoria, /classeRetencao: 'global'/);
  assert.doesNotMatch(auditoria, /senha|privateKey/);
});

test('shell e sidebar expõem a seção Desenvolvedor somente após sessão global', () => {
  const index = ler('index.html');
  const guard = ler('scripts/auth/sessao-guard.js');
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(index, /DESENVOLVEDOR/);
  assert.match(index, /dashboard-estabelecimentos/);
  assert.match(index, /gerenciar-estabelecimentos/);
  assert.match(index, /apex:sessao-autenticada/);
  assert.match(guard, /acessoGlobal === 'desenvolvedor'/);
  assert.match(guard, /!possuiRestauranteAtivo && !possuiAcessoGlobal/);
  assert.match(shell, /dashboard-estabelecimentos/);
  assert.match(shell, /gerenciar-estabelecimentos/);
  assert.match(shell, /dadosDashboardEstabelecimentosPronto/);
});

test('rotas, fragmentos e controllers globais usam URLs limpas e cache-bust da Fase 6', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const vercel = ler('vercel.json');
  const dashboard = ler('paginas/desenvolvedor/dashboard-estabelecimentos.html');
  const gerenciar = ler('paginas/desenvolvedor/gerenciar-estabelecimentos.html');
  const dashboardScript = ler('scripts/desenvolvedor/dashboard-estabelecimentos.js');
  const gerenciarScript = ler('scripts/desenvolvedor/gerenciar-estabelecimentos.js');
  assert.match(shell, /dashboard-estabelecimentos\.html\?v=fase61-dashboard-global/);
  assert.match(shell, /gerenciar-estabelecimentos\.html\?v=fase61-dashboard-global/);
  assert.ok(vercel.includes('dashboard-estabelecimentos'));
  assert.ok(vercel.includes('gerenciar-estabelecimentos'));
  assert.match(dashboard, /metricFaturamentoEstabelecimentos/);
  assert.match(gerenciar, /formEstadoEstabelecimento/);
  assert.match(dashboardScript, /consultarDashboardEstabelecimentos/);
  assert.match(gerenciarScript, /definirPlanoEstabelecimento/);
  assert.doesNotMatch(dashboardScript, /mock|fixture|fake/i);
  assert.doesNotMatch(gerenciarScript, /mock|fixture|fake/i);
});

test('cliente expõe somente chamadas server-side para o Dashboard e Gerenciamento', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  for (const nome of ['consultarDashboardEstabelecimentos', 'listarEstabelecimentosDesenvolvedor', 'alterarEstadoEstabelecimento', 'definirPlanoEstabelecimento', 'definirLimiteEstabelecimento', 'criarExcecaoEstabelecimento']) assert.match(cliente, new RegExp(`async function ${nome}`));
  assert.doesNotMatch(cliente, /APEX_DESENVOLVEDOR_UID|APEX_DESENVOLVEDOR_EMAIL/);
});
