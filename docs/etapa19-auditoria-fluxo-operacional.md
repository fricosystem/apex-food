# Etapa 19 — Auditoria do fluxo operacional pós-QR

## Objetivo da auditoria

A próxima etapa do APEX Food deve consolidar o ciclo real dos pedidos originados na comanda pública da mesa, sem recriar módulos existentes. O comportamento esperado é: cliente envia o pedido, garçom confirma ou rejeita, garçom encaminha à cozinha, cozinha inicia e conclui o preparo, garçom marca o pedido como servido, garçom encerra operacionalmente a comanda e o caixa recebe e conclui a conferência, liberando a mesa.

## Resultado encontrado

O backend já possui a máquina de estados específica para pedidos originados por QR Code, com transições `aguardando_confirmacao_garcom`, `confirmado_garcom`, `enviado_cozinha`, `em_preparo`, `pronto`, `servido`, `rejeitado_garcom` e `cancelado`. A validação ocorre no servidor, com autorização por papel, transação Firestore, idempotência, histórico, auditoria e notificações operacionais.

A confirmação do garçom atribui o responsável à comanda e altera a comanda para `em_consumo`. O envio à cozinha cria uma ficha em `fichasCozinha`. As ações de cozinha atualizam a ficha e o pedido. O status `servido` mantém a mesa ocupada, evitando liberação prematura. O encaminhamento ao caixa exige comanda em consumo, pedidos concluídos e papel de garçom. A conclusão do caixa encerra comanda e sessões públicas, encerra participantes e devolve a mesa para `disponivel`. Nenhum pagamento é processado nessa etapa.

## Pontos a preservar

| Área | Regra que permanece obrigatória |
| --- | --- |
| Segurança | O frontend não acessa Firestore diretamente nem escolhe o restaurante ativo. |
| Autorização | Garçom confirma, rejeita, envia à cozinha, serve e encaminha; cozinha inicia e conclui preparo; caixa recebe e conclui a conferência. |
| Integridade | Mudanças críticas permanecem transacionais e idempotentes. |
| Identidade | O nome informado na comanda pública permanece associado ao pedido e visível ao garçom. |
| Mesa | A mesa só volta a `disponivel` depois da conclusão operacional do caixa. |
| Pagamento | A tela do caixa apenas confere e conclui o atendimento; não há processamento de pagamento. |
| Arquitetura | Shell único, fragmentos existentes, endpoint consolidado e limite atual de funções serão preservados. |

## Ajustes identificados para a implementação incremental

A ponte de dados dos pedidos já separa pedidos ativos e histórico com base no status do pedido e no estado da comanda. As telas de Pedidos Ativos e Fila da Cozinha já oferecem as ações principais. A tela de Fechamento de Caixa já possui a fila de encaminhamentos, confirmação de recebimento e conclusão operacional.

Foi identificado um ponto de cache-busting desatualizado no carregamento dinâmico do cliente de módulos financeiros, que ainda referencia `modulos-client.js?v=etapa6-caixa`. Esse identificador deverá ser alinhado ao versionamento vigente antes da publicação da etapa, sem alterar a lógica do módulo.

Também será feita uma revisão de consistência da interface para garantir que estados públicos do QR não sejam misturados com estados legados, que ações incompatíveis com o papel do operador não apareçam como disponíveis e que os estados vazio, carregando, erro, sucesso e indisponibilidade sejam informativos e profissionais.

## Critérios de aceite da Etapa 19

| Critério | Resultado esperado |
| --- | --- |
| Pedido público | Pedido originado na comanda pública aparece em Pedidos Ativos como aguardando confirmação do garçom. |
| Confirmação | Garçom confirma ou rejeita com motivo obrigatório na rejeição. |
| Cozinha | Pedido confirmado é encaminhado à fila, iniciado e marcado como pronto pela cozinha. |
| Serviço | Garçom marca pedido pronto como servido, sem liberar a mesa. |
| Caixa | Garçom encaminha a comanda somente sem pedidos pendentes. |
| Encerramento | Caixa recebe e conclui a conferência operacional, sem processar pagamento. |
| Mesa | Mesa retorna a disponível somente após conclusão do caixa. |
| Concorrência | Repetição de ações não duplica ficha, histórico, notificação ou encerramento. |
| Segurança | Autorizações server-side, CSRF, App Check, rate limit e auditoria permanecem ativos. |
| Interface | Todas as páginas usam dados reais e mensagens em português, sem dados fictícios. |

## Escopo da próxima implementação

A implementação começará pelos ajustes de consistência e sincronização das interfaces existentes, incluindo o cache-busting financeiro, a revisão dos adaptadores e contratos, e os testes ponta a ponta do ciclo completo. Nenhum endpoint novo será criado em `api/v1/`.
