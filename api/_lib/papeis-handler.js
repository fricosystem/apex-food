'use strict';

const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const { obterIdentidadeOperacional } = require('./modulos-operacionais');
const { PAPEIS_LEITURA, PAPEIS_GESTAO, listarPapeis, criarPapel, atualizarPapel, arquivarPapel } = require('./papeis');

function recursoDoCorpo(corpo) {
  const recurso = typeof corpo?.recurso === 'string' ? corpo.recurso.trim() : '';
  if (!['papel', 'papeis'].includes(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de papéis inválido.');
  return 'papel';
}

module.exports = async function papeis(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH', 'DELETE'].includes(metodo);
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH', 'DELETE'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    if (metodo === 'GET') {
      const identidade = await obterIdentidadeOperacional(req, PAPEIS_LEITURA, ['papeis.visualizar']);
      return listarPapeis(identidade);
    }
    const corpo = await lerCorpoJson(req);
    recursoDoCorpo(corpo);
    const identidade = await obterIdentidadeOperacional(req, PAPEIS_GESTAO, ['papeis.gerenciar']);
    if (metodo === 'POST') return criarPapel(identidade, corpo, idRequisicao);
    if (metodo === 'PATCH') return atualizarPapel(identidade, corpo, idRequisicao);
    return arquivarPapel(identidade, corpo, idRequisicao);
  });
};
