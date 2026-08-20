(() => {
  'use strict';

  const vazio = {
    periodo: { tipo: 'dia', inicio: '', fim: '', status: 'Carregando dados reais...' },
    financeiro: { caixaAtual: {}, recebimentos: [], fluxo: [], contas: [], relatoriosMensais: [], categorias: [], resumoFinanceiro: {} },
    salao: { mesas: [], reservas: [], ocupacao: 0, ocupadas: 0, disponiveis: 0, bloqueadas: 0 },
    operacao: { pedidosAtivos: [], pedidosHistorico: [] },
    cardapio: { produtos: [], categorias: [], produtosMaisVendidos: [] },
    equipe: { funcionarios: [], comissoes: [] },
    relatorios: { vendasDiarias: [], vendasSemanais: [], vendasMensais: [], canais: [], produtosMaisVendidos: [], mapaCalor: [], faixasHorarias: [], diasSemana: [], avaliacoes: [], distribuicaoNotas: [], performanceEquipe: [], indicadores: {}, atualizadoEm: '', origem: '' },
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
      script.src = '/scripts/api/modulos-client.js?v=fase4';
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
    document.dispatchEvent(new CustomEvent('apex:visao-geral-indisponivel'));
    window.apexHomeAtualizarDados?.();
  }

  window.apexVisaoGeralRecarregar = (parametros = {}) => carregarCliente()
    .then((api) => api.listarVisaoGeral(parametros))
    .then((resposta) => {
      if (typeof resposta?.meta?.idRestaurante !== 'string') {
        const erro = new Error('Restaurante ativo não encontrado.');
        erro.code = 'RESTAURANTE_NAO_SELECIONADO';
        throw erro;
      }
      aplicarDados(resposta);
      return true;
    })
    .catch((erro) => {
      limparDados(erro);
      return false;
    });

  window.dadosVisaoGeralPronto = window.apexVisaoGeralRecarregar({ periodo: 'dia' });
})();
