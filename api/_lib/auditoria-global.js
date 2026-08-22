'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');
const { identificadorAuditoria, resultadoAuditoria, textoAuditoria } = require('./auditoria-segura');

async function registrarAuditoriaGlobal({ idAtor, acao, tipoRecurso, idRecurso = null, idRestaurante = null, resultado = 'sucesso', motivo = null, idOperacao, idRequisicao }) {
  await getAdminDb().collection('registrosAuditoriaGlobais').add({
    idAtor: identificadorAuditoria(idAtor),
    tipoAtor: 'desenvolvedor',
    acao: textoAuditoria(acao, 120),
    tipoRecurso: textoAuditoria(tipoRecurso, 120),
    idRecurso: identificadorAuditoria(idRecurso),
    idRestaurante: identificadorAuditoria(idRestaurante),
    resultado: resultadoAuditoria(resultado),
    motivo: textoAuditoria(motivo),
    idOperacao: identificadorAuditoria(idOperacao || idRequisicao),
    idRequisicao: identificadorAuditoria(idRequisicao),
    criadoEm: FieldValue.serverTimestamp(),
    versaoEstruturaAuditoria: '1.1.0',
    classeRetencao: 'global',
  });
}

module.exports = { registrarAuditoriaGlobal };
