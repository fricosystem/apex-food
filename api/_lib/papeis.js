'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./http');
const { caminhoRestaurante, listarColecao, registrarAuditoriaOperacional, textoObrigatorio, textoOpcional } = require('./modulos-operacionais');

const PAPEIS_LEITURA = ['diretor', 'proprietario', 'administrador', 'gerente'];
const PAPEIS_GESTAO = ['diretor', 'proprietario', 'administrador'];
const CODIGOS_RESERVADOS = new Set(['desenvolvedor', 'sistema']);

const CATALOGO_PERMISSOES = Object.freeze([
  { codigo: 'estabelecimento.visualizar', nome: 'Visualizar estabelecimento', modulo: 'Estabelecimento', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'estabelecimento.configurar', nome: 'Configurar estabelecimento', modulo: 'Estabelecimento', acao: 'configurar', sensibilidade: 'alta' },
  { codigo: 'equipe.visualizar', nome: 'Visualizar equipe', modulo: 'Equipe', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'equipe.gerenciar', nome: 'Gerenciar equipe', modulo: 'Equipe', acao: 'gerenciar', sensibilidade: 'alta' },
  { codigo: 'papeis.visualizar', nome: 'Visualizar categorias e permissões', modulo: 'Equipe', acao: 'visualizar_papeis', sensibilidade: 'normal' },
  { codigo: 'papeis.gerenciar', nome: 'Gerenciar categorias e permissões', modulo: 'Equipe', acao: 'gerenciar_papeis', sensibilidade: 'alta' },
  { codigo: 'cardapio.visualizar', nome: 'Visualizar cardápio', modulo: 'Cardápio', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'cardapio.gerenciar', nome: 'Gerenciar cardápio', modulo: 'Cardápio', acao: 'gerenciar', sensibilidade: 'alta' },
  { codigo: 'pedidos.visualizar', nome: 'Visualizar pedidos', modulo: 'Pedidos', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'pedidos.operar', nome: 'Operar pedidos', modulo: 'Pedidos', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'cozinha.operar', nome: 'Operar cozinha', modulo: 'Cozinha', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'caixa.operar', nome: 'Operar caixa', modulo: 'Caixa', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'financeiro.visualizar', nome: 'Visualizar financeiro', modulo: 'Financeiro', acao: 'visualizar', sensibilidade: 'alta' },
  { codigo: 'financeiro.operar', nome: 'Operar financeiro', modulo: 'Financeiro', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'relatorios.visualizar', nome: 'Visualizar relatórios', modulo: 'Relatórios', acao: 'visualizar', sensibilidade: 'normal' },
]);

const PAPEIS_NATIVOS = Object.freeze([
  { codigo: 'diretor', nome: 'Diretor', descricao: 'Gestão do estabelecimento e da equipe.', permissoes: ['estabelecimento.visualizar', 'estabelecimento.configurar', 'equipe.visualizar', 'equipe.gerenciar', 'papeis.visualizar', 'papeis.gerenciar', 'cardapio.visualizar', 'cardapio.gerenciar', 'pedidos.visualizar', 'pedidos.operar', 'cozinha.operar', 'caixa.operar', 'financeiro.visualizar', 'financeiro.operar', 'relatorios.visualizar'] },
  { codigo: 'proprietario', nome: 'Proprietário', descricao: 'Acesso administrativo completo do estabelecimento.', permissoes: CATALOGO_PERMISSOES.map((item) => item.codigo) },
  { codigo: 'administrador', nome: 'Administrador', descricao: 'Administração operacional com escopo definido pelo estabelecimento.', permissoes: ['estabelecimento.visualizar', 'equipe.visualizar', 'equipe.gerenciar', 'papeis.visualizar', 'cardapio.visualizar', 'cardapio.gerenciar', 'pedidos.visualizar', 'pedidos.operar', 'cozinha.operar', 'caixa.operar', 'relatorios.visualizar'] },
  { codigo: 'gerente', nome: 'Gerente', descricao: 'Acompanhamento e operação diária do estabelecimento.', permissoes: ['estabelecimento.visualizar', 'equipe.visualizar', 'cardapio.visualizar', 'pedidos.visualizar', 'pedidos.operar', 'cozinha.operar', 'relatorios.visualizar'] },
  { codigo: 'porteiro', nome: 'Porteiro', descricao: 'Recepção e controle de chegada de clientes.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar'] },
  { codigo: 'garcom', nome: 'Garçom', descricao: 'Atendimento de mesas e pedidos do salão.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'pedidos.operar'] },
  { codigo: 'cozinheiro', nome: 'Cozinheiro', descricao: 'Execução das tarefas de preparo na cozinha.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'cozinha.operar'] },
  { codigo: 'cozinha', nome: 'Cozinha', descricao: 'Compatibilidade com o papel operacional legado.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'cozinha.operar'] },
  { codigo: 'caixa', nome: 'Caixa', descricao: 'Conferência e fechamento operacional do caixa.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'caixa.operar', 'financeiro.visualizar'] },
  { codigo: 'financeiro', nome: 'Financeiro', descricao: 'Consulta e operação financeira autorizada.', permissoes: ['estabelecimento.visualizar', 'financeiro.visualizar', 'financeiro.operar', 'relatorios.visualizar'] },
  { codigo: 'analista', nome: 'Analista', descricao: 'Consulta de indicadores e relatórios.', permissoes: ['estabelecimento.visualizar', 'relatorios.visualizar'] },
  { codigo: 'auditor', nome: 'Auditor', descricao: 'Consulta controlada para auditoria.', permissoes: ['estabelecimento.visualizar', 'relatorios.visualizar'] },
]);

const PERMISSOES_VALIDAS = new Set(CATALOGO_PERMISSOES.map((item) => item.codigo));
const PAPEIS_NATIVOS_POR_CODIGO = new Map(PAPEIS_NATIVOS.map((papel) => [papel.codigo, papel]));

function normalizarCodigo(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const codigo = String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '-');
  if (!/^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])?$/.test(codigo)) throw new ApiError(400, 'PAPEL_CODIGO_INVALIDO', 'O código da categoria deve usar letras, números, hífen ou sublinhado.');
  return codigo;
}

function validarNomePapel(valor) {
  const nome = textoObrigatorio(valor, 'nome', 80);
  if (nome.length < 2) throw new ApiError(400, 'PAPEL_NOME_INVALIDO', 'O nome da categoria é inválido.');
  return nome;
}

function validarPermissoes(valor) {
  if (!Array.isArray(valor) || valor.length > 30) throw new ApiError(400, 'PERMISSOES_INVALIDAS', 'Selecione permissões válidas.');
  const unicas = [...new Set(valor.filter((item) => typeof item === 'string').map((item) => item.trim()))];
  if (unicas.some((codigo) => !PERMISSOES_VALIDAS.has(codigo) || codigo.startsWith('desenvolvedor.'))) throw new ApiError(400, 'PERMISSAO_GLOBAL_NAO_PERMITIDA', 'A categoria não pode receber permissões globais.');
  return unicas;
}

function dadosPapel(corpo, codigoObrigatorio = false) {
  const codigo = normalizarCodigo(corpo?.codigo);
  if (codigoObrigatorio && !codigo) throw new ApiError(400, 'PAPEL_CODIGO_OBRIGATORIO', 'Informe o código da categoria.');
  if (CODIGOS_RESERVADOS.has(codigo) || PAPEIS_NATIVOS_POR_CODIGO.has(codigo)) throw new ApiError(409, 'PAPEL_RESERVADO', 'Esse papel é reservado pelo sistema.');
  return {
    codigo,
    nome: validarNomePapel(corpo?.nome),
    descricao: textoOpcional(corpo?.descricao, 'descricao', 240),
    permissoes: validarPermissoes(corpo?.permissoes || []),
  };
}

function dtoPapel(documento, sobrescrito = {}) {
  const dados = documento?.data ? documento.data() : documento;
  return {
    id: documento?.id || dados?.codigo,
    codigo: dados?.codigo || '',
    nome: dados?.nome || '',
    descricao: dados?.descricao || '',
    permissoes: Array.isArray(dados?.permissoes) ? dados.permissoes : [],
    sistema: dados?.sistema === true,
    estado: dados?.estado || 'ativo',
    editavel: dados?.sistema !== true && dados?.codigo !== 'desenvolvedor',
    ...sobrescrito,
  };
}

function dtoPapelNativo(papel) {
  return { id: papel.codigo, ...papel, sistema: true, estado: 'ativo', editavel: false };
}

async function listarPapeis(identidade) {
  const documentos = await listarColecao(identidade.idRestaurante, 'papeis', 100);
  const personalizados = new Map(documentos.map((documento) => [documento.id, dtoPapel(documento)]));
  const papeis = PAPEIS_NATIVOS.map((papel) => personalizados.get(papel.codigo) || dtoPapelNativo(papel));
  documentos.forEach((documento) => {
    const papel = dtoPapel(documento);
    if (!PAPEIS_NATIVOS_POR_CODIGO.has(papel.codigo) && papel.estado !== 'desativado') papeis.push(papel);
  });
  return { corpo: { papeis, catalogoPermissoes: CATALOGO_PERMISSOES, meta: { idRestaurante: identidade.idRestaurante, origem: 'server-side' } } };
}

async function criarPapel(identidade, corpo, idRequisicao) {
  const dados = dadosPapel(corpo, false);
  if (!dados.codigo) dados.codigo = normalizarCodigo(dados.nome);
  if (CODIGOS_RESERVADOS.has(dados.codigo) || PAPEIS_NATIVOS_POR_CODIGO.has(dados.codigo)) throw new ApiError(409, 'PAPEL_RESERVADO', 'Esse papel é reservado pelo sistema.');
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('papeis').doc(dados.codigo);
  const existente = await referencia.get();
  if (existente.exists && existente.data()?.estado !== 'desativado') throw new ApiError(409, 'PAPEL_JA_EXISTE', 'Já existe uma categoria com esse código.');
  await referencia.set({
    ...dados,
    idRestaurante: identidade.idRestaurante,
    sistema: false,
    estado: 'ativo',
    criadoPor: identidade.idUsuario,
    atualizadoPor: identidade.idUsuario,
    criadoEm: existente.exists ? existente.data()?.criadoEm || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: existente.exists ? Number(existente.data()?.versao || 1) + 1 : 1,
  }, { merge: existente.exists });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'papeis.criado', tipoRecurso: 'papel', idRecurso: dados.codigo });
  return { status: 201, corpo: { recurso: 'papel', id: dados.codigo, criado: true } };
}

async function atualizarPapel(identidade, corpo, idRequisicao) {
  const codigo = normalizarCodigo(corpo?.id || corpo?.codigo);
  const papel = PAPEIS_NATIVOS_POR_CODIGO.get(codigo);
  if (papel || CODIGOS_RESERVADOS.has(codigo)) throw new ApiError(409, 'PAPEL_RESERVADO', 'Papéis nativos não podem ser alterados nesta tela.');
  const referencia = caminhoRestaurante(identidade.idRestaurante).collection('papeis').doc(codigo);
  const existente = await referencia.get();
  if (!existente.exists || existente.data()?.estado === 'desativado') throw new ApiError(404, 'PAPEL_NAO_ENCONTRADO', 'Categoria não encontrada.');
  const dados = dadosPapel({ ...corpo, codigo }, true);
  await referencia.update({ ...dados, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(existente.data()?.versao || 1) + 1 });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'papeis.atualizado', tipoRecurso: 'papel', idRecurso: codigo });
  return { corpo: { recurso: 'papel', id: codigo, atualizado: true } };
}

async function arquivarPapel(identidade, corpo, idRequisicao) {
  const codigo = normalizarCodigo(corpo?.id || corpo?.codigo);
  if (PAPEIS_NATIVOS_POR_CODIGO.has(codigo) || CODIGOS_RESERVADOS.has(codigo)) throw new ApiError(409, 'PAPEL_RESERVADO', 'Papéis nativos não podem ser arquivados.');
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const referencia = restaurante.collection('papeis').doc(codigo);
  const existente = await referencia.get();
  if (!existente.exists || existente.data()?.estado === 'desativado') throw new ApiError(404, 'PAPEL_NAO_ENCONTRADO', 'Categoria não encontrada.');
  const membros = await restaurante.collection('membros').where('papeis', 'array-contains', codigo).where('estado', '==', 'ativo').limit(1).get();
  if (!membros.empty) throw new ApiError(409, 'PAPEL_EM_USO', 'Remova o papel dos membros ativos antes de arquivar a categoria.');
  await referencia.update({ estado: 'desativado', arquivadoPor: identidade.idUsuario, arquivadoEm: FieldValue.serverTimestamp(), atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: Number(existente.data()?.versao || 1) + 1 });
  await registrarAuditoriaOperacional({ identidade, idRequisicao, acao: 'papeis.arquivado', tipoRecurso: 'papel', idRecurso: codigo });
  return { corpo: { recurso: 'papel', id: codigo, arquivado: true } };
}

module.exports = {
  PAPEIS_LEITURA,
  PAPEIS_GESTAO,
  CATALOGO_PERMISSOES,
  PAPEIS_NATIVOS,
  normalizarCodigo,
  validarPermissoes,
  dadosPapel,
  dtoPapel,
  listarPapeis,
  criarPapel,
  atualizarPapel,
  arquivarPapel,
};
