# Fase 12 — Publicação e operação

**Projeto:** APEX Food  
**Ambiente validado:** Development na Vercel (`apexfood.vercel.app`)  
**Data:** 20/08/2026  
**Status:** Revisada e concluída em Development  
**Autor:** Manus AI

## Escopo

Esta fase consolidou o checklist de publicação e operação do APEX Food sem alterar o shell único, os fragmentos HTML, as rotas limpas ou a arquitetura server-side. O objetivo foi confirmar que o deployment Development está funcional, que os controles de segurança permanecem ativos e que nenhuma decisão de Production foi tomada automaticamente.

## Evidências remotas

| Área | Evidência | Resultado |
|---|---|---|
| API | `/api/v1/health` | HTTP 200, `ambiente: development`, estado `ok` |
| Readiness | `/api/v1/health?modo=prontida` | HTTP 200 sem bloqueadores no Development |
| Headers | CSP, HSTS, anti-frame, nosniff, Referrer Policy, Permissions Policy, COOP/CORP | Confirmados pelo domínio público |
| Sessão | `/api/v1/auth/session` e `/api/v1/eu` sem sessão | HTTP 401, sem dados operacionais |
| Agregador | Módulos `pedidos`, `cardapio`, `salao`, `equipe` e `financeiro` sem sessão | HTTP 401 |
| CSRF | `/api/v1/auth/csrf` | Cookie `__Host-apex_csrf` com `Secure`, `SameSite=Lax` e `Path=/` |
| Firestore | `firestore.rules` | `allow read, write: if false` mantido no repositório |
| PWA | `manifest.webmanifest` | HTTP 200, idioma `pt-BR`, escopo `/`, ícone PNG APEX Food |
| URLs | `vercel.json` e shell | Clean URLs, redirects legados e rewrites preservados |
| Repositório | Branch `main` | Sincronizada no commit `0ca8f65` |

## Configuração autorizada

O ambiente autorizado permanece **Development**. As variáveis de Development continuam configuradas na Vercel e não devem ser copiadas para o Git, para o frontend, para anexos ou para mensagens. O arquivo `.env.example` contém somente placeholders e não representa credenciais ativas.

> **Production não está aprovada.** Um health check HTTP 200 confirma funcionamento do serviço no ambiente atual, mas não substitui homologação, rate limit distribuído, App Check em enforcement, backup/restauração, canary, monitoramento e aprovação operacional.

## Checklist de manutenção

| Frequência | Ação operacional | Evidência esperada |
|---|---|---|
| Antes de cada publicação | Executar `node --test testes/*.test.js`, `npm run seguranca:segredos` e `git diff --check` | Suíte sem falhas, scanner limpo e diff sem erros |
| Depois de cada publicação | Acompanhar o deployment até estado Ready e verificar `/api/v1/health` | Deployment disponível e health coerente com Development |
| Depois de cada publicação | Testar uma rota pública, uma rota de relatório, manifesto e headers | HTTP 200, shell carregado e controles de segurança presentes |
| Em qualquer incidente | Seguir `RUNBOOK-INCIDENTES.md` antes de alterar dados ou secrets | Contenção, evidência mínima, correção e rollback documentados |
| Antes de homologação | Criar projeto Firebase separado e ambiente Preview/Staging | Projeto, secrets, origem HTTPS, rate limit e dados descartáveis separados |

## Pendências para uma futura promoção

O repositório GitHub permanece público e não possui workflow GitHub Actions ativo. A alteração de visibilidade é uma decisão administrativa que deve ser tomada antes de qualquer conteúdo interno ser adicionado; ela não foi executada automaticamente. A publicação de workflows também depende da permissão `workflows` do token de integração.

Ainda não foram executados backup/restauração em banco novo, ensaio de RPO/RTO, canary de tenant, monitoramento de custo/latência/abuso, fornecedor distribuído de rate limit ou teste de App Check em `enforce`. Portanto, nenhum desses itens deve ser tratado como concluído por esta fase.

## Critérios de promoção para homologação e Production

A próxima promoção deverá usar um projeto Firebase separado, dados descartáveis e domínio HTTPS próprio do ambiente. O ambiente superior deverá exigir `APP_CHECK_MODE=observe` inicialmente, evoluindo para `enforce` somente após análise de falsos positivos; o rate limit distribuído deverá responder aos cenários permitido, bloqueado, timeout e indisponibilidade; e a allowlist de origem deverá conter somente os domínios exatos autorizados.

Antes do go-live, será necessária uma restauração comprovada em banco novo, validação de isolamento por tenant, revisão de IAM mínimo, canary controlado, rollback testado, alertas operacionais e aprovação explícita do responsável pelo negócio.

## Referências

[1]: ../SECURITY.md "Política de Segurança do APEX Food"
[2]: ../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
[3]: ../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[4]: ../vercel.json "Configuração de publicação e segurança da Vercel"
[5]: ../firestore.rules "Regras deny-by-default do Cloud Firestore"
