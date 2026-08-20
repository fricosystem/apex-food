(() => {
  'use strict';

  let categoriaDigitalAtiva = 'todas';
  let configuracaoDigital = { publicado: false, exibirPrecos: true, aceitarPedidos: false, mostrarPromocoes: true, linkPublico: '' };
  const api = () => window.apexModulosApi;
  const aviso = mensagem => typeof window.mostrarAvisoPedido === 'function' ? window.mostrarAvisoPedido(mensagem) : window.alert(mensagem);
  const escapar = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const produtosDigital = () => (window.dadosCardapioApexFood?.produtos || []).filter(produto => produto.disponibilidade !== false);
  const categoriasDigital = () => window.dadosCardapioApexFood?.categorias || [];
  const moedaDigital = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function renderizarQrVisual() {
    const marcadores = new Set([0,1,2,3,4,5,6,7,8,9,17,18,26,27,35,36,44,45,53,54,62,63,71,72,73,74,75,76,77,78,79,80,12,13,21,22,40,41,49,50,58,59]);
    const elemento = document.getElementById('qrVisual');
    if (elemento) elemento.innerHTML = Array.from({ length: 81 }, (_, indice) => `<span class="rounded-sm ${marcadores.has(indice) ? 'bg-black' : 'bg-white'}"></span>`).join('');
  }

  function renderizarConfiguracao() {
    const status = document.getElementById('statusPublicacaoCardapio');
    if (status) status.textContent = configuracaoDigital.publicado ? 'Publicado' : 'Não publicado';
    const link = document.getElementById('linkPublicoCardapio');
    if (link) link.textContent = configuracaoDigital.linkPublico || 'Link público não configurado';
    ['ExibirPrecos', 'AceitarPedidos', 'MostrarPromocoes'].forEach(chave => {
      const elemento = document.getElementById(`config${chave}`);
      if (elemento) elemento.checked = Boolean(configuracaoDigital[chave.charAt(0).toLowerCase() + chave.slice(1)]);
    });
  }

  function renderizarPreviewDigital() {
    const categorias = [{ id: 'todas', nome: 'Todos' }, ...categoriasDigital()];
    const categoriasEl = document.getElementById('categoriasPreview');
    const produtosEl = document.getElementById('produtosPreview');
    if (!categoriasEl || !produtosEl) return;
    categoriasEl.innerHTML = categorias.map(categoria => `<button type="button" data-categoria-preview="${escapar(categoria.id)}" class="cardapio-tab ${categoriaDigitalAtiva === categoria.id ? 'ativa' : ''} whitespace-nowrap px-3 py-2 rounded-full border border-neutral-200 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition">${escapar(categoria.nome)}</button>`).join('');
    const lista = produtosDigital().filter(produto => categoriaDigitalAtiva === 'todas' || produto.categoria === categoriaDigitalAtiva || produto.idCategoria === categoriaDigitalAtiva);
    produtosEl.innerHTML = lista.length ? lista.map(produto => `<article class="rounded-xl border border-neutral-200 p-4 flex items-center justify-between gap-3"><div class="min-w-0"><div class="flex items-center gap-2"><h4 class="text-sm font-semibold truncate">${escapar(produto.nome)}</h4>${produto.destaque ? '<span class="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-semibold">Destaque</span>' : ''}</div><p class="text-xs text-neutral-500 line-clamp-2 mt-1">${escapar(produto.descricao)}</p></div><strong class="text-sm text-orange-600 whitespace-nowrap">${moedaDigital(produto.preco || Number(produto.precoCentavos || 0) / 100)}</strong></article>`).join('') : '<div class="col-span-full rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">Nenhum produto encontrado</div>';
    document.querySelectorAll('[data-categoria-preview]').forEach(botao => botao.addEventListener('click', () => { categoriaDigitalAtiva = botao.dataset.categoriaPreview; renderizarPreviewDigital(); }));
    window.lucide?.createIcons();
  }

  async function carregarConfiguracao() {
    try {
      const resposta = await api()?.listarCardapio('configuracao');
      if (resposta?.configuracao) configuracaoDigital = { ...configuracaoDigital, ...resposta.configuracao };
    } catch (erro) {
      configuracaoDigital = { publicado: false, exibirPrecos: true, aceitarPedidos: false, mostrarPromocoes: true, linkPublico: '' };
    }
    renderizarConfiguracao();
  }

  async function salvarConfiguracao(alteracoes) {
    const proxima = { ...configuracaoDigital, ...alteracoes };
    try {
      let resposta;
      if (configuracaoDigital.id) resposta = await api().atualizarCardapio({ recurso: 'configuracao', id: 'configuracao', ...alteracoes });
      else {
        try { resposta = await api().atualizarCardapio({ recurso: 'configuracao', id: 'configuracao', ...alteracoes }); }
        catch (erro) { if (erro.status !== 404) throw erro; resposta = await api().criarCardapio({ recurso: 'configuracao', ...proxima }); }
      }
      configuracaoDigital = { ...proxima, ...(resposta?.configuracao || {}) };
      configuracaoDigital.id = 'configuracao';
      renderizarConfiguracao();
      aviso('Configuração do cardápio atualizada.');
    } catch (erro) {
      renderizarConfiguracao();
      aviso(erro.message || 'Não foi possível atualizar o cardápio. Tente novamente.');
    }
  }

  function baixarQr() {
    if (!configuracaoDigital.linkPublico) return aviso('Configure o link público antes de baixar o código QR.');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/><text x="256" y="245" text-anchor="middle" font-family="Arial" font-size="24" fill="black">APEX Food</text><text x="256" y="285" text-anchor="middle" font-family="Arial" font-size="14" fill="black">${escapar(configuracaoDigital.linkPublico)}</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const link = document.createElement('a'); link.href = url; link.download = 'apex-food-cardapio.svg'; link.click(); URL.revokeObjectURL(url);
  }

  document.querySelectorAll('.modo-preview').forEach(botao => botao.addEventListener('click', () => { document.querySelectorAll('.modo-preview').forEach(item => { const ativo = item === botao; item.classList.toggle('ativa', ativo); item.classList.toggle('text-accent', ativo); item.classList.toggle('text-muted', !ativo); }); const preview = document.getElementById('previewCardapio'); preview?.classList.toggle('max-w-sm', botao.dataset.modo === 'mobile'); preview?.classList.toggle('max-w-3xl', botao.dataset.modo !== 'mobile'); }));
  document.getElementById('publicarCardapio')?.addEventListener('click', () => salvarConfiguracao({ publicado: true }));
  document.getElementById('copiarLinkCardapio')?.addEventListener('click', async () => { if (!configuracaoDigital.linkPublico) return aviso('Link público não configurado.'); try { await navigator.clipboard.writeText(configuracaoDigital.linkPublico); aviso('Link do cardápio copiado.'); } catch { aviso('Não foi possível copiar o link.'); } });
  document.getElementById('baixarQr')?.addEventListener('click', baixarQr);
  document.getElementById('configExibirPrecos')?.addEventListener('change', evento => salvarConfiguracao({ exibirPrecos: evento.target.checked }));
  document.getElementById('configAceitarPedidos')?.addEventListener('change', evento => salvarConfiguracao({ aceitarPedidos: evento.target.checked }));
  document.getElementById('configMostrarPromocoes')?.addEventListener('change', evento => salvarConfiguracao({ mostrarPromocoes: evento.target.checked }));
  renderizarQrVisual(); renderizarConfiguracao(); renderizarPreviewDigital(); window.lucide?.createIcons();
  carregarConfiguracao();
  document.addEventListener('apex:cardapio-atualizado', renderizarPreviewDigital);
})();
