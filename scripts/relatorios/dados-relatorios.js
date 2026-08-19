(() => {
  const pedidos = window.dadosPedidosApexFood || { pedidosAtivos: [], pedidosHistorico: [], produtos: [], categorias: [] };
  const cardapio = window.dadosCardapioApexFood || { produtos: [], categorias: [] };
  const equipe = window.dadosEquipeApexFood || { funcionarios: [], comissoes: [] };

  const produtosPorNome = new Map([...(cardapio.produtos || []), ...(pedidos.produtos || [])].map(produto => [produto.nome, produto]));
  const categoriaPorId = new Map([...(cardapio.categorias || []), ...(pedidos.categorias || [])].map(categoria => [categoria.id, categoria]));
  const moeda = valor => Number(Number(valor || 0).toFixed(2));

  const vendasDiarias = [
    { data: '12/08/2026', label: '12 ago', pedidos: 28, vendas: 4280.40, ticketMedio: 152.87 },
    { data: '13/08/2026', label: '13 ago', pedidos: 31, vendas: 4865.70, ticketMedio: 156.96 },
    { data: '14/08/2026', label: '14 ago', pedidos: 36, vendas: 5720.20, ticketMedio: 158.89 },
    { data: '15/08/2026', label: '15 ago', pedidos: 42, vendas: 6842.90, ticketMedio: 162.93 },
    { data: '16/08/2026', label: '16 ago', pedidos: 38, vendas: 6294.30, ticketMedio: 165.64 },
    { data: '17/08/2026', label: '17 ago', pedidos: 44, vendas: 7586.80, ticketMedio: 172.43 },
    { data: '18/08/2026', label: '18 ago', pedidos: 32, vendas: 5298.60, ticketMedio: 165.58 }
  ];

  const vendasSemanais = [
    { periodo: '15–21 jul', pedidos: 188, vendas: 29840.50, ticketMedio: 158.73 },
    { periodo: '22–28 jul', pedidos: 204, vendas: 32580.80, ticketMedio: 159.71 },
    { periodo: '29 jul–04 ago', pedidos: 219, vendas: 35420.20, ticketMedio: 161.74 },
    { periodo: '05–11 ago', pedidos: 236, vendas: 38860.70, ticketMedio: 164.66 },
    { periodo: '12–18 ago', pedidos: 251, vendas: 40889.00, ticketMedio: 162.90 }
  ];

  const vendasMensais = [
    { periodo: 'Mar/2026', pedidos: 812, vendas: 128450.80, ticketMedio: 158.19 },
    { periodo: 'Abr/2026', pedidos: 846, vendas: 136280.40, ticketMedio: 161.09 },
    { periodo: 'Mai/2026', pedidos: 879, vendas: 143920.70, ticketMedio: 163.73 },
    { periodo: 'Jun/2026', pedidos: 904, vendas: 150840.20, ticketMedio: 166.86 },
    { periodo: 'Jul/2026', pedidos: 946, vendas: 158620.50, ticketMedio: 167.67 },
    { periodo: 'Ago/2026', pedidos: 523, vendas: 85890.40, ticketMedio: 164.16 }
  ];

  const canais = [
    { id: 'salao', nome: 'Salão', percentual: 62, vendas: 25350.20, cor: 'bg-accent', icone: 'armchair' },
    { id: 'delivery', nome: 'Delivery', percentual: 24, vendas: 9813.36, cor: 'bg-blue', icone: 'bike' },
    { id: 'retirada', nome: 'Retirada', percentual: 14, vendas: 5725.44, cor: 'bg-purple', icone: 'shopping-bag' }
  ];

  const rankingBase = [
    { produtoId: 1, quantidade: 84, receita: 5031.60, variacao: 18.4 },
    { produtoId: 2, quantidade: 72, receita: 4968.00, variacao: 12.8 },
    { produtoId: 4, quantidade: 68, receita: 2917.20, variacao: 9.6 },
    { produtoId: 3, quantidade: 55, receita: 2695.00, variacao: 6.2 },
    { produtoId: 6, quantidade: 51, receita: 1524.90, variacao: -3.4 },
    { produtoId: 10, quantidade: 44, receita: 924.00, variacao: 14.1 },
    { produtoId: 12, quantidade: 41, receita: 492.00, variacao: 4.8 },
    { produtoId: 5, quantidade: 37, receita: 1217.30, variacao: -1.7 },
    { produtoId: 8, quantidade: 35, receita: 451.50, variacao: 8.3 },
    { produtoId: 11, quantidade: 29, receita: 548.10, variacao: 2.5 }
  ];

  const produtosMaisVendidos = rankingBase.map((item, indice) => {
    const produto = produtosPorNome.get((pedidos.produtos || []).find(p => p.id === item.produtoId)?.nome) || (cardapio.produtos || []).find(p => p.id === item.produtoId) || {};
    const categoria = categoriaPorId.get(produto.categoria) || { nome: 'Outros', cor: 'muted' };
    return {
      ...item,
      posicao: indice + 1,
      nome: produto.nome || `Produto ${item.produtoId}`,
      preco: produto.preco || 0,
      categoria: categoria.nome,
      categoriaId: produto.categoria || 'outros',
      custo: produto.custo || moeda((produto.preco || 0) * 0.38),
      margem: produto.preco ? Math.round(((produto.preco - (produto.custo || produto.preco * 0.38)) / produto.preco) * 100) : 0
    };
  });

  const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const faixasHorarias = ['11h–12h', '12h–13h', '13h–14h', '14h–15h', '15h–16h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h'];
  const mapaCalor = [
    [14, 38, 64, 42, 22, 8, 16, 32, 28, 14],
    [12, 42, 70, 48, 24, 10, 20, 38, 34, 18],
    [16, 45, 74, 52, 28, 12, 22, 44, 39, 20],
    [18, 52, 78, 60, 32, 14, 28, 55, 49, 26],
    [24, 64, 91, 72, 40, 18, 36, 76, 82, 48],
    [30, 82, 100, 88, 54, 26, 58, 94, 96, 72],
    [26, 70, 86, 76, 46, 20, 42, 68, 66, 44]
  ];

  const avaliacoes = [
    { id: 'AVA-201', cliente: 'Fernanda Souza', iniciais: 'FS', nota: 5, categoria: 'Atendimento', comentario: 'Atendimento impecável e os pratos chegaram muito rápido. Voltaremos com certeza!', data: '18/08/2026', canal: 'Google', respondida: false },
    { id: 'AVA-202', cliente: 'João Santos', iniciais: 'JS', nota: 5, categoria: 'Qualidade dos pratos', comentario: 'O Filé Mignon estava no ponto perfeito. Saboroso e muito bem apresentado.', data: '18/08/2026', canal: 'App APEX', respondida: true },
    { id: 'AVA-203', cliente: 'Carla Ferreira', iniciais: 'CF', nota: 4, categoria: 'Ambiente', comentario: 'Ambiente agradável e música na altura certa. Poderia ter mais opções vegetarianas.', data: '17/08/2026', canal: 'Google', respondida: false },
    { id: 'AVA-204', cliente: 'Marcos Oliveira', iniciais: 'MO', nota: 5, categoria: 'Atendimento', comentario: 'O garçom João foi muito atencioso durante toda a experiência.', data: '17/08/2026', canal: 'App APEX', respondida: true },
    { id: 'AVA-205', cliente: 'Beatriz Ramos', iniciais: 'BR', nota: 3, categoria: 'Tempo de espera', comentario: 'A comida estava boa, mas esperamos um pouco mais do que o esperado.', data: '16/08/2026', canal: 'iFood', respondida: false },
    { id: 'AVA-206', cliente: 'Lucas Martins', iniciais: 'LM', nota: 5, categoria: 'Qualidade dos pratos', comentario: 'Pizza Margherita deliciosa, massa leve e ingredientes frescos.', data: '16/08/2026', canal: 'Google', respondida: true },
    { id: 'AVA-207', cliente: 'Ana Costa', iniciais: 'AC', nota: 4, categoria: 'Delivery', comentario: 'Pedido chegou bem embalado e ainda quente. A entrega poderia ser um pouco mais rápida.', data: '15/08/2026', canal: 'iFood', respondida: false }
  ];

  const distribuicaoNotas = [
    { nota: 5, quantidade: 128, percentual: 71 },
    { nota: 4, quantidade: 36, percentual: 20 },
    { nota: 3, quantidade: 10, percentual: 6 },
    { nota: 2, quantidade: 4, percentual: 2 },
    { nota: 1, quantidade: 2, percentual: 1 }
  ];

  const comissoesPorFuncionario = new Map((equipe.comissoes || []).map(item => [item.funcionarioId, item]));
  const performanceEquipe = (equipe.funcionarios || []).filter(funcionario => ['Garçom', 'Garçonete', 'Bartender'].includes(funcionario.cargo)).map(funcionario => {
    const comissao = comissoesPorFuncionario.get(funcionario.id) || {};
    return {
      funcionarioId: funcionario.id,
      nome: funcionario.nome,
      iniciais: funcionario.iniciais,
      cargo: funcionario.cargo,
      turno: funcionario.turno,
      status: funcionario.status,
      vendas: funcionario.vendasMes || 0,
      pedidos: funcionario.pedidos || 0,
      avaliacao: funcionario.avaliacao || 0,
      percentualComissao: comissao.percentual || funcionario.comissao || 0,
      comissao: comissao.comissao || moeda((funcionario.vendasMes || 0) * ((funcionario.comissao || 0) / 100)),
      variacao: comissao.variacao || 0,
      cor: funcionario.cor
    };
  }).sort((a, b) => b.vendas - a.vendas).map((item, indice) => ({ ...item, posicao: indice + 1 }));

  const pedidosConsiderados = [...(pedidos.pedidosAtivos || []), ...(pedidos.pedidosHistorico || [])];
  window.dadosRelatoriosApexFood = {
    atualizadoEm: '18/08/2026 15:30',
    origem: 'Base operacional de preview do APEX Food',
    pedidosConsiderados: pedidosConsiderados.length,
    produtosBase: produtosPorNome.size,
    vendasDiarias,
    vendasSemanais,
    vendasMensais,
    canais,
    produtosMaisVendidos,
    diasSemana,
    faixasHorarias,
    mapaCalor,
    avaliacoes,
    distribuicaoNotas,
    performanceEquipe,
    indicadores: {
      notaMedia: 4.6,
      totalAvaliacoes: 180,
      taxaResposta: 64,
      vendasHoje: vendasDiarias[vendasDiarias.length - 1].vendas,
      pedidosHoje: vendasDiarias[vendasDiarias.length - 1].pedidos,
      picoAlmoco: '12h–14h',
      picoJantar: '19h–21h'
    }
  };
})();
