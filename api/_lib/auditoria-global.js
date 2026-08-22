'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');

async function registrarAuditoriaGlobal({ idAtor, acao, tipoRecurso, idRecurso = null, idRestaurante = null, resultado = 'sucesso', motivo = null, idOperacao, idRequisicao }) {
  await getAdminDb().collection('registrosAuditoriaGlobais').add({
    idAtor,
    tipoAtor: 'desenvolvedor',
    acao,
    tipoRecurso,
    idRecurso,
    idRestaurante,
    resultado,
    motivo: typeof motivo === 'string' ? motivo.slice(0, 240) : null,
    idOperacao: idOperacao || idRequisicao || null,
    idRequisicao: idRequisicao || null,
    criadoEm: FieldValue.serverTimestamp(),
    versaoEstruturaAuditoria: '1.0.0',
    classeRetencao: 'global',
  });
}

module.exports = { registrarAuditoriaGlobal };
