(() => {
  'use strict';

  const elementos = {
    atualizacao: document.getElementById('atualizacaoDashboardEstabelecimentos'),
    estabelecimentos: document.getElementById('metricEstabelecimentos'),
    ativos: document.getElementById('metricEstabelecimentosAtivos'),
    usuarios: document.getElementById('metricUsuariosEstabelecimentos'),
    pedidos: document.getElementById('metricPedidosEstabelecimentos'),
    faturamento: document.getElementById('metricFaturamentoEstabelecimentos'),
    avaliacao: document.getElementById('metricAvaliacaoEstabelecimentos'),
    estados: document.getElementById('distribuicaoEstados'),
    planos: document.getElementById('distribuicaoPlanos'),
    vencimentos: document.getElementById('proximosVencimentos'),
    resultado: document.getElementById('resultadoDashboardEstabelecimentos'),
    tabela: document.getElementById('tabelaDashboardEstabelecimentos'),
  };

  const rotulosEstado = { rascunho: 'Rascunho', em_teste: 'Em teste', ativo: 'Ativo', suspenso: 'Suspenso', desativado: 'Desativado', encerrado: 'Encerrado' };
  const rotulosPlano = { teste: 'Período de teste', basico: 'Plano básico', profissional: 'Plano profissional', enterprise: 'Plano Enterprise' };
  const coresEstado = { ativo: 'bg-green', em_teste: 'bg-yellow', suspenso: 'bg-red', desativado: 'bg-muted', encerrado: 'bg-muted', rascunho: 'bg-muted' };

  function escapar(valor) {
    return window.ferramentasInterfaceApexFood?.escaparHtml
      ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
      : String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[caractere]));
  }

  function moeda(centavos) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos || 0) / 100);
  }

  function data(valor) {
    if (!valor) return 'Sem data informada';
    const dataConvertida = new Date(valor);
    return Number.isNaN(dataConvertida.getTime()) ? 'Data inválida' : dataConvertida.toLocaleDateString('pt-BR');
  }

  function renderizarDistribuicao(container, dados, rotulos, vazio) {
    const entradas = Object.entries(dados || {});
    if (!entradas.length || entradas.every(([, valor]) => Number(valor || 0) === 0)) {
      container.innerHTML = `<p class="text-xs text-muted">${vazio}</p>`;
      return;
    }
    const maior = Math.max(...entradas.map(([, valor]) => Number(valor || 0)), 1);
    container.innerHTML = entradas.map(([codigo, valor]) => `<div><div class="flex items-center justify-between gap-3 text-xs mb-1"><span class="text-muted">${escapar(rotulos[codigo] || codigo)}</span><strong class="text-white">${Number(valor || 0)}</strong></div><div class="h-1.5 rounded-full bg-card2 overflow-hidden"><span class="block h-full rounded-full bg-accent" style="width:${Math.min(100, Math.round(Number(valor || 0) / maior * 100))}%"></span></div></div>`).join('');
  }

  function renderizarVencimentos(itens) {
    if (!itens?.length) {
      elementos.vencimentos.innerHTML = '<p class="text-xs text-muted">Nenhum vencimento disponível.</p>';
      return;
    }
    elementos.vencimentos.innerHTML = itens.map((item) => `<div class="flex items-center justify-between gap-3 py-2 border-b border-border2 last:border-0"><div class="min-w-0"><p class="text-xs font-medium truncate">${escapar(item.nome)}</p><p class="text-[11px] text-muted mt-0.5">${escapar(item.planoAtual?.nomePlano || 'Plano não informado')}</p></div><span class="text-xs text-muted whitespace-nowrap">${escapar(data(item.planoAtual?.fimEm))}</span></div>`).join('');
  }

  function renderizarTabela(itens) {
    elementos.resultado.textContent = `${itens.length} ${itens.length === 1 ? 'estabelecimento encontrado' : 'estabelecimentos encontrados'}.`;
    if (!itens.length) {
      elementos.tabela.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-sm text-muted">Nenhum estabelecimento encontrado.</td></tr>';
      return;
    }
    elementos.tabela.innerHTML = itens.map((item) => `<tr class="border-b border-border2 last:border-0"><td class="py-3 pr-4"><p class="font-medium">${escapar(item.nome)}</p><p class="text-[11px] text-muted mt-0.5">${escapar(item.documentoMascarado || 'Documento não informado')}</p></td><td class="py-3 pr-4"><span class="inline-flex items-center gap-1.5 text-xs"><span class="w-1.5 h-1.5 rounded-full ${coresEstado[item.estado] || 'bg-muted'}"></span>${escapar(rotulosEstado[item.estado] || item.estado)}</span></td><td class="py-3 pr-4 text-xs text-muted">${escapar(item.planoAtual?.nomePlano || rotulosPlano[item.planoAtual?.codigoPlano] || 'Plano não informado')}</td><td class="py-3 pr-4 text-xs">${Number(item.usuariosAtivos || 0)}</td><td class="py-3 pr-4 text-xs">${Number(item.pedidosPeriodo || 0)}</td><td class="py-3 text-xs">${moeda(item.faturamentoPeriodoCentavos)}</td></tr>`).join('');
  }

  function renderizar(dados) {
    const resumo = dados.resumo || {};
    elementos.estabelecimentos.textContent = Number(resumo.estabelecimentos || 0);
    elementos.ativos.textContent = Number(resumo.estabelecimentosAtivos || 0);
    elementos.usuarios.textContent = Number(resumo.usuariosAtivos || 0);
    elementos.pedidos.textContent = Number(resumo.pedidosPeriodo || 0);
    elementos.faturamento.textContent = moeda(resumo.faturamentoPeriodoCentavos);
    elementos.avaliacao.textContent = resumo.avaliacaoMedia === null || resumo.avaliacaoMedia === undefined ? '—' : Number(resumo.avaliacaoMedia).toFixed(2);
    renderizarDistribuicao(elementos.estados, dados.distribuicao?.porEstado, rotulosEstado, 'Nenhum estado disponível.');
    renderizarDistribuicao(elementos.planos, dados.distribuicao?.porPlano, rotulosPlano, 'Nenhum plano disponível.');
    renderizarVencimentos(dados.vencimentos || []);
    renderizarTabela(dados.estabelecimentos || []);
    elementos.atualizacao.textContent = dados.meta?.atualizadoEm ? `Atualizado em ${data(dados.meta.atualizadoEm)}` : 'Sincronizado';
    window.lucide?.createIcons();
  }

  async function carregar() {
    try {
      if (!window.apexModulosApi?.consultarDashboardEstabelecimentos) throw new Error('Serviço global indisponível.');
      const resposta = await window.apexModulosApi.consultarDashboardEstabelecimentos();
      renderizar(resposta);
    } catch (erro) {
      elementos.atualizacao.textContent = 'Não foi possível sincronizar';
      elementos.resultado.textContent = erro.message || 'Não foi possível carregar os estabelecimentos.';
      elementos.tabela.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-sm text-red-200">Não foi possível carregar os dados globais.</td></tr>';
    }
  }

  window.dadosDashboardEstabelecimentosPronto = carregar();
})();
