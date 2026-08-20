# Etapa 9 — Auditoria e recorte seguro de Cardápio e Salão

**Projeto:** APEX Food  
**Ambiente:** Development na Vercel  
**Status:** Fase de auditoria concluída; implementação dos endpoints server-side aguardando esta definição de escopo  
**Princípio:** adicionar integração incrementalmente, sem refazer o sistema, sem alterar o shell único, sem duplicar sidebar/header e sem modificar a identidade visual existente.

## 1. Objetivo da auditoria

A Etapa 9 foi aprovada para iniciar a migração dos módulos de menor risco estrutural: **Cardápio** e **Salão**. A auditoria verificou as páginas fragmentadas, os scripts atuais, os dados simulados, as rotas do shell, os contratos multi-tenant já documentados e os utilitários server-side de sessão, contexto, autorização, CSRF e auditoria.

O resultado confirma que as páginas atuais são adequadas para uma migração por adaptador. A interface já possui filtros, indicadores, tabelas, grids, modais e estados vazios; entretanto, as fontes de dados ainda são objetos globais locais e as ações de gravação exibem mensagens de preview. A Etapa 9 substituirá progressivamente essa fonte local por chamadas same-origin à API, mantendo os mesmos IDs, eventos visuais, modais, mensagens e estrutura de fragmentos.

## 2. Inventário funcional auditado

| Área | Páginas existentes | Fonte atual | Estado da integração | Prioridade |
|---|---|---|---|---|
| Categorias | `paginas/cardapio/categorias.html` | `window.dadosCardapioApexFood.categorias` | Leitura e busca locais; criação/edição simuladas | Alta |
| Produtos | `paginas/cardapio/produtos.html` | `window.dadosCardapioApexFood.produtos` | Filtros, indicadores e disponibilidade locais; criação/edição simuladas | Alta |
| Promoções | `paginas/cardapio/promocoes.html` | `window.dadosCardapioApexFood.promocoes` | Filtro e ordenação locais; criação/edição simuladas | Média |
| Cardápio Digital | `paginas/cardapio/cardapio-digital.html` | Dados locais e preview | Publicação, cópia e QR são ações visuais | Posterior dentro da Etapa 9 |
| Mapa de Mesas | `paginas/salao/mapa-mesas.html` | `window.dadosMesas` | Grid, filtros e modal detalhado locais; comandos ainda simulados | Alta para leitura |
| Reservas | `paginas/salao/reservas.html` | `window.dadosReservasApexFood` | Agenda, filtros e detalhes locais; criação/status simulados | Alta para leitura e criação |
| Configuração de Mesas | `paginas/salao/configuracao-mesas.html` | `window.dadosMesas` | Cards, toggle, QR e modal locais; gravação simulada | Média |

O script `scripts/cardapio/dados-cardapio.js` concentra categorias, produtos e promoções em um único objeto local. Os scripts `categorias.js`, `produtos.js` e `promocoes.js` renderizam essa estrutura diretamente e, em ações de formulário ou edição, exibem avisos de preview. A integração poderá começar por um carregamento assíncrono compatível e só deverá substituir o mock quando a resposta da API estiver validada.

O script `scripts/salao/dados-mesas.js` contém dezoito mesas com capacidade, estado, reserva, cliente, comanda e itens resumidos. O mapa utiliza essa estrutura para filtros, indicadores e modal de detalhes. O script `scripts/salao/dados-reservas.js` contém a agenda de reservas e o script `reservas.js` filtra a data fixa exibida na página, renderiza a tabela e abre detalhes. Esse desenho permite migrar primeiro a leitura sem introduzir comandos operacionais de alto risco.

## 3. Coleções Firestore canônicas

A API deverá usar exclusivamente o caminho multi-tenant definido anteriormente:

```text
restaurantes/{idRestaurante}/categoriasCardapio/{idCategoria}
restaurantes/{idRestaurante}/produtos/{idProduto}
restaurantes/{idRestaurante}/promocoes/{idPromocao}
restaurantes/{idRestaurante}/configuracaoCardapioDigital/{idConfiguracao}
restaurantes/{idRestaurante}/mesas/{idMesa}
restaurantes/{idRestaurante}/eventosMesas/{idEvento}
restaurantes/{idRestaurante}/reservas/{idReserva}
restaurantes/{idRestaurante}/configuracaoSalao/{idConfiguracao}
```

O `idRestaurante` efetivo nunca será aceito como autoridade do navegador. Ele deverá ser obtido do contexto assinado ou da identidade da sessão e validado novamente pelo documento ativo em `restaurantes/{idRestaurante}/membros/{idUsuario}`. Os nomes das coleções permanecem em português e não serão criados aliases em inglês.

| Recurso | Campos mínimos server-side | Regras de integridade |
|---|---|---|
| Categoria | `nome`, `descricao`, `icone`, `cor`, `ordem`, `estado`, autoria e timestamps | Nome limitado e normalizado; ordem validada; exclusão lógica preferida |
| Produto | `idCategoria`, `nome`, `descricao`, `precoCentavos`, `custoCentavos`, `estoque`, `unidade`, `tempoPreparo`, `disponibilidade`, `versao`, estado e autoria | Valores monetários inteiros em centavos; categoria do mesmo restaurante; publicação versionada |
| Promoção | `nome`, `tipo`, regra, vigência, estado, limite e autoria | Datas e regras calculadas/validadas no servidor; sem confiar em desconto informado pelo cliente |
| Mesa | `nome`, `capacidade`, `estado`, posição/layout, estado de reserva e autoria | Capacidade positiva; estado enumerado; eventos de alteração somente por acréscimo |
| Reserva | `idMesa`, `nomeCliente`, contato mascarado, `inicioEm`, `fimEm`, `quantidadePessoas`, `estado`, `observacoes` e autoria | Capacidade e conflito verificados em transação; PII reduzida; status por máquina de estados |
| Configuração do salão | layout e parâmetros operacionais | Alteração restrita a papéis administrativos/gerenciais e auditada |

Os valores da interface atualmente exibidos como `preco`, `custo` e `valorGasto` serão convertidos no adaptador para os formatos de apresentação, mas a fonte canônica nova usará inteiros em centavos. Nenhuma senha, token, cookie, chave, contato completo ou payload financeiro desnecessário será retornado ao navegador.

## 4. Matriz inicial de autorização

A autorização seguirá o fluxo já implementado: sessão válida, resolução do restaurante ativo, membro ativo, papel permitido, validação de payload, operação e auditoria. O primeiro contrato usará os papéis canônicos já aprovados.

| Operação | Papéis permitidos inicialmente | Observação |
|---|---|---|
| Ler categorias/produtos/promoções | `proprietario`, `administrador`, `gerente`, `garcom`, `cozinha` quando aplicável | A resposta deve conter somente o restaurante ativo |
| Criar/editar categoria | `proprietario`, `administrador`, `gerente` | Auditoria e versão |
| Criar/editar produto | `proprietario`, `administrador`, `gerente` | Preço, custo e disponibilidade validados no servidor |
| Criar/editar promoção | `proprietario`, `administrador`, `gerente` | Regras e vigência calculadas/validadas no servidor |
| Ler mesas e reservas | `proprietario`, `administrador`, `gerente`, `garcom` | Contato deve ser mascarado |
| Criar/editar reserva | `proprietario`, `administrador`, `gerente`, `garcom` | Transação contra conflito e capacidade |
| Alterar estado operacional de mesa | `proprietario`, `administrador`, `gerente`, `garcom` | Comando explícito e evento de mesa |
| Alterar configuração/layout do salão | `proprietario`, `administrador`, `gerente` | Auditoria; não será liberado para `garcom` |
| Excluir definitivamente | Nenhum no primeiro recorte | Usar exclusão lógica quando necessário |

A matriz é um recorte técnico inicial e não altera a governança já aprovada. Caso o produto exija uma permissão mais granular, ela deverá ser documentada e testada antes de ser adicionada aos endpoints.

## 5. Recorte de implementação da Etapa 9

A primeira implementação deverá entregar endpoints de leitura para Cardápio e Salão, acompanhados dos comandos de menor risco que já possuem UI explícita. O navegador usará o mesmo cliente same-origin e o mesmo mecanismo de CSRF em memória da autenticação. Nenhum acesso direto do frontend ao Firestore será introduzido.

| Ordem | Entrega | Motivo |
|---|---|---|
| 1 | Leitura de categorias, produtos e promoções | Valida tenant, paginação/limites e transformação de dados sem mutação crítica |
| 2 | Leitura de mesas e reservas | Substitui os mocks no grid, tabela e modais mantendo a experiência atual |
| 3 | Criação e alteração controlada de reservas | Primeira escrita com transação de conflito/capacidade |
| 4 | Disponibilidade de produto e estados de mesa | Comandos pequenos, auditáveis e reversíveis |
| 5 | CRUD administrativo de categorias, produtos e configuração de mesas | Só após os contratos de leitura e escrita simples estarem estáveis |
| 6 | Promoções e Cardápio Digital | Regras de vigência/publicação e visão pública exigem validações adicionais |

Até a homologação de cada recurso, o mock local deverá permanecer como fallback controlado por feature flag de ambiente. A flag não poderá permitir que um usuário sem sessão contorne a API; ela apenas define se a página usa o adaptador remoto validado ou o preview local em Development.

## 6. Riscos identificados e controles

O risco principal é trocar uma fonte síncrona local por uma fonte assíncrona sem preservar loading, erro e estado vazio. Cada fragmento deverá manter seus elementos existentes e receber apenas um adaptador de carregamento. O segundo risco é IDOR/BOLA: IDs de produto, mesa, reserva e restaurante enviados pelo navegador serão tratados como não confiáveis e sempre consultados sob o restaurante resolvido server-side.

O terceiro risco é conflito de reservas. Criação ou alteração deverá ler capacidade e reservas sobrepostas dentro de transação, rejeitar conflito com código controlado e nunca disparar efeitos externos dentro da função transacional. O quarto risco é exposição de PII: a API retornará nome e contato mascarado quando necessário, mantendo dados completos fora das respostas de conveniência.

Também será obrigatório limitar payload, validar enumerações, aplicar paginação/limite, escapar valores no HTML existente, registrar auditoria sem payload sensível e conservar `firestore.rules` em deny-by-default. A migração não poderá inserir credenciais, ID tokens, chaves privadas ou dados de teste no GitHub.

## 7. Critérios de aceite da auditoria

A auditoria é considerada concluída porque o recorte de dados, permissões, coleções, prioridades, riscos e estratégia de fallback estão definidos. A próxima fase poderá implementar os endpoints sem alterar `index.html`, `scripts/shell/apex-shell.js` ou o layout dos fragmentos.

A Etapa 9 somente será considerada concluída após testes de usuário sem sessão, papel insuficiente, restaurante incorreto, ID manipulado, conflito de reserva, payload inválido, repetição de comando, XSS em campos textuais e falha de API. A publicação dependerá de testes locais aprovados, inspeção de segredos, deploy Ready e smoke test remoto em Development.

## Referências internas

[1]: `docs/firebase/etapa-0-governanca.md` — Governança, identidade, papéis e controles iniciais.  
[2]: `docs/firebase/etapa-6-schema-multitenant.md` — Schema multi-tenant, coleções, campos e invariantes.  
[3]: `scripts/cardapio/dados-cardapio.js` — Dados simulados atuais do Cardápio.  
[4]: `scripts/salao/dados-mesas.js` e `scripts/salao/dados-reservas.js` — Dados simulados atuais do Salão.  
[5]: `api/_lib/autorizacao.js`, `api/_lib/middleware.js` e `api/_lib/auditoria.js` — Contratos server-side já implementados.

## 8. Validação visual local inicial

O servidor local carregou `index.html#/produtos` e `index.html#/mapa-mesas` dentro do mesmo shell. A sidebar e o header apareceram uma única vez, as rotas permaneceram no body e os componentes existentes foram renderizados com os dados de preview quando não havia tenant ativo no contexto. Produtos exibiu filtros, indicadores, tabela e modal; Mapa de Mesas exibiu indicadores, grid de 18 mesas, busca, filtro e cards detalhados.

A rota `index.html#/categorias` também carregou no shell único, exibindo cinco categorias, indicadores, busca, grid e modal. A inspeção do console após o Mapa de Mesas não registrou saída de erro.

As rotas `index.html#/reservas` e `index.html#/configuracao-mesas` carregaram no shell único. Reservas manteve agenda de cinco dias, filtros, tabela com oito registros do dia e formulário de nova reserva. Configuração de Mesas manteve indicadores, busca, filtro, dezoito cards, QR visual e toggles de disponibilidade.

As rotas `index.html#/promocoes` e `index.html#/cardapio-digital` carregaram sem alteração estrutural. Promoções manteve quatro campanhas, filtros, ordenação, cards e modal. Cardápio Digital manteve status publicado, QR visual, cópia de link, modos desktop/mobile, toggles e preview de produtos.

## 9. Testes locais e revisão de segurança

A suíte local passou com **19 testes**, incluindo os 11 contratos já existentes da API e oito verificações novas da Etapa 9. Foram validados limites de paginação, textos e valores em centavos, enumerações fechadas, máscara de contato, remoção de autoria interna dos DTOs, transação/conflito de reserva, eventos de mesa, coleções em português e ausência de Firebase Client SDK, `localStorage`, `sessionStorage`, ID token e refresh token no frontend operacional. A sintaxe dos endpoints, helper e scripts de Cardápio e Salão passou com `node --check`.

A revisão estática confirmou que o navegador chama somente endpoints same-origin, usa CSRF em memória para mutações e não recebe acesso direto às credenciais do Admin SDK. O fallback de preview permanece permitido somente em `localhost`/`127.0.0.1`; em domínio publicado, falha de tenant, sessão ou autorização limpa os dados simulados em vez de ocultar uma falha remota com dados de demonstração. O Firestore continua protegido pelas Rules deny-by-default.

## 10. Publicação

O commit `be87ec5` foi publicado na branch `main` do GitHub e apareceu na Vercel como deployment Production. Na primeira checagem remota, o deployment ainda estava em estado `Building`; o smoke test remoto será executado somente após o estado `Ready`.

O deployment Production do commit `be87ec5` passou para `Ready` na Vercel. A URL pública principal permanece `https://apexfood.vercel.app`; a URL imutável do deployment Ready foi exibida pela Vercel como `https://apexfood-jmrcaxy70-frico-systems-projects.vercel.app`.

## 11. Smoke test remoto

Em `https://apexfood.vercel.app`, o endpoint `/api/v1/health` respondeu `200` com `{"estado":"ok","ambiente":"development","servico":"apex-food-api"}`. Os endpoints `/api/v1/cardapio?recurso=produtos` e `/api/v1/salao?recurso=mesas` responderam `401` com `NAO_AUTENTICADO`, confirmando proteção server-side e ausência de dados sem sessão. O acesso sem sessão a `index.html#/produtos` foi redirecionado para `paginas/autenticacao.html`, e a aba de cadastro publicada exibiu nome completo, email `@apexfood.com`, senha, confirmação e botão de criação.
