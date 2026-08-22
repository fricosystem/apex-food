(() => {
  'use strict';

  const elementos = {
    busca: document.getElementById('buscaPapel'),
    lista: document.getElementById('listaPapeis'),
    resultado: document.getElementById('resultadoPapeis'),
    total: document.getElementById('totalPapeis'),
    nativos: document.getElementById('totalPapeisNativos'),
    personalizados: document.getElementById('totalPapeisPersonalizados'),
    permissoes: document.getElementById('totalPermissoesPapeis'),
    modal: document.getElementById('modalPapel'),
    tituloModal: document.getElementById('tituloModalPapel'),
    form: document.getElementById('formPapel'),
    nome: document.getElementById('nomePapel'),
    codigo: document.getElementById('codigoPapel'),
    descricao: document.getElementById('descricaoPapel'),
    listaPermissoes: document.getElementById('listaPermissoesPapel'),
    salvar: document.getElementById('salvarPapel'),
  };

  let papeis = [];
  let catalogoPermissoes = [];
  let papelEditando = null;

  function escapar(valor) {
    return window.ferramentasInterfaceApexFood?.escaparHtml
      ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
      : String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[caractere]));
  }

  function aviso(mensagem) {
    window.mostrarAvisoPedido?.(mensagem);
  }

  function nomePermissao(codigo) {
    return catalogoPermissoes.find((permissao) => permissao.codigo === codigo)?.nome || codigo;
  }

  function papeisFiltrados() {
    const termo = elementos.busca?.value.trim().toLocaleLowerCase('pt-BR') || '';
    return papeis.filter((papel) => `${papel.nome} ${papel.codigo} ${papel.descricao}`.toLocaleLowerCase('pt-BR').includes(termo));
  }

  function renderizar() {
    const filtrados = papeisFiltrados();
    const nativos = papeis.filter((papel) => papel.sistema);
    const personalizados = papeis.filter((papel) => !papel.sistema);
    elementos.total.textContent = papeis.length;
    elementos.nativos.textContent = nativos.length;
    elementos.personalizados.textContent = personalizados.length;
    elementos.permissoes.textContent = catalogoPermissoes.length;
    elementos.resultado.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'categoria encontrada' : 'categorias encontradas'}.`;
    if (!filtrados.length) {
      elementos.lista.innerHTML = '<div class="md:col-span-2 xl:col-span-3 rounded-lg border border-border2 border-dashed py-12 text-center"><i data-lucide="search-x" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-sm font-medium">Nenhuma categoria encontrada</p><p class="text-xs text-muted mt-1">Ajuste a busca ou crie uma nova categoria.</p></div>';
      window.lucide?.createIcons();
      return;
    }
    elementos.lista.innerHTML = filtrados.map((papel) => {
      const lista = papel.permissoes.slice(0, 3).map(nomePermissao).map(escapar).join(' · ');
      const excedente = papel.permissoes.length > 3 ? ` +${papel.permissoes.length - 3}` : '';
      const botoes = papel.editavel
        ? `<div class="flex items-center gap-2 mt-4 pt-3 border-t border-border2"><button type="button" class="text-xs text-accent hover:text-orange-300" data-editar-papel="${escapar(papel.codigo)}">Editar</button><button type="button" class="text-xs text-muted hover:text-red-300" data-arquivar-papel="${escapar(papel.codigo)}">Arquivar</button></div>`
        : '<div class="mt-4 pt-3 border-t border-border2 text-[11px] text-muted">Papel protegido pelo sistema</div>';
      return `<article class="rounded-xl bg-card2 border border-border2 p-5"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><span class="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${papel.sistema ? 'bg-white/5 text-muted' : 'bg-accent/10 text-orange-300'}">${papel.sistema ? 'Sistema' : 'Personalizada'}</span><h4 class="text-base font-semibold mt-3 truncate">${escapar(papel.nome)}</h4><p class="text-[11px] text-muted mt-1 font-mono truncate">${escapar(papel.codigo)}</p></div><i data-lucide="${papel.sistema ? 'shield-check' : 'badge-check'}" class="w-5 h-5 ${papel.sistema ? 'text-muted' : 'text-accent'}"></i></div><p class="text-xs text-muted leading-relaxed mt-4 min-h-8">${escapar(papel.descricao || 'Sem descrição cadastrada.')}</p><div class="mt-4 text-xs text-muted"><strong class="text-white">${papel.permissoes.length}</strong> ${papel.permissoes.length === 1 ? 'permissão' : 'permissões'}<p class="text-[11px] mt-1 truncate">${lista || 'Nenhuma permissão atribuída'}${escapar(excedente)}</p></div>${botoes}</article>`;
    }).join('');
    elementos.lista.querySelectorAll('[data-editar-papel]').forEach((botao) => botao.addEventListener('click', () => abrirModal(papeis.find((papel) => papel.codigo === botao.dataset.editarPapel))));
    elementos.lista.querySelectorAll('[data-arquivar-papel]').forEach((botao) => botao.addEventListener('click', () => arquivar(botao.dataset.arquivarPapel)));
    window.lucide?.createIcons();
  }

  function renderizarPermissoes(selecionadas = []) {
    elementos.listaPermissoes.innerHTML = catalogoPermissoes.map((permissao) => `<label class="papeis-permissao-option"><input type="checkbox" value="${escapar(permissao.codigo)}" ${selecionadas.includes(permissao.codigo) ? 'checked' : ''}><span><strong>${escapar(permissao.nome)}</strong><small>${escapar(permissao.modulo)} · ${escapar(permissao.acao)}</small></span></label>`).join('');
  }

  function abrirModal(papel = null) {
    papelEditando = papel && papel.editavel ? papel : null;
    elementos.tituloModal.textContent = papelEditando ? 'Editar categoria' : 'Nova categoria';
    elementos.salvar.textContent = papelEditando ? 'Salvar alterações' : 'Salvar categoria';
    elementos.nome.value = papelEditando?.nome || '';
    elementos.codigo.value = papelEditando?.codigo || '';
    elementos.codigo.disabled = Boolean(papelEditando);
    elementos.descricao.value = papelEditando?.descricao || '';
    renderizarPermissoes(papelEditando?.permissoes || []);
    elementos.modal.classList.add('aberto');
    elementos.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    elementos.nome.focus();
    window.lucide?.createIcons();
  }

  function fecharModal() {
    elementos.modal.classList.remove('aberto');
    elementos.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    elementos.form.reset();
    elementos.codigo.disabled = false;
    papelEditando = null;
  }

  async function arquivar(codigo) {
    const papel = papeis.find((item) => item.codigo === codigo);
    if (!papel || !window.apexModulosApi?.arquivarPapel) return;
    if (!window.confirm(`Arquivar a categoria ${papel.nome}? Ela não poderá ser atribuída a novos membros.`)) return;
    try {
      await window.apexModulosApi.arquivarPapel({ id: codigo });
      papel.estado = 'desativado';
      papeis = papeis.filter((item) => item.codigo !== codigo);
      renderizar();
      aviso('Categoria arquivada com segurança.');
    } catch (erro) {
      aviso(erro.message || 'Não foi possível arquivar a categoria.');
    }
  }

  async function salvar(evento) {
    evento.preventDefault();
    const nome = elementos.nome.value.trim().replace(/\s+/g, ' ');
    const codigo = elementos.codigo.value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '-');
    const descricao = elementos.descricao.value.trim();
    const permissoes = [...elementos.listaPermissoes.querySelectorAll('input:checked')].map((input) => input.value);
    if (nome.length < 2) return aviso('Informe um nome válido para a categoria.');
    if (!window.apexModulosApi) return aviso('O serviço de permissões está temporariamente indisponível.');
    elementos.salvar.disabled = true;
    try {
      if (papelEditando) {
        await window.apexModulosApi.atualizarPapel({ id: papelEditando.codigo, nome, descricao, permissoes });
        Object.assign(papelEditando, { nome, descricao, permissoes });
        aviso('Categoria atualizada com sucesso.');
      } else {
        const resposta = await window.apexModulosApi.criarPapel({ codigo, nome, descricao, permissoes });
        papeis.push({ id: resposta.id, codigo: resposta.id, nome, descricao, permissoes, sistema: false, estado: 'ativo', editavel: true });
        aviso('Categoria criada com sucesso.');
      }
      fecharModal();
      renderizar();
    } catch (erro) {
      aviso(erro.message || 'Não foi possível salvar a categoria.');
    } finally {
      elementos.salvar.disabled = false;
    }
  }

  async function carregar() {
    if (!window.apexModulosApi?.listarPapeis) {
      elementos.resultado.textContent = 'Serviço de permissões indisponível.';
      return;
    }
    try {
      const resposta = await window.apexModulosApi.listarPapeis();
      papeis = Array.isArray(resposta.papeis) ? resposta.papeis : [];
      catalogoPermissoes = Array.isArray(resposta.catalogoPermissoes) ? resposta.catalogoPermissoes : [];
      renderizar();
    } catch (erro) {
      elementos.resultado.textContent = erro.message || 'Não foi possível carregar as categorias.';
      elementos.lista.innerHTML = '<div class="md:col-span-2 xl:col-span-3 rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center"><p class="text-sm font-medium text-red-200">Não foi possível carregar as categorias.</p><p class="text-xs text-muted mt-1">Atualize a página e tente novamente.</p></div>';
    }
  }

  document.getElementById('novoPapel')?.addEventListener('click', () => abrirModal());
  document.getElementById('fecharModalPapel')?.addEventListener('click', fecharModal);
  document.getElementById('cancelarPapel')?.addEventListener('click', fecharModal);
  document.getElementById('backdropPapel')?.addEventListener('click', fecharModal);
  elementos.form?.addEventListener('submit', salvar);
  elementos.busca?.addEventListener('input', renderizar);
  document.addEventListener('keydown', (evento) => { if (evento.key === 'Escape' && elementos.modal.classList.contains('aberto')) fecharModal(); });

  carregar();
})();
