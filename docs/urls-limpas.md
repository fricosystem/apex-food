# URLs limpas do APEX Food

## Convenção pública

As páginas estáticas do APEX Food são publicadas na Vercel com `cleanUrls: true`. Assim, um arquivo físico como `paginas/autenticacao.html` fica acessível publicamente em `/paginas/autenticacao`, enquanto o endereço antigo com `.html` é redirecionado pela Vercel para a forma limpa.

A mesma convenção vale para novas páginas HTML adicionadas ao projeto. O caminho público deve omitir a extensão, por exemplo, `paginas/financeiro/novo-relatorio`, mesmo que o arquivo físico continue sendo `paginas/financeiro/novo-relatorio.html`.

## Shell interno

O `scripts/shell/apex-shell.js` mantém `fragmento` com a extensão `.html` porque esse é o arquivo físico carregado pelo shell. O campo `href`, usado pelos links visíveis e pela seleção de navegação, não deve conter `.html`. Essa separação preserva o carregamento local dos fragmentos e evita a extensão no endereço público.

## Compatibilidade

Links legados que ainda apontarem para `.html` continuam compatíveis na Vercel porque `cleanUrls` redireciona para a URL sem extensão. O manifest PWA inicia na raiz `/`, e a página de autenticação usa `/paginas/autenticacao` como URL pública.

## Validação obrigatória

Antes de publicar uma nova rota HTML, execute `npm test`. O teste `testes/urls-limpas.test.js` verifica a configuração Vercel, o manifest, os `href` do shell/sidebar, a existência dos fragmentos físicos e o canal alfa da logo transparente.
