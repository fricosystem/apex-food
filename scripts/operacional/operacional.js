const pedidosOperacionais = window.dadosPedidosApexFood.pedidosAtivos;
const statusOperacional = window.dadosPedidosApexFood.status;

function moedaOperacional(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeOperacional(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function minutosOperacionais(tempo) { return Number.parseInt(String(tempo).replace(/[^0-9]/g, ''), 10) || 0; }

function calcularOperacao() {
  const contagem = pedidosOperacionais.reduce((acc, pedido) => { acc[pedido.status] += 1; return acc; }, { novo: 0, preparo: 0, pronto: 0 });
  const media = Math.round(pedidosOperacionais.reduce((total, pedido) => total + minutosOperacionais(pedido.tempo), 0) / Math.max(pedidosOperacionais.length, 1));
  const alertas = pedidosOperacionais.filter(pedido => minutosOperacionais(pedido.tempo) >= 20 || pedido.prioridade === 'alta').length;
  const capacidade = Math.min(100, Math.round((contagem.novo * 0.8 + contagem.preparo * 1.3 + contagem.pronto * 0.6) * 10));
  return { contagem, media, alertas, capacidade };
}
function renderizarIndicadoresOperacionais() {
  const operacao = calcularOperacao();
  document.getElementById('operacionalAtivos').textContent = pedidosOperacionais.length;
  document.getElementById('operacionalTempo').textContent = `${operacao.media} min`;
  document.getElementById('operacionalAlertas').textContent = operacao.alertas;
  document.getElementById('capacidadeTexto').textContent = `${operacao.capacidade}%`;
  document.getElementById('capacidadeBarra').style.width = `${operacao.capacidade}%`;
  document.getElementById('fluxoPedidos').innerHTML = [
    { id: 'novo', label: 'Novos', icone: 'bell-ring', cor: 'text-blue', barra: 'bg-blue' },
    { id: 'preparo', label: 'Em preparo', icone: 'chef-hat', cor: 'text-yellow', barra: 'bg-yellow' },
    { id: 'pronto', label: 'Prontos', icone: 'check-circle-2', cor: 'text-green', barra: 'bg-green' }
  ].map(status => { const quantidade = operacao.contagem[status.id]; const percentual = Math.round((quantidade / Math.max(pedidosOperacionais.length, 1)) * 100); return `<div class="rounded-lg bg-card2 border border-border2 p-3"><div class="flex items-center justify-between"><span class="flex items-center gap-2 text-xs font-medium"><i data-lucide="${status.icone}" class="w-4 h-4 ${status.cor}"></i>${status.label}</span><span class="text-lg font-bold">${quantidade}</span></div><div class="h-1.5 rounded-full bg-card mt-4 overflow-hidden"><div class="barra-fluxo h-full ${status.barra} rounded-full" style="width: ${percentual}%"></div></div><div class="text-[10px] text-muted mt-2">${percentual}% dos pedidos ativos</div></div>`; }).join('');
  window.lucide?.createIcons();
}
function renderizarAlertasOperacionais() {
  const alertas = [];
  pedidosOperacionais.filter(pedido => minutosOperacionais(pedido.tempo) >= 20).forEach(pedido => alertas.push({ tipo: 'tempo', cor: 'text-red', fundo: 'bg-red/10', icone: 'clock-alert', titulo: `${pedido.id} acima do tempo médio`, detalhe: `${pedido.mesa} · ${pedido.tempo} de espera` }));
  pedidosOperacionais.filter(pedido => pedido.prioridade === 'alta').forEach(pedido => alertas.push({ tipo: 'prioridade', cor: 'text-yellow', fundo: 'bg-yellow/10', icone: 'flame', titulo: `${pedido.id} com prioridade alta`, detalhe: `${pedido.mesa} · ${pedido.cliente}` }));
  const lista = document.getElementById('listaAlertas');
  lista.innerHTML = alertas.length ? alertas.slice(0, 4).map(alerta => `<button type="button" class="alerta-item w-full flex items-start gap-3 text-left rounded-lg bg-card2 border border-border2 p-3" data-alerta="${alerta.tipo}"><div class="w-8 h-8 rounded-lg ${alerta.fundo} flex items-center justify-center flex-shrink-0"><i data-lucide="${alerta.icone}" class="w-4 h-4 ${alerta.cor}"></i></div><div class="min-w-0"><div class="text-xs font-medium">${escapeOperacional(alerta.titulo)}</div><div class="text-[10px] text-muted mt-1 truncate">${escapeOperacional(alerta.detalhe)}</div></div><i data-lucide="chevron-right" class="w-3.5 h-3.5 text-muted ml-auto mt-1"></i></button>`).join('') : `<div class="rounded-lg bg-card2 border border-border2 border-dashed py-8 text-center"><i data-lucide="circle-check" class="w-5 h-5 text-green mx-auto mb-2"></i><p class="text-xs font-medium">Operação em dia</p><p class="text-[10px] text-muted mt-1">Nenhum alerta ativo.</p></div>`;
  lista.querySelectorAll('[data-alerta]').forEach(alerta => alerta.addEventListener('click', () => mostrarAvisoPedido('Alerta encaminhado para acompanhamento.')));
  window.lucide?.createIcons();
}
function renderizarPedidosOperacionais() {
  document.getElementById('listaOperacionalPedidos').innerHTML = pedidosOperacionais.slice(0, 5).map(pedido => { const status = statusOperacional[pedido.status]; return `<a href="../pedidos/pedidos-ativos.html" class="pedido-operacional flex items-center gap-3 rounded-lg border border-border2 p-3"><div class="w-9 h-9 rounded-lg ${status.classe} flex items-center justify-center"><i data-lucide="${pedido.canal === 'delivery' ? 'bike' : 'armchair'}" class="w-4 h-4"></i></div><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span class="font-mono text-xs font-semibold">${escapeOperacional(pedido.id)}</span><span class="text-[10px] ${status.classe} px-1.5 py-0.5 rounded">${status.label}</span></div><div class="text-xs mt-1 truncate">${escapeOperacional(pedido.mesa)} · ${escapeOperacional(pedido.cliente)}</div></div><div class="text-right"><div class="text-xs font-semibold text-accent">${moedaOperacional(pedido.valor)}</div><div class="text-[10px] text-muted mt-1">${escapeOperacional(pedido.tempo)}</div></div></a>`; }).join('');
  window.lucide?.createIcons();
}
function renderizarEquipe() {
  const equipe = {};
  pedidosOperacionais.forEach(pedido => { equipe[pedido.garcom] = (equipe[pedido.garcom] || 0) + 1; });
  const maior = Math.max(...Object.values(equipe), 1);
  document.getElementById('desempenhoEquipe').innerHTML = Object.entries(equipe).map(([nome, total]) => `<div><div class="flex items-center justify-between gap-3 text-xs"><span class="truncate">${escapeOperacional(nome)}</span><span class="text-muted">${total} pedido(s)</span></div><div class="h-1.5 rounded-full bg-card2 mt-2 overflow-hidden"><div class="barra-equipe h-full bg-gradient-to-r from-accent to-orange-400 rounded-full" style="width: ${Math.round((total / maior) * 100)}%"></div></div></div>`).join('');
}
function atualizarOperacional() { renderizarIndicadoresOperacionais(); renderizarAlertasOperacionais(); renderizarPedidosOperacionais(); renderizarEquipe(); }
document.getElementById('atualizarOperacional').addEventListener('click', () => { atualizarOperacional(); mostrarAvisoPedido('Dados operacionais atualizados.'); });
document.getElementById('filtrarEquipe').addEventListener('click', () => { renderizarEquipe(); mostrarAvisoPedido('Desempenho da equipe atualizado.'); });
atualizarOperacional();
