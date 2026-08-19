'use strict';

const { getAdminAuth } = require('../../backend/firebase/admin');
const {
  ApiError,
  obterCookies,
  atributoCookie,
  adicionarCookie,
  apagarCookie,
} = require('./http');
const {
  ambiente,
  nomeCookieSessao,
  nomeCookieCsrf,
} = require('./config');

const TTL_PADRAO_SEGUNDOS = 8 * 60 * 60;

function segundosSessao() {
  const valor = Number.parseInt(process.env.SESSION_TTL_SECONDS || '', 10);
  return Number.isInteger(valor) && valor >= 300 && valor <= 14 * 24 * 60 * 60
    ? valor
    : TTL_PADRAO_SEGUNDOS;
}

function exigirSegredoCsrf() {
  const valor = process.env.CSRF_SECRET;
  if (!valor || valor.startsWith('replace-with-') || valor.length < 32) {
    throw new ApiError(503, 'CSRF_NAO_CONFIGURADO', 'Proteção CSRF temporariamente indisponível.');
  }
  return valor;
}

function assinaturaCsrf(nonce) {
  const crypto = require('node:crypto');
  return crypto.createHmac('sha256', exigirSegredoCsrf()).update(nonce, 'utf8').digest('base64url');
}

async function criarSessao(res, idToken) {
  if (typeof idToken !== 'string' || idToken.length < 100) {
    throw new ApiError(401, 'TOKEN_INVALIDO', 'Sessão inválida.');
  }
  const expiraEmSegundos = segundosSessao();
  let cookieSessao;
  try {
    cookieSessao = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: expiraEmSegundos * 1000,
    });
  } catch {
    throw new ApiError(401, 'TOKEN_INVALIDO', 'Sessão inválida.');
  }
  const seguro = ambiente() !== 'development';
  adicionarCookie(res, atributoCookie(nomeCookieSessao(), cookieSessao, {
    httpOnly: true,
    secure: seguro,
    sameSite: 'Lax',
    maxAge: expiraEmSegundos,
  }));
  return { expiraEmSegundos };
}

async function lerSessao(req) {
  const cookies = obterCookies(req);
  const valor = cookies[nomeCookieSessao()];
  if (!valor) return null;
  try {
    return await getAdminAuth().verifySessionCookie(valor, true);
  } catch {
    return null;
  }
}

async function exigirSessao(req) {
  const sessao = await lerSessao(req);
  if (!sessao?.uid) {
    throw new ApiError(401, 'NAO_AUTENTICADO', 'Sessão necessária.');
  }
  return sessao;
}

function encerrarSessao(res) {
  apagarCookie(res, nomeCookieSessao());
  apagarCookie(res, nomeCookieCsrf());
}

function criarTokenCsrf(res) {
  const crypto = require('node:crypto');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const token = `${nonce}.${assinaturaCsrf(nonce)}`;
  const seguro = ambiente() !== 'development';
  adicionarCookie(res, atributoCookie(nomeCookieCsrf(), token, {
    httpOnly: false,
    secure: seguro,
    sameSite: 'Lax',
    maxAge: segundosSessao(),
  }));
  return token;
}

function validarTokenCsrf(req) {
  const crypto = require('node:crypto');
  const cookies = obterCookies(req);
  const tokenCookie = cookies[nomeCookieCsrf()];
  const tokenCabecalho = req.headers?.['x-csrf-token'];
  if (!tokenCookie || typeof tokenCabecalho !== 'string' || tokenCookie !== tokenCabecalho) {
    throw new ApiError(403, 'CSRF_INVALIDO', 'Proteção CSRF inválida.');
  }
  const partes = tokenCookie.split('.');
  if (partes.length !== 2 || !/^[A-Za-z0-9_-]{20,}$/.test(partes[0])) {
    throw new ApiError(403, 'CSRF_INVALIDO', 'Proteção CSRF inválida.');
  }
  const esperado = assinaturaCsrf(partes[0]);
  const atual = Buffer.from(partes[1]);
  const referencia = Buffer.from(esperado);
  if (atual.length !== referencia.length || !crypto.timingSafeEqual(atual, referencia)) {
    throw new ApiError(403, 'CSRF_INVALIDO', 'Proteção CSRF inválida.');
  }
}

module.exports = {
  criarSessao,
  lerSessao,
  exigirSessao,
  encerrarSessao,
  criarTokenCsrf,
  validarTokenCsrf,
};
