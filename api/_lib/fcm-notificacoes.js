'use strict';

const { getMessaging } = require('firebase-admin/messaging');
const { FieldValue } = require('firebase-admin/firestore');
const { getFirebaseAdminApp } = require('../../backend/firebase/admin');
const { caminhoRestaurante } = require('./modulos-operacionais');

const LIMITE_TOKENS_ENVIO = 500;
const RETENCAO_DIAGNOSTICO_MS = 30 * 24 * 60 * 60 * 1000;
const ERROS_TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const ESTADOS_ENTREGA = new Set(['sem_teste', 'enviado', 'falhou', 'revogado', 'indisponivel']);

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

function resultadoPublico(dados) {
  const estado = ESTADOS_ENTREGA.has(dados.ultimoResultadoEntrega) ? dados.ultimoResultadoEntrega : 'sem_teste';
  return {
    ultimoResultadoEntrega: estado,
    ultimaEntregaEm: dados.ultimaEntregaEm || null,
    falhasConsecutivas: Math.max(0, Number(dados.falhasConsecutivas || 0)),
  };
}

function timestampIso(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  return typeof valor === 'string' ? valor : null;
}

function dtoRegistroEntrega(documento) {
  const dados = documento.data() || {};
  const estado = ESTADOS_ENTREGA.has(dados.estadoEntrega) ? dados.estadoEntrega : 'falhou';
  return {
    id: documento.id,
    tipoNotificacao: texto(dados.tipoNotificacao, 'evento-operacional'),
    eventoOrigem: texto(dados.eventoOrigem, 'evento-fcm', 180),
    estadoEntrega: estado,
    quantidadeTentativas: Math.max(0, Number(dados.quantidadeTentativas || 0)),
    quantidadeAceita: Math.max(0, Number(dados.quantidadeAceita || 0)),
    quantidadeFalha: Math.max(0, Number(dados.quantidadeFalha || 0)),
    quantidadeRevogada: Math.max(0, Number(dados.quantidadeRevogada || 0)),
    criadoEm: timestampIso(dados.criadoEm),
  };
}

async function listarRegistrosEntrega({ idRestaurante, limite = 30 }) {
  const snapshot = await caminhoRestaurante(idRestaurante)
    .collection('registrosEntregasNotificacao')
    .limit(Math.min(100, Math.max(1, Number(limite) || 30)))
    .get();
  return snapshot.docs.map(dtoRegistroEntrega).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
}

function atualizarDiagnostico(restauranteRef, candidatos, respostas) {
  const batch = restauranteRef.firestore.batch();
  const agora = FieldValue.serverTimestamp();
  let enviados = 0;
  let revogados = 0;
  let falhos = 0;
  respostas.forEach((resposta, indice) => {
    const documento = candidatos[indice];
    const dados = documento.data() || {};
    const codigo = resposta.error?.code || '';
    const invalido = ERROS_TOKEN_INVALIDO.has(codigo);
    const sucesso = resposta.success === true;
    const estado = sucesso ? 'enviado' : invalido ? 'revogado' : 'falhou';
    if (sucesso) enviados += 1;
    else if (invalido) revogados += 1;
    else falhos += 1;
    batch.update(documento.ref, {
      ultimoResultadoEntrega: estado,
      ultimaEntregaEm: agora,
      falhasConsecutivas: sucesso ? 0 : Number(dados.falhasConsecutivas || 0) + 1,
      atualizadoEm: agora,
      ...(invalido ? { statusDispositivo: 'revogado', revogadoEm: agora } : {}),
    });
  });
  return { batch, enviados, revogados, falhos };
}

async function registrarResumoEntrega(restauranteRef, idRestaurante, evento, resumo) {
  const estado = resumo.enviados > 0 ? 'enviado' : resumo.revogados > 0 && resumo.falhos === 0 ? 'revogado' : 'falhou';
  await restauranteRef.collection('registrosEntregasNotificacao').doc().set({
    idRestaurante,
    tipoNotificacao: texto(evento.tipoNotificacao, 'evento-operacional', 120),
    eventoOrigem: texto(evento.eventoOrigem, 'evento-fcm', 180),
    estadoEntrega: estado,
    quantidadeTentativas: resumo.tentados,
    quantidadeAceita: resumo.enviados,
    quantidadeFalha: resumo.falhos,
    quantidadeRevogada: resumo.revogados,
    criadoEm: FieldValue.serverTimestamp(),
    expiraEm: new Date(Date.now() + RETENCAO_DIAGNOSTICO_MS),
  });
}

async function enviarNotificacaoFcm({ idRestaurante, evento, idUsuario = null, idDispositivo = null, somenteSistema = false }) {
  if (!idRestaurante || !evento?.tipoNotificacao) return { tentados: 0, enviados: 0, revogados: 0, falhos: 0, indisponivel: true };
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
    if (!candidatos.length) return { tentados: 0, enviados: 0, revogados: 0, falhos: 0, indisponivel: false };
    const app = getFirebaseAdminApp();
    const resposta = await getMessaging(app).sendEachForMulticast({
      ...mensagemFcm(evento),
      tokens: candidatos.map(documento => documento.data().tokenFcm),
    });
    const diagnostico = atualizarDiagnostico(restauranteRef, candidatos, resposta.responses);
    await diagnostico.batch.commit();
    const resumo = {
      tentados: candidatos.length,
      enviados: diagnostico.enviados,
      revogados: diagnostico.revogados,
      falhos: diagnostico.falhos,
    };
    await registrarResumoEntrega(restauranteRef, idRestaurante, evento, resumo);
    return { ...resumo, indisponivel: false };
  } catch {
    return { tentados: 0, enviados: 0, revogados: 0, falhos: 0, indisponivel: true };
  }
}

module.exports = Object.freeze({
  enviarNotificacaoFcm,
  mensagemFcm,
  resultadoPublico,
  dtoRegistroEntrega,
  listarRegistrosEntrega,
  ESTADOS_ENTREGA,
  ERROS_TOKEN_INVALIDO,
  LIMITE_TOKENS_ENVIO,
});
