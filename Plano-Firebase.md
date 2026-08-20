# Plano de Integração Segura do Firebase no APEX Food

**Projeto:** APEX Food

**Escopo:** Firebase Authentication, Cloud Firestore, camada de API server-side e hospedagem na Vercel

**Versão:** 1.1 — plano de produção com guia de configuração

**Autor:** Manus AI

**Status de implementação:** Etapas 0–5 concluídas em Development; Etapa 6 — schema multi-tenant, membership, roles e auditoria — aguardando autorização explícita.

> Este documento define a estratégia de integração do APEX Food com Firebase Authentication e Cloud Firestore para múltiplos clientes, com prioridade absoluta para isolamento de dados, não exposição de segredos, rastreabilidade, continuidade operacional e segurança de produção.

## 1. Resumo executivo

O APEX Food possui atualmente uma interface HTML estática com shell único, roteamento por hash, páginas fragmentadas por módulo e dados simulados em objetos JavaScript globais. A próxima etapa deve substituir progressivamente esses dados locais por dados persistidos no Cloud Firestore e substituir o fluxo de autenticação demonstrativo por Firebase Authentication, sem quebrar o layout, as rotas ou a experiência já construída.

Para cumprir o requisito de não deixar credenciais, tokens de sessão ou dados operacionais no frontend e no `localStorage`, a arquitetura recomendada é uma **camada de API server-side na Vercel**, funcionando como Backend-for-Frontend. O navegador envia somente requisições HTTPS para endpoints `/api`; as funções da Vercel validam a sessão, verificam autorização, aplicam validação de entrada, executam operações no Firebase Admin SDK e devolvem apenas o resultado mínimo necessário para a tela.

O navegador não receberá a chave privada do Firebase Admin, credenciais de service account, tokens administrativos, credenciais de banco ou segredos da Vercel. A sessão será mantida por cookie `HttpOnly`, `Secure` e `SameSite`, sem token em `localStorage`, `sessionStorage` ou IndexedDB. A recomendação oficial do Firebase para cookies de sessão deve orientar a implementação e a revogação das sessões [2].

> **Decisão de identidade:** o APEX Food usará emails reais no formato `meunome@apexfood.com`. A parte anterior ao `@` será editável no formulário e o domínio `@apexfood.com` será fixo visualmente, mas o endereço completo deverá ser montado e validado também no backend antes de chegar ao Firebase Authentication.

Nenhuma arquitetura elimina todos os riscos. O objetivo profissional é reduzir a superfície de ataque, impedir acessos indevidos por padrão, detectar abuso, limitar o impacto de uma falha, testar continuamente e manter capacidade de recuperação.

## 2. Objetivos e princípios obrigatórios

A integração deverá atender simultaneamente aos seguintes objetivos:

| Objetivo | Regra de implementação |
|---|---|
| Identidade | Toda operação protegida deve estar associada a um usuário Firebase Auth validado server-side. |
| Isolamento multi-tenant | Um restaurante nunca poderá consultar ou alterar dados de outro restaurante, mesmo que o cliente manipule IDs, rotas ou payloads. |
| Segredos | Service account, chave privada, tokens administrativos, credenciais de serviços externos e segredos de sessão ficam somente em variáveis sensíveis da Vercel. |
| Sessão | Cookie de sessão `HttpOnly`, `Secure`, `SameSite` e com expiração curta; nenhuma sessão em `localStorage`. |
| Autorização | A role, o tenant e as permissões são determinados pelo servidor, nunca aceitos diretamente do corpo da requisição. |
| Validação | Toda entrada é validada novamente no backend; validação visual no frontend é apenas conveniência. |
| Auditoria | Operações financeiras, alterações de permissão, exclusões e mudanças relevantes geram log imutável ou append-only. |
| Disponibilidade | Backups, restauração testada, ambientes separados e monitoramento de erros/custos fazem parte do lançamento. |
| Privacidade | Coletar somente os dados necessários, definir retenção, controlar acesso interno e evitar dados sensíveis em logs. |
| Compatibilidade | O shell único, as rotas hash e o UI/UX existentes devem permanecer estáveis durante a migração. |

As Security Rules do Firestore devem ser tratadas como uma camada formal de controle e validação, não como substituto de autorização no servidor [1]. O Emulator Suite deve ser usado para validar as regras antes do deploy e integrado ao CI [5].

## 3. Alternativas de arquitetura

Há duas alternativas viáveis, mas elas não oferecem o mesmo nível de controle operacional para o cenário de muitos clientes.

| Abordagem | Tradeoffs | Custo | Complexidade de configuração |
|---|---|---|---|
| **A. API server-side na Vercel + Firebase Admin SDK + cookie HttpOnly** | Melhor isolamento de dados e segredos; permite autorização centralizada, auditoria, rate limiting e contratos estáveis. Exige criar endpoints, testes e uma camada de serviço. | Vercel conforme uso, Firebase conforme uso e eventual serviço de rate limit. | Alta no início; menor risco operacional depois de padronizada. **Recomendada para produção.** |
| **B. Firebase Web SDK direto no navegador + Security Rules rigorosas** | Implementação inicial mais simples e menor quantidade de endpoints. Porém, o cliente fala diretamente com o Firestore, as regras ficam mais complexas, a superfície pública aumenta e auditoria/rate limiting centralizados ficam mais difíceis. | Menor custo de backend próprio; Firestore/Auth conforme uso. | Média inicialmente, alta para RBAC multi-tenant e requisitos financeiros. |

Para o APEX Food, recomenda-se a **Abordagem A**, porque o requisito explícito é não deixar dados sensíveis e controle de acesso no frontend. A Abordagem B pode ser considerada no futuro apenas para leituras não sensíveis e de baixo risco, após revisão de segurança, nunca como requisito para a primeira versão de produção.

## 4. Arquitetura alvo

```text
Navegador
  │ HTTPS somente
  │ Cookie HttpOnly + token CSRF em memória
  ▼
Vercel
  ├── Arquivos estáticos e shell atual
  ├── /api/auth/*
  ├── /api/me
  ├── /api/{modulo}/*
  ├── middleware de segurança, CORS, CSRF e rate limit
  └── Firebase Admin SDK somente server-side
        │
        ├── Firebase Authentication
        ├── Cloud Firestore
        ├── App Check / verificação de atestação quando aplicável
        └── Logs, métricas, backup e alertas
```

### 4.1 Fronteira entre navegador e servidor

O frontend poderá conter apenas configuração pública mínima necessária para renderizar a aplicação, como o endpoint público da API, identificadores visuais e informações não confidenciais. A chave pública de uma aplicação Firebase não deve ser confundida com uma chave privada, mas, para cumprir o requisito operacional do projeto, a comunicação principal deverá passar pela API da Vercel.

O frontend não poderá conter service account JSON, `private_key`, `client_secret`, tokens de sessão, tokens administrativos, credenciais de banco, senha de usuário, permissões definitivas, dados de outros tenants ou regras de negócio críticas. O fato de um valor estar em um arquivo JavaScript minificado não o torna secreto.

### 4.2 Sessão

O fluxo recomendado é:

1. O usuário abre `paginas/autenticacao.html` e envia o formulário para `POST /api/auth/register` ou `POST /api/auth/login` por HTTPS.
2. A API valida o payload, aplica rate limiting e conversa com o Firebase Authentication por uma integração server-side.
3. Em caso de login válido, a API cria uma sessão Firebase server-side e grava um cookie com nome prefixado, por exemplo `__Host-apex_session`.
4. O cookie deve usar `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict` conforme o fluxo de navegação, `Path=/`, expiração curta e rotação controlada.
5. Cada endpoint protegido verifica a sessão, confirma que o usuário ainda está ativo, avalia revogação e carrega o membership do tenant solicitado a partir de uma fonte confiável.
6. O logout revoga ou invalida a sessão no servidor e expira o cookie. Alteração de senha, remoção de MFA, mudança de role e suspeita de comprometimento devem revogar sessões existentes.

O frontend não deve salvar o cookie manualmente nem ler seu conteúdo. Também não deve usar `localStorage`, `sessionStorage` ou IndexedDB para salvar token, perfil, senha, membership ou dados de negócio.

### 4.3 CSRF, origem e transporte

Como a sessão será baseada em cookie, todas as mutações deverão possuir proteção CSRF. A implementação deverá usar token CSRF associado à sessão, enviado em header, além de verificar `Origin` e `Referer` contra a lista de domínios autorizados. CORS deve ser restritivo, com allowlist explícita, nunca `*` em rotas autenticadas.

A Vercel deverá redirecionar HTTP para HTTPS. O projeto deverá publicar cabeçalhos de segurança como HSTS, Content-Security-Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` e proteção contra framing. Tailwind, Lucide e fontes externas devem ser fixados em versões, preferencialmente empacotados ou carregados com política CSP e integridade verificável.

## 5. Decisão oficial sobre o email APEX Food

O padrão oficial de identidade será `meunome@apexfood.com`. O usuário informará somente a parte anterior ao `@`, enquanto `@apexfood.com` será exibido de forma contínua no mesmo campo, sem divisão visual, no login e no cadastro.

| Elemento | Regra oficial |
|---|---|
| Formato | `meunome@apexfood.com` |
| Parte editável | `meunome`, normalizada em minúsculas e validada no servidor |
| Domínio | `@apexfood.com`, fixo na experiência e montado novamente no backend |
| Firebase Authentication | Receberá o email completo e válido, nunca somente o identificador parcial |
| Verificação e recuperação | Usarão o email completo por meio dos fluxos oficiais do Firebase Auth |
| Tenant/restaurante | Será uma entidade separada, associada ao UID por membership; não será inferida somente do texto do email |
| Segurança | O servidor rejeitará domínio diferente, caracteres inválidos, duplicidade e qualquer tentativa de sobrescrever o email canônico |

A API deverá reconstruir o email a partir da parte editável somente depois de normalizar e validar o valor recebido. Em login, o backend deverá aceitar o email completo conforme o contrato oficial; no frontend, a máscara é apenas uma conveniência visual e não é uma fronteira de segurança.

Em nenhuma hipótese o servidor deve aceitar um `uid`, `tenantId`, `role` ou email canônico enviado pelo cliente como autoridade. O `uid` deve vir do Firebase Authentication, o tenant deve vir do membership autorizado e as roles devem ser atribuídas por processo confiável.

## 6. Modelo de identidade e autorização multi-tenant

O Firestore deverá usar um modelo explícito de restaurante. A estrutura inicial documentada em português é:

```text
usuarios/{idUsuario}
restaurantes/{idRestaurante}
restaurantes/{idRestaurante}/membros/{idUsuario}
restaurantes/{idRestaurante}/papeis/{idPapel}
restaurantes/{idRestaurante}/configuracoes/{idConfiguracao}
restaurantes/{idRestaurante}/pedidos/{idPedido}
restaurantes/{idRestaurante}/categoriasCardapio/{idCategoria}
restaurantes/{idRestaurante}/produtos/{idProduto}
...
registrosAuditoria/{idRegistro}
```

O `idRestaurante` deverá ser derivado da sessão e do membro consultado pelo servidor. A API não permitirá que um usuário troque de restaurante simplesmente alterando um parâmetro. Quando o usuário pertencer a mais de um restaurante, a troca deverá ocorrer por uma operação explícita, validada e registrada.

As Custom Claims poderão carregar informações pequenas e de alto nível, como indicação de acesso administrativo, sempre atribuídas pelo Admin SDK em ambiente confiável [4]. O vínculo detalhado, os papéis por restaurante e o estado da conta permanecerão no Firestore. O servidor deverá recarregar Claims quando necessário, respeitar a propagação de novos tokens e revogar acesso quando um papel for removido.

### 6.1 Matriz inicial de papéis

| Papel | Escopo típico | Permissões exemplificativas |
|---|---|---|
| `proprietario` | Restaurante | Configuração completa, faturamento, equipe, permissões e exclusão controlada. |
| `administrador` | Restaurante | Operação e configuração, sem ações irreversíveis de propriedade. |
| `gerente` | Restaurante | Operação, salão, pedidos, cardápio e relatórios operacionais. |
| `financeiro` | Restaurante | Caixa, fluxo, contas, fechamento e relatórios financeiros. |
| `caixa` | Restaurante | Operações de caixa permitidas, sem alterar permissões ou histórico fechado. |
| `cozinha` | Restaurante | Fila de cozinha e atualização de estado operacional. |
| `garcom` | Restaurante | Pedidos e mesas conforme escopo definido. |
| `analista` | Restaurante | Leitura de relatórios autorizados, sem mutações operacionais. |
| `auditor` | Restaurante | Leitura controlada e registros de auditoria, sem alteração de dados. |

A matriz final deve ser revisada com o responsável de negócio. Os nomes técnicos de coleções, campos e valores permanecem em português. Permissões devem ser verificadas no endpoint e, quando houver acesso direto futuro ao Firestore, também nas Security Rules.

## 7. Modelo de dados e regras de integridade

Cada documento operacional deverá conter campos de controle consistentes, como `idRestaurante` derivado pelo servidor, `criadoEm`, `atualizadoEm`, `criadoPor`, `atualizadoPor`, `versao` e `estado`. Datas devem ser gravadas pelo servidor. O cliente não poderá escolher datas de auditoria, autoria da alteração ou restaurante.

Operações financeiras, baixa de estoque, fechamento de caixa e atualização de pedidos que alteram múltiplos documentos devem usar transações ou operações idempotentes. Cada comando que possa ser repetido por timeout deverá receber uma `chaveIdempotencia` controlada pelo servidor para evitar duplicidade.

Dados que não precisam ser exibidos na interface devem ser separados do documento público do módulo. Dados pessoais, informações bancárias, observações internas e documentos de colaboradores deverão possuir regras de acesso e retenção próprias. A API deve retornar DTOs mínimos, nunca documentos inteiros por conveniência.

## 8. Integração por módulo

A migração deve manter as rotas atuais e substituir as fontes `window.dados...` por chamadas assíncronas à API, sem recriar o shell ou colocar credenciais nos fragmentos HTML.

| Módulo e rotas atuais | Dados/coleções previstas | Controles especiais |
|---|---|---|
| Autenticação: `paginas/autenticacao.html` | Firebase Authentication, `usuarios`, `membros`, `convites` e sessões | Verificação de email, proteção contra enumeração, limite de tentativas, recuperação, MFA para papéis críticos e nenhum token no armazenamento do navegador. |
| Pedidos: `novo-pedido`, `pedidos-ativos`, `historico-pedidos` | `pedidos`, `itens`, `pagamentos`, `eventos` | Idempotência, transições de estado, controle de cancelamento/edição e auditoria. |
| Operacional/cozinha: `fila-cozinha`, `operacional` | `fichasCozinha`, `eventosProducao`, `configuracoes` | Papéis operacionais, máquina de estados e auditoria de mudanças. |
| Cardápio: `categorias`, `produtos`, `promocoes`, `cardapio-digital` | `categoriasCardapio`, `produtos`, `promocoes`, `configuracaoCardapioDigital` | `proprietario`/`gerente` para escrita, versionamento, preços/datas validados e prevenção de XSS. |
| Salão: `mapa-mesas`, `reservas`, `configuracao-mesas` | `mesas`, `eventosMesas`, `reservas`, `configuracaoSalao` | Transação contra dupla reserva, capacidade/horários validados e separação da visão pública. |
| Equipe: `funcionarios`, `escala-trabalho`, `comissoes` | `funcionarios`, `escalas`, `comissoes`, `dadosPrivadosFuncionarios` | PII restrita, MFA administrativo, cálculo server-side e histórico. |
| Financeiro: `fechamento-caixa`, `fluxo-caixa`, `contas-pagar-receber`, `relatorios-financeiros` | `fechamentosCaixa`, `movimentacoesCaixa`, `contasPagar`, `contasReceber`, `relatoriosFinanceiros` | Acesso por `financeiro`/`proprietario`, fechamento imutável, transações e auditoria somente para acréscimo. |
| Relatórios: `vendas-por-periodo`, `produtos-mais-vendidos`, `horarios-de-pico`, `avaliacoes-clientes`, `performance-equipe` | `resumosRelatorios`, `avaliacoes`, `agregacoesAnaliticas` | Agregações server-side, filtros/paginação limitados, PII mascarada e isolamento por restaurante. |
| Dashboards: `dashboard-financeiro`, `dashboard-desempenho` | `resumosFinanceiros`, `resumosDesempenho` | Agregações server-side, acesso por papel e filtros validados. |
| Visão Geral: `home` | Consultas agregadas autorizadas | Endpoint de resumo, sem coleções completas, cache server-side e filtros validados. |
| Configurações e administração | `configuracoes`, `configuracaoCobranca`, `permissoes` | `proprietario`/`administrador`, reautenticação/MFA, logs e confirmação explícita. |

A lista de rotas deve permanecer registrada no shell. A segurança não deve depender do fato de uma rota estar ou não visível na sidebar; qualquer endpoint deve repetir a autorização.

## 9. Authentication: funcionalidades obrigatórias

A página `paginas/autenticacao.html` deve continuar standalone e manter o UI/UX já aprovado. A lógica atual de demonstração deve ser substituída por chamadas à API.

A primeira versão de produção deverá incluir registro, login, logout, sessão atual, verificação de email, recuperação de senha, alteração de senha, bloqueio de conta quando aplicável, mensagens sem enumeração de usuários e gerenciamento de sessões. A proteção contra enumeração de email e quotas de login devem ser habilitadas conforme o checklist de segurança do Firebase [7].

MFA deverá ser obrigatório para `proprietario`, `administrador`, `financeiro` e qualquer usuário com capacidade de alterar permissões ou exportar dados. O Firebase documenta MFA para web e exige atenção a domínio autorizado, email verificado e fluxo de enrollment [8]. O mecanismo de recuperação deve ser testado para não permitir que o suporte contorne o segundo fator sem aprovação auditada.

Senhas nunca devem ser armazenadas pelo APEX Food. O frontend deve transmitir a senha somente por HTTPS para o endpoint de autenticação, sem logs, analytics, query string ou persistência local. Campos e mensagens não podem aparecer em ferramentas de monitoramento com dados sensíveis.

## 10. API server-side na Vercel

A camada de API deverá seguir contratos versionáveis, por exemplo `/api/v1/auth/login` e `/api/v1/pedidos`. Cada endpoint deve possuir autenticação, autorização, validação, tratamento de erro, logs sem PII e limites de tamanho.

| Grupo | Endpoints iniciais |
|---|---|
| Sessão | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/session`, `POST /api/v1/auth/logout` |
| Conta | `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/password-reset`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/mfa/*` |
| Usuário/restaurante | `GET /api/v1/eu`, `GET /api/v1/restaurantes`, `POST /api/v1/restaurantes/trocar`, `GET /api/v1/membros`, `POST /api/v1/convites` |
| Operação | Recursos separados por módulo, todos derivados do restaurante da sessão |
| Administração | Papéis, configurações, auditoria e exportação com reautenticação/MFA e confirmação adicional |

A implementação deverá reutilizar o Admin SDK em escopo de módulo quando suportado pelo runtime, sem criar conexões desnecessárias a cada chamada. Toda operação deve limitar paginação, filtros e tamanho de payload. Erros públicos devem ser genéricos; detalhes ficam em logs protegidos.

### 10.1 Rate limiting e abuso

Login, cadastro, recuperação de senha, endpoints de convite, exportação, relatórios pesados e mutações financeiras devem possuir rate limiting por IP, identidade, tenant e rota. Para execução distribuída na Vercel, o contador não deve depender de memória local da função; deverá ser usado um serviço externo apropriado ou mecanismo gerenciado com política de retenção e privacidade definida.

O App Check deve ser avaliado para os serviços suportados e para as APIs próprias. A documentação do Firebase descreve atestação para clientes autorizados, enforcement e suporte a Cloud Firestore, Authentication em Preview e backends próprios [3]. A ativação deverá começar em modo de observação, seguida de enforcement gradual após análise de falsos positivos.

## 11. Firestore Security Rules e IAM

A estratégia server-only poderá manter as regras do Firestore fechadas para acesso direto do navegador, por exemplo com uma política padrão de negação. As funções Vercel usarão Admin SDK e, por isso, não estarão protegidas pelas Security Rules; deverão ter autorização explícita no código e IAM mínimo. A própria documentação alerta que bibliotecas server-side bypassam as Security Rules [1] [5].

Se algum recurso passar a usar SDK direto no navegador, deverá existir uma regra específica, testada e revisada. Nunca usar regras globais como `allow read, write: if true`, nunca confiar apenas em `request.auth != null` para dados multi-tenant e nunca permitir que o cliente escreva `papel`, `idRestaurante`, `criadoPor`, `aprovadoEm` ou campos equivalentes.

O projeto Firebase deve começar em modo de produção/locked. Toda nova coleção deve nascer junto com suas regras, testes e documentação. IAM do Google Cloud deve aplicar menor privilégio ao service account da Vercel, sem usar conta pessoal ou chave compartilhada.

## 12. Segredos e ambientes na Vercel

Devem existir projetos ou ambientes separados para Development, Preview/Staging e Production. O Firebase de produção nunca deve ser usado em testes locais ou previews automáticos.

| Variável | Ambiente | Acesso |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Server | Funções Vercel |
| `FIREBASE_CLIENT_EMAIL` | Server sensível | Funções Vercel |
| `FIREBASE_PRIVATE_KEY` ou secret equivalente | Server sensível | Funções Vercel, nunca build público |
| `FIREBASE_WEB_API_KEY` | Preferencialmente server | Endpoint de autenticação |
| `APP_CHECK_SECRET`/configuração de verificação | Server sensível | Funções Vercel |
| `SESSION_SECRET`/configuração criptográfica | Server sensível | Sessão e CSRF |
| `RATE_LIMIT_URL` e credencial | Server sensível | Rate limit distribuído |

A Vercel oferece variáveis sensíveis cujo valor não fica legível após a criação [6]. Segredos devem ser cadastrados por ambiente, não incluídos em `.env` versionado, não impressos nos logs e não enviados como `NEXT_PUBLIC_*` ou equivalente. Deve existir procedimento de rotação, registro de quem aprovou a troca, redeploy e revogação da credencial antiga.

O repositório deve usar `.gitignore`, secret scanning, revisão de dependências e hooks de CI para bloquear `private_key`, arquivos de service account, tokens, senhas e dumps de produção.

## 13. Migração dos dados simulados

A migração deve ser incremental, com feature flags e possibilidade de rollback. Os objetos atuais `window.dados...` não devem ser simplesmente substituídos por uma leitura direta no browser; cada módulo deverá receber um adaptador de dados assíncrono que preserve o contrato visual da página.

A sequência recomendada é:

1. Catalogar todos os objetos globais, campos, estados, eventos e ações de cada página.
2. Definir o schema Firestore e os contratos de API equivalentes.
3. Criar dados de seed somente no projeto de desenvolvimento.
4. Implementar endpoints e testes do módulo sem remover a fonte simulada.
5. Criar um adaptador que escolha API ou mock por feature flag de ambiente.
6. Validar a renderização com dados reais e estados de carregamento, vazio, erro e permissão negada.
7. Migrar a gravação e depois a leitura, módulo por módulo.
8. Remover os mocks apenas depois de homologação, auditoria e rollback documentado.

Nenhum dado de produção deverá ser migrado por script manual sem backup, idempotência, relatório de contagem, validação de integridade e possibilidade de reexecução segura.

## 14. Fases de implementação

| Fase | Entrega | Critério de saída |
|---|---|---|
| 0 — Decisões de segurança | Decisão sobre email real versus identificador APEX, papéis, restaurante, MFA e RPO/RTO. | Decisões aprovadas e registradas. |
| 1 — Ambientes | Firebase Development, Staging e Production; projeto Vercel; domínios autorizados; billing alerts. | Nenhum teste usa produção por engano. |
| 2 — Backend base | Estrutura `/api/v1`, Admin SDK, validação, erros, logs, headers, CORS, CSRF e rate limit. | Endpoint de healthcheck não expõe segredo e endpoints protegidos falham sem sessão. |
| 3 — Authentication | Registro, login, sessão HttpOnly, logout, verificação, recuperação, revogação e MFA. | Fluxos positivos e negativos cobertos por testes automatizados. |
| 4 — Restaurante e RBAC | `usuarios`, `restaurantes`, `membros`, Claims, convites e matriz de autorização. | Teste de isolamento impede acesso cruzado entre restaurantes. |
| 5 — Firestore seguro | Coleções, índices, validações, regras fechadas/minimalistas e Emulator Suite. | Testes de regras e integração passam no CI. |
| 6 — Pedidos e cozinha | Novo Pedido, Ativos, Histórico, Fila da Cozinha e Operacional. | Transições, idempotência e auditoria validadas. |
| 7 — Cardápio e salão | Categorias, Produtos, Promoções, Cardápio Digital, Mesas, Reservas e Configuração. | Publicação, reservas e permissões sem acesso cruzado. |
| 8 — Equipe | Funcionários, Escala e Comissões. | PII protegida, cálculo server-side e papéis revisados. |
| 9 — Financeiro | Caixa, Fluxo, Contas, Relatórios Financeiros. | Fechamentos protegidos, imutabilidade após aprovação e auditoria. |
| 10 — Relatórios e Visão Geral | Todos os relatórios, dashboards e agregações da Home/Visão Geral. | Consultas paginadas, agregadas e sem vazamento de PII. |
| 11 — Migração e remoção de mocks | Adaptadores API, estados de UI e remoção controlada de globais simulados. | Nenhuma tela de produção depende de mock ou localStorage. |
| 12 — Segurança de lançamento | App Check, CSP, HSTS, secret scanning, dependências, testes, backup e alertas. | Checklist de produção aprovado sem finding crítico/alto aberto. |
| 13 — Go-live gradual | Canary por tenant interno, expansão progressiva e rollback. | Métricas estáveis, suporte treinado e rollback testado. |

## 15. Testes obrigatórios

Os testes devem ser executados antes de cada promoção de ambiente e não apenas no final do projeto.

| Categoria | Casos mínimos |
|---|---|
| Auth | Login válido/inválido, senha fraca, email não verificado, reset, logout, sessão expirada, sessão revogada, MFA, enumeração e brute force. |
| Autorização | Anônimo, usuário autenticado, role insuficiente, usuário removido, tenant incorreto, troca de tenant, acesso por ID manipulado. |
| Firestore | Leitura, criação, atualização, exclusão, query com dados mistos, campos proibidos, timestamp adulterado e regras em modo deny. |
| API | Payload inválido, JSON grande, método incorreto, CSRF ausente, Origin inválida, CORS, replay, idempotência e rate limit. |
| Privacidade | Logs sem senha/token, respostas sem PII desnecessária, exportação autorizada e eliminação/retensão. |
| UI | Loading, offline, timeout, 401, 403, 409, 429, erro 500, sessão perdida, acessibilidade e responsividade. |
| Segurança | XSS, injection em filtros, IDOR/BOLA, open redirect, clickjacking, CSP, headers e dependências vulneráveis. |
| Recuperação | Backup válido, restauração em banco novo, reprocessamento idempotente e conferência de contagens. |

O Emulator Suite deve testar casos autenticados e não autenticados com `@firebase/rules-unit-testing`, conforme o fluxo recomendado pela documentação [5]. Testes de API devem usar projeto Firebase de staging e dados descartáveis.

## 16. Observabilidade, auditoria e resposta a incidentes

Devem existir logs estruturados com `requestId`, endpoint, status, duração, tenant não sensível, uid pseudonimizado, resultado de autorização e código de erro. Senhas, tokens, cookies, headers de autorização, private keys e payloads financeiros completos nunca devem entrar em logs.

Alertas devem cobrir picos de login falho, 401/403 anormais, 429, erros de autorização, falhas de sessão, falhas de App Check, aumento de leituras/escritas, custo, latência, erros de funções e sinais de exportação abusiva. O checklist do Firebase recomenda monitoramento e alertas contra tráfego abusivo [7].

A auditoria de negócio deve registrar quem executou, o que mudou, quando, tenant, motivo quando aplicável, request ID e resultado. Exclusões financeiras devem ser substituídas por cancelamento ou tombstone quando a retenção exigir histórico. Logs administrativos devem ter acesso restrito e retenção definida.

O plano de incidentes deve conter: contenção de sessão, revogação de tokens, bloqueio temporário de endpoint, rotação de credenciais, preservação de logs, avaliação de tenants afetados, comunicação, correção, restauração e relatório pós-incidente.

## 17. Backup, continuidade e recuperação

O Firestore oferece backups agendados diários ou semanais com retenção configurável e restauração para um novo banco [9]. O APEX Food deverá definir com o negócio:

| Item | Decisão necessária |
|---|---|
| RPO | Quanto de dado pode ser perdido em um incidente. |
| RTO | Quanto tempo o sistema pode ficar indisponível. |
| Retenção | Por quanto tempo backups e logs devem ser mantidos. |
| Região | Região primária e requisitos de residência de dados. |
| Restauração | Quem aprova, como validar e como impedir sobrescrita acidental da produção. |
| Exercício | Periodicidade do teste de restauração e evidência produzida. |

Backups não substituem Security Rules, IAM ou logs. Cada restauração deve ocorrer primeiro em um banco novo de staging, com conferência de documentos, índices, integrações, contagens e acesso por tenant.

## 18. Privacidade e conformidade

Antes do go-live, o projeto deverá mapear os dados pessoais tratados, finalidade, base legal, retenção, operadores, exportação e exclusão. Dados de funcionários, clientes, avaliações, contatos, documentos e informações financeiras devem ter minimização e acesso por necessidade.

A interface deverá ter política de privacidade e termos coerentes com o fluxo real. Solicitações de acesso, correção, exportação e exclusão devem ser executadas por processo autenticado e auditado, respeitando obrigações legais e retenções fiscais quando aplicáveis. Não usar analytics ou ferramentas de replay que capturem senha, email completo, dados financeiros ou informações sensíveis.

## 19. Checklist de go-live

| Controle | Evidência exigida |
|---|---|
| Service account | Não existe no repositório, bundle ou logs. |
| Segredos Vercel | Separados por ambiente, sensíveis, rotacionáveis e sem prefixo público. |
| Sessão | Cookie HttpOnly/Secure/SameSite, expiração, revogação e logout testados. |
| CSRF/CORS | Origin allowlist, token CSRF e testes negativos. |
| Auth | Email verification, enumeration protection, quotas, reset e MFA para admins. |
| Tenant | Tentativas de acesso cruzado rejeitadas no endpoint e nos testes. |
| Firestore | Regras em produção/deny por padrão, testes no Emulator e IAM mínimo. |
| App Check | Monitoramento, análise de falsos positivos e enforcement planejado. |
| API | Validação server-side, rate limit, idempotência, paginação e erros genéricos. |
| Frontend | Sem tokens, senhas, dados persistentes de negócio ou autoridade de role no storage local. |
| Dados | Mocks removidos por feature flag, seeds separados e migração reconciliada. |
| Backup | Backup configurado, restauração testada e RPO/RTO aprovados. |
| Operação | Alertas, dashboards, runbook e plano de incidente publicados. |
| Dependências | Lockfile, auditoria, secret scanning e revisão de supply chain. |
| Rollback | Deploy anterior e estratégia de rollback testados em staging. |

O lançamento só deve ocorrer quando não houver vulnerabilidade crítica ou alta sem aceite formal de risco. Segurança de dados de clientes não deve depender de pressa de entrega.

## 20. Entregáveis técnicos esperados

Ao final da implementação, o repositório deverá conter, no mínimo:

```text
api/
  v1/auth/
  v1/me/
  v1/restaurantes/
  v1/pedidos/
  v1/cardapio/
  v1/salao/
  v1/equipe/
  v1/financeiro/
  v1/relatorios/
server/
  firebase-admin/
  auth/
  authorization/
  validation/
  rate-limit/
  audit/
  errors/
  security/
firestore.rules
firestore.indexes.json
firebase.json
emulator-tests/
  rules/
  api/
  auth/
.env.example
SECURITY.md
RUNBOOK-INCIDENTES.md
```

A estrutura exata pode variar conforme o framework escolhido para a camada Vercel, mas a separação entre frontend, funções server-side, regras, testes e configuração deve permanecer explícita.

## 21. Critérios finais de aceite

A integração será considerada pronta somente quando um usuário não autenticado for redirecionado para autenticação, um usuário autenticado só conseguir acessar restaurantes autorizados, um papel insuficiente receber `403`, uma requisição sem CSRF falhar, uma repetição não duplicar uma operação, uma tentativa de manipular `idRestaurante` for rejeitada e nenhuma credencial sensível aparecer no bundle ou no storage local.

Também será obrigatório demonstrar que todos os 27 caminhos registrados no shell carregam dados pela API autorizada, que os módulos preservam loading/erro/vazio, que os relatórios não atravessam restaurantes, que o financeiro possui auditoria e que uma restauração de backup foi ensaiada em staging.

## 22. Configuração Firebase fornecida

O projeto Firebase informado para o APEX Food é `apex-food-6c1cb`. A configuração abaixo é a configuração **Web pública** da aplicação, não uma service account e não contém `private_key`. Segundo a documentação oficial, as API keys específicas dos serviços Firebase identificam o projeto; autorização deve ser aplicada por Firebase Security Rules, IAM e App Check [10]. Ainda assim, a API key deve ser restringida às APIs Firebase necessárias e nunca deve ser usada como mecanismo de autorização.

```js
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBmEaHXaK6fF541AzXlFn2BQ-CA91axlDo',
  authDomain: 'apex-food-6c1cb.firebaseapp.com',
  projectId: 'apex-food-6c1cb',
  storageBucket: 'apex-food-6c1cb.firebasestorage.app',
  messagingSenderId: '771860546633',
  appId: '1:771860546633:web:4e609e3c334ed02d352b98',
};

const app = initializeApp(firebaseConfig);
```

### Classificação dos valores fornecidos

| Valor | Classificação | Tratamento |
|---|---|---|
| `apiKey` | Identificador público da aplicação Firebase | Pode aparecer na configuração Web, mas deve ser restrita às APIs Firebase e nunca substitui Rules/IAM/App Check. |
| `authDomain` | Identificador público de domínio | Deve ser combinado com Authorized Domains no Firebase Authentication. |
| `projectId` | Identificador público do projeto | Pode ser usado pelo build ou pelo servidor; não concede acesso por si só. |
| `storageBucket` | Identificador público do bucket | Não concede leitura/escrita sem regras/autorização. |
| `messagingSenderId` | Identificador público de mensageria | Não é segredo administrativo. |
| `appId` | Identificador público da aplicação Web | Usado para registrar o app no Firebase/App Check. |

> **Não foi fornecida nenhuma credencial administrativa.** A implementação server-side ainda precisará de uma identidade de serviço com menor privilégio ou integração equivalente, armazenada exclusivamente como segredo na Vercel. Nunca colocar service account JSON, `client_email`, `private_key`, refresh token ou secret de sessão no frontend, no Git ou neste bloco público.

A arquitetura recomendada para o APEX Food não precisa carregar esse `firebaseConfig` no navegador se todas as operações forem feitas pela API da Vercel. Nesse cenário, ele funciona como metadado de projeto e configuração do ambiente Firebase; a camada server-side usa as variáveis administrativas protegidas. Se algum SDK Web for usado no futuro, somente essa configuração pública poderá ir para o bundle, acompanhada de Rules e App Check.

## 23. Plano executável em etapas obrigatórias

As etapas abaixo devem ser executadas em ordem. Nenhuma etapa deve ser pulada para acelerar o go-live. Cada etapa possui uma entrega, uma validação e um ponto de parada caso exista risco crítico.

### Etapa 0 — Governança e decisão de segurança

Registrar os responsáveis pelo Firebase, Vercel, domínio, segurança e suporte. Confirmar que o padrão de identidade é `meunome@apexfood.com`, definir os restaurantes, papéis, MFA obrigatório para administradores, política de retenção, RPO/RTO e processo de resposta a incidentes.

**Entrega:** matriz de responsabilidades, decisão de email, threat model, matriz de papéis e checklist de aceite.

**Bloqueio:** não criar dados de produção antes de definir quem poderá administrar usuários, regras e segredos.

### Etapa 1 — Separar ambientes

Criar ou confirmar três ambientes: `development`, `staging` e `production`. O projeto informado `apex-food-6c1cb` deve ser identificado como produção somente após confirmação. Para testes, usar projeto Firebase separado ou ambiente isolado. Nunca usar a base de produção para testes locais, seeds ou experimentos.

**Entrega:** mapa de projetos, regiões, domínios e variáveis por ambiente.

**Validação:** um teste local não consegue ler nem escrever no projeto de produção por engano.

### Etapa 2 — Configurar o aplicativo Web no Firebase

No Firebase Console, abrir **Project settings > General > Your apps** e confirmar o Web App correspondente ao `appId` informado. Conferir `projectId`, `authDomain`, `storageBucket`, `messagingSenderId` e `appId` contra o bloco da Seção 22.

Em **Authentication > Settings > Authorized domains**, adicionar somente os domínios necessários: domínio de produção, domínio de staging/preview e `localhost` apenas no ambiente de desenvolvimento. Remover domínios desconhecidos ou temporários antes do go-live.

Em **Google Cloud Console > APIs & Services > Credentials**, confirmar que a API key é uma chave Firebase provisionada e restringida às APIs Firebase necessárias. Não adicionar Maps, Gemini ou APIs não relacionadas nessa mesma chave pública [10].

**Entrega:** relatório de configuração do Web App, domínios autorizados e restrições da API key.

### Etapa 3 — Configurar Firebase Authentication

No Firebase Console, acessar **Authentication > Sign-in method** e ativar inicialmente Email/Password. Configurar verificação de email, templates de envio, domínio remetente, recuperação de senha e URLs autorizadas. Ativar proteção contra enumeração de email e quotas adequadas para impedir brute force, conforme o checklist oficial [7].

Em **Authentication > Settings**, definir política de senha, limites de tentativa e domínios autorizados. Para `proprietario`, `administrador`, `financeiro` e demais perfis críticos, ativar MFA e definir o fluxo de enrollment, recuperação e revogação. O MFA para Web exige email verificado e domínio autorizado [8].

O backend deverá montar o email completo como `localPart@apexfood.com`, validar caracteres e unicidade e só então chamar o Firebase Auth. A máscara visual do frontend nunca será a autoridade.

**Entrega:** Auth configurado, email de verificação testado, recuperação testada, MFA de administrador testado e quotas documentadas.

### Etapa 4 — Criar identidade administrativa server-side
Criar uma service account dedicada para as funções da Vercel, com o menor conjunto possível de permissões. Preferir uma integração de identidade sem chave estática quando disponível; se uma chave for inevitável, gerar uma credencial exclusiva para Development/Preview, armazená-la apenas como variável sensível da Vercel, remover qualquer cópia local e definir rotação.
A service account não deve ser usada por desenvolvedores no navegador, não deve ser commitada no Git e não deve aparecer no bundle. O Admin SDK usado no backend bypassa as Firestore Rules; por isso, toda função precisa verificar sessão, restaurante e papel antes de chamar o Firestore [1] [5]. O adaptador server-side foi criado em `backend/firebase/admin.js`, validado localmente e os três secrets foram declarados como configurados na Vercel pelo responsável do projeto. A validação de conectividade ficará associada ao health check da Etapa 7.
**Entrega:** concluída em Development; identidade server-side documentada, secrets fora do Git/frontend e adapter fail-closed validado.

### Etapa 5 — Criar Firestore em modo de produção

Em **Firestore Database**, criar ou confirmar o banco na região aprovada, selecionando modo de produção/locked. Definir `firestore.rules` com negação por padrão no início, criar índices somente quando necessários e manter `firestore.indexes.json` versionado.

**Resultado confirmado em Development:** o projeto já possuía o banco `(default)` vazio na região `nam5`, com edição Padrão e Firestore nativo. A região foi preservada para evitar migração destrutiva. O Console exibiu as regras deny-by-default no banco e o simulador confirmou leitura anônima negada e gravação anônima negada no caminho de teste `test/probe`. Os arquivos `firestore.rules`, `firestore.indexes.json` e `configuracoes/firebase/firestore-development.json` foram versionados como referência do estado confirmado. Backups programados permanecem desativados e Production continua desativada.

Para a arquitetura API-only recomendada, começar com:

```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Essa regra impede acesso direto pelo SDK Web. A API server-side ainda deverá autorizar cada requisição, porque Admin SDK e bibliotecas de servidor não são bloqueados pelas Rules. Se uma leitura direta do navegador for aprovada no futuro, ela deverá ter regras explícitas por restaurante, membro, papel e campos permitidos, além de testes no Emulator; nunca substituir a negação por `allow read, write: if true`.

Um exemplo ilustrativo para um recurso de baixo risco, somente se o acesso direto for formalmente aprovado, é:

```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function autenticado() {
      return request.auth != null;
    }

    function eMembro(idRestaurante) {
      return autenticado()
        && exists(/databases/$(database)/documents/restaurantes/$(idRestaurante)/membros/$(request.auth.uid))
        && get(/databases/$(database)/documents/restaurantes/$(idRestaurante)/membros/$(request.auth.uid)).data.estado == 'ativo';
    }

    match /restaurantes/{idRestaurante}/cardapioPublico/{idDocumento} {
      allow read: if eMembro(idRestaurante);
      allow write: if false;
    }
  }
}
```

Esse exemplo não é suficiente para financeiro, equipe, pedidos ou administração. O campo `estado`, o membro e qualquer papel devem ser protegidos por uma operação confiável. Todas as regras devem ser testadas no Emulator antes de serem publicadas [5].

**Entrega:** banco locked, Rules em deny-by-default, índices revisados, testes de Rules e procedimento de deploy.

### Etapa 6 — Definir a estrutura multi-restaurante

Criar o contrato documental em português com `usuarios/{idUsuario}`, `restaurantes/{idRestaurante}`, `restaurantes/{idRestaurante}/membros/{idUsuario}` e as subcoleções de cada módulo dentro do restaurante. O `idRestaurante` usado pela API deve ser obtido da sessão e do membro ativo, nunca aceito como autoridade do corpo do cliente.

Adicionar `criadoEm`, `atualizadoEm`, `criadoPor`, `atualizadoPor`, `versao`, `estado` e os demais campos de auditoria definidos em `docs/firebase/etapa-6-schema-multitenant.md`. Usar datas do servidor. Operações como reserva, pagamento, fechamento e baixa de estoque devem ser transacionais ou idempotentes.

**Entrega:** concluída documentalmente em português; contrato versionado, dicionário de dados, política de retenção e matriz de acesso por coleção registrados. A criação de dados, endpoints e testes reais dependerá da Etapa 7.

### Etapa 7 — Criar a API protegida na Vercel

A base da camada `/api/v1` foi implementada localmente com módulos separados para autenticação, sessão, identidade, restaurantes e health check. Cada endpoint aplica método, origem, CSRF quando há mutação, payload, sessão, restaurante, papel quando aplicável e limite de uso antes da operação. A autorização por módulo operacional será adicionada nas etapas correspondentes.

O frontend deve enviar apenas dados de formulário e comandos necessários. A API devolve DTOs mínimos, paginação e códigos de erro genéricos. Nenhum endpoint aceita `idUsuario`, `idRestaurante`, `papel`, `criadoPor`, `aprovadoPor` ou data/hora como autoridade.

**Status:** implementação local validada; `npm test` aprovado com 8/8 testes e `node --check` aprovado.
**Pendente:** cadastrar `FIREBASE_WEB_API_KEY`, `SESSION_SECRET`, `CSRF_SECRET`, `APP_ORIGIN`, `ALLOWED_ORIGINS` e rate limit distribuído na Vercel; publicar em Preview e confirmar `/api/v1/health` com `estado: "ok"`.

**Entrega:** `docs/firebase/etapa-7-api-server-side.md`, funções server-side, validação e contratos iniciais. A integração da página de autenticação permanece bloqueada até a confirmação remota.

### Etapa 8 — Integrar a página de autenticação

Substituir a simulação atual da `paginas/autenticacao.html` por chamadas HTTPS à API. Remover qualquer dependência futura de `localStorage`/`sessionStorage` para autenticação. O navegador não deve ler o cookie HttpOnly. Após o login, a API cria a sessão e o shell chama `GET /api/v1/auth/session` para descobrir o usuário autorizado.

Implementar registro, login, logout, verificação, recuperação, alteração de senha, MFA e expiração de sessão. Mensagens de erro não devem revelar se um email existe. O fluxo de cadastro deve montar o endereço completo no servidor, aceitando `meunome@apexfood.com` e, opcionalmente, `meunome.sobrenome@apexfood.com`, sempre com o domínio fixo `@apexfood.com`.

**Status:** implementação local concluída e validada com 11 testes; cliente same-origin, CSRF em memória, guard de sessão, cookies HttpOnly e recuperação genérica implementados. A política do Firebase Authentication Development está alinhada com mínimo 8 caracteres, aplicação obrigatória e complexidade de maiúscula, minúscula, especial e número.

**Entrega:** `docs/firebase/etapa-8-autenticacao.md`, cliente da API, guard do shell, endpoint de recuperação e testes de contrato. A Etapa 9 permanece bloqueada até a validação remota e aprovação explícita.

### Etapa 9 — Migrar módulos por risco

Migrar primeiro módulos de menor risco estrutural para validar o adaptador: Cardápio e Salão. Depois migrar Pedidos e Operacional. Em seguida migrar Equipe e Relatórios. Por último migrar Financeiro, Fechamentos e dashboards financeiros, sempre com auditoria e transações.

Cada módulo deve substituir os objetos globais simulados por um serviço assíncrono, preservar loading/erro/vazio, validar permissões e não alterar a estrutura do shell. A tabela completa de rotas e coleções está na Seção 8.

**Entrega:** uma feature flag por módulo, testes de integração e plano de rollback.

### Etapa 10 — Testar regras, API e segurança

Executar `firebase emulators:exec` com testes de Rules, testes de API com projeto staging e testes end-to-end no preview da Vercel. Cobrir IDOR/BOLA, tenant manipulado, role insuficiente, CSRF, XSS, brute force, enumeração, replay, duplicidade, payload grande e vazamento em logs.

O pipeline deve bloquear deploy quando houver teste de autorização falhando, segredo detectado, dependência vulnerável crítica/alta ou regra aberta fora de uma exceção aprovada.

**Entrega:** relatório de testes, cobertura de Rules, evidências negativas e aprovação de segurança.

### Etapa 11 — Ativar App Check, monitoramento e backups

Registrar o Web App no App Check, usar reCAPTCHA Enterprise para Web quando aplicável, começar em modo de observação, analisar falsos positivos e ativar enforcement progressivamente. O App Check protege recursos contra clientes não autorizados, mas não substitui Auth, Rules ou autorização [3].

Configurar alertas de Auth, 401/403/429, falhas de Rules, erros de API, latência, leituras/escritas anormais e custo. Configurar backups agendados, retenção, PITR quando aprovado e teste de restauração para banco novo; backups do Firestore podem ser diários ou semanais e restaurados em novo banco [9].

**Entrega:** dashboards, alertas, runbook, backup, restauração ensaiada e RPO/RTO aprovado.

### Etapa 12 — Go-live gradual na Vercel

Publicar primeiro em Preview/Staging. Validar domínios autorizados, cookies, CSP, CORS, variáveis e logs. Liberar para um tenant interno, depois para um grupo pequeno e finalmente para a base completa. Monitorar erros, custo, latência, autenticação e isolamento durante cada janela.

Manter rollback para o deploy anterior, desativar feature flags problemáticas e revogar credenciais comprometidas. O go-live só será aprovado sem vulnerabilidade crítica/alta aberta e com suporte treinado.

## 24. Guia prático de configuração no Firebase Console

### 24.1 Projeto e aplicação Web

1. Acesse o [Firebase Console](https://console.firebase.google.com/) e selecione o projeto `apex-food-6c1cb`.
2. Abra **Project settings > General > Your apps** e confirme se o Web App possui o `appId` `1:771860546633:web:4e609e3c334ed02d352b98`.
3. Compare a configuração exibida com a Seção 22. Se houver divergência, não copie valores de outro projeto.
4. Em **Authentication > Settings > Authorized domains**, adicione somente `localhost`, o domínio de staging/preview aprovado e o domínio de produção.
5. Em **Google Cloud Console > APIs & Services > Credentials**, restrinja a API key às APIs relacionadas ao Firebase. Não use essa chave para APIs não relacionadas.

### 24.2 Firebase Authentication

1. Abra **Build > Authentication > Sign-in method**.
2. Ative **Email/Password**.
3. Configure verificação de email e recuperação de senha.
4. Configure templates, domínio remetente e URLs de ação de email.
5. Ative proteção contra enumeração e defina quotas/limites de login.
6. Configure política de senha com mínimo aprovado pelo negócio; o backend deve validar novamente.
7. Ative MFA para perfis administrativos e teste enrollment, login, recuperação e revogação.
8. Crie contas de teste somente no projeto de staging. Nunca use contas reais de clientes para testes.

### 24.3 Firestore

1. Abra **Build > Firestore Database**.
2. Escolha a região aprovada e **Production mode**.
3. Versione `firestore.rules` e `firestore.indexes.json` no repositório.
4. Comece com Rules deny-by-default da Etapa 5.
5. Rode os testes no Emulator Suite.
6. Faça revisão de segurança e então publique com Firebase CLI:

```bash
firebase login
firebase use apex-food-6c1cb
firebase emulators:exec --only firestore "npm test"
firebase deploy --only firestore:rules,firestore:indexes
```

7. Não executar `firebase deploy` sem revisar o diff das Rules e sem confirmar o projeto ativo.
8. Após o deploy, valide operações permitidas e negadas com usuários de teste.

### 24.4 App Check

1. Abra **Build > App Check**.
2. Registre o Web App pelo `appId` informado.
3. Configure o provedor Web recomendado para o projeto.
4. Ative métricas/monitoramento primeiro.
5. Observe tráfego legítimo de staging e preview.
6. Ative enforcement somente após validar navegadores e integrações reais.

## 25. Guia prático de configuração na Vercel

### 25.1 Projeto e ambientes

1. Crie ou selecione o projeto Vercel do APEX Food.
2. Configure três grupos: **Development**, **Preview** e **Production**.
3. Aponte Preview para o projeto Firebase de staging e Production para `apex-food-6c1cb` somente quando o projeto estiver aprovado para produção.
4. Configure domínio de produção e use HTTPS.
5. Adicione o domínio final ao Firebase Authentication Authorized Domains e ao allowlist de CORS.

### 25.2 Variáveis públicas e secretas

A configuração Web fornecida é pública por natureza, mas a arquitetura API-only não precisa expô-la no bundle. As variáveis server-side devem ser cadastradas na Vercel como Sensitive Environment Variables [6].

Variáveis não sensíveis ou identificadoras:

```text
FIREBASE_PROJECT_ID=apex-food-6c1cb
FIREBASE_AUTH_DOMAIN=apex-food-6c1cb.firebaseapp.com
FIREBASE_STORAGE_BUCKET=apex-food-6c1cb.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=771860546633
FIREBASE_APP_ID=1:771860546633:web:4e609e3c334ed02d352b98
```

Variáveis sensíveis, obtidas somente para o backend:

```text
FIREBASE_CLIENT_EMAIL=<service-account-client-email>
FIREBASE_PRIVATE_KEY=<service-account-private-key>
SESSION_SECRET=<generated-long-random-secret>
CSRF_SECRET=<generated-long-random-secret>
RATE_LIMIT_CREDENTIAL=<provider-secret>
APP_CHECK_SECRET=<server-verification-secret-if-required>
```

Não usar prefixo público como `NEXT_PUBLIC_` ou equivalente nas variáveis sensíveis. Não colocar `FIREBASE_PRIVATE_KEY` no `.env.example` com valor real. No valor da chave privada, preservar as quebras de linha conforme o runtime da aplicação; a forma exata deverá ser validada em staging antes de produção.

### 25.3 Cadastro pelo Dashboard

No Vercel Dashboard, abra **Project > Settings > Environment Variables**, selecione o ambiente e adicione cada variável. Marque credenciais como **Sensitive** quando a opção estiver disponível. Depois de alterar variáveis, faça novo deploy; funções já implantadas não devem ser consideradas atualizadas sem redeploy.

### 25.4 Deploy e validação

1. Faça commit somente de `.env.example` sem valores reais.
2. Configure as variáveis na Vercel Dashboard.
3. Publique primeiro em Preview.
4. Teste `GET /api/v1/health` sem revelar configuração interna.
5. Teste login, sessão, logout, autorização e uma leitura de staging.
6. Confira logs para garantir que nenhum segredo foi impresso.
7. Promova para Production somente após aprovação do checklist.
8. Após o go-live, faça rotação programada e mantenha procedimento de revogação.

### 25.5 Configuração por CLI sem expor valores na linha de comando

A configuração por Dashboard é preferível para secrets. Se a equipe usar CLI, não colocar secrets diretamente no histórico do shell, em comandos copiados para tickets ou em arquivos versionados. Usar o fluxo interativo/seguro recomendado pela Vercel e revisar os ambientes antes de cada alteração.

## 26. Checklist final de configuração

| Verificação | Concluído quando |
|---|---|
| Projeto Firebase | `apex-food-6c1cb` confirmado e ambiente correto selecionado. |
| Web App | `appId` e demais valores conferidos. |
| API key | Restrita a APIs Firebase e não usada como autorização. |
| Auth domains | Apenas domínios aprovados cadastrados. |
| Email Auth | Ativo, verificação, reset, quotas e proteção contra enumeração configurados. |
| MFA | Obrigatório para perfis críticos e testado. |
| Firestore | Production mode, Rules deny-by-default e índices versionados. |
| Rules | Testadas no Emulator e publicadas somente após revisão. |
| Admin SDK | Service account mínima, sem segredo no Git ou bundle. |
| Vercel | Development/Preview/Production separados. |
| Cookies | HttpOnly/Secure/SameSite, CSRF e CORS testados. |
| App Check | Monitoramento iniciado e enforcement progressivo planejado. |
| Backups | Agenda, retenção, restauração e RPO/RTO definidos. |
| Observabilidade | Alertas de auth, API, Rules, custo e abuso ativos. |
| Rollback | Deploy anterior, flags e revogação de sessão/credencial testados. |

## Referências

[1]: https://firebase.google.com/docs/firestore/security/get-started "Get started with Cloud Firestore Security Rules — Firebase"

[2]: https://firebase.google.com/docs/auth/admin/manage-cookies "Manage Session Cookies — Firebase Authentication"

[3]: https://firebase.google.com/docs/app-check "Firebase App Check — Firebase"

[4]: https://firebase.google.com/docs/auth/admin/custom-claims "Control Access with Custom Claims and Security Rules — Firebase Authentication"

[5]: https://firebase.google.com/docs/firestore/security/test-rules-emulator "Test your Cloud Firestore Security Rules — Firebase"

[6]: https://vercel.com/docs/environment-variables/sensitive-environment-variables "Sensitive Environment Variables — Vercel"

[7]: https://firebase.google.com/support/guides/security-checklist "Firebase security checklist — Firebase"

[8]: https://firebase.google.com/docs/auth/web/multi-factor "Add multi-factor authentication to your web app — Firebase Authentication"

[9]: https://firebase.google.com/docs/firestore/backups "Back up and restore data — Firestore"

[10]: https://firebase.google.com/docs/projects/api-keys "Learn about and manage API keys for Firebase — Firebase Documentation"
