(() => {
  'use strict';

  const estado = {
    aberto: false,
    aba: 'atualizacoes',
    carregando: false,
    carregandoDispositivos: false,
    notificacoes: [],
    dispositivos: [],
    naoLidas: 0,
    erro: '',
    erroDispositivos: '',
    mensagemDispositivos: '',
    timer: null,
    inicializado: false,
  };

  const escapar = valor => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const tempo = valor => {
    if (!valor) return 'Agora';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return 'Agora';
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const urlRecurso = notificacao => {
    if (notificacao.idPedido) return '/pedidos-ativos';
    if (notificacao.idEncaminhamento || notificacao.idComanda) return '/fechamento-caixa';
    if (notificacao.idMesa) return '/mapa-mesas';
    return '';
  };

  function obterPainel() {
    let painel = document.getElementById('painelNotificacoesApex');
    if (painel) return painel;
    painel = document.createElement('section');
    painel.id = 'painelNotificacoesApex';
    painel.className = 'hidden fixed right-3 top-[4.5rem] sm:right-6 sm:top-[5.25rem] z-[70] w-[min(92vw,30rem)] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl';
    painel.setAttribute('aria-label', 'Central de notificações');
    painel.setAttribute('aria-live', 'polite');
    painel.innerHTML = '<div id="cabecalhoNotificacoesApex" class="border-b border-border px-4 py-3"><div class="flex items-center justify-between gap-3"><div><h2 class="text-sm font-semibold">Notificações</h2><p id="resumoNotificacoesApex" class="mt-1 text-[11px] text-muted">Acompanhamento operacional</p></div><div class="flex items-center gap-1"><button type="button" id="atualizarNotificacoesApex" class="rounded-lg p-2 text-muted transition hover:bg-card2 hover:text-white" aria-label="Atualizar notificações"><i data-lucide="refresh-cw" class="h-4 w-4"></i></button><button type="button" id="fecharNotificacoesApex" class="rounded-lg p-2 text-muted transition hover:bg-card2 hover:text-white" aria-label="Fechar notificações"><i data-lucide="x" class="h-4 w-4"></i></button></div></div><div class="mt-3 flex items-center gap-1 rounded-lg bg-card2 p-1" role="tablist" aria-label="Seções da central"><button type="button" data-aba-notificacoes="atualizacoes" role="tab" class="flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition">Atualizações</button><button type="button" data-aba-notificacoes="dispositivos" role="tab" class="flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition">Dispositivos</button></div></div><div id="listaNotificacoesApex" class="max-h-[min(70vh,32rem)] overflow-y-auto"></div><div id="listaDispositivosApex" class="hidden max-h-[min(70vh,32rem)] overflow-y-auto"></div>';
    document.body.appendChild(painel);
    painel.querySelector('#fecharNotificacoesApex').addEventListener('click', () => alternar(false));
    painel.querySelector('#atualizarNotificacoesApex').addEventListener('click', () => {
      carregar(true);
      carregarDispositivos(true);
    });
    painel.querySelectorAll('[data-aba-notificacoes]').forEach(botao => botao.addEventListener('click', () => {
      estado.aba = botao.dataset.abaNotificacoes === 'dispositivos' ? 'dispositivos' : 'atualizacoes';
      renderizar();
      if (estado.aba === 'dispositivos') carregarDispositivos(true);
    }));
    return painel;
  }

  function obterBotoes() {
    return [...document.querySelectorAll('button[aria-label="Notificações"]')];
  }

  function atualizarBadge() {
    obterBotoes().forEach(botao => {
      let badge = botao.querySelector('[data-badge-notificacoes]');
      if (!badge) {
        botao.classList.add('relative');
        badge = document.createElement('span');
        badge.dataset.badgeNotificacoes = 'true';
        badge.className = 'hidden absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-4 text-white';
        botao.appendChild(badge);
      }
      const quantidade = Number(estado.naoLidas || 0);
      badge.textContent = quantidade > 99 ? '99+' : String(quantidade);
      badge.classList.toggle('hidden', quantidade < 1);
      botao.setAttribute('aria-label', quantidade ? `Notificações — ${quantidade} não lidas` : 'Notificações');
    });
  }

  function renderizarAbas() {
    const painel = obterPainel();
    painel.querySelectorAll('[data-aba-notificacoes]').forEach(botao => {
      const ativo = botao.dataset.abaNotificacoes === estado.aba;
      botao.classList.toggle('bg-panel', ativo);
      botao.classList.toggle('text-white', ativo);
      botao.classList.toggle('text-muted', !ativo);
      botao.setAttribute('aria-selected', String(ativo));
    });
    painel.querySelector('#listaNotificacoesApex').classList.toggle('hidden', estado.aba !== 'atualizacoes');
    painel.querySelector('#listaDispositivosApex').classList.toggle('hidden', estado.aba !== 'dispositivos');
  }

  function renderizarAtualizacoes() {
    const painel = obterPainel();
    const lista = painel.querySelector('#listaNotificacoesApex');
    const resumo = painel.querySelector('#resumoNotificacoesApex');
    resumo.textContent = estado.erro || (estado.naoLidas ? `${estado.naoLidas} não lida(s)` : 'Nenhuma pendência nova');
    if (estado.carregando) {
      lista.innerHTML = '<div class="px-4 py-8 text-center text-xs text-muted"><i data-lucide="loader-circle" class="mx-auto mb-2 h-5 w-5 animate-spin"></i>Consultando atualizações...</div>';
      window.lucide?.createIcons();
      return;
    }
    if (estado.erro) {
      lista.innerHTML = `<div class="px-4 py-8 text-center"><i data-lucide="triangle-alert" class="mx-auto mb-2 h-5 w-5 text-yellow"></i><p class="text-xs font-medium text-white">${escapar(estado.erro)}</p><button type="button" data-tentar-notificacoes class="mt-3 rounded-lg border border-border2 bg-card2 px-3 py-2 text-xs font-medium text-white">Tentar novamente</button></div>`;
      lista.querySelector('[data-tentar-notificacoes]')?.addEventListener('click', () => carregar(true));
      window.lucide?.createIcons();
      return;
    }
    if (!estado.notificacoes.length) {
      lista.innerHTML = '<div class="px-4 py-10 text-center"><i data-lucide="bell-off" class="mx-auto mb-2 h-5 w-5 text-muted"></i><p class="text-xs font-medium">Nenhuma notificação encontrada</p><p class="mt-1 text-[11px] text-muted">As atualizações operacionais aparecerão aqui.</p></div>';
      window.lucide?.createIcons();
      return;
    }
    lista.innerHTML = estado.notificacoes.map(item => {
      const prioridade = item.prioridade === 'alta' || item.prioridade === 'critica';
      const destino = urlRecurso(item);
      return `<article class="border-b border-border2 px-4 py-3 ${item.statusNotificacao === 'nova' ? 'bg-accent/5' : ''}"><div class="flex items-start gap-3"><span class="mt-1 h-2 w-2 flex-none rounded-full ${prioridade ? 'bg-accent' : 'bg-muted'}"></span><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><h3 class="text-xs font-semibold text-white">${escapar(item.titulo)}</h3><time class="whitespace-nowrap text-[10px] text-muted">${escapar(tempo(item.criadaEm))}</time></div><p class="mt-1 text-xs leading-5 text-muted">${escapar(item.mensagem)}</p><div class="mt-2 flex flex-wrap items-center gap-2"><span class="rounded-md border border-border2 bg-card2 px-2 py-1 text-[10px] text-muted">${escapar(item.statusNotificacao === 'nova' ? 'Nova' : item.statusNotificacao === 'lida' ? 'Lida' : 'Arquivada')}</span>${destino ? `<button type="button" class="text-[10px] font-medium text-accent hover:text-accentHover" data-abrir-notificacao="${escapar(item.id)}">Abrir recurso</button>` : ''}${item.statusNotificacao === 'nova' ? `<button type="button" class="text-[10px] font-medium text-muted hover:text-white" data-lida-notificacao="${escapar(item.id)}">Marcar como lida</button>` : ''}</div></div></div></article>`;
    }).join('');
    lista.querySelectorAll('[data-lida-notificacao]').forEach(botao => botao.addEventListener('click', () => marcarComoLida(botao.dataset.lidaNotificacao)));
    lista.querySelectorAll('[data-abrir-notificacao]').forEach(botao => botao.addEventListener('click', () => abrirRecurso(botao.dataset.abrirNotificacao)));
    window.lucide?.createIcons();
  }

  function nomePlataforma(valor) {
    return ({ android: 'Android', desktop: 'Desktop', tablet: 'Tablet', web: 'Navegador' }[valor] || 'Dispositivo');
  }

  function nomeOrigem(valor) {
    return valor === 'pwa' ? 'Aplicativo instalado' : 'Navegador';
  }

  function diagnosticoEntrega(dispositivo) {
    const nomes = {
      sem_teste: 'Ainda não testado',
      enviado: 'Último teste aceito',
      falhou: 'Último teste não aceito',
      revogado: 'Token revogado',
      indisponivel: 'Serviço indisponível',
    };
    const estado = nomes[dispositivo.ultimoResultadoEntrega] ? dispositivo.ultimoResultadoEntrega : 'sem_teste';
    const falhas = Number(dispositivo.falhasConsecutivas || 0);
    const complemento = falhas > 0 ? ` · ${falhas} falha(s) consecutiva(s)` : '';
    return `${nomes[estado]}${complemento}`;
  }

  function corDiagnostico(dispositivo) {
    if (dispositivo.ultimoResultadoEntrega === 'enviado') return 'text-emerald-300';
    if (['falhou', 'revogado', 'indisponivel'].includes(dispositivo.ultimoResultadoEntrega)) return 'text-yellow-300';
    return 'text-muted';
  }

  function renderizarDispositivos() {
    const painel = obterPainel();
    const lista = painel.querySelector('#listaDispositivosApex');
    if (estado.carregandoDispositivos) {
      lista.innerHTML = '<div class="px-4 py-8 text-center text-xs text-muted"><i data-lucide="loader-circle" class="mx-auto mb-2 h-5 w-5 animate-spin"></i>Consultando dispositivos...</div>';
      window.lucide?.createIcons();
      return;
    }
    if (estado.erroDispositivos) {
      lista.innerHTML = `<div class="px-4 py-8 text-center"><i data-lucide="triangle-alert" class="mx-auto mb-2 h-5 w-5 text-yellow"></i><p class="text-xs font-medium text-white">${escapar(estado.erroDispositivos)}</p><button type="button" data-tentar-dispositivos class="mt-3 rounded-lg border border-border2 bg-card2 px-3 py-2 text-xs font-medium text-white">Tentar novamente</button></div>`;
      lista.querySelector('[data-tentar-dispositivos]')?.addEventListener('click', () => carregarDispositivos(true));
      window.lucide?.createIcons();
      return;
    }
    if (!estado.dispositivos.length) {
      lista.innerHTML = '<div class="px-4 py-10 text-center"><i data-lucide="smartphone-off" class="mx-auto mb-2 h-5 w-5 text-muted"></i><p class="text-xs font-medium text-white">Nenhum dispositivo registrado</p><p class="mt-1 text-[11px] leading-5 text-muted">Permita notificações no dispositivo atual para registrá-lo nesta conta.</p></div>';
      window.lucide?.createIcons();
      return;
    }
    const aviso = estado.mensagemDispositivos ? `<div class="border-b border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-[11px] text-emerald-200">${escapar(estado.mensagemDispositivos)}</div>` : '';
    lista.innerHTML = `${aviso}<div class="border-b border-border2 px-4 py-3"><p class="text-[11px] leading-5 text-muted">Gerencie as instalações que podem receber avisos do APEX Food. Tokens e dados técnicos permanecem protegidos.</p></div>${estado.dispositivos.map(dispositivo => {
      const ativo = dispositivo.statusDispositivo === 'ativo';
      const preferencias = dispositivo.preferencias || {};
      const diagnostico = diagnosticoEntrega(dispositivo);
      return `<article class="border-b border-border2 px-4 py-3"><div class="flex items-start gap-3"><div class="mt-0.5 rounded-lg bg-card2 p-2 text-accent"><i data-lucide="${dispositivo.plataforma === 'desktop' ? 'monitor' : 'smartphone'}" class="h-4 w-4"></i></div><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><div><h3 class="text-xs font-semibold text-white">${escapar(nomePlataforma(dispositivo.plataforma))}</h3><p class="mt-1 text-[10px] text-muted">${escapar(nomeOrigem(dispositivo.origem))} · Último uso ${escapar(tempo(dispositivo.ultimoUsoEm))}</p><p class="mt-1 text-[10px] ${corDiagnostico(dispositivo)}">${escapar(diagnostico)}${dispositivo.ultimaEntregaEm ? ` · ${escapar(tempo(dispositivo.ultimaEntregaEm))}` : ''}</p></div><span class="rounded-md border ${ativo ? 'border-emerald-400/30 text-emerald-300' : 'border-border2 text-muted'} px-2 py-1 text-[10px]">${ativo ? 'Ativo' : 'Revogado'}</span></div><div class="mt-3 grid gap-2"><label class="flex items-center justify-between gap-3 text-[11px] text-muted"><span>Alertas operacionais</span><input type="checkbox" class="accent-accent" data-preferencia-dispositivo="operacionais" data-id-dispositivo="${escapar(dispositivo.id)}" ${preferencias.operacionais !== false && ativo ? 'checked' : ''} ${ativo ? '' : 'disabled'}></label><label class="flex items-center justify-between gap-3 text-[11px] text-muted"><span>Avisos do sistema</span><input type="checkbox" class="accent-accent" data-preferencia-dispositivo="sistema" data-id-dispositivo="${escapar(dispositivo.id)}" ${preferencias.sistema !== false && ativo ? 'checked' : ''} ${ativo ? '' : 'disabled'}></label></div><div class="mt-3 flex flex-wrap items-center gap-3"><button type="button" class="text-[10px] font-medium ${ativo ? 'text-accent hover:text-accentHover' : 'text-muted'}" data-teste-dispositivo="${escapar(dispositivo.id)}" ${ativo ? '' : 'disabled'}>Enviar teste</button><button type="button" class="text-[10px] font-medium ${ativo ? 'text-muted hover:text-red-300' : 'text-accent hover:text-accentHover'}" data-acao-dispositivo="${ativo ? 'revogar' : 'reativar'}" data-id-dispositivo="${escapar(dispositivo.id)}">${ativo ? 'Revogar este dispositivo' : 'Reativar este dispositivo'}</button></div></div></div></article>`;
    }).join('')}`;
    lista.querySelectorAll('[data-acao-dispositivo]').forEach(botao => botao.addEventListener('click', () => atualizarDispositivo(botao.dataset.idDispositivo, botao.dataset.acaoDispositivo)));
    lista.querySelectorAll('[data-teste-dispositivo]').forEach(botao => botao.addEventListener('click', () => testarDispositivo(botao.dataset.testeDispositivo)));
    lista.querySelectorAll('[data-preferencia-dispositivo]').forEach(input => input.addEventListener('change', () => atualizarPreferencia(input)));
    window.lucide?.createIcons();
  }

  function renderizar() {
    const painel = obterPainel();
    renderizarAbas();
    if (estado.aba === 'dispositivos') renderizarDispositivos();
    else renderizarAtualizacoes();
    painel.querySelector('#listaNotificacoesApex').classList.toggle('hidden', estado.aba !== 'atualizacoes');
    painel.querySelector('#listaDispositivosApex').classList.toggle('hidden', estado.aba !== 'dispositivos');
  }

  async function carregarNotificacoes(forcar = false) {
    if (document.body.classList.contains('apex-publico-mesa') || !window.apexModulosApi?.listarNotificacoes) return;
    if (estado.carregando) return;
    if (!forcar && !estado.aberto && document.hidden) return;
    estado.carregando = true;
    estado.erro = '';
    renderizar();
    try {
      const resposta = await window.apexModulosApi.listarNotificacoes({ limite: 40 });
      estado.notificacoes = Array.isArray(resposta.notificacoes) ? resposta.notificacoes : [];
      estado.naoLidas = Number(resposta.naoLidas || 0);
    } catch (erro) {
      if (erro?.status === 401 || erro?.code === 'NAO_AUTENTICADO') {
        estado.notificacoes = [];
        estado.naoLidas = 0;
        estado.erro = '';
      } else {
        estado.erro = erro?.message || 'Não foi possível atualizar as notificações.';
      }
    } finally {
      estado.carregando = false;
      atualizarBadge();
      if (estado.aberto) renderizar();
      agendar();
    }
  }

  async function carregarDispositivos(forcar = false) {
    if (document.body.classList.contains('apex-publico-mesa') || !window.apexModulosApi?.listarDispositivosNotificacao) return;
    if (estado.carregandoDispositivos) return;
    if (!forcar && !estado.aberto) return;
    estado.carregandoDispositivos = true;
    estado.erroDispositivos = '';
    renderizar();
    try {
      const resposta = await window.apexModulosApi.listarDispositivosNotificacao({ limite: 20 });
      estado.dispositivos = Array.isArray(resposta.dispositivos) ? resposta.dispositivos : [];
    } catch (erro) {
      if (erro?.status === 401 || erro?.code === 'NAO_AUTENTICADO') {
        estado.dispositivos = [];
        estado.erroDispositivos = '';
      } else {
        estado.erroDispositivos = erro?.message || 'Não foi possível atualizar os dispositivos.';
      }
    } finally {
      estado.carregandoDispositivos = false;
      if (estado.aberto) renderizar();
    }
  }

  async function marcarComoLida(id) {
    const chave = `notificacao-lida:${id}:${Date.now()}`;
    try {
      await window.apexModulosApi.atualizarNotificacao({ id, acao: 'marcar_lida', chaveIdempotencia: chave });
      await carregarNotificacoes(true);
    } catch (erro) {
      estado.erro = erro?.message || 'Não foi possível atualizar a notificação.';
      renderizar();
    }
  }

  async function testarDispositivo(id) {
    estado.mensagemDispositivos = '';
    try {
      const resposta = await window.apexModulosApi.testarDispositivoNotificacao(id);
      estado.mensagemDispositivos = resposta.enviados ? 'Teste enviado para este dispositivo.' : 'O dispositivo foi consultado, mas não confirmou a entrega.';
      estado.erroDispositivos = '';
      renderizar();
    } catch (erro) {
      estado.erroDispositivos = erro?.message || 'Não foi possível enviar o teste.';
      renderizar();
    }
  }

  async function atualizarDispositivo(id, acao) {
    estado.mensagemDispositivos = '';
    try {
      await window.apexModulosApi.atualizarDispositivoNotificacao({ id, acao });
      await carregarDispositivos(true);
    } catch (erro) {
      estado.erroDispositivos = erro?.message || 'Não foi possível atualizar o dispositivo.';
      renderizar();
    }
  }

  async function atualizarPreferencia(input) {
    estado.mensagemDispositivos = '';
    const dispositivo = estado.dispositivos.find(item => item.id === input.dataset.idDispositivo);
    if (!dispositivo) return;
    const preferencias = { ...(dispositivo.preferencias || {}), [input.dataset.preferenciaDispositivo]: input.checked };
    input.disabled = true;
    try {
      await window.apexModulosApi.atualizarDispositivoNotificacao({ id: dispositivo.id, acao: 'preferencias', preferencias });
      dispositivo.preferencias = preferencias;
    } catch (erro) {
      input.checked = !input.checked;
      estado.erroDispositivos = erro?.message || 'Não foi possível atualizar a preferência.';
      renderizar();
    } finally {
      input.disabled = false;
    }
  }

  function abrirRecurso(id) {
    const item = estado.notificacoes.find(notificacao => notificacao.id === id);
    if (!item) return;
    if (item.statusNotificacao === 'nova') marcarComoLida(id);
    const destino = urlRecurso(item);
    if (destino && window.apexShell?.navegar) {
      alternar(false);
      window.apexShell.navegar(destino);
    }
  }

  function alternar(aberto = !estado.aberto) {
    estado.aberto = Boolean(aberto);
    const painel = obterPainel();
    painel.classList.toggle('hidden', !estado.aberto);
    obterBotoes().forEach(botao => botao.setAttribute('aria-expanded', String(estado.aberto)));
    if (estado.aberto) {
      carregarNotificacoes(true);
      carregarDispositivos(true);
      renderizar();
    }
  }

  function carregar(forcar = false) {
    return carregarNotificacoes(forcar);
  }

  function agendar() {
    window.clearTimeout(estado.timer);
    estado.timer = window.setTimeout(() => {
      if (!document.hidden && !document.body.classList.contains('apex-publico-mesa')) carregar(false);
      else agendar();
    }, 30000);
  }

  function inicializar() {
    if (estado.inicializado) return;
    estado.inicializado = true;
    obterBotoes().forEach(botao => botao.addEventListener('click', () => alternar()));
    document.addEventListener('click', evento => {
      if (!estado.aberto) return;
      const painel = obterPainel();
      if (!painel.contains(evento.target) && !obterBotoes().some(botao => botao.contains(evento.target))) alternar(false);
    });
    document.addEventListener('keydown', evento => { if (evento.key === 'Escape') alternar(false); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(true); });
    atualizarBadge();
    renderizar();
    carregar(true);
  }

  window.setTimeout(inicializar, 0);
})();
