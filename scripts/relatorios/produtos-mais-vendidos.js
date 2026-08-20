(() => {
  const dados = window.dadosRelatoriosApexFood;
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const csv = valor => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  function exportar(itens) { if (!itens.length) return aviso('Nenhum produto encontrado para exportar.'); const linhas = [['Posição', 'Produto', 'Categoria', 'Quantidade', 'Receita', 'Margem'], ...itens.map(item => [item.posicao, item.nome, item.categoria, item.quantidade, item.receita.toFixed(2), item.margem])]; const blob = new Blob([linhas.map(linha => linha.map(csv).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'produtos-mais-vendidos.csv'; link.click(); URL.revokeObjectURL(link.href); }
  const categoriaEl = document.getElementById('categoriaProdutosVendidos');

  function dadosFiltrados() {
    const categoria = categoriaEl?.value || 'todas';
    return dados.produtosMaisVendidos.filter(item => categoria === 'todas' || item.categoriaId === categoria);
  }

  function renderizar() {
    const itens = dadosFiltrados();
    const totalUnidades = itens.reduce((total, item) => total + item.quantidade, 0);
    const totalReceita = itens.reduce((total, item) => total + item.receita, 0);
    const margemMedia = itens.length ? itens.reduce((total, item) => total + item.margem, 0) / itens.length : 0;
    const porCategoria = itens.reduce((mapa, item) => { mapa[item.categoria] = (mapa[item.categoria] || 0) + item.receita; return mapa; }, {});
    const categoriaLider = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    document.getElementById('unidadesProdutosVendidos').textContent = totalUnidades.toLocaleString('pt-BR');
    document.getElementById('receitaProdutosVendidos').textContent = moeda(totalReceita);
    document.getElementById('categoriaLiderProdutos').textContent = escapar(categoriaLider[0]);
    document.getElementById('categoriaLiderPercentual').textContent = `${totalReceita ? Math.round(categoriaLider[1] / totalReceita * 100) : 0}% da receita`;
    document.getElementById('margemProdutosVendidos').textContent = `${Math.round(margemMedia)}%`;
    document.getElementById('resumoProdutosVendidos').textContent = `${itens.length} produtos no ranking · atualizado em ${dados.atualizadoEm}.`;
    renderizarLista(itens);
    renderizarCategorias(porCategoria, totalReceita);
    renderizarTabela(itens);
  }

  function renderizarLista(itens) {
    const maior = Math.max(...itens.map(item => item.quantidade), 1);
    document.getElementById('listaProdutosVendidos').innerHTML = itens.length ? itens.map(item => `<div class="p-4 flex items-center gap-3 sm:gap-4"><div class="w-8 h-8 rounded-lg flex items-center justify-center ${item.posicao <= 3 ? 'bg-accent/15 text-accent' : 'bg-card2 text-muted'} font-bold text-sm">${item.posicao}</div><div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="font-medium truncate">${escapar(item.nome)}</p><p class="text-[10px] text-muted mt-1">${escapar(item.categoria)} · ${moeda(item.preco)} por unidade</p></div><div class="text-right shrink-0"><p class="text-sm font-semibold text-green">${item.quantidade} un.</p><p class="text-[10px] text-muted mt-1">${moeda(item.receita)}</p></div></div><div class="h-1.5 bg-card2 rounded-full overflow-hidden mt-3"><div class="relatorio-barra h-full rounded-full ${item.posicao <= 3 ? 'bg-accent' : 'bg-accent/60'}" style="width:${Math.max(8, Math.round(item.quantidade / maior * 100))}%"></div></div></div></div>`).join('') : '<div class="p-6 text-sm text-muted">Nenhum produto encontrado para o filtro selecionado.</div>';
  }

  function renderizarCategorias(porCategoria, totalReceita) {
    const cores = ['bg-accent', 'bg-blue', 'bg-yellow', 'bg-purple', 'bg-green'];
    document.getElementById('categoriasProdutosVendidos').innerHTML = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([nome, valor], indice) => { const percentual = totalReceita ? Math.round(valor / totalReceita * 100) : 0; return `<div><div class="flex items-center justify-between gap-3 text-xs"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${cores[indice % cores.length]}"></span>${escapar(nome)}</span><span class="text-muted">${percentual}%</span></div><div class="h-2 rounded-full bg-card2 mt-2 overflow-hidden"><div class="relatorio-barra h-full rounded-full ${cores[indice % cores.length]}" style="width:${percentual}%"></div></div><div class="text-[10px] text-muted mt-1">${moeda(valor)}</div></div>`; }).join('') || '<p class="text-sm text-muted">Sem dados de categoria.</p>';
  }

  function renderizarTabela(itens) {
    document.getElementById('tabelaProdutosVendidos').innerHTML = itens.map(item => `<tr class="relatorio-table-row border-b border-border"><td class="p-4"><span class="inline-flex w-7 h-7 items-center justify-center rounded-lg ${item.posicao <= 3 ? 'bg-accent/15 text-accent' : 'bg-card2 text-muted'} font-semibold text-xs">${item.posicao}</span></td><td class="p-4 font-medium">${escapar(item.nome)}</td><td class="p-4 text-muted">${escapar(item.categoria)}</td><td class="p-4">${item.quantidade}</td><td class="p-4 text-green font-semibold">${moeda(item.receita)}</td><td class="p-4"><span class="px-2 py-1 rounded-md bg-blue/10 text-blue text-xs">${item.margem}%</span></td><td class="p-4"><span class="flex items-center gap-1 text-xs ${item.variacao >= 0 ? 'text-green' : 'text-red'}"><i data-lucide="${item.variacao >= 0 ? 'trending-up' : 'trending-down'}" class="w-3.5 h-3.5"></i>${item.variacao >= 0 ? '+' : ''}${item.variacao.toFixed(1).replace('.', ',')}%</span></td></tr>`).join('') || '<tr><td colspan="7" class="p-6 text-center text-sm text-muted">Nenhum produto encontrado.</td></tr>';
    window.lucide?.createIcons();
  }

  categoriaEl?.addEventListener('change', renderizar);
  document.getElementById('periodoProdutosVendidos')?.addEventListener('change', renderizar);
  document.getElementById('exportarProdutosVendidos')?.addEventListener('click', () => exportar(dadosFiltrados()));
  document.addEventListener('apex:relatorios-atualizado', renderizar);
  renderizar();
})();
