# Fase 5 — Validação de Cardápio e Estoque

A implementação foi concluída de forma incremental sobre o shell e os fragmentos existentes.

| Área | Resultado |
|---|---|
| Categorias | Listagem real, criação e edição pelo endpoint seguro de Cardápio |
| Produtos | Listagem real, criação, edição, busca, filtros, disponibilidade, custo, estoque, unidade e tempo de preparo |
| Promoções | Listagem real, filtro, ordenação, criação e edição; estados `ativa`, `agendada` e `inativa` preservados |
| Estoque | Entrada, saída e ajuste transacionais sobre `produtosCardapio`, com registros em `movimentacoesEstoque` e auditoria |
| Estado vazio | Development não inicia com dados de preview; telas aguardam ou exibem somente dados reais |
| Segurança | Cliente same-origin com CSRF e sessão HttpOnly; nenhum Firebase Admin ou segredo no frontend |
| Coleções | `categoriasCardapio`, `produtosCardapio`, `promocoesCardapio` e `movimentacoesEstoque` dentro do restaurante ativo |
| Testes | **83/83 aprovados** |

A interface manteve o layout, o shell, o header, a sidebar, os estilos e a responsividade existentes. Os KPIs fictícios de Promoções foram substituídos por valores derivados dos dados carregados ou por `—` quando não há registros reais.
