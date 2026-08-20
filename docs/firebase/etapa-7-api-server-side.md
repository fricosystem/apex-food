# Etapa 7 — API server-side protegida na Vercel

**Projeto:** APEX Food
**Ambiente:** Development
**Status:** Base implementada e validada localmente; configuração de secrets adicionais e deploy na Vercel dependem do ambiente do projeto.
**Frontend alterado:** não.
**Regras do Firestore abertas:** não.

## 1. Objetivo

A Etapa 7 cria a base server-side para que a página estática não converse diretamente com o Firestore nem mantenha tokens de autenticação no navegador. As funções em `api/` são executadas pela Vercel como funções Node e usam o Firebase Admin SDK somente no servidor.

A sessão é criada a partir de um ID token transitório recebido internamente do fluxo server-side e convertida para o Session Cookie oficial do Firebase Admin. O cookie de sessão é `HttpOnly`, `Secure` fora de Development e `SameSite=Lax`; o ID token não é retornado ao frontend. O Firebase documenta Session Cookies como mecanismo para manter sessões server-side e controlar duração/revogação [1].

> A página `paginas/autenticacao.html` ainda não foi conectada nesta etapa. Essa integração ocorrerá na Etapa 8, depois que o backend estiver configurado na Vercel e validado no ambiente Development.

## 2. Arquivos adicionados

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Dependência `firebase-admin` `13.6.0`, Node `22.x` e comando de testes. |
| `package-lock.json` | Lockfile da dependência server-side. |
| `vercel.json` | Cabeçalhos de segurança e `Cache-Control: no-store` para `/api`. |
| `api/_lib/http.js` | Respostas JSON, parsing limitado, cookies, CORS e erros. |
| `api/_lib/config.js` | Verificação fail-closed das configurações. |
| `api/_lib/origens.js` | Allowlist de origens autorizadas. |
| `api/_lib/middleware.js` | Pipeline de origem, método, CSRF, request ID e erro. |
| `api/_lib/sessao.js` | Firebase Session Cookie, revogação, CSRF e sessão HttpOnly. |
| `api/_lib/contexto.js` | Contexto de restaurante assinado em cookie HttpOnly. |
| `api/_lib/firebase-auth-rest.js` | Cadastro/login Email-Senha via endpoint server-side do Firebase. |
| `api/_lib/autorizacao.js` | Verificação de sessão e membro ativo por restaurante. |
| `api/_lib/limite.js` | Limite de defesa em profundidade para Development. |
| `api/_lib/usuarios.js` | Perfil global em `usuarios/{idUsuario}`. |
| `api/_lib/auditoria.js` | Registros append-only em `registrosAuditoria`. |
| `api/v1/auth/*.js` | CSRF, cadastro, login, sessão e logout. |
| `api/v1/eu.js` | Identidade atual autorizada. |
| `api/v1/health.js` | Health check sem exposição de configuração. |
| `api/v1/restaurantes/*.js` | Listagem e troca explícita de restaurante. |
| `testes/etapa-7-*.test.js` | Testes unitários e de contrato dos controles. |

## 3. Endpoints iniciais

As rotas são arquivos serverless e preservam a convenção de URLs em português para os recursos de negócio.

| Método | Endpoint | Proteção | Resultado |
|---|---|---|---|
| `GET` | `/api/v1/health` | Origem opcional; sem dados sensíveis | Estado mínimo do serviço. |
| `GET` | `/api/v1/auth/csrf` | Origem autorizada | Define cookie CSRF não-HttpOnly para uso no cabeçalho. |
| `POST` | `/api/v1/auth/register` | CSRF, rate limit, Admin configurado | Cria usuário, tenta enviar verificação e cria sessão HttpOnly. |
| `POST` | `/api/v1/auth/login` | CSRF, rate limit, Admin configurado | Autentica e cria sessão HttpOnly. |
| `GET` | `/api/v1/auth/session` | Cookie de sessão | Retorna DTO mínimo da sessão. |
| `POST` | `/api/v1/auth/logout` | Sessão e CSRF | Revoga refresh tokens e limpa cookies. |
| `GET` | `/api/v1/eu` | Cookie de sessão | Retorna usuário e restaurante ativo, quando houver. |
| `GET` | `/api/v1/restaurantes` | Cookie de sessão | Lista somente restaurantes com membro ativo. |
| `POST` | `/api/v1/restaurantes/trocar` | Sessão e CSRF | Valida vínculo e assina contexto HttpOnly. |

O cadastro e login aceitam somente emails no formato `nome@apexfood.com`. A API aplica a política mínima de 12 caracteres; a política completa configurada no Firebase continua sendo a autoridade final. Mensagens de autenticação são genéricas quando a distinção poderia permitir enumeração de usuários.

## 4. Sessão e armazenamento

O navegador não recebe o ID token do Firebase, não grava token em `localStorage`, `sessionStorage` ou IndexedDB e não escolhe `idUsuario` como autoridade. A sessão usa o cookie oficial do Firebase Admin e é verificada com revogação em cada requisição protegida.

O cookie `apex_contexto` contém somente um contexto de restaurante assinado com `SESSION_SECRET`, com expiração curta. O cliente pode solicitar troca de restaurante, mas o backend confirma o documento `restaurantes/{idRestaurante}/membros/{idUsuario}` antes de assinar o novo contexto. A assinatura impede que a alteração do valor no navegador escolha outro restaurante.

O cookie CSRF não é HttpOnly por desenho, pois o cliente precisa copiá-lo para `X-CSRF-Token`; ele não é token de sessão. O backend exige igualdade entre cookie e cabeçalho e valida HMAC com `CSRF_SECRET`. A proteção segue o padrão de token anti-CSRF para requisições que alteram estado [2].

## 5. Autorização multi-restaurante

A autorização efetiva é resolvida nesta ordem:

1. A API valida o Session Cookie Firebase e verifica revogação.
2. O backend obtém `idUsuario` do cookie verificado, nunca do corpo da requisição.
3. O contexto assinado fornece o restaurante ativo, ou a troca explícita solicita um restaurante candidato.
4. O Firestore Admin consulta `restaurantes/{idRestaurante}/membros/{idUsuario}`.
5. O vínculo precisa existir, ter `estado: "ativo"`, conter os IDs coerentes e fornecer `papeis` válidos.
6. O endpoint aplica a matriz de papéis antes de qualquer alteração operacional.

A Etapa 7 ainda não implementa endpoints dos módulos de pedidos, cardápio, salão, equipe e financeiro. Ela prepara o resolvedor comum para que cada módulo futuro use a mesma regra, sem confiar em parâmetros do frontend.

## 6. Variáveis da Vercel

As três variáveis Firebase já configuradas pelo responsável continuam necessárias. Para que o health check e a sessão funcionem, também devem existir as variáveis abaixo nos ambientes **Development** e **Preview** da Vercel.

| Variável | Valor/origem | Observação |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `apex-food-6c1cb` | Já configurada. |
| `FIREBASE_CLIENT_EMAIL` | Service Account Development | Já configurada; não publicar. |
| `FIREBASE_PRIVATE_KEY` | Campo `private_key` | Já configurada; não publicar. |
| `FIREBASE_WEB_API_KEY` | `apiKey` da configuração Web | Usada somente pelo backend para chamar Authentication. |
| `SESSION_SECRET` | Segredo aleatório longo | Assina o contexto de restaurante; nunca reutilizar em outro projeto. |
| `CSRF_SECRET` | Segredo aleatório longo diferente | Assina tokens CSRF. |
| `SESSION_TTL_SECONDS` | `28800` | Oito horas; dentro do limite aceito pelo Session Cookie. |
| `APP_ENV` | `development` | Não usar `production` enquanto o projeto estiver Development-only. |
| `APP_ORIGIN` | URL exata do frontend | Ex.: `https://projeto.vercel.app`. |
| `ALLOWED_ORIGINS` | Lista separada por vírgulas | Não usar `*`; incluir somente origens do projeto. |
| `RATE_LIMIT_URL` | Provedor distribuído | Obrigatório antes de habilitar autenticação em Production. |
| `RATE_LIMIT_TOKEN` | Token do provedor | Nunca colocar no frontend. |

Os secrets podem ser gerados localmente com um gerador criptograficamente seguro e cadastrados diretamente na Vercel; não devem ser enviados por chat ou commitados. O arquivo `.env.example` contém apenas placeholders.

> O fallback de rate limit desta etapa é somente uma defesa local para Development. Memória da função serverless não é uma fonte distribuída de controle. Antes de qualquer Production, deverá existir um provedor distribuído configurado e testado.

## 7. Restrições e decisões de segurança

O middleware rejeita origens fora da allowlist, limita o corpo JSON a 64 KiB, envia `Cache-Control: no-store`, adiciona `X-Content-Type-Options: nosniff`, rejeita métodos inesperados e gera um `idRequisicao` para correlação.

O health check nunca exibe nomes de variáveis ausentes, email de Service Account, projeto secreto, stack trace ou chave privada. Logs estruturados registram apenas evento, request ID, método, rota, status e duração; payloads, cookies, Authorization headers e senhas não são gravados.

O Admin SDK contorna as Firestore Security Rules, portanto a API deve autorizar cada comando antes de usar o Firestore. O resolvedor de membro e o middleware foram separados justamente para impedir que uma futura rota operacional implemente somente `request.auth != null`.

## 8. Validação local

A suíte executada foi:

```text
npm test
```

Resultado confirmado:

| Grupo | Resultado |
|---|---|
| Email `@apexfood.com` e normalização | Aprovado |
| Política mínima de senha | Aprovado |
| Emissão/validação CSRF | Aprovado |
| Assinatura do contexto sem localStorage | Aprovado |
| Health sem secrets | `503`, sem vazamento |
| Rota protegida sem sessão | `401` |
| Origem não autorizada | `403` |
| Mutação sem CSRF | `403` |
| Total | **8/8 testes aprovados** |

Também foi executado `node --check` em todas as funções da API e no adaptador `backend/firebase/admin.js`, sem erros de sintaxe.

## 9. Pendências para fechar a Etapa 7 no ambiente remoto

Ainda é necessário cadastrar as variáveis adicionais da seção 6 na Vercel, confirmar o domínio `.vercel.app` real em `APP_ORIGIN`/`ALLOWED_ORIGINS`, publicar o código e chamar `/api/v1/health` no Preview. Essa validação remota não será considerada concluída sem resposta `estado: "ok"` e sem exposição de secrets.

O deploy remoto e a configuração de novas variáveis devem ocorrer antes da Etapa 8. A página de autenticação existente continua intacta até a aprovação da validação remota.

## Referências

[1]: https://firebase.google.com/docs/auth/admin/manage-cookies "Manage Session Cookies — Firebase Authentication"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "Cross-Site Request Forgery Prevention Cheat Sheet — OWASP"
[3]: https://vercel.com/docs/functions "Vercel Functions documentation"
[4]: https://firebase.google.com/docs/admin/setup "Add the Firebase Admin SDK to your server — Firebase"

## 10. Auditoria de dependências e correção do runtime

A auditoria executada com `npm audit --omit=dev --audit-level=high` não encontrou vulnerabilidades de alta ou crítica severidade. A cadeia transitiva atual reportou seis ocorrências **moderadas** relacionadas ao pacote `uuid` em dependências de transporte usadas pelo Firebase Admin SDK. A correção automática proposta pelo NPM exigiria `npm audit fix --force` e faria downgrade do `firebase-admin` para a versão `10.3.0`, uma alteração de versão major que não será aplicada sem avaliação, testes de compatibilidade e decisão explícita.

A dependência direta foi ajustada para `firebase-admin@13.6.0` após o deploy `29f4e4a` apresentar `ERR_REQUIRE_ESM`: `jwks-rsa@4.1.0` carregava `jose@6.x` por `require()`, incompatível com o módulo ESM no runtime da Vercel. A série 13.6.0 usa `jwks-rsa@3.2.2` e `jose@4.15.9` CommonJS. O lockfile foi atualizado e a suíte local continuou com 8/8 testes aprovados. O risco moderado transitivo foi documentado para revisão no CI e em atualizações futuras; não será aplicado downgrade forçado sem testes.

## 11. Validação remota concluída

Após o push do commit `eb47570`, a Vercel criou o deploy de Production `4CacpeGnLE3ZheJmKkhhDTTkww5u`, com estado `Ready`. A variável `FIREBASE_WEB_API_KEY` foi cadastrada em Production e Preview sem expor seu valor.

O endpoint público `https://apexfood.vercel.app/api/v1/health` foi testado após o redeploy e retornou exclusivamente:

```json
{"estado":"ok","ambiente":"development","servico":"apex-food-api"}
```

A resposta confirma que a função server-side está carregando as variáveis necessárias e que o Firebase Admin consegue inicializar sem revelar secrets. A Etapa 8 permanece bloqueada até aprovação explícita.
