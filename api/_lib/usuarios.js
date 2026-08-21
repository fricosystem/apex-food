'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');

function referenciaUsuario(idUsuario) {
  return getAdminDb().collection('usuarios').doc(idUsuario);
}

async function salvarUsuario({ idUsuario, emailCanonico, nomeExibicao, estado, ultimoLoginEm = null }) {
  const agora = new Date();
  const dados = {
    idUsuario,
    emailCanonico,
    atualizadoEm: agora,
    atualizadoPor: 'sistema',
  };
  if (nomeExibicao !== undefined) dados.nomeExibicao = nomeExibicao;
  if (estado !== undefined) dados.estado = estado;
  if (ultimoLoginEm) dados.ultimoLoginEm = ultimoLoginEm;
  await referenciaUsuario(idUsuario).set(dados, { merge: true });
  return dados;
}

async function lerUsuario(idUsuario) {
  const documento = await referenciaUsuario(idUsuario).get();
  return documento.exists ? documento.data() : null;
}

async function atualizarNomeUsuario({ idUsuario, nomeExibicao }) {
  const referencia = referenciaUsuario(idUsuario);
  await referencia.set({
    idUsuario,
    nomeExibicao,
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: 'sistema',
  }, { merge: true });
  return lerUsuario(idUsuario);
}

async function atualizarPreferenciasUsuario({ idUsuario, preferencias }) {
  const referencia = referenciaUsuario(idUsuario);
  await referencia.firestore.runTransaction(async transacao => {
    const documento = await transacao.get(referencia);
    const atuais = documento.exists ? documento.data() || {} : {};
    const preferenciasAtuais = atuais.preferenciasNotificacao && typeof atuais.preferenciasNotificacao === 'object'
      ? atuais.preferenciasNotificacao
      : {};
    transacao.set(referencia, {
      idUsuario,
      preferenciasNotificacao: {
        ...preferenciasAtuais,
        ...preferencias,
      },
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: 'sistema',
    }, { merge: true });
  });
  return lerUsuario(idUsuario);
}

module.exports = {
  salvarUsuario,
  lerUsuario,
  atualizarNomeUsuario,
  atualizarPreferenciasUsuario,
};
