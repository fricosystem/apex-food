'use strict';

const { executar } = require('./middleware');
const { obterIdentidadeDesenvolvedor, dtoAcessoGlobal } = require('./autorizacao-global');

module.exports = async function desenvolvedor(req, res) {
  return executar(req, res, { metodos: ['GET'], appCheck: true }, async () => {
    const identidade = await obterIdentidadeDesenvolvedor(req);
    return {
      corpo: {
        identidade: {
          idUsuario: identidade.idUsuario,
          emailCanonico: identidade.emailCanonico,
          nomeExibicao: identidade.nomeExibicao,
          ...dtoAcessoGlobal(identidade),
        },
        recursosGlobais: ['dashboard-estabelecimentos', 'gerenciar-estabelecimentos'],
      },
    };
  });
};
