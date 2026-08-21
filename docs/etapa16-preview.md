# Preview da Etapa 16 — Visão Geral

## Escopo do preview

A validação visual foi feita na raiz do shell único (`http://127.0.0.1:4173/`) com dados temporários aplicados somente em memória do navegador. Nenhuma coleção do Firestore foi alterada e nenhum dado de preview foi incorporado ao código de produção.

## Resultado observado

A raiz respondeu HTTP 200 e entregou `apex-shell.js?v=etapa16-visao`. O shell manteve um único sidebar, um único cabeçalho e o conteúdo da Visão Geral carregado no body. A tela inicial apresentou o estado seguro sem autenticação local: os dados reais ficaram indisponíveis no preview estático porque as funções Serverless não são executadas pelo servidor local.

Após a hidratação temporária controlada, foram conferidos os indicadores de faturamento, ticket médio e pedidos, o resumo dos módulos, alertas, reservas, ritmo de atendimento, gráfico de vendas, gráfico financeiro, mapa de mesas, rankings, avaliações, busca e tabela de pedidos. Os valores exibidos foram coerentes com a resposta temporária usada exclusivamente para inspeção visual.

## Controles conferidos

| Controle | Comportamento previsto |
| --- | --- |
| Dia, Semana, Mês, Ano e Personalizado | Consulta o agregador server-side com o período escolhido |
| Restaurante, Delivery e Total | Filtra a série real por canal sem usar valores fixos |
| Alternar gráfico | Alterna entre barras e lista resumida |
| Atualizar | Reconsulta a Visão Geral e exibe estado de carregamento no botão |
| Livres/Ocupadas | Alterna o conjunto de mesas exibido no card |
| Nova Mesa | Navega para Configuração de Mesas pelo shell |
| Novo Pedido e Ver Todos | Navegam para os módulos correspondentes |
| Busca | Filtra pedidos reais por ID, mesa, cliente, canal ou status |
| Filtro de pedidos | Alterna Todos, Novos, Em preparo e Prontos |
| Exportar | Gera CSV no navegador a partir dos registros já retornados pela API |
| Imprimir | Abre a impressão nativa do navegador |

## Limitação do preview local

O servidor estático local não executa `/api/v1/operacional`; portanto, o carregamento inicial apresentou o estado de indisponibilidade da API local. Esse comportamento não representa a produção. A confirmação final deverá ser feita após o deployment na Vercel com uma sessão autenticada, verificando que o endpoint consolidado retorna os dados reais do restaurante ativo.

## Interação validada no navegador

O botão **Delivery** foi acionado no preview controlado. A Visão Geral passou a exibir **R$ 595,00** e **4 pedidos**, enquanto o bloco de operação mostrou somente o pedido de delivery em preparo. Isso confirma que a seleção atua sobre a série por canal e sobre os pedidos exibidos no resumo, sem navegação externa ou duplicação do shell.

O screenshot da interação mostra também o novo botão de alternância do gráfico, atualização, filtro de mesas, busca, exportação e impressão no layout desktop.

## Hidratação dinâmica corrigida

Após recarregar a página com o controller atualizado e aplicar a resposta temporária controlada, o preview confirmou `4 mesas`, uma reserva de Mariana Costa na Mesa 3 e `1` pedido ativo. Isso valida que mesas e reservas agora são lidas dinamicamente após a resposta do agregador, em vez de permanecerem presas ao estado vazio inicial.

## Controles visuais adicionais

O botão de gráfico alternou corretamente para uma lista resumida, preservando o valor de vendas e a quantidade de pedidos do canal selecionado. Em seguida, o botão do card de mesas alternou o título para **Mesas Ocupadas**, alterou o rótulo para **Livres** e exibiu os indicadores visuais das mesas ocupadas.

## Verificação pós-deployment

O commit `58252b4` foi publicado com status `success` pela Vercel. Em produção, a raiz respondeu HTTP 200, a rota `/configuracoes-perfil` respondeu HTTP 200 e o acesso sem cookie de sessão redirecionou corretamente para `/autenticacao`. A API `/api/v1/operacional?modulo=visao-geral&periodo=dia` respondeu HTTP 401 com `NAO_AUTENTICADO`, sem revelar dados do restaurante.

A verificação autenticada dos agregados depende de uma sessão válida no navegador de produção. Não foi executada nenhuma mutação em produção durante a validação.
