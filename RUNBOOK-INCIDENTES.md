# Runbook de Incidentes — APEX Food

**Escopo:** autenticação, sessão, API server-side, Firestore e Vercel  
**Ambiente atual:** Development; Production permanece desativada  
**Princípio:** conter primeiro, investigar com evidência mínima necessária e restaurar somente após validação.

## Classificação inicial

| Sinal | Prioridade | Primeira ação |
|---|---:|---|
| Chave privada, token de rate limit ou segredo de sessão exposto | Crítica | Revogar/rotacionar imediatamente e pausar promoção |
| Acesso cruzado entre restaurantes ou falha de autorização | Crítica | Desabilitar rota/feature afetada e revogar sessões suspeitas |
| 5xx, 401/403 ou 429 em volume anormal | Alta | Comparar janela de deploy, logs estruturados e configuração de origem |
| App Check com falso positivo em cliente válido | Média | Manter `observe`, identificar domínio/app e não ativar enforcement global |
| Latência ou custo elevado sem evidência de acesso indevido | Média | Reduzir limites, revisar consultas/paginação e preservar métricas |

## Contenção em até 15 minutos

Primeiro registrar horário UTC, ambiente, deployment, rota afetada, `requestId` disponível e pessoa responsável. Não copiar senha, cookie, token, `private_key`, email completo ou payload financeiro para tickets ou chats.

Em seguida, pausar qualquer promoção e identificar se o incidente está restrito ao Development, Preview/Staging ou Production. Para uma rota vulnerável, desabilitar a feature flag ou fazer rollback para o deployment anterior conhecido. Se a falha envolver sessão, revogar sessões Firebase dos usuários afetados e expirar cookies por redeploy controlado.

Se houver credencial exposta, revogar a credencial original antes de criar a substituta. Atualizar somente a variável sensível no ambiente correto da Vercel, fazer redeploy e confirmar que o valor antigo não aparece no Git, bundle, logs ou respostas. Nunca apagar evidência antes de registrar o hash do commit, horário e escopo.

## Investigação segura

Usar logs estruturados para correlacionar `requestId`, rota, método, status, duração e código de erro. Os logs do APEX Food não devem ser ampliados para incluir tokens, cookies, headers de autorização, senhas, `idToken`, `private_key`, documentos completos ou dados financeiros.

Verificar se a origem da requisição pertence à allowlist, se o CSRF foi validado, se a sessão estava ativa, qual restaurante foi derivado pelo servidor e qual autorização foi aplicada. Para suspeita de IDOR/BOLA, reproduzir somente com contas descartáveis de Development/Staging e IDs sintéticos.

## Recuperação

Depois da correção, executar a suíte completa de contratos, o scanner de segredos, testes negativos de origem/CSRF/App Check/rate limit e smoke test remoto. Confirmar headers, cookies, health/readiness e ausência de dados sensíveis no corpo de erro.

Para dados Firestore, restaurar primeiro em banco novo de Staging. Conferir contagem de documentos, índices, estados financeiros, auditoria, acesso por tenant e consistência das coleções. Nunca sobrescrever Production diretamente como primeiro teste de restauração.

## Comunicação e encerramento

O incidente só pode ser encerrado após identificar causa provável, escopo de tenants, janela temporal, credenciais potencialmente afetadas, correção aplicada, evidências de validação e decisão de risco. Registrar se houve impacto em dados pessoais, financeiros, disponibilidade ou integridade.

O relatório pós-incidente deve conter uma linha do tempo, comandos/ações aprovados, deployments envolvidos, testes executados e medidas preventivas. O responsável de negócio deve aprovar a reabertura gradual, começando por tenant interno quando o ambiente permitir.

## Rollback mínimo

O rollback padrão é retornar ao último deployment Ready conhecido, desabilitar a feature flag que introduziu a falha e manter os secrets rotacionados. Não reverter secret rotation apenas para restaurar compatibilidade. Se a versão anterior tiver vulnerabilidade de segurança, manter a rota bloqueada e aplicar hotfix antes de reabrir.

## Contatos e dados a preencher

| Item | Valor a preencher pelo responsável |
|---|---|
| Responsável Firebase | Definir fora do repositório |
| Responsável Vercel | Definir fora do repositório |
| Canal de incidente | Definir fora do repositório |
| RPO aprovado | Definir com o negócio |
| RTO aprovado | Definir com o negócio |
| Provedor de rate limit | Configurar em Preview/Production |
| Projeto Staging | Criar antes do canary |
