const dadosReservasPreview = [
  { id: 'RES-081', cliente: 'Beatriz Ramos', telefone: '(11) 96666-3404', mesaId: 4, mesa: 'Mesa 04', pessoas: 2, data: '18/08/2026', horario: '19:30', duracao: '02h', status: 'confirmada', canal: 'Aplicativo', criadoEm: '16/08/2026', observacoes: 'Mesa tranquila para jantar. Cliente confirmou por mensagem.' },
  { id: 'RES-082', cliente: 'Lucas Martins', telefone: '(11) 92222-1010', mesaId: 10, mesa: 'Mesa 10', pessoas: 2, data: '18/08/2026', horario: '20:00', duracao: '01h 30min', status: 'confirmada', canal: 'Telefone', criadoEm: '17/08/2026', observacoes: 'Primeira visita ao restaurante.' },
  { id: 'RES-083', cliente: 'Grupo Oliveira', telefone: '(11) 97777-1717', mesaId: 17, mesa: 'Mesa 17', pessoas: 8, data: '18/08/2026', horario: '21:00', duracao: '02h 30min', status: 'confirmada', canal: 'WhatsApp', criadoEm: '12/08/2026', observacoes: 'Preparar duas mesas infantis ao lado.' },
  { id: 'RES-084', cliente: 'Roberto Lima', telefone: '(11) 95555-5606', mesaId: 6, mesa: 'Mesa 06', pessoas: 2, data: '18/08/2026', horario: '11:00', duracao: '01h 30min', status: 'chegou', canal: 'Aplicativo', criadoEm: '17/08/2026', observacoes: 'Cliente aguardando sobremesa.' },
  { id: 'RES-085', cliente: 'Camila Rocha', telefone: '(11) 98888-1616', mesaId: 16, mesa: 'Mesa 16', pessoas: 3, data: '18/08/2026', horario: '15:45', duracao: '01h 30min', status: 'chegou', canal: 'Telefone', criadoEm: '18/08/2026', observacoes: 'Solicitou opção sem lactose.' },
  { id: 'RES-086', cliente: 'Mariana Alves', telefone: '(11) 94444-8606', mesaId: null, mesa: 'A definir', pessoas: 4, data: '18/08/2026', horario: '20:30', duracao: '02h', status: 'aguardando', canal: 'Site', criadoEm: '18/08/2026', observacoes: 'Aguardar confirmação da mesa ideal.' },
  { id: 'RES-087', cliente: 'Felipe Duarte', telefone: '(11) 93333-8707', mesaId: null, mesa: 'A definir', pessoas: 6, data: '19/08/2026', horario: '19:00', duracao: '02h', status: 'aguardando', canal: 'WhatsApp', criadoEm: '18/08/2026', observacoes: 'Aniversário. Cliente perguntou sobre bolo externo.' },
  { id: 'RES-088', cliente: 'Cláudia Mendes', telefone: '(11) 92222-8808', mesaId: 3, mesa: 'Mesa 03', pessoas: 5, data: '17/08/2026', horario: '20:00', duracao: '02h', status: 'cancelada', canal: 'Telefone', criadoEm: '14/08/2026', observacoes: 'Cancelada pelo cliente no dia anterior.' },
  { id: 'RES-089', cliente: 'Paulo Mendes', telefone: '(11) 90000-1414', mesaId: 14, mesa: 'Mesa 14', pessoas: 6, data: '18/08/2026', horario: '15:00', duracao: '02h', status: 'chegou', canal: 'Aplicativo', criadoEm: '16/08/2026', observacoes: 'Aguardar pedido de bebidas adicionais.' },
  { id: 'RES-090', cliente: 'Fernanda Souza', telefone: '(11) 94444-7707', mesaId: 7, mesa: 'Mesa 07', pessoas: 7, data: '18/08/2026', horario: '12:00', duracao: '02h 30min', status: 'chegou', canal: 'WhatsApp', criadoEm: '15/08/2026', observacoes: 'Grupo corporativo. Conta separada por pessoa.' }
];

const ambienteReservasLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const estadoReservasVazio = [];
window.dadosReservasApexFood = ambienteReservasLocal ? dadosReservasPreview : estadoReservasVazio;

(() => {
  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=fase7';
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
    const minutos = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}h ${String(minutos % 60).padStart(2, '0')}min`;
  }
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
    .catch((erro) => { window.dadosReservasErro = erro; if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) { window.dadosReservasApexFood = []; document.dispatchEvent(new CustomEvent('apex:reservas-indisponiveis')); } return false; });
  window.dadosReservasPronto = window.recarregarReservasReais();
})();
