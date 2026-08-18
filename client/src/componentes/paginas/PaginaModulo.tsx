/** APEX Food | Modelo reutilizável de páginas sem métricas ou registros artificiais. */
import { ArrowUpRight, ClipboardList, DatabaseZap, LayoutPanelTop, type LucideIcon } from "lucide-react";
import { EstadoVazio } from "@/componentes/interface/EstadoVazio";

type TipoModulo = "painel" | "lista" | "cadastro" | "mapa" | "relatorio" | "configuracao";

export type PaginaModuloProps = {
  secao: string;
  titulo: string;
  descricao: string;
  tipo: TipoModulo;
  icone?: LucideIcon;
  imagem?: string;
  orientacao: string;
};

const textosPorTipo: Record<TipoModulo, { rotulo: string; titulo: string; descricao: string; acao?: string }> = {
  painel: { rotulo: "Visão operacional", titulo: "Indicadores aguardando dados", descricao: "Conecte os dados operacionais do restaurante para visualizar esta leitura em tempo real." },
  lista: { rotulo: "Base de registros", titulo: "Nenhum registro encontrado", descricao: "Os registros desta área serão exibidos aqui quando uma fonte de dados for configurada.", acao: "Abrir configuração" },
  cadastro: { rotulo: "Área de cadastro", titulo: "Cadastro ainda não conectado", descricao: "Esta página está preparada para receber dados reais, mas o armazenamento ainda não foi configurado.", acao: "Configurar estrutura" },
  mapa: { rotulo: "Visão do ambiente", titulo: "Mapa do salão indisponível", descricao: "Adicione a estrutura física e os estados reais das mesas para montar esta visualização.", acao: "Configurar mesas" },
  relatorio: { rotulo: "Análise", titulo: "Ainda não há dados para análise", descricao: "Selecione uma fonte de dados válida para gerar indicadores e períodos comparáveis." },
  configuracao: { rotulo: "Parâmetros do sistema", titulo: "Nenhuma configuração aplicada", descricao: "Defina as informações estruturais da operação para habilitar esta área." },
};

function EsqueletoContexto({ tipo }: { tipo: TipoModulo }) {
  const cartoes = tipo === "painel" || tipo === "relatorio" ? 4 : 3;
  return (
    <div className={`grade-contexto grade-contexto--${tipo}`} aria-label="Área pronta para dados reais">
      {Array.from({ length: cartoes }).map((_, indice) => (
        <div className="cartao-contexto" key={indice}>
          <span>{tipo === "relatorio" ? "Métrica" : tipo === "mapa" ? "Zona" : "Indicador"}</span>
          <strong>—</strong>
          <small>Disponível após integração</small>
        </div>
      ))}
    </div>
  );
}

function SilhuetaOperacional({ tipo }: { tipo: TipoModulo }) {
  if (tipo === "mapa") {
    return <section className="silhueta-operacional silhueta-mapa" aria-label="Estrutura de zonas ainda sem configuração"><div className="cabecalho-silhueta"><span>Leitura espacial</span><em>Sem zonas configuradas</em></div><div className="zonas-vazias"><i /><i /><i /><i /><i /><i /></div></section>;
  }
  if (tipo === "lista") {
    return <section className="silhueta-operacional silhueta-lista" aria-label="Estrutura de lista sem registros"><div className="cabecalho-silhueta"><span>Registros da operação</span><em>0 itens</em></div><div className="linha-colunas"><i /><i /><i /></div><div className="linha-vazia"><span>Nenhum registro disponível</span></div></section>;
  }
  if (tipo === "cadastro" || tipo === "configuracao") {
    return <section className="silhueta-operacional silhueta-cadastro" aria-label="Estrutura de configuração sem dados"><div className="cabecalho-silhueta"><span>{tipo === "cadastro" ? "Dados do registro" : "Parâmetros da área"}</span><em>Aguardando configuração</em></div><div className="campos-vazios"><i /><i /><i /><i /></div></section>;
  }
  if (tipo === "relatorio") {
    return <section className="silhueta-operacional silhueta-relatorio" aria-label="Estrutura de análise sem dados"><div className="cabecalho-silhueta"><span>Série de análise</span><em>Sem série disponível</em></div><div className="eixos-relatorio"><i /><i /><i /><i /><i /></div></section>;
  }
  return <EsqueletoContexto tipo={tipo} />;
}

export function PaginaModulo({ secao, titulo, descricao, tipo, icone: Icone = ClipboardList, imagem, orientacao }: PaginaModuloProps) {
  const texto = textosPorTipo[tipo];
  return (
    <div className="pagina-modulo">
      <section className={`apresentacao-modulo ${imagem ? "apresentacao-modulo--imagem" : ""}`}>
        {imagem && <img src={imagem} alt="" aria-hidden="true" />}
        <div className="camada-apresentacao" />
        <div className="conteudo-apresentacao">
          <div className="selo-icone"><Icone size={19} strokeWidth={1.8} /></div>
          <p className="rotulo-secao">{secao}</p>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
        <div className="guia-apresentacao"><span>Área preparada</span><ArrowUpRight size={15} /></div>
      </section>

      <section className="painel-orientacao">
        <div className="flex gap-3 min-w-0">
          <DatabaseZap className="icone-orientacao" size={20} strokeWidth={1.7} />
          <div>
            <p className="rotulo-secao">Próximo passo</p>
            <p>{orientacao}</p>
          </div>
        </div>
        <span className="etiqueta-neutra"><LayoutPanelTop size={14} />Sem dados de demonstração</span>
      </section>

      <SilhuetaOperacional tipo={tipo} />
      <EstadoVazio titulo={texto.titulo} descricao={texto.descricao} acao={texto.acao ? { titulo: texto.acao, caminho: "/salao/configuracao" } : undefined} />
    </div>
  );
}
