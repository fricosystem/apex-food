window.dadosEquipeApexFood = {
  funcionarios: [
    { id: 'FUN-001', nome: 'João Mendes', iniciais: 'JM', cargo: 'Garçom', setor: 'Salão', telefone: '(11) 98888-0101', email: 'joao.mendes@apexfood.com.br', status: 'ativo', turno: 'Almoço', admissao: '12/03/2024', comissao: 5, vendasMes: 18450.80, avaliacao: 4.9, pedidos: 42, cor: 'from-orange-400 to-red-500' },
    { id: 'FUN-002', nome: 'Maria Oliveira', iniciais: 'MO', cargo: 'Garçonete', setor: 'Salão', telefone: '(11) 97777-0202', email: 'maria.oliveira@apexfood.com.br', status: 'ativo', turno: 'Jantar', admissao: '08/07/2024', comissao: 5, vendasMes: 16220.40, avaliacao: 4.8, pedidos: 38, cor: 'from-pink-400 to-purple-500' },
    { id: 'FUN-003', nome: 'Pedro Santos', iniciais: 'PS', cargo: 'Garçom', setor: 'Salão', telefone: '(11) 96666-0303', email: 'pedro.santos@apexfood.com.br', status: 'ativo', turno: 'Integral', admissao: '21/01/2025', comissao: 4, vendasMes: 12890.30, avaliacao: 4.7, pedidos: 31, cor: 'from-blue-400 to-cyan-500' },
    { id: 'FUN-004', nome: 'Carolina Lima', iniciais: 'CL', cargo: 'Cozinheira', setor: 'Cozinha', telefone: '(11) 95555-0404', email: 'carolina.lima@apexfood.com.br', status: 'ativo', turno: 'Jantar', admissao: '18/09/2023', comissao: 0, vendasMes: 0, avaliacao: 4.9, pedidos: 0, cor: 'from-emerald-400 to-green-600' },
    { id: 'FUN-005', nome: 'Rafael Costa', iniciais: 'RC', cargo: 'Auxiliar de Cozinha', setor: 'Cozinha', telefone: '(11) 94444-0505', email: 'rafael.costa@apexfood.com.br', status: 'ferias', turno: 'Almoço', admissao: '04/11/2024', comissao: 0, vendasMes: 0, avaliacao: 4.6, pedidos: 0, cor: 'from-yellow-400 to-orange-500' },
    { id: 'FUN-006', nome: 'Beatriz Almeida', iniciais: 'BA', cargo: 'Gerente', setor: 'Gestão', telefone: '(11) 93333-0606', email: 'beatriz.almeida@apexfood.com.br', status: 'ativo', turno: 'Integral', admissao: '15/05/2022', comissao: 1, vendasMes: 0, avaliacao: 4.9, pedidos: 0, cor: 'from-violet-400 to-purple-600' },
    { id: 'FUN-007', nome: 'Diego Martins', iniciais: 'DM', cargo: 'Bartender', setor: 'Bar', telefone: '(11) 92222-0707', email: 'diego.martins@apexfood.com.br', status: 'ativo', turno: 'Jantar', admissao: '23/02/2025', comissao: 3, vendasMes: 8920.50, avaliacao: 4.7, pedidos: 18, cor: 'from-sky-400 to-blue-600' },
    { id: 'FUN-008', nome: 'Lucas Ferreira', iniciais: 'LF', cargo: 'Garçom', setor: 'Salão', telefone: '(11) 91111-0808', email: 'lucas.ferreira@apexfood.com.br', status: 'inativo', turno: 'Almoço', admissao: '02/08/2023', comissao: 4, vendasMes: 0, avaliacao: 4.5, pedidos: 0, cor: 'from-slate-400 to-slate-600' }
  ],
  escalas: [
    { id: 'ESC-081', funcionarioId: 'FUN-001', data: '18/08/2026', dia: 'Hoje', entrada: '11:00', saida: '19:00', intervalo: '15:00', turno: 'Almoço', status: 'presente' },
    { id: 'ESC-082', funcionarioId: 'FUN-002', data: '18/08/2026', dia: 'Hoje', entrada: '16:00', saida: '00:00', intervalo: '20:00', turno: 'Jantar', status: 'agendado' },
    { id: 'ESC-083', funcionarioId: 'FUN-003', data: '18/08/2026', dia: 'Hoje', entrada: '12:00', saida: '20:00', intervalo: '16:00', turno: 'Integral', status: 'presente' },
    { id: 'ESC-084', funcionarioId: 'FUN-004', data: '18/08/2026', dia: 'Hoje', entrada: '15:00', saida: '23:00', intervalo: '19:00', turno: 'Jantar', status: 'presente' },
    { id: 'ESC-085', funcionarioId: 'FUN-001', data: '19/08/2026', dia: 'Amanhã', entrada: '11:00', saida: '19:00', intervalo: '15:00', turno: 'Almoço', status: 'agendado' },
    { id: 'ESC-086', funcionarioId: 'FUN-002', data: '19/08/2026', dia: 'Amanhã', entrada: '16:00', saida: '00:00', intervalo: '20:00', turno: 'Jantar', status: 'agendado' },
    { id: 'ESC-087', funcionarioId: 'FUN-006', data: '19/08/2026', dia: 'Amanhã', entrada: '09:00', saida: '18:00', intervalo: '13:00', turno: 'Integral', status: 'agendado' },
    { id: 'ESC-088', funcionarioId: 'FUN-007', data: '20/08/2026', dia: 'Quinta', entrada: '16:00', saida: '00:00', intervalo: '20:00', turno: 'Jantar', status: 'agendado' },
    { id: 'ESC-089', funcionarioId: 'FUN-004', data: '20/08/2026', dia: 'Quinta', entrada: '15:00', saida: '23:00', intervalo: '19:00', turno: 'Jantar', status: 'agendado' }
  ],
  comissoes: [
    { funcionarioId: 'FUN-001', periodo: 'Agosto/2026', vendas: 18450.80, percentual: 5, comissao: 922.54, pedidos: 42, variacao: 12.4, posicao: 1 },
    { funcionarioId: 'FUN-002', periodo: 'Agosto/2026', vendas: 16220.40, percentual: 5, comissao: 811.02, pedidos: 38, variacao: 8.7, posicao: 2 },
    { funcionarioId: 'FUN-003', periodo: 'Agosto/2026', vendas: 12890.30, percentual: 4, comissao: 515.61, pedidos: 31, variacao: 5.2, posicao: 3 },
    { funcionarioId: 'FUN-007', periodo: 'Agosto/2026', vendas: 8920.50, percentual: 3, comissao: 267.62, pedidos: 18, variacao: -2.1, posicao: 4 }
  ]
};
