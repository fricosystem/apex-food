'use strict';

const { executar } = require('./middleware');
const { lerCorpoJson, ApiError } = require('./http');
const { exigirSessao, criarSessao } = require('./sessao');
const { resolverIdentidadeSessao } = require('./autorizacao');
const { lerContexto } = require('./contexto');
const {
  lerUsuario,
  atualizarNomeUsuario,
  atualizarPreferenciasUsuario,
} = require('./usuarios');
const {
  autenticarUsuario,
  atualizarSenha,
} = require('./firebase-auth-rest');
const { registrarAuditoria } = require('./auditoria');
const {
  queryString,
  textoObrigatorio,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');
const { consumir } = require('./limite');

const PREFERENCIAS_PERMITIDAS = new Set(['alertasOperacionais', 'avisosSistema']);

function timestampParaIsoSegundos(valor) {
  const segundos = Number(valor);
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  return new Date(segundos * 1000).toISOString();
}

function preferenciaBooleana(valor, padrao = true) {
  return typeof valor === 'boolean' ? valor : padrao;
}

function dtoPerfil({ sessao, usuario }) {
  const preferencias = usuario?.preferenciasNotificacao && typeof usuario.preferenciasNotificacao === 'object'
    ? usuario.preferenciasNotificacao
    : {};
  return {
    idUsuario: sessao.uid,
    emailCanonico: usuario?.emailCanonico || (typeof sessao.email === 'string' ? sessao.email.toLowerCase() : null),
    nomeExibicao: usuario?.nomeExibicao || null,
    estado: usuario?.estado || 'ativo',
    emailVerificado: sessao.email_verified === true,
    preferenciasNotificacao: {
      alertasOperacionais: preferenciaBooleana(preferencias.alertasOperacionais),
      avisosSistema: preferenciaBooleana(preferencias.avisosSistema),
    },
  };
}

function dtoSessao(sessao) {
  return {
    autenticado: true,
    autenticadoEm: timestampParaIsoSegundos(sessao.auth_time),
    expiraEm: timestampParaIsoSegundos(sessao.exp),
  };
}

async function identidadeOpcional(req, sessao) {
  const contexto = lerContexto(req);
  if (!contexto?.idRestaurante) return null;
  try {
    return await resolverIdentidadeSessao({ sessao, idRestaurante: contexto.idRestaurante });
  } catch {
    return null;
  }
}

async function auditar({ identidade, sessao, idRequisicao, acao, resultado = 'sucesso', codigoMotivo = null }) {
  if (identidade) {
    await registrarAuditoriaOperacional({
      identidade,
      idRequisicao,
      acao,
      tipoRecurso: 'usuario',
      idRecurso: sessao.uid,
      resultado,
      codigoMotivo,
    });
    return;
  }
  try {
    await registrarAuditoria({
      idAtor: sessao.uid,
      idOperacao: idRequisicao,
      idRequisicao,
      acao,
      tipoRecurso: 'usuario',
      idRecurso: sessao.uid,
      resultado,
      codigoMotivo,
    });
  } catch {
    // A falha de auditoria não deve revelar detalhes nem bloquear o perfil.
  }
}

async function consultarPerfil(req, sessao) {
  const usuario = await lerUsuario(sessao.uid);
  const identidade = await identidadeOpcional(req, sessao);
  return {
    corpo: {
      perfil: dtoPerfil({ sessao, usuario }),
      sessao: dtoSessao(sessao),
      restauranteAtivo: identidade ? {
        idRestaurante: identidade.idRestaurante,
        papeis: identidade.papeis,
      } : null,
    },
  };
}

function validarPreferencias(corpo) {
  const preferencias = corpo?.preferencias;
  if (!preferencias || typeof preferencias !== 'object' || Array.isArray(preferencias)) {
    throw new ApiError(400, 'PREFERENCIAS_INVALIDAS', 'Informe as preferências da conta.');
  }
  const chaves = Object.keys(preferencias);
  if (!chaves.length || chaves.some(chave => !PREFERENCIAS_PERMITIDAS.has(chave))) {
    throw new ApiError(400, 'PREFERENCIAS_INVALIDAS', 'Preferência de notificação inválida.');
  }
  for (const chave of chaves) {
    if (typeof preferencias[chave] !== 'boolean') {
      throw new ApiError(400, 'PREFERENCIAS_INVALIDAS', 'As preferências devem ser ativadas ou desativadas.');
    }
  }
  return preferencias;
}

async function atualizarPerfil(req, sessao, identidade, corpo, idRequisicao) {
  if (corpo?.acao !== 'atualizar_perfil') {
    throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de perfil inválida.');
  }
  const nomeExibicao = textoObrigatorio(corpo.nomeExibicao, 'Nome de exibição', 120);
  await atualizarNomeUsuario({ idUsuario: sessao.uid, nomeExibicao });
  await auditar({ identidade, sessao, idRequisicao, acao: 'usuario.nome_atualizado' });
  return consultarPerfil(req, sessao);
}

async function atualizarPreferencias(req, sessao, identidade, corpo, idRequisicao) {
  if (corpo?.acao !== 'atualizar_preferencias') {
    throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de preferências inválida.');
  }
  const preferencias = validarPreferencias(corpo);
  await atualizarPreferenciasUsuario({ idUsuario: sessao.uid, preferencias });
  await auditar({ identidade, sessao, idRequisicao, acao: 'usuario.preferencias_atualizadas' });
  return consultarPerfil(req, sessao);
}

async function alterarSenha(req, res, sessao, identidade, corpo, idRequisicao) {
  if (corpo?.acao !== 'alterar_senha') {
    throw new ApiError(400, 'ACAO_INVALIDA', 'Ação de senha inválida.');
  }
  if (typeof corpo.senhaAtual !== 'string' || !corpo.senhaAtual) {
    throw new ApiError(400, 'SENHA_ATUAL_OBRIGATORIA', 'Informe a senha atual.');
  }
  if (typeof corpo.novaSenha !== 'string' || !corpo.novaSenha) {
    throw new ApiError(400, 'NOVA_SENHA_OBRIGATORIA', 'Informe a nova senha.');
  }
  if (corpo.novaSenha !== corpo.confirmarNovaSenha) {
    throw new ApiError(400, 'SENHAS_NAO_CONFEREM', 'A confirmação da nova senha não confere.');
  }
  if (corpo.senhaAtual === corpo.novaSenha) {
    throw new ApiError(400, 'SENHA_IGUAL', 'A nova senha deve ser diferente da senha atual.');
  }

  const usuario = await lerUsuario(sessao.uid);
  const email = usuario?.emailCanonico || sessao.email;
  if (typeof email !== 'string' || !email) {
    throw new ApiError(409, 'EMAIL_NAO_DISPONIVEL', 'Não foi possível identificar o email da conta.');
  }

  let autenticacaoAtual;
  try {
    autenticacaoAtual = await autenticarUsuario(email, corpo.senhaAtual);
  } catch (erro) {
    if (erro?.code === 'AUTH_NAO_CONFIGURADO' || erro?.code === 'AUTENTICACAO_NAO_DISPONIVEL') throw erro;
    await auditar({ identidade, sessao, idRequisicao, acao: 'usuario.senha_alteracao', resultado: 'negado', codigoMotivo: 'senha_atual_invalida' });
    throw new ApiError(401, 'SENHA_ATUAL_INVALIDA', 'A senha atual não confere.');
  }

  const novaAutenticacao = await atualizarSenha(autenticacaoAtual.idToken, corpo.novaSenha);
  await criarSessao(res, novaAutenticacao.idToken);
  await auditar({ identidade, sessao, idRequisicao, acao: 'usuario.senha_alterada' });
  return { corpo: { alterada: true, mensagem: 'Senha alterada com sucesso.' } };
}

module.exports = async function perfil(req, res) {
  const metodo = String(req.method || '').toUpperCase();
  const mutacao = ['POST', 'PATCH'].includes(metodo);
  return executar(req, res, { metodos: ['GET', 'POST', 'PATCH'], mutacao, appCheck: true }, async ({ idRequisicao }) => {
    const sessao = await exigirSessao(req);
    if (metodo === 'GET') {
      await consumir(req, 'perfil_consulta', 60, 60 * 1000);
      return consultarPerfil(req, sessao);
    }

    await consumir(req, 'perfil_mutacao', 15, 60 * 1000);
    const identidade = await identidadeOpcional(req, sessao);
    const corpo = await lerCorpoJson(req);
    const recurso = queryString(req, 'recurso');
    if (recurso === 'preferencias') return atualizarPreferencias(req, sessao, identidade, corpo, idRequisicao);
    if (corpo?.acao === 'alterar_senha') return alterarSenha(req, res, sessao, identidade, corpo, idRequisicao);
    return atualizarPerfil(req, sessao, identidade, corpo, idRequisicao);
  });
};
