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
  const partes = normalizado.split('@');
  const local = partes[0] || '';
  const dominio = partes[1] || '';
  const localValido = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(local);
  if (normalizado.length > 254 || dominio !== 'apexfood.com' || local.length < 2 || local.length > 30 || !localValido) {
    throw new ApiError(400, 'EMAIL_INVALIDO', 'Use um email no formato nome@apexfood.com ou nome.sobrenome@apexfood.com.');
  }
  return normalizado;
}

function validarSenhaMinima(senha) {
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 256) {
    throw new ApiError(400, 'SENHA_INVALIDA', 'A senha deve ter pelo menos 8 caracteres.');
  }
  return senha;
}

function validarSenha(senha) {
  const valor = validarSenhaMinima(senha);
  const requisitos = [
    [/[a-z]/, 'letra minúscula'],
    [/[A-Z]/, 'letra maiúscula'],
    [/\d/, 'número'],
    [/[^A-Za-z0-9]/, 'caractere especial'],
  ];
  const ausentes = requisitos.filter(([padrao]) => !padrao.test(valor)).map(([, nome]) => nome);
  if (ausentes.length) {
    throw new ApiError(400, 'SENHA_FRACA', 'A senha deve conter letra maiúscula, letra minúscula, número e caractere especial.');
  }
  return valor;
}

function erroAuth(codigo, contexto) {
  const genérico = contexto === 'cadastro'
    ? ['CADASTRO_NAO_CONCLUIDO', 'Não foi possível concluir o cadastro.']
    : ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'];
  const mapeamento = {
    EMAIL_EXISTS: genérico,
    EMAIL_NOT_FOUND: ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'],
    INVALID_PASSWORD: ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'],
    INVALID_LOGIN_CREDENTIALS: ['CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos.'],
    INVALID_API_KEY: ['AUTH_NAO_CONFIGURADO', 'A autenticação está temporariamente indisponível.'],
    API_KEY_INVALID: ['AUTH_NAO_CONFIGURADO', 'A autenticação está temporariamente indisponível.'],
    OPERATION_NOT_ALLOWED: ['AUTH_NAO_CONFIGURADO', 'O acesso por email e senha não está habilitado.'],
    PROJECT_NUMBER_MISMATCH: ['AUTH_NAO_CONFIGURADO', 'A configuração da autenticação não corresponde ao projeto.'],
    USER_DISABLED: ['AUTENTICACAO_NAO_DISPONIVEL', 'Não foi possível concluir a autenticação.'],
    TOO_MANY_ATTEMPTS_TRY_LATER: ['MUITAS_TENTATIVAS', 'Tente novamente mais tarde.'],
    WEAK_PASSWORD: ['SENHA_FRACA', 'A senha deve conter letra maiúscula, letra minúscula, número e caractere especial.'],
    PASSWORD_DOES_NOT_MEET_REQUIREMENTS: ['SENHA_FRACA', 'A senha deve conter letra maiúscula, letra minúscula, número e caractere especial.'],
    PASSWORD_POLICY_VIOLATION: ['SENHA_FRACA', 'A senha deve conter letra maiúscula, letra minúscula, número e caractere especial.'],
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
    password: validarSenhaMinima(senha),
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
  validarSenhaMinima,
  cadastrarUsuario,
  autenticarUsuario,
  enviarVerificacaoEmail,
  solicitarRedefinicaoSenha,
};
