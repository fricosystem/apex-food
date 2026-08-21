# Fase 3 — Integração global sem fixtures

## Resultado

Os módulos de Pedidos, Equipe e Financeiro deixaram de inserir registros demonstrativos em ambiente local. Todos iniciam com estado vazio e substituem a memória da tela somente após uma resposta válida da API same-origin, com `meta.idRestaurante` confirmado pelo servidor.

## Alterações por módulo

| Módulo | Alteração | Fonte real |
|---|---|---|
| Pedidos | Remoção de categorias, produtos, pedidos ativos e histórico fictícios; preservação do mapa de estados e dos adaptadores de valores; leitura combinada de pedidos, cardápio, mesas e funcionários | `listarPedidos`, `listarCardapio`, `listarSalao('mesas')` e `listarEquipe('funcionarios')` |
| Equipe | Bridge reescrito para estado vazio, leitura de funcionários, escalas e comissões, DTOs públicos adaptados, polling com backoff e encerramento de timer | `listarEquipe()` |
| Financeiro | Remoção de caixa, recebimentos, fluxo, contas e relatórios fictícios; estado vazio até a resposta real e limpeza em falha | `listarFinanceiro()` |
| Escala | Select de funcionário sem opções fixas; opções são preenchidas pelos funcionários retornados pelo Firestore | Coleção `funcionarios` |
| Shell | Assets de Pedidos, Equipe e Financeiro versionados com `etapa22-dados-reais-global`; versões específicas do Salão e demais módulos não alterados foram preservadas | `index.html` e `scripts/shell/apex-shell.js` |

## Segurança preservada

Nenhuma credencial, chave privada, token, Firebase client, `localStorage` ou `sessionStorage` foi adicionado ao frontend. A persistência continua passando pelos handlers server-side, com sessão HttpOnly, contexto do restaurante, CSRF, validação de payload, autorização, auditoria e transações quando aplicável.

Comissões permanecem somente leitura. O bridge da Equipe não expõe contatos completos: quando o backend não fornece o campo visual, a interface utiliza `Contato restrito` em vez de inventar um endereço ou telefone.

## Critérios de aceite

| Critério | Resultado |
|---|---|
| Fixtures locais em Pedidos, Equipe e Financeiro | Removidas |
| Estado sem sessão ou sem documentos | Vazio, sem preenchimento fictício |
| Consulta real | Validada por `meta.idRestaurante` |
| Funcionário na Escala | Nenhum funcionário fixo no HTML |
| Atualização da Equipe | Polling com backoff, jitter e encerramento no unload |
| Funções serverless | Quatro, sem novos arquivos em `api/v1` |
| Testes | 300/300 aprovados |
