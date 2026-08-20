# Diagnóstico da Fase 9 — Financeiro

## Objetivo

Concluir a integração de Fluxo de Caixa, Contas a Pagar/Receber, Fechamento de Caixa e Relatórios Financeiros ao Firestore, preservando o shell único, os fragmentos HTML, a identidade visual e as URLs limpas do APEX Food.

## Estado encontrado

| Área | Estado atual | Trabalho previsto |
|---|---|---|
| Fluxo de Caixa | Handler e cliente same-origin já possuem criação de movimentação, idempotência, transição de estado e leitura. O controller ainda conserva mensagens de preview, filtro de período apenas visual e ação de detalhes sem fluxo persistido. O bridge inicia com dados estáticos antes da resposta remota. | Estado inicial vazio fora do ambiente local, recarga única pelo servidor, filtros de período, criação idempotente e atualização de status. |
| Contas a Pagar/Receber | Criação já usa o endpoint financeiro e recarrega os dados. A tabela e indicadores ainda dependem de fonte híbrida; as ações por linha não liquidam nem cancelam títulos e existem textos fixos no fragmento. | Cadastro persistido, transições `pendente`, `vencida`, `pago`, `prevista`, `recebido` e `cancelada`, recarga após alteração e remoção de blocos fixos. |
| Fechamento de Caixa | O servidor calcula saldo esperado, diferença, confirmação e imutabilidade. O controller hidrata cards, mas assume caixa presente, calcula parte da diferença no cliente e mantém mensagens provisórias. | Estado sem caixa, valores vindos do documento, abertura/fechamento persistidos e modal alinhado ao contrato. |
| Relatórios Financeiros | Leitura por documentos está disponível no backend, mas o controller usa dados locais, fixa o ano na tabela e deixa período, exportação e impressão sem operação. | Consulta por período, renderização dos documentos retornados, exportação CSV e impressão do relatório atual. |
| Dashboard Financeiro | Já possui bridge e leitura agregada, mas depende da mesma fonte financeira que precisa iniciar vazia e ser atualizada de forma consistente. | Preservar a composição visual e garantir atualização pelo evento financeiro. |

## Coleções financeiras

A Fase 9 utiliza `fechamentosCaixa`, `movimentacoesCaixa`, `contasPagar`, `contasReceber`, `relatoriosFinanceiros`, `resumosFinanceiros` e `chavesIdempotencia` dentro do restaurante ativo. Valores monetários são gravados em centavos, com `moeda: 'BRL'` e conversão para reais somente no DTO de saída.

## Critérios de aceite

A Fase 9 será considerada concluída quando as telas carregarem somente dados do restaurante ativo, criação e atualização passarem pelo endpoint seguro, repetições de lançamentos não criarem duplicidades, fechamento exigir confirmação, relatórios permitirem período/exportação/impressão, os estados vazios forem profissionais e a suíte de regressão passar integralmente.
