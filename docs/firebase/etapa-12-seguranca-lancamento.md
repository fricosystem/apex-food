# Etapa 12 — Segurança de lançamento e preparação do go-live

**Projeto:** APEX Food  
**Ambiente validado:** Development na Vercel  
**Escopo aprovado:** hardening reversível, evidências automatizadas e preparação para go-live gradual; sem promoção para Production.

## Resumo executivo

A Etapa 12 adicionou controles de segurança de lançamento sem recriar páginas, alterar o shell único ou substituir a arquitetura Firebase server-side. O sistema mantém as 27 rotas, a sessão por cookie HttpOnly, o CSRF em memória, o Firestore deny-by-default e os handlers multi-tenant já concluídos.

O resultado técnico é **pronto para iniciar homologação controlada**, mas não é uma aprovação de go-live de Production. O próprio health check continua distinguindo serviço funcional de prontidão de lançamento e responde com indisponibilidade quando Preview/Staging/Production não possuem rate limit distribuído, App Check em enforcement ou allowlist HTTPS adequada.

## Implementações

| Área | Implementação | Arquivos principais |
|---|---|---|
| Headers | CSP global, HSTS, anti-framing, `nosniff`, Referrer Policy, Permissions Policy, COOP/CORP e bloqueio de políticas cross-domain | `vercel.json` |
| Rate limiting | Fallback em memória apenas em Development; contrato `POST` distribuído, timeout de 1,5 s e fail-closed nos demais ambientes | `api/_lib/limite.js` |
| Autenticação | Login, cadastro e recuperação aguardam o rate limit antes de conversar com Firebase | `api/v1/auth/login.js`, `register.js`, `recuperar.js` |
| App Check | Verificador server-side com modos `off`, `observe` e `enforce`; rotas protegidas marcadas opt-in | `api/_lib/app-check.js`, `middleware.js` e handlers |
| Readiness | Health check com gates de lançamento sem alterar funcionamento do Development | `api/v1/health.js` |
| Secret scanning | Scanner determinístico de PEM, tokens GitHub, AWS, Slack, chaves `sk-` e valores preenchidos de `FIREBASE_PRIVATE_KEY` | `scripts/seguranca/verificar-segredos.js` |
| CI | Workflow de testes e scanner em push e pull request | `.github/workflows/seguranca.yml` |
| Operação | Política de segurança e runbook de incidentes | `SECURITY.md`, `RUNBOOK-INCIDENTES.md` |
| Plano | Status da Etapa 12 e critérios de promoção atualizados | `Plano-Firebase.md` |

## Rate limiting distribuído

Em Development, as chamadas de autenticação usam o contador local existente para permitir testes sem fornecedor externo. Em Preview, Staging e Production, o backend exige `RATE_LIMIT_URL` e `RATE_LIMIT_TOKEN` e envia somente uma chave pseudonimizada, o nome da operação, o limite e a janela. Uma resposta inválida, timeout ou erro do fornecedor interrompe a operação com `503`, evitando fail-open entre instâncias da Vercel.

O fornecedor deve responder com o contrato abaixo:

```json
{"permitido": true}
```

ou, quando excedido:

```json
{"permitido": false, "aguardeSegundos": 60}
```

O token não é retornado ao navegador nem escrito nos logs estruturados.

## App Check e readiness

O App Check server-side suporta três estados. `off` é o estado explícito de Development. `observe` permite analisar tokens presentes sem interromper clientes durante homologação. `enforce` rejeita token ausente ou inválido com mensagem genérica e deve ser ativado antes de qualquer canary de Production.

O health check continua retornando estado funcional no Development. Em ambientes superiores, exige rate limit distribuído, App Check em `enforce`, `APP_ORIGIN` HTTPS e presença da origem na allowlist. Os nomes dos bloqueadores não são expostos em respostas de ambientes superiores.

## Evidências automatizadas

A suíte anterior tinha 39 contratos aprovados. A Etapa 12 adicionou 6 testes: rate limit local, ausência de provedor em Preview, provedor distribuído permitido, modos de App Check, headers globais preservando os quatro rewrites operacionais e scanner sem achados. O total validado é **45 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados**.

Além dos testes, foram executados `node --check` nos arquivos JavaScript alterados e `npm run seguranca:segredos`. Nenhum segredo real foi encontrado no workspace. Placeholders documentais, como `<service-account-private-key>`, são aceitos pelo scanner e não constituem configuração funcional.

## Gaps e bloqueadores de promoção

| Controle | Estado nesta etapa | Próxima evidência necessária |
|---|---|---|
| Development | Operacional e validado | Manter separado de dados reais |
| Preview/Staging | Não habilitado como ambiente Firebase separado | Criar projeto/dados descartáveis e validar domínio |
| Rate limit distribuído | Contrato e fail-closed implementados; fornecedor real não configurado | Testar permitida, 429, timeout e indisponibilidade |
| App Check | Hook server-side implementado; Development em `off` | Registrar Web App, observar falsos positivos e testar `enforce` |
| CSP/HSTS/headers | Versionados e testados estruturalmente | Confirmar headers no deployment Vercel publicado |
| Backup/restauração | Não ensaiados nesta fase | Restaurar em banco novo e aprovar RPO/RTO |
| Alertas | Documentados, sem evidência operacional completa | Configurar Auth, API, custo, latência e abuso |
| Canary | Não iniciado | Tenant interno, grupo pequeno, expansão e rollback |

## Critério de aceite da etapa

A implementação cumpre o recorte aprovado da Etapa 12 no ambiente Development: controles de segurança foram adicionados de forma reversível, os contratos foram testados, os segredos não foram expostos e os bloqueadores de go-live foram explicitamente identificados. O próximo passo operacional é homologação em Preview/Staging, não a ativação direta de Production.

## Referências

[1]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[2]: ../../SECURITY.md "Política de Segurança do APEX Food"
[3]: ../../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
