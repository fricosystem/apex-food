# Etapa 21 — Auditoria de reservas, ocupação e disponibilidade

## Objetivo

Integrar a agenda de reservas, o estado real das mesas, as comandas abertas e o acesso público pelo QR sem permitir conflitos entre uma mesa reservada, uma mesa ocupada ou uma mesa bloqueada.

## Constatações

| Área | Situação encontrada | Impacto |
| --- | --- | --- |
| Bridge de mesas | `scripts/salao/dados-mesas.js` injeta 18 mesas fictícias quando o hostname é local | O mapa local pode mascarar ausência de dados reais |
| Bridge de reservas | `scripts/salao/dados-reservas.js` injeta reservas fictícias em localhost | A tela de reservas não representa o Firestore no preview |
| Cache | Bridges de mesas e reservas carregam o cliente global com versão antiga | O navegador pode reutilizar código anterior |
| Mapa | Carrega apenas `listarSalao('mesas')` e não cruza reservas reais | Reserva e ocupação ficam visualmente dessincronizadas |
| Atualização do mapa | A ação rápida altera o estado da mesa diretamente | Não há validação específica de reserva ou comanda antes de ocupar a mesa |
| Reservas | Criação valida capacidade e sobreposição, mas confirmação posterior não revalida conflitos | Duas operações administrativas podem confirmar horários conflitantes |
| QR público | Abertura verifica estado básico da mesa, mas não consulta reservas | Um QR ativo pode abrir sessão durante uma reserva confirmada |
| Mesa indisponível | Alteração manual pode tentar bloquear mesa com comanda ativa | Pode gerar conflito entre operação, QR e caixa |
| Tempo real | Atualização atual depende de recarregamento manual | Alterações de reserva e ocupação não chegam automaticamente ao mapa |

## Regras definidas

A tela pública do QR deverá respeitar o estado da mesa e as reservas ativas. Reserva cancelada ou concluída não bloqueia. Reserva futura não bloqueia antes do início. Durante a janela de uma reserva confirmada ou aguardando, o QR não abre nova sessão em mesa ainda disponível; depois que a equipe registrar a chegada, a mesa poderá iniciar o atendimento. Sessões já abertas continuam sendo acompanhadas pela comanda ativa.

O mapa de mesas passará a carregar mesas e reservas reais em uma consulta do Salão e cruzará os dados no bridge, sem fixtures locais. A atualização periódica será limitada, com intervalo e jitter compatíveis com o padrão operacional existente, sem criar uma nova função Serverless.

A confirmação de uma reserva revalidará capacidade, sobreposição e disponibilidade operacional. O bloqueio manual de uma mesa será recusado quando houver comanda ativa ou ocupação vigente. Toda mutação continuará protegida por sessão, papel, CSRF, App Check, transação e auditoria.

## Critérios de aceite

| Critério | Resultado esperado |
| --- | --- |
| Dados locais | Mapa e Reservas iniciam vazios até receber dados reais |
| União de dados | Mapa mostra reserva, cliente, horário e estado real da mesa |
| Conflitos | Reserva sobreposta ou confirmação incompatível é recusada |
| QR | Mesa bloqueada ou reservada no período não abre nova sessão |
| Ocupação | Mesa ocupada por comanda não pode ser bloqueada manualmente |
| Atualização | Mapa e reservas atualizam automaticamente sem criar endpoint novo |
| Segurança | Isolamento por restaurante e DTO sem campos sensíveis preservados |
| Auditoria | Criação, confirmação, cancelamento, chegada e alterações de mesa registradas |
| Compatibilidade | Shell único, rotas limpas e layout existente preservados |

## Restrições

A etapa não criará novos arquivos em `api/v1`, não alterará a estrutura do `index.html`, não adicionará autenticação ao cliente público e não processará pagamentos.
