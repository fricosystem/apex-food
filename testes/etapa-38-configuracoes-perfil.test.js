'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

function arquivosVercel() {
  return fs.readdirSync(path.join(raiz, 'api', 'v1'), { withFileTypes: true })
    .filter(item => item.isFile() && item.name.endsWith('.js'));
}

test('rota de configurações do perfil usa o shell único e versionamento da etapa', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /configuracoes-perfil/);
  assert.match(shell, /paginas\/configuracoes\/perfil\.html\?v=etapa15-perfil/);
  assert.match(shell, /estilos\/configuracoes\/perfil\.css\?v=etapa15-perfil/);
  assert.match(shell, /scripts\/configuracoes\/perfil\.js\?v=etapa15-perfil/);
});

test('menu de perfil aponta para configurações sem remover Notificações e Sair', () => {
  const controller = ler('scripts/compartilhados/perfil-sidebar.js');
  assert.match(controller, /data-perfil-configuracoes/);
  assert.match(controller, />Configurações do perfil</);
  assert.match(controller, /apexShell\.navegar\('configuracoes-perfil'\)/);
  assert.match(controller, /data-perfil-notificacoes/);
  assert.match(controller, /data-perfil-sair/);
});

test('fragmento de perfil permanece dentro do body e tem estados reais de conta', () => {
  const fragmento = ler('paginas/configuracoes/perfil.html');
  assert.doesNotMatch(fragmento, /<aside|<header|<html|<body/i);
  for (const id of ['perfilNome', 'perfilEmail', 'formPerfil', 'formPreferencias', 'formSenha', 'senhaAtualPerfil', 'novaSenhaPerfil', 'confirmarNovaSenhaPerfil', 'sessaoAutenticadaEm', 'sessaoExpiraEm']) {
    assert.match(fragmento, new RegExp(`id="${id}"`));
  }
  assert.match(fragmento, /maxlength="120"/);
  assert.match(fragmento, /type="email" readonly/);
  assert.match(fragmento, /autocomplete="current-password"/);
});

test('cliente same-origin expõe operações de perfil com CSRF para mutações', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /async function listarPerfil/);
  assert.match(cliente, /async function atualizarPerfil/);
  assert.match(cliente, /async function atualizarPreferenciasPerfil/);
  assert.match(cliente, /async function alterarSenhaPerfil/);
  assert.match(cliente, /atualizarPerfil,/);
  assert.match(cliente, /atualizarPreferenciasPerfil,/);
  assert.match(cliente, /alterarSenhaPerfil,/);
  assert.match(cliente, /requisitar\('\/operacional\?modulo=perfil'/);
  assert.match(cliente, /modulo=perfil&recurso=preferencias/);
  assert.doesNotMatch(cliente, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/);
});

test('handler de perfil exige sessão, App Check, rate limit e não recebe identidade pelo payload', () => {
  const handler = ler('api/_lib/perfil-handler.js');
  assert.match(handler, /exigirSessao\(req\)/);
  assert.match(handler, /appCheck: true/);
  assert.match(handler, /consumir\(req, 'perfil_consulta'/);
  assert.match(handler, /consumir\(req, 'perfil_mutacao'/);
  assert.match(handler, /sessao\.uid/);
  assert.match(handler, /atualizarNomeUsuario/);
  assert.match(handler, /atualizarPreferenciasUsuario/);
  assert.match(handler, /atualizarSenha/);
  assert.doesNotMatch(handler, /corpo\.idUsuario|corpo\.idRestaurante|document\.cookie|localStorage|sessionStorage/);
});

test('campos de perfil e preferências permanecem em português e email é somente leitura', () => {
  const usuarios = ler('api/_lib/usuarios.js');
  const handler = ler('api/_lib/perfil-handler.js');
  const fragmento = ler('paginas/configuracoes/perfil.html');
  for (const campo of ['nomeExibicao', 'preferenciasNotificacao', 'alertasOperacionais', 'avisosSistema', 'atualizadoEm']) {
    assert.match(`${usuarios}\n${handler}\n${fragmento}`, new RegExp(campo));
  }
  assert.doesNotMatch(handler, /atualizarEmail/);
  assert.match(fragmento, /Email<\/span>[\s\S]*type="email" readonly/);
});

test('alteração de senha é server-side, renova sessão e preserva a política forte existente', () => {
  const handler = ler('api/_lib/perfil-handler.js');
  const auth = ler('api/_lib/firebase-auth-rest.js');
  assert.match(handler, /autenticarUsuario\(email, corpo\.senhaAtual\)/);
  assert.match(handler, /atualizarSenha\(autenticacaoAtual\.idToken, corpo\.novaSenha\)/);
  assert.match(handler, /criarSessao\(res, novaAutenticacao\.idToken\)/);
  assert.match(auth, /async function atualizarSenha/);
  assert.match(auth, /password: validarSenha\(novaSenha\)/);
  assert.match(auth, /accounts:update/);
  assert.doesNotMatch(handler, /FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET|localStorage|sessionStorage/);
});

test('perfil é encaixado no endpoint operacional sem criar nova função Vercel', () => {
  const router = ler('api/v1/operacional.js');
  assert.match(router, /perfil: require\('\.\.\/\_lib\/perfil-handler'\)/);
  assert.match(router, /if \(handlers\[informado\]\) return informado/);
  assert.equal(arquivosVercel().length, 4);
});

test('controller da página não usa dados fictícios nem armazenamento local', () => {
  const pagina = ler('scripts/configuracoes/perfil.js');
  assert.match(pagina, /apexModulosApi\.listarPerfil/);
  assert.match(pagina, /apexModulosApi\.atualizarPerfil/);
  assert.match(pagina, /apexModulosApi\.atualizarPreferenciasPerfil/);
  assert.match(pagina, /apexModulosApi\.alterarSenhaPerfil/);
  assert.match(pagina, /apexModulosApi\.listarPerfil/);
  assert.match(pagina, /textoErro\(erro, 'Não foi possível consultar os dados do perfil\.'/);
  assert.doesNotMatch(pagina, /localStorage|sessionStorage|FIREBASE_PRIVATE_KEY|SESSION_SECRET|CSRF_SECRET/);
});
