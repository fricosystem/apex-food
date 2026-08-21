# Etapa 22 — Auditoria do módulo de Equipe

## Objetivo

Integrar Funcionários, Escala de Trabalho e Comissões ao Firestore com dados exclusivamente reais, preservando o shell único, os fragmentos HTML existentes, as rotas limpas e o padrão visual escuro com destaque laranja.

## Estado encontrado

| Área | Situação atual | Decisão incremental |
|---|---|---|
| Funcionários | O backend já possui criação e atualização transacionais por batch, separação entre dados públicos e `dadosPrivadosFuncionarios`, controle de papéis e auditoria. | Preservar o handler e completar a tela com os campos reais permitidos, estados e atualização automática. |
| Escala de Trabalho | O backend já valida funcionário pertencente ao restaurante, jornada, intervalo e conflito de horários em transação. O frontend ainda trabalha com a janela local de cinco dias e converte datas para apresentação. | Manter a agenda visual, normalizar datas no bridge e garantir que toda mutação envie o formato aceito pelo servidor. |
| Comissões | A leitura já existe e permanece somente leitura. A tela calcula indicadores e exporta o conjunto recebido. | Remover qualquer dependência de fixture local e tratar ausência de dados como estado vazio real. |
| Bridge da Equipe | `scripts/equipe/dados-equipe.js` contém oito funcionários, nove escalas e quatro comissões fictícios ativados em `localhost`. | Eliminar completamente `previewEquipe`; iniciar vazio e preencher somente após resposta válida de `/api/v1/equipe`. |
| Atualização | A recarga manual existe, mas não há ciclo de polling com backoff/jitter específico do módulo. | Adicionar atualização automática moderada, com encerramento no descarregamento da página e sem criar nova função serverless. |
| Segurança | O cliente usa same-origin, cookies HttpOnly, CSRF e não inclui Firebase client, localStorage ou credenciais privadas. | Preservar. Nenhum dado privado de contato será enviado ao frontend. |
| API e Vercel | A rota consolidada `/api/v1/equipe` já existe; há quatro funções em `api/v1`, dentro do limite Hobby. | Reutilizar a rota existente; não criar arquivos em `api/v1`. |
| Versionamento | Funcionários e Escala usam `fase8`; Comissões usa `fase11`; o cliente global usa `etapa21-salao-tempo-real`. | Versionar os assets da Equipe com identificador próprio da Etapa 22 e atualizar somente as referências necessárias. |

## Contratos preservados

As coleções permanecem em português e dentro do restaurante ativo: `funcionarios`, `dadosPrivadosFuncionarios`, `escalas` e `comissoes`. O frontend recebe apenas o DTO público. Estados de funcionário permanecem `ativo`, `ferias` e `inativo`; estados de escala permanecem `agendado`, `presente`, `folga`, `falta` e `cancelado`. Turnos e setores permanecem limitados às enumerações aprovadas no backend.

Funcionários continuam podendo ser alterados somente por proprietário e administrador. Escalas continuam restritas a proprietário, administrador e gerente. Comissões continuam somente leitura para os papéis autorizados. Todas as mutações continuarão exigindo sessão, contexto do restaurante, CSRF, origem autorizada, App Check conforme o ambiente e auditoria operacional.

## Lacunas identificadas

A página de Funcionários não expõe visualmente status e percentual de comissão, embora o servidor aceite esses campos. O campo de busca ainda menciona e-mail, mas o DTO público não envia e-mail; a busca deve refletir apenas dados realmente disponíveis. A agenda de Escala inicia com uma janela de cinco dias calculada no cliente e precisa tratar corretamente a data ISO recebida do Firestore. A tela de Comissões depende do primeiro carregamento global e não possui um estado de carregamento ou indisponibilidade específico.

## Escopo da Fase 2

A próxima fase consolidará o bridge sem fixtures locais, os adaptadores de datas e valores monetários, o ciclo de atualização automática e os payloads server-side já aprovados. Também serão acrescentadas validações de consistência para evitar que funcionário, escala ou comissão de outro restaurante apareça na interface.

Nenhuma nova função serverless será criada, nenhuma credencial será adicionada ao frontend, nenhuma estrutura do shell será refeita e nenhum pagamento ou alteração de comissão será implementado.
