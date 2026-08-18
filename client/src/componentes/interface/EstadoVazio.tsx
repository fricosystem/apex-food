/** APEX Food | Estado vazio honesto: orienta integração sem criar registros fictícios. */
import { DatabaseZap, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

type EstadoVazioProps = {
  titulo: string;
  descricao: string;
  icone?: LucideIcon;
  acao?: { titulo: string; caminho: string };
};

export function EstadoVazio({ titulo, descricao, icone: Icone = DatabaseZap, acao }: EstadoVazioProps) {
  return (
    <section className="painel-vazio" aria-live="polite">
      <div className="icone-vazio" aria-hidden="true"><Icone size={22} strokeWidth={1.7} /></div>
      <div className="max-w-md">
        <p className="rotulo-secao">Sem registros conectados</p>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
        {acao && (
          <Link href={acao.caminho} className="acao-secundaria mt-5 inline-flex">
            {acao.titulo}
          </Link>
        )}
      </div>
    </section>
  );
}

