# Contrato operacional de distribuição — APEX Food

**Versão:** 2026-08-22
**Escopo:** comanda pública, garçons, cozinha, caixa e avaliação posterior
**Princípio:** toda decisão operacional crítica ocorre no servidor, dentro do restaurante identificado pela sessão autenticada ou pela sessão pública assinada da mesa.

## 1. Objetivo

Este contrato define a máquina de estados e as regras determinísticas que serão usadas para transformar a comanda pública em um fluxo operacional completo. A implementação deve preservar a arquitetura atual, o endpoint consolidado de pedidos, o limite de funções da Vercel e as coleções em português já utilizadas pelo sistema.

O navegador não poderá escolher garçom, cozinheiro, preço, status final ou disponibilidade. O cliente apenas informa o nome completo, escolhe produtos, revisa o pedido e o envia. A equipe executa somente ações autorizadas pelo papel e pelo vínculo operacional atribuído pelo servidor.

## 2. Entidades e vínculos

| Entidade | Coleção atual | Vínculos obrigatórios |
|---|---|---|
| Pedido | `pedidos` | `idComanda`, `idMesa`, cliente, itens, status, responsável e histórico |
| Comanda | `comandas` | mesa, sessão, participantes, garçom responsável, total e status |
| Mesa | `mesas` | disponibilidade, comanda aberta, garçom responsável e estado de atendimento |
| Sessão pública | `sessoesMesa` | mesa, comanda, participante e estado da sessão |
| Ficha de cozinha | `fichasCozinha` | pedido, comanda, mesa, garçom, tarefas e estado agregado |
| Funcionário | `funcionarios` | papel operacional, turno, disponibilidade, capacidade e carga atual |
| Encaminhamento | `encaminhamentosCaixa` | comanda, mesa, garçom, total, status e operador do caixa |
| Avaliação | `avaliacoes` | comanda, mesa, garçom, nota, comentário e origem da avaliação |

Os campos derivados, como nome da mesa e nome do responsável, podem ser armazenados como snapshot para leitura rápida, mas a identidade principal continuará sendo o ID validado pelo servidor.

## 3. Estados oficiais

### 3.1 Pedido originado pelo QR Code

| Estado | Próximos estados permitidos | Responsável pela ação |
|---|---|---|
| `rascunho` | `aguardando_confirmacao_garcom`, `cancelado` | Cliente para envio; sistema para cancelamento de sessão |
| `aguardando_confirmacao_garcom` | `confirmado_garcom`, `rejeitado_garcom`, `cancelado` | Garçom responsável ou supervisor |
| `confirmado_garcom` | `enviado_cozinha`, `cancelado` | Garçom responsável ou supervisor |
| `enviado_cozinha` | `em_preparo`, `cancelado` | Cozinha responsável ou supervisor |
| `em_preparo` | `pronto`, `cancelado` | Cozinha responsável ou supervisor |
| `pronto` | `servido`, `cancelado` | Garçom responsável ou supervisor |
| `servido` | nenhum no pedido; encaminhamento da comanda | Garçom responsável |
| `rejeitado_garcom` | nenhum | estado terminal |
| `cancelado` | nenhum | estado terminal |

O estado legado `novo`, `preparo`, `entregue` e `finalizado` continuará sendo lido para compatibilidade, mas não será usado para novos pedidos QR depois da migração do contrato.

### 3.2 Comanda, mesa e caixa

| Entidade | Sequência oficial |
|---|---|
| Comanda | `aberta` → `em_consumo` → `encaminhada_caixa` → `encerrada` |
| Mesa | `disponivel` → `ocupada` → `encaminhada_caixa` → `disponivel` |
| Encaminhamento de caixa | `encaminhada` → `recebida` → `concluida` |
| Sessão pública | `ativa` → `encerrada` |
| Avaliação | `pendente` → `respondida` ou `expirada` |

Cancelamentos não devem apagar documentos. O sistema deverá registrar estado terminal, motivo, ator, papel, horário, requisição e versão do documento.

## 4. Campos operacionais de funcionário

Os seguintes campos serão acrescentados ao contrato de equipe, sem remover os campos atuais:

| Campo | Tipo | Aplicação |
|---|---|---|
| `papelOperacional` | `garcom`, `cozinha`, `caixa`, `supervisor` ou vazio | Define o papel efetivo no fluxo |
| `disponibilidadeAtendimento` | `disponivel`, `em_atendimento`, `pausado`, `indisponivel` | Impede novas atribuições indevidas |
| `capacidadeMesas` | inteiro positivo | Limite de mesas simultâneas do garçom |
| `capacidadeComandas` | inteiro positivo | Limite de comandas simultâneas do garçom |
| `capacidadePedidos` | inteiro positivo | Limite de pedidos pendentes do garçom ou cozinheiro |
| `especialidadesCozinha` | array de códigos configuráveis | Habilidades do cozinheiro |
| `estacoesCozinha` | array de códigos configuráveis | Bancadas ou estações em que trabalha |
| `cargaAtual` | objeto derivado | Contadores de mesas, comandas, pedidos e tarefas |
| `ultimaAtribuicaoEm` | timestamp | Desempate equilibrado entre profissionais |
| `prioridadeDistribuicao` | inteiro não negativo | Ajuste explícito do estabelecimento |

O cadastro continuará validando papel, setor, turno e status no servidor. Valores de capacidade serão limitados e nunca poderão ser negativos ou ilimitados por padrão.

## 5. Distribuição determinística de garçons

A atribuição será executada no servidor no momento em que a comanda pública for aberta, ou imediatamente antes do primeiro pedido caso a comanda já exista sem responsável. A operação ocorrerá em transação, lendo a mesa, a comanda e os candidatos antes de gravar o vínculo.

São candidatos somente funcionários com status `ativo`, setor `Salão`, papel operacional de garçom, escala compatível com a data/turno e disponibilidade diferente de `pausado` ou `indisponivel`. O candidato também precisa estar abaixo das capacidades configuradas.

A pontuação será calculada de forma determinística:

```text
ocupacaoMesas = mesasAtivas / capacidadeMesas
ocupacaoComandas = comandasAtivas / capacidadeComandas
ocupacaoPedidos = pedidosPendentes / capacidadePedidos
pontuacao = (ocupacaoMesas * 0,45) + (ocupacaoComandas * 0,35) + (ocupacaoPedidos * 0,20)
```

O servidor escolherá a menor pontuação. Em empate, serão usados, nesta ordem, menor `prioridadeDistribuicao`, `ultimaAtribuicaoEm` mais antiga e ID do funcionário em ordem lexicográfica. Depois da escolha, a transação atualizará a comanda, a mesa, a carga do funcionário e um evento de atribuição. Se não houver candidato compatível, a comanda ficará em `aguardando_atribuicao`, a mesa continuará ocupada e o sistema exibirá uma pendência operacional para supervisor; nunca haverá atribuição silenciosa a um funcionário indisponível.

Somente o garçom responsável poderá confirmar, rejeitar, encaminhar à cozinha, servir e encaminhar a comanda ao caixa. Gerente, administrador e proprietário poderão atuar como supervisores, sempre com auditoria do motivo e do ator.

## 6. Distribuição de tarefas da cozinha

Cada produto poderá ter `especialidadesNecessarias` e `estacoesNecessarias`. Ao encaminhar o pedido à cozinha, o servidor criará uma ficha agregada e tarefas por grupo de preparo. Cada tarefa terá pedido, item, quantidade, estação, especialidade, cozinheiro responsável, status e histórico.

Um cozinheiro será candidato quando estiver ativo, em escala compatível, no setor `Cozinha`, com disponibilidade operacional válida e possuir todas as especialidades e estações exigidas pela tarefa. A pontuação usará a mesma lógica de carga, substituindo mesas por tarefas em preparo e pedidos pendentes por tempo de fila. Em empate, será aplicado o mesmo desempate por prioridade, última atribuição e ID.

Quando não houver cozinheiro compatível, a tarefa ficará em `fila_geral` com a estação e a capacidade exigidas explicitadas. O sistema não marcará como atribuído um profissional que não tenha a capacidade cadastrada. A ficha agregada só ficará `pronta` quando todas as tarefas estiverem prontas. A conclusão de uma tarefa notificará o garçom responsável pelo pedido.

## 7. Regras de cancelar, rejeitar e atender

| Situação | Ação | Exigência |
|---|---|---|
| Cliente ainda revisando | Remover do carrinho | Não grava pedido |
| Pedido aguardando garçom | Rejeitar ou cancelar | Motivo obrigatório; devolução de estoque quando aplicável |
| Pedido confirmado, mas não iniciado | Cancelar | Garçom responsável ou supervisor; motivo obrigatório |
| Pedido na cozinha | Cancelar | Cozinha responsável ou supervisor; motivo obrigatório e histórico |
| Pedido pronto | Cancelar excepcionalmente | Supervisor ou garçom responsável com motivo |
| Pedido servido | Não cancelar pelo fluxo comum | Correção deve ser registrada como ocorrência operacional |
| Comanda encaminhada ao caixa | Não aceitar novos pedidos | Caixa ou supervisor pode cancelar o encaminhamento com motivo |

Todas as ações devem usar chave de idempotência, verificar a versão atual e registrar evento no pedido, na comanda e, quando aplicável, na mesa ou ficha de cozinha.

## 8. Contrato mínimo do caixa

O encaminhamento deverá carregar resumo e referência para detalhamento server-side. A tela do caixa deverá conseguir consultar, sem confiar em dados do navegador:

```json
{
  "idEncaminhamento": "...",
  "idComanda": "...",
  "idMesa": "...",
  "nomeMesa": "...",
  "idGarcomResponsavel": "...",
  "pedidos": [],
  "totalCentavos": 0,
  "statusEncaminhamento": "encaminhada"
}
```

O caixa poderá marcar `recebida` e, após conferir a comanda, marcar `concluida`. O sistema não processará pagamento. A conclusão será transacional: comanda `encerrada`, sessão `encerrada`, mesa `disponivel`, garçom liberado, cargas decrementadas e avaliação criada como `pendente`.

## 9. Contrato da avaliação pós-atendimento

Depois da conclusão operacional do caixa, a sessão pública poderá mostrar uma avaliação única para a comanda:

```json
{
  "idComanda": "...",
  "idMesa": "...",
  "idGarcomResponsavel": "...",
  "nota": 5,
  "comentario": "Atendimento excelente.",
  "origem": "comanda_publica",
  "estado": "respondida"
}
```

A nota será inteira de 1 a 5. O comentário será opcional, limitado e higienizado. A sessão pública não poderá avaliar uma comanda de outro restaurante, uma comanda ainda aberta ou a mesma comanda mais de uma vez. A coleção `avaliacoes` será lida pelos agregadores reais da Visão Geral e pelo módulo Avaliações dos Clientes.

## 10. Segurança e concorrência

A distribuição e as transições serão implementadas nos handlers server-side existentes, sem nova função em `api/v1/`. A identidade do restaurante virá da sessão, os papéis serão validados no servidor, o App Check e o CSRF permanecerão ativos nas mutações, e preços, cargas e vínculos serão recalculados no servidor.

As transações deverão ler todos os documentos que influenciam a decisão antes de gravar. Uma segunda atribuição concorrente deverá falhar com código operacional seguro ou retornar a mesma decisão idempotente. Nenhuma tela deverá esconder uma falha transformando-a em estado vazio.

## 11. Ordem de implementação

A Fase 3 implementará primeiro a correção de interação dos detalhes e a tela exclusiva dos garçons, junto da atribuição de comanda. A Fase 4 implementará capacidades e tarefas da cozinha. As fases seguintes cuidarão de cancelamento completo, caixa detalhado, liberação e avaliação. Cada fase terá contratos automatizados, validação em dados controlados e publicação separada.
