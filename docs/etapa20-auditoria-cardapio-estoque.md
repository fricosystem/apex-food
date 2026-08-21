# Etapa 20 — Auditoria de cardápio, produtos e estoque

## Objetivo

Garantir que o cardápio administrativo, o cardápio público aberto pelo QR e os pedidos utilizem dados reais do Firestore, com disponibilidade, preços e estoque validados no servidor no momento da operação.

## Constatações

| Área | Situação encontrada | Impacto |
| --- | --- | --- |
| Bridge administrativo | `scripts/cardapio/dados-cardapio.js` injeta um conjunto `previewCardapio` fictício em `localhost` | O preview local pode mascarar ausência de dados reais e contradiz a regra de não usar dados fictícios |
| Cache-busting | O bridge do cardápio ainda carrega `modulos-client.js?v=etapa6-caixa` | Pode carregar código antigo após uma publicação |
| Cardápio público | O endpoint público lê categorias e produtos reais, mas não exige `disponibilidade === true` nem estoque positivo para listar o produto | O cliente pode visualizar itens inativos ou esgotados |
| Pedido público | O preço é recalculado server-side, mas a transação não verifica quantidade em estoque nem baixa o estoque | Dois pedidos concorrentes podem consumir a mesma quantidade disponível |
| Pedido administrativo | O preço é recalculado server-side e a disponibilidade é verificada, mas o estoque não é validado nem baixado | Novo Pedido e QR possuem regras diferentes e podem ultrapassar o estoque |
| Movimentações | Entradas, saídas e ajustes já usam transação, validação de saldo e auditoria | A base administrativa pode ser preservada e reutilizada |
| Categorias e produtos | CRUD real já existe, com isolamento por restaurante e auditoria | A implementação deve ser incremental, sem recriar telas |
| Cardápio Digital | Configuração real de publicação e aceitação de pedidos já existe | A comanda pública deve respeitar `publicado` e `aceitarPedidos` |

## Regras definidas para a implementação

A baixa de estoque será feita dentro da mesma transação que cria o pedido. Para cada item, o servidor relerá o produto, confirmará existência, estado ativo, disponibilidade, preço inteiro válido e estoque suficiente. A quantidade será reservada e subtraída somente quando o pedido for persistido. Em caso de repetição idempotente, a transação já concluída será reutilizada sem nova baixa.

O cardápio público deverá listar apenas produtos ativos, pertencentes a categorias publicadas e disponíveis para venda. Produtos com disponibilidade desativada ou estoque igual a zero não serão oferecidos para inclusão no carrinho. A validação server-side continuará obrigatória, pois o frontend não é uma fronteira de segurança.

O pedido administrativo seguirá a mesma regra de estoque. A operação de movimentação manual continuará disponível para entrada, saída e ajuste, com auditoria e bloqueio de saldo negativo.

## Critérios de aceite

| Critério | Resultado esperado |
| --- | --- |
| Dados locais | Nenhuma tela injeta produtos, categorias, promoções ou estoque fictícios |
| Publicação | Cardápio público exige configuração publicada |
| Aceitação | Pedido público exige `aceitarPedidos === true` |
| Disponibilidade | Produto inativo, excluído ou esgotado não pode ser solicitado |
| Preço | Preço usado no pedido vem do Firestore no servidor |
| Estoque | Pedido baixa estoque na mesma transação da criação |
| Concorrência | Dois pedidos não conseguem consumir o mesmo saldo além do disponível |
| Idempotência | Repetição da mesma chave não duplica pedido nem baixa estoque novamente |
| Isolamento | Todas as leituras e escritas permanecem dentro do restaurante da sessão |
| Segurança | Nenhum segredo, token ou acesso direto ao Firestore é adicionado ao frontend |

## Restrições preservadas

A etapa não criará função em `api/v1`, manterá o endpoint consolidado existente, preservará o shell único, manterá os nomes das coleções em português e não adicionará processamento de pagamentos.
