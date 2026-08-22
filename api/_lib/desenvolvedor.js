'use strict';

const crypto = require('node:crypto');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { ApiError } = require('./http');
const { getAdminDb } = require('../../backend/firebase/admin');
const { registrarAuditoriaGlobal } = require('./auditoria-global');

const ESTADOS_ESTABELECIMENTO = new Set(['rascunho', 'em_teste', 'ativo', 'suspenso', 'desativado', 'encerrado']);
const PLANOS = new Map([
  ['teste', 'Período de teste'],
  ['basico', 'Plano básico'],
  ['profissional', 'Plano profissional'],
  ['enterprise', 'Plano Enterprise'],
]);
const RECURSOS_LIMITE = new Set(['usuariosAtivos', 'mesas', 'produtosCardapio', 'pedidosMensais', 'armazenamentoMb']);
const LIMITES_PADRAO = Object.freeze({ usuariosAtivos: 10, mesas: 20, produtosCardapio: 200, pedidosMensais: 1000, armazenamentoMb: 512 });

function validarId(valor, campo = 'idRestaurante') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  return valor;
}

function texto(valor, campo, maximo = 160) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  return valor.trim();
}

function enumValor(valor, conjunto, campo) {
  if (typeof valor !== 'string' || !conjunto.has(valor)) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  return valor;
}

function inteiroNaoNegativo(valor, campo, maximo = 1000000000) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0 || numero > maximo) throw new ApiError(400, 'LIMITE_INVALIDO', `${campo} deve ser um inteiro não negativo.`);
  return numero;
}

function inteiroEntre(valor, campo, minimo, maximo) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) throw new ApiError(400, 'VALOR_INVALIDO', `${campo} está fora do intervalo permitido.`);
  return numero;
}

function dataIso(valor, campo) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new ApiError(400, 'DATA_INVALIDA', `${campo} deve estar no formato AAAA-MM-DD.`);
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  return data;
}

function iso(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (valor instanceof Date) return valor.toISOString();
  return typeof valor === 'string' ? valor : null;
}

function limiteSeguro(limites = {}) {
  return Object.fromEntries([...RECURSOS_LIMITE].map((recurso) => [recurso, Number(limites[recurso] ?? LIMITES_PADRAO[recurso]) || 0]));
}

function normalizarPlano(plano = {}) {
  const codigoPlano = PLANOS.has(plano.codigoPlano) ? plano.codigoPlano : 'basico';
  return {
    codigoPlano,
    nomePlano: plano.nomePlano || PLANOS.get(codigoPlano),
    estado: plano.estado || 'ativo',
    inicioEm: iso(plano.inicioEm),
    fimEm: iso(plano.fimEm),
  };
}

function dtoEstabelecimento(documento, resumo, membrosAtivos = 0) {
  const dados = documento.data() || {};
  const plano = normalizarPlano(dados.planoAtual);
  const dadosResumo = resumo?.data() || {};
  return {
    id: documento.id,
    nome: dados.nome || 'Estabelecimento sem nome',
    tipoDocumento: dados.tipoDocumento || null,
    documentoMascarado: dados.documentoMascarado || null,
    estado: dados.estado || 'rascunho',
    criadoEm: iso(dados.criadoEm),
    atualizadoEm: iso(dados.atualizadoEm),
    temDiretor: typeof dados.idDiretor === 'string' && dados.idDiretor.length > 0,
    planoAtual: plano,
    periodoTeste: {
      diasConcedidos: Number(dados.periodoTeste?.diasConcedidos || 0),
      inicioEm: iso(dados.periodoTeste?.inicioEm),
      fimEm: iso(dados.periodoTeste?.fimEm),
    },
    limites: limiteSeguro(dados.limites),
    excecoesAtivas: Array.isArray(dados.excecoesAtivas) ? dados.excecoesAtivas.length : 0,
    usuariosAtivos: Number(dadosResumo.usuariosAtivos ?? membrosAtivos),
    pedidosPeriodo: Number(dadosResumo.pedidosPeriodo || 0),
    faturamentoPeriodoCentavos: Number(dadosResumo.faturamentoPeriodoCentavos || 0),
    ticketMedioCentavos: Number(dadosResumo.ticketMedioCentavos || 0),
    avaliacaoMedia: dadosResumo.avaliacaoMedia === null || dadosResumo.avaliacaoMedia === undefined ? null : Number(dadosResumo.avaliacaoMedia),
    ultimaAtividadeEm: iso(dadosResumo.ultimaAtividadeEm),
  };
}

async function buscarEstabelecimentos({ estado = '', codigoPlano = '', busca = '', limite = 100 } = {}) {
  const db = getAdminDb();
  const maximo = inteiroEntre(limite || 100, 'limite', 1, 100);
  const snapshot = await db.collection('restaurantes').limit(maximo).get();
  const filtroEstado = estado ? enumValor(estado, ESTADOS_ESTABELECIMENTO, 'estado') : '';
  const filtroPlano = codigoPlano ? enumValor(codigoPlano, new Set(PLANOS.keys()), 'codigoPlano') : '';
  const termo = String(busca || '').trim().toLocaleLowerCase('pt-BR');
  const itens = await Promise.all(snapshot.docs.map(async (documento) => {
    const resumo = await db.collection('resumosEstabelecimentos').doc(documento.id).get();
    const membros = await db.collection('restaurantes').doc(documento.id).collection('membros').where('estado', '==', 'ativo').get();
    return dtoEstabelecimento(documento, resumo, membros.size);
  }));
  return itens.filter((item) => {
    if (filtroEstado && item.estado !== filtroEstado) return false;
    if (filtroPlano && item.planoAtual.codigoPlano !== filtroPlano) return false;
    if (termo && !`${item.nome} ${item.documentoMascarado || ''} ${item.estado} ${item.planoAtual.nomePlano}`.toLocaleLowerCase('pt-BR').includes(termo)) return false;
    return true;
  });
}

function somar(itens, campo) {
  return itens.reduce((total, item) => total + Number(item[campo] || 0), 0);
}

async function obterDashboard() {
  const estabelecimentos = await buscarEstabelecimentos({ limite: 100 });
  const porEstado = Object.fromEntries([...ESTADOS_ESTABELECIMENTO].map((estado) => [estado, estabelecimentos.filter((item) => item.estado === estado).length]));
  const porPlano = Object.fromEntries([...PLANOS.keys()].map((codigo) => [codigo, estabelecimentos.filter((item) => item.planoAtual.codigoPlano === codigo).length]));
  const faturamento = somar(estabelecimentos, 'faturamentoPeriodoCentavos');
  const pedidos = somar(estabelecimentos, 'pedidosPeriodo');
  const usuarios = somar(estabelecimentos, 'usuariosAtivos');
  const comAvaliacao = estabelecimentos.filter((item) => Number.isFinite(item.avaliacaoMedia));
  const vencimentos = estabelecimentos.filter((item) => item.planoAtual.fimEm).sort((a, b) => String(a.planoAtual.fimEm).localeCompare(String(b.planoAtual.fimEm))).slice(0, 8);
  return {
    corpo: {
      resumo: {
        estabelecimentos: estabelecimentos.length,
        estabelecimentosAtivos: estabelecimentos.filter((item) => ['ativo', 'em_teste'].includes(item.estado)).length,
        usuariosAtivos: usuarios,
        pedidosPeriodo: pedidos,
        faturamentoPeriodoCentavos: faturamento,
        ticketMedioCentavos: pedidos > 0 ? Math.round(faturamento / pedidos) : 0,
        avaliacaoMedia: comAvaliacao.length ? Number((comAvaliacao.reduce((total, item) => total + item.avaliacaoMedia, 0) / comAvaliacao.length).toFixed(2)) : null,
      },
      distribuicao: { porEstado, porPlano },
      vencimentos,
      estabelecimentos,
      meta: { origem: 'resumosEstabelecimentos', limite: 100, atualizadoEm: new Date().toISOString() },
    },
  };
}

async function obterListaEstabelecimentos(opcoes) {
  return { corpo: { estabelecimentos: await buscarEstabelecimentos(opcoes), meta: { origem: 'restaurantes+resumosEstabelecimentos', limite: opcoes?.limite || 100 } } };
}

async function lerEstabelecimento(idRestaurante) {
  const id = validarId(idRestaurante);
  const referencia = getAdminDb().collection('restaurantes').doc(id);
  const documento = await referencia.get();
  if (!documento.exists) throw new ApiError(404, 'ESTABELECIMENTO_NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
  return { referencia, documento };
}

async function alterarEstado({ identidade, idRestaurante, estado, idRequisicao }) {
  const novoEstado = enumValor(estado, ESTADOS_ESTABELECIMENTO, 'estado');
  const { referencia, documento } = await lerEstabelecimento(idRestaurante);
  const anterior = documento.data()?.estado || 'rascunho';
  if (anterior === 'encerrado' && novoEstado !== 'encerrado') throw new ApiError(409, 'ESTABELECIMENTO_ENCERRADO', 'Estabelecimento encerrado não pode ser reativado por esta operação.');
  await referencia.update({ estado: novoEstado, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: FieldValue.increment(1) });
  await registrarAuditoriaGlobal({ idAtor: identidade.idUsuario, acao: 'estabelecimento.estado.alterado', tipoRecurso: 'restaurante', idRecurso: referencia.id, idRestaurante: referencia.id, motivo: `${anterior}->${novoEstado}`, idOperacao: idRequisicao, idRequisicao });
  return { corpo: { idRestaurante: referencia.id, estadoAnterior: anterior, estado: novoEstado, atualizado: true } };
}

async function definirPlano({ identidade, idRestaurante, codigoPlano, dias, idRequisicao }) {
  const codigo = enumValor(codigoPlano, new Set(PLANOS.keys()), 'codigoPlano');
  const periodoDias = inteiroEntre(dias === undefined ? 30 : dias, 'dias', 0, 3650);
  const { referencia, documento } = await lerEstabelecimento(idRestaurante);
  const agora = Timestamp.now();
  const fim = Timestamp.fromMillis(Date.now() + periodoDias * 24 * 60 * 60 * 1000);
  const idPlano = `plano-${crypto.randomUUID()}`;
  const planoRef = referencia.collection('planos').doc(idPlano);
  const estado = codigo === 'teste' && periodoDias === 0 ? 'expirado' : 'ativo';
  const estadoAtual = documento.data()?.estado || 'ativo';
  const novoEstadoEstabelecimento = codigo === 'teste' && periodoDias > 0 ? 'em_teste' : estadoAtual === 'em_teste' ? 'ativo' : estadoAtual;
  const plano = { codigoPlano: codigo, nomePlano: PLANOS.get(codigo), inicioEm: agora, fimEm: fim, estado, limites: limiteSeguro(documento.data()?.limites), origem: 'desenvolvedor', motivo: 'Alteração administrativa global', criadoPor: identidade.idUsuario, criadoEm: FieldValue.serverTimestamp() };
  const batch = getAdminDb().batch();
  batch.set(planoRef, plano);
  batch.update(referencia, { planoAtual: { codigoPlano: codigo, nomePlano: PLANOS.get(codigo), inicioEm: agora, fimEm: fim, estado, versao: 1 }, estado: novoEstadoEstabelecimento, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: FieldValue.increment(1) });
  await batch.commit();
  await registrarAuditoriaGlobal({ idAtor: identidade.idUsuario, acao: 'estabelecimento.plano.alterado', tipoRecurso: 'plano', idRecurso: idPlano, idRestaurante: referencia.id, motivo: codigo, idOperacao: idRequisicao, idRequisicao });
  return { corpo: { idRestaurante: referencia.id, idPlano, codigoPlano: codigo, dias: periodoDias, atualizado: true } };
}

async function definirLimite({ identidade, idRestaurante, recurso, limite, idRequisicao }) {
  const chave = enumValor(recurso, RECURSOS_LIMITE, 'recurso');
  const valor = inteiroNaoNegativo(limite, 'limite', 1000000000);
  const { referencia } = await lerEstabelecimento(idRestaurante);
  await referencia.update({ [`limites.${chave}`]: valor, atualizadoPor: identidade.idUsuario, atualizadoEm: FieldValue.serverTimestamp(), versao: FieldValue.increment(1) });
  await registrarAuditoriaGlobal({ idAtor: identidade.idUsuario, acao: 'estabelecimento.limite.alterado', tipoRecurso: 'limite', idRecurso: chave, idRestaurante: referencia.id, motivo: `${chave}=${valor}`, idOperacao: idRequisicao, idRequisicao });
  return { corpo: { idRestaurante: referencia.id, recurso: chave, limite: valor, atualizado: true } };
}

async function criarExcecao({ identidade, idRestaurante, recurso, limiteNovo, fimEm, motivo, idRequisicao }) {
  const chave = enumValor(recurso, RECURSOS_LIMITE, 'recurso');
  const valor = inteiroNaoNegativo(limiteNovo, 'limiteNovo', 1000000000);
  const dataFim = dataIso(fimEm, 'fimEm');
  if (dataFim.getTime() <= Date.now()) throw new ApiError(400, 'DATA_INVALIDA', 'A exceção deve terminar no futuro.');
  const { referencia } = await lerEstabelecimento(idRestaurante);
  const idExcecao = `excecao-${crypto.randomUUID()}`;
  await referencia.collection('excecoesLimites').doc(idExcecao).create({ recurso: chave, limiteNovo: valor, inicioEm: FieldValue.serverTimestamp(), fimEm: Timestamp.fromDate(dataFim), estado: 'ativa', motivo: texto(motivo || 'Exceção definida pelo Desenvolvedor', 'motivo', 240), criadoPor: identidade.idUsuario, criadoEm: FieldValue.serverTimestamp() });
  await registrarAuditoriaGlobal({ idAtor: identidade.idUsuario, acao: 'estabelecimento.excecao.criada', tipoRecurso: 'excecaoLimite', idRecurso: idExcecao, idRestaurante: referencia.id, motivo: chave, idOperacao: idRequisicao, idRequisicao });
  return { corpo: { idRestaurante: referencia.id, idExcecao, recurso: chave, limiteNovo: valor, fimEm: dataFim.toISOString(), criado: true } };
}

module.exports = {
  ESTADOS_ESTABELECIMENTO,
  PLANOS,
  RECURSOS_LIMITE,
  LIMITES_PADRAO,
  buscarEstabelecimentos,
  obterDashboard,
  obterListaEstabelecimentos,
  alterarEstado,
  definirPlano,
  definirLimite,
  criarExcecao,
};
