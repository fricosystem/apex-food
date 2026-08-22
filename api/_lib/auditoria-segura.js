'use strict';

const RESULTADOS_AUDITORIA = new Set(['sucesso', 'negado', 'falha', 'erro']);

function textoAuditoria(valor, maximo = 240) {
  if (typeof valor !== 'string') return null;
  const normalizado = valor.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalizado ? normalizado.slice(0, maximo) : null;
}

function identificadorAuditoria(valor, maximo = 128) {
  const normalizado = textoAuditoria(valor, maximo);
  return normalizado && /^[A-Za-z0-9._:-]+$/.test(normalizado) ? normalizado : null;
}

function papeisAuditoria(valor) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.filter((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(item)).slice(0, 10))];
}

function resultadoAuditoria(valor) {
  return RESULTADOS_AUDITORIA.has(valor) ? valor : 'erro';
}

module.exports = { RESULTADOS_AUDITORIA, textoAuditoria, identificadorAuditoria, papeisAuditoria, resultadoAuditoria };
