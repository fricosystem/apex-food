# Etapa 2 — Web App Firebase e domínios Development

**Status:** Configuração local preparada; aguardando confirmação no Firebase Console e autorização para iniciar a Etapa 3.

## 1. Web App identificado

O Web App Development foi registrado localmente com os valores fornecidos para o projeto `apex-food-6c1cb`:

| Campo | Valor |
|---|---|
| `apiKey` | Configuração pública registrada em `configuracoes/firebase/firebase-config-development.js` |
| `authDomain` | `apex-food-6c1cb.firebaseapp.com` |
| `projectId` | `apex-food-6c1cb` |
| `storageBucket` | `apex-food-6c1cb.firebasestorage.app` |
| `messagingSenderId` | `771860546633` |
| `appId` | `1:771860546633:web:4e609e3c334ed02d352b98` |

A API key do Firebase Web é pública por design, mas não concede autorização. O arquivo não é carregado pelo shell nesta etapa e não contém service account, `private_key`, sessão ou segredo administrativo.

## 2. Domínios autorizados

Como ainda não existe domínio próprio nem nome confirmado do projeto Vercel, a lista segura inicial é:

```text
localhost
```

Quando o projeto for publicado na Vercel, adicionar somente a URL real no formato:

```text
<projeto-vercel>.vercel.app
```

Não adicionar curingas, domínios desconhecidos, URLs de terceiros, IPs temporários ou domínio de produção. A URL precisa ser adicionada em **Firebase Console > Authentication > Settings > Authorized domains** somente depois de confirmada.

## 3. Arquivos criados

| Arquivo | Função |
|---|---|
| `configuracoes/firebase/firebase-config-development.js` | Manifesto local da configuração Web pública; não carregado pelo shell. |
| `configuracoes/firebase/dominios-development.json` | Allowlist de Development e regra de inclusão do Preview `.vercel.app`. |
| `docs/firebase/etapa-2-web-app.md` | Este relatório da etapa. |

## 4. Ação manual necessária no Firebase Console

1. Acessar o projeto `apex-food-6c1cb` no Firebase Console.
2. Abrir **Project settings > General > Your apps**.
3. Confirmar que existe um Web App com o `appId` informado.
4. Comparar todos os campos com o manifesto local.
5. Em **Authentication > Settings > Authorized domains**, manter `localhost` durante Development.
6. Não adicionar domínio de produção.
7. Após o deploy Vercel, adicionar somente o domínio `.vercel.app` real e registrar a alteração no manifesto.

A CLI Firebase não está instalada nesta sessão e a CLI Vercel também não está disponível; portanto, nenhuma alteração externa foi executada automaticamente. A etapa foi preparada sem risco de deploy ou modificação de produção.

## 5. Validação

O manifesto público foi criado sem segredos administrativos, o projeto está marcado como Development, produção permanece desativada e a allowlist inicial contém somente `localhost`. A confirmação visual no Firebase Console e a inclusão do domínio `.vercel.app` real serão concluídas quando o projeto Vercel possuir uma URL identificável.

**Próxima etapa condicionada à aprovação:** Etapa 3 — configurar Firebase Authentication e políticas de acesso em Development.

## Bloqueio identificado ao iniciar a Etapa 3

Após o login no Google com a conta `fricoalimentossystem@gmail.com`, o Firebase Console retornou: **“O projeto não existe ou você não tem permissão para listar apps no projeto”** para `apex-food-6c1cb`.

Nenhuma configuração do Firebase Authentication foi alterada. A Etapa 3 está bloqueada até que o usuário confirme que o projeto existe nessa conta ou conceda a permissão necessária, ou informe o ID correto do projeto Development.

## Nova verificação de acesso

Após a solicitação de troca de conta, o Firebase Console ainda exibiu a conta `fricoalimentossystem@gmail.com` e retornou **“Esse projeto não existe ou você não tem permissão para visualizá-lo”** para `apex-food-6c1cb`.

A Etapa 3 permanece pausada. Nenhum provedor, usuário, política ou regra de Authentication foi alterado.

## Acesso corrigido e estado do Authentication

A conta correta `apexhub3051@gmail.com` acessou o projeto `apex-food-6c1cb`. No painel Authentication > Método de login, o provedor **E-mail/senha** já aparece como **ativado**. O link de email sem senha permanece desativado.

Nenhuma alteração foi salva nesta verificação; o próximo passo é revisar as configurações disponíveis antes de concluir a Etapa 3.

## Configuração iniciada no Firebase Console

Com a conta correta `apexhub3051@gmail.com`, o projeto `apex-food-6c1cb` foi acessado. O provedor E-mail/senha está ativo. A política de senha foi aberta e a opção **Exigir a aplicação** foi selecionada; o requisito de caractere maiúsculo foi marcado como parte da configuração Development.

## Política de senha definida

A política de senha do Development foi configurada na interface para exigir aplicação obrigatória, mínimo de 12 caracteres e caracteres maiúsculos, minúsculos, especiais e numéricos. As alterações ainda estão no estado de edição do Console e serão salvas após a confirmação visual final.

## Política de senha salva

O Firebase Console confirmou o estado salvo da política de senha no Development: aplicação obrigatória, mínimo de 12 caracteres e exigência de maiúscula, minúscula, caractere especial e número. O botão de salvar deixou de aparecer como alteração pendente após a gravação.

## Domínios e cota confirmados

O Firebase Console confirmou os domínios padrão `localhost`, `apex-food-6c1cb.firebaseapp.com` e `apex-food-6c1cb.web.app`. Nenhum domínio `.vercel.app` foi adicionado porque o projeto Vercel ainda não possui nome/URL confirmado.

A cota atual de inscrições exibida no Development é de 100 por hora. Nenhuma alteração de cota foi salva; o rate limiting da API server-side continuará sendo obrigatório na Etapa 7.

## Ações de usuário confirmadas

Na seção Ações do usuário, o Firebase Console exibiu ativas as opções de criação/inscrição, exclusão de conta e **Proteção contra enumeração de e-mails (recomendado)**. O botão Salvar não indicou alterações pendentes, portanto nenhuma mudança adicional foi necessária.
