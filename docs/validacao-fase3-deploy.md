# Validação do deploy — Fase 3

Em 20 de agosto de 2026, o domínio de desenvolvimento `https://apexfood.vercel.app/` redirecionou corretamente para `/autenticacao` quando não havia sessão ativa. A página de autenticação carregou com a identidade visual existente, as abas Entrar/Criar conta, os campos de login e o sufixo `@apexfood.com`. O bloco de onboarding permanece oculto até que o login seja validado e a API retorne que a conta não possui restaurante ativo.

O commit publicado para esta validação é `0c4c4c4` (`Fase 3: onboarding do primeiro restaurante`).

A validação funcional do login exige a senha da conta de teste `bruno.bm3051@apexfood.com`, que não está disponível no contexto atual; ela deve ser digitada pelo usuário no navegador ou fornecida diretamente, sem ser salva em arquivos, localStorage ou Git.
