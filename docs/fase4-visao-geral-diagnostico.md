# Diagnóstico da Fase 4 — Visão Geral e filtros

## Escopo aprovado

A Fase 4 do Plano-Sistema-Real.md determina que a Visão Geral deixe de usar métricas fictícias e consulte agregações reais da API. Os filtros de dia, semana, mês, ano e período personalizado devem normalizar as datas no fuso do restaurante e refletir cards, gráficos, vendas, ticket médio, ocupação, pedidos e indicadores correspondentes. Períodos sem dados devem exibir estado vazio, sem inventar séries ou totais.

## Estado encontrado

O fragmento `paginas/home.html` preserva o shell corretamente e `scripts/shell/apex-shell.js` já carrega a página no corpo do `index.html`. O problema visual de duplicação do shell foi corrigido separadamente com o cabeçalho `X-Apex-Fragment` e rotas condicionais da Vercel.

A lógica `scripts/home/home.js` ainda lê `window.dadosRelatoriosApexFood` e outros objetos preparados por scripts locais. Embora os bridges de Financeiro, Salão e demais módulos consultem APIs quando disponíveis, `scripts/relatorios/dados-relatorios.js` continua criando séries, canais, ranking, mapa de calor, avaliações e indicadores com valores estáticos de preview. Portanto, esses valores não podem ser apresentados como dados reais.

O endpoint `/api/v1/financeiro` já retorna `caixaAtual`, `recebimentos`, `fluxo`, `contas`, `relatoriosMensais`, `categorias`, `resumoFinanceiro` e `meta`, mas a consulta atual filtra relatórios por identificador textual de período e não agrega pedidos ou movimentações por data inicial/final. O endpoint `/api/v1/salao` fornece snapshot de mesas, reservas e configuração; não existe ainda uma agregação temporal de ocupação. O agregador operacional mantém esses contratos separados por módulo.

## Decisão de implementação

A próxima etapa deve criar uma fonte server-side específica para a Visão Geral, limitada ao restaurante ativo da sessão, com filtros normalizados e estados explícitos. O frontend deve consumir essa resposta pelo cliente same-origin existente e eliminar a dependência das séries fictícias de `dados-relatorios.js`. Snapshots atuais de Salão, Cardápio e Equipe podem ser reaproveitados somente quando retornarem dados reais; ausência de registros deve resultar em listas vazias e estado orientativo.
