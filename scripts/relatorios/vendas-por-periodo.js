(() => {
  const dados = window.dadosRelatoriosApexFood;
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const periodoEl = document.getElementById('periodoVendasOperacionais');
  const canalEl = document.getElementById('canalVendasOperacionais');

  function configuracaoAtual() {
    const tipo = periodoEl?.value || 'diario';
    const mapa = { diario: dados.vendasDiarias, semanal: dados.vendasSemanais, mensal: dados.vendasMensais };
    const canalId = canalEl?.value || 'todos';
    const canal = dados.canais.find(item => item.id === canalId);
    const fator = canal ? canal.percentual / 100 : 1;
    const registros = (mapa[tipo] || dados.vendasDiarias).map(item => ({ ...item, vendas: item.vendas * fator, pedidos: Math.round(item.pedidos * fator), ticketMedio: item.ticketMedio }));
    return { tipo, canal, registros };
  }

  function renderizar() {
    const { tipo, canal, registros } = configuracaoAtual();
    const totalVendas = registros.reduce((total, item) => total + item.vendas, 0);
    const totalPedidos = registros.reduce((total, item) => total + item.pedidos, 0);
    const ticket = totalVendas / Math.max(totalPedidos, 1);
    const melhor = registros.reduce((atual, item) => item.vendas > atual.vendas ? item : atual, registros[0] || { vendas: 0, label: '—' });
    const variacao = tipo === 'diario' ? 8.6 : tipo === 'semanal' ? 5.2 : 11.8;
    document.getElementById('vendasPeriodoTotal').textContent = moeda(totalVendas);
    document.getElementById('pedidosPeriodoTotal').textContent = totalPedidos.toLocaleString('pt-BR');
    document.getElementById('ticketPeriodoTotal').textContent = moeda(ticket);
    document.getElementById('melhorDiaPeriodo').textContent = escapar(melhor.label || melhor.periodo || '—');
    document.getElementById('melhorDiaValor').textContent = `${moeda(melhor.vendas)} em vendas`;
    document.getElementById('vendasPeriodoVariacao').textContent = `+${variacao.toFixed(1).replace('.', ',')}% versus anterior`;
    document.getElementById('legendaVendasOperacionais').textContent = `${canal ? `Receita do canal ${canal.nome}` : 'Receita total'} por ${tipo === 'diario' ? 'dia' : tipo === 'semanal' ? 'semana' : 'mês'}.`;
    renderizarGrafico(registros);
    renderizarTabela(registros, variacao);
    renderizarCanais(totalVendas);
  }

  function renderizarGrafico(registros) {
    const maior = Math.max(...registros.map(item => item.vendas), 1);
    document.getElementById('graficoVendasOperacionais').innerHTML = registros.map(item => {
      const altura = Math.max(8, Math.round((item.vendas / maior) * 100));
      const label = item.label || item.periodo;
      return `<div class="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-8 group"><div class="relative w-full flex justify-center items-end h-full"><div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition text-[10px] text-white bg-card2 border border-border2 rounded px-1.5 py-1 whitespace-nowrap">${moeda(item.vendas)}</div><div title="${escapar(label)} — ${moeda(item.vendas)}" class="relatorio-chart-bar w-5 sm:w-8 rounded-t bg-accent/80 group-hover:bg-accent" style="height:${altura}%"></div></div><span class="text-[10px] text-muted whitespace-nowrap">${escapar(label)}</span></div>`;
    }).join('');
  }

  function renderizarTabela(registros, variacao) {
    document.getElementById('resumoTabelaVendasOperacionais').textContent = `${registros.length} períodos analisados · variação média de +${variacao.toFixed(1).replace('.', ',')}%.`;
    document.getElementById('tabelaVendasOperacionais').innerHTML = registros.map((item, indice) => {
      const anterior = registros[indice - 1];
      const comparativo = anterior ? ((item.vendas - anterior.vendas) / Math.max(anterior.vendas, 1)) * 100 : variacao;
      const label = item.label || item.periodo;
      return `<tr class="relatorio-table-row border-b border-border"><td class="p-4 font-medium">${escapar(label)}</td><td class="p-4">${item.pedidos.toLocaleString('pt-BR')}</td><td class="p-4 text-green font-semibold">${moeda(item.vendas)}</td><td class="p-4 text-blue">${moeda(item.ticketMedio)}</td><td class="p-4"><span class="flex items-center gap-1 text-xs ${comparativo >= 0 ? 'text-green' : 'text-red'}"><i data-lucide="${comparativo >= 0 ? 'trending-up' : 'trending-down'}" class="w-3.5 h-3.5"></i>${comparativo >= 0 ? '+' : ''}${comparativo.toFixed(1).replace('.', ',')}%</span></td></tr>`;
    }).join('');
    window.lucide?.createIcons();
  }

  function renderizarCanais(totalVendas) {
    const container = document.getElementById('canaisVendasOperacionais');
    container.innerHTML = dados.canais.map(item => `<div><div class="flex items-center justify-between gap-3 text-xs"><span class="flex items-center gap-2"><i data-lucide="${item.icone}" class="w-3.5 h-3.5 text-muted"></i>${escapar(item.nome)}</span><span class="text-muted">${item.percentual}%</span></div><div class="h-2 rounded-full bg-card2 mt-2 overflow-hidden"><div class="relatorio-barra h-full ${item.cor} rounded-full" style="width:${item.percentual}%"></div></div><div class="text-[10px] text-muted mt-1">${moeda(totalVendas * item.percentual / 100)}</div></div>`).join('');
    window.lucide?.createIcons();
  }

  periodoEl?.addEventListener('change', renderizar);
  canalEl?.addEventListener('change', renderizar);
  document.getElementById('exportarVendasOperacionais')?.addEventListener('click', () => aviso('Exportação de vendas preparada para integração.'));
  document.getElementById('imprimirVendasOperacionais')?.addEventListener('click', () => aviso('Impressão do detalhamento preparada para integração.'));
  renderizar();
})();
