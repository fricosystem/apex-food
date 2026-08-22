'use strict';

const { executar } = require('../_lib/middleware');
const { exigirSessao } = require('../_lib/sessao');
const { resolverIdentidadeSessao, dtoIdentidade } = require('../_lib/autorizacao');
const { lerUsuario } = require('../_lib/usuarios');
const { lerContexto } = require('../_lib/contexto');
const { getAdminAuth } = require('../../backend/firebase/admin');
const { dtoAcessoGlobal, usuarioAutorizadoGlobal } = require('../_lib/autorizacao-global');

async function obterAcessoGlobal(sessao) {
  try {
    const usuarioAuth = await getAdminAuth().getUser(sessao.uid);
    if (!usuarioAutorizadoGlobal(usuarioAuth)) return dtoAcessoGlobal(null);
    return dtoAcessoGlobal({ tipoConta: 'desenvolvedor', acessoGlobal: 'desenvolvedor', papeisGlobais: ['desenvolvedor'] });
  } catch {
    return dtoAcessoGlobal(null);
  }
}

module.exports = async function eu(req, res) {
  return executar(req, res, { metodos: ['GET'], appCheck: true }, async () => {
    const sessao = await exigirSessao(req);
    const [usuario, acessoGlobal] = await Promise.all([
      lerUsuario(sessao.uid),
      obterAcessoGlobal(sessao),
    ]);
    const contexto = lerContexto(req);
    let identidade = null;
    if (contexto?.idRestaurante) {
      try {
        identidade = await resolverIdentidadeSessao({ sessao, idRestaurante: contexto.idRestaurante });
      } catch {
        identidade = null;
      }
    }
    return {
      corpo: {
        usuario: {
          idUsuario: sessao.uid,
          emailCanonico: usuario?.emailCanonico || null,
          nomeExibicao: usuario?.nomeExibicao || null,
          estado: usuario?.estado || 'ativo',
          emailVerificado: sessao.email_verified === true,
          ...acessoGlobal,
        },
        restauranteAtivo: identidade ? dtoIdentidade(identidade) : null,
      },
    };
  });
};
