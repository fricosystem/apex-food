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
const { criarNotificacoesNaTransacao, TIPOS_NOTIFICACAO } = require('./notificacoes');
const { enviarNotificacaoFcm } = require('./fcm-notificacoes');
const { baixarEstoqueParaPedido, devolverEstoqueDoPedido } = require('./estoque-pedidos');
const { distribuirTarefasCozinha } = require('./cozinha-distribuicao');
const { atualizarTarefaCozinha } = require('./cozinha-tarefas-handler');
const { lerDetalhesComanda } = require('./detalhes-comanda');

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

function timestampOperacionalMs(valor) {
  if (!valor) return 0;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  const numero = Number(valor);
  if (Number.isFinite(numero)) return numero;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function dataOperacionalAtual() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.filter(parte => parte.type !== 'literal').map(parte => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function horaOperacionalAtual() {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
  if (hora >= 11 && hora < 16) return 'Almoço';
  if (hora >= 17 && hora < 24) return 'Jantar';
  return 'Integral';
}

function cargaFuncionario(dados) {
  const carga = dados?.cargaAtual || {};
  return {
    mesasAtivas: Math.max(0, Number(carga.mesasAtivas || 0)),
    comandasAtivas: Math.max(0, Number(carga.comandasAtivas || 0)),
    pedidosPendentes: Math.max(0, Number(carga.pedidosPendentes || 0)),
    tarefasAtivas: Math.max(0, Number(carga.tarefasAtivas || 0)),
  };
}

function escalaCompativel(funcionarioId, escalasDocumentos, dataAtual = dataOperacionalAtual(), turnoAtual = horaOperacionalAtual()) {
  const escalas = escalasDocumentos.filter(documento => String(documento.data()?.funcionarioId || '') === String(funcionarioId));
  if (!escalas.length) return true;
  return escalas.some(documento => {
    const escala = documento.data() || {};
    return ['agendado', 'presente'].includes(escala.status) && escala.data === dataAtual && (escala.turno === turnoAtual || escala.turno === 'Integral');
  });
}

function pontuacaoGarcom(carga, capacidades) {
  const ocupacaoMesas = carga.mesasAtivas / Math.max(1, capacidades.capacidadeMesas);
  const ocupacaoComandas = carga.comandasAtivas / Math.max(1, capacidades.capacidadeComandas);
  const ocupacaoPedidos = carga.pedidosPendentes / Math.max(1, capacidades.capacidadePedidos);
  return (ocupacaoMesas * 0.45) + (ocupacaoComandas * 0.35) + (ocupacaoPedidos * 0.20);
}

function compararCandidatosGarcom(a, b) {
  if (a.pontuacao !== b.pontuacao) return a.pontuacao - b.pontuacao;
  if (a.prioridadeDistribuicao !== b.prioridadeDistribuicao) return a.prioridadeDistribuicao - b.prioridadeDistribuicao;
  if (a.ultimaAtribuicaoMs !== b.ultimaAtribuicaoMs) return a.ultimaAtribuicaoMs - b.ultimaAtribuicaoMs;
  return a.id.localeCompare(b.id, 'en');
}

function selecionarGarcomResponsavel({ funcionariosDocumentos, escalasDocumentos = [], incrementoMesa = 0, incrementoComanda = 0, incrementoPedido = 0 }) {
  const candidatos = funcionariosDocumentos.map(documento => {
    const dados = documento.data() || {};
    const carga = cargaFuncionario(dados);
    const capacidades = {
      capacidadeMesas: Math.max(1, Number(dados.capacidadeMesas || 1)),
      capacidadeComandas: Math.max(1, Number(dados.capacidadeComandas || 1)),
      capacidadePedidos: Math.max(1, Number(dados.capacidadePedidos || 1)),
    };
    return {
      id: documento.id,
      nome: String(dados.nome || dados.nomeCompleto || documento.id),
      dados,
      carga,
      capacidades,
      pontuacao: pontuacaoGarcom(carga, capacidades),
      prioridadeDistribuicao: Math.max(0, Number(dados.prioridadeDistribuicao || 0)),
      ultimaAtribuicaoMs: timestampOperacionalMs(dados.ultimaAtribuicaoEm),
    };
  }).filter(candidato => {
    const dados = candidato.dados;
    if (dados.estado === 'excluido' || dados.status !== 'ativo' || dados.setor !== 'Salão' || dados.papelOperacional !== 'garcom') return false;
    if (['pausado', 'indisponivel'].includes(dados.disponibilidadeAtendimento)) return false;
    if (!escalaCompativel(candidato.id, escalasDocumentos)) return false;
    return candidato.carga.mesasAtivas + incrementoMesa <= candidato.capacidades.capacidadeMesas
      && candidato.carga.comandasAtivas + incrementoComanda <= candidato.capacidades.capacidadeComandas
      && candidato.carga.pedidosPendentes + incrementoPedido <= candidato.capacidades.capacidadePedidos;
  }).sort(compararCandidatosGarcom);
  return candidatos[0] || null;
}

async function atribuirGarcomResponsavel({ transacao, restaurante, idRestaurante, idComanda, idMesa, comanda = {}, mesa = {}, funcionariosDocumentos, escalasDocumentos = [], incrementoMesa = 0, incrementoComanda = 0, incrementoPedido = 0, idAtor }) {
  if (comanda.idGarcomResponsavel) {
    const idFuncionarioResponsavel = String(comanda.idFuncionarioResponsavel || '');
    const idUsuarioResponsavel = String(comanda.idUsuarioGarcomResponsavel || comanda.idGarcomResponsavel || '');
    const funcionarioDocumento = funcionariosDocumentos.find(documento => documento.id === idFuncionarioResponsavel || String(documento.data()?.idUsuario || '') === idUsuarioResponsavel);
    if (funcionarioDocumento && (incrementoMesa || incrementoComanda || incrementoPedido)) {
      const dadosFuncionario = funcionarioDocumento.data() || {};
      const carga = cargaFuncionario(dadosFuncionario);
      const cargaNova = { mesasAtivas: carga.mesasAtivas + incrementoMesa, comandasAtivas: carga.comandasAtivas + incrementoComanda, pedidosPendentes: carga.pedidosPendentes + incrementoPedido, tarefasAtivas: carga.tarefasAtivas };
      transacao.update(funcionarioDocumento.ref, { cargaAtual: cargaNova, disponibilidadeAtendimento: 'em_atendimento', atualizadoPor: idAtor, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(dadosFuncionario.versao || 1) + 1 });
    }
    return { status: 'atribuido', idGarcomResponsavel: String(comanda.idGarcomResponsavel), idFuncionarioResponsavel, idUsuarioGarcomResponsavel: idUsuarioResponsavel, nomeGarcomResponsavel: String(comanda.nomeGarcomResponsavel || comanda.nomeGarcom || '') };
  }
  const candidato = selecionarGarcomResponsavel({ funcionariosDocumentos, escalasDocumentos, incrementoMesa, incrementoComanda, incrementoPedido });
  const eventoRef = restaurante.collection('eventosMesas').doc();
  if (!candidato) {
    transacao.set(eventoRef, {
      idRestaurante,
      idMesa,
      idComanda,
      acao: 'garcom_aguardando_atribuicao',
      estadoNovo: 'aguardando_atribuicao',
      idFuncionario: null,
      idAtor,
      criadoEm: FieldValue.serverTimestamp(),
    });
    return { status: 'aguardando_atribuicao', idGarcomResponsavel: null, nomeGarcomResponsavel: '' };
  }
  const novaCarga = {
    mesasAtivas: candidato.carga.mesasAtivas + incrementoMesa,
    comandasAtivas: candidato.carga.comandasAtivas + incrementoComanda,
    pedidosPendentes: candidato.carga.pedidosPendentes + incrementoPedido,
    tarefasAtivas: candidato.carga.tarefasAtivas,
  };
  const funcionarioRef = restaurante.collection('funcionarios').doc(candidato.id);
  const idGarcomResponsavel = String(candidato.dados.idUsuario || candidato.id);
  const idUsuarioGarcomResponsavel = candidato.dados.idUsuario ? String(candidato.dados.idUsuario) : '';
  transacao.update(funcionarioRef, {
    cargaAtual: novaCarga,
    disponibilidadeAtendimento: 'em_atendimento',
    ultimaAtribuicaoEm: FieldValue.serverTimestamp(),
    atualizadoPor: idAtor,
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: Number(candidato.dados.versao || 1) + 1,
  });
  transacao.set(eventoRef, {
    idRestaurante,
    idMesa,
    idComanda,
    acao: 'garcom_atribuido',
    estadoNovo: 'atribuido',
    idFuncionario: candidato.id,
    idUsuario: idUsuarioGarcomResponsavel || null,
    nomeFuncionario: candidato.nome,
    pontuacaoDistribuicao: candidato.pontuacao,
    cargaAnterior: candidato.carga,
    cargaNova: novaCarga,
    idAtor,
    criadoEm: FieldValue.serverTimestamp(),
  });
  return { status: 'atribuido', idGarcomResponsavel, idFuncionarioResponsavel: candidato.id, idUsuarioGarcomResponsavel, nomeGarcomResponsavel: candidato.nome, pontuacao: candidato.pontuacao, cargaNova: novaCarga };
}

function normalizarRecurso(valor) {
  if (valor === 'historico' || valor === 'cozinha' || valor === 'pedido') return 'pedidos';
  if (valor === 'ficha' || valor === 'fichaCozinha' || valor === 'fichasCozinha') return 'fichas';
  if (valor === 'historicoComanda' || valor === 'historico-comanda') return 'historicoComanda';
  if (valor === 'detalhesComanda' || valor === 'detalhes-comanda') return 'detalhesComanda';
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

function dtoFichaCozinha(documento) {
  const dto = dtoDocumento(documento);
  for (const campo of ['criadoEm', 'atualizadoEm', 'iniciadoEm', 'prontoEm', 'canceladaEm']) {
    if (campo in dto) dto[campo] = timestampParaIso(dto[campo]);
  }
  dto.id = String(dto.id);
  dto.statusFicha = dto.statusFicha || 'aguardando_preparo';
  dto.tarefas = Array.isArray(dto.tarefas) ? dto.tarefas : [];
  dto.tarefasTotal = Number(dto.tarefasTotal || dto.tarefas.length || 0);
  dto.tarefasAtribuidas = Number(dto.tarefasAtribuidas || dto.tarefas.filter(tarefa => tarefa.idCozinheiroResponsavel).length || 0);
  dto.tarefasAguardandoAtribuicao = Number(dto.tarefasAguardandoAtribuicao || Math.max(0, dto.tarefasTotal - dto.tarefasAtribuidas));
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
  if (recurso === 'detalhesComanda') {
    const detalhes = await lerDetalhesComanda({ restaurante: caminhoRestaurante(identidade.idRestaurante), idComanda: queryString(req, 'idComanda') });
    return { corpo: { recurso: 'detalhesComanda', ...detalhes, meta: { idRestaurante: identidade.idRestaurante } } };
  }
  if (!['pedidos', 'comandas', 'fichas'].includes(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de pedidos inválido.');
  const limite = limitarInteiro(req.query?.limite, 200, 300);
  const nomeColecaoRecurso = recurso === 'fichas' ? 'fichasCozinha' : recurso;
  const documentos = await listarColecao(identidade.idRestaurante, nomeColecaoRecurso, limite);
  const eGarcomSemSupervisao = identidade.papeis.includes('garcom') && !identidade.papeis.some(papel => ['proprietario', 'administrador', 'gerente'].includes(papel));
  const eCozinhaSemSupervisao = identidade.papeis.includes('cozinha') && !identidade.papeis.some(papel => ['proprietario', 'administrador', 'gerente'].includes(papel));
  const visivelParaGarcom = item => {
    if (!eGarcomSemSupervisao) return true;
    return [item.idGarcomResponsavel, item.idUsuarioGarcomResponsavel, item.idFuncionarioResponsavel, item.idGarcom].filter(Boolean).map(String).includes(String(identidade.idUsuario));
  };
  const visivelParaCozinha = item => {
    if (!eCozinhaSemSupervisao || recurso !== 'fichas') return true;
    if (item.statusDistribuicaoCozinha === 'aguardando_atribuicao') return true;
    return [item.idCozinheiroResponsavel, item.idUsuarioCozinheiroResponsavel].filter(Boolean).map(String).includes(String(identidade.idUsuario))
      || (Array.isArray(item.tarefas) && item.tarefas.some(tarefa => [tarefa.idCozinheiroResponsavel, tarefa.idUsuarioCozinheiroResponsavel].filter(Boolean).map(String).includes(String(identidade.idUsuario))));
  };
  const dto = recurso === 'pedidos' ? dtoPedido : recurso === 'fichas' ? dtoFichaCozinha : dtoDocumento;
  const itens = documentos
    .filter(documento => documento.data()?.estado !== 'excluido')
    .map(dto)
    .filter(item => visivelParaGarcom(item))
    .filter(item => visivelParaCozinha(item))
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
    await baixarEstoqueParaPedido({
      transacao,
      restauranteRef: restaurante,
      idPedido: pedidoRef.id,
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      itens: itensPersistidos,
      documentosProdutos: produtoDocumentos,
      motivo: 'Baixa automática do pedido administrativo.',
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
      estoqueBaixado: true,
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
  let eventoFcm = null;
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
    const estadosEncerrados = new Set(['servido', 'entregue', 'finalizado', 'rejeitado_garcom', 'cancelado']);
    const pedidosOperacionais = pedidos.filter(documento => !['rejeitado_garcom', 'cancelado'].includes(statusPedidoOperacional(documento.data())));
    const totalPedidosCentavos = pedidosOperacionais.reduce((total, documento) => total + Number(documento.data()?.totalCentavos ?? documento.data()?.valorCentavos ?? 0), 0);
    const estadosPendentes = new Set(['rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'novo', 'preparo']);
    const pendentes = pedidos.filter(documento => estadosPendentes.has(statusPedidoOperacional(documento.data())));
    if (pendentes.length) throw new ApiError(409, 'COMANDA_COM_PEDIDOS_PENDENTES', 'A comanda possui pedidos que ainda precisam ser concluídos antes do caixa.');
    if (pedidos.some(documento => !estadosEncerrados.has(statusPedidoOperacional(documento.data())))) throw new ApiError(409, 'COMANDA_COM_PEDIDOS_NAO_ENCERRADOS', 'Todos os pedidos precisam estar servidos ou encerrados operacionalmente antes do caixa.');
    const mesaId = String(comanda.idMesa || corpo.idMesa || '');
    const referenciaMesa = mesaId ? restaurante.collection('mesas').doc(mesaId) : mesaRef;
    if (!referenciaMesa) throw new ApiError(409, 'MESA_NAO_ENCONTRADA', 'A comanda não está vinculada a uma mesa.');
    const mesaDocumento = await transacao.get(referenciaMesa);
    if (!mesaDocumento.exists) throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa da comanda não encontrada.');
    const mesa = mesaDocumento.data() || {};
    const totalCentavos = Number(comanda.totalCentavos ?? comanda.valorCentavos ?? 0);
    if (!Number.isSafeInteger(totalCentavos) || totalCentavos < 0 || totalCentavos !== totalPedidosCentavos) throw new ApiError(409, 'VALOR_COMANDA_INCONSISTENTE', 'O total da comanda não confere com os pedidos operacionais.');
    const pedidosServidos = pedidos.filter(documento => ['servido', 'entregue', 'finalizado'].includes(statusPedidoOperacional(documento.data()))).length;
    const resumoOperacional = {
      idComanda,
      idMesa: referenciaMesa.id,
      nomeMesa: String(mesa.nome || mesa.numero || referenciaMesa.id),
      idGarcomResponsavel: comanda.idGarcomResponsavel || null,
      idFuncionarioGarcomResponsavel: comanda.idFuncionarioResponsavel || null,
      idUsuarioGarcomResponsavel: comanda.idUsuarioGarcomResponsavel || null,
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
      idFuncionarioGarcomResponsavel: comanda.idFuncionarioResponsavel || null,
      idUsuarioGarcomResponsavel: comanda.idUsuarioGarcomResponsavel || null,
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
    eventoFcm = {
      tipoNotificacao: TIPOS_NOTIFICACAO.comandaEncaminhadaCaixa,
      titulo: `Comanda aguardando caixa — mesa ${resumoOperacional.nomeMesa}`,
      mensagem: `A comanda foi encerrada pelo garçom e aguarda conferência operacional do caixa.`,
      prioridade: 'alta',
      eventoOrigem: `comanda:${idComanda}:encaminhamento:encaminhada`,
      idMesa: referenciaMesa.id,
      idComanda,
      idEncaminhamento: encaminhamentoRef.id,
      idGarcomResponsavel: comanda.idGarcomResponsavel || null,
    };
    criarNotificacoesNaTransacao(transacao, restaurante, eventoFcm);
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
  if (!repeticaoIdempotente) {
    await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'comanda.encaminhadaCaixa', tipoRecurso: 'comanda', idRecurso: idComanda });
    await enviarNotificacaoFcm({ idRestaurante: identidade.idRestaurante, evento: eventoFcm });
  }
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
  let eventoFcm = null;
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
    const deveDevolverEstoque = ['rejeitado_garcom', 'cancelado'].includes(para) && pedido.estoqueBaixado === true && pedido.estoqueRestaurado !== true;
    const itensParaDevolucao = Array.isArray(pedido.itens) ? pedido.itens : Array.isArray(pedido.itensResumo) ? pedido.itensResumo : [];
    const produtoRefsDevolucao = deveDevolverEstoque ? itensParaDevolucao.map(item => restaurante.collection('produtosCardapio').doc(String(item?.idProduto || ''))) : [];
    const [comandaDocumento, mesaDocumento, fichaDocumento, documentosProdutosDevolucao] = await Promise.all([
      comandaRef ? transacao.get(comandaRef) : null,
      mesaRef ? transacao.get(mesaRef) : null,
      fichaRef ? transacao.get(fichaRef) : null,
      deveDevolverEstoque ? Promise.all(produtoRefsDevolucao.map(referencia => transacao.get(referencia))) : Promise.resolve([]),
    ]);
    if (!comandaDocumento?.exists) throw new ApiError(409, 'COMANDA_NAO_ENCONTRADA', 'A comanda deste pedido não foi encontrada.');
    if (!mesaDocumento?.exists) throw new ApiError(409, 'MESA_NAO_ENCONTRADA', 'A mesa deste pedido não foi encontrada.');
    const comanda = comandaDocumento.data() || {};
    let distribuicaoCozinha = null;
    let funcionariosCozinhaDocumentos = [];
    let escalasCozinhaDocumentos = [];
    let tarefasFichaCancelamento = [];
    let funcionariosCancelamentoDocumentos = [];
    let funcionarioGarcomCancelamentoDocumento = null;
    if (['rejeitado_garcom', 'cancelado'].includes(para) && comanda.idFuncionarioResponsavel) {
      funcionarioGarcomCancelamentoDocumento = await transacao.get(restaurante.collection('funcionarios').doc(String(comanda.idFuncionarioResponsavel)));
    }
    if (['rejeitado_garcom', 'cancelado'].includes(para) && fichaDocumento?.exists) {
      const tarefasSnapshot = await transacao.get(fichaRef.collection('tarefas').limit(100));
      tarefasFichaCancelamento = tarefasSnapshot.docs;
      const idsFuncionarios = [...new Set(tarefasSnapshot.docs.map(documento => documento.data()?.idCozinheiroResponsavel).filter(Boolean).map(String))];
      if (idsFuncionarios.length) {
        funcionariosCancelamentoDocumentos = await Promise.all(idsFuncionarios.map(idFuncionario => transacao.get(restaurante.collection('funcionarios').doc(idFuncionario))));
      }
    }
    if (para === 'enviado_cozinha') {
      const [funcionariosSnapshot, escalasSnapshot] = await Promise.all([
        transacao.get(restaurante.collection('funcionarios').limit(300)),
        transacao.get(restaurante.collection('escalas').limit(1000)),
      ]);
      funcionariosCozinhaDocumentos = funcionariosSnapshot.docs;
      escalasCozinhaDocumentos = escalasSnapshot.docs;
    }
    if (['confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'servido'].includes(para) && ['encaminhada_caixa', 'encerrada', 'cancelada'].includes(comanda.statusComanda || comanda.status)) {
      throw new ApiError(409, 'COMANDA_ENCERRADA', 'A comanda não aceita novas alterações neste momento.');
    }
    const eSupervisor = identidade.papeis.some(papel => ['proprietario', 'administrador', 'gerente'].includes(papel));
    const identificadoresResponsavel = new Set([comanda.idGarcomResponsavel, comanda.idFuncionarioResponsavel, comanda.idUsuarioGarcomResponsavel].filter(Boolean).map(String));
    if (para === 'confirmado_garcom' && comanda.idGarcomResponsavel && !eSupervisor && !identificadoresResponsavel.has(String(identidade.idUsuario))) {
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
      if (comanda.idGarcomResponsavel) agora.idGarcomResponsavel = comanda.idGarcomResponsavel;
      else agora.idGarcomResponsavel = identidade.idUsuario;
      agora.idGarcom = agora.idGarcomResponsavel;
      agora.idUsuarioGarcomResponsavel = comanda.idUsuarioGarcomResponsavel || identidade.idUsuario;
    }
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
    const atualizacaoComanda = {
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(comanda.versao || 1) + 1,
    };
    if (para === 'enviado_cozinha') {
      distribuicaoCozinha = distribuirTarefasCozinha({
        transacao,
        restaurante,
        idRestaurante: identidade.idRestaurante,
        fichaRef,
        pedido: { ...pedido, id: pedidoRef.id },
        funcionariosDocumentos: funcionariosCozinhaDocumentos,
        escalasDocumentos: escalasCozinhaDocumentos,
        idAtor: identidade.idUsuario,
      });
    }
    if (para === 'confirmado_garcom') {
      atualizacaoComanda.statusComanda = 'em_consumo';
      atualizacaoComanda.status = 'em_consumo';
      atualizacaoComanda.idGarcomResponsavel = comanda.idGarcomResponsavel || identidade.idUsuario;
      atualizacaoComanda.idUsuarioGarcomResponsavel = comanda.idUsuarioGarcomResponsavel || identidade.idUsuario;
      atualizacaoComanda.statusDistribuicaoGarcom = 'atribuido';
    }
    if (['rejeitado_garcom', 'cancelado'].includes(para)) {
      if (pedido.estoqueBaixado === true && pedido.estoqueRestaurado !== true) {
        await devolverEstoqueDoPedido({
          transacao,
          restauranteRef: restaurante,
          idPedido: pedidoRef.id,
          idRestaurante: identidade.idRestaurante,
          idAtor: identidade.idUsuario,
          itens: itensParaDevolucao,
          documentosProdutos: documentosProdutosDevolucao,
          motivo: `Devolução automática do pedido ${para === 'rejeitado_garcom' ? 'rejeitado pelo garçom' : 'cancelado'}.`,
        });
        agora.estoqueRestaurado = true;
      }
      const totalPedido = Number(pedido.totalCentavos || pedido.valorCentavos || 0);
      atualizacaoComanda.quantidadePedidosAbertos = Math.max(0, Number(comanda.quantidadePedidosAbertos || 0) - 1);
      atualizacaoComanda.totalCentavos = Math.max(0, Number(comanda.totalCentavos || 0) - totalPedido);
      atualizacaoComanda.valorCentavos = atualizacaoComanda.totalCentavos;
      if (funcionarioGarcomCancelamentoDocumento?.exists) {
        const funcionario = funcionarioGarcomCancelamentoDocumento.data() || {};
        const carga = funcionario.cargaAtual || {};
        const pedidosRestantes = Math.max(0, Number(carga.pedidosPendentes || 0) - 1);
        transacao.update(funcionarioGarcomCancelamentoDocumento.ref, { cargaAtual: { mesasAtivas: Math.max(0, Number(carga.mesasAtivas || 0)), comandasAtivas: Math.max(0, Number(carga.comandasAtivas || 0)), pedidosPendentes: pedidosRestantes, tarefasAtivas: Math.max(0, Number(carga.tarefasAtivas || 0)) }, disponibilidadeAtendimento: pedidosRestantes > 0 || Number(carga.comandasAtivas || 0) > 0 ? 'em_atendimento' : 'disponivel', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(funcionario.versao || 1) + 1 });
      }
    }
    if (['rejeitado_garcom', 'cancelado'].includes(para) && fichaDocumento?.exists) {
      const ficha = fichaDocumento.data() || {};
      const tarefasAtivas = tarefasFichaCancelamento.filter(documento => ['aguardando_preparo', 'em_preparo'].includes(documento.data()?.statusTarefa));
      const tarefasEmbutidas = Array.isArray(ficha.tarefas) ? ficha.tarefas : [];
      const tarefasAtualizadas = tarefasEmbutidas.map(item => tarefasAtivas.some(documento => documento.id === item.id) ? { ...item, statusTarefa: 'cancelada', motivo: motivo || 'Pedido cancelado.', atualizadoEm: null } : item);
      for (const tarefaDocumento of tarefasAtivas) {
        const tarefa = tarefaDocumento.data() || {};
        transacao.update(tarefaDocumento.ref, { statusTarefa: 'cancelada', motivo: motivo || 'Pedido cancelado.', canceladaEm: FieldValue.serverTimestamp(), atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(tarefa.versao || 1) + 1 });
        transacao.set(tarefaDocumento.ref.collection('historicoStatus').doc(), { idRestaurante: identidade.idRestaurante, idFicha: fichaRef.id, idTarefa: tarefaDocumento.id, statusAnterior: tarefa.statusTarefa || 'aguardando_preparo', statusNovo: 'cancelada', idAtor: identidade.idUsuario, motivo: motivo || 'Pedido cancelado.', criadoEm: FieldValue.serverTimestamp() });
      }
      for (const funcionarioDocumento of funcionariosCancelamentoDocumentos.filter(documento => documento.exists)) {
        const funcionario = funcionarioDocumento.data() || {};
        const idFuncionario = funcionarioDocumento.id;
        const tarefasDoFuncionario = tarefasAtivas.filter(documento => String(documento.data()?.idCozinheiroResponsavel || '') === idFuncionario).length;
        if (!tarefasDoFuncionario) continue;
        const carga = funcionario.cargaAtual || {};
        const tarefasRestantes = Math.max(0, Number(carga.tarefasAtivas || 0) - tarefasDoFuncionario);
        const novaCarga = { mesasAtivas: Math.max(0, Number(carga.mesasAtivas || 0)), comandasAtivas: Math.max(0, Number(carga.comandasAtivas || 0) - 1), pedidosPendentes: Math.max(0, Number(carga.pedidosPendentes || 0) - tarefasDoFuncionario), tarefasAtivas: tarefasRestantes };
        transacao.update(funcionarioDocumento.ref, { cargaAtual: novaCarga, disponibilidadeAtendimento: tarefasRestantes > 0 ? 'em_atendimento' : 'disponivel', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(funcionario.versao || 1) + 1 });
      }
      transacao.update(fichaRef, { statusFicha: 'cancelada', statusDistribuicaoCozinha: 'cancelada', tarefas: tarefasAtualizadas, tarefasTotal: tarefasAtualizadas.length || tarefasFichaCancelamento.length, tarefasAguardandoAtribuicao: 0, canceladaEm: FieldValue.serverTimestamp(), motivoCancelamento: motivo || 'Pedido cancelado.', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(ficha.versao || 1) + 1 });
    }
    transacao.update(pedidoRef, agora);

    transacao.set(pedidoRef.collection('historicoStatus').doc(), evento);
    transacao.set(pedidoRef.collection('eventos').doc(), evento);
    if (comandaRef) {
      transacao.update(comandaRef, atualizacaoComanda);
      transacao.set(comandaRef.collection('historicoStatus').doc(), { statusAnterior: comanda.statusComanda || comanda.status || 'aberta', statusNovo: para, idPedido: pedidoRef.id, idAtor: identidade.idUsuario, papelAtor, motivo: motivo || '', criadoEm: FieldValue.serverTimestamp(), versao: Number(comanda.versao || 1) + 1 });
    }

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
        statusDistribuicaoCozinha: distribuicaoCozinha?.statusDistribuicaoCozinha || 'aguardando_atribuicao',
        tarefas: distribuicaoCozinha?.tarefas || [],
        tarefasTotal: distribuicaoCozinha?.tarefasTotal || 0,
        tarefasAtribuidas: distribuicaoCozinha?.tarefasAtribuidas || 0,
        tarefasAguardandoAtribuicao: distribuicaoCozinha?.tarefasAguardandoAtribuicao || 0,
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
      versao: Number(mesaDocumento?.data()?.versao || 1) + 1,
    });

    resultado = { recurso: 'pedido', id, de, para, statusPedido: para, status: para, atualizado: true };
    const tipoNotificacao = para === 'enviado_cozinha'
      ? TIPOS_NOTIFICACAO.pedidoEnviadoCozinha
      : para === 'pronto'
        ? TIPOS_NOTIFICACAO.pedidoPronto
        : para === 'rejeitado_garcom'
          ? TIPOS_NOTIFICACAO.pedidoRejeitado
          : para === 'cancelado'
            ? TIPOS_NOTIFICACAO.pedidoCancelado
            : null;
    if (tipoNotificacao) {
      const nomeMesa = String(pedido.nomeMesa || pedido.idMesa || mesaRef.id);
      const nomeCliente = String(pedido.nomeCliente || 'Cliente');
      const descricoes = {
        [TIPOS_NOTIFICACAO.pedidoEnviadoCozinha]: `O pedido de ${nomeCliente} foi confirmado e aguarda preparo.`,
        [TIPOS_NOTIFICACAO.pedidoPronto]: `O pedido da mesa ${nomeMesa} está pronto para servir.`,
        [TIPOS_NOTIFICACAO.pedidoRejeitado]: `O pedido da mesa ${nomeMesa} foi rejeitado${motivo ? `: ${motivo}` : '.'}`,
        [TIPOS_NOTIFICACAO.pedidoCancelado]: `O pedido da mesa ${nomeMesa} foi cancelado${motivo ? `: ${motivo}` : '.'}`,
      };
      eventoFcm = {
        tipoNotificacao,
        titulo: tipoNotificacao === TIPOS_NOTIFICACAO.pedidoPronto ? `Pedido pronto — mesa ${nomeMesa}` : `Atualização do pedido — mesa ${nomeMesa}`,
        mensagem: descricoes[tipoNotificacao],
        prioridade: tipoNotificacao === TIPOS_NOTIFICACAO.pedidoPronto ? 'alta' : 'normal',
        eventoOrigem: `pedido:${pedidoRef.id}:status:${para}:versao:${Number(pedido.versao || 1)}`,
        idMesa: pedido.idMesa || null,
        idComanda: pedido.idComanda || null,
        idPedido: pedidoRef.id,
        idGarcomResponsavel: agora.idGarcomResponsavel || pedido.idGarcomResponsavel || comanda.idGarcomResponsavel || null,
      };
      criarNotificacoesNaTransacao(transacao, restaurante, eventoFcm);
    }
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
  if (!repeticaoIdempotente) {
    await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `pedidos.status.${para}`, tipoRecurso: 'pedido', idRecurso: id });
    if (eventoFcm) await enviarNotificacaoFcm({ idRestaurante: identidade.idRestaurante, evento: eventoFcm });
  }
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
    if (para === 'cancelado' && pedido.estoqueBaixado === true && pedido.estoqueRestaurado !== true) {
      await devolverEstoqueDoPedido({
        transacao,
        restauranteRef: caminhoRestaurante(identidade.idRestaurante),
        idPedido: pedidoRef.id,
        idRestaurante: identidade.idRestaurante,
        idAtor: identidade.idUsuario,
        itens: Array.isArray(pedido.itens) ? pedido.itens : Array.isArray(pedido.itensResumo) ? pedido.itensResumo : [],
        motivo: 'Devolução automática do pedido administrativo cancelado.',
      });
      agora.estoqueRestaurado = true;
    }
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
      if (corpo.recurso === 'tarefaCozinha' || corpo.recurso === 'tarefa-cozinha') return atualizarTarefaCozinha(identidade, corpo, idRequisicao);
      return criarPedido(identidade, corpo, idRequisicao);
    }
    if (corpo.recurso === 'encaminhamentoCaixa' || corpo.recurso === 'encaminharComandaCaixa') return encaminharComandaCaixa(identidade, corpo, idRequisicao);
    if (corpo.recurso === 'tarefaCozinha' || corpo.recurso === 'tarefa-cozinha') return atualizarTarefaCozinha(identidade, corpo, idRequisicao);
    if (corpo.recurso !== 'pedido' && corpo.recurso !== 'status') throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de pedidos inválido.');
    return atualizarStatusPedido(identidade, corpo, idRequisicao);
  });
};

module.exports.atribuirGarcomResponsavel = atribuirGarcomResponsavel;
module.exports.selecionarGarcomResponsavel = selecionarGarcomResponsavel;
module.exports.pontuacaoGarcom = pontuacaoGarcom;
