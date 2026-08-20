# Plano de Transformação do APEX Food em Sistema Real

**Projeto:** APEX Food

**Autor:** Manus AI

**Ambiente atual:** Development na Vercel, domínio `apexfood.vercel.app`

**Arquitetura preservada:** HTML estático, shell único em `index.html`, fragmentos individuais carregados no corpo, API server-side na Vercel e Firebase Admin SDK no backend.

## 1. Objetivo geral

Transformar incrementalmente o APEX Food em um sistema operacional real para gestão de restaurantes, eliminando dados fictícios, conectando todas as páginas ao backend seguro e ao Cloud Firestore, ativando todos os botões, inputs, dropdowns, filtros, modais, formulários e ações de navegação e garantindo que cada tela tenha finalidade coerente com os processos do restaurante.

Nenhuma funcionalidade existente será removida sem substituição validada. O trabalho será incremental, preservando a identidade visual escura com destaque laranja, o shell único, o sidebar, o header, a responsividade e a organização atual dos arquivos.

## 2. Princípios obrigatórios

| Princípio | Aplicação no desenvolvimento |
|---|---|
| Dados reais | Nenhuma página poderá apresentar números, nomes, pedidos, mesas, funcionários ou movimentações fictícias como se fossem dados reais. Quando uma coleção estiver vazia, a tela exibirá estado vazio orientativo. |
| Backend seguro | O frontend não acessará diretamente credenciais administrativas, segredos, tokens persistentes ou o Firebase Admin SDK. As operações passarão pela API server-side da Vercel. |
| Multi-tenant | Toda leitura e mutação será limitada ao restaurante ativo e ao contexto autenticado do usuário. Nenhuma rota poderá aceitar livremente um identificador de restaurante enviado pelo cliente. |
| Português | Coleções, subcoleções, campos, enums, mensagens, estados operacionais e documentação de negócio permanecerão em português. |
| Integridade | Operações que alteram mais de um recurso usarão transação ou mecanismo idempotente apropriado, com autoria, data e auditoria. |
| Estados explícitos | Toda página terá estados de carregamento, vazio, sucesso, erro, sem permissão e indisponibilidade temporária quando aplicável. |
| Compatibilidade | URLs antigas permanecerão redirecionadas durante a transição; novas rotas usarão somente o padrão público profissional. |
| Aprovação sequencial | Ao finalizar cada fase, o trabalho será interrompido e será solicitada autorização explícita antes da fase seguinte. |

## 3. Pré-fase concluída — URLs profissionais

Antes da Fase 1, a navegação foi migrada para History API e URLs no formato `/nomedapagina`. O endereço público não utiliza mais `/paginas/`, `.html` ou `/#/nomedapagina`.

Exemplos oficiais: `/`, `/autenticacao`, `/operacional`, `/novo-pedido`, `/produtos`, `/mapa-mesas` e `/relatorios-financeiros`.

A estrutura física foi preservada: os fragmentos continuam dentro de `paginas/`, e o shell continua em `index.html`. A Vercel utiliza regras internas para servir o shell e a autenticação sem expor a pasta física. URLs antigas recebem redirecionamentos permanentes para a forma canônica. A cópia standalone legada do Mapa de Mesas foi mantida dentro de `paginas/salao/` para evitar conflito com a rota pública `/mapa-mesas`.

A migração foi publicada nos commits [`7f5e2d3`](https://github.com/fricosystem/apex-food/commit/7f5e2d30f4b5f013e2048ddb08b3ce560c38cf15), [`55f5041`](https://github.com/fricosystem/apex-food/commit/55f504176ac07df7a1f028c8949854b03f3f86d1) e [`5727de7`](https://github.com/fricosystem/apex-food/commit/5727de7c0201a7bbab639a0310c13d58e1222e97). O deployment final ficou Ready e o smoke test confirmou HTTP 200 nas rotas públicas principais, redirects legados, History API, guard de sessão e ausência de `/paginas/paginas/autenticacao`.

A configuração segue a orientação oficial da Vercel para `cleanUrls`, rewrites e rotas internas sem extensão.[1] [2] [3]

## 4. Fase 1 — Inventário de realidade funcional

### Objetivo

Mapear todas as 27 rotas, páginas físicas, scripts, estilos, componentes de interface, endpoints, dados locais, exemplos estáticos e controles existentes para separar o que já é funcional, o que é parcialmente funcional, o que é fictício e o que está apenas representado visualmente.

### Atividades

Será criado um inventário página a página contendo cards, gráficos, tabelas, modais, botões, inputs, selects, filtros, tabs, menus, ações de edição, exclusão, confirmação, exportação, impressão, busca, paginação e links. Cada controle será associado ao evento esperado, ao endpoint necessário, à coleção do Firestore e ao estado visual correspondente.

Também serão identificados arrays estáticos, números hard-coded, nomes de clientes fictícios, datas de exemplo, placeholders apresentados como valores, gráficos sem fonte real, funções vazias, listeners ausentes, handlers que apenas exibem aviso e ações que não persistem alterações.

### Entregáveis

Será produzido um inventário em Markdown com uma matriz de cobertura por rota e uma lista priorizada de pendências. A Fase 1 não alterará dados de produção nem criará registros fictícios no Firestore.

### Critérios de aceite

A fase será considerada concluída quando todas as rotas tiverem sido classificadas, todos os controles interativos estiverem catalogados, todos os dados fictícios estiverem identificados e cada pendência tiver uma fase de correção definida.

## 5. Fase 2 — Modelo Firestore e contratos de API

### Objetivo

Consolidar o modelo multi-tenant e os contratos server-side antes de conectar telas, evitando que cada módulo crie campos ou regras incompatíveis.

### Coleções e campos-base em português

A estrutura deverá manter os dados organizados por restaurante e limitar o acesso ao contexto autenticado. A definição final será confirmada na fase após o inventário, mas seguirá o mapa conceitual abaixo.

| Coleção | Finalidade | Campos principais previstos |
|---|---|---|
| `restaurantes` | Cadastro e configuração do estabelecimento | `nome`, `nomeFantasia`, `documento`, `email`, `telefone`, `endereco`, `fusoHorario`, `moeda`, `ativo`, `criadoEm`, `atualizadoEm` |
| `membrosRestaurante` | Relação entre usuário e restaurante | `usuarioId`, `restauranteId`, `perfil`, `permissoes`, `status`, `criadoEm`, `atualizadoEm` |
| `categoriasCardapio` | Categorias do cardápio | `restauranteId`, `nome`, `descricao`, `ordem`, `ativo`, `criadoEm`, `atualizadoEm` |
| `produtosCardapio` | Produtos vendidos | `restauranteId`, `categoriaId`, `nome`, `descricao`, `precoCentavos`, `custoCentavos`, `imagemUrl`, `disponivel`, `estoqueControlado`, `criadoEm`, `atualizadoEm` |
| `adicionaisCardapio` | Complementos e opções | `restauranteId`, `nome`, `precoCentavos`, `obrigatorio`, `ativo`, `criadoEm`, `atualizadoEm` |
| `promocoesCardapio` | Regras de promoção | `restauranteId`, `nome`, `tipo`, `valor`, `inicioEm`, `fimEm`, `produtosIds`, `ativo`, `criadoEm`, `atualizadoEm` |
| `mesas` | Mesas e status do salão | `restauranteId`, `numero`, `capacidade`, `localizacao`, `status`, `qrCodeId`, `ativo`, `criadoEm`, `atualizadoEm` |
| `reservas` | Reservas de clientes | `restauranteId`, `mesaId`, `clienteNome`, `clienteContato`, `quantidadePessoas`, `inicioEm`, `fimEm`, `status`, `observacoes`, `criadoEm`, `atualizadoEm` |
| `pedidos` | Pedidos e comandas | `restauranteId`, `mesaId`, `comandaNumero`, `clienteNome`, `status`, `itens`, `subtotalCentavos`, `descontoCentavos`, `taxaCentavos`, `totalCentavos`, `abertoEm`, `fechadoEm`, `criadoPor`, `atualizadoEm` |
| `movimentacoesEstoque` | Entrada, saída e ajuste de estoque | `restauranteId`, `produtoId`, `tipo`, `quantidade`, `unidade`, `motivo`, `referenciaId`, `criadoPor`, `criadoEm` |
| `funcionarios` | Funcionários do restaurante | `restauranteId`, `usuarioId`, `nome`, `email`, `telefone`, `cargo`, `status`, `dataAdmissao`, `criadoEm`, `atualizadoEm` |
| `escalasTrabalho` | Turnos e escalas | `restauranteId`, `funcionarioId`, `data`, `inicio`, `fim`, `status`, `observacoes`, `criadoEm`, `atualizadoEm` |
| `comissoes` | Comissões por período e funcionário | `restauranteId`, `funcionarioId`, `periodoInicio`, `periodoFim`, `baseCentavos`, `percentual`, `valorCentavos`, `status`, `criadoEm`, `atualizadoEm` |
| `movimentacoesFinanceiras` | Entradas e saídas | `restauranteId`, `tipo`, `categoria`, `descricao`, `valorCentavos`, `dataMovimento`, `formaPagamento`, `pedidoId`, `criadoPor`, `criadoEm` |
| `contasFinanceiras` | Contas a pagar e receber | `restauranteId`, `tipo`, `fornecedorOuCliente`, `descricao`, `valorCentavos`, `vencimentoEm`, `status`, `pagoEm`, `criadoEm`, `atualizadoEm` |
| `fechamentosCaixa` | Fechamento de caixa | `restauranteId`, `caixaId`, `abertoEm`, `fechadoEm`, `saldoInicialCentavos`, `entradasCentavos`, `saidasCentavos`, `saldoFinalCentavos`, `status`, `fechadoPor` |
| `auditoria` | Rastro de alterações sensíveis | `restauranteId`, `usuarioId`, `acao`, `entidade`, `entidadeId`, `antes`, `depois`, `criadoEm`, `requestId` |

A modelagem final será compatibilizada com as regras deny-by-default já existentes e com a orientação do modelo de dados do Firestore.[4]

### Critérios de aceite

Nenhum módulo será integrado com contrato informal. Cada operação terá método HTTP, payload, resposta, validação, autorização, paginação, ordenação, tratamento de erro e requisito de auditoria definidos.

## 6. Fase 3 — Autenticação, restaurante ativo e dados-base

Será consolidado o fluxo de sessão Firebase Session Cookie, seleção do restaurante ativo, criação e troca de contexto, carregamento do perfil e permissões e proteção de rotas. O frontend continuará sem localStorage para sessão ou dados sensíveis.

Será criado o fluxo inicial para que um usuário autenticado possa visualizar seu restaurante, completar os dados cadastrais e configurar o estabelecimento antes de usar os módulos. A interface deverá informar claramente quando o usuário ainda não possui restaurante, quando não possui permissão ou quando o restaurante está incompleto.

## 7. Fase 4 — Visão Geral e filtros

A Visão Geral deixará de usar métricas fictícias e passará a consultar agregações reais da API. Os filtros de dia, semana, mês, ano e período personalizado terão datas normalizadas pelo fuso do restaurante e serão aplicados aos cards, gráficos, vendas, ticket médio, ocupação, pedidos e indicadores correspondentes.

Quando não houver dados no período, os gráficos apresentarão estado vazio com orientação para registrar pedidos, sem inventar séries ou totais.

## 8. Fase 5 — Cardápio e estoque

Categorias, produtos, adicionais, promoções, disponibilidade, preços, custos, imagens, busca, filtros e ordenação serão persistidos no Firestore por meio da API. Toda alteração deverá atualizar a interface, validar valores monetários em centavos e registrar auditoria quando necessário.

Estoque não será inferido por valores visuais. Entradas, saídas, ajustes e indisponibilidade de produtos dependerão de movimentações persistidas e regras claras de unidade, quantidade e motivo.

## 9. Fase 6 — Pedidos e cozinha

O fluxo de Novo Pedido será conectado a mesas, comandas, produtos e adicionais reais. O sistema deverá permitir abertura, inclusão e remoção de itens, alteração de quantidade, aplicação de desconto autorizado, envio para cozinha, mudança de status, cancelamento justificado, fechamento e associação ao pagamento.

Pedidos Ativos, Histórico e Fila da Cozinha usarão a mesma fonte de dados e deverão refletir mudanças sem estados paralelos inconsistentes. A transição de status será validada no backend e registrada na auditoria quando for sensível.

## 10. Fase 7 — Salão e reservas

Mesas, status, capacidade, localização, reservas, QR Codes e mapa serão integrados. O clique em uma mesa abrirá detalhes reais, incluindo ocupação, comanda, reserva, horário e ações permitidas pelo perfil.

A agenda de reservas terá validação de conflito, status controlados, horário no fuso do restaurante e histórico de alterações. A configuração de mesas deverá persistir criação, edição, inativação e QR Code sem excluir histórico operacional.

## 11. Fase 8 — Equipe e permissões

Funcionários, cargos, permissões, escalas e comissões serão ligados ao usuário autenticado e ao restaurante. A UI deverá impedir ações não autorizadas, e o backend deverá repetir toda autorização independentemente do controle visual.

Escalas terão conflito de horário, status e histórico. Comissões serão calculadas a partir de pedidos elegíveis e regras persistidas, sem valores fixos na interface.

## 12. Fase 9 — Financeiro

Fluxo de Caixa, Contas a Pagar/Receber, Fechamento de Caixa, Dashboard Financeiro e Relatórios Financeiros consultarão movimentações reais, pedidos fechados, formas de pagamento, vencimentos e fechamentos.

Os cálculos serão feitos no backend com valores inteiros em centavos. Fechamentos serão idempotentes e não poderão ser alterados sem permissão e auditoria. Relatórios deverão declarar o período, fuso, filtros e fonte dos valores apresentados.

## 13. Fase 10 — Controles, estados e eliminação de ficção

Depois da integração por módulos, será feita uma varredura funcional completa. Cada botão deverá executar uma ação real ou ser removido/desabilitado com explicação clara; cada input deverá validar e persistir ou participar de uma busca/filtro funcional; cada dropdown deverá possuir opções provenientes de domínio real; cada modal deverá ter confirmação, cancelamento e tratamento de erro; e cada gráfico deverá exibir fonte de dados e estado vazio.

Nenhum texto como “preparado para próxima integração”, número de exemplo ou lista fictícia poderá permanecer em uma tela de produção. Dados de demonstração, se necessários para testes automatizados, ficarão isolados em fixtures de teste e nunca serão carregados no ambiente Development real.

## 14. Fase 11 — Testes e regressão

Serão executados testes unitários de validação e autorização, testes de contrato de API, testes de integração com Firestore usando ambiente controlado, testes funcionais de navegação, testes de estados vazios, testes de erro, testes de concorrência nas operações críticas e smoke tests remotos.

A matriz final deverá cobrir todas as 27 rotas e os principais fluxos: cadastro, login, troca de restaurante, criação de produto, abertura de pedido, envio à cozinha, ocupação de mesa, reserva, funcionário, escala, movimentação financeira e fechamento de caixa.

A segurança será revisada contra exposição de credenciais, localStorage, XSS, CSRF, acesso cruzado entre restaurantes, enumeração de recursos, ausência de autorização no backend e mutações sem auditoria.

## 15. Fase 12 — Publicação e operação

Cada fase será publicada em commit próprio ou grupo pequeno de commits, com testes aprovados antes do push. O deployment será acompanhado até Ready e validado em `apexfood.vercel.app` antes da aprovação da fase seguinte.

Será mantida documentação operacional com configuração de ambiente, coleções, campos, índices, permissões, fluxos de restauração, procedimentos de suporte, limites conhecidos e checklist de publicação. O ambiente continuará em Development conforme solicitado, sem habilitar produção definitiva ou domínio próprio.

## 16. Regra de aprovação entre fases

A execução seguirá uma pausa formal. Ao terminar cada fase, será entregue um resumo do que foi implementado, os arquivos alterados, os testes executados, os riscos remanescentes e os critérios de aceite. Em seguida, será feita a pergunta explícita: **“A fase foi concluída. Posso iniciar a próxima fase?”**

Nenhuma fase posterior será iniciada sem a confirmação do usuário. A única exceção é a pré-fase de URLs, solicitada expressamente antes da Fase 1 e já concluída.

## Referências

[1]: https://vercel.com/docs/project-configuration/vercel-json "Vercel — Static Configuration with vercel.json"

[2]: https://vercel.com/docs/routing/rewrites "Vercel — Rewrites on Vercel"

[3]: https://vercel.com/docs/routing/redirects "Vercel — Redirects"

[4]: https://firebase.google.com/docs/firestore/manage-data/structure-data "Firebase — Cloud Firestore data model"
