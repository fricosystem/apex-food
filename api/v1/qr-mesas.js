'use strict';

const QRCode = require('qrcode');
const { executar } = require('../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../_lib/http');
const { obterIdentidadeOperacional } = require('../_lib/modulos-operacionais');
const { gerarQrMesa, revogarQrMesa } = require('../_lib/qrcode-mesas');

const PAPEIS_QR_ADMIN = ['proprietario', 'administrador', 'gerente'];

module.exports = async function qrMesas(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true, appCheck: true }, async ({ idRequisicao }) => {
    const identidade = await obterIdentidadeOperacional(req, PAPEIS_QR_ADMIN);
    const corpo = await lerCorpoJson(req);
    const acao = String(corpo.acao || '').trim();
    if (!['gerar', 'revogar'].includes(acao)) throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de QR Code inválida.');
    if (acao === 'gerar') {
      const resultado = await gerarQrMesa(identidade, {
        idMesa: corpo.idMesa,
        chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
        req,
      });
      const qrDataUrl = await QRCode.toDataURL(resultado.urlPublica, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
      });
      return { corpo: { recurso: 'qrMesa', ...resultado, qrDataUrl } };
    }
    const resultado = await revogarQrMesa(identidade, {
      idMesa: corpo.idMesa,
      chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
    });
    return { corpo: { recurso: 'qrMesa', ...resultado } };
  });
};
