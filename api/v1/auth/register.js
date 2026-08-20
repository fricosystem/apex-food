'use strict';

const { executar } = require('../../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../../_lib/http');
const { consumir } = require('../../_lib/limite');
const { cadastrarUsuario, enviarVerificacaoEmail, validarEmailApex, validarSenha } = require('../../_lib/firebase-auth-rest');
const { criarSessao } = require('../../_lib/sessao');
const { salvarUsuario } = require('../../_lib/usuarios');
const { registrarAuditoria } = require('../../_lib/auditoria');
const { exigirConfiguracaoAdmin } = require('../../_lib/config');

function nomeValido(nome) {
  return typeof nome === 'string' && nome.trim().length >= 2 && nome.trim().length <= 120;
}

module.exports = async function register(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true }, async ({ idRequisicao }) => {
    await consumir(req, 'cadastro', 5, 15 * 60 * 1000);
    exigirConfiguracaoAdmin();
    const corpo = await lerCorpoJson(req);
    if (!nomeValido(corpo.nomeCompleto)) {
      throw new ApiError(400, 'NOME_INVALIDO', 'Informe o nome completo.');
    }
    const email = validarEmailApex(corpo.email);
    const senha = validarSenha(corpo.senha);
    if (senha !== corpo.confirmarSenha) {
      throw new ApiError(400, 'SENHAS_DIFERENTES', 'As senhas não coincidem.');
    }

    const dadosAuth = await cadastrarUsuario(email, senha);
    let verificacaoEmailEnviada = false;
    try {
      verificacaoEmailEnviada = await enviarVerificacaoEmail(dadosAuth.idToken);
    } catch {
      // O cadastro continua válido; o reenvio será exposto em endpoint próprio.
    }
    await criarSessao(res, dadosAuth.idToken);
    await salvarUsuario({
      idUsuario: dadosAuth.localId,
      emailCanonico: email,
      nomeExibicao: corpo.nomeCompleto.trim(),
      estado: 'ativo',
    });
    try {
      await registrarAuditoria({
        acao: 'usuario.cadastrado',
        tipoRecurso: 'usuario',
        idRecurso: dadosAuth.localId,
        idOperacao: dadosAuth.localId,
        idRequisicao,
        resultado: 'sucesso',
      });
    } catch {
      // Não registrar dados sensíveis; a falha de auditoria será monitorada no backend.
    }

    return {
      corpo: {
        usuario: {
          idUsuario: dadosAuth.localId,
          emailCanonico: email,
          nomeExibicao: corpo.nomeCompleto.trim(),
          emailVerificado: false,
          idRestaurante: null,
          papeis: [],
        },
          verificacaoEmailEnviada,
      },
    };
  });
};
