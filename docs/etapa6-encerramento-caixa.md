# Etapa 6 — Encerramento, caixa e liberação da mesa

## Escopo

Esta etapa encerra o atendimento iniciado pelo QR Code sem processar pagamentos. O caixa confirma apenas o recebimento e a conclusão operacional da comanda. O sistema não cria documentos de cartão, adquirência, senha, CVV, transação financeira ou confirmação de captura.

## Fluxo aprovado

```text
em_consumo
  -> encaminhada_caixa
  -> encerrada

mesa ocupada / encaminhada_caixa
  -> mesa disponível somente depois de comanda encerrada
```

O garçom autorizado executa o encaminhamento depois que todos os pedidos da comanda foram encerrados operacionalmente. Pedidos em `rascunho`, `aguardando_confirmacao_garcom`, `confirmado_garcom`, `enviado_cozinha`, `em_preparo`, `pronto`, `novo` ou `preparo` bloqueiam o encaminhamento. Pedidos `servido`, `entregue`, `finalizado`, `rejeitado_garcom` e `cancelado` não mantêm pendência operacional.

O documento da comanda recebe `statusComanda: encaminhada_caixa`, `encaminhadaCaixaEm` e `resumoOperacional`. A mesa permanece com `estado: ocupada`, `estadoAtendimento: encaminhada_caixa` e `idComandaAberta` preservado. O documento `encaminhamentosCaixa/{idComanda}` é criado pelo servidor com resumo de mesa, garçom, pedidos, participantes e total em centavos, sem aceitar esses valores como fonte do frontend.

## Operações do caixa

A fila é lida em `GET /api/v1/financeiro?recurso=encaminhamentos`. O operador autorizado pode executar pelo endpoint financeiro consolidado:

| Estado anterior | Estado seguinte | Operação |
|---|---|---|
| `encaminhada` | `recebida` | Confirmação de recebimento pelo caixa |
| `recebida` | `concluida` | Conclusão operacional e liberação transacional |
| `encaminhada` | `cancelada` | Cancelamento operacional autorizado |

A conclusão verifica novamente a comanda, a mesa e todos os pedidos em transação. Depois, atualiza a comanda para `encerrada`, a mesa para `disponivel`, limpa `idComandaAberta` e `idGarcomResponsavel`, encerra as sessões públicas e marca os participantes como encerrados. Nenhuma dessas alterações é feita pelo navegador diretamente.

## Segurança e idempotência

O restaurante é derivado da sessão autenticada do operador. A API valida papel, sessão, CSRF, App Check, estado anterior, vínculo entre comanda e mesa e chave de idempotência. Cada mutação grava uma chave em `chavesIdempotencia`, registra auditoria e adiciona histórico/evento operacional. Repetições com o mesmo payload retornam o resultado anterior; reutilizações com payload diferente são rejeitadas.

Os papéis de leitura da fila são `proprietario`, `administrador`, `gerente`, `financeiro` e `caixa`. As mutações do caixa usam o mesmo conjunto operacional. O encaminhamento da comanda é permitido aos papéis de salão já autorizados pelo fluxo de pedidos.

## Frontend

A tela `Pedidos Ativos` mantém pedidos servidos visíveis até o encaminhamento da comanda. A tela `Fechamento de Caixa` apresenta a seção **Comandas encaminhadas ao caixa**, com confirmação de recebimento e conclusão operacional. O Mapa de Mesas apresenta o resumo `Encaminhada ao caixa` e só mostra a mesa como disponível após a atualização do servidor.

O frontend usa somente o cliente same-origin, não guarda sessão, credenciais ou chave de idempotência em `localStorage` ou `sessionStorage`, e mantém a versão dos assets em `etapa6-caixa`.
