'use strict';

/**
 * APEX Food — Firebase Admin server-side.
 *
 * Este módulo deve ser importado somente por funções Node/Vercel.
 * Nunca o inclua em HTML, scripts do navegador ou bundles públicos.
 * Dependência necessária para a Etapa 7: firebase-admin.
 */

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const REQUIRED_ENV = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.startsWith('replace-with-')) {
    throw new Error(`Configuração server-side ausente: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value) {
  return value.replace(/\\n/g, '\n').trim();
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const missing = REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return !value || value.startsWith('replace-with-');
  });

  if (missing.length > 0) {
    throw new Error(`Firebase Admin indisponível: variáveis ausentes (${missing.join(', ')})`);
  }

  return initializeApp({
    credential: cert({
      projectId: readRequiredEnv('FIREBASE_PROJECT_ID'),
      clientEmail: readRequiredEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: normalizePrivateKey(readRequiredEnv('FIREBASE_PRIVATE_KEY')),
    }),
  });
}

function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

module.exports = {
  getFirebaseAdminApp,
  getAdminAuth,
  getAdminDb,
};
