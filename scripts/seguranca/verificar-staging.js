'use strict';

const { URL } = require('node:url');

const PLACEHOLDERS = /replace-with|example\.com|<[^>]+>|changeme|your[-_]/i;
const DEVELOPMENT_PROJECT = 'apex-food-6c1cb';

function exigir(ambiente, nome, erros) {
  const valor = ambiente[nome];
  if (!valor || PLACEHOLDERS.test(valor)) erros.push(`${nome} ausente ou ainda placeholder`);
  return valor;
}

function validarOrigem(nome, valor, erros) {
  let origem;
  try {
    origem = new URL(valor);
  } catch {
    erros.push(`${nome} precisa ser uma URL válida`);
    return null;
  }
  if (origem.protocol !== 'https:') erros.push(`${nome} precisa usar HTTPS`);
  if (origem.pathname !== '/' || origem.search || origem.hash) erros.push(`${nome} deve conter somente origem, sem caminho ou query`);
  return origem.origin;
}

function validar(ambiente = process.env) {
  const erros = [];
  if (ambiente.APP_ENV !== 'preview') erros.push('APP_ENV deve ser preview');

  const projeto = exigir(ambiente, 'FIREBASE_PROJECT_ID', erros);
  if (projeto === DEVELOPMENT_PROJECT) erros.push('FIREBASE_PROJECT_ID não pode ser o projeto Development');
  for (const nome of ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'SESSION_SECRET', 'CSRF_SECRET', 'FIREBASE_WEB_API_KEY']) exigir(ambiente, nome, erros);

  if ((ambiente.SESSION_SECRET || '').length < 32) erros.push('SESSION_SECRET precisa ter pelo menos 32 caracteres');
  if ((ambiente.CSRF_SECRET || '').length < 32) erros.push('CSRF_SECRET precisa ter pelo menos 32 caracteres');
  if (ambiente.SESSION_SECRET && ambiente.SESSION_SECRET === ambiente.CSRF_SECRET) erros.push('SESSION_SECRET e CSRF_SECRET devem ser diferentes');

  if (!['observe', 'enforce'].includes(ambiente.APP_CHECK_MODE)) erros.push('APP_CHECK_MODE deve ser observe ou enforce');

  let rateLimit;
  try {
    rateLimit = new URL(ambiente.RATE_LIMIT_URL);
    if (rateLimit.protocol !== 'https:') erros.push('RATE_LIMIT_URL precisa usar HTTPS');
  } catch {
    erros.push('RATE_LIMIT_URL precisa ser uma URL HTTPS válida');
  }
  exigir(ambiente, 'RATE_LIMIT_TOKEN', erros);

  const origem = validarOrigem('APP_ORIGIN', ambiente.APP_ORIGIN, erros);
  const permitidas = String(ambiente.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!permitidas.length) erros.push('ALLOWED_ORIGINS não pode ficar vazio');
  if (permitidas.includes('*')) erros.push('ALLOWED_ORIGINS não pode usar wildcard');
  if (origem && !permitidas.includes(origem)) erros.push('APP_ORIGIN precisa estar em ALLOWED_ORIGINS');
  for (const permitida of permitidas) validarOrigem('ALLOWED_ORIGINS', permitida, erros);

  return { valido: erros.length === 0, erros };
}

if (require.main === module) {
  const resultado = validar();
  if (!resultado.valido) {
    console.error('STAGING_PREFLIGHT_FALHOU');
    for (const erro of resultado.erros) console.error(`- ${erro}`);
    process.exitCode = 1;
  } else {
    console.log('STAGING_PREFLIGHT_OK: contrato de Staging coerente; nenhum segredo foi exibido.');
  }
}

module.exports = { validar };
