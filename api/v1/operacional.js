'use strict';

const handlers = Object.freeze({
  cardapio: require('../_lib/cardapio-handler'),
  salao: require('../_lib/salao-handler'),
  equipe: require('../_lib/equipe-handler'),
  financeiro: require('../_lib/financeiro-handler'),
  'visao-geral': require('../_lib/visao-geral-handler'),
  pedidos: require('../_lib/pedidos-handler'),
});

function moduloDaRequisicao(req) {
  const informado = typeof req.query?.modulo === 'string' ? req.query.modulo : '';
  if (handlers[informado]) return informado;
  const url = String(req.url || '');
  if (url.includes('/cardapio')) return 'cardapio';
  if (url.includes('/salao')) return 'salao';
  if (url.includes('/equipe')) return 'equipe';
  if (url.includes('/financeiro')) return 'financeiro';
  if (url.includes('/pedidos')) return 'pedidos';
  return '';
}

module.exports = async function operacional(req, res) {
  const modulo = moduloDaRequisicao(req);
  const handler = handlers[modulo];
  if (!handler) {
    res.status(404).json({ erro: 'ROTA_NAO_ENCONTRADA', mensagem: 'Módulo operacional não encontrado.' });
    return;
  }
  return handler(req, res);
};
