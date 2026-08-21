# Validação de preview — Etapa 18

A raiz `http://localhost:4173/` carregou o `index.html` com o shell único, sidebar, header e a Visão Geral no body. O menu exibiu o link limpo `/configuracao-mesas`, sem `.html`, `/paginas/` ou hash.

A navegação direta para `http://localhost:4173/configuracao-mesas` retornou 404 porque o servidor HTTP estático simples não aplica os rewrites definidos para a Vercel. Isso não representa falha do shell: a validação deve ser feita entrando pela raiz e navegando com a History API, ou usando um servidor local que implemente os rewrites de produção.

O preview também confirmou a presença do menu Salão e da opção Configuração de Mesas no shell único, sem sidebar ou header duplicados no fragmento.


Na navegação pelo shell para `/configuracao-mesas`, o fragmento carregou dentro do layout existente. O DOM confirmou 18 cards com o estado `QR Code não gerado`, o botão `Revogar código` no modal e o botão `Regenerar QR` presente, porém oculto inicialmente (`hidden=true`) até a API retornar um QR ativo.
