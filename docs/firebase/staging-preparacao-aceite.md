# Preparação de Staging — Relatório de aceite

**Projeto:** APEX Food  
**Commit publicado:** `f8131ba` — `Prepara ambiente de homologacao Staging`  
**Branch:** `main`  
**Deployment Vercel:** Ready  
**Firebase Production:** não ativado  
**Firebase Development:** não alterado

## Resultado

A preparação técnica do Staging foi concluída sem alterar a estrutura do sistema, sem reutilizar dados reais e sem criar ou modificar um projeto Firebase. O pacote entregue define a fronteira Development–Staging–Production, fornece um contrato de ambiente seguro, um preflight determinístico e uma matriz executável de homologação.

O resultado está **pronto para receber os dados de configuração do Staging**, mas o ambiente ainda não foi ativado. Isso é intencional: sem um projeto Firebase isolado, uma origem HTTPS estável e um provedor distribuído de rate limit, qualquer ativação seria uma mistura insegura de ambientes.

## Entregas

| Entrega | Arquivo ou resultado |
|---|---|
| Auditoria de ambientes | `docs/firebase/staging-auditoria.md` |
| Template sem segredos | `.env.staging.example` |
| Checklist Firebase/Vercel | `docs/firebase/staging-checklist.md` |
| Matriz de homologação | `docs/firebase/matriz-homologacao.md` |
| Preflight | `scripts/seguranca/verificar-staging.js` |
| Comando npm | `npm run staging:preflight` |
| Testes do preflight | `testes/staging-preflight.test.js` |
| Publicação | Commit `f8131ba` na branch `main` |

## Evidências locais

A suíte completa do clone GitHub foi executada com **49 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados**. O secret scanner respondeu `SEGREDOS_OK`. O preflight aceitou um contrato sintético coerente de Staging e rejeitou os cenários de projeto Development reutilizado, origem HTTP, wildcard, App Check desligado, placeholders, segredos curtos e rate limit não HTTPS.

O preflight nunca imprime valores de variáveis. Ele exige `APP_ENV=preview`, projeto Firebase diferente de `apex-food-6c1cb`, secrets server-side preenchidos e distintos, App Check em `observe` ou `enforce`, rate limit HTTPS, origem HTTPS e allowlist sem wildcard.

## Evidências remotas

O commit `f8131ba` foi localizado na Vercel e o deployment correspondente passou para Ready. O alias específico do deployment redireciona para o SSO da Vercel, o que confirma que seu acesso direto está protegido pela plataforma. No domínio público configurado [apexfood.vercel.app](https://apexfood.vercel.app), o smoke test preparatório passou: `index.html` respondeu HTTP 200 com CSP e HSTS, a nova logo foi encontrada, o manifest respondeu HTTP 200, `/api/v1/health` respondeu HTTP 200 e `/api/v1/eu` sem sessão respondeu HTTP 401.

Essa validação confirma preservação do runtime publicado; não constitui ativação de Staging nem autorização de Production.

## Dados mínimos pendentes para ativação

| Informação | Como deve ser fornecida |
|---|---|
| ID do projeto Firebase Staging | Criar projeto separado de Development e Production |
| Configuração Web do Staging | Enviar identificadores públicos do novo app Web |
| Service account de Staging | Criar conta dedicada com IAM mínimo; inserir a chave somente na Vercel |
| URL HTTPS de homologação | Definir origem estável, sem wildcard |
| Rate limit distribuído | Informar fornecedor/endpoint e cadastrar token exclusivo de Staging na Vercel |
| App Check | Registrar Web App e domínio de Staging; iniciar em `observe` |
| Dados sintéticos | Definir tenant, contas descartáveis e seed sem PII real |
| Backup e alertas | Definir retenção, RPO/RTO e canal operacional |

Não é necessário enviar segredos por mensagem. A configuração correta é inserir os valores diretamente no escopo Preview/Staging da Vercel, depois executar o preflight e o roteiro da matriz. O `FIREBASE_PRIVATE_KEY`, tokens e secrets não devem entrar no Git, no chat, no frontend ou em anexos.

## Decisão de aceite

A preparação de Staging está **aceita tecnicamente**. A próxima fase somente pode iniciar após a criação do projeto Firebase Staging, definição da origem HTTPS e escolha do provedor distribuído de rate limit. Até lá, o sistema permanece em Development, com Production desativado e sem dados reais.

## Referências

[1]: ../../.env.staging.example "Contrato de ambiente Staging"
[2]: staging-auditoria.md "Auditoria da fronteira de ambientes"
[3]: staging-checklist.md "Checklist de configuração do Staging"
[4]: matriz-homologacao.md "Matriz de testes de homologação"
[5]: ../../SECURITY.md "Política de Segurança do APEX Food"
[6]: ../../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
