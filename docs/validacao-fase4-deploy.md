
## Observação adicional de cache do asset

Após o commit `31a9457`, a Visão Geral continuou exibindo alguns zeros antigos (`R$ 0,00`, `0% ocupado` e `0,0 / 5`) embora o código local já os substitua por estados neutros. O shell e o conteúdo real foram atualizados, mas o renderer foi solicitado com a URL fixa `scripts/home/home.js?v=fase4`, permitindo que a CDN mantivesse a versão anterior do asset.

A correção incremental será atualizar somente o parâmetro de versão do script para um identificador novo. Não será alterada a lógica do shell nem a estrutura da página.
