# Etapa 3 — Firebase Authentication Development

**Status:** Concluída em Development; aguardando autorização para iniciar a Etapa 4.

## Configuração confirmada no Firebase Console

| Recurso | Estado |
|---|---|
| Projeto | `apex-food-6c1cb` acessível pela conta autorizada |
| Provedor E-mail/senha | Ativado |
| Link de email sem senha | Desativado |
| Inscrição de usuários | Ativada |
| Exclusão de usuários | Ativada |
| Proteção contra enumeração de emails | Ativada |
| Política de aplicação de senha | Obrigatória |
| Tamanho mínimo | 12 caracteres |
| Maiúsculas | Obrigatórias |
| Minúsculas | Obrigatórias |
| Caracteres especiais | Obrigatórios |
| Números | Obrigatórios |
| Cota exibida de inscrições | 100 por hora |
| Domínios atuais | `localhost`, `apex-food-6c1cb.firebaseapp.com`, `apex-food-6c1cb.web.app` |
| Domínio Vercel | Pendente do nome real do projeto Vercel |
| Produção | Desativada |

## MFA

A seção avançada do Console informa que a autenticação multifator por SMS e outros recursos avançados exigem upgrade para Firebase Auth com Identity Platform no plano atual. Nenhum upgrade ou cobrança foi executado nesta etapa. O MFA continua como requisito de produção para perfis críticos e deverá ser habilitado após decisão de plano, método MFA e aprovação de custo.

## Arquivo de estado local

O estado confirmado está documentado em:

```text
configuracoes/firebase/auth-development.json
```

Esse arquivo é um manifesto de configuração e não contém tokens de sessão, service account, chave privada ou secret administrativo. A página de autenticação ainda não foi conectada ao Firebase nesta etapa; isso ocorrerá na Etapa 8, após API server-side e sessão segura.

## Segurança preservada

Nenhum token foi colocado no frontend ou no localStorage. A API key Web permanece classificada como identificador público; autorização, tenant, role e acesso a dados continuarão server-side. Nenhum domínio de produção ou domínio `.vercel.app` desconhecido foi autorizado.

**Próxima etapa condicionada à aprovação:** Etapa 4 — criar a identidade administrativa server-side para o backend, sem expor credenciais no frontend.

## Verificação inicial da identidade administrativa

A área **Configurações do projeto > Contas de serviço** foi aberta no projeto Development. O Console exibiu o link para gerenciar permissões da conta de serviço no Google Cloud, mas o painel de detalhes permaneceu carregando e não apresentou botão ou chave privada disponível nesta sessão.

Nenhuma service account nova foi criada e nenhuma chave privada foi gerada ou baixada. A identidade administrativa server-side permanece pendente de configuração segura para a Vercel.
