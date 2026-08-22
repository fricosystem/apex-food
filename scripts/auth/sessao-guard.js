(() => {
  'use strict';

  const caminhoAtual = window.location.pathname.replace(/\/+$/, '') || '/';
  const paginaAutenticacao = caminhoAtual === '/autenticacao' || caminhoAtual === '/paginas/autenticacao' || caminhoAtual === '/paginas/autenticacao.html';
  const paginaMesaPublica = caminhoAtual === '/mesa';
  const apiUrl = '/api/v1/auth/session';
  const raiz = document.documentElement;

  if (!paginaAutenticacao && !paginaMesaPublica) raiz.style.visibility = 'hidden';

  function revelar() {
    raiz.style.visibility = '';
  }

  function informarSessaoAutenticada(dados) {
    window.dispatchEvent(new CustomEvent('apex:sessao-autenticada', {
      detail: {
        origem: 'restaurada',
        sessao: {
          usuario: {
            tipoConta: dados?.usuario?.tipoConta || null,
            acessoGlobal: dados?.usuario?.acessoGlobal || 'nenhum',
            papeisGlobais: Array.isArray(dados?.usuario?.papeisGlobais) ? dados.usuario.papeisGlobais.slice(0, 5) : [],
          },
          restauranteAtivo: dados?.restauranteAtivo ? {
            idRestaurante: dados.restauranteAtivo.idRestaurante || null,
            papeis: Array.isArray(dados.restauranteAtivo.papeis) ? dados.restauranteAtivo.papeis.slice(0, 20) : [],
          } : null,
        },
      },
    }));
  }

  async function verificarSessao() {
    try {
      const resposta = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      let dados = null;
      if (resposta.ok) {
        try {
          dados = await resposta.json();
        } catch {
          dados = null;
        }
      }
      const possuiRestauranteAtivo = typeof dados?.restauranteAtivo?.idRestaurante === 'string'
        && dados.restauranteAtivo.idRestaurante.length > 0;
      const possuiAcessoGlobal = dados?.usuario?.acessoGlobal === 'desenvolvedor';

      if (paginaMesaPublica) {
        revelar();
        return;
      }

      if (paginaAutenticacao) {
        if (resposta.ok && possuiAcessoGlobal) {
          window.location.replace('/dashboard-estabelecimentos');
          return;
        }
        if (resposta.ok && possuiRestauranteAtivo) {
          window.location.replace('/');
          return;
        }
        revelar();
        return;
      }

      if (resposta.status === 401 || resposta.status === 403 || resposta.status === 503 || (resposta.ok && !possuiRestauranteAtivo && !possuiAcessoGlobal)) {
        window.location.replace('/autenticacao');
        return;
      }
      informarSessaoAutenticada(dados);
      revelar();
    } catch {
      if (paginaMesaPublica) {
        revelar();
        return;
      }
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
