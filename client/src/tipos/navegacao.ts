/** APEX Food | Tipos da navegação operacional e da arquitetura de rotas. */
import type { LucideIcon } from "lucide-react";

export type ItemNavegacao = {
  titulo: string;
  descricao: string;
  caminho: string;
  icone: LucideIcon;
};

export type GrupoNavegacao = {
  titulo: string;
  itens: ItemNavegacao[];
};

