/** APEX Food | Relatório de horários de pico sem curvas de demanda fabricadas. */
import { Clock3 } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function HorariosPico() { return <PaginaModulo secao="Relatórios" titulo="Conheça os momentos de maior demanda" descricao="Observe padrões de movimento quando o histórico operacional estiver conectado." tipo="relatorio" icone={Clock3} orientacao="Conecte a data e hora dos pedidos para analisar os horários de pico." />; }

