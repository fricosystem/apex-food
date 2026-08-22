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
let ingredientesProdutoAtual = [];
let especialidadesNecessariasProdutoAtual = [];
let estacoesNecessariasProdutoAtual = [];

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

function listaCampo(id) {
  return [...new Set(String(document.getElementById(id)?.value || '').split(',').map(item => item.trim()).filter(Boolean))];
}

function normalizarListaProduto(valor) {
  const itens = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : [];
  const vistos = new Set();
  return itens.map(item => String(item || '').replace(/\s+/g, ' ').trim()).filter(item => {
    if (!item) return false;
    const chave = item.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function estadoRequisitoProduto(tipo) { return tipo === 'especialidade' ? { valores: especialidadesNecessariasProdutoAtual, lista: 'listaEspecialidadesNecessariasProduto', vazio: 'especialidadesNecessariasProdutoVazio', rotulo: 'Especialidade', exemplo: 'massas' } : { valores: estacoesNecessariasProdutoAtual, lista: 'listaEstacoesNecessariasProduto', vazio: 'estacoesNecessariasProdutoVazio', rotulo: 'Estação', exemplo: 'forno' }; }

function sincronizarListaRequisitoProduto(tipo) { const estado = estadoRequisitoProduto(tipo); const lista = document.getElementById(estado.lista); if (!lista) return estado.valores; const valores = [...lista.querySelectorAll(`[data-requisito-${tipo}-valor]`)].map(input => input.value); estado.valores.splice(0, estado.valores.length, ...valores); return estado.valores; }
function renderizarListaRequisitoProduto(tipo) {
  const estado = estadoRequisitoProduto(tipo);
  const lista = document.getElementById(estado.lista);
  const vazio = document.getElementById(estado.vazio);
  if (!lista || !vazio) return;
  vazio.classList.toggle('hidden', estado.valores.length > 0);
  lista.innerHTML = estado.valores.map((valor, indice) => `<div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center" data-requisito-${tipo}-linha="${indice}"><input data-requisito-${tipo}-valor="true" list="${tipo === 'especialidade' ? 'opcoesEspecialidadesNecessariasProduto' : 'opcoesEstacoesNecessariasProduto'}" maxlength="80" required placeholder="Ex.: ${estado.exemplo}" value="${escapeProduto(valor)}" class="min-w-0 w-full flex-1 bg-card border border-border2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/60" /><button type="button" data-requisito-${tipo}-remover="${indice}" aria-label="Remover ${estado.rotulo.toLocaleLowerCase('pt-BR')}" class="btn-press w-full shrink-0 whitespace-nowrap rounded-lg border border-border2 px-3 py-2.5 text-[11px] text-muted hover:border-red/50 hover:text-red-200 sm:w-auto">Remover</button></div>`).join('');
  lista.querySelectorAll(`[data-requisito-${tipo}-remover]`).forEach(botao => botao.addEventListener('click', () => { sincronizarListaRequisitoProduto(tipo); estado.valores.splice(Number(botao.dataset[`requisito${tipo[0].toUpperCase()}${tipo.slice(1)}Remover`]), 1); renderizarListaRequisitoProduto(tipo); }));
}

function adicionarRequisitoProduto(tipo) {
  sincronizarListaRequisitoProduto(tipo);
  const estado = estadoRequisitoProduto(tipo);
  estado.valores.push('');
  renderizarListaRequisitoProduto(tipo);
  document.querySelector(`#${estado.lista} [data-requisito-${tipo}-valor]:last-child`)?.focus();
}

function lerListaRequisitoProduto(tipo) {
  const estado = estadoRequisitoProduto(tipo);
  const valores = [...document.querySelectorAll(`#${estado.lista} [data-requisito-${tipo}-valor]`)].map(input => input.value.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const vistos = new Set();
  return valores.filter(valor => { const chave = valor.toLocaleLowerCase('pt-BR'); if (vistos.has(chave)) return false; vistos.add(chave); return true; });
}

function novoIdIngrediente() {
  const sufixo = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID().slice(0, 12) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `ingrediente-${sufixo}`;
}

function normalizarIngredientesProduto(produto) {
  const ingredientes = Array.isArray(produto?.ingredientes) ? produto.ingredientes : [];
  return ingredientes.map((item, indice) => {
    const dados = typeof item === 'string' ? { nome: item } : item && typeof item === 'object' ? item : {};
    return { id: String(dados.id || `ingrediente-${indice + 1}`), nome: String(dados.nome || '').trim(), removivel: dados.removivel !== false };
  }).filter(item => item.nome);
}

function renderizarIngredientesProduto() {
  const lista = document.getElementById('listaIngredientesProduto');
  const vazio = document.getElementById('ingredientesProdutoVazio');
  if (!lista || !vazio) return;
  vazio.classList.toggle('hidden', ingredientesProdutoAtual.length > 0);
  lista.innerHTML = ingredientesProdutoAtual.map((ingrediente, indice) => `<div class="rounded-lg border border-border bg-card p-3" data-ingrediente-linha="${escapeProduto(ingrediente.id)}"><div class="flex flex-col gap-3 sm:flex-row sm:items-end"><label class="flex-1"><span class="block text-[11px] text-muted mb-1.5">Ingrediente ${indice + 1}</span><input data-ingrediente-nome="true" maxlength="120" required value="${escapeProduto(ingrediente.nome)}" placeholder="Ex.: queijo muçarela" class="w-full bg-card2 border border-border2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/60" /></label><label class="flex items-center gap-2 text-[11px] text-muted sm:pb-2.5"><input data-ingrediente-removivel="true" type="checkbox" class="disponibilidade-switch" ${ingrediente.removivel ? 'checked' : ''} />Cliente pode retirar</label><button type="button" data-remover-ingrediente="${escapeProduto(ingrediente.id)}" class="btn-press rounded-lg border border-border2 px-3 py-2.5 text-[11px] font-semibold text-muted hover:border-red/50 hover:text-red-200">Remover</button></div></div>`).join('');
  lista.querySelectorAll('[data-remover-ingrediente]').forEach(botao => botao.addEventListener('click', () => {
    ingredientesProdutoAtual = ingredientesProdutoAtual.filter(item => item.id !== botao.dataset.removerIngrediente);
    renderizarIngredientesProduto();
  }));
  window.lucide?.createIcons();
}

function adicionarIngredienteProduto() {
  ingredientesProdutoAtual.push({ id: novoIdIngrediente(), nome: '', removivel: true });
  renderizarIngredientesProduto();
  const inputs = document.querySelectorAll('#listaIngredientesProduto [data-ingrediente-nome]');
  inputs[inputs.length - 1]?.focus();
}

function lerIngredientesFormulario() {
  return [...document.querySelectorAll('#listaIngredientesProduto [data-ingrediente-linha]')].map(linha => ({
    id: String(linha.dataset.ingredienteLinha || novoIdIngrediente()),
    nome: String(linha.querySelector('[data-ingrediente-nome]')?.value || '').trim(),
    removivel: linha.querySelector('[data-ingrediente-removivel]')?.checked !== false,
  })).filter(item => item.nome);
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
  especialidadesNecessariasProdutoAtual = normalizarListaProduto(produto?.especialidadesNecessarias);
  estacoesNecessariasProdutoAtual = normalizarListaProduto(produto?.estacoesNecessarias);
  renderizarListaRequisitoProduto('especialidade');
  renderizarListaRequisitoProduto('estacao');
  ingredientesProdutoAtual = normalizarIngredientesProduto(produto);
  document.getElementById('disponibilidadeNovoProduto').checked = produto ? produto.disponibilidade : true;
  renderizarIngredientesProduto();
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
  ingredientesProdutoAtual = [];
  especialidadesNecessariasProdutoAtual = [];
  estacoesNecessariasProdutoAtual = [];
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
    especialidadesNecessarias: lerListaRequisitoProduto('especialidade'),
    estacoesNecessarias: lerListaRequisitoProduto('estacao'),
    ingredientes: lerIngredientesFormulario(),
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
document.getElementById('adicionarIngredienteProduto').addEventListener('click', adicionarIngredienteProduto);
document.getElementById('adicionarEspecialidadeNecessariaProduto').addEventListener('click', () => adicionarRequisitoProduto('especialidade'));
document.getElementById('adicionarEstacaoNecessariaProduto').addEventListener('click', () => adicionarRequisitoProduto('estacao'));
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
