(() => {
  const dados = window.dadosRelatoriosApexFood;
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const csv = valor => `"${String(valor ?? '').replace(/"/g, '""')}"`;

  function exportar(registros) {
    if (!registros.length) return aviso('Nenhum registro encontrado para exportar.');
    const linhas = [['Período', 'Pedidos', 'Vendas', 'Ticket médio'], ...registros.map(item => [item.label || item.periodo, item.pedidos, item.vendas.toFixed(2), item.ticketMedio.toFixed(2)])];
    const blob = new Blob([linhas.map(linha => linha.map(csv).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vendas-por-periodo.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const imprimir = () => window.print();
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

  function tamanhoJanela(tipo) {
    return { diario: 7, semanal: 5, mensal: 6 }[tipo] || 7;
  }

  function variacaoEntre(atual, anterior) {
    const base = Number(anterior || 0);
    if (base <= 0) return null;
    return ((Number(atual || 0) - base) / base) * 100;
  }

  function calcularVariacao(registros, tipo) {
    const tamanho = tamanhoJanela(tipo);
    const atuais = registros.slice(-tamanho);
    const anteriores = registros.slice(-tamanho * 2, -tamanho);
    if (!atuais.length || !anteriores.length) return null;
    const totalAtual = atuais.reduce((total, item) => total + Number(item.vendas || 0), 0);
    const totalAnterior = anteriores.reduce((total, item) => total + Number(item.vendas || 0), 0);
    return variacaoEntre(totalAtual, totalAnterior);
  }

  function percentual(valor) {
    return valor === null || !Number.isFinite(valor) ? '—' : `${valor >= 0 ? '+' : ''}${valor.toFixed(1).replace('.', ',')}%`;
  }

  function textoVariacao(valor) {
    return valor === null ? 'Sem comparação com período anterior' : `${percentual(valor)} versus anterior`;
  }

  function renderizar() {
    const { tipo, canal, registros } = configuracaoAtual();
    const totalVendas = registros.reduce((total, item) => total + item.vendas, 0);
    const totalPedidos = registros.reduce((total, item) => total + item.pedidos, 0);
    const ticket = totalVendas / Math.max(totalPedidos, 1);
    const melhor = registros.reduce((atual, item) => item.vendas > atual.vendas ? item : atual, registros[0] || { vendas: 0, label: '—' });
    const variacao = calcularVariacao(registros, tipo);
    const variacaoEl = document.getElementById('vendasPeriodoVariacao');
    document.getElementById('vendasPeriodoTotal').textContent = moeda(totalVendas);
    document.getElementById('pedidosPeriodoTotal').textContent = totalPedidos.toLocaleString('pt-BR');
    document.getElementById('ticketPeriodoTotal').textContent = moeda(ticket);
    document.getElementById('melhorDiaPeriodo').textContent = escapar(melhor.label || melhor.periodo || '—');
    document.getElementById('melhorDiaValor').textContent = `${moeda(melhor.vendas)} em vendas`;
    variacaoEl.textContent = textoVariacao(variacao);
    variacaoEl.classList.remove('text-green', 'text-red', 'text-muted');
    variacaoEl.classList.add(variacao === null ? 'text-muted' : variacao >= 0 ? 'text-green' : 'text-red');
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

  function renderizarComparativo(valor) {
    if (valor === null || !Number.isFinite(valor)) return '<span class="text-xs text-muted">—</span>';
    const positivo = valor >= 0;
    return `<span class="flex items-center gap-1 text-xs ${positivo ? 'text-green' : 'text-red'}"><i data-lucide="${positivo ? 'trending-up' : 'trending-down'}" class="w-3.5 h-3.5"></i>${percentual(valor)}</span>`;
  }

  function renderizarTabela(registros, variacao) {
    const resumo = variacao === null ? 'comparação indisponível.' : `variação média de ${percentual(variacao)}.`;
    document.getElementById('resumoTabelaVendasOperacionais').textContent = `${registros.length} períodos analisados · ${resumo}`;
    document.getElementById('tabelaVendasOperacionais').innerHTML = registros.map((item, indice) => {
      const anterior = registros[indice - 1];
      const comparativo = anterior ? variacaoEntre(item.vendas, anterior.vendas) : variacao;
      const label = item.label || item.periodo;
      return `<tr class="relatorio-table-row border-b border-border"><td class="p-4 font-medium">${escapar(label)}</td><td class="p-4">${item.pedidos.toLocaleString('pt-BR')}</td><td class="p-4 text-green font-semibold">${moeda(item.vendas)}</td><td class="p-4 text-blue">${moeda(item.ticketMedio)}</td><td class="p-4">${renderizarComparativo(comparativo)}</td></tr>`;
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
  document.getElementById('exportarVendasOperacionais')?.addEventListener('click', () => exportar(configuracaoAtual().registros));
  document.getElementById('imprimirVendasOperacionais')?.addEventListener('click', imprimir);
  document.addEventListener('apex:relatorios-atualizado', renderizar);
  renderizar();
})();
