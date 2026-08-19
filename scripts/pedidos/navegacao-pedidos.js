const secoesNavegacaoPedidos = [
  { titulo: 'GERAL', icone: 'layout-dashboard', itens: [{ chave: 'inicio', label: 'Visão Geral', icone: 'home', href: () => window.rotasApexFood?.dashboard || '../../index.html', descricao: 'Dashboard principal do restaurante' }] },
  { titulo: 'PEDIDOS', icone: 'receipt', itens: [
    { chave: 'novo-pedido', label: 'Novo Pedido', icone: 'plus-circle', href: 'novo-pedido.html', descricao: 'Fluxo de abertura de comanda' },
    { chave: 'pedidos-ativos', label: 'Pedidos Ativos', icone: 'shopping-bag', href: 'pedidos-ativos.html', descricao: 'Pedidos em andamento por mesa' },
    { chave: 'historico-pedidos', label: 'Histórico de Pedidos', icone: 'history', href: 'historico-pedidos.html', descricao: 'Pedidos finalizados com detalhes' },
    { chave: 'fila-cozinha', label: 'Fila da Cozinha', icone: 'chef-hat', href: 'fila-cozinha.html', descricao: 'Pedidos aguardando preparo' }
  ] },
  { titulo: 'CARDÁPIO', icone: 'book-open', itens: [{ chave: 'categorias', label: 'Categorias', icone: 'folder', href: '../cardapio/categorias.html', descricao: 'Entradas, principais, bebidas, etc.' }, { chave: 'produtos', label: 'Produtos', icone: 'package', href: '../cardapio/produtos.html', descricao: 'Cadastro de itens com preço e foto' }, { chave: 'promocoes', label: 'Promoções', icone: 'tag', href: '../cardapio/promocoes.html', descricao: 'Ofertas do dia, combos, descontos' }, { chave: 'cardapio-digital', label: 'Cardápio Digital', icone: 'qr-code', href: '../cardapio/cardapio-digital.html', descricao: 'Preview do QR Code do cliente' }] },
  { titulo: 'SALÃO', icone: 'armchair', itens: [{ label: 'Mapa de Mesas', icone: 'layout-grid', href: '../salao/mapa-mesas.html', descricao: 'Status de cada mesa' }, { label: 'Reservas', icone: 'calendar', descricao: 'Controle de reservas antecipadas' }, { label: 'Configuração de Mesas', icone: 'settings', descricao: 'Adicionar/remover mesas e QR' }] },
  { titulo: 'EQUIPE', icone: 'users', itens: [{ label: 'Funcionários', icone: 'user-circle', descricao: 'Garçons, cozinheiros, gerentes' }, { label: 'Escala de Trabalho', icone: 'calendar-clock', descricao: 'Turnos e horários' }, { label: 'Comissões', icone: 'percent', descricao: 'Comissões por garçom' }] },
  { titulo: 'FINANCEIRO', icone: 'wallet', itens: [{ label: 'Fechamento de Caixa', icone: 'lock', descricao: 'Encerrar expediente com relatório' }, { label: 'Fluxo de Caixa', icone: 'arrow-left-right', descricao: 'Entradas e saídas do dia' }, { label: 'Contas a Pagar/Receber', icone: 'file-text', descricao: 'Fornecedores e contas fixas' }, { label: 'Relatórios Financeiros', icone: 'pie-chart', descricao: 'Extrato diário, semanal, mensal' }] },
  { titulo: 'RELATÓRIOS', icone: 'file-bar-chart', itens: [{ label: 'Vendas por Período', icone: 'bar-chart-3', descricao: 'Análise de vendas' }, { label: 'Produtos Mais Vendidos', icone: 'star', descricao: 'Top produtos' }, { label: 'Horários de Pico', icone: 'clock', descricao: 'Melhores horários' }, { label: 'Avaliações dos Clientes', icone: 'message-square', descricao: 'Feedback dos clientes' }, { label: 'Performance da Equipe', icone: 'award', descricao: 'Desempenho dos funcionários' }] }
];

function mostrarAvisoPedido(mensagem) {
  let aviso = document.getElementById('avisoPedido');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'avisoPedido';
    aviso.className = 'fixed bottom-5 right-5 z-[70] max-w-sm rounded-lg bg-card2 border border-border2 px-4 py-3 text-sm shadow-2xl';
    document.body.appendChild(aviso);
  }
  aviso.textContent = mensagem;
  aviso.classList.remove('hidden');
  clearTimeout(mostrarAvisoPedido.timer);
  mostrarAvisoPedido.timer = setTimeout(() => aviso.classList.add('hidden'), 2600);
}

function fecharMenuPedidos() {
  document.getElementById('sidebarMobile')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
  if (!document.querySelector('.pedido-modal.aberto')) document.body.style.overflow = '';
}

function montarNavegacaoPedidos() {
  const paginaAtiva = document.body.dataset.paginaAtiva || '';
  ['sidebarContentDesktop', 'sidebarContentMobile'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    secoesNavegacaoPedidos.forEach((secao, indice) => {
      const bloco = document.createElement('div');
      bloco.className = `p-4${indice > 0 ? ' border-t border-border' : ''}`;
      bloco.innerHTML = `<div class="section-header"><div class="section-title"><i data-lucide="${secao.icone}" class="section-icon w-3.5 h-3.5"></i><span>${secao.titulo}</span></div><i data-lucide="chevron-down" class="w-3 h-3 text-muted"></i></div>`;
      const nav = document.createElement('nav');
      nav.className = 'tree-group space-y-1';
      secao.itens.forEach(item => {
        const ativo = item.chave === paginaAtiva;
        const itemArvore = document.createElement('div');
        itemArvore.className = `tree-item${ativo ? ' active' : ''}`;
        const link = document.createElement('a');
        link.href = typeof item.href === 'function' ? item.href() : (item.href || '#');
        link.className = `tree-link${ativo ? ' active' : ''}`;
        link.title = item.descricao;
        link.innerHTML = `<i data-lucide="${item.icone}" class="w-4 h-4 flex-shrink-0"></i><span>${item.label}</span>`;
        link.addEventListener('click', event => {
          fecharMenuPedidos();
          if (!item.href) {
            event.preventDefault();
            mostrarAvisoPedido(`${item.label}: módulo preparado para a próxima integração.`);
          }
        });
        itemArvore.appendChild(link);
        nav.appendChild(itemArvore);
      });
      bloco.appendChild(nav);
      container.appendChild(bloco);
    });
  });
  window.lucide?.createIcons();
}

function ativarMenuMobilePedidos() {
  const menu = document.getElementById('menuBtn');
  const fechar = document.getElementById('closeMenuBtn');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.getElementById('sidebarMobile');
  menu?.addEventListener('click', () => { sidebar?.classList.add('open'); overlay?.classList.add('open'); document.body.style.overflow = 'hidden'; });
  fechar?.addEventListener('click', fecharMenuPedidos);
  overlay?.addEventListener('click', fecharMenuPedidos);
}

montarNavegacaoPedidos();
ativarMenuMobilePedidos();
