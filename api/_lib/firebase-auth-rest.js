'use strict';

const { ApiError } = require('./http');

function apiKey() {
  const valor = process.env.FIREBASE_WEB_API_KEY;
  if (!valor || valor.startsWith('replace-with-')) {
    throw new ApiError(503, 'AUTH_NAO_CONFIGURADO', 'Autenticação temporariamente indisponível.');
  }
  return valor;
}

function validarEmailApex(email) {
  if (typeof email !== 'string') {
    throw new ApiError(400, 'EMAIL_INVALIDO', 'Informe um email válido.');
  }
  const normalizado = email.trim().toLowerCase();
  if (normalizado.length > 254 || !/^[^\s@]+@apexfood\.com$/.test(normalizado)) {
    throw new ApiError(400, 'EMAIL_INVALIDO', 'Use um email no formato nome@apexfood.com.');
  }
  return normalizado;
}

function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 12 || senha.length > 256) {
    throw new ApiError(400, 'SENHA_INVALIDA', 'A senha deve atender à política configurada.');
  }
  return senha;
}

function erroAuth(codigo, contexto) {
  const genérico = contexto === 'cadastro'
    ? ['CADASTRO_NAO_CONCLUIDO', 'Não foi possível concluir o cadastro.']
    : ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'];
  const mapeamento = {
    EMAIL_EXISTS: genérico,
    INVALID_PASSWORD: ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'],
    INVALID_LOGIN_CREDENTIALS: ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'],
    USER_DISABLED: ['AUTENTICACAO_NAO_DISPONIVEL', 'Não foi possível concluir a autenticação.'],
    TOO_MANY_ATTEMPTS_TRY_LATER: ['MUITAS_TENTATIVAS', 'Tente novamente mais tarde.'],
    WEAK_PASSWORD: ['SENHA_FRACA', 'A senha não atende à política configurada.'],
    INVALID_ID_TOKEN: ['TOKEN_INVALIDO', 'Sessão inválida.'],
  };
  return mapeamento[codigo] || genérico;
}

async function chamar(endpoint, payload, contexto = 'login') {
  const resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const codigo = dados?.error?.message || '';
    const [codigoPublico, mensagem] = erroAuth(codigo, contexto);
    throw new ApiError(contexto === 'cadastro' ? 400 : 401, codigoPublico, mensagem);
  }
  return dados;
}

async function cadastrarUsuario(email, senha) {
  const dados = await chamar('accounts:signUp', {
    email: validarEmailApex(email),
    password: validarSenha(senha),
    returnSecureToken: true,
  }, 'cadastro');
  if (!dados?.idToken || !dados?.localId) {
    throw new ApiError(502, 'RESPOSTA_AUTH_INVALIDA', 'Resposta de autenticação inválida.');
  }
  return dados;
}

async function autenticarUsuario(email, senha) {
  const dados = await chamar('accounts:signInWithPassword', {
    email: validarEmailApex(email),
    password: validarSenha(senha),
    returnSecureToken: true,
  }, 'login');
  if (!dados?.idToken || !dados?.localId) {
    throw new ApiError(502, 'RESPOSTA_AUTH_INVALIDA', 'Resposta de autenticação inválida.');
  }
  return dados;
}

async function enviarVerificacaoEmail(idToken) {
  const dados = await chamar('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken,
  }, 'verificacao');
  return Boolean(dados?.email);
}

async function solicitarRedefinicaoSenha(email) {
  const dados = await chamar('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email: validarEmailApex(email),
  }, 'recuperacao');
  return Boolean(dados?.email);
}

module.exports = {
  validarEmailApex,
  validarSenha,
  cadastrarUsuario,
  autenticarUsuario,
  enviarVerificacaoEmail,
  solicitarRedefinicaoSenha,
};
