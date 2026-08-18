/** APEX Food | Planejamento de escala baseado em turnos reais. */
import { CalendarClock } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function EscalaTrabalho() { return <PaginaModulo secao="Equipe" titulo="Planeje turnos com contexto" descricao="Construa uma escala de trabalho alinhada ao ritmo do serviço." tipo="lista" icone={CalendarClock} orientacao="Conecte a equipe e a agenda operacional para estruturar os turnos." />; }

