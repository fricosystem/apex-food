# Project TODO

- [ ] Executar teste ponta a ponta controlado: mesa pública, comanda do cliente, aceite do garçom, preparo na cozinha, devolução ao garçom, encaminhamento ao caixa e encerramento operacional.
- [ ] Registrar evidências, estados percorridos e eventuais falhas do teste de comanda sem processar pagamento.
- [x] Corrigir o desaparecimento da sidebar após o login, preservando a sessão, o contexto do restaurante e as permissões locais.
- [x] Diagnóstico registrado: na sessão autenticada em produção, marca e perfil aparecem na sidebar, mas os itens de navegação não são renderizados e não há erro no console do navegador.
- [x] Confirmar o deployment da correção `b032d8b` em produção: o endpoint de sessão passou a retornar permissões efetivas e os itens autorizados voltaram a ser renderizados.
- [ ] Verificar a abertura de detalhes e o link público de uma mesa disponível no teste ponta a ponta; o cartão da Mesa 03 não respondeu ao clique automatizado e não expõe o identificador técnico no DOM.
- [ ] Gerar e usar o QR público da Mesa 03 no teste controlado, pois a consulta confirmou que ela não possui QR ativo.
- [ ] Corrigir a validação da entrada pública da comanda: o nome de teste preenchido foi rejeitado como se estivesse vazio ao iniciar o atendimento.
- [ ] Evidência do teste: sessão pública da Mesa 03 criada com participante de teste e cardápio carregado com itens disponíveis para pedido.
- [ ] Evidência do teste: pedido de teste da Mesa 03 foi confirmado pelo garçom e a consulta autorizada registrou o status `enviado_cozinha`.
- [ ] Evidência do teste: pedido da Mesa 03 apareceu na fila de cozinha com 1 de 1 tarefa atribuída à cozinheira; confirmar a persistência do início de preparo após o clique.
- [ ] Evidência do teste: pedido da Mesa 03 foi iniciado na cozinha e o comando de marcar pronto foi acionado; confirmar a persistência do retorno ao garçom.
- [ ] Evidência do teste: pedido da Mesa 03 foi servido e a comanda foi encaminhada à fila do caixa; a sessão pública refletiu o serviço, porém não ofereceu ação explícita de encerramento ao cliente.
- [ ] Corrigir a confirmação de recebimento no caixa: `financeiro-handler.js` usa `exigirPermissao`, porém `financeiro.js` não exporta esse helper e gera erro interno 500.
