'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA_EQUIPE,
  PAPEIS_MUTACAO_EQUIPE,
  PAPEIS_ESCALA,
  PAPEIS_COMISSAO,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  enumObrigatorio,
  queryString,
  listarColecao,
  dtoFuncionario,
  dtoEscala,
  dtoComissao,
  dadosFuncionario,
  dadosEscala,
  idDocumento,
  validarConflitoEscala,
  periodoComissao,
  registrarAuditoriaOperacional,
  STATUS_FUNCIONARIO,
  STATUS_ESCALA,
  TURNOS,
  SETORES,
} = require('./equipe');

const RECURSOS_LEITURA = new Set(['funcionarios', 'escalas', 'comissoes']);
const RECURSOS_MUTACAO = new Set(['funcionarios', 'escalas']);

function normalizarRecurso(valor) {
  if (valor === 'funcionario') return 'funcionarios';
  if (valor === 'escala') return 'escalas';
  if (valor === 'comissao') return 'comissoes';
  return valor;
}

function nomeColecao(recurso) {
  return recurso === 'funcionarios' ? 'funcionarios' : recurso;
}

function docsVisiveis(documentos, dto) {
  return documentos
    .filter((documento) => {
      const dados = documento.data() || {};
      return dados.estado !== 'excluido' && !dados.excluidoEm;
    })
    .map(dto);
}

function idFuncionarioNovo() {
  return `FUN-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function idEscalaNova() {
  return `ESC-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

async function listarEquipe(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (recurso && !RECURSOS_LEITURA.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de equipe inválido.');
  const limite = limitarInteiro(req.query?.limite, 200, 300);
  const periodo = periodoComissao(queryString(req, 'periodo'));
  const colecoes = recurso ? [recurso] : ['funcionarios', 'escalas', 'comissoes'];
  const documentos = await Promise.all(colecoes.map((item) => listarColecao(identidade.idRestaurante, nomeColecao(item), limite)));
  const resposta = { funcionarios: [], escalas: [], comissoes: [] };
  colecoes.forEach((item, indice) => {
    const dto = item === 'funcionarios' ? dtoFuncionario : item === 'escalas' ? dtoEscala : dtoComissao;
    let dados = docsVisiveis(documentos[indice], dto);
    if (item === 'comissoes' && periodo) dados = dados.filter((comissao) => comissao.periodo === periodo);
    resposta[item] = dados;
  });
  return { corpo: { ...resposta, meta: { idRestaurante: identidade.idRestaurante, limite, periodo: periodo || null } } };
}

function validarCamposParciaisFuncionario(corpo, existente) {
  const base = {
    nome: existente.nome,
    cargo: existente.cargo,
    setor: existente.setor,
    turno: existente.turno,
    status: existente.status || 'ativo',
    percentualComissao: Number(existente.percentualComissao || 0),
    telefone: '',
  };
  if (corpo.nome !== undefined) base.nome = corpo.nome;
  if (corpo.cargo !== undefined) base.cargo = corpo.cargo;
  if (corpo.setor !== undefined) base.setor = corpo.setor;
  if (corpo.turno !== undefined) base.turno = corpo.turno;
  if (corpo.status !== undefined) base.status = corpo.status;
  if (corpo.percentualComissao !== undefined) base.percentualComissao = corpo.percentualComissao;
  if (corpo.telefone !== undefined) base.telefone = corpo.telefone;
  const dados = dadosFuncionario(base);
  return dados;
}

async function criarFuncionario(identidade, corpo, idRequisicao) {
  const dados = dadosFuncionario(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const id = idFuncionarioNovo();
  const referencia = restaurante.collection('funcionarios').doc(id);
  const privado = restaurante.collection('dadosPrivadosFuncionarios').doc(id);
  const batch = referencia.firestore.batch();
  const publico = {
    idRestaurante: identidade.idRestaurante,
    nome: dados.nome,
    iniciais: dados.iniciais,
    cargo: dados.cargo,
    setor: dados.setor,
    turno: dados.turno,
    status: dados.status,
    percentualComissao: dados.percentualComissao,
    telefoneMascarado: dados.telefoneMascarado,
    cor: dados.cor,
    versao: 1,
    criadoPor: identidade.idUsuario,
    atualizadoPor: identidade.idUsuario,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  };
  batch.set(referencia, publico);
  batch.set(privado, {
    idRestaurante: identidade.idRestaurante,
    funcionarioId: id,
    telefone: dados.telefone,
    criadoPor: identidade.idUsuario,
    atualizadoPor: identidade.idUsuario,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'equipe.funcionario.criado', tipoRecurso: 'funcionario', idRecurso: id });
  return { status: 201, corpo: { recurso: 'funcionario', id, criado: true } };
}

async function atualizarFuncionario(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('funcionarios').doc(id);
  const privado = restaurante.collection('dadosPrivadosFuncionarios').doc(id);
  const documento = await referencia.get();
  if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'FUNCIONARIO_NAO_ENCONTRADO', 'Funcionário não encontrado.');
  const dados = validarCamposParciaisFuncionario(corpo, documento.data());
  if (corpo.telefone === undefined) dados.telefoneMascarado = documento.data()?.telefoneMascarado || '';
  const atualizacoes = {
    nome: dados.nome,
    iniciais: dados.iniciais,
    cargo: dados.cargo,
    setor: dados.setor,
    turno: dados.turno,
    status: dados.status,
    percentualComissao: dados.percentualComissao,
    telefoneMascarado: dados.telefoneMascarado,
    cor: dados.cor,
    atualizadoPor: identidade.idUsuario,
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: Number(documento.data()?.versao || 1) + 1,
  };
  const batch = referencia.firestore.batch();
  batch.update(referencia, atualizacoes);
  if (corpo.telefone !== undefined) {
    batch.set(privado, {
      idRestaurante: identidade.idRestaurante,
      funcionarioId: id,
      telefone: dados.telefone,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'equipe.funcionario.atualizado', tipoRecurso: 'funcionario', idRecurso: id });
  return { corpo: { recurso: 'funcionario', id, atualizado: true } };
}

async function criarEscala(identidade, corpo, idRequisicao) {
  const dados = dadosEscala(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const funcionario = restaurante.collection('funcionarios').doc(dados.funcionarioId);
  const referencia = restaurante.collection('escalas').doc(idEscalaNova());
  await referencia.firestore.runTransaction(async (transacao) => {
    const funcionarioDocumento = await transacao.get(funcionario);
    if (!funcionarioDocumento.exists || funcionarioDocumento.data()?.estado === 'excluido') throw new ApiError(400, 'FUNCIONARIO_NAO_ENCONTRADO', 'Funcionário não encontrado.');
    await validarConflitoEscala(transacao, restaurante, dados);
    transacao.set(referencia, {
      ...dados,
      idRestaurante: identidade.idRestaurante,
      versao: 1,
      criadoPor: identidade.idUsuario,
      atualizadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'equipe.escala.criada', tipoRecurso: 'escala', idRecurso: referencia.id });
  return { status: 201, corpo: { recurso: 'escala', id: referencia.id, criado: true } };
}

async function atualizarEscala(identidade, corpo, idRequisicao) {
  const id = idDocumento(corpo.id, 'id');
  const dados = dadosEscala(corpo);
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('escalas').doc(id);
  await referencia.firestore.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'ESCALA_NAO_ENCONTRADA', 'Escala não encontrada.');
    const funcionario = await transacao.get(restaurante.collection('funcionarios').doc(dados.funcionarioId));
    if (!funcionario.exists || funcionario.data()?.estado === 'excluido') throw new ApiError(400, 'FUNCIONARIO_NAO_ENCONTRADO', 'Funcionário não encontrado.');
    await validarConflitoEscala(transacao, restaurante, dados, id);
    transacao.update(referencia, {
      ...dados,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(documento.data()?.versao || 1) + 1,
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'equipe.escala.atualizada', tipoRecurso: 'escala', idRecurso: id });
  return { corpo: { recurso: 'escala', id, atualizado: true } };
}

module.exports = async function equipe(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH'].includes(metodo);
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    const corpo = mutacao ? await lerCorpoJson(req) : null;
    const recursoCorpo = corpo ? normalizarRecurso(corpo.recurso) : '';
    const recursoQuery = queryString(req, 'recurso');
    const recurso = recursoCorpo || normalizarRecurso(recursoQuery);
    const papeis = recurso === 'comissoes' ? PAPEIS_COMISSAO : recurso === 'escalas' ? (mutacao ? PAPEIS_ESCALA : PAPEIS_LEITURA_EQUIPE) : mutacao ? (recurso === 'escalas' ? PAPEIS_ESCALA : PAPEIS_MUTACAO_EQUIPE) : PAPEIS_LEITURA_EQUIPE;
    const identidade = await obterIdentidadeOperacional(req, papeis);
    if (metodo === 'GET') return listarEquipe(identidade, req);
    if (!RECURSOS_MUTACAO.has(recurso)) throw new ApiError(400, 'RECURSO_INVALIDO', 'Mutação de equipe inválida ou não disponível.');
    if (metodo === 'POST') return recurso === 'funcionarios' ? criarFuncionario(identidade, corpo, idRequisicao) : criarEscala(identidade, corpo, idRequisicao);
    return recurso === 'funcionarios' ? atualizarFuncionario(identidade, corpo, idRequisicao) : atualizarEscala(identidade, corpo, idRequisicao);
  });
};
