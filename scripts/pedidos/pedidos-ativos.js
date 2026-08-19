const pedidosAtivos = window.dadosPedidosApexFood.pedidosAtivos;
const statusAtivos = [
  { id: 'novo', titulo: 'Novos', icone: 'bell-ring', cor: 'text-blue', descricao: 'Aguardando aceite' },
  { id: 'preparo', titulo: 'Em preparo', icone: 'chef-hat', cor: 'text-yellow', descricao: 'Na fila da cozinha' },
  { id: 'pronto', titulo: 'Prontos', icone: 'check-circle-2', cor: 'text-green', descricao: 'Aguardando entrega' }
];
const statusOrdem = ['novo', 'preparo', 'pronto'];
const elementosAtivos = { painel: document.getElementById('painelPedidos'), busca: document.getElementById('buscaAtivo'), canal: document.getElementById('filtroCanal') };

function moedaAtivo(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeAtivo(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function pedidosVisiveisAtivos() {
  const termo = elementosAtivos.busca.value.trim().toLocaleLowerCase('pt-BR');
  const canal = elementosAtivos.canal.value;
  return pedidosAtivos.filter(pedido => {
    const texto = `${pedido.id} ${pedido.mesa} ${pedido.cliente} ${pedido.garcom}`.toLocaleLowerCase('pt-BR');
    return (!termo || texto.includes(termo)) && (canal === 'todos' || pedido.canal === canal);
  });
}
function atualizarIndicadoresAtivos() {
  const contagem = pedidosAtivos.reduce((acc, pedido) => { acc[pedido.status] += 1; return acc; }, { novo: 0, preparo: 0, pronto: 0 });
  document.getElementById('statAtivos').textContent = pedidosAtivos.length;
  document.getElementById('statNovos').textContent = contagem.novo;
  document.getElementById('statPreparo').textContent = contagem.preparo;
  document.getElementById('statProntos').textContent = contagem.pronto;
}
function criarCardAtivo(pedido) {
  const status = window.dadosPedidosApexFood.status[pedido.status];
  const iconeCanal = pedido.canal === 'delivery' ? 'bike' : 'armchair';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `pedido-card prioridade-${pedido.prioridade} w-full text-left rounded-xl bg-card border border-border p-4`;
  card.setAttribute('aria-label', `Abrir detalhes do pedido ${pedido.id}`);
  card.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2"><span class="font-mono text-xs font-semibold">${escapeAtivo(pedido.id)}</span><span class="px-2 py-0.5 rounded-md ${status.classe} text-[10px] font-medium">${status.label}</span></div><div class="flex items-center gap-2 mt-2 text-sm font-semibold"><i data-lucide="${iconeCanal}" class="w-4 h-4 text-muted"></i>${escapeAtivo(pedido.mesa)}</div></div><span class="flex items-center gap-1 text-[10px] text-muted"><i data-lucide="clock-3" class="w-3.5 h-3.5"></i>${escapeAtivo(pedido.tempo)}</span></div><div class="flex items-center justify-between gap-2 mt-4"><div class="min-w-0"><div class="text-sm truncate">${escapeAtivo(pedido.cliente)}</div><div class="text-xs text-muted mt-1">${escapeAtivo(pedido.garcom)} · ${escapeAtivo(pedido.horario)}</div></div><strong class="text-sm text-accent whitespace-nowrap">${moedaAtivo(pedido.valor)}</strong></div><div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border2"><span class="text-[10px] text-muted">${pedido.itens.length} itens · Prioridade ${pedido.prioridade === 'alta' ? 'alta' : 'normal'}</span><span class="text-xs text-accent">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3 inline"></i></span></div>`;
  card.addEventListener('click', () => abrirModalAtivo(pedido.id));
  return card;
}
function renderizarPainelAtivos() {
  const visiveis = pedidosVisiveisAtivos();
  elementosAtivos.painel.innerHTML = statusAtivos.map(coluna => {
    const pedidosColuna = visiveis.filter(pedido => pedido.status === coluna.id);
    const cards = pedidosColuna.length ? pedidosColuna.map(pedido => { const wrapper = document.createElement('div'); wrapper.appendChild(criarCardAtivo(pedido)); return wrapper.innerHTML; }).join('') : `<div class="rounded-xl bg-card border border-border2 border-dashed p-6 text-center"><i data-lucide="inbox" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-xs font-medium">Nenhum pedido</p><p class="text-[10px] text-muted mt-1">A coluna está em dia.</p></div>`;
    return `<section class="min-w-0"><div class="flex items-center justify-between mb-3"><div><div class="flex items-center gap-2"><i data-lucide="${coluna.icone}" class="w-4 h-4 ${coluna.cor}"></i><h3 class="text-sm font-semibold">${coluna.titulo}</h3><span class="px-1.5 py-0.5 rounded-md bg-card2 border border-border2 text-[10px] text-muted">${pedidosColuna.length}</span></div><p class="text-[10px] text-muted mt-1">${coluna.descricao}</p></div><button class="p-1.5 rounded-md hover:bg-card2 text-muted" aria-label="Atualizar ${coluna.titulo}" data-atualizar-coluna="${coluna.id}"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i></button></div><div class="space-y-3">${cards}</div></section>`;
  }).join('');
  document.getElementById('resultadoAtivos').textContent = visiveis.length;
  elementosAtivos.painel.querySelectorAll('[data-atualizar-coluna]').forEach(botao => botao.addEventListener('click', () => mostrarAvisoPedido('Coluna atualizada.')));
  window.lucide?.createIcons();
}
function preencherAtivo(id, valor, fallback = '—') { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor || fallback; }
function abrirModalAtivo(id) {
  const pedido = pedidosAtivos.find(item => item.id === id); if (!pedido) return;
  const status = window.dadosPedidosApexFood.status[pedido.status];
  document.getElementById('tituloModalPedido').textContent = pedido.id;
  document.getElementById('resumoModalPedido').textContent = `${pedido.mesa} · ${pedido.cliente} · ${pedido.horario}`;
  const statusEl = document.getElementById('statusModalPedido'); statusEl.className = `px-2.5 py-1 rounded-md text-xs font-medium border ${status.classe}`; statusEl.textContent = status.label;
  document.getElementById('dadosModalPedido').innerHTML = [['Cliente', pedido.cliente], ['Mesa / canal', `${pedido.mesa} · ${pedido.canal}`], ['Garçom', pedido.garcom], ['Horário', pedido.horario], ['Tempo', pedido.tempo], ['Valor total', moedaAtivo(pedido.valor)]].map(([label, valor]) => `<div class="rounded-lg bg-card2 border border-border2 p-3"><div class="text-[10px] text-muted uppercase tracking-wider mb-1">${label}</div><div class="text-sm font-medium">${escapeAtivo(valor)}</div></div>`).join('');
  document.getElementById('contagemModalPedido').textContent = `${pedido.itens.length} item(ns)`;
  document.getElementById('itensModalPedido').innerHTML = pedido.itens.map(item => `<div class="flex items-center justify-between gap-3 px-3 py-2.5"><span class="text-xs sm:text-sm">${item.quantidade}x ${escapeAtivo(item.nome)}</span><span class="text-xs font-medium">${moedaAtivo(item.valor)}</span></div>`).join('');
  document.getElementById('observacoesModalPedido').textContent = pedido.observacoes || 'Sem observações.';
  const acao = document.getElementById('acaoModalPedido'); acao.dataset.pedidoId = pedido.id; acao.querySelector('span').textContent = pedido.status === 'pronto' ? 'Marcar como entregue' : 'Avançar status'; acao.classList.toggle('hidden', pedido.status === 'pronto');
  const modal = document.getElementById('modalPedido'); modal.classList.add('aberto'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; window.lucide?.createIcons(); document.getElementById('fecharModalPedido').focus();
}
function fecharModalAtivo() { const modal = document.getElementById('modalPedido'); modal.classList.remove('aberto'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

elementosAtivos.busca.addEventListener('input', renderizarPainelAtivos);
elementosAtivos.canal.addEventListener('change', renderizarPainelAtivos);
document.getElementById('fecharModalPedido').addEventListener('click', fecharModalAtivo);
document.getElementById('fecharModalPedidoBtn').addEventListener('click', fecharModalAtivo);
document.getElementById('backdropPedido').addEventListener('click', fecharModalAtivo);
document.getElementById('acaoModalPedido').addEventListener('click', event => { const pedido = pedidosAtivos.find(item => item.id === event.currentTarget.dataset.pedidoId); if (!pedido) return; const atual = statusOrdem.indexOf(pedido.status); if (atual >= 0 && atual < statusOrdem.length - 1) { pedido.status = statusOrdem[atual + 1]; pedido.statusLabel = window.dadosPedidosApexFood.status[pedido.status].label; fecharModalAtivo(); atualizarIndicadoresAtivos(); renderizarPainelAtivos(); mostrarAvisoPedido(`${pedido.id} avançado para ${pedido.statusLabel}.`); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalAtivo(); });
atualizarIndicadoresAtivos();
renderizarPainelAtivos();
window.lucide?.createIcons();
