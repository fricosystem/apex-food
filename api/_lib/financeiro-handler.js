'use strict';

const crypto = require('node:crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA_FINANCEIRO,
  PAPEIS_MUTACAO_FINANCEIRO,
  PAPEIS_FECHAMENTO,
  PAPEIS_LEITURA_CAIXA,
  PAPEIS_MUTACAO_CAIXA,
  ESTADOS_ENCAMINHAMENTO_CAIXA,
  ESTADOS_FECHAMENTO,
  idDocumento,
  dataFinanceira,
  dataHoje,
  idempotencia,
  dtoMovimentacao,
  dtoConta,
  dtoFechamento,
  dtoEncaminhamentoCaixa,
  dtoRelatorio,
  dtoResumoFinanceiro,
  validarConta,
  validarMovimentacao,
  validarEstadoConta,
  validarEstadoMovimentacao,
  validarFechamento,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoOpcional,
  enumObrigatorio,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
} = require('./financeiro');
const { criarNotificacoesNaTransacao, TIPOS_NOTIFICACAO } = require('./notificacoes');
const { lerDetalhesComanda } = require('./detalhes-comanda');
const { enviarNotificacaoFcm } = require('./fcm-notificacoes');

const RECURSOS_LEITURA = new Set(['resumos', 'relatorios', 'contas', 'movimentacoes', 'fechamentos', 'encaminhamentos', 'encaminhamentosCaixa', 'detalhesComanda']);
const RECURSOS_MUTACAO = new Set(['conta', 'movimentacao', 'fechamento', 'encaminhamentoCaixa']);

function normalizarRecurso(valor) {
  const mapa = {
    resumo: 'resumos',
    resumosFinanceiros: 'resumos',
    relatoriosFinanceiros: 'relatorios',
    relatorio: 'relatorios',
    fluxo: 'movimentacoes',
    movimentacao: 'movimentacoes',
    contas: 'contas',
    contaPagar: 'contas',
    contaReceber: 'contas',
    fechamentoCaixa: 'fechamentos',
    fechamento: 'fechamento',
    encaminhamento: 'encaminhamentos',
    encaminhamentosCaixa: 'encaminhamentos',
    encaminhamentoCaixa: 'encaminhamentoCaixa',
    detalhesComanda: 'detalhesComanda',
    'detalhes-comanda': 'detalhesComanda',
    caixa: 'encaminhamentos',
  };
  return mapa[valor] || valor;
}

function idempotenciaDaRequisicao(req, corpo) {
  const header = req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'];
  return idempotencia(corpo?.chaveIdempotencia || header);
}

function resultadoArmazenavel(resposta) {
  return {
    status: Number(resposta.status || 200),
    corpo: resposta.corpo || {},
  };
}

async function executarIdempotente(identidade, chave, operacao) {
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const idChave = crypto.createHash('sha256').update(`${identidade.idUsuario}:${chave}`).digest('hex');
  const referenciaChave = restaurante.collection('chavesIdempotencia').doc(idChave);
  let reutilizado = false;
  const resposta = await referenciaChave.firestore.runTransaction(async (transacao) => {
    const anterior = await transacao.get(referenciaChave);
    if (anterior.exists) {
      reutilizado = true;
      return anterior.data()?.resultado || { status: 200, corpo: { repetido: true } };
    }
    const resultado = resultadoArmazenavel(await operacao(transacao, restaurante));
    transacao.create(referenciaChave, {
      idRestaurante: identidade.idRestaurante,
      rota: 'financeiro',
      idAtor: identidade.idUsuario,
      chaveResumo: idChave.slice(0, 16),
      resultado,
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      criadoEm: FieldValue.serverTimestamp(),
    });
    return resultado;
  });
  return { ...resposta, reutilizado };
}

function documentosVisiveis(documentos) {
  return documentos.filter((documento) => {
    const dados = documento.data() || {};
    return dados.estado !== 'excluida' && dados.estado !== 'excluido' && !dados.excluidoEm;
  });
}

async function listarFinanceiro(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (recurso && !RECURSOS_LEITURA.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso financeiro inválido.');
  if (recurso === 'detalhesComanda') {
    const detalhes = await lerDetalhesComanda({ restaurante: caminhoRestaurante(identidade.idRestaurante), idComanda: queryString(req, 'idComanda') });
    return { corpo: { recurso: 'detalhesComanda', ...detalhes, meta: { idRestaurante: identidade.idRestaurante } } };
  }
  const limite = limitarInteiro(req.query?.limite, 100, 200);
  const periodo = queryString(req, 'periodo');
  const statusEncaminhamento = queryString(req, 'status');
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const [fechamentos, movimentacoes, pagar, receber, relatorios, resumos, encaminhamentos] = await Promise.all([
    listarColecao(identidade.idRestaurante, 'fechamentosCaixa', limite),
    listarColecao(identidade.idRestaurante, 'movimentacoesCaixa', limite),
    listarColecao(identidade.idRestaurante, 'contasPagar', limite),
    listarColecao(identidade.idRestaurante, 'contasReceber', limite),
    listarColecao(identidade.idRestaurante, 'relatoriosFinanceiros', limite),
    listarColecao(identidade.idRestaurante, 'resumosFinanceiros', 10),
    listarColecao(identidade.idRestaurante, 'encaminhamentosCaixa', limite),
  ]);
  const fechamentoDtos = documentosVisiveis(fechamentos).map(dtoFechamento);
  const movimentacaoDtos = documentosVisiveis(movimentacoes).map(dtoMovimentacao);
  const encaminhamentoDtos = documentosVisiveis(encaminhamentos)
    .map(dtoEncaminhamentoCaixa)
    .filter(item => !statusEncaminhamento || statusEncaminhamento === 'todos' || item.statusEncaminhamento === statusEncaminhamento);
  const contasPagar = documentosVisiveis(pagar).map((documento) => dtoConta(documento, 'pagar'));
  const contasReceber = documentosVisiveis(receber).map((documento) => dtoConta(documento, 'receber'));
  let relatorioDtos = documentosVisiveis(relatorios).map(dtoRelatorio);
  if (periodo) relatorioDtos = relatorioDtos.filter((item) => item.mes === periodo || item.id === periodo);
  const resumo = resumos.length ? dtoResumoFinanceiro(resumos[0].data() || {}) : dtoResumoFinanceiro({});
  const corpo = {
    caixaAtual: fechamentoDtos[0] || resumo.caixaAtual || null,
    recebimentos: resumo.recebimentos || [],
    fluxo: movimentacaoDtos,
    contas: [...contasPagar, ...contasReceber],
    relatoriosMensais: relatorioDtos,
    categorias: relatorioDtos.flatMap((item) => item.categorias || []).slice(0, 100),
    resumoFinanceiro: resumo,
    encaminhamentos: encaminhamentoDtos,
    encaminhamentosCaixa: encaminhamentoDtos,
    meta: { idRestaurante: identidade.idRestaurante, limite, periodo: periodo || null, statusEncaminhamento: statusEncaminhamento || null },
  };
  if (!recurso) return { corpo };
  if (recurso === 'fechamentos') return { corpo: { fechamentos: fechamentoDtos, meta: corpo.meta } };
  if (recurso === 'movimentacoes') return { corpo: { movimentacoes: movimentacaoDtos, meta: corpo.meta } };
  if (recurso === 'contas') return { corpo: { contas: corpo.contas, meta: corpo.meta } };
  if (recurso === 'relatorios') return { corpo: { relatorios: relatorioDtos, meta: corpo.meta } };
  if (recurso === 'resumos') return { corpo: { resumoFinanceiro: resumo, meta: corpo.meta } };
  if (recurso === 'encaminhamentos' || recurso === 'encaminhamentosCaixa') return { corpo: { encaminhamentos: encaminhamentoDtos, encaminhamentosCaixa: encaminhamentoDtos, meta: corpo.meta } };
  return { corpo };
}

async function criarConta(identidade, req, corpo, idRequisicao) {
  const dados = validarConta(corpo);
  const chave = idempotenciaDaRequisicao(req, corpo);
  const resultado = await executarIdempotente(identidade, chave, async (transacao, restaurante) => {
    const referencia = restaurante.collection(dados.tipo === 'pagar' ? 'contasPagar' : 'contasReceber').doc();
    transacao.create(referencia, {
      ...dados,
      idRestaurante: identidade.idRestaurante,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: 1,
      vencimentoEm: Timestamp.fromDate(new Date(`${dados.vencimento}T00:00:00.000Z`)),
    });
    return { status: 201, corpo: { recurso: 'conta', tipo: dados.tipo, id: referencia.id, criado: true } };
  });
  if (!resultado.reutilizado) await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'financeiro.conta.criada', tipoRecurso: dados.tipo === 'pagar' ? 'contaPagar' : 'contaReceber', idRecurso: resultado.corpo.id });
  return { status: resultado.status, corpo: { ...resultado.corpo, repetido: resultado.reutilizado } };
}

async function criarMovimentacao(identidade, req, corpo, idRequisicao) {
  const dados = validarMovimentacao(corpo);
  const chave = idempotenciaDaRequisicao(req, corpo);
  const resultado = await executarIdempotente(identidade, chave, async (transacao, restaurante) => {
    const referencia = restaurante.collection('movimentacoesCaixa').doc();
    transacao.create(referencia, {
      ...dados,
      idRestaurante: identidade.idRestaurante,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: 1,
    });
    return { status: 201, corpo: { recurso: 'movimentacao', id: referencia.id, criado: true } };
  });
  if (!resultado.reutilizado) await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'financeiro.movimentacao.criada', tipoRecurso: 'movimentacao', idRecurso: resultado.corpo.id });
  return { status: resultado.status, corpo: { ...resultado.corpo, repetido: resultado.reutilizado } };
}

function transicaoContaPermitida(tipo, anterior, proximo) {
  if (anterior === 'excluida' || anterior === 'cancelada' || anterior === 'pago' || anterior === 'recebido') return false;
  if (proximo === 'excluida') return true;
  if (tipo === 'pagar') return ['pendente', 'vencida'].includes(anterior) && ['pago', 'cancelada', 'vencida', 'pendente'].includes(proximo);
  return anterior === 'prevista' && ['recebido', 'cancelada', 'prevista'].includes(proximo);
}

async function atualizarConta(identidade, corpo, idRequisicao) {
  const tipo = corpo.tipo === 'receber' ? 'receber' : corpo.tipo === 'pagar' ? 'pagar' : null;
  if (!tipo) throw new ApiError(400, 'TIPO_INVALIDO', 'tipo de conta inválido.');
  const id = idDocumento(corpo.id, 'id');
  const estado = validarEstadoConta(tipo, corpo.estado);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection(tipo === 'pagar' ? 'contasPagar' : 'contasReceber').doc(id);
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluida') throw new ApiError(404, 'CONTA_NAO_ENCONTRADA', 'Conta não encontrada.');
    const anterior = documento.data()?.estado || (tipo === 'pagar' ? 'pendente' : 'prevista');
    if (!transicaoContaPermitida(tipo, anterior, estado)) throw new ApiError(409, 'TRANSICAO_INVALIDA', 'A transição desta conta não é permitida.');
    transacao.update(referencia, { estado, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(documento.data()?.versao || 1) + 1, ...(estado === 'pago' || estado === 'recebido' ? { liquidadoEm: FieldValue.serverTimestamp(), liquidadoPor: identidade.idUsuario } : {}) });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'financeiro.conta.estadoAlterado', tipoRecurso: tipo === 'pagar' ? 'contaPagar' : 'contaReceber', idRecurso: id });
  return { corpo: { recurso: 'conta', tipo, id, atualizado: true } };
}

async function atualizarMovimentacao(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const estado = validarEstadoMovimentacao(corpo.estado);
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('movimentacoesCaixa').doc(id);
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluida') throw new ApiError(404, 'MOVIMENTACAO_NAO_ENCONTRADA', 'Movimentação não encontrada.');
    const anterior = documento.data()?.estado || 'pendente';
    if (['cancelada', 'excluida'].includes(anterior) || (anterior === 'conciliado' && estado !== 'conciliado')) throw new ApiError(409, 'TRANSICAO_INVALIDA', 'A movimentação não pode ser revertida.');
    transacao.update(referencia, { estado, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(documento.data()?.versao || 1) + 1 });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'financeiro.movimentacao.estadoAlterado', tipoRecurso: 'movimentacao', idRecurso: id });
  return { corpo: { recurso: 'movimentacao', id, atualizado: true } };
}

function exigirPapelCaixa(identidade, papeis) {
  if (!Array.isArray(identidade.papeis) || !identidade.papeis.some(papel => papeis.includes(papel))) {
    throw new ApiError(403, 'PAPEL_NAO_AUTORIZADO', 'Seu perfil não possui permissão para operar a fila do caixa.');
  }
}

function statusEncaminhamentoAtual(documento) {
  return documento.data()?.statusEncaminhamento || 'encaminhada';
}

async function atualizarEncaminhamentoCaixa(identidade, req, corpo, idRequisicao) {
  const id = idDocumento(corpo.id || corpo.idEncaminhamento || corpo.idComanda, 'idEncaminhamento');
  const para = enumObrigatorio(corpo.status, new Set(['recebida', 'concluida', 'cancelada']), 'status');
  const motivo = textoOpcional(corpo.observacaoOperacional || corpo.motivo, 'observacaoOperacional', 500);
  const chave = idempotenciaDaRequisicao(req, corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const encaminhamentoRef = restaurante.collection('encaminhamentosCaixa').doc(id);
  const idOperacao = crypto.createHash('sha256').update(`${identidade.idRestaurante}:${identidade.idUsuario}:encaminhamento-caixa:${id}:${chave}`).digest('hex');
  const idempotenciaRef = restaurante.collection('chavesIdempotencia').doc(idOperacao);
  const hashPayload = crypto.createHash('sha256').update(JSON.stringify({ id, para, motivo })).digest('hex').slice(0, 40);
  let resultado;
  let eventoFcm = null;
  let reutilizado = false;

  await encaminhamentoRef.firestore.runTransaction(async transacao => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave do caixa já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      reutilizado = true;
      return;
    }
    const encaminhamentoDocumento = await transacao.get(encaminhamentoRef);
    if (!encaminhamentoDocumento.exists) throw new ApiError(404, 'ENCAMINHAMENTO_NAO_ENCONTRADO', 'Encaminhamento de caixa não encontrado.');
    const encaminhamento = encaminhamentoDocumento.data() || {};
    const de = statusEncaminhamentoAtual(encaminhamentoDocumento);
    const permitido = de === 'encaminhada' && ['recebida', 'cancelada'].includes(para) || de === 'recebida' && para === 'concluida';
    if (!permitido) throw new ApiError(409, 'TRANSICAO_CAIXA_INVALIDA', `Não é permitido alterar o encaminhamento de ${de} para ${para}.`);
    if (para === 'concluida') exigirPapelCaixa(identidade, PAPEIS_MUTACAO_CAIXA);
    else exigirPapelCaixa(identidade, PAPEIS_MUTACAO_CAIXA);

    const comandaRef = restaurante.collection('comandas').doc(String(encaminhamento.idComanda || ''));
    const mesaRef = restaurante.collection('mesas').doc(String(encaminhamento.idMesa || ''));
    const pedidosConsulta = restaurante.collection('pedidos').where('idComanda', '==', encaminhamento.idComanda).limit(300);
    const sessoesConsulta = restaurante.collection('sessoesMesa').where('idComanda', '==', encaminhamento.idComanda).limit(300);
    const [comandaDocumento, mesaDocumento, pedidosDocumentos, sessoesDocumentos] = await Promise.all([
      transacao.get(comandaRef),
      transacao.get(mesaRef),
      transacao.get(pedidosConsulta),
      transacao.get(sessoesConsulta),
    ]);
    if (!comandaDocumento.exists) throw new ApiError(409, 'COMANDA_NAO_ENCONTRADA', 'A comanda relacionada ao caixa não foi encontrada.');
    if (!mesaDocumento.exists) throw new ApiError(409, 'MESA_NAO_ENCONTRADA', 'A mesa relacionada ao caixa não foi encontrada.');
    const comanda = comandaDocumento.data() || {};
    if (para === 'concluida') {
      const estadosPendentes = new Set(['rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'novo', 'preparo']);
      const pedidos = pedidosDocumentos.docs.filter(documento => documento.data()?.estado !== 'excluido');
      if (pedidos.some(documento => estadosPendentes.has(documento.data()?.statusPedido || documento.data()?.status))) {
        throw new ApiError(409, 'COMANDA_COM_PEDIDOS_PENDENTES', 'A comanda ainda possui pedidos pendentes.');
      }
      if (!['encaminhada_caixa', 'em_consumo'].includes(comanda.statusComanda || comanda.status)) throw new ApiError(409, 'COMANDA_NAO_ENCAMINHADA', 'A comanda não está disponível para conclusão no caixa.');
      for (const pedidoDocumento of pedidosDocumentos.docs.filter(documento => documento.data()?.estado !== 'excluido')) {
        const pedidoAtual = pedidoDocumento.data() || {};
        transacao.update(pedidoDocumento.ref, {
          estadoComanda: 'encerrada',
          encerradaCaixaEm: FieldValue.serverTimestamp(),
          atualizadoPor: identidade.idUsuario,
          atualizadoEm: FieldValue.serverTimestamp(),
          versao: Number(pedidoAtual.versao || 1) + 1,
        });
      }
      transacao.update(comandaRef, {
        statusComanda: 'encerrada',
        status: 'encerrada',
        encerradaEm: FieldValue.serverTimestamp(),
        encerradaPor: identidade.idUsuario,
        atualizadaEm: FieldValue.serverTimestamp(),
        atualizadoPor: identidade.idUsuario,
        versao: Number(comanda.versao || 1) + 1,
      });
      transacao.update(mesaRef, {
        estado: 'disponivel',
        estadoAtendimento: null,
        idComandaAberta: null,
        idGarcomResponsavel: null,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: identidade.idUsuario,
        versao: Number(mesaDocumento.data()?.versao || 1) + 1,
      });
      for (const sessaoDocumento of sessoesDocumentos.docs) {
        const sessao = sessaoDocumento.data() || {};
        transacao.update(sessaoDocumento.ref, { estadoSessao: 'encerrada', encerradaEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(), versao: Number(sessao.versao || 1) + 1 });
        if (sessao.idParticipante) {
          const participanteRef = comandaRef.collection('participantes').doc(String(sessao.idParticipante));
          transacao.set(participanteRef, { estadoParticipante: 'encerrado', saiuEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
        }
      }
      transacao.set(restaurante.collection('eventosMesas').doc(), {
        idRestaurante: identidade.idRestaurante,
        idMesa: mesaRef.id,
        idComanda: comandaRef.id,
        acao: 'disponivel',
        estadoAnterior: 'encaminhada_caixa',
        estadoNovo: 'disponivel',
        idAtor: identidade.idUsuario,
        idOperacao,
        criadoEm: FieldValue.serverTimestamp(),
      });
      transacao.set(comandaRef.collection('historicoStatus').doc(), { statusAnterior: comanda.statusComanda || comanda.status, statusNovo: 'encerrada', idAtor: identidade.idUsuario, motivo: motivo || 'Conferência operacional concluída pelo caixa.', criadoEm: FieldValue.serverTimestamp() });
    }
    transacao.update(encaminhamentoRef, {
      statusEncaminhamento: para,
      ...(para === 'recebida' ? { recebidaEm: FieldValue.serverTimestamp() } : {}),
      ...(para === 'concluida' ? { concluidaEm: FieldValue.serverTimestamp(), idOperadorCaixa: identidade.idUsuario } : {}),
      ...(motivo ? { observacaoOperacional: motivo } : {}),
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(encaminhamento.versao || 1) + 1,
    });
    if (para === 'recebida' || para === 'concluida') {
      const tipoNotificacao = para === 'recebida' ? TIPOS_NOTIFICACAO.comandaRecebidaCaixa : TIPOS_NOTIFICACAO.atendimentoEncerrado;
      const nomeMesa = String(encaminhamento.resumoOperacional?.nomeMesa || encaminhamento.idMesa || mesaRef.id);
      eventoFcm = {
        tipoNotificacao,
        titulo: para === 'recebida' ? `Comanda recebida — mesa ${nomeMesa}` : `Mesa liberada — mesa ${nomeMesa}`,
        mensagem: para === 'recebida'
          ? 'O caixa recebeu a comanda para conferência operacional.'
          : 'A conferência operacional foi concluída e a mesa está disponível novamente.',
        prioridade: para === 'recebida' ? 'normal' : 'alta',
        eventoOrigem: `encaminhamento:${id}:${para}:versao:${Number(encaminhamento.versao || 1)}`,
        idMesa: encaminhamento.idMesa || mesaRef.id,
        idComanda: encaminhamento.idComanda || comandaRef.id,
        idEncaminhamento: id,
        idGarcomResponsavel: encaminhamento.idGarcomResponsavel || encaminhamento.resumoOperacional?.idGarcomResponsavel || null,
      };
      criarNotificacoesNaTransacao(transacao, restaurante, eventoFcm);
    }
    resultado = { recurso: 'encaminhamentoCaixa', id, idComanda: encaminhamento.idComanda, idMesa: encaminhamento.idMesa, de, para, statusEncaminhamento: para, atualizado: true };
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/financeiro',
      tipoOperacao: `encaminhamento_caixa_${para}`,
      resultado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  if (!reutilizado) {
    await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `caixa.encaminhamento.${para}`, tipoRecurso: 'encaminhamentoCaixa', idRecurso: id });
    if (eventoFcm) await enviarNotificacaoFcm({ idRestaurante: identidade.idRestaurante, evento: eventoFcm });
  }
  return { corpo: { ...resultado, repetido: reutilizado } };
}

async function fecharCaixa(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const dados = validarFechamento(corpo);
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('fechamentosCaixa').doc(id);
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists) throw new ApiError(404, 'FECHAMENTO_NAO_ENCONTRADO', 'Fechamento de caixa não encontrado.');
    const atual = documento.data() || {};
    const estado = atual.estado || 'aberto';
    if (!ESTADOS_FECHAMENTO.has(estado) || ['fechado', 'excluido'].includes(estado)) throw new ApiError(409, 'FECHAMENTO_IMUTAVEL', 'Este fechamento não pode ser alterado.');
    const saldoEsperadoCentavos = Number(atual.saldoEsperadoCentavos ?? (Number(atual.aberturaCentavos || 0) + Number(atual.vendasCentavos || 0) - Number(atual.suprimentosCentavos || 0) - Number(atual.sangriasCentavos || 0) - Number(atual.retiradasCentavos || 0)));
    transacao.update(referencia, {
      saldoConferidoCentavos: dados.saldoConferidoCentavos,
      saldoEsperadoCentavos,
      diferencaCentavos: dados.saldoConferidoCentavos - saldoEsperadoCentavos,
      estado: 'fechado',
      fechadoEm: FieldValue.serverTimestamp(),
      fechadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: identidade.idUsuario,
      versao: Number(atual.versao || 1) + 1,
      moeda: 'BRL',
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'financeiro.fechamento.fechado', tipoRecurso: 'fechamentoCaixa', idRecurso: id });
  return { corpo: { recurso: 'fechamento', id, fechado: true } };
}

module.exports = async function financeiro(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH'].includes(metodo);
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    const corpo = mutacao ? await lerCorpoJson(req) : null;
    const recursoBruto = corpo?.recurso || queryString(req, 'recurso');
    const recurso = mutacao && recursoBruto === 'movimentacao' ? 'movimentacao' : normalizarRecurso(recursoBruto);
    let papeis = PAPEIS_LEITURA_FINANCEIRO;
    if (recurso === 'fechamento' || recurso === 'fechamentos') papeis = PAPEIS_FECHAMENTO;
    else     if (recurso === 'encaminhamentos' || recurso === 'encaminhamentosCaixa' || recurso === 'detalhesComanda') papeis = PAPEIS_LEITURA_CAIXA;

    else if (recurso === 'encaminhamentoCaixa') papeis = PAPEIS_MUTACAO_CAIXA;
    else if (mutacao) papeis = PAPEIS_MUTACAO_FINANCEIRO;
    const identidade = await obterIdentidadeOperacional(req, papeis);
    if (metodo === 'GET') return listarFinanceiro(identidade, req);
    if (!RECURSOS_MUTACAO.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Mutação financeira inválida ou não disponível.');
    if (metodo === 'POST') {
      if (recurso === 'conta') return criarConta(identidade, req, corpo, idRequisicao);
      if (recurso === 'movimentacao') return criarMovimentacao(identidade, req, corpo, idRequisicao);
      if (recurso === 'fechamento') return fecharCaixa(identidade, corpo, idRequisicao);
      throw new ApiError(400, 'RECURSO_INVALIDO', 'Este recurso não aceita criação por POST.');
    }
    if (recurso === 'conta') return atualizarConta(identidade, corpo, idRequisicao);
    if (recurso === 'movimentacao') return atualizarMovimentacao(identidade, corpo, idRequisicao);
    if (recurso === 'encaminhamentoCaixa') return atualizarEncaminhamentoCaixa(identidade, req, corpo, idRequisicao);
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Fechamentos usam POST e não podem ser editados após aprovação.');
  });
};
