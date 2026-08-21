(() => {
  'use strict';

  const vazio = {
    periodo: { tipo: 'dia', inicio: '', fim: '', status: 'Carregando dados reais...' },
    financeiro: { caixaAtual: {}, recebimentos: [], fluxo: [], contas: [], relatoriosMensais: [], categorias: [], resumoFinanceiro: {} },
    salao: { mesas: [], reservas: [], ocupacao: 0, ocupadas: 0, disponiveis: 0, bloqueadas: 0 },
    operacao: { pedidosAtivos: [], pedidosHistorico: [] },
    cardapio: { produtos: [], categorias: [], produtosMaisVendidos: [] },
    equipe: { funcionarios: [], comissoes: [] },
    relatorios: { vendasDiarias: [], vendasSemanais: [], vendasMensais: [], vendasPorCanal: [], vendasPorCanalAnterior: [], canais: [], produtosMaisVendidos: [], mapaCalor: [], faixasHorarias: [], diasSemana: [], avaliacoes: [], distribuicaoNotas: [], performanceEquipe: [], indicadores: {}, atualizadoEm: '', origem: '' },
    indicadores: {},
    meta: { dadosDisponiveis: false, fonte: 'firestore' },
  };

  const dados = window.dadosVisaoGeralApexFood || structuredClone(vazio);
  window.dadosVisaoGeralApexFood = dados;

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa16-visao';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente da Visão Geral.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function aplicarDados(resposta) {
    const corpo = resposta || {};
    for (const chave of ['periodo', 'financeiro', 'salao', 'operacao', 'cardapio', 'equipe', 'relatorios', 'indicadores', 'meta']) {
      const destino = dados[chave] || {};
      const origem = corpo[chave] || vazio[chave] || {};
      if (Array.isArray(origem)) {
        destino.splice(0, destino.length, ...origem);
      } else if (typeof origem === 'object') {
        Object.keys(destino).forEach((campo) => { delete destino[campo]; });
        Object.assign(destino, origem);
      }
      dados[chave] = destino;
    }
    dados.erro = null;
    dados.sincronizando = false;
    document.dispatchEvent(new CustomEvent('apex:visao-geral-atualizada'));
    window.apexHomeAtualizarDados?.();
  }

  function limparDados(erro) {
    for (const chave of ['periodo', 'financeiro', 'salao', 'operacao', 'cardapio', 'equipe', 'relatorios', 'indicadores', 'meta']) {
      const destino = dados[chave] || {};
      const origem = vazio[chave] || {};
      Object.keys(destino).forEach((campo) => { delete destino[campo]; });
      Object.assign(destino, structuredClone(origem));
      dados[chave] = destino;
    }
    dados.erro = erro;
    dados.sincronizando = false;
    document.dispatchEvent(new CustomEvent('apex:visao-geral-indisponivel'));
    window.apexHomeAtualizarDados?.();
  }

  let atualizacaoId = null;
  let falhasConsecutivas = 0;
  let ultimosParametros = { periodo: 'dia' };

  function paginaVisaoGeralAtiva() {
    return Boolean(document.getElementById('homeVendasGrafico'));
  }

  function pararAtualizacao() {
    if (atualizacaoId) window.clearTimeout(atualizacaoId);
    atualizacaoId = null;
  }

  function agendarAtualizacao(atraso = 60000) {
    if (document.hidden || atualizacaoId || !paginaVisaoGeralAtiva()) return;
    const jitter = Math.floor(Math.random() * 1200);
    atualizacaoId = window.setTimeout(async () => {
      atualizacaoId = null;
      await window.apexVisaoGeralRecarregar(ultimosParametros, { automatica: true });
    }, Math.max(250, atraso + jitter));
  }

  window.apexVisaoGeralRecarregar = (parametros = {}, opcoes = {}) => {
    pararAtualizacao();
    ultimosParametros = { ...ultimosParametros, ...parametros };
    dados.sincronizando = true;
    window.apexHomeAtualizarDados?.();
    return carregarCliente()
      .then((api) => api.listarVisaoGeral(ultimosParametros))
      .then((resposta) => {
        if (typeof resposta?.meta?.idRestaurante !== 'string') {
          const erro = new Error('Restaurante ativo não encontrado.');
          erro.code = 'RESTAURANTE_NAO_SELECIONADO';
          throw erro;
        }
        falhasConsecutivas = 0;
        aplicarDados(resposta);
        agendarAtualizacao(60000);
        return true;
      })
      .catch((erro) => {
        falhasConsecutivas += 1;
        limparDados(erro);
        const atraso = Math.min(60000, 5000 * (2 ** Math.min(falhasConsecutivas - 1, 3)));
        agendarAtualizacao(atraso);
        return false;
      });
  };

  window.apexVisaoGeralPararAtualizacao = pararAtualizacao;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pararAtualizacao();
    else if (paginaVisaoGeralAtiva()) window.apexVisaoGeralRecarregar(ultimosParametros, { automatica: true });
  });

  window.dadosVisaoGeralPronto = window.apexVisaoGeralRecarregar({ periodo: 'dia' });
})();
