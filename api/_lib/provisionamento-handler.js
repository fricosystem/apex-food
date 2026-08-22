'use strict';

const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const { obterIdentidadeDesenvolvedor } = require('./autorizacao-global');
const {
  criarProvisionamento,
  salvarDadosDiretor,
  concluirProvisionamento,
} = require('./provisionamento-estabelecimento');

function acaoDoCorpo(corpo) {
  const acao = typeof corpo?.acao === 'string' ? corpo.acao.trim() : '';
  if (!['iniciar', 'salvar_diretor', 'concluir'].includes(acao)) {
    throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de provisionamento inválida.');
  }
  return acao;
}

module.exports = async function provisionamento(req, res) {
  return executar(req, res, { metodos: ['POST'], mutacao: true, appCheck: true }, async ({ idRequisicao }) => {
    const identidade = await obterIdentidadeDesenvolvedor(req);
    const corpo = await lerCorpoJson(req);
    const acao = acaoDoCorpo(corpo);
    if (acao === 'iniciar') {
      const resultado = await criarProvisionamento({ identidade, corpo });
      return { status: 201, corpo: { ...resultado, idRequisicao } };
    }
    if (acao === 'salvar_diretor') {
      return { corpo: { ...(await salvarDadosDiretor({ identidade, corpo })), idRequisicao } };
    }
    return { corpo: { ...(await concluirProvisionamento({ identidade, corpo })), idRequisicao } };
  });
};
