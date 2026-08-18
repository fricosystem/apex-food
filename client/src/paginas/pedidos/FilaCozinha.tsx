/** APEX Food | Fila de cozinha para organização de preparo sem tickets artificiais. */
import { ChefHat } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function FilaCozinha() { return <PaginaModulo secao="Pedidos" titulo="Organize a sequência de preparo" descricao="A cozinha receberá somente pedidos reais confirmados pela operação." tipo="lista" icone={ChefHat} imagem="/manus-storage/apex-food-operacao_6cbdf1e0.jpg" orientacao="Conecte os estágios de produção para montar a fila de cozinha." />; }

