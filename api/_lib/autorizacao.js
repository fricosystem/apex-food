'use strict';

const { ApiError } = require('./http');
const { getAdminAuth, getAdminDb } = require('../../backend/firebase/admin');

function caminhoMembro(idRestaurante, idUsuario) {
  return getAdminDb()
    .collection('restaurantes')
    .doc(idRestaurante)
    .collection('membros')
    .doc(idUsuario);
}

async function verificarSessaoFirebase(sessao) {
  if (!sessao?.uid) {
    throw new ApiError(401, 'NAO_AUTENTICADO', 'Sessão necessária.');
  }
  return sessao;
}

async function obterMembro(idRestaurante, idUsuario) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(idRestaurante)) {
    throw new ApiError(400, 'RESTAURANTE_INVALIDO', 'Restaurante inválido.');
  }
  const documento = await caminhoMembro(idRestaurante, idUsuario).get();
  if (!documento.exists) {
    throw new ApiError(403, 'ACESSO_NEGADO', 'Usuário sem acesso ao restaurante.');
  }
  const dados = documento.data() || {};
  const papeis = Array.isArray(dados.papeis)
    ? dados.papeis.filter((papel) => typeof papel === 'string').slice(0, 20)
    : [];
  if (dados.idUsuario !== idUsuario || dados.idRestaurante !== idRestaurante || dados.estado !== 'ativo') {
    throw new ApiError(403, 'ACESSO_NEGADO', 'Usuário sem acesso ao restaurante.');
  }
  return { idRestaurante, idUsuario, papeis };
}

async function resolverIdentidadeSessao({ sessao, idRestaurante }) {
  const token = await verificarSessaoFirebase(sessao);
  const restaurante = idRestaurante || token.idRestauranteAtivo || null;
  if (!restaurante) {
    throw new ApiError(403, 'RESTAURANTE_NAO_SELECIONADO', 'Selecione um restaurante autorizado.');
  }
  const membro = await obterMembro(restaurante, token.uid);
  return {
    idUsuario: token.uid,
    emailCanonico: typeof token.email === 'string' ? token.email.toLowerCase() : null,
    idRestaurante: membro.idRestaurante,
    papeis: membro.papeis,
    emailVerificado: token.email_verified === true,
  };
}

async function obterUsuario(idUsuario) {
  try {
    return await getAdminAuth().getUser(idUsuario);
  } catch {
    throw new ApiError(401, 'USUARIO_INVALIDO', 'Usuário inválido.');
  }
}

function exigirPapel(identidade, papeisPermitidos) {
  const permitidos = new Set(papeisPermitidos);
  if (!identidade.papeis.some((papel) => permitidos.has(papel))) {
    throw new ApiError(403, 'PAPEL_INSUFICIENTE', 'Papel insuficiente para esta operação.');
  }
}

function dtoIdentidade(identidade) {
  return {
    idUsuario: identidade.idUsuario,
    emailCanonico: identidade.emailCanonico,
    idRestaurante: identidade.idRestaurante,
    papeis: identidade.papeis,
    emailVerificado: identidade.emailVerificado,
  };
}

module.exports = {
  obterMembro,
  obterUsuario,
  resolverIdentidadeSessao,
  exigirPapel,
  dtoIdentidade,
};
