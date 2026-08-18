/** APEX Food | Roteador da operação, com uma rota explícita para cada módulo do sidebar. */
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Route, Switch } from "wouter";
import { LayoutSistema } from "@/componentes/layout/LayoutSistema";
import { Inicio } from "@/paginas/inicio/Inicio";
import { Operacional } from "@/paginas/dashboards/Operacional";
import { FinanceiroDashboard } from "@/paginas/dashboards/FinanceiroDashboard";
import { Desempenho } from "@/paginas/dashboards/Desempenho";
import { NovoPedido } from "@/paginas/pedidos/NovoPedido";
import { PedidosAtivos } from "@/paginas/pedidos/PedidosAtivos";
import { HistoricoPedidos } from "@/paginas/pedidos/HistoricoPedidos";
import { FilaCozinha } from "@/paginas/pedidos/FilaCozinha";
import { Categorias } from "@/paginas/cardapio/Categorias";
import { Produtos } from "@/paginas/cardapio/Produtos";
import { Promocoes } from "@/paginas/cardapio/Promocoes";
import { CardapioDigital } from "@/paginas/cardapio/CardapioDigital";
import { MapaMesas } from "@/paginas/salao/MapaMesas";
import { Reservas } from "@/paginas/salao/Reservas";
import { ConfiguracaoMesas } from "@/paginas/salao/ConfiguracaoMesas";
import { Funcionarios } from "@/paginas/equipe/Funcionarios";
import { EscalaTrabalho } from "@/paginas/equipe/EscalaTrabalho";
import { Comissoes } from "@/paginas/equipe/Comissoes";
import { FechamentoCaixa } from "@/paginas/financeiro/FechamentoCaixa";
import { FluxoCaixa } from "@/paginas/financeiro/FluxoCaixa";
import { Contas } from "@/paginas/financeiro/Contas";
import { RelatoriosFinanceiros } from "@/paginas/financeiro/RelatoriosFinanceiros";
import { VendasPeriodo } from "@/paginas/relatorios/VendasPeriodo";
import { ProdutosVendidos } from "@/paginas/relatorios/ProdutosVendidos";
import { HorariosPico } from "@/paginas/relatorios/HorariosPico";
import { AvaliacoesClientes } from "@/paginas/relatorios/AvaliacoesClientes";
import { PerformanceEquipe } from "@/paginas/relatorios/PerformanceEquipe";
import { NaoEncontrada } from "@/paginas/NaoEncontrada";

function Router() {
  return (
    <LayoutSistema>
      <Switch>
        <Route path="/" component={Inicio} />
        <Route path="/dashboards/operacional" component={Operacional} />
        <Route path="/dashboards/financeiro" component={FinanceiroDashboard} />
        <Route path="/dashboards/desempenho" component={Desempenho} />
        <Route path="/pedidos/novo" component={NovoPedido} />
        <Route path="/pedidos/ativos" component={PedidosAtivos} />
        <Route path="/pedidos/historico" component={HistoricoPedidos} />
        <Route path="/pedidos/cozinha" component={FilaCozinha} />
        <Route path="/cardapio/categorias" component={Categorias} />
        <Route path="/cardapio/produtos" component={Produtos} />
        <Route path="/cardapio/promocoes" component={Promocoes} />
        <Route path="/cardapio/digital" component={CardapioDigital} />
        <Route path="/salao/mesas" component={MapaMesas} />
        <Route path="/salao/reservas" component={Reservas} />
        <Route path="/salao/configuracao" component={ConfiguracaoMesas} />
        <Route path="/equipe/funcionarios" component={Funcionarios} />
        <Route path="/equipe/escala" component={EscalaTrabalho} />
        <Route path="/equipe/comissoes" component={Comissoes} />
        <Route path="/financeiro/fechamento" component={FechamentoCaixa} />
        <Route path="/financeiro/fluxo" component={FluxoCaixa} />
        <Route path="/financeiro/contas" component={Contas} />
        <Route path="/financeiro/relatorios" component={RelatoriosFinanceiros} />
        <Route path="/relatorios/vendas" component={VendasPeriodo} />
        <Route path="/relatorios/produtos" component={ProdutosVendidos} />
        <Route path="/relatorios/horarios" component={HorariosPico} />
        <Route path="/relatorios/avaliacoes" component={AvaliacoesClientes} />
        <Route path="/relatorios/equipe" component={PerformanceEquipe} />
        <Route component={NaoEncontrada} />
      </Switch>
    </LayoutSistema>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider><Router /></TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
