const produtosBaseCardapio = window.dadosPedidosApexFood?.produtos || [];
window.dadosCardapioApexFood = {
  categorias: [
    { id: 'entradas', nome: 'Entradas', descricao: 'Para começar a experiência', icone: 'salad', cor: 'green', produtos: 2, destaque: 'Salada Caesar' },
    { id: 'principais', nome: 'Pratos Principais', descricao: 'Receitas mais pedidas da casa', icone: 'chef-hat', cor: 'orange', produtos: 3, destaque: 'Pizza Margherita' },
    { id: 'hamburgueres', nome: 'Hambúrgueres', descricao: 'Blends artesanais e acompanhamentos', icone: 'sandwich', cor: 'yellow', produtos: 1, destaque: 'Hambúrguer Artesanal' },
    { id: 'bebidas', nome: 'Bebidas', descricao: 'Opções geladas e refrescantes', icone: 'glass-water', cor: 'blue', produtos: 4, destaque: 'Chopp' },
    { id: 'sobremesas', nome: 'Sobremesas', descricao: 'Para fechar o pedido', icone: 'cake-slice', cor: 'purple', produtos: 2, destaque: 'Tiramisù' }
  ],
  produtos: produtosBaseCardapio.map((produto, indice) => ({
    ...produto,
    codigo: `PRD-${String(indice + 101).padStart(3, '0')}`,
    disponibilidade: indice !== 8,
    estoque: [18, 12, 8, 25, 16, 21, 40, 32, 0, 9, 14, 28][indice] || 10,
    unidade: produto.categoria === 'bebidas' ? 'unidade' : 'porção',
    custo: Number((produto.preco * 0.38).toFixed(2)),
    tempoPreparo: produto.categoria === 'bebidas' ? 3 : produto.categoria === 'sobremesas' ? 5 : 18,
    tags: produto.destaque ? ['Mais vendido', 'Destaque'] : []
  })),
  promocoes: [
    { id: 1, nome: 'Festival da Pizza', tipo: 'Combo', descricao: 'Pizza grande + refrigerante 1L', desconto: '15%', valor: 'R$ 61,87', status: 'ativa', inicio: '15/08/2026', fim: '31/08/2026', usos: 34, limite: 100, cor: 'orange' },
    { id: 2, nome: 'Happy Hour do Chopp', tipo: 'Horário', descricao: 'Chopp em dobro de segunda a quinta', desconto: '2 por 1', valor: 'R$ 12,00', status: 'ativa', inicio: '01/08/2026', fim: '30/09/2026', usos: 58, limite: 200, cor: 'yellow' },
    { id: 3, nome: 'Sobremesa da Casa', tipo: 'Produto', descricao: 'Tiramisù com 20% de desconto', desconto: '20%', valor: 'R$ 16,80', status: 'agendada', inicio: '20/08/2026', fim: '31/08/2026', usos: 0, limite: 80, cor: 'purple' },
    { id: 4, nome: 'Cliente APEX', tipo: 'Fidelidade', descricao: '10% em pedidos acima de R$ 150', desconto: '10%', valor: 'Cupom APEX10', status: 'inativa', inicio: '01/07/2026', fim: '31/07/2026', usos: 120, limite: 120, cor: 'blue' }
  ]
};
