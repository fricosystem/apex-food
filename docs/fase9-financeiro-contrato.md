# Contrato da Fase 9 — Financeiro

## Rotas e recursos

| Método | Rota | Recurso | Finalidade |
|---|---|---|---|
| GET | `/api/v1/financeiro?recurso=resumos` | `resumos` | Ler resumo financeiro e caixa atual |
| GET | `/api/v1/financeiro?recurso=movimentacoes` | `movimentacoes` | Listar lançamentos do fluxo |
| GET | `/api/v1/financeiro?recurso=contas` | `contas` | Listar contas a pagar e receber |
| GET | `/api/v1/financeiro?recurso=relatorios&periodo=...` | `relatorios` | Listar relatórios por período |
| GET | `/api/v1/financeiro?recurso=fechamentos` | `fechamentos` | Listar fechamentos do caixa |
| POST | `/api/v1/financeiro` | `movimentacao` | Criar entrada ou saída idempotente |
| PATCH | `/api/v1/financeiro` | `movimentacao` | Atualizar estado do lançamento |
| POST | `/api/v1/financeiro` | `conta` | Criar conta a pagar ou receber idempotente |
| PATCH | `/api/v1/financeiro` | `conta` | Liquidar ou cancelar conta conforme transição permitida |
| POST | `/api/v1/financeiro` | `fechamento` | Conferir e fechar caixa com confirmação explícita |

## Coleções

Os documentos ficam dentro do restaurante ativo em `fechamentosCaixa`, `movimentacoesCaixa`, `contasPagar`, `contasReceber`, `relatoriosFinanceiros` e `resumosFinanceiros`. Chaves de idempotência ficam em `chavesIdempotencia`, também dentro do restaurante, com identificação derivada do usuário e da chave enviada.

Cada documento financeiro possui autoria server-side, `idRestaurante`, versão, timestamps e `moeda: 'BRL'`. Valores persistidos usam campos com sufixo `Centavos`; o frontend recebe valores convertidos para reais pelo DTO.

## Payload de movimentação

A criação aceita `recurso: 'movimentacao'`, `tipo` (`entrada` ou `saida`), `data` opcional, `categoria`, `descricao`, `origem`, `forma` e `valor`. A requisição exige `chaveIdempotencia` ou o cabeçalho `Idempotency-Key` com formato válido. O servidor grava `valorCentavos` e inicia o estado como `pendente`.

Os estados permitidos são `pendente`, `conciliado`, `cancelada` e `excluida`. Após cancelamento ou exclusão, o documento não pode ser reativado. Uma movimentação conciliada não pode ser revertida para outro estado.

## Payload de conta

A criação aceita `recurso: 'conta'`, `tipo` (`pagar` ou `receber`), `descricao`, `categoria`, `vencimento`, `valor` e `recorrente`. Contas a pagar iniciam como `pendente`; contas a receber iniciam como `prevista`. Os estados de pagar são `pendente`, `vencida`, `pago`, `cancelada` e `excluida`. Os estados de receber são `prevista`, `recebido`, `cancelada` e `excluida`.

## Fechamento de caixa

O fechamento utiliza `recurso: 'fechamento'`, `id`, `confirmado: true` e `saldoConferido`. O servidor calcula `saldoEsperadoCentavos` e `diferencaCentavos`, registra quem fechou e torna o documento imutável após o estado `fechado`.

## Relatórios e exportações

Relatórios são somente leitura na interface. O período selecionado é enviado ao backend e os documentos retornados alimentam indicadores, gráficos, categorias e tabelas. Exportação gera CSV no navegador a partir dos dados filtrados; impressão usa o relatório atualmente carregado.

## Permissões

A leitura fica restrita aos papéis financeiros autorizados. Mutação de movimentações e contas exige proprietário ou financeiro. Fechamento exige proprietário ou financeiro. A decisão é feita no servidor; o frontend não armazena papéis, tokens, dados de autenticação ou contexto do restaurante.

## Segurança e auditoria

Todas as mutações exigem sessão HttpOnly, contexto tenant-aware, CSRF, origem autorizada, App Check conforme o ambiente e auditoria operacional. O cliente não pode fornecer autoria, tenant, estado final, valor em centavos ou moeda de forma confiável; esses campos são definidos ou validados pelo servidor.
