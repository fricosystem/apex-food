# Plano de Integração — QR Code das Mesas, Comandas e Operação Completa

**Projeto:** APEX Food  
**Ambiente de execução:** Development na Vercel  
**Arquitetura preservada:** HTML estático, shell único no `index.html`, páginas fragmentadas no body, API server-side na Vercel e Cloud Firestore com regras deny-by-default  
**Idioma:** Português em telas, endpoints, coleções, campos, estados e mensagens  
**Status:** Plano aguardando aprovação da Etapa 1  
**Autor:** Manus AI

## 1. Objetivo do fluxo

O objetivo é permitir que o cliente se sente em uma mesa, escaneie o QR Code correspondente, informe obrigatoriamente seu **nome completo para atendimento**, abra o cardápio público do restaurante, monte uma comanda e envie pedidos sem precisar criar uma conta. O sistema não usará ID do dispositivo nem impressão digital do navegador como identificação. O pedido deverá entrar em um estado controlado de **aguardando confirmação do garçom**. O garçom confirma se a solicitação é válida, identifica a pessoa pelo nome exibido, assume ou confirma a responsabilidade pela mesa e encaminha o pedido à cozinha.

A cozinha recebe somente pedidos confirmados, altera o andamento para preparo e depois marca o pedido como pronto. O garçom responsável recebe a indicação de que o pedido está pronto, serve a mesa e marca os itens como servidos. Quando o consumo da mesa terminar, o garçom encerra a comanda e a encaminha para o caixa. O caixa registra o pagamento, confirma o fechamento e somente então o servidor muda a mesa para **disponível**.

Nenhuma mudança de estado será confiada ao navegador. O cliente, o garçom, a cozinha e o caixa verão controles diferentes, mas a autorização, a validação, os totais, a atribuição da mesa, as transições e a auditoria serão executadas na API server-side por transações do Firestore. O **Cloud Firestore será a fonte persistente e definitiva de todos os dados operacionais**; memória do navegador, `localStorage`, `sessionStorage` e variáveis JavaScript poderão servir somente para estado temporário de interface, nunca para substituir a persistência.

## 2. Opções de atualização operacional

Como o fluxo precisa refletir rapidamente alterações entre cliente, garçom, cozinha e caixa, existem duas abordagens viáveis. A decisão final deve ser confirmada na Etapa 1, antes da implementação. A primeira preserva mais diretamente a infraestrutura existente; a segunda proporciona atualização mais imediata, porém adiciona complexidade operacional.

| Abordagem | Trade-offs | Custo | Complexidade de configuração |
|---|---|---|---|
| **API same-origin com polling curto controlado** | Preserva Vercel serverless, Firestore e frontend estático. O navegador consulta somente mudanças desde o último evento. É simples de depurar, mas a atualização depende de uma janela de alguns segundos e exige limites de consulta. | Sem novo serviço obrigatório; usa Vercel e Firebase já existentes. | Baixa a média. Requer endpoints de mudanças, `cursor`/data de atualização, backoff, idempotência e controle de rate limit. |
| **Canal de atualização em tempo real** | Entrega mudanças com menor latência por SSE/WebSocket ou serviço gerenciado. Melhora a experiência da cozinha e do garçom, mas exige conexão persistente, reconexão, autorização por restaurante e observabilidade adicional. | Pode exigir hospedagem persistente ou serviço de realtime pago, conforme a solução escolhida. | Média a alta. Requer avaliar conexão 24/7, escalabilidade, reconexão, limites e operação do canal. |

O plano foi organizado para que o domínio, o modelo de dados e as transações funcionem com as duas opções. A forma de atualização será decidida na Etapa 1; não será usado agendamento do Manus para movimentar pedidos, pois estas são transições determinísticas disparadas por ações do cliente e da equipe.

## 3. Regras de negócio obrigatórias

A mesa somente poderá voltar para **disponível** depois que não houver pedidos abertos, a comanda estiver fechada, o pagamento estiver confirmado pelo caixa e a transação final tiver sido registrada no histórico. O frontend não poderá enviar `idRestaurante`, `idGarcomResponsavel`, preço final, total final, comissão ou status final como fonte de autoridade; o servidor deverá derivar ou validar todos esses valores.

O cliente deverá informar seu nome completo no primeiro acesso e poderá criar ou editar um rascunho enquanto a comanda estiver aberta. Depois de enviar um pedido, não poderá confirmar preparo, cancelar unilateralmente um pedido já assumido, alterar preços ou liberar a mesa. Alterações posteriores deverão seguir os estados e permissões definidos para o garçom, a cozinha, o caixa e o gerente.

O garçom só poderá confirmar uma solicitação pertencente ao restaurante ativo e a uma mesa válida. A cozinha só poderá receber pedidos confirmados. O caixa só poderá fechar uma comanda que esteja em **aguardando pagamento**, e o servidor deverá impedir dois caixas, dois garçons ou duas requisições idênticas de concluírem a mesma operação simultaneamente.

## 3.1. Decisão incorporada: identificação do cliente

O cliente **não criará uma conta**, não informará senha e não terá sua identidade vinculada ao ID do dispositivo. Após a validação do QR Code, o sistema exibirá o campo obrigatório **Nome completo para atendimento**, com a orientação: “Informe seu nome para que o garçom identifique seu pedido”.

O nome será usado como identificação operacional da comanda atual, não como prova de identidade. Ele ficará visível somente para a equipe autorizada do restaurante e será associado a uma sessão anônima temporária, a um participante e aos pedidos enviados por essa pessoa. A sessão expirará ao encerrar ou pagar a comanda, e o nome não será transformado automaticamente em cadastro permanente.

Uma mesa poderá ter vários participantes, cada um com seu próprio nome completo e sessão temporária, compartilhando a comanda da mesa. O garçom poderá visualizar itens no formato “João da Silva — 2 águas” e confirmar se a pessoa está realmente na mesa antes de enviar o pedido à cozinha.

## 3.2. Persistência obrigatória no Cloud Firestore

Todos os dados do fluxo deverão ser armazenados no Cloud Firestore por meio dos handlers server-side existentes ou de novos handlers submetidos ao mesmo middleware. Isso inclui QR Codes e suas versões, mesas, sessões temporárias, nomes dos participantes, comandas, itens, snapshots de preço, pedidos, estados da cozinha, atribuição do garçom, itens servidos, encerramento, pagamentos, movimentações financeiras, auditoria, idempotência e eventos de atualização.

O frontend não poderá gravar diretamente no Firestore, aceitar o navegador como fonte de autoridade ou manter a operação somente em memória. Cada leitura deverá ser limitada ao `idRestaurante` derivado da sessão e cada gravação deverá validar papel, estado anterior, estado permitido, campos recebidos, versão do documento e chave de idempotência. Operações críticas deverão usar transações ou lotes atômicos do Firestore.

A ausência de conexão ou falha da API deverá produzir um estado de erro controlado, sem confirmar visualmente uma operação que não foi persistida. Após recarregar a página, trocar de dispositivo autorizado ou abrir a tela de outro operador, o sistema deverá reconstruir o estado a partir do Firestore, sem depender do estado anterior do navegador.

## 4. Papéis e responsabilidades

| Papel | Permissões principais | Restrições |
|---|---|---|
| Cliente da mesa | Informar nome completo para atendimento, ler cardápio publicado, montar comanda, enviar solicitação e consultar os próprios itens | Não cria conta, não fornece ID de dispositivo, não acessa dados internos, não escolhe restaurante por parâmetro, não altera preços ou estados operacionais |
| Garçom | Visualizar solicitações pendentes, confirmar ou rejeitar, assumir mesa, acompanhar pedidos prontos, servir e encerrar consumo | Não fecha pagamento nem altera dados fora do restaurante ativo |
| Cozinha | Visualizar pedidos confirmados, iniciar preparo e marcar pedido pronto | Não confirma pedido do cliente, não encerra comanda e não libera mesa |
| Caixa | Visualizar comandas em pagamento, registrar método e valor recebido, concluir fechamento | Não altera itens depois do fechamento sem fluxo de estorno/correção autorizado |
| Gerente | Reatribuir garçom, corrigir exceções autorizadas, cancelar com justificativa e acompanhar auditoria | Toda exceção deve exigir motivo e permanecer no histórico |
| Administrador do restaurante | Configurar mesas, QR Codes, cardápio, permissões e parâmetros operacionais | Não recebe dados de outro restaurante |

## 5. Modelo de dados proposto em português

O modelo deverá reutilizar as coleções já existentes sempre que o contrato atual for compatível. Novos campos deverão ser adicionados somente após revisar os handlers e os índices existentes. Todos os documentos operacionais deverão permanecer sob o restaurante ativo, por exemplo em `restaurantes/{idRestaurante}/...`, de acordo com o padrão multi-tenant já adotado.

### 5.1 `mesas`

| Campo | Tipo | Finalidade |
|---|---|---|
| `numeroMesa` | número ou texto normalizado | Identificação exibida ao cliente e à equipe |
| `capacidade` | número | Capacidade configurada |
| `statusMesa` | enum | `disponivel`, `aguardando_pedido`, `ocupada`, `pedido_em_preparo`, `pedido_pronto`, `aguardando_pagamento`, `bloqueada` |
| `idComandaAberta` | texto nulo | Comanda ativa da mesa |
| `idGarcomResponsavel` | texto nulo | Garçom responsável pelo atendimento atual |
| `codigoQrVersao` | texto | Versão atual do QR Code |
| `codigoQrHash` | texto | Hash server-side do código vigente |
| `atualizadaEm` | timestamp | Ordenação e sincronização operacional |

O QR Code público não deverá conter o `idRestaurante` nem o `idMesa` em formato previsível. O sistema deverá gerar um token opaco de alta entropia, armazenar somente seu hash e permitir revogação e regeneração por mesa.

### 5.2 `sessoesMesa`

Esta coleção representará a sessão anônima de atendimento criada após o QR Code ser validado e o nome completo ser informado. O documento deverá conter somente o mínimo necessário, como `idRestaurante`, `idMesa`, `idComanda`, `idParticipante`, `nomeExibicaoCliente`, hash da sessão, data de expiração, último acesso e estado. Não será armazenado ID do dispositivo ou impressão digital do navegador. A sessão do cliente ficará em cookie seguro e não em `localStorage` ou `sessionStorage`.

### 5.3 `comandas`

| Campo | Tipo | Finalidade |
|---|---|---|
| `idMesa` | texto | Mesa vinculada |
| `statusComanda` | enum | `aberta`, `aguardando_confirmacao`, `em_consumo`, `encaminhada_caixa`, `encerrada`, `cancelada` |
| `idGarcomResponsavel` | texto nulo | Responsável que assumiu a mesa |
| `participantes` | lista ou subcoleção | `idParticipante`, `nomeExibicaoCliente`, estado da sessão e horários de entrada/saída |
| `itens` | lista normalizada ou subcoleção | Itens, participante solicitante e snapshots de preço/descrição |
| `totalCentavos` | número | Total calculado server-side |
| `abertaEm` | timestamp | Início do atendimento |
| `encerradaEm` | timestamp nulo | Encerramento do consumo |
| `versaoComanda` | número | Controle de concorrência |
| `ultimaAtualizacaoEm` | timestamp | Atualização incremental |

O preço, nome e disponibilidade do produto deverão ser copiados para o snapshot do item no momento da confirmação pelo servidor. O frontend nunca poderá definir o preço final.

### 5.4 `pedidos`

Os pedidos continuarão no contrato operacional existente, com estados explícitos para o novo fluxo:

`rascunho` → `aguardando_confirmacao_garcom` → `confirmado_garcom` → `enviado_cozinha` → `em_preparo` → `pronto` → `servido`.

Estados de exceção deverão incluir `rejeitado_garcom`, `cancelado` e, se aprovado na modelagem, `ajuste_solicitado`. Cada pedido deverá preservar `idMesa`, `idComanda`, `idGarcomResponsavel`, `origemPedido`, `itensSnapshot`, `totalCentavos`, `statusPedido`, `criadoEm`, `atualizadoEm` e `chaveIdempotencia` sem aceitar autoria ou tenant vindos do cliente.

### 5.5 `encaminhamentosCaixa`

A primeira versão não processará pagamentos. Se o contrato atual não cobrir o encerramento operacional, poderá ser criada uma coleção específica com `idComanda`, `idMesa`, `statusEncaminhamento`, `idOperadorCaixa`, `encaminhadaEm`, `confirmadaEm`, `chaveIdempotencia` e `observacaoOperacional`. O caixa somente confirmará que recebeu o atendimento e que o acerto externo foi tratado; não serão armazenados método de pagamento, valor recebido, troco, cartão, senha, CVV ou credenciais de adquirência.

### 5.6 `historicoStatus`

Cada transição deverá gerar um evento imutável contendo `tipoEntidade`, `idEntidade`, `statusAnterior`, `statusNovo`, `papelExecutor`, `idUsuarioExecutor` quando houver, `origemEvento`, `motivo`, `criadoEm` e `idRequisicao`. O cliente anônimo deverá ser representado por uma sessão técnica não identificável, sem gravar IP ou dados pessoais desnecessários.

## 6. Etapas de implementação

### Etapa 1 — Validar escopo, papéis e regras do fluxo

Nesta etapa serão fechados os estados oficiais, permissões, exceções, definição de garçom responsável, política de cancelamento, comportamento de clientes que compartilham a mesa e estratégia de atualização entre telas. A divisão e o processamento de pagamentos ficam fora do escopo. Também será decidido se o primeiro incremento usará polling curto ou canal em tempo real.

**Entregáveis:** mapa do fluxo aprovado, matriz de permissões, catálogo de estados, critérios de aceite, decisão de atualização e confirmação de que o Firestore será a fonte persistente definitiva.  
**Critério de conclusão:** todos os papéis e transições têm uma única regra server-side, sem estados ambíguos.  
**Pausa:** solicitar aprovação explícita antes da Etapa 2.

### Etapa 2 — Modelar QR Code, mesas, comandas e estados no Firestore

Serão definidos os contratos finais dos documentos, os nomes dos campos em português, os enums fechados, os índices necessários e as transações de abertura/retomada de comanda. O QR Code será tratado como credencial pública revogável, com hash no servidor, expiração ou versão e proteção contra enumeração.

Também serão revisados `mesas`, `comandas`, `pedidos` e `historicoStatus` para evitar duplicação de contratos. A atualização de uma mesa e de uma comanda deverá ocorrer em transação quando houver risco de concorrência.

**Entregáveis:** contrato de dados, migração compatível, índices, regras de validação e testes de contrato.  
**Critério de conclusão:** documentos e estados podem ser criados, lidos e atualizados somente no contexto do restaurante correto.  
**Pausa:** solicitar aprovação explícita antes da Etapa 3.

### Etapa 3 — Implementar geração, leitura e entrada pública do QR Code com nome para atendimento

Será criada a configuração de QR Code por mesa na área administrativa, com gerar, regenerar, revogar, copiar link e imprimir. A leitura poderá usar a câmera do celular por uma página pública específica ou permitir abertura direta do link pela câmera nativa do aparelho; a decisão de biblioteca será tomada sem introduzir dependência desnecessária.

O endpoint público validará o token, exibirá o campo obrigatório de nome completo, criará ou retomará uma sessão anônima de participante da mesa e redirecionará para uma URL limpa sem manter o token exposto depois da validação. O navegador não receberá dados de outros restaurantes, o código interno da mesa ou qualquer identificador de dispositivo.

**Entregáveis:** geração e revogação, QR visual, página pública, cookie de sessão anônimo e mensagens de erro profissionais.  
**Critério de conclusão:** QR válido abre apenas a mesa correta; QR revogado, adulterado ou expirado não abre comanda.  
**Pausa:** solicitar aprovação explícita antes da Etapa 4.

### Etapa 4 — Implementar cardápio público, participantes e comanda do cliente

Será implementado o cardápio público publicado, com categorias, produtos disponíveis, complementos aprovados, observações e preços calculados a partir do servidor. O cliente poderá adicionar itens ao rascunho, revisar quantidades, visualizar o total calculado e enviar uma solicitação.

O envio deverá usar chave de idempotência, o participante identificado pelo nome e snapshot dos itens. Depois do envio, o cliente verá o status **Aguardando confirmação do garçom**. O pedido não será enviado à cozinha automaticamente.

**Entregáveis:** cardápio público, carrinho/comanda, envio idempotente, consulta de status e estados vazios.  
**Critério de conclusão:** nenhum preço ou status recebido do frontend é aceito como autoridade; duas submissões idênticas geram apenas um pedido.  
**Pausa:** solicitar aprovação explícita antes da Etapa 5.

### Etapa 5 — Implementar confirmação do garçom e encaminhamento à cozinha

A tela de pedidos do garçom receberá uma fila de solicitações pendentes com mesa, horário, itens, observações e total. O garçom poderá confirmar, rejeitar com motivo, assumir a mesa ou encaminhar a solicitação para um garçom já responsável, conforme a regra aprovada na Etapa 1.

A confirmação deverá ocorrer em transação, alterar a comanda e a mesa de forma coerente, gravar auditoria e encaminhar somente pedidos confirmados à cozinha. O sistema deverá impedir que dois garçons confirmem ou rejeitem a mesma solicitação simultaneamente.

**Entregáveis:** fila do garçom, confirmar/rejeitar, assumir mesa, atualização da comanda e auditoria.  
**Critério de conclusão:** o pedido só chega à cozinha após uma confirmação válida e identificável.  
**Pausa:** solicitar aprovação explícita antes da Etapa 6.

### Etapa 6 — Implementar produção, conclusão e retorno ao garçom

A Fila da Cozinha será adaptada para separar pedidos aguardando preparo, em preparo e prontos. A cozinha poderá iniciar e concluir somente pedidos confirmados que pertençam ao restaurante ativo. Ao marcar como pronto, o servidor gravará o evento e disponibilizará o pedido na fila do garçom responsável.

As telas deverão atualizar por polling controlado ou pelo canal escolhido, com reconexão, backoff e indicação do horário da última atualização. O sistema não deverá criar tarefas agendadas para movimentar estados.

**Entregáveis:** estados da cozinha, fila do garçom para pedidos prontos, atualização incremental e tratamento de indisponibilidade.  
**Critério de conclusão:** pedido pronto aparece para o garçom correto e não é perdido em caso de atualização ou recarregamento.  
**Pausa:** solicitar aprovação explícita antes da Etapa 7.

### Etapa 7 — Implementar serviço, encerramento da mesa e fechamento da comanda

O garçom poderá marcar o pedido como servido após a conclusão da cozinha. A tela da mesa exibirá pedidos ainda abertos, prontos, servidos e pendentes, evitando que o encerramento seja executado enquanto existirem itens em preparo ou não confirmados.

Ao clicar em encerrar consumo, o servidor validará que os pedidos estão servidos ou em estado de exceção aprovado, calculará e persistirá o resumo operacional, mudará a comanda para **encaminhada ao caixa** e notificará o caixa. A mesa não ficará disponível nesta etapa; ela permanecerá ocupada até a confirmação operacional final do caixa.

**Entregáveis:** acompanhamento da mesa pelo garçom, marcação de servido, encerramento controlado e encaminhamento ao caixa.  
**Critério de conclusão:** nenhuma comanda chega ao caixa com pedido não resolvido sem justificativa autorizada.  
**Pausa:** solicitar aprovação explícita antes da Etapa 8.

### Etapa 8 — Encaminhar a comanda encerrada ao caixa como operação final

O caixa receberá uma fila de comandas em **encaminhada ao caixa**, com mesa, participantes, itens servidos, resumo operacional e total calculado pelo servidor. O sistema não exibirá nem armazenará campos de captura de pagamento. O operador poderá confirmar que recebeu o atendimento e que o acerto externo foi realizado, usando chave de idempotência.

Depois da confirmação operacional do caixa, uma transação deverá marcar o encaminhamento como concluído, a comanda como `encerrada`, registrar a auditoria e mudar a mesa para **disponível** somente se não houver outra comanda ativa ou pedido aberto vinculado à mesa. Essa ação não representa processamento financeiro dentro do APEX Food.

**Entregáveis:** fila de caixa, confirmação operacional externa, auditoria e liberação transacional da mesa.  
**Critério de conclusão:** uma segunda confirmação não duplica encerramento, auditoria ou liberação de mesa.  
**Pausa:** solicitar aprovação explícita antes da Etapa 9.

### Etapa 9 — Aplicar segurança, concorrência, auditoria e notificações

Serão fechados os controles de segurança dos endpoints públicos e internos. O QR será limitado por restaurante e mesa; sessões anônimas terão escopo mínimo; os endpoints públicos terão rate limit específico; mutações exigirão CSRF quando aplicável; e a origem será validada conforme o contrato atual.

As transições críticas usarão transações do Firestore ou controle de versão. Todos os eventos relevantes terão auditoria, `idRequisicao`, chave de idempotência e mensagens de erro sem dados sensíveis. Os índices serão revisados para as filas por restaurante, status, mesa, garçom e atualização.

**Entregáveis:** matriz final de autorização, testes negativos, auditoria, idempotência, rate limit, índices e estratégia de atualização.  
**Critério de conclusão:** tentativas de acesso cruzado, repetição, alteração de preço, troca de restaurante ou salto de estado são rejeitadas.  
**Pausa:** solicitar aprovação explícita antes da Etapa 10.

### Etapa 10 — Executar testes end-to-end, regressão e publicação incremental

Será criado um cenário completo com restaurante e mesas de teste: QR válido, sessão de cliente, inclusão de itens, envio, confirmação do garçom, preparo, conclusão da cozinha, serviço, encerramento, encaminhamento ao caixa, confirmação operacional externa e liberação. Serão testados também QR revogado, cliente duplicando envio, dois garçons concorrentes, item indisponível, confirmação duplicada do caixa, falha de rede, recarregamento e tentativa de usar um QR em outra mesa. Não serão testados nem implementados processamento de pagamento, cartão, troco ou integração com adquirência.

A publicação ocorrerá no ambiente Development. Antes de cada push serão executados os testes automatizados, o scanner de segredos, `git diff --check` e verificações de sintaxe. Depois do deployment serão validados HTTP, headers, sessão, API, estados visuais, mobile/tablet/desktop e console do navegador.

**Entregáveis:** suíte de contratos, testes end-to-end, relatório de regressão, deployment Development e documentação de operação.  
**Critério de conclusão:** fluxo completo aprovado sem quebrar as rotas atuais e sem introduzir dados fixos ou exposição de credenciais.  
**Pausa:** apresentar o resultado da etapa e solicitar aprovação para qualquer expansão posterior.

## 7. Estados resumidos do pedido

| Ordem | Estado | Responsável pela transição |
|---:|---|---|
| 1 | `rascunho` | Cliente, dentro da sessão |
| 2 | `aguardando_confirmacao_garcom` | Servidor ao receber o pedido |
| 3 | `confirmado_garcom` | Garçom autorizado |
| 4 | `enviado_cozinha` | Servidor após confirmação |
| 5 | `em_preparo` | Cozinha autorizada |
| 6 | `pronto` | Cozinha autorizada |
| 7 | `servido` | Garçom responsável |
| 8 | `cancelado` ou `rejeitado_garcom` | Papel autorizado com motivo |

A situação da comanda e da mesa será derivada dos pedidos e das operações financeiras, mas sempre persistida em transações controladas para permitir filas eficientes e auditoria. Nenhum botão poderá pular diretamente de pedido do cliente para cozinha, de pedido pronto para mesa disponível ou de encerramento para pagamento concluído.

## 8. Segurança e privacidade

A aplicação pública não usará Firebase Web SDK para ler ou gravar dados operacionais. O cliente acessará somente endpoints same-origin que validam a sessão anônima da mesa, o restaurante associado, o token CSRF, a origem, os limites de requisição e o corpo recebido. As Rules do Firestore permanecerão deny-by-default, e os handlers continuarão usando credenciais somente no servidor. O Firestore será a fonte definitiva; qualquer estado temporário no cliente será descartável e nunca representará uma confirmação de pedido, pagamento ou liberação de mesa.

O token do QR será considerado um segredo de acesso à mesa, apesar de ser impresso publicamente. Ele deverá ser longo, não previsível, armazenado somente em hash, revogável e removido da URL após a abertura da sessão. A API não deverá registrar o token em claro nos logs. Dados de cliente anônimo serão mínimos e não deverão ser usados para identificar pessoas sem necessidade operacional.

O total será recalculado com produtos vigentes e snapshots aprovados. Promoções, disponibilidade, adicionais e observações serão validados no servidor. O sistema não armazenará dados de cartão. Quando houver integração futura com adquirência, ela deverá ser tratada por provedor compatível e webhook autenticado, em uma etapa separada.

## 9. Regras de aprovação e publicação

Cada etapa será encerrada com uma demonstração ou relatório objetivo. O sistema ficará pausado e aguardará a resposta explícita do usuário antes da próxima etapa. Nenhuma etapa será pulada para acelerar o fluxo, e uma mudança de escopo deverá gerar revisão do plano.

Toda etapa que modificar código será publicada no GitHub após os testes no clone de publicação. O ambiente continuará em Development, sem domínio próprio e sem promoção automática para Production. Os dados de teste deverão ser separados dos dados de clientes e identificados como pertencentes ao restaurante de teste.

## 10. Primeiro passo após a aprovação

A Etapa 1 começará pela validação de cinco decisões que alteram a implementação: atualização por polling ou canal em tempo real; política para vários clientes simultâneos na mesma mesa; política de cancelamento após confirmação; divisão de conta ou pagamento único; e regra de atribuição do garçom quando a mesa ainda não tiver responsável. A exigência de nome completo para atendimento e a persistência definitiva no Firestore já estão definidas neste plano; a etapa deverá apenas validar o rótulo, a finalidade operacional, a retenção e a visibilidade desse nome, além do contrato de recuperação após recarregamento ou falha de conexão.

Depois de receber essas decisões, será produzido o contrato final da Etapa 1 e o sistema ficará novamente pausado para sua aprovação antes da modelagem no Firestore.

## Referências

[1]: ../Plano-Sistema-Real.md "Plano do Sistema Real do APEX Food"
[2]: ../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[3]: ../SECURITY.md "Política de Segurança do APEX Food"
[4]: ../RUNBOOK-INCIDENTES.md "Runbook de Incidentes do APEX Food"
[5]: ../api/_lib/pedidos-handler.js "Handler server-side de Pedidos"
[6]: ../api/_lib/salao-handler.js "Handler server-side do Salão"
[7]: ../api/_lib/financeiro-handler.js "Handler server-side Financeiro"
