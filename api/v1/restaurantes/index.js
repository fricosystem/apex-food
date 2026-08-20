'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { executar } = require('../../_lib/middleware');
const { lerCorpoJson, ApiError } = require('../../_lib/http');
const { exigirSessao } = require('../../_lib/sessao');
const { definirContexto } = require('../../_lib/contexto');
const { registrarAuditoria } = require('../../_lib/auditoria');
const { getAdminDb } = require('../../../backend/firebase/admin');

function validarNomeRestaurante(valor) {
  if (typeof valor !== 'string') {
    throw new ApiError(400, 'NOME_RESTAURANTE_INVALIDO', 'Informe o nome comercial do restaurante.');
  }
  const nome = valor.trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 120 || /[\u0000-\u001F\u007F]/.test(nome)) {
    throw new ApiError(400, 'NOME_RESTAURANTE_INVALIDO', 'O nome comercial deve ter entre 2 e 120 caracteres.');
  }
  return nome;
}

function idPrimeiroRestaurante(idUsuario) {
  return crypto
    .createHash('sha256')
    .update(`${idUsuario}:primeiro-restaurante`, 'utf8')
    .digest('hex')
    .slice(0, 24);
}

async function listarRestaurantes(req, res) {
  const sessao = await exigirSessao(req);
  let consulta;
  try {
    consulta = await getAdminDb()
      .collectionGroup('membros')
      .where('idUsuario', '==', sessao.uid)
      .limit(50)
      .get();
  } catch (erro) {
    if (erro?.code === 9 || erro?.code === 'failed-precondition') {
      throw new ApiError(503, 'INDICE_RESTAURANTES_NAO_PRONTO', 'A listagem de restaurantes está sendo preparada. Tente novamente em instantes.');
    }
    throw erro;
  }

  const itens = [];
  for (const documento of consulta.docs) {
    const dadosMembro = documento.data() || {};
    const restauranteRef = documento.ref.parent.parent;
    const idRestaurante = restauranteRef?.id;
    if (!idRestaurante || dadosMembro.estado !== 'ativo' || dadosMembro.idRestaurante !== idRestaurante) continue;
    const restaurante = await getAdminDb().collection('restaurantes').doc(idRestaurante).get();
    if (!restaurante.exists) continue;
    const dados = restaurante.data() || {};
    itens.push({
      idRestaurante,
      nome: typeof dados.nome === 'string' ? dados.nome : 'Restaurante',
      estado: dados.estado || 'ativo',
      papeis: Array.isArray(dadosMembro.papeis) ? dadosMembro.papeis.slice(0, 20) : [],
    });
  }

  return { corpo: { restaurantes: itens } };
}

async function criarPrimeiroRestaurante(req, res, idRequisicao) {
  const sessao = await exigirSessao(req);
  const corpo = await lerCorpoJson(req);
  const nome = validarNomeRestaurante(corpo.nome);
  const db = getAdminDb();
  const idRestaurante = idPrimeiroRestaurante(sessao.uid);
  const usuarioRef = db.collection('usuarios').doc(sessao.uid);
  const restauranteRef = db.collection('restaurantes').doc(idRestaurante);
  const membroRef = restauranteRef.collection('membros').doc(sessao.uid);
  let criado = false;

  await db.runTransaction(async (transacao) => {
    const usuario = await transacao.get(usuarioRef);
    const restaurante = await transacao.get(restauranteRef);
    const membro = await transacao.get(membroRef);

    if (!usuario.exists) {
      throw new ApiError(404, 'USUARIO_NAO_ENCONTRADO', 'Perfil do usuário não encontrado.');
    }

    if (membro.exists && restaurante.exists) {
      const dadosMembro = membro.data() || {};
      const dadosRestaurante = restaurante.data() || {};
      if (dadosMembro.idUsuario !== sessao.uid || dadosMembro.idRestaurante !== idRestaurante || dadosMembro.estado !== 'ativo') {
        throw new ApiError(403, 'ACESSO_NEGADO', 'O vínculo do usuário não está ativo.');
      }
      transacao.set(usuarioRef, {
        idRestaurantePadrao: idRestaurante,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: sessao.uid,
        versao: FieldValue.increment(1),
      }, { merge: true });
      return;
    }

    if (restaurante.exists || membro.exists) {
      throw new ApiError(409, 'RESTAURANTE_INCONSISTENTE', 'O cadastro inicial do restaurante precisa ser revisado.');
    }

    transacao.create(restauranteRef, {
      idRestaurante,
      nome,
      estado: 'ativo',
      fusoHorario: 'America/Sao_Paulo',
      localidade: 'pt-BR',
      moeda: 'BRL',
      idProprietario: sessao.uid,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      criadoPor: sessao.uid,
      atualizadoPor: sessao.uid,
      versao: 1,
    });

    transacao.create(membroRef, {
      idUsuario: sessao.uid,
      idRestaurante,
      papeis: ['proprietario'],
      papelPrincipal: 'proprietario',
      escopos: {},
      estado: 'ativo',
      entrouEm: FieldValue.serverTimestamp(),
      convidadoPor: null,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      criadoPor: sessao.uid,
      atualizadoPor: sessao.uid,
      versao: 1,
    });

    transacao.set(usuarioRef, {
      idRestaurantePadrao: idRestaurante,
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: sessao.uid,
      versao: FieldValue.increment(1),
    }, { merge: true });
    criado = true;
  });

  definirContexto(res, idRestaurante);
  try {
    await registrarAuditoria({
      idRestaurante,
      idAtor: sessao.uid,
      papeisDoAtor: ['proprietario'],
      acao: criado ? 'restaurante.criado' : 'restaurante.contexto.revalidado',
      tipoRecurso: 'restaurante',
      idRecurso: idRestaurante,
      idOperacao: idRequisicao,
      idRequisicao,
      resultado: 'sucesso',
    });
  } catch {
    // A falha de auditoria não expõe detalhes nem desfaz a transação principal.
  }

  return {
    status: criado ? 201 : 200,
    corpo: {
      criado,
      restaurante: {
        idRestaurante,
        nome,
        estado: 'ativo',
        papeis: ['proprietario'],
      },
    },
  };
}

module.exports = async function restaurantes(req, res) {
  const mutacao = req.method === 'POST';
  return executar(req, res, { metodos: ['GET', 'POST'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    if (req.method === 'POST') return criarPrimeiroRestaurante(req, res, idRequisicao);
    return listarRestaurantes(req, res);
  });
};
