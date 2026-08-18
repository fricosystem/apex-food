/** APEX Food | Estado de rota inexistente com retorno seguro ao centro do sistema. */
import { Link } from "wouter";
export function NaoEncontrada() { return <section className="pagina-nao-encontrada"><div><p className="rotulo-secao">Rota indisponível</p><h2>404</h2><p>Esta página não faz parte da operação atual.</p><Link href="/" className="acao-secundaria mt-5">Voltar para a visão geral</Link></div></section>; }

