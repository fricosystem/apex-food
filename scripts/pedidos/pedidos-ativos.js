'use strict';

const pedidosAtivos = () => window.dadosPedidosApexFood?.pedidosAtivos || [];
const statusAtivos = [
  { id: 'aguardando_confirmacao_garcom', estados: ['aguardando_confirmacao_garcom', 'novo'], titulo: 'Aguardando confirmação', icone: 'bell-ring', cor: 'text-blue', descricao: 'Cliente solicitou pelo QR ou fluxo legado' },
  { id: 'confirmado_garcom', titulo: 'Confirmados', icone: 'badge-check', cor: 'text-purpleLight', descricao: 'Prontos para enviar à cozinha' },
  { id: 'enviado_cozinha', titulo: 'Na fila da cozinha', icone: 'inbox', cor: 'text-blue', descricao: 'Aguardando início do preparo' },
  { id: 'em_preparo', estados: ['em_preparo', 'preparo'], titulo: 'Em preparo', icone: 'chef-hat', cor: 'text-yellow', descricao: 'Em produção na cozinha' },
  { id: 'pronto', titulo: 'Prontos', icone: 'check-circle-2', cor: 'text-green', descricao: 'Aguardando serviço na mesa' },
  { id: 'servido', titulo: 'Servidos', icone: 'send', cor: 'text-accent', descricao: 'Aguardando encaminhamento ao caixa' },
];
const statusOrdem = statusAtivos.map(item => item.id);
const elementosAtivos = { painel: document.getElementById('painelPedidos'), busca: document.getElementById('buscaAtivo'), canal: document.getElementById('filtroCanal') };
let detalhesModalAtual = '';

function moedaAtivo(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeAtivo(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function statusPedido(pedido) { return window.dadosPedidosApexFood.status[pedido.status] || { label: pedido.status || '—', classe: 'bg-card2 text-muted border-border2' }; }
function pedidosVisiveisAtivos() {
  const termo = elementosAtivos.busca.value.trim().toLocaleLowerCase('pt-BR');
  const canal = elementosAtivos.canal.value;
  return pedidosAtivos().filter(pedido => {
    const texto = `${pedido.id} ${pedido.mesa} ${pedido.cliente} ${pedido.garcom}`.toLocaleLowerCase('pt-BR');
    return (!termo || texto.includes(termo)) && (canal === 'todos' || pedido.canal === canal);
  });
}
function gerarChaveStatus() {
  const identificador = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pedido-status:${identificador}`;
}
function atualizarIndicadoresAtivos() {
  const contagem = pedidosAtivos().reduce((acc, pedido) => { if (acc[pedido.status] !== undefined) acc[pedido.status] += 1; return acc; }, { aguardando_confirmacao_garcom: 0, confirmado_garcom: 0, enviado_cozinha: 0, em_preparo: 0, pronto: 0 });
  document.getElementById('statAtivos').textContent = pedidosAtivos().length;
  document.getElementById('statNovos').textContent = contagem.aguardando_confirmacao_garcom;
  document.getElementById('statPreparo').textContent = contagem.em_preparo + contagem.enviado_cozinha;
  document.getElementById('statProntos').textContent = contagem.pronto;
}
function criarCardAtivo(pedido) {
  const status = statusPedido(pedido);
  const iconeCanal = pedido.canal === 'delivery' ? 'bike' : 'armchair';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `pedido-card prioridade-${pedido.prioridade || 'normal'} w-full text-left rounded-xl bg-card border border-border p-4`;
  card.setAttribute('aria-label', `Abrir detalhes do pedido ${pedido.id}`);
  card.dataset.pedidoId = String(pedido.id);
  card.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2"><span class="font-mono text-xs font-semibold">${escapeAtivo(pedido.id)}</span><span class="px-2 py-0.5 rounded-md ${status.classe} text-[10px] font-medium">${escapeAtivo(status.label)}</span></div><div class="flex items-center gap-2 mt-2 text-sm font-semibold"><i data-lucide="${iconeCanal}" class="w-4 h-4 text-muted"></i>${escapeAtivo(pedido.mesa)}</div></div><span class="flex items-center gap-1 text-[10px] text-muted"><i data-lucide="clock-3" class="w-3.5 h-3.5"></i>${escapeAtivo(pedido.tempo)}</span></div><div class="flex items-center justify-between gap-2 mt-4"><div class="min-w-0"><div class="text-sm truncate">${escapeAtivo(pedido.cliente)}</div><div class="text-xs text-muted mt-1">${escapeAtivo(pedido.garcom)} · ${escapeAtivo(pedido.horario)}</div></div><strong class="text-sm text-accent whitespace-nowrap">${moedaAtivo(pedido.valor)}</strong></div><div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border2"><span class="text-[10px] text-muted">${pedido.itens.length} itens · Prioridade ${pedido.prioridade === 'alta' ? 'alta' : 'normal'}</span><span class="text-xs text-accent">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3 inline"></i></span></div>`;
  return card;
}
function renderizarPainelAtivos() {
  const visiveis = pedidosVisiveisAtivos();
  elementosAtivos.painel.innerHTML = statusAtivos.map(coluna => {
    const pedidosColuna = visiveis.filter(pedido => (coluna.estados || [coluna.id]).includes(pedido.status));
    const cards = pedidosColuna.length ? pedidosColuna.map(pedido => { const wrapper = document.createElement('div'); wrapper.appendChild(criarCardAtivo(pedido)); return wrapper.innerHTML; }).join('') : `<div class="rounded-xl bg-card border border-border2 border-dashed p-6 text-center"><i data-lucide="inbox" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-xs font-medium">Nenhum pedido encontrado</p><p class="text-[10px] text-muted mt-1">A coluna está sem registros.</p></div>`;
    return `<section class="min-w-0"><div class="flex items-center justify-between mb-3"><div><div class="flex items-center gap-2"><i data-lucide="${coluna.icone}" class="w-4 h-4 ${coluna.cor}"></i><h3 class="text-sm font-semibold">${coluna.titulo}</h3><span class="px-1.5 py-0.5 rounded-md bg-card2 border border-border2 text-[10px] text-muted">${pedidosColuna.length}</span></div><p class="text-[10px] text-muted mt-1">${coluna.descricao}</p></div><button class="p-1.5 rounded-md hover:bg-card2 text-muted" aria-label="Atualizar ${coluna.titulo}" data-atualizar-coluna="${coluna.id}"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i></button></div><div class="space-y-3">${cards}</div></section>`;
  }).join('');
  document.getElementById('resultadoAtivos').textContent = visiveis.length;
  elementosAtivos.painel.querySelectorAll('[data-atualizar-coluna]').forEach(botao => botao.addEventListener('click', atualizarPedidosAtivos));
  window.lucide?.createIcons();
}
function preencherAtivo(id, valor, fallback = '—') { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor || fallback; }
function dataAtivo(valor) { if (!valor) return 'Data não informada'; const data = new Date(valor); return Number.isNaN(data.getTime()) ? 'Data não informada' : data.toLocaleString('pt-BR'); }
function renderizarDetalhesComandaAtiva(detalhes) {
  const participantes = document.getElementById('participantesModalPedido');
  const historico = document.getElementById('historicoModalPedido');
  const fichaEl = document.getElementById('fichaModalPedido');
  const listaParticipantes = Array.isArray(detalhes?.participantes) ? detalhes.participantes : [];
  const listaHistorico = Array.isArray(detalhes?.historico) ? detalhes.historico : [];
  const listaFichas = Array.isArray(detalhes?.fichas) ? detalhes.fichas : [];
  if (participantes) participantes.innerHTML = listaParticipantes.length ? listaParticipantes.map(item => `<div class="flex items-center justify-between gap-2"><span>${escapeAtivo(item.nomeExibicao)}</span><span class="text-[10px] text-muted">${escapeAtivo(item.estadoParticipante || 'ativo')}</span></div>`).join('') : '<span>Nenhum participante encontrado.</span>';
  if (historico) historico.innerHTML = listaHistorico.length ? listaHistorico.slice(0, 8).map(item => `<div class="border-l-2 border-border pl-2"><div class="flex items-center justify-between gap-2"><span class="font-medium">${escapeAtivo(item.statusNovo || 'Atualização')}</span><span class="text-[10px] text-muted">${escapeAtivo(dataAtivo(item.criadoEm))}</span></div><p class="text-[10px] text-muted mt-1">${escapeAtivo(item.motivo || 'Sem observação registrada.')}</p></div>`).join('') : '<span>Nenhum evento registrado.</span>';
  if (fichaEl) fichaEl.innerHTML = listaFichas.length ? listaFichas.map(ficha => `<div><div class="flex items-center justify-between gap-2"><span class="font-medium">${escapeAtivo(ficha.statusFicha || 'Ficha')}</span><span class="text-[10px] text-muted">${Number(ficha.tarefasAtribuidas || 0)}/${Number(ficha.tarefasTotal || ficha.tarefas?.length || 0)} tarefas</span></div><p class="text-[10px] text-muted mt-1">${escapeAtivo(ficha.statusDistribuicaoCozinha || 'Distribuição pendente')}</p></div>`).join('') : '<span>Este pedido ainda não possui ficha de cozinha.</span>';
}
async function carregarDetalhesModalPedido(idComanda) {
  detalhesModalAtual = String(idComanda || '');
  if (!idComanda || !window.apexModulosApi?.obterDetalhesComanda) {
    renderizarDetalhesComandaAtiva(null);
    return;
  }
  try {
    const resposta = await window.apexModulosApi.obterDetalhesComanda(String(idComanda));
    if (detalhesModalAtual === String(idComanda)) renderizarDetalhesComandaAtiva(resposta);
  } catch (erro) {
    if (detalhesModalAtual === String(idComanda)) {
      renderizarDetalhesComandaAtiva(null);
      const historico = document.getElementById('historicoModalPedido');
      if (historico) historico.textContent = erro.message || 'Não foi possível carregar o histórico.';
    }
  }
}
function abrirModalAtivo(id) {
  const pedido = pedidosAtivos().find(item => String(item.id) === String(id)); if (!pedido) return;
  const status = statusPedido(pedido);
  document.getElementById('tituloModalPedido').textContent = pedido.id;
  document.getElementById('resumoModalPedido').textContent = `${pedido.mesa} · ${pedido.cliente} · ${pedido.horario}`;
  const statusEl = document.getElementById('statusModalPedido'); statusEl.className = `px-2.5 py-1 rounded-md text-xs font-medium border ${status.classe}`; statusEl.textContent = status.label;
  document.getElementById('dadosModalPedido').innerHTML = [['Cliente', pedido.cliente], ['Mesa / canal', `${pedido.mesa} · ${pedido.canal}`], ['Garçom', pedido.garcom], ['Horário', pedido.horario], ['Tempo', pedido.tempo], ['Valor total', moedaAtivo(pedido.valor)]].map(([label, valor]) => `<div class="rounded-lg bg-card2 border border-border2 p-3"><div class="text-[10px] text-muted uppercase tracking-wider mb-1">${label}</div><div class="text-sm font-medium">${escapeAtivo(valor)}</div></div>`).join('');
  document.getElementById('contagemModalPedido').textContent = `${pedido.itens.length} item(ns)`;
  document.getElementById('itensModalPedido').innerHTML = pedido.itens.map(item => `<div class="flex items-center justify-between gap-3 px-3 py-2.5"><span class="text-xs sm:text-sm">${item.quantidade}x ${escapeAtivo(item.nome)}</span><span class="text-xs font-medium">${moedaAtivo(item.valor)}</span></div>`).join('');
  document.getElementById('observacoesModalPedido').textContent = pedido.observacoes || 'Sem observações.';
  const acao = document.getElementById('acaoModalPedido');
  const recusar = document.getElementById('recusarModalPedido');
  const encaminhar = document.getElementById('encaminharCaixaModalPedido');
  acao.dataset.pedidoId = pedido.id;
  recusar.dataset.pedidoId = pedido.id;
  encaminhar.dataset.pedidoId = pedido.id;
  const proximo = pedido.status === 'novo' ? 'preparo' : pedido.status === 'preparo' ? 'pronto' : pedido.status === 'aguardando_confirmacao_garcom' ? 'confirmado_garcom' : pedido.status === 'confirmado_garcom' ? 'enviado_cozinha' : pedido.status === 'pronto' ? (pedido.origem === 'cardapioDigital' ? 'servido' : 'entregue') : '';
  acao.querySelector('span').textContent = proximo === 'confirmado_garcom' ? 'Confirmar pedido' : proximo === 'enviado_cozinha' ? 'Enviar à cozinha' : proximo === 'servido' ? 'Marcar como servido' : proximo === 'preparo' ? 'Iniciar preparo' : proximo === 'pronto' ? 'Marcar como pronto' : proximo === 'entregue' ? 'Marcar como entregue' : 'Aguardando operação';
  acao.classList.toggle('hidden', !proximo);
  recusar.classList.toggle('hidden', pedido.status !== 'aguardando_confirmacao_garcom');
  encaminhar.classList.toggle('hidden', pedido.status !== 'servido');
  acao.classList.toggle('hidden', pedido.status === 'servido' || !proximo);
  const modal = document.getElementById('modalPedido'); modal.classList.add('aberto'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; window.lucide?.createIcons(); document.getElementById('fecharModalPedido').focus(); carregarDetalhesModalPedido(pedido.idComanda || pedido.comandaId || '');
}
function fecharModalAtivo() { const modal = document.getElementById('modalPedido'); modal.classList.remove('aberto'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
async function atualizarPedidosAtivos() { if (window.recarregarPedidosReais) await window.recarregarPedidosReais(); else renderizarPainelAtivos(); }
async function avancarPedidoAtivo() {
  const acao = document.getElementById('acaoModalPedido');
  const pedido = pedidosAtivos().find(item => String(item.id) === String(acao.dataset.pedidoId));
  if (!pedido) return;
  const proximo = pedido.status === 'novo' ? 'preparo' : pedido.status === 'preparo' ? 'pronto' : pedido.status === 'aguardando_confirmacao_garcom' ? 'confirmado_garcom' : pedido.status === 'confirmado_garcom' ? 'enviado_cozinha' : pedido.status === 'pronto' ? (pedido.origem === 'cardapioDigital' ? 'servido' : 'entregue') : '';
  if (!proximo) return;
  if (!window.dadosPedidosRemotoAtivo || !window.apexModulosApi?.atualizarStatusPedido) { mostrarAvisoPedido('Não foi possível atualizar o status deste pedido. Tente novamente.'); return; }
  acao.disabled = true;
  try {
    await window.apexModulosApi.atualizarStatusPedido({ id: String(pedido.id), status: proximo, chaveIdempotencia: gerarChaveStatus() });
    fecharModalAtivo();
    await atualizarPedidosAtivos();
    mostrarAvisoPedido(`${pedido.id} avançado para ${statusPedido({ status: proximo }).label}.`);
  } catch (erro) { mostrarAvisoPedido(erro.message || 'Não foi possível alterar o status do pedido.'); }
  finally { acao.disabled = false; }
}
async function encaminharComandaAoCaixa() {
  const botao = document.getElementById('encaminharCaixaModalPedido');
  const pedido = pedidosAtivos().find(item => String(item.id) === String(botao.dataset.pedidoId));
  if (!pedido || pedido.status !== 'servido') return;
  if (!window.dadosPedidosRemotoAtivo || !window.apexModulosApi?.encaminharComandaCaixa) { mostrarAvisoPedido('Não foi possível encaminhar a comanda ao caixa. Tente novamente.'); return; }
  botao.disabled = true;
  try {
    await window.apexModulosApi.encaminharComandaCaixa({ idComanda: String(pedido.idComanda || ''), idMesa: String(pedido.idMesa || ''), chaveIdempotencia: gerarChaveStatus() });
    fecharModalAtivo();
    await atualizarPedidosAtivos();
    mostrarAvisoPedido('Comanda encaminhada ao caixa para conferência operacional.');
  } catch (erro) { mostrarAvisoPedido(erro.message || 'Não foi possível encaminhar a comanda ao caixa.'); }
  finally { botao.disabled = false; }
}
async function recusarPedidoAtivo() {
  const botao = document.getElementById('recusarModalPedido');
  const pedido = pedidosAtivos().find(item => String(item.id) === String(botao.dataset.pedidoId));
  if (!pedido || pedido.status !== 'aguardando_confirmacao_garcom') return;
  const motivo = window.prompt('Informe o motivo da recusa do pedido:');
  if (!motivo?.trim()) return;
  if (!window.dadosPedidosRemotoAtivo || !window.apexModulosApi?.atualizarStatusPedido) { mostrarAvisoPedido('Não foi possível recusar este pedido. Tente novamente.'); return; }
  botao.disabled = true;
  try {
    await window.apexModulosApi.atualizarStatusPedido({ id: String(pedido.id), status: 'rejeitado_garcom', motivoRejeicao: motivo.trim(), chaveIdempotencia: gerarChaveStatus() });
    fecharModalAtivo();
    await atualizarPedidosAtivos();
    mostrarAvisoPedido(`${pedido.id} foi recusado e a comanda foi atualizada.`);
  } catch (erro) { mostrarAvisoPedido(erro.message || 'Não foi possível recusar o pedido.'); }
  finally { botao.disabled = false; }
}

elementosAtivos.painel.addEventListener('click', event => {
  const card = event.target.closest('[data-pedido-id]');
  if (!card || !elementosAtivos.painel.contains(card)) return;
  event.preventDefault();
  abrirModalAtivo(card.dataset.pedidoId);
});
elementosAtivos.busca.addEventListener('input', renderizarPainelAtivos);
elementosAtivos.canal.addEventListener('change', renderizarPainelAtivos);
document.getElementById('fecharModalPedido').addEventListener('click', fecharModalAtivo);
document.getElementById('fecharModalPedidoBtn').addEventListener('click', fecharModalAtivo);
document.getElementById('backdropPedido').addEventListener('click', fecharModalAtivo);
document.getElementById('acaoModalPedido').addEventListener('click', avancarPedidoAtivo);
document.getElementById('recusarModalPedido').addEventListener('click', recusarPedidoAtivo);
document.getElementById('encaminharCaixaModalPedido').addEventListener('click', encaminharComandaAoCaixa);
document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalAtivo(); });
document.addEventListener('apex:pedidos-atualizado', () => { atualizarIndicadoresAtivos(); renderizarPainelAtivos(); });
atualizarIndicadoresAtivos();
renderizarPainelAtivos();
window.lucide?.createIcons();
