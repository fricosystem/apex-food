
## Estado após a falha de mesas

A leitura posterior confirmou que foram persistidos dez documentos com o prefixo `TESTE Persistencia 20260821` em `categoriasCardapio`, `produtosCardapio`, `promocoesCardapio` e `funcionarios`. Foi persistida apenas a mesa `TESTE Persistencia 20260821 Mesa 01`, com ID `mUVYsAF2TDicpfN4Uzr9`. Não foram encontradas ainda reservas, escalas, contas ou movimentações com o prefixo.

Os produtos receberam IDs e referências válidas às dez categorias, comprovando que a persistência tenant-aware e a sequência categoria → produto funcionaram. A regra de duplicidade de mesas precisa ser corrigida ou contornada antes de repetir as nove mesas restantes.

## Segunda carga autorizada

Após o deployment `a8be0dc`, as mesas 02 a 10 foram criadas com sucesso. Em seguida, foram criadas dez escalas e dez contas financeiras, sem falhas. As dez tentativas de movimentação financeira foram rejeitadas com `RECURSO_INVALIDO` e a mensagem `Mutação financeira inválida ou não disponível`, sem indicação de gravação parcial. O próximo diagnóstico deve alinhar o recurso usado pelo cliente ao handler Financeiro antes de repetir essas dez operações.
