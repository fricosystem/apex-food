'use strict';

const pedidosHistorico = () => window.dadosPedidosApexFood?.pedidosHistorico || [];
const elementosHistorico = { busca: document.getElementById('buscaHistorico'), periodo: document.getElementById('filtroPeriodo'), status: document.getElementById('filtroHistoricoStatus'), tabela: document.getElementById('tabelaHistorico'), vazio: document.getElementById('estadoVazioHistorico') };
function moedaHistorico(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeHistorico(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function dataPedido(pedido) { const partes = String(pedido.data || '').split('/'); return partes.length === 3 ? new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0])) : null; }
function historicoVisivel() {
  const termo = elementosHistorico.busca.value.trim().toLocaleLowerCase('pt-BR');
  const periodo = elementosHistorico.periodo.value;
  const status = elementosHistorico.status.value;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  return pedidosHistorico().filter(pedido => {
    const texto = `${pedido.id} ${pedido.cliente} ${pedido.mesa} ${pedido.garcom} ${pedido.pagamento}`.toLocaleLowerCase('pt-BR');
    const data = dataPedido(pedido);
    const dataOk = periodo === 'todos' || !data || (periodo === 'hoje' && data.getTime() === hoje.getTime()) || (periodo === 'ontem' && data.getTime() === ontem.getTime());
    return (!termo || texto.includes(termo)) && dataOk && (status === 'todos' || pedido.status === status);
  });
}
function atualizarEstatisticasHistorico(lista) {
  const finalizados = lista.filter(pedido => pedido.status === 'finalizado' || pedido.status === 'entregue');
  const faturamento = finalizados.reduce((total, pedido) => total + Number(pedido.valor || 0), 0);
  document.getElementById('statHistoricoQuantidade').textContent = lista.length;
  document.getElementById('statHistoricoFaturamento').textContent = lista.length ? moedaHistorico(faturamento) : '—';
  document.getElementById('statHistoricoTicket').textContent = finalizados.length ? moedaHistorico(faturamento / finalizados.length) : '—';
  document.getElementById('resultadoHistorico').textContent = lista.length;
}
function renderizarHistorico() {
  const lista = historicoVisivel();
  atualizarEstatisticasHistorico(lista);
  elementosHistorico.tabela.innerHTML = lista.map(pedido => {
    const status = window.dadosPedidosApexFood.status[pedido.status] || { label: pedido.status || '—', classe: 'bg-card2 text-muted border-border2' };
    return `<tr class="border-b border-border hover:bg-card2/50 transition"><td class="p-4 font-mono text-xs font-semibold">${escapeHistorico(pedido.id)}</td><td class="p-4"><div>${escapeHistorico(pedido.data)}</div><div class="text-xs text-muted mt-1">${escapeHistorico(pedido.horario)}</div></td><td class="p-4"><div class="font-medium">${escapeHistorico(pedido.cliente)}</div><div class="text-xs text-muted mt-1">${escapeHistorico(pedido.mesa)}</div></td><td class="p-4"><span class="flex items-center gap-2 text-xs"><i data-lucide="${pedido.canal === 'delivery' ? 'bike' : 'armchair'}" class="w-3.5 h-3.5 text-muted"></i>${pedido.canal === 'delivery' ? 'Delivery' : 'Salão'}</span></td><td class="p-4 text-xs">${escapeHistorico(pedido.garcom)}</td><td class="p-4 text-xs text-muted">${escapeHistorico(pedido.pagamento)}</td><td class="p-4 font-semibold">${moedaHistorico(pedido.valor)}</td><td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-medium border ${status.classe}">${escapeHistorico(status.label)}</span></td><td class="p-4"><button type="button" data-historico-id="${escapeHistorico(pedido.id)}" class="p-2 rounded-lg hover:bg-card2 text-muted" aria-label="Ver detalhes de ${escapeHistorico(pedido.id)}"><i data-lucide="chevron-right" class="w-4 h-4"></i></button></td></tr>`;
  }).join('');
  elementosHistorico.vazio.classList.toggle('hidden', lista.length > 0);
  elementosHistorico.tabela.parentElement.classList.toggle('hidden', lista.length === 0);
  elementosHistorico.tabela.querySelectorAll('[data-historico-id]').forEach(botao => botao.addEventListener('click', () => abrirModalHistorico(botao.dataset.historicoId)));
  window.lucide?.createIcons();
}
function abrirModalHistorico(id) {
  const pedido = pedidosHistorico().find(item => String(item.id) === String(id)); if (!pedido) return;
  const status = window.dadosPedidosApexFood.status[pedido.status] || { label: pedido.status || '—', classe: 'bg-card2 text-muted border-border2' };
  document.getElementById('tituloModalHistorico').textContent = pedido.id;
  document.getElementById('resumoModalHistorico').textContent = `${pedido.data} · ${pedido.horario} · ${pedido.cliente}`;
  document.getElementById('dadosModalHistorico').innerHTML = [['Cliente', pedido.cliente], ['Mesa / canal', `${pedido.mesa} · ${pedido.canal}`], ['Garçom', pedido.garcom], ['Pagamento', pedido.pagamento], ['Valor total', moedaHistorico(pedido.valor)], ['Status', status.label]].map(([label, valor]) => `<div class="rounded-lg bg-card2 border border-border2 p-3"><div class="text-[10px] text-muted uppercase tracking-wider mb-1">${label}</div><div class="text-sm font-medium">${escapeHistorico(valor)}</div></div>`).join('');
  document.getElementById('contagemModalHistorico').textContent = `${pedido.itensQuantidade || pedido.itens.length} item(ns)`;
  document.getElementById('itensModalHistorico').innerHTML = pedido.itens.map(item => `<div class="flex items-center justify-between gap-3 px-3 py-2.5"><span class="text-xs sm:text-sm">${item.quantidade}x ${escapeHistorico(item.nome)}</span><span class="text-xs font-medium">${moedaHistorico(item.valor)}</span></div>`).join('') || `<div class="px-3 py-4 text-xs text-muted">Nenhum item encontrado.</div>`;
  const modal = document.getElementById('modalHistorico'); modal.classList.add('aberto'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; window.lucide?.createIcons(); document.getElementById('fecharModalHistorico').focus();
}
function fecharModalHistorico() { const modal = document.getElementById('modalHistorico'); modal.classList.remove('aberto'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
function exportarHistorico() {
  const lista = historicoVisivel();
  if (!lista.length) { mostrarAvisoPedido('Não há pedidos para exportar.'); return; }
  const linhas = [['Pedido', 'Data', 'Cliente', 'Mesa', 'Canal', 'Garçom', 'Pagamento', 'Valor', 'Status'], ...lista.map(pedido => [pedido.id, pedido.data, pedido.cliente, pedido.mesa, pedido.canal, pedido.garcom, pedido.pagamento, Number(pedido.valor || 0).toFixed(2).replace('.', ','), pedido.status])];
  const csv = `\uFEFF${linhas.map(linha => linha.map(valor => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const ancora = document.createElement('a'); ancora.href = url; ancora.download = `historico-pedidos-${new Date().toISOString().slice(0, 10)}.csv`; ancora.click(); URL.revokeObjectURL(url);
}
elementosHistorico.busca.addEventListener('input', renderizarHistorico); elementosHistorico.periodo.addEventListener('change', renderizarHistorico); elementosHistorico.status.addEventListener('change', renderizarHistorico); document.getElementById('fecharModalHistorico').addEventListener('click', fecharModalHistorico); document.getElementById('fecharModalHistoricoBtn').addEventListener('click', fecharModalHistorico); document.getElementById('backdropHistorico').addEventListener('click', fecharModalHistorico); document.getElementById('exportarHistorico').addEventListener('click', exportarHistorico); document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalHistorico(); });
document.addEventListener('apex:pedidos-atualizado', renderizarHistorico);
renderizarHistorico(); window.lucide?.createIcons();
