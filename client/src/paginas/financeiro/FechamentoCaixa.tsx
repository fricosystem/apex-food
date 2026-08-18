/** APEX Food | Fechamento de caixa baseado apenas em lançamentos confirmados. */
import { LockKeyhole } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function FechamentoCaixa() { return <PaginaModulo secao="Financeiro" titulo="Conclua o expediente com segurança" descricao="Confira lançamentos, diferenças e meios de pagamento antes do fechamento." tipo="painel" icone={LockKeyhole} orientacao="Conecte os recebimentos e o caixa do dia para habilitar a conferência." />; }

