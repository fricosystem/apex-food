
## Preview — Pedidos Ativos

A rota limpa `/pedidos-ativos` carregou pelo shell único no preview local. A tela exibiu as colunas **Aguardando confirmação**, **Confirmados**, **Na fila da cozinha**, **Em preparo**, **Prontos** e **Servidos**, com contagens, busca, filtro de canal e cards de pedidos.

O estado visual confirmou que pedidos aguardando confirmação aparecem com mesa, cliente, garçom, horário, valor, quantidade de itens e prioridade. A descrição da coluna informa que o pedido pode ter origem na comanda pública por QR ou no fluxo legado. Não foi executada nenhuma mutação durante o preview.

## Preview — Fila da Cozinha e Fechamento de Caixa

A rota limpa `/fila-cozinha` carregou pelo shell único com as colunas **Aguardando preparo**, **Em preparo** e **Prontos**. A tela exibiu busca, filtro de prioridade, contadores de fila, preparo, atrasos e tempo médio, além das ações **Iniciar preparo** e **Marcar como pronto**. Pedidos em `pronto` permaneceram sem ação de cozinha e identificados como aguardando o garçom servir.

A rota limpa `/fechamento-caixa` carregou pelo shell único com o resumo do caixa, filtros de encaminhamentos e atualização da fila. O estado vazio exibiu `Nenhuma comanda encaminhada` e a orientação de que comandas concluídas pelo garçom aparecerão na fila. A tela declarou de forma explícita: **O sistema não processa pagamentos**. Nenhuma mutação foi executada durante o preview.
