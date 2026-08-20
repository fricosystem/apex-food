# Fase 11 — Testes e regressão completos

**Projeto:** APEX Food  
**Ambiente:** Development na Vercel (`apexfood.vercel.app`)  
**Data da execução:** 20/08/2026  
**Autor:** Manus AI

## Objetivo

A Fase 11 revisou a navegação pública, os estados vazios, os controles dos relatórios e os contratos automatizados, preservando o shell único, o layout escuro com destaque laranja, a API server-side e o modelo multi-tenant já implementados.

## Cobertura executada

| Área | Verificação | Resultado |
|---|---|---|
| Testes automatizados | `node --test testes/*.test.js` no workspace | 112 aprovados, 0 falhas |
| Testes automatizados | Mesma bateria no clone de publicação | 112 aprovados, 0 falhas |
| Sintaxe | Controllers de Vendas por Período e Comissões | Aprovada |
| Segredos | Scanner de arquivos versionados | Nenhum padrão sensível encontrado |
| Rotas públicas | 28 rotas canônicas, incluindo autenticação | HTTP 200 em todas |
| URLs | Ausência de caminhos físicos proibidos na resposta inicial | Aprovada |
| Console | Vendas por Período após carregamento público | Sem saída ou erro |
| Preflight de Staging | Execução local | Não aplicável ao Development; variáveis de Staging ausentes |

## Regressões encontradas

A auditoria identificou dois comportamentos que contrariavam a regra de dados derivados. Vendas por Período apresentava `+8,6%`, `+5,2%` ou `+11,8%` conforme o seletor, inclusive quando existiam zero vendas e zero períodos. Comissões apresentava opções fixas de `Agosto/2026`, `Julho/2026` e `Junho/2026`, mesmo quando a fonte não retornava nenhum período.

As fixtures existentes nos bridges `dados-*` foram avaliadas separadamente. Elas permanecem confinadas ao modo local (`localhost`/`127.0.0.1`) e não são usadas como dados operacionais no host público; por isso, não foram removidas nem substituídas nesta fase.

## Correções aplicadas

O controller de Vendas por Período passou a calcular a variação comparando janelas equivalentes dos registros carregados. Quando não há base anterior ou não há registros comparáveis, a interface exibe `Sem comparação com período anterior`, usa estado visual neutro e substitui comparativos indisponíveis por `—`.

O controller de Comissões passou a hidratar o seletor com os períodos presentes na resposta do bridge/API, filtrar a tabela pelo período escolhido, preservar o período selecionado durante atualizações e informar `Nenhum período disponível` quando a coleção está vazia. A exportação vazia agora informa diretamente que não há registros para exportar.

Os assets alterados foram versionados como `fase11` no shell e o `index.html` passou a carregar `apex-shell.js?v=fase11`. Os testes contratuais das fases anteriores foram atualizados somente para refletir esse novo cache-busting e receberam asserções específicas para impedir o retorno dos valores fixos.

## Critérios de aceite

A fase será considerada concluída quando os testes locais e do clone permanecerem em 112/112, os assets forem publicados na branch `main`, o deployment atingir estado disponível e as rotas `/comissoes` e `/vendas-por-periodo` confirmarem publicamente os estados dinâmicos, sem períodos de exemplo ou variações fixas.

## Referências

[1]: ../Plano-Sistema-Real.md "Plano do Sistema Real do APEX Food"
