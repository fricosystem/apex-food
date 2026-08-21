# Etapa 15 — Contrato de Perfil e Preferências

## Objetivo

Adicionar ao APEX Food uma página de configurações acessível pelo menu do perfil, mantendo o shell único em `index.html`, as URLs limpas e o atendimento por endpoints server-side. A etapa não criará uma nova função em `api/v1/`; o módulo será incorporado ao endpoint operacional consolidado.

## Operações aprovadas

| Operação | Método e recurso | Escopo | Persistência |
|---|---|---|---|
| Consultar perfil | `GET /api/v1/operacional?modulo=perfil` | Próprio usuário autenticado | `usuarios/{idUsuario}` e sessão atual |
| Atualizar nome | `PATCH /api/v1/operacional?modulo=perfil` com `acao=atualizar_perfil` | Próprio usuário autenticado | `usuarios/{idUsuario}` |
| Consultar preferências | `GET /api/v1/operacional?modulo=perfil&recurso=preferencias` | Próprio usuário autenticado | `usuarios/{idUsuario}` |
| Atualizar preferências | `PATCH /api/v1/operacional?modulo=perfil&recurso=preferencias` | Próprio usuário autenticado | `usuarios/{idUsuario}.preferenciasNotificacao` |
| Alterar senha | `POST /api/v1/operacional?modulo=perfil` com `acao=alterar_senha` | Próprio usuário autenticado | Firebase Authentication; auditoria no Firestore |

## Campos em português

O documento global `usuarios/{idUsuario}` continuará sendo usado, sem mover dados existentes. Os campos mantidos ou acrescentados são `idUsuario`, `emailCanonico`, `nomeExibicao`, `estado`, `preferenciasNotificacao`, `criadoEm`, `atualizadoEm` e `ultimoLoginEm`. As preferências iniciais são `alertasOperacionais` e `avisosSistema`, ambas booleanas e com padrão `true` quando ainda não existirem.

A API retornará DTOs mínimos: nunca enviará senha, token de sessão, token FCM, hash, cookie, segredo, payload completo de auditoria ou dados internos do restaurante. O email será somente leitura nesta etapa para evitar mudança de identificador sem fluxo de verificação dedicado.

## Segurança

Todas as operações exigirão sessão autenticada, origem permitida, App Check, CSRF nas mutações, rate limit e isolamento pelo `uid` da sessão. O frontend não escolherá `idUsuario`, `idRestaurante` ou autoria por payload. O nome será validado no servidor e a atualização será transacional ou feita com `set(..., { merge: true })` controlado, com auditoria de alteração.

A alteração de senha não exporá ID token no navegador. O servidor confirmará a senha atual usando o email canônico da sessão e, somente após essa confirmação, solicitará a atualização da senha ao Firebase Authentication. A nova senha seguirá a mesma política mínima já vigente: oito caracteres, letra maiúscula, letra minúscula, número e caractere especial.

## Interface

A rota pública do shell será `/configuracoes-perfil`, com fragmento físico em `paginas/configuracoes/perfil.html`, estilo em `estilos/configuracoes/perfil.css` e controller em `scripts/configuracoes/perfil.js`. O menu do perfil ganhará a opção **Configurações do perfil**; as opções atuais **Notificações** e **Sair** continuarão funcionando.

A página será responsiva para desktop, tablet e mobile e exibirá estados de carregamento, sucesso, erro, ausência de restaurante ativo e campos somente leitura de email e sessão. Nenhum dado fictício será usado; quando não houver valor persistido, a interface informará isso diretamente.

## Critérios de aceite da fase de contrato

O contrato será considerado aprovado quando o handler reutilizar o multiplexador `/api/v1/operacional`, os nomes de campos permanecerem em português, o usuário só puder operar o próprio documento, a alteração de senha não passar pelo frontend, o email permanecer somente leitura e todas as mudanças relevantes forem auditadas.
