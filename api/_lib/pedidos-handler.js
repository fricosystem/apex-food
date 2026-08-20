'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  inteiroPositivo,
  enumObrigatorio,
  dtoDocumento,
  timestampParaIso,
  listarColecao,
  queryString,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const PAPEIS_PEDIDOS = ['proprietario', 'administrador', 'gerente', 'garcom', 'cozinha'];
const ESTADOS_PEDIDO = new Set(['novo', 'preparo', 'pronto', 'entregue', 'finalizado', 'cancelado']);
const TIPOS_ATENDIMENTO = new Set(['mesa', 'delivery']);
const TRANSICOES = Object.freeze({
  novo: new Set(['preparo', 'cancelado']),
  preparo: new Set(['pronto', 'cancelado']),
  pronto: new Set(['entregue', 'cancelado']),
  entregue: new Set(['finalizado']),
  finalizado: new Set(),
  cancelado: new Set(),
});

function normalizarRecurso(valor) {
  if (valor === 'historico' || valor === 'cozinha' || valor === 'pedido') return 'pedidos';
  if (valor === 'comanda') return 'comandas';
  return valor || 'pedidos';
}

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function dtoPedido(documento) {
  const dto = dtoDocumento(documento);
  for (const campo of ['enviadoCozinhaEm', 'entregueEm', 'finalizadoEm', 'canceladoEm']) {
    if (campo in dto) dto[campo] = timestampParaIso(dto[campo]);
  }
  dto.itens = Array.isArray(dto.itens) ? dto.itens : [];
  dto.quantidadeItens = dto.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  dto.valorCentavos = Number(dto.valorCentavos || 0);
  dto.taxaEntregaCentavos = Number(dto.taxaEntregaCentavos || 0);
  dto.status = dto.status || 'novo';
  dto.canal = dto.canal || dto.tipoAtendimento || 'mesa';
  return dto;
}

function filtroPedido(dados, req) {
  const status = queryString(req, 'status');
  const canal = queryString(req, 'canal');
  const busca = queryString(req, 'busca').toLocaleLowerCase('pt-BR');
  if (status && status !== 'todos' && dados.status !== status) return false;
  if (canal && canal !== 'todos' && dados.canal !== canal) return false;
  if (busca) {
    const texto = `${dados.id} ${dados.nomeCliente} ${dados.nomeMesa} ${dados.nomeGarcom}`.toLocaleLowerCase('pt-BR');
    if (!texto.includes(busca)) return false;
  }
  return true;
}

async function listarPedidos(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (!['pedidos', 'comandas'].includes(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de pedidos inválido.');
  const limite = limitarInteiro(req.query?.limite, 200, 300);
  const documentos = await listarColecao(identidade.idRestaurante, recurso, limite);
  const itens = documentos
    .filter(documento => documento.data()?.estado !== 'excluido')
    .map(recurso === 'pedidos' ? dtoPedido : dtoDocumento)
    .filter(item => recurso !== 'pedidos' || filtroPedido(item, req));
  return { corpo: { [recurso]: itens, meta: { idRestaurante: identidade.idRestaurante, limite, recurso } } };
}

function validarItens(itens) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 100) {
    throw new ApiError(400, 'ITENS_INVALIDOS', 'O pedido deve conter ao menos um item válido.');
  }
  const ids = new Set();
  return itens.map(item => {
    const idProduto = idDocumento(String(item?.idProduto || item?.produtoId || ''), 'idProduto');
    if (ids.has(idProduto)) throw new ApiError(400, 'ITENS_DUPLICADOS', 'Cada produto deve aparecer uma única vez no pedido.');
    ids.add(idProduto);
    return {
      idProduto,
      quantidade: inteiroPositivo(item.quantidade, 'quantidade', 1000),
      observacoes: textoOpcional(item.observacoes, 'observacoes', 500),
    };
  });
}

function validarPedido(corpo) {
  const tipoAtendimento = enumObrigatorio(corpo.tipoAtendimento || 'mesa', TIPOS_ATENDIMENTO, 'tipoAtendimento');
  const itens = validarItens(corpo.itens);
  const idMesa = tipoAtendimento === 'mesa' ? idDocumento(String(corpo.idMesa || ''), 'idMesa') : null;
  return {
    tipoAtendimento,
    idMesa,
    idGarcom: corpo.idGarcom ? idDocumento(String(corpo.idGarcom), 'idGarcom') : null,
    nomeCliente: textoObrigatorio(corpo.nomeCliente || corpo.cliente || 'Cliente não identificado', 'nomeCliente', 160),
    telefone: textoOpcional(corpo.telefone, 'telefone', 40),
    endereco: tipoAtendimento === 'delivery' ? textoObrigatorio(corpo.endereco, 'endereco', 300) : '',
    observacoes: textoOpcional(corpo.observacoes, 'observacoes', 1000),
    itens,
  };
}

async function criarPedido(identidade, corpo, idRequisicao) {
  const dados = validarPedido(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const pedidoRef = restaurante.collection('pedidos').doc();
  const comandaRef = restaurante.collection('comandas').doc();
  const historicoRef = pedidoRef.collection('historicoStatus').doc();
  const produtoRefs = dados.itens.map(item => restaurante.collection('produtosCardapio').doc(item.idProduto));
  const mesaRef = dados.idMesa ? restaurante.collection('mesas').doc(dados.idMesa) : null;
  const garcomRef = dados.idGarcom ? restaurante.collection('funcionarios').doc(dados.idGarcom) : null;
  const db = pedidoRef.firestore;
  let valorCentavos = 0;
  let itensPersistidos = [];
  let nomeMesa = dados.tipoAtendimento === 'delivery' ? 'Delivery' : dados.idMesa;
  let nomeGarcom = dados.tipoAtendimento === 'delivery' ? 'Delivery' : '';
  await db.runTransaction(async transacao => {
    const produtoDocumentos = await Promise.all(produtoRefs.map(referencia => transacao.get(referencia)));
    const mesaDocumento = mesaRef ? await transacao.get(mesaRef) : null;
    const garcomDocumento = garcomRef ? await transacao.get(garcomRef) : null;
    if (mesaDocumento && (!mesaDocumento.exists || mesaDocumento.data()?.estado === 'indisponivel' || mesaDocumento.data()?.estado === 'excluido')) {
      throw new ApiError(409, 'MESA_INDISPONIVEL', 'A mesa selecionada não está disponível.');
    }
    if (garcomDocumento && (!garcomDocumento.exists || garcomDocumento.data()?.estado === 'excluido')) {
      throw new ApiError(400, 'GARCOM_NAO_ENCONTRADO', 'O garçom selecionado não foi encontrado.');
    }
    if (mesaDocumento) nomeMesa = mesaDocumento.data()?.nome || mesaDocumento.data()?.numero || dados.idMesa;
    if (garcomDocumento) nomeGarcom = garcomDocumento.data()?.nomeCompleto || garcomDocumento.data()?.nome || dados.idGarcom;
    itensPersistidos = dados.itens.map((item, indice) => {
      const produtoDocumento = produtoDocumentos[indice];
      if (!produtoDocumento.exists || produtoDocumento.data()?.estado === 'excluido') throw new ApiError(400, 'PRODUTO_NAO_ENCONTRADO', 'Um dos produtos selecionados não foi encontrado.');
      const produto = produtoDocumento.data() || {};
      if (produto.disponibilidade === false) throw new ApiError(409, 'PRODUTO_INDISPONIVEL', `O produto ${produto.nome || item.idProduto} está indisponível.`);
      const precoUnitarioCentavos = inteiroNaoNegativo(produto.precoCentavos, 'precoCentavos');
      const subtotalCentavos = precoUnitarioCentavos * item.quantidade;
      valorCentavos += subtotalCentavos;
      return {
        idProduto: item.idProduto,
        nome: textoObrigatorio(String(produto.nome || item.idProduto), 'nomeProduto', 160),
        quantidade: item.quantidade,
        precoUnitarioCentavos,
        subtotalCentavos,
        observacoes: item.observacoes,
      };
    });
    const taxaEntregaCentavos = dados.tipoAtendimento === 'delivery' ? 890 : 0;
    const totalCentavos = valorCentavos + taxaEntregaCentavos;
    transacao.set(pedidoRef, {
      idRestaurante: identidade.idRestaurante,
      idComanda: comandaRef.id,
      idMesa: dados.idMesa,
      idGarcom: dados.idGarcom,
      nomeMesa,
      nomeGarcom,
      nomeCliente: dados.nomeCliente,
      telefone: dados.telefone,
      endereco: dados.endereco,
      tipoAtendimento: dados.tipoAtendimento,
      canal: dados.tipoAtendimento === 'delivery' ? 'delivery' : 'salão',
      status: 'novo',
      prioridade: corpo.prioridade === 'alta' ? 'alta' : 'normal',
      itens: itensPersistidos,
      observacoes: dados.observacoes,
      subtotalCentavos: valorCentavos,
      taxaEntregaCentavos,
      descontoCentavos: 0,
      valorCentavos: totalCentavos,
      pagamento: null,
      versao: 1,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    transacao.set(comandaRef, {
      idRestaurante: identidade.idRestaurante,
      idPedido: pedidoRef.id,
      idMesa: dados.idMesa,
      status: 'aberta',
      valorCentavos: totalCentavos,
      criadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    transacao.set(historicoRef, {
      de: null,
      para: 'novo',
      motivo: 'Pedido aberto',
      idAtor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
    });
    if (mesaRef) transacao.update(mesaRef, { estado: 'ocupada', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp() });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'pedidos.criado', tipoRecurso: 'pedido', idRecurso: pedidoRef.id });
  return { status: 201, corpo: { recurso: 'pedido', id: pedidoRef.id, idComanda: comandaRef.id, status: 'novo', valorCentavos } };
}

async function atualizarStatusPedido(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const para = enumObrigatorio(corpo.status, ESTADOS_PEDIDO, 'status');
  const motivo = para === 'cancelado' ? textoObrigatorio(corpo.motivoCancelamento, 'motivoCancelamento', 500) : textoOpcional(corpo.motivo, 'motivo', 500);
  const pedidoRef = caminhoRestaurante(identidade.idRestaurante).collection('pedidos').doc(id);
  const db = pedidoRef.firestore;
  let de = '';
  await db.runTransaction(async transacao => {
    const documento = await transacao.get(pedidoRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
    const pedido = documento.data() || {};
    de = pedido.status || 'novo';
    if (!TRANSICOES[de]?.has(para)) throw new ApiError(409, 'TRANSICAO_INVALIDA', `Não é permitido alterar pedido de ${de} para ${para}.`);
    const agora = { status: para, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(pedido.versao || 1) + 1 };
    if (motivo) agora.motivoUltimaAlteracao = motivo;
    if (para === 'preparo') agora.enviadoCozinhaEm = FieldValue.serverTimestamp();
    if (para === 'entregue') agora.entregueEm = FieldValue.serverTimestamp();
    if (para === 'finalizado') agora.finalizadoEm = FieldValue.serverTimestamp();
    if (para === 'cancelado') agora.canceladoEm = FieldValue.serverTimestamp();
    transacao.update(pedidoRef, agora);
    transacao.set(pedidoRef.collection('historicoStatus').doc(), { de, para, motivo: motivo || '', idAtor: identidade.idUsuario, criadoEm: FieldValue.serverTimestamp() });
    if (['finalizado', 'cancelado'].includes(para) && pedido.idMesa) {
      const mesaRef = caminhoRestaurante(identidade.idRestaurante).collection('mesas').doc(pedido.idMesa);
      transacao.update(mesaRef, { estado: 'disponivel', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp() });
    }
    if (para === 'finalizado' && pedido.idComanda) {
      const comandaRef = caminhoRestaurante(identidade.idRestaurante).collection('comandas').doc(pedido.idComanda);
      transacao.update(comandaRef, { status: 'fechada', fechadoEm: FieldValue.serverTimestamp(), atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp() });
    }
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `pedidos.status.${para}`, tipoRecurso: 'pedido', idRecurso: id });
  return { corpo: { recurso: 'pedido', id, de, para, atualizado: true } };
}

module.exports = async function pedidos(req, res) {
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao: ['POST', 'PATCH'].includes(String(req.method || '').toUpperCase()), appCheck: true }, async ({ idRequisicao }) => {
    const metodo = String(req.method || '').toUpperCase();
    const mutacao = ['POST', 'PATCH'].includes(metodo);
    const identidade = await obterIdentidadeOperacional(req, mutacao ? PAPEIS_PEDIDOS : PAPEIS_LEITURA);
    if (metodo === 'GET') return listarPedidos(identidade, req);
    const corpo = await lerCorpoJson(req);
    if (metodo === 'POST') return criarPedido(identidade, corpo, idRequisicao);
    if (corpo.recurso !== 'pedido' && corpo.recurso !== 'status') throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de pedidos inválido.');
    return atualizarStatusPedido(identidade, corpo, idRequisicao);
  });
};
