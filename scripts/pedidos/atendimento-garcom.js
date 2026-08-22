(() => {
  'use strict';

  const estado = { pedidos: [], comandas: [], mesas: [], carregando: false };
  const statusConfig = {
    aguardando_confirmacao_garcom: { label: 'Aguardando confirmação', classe: 'bg-blue/10 text-blue border-blue/30' },
    confirmado_garcom: { label: 'Confirmado', classe: 'bg-purple/10 text-purpleLight border-purple/30' },
    enviado_cozinha: { label: 'Na fila da cozinha', classe: 'bg-blue/10 text-blue border-blue/30' },
    em_preparo: { label: 'Em preparo', classe: 'bg-yellow/10 text-yellow border-yellow/30' },
    pronto: { label: 'Pronto para servir', classe: 'bg-green/10 text-green border-green/30' },
    servido: { label: 'Servido', classe: 'bg-green/10 text-green border-green/30' },
    rejeitado_garcom: { label: 'Rejeitado', classe: 'bg-red/10 text-red border-red/30' },
    cancelado: { label: 'Cancelado', classe: 'bg-red/10 text-red border-red/30' },
  };

  const esc = valor => window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
  const moeda = valor => window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(Number(valor || 0) / 100) : (Number(valor || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const avisar = mensagem => window.mostrarAvisoPedido?.(mensagem);
  const chave = prefixo => `${prefixo}:${typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const statusPedido = pedido => String(pedido.statusPedido || pedido.status || 'novo');
  const dadosStatus = status => statusConfig[status] || { label: status || 'Sem status', classe: 'bg-card2 text-muted border-border2' };

  function normalizarPedido(pedido) {
    const status = statusPedido(pedido);
    const itens = Array.isArray(pedido.itens) ? pedido.itens : Array.isArray(pedido.itensResumo) ? pedido.itensResumo : [];
    return {
      ...pedido,
      id: String(pedido.id),
      status,
      idComanda: String(pedido.idComanda || ''),
      idMesa: String(pedido.idMesa || ''),
      mesa: String(pedido.nomeMesa || pedido.idMesa || 'Mesa não identificada'),
      cliente: String(pedido.nomeCliente || 'Cliente não informado'),
      garcom: String(pedido.nomeGarcom || pedido.nomeGarcomResponsavel || 'Aguardando atribuição'),
      itens,
      quantidadeItens: itens.reduce((total, item) => total + Number(item.quantidade || 0), 0),
      criadoEm: pedido.criadoEm || null,
    };
  }

  function normalizarComanda(comanda) {
    return { ...comanda, id: String(comanda.id), idMesa: String(comanda.idMesa || ''), status: String(comanda.statusComanda || comanda.status || 'aberta') };
  }

  function pedidoAtivo(pedido) {
    return ['rascunho', 'aguardando_confirmacao_garcom', 'confirmado_garcom', 'enviado_cozinha', 'em_preparo', 'pronto', 'servido'].includes(pedido.status);
  }

  function comandaAtiva(comanda) {
    return ['aberta', 'em_consumo'].includes(comanda.status);
  }

  function obterMesasAtribuidas() {
    const porId = new Map(estado.mesas.map(mesa => [String(mesa.id), mesa]));
    const porComanda = new Map(estado.comandas.filter(comandaAtiva).map(comanda => [comanda.idMesa, comanda]));
    const ids = new Set();
    estado.comandas.filter(comandaAtiva).forEach(comanda => { if (comanda.idMesa) ids.add(comanda.idMesa); });
    estado.pedidos.filter(pedidoAtivo).forEach(pedido => { if (pedido.idMesa) ids.add(pedido.idMesa); });
    return [...ids].map(idMesa => {
      const mesa = porId.get(idMesa) || {};
      const comanda = porComanda.get(idMesa) || {};
      const pedidos = estado.pedidos.filter(pedido => pedido.idMesa === idMesa && pedidoAtivo(pedido));
      return {
        ...mesa,
        ...comanda,
        id: idMesa,
        nome: String(mesa.nome || mesa.numero || comanda.nomeMesa || `Mesa ${idMesa}`),
        statusMesa: String(mesa.estadoAtendimento || mesa.estado || 'ocupada'),
        totalCentavos: Number(comanda.totalCentavos || comanda.valorCentavos || pedidos.reduce((total, pedido) => total + Number(pedido.totalCentavos || pedido.valorCentavos || 0), 0)),
        pedidos,
        clientes: [...new Set(pedidos.map(pedido => pedido.cliente))],
      };
    });
  }

  function renderizarIndicadores(mesas, pedidos) {
    document.getElementById('statMesasGarcom').textContent = mesas.length;
    document.getElementById('statAguardandoGarcom').textContent = pedidos.filter(pedido => pedido.status === 'aguardando_confirmacao_garcom').length;
    document.getElementById('statPreparoGarcom').textContent = pedidos.filter(pedido => ['enviado_cozinha', 'em_preparo'].includes(pedido.status)).length;
    document.getElementById('statProntosGarcom').textContent = pedidos.filter(pedido => pedido.status === 'pronto').length;
  }

  function renderizarMesas(mesas) {
    const painel = document.getElementById('painelMesasGarcom');
    document.getElementById('resultadoMesasGarcom').textContent = `${mesas.length} ${mesas.length === 1 ? 'mesa encontrada' : 'mesas encontradas'}.`;
    painel.innerHTML = mesas.length ? mesas.map(mesa => {
      const estadoMesa = mesa.statusDistribuicaoGarcom === 'aguardando_atribuicao' ? 'Aguardando atribuição' : mesa.statusMesa === 'pedido_pronto' ? 'Pedido pronto' : 'Em atendimento';
      const clientes = mesa.clientes.length ? mesa.clientes.slice(0, 2).map(esc).join(', ') : 'Cliente não informado';
      return `<article class="rounded-xl bg-card2 border border-border2 p-4"><div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2"><i data-lucide="armchair" class="w-4 h-4 text-accent"></i><h4 class="text-sm font-semibold">${esc(mesa.nome)}</h4></div><p class="text-xs text-muted mt-1">${esc(estadoMesa)}</p></div><span class="px-2 py-1 rounded-md bg-card border border-border2 text-[10px] text-muted">${mesa.pedidos.length} pedido(s)</span></div><div class="mt-4 text-xs text-muted truncate">${clientes}</div><div class="flex items-center justify-between mt-4 pt-3 border-t border-border2"><span class="text-[10px] text-muted">Total da comanda</span><strong class="text-sm text-accent">${moeda(mesa.totalCentavos)}</strong></div></article>`;
    }).join('') : '<div class="rounded-xl border border-border2 border-dashed p-6 text-center sm:col-span-2 2xl:col-span-1"><i data-lucide="armchair" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-xs font-medium">Nenhuma mesa atribuída encontrada</p><p class="text-[10px] text-muted mt-1">As novas comandas serão distribuídas conforme a disponibilidade da equipe.</p></div>';
  }

  function botaoAcao(pedido) {
    if (pedido.status === 'aguardando_confirmacao_garcom') return `<button type="button" data-acao="confirmar" data-pedido-id="${esc(pedido.id)}" class="btn-press px-3 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-xs font-medium">Confirmar pedido</button><button type="button" data-acao="recusar" data-pedido-id="${esc(pedido.id)}" class="btn-press px-3 py-2 rounded-lg bg-red/10 border border-red/30 text-red-100 text-xs font-medium">Recusar</button>`;
    if (pedido.status === 'confirmado_garcom') return `<button type="button" data-acao="enviar_cozinha" data-pedido-id="${esc(pedido.id)}" class="btn-press px-3 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-xs font-medium">Enviar à cozinha</button>`;
    if (pedido.status === 'pronto') return `<button type="button" data-acao="servir" data-pedido-id="${esc(pedido.id)}" class="btn-press px-3 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-xs font-medium">Marcar como servido</button>`;
    if (pedido.status === 'servido') return `<button type="button" data-acao="caixa" data-pedido-id="${esc(pedido.id)}" data-comanda-id="${esc(pedido.idComanda)}" data-mesa-id="${esc(pedido.idMesa)}" class="btn-press px-3 py-2 rounded-lg bg-card2 border border-border2 text-xs font-medium">Encaminhar comanda ao caixa</button>`;
    return '';
  }

  function renderizarPedidos() {
    const filtro = document.getElementById('filtroStatusGarcom').value;
    const pedidos = estado.pedidos.filter(pedidoAtivo).filter(pedido => filtro === 'todos' || pedido.status === filtro).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
    document.getElementById('resultadoPedidosGarcom').textContent = `${pedidos.length} ${pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}.`;
    document.getElementById('painelPedidosGarcom').innerHTML = pedidos.length ? pedidos.map(pedido => {
      const status = dadosStatus(pedido.status);
      const itens = pedido.itens.slice(0, 3).map(item => `${Number(item.quantidade || 0)}x ${esc(item.nome || item.nomeProduto || item.idProduto)}`).join(' · ');
      return `<article class="rounded-xl bg-card2 border border-border2 p-4"><div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="font-mono text-xs font-semibold">${esc(pedido.id)}</span><span class="px-2 py-1 rounded-md border text-[10px] font-medium ${status.classe}">${esc(status.label)}</span></div><h4 class="text-sm font-semibold mt-2">${esc(pedido.mesa)} · ${esc(pedido.cliente)}</h4><p class="text-xs text-muted mt-1">${esc(itens || 'Itens não informados')}</p></div><strong class="text-sm text-accent whitespace-nowrap">${moeda(pedido.totalCentavos || pedido.valorCentavos)}</strong></div><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-border2"><span class="text-[10px] text-muted">Garçom: ${esc(pedido.garcom)} · ${pedido.quantidadeItens} item(ns)</span><div class="flex flex-wrap justify-end gap-2">${botaoAcao(pedido)}</div></div></article>`;
    }).join('') : '<div class="rounded-xl border border-border2 border-dashed p-8 text-center"><i data-lucide="inbox" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-xs font-medium">Nenhum pedido encontrado</p><p class="text-[10px] text-muted mt-1">Não há pedidos para o filtro selecionado.</p></div>';
  }

  function renderizar() {
    const mesas = obterMesasAtribuidas();
    const pedidos = estado.pedidos.filter(pedidoAtivo);
    renderizarIndicadores(mesas, pedidos);
    renderizarMesas(mesas);
    renderizarPedidos();
    document.getElementById('estadoVazioGarcom').classList.toggle('hidden', Boolean(mesas.length || pedidos.length));
    window.lucide?.createIcons();
  }

  async function carregarAtendimentoGarcom() {
    if (!window.apexModulosApi?.listarPedidos) return;
    const botao = document.getElementById('atualizarAtendimentoGarcom');
    if (botao) botao.disabled = true;
    try {
      const [pedidosResposta, comandasResposta, mesasResposta] = await Promise.all([
        window.apexModulosApi.listarPedidos({ limite: 300, canal: 'salão' }),
        window.apexModulosApi.listarPedidos({ recurso: 'comandas', limite: 300 }),
        window.apexModulosApi.listarSalao('mesas'),
      ]);
      estado.pedidos = Array.isArray(pedidosResposta?.pedidos) ? pedidosResposta.pedidos.map(normalizarPedido) : [];
      estado.comandas = Array.isArray(comandasResposta?.comandas) ? comandasResposta.comandas.map(normalizarComanda) : [];
      estado.mesas = Array.isArray(mesasResposta?.mesas) ? mesasResposta.mesas : [];
      renderizar();
    } catch (erro) {
      estado.pedidos = [];
      estado.comandas = [];
      estado.mesas = [];
      renderizar();
      avisar(erro.message || 'Não foi possível carregar o atendimento dos garçons.');
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  async function atualizarStatus(id, status, motivo = '') {
    try {
      await window.apexModulosApi.atualizarStatusPedido({ id, status, ...(motivo ? { motivo, motivoRejeicao: motivo } : {}), chaveIdempotencia: chave('garcom-status') });
      avisar(`Pedido atualizado para ${dadosStatus(status).label}.`);
      await carregarAtendimentoGarcom();
    } catch (erro) {
      avisar(erro.message || 'Não foi possível atualizar o pedido.');
    }
  }

  async function encaminharCaixa(botao) {
    try {
      await window.apexModulosApi.encaminharComandaCaixa({ idComanda: botao.dataset.comandaId, idMesa: botao.dataset.mesaId, chaveIdempotencia: chave('garcom-caixa') });
      avisar('Comanda encaminhada ao caixa para conferência operacional.');
      await carregarAtendimentoGarcom();
    } catch (erro) {
      avisar(erro.message || 'Não foi possível encaminhar a comanda ao caixa.');
    }
  }

  document.getElementById('painelPedidosGarcom').addEventListener('click', event => {
    const botao = event.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;
    if (acao === 'caixa') return encaminharCaixa(botao);
    const status = { confirmar: 'confirmado_garcom', enviar_cozinha: 'enviado_cozinha', servir: 'servido' }[acao];
    if (acao === 'recusar') {
      const motivo = window.prompt('Informe o motivo da recusa do pedido:');
      if (!motivo?.trim()) return;
      return atualizarStatus(botao.dataset.pedidoId, 'rejeitado_garcom', motivo.trim());
    }
    if (status) atualizarStatus(botao.dataset.pedidoId, status);
  });
  document.getElementById('filtroStatusGarcom').addEventListener('change', renderizarPedidos);
  document.getElementById('atualizarAtendimentoGarcom').addEventListener('click', carregarAtendimentoGarcom);
  document.addEventListener('apex:pedidos-atualizado', carregarAtendimentoGarcom);
  carregarAtendimentoGarcom();
})();
