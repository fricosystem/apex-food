(() => {
  const visao = window.dadosVisaoGeralApexFood || {};
  const pedidos = visao.operacao || { pedidosAtivos: [], pedidosHistorico: [] };
  const financeiro = visao.financeiro || { caixaAtual: {}, contas: [], relatoriosMensais: [], categorias: [] };
  const mesas = visao.salao?.mesas || [];
  const reservas = visao.salao?.reservas || [];
  const equipe = visao.equipe || { funcionarios: [] };
  const cardapio = visao.cardapio || { produtos: [], categorias: [] };
  const relatorios = visao.relatorios || { vendasDiarias: [], vendasSemanais: [], vendasMensais: [], canais: [], produtosMaisVendidos: [], mapaCalor: [], faixasHorarias: [], diasSemana: [], avaliacoes: [], distribuicaoNotas: [], indicadores: {} };
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const definirTexto = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor; };
  const definirHTML = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.innerHTML = valor; };
  const navegar = rota => { if (window.apexShell?.navegar) window.apexShell.navegar(rota); else window.location.hash = `#/${rota}`; };
  const percent = valor => `${Math.max(0, Math.min(100, Number(valor || 0)))}%`;
  const DATA_ATUAL = new Date().toISOString().slice(0, 10);
  const TIPOS_PERIODO = { dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano', personalizado: 'Personalizado' };
  let estadoPeriodo = { tipo: 'dia', inicio: DATA_ATUAL, fim: DATA_ATUAL };

  function dataBRParaISO(valor) {
    if (!valor || !/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return null;
    const [dia, mes, ano] = valor.split('/').map(Number);
    return `${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
  }

  function isoParaData(valor) {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const [ano, mes, dia] = valor.split('-').map(Number);
    return Date.UTC(ano, mes - 1, dia);
  }

  function dataParaBR(valor) {
    const timestamp = isoParaData(valor);
    if (timestamp === null) return '—';
    const data = new Date(timestamp);
    return `${String(data.getUTCDate()).padStart(2, '0')}/${String(data.getUTCMonth() + 1).padStart(2, '0')}/${data.getUTCFullYear()}`;
  }

  function dataDentroDoIntervalo(dataISO, inicio, fim) {
    const valor = isoParaData(dataISO);
    const inicioValor = isoParaData(inicio);
    const fimValor = isoParaData(fim);
    return valor !== null && inicioValor !== null && fimValor !== null && valor >= inicioValor && valor <= fimValor;
  }

  function obterDadosPeriodo() {
    const remoto = visao.periodo || {};
    const diarios = relatorios.vendasDiarias || [];
    const semanais = relatorios.vendasSemanais || [];
    const mensais = relatorios.vendasMensais || [];
    const tipo = remoto.tipo || estadoPeriodo.tipo;
    const inicio = remoto.inicio || estadoPeriodo.inicio;
    const fim = remoto.fim || estadoPeriodo.fim;
    let serie = [];
    if (tipo === 'dia') serie = diarios.map(item => ({ ...item, label: item.label || item.data }));
    if (tipo === 'semana') serie = semanais.map(item => ({ ...item, label: item.periodo }));
    if (tipo === 'mes' || tipo === 'ano') serie = mensais.map(item => ({ ...item, label: item.periodo || item.mes }));
    if (tipo === 'personalizado') serie = diarios.map(item => ({ ...item, label: item.label || item.data }));
    const indicadorVendas = Number(visao.indicadores?.vendasCentavos || 0) / 100;
    const indicadorPedidos = Number(visao.indicadores?.pedidos || 0);
    const vendasSerie = serie.reduce((total, item) => total + Number(item.vendas || 0), 0);
    const pedidosSerie = serie.reduce((total, item) => total + Number(item.pedidos || 0), 0);
    const vendas = indicadorVendas || vendasSerie;
    const pedidosPeriodo = indicadorPedidos || pedidosSerie;
    const ticketMedio = pedidosPeriodo ? vendas / pedidosPeriodo : 0;
    const status = remoto.status || `${TIPOS_PERIODO[tipo] || 'Período'} · ${dataParaBR(inicio)}${inicio !== fim ? ` a ${dataParaBR(fim)}` : ''}`;
    const disponivel = Boolean(visao.meta?.dadosDisponiveis && (vendas || pedidosPeriodo || serie.length));
    return { tipo, nome: TIPOS_PERIODO[tipo] || 'Período', inicio, fim, serie, vendas, pedidos: pedidosPeriodo, ticketMedio, status, disponivel };
  }

  function obterResumo() {
    const caixa = financeiro.caixaAtual || {};
    const periodo = obterDadosPeriodo();
    const ocupadas = mesas.filter(mesa => mesa.status === 'ocupada').length;
    const disponiveis = mesas.filter(mesa => mesa.status === 'disponivel').length;
    const bloqueadas = mesas.filter(mesa => mesa.status === 'indisponivel').length;
    const ocupacao = Math.round((ocupadas / Math.max(mesas.length, 1)) * 100);
    const liderProduto = relatorios.produtosMaisVendidos?.[0] || {};
    const liderEquipe = relatorios.performanceEquipe?.[0] || {};
    const ativosEquipe = equipe.funcionarios.filter(funcionario => funcionario.status === 'ativo').length;
    const pedidosNovos = pedidos.pedidosAtivos.filter(pedido => pedido.status === 'novo').length;
    const pedidosPreparo = pedidos.pedidosAtivos.filter(pedido => pedido.status === 'preparo').length;
    const estoqueCritico = cardapio.produtos.filter(produto => !produto.disponibilidade || Number(produto.estoque || 0) <= 8).length;
    const reservasPendentes = reservas.filter(reserva => ['aguardando', 'confirmada'].includes(reserva.status) && dataDentroDoIntervalo(dataBRParaISO(reserva.data), periodo.inicio, periodo.fim)).length;
    return { caixa, periodo, ocupadas, disponiveis, bloqueadas, ocupacao, liderProduto, liderEquipe, ativosEquipe, pedidosNovos, pedidosPreparo, estoqueCritico, reservasPendentes };
  }

  function renderizarFiltro() {
    const periodo = obterDadosPeriodo();
    document.querySelectorAll('[data-home-periodo]').forEach(botao => {
      const ativo = botao.dataset.homePeriodo === estadoPeriodo.tipo;
      botao.classList.toggle('ativo', ativo);
      botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    const personalizado = document.getElementById('homePeriodoPersonalizado');
    if (personalizado) personalizado.classList.toggle('hidden', estadoPeriodo.tipo !== 'personalizado');
    const inicio = document.getElementById('homeDataInicio');
    const fim = document.getElementById('homeDataFim');
    if (inicio && estadoPeriodo.tipo === 'personalizado') inicio.value = estadoPeriodo.inicio;
    if (fim && estadoPeriodo.tipo === 'personalizado') fim.value = estadoPeriodo.fim;
    definirTexto('homePeriodoStatus', periodo.status);
    const mensagem = visao.erro
      ? 'Não foi possível consultar os dados reais deste período. Tente novamente em instantes.'
      : periodo.disponivel
        ? 'O período é aplicado aos indicadores reais de vendas, pedidos, reservas e evolução financeira. Salão, cardápio, clientes e equipe mostram o snapshot retornado pelo Firestore.'
        : 'Não há registros reais para este intervalo. Registre pedidos, movimentações ou reservas para visualizar os indicadores.';
    definirTexto('homePeriodoNota', mensagem);
  }

  function renderizarIndicadores() {
    const resumo = obterResumo();
    const periodo = resumo.periodo;
    const rotulo = periodo.tipo === 'dia' ? 'Faturamento do Dia' : periodo.tipo === 'semana' ? 'Faturamento da Semana' : periodo.tipo === 'mes' ? 'Faturamento do Mês' : periodo.tipo === 'ano' ? 'Faturamento do Ano' : 'Faturamento do Período';
    const pedidosRotulo = periodo.tipo === 'dia' ? 'Pedidos do Dia' : periodo.tipo === 'semana' ? 'Pedidos da Semana' : periodo.tipo === 'mes' ? 'Pedidos do Mês' : periodo.tipo === 'ano' ? 'Pedidos do Ano' : 'Pedidos do Período';
    definirTexto('homeFaturamentoRotulo', rotulo);
    definirTexto('homePedidosRotulo', pedidosRotulo);
    definirTexto('homeFaturamentoDia', moeda(periodo.vendas));
    definirTexto('homeTicketMedio', moeda(periodo.ticketMedio));
    definirTexto('homePedidosHoje', `${periodo.pedidos.toLocaleString('pt-BR')} pedidos`);
    definirTexto('homeVendasSemana', moeda(periodo.vendas));
    definirTexto('homeVendasRotulo', `Vendas ${periodo.nome}`);
    definirTexto('homeVendasPeriodoBotao', periodo.nome);
    definirTexto('homeResumoOperacao', `${pedidos.pedidosAtivos.length}`);
    definirTexto('homeResumoOperacaoSub', `${resumo.pedidosNovos} novos · ${resumo.pedidosPreparo} em preparo`);
    definirTexto('homeResumoFinanceiro', visao.meta?.dadosDisponiveis ? moeda(periodo.vendas - Number(resumo.caixa.suprimentos || 0) - Number(resumo.caixa.sangrias || 0)) : '—');
    definirTexto('homeResumoFinanceiroSub', visao.meta?.dadosDisponiveis ? `resultado no período · saldo esperado ${moeda(resumo.caixa.saldoEsperado || 0)}` : 'Sem dados financeiros reais');
    definirTexto('homeResumoSalao', `${resumo.ocupacao}%`);
    definirTexto('homeResumoSalaoSub', `${resumo.ocupadas} ocupadas · ${resumo.disponiveis} livres`);
    definirTexto('homeMesasTotal', `${mesas.length} mesas`);
    definirTexto('homeMesasOcupadas', `${resumo.ocupadas} ocupadas`);
    definirTexto('homeOcupacaoSalao', `${resumo.ocupacao}% ocupado`);
    definirTexto('homeResumoCardapio', resumo.liderProduto.nome || 'Sem dados');
    definirTexto('homeResumoCardapioSub', `${resumo.liderProduto.quantidade || 0} unidades · ${moeda(resumo.liderProduto.receita || 0)}`);
    definirTexto('homeResumoClientes', Number(relatorios.indicadores?.notaMedia || 0).toFixed(1).replace('.', ','));
    definirTexto('homeResumoClientesSub', `${(relatorios.indicadores?.totalAvaliacoes || 0).toLocaleString('pt-BR')} avaliações`);
    definirTexto('homeResumoEquipe', resumo.liderEquipe.nome || 'Sem dados');
    definirTexto('homeResumoEquipeSub', `${moeda(resumo.liderEquipe.vendas || 0)} em vendas`);
    definirTexto('homeAtualizacaoDados', relatorios.atualizadoEm ? `Base atualizada em ${escapar(relatorios.atualizadoEm)} · ${periodo.status}` : `Sem atualização registrada · ${periodo.status}`);
  }

  function renderizarAlertas() {
    const resumo = obterResumo();
    const alertas = [];
    if (!visao.meta?.dadosDisponiveis) alertas.push({ icone: 'database', classe: 'text-muted', titulo: 'Sem dados operacionais', detalhe: 'Registre movimentações reais para ativar os indicadores.' });
    if (resumo.pedidosNovos) alertas.push({ icone: 'bell-ring', classe: 'text-accent', titulo: `${resumo.pedidosNovos} pedido(s) novo(s)`, detalhe: 'Aguardando início do preparo.' });
    if (resumo.estoqueCritico) alertas.push({ icone: 'package-search', classe: 'text-yellow', titulo: `${resumo.estoqueCritico} item(ns) com estoque crítico`, detalhe: 'Verifique o cardápio antes do próximo turno.' });
    if (resumo.reservasPendentes) alertas.push({ icone: 'calendar-clock', classe: 'text-blue', titulo: `${resumo.reservasPendentes} reserva(s) no período`, detalhe: 'Confira a preparação das mesas.' });
    if (!alertas.length) alertas.push({ icone: 'check-circle-2', classe: 'text-green', titulo: 'Operação sem alertas', detalhe: 'Todos os indicadores reais estão dentro do esperado.' });
    definirHTML('homeAlertasResumo', alertas.slice(0, 3).map(alerta => `<div class="flex items-start gap-2"><i data-lucide="${alerta.icone}" class="w-3.5 h-3.5 ${alerta.classe} mt-0.5 shrink-0"></i><div><p class="text-[11px] font-medium">${escapar(alerta.titulo)}</p><p class="text-[10px] text-muted mt-0.5">${escapar(alerta.detalhe)}</p></div></div>`).join(''));
  }

  function renderizarReservas() {
    const periodo = obterDadosPeriodo();
    const proximas = reservas.filter(reserva => ['confirmada', 'aguardando'].includes(reserva.status) && dataDentroDoIntervalo(dataBRParaISO(reserva.data), periodo.inicio, periodo.fim)).sort((a, b) => a.horario.localeCompare(b.horario)).slice(0, 3);
    definirHTML('homeReservasResumo', proximas.length ? proximas.map(reserva => `<div class="flex items-center justify-between gap-2"><div class="min-w-0"><p class="text-[11px] font-medium truncate">${escapar(reserva.cliente)}</p><p class="text-[10px] text-muted mt-0.5">${escapar(reserva.mesa)} · ${escapar(reserva.pessoas)} pessoas</p></div><span class="text-[10px] ${reserva.status === 'aguardando' ? 'text-yellow' : 'text-blue'} shrink-0">${escapar(reserva.horario)}</span></div>`).join('') : '<p class="text-[10px] text-muted">Nenhuma reserva no período selecionado.</p>');
  }

  function renderizarRitmo() {
    const resumo = obterResumo();
    const notaEquipe = resumo.liderEquipe.avaliacao || 0;
    const ritmo = [
      { rotulo: 'Pico almoço', valor: relatorios.indicadores?.picoAlmoco || '—', classe: 'text-accent' },
      { rotulo: 'Pico jantar', valor: relatorios.indicadores?.picoJantar || '—', classe: 'text-purple' },
      { rotulo: 'Avaliação da equipe', valor: `${Number(notaEquipe).toFixed(1).replace('.', ',')} / 5`, classe: 'text-yellow' },
      { rotulo: 'Mesas bloqueadas', valor: `${resumo.bloqueadas}`, classe: resumo.bloqueadas ? 'text-red' : 'text-green' }
    ];
    definirHTML('homeRitmoResumo', ritmo.map(item => `<div class="flex items-center justify-between gap-2"><span class="text-[10px] text-muted">${escapar(item.rotulo)}</span><span class="text-[11px] font-semibold ${item.classe}">${escapar(item.valor)}</span></div>`).join(''));
  }

  function renderizarModuloOperacao() {
    const ativos = pedidos.pedidosAtivos || [];
    const status = [{ chave: 'novo', label: 'Novos', cor: 'bg-accent' }, { chave: 'preparo', label: 'Em preparo', cor: 'bg-yellow' }, { chave: 'pronto', label: 'Prontos', cor: 'bg-green' }];
    const maior = Math.max(1, ...status.map(item => ativos.filter(pedido => pedido.status === item.chave).length));
    const tempos = ativos.map(pedido => Number.parseInt(pedido.tempo, 10)).filter(Number.isFinite);
    const tempoMedio = tempos.length ? Math.round(tempos.reduce((soma, tempo) => soma + tempo, 0) / tempos.length) : 0;
    definirTexto('homeOperacaoAtivos', `${ativos.length}`);
    definirTexto('homeOperacaoTempo', tempos.length ? `${tempoMedio} min` : '—');
    const tempoBar = document.getElementById('homeOperacaoTempoBar');
    if (tempoBar) tempoBar.style.width = percent((tempoMedio / 30) * 100);
    definirHTML('homeOperacaoStatus', status.map(item => { const total = ativos.filter(pedido => pedido.status === item.chave).length; return `<div><div class="flex items-center justify-between text-[10px] mb-1"><span class="text-muted">${item.label}</span><strong>${total}</strong></div><div class="home-mini-bar"><span class="${item.cor}" style="width:${percent((total / maior) * 100)}"></span></div></div>`; }).join(''));
    const mapa = relatorios.mapaCalor || [];
    const dias = relatorios.diasSemana || [];
    const faixas = relatorios.faixasHorarias || [];
    const maximo = Math.max(1, ...mapa.flat());
    let html = `<span></span>${faixas.map(faixa => `<span class="home-heatmap-label text-center">${escapar(faixa.split('–')[0])}</span>`).join('')}`;
    mapa.forEach((linha, indice) => { html += `<span class="home-heatmap-label">${escapar((dias[indice] || '').slice(0, 3))}</span>`; linha.forEach(valor => { const intensidade = 0.08 + (Number(valor || 0) / maximo) * 0.86; html += `<span class="home-heatmap-cell" title="${escapar(valor)} pedidos" style="background:rgba(234,88,12,${intensidade.toFixed(2)})"></span>`; }); });
    definirHTML('homeOperacaoHeatmap', html);
  }

  function obterSerieFinanceira(periodo) {
    const movimentos = (financeiro.fluxo || []).filter(item => item.tipo === 'saida' && dataDentroDoIntervalo(item.dataIso || dataBRParaISO(item.data), periodo.inicio, periodo.fim));
    const despesasPorData = new Map();
    movimentos.forEach(item => despesasPorData.set(item.dataIso || dataBRParaISO(item.data), (despesasPorData.get(item.dataIso || dataBRParaISO(item.data)) || 0) + Number(item.valor || 0)));
    const serie = periodo.serie.map(item => {
      const data = dataBRParaISO(item.data) || item.data;
      return { label: item.label || item.periodo, vendas: Number(item.vendas || 0), despesas: Number(despesasPorData.get(data) || 0) };
    });
    const despesasSelecionadas = [...despesasPorData.values()].reduce((total, valor) => total + valor, 0);
    return { serie, despesas: despesasSelecionadas, estimada: false };
  }

  function renderizarModuloFinanceiro() {
    const periodo = obterDadosPeriodo();
    const financeiroPeriodo = obterSerieFinanceira(periodo);
    const maximo = Math.max(1, ...financeiroPeriodo.serie.flatMap(item => [item.vendas, item.despesas]));
    const resultado = periodo.vendas - financeiroPeriodo.despesas;
    definirTexto('homeFinanceiroResultado', `${moeda(resultado)} resultado ${periodo.nome.toLowerCase()}`);
    definirHTML('homeFinanceiroBars', financeiroPeriodo.serie.map(item => `<div class="home-chart-bar-group" title="${escapar(item.label)}: ${moeda(item.vendas)} em vendas e ${moeda(item.despesas)} em despesas${financeiroPeriodo.estimada ? ' estimadas' : ''}"><div class="home-chart-bar" style="height:${Math.max(7, (item.vendas / maximo) * 100)}%"></div><div class="home-chart-bar secondary" style="height:${Math.max(5, (item.despesas / maximo) * 100)}%"></div><span class="home-chart-label">${escapar(item.label)}</span></div>`).join(''));
    definirTexto('homeFinanceiroLegendaDespesas', 'Despesas reais');
    const canais = relatorios.canais || [];
    const baseCanais = Math.max(1, canais.reduce((total, canal) => total + Number(canal.vendas || 0), 0));
    const cores = ['bg-accent', 'bg-blue', 'bg-purple'];
    definirHTML('homeCanais', canais.map((canal, indice) => { const valorPeriodo = periodo.vendas * (Number(canal.vendas || 0) / baseCanais); return `<div><div class="flex items-center justify-between text-[10px] mb-1"><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm ${cores[indice] || 'bg-neutral-500'}"></span>${escapar(canal.nome)}</span><strong>${canal.percentual}%</strong></div><div class="home-mini-bar"><span class="${cores[indice] || 'bg-neutral-500'}" style="width:${percent(canal.percentual)}"></span></div><div class="text-[10px] text-muted mt-1">${moeda(valorPeriodo)}</div></div>`; }).join(''));
  }

  function renderizarModuloSalao() {
    const resumo = obterResumo();
    const graus = Math.round((resumo.ocupacao / 100) * 360);
    const donut = document.getElementById('homeSalaoDonut');
    if (donut) donut.style.background = `conic-gradient(#60a5fa 0deg ${graus}deg,#1a1a1a ${graus}deg 360deg)`;
    definirTexto('homeSalaoDonutValue', mesas.length ? `${resumo.ocupacao}%` : '—');
    const contagens = [{ label: 'Ocupadas', valor: resumo.ocupadas, cor: 'text-blue' }, { label: 'Livres', valor: resumo.disponiveis, cor: 'text-green' }, { label: 'Bloqueadas', valor: resumo.bloqueadas, cor: 'text-red' }, { label: 'Reservadas', valor: reservas.filter(reserva => reserva.status === 'confirmada').length, cor: 'text-yellow' }];
    definirHTML('homeSalaoLista', contagens.map(item => `<div class="rounded-lg bg-card2 border border-border2 p-3"><span class="text-[10px] text-muted">${item.label}</span><strong class="block text-lg ${item.cor} mt-1">${item.valor}</strong><span class="text-[10px] text-muted">mesas</span></div>`).join(''));
  }

  function renderizarModuloCardapio() {
    const ranking = (relatorios.produtosMaisVendidos || []).slice(0, 5);
    const maior = Math.max(1, ...ranking.map(item => item.quantidade));
    definirHTML('homeCardapioRanking', ranking.map(item => `<div class="home-ranking-item"><div class="flex items-center justify-between gap-2 text-[11px]"><span class="truncate"><strong class="text-accent mr-1">${item.posicao}.</strong>${escapar(item.nome)}</span><span class="text-muted shrink-0">${item.quantidade} un.</span></div><div class="home-ranking-track mt-1"><div class="home-ranking-fill" style="width:${percent((item.quantidade / maior) * 100)}"></div></div><div class="flex items-center justify-between text-[10px] text-muted mt-1"><span>${escapar(item.categoria)}</span><span>${moeda(item.receita)}</span></div></div>`).join(''));
    const categorias = financeiro.categorias || [];
    const cores = ['bg-accent', 'bg-blue', 'bg-green', 'bg-purple', 'bg-yellow'];
    definirHTML('homeCardapioCategorias', categorias.slice(0, 5).map((categoria, indice) => `<div><div class="flex items-center justify-between text-[10px] mb-1"><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm ${cores[indice]}"></span>${escapar(categoria.nome)}</span><strong>${categoria.percentual}%</strong></div><div class="home-mini-bar"><span class="${cores[indice]}" style="width:${percent(categoria.percentual)}"></span></div></div>`).join(''));
  }

  function renderizarModuloClientes() {
    const notas = relatorios.distribuicaoNotas || [];
    const total = Math.max(1, notas.reduce((soma, item) => soma + Number(item.quantidade || 0), 0));
    const totalAvaliacoes = Number(relatorios.indicadores?.totalAvaliacoes || 0);
    definirTexto('homeClientesNota', totalAvaliacoes ? Number(relatorios.indicadores?.notaMedia || 0).toFixed(1).replace('.', ',') : '—');
    definirTexto('homeClientesResposta', totalAvaliacoes ? `${relatorios.indicadores?.taxaResposta || 0}% respondidas` : 'Sem avaliações reais');
    const cores = { 5: 'bg-yellow', 4: 'bg-green', 3: 'bg-blue', 2: 'bg-purple', 1: 'bg-red' };
    definirHTML('homeClientesStars', notas.map(item => `<div class="flex items-center gap-2"><span class="w-8 text-[10px] text-muted">${item.nota} estrela${item.nota > 1 ? 's' : ''}</span><div class="home-mini-bar flex-1"><span class="${cores[item.nota] || 'bg-neutral-500'}" style="width:${percent((item.quantidade / total) * 100)}"></span></div><span class="w-8 text-right text-[10px] text-muted">${item.percentual}%</span></div>`).join(''));
    const avaliacoes = relatorios.avaliacoes || [];
    const categorias = [...new Set(avaliacoes.map(item => item.categoria))];
    const insights = [{ titulo: 'Avaliações na base', valor: `${relatorios.indicadores?.totalAvaliacoes || 0}` }, { titulo: 'Feedbacks recentes', valor: `${avaliacoes.length}` }, { titulo: 'Mais citado', valor: categorias[0] || '—' }];
    definirHTML('homeClientesInsights', insights.map(item => `<div class="rounded-lg bg-card2 border border-border2 p-3"><span class="text-[10px] text-muted">${escapar(item.titulo)}</span><strong class="block text-sm text-yellow mt-1 truncate">${escapar(item.valor)}</strong></div>`).join(''));
  }

  function renderizarModuloEquipe() {
    const ranking = (relatorios.performanceEquipe || []).slice(0, 5);
    const maior = Math.max(1, ...ranking.map(item => item.vendas));
    definirHTML('homeEquipeRanking', ranking.map(item => `<div class="home-ranking-item"><div class="flex items-center justify-between gap-2 text-[11px]"><span class="truncate"><strong class="text-purple mr-1">${item.posicao}.</strong>${escapar(item.nome)}</span><span class="text-muted shrink-0">${moeda(item.vendas)}</span></div><div class="home-ranking-track mt-1"><div class="home-ranking-fill" style="width:${percent((item.vendas / maior) * 100)};background:linear-gradient(90deg,#7c3aed,#c4b5fd)"></div></div><div class="flex items-center justify-between text-[10px] text-muted mt-1"><span>${item.pedidos} pedidos</span><span>${Number(item.avaliacao).toFixed(1).replace('.', ',')} avaliação</span></div></div>`).join(''));
    const totalVendas = ranking.reduce((soma, item) => soma + Number(item.vendas || 0), 0);
    const totalPedidos = ranking.reduce((soma, item) => soma + Number(item.pedidos || 0), 0);
    const media = ranking.length ? ranking.reduce((soma, item) => soma + Number(item.avaliacao || 0), 0) / ranking.length : 0;
    const resumo = obterResumo();
    const kpis = [{ titulo: 'Equipe ativa', valor: resumo.ativosEquipe }, { titulo: 'Vendas do ranking', valor: ranking.length ? moeda(totalVendas) : '—' }, { titulo: 'Pedidos atendidos', valor: totalPedidos || '—' }, { titulo: 'Avaliação média', valor: ranking.length ? `${media.toFixed(1).replace('.', ',')} / 5` : '—' }];
    definirHTML('homeEquipeKpis', kpis.map(item => `<div class="rounded-lg bg-card2 border border-border2 p-3"><span class="text-[10px] text-muted">${escapar(item.titulo)}</span><strong class="block text-sm text-purple mt-1 truncate">${escapar(item.valor)}</strong></div>`).join(''));
  }

  function renderizarGraficoVendas() {
    const destino = document.getElementById('homeVendasGrafico');
    if (!destino) return;
    const serie = obterDadosPeriodo().serie || [];
    if (!serie.length) {
      destino.innerHTML = '<p class="text-xs text-muted">Não há vendas reais no período selecionado.</p>';
      return;
    }
    const maximo = Math.max(1, ...serie.map(item => Number(item.vendas || 0)));
    destino.innerHTML = `<div class="flex items-end gap-1 h-48" aria-label="Vendas reais por período">${serie.map(item => `<div class="flex flex-col items-center flex-1 h-full justify-end gap-1" title="${escapar(item.label)}: ${moeda(item.vendas)}"><div class="w-full max-w-12 rounded-t bg-gradient-to-t from-accent to-orange-400 transition-all" style="height:${Math.max(4, (Number(item.vendas || 0) / maximo) * 100)}%"></div><span class="text-[9px] text-muted truncate max-w-full">${escapar(item.label)}</span></div>`).join('')}</div>`;
  }

  function renderizarEvolucaoOperacional() {
    const estado = document.getElementById('homeSistemaEstado');
    const grafico = document.getElementById('homeSistemaGrafico');
    const metricas = document.getElementById('homeSistemaMetricas');
    const indicador = visao.indicadores || {};
    const temDados = Boolean(visao.meta?.dadosDisponiveis);
    if (estado) estado.textContent = temDados ? 'Dados reais do Firestore' : 'Sem dados reais';
    if (grafico) grafico.innerHTML = temDados ? `<div class="grid grid-cols-2 gap-2 text-xs"><div class="rounded-lg bg-card2 border border-border2 p-3"><span class="text-muted">Vendas</span><strong class="block mt-1">${moeda(Number(indicador.vendasCentavos || 0) / 100)}</strong></div><div class="rounded-lg bg-card2 border border-border2 p-3"><span class="text-muted">Pedidos</span><strong class="block mt-1">${Number(indicador.pedidos || 0).toLocaleString('pt-BR')}</strong></div></div>` : '<p class="text-xs text-muted">Os indicadores aparecerão quando houver registros reais no Firestore.</p>';
    if (metricas) {
      const itens = [{ nome: 'Mesas', valor: mesas.length }, { nome: 'Produtos', valor: cardapio.produtos.length }, { nome: 'Equipe', valor: equipe.funcionarios.length }, { nome: 'Reservas', valor: reservas.length }];
      metricas.innerHTML = itens.map(item => `<div><span class="text-[10px] text-muted">${item.nome}</span><strong class="block text-sm mt-1">${item.valor || '—'}</strong></div>`).join('');
    }
  }

  function renderizarMesasResumo() {
    const destino = document.getElementById('homeMesasStatus');
    if (!destino) return;
    const status = { disponivel: 'bg-green/40 border-green/60', ocupada: 'bg-red/40 border-red/60', indisponivel: 'bg-neutral-500/40 border-neutral-400/60' };
    destino.innerHTML = mesas.slice(0, 12).map(mesa => `<span class="w-6 h-6 rounded border ${status[mesa.status] || 'bg-card2 border-border2'}" title="${escapar(mesa.nome)} · ${escapar(mesa.status)}"></span>`).join('');
  }

  function renderizarCategoriasVendas() {
    const destino = document.getElementById('homeVendasCategorias');
    if (!destino) return;
    const canais = relatorios.canais || [];
    if (!canais.length) {
      destino.innerHTML = '<p class="text-xs text-muted">Sem vendas categorizadas no período.</p>';
      return;
    }
    destino.innerHTML = canais.slice(0, 5).map((canal, indice) => `<div><div class="flex items-center justify-between text-[10px] mb-1"><span>${escapar(canal.nome)}</span><strong>${Number(canal.percentual || 0)}%</strong></div><div class="home-mini-bar"><span class="${['bg-accent', 'bg-blue', 'bg-purple', 'bg-yellow', 'bg-green'][indice]}" style="width:${percent(canal.percentual)}"></span></div><div class="text-[10px] text-muted mt-1">${moeda(canal.vendas || 0)}</div></div>`).join('');
  }

  function renderizarPedidosRecentes() {
    const recentes = [...(pedidos.pedidosAtivos || []), ...(pedidos.pedidosHistorico || [])].slice(0, 3);
    const resumo = document.getElementById('homePedidosRecentesResumo');
    if (resumo) resumo.innerHTML = recentes.length ? recentes.map(pedido => `<div class="rounded-lg bg-card2 p-3 border border-border2"><div class="flex items-center justify-between gap-2"><div class="min-w-0"><p class="text-sm font-medium truncate">${escapar(pedido.id || 'Pedido')}</p><p class="text-xs text-muted truncate">${escapar(pedido.mesa || pedido.cliente || pedido.canal || 'Sem identificação')} · ${escapar(pedido.horario || '—')}</p></div><span class="text-xs text-muted">${moeda(pedido.valor || 0)}</span></div><div class="text-xs text-muted mt-2">${escapar(pedido.statusLabel || pedido.status || 'Sem status')}</div></div>`).join('') : '<p class="text-xs text-muted">Nenhum pedido real no período.</p>';
    const tabela = document.getElementById('homePedidosTabela');
    if (tabela) tabela.innerHTML = recentes.length ? recentes.map(pedido => `<tr class="border-b border-border"><td class="p-4"><input class="rounded bg-card2 border-border2" type="checkbox" aria-label="Selecionar ${escapar(pedido.id || 'pedido')}"></td><td class="p-4 font-mono text-xs">${escapar(pedido.id || '—')}</td><td class="p-4">${escapar(pedido.mesa || pedido.cliente || pedido.canal || '—')}</td><td class="p-4 font-medium">${moeda(pedido.valor || 0)}</td><td class="p-4 text-muted">${escapar(pedido.horario || '—')}</td><td class="p-4"><span class="text-xs">${escapar(pedido.statusLabel || pedido.status || '—')}</span></td></tr>`).join('') : '<tr><td colspan="6" class="p-6 text-center text-xs text-muted">Nenhum pedido real encontrado no período.</td></tr>';
  }

  function renderizarTudo() {
    renderizarFiltro();
    renderizarIndicadores();
    renderizarAlertas();
    renderizarReservas();
    renderizarRitmo();
    renderizarModuloOperacao();
    renderizarModuloFinanceiro();
    renderizarModuloSalao();
    renderizarModuloCardapio();
    renderizarModuloClientes();
    renderizarModuloEquipe();
    renderizarGraficoVendas();
    renderizarEvolucaoOperacional();
    renderizarMesasResumo();
    renderizarCategoriasVendas();
    renderizarPedidosRecentes();
    window.lucide?.createIcons();
  }

  function solicitarPeriodo(tipo, inicio = '', fim = '') {
    estadoPeriodo = { tipo, inicio: inicio || DATA_ATUAL, fim: fim || DATA_ATUAL };
    renderizarFiltro();
    const parametros = tipo === 'personalizado' ? { periodo: tipo, inicio, fim } : { periodo: tipo };
    window.apexVisaoGeralRecarregar?.(parametros);
  }

  function conectarFiltros() {
    document.querySelectorAll('[data-home-periodo]').forEach(botao => botao.addEventListener('click', () => {
      const tipo = botao.dataset.homePeriodo;
      if (tipo === 'personalizado') {
        estadoPeriodo.tipo = tipo;
        renderizarFiltro();
        return;
      }
      solicitarPeriodo(tipo);
    }));
    document.getElementById('homeAplicarPeriodo')?.addEventListener('click', () => {
      const inicio = document.getElementById('homeDataInicio')?.value;
      const fim = document.getElementById('homeDataFim')?.value;
      if (!inicio || !fim) { aviso('Informe a data inicial e a data final.'); return; }
      if (isoParaData(inicio) > isoParaData(fim)) { aviso('A data inicial não pode ser posterior à data final.'); return; }
      solicitarPeriodo('personalizado', inicio, fim);
    });
  }

  function conectarAcoes() {
    document.querySelectorAll('[data-home-rota]').forEach(botao => botao.addEventListener('click', () => navegar(botao.dataset.homeRota)));
    document.querySelectorAll('#conteudoPagina button').forEach(botao => {
      if (botao.dataset.homeRota || botao.dataset.homeAviso || botao.dataset.homePeriodo || botao.id === 'homeAplicarPeriodo') return;
      const texto = botao.textContent.trim();
      if (['Restaurante', 'Delivery', 'Total'].includes(texto)) botao.addEventListener('click', () => aviso('Filtro de canal da Home preparado para integração com dados em tempo real.'));
    });
    document.getElementById('homeVendasPeriodoBotao')?.closest('button')?.addEventListener('click', () => document.querySelector('.home-periodo-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  window.apexHomeAtualizarDados = () => renderizarTudo();
  conectarFiltros();
  renderizarTudo();
  conectarAcoes();
})();
