'use strict';

const { ApiError } = require('./http');
const { exigirSessao } = require('./sessao');
const { getAdminAuth } = require('../../backend/firebase/admin');

const NOME_UIDS_DESENVOLVEDOR = 'APEX_DESENVOLVEDOR_UID';
const NOME_EMAILS_DESENVOLVEDOR = 'APEX_DESENVOLVEDOR_EMAIL';

function normalizarLista(valor) {
  return String(valor || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizarEmail(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

function configuracaoDesenvolvedor() {
  const uids = normalizarLista(process.env[NOME_UIDS_DESENVOLVEDOR]);
  const emails = normalizarLista(process.env[NOME_EMAILS_DESENVOLVEDOR]).map(normalizarEmail).filter(Boolean);
  return { uids, emails };
}

function acessoGlobalConfigurado() {
  const configuracao = configuracaoDesenvolvedor();
  return configuracao.uids.length > 0 || configuracao.emails.length > 0;
}

function usuarioAutorizadoGlobal(usuarioAuth, configuracao = configuracaoDesenvolvedor()) {
  if (!usuarioAuth?.uid || usuarioAuth.disabled === true) return false;
  const uidAutorizado = configuracao.uids.includes(usuarioAuth.uid);
  const emailAutorizado = configuracao.emails.includes(normalizarEmail(usuarioAuth.email));
  return uidAutorizado || emailAutorizado;
}

async function obterIdentidadeDesenvolvedor(req) {
  const sessao = await exigirSessao(req);
  const configuracao = configuracaoDesenvolvedor();
  if (!configuracao.uids.length && !configuracao.emails.length) {
    throw new ApiError(503, 'DESENVOLVEDOR_NAO_CONFIGURADO', 'O acesso de Desenvolvedor ainda não foi configurado.');
  }

  let usuarioAuth;
  try {
    usuarioAuth = await getAdminAuth().getUser(sessao.uid);
  } catch {
    throw new ApiError(401, 'USUARIO_INVALIDO', 'Usuário inválido.');
  }
  if (!usuarioAutorizadoGlobal(usuarioAuth, configuracao)) {
    throw new ApiError(403, 'ACESSO_GLOBAL_NEGADO', 'Acesso de Desenvolvedor não autorizado.');
  }

  return {
    idUsuario: usuarioAuth.uid,
    emailCanonico: normalizarEmail(usuarioAuth.email),
    nomeExibicao: usuarioAuth.displayName || null,
    tipoConta: 'desenvolvedor',
    acessoGlobal: 'desenvolvedor',
    papeisGlobais: ['desenvolvedor'],
  };
}

function dtoAcessoGlobal(identidade) {
  return {
    tipoConta: identidade?.tipoConta || null,
    acessoGlobal: identidade?.acessoGlobal || 'nenhum',
    papeisGlobais: Array.isArray(identidade?.papeisGlobais) ? identidade.papeisGlobais.slice(0, 5) : [],
  };
}

module.exports = {
  NOME_UIDS_DESENVOLVEDOR,
  NOME_EMAILS_DESENVOLVEDOR,
  configuracaoDesenvolvedor,
  acessoGlobalConfigurado,
  usuarioAutorizadoGlobal,
  obterIdentidadeDesenvolvedor,
  dtoAcessoGlobal,
};
