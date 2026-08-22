'use strict';

const { ApiError } = require('./http');
const { exigirSessao } = require('./sessao');
const { lerContexto } = require('./contexto');
const { resolverIdentidadeSessao, exigirPapel, exigirPermissao } = require('./autorizacao');
const { registrarAuditoria } = require('./auditoria');
const { getAdminDb } = require('../../backend/firebase/admin');

const PAPEIS_LEITURA = ['diretor', 'proprietario', 'administrador', 'gerente', 'porteiro', 'garcom', 'cozinheiro', 'cozinha', 'caixa', 'financeiro', 'analista', 'auditor'];
const PAPEIS_CARDAPIO = ['diretor', 'proprietario', 'administrador', 'gerente'];
const PAPEIS_SALAO = ['diretor', 'proprietario', 'administrador', 'gerente', 'porteiro', 'garcom'];
const ESTADOS_RESERVA = new Set(['aguardando', 'confirmada', 'chegou', 'cancelada']);
const ESTADOS_MESA = new Set(['disponivel', 'ocupada', 'indisponivel']);

function caminhoRestaurante(idRestaurante) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(idRestaurante)) {
    throw new ApiError(400, 'RESTAURANTE_INVALIDO', 'Restaurante inválido.');
  }
  return getAdminDb().collection('restaurantes').doc(idRestaurante);
}

async function obterIdentidadeOperacional(req, papeisPermitidos = PAPEIS_LEITURA, permissoesPermitidas = []) {
  const sessao = await exigirSessao(req);
  const contexto = lerContexto(req);
  const identidade = await resolverIdentidadeSessao({
    sessao,
    idRestaurante: contexto?.idRestaurante,
  });
  if (Array.isArray(permissoesPermitidas) && permissoesPermitidas.length) exigirPermissao(identidade, permissoesPermitidas);
  else exigirPapel(identidade, papeisPermitidos);
  return identidade;
}

function limitarInteiro(valor, padrao = 100, maximo = 200) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isInteger(numero) || numero < 1) return padrao;
  return Math.min(numero, maximo);
}

function textoObrigatorio(valor, campo, maximo = 160) {
  if (typeof valor !== 'string') {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é obrigatório.`);
  }
  const texto = valor.trim();
  if (!texto || texto.length > maximo) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return texto;
}

function textoOpcional(valor, campo, maximo = 1000) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor !== 'string' || valor.trim().length > maximo) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return valor.trim();
}

function inteiroNaoNegativo(valor, campo, maximo = 1000000000) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0 || numero > maximo) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} deve ser um inteiro não negativo.`);
  }
  return numero;
}

function inteiroPositivo(valor, campo, maximo = 1000000000) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > maximo) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} deve ser um inteiro positivo.`);
  }
  return numero;
}

function enumObrigatorio(valor, conjunto, campo) {
  if (typeof valor !== 'string' || !conjunto.has(valor)) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return valor;
}

function timestampParaIso(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'number') return new Date(valor).toISOString();
  if (typeof valor === 'string') return valor;
  return null;
}

function dtoDocumento(documento) {
  const dados = documento.data() || {};
  const dto = { id: documento.id, ...dados };
  for (const campo of ['criadoEm', 'atualizadoEm', 'inicioEm', 'fimEm']) {
    if (campo in dto) dto[campo] = timestampParaIso(dto[campo]);
  }
  delete dto.criadoPor;
  delete dto.atualizadoPor;
  delete dto.excluidoPor;
  delete dto.idRestaurante;
  return dto;
}

function mascararContato(valor) {
  if (typeof valor !== 'string') return '';
  const limpo = valor.trim();
  if (limpo.length <= 4) return limpo ? '****' : '';
  return `${'*'.repeat(Math.max(0, limpo.length - 4))}${limpo.slice(-4)}`;
}

function dtoReserva(documento) {
  const dto = dtoDocumento(documento);
  if (dto.contatoClienteMascarado === undefined && dto.contatoCliente) {
    dto.contatoClienteMascarado = mascararContato(dto.contatoCliente);
  }
  delete dto.contatoCliente;
  return dto;
}

function queryString(req, nome) {
  const valor = req.query?.[nome];
  return typeof valor === 'string' ? valor.trim() : '';
}

async function listarColecao(idRestaurante, colecao, limite = 100) {
  const snapshot = await caminhoRestaurante(idRestaurante).collection(colecao).limit(limite).get();
  return snapshot.docs;
}

async function registrarAuditoriaOperacional({ identidade, idRequisicao, acao, tipoRecurso, idRecurso, resultado = 'sucesso', codigoMotivo = null }) {
  try {
    await registrarAuditoria({
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      papeisDoAtor: identidade.papeis,
      acao,
      tipoRecurso,
      idRecurso: idRecurso || null,
      idOperacao: idRequisicao,
      idRequisicao,
      resultado,
      codigoMotivo,
    });
  } catch {
    // Falha de auditoria não deve revelar detalhes nem transformar a operação em vazamento.
  }
}

module.exports = {
  PAPEIS_LEITURA,
  PAPEIS_CARDAPIO,
  PAPEIS_SALAO,
  ESTADOS_RESERVA,
  ESTADOS_MESA,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  exigirPapel,
  exigirPermissao,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  inteiroPositivo,
  enumObrigatorio,
  timestampParaIso,
  dtoDocumento,
  dtoReserva,
  mascararContato,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
};
