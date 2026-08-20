# Contrato da Fase 7 — Salão, Mesas e Reservas

## Rotas

| Método | Rota | Recurso | Finalidade |
|---|---|---|---|
| GET | `/api/v1/salao?recurso=mesas` | `mesas` | Listar mesas do restaurante ativo |
| GET | `/api/v1/salao?recurso=reservas` | `reservas` | Listar reservas do restaurante ativo |
| GET | `/api/v1/salao?recurso=configuracao` | `configuracaoSalao` | Ler configurações do Salão |
| POST | `/api/v1/salao` | `reserva` | Criar reserva com validação de mesa, capacidade e conflito |
| POST | `/api/v1/salao` | `mesa` | Criar mesa administrativa |
| PATCH | `/api/v1/salao` | `reserva` | Atualizar estado da reserva com auditoria |
| PATCH | `/api/v1/salao` | `mesa` | Atualizar estado ou dados administrativos da mesa com auditoria |

Todas as rotas exigem sessão HttpOnly, contexto de restaurante válido, CSRF nas mutações, origem autorizada e App Check conforme o ambiente. O servidor define `idRestaurante`, autoria, versão e timestamps; o frontend não pode enviar tenant, autoria ou estado de auditoria.

## Coleção `mesas`

Cada documento ficará sob `restaurantes/{idRestaurante}/mesas/{idMesa}` e terá os seguintes campos públicos no DTO:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | ID do documento |
| `nome` | string | Obrigatório, único no restaurante |
| `capacidade` | inteiro | Entre 1 e 1000 |
| `area` | string | Opcional, limitada pelo servidor |
| `estado` | enum | `disponivel`, `ocupada` ou `indisponivel` |
| `observacoes` | string | Opcional, limitada pelo servidor |
| `versao` | inteiro | Incrementado pelo servidor |
| `criadoEm` | timestamp | Definido pelo servidor |
| `atualizadoEm` | timestamp | Definido pelo servidor |

O estado `indisponivel` representa bloqueio operacional. A mudança de estado gera um documento em `eventosMesas` e uma entrada na auditoria operacional.

## Coleção `reservas`

Cada documento ficará sob `restaurantes/{idRestaurante}/reservas/{idReserva}`:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | ID do documento |
| `idMesa` | string ou nulo | Deve apontar para mesa existente quando informado |
| `nomeCliente` | string | Obrigatório |
| `contatoClienteMascarado` | string | Nunca retorna contato sem mascaramento |
| `inicioEm` | timestamp | Obrigatório |
| `fimEm` | timestamp | Posterior a `inicioEm` |
| `quantidadePessoas` | inteiro | Positivo e compatível com a capacidade da mesa |
| `estado` | enum | `aguardando`, `confirmada`, `chegou` ou `cancelada` |
| `canal` | string | Canal controlado pelo servidor |
| `observacoes` | string | Opcional |
| `criadoEm` | timestamp | Definido pelo servidor |
| `atualizadoEm` | timestamp | Definido pelo servidor |

A criação será transacional. Quando houver mesa, o servidor valida existência, capacidade e sobreposição de horários, ignorando apenas reservas canceladas ou concluídas. A alteração de estado será auditada.

## Payloads permitidos

A criação de mesa aceitará `recurso: 'mesa'`, `nome`, `capacidade`, `area`, `estado` opcional e `observacoes`. A atualização de mesa aceitará `recurso: 'mesa'`, `id` e somente os campos administrativos alterados, sem permitir que o cliente defina tenant, autoria ou versão.

A criação de reserva aceitará `recurso: 'reserva'`, `idMesa`, `nomeCliente`, `contatoCliente`, `quantidadePessoas`, `inicioEm`, `fimEm`, `canal` e `observacoes`. A atualização de reserva aceitará `recurso: 'reserva'`, `id` e `estado`.

## Critérios de segurança

O backend será a única fonte de verdade para permissões, conflitos, capacidade, estados e auditoria. O frontend utilizará somente o cliente same-origin, não usará Firebase client, tokens, localStorage ou campos internos do Firestore.
