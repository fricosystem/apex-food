'use strict';

const produtosCardapio = () => window.dadosCardapioApexFood?.produtos || [];
const categoriasProduto = () => window.dadosCardapioApexFood?.categorias || [];
const elementosProdutos = {
  busca: document.getElementById('buscaProdutoCardapio'),
  categoria: document.getElementById('filtroCategoriaProduto'),
  disponibilidade: document.getElementById('filtroDisponibilidade'),
  tabela: document.getElementById('tabelaProdutos'),
  vazio: document.getElementById('estadoVazioProdutos'),
};
let produtoEditandoId = null;

function moedaProduto(valor) {
  return window.ferramentasInterfaceApexFood?.formatarMoeda
    ? window.ferramentasInterfaceApexFood.formatarMoeda(valor)
    : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeProduto(valor) {
  return window.ferramentasInterfaceApexFood?.escaparHtml
    ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
    : String(valor ?? '');
}

function numeroCampo(id, padrao = 0) {
  const valor = Number(document.getElementById(id)?.value);
  return Number.isFinite(valor) && valor >= 0 ? valor : padrao;
}

function preencherCategoriasProduto() {
  const options = categoriasProduto()
    .map(categoria => `<option value="${escapeProduto(categoria.id)}">${escapeProduto(categoria.nome)}</option>`)
    .join('');
  elementosProdutos.categoria.innerHTML = `<option value="todas">Todas as categorias</option>${options}`;
  document.getElementById('categoriaNovoProduto').innerHTML = options;
}

function produtosVisiveis() {
  const termo = elementosProdutos.busca.value.trim().toLocaleLowerCase('pt-BR');
  const categoria = elementosProdutos.categoria.value;
  const disponibilidade = elementosProdutos.disponibilidade.value;
  return produtosCardapio().filter(produto => {
    const texto = `${produto.nome} ${produto.codigo} ${produto.descricao}`.toLocaleLowerCase('pt-BR');
    const estoqueBaixo = produto.estoque <= 10;
    return (!termo || texto.includes(termo))
      && (categoria === 'todas' || produto.categoria === categoria)
      && (disponibilidade === 'todos'
        || (disponibilidade === 'disponiveis' && produto.disponibilidade)
        || (disponibilidade === 'indisponiveis' && !produto.disponibilidade)
        || (disponibilidade === 'estoque-baixo' && estoqueBaixo));
  });
}

function atualizarIndicadoresProdutos() {
  const produtos = produtosCardapio();
  document.getElementById('totalProdutos').textContent = produtos.length;
  document.getElementById('totalDisponiveis').textContent = produtos.filter(produto => produto.disponibilidade).length;
  document.getElementById('totalEstoqueBaixo').textContent = produtos.filter(produto => produto.estoque <= 10).length;
  const media = produtos.reduce((sum, produto) => sum + produto.preco, 0) / Math.max(produtos.length, 1);
  document.getElementById('precoMedio').textContent = moedaProduto(media);
}

function renderizarProdutos() {
  const lista = produtosVisiveis();
  document.getElementById('resultadoProdutos').textContent = `${lista.length} ${lista.length === 1 ? 'produto encontrado' : 'produtos encontrados'}.`;
  elementosProdutos.tabela.innerHTML = lista.map(produto => {
    const categoria = categoriasProduto().find(item => item.id === produto.categoria);
    const estoqueBaixo = produto.estoque <= 10;
    return `<tr class="border-b border-border hover:bg-card2/50 transition"><td class="p-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"><i data-lucide="${escapeProduto(categoria?.icone || 'package')}" class="w-4 h-4 text-accent"></i></div><div class="min-w-0"><div class="font-medium truncate">${escapeProduto(produto.nome)}</div><div class="text-[10px] text-muted mt-1">${escapeProduto(produto.codigo)}</div></div></div></td><td class="p-4 text-xs text-muted">${escapeProduto(categoria?.nome || '—')}</td><td class="p-4 font-semibold text-accent">${moedaProduto(produto.preco)}</td><td class="p-4 text-xs text-muted">${moedaProduto(produto.custo)}</td><td class="p-4 text-xs">${produto.tempoPreparo} min</td><td class="p-4"><span class="flex items-center gap-2 text-xs ${estoqueBaixo ? 'text-yellow' : 'text-muted'}"><span class="w-1.5 h-1.5 rounded-full ${estoqueBaixo ? 'bg-yellow' : 'bg-green'}"></span>${produto.estoque} ${escapeProduto(produto.unidade)}</span></td><td class="p-4"><div class="flex items-center gap-2"><input type="checkbox" class="disponibilidade-switch" data-disponibilidade="${escapeProduto(produto.id)}" ${produto.disponibilidade ? 'checked' : ''} aria-label="Alternar disponibilidade de ${escapeProduto(produto.nome)}"><span class="text-xs ${produto.disponibilidade ? 'text-green' : 'text-muted'}">${produto.disponibilidade ? 'Disponível' : 'Indisponível'}</span></div></td><td class="p-4"><button type="button" data-editar-produto="${escapeProduto(produto.id)}" class="p-2 rounded-lg hover:bg-card2 text-muted" aria-label="Editar ${escapeProduto(produto.nome)}"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button></td></tr>`;
  }).join('');
  elementosProdutos.vazio.classList.toggle('hidden', lista.length > 0);
  elementosProdutos.tabela.parentElement.classList.toggle('hidden', lista.length === 0);
  elementosProdutos.tabela.querySelectorAll('[data-disponibilidade]').forEach(input => input.addEventListener('change', async () => {
    const produto = produtosCardapio().find(item => String(item.id) === String(input.dataset.disponibilidade));
    if (!produto) return;
    const anterior = produto.disponibilidade;
    produto.disponibilidade = input.checked;
    let persistiu = false;
    if (window.dadosCardapioRemotoAtivo && window.apexModulosApi) {
      try {
        await window.apexModulosApi.atualizarCardapio({ recurso: 'produto', id: String(produto.id), disponibilidade: input.checked });
        persistiu = true;
      } catch (erro) {
        produto.disponibilidade = anterior;
        input.checked = anterior;
        mostrarAvisoPedido(erro.message || 'Não foi possível atualizar a disponibilidade.');
      }
    }
    atualizarIndicadoresProdutos();
    renderizarProdutos();
    if (persistiu) mostrarAvisoPedido(`${produto.nome}: ${produto.disponibilidade ? 'disponível' : 'indisponível'}.`);
  }));
  elementosProdutos.tabela.querySelectorAll('[data-editar-produto]').forEach(botao => botao.addEventListener('click', () => {
    const produto = produtosCardapio().find(item => String(item.id) === String(botao.dataset.editarProduto));
    if (produto) abrirModalProduto(produto);
  }));
  window.lucide?.createIcons();
}

function preencherFormularioProduto(produto) {
  document.getElementById('tituloModalProduto').textContent = produto ? 'Editar produto' : 'Novo produto';
  document.querySelector('#formProduto button[type="submit"]').textContent = produto ? 'Salvar alterações' : 'Salvar produto';
  document.getElementById('nomeProduto').value = produto?.nome || '';
  document.getElementById('categoriaNovoProduto').value = produto?.categoria || '';
  document.getElementById('precoNovoProduto').value = produto ? produto.preco : '';
  document.getElementById('custoNovoProduto').value = produto ? produto.custo : '';
  document.getElementById('descricaoNovoProduto').value = produto?.descricao || '';
  document.getElementById('estoqueNovoProduto').value = produto ? produto.estoque : '';
  document.getElementById('unidadeNovoProduto').value = produto?.unidade || 'unidade';
  document.getElementById('tempoPreparoNovoProduto').value = produto ? produto.tempoPreparo : '';
  document.getElementById('disponibilidadeNovoProduto').checked = produto ? produto.disponibilidade : true;
}

function abrirModalProduto(produto = null) {
  produtoEditandoId = produto?.id ? String(produto.id) : null;
  preencherFormularioProduto(produto);
  const modal = document.getElementById('modalProduto');
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('nomeProduto').focus();
}

function fecharModalProduto() {
  const modal = document.getElementById('modalProduto');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('formProduto').reset();
  produtoEditandoId = null;
  preencherFormularioProduto(null);
}

async function salvarProduto(event) {
  event.preventDefault();
  const nome = document.getElementById('nomeProduto').value.trim();
  const idCategoria = document.getElementById('categoriaNovoProduto').value;
  const preco = Number(document.getElementById('precoNovoProduto').value);
  if (!nome || !idCategoria || !Number.isFinite(preco) || preco <= 0) {
    mostrarAvisoPedido('Informe nome, categoria e preço de venda válido.');
    return;
  }
  const payload = {
    recurso: 'produto',
    nome,
    idCategoria,
    precoCentavos: Math.round(preco * 100),
    custoCentavos: Math.round(numeroCampo('custoNovoProduto') * 100),
    estoque: Math.round(numeroCampo('estoqueNovoProduto')),
    unidade: document.getElementById('unidadeNovoProduto').value.trim() || 'unidade',
    tempoPreparo: Math.round(numeroCampo('tempoPreparoNovoProduto')),
    descricao: document.getElementById('descricaoNovoProduto').value.trim(),
    disponibilidade: document.getElementById('disponibilidadeNovoProduto').checked,
  };
  if (!window.dadosCardapioRemotoAtivo || !window.apexModulosApi) {
    mostrarAvisoPedido('Não foi possível conectar ao Cardápio real. Tente novamente.');
    return;
  }
  try {
    if (produtoEditandoId) {
      await window.apexModulosApi.atualizarCardapio({ ...payload, id: produtoEditandoId });
      const produto = produtosCardapio().find(item => String(item.id) === produtoEditandoId);
      if (produto) Object.assign(produto, { ...payload, id: produtoEditandoId, categoria: idCategoria, preco, custo: payload.custoCentavos / 100 });
      mostrarAvisoPedido('Produto atualizado no Cardápio.');
    } else {
      const resposta = await window.apexModulosApi.criarCardapio(payload);
      produtosCardapio().push({ ...payload, id: String(resposta.id), categoria: idCategoria, codigo: `PRD-${String(resposta.id).slice(0, 8)}`, preco, custo: payload.custoCentavos / 100, estoque: payload.estoque, unidade: payload.unidade, tempoPreparo: payload.tempoPreparo });
      mostrarAvisoPedido('Produto salvo no Cardápio.');
    }
    fecharModalProduto();
    atualizarIndicadoresProdutos();
    renderizarProdutos();
  } catch (erro) {
    mostrarAvisoPedido(erro.message || 'Não foi possível salvar o produto.');
  }
}

function exportarProdutos() {
  const linhas = [['Código', 'Produto', 'Categoria', 'Preço', 'Custo', 'Estoque', 'Unidade', 'Disponibilidade']];
  produtosVisiveis().forEach(produto => {
    const categoria = categoriasProduto().find(item => item.id === produto.categoria);
    linhas.push([produto.codigo, produto.nome, categoria?.nome || '', produto.preco.toFixed(2), produto.custo.toFixed(2), produto.estoque, produto.unidade, produto.disponibilidade ? 'Disponível' : 'Indisponível']);
  });
  const csv = linhas.map(linha => linha.map(valor => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'produtos-cardapio.csv';
  link.click();
  URL.revokeObjectURL(url);
}

elementosProdutos.busca.addEventListener('input', renderizarProdutos);
elementosProdutos.categoria.addEventListener('change', renderizarProdutos);
elementosProdutos.disponibilidade.addEventListener('change', renderizarProdutos);
document.getElementById('novoProduto').addEventListener('click', () => abrirModalProduto());
document.getElementById('fecharModalProduto').addEventListener('click', fecharModalProduto);
document.getElementById('cancelarProduto').addEventListener('click', fecharModalProduto);
document.getElementById('backdropProduto').addEventListener('click', fecharModalProduto);
document.getElementById('exportarProdutos').addEventListener('click', exportarProdutos);
document.getElementById('formProduto').addEventListener('submit', salvarProduto);
document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalProduto(); });

function atualizarProdutosRemotos() {
  preencherCategoriasProduto();
  atualizarIndicadoresProdutos();
  renderizarProdutos();
}

preencherCategoriasProduto();
atualizarIndicadoresProdutos();
renderizarProdutos();
window.lucide?.createIcons();
document.addEventListener('apex:cardapio-atualizado', atualizarProdutosRemotos);
