/** APEX Food | Fluxo de caixa sem movimentações financeiras simuladas. */
import { ArrowLeftRight } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function FluxoCaixa() { return <PaginaModulo secao="Financeiro" titulo="Entenda entradas e saídas" descricao="Acompanhe os movimentos financeiros da operação em um fluxo verificável." tipo="lista" icone={ArrowLeftRight} orientacao="Conecte os lançamentos financeiros para iniciar o acompanhamento de caixa." />; }

