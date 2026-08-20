'use strict';

const { ApiError } = require('./http');
const {
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  enumObrigatorio,
  timestampParaIso,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const PAPEIS_LEITURA_FINANCEIRO = ['proprietario', 'administrador', 'financeiro', 'analista', 'auditor'];
const PAPEIS_MUTACAO_FINANCEIRO = ['proprietario', 'financeiro'];
const PAPEIS_FECHAMENTO = ['proprietario', 'financeiro'];
const PAPEIS_LEITURA_CAIXA = ['proprietario', 'administrador', 'gerente', 'financeiro', 'caixa'];
const PAPEIS_MUTACAO_CAIXA = ['proprietario', 'administrador', 'gerente', 'financeiro', 'caixa'];
const ESTADOS_ENCAMINHAMENTO_CAIXA = new Set(['encaminhada', 'recebida', 'concluida', 'cancelada']);
const TIPOS_MOVIMENTACAO = new Set(['entrada', 'saida']);
const ESTADOS_MOVIMENTACAO = new Set(['pendente', 'conciliado', 'cancelada', 'excluida']);
const ESTADOS_PAGAR = new Set(['pendente', 'vencida', 'pago', 'cancelada', 'excluida']);
const ESTADOS_RECEBER = new Set(['prevista', 'recebido', 'cancelada', 'excluida']);
const ESTADOS_FECHAMENTO = new Set(['aberto', 'em_conferencia', 'fechado', 'reaberto', 'excluido']);
const MOEDA = 'BRL';

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function dataFinanceira(valor, campo = 'data') {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  const texto = valor.trim();
  let iso = texto;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/');
    iso = `${ano}-${mes}-${dia}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  const data = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso) throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  return iso;
}

function dataHoje() {
  return new Date().toISOString().slice(0, 10);
}

function centavos(valor, campo = 'valor', { positivo = false, obrigatorio = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (!obrigatorio) return 0;
    throw new ApiError(400, 'VALOR_INVALIDO', `${campo} é obrigatório.`);
  }
  let texto = typeof valor === 'number' ? String(valor) : String(valor).trim();
  if (typeof valor === 'string') texto = texto.replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(texto)) throw new ApiError(400, 'VALOR_INVALIDO', `${campo} deve ter no máximo duas casas decimais.`);
  const numero = Number(texto);
  if (!Number.isFinite(numero) || Math.abs(numero) > 1000000000) throw new ApiError(400, 'VALOR_INVALIDO', `${campo} está fora do limite.`);
  const resultado = Math.round(numero * 100);
  if (!Number.isSafeInteger(resultado) || (positivo ? resultado < 1 : resultado < 0)) throw new ApiError(400, 'VALOR_INVALIDO', `${campo} deve ser ${positivo ? 'positivo' : 'não negativo'}.`);
  return resultado;
}

function reais(centavosValor) {
  const numero = Number(centavosValor || 0);
  return Number.isFinite(numero) ? Number((numero / 100).toFixed(2)) : 0;
}

function dataExibicao(valor) {
  const iso = timestampParaIso(valor) || dataFinanceira(valor, 'data');
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function idempotencia(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(valor.trim())) {
    throw new ApiError(400, 'IDEMPOTENCIA_INVALIDA', 'chaveIdempotencia é obrigatória e inválida.');
  }
  return valor.trim();
}

function dtoDocumentoFinanceiro(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    moeda: dados.moeda || MOEDA,
    estado: dados.estado || '',
    versao: Number(dados.versao || 1),
  };
}

function dtoMovimentacao(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    data: dataExibicao(dados.data || dados.dataEm),
    dataIso: dataFinanceira(dados.data, 'data') || (timestampParaIso(dados.dataEm) || '').slice(0, 10),
    tipo: dados.tipo || '',
    categoria: dados.categoria || '',
    descricao: dados.descricao || '',
    origem: dados.origem || '',
    forma: dados.forma || '',
    valor: reais(dados.valorCentavos),
    valorCentavos: Number(dados.valorCentavos || 0),
    status: dados.estado || dados.status || 'pendente',
    moeda: dados.moeda || MOEDA,
  };
}

function dtoConta(documento, tipo) {
  const dados = documento.data() || {};
  const vencimentoIso = dataFinanceira(dados.vencimento, 'vencimento') || (timestampParaIso(dados.vencimentoEm) || '').slice(0, 10);
  return {
    id: documento.id,
    tipo,
    descricao: dados.descricao || '',
    categoria: dados.categoria || '',
    vencimento: dataExibicao(vencimentoIso),
    vencimentoIso,
    valor: reais(dados.valorCentavos),
    valorCentavos: Number(dados.valorCentavos || 0),
    status: dados.estado || dados.status || (tipo === 'pagar' ? 'pendente' : 'prevista'),
    recorrente: dados.recorrente === true,
    moeda: dados.moeda || MOEDA,
  };
}

function dtoFechamento(documento) {
  const dados = documento.data() || {};
  const saldoEsperadoCentavos = Number(dados.saldoEsperadoCentavos || 0);
  const saldoConferidoCentavos = Number(dados.saldoConferidoCentavos || 0);
  const recebimentos = Array.isArray(dados.recebimentos) ? dados.recebimentos.map((item) => ({
    meio: item.meio || '',
    valor: reais(item.valorCentavos),
    transacoes: Number(item.transacoes || 0),
    cor: item.cor || 'text-muted',
    icone: item.icone || 'wallet',
  })) : [];
  return {
    id: documento.id,
    data: dataExibicao(dados.data),
    dataIso: dataFinanceira(dados.data, 'data'),
    abertura: reais(dados.aberturaCentavos),
    vendas: reais(dados.vendasCentavos),
    suprimentos: reais(dados.suprimentosCentavos),
    sangrias: reais(dados.sangriasCentavos),
    retiradas: reais(dados.retiradasCentavos),
    saldoEsperado: reais(saldoEsperadoCentavos),
    saldoConferido: reais(saldoConferidoCentavos),
    diferenca: reais(Number(dados.diferencaCentavos ?? (saldoConferidoCentavos - saldoEsperadoCentavos))),
    status: dados.estado || 'aberto',
    operador: dados.operador || '',
    aberturaHora: dados.aberturaHora || '',
    recebimentos,
    moeda: dados.moeda || MOEDA,
  };
}

function dtoRelatorio(documento) {
  const dados = documento.data() || {};
  const vendasCentavos = Number(dados.vendasCentavos || 0);
  const despesasCentavos = Number(dados.despesasCentavos || 0);
  const resultadoCentavos = Number(dados.resultadoCentavos ?? (vendasCentavos - despesasCentavos));
  return {
    id: documento.id,
    mes: dados.mes || dados.periodo || '',
    vendas: reais(vendasCentavos),
    despesas: reais(despesasCentavos),
    resultado: reais(resultadoCentavos),
    vendasCentavos,
    despesasCentavos,
    resultadoCentavos,
    categorias: Array.isArray(dados.categorias) ? dados.categorias.map((item) => ({
      nome: item.nome || '',
      valor: reais(item.valorCentavos || 0),
      percentual: Number(item.percentual || 0),
      cor: item.cor || 'bg-accent',
    })) : [],
  };
}

function dtoEncaminhamentoCaixa(documento) {
  const dados = documento.data() || {};
  const resumo = dados.resumoOperacional || {};
  return {
    id: documento.id,
    idComanda: dados.idComanda || '',
    idMesa: dados.idMesa || '',
    idGarcomResponsavel: dados.idGarcomResponsavel || null,
    nomeMesa: resumo.nomeMesa || dados.nomeMesa || '',
    nomeGarcom: resumo.nomeGarcom || dados.nomeGarcom || '',
    totalCentavos: Number(resumo.totalCentavos ?? dados.totalCentavos ?? 0),
    quantidadePedidos: Number(resumo.quantidadePedidos || dados.quantidadePedidos || 0),
    participantes: Number(resumo.participantes || dados.participantes || 0),
    statusEncaminhamento: dados.statusEncaminhamento || 'encaminhada',
    observacaoOperacional: String(dados.observacaoOperacional || ''),
    encaminhadaEm: timestampParaIso(dados.encaminhadaEm),
    recebidaEm: timestampParaIso(dados.recebidaEm),
    concluidaEm: timestampParaIso(dados.concluidaEm),
    idOperadorCaixa: dados.idOperadorCaixa || null,
    versao: Number(dados.versao || 1),
  };
}

function dtoResumoFinanceiro(dados = {}) {
  const caixa = dados.caixaAtual || dados.caixa || {};
  const caixaAtual = {
    data: dataExibicao(caixa.data),
    abertura: reais(caixa.aberturaCentavos || 0),
    vendas: reais(caixa.vendasCentavos || 0),
    suprimentos: reais(caixa.suprimentosCentavos || 0),
    sangrias: reais(caixa.sangriasCentavos || 0),
    retiradas: reais(caixa.retiradasCentavos || 0),
    saldoEsperado: reais(caixa.saldoEsperadoCentavos || 0),
    saldoConferido: reais(caixa.saldoConferidoCentavos || 0),
    status: caixa.estado || caixa.status || 'aberto',
    operador: caixa.operador || '',
    aberturaHora: caixa.aberturaHora || '',
  };
  const recebimentos = Array.isArray(dados.recebimentos) ? dados.recebimentos.map((item) => ({
    meio: item.meio || '',
    valor: reais(item.valorCentavos || 0),
    transacoes: Number(item.transacoes || 0),
    cor: item.cor || 'text-muted',
    icone: item.icone || 'wallet',
  })) : [];
  return {
    caixaAtual,
    recebimentos,
    compromissosCentavos: Number(dados.compromissosCentavos || 0),
    saldoProjetadoCentavos: Number(dados.saldoProjetadoCentavos || 0),
    vendasDiaCentavos: Number(dados.vendasDiaCentavos || 0),
  };
}

function validarConta(corpo) {
  const tipo = enumObrigatorio(corpo.tipo, new Set(['pagar', 'receber']), 'tipo');
  const valorCentavos = centavos(corpo.valor ?? corpo.valorReais, 'valor', { positivo: true });
  const vencimento = dataFinanceira(corpo.vencimento, 'vencimento');
  if (!vencimento) throw new ApiError(400, 'DATA_INVALIDA', 'vencimento é obrigatório.');
  return {
    tipo,
    descricao: textoObrigatorio(corpo.descricao, 'descricao', 180),
    categoria: textoObrigatorio(corpo.categoria, 'categoria', 100),
    vencimento,
    valorCentavos,
    recorrente: corpo.recorrente === true,
    estado: tipo === 'pagar' ? 'pendente' : 'prevista',
    moeda: MOEDA,
  };
}

function validarMovimentacao(corpo) {
  const tipo = enumObrigatorio(corpo.tipo, TIPOS_MOVIMENTACAO, 'tipo');
  return {
    tipo,
    data: dataFinanceira(corpo.data, 'data') || dataHoje(),
    categoria: textoObrigatorio(corpo.categoria, 'categoria', 100),
    descricao: textoObrigatorio(corpo.descricao, 'descricao', 240),
    origem: textoObrigatorio(corpo.origem || 'Manual', 'origem', 100),
    forma: textoObrigatorio(corpo.forma || 'Não informado', 'forma', 80),
    valorCentavos: centavos(corpo.valor ?? corpo.valorReais, 'valor', { positivo: true }),
    estado: 'pendente',
    moeda: MOEDA,
  };
}

function validarEstadoConta(tipo, estado) {
  const estados = tipo === 'pagar' ? ESTADOS_PAGAR : ESTADOS_RECEBER;
  return enumObrigatorio(estado, estados, 'estado');
}

function validarEstadoMovimentacao(estado) {
  return enumObrigatorio(estado, ESTADOS_MOVIMENTACAO, 'estado');
}

function validarFechamento(corpo) {
  if (corpo.confirmado !== true) throw new ApiError(400, 'CONFIRMACAO_NECESSARIA', 'A conferência do caixa precisa ser confirmada.');
  return { saldoConferidoCentavos: centavos(corpo.saldoConferido ?? corpo.saldoConferidoReais, 'saldoConferido', { obrigatorio: true }) };
}

module.exports = {
  PAPEIS_LEITURA_FINANCEIRO,
  PAPEIS_MUTACAO_FINANCEIRO,
  PAPEIS_FECHAMENTO,
  PAPEIS_LEITURA_CAIXA,
  PAPEIS_MUTACAO_CAIXA,
  ESTADOS_ENCAMINHAMENTO_CAIXA,
  TIPOS_MOVIMENTACAO,
  ESTADOS_MOVIMENTACAO,
  ESTADOS_PAGAR,
  ESTADOS_RECEBER,
  ESTADOS_FECHAMENTO,
  MOEDA,
  idDocumento,
  dataFinanceira,
  dataHoje,
  centavos,
  reais,
  dataExibicao,
  idempotencia,
  dtoDocumentoFinanceiro,
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
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  enumObrigatorio,
  timestampParaIso,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
};
