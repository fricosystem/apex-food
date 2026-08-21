(() => {
  const paginas = {
    home: { titulo: 'Visão Geral', fragmento: 'paginas/home.html?v=etapa17-visao', href: '/', estilos: ['estilos/home/home.css?v=cards-uniformes'], scripts: ['scripts/home/dados-visao-geral.js?v=etapa17-visao', 'scripts/home/home.js?v=etapa17-visao'] },
    mesa: { titulo: 'Atendimento da Mesa', fragmento: 'paginas/publico/mesa.html?v=etapa20-cardapio-estoque', href: '/mesa', estilos: ['estilos/publico/mesa.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/publico/mesa.js?v=etapa20-cardapio-estoque'] },
    'novo-pedido': { titulo: 'Novo Pedido', fragmento: 'paginas/pedidos/novo-pedido.html?v=etapa20-cardapio-estoque', href: '/novo-pedido', estilos: ['estilos/pedidos/pedidos.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/pedidos/novo-pedido.js?v=etapa20-cardapio-estoque'] },
    'pedidos-ativos': { titulo: 'Pedidos Ativos', fragmento: 'paginas/pedidos/pedidos-ativos.html?v=etapa19-fluxo-operacional', href: '/pedidos-ativos', estilos: ['estilos/pedidos/pedidos.css?v=etapa19-fluxo-operacional'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/pedidos/pedidos-ativos.js?v=etapa19-fluxo-operacional'] },
    'historico-pedidos': { titulo: 'Histórico de Pedidos', fragmento: 'paginas/pedidos/historico-pedidos.html?v=etapa7-historico', href: '/historico-pedidos', estilos: ['estilos/pedidos/pedidos.css?v=etapa7-historico'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/pedidos/historico-pedidos.js?v=etapa7-historico'] },
    'fila-cozinha': { titulo: 'Fila da Cozinha', fragmento: 'paginas/pedidos/fila-cozinha.html?v=etapa19-fluxo-operacional', href: '/fila-cozinha', estilos: ['estilos/pedidos/pedidos.css?v=etapa19-fluxo-operacional', 'estilos/pedidos/fila-cozinha.css?v=etapa19-fluxo-operacional'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/pedidos/fila-cozinha.js?v=etapa19-fluxo-operacional'] },
    operacional: { titulo: 'Operacional', fragmento: 'paginas/operacional/operacional.html', href: '/operacional', estilos: ['estilos/operacional/operacional.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/operacional/operacional.js'] },
    'dashboard-financeiro': { titulo: 'Dashboard Financeiro', fragmento: 'paginas/financeiro/dashboard-financeiro.html?v=etapa7-historico', href: '/dashboard-financeiro', estilos: ['estilos/financeiro/financeiro.css?v=etapa7-historico'], scripts: ['scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global', 'scripts/financeiro/dashboard-financeiro.js?v=etapa7-historico'] },
    'dashboard-desempenho': { titulo: 'Dashboard de Desempenho', fragmento: 'paginas/desempenho/dashboard-desempenho.html?v=fase10', href: '/dashboard-desempenho', estilos: ['estilos/equipe/equipe.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/relatorios/dados-relatorios.js?v=fase11', 'scripts/desempenho/dashboard-desempenho.js?v=fase10'] },
    categorias: { titulo: 'Categorias', fragmento: 'paginas/cardapio/categorias.html?v=etapa20-cardapio-estoque', href: '/categorias', estilos: ['estilos/cardapio/cardapio.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js?v=etapa20-cardapio-estoque', 'scripts/cardapio/categorias.js?v=etapa20-cardapio-estoque'] },
    produtos: { titulo: 'Produtos', fragmento: 'paginas/cardapio/produtos.html?v=etapa20-cardapio-estoque', href: '/produtos', estilos: ['estilos/cardapio/cardapio.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js?v=etapa20-cardapio-estoque', 'scripts/cardapio/produtos.js?v=etapa20-cardapio-estoque'] },
    promocoes: { titulo: 'Promoções', fragmento: 'paginas/cardapio/promocoes.html?v=etapa20-cardapio-estoque', href: '/promocoes', estilos: ['estilos/cardapio/cardapio.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js?v=etapa20-cardapio-estoque', 'scripts/cardapio/promocoes.js?v=etapa20-cardapio-estoque'] },
    'cardapio-digital': { titulo: 'Cardápio Digital', fragmento: 'paginas/cardapio/cardapio-digital.html?v=etapa20-cardapio-estoque', href: '/cardapio-digital', estilos: ['estilos/pedidos/pedidos.css?v=etapa20-cardapio-estoque', 'estilos/cardapio/cardapio.css?v=etapa20-cardapio-estoque'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js?v=etapa20-cardapio-estoque', 'scripts/cardapio/cardapio-digital.js?v=etapa20-cardapio-estoque'] },
    'mapa-mesas': { titulo: 'Mapa de Mesas', fragmento: 'paginas/salao/mapa-mesas.html?v=etapa21-salao-tempo-real', href: '/mapa-mesas', estilos: ['estilos/mapa-mesas.css?v=etapa21-salao-tempo-real'], scripts: ['scripts/salao/dados-mesas.js?v=etapa21-salao-tempo-real', 'scripts/salao/mapa-mesas.js?v=etapa21-salao-tempo-real'] },
    reservas: { titulo: 'Reservas', fragmento: 'paginas/salao/reservas.html?v=etapa21-salao-tempo-real', href: '/reservas', estilos: ['estilos/salao/salao.css?v=etapa21-salao-tempo-real'], scripts: ['scripts/salao/dados-mesas.js?v=etapa21-salao-tempo-real', 'scripts/salao/dados-reservas.js?v=etapa21-salao-tempo-real', 'scripts/salao/reservas.js?v=etapa21-salao-tempo-real'] },
    'configuracao-mesas': { titulo: 'Configuração de Mesas', fragmento: 'paginas/salao/configuracao-mesas.html?v=etapa21-salao-tempo-real', href: '/configuracao-mesas', estilos: ['estilos/salao/salao.css?v=etapa21-salao-tempo-real'], scripts: ['scripts/salao/dados-mesas.js?v=etapa21-salao-tempo-real', 'scripts/salao/configuracao-mesas.js?v=etapa21-salao-tempo-real'] },
    funcionarios: { titulo: 'Funcionários', fragmento: 'paginas/equipe/funcionarios.html?v=etapa22-dados-reais-global', href: '/funcionarios', estilos: ['estilos/equipe/equipe.css?v=etapa22-dados-reais-global'], scripts: ['scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/equipe/funcionarios.js?v=etapa22-dados-reais-global'] },
    'escala-trabalho': { titulo: 'Escala de Trabalho', fragmento: 'paginas/equipe/escala-trabalho.html?v=etapa22-dados-reais-global', href: '/escala-trabalho', estilos: ['estilos/equipe/equipe.css?v=etapa22-dados-reais-global'], scripts: ['scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/equipe/escala-trabalho.js?v=etapa22-dados-reais-global'] },
    comissoes: { titulo: 'Comissões', fragmento: 'paginas/equipe/comissoes.html?v=etapa22-dados-reais-global', href: '/comissoes', estilos: ['estilos/equipe/equipe.css?v=etapa22-dados-reais-global'], scripts: ['scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/equipe/comissoes.js?v=etapa22-dados-reais-global'] },
    'fechamento-caixa': { titulo: 'Fechamento de Caixa', fragmento: 'paginas/financeiro/fechamento-caixa.html?v=etapa19-fluxo-operacional', href: '/fechamento-caixa', estilos: ['estilos/financeiro/financeiro.css?v=etapa19-fluxo-operacional'], scripts: ['scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global', 'scripts/financeiro/fechamento-caixa.js?v=etapa19-fluxo-operacional'] },
    'fluxo-caixa': { titulo: 'Fluxo de Caixa', fragmento: 'paginas/financeiro/fluxo-caixa.html?v=fase9b', href: '/fluxo-caixa', estilos: ['estilos/financeiro/financeiro.css?v=fase9b'], scripts: ['scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global', 'scripts/financeiro/fluxo-caixa.js?v=fase9b'] },
    'contas-pagar-receber': { titulo: 'Contas a Pagar/Receber', fragmento: 'paginas/financeiro/contas-pagar-receber.html?v=fase9b', href: '/contas-pagar-receber', estilos: ['estilos/financeiro/financeiro.css?v=fase9b'], scripts: ['scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global', 'scripts/financeiro/contas-pagar-receber.js?v=fase9b'] },
    'relatorios-financeiros': { titulo: 'Relatórios Financeiros', fragmento: 'paginas/financeiro/relatorios-financeiros.html?v=fase9b', href: '/relatorios-financeiros', estilos: ['estilos/financeiro/financeiro.css?v=fase9b'], scripts: ['scripts/financeiro/dados-financeiros.js?v=etapa22-dados-reais-global', 'scripts/financeiro/relatorios-financeiros.js?v=fase9b'] },
    'vendas-por-periodo': { titulo: 'Vendas por Período', fragmento: 'paginas/relatorios/vendas-por-periodo.html?v=fase11', href: '/vendas-por-periodo', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase11', 'scripts/relatorios/vendas-por-periodo.js?v=fase11'] },
    'produtos-mais-vendidos': { titulo: 'Produtos Mais Vendidos', fragmento: 'paginas/relatorios/produtos-mais-vendidos.html?v=fase10', href: '/produtos-mais-vendidos', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase10', 'scripts/relatorios/produtos-mais-vendidos.js?v=fase10'] },
    'horarios-de-pico': { titulo: 'Horários de Pico', fragmento: 'paginas/relatorios/horarios-de-pico.html?v=fase10', href: '/horarios-de-pico', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase10', 'scripts/relatorios/horarios-de-pico.js?v=fase10'] },
    'avaliacoes-clientes': { titulo: 'Avaliações dos Clientes', fragmento: 'paginas/relatorios/avaliacoes-clientes.html?v=fase10', href: '/avaliacoes-clientes', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/pedidos/dados-pedidos.js?v=etapa22-dados-reais-global', 'scripts/cardapio/dados-cardapio.js', 'scripts/relatorios/dados-relatorios.js?v=fase10', 'scripts/relatorios/avaliacoes-clientes.js?v=fase10'] },
    'performance-equipe': { titulo: 'Performance da Equipe', fragmento: 'paginas/relatorios/performance-equipe.html?v=fase10', href: '/performance-equipe', estilos: ['estilos/relatorios/relatorios.css'], scripts: ['scripts/equipe/dados-equipe.js?v=etapa22-dados-reais-global', 'scripts/relatorios/dados-relatorios.js?v=fase10', 'scripts/relatorios/performance-equipe.js?v=fase10'] },
    'configuracoes-perfil': { titulo: 'Configurações do Perfil', fragmento: 'paginas/configuracoes/perfil.html?v=etapa15-perfil', href: '/configuracoes-perfil', estilos: ['estilos/configuracoes/perfil.css?v=etapa15-perfil'], scripts: ['scripts/configuracoes/perfil.js?v=etapa15-perfil'] }
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
    document.body.classList.toggle('apex-publico-mesa', chave === 'mesa');
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
