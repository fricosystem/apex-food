# Etapa 3 — QR Code e sessão pública da mesa

**Projeto:** APEX Food  
**Ambiente:** Development  
**Status:** Implementação preparada; aguardando validação pública e aprovação para a Etapa 4  
**Escopo:** gerar, revogar, validar QR Code e abrir sessão temporária com nome completo  
**Fora do escopo:** cardápio público, envio de pedido, cozinha, caixa e processamento de pagamento

## Resultado implementado

A configuração de mesas passou a usar um endpoint server-side para gerar QR Codes. O token é criado com aleatoriedade criptográfica, usado somente no link HTTPS devolvido ao operador autenticado e armazenado na mesa somente como hash SHA-256. A resposta autenticada também contém uma imagem QR em Data URL gerada localmente pela dependência server-side `qrcode`; nenhum token é enviado a serviço externo de QR.

A geração e a revogação exigem sessão autenticada, contexto de restaurante, papel `proprietario`, `administrador` ou `gerente`, CSRF e App Check conforme o ambiente. As operações usam transações e chaves de idempotência. Repetições com a mesma chave não criam uma nova versão nem duplicam eventos.

A tela pública `/mesa` é carregada pelo shell único, mas a classe de contexto oculta somente o chrome administrativo nessa experiência. O fragmento permanece no `body` do `index.html`; não existe sidebar ou header duplicado. O guard de sessão libera exclusivamente `/mesa`, enquanto todas as rotas administrativas continuam exigindo autenticação.

## Endpoints

| Endpoint | Método | Função | Proteção |
|---|---:|---|---|
| `/api/v1/qr-mesas` | `POST` | Gerar ou revogar QR de mesa | Sessão autenticada, contexto, papel de gestão, CSRF e App Check conforme configuração |
| `/api/v1/qrcode-mesa?acao=validar&qr=...` | `GET` | Validar QR e retornar somente restaurante/mesa públicos | Token opaco e origem permitida |
| `/api/v1/qrcode-mesa` | `POST` | Abrir sessão com nome completo | CSRF, token QR, transação e idempotência |
| `/api/v1/qrcode-mesa?acao=sessao` | `GET` | Restaurar a própria sessão da mesa | Cookie HttpOnly assinado e escopo do restaurante |

O endpoint público não retorna `idRestaurante`, `qrHash`, autoria, tokens, cookies ou dados de outras mesas. A consulta da sessão usa o restaurante embutido no cookie assinado pelo servidor e busca somente a mesa, comanda e participante vinculados.

## Sessão do cliente

O cliente não cria conta, não informa senha e não é identificado por ID do dispositivo ou fingerprint. Depois da validação do QR, informa obrigatoriamente o nome completo para atendimento. O servidor cria `sessoesMesa/{idSessaoMesa}` e `comandas/{idComanda}/participantes/{idParticipante}` em uma transação, atualiza a mesa para ocupada, cria/retoma a comanda e registra evento em `eventosMesas`.

O navegador recebe o cookie HttpOnly `__Host-apex_mesa` na Vercel, ou `apex_mesa` no desenvolvimento local. O valor contém apenas um payload assinado com `idRestaurante`, `idSessaoMesa` e expiração. O frontend não usa `localStorage` ou `sessionStorage` como fonte de sessão.

A sessão possui TTL de quatro horas, pode ser encerrada nas etapas posteriores e não é prova de identidade. O nome serve apenas para o garçom identificar o participante dentro do atendimento atual.

## Segurança e limites

O Firestore continua sendo acessado somente pelo backend com Admin SDK. O cliente não possui credenciais Firebase nem acesso direto às coleções. O hash secreto do QR é removido do DTO de Salão antes da resposta ao frontend. A geração cifra o token apenas na chave de idempotência para permitir repetição segura da mesma requisição sem guardar o token em claro.

Em Development, o App Check segue o modo configurado pelo projeto, atualmente desligado por contrato do ambiente. A proteção primária do acesso público é o token QR opaco, revogável, a validação de origem, CSRF nas mutações, sessão assinada e escopo transacional. Rate limit distribuído e App Check em `enforce` permanecem controles de promoção operacional para ambiente posterior.

A sessão pública nesta etapa ainda não cria pedidos e não carrega o cardápio. A Etapa 4 deverá consumir o cookie da sessão para retornar apenas o cardápio publicado e permitir o carrinho/comanda persistidos no Firestore.

## Critérios de aceite

A Etapa 3 será aceita quando o deployment confirmar a rota `/mesa`, o endpoint público, o cookie seguro, a geração/revogação autenticada e a ausência de token/hash em respostas indevidas. A suíte contratual deve permanecer aprovada, incluindo o isolamento das rotas administrativas e o roteamento limpo.

## Arquivos principais

- `api/_lib/qrcode-mesas.js`
- `api/v1/qrcode-mesa.js`
- `api/v1/qr-mesas.js`
- `paginas/publico/mesa.html`
- `scripts/publico/mesa.js`
- `estilos/publico/mesa.css`
- `scripts/salao/configuracao-mesas.js`
- `paginas/salao/configuracao-mesas.html`
- `scripts/auth/sessao-guard.js`
- `scripts/shell/apex-shell.js`
- `vercel.json`

## Pausa de aprovação

A Etapa 3 deverá ser validada no deployment Development antes de avançar. A Etapa 4 somente começará após aprovação explícita, e implementará o cardápio público e a comanda persistida do cliente.
