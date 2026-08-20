# URLs limpas do APEX Food

## Convenção pública

As páginas do APEX Food usam rotas profissionais no formato `/nomedapagina`. A URL pública não expõe a pasta física `paginas/`, não exibe `.html` e não usa hash routing. Exemplos: `/`, `/operacional`, `/novo-pedido`, `/mapa-mesas` e `/autenticacao`.

A organização física continua separada da URL pública. Os fragmentos permanecem em `paginas/` para preservar a estrutura do projeto, enquanto `vercel.json` reescreve as rotas públicas para o shell único ou para a página standalone de autenticação.

## Shell interno

O `scripts/shell/apex-shell.js` mantém o campo `fragmento` apontando para o arquivo físico com extensão `.html`, mas o campo `href` usa somente a rota pública absoluta. A navegação usa a History API (`pushState`, `replaceState` e `popstate`) para atualizar o endereço sem recarregar o shell e sem criar `/#/nomedapagina`.

O roteador ainda reconhece hashes legados durante a migração. Se uma sessão antiga abrir `index.html#/produtos`, o hash é convertido para `/produtos` por `replaceState` antes de carregar o fragmento correspondente.

## Compatibilidade

URLs antigas com `/paginas/`, `.html` ou o arquivo legado `mapa-mesas.html` recebem redirecionamento permanente para a rota pública equivalente. Isso mantém favoritos e links existentes utilizáveis sem permitir que a forma antiga continue aparecendo na barra do navegador.

A página de autenticação pública é `/autenticacao`. O guard também reconhece temporariamente `/paginas/autenticacao` e `/paginas/autenticacao.html` para evitar falhas durante a transição, mas todos os novos redirecionamentos usam `/autenticacao`.

## Validação obrigatória

Antes de publicar uma nova rota, execute `node --test`. O teste `testes/urls-limpas.test.js` verifica a configuração da Vercel, o manifest, os `href` do shell e do sidebar, a ausência de `/paginas/` e hash nas rotas públicas, a compatibilidade do hash legado, a existência dos fragmentos físicos e o canal alfa da logo transparente.
