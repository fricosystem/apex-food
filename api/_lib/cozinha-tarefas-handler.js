'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./http');
const { caminhoRestaurante, exigirPapel, textoObrigatorio, textoOpcional, enumObrigatorio, registrarAuditoriaOperacional } = require('./modulos-operacionais');
const { criarNotificacoesNaTransacao, TIPOS_NOTIFICACAO } = require('./notificacoes');
const { enviarNotificacaoFcm } = require('./fcm-notificacoes');

const PAPEIS_COZINHA = ['proprietario', 'administrador', 'gerente', 'cozinha'];
const ESTADOS_TAREFA = new Set(['aguardando_preparo', 'em_preparo', 'pronto', 'cancelada']);
const TRANSICOES_TAREFA = Object.freeze({
  aguardando_preparo: new Set(['em_preparo', 'cancelada']),
  em_preparo: new Set(['pronto', 'cancelada']),
  pronto: new Set(),
  cancelada: new Set(),
});

function idSeguro(valor, campo) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  return valor;
}

function hashOperacao(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex').slice(0, 40);
}

function chaveIdempotencia(valor, fallback) {
  const chave = valor === undefined || valor === null || valor === '' ? fallback : valor;
  if (typeof chave !== 'string' || chave.trim().length < 8 || chave.trim().length > 200) throw new ApiError(400, 'CHAVE_IDEMPOTENCIA_INVALIDA', 'A chave de tarefa é obrigatória.');
  return chave.trim();
}

function cargaAtual(dados = {}) {
  const carga = dados.cargaAtual || {};
  return {
    mesasAtivas: Math.max(0, Number(carga.mesasAtivas || 0)),
    comandasAtivas: Math.max(0, Number(carga.comandasAtivas || 0)),
    pedidosPendentes: Math.max(0, Number(carga.pedidosPendentes || 0)),
    tarefasAtivas: Math.max(0, Number(carga.tarefasAtivas || 0)),
  };
}

function toIso(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  return new Date(valor).toISOString();
}

function tarefaPublica(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    idTarefa: dados.idTarefa || `${dados.idFicha || ''}:${documento.id}`,
    idProduto: dados.idProduto || '',
    nomeProduto: dados.nomeProduto || '',
    quantidade: Number(dados.quantidade || 0),
    observacoes: dados.observacoes || '',
    especialidadesNecessarias: Array.isArray(dados.especialidadesNecessarias) ? dados.especialidadesNecessarias : [],
    estacoesNecessarias: Array.isArray(dados.estacoesNecessarias) ? dados.estacoesNecessarias : [],
    statusTarefa: dados.statusTarefa || 'aguardando_preparo',
    idCozinheiroResponsavel: dados.idCozinheiroResponsavel || null,
    idUsuarioCozinheiroResponsavel: dados.idUsuarioCozinheiroResponsavel || null,
    nomeCozinheiroResponsavel: dados.nomeCozinheiroResponsavel || '',
    criadoEm: toIso(dados.criadoEm),
    atualizadoEm: toIso(dados.atualizadoEm),
  };
}

async function atualizarTarefaCozinha(identidade, corpo, idRequisicao) {
  exigirPapel(identidade, PAPEIS_COZINHA);
  const idFicha = idSeguro(String(corpo.idFicha || ''), 'idFicha');
  const idTarefa = idSeguro(String(corpo.idTarefa || ''), 'idTarefa');
  const para = enumObrigatorio(corpo.statusTarefa, ESTADOS_TAREFA, 'statusTarefa');
  const motivo = textoOpcional(corpo.motivo, 'motivo', 500);
  const chave = chaveIdempotencia(corpo.chaveIdempotencia, idRequisicao);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const fichaRef = restaurante.collection('fichasCozinha').doc(idFicha);
  const tarefaRef = fichaRef.collection('tarefas').doc(idTarefa);
  const idOperacao = hashOperacao(`${identidade.idRestaurante}:${identidade.idUsuario}:tarefa-cozinha:${idFicha}:${idTarefa}:${chave}`);
  const idempotenciaRef = restaurante.collection('chavesIdempotencia').doc(idOperacao);
  const hashPayload = hashOperacao(JSON.stringify({ idFicha, idTarefa, para, motivo }));
  const eSupervisor = identidade.papeis.some(papel => ['proprietario', 'administrador', 'gerente'].includes(papel));
  let resultado;
  let eventoFcm = null;
  let repeticaoIdempotente = false;

  await fichaRef.firestore.runTransaction(async transacao => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da tarefa já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      repeticaoIdempotente = true;
      return;
    }
    const [fichaDocumento, tarefaDocumento, tarefasDocumentos, pedidoDocumento] = await Promise.all([
      transacao.get(fichaRef),
      transacao.get(tarefaRef),
      transacao.get(fichaRef.collection('tarefas')),
      transacao.get(restaurante.collection('pedidos').doc(idFicha)),
    ]);
    if (!fichaDocumento.exists) throw new ApiError(404, 'FICHA_COZINHA_NAO_ENCONTRADA', 'Ficha de cozinha não encontrada.');
    if (!tarefaDocumento.exists) throw new ApiError(404, 'TAREFA_COZINHA_NAO_ENCONTRADA', 'Tarefa de cozinha não encontrada.');
    const ficha = fichaDocumento.data() || {};
    const tarefa = tarefaDocumento.data() || {};
    const de = tarefa.statusTarefa || 'aguardando_preparo';
    if (!TRANSICOES_TAREFA[de]?.has(para)) throw new ApiError(409, 'TRANSICAO_TAREFA_INVALIDA', `Não é permitido alterar a tarefa de ${de} para ${para}.`);
    const identificadores = [tarefa.idCozinheiroResponsavel, tarefa.idUsuarioCozinheiroResponsavel].filter(Boolean).map(String);
    if (!eSupervisor && (!identificadores.length || !identificadores.includes(String(identidade.idUsuario)))) throw new ApiError(403, 'TAREFA_FORA_DO_ESCOPO', 'Esta tarefa está atribuída a outro cozinheiro.');
    const pedido = pedidoDocumento.exists ? pedidoDocumento.data() || {} : {};
    const funcionarioRef = tarefa.idCozinheiroResponsavel ? restaurante.collection('funcionarios').doc(String(tarefa.idCozinheiroResponsavel)) : null;
    const mesaRef = pedido.idMesa ? restaurante.collection('mesas').doc(String(pedido.idMesa)) : null;
    const [funcionarioDocumento, mesaDocumento] = await Promise.all([
      funcionarioRef ? transacao.get(funcionarioRef) : Promise.resolve(null),
      mesaRef ? transacao.get(mesaRef) : Promise.resolve(null),
    ]);
    const tarefasAtuais = tarefasDocumentos.docs.map(tarefaPublica);
    const tarefasAtualizadas = tarefasAtuais.map(item => item.id === tarefaDocumento.id ? { ...item, statusTarefa: para } : item);
    const todasProntas = tarefasAtualizadas.length > 0 && tarefasAtualizadas.every(item => item.statusTarefa === 'pronto');
    const algumaEmPreparo = tarefasAtualizadas.some(item => item.statusTarefa === 'em_preparo');
    const statusFicha = todasProntas ? 'pronto' : algumaEmPreparo || para === 'pronto' ? 'em_preparo' : 'aguardando_preparo';
    const fichaAtualizacao = {
      statusFicha,
      statusDistribuicaoCozinha: ficha.statusDistribuicaoCozinha || 'atribuido',
      tarefas: tarefasAtualizadas,
      tarefasTotal: tarefasAtualizadas.length,
      tarefasAtribuidas: tarefasAtualizadas.filter(item => item.idCozinheiroResponsavel).length,
      tarefasAguardandoAtribuicao: tarefasAtualizadas.filter(item => !item.idCozinheiroResponsavel).length,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(ficha.versao || 1) + 1,
      ...(para === 'em_preparo' ? { iniciadoEm: FieldValue.serverTimestamp() } : {}),
      ...(todasProntas ? { prontoEm: FieldValue.serverTimestamp() } : {}),
      ...(para === 'cancelada' ? { canceladaEm: FieldValue.serverTimestamp(), motivoCancelamento: motivo } : {}),
    };
    transacao.update(tarefaRef, { statusTarefa: para, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(tarefa.versao || 1) + 1, ...(motivo ? { motivo } : {}) });
    transacao.update(fichaRef, fichaAtualizacao);
    if (tarefa.idCozinheiroResponsavel && funcionarioDocumento?.exists && ['pronto', 'cancelada'].includes(para)) {
      const funcionario = funcionarioDocumento.data() || {};
      const carga = cargaAtual(funcionario);
      const mesmoCozinheiroAtivo = tarefasAtualizadas.some(item => item.id !== tarefaDocumento.id && [item.idCozinheiroResponsavel, item.idUsuarioCozinheiroResponsavel].filter(Boolean).map(String).some(id => identificadores.includes(id)) && ['aguardando_preparo', 'em_preparo'].includes(item.statusTarefa));
      const novaCarga = { mesasAtivas: carga.mesasAtivas, comandasAtivas: Math.max(0, carga.comandasAtivas - (mesmoCozinheiroAtivo ? 0 : 1)), pedidosPendentes: Math.max(0, carga.pedidosPendentes - 1), tarefasAtivas: Math.max(0, carga.tarefasAtivas - 1) };
      transacao.update(funcionarioRef, { cargaAtual: novaCarga, disponibilidadeAtendimento: novaCarga.tarefasAtivas > 0 ? 'em_atendimento' : 'disponivel', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(funcionario.versao || 1) + 1 });
    }
    if (pedidoDocumento.exists) {
      const pedidoAtualizacao = { atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(pedido.versao || 1) + 1 };
      if (para === 'em_preparo' && ['enviado_cozinha', 'em_preparo'].includes(pedido.statusPedido || pedido.status)) {
        pedidoAtualizacao.statusPedido = 'em_preparo';
        pedidoAtualizacao.status = 'em_preparo';
        pedidoAtualizacao.inicioPreparoEm = FieldValue.serverTimestamp();
      }
      if (todasProntas && ['enviado_cozinha', 'em_preparo'].includes(pedido.statusPedido || pedido.status)) {
        pedidoAtualizacao.statusPedido = 'pronto';
        pedidoAtualizacao.status = 'pronto';
        pedidoAtualizacao.prontoEm = FieldValue.serverTimestamp();
      }
      if (para === 'cancelada') {
        pedidoAtualizacao.statusPedido = 'cancelado';
        pedidoAtualizacao.status = 'cancelado';
        pedidoAtualizacao.canceladoEm = FieldValue.serverTimestamp();
      }
      transacao.update(pedidoDocumento.ref, pedidoAtualizacao);
      if (todasProntas && mesaRef && mesaDocumento?.exists) {
        transacao.update(mesaRef, { estado: 'ocupada', estadoAtendimento: 'pedido_pronto', atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(mesaDocumento.data()?.versao || 1) + 1 });
      }
      if (todasProntas) {
        eventoFcm = { tipoNotificacao: TIPOS_NOTIFICACAO.pedidoPronto, titulo: `Pedido pronto — mesa ${String(pedido.nomeMesa || pedido.idMesa || '')}`, mensagem: 'Todos os itens da ficha foram concluídos e o pedido está pronto para o garçom servir.', prioridade: 'alta', eventoOrigem: `pedido:${pedidoDocumento.id}:tarefas:pronto`, idMesa: pedido.idMesa || null, idComanda: pedido.idComanda || null, idPedido: pedidoDocumento.id, idGarcomResponsavel: pedido.idGarcomResponsavel || null };
        criarNotificacoesNaTransacao(transacao, restaurante, eventoFcm);
      }
      transacao.set(pedidoDocumento.ref.collection('eventos').doc(), { idRestaurante: identidade.idRestaurante, idPedido: pedidoDocumento.id, idFicha, idTarefa, statusAnterior: de, statusNovo: para, idAtor: identidade.idUsuario, papelAtor: 'cozinha', motivo, criadoEm: FieldValue.serverTimestamp() });
    }
    transacao.set(tarefaRef.collection('historicoStatus').doc(), { idRestaurante: identidade.idRestaurante, idFicha, idTarefa, statusAnterior: de, statusNovo: para, idAtor: identidade.idUsuario, motivo, criadoEm: FieldValue.serverTimestamp() });
    resultado = { recurso: 'tarefaCozinha', idFicha, idTarefa, de, para, statusFicha, todasProntas, atualizado: true };
    transacao.create(idempotenciaRef, { idRestaurante: identidade.idRestaurante, idAtor: identidade.idUsuario, endpoint: '/api/v1/pedidos', tipoOperacao: 'tarefa_cozinha', idFicha, idTarefa, resultado, hashPayload, criadaEm: FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000), versao: 1 });
  });
  if (!repeticaoIdempotente) {
    await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `cozinha.tarefa.${para}`, tipoRecurso: 'tarefaCozinha', idRecurso: idTarefa });
    if (eventoFcm) await enviarNotificacaoFcm({ idRestaurante: identidade.idRestaurante, evento: eventoFcm });
  }
  return { corpo: { ...resultado, idempotente: repeticaoIdempotente } };
}

module.exports = { atualizarTarefaCozinha, ESTADOS_TAREFA, TRANSICOES_TAREFA };
