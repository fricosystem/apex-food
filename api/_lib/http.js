'use strict';

const crypto = require('node:crypto');

class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requestId(req) {
  const recebido = req.headers?.['x-request-id'];
  if (typeof recebido === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(recebido)) {
    return recebido;
  }
  return crypto.randomUUID();
}

function obterOrigem(req) {
  const origem = req.headers?.origin;
  return typeof origem === 'string' && origem.length <= 512 ? origem : '';
}

function origensPermitidas() {
  return [...new Set([
    process.env.APP_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ].map((item) => (item || '').trim()).filter(Boolean))];
}

function aplicarCors(req, res) {
  const origem = obterOrigem(req);
  const permitidas = origensPermitidas();
  res.setHeader('Vary', 'Origin');
  if (origem && permitidas.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  return !origem || permitidas.includes(origem);
}

function responder(res, status, corpo, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [nome, valor] of Object.entries(headers)) {
    res.setHeader(nome, valor);
  }
  res.end(JSON.stringify(corpo));
}

function responderErro(res, erro, idRequisicao) {
  const possuiContratoApi = erro && (
    erro instanceof ApiError
    || (erro.name === 'ApiError' && Number.isInteger(erro.status) && typeof erro.code === 'string')
  );
  if (possuiContratoApi) {
    responder(res, erro.status, {
      erro: erro.code,
      mensagem: erro.message,
      idRequisicao,
      ...(erro.details ? { detalhes: erro.details } : {}),
    });
    return;
  }

  responder(res, 500, {
    erro: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a solicitação.',
    idRequisicao,
  });
}

function exigirMetodo(req, metodos) {
  if (!metodos.includes(req.method)) {
    throw new ApiError(405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
  }
}

function tratarPreflight(req, res) {
  if (req.method === 'OPTIONS') {
    responder(res, 204, null);
    return true;
  }
  return false;
}

function obterCookies(req) {
  const cabecalho = req.headers?.cookie || '';
  return cabecalho.split(';').reduce((resultado, parte) => {
    const separador = parte.indexOf('=');
    if (separador <= 0) return resultado;
    const nome = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    try {
      resultado[nome] = decodeURIComponent(valor);
    } catch {
      resultado[nome] = '';
    }
    return resultado;
  }, {});
}

function atributoCookie(nome, valor, opcoes = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`];
  partes.push(`Path=${opcoes.path || '/'}`);
  if (opcoes.maxAge !== undefined) partes.push(`Max-Age=${opcoes.maxAge}`);
  if (opcoes.expires) partes.push(`Expires=${opcoes.expires.toUTCString()}`);
  if (opcoes.httpOnly) partes.push('HttpOnly');
  if (opcoes.secure !== false) partes.push('Secure');
  partes.push(`SameSite=${opcoes.sameSite || 'Lax'}`);
  return partes.join('; ');
}

function adicionarCookie(res, cookie) {
  const anterior = res.getHeader('Set-Cookie');
  const lista = anterior ? (Array.isArray(anterior) ? anterior : [anterior]) : [];
  res.setHeader('Set-Cookie', [...lista, cookie]);
}

function apagarCookie(res, nome) {
  adicionarCookie(res, atributoCookie(nome, '', { maxAge: 0 }));
}

async function lerCorpoJson(req, limiteBytes = 64 * 1024) {
  if (req.body !== undefined && req.body !== null && typeof req.body !== 'string') {
    if (typeof req.body === 'object') return req.body;
  }

  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > limiteBytes) {
      throw new ApiError(413, 'CORPO_MUITO_GRANDE', 'Payload excede o limite permitido.');
    }
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      throw new ApiError(400, 'JSON_INVALIDO', 'Payload JSON inválido.');
    }
  }

  if (!req.on) return {};
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += Buffer.byteLength(parte);
    if (tamanho > limiteBytes) {
      throw new ApiError(413, 'CORPO_MUITO_GRANDE', 'Payload excede o limite permitido.');
    }
    partes.push(Buffer.from(parte));
  }
  const texto = Buffer.concat(partes).toString('utf8');
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ApiError(400, 'JSON_INVALIDO', 'Payload JSON inválido.');
  }
}

module.exports = {
  ApiError,
  requestId,
  aplicarCors,
  responder,
  responderErro,
  exigirMetodo,
  tratarPreflight,
  obterOrigem,
  obterCookies,
  atributoCookie,
  adicionarCookie,
  apagarCookie,
  lerCorpoJson,
};
