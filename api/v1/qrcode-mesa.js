'use strict';

const QRCode = require('qrcode');
const { executar } = require('../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../_lib/http');
const { obterIdentidadeOperacional } = require('../_lib/modulos-operacionais');
const { verificarAppCheck } = require('../_lib/app-check');
const {
  consultarQrPublico,
  abrirSessaoMesa,
  obterContextoSessaoMesa,
  consultarSessaoMesa,
  listarCardapioPublico,
  consultarComandaPublica,
  criarPedidoPublico,
  gerarQrMesa,
  revogarQrMesa,
} = require('../_lib/qrcode-mesas');

const PAPEIS_QR_ADMIN = ['proprietario', 'administrador', 'gerente'];

function valorQuery(req, nome) {
  const valor = req.query?.[nome];
  return Array.isArray(valor) ? valor[0] : valor;
}

async function executarAcaoAdministrativa(corpo, req, idRequisicao) {
  const identidade = await obterIdentidadeOperacional(req, PAPEIS_QR_ADMIN);
  await verificarAppCheck(req);
  if (corpo.acao === 'gerar') {
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
    return { recurso: 'qrMesa', ...resultado, qrDataUrl };
  }
  if (corpo.acao === 'revogar') {
    const resultado = await revogarQrMesa(identidade, {
      idMesa: corpo.idMesa,
      chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
    });
    return { recurso: 'qrMesa', ...resultado };
  }
  throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de QR Code inválida.');
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
      if (acao === 'cardapio') {
        const contexto = await obterContextoSessaoMesa(req, res);
        return { corpo: await listarCardapioPublico(contexto) };
      }
      if (acao === 'comanda') {
        const contexto = await obterContextoSessaoMesa(req, res);
        return { corpo: await consultarComandaPublica(contexto) };
      }
      throw new ApiError(400, 'ACAO_INVALIDA', 'Ação pública inválida.');
    }

    const corpo = await lerCorpoJson(req);
    if (corpo.acao === 'abrir') {
      return {
        corpo: await abrirSessaoMesa({
          token: corpo.qr || corpo.token,
          nomeCompleto: corpo.nomeCompleto,
          chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
          req,
          res,
        }),
      };
    }
    if (corpo.acao === 'pedido') {
      return { corpo: await criarPedidoPublico(req, res, corpo) };
    }
    return { corpo: await executarAcaoAdministrativa(corpo, req, idRequisicao) };
  });
};
