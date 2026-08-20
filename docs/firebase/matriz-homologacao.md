# Matriz de homologação — APEX Food Staging

**Escopo:** validação funcional, autorização multi-tenant, segurança e operação em Staging.  
**Dados:** exclusivamente sintéticos e descartáveis.  
**Critério:** cada caso deve ser executado com `requestId`, status, duração e resultado; não anexar tokens, cookies, senhas, emails completos ou payloads financeiros.

## Controles de ambiente

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| ENV-01 | Origem válida | Abrir a origem HTTPS de Staging | Página 200 e CSP presente | URL, horário e headers |
| ENV-02 | Origem inválida | Enviar `Origin` não autorizado | HTTP 403 `ORIGEM_NAO_PERMITIDA` | Status e `requestId` |
| ENV-03 | Projeto isolado | Criar conta sintética em Staging | Conta não aparece em Development | IDs sintéticos dos dois ambientes |
| ENV-04 | Health operacional | Chamar `/api/v1/health` | 200 funcional; readiness coerente | Corpo sem segredos |
| ENV-05 | Preflight | Executar `npm run staging:preflight` | `STAGING_PREFLIGHT_OK` | Saída sem valores |

## Autenticação e sessão

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| AUTH-01 | Cadastro válido | Criar usuário sintético com senha forte | Conta criada sem revelar dados internos | Status e UID mascarado |
| AUTH-02 | Senha fraca | Enviar senha menor que 8 ou sem complexidade | Validação rejeita sem acessar módulo | Status e código |
| AUTH-03 | Enumeração | Recuperar senha para email existente e inexistente | Mensagem pública equivalente | Comparação de respostas sem email |
| AUTH-04 | Login válido | Entrar com usuário sintético | Cookie HttpOnly seguro emitido | Atributos do cookie mascarados |
| AUTH-05 | Login inválido | Usar credencial incorreta | Erro genérico sem enumeração | Status e código |
| AUTH-06 | Logout | Encerrar sessão | Cookie expirado e sessão inválida | Status |
| AUTH-07 | CSRF ausente | Fazer mutação sem token | HTTP 403 `CSRF_INVALIDO` | Status |
| AUTH-08 | Sessão expirada | Reutilizar cookie expirado | HTTP 401 sem dados internos | Status |

## Autorização e multi-tenant

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| TEN-01 | Tenant ativo | Consultar próprio restaurante | Dados somente do tenant sintético | Coleção/rota e contagem |
| TEN-02 | Tenant manipulado | Alterar ID de restaurante no payload | Servidor ignora ou rejeita o valor | Status e código |
| TEN-03 | IDOR/BOLA | Usar ID de documento de outro tenant | HTTP 403/404 genérico | Status |
| TEN-04 | Troca autorizada | Trocar para restaurante permitido | Contexto assinado atualizado | Status |
| TEN-05 | Troca proibida | Trocar para restaurante sem membership | Bloqueio server-side | Status |
| TEN-06 | Role insuficiente | Operador acessar Financeiro restrito | HTTP 403 | Status e papel mascarado |

## Módulos de negócio

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| MOD-01 | Cardápio | Criar/editar produto sintético | Validação, tenant e auditoria corretos | Status e ID mascarado |
| MOD-02 | Salão | Criar reserva sintética concorrente | Transação impede conflito | Status das duas tentativas |
| MOD-03 | Equipe | Consultar funcionário | PII permanece mascarada | Campos retornados, sem valor PII |
| MOD-04 | Escala | Criar jornada válida e inválida | Transação e validação temporal corretas | Status |
| MOD-05 | Financeiro | Criar conta/movimentação em centavos | Valores normalizados no servidor | Status e valores não sensíveis |
| MOD-06 | Fechamento | Repetir mesma operação idempotente | Sem duplicidade; auditoria preservada | Chave idempotência mascarada |
| MOD-07 | Relatórios | Consultar período | Paginação e escopo de tenant respeitados | Status e contagem |

## Resiliência e abuso

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| RES-01 | Rate limit permitido | Enviar tentativa abaixo do limite | Operação prossegue | Status |
| RES-02 | Rate limit excedido | Exceder limite de login | HTTP 429 e `Retry-After`/aguarde | Status |
| RES-03 | Rate limit indisponível | Simular timeout do provedor | HTTP 503 fail-closed | Status e duração |
| RES-04 | App Check observe | Token válido, ausente e inválido | Falhas observadas sem falso bloqueio indevido | Métrica agregada |
| RES-05 | App Check enforce | Promover em janela controlada | Token ausente/inválido bloqueado | Status |
| RES-06 | Payload grande | Enviar corpo acima do limite | HTTP 413/400 sem stack trace | Status |
| RES-07 | XSS | Enviar texto com markup | Escapado e sem execução | Captura sanitizada |
| RES-08 | Logs | Executar fluxos de erro | Sem senha, cookie, token ou PII | Busca de padrões |

## Operação e rollback

| ID | Cenário | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| OPS-01 | Backup | Executar backup de Staging | Arquivo/backup identificado e retido | ID do backup |
| OPS-02 | Restauração | Restaurar em banco novo | Contagens e Rules validadas | Relatório de reconciliação |
| OPS-03 | Alertas | Gerar 401/403/429/5xx sintéticos | Alertas chegam ao canal definido | Horário e alerta |
| OPS-04 | Rollback | Reverter deployment de Staging | Versão anterior funcional e sem perda de isolamento | Deployment IDs |
| OPS-05 | Canary | Liberar tenant interno | Sem acesso cruzado e métricas dentro do limite | Aceite do responsável |

## Critério de aprovação

A homologação só deve ser aprovada quando os casos críticos `ENV-02`, `ENV-03`, `AUTH-07`, `TEN-02`, `TEN-03`, `TEN-06`, `RES-03`, `RES-05`, `RES-08`, `OPS-02` e `OPS-04` estiverem executados sem falha. Um teste funcional verde não compensa falha de isolamento, autorização, segredo, restauração ou rollback.

## Referências

[1]: ../../.env.staging.example "Contrato de variáveis do Staging"
[2]: ../../docs/firebase/staging-checklist.md "Checklist de configuração do Staging"
[3]: ../../SECURITY.md "Política de Segurança do APEX Food"
[4]: ../../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
