# Fase 3 — Triagem e correção do fluxo de sessão e restaurante ativo

**Projeto:** APEX Food

**Ambiente:** Development

**Status:** Corrigido localmente; aguardando publicação e validação remota.

## Diagnóstico

A sessão Firebase era criada corretamente no login, mas o frontend redirecionava imediatamente para `/`. O login não chamava `/api/v1/restaurantes` nem `/api/v1/restaurantes/trocar`, portanto não criava o cookie HttpOnly `apex_contexto` que identifica o restaurante ativo.

O endpoint `/api/v1/auth/session` respondia `autenticado: true` com `restauranteAtivo: null`. Em seguida, os módulos operacionais tentavam consultar Cardápio, Salão, Equipe ou Financeiro sem contexto. O backend corretamente recusava a operação por ausência de restaurante, enquanto os carregadores removiam os dados de preview em Development publicado. Para o usuário, o resultado era uma tela vazia, carregamento incompleto ou sensação de sistema quebrado.

> **Causa raiz:** autenticação válida não era tratada como equivalente a contexto operacional válido.

## Correções aplicadas

O `sessao-guard.js` agora lê `restauranteAtivo.idRestaurante` na resposta de sessão. O shell só é liberado quando a sessão está autenticada e possui restaurante ativo. Uma sessão sem contexto volta para `/autenticacao`, sem deixar o usuário dentro de uma interface operacional que não consegue consultar dados.

O `auth.js` agora busca os restaurantes ativos após o login e chama `/api/v1/restaurantes/trocar` antes do redirecionamento para `/`. Quando a conta possui um único restaurante, a seleção é automática. Quando possui mais de um, a página exibe uma seleção real e grava o contexto somente pelo cookie HttpOnly emitido pelo backend. Nenhum `localStorage`, `sessionStorage`, token ou `idRestaurante` de autoridade é usado.

Quando a conta não possui vínculo ativo, o login permanece na página e apresenta a mensagem controlada de que a conta está autenticada, mas ainda não está vinculada a um restaurante. Nenhum restaurante fictício é criado automaticamente.

## Matriz de comportamento

| Estado | Comportamento esperado |
|---|---|
| Sem sessão na raiz | Redireciona para `/autenticacao` |
| Sessão válida com um restaurante | Seleciona o restaurante no backend e abre `/` |
| Sessão válida com vários restaurantes | Exibe seletor e só abre `/` após seleção válida |
| Sessão válida sem restaurante | Não libera o shell; informa vínculo ausente |
| Restaurante inválido ou sem acesso | Exibe erro controlado do backend |
| Falha temporária da API | Mantém a autenticação visível e informa indisponibilidade |
| Contexto expirado | O guard retorna à autenticação e exige nova seleção |

## Segurança preservada

A lista de restaurantes é filtrada no backend por `collectionGroup('membros')`, usuário da sessão e estado ativo. A troca valida novamente o vínculo com `resolverIdentidadeSessao`, aplica CSRF e App Check conforme ambiente, grava `apex_contexto` assinado e registra auditoria. O navegador só envia o identificador escolhido como intenção; ele não cria autorização.

A resposta de sessão continua sem dados sensíveis. O cookie de contexto tem escopo HttpOnly e TTL controlado. O fluxo não altera as Rules deny-by-default nem expõe credenciais Firebase no frontend.

## Critérios de aceite

A correção será aceita após sintaxe JavaScript aprovada, suíte completa sem regressão, teste do guard com e sem restaurante ativo, teste estático do bootstrap de seleção, deployment `Ready` e smoke test público das rotas e endpoints. O login real deverá ser validado com uma conta de Development vinculada a pelo menos um restaurante.

Contas sem restaurante não serão mascaradas com seed fictício. A criação ou onboarding do primeiro restaurante será tratada em uma etapa própria, exigindo nome comercial real informado pelo usuário ou por um fluxo de cadastro autorizado.
