'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./http');

const DISPONIBILIDADES_COZINHA = new Set(['disponivel', 'em_atendimento']);
const MAX_TAREFAS_POR_FICHA = 100;

function timestampMs(valor) {
  if (!valor) return 0;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  const numero = Number(valor);
  if (Number.isFinite(numero)) return numero;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function listaNormalizada(valor) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.map(item => String(item || '').trim().toLocaleLowerCase('pt-BR')).filter(Boolean))];
}

function cargaCozinheiro(dados = {}) {
  const carga = dados.cargaAtual || {};
  return {
    mesasAtivas: Math.max(0, Number(carga.mesasAtivas || 0)),
    comandasAtivas: Math.max(0, Number(carga.comandasAtivas || 0)),
    pedidosPendentes: Math.max(0, Number(carga.pedidosPendentes || 0)),
    tarefasAtivas: Math.max(0, Number(carga.tarefasAtivas || 0)),
  };
}

function capacidadesCozinheiro(dados = {}) {
  return {
    capacidadeTarefas: Math.max(1, Number(dados.capacidadeTarefas || dados.capacidadePedidos || 1)),
    capacidadePedidos: Math.max(1, Number(dados.capacidadePedidos || 1)),
    capacidadeComandas: Math.max(1, Number(dados.capacidadeComandas || 1)),
  };
}

function escalaCompativelCozinha(funcionarioId, escalasDocumentos = [], dataAtual, turnoAtual) {
  const escalas = escalasDocumentos.filter(documento => String(documento.data()?.funcionarioId || '') === String(funcionarioId));
  if (!escalas.length) return true;
  return escalas.some(documento => {
    const escala = documento.data() || {};
    return ['agendado', 'presente'].includes(escala.status) && (!dataAtual || escala.data === dataAtual) && (!turnoAtual || escala.turno === turnoAtual || escala.turno === 'Integral');
  });
}

function requisitoAtendido(requisitos, capacidades) {
  const disponiveis = new Set(listaNormalizada(capacidades));
  return listaNormalizada(requisitos).every(requisito => disponiveis.has(requisito));
}

function pontuacaoCozinheiro(carga, capacidades) {
  const ocupacaoTarefas = carga.tarefasAtivas / Math.max(1, capacidades.capacidadeTarefas);
  const ocupacaoPedidos = carga.pedidosPendentes / Math.max(1, capacidades.capacidadePedidos);
  const ocupacaoComandas = carga.comandasAtivas / Math.max(1, capacidades.capacidadeComandas);
  return (ocupacaoTarefas * 0.50) + (ocupacaoPedidos * 0.30) + (ocupacaoComandas * 0.20);
}

function compararCozinheiros(a, b) {
  if (a.pontuacao !== b.pontuacao) return a.pontuacao - b.pontuacao;
  if (a.prioridadeDistribuicao !== b.prioridadeDistribuicao) return a.prioridadeDistribuicao - b.prioridadeDistribuicao;
  if (a.ultimaAtribuicaoMs !== b.ultimaAtribuicaoMs) return a.ultimaAtribuicaoMs - b.ultimaAtribuicaoMs;
  return a.id.localeCompare(b.id, 'en');
}

function selecionarCozinheiroResponsavel({ funcionariosDocumentos = [], escalasDocumentos = [], tarefa, cargas = new Map(), dataAtual = '', turnoAtual = '' }) {
  const especialidades = tarefa?.especialidadesNecessarias || [];
  const estacoes = tarefa?.estacoesNecessarias || [];
  const candidatos = funcionariosDocumentos.map(documento => {
    const dados = documento.data() || {};
    const carga = cargas.get(documento.id) || cargaCozinheiro(dados);
    const capacidades = capacidadesCozinheiro(dados);
    return {
      id: documento.id,
      dados,
      nome: String(dados.nome || dados.nomeCompleto || documento.id),
      carga,
      capacidades,
      prioridadeDistribuicao: Math.max(0, Number(dados.prioridadeDistribuicao || 0)),
      ultimaAtribuicaoMs: timestampMs(dados.ultimaAtribuicaoEm),
      pontuacao: pontuacaoCozinheiro(carga, capacidades),
    };
  }).filter(candidato => {
    const dados = candidato.dados;
    if (dados.estado === 'excluido' || dados.status !== 'ativo' || dados.setor !== 'Cozinha' || dados.papelOperacional !== 'cozinha') return false;
    if (!DISPONIBILIDADES_COZINHA.has(dados.disponibilidadeAtendimento || 'disponivel')) return false;
    if (!escalaCompativelCozinha(candidato.id, escalasDocumentos, dataAtual, turnoAtual)) return false;
    if (!requisitoAtendido(especialidades, dados.especialidadesCozinha)) return false;
    if (!requisitoAtendido(estacoes, dados.estacoesCozinha)) return false;
    return candidato.carga.tarefasAtivas + 1 <= candidato.capacidades.capacidadeTarefas
      && candidato.carga.pedidosPendentes + 1 <= candidato.capacidades.capacidadePedidos
      && candidato.carga.comandasAtivas + 1 <= candidato.capacidades.capacidadeComandas;
  }).sort(compararCozinheiros);
  return candidatos[0] || null;
}

function tarefasDoPedido(pedido = {}) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : Array.isArray(pedido.itensResumo) ? pedido.itensResumo : [];
  if (!itens.length || itens.length > MAX_TAREFAS_POR_FICHA) throw new ApiError(409, 'ITENS_COZINHA_INVALIDOS', 'O pedido não possui itens válidos para a cozinha.');
  return itens.map((item, indice) => ({
    indice,
    idProduto: String(item.idProduto || ''),
    nomeProduto: String(item.nomeProduto || item.nome || item.idProduto || 'Produto'),
    quantidade: Math.max(1, Number(item.quantidade || 1)),
    observacoes: String(item.observacoes || ''),
    especialidadesNecessarias: Array.isArray(item.especialidadesNecessarias) ? item.especialidadesNecessarias : [],
    estacoesNecessarias: Array.isArray(item.estacoesNecessarias) ? item.estacoesNecessarias : [],
  }));
}

function distribuirTarefasCozinha({ transacao, restaurante, idRestaurante, fichaRef, pedido, funcionariosDocumentos = [], escalasDocumentos = [], idAtor, dataAtual = '', turnoAtual = '' }) {
  const tarefas = tarefasDoPedido(pedido);
  const cargas = new Map();
  const comandasContabilizadas = new Set();
  const atribuicoes = [];
  const eventos = [];
  for (const tarefa of tarefas) {
    const candidato = selecionarCozinheiroResponsavel({ funcionariosDocumentos, escalasDocumentos, tarefa, cargas, dataAtual, turnoAtual });
    if (!candidato) {
      atribuicoes.push({ ...tarefa, statusTarefa: 'aguardando_atribuicao', idCozinheiroResponsavel: null, idUsuarioCozinheiroResponsavel: null, nomeCozinheiroResponsavel: '' });
      continue;
    }
    const cargaAtual = cargas.get(candidato.id) || candidato.carga;
    const incrementoComanda = comandasContabilizadas.has(candidato.id) ? 0 : 1;
    comandasContabilizadas.add(candidato.id);
    const cargaNova = { ...cargaAtual, tarefasAtivas: cargaAtual.tarefasAtivas + 1, pedidosPendentes: cargaAtual.pedidosPendentes + 1, comandasAtivas: cargaAtual.comandasAtivas + incrementoComanda };
    cargas.set(candidato.id, cargaNova);
    atribuicoes.push({ ...tarefa, statusTarefa: 'aguardando_preparo', idCozinheiroResponsavel: candidato.id, idUsuarioCozinheiroResponsavel: candidato.dados.idUsuario ? String(candidato.dados.idUsuario) : null, nomeCozinheiroResponsavel: candidato.nome, pontuacaoDistribuicao: candidato.pontuacao });
    eventos.push({ idFuncionario: candidato.id, idUsuario: candidato.dados.idUsuario ? String(candidato.dados.idUsuario) : null, nomeFuncionario: candidato.nome, idTarefa: `${fichaRef.id}:${String(tarefa.indice + 1).padStart(3, '0')}`, pontuacaoDistribuicao: candidato.pontuacao, cargaAnterior: cargaAtual, cargaNova });
  }
  for (const [idFuncionario, carga] of cargas) {
    const documento = funcionariosDocumentos.find(item => item.id === idFuncionario);
    if (!documento) continue;
    transacao.update(documento.ref, { cargaAtual: carga, disponibilidadeAtendimento: 'em_atendimento', ultimaAtribuicaoEm: FieldValue.serverTimestamp(), atualizadoPor: idAtor, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(documento.data()?.versao || 1) + 1 });
  }
  atribuicoes.forEach(tarefa => {
    tarefa.id = String(tarefa.indice + 1).padStart(3, '0');
    tarefa.idTarefa = `${fichaRef.id}:${tarefa.id}`;
    const idTarefa = tarefa.idTarefa;
    const tarefaRef = fichaRef.collection('tarefas').doc(String(tarefa.indice + 1).padStart(3, '0'));
    transacao.set(tarefaRef, { idRestaurante, idTarefa, idFicha: fichaRef.id, idPedido: String(pedido.id || ''), idProduto: tarefa.idProduto, nomeProduto: tarefa.nomeProduto, quantidade: tarefa.quantidade, observacoes: tarefa.observacoes, especialidadesNecessarias: tarefa.especialidadesNecessarias, estacoesNecessarias: tarefa.estacoesNecessarias, statusTarefa: tarefa.statusTarefa, idCozinheiroResponsavel: tarefa.idCozinheiroResponsavel, idUsuarioCozinheiroResponsavel: tarefa.idUsuarioCozinheiroResponsavel, nomeCozinheiroResponsavel: tarefa.nomeCozinheiroResponsavel, pontuacaoDistribuicao: tarefa.pontuacaoDistribuicao || null, criadoPor: idAtor, atualizadoPor: idAtor, criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(), versao: 1 });
  });
  eventos.forEach(evento => transacao.set(restaurante.collection('eventosMesas').doc(), { idRestaurante, idPedido: String(pedido.id || ''), idFicha: fichaRef.id, acao: 'cozinheiro_atribuido', estadoNovo: 'atribuido', ...evento, idAtor, criadoEm: FieldValue.serverTimestamp() }));
  const tarefasAtribuidas = atribuicoes.filter(tarefa => tarefa.statusTarefa === 'aguardando_preparo').length;
  return { tarefas: atribuicoes, tarefasTotal: atribuicoes.length, tarefasAtribuidas, tarefasAguardandoAtribuicao: atribuicoes.length - tarefasAtribuidas, statusDistribuicaoCozinha: tarefasAtribuidas === atribuicoes.length ? 'atribuido' : 'aguardando_atribuicao' };
}

module.exports = { DISPONIBILIDADES_COZINHA, cargaCozinheiro, capacidadesCozinheiro, requisitoAtendido, pontuacaoCozinheiro, selecionarCozinheiroResponsavel, tarefasDoPedido, distribuirTarefasCozinha };
