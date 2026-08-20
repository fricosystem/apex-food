'use strict';

const categoriasCardapio = () => window.dadosCardapioApexFood?.categorias || [];
const elementosCategorias = {
  busca: document.getElementById('buscaCategoria'),
  lista: document.getElementById('listaCategorias'),
  sincronizacao: document.getElementById('ultimaAtualizacaoCategorias'),
};
const coresCategorias = { green: 'text-green', orange: 'text-accent', yellow: 'text-yellow', blue: 'text-blue', purple: 'text-purple' };
let categoriaEditandoId = null;

function escapeCategoria(valor) {
  return window.ferramentasInterfaceApexFood?.escaparHtml
    ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
    : String(valor ?? '');
}

function categoriasVisiveis() {
  const termo = elementosCategorias.busca.value.trim().toLocaleLowerCase('pt-BR');
  return categoriasCardapio().filter(categoria => `${categoria.nome} ${categoria.descricao}`.toLocaleLowerCase('pt-BR').includes(termo));
}

function renderizarCategorias() {
  const lista = categoriasVisiveis();
  const categorias = categoriasCardapio();
  document.getElementById('totalCategorias').textContent = categorias.length;
  document.getElementById('totalProdutosCategoria').textContent = categorias.reduce((total, categoria) => total + Number(categoria.produtos || 0), 0);
  document.getElementById('categoriaDestaque').textContent = categorias.length
    ? (categorias.reduce((maior, categoria) => categoria.produtos > maior.produtos ? categoria : maior, categorias[0]) || { nome: '—' }).nome
    : '—';
  elementosCategorias.sincronizacao.textContent = window.dadosCardapioRemotoAtivo ? 'Sincronizado' : 'Aguardando dados';
  document.getElementById('resultadoCategorias').textContent = `${lista.length} ${lista.length === 1 ? 'categoria encontrada' : 'categorias encontradas'}.`;
  elementosCategorias.lista.innerHTML = lista.length
    ? lista.map(categoria => `<article class="cardapio-card rounded-xl bg-card2 border border-border2 p-5"><div class="flex items-start justify-between gap-3"><div class="cardapio-icon w-11 h-11 rounded-xl bg-${escapeCategoria(categoria.cor || 'orange')}/10 flex items-center justify-center"><i data-lucide="${escapeCategoria(categoria.icone || 'utensils')}" class="w-5 h-5 ${coresCategorias[categoria.cor] || 'text-accent'}"></i></div><button type="button" data-editar-categoria="${escapeCategoria(categoria.id)}" class="p-2 rounded-lg hover:bg-card text-muted" aria-label="Editar ${escapeCategoria(categoria.nome)}"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button></div><h4 class="text-base font-semibold mt-4">${escapeCategoria(categoria.nome)}</h4><p class="text-xs text-muted leading-relaxed mt-1 min-h-8">${escapeCategoria(categoria.descricao)}</p><div class="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border"><span class="text-xs text-muted"><strong class="text-white">${Number(categoria.produtos || 0)}</strong> ${Number(categoria.produtos || 0) === 1 ? 'produto' : 'produtos'}</span><span class="flex items-center gap-1.5 text-xs text-green"><span class="w-1.5 h-1.5 rounded-full bg-green"></span> Ativa</span></div><div class="mt-3 text-[10px] text-muted">Destaque: <span class="text-white">${escapeCategoria(categoria.destaque || '—')}</span></div></article>`).join('')
    : `<div class="sm:col-span-2 xl:col-span-3 rounded-lg border border-border2 border-dashed py-12 text-center"><i data-lucide="search-x" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-sm font-medium">Nenhuma categoria real encontrada</p><p class="text-xs text-muted mt-1">Crie uma categoria ou ajuste o termo da busca.</p></div>`;
  elementosCategorias.lista.querySelectorAll('[data-editar-categoria]').forEach(botao => botao.addEventListener('click', () => {
    const categoria = categoriasCardapio().find(item => String(item.id) === String(botao.dataset.editarCategoria));
    if (categoria) abrirModalCategoria(categoria);
  }));
  window.lucide?.createIcons();
}

function preencherFormularioCategoria(categoria) {
  document.getElementById('tituloModalCategoria').textContent = categoria ? 'Editar categoria' : 'Nova categoria';
  document.querySelector('#formCategoria button[type="submit"]').textContent = categoria ? 'Salvar alterações' : 'Salvar categoria';
  document.getElementById('nomeCategoria').value = categoria?.nome || '';
  document.getElementById('descricaoCategoria').value = categoria?.descricao || '';
}

function abrirModalCategoria(categoria = null) {
  categoriaEditandoId = categoria?.id ? String(categoria.id) : null;
  preencherFormularioCategoria(categoria);
  const modal = document.getElementById('modalCategoria');
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('nomeCategoria').focus();
}

function fecharModalCategoria() {
  const modal = document.getElementById('modalCategoria');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('formCategoria').reset();
  categoriaEditandoId = null;
  preencherFormularioCategoria(null);
}

async function salvarCategoria(event) {
  event.preventDefault();
  const nome = document.getElementById('nomeCategoria').value.trim();
  const descricao = document.getElementById('descricaoCategoria').value.trim();
  if (!nome) {
    mostrarAvisoPedido('Informe o nome da categoria.');
    return;
  }
  if (!window.dadosCardapioRemotoAtivo || !window.apexModulosApi) {
    mostrarAvisoPedido('Não foi possível conectar ao Cardápio real. Tente novamente.');
    return;
  }
  try {
    if (categoriaEditandoId) {
      const categoria = categoriasCardapio().find(item => String(item.id) === categoriaEditandoId);
      await window.apexModulosApi.atualizarCardapio({ recurso: 'categoria', id: categoriaEditandoId, nome, descricao, icone: categoria?.icone || 'utensils', cor: categoria?.cor || 'orange', ordem: categoria?.ordem || 0 });
      if (categoria) Object.assign(categoria, { nome, descricao });
      mostrarAvisoPedido('Categoria atualizada no Cardápio.');
    } else {
      const resposta = await window.apexModulosApi.criarCardapio({ recurso: 'categoria', nome, descricao });
      categoriasCardapio().push({ id: String(resposta.id), nome, descricao, icone: 'utensils', cor: 'orange', produtos: 0, destaque: '' });
      mostrarAvisoPedido('Categoria salva no Cardápio.');
    }
    fecharModalCategoria();
    renderizarCategorias();
  } catch (erro) {
    mostrarAvisoPedido(erro.message || 'Não foi possível salvar a categoria.');
  }
}

elementosCategorias.busca.addEventListener('input', renderizarCategorias);
document.getElementById('novaCategoria').addEventListener('click', () => abrirModalCategoria());
document.getElementById('fecharModalCategoria').addEventListener('click', fecharModalCategoria);
document.getElementById('cancelarCategoria').addEventListener('click', fecharModalCategoria);
document.getElementById('backdropCategoria').addEventListener('click', fecharModalCategoria);
document.getElementById('formCategoria').addEventListener('submit', salvarCategoria);
document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalCategoria(); });

function atualizarCategoriasRemotas() {
  renderizarCategorias();
}

renderizarCategorias();
window.lucide?.createIcons();
document.addEventListener('apex:cardapio-atualizado', atualizarCategoriasRemotas);
