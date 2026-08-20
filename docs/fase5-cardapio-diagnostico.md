# Diagnóstico da Fase 5 — Cardápio e Estoque

A Fase 5 será executada sobre o módulo existente, sem criar um novo shell ou refazer as páginas.

| Área | Estado encontrado | Próxima correção |
|---|---|---|
| Categorias | Leitura remota pelo bridge e criação remota já existentes; edição ainda mostra aviso de integração futura | Completar atualização real e estados de carregamento/erro |
| Produtos | Leitura, criação e alternância de disponibilidade já usam a API quando o contexto remoto está ativo | Completar campos de custo, estoque, unidade e tempo de preparo; implementar edição real e remover exportação fictícia |
| Promoções | Dados e submit ainda operam em preview local; edição também é placeholder | Criar contrato server-side e conectar listagem, criação, atualização, filtro e estados vazios |
| Estoque | O produto possui estoque numérico, mas não há movimentações persistidas na interface | Implementar entrada, saída e ajuste em `movimentacoesEstoque`, com auditoria e atualização consistente do produto |
| Backend Cardápio | Existe handler seguro para categorias e produtos, mas a leitura precisa usar as coleções canônicas `categoriasCardapio` e `produtosCardapio`; promoções e movimentações ainda não estão cobertas pelo recorte atual | Corrigir coleções e expandir os recursos com validação, autorização, transação quando necessário e auditoria |
| Segurança | Cliente usa same-origin, CSRF e sessão HttpOnly; o frontend não acessa Firebase Admin | Preservar o padrão e não introduzir dados no localStorage |

O critério de aceite da fase será que Categorias, Produtos, Promoções e o estoque apresentem apenas dados reais do restaurante ativo, com estados vazios orientativos quando as coleções estiverem vazias, sem mensagens de preview para operações que deveriam persistir.
