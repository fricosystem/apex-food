const statusConfig = {
  ocupada: {
    label: 'Ocupada',
    dot: 'bg-accent',
    text: 'text-accent',
    badge: 'bg-accent/10 text-accent border-accent/30',
    avatar: 'bg-accent/15 text-accent',
    icon: 'utensils'
  },
  disponivel: {
    label: 'Disponível',
    dot: 'bg-green',
    text: 'text-green',
    badge: 'bg-green/10 text-green border-green/30',
    avatar: 'bg-green/15 text-green',
    icon: 'check-circle-2'
  },
  indisponivel: {
    label: 'Indisponível',
    dot: 'bg-red',
    text: 'text-red',
    badge: 'bg-red/10 text-red border-red/30',
    avatar: 'bg-red/15 text-red',
    icon: 'ban'
  }
};

const reservaConfig = {
  chegou: { label: 'Cliente presente', dot: 'bg-green', text: 'text-green' },
  aguardando: { label: 'Atendimento em andamento', dot: 'bg-yellow', text: 'text-yellow' },
  confirmada: { label: 'Reserva confirmada', dot: 'bg-blue', text: 'text-blue' },
  'sem-reserva': { label: 'Sem reserva', dot: 'bg-neutral-500', text: 'text-muted' },
  bloqueada: { label: 'Bloqueio operacional', dot: 'bg-red', text: 'text-red' }
};

const elementos = {
  grid: document.getElementById('tablesGrid'),
  estadoVazio: document.getElementById('estadoVazio'),
  busca: document.getElementById('buscaMesa'),
  filtro: document.getElementById('filtroStatus'),
  resultado: document.getElementById('resultadoMesas'),
  modal: document.getElementById('tableModal')
};

function escaparHtml(valor) {
  if (window.ferramentasInterfaceApexFood?.escaparHtml) {
    return window.ferramentasInterfaceApexFood.escaparHtml(valor);
  }
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarMoeda(valor) {
  if (window.ferramentasInterfaceApexFood?.formatarMoeda) {
    return window.ferramentasInterfaceApexFood.formatarMoeda(valor);
  }
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterTextoReserva(mesa) {
  const reserva = reservaConfig[mesa.reservaStatus] || reservaConfig['sem-reserva'];
  if (mesa.reservaStatus === 'sem-reserva') return reserva.label;
  if (mesa.reservaStatus === 'bloqueada') return mesa.pedidoAtual || reserva.label;
  if (mesa.reservadoPor && mesa.horarioReserva) return `${mesa.reservadoPor} · ${mesa.horarioReserva}`;
  if (mesa.reservadoPor) return mesa.reservadoPor;
  return reserva.label;
}

function obterTextoHorario(mesa) {
  if (mesa.status === 'ocupada' && mesa.chegada) return `Entrada às ${mesa.chegada}`;
  if (mesa.horarioReserva) return `Reserva às ${mesa.horarioReserva}`;
  if (mesa.status === 'indisponivel') return mesa.pedidoAtual || 'Indisponível';
  return 'Livre agora';
}

function correspondeAoFiltro(mesa) {
  const termo = elementos.busca.value.trim().toLocaleLowerCase('pt-BR');
  const filtro = elementos.filtro.value;
  const textoMesa = [
    mesa.nome,
    mesa.reservadoPor,
    mesa.comanda,
    mesa.telefone,
    mesa.pedidoAtual,
    mesa.observacoes
  ].join(' ').toLocaleLowerCase('pt-BR');
  const correspondeBusca = !termo || textoMesa.includes(termo);
  const correspondeStatus = filtro === 'todas'
    || mesa.status === filtro
    || (filtro === 'com-reserva' && mesa.reservaStatus !== 'sem-reserva');
  return correspondeBusca && correspondeStatus;
}

function atualizarEstatisticas() {
  const contagem = window.dadosMesas.reduce((acc, mesa) => {
    acc[mesa.status] += 1;
    if (mesa.reservaStatus === 'confirmada') acc.reservas += 1;
    return acc;
  }, { ocupada: 0, disponivel: 0, indisponivel: 0, reservas: 0 });

  document.getElementById('statOcupadas').textContent = contagem.ocupada;
  document.getElementById('statDisponiveis').textContent = contagem.disponivel;
  document.getElementById('statIndisponiveis').textContent = contagem.indisponivel;
  document.getElementById('statReservas').textContent = contagem.reservas;
}

function criarCardMesa(mesa) {
  const status = statusConfig[mesa.status];
  const reserva = reservaConfig[mesa.reservaStatus] || reservaConfig['sem-reserva'];
  const temReserva = mesa.reservaStatus !== 'sem-reserva';
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `table-card status-${mesa.status} btn-press relative rounded-xl bg-card border p-4 sm:p-5 text-left w-full`;
  botao.setAttribute('aria-label', `Abrir detalhes da ${mesa.nome}`);
  botao.innerHTML = `
    <div class="flex items-start justify-between gap-3 mb-4">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${status.dot} dot-pulse"></span>
        <span class="text-[10px] font-semibold uppercase tracking-wide ${status.text}">${status.label}</span>
      </div>
      <span class="flex items-center gap-1 text-[10px] text-muted"><i data-lucide="users" class="w-3.5 h-3.5"></i>${mesa.pessoas || 0}/${mesa.capacidade}</span>
    </div>
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-base sm:text-lg font-bold">${escaparHtml(mesa.nome)}</div>
        <div class="text-xs text-muted mt-1">${mesa.capacidade} lugares · ${escaparHtml(mesa.pedidoAtual || 'Sem pedido')}</div>
      </div>
      <div class="w-9 h-9 rounded-lg ${status.avatar} flex items-center justify-center flex-shrink-0">
        <i data-lucide="${status.icon}" class="w-4 h-4"></i>
      </div>
    </div>
    <div class="mt-5 pt-3 border-t border-border2 space-y-2">
      <div class="flex items-center gap-2 text-xs ${reserva.text}">
        <i data-lucide="${temReserva ? 'calendar-clock' : 'calendar-off'}" class="w-3.5 h-3.5 flex-shrink-0"></i>
        <span class="truncate">${escaparHtml(obterTextoReserva(mesa))}</span>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted">
        <i data-lucide="clock-3" class="w-3.5 h-3.5 flex-shrink-0"></i>
        <span>${escaparHtml(obterTextoHorario(mesa))}</span>
      </div>
    </div>
    <div class="absolute right-4 bottom-3 text-[10px] text-muted opacity-0 group-hover:opacity-100">Ver detalhes</div>
  `;
  botao.addEventListener('click', () => abrirModal(mesa.id));
  return botao;
}

function renderizarGrid() {
  const mesasFiltradas = window.dadosMesas.filter(correspondeAoFiltro);
  elementos.grid.innerHTML = '';
  mesasFiltradas.forEach(mesa => elementos.grid.appendChild(criarCardMesa(mesa)));
  elementos.resultado.textContent = mesasFiltradas.length;
  elementos.estadoVazio.classList.toggle('hidden', mesasFiltradas.length > 0);
  lucide.createIcons();
}

function preencherTexto(id, valor, fallback = '—') {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor || fallback;
}

function abrirModal(id) {
  const mesa = window.dadosMesas.find(item => item.id === id);
  if (!mesa) return;

  const status = statusConfig[mesa.status];
  const reserva = reservaConfig[mesa.reservaStatus] || reservaConfig['sem-reserva'];
  const modal = elementos.modal;
  const titulo = document.getElementById('modalTitle');

  titulo.textContent = mesa.nome;
  document.getElementById('modalResumo').textContent = `${mesa.capacidade} lugares · ${mesa.pessoas || 0} pessoa(s) · ${mesa.pedidoAtual || 'Sem pedido'}`;

  const statusElemento = document.getElementById('modalStatus');
  statusElemento.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${status.badge}`;
  statusElemento.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${status.dot}"></span>${status.label}`;

  const avatar = document.getElementById('modalAvatar');
  avatar.className = `w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${status.avatar}`;
  avatar.innerHTML = `<i data-lucide="${status.icon}" class="w-5 h-5"></i>`;

  preencherTexto('modalReservadoPor', mesa.reservadoPor, mesa.status === 'disponivel' && mesa.reservaStatus === 'sem-reserva' ? 'Sem reserva' : 'Não informado');
  preencherTexto('modalHorario', mesa.horarioReserva ? `Reserva às ${mesa.horarioReserva}` : 'Sem horário agendado');
  preencherTexto('modalPessoas', mesa.pessoas ? `${mesa.pessoas} pessoa(s)` : 'Livre');
  preencherTexto('modalTelefone', mesa.telefone, 'Não informado');
  preencherTexto('modalCapacidade', `${mesa.capacidade} lugares`);
  preencherTexto('modalGarcom', mesa.garcom, 'Não atribuído');
  preencherTexto('modalChegada', mesa.chegada, mesa.status === 'ocupada' ? 'Não registrado' : 'Ainda não chegou');
  preencherTexto('modalDuracao', mesa.duracao, 'Não iniciado');
  preencherTexto('modalComanda', mesa.comanda, 'Sem comanda');
  preencherTexto('modalPedido', mesa.pedidoAtual, 'Sem pedido');
  preencherTexto('modalValor', mesa.valorGasto ? formatarMoeda(mesa.valorGasto) : 'R$ 0,00');
  preencherTexto('modalObservacoes', mesa.observacoes, 'Sem observações adicionais.');
  preencherTexto('modalPagamento', mesa.formaPagamento, 'Não definido');
  document.getElementById('modalPagamentoTexto').textContent = mesa.formaPagamento ? 'forma de pagamento' : 'forma de pagamento definida';

  const itensSecao = document.getElementById('modalItensSecao');
  const itens = document.getElementById('modalItens');
  if (mesa.itens && mesa.itens.length) {
    itensSecao.classList.remove('hidden');
    document.getElementById('modalContagemItens').textContent = `${mesa.itens.length} item(ns)`;
    itens.innerHTML = mesa.itens.map(item => `
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <div class="flex items-center gap-2 min-w-0"><i data-lucide="utensils-crossed" class="w-3.5 h-3.5 text-muted flex-shrink-0"></i><span class="text-xs sm:text-sm truncate">${escaparHtml(item.quantidade)}x ${escaparHtml(item.nome)}</span></div>
        <span class="text-xs font-medium whitespace-nowrap">${formatarMoeda(item.valor)}</span>
      </div>
    `).join('');
  } else {
    itensSecao.classList.add('hidden');
    itens.innerHTML = '';
  }

  const acao = document.getElementById('modalAcaoBtn');
  acao.dataset.mesaId = mesa.id;
  acao.querySelector('span').textContent = mesa.status === 'ocupada' ? 'Ver comanda' : mesa.reservaStatus === 'confirmada' ? 'Gerenciar reserva' : mesa.status === 'indisponivel' ? 'Ver bloqueio' : 'Abrir mesa';
  acao.classList.toggle('hidden', mesa.status === 'indisponivel' && !mesa.reservadoPor);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
  document.getElementById('modalClose').focus();
}

function fecharModal() {
  elementos.modal.classList.remove('is-open');
  elementos.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function mostrarNotificacao(mensagem) {
  let notificacao = document.getElementById('notificacaoMapa');
  if (!notificacao) {
    notificacao = document.createElement('div');
    notificacao.id = 'notificacaoMapa';
    notificacao.className = 'fixed bottom-5 right-5 z-[60] max-w-sm rounded-lg bg-card2 border border-border2 px-4 py-3 text-sm shadow-2xl';
    document.body.appendChild(notificacao);
  }
  notificacao.textContent = mensagem;
  notificacao.classList.remove('hidden');
  window.clearTimeout(mostrarNotificacao.timeout);
  mostrarNotificacao.timeout = window.setTimeout(() => notificacao.classList.add('hidden'), 2800);
}

elementos.busca?.addEventListener('input', renderizarGrid);
elementos.filtro?.addEventListener('change', renderizarGrid);
document.getElementById('limparFiltros')?.addEventListener('click', () => {
  elementos.busca.value = '';
  elementos.filtro.value = 'todas';
  renderizarGrid();
});

document.getElementById('modalClose')?.addEventListener('click', fecharModal);
document.getElementById('modalCloseBtn')?.addEventListener('click', fecharModal);
document.getElementById('modalBackdrop')?.addEventListener('click', fecharModal);
async function executarAcaoMesa(id) {
  const mesa = window.dadosMesas.find(item => String(item.id) === String(id));
  if (!mesa) return;
  if (mesa.status === 'ocupada') { fecharModal(); window.apexShell?.navegar('pedidos-ativos'); return; }
  if (mesa.reservaStatus === 'confirmada') { fecharModal(); window.apexShell?.navegar('reservas'); return; }
  if (mesa.status === 'indisponivel') { mostrarNotificacao('A mesa está bloqueada para uso.'); return; }
  if (!window.dadosMesasRemotoAtivo || !window.apexModulosApi?.atualizarSalao) { mostrarNotificacao('Não foi possível abrir a mesa. Tente novamente.'); return; }
  try { await window.apexModulosApi.atualizarSalao({ recurso: 'mesa', id: String(mesa.id), estado: 'ocupada' }); fecharModal(); await window.recarregarMesasReais?.(); mostrarNotificacao(`${mesa.nome} aberta para atendimento.`); } catch (erro) { mostrarNotificacao(erro.message || 'Não foi possível abrir a mesa.'); }
}
document.getElementById('modalAcaoBtn')?.addEventListener('click', event => executarAcaoMesa(event.currentTarget.dataset.mesaId));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && elementos.modal.classList.contains('is-open')) fecharModal();
});

function atualizarMapaRemoto() { atualizarEstatisticas(); renderizarGrid(); }
atualizarEstatisticas();
renderizarGrid();
document.addEventListener('apex:mesas-atualizado', atualizarMapaRemoto);
