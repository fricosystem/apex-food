# Contrato global — dados reais do APEX Food

## Fonte de verdade

O **Cloud Firestore**, isolado pelo restaurante ativo, é a única fonte de verdade dos módulos de gestão. O frontend não cria registros de negócio localmente, não usa arrays de demonstração e não persiste dados em `localStorage` ou `sessionStorage`. Toda gravação passa pela API server-side consolidada, que valida sessão, contexto do restaurante, papel, CSRF, origem e App Check conforme o ambiente.

> O estado vazio da interface representa ausência de documentos reais ou falha de consulta; nunca representa dados fictícios.

## Matriz de coleções e recursos

| Módulo | Coleções principais | Recurso da API | Operações |
|---|---|---|---|
| Cardápio | `categoriasCardapio`, `produtosCardapio`, `promocoesCardapio`, `movimentacoesEstoque`, `configuracoesCardapioDigital` | `/api/v1/cardapio` | Leitura, criação, atualização e movimentação de estoque conforme papel. |
| Pedidos | `pedidos`, subcoleções `itens` e `eventos`, `comandas`, `participantes` | `/api/v1/pedidos` e fluxo público consolidado | Criação, status, histórico, estoque transacional e encaminhamento operacional. |
| Salão | `mesas`, `reservas`, `eventosMesas`, `sessoesMesa` | `/api/v1/salao` e `/api/v1/qrcode-mesa` | Mesas, reservas, ocupação, QR, sessões e sincronização operacional. |
| Equipe | `funcionarios`, `dadosPrivadosFuncionarios`, `escalas`, `comissoes` | `/api/v1/equipe` | Funcionários e escalas com mutações autorizadas; comissões somente leitura. |
| Financeiro | `fechamentosCaixa`, `movimentacoesCaixa`, `contasPagar`, `contasReceber`, `relatoriosFinanceiros`, `resumosFinanceiros`, `encaminhamentosCaixa` | `/api/v1/financeiro` | Caixa, movimentações, contas, fechamento, relatórios e fila operacional. |
| Visão Geral | Leitura consolidada das coleções operacionais e financeiras | `/api/v1/operacional?modulo=visao-geral` | Indicadores, séries, comparações e estados por período. |
| Relatórios | Consultas reais dos módulos acima e `avaliacoes` | `/api/v1/operacional?modulo=visao-geral` ou clientes específicos | Relatórios derivados somente de dados retornados pelo servidor. |

## Respostas da API

Toda resposta de listagem deve informar `meta.idRestaurante` e `meta.fonte: 'firestore'` quando a consulta for concluída com sucesso. O frontend só substitui sua memória de tela após verificar essa identificação. Uma resposta inválida ou uma falha remove os dados transitórios da tela e exibe uma mensagem operacional direta, sem inventar registros para preencher cards, tabelas ou gráficos.

Valores monetários persistidos usam inteiros em centavos com sufixo `Centavos`. Datas e timestamps retornados pelo servidor são convertidos para ISO ou para o formato visual somente no controller. Autoria, tenant, segredos, tokens, contatos completos e campos internos nunca fazem parte dos DTOs públicos.

## Regras de gravação

Produtos, categorias, promoções, mesas, reservas, funcionários, escalas, pedidos, movimentações financeiras e contas só podem ser gravados por seus handlers correspondentes. A validação server-side recalcula preços, valida estados, confere pertencimento ao restaurante e registra autoria, versão e timestamps. Operações concorrentes de estoque, reservas, escalas, caixa e pedidos utilizam transação ou idempotência quando previsto no módulo.

As coleções `comissoes`, `relatoriosFinanceiros`, `avaliacoes` e as séries da Visão Geral são somente leitura para a interface. Nenhuma tela pode permitir editar diretamente um valor calculado ou substituir uma agregação real por números digitados no cliente.

## Permissões

O servidor decide os papéis autorizados por recurso. O frontend não armazena papéis nem usa a presença de um botão como mecanismo de segurança. A separação de `dadosPrivadosFuncionarios` é obrigatória, assim como a remoção de `idRestaurante`, autoria e campos internos dos DTOs públicos.

## Critérios de aceite da consolidação

| Critério | Aceite |
|---|---|
| Fonte única | Cada tela consulta sua API same-origin e não injeta dados de negócio locais. |
| Isolamento | Todas as consultas usam o restaurante ativo resolvido pela sessão server-side. |
| Segurança | Nenhum Firebase client, segredo, token, localStorage ou sessionStorage no frontend operacional. |
| Consistência | Visão Geral e Relatórios usam os mesmos documentos e estados dos módulos de origem. |
| Valores | Preços, estoque, caixa e comissões são derivados dos campos persistidos e validados no servidor. |
| Falhas | Erros geram estados vazios ou mensagens profissionais, nunca dados de preenchimento. |
| Implantação | A API continua com quatro funções em `api/v1`; nenhum arquivo novo é criado nessa pasta. |
