# Checklist de configuração do Staging — APEX Food

**Objetivo:** criar um ambiente de homologação isolado para validar o APEX Food antes de qualquer decisão sobre Production.  
**Regra:** não reutilizar o projeto Firebase Development `apex-food-6c1cb`, não usar dados reais e não publicar segredos no Git.

## 1. Criar e identificar o projeto Firebase de Staging

Criar um projeto Firebase separado, com nome identificável como `apex-food-staging` ou equivalente aprovado pelo responsável. Habilitar somente os produtos necessários para homologação: Authentication com email/senha, Cloud Firestore e App Check. Não importar usuários reais nem copiar documentos de clientes.

Registrar o identificador do projeto, domínio `firebaseapp.com`, bucket, sender ID, app ID e API key Web no arquivo local não versionado do responsável. A API key Web é um identificador público do projeto, mas deve apontar para Staging; credenciais administrativas continuam server-side.

| Item Firebase | Valor esperado | Evidência |
|---|---|---|
| Projeto | Diferente de Development e Production | ID do projeto aprovado |
| Authentication | Email/senha com política igual ou mais forte | Captura/configuração do Console |
| Firestore | Banco separado e Rules deny-by-default | Rules publicadas e teste negativo |
| App Check | Web App de Staging registrado | Token observado em homologação |
| IAM | Service account dedicada e menor privilégio | Lista de papéis revisada |
| Dados | Sintéticos e descartáveis | Registro de seed sem PII real |

## 2. Configurar Authentication e Firestore

Reproduzir a política de senha mínima de 8 caracteres com maiúscula, minúscula, especial e número. Ativar proteção contra enumeração quando disponível. Criar regras Firestore deny-by-default e manter as operações do aplicativo passando pela API server-side. Validar que uma conta de teste de Staging não aparece no projeto Development.

Criar apenas um tenant de homologação, com nome explícito e dados sintéticos. Usar emails de teste que não pertençam a clientes reais. Registrar no relatório somente UIDs ou identificadores descartáveis, nunca senhas, tokens ou documentos completos.

## 3. Registrar App Check Web

Registrar o domínio Web e os domínios de Preview efetivamente usados pelo Staging. Iniciar com `APP_CHECK_MODE=observe`. Executar login, cadastro, sessão, Cardápio, Salão, Equipe e Financeiro com contas sintéticas e acompanhar falhas. Só promover para `enforce` depois de confirmar que todos os clientes válidos recebem tokens e que não há falsos positivos.

App Check não substitui Authentication, CSRF, autorização multi-tenant, Rules ou IAM. A ativação deve ser feita no projeto Staging, nunca no Development durante esta preparação.

## 4. Configurar variáveis na Vercel

No projeto Vercel `apexfood`, cadastrar as variáveis abaixo exclusivamente no escopo **Preview** ou no projeto Vercel separado de Staging. Não usar Production e não copiar valores de Development. Cada segredo deve ser gerado novamente para Staging.

| Variável | Regra de Staging |
|---|---|
| `APP_ENV` | `preview` |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase Staging |
| `FIREBASE_WEB_API_KEY` | API key Web do Staging |
| `FIREBASE_CLIENT_EMAIL` | Service account dedicada de Staging |
| `FIREBASE_PRIVATE_KEY` | Chave privada dedicada, com quebra de linha válida |
| `SESSION_SECRET` | Segredo novo, exclusivo de Staging |
| `CSRF_SECRET` | Segredo novo, diferente do `SESSION_SECRET` |
| `APP_CHECK_MODE` | `observe` no primeiro ciclo |
| `RATE_LIMIT_URL` | Namespace/endpoint de Staging do provedor distribuído |
| `RATE_LIMIT_TOKEN` | Token novo, exclusivo do namespace de Staging |
| `APP_ORIGIN` | URL HTTPS estável de Staging |
| `ALLOWED_ORIGINS` | A mesma origem exata; sem `*` |

A variável `FIREBASE_PRIVATE_KEY` nunca deve ser colocada em `.env.staging.example`, no HTML, no bundle, no localStorage ou no GitHub. Depois de salvar, fazer redeploy de Preview e confirmar que o valor não aparece em logs ou respostas.

## 5. Configurar origem e cookies

Usar HTTPS e uma origem estável para que o cookie `__Host-apex_sessao` funcione com `Secure`, `HttpOnly`, `SameSite=Lax` e `Path=/`. Não validar Staging por um domínio alternativo que não esteja no `APP_ORIGIN` e `ALLOWED_ORIGINS`. Confirmar que a origem inválida recebe 403 e que mutações sem CSRF recebem 403.

## 6. Configurar rate limiting distribuído

Criar um namespace separado no provedor de rate limit. Aplicar limites mais restritivos para login, cadastro e recuperação de senha, sem compartilhar chaves com Development ou Production. Testar resposta permitida, excesso, timeout, JSON inválido e indisponibilidade. Em todos os casos de indisponibilidade, o backend de Staging deve falhar fechado com 503.

## 7. Seed e roteiro de homologação

Criar três contas sintéticas: administrador do tenant, operador sem permissão financeira e usuário inválido/sem sessão. Criar dados mínimos em Cardápio, Salão, Equipe e Financeiro. Não importar PII, dados bancários ou registros de clientes reais.

O roteiro deve executar login, logout, recuperação genérica, troca de restaurante, leitura e mutação de cada módulo, tentativa de acesso cruzado, role insuficiente, CSRF ausente, origem inválida, payload grande, duplicidade/idempotência financeira e auditoria. Registrar apenas status, `requestId`, duração e resultado; remover emails e payloads dos anexos.

## 8. Critérios de aprovação

| Critério | Aprovação |
|---|---|
| Isolamento | Nenhuma conta/documento de Staging aparece em Development |
| Autorização | IDOR/BOLA, tenant manipulado e role insuficiente bloqueados |
| Sessão | Cookies seguros, expiração e logout confirmados |
| CSRF/CORS | Origem inválida e mutação sem CSRF bloqueadas |
| App Check | Observe sem falsos positivos críticos; enforce testado em janela controlada |
| Rate limit | Permitida, bloqueada e fail-closed comprovados |
| Integridade | Financeiro idempotente, centavos, estados e auditoria preservados |
| Observabilidade | 401/403/429/5xx, custo e latência monitorados |
| Continuidade | Backup e restauração em banco novo ensaiados |
| Rollback | Deployment anterior e procedimento de reversão testados |

## 9. Bloqueio explícito

Não promover para Production enquanto qualquer critério acima estiver sem evidência. O health check `200` sozinho não aprova o go-live. O aceite de Staging deve ser assinado após o relatório de testes, revisão dos logs e aprovação do responsável do negócio.

## Referências

[1]: ../../.env.staging.example "Contrato de variáveis do Staging"
[2]: ../../.env.example "Contrato de Development"
[3]: ../../SECURITY.md "Política de Segurança do APEX Food"
[4]: ../../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
[5]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
