# Validação do link público por mesa

A rota pública `/mesa` foi aberta pelo shell único no preview local. Sem o parâmetro `qr`, a tela não solicita autenticação operacional e apresenta a orientação pública para iniciar o atendimento pelo QR Code; no servidor HTTP estático local, a chamada à API não configurada resulta no estado de erro `Não foi possível concluir o atendimento.`.

A tela mantém a identidade visual pública do APEX Food, o título Atendimento da mesa e a ação acessível `Tentar novamente`. O fluxo com token válido é atendido pelo endpoint consolidado `/api/v1/qrcode-mesa`, que valida o token, solicita o nome completo e cria a sessão HttpOnly da mesa.
