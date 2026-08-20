'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./http');
const { caminhoRestaurante } = require('./modulos-operacionais');

const COLECAO_DISPOSITIVOS = 'dispositivosNotificacao';
const PLATAFORMAS = new Set(['android', 'desktop', 'tablet', 'web']);
const ORIGENS = new Set(['pwa', 'navegador']);
const STATUS = new Set(['ativo', 'revogado']);
const ID_VALIDO = /^[a-f0-9]{40}$/;
const RETENCAO_DISPOSITIVO_MS = 90 * 24 * 60 * 60 * 1000;
const ESTADOS_ENTREGA = new Set(['sem_teste', 'enviado', 'falhou', 'revogado', 'indisponivel']);

function texto(valor, campo, minimo = 1, maximo = 4096) {
  if (typeof valor !== 'string') throw new ApiError(400, 'DISPOSITIVO_PAYLOAD_INVALIDO', `${campo} é obrigatório.`);
  const resultado = valor.trim();
  if (resultado.length < minimo || resultado.length > maximo) {
    throw new ApiError(400, 'DISPOSITIVO_PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return resultado;
}

function enumera(valor, conjunto, campo, padrao) {
  const resultado = valor === undefined || valor === null || valor === '' ? padrao : valor;
  if (typeof resultado !== 'string' || !conjunto.has(resultado)) {
    throw new ApiError(400, 'DISPOSITIVO_PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return resultado;
}

function booleano(valor, padrao) {
  return typeof valor === 'boolean' ? valor : padrao;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 40);
}

function referenciaDispositivo(identidade, idDispositivo) {
  if (typeof idDispositivo !== 'string' || !ID_VALIDO.test(idDispositivo)) {
    throw new ApiError(400, 'ID_DISPOSITIVO_INVALIDO', 'Identificador do dispositivo inválido.');
  }
  return caminhoRestaurante(identidade.idRestaurante).collection(COLECAO_DISPOSITIVOS).doc(idDispositivo);
}

function timestampIso(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  return typeof valor === 'string' ? valor : null;
}

function dtoDispositivo(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    plataforma: dados.plataforma || 'web',
    origem: dados.origem || 'navegador',
    statusDispositivo: STATUS.has(dados.statusDispositivo) ? dados.statusDispositivo : 'ativo',
    preferencias: {
      operacionais: dados.preferencias?.operacionais !== false,
      sistema: dados.preferencias?.sistema !== false,
    },
    criadoEm: timestampIso(dados.criadoEm),
    atualizadoEm: timestampIso(dados.atualizadoEm),
    ultimoUsoEm: timestampIso(dados.ultimoUsoEm),
    revogadoEm: timestampIso(dados.revogadoEm),
    expiraEm: timestampIso(dados.expiraEm),
    ultimoResultadoEntrega: ESTADOS_ENTREGA.has(dados.ultimoResultadoEntrega) ? dados.ultimoResultadoEntrega : 'sem_teste',
    ultimaEntregaEm: timestampIso(dados.ultimaEntregaEm),
    falhasConsecutivas: Math.max(0, Number(dados.falhasConsecutivas || 0)),
  };
}

function validarPreferencias(preferencias) {
  if (preferencias === undefined || preferencias === null) return { operacionais: true, sistema: true };
  if (typeof preferencias !== 'object' || Array.isArray(preferencias)) {
    throw new ApiError(400, 'PREFERENCIAS_INVALIDAS', 'Preferências de notificação inválidas.');
  }
  return {
    operacionais: booleano(preferencias.operacionais, true),
    sistema: booleano(preferencias.sistema, true),
  };
}

async function registrarDispositivo({ identidade, corpo, idRequisicao, registrarAuditoria }) {
  const tokenFcm = texto(corpo.tokenFcm, 'tokenFcm', 20, 4096);
  const plataforma = enumera(corpo.plataforma, PLATAFORMAS, 'plataforma', 'web');
  const origem = enumera(corpo.origem, ORIGENS, 'origem', 'navegador');
  const preferencias = validarPreferencias(corpo.preferencias);
  const id = hashToken(tokenFcm);
  const referencia = referenciaDispositivo(identidade, id);
  const expiraEm = new Date(Date.now() + RETENCAO_DISPOSITIVO_MS);
  let resultado;
  let atualizado = false;

  await referencia.firestore.runTransaction(async transacao => {
    const atual = await transacao.get(referencia);
    const dadosAtuais = atual.exists ? atual.data() || {} : {};
    if (atual.exists && dadosAtuais.idUsuario && dadosAtuais.idUsuario !== identidade.idUsuario) {
      throw new ApiError(409, 'DISPOSITIVO_FORA_DO_ESCOPO', 'Este dispositivo já está vinculado a outra conta neste restaurante.');
    }
    atualizado = atual.exists;
    const dados = {
      idRestaurante: identidade.idRestaurante,
      idUsuario: identidade.idUsuario,
      tokenFcm,
      hashToken: id,
      plataforma,
      origem,
      statusDispositivo: 'ativo',
      preferencias,
      criadoEm: dadosAtuais.criadoEm || FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      ultimoUsoEm: FieldValue.serverTimestamp(),
      revogadoEm: null,
      expiraEm,
      ultimoResultadoEntrega: dadosAtuais.ultimoResultadoEntrega || 'sem_teste',
      ultimaEntregaEm: dadosAtuais.ultimaEntregaEm || null,
      falhasConsecutivas: Math.max(0, Number(dadosAtuais.falhasConsecutivas || 0)),
    };
    transacao.set(referencia, dados, { merge: true });
    resultado = { recurso: 'dispositivoNotificacao', id, statusDispositivo: 'ativo', atualizado };
  });

  if (typeof registrarAuditoria === 'function') {
    await registrarAuditoria({ identidade, idRequisicao, acao: 'dispositivo_notificacao.registrar', tipoRecurso: 'dispositivoNotificacao', idRecurso: id });
  }
  return { corpo: resultado };
}

async function listarDispositivos({ identidade, limite = 20 }) {
  const snapshot = await caminhoRestaurante(identidade.idRestaurante)
    .collection(COLECAO_DISPOSITIVOS)
    .where('idUsuario', '==', identidade.idUsuario)
    .limit(Math.min(50, Math.max(1, Number(limite) || 20)))
    .get();
  return { dispositivos: snapshot.docs.map(dtoDispositivo) };
}

async function atualizarDispositivo({ identidade, corpo, idRequisicao, registrarAuditoria, podeGerenciar }) {
  const id = texto(corpo.id, 'idDispositivo', 40, 40);
  if (!ID_VALIDO.test(id)) throw new ApiError(400, 'ID_DISPOSITIVO_INVALIDO', 'Identificador do dispositivo inválido.');
  const acao = corpo.acao === 'revogar' ? 'revogar' : corpo.acao === 'reativar' ? 'reativar' : corpo.acao === 'preferencias' ? 'preferencias' : null;
  if (!acao) throw new ApiError(400, 'ACAO_DISPOSITIVO_INVALIDA', 'Ação de dispositivo inválida.');
  const referencia = referenciaDispositivo(identidade, id);
  let resultado;
  let repetido = false;
  await referencia.firestore.runTransaction(async transacao => {
    const documento = await transacao.get(referencia);
    if (!documento.exists) throw new ApiError(404, 'DISPOSITIVO_NAO_ENCONTRADO', 'Dispositivo não encontrado.');
    const dados = documento.data() || {};
    const podeAtualizar = podeGerenciar || dados.idUsuario === identidade.idUsuario;
    if (!podeAtualizar) throw new ApiError(403, 'DISPOSITIVO_FORA_DO_ESCOPO', 'Dispositivo fora do seu escopo.');
    const atualizacao = {
      atualizadoEm: FieldValue.serverTimestamp(),
      ...(acao === 'revogar' ? { statusDispositivo: 'revogado', revogadoEm: FieldValue.serverTimestamp() } : {}),
      ...(acao === 'reativar' ? { statusDispositivo: 'ativo', revogadoEm: null, ultimoUsoEm: FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + RETENCAO_DISPOSITIVO_MS) } : {}),
      ...(acao === 'preferencias' ? { preferencias: validarPreferencias(corpo.preferencias) } : {}),
    };
    transacao.update(referencia, atualizacao);
    resultado = { recurso: 'dispositivoNotificacao', id, acao, statusDispositivo: atualizacao.statusDispositivo || dados.statusDispositivo || 'ativo', atualizado: true };
  });
  if (!repetido && typeof registrarAuditoria === 'function') {
    await registrarAuditoria({ identidade, idRequisicao, acao: `dispositivo_notificacao.${acao}`, tipoRecurso: 'dispositivoNotificacao', idRecurso: id });
  }
  return { corpo: { ...resultado, idempotente: repetido } };
}

module.exports = Object.freeze({
  COLECAO_DISPOSITIVOS,
  PLATAFORMAS,
  ORIGENS,
  STATUS,
  hashToken,
  dtoDispositivo,
  registrarDispositivo,
  listarDispositivos,
  atualizarDispositivo,
});
