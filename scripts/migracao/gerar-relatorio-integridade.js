'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { PAPEIS_NATIVOS_POR_CODIGO, PERMISSOES_VALIDAS } = require('../../api/_lib/permissoes-locais');

const ESTADOS_RESTAURANTE = new Set(['rascunho', 'em_teste', 'ativo', 'suspenso', 'desativado', 'encerrado']);
const ESTADOS_MEMBRO = new Set(['convite_pendente', 'ativo', 'suspenso', 'removido']);
const ESTADOS_PAPEL = new Set(['ativo', 'desativado']);
const COLECOES_OPERACIONAIS = Object.freeze(['mesas', 'reservas', 'produtosCardapio', 'pedidos', 'comandas', 'fichasCozinha', 'encaminhamentosCaixa']);
const LIMITE_PADRAO = 500;
const LIMITE_MAXIMO = 5000;

function inteiroSeguro(valor, padrao = LIMITE_PADRAO) {
  const numero = Number.parseInt(valor, 10);
  return Number.isSafeInteger(numero) && numero > 0 ? Math.min(numero, LIMITE_MAXIMO) : padrao;
}

function textoSeguro(valor, padrao = '') {
  return typeof valor === 'string' ? valor.trim() : padrao;
}

function problema(problemas, codigo, severidade, idRestaurante, recurso, mensagem) {
  problemas.push({ codigo, severidade, idRestaurante: textoSeguro(idRestaurante, null), recurso: textoSeguro(recurso, null), mensagem: textoSeguro(mensagem).slice(0, 240) });
}

function dadosDocumento(item) {
  if (!item) return {};
  if (item.dados && typeof item.dados === 'object') return item.dados;
  if (typeof item.data === 'function') return item.data() || {};
  return item;
}

function idDocumento(item) {
  return textoSeguro(item?.id || item?.idDocumento || '');
}

function analisarIndices(indices = []) {
  const problemas = [];
  const porChave = new Map();
  for (const item of indices) {
    const dados = dadosDocumento(item);
    const idRestaurante = textoSeguro(dados.idRestaurante, null);
    const chave = `${textoSeguro(dados.tipoDocumento)}:${textoSeguro(dados.documentoNormalizado)}`;
    if (!idRestaurante || !['cnpj', 'cpf'].includes(dados.tipoDocumento) || !textoSeguro(dados.documentoNormalizado)) {
      problema(problemas, 'INDICE_FISCAL_INVALIDO', 'alta', idRestaurante, 'indicesDocumentosEstabelecimentos', 'Índice fiscal sem vínculo ou documento normalizado válido.');
      continue;
    }
    const itens = porChave.get(chave) || [];
    itens.push(idRestaurante);
    porChave.set(chave, itens);
  }
  for (const [chave, restaurantes] of porChave.entries()) {
    const unicos = [...new Set(restaurantes)];
    if (unicos.length > 1) for (const idRestaurante of unicos) problema(problemas, 'INDICE_FISCAL_CONFLITO', 'critica', idRestaurante, 'indicesDocumentosEstabelecimentos', `Índice fiscal duplicado entre estabelecimentos (${chave.split(':')[0]}).`);
  }
  return problemas;
}

function analisarRestaurante({ documento, membros = [], papeis = [], indices = [], usuarios = [], operacionais = {} }) {
  const idRestaurante = idDocumento(documento);
  const dados = dadosDocumento(documento);
  const problemas = [];
  if (!idRestaurante) problema(problemas, 'RESTAURANTE_SEM_ID', 'critica', null, 'restaurantes', 'Documento de restaurante sem identificador válido.');
  if (dados.idRestaurante !== idRestaurante) problema(problemas, 'RESTAURANTE_ID_INCONSISTENTE', 'alta', idRestaurante, 'restaurantes', 'O campo idRestaurante não corresponde ao identificador do documento.');
  if (!ESTADOS_RESTAURANTE.has(dados.estado)) problema(problemas, 'RESTAURANTE_ESTADO_INVALIDO', 'alta', idRestaurante, 'restaurantes', 'Estado do restaurante ausente ou inválido.');
  if (!textoSeguro(dados.nome)) problema(problemas, 'RESTAURANTE_NOME_AUSENTE', 'alta', idRestaurante, 'restaurantes', 'Restaurante sem nome operacional.');
  if (!['cnpj', 'cpf'].includes(dados.tipoDocumento) || !textoSeguro(dados.documentoNormalizado)) problema(problemas, 'RESTAURANTE_DOCUMENTO_INVALIDO', 'alta', idRestaurante, 'restaurantes', 'Documento fiscal ausente ou inválido no contrato.');

  const papeisAtivos = new Set();
  const papeisPorCodigo = new Map();
  for (const item of papeis) {
    const id = idDocumento(item);
    const papel = dadosDocumento(item);
    const codigo = textoSeguro(papel.codigo || id);
    if (!codigo || codigo !== id) problema(problemas, 'PAPEL_ID_INCONSISTENTE', 'alta', idRestaurante, 'papeis', 'Categoria local com código diferente do identificador.');
    if (!ESTADOS_PAPEL.has(papel.estado || 'ativo')) problema(problemas, 'PAPEL_ESTADO_INVALIDO', 'media', idRestaurante, 'papeis', 'Categoria local com estado inválido.');
    if (codigo === 'desenvolvedor' || papel.sistema === true && codigo === 'desenvolvedor') problema(problemas, 'PAPEL_GLOBAL_LOCAL', 'critica', idRestaurante, 'papeis', 'Autorização global não pode ser armazenada como papel local.');
    if (!Array.isArray(papel.permissoes) || papel.permissoes.some((permissao) => !PERMISSOES_VALIDAS.has(permissao) || String(permissao).startsWith('desenvolvedor.'))) problema(problemas, 'PAPEL_PERMISSAO_INVALIDA', 'alta', idRestaurante, 'papeis', 'Categoria local possui permissão fora do catálogo fechado.');
    papeisPorCodigo.set(codigo, papel);
    if ((papel.estado || 'ativo') === 'ativo') papeisAtivos.add(codigo);
  }

  const usuariosPorId = new Map(usuarios.map((item) => [idDocumento(item), dadosDocumento(item)]).filter(([id]) => id));
  const membrosAtivos = [];
  for (const item of membros) {
    const idUsuario = idDocumento(item);
    const membro = dadosDocumento(item);
    if (membro.idUsuario !== idUsuario) problema(problemas, 'MEMBRO_ID_INCONSISTENTE', 'alta', idRestaurante, 'membros', 'Vínculo com usuário inconsistente.');
    if (membro.idRestaurante !== idRestaurante) problema(problemas, 'MEMBRO_TENANT_INCONSISTENTE', 'critica', idRestaurante, 'membros', 'Vínculo aponta para outro restaurante.');
    if (usuarios.length && !usuariosPorId.has(idUsuario)) problema(problemas, 'MEMBRO_USUARIO_AUSENTE', 'alta', idRestaurante, 'membros', 'Vínculo não possui usuário correspondente na coleção usuarios.');
    if (usuariosPorId.has(idUsuario) && ['desativado', 'suspenso', 'excluido'].includes(usuariosPorId.get(idUsuario).estado)) problema(problemas, 'MEMBRO_USUARIO_INATIVO', 'alta', idRestaurante, 'membros', 'Membro ativo aponta para usuário em estado não operacional.');
    if (!ESTADOS_MEMBRO.has(membro.estado)) problema(problemas, 'MEMBRO_ESTADO_INVALIDO', 'alta', idRestaurante, 'membros', 'Vínculo com estado inválido.');
    if (!Array.isArray(membro.papeis)) problema(problemas, 'MEMBRO_PAPEIS_INVALIDOS', 'alta', idRestaurante, 'membros', 'Vínculo sem lista válida de papéis.');
    const papeisMembro = Array.isArray(membro.papeis) ? membro.papeis : [];
    for (const codigo of papeisMembro) {
      if (typeof codigo !== 'string' || (!PAPEIS_NATIVOS_POR_CODIGO.has(codigo) && !papeisPorCodigo.has(codigo))) problema(problemas, 'MEMBRO_PAPEL_DESCONHECIDO', 'alta', idRestaurante, 'membros', 'Vínculo contém categoria inexistente neste restaurante.');
      if (codigo === 'desenvolvedor') problema(problemas, 'MEMBRO_PAPEL_GLOBAL', 'critica', idRestaurante, 'membros', 'Desenvolvedor não pode ser atribuído como papel local.');
      if (papeisPorCodigo.has(codigo) && !papeisAtivos.has(codigo)) problema(problemas, 'MEMBRO_PAPEL_DESATIVADO', 'alta', idRestaurante, 'membros', 'Vínculo usa categoria local desativada.');
    }
    if (Array.isArray(membro.permissoesDiretas) && membro.permissoesDiretas.some((permissao) => !PERMISSOES_VALIDAS.has(permissao) || String(permissao).startsWith('desenvolvedor.'))) problema(problemas, 'MEMBRO_PERMISSAO_DIRETA_INVALIDA', 'critica', idRestaurante, 'membros', 'Vínculo contém permissão direta fora do catálogo local.');
    if (membro.estado === 'ativo') membrosAtivos.push(membro);
  }
  if (!membrosAtivos.length && !['rascunho', 'desativado', 'encerrado'].includes(dados.estado)) problema(problemas, 'RESTAURANTE_SEM_MEMBRO_ATIVO', 'alta', idRestaurante, 'membros', 'Restaurante operacional sem membro ativo.');
  if (dados.idDiretor && !membrosAtivos.some((membro) => membro.idUsuario === dados.idDiretor)) problema(problemas, 'DIRETOR_SEM_VINCULO_ATIVO', 'alta', idRestaurante, 'membros', 'Diretor indicado no restaurante não possui vínculo ativo correspondente.');

  const indicesDoRestaurante = indices.filter((item) => dadosDocumento(item).idRestaurante === idRestaurante);
  if (indicesDoRestaurante.length !== 1) problema(problemas, indicesDoRestaurante.length ? 'INDICE_FISCAL_DUPLICADO' : 'INDICE_FISCAL_AUSENTE', 'alta', idRestaurante, 'indicesDocumentosEstabelecimentos', 'Quantidade inesperada de índice fiscal para o restaurante.');
  for (const item of Object.values(operacionais)) {
    for (const operacional of item || []) {
      const dadosOperacionais = dadosDocumento(operacional);
      if (!dadosOperacionais.idRestaurante) problema(problemas, 'OPERACIONAL_SEM_TENANT', 'critica', idRestaurante, 'colecao_operacional', 'Documento operacional não possui idRestaurante.');
      else if (dadosOperacionais.idRestaurante !== idRestaurante) problema(problemas, 'OPERACIONAL_TENANT_INCONSISTENTE', 'critica', idRestaurante, 'colecao_operacional', 'Documento operacional aponta para outro restaurante.');
    }
  }

  return {
    idRestaurante,
    estado: dados.estado || null,
    membros: { total: membros.length, ativos: membrosAtivos.length },
    papeis: { total: papeis.length, ativos: papeisAtivos.size },
    indicesFiscais: indicesDoRestaurante.length,
    operacionais: Object.fromEntries(Object.entries(operacionais).map(([colecao, itens]) => [colecao, Array.isArray(itens) ? itens.length : 0])),
    problemas,
  };
}

function consolidarRelatorio({ dataExecucao = new Date().toISOString(), ambiente = process.env.APP_ENV || 'development', restaurantes = [], problemas = [], leituras = 0, limites = {} }) {
  const porCodigo = {};
  for (const item of problemas) porCodigo[item.codigo] = (porCodigo[item.codigo] || 0) + 1;
  return {
    versaoRelatorio: '1.0.0',
    modo: 'somente_leitura',
    dataExecucao,
    ambiente,
    resumo: {
      restaurantesAnalisados: restaurantes.length,
      problemasEncontrados: problemas.length,
      problemasCriticos: problemas.filter((item) => item.severidade === 'critica').length,
      problemasPorCodigo: porCodigo,
      leiturasFirestore: leituras,
    },
    limites,
    restaurantes,
    problemas,
  };
}

async function lerColecao(ref, limite) {
  const snapshot = await ref.limit(limite).get();
  return { documentos: snapshot.docs, truncada: snapshot.size >= limite };
}

async function gerarRelatorio({ db, limite = LIMITE_PADRAO } = {}) {
  if (!db || typeof db.collection !== 'function') throw new Error('Firestore Admin não foi fornecido.');
  const limiteSeguro = inteiroSeguro(limite);
  let leituras = 0;
  const raiz = db.collection('restaurantes');
  const restaurantesSnapshot = await raiz.limit(limiteSeguro).get();
  leituras += 1;
  const [indicesSnapshot, usuariosSnapshot] = await Promise.all([
    db.collection('indicesDocumentosEstabelecimentos').limit(limiteSeguro * 2).get(),
    db.collection('usuarios').limit(limiteSeguro * 2).get(),
  ]);
  leituras += 2;
  const indices = indicesSnapshot.docs;
  const usuarios = usuariosSnapshot.docs;
  const problemasGlobais = analisarIndices(indices);
  const resultados = [];
  const problemas = [];
  for (const restaurante of restaurantesSnapshot.docs) {
    const ref = raiz.doc(restaurante.id);
    const [membros, papeis, ...operacionais] = await Promise.all([
      lerColecao(ref.collection('membros'), limiteSeguro),
      lerColecao(ref.collection('papeis'), limiteSeguro),
      ...COLECOES_OPERACIONAIS.map((colecao) => lerColecao(ref.collection(colecao), limiteSeguro)),
    ]);
    leituras += 2 + COLECOES_OPERACIONAIS.length;
    const resumo = analisarRestaurante({
      documento: restaurante,
      membros: membros.documentos,
      papeis: papeis.documentos,
      indices,
      usuarios,
      operacionais: Object.fromEntries(COLECOES_OPERACIONAIS.map((colecao, indice) => [colecao, operacionais[indice].documentos])),
    });
    resultados.push({ ...resumo, truncado: membros.truncada || papeis.truncada || operacionais.some((item) => item.truncada) });
    problemas.push(...resumo.problemas);
  }
  problemas.push(...problemasGlobais);
  if (restaurantesSnapshot.size >= limiteSeguro) problemas.push({ codigo: 'LIMITE_RESTAURANTES_ATINGIDO', severidade: 'media', idRestaurante: null, recurso: 'restaurantes', mensagem: 'A varredura atingiu o limite configurado e precisa de paginação para cobertura completa.' });
  if (indicesSnapshot.size >= limiteSeguro * 2) problemas.push({ codigo: 'LIMITE_INDICES_ATINGIDO', severidade: 'media', idRestaurante: null, recurso: 'indicesDocumentosEstabelecimentos', mensagem: 'A varredura atingiu o limite de índices fiscais e precisa de paginação para cobertura completa.' });
  if (usuariosSnapshot.size >= limiteSeguro * 2) problemas.push({ codigo: 'LIMITE_USUARIOS_ATINGIDO', severidade: 'media', idRestaurante: null, recurso: 'usuarios', mensagem: 'A varredura atingiu o limite de usuários e precisa de paginação para cobertura completa.' });
  return consolidarRelatorio({ restaurantes: resultados, problemas, leituras, limites: { restaurantes: limiteSeguro, documentosPorColecao: limiteSeguro, indices: limiteSeguro * 2, usuarios: limiteSeguro * 2 } });
}

async function salvarRelatorio(relatorio, saida) {
  const destino = path.resolve(saida || `relatorio-integridade-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(destino, `${JSON.stringify(relatorio, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return destino;
}

async function executarCli() {
  const argumentos = process.argv.slice(2);
  const obterArgumento = (nome) => argumentos.find((item) => item.startsWith(`${nome}=`))?.slice(nome.length + 1);
  const limite = inteiroSeguro(obterArgumento('--limite'), LIMITE_PADRAO);
  const saida = obterArgumento('--saida');
  const { getAdminDb } = require('../../backend/firebase/admin');
  const relatorio = await gerarRelatorio({ db: getAdminDb(), limite });
  const destino = await salvarRelatorio(relatorio, saida);
  console.log(`RELATORIO_INTEGRIDADE_OK: modo somente leitura; arquivo=${destino}; problemas=${relatorio.resumo.problemasEncontrados}`);
}

if (require.main === module) {
  executarCli().catch((erro) => {
    console.error(`RELATORIO_INTEGRIDADE_FALHOU: ${erro instanceof Error ? erro.message : 'erro interno'}`);
    process.exitCode = 1;
  });
}

module.exports = { analisarIndices, analisarRestaurante, consolidarRelatorio, gerarRelatorio, inteiroSeguro, salvarRelatorio, ESTADOS_RESTAURANTE, ESTADOS_MEMBRO, ESTADOS_PAPEL, COLECOES_OPERACIONAIS };
