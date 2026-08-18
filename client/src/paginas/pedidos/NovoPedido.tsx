/** APEX Food | Página de abertura de pedido, preparada para integração transacional. */
import { PlusCircle } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function NovoPedido() { return <PaginaModulo secao="Pedidos" titulo="Abra uma nova comanda" descricao="Inicie o atendimento com produtos, mesa, cliente e observações reais." tipo="cadastro" icone={PlusCircle} orientacao="Conecte o catálogo e a origem dos pedidos antes de abrir uma comanda." />; }

