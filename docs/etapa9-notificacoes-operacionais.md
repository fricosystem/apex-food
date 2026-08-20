# Etapa 9 — Central de notificações operacionais

**Projeto:** APEX Food
**Escopo:** notificações internas do fluxo QR, sem processamento de pagamentos
**Arquitetura:** HTML estático com shell único, API server-side na Vercel e Cloud Firestore como fonte definitiva
**Estado:** contrato da Etapa 9 definido para implementação

## Decisão arquitetural

A central será uma extensão das telas administrativas existentes. Não será criada uma segunda sidebar, um segundo header ou uma página administrativa independente. O sino já presente nos headers desktop e mobile abrirá um painel de notificações dentro do shell único; a listagem completa poderá ser acessada no mesmo contexto operacional se a experiência existente exigir.

A consulta e a atualização utilizarão o endpoint operacional consolidado, com `modulo=notificacoes`. Não será criado novo arquivo em `api/v1/`, preservando o limite de funções Serverless da Vercel. O handler de notificações será carregado pelo dispatcher de `api/v1/operacional.js`, e o cliente same-origin continuará responsável por CSRF, sessão, origem e tratamento de erros.

## Objetivo operacional

A central deve permitir que cada papel autorizado veja rapidamente o que exige ação, sem transformar a notificação em fonte de autoridade. O operador sempre abrirá o pedido, a ficha, a comanda ou o encaminhamento e o servidor revalidará o estado atual. Uma notificação antiga, repetida ou já resolvida não poderá alterar o fluxo operacional.

| Evento de origem | Destinatários | Mensagem operacional |
|---|---|---|
| Pedido QR criado em `aguardando_confirmacao_garcom` | Garçons, gerente, administrador e proprietário | Novo pedido aguardando confirmação na mesa indicada |
| Pedido QR confirmado pelo garçom e enviado à cozinha | Cozinha, gerente, administrador e proprietário | Pedido confirmado e enviado para preparo |
| Pedido QR marcado como `pronto` | Garçom responsável e gerência autorizada | Pedido pronto para servir |
| Pedido rejeitado ou cancelado | Garçom responsável, gerente, administrador e proprietário | Pedido rejeitado ou cancelado com motivo operacional |
| Comanda encaminhada ao caixa | Caixa, gerente, administrador e proprietário | Comanda aguardando conferência operacional do caixa |
| Encaminhamento recebido pelo caixa | Gerência autorizada | Comanda recebida pelo caixa |
| Encaminhamento concluído e mesa liberada | Garçom responsável, gerente, administrador e proprietário | Atendimento encerrado e mesa disponível |
| Falha operacional registrada pelo servidor | Gerente, administrador e proprietário | Falha operacional exige conferência |

O cliente público da mesa não acessará a central interna. Ele continuará consultando a própria comanda por meio da sessão anônima, sem receber notificações de outros participantes, mesas, garçons, cozinha ou caixa.

## Estados da notificação

Cada notificação terá estado `nova`, `lida` ou `arquivada`. A leitura é individual por operador e não altera o estado do pedido. O arquivamento será permitido somente quando a notificação estiver resolvida ou quando o papel possuir permissão de gestão; o servidor poderá manter a notificação para auditoria e apenas ocultá-la da fila padrão.

A emissão será idempotente por evento de origem e destinatário. A chave derivada server-side terá o formato lógico `tipoEvento:idEvento:idDestinatario`, armazenada por hash no identificador do documento ou em coleção de idempotência, sem confiar em identificador recebido do navegador. Reprocessamento da mesma transição não deverá gerar duplicatas.

## Documento `notificacoes`

Os documentos ficarão em `restaurantes/{idRestaurante}/notificacoes`, sempre limitados ao restaurante derivado da sessão autenticada. Nenhum documento público conterá token QR, cookie, IP ou segredo.

| Campo | Tipo | Regra |
|---|---|---|
| `idRestaurante` | texto | Derivado no servidor e validado no tenant |
| `tipoNotificacao` | enum | Catálogo fechado, em português técnico |
| `titulo` | texto | Gerado no servidor, sem HTML livre |
| `mensagem` | texto | Gerada a partir de dados operacionais autorizados |
| `prioridade` | enum | `normal`, `alta`, `critica` |
| `papelDestino` | enum | `garcom`, `cozinha`, `caixa`, `gerente`, `administrador`, `proprietario` |
| `idUsuarioDestino` | texto nulo | Nulo para fila por papel; preenchido para garçom responsável |
| `idMesa` | texto nulo | Referência operacional, sem dados sensíveis |
| `idComanda` | texto nulo | Referência operacional |
| `idPedido` | texto nulo | Referência operacional |
| `idEncaminhamento` | texto nulo | Referência operacional do caixa |
| `eventoOrigem` | texto | Identificador server-side do evento de transição |
| `statusNotificacao` | enum | `nova`, `lida`, `arquivada` |
| `criadaEm` | timestamp | Server timestamp |
| `lidaEm` | timestamp nulo | Preenchido na leitura |
| `arquivadaEm` | timestamp nulo | Preenchido no arquivamento |
| `atualizadaEm` | timestamp | Server timestamp |
| `versao` | número | Controle de concorrência |
| `expiraEm` | timestamp | Retenção operacional limitada |

Para filas por papel, a consulta filtrará `papelDestino` e o restaurante. Para notificações pessoais do garçom, filtrará também `idUsuarioDestino`. O cliente nunca poderá informar `idRestaurante`, `papelDestino` ou `idUsuarioDestino` para ampliar seu escopo.

## Consulta e mutação

A leitura será feita por `GET /api/v1/operacional?modulo=notificacoes`, com filtros server-side `status`, `papel`, `limite` e cursor opcional quando implementado. A resposta terá DTOs sanitizados, datas em ISO e apenas referências necessárias para abrir o recurso.

A marcação como lida e o arquivamento serão feitos por `PATCH /api/v1/operacional?modulo=notificacoes`, exigindo sessão, CSRF, App Check conforme o contrato administrativo, papel autorizado, validação de restaurante, versão e chave de idempotência. O servidor revalidará o documento e rejeitará alterações em notificações de outro operador ou restaurante.

## Integração com estados existentes

A emissão será acoplada às transações que mudam o estado operacional, quando tecnicamente compatível, para que a transição e a notificação sejam persistidas juntas. Os pontos prioritários são a criação pública do pedido, as transições QR em `pedidos-handler.js` e o encaminhamento/conclusão no `financeiro-handler.js`.

A notificação não substituirá `historicoStatus`, `eventos`, `registrosAuditoria`, `fichasCozinha` ou `encaminhamentosCaixa`. Ela será uma projeção operacional derivada desses eventos, com conteúdo mínimo para a fila e link lógico para o recurso consultado.

## Retenção, segurança e falhas

Notificações serão retidas apenas pelo período operacional definido no handler e terão `expiraEm`; a exclusão física, quando necessária, ficará fora da primeira implementação para não introduzir tarefa agendada. Documentos expirados serão excluídos da consulta padrão server-side.

Se a gravação da notificação falhar dentro da mesma transação da mudança crítica, a transação deverá falhar, evitando estado visual de sucesso sem registro operacional. Se a central estiver indisponível durante uma leitura, a tela exibirá erro controlado e manterá a última informação somente em memória, sem confirmar alterações.

## Critérios de aceite da Etapa 9

A central deverá mostrar somente notificações do restaurante ativo e do papel autorizado; não poderá criar duplicatas em repetição idempotente; deverá impedir leitura ou mutação por sessão sem autorização; deverá atualizar o contador de não lidas sem dados fictícios; deverá manter o shell único e a responsividade; e deverá continuar funcionando quando não houver notificações, exibindo uma mensagem profissional de estado vazio.

## Matriz de permissões

| Operação | Proprietário / administrador | Gerente | Garçom | Cozinha | Caixa | Analista / auditor |
|---|---|---|---|---|---|---|
| Listar notificações do restaurante | Sim | Sim | Somente fila de garçom e notificações pessoais | Somente fila de cozinha e notificações pessoais | Somente fila de caixa e notificações pessoais | Somente leitura autorizada |
| Marcar própria notificação como lida | Sim | Sim | Sim | Sim | Sim | Não |
| Arquivar notificação própria | Sim | Sim | Sim | Sim | Sim | Não |
| Arquivar notificação de outro operador | Sim | Sim, quando necessário à operação | Não | Não | Não | Não |
| Criar notificação pelo navegador | Não | Não | Não | Não | Não | Não |
| Alterar título, destinatário ou evento de origem | Não | Não | Não | Não | Não | Não |

A emissão é exclusivamente server-side durante transições autorizadas. Assim, nenhum papel consegue fabricar uma notificação de sucesso a partir do navegador.

## Índices e estratégia de consulta

A primeira consulta será limitada por `papelDestino` e ordenada por `criadaEm` no servidor, com limite máximo de 100 documentos por requisição. O handler deverá filtrar `statusNotificacao` e `idUsuarioDestino` após a leitura para suportar tanto filas de papel quanto notificações individuais sem expor dados de outra função.

Quando a carga real exigir consulta composta, os índices recomendados serão:

| Coleção | Campos em ordem | Uso |
|---|---|---|
| `notificacoes` | `papelDestino ASC`, `criadaEm DESC` | Fila por papel |
| `notificacoes` | `idUsuarioDestino ASC`, `criadaEm DESC` | Notificação individual |
| `notificacoes` | `statusNotificacao ASC`, `criadaEm DESC` | Contagem/limpeza operacional |

A implementação inicial poderá consultar por papel e aplicar a ordenação em memória para evitar depender de índice não publicado durante o Development. O handler deverá registrar uma mensagem controlada caso o Firestore exija índice, e a criação do índice será tratada antes de homologação com dados reais. Nenhuma consulta poderá remover o filtro de restaurante derivado do contexto autenticado.

## Retenção operacional

O campo `expiraEm` será calculado pelo servidor para uma janela inicial de **30 dias**. Notificações expiradas não aparecerão na fila padrão. A exclusão física e a limpeza agendada não farão parte deste incremento; a retenção lógica reduz o risco de perder evidência operacional antes da revisão da política de auditoria.
