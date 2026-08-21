# Etapa 17 — Refinamento operacional da Visão Geral

## Objetivo

A Etapa 17 aprimora a Visão Geral já integrada ao Firestore. O foco é adicionar comparação entre períodos, atualização automática controlada e estados de operação mais claros, sem refazer o shell, sem remover cartões e sem criar uma nova função em `api/v1/`.

## Contrato de comparação

O endpoint consolidado `/api/v1/operacional?modulo=visao-geral` continuará sendo a única fonte da Visão Geral. O servidor calculará o intervalo anterior imediatamente anterior ao intervalo solicitado, com a mesma duração em dias. Para um dia, será comparado o dia anterior; para uma semana, os sete dias anteriores; para filtros personalizados, o intervalo anterior de igual duração.

A resposta incluirá comparações reais para vendas, ticket médio, pedidos, despesas, resultado e avaliações. Quando não houver base anterior, o DTO retornará estado sem comparação, sem fabricar percentual. Quando a base anterior for zero e o período atual possuir dados, a interface exibirá que não há base comparável em vez de dividir por zero.

## Atualização automática

A ponte da Visão Geral terá um único ciclo de atualização com `setTimeout`, sem sobreposição de requisições. O ciclo será executado somente enquanto a página estiver visível e autenticada, pausará em `visibilitychange` quando a aba ficar oculta e retomará ao voltar. O intervalo normal será de 60 segundos; falhas usarão backoff progressivo limitado a 60 segundos. O botão Atualizar continuará disponível para uma consulta manual imediata.

## Refinamentos de usabilidade

Os três cards principais substituirão o texto estático de comparação por percentuais reais com direção visual e texto acessível. O período ativo, o canal selecionado, o horário da última atualização e o estado de sincronização permanecerão visíveis. Estados sem dados continuarão profissionais e diretos, sem dados fictícios e sem linguagem de desenvolvimento.

Os pedidos, mesas, reservas e gráficos continuarão usando as referências dinâmicas da resposta do agregador. Exportação, impressão, busca, filtros, alternância de gráfico e navegação dos módulos serão preservados.

## Segurança e limites

O restaurante será obtido exclusivamente da sessão autenticada no servidor. O frontend não receberá credenciais Firebase, tokens, segredos ou acesso direto ao Firestore. Nenhum dado será gravado em `localStorage` ou `sessionStorage`. Todas as leituras continuarão tenant-aware, protegidas pelo middleware existente, App Check, cookies HttpOnly e respostas sem sessão com HTTP 401.

A etapa não criará arquivos em `api/v1/`; o handler existente da Visão Geral e o cliente same-origin serão reutilizados. Os assets alterados receberão cache-busting `etapa17-visao`.

## Critérios de aceite

1. Comparações vêm de registros reais do Firestore e nunca de constantes de interface.
2. A atualização automática não cria timers duplicados, pausa em aba oculta e usa backoff em falhas.
3. O botão manual de atualização continua funcional.
4. A Visão Geral mantém um único shell e as rotas limpas.
5. Nenhuma credencial, token ou dado de restaurante é exposto no frontend.
6. A suíte histórica e os contratos da Etapa 17 passam integralmente antes da publicação.
7. A rota publicada e a API sem sessão são verificadas após o deployment.
