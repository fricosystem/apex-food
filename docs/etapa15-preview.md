# Preview local — Etapa 15

A raiz do preview local carregou o shell único com `apex-shell.js?v=etapa15-perfil`, mantendo sidebar desktop, conteúdo principal e botão de perfil no rodapé. A navegação direta para `/configuracoes-perfil` retornou 404 porque o servidor estático local em uso não possui fallback para URLs profundas; isso não representa o comportamento de produção, que usa as regras de rewrite da Vercel e o roteador History API.

A rota deverá ser validada abrindo a raiz e navegando pelo menu do perfil, ou usando o servidor de preview com fallback. Nenhuma alteração estrutural foi feita no `index.html`.

A navegação interna pelo shell para `/configuracoes-perfil` funcionou: o título foi atualizado para **Configurações do Perfil**, o fragmento apareceu dentro do conteúdo principal e o sidebar único permaneceu intacto. O controller exibiu o estado de erro de consulta porque o servidor estático local não executa as APIs `/api/v1/`; esse comportamento é esperado no preview sem backend e será validado no deployment da Vercel.

Na primeira abertura da página, o layout estrutural ficou correto, mas o controller exibiu duas mensagens de erro HTTP 404 porque a API operacional não existe no servidor estático local. Para revisar a composição visual completa sem alterar o código, o próximo preview usará uma resposta temporária interceptada somente no navegador de teste.

Com uma resposta temporária controlada somente no navegador, o preview completo renderizou o nome, email somente leitura, estado da conta, restaurante e papéis, as duas preferências com switches, os três campos de senha e os horários da sessão. Os cartões mantiveram fundo escuro, borda cinza clara e acento laranja apenas em ícones, avatar e ações. O sidebar único e o header permaneceram intactos, e a hierarquia entre títulos, rótulos e textos auxiliares ficou preservada no viewport desktop.

O menu do perfil foi validado aberto dentro da página e passou a exibir **Configurações do perfil**, **Notificações** e **Sair**. A navegação interna e os controles da página permaneceram visíveis, sem criação de sidebar ou header adicional.

Após a primeira publicação, a verificação de produção identificou que a rota limpa ainda não estava incluída no grupo de rewrites da Vercel. O `vercel.json` foi corrigido para encaminhar `/configuracoes-perfil` ao shell principal, e o contrato `urls-limpas.test.js` passou a cobrir explicitamente essa rota. A correção aguarda uma nova publicação para a verificação final em produção.
