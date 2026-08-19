'use strict';

const { executar } = require('../../_lib/middleware');
const { criarTokenCsrf } = require('../../_lib/sessao');

module.exports = async function csrf(req, res) {
  return executar(req, res, { metodos: ['GET'] }, async () => ({
    csrf: criarTokenCsrf(res),
  }));
};
