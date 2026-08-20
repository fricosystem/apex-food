'use strict';

const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { getAdminDb } = require('../../backend/firebase/admin');
const {
  ApiError,
  obterCookies,
  atributoCookie,
  adicionarCookie,
  apagarCookie,
} = require('./http');
const { cookiesSeguros, origemAplicacao } = require('./config');
const { caminhoRestaurante } = require('./modulos-operacionais');

const NOME_COOKIE_MESA = 'apex_mesa';
const TTL_SESSAO_MESA_SEGUNDOS = 4 * 60 * 60;
const ESTADOS_COMANDA_ATIVA = new Set(['aberta', 'em_consumo']);
const ESTADOS_MESA_BLOQUEADOS = new Set(['indisponivel', 'bloqueada', 'excluido']);

function segredoSessao() {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.startsWith('replace-with-') || valor.length < 32) {
    throw new ApiError(503, 'SESSAO_MESA_NAO_CONFIGURADA', 'Sessão da mesa temporariamente indisponível.');
  }
  return valor;
}

function cookiesMesaSeguros() {
  return cookiesSeguros();
}

function nomeCookieMesa() {
  return cookiesMesaSeguros() ? '__Host-apex_mesa' : NOME_COOKIE_MESA;
}

function hashSha256(valor) {
  return crypto.createHash('sha256').update(String(valor), 'utf8').digest('hex');
}

function assinatura(valor) {
  return crypto.createHmac('sha256', segredoSessao()).update(valor, 'utf8').digest('base64url');
}

function chaveCriptografia() {
  return crypto.createHash('sha256').update(`qrcode:${segredoSessao()}`, 'utf8').digest();
}

function cifrarToken(valor) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chaveCriptografia(), iv);
  const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv, tag, conteudo].map(parte => parte.toString('base64url')).join('.');
}

function decifrarToken(valor) {
  try {
    const [ivTexto, tagTexto, conteudoTexto] = String(valor || '').split('.');
    const decifra = crypto.createDecipheriv('aes-256-gcm', chaveCriptografia(), Buffer.from(ivTexto, 'base64url'));
    decifra.setAuthTag(Buffer.from(tagTexto, 'base64url'));
    return Buffer.concat([decifra.update(Buffer.from(conteudoTexto, 'base64url')), decifra.final()]).toString('utf8');
  } catch {
    throw new ApiError(503, 'QR_NAO_RECUPERAVEL', 'Não foi possível recuperar o QR Code desta operação.');
  }
}

function codificarSessaoMesa(idRestaurante, idSessaoMesa, expiraEm) {
  const conteudo = Buffer.from(JSON.stringify({ idRestaurante, idSessaoMesa, expiraEm }), 'utf8').toString('base64url');
  return `${conteudo}.${assinatura(conteudo)}`;
}

function decodificarSessaoMesa(valor) {
  if (typeof valor !== 'string') return null;
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const esperado = assinatura(partes[0]);
  const recebido = Buffer.from(partes[1]);
  const referencia = Buffer.from(esperado);
  if (recebido.length !== referencia.length || !crypto.timingSafeEqual(recebido, referencia)) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(dados?.idRestaurante || '')) || !/^[A-Za-z0-9_-]{20,128}$/.test(String(dados?.idSessaoMesa || '')) || Number(dados.expiraEm) <= Date.now()) return null;
    return { idRestaurante: dados.idRestaurante, idSessaoMesa: dados.idSessaoMesa, expiraEm: Number(dados.expiraEm), valor };
  } catch {
    return null;
  }
}

function adicionarCookieSessaoMesa(res, idRestaurante, idSessaoMesa, expiraEm) {
  const valor = codificarSessaoMesa(idRestaurante, idSessaoMesa, expiraEm);
  adicionarCookie(res, atributoCookie(nomeCookieMesa(), valor, {
    httpOnly: true,
    secure: cookiesMesaSeguros(),
    sameSite: 'Lax',
    maxAge: Math.max(0, Math.floor((expiraEm - Date.now()) / 1000)),
  }));
  return valor;
}

function limparCookieSessaoMesa(res) {
  apagarCookie(res, nomeCookieMesa());
}

function lerSessaoMesaCookie(req) {
  const valor = obterCookies(req)[nomeCookieMesa()];
  return decodificarSessaoMesa(valor);
}

function validarId(valor, campo) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function validarTokenQr(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(valor)) {
    throw new ApiError(400, 'QR_INVALIDO', 'QR Code inválido.');
  }
  return valor;
}

function validarNomeCompleto(valor) {
  const nome = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
  if (!nome || nome.length < 5 || nome.length > 160 || nome.split(' ').length < 2) {
    throw new ApiError(400, 'NOME_COMPLETO_INVALIDO', 'Informe seu nome completo para atendimento.');
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’.-]*(?: [\p{L}\p{M}][\p{L}\p{M}'’.-]*)+$/u.test(nome)) {
    throw new ApiError(400, 'NOME_COMPLETO_INVALIDO', 'Informe seu nome completo para atendimento.');
  }
  return nome;
}

function validarChaveIdempotencia(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(valor.trim())) {
    throw new ApiError(400, 'IDEMPOTENCIA_INVALIDA', 'A chave da operação é inválida.');
  }
  return valor.trim();
}

function origemPublica(req) {
  const configurada = origemAplicacao();
  if (configurada) return configurada.replace(/\/$/, '');
  const host = String(req.headers?.host || '').split(',')[0].trim();
  const protocolo = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (!host || !/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host) || !['http', 'https'].includes(protocolo)) {
    throw new ApiError(503, 'ORIGEM_NAO_CONFIGURADA', 'Origem pública temporariamente indisponível.');
  }
  return `${protocolo}://${host}`;
}

function dtoMesaPublica(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    nome: String(dados.nome || dados.numero || 'Mesa'),
    numero: dados.numero ?? null,
    capacidade: Number(dados.capacidade || 0),
  };
}

function dtoSessaoPublica(sessaoDocumento, mesaDocumento, comandaDocumento, participanteDocumento) {
  const sessao = sessaoDocumento.data() || {};
  const participante = participanteDocumento?.data() || {};
  const comanda = comandaDocumento?.data() || {};
  return {
    sessao: {
      id: sessaoDocumento.id,
      estado: sessao.estadoSessao || 'ativa',
      expiraEm: sessao.expiraEm?.toDate ? sessao.expiraEm.toDate().toISOString() : sessao.expiraEm || null,
    },
    mesa: dtoMesaPublica(mesaDocumento),
    participante: {
      id: participanteDocumento?.id || sessao.idParticipante,
      nomeCompleto: participante.nomeCompleto || sessao.nomeCompleto || '',
      nomeExibicao: participante.nomeExibicao || sessao.nomeExibicao || '',
    },
    comanda: {
      id: comandaDocumento?.id || sessao.idComanda,
      status: comanda.statusComanda || comanda.status || 'aberta',
      totalCentavos: Number(comanda.totalCentavos || 0),
      quantidadePedidosAbertos: Number(comanda.quantidadePedidosAbertos || 0),
    },
  };
}

async function buscarMesaPorToken(token) {
  const hash = hashSha256(token);
  const consulta = await getAdminDb().collectionGroup('mesas').where('qrHash', '==', hash).limit(1).get();
  const mesaDocumento = consulta.docs[0];
  if (!mesaDocumento) throw new ApiError(404, 'QR_NAO_ENCONTRADO', 'Este QR Code não está ativo.');
  const dados = mesaDocumento.data() || {};
  if (dados.qrAtivo !== true || dados.qrHash !== hash || dados.estado === 'excluido') {
    throw new ApiError(404, 'QR_NAO_ENCONTRADO', 'Este QR Code não está ativo.');
  }
  const restauranteRef = mesaDocumento.ref.parent.parent;
  return { restauranteRef, mesaRef: mesaDocumento.ref, mesaDocumento };
}

async function consultarQrPublico(token) {
  const valido = validarTokenQr(token);
  const encontrado = await buscarMesaPorToken(valido);
  return {
    restaurante: { nome: String(encontrado.restauranteRef.data()?.nomeFantasia || encontrado.restauranteRef.data()?.nome || 'Restaurante') },
    mesa: dtoMesaPublica(encontrado.mesaDocumento),
  };
}

async function abrirSessaoMesa({ token, nomeCompleto, chaveIdempotencia, req, res }) {
  const tokenValido = validarTokenQr(token);
  const nome = validarNomeCompleto(nomeCompleto);
  const chave = validarChaveIdempotencia(chaveIdempotencia);
  const db = getAdminDb();
  const hashToken = hashSha256(tokenValido);
  const hashPayload = hashSha256(JSON.stringify({ hashToken, nome }));
  const encontrado = await buscarMesaPorToken(tokenValido);
  const restauranteRef = encontrado.restauranteRef;
  const mesaRef = encontrado.mesaRef;
  const idRestaurante = restauranteRef.id;
  const idOperacao = hashSha256(`${idRestaurante}:sessao-mesa:${chave}`).slice(0, 40);
  const idempotenciaRef = restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  let resultado;
  let cookieExpiraEm;

  await db.runTransaction(async (transacao) => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da operação já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      cookieExpiraEm = Number(resultado?.expiraEm || 0);
      return;
    }

    const mesaDocumento = await transacao.get(mesaRef);
    if (!mesaDocumento.exists) throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    const mesa = mesaDocumento.data() || {};
    if (mesa.qrAtivo !== true || mesa.qrHash !== hashToken) throw new ApiError(404, 'QR_NAO_ENCONTRADO', 'Este QR Code não está ativo.');
    if (ESTADOS_MESA_BLOQUEADOS.has(mesa.estado) || mesa.estadoAtendimento === 'encaminhada_caixa') throw new ApiError(409, 'MESA_INDISPONIVEL', 'Esta mesa não está disponível para novos pedidos.');

    let comandaRef = mesa.idComandaAberta ? restauranteRef.collection('comandas').doc(String(mesa.idComandaAberta)) : null;
    let comandaDocumento = comandaRef ? await transacao.get(comandaRef) : null;
    if (!comandaDocumento?.exists || !ESTADOS_COMANDA_ATIVA.has(comandaDocumento.data()?.statusComanda || comandaDocumento.data()?.status)) {
      comandaRef = restauranteRef.collection('comandas').doc();
      comandaDocumento = null;
      transacao.set(comandaRef, {
        idRestaurante,
        idMesa: mesaRef.id,
        statusComanda: 'aberta',
        status: 'aberta',
        idGarcomResponsavel: null,
        participantesAtivos: 1,
        quantidadePedidosAbertos: 0,
        subtotalCentavos: 0,
        descontoCentavos: 0,
        totalCentavos: 0,
        resumoOperacional: {},
        abertaEm: FieldValue.serverTimestamp(),
        atualizadaEm: FieldValue.serverTimestamp(),
        versao: 1,
      });
    }

    const participanteRef = comandaRef.collection('participantes').doc();
    const sessaoRef = restauranteRef.collection('sessoesMesa').doc();
    const expiraEm = Date.now() + TTL_SESSAO_MESA_SEGUNDOS * 1000;
    const cookieValor = codificarSessaoMesa(sessaoRef.id, expiraEm);
    resultado = {
      idSessaoMesa: sessaoRef.id,
      idComanda: comandaRef.id,
      idParticipante: participanteRef.id,
      nomeCompleto: nome,
      nomeExibicao: nome,
      expiraEm,
    };
    cookieExpiraEm = expiraEm;

    transacao.set(participanteRef, {
      idRestaurante,
      idComanda: comandaRef.id,
      idMesa: mesaRef.id,
      nomeCompleto: nome,
      nomeExibicao: nome,
      idSessaoMesa: sessaoRef.id,
      estadoParticipante: 'ativo',
      entrouEm: FieldValue.serverTimestamp(),
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: 1,
    });
    transacao.set(sessaoRef, {
      idRestaurante,
      idMesa: mesaRef.id,
      idComanda: comandaRef.id,
      idParticipante: participanteRef.id,
      nomeCompleto: nome,
      nomeExibicao: nome,
      hashSessao: hashSha256(cookieValor),
      estadoSessao: 'ativa',
      criadaEm: FieldValue.serverTimestamp(),
      ultimoAcessoEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(expiraEm),
      versao: 1,
    });
    transacao.update(mesaRef, {
      estado: mesa.estado === 'ocupada' ? 'ocupada' : 'ocupada',
      estadoAtendimento: 'ocupada',
      idComandaAberta: comandaRef.id,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(mesa.versao || 1) + 1,
    });
    if (comandaDocumento?.exists) {
      const comanda = comandaDocumento.data() || {};
      transacao.update(comandaRef, {
        participantesAtivos: Number(comanda.participantesAtivos || 0) + 1,
        atualizadaEm: FieldValue.serverTimestamp(),
        versao: Number(comanda.versao || 1) + 1,
      });
    }
    transacao.set(restauranteRef.collection('eventosMesas').doc(), {
      idRestaurante,
      idMesa: mesaRef.id,
      idComanda: comandaRef.id,
      acao: 'sessao_mesa_aberta',
      estadoAnterior: mesa.estado || 'disponivel',
      estadoNovo: 'ocupada',
      idAtor: 'sessao-mesa',
      idOperacao,
      criadoEm: FieldValue.serverTimestamp(),
    });
    transacao.create(idempotenciaRef, {
      idRestaurante,
      idAtor: 'sessao-mesa',
      endpoint: '/api/v1/qrcode-mesa',
      tipoOperacao: 'abrir_sessao',
      hashPayload,
      resultado,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(expiraEm),
      versao: 1,
    });
  });

  adicionarCookieSessaoMesa(res, idRestaurante, resultado.idSessaoMesa, cookieExpiraEm);
  return {
    sessao: {
      id: resultado.idSessaoMesa,
      expiraEm: new Date(cookieExpiraEm).toISOString(),
    },
    mesa: { id: encontrado.mesaRef.id, ...dtoMesaPublica(encontrado.mesaDocumento) },
    participante: {
      id: resultado.idParticipante,
      nomeCompleto: resultado.nomeCompleto,
      nomeExibicao: resultado.nomeExibicao,
    },
    comanda: { id: resultado.idComanda, status: 'aberta' },
  };
}

async function consultarSessaoMesa(req, res) {
  const cookie = lerSessaoMesaCookie(req);
  if (!cookie) throw new ApiError(401, 'SESSAO_MESA_NAO_ENCONTRADA', 'Abra o QR Code da mesa para iniciar o atendimento.');
  const restauranteRef = caminhoRestaurante(cookie.idRestaurante);
  const sessaoRef = restauranteRef.collection('sessoesMesa').doc(cookie.idSessaoMesa);
  const sessaoDocumento = await sessaoRef.get();
  if (!sessaoDocumento.exists) {
    limparCookieSessaoMesa(res);
    throw new ApiError(401, 'SESSAO_MESA_EXPIRADA', 'A sessão da mesa não está mais disponível.');
  }
  const sessao = sessaoDocumento.data() || {};
  if (sessao.estadoSessao !== 'ativa' || sessao.expiraEm?.toDate?.().getTime?.() <= Date.now()) {
    limparCookieSessaoMesa(res);
    throw new ApiError(401, 'SESSAO_MESA_EXPIRADA', 'A sessão da mesa não está mais disponível.');
  }
  const [mesaDocumento, comandaDocumento, participanteDocumento] = await Promise.all([
    restauranteRef.collection('mesas').doc(String(sessao.idMesa)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).collection('participantes').doc(String(sessao.idParticipante)).get(),
  ]);
  if (!mesaDocumento.exists || !comandaDocumento.exists) throw new ApiError(409, 'ATENDIMENTO_NAO_DISPONIVEL', 'O atendimento desta mesa não está disponível.');
  await sessaoDocumento.ref.update({ ultimoAcessoEm: FieldValue.serverTimestamp() });
  return dtoSessaoPublica(sessaoDocumento, mesaDocumento, comandaDocumento, participanteDocumento);
}

async function gerarQrMesa(identidade, { idMesa, chaveIdempotencia, req }) {
  const mesaId = validarId(String(idMesa || ''), 'idMesa');
  const chave = validarChaveIdempotencia(chaveIdempotencia);
  const restauranteRef = caminhoRestaurante(identidade.idRestaurante);
  const mesaRef = restauranteRef.collection('mesas').doc(mesaId);
  const token = crypto.randomBytes(32).toString('base64url');
  const versao = crypto.randomUUID();
  const hash = hashSha256(token);
  const hashPayload = hashSha256(JSON.stringify({ idMesa: mesaId }));
  const idOperacao = hashSha256(`${identidade.idRestaurante}:qr-gerar:${mesaId}:${chave}`).slice(0, 40);
  const idempotenciaRef = restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  let tokenFinal = token;
  let versaoFinal = versao;
  await mesaRef.firestore.runTransaction(async (transacao) => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da operação já foi utilizada com outros dados.');
      tokenFinal = decifrarToken(anterior.tokenCifrado);
      versaoFinal = anterior.qrVersao;
      return;
    }
    const documento = await transacao.get(mesaRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    transacao.update(mesaRef, {
      qrAtivo: true,
      qrVersao: versao,
      qrHash: hash,
      qrGeradoEm: FieldValue.serverTimestamp(),
      qrRevogadoEm: null,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(documento.data()?.versao || 1) + 1,
    });
    transacao.set(restauranteRef.collection('eventosMesas').doc(), {
      idRestaurante: identidade.idRestaurante,
      idMesa: mesaId,
      acao: 'qr_gerado',
      qrVersao: versao,
      idAtor: identidade.idUsuario,
      idRequisicao: chave,
      criadoEm: FieldValue.serverTimestamp(),
    });
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/qrcode-mesa',
      tipoOperacao: 'gerar',
      idMesa: mesaId,
      qrVersao: versao,
      tokenCifrado: cifrarToken(token),
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  return {
    idMesa: mesaId,
    qrVersao: versaoFinal,
    qrAtivo: true,
    urlPublica: `${origemPublica(req)}/mesa?qr=${encodeURIComponent(tokenFinal)}`,
  };
}

async function revogarQrMesa(identidade, { idMesa, chaveIdempotencia }) {
  const mesaId = validarId(String(idMesa || ''), 'idMesa');
  const chave = validarChaveIdempotencia(chaveIdempotencia);
  const restauranteRef = caminhoRestaurante(identidade.idRestaurante);
  const mesaRef = restauranteRef.collection('mesas').doc(mesaId);
  const hashPayload = hashSha256(JSON.stringify({ idMesa: mesaId }));
  const idOperacao = hashSha256(`${identidade.idRestaurante}:qr-revogar:${mesaId}:${chave}`).slice(0, 40);
  const idempotenciaRef = restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  await mesaRef.firestore.runTransaction(async (transacao) => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da operação já foi utilizada com outros dados.');
      return;
    }
    const documento = await transacao.get(mesaRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    transacao.update(mesaRef, {
      qrAtivo: false,
      qrHash: FieldValue.delete(),
      qrRevogadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(documento.data()?.versao || 1) + 1,
    });
    transacao.set(restauranteRef.collection('eventosMesas').doc(), {
      idRestaurante: identidade.idRestaurante,
      idMesa: mesaId,
      acao: 'qr_revogado',
      idAtor: identidade.idUsuario,
      idRequisicao: chave,
      criadoEm: FieldValue.serverTimestamp(),
    });
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/qrcode-mesa',
      tipoOperacao: 'revogar',
      idMesa: mesaId,
      hashPayload,
      resultado: { idMesa: mesaId, qrAtivo: false, revogado: true },
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  return { idMesa: mesaId, qrAtivo: false, revogado: true };
}

module.exports = {
  NOME_COOKIE_MESA,
  TTL_SESSAO_MESA_SEGUNDOS,
  nomeCookieMesa,
  validarId,
  validarTokenQr,
  validarNomeCompleto,
  validarChaveIdempotencia,
  origemPublica,
  hashSha256,
  adicionarCookieSessaoMesa,
  limparCookieSessaoMesa,
  lerSessaoMesaCookie,
  buscarMesaPorToken,
  consultarQrPublico,
  abrirSessaoMesa,
  consultarSessaoMesa,
  gerarQrMesa,
  revogarQrMesa,
};
