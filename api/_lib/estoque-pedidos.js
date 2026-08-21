'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./http');

function quantidadeInteira(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : 0;
}

function estoqueInteiro(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= 0 ? numero : 0;
}

function nomeProduto(produto, idProduto) {
  return String(produto?.nome || idProduto);
}

async function baixarEstoqueParaPedido({ transacao, restauranteRef, idPedido, idRestaurante, idAtor, itens, documentosProdutos, motivo }) {
  if (!Array.isArray(itens) || !Array.isArray(documentosProdutos) || itens.length !== documentosProdutos.length) {
    throw new ApiError(409, 'ESTOQUE_NAO_VALIDADO', 'Não foi possível validar o estoque dos itens.');
  }
  const atualizacoes = [];
  itens.forEach((item, indice) => {
    const documento = documentosProdutos[indice];
    const produto = documento?.data?.() || {};
    const quantidade = quantidadeInteira(item?.quantidade);
    if (!documento?.exists || produto.estado === 'excluido') {
      throw new ApiError(409, 'PRODUTO_NAO_ENCONTRADO', `O produto ${item?.idProduto || ''} não foi encontrado.`);
    }
    if (produto.disponibilidade === false) {
      throw new ApiError(409, 'PRODUTO_INDISPONIVEL', `O produto ${nomeProduto(produto, item.idProduto)} está indisponível.`);
    }
    if (!quantidade) {
      throw new ApiError(400, 'QUANTIDADE_INVALIDA', `A quantidade do produto ${nomeProduto(produto, item.idProduto)} é inválida.`);
    }
    const estoqueAnterior = estoqueInteiro(produto.estoque);
    if (estoqueAnterior < quantidade) {
      throw new ApiError(409, 'ESTOQUE_INSUFICIENTE', `Não há estoque suficiente para ${nomeProduto(produto, item.idProduto)}.`);
    }
    const estoqueNovo = estoqueAnterior - quantidade;
    transacao.update(documento.ref, {
      estoque: estoqueNovo,
      atualizadoPor: idAtor,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(produto.versao || 1) + 1,
    });
    const movimentoRef = restauranteRef.collection('movimentacoesEstoque').doc();
    transacao.create(movimentoRef, {
      idRestaurante,
      produtoId: String(item.idProduto),
      tipo: 'saida',
      quantidade,
      unidade: String(produto.unidade || 'unidade'),
      motivo: String(motivo || `Baixa automática do pedido ${idPedido}.`),
      referenciaId: String(idPedido),
      referenciaTipo: 'pedido',
      estoqueAnterior,
      estoqueNovo,
      criadoPor: idAtor,
      criadoEm: FieldValue.serverTimestamp(),
    });
    atualizacoes.push({ idProduto: String(item.idProduto), quantidade, estoqueAnterior, estoqueNovo });
  });
  return atualizacoes;
}

async function devolverEstoqueDoPedido({ transacao, restauranteRef, idPedido, idRestaurante, idAtor, itens, documentosProdutos = null, motivo }) {
  if (!Array.isArray(itens) || !itens.length) return [];
  const referencias = itens.map(item => restauranteRef.collection('produtosCardapio').doc(String(item?.idProduto || '')));
  const documentos = Array.isArray(documentosProdutos)
    ? documentosProdutos
    : await Promise.all(referencias.map(referencia => transacao.get(referencia)));
  const devolucoes = [];
  itens.forEach((item, indice) => {
    const documento = documentos[indice];
    const produto = documento?.data?.() || {};
    const quantidade = quantidadeInteira(item?.quantidade);
    if (!documento?.exists || produto.estado === 'excluido' || !quantidade) {
      throw new ApiError(409, 'ESTOQUE_NAO_RESTAURADO', `Não foi possível restaurar o estoque do produto ${item?.idProduto || ''}.`);
    }
    const estoqueAnterior = estoqueInteiro(produto.estoque);
    const estoqueNovo = estoqueAnterior + quantidade;
    transacao.update(documento.ref, {
      estoque: estoqueNovo,
      atualizadoPor: idAtor,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(produto.versao || 1) + 1,
    });
    const movimentoRef = restauranteRef.collection('movimentacoesEstoque').doc();
    transacao.create(movimentoRef, {
      idRestaurante,
      produtoId: String(item.idProduto),
      tipo: 'entrada',
      quantidade,
      unidade: String(produto.unidade || 'unidade'),
      motivo: String(motivo || `Devolução automática do pedido ${idPedido}.`),
      referenciaId: String(idPedido),
      referenciaTipo: 'pedido_cancelado',
      estoqueAnterior,
      estoqueNovo,
      criadoPor: idAtor,
      criadoEm: FieldValue.serverTimestamp(),
    });
    devolucoes.push({ idProduto: String(item.idProduto), quantidade, estoqueAnterior, estoqueNovo });
  });
  return devolucoes;
}

module.exports = { baixarEstoqueParaPedido, devolverEstoqueDoPedido };
