const dadosFinanceirosPreview = {
  caixaAtual: {
    data: '18/08/2026', abertura: 1200.00, vendas: 4872.50, suprimentos: 380.00, sangrias: 250.00, retiradas: 0, saldoEsperado: 5442.50, saldoConferido: 5442.50, status: 'aberto', operador: 'Beatriz Almeida', aberturaHora: '10:02'
  },
  recebimentos: [
    { meio: 'Dinheiro', valor: 850.00, transacoes: 12, cor: 'text-green', icone: 'banknote' },
    { meio: 'Cartão de crédito', valor: 1890.00, transacoes: 28, cor: 'text-blue', icone: 'credit-card' },
    { meio: 'Cartão de débito', valor: 560.50, transacoes: 9, cor: 'text-purple', icone: 'credit-card' },
    { meio: 'Pix', valor: 1572.00, transacoes: 23, cor: 'text-accent', icone: 'qr-code' }
  ],
  fluxo: [
    { id: 'MOV-081', data: '18/08/2026', tipo: 'entrada', categoria: 'Vendas', descricao: 'Vendas do salão — turno almoço', origem: 'Pedidos', valor: 3120.50, forma: 'Múltiplas formas', status: 'conciliado' },
    { id: 'MOV-082', data: '18/08/2026', tipo: 'entrada', categoria: 'Delivery', descricao: 'Vendas por delivery', origem: 'Pedidos', valor: 1752.00, forma: 'Pix / Cartão', status: 'conciliado' },
    { id: 'MOV-083', data: '18/08/2026', tipo: 'saida', categoria: 'Suprimentos', descricao: 'Compra de hortifruti', origem: 'Fornecedor', valor: 380.00, forma: 'Pix', status: 'conciliado' },
    { id: 'MOV-084', data: '17/08/2026', tipo: 'entrada', categoria: 'Vendas', descricao: 'Vendas do dia anterior', origem: 'Pedidos', valor: 5280.90, forma: 'Múltiplas formas', status: 'conciliado' },
    { id: 'MOV-085', data: '17/08/2026', tipo: 'saida', categoria: 'Pessoal', descricao: 'Adiantamento de equipe', origem: 'Folha', valor: 1200.00, forma: 'Transferência', status: 'conciliado' },
    { id: 'MOV-086', data: '16/08/2026', tipo: 'entrada', categoria: 'Vendas', descricao: 'Vendas do final de semana', origem: 'Pedidos', valor: 6840.30, forma: 'Múltiplas formas', status: 'conciliado' },
    { id: 'MOV-087', data: '15/08/2026', tipo: 'saida', categoria: 'Manutenção', descricao: 'Manutenção preventiva do forno', origem: 'Serviço', valor: 450.00, forma: 'Pix', status: 'conciliado' },
    { id: 'MOV-088', data: '14/08/2026', tipo: 'entrada', categoria: 'Vendas', descricao: 'Vendas do dia', origem: 'Pedidos', valor: 4720.00, forma: 'Múltiplas formas', status: 'conciliado' }
  ],
  contas: [
    { id: 'CP-081', tipo: 'pagar', descricao: 'Hortifruti Verde Vida', categoria: 'Insumos', vencimento: '20/08/2026', valor: 1240.00, status: 'pendente', recorrente: false },
    { id: 'CP-082', tipo: 'pagar', descricao: 'Aluguel do espaço', categoria: 'Estrutura', vencimento: '25/08/2026', valor: 6800.00, status: 'pendente', recorrente: true },
    { id: 'CP-083', tipo: 'pagar', descricao: 'Energia elétrica', categoria: 'Utilidades', vencimento: '28/08/2026', valor: 1420.80, status: 'pendente', recorrente: true },
    { id: 'CP-084', tipo: 'pagar', descricao: 'Distribuidora APEX Bebidas', categoria: 'Bebidas', vencimento: '15/08/2026', valor: 2340.50, status: 'vencida', recorrente: false },
    { id: 'CR-081', tipo: 'receber', descricao: 'Evento corporativo — Grupo Oliveira', categoria: 'Eventos', vencimento: '22/08/2026', valor: 4200.00, status: 'prevista', recorrente: false },
    { id: 'CR-082', tipo: 'receber', descricao: 'Repasse de delivery', categoria: 'Delivery', vencimento: '19/08/2026', valor: 1752.00, status: 'prevista', recorrente: false },
    { id: 'CR-083', tipo: 'receber', descricao: 'Pagamento faturado — Empresa APEX', categoria: 'Corporativo', vencimento: '30/08/2026', valor: 3100.00, status: 'prevista', recorrente: false }
  ],
  relatoriosMensais: [
    { mes: 'Mar', vendas: 38200, despesas: 22400, resultado: 15800 }, { mes: 'Abr', vendas: 41800, despesas: 24300, resultado: 17500 }, { mes: 'Mai', vendas: 45200, despesas: 25100, resultado: 20100 }, { mes: 'Jun', vendas: 47800, despesas: 26800, resultado: 21000 }, { mes: 'Jul', vendas: 51600, despesas: 28200, resultado: 23400 }, { mes: 'Ago', vendas: 28450, despesas: 14320, resultado: 14130 }
  ],
  categorias: [
    { nome: 'Pratos principais', valor: 18642, percentual: 38, cor: 'bg-accent' }, { nome: 'Bebidas', valor: 11205, percentual: 23, cor: 'bg-blue' }, { nome: 'Entradas', valor: 8330, percentual: 17, cor: 'bg-green' }, { nome: 'Sobremesas', valor: 5380, percentual: 11, cor: 'bg-purple' }, { nome: 'Delivery', valor: 4890, percentual: 10, cor: 'bg-yellow' }
  ],
  encaminhamentos: []
};


(() => {
  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa6-caixa';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente dos módulos.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function emPreviewLocal() {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname);
  }

  const estadoFinanceiroVazio = { caixaAtual: {}, recebimentos: [], fluxo: [], contas: [], relatoriosMensais: [], categorias: [], encaminhamentos: [] };
  window.dadosFinanceirosApexFood = emPreviewLocal() ? dadosFinanceirosPreview : estadoFinanceiroVazio;

  function aplicarDadosRemotos(dados) {
    Object.assign(window.dadosFinanceirosApexFood, {
      caixaAtual: dados.caixaAtual || window.dadosFinanceirosApexFood.caixaAtual,
      recebimentos: Array.isArray(dados.recebimentos) ? dados.recebimentos : [],
      fluxo: Array.isArray(dados.fluxo) ? dados.fluxo : [],
      contas: Array.isArray(dados.contas) ? dados.contas : [],
      relatoriosMensais: Array.isArray(dados.relatoriosMensais) ? dados.relatoriosMensais : [],
      categorias: Array.isArray(dados.categorias) ? dados.categorias : [],
      encaminhamentos: Array.isArray(dados.encaminhamentos) ? dados.encaminhamentos : Array.isArray(dados.encaminhamentosCaixa) ? dados.encaminhamentosCaixa : [],
    });
  }

  window.dadosFinanceirosRemotoAtivo = false;
  window.apexFinanceiroRecarregar = (parametros = {}) => carregarCliente()
    .then((api) => api.listarFinanceiro('', parametros))
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      aplicarDadosRemotos(dados);
      window.dadosFinanceirosRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:financeiro-atualizado'));
      return true;
    });
  window.dadosFinanceirosPronto = carregarCliente()
    .then((api) => api.listarFinanceiro())
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      aplicarDadosRemotos(dados);
      window.dadosFinanceirosRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:financeiro-atualizado'));
      return true;
    })
    .catch((erro) => {
      window.dadosFinanceirosErro = erro;
      if (!emPreviewLocal()) {
        Object.assign(window.dadosFinanceirosApexFood, {
          caixaAtual: {},
          recebimentos: [],
          fluxo: [],
          contas: [],
          relatoriosMensais: [],
          categorias: [],
          encaminhamentos: [],
        });
        document.dispatchEvent(new CustomEvent('apex:financeiro-indisponivel'));
      }
      return false;
    });
})();
