# Validação do preview — Etapa 21

## Preview local

O clone de publicação foi servido em `http://localhost:4175/`.

A raiz carregou o shell único do APEX Food com as rotas limpas. O Mapa de Mesas e a tela de Reservas carregaram os assets da Etapa 21, sem criar sidebar ou header próprios.

## Mapa de Mesas

A rota `/mapa-mesas` exibiu `0 mesas cadastradas no ambiente atual`, indicadores zerados, busca, filtro por status e estado vazio profissional. Nenhuma das 18 mesas fictícias da versão anterior apareceu.

## Reservas

A rota `/reservas` exibiu a agenda dos cinco dias, filtros de busca/status/canal, botão `Nova reserva`, indicadores zerados e `Nenhuma reserva encontrada`. Nenhuma reserva fictícia foi injetada no ambiente local.

## Observação de ambiente

O preview local não possui sessão Firebase real nem dados do restaurante. Por isso, os estados vazios são esperados. Nenhuma mutação foi executada durante o preview.

## Verificação em produção

Após o push do commit `d536c30`, o status do GitHub/Vercel passou para `success` com a descrição `Deployment has completed`.

As URLs `https://apexfood.vercel.app/mapa-mesas` e `https://apexfood.vercel.app/reservas` responderam sem 404 e redirecionaram para `/autenticacao` quando acessadas sem sessão, confirmando que as rotas limpas e o guard de autenticação estão ativos em produção.
