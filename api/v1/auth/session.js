'use strict';

const { executar } = require('../../_lib/middleware');
const { exigirSessao } = require('../../_lib/sessao');
const { resolverIdentidadeSessao } = require('../../_lib/autorizacao');
const { lerUsuario } = require('../../_lib/usuarios');
const { lerContexto } = require('../../_lib/contexto');

module.exports = async function session(req, res) {
  return executar(req, res, { metodos: ['GET'] }, async () => {
    const sessao = await exigirSessao(req);
    const usuario = await lerUsuario(sessao.uid);
    const contexto = lerContexto(req);
    let identidade = null;
    if (contexto?.idRestaurante) {
      try {
        identidade = await resolverIdentidadeSessao({
          sessao,
          idRestaurante: contexto.idRestaurante,
        });
      } catch {
        identidade = null;
      }
    }
    return {
      corpo: {
        autenticado: true,
        usuario: {
          idUsuario: sessao.uid,
          emailCanonico: usuario?.emailCanonico || null,
          nomeExibicao: usuario?.nomeExibicao || null,
          estado: usuario?.estado || 'ativo',
          emailVerificado: sessao.email_verified === true,
        },
        restauranteAtivo: identidade ? {
          idRestaurante: identidade.idRestaurante,
          papeis: identidade.papeis,
        } : null,
      },
    };
  });
};
