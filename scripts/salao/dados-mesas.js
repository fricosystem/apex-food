const dadosMesasPreview = [
  {
    id: 1,
    nome: 'Mesa 01',
    capacidade: 4,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Carlos Silva',
    telefone: '(11) 98888-1201',
    horarioReserva: '12:30',
    chegada: '13:45',
    duracao: '01h 48min',
    pessoas: 3,
    garcom: 'João Mendes',
    comanda: '#CMD-4521',
    valorGasto: 156.80,
    formaPagamento: 'A definir',
    pedidoAtual: 'Em consumo',
    observacoes: 'Cliente solicitou mesa próxima à janela.',
    itens: [
      { nome: 'Pizza Margherita', quantidade: 1, valor: 59.90 },
      { nome: 'Coca-Cola 1L', quantidade: 1, valor: 12.90 },
      { nome: 'Água Mineral', quantidade: 2, valor: 8.00 }
    ]
  },
  {
    id: 2,
    nome: 'Mesa 02',
    capacidade: 4,
    status: 'disponivel',
    reservaStatus: 'sem-reserva',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Livre agora',
    observacoes: 'Mesa limpa e pronta para receber clientes.',
    itens: []
  },
  {
    id: 3,
    nome: 'Mesa 03',
    capacidade: 6,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Ana Costa',
    telefone: '(11) 97777-2310',
    horarioReserva: '14:00',
    chegada: '14:20',
    duracao: '01h 13min',
    pessoas: 5,
    garcom: 'Maria Oliveira',
    comanda: '#CMD-4523',
    valorGasto: 234.70,
    formaPagamento: 'Cartão de crédito',
    pedidoAtual: 'Pratos servidos',
    observacoes: 'Aniversário. Separar sobremesa com vela.',
    itens: [
      { nome: 'Filé Mignon', quantidade: 2, valor: 138.00 },
      { nome: 'Salada Caesar', quantidade: 1, valor: 32.90 },
      { nome: 'Suco de Laranja', quantidade: 3, valor: 27.00 }
    ]
  },
  {
    id: 4,
    nome: 'Mesa 04',
    capacidade: 2,
    status: 'disponivel',
    reservaStatus: 'confirmada',
    reservadoPor: 'Beatriz Ramos',
    telefone: '(11) 96666-3404',
    horarioReserva: '19:30',
    chegada: '',
    duracao: '',
    pessoas: 2,
    garcom: 'A definir',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Reservada para hoje',
    observacoes: 'Cliente pediu uma mesa tranquila para jantar.',
    itens: []
  },
  {
    id: 5,
    nome: 'Mesa 05',
    capacidade: 4,
    status: 'indisponivel',
    reservaStatus: 'bloqueada',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Em manutenção',
    observacoes: 'Manutenção no tampo da mesa prevista para hoje.',
    itens: []
  },
  {
    id: 6,
    nome: 'Mesa 06',
    capacidade: 2,
    status: 'ocupada',
    reservaStatus: 'aguardando',
    reservadoPor: 'Roberto Lima',
    telefone: '(11) 95555-5606',
    horarioReserva: '11:00',
    chegada: '12:10',
    duracao: '02h 53min',
    pessoas: 2,
    garcom: 'Pedro Santos',
    comanda: '#CMD-4525',
    valorGasto: 89.50,
    formaPagamento: 'Pix',
    pedidoAtual: 'Aguardando sobremesa',
    observacoes: 'Aguardar cliente confirmar se deseja café.',
    itens: [
      { nome: 'Hambúrguer Artesanal', quantidade: 1, valor: 42.90 },
      { nome: 'Batata Frita', quantidade: 1, valor: 24.90 },
      { nome: 'Refrigerante lata', quantidade: 2, valor: 15.80 }
    ]
  },
  {
    id: 7,
    nome: 'Mesa 07',
    capacidade: 8,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Fernanda Souza',
    telefone: '(11) 94444-7707',
    horarioReserva: '12:00',
    chegada: '13:00',
    duracao: '02h 03min',
    pessoas: 7,
    garcom: 'João Mendes',
    comanda: '#CMD-4528',
    valorGasto: 312.00,
    formaPagamento: 'A definir',
    pedidoAtual: 'Em consumo',
    observacoes: 'Grupo corporativo. Enviar conta separada por pessoa.',
    itens: [
      { nome: 'Risoto de Camarão', quantidade: 2, valor: 98.00 },
      { nome: 'Parmegiana', quantidade: 2, valor: 94.00 },
      { nome: 'Vinho Tinto', quantidade: 1, valor: 78.00 },
      { nome: 'Tiramisù', quantidade: 2, valor: 42.00 }
    ]
  },
  {
    id: 8,
    nome: 'Mesa 08',
    capacidade: 6,
    status: 'disponivel',
    reservaStatus: 'sem-reserva',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Livre agora',
    observacoes: 'Mesa liberada após higienização.',
    itens: []
  },
  {
    id: 9,
    nome: 'Mesa 09',
    capacidade: 4,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Marcos Oliveira',
    telefone: '(11) 93333-9009',
    horarioReserva: '14:00',
    chegada: '14:40',
    duracao: '00h 33min',
    pessoas: 4,
    garcom: 'Maria Oliveira',
    comanda: '#CMD-4530',
    valorGasto: 198.20,
    formaPagamento: 'A definir',
    pedidoAtual: 'Pedido em preparo',
    observacoes: 'Sem observações adicionais.',
    itens: [
      { nome: 'Moqueca', quantidade: 1, valor: 98.00 },
      { nome: 'Arroz branco', quantidade: 2, valor: 18.00 },
      { nome: 'Farofa da casa', quantidade: 1, valor: 16.90 }
    ]
  },
  {
    id: 10,
    nome: 'Mesa 10',
    capacidade: 2,
    status: 'disponivel',
    reservaStatus: 'confirmada',
    reservadoPor: 'Lucas Martins',
    telefone: '(11) 92222-1010',
    horarioReserva: '20:00',
    chegada: '',
    duracao: '',
    pessoas: 2,
    garcom: 'A definir',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Reservada para hoje',
    observacoes: 'Reserva feita pelo aplicativo.',
    itens: []
  },
  {
    id: 11,
    nome: 'Mesa 11',
    capacidade: 4,
    status: 'indisponivel',
    reservaStatus: 'bloqueada',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Bloqueada',
    observacoes: 'Mesa bloqueada pelo gerente para reorganização do salão.',
    itens: []
  },
  {
    id: 12,
    nome: 'Mesa 12',
    capacidade: 2,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Juliana Alves',
    telefone: '(11) 91111-1212',
    horarioReserva: '',
    chegada: '15:10',
    duracao: '00h 03min',
    pessoas: 2,
    garcom: 'Pedro Santos',
    comanda: '#CMD-4532',
    valorGasto: 67.30,
    formaPagamento: 'A definir',
    pedidoAtual: 'Novo pedido',
    observacoes: 'Cliente solicitou atendimento rápido.',
    itens: [
      { nome: 'Porção de Fritas', quantidade: 1, valor: 29.90 },
      { nome: 'Chopp', quantidade: 2, valor: 24.00 }
    ]
  },
  {
    id: 13,
    nome: 'Mesa 13',
    capacidade: 4,
    status: 'disponivel',
    reservaStatus: 'sem-reserva',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Livre agora',
    observacoes: 'Mesa pronta para ocupação.',
    itens: []
  },
  {
    id: 14,
    nome: 'Mesa 14',
    capacidade: 6,
    status: 'ocupada',
    reservaStatus: 'chegou',
    reservadoPor: 'Paulo Mendes',
    telefone: '(11) 90000-1414',
    horarioReserva: '15:00',
    chegada: '15:30',
    duracao: '00h 43min',
    pessoas: 6,
    garcom: 'João Mendes',
    comanda: '#CMD-4535',
    valorGasto: 275.40,
    formaPagamento: 'A definir',
    pedidoAtual: 'Pratos servidos',
    observacoes: 'Aguardar pedido de bebidas adicionais.',
    itens: [
      { nome: 'Churrasco Misto', quantidade: 1, valor: 124.90 },
      { nome: 'Picanha', quantidade: 1, valor: 98.00 },
      { nome: 'Maionese da casa', quantidade: 2, valor: 24.90 }
    ]
  },
  {
    id: 15,
    nome: 'Mesa 15',
    capacidade: 4,
    status: 'disponivel',
    reservaStatus: 'sem-reserva',
    reservadoPor: '',
    telefone: '',
    horarioReserva: '',
    chegada: '',
    duracao: '',
    pessoas: 0,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Livre agora',
    observacoes: 'Mesa próxima ao bar.',
    itens: []
  },
  {
    id: 16,
    nome: 'Mesa 16',
    capacidade: 4,
    status: 'ocupada',
    reservaStatus: 'aguardando',
    reservadoPor: 'Camila Rocha',
    telefone: '(11) 98888-1616',
    horarioReserva: '15:45',
    chegada: '16:00',
    duracao: '00h 13min',
    pessoas: 3,
    garcom: 'Maria Oliveira',
    comanda: '#CMD-4537',
    valorGasto: 125.90,
    formaPagamento: 'A definir',
    pedidoAtual: 'Aguardando entrada',
    observacoes: 'Cliente pediu opção sem lactose.',
    itens: [
      { nome: 'Macarrão à Bolonhesa', quantidade: 1, valor: 49.90 },
      { nome: 'Coca-Cola 2L', quantidade: 1, valor: 14.90 }
    ]
  },
  {
    id: 17,
    nome: 'Mesa 17',
    capacidade: 8,
    status: 'disponivel',
    reservaStatus: 'confirmada',
    reservadoPor: 'Grupo Oliveira',
    telefone: '(11) 97777-1717',
    horarioReserva: '21:00',
    chegada: '',
    duracao: '',
    pessoas: 8,
    garcom: 'A definir',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Reservada para hoje',
    observacoes: 'Preparar duas mesas infantis ao lado.',
    itens: []
  },
  {
    id: 18,
    nome: 'Mesa 18',
    capacidade: 4,
    status: 'indisponivel',
    reservaStatus: 'bloqueada',
    reservadoPor: 'Evento APEX',
    telefone: '',
    horarioReserva: '18:00',
    chegada: '',
    duracao: '',
    pessoas: 4,
    garcom: '',
    comanda: '',
    valorGasto: 0,
    formaPagamento: '',
    pedidoAtual: 'Reservada para evento',
    observacoes: 'Mesa reservada para o evento corporativo da noite.',
    itens: []
  }
];

const ambienteMesasLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const estadoMesasVazio = [];
window.dadosMesas = ambienteMesasLocal ? dadosMesasPreview : estadoMesasVazio;

(() => {
  function carregarCliente() {
    if (window.apexModulosApi) return Promise.resolve(window.apexModulosApi);
    if (window.apexModulosClientPromise) return window.apexModulosClientPromise;
    window.apexModulosClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/scripts/api/modulos-client.js?v=etapa18-qr-mesas';
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
  window.dadosMesasRemotoAtivo = false;
  window.recarregarMesasReais = () => carregarCliente()
    .then((api) => api.listarSalao('mesas'))
    .then((dados) => {
      if (typeof dados?.meta?.idRestaurante !== 'string') return false;
      window.dadosMesas = (dados.mesas || []).map(adaptarMesa);
      window.dadosMesasRemotoAtivo = true;
      document.dispatchEvent(new CustomEvent('apex:mesas-atualizado'));
      return true;
    })
    .catch((erro) => { window.dadosMesasErro = erro; if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) { window.dadosMesas = []; document.dispatchEvent(new CustomEvent('apex:mesas-indisponiveis')); } return false; });
  window.dadosMesasPronto = window.recarregarMesasReais();
})();
