# Validação remota — cards sem faixa lateral

O commit `c752f2c` foi publicado na branch `main` após a suíte do clone passar com **78/78 testes**.

A Visão Geral foi aberta no ambiente Development após o deploy. O shell continua único, com sidebar e header preservados. Os cards mantêm seus fundos escuros, bordas, espaçamentos, títulos, ícones, ações e estados vazios, sem as faixas coloridas na lateral esquerda.

A remoção foi aplicada ao pseudo-elemento dos módulos da Visão Geral e às bordas de prioridade dos cards de Pedidos e Fila da Cozinha. Linhas de árvore da navegação e outros ornamentos não foram afetados.
