'use strict';

const crypto = require('node:crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA_FINANCEIRO,
  PAPEIS_MUTACAO_FINANCEIRO,
  PAPEIS_FECHAMENTO,
  ESTADOS_FECHAMENTO,
  idDocumento,
  dataFinanceira,
  dataHoje,
  idempotencia,
  dtoMovimentacao,
  dtoConta,
  dtoFechamento,
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
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
} = require('./financeiro');

const RECURSOS_LEITURA = new Set(['resumos', 'relatorios', 'contas', 'movimentacoes', 'fechamentos']);
const RECURSOS_MUTACAO = new Set(['conta', 'movimentacao', 'fechamento']);

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
  const limite = limitarInteiro(req.query?.limite, 100, 200);
  const periodo = queryString(req, 'periodo');
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const [fechamentos, movimentacoes, pagar, receber, relatorios, resumos] = await Promise.all([
    listarColecao(identidade.idRestaurante, 'fechamentosCaixa', limite),
    listarColecao(identidade.idRestaurante, 'movimentacoesCaixa', limite),
    listarColecao(identidade.idRestaurante, 'contasPagar', limite),
    listarColecao(identidade.idRestaurante, 'contasReceber', limite),
    listarColecao(identidade.idRestaurante, 'relatoriosFinanceiros', limite),
    listarColecao(identidade.idRestaurante, 'resumosFinanceiros', 10),
  ]);
  const fechamentoDtos = documentosVisiveis(fechamentos).map(dtoFechamento);
  const movimentacaoDtos = documentosVisiveis(movimentacoes).map(dtoMovimentacao);
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
    meta: { idRestaurante: identidade.idRestaurante, limite, periodo: periodo || null },
  };
  if (!recurso) return { corpo };
  if (recurso === 'fechamentos') return { corpo: { fechamentos: fechamentoDtos, meta: corpo.meta } };
  if (recurso === 'movimentacoes') return { corpo: { movimentacoes: movimentacaoDtos, meta: corpo.meta } };
  if (recurso === 'contas') return { corpo: { contas: corpo.contas, meta: corpo.meta } };
  if (recurso === 'relatorios') return { corpo: { relatorios: relatorioDtos, meta: corpo.meta } };
  if (recurso === 'resumos') return { corpo: { resumoFinanceiro: resumo, meta: corpo.meta } };
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
    const recurso = normalizarRecurso(corpo?.recurso || queryString(req, 'recurso'));
    let papeis = PAPEIS_LEITURA_FINANCEIRO;
    if (recurso === 'fechamento' || recurso === 'fechamentos') papeis = PAPEIS_FECHAMENTO;
    else if (mutacao) papeis = PAPEIS_MUTACAO_FINANCEIRO;
    const identidade = await obterIdentidadeOperacional(req, papeis);
    if (metodo === 'GET') return listarFinanceiro(identidade, req);
    if (!RECURSOS_MUTACAO.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Mutação financeira inválida ou não disponível.');
    if (metodo === 'POST') {
      if (recurso === 'conta') return criarConta(identidade, req, corpo, idRequisicao);
      if (recurso === 'movimentacao') return criarMovimentacao(identidade, req, corpo, idRequisicao);
      return fecharCaixa(identidade, corpo, idRequisicao);
    }
    if (recurso === 'conta') return atualizarConta(identidade, corpo, idRequisicao);
    if (recurso === 'movimentacao') return atualizarMovimentacao(identidade, corpo, idRequisicao);
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Fechamentos usam POST e não podem ser editados após aprovação.');
  });
};
