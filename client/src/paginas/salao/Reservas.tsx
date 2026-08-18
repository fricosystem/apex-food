/** APEX Food | Agenda de reservas sem nomes ou horários fictícios. */
import { Calendar } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function Reservas() { return <PaginaModulo secao="Salão" titulo="Antecipe a experiência do cliente" descricao="Centralize reservas confirmadas e detalhes de atendimento do salão." tipo="lista" icone={Calendar} orientacao="Conecte a agenda ou a origem de reservas para visualizar os próximos atendimentos." />; }

