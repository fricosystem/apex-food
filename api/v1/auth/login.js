'use strict';

const { executar } = require('../../_lib/middleware');
const { lerCorpoJson } = require('../../_lib/http');
const { consumir } = require('../../_lib/limite');
const { autenticarUsuario } = require('../../_lib/firebase-auth-rest');
const { criarSessao } = require('../../_lib/sessao');
const { obterUsuario } = require('../../_lib/autorizacao');
const { salvarUsuario } = require('../../_lib/usuarios');
const { registrarAuditoria } = require('../../_lib/auditoria');
const { exigirConfiguracaoAdmin } = require('../../_lib/config');

module.exports = async function login(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true }, async ({ idRequisicao }) => {
    consumir(req, 'login', 10, 15 * 60 * 1000);
    exigirConfiguracaoAdmin();
    const corpo = await lerCorpoJson(req);
    const dadosAuth = await autenticarUsuario(corpo.email, corpo.senha);
    const usuarioAuth = await obterUsuario(dadosAuth.localId);
    await criarSessao(res, dadosAuth.idToken);
    await salvarUsuario({
      idUsuario: dadosAuth.localId,
      emailCanonico: (usuarioAuth.email || corpo.email || '').toLowerCase(),
      nomeExibicao: usuarioAuth.displayName || undefined,
      estado: 'ativo',
      ultimoLoginEm: new Date(),
    });
    try {
      await registrarAuditoria({
        acao: 'usuario.login',
        tipoRecurso: 'usuario',
        idRecurso: dadosAuth.localId,
        idOperacao: dadosAuth.localId,
        idRequisicao,
        resultado: 'sucesso',
      });
    } catch {
      // Não bloquear a sessão por falha de auditoria; alertas devem monitorar o erro.
    }
    return {
      corpo: {
        usuario: {
          idUsuario: dadosAuth.localId,
          emailCanonico: (usuarioAuth.email || '').toLowerCase(),
          nomeExibicao: usuarioAuth.displayName || null,
          emailVerificado: usuarioAuth.emailVerified === true,
          idRestaurante: null,
          papeis: [],
        },
      },
    };
  });
};
