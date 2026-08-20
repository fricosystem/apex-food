'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  exigirPapel,
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
const PAPEIS_GARCOM = ['proprietario', 'administrador', 'gerente', 'garcom'];
const PAPEIS_COZINHA = ['proprietario', 'administrador', 'gerente', 'cozinha'];
const ESTADOS_PEDIDO = new Set(['novo', 'preparo', 'pronto', 'entregue', 'finalizado', 'cancelado', 'rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'servido', 'rejeitado_garcom']);
const TIPOS_ATENDIMENTO = new Set(['mesa', 'delivery']);
const TRANSICOES = Object.freeze({
  novo: new Set(['preparo', 'cancelado']),
  preparo: new Set(['pronto', 'cancelado']),
  pronto: new Set(['entregue', 'cancelado']),
  entregue: new Set(['finalizado']),
  finalizado: new Set(),
  cancelado: new Set(),
});
const TRANSICOES_QR = Object.freeze({
  rascunho: new Set(['aguardando_confirmacao_garcom', 'cancelado']),
  aguardando_confirmacao_garcom: new Set(['confirmado_garcom', 'rejeitado_garcom', 'cancelado']),
  confirmado_garcom: new Set(['enviado_cozinha', 'cancelado']),
  enviado_cozinha: new Set(['em_preparo', 'cancelado']),
  em_preparo: new Set(['pronto', 'cancelado']),
  pronto: new Set(['servido', 'cancelado']),
  servido: new Set(),
  rejeitado_garcom: new Set(),
});

function pedidoPublicoQr(pedido) {
  return pedido?.origem === 'cardapioDigital' || typeof pedido?.statusPedido === 'string' || typeof pedido?.idSessaoMesa === 'string';
}

function hashOperacao(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex').slice(0, 40);
}

function chaveIdempotenciaPedido(valor, fallback) {
  const chave = valor === undefined || valor === null || valor === '' ? fallback : valor;
  if (typeof chave !== 'string' || chave.trim().length < 8 || chave.trim().length > 200) {
    throw new ApiError(400, 'CHAVE_IDEMPOTENCIA_INVALIDA', 'A chave de idempotência é obrigatória para alterar o pedido.');
  }
  return chave.trim();
}

function statusPedidoOperacional(pedido) {
  return pedido?.statusPedido || pedido?.status || 'novo';
}

function normalizarRecurso(valor) {
  if (valor === 'historico' || valor === 'cozinha' || valor === 'pedido') return 'pedidos';
  if (valor === 'historicoComanda' || valor === 'historico-comanda') return 'historicoComanda';
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
  dto.itens = Array.isArray(dto.itens) ? dto.itens : Array.isArray(dto.itensResumo) ? dto.itensResumo : [];
  dto.quantidadeItens = dto.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  dto.valorCentavos = Number(dto.valorCentavos || 0);
  dto.taxaEntregaCentavos = Number(dto.taxaEntregaCentavos || 0);
  dto.statusPedido = dto.statusPedido || null;
  dto.status = dto.statusPedido || dto.status || 'novo';
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

async function listarHistoricoComanda(identidade, req) {
  const idComanda = idDocumento(queryString(req, 'idComanda') || '', 'idComanda');
  const limite = limitarInteiro(req.query?.limite, 200, 300);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const comandaRef = restaurante.collection('comandas').doc(idComanda);
  const documentoComanda = await comandaRef.get();
  if (!documentoComanda.exists || documentoComanda.data()?.estado === 'excluido') throw new ApiError(404, 'COMANDA_NAO_ENCONTRADA', 'Comanda não encontrada.');
  const eventos = await comandaRef.collection('historicoStatus').orderBy('criadoEm', 'desc').limit(limite).get();
  const historico = eventos.docs.map(documento => {
    const evento = documento.data() || {};
    return {
      id: documento.id,
      statusAnterior: evento.statusAnterior || evento.de || null,
      statusNovo: evento.statusNovo || evento.para || evento.acao || '',
      motivo: evento.motivo || '',
      papelExecutor: evento.papelExecutor || evento.papelAtor || null,
      idRequisicao: evento.idRequisicao || null,
      criadoEm: timestampParaIso(evento.criadoEm),
    };
  });
  const comanda = documentoComanda.data() || {};
  return { corpo: { recurso: 'historicoComanda', idComanda, statusComanda: comanda.statusComanda || comanda.status || null, historico, meta: { idRestaurante: identidade.idRestaurante, limite } } };
}

async function listarPedidos(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (recurso === 'historicoComanda') return listarHistoricoComanda(identidade, req);
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

function exigirPapelEncaminhamentoCaixa(identidade) {
  exigirPapel(identidade, PAPEIS_GARCOM);
}

async function encaminharComandaCaixa(identidade, corpo, idRequisicao) {
  const idComanda = idDocumento(corpo.idComanda || corpo.id, 'idComanda');
  const motivo = textoOpcional(corpo.observacaoOperacional || corpo.motivo, 'observacaoOperacional', 500);
  exigirPapelEncaminhamentoCaixa(identidade);
  const chave = chaveIdempotenciaPedido(corpo.chaveIdempotencia, idRequisicao);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const comandaRef = restaurante.collection('comandas').doc(idComanda);
  const encaminhamentoRef = restaurante.collection('encaminhamentosCaixa').doc(idComanda);
  const mesaRef = corpo.idMesa ? restaurante.collection('mesas').doc(idDocumento(String(corpo.idMesa), 'idMesa')) : null;
  const idOperacao = hashOperacao(`${identidade.idRestaurante}:${identidade.idUsuario}:comanda-caixa:${idComanda}:${chave}`);
  const idempotenciaRef = restaurante.collection('chavesIdempotencia').doc(idOperacao);
  const hashPayload = hashOperacao(JSON.stringify({ idComanda, motivo }));
  const pedidosQuery = restaurante.collection('pedidos').where('idComanda', '==', idComanda).limit(300);
  let resultado;
  let repeticaoIdempotente = false;

  await comandaRef.firestore.runTransaction(async transacao => {
    const [idempotenciaDocumento, comandaDocumento, encaminhamentoDocumento, pedidosDocumentos] = await Promise.all([
      transacao.get(idempotenciaRef),
      transacao.get(comandaRef),
      transacao.get(encaminhamentoRef),
      transacao.get(pedidosQuery),
    ]);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave de encaminhamento já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      repeticaoIdempotente = true;
      return;
    }
    if (!comandaDocumento.exists || comandaDocumento.data()?.estado === 'excluido') throw new ApiError(404, 'COMANDA_NAO_ENCONTRADA', 'Comanda não encontrada.');
    const comanda = comandaDocumento.data() || {};
    const statusComanda = comanda.statusComanda || comanda.status || 'aberta';
    if (statusComanda !== 'em_consumo') throw new ApiError(409, 'COMANDA_NAO_EM_CONSUMO', 'A comanda precisa estar em consumo para ser encaminhada ao caixa.');
    if (encaminhamentoDocumento.exists && ['encaminhada', 'recebida'].includes(encaminhamentoDocumento.data()?.statusEncaminhamento)) throw new ApiError(409, 'COMANDA_JA_ENCAMINHADA', 'Esta comanda já foi encaminhada ao caixa.');
    const pedidos = pedidosDocumentos.docs.filter(documento => documento.data()?.estado !== 'excluido');
    if (!pedidos.length) throw new ApiError(409, 'COMANDA_SEM_PEDIDOS', 'A comanda não possui pedidos para encaminhamento.');
    const estadosPendentes = new Set(['rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'novo', 'preparo']);
    const pendentes = pedidos.filter(documento => estadosPendentes.has(statusPedidoOperacional(documento.data())));
    if (pendentes.length) throw new ApiError(409, 'COMANDA_COM_PEDIDOS_PENDENTES', 'A comanda possui pedidos que ainda precisam ser concluídos antes do caixa.');
    const mesaId = String(comanda.idMesa || corpo.idMesa || '');
    const referenciaMesa = mesaId ? restaurante.collection('mesas').doc(mesaId) : mesaRef;
    if (!referenciaMesa) throw new ApiError(409, 'MESA_NAO_ENCONTRADA', 'A comanda não está vinculada a uma mesa.');
    const mesaDocumento = await transacao.get(referenciaMesa);
    if (!mesaDocumento.exists) throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa da comanda não encontrada.');
    const mesa = mesaDocumento.data() || {};
    const totalCentavos = Number(comanda.totalCentavos ?? comanda.valorCentavos ?? 0);
    const pedidosServidos = pedidos.filter(documento => ['servido', 'entregue', 'finalizado'].includes(statusPedidoOperacional(documento.data()))).length;
    const resumoOperacional = {
      idComanda,
      idMesa: referenciaMesa.id,
      nomeMesa: String(mesa.nome || mesa.numero || referenciaMesa.id),
      idGarcomResponsavel: comanda.idGarcomResponsavel || null,
      nomeGarcom: String(comanda.nomeGarcomResponsavel || comanda.nomeGarcom || ''),
      totalCentavos: Number.isSafeInteger(totalCentavos) && totalCentavos >= 0 ? totalCentavos : 0,
      quantidadePedidos: pedidos.length,
      pedidosServidos,
      participantes: Number(comanda.participantesAtivos || 0),
    };
    transacao.set(encaminhamentoRef, {
      idRestaurante: identidade.idRestaurante,
      idEncaminhamento: encaminhamentoRef.id,
      idComanda,
      idMesa: referenciaMesa.id,
      idGarcomResponsavel: comanda.idGarcomResponsavel || null,
      statusEncaminhamento: 'encaminhada',
      resumoOperacional,
      observacaoOperacional: motivo,
      encaminhadaEm: FieldValue.serverTimestamp(),
      recebidaEm: null,
      concluidaEm: null,
      idOperadorCaixa: null,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      chaveIdempotencia: chave,
      versao: 1,
    });
    for (const pedidoDocumento of pedidos) {
      const pedidoAtual = pedidoDocumento.data() || {};
      transacao.update(pedidoDocumento.ref, {
        estadoComanda: 'encaminhada_caixa',
        atualizadoPor: identidade.idUsuario,
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: Number(pedidoAtual.versao || 1) + 1,
      });
    }
    transacao.update(comandaRef, {
      statusComanda: 'encaminhada_caixa',
      status: 'encaminhada_caixa',
      encaminhadaCaixaEm: FieldValue.serverTimestamp(),
      quantidadePedidosAbertos: 0,
      resumoOperacional,
      atualizadoPor: identidade.idUsuario,
      atualizadaEm: FieldValue.serverTimestamp(),
      versao: Number(comanda.versao || 1) + 1,
    });
    transacao.update(referenciaMesa, {
      estado: 'ocupada',
      estadoAtendimento: 'encaminhada_caixa',
      idComandaAberta: idComanda,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(mesa.versao || 1) + 1,
    });
    const evento = {
      idRestaurante: identidade.idRestaurante,
      idMesa: referenciaMesa.id,
      idComanda,
      acao: 'encaminhada_caixa',
      estadoAnterior: mesa.estadoAtendimento || 'ocupada',
      estadoNovo: 'encaminhada_caixa',
      idAtor: identidade.idUsuario,
      idOperacao,
      criadoEm: FieldValue.serverTimestamp(),
    };
    transacao.set(restaurante.collection('eventosMesas').doc(), evento);
    transacao.set(comandaRef.collection('historicoStatus').doc(), { ...evento, tipo: 'comanda', statusAnterior: statusComanda, statusNovo: 'encaminhada_caixa' });
    resultado = { recurso: 'encaminhamentoCaixa', id: encaminhamentoRef.id, idComanda, idMesa: referenciaMesa.id, statusEncaminhamento: 'encaminhada', atualizado: true };
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/pedidos',
      tipoOperacao: 'encaminhar_comanda_caixa',
      idComanda,
      resultado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  if (!repeticaoIdempotente) await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'comanda.encaminhadaCaixa', tipoRecurso: 'comanda', idRecurso: idComanda });
  return { corpo: { ...resultado, idempotente: repeticaoIdempotente } };
}

function exigirPapelTransicaoQr(identidade, para) {
  if (['confirmado_garcom', 'rejeitado_garcom', 'enviado_cozinha', 'servido'].includes(para)) {
    exigirPapel(identidade, PAPEIS_GARCOM);
    return;
  }
  if (['em_preparo', 'pronto'].includes(para)) {
    exigirPapel(identidade, PAPEIS_COZINHA);
    return;
  }
  exigirPapel(identidade, PAPEIS_PEDIDOS);
}

async function atualizarStatusPedidoQr(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const para = enumObrigatorio(corpo.status, ESTADOS_PEDIDO, 'status');
  exigirPapelTransicaoQr(identidade, para);
  const motivo = ['cancelado', 'rejeitado_garcom'].includes(para)
    ? textoObrigatorio(corpo.motivoCancelamento || corpo.motivoRejeicao || corpo.motivo, 'motivo', 500)
    : textoOpcional(corpo.motivo, 'motivo', 500);
  const chave = chaveIdempotenciaPedido(corpo.chaveIdempotencia, idRequisicao);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const pedidoRef = restaurante.collection('pedidos').doc(id);
  const hashPayload = hashOperacao(JSON.stringify({ id, para, motivo }));
  const idOperacao = hashOperacao(`${identidade.idRestaurante}:${identidade.idUsuario}:pedido-status:${id}:${chave}`);
  const idempotenciaRef = restaurante.collection('chavesIdempotencia').doc(idOperacao);
  const db = pedidoRef.firestore;
  let resultado;
  let repeticaoIdempotente = false;

  await db.runTransaction(async transacao => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave de status já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      repeticaoIdempotente = true;
      return;
    }
    const documento = await transacao.get(pedidoRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
    const pedido = documento.data() || {};
    if (!pedidoPublicoQr(pedido)) throw new ApiError(409, 'PEDIDO_LEGADO', 'Este pedido pertence ao fluxo operacional legado.');
    const de = statusPedidoOperacional(pedido);
    if (!TRANSICOES_QR[de]?.has(para)) throw new ApiError(409, 'TRANSICAO_INVALIDA', `Não é permitido alterar pedido de ${de} para ${para}.`);

    const comandaRef = pedido.idComanda ? restaurante.collection('comandas').doc(String(pedido.idComanda)) : null;
    const mesaRef = pedido.idMesa ? restaurante.collection('mesas').doc(String(pedido.idMesa)) : null;
    const fichaRef = pedido.id ? restaurante.collection('fichasCozinha').doc(String(pedido.id)) : null;
    const [comandaDocumento, mesaDocumento, fichaDocumento] = await Promise.all([
      comandaRef ? transacao.get(comandaRef) : null,
      mesaRef ? transacao.get(mesaRef) : null,
      fichaRef ? transacao.get(fichaRef) : null,
    ]);
    if (!comandaDocumento?.exists) throw new ApiError(409, 'COMANDA_NAO_ENCONTRADA', 'A comanda deste pedido não foi encontrada.');
    if (!mesaDocumento?.exists) throw new ApiError(409, 'MESA_NAO_ENCONTRADA', 'A mesa deste pedido não foi encontrada.');
    const comanda = comandaDocumento.data() || {};
    if (['confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'servido'].includes(para) && ['encaminhada_caixa', 'encerrada', 'cancelada'].includes(comanda.statusComanda || comanda.status)) {
      throw new ApiError(409, 'COMANDA_ENCERRADA', 'A comanda não aceita novas alterações neste momento.');
    }
    if (para === 'confirmado_garcom' && comanda.idGarcomResponsavel && comanda.idGarcomResponsavel !== identidade.idUsuario) {
      throw new ApiError(409, 'GARCOM_JA_RESPONSAVEL', 'Outro garçom já confirmou o pedido desta mesa.');
    }

    const agora = {
      statusPedido: para,
      status: para,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(pedido.versao || 1) + 1,
    };
    if (motivo) agora.motivoUltimaAlteracao = motivo;
    const camposTempo = {
      confirmado_garcom: 'confirmadoGarcomEm',
      enviado_cozinha: 'enviadoCozinhaEm',
      em_preparo: 'inicioPreparoEm',
      pronto: 'prontoEm',
      servido: 'servidoEm',
      rejeitado_garcom: 'rejeitadoGarcomEm',
      cancelado: 'canceladoEm',
    };
    if (camposTempo[para]) agora[camposTempo[para]] = FieldValue.serverTimestamp();
    if (para === 'confirmado_garcom') {
      agora.idGarcomResponsavel = identidade.idUsuario;
      agora.idGarcom = identidade.idUsuario;
    }
    transacao.update(pedidoRef, agora);

    const papelAtor = identidade.papeis.find(papel => ['proprietario', 'administrador', 'gerente', 'garcom', 'cozinha'].includes(papel)) || 'operador';
    const evento = {
      idRestaurante: identidade.idRestaurante,
      idPedido: pedidoRef.id,
      idComanda: pedido.idComanda || null,
      idMesa: pedido.idMesa || null,
      statusAnterior: de,
      statusNovo: para,
      idAtor: identidade.idUsuario,
      papelAtor,
      motivo: motivo || '',
      idRequisicao,
      criadoEm: FieldValue.serverTimestamp(),
      versaoEvento: Number(pedido.versao || 1),
    };
    transacao.set(pedidoRef.collection('historicoStatus').doc(), evento);
    transacao.set(pedidoRef.collection('eventos').doc(), evento);

    const atualizacaoComanda = {
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(comanda.versao || 1) + 1,
    };
    if (para === 'confirmado_garcom') {
      atualizacaoComanda.statusComanda = 'em_consumo';
      atualizacaoComanda.status = 'em_consumo';
      atualizacaoComanda.idGarcomResponsavel = identidade.idUsuario;
    }
    if (['rejeitado_garcom', 'cancelado'].includes(para)) {
      const totalPedido = Number(pedido.totalCentavos || pedido.valorCentavos || 0);
      atualizacaoComanda.quantidadePedidosAbertos = Math.max(0, Number(comanda.quantidadePedidosAbertos || 0) - 1);
      atualizacaoComanda.totalCentavos = Math.max(0, Number(comanda.totalCentavos || 0) - totalPedido);
      atualizacaoComanda.valorCentavos = atualizacaoComanda.totalCentavos;
    }
    if (comandaRef) transacao.update(comandaRef, atualizacaoComanda);

    if (['enviado_cozinha', 'em_preparo', 'pronto'].includes(para) && !fichaRef) throw new ApiError(409, 'FICHA_COZINHA_INVALIDA', 'Não foi possível encaminhar este pedido à cozinha.');
    if (para === 'enviado_cozinha') {
      transacao.set(fichaRef, {
        idRestaurante: identidade.idRestaurante,
        idFicha: fichaRef.id,
        idPedido: pedidoRef.id,
        idComanda: pedido.idComanda || null,
        idMesa: pedido.idMesa || null,
        idGarcomResponsavel: pedido.idGarcomResponsavel || identidade.idUsuario,
        statusFicha: 'aguardando_preparo',
        prioridade: pedido.prioridade || 'normal',
        itensSnapshot: Array.isArray(pedido.itens) ? pedido.itens : Array.isArray(pedido.itensResumo) ? pedido.itensResumo : [],
        observacoes: pedido.observacoes || '',
        criadoPor: identidade.idUsuario,
        atualizadoPor: identidade.idUsuario,
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: 1,
      });
    } else if (['em_preparo', 'pronto'].includes(para)) {
      if (!fichaDocumento?.exists) throw new ApiError(409, 'FICHA_COZINHA_NAO_ENCONTRADA', 'A ficha deste pedido não está disponível na cozinha.');
      transacao.update(fichaRef, {
        statusFicha: para === 'em_preparo' ? 'em_preparo' : 'pronto',
        ...(para === 'em_preparo' ? { iniciadoEm: FieldValue.serverTimestamp() } : { prontoEm: FieldValue.serverTimestamp() }),
        atualizadoPor: identidade.idUsuario,
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: Number(fichaDocumento.data()?.versao || 1) + 1,
      });
    } else if (['cancelado', 'rejeitado_garcom'].includes(para) && fichaDocumento?.exists) {
      transacao.update(fichaRef, { statusFicha: 'cancelada', canceladaEm: FieldValue.serverTimestamp(), atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(fichaDocumento.data()?.versao || 1) + 1 });
    }

    const estadoMesa = {
      confirmado_garcom: 'aguardando_confirmacao',
      enviado_cozinha: 'em_preparo',
      em_preparo: 'em_preparo',
      pronto: 'pedido_pronto',
      servido: 'ocupada',
      rejeitado_garcom: 'ocupada',
      cancelado: 'ocupada',
    }[para];
    if (mesaRef && estadoMesa) transacao.update(mesaRef, {
      estado: 'ocupada',
      estadoAtendimento: estadoMesa,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    resultado = { recurso: 'pedido', id, de, para, statusPedido: para, status: para, atualizado: true };
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/pedidos',
      tipoOperacao: 'status_pedido_qr',
      idPedido: id,
      resultado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  if (!repeticaoIdempotente) await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `pedidos.status.${para}`, tipoRecurso: 'pedido', idRecurso: id });
  return { corpo: { ...resultado, idempotente: repeticaoIdempotente } };
}

async function atualizarStatusPedido(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const pedidoRef = caminhoRestaurante(identidade.idRestaurante).collection('pedidos').doc(id);
  const documento = await pedidoRef.get();
  if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
  if (pedidoPublicoQr(documento.data())) return atualizarStatusPedidoQr(identidade, corpo, idRequisicao);

  const para = enumObrigatorio(corpo.status, ESTADOS_PEDIDO, 'status');
  const motivo = para === 'cancelado' ? textoObrigatorio(corpo.motivoCancelamento, 'motivoCancelamento', 500) : textoOpcional(corpo.motivo, 'motivo', 500);
  const db = pedidoRef.firestore;
  let de = '';
  await db.runTransaction(async transacao => {
    const atual = await transacao.get(pedidoRef);
    if (!atual.exists || atual.data()?.estado === 'excluido') throw new ApiError(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
    const pedido = atual.data() || {};
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
    if (metodo === 'POST') {
      if (corpo.recurso === 'encaminhamentoCaixa' || corpo.recurso === 'encaminharComandaCaixa') return encaminharComandaCaixa(identidade, corpo, idRequisicao);
      return criarPedido(identidade, corpo, idRequisicao);
    }
    if (corpo.recurso === 'encaminhamentoCaixa' || corpo.recurso === 'encaminharComandaCaixa') return encaminharComandaCaixa(identidade, corpo, idRequisicao);
    if (corpo.recurso !== 'pedido' && corpo.recurso !== 'status') throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de pedidos inválido.');
    return atualizarStatusPedido(identidade, corpo, idRequisicao);
  });
};
