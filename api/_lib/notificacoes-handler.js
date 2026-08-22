'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  obterIdentidadeOperacional,
  caminhoRestaurante,
  limitarInteiro,
  queryString,
  enumObrigatorio,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');
const { exigirPapel } = require('./autorizacao');
const { consumir } = require('./limite');
const {
  PAPEIS_NOTIFICACAO,
  STATUS_NOTIFICACAO,
  dtoNotificacao,
  visivelParaIdentidade,
} = require('./notificacoes');
const {
  registrarDispositivo,
  listarDispositivos,
  atualizarDispositivo,
} = require('./dispositivos-notificacao');
const { enviarNotificacaoFcm, listarRegistrosEntrega } = require('./fcm-notificacoes');

const PAPEIS_GESTAO = ['diretor', 'proprietario', 'administrador', 'gerente'];
const PAPEIS_NOTIFICACOES_LEITURA = [...new Set([...PAPEIS_LEITURA, 'caixa'])];
const ID_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !ID_VALIDO.test(valor)) throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  return valor;
}

function chaveIdempotencia(valor, fallback) {
  const chave = valor || fallback;
  if (typeof chave !== 'string' || chave.trim().length < 8 || chave.trim().length > 200) {
    throw new ApiError(400, 'CHAVE_IDEMPOTENCIA_INVALIDA', 'A chave de idempotência é obrigatória.');
  }
  return chave.trim();
}

function possuiPermissao(identidade, permissao) {
  return Array.isArray(identidade.permissoes) && identidade.permissoes.includes(permissao);
}

function ehGestao(identidade) {
  return identidade.papeis.some(papel => PAPEIS_GESTAO.includes(papel));
}

function papeisVisiveis(identidade, papelSolicitado) {
  if (ehGestao(identidade) && !papelSolicitado) return [...PAPEIS_NOTIFICACAO];
  if (papelSolicitado) {
    if (!PAPEIS_NOTIFICACAO.includes(papelSolicitado)) throw new ApiError(400, 'PAPEL_INVALIDO', 'Papel de notificação inválido.');
    const permissaoDestino = papelSolicitado === 'garcom' ? 'pedidos.operar' : papelSolicitado === 'cozinha' ? 'cozinha.operar' : papelSolicitado === 'caixa' ? 'caixa.operar' : null;
    if (!identidade.papeis.includes(papelSolicitado) && !ehGestao(identidade) && !(permissaoDestino && possuiPermissao(identidade, permissaoDestino))) {
      throw new ApiError(403, 'PAPEL_INSUFICIENTE', 'Você não pode consultar esta fila de notificações.');
    }
    return [papelSolicitado];
  }
  const papeis = new Set(identidade.papeis.filter(papel => PAPEIS_NOTIFICACAO.includes(papel)));
  if (possuiPermissao(identidade, 'pedidos.operar')) papeis.add('garcom');
  if (possuiPermissao(identidade, 'cozinha.operar')) papeis.add('cozinha');
  if (possuiPermissao(identidade, 'caixa.operar')) papeis.add('caixa');
  if (papeis.size) return [...papeis];
  exigirPapel(identidade, PAPEIS_NOTIFICACOES_LEITURA);
  return [];
}

async function consultarPorPapel(restaurante, papel, limite) {
  const snapshot = await restaurante.collection('notificacoes').where('papelDestino', '==', papel).limit(Math.min(300, Math.max(50, limite * 3))).get();
  return snapshot.docs;
}

function podeAtualizar(identidade, dados) {
  if (ehGestao(identidade)) return true;
  const permissaoDestino = dados.permissaoDestino || (dados.papelDestino === 'garcom' ? 'pedidos.operar' : dados.papelDestino === 'cozinha' ? 'cozinha.operar' : dados.papelDestino === 'caixa' ? 'caixa.operar' : null);
  const possuiDestino = PAPEIS_NOTIFICACAO.includes(dados.papelDestino) && identidade.papeis.includes(dados.papelDestino);
  if (!possuiDestino && !(permissaoDestino && possuiPermissao(identidade, permissaoDestino))) return false;
  return !dados.idUsuarioDestino || dados.idUsuarioDestino === identidade.idUsuario;
}

function expirada(dados) {
  const valor = dados.expiraEm?.toDate ? dados.expiraEm.toDate().getTime() : new Date(dados.expiraEm || 0).getTime();
  return Number.isFinite(valor) && valor <= Date.now();
}

async function listarNotificacoes(identidade, req) {
  const limite = limitarInteiro(req.query?.limite, 40, 100);
  const statusSolicitado = queryString(req, 'status');
  const statusPermitidos = statusSolicitado ? statusSolicitado.split(',').map(valor => valor.trim()).filter(Boolean) : ['nova', 'lida'];
  for (const status of statusPermitidos) enumObrigatorio(status, new Set(STATUS_NOTIFICACAO), 'status');
  const papeis = papeisVisiveis(identidade, queryString(req, 'papel') || null);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const documentosPorPapel = await Promise.all(papeis.map(papel => consultarPorPapel(restaurante, papel, limite)));
  const documentos = documentosPorPapel.flat();
  const unicos = new Map(documentos.map(documento => [documento.id, documento]));
  const notificacoes = Array.from(unicos.values())
    .filter(documento => {
      const dados = documento.data() || {};
      const gestao = ehGestao(identidade);
      const visivel = gestao
        ? PAPEIS_NOTIFICACAO.includes(dados.papelDestino)
        : visivelParaIdentidade(dados, identidade);
      return visivel && !expirada(dados) && statusPermitidos.includes(dados.statusNotificacao || 'nova');
    })
    .sort((a, b) => {
      const valorA = a.data()?.criadaEm?.toDate ? a.data().criadaEm.toDate().getTime() : 0;
      const valorB = b.data()?.criadaEm?.toDate ? b.data().criadaEm.toDate().getTime() : 0;
      return valorB - valorA;
    })
    .slice(0, limite)
    .map(dtoNotificacao);
  return {
    corpo: {
      notificacoes,
      naoLidas: notificacoes.filter(item => item.statusNotificacao === 'nova').length,
      meta: { limite, status: statusPermitidos, papeis, idRestaurante: identidade.idRestaurante },
    },
  };
}

async function listarDiagnosticoEntrega(identidade, req) {
  exigirPapel(identidade, PAPEIS_GESTAO);
  const limite = limitarInteiro(req.query?.limite, 30, 100);
  return { corpo: { registros: await listarRegistrosEntrega({ idRestaurante: identidade.idRestaurante, limite }) } };
}

async function testarDispositivo(identidade, corpo, idRequisicao) {
  const idDispositivo = corpo.id ? idDocumento(corpo.id, 'idDispositivo') : null;
  const resultado = await enviarNotificacaoFcm({
    idRestaurante: identidade.idRestaurante,
    idUsuario: identidade.idUsuario,
    idDispositivo,
    somenteSistema: true,
    evento: {
      tipoNotificacao: 'teste_dispositivo',
      titulo: 'APEX Food — teste de dispositivo',
      mensagem: 'Este dispositivo está autorizado a receber notificações do sistema.',
      idNotificacao: `teste:${identidade.idUsuario}:${idDispositivo || 'todos'}`,
    },
  });
  if (resultado.indisponivel) throw new ApiError(503, 'FCM_INDISPONIVEL', 'O serviço de notificações está temporariamente indisponível.');
  if (!resultado.tentados) throw new ApiError(409, 'DISPOSITIVO_SEM_NOTIFICACAO', 'Nenhum dispositivo ativo está pronto para receber o teste.');
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'dispositivo_notificacao.teste', tipoRecurso: 'dispositivoNotificacao', idRecurso: idDispositivo, resultado: resultado.enviados ? 'sucesso' : 'falha' });
  return { corpo: { recurso: 'dispositivoNotificacao', teste: true, ...resultado } };
}

async function operarDispositivos(identidade, req, metodo, idRequisicao) {
  if (metodo === 'GET' && req.query?.recurso === 'entregas') return listarDiagnosticoEntrega(identidade, req);
  if (metodo !== 'GET') await consumir(req, 'notificacoes_dispositivo', 30, 60 * 1000);
  if (metodo === 'GET') {
    const limite = limitarInteiro(req.query?.limite, 20, 50);
    return { corpo: await listarDispositivos({ identidade, limite }) };
  }
  const corpo = await lerCorpoJson(req);
  if (metodo === 'POST' && corpo.acao === 'teste') return testarDispositivo(identidade, corpo, idRequisicao);
  if (metodo === 'POST') {
    return registrarDispositivo({
      identidade,
      corpo,
      idRequisicao,
      registrarAuditoria: registrarAuditoriaOperacional,
    });
  }
  return atualizarDispositivo({
    identidade,
    corpo,
    idRequisicao,
    podeGerenciar: ehGestao(identidade),
    registrarAuditoria: registrarAuditoriaOperacional,
  });
}

async function atualizarNotificacao(identidade, req, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'idNotificacao');
  const acao = corpo.acao === 'arquivar' ? 'arquivar' : corpo.acao === 'marcar_lida' ? 'marcar_lida' : null;
  if (!acao) throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de notificação inválida.');
  const chave = chaveIdempotencia(corpo.chaveIdempotencia, idRequisicao);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('notificacoes').doc(id);
  const hashPayload = require('node:crypto').createHash('sha256').update(JSON.stringify({ id, acao })).digest('hex').slice(0, 40);
  const idOperacao = require('node:crypto').createHash('sha256').update(`${identidade.idRestaurante}:${identidade.idUsuario}:notificacao:${id}:${chave}`).digest('hex').slice(0, 40);
  const idempotenciaRef = restaurante.collection('chavesIdempotencia').doc(idOperacao);
  let resultado;
  let repetido = false;
  await referencia.firestore.runTransaction(async transacao => {
    const [idempotenciaDocumento, documento] = await Promise.all([transacao.get(idempotenciaRef), transacao.get(referencia)]);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da notificação já foi usada com outra ação.');
      resultado = anterior.resultado;
      repetido = true;
      return;
    }
    if (!documento.exists) throw new ApiError(404, 'NOTIFICACAO_NAO_ENCONTRADA', 'Notificação não encontrada.');
    const dados = documento.data() || {};
    if (!podeAtualizar(identidade, dados)) throw new ApiError(403, 'NOTIFICACAO_FORA_DO_ESCOPO', 'Notificação fora do seu escopo operacional.');
    const statusAtual = dados.statusNotificacao || 'nova';
    if (acao === 'marcar_lida' && statusAtual === 'arquivada') throw new ApiError(409, 'NOTIFICACAO_ARQUIVADA', 'A notificação já foi arquivada.');
    const novoStatus = acao === 'arquivar' ? 'arquivada' : 'lida';
    const atualizacao = {
      statusNotificacao: novoStatus,
      atualizadaEm: FieldValue.serverTimestamp(),
      versao: Number(dados.versao || 1) + 1,
      ...(acao === 'marcar_lida' ? { lidaEm: FieldValue.serverTimestamp() } : { arquivadaEm: FieldValue.serverTimestamp(), lidaEm: dados.lidaEm || FieldValue.serverTimestamp() }),
    };
    transacao.update(referencia, atualizacao);
    resultado = { recurso: 'notificacao', id, acao, statusNotificacao: novoStatus, atualizado: true };
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/operacional',
      tipoOperacao: `notificacao.${acao}`,
      idNotificacao: id,
      resultado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  if (!repetido) await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `notificacoes.${acao}`, tipoRecurso: 'notificacao', idRecurso: id });
  return { corpo: { ...resultado, idempotente: repetido } };
}

module.exports = async function notificacoes(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH'].includes(metodo);
  const recurso = queryString(req, 'recurso');
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    const identidade = await obterIdentidadeOperacional(req, PAPEIS_NOTIFICACOES_LEITURA, ['notificacoes.visualizar', 'pedidos.visualizar', 'pedidos.operar', 'cozinha.operar', 'caixa.operar']);
    if (recurso === 'dispositivos') return operarDispositivos(identidade, req, metodo, idRequisicao);
    if (metodo === 'GET') return listarNotificacoes(identidade, req);
    const corpo = await lerCorpoJson(req);
    return atualizarNotificacao(identidade, req, corpo, idRequisicao);
  });
};
