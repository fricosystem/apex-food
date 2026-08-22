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
  enumObrigatorio,
  dtoDocumento,
  listarColecao,
  queryString,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const RECURSOS_LEITURA = new Set(['categorias', 'produtos', 'promocoes', 'configuracao']);
const RECURSOS_ESCRITA = new Set(['categorias', 'produtos', 'promocoes', 'configuracao', 'estoque']);
const TIPOS_ESTOQUE = new Set(['entrada', 'saida', 'ajuste']);
const TIPOS_PROMOCAO = new Set(['Combo', 'Produto', 'Horário', 'Fidelidade']);
const ESTADOS_PROMOCAO = new Set(['ativa', 'agendada', 'inativa']);
const COLECOES_CARDAPIO = Object.freeze({
  categorias: 'categoriasCardapio',
  produtos: 'produtosCardapio',
  promocoes: 'promocoesCardapio',
  configuracao: 'configuracoesCardapioDigital',
});

function normalizarRecurso(valor) {
  if (valor === 'categoria') return 'categorias';
  if (valor === 'produto') return 'produtos';
  if (valor === 'promocao') return 'promocoes';
  if (valor === 'movimentacao-estoque' || valor === 'movimentacaoEstoque') return 'estoque';
  if (valor === 'configuracao-digital' || valor === 'configuracaoCardapioDigital') return 'configuracao';
  return valor;
}

function nomeColecao(recurso) {
  const colecao = COLECOES_CARDAPIO[recurso];
  if (!colecao) throw new ApiError(400, 'RECURSO_INVALIDO', 'Recurso de cardápio inválido.');
  return colecao;
}

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function listaCodigosOperacionais(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return [];
  const itens = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : null;
  if (!itens || itens.length > 30) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  const normalizados = itens.map(item => textoObrigatorio(String(item), `${campo}[]`, 80));
  return [...new Set(normalizados)];
}

function listaIngredientes(valor, campo = 'ingredientes') {
  if (valor === undefined || valor === null || valor === '') return [];
  if (!Array.isArray(valor) || valor.length > 100) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  const ids = new Set();
  const nomes = new Set();
  return valor.map((item, indice) => {
    const dados = typeof item === 'string' ? { nome: item } : item && typeof item === 'object' ? item : null;
    if (!dados) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo}[${indice}] é inválido.`);
    const nome = textoObrigatorio(dados.nome, `${campo}[${indice}].nome`, 120);
    const nomeChave = nome.toLocaleLowerCase('pt-BR');
    if (nomes.has(nomeChave)) throw new ApiError(400, 'INGREDIENTES_DUPLICADOS', 'Não repita ingredientes no mesmo produto.');
    nomes.add(nomeChave);
    const idInformado = dados.id === undefined || dados.id === null || dados.id === '' ? `ingrediente-${indice + 1}` : String(dados.id);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(idInformado)) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo}[${indice}].id é inválido.`);
    if (ids.has(idInformado)) throw new ApiError(400, 'INGREDIENTES_DUPLICADOS', 'Não repita identificadores de ingredientes no mesmo produto.');
    ids.add(idInformado);
    return { id: idInformado, nome, removivel: dados.removivel !== false };
  });
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
  const colecoes = recurso ? [recurso] : ['categorias', 'produtos', 'promocoes', 'configuracao'];
  const documentos = await Promise.all(colecoes.map((colecao) => listarColecao(identidade.idRestaurante, nomeColecao(colecao), limite)));
  const resposta = { categorias: [], produtos: [], promocoes: [], configuracao: null };
  colecoes.forEach((colecao, indice) => {
    const dados = dadosVisiveis(documentos[indice]);
    resposta[colecao] = colecao === 'configuracao' ? (dados[0] || null) : dados;
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

function validarConfiguracao(corpo) {
  return {
    publicado: corpo.publicado === true,
    exibirPrecos: corpo.exibirPrecos !== false,
    aceitarPedidos: corpo.aceitarPedidos === true,
    mostrarPromocoes: corpo.mostrarPromocoes !== false,
    linkPublico: textoOpcional(corpo.linkPublico, 'linkPublico', 500),
  };
}

function validarPromocao(corpo) {
  return {
    nome: textoObrigatorio(corpo.nome, 'nome', 140),
    descricao: textoOpcional(corpo.descricao, 'descricao', 500),
    tipo: enumObrigatorio(corpo.tipo || 'Combo', TIPOS_PROMOCAO, 'tipo'),
    desconto: textoObrigatorio(corpo.desconto, 'desconto', 60),
    valorCentavos: corpo.valorCentavos === undefined ? 0 : inteiroNaoNegativo(corpo.valorCentavos, 'valorCentavos', 100000000),
    limite: corpo.limite === undefined ? 0 : inteiroNaoNegativo(corpo.limite, 'limite', 100000000),
    estado: enumObrigatorio(corpo.estado || 'ativa', ESTADOS_PROMOCAO, 'estado'),
    inicioEm: textoOpcional(corpo.inicioEm, 'inicioEm', 40),
    fimEm: textoOpcional(corpo.fimEm, 'fimEm', 40),
  };
}

async function validarProduto(idRestaurante, corpo) {
  if (corpo.especialidadesNecessarias !== undefined && !Array.isArray(corpo.especialidadesNecessarias) && typeof corpo.especialidadesNecessarias !== 'string') throw new ApiError(400, 'PAYLOAD_INVALIDO', 'especialidadesNecessarias é inválido.');
  if (corpo.estacoesNecessarias !== undefined && !Array.isArray(corpo.estacoesNecessarias) && typeof corpo.estacoesNecessarias !== 'string') throw new ApiError(400, 'PAYLOAD_INVALIDO', 'estacoesNecessarias é inválido.');
  const ingredientes = listaIngredientes(corpo.ingredientes, 'ingredientes');
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
    especialidadesNecessarias: listaCodigosOperacionais(corpo.especialidadesNecessarias, 'especialidadesNecessarias'),
    estacoesNecessarias: listaCodigosOperacionais(corpo.estacoesNecessarias, 'estacoesNecessarias'),
    ingredientes,
  };
}

async function criarMovimentacaoEstoque(identidade, corpo, idRequisicao) {
  const produtoId = idDocumento(corpo.produtoId, 'produtoId');
  const tipo = enumObrigatorio(corpo.tipo, TIPOS_ESTOQUE, 'tipo');
  const quantidade = inteiroPositivo(corpo.quantidade, 'quantidade', 1000000);
  const motivo = textoObrigatorio(corpo.motivo, 'motivo', 240);
  const referenciaProduto = caminhoRestaurante(identidade.idRestaurante).collection('produtosCardapio').doc(produtoId);
  const referenciaMovimentacao = caminhoRestaurante(identidade.idRestaurante).collection('movimentacoesEstoque').doc();
  const db = referenciaProduto.firestore;
  await db.runTransaction(async (transacao) => {
    const produto = await transacao.get(referenciaProduto);
    if (!produto.exists || produto.data()?.estado === 'excluido') throw new ApiError(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado.');
    const estoqueAtual = Number(produto.data()?.estoque || 0);
    const estoqueNovo = tipo === 'entrada' ? estoqueAtual + quantidade : tipo === 'saida' ? estoqueAtual - quantidade : quantidade;
    if (estoqueNovo < 0) throw new ApiError(409, 'ESTOQUE_INSUFICIENTE', 'A saída excede o estoque disponível.');
    transacao.update(referenciaProduto, {
      estoque: estoqueNovo,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(produto.data()?.versao || 1) + 1,
    });
    transacao.set(referenciaMovimentacao, {
      produtoId,
      tipo,
      quantidade,
      unidade: textoOpcional(corpo.unidade, 'unidade', 40) || produto.data()?.unidade || 'unidade',
      motivo,
      referenciaId: textoOpcional(corpo.referenciaId, 'referenciaId', 128),
      estoqueAnterior: estoqueAtual,
      estoqueNovo,
      idRestaurante: identidade.idRestaurante,
      criadoPor: identidade.idUsuario,
      criadoEm: FieldValue.serverTimestamp(),
    });
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `estoque.${tipo}`, tipoRecurso: 'movimentacoesEstoque', idRecurso: referenciaMovimentacao.id });
  return { status: 201, corpo: { recurso: 'estoque', id: referenciaMovimentacao.id, produtoId, tipo, quantidade } };
}

async function criarRecurso(identidade, corpo, idRequisicao) {
  const recurso = normalizarRecurso(corpo.recurso);
  if (!RECURSOS_ESCRITA.has(recurso)) {
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Criação deste recurso não está disponível neste recorte.');
  }
  if (recurso === 'estoque') return criarMovimentacaoEstoque(identidade, corpo, idRequisicao);
  const colecao = nomeColecao(recurso);
  const dados = recurso === 'categorias'
    ? validarCategoria(corpo)
    : recurso === 'produtos'
      ? await validarProduto(identidade.idRestaurante, corpo)
      : recurso === 'promocoes'
        ? validarPromocao(corpo)
        : validarConfiguracao(corpo);
  const referenciaColecao = caminhoRestaurante(identidade.idRestaurante).collection(colecao);
  const referencia = recurso === 'configuracao' ? referenciaColecao.doc('configuracao') : referenciaColecao.doc();
  await referencia.set({
    ...dados,
    idRestaurante: identidade.idRestaurante,
    estado: recurso === 'promocoes' ? dados.estado : 'ativo',
    versao: 1,
    ...(recurso === 'promocoes' ? { usos: 0 } : {}),
    criadoPor: identidade.idUsuario,
    atualizadoPor: identidade.idUsuario,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: `cardapio.${recurso}.criado`, tipoRecurso: recurso, idRecurso: referencia.id });
  return { status: 201, corpo: { recurso, id: referencia.id } };
}

function camposAtualizaveisPromocao(corpo) {
  const atualizacoes = {};
  if (corpo.nome !== undefined) atualizacoes.nome = textoObrigatorio(corpo.nome, 'nome', 140);
  if (corpo.descricao !== undefined) atualizacoes.descricao = textoOpcional(corpo.descricao, 'descricao', 500);
  if (corpo.tipo !== undefined) atualizacoes.tipo = enumObrigatorio(corpo.tipo, TIPOS_PROMOCAO, 'tipo');
  if (corpo.desconto !== undefined) atualizacoes.desconto = textoObrigatorio(corpo.desconto, 'desconto', 60);
  if (corpo.valorCentavos !== undefined) atualizacoes.valorCentavos = inteiroNaoNegativo(corpo.valorCentavos, 'valorCentavos', 100000000);
  if (corpo.limite !== undefined) atualizacoes.limite = inteiroNaoNegativo(corpo.limite, 'limite', 100000000);
  if (corpo.estado !== undefined) atualizacoes.estado = enumObrigatorio(corpo.estado, ESTADOS_PROMOCAO, 'estado');
  if (corpo.inicioEm !== undefined) atualizacoes.inicioEm = textoOpcional(corpo.inicioEm, 'inicioEm', 40);
  if (corpo.fimEm !== undefined) atualizacoes.fimEm = textoOpcional(corpo.fimEm, 'fimEm', 40);
  if (!Object.keys(atualizacoes).length) throw new ApiError(400, 'PAYLOAD_INVALIDO', 'Nenhum campo atualizável foi informado.');
  return atualizacoes;
}

function camposAtualizaveisConfiguracao(corpo) {
  const atualizacoes = {};
  if (corpo.publicado !== undefined) atualizacoes.publicado = corpo.publicado === true;
  if (corpo.exibirPrecos !== undefined) atualizacoes.exibirPrecos = corpo.exibirPrecos === true;
  if (corpo.aceitarPedidos !== undefined) atualizacoes.aceitarPedidos = corpo.aceitarPedidos === true;
  if (corpo.mostrarPromocoes !== undefined) atualizacoes.mostrarPromocoes = corpo.mostrarPromocoes === true;
  if (corpo.linkPublico !== undefined) atualizacoes.linkPublico = textoOpcional(corpo.linkPublico, 'linkPublico', 500);
  if (!Object.keys(atualizacoes).length) throw new ApiError(400, 'PAYLOAD_INVALIDO', 'Nenhum campo atualizável foi informado.');
  return atualizacoes;
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
  if (corpo.especialidadesNecessarias !== undefined) atualizacoes.especialidadesNecessarias = listaCodigosOperacionais(corpo.especialidadesNecessarias, 'especialidadesNecessarias');
  if (corpo.estacoesNecessarias !== undefined) atualizacoes.estacoesNecessarias = listaCodigosOperacionais(corpo.estacoesNecessarias, 'estacoesNecessarias');
  if (corpo.ingredientes !== undefined) atualizacoes.ingredientes = listaIngredientes(corpo.ingredientes, 'ingredientes');
  if (!Object.keys(atualizacoes).length) throw new ApiError(400, 'PAYLOAD_INVALIDO', 'Nenhum campo atualizável foi informado.');
  return atualizacoes;
}

async function atualizarRecurso(identidade, corpo, idRequisicao) {
  const recurso = normalizarRecurso(corpo.recurso);
  if (!RECURSOS_ESCRITA.has(recurso)) {
    throw new ApiError(400, 'RECURSO_INVALIDO', 'Atualização deste recurso não está disponível neste recorte.');
  }
  const id = idDocumento(corpo.id, 'id');
  const colecao = nomeColecao(recurso);
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection(colecao).doc(recurso === 'configuracao' ? 'configuracao' : id);
  const atualizacoes = recurso === 'categorias'
    ? validarCategoria(corpo)
    : recurso === 'produtos'
      ? camposAtualizaveisProduto(corpo)
      : recurso === 'promocoes'
        ? camposAtualizaveisPromocao(corpo)
        : camposAtualizaveisConfiguracao(corpo);
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
