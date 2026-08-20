(() => {
  const dados = window.dadosFinanceirosApexFood || { caixaAtual: {}, recebimentos: [], contas: [], relatoriosMensais: [] };
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const texto = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor; };
  const html = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.innerHTML = valor; };
  const percentual = valor => `${Math.max(0, Math.min(100, Number(valor || 0)))}%`;

  function resumo() {
    const caixa = dados.caixaAtual || {};
    const meses = dados.relatoriosMensais || [];
    const contas = dados.contas || [];
    const vendas = meses.reduce((total, item) => total + Number(item.vendas || 0), 0);
    const despesas = meses.reduce((total, item) => total + Number(item.despesas || 0), 0);
    const pagar = contas.filter(conta => conta.tipo === 'pagar');
    const receber = contas.filter(conta => conta.tipo === 'receber');
    const vencidas = pagar.filter(conta => conta.status === 'vencida');
    const proximas = pagar.filter(conta => ['pendente', 'vencida'].includes(conta.status)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return { caixa, meses, contas, vendas, despesas, resultado: vendas - despesas, margem: vendas ? ((vendas - despesas) / vendas) * 100 : 0, pagar, receber, vencidas, proximas };
  }

  function renderizarKpis() {
    const dadosResumo = resumo();
    texto('dashboardFinanceiroResultado', moeda(dadosResumo.resultado));
    texto('dashboardFinanceiroMargem', `${dadosResumo.margem.toFixed(1).replace('.', ',')}% de margem média`);
    texto('dashboardFinanceiroVendasDia', moeda(dadosResumo.caixa.vendas));
    texto('dashboardFinanceiroStatusCaixa', dadosResumo.caixa.id ? (dadosResumo.caixa.status === 'aberto' ? `Aberto desde ${dadosResumo.caixa.aberturaHora || '—'}` : 'Caixa encerrado') : 'Nenhum caixa aberto');
    const pagarPendente = dadosResumo.pagar.filter(conta => conta.status === 'pendente').reduce((total, conta) => total + Number(conta.valor || 0), 0);
    texto('dashboardFinanceiroAProximar', moeda(pagarPendente));
    texto('dashboardFinanceiroAProximarSub', dadosResumo.contas.length ? `${dadosResumo.vencidas.length} conta(s) vencida(s)` : 'Nenhuma conta cadastrada');
    const receberPrevisto = dadosResumo.receber.reduce((total, conta) => total + Number(conta.valor || 0), 0);
    texto('dashboardFinanceiroSaldoProjetado', moeda(Number(dadosResumo.caixa.saldoEsperado || 0) + receberPrevisto - pagarPendente));
    texto('dashboardFinanceiroSaldoSub', `${moeda(receberPrevisto)} em recebimentos previstos`);
  }

  function renderizarGraficoMensal() {
    const dadosResumo = resumo();
    const maximo = Math.max(1, ...dadosResumo.meses.flatMap(item => [Number(item.vendas || 0), Number(item.despesas || 0)]));
    texto('dashboardFinanceiroPeriodo', dadosResumo.meses.length ? `${dadosResumo.meses[0].mes} — ${dadosResumo.meses[dadosResumo.meses.length - 1].mes}` : 'Período disponível');
    html('dashboardFinanceiroGraficoMensal', dadosResumo.meses.length ? dadosResumo.meses.map(item => `<div class="flex-1 h-full min-w-0 flex flex-col justify-end items-center gap-1 group" title="${escapar(item.mes)}: ${moeda(item.vendas)} em vendas e ${moeda(item.despesas)} em despesas"><div class="w-full flex items-end justify-center gap-1 h-full"><span class="w-2 sm:w-4 rounded-t bg-green transition-all group-hover:opacity-80" style="height:${Math.max(5, (Number(item.vendas || 0) / maximo) * 100)}%"></span><span class="w-2 sm:w-4 rounded-t bg-red transition-all group-hover:opacity-80" style="height:${Math.max(5, (Number(item.despesas || 0) / maximo) * 100)}%"></span></div><span class="text-[10px] text-muted">${escapar(item.mes)}</span></div>`).join('') : '<div class="w-full h-full flex items-center justify-center text-xs text-muted">Nenhum relatório encontrado</div>');
  }

  function renderizarCaixa() {
    const caixa = dados.caixaAtual || {};
    const badge = document.getElementById('dashboardFinanceiroBadgeCaixa');
    if (badge) { badge.textContent = caixa.id ? (caixa.status === 'aberto' ? 'Aberto' : 'Encerrado') : 'Sem caixa'; badge.className = `px-2 py-1 rounded-full text-[10px] ${caixa.id && caixa.status === 'aberto' ? 'bg-green/10 text-green border border-green/20' : 'bg-muted/10 text-muted border border-border2'}`; }
    texto('dashboardFinanceiroOperador', caixa.id ? (caixa.operador || 'Operador não informado') : 'Nenhum caixa aberto');
    texto('dashboardFinanceiroAbertura', caixa.id ? `Abertura em ${caixa.data || '—'} às ${caixa.aberturaHora || '—'}` : 'Sem movimentação de caixa');
    const linhas = [
      { label: 'Abertura', valor: caixa.abertura },
      { label: 'Vendas', valor: caixa.vendas },
      { label: 'Suprimentos', valor: -Number(caixa.suprimentos || 0) },
      { label: 'Saldo esperado', valor: caixa.saldoEsperado }
    ];
    html('dashboardFinanceiroResumoCaixa', linhas.map(linha => `<div class="flex items-center justify-between gap-3 text-xs"><span class="text-muted">${linha.label}</span><strong class="${linha.valor < 0 ? 'text-red' : 'text-white'}">${linha.valor < 0 ? '−' : ''}${moeda(Math.abs(linha.valor || 0))}</strong></div>`).join(''));
  }

  function renderizarRecebimentos() {
    const recebimentos = dados.recebimentos || [];
    const total = Math.max(1, recebimentos.reduce((soma, item) => soma + Number(item.valor || 0), 0));
    html('dashboardFinanceiroRecebimentos', recebimentos.length ? recebimentos.map(item => `<div><div class="flex items-center justify-between gap-3 text-xs mb-1"><span class="flex items-center gap-2"><i data-lucide="${escapar(item.icone || 'circle-dollar-sign')}" class="w-3.5 h-3.5 ${escapar(item.cor || 'text-muted')}"></i>${escapar(item.meio)}</span><strong>${moeda(item.valor)}</strong></div><div class="h-1.5 rounded-full bg-card2 overflow-hidden"><span class="block h-full rounded-full bg-accent" style="width:${percentual((Number(item.valor || 0) / total) * 100)}"></span></div><div class="text-[10px] text-muted mt-1">${item.transacoes || 0} transações</div></div>`).join('') : '<div class="text-xs text-muted">Nenhum recebimento encontrado.</div>');
  }

  function renderizarCompromissos() {
    const dadosResumo = resumo();
    const itens = [...dadosResumo.proximas.slice(0, 3), ...dadosResumo.receber.slice(0, 2)].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    html('dashboardFinanceiroCompromissos', itens.length ? itens.map(item => { const pagar = item.tipo === 'pagar'; const vencida = item.status === 'vencida'; return `<div class="flex items-center justify-between gap-3 rounded-lg bg-card2 border border-border2 p-3"><div class="flex items-center gap-2 min-w-0"><div class="w-8 h-8 rounded-lg ${pagar ? 'bg-yellow/10' : 'bg-green/10'} flex items-center justify-center shrink-0"><i data-lucide="${pagar ? 'arrow-up-right' : 'arrow-down-left'}" class="w-4 h-4 ${pagar ? 'text-yellow' : 'text-green'}"></i></div><div class="min-w-0"><strong class="block text-xs truncate">${escapar(item.descricao)}</strong><span class="text-[10px] ${vencida ? 'text-red' : 'text-muted'}">${vencida ? 'Vencida' : `${pagar ? 'Pagar' : 'Receber'} em ${escapar(item.vencimento)}`}</span></div></div><strong class="text-xs shrink-0 ${pagar ? 'text-yellow' : 'text-green'}">${moeda(item.valor)}</strong></div>`; }).join('') : '<div class="text-xs text-muted">Nenhum compromisso encontrado.</div>');
  }

  renderizarKpis();
  renderizarGraficoMensal();
  renderizarCaixa();
  renderizarRecebimentos();
  renderizarCompromissos();
  window.lucide?.createIcons();
  document.addEventListener('apex:financeiro-atualizado', () => { renderizarKpis(); renderizarGraficoMensal(); renderizarCaixa(); renderizarRecebimentos(); renderizarCompromissos(); window.lucide?.createIcons(); });
  document.addEventListener('apex:financeiro-indisponivel', () => { renderizarKpis(); renderizarGraficoMensal(); renderizarCaixa(); renderizarRecebimentos(); renderizarCompromissos(); window.lucide?.createIcons(); });
})();
