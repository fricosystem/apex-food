/** APEX Food | Histórico de pedidos destinado a registros concluídos reais. */
import { History } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function HistoricoPedidos() { return <PaginaModulo secao="Pedidos" titulo="Consulte atendimentos concluídos" descricao="A base histórica preservará a rastreabilidade dos pedidos já finalizados." tipo="lista" icone={History} orientacao="Disponibilize a fonte de pedidos finalizados para preencher o histórico." />; }

