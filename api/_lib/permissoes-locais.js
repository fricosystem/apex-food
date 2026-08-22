'use strict';

const CATALOGO_PERMISSOES = Object.freeze([
  { codigo: 'estabelecimento.visualizar', nome: 'Visualizar estabelecimento', modulo: 'Estabelecimento', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'estabelecimento.configurar', nome: 'Configurar estabelecimento', modulo: 'Estabelecimento', acao: 'configurar', sensibilidade: 'alta' },
  { codigo: 'equipe.visualizar', nome: 'Visualizar equipe', modulo: 'Equipe', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'equipe.gerenciar', nome: 'Gerenciar equipe', modulo: 'Equipe', acao: 'gerenciar', sensibilidade: 'alta' },
  { codigo: 'papeis.visualizar', nome: 'Visualizar categorias e permissões', modulo: 'Equipe', acao: 'visualizar_papeis', sensibilidade: 'normal' },
  { codigo: 'papeis.gerenciar', nome: 'Gerenciar categorias e permissões', modulo: 'Equipe', acao: 'gerenciar_papeis', sensibilidade: 'alta' },
  { codigo: 'cardapio.visualizar', nome: 'Visualizar cardápio', modulo: 'Cardápio', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'cardapio.gerenciar', nome: 'Gerenciar cardápio', modulo: 'Cardápio', acao: 'gerenciar', sensibilidade: 'alta' },
  { codigo: 'pedidos.visualizar', nome: 'Visualizar pedidos', modulo: 'Pedidos', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'pedidos.operar', nome: 'Operar pedidos', modulo: 'Pedidos', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'salao.visualizar', nome: 'Visualizar salão e mesas', modulo: 'Salão', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'salao.operar', nome: 'Operar salão e mesas', modulo: 'Salão', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'notificacoes.visualizar', nome: 'Visualizar notificações', modulo: 'Notificações', acao: 'visualizar', sensibilidade: 'normal' },
  { codigo: 'cozinha.operar', nome: 'Operar cozinha', modulo: 'Cozinha', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'caixa.operar', nome: 'Operar caixa', modulo: 'Caixa', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'financeiro.visualizar', nome: 'Visualizar financeiro', modulo: 'Financeiro', acao: 'visualizar', sensibilidade: 'alta' },
  { codigo: 'financeiro.operar', nome: 'Operar financeiro', modulo: 'Financeiro', acao: 'operar', sensibilidade: 'alta' },
  { codigo: 'relatorios.visualizar', nome: 'Visualizar relatórios', modulo: 'Relatórios', acao: 'visualizar', sensibilidade: 'normal' },
]);

const PAPEIS_NATIVOS = Object.freeze([
  { codigo: 'diretor', nome: 'Diretor', descricao: 'Gestão do estabelecimento e da equipe.', permissoes: ['estabelecimento.visualizar', 'estabelecimento.configurar', 'equipe.visualizar', 'equipe.gerenciar', 'papeis.visualizar', 'papeis.gerenciar', 'cardapio.visualizar', 'cardapio.gerenciar', 'pedidos.visualizar', 'pedidos.operar', 'salao.visualizar', 'salao.operar', 'notificacoes.visualizar', 'cozinha.operar', 'caixa.operar', 'financeiro.visualizar', 'financeiro.operar', 'relatorios.visualizar'] },
  { codigo: 'proprietario', nome: 'Proprietário', descricao: 'Acesso administrativo completo do estabelecimento.', permissoes: CATALOGO_PERMISSOES.map((item) => item.codigo) },
  { codigo: 'administrador', nome: 'Administrador', descricao: 'Administração operacional com escopo definido pelo estabelecimento.', permissoes: ['estabelecimento.visualizar', 'equipe.visualizar', 'equipe.gerenciar', 'papeis.visualizar', 'cardapio.visualizar', 'cardapio.gerenciar', 'pedidos.visualizar', 'pedidos.operar', 'salao.visualizar', 'salao.operar', 'notificacoes.visualizar', 'cozinha.operar', 'caixa.operar', 'financeiro.visualizar', 'relatorios.visualizar'] },
  { codigo: 'gerente', nome: 'Gerente', descricao: 'Acompanhamento e operação diária do estabelecimento.', permissoes: ['estabelecimento.visualizar', 'equipe.visualizar', 'cardapio.visualizar', 'pedidos.visualizar', 'pedidos.operar', 'salao.visualizar', 'salao.operar', 'notificacoes.visualizar', 'cozinha.operar', 'caixa.operar', 'relatorios.visualizar'] },
  { codigo: 'porteiro', nome: 'Porteiro', descricao: 'Recepção e controle de chegada de clientes.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'salao.visualizar'] },
  { codigo: 'garcom', nome: 'Garçom', descricao: 'Atendimento de mesas e pedidos do salão.', permissoes: ['estabelecimento.visualizar', 'cardapio.visualizar', 'pedidos.visualizar', 'pedidos.operar', 'salao.visualizar', 'salao.operar'] },
  { codigo: 'cozinheiro', nome: 'Cozinheiro', descricao: 'Execução das tarefas de preparo na cozinha.', permissoes: ['estabelecimento.visualizar', 'cardapio.visualizar', 'salao.visualizar', 'pedidos.visualizar', 'notificacoes.visualizar', 'cozinha.operar'] },
  { codigo: 'cozinha', nome: 'Cozinha', descricao: 'Compatibilidade com o papel operacional legado.', permissoes: ['estabelecimento.visualizar', 'cardapio.visualizar', 'salao.visualizar', 'pedidos.visualizar', 'notificacoes.visualizar', 'cozinha.operar'] },
  { codigo: 'caixa', nome: 'Caixa', descricao: 'Conferência e fechamento operacional do caixa.', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar', 'notificacoes.visualizar', 'caixa.operar', 'financeiro.visualizar'] },
  { codigo: 'financeiro', nome: 'Financeiro', descricao: 'Consulta e operação financeira autorizada.', permissoes: ['estabelecimento.visualizar', 'notificacoes.visualizar', 'caixa.operar', 'financeiro.visualizar', 'financeiro.operar', 'relatorios.visualizar'] },
  { codigo: 'analista', nome: 'Analista', descricao: 'Consulta de indicadores e relatórios.', permissoes: ['estabelecimento.visualizar', 'cardapio.visualizar', 'salao.visualizar', 'relatorios.visualizar', 'notificacoes.visualizar'] },
  { codigo: 'auditor', nome: 'Auditor', descricao: 'Consulta controlada para auditoria.', permissoes: ['estabelecimento.visualizar', 'cardapio.visualizar', 'salao.visualizar', 'relatorios.visualizar', 'notificacoes.visualizar'] },
]);

const PAPEIS_NATIVOS_POR_CODIGO = new Map(PAPEIS_NATIVOS.map((papel) => [papel.codigo, papel]));
const PERMISSOES_VALIDAS = new Set(CATALOGO_PERMISSOES.map((item) => item.codigo));

module.exports = { CATALOGO_PERMISSOES, PAPEIS_NATIVOS, PAPEIS_NATIVOS_POR_CODIGO, PERMISSOES_VALIDAS };
