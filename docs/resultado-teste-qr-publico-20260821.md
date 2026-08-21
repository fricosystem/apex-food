# Validação em produção do QR público e da comanda digital

**Projeto:** APEX Food — `apex-food-6c1cb`
**Domínio:** [apexfood.vercel.app](https://apexfood.vercel.app/)
**Repositório:** `fricosystem/apex-food`, branch `main`
**Data:** 21 de agosto de 2026
**Responsável pelo registro:** Manus AI

## 1. Objetivo e escopo

Este registro consolida a correção do acesso público por QR Code e a validação operacional da comanda digital da Mesa 04. O teste foi executado com os dados reais de teste já carregados no Firestore, usando a sessão autenticada do restaurante **APEX FOOD RESTAURANTE** e uma sessão pública temporária identificada pelo nome completo do cliente.

O escopo aprovado compreendeu a validação do QR, a identificação do cliente, a abertura segura da sessão, o carregamento do cardápio, a montagem do carrinho, o envio do pedido ao garçom e a confirmação de que o pedido apareceu na fila operacional. Não foram executadas transições posteriores para cozinha, preparo, serviço ou caixa, e nenhum pagamento foi processado.

## 2. Correção do índice do Firestore

A consulta server-side usada para validar o QR é uma consulta de grupo de coleções sobre `mesas.qrHash`. O Firestore exige um índice com escopo de grupo de coleções quando uma consulta desse tipo aplica filtro ou ordenação; índices automáticos com esse escopo não são mantidos por padrão [1].

No Console do Firebase, foi salva a seguinte isenção automática:

| Configuração | Valor aplicado |
| --- | --- |
| Coleção | `mesas` |
| Campo | `qrHash` |
| Escopo | Grupo de coleções |
| Índice crescente | Ativado |
| Índice decrescente | Desativado |
| Índice de matrizes | Desativado |

A configuração correta foi uma **isenção de campo único**, e não um índice manual composto. O índice crescente é suficiente para a consulta por igualdade; a própria documentação do Firebase informa que, para campos não matriciais e não mapas, é necessário selecionar crescente ou decrescente mesmo quando a finalidade principal é igualdade [2].

A construção foi assíncrona e levou alguns minutos. Enquanto o índice estava pendente, a API retornou `QR_INDICE_INDISPONIVEL`, associado ao código Firestore `9` (`failed-precondition`). Após a conclusão, a consulta passou a retornar HTTP 200.

## 3. Validação pública do QR

O endpoint consolidado testado foi:

```text
GET /api/v1/qrcode-mesa?acao=validar&qr=8arLYtHpBXXJzL5iLvhzP4t3duexcwtpaWNIUMp_fOE
```

O resultado foi **HTTP 200**, com os dados mínimos esperados:

| Campo | Resultado |
| --- | --- |
| Restaurante | `APEX FOOD RESTAURANTE` |
| Mesa | `TESTE Persistencia 20260821 Mesa 04` |
| Identificador da mesa | `JZnPhvLwNneLs0xM7n5E` |
| Capacidade | 4 lugares |

O link público [da Mesa 04](https://apexfood.vercel.app/mesa?qr=8arLYtHpBXXJzL5iLvhzP4t3duexcwtpaWNIUMp_fOE) deixou de exibir o erro de configuração e apresentou corretamente o formulário **“Digite seu nome completo”**.

## 4. Abertura segura da sessão

Foi executada a abertura de uma sessão pública temporária com o nome `Cliente Teste Persistencia`. A API retornou **HTTP 200** e criou no Firestore a sessão da mesa, o participante e a comanda correspondente. A tela pública foi recarregada com o cookie HttpOnly da sessão e exibiu:

> Cliente Teste Persistencia está identificado no atendimento da TESTE Persistencia 20260821 Mesa 04.

A tentativa preliminar com `Cliente Teste Persistencia 20260821` foi rejeitada corretamente por `NOME_COMPLETO_INVALIDO`, porque o contrato server-side exige que cada palavra do nome completo comece com uma letra. Nenhum registro inválido foi criado por essa tentativa.

## 5. Cardápio real e configuração operacional

Inicialmente, a sessão carregou os produtos, mas informou que o restaurante não estava aceitando pedidos. A consulta autenticada ao endpoint de Cardápio confirmou que o documento de configuração ainda não existia.

O Cardápio Digital administrativo foi então publicado com os dados reais disponíveis no Firestore. O preview administrativo exibiu:

| Registro | Quantidade observada |
| --- | ---: |
| Categorias | 10 |
| Produtos | 10 |
| Promoções | 10 |

O controle **Aceitar pedidos** estava inicialmente desativado. Ele foi ativado no módulo administrativo e a configuração foi persistida. A consulta posterior confirmou:

```json
{
  "publicado": true,
  "aceitarPedidos": true,
  "exibirPrecos": true,
  "mostrarPromocoes": true
}
```

Após a alteração, a sessão pública exibiu os 10 produtos reais, com preços e disponibilidade, sem utilizar dados fictícios no navegador.

## 6. Carrinho e envio do pedido

Foi adicionado ao carrinho o produto `TESTE Persistencia 20260821 Produto 01`, com quantidade 1 e preço de **R$ 19,90**. A interface confirmou a montagem do carrinho, o subtotal e a habilitação do botão de envio.

O pedido foi enviado ao garçom pela comanda digital. O resultado foi:

| Verificação | Resultado |
| --- | --- |
| Número do pedido | `178735478625706` |
| Quantidade de itens | 1 |
| Produto | `TESTE Persistencia 20260821 Produto 01` |
| Total | R$ 19,90 |
| Status do pedido | `aguardando_confirmacao_garcom` |
| Status da comanda | `em_consumo` |
| Total acumulado da comanda | R$ 19,90 |

Na própria sessão pública, o pedido apareceu como **Aguardando confirmação do garçom**. Em seguida, o módulo autenticado [Pedidos Ativos](https://apexfood.vercel.app/pedidos-ativos) exibiu o mesmo pedido na coluna **Aguardando confirmação**, associado à Mesa 04 e ao cliente `Cliente Teste Persistencia`.

Esse resultado confirma a integração ponta a ponta até a fila do garçom:

> QR público → identificação → sessão Firestore → cardápio real → carrinho → pedido persistido → fila do garçom.

## 7. Limites do teste

O pedido permaneceu aguardando a confirmação do garçom. Não foram realizadas as etapas seguintes do fluxo operacional, pois elas exigem decisões e ações adicionais da equipe: confirmação ou rejeição pelo garçom, envio à cozinha, preparo, marcação como pronto, serviço na mesa, encaminhamento ao caixa e encerramento da comanda.

A configuração do cardápio foi deixada publicada e com aceitação de pedidos habilitada para permitir a reprodução do fluxo de teste. O pedido de teste permanece como registro operacional real no Firestore e pode ser tratado pela equipe conforme o fluxo normal ou removido posteriormente quando solicitado.

## 8. Conclusão

A correção do índice `mesas.qrHash` foi aplicada no Firestore de produção e validada. O QR público da Mesa 04 está operacional. A identificação sem conta, a sessão temporária protegida, a leitura do cardápio real, a montagem do carrinho, o envio transacional do pedido e a visualização pelo garçom funcionaram conforme o fluxo aprovado.

Não foram expostos tokens, cookies, segredos, credenciais ou dados sensíveis no frontend, no localStorage, no Git ou neste documento. Nenhum pagamento foi processado.

## Referências

[1]: https://firebase.google.com/docs/firestore/query-data/index-overview "Index types in Cloud Firestore — Firebase Documentation"

[2]: https://firebase.google.com/docs/firestore/query-data/indexing "Manage indexes in Cloud Firestore — Firebase Documentation"

[3]: https://apexfood.vercel.app/mesa?qr=8arLYtHpBXXJzL5iLvhzP4t3duexcwtpaWNIUMp_fOE "Link público de teste da Mesa 04"

[4]: https://apexfood.vercel.app/pedidos-ativos "Módulo autenticado de Pedidos Ativos"
