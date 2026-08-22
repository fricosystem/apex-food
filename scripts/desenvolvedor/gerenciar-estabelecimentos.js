(() => {
  'use strict';

  const elementos = {
    busca: document.getElementById('buscaEstabelecimentoGlobal'),
    estado: document.getElementById('filtroEstadoEstabelecimento'),
    plano: document.getElementById('filtroPlanoEstabelecimento'),
    atualizar: document.getElementById('atualizarEstabelecimentosGlobal'),
    resultado: document.getElementById('resultadoGerenciamento'),
    tabela: document.getElementById('tabelaGerenciarEstabelecimentos'),
    modal: document.getElementById('modalGerenciarEstabelecimento'),
    titulo: document.getElementById('tituloModalGerenciarEstabelecimento'),
    subtitulo: document.getElementById('subtituloModalGerenciarEstabelecimento'),
    documento: document.getElementById('modalDocumentoEstabelecimento'),
    usuarios: document.getElementById('modalUsuariosEstabelecimento'),
    pedidos: document.getElementById('modalPedidosEstabelecimento'),
    faturamento: document.getElementById('modalFaturamentoEstabelecimento'),
    formEstado: document.getElementById('formEstadoEstabelecimento'),
    estadoModal: document.getElementById('modalEstadoEstabelecimento'),
    formPlano: document.getElementById('formPlanoEstabelecimento'),
    planoModal: document.getElementById('modalPlanoEstabelecimento'),
    diasPlano: document.getElementById('modalDiasPlanoEstabelecimento'),
    formLimite: document.getElementById('formLimiteEstabelecimento'),
    recursoLimite: document.getElementById('modalRecursoLimite'),
    valorLimite: document.getElementById('modalValorLimite'),
    formExcecao: document.getElementById('formExcecaoEstabelecimento'),
    recursoExcecao: document.getElementById('modalRecursoExcecao'),
    valorExcecao: document.getElementById('modalValorExcecao'),
    fimExcecao: document.getElementById('modalFimExcecao'),
    motivoExcecao: document.getElementById('modalMotivoExcecao'),
    feedback: document.getElementById('feedbackGerenciamentoEstabelecimento'),
  };

  let estabelecimentos = [];
  let selecionado = null;
  let carregando = false;

  const estados = { rascunho: 'Rascunho', em_teste: 'Em teste', ativo: 'Ativo', suspenso: 'Suspenso', desativado: 'Desativado', encerrado: 'Encerrado' };
  const planos = { teste: 'Período de teste', basico: 'Plano básico', profissional: 'Plano profissional', enterprise: 'Plano Enterprise' };
  const recursos = { usuariosAtivos: 'usuários', mesas: 'mesas', produtosCardapio: 'produtos', pedidosMensais: 'pedidos/mês', armazenamentoMb: 'MB' };

  function escapar(valor) {
    return window.ferramentasInterfaceApexFood?.escaparHtml
      ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
      : String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[caractere]));
  }

  function moeda(centavos) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos || 0) / 100);
  }

  function data(valor) {
    if (!valor) return '—';
    const convertida = new Date(valor);
    return Number.isNaN(convertida.getTime()) ? '—' : convertida.toLocaleDateString('pt-BR');
  }

  function feedback(mensagem, erro = false) {
    elementos.feedback.textContent = mensagem || '';
    elementos.feedback.className = `text-xs mt-4 ${erro ? 'text-red-300' : 'text-muted'}`;
  }

  function renderizar() {
    elementos.resultado.textContent = `${estabelecimentos.length} ${estabelecimentos.length === 1 ? 'estabelecimento carregado' : 'estabelecimentos carregados'}.`;
    if (!estabelecimentos.length) {
      elementos.tabela.innerHTML = '<tr><td colspan="7" class="py-12 text-center"><p class="text-sm font-medium">Nenhum estabelecimento encontrado.</p><p class="text-xs text-muted mt-1">Ajuste os filtros ou conclua um novo cadastro.</p></td></tr>';
      return;
    }
    elementos.tabela.innerHTML = estabelecimentos.map((item) => `<tr class="border-b border-border2 last:border-0"><td class="py-3 pr-4"><p class="font-medium">${escapar(item.nome)}</p><p class="text-[11px] text-muted mt-0.5">${escapar(item.documentoMascarado || 'Documento não informado')}</p></td><td class="py-3 pr-4"><span class="inline-flex items-center gap-1.5 text-xs"><span class="w-1.5 h-1.5 rounded-full ${item.estado === 'ativo' ? 'bg-green' : item.estado === 'em_teste' ? 'bg-yellow' : item.estado === 'suspenso' ? 'bg-red' : 'bg-muted'}"></span>${escapar(estados[item.estado] || item.estado)}</span></td><td class="py-3 pr-4 text-xs">${escapar(planos[item.planoAtual?.codigoPlano] || item.planoAtual?.nomePlano || '—')}</td><td class="py-3 pr-4 text-xs text-muted">${item.planoAtual?.fimEm ? data(item.planoAtual.fimEm) : 'Sem validade'}</td><td class="py-3 pr-4 text-xs">${Number(item.usuariosAtivos || 0)} / ${Number(item.limites?.usuariosAtivos || 0)}</td><td class="py-3 pr-4 text-xs text-muted">${Number(item.excecoesAtivas || 0)} exceções</td><td class="py-3"><button type="button" class="text-xs text-accent hover:text-orange-300" data-gerenciar-estabelecimento="${escapar(item.id)}">Gerenciar</button></td></tr>`).join('');
    elementos.tabela.querySelectorAll('[data-gerenciar-estabelecimento]').forEach((botao) => botao.addEventListener('click', () => abrir(estabelecimentos.find((item) => item.id === botao.dataset.gerenciarEstabelecimento))));
  }

  async function carregar() {
    if (carregando || !window.apexModulosApi?.listarEstabelecimentosDesenvolvedor) return;
    carregando = true;
    elementos.atualizar.disabled = true;
    elementos.resultado.textContent = 'Sincronizando estabelecimentos...';
    try {
      const resposta = await window.apexModulosApi.listarEstabelecimentosDesenvolvedor({ busca: elementos.busca.value.trim(), estado: elementos.estado.value, codigoPlano: elementos.plano.value, limite: 100 });
      estabelecimentos = Array.isArray(resposta.estabelecimentos) ? resposta.estabelecimentos : [];
      renderizar();
    } catch (erro) {
      estabelecimentos = [];
      elementos.resultado.textContent = erro.message || 'Não foi possível carregar os estabelecimentos.';
      elementos.tabela.innerHTML = '<tr><td colspan="7" class="py-12 text-center text-red-200">Não foi possível carregar os dados globais.</td></tr>';
    } finally {
      carregando = false;
      elementos.atualizar.disabled = false;
    }
  }

  function abrir(item) {
    if (!item) return;
    selecionado = item;
    elementos.titulo.textContent = item.nome;
    elementos.subtitulo.textContent = `${item.documentoMascarado || 'Documento não informado'} · ${estados[item.estado] || item.estado}`;
    elementos.documento.textContent = item.documentoMascarado || '—';
    elementos.usuarios.textContent = `${Number(item.usuariosAtivos || 0)} / ${Number(item.limites?.usuariosAtivos || 0)}`;
    elementos.pedidos.textContent = Number(item.pedidosPeriodo || 0);
    elementos.faturamento.textContent = moeda(item.faturamentoPeriodoCentavos);
    elementos.estadoModal.value = item.estado === 'rascunho' ? 'ativo' : item.estado;
    elementos.planoModal.value = item.planoAtual?.codigoPlano || 'basico';
    elementos.diasPlano.value = item.planoAtual?.fimEm ? Math.max(0, Math.ceil((new Date(item.planoAtual.fimEm).getTime() - Date.now()) / 86400000)) : 30;
    elementos.modal.classList.add('aberto');
    elementos.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    feedback('');
    window.lucide?.createIcons();
  }

  function fechar() {
    elementos.modal.classList.remove('aberto');
    elementos.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    selecionado = null;
    feedback('');
  }

  function idSelecionado() {
    if (!selecionado?.id) {
      feedback('Selecione um estabelecimento antes de continuar.', true);
      return '';
    }
    return selecionado.id;
  }

  async function executarAcao(callback, sucesso) {
    if (!idSelecionado()) return;
    const botoes = [...document.querySelectorAll('#modalGerenciarEstabelecimento button[type="submit"]')];
    botoes.forEach((botao) => { botao.disabled = true; });
    feedback('Salvando alteração...');
    try {
      await callback(selecionado.id);
      feedback(sucesso);
      await carregar();
      const atualizado = estabelecimentos.find((item) => item.id === selecionado.id);
      if (atualizado) abrir(atualizado);
    } catch (erro) {
      feedback(erro.message || 'Não foi possível concluir a alteração.', true);
    } finally {
      botoes.forEach((botao) => { botao.disabled = false; });
    }
  }

  elementos.formEstado.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const estado = elementos.estadoModal.value;
    if (['desativado', 'encerrado'].includes(estado) && !window.confirm(`Confirmar alteração do estabelecimento para ${estados[estado]}?`)) return;
    executarAcao((id) => window.apexModulosApi.alterarEstadoEstabelecimento({ idRestaurante: id, estado }), 'Estado atualizado com auditoria.');
  });

  elementos.formPlano.addEventListener('submit', (evento) => {
    evento.preventDefault();
    executarAcao((id) => window.apexModulosApi.definirPlanoEstabelecimento({ idRestaurante: id, codigoPlano: elementos.planoModal.value, dias: Number(elementos.diasPlano.value) }), 'Plano atualizado com sucesso.');
  });

  elementos.formLimite.addEventListener('submit', (evento) => {
    evento.preventDefault();
    executarAcao((id) => window.apexModulosApi.definirLimiteEstabelecimento({ idRestaurante: id, recurso: elementos.recursoLimite.value, limite: Number(elementos.valorLimite.value) }), `Limite de ${recursos[elementos.recursoLimite.value]} atualizado.`);
  });

  elementos.formExcecao.addEventListener('submit', (evento) => {
    evento.preventDefault();
    executarAcao((id) => window.apexModulosApi.criarExcecaoEstabelecimento({ idRestaurante: id, recurso: elementos.recursoExcecao.value, limiteNovo: Number(elementos.valorExcecao.value), fimEm: elementos.fimExcecao.value, motivo: elementos.motivoExcecao.value.trim() }), 'Exceção criada com validade definida.');
  });

  [elementos.busca, elementos.estado, elementos.plano].forEach((campo) => campo.addEventListener(campo === elementos.busca ? 'input' : 'change', () => { window.clearTimeout(campo._apexTimer); campo._apexTimer = window.setTimeout(carregar, 220); }));
  elementos.atualizar.addEventListener('click', carregar);
  document.getElementById('fecharModalGerenciarEstabelecimento')?.addEventListener('click', fechar);
  document.getElementById('backdropGerenciarEstabelecimento')?.addEventListener('click', fechar);
  document.addEventListener('keydown', (evento) => { if (evento.key === 'Escape' && elementos.modal.classList.contains('aberto')) fechar(); });

  window.dadosGerenciarEstabelecimentosPronto = carregar();
})();
