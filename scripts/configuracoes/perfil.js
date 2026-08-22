(() => {
  'use strict';

  const estado = { dados: null, carregando: false };
  const porId = id => document.getElementById(id);
  const papeis = {
    proprietario: 'Proprietário',
    administrador: 'Administrador',
    gerente: 'Gerente',
    garcom: 'Garçom',
    cozinha: 'Cozinha',
    analista: 'Analista',
    auditor: 'Auditor',
    caixa: 'Caixa',
  };

  function mensagem(texto, tipo = 'erro') {
    const elemento = porId('perfilMensagem');
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = `rounded-xl border p-3 text-sm ${tipo === 'sucesso' ? 'border-green/30 bg-green/10 text-green-200' : 'border-red/30 bg-red/10 text-red-200'}`;
    elemento.classList.remove('hidden');
  }

  function limparMensagem() {
    porId('perfilMensagem')?.classList.add('hidden');
  }

  function textoErro(erro, padrao = 'Não foi possível concluir a solicitação. Tente novamente em instantes.') {
    const conhecidos = {
      SENHA_ATUAL_INVALIDA: 'A senha atual não confere.',
      SENHAS_NAO_CONFEREM: 'A confirmação da nova senha não confere.',
      SENHA_FRACA: 'A nova senha deve conter letra maiúscula, letra minúscula, número e caractere especial.',
      NOME_INVALIDO: 'Informe um nome de exibição válido.',
      PAYLOAD_INVALIDO: 'Confira os dados informados e tente novamente.',
    };
    return conhecidos[erro?.code] || erro?.message || padrao;
  }

  function formatarData(valor) {
    if (!valor) return 'Não informado';
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
    } catch {
      return 'Não informado';
    }
  }

  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'A';
    return `${partes[0][0]}${partes.length > 1 ? partes[partes.length - 1][0] : ''}`.toUpperCase().slice(0, 2);
  }

  function atualizarInterface(dados) {
    const perfil = dados?.perfil || {};
    const preferencias = perfil.preferenciasNotificacao || {};
    const restaurante = dados?.restauranteAtivo;
    const nome = perfil.nomeExibicao || '';
    const email = perfil.emailCanonico || 'Email não informado';
    const papéis = Array.isArray(restaurante?.papeis) ? restaurante.papeis.map(papel => papeis[papel] || papel).join(', ') : '';

    porId('perfilNome').value = nome;
    porId('perfilEmail').value = email;
    porId('perfilAvatar').textContent = iniciais(nome);
    porId('perfilEstadoConta').textContent = perfil.estado === 'ativo' ? 'Conta ativa' : `Estado da conta: ${perfil.estado || 'não informado'}`;
    porId('perfilEmailEstado').textContent = perfil.emailVerificado ? 'Email verificado' : 'Email ainda não verificado';
    porId('perfilRestaurante').textContent = restaurante
      ? `Restaurante ativo · ${papéis || 'acesso operacional configurado'}`
      : 'Nenhum restaurante ativo vinculado a esta sessão.';
    porId('preferenciaOperacional').checked = preferencias.alertasOperacionais !== false;
    porId('preferenciaSistema').checked = preferencias.avisosSistema !== false;
    porId('sessaoAutenticadaEm').textContent = formatarData(dados?.sessao?.autenticadoEm);
    porId('sessaoExpiraEm').textContent = formatarData(dados?.sessao?.expiraEm);
  }

  function alternarBotao(botao, ocupado, textoOcupado) {
    if (!botao) return;
    if (!botao.dataset.textoOriginal) botao.dataset.textoOriginal = botao.querySelector('span')?.textContent || botao.textContent;
    botao.disabled = ocupado;
    botao.classList.toggle('opacity-60', ocupado);
    const texto = botao.querySelector('span');
    if (texto) texto.textContent = ocupado ? textoOcupado : botao.dataset.textoOriginal;
  }

  async function carregar() {
    const carregando = porId('perfilCarregando');
    const conteudo = porId('perfilConteudo');
    if (!window.apexModulosApi?.listarPerfil) {
      carregando.textContent = 'Não foi possível carregar os dados do perfil.';
      return;
    }
    try {
      estado.dados = await window.apexModulosApi.listarPerfil();
      atualizarInterface(estado.dados);
      carregando.classList.add('hidden');
      conteudo.classList.remove('hidden');
    } catch (erro) {
      carregando.textContent = textoErro(erro, 'Não foi possível consultar os dados do perfil.');
      mensagem(textoErro(erro, 'Não foi possível consultar os dados do perfil.'), 'erro');
    }
  }

  async function salvarPerfil(evento) {
    evento.preventDefault();
    limparMensagem();
    const campo = porId('perfilNome');
    const nome = campo.value.trim();
    if (nome.length < 2 || nome.length > 120) {
      mensagem('Informe um nome de exibição entre 2 e 120 caracteres.');
      campo.focus();
      return;
    }
    const botao = porId('salvarPerfil');
    alternarBotao(botao, true, 'Salvando...');
    try {
      estado.dados = await window.apexModulosApi.atualizarPerfil({ nomeExibicao: nome });
      atualizarInterface(estado.dados);
      mensagem('Dados do perfil atualizados com sucesso.', 'sucesso');
    } catch (erro) {
      mensagem(textoErro(erro, 'Não foi possível atualizar os dados do perfil.'));
    } finally {
      alternarBotao(botao, false, 'Salvando...');
    }
  }

  async function salvarPreferencias(evento) {
    evento.preventDefault();
    limparMensagem();
    const botao = porId('salvarPreferencias');
    alternarBotao(botao, true, 'Salvando...');
    try {
      estado.dados = await window.apexModulosApi.atualizarPreferenciasPerfil({
        alertasOperacionais: porId('preferenciaOperacional').checked,
        avisosSistema: porId('preferenciaSistema').checked,
      });
      atualizarInterface(estado.dados);
      mensagem('Preferências de notificações atualizadas com sucesso.', 'sucesso');
    } catch (erro) {
      mensagem(textoErro(erro, 'Não foi possível atualizar as preferências.'));
    } finally {
      alternarBotao(botao, false, 'Salvando...');
    }
  }

  async function salvarSenha(evento) {
    evento.preventDefault();
    limparMensagem();
    const senhaAtual = porId('senhaAtualPerfil').value;
    const novaSenha = porId('novaSenhaPerfil').value;
    const confirmarNovaSenha = porId('confirmarNovaSenhaPerfil').value;
    if (!senhaAtual) {
      mensagem('Informe a senha atual.');
      porId('senhaAtualPerfil').focus();
      return;
    }
    if (novaSenha.length < 8) {
      mensagem('A nova senha deve ter pelo menos 8 caracteres.');
      porId('novaSenhaPerfil').focus();
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      mensagem('A confirmação da nova senha não confere.');
      porId('confirmarNovaSenhaPerfil').focus();
      return;
    }
    const botao = porId('alterarSenhaPerfil');
    alternarBotao(botao, true, 'Atualizando...');
    try {
      await window.apexModulosApi.alterarSenhaPerfil({ senhaAtual, novaSenha, confirmarNovaSenha });
      porId('formSenha').reset();
      mensagem('Senha alterada com sucesso. A sessão atual foi mantida.', 'sucesso');
    } catch (erro) {
      mensagem(textoErro(erro, 'Não foi possível alterar a senha.'));
    } finally {
      alternarBotao(botao, false, 'Atualizando...');
    }
  }

  function inicializar() {
    if (estado.carregando) return;
    estado.carregando = true;
    porId('formPerfil')?.addEventListener('submit', salvarPerfil);
    porId('formPreferencias')?.addEventListener('submit', salvarPreferencias);
    porId('formSenha')?.addEventListener('submit', salvarSenha);
    window.dadosPerfilPronto = carregar();
    window.lucide?.createIcons();
  }

  inicializar();
})();
