(() => {
  'use strict';

  const page = document.querySelector('.auth-page');
  if (!page) return;

  const APEX_DOMAIN = '@apexfood.com';
  const api = window.apexAuthApi;

  const state = {
    mode: 'login',
    redirectTimer: null,
  };

  const elements = {
    tabs: Array.from(document.querySelectorAll('[data-auth-tab]')),
    forms: Array.from(document.querySelectorAll('[data-auth-form]')),
    formCard: document.querySelector('#auth-form-card'),
    feedback: document.querySelector('#auth-feedback'),
    title: document.querySelector('#auth-form-title'),
    description: document.querySelector('#auth-form-description'),
    redirectNote: document.querySelector('#auth-redirect-note'),
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
    };
    return mensagens[error?.code] || error?.message || fallback;
  }

  function finishRedirect() {
    elements.redirectNote.hidden = false;
    window.clearTimeout(state.redirectTimer);
    state.redirectTimer = window.setTimeout(() => {
      window.location.href = '../index.html';
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

    setLoading(form, true);
    try {
      const email = getAccountAddress(form.querySelector('[name="identifier"]'));
      const senha = form.querySelector('[name="password"]').value;
      await api.requisitar('/auth/login', { method: 'POST', body: { email, senha } });
      setFeedback('Acesso validado. Você será direcionado para a Visão Geral.', 'success');
      finishRedirect();
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

  function handleInput(event) {
    const input = event.target;
    if (!input.matches('.auth-input')) return;

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

  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => handlePasswordToggle(button));
  });

  document.querySelector('[data-action="forgot-password"]')?.addEventListener('click', handleForgotPassword);
  document.querySelectorAll('.auth-identifier-input').forEach(updateIdentifierSuffix);
  renderIcons();

  if (api) {
    api.obterCsrf().catch(() => {});
  }
})();
