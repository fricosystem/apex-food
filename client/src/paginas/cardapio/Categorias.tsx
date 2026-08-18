/** APEX Food | Organização das categorias do cardápio sem estrutura pré-preenchida. */
import { Folder } from "lucide-react";
import { PaginaModulo } from "@/componentes/paginas/PaginaModulo";
export function Categorias() { return <PaginaModulo secao="Cardápio" titulo="Estruture o seu cardápio" descricao="Defina as seções que orientarão o cadastro e a apresentação dos produtos." tipo="cadastro" icone={Folder} orientacao="Crie categorias a partir da estrutura real de produtos do restaurante." />; }

