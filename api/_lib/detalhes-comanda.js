'use strict';

const { ApiError } = require('./http');
const { dtoDocumento, timestampParaIso } = require('./modulos-operacionais');

function timestamp(valor) {
  return timestampParaIso(valor);
}

function idValido(valor) {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(valor);
}

function pedidoDetalhado(documento) {
  const dados = dtoDocumento(documento);
  return {
    ...dados,
    statusPedido: dados.statusPedido || dados.status || 'novo',
    status: dados.statusPedido || dados.status || 'novo',
    itens: Array.isArray(dados.itens) ? dados.itens : Array.isArray(dados.itensResumo) ? dados.itensResumo : [],
    totalCentavos: Number(dados.totalCentavos || dados.valorCentavos || 0),
  };
}

function participanteDetalhado(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    nomeExibicao: String(dados.nomeExibicao || dados.nomeCompleto || 'Cliente'),
    estadoParticipante: String(dados.estadoParticipante || 'ativo'),
    entrouEm: timestamp(dados.entrouEm || dados.criadoEm),
    saiuEm: timestamp(dados.saiuEm),
  };
}

function fichaDetalhada(documento, tarefas) {
  const dados = dtoDocumento(documento);
  return {
    ...dados,
    statusFicha: dados.statusFicha || 'aguardando_preparo',
    statusDistribuicaoCozinha: dados.statusDistribuicaoCozinha || 'aguardando_atribuicao',
    tarefas: tarefas.map(tarefa => ({
      id: tarefa.id,
      idTarefa: tarefa.data()?.idTarefa || `${documento.id}:${tarefa.id}`,
      idProduto: tarefa.data()?.idProduto || '',
      nomeProduto: tarefa.data()?.nomeProduto || '',
      quantidade: Number(tarefa.data()?.quantidade || 0),
      observacoes: tarefa.data()?.observacoes || '',
      ingredientes: Array.isArray(tarefa.data()?.ingredientes) ? tarefa.data().ingredientes : [],
      ingredientesMantidos: Array.isArray(tarefa.data()?.ingredientesMantidos) ? tarefa.data().ingredientesMantidos : [],
      ingredientesRemovidos: Array.isArray(tarefa.data()?.ingredientesRemovidos) ? tarefa.data().ingredientesRemovidos : [],
      especialidadesNecessarias: Array.isArray(tarefa.data()?.especialidadesNecessarias) ? tarefa.data().especialidadesNecessarias : [],
      estacoesNecessarias: Array.isArray(tarefa.data()?.estacoesNecessarias) ? tarefa.data().estacoesNecessarias : [],
      statusTarefa: tarefa.data()?.statusTarefa || 'aguardando_preparo',
      idCozinheiroResponsavel: tarefa.data()?.idCozinheiroResponsavel || null,
      nomeCozinheiroResponsavel: tarefa.data()?.nomeCozinheiroResponsavel || '',
      criadoEm: timestamp(tarefa.data()?.criadoEm),
      atualizadoEm: timestamp(tarefa.data()?.atualizadoEm),
    })),
  };
}

async function lerDetalhesComanda({ restaurante, idComanda, transacao = null }) {
  if (!idValido(String(idComanda || ''))) throw new ApiError(400, 'ID_INVALIDO', 'idComanda inválido.');
  const comandaRef = restaurante.collection('comandas').doc(String(idComanda));
  const ler = referencia => transacao ? transacao.get(referencia) : referencia.get();
  const comandaDocumento = await ler(comandaRef);
  if (!comandaDocumento.exists || comandaDocumento.data()?.estado === 'excluido') throw new ApiError(404, 'COMANDA_NAO_ENCONTRADA', 'Comanda não encontrada.');
  const comanda = comandaDocumento.data() || {};
  const mesaRef = comanda.idMesa ? restaurante.collection('mesas').doc(String(comanda.idMesa)) : null;
  const pedidosQuery = restaurante.collection('pedidos').where('idComanda', '==', comandaRef.id).limit(300);
  const sessoesQuery = restaurante.collection('sessoesMesa').where('idComanda', '==', comandaRef.id).limit(300);
  const [mesaDocumento, pedidosDocumentos, participantesDocumentos, sessoesDocumentos, historicoDocumentos] = await Promise.all([
    mesaRef ? ler(mesaRef) : Promise.resolve(null),
    ler(pedidosQuery),
    ler(comandaRef.collection('participantes').limit(300)),
    ler(sessoesQuery),
    ler(comandaRef.collection('historicoStatus').orderBy('criadoEm', 'desc').limit(100)),
  ]);
  const pedidos = pedidosDocumentos.docs.filter(documento => documento.data()?.estado !== 'excluido').map(pedidoDetalhado);
  const fichas = [];
  for (const pedidoDocumento of pedidosDocumentos.docs.filter(documento => documento.data()?.estado !== 'excluido')) {
    const fichaRef = restaurante.collection('fichasCozinha').doc(pedidoDocumento.id);
    const fichaDocumento = await ler(fichaRef);
    if (!fichaDocumento.exists || fichaDocumento.data()?.estado === 'excluido') continue;
    const tarefasDocumentos = await ler(fichaRef.collection('tarefas').limit(100));
    fichas.push(fichaDetalhada(fichaDocumento, tarefasDocumentos.docs));
  }
  const historico = historicoDocumentos.docs.map(documento => {
    const dados = documento.data() || {};
    return { id: documento.id, statusAnterior: dados.statusAnterior || '', statusNovo: dados.statusNovo || dados.acao || '', motivo: dados.motivo || '', papelAtor: dados.papelAtor || dados.papelExecutor || '', criadoEm: timestamp(dados.criadoEm) };
  });
  const dadosComanda = dtoDocumento(comandaDocumento);
  return {
    id: comandaRef.id,
    comanda: { ...dadosComanda, statusComanda: dadosComanda.statusComanda || dadosComanda.status || 'aberta', totalCentavos: Number(dadosComanda.totalCentavos || dadosComanda.valorCentavos || 0) },
    mesa: mesaDocumento?.exists ? dtoDocumento(mesaDocumento) : null,
    pedidos,
    participantes: participantesDocumentos.docs.map(participanteDetalhado),
    sessoes: sessoesDocumentos.docs.map(documento => ({ id: documento.id, estadoSessao: documento.data()?.estadoSessao || '', expiraEm: timestamp(documento.data()?.expiraEm), encerradaEm: timestamp(documento.data()?.encerradaEm) })),
    fichas,
    historico,
    resumo: { quantidadePedidos: pedidos.length, quantidadeParticipantes: participantesDocumentos.docs.length, totalCentavos: Number(dadosComanda.totalCentavos || dadosComanda.valorCentavos || 0), pedidosPendentes: pedidos.filter(pedido => !['servido', 'rejeitado_garcom', 'cancelado', 'finalizado'].includes(pedido.status)).length },
  };
}

module.exports = { lerDetalhesComanda, pedidoDetalhado, participanteDetalhado, fichaDetalhada };
