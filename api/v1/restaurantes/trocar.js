'use strict';

const { executar } = require('../../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../../_lib/http');
const { exigirSessao } = require('../../_lib/sessao');
const { resolverIdentidadeSessao, dtoIdentidade } = require('../../_lib/autorizacao');
const { definirContexto } = require('../../_lib/contexto');
const { registrarAuditoria } = require('../../_lib/auditoria');

module.exports = async function trocarRestaurante(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true, appCheck: true }, async ({ idRequisicao }) => {
    const sessao = await exigirSessao(req);
    const corpo = await lerCorpoJson(req);
    if (typeof corpo.idRestaurante !== 'string') {
      throw new ApiError(400, 'RESTAURANTE_INVALIDO', 'Restaurante inválido.');
    }
    const identidade = await resolverIdentidadeSessao({
      sessao,
      idRestaurante: corpo.idRestaurante,
    });
    definirContexto(res, identidade.idRestaurante);
    try {
      await registrarAuditoria({
        idRestaurante: identidade.idRestaurante,
        idAtor: identidade.idUsuario,
        papeisDoAtor: identidade.papeis,
        acao: 'restaurante.selecionado',
        tipoRecurso: 'restaurante',
        idRecurso: identidade.idRestaurante,
        idOperacao: idRequisicao,
        idRequisicao,
        resultado: 'sucesso',
      });
    } catch {
      // Não expor falhas de auditoria ao cliente.
    }
    return { corpo: { identidade: dtoIdentidade(identidade) } };
  });
};
