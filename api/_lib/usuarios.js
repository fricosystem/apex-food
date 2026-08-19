'use strict';

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

module.exports = { salvarUsuario, lerUsuario };
