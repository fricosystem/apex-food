'use strict';

const { getMessaging } = require('firebase-admin/messaging');
const { FieldValue } = require('firebase-admin/firestore');
const { getFirebaseAdminApp } = require('../../backend/firebase/admin');
const { caminhoRestaurante } = require('./modulos-operacionais');

const LIMITE_TOKENS_ENVIO = 500;
const ERROS_TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function texto(valor, fallback = '') {
  return String(valor ?? fallback).trim().slice(0, 240);
}

function valorDados(valor) {
  return valor === undefined || valor === null ? '' : String(valor);
}

function expirada(valor) {
  if (!valor) return false;
  const timestamp = valor.toDate ? valor.toDate().getTime() : new Date(valor).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function mensagemFcm(evento) {
  const dados = {
    tipoNotificacao: valorDados(evento.tipoNotificacao),
    idNotificacao: valorDados(evento.idNotificacao),
    idMesa: valorDados(evento.idMesa),
    idComanda: valorDados(evento.idComanda),
    idPedido: valorDados(evento.idPedido),
    idEncaminhamento: valorDados(evento.idEncaminhamento),
    titulo: texto(evento.titulo, 'Atualização operacional'),
    mensagem: texto(evento.mensagem, 'Há uma atualização operacional.'),
    url: '/',
  };
  return {
    notification: {
      title: dados.titulo,
      body: dados.mensagem,
    },
    data: dados,
    webpush: {
      fcmOptions: { link: '/' },
      notification: {
        icon: '/assets/apex-food-logo-aprimorada.png',
        badge: '/assets/apex-food-logo-aprimorada.png',
        tag: `apex-food-real-${dados.idNotificacao || dados.tipoNotificacao || Date.now()}`,
      },
    },
  };
}

async function revogarTokensInvalidos(restauranteRef, documentos) {
  if (!documentos.length) return 0;
  const batch = restauranteRef.firestore.batch();
  let quantidade = 0;
  for (const documento of documentos) {
    batch.update(documento.ref, {
      statusDispositivo: 'revogado',
      revogadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    quantidade += 1;
  }
  if (quantidade) await batch.commit();
  return quantidade;
}

async function enviarNotificacaoFcm({ idRestaurante, evento, idUsuario = null, idDispositivo = null, somenteSistema = false }) {
  if (!idRestaurante || !evento?.tipoNotificacao) return { tentados: 0, enviados: 0, revogados: 0, indisponivel: true };
  try {
    const restauranteRef = caminhoRestaurante(idRestaurante);
    const snapshot = await restauranteRef.collection('dispositivosNotificacao')
      .where('statusDispositivo', '==', 'ativo')
      .limit(LIMITE_TOKENS_ENVIO)
      .get();
    const candidatos = snapshot.docs.filter(documento => {
      const dados = documento.data() || {};
      return Boolean(dados.tokenFcm)
        && (!idUsuario || dados.idUsuario === idUsuario)
        && (!idDispositivo || documento.id === idDispositivo)
        && !expirada(dados.expiraEm)
        && dados.preferencias?.[somenteSistema ? 'sistema' : 'operacionais'] !== false;
    });
    if (!candidatos.length) return { tentados: 0, enviados: 0, revogados: 0, indisponivel: false };
    const app = getFirebaseAdminApp();
    const resposta = await getMessaging(app).sendEachForMulticast({
      ...mensagemFcm(evento),
      tokens: candidatos.map(documento => documento.data().tokenFcm),
    });
    const invalidos = [];
    resposta.responses.forEach((item, indice) => {
      const codigo = item.error?.code || '';
      if (ERROS_TOKEN_INVALIDO.has(codigo)) invalidos.push(candidatos[indice]);
    });
    const revogados = await revogarTokensInvalidos(restauranteRef, invalidos);
    return {
      tentados: candidatos.length,
      enviados: resposta.successCount || 0,
      revogados,
      indisponivel: false,
    };
  } catch {
    return { tentados: 0, enviados: 0, revogados: 0, indisponivel: true };
  }
}

module.exports = Object.freeze({
  enviarNotificacaoFcm,
  mensagemFcm,
  ERROS_TOKEN_INVALIDO,
  LIMITE_TOKENS_ENVIO,

});
