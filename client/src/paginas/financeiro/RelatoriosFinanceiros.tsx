/** APEX Food | Relatórios financeiros destinados a períodos consistentes e fontes oficiais. */
import { PieChart } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function RelatoriosFinanceiros() { return <PaginaModulo secao="Financeiro" titulo="Analise o resultado do período" descricao="Consulte relatórios financeiros produzidos a partir de fontes conciliadas." tipo="relatorio" icone={PieChart} orientacao="Conecte receitas, despesas e períodos de fechamento para gerar relatórios." />; }

