/** APEX Food | Gestão do cardápio digital sem QR ou conteúdo demonstrativo. */
import { QrCode } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function CardapioDigital() { return <PaginaModulo secao="Cardápio" titulo="Prepare sua vitrine digital" descricao="Configure a experiência de consulta do cardápio pelo cliente." tipo="configuracao" icone={QrCode} orientacao="Defina a identidade e conecte os produtos publicados antes de gerar o acesso digital." />; }

