# Diagnóstico da Fase 6 — Pedidos e Cozinha

A Fase 6 será implementada sobre o shell único e os fragmentos existentes, sem criar navegação paralela.

| Fluxo | Estado encontrado | Correção necessária |
|---|---|---|
| Novo Pedido | Catálogo, mesas, garçons e produtos estão hard-coded em `dados-pedidos.js` e no HTML; o botão Confirmar apenas mostra aviso local | Hidratar catálogo a partir de Cardápio, mesas a partir de Salão, garçons a partir de Equipe e persistir a abertura do pedido |
| Pedidos Ativos | Usa `pedidosAtivos` em memória; modal é funcional apenas visualmente e Avançar status altera o array local | Listar pedidos reais e validar transições no backend com auditoria |
| Fila da Cozinha | Usa a mesma lista fictícia de Pedidos Ativos, muda status em memória e remove o pedido ao marcar entregue | Reutilizar a mesma fonte real e registrar `entregue/finalizado` sem apagar histórico |
| Histórico | Usa datas fixas e array de demonstração; modal busca itens em pedidos ativos; exportação é placeholder | Consultar pedidos históricos por período/status, manter itens no próprio documento e exportar os registros reais |
| Backend | Não há handler específico de pedidos; o agregador operacional já suporta Cardápio, Salão, Equipe, Financeiro e Visão Geral | Criar `pedidos-handler` no agregador operacional existente, com autorização, transações, estados fechados e auditoria |
| Modelo | O plano exige pedidos, comandas, itens, cozinha, cancelamento justificado, fechamento e pagamento | Implementar primeiro abertura, itens, status de cozinha e cancelamento/fechamento; pagamento ficará limitado ao campo persistido até o módulo Financeiro concluir o fluxo completo |

Os estados operacionais previstos para a primeira entrega são `novo`, `preparo`, `pronto`, `entregue`, `finalizado` e `cancelado`. O frontend não deverá carregar os pedidos fictícios no ambiente Development; quando o restaurante não tiver registros, os quatro fluxos mostrarão estados vazios orientativos.
