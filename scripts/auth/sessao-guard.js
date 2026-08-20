(() => {
  'use strict';

  const caminhoAtual = window.location.pathname.replace(/\/+$/, '') || '/';
  const paginaAutenticacao = caminhoAtual === '/autenticacao' || caminhoAtual === '/paginas/autenticacao' || caminhoAtual === '/paginas/autenticacao.html';
  const apiUrl = '/api/v1/auth/session';
  const raiz = document.documentElement;

  if (!paginaAutenticacao) raiz.style.visibility = 'hidden';

  function revelar() {
    raiz.style.visibility = '';
  }

  async function verificarSessao() {
    try {
      const resposta = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (paginaAutenticacao) {
        if (resposta.ok) {
          window.location.replace('/');
          return;
        }
        revelar();
        return;
      }

      if (resposta.status === 401 || resposta.status === 403 || resposta.status === 503) {
        window.location.replace('/autenticacao');
        return;
      }
      revelar();
    } catch {
      if (!paginaAutenticacao) {
        window.location.replace('/autenticacao');
        return;
      }
      revelar();
    }
  }

  window.apexSessaoGuard = Object.freeze({ verificarSessao });
  window.addEventListener('DOMContentLoaded', verificarSessao, { once: true });
})();
