/** APEX Food | Mapa de mesas focado na estrutura e no status real do salão. */
import { LayoutGrid } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function MapaMesas() { return <PaginaModulo secao="Salão" titulo="Leia o salão em um olhar" descricao="Visualize disponibilidade, ocupação e reservas a partir da configuração real." tipo="mapa" icone={LayoutGrid} imagem="/manus-storage/apex-food-salao_873b252a.jpg" orientacao="Cadastre o layout das mesas e vincule os eventos de atendimento para ativar o mapa." />; }

