# Etapa 6 — Estrutura multi-restaurante, membros, papéis e auditoria

**Projeto:** APEX Food
**Ambiente:** Development (`apex-food-6c1cb`)
**Status:** Definido e documentado; nenhum documento ou coleção de negócio foi criado.
**Versão da estrutura:** `1.0.0`

> Todos os nomes de coleções, subcoleções e campos do APEX Food serão mantidos em português, usando `camelCase` sem acentos nos identificadores técnicos. Valores de papéis e estados também serão mantidos em português. O navegador nunca será autoridade para definir `idRestaurante`, `idUsuario`, papel, data, autoria ou permissão.

## 1. Decisões de arquitetura

Cada restaurante será um espaço isolado de dados. O documento global de um usuário ficará em `usuarios/{idUsuario}`. O documento do restaurante ficará em `restaurantes/{idRestaurante}` e os dados operacionais serão organizados em subcoleções desse restaurante. O vínculo entre usuário e restaurante ficará em `restaurantes/{idRestaurante}/membros/{idUsuario}`.

Essa estrutura utiliza documentos e subcoleções, o modelo nativo do Cloud Firestore, mantendo documentos leves e separando listas operacionais extensas [1]. As regras permanecem bloqueadas por padrão nesta etapa. A API server-side será implementada antes de qualquer abertura seletiva das Rules.

Nenhuma coleção será criada com documento fictício. A Etapa 6 é exclusivamente documental e de contrato.

## 2. Usuários e restaurantes

### 2.1 Caminho `usuarios/{idUsuario}`

O valor de `{idUsuario}` será o UID emitido pelo Firebase Authentication, mas o campo persistido seguirá o nome em português `idUsuario`.

| Campo | Tipo | Regra |
|---|---|---|
| `idUsuario` | texto | Igual ao ID do documento e derivado do Firebase Authentication. |
| `emailCanonico` | texto | Email completo normalizado; origem validada no servidor. |
| `nomeExibicao` | texto | Nome exibido, validado e limitado por tamanho. |
| `estado` | enum | `ativo`, `convidado`, `suspenso`, `desativado`, `excluido`. |
| `idRestaurantePadrao` | texto/nulo | Preferência de navegação; não autoriza acesso. |
| `criadoEm` | data/hora | Data/hora do servidor. |
| `atualizadoEm` | data/hora | Data/hora do servidor. |
| `ultimoLoginEm` | data/hora/nulo | Atualizado pelo backend após login válido. |
| `criadoPor` / `atualizadoPor` | texto | ID do ator validado ou `sistema`. |
| `versao` | inteiro | Versão monotônica do documento. |

O documento não armazenará senha, token, cookie, chave privada, segredo de convite ou credencial administrativa. O Firebase Authentication continua sendo a fonte de verdade para identidade, email verificado e estado de autenticação.

### 2.2 Caminho `restaurantes/{idRestaurante}`

Representa um restaurante cliente. O `idRestaurante` será criado pelo servidor e nunca escolhido pelo navegador.

| Campo | Tipo | Regra |
|---|---|---|
| `idRestaurante` | texto | Igual ao ID do documento e criado pelo servidor. |
| `nome` | texto | Nome comercial validado. |
| `razaoSocial` | texto/nulo | Informação empresarial restrita. |
| `estado` | enum | `teste`, `ativo`, `suspenso`, `arquivado`. |
| `fusoHorario` | texto | Fuso horário IANA validado. |
| `localidade` | texto | Inicialmente `pt-BR`. |
| `moeda` | texto | Inicialmente `BRL`. |
| `idProprietario` | texto | ID do usuário proprietário inicial. |
| `criadoEm` / `atualizadoEm` | data/hora | Datas/hora do servidor. |
| `criadoPor` / `atualizadoPor` | texto | ID do ator validado ou `sistema`. |
| `versao` | inteiro | Versão monotônica. |

Informações de cobrança, documentos fiscais e dados privados não serão misturados ao documento principal do restaurante. Esses dados terão documentos separados e respostas mínimas da API.

## 3. Membros e convites

### 3.1 Caminho `restaurantes/{idRestaurante}/membros/{idUsuario}`

Este documento representa o vínculo de uma pessoa com um restaurante. O backend obterá o ID do usuário da sessão e consultará o vínculo dentro do restaurante autorizado.

| Campo | Tipo | Regra |
|---|---|---|
| `idUsuario` | texto | Igual ao ID do documento e ao usuário autenticado. |
| `idRestaurante` | texto | Igual ao restaurante do caminho. |
| `papeis` | lista de enum | Papéis atribuídos pelo processo server-side. |
| `papelPrincipal` | enum | Papel principal apenas para apresentação; não substitui `papeis`. |
| `escopos` | lista/mapa | Escopos operacionais específicos, quando necessários. |
| `estado` | enum | `convidado`, `ativo`, `suspenso`, `revogado`. |
| `entrouEm` | data/hora/nulo | Data/hora do aceite, escrita pelo servidor. |
| `convidadoPor` | texto/nulo | ID do autor do convite. |
| `suspensoEm` / `revogadoEm` | data/hora/nulo | Preenchidos pelo servidor. |
| `criadoEm` / `atualizadoEm` | data/hora | Datas/hora do servidor. |
| `criadoPor` / `atualizadoPor` | texto | ID do ator validado ou `sistema`. |
| `versao` | inteiro | Versão monotônica. |

O navegador nunca poderá criar ou atualizar `papeis`, `estado`, `idRestaurante`, `convidadoPor`, datas ou escopos privilegiados. Convites, suspensão, revogação e troca de papel serão comandos da API e gerarão auditoria.

### 3.2 Caminho `restaurantes/{idRestaurante}/convites/{idConvite}`

O segredo enviado por email nunca será armazenado em claro.

| Campo | Tipo | Regra |
|---|---|---|
| `idRestaurante` | texto | Igual ao restaurante do caminho. |
| `resumoEmail` | texto | Resumo criptográfico server-side do email canônico. |
| `emailMascarado` | texto | Versão mascarada para suporte e auditoria. |
| `resumoToken` | texto | Resumo do token de convite; token original nunca persiste. |
| `papeisPropostos` | lista de enum | Proposta limitada; aprovação final no servidor. |
| `estado` | enum | `pendente`, `aceito`, `expirado`, `revogado`. |
| `expiraEm` | data/hora | Prazo obrigatório. |
| `criadoEm` / `aceitoEm` / `revogadoEm` | data/hora/nulo | Datas/hora do servidor. |
| `criadoPor` / `aceitoPor` | texto/nulo | ID do ator validado ou `sistema`. |

## 4. Papéis e autorização

Os papéis iniciais serão os seguintes, com valores em português:

| Papel | Escopo inicial | Permissões principais | Restrições essenciais |
|---|---|---|---|
| `proprietario` | Restaurante | Configurações, membros, permissões, operação e ações de propriedade. | Reautenticação/MFA e auditoria para ações críticas. |
| `administrador` | Restaurante | Operação, configuração e equipe conforme política. | Não altera propriedade nem executa exclusões irreversíveis sem fluxo especial. |
| `gerente` | Restaurante | Pedidos, cozinha, salão, cardápio e relatórios operacionais. | Sem financeiro sensível ou gestão de propriedade. |
| `financeiro` | Restaurante | Caixa, fluxo, contas, fechamentos e relatórios financeiros. | Sem gestão de papéis; dupla conferência para ações críticas. |
| `caixa` | Restaurante | Operações de caixa permitidas. | Não altera histórico fechado ou permissões. |
| `cozinha` | Restaurante | Fila da cozinha e transições de produção. | Sem financeiro, equipe privada ou administração. |
| `garcom` | Restaurante | Mesas, reservas e pedidos no escopo operacional. | Sem financeiro ou administração de usuários. |
| `analista` | Restaurante | Leitura de relatórios autorizados. | Sem mutações operacionais e com PII mínima. |
| `auditor` | Restaurante | Leitura controlada de dados e auditoria. | Sem mutações. |

As declarações de acesso globais do Firebase poderão usar Custom Claims pequenas, por exemplo uma indicação interna de suporte. Os papéis detalhados por restaurante permanecerão nos documentos de membros. Custom Claims serão atribuídas somente pelo Admin SDK e não armazenarão perfil, listas de restaurantes ou permissões extensas. A documentação do Firebase limita esse payload a 1000 bytes e recomenda usá-lo apenas para controle de acesso [2].

A API seguirá a ordem: validar sessão; obter o ID do usuário; determinar o restaurante selecionado; verificar o membro ativo; carregar `papeis`; autorizar a ação; validar o payload; executar a operação; registrar auditoria. Qualquer `idRestaurante`, `idUsuario`, papel ou email enviado pelo navegador será tratado como dado não confiável.

## 5. Configurações e módulos operacionais

Todos os documentos abaixo ficarão sob `restaurantes/{idRestaurante}`. Os documentos terão, quando aplicável, os campos comuns `idRestaurante`, `criadoEm`, `atualizadoEm`, `criadoPor`, `atualizadoPor`, `versao`, `estado`, `excluidoEm` e `excluidoPor`. Datas e autoria serão sempre preenchidas pelo servidor.

| Subcoleção | Uso no APEX Food | Controles principais |
|---|---|---|
| `configuracoes/{idConfiguracao}` | Preferências e parâmetros do restaurante. | `proprietario`/`administrador`, reautenticação em mudanças sensíveis. |
| `permissoes/{idPermissao}` | Ajustes controlados de autorização. | RBAC server-side e auditoria. |
| `pedidos/{idPedido}` | Pedidos e ciclo operacional. | Máquina de estados, idempotência e cálculo no servidor. |
| `pedidos/{idPedido}/itens/{idItem}` | Itens do pedido. | Preços copiados pelo servidor e item finalizado imutável. |
| `pedidos/{idPedido}/eventos/{idEvento}` | Eventos e transições do pedido. | Somente acréscimo, ator e ID da requisição. |
| `fichasCozinha/{idFicha}` | Fila e tickets da cozinha. | Papéis operacionais e transições permitidas. |
| `eventosProducao/{idEvento}` | Eventos da produção. | Somente acréscimo e data/hora do servidor. |
| `categoriasCardapio/{idCategoria}` | Categorias do cardápio. | `proprietario`/`administrador`/`gerente`, ordenação validada. |
| `produtos/{idProduto}` | Produtos e preços. | Valores em centavos e publicação versionada. |
| `promocoes/{idPromocao}` | Promoções e vigência. | Datas e regras calculadas no servidor. |
| `configuracaoCardapioDigital/{idConfiguracao}` | Configuração do cardápio digital. | Separação entre visão pública e interna. |
| `mesas/{idMesa}` | Mesas e capacidade. | Estado validado e eventos de alteração. |
| `eventosMesas/{idEvento}` | Histórico do mapa de mesas. | Somente acréscimo. |
| `reservas/{idReserva}` | Reservas. | Transação contra dupla reserva e validação de horário/capacidade. |
| `configuracaoSalao/{idConfiguracao}` | Layout e parâmetros do salão. | `proprietario`/`administrador`/`gerente`. |
| `funcionarios/{idFuncionario}` | Perfil operacional de funcionário. | PII mínima e acesso por necessidade. |
| `dadosPrivadosFuncionarios/{idFuncionario}` | Dados privados da equipe. | Backend restrito; nunca retornar por conveniência. |
| `escalas/{idEscala}` | Escalas e turnos. | Papéis administrativos e histórico. |
| `comissoes/{idComissao}` | Comissões calculadas. | Cálculo no servidor e revisão financeira. |
| `fechamentosCaixa/{idFechamento}` | Fechamentos de caixa. | Transação, aprovação, imutabilidade e auditoria. |
| `movimentacoesCaixa/{idMovimentacao}` | Entradas e saídas. | `financeiro`/`proprietario`, idempotência e valores inteiros. |
| `contasPagar/{idConta}` | Contas a pagar. | Dados financeiros restritos e estados controlados. |
| `contasReceber/{idConta}` | Contas a receber. | Conciliação e auditoria. |
| `relatoriosFinanceiros/{idRelatorio}` | Relatórios financeiros. | Agregações no servidor e acesso por papel. |
| `resumosRelatorios/{idResumo}` | Resumos de relatórios. | Somente leitura para papéis autorizados. |
| `avaliacoes/{idAvaliacao}` | Avaliações e feedback. | Minimização de PII e moderação no servidor. |
| `agregacoesAnaliticas/{idAgregacao}` | Agregações de dashboards. | Sem payload pessoal desnecessário. |
| `resumosFinanceiros/{idResumo}` | Resumos da área financeira. | `financeiro`/`proprietario`. |
| `resumosDesempenho/{idResumo}` | Resumos operacionais. | Filtros e paginação validados. |
| `chavesIdempotencia/{idChave}` | Proteção contra repetição de comandos. | Resumo da chave, endpoint, ator, resultado e expiração. |

A coleção canônica para dados privados de equipe é `dadosPrivadosFuncionarios`; nenhum nome alternativo em inglês deverá ser criado.

### Campos operacionais recomendados para pedidos

| Campo | Tipo | Regra |
|---|---|---|
| `numero` | inteiro | Número exibido, gerado pelo servidor. |
| `origem` | enum | `balcao`, `mesa`, `entrega`, `cardapioDigital`, `integracao`. |
| `tipoAtendimento` | enum | `local`, `retirada`, `entrega`. |
| `idMesa` | texto/nulo | Referência validada a uma mesa do mesmo restaurante. |
| `itens` | lista/resumo | Visão resumida; itens canônicos ficam na subcoleção `itens`. |
| `subtotalCentavos` | inteiro | Calculado pelo servidor. |
| `descontoCentavos` | inteiro | Calculado e autorizado pelo servidor. |
| `taxaCentavos` | inteiro | Calculado pelo servidor. |
| `totalCentavos` | inteiro | Nunca aceito como autoridade do cliente. |
| `moeda` | texto | Inicialmente `BRL`. |
| `estado` | enum | Estados definidos pela máquina de pedidos. |
| `observacoes` | texto | Limite de tamanho e higienização. |
| `finalizadoEm` / `canceladoEm` | data/hora/nulo | Preenchidos em transições válidas. |

### Campos de item de pedido

Os documentos em `pedidos/{idPedido}/itens/{idItem}` usarão `idProduto`, `nomeProduto`, `quantidade`, `precoUnitarioCentavos`, `totalCentavos` e `observacoes`. O preço histórico deverá ser copiado pelo servidor no momento da inclusão; o produto atual não pode alterar um pedido já finalizado.

### Campos de reserva e mesa

Os documentos em `reservas/{idReserva}` usarão `idMesa`, `nomeCliente`, `contatoClienteMascarado`, `inicioEm`, `fimEm`, `quantidadePessoas`, `estado`, `observacoes`, `criadoEm`, `atualizadoEm` e autoria server-side. O contato completo, quando necessário, deverá ficar em documento privado separado. A criação ou alteração deverá verificar capacidade e conflito em transação.

## 6. Auditoria somente para acréscimo

A coleção global `registrosAuditoria/{idRegistro}` terá `idRestaurante` explícito para filtragem e retenção. Ela será a fonte de verdade; uma futura visão dentro do restaurante será derivada, não uma segunda fonte independente.

| Campo | Tipo | Regra |
|---|---|---|
| `idRestaurante` | texto/nulo | Restaurante afetado; nulo somente para evento global autorizado. |
| `idAtor` | texto | ID do usuário validado ou `sistema`. |
| `papeisDoAtor` | lista | Papéis observados no momento do comando. |
| `acao` | enum | Ex.: `membro.papelAlterado`, `pedido.cancelado`. |
| `tipoRecurso` / `idRecurso` | texto | Recurso afetado, sem payload completo. |
| `idOperacao` / `idRequisicao` | texto | Correlação e idempotência. |
| `resultado` | enum | `sucesso`, `negado`, `falhou`, `revertido`. |
| `codigoMotivo` | texto/nulo | Motivo controlado, sem segredo ou texto livre sensível. |
| `alteracoesRedigidas` | mapa | Diferenças mínimas e limitadas. |
| `criadoEm` | data/hora | Data/hora do servidor. |
| `versaoEstruturaAuditoria` | texto | Versão do contrato de auditoria. |
| `classeRetencao` | enum | Classificação para retenção futura. |

Eventos obrigatórios incluem login/logout relevante, criação e suspensão de membro, troca de papel, configuração sensível, transição de pedido, reserva/cancelamento, fechamento/estorno financeiro, exportação, exclusão lógica e negação de autorização. Nunca serão registrados senha, token, cookie, chave privada, cabeçalho de autorização ou payload financeiro completo.

A aplicação não poderá atualizar ou apagar registros de auditoria. A retenção física dependerá de política aprovada e processo administrativo separado.

## 7. Invariantes de integridade

| Invariante | Aplicação |
|---|---|
| Escopo | O restaurante efetivo vem do membro ativo da sessão. |
| Datas | `criadoEm`, `atualizadoEm` e eventos usam data/hora do servidor. |
| Autoria | `criadoPor` e `atualizadoPor` vêm do ator validado ou `sistema`. |
| Versão | Atualizações incrementam `versao` e evitam sobrescrita obsoleta quando necessário. |
| Estados | `estado` usa enum e máquina de estados. |
| Dinheiro | Valores usam inteiros em centavos e campo `moeda`. |
| Finalização | Pedidos e fechamentos aprovados não são editados; correções geram reversão. |
| Idempotência | Comandos repetíveis usam `chaveIdempotencia` com expiração. |
| Exclusão | Preferir `excluidoEm`, `excluidoPor` e tombstone quando houver histórico. |
| PII | Dados pessoais e privados ficam separados e são reduzidos nas respostas. |
| Auditoria | Mudanças sensíveis geram registro somente para acréscimo. |
| Concorrência | Reservas, estoque, caixa e contadores críticos usam transação ou operação atômica. |

As transações devem ler antes de escrever e podem ser reexecutadas em conflitos. A função de transação não deve disparar efeitos externos, enviar email ou modificar estado fora da transação. Operações sem leitura condicional poderão usar gravações em lote ou comandos idempotentes [3].

## 8. Índices e consultas

Nenhum índice composto será criado nesta etapa. Índices futuros deverão ser definidos apenas depois dos endpoints reais, sempre incluindo `idRestaurante` quando aplicável, paginação por cursor, limite máximo e ordenação controlada.

Os dashboards usarão resumos e agregações server-side. O navegador não receberá coleções financeiras completas para montar gráficos. Filtros arbitrários não poderão permitir inferência de dados de outro restaurante.

## 9. Migração e sequência segura

A Etapa 6 não cria dados operacionais. A sequência aprovada é:

1. Manter `firestore.rules` em deny-by-default.
2. Implementar na Etapa 7 a API, sessão, resolução do restaurante, RBAC, validação e auditoria.
3. Criar dados descartáveis de Development somente por endpoint protegido ou carga controlada.
4. Testar usuário sem sessão, papel insuficiente, restaurante incorreto, ID manipulado, repetição e data adulterada.
5. Integrar cada módulo por sinalizador de ambiente, preservando os mocks atuais até homologação.
6. Migrar gravação antes de leitura, com contagem, idempotência, logs e rollback.
7. Remover mocks e dados locais somente após homologação e revisão de segurança.

Nenhum arquivo existente do shell, roteamento, fragmentos HTML ou UI/UX será alterado nesta etapa.

## 10. Critérios de aceite

A Etapa 6 será considerada concluída quando a estrutura estiver documentada em português, a matriz de papéis estiver explícita, os invariantes e eventos de auditoria estiverem definidos, o manifesto estiver versionado e nenhuma permissão do Firestore tiver sido aberta prematuramente.

A criação de documentos reais, implementação da API, membros, Claims, seeds de Development e testes automatizados ocorrerá somente nas etapas seguintes e após nova aprovação.

## Referências

[1]: https://firebase.google.com/docs/firestore/data-model "Modelo de dados do Cloud Firestore — Firebase"
[2]: https://firebase.google.com/docs/auth/admin/custom-claims "Custom Claims e regras de segurança — Firebase"
[3]: https://firebase.google.com/docs/firestore/manage-data/transactions "Transações e gravações em lote — Firebase"
[4]: https://firebase.google.com/docs/firestore/security/get-started "Regras de segurança do Cloud Firestore — Firebase"
