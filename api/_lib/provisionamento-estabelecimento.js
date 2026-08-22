'use strict';

const crypto = require('node:crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAdminAuth, getAdminDb } = require('../../backend/firebase/admin');
const { ApiError } = require('./http');
const { validarEmailApex, validarSenha } = require('./firebase-auth-rest');

const ESTADOS_RASCUNHO = new Set(['rascunho', 'erro_reconciliacao']);

function texto(valor, campo, minimo = 1, maximo = 160) {
  if (typeof valor !== 'string') throw new ApiError(400, 'DADO_INVALIDO', `${campo} é obrigatório.`);
  const normalizado = valor.trim().replace(/\s+/g, ' ');
  if (normalizado.length < minimo || normalizado.length > maximo || /[\u0000-\u001F\u007F]/.test(normalizado)) {
    throw new ApiError(400, 'DADO_INVALIDO', `${campo} é inválido.`);
  }
  return normalizado;
}

function opcional(valor, campo, maximo = 160) {
  if (valor === undefined || valor === null || valor === '') return '';
  return texto(valor, campo, 0, maximo);
}

function digitos(valor) {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : '';
}

function todosIguais(valor) {
  return /^([0-9])\1+$/.test(valor);
}

function validarCpf(valor) {
  const cpf = digitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  let soma = 0;
  for (let indice = 0; indice < 9; indice += 1) soma += Number(cpf[indice]) * (10 - indice);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;
  soma = 0;
  for (let indice = 0; indice < 10; indice += 1) soma += Number(cpf[indice]) * (11 - indice);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(cpf[10]);
}

function validarCnpj(valor) {
  const cnpj = digitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  const calcular = (tamanho) => {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((total, peso, indice) => total + Number(cnpj[indice]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
}

function validarDocumentoFiscal(tipoDocumento, valor) {
  if (tipoDocumento !== 'cpf' && tipoDocumento !== 'cnpj') {
    throw new ApiError(400, 'TIPO_DOCUMENTO_INVALIDO', 'Escolha CPF ou CNPJ.');
  }
  const documentoNormalizado = digitos(valor);
  const valido = tipoDocumento === 'cpf' ? validarCpf(documentoNormalizado) : validarCnpj(documentoNormalizado);
  if (!valido) throw new ApiError(400, 'DOCUMENTO_INVALIDO', `Informe um ${tipoDocumento.toUpperCase()} válido.`);
  return documentoNormalizado;
}

function mascararDocumento(tipoDocumento, documentoNormalizado) {
  if (tipoDocumento === 'cpf') return `${documentoNormalizado.slice(0, 3)}.***.***-${documentoNormalizado.slice(-2)}`;
  return `${documentoNormalizado.slice(0, 2)}.***.***/****-${documentoNormalizado.slice(-2)}`;
}

function validarNomeCompleto(valor, campo = 'Nome completo') {
  const nome = texto(valor, campo, 5, 120);
  if (nome.split(/\s+/).length < 2) throw new ApiError(400, 'NOME_COMPLETO_INVALIDO', `${campo} deve conter nome e sobrenome.`);
  return nome;
}

function validarTelefone(valor) {
  const telefone = digitos(valor);
  if (telefone.length < 10 || telefone.length > 13) throw new ApiError(400, 'TELEFONE_INVALIDO', 'Informe um telefone/WhatsApp válido.');
  return telefone;
}

function validarCep(valor) {
  const cep = digitos(valor);
  if (cep.length !== 8) throw new ApiError(400, 'CEP_INVALIDO', 'Informe um CEP válido.');
  return cep;
}

function validarEstado(valor) {
  const estado = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(estado)) throw new ApiError(400, 'ESTADO_INVALIDO', 'Informe a UF com duas letras.');
  return estado;
}

function validarDadosEstabelecimento(corpo) {
  const tipoDocumento = corpo?.tipoDocumento === 'cpf' ? 'cpf' : corpo?.tipoDocumento === 'cnpj' ? 'cnpj' : '';
  const documentoNormalizado = validarDocumentoFiscal(tipoDocumento, corpo?.documento);
  return {
    nome: texto(corpo?.nome, 'Nome do estabelecimento', 2, 120),
    tipoDocumento,
    documentoNormalizado,
    documentoMascarado: mascararDocumento(tipoDocumento, documentoNormalizado),
  };
}

function validarDadosDiretor(corpo) {
  const endereco = corpo?.endereco || {};
  return {
    nomeCompleto: validarNomeCompleto(corpo?.nomeCompleto),
    cpfNormalizado: validarDocumentoFiscal('cpf', corpo?.cpf),
    telefoneWhatsapp: validarTelefone(corpo?.telefoneWhatsapp),
    endereco: {
      cep: validarCep(endereco.cep),
      logradouro: texto(endereco.logradouro, 'Logradouro', 2, 140),
      numero: texto(endereco.numero, 'Número', 1, 20),
      complemento: opcional(endereco.complemento, 'Complemento', 80),
      bairro: texto(endereco.bairro, 'Bairro', 2, 100),
      cidade: texto(endereco.cidade, 'Cidade', 2, 100),
      estado: validarEstado(endereco.estado),
    },
  };
}

function validarDiasTeste(valor) {
  const dias = valor === undefined || valor === null || valor === '' ? 30 : Number(valor);
  if (!Number.isInteger(dias) || dias < 0 || dias > 90) throw new ApiError(400, 'PERIODO_TESTE_INVALIDO', 'O período de teste deve estar entre 0 e 90 dias.');
  return dias;
}

function garantirIdProvisionamento(valor) {
  if (typeof valor !== 'string' || !/^[a-f0-9-]{20,80}$/i.test(valor)) throw new ApiError(400, 'PROVISIONAMENTO_INVALIDO', 'Provisionamento inválido.');
  return valor;
}

function garantirChaveIdempotencia(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9:_-]{16,120}$/.test(valor)) throw new ApiError(400, 'CHAVE_IDEMPOTENCIA_INVALIDA', 'Chave de operação inválida.');
  return valor;
}

async function lerProvisionamento(db, idProvisionamento, idUsuario) {
  const referencia = db.collection('provisionamentosEstabelecimentos').doc(garantirIdProvisionamento(idProvisionamento));
  const documento = await referencia.get();
  if (!documento.exists) throw new ApiError(404, 'PROVISIONAMENTO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  const dados = documento.data() || {};
  if (dados.idCriadoPor !== idUsuario) throw new ApiError(403, 'ACESSO_NEGADO', 'Cadastro não autorizado.');
  return { referencia, dados };
}

async function criarProvisionamento({ identidade, corpo }) {
  const estabelecimento = validarDadosEstabelecimento(corpo);
  const chave = garantirChaveIdempotencia(corpo?.chaveIdempotencia);
  const idProvisionamento = crypto.createHash('sha256').update(`${identidade.idUsuario}:${chave}`, 'utf8').digest('hex').slice(0, 48);
  const db = getAdminDb();
  const referencia = db.collection('provisionamentosEstabelecimentos').doc(idProvisionamento);
  const existente = await referencia.get();
  if (existente.exists) {
    const dadosExistentes = existente.data() || {};
    if (dadosExistentes.idCriadoPor !== identidade.idUsuario) throw new ApiError(403, 'ACESSO_NEGADO', 'Cadastro não autorizado.');
    if (dadosExistentes.dadosEstabelecimentoValidados?.documentoNormalizado !== estabelecimento.documentoNormalizado || dadosExistentes.dadosEstabelecimentoValidados?.tipoDocumento !== estabelecimento.tipoDocumento) {
      throw new ApiError(409, 'CHAVE_IDEMPOTENCIA_REUTILIZADA', 'A chave de operação já está vinculada a outro documento.');
    }
    return {
      idProvisionamento,
      etapaAtual: dadosExistentes.etapaAtual || 2,
      estado: dadosExistentes.estado || 'rascunho',
      estabelecimento: {
        nome: dadosExistentes.dadosEstabelecimentoValidados?.nome || estabelecimento.nome,
        tipoDocumento: dadosExistentes.dadosEstabelecimentoValidados?.tipoDocumento || estabelecimento.tipoDocumento,
        documentoMascarado: dadosExistentes.dadosEstabelecimentoValidados?.documentoMascarado || estabelecimento.documentoMascarado,
      },
    };
  }
  await referencia.create({
    idProvisionamento,
    chaveIdempotencia: chave,
    etapaAtual: 2,
    estado: 'rascunho',
    idCriadoPor: identidade.idUsuario,
    dadosEstabelecimentoValidados: estabelecimento,
    dadosDiretorValidados: null,
    emailDiretorCanonico: null,
    idRestauranteCriado: null,
    idDiretorCriado: null,
    tentativas: 0,
    expiraEm: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: 1,
  });
  return {
    idProvisionamento,
    etapaAtual: 2,
    estado: 'rascunho',
    estabelecimento: {
      nome: estabelecimento.nome,
      tipoDocumento: estabelecimento.tipoDocumento,
      documentoMascarado: estabelecimento.documentoMascarado,
    },
  };
}

async function salvarDadosDiretor({ identidade, corpo }) {
  const idProvisionamento = garantirIdProvisionamento(corpo?.idProvisionamento);
  const diretor = validarDadosDiretor(corpo);
  const db = getAdminDb();
  const { referencia, dados } = await lerProvisionamento(db, idProvisionamento, identidade.idUsuario);
  if (!ESTADOS_RASCUNHO.has(dados.estado) || dados.etapaAtual < 2) throw new ApiError(409, 'PROVISIONAMENTO_NAO_EDITAVEL', 'Este cadastro não pode mais ser alterado.');
  await referencia.update({
    etapaAtual: 3,
    dadosDiretorValidados: diretor,
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: FieldValue.increment(1),
  });
  return { idProvisionamento, etapaAtual: 3, estado: dados.estado };
}

function emailDoCorpo(corpo) {
  return validarEmailApex(corpo?.email);
}

async function criarUsuarioAuth(email, senha, nomeCompleto) {
  try {
    return { usuario: await getAdminAuth().createUser({ email, password: senha, displayName: nomeCompleto }), criadoAgora: true };
  } catch (erro) {
    if (erro?.code === 'auth/email-already-exists') throw new ApiError(409, 'EMAIL_DIRETOR_EM_USO', 'O email informado já está vinculado a uma conta.');
    throw erro;
  }
}

async function concluirProvisionamento({ identidade, corpo }) {
  const idProvisionamento = garantirIdProvisionamento(corpo?.idProvisionamento);
  const email = emailDoCorpo(corpo);
  const senha = validarSenha(corpo?.senha);
  if (senha !== corpo?.confirmarSenha) throw new ApiError(400, 'SENHAS_DIFERENTES', 'As senhas não coincidem.');

  const db = getAdminDb();
  const { referencia: provisionamentoRef, dados } = await lerProvisionamento(db, idProvisionamento, identidade.idUsuario);
  if (!ESTADOS_RASCUNHO.has(dados.estado) || dados.etapaAtual < 3 || !dados.dadosDiretorValidados) {
    if (dados.estado === 'concluido' && dados.idRestauranteCriado) {
      return { criado: false, idProvisionamento, idRestaurante: dados.idRestauranteCriado, idDiretor: dados.idDiretorCriado };
    }
    throw new ApiError(409, 'PROVISIONAMENTO_INCOMPLETO', 'Conclua as etapas anteriores antes de finalizar.');
  }

  await provisionamentoRef.update({
    estado: 'em_processamento',
    emailDiretorCanonico: email,
    tentativas: FieldValue.increment(1),
    atualizadoEm: FieldValue.serverTimestamp(),
    versao: FieldValue.increment(1),
  });

  let usuarioAuth = null;
  let criadoAgora = false;
  try {
    if (dados.idDiretorCriado) {
      usuarioAuth = await getAdminAuth().getUser(dados.idDiretorCriado);
      if ((usuarioAuth.email || '').toLowerCase() !== email) throw new ApiError(409, 'PROVISIONAMENTO_INCONSISTENTE', 'O email não corresponde ao cadastro em processamento.');
    } else {
      const resultadoAuth = await criarUsuarioAuth(email, senha, dados.dadosDiretorValidados.nomeCompleto);
      usuarioAuth = resultadoAuth.usuario;
      criadoAgora = resultadoAuth.criadoAgora;
      await provisionamentoRef.update({ idDiretorCriado: usuarioAuth.uid, atualizadoEm: FieldValue.serverTimestamp() });
    }

    const idRestaurante = crypto.randomBytes(12).toString('hex');
    const idPlano = 'plano-inicial';
    const restauranteRef = db.collection('restaurantes').doc(idRestaurante);
    const indiceRef = db.collection('indicesDocumentosEstabelecimentos').doc(`${dados.dadosEstabelecimentoValidados.tipoDocumento}_${dados.dadosEstabelecimentoValidados.documentoNormalizado}`);
    const usuarioRef = db.collection('usuarios').doc(usuarioAuth.uid);
    const membroRef = restauranteRef.collection('membros').doc(usuarioAuth.uid);
    const papelRef = restauranteRef.collection('papeis').doc('diretor');
    const planoRef = restauranteRef.collection('planos').doc(idPlano);
    const resumoRef = db.collection('resumosEstabelecimentos').doc(idRestaurante);
    const diasTeste = validarDiasTeste(corpo?.diasTeste);
    const inicioTeste = Timestamp.now();
    const fimTeste = Timestamp.fromMillis(Date.now() + diasTeste * 24 * 60 * 60 * 1000);
    const planoInicial = diasTeste > 0
      ? { codigoPlano: 'teste', nomePlano: 'Período de teste', estado: 'ativo' }
      : { codigoPlano: 'basico', nomePlano: 'Plano básico', estado: 'ativo' };

    await db.runTransaction(async (transacao) => {
      const [indice, restaurante, usuario] = await Promise.all([
        transacao.get(indiceRef),
        transacao.get(restauranteRef),
        transacao.get(usuarioRef),
      ]);
      if (indice.exists) {
        const dadosIndice = indice.data() || {};
        if (dadosIndice.idRestaurante !== idRestaurante || dadosIndice.estado !== 'ativo') throw new ApiError(409, 'DOCUMENTO_JA_CADASTRADO', 'O CPF/CNPJ informado já está cadastrado.');
      }
      if (restaurante.exists) throw new ApiError(409, 'RESTAURANTE_DUPLICADO', 'Não foi possível reservar o estabelecimento.');
      if (usuario.exists && usuario.data()?.idUsuario && usuario.data().idUsuario !== usuarioAuth.uid) throw new ApiError(409, 'USUARIO_INCONSISTENTE', 'O perfil do Diretor está inconsistente.');

      const estabelecimento = dados.dadosEstabelecimentoValidados;
      const diretor = dados.dadosDiretorValidados;
      const planoEstado = planoInicial.estado;
      transacao.create(restauranteRef, {
        idRestaurante,
        nome: estabelecimento.nome,
        tipoDocumento: estabelecimento.tipoDocumento,
        documentoNormalizado: estabelecimento.documentoNormalizado,
        documentoMascarado: estabelecimento.documentoMascarado,
        estado: diasTeste > 0 ? 'em_teste' : 'ativo',
        idDiretor: usuarioAuth.uid,
        idCriadoPor: identidade.idUsuario,
        planoAtual: { ...planoInicial, inicioEm: inicioTeste, fimEm: fimTeste, estado: planoEstado, versao: 1 },
        periodoTeste: { inicioEm: inicioTeste, fimEm: fimTeste, diasConcedidos: diasTeste, concedidoPor: identidade.idUsuario, motivo: 'Provisionamento inicial' },
        limites: { usuariosAtivos: 10, mesas: 20, produtosCardapio: 200, pedidosMensais: 1000, armazenamentoMb: 512 },
        excecoesAtivas: [],
        fusoHorario: 'America/Sao_Paulo',
        localidade: 'pt-BR',
        moeda: 'BRL',
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        criadoPor: identidade.idUsuario,
        atualizadoPor: identidade.idUsuario,
        versao: 1,
      });
      transacao.create(indiceRef, {
        tipoDocumento: estabelecimento.tipoDocumento,
        documentoNormalizado: estabelecimento.documentoNormalizado,
        idRestaurante,
        estado: 'ativo',
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      transacao.set(usuarioRef, {
        idUsuario: usuarioAuth.uid,
        emailCanonico: email,
        nomeExibicao: diretor.nomeCompleto,
        nomeCompleto: diretor.nomeCompleto,
        cpfNormalizado: diretor.cpfNormalizado,
        telefoneWhatsapp: diretor.telefoneWhatsapp,
        dadosPrivados: { endereco: diretor.endereco },
        tipoConta: 'diretor',
        estado: 'ativo',
        acessoGlobal: 'nenhum',
        papeisGlobais: [],
        idRestaurantePadrao: idRestaurante,
        emailVerificado: usuarioAuth.emailVerified === true,
        atualizadoEm: FieldValue.serverTimestamp(),
        criadoEm: FieldValue.serverTimestamp(),
        versao: 1,
      }, { merge: true });
      transacao.create(membroRef, {
        idUsuario: usuarioAuth.uid,
        idRestaurante,
        papeis: ['diretor'],
        papelPrincipal: 'diretor',
        permissoesDiretas: [],
        escopos: {},
        estado: 'ativo',
        entrouEm: FieldValue.serverTimestamp(),
        convidadoPor: identidade.idUsuario,
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        criadoPor: identidade.idUsuario,
        atualizadoPor: identidade.idUsuario,
        versao: 1,
      });
      transacao.create(papelRef, {
        codigo: 'diretor',
        nome: 'Diretor',
        descricao: 'Gestão do estabelecimento e de sua equipe.',
        permissoes: ['estabelecimento.visualizar', 'estabelecimento.configurar', 'equipe.visualizar', 'equipe.gerenciar', 'cardapio.gerenciar', 'pedidos.operar', 'cozinha.operar', 'caixa.operar', 'relatorios.visualizar'],
        sistema: true,
        estado: 'ativo',
        criadoPor: identidade.idUsuario,
        atualizadoPor: identidade.idUsuario,
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: 1,
      });
      transacao.create(planoRef, {
        codigoPlano: planoInicial.codigoPlano,
        nomePlano: planoInicial.nomePlano,
        inicioEm: inicioTeste,
        fimEm: fimTeste,
        estado: planoEstado,
        limites: { usuariosAtivos: 10, mesas: 20, produtosCardapio: 200, pedidosMensais: 1000, armazenamentoMb: 512 },
        origem: 'provisionamento_desenvolvedor',
        motivo: 'Provisionamento inicial',
        criadoPor: identidade.idUsuario,
        criadoEm: FieldValue.serverTimestamp(),
      });
      transacao.create(resumoRef, {
        idRestaurante,
        estado: diasTeste > 0 ? 'em_teste' : 'ativo',
        planoAtual: planoInicial.codigoPlano,
        usuariosAtivos: 1,
        pedidosPeriodo: 0,
        faturamentoPeriodoCentavos: 0,
        ticketMedioCentavos: 0,
        avaliacaoMedia: null,
        ultimaAtividadeEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: 1,
      });
      transacao.update(provisionamentoRef, {
        estado: 'concluido',
        idRestauranteCriado: idRestaurante,
        idDiretorCriado: usuarioAuth.uid,
        concluidoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        versao: FieldValue.increment(1),
      });
    });

    return { criado: true, idProvisionamento, idRestaurante, idDiretor: usuarioAuth.uid, nomeRestaurante: dados.dadosEstabelecimentoValidados.nome, emailDiretor: email };
  } catch (erro) {
    if (criadoAgora && usuarioAuth?.uid) {
      try { await getAdminAuth().deleteUser(usuarioAuth.uid); } catch {}
    }
    try {
      await provisionamentoRef.update({ estado: 'erro_reconciliacao', ultimoErroPublico: erro instanceof ApiError ? erro.code : 'ERRO_PROVISIONAMENTO', atualizadoEm: FieldValue.serverTimestamp(), versao: FieldValue.increment(1) });
    } catch {}
    throw erro;
  }
}

module.exports = {
  validarCpf,
  validarCnpj,
  validarDocumentoFiscal,
  validarDadosEstabelecimento,
  validarDadosDiretor,
  validarDiasTeste,
  garantirIdProvisionamento,
  garantirChaveIdempotencia,
  criarProvisionamento,
  salvarDadosDiretor,
  concluirProvisionamento,
};
