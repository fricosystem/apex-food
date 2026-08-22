# Auditoria do fluxo da comanda até o caixa

## Reprodução em produção

A rota autenticada `https://apexfood.vercel.app/pedidos-ativos` carregou com a sessão de teste e exibiu quatro pedidos reais em `aguardando_confirmacao_garcom`. Os cards possuem identificação do pedido, mesa, cliente, horário, valor, quantidade de itens e ação visual `Ver detalhes`.

A tela também exibiu as colunas de confirmados, fila da cozinha, em preparo, prontos e servidos, todas sem registros nesta reprodução. O modal de pedido foi incluído no fragmento e aparece inicialmente fechado; a reprodução ainda precisa clicar em cada card para verificar as ações por status.

## Achados preliminares do código

A tela atual de Pedidos Ativos permite abrir detalhes, confirmar pedido, enviar à cozinha, marcar pronto/servido e recusar somente quando o status é `aguardando_confirmacao_garcom`. Não existe uma tela exclusiva para garçons, nem distribuição automática de comanda por carga.

A Fila da Cozinha permite apenas iniciar preparo e marcar como pronto. Não há cadastro de capacidades culinárias, estação, cozinheiro responsável, distribuição por carga ou retorno estruturado ao garçom.

O Fechamento de Caixa lista somente um resumo do encaminhamento — mesa, garçom, quantidade de pedidos, total e status — e oferece confirmar recebimento ou concluir atendimento. Não existe modal de detalhes completos da comanda nessa tela.

O backend já possui transições QR, histórico de status, ficha de cozinha, encaminhamento ao caixa, idempotência, auditoria e liberação transacional da mesa ao concluir o caixa. Entretanto, a atribuição automática de garçons/cozinheiros, capacidades da equipe e avaliação pós-atendimento ainda não existem.

## Reprodução do defeito de detalhes

Na produção, o primeiro card real foi localizado por `aria-label` e acionado diretamente. O elemento `#modalPedido` permaneceu com `aria-hidden="true"`, sem a classe `aberto`, `opacity: 0` e `pointer-events` inativos. O título e os dados do pedido também não foram hidratados; os botões ficaram no estado inicial, com `Recusar pedido` oculto e `Avançar status` sem contexto.

Esse comportamento confirma o problema relatado: o card aparece na fila, mas o fluxo de detalhes/atendimento não está abrindo corretamente. A causa exata será isolada na continuação da auditoria, verificando a inicialização do controller, a versão dos assets e os listeners após a hidratação do shell.

## Isolamento da falha de interação

O controller de Pedidos Ativos está carregado em produção e a função global `abrirModalAtivo` existe. Ao chamá-la diretamente com o ID real `2WnL0trjrJoWdEv8hzgV`, o modal abriu corretamente com `aria-hidden="false"`, classe `aberto`, título, resumo e botões `Recusar pedido` e `Confirmar pedido` visíveis.

Por outro lado, o clique sintético no card não alterou o modal. A falha está, portanto, no caminho de interação do card/listener ou na forma como o navegador automatizado alcança o botão, não na montagem do modal em si. A próxima verificação deve capturar o evento de clique e testar o handler com interação confiável antes de alterar o controller.

## Interação do card

A cadeia de pais do card não possui `hidden`, `inert` ou `pointer-events: none`; todos os elementos estão visíveis e interativos. O card não possui propriedade `onclick` direta, pois o controller usa `addEventListener`. O console do navegador não expôs `getEventListeners`, portanto não foi possível inspecionar o callback privado diretamente. A função global funciona quando chamada manualmente, mas o evento disparado sobre o card não a alcança de forma observável.

## Cozinha e caixa em produção

A Fila da Cozinha carregou corretamente, mas sem pedidos na fila nesta reprodução. A interface atual possui três colunas — aguardando preparo, em preparo e prontos — e ações genéricas para iniciar preparo e marcar como pronto. Não há seleção de cozinheiro, capacidade, estação, reatribuição ou indicador de responsável.

O Fechamento de Caixa carregou sem caixa aberto e sem encaminhamentos na base consultada. A seção do caixa exibe apenas um resumo de cada encaminhamento e oferece confirmar recebimento ou concluir atendimento. Não há ação para abrir detalhes completos da comanda, consultar todos os itens, revisar histórico, cancelar comanda ou visualizar a avaliação do atendimento.

No backend, a conclusão do caixa já altera a comanda para `encerrada`, libera a mesa para `disponivel`, remove o vínculo da comanda aberta e encerra as sessões da mesa em uma transação. A camada visual, porém, não apresenta o detalhamento necessário para a operação do caixa.
