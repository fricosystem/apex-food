# Validação — cards sem faixa lateral

A auditoria encontrou três grupos de destaque lateral colorido: as faixas dos módulos da Visão Geral (`.home-modulo::before`), as bordas de prioridade dos cards de Pedidos e as bordas de prioridade dos cards da Fila da Cozinha.

A alteração foi limitada a esses grupos. A Visão Geral agora oculta o pseudo-elemento da faixa. Pedidos e Fila da Cozinha mantêm uma borda lateral transparente de 3px, preservando a largura dos cards e evitando deslocamento do conteúdo entre estados.

As linhas verticais da árvore de navegação em Pedidos e Mapa de Mesas, as bordas de hover, os contornos de foco e os ornamentos da autenticação não foram alterados, pois não são faixas laterais de cards.

A suíte local passou com **78/78 testes**.
