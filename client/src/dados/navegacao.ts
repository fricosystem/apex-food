/** APEX Food | Mapa único das páginas e dos itens exibidos no menu lateral. */
import {
  Activity,
  Armchair,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarClock,
  ChefHat,
  Clock3,
  DollarSign,
  FileBarChart,
  FileText,
  Folder,
  History,
  Home,
  LayoutGrid,
  LockKeyhole,
  MessageSquare,
  Package,
  Percent,
  PieChart,
  PlusCircle,
  QrCode,
  Receipt,
  Settings2,
  ShoppingBag,
  Star,
  Tag,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import type { GrupoNavegacao, ItemNavegacao } from "@/tipos/navegacao";

export const gruposNavegacao: GrupoNavegacao[] = [
  {
    titulo: "Geral",
    itens: [
      { titulo: "Visão geral", descricao: "Centro de comando da operação", caminho: "/", icone: Home },
    ],
  },
  {
    titulo: "Dashboards",
    itens: [
      { titulo: "Operacional", descricao: "Pedidos, cozinha e salão", caminho: "/dashboards/operacional", icone: Activity },
      { titulo: "Financeiro", descricao: "Receitas e indicadores", caminho: "/dashboards/financeiro", icone: DollarSign },
      { titulo: "Desempenho", descricao: "Tempo e qualidade do serviço", caminho: "/dashboards/desempenho", icone: TrendingUp },
    ],
  },
  {
    titulo: "Pedidos",
    itens: [
      { titulo: "Novo pedido", descricao: "Abertura de comanda", caminho: "/pedidos/novo", icone: PlusCircle },
      { titulo: "Pedidos ativos", descricao: "Acompanhamento em andamento", caminho: "/pedidos/ativos", icone: ShoppingBag },
      { titulo: "Histórico", descricao: "Pedidos finalizados", caminho: "/pedidos/historico", icone: History },
      { titulo: "Fila da cozinha", descricao: "Sequência de preparo", caminho: "/pedidos/cozinha", icone: ChefHat },
    ],
  },
  {
    titulo: "Cardápio",
    itens: [
      { titulo: "Categorias", descricao: "Estrutura de seções", caminho: "/cardapio/categorias", icone: Folder },
      { titulo: "Produtos", descricao: "Itens e disponibilidade", caminho: "/cardapio/produtos", icone: Package },
      { titulo: "Promoções", descricao: "Ofertas e combinações", caminho: "/cardapio/promocoes", icone: Tag },
      { titulo: "Cardápio digital", descricao: "Acesso do cliente", caminho: "/cardapio/digital", icone: QrCode },
    ],
  },
  {
    titulo: "Salão",
    itens: [
      { titulo: "Mapa de mesas", descricao: "Situação do salão", caminho: "/salao/mesas", icone: LayoutGrid },
      { titulo: "Reservas", descricao: "Agenda de atendimento", caminho: "/salao/reservas", icone: Calendar },
      { titulo: "Configuração de mesas", descricao: "Estrutura do ambiente", caminho: "/salao/configuracao", icone: Settings2 },
    ],
  },
  {
    titulo: "Equipe",
    itens: [
      { titulo: "Funcionários", descricao: "Cadastro e acesso", caminho: "/equipe/funcionarios", icone: UserCircle },
      { titulo: "Escala de trabalho", descricao: "Turnos da equipe", caminho: "/equipe/escala", icone: CalendarClock },
      { titulo: "Comissões", descricao: "Regras e apuração", caminho: "/equipe/comissoes", icone: Percent },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { titulo: "Fechamento de caixa", descricao: "Conferência de expediente", caminho: "/financeiro/fechamento", icone: LockKeyhole },
      { titulo: "Fluxo de caixa", descricao: "Entradas e saídas", caminho: "/financeiro/fluxo", icone: ArrowLeftRight },
      { titulo: "Contas a pagar e receber", descricao: "Compromissos financeiros", caminho: "/financeiro/contas", icone: FileText },
      { titulo: "Relatórios financeiros", descricao: "Análises de resultado", caminho: "/financeiro/relatorios", icone: PieChart },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      { titulo: "Vendas por período", descricao: "Evolução comercial", caminho: "/relatorios/vendas", icone: BarChart3 },
      { titulo: "Produtos mais vendidos", descricao: "Preferências de consumo", caminho: "/relatorios/produtos", icone: Star },
      { titulo: "Horários de pico", descricao: "Demanda por faixa horária", caminho: "/relatorios/horarios", icone: Clock3 },
      { titulo: "Avaliações dos clientes", descricao: "Satisfação e retorno", caminho: "/relatorios/avaliacoes", icone: MessageSquare },
      { titulo: "Performance da equipe", descricao: "Indicadores de atendimento", caminho: "/relatorios/equipe", icone: Award },
    ],
  },
];

export function localizarItem(caminho: string): ItemNavegacao | undefined {
  return gruposNavegacao.flatMap((grupo) => grupo.itens).find((item) => item.caminho === caminho);
}

export function localizarGrupo(caminho: string): string | undefined {
  return gruposNavegacao.find((grupo) => grupo.itens.some((item) => item.caminho === caminho))?.titulo;
}

