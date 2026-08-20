# Fase 10 — Controles, estados e eliminação de dados fixos

## Objetivo

A Fase 10 revisa os módulos que ainda apresentavam conteúdo estático, períodos específicos, links antigos ou avisos de integração futura. A implementação preserva o shell único, os fragments HTML, a identidade visual escura com destaque laranja e as funcionalidades aprovadas nas fases anteriores.

## Escopo implementado

O bridge de Relatórios deixou de declarar vendas, ranking, mapa de calor, avaliações e indicadores de exemplo. Ele inicia com estado vazio e hidrata os dados por meio das leituras autorizadas de Pedidos, Cardápio, Equipe e Financeiro. Os indicadores de vendas, canais, produtos mais vendidos, horários e performance são derivados dos documentos retornados pelo servidor.

Os controllers de Vendas por Período, Produtos Mais Vendidos, Horários de Pico, Avaliações dos Clientes e Performance da Equipe passaram a reagir à recarga do bridge. Os filtros recalculam a apresentação, as exportações geram arquivos CSV dos registros carregados e a impressão usa a janela atual. Estados sem registros utilizam mensagens específicas e profissionais.

O Cardápio Digital recebeu a coleção `configuracoesCardapioDigital`, com configuração tenant-aware para publicação, exibição de preços, aceite de pedidos, promoções e link público. A criação e atualização utilizam validação, versionamento e auditoria server-side. O link antigo fixo foi removido; cópia e download do QR Code só prosseguem quando há um link configurado.

O Dashboard de Desempenho passou a usar período dinâmico e a reagir aos eventos de atualização de Equipe, Pedidos e Relatórios. Períodos de mês e ano fixos foram substituídos por rótulos relativos nos filtros.

## Critérios de segurança

Nenhuma credencial, token, documento privado ou contexto de restaurante é armazenado no frontend. As leituras e mutações utilizam o cliente same-origin, cookies de sessão HttpOnly, CSRF e autorização server-side. A configuração digital permanece dentro do restaurante ativo e as auditorias são registradas pelo backend.

## Validação

A etapa automatizada da Fase 10 é `testes/etapa-22-controles-estados.test.js`. A suíte completa deve permanecer aprovada antes da publicação, incluindo os contratos das fases anteriores, os estados vazios, o cache `fase10`, a ausência de links antigos e o funcionamento das exportações.
