/** APEX Food | Leitura de desempenho de produtos baseada em vendas confirmadas. */
import { Star } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function ProdutosVendidos() { return <PaginaModulo secao="Relatórios" titulo="Entenda o que ganha preferência" descricao="Identifique produtos e categorias a partir do consumo registrado." tipo="relatorio" icone={Star} orientacao="Conecte os itens dos pedidos finalizados para gerar esta análise." />; }

