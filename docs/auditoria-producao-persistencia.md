
## Estado após a falha de mesas

A leitura posterior confirmou que foram persistidos dez documentos com o prefixo `TESTE Persistencia 20260821` em `categoriasCardapio`, `produtosCardapio`, `promocoesCardapio` e `funcionarios`. Foi persistida apenas a mesa `TESTE Persistencia 20260821 Mesa 01`, com ID `mUVYsAF2TDicpfN4Uzr9`. Não foram encontradas ainda reservas, escalas, contas ou movimentações com o prefixo.

Os produtos receberam IDs e referências válidas às dez categorias, comprovando que a persistência tenant-aware e a sequência categoria → produto funcionaram. A regra de duplicidade de mesas precisa ser corrigida ou contornada antes de repetir as nove mesas restantes.

## Segunda carga autorizada

Após o deployment `a8be0dc`, as mesas 02 a 10 foram criadas com sucesso. Em seguida, foram criadas dez escalas e dez contas financeiras, sem falhas. As dez tentativas de movimentação financeira foram rejeitadas com `RECURSO_INVALIDO` e a mensagem `Mutação financeira inválida ou não disponível`, sem indicação de gravação parcial. O próximo diagnóstico deve alinhar o recurso usado pelo cliente ao handler Financeiro antes de repetir essas dez operações.

## Recarga consolidada após os ajustes

A carga financeira foi concluída: dez movimentações foram persistidas após o commit `581ae8a`. A leitura consolidada retornou dez categorias, dez produtos, dez promoções, dez mesas, dez escalas, dez funcionários, dez contas e dez movimentações TESTE. A Visão Geral declarou `fonte: firestore`, `dadosDisponiveis: true` e o restaurante ativo `3e20d5b9833ccfa5422d77f4`, com vendas de teste de 155,00 e resultado de 155,00.

A contagem de reservas TESTE retornou zero na listagem consolidada, embora a chamada de criação tenha ocorrido sem falhas aparentes no resumo truncado. Esse ponto precisa ser confirmado com uma consulta específica antes de considerar a carga completa. A Visão Geral também apresentou dez pedidos no indicador, embora não tenham sido criados pedidos nesta carga, indicando que o campo `pedidos` do agregador precisa ser interpretado e validado separadamente.

## Confirmação visual em produção

A rota `/produtos` foi aberta após a carga e exibiu dez produtos TESTE, dez produtos disponíveis, estoque baixo igual a zero e preço médio de R$ 42,40. O filtro de categorias foi preenchido com as dez categorias TESTE e os produtos mostraram IDs, preços, custos, preparo, estoque e disponibilidade retornados do backend. Isso confirma a persistência e a leitura visual do Cardápio em produção.

## Confirmação visual de Equipe e Salão

A rota `/funcionarios` exibiu dez funcionários TESTE, todos ativos, com cargos, setores, turnos e telefones mascarados. A rota `/mapa-mesas` exibiu dez mesas disponíveis e dez reservas confirmadas, relacionando cada mesa ao cliente TESTE e ao horário futuro correspondente. O indicador visual mostrou 10 mesas disponíveis, 0 ocupadas, 0 indisponíveis e 10 reservas confirmadas.

A listagem específica de reservas também confirmou os dez documentos com IDs e timestamps válidos. O zero observado na contagem anterior veio do filtro usado no teste, que procurava `nome` em vez de `nomeCliente` para essa coleção; não houve falha de persistência de reservas.

## Confirmação visual financeira

A rota `/contas-pagar-receber` exibiu dez títulos TESTE, sendo cinco a pagar no total de R$ 1.515,00 e cinco a receber no total de R$ 4.040,00. A rota `/fluxo-caixa` exibiu dez movimentações TESTE, total de entradas de R$ 155,00, total de saídas de R$ 0,00, resultado líquido de R$ 155,00 e margem operacional de 100%.

## Correção e validação do Dashboard

O commit `0506222` corrigiu a agregação da Visão Geral. Após o deployment, a consulta de produção retornou R$ 155,00 em vendas e resultado, mas `pedidos: 0`, `ticketMedio: 0`, `picoAlmoco: '—'` e `picoJantar: '—'`, porque as dez movimentações financeiras manuais não são pedidos operacionais. O canal TESTE aparece com 100% das vendas e zero pedidos, que é a distinção correta para esse conjunto de teste.
