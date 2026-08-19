# Etapa 1 — Ambientes Development e Preview

**Status:** Concluída localmente; aguardando autorização para iniciar a Etapa 2.

## Decisão de ambiente

O APEX Food permanecerá exclusivamente em **Development** nesta fase. O projeto Firebase `apex-food-6c1cb` será tratado como Development até que o usuário autorize explicitamente uma mudança para produção.

O Preview da Vercel utilizará temporariamente o domínio gratuito no formato:

```text
https://<projeto-vercel>.vercel.app
```

O nome real do projeto Vercel ainda precisa ser confirmado após o deploy. Até lá, nenhum domínio foi adicionado ao Firebase Authorized Domains e nenhuma variável de produção foi criada.

## Controles implementados no workspace

| Controle | Implementação |
|---|---|
| Bloqueio de secrets | `.gitignore` criado para `.env`, service accounts, chaves, certificados e `.vercel/`. |
| Contrato de configuração | `.env.example` criado com placeholders e separação entre valores públicos e secrets server-side. |
| Mapa de ambientes | `configuracoes/firebase/ambientes.md` atualizado com Development, Preview temporário e Production desativado. |
| Projeto ativo | `apex-food-6c1cb` classificado somente como Development. |
| Produção | Sem projeto, domínio, variável ou deploy de produção configurado. |
| Dados | Seeds e usuários de teste são permitidos; dados reais de clientes não são permitidos. |
| Preview | Pode usar o mesmo projeto Development apenas com dados sintéticos e isolamento operacional. |

## Verificações executadas

O workspace contém os arquivos `.gitignore`, `.env.example`, `configuracoes/firebase/ambientes.md` e este relatório. O `.gitignore` bloqueia credenciais administrativas e arquivos de ambiente. Nenhuma chave privada, service account, variável Vercel real, usuário Firebase ou dado de cliente foi criado.

## Pendências externas

1. Publicar o projeto na Vercel para descobrir o nome/URL `.vercel.app`.
2. Adicionar a URL real ao Firebase Authentication Authorized Domains na Etapa 2.
3. Criar um projeto Firebase Staging separado antes de testes persistentes compartilhados.
4. Confirmar a região do Firestore.

**Próxima etapa condicionada à aprovação:** Etapa 2 — confirmar o Web App Firebase e cadastrar os domínios `.vercel.app` autorizados, sem habilitar produção.
