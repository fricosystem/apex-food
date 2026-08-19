'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');

async function registrarAuditoria({
  idRestaurante = null,
  idAtor = 'sistema',
  papeisDoAtor = [],
  acao,
  tipoRecurso,
  idRecurso = null,
  idOperacao,
  idRequisicao,
  resultado,
  codigoMotivo = null,
}) {
  const registro = {
    idRestaurante,
    idAtor,
    papeisDoAtor: Array.isArray(papeisDoAtor) ? papeisDoAtor.slice(0, 10) : [],
    acao,
    tipoRecurso,
    idRecurso,
    idOperacao,
    idRequisicao,
    resultado,
    codigoMotivo,
    criadoEm: FieldValue.serverTimestamp(),
    versaoEstruturaAuditoria: '1.0.0',
    classeRetencao: 'padrao',
  };
  await getAdminDb().collection('registrosAuditoria').add(registro);
}

module.exports = { registrarAuditoria };
