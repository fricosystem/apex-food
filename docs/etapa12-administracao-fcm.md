# Etapa 12 — Administração de dispositivos e teste FCM

## Objetivo

A Etapa 12 transforma a integração FCM em uma operação administrável dentro do painel de notificações já existente. Nenhum header, sidebar ou shell paralelo foi criado. A administração ocorre no painel aberto pelo sino, com comportamento responsivo para desktop, tablet e PWA Android.

## Funcionalidades

O painel possui duas abas. **Atualizações** preserva a central operacional já publicada. **Dispositivos** consulta os dispositivos vinculados à identidade autenticada e exibe somente plataforma, origem, estado e último uso. O token FCM, seu hash, user-agent e credenciais nunca são enviados ao navegador.

Cada dispositivo ativo permite ajustar as preferências de **alertas operacionais** e **avisos do sistema**, solicitar um **teste controlado** ou revogar a instalação. Dispositivos revogados podem ser reativados pelo próprio usuário quando ainda pertencem à sua identidade. O teste controlado envia somente para o dispositivo selecionado e somente para a própria conta autenticada.

## Segurança e operação

As operações utilizam o endpoint operacional consolidado, sessão por cookie HttpOnly, CSRF, App Check, rate limit fail-closed e auditoria. O backend limita o registro, consulta e mutação ao restaurante ativo da sessão. O emissor FCM filtra a identidade, a preferência correspondente e o estado ativo antes de enviar. Tokens inválidos são revogados automaticamente após a resposta do Firebase.

O teste controlado não altera pedidos, comandas, cozinha, caixa ou mesa. Ele apenas envia a mensagem `APEX Food — teste de dispositivo` e informa ao usuário se o envio foi aceito pelo FCM. A confirmação de entrega no sistema operacional continua dependendo do dispositivo, da permissão e da conectividade do navegador ou PWA.

## Critérios de aceite

| Critério | Resultado esperado |
|---|---|
| Acesso sem sessão | HTTP 401 e nenhuma lista de dispositivos |
| Isolamento | Uma conta só consulta e testa seus próprios dispositivos |
| Revogação | Transação, auditoria e estado `revogado` |
| Preferências | Alteração transacional sem token no DTO |
| Teste controlado | Mensagem enviada apenas ao dispositivo selecionado |
| Responsividade | Painel adaptável sem duplicar header ou sidebar |
| Vercel | Uma única função operacional adicionalmente reutilizada; total máximo preservado |
| Dados fictícios | Nenhum dispositivo artificial criado durante a validação |

## Homologação recomendada

Para homologar o recebimento real, o operador deve abrir a autenticação em um dispositivo ou PWA, permitir as notificações, acessar a aba **Dispositivos** e usar **Enviar teste**. Depois, deve verificar a notificação no sistema operacional. A automação contratual valida o isolamento e o contrato; ela não fabrica tokens nem grava dispositivos artificiais no Firestore.
