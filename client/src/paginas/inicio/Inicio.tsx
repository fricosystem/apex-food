/** APEX Food | Página inicial com contexto operacional, sem indicadores simulados. */
import { ArrowRight, ChefHat, PlugZap } from "lucide-react";
import { Link } from "wouter";
import { EstadoVazio } from "@/componentes/interface/EstadoVazio";

export function Inicio() {
  return (
    <div className="inicio">
      <section className="inicio-heroi">
        <img src="/manus-storage/apex-food-operacao_6cbdf1e0.jpg" alt="" aria-hidden="true" />
        <div className="inicio-conteudo">
          <p className="rotulo-secao">Centro de operação</p>
          <h2>O serviço começa <span>antes</span> do primeiro pedido.</h2>
          <p>APEX Food organiza as áreas essenciais do restaurante em uma única operação. Conecte suas fontes de dados para acompanhar o serviço com contexto e rastreabilidade.</p>
          <Link href="/dashboards/operacional" className="inicio-acao">Abrir visão operacional <ArrowRight size={16} /></Link>
        </div>
      </section>
      <div className="inicio-quadros">
        <section className="quadro-inicio">
          <PlugZap size={20} color="#fb923c" strokeWidth={1.7} />
          <p className="rotulo-secao mt-4">Conexão necessária</p>
          <h3>A operação está pronta para receber dados reais.</h3>
          <p>Cadastros, pedidos, mesas, financeiro e relatórios permanecem sem registros até a integração da fonte oficial.</p>
        </section>
        <section className="quadro-inicio quadro-inicio--imagem">
          <img src="/manus-storage/apex-food-detalhe_5aecc26c.jpg" alt="" aria-hidden="true" />
          <div><ChefHat size={20} color="#fb923c" strokeWidth={1.7} /><p className="rotulo-secao mt-4">Ritmo de serviço</p><h3>Uma interface para decisões mais claras.</h3></div>
        </section>
      </div>
      <EstadoVazio titulo="Ainda não há eventos da operação" descricao="Quando os dados forem conectados, os acontecimentos relevantes do restaurante aparecerão neste espaço." />
    </div>
  );
}

