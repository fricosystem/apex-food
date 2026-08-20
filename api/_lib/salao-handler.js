'use strict';

const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  PAPEIS_SALAO,
  ESTADOS_RESERVA,
  ESTADOS_MESA,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroPositivo,
  dtoDocumento,
  dtoReserva,
  listarColecao,
  queryString,
  mascararContato,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const RECURSOS_LEITURA = new Set(['mesas', 'reservas', 'configuracao']);
const RECURSOS_ESCRITA = new Set(['reserva', 'mesa']);
const TRANSICOES_RESERVA = {
  aguardando: new Set(['aguardando', 'confirmada', 'cancelada']),
  confirmada: new Set(['confirmada', 'chegou', 'cancelada']),
  chegou: new Set(['chegou', 'cancelada']),
  cancelada: new Set(['cancelada', 'confirmada']),
};

function normalizarRecurso(valor) {
  if (valor === 'configuracaoSalao') return 'configuracao';
  return valor;
}

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function dataValida(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim()) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é obrigatório.`);
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  return data;
}

function dtoSalao(documento) {
  const dto = dtoDocumento(documento);
  delete dto.nomeNormalizado;
  return dto;
}

function listarDto(recurso, documentos) {
  return documentos
    .filter((documento) => {
      const dados = documento.data() || {};
      return dados.estado !== 'excluido' && !dados.excluidoEm;
    })
    .map(recurso === 'reservas' ? dtoReserva : dtoSalao);
}

async function listarSalao(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (recurso && !RECURSOS_LEITURA.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de salão inválido.');
  const limite = limitarInteiro(req.query?.limite, 200, 300);
  const colecoes = recurso ? [recurso] : ['mesas', 'reservas', 'configuracao'];
  const documentos = await Promise.all(colecoes.map((item) => listarColecao(identidade.idRestaurante, item === 'configuracao' ? 'configuracaoSalao' : item, limite)));
  const resposta = { mesas: [], reservas: [], configuracao: [] };
  colecoes.forEach((item, indice) => {
    resposta[item] = listarDto(item, documentos[indice]);
  });
  return { corpo: { ...resposta, meta: { idRestaurante: identidade.idRestaurante, limite } } };
}

async function validarMesa(identidade, corpo) {
  if (corpo.idMesa === null || corpo.idMesa === undefined || corpo.idMesa === '') return null;
  return idDocumento(String(corpo.idMesa), 'idMesa');
}

function validarMesaDados(corpo, parcial = false) {
  const dados = {};
  if (!parcial || corpo.nome !== undefined) dados.nome = textoObrigatorio(corpo.nome, 'nome', 120);
  if (!parcial || corpo.capacidade !== undefined) dados.capacidade = inteiroPositivo(corpo.capacidade, 'capacidade', 1000);
  if (!parcial || corpo.area !== undefined) dados.area = textoOpcional(corpo.area, 'area', 80);
  if (!parcial || corpo.observacoes !== undefined) dados.observacoes = textoOpcional(corpo.observacoes, 'observacoes', 500);
  if (!parcial || corpo.estado !== undefined) {
    const estado = corpo.estado === undefined ? 'disponivel' : corpo.estado;
    if (!ESTADOS_MESA.has(estado)) throw new ApiError(400, 'ESTADO_INVALIDO', 'Estado da mesa inválido.');
    dados.estado = estado;
  }
  return dados;
}

function nomeMesaNormalizado(nome) {
  return nome.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function validarReserva(corpo) {
  const inicio = dataValida(corpo.inicioEm, 'inicioEm');
  const fim = dataValida(corpo.fimEm, 'fimEm');
  if (fim <= inicio) throw new ApiError(400, 'HORARIO_INVALIDO', 'fimEm deve ser posterior a inicioEm.');
  const quantidadePessoas = inteiroPositivo(corpo.quantidadePessoas, 'quantidadePessoas', 1000);
  const estado = corpo.estado === undefined ? 'confirmada' : corpo.estado;
  if (!ESTADOS_RESERVA.has(estado) || estado === 'cancelada') throw new ApiError(400, 'ESTADO_INVALIDO', 'Estado inicial da reserva inválido.');
  return {
    nomeCliente: textoObrigatorio(corpo.nomeCliente || corpo.cliente, 'nomeCliente', 160),
    contatoClienteMascarado: mascararContato(textoOpcional(corpo.contatoCliente, 'contatoCliente', 160)),
    inicio,
    fim,
    quantidadePessoas,
    estado,
    canal: textoOpcional(corpo.canal, 'canal', 40) || 'interno',
    observacoes: textoOpcional(corpo.observacoes, 'observacoes', 1000),
  };
}

function sobrepoe(inicio, fim, outraInicio, outraFim) {
  return inicio < outraFim && fim > outraInicio;
}

async function criarReserva(identidade, corpo, idRequisicao) {
  const idMesa = await validarMesa(identidade, corpo);
  const dados = validarReserva(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('reservas').doc();
  const db = referencia.firestore;
  await db.runTransaction(async (transacao) => {
    let mesaDocumento = null;
    if (idMesa) {
      mesaDocumento = await transacao.get(restaurante.collection('mesas').doc(idMesa));
      if (!mesaDocumento.exists || mesaDocumento.data()?.estado === 'excluido') throw new ApiError(400, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
      const capacidade = Number(mesaDocumento.data()?.capacidade || 0);
      if (!Number.isInteger(capacidade) || capacidade < dados.quantidadePessoas) throw new ApiError(409, 'CAPACIDADE_INSUFICIENTE', 'A capacidade da mesa é insuficiente.');
      if (mesaDocumento.data()?.estado === 'indisponivel') throw new ApiError(409, 'MESA_INDISPONIVEL', 'A mesa está indisponível.');
    }
    let consulta = restaurante.collection('reservas');
    if (idMesa) consulta = consulta.where('idMesa', '==', idMesa);
    const existentes = await transacao.get(consulta);
    for (const documento of existentes.docs) {
      const reserva = documento.data() || {};
      if (reserva.estado === 'cancelada' || reserva.estado === 'concluida') continue;
      const inicioExistente = reserva.inicioEm?.toDate ? reserva.inicioEm.toDate() : new Date(reserva.inicioEm);
      const fimExistente = reserva.fimEm?.toDate ? reserva.fimEm.toDate() : new Date(reserva.fimEm);
      if (!Number.isNaN(inicioExistente.getTime()) && !Number.isNaN(fimExistente.getTime()) && sobrepoe(dados.inicio, dados.fim, inicioExistente, fimExistente)) {
        throw new ApiError(409, 'RESERVA_EM_CONFLITO', 'Já existe uma reserva no horário informado.');
      }
    }
    transacao.set(referencia, {
      idRestaurante: identidade.idRestaurante,
      idMesa,
      nomeCliente: dados.nomeCliente,
      contatoClienteMascarado: dados.contatoClienteMascarado,
      inicioEm: Timestamp.fromDate(dados.inicio),
      fimEm: Timestamp.fromDate(dados.fim),
      quantidadePessoas: dados.quantidadePessoas,
      estado: dados.estado,
      canal: dados.canal,
      observacoes: dados.observacoes,
      versao: 1,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'salao.reserva.criada', tipoRecurso: 'reserva', idRecurso: referencia.id });
  return { status: 201, corpo: { recurso: 'reserva', id: referencia.id, criado: true } };
}

async function criarMesa(identidade, corpo, idRequisicao) {
  const dados = validarMesaDados(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('mesas').doc();
  await referencia.firestore.runTransaction(async (transacao) => {
    const existentes = await transacao.get(restaurante.collection('mesas').where('nomeNormalizado', '==', nomeMesaNormalizado(dados.nome)));
    if (existentes.docs.some((documento) => documento.data()?.estado !== 'excluido')) {
      throw new ApiError(409, 'MESA_DUPLICADA', 'Já existe uma mesa com esse nome.');
    }
    transacao.set(referencia, {
      idRestaurante: identidade.idRestaurante,
      nome: dados.nome,
      nomeNormalizado: nomeMesaNormalizado(dados.nome),
      capacidade: dados.capacidade,
      area: dados.area,
      estado: dados.estado,
      observacoes: dados.observacoes,
      versao: 1,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'salao.mesa.criada', tipoRecurso: 'mesa', idRecurso: referencia.id });
  return { status: 201, corpo: { recurso: 'mesa', id: referencia.id, criado: true } };
}

async function atualizarReserva(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const estado = corpo.estado;
  if (typeof estado !== 'string' || !ESTADOS_RESERVA.has(estado)) throw new ApiError(400, 'ESTADO_INVALIDO', 'Estado da reserva inválido.');
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('reservas').doc(id);
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'RESERVA_NAO_ENCONTRADA', 'Reserva não encontrada.');
    const estadoAtual = documento.data()?.estado || 'aguardando';
    if (!TRANSICOES_RESERVA[estadoAtual]?.has(estado)) throw new ApiError(409, 'TRANSICAO_INVALIDA', 'A mudança de estado da reserva não é permitida.');
    transacao.update(referencia, {
      estado,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(documento.data()?.versao || 1) + 1,
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'salao.reserva.estadoAlterado', tipoRecurso: 'reserva', idRecurso: id });
  return { corpo: { recurso: 'reserva', id, atualizado: true } };
}

async function atualizarMesa(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const dados = validarMesaDados(corpo, true);
  if (!Object.keys(dados).length) throw new ApiError(400, 'PAYLOAD_INVALIDO', 'Nenhuma alteração de mesa foi informada.');
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('mesas').doc(id);
  let eventoEstado = null;
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    const atual = documento.data() || {};
    if (dados.nome && dados.nome !== atual.nome) {
      const existentes = await transacao.get(referencia.parent.where('nomeNormalizado', '==', nomeMesaNormalizado(dados.nome)));
      if (existentes.docs.some((item) => item.id !== id && item.data()?.estado !== 'excluido')) throw new ApiError(409, 'MESA_DUPLICADA', 'Já existe uma mesa com esse nome.');
      dados.nomeNormalizado = nomeMesaNormalizado(dados.nome);
    }
    const atualizacoes = { ...dados, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(atual.versao || 1) + 1 };
    if (dados.estado && dados.estado !== atual.estado) eventoEstado = { anterior: atual.estado || null, novo: dados.estado };
    transacao.update(referencia, atualizacoes);
  });
  if (eventoEstado) await caminhoRestaurante(identidade.idRestaurante).collection('eventosMesas').add({
    idRestaurante: identidade.idRestaurante,
    idMesa: id,
    estadoAnterior: eventoEstado.anterior,
    estado: eventoEstado.novo,
    idAtor: identidade.idUsuario,
    criadoEm: FieldValue.serverTimestamp(),
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: eventoEstado ? 'salao.mesa.estadoAlterado' : 'salao.mesa.atualizada', tipoRecurso: 'mesa', idRecurso: id });
  return { corpo: { recurso: 'mesa', id, atualizado: true } };
}

module.exports = async function salao(req, res) {
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao: ['POST', 'PATCH'].includes(String(req.method || '').toUpperCase()), appCheck: true }, async ({ idRequisicao }) => {
    const metodo = String(req.method || '').toUpperCase();
    const mutacao = ['POST', 'PATCH'].includes(metodo);
    const identidade = await obterIdentidadeOperacional(req, mutacao ? PAPEIS_SALAO : PAPEIS_LEITURA);
    if (metodo === 'GET') return listarSalao(identidade, req);
    const corpo = await lerCorpoJson(req);
    const recurso = normalizarRecurso(corpo.recurso);
    if (metodo === 'POST') {
      if (!['reserva', 'mesa'].includes(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de salão inválido.');
      return recurso === 'reserva' ? criarReserva(identidade, corpo, idRequisicao) : criarMesa(identidade, corpo, idRequisicao);
    }
    if (!RECURSOS_ESCRITA.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de salão inválido.');
    return recurso === 'reserva' ? atualizarReserva(identidade, corpo, idRequisicao) : atualizarMesa(identidade, corpo, idRequisicao);
  });
};
