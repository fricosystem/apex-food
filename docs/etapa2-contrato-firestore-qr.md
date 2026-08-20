# Etapa 2 — Contrato Firestore do fluxo QR Code e comandas

**Projeto:** APEX Food  
**Ambiente:** Development  
**Status:** Modelagem preparada; aguardando aprovação antes da implementação  
**Persistência:** Cloud Firestore como fonte definitiva  
**Acesso:** API server-side; nenhum acesso operacional direto pelo navegador  
**Escopo financeiro:** encaminhamento ao caixa e confirmação operacional externa; sem processamento de pagamentos  
**Autor:** Manus AI

## 1. Princípios de modelagem

A modelagem seguirá o padrão multi-tenant já adotado: os dados operacionais ficarão em subcoleções de `restaurantes/{idRestaurante}`, e o restaurante será derivado do contexto autenticado do operador ou da sessão temporária validada do cliente. O corpo enviado pelo navegador nunca será autoridade para escolher `idRestaurante`, papel, autoria, preço, total, status final ou mesa de outro restaurante.

O Cloud Firestore será a fonte persistente e definitiva. O frontend poderá manter apenas estado transitório para renderização, como itens ainda não enviados no carrinho, identificadores de interface e controle de recarga. Toda operação que altere o atendimento deverá passar por um handler server-side, ser validada, persistida e retornar confirmação somente depois da conclusão da gravação ou transação.

As coleções e campos terão nomes em português. Datas, autoria, versões, estados e chaves de correlação serão gerados ou validados pelo servidor. Documentos de auditoria e eventos não serão apagados nem atualizados depois da criação.

## 2. Estrutura de documentos

```text
usuarios/{idUsuario}
restaurantes/{idRestaurante}
restaurantes/{idRestaurante}/membros/{idUsuario}
restaurantes/{idRestaurante}/mesas/{idMesa}
restaurantes/{idRestaurante}/eventosMesas/{idEventoMesa}
restaurantes/{idRestaurante}/sessoesMesa/{idSessaoMesa}
restaurantes/{idRestaurante}/comandas/{idComanda}
restaurantes/{idRestaurante}/comandas/{idComanda}/participantes/{idParticipante}
restaurantes/{idRestaurante}/pedidos/{idPedido}
restaurantes/{idRestaurante}/pedidos/{idPedido}/itens/{idItem}
restaurantes/{idRestaurante}/pedidos/{idPedido}/eventos/{idEvento}
restaurantes/{idRestaurante}/fichasCozinha/{idFichaCozinha}
restaurantes/{idRestaurante}/encaminhamentosCaixa/{idEncaminhamento}
restaurantes/{idRestaurante}/chavesIdempotencia/{idChave}
registrosAuditoria/{idRegistroAuditoria}
```

A estrutura preserva as coleções atuais de `mesas`, `comandas` e `pedidos`. As subcoleções de itens e eventos serão introduzidas de forma compatível: o resumo existente poderá continuar no documento principal para leitura rápida, enquanto a subcoleção será a fonte detalhada dos novos pedidos quando a implementação for ativada. Nenhuma coleção de pagamento será criada para este fluxo.

## 3. Coleções e campos

### 3.1 `mesas`

Caminho: `restaurantes/{idRestaurante}/mesas/{idMesa}`.

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | texto | Nome/identificação configurada da mesa |
| `numero` | texto ou inteiro | Número exibido, quando houver |
| `capacidade` | inteiro positivo | Validado pelo servidor |
| `area` | texto | Área do salão, opcional |
| `estado` | enum | `disponivel`, `ocupada`, `indisponivel`, `bloqueada` |
| `estadoAtendimento` | enum nulo | `aguardando_confirmacao`, `em_preparo`, `pedido_pronto`, `encaminhada_caixa` |
| `idComandaAberta` | texto nulo | Comanda ativa da mesa |
| `idGarcomResponsavel` | texto nulo | Funcionário responsável pelo atendimento |
| `qrAtivo` | booleano | Indica se o QR vigente pode abrir sessão |
| `qrVersao` | texto | Versão aleatória do código vigente |
| `qrHash` | texto | Hash server-side; token claro nunca é armazenado |
| `qrGeradoEm` | timestamp | Data/hora do servidor |
| `qrRevogadoEm` | timestamp nulo | Preenchido ao revogar o código |
| `criadoEm` / `atualizadoEm` | timestamp | Sempre pelo servidor |
| `criadoPor` / `atualizadoPor` | texto | Usuário ou `sistema`, sempre server-side |
| `versao` | inteiro | Controle otimista de concorrência |

A implementação deverá preservar o campo `estado` usado pelo Salão atual e usar `estadoAtendimento` ou um resumo equivalente para não quebrar o mapa de mesas. A decisão final do campo de resumo será aplicada junto com o handler na etapa de implementação correspondente.

### 3.2 `eventosMesas`

Caminho: `restaurantes/{idRestaurante}/eventosMesas/{idEventoMesa}`.

| Campo | Tipo | Regra |
|---|---|---|
| `idMesa` | texto | Mesa do mesmo restaurante |
| `idComanda` | texto nulo | Comanda relacionada |
| `estadoAnterior` / `estadoNovo` | enum | Estados validados |
| `acao` | enum | Ex.: `qr_gerado`, `sessao_aberta`, `ocupada`, `encaminhada_caixa`, `disponivel` |
| `idAtor` | texto | Usuário validado ou `sessao-mesa`/`sistema` |
| `idRequisicao` | texto | Correlação da requisição |
| `criadoEm` | timestamp | Data/hora do servidor |

A coleção será somente para acréscimo. O documento atual de `mesas` será o resumo consultado pela interface; o histórico não será reconstruído pelo cliente.

### 3.3 `sessoesMesa`

Caminho: `restaurantes/{idRestaurante}/sessoesMesa/{idSessaoMesa}`.

| Campo | Tipo | Regra |
|---|---|---|
| `idMesa` | texto | Mesa validada pelo token QR |
| `idComanda` | texto | Comanda aberta/retomada em transação |
| `idParticipante` | texto | Participante criado para a sessão |
| `nomeCompleto` | texto | Obrigatório; tamanho e conteúdo validados |
| `nomeExibicao` | texto | Nome usado nas filas internas |
| `hashSessao` | texto | Hash do token de sessão; token claro não vai ao Firestore |
| `estadoSessao` | enum | `ativa`, `encerrada`, `expirada`, `revogada` |
| `criadaEm` / `ultimoAcessoEm` / `expiraEm` | timestamp | Datas geradas pelo servidor |
| `encerradaEm` | timestamp nulo | Preenchido no encerramento da comanda |
| `versao` | inteiro | Controle de atualização |

O cookie HttpOnly da sessão de mesa conterá apenas o token assinado/aleatório necessário para a API. O nome, a mesa e a comanda serão resolvidos no servidor. Não haverá ID de dispositivo, fingerprint, token em `localStorage` ou `sessionStorage`.

### 3.4 `comandas`

Caminho: `restaurantes/{idRestaurante}/comandas/{idComanda}`.

| Campo | Tipo | Regra |
|---|---|---|
| `idMesa` | texto | Mesa do mesmo restaurante |
| `statusComanda` | enum | `aberta`, `em_consumo`, `encaminhada_caixa`, `encerrada`, `cancelada` |
| `idGarcomResponsavel` | texto nulo | Atribuição em transação |
| `participantesAtivos` | inteiro | Resumo calculado pelo servidor |
| `quantidadePedidosAbertos` | inteiro | Resumo controlado pelo servidor |
| `subtotalCentavos` | inteiro não negativo | Soma dos itens persistidos |
| `descontoCentavos` | inteiro não negativo | Somente se regra autorizada existir |
| `totalCentavos` | inteiro não negativo | Calculado pelo servidor; não é pagamento |
| `resumoOperacional` | mapa | Informações necessárias ao caixa, sem dados financeiros de captura |
| `abertaEm` / `atualizadaEm` | timestamp | Servidor |
| `encaminhadaCaixaEm` | timestamp nulo | Momento do encaminhamento |
| `encerradaEm` | timestamp nulo | Depois da confirmação operacional do caixa |
| `encerradaPor` | texto nulo | Operador de caixa autenticado |
| `versao` | inteiro | Incrementado em mutações críticas |

`totalCentavos` é um resumo do consumo para conferência operacional. Não representa cobrança processada, recebimento, liquidação ou pagamento dentro do sistema.

### 3.5 `comandas/{idComanda}/participantes`

Cada cliente terá um participante próprio dentro da comanda compartilhada.

| Campo | Tipo | Regra |
|---|---|---|
| `nomeCompleto` | texto | Informado pelo cliente e validado pelo servidor |
| `nomeExibicao` | texto | Nome exibido ao garçom e na comanda |
| `idSessaoMesa` | texto | Sessão ativa relacionada |
| `estadoParticipante` | enum | `ativo`, `encerrado`, `revogado` |
| `entrouEm` / `saiuEm` | timestamp | Servidor |
| `criadoEm` / `atualizadoEm` | timestamp | Servidor |

O participante não é uma conta de usuário. O documento serve para identificar operacionalmente quem solicitou um item durante aquela comanda.

### 3.6 `pedidos`

Caminho: `restaurantes/{idRestaurante}/pedidos/{idPedido}`.

| Campo | Tipo | Regra |
|---|---|---|
| `numero` | inteiro | Gerado pelo servidor |
| `origem` | enum | `cardapioDigital`, `mesa` ou origem já suportada |
| `tipoAtendimento` | enum | `local`/`mesa` conforme contrato compatível |
| `idMesa` / `idComanda` | texto | Referências do mesmo restaurante |
| `idParticipante` | texto nulo | Participante que enviou |
| `nomeCliente` | texto | Snapshot operacional validado |
| `idGarcomResponsavel` | texto nulo | Herdado da comanda/mesa pelo servidor |
| `statusPedido` | enum | `rascunho`, `aguardando_confirmacao_garcom`, `confirmado_garcom`, `enviado_cozinha`, `em_preparo`, `pronto`, `servido`, `rejeitado_garcom`, `cancelado` |
| `itensResumo` | lista | Resumo para listagem rápida |
| `subtotalCentavos` / `descontoCentavos` / `totalCentavos` | inteiro | Calculados pelo servidor |
| `observacoes` | texto | Limite e higienização |
| `criadoEm` / `atualizadoEm` | timestamp | Servidor |
| `confirmadoEm` / `enviadoCozinhaEm` / `prontoEm` / `servidoEm` | timestamp nulo | Preenchidos por transições válidas |
| `idGarcomConfirmador` / `idCozinhaExecutor` | texto nulo | Atores autenticados |
| `versao` | inteiro | Controle de concorrência |

A transição `servido` não fechará a comanda nem liberará a mesa. O encerramento ocorrerá somente em operação própria do garçom e o fechamento operacional ocorrerá no caixa.

### 3.7 `pedidos/{idPedido}/itens`

Os itens detalhados serão persistidos com snapshot para impedir que alterações futuras do cardápio modifiquem o histórico:

`idProduto`, `nomeProduto`, `quantidade`, `precoUnitarioCentavos`, `totalCentavos`, `observacoes`, `idParticipante`, `estadoItem`, `criadoEm` e `atualizadoEm`.

O campo `precoUnitarioCentavos` será lido do produto vigente pelo servidor. O cliente enviará somente `idProduto`, quantidade e observação permitida. O frontend não poderá enviar preço, subtotal ou total como autoridade.

### 3.8 `pedidos/{idPedido}/eventos`

Cada transição do pedido será registrada somente para acréscimo com `statusAnterior`, `statusNovo`, `idAtor`, `papelAtor`, `motivo`, `idRequisicao`, `criadoEm` e `versaoEvento`. O cliente anônimo será identificado apenas pela sessão técnica e não terá dados de dispositivo armazenados.

### 3.9 `fichasCozinha`

A ficha será uma projeção operacional do pedido confirmado, com `idPedido`, `idMesa`, `idComanda`, `idGarcomResponsavel`, itens, `statusFicha` (`aguardando_preparo`, `em_preparo`, `pronta`, `encerrada`), `prioridade`, `criadaEm`, `iniciadaEm`, `prontaEm`, `encerradaEm`, `versao` e autoria server-side.

A ficha não será criada pelo cliente. Ela será criada ou atualizada na mesma transação que muda o pedido para `enviado_cozinha`, evitando pedido na cozinha sem pedido confirmado.

### 3.10 `encaminhamentosCaixa`

Esta coleção representa a operação final do APEX Food, sem pagamento:

`idComanda`, `idMesa`, `idGarcomResponsavel`, `statusEncaminhamento` (`encaminhada`, `recebida`, `concluida`, `cancelada`), `resumoOperacional`, `encaminhadaEm`, `recebidaEm`, `concluidaEm`, `idOperadorCaixa`, `observacaoOperacional`, `chaveIdempotencia` e `versao`.

O caixa poderá confirmar que recebeu o atendimento e que o acerto externo foi tratado. O sistema não armazenará forma de pagamento, valor recebido, troco, dados bancários, cartão, senha, CVV ou resposta de adquirência.

### 3.11 `chavesIdempotencia`

Cada comando mutável receberá uma chave exclusiva por restaurante, ator, endpoint e operação. O documento conterá `idChave`, `idRestaurante`, `idAtor`, `endpoint`, `tipoOperacao`, `resultado`, `statusHttp`, `respostaResumo`, `criadaEm`, `expiraEm` e `hashPayload`.

A chave será lida em transação antes de executar a operação. Uma repetição com o mesmo hash poderá retornar o resultado anterior; uma repetição com payload diferente será rejeitada. Nenhuma resposta completa com dados sensíveis será armazenada na chave.

### 3.12 `registrosAuditoria`

A auditoria continuará na coleção global já existente, com `idRestaurante` explícito e apenas acréscimo. Os eventos QR, sessão, participante, pedido, cozinha, mesa, comanda e caixa deverão registrar ação, recurso, ator, papéis, requisição, resultado, motivo controlado, versão e timestamp do servidor.

Não serão registrados token QR em claro, cookie, senha, cabeçalho de autorização, ID de dispositivo, fingerprint, dados de cartão ou payload financeiro detalhado.

## 4. Máquinas de estado

### Mesa

| Estado | Próximos estados permitidos |
|---|---|
| `disponivel` | `ocupada`, `indisponivel`, `bloqueada` |
| `ocupada` | `aguardando_confirmacao`, `em_preparo`, `pedido_pronto`, `encaminhada_caixa` |
| `aguardando_confirmacao` | `ocupada`, `em_preparo`, `pedido_pronto`, `encaminhada_caixa` |
| `em_preparo` | `pedido_pronto`, `ocupada`, `encaminhada_caixa` |
| `pedido_pronto` | `ocupada`, `encaminhada_caixa` |
| `encaminhada_caixa` | `disponivel` |
| `indisponivel`/`bloqueada` | somente alteração administrativa autorizada |

A mesa nunca irá para `disponivel` a partir de pedido `servido`, cozinha ou garçom. A transição final exigirá confirmação idempotente do caixa e verificação transacional de ausência de outra comanda/pedido aberto.

### Comanda

`aberta` → `em_consumo` → `encaminhada_caixa` → `encerrada`.

A comanda somente será `cancelada` por fluxo autorizado e com motivo. Uma confirmação duplicada do caixa retornará o resultado anterior sem criar uma segunda conclusão.

### Pedido

`rascunho` → `aguardando_confirmacao_garcom` → `confirmado_garcom` → `enviado_cozinha` → `em_preparo` → `pronto` → `servido`.

`rejeitado_garcom` e `cancelado` serão estados de exceção. A cozinha não poderá iniciar preparo sem `confirmado_garcom` e o garçom não poderá marcar `servido` antes de `pronto`.

## 5. Transações obrigatórias

| Operação | Documentos envolvidos | Garantia |
|---|---|---|
| Validar QR e abrir sessão | `mesas`, `comandas`, `sessoesMesa`, participante | QR pertence à mesa; comanda única; sessão criada uma vez |
| Adicionar participante | `comandas`, `participantes`, `sessoesMesa` | Nome vinculado à mesa correta e sessão expirada não reutilizada |
| Enviar pedido | `produtos`, `mesas`, `comandas`, `pedidos`, itens, eventos, idempotência | Preços server-side, estoque/disponibilidade validada e pedido único |
| Confirmar garçom | `pedidos`, `comandas`, `mesas`, eventos, auditoria | Um único garçom confirma; mesa e comanda sincronizadas |
| Enviar cozinha | `pedidos`, `fichasCozinha`, eventos, auditoria | Ficha somente para pedido confirmado |
| Concluir cozinha | `fichasCozinha`, `pedidos`, `mesas`, eventos | Pedido pronto aparece ao garçom correto |
| Marcar servido | `pedidos`, `comandas`, `mesas`, eventos | Pedido servido não libera mesa |
| Encerrar consumo | `pedidos`, `comandas`, `encaminhamentosCaixa`, `mesas`, auditoria | Sem pedido pendente; comanda encaminhada ao caixa |
| Concluir caixa | `encaminhamentosCaixa`, `comandas`, `mesas`, sessões, auditoria | Operação final idempotente e mesa liberada somente então |

## 6. Índices candidatos

O arquivo atual `firestore.indexes.json` possui apenas o override do grupo `membros`. Os índices abaixo são candidatos e deverão ser habilitados somente depois que os handlers e consultas forem implementados e testados, para evitar índices desnecessários:

| Coleção | Campos e ordem | Consulta atendida |
|---|---|---|
| `pedidos` | `statusPedido ASC`, `atualizadoEm DESC` | Fila geral por estado |
| `pedidos` | `idMesa ASC`, `statusPedido ASC`, `atualizadoEm DESC` | Pedidos da mesa |
| `pedidos` | `idGarcomResponsavel ASC`, `statusPedido ASC`, `atualizadoEm DESC` | Pedidos prontos do garçom |
| `comandas` | `statusComanda ASC`, `atualizadaEm DESC` | Fila do caixa e comandas abertas |
| `comandas` | `idMesa ASC`, `statusComanda ASC` | Comanda ativa por mesa |
| `fichasCozinha` | `statusFicha ASC`, `criadaEm ASC` | Fila de produção |
| `encaminhamentosCaixa` | `statusEncaminhamento ASC`, `encaminhadaEm DESC` | Fila final do caixa |
| `sessoesMesa` | `idMesa ASC`, `estadoSessao ASC`, `expiraEm DESC` | Sessões ativas/expiradas por mesa |
| `registrosAuditoria` | `idRestaurante ASC`, `criadoEm DESC` | Auditoria por restaurante |

O override existente de `membros.idUsuario` em `COLLECTION_GROUP` será preservado. A lista definitiva de índices será derivada das consultas reais, e cada alteração no arquivo deverá passar pela suíte de contratos.

## 7. Isolamento e regras de acesso

O navegador não terá acesso direto às coleções operacionais. As Security Rules permanecerão deny-by-default. A API usará Admin SDK apenas depois de validar sessão de operador ou sessão temporária de mesa, contexto do restaurante, escopo da mesa, papel, estado anterior e payload.

A sessão de mesa poderá ler somente cardápio publicado, a própria comanda e os próprios pedidos/participante. Ela não poderá listar mesas, funcionários, outras comandas, auditoria ou filas internas. Garçom, cozinha e caixa continuarão usando sessão autenticada e papéis do membro do restaurante.

Todas as consultas deverão limitar resultados, ordenar por campos indexados e retornar DTOs mínimos. O servidor nunca retornará `idRestaurante`, hashes, tokens, autoria interna, cookies, payload de auditoria ou dados privados de outros participantes além do necessário à operação autorizada.

## 8. Critérios de aceite da Etapa 2

A Etapa 2 será considerada concluída quando o contrato dos documentos, estados, transações, chaves de idempotência, auditoria, isolamento e índices estiver aprovado. Nenhuma rota pública ou handler será alterado antes dessa aprovação.

Os contratos deverão ser compatíveis com o modelo multi-tenant atual, com os handlers existentes e com o escopo sem pagamentos. A próxima etapa poderá então implementar geração e validação do QR Code, sessão temporária e persistência server-side sem mudar os nomes ou estados definidos neste documento.

## 9. Pausa de aprovação

Este documento encerra a modelagem da Etapa 2. O sistema permanece sem novas coleções ou alterações de código até a confirmação explícita do usuário. Após a aprovação, a Etapa 3 poderá iniciar a implementação do QR Code e da sessão pública.

## Referências

[1]: ../Plano-Sistema-Real.md "Plano do Sistema Real do APEX Food"
[2]: ../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[3]: ../docs/firebase/etapa-6-schema-multitenant.md "Schema multi-tenant do Firebase"
[4]: ../api/_lib/pedidos-handler.js "Handler server-side de Pedidos"
[5]: ../api/_lib/salao-handler.js "Handler server-side do Salão"
[6]: ../api/_lib/auditoria.js "Helper de auditoria server-side"
[7]: ../firestore.indexes.json "Índices atuais do Firestore"
