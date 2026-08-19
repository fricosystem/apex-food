const produtosPedido = window.dadosPedidosApexFood.produtos;
const estadoNovoPedido = { tipo: 'mesa', categoria: 'todas', carrinho: new Map() };

const elementosNovoPedido = {
  busca: document.getElementById('buscaProduto'),
  catalogo: document.getElementById('catalogoProdutos'),
  categorias: document.getElementById('categoriasProdutos'),
  itens: document.getElementById('itensCarrinho'),
  vazio: document.getElementById('carrinhoVazio'),
  quantidade: document.getElementById('quantidadeItens'),
  subtotal: document.getElementById('subtotalPedido'),
  taxa: document.getElementById('taxaEntrega'),
  total: document.getElementById('totalPedido'),
  identificacao: document.getElementById('resumoIdentificacao')
};

function moedaPedido(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escaparPedido(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function produtoPorId(id) { return produtosPedido.find(produto => produto.id === Number(id)); }

function renderizarCategorias() {
  const todas = [{ id: 'todas', nome: 'Todos', icone: 'layout-grid', cor: 'text-white' }, ...window.dadosPedidosApexFood.categorias];
  elementosNovoPedido.categorias.innerHTML = todas.map(categoria => `<button type="button" class="tab-pedidos ${estadoNovoPedido.categoria === categoria.id ? 'ativa' : ''} flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border border-border2 text-xs font-medium text-muted hover:bg-card2 transition" data-categoria="${categoria.id}"><i data-lucide="${categoria.icone}" class="w-3.5 h-3.5 ${categoria.cor || ''}"></i>${categoria.nome}</button>`).join('');
  elementosNovoPedido.categorias.querySelectorAll('[data-categoria]').forEach(botao => botao.addEventListener('click', () => { estadoNovoPedido.categoria = botao.dataset.categoria; renderizarCategorias(); renderizarCatalogo(); }));
  window.lucide?.createIcons();
}

function produtosVisiveis() {
  const busca = elementosNovoPedido.busca.value.trim().toLocaleLowerCase('pt-BR');
  return produtosPedido.filter(produto => {
    const pertenceCategoria = estadoNovoPedido.categoria === 'todas' || produto.categoria === estadoNovoPedido.categoria;
    const correspondeBusca = !busca || `${produto.nome} ${produto.descricao}`.toLocaleLowerCase('pt-BR').includes(busca);
    return pertenceCategoria && correspondeBusca;
  });
}

function renderizarCatalogo() {
  const produtos = produtosVisiveis();
  if (!produtos.length) {
    elementosNovoPedido.catalogo.innerHTML = `<div class="sm:col-span-2 lg:col-span-3 rounded-lg border border-border2 border-dashed py-10 text-center"><i data-lucide="search-x" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-sm font-medium">Nenhum produto encontrado</p><p class="text-xs text-muted mt-1">Ajuste a busca ou escolha outra categoria.</p></div>`;
    window.lucide?.createIcons();
    return;
  }
  elementosNovoPedido.catalogo.innerHTML = produtos.map(produto => {
    const quantidade = estadoNovoPedido.carrinho.get(produto.id)?.quantidade || 0;
    return `<article class="pedido-card rounded-xl bg-card2 border border-border2 p-4 flex flex-col justify-between"><div><div class="flex items-start justify-between gap-2"><div class="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><i data-lucide="${produto.categoria === 'bebidas' ? 'glass-water' : produto.categoria === 'sobremesas' ? 'cake-slice' : 'utensils-crossed'}" class="w-4 h-4 text-accent"></i></div>${produto.destaque ? '<span class="text-[10px] px-2 py-1 rounded-md bg-yellow/10 text-yellow border border-yellow/20">Destaque</span>' : ''}</div><h4 class="text-sm font-semibold mt-3">${escaparPedido(produto.nome)}</h4><p class="text-xs text-muted leading-relaxed mt-1 min-h-8">${escaparPedido(produto.descricao)}</p></div><div class="flex items-center justify-between gap-3 mt-4"><span class="font-semibold text-accent">${moedaPedido(produto.preco)}</span><button type="button" data-adicionar="${produto.id}" class="btn-press flex items-center gap-1.5 px-3 py-2 rounded-lg ${quantidade ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-card border border-border2 hover:border-accent/50'} text-xs font-medium transition"><i data-lucide="${quantidade ? 'check' : 'plus'}" class="w-3.5 h-3.5"></i>${quantidade ? `${quantidade} no pedido` : 'Adicionar'}</button></div></article>`;
  }).join('');
  elementosNovoPedido.catalogo.querySelectorAll('[data-adicionar]').forEach(botao => botao.addEventListener('click', () => adicionarProduto(Number(botao.dataset.adicionar))));
  window.lucide?.createIcons();
}

function adicionarProduto(id) {
  const produto = produtoPorId(id);
  if (!produto) return;
  const atual = estadoNovoPedido.carrinho.get(id) || { produto, quantidade: 0 };
  atual.quantidade += 1;
  estadoNovoPedido.carrinho.set(id, atual);
  renderizarCatalogo();
  renderizarCarrinho();
}
function alterarQuantidade(id, delta) {
  const atual = estadoNovoPedido.carrinho.get(id);
  if (!atual) return;
  atual.quantidade += delta;
  if (atual.quantidade <= 0) estadoNovoPedido.carrinho.delete(id); else estadoNovoPedido.carrinho.set(id, atual);
  renderizarCatalogo();
  renderizarCarrinho();
}
function renderizarCarrinho() {
  const itens = [...estadoNovoPedido.carrinho.values()];
  const quantidadeTotal = itens.reduce((total, item) => total + item.quantidade, 0);
  const subtotal = itens.reduce((total, item) => total + item.quantidade * item.produto.preco, 0);
  const taxa = estadoNovoPedido.tipo === 'delivery' && itens.length ? 8.90 : 0;
  const total = subtotal + taxa;
  elementosNovoPedido.quantidade.textContent = `${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`;
  elementosNovoPedido.subtotal.textContent = moedaPedido(subtotal);
  elementosNovoPedido.taxa.textContent = moedaPedido(taxa);
  elementosNovoPedido.total.textContent = moedaPedido(total);
  elementosNovoPedido.vazio.classList.toggle('hidden', itens.length > 0);
  elementosNovoPedido.itens.querySelectorAll('[data-linha-item]').forEach(linha => linha.remove());
  itens.forEach(item => {
    const linha = document.createElement('div');
    linha.dataset.linhaItem = 'true';
    linha.className = 'pedido-card rounded-lg bg-card2 border border-border2 p-3';
    linha.innerHTML = `<div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-sm font-medium truncate">${escaparPedido(item.produto.nome)}</div><div class="text-xs text-muted mt-1">${moedaPedido(item.produto.preco)} cada</div></div><strong class="text-sm text-accent whitespace-nowrap">${moedaPedido(item.quantidade * item.produto.preco)}</strong></div><div class="flex items-center justify-between mt-3"><span class="text-[10px] text-muted">Quantidade</span><div class="flex items-center gap-2"><button type="button" data-quantidade="${item.produto.id}" data-delta="-1" class="w-7 h-7 rounded-md bg-card border border-border2 hover:border-accent/50 flex items-center justify-center"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button><span class="w-5 text-center text-sm font-semibold">${item.quantidade}</span><button type="button" data-quantidade="${item.produto.id}" data-delta="1" class="w-7 h-7 rounded-md bg-card border border-border2 hover:border-accent/50 flex items-center justify-center"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button></div></div>`;
    elementosNovoPedido.itens.appendChild(linha);
  });
  elementosNovoPedido.itens.querySelectorAll('[data-quantidade]').forEach(botao => botao.addEventListener('click', () => alterarQuantidade(Number(botao.dataset.quantidade), Number(botao.dataset.delta))));
  atualizarIdentificacao();
  window.lucide?.createIcons();
}

function atualizarIdentificacao() {
  if (estadoNovoPedido.tipo === 'delivery') { elementosNovoPedido.identificacao.textContent = `${document.getElementById('clienteDelivery').value || 'Cliente não informado'} · Delivery`; return; }
  elementosNovoPedido.identificacao.textContent = `${document.getElementById('mesaSelecionada').value} · Salão`;
}

function alternarTipoAtendimento(tipo) {
  estadoNovoPedido.tipo = tipo;
  document.querySelectorAll('.tipo-atendimento').forEach(botao => { const ativo = botao.dataset.tipo === tipo; botao.classList.toggle('ativa', ativo); botao.classList.toggle('text-muted', !ativo); });
  document.getElementById('formularioMesa').classList.toggle('hidden', tipo !== 'mesa');
  document.getElementById('formularioDelivery').classList.toggle('hidden', tipo !== 'delivery');
  renderizarCarrinho();
}

document.querySelectorAll('.tipo-atendimento').forEach(botao => botao.addEventListener('click', () => alternarTipoAtendimento(botao.dataset.tipo)));
elementosNovoPedido.busca.addEventListener('input', renderizarCatalogo);
document.getElementById('mesaSelecionada').addEventListener('change', atualizarIdentificacao);
document.getElementById('clienteDelivery').addEventListener('input', atualizarIdentificacao);
document.getElementById('limparPedido').addEventListener('click', () => { estadoNovoPedido.carrinho.clear(); document.getElementById('observacoesPedido').value = ''; renderizarCatalogo(); renderizarCarrinho(); mostrarAvisoPedido('Pedido limpo.'); });
document.getElementById('confirmarPedido').addEventListener('click', () => { const itens = [...estadoNovoPedido.carrinho.values()]; if (!itens.length) { mostrarAvisoPedido('Adicione pelo menos um produto ao pedido.'); return; } mostrarAvisoPedido(`Pedido criado com ${itens.reduce((sum, item) => sum + item.quantidade, 0)} item(ns).`); });

renderizarCategorias();
renderizarCatalogo();
renderizarCarrinho();
window.lucide?.createIcons();
