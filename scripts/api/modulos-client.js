(() => {
  'use strict';

  const API_BASE = '/api/v1';
  let csrfToken = '';
  let csrfPromise = null;

  function erroApi(resposta, dados) {
    const erro = new Error(dados?.mensagem || `Não foi possível concluir a solicitação (HTTP ${resposta.status}).`);
    erro.status = resposta.status;
    erro.code = dados?.erro || 'ERRO_API';
    erro.requestId = dados?.idRequisicao || '';
    return erro;
  }

  async function lerResposta(resposta) {
    let dados = {};
    try {
      dados = await resposta.json();
    } catch {
      dados = {};
    }
    if (!resposta.ok) throw erroApi(resposta, dados);
    return dados;
  }

  async function obterCsrf(force = false) {
    if (!force && csrfToken) return csrfToken;
    if (!force && csrfPromise) return csrfPromise;
    csrfPromise = fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(lerResposta)
      .then((dados) => {
        if (typeof dados.csrf !== 'string' || dados.csrf.length < 40) {
          const erro = new Error('Proteção de segurança indisponível.');
          erro.code = 'CSRF_NAO_RECEBIDO';
          throw erro;
        }
        csrfToken = dados.csrf;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
    return csrfPromise;
  }

  async function requisitar(caminho, opcoes = {}, tentouNovamente = false) {
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    const mutacao = !['GET', 'HEAD', 'OPTIONS'].includes(metodo);
    const headers = new Headers(opcoes.headers || {});
    headers.set('Accept', 'application/json');
    let corpo = opcoes.body;
    if (corpo !== undefined && corpo !== null && typeof corpo !== 'string') {
      headers.set('Content-Type', 'application/json');
      corpo = JSON.stringify(corpo);
    }
    if (mutacao) headers.set('X-CSRF-Token', await obterCsrf());
    const resposta = await fetch(`${API_BASE}${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: corpo,
    });
    if (resposta.status === 403 && mutacao && !tentouNovamente) {
      csrfToken = '';
      await obterCsrf(true);
      return requisitar(caminho, opcoes, true);
    }
    return lerResposta(resposta);
  }

  function query(params = {}) {
    const itens = Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '');
    return itens.length ? `?${new URLSearchParams(itens).toString()}` : '';
  }

  async function listarCardapio(recurso = '') {
    return requisitar(`/cardapio${query({ recurso })}`);
  }

  async function criarCardapio(payload) {
    return requisitar('/cardapio', { method: 'POST', body: payload });
  }

  async function atualizarCardapio(payload) {
    return requisitar('/cardapio', { method: 'PATCH', body: payload });
  }

  async function registrarMovimentacaoEstoque(payload) {
    return requisitar('/cardapio', { method: 'POST', body: { recurso: 'estoque', ...payload } });
  }

  async function listarPedidos(parametros = {}) {
    return requisitar(`/pedidos${query(parametros)}`);
  }

  async function criarPedido(payload) {
    return requisitar('/pedidos', { method: 'POST', body: payload });
  }

  async function atualizarStatusPedido(payload) {
    return requisitar('/pedidos', { method: 'PATCH', body: { recurso: 'pedido', ...payload } });
  }

  async function listarSalao(recurso = '') {
    return requisitar(`/salao${query({ recurso })}`);
  }

  async function criarReserva(payload) {
    return requisitar('/salao', { method: 'POST', body: { recurso: 'reserva', ...payload } });
  }

  async function criarMesa(payload) {
    return requisitar('/salao', { method: 'POST', body: { recurso: 'mesa', ...payload } });
  }

  async function atualizarReserva(payload) {
    return requisitar('/salao', { method: 'PATCH', body: { recurso: 'reserva', ...payload } });
  }

  async function atualizarSalao(payload) {
    return requisitar('/salao', { method: 'PATCH', body: payload });
  }

  async function listarEquipe(recurso = '', parametros = {}) {
    return requisitar(`/equipe${query({ recurso, ...parametros })}`);
  }

  async function criarEquipe(payload) {
    return requisitar('/equipe', { method: 'POST', body: payload });
  }

  async function atualizarEquipe(payload) {
    return requisitar('/equipe', { method: 'PATCH', body: payload });
  }

  function gerarChaveIdempotencia(prefixo = 'financeiro') {
    const identificador = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefixo}:${identificador}`;
  }

  async function listarFinanceiro(recurso = '', parametros = {}) {
    return requisitar(`/financeiro${query({ recurso, ...parametros })}`);
  }

  async function listarVisaoGeral(parametros = {}) {
    return requisitar(`/operacional${query({ modulo: 'visao-geral', ...parametros })}`);
  }

  async function criarContaFinanceira(payload) {
    return requisitar('/financeiro', { method: 'POST', body: { recurso: 'conta', chaveIdempotencia: payload?.chaveIdempotencia || gerarChaveIdempotencia('conta'), ...payload } });
  }

  async function criarMovimentacaoFinanceira(payload) {
    return requisitar('/financeiro', { method: 'POST', body: { recurso: 'movimentacao', chaveIdempotencia: payload?.chaveIdempotencia || gerarChaveIdempotencia('movimentacao'), ...payload } });
  }

  async function atualizarContaFinanceira(payload) {
    return requisitar('/financeiro', { method: 'PATCH', body: { recurso: 'conta', ...payload } });
  }

  async function atualizarMovimentacaoFinanceira(payload) {
    return requisitar('/financeiro', { method: 'PATCH', body: { recurso: 'movimentacao', ...payload } });
  }

  async function fecharCaixaFinanceiro(payload) {
    return requisitar('/financeiro', { method: 'POST', body: { recurso: 'fechamento', ...payload } });
  }

  window.apexModulosApi = Object.freeze({
    obterCsrf,
    requisitar,
    listarCardapio,
    criarCardapio,
    atualizarCardapio,
    registrarMovimentacaoEstoque,
    listarPedidos,
    criarPedido,
    atualizarStatusPedido,
    listarSalao,
    criarReserva,
    criarMesa,
    atualizarReserva,
    atualizarSalao,
    listarEquipe,
    criarEquipe,
    atualizarEquipe,
    listarFinanceiro,
    listarVisaoGeral,
    criarContaFinanceira,
    criarMovimentacaoFinanceira,
    atualizarContaFinanceira,
    atualizarMovimentacaoFinanceira,
    fecharCaixaFinanceiro,
  });
})();
