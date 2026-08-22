'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('shell mantém o perfil fixo no rodapé dos sidebars desktop e mobile', () => {
  const index = ler('index.html');
  assert.match(index, /id="perfilSidebarMobile"/);
  assert.match(index, /id="perfilSidebarDesktop"/);
  assert.match(index, /flex-shrink-0 border-t border-border p-3/);
  assert.equal((index.match(/id="sidebarContentDesktop"/g) || []).length, 1);
  assert.equal((index.match(/id="sidebarContentMobile"/g) || []).length, 1);
  assert.doesNotMatch(index, /<button aria-label="Perfil"/);
});

test('controller cria menu de perfil acessível com notificações e Sair', () => {
  const controller = ler('scripts/compartilhados/perfil-sidebar.js');
  assert.match(controller, /aria-haspopup="menu"/);
  assert.match(controller, /aria-controls/);
  assert.match(controller, /role="menuitem"/);
  assert.match(controller, /data-perfil-notificacoes/);
  assert.match(controller, />Notificações</);
  assert.match(controller, /data-perfil-sair/);
  assert.match(controller, />Sair</);
});

test('Sair reutiliza o logout same-origin existente e retorna à autenticação', () => {
  const controller = ler('scripts/compartilhados/perfil-sidebar.js');
  const cliente = ler('scripts/auth/api-client.js');
  assert.match(controller, /apexAuthApi\.encerrarSessao/);
  assert.match(controller, /window\.location\.replace\('\/autenticacao\?apex-logout=1'\)/);
  assert.match(cliente, /requisitar\('\/auth\/logout', \{ method: 'POST' \}\)/);
  assert.doesNotMatch(controller, /document\.cookie|localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/);
});

test('menu de perfil fecha por clique externo e Escape e abre a central existente', () => {
  const controller = ler('scripts/compartilhados/perfil-sidebar.js');
  const notificacoes = ler('scripts/compartilhados/notificacoes.js');
  assert.match(controller, /evento\.target\.closest\('\[data-perfil-menu\], \[data-perfil-trigger\]'\)/);
  assert.match(controller, /evento\.key === 'Escape'/);
  assert.match(controller, /apex:abrir-notificacoes/);
  assert.match(notificacoes, /apex:abrir-notificacoes/);
});

test('assets do perfil são carregados pelo shell único com versionamento próprio', () => {
  const index = ler('index.html');
  assert.match(index, /api-client\.js\?v=etapa14-perfil/);
  assert.match(index, /perfil-sidebar\.js\?v=etapa15-perfil/);
  assert.equal((index.match(/id="perfilSidebarDesktop"/g) || []).length, 1);
  assert.equal((index.match(/id="perfilSidebarMobile"/g) || []).length, 1);
});
