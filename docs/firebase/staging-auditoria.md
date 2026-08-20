# Auditoria da fronteira de ambientes — Staging APEX Food

**Status:** auditoria inicial concluída  
**Projeto Firebase atualmente utilizado:** Development  
**Domínio público atual:** `https://apexfood.vercel.app`  
**Objetivo:** preparar homologação sem reutilizar dados reais, sem alterar Development e sem ativar Firebase Production.

## Diagnóstico

O contrato atual identifica três modos de aplicação — `development`, `preview` e `production` — mas o workspace só possui valores exemplificativos de Development. O projeto Firebase configurado no frontend e no backend é `apex-food-6c1cb`, tratado nesta fase como Development. Não há evidência de um segundo projeto Firebase isolado para Staging nem de credenciais de Staging disponíveis no repositório.

A Vercel apresenta os deployments da branch `main` com o rótulo `Production`. Esse rótulo descreve o ambiente de deployment da Vercel e não deve ser confundido com a ativação do Firebase Production. A separação de segurança depende das variáveis configuradas no projeto e do valor `APP_ENV`; portanto, um deployment Vercel “Production” que aponta para credenciais Firebase Development continua sendo Development do ponto de vista dos dados, mas não deve ser usado para homologação de clientes sem uma fronteira explícita.

> Regra desta preparação: nenhum teste de homologação deve apontar para o projeto Firebase Development que contém a integração funcional atual, e nenhuma credencial de Firebase Production deve ser criada ou inserida nesta etapa.

## Fronteira desejada

| Ambiente | Firebase | Vercel | Dados permitidos | App Check | Rate limit | Estado |
|---|---|---|---|---|---|---|
| Development | `apex-food-6c1cb` | localhost e deploy controlado | Sintéticos e contas de desenvolvimento | `off` | Local | Existente |
| Preview/Staging | Projeto Firebase separado, a criar | Preview ou projeto/alias separado | Sintéticos, contas descartáveis e tenant de homologação | `observe`, depois `enforce` | Distribuído | Pendente |
| Production | Projeto Firebase Production separado | Domínio oficial futuro | Clientes reais | `enforce` | Distribuído | Desativado por decisão do usuário |

## Controles já disponíveis

O contrato `.env.example` já separa `APP_ENV`, `APP_CHECK_MODE`, `RATE_LIMIT_URL`, `RATE_LIMIT_TOKEN`, `APP_ORIGIN` e `ALLOWED_ORIGINS`. A configuração `vercel.json` mantém os quatro rewrites operacionais consolidados e headers globais de segurança. O health check já diferencia funcionamento do serviço de prontidão de lançamento em ambientes superiores.

A aplicação não deve compartilhar `SESSION_SECRET`, `CSRF_SECRET`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` ou token do provedor de rate limit entre ambientes. Mesmo que a interface pública do Firebase contenha identificadores semelhantes, cada ambiente deve possuir projeto, credenciais server-side, origem autorizada, cookies e dados de teste próprios.

## Bloqueadores identificados

| Bloqueador | Impacto | Ação necessária |
|---|---|---|
| Projeto Firebase Staging inexistente ou não informado | Não há isolamento de dados para homologação | Criar projeto separado e fornecer somente os identificadores/configuração autorizados |
| Credenciais server-side de Staging ausentes | API não pode acessar Staging com segurança | Criar service account dedicada, com IAM mínimo, e cadastrar secrets apenas na Vercel |
| Origem HTTPS de Preview/Staging não definida | CORS, cookies `__Host-` e readiness não podem ser validados corretamente | Definir URL estável de homologação e allowlist exata |
| Rate limit distribuído não configurado | Preview/Staging deve falhar fechado, como desenhado | Escolher fornecedor, criar namespace de homologação e cadastrar URL/token |
| App Check Web não registrado para Staging | Não é seguro ativar `enforce` | Registrar app Web/domínios de Staging, validar `observe` e então promover |
| Backup/restauração e alertas não ensaiados | Não há evidência de continuidade operacional | Testar em banco novo e aprovar RPO/RTO antes do canary |

## Decisão da auditoria

A preparação pode avançar sem tocar no Firebase Development: criar o checklist, o contrato de variáveis, o preflight automatizado e a matriz de testes. A ativação efetiva de Staging depende de três informações externas que não devem ser inventadas no código: projeto Firebase Staging, URL de homologação e provedor distribuído de rate limit.

Nenhuma variável real será solicitada ou gravada no repositório. Quando a ativação for autorizada, os segredos deverão ser inseridos diretamente no ambiente Preview/Staging da Vercel, nunca em HTML, JavaScript público, localStorage, anexos ou commits.

## Referências

[1]: ../../.env.example "Contrato de ambientes do APEX Food"
[2]: ../../vercel.json "Rewrites e headers da Vercel"
[3]: ../../api/v1/health.js "Readiness server-side"
[4]: ../../SECURITY.md "Política de Segurança do APEX Food"
[5]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
