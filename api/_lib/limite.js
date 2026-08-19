'use strict';

const crypto = require('node:crypto');
const { ApiError } = require('./http');

const memoria = new Map();

function ipRequisicao(req) {
  const encaminhado = req.headers?.['x-forwarded-for'];
  const ip = typeof encaminhado === 'string' ? encaminhado.split(',')[0].trim() : (req.socket?.remoteAddress || 'desconhecido');
  return ip.slice(0, 128);
}

function chavePseudonimizada(req, nome) {
  return crypto.createHash('sha256').update(`${nome}|${ipRequisicao(req)}`, 'utf8').digest('hex').slice(0, 32);
}

function consumir(req, nome, limite, janelaMs) {
  if (process.env.APP_ENV === 'production' && (!process.env.RATE_LIMIT_URL || !process.env.RATE_LIMIT_TOKEN)) {
    throw new ApiError(503, 'LIMITE_NAO_CONFIGURADO', 'Proteção contra abuso temporariamente indisponível.');
  }

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

module.exports = { consumir };
