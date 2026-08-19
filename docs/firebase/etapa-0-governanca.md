# Etapa 0 — Governança e decisões de segurança

**Projeto:** APEX Food

**Status:** Concluída documentalmente; aguardando autorização para iniciar a Etapa 1.

**Arquitetura-base:** frontend estático preservado + API server-side na Vercel + Firebase Authentication + Cloud Firestore.

## 1. Decisões técnicas adotadas

| Tema | Decisão |
|---|---|
| Identidade | O login e o cadastro usarão email real no formato `meunome@apexfood.com`. |
| Domínio | `@apexfood.com` será fixo somente na experiência visual; o backend reconstruirá e validará o email completo. |
| Sessão | Cookie de sessão `HttpOnly`, `Secure` e `SameSite`; nenhum token de sessão em `localStorage`, `sessionStorage` ou IndexedDB. |
| Backend | Operações protegidas passarão por endpoints server-side na Vercel. |
| Segredos | Service account, chave privada, secrets de sessão, CSRF e rate limit ficarão somente em variáveis sensíveis da Vercel. |
| Banco | Cloud Firestore com isolamento obrigatório por `idRestaurante` e membro ativo. |
| Autorização | `idUsuario` vem do Firebase Authentication; `idRestaurante` vem do membro ativo; papéis são atribuídos por processo confiável. |
| Regras | Firestore inicia em deny-by-default; nenhuma regra aberta será aceita em produção. |
| Auditoria | Operações financeiras, administrativas, exclusões e alterações de permissão terão trilha de auditoria. |
| MFA | Obrigatório para `proprietario`, `administrador`, `financeiro` e demais papéis definidos como críticos. |
| Ambientes | Development, Preview/Staging e Production serão separados. |
| Migração | Dados simulados serão substituídos por adaptadores de API com feature flags e rollback. |

## 2. Escopo de tenant

Cada restaurante será um espaço isolado. O modelo mínimo em português é:

```text
usuarios/{idUsuario}
restaurantes/{idRestaurante}
restaurantes/{idRestaurante}/membros/{idUsuario}
restaurantes/{idRestaurante}/configuracoes/{idConfiguracao}
restaurantes/{idRestaurante}/pedidos/{idPedido}
restaurantes/{idRestaurante}/produtos/{idProduto}
restaurantes/{idRestaurante}/reservas/{idReserva}
restaurantes/{idRestaurante}/funcionarios/{idFuncionario}
restaurantes/{idRestaurante}/movimentacoesFinanceiras/{idMovimentacao}
registrosAuditoria/{idRegistro}
```

O cliente nunca poderá escolher um papel, trocar o `idRestaurante` por payload ou acessar documentos de outro restaurante por manipulação de URL, rota, consulta ou ID. A API deve derivar o escopo a partir da sessão e do membro ativo.

## 3. Papéis iniciais

| Papel | Escopo | Acesso inicial |
|---|---|---|
| `proprietario` | Restaurante | Controle completo, membros, permissões, configurações e ações de propriedade. |
| `administrador` | Restaurante | Operação e configuração, sem exclusões irreversíveis de propriedade. |
| `gerente` | Restaurante | Pedidos, salão, cardápio e relatórios operacionais. |
| `financeiro` | Restaurante | Caixa, fluxo, contas, fechamentos e relatórios financeiros. |
| `caixa` | Restaurante | Operações de caixa autorizadas, sem alterar papéis ou históricos fechados. |
| `cozinha` | Restaurante | Fila da cozinha e transições operacionais permitidas. |
| `garcom` | Restaurante | Mesas e pedidos conforme escopo operacional. |
| `analista` | Restaurante | Leitura de relatórios autorizados. |
| `auditor` | Restaurante | Leitura controlada e auditoria, sem mutações. |

Os papéis detalhados por ação serão implementados somente após validação do responsável de negócio. Custom Claims serão pequenas e atribuídas pelo Admin SDK; o vínculo detalhado do membro permanecerá no Firestore.

## 4. Responsabilidades

| Responsabilidade | Responsável a confirmar | Regra de segurança |
|---|---|---|
| Proprietário do projeto Firebase | A confirmar | Acesso administrativo individual, MFA e sem conta compartilhada. |
| Administrador do projeto Vercel | A confirmar | Acesso mínimo, MFA e auditoria de alterações. |
| Aprovação de Security Rules | A confirmar | Code review obrigatório antes de publicação. |
| Aprovação de deploy de produção | A confirmar | Promoção manual após CI e checklist de segurança. |
| Resposta a incidente | A confirmar | Revogação, contenção, logs, comunicação e pós-incidente. |
| Aprovação de exportação financeira | A confirmar | Reautenticação/MFA e registro de auditoria. |

## 5. Threat model inicial

| Ameaça | Controle obrigatório |
|---|---|
| Roubo de sessão | Cookie HttpOnly/Secure/SameSite, expiração, revogação e rotação. |
| IDOR/BOLA entre restaurantes | Membership server-side, escopo por tenant e testes negativos. |
| Brute force | Quotas, rate limiting, proteção contra enumeração e MFA. |
| XSS e injeção | Validação server-side, escaping, CSP e consultas parametrizadas. |
| Vazamento de segredo | Vercel Sensitive Environment Variables, secret scanning e rotação. |
| Escrita indevida no Firestore | Rules deny-by-default, IAM mínimo e autorização na API. |
| Duplicidade financeira | Transações, idempotency key e auditoria. |
| Exclusão acidental | Soft delete/tombstone onde aplicável, backups e aprovação adicional. |
| Abuso de API | App Check quando aplicável, rate limiting, limites de payload e alertas. |
| Comprometimento de administrador | MFA obrigatório, reautenticação e revogação de sessões. |

## 6. Decisões pendentes antes da Etapa 1

A implementação documental pode avançar, mas os seguintes itens precisam de confirmação do responsável do sistema antes de criar ou alterar recursos externos:

1. Confirmar se o projeto Firebase `apex-food-6c1cb` será o projeto de **Production** ou se deverá ser criado um projeto Firebase exclusivo para produção.
2. Informar o domínio final da Vercel e o domínio oficial do APEX Food para Authorized Domains, CORS e cookies.
3. Definir a região do Firestore e requisitos de residência de dados.
4. Confirmar os responsáveis indicados na matriz de responsabilidades.
5. Definir RPO, RTO, retenção de backups e periodicidade de teste de restauração.
6. Confirmar quais papéis exigirão MFA além de `proprietario`, `administrador` e `financeiro`.

## 7. Limite desta etapa

Nesta etapa não foram criados usuários, regras, bancos, service accounts, variáveis Vercel ou deploys. A Etapa 0 apenas formalizou a arquitetura e os controles para evitar alterações irreversíveis antes da aprovação.

**Próxima etapa condicionada à aprovação:** Etapa 1 — separar e confirmar os ambientes Development, Preview/Staging e Production.
