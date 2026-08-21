const estadoFinanceiroVazio = { caixaAtual: {}, recebimentos: [], fluxo: [], contas: [], relatoriosMensais: [], categorias: [], encaminhamentos: [] };

(() => {
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

  window.dadosFinanceirosApexFood = { caixaAtual: {}, recebimentos: [], fluxo: [], contas: [], relatoriosMensais: [], categorias: [], encaminhamentos: [] };

  function aplicarDadosRemotos(dados) {
    Object.assign(window.dadosFinanceirosApexFood, {
      caixaAtual: dados.caixaAtual || window.dadosFinanceirosApexFood.caixaAtual,
      recebimentos: Array.isArray(dados.recebimentos) ? dados.recebimentos : [],
      fluxo: Array.isArray(dados.fluxo) ? dados.fluxo : [],
      contas: Array.isArray(dados.contas) ? dados.contas : [],
      relatoriosMensais: Array.isArray(dados.relatoriosMensais) ? dados.relatoriosMensais : [],
      categorias: Array.isArray(dados.categorias) ? dados.categorias : [],
      encaminhamentos: Array.isArray(dados.encaminhamentos) ? dados.encaminhamentos : Array.isArray(dados.encaminhamentosCaixa) ? dados.encaminhamentosCaixa : [],
    });
  }

  window.dadosFinanceirosRemotoAtivo = false;
  window.apexFinanceiroRecarregar = (parametros = {}) => carregarCliente()
    .then((api) => api.listarFinanceiro('', parametros))
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      aplicarDadosRemotos(dados);
      window.dadosFinanceirosRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:financeiro-atualizado'));
      return true;
    });
  window.dadosFinanceirosPronto = carregarCliente()
    .then((api) => api.listarFinanceiro())
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      aplicarDadosRemotos(dados);
      window.dadosFinanceirosRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:financeiro-atualizado'));
      return true;
    })
    .catch((erro) => {
      window.dadosFinanceirosErro = erro;
      {
        Object.assign(window.dadosFinanceirosApexFood, {
          caixaAtual: {},
          recebimentos: [],
          fluxo: [],
          contas: [],
          relatoriosMensais: [],
          categorias: [],
          encaminhamentos: [],
        });
        document.dispatchEvent(new CustomEvent('apex:financeiro-indisponivel'));
      }
      return false;
    });
})();
