(() => {
  'use strict';

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa22-dados-reais-global';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente dos módulos.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function adaptarFuncionario(funcionario) {
    return {
      ...funcionario,
      id: String(funcionario.id),
      telefone: funcionario.telefone || 'Contato restrito',
      email: funcionario.email || 'Contato restrito',
      vendasMes: Number(funcionario.vendasMesCentavos || 0) / 100,
      comissao: Number(funcionario.comissao || 0),
      avaliacao: Number(funcionario.avaliacao || 0),
      pedidos: Number(funcionario.pedidos || 0),
      papelOperacional: funcionario.papelOperacional || '',
      disponibilidadeAtendimento: funcionario.disponibilidadeAtendimento || 'disponivel',
      capacidadeMesas: Math.max(1, Number(funcionario.capacidadeMesas || 1)),
      capacidadeComandas: Math.max(1, Number(funcionario.capacidadeComandas || 1)),
      capacidadePedidos: Math.max(1, Number(funcionario.capacidadePedidos || 1)),
      especialidadesCozinha: Array.isArray(funcionario.especialidadesCozinha) ? funcionario.especialidadesCozinha : [],
      estacoesCozinha: Array.isArray(funcionario.estacoesCozinha) ? funcionario.estacoesCozinha : [],
      cargaAtual: {
        mesasAtivas: Math.max(0, Number(funcionario.cargaAtual?.mesasAtivas || 0)),
        comandasAtivas: Math.max(0, Number(funcionario.cargaAtual?.comandasAtivas || 0)),
        pedidosPendentes: Math.max(0, Number(funcionario.cargaAtual?.pedidosPendentes || 0)),
        tarefasAtivas: Math.max(0, Number(funcionario.cargaAtual?.tarefasAtivas || 0)),
      },
      ultimaAtribuicaoEm: funcionario.ultimaAtribuicaoEm || null,
      prioridadeDistribuicao: Math.max(0, Number(funcionario.prioridadeDistribuicao || 0)),
    };
  }

  function adaptarEscala(escala) {
    return { ...escala, id: String(escala.id), funcionarioId: String(escala.funcionarioId), data: String(escala.data || '') };
  }

  function adaptarComissao(comissao) {
    return {
      ...comissao,
      id: String(comissao.id),
      funcionarioId: String(comissao.funcionarioId),
      vendas: Number(comissao.vendasCentavos || 0) / 100,
      comissao: Number(comissao.comissaoCentavos || 0) / 100,
      percentual: Number(comissao.percentual || 0),
      pedidos: Number(comissao.pedidos || 0),
      variacao: Number(comissao.variacao || 0),
      posicao: Number(comissao.posicao || 0),
    };
  }

  function estadoVazio() { return { funcionarios: [], escalas: [], comissoes: [] }; }

  window.dadosEquipeApexFood = estadoVazio();
  window.dadosEquipeRemotoAtivo = false;
  let atualizacaoId = null;
  let falhasConsecutivas = 0;

  function limparAtualizacao() {
    if (atualizacaoId) window.clearTimeout(atualizacaoId);
    atualizacaoId = null;
  }

  function agendarAtualizacao(atraso = 60000) {
    if (document.hidden || atualizacaoId) return;
    const jitter = Math.floor(Math.random() * 1500);
    atualizacaoId = window.setTimeout(() => {
      atualizacaoId = null;
      window.recarregarEquipeReal?.({ automatica: true });
    }, Math.max(1000, atraso + jitter));
  }

  window.recarregarEquipeReal = (opcoes = {}) => {
    if (!opcoes.automatica) limparAtualizacao();
    return carregarCliente()
      .then((api) => api.listarEquipe())
      .then((dados) => {
        if (typeof dados?.meta?.idRestaurante !== 'string') {
          const erro = new Error('Restaurante ativo não encontrado.');
          erro.code = 'RESTAURANTE_NAO_SELECIONADO';
          throw erro;
        }
        window.dadosEquipeApexFood = {
          funcionarios: (dados.funcionarios || []).map(adaptarFuncionario),
          escalas: (dados.escalas || []).map(adaptarEscala),
          comissoes: (dados.comissoes || []).map(adaptarComissao),
        };
        window.dadosEquipeRemotoAtivo = true;
        falhasConsecutivas = 0;
        document.dispatchEvent(new CustomEvent('apex:equipe-atualizado'));
        agendarAtualizacao();
        return true;
      })
      .catch((erro) => {
        window.dadosEquipeErro = erro;
        window.dadosEquipeApexFood = estadoVazio();
        window.dadosEquipeRemotoAtivo = false;
        falhasConsecutivas += 1;
        document.dispatchEvent(new CustomEvent('apex:equipe-indisponivel'));
        agendarAtualizacao(Math.min(120000, 5000 * (2 ** Math.min(falhasConsecutivas - 1, 4))));
        return false;
      });
  };

  window.dadosEquipePronto = window.recarregarEquipeReal();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) limparAtualizacao();
    else window.recarregarEquipeReal?.({ automatica: true });
  });
  window.addEventListener('beforeunload', limparAtualizacao);
})();
