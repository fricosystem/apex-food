# Ambientes do APEX Food

**Status:** Development definido; produção não configurada. O Preview usará o domínio gratuito `.vercel.app` quando o projeto for publicado.

## Objetivo

Separar completamente desenvolvimento, preview/staging e produção antes de conectar a API server-side ao Firestore. Nenhum ambiente de teste deve apontar para dados reais de clientes.

## Matriz de ambientes

| Ambiente | Firebase | Vercel | Origem permitida | Dados |
|---|---|---|---|---|
| Development | `apex-food-6c1cb` | Execução local | `http://localhost:4173` | Seeds descartáveis e usuários de teste |
| Preview/Staging | `apex-food-6c1cb` temporariamente, somente para Development | Preview Deployment | `https://<projeto-vercel>.vercel.app` | Dados sintéticos e tenant interno; sem dados reais |
| Production | Não configurado | Não configurado | Não configurado | Nenhum dado de produção |

## Variáveis por ambiente

Cada ambiente deve possuir seu próprio conjunto de variáveis na Vercel. Nunca copiar a `FIREBASE_PRIVATE_KEY`, `SESSION_SECRET`, `CSRF_SECRET` ou credencial de rate limit entre ambientes. A configuração Web pública pode identificar o projeto, mas não autoriza acesso.

| Variável | Development | Preview/Staging | Production |
|---|---|---|---|
| `APP_ENV` | `development` | `preview` | `production` |
| `FIREBASE_PROJECT_ID` | Projeto Dev | Projeto Staging | Projeto Production |
| `APP_ORIGIN` | `http://localhost:4173` | Domínio Preview aprovado | Domínio oficial HTTPS |
| `ALLOWED_ORIGINS` | localhost | Preview + domínio staging | Somente domínio oficial |
| `FIREBASE_PRIVATE_KEY` | Secret Dev | Secret Staging | Secret Production exclusivo |
| `SESSION_SECRET` | Secret Dev | Secret Staging | Secret Production exclusivo |
| `CSRF_SECRET` | Secret Dev | Secret Staging | Secret Production exclusivo |
| `APEX_DESENVOLVEDOR_UID` | UID aprovado do Desenvolvedor Dev | UID aprovado de staging | UID aprovado de produção |
| `APEX_DESENVOLVEDOR_EMAIL` | Email aprovado opcional | Email aprovado opcional | Email aprovado opcional |

## Regras de separação

1. O Firebase CLI deve exigir confirmação visual do projeto ativo antes de qualquer deploy.
2. Seeds locais devem falhar se `APP_ENV=production`.
3. Testes automatizados devem usar Emulator Suite ou projeto staging.
4. Preview da Vercel não deve receber variáveis de produção.
5. O domínio de produção deve ser o único autorizado para cookies de produção.
6. Logs de desenvolvimento não podem conter credenciais reais.
7. A promoção para produção deve ser manual e depender de CI, aprovação e rollback documentado.

## Pendências para concluir a Etapa 1

- Confirmar o nome final do projeto Vercel para substituir `<projeto-vercel>.vercel.app`.
- Cadastrar o domínio `.vercel.app` real em Authorized Domains quando o deploy existir.
- Criar um projeto Firebase Staging separado antes de qualquer teste com dados persistentes compartilhados.
- Confirmar região do Firestore.
- Cadastrar variáveis sensíveis e os identificadores de acesso global diretamente na Vercel, nunca no Git.
- Preferir `APEX_DESENVOLVEDOR_UID` ao email; `APEX_DESENVOLVEDOR_EMAIL` é opcional e deve apontar para uma conta Firebase Authentication conhecida.
- Nunca colocar senha, token, chave privada, UID autorizado ou email autorizado em HTML, JavaScript público, URL ou localStorage.
- Manter `apex-food-6c1cb` classificado como Development até aprovação explícita de produção.

## Status

A estrutura local e o contrato de variáveis foram criados. O projeto `apex-food-6c1cb` foi assumido somente como Development. O Preview poderá usar temporariamente o mesmo projeto Development com dados sintéticos e domínio gratuito `.vercel.app`; o valor oficial do ambiente no preflight é `APP_ENV=preview`; produção permanece desativada.
