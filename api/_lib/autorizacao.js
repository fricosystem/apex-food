'use strict';

const { ApiError } = require('./http');
const { getAdminAuth, getAdminDb } = require('../../backend/firebase/admin');
const { PAPEIS_NATIVOS_POR_CODIGO, PERMISSOES_VALIDAS } = require('./permissoes-locais');

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
  const permissoesDiretas = Array.isArray(dados.permissoesDiretas)
    ? dados.permissoesDiretas.filter((permissao) => typeof permissao === 'string' && PERMISSOES_VALIDAS.has(permissao)).slice(0, 30)
    : [];
  return { idRestaurante, idUsuario, papeis, permissoesDiretas };
}

async function obterPermissoesDoMembro(idRestaurante, papeis, permissoesDiretas = []) {
  const permissoes = new Set(permissoesDiretas.filter((permissao) => PERMISSOES_VALIDAS.has(permissao)));
  const personalizados = [];
  for (const papel of papeis) {
    const nativo = PAPEIS_NATIVOS_POR_CODIGO.get(papel);
    if (nativo) nativo.permissoes.forEach((permissao) => permissoes.add(permissao));
    else personalizados.push(papel);
  }
  if (personalizados.length) {
    const snapshot = await getAdminDb().collection('restaurantes').doc(idRestaurante).collection('papeis').where('estado', '==', 'ativo').get();
    snapshot.docs.forEach((documento) => {
      const dados = documento.data() || {};
      if (personalizados.includes(dados.codigo || documento.id) && Array.isArray(dados.permissoes)) dados.permissoes.slice(0, 30).forEach((permissao) => permissoes.add(permissao));
    });
  }
  return [...permissoes];
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
    permissoes: await obterPermissoesDoMembro(membro.idRestaurante, membro.papeis, membro.permissoesDiretas),
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
  if (identidade.papeis.some((papel) => permitidos.has(papel))) return;
  const permissaoPorPapel = {
    diretor: ['estabelecimento.visualizar', 'estabelecimento.configurar', 'equipe.gerenciar', 'papeis.gerenciar', 'cardapio.gerenciar', 'pedidos.operar', 'salao.operar', 'cozinha.operar', 'caixa.operar', 'financeiro.operar', 'relatorios.visualizar'],
    proprietario: ['estabelecimento.visualizar', 'estabelecimento.configurar', 'equipe.gerenciar', 'papeis.gerenciar', 'cardapio.gerenciar', 'pedidos.operar', 'salao.operar', 'cozinha.operar', 'caixa.operar', 'financeiro.operar', 'relatorios.visualizar'],
    administrador: ['equipe.gerenciar', 'papeis.gerenciar', 'cardapio.gerenciar', 'pedidos.operar', 'salao.operar', 'cozinha.operar', 'caixa.operar', 'relatorios.visualizar'],
    gerente: ['pedidos.operar', 'salao.operar', 'cozinha.operar', 'relatorios.visualizar'],
    garcom: ['pedidos.operar', 'salao.operar'],
    cozinheiro: ['cozinha.operar'],
    cozinha: ['cozinha.operar'],
    caixa: ['caixa.operar'],
    financeiro: ['financeiro.operar'],
    analista: ['relatorios.visualizar'],
    auditor: ['relatorios.visualizar'],
    porteiro: ['salao.visualizar'],
  };
  const permissoesIndiretas = new Set([...permitidos].flatMap((papel) => permissaoPorPapel[papel] || []));
  if (Array.isArray(identidade.permissoes) && identidade.permissoes.some((permissao) => permissoesIndiretas.has(permissao))) return;
  throw new ApiError(403, 'PAPEL_INSUFICIENTE', 'Papel insuficiente para esta operação.');
}

function exigirPermissao(identidade, permissoesPermitidas) {
  const permitidas = new Set(permissoesPermitidas);
  if (!Array.isArray(identidade.permissoes) || !identidade.permissoes.some((permissao) => permitidas.has(permissao))) {
    throw new ApiError(403, 'PERMISSAO_INSUFICIENTE', 'Seu perfil não possui permissão para este módulo.');
  }
}

function dtoIdentidade(identidade) {
  return {
    idUsuario: identidade.idUsuario,
    emailCanonico: identidade.emailCanonico,
    idRestaurante: identidade.idRestaurante,
    papeis: identidade.papeis,
    permissoes: Array.isArray(identidade.permissoes) ? identidade.permissoes.slice(0, 80) : [],
    emailVerificado: identidade.emailVerificado,
  };
}

module.exports = {
  obterMembro,
  obterUsuario,
  resolverIdentidadeSessao,
  exigirPapel,
  exigirPermissao,
  dtoIdentidade,
};
