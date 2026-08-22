(() => {
  'use strict';

  const page = document.querySelector('.auth-page');
  if (!page) return;

  const APEX_DOMAIN = '@apexfood.com';
  const api = window.apexAuthApi;

  const state = {
    mode: 'login',
    redirectTimer: null,
    restaurantes: [],
    contextoResolve: null,
    provisionamento: {
      id: '',
      chaveIdempotencia: '',
      etapa: 1,
      estabelecimento: null,
      diretor: null,
      conta: null,
    },
  };

  const elements = {
    tabs: Array.from(document.querySelectorAll('[data-auth-tab]')),
    forms: Array.from(document.querySelectorAll('[data-auth-form]')),
    formCard: document.querySelector('#auth-form-card'),
    feedback: document.querySelector('#auth-feedback'),
    title: document.querySelector('#auth-form-title'),
    description: document.querySelector('#auth-form-description'),
    redirectNote: document.querySelector('#auth-redirect-note'),
    contextChoice: document.querySelector('#auth-context-choice'),
    restaurantContext: document.querySelector('#auth-restaurant-context'),
    noRestaurant: document.querySelector('#auth-no-restaurant'),
    restaurantSelect: document.querySelector('#auth-restaurant-select'),
    contextSubmit: document.querySelector('#auth-context-submit'),
    onboarding: document.querySelector('#auth-onboarding'),
    provisionForm: document.querySelector('#auth-provisionamento-form'),
    provisionSteps: Array.from(document.querySelectorAll('[data-provision-step]')),
    provisionIndicators: Array.from(document.querySelectorAll('[data-provision-step-indicator]')),
    provisionReview: document.querySelector('#auth-provision-review'),
    provisionActions: document.querySelector('[data-provision-actions]'),
    provisionCancel: document.querySelector('#auth-provision-cancel'),
    provisionBack: document.querySelector('#auth-provision-back'),
    provisionNext: document.querySelector('#auth-provision-next'),
    provisionConfirm: document.querySelector('#auth-provision-confirm'),
    provisionNew: document.querySelector('#auth-provision-novo'),
    provisionSuccessMessage: document.querySelector('#auth-provision-success-message'),
  };

  const copy = {
    login: {
      title: 'Bem-vindo de volta',
      description: 'Entre na sua conta para continuar acompanhando o seu restaurante.',
      firstField: '#login-identifier',
    },
    register: {
      title: 'Crie seu acesso',
      description: 'Configure sua conta e comece a organizar sua operação com mais clareza.',
      firstField: '#register-name',
    },
  };

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function setFeedback(message, type = 'error') {
    if (!elements.feedback) return;

    elements.feedback.className = `auth-feedback is-visible is-${type}`;
    elements.feedback.innerHTML = type === 'success'
      ? `<i data-lucide="circle-check" aria-hidden="true"></i><span>${message}</span>`
      : `<i data-lucide="circle-alert" aria-hidden="true"></i><span>${message}</span>`;
    renderIcons();
  }

  function clearFeedback() {
    if (!elements.feedback) return;
    elements.feedback.className = 'auth-feedback';
    elements.feedback.innerHTML = '';
  }

  function setFieldState(input, message = '') {
    if (!input) return;

    const error = document.querySelector(`[data-error-for="${input.id}"]`);
    const hasError = Boolean(message);
    input.classList.toggle('is-invalid', hasError);
    input.classList.toggle('is-valid', !hasError && input.value.trim() !== '');
    input.setAttribute('aria-invalid', String(hasError));
    if (error) error.textContent = message;
  }

  function clearFormState(form) {
    if (!form) return;
    form.querySelectorAll('.auth-input').forEach((input) => setFieldState(input));
  }

  function setMode(mode, shouldFocus = true) {
    state.mode = mode === 'register' ? 'register' : 'login';
    const activeCopy = copy[state.mode];

    elements.tabs.forEach((tab) => {
      const active = tab.dataset.authTab === state.mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });

    elements.forms.forEach((form) => {
      const active = form.dataset.authForm === state.mode;
      form.hidden = !active;
      form.setAttribute('aria-hidden', String(!active));
      if (!active) clearFormState(form);
    });

    elements.title.textContent = activeCopy.title;
    elements.description.textContent = activeCopy.description;
    clearFeedback();

    elements.formCard.classList.remove('is-transitioning');
    window.requestAnimationFrame(() => elements.formCard.classList.add('is-transitioning'));

    if (shouldFocus) {
      window.setTimeout(() => document.querySelector(activeCopy.firstField)?.focus(), 80);
    }
  }

  function normalizeIdentifier(value) {
    let identifier = String(value || '').trim().toLowerCase();
    if (identifier.endsWith(APEX_DOMAIN)) identifier = identifier.slice(0, -APEX_DOMAIN.length);
    return identifier.replace(/\s+/g, '-');
  }

  function getAccountAddress(input) {
    const identifier = normalizeIdentifier(input?.value);
    return identifier ? `${identifier}${APEX_DOMAIN}` : '';
  }

  function updateIdentifierSuffix(input) {
    if (!input?.matches('.auth-identifier-input')) return;
    const control = input.closest('.auth-domain-control');
    const suffix = control?.querySelector('.auth-domain-suffix');
    if (!control || !suffix) return;

    const identifier = normalizeIdentifier(input.value);
    suffix.textContent = APEX_DOMAIN;
    suffix.classList.toggle('is-visible', Boolean(identifier));

    const probe = document.createElement('span');
    const inputStyle = window.getComputedStyle(input);
    probe.textContent = identifier || input.placeholder || '';
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${inputStyle.font};letter-spacing:${inputStyle.letterSpacing};`;
    document.body.appendChild(probe);
    const textWidth = probe.getBoundingClientRect().width;
    probe.remove();

    const suffixStyle = window.getComputedStyle(suffix);
    const suffixWidth = suffix.getBoundingClientRect().width;
    const paddingLeft = parseFloat(inputStyle.paddingLeft) || 0;
    const minimumLeft = paddingLeft + textWidth + 2;
    const maximumLeft = Math.max(minimumLeft, control.clientWidth - suffixWidth - (parseFloat(suffixStyle.right) || paddingLeft));
    suffix.style.left = `${Math.min(minimumLeft, maximumLeft)}px`;
  }

  function validateIdentifier(input) {
    const identifier = normalizeIdentifier(input.value);
    if (input.value !== identifier) input.value = identifier;
    if (!identifier) return 'Informe seu email.';
    if (identifier.length < 2 || identifier.length > 30) return 'O email deve ter entre 2 e 30 caracteres antes do domínio.';
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(identifier)) {
      return 'Use letras, números, ponto ou hífen antes do domínio @apexfood.com.';
    }
    return '';
  }

  function validatePassword(input, requireComplexity = false) {
    const value = input.value;
    if (!value) return 'Informe sua senha.';
    if (value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (requireComplexity && (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value))) {
      return 'Use maiúscula, minúscula, número e caractere especial.';
    }
    return '';
  }

  function validateLogin(form) {
    const identifier = form.querySelector('[name="identifier"]');
    const password = form.querySelector('[name="password"]');
    const errors = {
      identifier: validateIdentifier(identifier),
      password: validatePassword(password, false),
    };

    setFieldState(identifier, errors.identifier);
    setFieldState(password, errors.password);
    return Object.values(errors).every((message) => !message);
  }

  function validateRegister(form) {
    const name = form.querySelector('[name="fullName"]');
    const identifier = form.querySelector('[name="identifier"]');
    const password = form.querySelector('[name="password"]');
    const confirmPassword = form.querySelector('[name="confirmPassword"]');
    const nameValue = name.value.trim();
    const errors = {
      fullName: !nameValue ? 'Informe seu nome completo.' : nameValue.split(/\s+/).length < 2 ? 'Digite seu nome e sobrenome.' : '',
      identifier: validateIdentifier(identifier),
      password: validatePassword(password, true),
      confirmPassword: !confirmPassword.value
        ? 'Confirme sua senha.'
        : confirmPassword.value !== password.value
          ? 'As senhas não coincidem.'
          : '',
    };

    setFieldState(name, errors.fullName);
    setFieldState(identifier, errors.identifier);
    setFieldState(password, errors.password);
    setFieldState(confirmPassword, errors.confirmPassword);
    return Object.values(errors).every((message) => !message);
  }

  function setLoading(form, isLoading) {
    const submit = form.querySelector('.auth-submit');
    if (!submit) return;

    submit.disabled = isLoading;
    submit.classList.toggle('is-loading', isLoading);
    submit.setAttribute('aria-busy', String(isLoading));
    const label = submit.querySelector('[data-submit-label]');
    if (label) label.textContent = isLoading
      ? state.mode === 'register' ? 'Criando sua conta...' : 'Validando acesso...'
      : state.mode === 'register' ? 'Criar minha conta' : 'Entrar na conta';
    const icon = submit.querySelector('[data-lucide], svg');
    if (icon && isLoading) {
      icon.outerHTML = '<i data-lucide="loader-circle" aria-hidden="true"></i>';
      renderIcons();
    } else if (icon && !isLoading) {
      icon.outerHTML = '<i data-lucide="arrow-right" aria-hidden="true"></i>';
      renderIcons();
    }
  }

  function esconderEscolhaRestaurante() {
    if (elements.contextChoice) elements.contextChoice.hidden = true;
    if (elements.formCard) elements.formCard.hidden = false;
    if (elements.restaurantContext) elements.restaurantContext.hidden = true;
    if (elements.noRestaurant) elements.noRestaurant.hidden = true;
    if (elements.onboarding) elements.onboarding.hidden = true;
    if (elements.restaurantSelect) elements.restaurantSelect.replaceChildren();
    if (elements.contextSubmit) elements.contextSubmit.hidden = false;
    state.restaurantes = [];
  }

  function limparProvisionamento() {
    state.provisionamento = { id: '', chaveIdempotencia: '', etapa: 1, estabelecimento: null, diretor: null, conta: null };
    elements.provisionForm?.reset();
    elements.provisionForm?.querySelectorAll('.auth-input').forEach((input) => setFieldState(input));
    if (elements.provisionReview) elements.provisionReview.innerHTML = '';
  }

  function limparDigitos(valor) { return String(valor || '').replace(/\D/g, ''); }
  function todosIguais(valor) { return /^([0-9])\1+$/.test(valor); }
  function validarCpfLocal(valor) {
    const cpf = limparDigitos(valor);
    if (cpf.length !== 11 || todosIguais(cpf)) return false;
    let soma = 0;
    for (let indice = 0; indice < 9; indice += 1) soma += Number(cpf[indice]) * (10 - indice);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== Number(cpf[9])) return false;
    soma = 0;
    for (let indice = 0; indice < 10; indice += 1) soma += Number(cpf[indice]) * (11 - indice);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === Number(cpf[10]);
  }
  function validarCnpjLocal(valor) {
    const cnpj = limparDigitos(valor);
    if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
    const calcular = (tamanho) => {
      const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const soma = pesos.reduce((total, peso, indice) => total + Number(cnpj[indice]) * peso, 0);
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
  }
  function campoProvision(id) { return document.getElementById(id); }

  function validarEtapaProvisionamento(etapa) {
    const erros = [];
    const exigir = (id, mensagem, valido = Boolean(campoProvision(id)?.value.trim())) => {
      const input = campoProvision(id);
      if (!valido) erros.push({ input, mensagem });
      setFieldState(input, valido ? '' : mensagem);
    };
    if (etapa === 1) {
      exigir('provision-nome', 'Informe o nome do estabelecimento.');
      const tipo = campoProvision('provision-tipo-documento')?.value;
      const documento = campoProvision('provision-documento')?.value;
      exigir('provision-documento', `Informe um ${String(tipo || 'documento').toUpperCase()} válido.`, tipo === 'cpf' ? validarCpfLocal(documento) : validarCnpjLocal(documento));
    }
    if (etapa === 2) {
      exigir('provision-diretor-nome', 'Informe nome e sobrenome.', (campoProvision('provision-diretor-nome')?.value.trim().split(/\\s+/).length || 0) >= 2);
      exigir('provision-diretor-cpf', 'Informe um CPF válido.', validarCpfLocal(campoProvision('provision-diretor-cpf')?.value));
      exigir('provision-diretor-telefone', 'Informe um telefone/WhatsApp válido.', limparDigitos(campoProvision('provision-diretor-telefone')?.value).length >= 10);
      exigir('provision-cep', 'Informe um CEP válido.', limparDigitos(campoProvision('provision-cep')?.value).length === 8);
      exigir('provision-logradouro', 'Informe o logradouro.');
      exigir('provision-numero', 'Informe o número.');
      exigir('provision-bairro', 'Informe o bairro.');
      exigir('provision-cidade', 'Informe a cidade.');
      exigir('provision-estado', 'Informe a UF com duas letras.', /^[A-Za-z]{2}$/.test(campoProvision('provision-estado')?.value.trim() || ''));
    }
    if (etapa === 3) {
      const email = campoProvision('provision-email');
      const senha = campoProvision('provision-senha');
      const confirmacao = campoProvision('provision-confirmar-senha');
      const erroEmail = validateIdentifier(email);
      setFieldState(email, erroEmail);
      if (erroEmail) erros.push({ input: email, mensagem: erroEmail });
      const erroSenha = validatePassword(senha, true);
      setFieldState(senha, erroSenha);
      if (erroSenha) erros.push({ input: senha, mensagem: erroSenha });
      const erroConfirmacao = !confirmacao?.value ? 'Confirme a senha.' : confirmacao.value !== senha?.value ? 'As senhas não coincidem.' : '';
      setFieldState(confirmacao, erroConfirmacao);
      if (erroConfirmacao) erros.push({ input: confirmacao, mensagem: erroConfirmacao });
    }
    if (etapa === 4 && !campoProvision('provision-confirmacao')?.checked) erros.push({ input: campoProvision('provision-confirmacao'), mensagem: 'Confirme os dados para concluir.' });
    if (erros[0]?.input?.focus) erros[0].input.focus();
    return erros.length === 0;
  }

  function dadosProvisionamento() {
    const valor = (id) => campoProvision(id)?.value || '';
    return {
      nome: valor('provision-nome').trim().replace(/\\s+/g, ' '),
      tipoDocumento: valor('provision-tipo-documento'),
      documento: valor('provision-documento'),
      nomeCompleto: valor('provision-diretor-nome').trim().replace(/\\s+/g, ' '),
      cpf: valor('provision-diretor-cpf'),
      telefoneWhatsapp: valor('provision-diretor-telefone'),
      endereco: { cep: valor('provision-cep'), logradouro: valor('provision-logradouro').trim(), numero: valor('provision-numero').trim(), complemento: valor('provision-complemento').trim(), bairro: valor('provision-bairro').trim(), cidade: valor('provision-cidade').trim(), estado: valor('provision-estado').trim().toUpperCase() },
      email: getAccountAddress(campoProvision('provision-email')),
      senha: valor('provision-senha'),
      confirmarSenha: valor('provision-confirmar-senha'),
      diasTeste: Number(valor('provision-dias-teste') || 30),
    };
  }

  function textoSeguro(valor, fallback = 'Não informado') { return valor ? String(valor).replace(/[<>]/g, '') : fallback; }
  function atualizarRevisao() {
    if (!elements.provisionReview) return;
    const dados = dadosProvisionamento();
    const mascarar = (valor) => valor.length > 4 ? `${'*'.repeat(Math.max(0, valor.length - 4))}${valor.slice(-4)}` : '****';
    elements.provisionReview.innerHTML = `<div class="auth-review-group"><strong>Estabelecimento</strong><p>${textoSeguro(dados.nome)}</p><span>${String(dados.tipoDocumento || '').toUpperCase()} ${mascarar(limparDigitos(dados.documento))}</span></div><div class="auth-review-group"><strong>Diretor</strong><p>${textoSeguro(dados.nomeCompleto)}</p><span>CPF ${mascarar(limparDigitos(dados.cpf))} · WhatsApp ${mascarar(limparDigitos(dados.telefoneWhatsapp))}</span></div><div class="auth-review-group"><strong>Acesso</strong><p>${textoSeguro(dados.email)}</p><span>${dados.diasTeste > 0 ? `${dados.diasTeste} dias de teste grátis` : 'Sem período de teste'}</span></div><div class="auth-review-group"><strong>Endereço</strong><p>${textoSeguro(dados.endereco.logradouro)}, ${textoSeguro(dados.endereco.numero)}</p><span>${textoSeguro(dados.endereco.bairro)} · ${textoSeguro(dados.endereco.cidade)} / ${textoSeguro(dados.endereco.estado)}</span></div>`;
  }

  function renderProvisionamentoStep(etapa) {
    state.provisionamento.etapa = etapa;
    elements.provisionSteps.forEach((step) => { const ativo = Number(step.dataset.provisionStep) === etapa; step.hidden = !ativo; step.setAttribute('aria-hidden', String(!ativo)); });
    elements.provisionIndicators.forEach((indicador) => { const numero = Number(indicador.dataset.provisionStepIndicator); indicador.classList.toggle('is-active', numero === etapa); indicador.classList.toggle('is-complete', numero < etapa); });
    const finalizado = etapa === 5;
    if (elements.provisionActions) elements.provisionActions.hidden = finalizado;
    if (elements.provisionBack) elements.provisionBack.hidden = etapa <= 1 || finalizado;
    if (elements.provisionNext) elements.provisionNext.hidden = etapa >= 4 || finalizado;
    if (elements.provisionConfirm) elements.provisionConfirm.hidden = etapa !== 4 || finalizado;
    if (etapa === 4) atualizarRevisao();
    renderIcons();
  }

  function setProvisionLoading(loading, label = 'Continuar') {
    [elements.provisionNext, elements.provisionConfirm, elements.provisionBack, elements.provisionCancel].forEach((botao) => { if (botao) botao.disabled = loading; });
    const botao = state.provisionamento.etapa === 4 ? elements.provisionConfirm : elements.provisionNext;
    if (!botao) return;
    botao.classList.toggle('is-loading', loading);
    botao.setAttribute('aria-busy', String(loading));
    const textoBotao = botao.querySelector('span');
    if (textoBotao) textoBotao.textContent = loading ? label : state.provisionamento.etapa === 4 ? 'Concluir cadastro' : 'Continuar';
  }

  async function avancarProvisionamento() {
    const etapa = state.provisionamento.etapa;
    if (!validarEtapaProvisionamento(etapa)) { setFeedback('Revise os campos destacados para continuar.'); return; }
    if (!api) { setFeedback('A autenticação está temporariamente indisponível.'); return; }
    const dados = dadosProvisionamento();
    setProvisionLoading(true, etapa <= 2 ? 'Salvando etapa...' : 'Carregando revisão...');
    try {
      if (etapa === 1) {
        if (!state.provisionamento.chaveIdempotencia) state.provisionamento.chaveIdempotencia = typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : `provisionamento-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const resposta = await api.requisitar('/operacional?modulo=provisionamento', { method: 'POST', body: { acao: 'iniciar', chaveIdempotencia: state.provisionamento.chaveIdempotencia, nome: dados.nome, tipoDocumento: dados.tipoDocumento, documento: dados.documento } });
        state.provisionamento.id = resposta.idProvisionamento;
        state.provisionamento.estabelecimento = resposta.estabelecimento;
      } else if (etapa === 2) {
        await api.requisitar('/operacional?modulo=provisionamento', { method: 'POST', body: { acao: 'salvar_diretor', idProvisionamento: state.provisionamento.id, nomeCompleto: dados.nomeCompleto, cpf: dados.cpf, telefoneWhatsapp: dados.telefoneWhatsapp, endereco: dados.endereco } });
      }
      renderProvisionamentoStep(etapa + 1);
    } catch (error) { setFeedback(mensagemErro(error, 'Não foi possível salvar esta etapa.')); }
    finally { setProvisionLoading(false); }
  }

  async function concluirProvisionamento() {
    if (!validarEtapaProvisionamento(4) || !state.provisionamento.id) { setFeedback('Revise os dados e confirme antes de concluir.'); return; }
    const dados = dadosProvisionamento();
    setProvisionLoading(true, 'Concluindo cadastro...');
    try {
      const resposta = await api.requisitar('/operacional?modulo=provisionamento', { method: 'POST', body: { acao: 'concluir', idProvisionamento: state.provisionamento.id, email: dados.email, senha: dados.senha, confirmarSenha: dados.confirmarSenha, diasTeste: dados.diasTeste } });
      if (elements.provisionSuccessMessage) elements.provisionSuccessMessage.textContent = `${resposta.nomeRestaurante || dados.nome} foi criado. O Diretor poderá entrar com ${resposta.emailDiretor || dados.email}.`;
      renderProvisionamentoStep(5);
      setFeedback('Estabelecimento e acesso do Diretor criados com sucesso.', 'success');
    } catch (error) { setFeedback(mensagemErro(error, 'Não foi possível concluir o cadastro do estabelecimento.')); }
    finally { setProvisionLoading(false); }
  }

  function cancelarProvisionamento() {
    limparProvisionamento();
    esconderEscolhaRestaurante();
    setFeedback('Cadastro cancelado. Nenhum estabelecimento foi criado.', 'success');
  }

  function mostrarOnboarding() {
    if (!elements.contextChoice || !elements.onboarding || !elements.provisionForm) {
      const erro = new Error('A tela de cadastro do estabelecimento não está disponível.');
      erro.code = 'RESTAURANTE_ONBOARDING_INDISPONIVEL';
      throw erro;
    }
    limparProvisionamento();
    if (elements.restaurantContext) elements.restaurantContext.hidden = true;
    if (elements.noRestaurant) elements.noRestaurant.hidden = true;
    elements.onboarding.hidden = false;
    elements.contextChoice.hidden = false;
    elements.formCard.hidden = true;
    renderProvisionamentoStep(1);
    setFeedback('Acesso de Desenvolvedor reconhecido. Cadastre um novo estabelecimento em etapas.', 'success');
    document.querySelector('#provision-nome')?.focus();
    renderIcons();
    return { acessoGlobal: 'desenvolvedor' };
  }

  function mostrarSemRestaurante() {
    if (elements.restaurantContext) elements.restaurantContext.hidden = true;
    if (elements.onboarding) elements.onboarding.hidden = true;
    if (elements.noRestaurant) elements.noRestaurant.hidden = false;
    if (elements.contextChoice) elements.contextChoice.hidden = false;
    if (elements.formCard) elements.formCard.hidden = true;
    setFeedback('Sua conta foi autenticada, mas ainda não está vinculada a um restaurante ativo.', 'error');
  }

  function mostrarEscolhaRestaurante(restaurantes) {
    if (!elements.contextChoice || !elements.restaurantSelect) {
      const erro = new Error('A tela de seleção de restaurante não está disponível.');
      erro.code = 'RESTAURANTE_SELECAO_INDISPONIVEL';
      throw erro;
    }
    state.restaurantes = restaurantes;
    const opcoes = restaurantes.map((restaurante) => {
      const opcao = document.createElement('option');
      const papeis = Array.isArray(restaurante.papeis) && restaurante.papeis.length
        ? ` — ${restaurante.papeis.join(', ')}`
        : '';
      opcao.value = restaurante.idRestaurante;
      opcao.textContent = `${restaurante.nome}${papeis}`;
      return opcao;
    });
    elements.restaurantSelect.replaceChildren(...opcoes);
    if (elements.restaurantContext) elements.restaurantContext.hidden = false;
    if (elements.noRestaurant) elements.noRestaurant.hidden = true;
    if (elements.contextSubmit) {
      elements.contextSubmit.hidden = false;
      elements.contextSubmit.disabled = false;
    }
    if (elements.onboarding) elements.onboarding.hidden = true;
    elements.contextChoice.hidden = false;
    elements.formCard.hidden = true;
    setFeedback('Selecione o restaurante que deseja operar nesta sessão.', 'success');
    renderIcons();
  }

  async function prepararRestauranteAtivo() {
    const resposta = await api.requisitar('/restaurantes');
    const restaurantes = Array.isArray(resposta.restaurantes)
      ? resposta.restaurantes.filter((restaurante) => typeof restaurante?.idRestaurante === 'string' && restaurante.idRestaurante)
      : [];
    if (!restaurantes.length) {
      let sessao = null;
      try { sessao = await api.obterSessao(); } catch {}
      if (sessao?.usuario?.acessoGlobal === 'desenvolvedor') return mostrarOnboarding();
      mostrarSemRestaurante();
      return null;
    }
    if (restaurantes.length === 1) {
      await api.requisitar('/restaurantes/trocar', {
        method: 'POST',
        body: { idRestaurante: restaurantes[0].idRestaurante },
      });
      return restaurantes[0];
    }
    mostrarEscolhaRestaurante(restaurantes);
    return new Promise((resolve) => {
      state.contextoResolve = resolve;
    });
  }

  async function handleContextSubmit() {
    const idRestaurante = elements.restaurantSelect?.value;
    const restaurante = state.restaurantes.find((item) => item.idRestaurante === idRestaurante);
    if (!restaurante) {
      setFeedback('Selecione um restaurante válido para continuar.');
      return;
    }
    if (elements.contextSubmit) elements.contextSubmit.disabled = true;
    try {
      await api.requisitar('/restaurantes/trocar', {
        method: 'POST',
        body: { idRestaurante },
      });
      const resolver = state.contextoResolve;
      state.contextoResolve = null;
      esconderEscolhaRestaurante();
      resolver?.(restaurante);
    } catch (error) {
      if (elements.contextSubmit) elements.contextSubmit.disabled = false;
      setFeedback(mensagemErro(error, 'Não foi possível selecionar o restaurante.'));
    }
  }

  function mensagemErro(error, fallback) {
    const mensagens = {
      CREDENCIAIS_INVALIDAS: 'Email ou senha inválidos.',
      EMAIL_INVALIDO: 'Use um email no formato nome@apexfood.com.',
      SENHA_INVALIDA: 'A senha deve atender à política configurada.',
      SENHA_FRACA: 'Use maiúscula, minúscula, número e caractere especial na senha.',
      MUITAS_TENTATIVAS: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      ORIGEM_NAO_PERMITIDA: 'A origem desta página não está autorizada.',
      CSRF_INVALIDO: 'A proteção de segurança expirou. Tente novamente.',
      AUTH_NAO_CONFIGURADO: 'A autenticação está temporariamente indisponível.',
      SERVICO_NAO_CONFIGURADO: 'O serviço está temporariamente indisponível.',
      SERVICO_NAO_PRONTO: 'O serviço está temporariamente indisponível.',
      INDICE_RESTAURANTES_NAO_PRONTO: 'A listagem de restaurantes está sendo preparada. Tente novamente em instantes.',
      RESTAURANTE_NAO_SELECIONADO: 'Sua conta foi autenticada, mas ainda não está vinculada a um restaurante ativo.',
      RESTAURANTE_ONBOARDING_INDISPONIVEL: 'Não foi possível abrir a criação do restaurante. Atualize a página e tente novamente.',
      RESTAURANTE_INVALIDO: 'O restaurante selecionado não está disponível para esta conta.',
      NOME_RESTAURANTE_INVALIDO: 'O nome comercial deve ter entre 2 e 120 caracteres.',
      RESTAURANTE_INCONSISTENTE: 'O cadastro inicial do restaurante precisa ser revisado. Atualize a página e tente novamente.',
      RESTAURANTE_SELECAO_INDISPONIVEL: 'Não foi possível abrir a seleção de restaurante. Atualize a página e tente novamente.',
      DESENVOLVEDOR_NAO_CONFIGURADO: 'O acesso de Desenvolvedor ainda não foi configurado.',
      ACESSO_GLOBAL_NEGADO: 'Acesso de Desenvolvedor não autorizado.',
      ACAO_INVALIDA: 'A operação solicitada não está disponível.',
      DOCUMENTO_INVALIDO: 'Informe um CPF ou CNPJ válido.',
      TIPO_DOCUMENTO_INVALIDO: 'Escolha CPF ou CNPJ.',
      DOCUMENTO_JA_CADASTRADO: 'O CPF/CNPJ informado já está cadastrado.',
      EMAIL_DIRETOR_EM_USO: 'O email do Diretor já está vinculado a uma conta.',
      PROVISIONAMENTO_INVALIDO: 'O cadastro temporário não é válido. Inicie novamente.',
      PROVISIONAMENTO_NAO_ENCONTRADO: 'O cadastro temporário não foi encontrado.',
      PROVISIONAMENTO_NAO_EDITAVEL: 'Este cadastro não pode mais ser alterado.',
      PROVISIONAMENTO_INCOMPLETO: 'Conclua todas as etapas antes de finalizar.',
      PROVISIONAMENTO_INCONSISTENTE: 'O cadastro temporário precisa ser revisado.',
      CHAVE_IDEMPOTENCIA_INVALIDA: 'A operação temporária não é válida. Inicie novamente.',
      CHAVE_IDEMPOTENCIA_REUTILIZADA: 'Esta operação já foi iniciada com outro documento. Inicie um novo cadastro.',
      RESTAURANTE_DUPLICADO: 'Não foi possível reservar o estabelecimento. Tente novamente.',
      TELEFONE_INVALIDO: 'Informe um telefone/WhatsApp válido.',
      CEP_INVALIDO: 'Informe um CEP válido.',
      ESTADO_INVALIDO: 'Informe a UF com duas letras.',
      NOME_COMPLETO_INVALIDO: 'Informe o nome completo do Diretor.',
      PERIODO_TESTE_INVALIDO: 'O período de teste selecionado não é válido.',
    };
    return mensagens[error?.code] || error?.message || fallback;
  }

  function solicitarNotificacaoDeLogin() {
    try {
      const resultado = window.apexNotificacoesSistema?.solicitarPermissao?.();
      if (resultado && typeof resultado.catch === 'function') resultado.catch(() => {});
    } catch {}
  }

  function finishRedirect(origem = '') {
    elements.redirectNote.hidden = false;
    window.clearTimeout(state.redirectTimer);
    state.redirectTimer = window.setTimeout(() => {
      window.location.href = origem ? `/?apex-notificacao=${encodeURIComponent(origem)}` : '/';
    }, 950);
  }

  async function handleLogin(form) {
    if (!validateLogin(form)) {
      setFeedback('Revise os campos destacados para continuar.');
      return;
    }
    if (!api) {
      setFeedback('A autenticação está temporariamente indisponível.');
      return;
    }

    solicitarNotificacaoDeLogin();
    setLoading(form, true);
    try {
      const email = getAccountAddress(form.querySelector('[name="identifier"]'));
      const senha = form.querySelector('[name="password"]').value;
      await api.requisitar('/auth/login', { method: 'POST', body: { email, senha } });
      const destino = await prepararRestauranteAtivo();
      if (destino?.acessoGlobal === 'desenvolvedor' || !destino) return;
      setFeedback('Acesso validado. Você será direcionado para a Visão Geral.', 'success');
      finishRedirect('login');
    } catch (error) {
      setFeedback(mensagemErro(error, 'Não foi possível concluir o acesso.'));
    } finally {
      setLoading(form, false);
    }
  }

  async function handleRegister(form) {
    if (!validateRegister(form)) {
      setFeedback('Revise os campos destacados para criar sua conta.');
      return;
    }
    if (!api) {
      setFeedback('A autenticação está temporariamente indisponível.');
      return;
    }

    setLoading(form, true);
    try {
      const name = form.querySelector('[name="fullName"]').value.trim();
      const identifierInput = form.querySelector('[name="identifier"]');
      const identifier = normalizeIdentifier(identifierInput.value);
      const email = `${identifier}${APEX_DOMAIN}`;
      const senha = form.querySelector('[name="password"]').value;
      const resposta = await api.requisitar('/auth/register', {
        method: 'POST',
        body: { nomeCompleto: name, email, senha, confirmarSenha: form.querySelector('[name="confirmPassword"]').value },
      });

      setLoading(form, false);
      setMode('login', false);
      const loginIdentifier = document.querySelector('#login-identifier');
      if (loginIdentifier) {
        loginIdentifier.value = identifier;
        updateIdentifierSuffix(loginIdentifier);
        setFieldState(loginIdentifier);
      }
      const verificacao = resposta.verificacaoEmailEnviada ? ' Verifique também sua caixa de entrada.' : '';
      setFeedback(`Conta criada para ${name.split(/\s+/)[0]}.${verificacao} Agora entre para acessar o APEX Food.`, 'success');
      window.setTimeout(() => document.querySelector('#login-password')?.focus(), 80);
    } catch (error) {
      setFeedback(mensagemErro(error, 'Não foi possível concluir o cadastro.'));
    } finally {
      setLoading(form, false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.authForm === 'register') handleRegister(form);
    else handleLogin(form);
  }

  function handlePasswordToggle(button) {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    button.setAttribute('aria-pressed', String(!isVisible));
    button.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
    button.innerHTML = `<i data-lucide="${isVisible ? 'eye' : 'eye-off'}" aria-hidden="true"></i>`;
    renderIcons();
  }

  async function handleForgotPassword() {
    const input = document.querySelector('#login-identifier');
    const error = validateIdentifier(input);
    setFieldState(input, error);
    if (error) {
      setFeedback('Informe seu email para receber as instruções de recuperação.');
      return;
    }
    if (!api) {
      setFeedback('A autenticação está temporariamente indisponível.');
      return;
    }

    try {
      const email = getAccountAddress(input);
      const resposta = await api.requisitar('/auth/recuperar', { method: 'POST', body: { email } });
      setFeedback(resposta.mensagem || 'Se o email estiver cadastrado, você receberá as instruções.', 'success');
    } catch (error) {
      setFeedback(mensagemErro(error, 'Não foi possível solicitar a recuperação agora.'));
    }
  }

  function handleProvisionInput(input) {
    if (!input?.id?.startsWith('provision-')) return false;
    let message = '';
    if (input.id === 'provision-email') {
      message = validateIdentifier(input);
      updateIdentifierSuffix(input);
    }
    if (input.id === 'provision-senha') message = validatePassword(input, true);
    if (input.id === 'provision-confirmar-senha') {
      const senha = campoProvision('provision-senha');
      message = input.value && input.value !== senha?.value ? 'As senhas não coincidem.' : '';
    }
    if (input.id === 'provision-estado') input.value = input.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();
    if (input.id === 'provision-tipo-documento') return false;
    setFieldState(input, message);
    if (input.id === 'provision-senha') {
      const confirmacao = campoProvision('provision-confirmar-senha');
      if (confirmacao?.value) setFieldState(confirmacao, confirmacao.value !== input.value ? 'As senhas não coincidem.' : '');
    }
    return true;
  }

  function handleInput(event) {
    const input = event.target;
    if (!input.matches('.auth-input')) return;
    if (handleProvisionInput(input)) return;

    const form = input.closest('form');
    const isRegister = form?.dataset.authForm === 'register';
    let message = '';
    if (input.name === 'identifier') {
      message = validateIdentifier(input);
      updateIdentifierSuffix(input);
    }
    if (input.name === 'password') message = validatePassword(input, isRegister);
    if (input.name === 'fullName') {
      const nameValue = input.value.trim();
      message = nameValue && nameValue.split(/\s+/).length < 2 ? 'Digite seu nome e sobrenome.' : '';
    }
    if (input.name === 'confirmPassword' && isRegister) {
      const password = form.querySelector('[name="password"]');
      message = input.value && input.value !== password.value ? 'As senhas não coincidem.' : '';
    }
    setFieldState(input, message);

    if (isRegister && input.name === 'password') {
      const confirm = form.querySelector('[name="confirmPassword"]');
      if (confirm?.value) setFieldState(confirm, confirm.value !== input.value ? 'As senhas não coincidem.' : '');
    }
  }

  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const next = event.key === 'ArrowRight' ? 'register' : 'login';
        setMode(next);
        document.querySelector(`[data-auth-tab="${next}"]`)?.focus();
      }
    });
  });

  elements.forms.forEach((form) => {
    form.addEventListener('submit', handleSubmit);
    form.addEventListener('input', handleInput);
  });
  elements.provisionForm?.addEventListener('input', handleInput);
  elements.provisionForm?.addEventListener('change', (event) => {
    if (event.target.id === 'provision-tipo-documento') {
      const documento = campoProvision('provision-documento');
      if (documento) documento.placeholder = event.target.value === 'cpf' ? 'Digite o CPF' : 'Digite o CNPJ';
    }
    if (state.provisionamento.etapa === 4) atualizarRevisao();
  });

  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => handlePasswordToggle(button));
  });

  document.querySelector('[data-action="forgot-password"]')?.addEventListener('click', handleForgotPassword);
  elements.contextSubmit?.addEventListener('click', handleContextSubmit);
  elements.provisionNext?.addEventListener('click', avancarProvisionamento);
  elements.provisionConfirm?.addEventListener('click', concluirProvisionamento);
  elements.provisionBack?.addEventListener('click', () => renderProvisionamentoStep(Math.max(1, state.provisionamento.etapa - 1)));
  elements.provisionCancel?.addEventListener('click', cancelarProvisionamento);
  elements.provisionNew?.addEventListener('click', mostrarOnboarding);
  document.querySelectorAll('.auth-identifier-input').forEach(updateIdentifierSuffix);
  renderIcons();

  if (api) {
    api.obterCsrf().catch(() => {});
    api.obterSessao().then((sessao) => {
      if (sessao?.usuario?.acessoGlobal === 'desenvolvedor' && !sessao?.restauranteAtivo?.idRestaurante) mostrarOnboarding();
    }).catch(() => {});
  }
})();
