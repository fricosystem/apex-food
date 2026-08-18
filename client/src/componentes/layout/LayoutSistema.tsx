/** APEX Food | Estrutura persistente do sistema: barra lateral, cabeçalho e área de conteúdo. */
import { useState, type ReactNode } from "react";
import { Cabecalho } from "@/componentes/layout/Cabecalho";
import { NavegacaoLateral } from "@/componentes/layout/NavegacaoLateral";

export function LayoutSistema({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <div className="sistema-apex">
      <NavegacaoLateral aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
      <div className="area-aplicacao">
        <Cabecalho aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="conteudo-principal">{children}</main>
      </div>
    </div>
  );
}

