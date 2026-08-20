# Fase 2 — Contrato Real v1 do Firestore e da API

**Projeto:** APEX Food (`apex-food-6c1cb`)

**Ambiente:** Development

**Versão do contrato:** `1.0.0`

**Status:** Definido e validado; nenhuma coleção ou documento de negócio foi criado por esta fase.

## 1. Finalidade

Este documento consolida o modelo de dados e os contratos da API que serão usados para transformar as páginas do APEX Food em funcionalidades reais. A estrutura preserva as decisões das etapas anteriores: Firestore `(default)` em `nam5`, Rules deny-by-default, sessão por cookie HttpOnly, contexto de restaurante assinado, RBAC server-side, CSRF, App Check conforme ambiente e auditoria append-only.

O manifesto técnico completo está em [`contrato-real-v1.json`](./contrato-real-v1.json). Este documento apresenta a versão legível para revisão funcional e serve como contrato de implementação para as próximas fases.

> **Regra de realidade:** uma coleção ou recurso marcado como `contrato_definido_integracao_pendente` descreve o modelo aprovado, mas não está autorizado a aparecer na interface como dado real até que sua leitura, mutação, autorização e teste sejam implementados.

## 2. Escopo multi-tenant

O documento global do usuário fica em `usuarios/{idUsuario}`. O restaurante fica em `restaurantes/{idRestaurante}`. Os dados operacionais ficam em subcoleções do restaurante, e o vínculo do usuário fica em `restaurantes/{idRestaurante}/membros/{idUsuario}`.

O backend obtém o usuário da sessão, lê o contexto assinado, revalida o vínculo ativo e somente então autoriza a operação. O `idRestaurante`, o `idUsuario`, os papéis, a autoria e os timestamps enviados pelo navegador nunca são autoridade.

| Regra | Contrato |
|---|---|
| Escopo efetivo | Derivado da sessão e do membro ativo do restaurante |
| Autoridade de identidade | Firebase Authentication + Session Cookie validado no backend |
| Autoridade de dados | Firebase Admin SDK somente no backend |
| Identificadores | Criados ou validados no servidor |
| Datas de criação e auditoria | `FieldValue.serverTimestamp()` ou equivalente server-side |
| Dinheiro | Inteiros em centavos, sempre com `moeda: "BRL"` |
| PII | Separada, mascarada ou omitida nas respostas operacionais |
| Auditoria | `registrosAuditoria`, somente acréscimo |
| Exclusão | Preferencialmente exclusão lógica com `estado` e timestamps de exclusão |

## 3. Coleções canônicas

### 3.1 Coleções globais

| Coleção | Caminho | Status | Finalidade |
|---|---|---|---|
| `usuarios` | `usuarios/{idUsuario}` | Implementada | Perfil global mínimo, sem senha ou segredo |
| `restaurantes` | `restaurantes/{idRestaurante}` | Implementada | Cadastro e configuração principal do estabelecimento |
| `registrosAuditoria` | `registrosAuditoria/{idRegistro}` | Implementada | Rastro append-only de eventos autorizados, negados ou falhos |

Os campos principais de `usuarios` são `idUsuario`, `emailCanonico`, `nomeExibicao`, `estado`, `idRestaurantePadrao`, `criadoEm`, `atualizadoEm`, `ultimoLoginEm`, `criadoPor`, `atualizadoPor` e `versao`.

Os campos principais de `restaurantes` são `idRestaurante`, `nome`, `razaoSocial`, `estado`, `fusoHorario`, `localidade`, `moeda`, `idProprietario`, `criadoEm`, `atualizadoEm`, `criadoPor`, `atualizadoPor` e `versao`.

A auditoria usa `idRestaurante`, `idAtor`, `papeisDoAtor`, `acao`, `tipoRecurso`, `idRecurso`, `idOperacao`, `idRequisicao`, `resultado`, `codigoMotivo`, `criadoEm`, `versaoEstruturaAuditoria` e `classeRetencao`. Senhas, tokens, cookies, chaves privadas e payloads financeiros completos são proibidos.

### 3.2 Subcoleções de cada restaurante

| Subcoleção | Status do contrato | Finalidade | Campos críticos |
|---|---|---|---|
| `membros` | Implementada | Vínculo, papéis e estado de acesso | `idUsuario`, `idRestaurante`, `papeis`, `papelPrincipal`, `escopos`, `estado`, `entrouEm`, autoria, versão |
| `categoriasCardapio` | Implementada | Categorias do cardápio | `nome`, `descricao`, `icone`, `cor`, `ordem`, `estado` |
| `produtos` | Implementada | Produtos e preços | `idCategoria`, `nome`, `descricao`, `precoCentavos`, `custoCentavos`, `estoque`, `unidade`, `tempoPreparo`, `disponibilidade`, `estado` |
| `promocoes` | Contrato definido; integração pendente | Campanhas e regras de promoção | `nome`, `tipo`, `descricao`, vigência, limite, usos e `estado` |
| `configuracaoCardapioDigital` | Contrato definido; integração pendente | Publicação e versão do cardápio digital | `publicado`, `versaoPublicada`, `linkPublico`, `referenciaQrCode` |
| `mesas` | Implementada | Mesas e estado do salão | `numero`, `capacidade`, `localizacao`, `observacoes`, `status`, `idQrCode`, `estado` |
| `eventosMesas` | Implementada | Histórico de mudanças de mesa | mesa, estado anterior, estado novo, autoria e timestamp |
| `reservas` | Implementada | Reservas e conflitos de horário | `mesaId`, cliente, contato mascarado, início, fim, pessoas, `estado`, observações |
| `configuracaoSalao` | Implementada | Configuração do salão | `nome`, `layout`, versão e autoria |
| `pedidos` | Contrato definido; integração pendente | Ciclo completo de pedidos | origem, atendimento, mesa, comanda, itens, valores, estado e timestamps |
| `pedidos/{idPedido}/itens` | Contrato definido; integração pendente | Itens históricos do pedido | produto, nome copiado, quantidade, preço unitário, total e observações |
| `pedidos/{idPedido}/eventos` | Contrato definido; integração pendente | Histórico de transições | estados, ator, requisição e timestamp |
| `funcionarios` | Implementada | Perfil operacional público | nome, cargo, setor, turno, status, comissão e telefone mascarado |
| `dadosPrivadosFuncionarios` | Implementada | Dados privados de equipe | telefone completo separado, autoria e timestamps |
| `escalas` | Implementada | Turnos e jornadas | funcionário, data, entrada, saída, intervalo, turno e status |
| `comissoes` | Leitura implementada | Comissões calculadas | funcionário, período, vendas, percentual, comissão, pedidos e posição |
| `fechamentosCaixa` | Implementada | Fechamento e conferência | saldos em centavos, recebimentos, operador, estado e timestamps |
| `movimentacoesCaixa` | Implementada | Entradas e saídas | tipo, data, categoria, descrição, origem, forma, valor e estado |
| `contasPagar` | Implementada | Obrigações financeiras | descrição, categoria, vencimento, valor, recorrência e estado |
| `contasReceber` | Implementada | Valores a receber | descrição, categoria, vencimento, valor, recorrência e estado |
| `relatoriosFinanceiros` | Leitura implementada | Relatórios mensais | período, vendas, despesas, resultado e categorias |
| `resumosFinanceiros` | Leitura implementada | Resumos para dashboards | caixa atual, recebimentos, compromissos, saldo projetado e vendas do dia |
| `chavesIdempotencia` | Implementada | Repetição segura de mutações | rota, ator, resumo da chave, resultado e expiração |

Todos os documentos operacionais têm `idRestaurante` persistido, embora esse campo seja removido dos DTOs públicos quando não for necessário. Autoria, timestamps e versão são preenchidos no servidor.

## 4. Papéis e permissões

| Papel | Leitura principal | Mutação principal |
|---|---|---|
| `proprietario` | Todos os módulos autorizados | Propriedade, configurações, equipe, operação e financeiro |
| `administrador` | Equipe, operação, cardápio e relatórios autorizados | Equipe, operação e configuração permitida |
| `gerente` | Cardápio, salão, equipe e relatórios | Cardápio, salão e escalas conforme contrato |
| `financeiro` | Financeiro, relatórios e equipe necessária | Contas, movimentações e fechamento |
| `caixa` | Operações de caixa permitidas | Somente comandos de caixa autorizados |
| `cozinha` | Fila e produção | Transições de produção autorizadas |
| `garcom` | Mesas, reservas e pedidos operacionais | Ações de salão e pedido permitidas |
| `analista` | Relatórios autorizados | Nenhuma mutação operacional padrão |
| `auditor` | Leitura controlada e auditoria | Nenhuma mutação |

A autorização segue sempre a ordem: validar sessão, resolver usuário, resolver restaurante efetivo, obter membro ativo, conferir papéis, validar payload, executar operação e registrar auditoria.

## 5. Contrato HTTP comum

Os endpoints operacionais usam `GET`, `POST` e `PATCH` conforme o recurso. Respostas são JSON com `Content-Type: application/json`, `Cache-Control: no-store, private` e `X-Content-Type-Options: nosniff`.

Resposta de sucesso retorna o corpo específico do recurso. Resposta de erro segue o envelope:

```json
{
  "erro": "CODIGO_CONTROLADO",
  "mensagem": "Descrição segura para o usuário.",
  "idRequisicao": "id-de-correlacao"
}
```

O cliente deve exibir `mensagem` sem revelar detalhes internos. `idRequisicao` deve ser preservado para suporte e auditoria. Erros internos nunca retornam stack trace, credenciais ou documentos do Firestore.

Mutações exigem CSRF válido, origem permitida e App Check conforme o ambiente. O limite de paginação é imposto pelo servidor, mesmo quando o cliente envia `limite`.

## 6. Endpoints operacionais implementados

### Cardápio — `/api/v1/cardapio`

| Operação | Recurso | Contrato |
|---|---|---|
| `GET` | `categorias`, `produtos`, `promocoes` | Lista DTOs visíveis; sem `criadoPor`, `atualizadoPor` ou `idRestaurante` |
| `POST` | `categoria` | Requer `nome`; aceita `descricao`, `icone`, `cor`, `ordem`; cria `categoriasCardapio` |
| `POST` | `produto` | Requer `idCategoria`, `nome`, `precoCentavos`; valida categoria e cria em `produtos` |
| `PATCH` | `categoria` | Atualiza campos validados, versão e autoria |
| `PATCH` | `produto` | Atualiza nome, descrição, preços, custo, estoque, tempo ou disponibilidade |

Valores monetários são inteiros em centavos. Promoções ainda possuem contrato de leitura e não podem ser confirmadas pela interface como mutáveis até a integração específica.

### Salão — `/api/v1/salao`

| Operação | Recurso | Contrato |
|---|---|---|
| `GET` | `mesas`, `reservas`, `configuracao` | Lista recursos do restaurante ativo com limite server-side |
| `POST` | `reserva` | Valida mesa, capacidade, intervalo e conflito em transação |
| `PATCH` | `reserva` | Altera estado permitido e registra auditoria |
| `PATCH` | `mesa` | Altera estado da mesa e cria evento em `eventosMesas` |

O DTO de reserva não retorna contato completo; usa contato mascarado. Estados de mesa são `disponivel`, `ocupada` e `indisponivel`. Estados de reserva são `aguardando`, `confirmada`, `chegou` e `cancelada`.

### Equipe — `/api/v1/equipe`

| Operação | Recurso | Contrato |
|---|---|---|
| `GET` | `funcionarios`, `escalas`, `comissoes` | Lista DTOs públicos e aceita `periodo` para comissões |
| `POST` | `funcionario` | Valida nome, cargo, setor, turno, status, comissão e telefone; grava público e privado em batch |
| `PATCH` | `funcionario` | Atualiza perfil público e, quando informado, telefone privado |
| `POST` | `escala` | Valida data, horários, jornada e funcionário; impede sobreposição em transação |
| `PATCH` | `escala` | Revalida funcionário e conflito antes de alterar |

Setores são `Salão`, `Cozinha`, `Bar` e `Gestão`. Turnos são `Almoço`, `Jantar` e `Integral`. Status de funcionário são `ativo`, `ferias` e `inativo`. Status de escala são `agendado`, `presente`, `folga`, `falta` e `cancelado`.

### Financeiro — `/api/v1/financeiro`

| Operação | Recurso | Contrato |
|---|---|---|
| `GET` | `resumos` | Retorna resumo financeiro e caixa atual |
| `GET` | `relatorios` | Retorna relatórios mensais; aceita `periodo` |
| `GET` | `contas` | Retorna contas a pagar e receber |
| `GET` | `movimentacoes` | Retorna movimentações de caixa |
| `GET` | `fechamentos` | Retorna fechamentos de caixa |
| `POST` | `conta` | Cria conta `pagar` ou `receber` com valor, categoria, vencimento e idempotência |
| `POST` | `movimentacao` | Cria entrada ou saída com valor positivo e idempotência |
| `PATCH` | `conta` | Aplica transição de estado permitida |
| `PATCH` | `movimentacao` | Aplica transição sem reverter conciliação indevidamente |
| `POST` | `fechamento` | Exige confirmação e grava saldo conferido/diferença de forma transacional |

Estados de contas a pagar são `pendente`, `vencida`, `pago`, `cancelada` e `excluida`. Estados de contas a receber são `prevista`, `recebido`, `cancelada` e `excluida`. Estados de movimentação são `pendente`, `conciliado`, `cancelada` e `excluida`. Estados de fechamento são `aberto`, `em_conferencia`, `fechado`, `reaberto` e `excluido`.

Toda mutação financeira usa valores em centavos, `moeda: "BRL"`, transação quando necessário, auditoria e `chaveIdempotencia` com expiração.

## 7. Contratos definidos, mas ainda não integrados

Os pedidos e o Cardápio Digital já têm o contrato de dados definido, mas seus handlers não devem ser simulados pela UI. Até a Fase 6, telas de pedido precisam permanecer em estado vazio ou explicitamente identificadas como não conectadas, sem confirmar “salvo”, “enviado”, “publicado” ou “avançado” como se houvesse persistência.

O mesmo princípio se aplica a promoções, publicação do Cardápio Digital, relatórios que ainda dependam de fixtures e qualquer exportação que não gere arquivo ou consulta real.

## 8. Invariantes obrigatórios

Os seguintes invariantes são parte do contrato e serão cobertos por testes:

| Invariante | Verificação |
|---|---|
| Isolamento | Toda leitura e mutação operacional parte de `restaurantes/{idRestaurante}` resolvido pelo servidor |
| Autoria | O cliente não define `criadoPor`, `atualizadoPor`, `idAtor` ou `idRestaurante` |
| Dinheiro | Valores monetários são inteiros em centavos |
| Datas | Datas e timestamps são normalizados e criados no backend |
| Estados | Transições inválidas retornam erro controlado |
| Idempotência | Mutações financeiras repetidas retornam o resultado armazenado, sem duplicar documento |
| PII | Contatos privados não retornam em listas públicas |
| Auditoria | Ações sensíveis criam registro append-only |
| DTO | Respostas não expõem autoria interna ou escopo desnecessário |
| Paginação | O limite máximo é imposto server-side |

## 9. Critérios de aceite da Fase 2

A Fase 2 está concluída quando o manifesto JSON e este documento estiverem versionados, os nomes de coleções e campos forem consistentes com os handlers atuais, os recursos pendentes estiverem explicitamente marcados, os endpoints possuírem métodos e recursos documentados, os invariantes estiverem testados e nenhuma Rule do Firestore tiver sido aberta prematuramente.

A criação de documentos reais, a remoção de fixtures e a ativação de dados nas páginas começarão somente na Fase 3 e nas fases de cada domínio, com aprovação separada.

## Referências

[1]: ./etapa-6-schema-multitenant.md "APEX Food — Estrutura multi-restaurante, membros, papéis e auditoria"

[2]: ./etapa-7-api-server-side.md "APEX Food — API server-side e sessão"

[3]: https://firebase.google.com/docs/firestore/data-model "Firebase — Modelo de dados do Cloud Firestore"

[4]: https://firebase.google.com/docs/firestore/manage-data/transactions "Firebase — Transações e gravações em lote"

[5]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase — Custom Claims"
