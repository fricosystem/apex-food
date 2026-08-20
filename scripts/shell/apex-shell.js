(() => {
  const paginas = {
    home: { titulo: 'Visão Geral', fragmento: 'paginas/home.html', href: 'index', estilos: ['estilos/home/home.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase10c', 'scripts/cardapio/dados-cardapio.js?v=fase10c', 'scripts/equipe/dados-equipe.js?v=fase10c', 'scripts/financeiro/dados-financeiros.js?v=fase10c', 'scripts/salao/dados-mesas.js?v=fase10c', 'scripts/salao/dados-reservas.js?v=fase10c', 'scripts/relatorios/dados-relatorios.js?v=fase10c', 'scripts/home/home.js?v=fase12'] },
    'novo-pedido': { titulo: 'Novo Pedido', fragmento: 'paginas/pedidos/novo-pedido.html', href: 'paginas/pedidos/novo-pedido', estilos: ['estilos/pedidos/pedidos.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/pedidos/novo-pedido.js'] },
    'pedidos-ativos': { titulo: 'Pedidos Ativos', fragmento: 'paginas/pedidos/pedidos-ativos.html', href: 'paginas/pedidos/pedidos-ativos', estilos: ['estilos/pedidos/pedidos.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/pedidos/pedidos-ativos.js'] },
    'historico-pedidos': { titulo: 'Histórico de Pedidos', fragmento: 'paginas/pedidos/historico-pedidos.html', href: 'paginas/pedidos/historico-pedidos', estilos: ['estilos/pedidos/pedidos.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/pedidos/historico-pedidos.js'] },
    'fila-cozinha': { titulo: 'Fila da Cozinha', fragmento: 'paginas/pedidos/fila-cozinha.html', href: 'paginas/pedidos/fila-cozinha', estilos: ['estilos/pedidos/pedidos.css', 'estilos/pedidos/fila-cozinha.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/pedidos/fila-cozinha.js'] },
    operacional: { titulo: 'Operacional', fragmento: 'paginas/operacional/operacional.html', href: 'paginas/operacional/operacional', estilos: ['estilos/operacional/operacional.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/operacional/operacional.js'] },
    'dashboard-financeiro': { titulo: 'Dashboard Financeiro', fragmento: 'paginas/financeiro/dashboard-financeiro.html', href: 'paginas/financeiro/dashboard-financeiro', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js?v=fase11', 'scripts/financeiro/dashboard-financeiro.js?v=fase11'] },
    'dashboard-desempenho': { titulo: 'Dashboard de Desempenho', fragmento: 'paginas/desempenho/dashboard-desempenho.html', href: 'paginas/desempenho/dashboard-desempenho', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase11', 'scripts/equipe/dados-equipe.js?v=fase11', 'scripts/relatorios/dados-relatorios.js?v=fase11', 'scripts/desempenho/dashboard-desempenho.js?v=fase11'] },
    categorias: { titulo: 'Categorias', fragmento: 'paginas/cardapio/categorias.html', href: 'paginas/cardapio/categorias', estilos: ['estilos/cardapio/cardapio.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/cardapio/categorias.js'] },
    produtos: { titulo: 'Produtos', fragmento: 'paginas/cardapio/produtos.html', href: 'paginas/cardapio/produtos', estilos: ['estilos/cardapio/cardapio.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/cardapio/produtos.js'] },
    promocoes: { titulo: 'Promoções', fragmento: 'paginas/cardapio/promocoes.html', href: 'paginas/cardapio/promocoes', estilos: ['estilos/cardapio/cardapio.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/cardapio/promocoes.js'] },
    'cardapio-digital': { titulo: 'Cardápio Digital', fragmento: 'paginas/cardapio/cardapio-digital.html', href: 'paginas/cardapio/cardapio-digital', estilos: ['estilos/pedidos/pedidos.css', 'estilos/cardapio/cardapio.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/cardapio/cardapio-digital.js'] },
    'mapa-mesas': { titulo: 'Mapa de Mesas', fragmento: 'paginas/salao/mapa-mesas.html', href: 'paginas/salao/mapa-mesas', estilos: ['estilos/mapa-mesas.css'], scripts: ['scripts/salao/dados-mesas.js', 'scripts/salao/mapa-mesas.js'] },
    reservas: { titulo: 'Reservas', fragmento: 'paginas/salao/reservas.html', href: 'paginas/salao/reservas', estilos: ['estilos/salao/salao.css'], scripts: ['scripts/salao/dados-reservas.js', 'scripts/salao/reservas.js'] },
    'configuracao-mesas': { titulo: 'Configuração de Mesas', fragmento: 'paginas/salao/configuracao-mesas.html', href: 'paginas/salao/configuracao-mesas', estilos: ['estilos/salao/salao.css'], scripts: ['scripts/salao/dados-mesas.js', 'scripts/salao/configuracao-mesas.js'] },
    funcionarios: { titulo: 'Funcionários', fragmento: 'paginas/equipe/funcionarios.html', href: 'paginas/equipe/funcionarios', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/funcionarios.js'] },
    'escala-trabalho': { titulo: 'Escala de Trabalho', fragmento: 'paginas/equipe/escala-trabalho.html', href: 'paginas/equipe/escala-trabalho', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/escala-trabalho.js'] },
    comissoes: { titulo: 'Comissões', fragmento: 'paginas/equipe/comissoes.html', href: 'paginas/equipe/comissoes', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/comissoes.js'] },
    'fechamento-caixa': { titulo: 'Fechamento de Caixa', fragmento: 'paginas/financeiro/fechamento-caixa.html', href: 'paginas/financeiro/fechamento-caixa', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/fechamento-caixa.js'] },
    'fluxo-caixa': { titulo: 'Fluxo de Caixa', fragmento: 'paginas/financeiro/fluxo-caixa.html', href: 'paginas/financeiro/fluxo-caixa', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/fluxo-caixa.js'] },
    'contas-pagar-receber': { titulo: 'Contas a Pagar/Receber', fragmento: 'paginas/financeiro/contas-pagar-receber.html', href: 'paginas/financeiro/contas-pagar-receber', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/contas-pagar-receber.js'] },
    'relatorios-financeiros': { titulo: 'Relatórios Financeiros', fragmento: 'paginas/financeiro/relatorios-financeiros.html', href: 'paginas/financeiro/relatorios-financeiros', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/relatorios-financeiros.js'] },
    'vendas-por-periodo': { titulo: 'Vendas por Período', fragmento: 'paginas/relatorios/vendas-por-periodo.html', href: 'paginas/relatorios/vendas-por-periodo', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/vendas-por-periodo.js?v=fase8'] },
    'produtos-mais-vendidos': { titulo: 'Produtos Mais Vendidos', fragmento: 'paginas/relatorios/produtos-mais-vendidos.html', href: 'paginas/relatorios/produtos-mais-vendidos', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/produtos-mais-vendidos.js?v=fase8'] },
    'horarios-de-pico': { titulo: 'Horários de Pico', fragmento: 'paginas/relatorios/horarios-de-pico.html', href: 'paginas/relatorios/horarios-de-pico', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/horarios-de-pico.js?v=fase8b'] },
    'avaliacoes-clientes': { titulo: 'Avaliações dos Clientes', fragmento: 'paginas/relatorios/avaliacoes-clientes.html', href: 'paginas/relatorios/avaliacoes-clientes', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/avaliacoes-clientes.js?v=fase8'] },
    'performance-equipe': { titulo: 'Performance da Equipe', fragmento: 'paginas/relatorios/performance-equipe.html', href: 'paginas/relatorios/performance-equipe', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/performance-equipe.js?v=fase8'] }
  };

  let carregamentoAtual = 0;
  const normalizar = valor => String(valor || '').replace(/^\.\//, '').replace(/^\//, '');
  const paginaPorHref = href => { const caminho = normalizar(href); if (!caminho) return ''; return Object.entries(paginas).find(([, pagina]) => normalizar(pagina.href) === caminho)?.[0] || ''; };
  const paginaPorHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return paginas[hash] ? hash : 'home';
  };
  const emitirErro = mensagem => {
    const container = document.getElementById('conteudoPagina');
    if (container) container.innerHTML = `<div class="p-6"><div class="rounded-xl border border-red/30 bg-red/10 p-5"><h2 class="font-semibold text-red-300">Não foi possível abrir esta página</h2><p class="text-sm text-muted mt-2">${mensagem}</p></div></div>`;
  };
  const atualizarEstilos = pagina => {
    document.querySelectorAll('link[data-apex-page-style]').forEach(link => link.remove());
    pagina.estilos.forEach(caminho => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = caminho; link.dataset.apexPageStyle = 'true'; document.head.appendChild(link); });
  };
  const carregarScripts = scripts => scripts.reduce((fila, caminho) => fila.then(() => new Promise((resolve, reject) => { document.querySelectorAll(`script[data-apex-page-script="${caminho}"]`).forEach(script => script.remove()); const script = document.createElement('script'); script.src = caminho; script.dataset.apexPageScript = caminho; script.onload = resolve; script.onerror = () => reject(new Error(`Falha ao carregar ${caminho}`)); document.body.appendChild(script); })), Promise.resolve());
  const atualizarNavegacao = chave => { document.querySelectorAll('[data-apex-rota]').forEach(link => { const ativo = Boolean(link.dataset.apexRota) && paginaPorHref(link.dataset.apexRota) === chave; link.classList.toggle('active', ativo); link.closest('.tree-item')?.classList.toggle('active', ativo); }); };
  async function carregar(chave) {
    const pagina = paginas[chave] || paginas.home;
    const token = ++carregamentoAtual;
    const container = document.getElementById('conteudoPagina');
    if (!container) return;
    container.setAttribute('aria-busy', 'true');
    try {
      const resposta = await fetch(pagina.fragmento, { cache: 'no-store' });
      if (!resposta.ok) throw new Error(`A rota retornou HTTP ${resposta.status}.`);
      const html = await resposta.text();
      if (token !== carregamentoAtual) return;
      container.innerHTML = html;
      atualizarEstilos(pagina);
      await carregarScripts(pagina.scripts);
      if (token !== carregamentoAtual) return;
      document.title = `APEX Food — ${pagina.titulo}`;
      const tituloHeader = document.getElementById('tituloHeader');
      if (tituloHeader) tituloHeader.textContent = pagina.titulo;
      atualizarNavegacao(chave);
      if (chave === 'home' && typeof window.apexInicializarHome === 'function') window.apexInicializarHome();
      window.lucide?.createIcons();
      container.classList.remove('carregando');
    } catch (erro) {
      if (token === carregamentoAtual) emitirErro(erro.message || 'Tente novamente.');
    } finally {
      if (token === carregamentoAtual) container.removeAttribute('aria-busy');
    }
  }
  function navegar(alvo) { const chave = paginas[alvo] ? alvo : paginaPorHref(alvo); if (window.location.hash !== `#/${chave}`) window.location.hash = `#/${chave}`; else carregar(chave); }
  window.apexShell = Object.freeze({ navegar, carregar, paginas });
  window.addEventListener('hashchange', () => carregar(paginaPorHash()));
  document.addEventListener('DOMContentLoaded', () => carregar(paginaPorHash()));
})();
