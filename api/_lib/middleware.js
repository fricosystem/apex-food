'use strict';

const {
  ApiError,
  requestId,
  aplicarCors,
  responder,
  responderErro,
  exigirMetodo,
  tratarPreflight,
  obterOrigem,
} = require('./http');
const { validarTokenCsrf } = require('./sessao');
const { origensPermitidas } = require('./origens');
const { verificarAppCheck } = require('./app-check');

function validarOrigem(req) {
  const origem = obterOrigem(req);
  if (origem && !origensPermitidas().includes(origem)) {
    throw new ApiError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem não permitida.');
  }
  const referer = req.headers?.referer;
  if (referer && origem) {
    try {
      if (new URL(referer).origin !== origem) {
        throw new ApiError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem não permitida.');
      }
    } catch (erro) {
      if (erro instanceof ApiError) throw erro;
    }
  }
}

function agoraMs() {
  return Date.now();
}

function logSeguro(evento) {
  const permitido = {
    evento: evento.evento,
    requestId: evento.requestId,
    metodo: evento.metodo,
    rota: evento.rota,
    status: evento.status,
    duracaoMs: evento.duracaoMs,
    codigoErro: evento.codigoErro,
  };
  console.log(JSON.stringify(permitido));
}

async function executar(req, res, opcoes, handler) {
  const idRequisicao = requestId(req);
  const inicio = agoraMs();
  const metodos = opcoes.metodos || ['GET'];
  let status = 200;
  try {
    const corsOk = aplicarCors(req, res);
    if (!corsOk) throw new ApiError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem não permitida.');
    if (tratarPreflight(req, res)) return;
    validarOrigem(req);
    exigirMetodo(req, metodos);
    if (opcoes.mutacao) validarTokenCsrf(req);
    if (opcoes.appCheck) await verificarAppCheck(req);
    const resultado = await handler({ idRequisicao });
    if (res.writableEnded) return;
    status = resultado?.status || 200;
    responder(res, status, resultado?.corpo ?? resultado);
  } catch (erro) {
    status = erro?.status || 500;
    responderErro(res, erro, idRequisicao);
  } finally {
    logSeguro({
      evento: status >= 500 ? 'api.erro' : status >= 400 ? 'api.negada' : 'api.sucesso',
      requestId: idRequisicao,
      metodo: req.method,
      rota: req.url?.split('?')[0] || '',
      status,
      duracaoMs: agoraMs() - inicio,
      codigoErro: undefined,
    });
  }
}

module.exports = { executar };
