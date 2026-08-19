'use strict';

const { executar } = require('../../_lib/middleware');
const { encerrarSessao, exigirSessao } = require('../../_lib/sessao');
const { getAdminAuth } = require('../../../backend/firebase/admin');
const { registrarAuditoria } = require('../../_lib/auditoria');

module.exports = async function logout(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true }, async ({ idRequisicao }) => {
    const sessao = await exigirSessao(req);
    try {
      await getAdminAuth().revokeRefreshTokens(sessao.uid);
    } catch {
      // O cookie local será limpo mesmo se a revogação remota falhar.
    }
    encerrarSessao(res);
    try {
      await registrarAuditoria({
        idAtor: sessao.uid,
        acao: 'usuario.logout',
        tipoRecurso: 'usuario',
        idRecurso: sessao.uid,
        idOperacao: sessao.uid,
        idRequisicao,
        resultado: 'sucesso',
      });
    } catch {
      // Não expor falhas internas de auditoria ao navegador.
    }
    return { corpo: { encerrado: true } };
  });
};
