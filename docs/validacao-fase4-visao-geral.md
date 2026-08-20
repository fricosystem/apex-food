# Validação da Fase 4 — Visão Geral real

A Visão Geral passou a consultar o agregador server-side `/api/v1/operacional?modulo=visao-geral`, limitado ao restaurante ativo da sessão. O endpoint valida o tipo de período, normaliza `inicio` e `fim`, limita o intervalo a 367 dias e calcula o calendário no fuso do restaurante, com fallback seguro para `America/Sao_Paulo`.

O frontend deixou de carregar os bridges de preview na rota Home. A rota carrega somente `scripts/home/dados-visao-geral.js` e `scripts/home/home.js`. A ponte utiliza o cliente same-origin com credenciais de sessão e dispara atualização da interface após a resposta do Firestore. Em erro ou ausência de dados, os módulos exibem estados vazios neutros, sem números, nomes de pedidos, gráficos ou percentuais fictícios.

As coleções lidas pelo agregador permanecem dentro de `restaurantes/{idRestaurante}`: pedidos, movimentações de caixa, fechamentos de caixa, mesas, reservas, produtos e categorias de cardápio, funcionários e avaliações. Produtos e categorias são sanitizados antes de serem enviados ao navegador.

A suíte local passou com **72/72 testes**. Foram incluídos testes de contrato para o registro do agregador, parâmetros de filtro, isolamento tenant-aware, ausência de bridges de preview e remoção dos principais valores fictícios do fragmento da Visão Geral.

A validação remota visual e a publicação ficam para a próxima fase do plano, após sincronização com o clone GitHub e deploy Development.
