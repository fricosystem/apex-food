# Diagnóstico da Fase 8 — Equipe e Permissões

## Objetivo

Concluir a integração de Funcionários, Escalas e Comissões ao Firestore, preservando o shell único, os fragmentos HTML, a identidade visual e as URLs limpas do APEX Food.

## Estado encontrado

| Área | Estado atual | Trabalho previsto |
|---|---|---|
| Funcionários | Handler já cria e atualiza funcionário em `funcionarios`, grava contato protegido em `dadosPrivadosFuncionarios` e aplica papéis server-side. O bridge ainda inicia com preview e o controller mantém criação híbrida, edição simulada e indicadores com data fixa. | Estado vazio público, recarga após mutação, edição persistida, filtros e indicadores derivados dos dados atuais. |
| Escalas | Handler já cria e atualiza escalas com validação de jornada, funcionário existente, conflitos e auditoria. O controller ainda usa agenda fixa, opções estáticas de funcionários e injeta novas escalas apenas em memória. | Agenda dinâmica, hidratação dos funcionários, criação/edição/status persistidos e recarga pelo Firestore. |
| Comissões | Handler já permite leitura por período e DTO sem dados privados. O controller já faz consulta remota quando o período muda, mas exportação e mensagens ainda são simuladas. | Estado vazio profissional, período carregado do contrato, ranking calculado pelos documentos e exportação CSV dos dados filtrados. |
| Permissões | Papéis de leitura, mutação, escala e comissão já estão separados no backend. | Manter a decisão exclusivamente no servidor e refletir falhas de autorização com mensagens orientativas no frontend. |
| Segurança | Dados privados de funcionário ficam em coleção separada e não são devolvidos pelo DTO público. | Preservar mascaramento de contato, ausência de Firebase client, ausência de localStorage e tenant definido pelo contexto HttpOnly. |

## Coleções canônicas

A Fase 8 utiliza as coleções `funcionarios`, `dadosPrivadosFuncionarios`, `escalas` e `comissoes` dentro do restaurante ativo. A coleção privada não será carregada pela interface e não conterá dados expostos em DTO público.

## Estados e validações

Funcionários utilizam `ativo`, `ferias` e `inativo`. Escalas utilizam `agendado`, `presente`, `folga`, `falta` e `cancelado`. Turnos permanecem `Almoço`, `Jantar` e `Integral`, e setores permanecem `Salão`, `Cozinha`, `Bar` e `Gestão`. O servidor continuará validando jornada, intervalo, percentual de comissão, conflitos e vínculo do funcionário.

## Critérios de aceite

A Fase 8 será considerada concluída quando as três telas carregarem apenas dados do restaurante ativo, nenhuma tela pública apresentar funcionários ou escalas de exemplo, criação e atualização forem persistidas pelo servidor, contatos privados permanecerem protegidos, exportação de comissões gerar arquivo com os dados filtrados e a suíte de regressão passar integralmente.
