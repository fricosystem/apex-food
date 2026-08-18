/** APEX Food | Cabeçalho de contexto para desktop, tablet e mobile. */
import { Menu, Settings2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { localizarGrupo, localizarItem } from "@/dados/navegacao";

type CabecalhoProps = { aoAbrirMenu: () => void };

export function Cabecalho({ aoAbrirMenu }: CabecalhoProps) {
  const [localizacao] = useLocation();
  const pagina = localizarItem(localizacao);
  const grupo = localizarGrupo(localizacao);

  return (
    <header className="cabecalho">
      <div className="flex items-center gap-3 min-w-0">
        <button className="botao-menu" onClick={aoAbrirMenu} aria-label="Abrir menu de navegação"><Menu size={21} /></button>
        <div className="min-w-0">
          {grupo && <p className="trilha">{grupo}</p>}
          <h1>{pagina?.titulo ?? "Página não encontrada"}</h1>
        </div>
      </div>
      <Link href="/salao/configuracao" className="atalho-configuracao">
        <Settings2 size={16} />
        <span>Configurar operação</span>
      </Link>
    </header>
  );
}

