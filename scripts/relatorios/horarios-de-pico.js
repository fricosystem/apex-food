(() => {
  const dados = window.dadosRelatoriosApexFood;
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  function exportar(mapa) { if (!mapa.length || !mapa.flat().some(Boolean)) return aviso('Nenhum registro de horário encontrado para exportar.'); const linhas = [['Dia', ...dados.faixasHorarias], ...mapa.map((linha, indice) => [dados.diasSemana[indice], ...linha])]; const blob = new Blob([linhas.map(linha => linha.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'horarios-de-pico.csv'; link.click(); URL.revokeObjectURL(link.href); }
  const canalEl = document.getElementById('canalHorariosPico');

  function renderizar() {
    const canal = canalEl?.value || 'todos';
    const fator = canal === 'salao' ? .78 : canal === 'delivery' ? .34 : 1;
    const mapa = dados.mapaCalor.map(linha => linha.map(valor => Math.round(valor * fator)));
    const maior = Math.max(...mapa.flat(), 1);
    if (!mapa.length || !mapa.flat().some(Boolean)) { document.getElementById('picoAlmocoHorarios').textContent = '—'; document.getElementById('picoAlmocoPedidos').textContent = 'Nenhum registro encontrado'; document.getElementById('picoJantarHorarios').textContent = '—'; document.getElementById('picoJantarPedidos').textContent = 'Nenhum registro encontrado'; document.getElementById('diaPicoHorarios').textContent = '—'; document.getElementById('diaPicoPedidos').textContent = 'Nenhum registro encontrado'; document.getElementById('ocupacaoPicoHorarios').textContent = '—'; document.getElementById('mapaCalorHorarios').innerHTML = '<p class="text-sm text-muted text-center py-8">Nenhum registro de horário encontrado.</p>'; document.getElementById('leiturasHorariosPico').innerHTML = '<p class="text-sm text-muted">Nenhuma leitura disponível.</p>'; document.getElementById('recomendacoesHorariosPico').innerHTML = '<p class="text-sm text-muted">Nenhuma recomendação disponível.</p>'; return; }
    const encontrarPico = (inicio, fim) => mapa.reduce((melhor, linha, dia) => linha.reduce((melhorHora, valor, hora) => (hora >= inicio && hora < fim && valor > melhorHora.valor) ? { valor, dia, hora } : melhorHora, melhor), { valor: 0, dia: 0, hora: inicio });
    const maiorAlmoco = encontrarPico(0, 5);
    const maiorJantar = encontrarPico(6, 10);
    const diaMaisMovimentado = mapa.map((linha, indice) => ({ indice, valor: linha.reduce((total, item) => total + item, 0) })).sort((a, b) => b.valor - a.valor)[0];
    document.getElementById('picoAlmocoHorarios').textContent = dados.faixasHorarias[maiorAlmoco.hora];
    document.getElementById('picoAlmocoPedidos').textContent = `${maiorAlmoco.valor} pedidos/hora estimados`;
    document.getElementById('picoJantarHorarios').textContent = dados.faixasHorarias[maiorJantar.hora];
    document.getElementById('picoJantarPedidos').textContent = `${maiorJantar.valor} pedidos/hora estimados`;
    document.getElementById('diaPicoHorarios').textContent = dados.diasSemana[diaMaisMovimentado.indice];
    document.getElementById('diaPicoPedidos').textContent = `${diaMaisMovimentado.valor} pedidos distribuídos`;
    document.getElementById('ocupacaoPicoHorarios').textContent = `${Math.round(62 * fator)}%`;
    renderizarMapa(mapa, maior);
    renderizarLeituras(maiorAlmoco, maiorJantar, diaMaisMovimentado, canal);
    renderizarRecomendacoes(maiorAlmoco, maiorJantar, canal);
  }

  function renderizarMapa(mapa, maior) {
    const header = `<div class="grid grid-cols-[90px_repeat(10,minmax(48px,1fr))] gap-1 mb-1"><div></div>${dados.faixasHorarias.map(horario => `<div class="text-[10px] text-muted text-center truncate">${escapar(horario)}</div>`).join('')}</div>`;
    const linhas = mapa.map((linha, indice) => `<div class="grid grid-cols-[90px_repeat(10,minmax(48px,1fr))] gap-1 mb-1"><div class="text-xs text-muted flex items-center">${escapar(dados.diasSemana[indice])}</div>${linha.map((valor, hora) => { const intensidade = valor / maior; const classe = intensidade > .78 ? 'bg-accent' : intensidade > .5 ? 'bg-accent/70' : intensidade > .25 ? 'bg-accent/45' : 'bg-accent/20'; return `<div title="${escapar(dados.diasSemana[indice])}, ${escapar(dados.faixasHorarias[hora])}: ${valor} pedidos" class="relatorio-heat-cell h-9 sm:h-11 rounded-md ${classe} flex items-center justify-center text-[10px] ${intensidade > .5 ? 'text-white' : 'text-muted'}">${valor}</div>`; }).join('')}</div>`).join('');
    document.getElementById('mapaCalorHorarios').innerHTML = header + linhas;
  }

  function renderizarLeituras(almoco, jantar, dia, canal) {
    const canalTexto = canal === 'todos' ? 'todos os canais' : canal;
    document.getElementById('leiturasHorariosPico').innerHTML = [`<div class="flex gap-3 p-3 rounded-lg bg-card2 border border-border2"><i data-lucide="utensils" class="w-4 h-4 text-accent shrink-0 mt-0.5"></i><div><p class="text-xs font-medium">${escapar(dados.faixasHorarias[almoco.hora])} concentra o almoço</p><p class="text-[10px] text-muted mt-1">O intervalo de almoço representa a maior pressão operacional entre 11h e 16h em ${escapar(canalTexto)}.</p></div></div>`, `<div class="flex gap-3 p-3 rounded-lg bg-card2 border border-border2"><i data-lucide="calendar-heart" class="w-4 h-4 text-purple shrink-0 mt-0.5"></i><div><p class="text-xs font-medium">${escapar(dados.diasSemana[dia.indice])} é o dia mais forte</p><p class="text-[10px] text-muted mt-1">Planeje o reforço da equipe e o abastecimento antes do início do turno.</p></div></div>`].join('');
    window.lucide?.createIcons();
  }

  function renderizarRecomendacoes(almoco, jantar, canal) {
    const canalTexto = canal === 'todos' ? 'salão e delivery' : canal;
    document.getElementById('recomendacoesHorariosPico').innerHTML = [`<div class="flex gap-3 p-3 rounded-lg bg-yellow/10 border border-yellow/20"><i data-lucide="users-round" class="w-4 h-4 text-yellow shrink-0 mt-0.5"></i><div><p class="text-xs font-medium text-yellow">Reforçar a equipe antes das ${escapar(dados.faixasHorarias[almoco.hora].split('–')[0])}</p><p class="text-[10px] text-muted mt-1">Antecipe a preparação de praça para reduzir filas no pico de almoço.</p></div></div>`, `<div class="flex gap-3 p-3 rounded-lg bg-blue/10 border border-blue/20"><i data-lucide="package-search" class="w-4 h-4 text-blue shrink-0 mt-0.5"></i><div><p class="text-xs font-medium text-blue">Conferir estoque antes do jantar</p><p class="text-[10px] text-muted mt-1">Valide insumos dos produtos mais vendidos antes das ${escapar(dados.faixasHorarias[6].split('–')[0])} para ${escapar(canalTexto)}.</p></div></div>`, `<div class="flex gap-3 p-3 rounded-lg bg-green/10 border border-green/20"><i data-lucide="timer-reset" class="w-4 h-4 text-green shrink-0 mt-0.5"></i><div><p class="text-xs font-medium text-green">Monitorar tempo de preparo</p><p class="text-[10px] text-muted mt-1">Use alertas da cozinha nos horários de maior concentração de pedidos.</p></div></div>`].join('');
    window.lucide?.createIcons();
  }

  canalEl?.addEventListener('change', renderizar);
  document.getElementById('periodoHorariosPico')?.addEventListener('change', renderizar);
  document.getElementById('exportarHorariosPico')?.addEventListener('click', () => exportar(dados.mapaCalor));
  document.addEventListener('apex:relatorios-atualizado', renderizar);
  renderizar();
})();
