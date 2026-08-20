# Etapa 11 — Auditoria e recorte seguro do Financeiro

**Projeto:** APEX Food  
**Ambiente:** Development na Vercel  
**Status:** Auditoria concluída; implementação server-side e adaptação visual serão executadas nas fases seguintes  
**Princípio:** adicionar integração sem refazer, remover ou alterar o shell único, o roteador hash, o sidebar, o header ou a identidade visual existente.

## 1. Escopo auditado

A Etapa 11 cobre as rotas Financeiro já registradas no shell: `#/fechamento-caixa`, `#/fluxo-caixa`, `#/contas-pagar-receber` e `#/relatorios-financeiros`. O dashboard `#/dashboard-financeiro` será adaptado como leitura agregada quando o contrato dos resumos estiver estável, sem criar uma nova rota ou uma segunda estrutura de navegação.

Os dados atuais vivem em `window.dadosFinanceirosApexFood`, com valores monetários em reais decimais, enquanto o contrato Firestore aprovado exige inteiros em centavos, moeda explícita e cálculo server-side. O adaptador deverá converter centavos para reais somente na borda visual e jamais usar o valor enviado pelo navegador como autoridade financeira.

| Rota | Função atual | Risco | Primeiro tratamento |
|---|---|---:|---|
| `#/relatorios-financeiros` | KPIs, gráfico mensal, categorias e tabela de resultados | Baixo para leitura | Resumo agregado server-side, filtros limitados e DTO mínimo |
| `#/fluxo-caixa` | Entradas/saídas, filtros e novo lançamento | Alto | Leitura autorizada primeiro; criação idempotente e auditada depois |
| `#/contas-pagar-receber` | Títulos, vencimentos, filtros e novo título | Alto | Leitura primeiro; criação e baixa com estados fechados |
| `#/fechamento-caixa` | Conferência, recebimentos e confirmação do fechamento | Muito alto | Leitura primeiro; fechamento transacional e imutável por último |
| `#/dashboard-financeiro` | Visão agregada de caixa, compromissos e resultado | Baixo para leitura | Consumir `resumosFinanceiros` sem receber coleções completas |

## 2. Coleções canônicas

A implementação usará somente as coleções aprovadas no schema multi-tenant: `fechamentosCaixa`, `movimentacoesCaixa`, `contasPagar`, `contasReceber`, `relatoriosFinanceiros`, `resumosRelatorios`, `resumosFinanceiros` e `chavesIdempotencia`. Todos os caminhos serão derivados pelo servidor a partir do restaurante ativo na sessão; `idRestaurante`, autoria, timestamps e versões nunca serão aceitos como autoridade no payload.

| Coleção | Dados principais | Regra de integridade |
|---|---|---|
| `fechamentosCaixa` | Abertura, vendas, suprimentos, sangrias, retiradas, saldo esperado/conferido, estado | Fechamento aprovado não é editável; correções geram reversão auditada |
| `movimentacoesCaixa` | Tipo, categoria, descrição, origem, forma, valor em centavos, status | Escrita com `chaveIdempotencia`, transação quando alterar resumo e auditoria |
| `contasPagar` / `contasReceber` | Descrição, categoria, vencimento, valor em centavos, estado, recorrência | Estados controlados, baixa auditada e separação por tipo |
| `relatoriosFinanceiros` | Períodos e agregações de vendas, despesas, resultado e categorias | Somente dados agregados calculados no servidor |
| `resumosFinanceiros` | KPIs executivos e recebimentos por meio | Somente leitura para papéis financeiros autorizados |
| `chavesIdempotencia` | Chave, endpoint, ator, resultado e expiração | Impede duplicidade de comandos repetidos |

## 3. Papéis e controles

Leituras financeiras exigirão `financeiro` ou `proprietario`, conforme a matriz aprovada. Mutação de títulos, movimentações e fechamento exigirá papel financeiro; o fechamento poderá exigir adicionalmente `proprietario` conforme a regra de negócio final. O navegador não poderá escolher papel, restaurante, operador, data de fechamento, valor calculado, saldo esperado ou estado final.

A resposta da API terá somente o DTO necessário para a tela, sem documento Firestore completo, dados de auditoria, `criadoPor`, `atualizadoPor`, `idRestaurante` ou campos privados. Logs não conterão senha, token, cookie, chave, contato pessoal ou payload financeiro completo.

## 4. Regras de dinheiro e estados

Todos os valores persistidos serão inteiros em centavos com `moeda: 'BRL'`. O frontend poderá enviar um valor decimal apenas como conveniência de formulário; o backend deverá normalizar e rejeitar precisão inválida, negativos indevidos, NaN, Infinity, valores fora do limite e alterações de valores calculados. Totais, saldos esperados, resultado, margem e agregações serão calculados no servidor.

Os estados serão enums fechados. Para contas, o recorte inicial usará `pendente`, `prevista`, `vencida`, `pago`, `recebido`, `cancelada` e `excluida` conforme o tipo. Para movimentações, usará `pendente`, `conciliado`, `cancelada` e `excluida`. Para fechamento, usará `aberto`, `em_conferencia`, `fechado`, `reaberto` apenas mediante ação autorizada e `excluido` para tombstone. Transições inválidas retornarão erro controlado e não alterarão o documento.

## 5. Ordem de rollout

A ordem escolhida reduz o risco financeiro sem quebrar a aparência atual:

| Ordem | Entrega | Critério de segurança |
|---:|---|---|
| 1 | Leitura de `relatoriosFinanceiros`, `resumosFinanceiros` e `resumosRelatorios` | Agregações server-side, paginação e filtros limitados |
| 2 | Leitura de `contasPagar` e `contasReceber` | Separação por coleção, valores em centavos e DTO mínimo |
| 3 | Leitura de `movimentacoesCaixa` e `fechamentosCaixa` | Estado vazio/erro controlado; nenhum mock em domínio publicado |
| 4 | Criação idempotente de contas e movimentações | CSRF, RBAC, validação, `chaveIdempotencia` e auditoria |
| 5 | Baixa/conciliação de contas e atualização autorizada de movimentações | Máquina de estados, transação e auditoria somente para acréscimo |
| 6 | Fechamento transacional e imutável do caixa | Conferência server-side, aprovação, versão e bloqueio de edição |

Até a homologação, o preview local será preservado somente em `localhost` e `127.0.0.1`. Em domínio publicado, falhas de sessão, restaurante ou autorização não poderão exibir dados simulados silenciosamente.

## 6. Critérios de aceite da auditoria

A auditoria está concluída porque as rotas, objetos globais, formatos monetários, campos de formulário, coleções canônicas, papéis e riscos estão definidos. A próxima fase poderá criar o helper financeiro e o endpoint consolidado sem alterar o shell.

A Etapa 11 somente será considerada concluída depois de testes de dinheiro decimal inválido, centavos, IDOR de restaurante, papel insuficiente, CSRF, repetição de comando, estado inválido, fechamento já aprovado, cálculo de saldo, XSS em descrições, falha de API, rota sem sessão e smoke test remoto após deployment `Ready`.

## Referências internas

[1]: `docs/firebase/etapa-6-schema-multitenant.md` — Schema multi-tenant, coleções e invariantes financeiras.
[2]: `scripts/financeiro/dados-financeiros.js` — Dataset visual atual do Financeiro.
[3]: `paginas/financeiro/contas-pagar-receber.html` — Contrato visual de títulos e formulário.
[4]: `paginas/financeiro/fluxo-caixa.html` — Contrato visual de movimentações e filtros.
[5]: `paginas/financeiro/fechamento-caixa.html` — Contrato visual do fechamento e confirmação.
[6]: `scripts/financeiro/relatorios-financeiros.js` — KPIs, gráficos e tabela de relatórios.

## 7. Validação visual incremental

A rota local `#/fluxo-caixa` carregou dentro do shell único sem alterar sidebar ou header. Os KPIs, gráfico mensal, filtros, tabela com oito movimentações e modal de novo lançamento permaneceram visíveis e funcionais no preview local. O adaptador Financeiro foi carregado sem bloquear a renderização, e o fallback local permaneceu restrito ao servidor `localhost`.

A rota local `#/contas-pagar-receber` carregou dentro do shell único com os quatro KPIs, próximos vencimentos, recebimentos previstos, atenção financeira, filtros, tabela de sete títulos e modal de novo título preservados. O fallback local manteve os valores visuais existentes enquanto não há restaurante ativo remoto.

A rota local `#/fechamento-caixa` preservou status do caixa, KPIs de vendas/saldo/diferença, recebimentos, movimentações e modal de confirmação. A rota `#/relatorios-financeiros` preservou filtros de período, exportação/impressão visuais, KPIs, gráfico de vendas versus despesas, composição por categorias e resumo mensal. Ambas permaneceram dentro do shell único e sem erros visuais observáveis.

A rota local `#/dashboard-financeiro` carregou com o resumo executivo, KPIs de resultado/margem/vendas/compromissos/saldo, gráfico mensal, status do caixa, recebimentos por meio, próximos compromissos e links de aprofundamento preservados dentro do shell. O dashboard continua consumindo o contrato visual de `window.dadosFinanceirosApexFood` e está pronto para receber o resumo server-side quando houver restaurante ativo.

## 8. Testes e revisão local

A suíte completa passou com **39 testes**, sem falhas, incluindo os contratos anteriores de autenticação, Cardápio, Salão e Equipe, além da nova cobertura Financeiro. A checagem de sintaxe passou para todos os scripts Financeiro, o cliente de módulos, o helper, o handler e o agregador operacional. A primeira execução do comando composto terminou com código não zero somente porque o workspace de validação não é um clone Git e `git diff --check` foi chamado no diretório errado; a suíte e a checagem de sintaxe foram repetidas isoladamente e passaram integralmente.
