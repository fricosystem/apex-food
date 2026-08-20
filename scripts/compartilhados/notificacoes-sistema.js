(() => {
  'use strict';

  const CONFIG = Object.freeze({
    versao: 'etapa10-notificacao-teste',
    titulo: 'APEX Food — teste de abertura',
    icone: '/assets/apex-food-logo-aprimorada.png',
    badge: '/assets/apex-food-logo-aprimorada.png',
    url: '/',
  });

  const estado = {
    registro: null,
    inicializado: false,
    notificacaoEnviada: false,
  };

  function suporteNotificacao() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  }

  async function registrarServiceWorker() {
    if (!suporteNotificacao()) return null;
    if (estado.registro) return estado.registro;
    try {
      estado.registro = await navigator.serviceWorker.register(`/service-worker.js?v=${CONFIG.versao}`, { scope: '/' });
      return estado.registro;
    } catch {
      estado.registro = null;
      return null;
    }
  }

  async function solicitarPermissao() {
    if (!suporteNotificacao()) return 'unsupported';
    await registrarServiceWorker();
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  async function definirBadge() {
    if (typeof navigator.setAppBadge !== 'function') return false;
    try {
      await navigator.setAppBadge(1);
      return true;
    } catch {
      return false;
    }
  }

  async function notificarAbertura(origem = 'abertura') {
    if (estado.notificacaoEnviada || !suporteNotificacao() || Notification.permission !== 'granted') return false;
    const registro = await registrarServiceWorker();
    if (!registro || typeof registro.showNotification !== 'function') return false;
    estado.notificacaoEnviada = true;
    try {
      await registro.showNotification(CONFIG.titulo, {
        body: origem === 'login'
          ? 'Login realizado. Esta notificação confirma o teste do PWA do APEX Food.'
          : 'O sistema foi aberto. Esta notificação confirma o teste do PWA do APEX Food.',
        icon: CONFIG.icone,
        badge: CONFIG.badge,
        tag: `apex-food-teste-${origem}`,
        renotify: true,
        requireInteraction: false,
        data: { url: CONFIG.url, origem },
      });
      await definirBadge();
      return true;
    } catch {
      estado.notificacaoEnviada = false;
      return false;
    }
  }

  function limparMarcadorLogin() {
    const url = new URL(window.location.href);
    const origem = url.searchParams.get('apex-notificacao') || '';
    if (origem) {
      url.searchParams.delete('apex-notificacao');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
    return origem;
  }

  async function tratarSessaoAutenticada(evento) {
    const origemMarcada = limparMarcadorLogin();
    const origem = origemMarcada === 'login' || evento?.detail?.origem === 'login' ? 'login' : 'abertura';
    await notificarAbertura(origem);
  }

  function inicializar() {
    if (estado.inicializado) return;
    estado.inicializado = true;
    registrarServiceWorker();
    window.addEventListener('apex:sessao-autenticada', evento => { tratarSessaoAutenticada(evento); });
  }

  window.apexNotificacoesSistema = Object.freeze({
    registrarServiceWorker,
    solicitarPermissao,
    notificarAbertura,
    definirBadge,
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar, { once: true });
  else inicializar();
})();
