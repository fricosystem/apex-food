'use strict';

const crypto = require('node:crypto');
const { ApiError } = require('./http');

const memoria = new Map();
const TIMEOUT_DISTRIBUIDO_MS = 1500;

function ipRequisicao(req) {
  const encaminhado = req.headers?.['x-forwarded-for'];
  const ip = typeof encaminhado === 'string' ? encaminhado.split(',')[0].trim() : (req.socket?.remoteAddress || 'desconhecido');
  return ip.slice(0, 128);
}

function chavePseudonimizada(req, nome) {
  return crypto.createHash('sha256').update(`${nome}|${ipRequisicao(req)}`, 'utf8').digest('hex').slice(0, 32);
}

function ambienteExigeDistribuido() {
  return new Set(['preview', 'staging', 'production']).has(String(process.env.APP_ENV || 'development').toLowerCase());
}

function erroIndisponivel() {
  return new ApiError(503, 'LIMITE_NAO_DISPONIVEL', 'Proteção contra abuso temporariamente indisponível.');
}

function interpretarResposta(resposta, corpo) {
  const permitido = corpo && typeof corpo.permitido === 'boolean' ? corpo.permitido : null;
  if (resposta.status === 429 || permitido === false) {
    const cabecalho = Number(resposta.headers.get('retry-after'));
    const aguardeSegundos = Number.isFinite(cabecalho) && cabecalho > 0
      ? Math.ceil(cabecalho)
      : Math.max(1, Number(corpo?.aguardeSegundos) || 60);
    throw new ApiError(429, 'MUITAS_TENTATIVAS', 'Tente novamente mais tarde.', { aguardeSegundos });
  }
  if (!resposta.ok || permitido !== true) throw erroIndisponivel();
}

async function consumirDistribuido(req, nome, limite, janelaMs) {
  const url = process.env.RATE_LIMIT_URL;
  const token = process.env.RATE_LIMIT_TOKEN;
  if (!url || url.startsWith('replace-with-') || !token || token.startsWith('replace-with-')) {
    throw new ApiError(503, 'LIMITE_NAO_CONFIGURADO', 'Proteção contra abuso temporariamente indisponível.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_DISTRIBUIDO_MS);
  let resposta;
  try {
    resposta = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chave: chavePseudonimizada(req, nome),
        limite,
        janelaSegundos: Math.ceil(janelaMs / 1000),
      }),
      signal: controller.signal,
    });
  } catch {
    throw erroIndisponivel();
  } finally {
    clearTimeout(timeout);
  }

  let corpo = null;
  try {
    const texto = await resposta.text();
    if (texto && texto.length <= 8192) corpo = JSON.parse(texto);
  } catch {
    corpo = null;
  }
  interpretarResposta(resposta, corpo);
}

function consumirMemoria(req, nome, limite, janelaMs) {
  const agora = Date.now();
  const chave = chavePseudonimizada(req, nome);
  const anterior = memoria.get(chave);
  if (!anterior || anterior.expiraEm <= agora) {
    memoria.set(chave, { quantidade: 1, expiraEm: agora + janelaMs });
    return;
  }
  anterior.quantidade += 1;
  if (anterior.quantidade > limite) {
    const espera = Math.max(1, Math.ceil((anterior.expiraEm - agora) / 1000));
    throw new ApiError(429, 'MUITAS_TENTATIVAS', 'Tente novamente mais tarde.', { aguardeSegundos: espera });
  }
  if (memoria.size > 2000) {
    for (const [chaveAtual, item] of memoria.entries()) {
      if (item.expiraEm <= agora) memoria.delete(chaveAtual);
    }
  }
}

async function consumir(req, nome, limite, janelaMs) {
  if (ambienteExigeDistribuido()) return consumirDistribuido(req, nome, limite, janelaMs);
  return consumirMemoria(req, nome, limite, janelaMs);
}

module.exports = { consumir, ambienteExigeDistribuido };
