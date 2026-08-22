# Modelo Firestore Multiestabelecimentos — APEX Food

**Versão do contrato:** 2.0.0  
**Ambiente:** development  
**Projeto Firebase:** `apex-food-6c1cb`  
**Status:** contrato documental; nenhuma coleção ou documento novo foi criado nesta fase.  
**Acesso:** API server-side com Firebase Admin SDK; Firestore direto pelo navegador continua bloqueado.

## 1. Princípios do modelo

O APEX Food adotará isolamento lógico por `idRestaurante`. Todo dado operacional deverá pertencer a um estabelecimento, e toda requisição autenticada deverá resolver uma identidade com dois possíveis escopos: global, exclusivo do Desenvolvedor; ou operacional, limitado a um estabelecimento e às permissões do membro ativo.

Os nomes de coleções e campos novos permanecem em português. IDs serão opacos e não conterão CNPJ, CPF, email ou nome. CNPJ e CPF terão uma versão normalizada para unicidade e uma versão mascarada para exibição. O documento completo será tratado como dado pessoal e não será colocado em logs, claims, URLs ou DTOs sem necessidade.

Senhas não pertencem ao Firestore. O Firebase Authentication será a fonte de credenciais; `usuarios` guardará apenas o perfil e os vínculos necessários para autorização. Timestamps de negócio serão gravados com timestamp do servidor e exibidos no fuso configurado do estabelecimento. Valores financeiros continuarão em centavos inteiros quando aplicável.

## 2. Coleções raiz

| Coleção | Documento | Campos obrigatórios ou controlados | Observações |
|---|---|---|---|
| `usuarios` | `{idUsuario}` | `idUsuario`, `emailCanonico`, `nomeExibicao`, `nomeCompleto`, `cpfNormalizado`, `telefoneWhatsapp`, `tipoConta`, `estado`, `idRestaurantePadrao`, `acessoGlobal`, `papeisGlobais`, `criadoEm`, `atualizadoEm`, `ultimoLoginEm`, `versao` | Nunca armazenar `senha`, token, cookie ou chave. Campos pessoais devem ser minimizados e protegidos no backend. |
| `restaurantes` | `{idRestaurante}` | `idRestaurante`, `nome`, `tipoDocumento`, `documentoNormalizado`, `documentoMascarado`, `estado`, `idDiretor`, `idCriadoPor`, `planoAtual`, `periodoTeste`, `limites`, `excecoesAtivas`, `fusoHorario`, `localidade`, `moeda`, `criadoEm`, `atualizadoEm`, `versao` | Documento principal do estabelecimento e fonte do estado comercial. |
| `indicesDocumentosEstabelecimentos` | `{tipoDocumento}_{documentoNormalizado}` | `tipoDocumento`, `documentoNormalizado`, `idRestaurante`, `estado`, `criadoEm`, `atualizadoEm` | Reserva de unicidade para CNPJ/CPF. Criado e atualizado somente dentro de transação. |
| `provisionamentosEstabelecimentos` | `{idProvisionamento}` | `idProvisionamento`, `chaveIdempotencia`, `etapaAtual`, `estado`, `idCriadoPor`, `idRestauranteCriado`, `idDiretorCriado`, `dadosEstabelecimentoValidados`, `dadosDiretorValidados`, `emailDiretorCanonico`, `expiraEm`, `tentativas`, `ultimoErroPublico`, `criadoEm`, `atualizadoEm`, `versao` | Draft server-side do wizard. Nunca guardar senha, token Firebase ou payload bruto. O ID é derivado da identidade e da chave de operação. |
| `resumosEstabelecimentos` | `{idRestaurante}` | `idRestaurante`, `estado`, `planoAtual`, `usuariosAtivos`, `pedidosPeriodo`, `faturamentoPeriodoCentavos`, `ticketMedioCentavos`, `avaliacaoMedia`, `ultimaAtividadeEm`, `atualizadoEm`, `versao` | Rollup para Dashboard Desenvolvedor. Não substitui dados operacionais nem deve ser atualizado pelo frontend. |
| `registrosAuditoriaGlobais` | automático | `idAtor`, `tipoAtor`, `acao`, `tipoRecurso`, `idRecurso`, `idRestaurante`, `resultado`, `motivo`, `idOperacao`, `idRequisicao`, `criadoEm`, `versaoEstruturaAuditoria` | Somente acréscimo. Não registrar senha, token, CPF completo, CNPJ completo ou payload bruto. |

### 2.1 Campos de `usuarios`

`tipoConta` terá os valores controlados `desenvolvedor`, `diretor`, `colaborador` ou `sistema`. `estado` terá `ativo`, `pendente_verificacao`, `suspenso`, `desativado` ou `excluido`. `acessoGlobal` terá `nenhum` ou `desenvolvedor`; `papeisGlobais` será uma lista pequena e controlada, normalmente vazia ou contendo `desenvolvedor`.

`cpfNormalizado` e `telefoneWhatsapp` serão preenchidos somente quando necessários ao perfil do usuário. O endereço completo do Diretor será gravado em `dadosPrivados.endereco`, com leitura limitada ao backend autorizado e fora dos DTOs comuns. A decisão final de manter o endereço no próprio documento ou em subdocumento privado deverá respeitar o princípio de menor exposição do DTO.

### 2.2 Campos de `restaurantes`

`tipoDocumento` será `cnpj` ou `cpf`. `documentoNormalizado` será armazenado somente com dígitos e servirá para a chave de unicidade. `documentoMascarado` será a única forma normalmente devolvida à interface. `estado` terá `rascunho`, `em_teste`, `ativo`, `suspenso`, `desativado` ou `encerrado`.

`planoAtual` será um objeto controlado com `codigoPlano`, `nomePlano`, `inicioEm`, `fimEm`, `origem`, `estado` e `versao`. `periodoTeste` conterá `inicioEm`, `fimEm`, `diasConcedidos`, `concedidoPor` e `motivo`. `limites` conterá apenas chaves de produto conhecidas, por exemplo `usuariosAtivos`, `mesas`, `produtosCardapio`, `pedidosMensais` e `armazenamentoMb`. `excecoesAtivas` será uma referência resumida; cada exceção completa terá seu próprio registro auditável.

## 3. Subcoleções por estabelecimento

| Caminho | Campos principais | Estados ou regras |
|---|---|---|
| `restaurantes/{idRestaurante}/membros/{idUsuario}` | `idUsuario`, `idRestaurante`, `papeis`, `papelPrincipal`, `permissoesDiretas`, `escopos`, `estado`, `entrouEm`, `convidadoPor`, `criadoEm`, `atualizadoEm`, `versao` | `convite_pendente`, `ativo`, `suspenso`, `removido`. `idRestaurante` e `idUsuario` são imutáveis. |
| `restaurantes/{idRestaurante}/papeis/{idPapel}` | `codigo`, `nome`, `descricao`, `permissoes`, `sistema`, `estado`, `criadoPor`, `atualizadoPor`, `criadoEm`, `atualizadoEm`, `versao` | Papéis nativos não podem ser excluídos; podem ser desativados somente com substituição segura. |
| `restaurantes/{idRestaurante}/catalogoPermissoes/{codigo}` | `codigo`, `nome`, `modulo`, `acao`, `sensibilidade`, `estado`, `versao` | Catálogo fechado pelo sistema. O Diretor pode atribuir permissões existentes, não inventar códigos arbitrários. |
| `restaurantes/{idRestaurante}/planos/{idPlano}` | `codigoPlano`, `nomePlano`, `inicioEm`, `fimEm`, `estado`, `limites`, `origem`, `motivo`, `criadoPor`, `criadoEm` | `agendado`, `ativo`, `expirado`, `cancelado`. Histórico somente acréscimo após ativação. |
| `restaurantes/{idRestaurante}/excecoesLimites/{idExcecao}` | `recurso`, `limiteAnterior`, `limiteNovo`, `inicioEm`, `fimEm`, `estado`, `motivo`, `criadoPor`, `criadoEm`, `revogadoPor`, `revogadoEm` | `agendada`, `ativa`, `expirada`, `revogada`. Toda exceção precisa de validade. |
| `restaurantes/{idRestaurante}/metricasDiarias/{aaaa-mm-dd}` | contadores operacionais, financeiros agregados e `atualizadoEm` | Chave temporal UTC do estabelecimento; sem dados pessoais ou itens de pedido completos. |
| `restaurantes/{idRestaurante}/historicoAdministrativo/{idRegistro}` | ação, recurso, antes/depois resumido, motivo, ator e timestamps | Somente acréscimo; detalhes sensíveis devem ser mascarados. |
| `restaurantes/{idRestaurante}/convites/{idConvite}` | `emailCanonico`, `tipoPapel`, `papeis`, `estado`, `expiraEm`, `criadoPor`, `aceitoPor`, timestamps | Preparado para futura gestão de colaboradores pelo Diretor; não será ativado antes da fase correspondente. |

As subcoleções operacionais existentes — como `categoriasCardapio`, `produtosCardapio`, `promocoesCardapio`, `mesas`, `reservas`, `funcionarios`, `escalas`, `comandas`, `pedidos`, `fichasCozinha`, `tarefas`, `encaminhamentosCaixa`, `avaliacoes`, `notificacoes` e coleções auxiliares — serão preservadas. O novo contrato adicionará apenas campos de controle necessários e não reescreverá pedidos históricos.

## 4. Papéis nativos e compatibilidade

O catálogo inicial deverá manter compatibilidade com `proprietario`, `administrador`, `gerente`, `financeiro`, `caixa`, `cozinha`, `garcom`, `analista` e `auditor`, além de introduzir a apresentação profissional `diretor`, `porteiro` e `cozinheiro`. O código legado `cozinha` continuará aceito durante a migração para não quebrar a distribuição de tarefas e especialidades.

O papel global `desenvolvedor` não será armazenado como simples papel de membro de um restaurante. Ele será uma autorização global separada, validada pelo UID Firebase configurado no backend. O Diretor poderá criar papéis locais e atribuir permissões do catálogo, mas não poderá criar, editar ou atribuir `desenvolvedor`.

## 5. Estados e invariantes

O provisionamento seguirá a máquina `rascunho → em_processamento → concluido`. Falhas recuperáveis usarão `erro_reconciliacao`; cancelamentos usarão `cancelado` e drafts vencidos usarão `expirado`. Um provisionamento concluído não poderá ser processado novamente sem uma operação explícita de reconciliação.

Um estabelecimento deverá ter exatamente um documento de índice ativo para seu CNPJ ou CPF, um `idDiretor` principal e nenhum documento fiscal duplicado. A criação do estabelecimento, do índice, do Diretor no Firestore, do membro e do plano inicial deverá ser idempotente por `idProvisionamento` determinístico e `chaveIdempotencia` vinculada ao ator. A criação do usuário no Firebase Authentication será tratada em saga separada, porque Auth e Firestore não compartilham uma transação única.

O `idRestaurante` não poderá ser alterado depois de criado. O estado `desativado` bloqueará novos acessos administrativos e, conforme a política comercial aprovada, novos atendimentos QR, mas preservará histórico. O estado `encerrado` será irreversível no fluxo comum e exigirá operação do Desenvolvedor com auditoria.

## 6. Índices e consultas

O índice de unicidade de documento fiscal será resolvido pelo ID determinístico `tipoDocumento_documentoNormalizado`, com transação que verifica conflito antes de criar ou atualizar. Não haverá consulta que dependa apenas de dados digitados no frontend.

Consultas previstas para a implementação deverão ser documentadas antes da criação de índices compostos. Entre elas estão a listagem de membros por `idUsuario` via collection group, listagem de estabelecimentos por `estado` e plano, provisionamentos por `estado` e `expiraEm`, resumos por estado/plano/última atividade e métricas por período. Índices serão adicionados somente quando necessários e validados contra o limite e o custo de leitura.

As regras do Firestore permanecerão `deny-by-default`, pois o navegador não terá acesso direto às coleções. O backend usará Admin SDK, o que exige autorização própria e controle IAM, além de testes de isolamento entre estabelecimentos. Regras Firestore específicas e testes do Emulator poderão ser adicionados em fase de hardening caso a arquitetura passe a permitir algum acesso direto controlado. [1]

## 7. Compatibilidade com os dados atuais

O primeiro estabelecimento existente não será duplicado. Seu documento manterá o `idRestaurante`, o membro atual e os papéis já reconhecidos. A migração somente acrescentará `tipoConta` aos perfis, normalizará aliases e registrará inconsistências em relatório.

Usuários atuais serão classificados como `diretor` apenas após regra explícita de negócio, e não por inferência superficial de email. O usuário proprietário atual poderá ser mapeado para Diretor do estabelecimento existente se o proprietário confirmar essa política. O email do Desenvolvedor será tratado separadamente e exigirá UID aprovado.

Nenhum snapshot histórico de pedido com dados legados será apagado ou alterado. Dados de teste já removidos não serão reintroduzidos no contrato. Documentos sem `idRestaurante`, membros órfãos, restaurantes sem membro ativo, índices fiscais conflitantes e papéis desconhecidos deverão aparecer em relatório de migração antes de qualquer correção automática.

## 8. Próxima fase

A Fase 3 deverá implementar a identidade global do Desenvolvedor, a resolução separada de identidade global e operacional, a evolução de `/api/v1/auth/session` e `/api/v1/eu`, a configuração segura do UID e os primeiros testes de acesso negado. A confirmação do email e UID exatos do Desenvolvedor será obrigatória antes de conceder o menu ou qualquer handler global.

## Referências oficiais

[1]: https://firebase.google.com/docs/firestore/security/rules-structure "Firebase — Structuring Cloud Firestore Security Rules"

[2]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase — Control Access with Custom Claims and Security Rules"

[3]: https://firebase.google.com/docs/auth/admin "Firebase — Introduction to the Admin Auth API"
