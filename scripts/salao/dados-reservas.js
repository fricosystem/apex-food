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

  function dataVisual(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR');
  }

  function horaVisual(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function duracaoVisual(inicio, fim) {
    const inicioMs = new Date(inicio).getTime();
    const fimMs = new Date(fim).getTime();
    if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs)) return '';
    const minutos = Math.max(0, Math.round((fimMs - inicioMs) / 60000));
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}h ${String(minutos % 60).padStart(2, '0')}min`;
  }

  window.dadosReservasApexFood = [];
  window.dadosReservasRemotoAtivo = false;
  window.recarregarReservasReais = () => carregarCliente()
    .then((api) => api.listarSalao('reservas'))
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      window.dadosReservasApexFood = (dados.reservas || []).map((reserva) => ({
        ...reserva,
        id: String(reserva.id),
        cliente: reserva.nomeCliente || reserva.cliente || '',
        telefone: reserva.contatoClienteMascarado || reserva.telefone || '',
        mesaId: reserva.idMesa || null,
        mesa: reserva.mesa || (reserva.idMesa ? `Mesa ${reserva.idMesa}` : 'A definir'),
        pessoas: Number(reserva.quantidadePessoas || reserva.pessoas || 0),
        data: dataVisual(reserva.inicioEm),
        horario: horaVisual(reserva.inicioEm),
        duracao: duracaoVisual(reserva.inicioEm, reserva.fimEm),
        status: reserva.estado || reserva.status || 'aguardando',
        canal: reserva.canal || 'Interno',
        criadoEm: dataVisual(reserva.criadoEm),
      }));
      window.dadosReservasRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:reservas-atualizado'));
      return true;
    })
    .catch((erro) => {
      window.dadosReservasErro = erro;
      window.dadosReservasApexFood = [];
      document.dispatchEvent(new CustomEvent('apex:reservas-indisponiveis'));
      return false;
    });
  window.dadosReservasPronto = window.recarregarReservasReais();
})();
