# Padrões de expansão — Fase 1

## Princípio principal

As próximas páginas devem ser implementadas por adição. Nenhum arquivo existente deve ser refeito ou substituído sem autorização explícita. A primeira versão de cada nova tela deve preservar a navegação lateral, os espaçamentos, os tokens de cor, a tipografia e a hierarquia visual já utilizadas no APEX Food.

## Organização de arquivos

Cada módulo deve usar pastas em português e nomes descritivos:

| Módulo | Pasta sugerida |
|---|---|
| Pedidos | `paginas/pedidos/` |
| Cardápio | `paginas/cardapio/` |
| Salão | `paginas/salao/` |
| Equipe | `paginas/equipe/` |
| Financeiro | `paginas/financeiro/` |
| Relatórios | `paginas/relatorios/` |
| Scripts compartilhados | `scripts/compartilhados/` |
| Estilos compartilhados | `estilos/compartilhados/` |
| Configurações | `configuracoes/` |

## Reutilização segura

Os novos utilitários foram adicionados sem substituir as funções locais do dashboard ou da página legada. A migração para a base compartilhada deve ocorrer somente em novas páginas ou durante uma revisão controlada, sempre com comparação visual antes e depois.

## Rotas

As rotas futuras devem ser registradas em `configuracoes/rotas-sistema.js`. O registro central não força alterações nas páginas atuais; ele serve como referência para as novas telas e reduz erros de caminho relativo.

## Interface

Os tokens de cor presentes em `estilos/compartilhados/tokens-apex.css` reproduzem os valores já utilizados pelo sistema. Não devem ser usados para introduzir uma nova paleta. Qualquer novo componente deve utilizar os tokens existentes e seguir a mesma escala de espaçamento, bordas, contraste e estados de interação.

## Critérios de produção

Cada nova página deverá carregar sem erros, funcionar em desktop e mobile, ter rota de retorno ao dashboard, manter o menu lateral, apresentar estados vazio e de carregamento quando necessário, validar ações de modal e filtro e ser conferida no console do navegador antes da entrega.
