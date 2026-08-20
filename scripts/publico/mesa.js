(() => {
  'use strict';

  document.body.classList.add('apex-publico-mesa');

  const elementos = {
    carregando: document.getElementById('mesaPublicaCarregando'),
    erro: document.getElementById('mesaPublicaErro'),
    erroTexto: document.getElementById('mesaPublicaErroTexto'),
    tentarNovamente: document.getElementById('mesaPublicaTentarNovamente'),
    formulario: document.getElementById('mesaPublicaFormulario'),
    nome: document.getElementById('mesaPublicaNome'),
    mesa: document.getElementById('mesaPublicaMesa'),
    feedback: document.getElementById('mesaPublicaFeedback'),
    continuar: document.getElementById('mesaPublicaContinuar'),
    atendimento: document.getElementById('mesaPublicaAtendimento'),
    atendimentoTexto: document.getElementById('mesaPublicaAtendimentoTexto'),
    atualizar: document.getElementById('mesaPublicaAtualizar'),
    restaurante: document.getElementById('mesaPublicaNomeRestaurante'),
    titulo: document.getElementById('mesaPublicaTitulo'),
    descricao: document.getElementById('mesaPublicaDescricao'),
  };

  const parametros = new URLSearchParams(window.location.search);
  let tokenAtual = parametros.get('qr') || '';
  let dadosMesa = null;
  let csrfToken = '';
  let csrfPromise = null;

  function chaveIdempotencia() {
    const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `sessao-mesa:${id}`;
  }

  async function lerResposta(resposta) {
    let dados = {};
    try { dados = await resposta.json(); } catch { dados = {}; }
    if (!resposta.ok) {
      const erro = new Error(dados.mensagem || 'Não foi possível concluir o atendimento.');
      erro.status = resposta.status;
      erro.code = dados.erro || 'ERRO_ATENDIMENTO';
      throw erro;
    }
    return dados;
  }

  async function obterCsrf() {
    if (csrfToken) return csrfToken;
    if (csrfPromise) return csrfPromise;
    csrfPromise = fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(lerResposta)
      .then(dados => {
        if (typeof dados.csrf !== 'string' || dados.csrf.length < 40) throw new Error('Não foi possível proteger este atendimento.');
        csrfToken = dados.csrf;
        return csrfToken;
      })
      .finally(() => { csrfPromise = null; });
    return csrfPromise;
  }

  async function requisitar(caminho, opcoes = {}) {
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    const headers = new Headers(opcoes.headers || {});
    headers.set('Accept', 'application/json');
    let corpo = opcoes.body;
    if (corpo !== undefined && corpo !== null && typeof corpo !== 'string') {
      headers.set('Content-Type', 'application/json');
      corpo = JSON.stringify(corpo);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo)) headers.set('X-CSRF-Token', await obterCsrf());
    const resposta = await fetch(`/api/v1/qrcode-mesa${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: corpo,
    });
    return lerResposta(resposta);
  }

  function alternar(elemento, visivel) {
    elemento?.classList.toggle('hidden', !visivel);
  }

  function mostrarCarregando(visivel) {
    alternar(elementos.carregando, visivel);
    if (visivel) {
      alternar(elementos.erro, false);
      alternar(elementos.formulario, false);
      alternar(elementos.atendimento, false);
    }
  }

  function mostrarErro(mensagem) {
    mostrarCarregando(false);
    alternar(elementos.formulario, false);
    alternar(elementos.atendimento, false);
    elementos.erroTexto.textContent = mensagem || 'Verifique o QR Code e tente novamente.';
    alternar(elementos.erro, true);
    window.lucide?.createIcons();
  }

  function mostrarFormulario() {
    mostrarCarregando(false);
    alternar(elementos.erro, false);
    alternar(elementos.atendimento, false);
    alternar(elementos.formulario, true);
    elementos.nome?.focus();
    window.lucide?.createIcons();
  }

  function atualizarCabecalho(dados) {
    dadosMesa = dados;
    if (dados?.restaurante?.nome) elementos.restaurante.textContent = dados.restaurante.nome;
    if (dados?.mesa) {
      const identificacao = dados.mesa.nome || (dados.mesa.numero ? `Mesa ${dados.mesa.numero}` : 'Mesa');
      elementos.mesa.textContent = `${identificacao}. O garçom verá seu nome junto aos itens solicitados.`;
      elementos.titulo.textContent = identificacao;
      elementos.descricao.textContent = 'Identifique-se para que o garçom reconheça seus pedidos.';
    }
  }

  function mostrarAtendimento(dados) {
    mostrarCarregando(false);
    alternar(elementos.erro, false);
    alternar(elementos.formulario, false);
    alternar(elementos.atendimento, true);
    const mesa = dados?.mesa?.nome || (dados?.mesa?.numero ? `Mesa ${dados.mesa.numero}` : 'sua mesa');
    const nome = dados?.participante?.nomeExibicao || dados?.participante?.nomeCompleto || 'cliente';
    elementos.atendimentoTexto.textContent = `${nome} está identificado no atendimento da ${mesa}.`;
    elementos.titulo.textContent = mesa;
    elementos.descricao.textContent = 'Seu atendimento está associado a esta mesa.';
    window.lucide?.createIcons();
  }

  async function carregarMesa() {
    mostrarCarregando(true);
    try {
      if (tokenAtual) {
        const dados = await requisitar(`?acao=validar&qr=${encodeURIComponent(tokenAtual)}`);
        atualizarCabecalho(dados);
        window.history.replaceState({}, '', '/mesa');
        mostrarFormulario();
        return;
      }
      const sessao = await requisitar('?acao=sessao');
      atualizarCabecalho({ mesa: sessao.mesa });
      mostrarAtendimento(sessao);
    } catch (erro) {
      if (erro.status === 401 && !tokenAtual) {
        mostrarErro('Aponte a câmera do celular para o QR Code da mesa para iniciar o atendimento.');
        return;
      }
      mostrarErro(erro.message || 'Verifique o QR Code e tente novamente.');
    }
  }

  async function iniciarAtendimento() {
    const nome = elementos.nome.value.trim().replace(/\s+/g, ' ');
    if (!nome || nome.split(' ').length < 2) {
      elementos.feedback.textContent = 'Informe seu nome completo para continuar.';
      elementos.feedback.className = 'text-xs mt-3 text-red-200';
      elementos.nome.focus();
      return;
    }
    elementos.continuar.disabled = true;
    elementos.continuar.textContent = 'Abrindo atendimento...';
    elementos.feedback.className = 'hidden text-xs mt-3';
    try {
      const dados = await requisitar('', {
        method: 'POST',
        body: { acao: 'abrir', qr: tokenAtual, nomeCompleto: nome, chaveIdempotencia: chaveIdempotencia() },
      });
      tokenAtual = '';
      window.history.replaceState({}, '', '/mesa');
      mostrarAtendimento(dados);
    } catch (erro) {
      elementos.feedback.textContent = erro.message || 'Não foi possível abrir o atendimento.';
      elementos.feedback.className = 'text-xs mt-3 text-red-200';
    } finally {
      elementos.continuar.disabled = false;
      elementos.continuar.textContent = 'Entrar no atendimento';
    }
  }

  elementos.continuar?.addEventListener('click', iniciarAtendimento);
  elementos.nome?.addEventListener('keydown', evento => { if (evento.key === 'Enter') iniciarAtendimento(); });
  elementos.tentarNovamente?.addEventListener('click', carregarMesa);
  elementos.atualizar?.addEventListener('click', async () => {
    elementos.atualizar.disabled = true;
    try {
      const sessao = await requisitar('?acao=sessao');
      atualizarCabecalho({ mesa: sessao.mesa });
      mostrarAtendimento(sessao);
    } catch (erro) {
      mostrarErro(erro.message || 'A sessão da mesa não está mais disponível.');
    } finally {
      elementos.atualizar.disabled = false;
    }
  });

  carregarMesa();
})();
