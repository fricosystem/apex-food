'use strict';

const { executar } = require('../_lib/middleware');
const { verificarConfiguracaoAdmin } = require('../_lib/config');
const { getFirebaseAdminApp } = require('../../backend/firebase/admin');
const { ApiError } = require('../_lib/http');
const { ambienteExigeDistribuido } = require('../_lib/limite');
const { modoAppCheck } = require('../_lib/app-check');

function configuracaoEssencialPronta() {
  const admin = verificarConfiguracaoAdmin();
  const adicionais = ['FIREBASE_WEB_API_KEY', 'SESSION_SECRET', 'CSRF_SECRET'];
  const faltamAdicionais = adicionais.some((nome) => {
    const valor = process.env[nome];
    return !valor || valor.startsWith('replace-with-') || valor.length < 16;
  });
  return admin.pronto && !faltamAdicionais;
}

function requisitosLancamento() {
  const ambiente = String(process.env.APP_ENV || 'development').toLowerCase();
  if (ambiente === 'development') return [];

  const bloqueadores = [];
  if (ambienteExigeDistribuido() && (!process.env.RATE_LIMIT_URL || process.env.RATE_LIMIT_URL.startsWith('replace-with-') || !process.env.RATE_LIMIT_TOKEN || process.env.RATE_LIMIT_TOKEN.startsWith('replace-with-'))) {
    bloqueadores.push('rate_limit_distribuido');
  }
  if (modoAppCheck() !== 'enforce') bloqueadores.push('app_check_enforcement');
  const origem = String(process.env.APP_ORIGIN || '').trim();
  if (!/^https:\/\//i.test(origem)) bloqueadores.push('origem_https');
  if (!String(process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean).includes(origem)) {
    bloqueadores.push('allowlist_origens');
  }
  return bloqueadores;
}

module.exports = async function health(req, res) {
  return executar(req, res, { metodos: ['GET'] }, async () => {
    if (!configuracaoEssencialPronta()) {
      throw new ApiError(503, 'SERVICO_NAO_PRONTO', 'Serviço temporariamente indisponível.');
    }
    try {
      getFirebaseAdminApp();
    } catch {
      throw new ApiError(503, 'SERVICO_NAO_PRONTO', 'Serviço temporariamente indisponível.');
    }

    const ambiente = process.env.APP_ENV || 'development';
    const bloqueadores = requisitosLancamento();
    if (bloqueadores.length && ambiente !== 'development') {
      throw new ApiError(503, 'LANCAMENTO_NAO_PRONTO', 'Serviço temporariamente indisponível.');
    }

    return {
      corpo: {
        estado: 'ok',
        ambiente,
        servico: 'apex-food-api',
        prontidaoLancamento: bloqueadores.length === 0,
        ...(ambiente === 'development' ? { bloqueadores } : {}),
      },
    };
  });
};
