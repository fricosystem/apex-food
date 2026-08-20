# Contrato da Fase 8 — Equipe e Permissões

## Rotas e recursos

| Método | Rota | Recurso | Finalidade |
|---|---|---|---|
| GET | `/api/v1/equipe?recurso=funcionarios` | `funcionarios` | Listar funcionários públicos do restaurante ativo |
| GET | `/api/v1/equipe?recurso=escalas` | `escalas` | Listar escalas do restaurante ativo |
| GET | `/api/v1/equipe?recurso=comissoes&periodo=...` | `comissoes` | Listar comissões por período |
| POST | `/api/v1/equipe` | `funcionario` | Criar funcionário e documento privado de contato |
| PATCH | `/api/v1/equipe` | `funcionario` | Atualizar dados permitidos do funcionário |
| POST | `/api/v1/equipe` | `escala` | Criar escala com validação de jornada e conflito |
| PATCH | `/api/v1/equipe` | `escala` | Atualizar escala com validação de jornada e conflito |

Comissões são somente leitura nesta fase. O cálculo e a origem financeira permanecem no servidor; a interface não poderá alterar vendas, percentual ou valor de comissão diretamente.

## Coleções

Os documentos ficam dentro do restaurante ativo: `funcionarios`, `dadosPrivadosFuncionarios`, `escalas` e `comissoes`. O campo `idRestaurante`, autoria, versão e timestamps são definidos pelo servidor.

A coleção `dadosPrivadosFuncionarios` contém o contato completo e nunca é enviada pelo DTO público. O frontend recebe apenas `telefoneMascarado` convertido para o campo visual `telefone`.

## Estados fechados

Funcionários utilizam `ativo`, `ferias` ou `inativo`. Escalas utilizam `agendado`, `presente`, `folga`, `falta` ou `cancelado`. Turnos são `Almoço`, `Jantar` e `Integral`; setores são `Salão`, `Cozinha`, `Bar` e `Gestão`.

## Payload de funcionário

A criação aceita `recurso: 'funcionario'`, `nome`, `cargo`, `setor`, `turno`, `telefone`, `status` opcional, `percentualComissao` opcional e `cor` visual validada. A atualização exige `id` e aceita somente os campos permitidos. O contato completo jamais é gravado na coleção pública.

## Payload de escala

A criação e atualização aceitam `recurso: 'escala'`, `funcionarioId`, `data`, `entrada`, `saida`, `intervalo`, `turno` e `status`. O servidor valida data, horário, duração da jornada, intervalo, funcionário pertencente ao restaurante e conflito com outras escalas ativas do mesmo funcionário.

## Permissões

A leitura de equipe é permitida aos papéis operacionais definidos no backend. Mutação de funcionários fica restrita a proprietário e administrador. Escalas ficam restritas a proprietário, administrador e gerente. Comissões são lidas pelos papéis financeiros e de auditoria autorizados. O frontend não decide permissões, não armazena papéis em localStorage e não recebe credenciais privadas.

## Segurança e auditoria

Todas as mutações exigem sessão HttpOnly, contexto de restaurante válido, CSRF, origem autorizada, App Check conforme o ambiente e auditoria operacional. O servidor rejeita recursos desconhecidos, IDs inválidos, estados fora da enumeração, conflitos de escala e vínculos com funcionários inexistentes.
