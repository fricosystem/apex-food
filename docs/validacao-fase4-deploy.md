# Validação remota da Fase 4

O commit `26c9487` foi publicado na branch `main` após a suíte do clone passar com 72/72 testes.

Após o login da conta de teste, a Visão Geral abriu em `https://apexfood.vercel.app/` com **uma única sidebar e um único header**. A correção da duplicação do shell está confirmada visualmente.

A tela passou a mostrar o estado vazio real do restaurante recém-criado: não há pedidos, movimentações, reservas, avaliações, produtos ou equipe persistidos no período. Não foram exibidos os nomes, valores, gráficos ou pedidos de preview removidos. O agregador retornou `fonte: firestore` e a interface exibiu mensagens orientativas de ausência de dados.

Foi observado que alguns indicadores derivados ainda aparecem como zero (`0,0 / 5`, `0% ocupado` e `R$ 0,00`) mesmo com coleções vazias. Esses zeros representam cálculos sobre conjuntos vazios, mas serão refinados para o marcador neutro `—` antes de considerar a etapa visual totalmente encerrada, mantendo o princípio de estados vazios explícitos.
