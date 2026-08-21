(() => {
  'use strict';

  const diasPadrao = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const faixasPadrao = ['11h–12h', '12h–13h', '13h–14h', '14h–15h', '15h–16h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h'];

  function estadoVazio() {
    return {
      atualizadoEm: '',
      pedidosConsiderados: 0,
      produtosBase: 0,
      vendasDiarias: [],
      vendasSemanais: [],
      vendasMensais: [],
      canais: [],
      produtosMaisVendidos: [],
      diasSemana: diasPadrao.slice(),
      faixasHorarias: faixasPadrao.slice(),
      mapaCalor: [],
      avaliacoes: [],
      distribuicaoNotas: [],
      performanceEquipe: [],
      indicadores: { notaMedia: 0, totalAvaliacoes: 0, taxaResposta: 0, vendasHoje: 0, pedidosHoje: 0, picoAlmoco: '—', picoJantar: '—' },
      meta: { fonte: 'firestore', dadosDisponiveis: false },
    };
  }

  window.dadosRelatoriosApexFood = estadoVazio();
  let atualizacaoId = null;
  let falhasConsecutivas = 0;
  let ultimosParametros = { periodo: 'dia' };

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa22-dados-reais-global';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente dos módulos.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function limparAtualizacao() {
    if (atualizacaoId) window.clearTimeout(atualizacaoId);
    atualizacaoId = null;
  }

  function agendarAtualizacao(atraso = 60000) {
    if (document.hidden || atualizacaoId) return;
    const jitter = Math.floor(Math.random() * 1500);
    atualizacaoId = window.setTimeout(() => {
      atualizacaoId = null;
      window.recarregarRelatorios?.(ultimosParametros, { automatica: true });
    }, Math.max(1000, atraso + jitter));
  }

  function numero(valor) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : 0;
  }

  function lista(valor) {
    return Array.isArray(valor) ? valor : [];
  }

  function adaptarResposta(resposta) {
    const relatorios = resposta?.relatorios || {};
    const indicadores = { ...(relatorios.indicadores || {}), ...(resposta?.indicadores || {}) };
    const vendasPorCanal = lista(relatorios.vendasPorCanal || relatorios.canais).map((item, indice) => ({
      ...item,
      nome: item.nome || item.canal || 'Outros',
      vendas: numero(item.vendas ?? item.valor),
      pedidos: numero(item.pedidos),
      percentual: numero(item.percentual),
      cor: item.cor || ['bg-accent', 'bg-blue', 'bg-purple', 'bg-green'][indice % 4],
      icone: item.icone || ['armchair', 'bike', 'shopping-bag', 'layers'][indice % 4],
    }));
    return {
      atualizadoEm: relatorios.atualizadoEm || new Date().toISOString(),
      pedidosConsiderados: numero(indicadores.pedidos ?? resposta?.indicadores?.pedidos),
      produtosBase: lista(resposta?.cardapio?.produtos).length,
      vendasDiarias: lista(relatorios.vendasDiarias),
      vendasSemanais: lista(relatorios.vendasSemanais),
      vendasMensais: lista(relatorios.vendasMensais),
      canais: vendasPorCanal,
      produtosMaisVendidos: lista(relatorios.produtosMaisVendidos),
      diasSemana: lista(relatorios.diasSemana).length ? relatorios.diasSemana : diasPadrao.slice(),
      faixasHorarias: lista(relatorios.faixasHorarias).length ? relatorios.faixasHorarias : faixasPadrao.slice(),
      mapaCalor: lista(relatorios.mapaCalor),
      avaliacoes: lista(relatorios.avaliacoes),
      distribuicaoNotas: lista(relatorios.distribuicaoNotas),
      performanceEquipe: lista(relatorios.performanceEquipe),
      indicadores: {
        notaMedia: numero(indicadores.notaMedia),
        totalAvaliacoes: numero(indicadores.totalAvaliacoes),
        taxaResposta: numero(indicadores.taxaResposta),
        vendasHoje: numero(indicadores.vendasHoje),
        pedidosHoje: numero(indicadores.pedidosHoje ?? indicadores.pedidos),
        picoAlmoco: indicadores.picoAlmoco || '—',
        picoJantar: indicadores.picoJantar || '—',
        vendas: numero(indicadores.vendas ?? indicadores.vendasCentavos) / (indicadores.vendasCentavos !== undefined ? 100 : 1),
        despesas: numero(indicadores.despesas ?? indicadores.despesasCentavos) / (indicadores.despesasCentavos !== undefined ? 100 : 1),
        resultado: numero(indicadores.resultado ?? indicadores.resultadoCentavos) / (indicadores.resultadoCentavos !== undefined ? 100 : 1),
      },
      meta: resposta.meta,
    };
  }

  function limparDados(erro) {
    window.dadosRelatoriosApexFood = estadoVazio();
    window.dadosRelatoriosErro = erro;
    document.dispatchEvent(new CustomEvent('apex:relatorios-indisponivel'));
    document.dispatchEvent(new CustomEvent('apex:relatorios-atualizado'));
  }

  async function carregarDadosRelatorios(parametros = {}, opcoes = {}) {
    if (!opcoes.automatica) limparAtualizacao();
    ultimosParametros = { ...ultimosParametros, ...parametros };
    try {
      const api = await carregarCliente();
      const resposta = await api.listarVisaoGeral(ultimosParametros);
      if (typeof resposta?.meta?.idRestaurante !== 'string' || resposta?.meta?.fonte !== 'firestore') {
        const erro = new Error('Dados reais dos relatórios não estão disponíveis.');
        erro.code = 'DADOS_REAIS_INDISPONIVEIS';
        throw erro;
      }
      window.dadosRelatoriosApexFood = adaptarResposta(resposta);
      window.dadosRelatoriosRemotoAtivo = true;
      window.dadosRelatoriosErro = null;
      falhasConsecutivas = 0;
      document.dispatchEvent(new CustomEvent('apex:relatorios-atualizado'));
      agendarAtualizacao();
      return window.dadosRelatoriosApexFood;
    } catch (erro) {
      window.dadosRelatoriosRemotoAtivo = false;
      falhasConsecutivas += 1;
      limparDados(erro);
      agendarAtualizacao(Math.min(120000, 5000 * (2 ** Math.min(falhasConsecutivas - 1, 4))));
      return window.dadosRelatoriosApexFood;
    }
  }

  window.recarregarRelatorios = carregarDadosRelatorios;
  window.dadosRelatoriosPronto = carregarDadosRelatorios();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) limparAtualizacao();
    else carregarDadosRelatorios(ultimosParametros, { automatica: true });
  });
  window.addEventListener('beforeunload', limparAtualizacao);
})();
