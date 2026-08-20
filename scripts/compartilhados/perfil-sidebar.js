(() => {
  'use strict';

  const estado = {
    aberto: null,
    sessao: null,
    inicializado: false,
  };

  const escapar = valor => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function nomeUsuario() {
    return estado.sessao?.usuario?.nomeExibicao || 'Conta APEX Food';
  }

  function emailUsuario() {
    return estado.sessao?.usuario?.emailCanonico || 'Sessão autenticada';
  }

  function iniciais() {
    const nome = nomeUsuario().trim();
    if (!nome || nome === 'Conta APEX Food') return 'A';
    const partes = nome.split(/\s+/).filter(Boolean);
    return escapar((partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase().slice(0, 2));
  }

  function fecharTodos() {
    document.querySelectorAll('[data-perfil-menu]').forEach(menu => menu.classList.remove('open'));
    document.querySelectorAll('[data-perfil-trigger]').forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    estado.aberto = null;
  }

  function alternar(id) {
    const menu = document.querySelector(`[data-perfil-menu="${id}"]`);
    const trigger = document.querySelector(`[data-perfil-trigger="${id}"]`);
    if (!menu || !trigger) return;
    const deveAbrir = !menu.classList.contains('open');
    fecharTodos();
    if (deveAbrir) {
      menu.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      estado.aberto = id;
    }
  }

  function renderizar(container, id) {
    if (!container) return;
    container.innerHTML = `<button type="button" data-perfil-trigger="${id}" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}-menu" class="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-card2 focus:outline-none focus:ring-2 focus:ring-accent/60"><span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-orange-400 text-xs font-bold text-white">${iniciais()}</span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-semibold text-white">${escapar(nomeUsuario())}</span><span class="mt-0.5 block truncate text-[10px] text-muted">${escapar(emailUsuario())}</span></span><i data-lucide="chevrons-up-down" class="h-4 w-4 flex-none text-muted"></i></button><div id="${id}-menu" data-perfil-menu="${id}" role="menu" aria-label="Opções do perfil" class="perfil-sidebar-menu absolute bottom-[calc(100%+0.5rem)] left-3 right-3 z-[80] overflow-hidden rounded-xl border border-border bg-panel p-1.5 shadow-2xl"><div class="border-b border-border px-3 py-2.5"><p class="text-[10px] uppercase tracking-[0.12em] text-muted">Perfil</p><p class="mt-1 truncate text-xs font-semibold text-white">${escapar(nomeUsuario())}</p></div><button type="button" role="menuitem" data-perfil-notificacoes="true" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-muted transition hover:bg-card2 hover:text-white"><i data-lucide="bell" class="h-4 w-4"></i><span>Notificações</span></button><button type="button" role="menuitem" data-perfil-sair="true" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-300"><i data-lucide="log-out" class="h-4 w-4"></i><span>Sair</span></button><p data-perfil-feedback class="hidden px-3 py-2 text-[10px] text-red-300" aria-live="polite"></p></div>`;
    const trigger = container.querySelector('[data-perfil-trigger]');
    const menu = container.querySelector('[data-perfil-menu]');
    trigger?.addEventListener('click', () => alternar(id));
    menu?.querySelector('[data-perfil-notificacoes]')?.addEventListener('click', () => {
      fecharTodos();
      window.dispatchEvent(new CustomEvent('apex:abrir-notificacoes'));
    });
    menu?.querySelector('[data-perfil-sair]')?.addEventListener('click', () => sair(menu));
    window.lucide?.createIcons();
  }

  async function carregarSessao() {
    try {
      if (window.apexAuthApi?.obterSessao) estado.sessao = await window.apexAuthApi.obterSessao();
    } catch {
      estado.sessao = null;
    }
    renderizar(document.getElementById('perfilSidebarDesktop'), 'desktop');
    renderizar(document.getElementById('perfilSidebarMobile'), 'mobile');
  }

  async function sair(menu) {
    const botao = menu.querySelector('[data-perfil-sair]');
    const feedback = menu.querySelector('[data-perfil-feedback]');
    if (!window.apexAuthApi?.encerrarSessao) {
      feedback.textContent = 'Não foi possível encerrar a sessão agora.';
      feedback.classList.remove('hidden');
      return;
    }
    botao.disabled = true;
    botao.classList.add('opacity-60');
    botao.querySelector('span').textContent = 'Saindo...';
    try {
      await window.apexAuthApi.encerrarSessao();
      window.location.replace('/autenticacao?apex-logout=1');
    } catch (erro) {
      botao.disabled = false;
      botao.classList.remove('opacity-60');
      botao.querySelector('span').textContent = 'Sair';
      feedback.textContent = erro?.status === 401 ? 'A sessão já foi encerrada.' : 'Não foi possível encerrar a sessão agora. Tente novamente.';
      feedback.classList.remove('hidden');
    }
  }

  function inicializar() {
    if (estado.inicializado) return;
    estado.inicializado = true;
    renderizar(document.getElementById('perfilSidebarDesktop'), 'desktop');
    renderizar(document.getElementById('perfilSidebarMobile'), 'mobile');
    carregarSessao();
    document.addEventListener('click', evento => {
      if (!estado.aberto) return;
      if (!evento.target.closest('[data-perfil-menu], [data-perfil-trigger]')) fecharTodos();
    });
    document.addEventListener('keydown', evento => { if (evento.key === 'Escape') fecharTodos(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar, { once: true });
  else inicializar();
})();
