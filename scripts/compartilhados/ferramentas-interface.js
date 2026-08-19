window.mostrarAvisoPedido = function(mensagem) {
  let aviso = document.getElementById('avisoApexFood');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'avisoApexFood';
    aviso.className = 'fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg bg-card2 border border-border2 px-4 py-3 text-sm shadow-2xl';
    document.body.appendChild(aviso);
  }
  aviso.textContent = mensagem;
  aviso.classList.remove('hidden');
  window.clearTimeout(window.mostrarAvisoPedido.timeout);
  window.mostrarAvisoPedido.timeout = window.setTimeout(() => aviso.classList.add('hidden'), 2800);
};

window.ferramentasInterfaceApexFood = Object.freeze({
  formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },

  escaparHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  atualizarIcones() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  obterElemento(id) {
    return document.getElementById(id);
  }
});
