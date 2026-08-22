'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');

const PAPEIS_NOTIFICACAO = Object.freeze(['diretor', 'proprietario', 'administrador', 'gerente', 'garcom', 'cozinha', 'caixa']);
const PERMISSOES_NOTIFICACAO = Object.freeze(['pedidos.operar', 'cozinha.operar', 'caixa.operar']);
const PERMISSAO_POR_DESTINO = Object.freeze({ garcom: 'pedidos.operar', cozinha: 'cozinha.operar', caixa: 'caixa.operar' });
const TIPOS_NOTIFICACAO = Object.freeze({
  novoPedidoGarcom: 'novo_pedido_garcom',
  pedidoEnviadoCozinha: 'pedido_enviado_cozinha',
  pedidoPronto: 'pedido_pronto',
  pedidoRejeitado: 'pedido_rejeitado',
  pedidoCancelado: 'pedido_cancelado',
  comandaEncaminhadaCaixa: 'comanda_encaminhada_caixa',
  comandaRecebidaCaixa: 'comanda_recebida_caixa',
  atendimentoEncerrado: 'atendimento_encerrado',
  falhaOperacional: 'falha_operacional',
});
const STATUS_NOTIFICACAO = Object.freeze(['nova', 'lida', 'arquivada']);
const PRIORIDADES_NOTIFICACAO = Object.freeze(['normal', 'alta', 'critica']);
const RETENCAO_MS = 30 * 24 * 60 * 60 * 1000;

function hash(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex').slice(0, 40);
}

function texto(valor, fallback = '', maximo = 240) {
  const resultado = String(valor ?? fallback).trim();
  return resultado.slice(0, maximo);
}

function destino(papelDestino, idUsuarioDestino = null) {
  return { papelDestino, idUsuarioDestino };
}

function destinatariosParaEvento(tipo, idGarcomResponsavel = null) {
  const gerencia = ['diretor', 'gerente', 'administrador', 'proprietario'];
  if (tipo === TIPOS_NOTIFICACAO.novoPedidoGarcom) return ['garcom', ...gerencia].map(papel => destino(papel));
  if (tipo === TIPOS_NOTIFICACAO.pedidoEnviadoCozinha) return ['cozinha', ...gerencia].map(papel => destino(papel));
  if (tipo === TIPOS_NOTIFICACAO.pedidoPronto) {
    const destinos = gerencia.map(papel => destino(papel));
    if (idGarcomResponsavel) destinos.unshift(destino('garcom', String(idGarcomResponsavel)));
    return destinos;
  }
  if ([TIPOS_NOTIFICACAO.pedidoRejeitado, TIPOS_NOTIFICACAO.pedidoCancelado].includes(tipo)) {
    const destinos = gerencia.map(papel => destino(papel));
    if (idGarcomResponsavel) destinos.unshift(destino('garcom', String(idGarcomResponsavel)));
    return destinos;
  }
  if (tipo === TIPOS_NOTIFICACAO.comandaEncaminhadaCaixa) return ['caixa', ...gerencia].map(papel => destino(papel));
  if (tipo === TIPOS_NOTIFICACAO.comandaRecebidaCaixa) return gerencia.map(papel => destino(papel));
  if (tipo === TIPOS_NOTIFICACAO.atendimentoEncerrado) {
    const destinos = gerencia.map(papel => destino(papel));
    if (idGarcomResponsavel) destinos.unshift(destino('garcom', String(idGarcomResponsavel)));
    return destinos;
  }
  return gerencia.map(papel => destino(papel));
}

function chaveNotificacao(eventoOrigem, papelDestino, idUsuarioDestino = null) {
  return hash(`${eventoOrigem}:${papelDestino}:${idUsuarioDestino || 'fila'}`);
}

function dadosNotificacao({ tipoNotificacao, titulo, mensagem, prioridade = 'normal', eventoOrigem, idMesa = null, idComanda = null, idPedido = null, idEncaminhamento = null, idUsuarioDestino = null, papelDestino, permissaoDestino = null }) {
  const agora = Date.now();
  return {
    tipoNotificacao,
    titulo: texto(titulo, 'Atualização operacional'),
    mensagem: texto(mensagem, 'Há uma atualização que exige conferência.'),
    prioridade: PRIORIDADES_NOTIFICACAO.includes(prioridade) ? prioridade : 'normal',
    papelDestino,
    idUsuarioDestino: idUsuarioDestino || null,
    permissaoDestino: PERMISSOES_NOTIFICACAO.includes(permissaoDestino) ? permissaoDestino : null,
    idMesa: idMesa ? String(idMesa) : null,
    idComanda: idComanda ? String(idComanda) : null,
    idPedido: idPedido ? String(idPedido) : null,
    idEncaminhamento: idEncaminhamento ? String(idEncaminhamento) : null,
    eventoOrigem: texto(eventoOrigem, 'evento-operacional', 180),
    statusNotificacao: 'nova',
    criadaEm: FieldValue.serverTimestamp(),
    lidaEm: null,
    arquivadaEm: null,
    atualizadaEm: FieldValue.serverTimestamp(),
    versao: 1,
    expiraEm: new Date(agora + RETENCAO_MS),
  };
}

function criarNotificacoesNaTransacao(transacao, restauranteRef, evento) {
  const destinos = destinatariosParaEvento(evento.tipoNotificacao, evento.idGarcomResponsavel);
  for (const destino of destinos) {
    const id = chaveNotificacao(evento.eventoOrigem, destino.papelDestino, destino.idUsuarioDestino);
    const referencia = restauranteRef.collection('notificacoes').doc(id);
    transacao.set(referencia, dadosNotificacao({ ...evento, ...destino, permissaoDestino: PERMISSAO_POR_DESTINO[destino.papelDestino] || null }), { merge: false });
  }
}

function dtoNotificacao(documento) {
  const dados = documento.data() || {};
  const paraIso = valor => {
    if (!valor) return null;
    if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'string') return valor;
    return null;
  };
  return {
    id: documento.id,
    tipoNotificacao: dados.tipoNotificacao || null,
    titulo: dados.titulo || '',
    mensagem: dados.mensagem || '',
    prioridade: dados.prioridade || 'normal',
    papelDestino: dados.papelDestino || null,
    idUsuarioDestino: dados.idUsuarioDestino || null,
    permissaoDestino: dados.permissaoDestino || null,
    idMesa: dados.idMesa || null,
    idComanda: dados.idComanda || null,
    idPedido: dados.idPedido || null,
    idEncaminhamento: dados.idEncaminhamento || null,
    eventoOrigem: dados.eventoOrigem || null,
    statusNotificacao: dados.statusNotificacao || 'nova',
    criadaEm: paraIso(dados.criadaEm),
    lidaEm: paraIso(dados.lidaEm),
    arquivadaEm: paraIso(dados.arquivadaEm),
    atualizadaEm: paraIso(dados.atualizadaEm),
    versao: Number(dados.versao || 1),
  };
}

function visivelParaIdentidade(dados, identidade) {
  if (!PAPEIS_NOTIFICACAO.includes(dados.papelDestino)) return false;
  const temPapel = Array.isArray(identidade.papeis) && identidade.papeis.includes(dados.papelDestino);
  const temPermissao = PERMISSOES_NOTIFICACAO.includes(dados.permissaoDestino) && Array.isArray(identidade.permissoes) && identidade.permissoes.includes(dados.permissaoDestino);
  if (!temPapel && !temPermissao) return false;
  if (dados.idUsuarioDestino && dados.idUsuarioDestino !== identidade.idUsuario) return false;
  const expiraEm = dados.expiraEm?.toDate ? dados.expiraEm.toDate().getTime() : new Date(dados.expiraEm || 0).getTime();
  return Number.isFinite(expiraEm) && expiraEm > Date.now();
}

module.exports = Object.freeze({
  PAPEIS_NOTIFICACAO,
  PERMISSOES_NOTIFICACAO,
  PERMISSAO_POR_DESTINO,
  TIPOS_NOTIFICACAO,
  STATUS_NOTIFICACAO,
  PRIORIDADES_NOTIFICACAO,
  chaveNotificacao,
  criarNotificacoesNaTransacao,
  dtoNotificacao,
  visivelParaIdentidade,
  destinatariosParaEvento,
});
