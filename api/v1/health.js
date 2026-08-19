'use strict';

const { executar } = require('../_lib/middleware');
const { verificarConfiguracaoAdmin } = require('../_lib/config');
const { getFirebaseAdminApp } = require('../../backend/firebase/admin');
const { ApiError } = require('../_lib/http');

function configuracaoEssencialPronta() {
  const admin = verificarConfiguracaoAdmin();
  const adicionais = ['FIREBASE_WEB_API_KEY', 'SESSION_SECRET', 'CSRF_SECRET'];
  const faltamAdicionais = adicionais.some((nome) => {
    const valor = process.env[nome];
    return !valor || valor.startsWith('replace-with-') || valor.length < 16;
  });
  return admin.pronto && !faltamAdicionais;
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
    return {
      corpo: {
        estado: 'ok',
        ambiente: process.env.APP_ENV || 'development',
        servico: 'apex-food-api',
      },
    };
  });
};
