'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  PAPEIS_CARDAPIO,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  inteiroPositivo,
  dtoDocumento,
  listarColecao,
  queryString,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const RECURSOS_LEITURA = new Set(['categorias', 'produtos', 'promocoes']);
const RECURSOS_ESCRITA = new Set(['categoria', 'produto']);

function normalizarRecurso(valor) {
  if (valor === 'categoria') return 'categorias';
  if (valor === 'produto') return 'produtos';
  if (valor === 'promocao') return 'promocoes';
  return valor;
}

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function dadosVisiveis(docs) {
  return docs
    .filter((documento) => {
      const dados = documento.data() || {};
      return dados.estado !== 'excluido' && !dados.excluidoEm;
    })
    .map(dtoDocumento);
}

async function listarCardapio(identidade, req) {
  const recurso = normalizarRecurso(queryString(req, 'recurso'));
  if (recurso && !RECURSOS_LEITURA.has(recurso)) {
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de cardápio inválido.');
  }
  const limite = limitarInteiro(req.query?.limite, 100, 200);
  const colecoes = recurso ? [recurso] : ['categorias', 'produtos', 'promocoes'];
  const documentos = await Promise.all(colecoes.map((colecao) => listarColecao(identidade.idRestaurante, colecao === 'categorias' ? 'categoriasCardapio' : colecao, limite)));
  const resposta = { categorias: [], produtos: [], promocoes: [] };
  colecoes.forEach((colecao, indice) => {
    resposta[colecao] = dadosVisiveis(documentos[indice]);
  });
  return { corpo: { ...resposta, meta: { idRestaurante: identidade.idRestaurante, limite } } };
}

function validarCategoria(corpo) {
  return {
    nome: textoObrigatorio(corpo.nome, 'nome', 100),
    descricao: textoOpcional(corpo.descricao, 'descricao', 300),
    icone: textoObrigatorio(corpo.icone || 'utensils', 'icone', 60),
    cor: textoObrigatorio(corpo.cor || 'orange', 'cor', 30),
    ordem: corpo.ordem === undefined ? 0 : inteiroNaoNegativo(corpo.ordem, 'ordem', 10000),
  };
}

async function validarProduto(idRestaurante, corpo) {
  const idCategoria = idDocumento(corpo.idCategoria, 'idCategoria');
  const categoria = await caminhoRestaurante(idRestaurante).collection('categoriasCardapio').doc(idCategoria).get();
  if (!categoria.exists || categoria.data()?.estado === 'excluido') {
    throw new ApiError(400, 'CATEGORIA_INVALIDA', 'Categoria do produto não encontrada.');
  }
  return {
    idCategoria,
    nome: textoObrigatorio(corpo.nome, 'nome', 140),
    descricao: textoOpcional(corpo.descricao, 'descricao', 500),
    precoCentavos: inteiroPositivo(corpo.precoCentavos, 'precoCentavos', 100000000),
    custoCentavos: corpo.custoCentavos === undefined ? 0 : inteiroNaoNegativo(corpo.custoCentavos, 'custoCentavos', 100000000),
    estoque: corpo.estoque === undefined ? 0 : inteiroNaoNegativo(corpo.estoque, 'estoque', 1000000),
    unidade: textoObrigatorio(corpo.unidade || 'unidade', 'unidade', 40),
    tempoPreparo: corpo.tempoPreparo === undefined ? 0 : inteiroNaoNegativo(corpo.tempoPreparo, 'tempoPreparo', 1440),
    disponibilidade: corpo.disponibilidade === undefined ? true : corpo.disponibilidade === true,
  };
}

async function criarRecurso(identidade, corpo, idRequisicao) {
  const recurso = normalizarRecurso(corpo.recurso);
  if (!RECURSOS_ESCRITA.has(recurso)) {
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Criação deste recurso não está disponível neste recorte.');
  }
  const colecao = recurso === 'categorias' ? 'categoriasCardapio' : 'produtos';
  const dados = recurso === 'categorias' ? validarCategoria(corpo) : await validarProduto(identidade.idRestaurante, corpo);
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection(colecao).doc();
  await referencia.set({
    ...dados,
    idRestaurante: identidade.idRestaurante,
    estado: 'ativo',
    versao: 1,
    criadoPor: identidade.idUsuario,
    atualizadoPor: identidade.idUsuario,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `cardapio.${recurso}.criado`, tipoRecurso: recurso, idRecurso: referencia.id });
  return { status: 201, corpo: { recurso, id: referencia.id } };
}

function camposAtualizaveisProduto(corpo) {
  const atualizacoes = {};
  if (corpo.nome !== undefined) atualizacoes.nome = textoObrigatorio(corpo.nome, 'nome', 140);
  if (corpo.descricao !== undefined) atualizacoes.descricao = textoOpcional(corpo.descricao, 'descricao', 500);
  if (corpo.precoCentavos !== undefined) atualizacoes.precoCentavos = inteiroPositivo(corpo.precoCentavos, 'precoCentavos', 100000000);
  if (corpo.custoCentavos !== undefined) atualizacoes.custoCentavos = inteiroNaoNegativo(corpo.custoCentavos, 'custoCentavos', 100000000);
  if (corpo.estoque !== undefined) atualizacoes.estoque = inteiroNaoNegativo(corpo.estoque, 'estoque', 1000000);
  if (corpo.tempoPreparo !== undefined) atualizacoes.tempoPreparo = inteiroNaoNegativo(corpo.tempoPreparo, 'tempoPreparo', 1440);
  if (corpo.disponibilidade !== undefined) {
    if (typeof corpo.disponibilidade !== 'boolean') throw new ApiError(400, 'PAYLOAD_INVALIDO', 'disponibilidade é inválida.');
    atualizacoes.disponibilidade = corpo.disponibilidade;
  }
  if (!Object.keys(atualizacoes).length) throw new ApiError(400, 'PAYLOAD_INVALIDO', 'Nenhum campo atualizável foi informado.');
  return atualizacoes;
}

async function atualizarRecurso(identidade, corpo, idRequisicao) {
  const recurso = normalizarRecurso(corpo.recurso);
  if (!RECURSOS_ESCRITA.has(recurso)) {
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Atualização deste recurso não está disponível neste recorte.');
  }
  const id = idDocumento(corpo.id, 'id');
  const colecao = recurso === 'categorias' ? 'categoriasCardapio' : 'produtos';
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection(colecao).doc(id);
  const atualizacoes = recurso === 'categorias' ? validarCategoria(corpo) : camposAtualizaveisProduto(corpo);
  const db = referencia.firestore;
  await db.runTransaction(async (transacao) => {
    const documento = await transacao.get(referencia);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'RECURSO_NAO_ENCONTRADO', 'Recurso não encontrado.');
    const versaoAtual = Number(documento.data()?.versao || 1);
    transacao.update(referencia, {
      ...atualizacoes,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: versaoAtual + 1,
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `cardapio.${recurso}.atualizado`, tipoRecurso: recurso, idRecurso: id });
  return { corpo: { recurso, id, atualizado: true } };
}

module.exports = async function cardapio(req, res) {
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao: ['POST', 'PATCH'].includes(String(req.method || '').toUpperCase()), appCheck: true }, async ({ idRequisicao }) => {
    const mutacao = ['POST', 'PATCH'].includes(String(req.method || '').toUpperCase());
    const identidade = await obterIdentidadeOperacional(req, mutacao ? PAPEIS_CARDAPIO : PAPEIS_LEITURA);
    if (req.method === 'GET') return listarCardapio(identidade, req);
    const corpo = await lerCorpoJson(req);
    if (req.method === 'POST') return criarRecurso(identidade, corpo, idRequisicao);
    return atualizarRecurso(identidade, corpo, idRequisicao);
  });
};
