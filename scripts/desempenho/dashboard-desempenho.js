(() => {
  const equipe = window.dadosEquipeApexFood || { funcionarios: [], escalas: [], comissoes: [] };
  const pedidos = window.dadosPedidosApexFood || { pedidosAtivos: [] };
  const relatorios = window.dadosRelatoriosApexFood || { performanceEquipe: [], distribuicaoNotas: [], indicadores: {} };
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const texto = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor; };
  const html = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.innerHTML = valor; };
  const percentual = valor => `${Math.max(0, Math.min(100, Number(valor || 0)))}%`;

  function resumo() {
    const funcionarios = equipe.funcionarios || [];
    const atendentes = funcionarios.filter(item => ['Garçom', 'Garçonete', 'Bartender'].includes(item.cargo));
    const ativos = funcionarios.filter(item => item.status === 'ativo');
    const ranking = (relatorios.performanceEquipe?.length ? relatorios.performanceEquipe : atendentes.map(item => ({ ...item, nome: item.nome, vendas: item.vendasMes || 0, pedidos: item.pedidos || 0, avaliacao: item.avaliacao || 0 }))).sort((a, b) => Number(b.vendas || 0) - Number(a.vendas || 0));
    const vendas = ranking.reduce((total, item) => total + Number(item.vendas || 0), 0);
    const pedidosAtendidos = ranking.reduce((total, item) => total + Number(item.pedidos || 0), 0);
    const avaliacao = ranking.length ? ranking.reduce((total, item) => total + Number(item.avaliacao || 0), 0) / ranking.length : 0;
    const escalas = (equipe.escalas || []).filter(item => ['Hoje', 'Amanhã'].includes(item.dia)).slice(0, 5);
    return { funcionarios, atendentes, ativos, ranking, vendas, pedidosAtendidos, avaliacao, escalas };
  }

  function renderizarKpis() {
    const dados = resumo();
    texto('dashboardDesempenhoEquipeAtiva', dados.ativos.length);
    texto('dashboardDesempenhoEquipeSub', `${dados.funcionarios.length} colaboradores cadastrados`);
    texto('dashboardDesempenhoVendas', moeda(dados.vendas));
    texto('dashboardDesempenhoVendasSub', `${dados.ranking[0]?.nome || 'Sem líder'} lidera o período`);
    texto('dashboardDesempenhoPedidos', dados.pedidosAtendidos);
    texto('dashboardDesempenhoPedidosSub', `${dados.ranking.length} profissionais com produção`);
    texto('dashboardDesempenhoAvaliacao', `${dados.avaliacao.toFixed(1).replace('.', ',')} / 5`);
    texto('dashboardDesempenhoAvaliacaoSub', `${relatorios.indicadores?.totalAvaliacoes || 0} avaliações na base`);
  }

  function renderizarRanking() {
    const dados = resumo();
    const ranking = dados.ranking.slice(0, 6);
    const maior = Math.max(1, ...ranking.map(item => Number(item.vendas || 0)));
    html('dashboardDesempenhoRanking', ranking.length ? ranking.map((item, indice) => `<div><div class="flex items-center justify-between gap-3 text-xs mb-1"><span class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 rounded-full bg-purple/10 text-purple flex items-center justify-center text-[10px] font-semibold shrink-0">${indice + 1}</span><span class="truncate"><strong>${escapar(item.nome)}</strong><small class="block text-[10px] text-muted mt-0.5">${escapar(item.cargo || 'Atendimento')} · ${item.pedidos || 0} pedidos</small></span></span><strong class="text-purple shrink-0">${moeda(item.vendas)}</strong></div><div class="h-2 rounded-full bg-card2 overflow-hidden"><span class="block h-full rounded-full bg-gradient-to-r from-purple-700 to-purple-300" style="width:${percentual((Number(item.vendas || 0) / maior) * 100)}"></span></div><div class="flex items-center justify-between text-[10px] text-muted mt-1"><span>Variação ${Number(item.variacao || 0) >= 0 ? '+' : ''}${Number(item.variacao || 0).toFixed(1).replace('.', ',')}%</span><span>${Number(item.avaliacao || 0).toFixed(1).replace('.', ',')} de avaliação</span></div></div>`).join('') : '<p class="text-xs text-muted">Nenhum dado de performance disponível.</p>');
  }

  function renderizarOperacao() {
    const ativos = pedidos.pedidosAtivos || [];
    const tempos = ativos.map(item => Number.parseInt(item.tempo, 10)).filter(Number.isFinite);
    const tempoMedio = tempos.length ? Math.round(tempos.reduce((soma, item) => soma + item, 0) / tempos.length) : 0;
    const status = [
      { chave: 'novo', label: 'Novos', cor: 'bg-accent' },
      { chave: 'preparo', label: 'Em preparo', cor: 'bg-yellow' },
      { chave: 'pronto', label: 'Prontos', cor: 'bg-green' }
    ];
    const maior = Math.max(1, ...status.map(item => ativos.filter(pedido => pedido.status === item.chave).length));
    const linhas = [
      { label: 'Pedidos em atendimento', valor: ativos.length, cor: 'text-accent' },
      { label: 'Tempo médio atual', valor: `${tempoMedio} min`, cor: tempoMedio > 20 ? 'text-red' : 'text-green' },
      ...status.map(item => ({ label: item.label, valor: ativos.filter(pedido => pedido.status === item.chave), cor: item.cor, barra: true, total: maior }))
    ];
    html('dashboardDesempenhoOperacao', linhas.map(item => { const valor = Array.isArray(item.valor) ? item.valor.length : item.valor; return `<div><div class="flex items-center justify-between gap-3 text-xs"><span class="text-muted">${item.label}</span><strong class="${item.barra ? 'text-white' : item.cor}">${valor}</strong></div>${item.barra ? `<div class="h-1.5 rounded-full bg-card2 mt-1.5 overflow-hidden"><span class="block h-full rounded-full ${item.cor}" style="width:${percentual((valor / item.total) * 100)}"></span></div>` : ''}</div>`; }).join(''));
  }

  function renderizarSetores() {
    const dados = resumo();
    const porSetor = [...new Set(dados.funcionarios.map(item => item.setor))].map(setor => ({ setor, total: dados.funcionarios.filter(item => item.setor === setor).length, ativos: dados.funcionarios.filter(item => item.setor === setor && item.status === 'ativo').length }));
    const maior = Math.max(1, ...porSetor.map(item => item.total));
    html('dashboardDesempenhoSetores', porSetor.map(item => `<div><div class="flex items-center justify-between text-xs mb-1"><span>${escapar(item.setor)}</span><span class="text-muted">${item.ativos}/${item.total} ativos</span></div><div class="h-2 rounded-full bg-card2 overflow-hidden"><span class="block h-full rounded-full bg-purple" style="width:${percentual((item.total / maior) * 100)}"></span></div></div>`).join(''));
  }

  function renderizarEscalas() {
    const dados = resumo();
    const nomes = new Map((equipe.funcionarios || []).map(item => [item.id, item.nome]));
    html('dashboardDesempenhoEscalas', dados.escalas.length ? dados.escalas.map(item => `<div class="flex items-center justify-between gap-3 rounded-lg bg-card2 border border-border2 p-3"><div class="flex items-center gap-2 min-w-0"><div class="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center shrink-0"><i data-lucide="calendar-clock" class="w-4 h-4 text-purple"></i></div><div class="min-w-0"><strong class="block text-xs truncate">${escapar(nomes.get(item.funcionarioId) || 'Colaborador')}</strong><span class="text-[10px] text-muted">${escapar(item.dia)} · ${escapar(item.turno)}</span></div></div><span class="text-[10px] text-muted shrink-0">${escapar(item.entrada)}–${escapar(item.saida)}</span></div>`).join('') : '<p class="text-xs text-muted">Nenhuma escala próxima disponível.</p>');
  }

  renderizarKpis();
  renderizarRanking();
  renderizarOperacao();
  renderizarSetores();
  renderizarEscalas();
  window.lucide?.createIcons();
})();
