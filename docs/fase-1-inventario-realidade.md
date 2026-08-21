# Fase 1 — Inventário de realidade funcional

Este inventário foi gerado a partir dos arquivos atuais do workspace, sem executar mutações no Firestore e sem criar dados de demonstração. Ele será a base para a Fase 2 e para a integração incremental por módulo.

## Resumo quantitativo

| Indicador | Quantidade |
|---|---:|
| Rotas registradas no shell | 27 |
| Fragmentos HTML em `paginas/` | 29 |
| Scripts JavaScript em `scripts/` | 43 |
| Rotas que carregam algum endpoint ou cliente de API | 22 |
| Rotas com sinais de preview/fallback/dados locais | 27 |

## Matriz por rota

| Rota pública | Página | Fragmento | Controles | Scripts | API/endpoints | Achados de realidade |
|---|---|---|---:|---:|---|---|
| `/` | Visão Geral | `paginas/home.html` | 33 | 8 | `cliente compartilhado (/api/v1)` | preview explícito (8); fallback remoto (22); salvamento apenas preview (1); integração futura (1); aviso sem persistência aparente (1); dados globais locais (48) |
| `/novo-pedido` | Novo Pedido | `paginas/pedidos/novo-pedido.html` | 12 | 2 | Nenhum endpoint identificado | aviso sem persistência aparente (3); dados globais locais (3) |
| `/pedidos-ativos` | Pedidos Ativos | `paginas/pedidos/pedidos-ativos.html` | 5 | 2 | Nenhum endpoint identificado | aviso sem persistência aparente (2); dados globais locais (3) |
| `/historico-pedidos` | Histórico de Pedidos | `paginas/pedidos/historico-pedidos.html` | 6 | 2 | Nenhum endpoint identificado | aviso sem persistência aparente (1); dados globais locais (3) |
| `/fila-cozinha` | Fila da Cozinha | `paginas/pedidos/fila-cozinha.html` | 6 | 2 | Nenhum endpoint identificado | aviso sem persistência aparente (3); dados globais locais (3) |
| `/operacional` | Operacional | `paginas/operacional/operacional.html` | 2 | 2 | Nenhum endpoint identificado | aviso sem persistência aparente (3); dados globais locais (2) |
| `/dashboard-financeiro` | Dashboard Financeiro | `paginas/financeiro/dashboard-financeiro.html` | 0 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (2); fallback remoto (6); dados globais locais (10) |
| `/dashboard-desempenho` | Dashboard de Desempenho | `paginas/desempenho/dashboard-desempenho.html` | 0 | 4 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (4); dados globais locais (20) |
| `/categorias` | Categorias | `paginas/cardapio/categorias.html` | 8 | 3 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (5); salvamento apenas preview (1); integração futura (1); aviso sem persistência aparente (4); dados globais locais (9) |
| `/produtos` | Produtos | `paginas/cardapio/produtos.html` | 14 | 3 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (7); salvamento apenas preview (1); integração futura (1); aviso sem persistência aparente (7); dados globais locais (10) |
| `/promocoes` | Promoções | `paginas/cardapio/promocoes.html` | 11 | 3 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (4); salvamento apenas preview (1); integração futura (1); aviso sem persistência aparente (3); dados globais locais (9) |
| `/cardapio-digital` | Cardápio Digital | `paginas/cardapio/cardapio-digital.html` | 9 | 3 | `cliente compartilhado (/api/v1)` | preview explícito (19); fallback remoto (4); salvamento apenas preview (2); integração futura (1); aviso sem persistência aparente (3); dados globais locais (10) |
| `/mapa-mesas` | Mapa de Mesas | `paginas/salao/mapa-mesas.html` | 3 | 2 | `cliente compartilhado (/api/v1)` | fallback remoto (4); dados globais locais (8) |
| `/reservas` | Reservas | `paginas/salao/reservas.html` | 17 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (1); fallback remoto (5); salvamento apenas preview (1); aviso sem persistência aparente (7); dados globais locais (8) |
| `/configuracao-mesas` | Configuração de Mesas | `paginas/salao/configuracao-mesas.html` | 12 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (2); fallback remoto (5); salvamento apenas preview (2); integração futura (1); aviso sem persistência aparente (5); dados globais locais (8) |
| `/funcionarios` | Funcionários | `paginas/equipe/funcionarios.html` | 14 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (5); salvamento apenas preview (1); aviso sem persistência aparente (5); dados globais locais (8) |
| `/escala-trabalho` | Escala de Trabalho | `paginas/equipe/escala-trabalho.html` | 15 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (5); salvamento apenas preview (1); aviso sem persistência aparente (3); dados globais locais (8) |
| `/comissoes` | Comissões | `paginas/equipe/comissoes.html` | 4 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (5); salvamento apenas preview (1); aviso sem persistência aparente (3); dados globais locais (10) |
| `/fechamento-caixa` | Fechamento de Caixa | `paginas/financeiro/fechamento-caixa.html` | 6 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (2); fallback remoto (7); integração futura (1); aviso sem persistência aparente (5); dados globais locais (7) |
| `/fluxo-caixa` | Fluxo de Caixa | `paginas/financeiro/fluxo-caixa.html` | 13 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (4); fallback remoto (7); salvamento apenas preview (2); aviso sem persistência aparente (4); dados globais locais (8) |
| `/contas-pagar-receber` | Contas a Pagar/Receber | `paginas/financeiro/contas-pagar-receber.html` | 13 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (7); salvamento apenas preview (1); aviso sem persistência aparente (3); dados globais locais (7) |
| `/relatorios-financeiros` | Relatórios Financeiros | `paginas/financeiro/relatorios-financeiros.html` | 3 | 2 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (6); salvamento apenas preview (1); aviso sem persistência aparente (3); dados globais locais (10) |
| `/vendas-por-periodo` | Vendas por Período | `paginas/relatorios/vendas-por-periodo.html` | 4 | 4 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (4); aviso sem persistência aparente (1); dados globais locais (15) |
| `/produtos-mais-vendidos` | Produtos Mais Vendidos | `paginas/relatorios/produtos-mais-vendidos.html` | 3 | 4 | `cliente compartilhado (/api/v1)` | preview explícito (4); fallback remoto (4); salvamento apenas preview (1); aviso sem persistência aparente (1); dados globais locais (15) |
| `/horarios-de-pico` | Horários de Pico | `paginas/relatorios/horarios-de-pico.html` | 3 | 4 | `cliente compartilhado (/api/v1)` | preview explícito (4); fallback remoto (4); salvamento apenas preview (1); aviso sem persistência aparente (1); dados globais locais (15) |
| `/avaliacoes-clientes` | Avaliações dos Clientes | `paginas/relatorios/avaliacoes-clientes.html` | 4 | 4 | `cliente compartilhado (/api/v1)` | preview explícito (3); fallback remoto (4); aviso sem persistência aparente (1); dados globais locais (15) |
| `/performance-equipe` | Performance da Equipe | `paginas/relatorios/performance-equipe.html` | 3 | 3 | `cliente compartilhado (/api/v1)` | preview explícito (4); fallback remoto (4); salvamento apenas preview (1); aviso sem persistência aparente (1); dados globais locais (14) |

## Controles por página

A coluna **referenciado por script** é uma triagem textual: um controle pode ser tratado por delegação, seletor de classe ou inicialização compartilhada e, por isso, será confirmado manualmente durante a implementação de cada módulo.

| Página | Controles identificados | Referenciado por algum script associado | Possíveis órfãos para validação |
|---|---:|---:|---|
| Visão Geral | 33 | 3 | Nenhum identificado na triagem |
| Novo Pedido | 12 | 6 | `clienteMesa`, `garcomSelecionado`, `telefoneDelivery`, `enderecoDelivery` |
| Pedidos Ativos | 5 | 5 | Nenhum identificado na triagem |
| Histórico de Pedidos | 6 | 6 | Nenhum identificado na triagem |
| Fila da Cozinha | 6 | 6 | Nenhum identificado na triagem |
| Operacional | 2 | 2 | Nenhum identificado na triagem |
| Dashboard Financeiro | 0 | 0 | Nenhum identificado na triagem |
| Dashboard de Desempenho | 0 | 0 | Nenhum identificado na triagem |
| Categorias | 8 | 7 | Nenhum identificado na triagem |
| Produtos | 14 | 13 | Nenhum identificado na triagem |
| Promoções | 11 | 7 | `descricaoPromocao` |
| Cardápio Digital | 9 | 3 | Nenhum identificado na triagem |
| Mapa de Mesas | 3 | 3 | Nenhum identificado na triagem |
| Reservas | 17 | 15 | `canalReserva` |
| Configuração de Mesas | 12 | 10 | `areaMesaConfig` |
| Funcionários | 14 | 13 | Nenhum identificado na triagem |
| Escala de Trabalho | 15 | 14 | Nenhum identificado na triagem |
| Comissões | 4 | 4 | Nenhum identificado na triagem |
| Fechamento de Caixa | 6 | 6 | Nenhum identificado na triagem |
| Fluxo de Caixa | 13 | 12 | Nenhum identificado na triagem |
| Contas a Pagar/Receber | 13 | 12 | Nenhum identificado na triagem |
| Relatórios Financeiros | 3 | 3 | Nenhum identificado na triagem |
| Vendas por Período | 4 | 4 | Nenhum identificado na triagem |
| Produtos Mais Vendidos | 3 | 3 | Nenhum identificado na triagem |
| Horários de Pico | 3 | 3 | Nenhum identificado na triagem |
| Avaliações dos Clientes | 4 | 4 | Nenhum identificado na triagem |
| Performance da Equipe | 3 | 3 | Nenhum identificado na triagem |

## Achados críticos

| Prioridade | Achado | Evidência | Impacto | Fase de correção prevista |
|---|---|---|---|---|
| Alta | Há dados locais de fallback em módulos operacionais | `dados-pedidos.js`, `dados-mesas.js`, `dados-reservas.js`, `dados-cardapio.js` e `dados-equipe.js` mantêm estruturas `preview` ou arrays globais antes da tentativa remota | A página pode parecer funcional sem representar dados do restaurante | Fases 3 a 10 |
| Alta | Algumas mutações exibem “salvo no preview” quando o cliente/API remoto não está ativo | Scripts de categorias, produtos, promoções, funcionários, escalas e reservas possuem ramo de fallback visual | A interface confirma uma operação que não foi persistida | Fase 10, após contratos reais |
| Alta | Existem ações explicitamente preparadas para integração futura | Sidebar e ações de edição de categoria, produto e promoção usam mensagens de “próxima integração” | Botões aparentam funcionar, mas não executam uma operação real | Fase 10 |
| Alta | Pedidos ativos, cozinha e operacional alteram estado em memória | Os scripts avançam status diretamente em objetos locais e exibem aviso | O status pode desaparecer ao recarregar e não chega ao Firestore | Fase 6 |
| Alta | Cardápio Digital confirma publicação, cópia de link e download sem confirmação de persistência | Handlers atuais exibem avisos de sucesso diretamente | O usuário não tem garantia de publicação ou arquivo realmente gerado | Fase 5 e Fase 10 |
| Média | Indicadores contêm valores iniciais hard-coded | `home.html` contém “72 pedidos” e `fechamento-caixa.html` contém “72 pedidos registrados” | Métricas fictícias aparecem antes de uma resposta real | Fases 4 e 9 |
| Média | Algumas páginas de dashboard não possuem controles HTML próprios | Dashboards Financeiro e Desempenho dependem de scripts e componentes dinâmicos | A cobertura de eventos precisa ser validada no DOM renderizado | Fases 4, 9 e 11 |
| Média | Arquivo standalone legado do Mapa de Mesas permanece como cópia interna | `paginas/salao/mapa-mesas-legado.html` | Deve permanecer fora da navegação pública para não duplicar a fonte do shell | Fase 7 e documentação |

## Classificação inicial por domínio

| Domínio | Rotas cobertas | Situação inicial | Próxima dependência |
|---|---|---|---|
| Autenticação | `/autenticacao` | Integração server-side existente; precisa ser ligada ao restaurante ativo e permissões | Fase 3 |
| Visão Geral | `/` | Métricas e gráficos dependem de dados globais e valores iniciais | Fase 4 |
| Pedidos | `/novo-pedido`, `/pedidos-ativos`, `/historico-pedidos`, `/fila-cozinha` | Estruturas locais e transições em memória; contratos operacionais ainda precisam ser aplicados à UI | Fase 6 |
| Cardápio | `/categorias`, `/produtos`, `/promocoes`, `/cardapio-digital` | Há cliente operacional parcial, mas existem fallbacks, edições e publicação apenas visuais | Fase 5 |
| Salão | `/mapa-mesas`, `/reservas`, `/configuracao-mesas` | Há carregamento remoto parcial e mutações condicionais; requer fonte única e estados de erro consistentes | Fase 7 |
| Equipe | `/funcionarios`, `/escala-trabalho`, `/comissoes` | Há cliente operacional parcial e fallback de preview; métricas e cálculos ainda precisam de fonte real | Fase 8 |
| Financeiro | `/dashboard-financeiro`, `/fechamento-caixa`, `/fluxo-caixa`, `/contas-pagar-receber`, `/relatorios-financeiros` | API existe para parte do domínio, mas telas e indicadores ainda precisam de contratos e persistência uniforme | Fase 9 |
| Relatórios | `/vendas-por-periodo`, `/produtos-mais-vendidos`, `/horarios-de-pico`, `/avaliacoes-clientes`, `/performance-equipe` | Dependem de dados agregados e filtros de período; devem deixar de derivar de fixtures locais | Fase 4 e Fase 11 |

## Decisões de implementação derivadas do inventário

Primeiro será consolidado o contrato do Firestore e da API, porque conectar telas diretamente aos arrays atuais perpetuaria divergências entre módulos. Os dados de preview serão convertidos em estados vazios controlados ou fixtures exclusivas de teste, nunca em fallback apresentado como registro do restaurante.

As mutações deverão retornar o registro persistido ou um identificador de operação. A interface atualizará a fonte local somente após resposta de sucesso, ou fará rollback visual explícito em caso de falha. Avisos de sucesso serão reservados para operações realmente confirmadas pelo backend.

A Fase 2 deverá transformar este inventário em contratos formais de coleção, campos, enums, endpoints, permissões, paginação, filtros e auditoria. Depois da aprovação do usuário, a implementação seguirá por domínio, começando pela autenticação e pelo restaurante ativo.

## Critério de conclusão da Fase 1

A Fase 1 está concluída quando todas as rotas foram classificadas, os 29 fragmentos físicos foram contabilizados, os 43 scripts JavaScript foram relacionados, os controles foram quantificados, os sinais de preview e dados fictícios foram registrados e cada achado recebeu uma fase de correção. O inventário não realiza mutações e não altera o layout ou o comportamento do sistema.
