'use strict';

const mesasConfig = () => window.dadosMesas || [];
let mesaEmEdicao = null;
let qrMesaAtual = null;

function escapeMesaConfig(valor) {
  return window.ferramentasInterfaceApexFood?.escaparHtml ? window.ferramentasInterfaceApexFood.escaparHtml(valor) : String(valor ?? '');
}

function avisarConfiguracao(mensagem) {
  if (typeof mostrarAvisoPedido === 'function') mostrarAvisoPedido(mensagem);
}

function gerarChaveQr() {
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `qr-mesa:${id}`;
}

function statusMesaConfig(status) {
  return status === 'disponivel'
    ? { label: 'Ativa', classe: 'text-green', icone: 'check-circle-2' }
    : status === 'ocupada'
      ? { label: 'Em uso', classe: 'text-accent', icone: 'utensils' }
      : { label: 'Bloqueada', classe: 'text-red', icone: 'ban' };
}

function mesasConfigFiltradas() {
  const busca = document.getElementById('buscaMesaConfig').value.trim().toLocaleLowerCase('pt-BR');
  const filtro = document.getElementById('filtroStatusConfig').value;
  return mesasConfig().filter(mesa => {
    const status = mesa.status || mesa.estado || 'disponivel';
    return (!busca || `${mesa.nome} ${mesa.observacoes || ''} ${mesa.area || ''}`.toLocaleLowerCase('pt-BR').includes(busca))
      && (filtro === 'todos' || status === filtro);
  });
}

function atualizarIndicadoresConfig() {
  const capacidade = mesasConfig().reduce((total, mesa) => total + Number(mesa.capacidade || 0), 0);
  const ativas = mesasConfig().filter(mesa => (mesa.status || mesa.estado) !== 'indisponivel').length;
  const qrsAtivos = mesasConfig().filter(mesa => mesa.qrAtivo === true).length;
  document.getElementById('totalMesasConfig').textContent = mesasConfig().length;
  document.getElementById('capacidadeTotalConfig').textContent = capacidade;
  document.getElementById('mesasAtivasConfig').textContent = ativas;
  document.getElementById('qrsAtivosConfig').textContent = qrsAtivos;
}

function renderizarMesasConfig() {
  const lista = mesasConfigFiltradas();
  document.getElementById('resultadoMesasConfig').textContent = `${lista.length} ${lista.length === 1 ? 'mesa encontrada' : 'mesas encontradas'}.`;
  const grid = document.getElementById('gridConfiguracaoMesas');
  grid.innerHTML = lista.length ? lista.map(mesa => {
    const status = mesa.status || mesa.estado || 'disponivel';
    const estado = statusMesaConfig(status);
    const qrAtivo = mesa.qrAtivo === true;
    const qrLabel = qrAtivo ? 'Gerar novo QR' : 'Gerar QR Code';
    return `<article class="salao-card mesa-config-card rounded-xl bg-card2 border border-border2 p-4 ${status === 'indisponivel' ? 'indisponivel' : ''}">
      <div class="flex items-start justify-between gap-3"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-${status === 'indisponivel' ? 'red' : status === 'ocupada' ? 'accent' : 'green'}/10 flex items-center justify-center"><i data-lucide="${estado.icone}" class="w-5 h-5 ${estado.classe}"></i></div><div><h4 class="text-sm font-semibold">${escapeMesaConfig(mesa.nome)}</h4><p class="text-[10px] text-muted mt-1">${mesa.capacidade} lugares · ${escapeMesaConfig(mesa.area || mesa.observacoes || 'Área não definida')}</p></div></div><button type="button" data-editar-mesa="${escapeMesaConfig(mesa.id)}" class="p-2 rounded-lg hover:bg-card text-muted" aria-label="Editar ${escapeMesaConfig(mesa.nome)}"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button></div>
      <div class="flex items-center justify-between mt-5 pt-4 border-t border-border"><span class="flex items-center gap-1.5 text-xs ${estado.classe}"><span class="w-1.5 h-1.5 rounded-full bg-current"></span>${estado.label}</span><label class="flex items-center gap-2 text-[10px] text-muted"><span>Disponível</span><input type="checkbox" class="disponibilidade-switch" data-disponibilidade-mesa="${escapeMesaConfig(mesa.id)}" ${status !== 'indisponivel' ? 'checked' : ''}></label></div>
      <div class="mt-3 pt-3 border-t border-border"><div class="flex items-center justify-between gap-2"><span class="text-[10px] text-muted flex items-center gap-1.5"><i data-lucide="qr-code" class="w-3.5 h-3.5 ${qrAtivo ? 'text-green' : 'text-muted'}"></i>${qrAtivo ? 'QR Code ativo' : 'QR Code não gerado'}</span><button type="button" data-qr-mesa="${escapeMesaConfig(mesa.id)}" class="flex items-center gap-1.5 text-[10px] text-accent hover:text-orange-300"><i data-lucide="qr-code" class="w-3.5 h-3.5"></i>${qrLabel}</button></div>${qrAtivo ? '<p class="text-[10px] text-muted mt-1">Gere novamente para obter uma nova versão imprimível.</p>' : ''}</div>
    </article>`;
  }).join('') : `<div class="sm:col-span-2 xl:col-span-3 rounded-xl border border-border2 border-dashed py-12 text-center"><i data-lucide="layout-grid" class="w-6 h-6 text-muted mx-auto mb-3"></i><p class="text-sm font-medium">Nenhuma mesa cadastrada</p><p class="text-xs text-muted mt-1">Cadastre uma mesa para configurar o salão.</p></div>`;
  grid.querySelectorAll('[data-editar-mesa]').forEach(botao => botao.addEventListener('click', () => abrirEditarMesa(String(botao.dataset.editarMesa))));
  grid.querySelectorAll('[data-qr-mesa]').forEach(botao => botao.addEventListener('click', () => gerarVisualizarQrMesa(String(botao.dataset.qrMesa))));
  grid.querySelectorAll('[data-disponibilidade-mesa]').forEach(input => input.addEventListener('change', () => atualizarDisponibilidadeMesa(input)));
  window.lucide?.createIcons();
}

function abrirModalMesaConfig(mesa = null) {
  const modal = document.getElementById('modalMesaConfig');
  mesaEmEdicao = mesa;
  modal.dataset.mesaId = mesa?.id || '';
  document.getElementById('tituloModalMesaConfig').textContent = mesa ? `Editar ${mesa.nome}` : 'Nova mesa';
  document.getElementById('nomeMesaConfig').value = mesa?.nome || '';
  document.getElementById('capacidadeMesaConfig').value = mesa?.capacidade || 4;
  document.getElementById('areaMesaConfig').value = mesa?.area || 'Salão principal';
  document.getElementById('disponibilidadeMesaConfig').checked = mesa ? (mesa.status || mesa.estado) !== 'indisponivel' : true;
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('nomeMesaConfig').focus();
}

function abrirEditarMesa(id) { abrirModalMesaConfig(mesasConfig().find(mesa => String(mesa.id) === String(id))); }

function fecharModalMesaConfig() {
  const modal = document.getElementById('modalMesaConfig');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  mesaEmEdicao = null;
}

function abrirModalQr(dados, mesa) {
  qrMesaAtual = { ...dados, mesa };
  const modal = document.getElementById('modalQrMesaConfig');
  document.getElementById('qrMesaConfigTitulo').textContent = `QR Code — ${mesa.nome}`;
  document.getElementById('qrMesaConfigImagem').src = dados.qrDataUrl;
  document.getElementById('qrMesaConfigImagem').alt = `QR Code de ${mesa.nome}`;
  document.getElementById('qrMesaConfigLink').value = dados.urlPublica;
  document.getElementById('qrMesaConfigStatus').textContent = 'QR Code gerado e pronto para copiar ou imprimir.';
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.lucide?.createIcons();
}

function fecharModalQr() {
  const modal = document.getElementById('modalQrMesaConfig');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('qrMesaConfigImagem').removeAttribute('src');
  qrMesaAtual = null;
}

async function gerarVisualizarQrMesa(id) {
  const mesa = mesasConfig().find(item => String(item.id) === String(id));
  if (!mesa || !window.dadosMesasRemotoAtivo || !window.apexModulosApi?.gerarQrMesa) {
    avisarConfiguracao('Não foi possível gerar o QR Code. Tente novamente.');
    return;
  }
  try {
    avisarConfiguracao('Gerando QR Code da mesa...');
    const resposta = await window.apexModulosApi.gerarQrMesa({ idMesa: String(id), chaveIdempotencia: gerarChaveQr() });
    abrirModalQr(resposta, mesa);
    await window.recarregarMesasReais?.();
  } catch (erro) {
    avisarConfiguracao(erro.message || 'Não foi possível gerar o QR Code.');
  }
}

async function revogarQrAtual() {
  if (!qrMesaAtual?.mesa?.id || !window.apexModulosApi?.revogarQrMesa) return;
  const botao = document.getElementById('qrMesaConfigRevogar');
  botao.disabled = true;
  try {
    await window.apexModulosApi.revogarQrMesa({ idMesa: String(qrMesaAtual.mesa.id), chaveIdempotencia: gerarChaveQr() });
    fecharModalQr();
    await window.recarregarMesasReais?.();
    avisarConfiguracao('QR Code revogado.');
  } catch (erro) {
    avisarConfiguracao(erro.message || 'Não foi possível revogar o QR Code.');
  } finally {
    botao.disabled = false;
  }
}

async function copiarQrLink() {
  if (!qrMesaAtual?.urlPublica) return;
  try {
    await navigator.clipboard.writeText(qrMesaAtual.urlPublica);
    document.getElementById('qrMesaConfigStatus').textContent = 'Link copiado para a área de transferência.';
  } catch {
    const campo = document.getElementById('qrMesaConfigLink');
    campo.focus();
    campo.select();
    document.execCommand('copy');
    document.getElementById('qrMesaConfigStatus').textContent = 'Link selecionado para cópia.';
  }
}

function imprimirQr() {
  if (!qrMesaAtual?.qrDataUrl) return;
  const janela = window.open('', '_blank', 'noopener,noreferrer');
  if (!janela) { avisarConfiguracao('Permita a abertura de janela para imprimir o QR Code.'); return; }
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR Code — ${escapeMesaConfig(qrMesaAtual.mesa.nome)}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;color:#111}img{width:320px;height:320px;display:block;margin:24px auto}h1{font-size:22px}</style></head><body><h1>${escapeMesaConfig(qrMesaAtual.mesa.nome)}</h1><img src="${qrMesaAtual.qrDataUrl}" alt="QR Code"><p>Escaneie para iniciar o atendimento da mesa.</p></body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

async function salvarMesaConfig(event) {
  event.preventDefault();
  const editando = Boolean(mesaEmEdicao);
  if (!window.dadosMesasRemotoAtivo || !window.apexModulosApi) { avisarConfiguracao('Não foi possível salvar a mesa. Tente novamente.'); return; }
  const nome = document.getElementById('nomeMesaConfig').value.trim();
  const capacidade = Number(document.getElementById('capacidadeMesaConfig').value);
  const area = document.getElementById('areaMesaConfig').value;
  const estadoAtual = mesaEmEdicao?.status || mesaEmEdicao?.estado;
  const estado = document.getElementById('disponibilidadeMesaConfig').checked ? (estadoAtual === 'ocupada' ? 'ocupada' : 'disponivel') : 'indisponivel';
  const observacoes = mesaEmEdicao?.observacoes || '';
  try {
    if (mesaEmEdicao) await window.apexModulosApi.atualizarSalao({ recurso: 'mesa', id: String(mesaEmEdicao.id), nome, capacidade, area, estado, observacoes });
    else await window.apexModulosApi.criarMesa({ nome, capacidade, area, estado, observacoes });
    fecharModalMesaConfig();
    await window.recarregarMesasReais?.();
    avisarConfiguracao(editando ? 'Mesa atualizada.' : 'Mesa cadastrada.');
  } catch (erro) { avisarConfiguracao(erro.message || 'Não foi possível salvar a mesa.'); }
}

async function atualizarDisponibilidadeMesa(input) {
  const mesa = mesasConfig().find(item => String(item.id) === String(input.dataset.disponibilidadeMesa));
  if (!mesa) return;
  const anterior = mesa.status || mesa.estado;
  const estado = input.checked ? (anterior === 'ocupada' ? 'ocupada' : 'disponivel') : 'indisponivel';
  input.disabled = true;
  try {
    if (!window.dadosMesasRemotoAtivo || !window.apexModulosApi) throw new Error('Não foi possível atualizar a mesa. Tente novamente.');
    await window.apexModulosApi.atualizarSalao({ recurso: 'mesa', id: String(mesa.id), estado });
    await window.recarregarMesasReais?.();
    avisarConfiguracao('Disponibilidade atualizada.');
  } catch (erro) {
    input.checked = anterior !== 'indisponivel';
    avisarConfiguracao(erro.message || 'Não foi possível atualizar a mesa.');
  } finally { input.disabled = false; }
}

async function atualizarConfiguracaoRemota() { atualizarIndicadoresConfig(); renderizarMesasConfig(); }

document.getElementById('novaMesaConfig').addEventListener('click', () => abrirModalMesaConfig());
document.getElementById('fecharModalMesaConfig').addEventListener('click', fecharModalMesaConfig);
document.getElementById('cancelarMesaConfig').addEventListener('click', fecharModalMesaConfig);
document.getElementById('backdropMesaConfig').addEventListener('click', fecharModalMesaConfig);
document.getElementById('salvarConfigMesas').addEventListener('click', () => { if (window.recarregarMesasReais) window.recarregarMesasReais().then(() => avisarConfiguracao('Alterações atualizadas.')); else avisarConfiguracao('Não foi possível atualizar as mesas.'); });
document.getElementById('buscaMesaConfig').addEventListener('input', renderizarMesasConfig);
document.getElementById('filtroStatusConfig').addEventListener('change', renderizarMesasConfig);
document.getElementById('formMesaConfig').addEventListener('submit', salvarMesaConfig);
document.getElementById('fecharModalQrMesaConfig').addEventListener('click', fecharModalQr);
document.getElementById('cancelarQrMesaConfig').addEventListener('click', fecharModalQr);
document.getElementById('backdropQrMesaConfig').addEventListener('click', fecharModalQr);
document.getElementById('qrMesaConfigCopiar').addEventListener('click', copiarQrLink);
document.getElementById('qrMesaConfigImprimir').addEventListener('click', imprimirQr);
document.getElementById('qrMesaConfigRevogar').addEventListener('click', revogarQrAtual);
document.addEventListener('keydown', event => { if (event.key === 'Escape') { fecharModalMesaConfig(); fecharModalQr(); } });
atualizarIndicadoresConfig();
renderizarMesasConfig();
window.lucide?.createIcons();
document.addEventListener('apex:mesas-atualizado', atualizarConfiguracaoRemota);
