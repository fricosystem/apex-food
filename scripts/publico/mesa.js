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
    conteudo: document.getElementById('mesaPublicaConteudo'),
    cardapioCarregando: document.getElementById('mesaPublicaCardapioCarregando'),
    cardapioVazio: document.getElementById('mesaPublicaCardapioVazio'),
    cardapioVazioTexto: document.getElementById('mesaPublicaCardapioVazioTexto'),
    cardapioCategorias: document.getElementById('mesaPublicaCardapioCategorias'),
    cardapioProdutos: document.getElementById('mesaPublicaCardapioProdutos'),
    cardapioAtualizado: document.getElementById('mesaPublicaCardapioAtualizado'),
    cardapioDescricao: document.getElementById('mesaPublicaCardapioDescricao'),
    carrinhoVazio: document.getElementById('mesaPublicaCarrinhoVazio'),
    carrinhoLista: document.getElementById('mesaPublicaCarrinhoLista'),
    carrinhoQuantidade: document.getElementById('mesaPublicaCarrinhoQuantidade'),
    carrinhoTotal: document.getElementById('mesaPublicaCarrinhoTotal'),
    observacoes: document.getElementById('mesaPublicaObservacoes'),
    enviarPedido: document.getElementById('mesaPublicaEnviarPedido'),
    pedidoFeedback: document.getElementById('mesaPublicaPedidoFeedback'),
    comandaStatus: document.getElementById('mesaPublicaComandaStatus'),
    comandaTotal: document.getElementById('mesaPublicaComandaTotal'),
    comandaVazia: document.getElementById('mesaPublicaComandaVazia'),
    pedidos: document.getElementById('mesaPublicaPedidos'),
    atualizarComanda: document.getElementById('mesaPublicaAtualizarComanda'),
  };

  const parametros = new URLSearchParams(window.location.search);
  let tokenAtual = parametros.get('qr') || '';
  let dadosMesa = null;
  let csrfToken = '';
  let csrfPromise = null;

  const estado = {
    cardapio: null,
    categoriaSelecionada: 'todas',
    carrinho: new Map(),
    pollingId: null,
    pollingAtivo: false,
    pollingFalhas: 0,
    enviandoPedido: false,
  };

  function chaveIdempotencia(prefixo = 'mesa') {
    const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefixo}:${id}`;
  }

  async function lerResposta(resposta) {
    let dados = {};
    try { dados = await resposta.json(); } catch { dados = {}; }
    if (!resposta.ok) {
      const erro = new Error(dados.mensagem || 'Não foi possível concluir o atendimento.');
      erro.status = resposta.status;
      erro.code = dados.erro || 'ERRO_ATENDIMENTO';
      erro.aguardeSegundos = Number(dados.detalhes?.aguardeSegundos || 0) || 0;
      erro.idRequisicao = dados.idRequisicao || '';
      throw erro;
    }
    return dados;
  }

  function mensagemErroAtendimento(erro, fallback = 'Não foi possível atualizar o atendimento.') {
    if (erro?.status === 429) return `Muitas tentativas em sequência. Aguarde ${erro.aguardeSegundos || 60} segundos e tente novamente.`;
    if (erro?.status === 503) return 'A proteção do atendimento está temporariamente indisponível. Tente novamente em instantes.';
    return erro?.message || fallback;
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
      alternar(elementos.conteudo, false);
    }
  }

  function pararPolling() {
    if (estado.pollingId) window.clearTimeout(estado.pollingId);
    estado.pollingId = null;
  }

  function agendarPolling(atraso = 15000) {
    if (!estado.pollingAtivo || document.hidden || estado.pollingId) return;
    const jitter = Math.floor(Math.random() * 1200);
    estado.pollingId = window.setTimeout(async () => {
      estado.pollingId = null;
      const atualizou = await atualizarComanda({ silencioso: true, polling: true });
      const intervaloBase = atualizou ? 15000 : Math.min(60000, Math.max(15000, atraso * 2));
      agendarPolling(intervaloBase);
    }, Math.max(250, atraso + jitter));
  }

  function mostrarErro(mensagem) {
    pararPolling();
    mostrarCarregando(false);
    alternar(elementos.formulario, false);
    alternar(elementos.atendimento, false);
    alternar(elementos.conteudo, false);
    elementos.erroTexto.textContent = mensagem || 'Verifique o QR Code e tente novamente.';
    alternar(elementos.erro, true);
    window.lucide?.createIcons();
  }

  function mostrarFormulario() {
    pararPolling();
    mostrarCarregando(false);
    alternar(elementos.erro, false);
    alternar(elementos.atendimento, false);
    alternar(elementos.conteudo, false);
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
    alternar(elementos.conteudo, true);
    const mesa = dados?.mesa?.nome || (dados?.mesa?.numero ? `Mesa ${dados.mesa.numero}` : 'sua mesa');
    const nome = dados?.participante?.nomeExibicao || dados?.participante?.nomeCompleto || 'cliente';
    elementos.atendimentoTexto.textContent = `${nome} está identificado no atendimento da ${mesa}.`;
    elementos.titulo.textContent = mesa;
    elementos.descricao.textContent = 'Seu atendimento está associado a esta mesa.';
    elementos.comandaStatus.textContent = dados?.comanda?.status ? rotuloStatus(dados.comanda.status) : 'Aberta';
    elementos.comandaTotal.textContent = dados?.comanda?.totalCentavos ? formatarMoeda(dados.comanda.totalCentavos) : '—';
    carregarCardapio();
    atualizarComanda({ silencioso: true });
    iniciarPolling();
    window.lucide?.createIcons();
  }

  function formatarMoeda(centavos) {
    if (centavos === null || centavos === undefined) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos || 0) / 100);
  }

  function formatarData(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function rotuloStatus(valor) {
    const estados = {
      aberta: 'Aberta',
      em_consumo: 'Em consumo',
      encaminhada_caixa: 'Encaminhada ao caixa',
      encerrada: 'Encerrada',
      aguardando_confirmacao_garcom: 'Aguardando confirmação do garçom',
      confirmado_garcom: 'Confirmado pelo garçom',
      enviado_cozinha: 'Enviado à cozinha',
      em_preparo: 'Em preparo',
      pronto: 'Pronto para servir',
      servido: 'Servido',
      cancelado: 'Cancelado',
    };
    return estados[valor] || 'Em acompanhamento';
  }

  function classeStatus(valor) {
    if (['pronto', 'servido'].includes(valor)) return 'border-green/30 bg-green/10 text-green-100';
    if (['cancelado', 'encerrada'].includes(valor)) return 'border-red/30 bg-red/10 text-red-100';
    if (['em_preparo', 'enviado_cozinha', 'confirmado_garcom'].includes(valor)) return 'border-blue/30 bg-blue/10 text-blue-100';
    return 'border-accent/30 bg-accent/10 text-orange-100';
  }

  function criarElemento(tag, classes = '', texto = null) {
    const elemento = document.createElement(tag);
    if (classes) elemento.className = classes;
    if (texto !== null && texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function mostrarFeedback(elemento, mensagem, tipo = 'erro') {
    if (!elemento) return;
    elemento.textContent = mensagem || '';
    elemento.className = mensagem ? `text-xs mt-3 ${tipo === 'sucesso' ? 'text-green-200' : 'text-red-200'}` : 'hidden text-xs mt-3';
  }

  function renderizarCategorias() {
    elementos.cardapioCategorias.replaceChildren();
    const filtros = [{ id: 'todas', nome: 'Todos' }, ...(estado.cardapio?.categorias || [])];
    filtros.forEach(categoria => {
      const ativo = estado.categoriaSelecionada === categoria.id;
      const botao = criarElemento('button', `mesa-publica-filtro rounded-full border px-3 py-2 text-[11px] font-semibold whitespace-nowrap ${ativo ? 'border-accent/50 bg-accent/10 text-orange-100' : 'border-border bg-card text-muted hover:border-accent/40 hover:text-white'}`, categoria.nome);
      botao.type = 'button';
      botao.setAttribute('role', 'tab');
      botao.setAttribute('aria-selected', ativo ? 'true' : 'false');
      botao.addEventListener('click', () => { estado.categoriaSelecionada = categoria.id; renderizarCategorias(); renderizarProdutos(); });
      elementos.cardapioCategorias.appendChild(botao);
    });
  }

  function adicionarProduto(produto) {
    if (!produto?.disponibilidade) return;
    const atual = estado.carrinho.get(produto.id);
    estado.carrinho.set(produto.id, { produto, quantidade: Math.min(100, Number(atual?.quantidade || 0) + 1) });
    renderizarProdutos();
    renderizarCarrinho();
    mostrarFeedback(elementos.pedidoFeedback, 'Item adicionado ao carrinho.', 'sucesso');
    window.setTimeout(() => { if (elementos.pedidoFeedback.textContent === 'Item adicionado ao carrinho.') mostrarFeedback(elementos.pedidoFeedback, ''); }, 2600);
  }

  function renderizarProdutos() {
    const produtos = (estado.cardapio?.produtos || []).filter(produto => estado.categoriaSelecionada === 'todas' || produto.idCategoria === estado.categoriaSelecionada);
    elementos.cardapioProdutos.replaceChildren();
    if (!produtos.length) {
      elementos.cardapioVazioTexto.textContent = estado.cardapio?.produtos?.length ? 'Nenhum produto está disponível nesta categoria.' : 'O cardápio desta mesa ainda não foi publicado.';
      alternar(elementos.cardapioVazio, true);
      alternar(elementos.cardapioProdutos, false);
      return;
    }
    alternar(elementos.cardapioVazio, false);
    alternar(elementos.cardapioProdutos, true);
    produtos.forEach(produto => {
      const card = criarElemento('article', 'rounded-xl border border-border bg-card p-4 flex flex-col gap-3');
      const topo = criarElemento('div', 'flex items-start justify-between gap-3');
      const texto = criarElemento('div', 'min-w-0');
      texto.appendChild(criarElemento('h3', 'text-sm font-semibold text-white', produto.nome));
      if (produto.descricao) texto.appendChild(criarElemento('p', 'text-xs text-muted mt-1', produto.descricao));
      topo.appendChild(texto);
      if (produto.tempoPreparo > 0) topo.appendChild(criarElemento('span', 'shrink-0 text-[10px] text-muted', `${produto.tempoPreparo} min`));
      card.appendChild(topo);
      const rodape = criarElemento('div', 'mt-auto flex items-center justify-between gap-3 pt-2');
      rodape.appendChild(criarElemento('strong', 'text-sm text-white', produto.precoCentavos === null ? 'Consulte o atendimento' : formatarMoeda(produto.precoCentavos)));
      const noCarrinho = estado.carrinho.get(produto.id);
      const botao = criarElemento('button', `rounded-lg px-3 py-2 text-[11px] font-semibold ${produto.disponibilidade ? 'bg-accent text-white hover:bg-accentHover' : 'border border-border text-muted cursor-not-allowed'}`, produto.disponibilidade ? (noCarrinho ? `Adicionar mais (${noCarrinho.quantidade})` : 'Adicionar') : 'Indisponível');
      botao.type = 'button';
      botao.disabled = !produto.disponibilidade;
      botao.addEventListener('click', () => adicionarProduto(produto));
      rodape.appendChild(botao);
      card.appendChild(rodape);
      elementos.cardapioProdutos.appendChild(card);
    });
  }

  function alterarQuantidade(idProduto, delta) {
    const item = estado.carrinho.get(idProduto);
    if (!item) return;
    const quantidade = Number(item.quantidade || 0) + delta;
    if (quantidade <= 0) estado.carrinho.delete(idProduto);
    else item.quantidade = Math.min(100, quantidade);
    renderizarProdutos();
    renderizarCarrinho();
  }

  function renderizarCarrinho() {
    const itens = [...estado.carrinho.values()];
    const quantidadeTotal = itens.reduce((total, item) => total + item.quantidade, 0);
    const totalCentavos = itens.length && itens.every(item => item.produto.precoCentavos !== null) ? itens.reduce((total, item) => total + Number(item.produto.precoCentavos || 0) * item.quantidade, 0) : null;
    elementos.carrinhoQuantidade.textContent = `${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`;
    elementos.carrinhoTotal.textContent = itens.length ? formatarMoeda(totalCentavos) : '—';
    elementos.carrinhoLista.replaceChildren();
    alternar(elementos.carrinhoVazio, !itens.length);
    alternar(elementos.carrinhoLista, Boolean(itens.length));
    elementos.enviarPedido.disabled = !itens.length || estado.enviandoPedido || estado.cardapio?.configuracao?.aceitarPedidos !== true;
    itens.forEach(item => {
      const linha = criarElemento('div', 'rounded-lg border border-border bg-card p-3');
      const topo = criarElemento('div', 'flex items-start justify-between gap-3');
      topo.appendChild(criarElemento('p', 'text-xs font-semibold text-white', item.produto.nome));
      topo.appendChild(criarElemento('strong', 'text-xs text-white', item.produto.precoCentavos === null ? '—' : formatarMoeda(Number(item.produto.precoCentavos || 0) * item.quantidade)));
      linha.appendChild(topo);
      const controles = criarElemento('div', 'mt-3 flex items-center justify-between gap-3');
      const quantidade = criarElemento('div', 'inline-flex items-center rounded-lg border border-border bg-card2');
      const menos = criarElemento('button', 'px-2.5 py-1.5 text-sm text-muted hover:text-white', '−');
      menos.type = 'button';
      menos.setAttribute('aria-label', `Remover uma unidade de ${item.produto.nome}`);
      menos.addEventListener('click', () => alterarQuantidade(item.produto.id, -1));
      const numero = criarElemento('span', 'min-w-8 text-center text-xs font-semibold text-white', String(item.quantidade));
      const mais = criarElemento('button', 'px-2.5 py-1.5 text-sm text-muted hover:text-white', '+');
      mais.type = 'button';
      mais.setAttribute('aria-label', `Adicionar uma unidade de ${item.produto.nome}`);
      mais.addEventListener('click', () => alterarQuantidade(item.produto.id, 1));
      quantidade.append(menos, numero, mais);
      controles.appendChild(quantidade);
      const remover = criarElemento('button', 'text-[11px] text-muted hover:text-red-200', 'Remover');
      remover.type = 'button';
      remover.addEventListener('click', () => { estado.carrinho.delete(item.produto.id); renderizarProdutos(); renderizarCarrinho(); });
      controles.appendChild(remover);
      linha.appendChild(controles);
      elementos.carrinhoLista.appendChild(linha);
    });
  }

  async function carregarCardapio() {
    alternar(elementos.cardapioCarregando, true);
    alternar(elementos.cardapioVazio, false);
    alternar(elementos.cardapioCategorias, false);
    alternar(elementos.cardapioProdutos, false);
    try {
      estado.cardapio = await requisitar('?acao=cardapio');
      estado.categoriaSelecionada = 'todas';
      if (!estado.cardapio.categorias?.length || !estado.cardapio.produtos?.length) {
        elementos.cardapioVazioTexto.textContent = 'O cardápio desta mesa ainda não foi publicado.';
        alternar(elementos.cardapioVazio, true);
      } else {
        renderizarCategorias();
        renderizarProdutos();
        alternar(elementos.cardapioCategorias, true);
      }
      elementos.cardapioAtualizado.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      elementos.cardapioDescricao.textContent = estado.cardapio.configuracao?.aceitarPedidos === true ? 'Os itens selecionados ficam no carrinho até o envio do pedido.' : 'O restaurante está exibindo o cardápio, mas não está aceitando pedidos neste momento.';
      renderizarCarrinho();
    } catch (erro) {
      estado.cardapio = null;
      elementos.cardapioVazioTexto.textContent = erro.code === 'CARDAPIO_NAO_PUBLICADO' ? erro.message : mensagemErroAtendimento(erro, 'O cardápio não está disponível no momento. Tente atualizar o atendimento.');
      alternar(elementos.cardapioVazio, true);
      alternar(elementos.cardapioCategorias, false);
      alternar(elementos.cardapioProdutos, false);
      renderizarCarrinho();
    } finally {
      alternar(elementos.cardapioCarregando, false);
      window.lucide?.createIcons();
    }
  }

  function renderizarPedidos(pedidos) {
    elementos.pedidos.replaceChildren();
    if (!pedidos?.length) {
      alternar(elementos.pedidos, false);
      alternar(elementos.comandaVazia, true);
      return;
    }
    alternar(elementos.comandaVazia, false);
    alternar(elementos.pedidos, true);
    pedidos.forEach(pedido => {
      const card = criarElemento('article', 'rounded-lg border border-border bg-card p-3');
      const topo = criarElemento('div', 'flex items-start justify-between gap-3');
      const titulo = criarElemento('div');
      titulo.appendChild(criarElemento('p', 'text-xs font-semibold text-white', pedido.numero ? `Pedido #${pedido.numero}` : 'Pedido enviado'));
      const data = formatarData(pedido.criadoEm);
      if (data) titulo.appendChild(criarElemento('p', 'text-[10px] text-muted mt-1', data));
      topo.appendChild(titulo);
      topo.appendChild(criarElemento('span', `rounded-full border px-2 py-1 text-[10px] font-semibold ${classeStatus(pedido.statusPedido)}`, rotuloStatus(pedido.statusPedido)));
      card.appendChild(topo);
      const lista = criarElemento('div', 'mt-3 space-y-1.5');
      (pedido.itens || []).forEach(item => lista.appendChild(criarElemento('p', 'text-xs text-muted', `${item.quantidade}x ${item.nomeProduto}${item.observacoes ? ` — ${item.observacoes}` : ''}`)));
      card.appendChild(lista);
      if (pedido.totalCentavos !== null && pedido.totalCentavos !== undefined) card.appendChild(criarElemento('p', 'mt-3 border-t border-border pt-3 text-right text-xs font-semibold text-white', formatarMoeda(pedido.totalCentavos)));
      elementos.pedidos.appendChild(card);
    });
  }

  async function atualizarComanda({ silencioso = false, polling = false } = {}) {
    if (!silencioso) elementos.atualizarComanda.disabled = true;
    try {
      const dados = await requisitar('?acao=comanda');
      estado.pollingFalhas = 0;
      elementos.comandaStatus.textContent = rotuloStatus(dados.comanda?.status);
      elementos.comandaTotal.textContent = dados.comanda?.totalCentavos === null ? 'Não informado' : formatarMoeda(dados.comanda?.totalCentavos);
      renderizarPedidos(dados.pedidos);
      return true;
    } catch (erro) {
      if (erro.status === 401) {
        estado.pollingAtivo = false;
        mostrarErro(erro.message || 'A sessão da mesa não está mais disponível.');
        return false;
      }
      if (erro.code === 'CARDAPIO_NAO_PUBLICADO') {
        elementos.comandaStatus.textContent = dadosMesa?.comanda?.status ? rotuloStatus(dadosMesa.comanda.status) : 'Aberta';
        elementos.comandaTotal.textContent = '—';
        return true;
      }
      estado.pollingFalhas += 1;
      if (!silencioso || erro.status === 429 || erro.status === 503) mostrarFeedback(elementos.pedidoFeedback, mensagemErroAtendimento(erro, 'Não foi possível atualizar a comanda.'), 'erro');
      return false;
    } finally {
      if (!silencioso) elementos.atualizarComanda.disabled = false;
    }
  }

  function iniciarPolling() {
    estado.pollingAtivo = true;
    estado.pollingFalhas = 0;
    agendarPolling(15000);
  }

  async function enviarPedido() {
    const itens = [...estado.carrinho.values()];
    if (!itens.length || estado.enviandoPedido) return;
    if (estado.cardapio?.configuracao?.aceitarPedidos !== true) {
      mostrarFeedback(elementos.pedidoFeedback, 'O restaurante não está aceitando pedidos neste momento.');
      return;
    }
    estado.enviandoPedido = true;
    elementos.enviarPedido.disabled = true;
    elementos.enviarPedido.textContent = 'Enviando ao garçom...';
    mostrarFeedback(elementos.pedidoFeedback, '');
    try {
      const dados = await requisitar('', {
        method: 'POST',
        body: {
          acao: 'pedido',
          itens: itens.map(item => ({ idProduto: item.produto.id, quantidade: item.quantidade })),
          observacoes: elementos.observacoes.value.trim(),
          chaveIdempotencia: chaveIdempotencia('pedido-mesa'),
        },
      });
      estado.carrinho.clear();
      elementos.observacoes.value = '';
      renderizarProdutos();
      renderizarCarrinho();
      mostrarFeedback(elementos.pedidoFeedback, dados.pedido?.numero ? `Pedido #${dados.pedido.numero} enviado ao garçom.` : 'Pedido enviado ao garçom.', 'sucesso');
      await atualizarComanda({ silencioso: true });
    } catch (erro) {
      if (erro.status === 401) {
        mostrarErro(erro.message || 'A sessão da mesa não está mais disponível.');
        return;
      }
      mostrarFeedback(elementos.pedidoFeedback, mensagemErroAtendimento(erro, 'Não foi possível enviar o pedido.'));
    } finally {
      estado.enviandoPedido = false;
      elementos.enviarPedido.textContent = 'Enviar pedido ao garçom';
      renderizarCarrinho();
    }
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
      atualizarCabecalho(sessao);
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
      elementos.feedback.textContent = mensagemErroAtendimento(erro, 'Não foi possível abrir o atendimento.');
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
      atualizarCabecalho(sessao);
      mostrarAtendimento(sessao);
    } catch (erro) {
      mostrarErro(erro.message || 'A sessão da mesa não está mais disponível.');
    } finally {
      elementos.atualizar.disabled = false;
    }
  });
  elementos.atualizarComanda?.addEventListener('click', () => atualizarComanda());
  elementos.enviarPedido?.addEventListener('click', enviarPedido);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pararPolling();
      return;
    }
    if (estado.pollingAtivo) agendarPolling(500);
  });
  window.addEventListener('beforeunload', () => { estado.pollingAtivo = false; pararPolling(); });

  renderizarCarrinho();
  carregarMesa();
})();
