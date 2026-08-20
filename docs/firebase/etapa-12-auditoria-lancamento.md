# Etapa 12 — Auditoria de segurança para lançamento

**Projeto:** APEX Food  
**Ambiente atual:** Development em `apexfood.vercel.app`  
**Commit de referência:** `bae87b3`  
**Status:** auditoria inicial concluída; implementação de hardening autorizada pelo responsável do projeto.

## Objetivo da auditoria

A Etapa 12 do [Plano-Firebase.md](../../Plano-Firebase.md) define o endurecimento de segurança para lançamento, a validação na Vercel e a preparação de um go-live gradual. A auditoria foi limitada ao código e à configuração versionados, sem alterar o ambiente Firebase ou promover o projeto para Production.

## Controles já presentes

| Controle | Evidência atual | Resultado |
|---|---|---|
| Sessão server-side | Cookie `HttpOnly`, `Secure`, `SameSite` e prefixo `__Host-` no runtime Vercel | Presente |
| CSRF | Token de dupla submissão validado em mutações | Presente |
| Origem/CORS | Allowlist por `APP_ORIGIN` e `ALLOWED_ORIGINS` | Presente |
| Logs | Logs estruturados sem senha, token, cookie ou payload completo | Presente |
| Firestore direto no navegador | `firestore.rules` em deny-by-default | Presente |
| Limite de corpo | Helper HTTP limita JSON a 64 KiB | Presente |
| Isolamento multi-tenant | Handlers derivam restaurante da sessão e validam acesso | Presente nas etapas anteriores |
| Testes de contrato | Suíte atual com 39 testes aprovados | Presente |

## Gaps identificados

| Gap | Impacto | Tratamento na Etapa 12 |
|---|---|---|
| Headers de segurança estavam restritos às rotas `/api` | Páginas estáticas não recebiam CSP, HSTS e proteção contra framing | Adicionar headers globais compatíveis com os CDNs e scripts inline existentes |
| Rate limiting distribuído ainda não implementado | `Map` em memória não é consistente entre instâncias Vercel | Manter fail-closed em `APP_ENV=production`, documentar contrato e bloquear o readiness de produção sem provedor configurado |
| Health check validava apenas configuração mínima | Um `200` poderia ser interpretado como prontidão de lançamento sem App Check/rate limit | Acrescentar estado de prontidão e gates de produção sem bloquear Development |
| App Check não possui enforcement automatizado no repositório | Não há evidência versionada de observação, enforcement ou falsos positivos | Documentar como pré-requisito manual e impedir declaração de go-live completo |
| CI não possuía scanner de segredos específico do projeto | Risco de inserir credenciais ou chaves em commits futuros | Adicionar verificação determinística local e workflow de CI |
| Staging/Production ainda não estão habilitados | Não é possível executar canary real nem restauração em ambiente isolado | Preservar Development e entregar checklist de promoção futura |
| Backup/restauração e alertas não têm evidência versionada | Continuidade operacional ainda não pode ser considerada aceita | Manter como bloqueador de go-live e documentar evidências exigidas |

## Decisão de escopo

Nesta etapa serão implementados somente controles reversíveis e compatíveis com o ambiente Development: headers na Vercel, readiness com gates por ambiente, scanner de segredos, testes de contrato e documentação operacional. Não serão alterados o projeto Firebase, as regras deny-by-default, as variáveis da Vercel, o ambiente Production ou a estrutura visual do sistema.

A conclusão técnica da Etapa 12 poderá significar **“pronto para iniciar homologação”**, mas não “go-live de produção aprovado”, enquanto não houver provedor de rate limit distribuído, App Check validado, backups/restauração ensaiados, alertas e ambiente Staging separado.

## Linha de base

A suíte executada antes das alterações apresentou **39 testes aprovados, 0 falhas e 0 testes ignorados**. O clone GitHub está limpo no commit `bae87b3` antes da implementação da Etapa 12.

## Referências

[1]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
