# Etapa 12 — Relatório de aceite técnico

**Projeto:** APEX Food  
**Commit publicado:** `e0f6070` — `Implementa hardening de seguranca da Etapa 12`  
**Branch:** `main`  
**Deployment:** Production da Vercel, `apexfood.vercel.app`  
**Estado do deployment:** Ready  
**Ambiente Firebase utilizado:** Development

## Resultado executivo

A implementação autorizada da Etapa 12 foi concluída e publicada sem alterar o shell único, as 27 rotas, a identidade visual, o roteamento por hash ou as integrações Firebase das etapas anteriores. O escopo entregue é o endurecimento reversível de segurança e a preparação do go-live gradual.

O sistema está **pronto para iniciar homologação controlada**, mas **não está declarado como go-live de Production aprovado**. O projeto continua respeitando a decisão de trabalhar exclusivamente em Development por enquanto, sem ativar Production no Firebase, sem criar dados reais de clientes e sem promover um canary de tenant.

## Entregas realizadas

| Entrega | Resultado |
|---|---|
| Headers globais Vercel | CSP, HSTS, anti-framing, `nosniff`, Referrer Policy, Permissions Policy, COOP, CORP e políticas cross-domain |
| Rate limiting | Development local; Preview/Staging/Production distribuído e fail-closed por contrato HTTP |
| App Check | Verificador server-side com modos `off`, `observe` e `enforce` |
| Readiness | Health check com gates de lançamento para ambientes superiores |
| Autenticação | Login, cadastro e recuperação aguardam rate limit antes do Firebase |
| Rotas protegidas | Identidade, restaurantes, Cardápio, Salão, Equipe e Financeiro marcados para App Check opt-in |
| Secret scanning | Scanner versionado e executado sem achados |
| Documentação | `SECURITY.md`, `RUNBOOK-INCIDENTES.md`, auditoria e relatório da Etapa 12 |
| GitHub | Código e documentação publicados no commit `e0f6070` |

## Evidências locais

A linha de base anterior possuía 39 testes aprovados. Após a implementação, a suíte completa apresentou **45 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados**. Também foram aprovados `node --check` nos arquivos JavaScript alterados, validação JSON de `vercel.json` e `package.json`, e `npm run seguranca:segredos` sem achados.

Os seis novos contratos cobrem rate limiting local, fail-closed sem provedor em Preview, resposta permitida do provedor distribuído, modos de App Check, headers globais preservando os rewrites e scanner de segredos.

## Evidências remotas

O deployment `e0f6070` passou de Building para Ready na Vercel. No domínio [apexfood.vercel.app](https://apexfood.vercel.app), o shell, a autenticação e o manifest responderam HTTP 200. A nova logo permaneceu referenciada e a inspeção visual confirmou que os scripts de interface e o UI/UX da autenticação continuaram funcionais depois da CSP.

| Verificação remota | Resultado |
|---|---:|
| Headers globais de segurança | Confirmados |
| `frame-ancestors 'none'` | Confirmado |
| `/api/v1/health` | HTTP 200, estado `ok` |
| `/api/v1/auth/csrf` | HTTP 200 |
| `/api/v1/eu` sem sessão | HTTP 401, `NAO_AUTENTICADO` |
| Origem inválida | HTTP 403, `ORIGEM_NAO_PERMITIDA` |
| Login sem CSRF | HTTP 403, `CSRF_INVALIDO` |
| Autenticação publicada | HTTP 200 e visual preservado |
| Manifest e logo | HTTP 200 |

## Pendências para homologação e go-live

| Pendência | Por que ainda bloqueia Production |
|---|---|
| Projeto Firebase Staging separado | O ambiente atual é Development e não deve receber testes de clientes reais |
| Provedor distribuído de rate limit | As variáveis `RATE_LIMIT_URL` e `RATE_LIMIT_TOKEN` ainda não foram configuradas para um fornecedor real |
| App Check | Development permanece em `off`; é necessário observar falsos positivos e testar `enforce` com o cliente Web aprovado |
| Backup e restauração | Não há evidência de restauração em banco novo nem RPO/RTO aprovados |
| Alertas operacionais | É necessário configurar alertas de Auth, API, abuso, custo, latência e Firestore |
| Canary | Ainda não foi liberado tenant interno nem grupo pequeno |
| CI hospedado | O scanner e os testes estão versionados; o workflow GitHub Actions foi preparado, mas o token atual não possui a permissão `workflows` para publicá-lo |

## Decisão de aceite

A Etapa 12 está **tecnicamente concluída no recorte aprovado para Development e preparação de homologação**. Nenhuma alteração de Production, Firebase Production, backup real ou credencial foi executada. A próxima ação segura é configurar Staging e executar a homologação controlada antes de qualquer go-live.

## Referências

[1]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[2]: ../../SECURITY.md "Política de Segurança do APEX Food"
[3]: ../../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
[4]: ../../../tmp/apex-etapa12-deploy-check.md "Registro do smoke test remoto"
