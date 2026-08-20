(() => {
  'use strict';

  const CONFIG = Object.freeze({
    versao: 'etapa10-notificacao-teste',
    titulo: 'APEX Food — teste de abertura',
    icone: '/assets/apex-food-logo-aprimorada.png',
    badge: '/assets/apex-food-logo-aprimorada.png',
    url: '/',
    firebaseSdkVersion: '12.1.0',
  });

  const estado = {
    registro: null,
    inicializado: false,
    notificacaoEnviada: false,
    fcm: null,
    tokenRegistrado: false,
    foregroundRegistrado: false,
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

  let fcmPromise = null;

  async function carregarFirebaseMessaging() {
    const configuracao = window.apexFirebaseMessagingConfig;
    if (!configuracao?.firebaseConfig || !configuracao.vapidKey) return null;
    if (estado.fcm) return estado.fcm;
    if (!fcmPromise) {
      fcmPromise = Promise.all([
        import(`https://www.gstatic.com/firebasejs/${CONFIG.firebaseSdkVersion}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${CONFIG.firebaseSdkVersion}/firebase-messaging.js`),
      ])
        .then(([appSdk, messagingSdk]) => {
          const appExistente = appSdk.getApps().find(app => app.name === 'apex-food-messaging');
          const app = appExistente || appSdk.initializeApp(configuracao.firebaseConfig, 'apex-food-messaging');
          const messaging = messagingSdk.getMessaging(app);
          estado.fcm = { app, messaging, messagingSdk, configuracao };
          return estado.fcm;
        })
        .catch(() => null);
    }
    return fcmPromise;
  }

  function plataformaAtual() {
    const larguraPequena = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches;
    const agente = `${navigator.userAgent || ''} ${navigator.userAgentData?.platform || ''}`;
    if (/Android/i.test(agente)) return larguraPequena ? 'android' : 'tablet';
    if (/iPad|Tablet/i.test(agente)) return 'tablet';
    return 'desktop';
  }

  function origemAtual() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
      ? 'pwa'
      : 'navegador';
  }

  async function registrarTokenFcm() {
    if (estado.tokenRegistrado || !suporteNotificacao() || Notification.permission !== 'granted') return false;
    const api = window.apexModulosApi;
    if (!api?.registrarDispositivoNotificacao) return false;
    const fcm = await carregarFirebaseMessaging();
    if (!fcm) return false;
    const registro = await registrarServiceWorker();
    if (!registro) return false;
    try {
      const token = await fcm.messagingSdk.getToken(fcm.messaging, {
        vapidKey: fcm.configuracao.vapidKey,
        serviceWorkerRegistration: registro,
      });
      if (!token) return false;
      await api.registrarDispositivoNotificacao({
        tokenFcm: token,
        plataforma: plataformaAtual(),
        origem: origemAtual(),
        preferencias: { operacionais: true, sistema: true },
      });
      estado.tokenRegistrado = true;
      return true;
    } catch {
      return false;
    }
  }

  async function ativarMensagensEmPrimeiroPlano() {
    if (estado.foregroundRegistrado) return false;
    const fcm = await carregarFirebaseMessaging();
    if (!fcm || typeof fcm.messagingSdk.onMessage !== 'function') return false;
    fcm.messagingSdk.onMessage(async payload => {
      const notification = payload?.notification || {};
      const dados = payload?.data || {};
      const registro = await registrarServiceWorker();
      if (!registro) return;
      await registro.showNotification(notification.title || dados.titulo || 'APEX Food', {
        body: notification.body || dados.mensagem || 'Há uma atualização operacional.',
        icon: notification.icon || CONFIG.icone,
        badge: notification.badge || CONFIG.badge,
        tag: `apex-food-real-${dados.idNotificacao || Date.now()}`,
        data: { url: dados.url || CONFIG.url },
      });
      await definirBadge();
    });
    estado.foregroundRegistrado = true;
    return true;
  }

  async function solicitarPermissao() {
    if (!suporteNotificacao()) return 'unsupported';
    await registrarServiceWorker();
    if (Notification.permission === 'granted') {
      await registrarTokenFcm();
      await ativarMensagensEmPrimeiroPlano();
      return 'granted';
    }
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      const permissao = await Notification.requestPermission();
      if (permissao === 'granted') {
        await registrarTokenFcm();
        await ativarMensagensEmPrimeiroPlano();
      }
      return permissao;
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
    await registrarTokenFcm();
    await ativarMensagensEmPrimeiroPlano();
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
    registrarTokenFcm,
    ativarMensagensEmPrimeiroPlano,
    notificarAbertura,
    definirBadge,
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar, { once: true });
  else inicializar();
})();
