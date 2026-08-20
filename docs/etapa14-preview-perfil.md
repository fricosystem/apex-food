# Preview local — Perfil no sidebar

O preview local carregou o shell administrativo com um único sidebar desktop, um único conteúdo principal e o botão de perfil fixado na parte inferior do sidebar. O botão exibiu as informações públicas disponíveis da sessão, com avatar, identificação da conta e estado de sessão autenticada.

Ao clicar no botão, o menu abriu no rodapé do sidebar com `role="menu"`, as opções **Notificações** e **Sair**, além do cabeçalho **Perfil**. O menu também recebeu os handlers de clique externo e tecla Escape. A validação visual não acionou o logout real para não encerrar a sessão persistida do navegador de teste; os contratos automatizados verificam que a ação chama `/api/v1/auth/logout` por POST através do cliente same-origin.

O menu usa largura relativa ao sidebar e permanece dentro do aside, sem criar novo header ou novo sidebar. A mesma área inferior existe no sidebar mobile, que reutiliza o controller compartilhado.
