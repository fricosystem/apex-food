'use strict';

const { executar } = require('../../_lib/middleware');
const { exigirSessao } = require('../../_lib/sessao');
const { resolverIdentidadeSessao } = require('../../_lib/autorizacao');
const { lerUsuario } = require('../../_lib/usuarios');
const { lerContexto } = require('../../_lib/contexto');
const { getAdminAuth } = require('../../../backend/firebase/admin');
const { dtoAcessoGlobal, usuarioAutorizadoGlobal } = require('../../_lib/autorizacao-global');

async function obterAcessoGlobal(sessao) {
  try {
    const usuarioAuth = await getAdminAuth().getUser(sessao.uid);
    if (!usuarioAutorizadoGlobal(usuarioAuth)) return dtoAcessoGlobal(null);
    return dtoAcessoGlobal({ tipoConta: 'desenvolvedor', acessoGlobal: 'desenvolvedor', papeisGlobais: ['desenvolvedor'] });
  } catch {
    return dtoAcessoGlobal(null);
  }
}

module.exports = async function session(req, res) {
  return executar(req, res, { metodos: ['GET'] }, async () => {
    const sessao = await exigirSessao(req);
    const [usuario, acessoGlobal] = await Promise.all([
      lerUsuario(sessao.uid),
      obterAcessoGlobal(sessao),
    ]);
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
          ...acessoGlobal,
        },
        restauranteAtivo: identidade ? {
          idRestaurante: identidade.idRestaurante,
          papeis: identidade.papeis,
          permissoes: Array.isArray(identidade.permissoes) ? identidade.permissoes.slice(0, 40) : [],
        } : null,
      },
    };
  });
};
