# Fase 4 — Visão Geral e Relatórios consolidados

## Resultado

A Visão Geral permanece como agregador server-side do restaurante ativo e os Relatórios passaram a consumir a mesma resposta real do Firestore. O navegador não recalcula vendas, canais, produtos, horários, avaliações ou performance a partir de consultas independentes; ele apenas adapta o DTO consolidado para os componentes já existentes.

## Fluxo consolidado

| Camada | Responsabilidade |
|---|---|
| `api/_lib/visao-geral-handler.js` | Consulta pedidos, caixa, salão, cardápio, equipe e avaliações dentro do restaurante ativo; aplica período, estados válidos, normalização e agregações. |
| `/api/v1/operacional?modulo=visao-geral` | Entrega o DTO consolidado com `meta.idRestaurante`, `meta.fonte: 'firestore'`, período e indicadores. |
| `scripts/home/dados-visao-geral.js` | Alimenta a Visão Geral com o DTO real e mantém polling com backoff. |
| `scripts/relatorios/dados-relatorios.js` | Usa `listarVisaoGeral`, valida a fonte Firestore, adapta séries, canais, ranking, avaliações e performance e preserva os filtros. |
| Controllers de Relatórios | Continuam renderizando os mesmos campos e exportando somente o conjunto carregado do servidor. |

## Indicadores preservados

O bridge de Relatórios mantém `vendasDiarias`, `vendasSemanais`, `vendasMensais`, `canais`, `produtosMaisVendidos`, `mapaCalor`, `avaliacoes`, `distribuicaoNotas`, `performanceEquipe` e os indicadores de vendas, pedidos, avaliações e picos. Quando a coleção real não possui documentos, cada conjunto permanece vazio e os componentes exibem o estado vazio profissional.

## Segurança e consistência

O período selecionado continua sendo enviado ao servidor. O backend resolve o fuso horário do restaurante, limita a consulta, filtra estados cancelados e informa a fonte Firestore. Nenhum relatório pode receber dados digitados pelo cliente como se fossem vendas, comissões ou avaliações reais.

A atualização automática do bridge de Relatórios usa backoff, jitter, `visibilitychange` e `beforeunload`. Em erro ou ausência de restaurante, o estado é limpo e a tela não exibe números de preenchimento.

## Critérios de aceite

| Critério | Resultado |
|---|---|
| Fonte única | Visão Geral e Relatórios consultam o agregador server-side. |
| Divergência de cálculos | Removida a agregação duplicada no navegador. |
| Períodos | Preservados em `ultimosParametros` e enviados à API. |
| Avaliações e performance | Consumidas do DTO consolidado real. |
| Estado vazio | Sem registros fictícios ou valores demonstrativos. |
| Atualização | Polling seguro com backoff, jitter e encerramento. |
| Testes | 304/304 aprovados. |
