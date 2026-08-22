'use strict';

const QRCode = require('qrcode');
const { executar } = require('../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../_lib/http');
const { obterIdentidadeOperacional } = require('../_lib/modulos-operacionais');
const { verificarAppCheck } = require('../_lib/app-check');
const { consumir } = require('../_lib/limite');
const {
  consultarQrPublico,
  abrirSessaoMesa,
  obterContextoSessaoMesa,
  obterContextoAvaliacaoPublica,
  consultarSessaoMesa,
  listarCardapioPublico,
  consultarComandaPublica,
  consultarComandaPublicaEncerrada,
  consultarAvaliacaoPublica,
  criarAvaliacaoPublica,
  criarPedidoPublico,
  gerarQrMesa,
  consultarQrMesa,
  revogarQrMesa,
} = require('../_lib/qrcode-mesas');

const PAPEIS_QR_ADMIN = ['proprietario', 'administrador', 'gerente'];

function valorQuery(req, nome) {
  const valor = req.query?.[nome];
  return Array.isArray(valor) ? valor[0] : valor;
}

async function limitarAcaoPublica(req, acao) {
  const limites = {
    validar: [30, 60_000],
    sessao: [60, 60_000],
    cardapio: [60, 60_000],
    comanda: [60, 60_000],
    abrir: [10, 60_000],
    pedido: [20, 60_000],
    avaliacao: [5, 300_000],
    administrativa: [60, 60_000],
  };
  const [limite, janela] = limites[acao] || limites.sessao;
  await consumir(req, `qrcode.${acao}`, limite, janela);
}

async function executarAcaoAdministrativa(corpo, req, idRequisicao) {
  const identidade = await obterIdentidadeOperacional(req, PAPEIS_QR_ADMIN);
  await verificarAppCheck(req);
  if (corpo.acao === 'consultar') {
    const resultado = await consultarQrMesa(identidade, { idMesa: corpo.idMesa, req });
    const qrDataUrl = await QRCode.toDataURL(resultado.urlPublica, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
    return { recurso: 'qrMesa', ...resultado, qrDataUrl };
  }
  if (corpo.acao === 'gerar' || corpo.acao === 'regenerar') {
    const resultado = await gerarQrMesa(identidade, {
      idMesa: corpo.idMesa,
      chaveIdempotencia: corpo.chaveIdempotencia || idRequisicao,
      req,
      regenerar: corpo.acao === 'regenerar',
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
        await limitarAcaoPublica(req, 'validar');
        return { corpo: await consultarQrPublico(valorQuery(req, 'qr') || valorQuery(req, 'token')) };
      }
      if (acao === 'sessao' || !acao) {
        await limitarAcaoPublica(req, 'sessao');
        return { corpo: await consultarSessaoMesa(req, res) };
      }
      if (acao === 'cardapio') {
        await limitarAcaoPublica(req, 'cardapio');
        const contexto = await obterContextoSessaoMesa(req, res);
        return { corpo: await listarCardapioPublico(contexto) };
      }
      if (acao === 'comanda') {
        await limitarAcaoPublica(req, 'comanda');
        try {
          const contexto = await obterContextoSessaoMesa(req, res);
          return { corpo: await consultarComandaPublica(contexto) };
        } catch (erro) {
          if (!['COMANDA_ENCERRADA', 'SESSAO_MESA_EXPIRADA'].includes(erro?.code)) throw erro;
          const contexto = await obterContextoAvaliacaoPublica(req, res);
          return { corpo: await consultarComandaPublicaEncerrada(contexto) };
        }
      }
      if (acao === 'avaliacao') {
        await limitarAcaoPublica(req, 'avaliacao');
        const contexto = await obterContextoAvaliacaoPublica(req, res);
        return { corpo: { avaliacao: await consultarAvaliacaoPublica(contexto), comanda: { id: contexto.comandaDocumento.id, status: 'encerrada' } } };
      }
      throw new ApiError(400, 'ACAO_INVALIDA', 'Ação pública inválida.');
    }

    const corpo = await lerCorpoJson(req);
    if (corpo.acao === 'abrir') {
      await limitarAcaoPublica(req, 'abrir');
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
      await limitarAcaoPublica(req, 'pedido');
      return { corpo: await criarPedidoPublico(req, res, corpo) };
    }
    if (corpo.acao === 'avaliacao') {
      await limitarAcaoPublica(req, 'avaliacao');
      return { corpo: await criarAvaliacaoPublica(req, res, corpo) };
    }
    await limitarAcaoPublica(req, 'administrativa');
    return { corpo: await executarAcaoAdministrativa(corpo, req, idRequisicao) };
  });
};
