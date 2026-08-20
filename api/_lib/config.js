'use strict';

const { ApiError } = require('./http');

const nomesObrigatoriosAdmin = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

function ambiente() {
  return process.env.APP_ENV || 'development';
}

function verificarConfiguracaoAdmin() {
  const ausentes = nomesObrigatoriosAdmin.filter((nome) => {
    const valor = process.env[nome];
    return !valor || valor.startsWith('replace-with-');
  });
  if (ausentes.length) {
    return { pronto: false, ausentes };
  }
  return { pronto: true, ausentes: [] };
}

function exigirConfiguracaoAdmin() {
  const estado = verificarConfiguracaoAdmin();
  if (!estado.pronto) {
    throw new ApiError(503, 'SERVICO_NAO_CONFIGURADO', 'Serviço temporariamente indisponível.');
  }
}

function cookiesSeguros() {
  return process.env.VERCEL === '1' || ambiente() !== 'development';
}

function nomeCookieSessao() {
  return cookiesSeguros() ? '__Host-apex_sessao' : 'apex_sessao';
}

function nomeCookieCsrf() {
  return cookiesSeguros() ? '__Host-apex_csrf' : 'apex_csrf';
}

function origemAplicacao() {
  const origem = (process.env.APP_ORIGIN || '').trim();
  return origem || null;
}

module.exports = {
  ambiente,
  verificarConfiguracaoAdmin,
  exigirConfiguracaoAdmin,
  nomeCookieSessao,
  nomeCookieCsrf,
  cookiesSeguros,
  origemAplicacao,
};
