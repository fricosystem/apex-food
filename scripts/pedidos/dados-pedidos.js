const statusPedidos = {
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
};

const estadoPedidosVazio = {
  categorias: [],
  produtos: [],
  pedidosAtivos: [],
  pedidosHistorico: [],
  status: statusPedidos,
};
window.dadosPedidosApexFood = estadoPedidosVazio;
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
    statusLabel: statusPedidos[status]?.label || status,
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
  if (!window.apexModulosApi?.listarPedidos) return;
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
