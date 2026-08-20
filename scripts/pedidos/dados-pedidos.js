const dadosPedidosPreview = {
  categorias: [
    { id: 'entradas', nome: 'Entradas', icone: 'salad', cor: 'text-green' },
    { id: 'principais', nome: 'Pratos Principais', icone: 'chef-hat', cor: 'text-accent' },
    { id: 'hamburgueres', nome: 'Hambúrgueres', icone: 'sandwich', cor: 'text-yellow' },
    { id: 'bebidas', nome: 'Bebidas', icone: 'glass-water', cor: 'text-blue' },
    { id: 'sobremesas', nome: 'Sobremesas', icone: 'cake-slice', cor: 'text-purple' }
  ],
  produtos: [
    { id: 1, nome: 'Pizza Margherita', descricao: 'Molho de tomate, muçarela, manjericão e azeite.', categoria: 'principais', preco: 59.90, destaque: true },
    { id: 2, nome: 'Filé Mignon', descricao: 'Filé grelhado, molho da casa e acompanhamento.', categoria: 'principais', preco: 69.00, destaque: true },
    { id: 3, nome: 'Risoto de Camarão', descricao: 'Arroz arbóreo, camarões salteados e parmesão.', categoria: 'principais', preco: 49.00, destaque: true },
    { id: 4, nome: 'Hambúrguer Artesanal', descricao: 'Blend da casa, queijo, salada e molho especial.', categoria: 'hamburgueres', preco: 42.90, destaque: false },
    { id: 5, nome: 'Salada Caesar', descricao: 'Alface romana, croutons, parmesão e molho Caesar.', categoria: 'entradas', preco: 32.90, destaque: false },
    { id: 6, nome: 'Porção de Fritas', descricao: 'Batatas crocantes com maionese temperada.', categoria: 'entradas', preco: 29.90, destaque: false },
    { id: 7, nome: 'Suco de Laranja', descricao: 'Suco natural servido gelado.', categoria: 'bebidas', preco: 9.00, destaque: false },
    { id: 8, nome: 'Coca-Cola 1L', descricao: 'Refrigerante Coca-Cola 1 litro.', categoria: 'bebidas', preco: 12.90, destaque: false },
    { id: 9, nome: 'Água Mineral', descricao: 'Água mineral sem gás 500 ml.', categoria: 'bebidas', preco: 4.00, destaque: false },
    { id: 10, nome: 'Tiramisù', descricao: 'Sobremesa italiana com café e mascarpone.', categoria: 'sobremesas', preco: 21.00, destaque: true },
    { id: 11, nome: 'Pudim da Casa', descricao: 'Pudim cremoso com calda de caramelo.', categoria: 'sobremesas', preco: 18.90, destaque: false },
    { id: 12, nome: 'Chopp', descricao: 'Chopp claro servido na temperatura ideal.', categoria: 'bebidas', preco: 12.00, destaque: false }
  ],
  pedidosAtivos: [
    {
      id: '#PED-4521', mesa: 'Mesa 07', cliente: 'Carlos Silva', canal: 'salão', status: 'pronto', statusLabel: 'Pronto',
      prioridade: 'normal', garcom: 'João Mendes', horario: '14:32', tempo: '18 min', valor: 156.80,
      observacoes: 'Enviar a conta separada por pessoa.',
      itens: [{ nome: 'Pizza Margherita', quantidade: 1, valor: 59.90 }, { nome: 'Coca-Cola 1L', quantidade: 1, valor: 12.90 }, { nome: 'Água Mineral', quantidade: 2, valor: 8.00 }]
    },
    {
      id: '#PED-4522', mesa: 'Delivery', cliente: 'Ana Costa', canal: 'delivery', status: 'preparo', statusLabel: 'Em preparo',
      prioridade: 'alta', garcom: 'Delivery', horario: '14:45', tempo: '12 min', valor: 89.50,
      observacoes: 'Entregar sem cebola.',
      itens: [{ nome: 'Hambúrguer Artesanal', quantidade: 1, valor: 42.90 }, { nome: 'Porção de Fritas', quantidade: 1, valor: 29.90 }, { nome: 'Coca-Cola 1L', quantidade: 1, valor: 12.90 }]
    },
    {
      id: '#PED-4523', mesa: 'Mesa 03', cliente: 'João Santos', canal: 'salão', status: 'novo', statusLabel: 'Novo',
      prioridade: 'alta', garcom: 'Maria Oliveira', horario: '15:02', tempo: '4 min', valor: 234.70,
      observacoes: 'Pratos principais devem sair juntos.',
      itens: [{ nome: 'Filé Mignon', quantidade: 2, valor: 138.00 }, { nome: 'Salada Caesar', quantidade: 1, valor: 32.90 }, { nome: 'Suco de Laranja', quantidade: 3, valor: 27.00 }]
    },
    {
      id: '#PED-4524', mesa: 'Mesa 12', cliente: 'Juliana Alves', canal: 'salão', status: 'preparo', statusLabel: 'Em preparo',
      prioridade: 'normal', garcom: 'Pedro Santos', horario: '15:10', tempo: '6 min', valor: 67.30,
      observacoes: 'Atender com agilidade.',
      itens: [{ nome: 'Porção de Fritas', quantidade: 1, valor: 29.90 }, { nome: 'Chopp', quantidade: 2, valor: 24.00 }]
    },
    {
      id: '#PED-4525', mesa: 'Mesa 16', cliente: 'Camila Rocha', canal: 'salão', status: 'novo', statusLabel: 'Novo',
      prioridade: 'normal', garcom: 'Maria Oliveira', horario: '15:16', tempo: '2 min', valor: 125.90,
      observacoes: 'Opção sem lactose solicitada.',
      itens: [{ nome: 'Macarrão à Bolonhesa', quantidade: 1, valor: 49.90 }, { nome: 'Coca-Cola 2L', quantidade: 1, valor: 14.90 }]
    },
    {
      id: '#PED-4526', mesa: 'Mesa 09', cliente: 'Marcos Oliveira', canal: 'salão', status: 'pronto', statusLabel: 'Pronto',
      prioridade: 'normal', garcom: 'João Mendes', horario: '15:20', tempo: '22 min', valor: 198.20,
      observacoes: 'Aguardando retirada pelo garçom.',
      itens: [{ nome: 'Moqueca', quantidade: 1, valor: 98.00 }, { nome: 'Arroz branco', quantidade: 2, valor: 18.00 }, { nome: 'Farofa da casa', quantidade: 1, valor: 16.90 }]
    }
  ],
  pedidosHistorico: [
    { id: '#PED-4517', data: '18/08/2026', cliente: 'Fernanda Souza', mesa: 'Mesa 07', canal: 'salão', horario: '13:00', valor: 312.00, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Cartão de crédito', garcom: 'João Mendes', itens: 4 },
    { id: '#PED-4518', data: '18/08/2026', cliente: 'Roberto Lima', mesa: 'Mesa 06', canal: 'salão', horario: '12:10', valor: 89.50, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Pix', garcom: 'Pedro Santos', itens: 3 },
    { id: '#PED-4519', data: '18/08/2026', cliente: 'Mariana Alves', mesa: 'Delivery', canal: 'delivery', horario: '12:22', valor: 145.80, status: 'cancelado', statusLabel: 'Cancelado', pagamento: 'Não realizado', garcom: 'Delivery', itens: 4 },
    { id: '#PED-4520', data: '18/08/2026', cliente: 'Paulo Mendes', mesa: 'Mesa 14', canal: 'salão', horario: '12:40', valor: 275.40, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Cartão de débito', garcom: 'João Mendes', itens: 3 },
    { id: '#PED-4511', data: '17/08/2026', cliente: 'Ana Costa', mesa: 'Delivery', canal: 'delivery', horario: '21:18', valor: 89.50, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Pix', garcom: 'Delivery', itens: 3 },
    { id: '#PED-4512', data: '17/08/2026', cliente: 'João Santos', mesa: 'Mesa 03', canal: 'salão', horario: '20:45', valor: 234.70, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Cartão de crédito', garcom: 'Maria Oliveira', itens: 3 },
    { id: '#PED-4513', data: '17/08/2026', cliente: 'Carla Ferreira', mesa: 'Mesa 10', canal: 'salão', horario: '20:12', valor: 118.90, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Dinheiro', garcom: 'Pedro Santos', itens: 2 },
    { id: '#PED-4514', data: '17/08/2026', cliente: 'Grupo Oliveira', mesa: 'Mesa 17', canal: 'salão', horario: '19:50', valor: 420.00, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Cartão de crédito', garcom: 'João Mendes', itens: 7 },
    { id: '#PED-4509', data: '16/08/2026', cliente: 'Lucas Martins', mesa: 'Mesa 10', canal: 'salão', horario: '19:30', valor: 156.00, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Pix', garcom: 'Maria Oliveira', itens: 4 },
    { id: '#PED-4508', data: '16/08/2026', cliente: 'Beatriz Ramos', mesa: 'Mesa 04', canal: 'salão', horario: '18:40', valor: 198.30, status: 'finalizado', statusLabel: 'Finalizado', pagamento: 'Cartão de crédito', garcom: 'Pedro Santos', itens: 4 }
  ],
  status: {
    novo: { label: 'Novo', classe: 'bg-blue/10 text-blue border-blue/30', dot: 'bg-blue' },
    rascunho: { label: 'Rascunho', classe: 'bg-card2 text-muted border-border2', dot: 'bg-muted' },
    aguardando_confirmacao_garcom: { label: 'Aguardando confirmação', classe: 'bg-blue/10 text-blue border-blue/30', dot: 'bg-blue' },
    confirmado_garcom: { label: 'Confirmado pelo garçom', classe: 'bg-purple/10 text-purpleLight border-purple/30', dot: 'bg-purple' },
    enviado_cozinha: { label: 'Enviado à cozinha', classe: 'bg-blue/10 text-blue border-blue/30', dot: 'bg-blue' },
    em_preparo: { label: 'Em preparo', classe: 'bg-yellow/10 text-yellow border-yellow/30', dot: 'bg-yellow' },
    preparo: { label: 'Em preparo', classe: 'bg-yellow/10 text-yellow border-yellow/30', dot: 'bg-yellow' },
    pronto: { label: 'Pronto', classe: 'bg-green/10 text-green border-green/30', dot: 'bg-green' },
    servido: { label: 'Servido', classe: 'bg-green/10 text-green border-green/30', dot: 'bg-green' },
    rejeitado_garcom: { label: 'Rejeitado pelo garçom', classe: 'bg-red/10 text-red border-red/30', dot: 'bg-red' },
    finalizado: { label: 'Finalizado', classe: 'bg-green/10 text-green border-green/30', dot: 'bg-green' },
    cancelado: { label: 'Cancelado', classe: 'bg-red/10 text-red border-red/30', dot: 'bg-red' }
  }
};

const ambientePedidosLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const estadoPedidosVazio = {
  categorias: [],
  produtos: [],
  pedidosAtivos: [],
  pedidosHistorico: [],
  status: dadosPedidosPreview.status,
};
window.dadosPedidosApexFood = ambientePedidosLocal ? dadosPedidosPreview : estadoPedidosVazio;
window.dadosPedidosRemotoAtivo = false;

function paraReais(centavos) {
  return Number(centavos || 0) / 100;
}

function formatarDataPedido(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR');
}

function formatarHorarioPedido(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function tempoPedido(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  const minutos = Math.max(0, Math.round((Date.now() - data.getTime()) / 60000));
  return `${minutos} min`;
}

function adaptarProdutoPedido(produto) {
  return {
    ...produto,
    id: String(produto.id),
    categoria: produto.categoria || produto.idCategoria || '',
    preco: paraReais(produto.precoCentavos),
    custo: paraReais(produto.custoCentavos),
    estoque: Number(produto.estoque || 0),
    disponibilidade: produto.disponibilidade !== false,
    destaque: produto.destaque === true,
  };
}

function adaptarPedidoReal(pedido) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens.map(item => ({
    ...item,
    nome: item.nome || item.nomeProduto || item.idProduto,
    quantidade: Number(item.quantidade || 0),
    valor: paraReais(item.subtotalCentavos || item.precoUnitarioCentavos),
  })) : [];
  const status = pedido.statusPedido || pedido.status || 'novo';
  return {
    ...pedido,
    id: String(pedido.id),
    mesa: pedido.nomeMesa || pedido.idMesa || '—',
    cliente: pedido.nomeCliente || 'Cliente não informado',
    canal: pedido.canal || (pedido.tipoAtendimento === 'delivery' ? 'delivery' : 'salão'),
    status,
    estadoComanda: pedido.estadoComanda || pedido.statusComanda || null,
    statusLabel: dadosPedidosPreview.status[status]?.label || status,
    prioridade: pedido.prioridade || 'normal',
    garcom: pedido.nomeGarcom || '—',
    data: formatarDataPedido(pedido.criadoEm),
    horario: formatarHorarioPedido(pedido.criadoEm),
    tempo: tempoPedido(pedido.criadoEm),
    valor: paraReais(pedido.valorCentavos),
    pagamento: pedido.pagamento?.metodo || pedido.pagamento?.forma || pedido.formaPagamento || 'Não informado',
    itensQuantidade: itens.reduce((total, item) => total + item.quantidade, 0),
    observacoes: pedido.observacoes || '',
    itens,
  };
}

function substituirLista(destino, itens) {
  destino.splice(0, destino.length, ...itens);
}

async function carregarPedidosReais() {
  if (ambientePedidosLocal || !window.apexModulosApi?.listarPedidos) return;
  try {
    const [pedidosResposta, cardapioResposta, salaoResposta, equipeResposta] = await Promise.all([
      window.apexModulosApi.listarPedidos({ limite: 300 }),
      window.apexModulosApi.listarCardapio(),
      window.apexModulosApi.listarSalao('mesas'),
      window.apexModulosApi.listarEquipe('funcionarios'),
    ]);
    const pedidos = Array.isArray(pedidosResposta?.pedidos) ? pedidosResposta.pedidos.map(adaptarPedidoReal) : [];
    const cardapioCategorias = Array.isArray(cardapioResposta?.categorias) ? cardapioResposta.categorias : [];
    const cardapioProdutos = Array.isArray(cardapioResposta?.produtos) ? cardapioResposta.produtos.filter(item => item.disponibilidade !== false).map(adaptarProdutoPedido) : [];
    const dados = window.dadosPedidosApexFood;
    substituirLista(dados.categorias, cardapioCategorias);
    substituirLista(dados.produtos, cardapioProdutos);
    const pedidosDaComandaEncerrados = item => ['encaminhada_caixa', 'encerrada'].includes(item.estadoComanda);
    substituirLista(dados.pedidosAtivos, pedidos.filter(item => ['novo', 'rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'preparo', 'em_preparo', 'pronto', 'servido'].includes(item.status) && !pedidosDaComandaEncerrados(item)));
    substituirLista(dados.pedidosHistorico, pedidos.filter(item => ['entregue', 'finalizado', 'rejeitado_garcom', 'cancelado'].includes(item.status) || (item.status === 'servido' && pedidosDaComandaEncerrados(item))));
    dados.mesas = Array.isArray(salaoResposta?.mesas) ? salaoResposta.mesas : [];
    dados.funcionarios = Array.isArray(equipeResposta?.funcionarios) ? equipeResposta.funcionarios : [];
    window.dadosPedidosRemotoAtivo = true;
  } catch (erro) {
    substituirLista(window.dadosPedidosApexFood.categorias, []);
    substituirLista(window.dadosPedidosApexFood.produtos, []);
    substituirLista(window.dadosPedidosApexFood.pedidosAtivos, []);
    substituirLista(window.dadosPedidosApexFood.pedidosHistorico, []);
    window.dadosPedidosRemotoAtivo = false;
    window.dadosPedidosErro = erro;
  }
  document.dispatchEvent(new CustomEvent('apex:pedidos-atualizado'));
}

window.recarregarPedidosReais = carregarPedidosReais;
window.dadosPedidosPronto = carregarPedidosReais();
