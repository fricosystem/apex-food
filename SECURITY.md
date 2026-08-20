# Política de Segurança do APEX Food

**Status:** Etapa 12 em implementação controlada  
**Ambiente autorizado nesta fase:** Development na Vercel  
**Responsável técnico do documento:** Manus AI

## Princípio de segurança

O APEX Food mantém uma arquitetura API-only para dados operacionais. O navegador carrega o shell e os fragmentos HTML, mas não recebe credenciais administrativas, tokens de sessão, regras de autorização, dados completos de outros restaurantes ou chaves privadas. A sessão é mantida por cookie `HttpOnly` e o CSRF é protegido por token de dupla submissão em memória no cliente.

> A configuração Web pública do Firebase identifica o projeto, mas não substitui autenticação, autorização, Security Rules, IAM ou App Check. Credenciais de service account, `private_key`, tokens e segredos de sessão pertencem exclusivamente às variáveis server-side da Vercel.

## Controles implementados

| Camada | Controle | Regra operacional |
|---|---|---|
| Transporte | HTTPS e HSTS na configuração Vercel | Aplicado às respostas publicadas; não promover domínio não autorizado |
| Conteúdo | CSP com `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` e `script-src-attr 'none'` | Compatível com os CDNs atualmente usados pelo sistema; revisar ao remover scripts inline |
| Framing | `X-Frame-Options: DENY` e `frame-ancestors 'none'` | Impede incorporação do painel em frames externos |
| Origem | Allowlist por `APP_ORIGIN` e `ALLOWED_ORIGINS` | Nunca usar `*` em rotas autenticadas |
| Mutação | CSRF e validação de `Origin`/`Referer` | Aplicado antes da operação server-side |
| Sessão | Cookie `__Host-apex_sessao` seguro, `HttpOnly`, `SameSite=Lax` e `Path=/` | O frontend não lê nem grava o cookie |
| Dados | Firestore deny-by-default para acesso direto | Operações passam pelos handlers server-side e derivam o restaurante da sessão |
| Abuso | Rate limiting local em Development e contrato distribuído fail-closed em Preview/Staging/Production | Sem provedor distribuído, o endpoint de autenticação não prossegue fora de Development |
| Cliente | App Check com modos `off`, `observe` e `enforce` | Development usa `off`; enforcement deve ser validado antes do go-live |
| Supply chain | Secret scanning no CI | O workflow executa testes e `npm run seguranca:segredos` em push e pull request |

## Variáveis por ambiente

Os valores reais nunca devem ser gravados no repositório. Development pode usar `APP_CHECK_MODE=off` e rate limiting local para validação funcional. Preview/Staging deve usar `APP_CHECK_MODE=observe`, domínio HTTPS real, allowlist explícita e provedor distribuído de rate limit. Production exige `APP_CHECK_MODE=enforce`, provedor distribuído funcional, secrets rotacionáveis e evidência de backup/restauração.

A readiness da API trata `APP_ENV=development` como ambiente funcional, mas rejeita a prontidão de lançamento em ambientes superiores quando rate limit distribuído, App Check enforcement ou allowlist HTTPS estão ausentes. Isso evita que um health check operacional seja interpretado como autorização de go-live.

## Rate limiting distribuído

O contrato server-side envia uma requisição `POST` para `RATE_LIMIT_URL` com `Authorization: Bearer <token>` e corpo contendo uma chave pseudonimizada, o limite e a janela em segundos. O serviço deve responder JSON com `{"permitido": true}` ou `{"permitido": false, "aguardeSegundos": N}`. Respostas inválidas, indisponibilidade, timeout ou ausência de configuração geram erro `503` e não permitem que a operação protegida prossiga em Preview/Staging/Production.

A chave enviada ao provedor não contém email, UID, cookie ou endereço IP em claro. O backend calcula um resumo SHA-256 truncado por nome da operação e origem da requisição. O token do provedor nunca aparece na resposta, no log estruturado ou no bundle público.

## App Check

As rotas protegidas de identidade, restaurante, Cardápio, Salão, Equipe e Financeiro possuem suporte ao verificador server-side. Em `off`, nenhuma verificação é feita. Em `observe`, tokens presentes são verificados e falhas não bloqueiam a operação, permitindo análise de falsos positivos. Em `enforce`, token ausente ou inválido recebe erro genérico `401 APPCHECK_INVALIDO`.

A ativação de `enforce` requer que o cliente Web esteja emitindo tokens App Check válidos e que os domínios autorizados estejam revisados. Portanto, a implementação do hook server-side não é evidência isolada de go-live.

## Resposta a incidentes

Ao identificar vazamento de credencial, suspeita de acesso cruzado ou abuso, a prioridade é conter: pausar a promoção, desabilitar a feature flag afetada, revogar sessões quando aplicável, rotacionar a credencial comprometida, preservar logs sem dados sensíveis e avaliar os restaurantes afetados. O procedimento detalhado está em [RUNBOOK-INCIDENTES.md](RUNBOOK-INCIDENTES.md).

## Critérios para promoção

A Etapa 12 não considera Production aprovada somente porque a rota `/api/v1/health` responde `200`. A promoção exige todos os itens abaixo:

| Critério | Evidência necessária |
|---|---|
| Build e testes | Suíte completa sem falhas e secret scanner sem achados |
| Headers | Validação remota da CSP, HSTS, anti-framing e Permissions Policy |
| Cookies | Sessão e CSRF com atributos seguros em HTTPS |
| Origem | `APP_ORIGIN` e `ALLOWED_ORIGINS` exatos e revisados |
| Rate limit | Provedor distribuído testado com permitida, bloqueada, timeout e indisponibilidade |
| App Check | Observação analisada e enforcement testado com cliente aprovado |
| Firebase | Rules deny-by-default, IAM mínimo e projeto correto confirmado |
| Continuidade | Backup, restauração em banco novo, RPO/RTO e alertas aprovados |
| Operação | Canary de tenant interno, monitoramento e rollback testados |

## Referências

[1]: Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[2]: vercel.json "Headers e rewrites da Vercel"
[3]: api/_lib/middleware.js "Pipeline central de API"
[4]: api/_lib/limite.js "Rate limiting fail-closed"
[5]: api/_lib/app-check.js "Verificação server-side de App Check"
[6]: firestore.rules "Firestore deny-by-default"
