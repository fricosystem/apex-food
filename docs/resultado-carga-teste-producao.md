# Resultado da carga de teste em produção

## Escopo autorizado

Foi autorizada uma carga de dados de teste na produção do APEX Food para verificar se os formulários, a API server-side, o Firestore e a Visão Geral estavam realmente conectados. Todos os registros receberam o prefixo `TESTE Persistencia 20260821` para permitir identificação e eventual remoção posterior.

A carga foi executada com a sessão autenticada da conta `bruno.bm3051@apexfood.com`, no restaurante ativo `3e20d5b9833ccfa5422d77f4`. Nenhuma credencial foi exposta ou enviada ao navegador por armazenamento local.

## Coleções e contagens confirmadas

| Módulo | Coleção tenant-aware | Registros TESTE confirmados |
|---|---|---:|
| Categorias | `restaurantes/3e20d5b9833ccfa5422d77f4/categoriasCardapio` | 10 |
| Produtos | `restaurantes/3e20d5b9833ccfa5422d77f4/produtosCardapio` | 10 |
| Promoções | `restaurantes/3e20d5b9833ccfa5422d77f4/promocoesCardapio` | 10 |
| Funcionários | `restaurantes/3e20d5b9833ccfa5422d77f4/funcionarios` | 10 |
| Escalas | `restaurantes/3e20d5b9833ccfa5422d77f4/escalas` | 10 |
| Mesas | `restaurantes/3e20d5b9833ccfa5422d77f4/mesas` | 10 |
| Reservas | `restaurantes/3e20d5b9833ccfa5422d77f4/reservas` | 10 |
| Contas financeiras | `restaurantes/3e20d5b9833ccfa5422d77f4/contasPagarReceber` | 10 |
| Movimentações financeiras | `restaurantes/3e20d5b9833ccfa5422d77f4/movimentacoesCaixa` | 10 |

## Telas verificadas em produção

A tela de Produtos exibiu os dez itens, dez categorias no filtro, dez produtos disponíveis, estoque baixo igual a zero e preço médio de R$ 42,40. A tela de Funcionários exibiu dez funcionários ativos, com cargos, setores, turnos e contatos mascarados. O Mapa de Mesas exibiu dez mesas disponíveis e dez reservas confirmadas relacionadas aos clientes e aos horários futuros.

As telas financeiras exibiram cinco títulos a pagar no total de R$ 1.515,00, cinco títulos a receber no total de R$ 4.040,00, dez movimentações, entradas de R$ 155,00, saídas de R$ 0,00 e resultado líquido de R$ 155,00.

A Visão Geral confirmou `fonte: firestore`, `dadosDisponiveis: true`, dez mesas, dez produtos e dez funcionários. Depois da correção do agregador, o Dashboard passou a mostrar R$ 155,00 em vendas, mas **zero pedidos operacionais**, pois movimentações financeiras manuais não são pedidos. O ticket médio e os picos permanecem indisponíveis até existirem pedidos reais.

## Correções encontradas durante o teste

| Commit | Correção |
|---|---|
| `a8be0dc` | Corrigida a normalização de nomes de mesas, que removia dígitos e provocava `MESA_DUPLICADA` em nomes distintos. |
| `581ae8a` | Corrigido o roteamento financeiro para aceitar o recurso singular `movimentacao` usado pelo cliente em POST/PATCH. |
| `0506222` | Corrigido o agregador da Visão Geral para não contar movimentações financeiras como pedidos operacionais. |

As correções foram publicadas na branch `main`, cada uma com deployment concluído na Vercel. A última validação local alcançou **309/309 testes**, `SEGREDOS_OK` e quatro funções serverless, preservando o limite do plano Hobby.

## Limpeza futura

Os registros de teste permanecem na produção porque foram criados sob autorização para validar persistência. Eles podem ser removidos por uma operação administrativa segura, filtrando exclusivamente pelo prefixo `TESTE Persistencia 20260821` e confirmando antes da execução. Não deve ser feita exclusão ampla das coleções, pois isso poderia remover dados reais posteriormente cadastrados pelo restaurante.

Até a limpeza, os dados TESTE aparecerão normalmente nas telas de gestão e poderão alimentar os indicadores financeiros. Não foram criados pedidos, avaliações ou fechamentos de caixa, portanto essas áreas continuam corretamente sem dados operacionais correspondentes.
