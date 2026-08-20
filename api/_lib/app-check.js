'use strict';

const { getAppCheck } = require('firebase-admin/app-check');
const { getFirebaseAdminApp } = require('../../backend/firebase/admin');
const { ApiError } = require('./http');

const MODOS = new Set(['off', 'observe', 'enforce']);

function modoAppCheck() {
  const informado = String(process.env.APP_CHECK_MODE || '').trim().toLowerCase();
  if (MODOS.has(informado)) return informado;
  return process.env.APP_ENV === 'development' ? 'off' : 'observe';
}

async function verificarAppCheck(req) {
  const modo = modoAppCheck();
  if (modo === 'off') return;

  const token = req.headers?.['x-firebase-appcheck'];
  if (typeof token !== 'string' || token.length < 20) {
    if (modo === 'enforce') {
      throw new ApiError(401, 'APPCHECK_INVALIDO', 'Não foi possível validar o cliente.');
    }
    return;
  }

  try {
    await getAppCheck(getFirebaseAdminApp()).verifyToken(token);
  } catch {
    if (modo === 'enforce') {
      throw new ApiError(401, 'APPCHECK_INVALIDO', 'Não foi possível validar o cliente.');
    }
  }
}

module.exports = { modoAppCheck, verificarAppCheck };
