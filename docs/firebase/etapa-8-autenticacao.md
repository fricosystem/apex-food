# Etapa 8 — Integração da autenticação com a API server-side

**Projeto:** APEX Food
**Firebase:** `apex-food-6c1cb` — Development
**Vercel:** `apexfood.vercel.app`
**Status:** Etapa 8 concluída e validada remotamente no ambiente Development; cadastro, login, logout, sessão HttpOnly e guard de rota foram confirmados após o deploy `660364b`.

## 1. Escopo implementado

A página existente `paginas/autenticacao.html` foi conectada à API `/api/v1` sem refazer o layout, sem criar um novo shell e sem alterar a identidade visual. O cliente mantém os mesmos IDs, classes, abas Entrar/Criar conta, campos, máscara contínua `@apexfood.com`, validações, loading, feedback, ícones e redirecionamento para `index.html`.

O login envia `email` e `senha` para `POST /api/v1/auth/login`. O cadastro envia `nomeCompleto`, `email`, `senha e confirmarSenha` para `POST /api/v1/auth/register`. A recuperação usa `POST /api/v1/auth/recuperar` com resposta genérica. O navegador nunca recebe nem persiste o Firebase ID token.

## 2. Sessão e proteção

Antes de qualquer mutação, `scripts/auth/api-client.js` obtém `GET /api/v1/auth/csrf`, conserva o token CSRF apenas em memória durante a página e envia-o no header `X-CSRF-Token`. As requisições usam `credentials: same-origin`, `cache: no-store` e não escrevem em `localStorage`, `sessionStorage` ou IndexedDB.

A API transforma o ID token recebido exclusivamente no backend em Session Cookie Firebase. O cookie de sessão é HttpOnly. No runtime Vercel, os cookies usam `Secure`, `SameSite=Lax`, `Path=/` e prefixo `__Host-`; em desenvolvimento local sem HTTPS, usa-se o nome compatível `apex_sessao`/`apex_csrf` para permitir o servidor local.

O `scripts/auth/sessao-guard.js` verifica `GET /api/v1/auth/session` antes de exibir o shell operacional. Usuários anônimos ou com sessão inválida são redirecionados para `paginas/autenticacao.html`; usuários já autenticados que acessam a página de login são direcionados para `index.html`. O guard não cria elementos visuais e não altera sidebar ou header.

## 3. Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/auth/api-client.js` | Cliente same-origin, CSRF em memória e tratamento de respostas |
| `scripts/auth/auth.js` | Integração dos formulários existentes com login, cadastro e recuperação |
| `scripts/auth/sessao-guard.js` | Proteção inicial do shell e redirecionamentos |
| `paginas/autenticacao.html` | Inclusão dos scripts e `minlength` de 8 caracteres, sem alteração de layout |
| `api/v1/auth/recuperar.js` | Endpoint de recuperação com rate limit e resposta genérica |
| `api/_lib/firebase-auth-rest.js` | Solicitação server-side de redefinição de senha |
| `api/_lib/config.js` | Decisão de cookies seguros no Vercel |
| `api/_lib/sessao.js` | Session Cookie e CSRF |
| `api/_lib/contexto.js` | Cookie assinado de restaurante |
| `testes/etapa-7-endpoints.test.js` | Testes de CSRF, cookies `__Host-` e recuperação |

## 4. Validação local

A suíte local foi ampliada de 8 para 11 testes e passou integralmente. Foram confirmados os contratos de health check, sessão protegida, CORS, CSRF, emissão de token, prefixo seguro no Vercel e bloqueio de recuperação sem CSRF. A sintaxe de todos os arquivos da API e de autenticação foi aprovada com `node --check`.

A verificação estática não encontrou `localStorage`, `sessionStorage`, ID token, refresh token, private key ou client email em `paginas`, `index.html` ou `scripts/auth`.

## 5. Pendências controladas

O fluxo de login e cadastro contra a conta Firebase real foi validado no ambiente Development utilizando uma conta temporária. Foram confirmados cadastro, login válido, sessão por cookie HttpOnly, logout, invalidação da sessão e redirecionamento de usuário anônimo. O envio de email de verificação foi solicitado pelo fluxo, mas não foi aberto nem validado em caixa de entrada.

A Etapa 9 não deve começar antes da aprovação explícita desta etapa. A integração atual não cria automaticamente vínculo de restaurante; o vínculo será tratado pelo schema multi-tenant e pelos endpoints autorizados.

## 6. Validação remota inicial

O commit `19c6fa8` foi publicado no GitHub e o deploy de Production correspondente ficou em estado `Ready`. O domínio `https://apexfood.vercel.app/api/v1/health` retornou `estado: "ok"`, `ambiente: "development"` e `servico: "apex-food-api"`.

O endpoint `GET /api/v1/auth/csrf` também respondeu com status de sucesso e emitiu um token CSRF. O valor do token não foi armazenado neste relatório nem exposto na mensagem ao usuário. A validação de login/cadastro real requer uma conta de teste Development e não será executada sem credenciais fornecidas de forma segura pelo usuário.

A validação visual remota confirmou que a página publicada manteve o layout standalone, a logo APEX Food, o painel de marca, as abas e o campo contínuo `@apexfood.com`. A aba de cadastro exibiu nome completo, email, senha e confirmação, com comportamento responsivo preservado. Nenhum dado foi digitado durante essa inspeção.

## 7. Correção do identificador de email

A validação foi ajustada para aceitar os dois formatos abaixo, sem exigir ponto:

```text
nome@apexfood.com
nome.sobrenome@apexfood.com
```

A parte local aceita letras, números, ponto e hífen em sequência válida; o domínio `@apexfood.com` continua fixo no frontend e também é validado novamente no backend. A causa mais provável da tentativa anterior foi a validação antiga do frontend, que aceitava somente letras, números e hífen e bloqueava um email com ponto antes de a requisição chegar ao Firebase Authentication.

A Vercel identificou o novo deploy de Production do commit `fd04e22`. A primeira inspeção encontrou o deploy ainda em estado `Building`; a validação remota final da correção será feita somente após o estado `Ready`.

O deploy `fd04e22` passou para `Ready` em Production na Vercel. A validação final da página publicada pode prosseguir no domínio principal.

No deploy `fd04e22`, o teste visual com o identificador `nome.teste` exibiu corretamente `nome.teste@apexfood.com` no campo e não mostrou erro de validação. O formulário não foi enviado e nenhuma senha ou credencial foi digitada.

## 8. Diagnóstico da tentativa de cadastro

A requisição real de `POST /api/v1/auth/register` foi localizada nos logs da Vercel com HTTP 400 e duração de 218 ms. O detalhe remoto informou `External APIs: No outgoing requests`, portanto a solicitação foi rejeitada pela validação server-side antes de chamar o Firebase Authentication. O log não contém email, senha ou payload.

Na versão publicada durante a tentativa, a API ainda exigia 12 caracteres em `validarSenha`; por isso, uma senha com 8 a 11 caracteres era rejeitada como `SENHA_INVALIDA` antes de o usuário ser criado. Isso explica por que a conta não apareceu no Firebase Authentication e não indica falha de comunicação com o projeto Firebase.

O Firebase Console foi reaberto autenticado na conta `apexhub3051@gmail.com`; a tela de configurações do Authentication ainda estava carregando e nenhuma política foi alterada neste momento.

A política de senha do Firebase Authentication Development foi atualizada com sucesso no Console: tamanho mínimo `8`, aplicação obrigatória mantida e exigências de maiúscula, minúscula, caractere especial e número preservadas. O tamanho máximo permaneceu `4096`.

Após o deploy `660364b` ficar Ready em Production, a página publicada exibiu os campos de cadastro corretamente. Com confirmação explícita, foi enviado o cadastro de validação com nome `Validação Etapa Oito`, identificador `validacao.etapa8` (domínio fixo aplicado na interface) e senha compatível com a política de 8 caracteres. A resposta da API ainda estava em processamento no momento deste registro.

A página publicada confirmou o cadastro com a mensagem de sucesso e alternou para o login. O login da mesma conta foi enviado e a interface confirmou `Acesso validado`, iniciando o redirecionamento para a Visão Geral. Nenhuma senha ou token foi armazenado no relatório.

O login remoto foi validado: a página confirmou `Acesso validado`, redirecionou para `https://apexfood.vercel.app/index.html` e o shell carregou a Visão Geral com sidebar, header e módulos existentes. Isso confirma a aceitação da sessão pelo guard sem alterar o layout.

No shell autenticado, o botão visual de perfil existente não expôs um menu de logout na inspeção remota e o shell não carrega `api-client.js` como script global. Para não alterar o layout, o logout será validado diretamente pelo endpoint server-side usando o mesmo contrato CSRF do cliente já implementado.

O endpoint `POST /api/v1/auth/logout` respondeu HTTP 200 com CSRF válido. Como o shell já estava carregado, a tela permaneceu montada até uma nova navegação; a verificação de sessão e o redirecionamento do guard serão testados em seguida por uma requisição nova e recarregamento da rota.

Após o logout, `GET /api/v1/auth/session` retornou HTTP 401 com `NAO_AUTENTICADO`. Ao recarregar `https://apexfood.vercel.app/index.html`, o guard redirecionou automaticamente para `https://apexfood.vercel.app/paginas/autenticacao.html`. Logout, invalidação de sessão e proteção de rota foram confirmados.

O Firebase Console autenticado na conta correta abriu `Authentication > Usuários` do projeto `apex-food-6c1cb`; a tabela de usuários ainda estava carregando e não havia linhas visíveis na primeira leitura.

A lista do Firebase Authentication confirmou o usuário `validacao.etapa8@apexfood.com` no projeto `apex-food-6c1cb`, com data de criação e último login registrados em 20 de agosto de 2026. O UID foi conferido no Console, mas não será reproduzido neste relatório por minimização de dados.
