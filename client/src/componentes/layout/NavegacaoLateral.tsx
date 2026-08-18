/** APEX Food | Navegação lateral responsiva com grupos funcionais e rota ativa em laranja. */
import { X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { gruposNavegacao } from "@/dados/navegacao";

type NavegacaoLateralProps = {
  aberta: boolean;
  aoFechar: () => void;
};

export function NavegacaoLateral({ aberta, aoFechar }: NavegacaoLateralProps) {
  const [localizacao] = useLocation();

  return (
    <>
      <button
        aria-label="Fechar menu lateral"
        className={`fundo-menu ${aberta ? "fundo-menu--visivel" : ""}`}
        onClick={aoFechar}
      />
      <aside className={`navegacao-lateral ${aberta ? "navegacao-lateral--aberta" : ""}`} aria-label="Navegação principal">
        <div className="marca-area">
          <Link href="/" className="marca" onClick={aoFechar}>
            <img src="/manus-storage/apex-food-marca_0b178618.png" alt="APEX Food" className="marca-icone" />
            <span><strong>APEX</strong><em>FOOD</em></span>
          </Link>
          <button className="botao-fechar-menu" onClick={aoFechar} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <nav className="navegacao-itens">
          {gruposNavegacao.map((grupo) => (
            <div className="grupo-navegacao" key={grupo.titulo}>
              <p>{grupo.titulo}</p>
              <ul>
                {grupo.itens.map((item) => {
                  const ativo = localizacao === item.caminho;
                  const Icone = item.icone;
                  return (
                    <li key={item.caminho}>
                      <Link
                        href={item.caminho}
                        onClick={aoFechar}
                        className={`item-navegacao ${ativo ? "item-navegacao--ativo" : ""}`}
                        aria-current={ativo ? "page" : undefined}
                      >
                        <Icone size={17} strokeWidth={1.8} />
                        <span>{item.titulo}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="rodape-navegacao">
          <span className="ponto-status" aria-hidden="true" />
          <span>Pronto para integrar</span>
        </div>
      </aside>
    </>
  );
}

