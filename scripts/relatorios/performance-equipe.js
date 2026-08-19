(() => {
  const dados = window.dadosRelatoriosApexFood;
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const statusEl = document.getElementById('statusPerformanceEquipe');

  function obterEquipe() {
    const status = statusEl?.value || 'ativos';
    return dados.performanceEquipe.filter(item => status === 'todos' || item.status === 'ativo');
  }

  function renderizar() {
    const equipe = obterEquipe();
    const vendas = equipe.reduce((total, item) => total + item.vendas, 0);
    const pedidos = equipe.reduce((total, item) => total + item.pedidos, 0);
    const avaliacao = equipe.length ? equipe.reduce((total, item) => total + item.avaliacao, 0) / equipe.length : 0;
    const comissoes = equipe.reduce((total, item) => total + item.comissao, 0);
    document.getElementById('vendasPerformanceEquipe').textContent = moeda(vendas);
    document.getElementById('pedidosPerformanceEquipe').textContent = pedidos.toLocaleString('pt-BR');
    document.getElementById('avaliacaoPerformanceEquipe').textContent = avaliacao.toFixed(1).replace('.', ',');
    document.getElementById('comissoesPerformanceEquipe').textContent = moeda(comissoes);
    document.getElementById('resumoPerformanceEquipe').textContent = `${equipe.length} profissionais avaliados · ranking por vendas no período.`;
    renderizarLista(equipe);
    renderizarDestaques(equipe);
    renderizarTabela(equipe);
    window.lucide?.createIcons();
  }

  function renderizarLista(equipe) {
    const maiorVenda = Math.max(...equipe.map(item => item.vendas), 1);
    document.getElementById('listaPerformanceEquipe').innerHTML = equipe.length ? equipe.map(item => `<div class="p-4 sm:p-5 flex items-center gap-3 sm:gap-4"><div class="w-8 h-8 rounded-lg flex items-center justify-center ${item.posicao === 1 ? 'bg-yellow/15 text-yellow' : item.posicao === 2 ? 'bg-slate-300/10 text-slate-300' : item.posicao === 3 ? 'bg-orange-700/15 text-orange-400' : 'bg-card2 text-muted'} font-bold text-sm">${item.posicao}</div><div class="w-9 h-9 rounded-full bg-gradient-to-br ${escapar(item.cor || 'from-accent to-orange-400')} flex items-center justify-center text-xs font-bold text-white shrink-0">${escapar(item.iniciais)}</div><div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-3"><div><p class="font-medium truncate">${escapar(item.nome)}</p><p class="text-[10px] text-muted mt-1">${escapar(item.cargo)} · ${escapar(item.turno)}</p></div><div class="text-right shrink-0"><p class="text-sm font-semibold text-green">${moeda(item.vendas)}</p><p class="text-[10px] text-muted mt-1">${item.pedidos} pedidos</p></div></div><div class="flex items-center gap-3 mt-3"><div class="flex-1 h-1.5 bg-card2 rounded-full overflow-hidden"><div class="relatorio-barra h-full rounded-full ${item.posicao === 1 ? 'bg-accent' : 'bg-accent/60'}" style="width:${Math.max(8, Math.round(item.vendas / maiorVenda * 100))}%"></div></div><span class="flex items-center gap-1 text-[10px] text-yellow"><i data-lucide="star" class="w-3 h-3 relatorio-star"></i>${item.avaliacao.toFixed(1)}</span></div></div></div>`).join('') : '<div class="p-6 text-sm text-muted">Nenhum funcionário encontrado para o filtro selecionado.</div>';
  }

  function renderizarDestaques(equipe) {
    const maiorVenda = equipe[0];
    const maiorAvaliacao = [...equipe].sort((a, b) => b.avaliacao - a.avaliacao)[0];
    const maiorVariacao = [...equipe].sort((a, b) => b.variacao - a.variacao)[0];
    document.getElementById('destaquesPerformanceEquipe').innerHTML = equipe.length ? [`<div class="p-3 rounded-lg bg-accent/10 border border-accent/20"><div class="flex items-center gap-2 text-accent"><i data-lucide="trophy" class="w-4 h-4"></i><span class="text-xs font-semibold">Maior volume de vendas</span></div><p class="text-sm font-medium mt-2">${escapar(maiorVenda.nome)}</p><p class="text-[10px] text-muted mt-1">${moeda(maiorVenda.vendas)} em vendas no período.</p></div>`, `<div class="p-3 rounded-lg bg-yellow/10 border border-yellow/20"><div class="flex items-center gap-2 text-yellow"><i data-lucide="star" class="w-4 h-4 relatorio-star"></i><span class="text-xs font-semibold">Melhor avaliação</span></div><p class="text-sm font-medium mt-2">${escapar(maiorAvaliacao.nome)}</p><p class="text-[10px] text-muted mt-1">Nota ${maiorAvaliacao.avaliacao.toFixed(1).replace('.', ',')} dos clientes.</p></div>`, `<div class="p-3 rounded-lg bg-green/10 border border-green/20"><div class="flex items-center gap-2 text-green"><i data-lucide="trending-up" class="w-4 h-4"></i><span class="text-xs font-semibold">Maior evolução</span></div><p class="text-sm font-medium mt-2">${escapar(maiorVariacao.nome)}</p><p class="text-[10px] text-muted mt-1">${maiorVariacao.variacao >= 0 ? '+' : ''}${maiorVariacao.variacao.toFixed(1).replace('.', ',')}% versus período anterior.</p></div>`].join('') : '<p class="text-sm text-muted">Sem destaques disponíveis.</p>';
  }

  function renderizarTabela(equipe) {
    document.getElementById('tabelaPerformanceEquipe').innerHTML = equipe.map(item => `<tr class="relatorio-table-row border-b border-border"><td class="p-4"><span class="inline-flex w-7 h-7 items-center justify-center rounded-lg ${item.posicao <= 3 ? 'bg-accent/15 text-accent' : 'bg-card2 text-muted'} font-semibold text-xs">${item.posicao}</span></td><td class="p-4"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-gradient-to-br ${escapar(item.cor || 'from-accent to-orange-400')} flex items-center justify-center text-[10px] font-bold text-white">${escapar(item.iniciais)}</div><div><p class="font-medium">${escapar(item.nome)}</p><p class="text-[10px] text-muted">${escapar(item.cargo)}</p></div></div></td><td class="p-4 text-muted">${escapar(item.turno)}</td><td class="p-4">${item.pedidos}</td><td class="p-4 text-green font-semibold">${moeda(item.vendas)}</td><td class="p-4"><span class="flex items-center gap-1 text-yellow"><i data-lucide="star" class="w-3.5 h-3.5 relatorio-star"></i>${item.avaliacao.toFixed(1)}</span></td><td class="p-4 text-purple">${moeda(item.comissao)} <span class="text-[10px] text-muted">(${item.percentualComissao}%)</span></td><td class="p-4"><span class="flex items-center gap-1 text-xs ${item.variacao >= 0 ? 'text-green' : 'text-red'}"><i data-lucide="${item.variacao >= 0 ? 'trending-up' : 'trending-down'}" class="w-3.5 h-3.5"></i>${item.variacao >= 0 ? '+' : ''}${item.variacao.toFixed(1).replace('.', ',')}%</span></td></tr>`).join('') || '<tr><td colspan="8" class="p-6 text-center text-sm text-muted">Nenhum funcionário encontrado.</td></tr>';
  }

  statusEl?.addEventListener('change', renderizar);
  document.getElementById('periodoPerformanceEquipe')?.addEventListener('change', () => aviso('Período da performance atualizado no preview.'));
  document.getElementById('exportarPerformanceEquipe')?.addEventListener('click', () => aviso('Exportação da performance preparada para integração.'));
  renderizar();
})();
