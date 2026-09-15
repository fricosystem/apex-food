# Plano de Migração — Firebase (Firestore + Authentication)

> Documento de planejamento para substituir Prisma/SQLite + autenticação
> caseira por **Firebase Authentication** e **Cloud Firestore**, e remover
> todos os dados fictícios (seed de demonstração) do sistema APEX FOOD.
>
> Status: **migração de código concluída e validada** (Fases 0–5). Todas as
> ~25 rotas de API agora leem/escrevem no Firestore via Admin SDK; login,
> registro self-service e cadastro de funcionário usam o Firebase
> Authentication. Testado de ponta a ponta (registro → login → mesa →
> categoria/produto → comanda via QR → cozinha → caixa → métricas →
> painel da plataforma) via curl e no navegador real, com uma conta criada
> pelo próprio usuário durante a migração. Prisma/SQLite ainda estão no
> projeto mas **nenhuma rota os usa mais** — remoção fica para a Fase 7,
> só depois de você validar o sistema. Pendências: criar o usuário
> `SUPER_ADMIN` (preciso do e-mail/senha que você quer usar) e, se
> desejar, provisionar os índices compostos do Firestore que a seção 3
> lista (o próprio erro do Firestore, quando aparecer, traz o link pronto
> para criar cada um).

---

## 1. Situação atual (o que existe hoje)

- **Banco de dados:** SQLite local (`db/custom.db`) via Prisma
  (`prisma/schema.prisma`, `src/lib/db.ts`). 11 models: `Plan`,
  `Establishment`, `User`, `RestaurantTable`, `Category`, `Product`, `Order`,
  `OrderItem`, `Payment`, `Goal`, `Setting`.
- **Autenticação:** caseira, em [src/lib/auth.ts](src/lib/auth.ts) — senha
  com `scrypt` (`hashPassword`/`verifyPassword`), sessão própria assinada
  com HMAC (`createToken`/`readToken`) guardada em cookie `apex_session`.
  Sem relação com o pacote `next-auth` que está no `package.json` mas não é
  usado.
- **Dados fictícios (a remover):** [src/lib/seed.ts](src/lib/seed.ts),
  disparado por `POST /api/bootstrap`
  ([src/app/api/bootstrap/route.ts](src/app/api/bootstrap/route.ts)) sempre
  que a tabela `User` está vazia. Cria: 4 planos, 1 super admin
  (`dev@apexfood.com`), 1 estabelecimento fake ("EMPÓRIO RESTAURANTE"), 7
  usuários fake, 7 categorias + 27 produtos fake, 12 mesas, 3 metas, 12
  configurações, ~7 dias de comandas pagas aleatórias e 3 comandas ativas
  de demonstração.
- **API:** camada REST completa em `src/app/api/**`, toda apoiada em
  `db.<model>.*` do Prisma. Front-end (Zustand + TanStack Query) só conversa
  com essas rotas — não acessa o banco diretamente. Isso é uma vantagem: dá
  para troca o banco por trás sem reescrever as telas.
- **Tempo real:** microserviço próprio `socket.io` (porta `3003`,
  `src/lib/realtime.ts` no servidor / `src/lib/socket-client.ts` no
  cliente) — **fora do escopo obrigatório** desta migração (ver Fase 6).
- **Multi-tenant:** já existe o conceito de `Establishment` (tenant) com
  `establishmentId` em quase todas as tabelas, papéis
  (`SUPER_ADMIN/ADMIN/MANAGER/WAITER/KITCHEN/CASHIER`) e permissões por tela
  (`src/lib/permissions.ts`).

### Rotas de API que dependem do Prisma hoje (serão todas migradas)

| Rota | Arquivo |
|---|---|
| Login | `src/app/api/auth/login/route.ts` |
| Registro | `src/app/api/auth/register/route.ts` |
| Sessão atual | `src/app/api/auth/me/route.ts` |
| Logout | `src/app/api/auth/logout/route.ts` |
| Bootstrap/seed | `src/app/api/bootstrap/route.ts` |
| Categorias | `src/app/api/categories/route.ts`, `.../[id]/route.ts` |
| Produtos | `src/app/api/products/route.ts`, `.../[id]/route.ts` |
| Mesas | `src/app/api/tables/route.ts`, `.../[id]/route.ts` |
| Comandas | `src/app/api/orders/route.ts`, `.../[id]/route.ts`, `.../[id]/items/[itemId]/route.ts` |
| Metas | `src/app/api/goals/route.ts`, `.../[id]/route.ts` |
| Métricas/relatórios | `src/app/api/metrics/route.ts` |
| Configurações | `src/app/api/settings/route.ts` |
| Usuários (equipe) | `src/app/api/users/route.ts`, `.../[id]/route.ts` |
| Painel da plataforma | `src/app/api/platform/establishments/**`, `.../plans/**` |
| Cliente (QR code) | `src/app/api/client/[token]/route.ts`, `.../menu/route.ts` |
| Manifesto PWA por tenant | `src/app/api/client-manifest/route.ts` |

Bibliotecas auxiliares que também tocam o Prisma/tipos e vão precisar de
ajuste: `src/lib/api.ts` (helpers `requireUser`/`requireTenant`/
`serializeOrder`), `src/lib/auth.ts`, `src/lib/types.ts`,
`src/lib/distribution.ts`, `src/lib/notification-service.ts`.

---

## 2. O que muda e o que fica

| Item | Hoje | Depois |
|---|---|---|
| Banco de dados | SQLite + Prisma | **Cloud Firestore** |
| Login/senha | scrypt caseiro + cookie HMAC | **Firebase Authentication** (e-mail/senha) |
| Sessão SSR | token HMAC próprio | Cookie de sessão do **Firebase Admin SDK** (`createSessionCookie`) |
| Dados de demonstração | `seed.ts` roda automático | **Removido.** Primeiro acesso cria só o necessário (ver Fase 5) |
| API REST (`/api/**`) | Mantida | **Mantida** — só troca o que cada rota usa por dentro (Prisma → Firestore) |
| Front-end (views, Zustand, TanStack Query) | Mantido | **Sem mudança de UI** — continua chamando as mesmas rotas REST |
| Tempo real (socket.io) | Mantido | **Mantido nesta fase** (migração para `onSnapshot` do Firestore é opcional/futura — Fase 6) |
| Prisma/SQLite | Presente | Removido **só ao final**, depois de validar tudo (Fase 7) |

Decisão de arquitetura: **não** vamos mover o front-end para falar
diretamente com o Firestore client-side. Vamos manter a API do Next.js como
única porta de entrada, usando o **Firebase Admin SDK no servidor**. Isso:

- preserva 100% do front-end e da lógica de permissões por papel/tenant já
  existente em `src/lib/api.ts`;
- evita ter que escrever *Firestore Security Rules* complexas agora (o
  Admin SDK ignora as regras — quem valida permissão continua sendo o
  Next.js, como hoje);
- é a migração de menor risco: troca o banco "por baixo", rota por rota.

---

## 3. Modelagem de dados no Firestore

Estratégia: **subcoleções por estabelecimento** para tudo que é dado de
tenant, e coleções de topo só para o que é global da plataforma ou precisa
ser buscado pelo UID do Firebase Auth.

```
plans/{planKey}                                   // config global da plataforma (TRIAL, BASIC, PRO, PREMIUM)

users/{uid}                                        // uid = Firebase Auth UID (sem campo "password")
  name, email, role, status, active, establishmentId (ou null p/ SUPER_ADMIN)

qrLookup/{qrToken}                                 // { establishmentId, tableId } — acesso público sem login

establishments/{establishmentId}
  name, cnpj, logo, type, phone, address, active,
  plan, billingStatus, trialEndsAt, currentPeriodEnd, periodStartAt,
  lastPaymentAt, notes, permissions (string JSON — mantido igual ao Prisma
  para não precisar tocar em src/lib/permissions.ts),
  settings (map key→value, substitui o model Setting — 1 leitura em vez de N)

  establishments/{id}/tables/{tableId}
  establishments/{id}/categories/{categoryId}
  establishments/{id}/products/{productId}       // + everUsed: boolean (ver abaixo)
  establishments/{id}/goals/{goalId}

  establishments/{id}/orders/{orderId}
    code, tableId, tableNumber, waiterId, waiterName, status, total,
    createdAt, confirmedAt, finishedAt, paidAt, rating, ratedAt,
    items: [{ id, productId, productName, quantity, notes, unitPrice,
              station, prepTime, status, startedAt, readyAt, servedAt, emoji }],
    payment: { method, amount, cashierId, createdAt } | null
```

**Ajuste feito durante a implementação** (o rascunho original desta seção
propunha subcoleções `orders/{id}/items` e `orders/{id}/payments` com
*collection-group query* para o KDS): na prática, toda tela que precisa dos
itens (garçom, cozinha, cliente, métricas) já busca a comanda inteira via
`/api/orders` — não existe nenhum lugar que precise consultar itens
**sem** saber a comanda. Por isso os itens e o pagamento ficam **embutidos
no próprio doc do pedido** (array `items`, campo `payment`): elimina N+1
leituras nas telas de cozinha e no relatório, e uma transação Firestore
(`runTransaction`) garante consistência ao mudar o status de um item ou
excluí-lo. `qrToken` da mesa é globalmente único (a tela do cliente não
sabe a qual estabelecimento pertence) — resolvido com a coleção de topo
`qrLookup/{token}`, um `get()` direto em vez de *collection-group query*.
Exclusão de produto: como o item da comanda guarda nome/preço/emoji do
produto no momento do pedido (denormalizado), apagar o produto não quebra
comandas antigas — ainda assim só apaga de fato se `everUsed` (marcado
na criação do item) for `false`, senão desativa, preservando o
comportamento original de manter produtos já vendidos no histórico.

Notas de modelagem (equivalência com o `schema.prisma` atual):

- **`Setting`** (hoje é uma tabela `key/value`) passa a ser um único campo
  `settings: map<string,string>` dentro do doc do `establishment` — elimina
  1 coleção e várias leituras (hoje é 1 doc por chave).
- **`permissions`** continua string JSON (não migrado para `map` — ver
  ajuste acima): menos código para trocar em `src/lib/permissions.ts`.
- **`OrderItem`/`Payment`** ficam embutidos no doc do pedido (`items`,
  `payment`), não em subcoleção — ver "Ajuste feito durante a
  implementação" acima.
- Campos únicos do Prisma (`@unique`, `@@unique([establishmentId, number])`
  etc.) não existem no Firestore — a unicidade (nº de mesa, nome de
  categoria, chave de plano) é **validada na própria rota antes de
  escrever** (consulta + checagem); e-mail de usuário é garantido pelo
  próprio Firebase Authentication.
- Datas: gravadas como `Date` do JS (o Admin SDK converte para `Timestamp`
  automaticamente); toda rota que devolve um doc lido de volta ao
  front-end passa esses campos por `tsToIso()` (`src/lib/fs.ts`) antes de
  responder, para chegar como string ISO — como o Prisma já entregava.

### Índices compostos do Firestore

A maioria das consultas foi desenhada para não precisar de índice composto
(filtros simples, ou paginação/ordenção feita em memória no servidor —
volume por estabelecimento é pequeno o suficiente pra isso valer a
simplicidade). Se algum filtro específico ainda pedir um índice, a própria
resposta de erro do Firestore traz um link pronto para criá-lo em 1 clique
— é esperado que isso apareça eventualmente em produção; não é um bug.

---

## 4. Autenticação — Firebase Authentication

- Provedor: **E-mail/senha** (igual ao fluxo atual de login/registro).
  Login social (Google etc.) fica de fora, a não ser que você peça.
- **Cadastro de usuário** (`/api/auth/register`): passa a chamar
  `admin.auth().createUser({ email, password })` no servidor, depois cria o
  doc `users/{uid}` no Firestore com `role`, `establishmentId`, `name`,
  `status`, `active` — a senha em si nunca é armazenada por nós (fica só
  no Firebase Auth). `hashPassword`/`verifyPassword` em `src/lib/auth.ts`
  deixam de existir.
- **Login** (`/api/auth/login`): implementado com a **opção sem client
  SDK** — a própria rota chama a REST pública do Identity Toolkit
  (`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>`)
  a partir do servidor para verificar a senha, e troca o `idToken`
  retornado por um **cookie de sessão** (`admin.auth().createSessionCookie`).
  Na prática isso acabou sendo preferível ao client SDK: a tela de login
  continua fazendo `POST /api/auth/login` com `{ email, password }` **sem
  nenhuma mudança** — zero código de front-end tocado, incluindo a rota
  de registro self-service.
- **Sessão (SSR)**: `getSessionUser()` em `src/lib/auth.ts` passa a: ler o
  cookie de sessão → `admin.auth().verifySessionCookie()` → obter `uid` →
  buscar `users/{uid}` no Firestore (mesmo formato de retorno
  `SessionUser` que já existe hoje, para não quebrar nada que consome essa
  função).
- **Logout**: continua só limpando o cookie (`res.cookies.delete(...)`),
  sem chamada ao Firebase necessária (opcionalmente revogar refresh tokens
  com `admin.auth().revokeRefreshTokens(uid)`).
- **Papel (`role`) e tenant (`establishmentId`)**: guardados no Firestore
  (`users/{uid}`), **não** em *custom claims* do token — evita ter que
  forçar refresh de token toda vez que um admin muda o papel de alguém.

---

## 5. Remoção dos dados fictícios

1. **Apagar** [src/lib/seed.ts](src/lib/seed.ts).
2. **Reescrever** `POST /api/bootstrap` — hoje ele popula tudo; depois só
   deve garantir que os **4 planos da plataforma** existam em
   `plans/{key}` (isso é configuração comercial, não é "dado fake" de
   restaurante) — nada de estabelecimento, usuários, produtos, mesas ou
   comandas de demonstração.
3. **Fluxo real de primeiro acesso**: como não haverá mais usuário/admin
   pré-criado, o primeiro acesso ao sistema precisa de uma tela de
   **cadastro do primeiro estabelecimento + admin** (nome do restaurante +
   dados do administrador) que cria, em uma única operação:
   `establishment` novo + `users/{uid}` com `role: 'ADMIN'` apontando para
   ele. Isso pode reaproveitar a rota `/api/auth/register` com um modo
   "novo estabelecimento" (a decidir o texto/UX exato na hora da
   implementação).
4. O **super admin da plataforma** (hoje fixo em `dev@apexfood.com` /
   `apex123`) deixa de ser criado automaticamente. Você (dono do sistema)
   vai me passar o e-mail/senha que quer usar, e eu crio esse usuário
   único direto no Firebase Auth + Firestore (`role: 'SUPER_ADMIN'`, sem
   `establishmentId`) — uma única vez, manualmente, fora do fluxo de
   cadastro público.
5. Banco local atual (`db/custom.db`, com todo o conteúdo fictício) é
   **descartado**, não migrado — ele só tinha dado de demonstração.

---

## 6. Passo a passo de execução

Cada fase só começa depois da anterior estar validada. Nada aqui é
executado até você confirmar e enviar as credenciais (Fase 0).

- [x] **Fase 0 — Credenciais**
  - [x] Config do **app Web** — projeto `apex-food-6c1cb`, em `.env`.
  - [x] **Service account** — `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
    em `.env`, testados (Firestore + Auth respondem).
  - [x] Authentication (e-mail/senha) e Firestore ativos — confirmado
    criando/lendo dados de verdade.
  - [ ] E-mail e senha para o `SUPER_ADMIN` inicial — **preciso que você
    me passe** para eu criar essa conta (única, manual, fora do cadastro
    público).

- [x] **Fase 1 — Instalação e configuração base** — `firebase`/
  `firebase-admin`/`@opentelemetry/api` instalados; `src/lib/fs.ts`
  (helpers de coleção/Timestamp), `src/lib/firebase-client.ts`,
  `src/lib/firebase-admin.ts`, `firestore.rules` (nega tudo do client —
  só o Admin SDK no servidor acessa, ver seção 3).

- [x] **Fase 2 — Autenticação** — `src/lib/auth.ts` reescrito (cookie de
  sessão do Admin SDK, sem scrypt/HMAC); `/api/auth/login`,
  `/api/auth/register`, `/api/auth/me`, `/api/auth/logout` migrados.
  **Sem client SDK no front-end**: login/registro continuam POST direto
  às mesmas rotas — o servidor verifica a senha via REST do Identity
  Toolkit, então a tela de login não precisou mudar.

- [x] **Fase 3 — Camada de dados (Firestore)** — todas as ~25 rotas de
  `/api/**` migradas de Prisma para Firestore (Admin SDK). Modelagem
  final ficou mais simples que o rascunho original: itens e pagamento de
  cada comanda vão **embutidos no próprio doc do pedido** (array `items`,
  campo `payment`), não em subcoleções — evita N+1 nas telas de cozinha/
  métricas. `settings` também virou um `map` no doc do estabelecimento em
  vez de coleção separada. Detalhes e trade-offs no código de cada rota.

- [x] **Fase 4 — Remoção dos dados fictícios** — `seed.ts` só garante os
  4 planos comerciais; `/api/bootstrap` não cria mais estabelecimento/
  usuários/produtos/comandas de demonstração.

- [x] **Fase 5 — Primeiro acesso real** — `/api/auth/register` já era o
  fluxo de "cadastrar meu restaurante" e continua funcionando sem
  mudanças de contrato. **Validado com uma conta real** criada pelo
  próprio usuário durante a migração (estabelecimento "APEX FOOD GYN").
  Falta só criar o `SUPER_ADMIN` (aguardando e-mail/senha).

- [x] **Fase 6 — Testes ponta a ponta** *(cobertura manual)* — validado
  via curl + navegador: registro → login → sessão persistente → criar
  mesa/categoria/produto → comanda via QR → confirmar → preparar item →
  cliente encerra → caixa paga → métricas agregam corretamente → mesa
  volta a `FREE` → painel da plataforma lista/edita/apaga estabelecimento
  (com cascata de dados + contas Firebase Auth). Um bug real foi achado e
  corrigido nesse processo: `createdAt` de categoria/produto/mesa/meta
  vinha como objeto interno do Firestore em vez de string ISO em alguns
  retornos — corrigido em todos os pontos.
  - [ ] Ainda não testado manualmente: KDS com múltiplas comandas
    simultâneas, relatório com grande volume de dados, e os cargos
    WAITER/KITCHEN/CASHIER especificamente (só ADMIN foi exercitado).

- [ ] **Fase 7 — Limpeza final** *(só depois de tudo validado)*
  - Remover `prisma`, `@prisma/client` do `package.json`; apagar
    `prisma/schema.prisma`, `src/lib/db.ts`, `db/custom.db`.
  - Remover scripts `db:push`/`db:generate`/`db:migrate`/`db:reset` do
    `package.json` e as referências a eles em `.zscripts/*.sh`.
  - Remover `DATABASE_URL` do `.env`.

- [ ] **Fase 8 — Tempo real via Firestore (opcional, futura)**
  - Só depois de tudo estável: avaliar trocar o microserviço `socket.io`
    (`src/lib/realtime.ts`, `src/lib/socket-client.ts`, pasta
    `mini-services`) por `onSnapshot` do Firestore direto no client. Isso
    **exigiria** escrever `firestore.rules` reais (hoje ficam
    restritivas por não serem necessárias) — fase separada, com plano
    próprio se você quiser seguir por aí.

---

## 7. Perguntas para confirmar antes de eu começar a Fase 1

1. Confirma a estrutura de coleções da seção 3 (subcoleções por
   estabelecimento), ou prefere coleções únicas no topo com campo
   `establishmentId` (mais simples de consultar "tudo de todos os
   tenants" no painel da plataforma, porém sem isolamento natural por
   tenant)?
2. Confirma manter o `socket.io` como está por agora (Fase 8 fica para
   depois, sem compromisso)?
3. Login só e-mail/senha mesmo, ou também quer Google/outro provedor já
   nesta migração?
4. Qual região do Firestore usar (sugestão: `southamerica-east1`)?
5. E-mail/senha que devem virar o usuário `SUPER_ADMIN` inicial.

---

## 8. O que enviar quando for fornecer as credenciais

- O `firebaseConfig` do app Web (Fase 0).
- O arquivo `.json` da service account (ou só `client_email` +
  `private_key` + `project_id` de dentro dele).
- Respostas às perguntas da seção 7.

**Nunca cole a `private_key`/service account em um canal público** — pode
me passar aqui na conversa (fica só no seu `.env`, que já está no
`.gitignore`) ou colar direto no arquivo `.env` do projeto e me avisar.
