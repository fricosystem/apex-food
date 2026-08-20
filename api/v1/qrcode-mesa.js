'use strict';

const { executar } = require('../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../_lib/http');
const {
  consultarQrPublico,
  abrirSessaoMesa,
  consultarSessaoMesa,
} = require('../_lib/qrcode-mesas');

function valorQuery(req, nome) {
  const valor = req.query?.[nome];
  return Array.isArray(valor) ? valor[0] : valor;
}

module.exports = async function qrcodeMesa(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  return executar(req, res, { metodos: ['GET', 'POST'], mutacao: metodo === 'POST', appCheck: false }, async ({ idRequisicao }) => {
    if (metodo === 'GET') {
      const acao = String(valorQuery(req, 'acao') || '').trim();
      if (acao === 'validar') {
        return { corpo: await consultarQrPublico(valorQuery(req, 'qr') || valorQuery(req, 'token')) };
      }
      if (acao === 'sessao' || !acao) {
        return { corpo: await consultarSessaoMesa(req, res) };
      }
      throw new ApiError(400, 'ACAO_INVALIDA', 'Ação pública inválida.');
    }

    const corpo = await lerCorpoJson(req);
    if (corpo.acao !== 'abrir') throw new ApiError(400, 'ACAO_INVALIDA', 'Ação pública inválida.');
    return {
      corpo: await abrirSessaoMesa({
        token: corpo.qr || corpo.token,
        nomeCompleto: corpo.nomeCompleto,
        chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
        req,
        res,
      }),
    };
  });
};
