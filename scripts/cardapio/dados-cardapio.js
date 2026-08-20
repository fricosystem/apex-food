(() => {
  'use strict';

  const previewCardapio = {
    categorias: [
      { id: 'entradas', nome: 'Entradas', descricao: 'Para começar a experiência', icone: 'salad', cor: 'green', produtos: 2, destaque: 'Salada Caesar' },
      { id: 'principais', nome: 'Pratos Principais', descricao: 'Receitas mais pedidas da casa', icone: 'chef-hat', cor: 'orange', produtos: 3, destaque: 'Pizza Margherita' },
      { id: 'hamburgueres', nome: 'Hambúrgueres', descricao: 'Blends artesanais e acompanhamentos', icone: 'sandwich', cor: 'yellow', produtos: 1, destaque: 'Hambúrguer Artesanal' },
      { id: 'bebidas', nome: 'Bebidas', descricao: 'Opções geladas e refrescantes', icone: 'glass-water', cor: 'blue', produtos: 4, destaque: 'Chopp' },
      { id: 'sobremesas', nome: 'Sobremesas', descricao: 'Para fechar o pedido', icone: 'cake-slice', cor: 'purple', produtos: 2, destaque: 'Tiramisù' },
    ],
    produtos: (window.dadosPedidosApexFood?.produtos || []).map((produto, indice) => ({
      ...produto,
      codigo: `PRD-${String(indice + 101).padStart(3, '0')}`,
      disponibilidade: indice !== 8,
      estoque: [18, 12, 8, 25, 16, 21, 40, 32, 0, 9, 14, 28][indice] || 10,
      unidade: produto.categoria === 'bebidas' ? 'unidade' : 'porção',
      custo: Number((produto.preco * 0.38).toFixed(2)),
      tempoPreparo: produto.categoria === 'bebidas' ? 3 : produto.categoria === 'sobremesas' ? 5 : 18,
      tags: produto.destaque ? ['Mais vendido', 'Destaque'] : [],
    })),
    promocoes: [
      { id: 1, nome: 'Festival da Pizza', tipo: 'Combo', descricao: 'Pizza grande + refrigerante 1L', desconto: '15%', valor: 'R$ 61,87', status: 'ativa', inicio: '15/08/2026', fim: '31/08/2026', usos: 34, limite: 100, cor: 'orange' },
      { id: 2, nome: 'Happy Hour do Chopp', tipo: 'Horário', descricao: 'Chopp em dobro de segunda a quinta', desconto: '2 por 1', valor: 'R$ 12,00', status: 'ativa', inicio: '01/08/2026', fim: '30/09/2026', usos: 58, limite: 200, cor: 'yellow' },
      { id: 3, nome: 'Sobremesa da Casa', tipo: 'Produto', descricao: 'Tiramisù com 20% de desconto', desconto: '20%', valor: 'R$ 16,80', status: 'agendada', inicio: '20/08/2026', fim: '31/08/2026', usos: 0, limite: 80, cor: 'purple' },
      { id: 4, nome: 'Cliente APEX', tipo: 'Fidelidade', descricao: '10% em pedidos acima de R$ 150', desconto: '10%', valor: 'Cupom APEX10', status: 'inativa', inicio: '01/07/2026', fim: '31/07/2026', usos: 120, limite: 120, cor: 'blue' },
    ],
  };

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa6-caixa';
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

  const ambienteLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  window.dadosCardapioApexFood = ambienteLocal ? previewCardapio : { categorias: [], produtos: [], promocoes: [] };
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
      if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        window.dadosCardapioApexFood = { categorias: [], produtos: [], promocoes: [] };
        document.dispatchEvent(new CustomEvent('apex:cardapio-indisponivel'));
      }
      return false;
    });
})();
