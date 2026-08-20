(() => {
  const dados = window.dadosRelatoriosApexFood;
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const csv = valor => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  function exportar(avaliacoes) { if (!avaliacoes.length) return aviso('Nenhuma avaliação encontrada para exportar.'); const linhas = [['Cliente', 'Nota', 'Categoria', 'Canal', 'Data', 'Comentário'], ...avaliacoes.map(item => [item.cliente, item.nota, item.categoria, item.canal, item.data, item.comentario])]; const blob = new Blob([linhas.map(linha => linha.map(csv).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'avaliacoes-clientes.csv'; link.click(); URL.revokeObjectURL(link.href); }
  const periodoEl = document.getElementById('periodoAvaliacoesClientes');
  const categoriaEl = document.getElementById('categoriaAvaliacoesClientes');

  function obterAvaliacoes() {
    const periodo = periodoEl?.value || 'todos';
    const categoria = categoriaEl?.value || 'todas';
    return dados.avaliacoes.filter(item => (categoria === 'todas' || item.categoria === categoria) && (periodo !== 'pendentes' || !item.respondida));
  }

  function estrelas(nota, pequenas = false) {
    return Array.from({ length: 5 }, (_, indice) => `<i data-lucide="star" class="${pequenas ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${indice < nota ? 'relatorio-star' : 'text-muted/40'}"></i>`).join('');
  }

  function renderizar() {
    const avaliacoes = obterAvaliacoes();
    const notaMedia = avaliacoes.length ? avaliacoes.reduce((total, item) => total + item.nota, 0) / avaliacoes.length : 0;
    const cincoEstrelas = avaliacoes.length ? Math.round(avaliacoes.filter(item => item.nota === 5).length / avaliacoes.length * 100) : 0;
    const respondidas = avaliacoes.filter(item => item.respondida).length;
    document.getElementById('notaMediaAvaliacoes').textContent = notaMedia.toFixed(1).replace('.', ',');
    document.getElementById('totalAvaliacoesClientes').textContent = avaliacoes.length.toLocaleString('pt-BR');
    document.getElementById('percentualCincoEstrelas').textContent = `${cincoEstrelas}%`;
    document.getElementById('taxaRespostaAvaliacoes').textContent = `${avaliacoes.length ? Math.round(respondidas / avaliacoes.length * 100) : 0}%`;
    document.getElementById('estrelasNotaMedia').innerHTML = estrelas(Math.round(notaMedia), true);
    document.getElementById('resumoAvaliacoesClientes').textContent = `${avaliacoes.length} avaliações exibidas · ${avaliacoes.filter(item => !item.respondida).length} aguardando resposta.`;
    renderizarDistribuicao(avaliacoes);
    renderizarLista(avaliacoes);
    window.lucide?.createIcons();
  }

  function renderizarDistribuicao(avaliacoes) {
    const total = Math.max(avaliacoes.length, 1);
    document.getElementById('distribuicaoAvaliacoesClientes').innerHTML = [5, 4, 3, 2, 1].map(nota => { const quantidade = avaliacoes.filter(item => item.nota === nota).length; const percentual = Math.round(quantidade / total * 100); return `<div class="flex items-center gap-2"><span class="text-xs text-muted w-3">${nota}</span><i data-lucide="star" class="w-3 h-3 relatorio-star shrink-0"></i><div class="flex-1 h-2 bg-card2 rounded-full overflow-hidden"><div class="relatorio-barra h-full bg-yellow rounded-full" style="width:${percentual}%"></div></div><span class="text-[10px] text-muted w-8 text-right">${quantidade}</span></div>`; }).join('');
  }

  function renderizarLista(avaliacoes) {
    document.getElementById('listaAvaliacoesClientes').innerHTML = avaliacoes.length ? avaliacoes.map(item => `<article class="p-4 sm:p-5"><div class="flex items-start gap-3"><div class="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-orange-400 flex items-center justify-center text-xs font-bold text-white shrink-0">${escapar(item.iniciais)}</div><div class="min-w-0 flex-1"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><div class="flex items-center gap-2"><h4 class="text-sm font-medium">${escapar(item.cliente)}</h4><span class="text-[10px] px-2 py-0.5 rounded-full bg-card2 text-muted">${escapar(item.canal)}</span></div><div class="flex items-center gap-2 mt-1"><span class="flex items-center gap-0.5">${estrelas(item.nota, true)}</span><span class="text-[10px] text-muted">${escapar(item.data)}</span></div></div><span class="self-start text-[10px] px-2 py-1 rounded-md ${item.respondida ? 'bg-green/10 text-green' : 'bg-yellow/10 text-yellow'}">${item.respondida ? 'Respondida' : 'Aguardando resposta'}</span></div><p class="text-xs text-muted leading-relaxed mt-3">${escapar(item.comentario)}</p><div class="flex items-center gap-2 mt-3"><span class="text-[10px] text-accent">${escapar(item.categoria)}</span>${!item.respondida ? '<button data-responder-avaliacao="' + escapar(item.id) + '" class="text-[10px] text-blue hover:text-white">Responder agora</button>' : ''}</div></div></div></article>`).join('') : '<div class="p-6 text-sm text-muted text-center">Nenhuma avaliação encontrada para os filtros selecionados.</div>';
    document.querySelectorAll('[data-responder-avaliacao]').forEach(botao => botao.addEventListener('click', () => aviso('Nenhuma avaliação disponível para resposta.')));
  }

  periodoEl?.addEventListener('change', renderizar);
  categoriaEl?.addEventListener('change', renderizar);
  document.getElementById('responderAvaliacoesClientes')?.addEventListener('click', () => aviso('Nenhuma avaliação disponível para resposta.'));
  document.getElementById('exportarAvaliacoesClientes')?.addEventListener('click', () => exportar(obterAvaliacoes()));
  document.addEventListener('apex:relatorios-atualizado', renderizar);
  renderizar();
})();
