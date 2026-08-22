'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');
const { identificadorAuditoria, papeisAuditoria, resultadoAuditoria, textoAuditoria } = require('./auditoria-segura');

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
    idRestaurante: identificadorAuditoria(idRestaurante),
    idAtor: identificadorAuditoria(idAtor) || 'sistema',
    papeisDoAtor: papeisAuditoria(papeisDoAtor),
    acao: textoAuditoria(acao, 120),
    tipoRecurso: textoAuditoria(tipoRecurso, 120),
    idRecurso: identificadorAuditoria(idRecurso),
    idOperacao: identificadorAuditoria(idOperacao),
    idRequisicao: identificadorAuditoria(idRequisicao),
    resultado: resultadoAuditoria(resultado),
    codigoMotivo: textoAuditoria(codigoMotivo, 120),
    criadoEm: FieldValue.serverTimestamp(),
    versaoEstruturaAuditoria: '1.1.0',
    classeRetencao: 'padrao',
  };
  await getAdminDb().collection('registrosAuditoria').add(registro);
}

module.exports = { registrarAuditoria };
