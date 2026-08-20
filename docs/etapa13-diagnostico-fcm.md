# Etapa 13 — Diagnóstico e observabilidade FCM

## Objetivo

A Etapa 13 adicionará visibilidade operacional à entrega das notificações FCM sem expor tokens, códigos internos ou credenciais. O operador poderá verificar, no painel **Dispositivos**, se a última tentativa foi aceita, falhou, revogou um token inválido ou ainda não foi realizada.

## Estados públicos

| Estado | Significado para o operador |
|---|---|
| `sem_teste` | Nenhuma tentativa de envio foi feita para a instalação |
| `enviado` | O FCM aceitou a mensagem para o dispositivo |
| `falhou` | A tentativa não foi aceita; o dispositivo permanece disponível para nova tentativa |
| `revogado` | O token foi considerado inválido e a instalação foi desativada |
| `indisponivel` | O serviço FCM não estava disponível para executar o envio |

A interface exibirá somente uma mensagem em português, data da última tentativa e contagem de falhas consecutivas. O código bruto retornado pelo FCM será mantido apenas no fluxo server-side para diagnóstico técnico e não será devolvido no DTO.

## Persistência

Os metadados de diagnóstico serão gravados no próprio documento `restaurantes/{idRestaurante}/dispositivosNotificacao`, com `ultimoResultadoEntrega`, `ultimaEntregaEm`, `falhasConsecutivas` e timestamps server-side. A atualização ocorrerá após a resposta do FCM, nunca dentro de uma transação de pedido ou caixa. O envio original continuará isolado de falhas de observabilidade.

Quando necessário para auditoria, o servidor poderá registrar uma entrada agregada em `registrosEntregasNotificacao`, dentro do restaurante, contendo tipo do evento, quantidade de tentativas, quantidade aceita, quantidade revogada e resultado geral. O registro não conterá token, user-agent ou conteúdo sensível.

## Segurança e retenção

O diagnóstico respeitará o restaurante ativo, a identidade autenticada, o papel autorizado, CSRF para mutações, App Check e rate limit. A consulta devolverá apenas os dispositivos da própria identidade; gerência poderá consultar metadados operacionais conforme o contrato já aprovado. Registros de entrega terão retenção lógica curta, inicialmente 30 dias, e não serão usados para substituir a auditoria operacional.

## Critérios de aceite

A operação de teste deverá retornar uma mensagem profissional quando nenhum dispositivo estiver ativo, quando o FCM estiver indisponível ou quando o envio for aceito. Um token inválido deverá aparecer como instalação revogada sem expor o código bruto. Repetir o teste não deverá criar dispositivos duplicados nem alterar pedidos, comandas, cozinha, caixa ou mesas. A interface continuará adaptável em desktop, tablet e PWA Android.
