# Preview local — Etapa 9

A rota raiz foi aberta em `http://127.0.0.1:4173/` com HTTP 200. O preview apresentou um único sidebar, um único header administrativo e o conteúdo da Visão Geral carregado no body do shell.

O sino de notificações apareceu no header desktop com badge `0`, coerente com o ambiente local sem sessão autenticada. O clique no sino não expôs dados fictícios nem alterou a estrutura do shell; o painel é criado dinamicamente pelo controller compartilhado e depende da API same-origin para consultar dados reais.

Os assets `apex-shell.js?v=etapa9-notificacoes` e `notificacoes.js?v=etapa9-notificacoes` foram encontrados no HTML servido localmente. A Visão Geral exibiu estados vazios profissionais, sem registros operacionais artificiais.

A inspeção do console não encontrou erro JavaScript da central. O DOM confirmou que a API same-origin expõe `listarNotificacoes`, que existem dois botões de sino — desktop e mobile — e que o painel dinâmico foi criado no body, permanecendo oculto após o fechamento/estado inicial. O único aviso observado foi o aviso padrão do Tailwind CDN usado pelo sistema existente.
