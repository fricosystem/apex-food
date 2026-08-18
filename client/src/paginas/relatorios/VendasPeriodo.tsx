/** APEX Food | Relatório de vendas em períodos reais e comparáveis. */
import { BarChart3 } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function VendasPeriodo() { return <PaginaModulo secao="Relatórios" titulo="Encontre o ritmo das vendas" descricao="Compare períodos com base em transações que realmente ocorreram." tipo="relatorio" icone={BarChart3} orientacao="Conecte a base de pedidos faturados para disponibilizar a análise por período." />; }

