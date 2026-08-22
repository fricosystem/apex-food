'use strict';

const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const { obterIdentidadeDesenvolvedor, dtoAcessoGlobal } = require('./autorizacao-global');
const { obterDashboard, obterListaEstabelecimentos, alterarEstado, definirPlano, definirLimite, criarExcecao } = require('./desenvolvedor');

function acaoDaRequisicao(req, corpo) {
  const valor = corpo?.acao || req.query?.acao || 'status';
  if (typeof valor !== 'string') throw new ApiError(400, 'ACAO_INVALIDA', 'Ação global inválida.');
  return valor.trim();
}

function opcoesLista(req) {
  return {
    estado: typeof req.query?.estado === 'string' ? req.query.estado.trim() : '',
    codigoPlano: typeof req.query?.codigoPlano === 'string' ? req.query.codigoPlano.trim() : '',
    busca: typeof req.query?.busca === 'string' ? req.query.busca.trim() : '',
    limite: req.query?.limite || 100,
  };
}

module.exports = async function desenvolvedor(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH'].includes(metodo);
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    const identidade = await obterIdentidadeDesenvolvedor(req);
    const corpo = mutacao ? await lerCorpoJson(req) : null;
    const acao = acaoDaRequisicao(req, corpo);
    if (metodo === 'GET' && acao === 'dashboard') return obterDashboard();
    if (metodo === 'GET' && acao === 'listar_estabelecimentos') return obterListaEstabelecimentos(opcoesLista(req));
    if (metodo === 'GET' || acao === 'status') {
      return {
        corpo: {
          identidade: {
            idUsuario: identidade.idUsuario,
            emailCanonico: identidade.emailCanonico,
            nomeExibicao: identidade.nomeExibicao,
            ...dtoAcessoGlobal(identidade),
          },
          recursosGlobais: ['dashboard-estabelecimentos', 'gerenciar-estabelecimentos'],
        },
      };
    }
    if (metodo === 'PATCH' && acao === 'alterar_estado') return alterarEstado({ identidade, idRestaurante: corpo.idRestaurante, estado: corpo.estado, idRequisicao });
    if (metodo === 'PATCH' && acao === 'definir_plano') return definirPlano({ identidade, idRestaurante: corpo.idRestaurante, codigoPlano: corpo.codigoPlano, dias: corpo.dias, idRequisicao });
    if (metodo === 'PATCH' && acao === 'definir_limite') return definirLimite({ identidade, idRestaurante: corpo.idRestaurante, recurso: corpo.recurso, limite: corpo.limite, idRequisicao });
    if (metodo === 'POST' && acao === 'criar_excecao') return criarExcecao({ identidade, idRestaurante: corpo.idRestaurante, recurso: corpo.recurso, limiteNovo: corpo.limiteNovo, fimEm: corpo.fimEm, motivo: corpo.motivo, idRequisicao });
    throw new ApiError(400, 'ACAO_INVALIDA', 'Ação global não disponível.');
  });
};
