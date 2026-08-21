# Etapa 16 — Contrato da Visão Geral em tempo real

## Objetivo

Conectar a Visão Geral aos dados reais já armazenados no Cloud Firestore, mantendo a hidratação por um único agregador server-side (`visao-geral`) e a leitura no frontend exclusivamente pelo cliente same-origin. A etapa não deve criar uma nova função em `api/v1/`, não deve consultar o Firestore no navegador e não deve remover nenhum bloco atual da página.

## Fontes tenant-aware

O handler continuará obtendo o restaurante exclusivamente da identidade autenticada e usando `caminhoRestaurante(identidade.idRestaurante)`. As coleções consultadas serão `pedidos`, `movimentacoesCaixa`, `fechamentosCaixa`, `relatoriosFinanceiros`, `mesas`, `reservas`, `produtosCardapio`, `categoriasCardapio`, `funcionarios` e `avaliacoes`. Cada coleção será limitada server-side, filtrada para excluir documentos marcados como excluídos e convertida em DTO sem campos internos.

## Contrato de período

A Visão Geral aceitará `dia`, `semana`, `mes`, `ano` e `personalizado`, com `inicio` e `fim` validados no servidor. O fuso horário continuará vindo do documento do restaurante, com `America/Sao_Paulo` como fallback. O período será aplicado a vendas, pedidos, despesas, reservas, avaliações e séries analíticas; o snapshot atual de mesas, cardápio e equipe permanecerá separado dos indicadores históricos.

## Lacunas identificadas

| Área | Situação atual | Correção prevista |
| --- | --- | --- |
| Despesas e resultado | `relatoriosMensais` usa despesas zero e resultado igual às vendas | Agregar despesas reais de `movimentacoesCaixa` por dia e mês, preservando centavos no backend |
| Categorias financeiras | O agregador retorna `categorias: []` | Reaproveitar categorias de `relatoriosFinanceiros` e normalizar percentuais e valores |
| Avaliações | A distribuição existe, mas a lista de avaliações retorna vazia | Retornar DTOs públicos reais e incluir taxa de resposta nos indicadores |
| Ritmo de atendimento | A interface espera picos de almoço e jantar, mas o resumo não os calcula | Derivar as faixas de maior demanda da série real de pedidos |
| Ordenação mensal | A série é ordenada pelo texto `Jan/Fev/...`, não pela chave cronológica | Ordenar por `AAAA-MM` antes de formatar o rótulo |
| Filtros | O controller local usa séries reais, mas alguns estados vazios não distinguem erro de ausência | Manter estados profissionais e refletir o período retornado pelo servidor |
| Atualização | O shell carrega a ponte com versão antiga | Versionar ponte, controller da Home e shell com identificador da Etapa 16 |

## Regras de segurança

A API continuará exigindo sessão autenticada, origem autorizada e App Check conforme o contrato do endpoint operacional. Nenhuma identidade, restaurante, credencial, token ou consulta Firestore será aceita ou executada pelo frontend. Os DTOs deverão conter apenas dados necessários à Visão Geral, sem autoria interna, tokens ou documentos brutos.

## Critérios de aceite

1. Os filtros de período acionam uma nova consulta server-side e exibem o período efetivamente retornado.
2. Vendas, pedidos, despesas, resultado, categorias, reservas e avaliações usam dados reais do restaurante ativo.
3. A Visão Geral não carrega bridges paralelas nem dados fictícios.
4. Um restaurante nunca pode ser escolhido pelo payload ou pela URL do navegador.
5. Os estados sem registros continuam usando mensagens diretas, como “Nenhum pedido real encontrado no período”, sem dizer que o sistema está em desenvolvimento.
6. A rota continua dentro do shell único e todos os assets alterados recebem cache-busting da Etapa 16.
7. A suíte existente e os novos contratos da etapa passam integralmente, com scanner de segredos e sem criação de novo arquivo em `api/v1/`; o total físico atual permanece em 12 arquivos, dentro do limite de 12 funções do plano Hobby.
