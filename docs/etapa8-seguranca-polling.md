# Etapa 8 — Segurança, rate limit e polling do QR

## Rate limit por operação

O endpoint consolidado `/api/v1/qrcode-mesa` aplica o helper `limite.js` antes de executar cada ação pública. As chaves são pseudonimizadas por SHA-256 e não incluem IP, cookie, token QR ou nome do cliente em claro.

| Ação | Limite | Janela |
|---|---:|---:|
| `validar` | 30 | 60 segundos |
| `sessao` | 60 | 60 segundos |
| `cardapio` | 60 | 60 segundos |
| `comanda` | 60 | 60 segundos |
| `abrir` | 10 | 60 segundos |
| `pedido` | 20 | 60 segundos |
| administrativa | 60 | 60 segundos |

Em Development, o helper utiliza memória local para permitir validação funcional. Em Preview, Staging e Production, a ausência, indisponibilidade ou resposta inválida do provedor distribuído interrompe a operação com erro controlado `503`, conforme a política de segurança.

## Polling do atendimento

A atualização da comanda pública deixou de usar intervalo fixo. O controller usa timeout controlado, jitter de até 1,2 segundo e backoff limitado a 60 segundos quando há falha transitória. A aba pausa as consultas quando `document.hidden` é verdadeiro e agenda nova consulta curta ao retornar à visibilidade. O polling é encerrado ao perder a sessão ou descarregar a página.

A memória do navegador contém apenas estado temporário de interface: carrinho, categoria selecionada, token CSRF em memória e controle do polling. Nenhum pedido, confirmação, preço, sessão ou liberação de mesa depende de `localStorage` ou `sessionStorage`.

## Mensagens de erro

Respostas `429` mostram o tempo de espera enviado pelo servidor, quando disponível. Respostas `503` informam indisponibilidade temporária da proteção contra abuso. O cliente não declara sucesso em nenhuma dessas situações e não limpa a sessão pública automaticamente. O `idRequisicao` é preservado somente no objeto de erro em memória para correlação técnica, sem renderizar dados internos ao cliente.

## App Check

O endpoint público QR permanece com `appCheck: false` nesta etapa porque o cliente público atual não emite tokens Firebase App Check. Os handlers administrativos continuam chamando o verificador server-side conforme o modo configurado. A ativação de enforcement público fica condicionada à implementação e validação do token no cliente, à revisão dos domínios e a testes de falso positivo.

## Idempotência e concorrência

As mutações de abertura e pedido continuam exigindo CSRF, sessão ou token QR válido, transação e chave de idempotência. O rate limit não substitui a idempotência: ele apenas reduz abuso e tempestades de consulta. O Firestore continua sendo a fonte definitiva para estado, preço, pedido, comanda, mesa, auditoria e encerramento.
