'use strict';

const promocoesCardapio = () => window.dadosCardapioApexFood?.promocoes || [];
const elementosPromocoes = {
  filtro: document.getElementById('filtroPromocao'),
  lista: document.getElementById('listaPromocoes'),
  descontoMedio: document.getElementById('descontoMedioPromocoes'),
  receita: document.getElementById('receitaPromocoes'),
};
let ordenarPorUso = true;
let promocaoEditandoId = null;

function escapePromocao(valor) {
  return window.ferramentasInterfaceApexFood?.escaparHtml
    ? window.ferramentasInterfaceApexFood.escaparHtml(valor)
    : String(valor ?? '');
}

function promocoesVisiveis() {
  const filtro = elementosPromocoes.filtro.value;
  const lista = promocoesCardapio().filter(promocao => filtro === 'todas' || promocao.status === filtro);
  return ordenarPorUso ? [...lista].sort((a, b) => b.usos - a.usos) : lista;
}

function estiloStatusPromocao(status) {
  return status === 'ativa'
    ? 'bg-green/10 text-green border-green/20'
    : status === 'agendada'
      ? 'bg-blue/10 text-blue border-blue/20'
      : 'bg-card2 text-muted border-border2';
}

function labelStatusPromocao(status) {
  return status === 'ativa' ? 'Ativa' : status === 'agendada' ? 'Agendada' : 'Inativa';
}

function descontoNumerico(valor) {
  const numero = Number.parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 && numero <= 100 ? numero : null;
}

function atualizarIndicadoresPromocoes(promocoes) {
  document.getElementById('totalPromocoesAtivas').textContent = promocoes.filter(item => item.status === 'ativa').length;
  document.getElementById('totalUsosPromocoes').textContent = promocoes.reduce((sum, item) => sum + item.usos, 0);
  const descontos = promocoes.map(item => descontoNumerico(item.desconto)).filter(valor => valor !== null);
  elementosPromocoes.descontoMedio.textContent = descontos.length
    ? `${(descontos.reduce((sum, valor) => sum + valor, 0) / descontos.length).toFixed(1).replace('.', ',')}%`
    : '—';
  const receitaCentavos = promocoes.reduce((sum, item) => sum + Number(item.receitaCentavos || 0), 0);
  elementosPromocoes.receita.textContent = receitaCentavos > 0
    ? window.ferramentasInterfaceApexFood?.formatarMoeda(receitaCentavos / 100) || `R$ ${(receitaCentavos / 100).toFixed(2)}`
    : '—';
}

function renderizarPromocoes() {
  const lista = promocoesVisiveis();
  const promocoes = promocoesCardapio();
  atualizarIndicadoresPromocoes(promocoes);
  document.getElementById('resultadoPromocoes').textContent = `${lista.length} ${lista.length === 1 ? 'promoção encontrada' : 'promoções encontradas'}.`;
  elementosPromocoes.lista.innerHTML = lista.length
    ? lista.map(promocao => {
      const percentualUso = promocao.limite > 0 ? Math.min(100, Math.round((promocao.usos / promocao.limite) * 100)) : 0;
      const limiteTexto = promocao.limite > 0 ? `${promocao.usos}/${promocao.limite} usos` : `${promocao.usos} usos`;
      return `<article class="cardapio-card rounded-xl bg-card2 border border-border2 p-5"><div class="flex items-start justify-between gap-3"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-${escapePromocao(promocao.cor)}/10 flex items-center justify-center"><i data-lucide="${promocao.tipo === 'Horário' ? 'clock-3' : promocao.tipo === 'Fidelidade' ? 'heart-handshake' : promocao.tipo === 'Produto' ? 'tag' : 'package-open'}" class="w-5 h-5 text-${promocao.cor === 'orange' ? 'accent' : escapePromocao(promocao.cor)}"></i></div><div><h4 class="text-sm font-semibold">${escapePromocao(promocao.nome)}</h4><div class="flex items-center gap-2 mt-1"><span class="text-[10px] text-muted">${escapePromocao(promocao.tipo)}</span><span class="w-1 h-1 rounded-full bg-muted"></span><span class="px-2 py-0.5 rounded-md text-[10px] border ${estiloStatusPromocao(promocao.status)}">${labelStatusPromocao(promocao.status)}</span></div></div></div><button type="button" data-editar-promocao="${escapePromocao(promocao.id)}" class="p-2 rounded-lg hover:bg-card text-muted" aria-label="Editar ${escapePromocao(promocao.nome)}"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button></div><p class="text-xs text-muted leading-relaxed mt-4">${escapePromocao(promocao.descricao)}</p><div class="flex items-center gap-4 mt-4"><div><div class="text-[10px] text-muted uppercase tracking-wider">Oferta</div><div class="text-xl font-bold text-accent mt-1">${escapePromocao(promocao.desconto)}</div></div><div class="w-px h-8 bg-border2"></div><div><div class="text-[10px] text-muted uppercase tracking-wider">Valor</div><div class="text-sm font-semibold mt-1">${escapePromocao(promocao.valor || '—')}</div></div></div><div class="mt-5 pt-4 border-t border-border"><div class="flex items-center justify-between text-[10px] text-muted"><span>${escapePromocao(promocao.inicio || 'Sem início')} — ${escapePromocao(promocao.fim || 'Sem fim')}</span><span>${limiteTexto}</span></div><div class="h-1.5 rounded-full bg-card mt-2 overflow-hidden"><div class="h-full bg-gradient-to-r from-accent to-orange-400 rounded-full" style="width: ${percentualUso}%"></div></div></div></article>`;
    }).join('')
    : `<div class="lg:col-span-2 rounded-lg border border-border2 border-dashed py-12 text-center"><i data-lucide="tag" class="w-5 h-5 text-muted mx-auto mb-2"></i><p class="text-sm font-medium">Nenhuma promoção real encontrada</p><p class="text-xs text-muted mt-1">Crie uma campanha para este restaurante ou ajuste o filtro.</p></div>`;
  elementosPromocoes.lista.querySelectorAll('[data-editar-promocao]').forEach(botao => botao.addEventListener('click', () => {
    const promocao = promocoesCardapio().find(item => String(item.id) === String(botao.dataset.editarPromocao));
    if (promocao) abrirModalPromocao(promocao);
  }));
  window.lucide?.createIcons();
}

function preencherFormularioPromocao(promocao) {
  document.getElementById('tituloModalPromocao').textContent = promocao ? 'Editar promoção' : 'Nova promoção';
  document.querySelector('#formPromocao button[type="submit"]').textContent = promocao ? 'Salvar alterações' : 'Salvar promoção';
  document.getElementById('nomePromocao').value = promocao?.nome || '';
  document.getElementById('descricaoPromocao').value = promocao?.descricao || '';
  document.getElementById('tipoPromocao').value = promocao?.tipo || 'Combo';
  document.getElementById('descontoPromocao').value = promocao?.desconto || '';
}

function abrirModalPromocao(promocao = null) {
  promocaoEditandoId = promocao?.id ? String(promocao.id) : null;
  preencherFormularioPromocao(promocao);
  const modal = document.getElementById('modalPromocao');
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('nomePromocao').focus();
}

function fecharModalPromocao() {
  const modal = document.getElementById('modalPromocao');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('formPromocao').reset();
  promocaoEditandoId = null;
  preencherFormularioPromocao(null);
}

async function salvarPromocao(event) {
  event.preventDefault();
  const nome = document.getElementById('nomePromocao').value.trim();
  const descricao = document.getElementById('descricaoPromocao').value.trim();
  const tipo = document.getElementById('tipoPromocao').value;
  const desconto = document.getElementById('descontoPromocao').value.trim();
  if (!nome || !desconto) {
    mostrarAvisoPedido('Informe o nome e o desconto da promoção.');
    return;
  }
  if (!window.dadosCardapioRemotoAtivo || !window.apexModulosApi) {
    mostrarAvisoPedido('Não foi possível conectar ao Cardápio real. Tente novamente.');
    return;
  }
  try {
    if (promocaoEditandoId) {
      await window.apexModulosApi.atualizarCardapio({ recurso: 'promocao', id: promocaoEditandoId, nome, descricao, tipo, desconto });
      const promocao = promocoesCardapio().find(item => String(item.id) === promocaoEditandoId);
      if (promocao) Object.assign(promocao, { nome, descricao, tipo, desconto });
      mostrarAvisoPedido('Promoção atualizada no Cardápio.');
    } else {
      const resposta = await window.apexModulosApi.criarCardapio({ recurso: 'promocao', nome, descricao, tipo, desconto, estado: 'ativa', limite: 0 });
      promocoesCardapio().push({ id: String(resposta.id), nome, descricao, tipo, desconto, status: 'ativa', usos: 0, limite: 0, cor: 'orange', inicio: 'Sem início', fim: 'Sem fim', valor: '—' });
      mostrarAvisoPedido('Promoção salva no Cardápio.');
    }
    fecharModalPromocao();
    renderizarPromocoes();
  } catch (erro) {
    mostrarAvisoPedido(erro.message || 'Não foi possível salvar a promoção.');
  }
}

elementosPromocoes.filtro.addEventListener('change', renderizarPromocoes);
document.getElementById('ordenarPromocoes').addEventListener('click', () => {
  ordenarPorUso = !ordenarPorUso;
  renderizarPromocoes();
});
document.getElementById('novaPromocao').addEventListener('click', () => abrirModalPromocao());
document.getElementById('fecharModalPromocao').addEventListener('click', fecharModalPromocao);
document.getElementById('cancelarPromocao').addEventListener('click', fecharModalPromocao);
document.getElementById('backdropPromocao').addEventListener('click', fecharModalPromocao);
document.getElementById('formPromocao').addEventListener('submit', salvarPromocao);
document.addEventListener('keydown', event => { if (event.key === 'Escape') fecharModalPromocao(); });

document.addEventListener('apex:cardapio-atualizado', renderizarPromocoes);
renderizarPromocoes();
window.lucide?.createIcons();
