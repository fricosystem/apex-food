# Etapa 10 — Cenário end-to-end e dados descartáveis

## Ambiente

A validação será executada contra o código publicado no ambiente **Development** do APEX Food. O repositório deverá permanecer na branch `main`, com o clone de publicação em `/tmp/apex-food-push` limpo antes do início da implementação.

A conta de teste e o restaurante `APEX FOOD RESTAURANTE` são referências operacionais já configuradas, mas a suíte automatizada não gravará documentos artificiais no Firestore desse restaurante sem uma operação autenticada e explicitamente controlada. O cenário nominal será exercitado por contratos, handlers e smoke tests protegidos; quando uma sessão de papel ou dados reais não estiverem disponíveis, o resultado será registrado como não executado, nunca como sucesso fictício.

## Identificadores lógicos do cenário

| Recurso | Identificador lógico | Regra |
|---|---|---|
| Restaurante | `restaurante-teste-etapa10` | Somente fixture ou ambiente Development isolado |
| Mesa | `mesa-etapa10` | QR opaco, revogável e sem identificador previsível no token |
| Comanda | `comanda-etapa10` | Uma comanda ativa por mesa no cenário |
| Participante | `participante-etapa10` | Nome operacional fictício apenas nos testes locais |
| Pedido | `pedido-etapa10` | Uma sequência nominal e uma sequência de repetição |
| Encaminhamento | `encaminhamento-etapa10` | Sem dados de pagamento |
| Notificações | Prefixo lógico `etapa10:` | Identificadores não reutilizados em dados reais |

Esses identificadores são valores de contrato e não deverão ser enviados ao Firestore de clientes ou ao ambiente Production. Fixtures locais deverão permanecer em memória ou em mocks de teste.

## Sequência nominal

O cenário nominal deve confirmar, nesta ordem, a validação do QR, abertura da sessão anônima com nome completo, consulta do cardápio, criação idempotente do pedido, confirmação do garçom, encaminhamento à cozinha, início e conclusão do preparo, serviço, encerramento da comanda, recebimento e conclusão operacional do caixa e liberação da mesa.

A cada transição, a expectativa é conferir o estado persistido e o evento correspondente. A notificação deverá ser consequência do evento server-side e não uma confirmação produzida pelo navegador.

| Marco | Estado esperado | Registro associado |
|---|---|---|
| QR validado | Token aceito sem expor dados internos | Sessão técnica de validação |
| Sessão aberta | `ativa` | `sessoesMesa` e participante |
| Pedido enviado | `aguardando_confirmacao_garcom` | `pedidos`, itens, eventos e notificação de garçom |
| Pedido confirmado | `confirmado_garcom` | Histórico, auditoria e comanda em consumo |
| Pedido na cozinha | `enviado_cozinha` / `em_preparo` | `fichasCozinha` e notificação de cozinha |
| Pedido pronto | `pronto` | Histórico e notificação do garçom responsável |
| Pedido servido | `servido` | Histórico do pedido |
| Comanda encaminhada | `encaminhada_caixa` | `encaminhamentosCaixa` e notificação do caixa |
| Caixa recebeu | `recebida` | Atualização idempotente do encaminhamento |
| Atendimento concluído | `encerrada` e mesa `disponivel` | Sessões encerradas, auditoria e notificação final |

## Critérios de não execução

Não serão considerados aprovados os casos em que apenas a interface apresentar uma mensagem de sucesso sem resposta persistida da API. Também não serão criados cartões ou notificações fictícias para preencher estados vazios. Uma indisponibilidade de credencial, papel, índice ou ambiente será registrada como bloqueio técnico com a evidência correspondente.

## Limpeza e privacidade

Nenhum token QR, cookie de sessão, segredo, email pessoal, IP ou credencial será gravado em documentação, fixture versionada ou log de teste. A validação de segurança deverá confirmar que o frontend não usa `localStorage`, `sessionStorage`, Firebase Web SDK ou tokens operacionais. Dados criados em um ambiente de teste isolado deverão ser removidos ou expirar conforme a política de retenção antes do encerramento da etapa.

## Resultado preliminar da validação visual

A rota raiz carregou no preview local com um único shell administrativo, sidebar, header, sino desktop/mobile e estados vazios reais em português. A tentativa de abrir `/mesa` no servidor simples `python3 -m http.server` retornou HTTP 404 porque esse servidor não aplica os rewrites da Vercel; isso não é tratado como falha do sistema. A rota pública `/mesa` deverá ser validada no domínio Vercel, que possui o rewrite correspondente, e também pelo arquivo físico `paginas/publico/mesa.html` quando o preview local for necessário.

A validação visual na Vercel confirmou HTTP 200 e carregamento da rota `/mesa`; sem um QR válido, a tela exibiu o estado profissional `Não foi possível abrir esta mesa` e orientou o cliente a apontar a câmera para o QR, sem dados fictícios. A rota `/pedidos-ativos` também carregou com sidebar e header únicos, badge de notificações em zero por ausência de sessão, filtros operacionais e estados vazios `Nenhum pedido encontrado`.
