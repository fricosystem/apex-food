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
const { caminhoRestaurante, textoOpcional, inteiroPositivo, registrarAuditoriaOperacional } = require('./modulos-operacionais');
const { registrarAuditoria } = require('./auditoria');
const { criarNotificacoesNaTransacao, TIPOS_NOTIFICACAO } = require('./notificacoes');
const { enviarNotificacaoFcm } = require('./fcm-notificacoes');
const { baixarEstoqueParaPedido } = require('./estoque-pedidos');
const { atribuirGarcomResponsavel } = require('./pedidos-handler');

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
  let consulta;
  try {
    consulta = await getAdminDb().collectionGroup('mesas').where('qrHash', '==', hash).limit(1).get();
  } catch (erro) {
    const codigoOriginal = erro?.code;
    const codigoFirebase = String(codigoOriginal || '').toLowerCase();
    const codigoNumerico = Number(codigoOriginal);
    if (codigoNumerico === 9 || codigoFirebase.includes('failed-precondition') || codigoFirebase.includes('index')) {
      throw new ApiError(503, 'QR_INDICE_INDISPONIVEL', 'O acesso público da mesa está aguardando a configuração do Firestore.');
    }
    if (codigoNumerico === 7 || codigoFirebase.includes('permission-denied') || codigoFirebase.includes('unauthenticated')) {
      throw new ApiError(503, 'QR_FIRESTORE_INDISPONIVEL', 'O acesso público da mesa está temporariamente indisponível.');
    }
    throw new ApiError(503, 'QR_FIRESTORE_INDISPONIVEL', 'O acesso público da mesa está temporariamente indisponível.');
  }
  const mesaDocumento = consulta.docs[0];
  if (!mesaDocumento) throw new ApiError(404, 'QR_NAO_ENCONTRADO', 'Este QR Code não está ativo.');
  const dados = mesaDocumento.data() || {};
  if (dados.qrAtivo !== true || dados.qrHash !== hash || dados.estado === 'excluido') {
    throw new ApiError(404, 'QR_NAO_ENCONTRADO', 'Este QR Code não está ativo.');
  }
  const restauranteRef = mesaDocumento.ref.parent.parent;
  return { restauranteRef, mesaRef: mesaDocumento.ref, mesaDocumento };
}

function dataReservaEmMs(valor) {
  if (!valor) return 0;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  const numero = Number(valor);
  if (Number.isFinite(numero) && numero > 0) return numero;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function reservaBloqueiaQr(dados, agoraMs = Date.now()) {
  if (!dados || ['cancelada', 'concluida'].includes(String(dados.estado || ''))) return false;
  if (!['aguardando', 'confirmada'].includes(String(dados.estado || ''))) return false;
  const inicioMs = dataReservaEmMs(dados.inicioEm);
  const fimMs = dataReservaEmMs(dados.fimEm);
  return inicioMs > 0 && fimMs > inicioMs && inicioMs <= agoraMs && fimMs > agoraMs;
}

async function consultarQrPublico(token) {
  const valido = validarTokenQr(token);
  const encontrado = await buscarMesaPorToken(valido);
  const dadosMesa = encontrado.mesaDocumento.data() || {};
  let dadosRestaurante = {};
  try {
    const restauranteDocumento = await encontrado.restauranteRef.get();
    dadosRestaurante = restauranteDocumento.exists ? restauranteDocumento.data() || {} : {};
  } catch {
    dadosRestaurante = {};
  }
  return {
    restaurante: { nome: String(dadosRestaurante.nomeFantasia || dadosRestaurante.nome || dadosMesa.nomeRestaurante || 'Restaurante') },
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
    const reservasMesa = await transacao.get(restauranteRef.collection('reservas').where('idMesa', '==', mesaRef.id).limit(100));
    const reservaAtiva = reservasMesa.docs.find(documento => reservaBloqueiaQr(documento.data()));
    if (reservaAtiva) throw new ApiError(409, 'MESA_RESERVADA', 'Esta mesa está reservada neste horário. Aguarde o atendimento da equipe.');

    let comandaRef = mesa.idComandaAberta ? restauranteRef.collection('comandas').doc(String(mesa.idComandaAberta)) : null;
    let comandaDocumento = comandaRef ? await transacao.get(comandaRef) : null;
    let comandaExistente = comandaDocumento?.exists && ESTADOS_COMANDA_ATIVA.has(comandaDocumento.data()?.statusComanda || comandaDocumento.data()?.status);
    if (!comandaExistente) {
      comandaRef = restauranteRef.collection('comandas').doc();
      comandaDocumento = null;
      comandaExistente = false;
    }
    let atribuicao = { status: 'aguardando_atribuicao', idGarcomResponsavel: null, idFuncionarioResponsavel: null, idUsuarioGarcomResponsavel: null, nomeGarcomResponsavel: '' };
    const comandaAtual = comandaDocumento?.exists ? (comandaDocumento.data() || {}) : {};
    if (!comandaAtual.idGarcomResponsavel) {
      const [funcionariosDocumentos, escalasDocumentos] = await Promise.all([
        transacao.get(restauranteRef.collection('funcionarios').limit(300)),
        transacao.get(restauranteRef.collection('escalas').limit(1000)),
      ]);
      atribuicao = await atribuirGarcomResponsavel({
        transacao,
        restaurante: restauranteRef,
        idRestaurante,
        idComanda: comandaRef.id,
        idMesa: mesaRef.id,
        comanda: comandaAtual,
        mesa,
        funcionariosDocumentos: funcionariosDocumentos.docs,
        escalasDocumentos: escalasDocumentos.docs,
        incrementoMesa: 1,
        incrementoComanda: 1,
        idAtor: 'sessao-mesa',
      });
    } else {
      atribuicao = { status: 'atribuido', idGarcomResponsavel: String(comandaAtual.idGarcomResponsavel), idFuncionarioResponsavel: String(comandaAtual.idFuncionarioResponsavel || ''), idUsuarioGarcomResponsavel: String(comandaAtual.idUsuarioGarcomResponsavel || ''), nomeGarcomResponsavel: String(comandaAtual.nomeGarcomResponsavel || comandaAtual.nomeGarcom || '') };
    }
    if (!comandaExistente) {
      transacao.set(comandaRef, {
        idRestaurante,
        idMesa: mesaRef.id,
        statusComanda: 'aberta',
        status: 'aberta',
        idGarcomResponsavel: atribuicao.idGarcomResponsavel,
        idFuncionarioResponsavel: atribuicao.idFuncionarioResponsavel || null,
        idUsuarioGarcomResponsavel: atribuicao.idUsuarioGarcomResponsavel || null,
        nomeGarcomResponsavel: atribuicao.nomeGarcomResponsavel,
        statusDistribuicaoGarcom: atribuicao.status,
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
    const cookieValor = codificarSessaoMesa(idRestaurante, sessaoRef.id, expiraEm);
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
      ...(atribuicao.status === 'aguardando_atribuicao' ? { estadoAtendimento: 'aguardando_atribuicao' } : {}),
      idComandaAberta: comandaRef.id,
      idGarcomResponsavel: atribuicao.idGarcomResponsavel,
      idFuncionarioResponsavel: atribuicao.idFuncionarioResponsavel || null,
      idUsuarioGarcomResponsavel: atribuicao.idUsuarioGarcomResponsavel || null,
      nomeGarcomResponsavel: atribuicao.nomeGarcomResponsavel,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(mesa.versao || 1) + 1,
    });
    if (comandaDocumento?.exists) {
      const comanda = comandaDocumento.data() || {};
      transacao.update(comandaRef, {
        ...(comanda.idGarcomResponsavel ? {} : {
          idGarcomResponsavel: atribuicao.idGarcomResponsavel,
          idFuncionarioResponsavel: atribuicao.idFuncionarioResponsavel || null,
          idUsuarioGarcomResponsavel: atribuicao.idUsuarioGarcomResponsavel || null,
          nomeGarcomResponsavel: atribuicao.nomeGarcomResponsavel,
          statusDistribuicaoGarcom: atribuicao.status,
        }),
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

async function obterContextoSessaoMesa(req, res) {
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
  const expiraEmMs = sessao.expiraEm?.toDate ? sessao.expiraEm.toDate().getTime() : Number(sessao.expiraEm || 0);
  if (sessao.estadoSessao !== 'ativa' || !Number.isFinite(expiraEmMs) || expiraEmMs <= Date.now()) {
    try { await sessaoDocumento.ref.update({ estadoSessao: 'expirada', atualizadoEm: FieldValue.serverTimestamp() }); } catch {}
    limparCookieSessaoMesa(res);
    throw new ApiError(401, 'SESSAO_MESA_EXPIRADA', 'A sessão da mesa não está mais disponível.');
  }
  const [mesaDocumento, comandaDocumento, participanteDocumento] = await Promise.all([
    restauranteRef.collection('mesas').doc(String(sessao.idMesa)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).collection('participantes').doc(String(sessao.idParticipante)).get(),
  ]);
  if (!mesaDocumento.exists || !comandaDocumento.exists || !participanteDocumento.exists) {
    limparCookieSessaoMesa(res);
    throw new ApiError(409, 'ATENDIMENTO_NAO_DISPONIVEL', 'O atendimento desta mesa não está disponível.');
  }
  const comanda = comandaDocumento.data() || {};
  if (!ESTADOS_COMANDA_ATIVA.has(comanda.statusComanda || comanda.status)) {
    throw new ApiError(409, 'COMANDA_ENCERRADA', 'A comanda desta mesa não está mais disponível.');
  }
  return {
    cookie,
    restauranteRef,
    sessaoRef,
    sessaoDocumento,
    sessao,
    expiraEmMs,
    mesaDocumento,
    comandaDocumento,
    participanteDocumento,
  };
}

async function obterContextoAvaliacaoPublica(req, res) {
  const cookie = lerSessaoMesaCookie(req);
  if (!cookie) throw new ApiError(401, 'SESSAO_MESA_NAO_ENCONTRADA', 'A sessão da mesa não foi encontrada.');
  const restauranteRef = caminhoRestaurante(cookie.idRestaurante);
  const sessaoRef = restauranteRef.collection('sessoesMesa').doc(cookie.idSessaoMesa);
  const sessaoDocumento = await sessaoRef.get();
  if (!sessaoDocumento.exists) throw new ApiError(401, 'SESSAO_MESA_EXPIRADA', 'A sessão da mesa não está mais disponível.');
  const sessao = sessaoDocumento.data() || {};
  const [mesaDocumento, comandaDocumento, participanteDocumento] = await Promise.all([
    restauranteRef.collection('mesas').doc(String(sessao.idMesa)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).get(),
    restauranteRef.collection('comandas').doc(String(sessao.idComanda)).collection('participantes').doc(String(sessao.idParticipante)).get(),
  ]);
  if (!mesaDocumento.exists || !comandaDocumento.exists || !participanteDocumento.exists) throw new ApiError(409, 'ATENDIMENTO_NAO_DISPONIVEL', 'O atendimento desta mesa não está mais disponível.');
  const comanda = comandaDocumento.data() || {};
  const statusComanda = String(comanda.statusComanda || comanda.status || '');
  if (statusComanda !== 'encerrada') throw new ApiError(409, 'AVALIACAO_AGUARDANDO_CAIXA', 'A avaliação será liberada após a conclusão operacional do caixa.');
  const encerradaEmMs = timestampParaMs(comanda.encerradaEm || sessao.encerradaEm);
  if (encerradaEmMs && Date.now() - encerradaEmMs > 7 * 24 * 60 * 60 * 1000) throw new ApiError(410, 'AVALIACAO_EXPIRADA', 'O prazo para avaliar este atendimento foi encerrado.');
  return { cookie, restauranteRef, sessaoRef, sessaoDocumento, sessao, mesaDocumento, comandaDocumento, participanteDocumento };
}

async function consultarSessaoMesa(req, res) {
  const contexto = await obterContextoSessaoMesa(req, res);
  await contexto.sessaoDocumento.ref.update({ ultimoAcessoEm: FieldValue.serverTimestamp() });
  return dtoSessaoPublica(contexto.sessaoDocumento, contexto.mesaDocumento, contexto.comandaDocumento, contexto.participanteDocumento);
}

function timestampParaMs(valor) {
  if (!valor) return 0;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function produtoPublico(documento, exibirPrecos) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    idCategoria: String(dados.idCategoria || ''),
    nome: String(dados.nome || 'Produto'),
    descricao: String(dados.descricao || ''),
    precoCentavos: exibirPrecos ? Number(dados.precoCentavos || 0) : null,
    disponibilidade: dados.disponibilidade !== false,
    tempoPreparo: Number(dados.tempoPreparo || 0),
  };
}

function promocaoPublica(documento, exibirPrecos) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    nome: String(dados.nome || 'Promoção'),
    descricao: String(dados.descricao || ''),
    tipo: String(dados.tipo || 'Produto'),
    desconto: String(dados.desconto || ''),
    valorCentavos: exibirPrecos ? Number(dados.valorCentavos || 0) : null,
  };
}

async function lerConfiguracaoCardapio(restauranteRef) {
  const documento = await restauranteRef.collection('configuracoesCardapioDigital').doc('configuracao').get();
  const dados = documento.exists ? documento.data() || {} : {};
  return {
    publicado: dados.publicado === true,
    exibirPrecos: dados.exibirPrecos !== false,
    aceitarPedidos: dados.aceitarPedidos === true,
    mostrarPromocoes: dados.mostrarPromocoes !== false,
  };
}

async function listarCardapioPublico(contexto) {
  const configuracao = await lerConfiguracaoCardapio(contexto.restauranteRef);
  if (!configuracao.publicado) throw new ApiError(409, 'CARDAPIO_NAO_PUBLICADO', 'O cardápio desta mesa ainda não está disponível.');
  const [categorias, produtos, promocoes] = await Promise.all([
    contexto.restauranteRef.collection('categoriasCardapio').limit(200).get(),
    contexto.restauranteRef.collection('produtosCardapio').limit(500).get(),
    configuracao.mostrarPromocoes ? contexto.restauranteRef.collection('promocoesCardapio').limit(100).get() : Promise.resolve({ docs: [] }),
  ]);
  const categoriasPublicas = categorias.docs
    .filter(documento => { const dados = documento.data() || {}; return dados.estado !== 'excluido' && !dados.excluidoEm; })
    .sort((a, b) => Number(a.data()?.ordem || 0) - Number(b.data()?.ordem || 0))
    .map(documento => ({ id: documento.id, nome: String(documento.data()?.nome || 'Categoria'), descricao: String(documento.data()?.descricao || ''), cor: String(documento.data()?.cor || 'orange') }));
  const categoriasIds = new Set(categoriasPublicas.map(item => item.id));
  const produtosPublicos = produtos.docs
    .filter(documento => { const dados = documento.data() || {}; return dados.estado !== 'excluido' && !dados.excluidoEm && dados.disponibilidade !== false && Number(dados.estoque || 0) > 0 && categoriasIds.has(String(dados.idCategoria || '')); })
    .sort((a, b) => String(a.data()?.nome || '').localeCompare(String(b.data()?.nome || ''), 'pt-BR'))
    .map(documento => produtoPublico(documento, configuracao.exibirPrecos));
  const promocoesPublicas = promocoes.docs
    .filter(documento => { const dados = documento.data() || {}; return dados.estado === 'ativa' && !dados.excluidoEm; })
    .map(documento => promocaoPublica(documento, configuracao.exibirPrecos));
  return {
    configuracao,
    categorias: categoriasPublicas,
    produtos: produtosPublicos,
    promocoes: promocoesPublicas,
  };
}

function pedidoPublico(documento, exibirPrecos) {
  const dados = documento.data() || {};
  const itens = Array.isArray(dados.itensResumo) ? dados.itensResumo.map(item => ({
    idProduto: item.idProduto,
    nomeProduto: item.nomeProduto,
    quantidade: Number(item.quantidade || 0),
    observacoes: String(item.observacoes || ''),
  })) : [];
  return {
    id: documento.id,
    numero: Number(dados.numero || 0),
    statusPedido: String(dados.statusPedido || dados.status || 'aguardando_confirmacao_garcom'),
    itens,
    totalCentavos: exibirPrecos ? Number(dados.totalCentavos || 0) : null,
    criadoEm: timestampParaMs(dados.criadoEm) ? new Date(timestampParaMs(dados.criadoEm)).toISOString() : null,
  };
}

async function consultarComandaPublica(contexto) {
  const configuracao = await lerConfiguracaoCardapio(contexto.restauranteRef);
  if (!configuracao.publicado) throw new ApiError(409, 'CARDAPIO_NAO_PUBLICADO', 'O cardápio desta mesa ainda não está disponível.');
  const pedidosConsulta = await contexto.restauranteRef.collection('pedidos').where('idComanda', '==', contexto.comandaDocumento.id).limit(200).get();
  const pedidos = pedidosConsulta.docs
    .filter(documento => String(documento.data()?.idParticipante || '') === contexto.participanteDocumento.id && documento.data()?.estado !== 'excluido')
    .sort((a, b) => timestampParaMs(b.data()?.criadoEm) - timestampParaMs(a.data()?.criadoEm))
    .map(documento => pedidoPublico(documento, configuracao.exibirPrecos));
  const comanda = contexto.comandaDocumento.data() || {};
  return {
    comanda: {
      id: contexto.comandaDocumento.id,
      status: String(comanda.statusComanda || comanda.status || 'aberta'),
      totalCentavos: configuracao.exibirPrecos ? Number(comanda.totalCentavos || 0) : null,
      quantidadePedidosAbertos: Number(comanda.quantidadePedidosAbertos || 0),
    },
    participante: {
      id: contexto.participanteDocumento.id,
      nomeExibicao: String(contexto.participanteDocumento.data()?.nomeExibicao || contexto.sessao.nomeExibicao || ''),
    },
    pedidos,
    avaliacao: await consultarAvaliacaoPublica(contexto),
    configuracao: { exibirPrecos: configuracao.exibirPrecos, aceitarPedidos: configuracao.aceitarPedidos },
  };
}

async function consultarComandaPublicaEncerrada(contexto) {
  const configuracao = await lerConfiguracaoCardapio(contexto.restauranteRef);
  const pedidosConsulta = await contexto.restauranteRef.collection('pedidos').where('idComanda', '==', contexto.comandaDocumento.id).limit(200).get();
  const pedidos = pedidosConsulta.docs
    .filter(documento => String(documento.data()?.idParticipante || '') === contexto.participanteDocumento.id && documento.data()?.estado !== 'excluido')
    .sort((a, b) => timestampParaMs(b.data()?.criadoEm) - timestampParaMs(a.data()?.criadoEm))
    .map(documento => pedidoPublico(documento, configuracao.exibirPrecos));
  const comanda = contexto.comandaDocumento.data() || {};
  return {
    comanda: { id: contexto.comandaDocumento.id, status: String(comanda.statusComanda || comanda.status || 'encerrada'), totalCentavos: configuracao.exibirPrecos ? Number(comanda.totalCentavos || 0) : null, quantidadePedidosAbertos: 0 },
    participante: { id: contexto.participanteDocumento.id, nomeExibicao: String(contexto.participanteDocumento.data()?.nomeExibicao || contexto.sessao.nomeExibicao || '') },
    pedidos,
    avaliacao: await consultarAvaliacaoPublica(contexto),
    configuracao: { exibirPrecos: configuracao.exibirPrecos, aceitarPedidos: false },
  };
}

function dtoAvaliacaoPublica(documento) {
  if (!documento?.exists) return null;
  const dados = documento.data() || {};
  const timestamp = dados.criadoEm || dados.enviadaEm || null;
  return {
    id: documento.id,
    nota: Number(dados.nota || 0),
    comentario: String(dados.comentario || ''),
    nomeCliente: String(dados.nomeCliente || 'Cliente'),
    enviadaEm: timestampParaMs(timestamp) ? new Date(timestampParaMs(timestamp)).toISOString() : null,
    respondida: dados.respondida === true,
  };
}

function idAvaliacaoComanda(idComanda, idParticipante) {
  return `qrcode-${hashSha256(`${idComanda}:${idParticipante}`).slice(0, 40)}`;
}

async function consultarAvaliacaoPublica(contexto) {
  const idAvaliacao = idAvaliacaoComanda(contexto.comandaDocumento.id, contexto.participanteDocumento.id);
  const documento = await contexto.restauranteRef.collection('avaliacoes').doc(idAvaliacao).get();
  return dtoAvaliacaoPublica(documento);
}

async function criarAvaliacaoPublica(req, res, corpo) {
  const contexto = await obterContextoAvaliacaoPublica(req, res);
  const nota = Number(corpo.nota);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new ApiError(400, 'NOTA_INVALIDA', 'Informe uma nota de 1 a 5.');
  const comentario = textoOpcional(corpo.comentario || corpo.observacao, 'comentario', 1000);
  const chave = validarChaveIdempotencia(corpo.chaveIdempotencia);
  const idAvaliacao = idAvaliacaoComanda(contexto.comandaDocumento.id, contexto.participanteDocumento.id);
  const avaliacaoRef = contexto.restauranteRef.collection('avaliacoes').doc(idAvaliacao);
  const idOperacao = hashSha256(`${contexto.cookie.idRestaurante}:avaliacao:${idAvaliacao}:${chave}`).slice(0, 40);
  const idempotenciaRef = contexto.restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  const hashPayload = hashSha256(JSON.stringify({ idAvaliacao, nota, comentario }));
  let resultado;
  let repeticaoIdempotente = false;
  await contexto.restauranteRef.firestore.runTransaction(async transacao => {
    const [idempotenciaDocumento, avaliacaoDocumento, comandaDocumento, participanteDocumento, mesaDocumento] = await Promise.all([
      transacao.get(idempotenciaRef),
      transacao.get(avaliacaoRef),
      transacao.get(contexto.comandaDocumento.ref),
      transacao.get(contexto.participanteDocumento.ref),
      transacao.get(contexto.mesaDocumento.ref),
    ]);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da avaliação já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      repeticaoIdempotente = true;
      return;
    }
    if (!comandaDocumento.exists || String(comandaDocumento.data()?.statusComanda || comandaDocumento.data()?.status) !== 'encerrada') throw new ApiError(409, 'AVALIACAO_AGUARDANDO_CAIXA', 'A avaliação será liberada após a conclusão operacional do caixa.');
    if (!participanteDocumento.exists || !mesaDocumento.exists) throw new ApiError(409, 'ATENDIMENTO_NAO_DISPONIVEL', 'Os dados deste atendimento não estão mais disponíveis.');
    if (avaliacaoDocumento.exists) throw new ApiError(409, 'AVALIACAO_JA_ENVIADA', 'Este atendimento já foi avaliado.');
    const comanda = comandaDocumento.data() || {};
    const participante = participanteDocumento.data() || {};
    const mesa = mesaDocumento.data() || {};
    const dadosAvaliacao = {
      idRestaurante: contexto.cookie.idRestaurante,
      idAvaliacao,
      idComanda: contexto.comandaDocumento.id,
      idMesa: contexto.mesaDocumento.id,
      idParticipante: contexto.participanteDocumento.id,
      idGarcomResponsavel: comanda.idGarcomResponsavelFinal || comanda.idGarcomResponsavel || null,
      idFuncionarioGarcomResponsavel: comanda.idFuncionarioResponsavelFinal || comanda.idFuncionarioResponsavel || null,
      nomeCliente: String(participante.nomeExibicao || participante.nomeCompleto || 'Cliente'),
      nomeMesa: String(mesa.nome || mesa.numero || contexto.mesaDocumento.id),
      nota,
      comentario,
      categoria: 'atendimento',
      canal: 'qrcode',
      origem: 'comandaPublica',
      respondida: false,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: 1,
    };
    transacao.create(avaliacaoRef, dadosAvaliacao);
    transacao.set(contexto.comandaDocumento.ref.collection('eventos').doc(), { idRestaurante: contexto.cookie.idRestaurante, idComanda: contexto.comandaDocumento.id, idMesa: contexto.mesaDocumento.id, idAvaliacao, acao: 'avaliacao_cliente', nota, idParticipante: contexto.participanteDocumento.id, criadoEm: FieldValue.serverTimestamp() });
    resultado = { recurso: 'avaliacao', id: idAvaliacao, idComanda: contexto.comandaDocumento.id, idMesa: contexto.mesaDocumento.id, nota, comentario, enviado: true };
    transacao.create(idempotenciaRef, { idRestaurante: contexto.cookie.idRestaurante, idAvaliacao, idAtor: contexto.participanteDocumento.id, endpoint: '/api/v1/qrcode-mesa', tipoOperacao: 'avaliacao_publica', resultado, hashPayload, criadaEm: FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000), versao: 1 });
  });
  if (!repeticaoIdempotente) {
    await registrarAuditoria({ idRestaurante: contexto.cookie.idRestaurante, acao: 'avaliacao.publica.criada', tipoRecurso: 'avaliacao', idRecurso: idAvaliacao, idAtor: contexto.participanteDocumento.id });
  }
  return { ...resultado, idempotente: repeticaoIdempotente };
}

function validarItensPedidoPublico(itens) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 50) throw new ApiError(400, 'ITENS_INVALIDOS', 'Selecione ao menos um item para enviar o pedido.');
  const ids = new Set();
  return itens.map(item => {
    const idProduto = validarId(String(item?.idProduto || ''), 'idProduto');
    if (ids.has(idProduto)) throw new ApiError(400, 'ITENS_DUPLICADOS', 'Cada produto deve aparecer uma única vez no pedido.');
    ids.add(idProduto);
    return {
      idProduto,
      quantidade: inteiroPositivo(item?.quantidade, 'quantidade', 100),
      observacoes: textoOpcional(item?.observacoes, 'observacoes', 500),
    };
  });
}

async function criarPedidoPublico(req, res, corpo) {
  const contexto = await obterContextoSessaoMesa(req, res);
  const itens = validarItensPedidoPublico(corpo.itens);
  const observacoes = textoOpcional(corpo.observacoes, 'observacoes', 1000);
  const chave = validarChaveIdempotencia(corpo.chaveIdempotencia);
  const idOperacao = hashSha256(`${contexto.cookie.idRestaurante}:pedido-mesa:${contexto.sessaoDocumento.id}:${chave}`).slice(0, 40);
  const idempotenciaRef = contexto.restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  const pedidoRef = contexto.restauranteRef.collection('pedidos').doc();
  const comandaRef = contexto.restauranteRef.collection('comandas').doc(contexto.comandaDocumento.id);
  const mesaRef = contexto.restauranteRef.collection('mesas').doc(String(contexto.sessao.idMesa));
  const configRef = contexto.restauranteRef.collection('configuracoesCardapioDigital').doc('configuracao');
  const hashPayload = hashSha256(JSON.stringify({ itens, observacoes, idComanda: comandaRef.id, idParticipante: contexto.participanteDocumento.id }));
  let resultado;
  let eventoFcm = null;
  let repeticaoIdempotente = false;
  const db = contexto.restauranteRef.firestore;

  await db.runTransaction(async transacao => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave do pedido já foi utilizada com outros dados.');
      resultado = anterior.resultado;
      repeticaoIdempotente = true;
      return;
    }
    const [configuracaoDocumento, comandaDocumento, mesaDocumento, participanteDocumento, sessaoDocumento] = await Promise.all([
      transacao.get(configRef),
      transacao.get(comandaRef),
      transacao.get(mesaRef),
      transacao.get(contexto.participanteDocumento.ref),
      transacao.get(contexto.sessaoDocumento.ref),
    ]);
    const configuracao = configuracaoDocumento.data() || {};
    const sessaoAtual = sessaoDocumento.data() || {};
    if (!sessaoDocumento.exists || sessaoAtual.estadoSessao !== 'ativa' || timestampParaMs(sessaoAtual.expiraEm) <= Date.now()) throw new ApiError(401, 'SESSAO_MESA_EXPIRADA', 'A sessão da mesa não está mais disponível.');
    if (!configuracao.publicado || configuracao.aceitarPedidos !== true) throw new ApiError(409, 'PEDIDOS_NAO_ACEITOS', 'O restaurante não está aceitando pedidos pelo cardápio digital.');
    if (!comandaDocumento.exists || !ESTADOS_COMANDA_ATIVA.has(comandaDocumento.data()?.statusComanda || comandaDocumento.data()?.status)) throw new ApiError(409, 'COMANDA_ENCERRADA', 'A comanda desta mesa não está mais disponível.');
    if (!mesaDocumento.exists || String(mesaDocumento.data()?.idComandaAberta || '') !== comandaRef.id || ESTADOS_MESA_BLOQUEADOS.has(mesaDocumento.data()?.estado)) throw new ApiError(409, 'MESA_INDISPONIVEL', 'A mesa desta sessão não está disponível.');
    if (!participanteDocumento.exists || participanteDocumento.data()?.estadoParticipante !== 'ativo') throw new ApiError(409, 'PARTICIPANTE_ENCERRADO', 'Este participante não pode enviar novos pedidos.');
    const produtoDocumentos = await Promise.all(itens.map(item => transacao.get(contexto.restauranteRef.collection('produtosCardapio').doc(item.idProduto))));
    let subtotalCentavos = 0;
    const itensPersistidos = itens.map((item, indice) => {
      const documento = produtoDocumentos[indice];
      const produto = documento.data() || {};
      if (!documento.exists || produto.estado === 'excluido' || produto.disponibilidade === false) throw new ApiError(409, 'PRODUTO_INDISPONIVEL', `O produto ${item.idProduto} não está disponível.`);
      const precoUnitarioCentavos = Number(produto.precoCentavos || 0);
      if (!Number.isSafeInteger(precoUnitarioCentavos) || precoUnitarioCentavos < 0) throw new ApiError(409, 'PRECO_INVALIDO', 'Um produto possui preço inválido.');
      const totalCentavos = precoUnitarioCentavos * item.quantidade;
      subtotalCentavos += totalCentavos;
      return {
        idProduto: item.idProduto,
        nome: String(produto.nome || item.idProduto),
        nomeProduto: String(produto.nome || item.idProduto),
        quantidade: item.quantidade,
        precoUnitarioCentavos,
        subtotalCentavos: totalCentavos,
        totalCentavos,
        observacoes: item.observacoes,
        especialidadesNecessarias: Array.isArray(produto.especialidadesNecessarias) ? produto.especialidadesNecessarias : [],
        estacoesNecessarias: Array.isArray(produto.estacoesNecessarias) ? produto.estacoesNecessarias : [],
        idParticipante: contexto.participanteDocumento.id,
        estadoItem: 'ativo',
      };
    });
    const comanda = comandaDocumento.data() || {};
    const mesa = mesaDocumento.data() || {};
    const participante = participanteDocumento.data() || {};
    let atribuicaoGarcom = {
      status: comanda.statusDistribuicaoGarcom || (comanda.idGarcomResponsavel ? 'atribuido' : 'aguardando_atribuicao'),
      idGarcomResponsavel: comanda.idGarcomResponsavel || null,
      idFuncionarioResponsavel: comanda.idFuncionarioResponsavel || null,
      idUsuarioGarcomResponsavel: comanda.idUsuarioGarcomResponsavel || null,
      nomeGarcomResponsavel: String(comanda.nomeGarcomResponsavel || comanda.nomeGarcom || ''),
    };
    if (!comanda.idGarcomResponsavel) {
      const [funcionariosDocumentos, escalasDocumentos] = await Promise.all([
        transacao.get(contexto.restauranteRef.collection('funcionarios').limit(300)),
        transacao.get(contexto.restauranteRef.collection('escalas').limit(1000)),
      ]);
      atribuicaoGarcom = await atribuirGarcomResponsavel({
        transacao,
        restaurante: contexto.restauranteRef,
        idRestaurante: contexto.cookie.idRestaurante,
        idComanda: comandaRef.id,
        idMesa: mesaRef.id,
        comanda,
        mesa,
        funcionariosDocumentos: funcionariosDocumentos.docs,
        escalasDocumentos: escalasDocumentos.docs,
        incrementoMesa: 1,
        incrementoComanda: 1,
        incrementoPedido: 1,
        idAtor: `sessao:${contexto.sessaoDocumento.id}`,
      });
    }
    await baixarEstoqueParaPedido({
      transacao,
      restauranteRef: contexto.restauranteRef,
      idPedido: pedidoRef.id,
      idRestaurante: contexto.cookie.idRestaurante,
      idAtor: `sessao:${contexto.sessaoDocumento.id}`,
      itens: itensPersistidos,
      documentosProdutos: produtoDocumentos,
      motivo: 'Baixa automática do pedido enviado pela comanda digital.',
    });
    const pedidoNumero = Number(`${Date.now()}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`);
    const statusPedido = 'aguardando_confirmacao_garcom';
    resultado = { idPedido: pedidoRef.id, numero: pedidoNumero, statusPedido, totalCentavos: subtotalCentavos };
    transacao.set(pedidoRef, {
      idRestaurante: contexto.cookie.idRestaurante,
      numero: pedidoNumero,
      origem: 'cardapioDigital',
      tipoAtendimento: 'mesa',
      canal: 'salão',
      idMesa: mesaRef.id,
      idComanda: comandaRef.id,
      idParticipante: contexto.participanteDocumento.id,
      idSessaoMesa: contexto.sessaoDocumento.id,
      nomeCliente: String(participante.nomeExibicao || participante.nomeCompleto || 'Cliente'),
      idGarcomResponsavel: atribuicaoGarcom.idGarcomResponsavel,
      idGarcom: atribuicaoGarcom.idGarcomResponsavel,
      idFuncionarioResponsavel: atribuicaoGarcom.idFuncionarioResponsavel || null,
      idUsuarioGarcomResponsavel: atribuicaoGarcom.idUsuarioGarcomResponsavel || null,
      nomeMesa: String(mesa.nome || mesa.numero || mesaRef.id),
      nomeGarcom: atribuicaoGarcom.nomeGarcomResponsavel,
      statusDistribuicaoGarcom: atribuicaoGarcom.status,
      statusPedido,
      status: statusPedido,
      prioridade: 'normal',
      itens: itensPersistidos,
      itensResumo: itensPersistidos.map(item => ({ idProduto: item.idProduto, nomeProduto: item.nomeProduto, quantidade: item.quantidade, observacoes: item.observacoes })),
      observacoes,
      subtotalCentavos,
      descontoCentavos: 0,
      totalCentavos: subtotalCentavos,
      valorCentavos: subtotalCentavos,
      estoqueBaixado: true,
      pagamento: null,
      versao: 1,
      criadoPor: 'cliente_mesa',
      atualizadoPor: 'cliente_mesa',
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    for (const item of itensPersistidos) {
      transacao.create(pedidoRef.collection('itens').doc(), { ...item, criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() });
    }
    transacao.create(pedidoRef.collection('eventos').doc(), {
      statusAnterior: 'rascunho',
      statusNovo: statusPedido,
      idAtor: `sessao:${contexto.sessaoDocumento.id}`,
      papelAtor: 'cliente_mesa',
      motivo: 'Pedido enviado pelo cardápio digital.',
      idRequisicao: chave,
      criadoEm: FieldValue.serverTimestamp(),
      versaoEvento: 1,
    });
    transacao.update(comandaRef, {
      ...(comanda.idGarcomResponsavel ? {} : {
        idGarcomResponsavel: atribuicaoGarcom.idGarcomResponsavel,
        idGarcom: atribuicaoGarcom.idGarcomResponsavel,
        idFuncionarioResponsavel: atribuicaoGarcom.idFuncionarioResponsavel || null,
        idUsuarioGarcomResponsavel: atribuicaoGarcom.idUsuarioGarcomResponsavel || null,
        nomeGarcomResponsavel: atribuicaoGarcom.nomeGarcomResponsavel,
        nomeGarcom: atribuicaoGarcom.nomeGarcomResponsavel,
        statusDistribuicaoGarcom: atribuicaoGarcom.status,
      }),
      statusComanda: 'em_consumo',
      status: 'em_consumo',
      quantidadePedidosAbertos: Number(comanda.quantidadePedidosAbertos || 0) + 1,
      subtotalCentavos: Number(comanda.subtotalCentavos || 0) + subtotalCentavos,
      totalCentavos: Number(comanda.totalCentavos || 0) + subtotalCentavos,
      valorCentavos: Number(comanda.valorCentavos || comanda.totalCentavos || 0) + subtotalCentavos,
      atualizadaEm: FieldValue.serverTimestamp(),
      versao: Number(comanda.versao || 1) + 1,
    });
    transacao.update(mesaRef, {
      estado: 'ocupada',
      estadoAtendimento: 'aguardando_confirmacao',
      ...(atribuicaoGarcom.status === 'aguardando_atribuicao' ? { estadoAtendimento: 'aguardando_atribuicao' } : {}),
      ...(comanda.idGarcomResponsavel ? {} : { idGarcomResponsavel: atribuicaoGarcom.idGarcomResponsavel, idFuncionarioResponsavel: atribuicaoGarcom.idFuncionarioResponsavel || null, idUsuarioGarcomResponsavel: atribuicaoGarcom.idUsuarioGarcomResponsavel || null, nomeGarcomResponsavel: atribuicaoGarcom.nomeGarcomResponsavel }),
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(mesa.versao || 1) + 1,
    });
    transacao.create(idempotenciaRef, {
      idRestaurante: contexto.cookie.idRestaurante,
      idAtor: `sessao:${contexto.sessaoDocumento.id}`,
      endpoint: '/api/v1/qrcode-mesa',
      tipoOperacao: 'pedido_mesa',
      resultado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
    eventoFcm = {
      tipoNotificacao: TIPOS_NOTIFICACAO.novoPedidoGarcom,
      titulo: `Novo pedido — mesa ${String(mesa.nome || mesa.numero || mesaRef.id)}`,
      mensagem: `${String(participante.nomeExibicao || participante.nomeCompleto || 'Cliente')} enviou ${itensPersistidos.length} item(ns) para confirmação.`,
      prioridade: 'normal',
      eventoOrigem: `pedido:${pedidoRef.id}:status:${statusPedido}`,
      idMesa: mesaRef.id,
      idComanda: comandaRef.id,
      idPedido: pedidoRef.id,
      idGarcomResponsavel: atribuicaoGarcom.idGarcomResponsavel,
    };
    criarNotificacoesNaTransacao(transacao, contexto.restauranteRef, eventoFcm);
  });
  if (!repeticaoIdempotente) {
    await registrarAuditoria({
      idRestaurante: contexto.cookie.idRestaurante,
      idAtor: `sessao:${contexto.sessaoDocumento.id}`,
      papeisDoAtor: ['cliente_mesa'],
      acao: 'mesa.pedido.enviado',
      tipoRecurso: 'pedido',
      idRecurso: resultado.idPedido,
      idOperacao,
      idRequisicao: chave,
      resultado: 'criado',
    });
    await enviarNotificacaoFcm({ idRestaurante: contexto.cookie.idRestaurante, evento: eventoFcm });
  }
  return {
    pedido: resultado,
    comanda: { id: comandaRef.id, status: 'em_consumo' },
  };
}

async function gerarQrMesa(identidade, { idMesa, chaveIdempotencia, req, regenerar = false }) {
  const mesaId = validarId(String(idMesa || ''), 'idMesa');
  const chave = validarChaveIdempotencia(chaveIdempotencia);
  const tipoOperacao = regenerar ? 'regenerar' : 'gerar';
  const restauranteRef = caminhoRestaurante(identidade.idRestaurante);
  const mesaRef = restauranteRef.collection('mesas').doc(mesaId);
  const token = crypto.randomBytes(32).toString('base64url');
  const versao = crypto.randomUUID();
  const hash = hashSha256(token);
  const tokenCifrado = cifrarToken(token);
  const hashPayload = hashSha256(JSON.stringify({ idMesa: mesaId, tipoOperacao }));
  const idOperacao = hashSha256(`${identidade.idRestaurante}:qr-${tipoOperacao}:${mesaId}:${chave}`).slice(0, 40);
  const idempotenciaRef = restauranteRef.collection('chavesIdempotencia').doc(idOperacao);
  let tokenFinal = token;
  let versaoFinal = versao;
  let repeticaoIdempotente = false;
  await mesaRef.firestore.runTransaction(async (transacao) => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da operação já foi utilizada com outros dados.');
      tokenFinal = decifrarToken(anterior.tokenCifrado);
      versaoFinal = anterior.qrVersao;
      repeticaoIdempotente = true;
      return;
    }
    const documento = await transacao.get(mesaRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    if (regenerar && documento.data()?.qrAtivo !== true) throw new ApiError(409, 'QR_NAO_ATIVO', 'Não há QR Code ativo para regenerar.');
    transacao.update(mesaRef, {
      qrAtivo: true,
      qrVersao: versao,
      qrHash: hash,
      qrTokenCifrado: tokenCifrado,
      qrGeradoEm: FieldValue.serverTimestamp(),
      qrRevogadoEm: null,
      atualizadoPor: identidade.idUsuario,
      atualizadoEm: FieldValue.serverTimestamp(),
      versao: Number(documento.data()?.versao || 1) + 1,
    });
    transacao.set(restauranteRef.collection('eventosMesas').doc(), {
      idRestaurante: identidade.idRestaurante,
      idMesa: mesaId,
      acao: regenerar ? 'qr_regenerado' : 'qr_gerado',
      qrVersao: versao,
      idAtor: identidade.idUsuario,
      idRequisicao: chave,
      criadoEm: FieldValue.serverTimestamp(),
    });
    transacao.create(idempotenciaRef, {
      idRestaurante: identidade.idRestaurante,
      idAtor: identidade.idUsuario,
      endpoint: '/api/v1/qrcode-mesa',
      tipoOperacao,
      idMesa: mesaId,
      qrVersao: versao,
      tokenCifrado,
      hashPayload,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      versao: 1,
    });
  });
  if (!repeticaoIdempotente) {
    await registrarAuditoriaOperacional({
      identidade,
      idRequisicao: chave,
      acao: regenerar ? 'salao.mesa.qrRegenerado' : 'salao.mesa.qrGerado',
      tipoRecurso: 'mesa',
      idRecurso: mesaId,
    });
  }
  return {
    idMesa: mesaId,
    qrVersao: versaoFinal,
    qrAtivo: true,
    tipoOperacao,
    substituiuQrAnterior: regenerar,
    urlPublica: `${origemPublica(req)}/mesa?qr=${encodeURIComponent(tokenFinal)}`,
  };
}

async function consultarQrMesa(identidade, { idMesa, req }) {
  const mesaId = validarId(String(idMesa || ''), 'idMesa');
  const mesaRef = caminhoRestaurante(identidade.idRestaurante).collection('mesas').doc(mesaId);
  const documento = await mesaRef.get();
  if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
  const mesa = documento.data() || {};
  if (mesa.qrAtivo !== true) throw new ApiError(409, 'QR_NAO_ATIVO', 'Não há QR Code ativo para consultar.');
  if (typeof mesa.qrTokenCifrado !== 'string' || !mesa.qrTokenCifrado) {
    throw new ApiError(409, 'QR_NAO_RECUPERAVEL', 'Este QR Code foi gerado antes da recuperação segura do link. Regenere o código para obter um novo link.');
  }
  const token = decifrarToken(mesa.qrTokenCifrado);
  if (hashSha256(token) !== mesa.qrHash) throw new ApiError(503, 'QR_NAO_RECUPERAVEL', 'Não foi possível recuperar o QR Code desta mesa.');
  return {
    idMesa: mesaId,
    qrVersao: mesa.qrVersao || null,
    qrAtivo: true,
    tipoOperacao: 'consultar',
    substituiuQrAnterior: false,
    urlPublica: `${origemPublica(req)}/mesa?qr=${encodeURIComponent(token)}`,
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
  let repeticaoIdempotente = false;
  await mesaRef.firestore.runTransaction(async (transacao) => {
    const idempotenciaDocumento = await transacao.get(idempotenciaRef);
    if (idempotenciaDocumento.exists) {
      const anterior = idempotenciaDocumento.data() || {};
      if (anterior.hashPayload !== hashPayload) throw new ApiError(409, 'IDEMPOTENCIA_REUTILIZADA', 'A chave da operação já foi utilizada com outros dados.');
      repeticaoIdempotente = true;
      return;
    }
    const documento = await transacao.get(mesaRef);
    if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(404, 'MESA_NAO_ENCONTRADA', 'Mesa não encontrada.');
    transacao.update(mesaRef, {
      qrAtivo: false,
      qrHash: FieldValue.delete(),
      qrTokenCifrado: FieldValue.delete(),
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
  if (!repeticaoIdempotente) {
    await registrarAuditoriaOperacional({
      identidade,
      idRequisicao: chave,
      acao: 'salao.mesa.qrRevogado',
      tipoRecurso: 'mesa',
      idRecurso: mesaId,
    });
  }
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
  obterContextoSessaoMesa,
  obterContextoAvaliacaoPublica,
  consultarSessaoMesa,
  listarCardapioPublico,
  consultarComandaPublica,
  consultarComandaPublicaEncerrada,
  consultarAvaliacaoPublica,
  criarAvaliacaoPublica,
  validarItensPedidoPublico,
  criarPedidoPublico,
  gerarQrMesa,
  consultarQrMesa,
  revogarQrMesa,
};
