# Auditoria global — dados reais em todas as telas de gestão

## Objetivo ampliado

O APEX Food deverá operar com dados reais do Firestore em todas as telas de gestão, incluindo a Visão Geral, sem fixtures, números demonstrativos, nomes fictícios ou cálculos que contradigam os registros persistidos. A estrutura do shell único, o layout existente e as rotas limpas serão preservados.

## Matriz atual

| Módulo | Leitura atual | Persistência atual | Situação identificada | Próxima ação |
|---|---|---|---|---|
| Cardápio | `/api/v1/cardapio` | Produtos, categorias, promoções e estoque já usam operações reais | Bridge inicia vazio e carrega Firestore; não foi encontrado preview local ativo | Preservar como referência e alinhar polling, estados e contratos globais. |
| Pedidos | `/api/v1/pedidos`, Cardápio, Salão e Equipe | Criação, status, estoque e histórico já passam pelo backend | `scripts/pedidos/dados-pedidos.js` injeta pedidos, produtos e categorias fictícios em `localhost` e impede a leitura remota nesse ambiente | Remover o bloco de preview, iniciar vazio e alimentar a tela somente após resposta real. |
| Salão | `/api/v1/salao` | Mesas, reservas, QR, comandas e participantes já usam Firestore | Bridges de mesas e reservas já iniciam vazios e consultam o backend | Preservar e compartilhar o mesmo padrão de atualização com os demais módulos. |
| Equipe | `/api/v1/equipe` | Funcionários e escalas gravam no backend; comissões são somente leitura | `scripts/equipe/dados-equipe.js` ainda contém funcionários, escalas e comissões fictícios em `localhost` | Remover fixtures, conectar as telas a respostas reais e manter comissões somente leitura. |
| Financeiro | `/api/v1/financeiro` | Caixa, movimentações, contas, relatórios e fila do caixa já têm operações reais | `scripts/financeiro/dados-financeiros.js` injeta caixa, fluxo, contas e relatórios fictícios em `localhost` | Remover preview e manter estado vazio até o Firestore responder. |
| Visão Geral | `/api/v1/operacional?modulo=visao-geral` | Agregação server-side de pedidos, caixa, salão, cardápio, equipe e avaliações | O agregador já lê coleções reais e informa `meta.fonte: firestore` | Tornar a Visão Geral a fonte consolidada para seus indicadores, sem duplicar números locais. |
| Relatórios | Pedidos, Cardápio, Equipe e Financeiro | Consultas reais, somente leitura | `scripts/relatorios/dados-relatorios.js` recalcula séries no navegador e deixa avaliações e picos incompletos, podendo divergir da Visão Geral | Alinhar relatórios ao agregador server-side ou a contratos equivalentes, mantendo exportações. |

## Coleções reais já identificadas

O agregador da Visão Geral consulta `pedidos`, `movimentacoesCaixa`, `fechamentosCaixa`, `relatoriosFinanceiros`, `mesas`, `reservas`, `produtosCardapio`, `categoriasCardapio`, `funcionarios` e `avaliacoes` dentro do restaurante ativo. Os fluxos públicos e operacionais também usam `comandas`, `participantes`, `sessoesMesa`, `eventosMesas`, `promocoesCardapio`, `dadosPrivadosFuncionarios`, `encaminhamentosCaixa` e coleções de idempotência quando aplicável.

Todas as gravações devem continuar passando pelos handlers existentes, com sessão HttpOnly, contexto de restaurante, CSRF, origem autorizada, App Check conforme ambiente, validação de payload, transação quando necessária, auditoria e notificações operacionais. O frontend não deve receber credenciais, tokens, dados privados ou decidir permissões.

## Falsos positivos que não serão removidos

Textos como `Mesa 01` no formulário público, mensagens de estado vazio, valores iniciais `R$ 0,00`, opções de formulário e rótulos de status não são dados de negócio fictícios; são componentes de interface ou valores neutros. Eles permanecerão somente quando não representarem registros persistidos.

## Ordem de implementação

A primeira consolidação removerá fixtures de Financeiro, Pedidos e Equipe, porque esses bridges podem mascarar a ausência de dados reais. Em seguida, os controladores serão ajustados para gravar e recarregar as coleções reais sem atualizar a interface com valores locais. Depois, os Relatórios serão alinhados com a agregação server-side da Visão Geral, reduzindo divergências entre telas. Por fim, contratos automatizados verificarão que nenhum módulo injeta dados fictícios e que a Visão Geral recebe apenas respostas com `meta.fonte: firestore`.

## Limites preservados

Nenhum arquivo novo será criado em `api/v1`; a rota consolidada existente continuará sendo reutilizada. A quantidade atual de funções serverless permanece quatro. Também não serão adicionados Firebase client, localStorage, sessionStorage, segredos ou chaves privadas ao frontend.
