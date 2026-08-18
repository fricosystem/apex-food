/** APEX Food | Dashboard de desempenho preparado para dados rastreáveis. */
import { TrendingUp } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function Desempenho() { return <PaginaModulo secao="Dashboards" titulo="Qualidade em movimento" descricao="Observe tempos, produtividade e qualidade quando houver dados validados." tipo="painel" icone={TrendingUp} orientacao="Defina os eventos de atendimento e preparo que alimentarão a análise." />; }

