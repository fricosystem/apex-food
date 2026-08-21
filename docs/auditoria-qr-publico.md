# Auditoria do QR público

A causa da falha exibida no celular foi identificada no endpoint público `GET /api/v1/qrcode-mesa?acao=validar&qr=...`: `consultarQrPublico` tentava chamar `.data()` em um `DocumentReference` retornado por `buscarMesaPorToken`. Isso gerava erro interno antes da identificação do cliente e era convertido pela interface na mensagem genérica.

A correção foi publicada no commit `ae646cb`, com 311/311 testes, e o deployment da Vercel foi concluído com sucesso. Na sessão autenticada de produção, a Mesa 04 de teste possui QR ativo e versão `9483fd2a-9aa0-4742-854b-538085beca7b`; as demais mesas de teste ainda não possuem QR ativo. O próximo teste deve consultar o link público da Mesa 04 sem regenerar o código.

## Reprodução após a primeira correção

O link público recuperado da Mesa 04 foi `https://apexfood.vercel.app/mesa?qr=8arLYtHpBXXJzL5iLvhzP4t3duexcwtpaWNIUMp_fOE`. Após o deployment do commit `ae646cb`, a tela ainda exibiu `Não foi possível concluir a solicitação`. A correção do `DocumentReference` removeu uma causa real, mas existe outra falha no caminho público. O próximo passo é consultar diretamente a resposta HTTP do endpoint para obter o código e o `requestId`, sem depender da mensagem genérica da interface.

## Segunda reprodução após deployment resiliente

Mesmo após o commit `c69b6ac` e o deployment concluído, o endpoint `GET /api/v1/qrcode-mesa?acao=validar&qr=...` continuou retornando HTTP 500 com `ERRO_INTERNO`. Portanto, a falha não está apenas na leitura opcional do documento pai do restaurante. A próxima ação deve capturar a exceção server-side por etapa ou revisar a consulta `collectionGroup('mesas')` e a resolução da referência em produção.

## Diagnóstico definitivo do Firestore

Após o commit `f25e15d`, o endpoint público passou a retornar HTTP 503 com `QR_INDICE_INDISPONIVEL`, confirmando que a consulta `collectionGroup('mesas').where('qrHash', '==', hash)` está bloqueada pela configuração de índice do Firestore. No Console, a criação de índice manual exibiu o aviso `this index is not necessary, configure using single field index controls`; portanto, o ajuste correto é habilitar o índice de campo único para `qrHash` com escopo `COLLECTION_GROUP` na seção Automático, e não criar um índice manual composto.
