# Etapa 1 — Contrato do fluxo QR Code, comandas e operação

**Projeto:** APEX Food  
**Ambiente:** Development  
**Status:** Contrato preliminar aguardando confirmação operacional  
**Persistência:** Cloud Firestore como fonte definitiva, acessado somente pela API server-side  
**Escopo financeiro:** o sistema não processa pagamentos; o caixa apenas confirma a operação final externa  
**Autor:** Manus AI

## 1. Decisões já aprovadas

O cliente não criará conta, não informará senha e não será identificado por ID do dispositivo, impressão digital do navegador ou qualquer mecanismo de rastreamento equivalente. Depois de escanear o QR Code da mesa, deverá informar obrigatoriamente o **nome completo para atendimento**.

O nome será uma identificação operacional da comanda atual. Ele será exibido ao garçom para que possa reconhecer a pessoa e confirmar se ela está na mesa, mas não será tratado como prova de identidade nem convertido automaticamente em cadastro permanente.

Todos os dados operacionais serão persistidos no Cloud Firestore por meio da API server-side. O navegador não gravará diretamente no Firestore, e estado em memória, `localStorage` ou `sessionStorage` nunca poderá substituir a persistência. Se uma operação não for confirmada pelo servidor, a interface não poderá apresentá-la como concluída.

## 2. Base atual e pontos que a implementação deverá preservar ou corrigir

O sistema atual já possui handlers server-side para Pedidos, Salão e Financeiro, isolamento por restaurante, auditoria e transações. O contrato atual de Pedidos usa os estados `novo`, `preparo`, `pronto`, `entregue`, `finalizado` e `cancelado`; o Salão usa `disponivel`, `ocupada` e `indisponivel`; e o Financeiro possui fechamento de caixa e movimentações idempotentes.

Há um conflito importante que será corrigido na Etapa 2: no contrato atual, mover um pedido para `finalizado` pode fechar a comanda e tornar a mesa disponível. No fluxo QR Code, o pedido servido não pode liberar a mesa. A mesa só poderá voltar a `disponivel` depois de a comanda ser encerrada pelo garçom, encaminhada ao caixa, confirmada como operação final externa pelo caixa, auditada e verificada sem outro pedido aberto.

A criação atual de pedido também é orientada à equipe autenticada e cria uma comanda nova por pedido. O fluxo de cliente exigirá uma sessão de mesa, participante identificado por nome e reaproveitamento da comanda aberta da mesa, evitando várias comandas concorrentes para o mesmo atendimento.

## 3. Fluxo operacional aprovado

| Ordem | Evento | Estado resultante | Responsável |
|---:|---|---|---|
| 1 | Cliente escaneia QR válido | Sessão temporária da mesa criada | Servidor |
| 2 | Cliente informa nome completo | Participante vinculado à comanda | Cliente + servidor |
| 3 | Cliente envia pedido | `aguardando_confirmacao_garcom` | Servidor |
| 4 | Garçom verifica mesa e pedido | `confirmado_garcom` ou `rejeitado_garcom` | Garçom |
| 5 | Pedido confirmado é disponibilizado | `enviado_cozinha` | Servidor |
| 6 | Cozinha inicia preparo | `em_preparo` | Cozinha |
| 7 | Cozinha termina preparo | `pronto` | Cozinha |
| 8 | Garçom recebe aviso e serve | `servido` | Garçom responsável |
| 9 | Garçom encerra o consumo | Comanda `encaminhada_caixa` | Garçom |
| 10 | Caixa confirma recebimento/acerto externo | Comanda `encerrada` | Caixa |
| 11 | Transação final verifica a mesa | Mesa `disponivel` | Servidor |

Nenhuma etapa poderá ser pulada pelo frontend. A cozinha não verá pedidos que ainda aguardam confirmação do garçom. O caixa não verá uma comanda como concluída antes do encerramento do consumo. A mesa não será liberada pelo garçom nem pela cozinha.

## 4. Estados propostos

### 4.1 Mesa

`disponivel` → `ocupada` → `aguardando_confirmacao` → `em_preparo` → `pedido_pronto` → `encaminhada_caixa` → `disponivel`.

O estado poderá retornar a `ocupada` entre pedidos e poderá ir para `indisponivel` ou `bloqueada` somente por configuração autorizada. A implementação deverá decidir se `aguardando_confirmacao`, `em_preparo`, `pedido_pronto` e `encaminhada_caixa` serão estados persistidos diretamente em `mesas` ou derivados de `comandas` e `pedidos` com um resumo transacional.

### 4.2 Comanda

`aberta` → `em_consumo` → `encaminhada_caixa` → `encerrada`.

Uma comanda poderá ser `cancelada` somente mediante regra autorizada e motivo. Se houver vários clientes na mesma mesa, todos os participantes usarão a mesma comanda, mas cada item deverá registrar o participante que o solicitou.

### 4.3 Pedido

`rascunho` → `aguardando_confirmacao_garcom` → `confirmado_garcom` → `enviado_cozinha` → `em_preparo` → `pronto` → `servido`.

Os estados de exceção serão `rejeitado_garcom`, `cancelado` e, se necessário, `ajuste_solicitado`. O cliente não poderá alterar um pedido depois do envio. Antes da confirmação do garçom, o pedido poderá ser rejeitado com motivo; depois de enviado à cozinha, cancelamento ou ajuste dependerá de uma regra autorizada.

## 5. Papéis e permissões

| Papel | Pode executar | Não pode executar |
|---|---|---|
| Cliente identificado por nome | Ler cardápio publicado, criar rascunho, enviar pedido e consultar seus pedidos e o estado da comanda | Confirmar pedido, alterar preço, escolher restaurante, liberar mesa ou confirmar caixa/pagamento |
| Garçom | Confirmar/rejeitar pedido, informar motivo, assumir mesa, acompanhar pronto, marcar servido e encaminhar a comanda ao caixa | Alterar total final sem autorização, confirmar caixa, processar pagamento ou liberar mesa diretamente |
| Cozinha | Ver pedidos confirmados, iniciar preparo e marcar pronto | Confirmar pedido do cliente, encerrar comanda, alterar preço ou liberar mesa |
| Caixa | Ver comandas encaminhadas, confirmar que recebeu o acerto externo e concluir a operação final do atendimento | Processar pagamento dentro do sistema, armazenar dados financeiros sensíveis, alterar itens já servidos sem fluxo autorizado ou fechar comanda de outro restaurante |
| Gerente | Reatribuir garçom, tratar exceções autorizadas, cancelar com justificativa e consultar auditoria | Remover histórico ou apagar evidência de transição |

## 6. Persistência e segurança obrigatórias

Os documentos de QR Code, versões e revogações, mesas, sessões temporárias, participantes, comandas, itens, snapshots de produtos e preços, pedidos, estados da cozinha, atribuição do garçom, itens servidos, encerramento, encaminhamento ao caixa, movimentações operacionais, auditoria, chaves de idempotência e eventos de sincronização deverão ser armazenados no Firestore. O sistema não armazenará cartão, senha, CVV, dados de adquirência ou confirmação financeira detalhada.

Cada documento deverá estar no restaurante correto, preferencialmente em subcoleções sob `restaurantes/{idRestaurante}`, e o `idRestaurante` deverá ser derivado da sessão/contexto server-side. O frontend nunca poderá escolher o restaurante ativo por payload nem enviar status final, preço final, total final, papel do executor ou autoria como fonte de autoridade.

As operações críticas deverão ser transacionais: abrir ou retomar comanda, anexar participante, confirmar pedido, enviar para cozinha, concluir preparo, marcar servido, encerrar consumo, encaminhar ao caixa, confirmar o encerramento operacional externo e liberar mesa. A confirmação do caixa não representará processamento ou captura de pagamento. Cada mutação deverá aceitar uma chave de idempotência e registrar evento imutável em `historicoStatus`.

## 7. Decisões operacionais que precisam ser confirmadas

As seguintes decisões ainda alteram a implementação e precisam da confirmação do responsável antes da Etapa 2:

| Decisão | Recomendação inicial | Confirmação necessária |
|---|---|---|
| Atualização das filas | Começar com polling curto controlado pela API, com cursor e backoff; evoluir para canal em tempo real se a operação exigir menor latência | Polling inicial ou atualização em tempo real desde o primeiro incremento? |
| Vários clientes na mesma mesa | Permitir vários participantes, cada um com nome completo e sessão própria, compartilhando uma comanda | A mesa poderá receber pedidos de vários celulares simultaneamente? |
| Cancelamento | Cliente pode corrigir ou cancelar apenas antes do envio; depois do envio, garçom pode rejeitar; após confirmação, somente garçom/gerente com motivo e conforme o estado da cozinha | Essa política está aprovada? |
| Divisão de conta | Fora do escopo: a primeira versão não processará nem dividirá pagamentos; manterá apenas itens atribuídos a participantes para conferência do caixa | A divisão deverá ser tratada futuramente fora deste fluxo? |
| Garçom responsável | Usar o garçom já atribuído à mesa; se não existir, o primeiro garçom que confirmar assume a responsabilidade em transação | Essa regra de atribuição está aprovada? |
| Retenção do nome | Exibir à equipe durante o atendimento; após encerramento e confirmação externa do caixa, manter somente o mínimo necessário no histórico operacional pelo prazo definido pelo restaurante | O nome completo deve permanecer no histórico após o encerramento ou ser anonimizado depois da operação final? |

## 8. Critérios de conclusão da Etapa 1

A Etapa 1 será considerada concluída quando os cinco fluxos de estado, a matriz de permissões, a regra de nome obrigatório, a persistência definitiva no Firestore, a política de concorrência e as decisões operacionais acima estiverem aprovados. A partir desse contrato, a Etapa 2 poderá modelar coleções, campos, índices, transações e migrações sem alterar a decisão de segurança já tomada.

## 9. Pausa de aprovação

O sistema permanece pausado e nenhuma coleção nova, rota pública ou mudança de handler será criada nesta Etapa 1. Após a confirmação das decisões operacionais, será entregue o contrato Firestore da Etapa 2 para nova aprovação antes de iniciar a implementação. O fluxo aprovado termina no caixa: o sistema registra a confirmação operacional externa, sem processar pagamento, e só então libera a mesa em transação.

## Referências

[1]: ../Plano-Sistema-Real.md "Plano do Sistema Real do APEX Food"
[2]: ../Plano-Firebase.md "Plano de Integração Segura do Firebase no APEX Food"
[3]: ../SECURITY.md "Política de Segurança do APEX Food"
[4]: ../api/_lib/pedidos-handler.js "Handler server-side de Pedidos"
[5]: ../api/_lib/salao-handler.js "Handler server-side do Salão"
[6]: ../api/_lib/financeiro-handler.js "Handler server-side Financeiro"
