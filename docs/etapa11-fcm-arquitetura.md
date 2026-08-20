# Etapa 11 — Descoberta da arquitetura FCM

## Fontes oficiais consultadas

A documentação oficial do Firebase informa que o FCM para Web funciona somente em páginas HTTPS porque depende de Service Workers. O domínio `apexfood.vercel.app` já atende a esse requisito.

A configuração Web requer uma credencial pública Web Push/VAPID. A chave pública pode ser usada no registro do Firebase Messaging no cliente e não substitui nenhum segredo server-side. O Firebase também exige um arquivo de Service Worker próprio para o Messaging no domínio raiz; o APEX Food já possui `service-worker.js` para o teste local e deverá incorporar o tratamento FCM em etapa posterior sem perder o clique e o badge já publicados.

A permissão deve ser solicitada pelo navegador antes do registro do dispositivo. A documentação atual recomenda registrar a instalação e encaminhar ao servidor o identificador/token necessário para direcionamento, sem armazenar credenciais do usuário no frontend.

No backend, o Firebase Admin SDK é a rota prevista para envio por dispositivo. O endpoint consolidado existente poderá ser reutilizado para registrar tokens, revogar tokens, listar preferências e solicitar o envio sem criar outra Serverless Function. Tokens inválidos ou expirados deverão ser marcados como revogados e removidos de futuras tentativas.

## Implicações para o APEX Food

| Requisito | Decisão preliminar |
|---|---|
| Transporte | Firebase Cloud Messaging para Web |
| Cliente | Firebase Messaging modular, carregado somente no fluxo autenticado e após permissão |
| Chave pública | VAPID pública do projeto Firebase, configurada como variável pública controlada ou arquivo de configuração não secreto |
| Segredo | Nenhuma chave privada, token de sessão ou credencial Admin no frontend |
| Service Worker | Reutilizar `/service-worker.js` e adicionar tratamento FCM compatível |
| Backend | Reutilizar `/api/v1/operacional` e o Admin SDK já presente |
| Coleção sugerida | `restaurantes/{idRestaurante}/dispositivosNotificacao` |
| Identidade | Associar dispositivo ao usuário autenticado e restaurante ativo, nunca confiar em dados enviados pelo cliente |
| Revogação | Revogar por logout, erro de token inválido, remoção do restaurante ou preferência desativada |
| Vercel | Manter quatro funções serverless; não criar outra função |

## Dependência antes da implementação

A implementação real precisa da **chave pública VAPID** gerada ou importada na configuração Cloud Messaging do projeto `apex-food-6c1cb`. A chave pública não é segredo, mas não deve ser confundida com `FIREBASE_PRIVATE_KEY`, `SESSION_SECRET` ou `CSRF_SECRET`. A decisão final também deve confirmar se o escopo inicial será somente notificações do próprio restaurante autenticado ou se haverá envio para todos os usuários da conta.

## Referências

[1]: https://firebase.google.com/docs/cloud-messaging/web/get-started "Get started with Firebase Cloud Messaging in Web apps"
[2]: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk "Send a message using Firebase Admin SDK"
[3]: https://firebase.google.com/docs/cloud-messaging/manage-tokens "Best practices for FCM registration token management"

## Modelo Firestore aprovado para a implementação

A coleção será `restaurantes/{idRestaurante}/dispositivosNotificacao`. O documento será identificado por um hash SHA-256 truncado do token FCM; assim, a mesma instalação pode ser atualizada sem duplicação e sem depender de índice composto.

| Campo | Tipo | Regra |
|---|---|---|
| `idRestaurante` | string | Preenchido exclusivamente pelo servidor a partir da sessão ativa |
| `idUsuario` | string | Preenchido exclusivamente pelo servidor |
| `tokenFcm` | string privada | Armazenado apenas server-side; nunca devolvido em DTO |
| `hashToken` | string | Identificador determinístico do documento |
| `plataforma` | enum | `android`, `desktop`, `tablet` ou `web` |
| `origem` | enum | `pwa` ou `navegador` |
| `statusDispositivo` | enum | `ativo` ou `revogado` |
| `preferencias` | objeto | Preferências controladas pelo servidor, inicialmente operacionais e sistema |
| `criadoEm`, `atualizadoEm`, `ultimoUsoEm` | timestamp | Timestamps server-side |
| `revogadoEm` | timestamp/null | Preenchido ao revogar |
| `expiraEm` | timestamp | Renovação controlada, inicialmente em 90 dias |

O registro será aceito somente para a identidade autenticada e o restaurante ativo da sessão. Um token já vinculado a outro usuário ou restaurante gera conflito controlado, sem reassociação silenciosa. A leitura administrativa retorna apenas metadados do dispositivo do próprio usuário; tokens, hashes e dados de user-agent não são exibidos. Revogação será transacional e idempotente, com auditoria operacional.

A emissão real ficará separada do registro: o cliente obtém o token após permissão, o envia ao endpoint consolidado e o servidor decide os destinatários usando as notificações persistidas e os dispositivos ativos. Tokens inválidos retornados pelo FCM serão revogados, sem erro exposto ao usuário.

## Validação visual preliminar

O servidor HTTP local simples retornou 404 para `/autenticacao`, pelas mesmas limitações já registradas para URLs limpas sem rewrite. A rota publicada `https://apexfood.vercel.app/autenticacao` carregou HTTP 200 com o formulário de login, abas de autenticação, identidade visual e campos existentes preservados. A validação final dos assets FCM será feita diretamente na Vercel após a publicação da etapa.

## Próxima etapa: administração de dispositivos

A administração será incorporada ao painel de notificações já existente no shell único. A aba **Atualizações** continuará exibindo as notificações operacionais; a aba **Dispositivos** exibirá somente metadados não sensíveis da instalação autenticada, como plataforma, origem, estado e último uso. O usuário poderá revogar a instalação atual, reativá-la quando necessário e ajustar duas preferências: alertas operacionais e avisos do sistema.

A interface não exibirá token FCM, hash, user-agent ou credenciais. O teste controlado de envio será permitido somente para a própria identidade autenticada e terá mensagem explicitamente identificada como teste. O servidor continuará usando a mesma função operacional consolidada, com CSRF, App Check, rate limit, auditoria e envio apenas para dispositivos ativos do próprio usuário.
