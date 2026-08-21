
## Preview inicial

A Visão Geral carregou dentro do shell único no servidor local, mas o carregamento real da API local retornou erro de consulta, como esperado quando as funções `/api/v1/` não estão sendo executadas pelo servidor estático. A primeira tentativa de hidratação controlada retornou `false`; esse resultado foi registrado como limitação do preview local e será investigado antes da validação final, sem gravar dados reais ou modificar o Firestore.

O console confirmou que a primeira forma de mock foi rejeitada por `SyntaxError` do próprio executor local devido ao uso de múltiplas instruções; a segunda expressão retornou `false` durante a atualização. Não houve indicação de falha no endpoint publicado. A validação visual continuará usando o servidor local apenas como verificação estrutural, e a confirmação dos dados reais será feita em produção com sessão autenticada.

## Validação autenticada em produção

Após o login em produção, a sessão foi reconhecida pelo shell, exibindo o nome `Bruno Moreira de Assis`, o email da conta e o restaurante ativo. A Visão Geral respondeu com o período `21/08/2026`, exibiu o horário real de atualização e manteve os três indicadores em `Sem comparação` porque não existe base anterior nem registro de venda no intervalo do dia. O estado vazio foi profissional e explícito: não há registros reais para o intervalo, sem dados fictícios.

A rota permaneceu dentro do shell único, os filtros de período e canal ficaram disponíveis e o status da base apareceu no bloco de Visão Consolidada. Nenhuma mutação foi executada.

No ambiente autenticado, o filtro Mês foi aplicado corretamente e exibiu `01/08/2026 a 21/08/2026`. A consulta de leitura à API retornou HTTP 200, `fonte: firestore`, `temRestaurante: true`, período anterior calculado no backend e os indicadores reais `pedidos: 0` e `vendasCentavos: 0`. A ausência de comparação foi correta porque não existe base anterior não nula. Nenhum registro individual foi exposto no diagnóstico e nenhuma mutação foi executada.

O filtro Delivery foi aplicado em produção e confirmado no DOM com `aria-pressed=true`, mantendo a rota limpa `/` e o período Mês ativo. O status de atualização permaneceu visível e a Visão Geral não executou mutações. Como a conta atualmente não possui registros no intervalo consultado, os cards permaneceram em estado vazio real, sem percentuais inventados.
