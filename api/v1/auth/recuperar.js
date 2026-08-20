'use strict';

const { executar } = require('../../_lib/middleware');
const { lerCorpoJson } = require('../../_lib/http');
const { consumir } = require('../../_lib/limite');
const { solicitarRedefinicaoSenha } = require('../../_lib/firebase-auth-rest');

module.exports = async function recuperar(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true }, async () => {
    await consumir(req, 'recuperar-senha', 5, 15 * 60 * 1000);
    const corpo = await lerCorpoJson(req);
    const email = String(corpo.email || '').trim().toLowerCase();
    if (!email) {
      return {
        corpo: {
          solicitado: false,
          mensagem: 'Informe seu email para receber as instruções de recuperação.',
        },
      };
    }

    await solicitarRedefinicaoSenha(email);
    return {
      corpo: {
        solicitado: true,
        mensagem: 'Se o email estiver cadastrado, você receberá as instruções de recuperação.',
      },
    };
  });
};
