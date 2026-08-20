(() => {
  const paginas = {
    home: { titulo: 'Visão Geral', fragmento: 'paginas/home.html', href: '/', estilos: ['estilos/home/home.css?v=cards-uniformes'], scripts: ['scripts/home/dados-visao-geral.js?v=fase4', 'scripts/home/home.js?v=31a9457'] },
    'novo-pedido': { titulo: 'Novo Pedido', fragmento: 'paginas/pedidos/novo-pedido.html?v=fase6', href: '/novo-pedido', estilos: ['estilos/pedidos/pedidos.css?v=cards-uniformes'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase6', 'scripts/pedidos/novo-pedido.js?v=fase6'] },
    'pedidos-ativos': { titulo: 'Pedidos Ativos', fragmento: 'paginas/pedidos/pedidos-ativos.html?v=fase6', href: '/pedidos-ativos', estilos: ['estilos/pedidos/pedidos.css?v=cards-uniformes'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase6', 'scripts/pedidos/pedidos-ativos.js?v=fase6'] },
    'historico-pedidos': { titulo: 'Histórico de Pedidos', fragmento: 'paginas/pedidos/historico-pedidos.html?v=fase6', href: '/historico-pedidos', estilos: ['estilos/pedidos/pedidos.css?v=cards-uniformes'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase6', 'scripts/pedidos/historico-pedidos.js?v=fase6'] },
    'fila-cozinha': { titulo: 'Fila da Cozinha', fragmento: 'paginas/pedidos/fila-cozinha.html?v=fase6', href: '/fila-cozinha', estilos: ['estilos/pedidos/pedidos.css?v=cards-uniformes', 'estilos/pedidos/fila-cozinha.css?v=cards-uniformes'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase6', 'scripts/pedidos/fila-cozinha.js?v=fase6'] },
    operacional: { titulo: 'Operacional', fragmento: 'paginas/operacional/operacional.html', href: '/operacional', estilos: ['estilos/operacional/operacional.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/operacional/operacional.js'] },
    'dashboard-financeiro': { titulo: 'Dashboard Financeiro', fragmento: 'paginas/financeiro/dashboard-financeiro.html', href: '/dashboard-financeiro', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js?v=fase11', 'scripts/financeiro/dashboard-financeiro.js?v=fase11'] },
    'dashboard-desempenho': { titulo: 'Dashboard de Desempenho', fragmento: 'paginas/desempenho/dashboard-desempenho.html', href: '/dashboard-desempenho', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase11', 'scripts/equipe/dados-equipe.js?v=fase11', 'scripts/relatorios/dados-relatorios.js?v=fase11', 'scripts/desempenho/dashboard-desempenho.js?v=fase11'] },
    categorias: { titulo: 'Categorias', fragmento: 'paginas/cardapio/categorias.html?v=fase5b', href: '/categorias', estilos: ['estilos/cardapio/cardapio.css?v=fase5b'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase5b', 'scripts/cardapio/dados-cardapio.js?v=fase5b', 'scripts/cardapio/categorias.js?v=fase5b'] },
    produtos: { titulo: 'Produtos', fragmento: 'paginas/cardapio/produtos.html?v=fase5b', href: '/produtos', estilos: ['estilos/cardapio/cardapio.css?v=fase5b'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase5b', 'scripts/cardapio/dados-cardapio.js?v=fase5b', 'scripts/cardapio/produtos.js?v=fase5b'] },
    promocoes: { titulo: 'Promoções', fragmento: 'paginas/cardapio/promocoes.html?v=fase5b', href: '/promocoes', estilos: ['estilos/cardapio/cardapio.css?v=fase5b'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase5b', 'scripts/cardapio/dados-cardapio.js?v=fase5b', 'scripts/cardapio/promocoes.js?v=fase5b'] },
    'cardapio-digital': { titulo: 'Cardápio Digital', fragmento: 'paginas/cardapio/cardapio-digital.html?v=fase5b', href: '/cardapio-digital', estilos: ['estilos/pedidos/pedidos.css?v=fase5b', 'estilos/cardapio/cardapio.css?v=fase5b'], scripts: ['scripts/pedidos/dados-pedidos.js?v=fase5b', 'scripts/cardapio/dados-cardapio.js?v=fase5b', 'scripts/cardapio/cardapio-digital.js?v=fase5b'] },
    'mapa-mesas': { titulo: 'Mapa de Mesas', fragmento: 'paginas/salao/mapa-mesas.html', href: '/mapa-mesas', estilos: ['estilos/mapa-mesas.css'], scripts: ['scripts/salao/dados-mesas.js', 'scripts/salao/mapa-mesas.js'] },
    reservas: { titulo: 'Reservas', fragmento: 'paginas/salao/reservas.html', href: '/reservas', estilos: ['estilos/salao/salao.css'], scripts: ['scripts/salao/dados-reservas.js', 'scripts/salao/reservas.js'] },
    'configuracao-mesas': { titulo: 'Configuração de Mesas', fragmento: 'paginas/salao/configuracao-mesas.html', href: '/configuracao-mesas', estilos: ['estilos/salao/salao.css'], scripts: ['scripts/salao/dados-mesas.js', 'scripts/salao/configuracao-mesas.js'] },
    funcionarios: { titulo: 'Funcionários', fragmento: 'paginas/equipe/funcionarios.html', href: '/funcionarios', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/funcionarios.js'] },
    'escala-trabalho': { titulo: 'Escala de Trabalho', fragmento: 'paginas/equipe/escala-trabalho.html', href: '/escala-trabalho', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/escala-trabalho.js'] },
    comissoes: { titulo: 'Comissões', fragmento: 'paginas/equipe/comissoes.html', href: '/comissoes', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/equipe/comissoes.js'] },
    'fechamento-caixa': { titulo: 'Fechamento de Caixa', fragmento: 'paginas/financeiro/fechamento-caixa.html', href: '/fechamento-caixa', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/fechamento-caixa.js'] },
    'fluxo-caixa': { titulo: 'Fluxo de Caixa', fragmento: 'paginas/financeiro/fluxo-caixa.html', href: '/fluxo-caixa', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/fluxo-caixa.js'] },
    'contas-pagar-receber': { titulo: 'Contas a Pagar/Receber', fragmento: 'paginas/financeiro/contas-pagar-receber.html', href: '/contas-pagar-receber', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/contas-pagar-receber.js'] },
    'relatorios-financeiros': { titulo: 'Relatórios Financeiros', fragmento: 'paginas/financeiro/relatorios-financeiros.html', href: '/relatorios-financeiros', estilos: ['estilos/financeiro/financeiro.css'], scripts: ['scripts/financeiro/dados-financeiros.js', 'scripts/financeiro/relatorios-financeiros.js'] },
    'vendas-por-periodo': { titulo: 'Vendas por Período', fragmento: 'paginas/relatorios/vendas-por-periodo.html', href: '/vendas-por-periodo', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/vendas-por-periodo.js?v=fase8'] },
    'produtos-mais-vendidos': { titulo: 'Produtos Mais Vendidos', fragmento: 'paginas/relatorios/produtos-mais-vendidos.html', href: '/produtos-mais-vendidos', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/produtos-mais-vendidos.js?v=fase8'] },
    'horarios-de-pico': { titulo: 'Horários de Pico', fragmento: 'paginas/relatorios/horarios-de-pico.html', href: '/horarios-de-pico', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/horarios-de-pico.js?v=fase8b'] },
    'avaliacoes-clientes': { titulo: 'Avaliações dos Clientes', fragmento: 'paginas/relatorios/avaliacoes-clientes.html', href: '/avaliacoes-clientes', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/avaliacoes-clientes.js?v=fase8'] },
    'performance-equipe': { titulo: 'Performance da Equipe', fragmento: 'paginas/relatorios/performance-equipe.html', href: '/performance-equipe', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/equipe/dados-equipe.js', 'scripts/relatorios/dados-relatorios.js?v=fase8', 'scripts/relatorios/performance-equipe.js?v=fase8'] }
  };

  let carregamentoAtual = 0;
  const normalizar = valor => String(valor || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .split(/[?#]/, 1)[0]
    .replace(/^\.?\//, '')
    .replace(/^\/+|\/+$/g, '');
  const paginaPorHref = href => {
    const caminho = normalizar(href);
    if (!caminho || caminho === 'index' || caminho === 'index.html') return 'home';
    return Object.entries(paginas).find(([, pagina]) => {
      const atual = normalizar(pagina.href);
      const legado = normalizar(pagina.fragmento.replace(/[?#].*$/, '').replace(/\.html$/, ''));
      return atual === caminho || legado === caminho;
    })?.[0] || '';
  };
  const migrarHashLegado = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return '';
    const chave = paginas[hash] ? hash : paginaPorHref(hash);
    if (!chave) return '';
    window.history.replaceState({}, '', paginas[chave].href || '/');
    return chave;
  };
  const paginaPorUrl = () => {
    const caminho = window.location.pathname.replace(/\/+$/, '') || '/';
    return paginaPorHref(caminho) || 'home';
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
      const resposta = await fetch(pagina.fragmento, {
        cache: 'no-store',
        headers: { 'X-Apex-Fragment': '1' },
      });
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
  function navegar(alvo, opcoes = {}) {
    const chave = paginas[alvo] ? alvo : paginaPorHref(alvo);
    const pagina = paginas[chave] || paginas.home;
    const destino = pagina.href || '/';
    if (window.location.pathname !== destino) {
      window.history[opcoes.substituir ? 'replaceState' : 'pushState']({}, '', destino);
    }
    carregar(chave || 'home');
  }
  window.apexShell = Object.freeze({ navegar, carregar, paginas });
  window.addEventListener('popstate', () => carregar(paginaPorUrl()));
  document.addEventListener('DOMContentLoaded', () => {
    const rotaLegada = migrarHashLegado();
    carregar(rotaLegada || paginaPorUrl());
  });
})();
