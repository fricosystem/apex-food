/** APEX Food | Dashboard financeiro sem resultados simulados. */
import { DollarSign } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function FinanceiroDashboard() { return <PaginaModulo secao="Dashboards" titulo="Resultado que pode ser conferido" descricao="Centralize os indicadores financeiros essenciais do restaurante." tipo="painel" icone={DollarSign} orientacao="Conecte lançamentos e meios de pagamento para visualizar os indicadores." />; }

