const pedidosCozinha = () => (window.dadosPedidosApexFood?.pedidosAtivos || []).filter(pedido => ['enviado_cozinha', 'em_preparo', 'pronto', 'novo', 'preparo'].includes(pedido.status));
const fichasCozinha = () => window.dadosPedidosApexFood?.fichasCozinha || [];
const colunasCozinha = [
  { id: 'enviado_cozinha', estados: ['enviado_cozinha', 'novo'], titulo: 'Aguardando preparo', descricao: 'Pedidos confirmados pelo garçom', icone: 'inbox', cor: 'text-blue', acao: 'Iniciar preparo' },
  { id: 'em_preparo', estados: ['em_preparo', 'preparo'], titulo: 'Em preparo', descricao: 'Pedidos na bancada', icone: 'flame', cor: 'text-yellow', acao: 'Marcar como pronto' },
  { id: 'pronto', titulo: 'Prontos', descricao: 'Aguardando o garçom servir', icone: 'check-circle-2', cor: 'text-green', acao: 'Aguardando garçom' },
];
const elementosCozinha = { busca: document.getElementById('buscaCozinha'), prioridade: document.getElementById('filtroPrioridade'), painel: document.getElementById('painelCozinha') };
function moedaCozinha(valor) { return window.ferramentasInterfaceApexFood?.formatarMoeda ? window.ferramentasInterfaceApexFood.formatarMoeda(valor) : Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeCozinha(valor) { return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? ''); }
function minutosCozinha(tempo) { return Number.parseInt(String(tempo).replace(/[^0-9]/g, ''), 10) || 0; }
function fichaDoPedido(pedido) { return fichasCozinha().find(ficha => String(ficha.idPedido || '') === String(pedido.id)) || null; }
function tarefasDoPedido(pedido) { return fichaDoPedido(pedido)?.tarefas || []; }
function pedidosVisiveisCozinha() {
  const termo = elementosCozinha.busca.value.trim().toLocaleLowerCase('pt-BR');
  const prioridade = elementosCozinha.prioridade.value;
  return pedidosCozinha().filter(pedido => { const texto = `${pedido.id} ${pedido.mesa} ${pedido.cliente} ${pedido.garcom}`.toLocaleLowerCase('pt-BR'); return (!termo || texto.includes(termo)) && (prioridade === 'todas' || pedido.prioridade === prioridade); });
}
function atualizarIndicadoresCozinha() {
  const fila = pedidosCozinha().filter(pedido => ['enviado_cozinha', 'novo'].includes(pedido.status));
  const preparo = pedidosCozinha().filter(pedido => ['em_preparo', 'preparo'].includes(pedido.status));
  const atrasados = pedidosCozinha().filter(pedido => minutosCozinha(pedido.tempo) >= 20 && pedido.status !== 'pronto');
  const media = pedidosCozinha().length ? Math.round(pedidosCozinha().reduce((sum, pedido) => sum + minutosCozinha(pedido.tempo), 0) / pedidosCozinha().length) : 0;
  document.getElementById('cozinhaNaFila').textContent = fila.length;
  document.getElementById('cozinhaEmPreparo').textContent = preparo.length;
  document.getElementById('cozinhaAtrasados').textContent = atrasados.length;
  document.getElementById('cozinhaTempoMedio').textContent = pedidosCozinha().length ? `${media} min` : '—';
}
function statusTarefaLabel(status) { return status === 'em_preparo' ? 'Em preparo' : status === 'pronto' ? 'Pronto' : status === 'cancelada' ? 'Cancelada' : 'Aguardando'; }
function proximoStatusTarefa(status) { return status === 'aguardando_preparo' ? 'em_preparo' : status === 'em_preparo' ? 'pronto' : ''; }
function criarTarefaMarkup(ficha, tarefa) {
  const proximo = proximoStatusTarefa(tarefa.statusTarefa);
  const requisitos = [...(tarefa.especialidadesNecessarias || []), ...(tarefa.estacoesNecessarias || [])].join(' · ');
  const responsavel = tarefa.nomeCozinheiroResponsavel || 'Fila geral';
  return `<div class="cozinha-item flex flex-col gap-2 px-3 py-2.5"><div class="flex items-center justify-between gap-2"><span class="text-xs truncate">${escapeCozinha(tarefa.quantidade)}x ${escapeCozinha(tarefa.nomeProduto || tarefa.nome || tarefa.idProduto)}</span><span class="text-[10px] ${tarefa.statusTarefa === 'pronto' ? 'text-green' : tarefa.statusTarefa === 'em_preparo' ? 'text-yellow' : 'text-muted'}">${escapeCozinha(statusTarefaLabel(tarefa.statusTarefa))}</span></div><div class="flex items-center justify-between gap-2"><span class="text-[10px] text-muted truncate">${escapeCozinha(responsavel)}${requisitos ? ` · ${escapeCozinha(requisitos)}` : ''}</span>${proximo ? `<button type="button" data-acao-tarefa="${escapeCozinha(ficha.id)}" data-tarefa-id="${escapeCozinha(tarefa.id)}" data-proximo-tarefa="${escapeCozinha(proximo)}" class="text-[10px] text-accent hover:text-orange-300">${proximo === 'em_preparo' ? 'Iniciar preparo' : 'Marcar pronto'}</button>` : ''}</div></div>`;
}
function criarCardCozinha(pedido) {
  const atrasado = minutosCozinha(pedido.tempo) >= 20 && pedido.status !== 'pronto';
  const coluna = colunasCozinha.find(item => (item.estados || [item.id]).includes(pedido.status)) || colunasCozinha[0];
  const ficha = fichaDoPedido(pedido);
  const tarefas = tarefasDoPedido(pedido);
  const podeAvancar = !ficha && ['enviado_cozinha', 'em_preparo', 'novo', 'preparo'].includes(pedido.status);
  const itensMarkup = tarefas.length ? tarefas.map(tarefa => criarTarefaMarkup(ficha, tarefa)).join('') : pedido.itens.map(item => `<div class="cozinha-item flex items-center justify-between gap-2 px-3 py-2"><span class="text-xs truncate">${item.quantidade}x ${escapeCozinha(item.nome)}</span><span class="text-[10px] text-muted whitespace-nowrap">${moedaCozinha(item.valor)}</span></div>`).join('');
  const distribuicao = ficha ? `${ficha.tarefasAtribuidas || 0}/${ficha.tarefasTotal || tarefas.length} tarefas atribuídas` : 'Fluxo legado';
  const card = document.createElement('article');
  card.className = `cozinha-card ${atrasado ? 'atrasado ' : ''}prioridade-${pedido.prioridade || 'normal'} rounded-xl bg-card border border-border p-4`;
  card.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2"><span class="font-mono text-xs font-semibold">${escapeCozinha(pedido.id)}</span>${pedido.prioridade === 'alta' ? '<span class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red/10 text-red border border-red/20 text-[10px] font-medium"><i data-lucide="flame" class="w-3 h-3"></i> Alta</span>' : '<span class="px-2 py-0.5 rounded-md bg-yellow/10 text-yellow border border-yellow/20 text-[10px] font-medium">Normal</span>'}</div><div class="flex items-center gap-2 text-sm font-semibold mt-3"><i data-lucide="${pedido.canal === 'delivery' ? 'bike' : 'armchair'}" class="w-4 h-4 text-muted"></i>${escapeCozinha(pedido.mesa)}</div></div><div class="text-right"><div class="flex items-center gap-1 text-xs ${atrasado ? 'text-red' : 'text-muted'}"><i data-lucide="${atrasado ? 'clock-alert' : 'clock-3'}" class="w-3.5 h-3.5"></i>${escapeCozinha(pedido.tempo)}</div><div class="text-[10px] text-muted mt-1">${escapeCozinha(pedido.horario)}</div></div></div><div class="flex items-center justify-between gap-3 mt-4"><div class="min-w-0"><div class="text-sm truncate">${escapeCozinha(pedido.cliente)}</div><div class="text-xs text-muted mt-1">${escapeCozinha(pedido.garcom)}</div></div><strong class="text-sm text-accent">${moedaCozinha(pedido.valor)}</strong></div><div class="mt-4 rounded-lg bg-card2 border border-border2 divide-y divide-border2">${itensMarkup}</div><div class="flex items-center justify-between gap-2 mt-3"><span class="text-[10px] text-muted">${escapeCozinha(distribuicao)}</span>${ficha?.statusDistribuicaoCozinha === 'aguardando_atribuicao' ? '<span class="text-[10px] text-yellow">Aguardando cozinheiro compatível</span>' : ''}</div><div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border2"><button type="button" data-detalhe-cozinha="${escapeCozinha(pedido.id)}" class="text-xs text-muted hover:text-white">Ver detalhes</button><button type="button" data-acao-cozinha="${escapeCozinha(pedido.id)}" class="btn-press ${podeAvancar ? 'flex' : 'hidden'} items-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-xs font-medium"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>${coluna.acao}</button></div>`;
  return card;
}
function renderizarCozinha() {
  const visiveis = pedidosVisiveisCozinha();
  elementosCozinha.painel.innerHTML = colunasCozinha.map(coluna => { const pedidos = visiveis.filter(pedido => (coluna.estados || [coluna.id]).includes(pedido.status)); const conteudo = pedidos.length ? pedidos.map(pedido => { const wrapper = document.createElement('div'); wrapper.appendChild(criarCardCozinha(pedido)); return wrapper.innerHTML; }).join('') : `<div class="rounded-xl bg-card border border-border2 border-dashed py-10 text-center"><i data-lucide="chef-hat" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-xs font-medium">Nenhum pedido encontrado</p><p class="text-[10px] text-muted mt-1">Nenhum pedido nesta etapa.</p></div>`; return `<section class="cozinha-coluna"><div class="flex items-center justify-between mb-3"><div><div class="flex items-center gap-2"><i data-lucide="${coluna.icone}" class="w-4 h-4 ${coluna.cor}"></i><h3 class="text-sm font-semibold">${coluna.titulo}</h3><span class="px-1.5 py-0.5 rounded-md bg-card2 border border-border2 text-[10px] text-muted">${pedidos.length}</span></div><p class="text-[10px] text-muted mt-1">${coluna.descricao}</p></div><button type="button" data-atualizar-cozinha="${coluna.id}" class="p-1.5 rounded-md hover:bg-card2 text-muted" aria-label="Atualizar coluna"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i></button></div><div class="space-y-3">${conteudo}</div></section>`; }).join('');
  document.getElementById('resultadoCozinha').textContent = visiveis.length;
  elementosCozinha.painel.querySelectorAll('[data-acao-cozinha]').forEach(botao => botao.addEventListener('click', () => avancarPedidoCozinha(botao.dataset.acaoCozinha)));
  elementosCozinha.painel.querySelectorAll('[data-detalhe-cozinha]').forEach(botao => botao.addEventListener('click', () => abrirModalCozinha(botao.dataset.detalheCozinha)));
  elementosCozinha.painel.querySelectorAll('[data-atualizar-cozinha]').forEach(botao => botao.addEventListener('click', atualizarCozinha));
  elementosCozinha.painel.querySelectorAll('[data-acao-tarefa]').forEach(botao => botao.addEventListener('click', () => avancarTarefaCozinha(botao.dataset.acaoTarefa, botao.dataset.tarefaId, botao.dataset.proximoTarefa)));
  window.lucide?.createIcons();
}
function abrirModalCozinha(id) {
  const pedido = pedidosCozinha().find(item => String(item.id) === String(id)); if (!pedido) return;
  const coluna = colunasCozinha.find(item => (item.estados || [item.id]).includes(pedido.status)) || colunasCozinha[0];
  const ficha = fichaDoPedido(pedido);
  const tarefas = tarefasDoPedido(pedido);
  document.getElementById('tituloModalCozinha').textContent = pedido.id;
  document.getElementById('resumoModalCozinha').textContent = `${pedido.mesa} · ${pedido.cliente} · ${pedido.horario}`;
  document.getElementById('dadosModalCozinha').innerHTML = [['Mesa / canal', `${pedido.mesa} · ${pedido.canal}`], ['Cliente', pedido.cliente], ['Garçom', pedido.garcom], ['Tempo de espera', pedido.tempo], ['Prioridade', pedido.prioridade === 'alta' ? 'Alta' : 'Normal'], ['Distribuição', ficha ? `${ficha.tarefasAtribuidas || 0}/${ficha.tarefasTotal || tarefas.length} tarefas atribuídas` : 'Fluxo legado'], ['Valor', moedaCozinha(pedido.valor)]].map(([label, valor]) => `<div class="rounded-lg bg-card2 border border-border2 p-3"><div class="text-[10px] text-muted uppercase tracking-wider mb-1">${label}</div><div class="text-sm font-medium">${escapeCozinha(valor)}</div></div>`).join('');
  document.getElementById('contagemModalCozinha').textContent = `${tarefas.length || pedido.itens.length} item(ns)`;
  document.getElementById('itensModalCozinha').innerHTML = tarefas.length ? tarefas.map(tarefa => criarTarefaMarkup(ficha, tarefa)).join('') : pedido.itens.map(item => `<div class="flex items-center justify-between gap-3 px-3 py-2.5"><span class="text-xs sm:text-sm">${item.quantidade}x ${escapeCozinha(item.nome)}</span><span class="text-xs font-medium">${moedaCozinha(item.valor)}</span></div>`).join('');
  document.getElementById('observacoesModalCozinha').textContent = pedido.observacoes || 'Sem observações.';
  document.getElementById('itensModalCozinha').querySelectorAll('[data-acao-tarefa]').forEach(botao => botao.addEventListener('click', () => avancarTarefaCozinha(botao.dataset.acaoTarefa, botao.dataset.tarefaId, botao.dataset.proximoTarefa)));
  const acao = document.getElementById('acaoModalCozinha'); acao.dataset.pedidoId = pedido.id; acao.querySelector('span').textContent = coluna.acao; acao.classList.toggle('hidden', Boolean(ficha));
  const modal = document.getElementById('modalCozinha'); modal.classList.add('aberto'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; window.lucide?.createIcons(); document.getElementById('fecharModalCozinha').focus();
}
function fecharModalCozinha() { const modal = document.getElementById('modalCozinha'); modal.classList.remove('aberto'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
function gerarChaveCozinha(prefixo = 'cozinha-status') { const identificador = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return `${prefixo}:${identificador}`; }
async function avancarTarefaCozinha(idFicha, idTarefa, statusTarefa) {
  if (!window.dadosPedidosRemotoAtivo || !window.apexModulosApi?.atualizarTarefaCozinha) { mostrarAvisoPedido('Não foi possível atualizar a tarefa da cozinha.'); return; }
  try { await window.apexModulosApi.atualizarTarefaCozinha({ idFicha, idTarefa, statusTarefa, chaveIdempotencia: gerarChaveCozinha('cozinha-tarefa') }); fecharModalCozinha(); await window.recarregarPedidosReais?.(); mostrarAvisoPedido(`Tarefa atualizada para ${statusTarefaLabel(statusTarefa)}.`); } catch (erro) { mostrarAvisoPedido(erro.message || 'Não foi possível alterar a tarefa da cozinha.'); }
}
async function avancarPedidoCozinha(id) {
  const pedido = pedidosCozinha().find(item => String(item.id) === String(id)); if (!pedido) return;
  const proximo = pedido.status === 'novo' ? 'preparo' : pedido.status === 'preparo' ? 'pronto' : pedido.status === 'enviado_cozinha' ? 'em_preparo' : pedido.status === 'em_preparo' ? 'pronto' : '';
  if (!proximo) return;
  if (!window.dadosPedidosRemotoAtivo || !window.apexModulosApi?.atualizarStatusPedido) { mostrarAvisoPedido('Não foi possível atualizar o pedido. Tente novamente.'); return; }
  try { await window.apexModulosApi.atualizarStatusPedido({ id: String(pedido.id), status: proximo, chaveIdempotencia: gerarChaveCozinha() }); fecharModalCozinha(); await window.recarregarPedidosReais?.(); mostrarAvisoPedido(`${pedido.id} atualizado na cozinha.`); } catch (erro) { mostrarAvisoPedido(erro.message || 'Não foi possível alterar o pedido.'); }
}
async function atualizarCozinha() { if (window.recarregarPedidosReais) await window.recarregarPedidosReais(); else { atualizarIndicadoresCozinha(); renderizarCozinha(); } }
elementosCozinha.busca.addEventListener('input', renderizarCozinha); elementosCozinha.prioridade.addEventListener('change', renderizarCozinha); document.getElementById('atualizarCozinha').addEventListener('click', atualizarCozinha); document.getElementById('fecharModalCozinha').addEventListener('click', fecharModalCozinha); document.getElementById('fecharModalCozinhaBtn').addEventListener('click', fecharModalCozinha); document.getElementById('backdropCozinha').addEventListener('click', fecharModalCozinha); document.getElementById('acaoModalCozinha').addEventListener('click', event => avancarPedidoCozinha(event.currentTarget.dataset.pedidoId)); document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalCozinha(); });
document.addEventListener('apex:pedidos-atualizado', () => { atualizarIndicadoresCozinha(); renderizarCozinha(); });
atualizarIndicadoresCozinha();
renderizarCozinha();
