# Validação da correção do shell

O diagnóstico confirmou que o `index.html` possui um único sidebar e um único header. A duplicação observada vinha do `fetch` de fragmentos físicos como `paginas/home.html`: as regras públicas de Vercel redirecionavam esse caminho para `/`, e o roteador injetava o `index.html` completo dentro de `#conteudoPagina`.

A correção publicada usa o cabeçalho interno `X-Apex-Fragment` no fetch do roteador e rotas condicionais com `missing` para manter os redirects públicos somente quando o cabeçalho não existe. A suíte local e a suíte do clone passaram com 69/69 testes.

Após a publicação do commit `276cb2b`, a abertura com cache-buster redirecionou para `/autenticacao`, indicando que a sessão persistida do navegador expirou ou foi encerrada. A confirmação visual do shell único depende de novo login da conta de teste.
