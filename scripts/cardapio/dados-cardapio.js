(() => {
  'use strict';

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa20-cardapio-estoque';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente dos módulos.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function centavosParaReais(valor) {
    return Number.isFinite(Number(valor)) ? Number((Number(valor) / 100).toFixed(2)) : 0;
  }

  function adaptarCategoria(categoria) {
    return {
      ...categoria,
      id: String(categoria.id),
      icone: categoria.icone || 'utensils',
      cor: categoria.cor || 'orange',
      produtos: Number(categoria.produtos || 0),
    };
  }

  function adaptarProduto(produto) {
    return {
      ...produto,
      id: String(produto.id),
      codigo: produto.codigo || `PRD-${String(produto.id).slice(0, 8)}`,
      unidade: produto.unidade || 'unidade',
      categoria: String(produto.idCategoria || produto.categoria || ''),
      preco: centavosParaReais(produto.precoCentavos ?? produto.preco),
      custo: centavosParaReais(produto.custoCentavos ?? produto.custo),
      disponibilidade: produto.disponibilidade !== false,
      estoque: Number(produto.estoque || 0),
      tempoPreparo: Number(produto.tempoPreparo || 0),
      tags: Array.isArray(produto.tags) ? produto.tags : [],
    };
  }

  function adaptarPromocao(promocao) {
    const valorCentavos = Number(promocao.valorCentavos || 0);
    const valor = valorCentavos > 0
      ? `R$ ${(valorCentavos / 100).toFixed(2).replace('.', ',')}`
      : (promocao.valor || '—');
    return {
      ...promocao,
      id: String(promocao.id),
      cor: promocao.cor || 'orange',
      usos: Number(promocao.usos || 0),
      limite: Number(promocao.limite || 0),
      valor,
      inicio: promocao.inicio || promocao.inicioEm || 'Sem início',
      fim: promocao.fim || promocao.fimEm || 'Sem fim',
      status: promocao.estado || promocao.status || 'ativa',
    };
  }

  window.dadosCardapioApexFood = { categorias: [], produtos: [], promocoes: [] };
  window.dadosCardapioRemotoAtivo = false;
  window.dadosCardapioPronto = carregarCliente()
    .then((api) => api.listarCardapio())
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      const produtos = (dados.produtos || []).map(adaptarProduto);
      const categorias = (dados.categorias || []).map(adaptarCategoria).map((categoria) => ({
        ...categoria,
        produtos: Number(categoria.produtos || produtos.filter((produto) => produto.categoria === categoria.id).length),
      }));
      window.dadosCardapioApexFood = {
        categorias,
        produtos,
        promocoes: (dados.promocoes || []).map(adaptarPromocao),
      };
      window.dadosCardapioRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:cardapio-atualizado'));
      return true;
    })
    .catch((erro) => {
      window.dadosCardapioErro = erro;
      window.dadosCardapioApexFood = { categorias: [], produtos: [], promocoes: [] };
      document.dispatchEvent(new CustomEvent('apex:cardapio-indisponivel'));
      return false;
    });
})();
