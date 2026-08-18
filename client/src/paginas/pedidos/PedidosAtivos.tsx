/** APEX Food | Lista de pedidos ativos sem simular atendimentos em andamento. */
import { ShoppingBag } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function PedidosAtivos() { return <PaginaModulo secao="Pedidos" titulo="Acompanhe o que está em serviço" descricao="Pedidos em andamento serão atualizados nesta área por status e prioridade." tipo="lista" icone={ShoppingBag} orientacao="Integre a origem de comandas para acompanhar pedidos ativos em tempo real." />; }

