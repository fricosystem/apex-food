'use strict';

const crypto = require('node:crypto');
const { ApiError, obterCookies, atributoCookie, adicionarCookie, apagarCookie } = require('./http');
const { ambiente } = require('./config');

const NOME_COOKIE = 'apex_contexto';
const TTL_SEGUNDOS = 8 * 60 * 60;

function segredo() {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.startsWith('replace-with-') || valor.length < 32) {
    throw new ApiError(503, 'CONTEXTO_NAO_CONFIGURADO', 'Contexto de sessão temporariamente indisponível.');
  }
  return valor;
}

function assinar(conteudo) {
  return crypto.createHmac('sha256', segredo()).update(conteudo, 'utf8').digest('base64url');
}

function codificar(objeto) {
  const conteudo = Buffer.from(JSON.stringify(objeto), 'utf8').toString('base64url');
  return `${conteudo}.${assinar(conteudo)}`;
}

function decodificar(valor) {
  if (typeof valor !== 'string') return null;
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const esperado = assinar(partes[0]);
  const recebido = Buffer.from(partes[1]);
  const referencia = Buffer.from(esperado);
  if (recebido.length !== referencia.length || !crypto.timingSafeEqual(recebido, referencia)) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
    if (!dados?.idRestaurante || dados.expiraEm <= Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

function lerContexto(req) {
  const valor = obterCookies(req)[NOME_COOKIE];
  return decodificar(valor);
}

function definirContexto(res, idRestaurante) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(idRestaurante)) {
    throw new ApiError(400, 'RESTAURANTE_INVALIDO', 'Restaurante inválido.');
  }
  const seguro = ambiente() !== 'development';
  const valor = codificar({ idRestaurante, expiraEm: Date.now() + TTL_SEGUNDOS * 1000 });
  adicionarCookie(res, atributoCookie(NOME_COOKIE, valor, {
    httpOnly: true,
    secure: seguro,
    sameSite: 'Lax',
    maxAge: TTL_SEGUNDOS,
  }));
}

function limparContexto(res) {
  apagarCookie(res, NOME_COOKIE);
}

module.exports = { lerContexto, definirContexto, limparContexto };
