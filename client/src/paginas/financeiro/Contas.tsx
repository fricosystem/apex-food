/** APEX Food | Contas a pagar e receber sem compromissos financeiros fictícios. */
import { FileText } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function Contas() { return <PaginaModulo secao="Financeiro" titulo="Organize os compromissos financeiros" descricao="Reúna contas, fornecedores, recebíveis e respectivas previsões." tipo="lista" icone={FileText} orientacao="Disponibilize o plano de contas e lançamentos reais para preencher esta área." />; }

