(() => {
  'use strict';

  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa21-salao-tempo-real';
      script.dataset.apexModuloClient = 'true';
      script.onload = () => resolve(window.apexModulosApi);
      script.onerror = () => reject(new Error('Não foi possível carregar o cliente dos módulos.'));
      document.body.appendChild(script);
    });
    return window.apexModulosClientPromise;
  }

  function adaptarMesa(mesa) {
    return {
      ...mesa,
      id: String(mesa.id),
      nome: mesa.nome || `Mesa ${mesa.id}`,
      capacidade: Number(mesa.capacidade || 0),
      status: mesa.estado || mesa.status || 'disponivel',
      estadoAtendimento: mesa.estadoAtendimento || null,
      qrAtivo: mesa.qrAtivo === true,
      qrVersao: mesa.qrVersao || null,
      qrGeradoEm: mesa.qrGeradoEm || null,
      qrRevogadoEm: mesa.qrRevogadoEm || null,
      reservaStatus: mesa.reservaStatus || (mesa.reservadoPor ? 'confirmada' : 'sem-reserva'),
      reservadoPor: mesa.reservadoPor || mesa.nomeCliente || '',
      telefone: mesa.telefone || mesa.contatoClienteMascarado || '',
      valorGasto: mesa.valorGastoCentavos === undefined ? Number(mesa.valorGasto || 0) : Number(mesa.valorGastoCentavos) / 100,
      pessoas: Number(mesa.pessoas || 0),
      itens: Array.isArray(mesa.itens) ? mesa.itens : [],
    };
  }

  window.dadosMesas = [];
  window.dadosMesasRemotoAtivo = false;
  window.recarregarMesasReais = () => carregarCliente()
    .then((api) => api.listarSalao())
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      const reservas = Array.isArray(dados.reservas) ? dados.reservas : [];
      const reservasAtivas = reservas.filter(reserva => !['cancelada', 'concluida'].includes(String(reserva.estado || reserva.status || '')));
      window.dadosMesas = (dados.mesas || []).map(adaptarMesa).map(mesa => {
        const reservasMesa = reservasAtivas.filter(reserva => String(reserva.idMesa || '') === mesa.id);
        const reserva = reservasMesa.sort((a, b) => new Date(a.inicioEm || 0).getTime() - new Date(b.inicioEm || 0).getTime())[0];
        if (!reserva) return { ...mesa, reservaStatus: mesa.status === 'indisponivel' ? 'bloqueada' : 'sem-reserva' };
        return {
          ...mesa,
          reservaStatus: reserva.estado || reserva.status || 'aguardando',
          reservadoPor: reserva.nomeCliente || reserva.cliente || mesa.reservadoPor || '',
          telefone: reserva.contatoClienteMascarado || reserva.telefone || mesa.telefone || '',
          horarioReserva: reserva.inicioEm || mesa.horarioReserva || '',
          reservaInicioEm: reserva.inicioEm || null,
          reservaFimEm: reserva.fimEm || null,
          reservaId: String(reserva.id || ''),
          reservaQuantidadePessoas: Number(reserva.quantidadePessoas || 0),
          reservaObservacoes: reserva.observacoes || '',
        };
      });
      window.dadosMesasRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:mesas-atualizado'));
      return true;
    })
    .catch((erro) => {
      window.dadosMesasErro = erro;
      window.dadosMesas = [];
      document.dispatchEvent(new CustomEvent('apex:mesas-indisponiveis'));
      return false;
    });
  window.dadosMesasPronto = window.recarregarMesasReais();
})();
