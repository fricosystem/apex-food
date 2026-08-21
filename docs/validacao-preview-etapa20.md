# Validação do preview — Etapa 20

## Preview local

O clone de publicação foi servido em `http://localhost:4175/`.

A raiz carregou o shell único do APEX Food com sidebar, header e navegação por URLs limpas. A Visão Geral exibiu estados vazios operacionais e não apresentou produtos ou categorias fictícios.

A rota `/categorias` carregou pelo shell único e exibiu `0 categorias encontradas` com a mensagem `Nenhuma categoria real encontrada`, confirmando que o bridge não injeta mais o conjunto de preview local. A tela manteve o layout existente, o botão `Nova categoria`, busca e o estado de sincronização.

## Observação

O preview local não possui sessão Firebase real nem dados do restaurante; por isso, os estados vazios são esperados. A validação de mutações não foi executada no preview para evitar gravações fora do ambiente de produção.

## Cardápio administrativo

A rota `/produtos` carregou com `0 produtos encontrados`, indicadores zerados, filtros de categoria/status e campo de estoque visível. Não houve itens de catálogo fictícios.

A rota `/cardapio-digital` carregou com status `Não publicado`, link público não configurado, configurações desmarcadas conforme o estado inicial seguro e preview com `Nenhum produto encontrado`. O QR exibido é apenas o componente visual existente da tela administrativa; não houve publicação ou mutação durante o preview.

## Rota pública `/mesa`

O acesso direto a `http://localhost:4175/mesa` retornou 404 porque o servidor HTTP estático simples não aplica os rewrites de URL limpa da Vercel. Isso é uma limitação do servidor de preview local, não da configuração publicada: a raiz `/` carregou o shell único normalmente, e o `vercel.json` mantém os rewrites da rota `/mesa` para o shell.
